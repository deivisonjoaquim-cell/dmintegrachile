import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  Clock,
  FileSearch,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { db } from '../../firebase';
import type {
  Case,
  CaseDocument,
  ClientNotification,
  Deadline,
  PaidConsultancyModality,
} from '../../types/domain';
import {
  buildClientStatusTimeline,
  filterProcessMilestones,
  getProcessStepStatusLabel,
  resolveProcessStepStatus,
  summarizeProcessTimeline,
  type MilestoneVisualStatus,
  type ProcessStepStatus,
  type SermigBadgeInfo,
} from '../../utils/caseTimelineModel';
import { formatDateBR } from '../../utils/formatters';

export interface ProcessTimelineProps {
  clientId?: string;
  activeCase: Case | null;
  modality: PaidConsultancyModality;
  initialDocs: CaseDocument[];
  initialDeadlines: Deadline[];
  initialNotifications?: ClientNotification[];
  onNavigateTab: (tab: 'documentos' | 'suporte' | 'financeiro') => void;
}

function getProcessVisualStyle(status: MilestoneVisualStatus) {
  switch (status) {
    case 'completed':
      return {
        nodeClass:
          'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 dark:border-emerald-500',
        railClass: 'bg-emerald-300 dark:bg-emerald-500/40',
        cardClass:
          'border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] hover:border-emerald-300 dark:hover:border-emerald-700',
        statusTextClass: 'text-emerald-700 dark:text-emerald-400',
        statusBgClass: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
        icon: CheckCircle2,
      };
    case 'current':
      return {
        nodeClass:
          'bg-[#0F3D91] dark:bg-[#3B82F6] text-white border-[#0F3D91] dark:border-[#3B82F6] ring-4 ring-[#0F3D91]/15 dark:ring-[#3B82F6]/20',
        railClass: 'bg-[#E5E7EB] dark:bg-[#1E293B]',
        cardClass:
          'border-[#0F3D91]/40 dark:border-[#3B82F6]/50 bg-[#F8FAFC] dark:bg-[#101B2E]',
        statusTextClass: 'text-[#0F3D91] dark:text-[#60A5FA]',
        statusBgClass: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
        icon: Clock,
      };
    case 'attention':
      return {
        nodeClass:
          'bg-amber-500 dark:bg-amber-500 text-white border-amber-500 ring-4 ring-amber-500/15',
        railClass: 'bg-[#E5E7EB] dark:bg-[#1E293B]',
        cardClass:
          'border-amber-300 dark:border-amber-500/45 bg-amber-50/50 dark:bg-amber-500/[0.07]',
        statusTextClass: 'text-amber-800 dark:text-amber-300',
        statusBgClass: 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/35',
        icon: AlertTriangle,
      };
    default:
      return {
        nodeClass:
          'bg-white dark:bg-[#0D1422] text-slate-400 dark:text-slate-500 border-[#D1D5DB] dark:border-[#334155]',
        railClass: 'bg-[#E5E7EB] dark:bg-[#1E293B]',
        cardClass:
          'border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] hover:border-slate-300 dark:hover:border-slate-600',
        statusTextClass: 'text-[#475569] dark:text-slate-400',
        statusBgClass: 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',
        icon: CircleDashed,
      };
  }
}

function getSermigToneClasses(tone: SermigBadgeInfo['tone']) {
  switch (tone) {
    case 'success':
      return { textClass: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 };
    case 'warning':
      return { textClass: 'text-amber-700 dark:text-amber-300', icon: AlertTriangle };
    case 'danger':
      return { textClass: 'text-red-700 dark:text-red-400', icon: ShieldAlert };
    case 'info':
      return { textClass: 'text-[#0F3D91] dark:text-[#60A5FA]', icon: FileSearch };
    default:
      return { textClass: 'text-slate-600 dark:text-slate-400', icon: CircleDashed };
  }
}

