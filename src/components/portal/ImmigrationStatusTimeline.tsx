import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  FileCheck2,
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
  type MilestoneVisualStatus,
  type SermigBadgeInfo,
} from '../../utils/caseTimelineModel';
import { formatDateBR } from '../../utils/formatters';

interface ImmigrationStatusTimelineProps {
  clientId?: string;
  activeCase: Case | null;
  modality: PaidConsultancyModality;
  initialDocs: CaseDocument[];
  initialDeadlines: Deadline[];
  initialNotifications?: ClientNotification[];
  onNavigateTab: (tab: 'documentos' | 'suporte' | 'financeiro') => void;
}

function getMilestoneStyle(status: MilestoneVisualStatus) {
  switch (status) {
    case 'completed':
      return {
        nodeClass: 'bg-emerald-600 text-white border-emerald-600',
        railClass: 'bg-emerald-300',
        rowClass: 'border-emerald-200/80 bg-emerald-50/35',
        statusTextClass: 'text-emerald-800',
        icon: CheckCircle2,
      };
    case 'attention':
      return {
        nodeClass: 'bg-amber-600 text-white border-amber-600 ring-4 ring-amber-100',
        railClass: 'bg-slate-200',
        rowClass: 'border-amber-300 bg-amber-50/70',
        statusTextClass: 'text-amber-900',
        icon: AlertTriangle,
      };
    case 'current':
      return {
        nodeClass: 'bg-[#0B1F33] text-white border-[#C8A236] ring-4 ring-amber-100/80',
        railClass: 'bg-slate-200',
        rowClass: 'border-slate-900/30 bg-slate-50',
        statusTextClass: 'text-[#0B1F33]',
        icon: Clock,
      };
    default:
      return {
        nodeClass: 'bg-white text-slate-400 border-slate-300',
        railClass: 'bg-slate-200',
        rowClass: 'border-slate-200 bg-white',
        statusTextClass: 'text-slate-500',
        icon: Circle,
      };
  }
}

function getSermigToneClasses(tone: SermigBadgeInfo['tone']) {
  switch (tone) {
    case 'success':
      return { textClass: 'text-emerald-800', icon: CheckCircle2 };
    case 'warning':
      return { textClass: 'text-amber-800', icon: AlertTriangle };
    case 'danger':
      return { textClass: 'text-red-700', icon: ShieldAlert };
    case 'info':
      return { textClass: 'text-sky-800', icon: Clock };
    default:
      return { textClass: 'text-slate-700', icon: Circle };
  }
}

