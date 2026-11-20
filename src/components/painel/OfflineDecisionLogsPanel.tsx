import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  Download,
  RefreshCw,
  ShieldAlert,
  FileCheck2,
  Search,
} from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { syncRuleEngineDecisionLogToFirestore } from '../../services/firestoreService';
import type { AuditLog, UserProfile, UserRole } from '../../types/domain';
import { exportToCSV, formatDateBR } from '../../utils/formatters';
import {
  hydrateRuleEngineLogsFromIdb,
  listPendingOfflineDiagnostics,
  listRuleEngineDecisionLogs,
  markRuleEngineDecisionReviewed,
  markRuleEngineDecisionSynced,
  mergeLocalAndCloudRuleLogs,
  parseRuleDecisionLogsFromAuditLogs,
  subscribeOfflineEngineChanges,
  type RuleEngineDecisionLog,
} from '../../utils/offlineRuleEngineStore';

interface OfflineDecisionLogsPanelProps {
  role: UserRole;
  userProfile: UserProfile;
  auditLogs: AuditLog[];
  isDark?: boolean;
  onRefreshWorkspace: () => Promise<void>;
}

const ORIGIN_LABELS: Record<RuleEngineDecisionLog['origin'], string> = {
  diagnostico_publico: 'Diagnóstico Público',
  diagnostico_ia_regras: 'Síntese Diagnóstico (Regras)',
  parecer_regras: 'Parecer Técnico (Regras)',
  custos_regras: 'Custos Oficiais (Regras)',
  norma_regras: 'Análise Normativa (Regras)',
  documento_regras: 'Pré-conferência Documental',
  proposta_regras: 'Proposta de Parceiro',
};

const MODE_BADGE: Record<RuleEngineDecisionLog['mode'], { label: string; cls: string }> = {
  offline: {
    label: 'Offline (Sem rede)',
    cls: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-200 dark:border-rose-800/70',
  },
  online_fallback_regras: {
    label: 'Regras Locais (IA indisponível)',
    cls: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800/70',
  },
  online_nuvem: {
    label: 'Motor + Nuvem',
    cls: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800/70',
  },
};

