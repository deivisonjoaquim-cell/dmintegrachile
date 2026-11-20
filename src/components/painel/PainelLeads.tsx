import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightCircle,
  BarChart3,
  BellPlus,
  Download,
  Edit3,
  Eye,
  GitMerge,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { DiagnosticReportView, type AiDiagnosticDraft } from '../DiagnosticReportView';
import { LegalBaseModal } from '../LegalBaseModal';
import { ConfirmActionModal } from '../ui/DesignSystem';
import { OfflineDecisionLogsPanel } from './OfflineDecisionLogsPanel';
import { FUNIL_STAGES, PainelLeadsKanban } from './PainelLeadsKanban';
import { buildUpdatedLeadFromPatch, type LeadQuickEditPatch } from '../../utils/leadKanban';
import {
  callAiEndpoint,
  convertLeadToClientAndCaseEnhanced,
  deleteDocumentAudited,
  deleteLeadAndSessionAudited,
  makeId,
  recalculateLeadsWithRules,
  saveDocumentAudited,
  syncDiagnosticFollowUpTasks,
} from '../../services/firestoreService';
import { sanitizeDiagnosticLeadPayload } from '../../utils/firestorePayloads';
import type {
  AuditLog,
  Client,
  DiagnosticAnswers,
  DiagnosticRuleVersion,
  EmpresaConfig,
  Lead,
  LegalSource,
  MessageTemplate,
  Task,
  UserProfile,
  UserRole,
  VisaCategory,
  VisaRequirement,
} from '../../types/domain';
import { computeDiagnosticIntelligence } from '../../utils/diagnosticAnalytics';
import { compareWhatIfScenarios, runDiagnosticEngine } from '../../utils/diagnosticEngine';
import {
  applyTemplateVariables,
  buildWhatsAppUrl,
  exportToCSV,
  formatDateBR,
} from '../../utils/formatters';
import {
  compactLegalSourcesForAi,
  loadAiDraftCache,
  sanitizeClientAiError,
  saveAiDraftCache,
} from '../../utils/aiClient';
import {
  listRuleEngineDecisionLogs,
  mergeLocalAndCloudRuleLogs,
  parseRuleDecisionLogsFromAuditLogs,
  subscribeOfflineEngineChanges,
} from '../../utils/offlineRuleEngineStore';
type PanelTheme = 'light' | 'dark';

export type PainelLeadsViewId = 'lista' | 'kanban' | 'inteligencia' | 'motor_local';

interface PainelLeadsProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  leads: Lead[];
  clients: Client[];
  tasks: Task[];
  auditLogs?: AuditLog[];
  requestedView?: { view: PainelLeadsViewId; seq: number } | null;
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeRules: DiagnosticRuleVersion;
  messageTemplates: MessageTemplate[];
  panelTheme?: PanelTheme;
  onToggleTheme?: () => void;
  requestedOpenLead?: { leadId: string; seq: number } | null;
  requestedQuickLeadSeq?: number;
  onRefresh: () => Promise<void>;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
  onOpenCase: (caseId: string) => void;
}

