import React from 'react';
import { Search, X } from 'lucide-react';
import type { UserProfile } from '../../types/domain';
import type { MacroFunnelStageId } from '../../utils/funnelModel';
import type {
  FunnelKanbanAssigneeOption,
  FunnelKanbanFilterKind,
  FunnelKanbanSortBy,
} from '../../utils/funnelKanbanModel';
import type { FunnelPerformancePeriod } from '../../utils/funnelPerformanceModel';

interface PainelKanbanFilterBarProps {
  query: string;
  onChangeQuery: (value: string) => void;
  kindFilter: FunnelKanbanFilterKind;
  onChangeKindFilter: (value: FunnelKanbanFilterKind) => void;
  priorityFilter: 'all' | 'Urgente' | 'Alta' | 'Média' | 'Baixa';
  onChangePriorityFilter: (value: 'all' | 'Urgente' | 'Alta' | 'Média' | 'Baixa') => void;
  priorityCounts: Record<'Urgente' | 'Alta' | 'Média' | 'Baixa', number>;
  assigneeFilter: string;
  onChangeAssigneeFilter: (value: string) => void;
  assigneeOptions: FunnelKanbanAssigneeOption[];
  unassignedCount: number;
  currentUser?: UserProfile | null;
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

export const PainelKanbanFilterBar: React.FC<PainelKanbanFilterBarProps> = ({
  query,
  onChangeQuery,
  kindFilter,
  onChangeKindFilter,
  priorityFilter,
  onChangePriorityFilter,
  assigneeFilter,
  onChangeAssigneeFilter,
  assigneeOptions,
  unassignedCount,
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
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => onChangeQuery(e.target.value)}
            placeholder="Buscar cliente, lead ou protocolo SERMIG..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100"
          />
        </div>

        <select
          value={kindFilter}
          onChange={(e) => onChangeKindFilter(e.target.value as FunnelKanbanFilterKind)}
          aria-label="Filtrar por tipo de registro"
          className="w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100"
        >
          <option value="all">Todos ({totalAllCards})</option>
          <option value="cases">Processos ativos</option>
          <option value="leads">Leads comerciais</option>
          <option value="attention">Requer atenção ({attentionCardsCount})</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) =>
            onChangePriorityFilter(
              e.target.value as 'all' | 'Urgente' | 'Alta' | 'Média' | 'Baixa',
            )
          }
          aria-label="Filtrar por prioridade"
          className="w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100"
        >
          <option value="all">Todas prioridades</option>
          <option value="Urgente">Urgente</option>
          <option value="Alta">Alta</option>
          <option value="Média">Média</option>
          <option value="Baixa">Baixa</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => onChangeSortBy(e.target.value as FunnelKanbanSortBy)}
          aria-label="Ordenar cartões"
          className="w-full min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100"
        >
          <option value="urgency_date">Urgência + Data</option>
          <option value="created_desc">Mais recentes</option>
          <option value="created_asc">Mais antigos</option>
          <option value="progress_desc">Maior progresso</option>
          <option value="name_asc">Nome (A–Z)</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
          <select
            value={assigneeFilter}
            onChange={(e) => onChangeAssigneeFilter(e.target.value)}
            aria-label="Filtrar por responsável"
            className="min-w-0 max-w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100"
          >
            <option value="all">Todos responsáveis</option>
            <option value="unassigned">Sem responsável ({unassignedCount})</option>
            {assigneeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.count})
              </option>
            ))}
          </select>

          <select
            value={datePreset}
            onChange={(e) => onChangeDatePreset(e.target.value as FunnelPerformancePeriod)}
            aria-label="Filtrar por período"
            className="min-w-0 max-w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-800 dark:text-slate-100"
          >
            <option value="all">Todo período</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="30d">Últimos 30 dias</option>
            <option value="90d">Últimos 90 dias</option>
            <option value="custom">Personalizado</option>
          </select>

          {datePreset === 'custom' && (
            <>
              <input
                type="date"
                value={createdFrom}
                onChange={(e) => onChangeCreatedFrom(e.target.value)}
                className="min-w-0 max-w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
              <input
                type="date"
                value={createdTo}
                onChange={(e) => onChangeCreatedTo(e.target.value)}
                className="min-w-0 max-w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-slate-500 dark:text-slate-400 tabular-nums">
          <span>
            Exibindo <strong className="text-slate-900 dark:text-white">{totalVisibleCards}</strong> de {totalAllCards}
          </span>
          {focusedStageId && (
            <button
              type="button"
              onClick={onClearFocusedStage}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Limpar etapa
              <X className="w-3 h-3" />
            </button>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
