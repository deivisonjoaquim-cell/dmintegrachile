import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ExternalLink,
  ListChecks,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react';
import { deleteCaseDocumentAudited, makeId, saveDocumentAudited } from '../../services/firestoreService';
import { notifyClientProcessUpdate } from '../../services/notificationService';
import { ConfirmActionModal } from '../ui/DesignSystem';
import type {
  Case,
  CaseDocument,
  Client,
  Dependent,
  EmpresaConfig,
  UserProfile,
  UserRole,
  VisaCategory,
  VisaRequirement,
} from '../../types/domain';
import { calcularTermometroDocumentos } from '../../utils/caseMetrics';
import {
  computeCalculatedExpirationIso,
  resolveDocumentExpiration,
  type DocumentExpirationEvaluation,
} from '../../utils/documentExpiration';
import { formatDateBR } from '../../utils/formatters';
import {
  buildCaseDocumentFromChecklistToggle,
  buildVisaChecklistEntries,
  summarizeChecklist,
  type ChecklistRowEntry,
} from '../../utils/visaChecklist';

interface PainelChecklistVistoProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  clients: Client[];
  dependents: Dependent[];
  cases: Case[];
  docs: CaseDocument[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  selectedCaseId: string | null;
  onSelectCase: (id: string | null) => void;
  onRefresh: () => Promise<void>;
  onOpenCase: (caseId: string) => void;
  onNavigateSection?: (section: 'casos' | 'legal') => void;
}

const STATUS_OPTIONS: CaseDocument['status'][] = [
  'Pendente',
  'Enviado',
  'Em análise',
  'Aprovado',
  'Reprovado',
  'Vencido',
];

