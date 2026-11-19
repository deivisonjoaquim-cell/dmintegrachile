import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  TrendingDown,
} from 'lucide-react';
import type { Case, Lead } from '../../types/domain';
import type { MacroFunnelStageId } from '../../utils/funnelModel';
import {
  computeFunnelPerformanceSummary,
  type FunnelPerformancePeriod,
  type FunnelTransitionMetric,
} from '../../utils/funnelPerformanceModel';

interface PainelFunnelPerformanceSummaryProps {
  leads: Lead[];
  cases: Case[];
  period: FunnelPerformancePeriod;
  fromDate?: string;
  toDate?: string;
  highlightedStageId?: MacroFunnelStageId | null;
  onChangePeriod: (period: FunnelPerformancePeriod) => void;
  onSelectStage?: (stageId: MacroFunnelStageId) => void;
  onOpenKanban?: () => void;
}

const PERIOD_OPTIONS: { id: Exclude<FunnelPerformancePeriod, 'custom'>; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: '7d', label: '7 dias' },
  { id: '30d', label: '30 dias' },
  { id: '90d', label: '90 dias' },
];

function getTransitionStatusMeta(t: FunnelTransitionMetric): {
  label: string;
  textClass: string;
  barColor: string;
  icon: React.ReactNode;
} {
  if (t.conversionPct === null) {
    return {
      label: 'Sem volume',
      textClass: 'text-slate-400 dark:text-slate-500',
      barColor: '#94A3B8',
      icon: null,
    };
  }
  if (t.isPrimaryBottleneck) {
    return {
      label: 'Gargalo prioritário',
      textClass: 'text-[#C82333] dark:text-red-400',
      barColor: '#C82333',
      icon: <AlertTriangle className="w-3.5 h-3.5 shrink-0" />,
    };
  }
  if (t.health === 'critical') {
    return {
      label: 'Queda elevada',
      textClass: 'text-[#C82333] dark:text-red-400',
      barColor: '#C82333',
      icon: <TrendingDown className="w-3.5 h-3.5 shrink-0" />,
    };
  }
  if (t.health === 'attention') {
    return {
      label: 'Atenção',
      textClass: 'text-amber-700 dark:text-amber-400',
      barColor: '#D97706',
      icon: <TrendingDown className="w-3.5 h-3.5 shrink-0" />,
    };
  }
  return {
    label: 'Saudável',
    textClass: 'text-[#1E7E34] dark:text-emerald-400',
    barColor: '#1E7E34',
    icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
  };
}

export const PainelFunnelPerformanceSummary: React.FC<PainelFunnelPerformanceSummaryProps> = ({
  leads,
  cases,
  period,
  fromDate,
  toDate,
  highlightedStageId = null,
  onChangePeriod,
  onSelectStage,
  onOpenKanban,
}) => {
  const summary = useMemo(
    () =>
      computeFunnelPerformanceSummary({
        leads,
        cases,
        period,
        fromDate,
        toDate,
      }),
    [leads, cases, period, fromDate, toDate],
  );

  return (
    <section
      aria-label="Resumo de desempenho e conversão do funil"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
    >
      {/* Cabeçalho + Seletor de Período */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Desempenho &amp; Conversão entre Etapas
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Taxas de avanço e retenção etapa a etapa para identificar gargalos no processo de venda e operação
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Filtrar período de análise de conversão"
            className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-medium"
          >
            {PERIOD_OPTIONS.map((opt) => {
              const active = period === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangePeriod(opt.id)}
                  className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            {period === 'custom' && (
              <span className="px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold shadow-xs whitespace-nowrap">
                Personalizado
              </span>
            )}
          </div>

          {onOpenKanban && (
            <button
              type="button"
              onClick={onOpenKanban}
              className="text-xs font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline whitespace-nowrap"
            >
              Abrir Funil Kanban →
            </button>
          )}
        </div>
      </div>

      {/* Faixa de KPIs Consolidados + Diagnóstico do Gargalo */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Base analisada:{' '}
            <strong className="text-slate-900 dark:text-slate-100">{summary.totalAnalyzed}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Conversão comercial:{' '}
            <strong className="text-slate-900 dark:text-slate-100">
              {summary.overallCommercialConversionPct}%
            </strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Conclusão ponta a ponta:{' '}
            <strong className="text-[#1E7E34] dark:text-emerald-400">
              {summary.endToEndCompletionPct}%
            </strong>
          </span>
          {summary.lostLeadsCount > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Leads perdidos:{' '}
                <strong className="text-[#C82333] dark:text-red-400">{summary.lostLeadsCount}</strong>
              </span>
            </>
          )}
        </div>

        {summary.primaryBottleneck && (
          <div className="flex items-center gap-1.5 font-semibold text-[#C82333] dark:text-red-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>
              Gargalo: {summary.primaryBottleneck.fromStage.nome} → {summary.primaryBottleneck.toStage.nome} (
              {summary.primaryBottleneck.conversionPct}% avanço · {summary.primaryBottleneck.dropOffPct}% queda)
            </span>
          </div>
        )}
      </div>

      {/* Estado Vazio do Período ou Grid de 4 Transições */}
      {summary.totalAnalyzed === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 py-6 px-4 text-center space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Nenhum lead ou processo criado neste período para calcular taxas de conversão.
          </p>
          {period !== 'all' && (
            <button
              type="button"
              onClick={() => onChangePeriod('all')}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Ver todo o período
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {summary.transitions.map((t) => {
            const meta = getTransitionStatusMeta(t);
            const isSelected = highlightedStageId === t.fromStage.id;

            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectStage?.(t.fromStage.id)}
                disabled={!onSelectStage}
                className={`text-left rounded-lg border p-3.5 space-y-2 transition-colors ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-slate-50 dark:bg-slate-800/80'
                    : t.isPrimaryBottleneck
                      ? 'border-red-200 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 hover:border-red-300 dark:hover:border-red-800'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700'
                } ${onSelectStage ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <span className="inline-flex items-center gap-1 min-w-0 truncate">
                    <span className="truncate">{t.fromStage.nomeCurto}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">{t.toStage.nomeCurto}</span>
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-2 tabular-nums">
                  <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {t.conversionPct !== null ? `${t.conversionPct}%` : '—'}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${meta.textClass}`}>
                    {meta.icon}
                    <span>{meta.label}</span>
                  </span>
                </div>

                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${t.conversionPct ?? 0}%`,
                      backgroundColor: meta.barColor,
                    }}
                  />
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {t.enteredCount > 0 ? (
                    <>
                      {t.advancedCount} de {t.enteredCount} avançaram
                      <span aria-hidden="true"> · </span>
                      {t.droppedCount} retido(s)/perdido(s)
                      {t.dropOffPct !== null ? ` (${t.dropOffPct}% queda)` : ''}
                    </>
                  ) : (
                    'Sem entradas nesta transição'
                  )}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
