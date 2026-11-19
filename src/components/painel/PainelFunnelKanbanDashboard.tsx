import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  Calendar,
  ExternalLink,
  Search,
  User,
  X,
} from 'lucide-react';
import { reportAppError } from '../../services/errorService';
import { saveDocumentAudited } from '../../services/firestoreService';
import type {
  Case,
  CaseDocument,
  Client,
  Deadline,
  EmpresaConfig,
  Lead,
  Task,
  UserProfile,
  UserRole,
} from '../../types/domain';
import { formatDateBR } from '../../utils/formatters';
import type { MacroFunnelStageId } from '../../utils/funnelModel';
import {
  buildFunnelKanbanBoard,
  evaluateKanbanMove,
  type FunnelKanbanCard,
  type FunnelKanbanFilterKind,
  type FunnelKanbanSortBy,
} from '../../utils/funnelKanbanModel';
import type { FunnelPerformancePeriod } from '../../utils/funnelPerformanceModel';
import { PainelFunnelPerformanceSummary } from './PainelFunnelPerformanceSummary';

interface PainelFunnelKanbanDashboardProps {
  role: UserRole;
  currentUser: UserProfile | null;
  staffUsers: UserProfile[];
  empresa: EmpresaConfig;
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  docs: CaseDocument[];
  tasks: Task[];
  deadlines: Deadline[];
  onOpenCase: (caseId: string, targetTab?: 'resumo' | 'comunicacao') => void;
  onOpenLeads: () => void;
  onRefresh: () => Promise<void>;
}

const SORT_LABELS: { id: FunnelKanbanSortBy; label: string }[] = [
  { id: 'urgency_date', label: 'Ordenar: Urgência e alertas' },
  { id: 'created_desc', label: 'Ordenar: Mais recentes' },
  { id: 'created_asc', label: 'Ordenar: Mais antigos' },
  { id: 'progress_desc', label: 'Ordenar: Maior progresso' },
  { id: 'name_asc', label: 'Ordenar: Nome (A–Z)' },
];

