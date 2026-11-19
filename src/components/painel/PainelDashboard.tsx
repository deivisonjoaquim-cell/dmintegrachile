import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CheckSquare,
  FileWarning,
  MessageCircle,
  Scale,
} from 'lucide-react';
import type {
  Appointment,
  Case,
  CaseDocument,
  Client,
  CommunicationLog,
  Deadline,
  Dependent,
  EmpresaConfig,
  FinancialRecord,
  Lead,
  LegalSource,
  Task,
  UserRole,
  VisaRequirement,
} from '../../types/domain';
import { calcularTermometroDocumentos, calcularUrgencias } from '../../utils/caseMetrics';
import { countUnreadChatForStaff, getPendingClientChatThreads } from '../../utils/documentChat';
import { buildWhatsAppUrl, formatCurrency, formatDateBR, formatDateTimeBR, toIsoDate } from '../../utils/formatters';
import { computeUnifiedFunnelMetrics, type MacroFunnelStageId } from '../../utils/funnelModel';
import type { FunnelPerformancePeriod } from '../../utils/funnelPerformanceModel';
import { countLegalReviewPending } from '../../utils/legalSync';
import { computeDailyPrioritySummary, type LegacyPanelSection } from '../../utils/panelNavigation';
import { PainelFunnelPerformanceSummary } from './PainelFunnelPerformanceSummary';
import { PainelLembretesVencimento } from './PainelLembretesVencimento';
import { PainelProgressoTarefasChart } from './PainelProgressoTarefasChart';

