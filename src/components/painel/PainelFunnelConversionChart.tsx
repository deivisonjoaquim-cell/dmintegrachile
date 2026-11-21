import React, { useMemo } from 'react';
import type { Case, Lead } from '../../types/domain';
import { MACRO_FUNNEL_STAGES, type MacroFunnelStageId } from '../../utils/funnelModel';
import {
  matchesCreatedDateRange,
  type FunnelPerformancePeriod,
} from '../../utils/funnelPerformanceModel';

interface PainelFunnelConversionChartProps {
  leads: Lead[];
  cases: Case[];
  period?: FunnelPerformancePeriod;
  fromDate?: string;
  toDate?: string;
  isDark?: boolean;
  highlightedStageId?: MacroFunnelStageId | null;
  onSelectStage?: (stageId: MacroFunnelStageId) => void;
}

export const PainelFunnelConversionChart: React.FC<PainelFunnelConversionChartProps> = ({
  leads,
  cases,
  period = 'all',
  fromDate,
  toDate,
  highlightedStageId = null,
  onSelectStage,
}) => {
  const stageCounts = useMemo(() => {
    const filteredLeads = leads.filter((l) =>
      matchesCreatedDateRange(l.createdAt, { period, fromDate, toDate }),
    );
    const filteredCases = cases.filter((c) =>
      matchesCreatedDateRange(c.createdAt, { period, fromDate, toDate }),
    );

    const counts: Record<MacroFunnelStageId, number> = {
      diagnostico: filteredLeads.filter(
        (l) =>
          l.statusFunil === 'Novo' ||
          l.statusFunil === 'Contatado' ||
          l.statusFunil === 'Diagnóstico Agendado',
      ).length,
      proposta: filteredLeads.filter((l) => l.statusFunil === 'Orçamento Enviado').length,
      documentacao: filteredCases.filter((c) => c.etapaPipeline <= 6).length,
      tramite: filteredCases.filter((c) => c.etapaPipeline >= 7 && c.etapaPipeline <= 12).length,
      finalizacao: filteredCases.filter((c) => c.etapaPipeline >= 13).length,
    };
    const maxCount = Math.max(1, ...Object.values(counts));
    return { counts, maxCount };
  }, [leads, cases, period, fromDate, toDate]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Distribuição e Conversão por Macro-Etapa
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Clique em uma etapa para filtrar os registros correspondentes no funil.
        </p>
      </div>
      <div className="space-y-2.5">
        {MACRO_FUNNEL_STAGES.map((stage) => {
          const count = stageCounts.counts[stage.id] || 0;
          const pct = Math.round((count / stageCounts.maxCount) * 100);
          const active = highlightedStageId === stage.id;
          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage?.(stage.id)}
              className={`w-full text-left p-2.5 rounded-lg border transition-colors ${
                active
                  ? 'border-[var(--color-primary)] bg-slate-50 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{stage.nome}</span>
                <span className="font-bold text-slate-900 dark:text-white tabular-nums">{count}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(count > 0 ? 6 : 0, pct)}%`,
                    backgroundColor: stage.corHex || 'var(--color-primary)',
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
