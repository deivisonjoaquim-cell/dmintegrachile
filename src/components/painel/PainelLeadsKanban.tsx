import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  Eye,
  EyeOff,
  Flame,
  GripVertical,
  LayoutGrid,
  Loader2,
  Maximize2,
  MessageCircle,
  Minimize2,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import type { Lead, UserRole } from '../../types/domain';
import { formatDateBR } from '../../utils/formatters';
import {
  FUNIL_STAGES,
  computeLeadUrgency,
  type LeadQuickEditPatch,
} from '../../utils/leadKanban';

export { FUNIL_STAGES };

type KanbanSortMode = 'recentes' | 'maior_nota' | 'prioridade' | 'sla_contato';
type KanbanDensity = 'compacto' | 'detalhado';
type KanbanLayoutMode = 'grade' | 'esteira';

interface PainelLeadsKanbanProps {
  leads: Lead[];
  role: UserRole;
  selectedLeadIds: string[];
  convertingId: string | null;
  movingLeadId: string | null;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  onToggleSelect: (id: string) => void;
  onMoveStage: (lead: Lead, nextStage: Lead['statusFunil'], motivoPerda?: string) => Promise<void>;
  onQuickUpdateLead: (lead: Lead, patch: LeadQuickEditPatch) => Promise<void>;
  onInspectLead: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onSendWhatsApp: (lead: Lead) => Promise<void>;
  onConvertLead: (lead: Lead) => Promise<void>;
  onOpenCase: (caseId: string) => void;
}

const STAGE_BAR_COLORS: Record<Lead['statusFunil'], string> = {
  Novo: 'bg-slate-700',
  Contatado: 'bg-sky-700',
  'Diagnóstico Agendado': 'bg-amber-600',
  'Orçamento Enviado': 'bg-indigo-700',
  Fechado: 'bg-[#1E7E34]',
  Perdido: 'bg-[#C82333]',
};

const PRIORITY_WEIGHT: Record<Lead['prioridade'], number> = {
  Urgente: 4,
  Alta: 3,
  Média: 2,
  Baixa: 1,
};

const PRIORITIES: Lead['prioridade'][] = ['Urgente', 'Alta', 'Média', 'Baixa'];
const TEMPERATURES: NonNullable<Lead['temperatura']>[] = ['Quente', 'Morno', 'Frio'];

const LOSS_PRESETS = [
  'Sem retorno após tentativas de contato',
  'Orçamento acima da expectativa atual',
  'Adiou plano de mudança para o Chile',
  'Perfil inelegível no momento',
  'Lead duplicado / teste',
];