interface PainelDashboardProps {
  role: UserRole;
  empresa: EmpresaConfig;
  isDark?: boolean;
  leads: Lead[];
  clients: Client[];
  dependents?: Dependent[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines: Deadline[];
  tasks?: Task[];
  appointments?: Appointment[];
  financialRecords: FinancialRecord[];
  communicationLogs?: CommunicationLog[];
  legalSources?: LegalSource[];
  visaRequirements?: VisaRequirement[];
  diasAlertaRevisaoLegal?: number;
  brandName?: string;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
  onEmailLogsCreated?: (logs: CommunicationLog[]) => void;
  onOpenCase: (caseId: string, targetTab?: 'resumo' | 'comunicacao') => void;
  onOpenChecklist?: (caseId?: string) => void;
  onOpenFunnelStage?: (stageId: MacroFunnelStageId) => void;
  onToggleTask?: (task: Task) => Promise<void>;
  onNavigateSection?: (section: LegacyPanelSection) => void;
}

type DailyWorkTab = 'hoje' | 'documentos' | 'chat' | 'relatorio';

export const PainelDashboard: React.FC<PainelDashboardProps> = ({
  role,
  empresa,
  isDark = false,
  leads,
  clients,
  dependents = [],
  cases,
  docs,
  deadlines,
  tasks = [],
  appointments = [],
  financialRecords,
  communicationLogs = [],
  legalSources = [],
  visaRequirements = [],
  diasAlertaRevisaoLegal = 90,
  brandName,
  onLogWhatsApp,
  onEmailLogsCreated,
  onOpenCase,
  onOpenChecklist,
  onOpenFunnelStage,
  onToggleTask,
  onNavigateSection,
}) => {
  const [workTab, setWorkTab] = useState<DailyWorkTab>('hoje');
  const [filterOrigem, setFilterOrigem] = useState('Todas');
  const [perfPeriod, setPerfPeriod] = useState<FunnelPerformancePeriod>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'todas' | 'Critica' | 'Alta' | 'Media'>('todas');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const isAssistente = role === 'assistente';

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const filteredLeads = useMemo(
    () => (filterOrigem === 'Todas' ? leads : leads.filter((l) => l.origem === filterOrigem)),
    [leads, filterOrigem],
  );

  const activeClients = useMemo(() => clients.filter((c) => !c.arquivado), [clients]);
  const activeCases = useMemo(() => cases.filter((c) => !c.arquivado), [cases]);

  const urgencias = useMemo(
    () =>
      calcularUrgencias({
        cases,
        clients,
        docs,
        deadlines,
        financialRecords: isAssistente ? [] : financialRecords,
        role,
      }),
    [cases, clients, docs, deadlines, financialRecords, role, isAssistente],
  );

  const filteredUrgencias = useMemo(
    () => (urgencyFilter === 'todas' ? urgencias : urgencias.filter((u) => u.severidade === urgencyFilter)),
    [urgencias, urgencyFilter],
  );

  const dailySummary = useMemo(
    () =>
      computeDailyPrioritySummary({
        role,
        leads: filteredLeads,
        clients,
        cases,
        docs,
        deadlines,
        tasks,
        appointments,
        financialRecords,
        communicationLogs,
        todayIso,
      }),
    [role, filteredLeads, clients, cases, docs, deadlines, tasks, appointments, financialRecords, communicationLogs, todayIso],
  );

  const unifiedFunnel = useMemo(
    () => computeUnifiedFunnelMetrics(filteredLeads, activeCases),
    [filteredLeads, activeCases],
  );

  const avgThermometer = useMemo(() => {
    if (activeCases.length === 0) return 0;
    const scores = activeCases.map((c) => {
      const cDocs = docs.filter((d) => d.caseId === c.id);
      return calcularTermometroDocumentos(cDocs).notaGeral;
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [activeCases, docs]);

  const receitaTotalBrl = useMemo(() => {
    if (isAssistente) return 0;
    return financialRecords.filter((f) => f.status === 'Pago' && f.moeda === 'BRL').reduce((a, b) => a + b.valor, 0);
  }, [financialRecords, isAssistente]);

  const inadimplenciaBrl = useMemo(() => {
    if (isAssistente) return 0;
    return financialRecords.filter((f) => f.status === 'Atrasado' && f.moeda === 'BRL').reduce((a, b) => a + b.valor, 0);
  }, [financialRecords, isAssistente]);

  const pendingTasksToday = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'Concluída')
        .sort((a, b) => (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31'))
        .slice(0, 8),
    [tasks],
  );

  const appointmentsToday = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== 'Cancelado' && (a.dataHoraInicio || '').startsWith(todayIso))
        .sort((a, b) => a.dataHoraInicio.localeCompare(b.dataHoraInicio)),
    [appointments, todayIso],
  );

  const pendingDocsReview = useMemo(
    () => docs.filter((d) => d.status === 'Enviado' || d.status === 'Em análise'),
    [docs],
  );

  const topReprovados = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of docs) {
      if (d.status === 'Reprovado') {
        counts.set(d.nomeDocumento, (counts.get(d.nomeDocumento) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [docs]);

  const chatThreads = useMemo(
    () => getPendingClientChatThreads(communicationLogs, clients, cases),
    [communicationLogs, clients, cases],
  );
  const unreadChatTotal = useMemo(() => countUnreadChatForStaff(communicationLogs), [communicationLogs]);

  const legalPending = useMemo(
    () => countLegalReviewPending(legalSources, diasAlertaRevisaoLegal),
    [legalSources, diasAlertaRevisaoLegal],
  );

  const handleNotifyUrgency = async (u: (typeof urgencias)[number]) => {
    const text = `Olá${u.clientNome ? `, ${u.clientNome}` : ''}! Alerta operacional D&M Integra Chile: ${u.titulo} — ${u.detalhe} (Data ref.: ${u.dataReferenciaBR}).`;
    if (u.clientWhatsapp) {
      window.open(buildWhatsAppUrl(u.clientWhatsapp, text), '_blank', 'noopener,noreferrer');
    }
    await onLogWhatsApp(u.clientId, u.caseId, `Alerta WhatsApp: ${u.categoria}`, text);
  };

  const handleQuickToggleTask = async (task: Task) => {
    if (!onToggleTask || busyTaskId) return;
    setBusyTaskId(task.id);
    try {
      await onToggleTask(task);
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleRecommendedClick = () => {
    const action = dailySummary.recommendedAction;
    if (action.target === 'hoje') {
      if (dailySummary.criticalUrgenciesCount > 0) {
        setWorkTab('hoje');
        setUrgencyFilter('Critica');
      } else if (dailySummary.unreadChatsCount > 0) {
        setWorkTab('chat');
      }
      return;
    }
    onNavigateSection?.(action.target);
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho direto com foco imediato do dia */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Central do Dia
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {dailySummary.recommendedAction.label} — {dailySummary.recommendedAction.detail}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={filterOrigem}
            onChange={(e) => setFilterOrigem(e.target.value)}
            aria-label="Filtrar métricas por origem de leads"
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="Todas">Origem: Todas</option>
            <option value="Site">Site</option>
            <option value="Instagram">Instagram</option>
            <option value="Indicação">Indicação</option>
            <option value="Parceiro">Parceiro</option>
            <option value="Outro">Outro</option>
          </select>

          <button
            type="button"
            onClick={handleRecommendedClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-95"
            style={{
              backgroundColor:
                dailySummary.recommendedAction.tone === 'critical'
                  ? '#C82333'
                  : 'var(--color-primary)',
            }}
          >
            <span>Iniciar prioridade</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Aviso normativo discreto apenas quando houver normas pendentes */}
      {!isAssistente && legalPending.totalAttention > 0 && onNavigateSection && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/70 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-amber-950 dark:text-amber-200">
            <Scale className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>
              <strong className="font-semibold">{legalPending.totalAttention} norma(s)</strong> SERMIG/BCN precisam de conferência de vigência.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection('legal')}
            className="text-xs font-semibold text-amber-900 dark:text-amber-200 hover:underline whitespace-nowrap shrink-0"
          >
            Revisar Base Legal →
          </button>
        </div>
      )}

      {/* 4 Indicadores Principais (Superfície plana, 1px hairline, tabular-nums) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => onNavigateSection?.('casos')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Processos ativos</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {activeCases.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {activeClients.length} clientes · Docs {avgThermometer}%
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setWorkTab('hoje');
            setUrgencyFilter('todas');
          }}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Urgências</p>
          <p
            className="text-2xl font-bold mt-1 tabular-nums"
            style={{ color: urgencias.length > 0 ? '#C82333' : '#1E7E34' }}
          >
            {urgencias.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {dailySummary.criticalUrgenciesCount} crítica(s) · {dailySummary.openTasksCount} tarefa(s)
          </p>
        </button>

        <button
          type="button"
          onClick={() => setWorkTab('documentos')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
        >
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Docs para conferir</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
            {pendingDocsReview.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
            {dailySummary.newLeadsCount} lead(s) novo(s) · {unreadChatTotal} chat(s)
          </p>
        </button>

        {!isAssistente ? (
          <button
            type="button"
            onClick={() => onNavigateSection?.('financeiro')}
            className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Recebido (BRL)</p>
            <p className="text-xl font-bold text-[#1E7E34] mt-1 tabular-nums">
              {formatCurrency(receitaTotalBrl, 'BRL')}
            </p>
            <p className="text-xs text-[#C82333] mt-1 tabular-nums">
              Em atraso: {formatCurrency(inadimplenciaBrl, 'BRL')}
            </p>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigateSection?.('agenda')}
            className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
          >
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Agenda de hoje</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">
              {appointmentsToday.length}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 tabular-nums">
              {dailySummary.openTasksCount} tarefa(s) em aberto
            </p>
          </button>
        )}
      </div>

      {/* Resumo de Desempenho: Taxas de Conversão entre Etapas & Gargalos */}
      <PainelFunnelPerformanceSummary
        leads={filteredLeads}
        cases={activeCases}
        period={perfPeriod}
        onChangePeriod={setPerfPeriod}
        onSelectStage={(stageId) => {
          if (onOpenFunnelStage) {
            onOpenFunnelStage(stageId);
          } else {
            onNavigateSection?.('funil');
          }
        }}
        onOpenKanban={onNavigateSection ? () => onNavigateSection('funil') : undefined}
      />

      {/* Funil Interativo em 5 Marcos: clique em qualquer marco para ir direto aos registros */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Fluxo Operacional em 5 Marcos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clique em uma etapa para abrir diretamente os leads ou processos naquele momento
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-slate-600 dark:text-slate-300">
            <span>
              Conversão: <strong className="text-slate-900 dark:text-slate-100">{unifiedFunnel.commercialConversionPct}%</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Conclusão: <strong className="text-[#1E7E34]">{unifiedFunnel.completionRatePct}%</strong>
            </span>
            {onNavigateSection && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onNavigateSection('funil')}
                  className="font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline whitespace-nowrap"
                >
                  Abrir Quadro Kanban →
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {unifiedFunnel.stages.map((item) => {
            const isBottleneck =
              unifiedFunnel.bottleneckStage?.id === item.stage.id && item.totalCount > 0;
            const handleStageClick = () => {
              if (onOpenFunnelStage) {
                onOpenFunnelStage(item.stage.id);
              } else if (item.stage.id === 'diagnostico' || item.stage.id === 'proposta') {
                onNavigateSection?.('leads');
              } else {
                onNavigateSection?.('casos');
              }
            };

            return (
              <button
                key={item.stage.id}
                type="button"
                onClick={handleStageClick}
                className="text-left p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 transition-colors space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                    {item.stage.ordem}. {item.stage.nome}
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                    {item.totalCount}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${
                        unifiedFunnel.totalActive > 0
                          ? Math.max(item.totalCount > 0 ? 12 : 0, Math.round((item.totalCount / unifiedFunnel.totalActive) * 100))
                          : 0
                      }%`,
                      backgroundColor: item.stage.corHex,
                    }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                  {isBottleneck
                    ? 'Maior volume atual'
                    : item.conversionFromPrevPct !== null
                      ? `${item.conversionFromPrevPct}% avanço da anterior`
                      : `${item.leadsCount} lead(s) ativos`}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Fila de Trabalho Unificada em 4 Abas Práticas */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div
          role="tablist"
          aria-label="Fila de trabalho diária"
          className="flex items-center gap-1 overflow-x-auto px-4 pt-3 border-b border-slate-200 dark:border-slate-800"
        >
          {(
            [
              { id: 'hoje', label: 'Atenção Hoje', count: urgencias.length + dailySummary.openTasksCount },
              { id: 'documentos', label: 'Docs & Vencimentos', count: pendingDocsReview.length },
              { id: 'chat', label: 'Dúvidas do Portal', count: unreadChatTotal },
              { id: 'relatorio', label: 'Progresso & PDF', count: undefined },
            ] as const
          ).map((tab) => {
            const active = workTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setWorkTab(tab.id)}
                className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                  active
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] dark:text-sky-400 dark:border-sky-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 ? ` (${tab.count})` : ''}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {/* ABA 1: ATENÇÃO HOJE (Urgências + Tarefas & Agenda) */}
          {workTab === 'hoje' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-[#C82333]" />
                    Urgências e Prazos Críticos ({filteredUrgencias.length})
                  </h3>
                  <div className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-semibold">
                    {(
                      [
                        { id: 'todas', label: `Todas (${urgencias.length})` },
                        { id: 'Critica', label: `Críticas (${urgencias.filter((u) => u.severidade === 'Critica').length})` },
                        { id: 'Alta', label: `Altas (${urgencias.filter((u) => u.severidade === 'Alta').length})` },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setUrgencyFilter(opt.id)}
                        className={`px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums ${
                          urgencyFilter === opt.id
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredUrgencias.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                    Nenhuma urgência pendente nesta severidade.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredUrgencias.map((u) => (
                      <div key={u.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p
                            className="text-[11px] font-semibold tabular-nums"
                            style={{ color: u.severidade === 'Critica' ? '#C82333' : '#B45309' }}
                          >
                            {u.categoria} · {u.severidade} · Ref.: {u.dataReferenciaBR}
                          </p>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{u.titulo}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {u.clientNome ? `${u.clientNome} — ` : ''}
                            {u.detalhe}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {u.caseId && (
                            <button
                              type="button"
                              onClick={() => onOpenCase(u.caseId!)}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                            >
                              Abrir Caso
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleNotifyUrgency(u)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34] hover:opacity-95 whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-5 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <CheckSquare className="w-4 h-4 text-[var(--color-primary)]" />
                      Próximas Tarefas ({dailySummary.openTasksCount})
                    </h3>
                    <button
                      type="button"
                      onClick={() => onNavigateSection?.('agenda')}
                      className="text-xs font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline whitespace-nowrap"
                    >
                      Abrir Agenda
                    </button>
                  </div>
                  {pendingTasksToday.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma tarefa em aberto.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {pendingTasksToday.map((t) => (
                        <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {onToggleTask && (
                              <button
                                type="button"
                                disabled={busyTaskId === t.id}
                                onClick={() => void handleQuickToggleTask(t)}
                                aria-label={`Concluir tarefa ${t.titulo}`}
                                title="Marcar como concluída"
                                className="mt-0.5 text-slate-400 hover:text-[#1E7E34] shrink-0 disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{t.titulo}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                                {t.prioridade}
                                {t.prazo ? ` · Até ${formatDateBR(t.prazo)}` : ''}
                              </p>
                            </div>
                          </div>
                          {t.caseId && (
                            <button
                              type="button"
                              onClick={() => onOpenCase(t.caseId!)}
                              className="text-[11px] font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline shrink-0"
                            >
                              Caso
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
                    Reuniões Hoje ({appointmentsToday.length})
                  </h3>
                  {appointmentsToday.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Sem reuniões agendadas para {formatDateBR(todayIso)}.
                    </p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {appointmentsToday.map((a) => (
                        <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{a.titulo}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {a.dataHoraInicio.slice(11, 16) || formatDateBR(a.dataHoraInicio)} · {a.tipo}
                            </p>
                          </div>
                          {a.caseId && (
                            <button
                              type="button"
                              onClick={() => onOpenCase(a.caseId!)}
                              className="text-[11px] font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline shrink-0"
                            >
                              Abrir
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: DOCS PARA CONFERIR + VENCIMENTOS < 30 DIAS */}
          {workTab === 'documentos' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-amber-700" />
                      Documentos Enviados Aguardando Conferência ({pendingDocsReview.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => onNavigateSection?.('checklist')}
                      className="text-xs font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline whitespace-nowrap"
                    >
                      Ir para Checklist →
                    </button>
                  </div>
                  {pendingDocsReview.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                      Nenhum documento enviado aguardando triagem agora.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {pendingDocsReview.slice(0, 12).map((d) => (
                        <div key={d.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{d.nomeDocumento}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {d.pessoa} · {d.status}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenCase(d.caseId)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
                          >
                            Conferir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Reprovações Frequentes
                  </h3>
                  {topReprovados.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma reprovação registrada.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {topReprovados.map(([nome, qtd]) => (
                        <li key={nome} className="py-2 flex items-center justify-between gap-2">
                          <span className="text-slate-700 dark:text-slate-300 truncate">{nome}</span>
                          <span className="font-bold tabular-nums text-[#C82333] shrink-0">{qtd}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <PainelLembretesVencimento
                  docs={docs}
                  cases={cases}
                  clients={clients}
                  dependents={dependents}
                  visaRequirements={visaRequirements}
                  communicationLogs={communicationLogs}
                  brandName={brandName}
                  onOpenCase={(id) => onOpenCase(id)}
                  onOpenChecklist={(caseId) => {
                    if (onOpenChecklist) onOpenChecklist(caseId);
                    else onNavigateSection?.('checklist');
                  }}
                  onLogWhatsApp={onLogWhatsApp}
                  onEmailLogsCreated={onEmailLogsCreated}
                />
              </div>
            </div>
          )}

          {/* ABA 3: DÚVIDAS DO PORTAL (CHAT) */}
          {workTab === 'chat' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Conversas do Portal do Cliente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Mensagens enviadas pelos clientes integradas ao histórico de cada processo
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300">
                  {unreadChatTotal > 0 ? `${unreadChatTotal} não lida(s)` : `${chatThreads.length} conversa(s)`}
                </span>
              </div>

              {chatThreads.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                  Nenhuma dúvida de documento enviada no chat do portal até o momento.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {chatThreads.map((thread) => (
                    <div
                      key={thread.clientId}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">{thread.clientName}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 dark:text-slate-300 truncate">{thread.caseTitle}</span>
                          <span
                            className={`font-semibold tabular-nums ${
                              thread.unreadCount > 0
                                ? 'text-[#C82333]'
                                : thread.awaitingReply
                                  ? 'text-amber-700'
                                  : 'text-[#1E7E34]'
                            }`}
                          >
                            {thread.unreadCount > 0
                              ? `· ${thread.unreadCount} nova(s)`
                              : thread.awaitingReply
                                ? '· Aguardando resposta'
                                : '· Respondido'}
                          </span>
                        </div>
                        {thread.lastMessage.documentNome && (
                          <p className="text-[11px] font-semibold text-[var(--color-primary)] dark:text-sky-400">
                            Doc: {thread.lastMessage.documentNome}
                          </p>
                        )}
                        <p className="text-slate-700 dark:text-slate-300 line-clamp-2">{thread.lastMessage.mensagem}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {formatDateTimeBR(thread.lastMessage.createdAt)}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {thread.caseId ? (
                          <button
                            type="button"
                            onClick={() => onOpenCase(thread.caseId, 'comunicacao')}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                            style={{ backgroundColor: 'var(--color-primary)' }}
                          >
                            Responder no Caso
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onNavigateSection?.('clientes')}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                          >
                            Abrir Cliente
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 4: PROGRESSO DE TAREFAS & EXPORTAÇÃO PDF VISUAL */}
          {workTab === 'relatorio' && (
            <PainelProgressoTarefasChart
              empresa={empresa}
              tasks={tasks}
              cases={cases}
              clients={clients}
              docs={docs}
              selectedCaseId={null}
              isDark={isDark}
              onOpenAgenda={() => onNavigateSection?.('agenda')}
              onOpenCase={onOpenCase}
            />
          )}
        </div>
      </section>
    </div>
  );
};
