import React, { Suspense, lazy, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Copy,
  Download,
  FileSignature,
  FileWarning,
  MessageCircle,
  Scale,
  Search,
  ShieldCheck,
  UserPlus,
  X,
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
  GeneratedDocument,
  Lead,
  LegalSource,
  Task,
  UserProfile,
  UserRole,
  VisaRequirement,
} from '../../types/domain';
import { calcularTermometroDocumentos, calcularUrgencias } from '../../utils/caseMetrics';
import { buildContractSignatureRows, computeContractSignatureMetrics } from '../../utils/contractSignatureStatus';
import { countUnreadChatForStaff, getPendingClientChatThreads } from '../../utils/documentChat';
import { buildWhatsAppUrl, formatCurrency, formatDateBR, formatDateTimeBR, openExternalSafe, toIsoDate } from '../../utils/formatters';
import { computeUnifiedFunnelMetrics, type MacroFunnelStageId } from '../../utils/funnelModel';
import type { FunnelPerformancePeriod } from '../../utils/funnelPerformanceModel';
import { countLegalReviewPending } from '../../utils/legalSync';
import {
  buildDailyExecutiveBriefingText,
  buildDailyUrgenciesCsv,
  computeOperationalHealth,
  filterPendingDocsByQuery,
  filterTasksByQuery,
  filterUrgenciesByQuery,
  formatExecutiveDateBR,
  getExecutiveGreeting,
} from '../../utils/panelInsights';
import { computeDailyPrioritySummary, type LegacyPanelSection } from '../../utils/panelNavigation';
import { PainelFunnelPerformanceSummary } from './PainelFunnelPerformanceSummary';
import { PainelLembretesVencimento } from './PainelLembretesVencimento';

const PainelAnalyticsRecharts = lazy(() =>
  import('./PainelAnalyticsRecharts').then((m) => ({ default: m.PainelAnalyticsRecharts })),
);
const PainelFunnelConversionChart = lazy(() =>
  import('./PainelFunnelConversionChart').then((m) => ({ default: m.PainelFunnelConversionChart })),
);
const PainelProgressoTarefasChart = lazy(() =>
  import('./PainelProgressoTarefasChart').then((m) => ({ default: m.PainelProgressoTarefasChart })),
);

const ChartSkeletonFallback: React.FC = () => (
  <div className="rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] p-6 space-y-3">
    <div className="h-4 w-48 rounded bg-[#EFECE4] dark:bg-[#142942]" />
    <div className="h-56 w-full rounded-lg bg-[#FAF9F6] dark:bg-[#11263D]" />
  </div>
);

interface PainelDashboardProps {
  role: UserRole;
  userName?: string;
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
  generatedDocuments?: GeneratedDocument[];
  communicationLogs?: CommunicationLog[];
  legalSources?: LegalSource[];
  visaRequirements?: VisaRequirement[];
  staffUsers?: UserProfile[];
  diasAlertaRevisaoLegal?: number;
  brandName?: string;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
  onEmailLogsCreated?: (logs: CommunicationLog[]) => void;
  onOpenCase: (caseId: string, targetTab?: 'resumo' | 'comunicacao') => void;
  onOpenChecklist?: (caseId?: string) => void;
  onOpenFunnelStage?: (stageId: MacroFunnelStageId) => void;
  onToggleTask?: (task: Task) => Promise<void>;
  onNavigateSection?: (section: LegacyPanelSection) => void;
  onQuickCreate?: (action: 'new_case' | 'new_client' | 'agenda' | 'contratos' | 'financeiro') => void;
}

type DailyWorkTab = 'hoje' | 'documentos' | 'chat' | 'relatorio';