export const ProcessTimeline: React.FC<ProcessTimelineProps> = ({
  clientId,
  activeCase,
  modality,
  initialDocs,
  initialDeadlines,
  initialNotifications,
  onNavigateTab,
}) => {
  const [liveCase, setLiveCase] = useState<Case | null>(activeCase);
  const [liveDocs, setLiveDocs] = useState<CaseDocument[]>(initialDocs);
  const [liveDeadlines, setLiveDeadlines] = useState<Deadline[]>(initialDeadlines);
  const [isLiveSynced, setIsLiveSynced] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | ProcessStepStatus>('all');
  const [selectedPhaseKey, setSelectedPhaseKey] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLiveCase(activeCase);
  }, [activeCase]);

  useEffect(() => {
    setLiveDocs(initialDocs);
  }, [initialDocs]);

  useEffect(() => {
    setLiveDeadlines(initialDeadlines);
  }, [initialDeadlines]);

  // Sincronização em tempo real com Firestore (caso, documentos e prazos)
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    if (activeCase?.id) {
      const caseUnsub = onSnapshot(
        doc(db, 'cases', activeCase.id),
        (snap) => {
          if (snap.exists()) {
            setLiveCase({ id: snap.id, ...(snap.data() as Omit<Case, 'id'>) } as Case);
            setIsLiveSynced(true);
          }
        },
        () => {
          // Mantém o snapshot inicial em caso de indisponibilidade temporária
        },
      );
      unsubs.push(caseUnsub);
    }

    if (clientId) {
      const docsUnsub = onSnapshot(
        query(collection(db, 'caseDocuments'), where('clientId', '==', clientId)),
        (snap) => {
          const allClientDocs = snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as Omit<CaseDocument, 'id'>) }) as CaseDocument,
          );
          const filtered = activeCase?.id
            ? allClientDocs.filter((d) => d.caseId === activeCase.id)
            : allClientDocs;
          setLiveDocs(filtered);
          setIsLiveSynced(true);
        },
        () => {
          // Mantém o snapshot inicial
        },
      );
      unsubs.push(docsUnsub);

      const dlUnsub = onSnapshot(
        query(collection(db, 'deadlines'), where('clientId', '==', clientId)),
        (snap) => {
          const allDl = snap.docs.map(
            (d) => ({ id: d.id, ...(d.data() as Omit<Deadline, 'id'>) }) as Deadline,
          );
          const filtered = activeCase?.id
            ? allDl.filter((d) => !d.caseId || d.caseId === activeCase.id)
            : allDl;
          setLiveDeadlines(filtered);
        },
        () => {
          // Mantém o snapshot inicial
        },
      );
      unsubs.push(dlUnsub);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeCase?.id, clientId]);

  const timeline = useMemo(
    () =>
      buildClientStatusTimeline({
        activeCase: liveCase,
        modality,
        caseDocuments: liveDocs,
        deadlines: liveDeadlines,
        notifications: initialNotifications,
      }),
    [liveCase, modality, liveDocs, liveDeadlines, initialNotifications],
  );

  const summary = useMemo(
    () => summarizeProcessTimeline(timeline.milestones),
    [timeline.milestones],
  );

  const visibleMilestones = useMemo(
    () => filterProcessMilestones(timeline.milestones, statusFilter, selectedPhaseKey),
    [timeline.milestones, statusFilter, selectedPhaseKey],
  );

  const sermigVisual = getSermigToneClasses(timeline.sermigBadge.tone);
  const SermigIcon = sermigVisual.icon;

  return (
    <section
      data-testid="process-timeline"
      aria-label="Linha do Tempo de Processo"
      className="space-y-5"
    >
      {/* Cabeçalho e Progresso Executivo */}
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0A101C] p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0F3D91] dark:text-[#60A5FA]">
                Linha do Tempo de Processo
              </p>
              {isLiveSynced && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <Radio className="w-3 h-3" aria-hidden="true" />
                  Sincronizado
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-[#070E1C] dark:text-white font-brand-sans">
              {modality === 'orientativa'
                ? 'Jornada da Consultoria Orientativa (6 Etapas)'
                : 'Acompanhamento Oficial SERMIG (15 Etapas)'}
            </h3>
            {timeline.currentMilestone && (
              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300">
                Etapa em curso:{' '}
                <span className="font-mono font-semibold text-[#070E1C] dark:text-white tabular-nums">
                  {String(timeline.currentStepNumber).padStart(2, '0')}/{String(timeline.totalSteps).padStart(2, '0')}
                </span>{' '}
                — <span className="font-semibold text-[#070E1C] dark:text-white">{timeline.currentMilestone.titulo}</span>
              </p>
            )}
          </div>

          <div className="text-left sm:text-right shrink-0">
            <p className="text-[11px] font-medium text-[#475569] dark:text-slate-400">Progresso geral</p>
            <p className="text-2xl sm:text-3xl font-bold font-mono text-[#070E1C] dark:text-white tabular-nums">
              {timeline.progressPercent}%
            </p>
          </div>
        </div>

        {/* Barra de progresso principal */}
        <div
          className="h-2 rounded-full bg-[#E5E7EB] dark:bg-[#1E293B] overflow-hidden"
          role="progressbar"
          aria-valuenow={timeline.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso da Linha do Tempo de Processo"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              timeline.currentMilestone?.status === 'attention'
                ? 'bg-amber-500'
                : timeline.progressPercent >= 100
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : 'bg-[#0F3D91] dark:bg-[#3B82F6]'
            }`}
            style={{ width: `${timeline.progressPercent}%` }}
          />
        </div>

        {/* Indicadores Visuais de Status (Aprovado · Em análise · Pendente) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            data-testid="timeline-summary-approved"
            className="rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#475569] dark:text-slate-400">Etapas superadas</p>
                <p className="text-xs font-bold text-[#070E1C] dark:text-white">Aprovadas</p>
              </div>
            </div>
            <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {summary.aprovadas}
            </span>
          </div>

          <div
            data-testid="timeline-summary-review"
            className="rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-[#0F3D91] dark:text-[#60A5FA] flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#475569] dark:text-slate-400">Em trâmite</p>
                <p className="text-xs font-bold text-[#070E1C] dark:text-white">Em análise</p>
              </div>
            </div>
            <span className="font-mono text-xl font-bold text-[#0F3D91] dark:text-[#60A5FA] tabular-nums">
              {summary.emAnalise}
            </span>
          </div>

          <div
            data-testid="timeline-summary-pending"
            className="rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] px-4 py-3 flex items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  summary.attentionCount > 0
                    ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                {summary.attentionCount > 0 ? (
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <CircleDashed className="w-4 h-4" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-[#475569] dark:text-slate-400">
                  {summary.attentionCount > 0 ? `${summary.attentionCount} com atenção` : 'Próximos passos'}
                </p>
                <p className="text-xs font-bold text-[#070E1C] dark:text-white">Pendentes</p>
              </div>
            </div>
            <span
              className={`font-mono text-xl font-bold tabular-nums ${
                summary.attentionCount > 0
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-[#070E1C] dark:text-slate-200'
              }`}
            >
              {summary.pendentes}
            </span>
          </div>
        </div>

        {/* Metadados SERMIG e Próximo Prazo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#E5E7EB] dark:border-[#1E293B]">
          <div className="flex items-start gap-2.5 pt-2">
            <SermigIcon className={`w-4 h-4 mt-0.5 shrink-0 ${sermigVisual.textClass}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#475569] dark:text-slate-400">Status oficial SERMIG</p>
              <p className={`text-xs font-bold ${sermigVisual.textClass}`}>{timeline.sermigBadge.label}</p>
              {timeline.sermigBadge.protocolNumber && (
                <p className="text-[11px] font-mono text-[#475569] dark:text-slate-400 tabular-nums mt-0.5">
                  Protocolo: {timeline.sermigBadge.protocolNumber}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2.5 pt-2">
            <CalendarClock className="w-4 h-4 mt-0.5 text-[#C9A86A] shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#475569] dark:text-slate-400">Próximo prazo crítico</p>
              {timeline.nextDeadline ? (
                <>
                  <p className="text-xs font-bold text-[#070E1C] dark:text-white truncate">
                    {timeline.nextDeadline.titulo}
                  </p>
                  <p
                    className={`text-[11px] font-medium tabular-nums mt-0.5 ${
                      timeline.nextDeadline.daysRemaining < 0
                        ? 'text-red-700 dark:text-red-400'
                        : timeline.nextDeadline.daysRemaining <= 10
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-[#475569] dark:text-slate-400'
                    }`}
                  >
                    {formatDateBR(timeline.nextDeadline.dataLimite)}
                    {timeline.nextDeadline.daysRemaining < 0
                      ? ` · Vencido há ${Math.abs(timeline.nextDeadline.daysRemaining)}d`
                      : ` · Em ${timeline.nextDeadline.daysRemaining}d`}
                  </p>
                </>
              ) : (
                <p className="text-xs font-medium text-[#475569] dark:text-slate-400">
                  Nenhum prazo crítico em aberto
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alertas acionáveis de atenção */}
      {timeline.alerts.length > 0 && (
        <div className="space-y-2.5">
          {timeline.alerts.map((alert) => (
            <div
              key={alert.id}
              className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                alert.severity === 'danger'
                  ? 'bg-red-50/80 dark:bg-red-500/10 border-red-200 dark:border-red-500/35 text-red-900 dark:text-red-200'
                  : 'bg-amber-50/80 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/35 text-amber-950 dark:text-amber-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold">{alert.title}</p>
                  <p className="text-xs opacity-90 mt-0.5">{alert.detail}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab(alert.actionTab)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070E1C] dark:bg-white text-white dark:text-[#070E1C] text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
              >
                {alert.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtros por Status (Todas · Aprovadas · Em análise · Pendentes) e Fase */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#E5E7EB] dark:border-[#1E293B] pb-3.5">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar etapas por status">
          {(
            [
              { key: 'all', label: `Todas (${summary.total})`, icon: null },
              { key: 'aprovado', label: `Aprovadas (${summary.aprovadas})`, icon: CheckCircle2 },
              { key: 'em_analise', label: `Em análise (${summary.emAnalise})`, icon: Clock },
              { key: 'pendente', label: `Pendentes (${summary.pendentes})`, icon: AlertTriangle },
            ] as const
          ).map((btn) => {
            const active = statusFilter === btn.key;
            const IconComp = btn.icon;
            return (
              <button
                key={btn.key}
                type="button"
                data-testid={`timeline-filter-${btn.key}`}
                aria-pressed={active}
                onClick={() => setStatusFilter(btn.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  active
                    ? 'bg-[#070E1C] dark:bg-[#3B82F6] text-white border-[#070E1C] dark:border-[#3B82F6]'
                    : 'bg-white dark:bg-[#0D1422] text-[#334155] dark:text-slate-300 border-[#E5E7EB] dark:border-[#1E293B] hover:border-slate-400 dark:hover:border-slate-500'
                }`}
              >
                {IconComp && <IconComp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                {btn.label}
              </button>
            );
          })}
        </div>

        {timeline.phases.length > 1 && (
          <div className="flex items-center gap-2">
            <label htmlFor="timeline-phase-select" className="text-[11px] font-medium text-[#475569] dark:text-slate-400 shrink-0">
              Fase:
            </label>
            <select
              id="timeline-phase-select"
              value={selectedPhaseKey}
              onChange={(e) => setSelectedPhaseKey(e.target.value)}
              className="text-xs font-medium rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] text-[#070E1C] dark:text-slate-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/30 dark:focus:ring-[#3B82F6]/40"
            >
              <option value="all">Todas as fases</option>
              {timeline.phases.map((ph) => (
                <option key={ph.key} value={ph.key}>
                  {ph.label} ({ph.completedCount}/{ph.totalCount})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Trilha Vertical da Linha do Tempo */}
      {visibleMilestones.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#334155] p-6 text-center space-y-2">
          <p className="text-sm font-semibold text-[#070E1C] dark:text-white">
            Nenhuma etapa encontrada para este filtro
          </p>
          <p className="text-xs text-[#475569] dark:text-slate-400">
            Altere o filtro de status ou fase para visualizar todas as etapas do seu processo.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setSelectedPhaseKey('all');
            }}
            className="mt-1 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#334155] bg-white dark:bg-[#0D1422] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Mostrar todas as etapas
          </button>
        </div>
      ) : (
        <ol className="relative space-y-3" aria-label="Marcos do processo migratório">
          {visibleMilestones.map((m, idx) => {
            const style = getProcessVisualStyle(m.status);
            const StatusIcon = style.icon;
            const mappedStatus = resolveProcessStepStatus(m.status);
            const displayLabel = getProcessStepStatusLabel(m.status);
            const isExpanded =
              expandedId === m.id ||
              (expandedId === null && (m.status === 'current' || m.status === 'attention'));
            const isLast = idx === visibleMilestones.length - 1;

            return (
              <li
                key={m.id}
                data-testid={`timeline-step-${m.numero}`}
                data-process-status={mappedStatus}
                className="relative pl-11"
              >
                {/* Linha conectora vertical */}
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={`absolute left-[15px] top-8 -bottom-3 w-0.5 ${style.railClass}`}
                  />
                )}

                {/* Ícone de status na trilha */}
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-1.5 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${style.nodeClass}`}
                >
                  <StatusIcon className="w-4 h-4" />
                </span>

                {/* Cartão do marco */}
                <div className={`rounded-xl border transition-colors ${style.cardClass}`}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    onClick={() => setExpandedId(isExpanded ? '__none__' : m.id)}
                    className="w-full text-left px-4 py-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#64748B] dark:text-slate-400 tabular-nums">
                          {String(m.numero).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-bold text-[#070E1C] dark:text-white">
                          {m.titulo}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${style.statusBgClass} ${style.statusTextClass}`}
                        >
                          <StatusIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                          {displayLabel}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#475569] dark:text-slate-400">
                        <span>{m.phaseLabel}</span>
                        {m.responsavel && <span>· Responsável: {m.responsavel}</span>}
                        {m.dateLabel && (
                          <span className="font-mono tabular-nums text-[#070E1C] dark:text-slate-300">
                            · {m.dateLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="text-slate-400 dark:text-slate-500 mt-1 shrink-0" aria-hidden="true">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-[#E5E7EB]/80 dark:border-[#1E293B] space-y-3">
                      <p className="text-xs sm:text-sm text-[#334155] dark:text-slate-300 leading-relaxed">
                        {m.descricao}
                      </p>

                      {m.contextNote && (
                        <p className="text-xs font-medium text-[#0F3D91] dark:text-[#60A5FA] bg-blue-50/60 dark:bg-blue-500/10 border border-blue-200/70 dark:border-blue-500/25 rounded-lg px-3 py-2">
                          {m.contextNote}
                        </p>
                      )}

                      {m.actionTab && m.actionLabel && (
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={() => onNavigateTab(m.actionTab!)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070E1C] dark:bg-[#3B82F6] text-white text-xs font-semibold hover:opacity-95 transition-opacity"
                          >
                            {m.actionLabel}
                            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
};