export const PainelFunnelKanbanDashboard: React.FC<PainelFunnelKanbanDashboardProps> = ({
  role,
  currentUser,
  staffUsers,
  empresa,
  leads,
  clients,
  cases,
  docs,
  tasks,
  deadlines,
  onOpenCase,
  onOpenLeads,
  onRefresh,
}) => {
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<FunnelKanbanFilterKind>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'Urgente' | 'Alta' | 'Média' | 'Baixa'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<FunnelPerformancePeriod>('all');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [sortBy, setSortBy] = useState<FunnelKanbanSortBy>('urgency_date');
  const [focusedStageId, setFocusedStageId] = useState<MacroFunnelStageId | null>(null);

  const [movingCardId, setMovingCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<MacroFunnelStageId | null>(null);
  const [notice, setNotice] = useState<{
    tone: 'success' | 'warning';
    message: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  const minProtocolScore = empresa.bloqueioProtocoloMinimo ?? 100;

  const board = useMemo(
    () =>
      buildFunnelKanbanBoard({
        leads,
        clients,
        cases,
        docs,
        tasks,
        deadlines,
        staffUsers,
        currentUser,
        bloqueioProtocoloMinimo: minProtocolScore,
        filters: {
          query,
          kind: kindFilter,
          priority: priorityFilter,
          assigneeId: assigneeFilter,
          datePreset,
          createdFrom,
          createdTo,
          sortBy,
        },
      }),
    [
      leads,
      clients,
      cases,
      docs,
      tasks,
      deadlines,
      staffUsers,
      currentUser,
      minProtocolScore,
      query,
      kindFilter,
      priorityFilter,
      assigneeFilter,
      datePreset,
      createdFrom,
      createdTo,
      sortBy,
    ],
  );

  const cardById = useMemo(() => {
    const map = new Map<string, FunnelKanbanCard>();
    for (const col of board.columns) {
      for (const card of col.cards) {
        map.set(card.id, card);
      }
    }
    return map;
  }, [board]);

  const hasActiveFilters = Boolean(
    query.trim() ||
      kindFilter !== 'all' ||
      priorityFilter !== 'all' ||
      assigneeFilter !== 'all' ||
      datePreset !== 'all' ||
      createdFrom ||
      createdTo ||
      sortBy !== 'urgency_date' ||
      focusedStageId !== null,
  );

  const handleClearFilters = () => {
    setQuery('');
    setKindFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setDatePreset('all');
    setCreatedFrom('');
    setCreatedTo('');
    setSortBy('urgency_date');
    setFocusedStageId(null);
  };

  const handleChangePeriod = (nextPeriod: FunnelPerformancePeriod) => {
    setDatePreset(nextPeriod);
    if (nextPeriod !== 'custom') {
      setCreatedFrom('');
      setCreatedTo('');
    }
  };

  const handleMoveCard = async (card: FunnelKanbanCard, targetStageId: MacroFunnelStageId) => {
    const evaluation = evaluateKanbanMove({
      card,
      targetStageId,
      bloqueioProtocoloMinimo: minProtocolScore,
    });

    if (!evaluation.allowed) {
      if (evaluation.reason === 'same-stage') return;
      if (evaluation.reason === 'requires-lead-conversion') {
        setNotice({
          tone: 'warning',
          message: evaluation.message,
          actionLabel: 'Abrir Leads para converter',
          onAction: () => {
            setNotice(null);
            onOpenLeads();
          },
        });
        return;
      }
      if (evaluation.reason === 'protocol-gate-blocked') {
        setNotice({
          tone: 'warning',
          message: evaluation.message,
          actionLabel: 'Abrir Documentos do Caso',
          onAction: () => {
            setNotice(null);
            onOpenCase(evaluation.caseId, 'resumo');
          },
        });
        return;
      }
      return;
    }

    setMovingCardId(card.id);
    setNotice(null);
    try {
      if (evaluation.entity === 'lead' && card.lead) {
        await saveDocumentAudited(
          'leads',
          evaluation.leadId,
          { ...card.lead, statusFunil: evaluation.nextStatusFunil },
          false,
          role,
          'mover_funil_kanban_lead',
          card.lead,
        );
        setNotice({
          tone: 'success',
          message: `"${card.clientName}" atualizado para ${evaluation.nextStatusFunil}.`,
        });
      } else if (evaluation.entity === 'case' && card.caseRecord) {
        const nextCasePayload: Record<string, unknown> = {
          ...card.caseRecord,
          etapaPipeline: evaluation.targetPipelineStep,
          ...(evaluation.nextStatusSermig ? { statusSermig: evaluation.nextStatusSermig } : {}),
        };
        await saveDocumentAudited(
          'cases',
          evaluation.caseId,
          nextCasePayload,
          false,
          role,
          'mover_funil_kanban_caso',
          card.caseRecord,
        );
        setNotice({
          tone: 'success',
          message: `"${card.clientName}" avançado no funil com sucesso.`,
        });
      }
      await onRefresh();
    } catch (err) {
      reportAppError(err, { source: 'funnel-kanban-move' });
    } finally {
      setMovingCardId(null);
    }
  };

  const handleDropOnColumn = (targetStageId: MacroFunnelStageId, e: React.DragEvent) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggingCardId;
    setDraggingCardId(null);
    setDragOverStageId(null);
    if (!droppedId) return;
    const card = cardById.get(droppedId);
    if (card) {
      void handleMoveCard(card, targetStageId);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho Principal */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Dashboard de Funil (Kanban)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Acompanhe taxas de conversão etapa a etapa e gerencie clientes entre Diagnóstico, Proposta, Documentação, Trâmite e Finalização.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
          <span>
            Exibindo{' '}
            <strong className="text-slate-900 dark:text-slate-100">{board.totalVisibleCards}</strong> de{' '}
            <strong className="text-slate-900 dark:text-slate-100">{board.totalAllCards}</strong> ativo(s)
          </span>
          {board.attentionCardsCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-[#C82333] dark:text-red-400">
                {board.attentionCardsCount} requer(em) atenção
              </span>
            </>
          )}
        </div>
      </div>

      {/* Resumo de Desempenho & Taxas de Conversão entre Etapas (Sincronizado com o Período) */}
      <PainelFunnelPerformanceSummary
        leads={leads}
        cases={cases}
        period={datePreset}
        fromDate={createdFrom}
        toDate={createdTo}
        highlightedStageId={focusedStageId}
        onChangePeriod={handleChangePeriod}
        onSelectStage={(stageId) =>
          setFocusedStageId((prev) => (prev === stageId ? null : stageId))
        }
      />

      {/* Barra de Pesquisa, Filtros (Data, Urgência, Responsável) e Ordenação */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3">
        {/* Linha 1: Pesquisa + Tipo de Registro */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar cliente, visto, nº SERMIG ou consultor..."
              aria-label="Pesquisar clientes no funil Kanban"
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
            />
          </div>

          <div
            role="group"
            aria-label="Filtrar tipo de registro no funil"
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium overflow-x-auto max-w-full"
          >
            {(
              [
                { id: 'all', label: `Todos (${board.totalAllCards})` },
                { id: 'cases', label: 'Processos' },
                { id: 'leads', label: 'Leads' },
                { id: 'attention', label: `Atenção (${board.attentionCardsCount})` },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setKindFilter(opt.id)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums transition-colors ${
                  kindFilter === opt.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 2: Data de Criação + Urgência + Responsável + Ordenação */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <select
              value={datePreset}
              onChange={(e) => handleChangePeriod(e.target.value as FunnelPerformancePeriod)}
              aria-label="Filtrar por data de criação"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              <option value="all">Criação: Qualquer data</option>
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="custom">Período personalizado</option>
            </select>
          </div>

          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <label className="inline-flex items-center gap-1">
                <span>De</span>
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => setCreatedFrom(e.target.value)}
                  aria-label="Data inicial de criação"
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </label>
              <label className="inline-flex items-center gap-1">
                <span>Até</span>
                <input
                  type="date"
                  value={createdTo}
                  onChange={(e) => setCreatedTo(e.target.value)}
                  aria-label="Data final de criação"
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </label>
            </div>
          )}

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
            aria-label="Filtrar por urgência ou prioridade"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            <option value="all">Urgência: Todas</option>
            <option value="Urgente">Urgente</option>
            <option value="Alta">Alta</option>
            <option value="Média">Média</option>
            <option value="Baixa">Baixa</option>
          </select>

          <div className="inline-flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              aria-label="Filtrar por responsável pela consultoria"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[210px]"
            >
              <option value="all">Responsável: Todos</option>
              <option value="unassigned">Sem responsável ({board.unassignedCount})</option>
              {board.assigneeOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label} ({opt.count})
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center gap-1.5 md:ml-auto">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as FunnelKanbanSortBy)}
              aria-label="Ordenar cartões nas colunas do Kanban"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              {SORT_LABELS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* Feedback Operacional / Trava Documental / Conversão de Lead */}
      {notice && (
        <div
          role={notice.tone === 'warning' ? 'alert' : 'status'}
          className={`rounded-xl border px-4 py-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            notice.tone === 'warning'
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200'
              : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200'
          }`}
        >
          <span className="font-medium">{notice.message}</span>
          <div className="flex items-center gap-2 shrink-0">
            {notice.actionLabel && notice.onAction && (
              <button
                type="button"
                onClick={notice.onAction}
                className="px-3 py-1 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold whitespace-nowrap"
              >
                {notice.actionLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Fechar aviso"
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Quadro Kanban em 5 Colunas (Diagnóstico → Proposta → Documentação → Trâmite → Finalização) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5 items-start">
        {board.columns.map((col) => {
          const isDropTarget = dragOverStageId === col.stage.id;
          const isFocused = focusedStageId === col.stage.id;

          return (
            <section
              key={col.stage.id}
              aria-label={`Etapa ${col.stage.ordem}: ${col.stage.nome}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverStageId !== col.stage.id) {
                  setDragOverStageId(col.stage.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverStageId === col.stage.id) {
                  setDragOverStageId(null);
                }
              }}
              onDrop={(e) => handleDropOnColumn(col.stage.id, e)}
              className={`rounded-xl border bg-slate-50/70 dark:bg-slate-900/60 transition-colors flex flex-col min-h-[340px] ${
                isDropTarget || isFocused
                  ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              {/* Cabeçalho da Coluna */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: col.stage.corHex }}
                      aria-hidden="true"
                    />
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {col.stage.ordem}. {col.stage.nome}
                    </h2>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                    {col.cards.length}
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  {col.stage.marcoConversao}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  <span>
                    {col.conversionFromPrevPct !== null
                      ? `${col.conversionFromPrevPct}% avanço`
                      : 'Entrada do funil'}
                  </span>
                  {col.isBottleneck && (
                    <span className="font-semibold text-amber-700 dark:text-amber-400">
                      Maior volume
                    </span>
                  )}
                </div>
              </div>

              {/* Lista de Cartões de Clientes */}
              <div className="p-2.5 space-y-2.5 flex-1">
                {col.cards.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 py-8 px-3 text-center">
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Nenhum cliente nesta etapa
                    </p>
                  </div>
                ) : (
                  col.cards.map((card) => {
                    const isMoving = movingCardId === card.id;
                    const isDragging = draggingCardId === card.id;

                    return (
                      <article
                        key={card.id}
                        draggable={!isMoving}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', card.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggingCardId(card.id);
                        }}
                        onDragEnd={() => {
                          setDraggingCardId(null);
                          setDragOverStageId(null);
                        }}
                        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-2 transition-opacity ${
                          isDragging || isMoving ? 'opacity-50' : 'hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Linha Superior: Nome do Cliente + Progresso */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                              {card.clientName}
                            </p>
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                              {card.title}
                            </p>
                          </div>
                          <span className="text-[11px] font-bold tabular-nums text-slate-700 dark:text-slate-300 shrink-0">
                            {card.progressPct}%
                          </span>
                        </div>

                        {/* Barra de Progresso Visual do Cliente */}
                        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${card.progressPct}%`,
                              backgroundColor: col.stage.corHex,
                            }}
                          />
                        </div>

                        {/* Metadados Limpos (Zero Pills — texto limpo com separadores ·) */}
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                          {card.kind === 'lead' ? 'Lead' : 'Processo'}
                          <span aria-hidden="true"> · </span>
                          {card.priority}
                          <span aria-hidden="true"> · </span>
                          {card.subtitle}
                        </p>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate tabular-nums">
                          {card.assigneeName ? card.assigneeName : 'Sem responsável'}
                          {card.createdAt ? ` · ${formatDateBR(card.createdAt)}` : ''}
                        </p>

                        {card.kind === 'case' && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            Docs {card.docsPct ?? 0}%
                            {card.totalTasksCount > 0
                              ? ` · Tarefas ${card.completedTasksCount}/${card.totalTasksCount}`
                              : ''}
                            {card.sermigStatus && card.sermigStatus !== 'Não protocolado'
                              ? ` · ${card.sermigStatus}`
                              : ''}
                          </p>
                        )}

                        {/* Alerta de Atenção (texto explícito + ícone, nunca apenas cor) */}
                        {card.hasAttention && card.attentionReason && (
                          <p className="text-[11px] font-semibold text-[#C82333] dark:text-red-400 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span className="truncate">{card.attentionReason}</span>
                          </p>
                        )}

                        {/* Rodapé de Ações Diretas */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (card.kind === 'case' && card.caseRecord) {
                                onOpenCase(card.caseRecord.id);
                              } else {
                                onOpenLeads();
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline whitespace-nowrap"
                          >
                            <span>Abrir</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>

                          <div className="flex items-center gap-1 shrink-0">
                            {card.prevStage && (
                              <button
                                type="button"
                                disabled={isMoving}
                                onClick={() => void handleMoveCard(card, card.prevStage!.id)}
                                title={`Voltar para ${card.prevStage.nome}`}
                                aria-label={`Voltar ${card.clientName} para ${card.prevStage.nome}`}
                                className="p-1 rounded border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                              >
                                <ArrowLeft className="w-3 h-3" />
                              </button>
                            )}
                            {card.nextStage && (
                              <button
                                type="button"
                                disabled={isMoving}
                                onClick={() => void handleMoveCard(card, card.nextStage!.id)}
                                title={`Avançar para ${card.nextStage.nome}`}
                                aria-label={`Avançar ${card.clientName} para ${card.nextStage.nome}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 whitespace-nowrap"
                              >
                                <span>{card.nextStage.nomeCurto}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