export const PainelDashboard: React.FC<PainelDashboardProps> = ({
  role,
  userName,
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
  generatedDocuments = [],
  communicationLogs = [],
  legalSources = [],
  visaRequirements = [],
  staffUsers = [],
  diasAlertaRevisaoLegal = 90,
  brandName,
  onLogWhatsApp,
  onEmailLogsCreated,
  onOpenCase,
  onOpenChecklist,
  onOpenFunnelStage,
  onToggleTask,
  onNavigateSection,
  onQuickCreate,
}) => {
  const [workTab, setWorkTab] = useState<DailyWorkTab>('hoje');
  const [filterOrigem, setFilterOrigem] = useState('Todas');
  const [perfPeriod, setPerfPeriod] = useState<FunnelPerformancePeriod>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<'todas' | 'Critica' | 'Alta' | 'Media'>('todas');
  const [queueSearch, setQueueSearch] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [briefingCopied, setBriefingCopied] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const isAssistente = role === 'assistente';

  const nowDate = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => toIsoDate(nowDate), [nowDate]);
  const executiveGreeting = useMemo(() => getExecutiveGreeting(nowDate.getHours(), userName), [nowDate, userName]);
  const executiveDateLabel = useMemo(() => formatExecutiveDateBR(nowDate), [nowDate]);

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

  const filteredUrgencias = useMemo(() => {
    const bySeverity =
      urgencyFilter === 'todas' ? urgencias : urgencias.filter((u) => u.severidade === urgencyFilter);
    return filterUrgenciesByQuery(bySeverity, queueSearch);
  }, [urgencias, urgencyFilter, queueSearch]);

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
      filterTasksByQuery(
        tasks
          .filter((t) => t.status !== 'Concluída')
          .sort((a, b) => (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31')),
        queueSearch,
      ).slice(0, 8),
    [tasks, queueSearch],
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

  const filteredPendingDocsReview = useMemo(
    () => filterPendingDocsByQuery(pendingDocsReview, docSearch),
    [pendingDocsReview, docSearch],
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

  const contractSignatureOverview = useMemo(() => {
    const rows = buildContractSignatureRows(generatedDocuments, clients, cases);
    const metrics = computeContractSignatureMetrics(rows);
    const latestPending = rows.find((r) => r.isPending) || null;
    return { metrics, latestPending };
  }, [generatedDocuments, clients, cases]);

  const operationalHealth = useMemo(
    () =>
      computeOperationalHealth({
        deadlines,
        avgDocsPct: avgThermometer,
        criticalUrgenciesCount: dailySummary.criticalUrgenciesCount,
        pendingSignaturesCount: isAssistente ? 0 : contractSignatureOverview.metrics.pendentes,
        pendingDocsCount: pendingDocsReview.length,
        referenceDate: nowDate,
      }),
    [
      deadlines,
      avgThermometer,
      dailySummary.criticalUrgenciesCount,
      isAssistente,
      contractSignatureOverview.metrics.pendentes,
      pendingDocsReview.length,
      nowDate,
    ],
  );

  const handleCopyDailyBriefing = async () => {
    const text = buildDailyExecutiveBriefingText({
      brandName: brandName || empresa.nome_empresa,
      dateLabel: executiveDateLabel,
      role,
      activeCasesCount: activeCases.length,
      activeClientsCount: activeClients.length,
      avgDocsPct: avgThermometer,
      urgencias,
      openTasksCount: dailySummary.openTasksCount,
      pendingDocsCount: pendingDocsReview.length,
      unreadChatCount: unreadChatTotal,
      pendingSignaturesCount: contractSignatureOverview.metrics.pendentes,
      receitaBrl: isAssistente ? undefined : receitaTotalBrl,
      inadimplenciaBrl: isAssistente ? undefined : inadimplenciaBrl,
      health: operationalHealth,
    });
    try {
      await navigator.clipboard.writeText(text);
      setBriefingCopied(true);
      setTimeout(() => setBriefingCopied(false), 2200);
    } catch {
      // Fallback para ambientes sem clipboard API
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setBriefingCopied(true);
      setTimeout(() => setBriefingCopied(false), 2200);
    }
  };

  const handleExportDailyCsv = () => {
    const csv = buildDailyUrgenciesCsv(urgencias, tasks);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `prioridades-operacionais-${todayIso}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleNotifyUrgency = async (u: (typeof urgencias)[number]) => {
    const text = `Olá${u.clientNome ? `, ${u.clientNome}` : ''}! Alerta operacional D&M Integra Chile: ${u.titulo} — ${u.detalhe} (Data ref.: ${u.dataReferenciaBR}).`;
    if (u.clientWhatsapp) {
      openExternalSafe(buildWhatsAppUrl(u.clientWhatsapp, text));
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
      {/* Cabeçalho executivo com saudação, pulso SLA e exportação rápida */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            <span className="font-semibold text-[#8C6D14] dark:text-[#E5C76B]">{executiveDateLabel}</span>
            <span aria-hidden="true" className="text-[#C5BCB0] dark:text-[#2A4666]">·</span>
            <span
              className={`inline-flex items-center gap-1.5 font-semibold tabular-nums ${
                operationalHealth.status === 'critico'
                  ? 'text-[#C82333] dark:text-red-400'
                  : operationalHealth.status === 'atencao'
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-[#1E7E34] dark:text-emerald-400'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              {operationalHealth.label}
            </span>
            <span aria-hidden="true" className="text-[#C5BCB0] dark:text-[#2A4666] hidden sm:inline">·</span>
            <span className="text-[#4A5A6D] dark:text-slate-400 tabular-nums hidden sm:inline">
              {operationalHealth.summaryLine}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-[26px] font-bold tracking-tight text-[#0B1F33] dark:text-slate-100 leading-tight">
            {executiveGreeting}
          </h1>
          <p className="text-sm text-[#4A5A6D] dark:text-slate-400 leading-snug">
            <strong className="font-semibold text-[#0B1F33] dark:text-slate-200">{dailySummary.recommendedAction.label}:</strong>{' '}
            {dailySummary.recommendedAction.detail}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
          <select
            value={filterOrigem}
            onChange={(e) => setFilterOrigem(e.target.value)}
            aria-label="Filtrar métricas por origem de leads"
            className="min-w-0 max-w-full px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-medium text-[#0B1F33] dark:text-slate-200"
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
            onClick={() => void handleCopyDailyBriefing()}
            title="Copiar resumo operacional do dia para WhatsApp ou relatório"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#142942] whitespace-nowrap shrink-0 transition-colors"
          >
            {briefingCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#1E7E34] dark:text-emerald-400" />
                <span>Resumo copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
                <span>Copiar Resumo</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportDailyCsv}
            title="Baixar lista de urgências e tarefas em aberto em CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#142942] whitespace-nowrap shrink-0 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-[#4A5A6D] dark:text-slate-400" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <button
            type="button"
            onClick={handleRecommendedClick}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-opacity hover:opacity-95 shadow-[0_2px_8px_rgba(11,31,51,0.16)]"
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

      {/* Faixa compacta de Ações Rápidas da Consultoria */}
      <section aria-label="Atalhos operacionais rápidos" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 no-print">
        <button
          type="button"
          onClick={() => (onQuickCreate ? onQuickCreate('new_case') : onNavigateSection?.('casos'))}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] hover:border-[#C8A236]/80 text-left transition-colors"
        >
          <Briefcase className="w-4 h-4 text-[#0B1F33] dark:text-[#E5C76B] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-100 truncate">Novo Processo</p>
            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 truncate">Visto e RUT</p>
          </div>
        </button>

        {!isAssistente && (
          <button
            type="button"
            onClick={() => (onQuickCreate ? onQuickCreate('new_client') : onNavigateSection?.('clientes'))}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] hover:border-[#C8A236]/80 text-left transition-colors"
          >
            <UserPlus className="w-4 h-4 text-[#0B1F33] dark:text-[#E5C76B] shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-100 truncate">Novo Cliente</p>
              <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 truncate">CRM &amp; Portal</p>
            </div>
          </button>
        )}

        {!isAssistente && (
          <button
            type="button"
            onClick={() => onNavigateSection?.('assinaturas')}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] hover:border-[#C8A236]/80 text-left transition-colors"
          >
            <FileSignature className="w-4 h-4 text-[#0F3D91] dark:text-sky-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-100 truncate">Assinaturas</p>
              <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 tabular-nums truncate">
                {contractSignatureOverview.metrics.pendentes > 0
                  ? `${contractSignatureOverview.metrics.pendentes} pendente(s)`
                  : `${contractSignatureOverview.metrics.assinados} assinado(s)`}
              </p>
            </div>
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigateSection?.('checklist')}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] hover:border-[#C8A236]/80 text-left transition-colors"
        >
          <ClipboardCheck className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-100 truncate">Checklist Docs</p>
            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 tabular-nums truncate">
              {pendingDocsReview.length} p/ conferir
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection?.('agenda')}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] hover:border-[#C8A236]/80 text-left transition-colors"
        >
          <Calendar className="w-4 h-4 text-[#1E7E34] dark:text-emerald-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-100 truncate">Agenda &amp; Prazos</p>
            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 tabular-nums truncate">
              {appointmentsToday.length} hoje · {dailySummary.openTasksCount} tarefa(s)
            </p>
          </div>
        </button>
      </section>

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

      {/* Acompanhamento rápido de contratos pendentes de assinatura */}
      {!isAssistente && contractSignatureOverview.metrics.pendentes > 0 && onNavigateSection && (
        <div className="rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_1px_2px_rgba(11,31,51,0.03)]">
          <div className="flex items-start sm:items-center gap-2.5 text-xs text-[#0B1F33] dark:text-slate-200 min-w-0">
            <FileSignature className="w-4 h-4 text-[#0F3D91] dark:text-sky-400 shrink-0 mt-0.5 sm:mt-0" />
            <div className="min-w-0">
              <p className="leading-snug">
                <strong className="font-semibold text-[#0B1F33] dark:text-slate-100 tabular-nums">
                  {contractSignatureOverview.metrics.pendentes} contrato(s) pendente(s) de assinatura
                </strong>
                {contractSignatureOverview.metrics.assinados > 0 && (
                  <span className="text-[#4A5A6D] dark:text-slate-400 tabular-nums">
                    {' '}· {contractSignatureOverview.metrics.assinados} assinado(s) ({contractSignatureOverview.metrics.taxaAssinaturaPct}%)
                  </span>
                )}
              </p>
              {contractSignatureOverview.latestPending && (
                <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 tabular-nums mt-0.5 truncate">
                  Última interação: {contractSignatureOverview.latestPending.clientName} — {contractSignatureOverview.latestPending.lastInteractionLabel} ({formatDateTimeBR(contractSignatureOverview.latestPending.lastInteractionAt)})
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection('assinaturas')}
            className="text-xs font-semibold text-[#0F3D91] dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            Ver Status de Assinaturas →
          </button>
        </div>
      )}

      {/* 4 Indicadores Principais (Superfície executiva, 1px hairline, tabular-nums) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => onNavigateSection?.('casos')}
          className="min-w-0 text-left bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-4 hover:border-[#C8A236]/75 hover:shadow-[0_4px_14px_rgba(11,31,51,0.06)] transition-all duration-150 shadow-[0_1px_2px_rgba(11,31,51,0.03)]"
        >
          <p className="text-xs font-medium text-[#4A5A6D] dark:text-slate-400">Processos ativos</p>
          <p className="text-2xl font-bold tracking-tight text-[#0B1F33] dark:text-slate-100 mt-1.5 tabular-nums">
            {activeCases.length}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-[#EFECE4] dark:bg-[#142942] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, Math.max(4, avgThermometer))}%`, backgroundColor: 'var(--color-primary)' }}
            />
          </div>
          <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-1.5 tabular-nums leading-snug">
            {activeClients.length} clientes · Prontidão docs {avgThermometer}%
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setWorkTab('hoje');
            setUrgencyFilter('todas');
          }}
          className="min-w-0 text-left bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-4 hover:border-[#C8A236]/75 hover:shadow-[0_4px_14px_rgba(11,31,51,0.06)] transition-all duration-150 shadow-[0_1px_2px_rgba(11,31,51,0.03)]"
        >
          <p className="text-xs font-medium text-[#4A5A6D] dark:text-slate-400">Urgências &amp; Prazos</p>
          <p
            className="text-2xl font-bold tracking-tight mt-1.5 tabular-nums"
            style={{ color: urgencias.length > 0 ? '#C82333' : '#1E7E34' }}
          >
            {urgencias.length}
          </p>
          <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-2 tabular-nums leading-snug">
            {dailySummary.criticalUrgenciesCount} crítica(s) · SLA {operationalHealth.slaCompliancePct}%
          </p>
        </button>

        <button
          type="button"
          onClick={() => setWorkTab('documentos')}
          className="min-w-0 text-left bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-4 hover:border-[#C8A236]/75 hover:shadow-[0_4px_14px_rgba(11,31,51,0.06)] transition-all duration-150 shadow-[0_1px_2px_rgba(11,31,51,0.03)]"
        >
          <p className="text-xs font-medium text-[#4A5A6D] dark:text-slate-400">Docs para conferir</p>
          <p className="text-2xl font-bold tracking-tight text-[#0B1F33] dark:text-slate-100 mt-1.5 tabular-nums">
            {pendingDocsReview.length}
          </p>
          <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-2 tabular-nums leading-snug">
            {dailySummary.newLeadsCount} lead(s) novo(s) · {unreadChatTotal} chat(s)
          </p>
        </button>

        {!isAssistente ? (
          <button
            type="button"
            onClick={() => onNavigateSection?.('financeiro')}
            className="min-w-0 text-left bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-4 hover:border-[#C8A236]/75 hover:shadow-[0_4px_14px_rgba(11,31,51,0.06)] transition-all duration-150 shadow-[0_1px_2px_rgba(11,31,51,0.03)]"
          >
            <p className="text-xs font-medium text-[#4A5A6D] dark:text-slate-400">Recebido (BRL)</p>
            <p className="text-xl sm:text-2xl font-bold tracking-tight text-[#1E7E34] dark:text-emerald-400 mt-1.5 tabular-nums break-words">
              {formatCurrency(receitaTotalBrl, 'BRL')}
            </p>
            <p className="text-xs text-[#C82333] dark:text-red-400 mt-2 tabular-nums leading-snug break-words">
              Em atraso: {formatCurrency(inadimplenciaBrl, 'BRL')}
            </p>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigateSection?.('agenda')}
            className="min-w-0 text-left bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-4 hover:border-[#C8A236]/75 hover:shadow-[0_4px_14px_rgba(11,31,51,0.06)] transition-all duration-150 shadow-[0_1px_2px_rgba(11,31,51,0.03)]"
          >
            <p className="text-xs font-medium text-[#4A5A6D] dark:text-slate-400">Agenda de hoje</p>
            <p className="text-2xl font-bold tracking-tight text-[#0B1F33] dark:text-slate-100 mt-1.5 tabular-nums">
              {appointmentsToday.length}
            </p>
            <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-2 tabular-nums leading-snug">
              {dailySummary.openTasksCount} tarefa(s) em aberto
            </p>
          </button>
        )}
      </div>

      {/* Funil Interativo em 5 Marcos: clique em qualquer marco para ir direto aos registros */}
      <section className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(11,31,51,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#0B1F33] dark:text-slate-100">
              Fluxo Operacional em 5 Marcos
            </h2>
            <p className="text-xs text-[#4A5A6D] dark:text-slate-400">
              Clique em uma etapa para abrir diretamente os leads ou processos naquele momento
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums text-[#4A5A6D] dark:text-slate-300">
            <span>
              Conversão: <strong className="text-[#0B1F33] dark:text-slate-100">{unifiedFunnel.commercialConversionPct}%</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Conclusão: <strong className="text-[#1E7E34] dark:text-emerald-400">{unifiedFunnel.completionRatePct}%</strong>
            </span>
            {onNavigateSection && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onNavigateSection('funil')}
                  className="font-semibold text-[var(--color-primary)] dark:text-[#E5C76B] hover:underline whitespace-nowrap"
                >
                  Abrir Quadro Kanban →
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
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
                className="min-w-0 text-left p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 transition-colors flex flex-col justify-between gap-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-snug break-words">
                    {item.stage.ordem}. {item.stage.nome}
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0 leading-none">
                    {item.totalCount}
                  </span>
                </div>
                <div className="space-y-1.5">
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
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug tabular-nums">
                    {isBottleneck
                      ? 'Maior volume atual'
                      : item.conversionFromPrevPct !== null
                        ? `${item.conversionFromPrevPct}% avanço da anterior`
                        : `${item.leadsCount} lead(s) ativos`}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Painel Estatístico Recharts: Diagnósticos/Mês, Taxa de Conversão e Perfis Migratórios */}
      <Suspense fallback={<ChartSkeletonFallback />}>
        <PainelAnalyticsRecharts
          leads={filteredLeads}
          clients={clients}
          cases={cases}
          isDark={isDark}
          onNavigateSection={onNavigateSection}
        />
      </Suspense>

      {/* Fila de Trabalho Unificada em 4 Abas Práticas */}
      <section className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(11,31,51,0.04)]">
        <div
          role="tablist"
          aria-label="Fila de trabalho diária"
          className="flex items-center gap-1 overflow-x-auto px-4 pt-3 border-b border-[#E5DFD2] dark:border-[#1C324B]"
        >
          {(
            [
              { id: 'hoje', label: 'Atenção Hoje', count: urgencias.length + dailySummary.openTasksCount },
              { id: 'documentos', label: 'Docs & Vencimentos', count: pendingDocsReview.length },
              { id: 'chat', label: 'Dúvidas do Portal', count: unreadChatTotal },
              { id: 'relatorio', label: 'Métricas & Gráficos', count: undefined },
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
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] dark:text-[#E5C76B] dark:border-[#E5C76B]'
                    : 'border-transparent text-[#4A5A6D] dark:text-slate-400 hover:text-[#0B1F33] dark:hover:text-slate-200'
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
            <div className="space-y-4">
              {/* Filtro rápido de busca na fila diária */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(e) => setQueueSearch(e.target.value)}
                    placeholder="Filtrar urgências e tarefas por cliente, visto ou prazo..."
                    aria-label="Filtrar fila de atenção hoje"
                    className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#11263D] text-xs text-[#0B1F33] dark:text-slate-100 placeholder:text-[#4A5A6D] dark:placeholder:text-slate-400 focus:outline-none focus:border-[#C8A236]"
                  />
                  {queueSearch && (
                    <button
                      type="button"
                      onClick={() => setQueueSearch('')}
                      aria-label="Limpar busca da fila diária"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#4A5A6D] hover:text-[#0B1F33] dark:text-slate-400 dark:hover:text-slate-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="inline-flex items-center p-0.5 bg-[#EFECE4] dark:bg-[#11263D] rounded-lg text-[11px] font-semibold w-fit">
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
                      className={`px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums transition-colors ${
                        urgencyFilter === opt.id
                          ? 'bg-white dark:bg-[#0D1E31] text-[#0B1F33] dark:text-slate-100 shadow-xs'
                          : 'text-[#4A5A6D] dark:text-slate-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-3">
                <h3 className="text-sm font-bold text-[#0B1F33] dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#C82333]" />
                  Urgências e Prazos Críticos ({filteredUrgencias.length})
                </h3>

                {filteredUrgencias.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6]/70 dark:bg-[#11263D]/40 p-5 text-center space-y-2.5">
                    <p className="text-xs font-medium text-[#4A5A6D] dark:text-slate-300">
                      {queueSearch || urgencyFilter !== 'todas'
                        ? 'Nenhuma urgência encontrada para os filtros aplicados.'
                        : 'Nenhuma urgência pendente no momento. Prazos sob controle.'}
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {(queueSearch || urgencyFilter !== 'todas') ? (
                        <button
                          type="button"
                          onClick={() => {
                            setQueueSearch('');
                            setUrgencyFilter('todas');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#142942]"
                        >
                          Limpar filtros
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigateSection?.('casos')}
                          className="px-3 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#142942]"
                        >
                          Ver Processos Ativos →
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-[#F1EDE4] dark:divide-[#1C324B]">
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
                        <div className="flex flex-wrap items-center gap-2">
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                    <div className="rounded-lg border border-dashed border-[#DDD6C7] dark:border-[#1C324B] p-3.5 text-center space-y-2">
                      <p className="text-xs text-[#4A5A6D] dark:text-slate-400">
                        {queueSearch ? 'Nenhuma tarefa compatível com a busca.' : 'Nenhuma tarefa em aberto.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigateSection?.('agenda')}
                        className="text-xs font-semibold text-[var(--color-primary)] dark:text-[#E5C76B] hover:underline"
                      >
                        + Nova tarefa na Agenda
                      </button>
                    </div>
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
                              <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug break-words" title={t.titulo}>{t.titulo}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
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
                    <div className="rounded-lg border border-dashed border-[#DDD6C7] dark:border-[#1C324B] p-3.5 text-center space-y-2">
                      <p className="text-xs text-[#4A5A6D] dark:text-slate-400">
                        Sem reuniões agendadas para {formatDateBR(todayIso)}.
                      </p>
                      <button
                        type="button"
                        onClick={() => onNavigateSection?.('agenda')}
                        className="text-xs font-semibold text-[var(--color-primary)] dark:text-[#E5C76B] hover:underline"
                      >
                        Agendar reunião
                      </button>
                    </div>
                  ) : (
                    <ul className="divide-y divide-[#F1EDE4] dark:divide-[#1C324B] text-xs">
                      {appointmentsToday.map((a) => (
                        <li key={a.id} className="py-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0B1F33] dark:text-slate-100 leading-snug break-words" title={a.titulo}>{a.titulo}</p>
                            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 tabular-nums mt-0.5">
                              {a.dataHoraInicio.slice(11, 16) || formatDateBR(a.dataHoraInicio)} · {a.tipo}
                            </p>
                          </div>
                          {a.caseId && (
                            <button
                              type="button"
                              onClick={() => onOpenCase(a.caseId!)}
                              className="text-[11px] font-semibold text-[var(--color-primary)] dark:text-[#E5C76B] hover:underline shrink-0"
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
            </div>
          )}

          {/* ABA 2: DOCS PARA CONFERIR + VENCIMENTOS < 30 DIAS */}
          {workTab === 'documentos' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-3 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#0B1F33] dark:text-slate-100 flex items-center gap-2">
                      <FileWarning className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                      Documentos Enviados Aguardando Conferência ({filteredPendingDocsReview.length})
                    </h3>
                    <button
                      type="button"
                      onClick={() => onNavigateSection?.('checklist')}
                      className="text-xs font-semibold text-[var(--color-primary)] dark:text-[#E5C76B] hover:underline whitespace-nowrap"
                    >
                      Ir para Checklist →
                    </button>
                  </div>

                  {pendingDocsReview.length > 0 && (
                    <div className="relative max-w-md">
                      <Search className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={docSearch}
                        onChange={(e) => setDocSearch(e.target.value)}
                        placeholder="Filtrar por nome do documento ou pessoa..."
                        aria-label="Filtrar documentos pendentes"
                        className="w-full pl-8 pr-8 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#11263D] text-xs text-[#0B1F33] dark:text-slate-100 placeholder:text-[#4A5A6D] dark:placeholder:text-slate-400 focus:outline-none focus:border-[#C8A236]"
                      />
                      {docSearch && (
                        <button
                          type="button"
                          onClick={() => setDocSearch('')}
                          aria-label="Limpar busca de documentos"
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-[#4A5A6D] hover:text-[#0B1F33] dark:text-slate-400 dark:hover:text-slate-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}

                  {filteredPendingDocsReview.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6]/70 dark:bg-[#11263D]/40 p-5 text-center space-y-2.5">
                      <p className="text-xs text-[#4A5A6D] dark:text-slate-300">
                        {docSearch
                          ? 'Nenhum documento compatível com o filtro informado.'
                          : 'Nenhum documento enviado aguardando triagem agora.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => (docSearch ? setDocSearch('') : onNavigateSection?.('checklist'))}
                        className="px-3 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#142942]"
                      >
                        {docSearch ? 'Limpar filtro' : 'Abrir Checklist de Documentos'}
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#F1EDE4] dark:divide-[#1C324B] text-xs">
                      {filteredPendingDocsReview.slice(0, 12).map((d) => (
                        <div key={d.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="min-w-0">
                            <p className="font-semibold text-[#0B1F33] dark:text-slate-100 leading-snug break-words">{d.nomeDocumento}</p>
                            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-0.5">
                              {d.pessoa} · {d.status}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenCase(d.caseId)}
                            className="px-3 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#142942] shrink-0 self-start sm:self-center"
                          >
                            Conferir
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 lg:border-l lg:border-slate-100 dark:lg:border-slate-800 lg:pl-6 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Reprovações Frequentes
                  </h3>
                  {topReprovados.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma reprovação registrada.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {topReprovados.map(([nome, qtd]) => (
                        <li key={nome} className="py-2 flex items-start justify-between gap-2">
                          <span className="text-slate-700 dark:text-slate-300 leading-snug break-words">{nome}</span>
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
                  deadlines={deadlines}
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
                <div className="rounded-xl border border-dashed border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6]/70 dark:bg-[#11263D]/40 p-5 text-center space-y-2.5">
                  <p className="text-xs text-[#4A5A6D] dark:text-slate-300">
                    Nenhuma dúvida de documento enviada no chat do portal até o momento.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNavigateSection?.('clientes')}
                    className="px-3 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#142942]"
                  >
                    Ver Clientes &amp; Acessos do Portal
                  </button>
                </div>
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

          {/* ABA 4: MÉTRICAS, FUNIL DE CONVERSÃO & PROGRESSO DE TAREFAS */}
          {workTab === 'relatorio' && (
            <div className="space-y-6">
              <PainelFunnelPerformanceSummary
                leads={filteredLeads}
                cases={activeCases}
                empresa={empresa}
                clients={clients}
                staffUsers={staffUsers}
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

              <Suspense fallback={<ChartSkeletonFallback />}>
                <PainelFunnelConversionChart
                  leads={filteredLeads}
                  cases={activeCases}
                  period={perfPeriod}
                  isDark={isDark}
                  onSelectStage={(stageId) => {
                    if (onOpenFunnelStage) {
                      onOpenFunnelStage(stageId);
                    } else {
                      onNavigateSection?.('funil');
                    }
                  }}
                />
              </Suspense>

              <Suspense fallback={<ChartSkeletonFallback />}>
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
              </Suspense>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
