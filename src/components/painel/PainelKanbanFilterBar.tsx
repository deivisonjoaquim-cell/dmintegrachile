import React from 'react';
import { ArrowUpDown, Calendar, Search, SlidersHorizontal, User, X } from 'lucide-react';
import type { UserProfile } from '../../types/domain';
import type {
  FunnelKanbanAssigneeOption,
  FunnelKanbanFilterKind,
  FunnelKanbanSortBy,
} from '../../utils/funnelKanbanModel';
import type { MacroFunnelStageId } from '../../utils/funnelModel';
import type { FunnelPerformancePeriod } from '../../utils/funnelPerformanceModel';

export type KanbanUrgencyFilter = 'all' | 'Urgente' | 'Alta' | 'Média' | 'Baixa';

interface PainelKanbanFilterBarProps {
  query: string;
  onChangeQuery: (value: string) => void;
  kindFilter: FunnelKanbanFilterKind;
  onChangeKindFilter: (value: FunnelKanbanFilterKind) => void;
  priorityFilter: KanbanUrgencyFilter;
  onChangePriorityFilter: (value: KanbanUrgencyFilter) => void;
  priorityCounts: Record<'Urgente' | 'Alta' | 'Média' | 'Baixa', number>;
  assigneeFilter: string;
  onChangeAssigneeFilter: (value: string) => void;
  assigneeOptions: FunnelKanbanAssigneeOption[];
  unassignedCount: number;
  currentUser: UserProfile | null;
  datePreset: FunnelPerformancePeriod;
  onChangeDatePreset: (value: FunnelPerformancePeriod) => void;
  createdFrom: string;
  onChangeCreatedFrom: (value: string) => void;
  createdTo: string;
  onChangeCreatedTo: (value: string) => void;
  sortBy: FunnelKanbanSortBy;
  onChangeSortBy: (value: FunnelKanbanSortBy) => void;
  focusedStageId: MacroFunnelStageId | null;
  onClearFocusedStage: () => void;
  totalVisibleCards: number;
  totalAllCards: number;
  attentionCardsCount: number;
  hasActiveFilters: boolean;
  onClearAll: () => void;
}

const SORT_LABELS: { id: FunnelKanbanSortBy; label: string }[] = [
  { id: 'urgency_date', label: 'Urgência e alertas primeiro' },
  { id: 'created_desc', label: 'Criação: Mais recentes' },
  { id: 'created_asc', label: 'Criação: Mais antigos' },
  { id: 'progress_desc', label: 'Maior progresso' },
  { id: 'name_asc', label: 'Nome do cliente (A–Z)' },
];

const URGENCY_OPTIONS: { id: KanbanUrgencyFilter; label: string; accentClass?: string }[] = [
  { id: 'all', label: 'Todas' },
  { id: 'Urgente', label: 'Urgente', accentClass: 'text-[#C82333] dark:text-red-400' },
  { id: 'Alta', label: 'Alta', accentClass: 'text-amber-700 dark:text-amber-400' },
  { id: 'Média', label: 'Média' },
  { id: 'Baixa', label: 'Baixa' },
];

const STAGE_LABEL_MAP: Record<MacroFunnelStageId, string> = {
  diagnostico: 'Diagnóstico',
  proposta: 'Proposta',
  documentacao: 'Documentação',
  tramite: 'Trâmite',
  finalizacao: 'Finalização',
};