export const PainelLeadsKanban: React.FC<PainelLeadsKanbanProps> = ({
  leads,
  role,
  selectedLeadIds,
  convertingId,
  movingLeadId,
  hasActiveFilters = false,
  onClearFilters,
  onToggleSelect,
  onMoveStage,
  onQuickUpdateLead,
  onInspectLead,
  onSendWhatsApp,
  onConvertLead,
  onOpenCase,
}) => {
  const [layoutMode, setLayoutMode] = useState<KanbanLayoutMode>(() => {
    try {
      const saved = window.localStorage.getItem('dm_leads_kanban_layout');
      if (saved === 'grade' || saved === 'esteira') return saved;
    } catch {
      // ignore storage errors
    }
    return 'grade';
  });
  const [sortMode, setSortMode] = useState<KanbanSortMode>('prioridade');
  const [density, setDensity] = useState<KanbanDensity>('compacto');
  const [showLostColumn, setShowLostColumn] = useState(true);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});

  // Estado intuitivo de Drag-and-Drop sem flickering em elementos filhos
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Lead['statusFunil'] | null>(null);

  // Modal de perda rápida (ao arrastar direto para Perdido)
  const [lossModalLead, setLossModalLead] = useState<Lead | null>(null);
  const [lossReason, setLossReason] = useState('');

  // Modal de Edição Rápida (sem recarregar a página)
  const [quickEditLead, setQuickEditLead] = useState<Lead | null>(null);
  const [quickStatus, setQuickStatus] = useState<Lead['statusFunil']>('Novo');
  const [quickPriority, setQuickPriority] = useState<Lead['prioridade']>('Média');
  const [quickTemperature, setQuickTemperature] = useState<NonNullable<Lead['temperatura']>>('Morno');
  const [quickLossReason, setQuickLossReason] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const stageRefs = useRef<Record<string, HTMLElement | null>>({});
  const [scrollState, setScrollState] = useState({ left: false, right: false });

  const draggingLead = useMemo(
    () => (draggingLeadId ? leads.find((l) => l.id === draggingLeadId) || null : null),
    [leads, draggingLeadId],
  );

  const visibleStages = useMemo(
    () => (showLostColumn ? FUNIL_STAGES : FUNIL_STAGES.filter((st) => st !== 'Perdido')),
    [showLostColumn],
  );

  const stageCounts = useMemo(() => {
    const counts: Record<Lead['statusFunil'], number> = {
      Novo: 0,
      Contatado: 0,
      'Diagnóstico Agendado': 0,
      'Orçamento Enviado': 0,
      Fechado: 0,
      Perdido: 0,
    };
    for (const lead of leads) {
      if (counts[lead.statusFunil] !== undefined) {
        counts[lead.statusFunil] += 1;
      }
    }
    return counts;
  }, [leads]);

  const urgencyMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeLeadUrgency>>();
    const now = Date.now();
    for (const lead of leads) {
      map.set(lead.id, computeLeadUrgency(lead, now));
    }
    return map;
  }, [leads]);

  const summary = useMemo(() => {
    const active = leads.filter((l) => l.statusFunil !== 'Perdido' && l.statusFunil !== 'Fechado');
    let criticalCount = 0;
    let slaOverdueCount = 0;
    for (const lead of active) {
      const u = urgencyMap.get(lead.id);
      if (u?.level === 'critica') criticalCount += 1;
      if (u?.slaOverdue) slaOverdueCount += 1;
    }
    const closedCount = leads.filter((l) => l.statusFunil === 'Fechado').length;
    const conversionPct = leads.length > 0 ? Math.round((closedCount / leads.length) * 100) : 0;
    return {
      activeCount: active.length,
      criticalCount,
      slaOverdueCount,
      closedCount,
      conversionPct,
    };
  }, [leads, urgencyMap]);

  const updateScrollState = useCallback(() => {
    const el = boardScrollRef.current;
    if (!el) {
      setScrollState({ left: false, right: false });
      return;
    }
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    setScrollState({
      left: el.scrollLeft > 8,
      right: el.scrollLeft < maxScroll - 8,
    });
  }, []);

  useEffect(() => {
    if (layoutMode !== 'esteira') return;
    updateScrollState();
    const onResize = () => updateScrollState();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [layoutMode, visibleStages, collapsedStages, leads.length, updateScrollState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (quickEditLead && !quickSaving) setQuickEditLead(null);
        if (lossModalLead) setLossModalLead(null);
        if (draggingLeadId) {
          setDraggingLeadId(null);
          setDragOverStage(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quickEditLead, quickSaving, lossModalLead, draggingLeadId]);

  const handleLayoutChange = (next: KanbanLayoutMode) => {
    setLayoutMode(next);
    try {
      window.localStorage.setItem('dm_leads_kanban_layout', next);
    } catch {
      // ignore storage errors
    }
  };

  const scrollBoardBy = (delta: number) => {
    const el = boardScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const scrollToStage = (stage: Lead['statusFunil']) => {
    if (collapsedStages[stage]) {
      setCollapsedStages((prev) => ({ ...prev, [stage]: false }));
    }
    const node = stageRefs.current[stage];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  };

  const openQuickEditModal = (lead: Lead) => {
    setQuickEditLead(lead);
    setQuickStatus(lead.statusFunil);
    setQuickPriority(lead.prioridade);
    setQuickTemperature(lead.temperatura || 'Morno');
    setQuickLossReason(lead.motivoPerda || LOSS_PRESETS[0]);
    setQuickNotes(lead.notas || '');
    setQuickError(null);
  };

  const handleSubmitQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickEditLead || quickSaving) return;
    setQuickSaving(true);
    setQuickError(null);
    try {
      await onQuickUpdateLead(quickEditLead, {
        statusFunil: quickStatus,
        prioridade: quickPriority,
        temperatura: quickTemperature,
        motivoPerda: quickStatus === 'Perdido' ? quickLossReason : undefined,
        notas: quickNotes,
      });
      setQuickEditLead(null);
    } catch (err) {
      setQuickError(
        err instanceof Error ? err.message : 'Não foi possível salvar a atualização do lead.',
      );
    } finally {
      setQuickSaving(false);
    }
  };

  const sortColumnLeads = (colLeads: Lead[]): Lead[] => {
    return [...colLeads].sort((a, b) => {
      if (sortMode === 'maior_nota') {
        return (b.notaViabilidade || 0) - (a.notaViabilidade || 0);
      }
      if (sortMode === 'prioridade') {
        const uA = urgencyMap.get(a.id);
        const uB = urgencyMap.get(b.id);
        const slaDiff = Number(Boolean(uB?.slaOverdue)) - Number(Boolean(uA?.slaOverdue));
        if (slaDiff !== 0) return slaDiff;
        const pDiff = PRIORITY_WEIGHT[b.prioridade] - PRIORITY_WEIGHT[a.prioridade];
        if (pDiff !== 0) return pDiff;
        return (b.notaViabilidade || 0) - (a.notaViabilidade || 0);
      }
      if (sortMode === 'sla_contato') {
        const aSla = a.primeiroContatoEm ? 0 : urgencyMap.get(a.id)?.ageHours || 0;
        const bSla = b.primeiroContatoEm ? 0 : urgencyMap.get(b.id)?.ageHours || 0;
        return bSla - aSla;
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  };

  const requestMoveStage = (lead: Lead, nextStage: Lead['statusFunil']) => {
    if (lead.statusFunil === nextStage) return;
    if (nextStage === 'Perdido') {
      setLossModalLead(lead);
      setLossReason(lead.motivoPerda || LOSS_PRESETS[0]);
      return;
    }
    void onMoveStage(lead, nextStage);
  };

  const handleConfirmLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lossModalLead) return;
    const target = lossModalLead;
    const reason = lossReason.trim() || 'Sem motivo informado';
    setLossModalLead(null);
    setLossReason('');
    await onMoveStage(target, 'Perdido', reason);
  };

  const handleColumnDragEnter = (e: React.DragEvent, stage: Lead['statusFunil']) => {
    e.preventDefault();
    if (!draggingLeadId || draggingLead?.statusFunil === stage) return;
    if (dragOverStage !== stage) setDragOverStage(stage);
  };

  const handleColumnDragOver = (e: React.DragEvent, stage: Lead['statusFunil']) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggingLead?.statusFunil === stage ? 'none' : 'move';
    if (draggingLeadId && draggingLead?.statusFunil !== stage && dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleColumnDragLeave = (e: React.DragEvent<HTMLElement>, stage: Lead['statusFunil']) => {
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setDragOverStage((prev) => (prev === stage ? null : prev));
  };

  const handleDropOnStage = (e: React.DragEvent, stage: Lead['statusFunil']) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggingLeadId;
    setDragOverStage(null);
    setDraggingLeadId(null);
    if (!droppedId) return;
    const lead = leads.find((item) => item.id === droppedId);
    if (!lead || lead.statusFunil === stage) return;
    requestMoveStage(lead, stage);
  };

  const toggleCollapseStage = (stage: Lead['statusFunil']) => {
    setCollapsedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  const renderLeadCard = (l: Lead, stage: Lead['statusFunil'], nextStage: Lead['statusFunil'] | null) => {
    const urgency = urgencyMap.get(l.id) || computeLeadUrgency(l);
    const isMoving = movingLeadId === l.id;
    const isSelected = selectedLeadIds.includes(l.id);
    const isDraggingThis = draggingLeadId === l.id;

    const cardSurfaceClass = isSelected
      ? 'bg-white border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/25'
      : urgency.level === 'critica'
        ? 'bg-red-50/30 border-red-300 hover:border-red-400'
        : urgency.level === 'alta'
          ? 'bg-amber-50/20 border-amber-300/80 hover:border-amber-400'
          : 'bg-white border-slate-200 hover:border-slate-300';

    return (
      <article
        key={l.id}
        draggable={!isMoving}
        onDragStart={(e) => {
          setDraggingLeadId(l.id);
          e.dataTransfer.setData('text/plain', l.id);
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => {
          setDraggingLeadId(null);
          setDragOverStage(null);
        }}
        className={`group border rounded-lg p-2.5 space-y-1.5 transition-all cursor-grab active:cursor-grabbing ${cardSurfaceClass} ${
          isDraggingThis ? 'opacity-45 scale-[0.98] border-dashed border-[var(--color-primary)]' : ''
        } ${isMoving ? 'opacity-60' : ''}`}
      >
        {/* Linha 1: Seleção + Indicador de Urgência + Alça de arraste */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(l.id)}
              aria-label={`Selecionar ${l.nome}`}
              className="shrink-0"
            />
            <span className="inline-flex items-center gap-1 text-[11px] tabular-nums truncate">
              {urgency.level === 'critica' ? (
                <>
                  {urgency.slaOverdue ? (
                    <Clock className="w-3 h-3 text-[#C82333] shrink-0" aria-hidden="true" />
                  ) : (
                    <Flame className="w-3 h-3 text-[#C82333] shrink-0" aria-hidden="true" />
                  )}
                  <span className="font-bold text-[#C82333] truncate">{urgency.label}</span>
                </>
              ) : urgency.level === 'alta' ? (
                <>
                  <Zap className="w-3 h-3 text-amber-700 shrink-0" aria-hidden="true" />
                  <span className="font-bold text-amber-800 truncate">{urgency.label}</span>
                </>
              ) : (
                <span className="font-medium text-slate-500 truncate">{urgency.label}</span>
              )}
              {l.temperatura && urgency.label !== l.temperatura && (
                <span className="text-slate-400">· {l.temperatura}</span>
              )}
              {urgency.ageCompact && <span className="text-slate-400">· {urgency.ageCompact}</span>}
            </span>
          </div>
          <GripVertical
            className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors"
            aria-hidden="true"
          />
        </div>

        {/* Linha 2: Nome clicável (abre Edição Rápida) + Nota de Viabilidade */}
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <button
            type="button"
            onClick={() => openQuickEditModal(l)}
            title={`Edição rápida de ${l.nome}`}
            className="text-left text-[13px] font-bold text-slate-900 hover:text-[var(--color-primary)] truncate leading-snug min-w-0"
          >
            {l.nome}
          </button>
          <span
            className={`text-xs font-bold tabular-nums shrink-0 ${
              typeof l.notaViabilidade === 'number'
                ? l.notaViabilidade >= 75
                  ? 'text-[#1E7E34]'
                  : l.notaViabilidade >= 50
                    ? 'text-[var(--color-primary)]'
                    : 'text-amber-700'
                : 'text-slate-400'
            }`}
          >
            {typeof l.notaViabilidade === 'number' ? `${l.notaViabilidade}/100` : '—'}
          </span>
        </div>

        {/* Linha 3: Enquadramento + Alerta de Urgência/Risco quando aplicável */}
        <div className="space-y-0.5 text-[11px] min-w-0">
          <p className="text-slate-600 truncate" title={l.subcategoriaSugerida || l.interesse}>
            {l.subcategoriaSugerida || l.interesse || 'Enquadramento em análise'}
          </p>

          {(urgency.slaOverdue || urgency.hasConsultantRisk) && (
            <p className="inline-flex items-center gap-1 font-semibold text-[#C82333] tabular-nums max-w-full truncate">
              {urgency.slaOverdue ? (
                <>
                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span className="truncate">Sem 1º contato há {urgency.ageCompact}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" aria-hidden="true" />
                  <span className="truncate text-amber-800">Ponto de atenção ao consultor</span>
                </>
              )}
            </p>
          )}

          {density === 'detalhado' && (
            <div className="space-y-0.5 pt-0.5 text-slate-500">
              <p className="truncate">
                {l.origem}
                {l.cidadeUf ? ` · ${l.cidadeUf}` : ''}
                {l.createdAt ? ` · ${formatDateBR(l.createdAt)}` : ''}
              </p>
              {urgency.isIncomplete && (
                <p className="font-semibold text-amber-700 truncate">
                  Diagnóstico {l.statusConclusao?.toLowerCase()} (Etapa {l.etapaAtual || 1}/6)
                </p>
              )}
              {stage === 'Perdido' && l.motivoPerda && (
                <p className="text-[#C82333] truncate" title={l.motivoPerda}>
                  Motivo: {l.motivoPerda}
                </p>
              )}
              {l.notas && (
                <p className="text-slate-600 truncate" title={l.notas}>
                  Nota: {l.notas}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Linha 4: Barra única compacta de ações + Edição Rápida */}
        <div className="pt-1.5 border-t border-slate-200/70 flex items-center justify-between gap-1 text-[11px] min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => openQuickEditModal(l)}
              title="Edição rápida de status, prioridade e notas"
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3 h-3" />
              Status
            </button>
            {l.respostasTriagem && (
              <button
                type="button"
                onClick={() => onInspectLead(l)}
                title="Analisar diagnóstico e simular cenário"
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Eye className="w-3 h-3" />
                Analisar
              </button>
            )}
            <button
              type="button"
              onClick={() => void onSendWhatsApp(l)}
              title="Enviar WhatsApp com modelo selecionado"
              aria-label={`Enviar WhatsApp para ${l.nome}`}
              className="p-1.5 rounded bg-[#1E7E34] text-white hover:opacity-95 shrink-0"
            >
              <MessageCircle className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {l.convertedCaseId ? (
              <button
                type="button"
                onClick={() => onOpenCase(l.convertedCaseId!)}
                className="px-2 py-1 rounded border border-slate-200 bg-white font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                Ver Caso
              </button>
            ) : role === 'admin' || role === 'consultor' ? (
              <button
                type="button"
                disabled={convertingId === l.id}
                onClick={() => void onConvertLead(l)}
                title="Converter lead em cliente e caso"
                className="inline-flex items-center gap-1 px-2 py-1 rounded font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <ArrowRightCircle className="w-3 h-3" />
                {convertingId === l.id ? '...' : 'Converter'}
              </button>
            ) : null}

            {nextStage && (
              <button
                type="button"
                disabled={isMoving}
                onClick={() => requestMoveStage(l, nextStage)}
                title={`Avançar para ${nextStage}`}
                aria-label={`Avançar ${l.nome} para ${nextStage}`}
                className="p-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shrink-0 disabled:opacity-50"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden min-w-0 w-full">
      {/* Cabeçalho Unificado do Quadro: Resumo de Urgência + Controles */}
      <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:divide-x sm:divide-slate-200 text-xs">
          <div className="sm:pr-4">
            <p className="text-slate-500">Em negociação</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{summary.activeCount}</p>
          </div>
          <div className="sm:px-4">
            <p className="text-slate-500">Urgência crítica</p>
            <p className={`text-lg font-bold tabular-nums ${summary.criticalCount > 0 ? 'text-[#C82333]' : 'text-slate-900'}`}>
              {summary.criticalCount}
            </p>
          </div>
          <div className="sm:px-4">
            <p className="text-slate-500">Sem 1º contato (&gt;24h)</p>
            <p className={`text-lg font-bold tabular-nums ${summary.slaOverdueCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
              {summary.slaOverdueCount}
            </p>
          </div>
          <div className="sm:pl-4">
            <p className="text-slate-500">Fechados no funil</p>
            <p className="text-lg font-bold text-[#1E7E34] tabular-nums">
              {summary.closedCount} ({summary.conversionPct}%)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg" role="group" aria-label="Formato do Kanban">
            <button
              type="button"
              onClick={() => handleLayoutChange('grade')}
              aria-pressed={layoutMode === 'grade'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                layoutMode === 'grade' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Enquadrado
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange('esteira')}
              aria-pressed={layoutMode === 'esteira'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                layoutMode === 'esteira' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns3 className="w-3.5 h-3.5" />
              Esteira
            </button>
          </div>

          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as KanbanSortMode)}
            aria-label="Ordenar cards do Kanban"
            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="prioridade">Ordenar: Urgência e Prioridade</option>
            <option value="sla_contato">Ordenar: Aguardando contato</option>
            <option value="maior_nota">Ordenar: Maior viabilidade</option>
            <option value="recentes">Ordenar: Mais recentes</option>
          </select>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg" role="group" aria-label="Densidade dos cards">
            <button
              type="button"
              onClick={() => setDensity('compacto')}
              aria-pressed={density === 'compacto'}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                density === 'compacto' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Compacto
            </button>
            <button
              type="button"
              onClick={() => setDensity('detalhado')}
              aria-pressed={density === 'detalhado'}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                density === 'detalhado' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Detalhado
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowLostColumn((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {showLostColumn ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showLostColumn ? 'Ocultar Perdidos' : 'Mostrar Perdidos'}
          </button>
        </div>
      </div>

      {/* Faixa informativa durante o Arrastar e Soltar */}
      {draggingLead && (
        <div className="px-4 py-2 bg-slate-900 text-white text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span className="truncate">
              Arrastando <strong>{draggingLead.nome}</strong> ({draggingLead.statusFunil}) — solte na coluna desejada para atualizar.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setDraggingLeadId(null);
              setDragOverStage(null);
            }}
            className="text-slate-300 hover:text-white font-semibold whitespace-nowrap shrink-0"
          >
            Cancelar (Esc)
          </button>
        </div>
      )}

      {/* Barra de Navegação Rápida por Etapa (no modo Esteira) */}
      {layoutMode === 'esteira' && (
        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 py-0.5">
            {visibleStages.map((stage) => (
              <button
                key={stage}
                type="button"
                onClick={() => scrollToStage(stage)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                <span>{stage}</span>
                <span className="text-slate-400" aria-hidden="true">·</span>
                <span className="text-slate-600 tabular-nums">{stageCounts[stage]}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={!scrollState.left}
              onClick={() => scrollBoardBy(-320)}
              aria-label="Rolar Kanban para a esquerda"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!scrollState.right}
              onClick={() => scrollBoardBy(320)}
              aria-label="Rolar Kanban para a direita"
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Aviso quando filtro esvaziou todos os leads */}
      {leads.length === 0 && hasActiveFilters && (
        <div className="px-4 py-3 bg-amber-50/70 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900">
          <span>Nenhum lead corresponde aos filtros ativos no momento.</span>
          {onClearFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="px-2.5 py-1 rounded-md border border-amber-300 bg-white font-semibold text-amber-900 hover:bg-amber-50 whitespace-nowrap shrink-0"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Corpo do Kanban: Modo Grade Enquadrada OU Esteira Horizontal */}
      {layoutMode === 'grade' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-px bg-slate-200">
          {visibleStages.map((stage, stageIdx) => {
            const colLeads = sortColumnLeads(leads.filter((l) => l.statusFunil === stage));
            const isCollapsed = Boolean(collapsedStages[stage]);
            const canDropHere = Boolean(draggingLead && draggingLead.statusFunil !== stage);
            const isDropTarget = dragOverStage === stage && canDropHere;
            const urgentColCount = colLeads.filter((l) => urgencyMap.get(l.id)?.level === 'critica').length;
            const nextStage = stageIdx < FUNIL_STAGES.length - 2 ? FUNIL_STAGES[stageIdx + 1] : null;

            return (
              <section
                key={stage}
                aria-label={`Coluna ${stage}`}
                onDragEnter={(e) => handleColumnDragEnter(e, stage)}
                onDragOver={(e) => handleColumnDragOver(e, stage)}
                onDragLeave={(e) => handleColumnDragLeave(e, stage)}
                onDrop={(e) => handleDropOnStage(e, stage)}
                className={`bg-slate-50/80 flex flex-col min-w-0 transition-colors ${
                  isDropTarget
                    ? 'bg-sky-50/70 ring-2 ring-inset ring-[var(--color-primary)]/50'
                    : canDropHere
                      ? 'bg-slate-100/70'
                      : ''
                }`}
              >
                <div className={`h-0.5 w-full ${STAGE_BAR_COLORS[stage]}`} aria-hidden="true" />
                <div className="px-3.5 py-2.5 bg-white border-b border-slate-200/90 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold text-slate-900 truncate">{stage}</h2>
                      <span className="text-xs font-bold text-slate-500 tabular-nums">({colLeads.length})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 tabular-nums mt-0.5 truncate">
                      {urgentColCount > 0 ? `${urgentColCount} urgente(s) nesta etapa` : 'Sem pendências críticas'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCollapseStage(stage)}
                    title={isCollapsed ? `Expandir ${stage}` : `Recolher ${stage}`}
                    aria-expanded={!isCollapsed}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 whitespace-nowrap shrink-0"
                  >
                    {isCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                    <span>{isCollapsed ? 'Expandir' : 'Recolher'}</span>
                  </button>
                </div>

                {!isCollapsed && (
                  <div className="p-2.5 space-y-2 max-h-[380px] min-h-[168px] overflow-y-auto">
                    {isDropTarget && draggingLead && (
                      <div className="px-3 py-2.5 rounded-lg border-2 border-dashed border-[var(--color-primary)] bg-white text-xs font-semibold text-[var(--color-primary)] text-center">
                        Soltar aqui para mover &quot;{draggingLead.nome}&quot; para {stage}
                      </div>
                    )}
                    {colLeads.length === 0 ? (
                      <div
                        className={`h-[136px] flex items-center justify-center px-3 text-center border border-dashed rounded-lg text-xs transition-colors ${
                          isDropTarget
                            ? 'border-[var(--color-primary)] bg-white text-[var(--color-primary)] font-semibold'
                            : canDropHere
                              ? 'border-slate-400 bg-white/80 text-slate-600'
                              : 'border-slate-300 bg-white/60 text-slate-500'
                        }`}
                      >
                        {canDropHere
                          ? `Arraste para mover para "${stage}"`
                          : 'Nenhum lead nesta etapa'}
                      </div>
                    ) : (
                      colLeads.map((l) => renderLeadCard(l, stage, nextStage))
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div
          ref={boardScrollRef}
          onScroll={updateScrollState}
          className="flex overflow-x-auto divide-x divide-slate-200 bg-slate-50/70 min-w-0 w-full"
        >
          {visibleStages.map((stage, stageIdx) => {
            const colLeads = sortColumnLeads(leads.filter((l) => l.statusFunil === stage));
            const isCollapsed = Boolean(collapsedStages[stage]);
            const canDropHere = Boolean(draggingLead && draggingLead.statusFunil !== stage);
            const isDropTarget = dragOverStage === stage && canDropHere;
            const urgentColCount = colLeads.filter((l) => urgencyMap.get(l.id)?.level === 'critica').length;
            const nextStage = stageIdx < FUNIL_STAGES.length - 2 ? FUNIL_STAGES[stageIdx + 1] : null;

            if (isCollapsed) {
              return (
                <div
                  key={stage}
                  ref={(el) => {
                    stageRefs.current[stage] = el;
                  }}
                  onDragEnter={(e) => handleColumnDragEnter(e, stage)}
                  onDragOver={(e) => handleColumnDragOver(e, stage)}
                  onDragLeave={(e) => handleColumnDragLeave(e, stage)}
                  onDrop={(e) => handleDropOnStage(e, stage)}
                  className={`w-12 shrink-0 bg-slate-100/90 flex flex-col items-center transition-colors ${
                    isDropTarget ? 'bg-sky-100/80 ring-2 ring-inset ring-[var(--color-primary)]/50' : ''
                  }`}
                >
                  <div className={`h-0.5 w-full ${STAGE_BAR_COLORS[stage]}`} aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => toggleCollapseStage(stage)}
                    title={`Expandir coluna ${stage}`}
                    aria-label={`Expandir coluna ${stage} (${colLeads.length} leads)`}
                    className="w-full flex-1 py-3 flex flex-col items-center gap-3 text-slate-700 hover:text-slate-900 hover:bg-slate-200/60"
                  >
                    <Maximize2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="tabular-nums text-xs font-bold text-slate-800">{colLeads.length}</span>
                    <span
                      className="text-[11px] font-bold tracking-tight whitespace-nowrap"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {stage}
                    </span>
                  </button>
                </div>
              );
            }

            return (
              <section
                key={stage}
                ref={(el) => {
                  stageRefs.current[stage] = el;
                }}
                aria-label={`Coluna ${stage}`}
                onDragEnter={(e) => handleColumnDragEnter(e, stage)}
                onDragOver={(e) => handleColumnDragOver(e, stage)}
                onDragLeave={(e) => handleColumnDragLeave(e, stage)}
                onDrop={(e) => handleDropOnStage(e, stage)}
                className={`w-[296px] shrink-0 flex flex-col transition-colors ${
                  isDropTarget
                    ? 'bg-sky-50/70 ring-2 ring-inset ring-[var(--color-primary)]/50'
                    : canDropHere
                      ? 'bg-slate-100/70'
                      : ''
                }`}
              >
                <div className={`h-0.5 w-full ${STAGE_BAR_COLORS[stage]}`} aria-hidden="true" />
                <div className="px-3 py-2.5 bg-white border-b border-slate-200 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xs font-bold text-slate-900 truncate">{stage}</h2>
                      <span className="text-xs font-bold text-slate-500 tabular-nums">({colLeads.length})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 tabular-nums mt-0.5 truncate">
                      {urgentColCount > 0 ? `${urgentColCount} urgente(s) nesta etapa` : 'Sem pendências críticas'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCollapseStage(stage)}
                    title="Recolher coluna"
                    aria-label={`Recolher coluna ${stage}`}
                    className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 shrink-0"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="p-2.5 space-y-2 h-[clamp(340px,56vh,600px)] overflow-y-auto">
                  {isDropTarget && draggingLead && (
                    <div className="px-3 py-2.5 rounded-lg border-2 border-dashed border-[var(--color-primary)] bg-white text-xs font-semibold text-[var(--color-primary)] text-center">
                      Soltar aqui para mover &quot;{draggingLead.nome}&quot; para {stage}
                    </div>
                  )}
                  {colLeads.length === 0 ? (
                    <div
                      className={`h-[136px] flex items-center justify-center px-3 text-center border border-dashed rounded-lg text-xs transition-colors ${
                        isDropTarget
                          ? 'border-[var(--color-primary)] bg-white text-[var(--color-primary)] font-semibold'
                          : canDropHere
                            ? 'border-slate-400 bg-white/80 text-slate-600'
                            : 'border-slate-300 bg-white/60 text-slate-500'
                      }`}
                    >
                      {canDropHere
                        ? `Arraste para mover para "${stage}"`
                        : 'Nenhum lead nesta etapa'}
                    </div>
                  ) : (
                    colLeads.map((l) => renderLeadCard(l, stage, nextStage))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Modal de Edição Rápida (Atualiza Status, Prioridade, Temperatura e Notas sem recarregar) */}
      {quickEditLead && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kanban-quick-edit-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !quickSaving) setQuickEditLead(null);
          }}
        >
          <form
            onSubmit={(e) => void handleSubmitQuickEdit(e)}
            className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/70">
              <div className="min-w-0">
                <h3 id="kanban-quick-edit-title" className="text-base font-bold text-slate-900 truncate">
                  Edição Rápida — {quickEditLead.nome}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  {quickEditLead.subcategoriaSugerida || quickEditLead.interesse || 'Enquadramento em análise'}
                  {typeof quickEditLead.notaViabilidade === 'number' ? ` · Nota ${quickEditLead.notaViabilidade}/100` : ''}
                  {quickEditLead.whatsapp ? ` · ${quickEditLead.whatsapp}` : ''}
                </p>
              </div>
              <button
                type="button"
                disabled={quickSaving}
                onClick={() => setQuickEditLead(null)}
                aria-label="Fechar edição rápida"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 shrink-0 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {quickError && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-[#C82333] font-medium">
                  {quickError}
                </div>
              )}

              {/* Seleção rápida da etapa do funil em 1 clique */}
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Status no funil</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FUNIL_STAGES.map((st) => {
                    const active = quickStatus === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setQuickStatus(st)}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left flex items-center justify-between gap-1.5 transition-colors ${
                          active
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="truncate">{st}</span>
                        {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Prioridade + Temperatura */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Urgência / Prioridade</p>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setQuickPriority(p)}
                        className={`py-1.5 px-1.5 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          quickPriority === p
                            ? p === 'Urgente'
                              ? 'bg-[#C82333] text-white'
                              : p === 'Alta'
                                ? 'bg-amber-600 text-white'
                                : 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-1.5">Temperatura comercial</p>
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                    {TEMPERATURES.map((temp) => (
                      <button
                        key={temp}
                        type="button"
                        onClick={() => setQuickTemperature(temp)}
                        className={`py-1.5 px-2 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                          quickTemperature === temp
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {temp}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {quickStatus === 'Perdido' && (
                <div className="space-y-2 p-3 rounded-lg bg-red-50/50 border border-red-200">
                  <label htmlFor="kanban-quick-loss" className="block text-xs font-semibold text-slate-800">
                    Motivo da perda
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {LOSS_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setQuickLossReason(preset)}
                        className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                          quickLossReason === preset
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <input
                    id="kanban-quick-loss"
                    type="text"
                    value={quickLossReason}
                    onChange={(e) => setQuickLossReason(e.target.value)}
                    placeholder="Descreva o motivo da perda..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="kanban-quick-notes" className="block text-xs font-semibold text-slate-700">
                    Notas internas / Próximo passo
                  </label>
                  <span className="text-[11px] text-slate-400 tabular-nums">{quickNotes.length}/4000</span>
                </div>
                <textarea
                  id="kanban-quick-notes"
                  rows={3}
                  maxLength={4000}
                  value={quickNotes}
                  onChange={(e) => setQuickNotes(e.target.value)}
                  placeholder="Registre resumo do contato, pendência ou data prevista de retorno..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {quickEditLead.respostasTriagem && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = quickEditLead;
                      setQuickEditLead(null);
                      onInspectLead(target);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver diagnóstico completo
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={quickSaving}
                  onClick={() => setQuickEditLead(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={quickSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {quickSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {quickSaving ? 'Atualizando...' : 'Salvar status'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal de Motivo de Perda ao arrastar direto para Perdido */}
      {lossModalLead && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLossModalLead(null);
          }}
        >
          <form onSubmit={handleConfirmLoss} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">Mover para &quot;Perdido&quot; — {lossModalLead.nome}</h3>
              <button
                type="button"
                onClick={() => setLossModalLead(null)}
                aria-label="Cancelar movimentação"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Registre o motivo da perda para alimentar o painel de Inteligência e métricas de conversão.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {LOSS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLossReason(preset)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                    lossReason === preset
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="kanban-loss-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo detalhado
              </label>
              <input
                id="kanban-loss-reason"
                type="text"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                placeholder="Descreva o motivo..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLossModalLead(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#C82333]"
              >
                Confirmar perda
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