export const PainelLeads: React.FC<PainelLeadsProps> = ({
  role,
  userProfile,
  empresa,
  leads,
  clients,
  tasks,
  auditLogs = [],
  requestedView,
  visaCategories,
  visaRequirements,
  legalSources,
  activeRules,
  messageTemplates,
  panelTheme = 'light',
  requestedOpenLead,
  requestedQuickLeadSeq,
  onRefresh,
  onLogWhatsApp,
  onOpenCase,
}) => {
  const [view, setView] = useState<PainelLeadsViewId>(() => {
    try {
      const saved = window.localStorage.getItem('dm_leads_view');
      if (saved === 'lista' || saved === 'kanban' || saved === 'inteligencia' || saved === 'motor_local') return saved;
    } catch {
      // ignore storage errors
    }
    return 'lista';
  });

  useEffect(() => {
    if (requestedView?.view) {
      setView(requestedView.view);
    }
  }, [requestedView]);

  const [localDecisionTick, setLocalDecisionTick] = useState(0);
  useEffect(() => subscribeOfflineEngineChanges(() => setLocalDecisionTick((n) => n + 1)), []);

  const pendingOfflineReviewCount = useMemo(() => {
    void localDecisionTick;
    const merged = mergeLocalAndCloudRuleLogs(
      listRuleEngineDecisionLogs(),
      parseRuleDecisionLogsFromAuditLogs(auditLogs),
    );
    return merged.filter((l) => l.syncStatus !== 'revisado').length;
  }, [auditLogs, localDecisionTick]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [smartFilter, setSmartFilter] = useState<
    'todos' | 'alta_urgente' | 'confianca_baixa' | 'abandonados' | 'revisar_consultor' | 'quente'
  >('todos');
  const [periodDays, setPeriodDays] = useState<number>(0);

  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [inspectingLead, setInspectingLead] = useState<Lead | null>(null);
  const [whatIfAnswers, setWhatIfAnswers] = useState<DiagnosticAnswers | null>(null);
  const [lawModalOpen, setLawModalOpen] = useState(false);
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null);
  const [optimisticLeads, setOptimisticLeads] = useState<Record<string, Lead>>({});

  const [aiDraft, setAiDraft] = useState<AiDiagnosticDraft | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [lastConvertedCaseId, setLastConvertedCaseId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedTplId, setSelectedTplId] = useState(messageTemplates[0]?.id || '');
  const [showAdvancedToolbar, setShowAdvancedToolbar] = useState(false);
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const [quickLeadSaving, setQuickLeadSaving] = useState(false);
  const [quickLeadError, setQuickLeadError] = useState<string | null>(null);

  useEffect(() => {
    if (requestedQuickLeadSeq && requestedQuickLeadSeq > 0) {
      setQuickLeadError(null);
      setQuickLeadOpen(true);
    }
  }, [requestedQuickLeadSeq]);

  useEffect(() => {
    if (!requestedOpenLead?.leadId) return;
    const found = leads.find((l) => l.id === requestedOpenLead.leadId);
    if (found) {
      setInspectingLead(found);
      setWhatIfAnswers(found.respostasTriagem ? { ...found.respostasTriagem } : null);
      setAiError(null);
      setAiProgress(null);
      setAiDraft(loadAiDraftCache<AiDiagnosticDraft>(`diagnostico_lead_${found.id}`));
    }
  }, [requestedOpenLead, leads]);
  const [quickLeadForm, setQuickLeadForm] = useState<{
    nome: string;
    whatsapp: string;
    email: string;
    cidadeUf: string;
    origem: Lead['origem'];
    interesse: string;
    prioridade: Lead['prioridade'];
    notas: string;
  }>({
    nome: '',
    whatsapp: '',
    email: '',
    cidadeUf: '',
    origem: 'Instagram',
    interesse: 'Residência Temporal (Acordo Mercosul)',
    prioridade: 'Alta',
    notas: '',
  });
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    details?: string[];
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const effectiveLeads = useMemo(
    () => leads.map((l) => optimisticLeads[l.id] || l),
    [leads, optimisticLeads],
  );

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { Todos: effectiveLeads.length };
    for (const st of FUNIL_STAGES) counts[st] = 0;
    for (const l of effectiveLeads) {
      counts[l.statusFunil] = (counts[l.statusFunil] || 0) + 1;
    }
    return counts;
  }, [effectiveLeads]);

  const handleCreateQuickLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickLeadError(null);
    setQuickLeadSaving(true);
    try {
      const id = makeId('lead');
      const now = new Date().toISOString();
      const payload = sanitizeDiagnosticLeadPayload(
        {
          id,
          nome: quickLeadForm.nome,
          whatsapp: quickLeadForm.whatsapp,
          email: quickLeadForm.email,
          cidadeUf: quickLeadForm.cidadeUf || 'Brasil',
          origem: quickLeadForm.origem,
          interesse: quickLeadForm.interesse || 'Residência no Chile',
          statusFunil: 'Novo',
          prioridade: quickLeadForm.prioridade,
          notas: quickLeadForm.notas,
          statusConclusao: 'Concluído',
          lgpdAceito: true,
          lgpdVersao: empresa.termoLgpdVersao || '1.0',
          lgpdData: now,
          createdAt: now,
        },
        { isNew: true },
      );
      await saveDocumentAudited(
        'leads',
        id,
        payload as unknown as Record<string, unknown>,
        true,
        role,
        'criar_lead_rapido',
      );
      setQuickLeadOpen(false);
      setQuickLeadForm({
        nome: '',
        whatsapp: '',
        email: '',
        cidadeUf: '',
        origem: 'Instagram',
        interesse: 'Residência Temporal (Acordo Mercosul)',
        prioridade: 'Alta',
        notas: '',
      });
      setFeedback(`Lead "${payload.nome}" cadastrado com sucesso.`);
      await onRefresh();
    } catch (err) {
      setQuickLeadError(err instanceof Error ? err.message : 'Verifique nome, e-mail e WhatsApp válidos.');
    } finally {
      setQuickLeadSaving(false);
    }
  };

  const engineOptions = useMemo(
    () => ({
      ruleVersion: activeRules,
      custosPadrao: empresa.custosPadrao,
      honorariosMinBrl: activeRules.honorariosMinBrl ?? empresa.honorariosPadraoMinBrl,
      honorariosMaxBrl: activeRules.honorariosMaxBrl ?? empresa.honorariosPadraoMaxBrl,
      taxaCambioBrlClp: activeRules.taxaCambioBrlClp ?? empresa.taxaCambioBrlClp,
      taxaCambioUsdBrl: activeRules.taxaCambioUsdBrl ?? empresa.taxaCambioUsdBrl,
    }),
    [activeRules, empresa],
  );

  const intelligence = useMemo(
    () => computeDiagnosticIntelligence(effectiveLeads, periodDays > 0 ? periodDays : undefined),
    [effectiveLeads, periodDays],
  );

  const duplicateGroups = useMemo(() => {
    const map = new Map<string, Lead[]>();
    for (const l of effectiveLeads) {
      if (l.motivoPerda === 'Lead duplicado mesclado') continue;
      const emailKey = (l.email || '').trim().toLowerCase();
      const phoneDigits = (l.whatsapp || '').replace(/\D/g, '');
      const key = emailKey || (phoneDigits.length >= 8 ? phoneDigits : l.id);
      const arr = map.get(key) || [];
      arr.push(l);
      map.set(key, arr);
    }
    return Array.from(map.values()).filter((g) => g.length > 1);
  }, [effectiveLeads]);

  const filtered = useMemo(() => {
    return effectiveLeads
      .filter((l) => {
        if (view !== 'kanban' && statusFilter !== 'Todos' && l.statusFunil !== statusFilter) return false;
        if (smartFilter === 'alta_urgente' && l.prioridade !== 'Alta' && l.prioridade !== 'Urgente') return false;
        if (smartFilter === 'confianca_baixa' && l.confianca !== 'Baixa') return false;
        if (smartFilter === 'abandonados' && l.statusConclusao !== 'Abandonado' && l.statusConclusao !== 'Em andamento') {
          return false;
        }
        if (smartFilter === 'revisar_consultor' && !(l.respostasTriagem?.riscoConsultaConsultor?.length)) return false;
        if (smartFilter === 'quente' && l.temperatura !== 'Quente') return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          return (
            l.nome.toLowerCase().includes(q) ||
            l.email.toLowerCase().includes(q) ||
            l.whatsapp.toLowerCase().includes(q) ||
            (l.subcategoriaSugerida || '').toLowerCase().includes(q) ||
            (l.utmCampaign || '').toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [effectiveLeads, view, search, statusFilter, smartFilter]);

  const hasActiveFilters = Boolean(
    search.trim() || smartFilter !== 'todos' || (view !== 'kanban' && statusFilter !== 'Todos'),
  );

  const handleClearFilters = () => {
    setSearch('');
    setSmartFilter('todos');
    if (view !== 'kanban') setStatusFilter('Todos');
  };

  const openInspectModal = (lead: Lead) => {
    setInspectingLead(lead);
    setWhatIfAnswers(lead.respostasTriagem ? { ...lead.respostasTriagem } : null);
    setAiDraft(loadAiDraftCache<AiDiagnosticDraft>(`diagnostico_lead_${lead.id}`));
    setAiProgress(null);
    setAiError(null);
  };

  const inspectedResult = useMemo(() => {
    if (!inspectingLead?.respostasTriagem) return null;
    return runDiagnosticEngine(inspectingLead.respostasTriagem, visaCategories, visaRequirements, legalSources, engineOptions);
  }, [inspectingLead, visaCategories, visaRequirements, legalSources, engineOptions]);

  const whatIfComparison = useMemo(() => {
    if (!inspectingLead?.respostasTriagem || !whatIfAnswers) return null;
    return compareWhatIfScenarios(
      inspectingLead.respostasTriagem,
      whatIfAnswers,
      visaCategories,
      visaRequirements,
      legalSources,
      engineOptions,
    );
  }, [inspectingLead, whatIfAnswers, visaCategories, visaRequirements, legalSources, engineOptions]);

  const handleRefineInspectAi = async () => {
    if (!inspectingLead?.respostasTriagem || !inspectedResult || aiLoading) return;
    setAiLoading(true);
    setAiProgress('Iniciando análise...');
    setAiError(null);
    try {
      const draft = await callAiEndpoint<AiDiagnosticDraft>(
        '/api/ai/diagnostico',
        {
          answers: inspectingLead.respostasTriagem,
          subcategoriaRecomendada: inspectedResult.recomendada
            ? `${inspectedResult.recomendada.visa.codigo} - ${inspectedResult.recomendada.visa.nomePortugues}`
            : '',
          regrasAcionadas: inspectedResult.regrasAcionadas,
          visaCategories: visaCategories.slice(0, 16).map((v) => ({
            codigo: v.codigo,
            nomePortugues: v.nomePortugues,
            permiteDentroChile: v.permiteDentroChile,
          })),
          legalSources: compactLegalSourcesForAi(inspectedResult.fontesLegais),
        },
        {
          onProgress: (msg) => setAiProgress(msg),
        },
      );
      setAiDraft(draft);
      saveAiDraftCache(`diagnostico_lead_${inspectingLead.id}`, draft);
    } catch (err) {
      setAiError(sanitizeClientAiError(err));
    } finally {
      setAiLoading(false);
      setAiProgress(null);
    }
  };

  const handleQuickUpdateLead = async (lead: Lead, patch: LeadQuickEditPatch) => {
    const updatedLead = buildUpdatedLeadFromPatch(lead, patch);
    setMovingLeadId(lead.id);
    setOptimisticLeads((prev) => ({ ...prev, [lead.id]: updatedLead }));
    setFeedback(null);
    try {
      await saveDocumentAudited(
        'leads',
        lead.id,
        updatedLead as unknown as Record<string, unknown>,
        false,
        role,
        'edicao_rapida_lead',
        {
          statusFunil: lead.statusFunil,
          prioridade: lead.prioridade,
          temperatura: lead.temperatura,
        },
      );
      setFeedback(`Lead "${lead.nome}" atualizado: ${updatedLead.statusFunil} · Prioridade ${updatedLead.prioridade}.`);
      await onRefresh();
    } catch (err) {
      setOptimisticLeads((prev) => {
        const clone = { ...prev };
        delete clone[lead.id];
        return clone;
      });
      const msg = err instanceof Error ? err.message : 'Não foi possível atualizar o lead.';
      setFeedback(msg);
      throw err instanceof Error ? err : new Error(msg);
    } finally {
      setMovingLeadId(null);
      setOptimisticLeads((prev) => {
        const clone = { ...prev };
        delete clone[lead.id];
        return clone;
      });
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLead) return;
    const base = leads.find((l) => l.id === editingLead.id) || editingLead;
    await handleQuickUpdateLead(base, {
      statusFunil: editingLead.statusFunil,
      prioridade: editingLead.prioridade,
      temperatura: editingLead.temperatura,
      motivoPerda: editingLead.motivoPerda,
      notas: editingLead.notas,
    });
    setEditingLead(null);
  };

  const handleMoveLeadStage = async (
    lead: Lead,
    nextStage: Lead['statusFunil'],
    motivoPerda?: string,
  ) => {
    if (lead.statusFunil === nextStage) return;
    await handleQuickUpdateLead(lead, {
      statusFunil: nextStage,
      prioridade: lead.prioridade,
      temperatura: lead.temperatura,
      motivoPerda,
      notas: lead.notas,
    });
  };

  const requestDeleteLead = (lead: Lead) => {
    if (role !== 'admin') return;
    setConfirmModal({
      title: 'Excluir lead definitivamente',
      description: `Deseja excluir o lead "${lead.nome}"? A sessão temporária do diagnóstico vinculada também será removida e a exclusão ficará registrada em auditoria LGPD.`,
      details: [
        `E-mail / WhatsApp: ${lead.email || '—'} · ${lead.whatsapp || '—'}`,
        `Status no funil: ${lead.statusFunil}`,
      ],
      confirmLabel: 'Excluir lead',
      onConfirm: async () => {
        await deleteLeadAndSessionAudited(lead, role);
        setSelectedLeadIds((prev) => prev.filter((id) => id !== lead.id));
        if (inspectingLead?.id === lead.id) setInspectingLead(null);
        if (editingLead?.id === lead.id) setEditingLead(null);
        setFeedback(`Lead "${lead.nome}" excluído com auditoria.`);
        await onRefresh();
      },
    });
  };

  const requestBulkDeleteLeads = () => {
    if (role !== 'admin' || selectedLeadIds.length === 0) return;
    const targets = effectiveLeads.filter((l) => selectedLeadIds.includes(l.id));
    if (targets.length === 0) return;
    setConfirmModal({
      title: `Excluir ${targets.length} lead(s) selecionado(s)`,
      description: 'Esta ação remove definitivamente os leads selecionados e suas sessões de retomada, atendendo auditoria LGPD.',
      details: targets.slice(0, 6).map((t) => `${t.nome} (${t.statusFunil})`),
      confirmLabel: `Excluir ${targets.length} lead(s)`,
      onConfirm: async () => {
        for (const target of targets) {
          await deleteLeadAndSessionAudited(target, role);
        }
        setSelectedLeadIds([]);
        setFeedback(`${targets.length} lead(s) excluído(s) com auditoria.`);
        await onRefresh();
      },
    });
  };

  const handleExportLeadLgpd = (lead: Lead) => {
    const blob = new Blob([JSON.stringify(lead, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dados-titular-${lead.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleConvert = async (lead: Lead) => {
    if (role !== 'admin' && role !== 'consultor') {
      setFeedback('Apenas Admin ou Consultor podem converter leads em Clientes e Casos.');
      return;
    }
    setConvertingId(lead.id);
    setFeedback(null);
    setLastConvertedCaseId(null);
    try {
      const res = await convertLeadToClientAndCaseEnhanced({
        lead,
        clients,
        visaCategories,
        visaRequirements,
        legalSources,
        activeRules,
        empresa,
        role,
        autorNome: userProfile.nome || userProfile.email,
      });
      setLastConvertedCaseId(res.caseId);
      setInspectingLead((prev) =>
        prev && prev.id === lead.id
          ? { ...prev, statusFunil: 'Fechado', convertedClientId: res.clientId, convertedCaseId: res.caseId }
          : prev,
      );
      setFeedback(
        `Lead convertido! Cliente ${res.clientReused ? 'reutilizado' : 'criado'} e Processo aberto em Documentação com ${res.docsCount} documento(s) e ${res.tasksCount} tarefa(s).`,
      );
      await onRefresh();
    } finally {
      setConvertingId(null);
    }
  };

  const handleRecalculateSelected = async () => {
    if (selectedLeadIds.length === 0) return;
    setBusyAction(true);
    setFeedback(null);
    try {
      const targets = leads.filter((l) => selectedLeadIds.includes(l.id));
      const count = await recalculateLeadsWithRules(
        targets,
        activeRules,
        visaCategories,
        visaRequirements,
        legalSources,
        empresa,
        role,
      );
      setSelectedLeadIds([]);
      setFeedback(`${count} lead(s) recalculado(s) com a versão ${activeRules.versao} (histórico anterior preservado).`);
      await onRefresh();
    } finally {
      setBusyAction(false);
    }
  };

  const handleSyncFollowUps = async () => {
    setBusyAction(true);
    setFeedback(null);
    try {
      const count = await syncDiagnosticFollowUpTasks(leads, tasks, role);
      setFeedback(
        count > 0
          ? `${count} lembrete(s)/tarefa(s) criado(s) para follow-up 24h/72h e retomada de diagnósticos abandonados.`
          : 'Todos os lembretes de follow-up e retomada já estão sincronizados.',
      );
      await onRefresh();
    } finally {
      setBusyAction(false);
    }
  };

  const handleMergeDuplicates = async () => {
    if (duplicateGroups.length === 0) return;
    setBusyAction(true);
    setFeedback(null);
    try {
      let merged = 0;
      for (const group of duplicateGroups) {
        const sorted = [...group].sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
        const primary = sorted[0];
        const extras = sorted.slice(1);
        const mergedNotes = [primary.notas, ...extras.map((e) => e.notas)].filter(Boolean).join(' | ');
        await saveDocumentAudited(
          'leads',
          primary.id,
          { ...primary, notas: mergedNotes },
          false,
          role,
          'mesclar_duplicado_principal',
        );
        for (const dup of extras) {
          if (role === 'admin') {
            await deleteDocumentAudited('leads', dup.id, role, dup);
          } else {
            await saveDocumentAudited(
              'leads',
              dup.id,
              { ...dup, statusFunil: 'Perdido', motivoPerda: 'Lead duplicado mesclado' },
              false,
              role,
              'mesclar_duplicado_secundario',
            );
          }
          merged += 1;
        }
      }
      setFeedback(`${merged} lead(s) duplicado(s) mesclado(s) com auditoria.`);
      await onRefresh();
    } finally {
      setBusyAction(false);
    }
  };

  const handleSendTemplate = async (lead: Lead) => {
    const tpl = messageTemplates.find((t) => t.id === selectedTplId) || messageTemplates[0];
    if (!tpl) return;
    const text = applyTemplateVariables(tpl.corpo, {
      nome_cliente: lead.nome,
      subcategoria_visto: lead.subcategoriaSugerida || lead.interesse,
      documento_nome: 'Checklist inicial',
      motivo_reprovacao: '',
      prazo_data: formatDateBR(new Date()),
      valor: '',
      chave_pix: '',
    });
    window.open(buildWhatsAppUrl(lead.whatsapp, text), '_blank', 'noopener,noreferrer');
    if (lead.statusFunil === 'Novo' && !lead.primeiroContatoEm) {
      await saveDocumentAudited(
        'leads',
        lead.id,
        { ...lead, statusFunil: 'Contatado', primeiroContatoEm: new Date().toISOString() },
        false,
        role,
        'primeiro_contato_whatsapp',
      );
    }
    await onLogWhatsApp(lead.convertedClientId, lead.convertedCaseId, `WhatsApp Lead: ${tpl.titulo}`, text);
  };

  const toggleSelect = (id: string) => {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const getPriorityBadge = (p: Lead['prioridade']) => {
    if (p === 'Urgente') return 'bg-red-50 dark:bg-red-950/40 text-[#C82333] dark:text-red-400 border-red-200 dark:border-red-800/70';
    if (p === 'Alta') return 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/70';
    if (p === 'Média') return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    return 'bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700';
  };

  return (
    <div className="space-y-5 min-w-0 w-full">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Leads</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Atendimento comercial simples: filtre pela etapa, fale no WhatsApp e converta em processo em 1 clique.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
            {[
              { id: 'lista', label: 'Lista' },
              { id: 'kanban', label: 'Kanban' },
              { id: 'inteligencia', label: 'Métricas' },
              {
                id: 'motor_local',
                label:
                  pendingOfflineReviewCount > 0
                    ? `Motor Local (${pendingOfflineReviewCount})`
                    : 'Motor Local',
              },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  const next = t.id as PainelLeadsViewId;
                  setView(next);
                  try {
                    window.localStorage.setItem('dm_leads_view', next);
                  } catch {
                    // ignore
                  }
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  view === t.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setQuickLeadError(null);
              setQuickLeadOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Lead
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-900 dark:text-emerald-200 font-medium flex flex-wrap items-center justify-between gap-2">
          <span>{feedback}</span>
          {lastConvertedCaseId && (
            <button
              type="button"
              onClick={() => onOpenCase(lastConvertedCaseId)}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[#1E7E34] text-white text-xs font-semibold hover:opacity-95 whitespace-nowrap shrink-0"
            >
              Abrir Processo agora
              <ArrowRightCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {duplicateGroups.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-700/60 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
            <span>
              Detectado(s) <strong>{duplicateGroups.length}</strong> grupo(s) de leads com mesmo e-mail ou WhatsApp.
            </span>
          </div>
          <button
            type="button"
            disabled={busyAction}
            onClick={() => void handleMergeDuplicates()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700/60 font-semibold text-slate-800 dark:text-slate-100 hover:bg-amber-100/40 dark:hover:bg-slate-700"
          >
            <GitMerge className="w-3.5 h-3.5" />
            Mesclar duplicados
          </button>
        </div>
      )}

      {/* LOG INTERNO DO MOTOR DE REGRAS OFFLINE / LOCAL */}
      {view === 'motor_local' ? (
        <OfflineDecisionLogsPanel
          role={role}
          userProfile={userProfile}
          auditLogs={auditLogs}
          isDark={panelTheme === 'dark'}
          onRefreshWorkspace={onRefresh}
        />
      ) : view === 'inteligencia' ? (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[var(--color-primary)] dark:text-sky-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Métricas de Diagnóstico, Funil e Abandono</h2>
            </div>
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              aria-label="Filtrar período das métricas"
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value={0}>Todo o histórico</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total de diagnósticos', val: String(intelligence.totalLeads), sub: `${intelligence.concluidos} concluído(s)` },
              { label: 'Taxa de conclusão', val: `${intelligence.taxaConclusaoPct}%`, sub: `${intelligence.abandonados} abandonado(s) · ${intelligence.emAndamento} andamento` },
              { label: 'Conversão Lead → Cliente', val: `${intelligence.taxaConversaoLeadClientePct}%`, sub: `Tempo médio contato: ${intelligence.tempoMedioAteContatoHoras !== null ? `${intelligence.tempoMedioAteContatoHoras}h` : '—'}` },
              { label: 'BR com alerta saída Chile', val: `${intelligence.percentualBrasileirosComSaidaChilePct}%`, sub: `Risco alto: ${intelligence.leadsComRiscoAlto} · Confiança baixa: ${intelligence.leadsConfiancaBaixa}` },
            ].map((k) => (
              <div key={k.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
                <p className="text-xs text-slate-500 dark:text-slate-400">{k.label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{k.val}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{k.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Abandono por Etapa */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Abandono / Parada por Etapa do Formulário</h3>
              <div className="space-y-2.5">
                {intelligence.abandonoPorEtapa.map((st) => (
                  <div key={st.etapa} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{st.nome}</span>
                      <span className="tabular-nums text-slate-600 dark:text-slate-400">
                        {st.quantidade} ({st.percentualPct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-[#C82333]" style={{ width: `${st.percentualPct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Subcategorias mais indicadas */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Subcategorias Mais Indicadas</h3>
              {intelligence.subcategoriasMaisIndicadas.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Sem diagnósticos concluídos no período.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {intelligence.subcategoriasMaisIndicadas.slice(0, 8).map((s) => (
                    <li key={s.subcategoria} className="py-2 flex justify-between gap-2">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{s.subcategoria}</span>
                      <span className="font-bold tabular-nums text-[var(--color-primary)] dark:text-sky-400">{s.total}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Origens e UTM */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Origem dos Leads &amp; Campanhas UTM</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold text-slate-600 dark:text-slate-400 mb-2">Por canal</p>
                  <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                    {intelligence.porOrigem.map((o) => (
                      <li key={o.origem} className="flex justify-between">
                        <span>{o.origem}</span>
                        <span className="font-semibold tabular-nums">
                          {o.total} ({o.fechados} fech.)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-600 dark:text-slate-400 mb-2">Por UTM (Source/Medium/Campaign)</p>
                  <ul className="space-y-1.5 text-slate-700 dark:text-slate-300">
                    {intelligence.porUtm.slice(0, 6).map((u) => (
                      <li key={u.utm} className="flex justify-between gap-2">
                        <span className="truncate">{u.utm}</span>
                        <span className="font-semibold tabular-nums shrink-0">{u.total}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Heatmap de Campos em Branco */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Heatmap de Perguntas Deixadas em Branco</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ajuda a identificar perguntas confusas ou com alta taxa de omissão no diagnóstico.
              </p>
              <div className="space-y-2">
                {intelligence.heatmapCamposEmBranco.slice(0, 7).map((h) => (
                  <div key={h.campo} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300">{h.rotulo}</span>
                      <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                        {h.percentualPct}% ({h.emBranco}/{h.totalElegiveis})
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${h.percentualPct}%`,
                          backgroundColor: h.percentualPct >= 50 ? '#C82333' : h.percentualPct >= 25 ? '#D4AF37' : 'var(--color-primary)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Barra Simples: Etapas em 1 clique + Busca + Mais opções */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
            {view === 'lista' && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {(['Todos', ...FUNIL_STAGES] as const).map((stage) => {
                  const active = statusFilter === stage;
                  return (
                    <button
                      key={stage}
                      type="button"
                      onClick={() => setStatusFilter(stage)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                        active
                          ? 'bg-[#0B1F33] dark:bg-sky-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {stage} ({stageCounts[stage] || 0})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center min-w-0">
              <div className="relative flex-1 min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar lead por nome, WhatsApp, e-mail ou visto..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 text-xs sm:text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdvancedToolbar((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    showAdvancedToolbar || smartFilter !== 'todos'
                      ? 'border-[#0B1F33] dark:border-sky-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                      : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filtros e ações
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 whitespace-nowrap shrink-0"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {showAdvancedToolbar && (
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
                <select
                  value={smartFilter}
                  onChange={(e) => setSmartFilter(e.target.value as typeof smartFilter)}
                  aria-label="Filtrar por perfil do lead"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="todos">Todos os perfis</option>
                  <option value="alta_urgente">Prioridade Alta / Urgente</option>
                  <option value="quente">Temperatura Quente</option>
                  <option value="confianca_baixa">Confiança Baixa</option>
                  <option value="revisar_consultor">Solicitou falar c/ consultor</option>
                  <option value="abandonados">Abandonados / Em andamento</option>
                </select>
                <select
                  value={selectedTplId}
                  onChange={(e) => setSelectedTplId(e.target.value)}
                  aria-label="Selecionar modelo de mensagem"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 dark:text-slate-100 max-w-[240px]"
                >
                  {messageTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      WhatsApp: {t.titulo}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleSyncFollowUps()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap disabled:opacity-50"
                >
                  <BellPlus className="w-3.5 h-3.5 text-[var(--color-primary)] dark:text-sky-400" />
                  Sincronizar Follow-ups
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportToCSV(
                      'leads-dm-integra',
                      ['Nome', 'E-mail', 'WhatsApp', 'Origem', 'UTM', 'Conclusão', 'Prioridade', 'Temperatura', 'Confiança', 'Funil', 'Subcategoria', 'Nota', 'Versão Regras', 'Data'],
                      filtered.map((l) => [
                        l.nome,
                        l.email,
                        l.whatsapp,
                        l.origem,
                        [l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join('/'),
                        l.statusConclusao || 'Concluído',
                        l.prioridade,
                        l.temperatura || '',
                        l.confianca || '',
                        l.statusFunil,
                        l.subcategoriaSugerida,
                        l.notaViabilidade,
                        l.versaoRegras || '',
                        formatDateBR(l.createdAt),
                      ]),
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar CSV
                </button>
              </div>
            )}

            {selectedLeadIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">{selectedLeadIds.length} lead(s) selecionado(s)</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busyAction}
                    onClick={() => void handleRecalculateSelected()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-white font-semibold whitespace-nowrap shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Recalcular selecionados com regras {activeRules.versao}
                  </button>
                  {role === 'admin' && (
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={requestBulkDeleteLeads}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/40 text-[#C82333] dark:text-red-400 font-semibold whitespace-nowrap shrink-0 hover:bg-red-100/80 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir selecionados
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {view === 'lista' ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
              {filtered.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum lead encontrado.</div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/70">
                      <th className="py-3 px-3">
                        <input
                          type="checkbox"
                          aria-label="Selecionar todos"
                          checked={filtered.length > 0 && filtered.every((l) => selectedLeadIds.includes(l.id))}
                          onChange={(e) =>
                            setSelectedLeadIds(e.target.checked ? filtered.map((l) => l.id) : [])
                          }
                        />
                      </th>
                      <th className="py-3 px-3 font-semibold">Lead &amp; Origem</th>
                      <th className="py-3 px-3 font-semibold">Subcategoria sugerida</th>
                      <th className="py-3 px-3 font-semibold">Nota / Confiança</th>
                      <th className="py-3 px-3 font-semibold">Prioridade / Funil</th>
                      <th className="py-3 px-3 font-semibold">Data</th>
                      <th className="py-3 px-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filtered.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-3">
                          <input
                            type="checkbox"
                            aria-label={`Selecionar ${l.nome}`}
                            checked={selectedLeadIds.includes(l.id)}
                            onChange={() => toggleSelect(l.id)}
                          />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{l.nome}</p>
                            {l.statusConclusao && l.statusConclusao !== 'Concluído' && (
                              <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                {l.statusConclusao} (Et. {l.etapaAtual || 1})
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {l.email} · {l.whatsapp} · {l.origem}
                            {l.utmCampaign ? ` · UTM: ${l.utmCampaign}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">
                          <p>{l.subcategoriaSugerida || l.interesse || '—'}</p>
                          {l.versaoRegras && <p className="text-[11px] text-slate-400 dark:text-slate-500">Regras {l.versaoRegras}</p>}
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                            {typeof l.notaViabilidade === 'number' ? `${l.notaViabilidade}/100` : '—'}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {l.confianca ? `Confiança ${l.confianca}` : '—'} {l.temperatura ? `· ${l.temperatura}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-3 space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded border text-[11px] font-semibold ${getPriorityBadge(l.prioridade)}`}>
                            {l.prioridade}
                          </span>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{l.statusFunil}</p>
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500 dark:text-slate-400 tabular-nums">{formatDateBR(l.createdAt)}</td>
                        <td className="py-3 px-3 text-right space-x-1 whitespace-nowrap">
                          {l.respostasTriagem && (
                            <button
                              type="button"
                              onClick={() => openInspectModal(l)}
                              title="Analisar diagnóstico e simular cenário E se"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Analisar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleSendTemplate(l)}
                            title="Usar modelo no WhatsApp"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1E7E34] text-white text-xs font-medium"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </button>
                          {l.convertedCaseId ? (
                            <button
                              type="button"
                              onClick={() => onOpenCase(l.convertedCaseId!)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                            >
                              Ver Caso
                            </button>
                          ) : (role === 'admin' || role === 'consultor') && (
                            <button
                              type="button"
                              disabled={convertingId === l.id}
                              onClick={() => void handleConvert(l)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white text-xs font-semibold"
                              style={{ backgroundColor: 'var(--color-primary)' }}
                            >
                              <ArrowRightCircle className="w-3.5 h-3.5" />
                              {convertingId === l.id ? 'Convertendo...' : 'Converter'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingLead(l)}
                            aria-label={`Editar ${l.nome}`}
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => requestDeleteLead(l)}
                              aria-label={`Excluir ${l.nome}`}
                              className="p-1.5 rounded-lg border border-red-200 dark:border-red-800/70 text-[#C82333] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <PainelLeadsKanban
              leads={filtered}
              role={role}
              selectedLeadIds={selectedLeadIds}
              convertingId={convertingId}
              movingLeadId={movingLeadId}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
              onToggleSelect={toggleSelect}
              onMoveStage={handleMoveLeadStage}
              onQuickUpdateLead={handleQuickUpdateLead}
              onInspectLead={openInspectModal}
              onEditLead={setEditingLead}
              onDeleteLead={role === 'admin' ? requestDeleteLead : undefined}
              onSendWhatsApp={handleSendTemplate}
              onConvertLead={handleConvert}
              onOpenCase={onOpenCase}
            />
          )}
        </>
      )}

      {/* Modal de Análise Completa & Simulador "E se" */}
      {inspectingLead && inspectedResult && inspectingLead.respostasTriagem && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 flex items-start justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-[var(--color-bg)] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-6xl w-full p-5 sm:p-8 my-6 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-[var(--color-primary)] dark:text-sky-400" />
                  Diagnóstico Completo — {inspectingLead.nome}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectingLead.email} · {inspectingLead.whatsapp} · Versão {inspectingLead.versaoRegras || activeRules.versao}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => requestDeleteLead(inspectingLead)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800/70 bg-white dark:bg-slate-800 text-xs font-semibold text-[#C82333] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleExportLeadLgpd(inspectingLead)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Exportar LGPD (JSON)
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingLead(null)}
                  aria-label="Fechar análise"
                  className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Fluxo Rápido do Lead: avançar etapas ou converter em Processo em 1 clique */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Fluxo do Lead · Etapa atual: <strong className="text-slate-900 dark:text-slate-100">{inspectingLead.statusFunil}</strong>
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  {(['Novo', 'Contatado', 'Diagnóstico Agendado', 'Orçamento Enviado', 'Fechado'] as Lead['statusFunil'][]).map((st) => {
                    const active = inspectingLead.statusFunil === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={movingLeadId === inspectingLead.id}
                        onClick={async () => {
                          await handleMoveLeadStage(inspectingLead, st);
                          setInspectingLead((prev) => (prev ? { ...prev, statusFunil: st } : prev));
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleSendTemplate(inspectingLead)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700/70 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 text-xs font-semibold hover:bg-emerald-100/70 whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
                {inspectingLead.convertedCaseId ? (
                  <button
                    type="button"
                    onClick={() => {
                      const cid = inspectingLead.convertedCaseId!;
                      setInspectingLead(null);
                      onOpenCase(cid);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                    style={{ backgroundColor: '#1E7E34' }}
                  >
                    Abrir Processo
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                  </button>
                ) : (role === 'admin' || role === 'consultor') ? (
                  <button
                    type="button"
                    disabled={convertingId === inspectingLead.id}
                    onClick={() => void handleConvert(inspectingLead)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                    style={{ backgroundColor: '#1E7E34' }}
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    {convertingId === inspectingLead.id ? 'Abrindo Processo...' : 'Converter em Processo (1 clique)'}
                  </button>
                ) : null}
              </div>
            </div>

            {role === 'admin' ? (
              <DiagnosticReportView
                mode="consultant"
                result={inspectedResult}
                answers={inspectingLead.respostasTriagem}
                empresa={empresa}
                hideCosts={false}
                savedLeadId={inspectingLead.id}
                aiDraft={aiDraft}
                aiLoading={aiLoading}
                aiProgress={aiProgress}
                aiError={aiError}
                onRefineAi={() => void handleRefineInspectAi()}
                onUpdateAiDraft={(next) => {
                  setAiDraft(next);
                  if (inspectingLead) saveAiDraftCache(`diagnostico_lead_${inspectingLead.id}`, next);
                }}
                onOpenLaw={() => setLawModalOpen(true)}
                onLogWhatsApp={async (assunto, msg) => {
                  await onLogWhatsApp(inspectingLead.convertedClientId, inspectingLead.convertedCaseId, assunto, msg);
                }}
                whatIfAnswers={whatIfAnswers}
                whatIfComparison={whatIfComparison}
                onChangeWhatIf={setWhatIfAnswers}
                onResetWhatIf={() =>
                  setWhatIfAnswers(inspectingLead.respostasTriagem ? { ...inspectingLead.respostasTriagem } : null)
                }
                leadHistory={inspectingLead.historicoResultados}
              />
            ) : (
              <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-6 space-y-4">
                <div className="space-y-1">
                  <p className="brand-kicker">Acesso Restrito ao Administrador</p>
                  <h3 className="text-lg font-bold text-[#0B1F33] dark:text-slate-100">
                    Resumo básico do diagnóstico — {inspectingLead.nome}
                  </h3>
                  <p className="text-xs text-[#4A5A6D] dark:text-slate-400 leading-relaxed">
                    O relatório técnico completo (pontuação detalhada, subcategorias SERMIG, plano de ação documental, custos e simulador de cenários) é de acesso exclusivo do perfil Administrador.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] text-xs">
                  <div>
                    <p className="text-[#4A5A6D] dark:text-slate-400">Protocolo</p>
                    <p className="font-semibold text-[#0B1F33] dark:text-slate-100 mt-0.5 tabular-nums">{inspectingLead.id}</p>
                  </div>
                  <div>
                    <p className="text-[#4A5A6D] dark:text-slate-400">Contato do cliente</p>
                    <p className="font-semibold text-[#0B1F33] dark:text-slate-100 mt-0.5">{inspectingLead.whatsapp || inspectingLead.email}</p>
                  </div>
                  <div>
                    <p className="text-[#4A5A6D] dark:text-slate-400">Status do atendimento</p>
                    <p className="font-semibold text-[#0B1F33] dark:text-slate-100 mt-0.5">{inspectingLead.statusFunil || 'Novo'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {lawModalOpen && inspectedResult && (
        <LegalBaseModal open={lawModalOpen} onClose={() => setLawModalOpen(false)} sources={inspectedResult.fontesLegais} />
      )}

      {/* Modal Editar Lead */}
      {editingLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveEdit} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Editar Lead: {editingLead.nome}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status no funil</label>
                <select
                  value={editingLead.statusFunil}
                  onChange={(e) => setEditingLead({ ...editingLead, statusFunil: e.target.value as Lead['statusFunil'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                >
                  {FUNIL_STAGES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Prioridade</label>
                <select
                  value={editingLead.prioridade}
                  onChange={(e) => setEditingLead({ ...editingLead, prioridade: e.target.value as Lead['prioridade'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="Urgente">Urgente</option>
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </div>
            </div>
            {editingLead.statusFunil === 'Perdido' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Motivo da perda</label>
                <input
                  value={editingLead.motivoPerda || ''}
                  onChange={(e) => setEditingLead({ ...editingLead, motivoPerda: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notas internas</label>
              <textarea
                rows={3}
                value={editingLead.notas || ''}
                onChange={(e) => setEditingLead({ ...editingLead, notas: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 text-sm"
              />
            </div>
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportLeadLgpd(editingLead)}
                  className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Exportar LGPD
                </button>
                {role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => requestDeleteLead(editingLead)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800/70 text-xs font-semibold text-[#C82333] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Salvar alterações
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Novo Lead Rápido */}
      {quickLeadOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 flex items-center justify-center p-4">
          <form
            onSubmit={(e) => void handleCreateQuickLead(e)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Novo Lead Rápido</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cadastre um contato recebido por WhatsApp, Instagram ou indicação em segundos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickLeadOpen(false)}
                aria-label="Fechar"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {quickLeadError && (
              <p className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
                {quickLeadError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="space-y-1 sm:col-span-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Nome completo *</span>
                <input
                  type="text"
                  required
                  value={quickLeadForm.nome}
                  onChange={(e) => setQuickLeadForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex.: Mariana Silva"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">WhatsApp *</span>
                <input
                  type="text"
                  required
                  value={quickLeadForm.whatsapp}
                  onChange={(e) => setQuickLeadForm((p) => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="+55 11 99999-9999"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">E-mail *</span>
                <input
                  type="email"
                  required
                  value={quickLeadForm.email}
                  onChange={(e) => setQuickLeadForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="nome@email.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Origem</span>
                <select
                  value={quickLeadForm.origem}
                  onChange={(e) => setQuickLeadForm((p) => ({ ...p, origem: e.target.value as Lead['origem'] }))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Instagram">Instagram</option>
                  <option value="Indicação">Indicação</option>
                  <option value="Site">Site</option>
                  <option value="Parceiro">Parceiro</option>
                  <option value="Outro">Outro</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Prioridade</span>
                <select
                  value={quickLeadForm.prioridade}
                  onChange={(e) =>
                    setQuickLeadForm((p) => ({ ...p, prioridade: e.target.value as Lead['prioridade'] }))
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="Urgente">Urgente</option>
                  <option value="Alta">Alta</option>
                  <option value="Média">Média</option>
                  <option value="Baixa">Baixa</option>
                </select>
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Interesse / Visto</span>
                <input
                  type="text"
                  value={quickLeadForm.interesse}
                  onChange={(e) => setQuickLeadForm((p) => ({ ...p, interesse: e.target.value }))}
                  placeholder="Ex.: Residência Mercosul, Trabalho, Reunificação Familiar"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>
              <label className="space-y-1 sm:col-span-2">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Observações (opcional)</span>
                <textarea
                  rows={2}
                  value={quickLeadForm.notas}
                  onChange={(e) => setQuickLeadForm((p) => ({ ...p, notas: e.target.value }))}
                  placeholder="Contexto rápido do atendimento..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickLeadOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={quickLeadSaving}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {quickLeadSaving ? 'Salvando...' : 'Salvar Lead'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmActionModal
        open={Boolean(confirmModal)}
        title={confirmModal?.title || 'Confirmar'}
        description={confirmModal?.description || ''}
        details={confirmModal?.details}
        confirmLabel={confirmModal?.confirmLabel}
        onConfirm={async () => {
          if (confirmModal) await confirmModal.onConfirm();
        }}
        onClose={() => setConfirmModal(null)}
      />
    </div>
  );
};