export const PainelKanbanFilterBar: React.FC<PainelKanbanFilterBarProps> = ({
  query,
  onChangeQuery,
  kindFilter,
  onChangeKindFilter,
  priorityFilter,
  onChangePriorityFilter,
  priorityCounts,
  assigneeFilter,
  onChangeAssigneeFilter,
  assigneeOptions,
  unassignedCount,
  currentUser,
  datePreset,
  onChangeDatePreset,
  createdFrom,
  onChangeCreatedFrom,
  createdTo,
  onChangeCreatedTo,
  sortBy,
  onChangeSortBy,
  focusedStageId,
  onClearFocusedStage,
  totalVisibleCards,
  totalAllCards,
  attentionCardsCount,
  hasActiveFilters,
  onClearAll,
}) => {
  const isMyClientsActive = Boolean(currentUser?.uid && assigneeFilter === currentUser.uid);

  const activeSummaryParts: string[] = [];
  if (query.trim()) activeSummaryParts.push(`Busca: "${query.trim()}"`);
  if (kindFilter !== 'all') {
    const map: Record<Exclude<FunnelKanbanFilterKind, 'all'>, string> = {
      cases: 'Processos',
      leads: 'Leads',
      attention: 'Com atenção',
    };
    activeSummaryParts.push(`Tipo: ${map[kindFilter]}`);
  }
  if (priorityFilter !== 'all') activeSummaryParts.push(`Urgência: ${priorityFilter}`);
  if (assigneeFilter === 'unassigned') {
    activeSummaryParts.push('Responsável: Sem responsável');
  } else if (assigneeFilter !== 'all') {
    const matched = assigneeOptions.find((o) => o.id === assigneeFilter);
    activeSummaryParts.push(`Responsável: ${matched?.label || assigneeFilter}`);
  }
  if (datePreset !== 'all') {
    if (datePreset === 'custom') {
      const rangeLabel = [createdFrom || 'início', createdTo || 'hoje'].join(' → ');
      activeSummaryParts.push(`Criação: ${rangeLabel}`);
    } else {
      const labels: Record<'7d' | '30d' | '90d', string> = {
        '7d': 'Últimos 7 dias',
        '30d': 'Últimos 30 dias',
        '90d': 'Últimos 90 dias',
      };
      activeSummaryParts.push(`Criação: ${labels[datePreset]}`);
    }
  }
  if (focusedStageId) activeSummaryParts.push(`Etapa destacada: ${STAGE_LABEL_MAP[focusedStageId]}`);

  return (
    <section
      aria-label="Barra avançada de pesquisa e filtros do Kanban"
      className="bg-white dark:bg-[#0F1629] border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 space-y-3.5 shadow-[0_1px_2px_rgba(11,31,51,0.04)]"
    >
      {/* Linha 1: Pesquisa por nome + Seletor de Tipo */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-xl">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Pesquisar cliente por nome, visto, nº SERMIG ou consultor..."
            aria-label="Pesquisar cliente por nome no Kanban"
            className="w-full pl-9 pr-8 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[var(--color-primary)] dark:focus:border-sky-400 transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => onChangeQuery('')}
              aria-label="Limpar pesquisa por nome"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div
          role="group"
          aria-label="Filtrar tipo de registro no funil"
          className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-xs font-medium overflow-x-auto max-w-full shrink-0"
        >
          {(
            [
              { id: 'all', label: `Todos (${totalAllCards})` },
              { id: 'cases', label: 'Processos' },
              { id: 'leads', label: 'Leads' },
              { id: 'attention', label: `Atenção (${attentionCardsCount})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChangeKindFilter(opt.id)}
              className={`px-3 py-1.5 rounded-md whitespace-nowrap tabular-nums transition-colors ${
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

      {/* Linha 2: Filtros Estruturados (Nível de Urgência, Data de Criação, Responsável e Ordenação) */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-x-3 gap-y-2.5">
        {/* Nível de Urgência (Segmented Control Interativo) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Urgência:
          </span>
          <div
            role="group"
            aria-label="Filtrar por nível de urgência"
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700/70 text-xs font-medium"
          >
            {URGENCY_OPTIONS.map((opt) => {
              const active = priorityFilter === opt.id;
              const count = opt.id === 'all' ? null : priorityCounts[opt.id];
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangePriorityFilter(opt.id)}
                  className={`px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums transition-colors ${
                    active
                      ? `bg-white dark:bg-slate-900 font-semibold shadow-xs ${opt.accentClass || 'text-slate-900 dark:text-slate-100'}`
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {opt.label}
                  {count !== null ? ` (${count})` : ''}
                </button>
              );
            })}
          </div>
        </div>

        {/* Data de Criação */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <select
            value={datePreset}
            onChange={(e) => onChangeDatePreset(e.target.value as FunnelPerformancePeriod)}
            aria-label="Filtrar por data de criação"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[var(--color-primary)]"
          >
            <option value="all">Criação: Qualquer data</option>
            <option value="7d">Criação: Últimos 7 dias</option>
            <option value="30d">Criação: Últimos 30 dias</option>
            <option value="90d">Criação: Últimos 90 dias</option>
            <option value="custom">Criação: Período personalizado</option>
          </select>

          {datePreset === 'custom' && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
              <label className="inline-flex items-center gap-1">
                <span>De</span>
                <input
                  type="date"
                  value={createdFrom}
                  onChange={(e) => onChangeCreatedFrom(e.target.value)}
                  aria-label="Data inicial de criação"
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </label>
              <label className="inline-flex items-center gap-1">
                <span>Até</span>
                <input
                  type="date"
                  value={createdTo}
                  onChange={(e) => onChangeCreatedTo(e.target.value)}
                  aria-label="Data final de criação"
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 tabular-nums"
                />
              </label>
            </div>
          )}
        </div>

        {/* Responsável pela Consultoria + Atalho "Meus clientes" */}
        <div className="flex flex-wrap items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <select
            value={assigneeFilter}
            onChange={(e) => onChangeAssigneeFilter(e.target.value)}
            aria-label="Filtrar por responsável pela consultoria"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[220px] focus:outline-none focus:border-[var(--color-primary)]"
          >
            <option value="all">Responsável: Todos</option>
            <option value="unassigned">Sem responsável ({unassignedCount})</option>
            {assigneeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.count})
              </option>
            ))}
          </select>

          {currentUser?.uid && (
            <button
              type="button"
              onClick={() =>
                onChangeAssigneeFilter(isMyClientsActive ? 'all' : currentUser.uid)
              }
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                isMyClientsActive
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Meus clientes
            </button>
          )}
        </div>

        {/* Ordenação */}
        <div className="inline-flex items-center gap-1.5 xl:ml-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
          <select
            value={sortBy}
            onChange={(e) => onChangeSortBy(e.target.value as FunnelKanbanSortBy)}
            aria-label="Ordenar cartões nas colunas do Kanban"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[var(--color-primary)]"
          >
            {SORT_LABELS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                Ordenar: {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Linha 3 (Contextual): Resumo textual limpo dos filtros ativos + botão Limpar */}
      {hasActiveFilters && (
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 tabular-nums">
            <span>
              Resultado:{' '}
              <strong className="text-slate-900 dark:text-slate-100">{totalVisibleCards}</strong> de{' '}
              <strong className="text-slate-900 dark:text-slate-100">{totalAllCards}</strong>
            </span>
            {activeSummaryParts.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-500 dark:text-slate-400 truncate">
                  {activeSummaryParts.join(' · ')}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {focusedStageId && (
              <button
                type="button"
                onClick={onClearFocusedStage}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2"
              >
                Remover foco da etapa
              </button>
            )}
            <button
              type="button"
              onClick={onClearAll}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              Limpar filtros
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