export const OfflineDecisionLogsPanel: React.FC<OfflineDecisionLogsPanelProps> = ({
  role,
  userProfile,
  auditLogs,
  isDark = false,
  onRefreshWorkspace,
}) => {
  const {
    isOnline,
    catalogSource,
    lastRulesSyncAt,
    syncingOffline,
    lastSyncFeedback,
    forceSyncOfflineData,
  } = useApp();

  const [localLogs, setLocalLogs] = useState<RuleEngineDecisionLog[]>(() => listRuleEngineDecisionLogs());
  const [pendingLeadsCount, setPendingLeadsCount] = useState<number>(() => listPendingOfflineDiagnostics().length);
  const [filterStatus, setFilterStatus] = useState<'todos' | 'pendentes_revisao' | 'aguardando_nuvem' | 'revisados'>(
    'todos',
  );
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewNotesDraft, setReviewNotesDraft] = useState<Record<string, string>>({});
  const [savingReviewId, setSavingReviewId] = useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = useState<string | null>(null);

  useEffect(() => {
    void hydrateRuleEngineLogsFromIdb().then((hydrated) => setLocalLogs(hydrated));
    return subscribeOfflineEngineChanges(() => {
      setLocalLogs(listRuleEngineDecisionLogs());
      setPendingLeadsCount(listPendingOfflineDiagnostics().length);
    });
  }, []);

  const cloudLogs = useMemo(() => parseRuleDecisionLogsFromAuditLogs(auditLogs), [auditLogs]);
  const allLogs = useMemo(() => mergeLocalAndCloudRuleLogs(localLogs, cloudLogs), [localLogs, cloudLogs]);

  const counts = useMemo(() => {
    const pendentesRevisao = allLogs.filter((l) => l.syncStatus !== 'revisado').length;
    const aguardandoNuvem = allLogs.filter((l) => l.syncStatus === 'pendente').length;
    const revisados = allLogs.filter((l) => l.syncStatus === 'revisado').length;
    return { total: allLogs.length, pendentesRevisao, aguardandoNuvem, revisados };
  }, [allLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLogs.filter((log) => {
      if (filterStatus === 'pendentes_revisao' && log.syncStatus === 'revisado') return false;
      if (filterStatus === 'aguardando_nuvem' && log.syncStatus !== 'pendente') return false;
      if (filterStatus === 'revisados' && log.syncStatus !== 'revisado') return false;
      if (!q) return true;
      return (
        (log.leadName || '').toLowerCase().includes(q) ||
        (log.leadEmail || '').toLowerCase().includes(q) ||
        log.subcategoriaRecomendada.toLowerCase().includes(q) ||
        log.ruleVersion.toLowerCase().includes(q) ||
        log.regrasAcionadas.some((r) => r.toLowerCase().includes(q)) ||
        (log.motivoModoLocal || '').toLowerCase().includes(q)
      );
    });
  }, [allLogs, filterStatus, search]);

  const handleForceSync = async () => {
    setLocalFeedback(null);
    const summary = await forceSyncOfflineData();
    await onRefreshWorkspace();
    setLocalFeedback(summary.message);
  };

  const handleMarkReviewed = async (log: RuleEngineDecisionLog) => {
    setSavingReviewId(log.id);
    setLocalFeedback(null);
    try {
      const reviewerLabel = userProfile.nome || userProfile.email || 'Consultor';
      const notes = reviewNotesDraft[log.id] || '';
      const updatedLocal = markRuleEngineDecisionReviewed(log.id, reviewerLabel, notes);
      const targetLog: RuleEngineDecisionLog = updatedLocal || {
        ...log,
        syncStatus: 'revisado',
        reviewedBy: reviewerLabel,
        reviewedAt: new Date().toISOString(),
        reviewNotes: notes.trim() || log.reviewNotes,
      };

      if (isOnline) {
        try {
          await syncRuleEngineDecisionLogToFirestore(targetLog, role);
          markRuleEngineDecisionSynced(log.id);
          await onRefreshWorkspace();
          setLocalFeedback('Decisão marcada como revisada e sincronizada na nuvem.');
        } catch {
          setLocalFeedback('Revisão salva localmente. Ela será enviada à nuvem na próxima sincronização.');
        }
      } else {
        setLocalFeedback('Revisão salva localmente (modo offline). Sincronize quando a rede retornar.');
      }
    } finally {
      setSavingReviewId(null);
    }
  };

  const handleExportCsv = () => {
    exportToCSV(
      `logs-motor-regras-${new Date().toISOString().slice(0, 10)}`,
      [
        'Data',
        'Modo',
        'Origem',
        'Lead',
        'Email',
        'Versão Regras',
        'Subcategoria',
        'Nota Viabilidade',
        'Confiança',
        'Status Revisão',
        'Regras Acionadas',
        'Flags Risco',
        'Motivo Local',
        'Revisado Por',
        'Notas Revisão',
      ],
      filteredLogs.map((l) => [
        l.createdAt,
        l.mode,
        ORIGIN_LABELS[l.origin] || l.origin,
        l.leadName || '',
        l.leadEmail || '',
        l.ruleVersion,
        l.subcategoriaRecomendada,
        l.notaViabilidade ?? '',
        l.confianca || '',
        l.syncStatus,
        l.regrasAcionadas.join(' | '),
        l.flagsRisco.join(' | '),
        l.motivoModoLocal || '',
        l.reviewedBy || '',
        l.reviewNotes || '',
      ]),
    );
  };

  const surfaceCls = isDark
    ? 'bg-slate-900/90 border-slate-800 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';
  const mutedCls = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="space-y-4" data-testid="offline-decision-logs-panel">
      {/* Cabeçalho e resumo de persistência local */}
      <div className={`rounded-xl border p-4 sm:p-5 ${surfaceCls}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold">Log Interno do Motor de Regras & Revisão Offline</h3>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isOnline && catalogSource === 'cloud'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800'
                }`}
              >
                {isOnline && catalogSource === 'cloud' ? (
                  <>
                    <Cloud className="w-3 h-3" /> Nuvem ativa
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3 h-3" /> Modo local ativo
                  </>
                )}
              </span>
            </div>
            <p className={`text-xs leading-relaxed ${mutedCls}`}>
              Cada decisão do motor de regras em modo offline ou fallback local é gravada em IndexedDB + LocalStorage
              para auditoria da equipe de consultoria e sincronização posterior com o Firestore.
              {lastRulesSyncAt ? ` Última sincronização do catálogo: ${formatDateBR(lastRulesSyncAt)}.` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredLogs.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${
                isDark
                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
            <button
              type="button"
              disabled={syncingOffline}
              onClick={() => void handleForceSync()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-[#0B1F33] hover:bg-[#143252] transition-colors disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
              {syncingOffline ? 'Sincronizando...' : 'Forçar sincronização'}
            </button>
          </div>
        </div>

        {/* Métricas rápidas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className={`rounded-lg border p-3 ${isDark ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <p className={`text-[11px] font-medium ${mutedCls}`}>Decisões registradas</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{counts.total}</p>
          </div>
          <div className={`rounded-lg border p-3 ${isDark ? 'bg-amber-950/30 border-amber-800/50' : 'bg-amber-50 border-amber-200'}`}>
            <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">Pendentes de revisão</p>
            <p className="text-xl font-bold tabular-nums mt-0.5 text-amber-950 dark:text-amber-100">{counts.pendentesRevisao}</p>
          </div>
          <div className={`rounded-lg border p-3 ${isDark ? 'bg-sky-950/30 border-sky-800/50' : 'bg-sky-50 border-sky-200'}`}>
            <p className="text-[11px] font-medium text-sky-800 dark:text-sky-300">Aguardando nuvem</p>
            <p className="text-xl font-bold tabular-nums mt-0.5 text-sky-950 dark:text-sky-100">
              {counts.aguardandoNuvem + pendingLeadsCount}
            </p>
          </div>
          <div className={`rounded-lg border p-3 ${isDark ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-emerald-50 border-emerald-200'}`}>
            <p className="text-[11px] font-medium text-emerald-800 dark:text-emerald-300">Revisados pela equipe</p>
            <p className="text-xl font-bold tabular-nums mt-0.5 text-emerald-950 dark:text-emerald-100">{counts.revisados}</p>
          </div>
        </div>

        {(localFeedback || lastSyncFeedback) && (
          <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-800 px-3 py-2 text-xs text-sky-900 dark:text-sky-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
            <span>{localFeedback || lastSyncFeedback}</span>
          </div>
        )}
      </div>

      {/* Filtros e busca */}
      <div className={`rounded-xl border p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 ${surfaceCls}`}>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'todos', label: `Todos (${counts.total})` },
            { id: 'pendentes_revisao', label: `Pendentes de revisão (${counts.pendentesRevisao})` },
            { id: 'aguardando_nuvem', label: `Aguardando nuvem (${counts.aguardandoNuvem})` },
            { id: 'revisados', label: `Revisados (${counts.revisados})` },
          ].map((tab) => {
            const active = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id as typeof filterStatus)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#0B1F33] text-white'
                    : isDark
                      ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por lead, visto ou regra..."
            className={`w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs ${
              isDark
                ? 'bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500'
                : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
            }`}
          />
        </div>
      </div>

      {/* Lista de decisões */}
      {filteredLogs.length === 0 ? (
        <div className={`rounded-xl border p-8 text-center ${surfaceCls}`}>
          <FileCheck2 className="w-8 h-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm font-semibold">Nenhuma decisão encontrada para este filtro</p>
          <p className={`text-xs mt-1 ${mutedCls}`}>
            Quando um diagnóstico for executado em modo offline ou fallback de regras locais, o registro detalhado
            aparecerá automaticamente aqui para revisão da equipe.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredLogs.map((log) => {
            const expanded = expandedId === log.id;
            const modeMeta = MODE_BADGE[log.mode] || MODE_BADGE.offline;
            return (
              <div key={log.id} className={`rounded-xl border transition-colors ${surfaceCls}`}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : log.id)}
                  className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-semibold ${modeMeta.cls}`}>
                        {modeMeta.label}
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {ORIGIN_LABELS[log.origin] || log.origin}
                      </span>
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                          log.syncStatus === 'revisado'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200'
                            : log.syncStatus === 'sincronizado'
                              ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-200'
                              : 'bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200'
                        }`}
                      >
                        {log.syncStatus === 'revisado'
                          ? 'Revisado'
                          : log.syncStatus === 'sincronizado'
                            ? 'Sincronizado (aguarda revisão)'
                            : 'Local (pendente de sync)'}
                      </span>
                    </div>
                    <p className="text-sm font-bold truncate">
                      {log.subcategoriaRecomendada}
                      {log.leadName ? ` · ${log.leadName}` : ''}
                    </p>
                    <p className={`text-xs ${mutedCls}`}>
                      {formatDateBR(log.createdAt)} · Motor v{log.ruleVersion}
                      {typeof log.notaViabilidade === 'number' ? ` · Nota ${log.notaViabilidade}/100` : ''}
                      {log.confianca ? ` · Confiança ${log.confianca}` : ''}
                      {log.leadEmail ? ` · ${log.leadEmail}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-xs font-semibold text-slate-500">
                    <span>{log.regrasAcionadas.length} regra(s)</span>
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {expanded && (
                  <div className={`px-4 pb-4 pt-3 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                    {log.motivoModoLocal && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-2.5 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold">Motivo da execução local:</span> {log.motivoModoLocal}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className={`rounded-lg border p-3 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <p className="text-xs font-bold mb-1.5">Regras determinísticas acionadas</p>
                        {log.regrasAcionadas.length === 0 ? (
                          <p className={`text-xs ${mutedCls}`}>Nenhuma regra detalhada registrada.</p>
                        ) : (
                          <ul className="space-y-1 text-xs list-disc pl-4">
                            {log.regrasAcionadas.map((regra, idx) => (
                              <li key={idx} className="leading-relaxed">
                                {regra}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className={`rounded-lg border p-3 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <p className="text-xs font-bold mb-1.5">Flags de risco / atenção</p>
                          {log.flagsRisco.length === 0 ? (
                            <p className={`text-xs ${mutedCls}`}>Sem alertas críticos registrados.</p>
                          ) : (
                            <ul className="space-y-1 text-xs list-disc pl-4">
                              {log.flagsRisco.map((flag, idx) => (
                                <li key={idx}>{flag}</li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className={`rounded-lg border p-3 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                          <p className="text-xs font-bold mb-1.5">Base legal referenciada</p>
                          <p className={`text-xs ${mutedCls}`}>
                            {log.fontesLegaisCitadas.length > 0 ? log.fontesLegaisCitadas.join(' · ') : 'fonte a cadastrar'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Área de revisão humana pela equipe */}
                    {log.syncStatus === 'revisado' ? (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-800 p-3 text-xs text-emerald-950 dark:text-emerald-100">
                        <p className="font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Revisado por {log.reviewedBy || 'Consultoria'}
                          {log.reviewedAt ? ` em ${formatDateBR(log.reviewedAt)}` : ''}
                        </p>
                        {log.reviewNotes && <p className="mt-1 opacity-90">{log.reviewNotes}</p>}
                      </div>
                    ) : (
                      <div className={`rounded-lg border p-3 space-y-2 ${isDark ? 'bg-slate-950/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <label className="block text-xs font-semibold">
                          Observação da revisão técnica (opcional)
                        </label>
                        <textarea
                          rows={2}
                          value={reviewNotesDraft[log.id] || ''}
                          onChange={(e) =>
                            setReviewNotesDraft((prev) => ({
                              ...prev,
                              [log.id]: e.target.value,
                            }))
                          }
                          placeholder="Ex.: Enquadramento Mercosul validado após retorno da conexão; lead contatado via WhatsApp."
                          className={`w-full rounded-lg border p-2 text-xs ${
                            isDark
                              ? 'bg-slate-900 border-slate-700 text-slate-100'
                              : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        />
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={savingReviewId === log.id}
                            onClick={() => void handleMarkReviewed(log)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors disabled:opacity-60"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {savingReviewId === log.id ? 'Salvando revisão...' : 'Marcar diagnóstico como revisado'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