export const ImmigrationStatusTimeline: React.FC<ImmigrationStatusTimelineProps> = ({
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

  // Real-time Firestore subscriptions for live application status updates
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
          // Keep initial snapshot safely on transient listener error
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
          // Keep initial snapshot safely
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
          // Keep initial snapshot safely
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

  const visibleMilestones = useMemo(() => {
    if (selectedPhaseKey === 'all') return timeline.milestones;
    return timeline.milestones.filter((m) => m.phaseKey === selectedPhaseKey);
  }, [timeline.milestones, selectedPhaseKey]);

  const sermigVisual = getSermigToneClasses(timeline.sermigBadge.tone);
  const SermigIcon = sermigVisual.icon;

  return (
    <div className="space-y-5">
      {/* Resumo ao vivo da linha do tempo */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/75 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
              <span className="font-bold text-slate-900">
                {modality === 'orientativa'
                  ? 'Linha do Tempo · Consultoria Orientativa (6 Etapas)'
                  : 'Linha do Tempo do Processo · SERMIG (15 Etapas)'}
              </span>
              {isLiveSynced && (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                  <Radio className="w-3 h-3" aria-hidden="true" />
                  Atualização em tempo real
                </span>
              )}
            </div>
            {timeline.currentMilestone && (
              <p className="text-sm font-semibold text-slate-900 mt-1">
                Etapa atual:{' '}
                <span className="tabular-nums">
                  {timeline.currentStepNumber}/{timeline.totalSteps}
                </span>{' '}
                — {timeline.currentMilestone.titulo}
              </p>
            )}
          </div>
          <div className="text-left sm:text-right shrink-0">
            <p className="text-xs text-slate-500">Avanço estimado do processo</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{timeline.progressPercent}%</p>
          </div>
        </div>

        {/* Barra de progresso principal */}
        <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={timeline.progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da linha do tempo do processo">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${timeline.progressPercent}%`,
              backgroundColor:
                timeline.currentMilestone?.status === 'attention'
                  ? '#D97706'
                  : timeline.progressPercent >= 100
                    ? '#16A34A'
                    : 'var(--color-primary)',
            }}
          />
        </div>

        {/* Metadados unboxed de status SERMIG, protocolo e próximo prazo */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Status oficial</p>
            <p className={`text-xs font-bold mt-0.5 inline-flex items-center gap-1.5 ${sermigVisual.textClass}`}>
              <SermigIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{timeline.sermigBadge.label}</span>
            </p>
            {timeline.sermigBadge.protocolNumber && (
              <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                Protocolo: {timeline.sermigBadge.protocolNumber}
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Etapas concluídas</p>
            <p className="text-xs font-bold text-slate-900 mt-0.5 tabular-nums inline-flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
              <span>
                {timeline.completedStepsCount} de {timeline.totalSteps} marcos finalizados
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
            <p className="text-[11px] font-medium text-slate-500">Próximo prazo</p>
            {timeline.nextDeadline ? (
              <>
                <p className="text-xs font-bold text-slate-900 mt-0.5 inline-flex items-center gap-1.5 truncate">
                  <CalendarClock className="w-3.5 h-3.5 text-slate-600 shrink-0" aria-hidden="true" />
                  <span className="truncate">{timeline.nextDeadline.titulo}</span>
                </p>
                <p
                  className={`text-[11px] font-medium tabular-nums mt-0.5 ${
                    timeline.nextDeadline.daysRemaining < 0
                      ? 'text-red-700'
                      : timeline.nextDeadline.daysRemaining <= 10
                        ? 'text-amber-700'
                        : 'text-slate-500'
                  }`}
                >
                  {formatDateBR(timeline.nextDeadline.dataLimite)}
                  {timeline.nextDeadline.daysRemaining < 0
                    ? ` · Vencido há ${Math.abs(timeline.nextDeadline.daysRemaining)}d`
                    : ` · Em ${timeline.nextDeadline.daysRemaining}d`}
                </p>
              </>
            ) : (
              <p className="text-xs font-medium text-slate-600 mt-0.5">Nenhum prazo crítico em aberto</p>
            )}
          </div>
        </div>
      </div>

      {/* Alertas acionáveis de atenção */}
      {timeline.alerts.length > 0 && (
        <div className="space-y-2">
          {timeline.alerts.map((al) => (
            <div
              key={al.id}
              role="region"
              aria-label={al.title}
              className={`rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                al.severity === 'danger'
                  ? 'border-red-300 bg-red-50/80 text-red-950'
                  : 'border-amber-300 bg-amber-50/80 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    al.severity === 'danger' ? 'text-red-700' : 'text-amber-700'
                  }`}
                  aria-hidden="true"
                />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold">{al.title}</p>
                  <p className="opacity-90 leading-relaxed">{al.detail}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab(al.actionTab)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[40px] rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0 no-print"
              >
                {al.actionLabel}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtros por fase */}
      <div className="flex flex-wrap items-center gap-2 no-print" role="tablist" aria-label="Filtrar marcos por fase">
        <button
          type="button"
          role="tab"
          aria-selected={selectedPhaseKey === 'all'}
          onClick={() => setSelectedPhaseKey('all')}
          className={`px-3 min-h-[40px] rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-colors ${
            selectedPhaseKey === 'all'
              ? 'bg-slate-900 text-white border-slate-900'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          Todas as etapas ({timeline.totalSteps})
        </button>
        {timeline.phases.map((ph) => (
          <button
            key={ph.key}
            type="button"
            role="tab"
            aria-selected={selectedPhaseKey === ph.key}
            onClick={() => setSelectedPhaseKey(ph.key)}
            className={`px-3 min-h-[40px] rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-colors ${
              selectedPhaseKey === ph.key
                ? 'bg-slate-900 text-white border-slate-900'
                : ph.hasAttention
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100/70'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {ph.label} ({ph.completedCount}/{ph.totalCount})
          </button>
        ))}
      </div>

      {/* Linha do tempo vertical com trilho conectado */}
      <ol className="relative space-y-2.5" aria-label="Etapas do processo migratório">
        {visibleMilestones.map((m, idx) => {
          const style = getMilestoneStyle(m.status);
          const StatusIcon = style.icon;
          const isLast = idx === visibleMilestones.length - 1;
          const isExpanded =
            expandedId === m.id || (expandedId === null && (m.status === 'current' || m.status === 'attention'));

          return (
            <li key={m.id} className="relative flex gap-3.5">
              {/* Coluna do nó e trilho vertical */}
              <div className="flex flex-col items-center shrink-0 pt-3">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold tabular-nums z-10 ${style.nodeClass}`}
                  aria-hidden="true"
                >
                  {m.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : m.status === 'attention' ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    m.numero
                  )}
                </div>
                {!isLast && <div className={`w-0.5 flex-1 min-h-[20px] mt-1 ${style.railClass}`} aria-hidden="true" />}
              </div>

              {/* Cartão da etapa */}
              <div className={`flex-1 rounded-xl border p-3.5 sm:p-4 transition-colors ${style.rowClass}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      <span className="font-bold text-slate-700 tabular-nums">Etapa {m.numero}</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500">{m.phaseLabel}</span>
                      {m.responsavel && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="font-semibold text-slate-700">Responsável: {m.responsavel}</span>
                        </>
                      )}
                      {m.dateLabel && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 tabular-nums">{m.dateLabel}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{m.titulo}</h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${style.statusTextClass}`}>
                      <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>{m.statusLabel}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? '__none__' : m.id)}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `Recolher detalhes da etapa ${m.numero}` : `Ver detalhes da etapa ${m.numero}`}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60 hover:text-slate-900 no-print"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 space-y-2 text-xs text-slate-700">
                    <p className="leading-relaxed">{m.descricao}</p>
                    {m.contextNote && (
                      <p className="font-semibold text-slate-800 tabular-nums">{m.contextNote}</p>
                    )}
                    {m.actionTab && m.actionLabel && (
                      <div className="pt-1 no-print">
                        <button
                          type="button"
                          onClick={() => onNavigateTab(m.actionTab!)}
                          className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
                          style={{ backgroundColor: 'var(--color-primary)' }}
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
    </div>
  );
};