export const PainelChecklistVisto: React.FC<PainelChecklistVistoProps> = ({
  role,
  userProfile,
  empresa,
  clients,
  dependents,
  cases,
  docs,
  visaCategories,
  visaRequirements,
  selectedCaseId,
  onSelectCase,
  onRefresh,
  onOpenCase,
  onNavigateSection,
}) => {
  const activeCases = useMemo(() => cases.filter((c) => !c.arquivado), [cases]);
  const availableVisas = useMemo(
    () => (visaCategories.some((v) => v.ativo) ? visaCategories.filter((v) => v.ativo) : visaCategories),
    [visaCategories],
  );
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const [localCaseId, setLocalCaseId] = useState<string>(() => {
    if (selectedCaseId && activeCases.some((c) => c.id === selectedCaseId)) {
      return selectedCaseId;
    }
    return activeCases[0]?.id || '';
  });

  useEffect(() => {
    if (selectedCaseId && activeCases.some((c) => c.id === selectedCaseId)) {
      setLocalCaseId(selectedCaseId);
    }
  }, [selectedCaseId, activeCases]);

  const activeCase = useMemo(
    () => activeCases.find((c) => c.id === localCaseId) || null,
    [activeCases, localCaseId],
  );

  const [selectedVisaId, setSelectedVisaId] = useState<string>(
    () => activeCase?.visaCategoryId || availableVisas[0]?.id || 'visa_15_mercosul',
  );

  useEffect(() => {
    if (activeCase) {
      setSelectedVisaId(activeCase.visaCategoryId || availableVisas[0]?.id || 'visa_15_mercosul');
    } else if (!availableVisas.some((v) => v.id === selectedVisaId)) {
      setSelectedVisaId(availableVisas[0]?.id || 'visa_15_mercosul');
    }
  }, [activeCase, availableVisas]);

  const [selectedPessoa, setSelectedPessoa] = useState<string>('Titular');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'pendentes' | 'concluidos' | 'vencendo'>('todos');
  const [priorityFilter, setPriorityFilter] = useState<'todos' | 'obrigatorios' | 'opcionais'>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);
  const [linkingVisaBusy, setLinkingVisaBusy] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewStatusMap, setPreviewStatusMap] = useState<Record<string, boolean>>({});
  const [deleteTargetDoc, setDeleteTargetDoc] = useState<CaseDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = useState(false);

  const canDeleteChecklistDoc = role === 'admin' || role === 'consultor';

  const handleConfirmDeleteDoc = async () => {
    if (!deleteTargetDoc || !canDeleteChecklistDoc) return;
    setDeletingDoc(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await deleteCaseDocumentAudited(deleteTargetDoc, role);
      setDeleteTargetDoc(null);
      setFeedback(`Documento "${deleteTargetDoc.nomeDocumento}" excluído do dossiê com auditoria.`);
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível excluir o documento do checklist.');
    } finally {
      setDeletingDoc(false);
    }
  };

  const caseDependents = useMemo(() => {
    if (!activeCase) return [];
    return dependents.filter((d) => d.clientId === activeCase.clientId);
  }, [activeCase, dependents]);

  const pessoaOptions = useMemo(
    () => ['Titular', ...caseDependents.map((d) => d.nomeCompleto)],
    [caseDependents],
  );

  useEffect(() => {
    if (!pessoaOptions.includes(selectedPessoa)) {
      setSelectedPessoa('Titular');
    }
  }, [pessoaOptions, selectedPessoa]);

  const selectedVisa = useMemo(
    () =>
      visaCategories.find((v) => v.id === selectedVisaId) ||
      availableVisas[0] ||
      null,
    [visaCategories, availableVisas, selectedVisaId],
  );

  const activeCaseVisaId = activeCase?.visaCategoryId || availableVisas[0]?.id || 'visa_15_mercosul';
  const canPersistToCase = Boolean(activeCase) && selectedVisaId === activeCaseVisaId;

  const caseDocs = useMemo(
    () => (activeCase ? docs.filter((d) => d.caseId === activeCase.id) : []),
    [activeCase, docs],
  );

  const rawEntries = useMemo(
    () =>
      buildVisaChecklistEntries({
        visaCategoryId: selectedVisaId,
        pessoa: selectedPessoa,
        visaRequirements,
        caseDocuments: canPersistToCase ? caseDocs : [],
        includeExtraCaseDocs: canPersistToCase,
      }),
    [selectedVisaId, selectedPessoa, visaRequirements, canPersistToCase, caseDocs],
  );

  const entries = useMemo(() => {
    if (canPersistToCase) return rawEntries;
    return rawEntries.map((entry) => {
      const previewKey = `${selectedVisaId}:${selectedPessoa}:${entry.key}`;
      const isDone = Boolean(previewStatusMap[previewKey]);
      return {
        ...entry,
        status: (isDone ? 'Aprovado' : 'Pendente') as CaseDocument['status'],
        completed: isDone,
      };
    });
  }, [canPersistToCase, rawEntries, previewStatusMap, selectedVisaId, selectedPessoa]);

  const activeClient = activeCase ? clientMap.get(activeCase.clientId) : undefined;

  const expirationByKey = useMemo(() => {
    const map = new Map<string, DocumentExpirationEvaluation>();
    for (const entry of entries) {
      const syntheticDoc: CaseDocument = entry.document ?? {
        id: entry.key,
        caseId: activeCase?.id || '',
        clientId: activeCase?.clientId || '',
        pessoa: selectedPessoa,
        visaRequirementId: entry.requirement?.id,
        nomeDocumento: entry.nomeDocumento,
        categoriaDoc: entry.categoriaDoc,
        etapaEsteira: '1 Aguardando Envio',
        ordemEmissao: entry.ordem,
        status: entry.status,
        dataEmissao: entry.dataEmissao,
        validadeDias: entry.validadeDias,
        dataValidadeCalculada: entry.dataValidadeCalculada,
        orgaoEmissor: entry.orgaoEmissor,
        apostilado: entry.apostilado,
        traduzido: entry.traduzido,
        exigeApostila: entry.exigeApostila,
        exigeTraducao: entry.exigeTraducao,
        obrigatorio: entry.obrigatorio,
        peso: entry.peso,
        versao: 1,
      };
      map.set(
        entry.key,
        resolveDocumentExpiration({
          doc: syntheticDoc,
          visaRequirements,
          client: activeClient,
          dependents: caseDependents,
        }),
      );
    }
    return map;
  }, [entries, activeCase, selectedPessoa, visaRequirements, activeClient, caseDependents]);

  const expiringEntries = useMemo(
    () => entries.filter((e) => expirationByKey.get(e.key)?.isExpiringUnder30Days),
    [entries, expirationByKey],
  );

  const summary = useMemo(() => summarizeChecklist(entries), [entries]);
  const thermometer = useMemo(() => {
    if (!canPersistToCase || caseDocs.length === 0) return null;
    return calcularTermometroDocumentos(caseDocs, empresa.bloqueioProtocoloMinimo || 100);
  }, [canPersistToCase, caseDocs, empresa.bloqueioProtocoloMinimo]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((item) => {
      if (statusFilter === 'pendentes' && item.completed) return false;
      if (statusFilter === 'concluidos' && !item.completed) return false;
      if (statusFilter === 'vencendo' && !expirationByKey.get(item.key)?.isExpiringUnder30Days) return false;
      if (priorityFilter === 'obrigatorios' && !item.obrigatorio) return false;
      if (priorityFilter === 'opcionais' && item.obrigatorio) return false;
      if (q) {
        const hay = `${item.nomeDocumento} ${item.categoriaDoc} ${item.orgaoEmissor} ${item.comoObterInstrucoes || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, statusFilter, priorityFilter, searchQuery, expirationByKey]);

  const missingInCaseCount = useMemo(
    () => (canPersistToCase ? entries.filter((e) => !e.document).length : 0),
    [canPersistToCase, entries],
  );

  const handleCaseSelectChange = (nextId: string) => {
    setFeedback(null);
    setErrorMsg(null);
    setLocalCaseId(nextId);
    onSelectCase(nextId || null);
  };

  const handleBindSelectedVisaToCase = async () => {
    if (!activeCase || !selectedVisa) return;
    setLinkingVisaBusy(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await saveDocumentAudited(
        'cases',
        activeCase.id,
        {
          ...activeCase,
          visaCategoryId: selectedVisa.id,
        },
        false,
        role,
        'vincular_visto_checklist',
        activeCase,
      );
      await onRefresh();
      setFeedback(`Categoria "${selectedVisa.codigo} — ${selectedVisa.nomePortugues}" aplicada ao caso.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível vincular a categoria de visto ao caso.',
      );
    } finally {
      setLinkingVisaBusy(false);
    }
  };

  const persistEntryChange = async (
    entry: ChecklistRowEntry,
    overrides: {
      nextStatus?: CaseDocument['status'];
      nextApostilado?: boolean;
      nextTraduzido?: boolean;
      nextDataEmissao?: string;
      nextDataValidadeCalculada?: string;
    },
    actionName: string,
  ) => {
    if (!canPersistToCase || !activeCase) {
      if (overrides.nextStatus) {
        const previewKey = `${selectedVisaId}:${selectedPessoa}:${entry.key}`;
        setPreviewStatusMap((prev) => ({
          ...prev,
          [previewKey]: overrides.nextStatus === 'Aprovado',
        }));
      }
      return;
    }

    setBusyKey(entry.key);
    setErrorMsg(null);
    setFeedback(null);

    try {
      const analisadoPor = userProfile.nome || userProfile.email;
      const { docId, isNew, payload } = buildCaseDocumentFromChecklistToggle({
        entry,
        activeCase,
        pessoa: selectedPessoa,
        analisadoPor,
        nextStatus: overrides.nextStatus,
        nextApostilado: overrides.nextApostilado,
        nextTraduzido: overrides.nextTraduzido,
        nextDataEmissao: overrides.nextDataEmissao,
        nextDataValidadeCalculada: overrides.nextDataValidadeCalculada,
        newId: makeId('doc'),
      });

      await saveDocumentAudited(
        'caseDocuments',
        docId,
        payload as unknown as Record<string, unknown>,
        isNew,
        role,
        actionName,
        entry.document,
      );

      if (
        overrides.nextStatus === 'Aprovado' &&
        entry.status !== 'Aprovado' &&
        activeCase.clientId
      ) {
        void notifyClientProcessUpdate({
          clientId: activeCase.clientId,
          caseId: activeCase.id,
          tipo: 'documento',
          titulo: `Documento aprovado: ${payload.nomeDocumento}`,
          mensagem: `O documento "${payload.nomeDocumento}" (${payload.pessoa}) foi validado no checklist da consultoria.`,
          etapaPipeline: activeCase.etapaPipeline,
          statusSermig: activeCase.statusSermig,
          linkDestino: '/portal-cliente',
          criadoPorUid: userProfile.uid,
          criadoPorNome: analisadoPor,
        }).catch(() => {});
      }

      await onRefresh();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao atualizar o status do documento no Firestore.',
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleCompleted = (entry: ChecklistRowEntry) => {
    const nextStatus: CaseDocument['status'] = entry.completed ? 'Pendente' : 'Aprovado';
    void persistEntryChange(entry, { nextStatus }, 'checklist_toggle_conclusao');
  };

  const handleStatusSelect = (entry: ChecklistRowEntry, status: CaseDocument['status']) => {
    void persistEntryChange(entry, { nextStatus: status }, 'checklist_alterar_status');
  };

  const handleToggleApostilado = (entry: ChecklistRowEntry) => {
    void persistEntryChange(
      entry,
      { nextStatus: entry.status, nextApostilado: !entry.apostilado },
      'checklist_toggle_apostila',
    );
  };

  const handleToggleTraduzido = (entry: ChecklistRowEntry) => {
    void persistEntryChange(
      entry,
      { nextStatus: entry.status, nextTraduzido: !entry.traduzido },
      'checklist_toggle_traducao',
    );
  };

  const handleEmissionDateChange = (entry: ChecklistRowEntry, nextDate: string) => {
    const validadeDias = Number(entry.validadeDias || entry.requirement?.validadeDias || 0);
    const calculatedExp = nextDate
      ? computeCalculatedExpirationIso(nextDate, validadeDias) || ''
      : '';
    void persistEntryChange(
      entry,
      {
        nextStatus: entry.status,
        nextDataEmissao: nextDate,
        nextDataValidadeCalculada: calculatedExp,
      },
      'checklist_data_emissao',
    );
  };

  const handleGenerateMissingDocs = async () => {
    if (!canPersistToCase || !activeCase) return;
    const missing = entries.filter((e) => !e.document);
    if (missing.length === 0) return;

    setBulkBusy(true);
    setErrorMsg(null);
    setFeedback(null);

    try {
      const analisadoPor = userProfile.nome || userProfile.email;
      for (const entry of missing) {
        const { docId, payload } = buildCaseDocumentFromChecklistToggle({
          entry,
          activeCase,
          pessoa: selectedPessoa,
          analisadoPor,
          nextStatus: 'Pendente',
          newId: makeId('doc'),
        });
        await saveDocumentAudited(
          'caseDocuments',
          docId,
          payload as unknown as Record<string, unknown>,
          true,
          role,
          'checklist_gerar_itens',
        );
      }
      await onRefresh();
      setFeedback(`${missing.length} documento(s) adicionados ao dossiê de ${selectedPessoa}.`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Erro ao gerar itens pendentes do checklist.',
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const progressPercent = thermometer ? thermometer.notaGeral : summary.percentObrigatorios;

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Ações Primárias */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Checklist de Documentos por Visto</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consulte os documentos exigidos para cada categoria migratória e marque o status de conclusão diretamente no processo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canPersistToCase && missingInCaseCount > 0 && (
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void handleGenerateMissingDocs()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {bulkBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
              Registrar {missingInCaseCount} pendente(s) no caso
            </button>
          )}
          {activeCase && (
            <button
              type="button"
              onClick={() => onOpenCase(activeCase.id)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Abrir Caso Completo
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Feedback & Erros */}
      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 flex items-center justify-between gap-3"
        >
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </span>
          <button type="button" onClick={() => setErrorMsg(null)} className="font-semibold underline shrink-0">
            Fechar
          </button>
        </div>
      )}

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{feedback}</span>
          </span>
          <button type="button" onClick={() => setFeedback(null)} className="font-semibold underline shrink-0">
            Dispensar
          </button>
        </div>
      )}

      {/* Barra de Seleção de Caso, Categoria de Visto e Pessoa */}
      <section
        className="border border-slate-200 p-5 space-y-4"
        style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--card-radius, 12px)' }}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="checklist-case-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Caso / Cliente vinculado
            </label>
            <select
              id="checklist-case-select"
              value={localCaseId}
              onChange={(e) => handleCaseSelectChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900"
            >
              <option value="">Somente consulta por categoria (sem vínculo)</option>
              {activeCases.map((c) => {
                const cli = clientMap.get(c.clientId);
                return (
                  <option key={c.id} value={c.id}>
                    {cli ? `${cli.nomeCompleto} — ${c.titulo}` : c.titulo}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label htmlFor="checklist-visa-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Categoria de Visto (Subcategoria)
            </label>
            <select
              id="checklist-visa-select"
              value={selectedVisaId}
              onChange={(e) => {
                setFeedback(null);
                setErrorMsg(null);
                setSelectedVisaId(e.target.value);
              }}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900"
            >
              {visaCategories.map((v) => (
                <option key={v.id} value={v.id}>
                  Cód. {v.codigo} — {v.nomePortugues}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="checklist-pessoa-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Pessoa do Dossiê
            </label>
            <select
              id="checklist-pessoa-select"
              value={selectedPessoa}
              onChange={(e) => setSelectedPessoa(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900"
            >
              {pessoaOptions.map((p) => (
                <option key={p} value={p}>
                  {p === 'Titular' ? 'Titular do Processo' : `Dependente: ${p}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Aviso quando visualizando categoria diferente do caso ativo */}
        {activeCase && !canPersistToCase && selectedVisa && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-amber-800">
            <span>
              Você está consultando os requisitos de <strong>{selectedVisa.nomePortugues}</strong>. O caso{' '}
              <strong>{activeCase.titulo}</strong> usa atualmente outra categoria.
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedVisaId(activeCaseVisaId)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Voltar à categoria do caso
              </button>
              <button
                type="button"
                disabled={linkingVisaBusy}
                onClick={() => void handleBindSelectedVisaToCase()}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {linkingVisaBusy ? 'Salvando...' : 'Aplicar esta categoria ao caso'}
              </button>
            </div>
          </div>
        )}

        {!activeCase && (
          <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
            <span>
              Modo de consulta: as marcações abaixo servem para conferência rápida nesta tela. Selecione um caso acima para persistir o checklist no Firestore.
            </span>
            {activeCases.length === 0 && onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('casos')}
                className="font-semibold text-[var(--color-primary)] hover:underline whitespace-nowrap"
              >
                Criar primeiro caso
              </button>
            )}
          </div>
        )}

        {/* Resumo da Categoria & Barra de Progresso */}
        {selectedVisa && (
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900">
                  Cód. {selectedVisa.codigo} — {selectedVisa.nomePortugues}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                  <span>{selectedVisa.nomeEspanhol}</span>
                  <span aria-hidden="true">·</span>
                  <span>Vigência: {selectedVisa.vigenciaMeses} meses</span>
                  <span aria-hidden="true">·</span>
                  <span>Dentro do Chile: {selectedVisa.permiteDentroChile}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedVisa.permiteTrabalhar ? 'Permite trabalhar' : 'Sem permissão laboral'}</span>
                  {activeClient && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>Cliente: {activeClient.nomeCompleto}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-5 shrink-0 text-xs">
                <div>
                  <p className="text-slate-500">Concluídos</p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {summary.completed} / {summary.total}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Obrigatórios</p>
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    {summary.completedObrigatorios} / {summary.totalObrigatorios}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Progresso</p>
                  <p
                    className="text-sm font-bold tabular-nums"
                    style={{
                      color: progressPercent >= 90 ? '#16A34A' : progressPercent >= 40 ? 'var(--color-primary)' : '#DC2626',
                    }}
                  >
                    {progressPercent}%
                  </p>
                </div>
              </div>
            </div>

            <div
              className="h-2 w-full rounded-full bg-slate-200 overflow-hidden"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Progresso do checklist documental"
            >
              <div
                className="h-full rounded-full transition-all duration-200"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: progressPercent >= 90 ? '#16A34A' : 'var(--color-primary)',
                }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Alerta de Lembretes de Vencimento (< 30 dias) dentro do Checklist */}
      {expiringEntries.length > 0 && (
        <section
          aria-label="Lembretes de vencimento do checklist"
          className="border border-amber-200 bg-amber-50/70 px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderRadius: 'var(--card-radius, 12px)' }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs space-y-0.5">
              <p className="font-bold text-slate-900">
                Lembretes de Vencimento: {expiringEntries.length} item(ns) expira(m) em menos de 30 dias
              </p>
              <p className="text-slate-700">
                {expiringEntries
                  .slice(0, 3)
                  .map((e) => `${e.nomeDocumento} (${expirationByKey.get(e.key)?.statusLabel || 'Vencendo'})`)
                  .join(' · ')}
                {expiringEntries.length > 3 ? ` · +${expiringEntries.length - 3} outro(s)` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'vencendo' ? 'todos' : 'vencendo')}
            className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100/60 whitespace-nowrap shrink-0"
          >
            {statusFilter === 'vencendo'
              ? 'Mostrar todos'
              : `Ver vencendo < 30d (${expiringEntries.length})`}
          </button>
        </section>
      )}

      {/* Filtros & Busca */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg" role="group" aria-label="Filtrar por conclusão">
            {(
              [
                { id: 'todos', label: `Todos (${summary.total})` },
                { id: 'pendentes', label: `Pendentes (${summary.pending})` },
                { id: 'concluidos', label: `Concluídos (${summary.completed})` },
                { id: 'vencendo', label: `Vencendo < 30d (${expiringEntries.length})` },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setStatusFilter(btn.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap tabular-nums ${
                  statusFilter === btn.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg" role="group" aria-label="Filtrar por obrigatoriedade">
            {(
              [
                { id: 'todos', label: 'Todos os níveis' },
                { id: 'obrigatorios', label: 'Obrigatórios' },
                { id: 'opcionais', label: 'Opcionais' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setPriorityFilter(btn.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  priorityFilter === btn.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative w-full lg:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrar documento, categoria ou órgão..."
            aria-label="Filtrar itens do checklist"
            className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
      </div>

      {/* Lista do Checklist */}
      <section
        className="border border-slate-200 overflow-hidden"
        style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--card-radius, 12px)' }}
      >
        {entries.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <ClipboardCheck className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">
                Nenhum requisito padrão cadastrado para esta categoria ainda
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Cadastre os documentos exigidos em Base Legal &amp; Vistos ou adicione documentos manualmente dentro do dossiê do caso.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              {(role === 'admin' || role === 'consultor') && onNavigateSection && (
                <button
                  type="button"
                  onClick={() => onNavigateSection('legal')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Configurar em Base Legal &amp; Vistos
                </button>
              )}
              {activeCase && (
                <button
                  type="button"
                  onClick={() => onOpenCase(activeCase.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Abrir Aba Documentos do Caso
                </button>
              )}
            </div>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-800">
              Nenhum item corresponde aos filtros aplicados.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('todos');
                setPriorityFilter('todos');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredEntries.map((entry) => {
              const isBusy = busyKey === entry.key;
              const isExpanded = expandedKey === entry.key;
              const hasDetails = Boolean(entry.requirement?.descricao || entry.comoObterInstrucoes || entry.comoObterUrl);
              const expEval = expirationByKey.get(entry.key);
              const isExpiring = Boolean(expEval?.isExpiringUnder30Days);
              const isExpCritical = expEval?.severity === 'vencido' || expEval?.severity === 'critico';

              return (
                <div
                  key={entry.key}
                  className={`px-4 py-3.5 transition-colors ${
                    entry.completed ? 'bg-slate-50/60' : 'hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Coluna Esquerda: Checkbox + Título + Metadados em linha limpa */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={entry.completed}
                        aria-label={`Marcar "${entry.nomeDocumento}" como ${entry.completed ? 'pendente' : 'concluído'}`}
                        disabled={isBusy}
                        onClick={() => handleToggleCompleted(entry)}
                        className={`mt-0.5 w-6 h-6 rounded-md border flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
                          entry.completed
                            ? 'bg-[#16A34A] border-[#16A34A] text-white'
                            : 'bg-white border-slate-300 text-transparent hover:border-slate-500'
                        } disabled:opacity-50`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                            {String(entry.ordem).padStart(2, '0')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleCompleted(entry)}
                            disabled={isBusy}
                            className={`text-left text-sm font-semibold transition-colors ${
                              entry.completed
                                ? 'text-slate-500 line-through'
                                : 'text-slate-900 hover:text-[var(--color-primary)]'
                            }`}
                          >
                            {entry.nomeDocumento}
                          </button>
                          {isExpiring && expEval && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-bold tabular-nums"
                              style={{ color: isExpCritical ? '#DC2626' : '#D97706' }}
                              title={`Alerta de vencimento: ${expEval.statusLabel}`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>
                                {expEval.statusLabel}
                                {expEval.dataValidadeEfetiva ? ` (${expEval.dataValidadeBR})` : ''}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                          <span>{entry.categoriaDoc}</span>
                          <span aria-hidden="true">·</span>
                          <span className={entry.obrigatorio ? 'font-medium text-slate-700' : 'text-slate-500'}>
                            {entry.obrigatorio ? 'Obrigatório' : 'Opcional'}
                          </span>
                          {entry.orgaoEmissor && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Órgão: {entry.orgaoEmissor}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {entry.validadeDias > 0 ? `Validade: ${entry.validadeDias} dias` : 'Sem vencimento'}
                          </span>
                          {entry.dataEmissao && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">Emissão: {formatDateBR(entry.dataEmissao)}</span>
                            </>
                          )}
                          {expEval?.dataValidadeEfetiva && !isExpiring && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums text-slate-600">
                                Válido até {expEval.dataValidadeBR}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span
                            className="font-semibold"
                            style={{
                              color:
                                entry.status === 'Aprovado'
                                  ? '#16A34A'
                                  : entry.status === 'Reprovado' || entry.status === 'Vencido'
                                    ? '#DC2626'
                                    : entry.status === 'Em análise' || entry.status === 'Enviado'
                                      ? '#D97706'
                                      : '#475569',
                            }}
                          >
                            Status: {entry.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Coluna Direita: Emissão, Apostila, Tradução, Status, Detalhes */}
                    <div className="flex flex-wrap items-center gap-2 pl-9 md:pl-0 shrink-0">
                      {canPersistToCase && (entry.validadeDias > 0 || entry.dataEmissao || entry.dataValidadeCalculada) && (
                        <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                          <span>Emissão:</span>
                          <input
                            type="date"
                            aria-label={`Data de emissão de ${entry.nomeDocumento}`}
                            value={entry.dataEmissao ? entry.dataEmissao.slice(0, 10) : ''}
                            disabled={isBusy}
                            onChange={(e) => handleEmissionDateChange(entry, e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 tabular-nums disabled:opacity-50"
                          />
                        </label>
                      )}

                      {canPersistToCase && entry.exigeApostila && (
                        <button
                          type="button"
                          disabled={isBusy}
                          aria-pressed={entry.apostilado}
                          onClick={() => handleToggleApostilado(entry)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                            entry.apostilado
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          } disabled:opacity-50`}
                        >
                          {entry.apostilado ? 'Apostila OK' : 'Marcar Apostila'}
                        </button>
                      )}

                      {canPersistToCase && entry.exigeTraducao && (
                        <button
                          type="button"
                          disabled={isBusy}
                          aria-pressed={entry.traduzido}
                          onClick={() => handleToggleTraduzido(entry)}
                          className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                            entry.traduzido
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          } disabled:opacity-50`}
                        >
                          {entry.traduzido ? 'Tradução OK' : 'Marcar Tradução'}
                        </button>
                      )}

                      {canPersistToCase && (
                        <select
                          aria-label={`Status de ${entry.nomeDocumento}`}
                          value={entry.status}
                          disabled={isBusy}
                          onChange={(e) =>
                            handleStatusSelect(entry, e.target.value as CaseDocument['status'])
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 disabled:opacity-50"
                        >
                          {STATUS_OPTIONS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      )}

                      {hasDetails && (
                        <button
                          type="button"
                          onClick={() => setExpandedKey(isExpanded ? null : entry.key)}
                          aria-expanded={isExpanded}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <span>Instruções</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      )}

                      {canPersistToCase && canDeleteChecklistDoc && entry.document && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => setDeleteTargetDoc(entry.document!)}
                          title={`Excluir "${entry.nomeDocumento}" do dossiê do caso`}
                          aria-label={`Excluir "${entry.nomeDocumento}" do dossiê`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-semibold text-[#C82333] hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Excluir</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Painel Expandido de Instruções */}
                  {isExpanded && hasDetails && (
                    <div className="mt-3 ml-9 pt-3 border-t border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                      {entry.requirement?.descricao && (
                        <p>
                          <strong className="text-slate-800">Descrição:</strong> {entry.requirement.descricao}
                        </p>
                      )}
                      {entry.comoObterInstrucoes && (
                        <p>
                          <strong className="text-slate-800">Como obter:</strong> {entry.comoObterInstrucoes}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-4 pt-1">
                        {entry.exigeApostila && (
                          <span className="text-slate-600">Exige Apostila de Haia</span>
                        )}
                        {entry.exigeTraducao && (
                          <span className="text-slate-600">Exige Tradução Juramentada (Espanhol)</span>
                        )}
                        {entry.comoObterUrl && (
                          <a
                            href={entry.comoObterUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline"
                          >
                            <span>Acessar portal oficial</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmActionModal
        open={Boolean(deleteTargetDoc)}
        title="Excluir documento do checklist"
        description={
          deleteTargetDoc
            ? `Tem certeza que deseja excluir o documento "${deleteTargetDoc.nomeDocumento}" (${deleteTargetDoc.pessoa}) do dossiê deste caso? A exclusão será registrada na auditoria.`
            : ''
        }
        confirmLabel="Excluir documento"
        tone="danger"
        onClose={() => {
          if (!deletingDoc) setDeleteTargetDoc(null);
        }}
        onConfirm={handleConfirmDeleteDoc}
      />
    </div>
  );
};
