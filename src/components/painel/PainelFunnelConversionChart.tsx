import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Case, Lead } from '../../types/domain';
import type { MacroFunnelStageId } from '../../utils/funnelModel';
import {
  computeFunnelOccupancyMetrics,
  type FunnelStageOccupancyRow,
} from '../../utils/funnelOccupancyMetrics';
import type { FunnelPerformancePeriod } from '../../utils/funnelPerformanceModel';

type FunnelChartMode = 'combined' | 'occupancy';

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

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: FunnelStageOccupancyRow }>;
}

const FunnelStageTooltip: React.FC<ChartTooltipProps> = ({ active, payload }) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 shadow-lg text-xs text-slate-700 dark:text-slate-200 space-y-1.5 min-w-[210px]">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {row.ordem}. {row.nome}
        </span>
        <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100">
          {row.occupancyPct}% ocupação
        </span>
      </div>
      <div className="pt-1 border-t border-slate-100 dark:border-slate-800 space-y-1 tabular-nums">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Clientes/leads ativos na etapa</span>
          <strong className="text-slate-900 dark:text-slate-100">{row.activeCount}</strong>
        </div>
        <div className="flex items-center justify-between gap-4 text-[11px] text-slate-500 dark:text-slate-400">
          <span>Composição</span>
          <span>
            {row.casesCount} processo(s) · {row.leadsCount} lead(s)
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">Alcance acumulado do funil</span>
          <strong className="text-slate-900 dark:text-slate-100">
            {row.cumulativeReached} ({row.conversionFromEntryPct}%)
          </strong>
        </div>
        {row.ordem > 1 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-500 dark:text-slate-400">Conversão vs etapa anterior</span>
            <strong className="text-slate-900 dark:text-slate-100">
              {row.conversionFromPrevPct !== null ? `${row.conversionFromPrevPct}%` : '—'}
            </strong>
          </div>
        )}
      </div>
    </div>
  );
};

export const PainelFunnelConversionChart: React.FC<PainelFunnelConversionChartProps> = ({
  leads,
  cases,
  period = 'all',
  fromDate,
  toDate,
  isDark = false,
  highlightedStageId = null,
  onSelectStage,
}) => {
  const [chartMode, setChartMode] = useState<FunnelChartMode>('combined');

  const metrics = useMemo(
    () =>
      computeFunnelOccupancyMetrics({
        leads,
        cases,
        period,
        fromDate,
        toDate,
      }),
    [leads, cases, period, fromDate, toDate],
  );

  const axisTickColor = isDark ? '#94A3B8' : '#475569';
  const gridColor = isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 37, 55, 0.08)';
  const lineColor = isDark ? '#E2B94A' : '#0F2537';
  const labelColor = isDark ? '#E2E8F0' : '#0F172A';

  const handleChartStageClick = (entry: unknown) => {
    if (!onSelectStage || !entry || typeof entry !== 'object') return;
    const candidate = entry as { stageId?: MacroFunnelStageId; payload?: { stageId?: MacroFunnelStageId } };
    const stageId = candidate.stageId || candidate.payload?.stageId;
    if (stageId) {
      onSelectStage(stageId);
    }
  };

  return (
    <section
      aria-label="Gráfico do funil de conversão e taxa de ocupação por etapa"
      className="bg-white dark:bg-[#0F1629] border border-slate-200/90 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-[0_1px_2px_rgba(11,31,51,0.04)]"
    >
      {/* Cabeçalho + Seletor de Modo do Gráfico */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Funil de Conversão &amp; Taxa de Ocupação por Etapa
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Distribuição da carteira ativa e retenção acumulada nos 5 marcos do processo migratório
          </p>
        </div>

        <div
          role="group"
          aria-label="Alternar visualização do gráfico do funil"
          className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 text-xs font-medium shrink-0 self-start md:self-auto"
        >
          <button
            type="button"
            onClick={() => setChartMode('combined')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-all duration-150 ${
              chartMode === 'combined'
                ? 'bg-white dark:bg-[#0F1629] text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Conversão &amp; Ocupação
          </button>
          <button
            type="button"
            onClick={() => setChartMode('occupancy')}
            className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-all duration-150 ${
              chartMode === 'occupancy'
                ? 'bg-white dark:bg-[#0F1629] text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Ocupação (%)
          </button>
        </div>
      </div>

      {/* Área do Gráfico Recharts */}
      {metrics.totalActiveInFunnel === 0 && metrics.lostLeadsCount === 0 ? (
        <div className="h-[220px] flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-center px-4">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            Nenhum cliente ou lead encontrado no período selecionado
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Amplie o período de filtro ou cadastre novos clientes para visualizar a ocupação e a curva de conversão.
          </p>
        </div>
      ) : (
        <div className="w-full h-[270px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartMode === 'combined' ? (
              <ComposedChart
                data={metrics.stages}
                margin={{ top: 22, right: 20, left: 0, bottom: 6 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="nomeCurto"
                  tick={{ fontSize: 12, fill: axisTickColor, fontWeight: 500 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="count"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                  width={34}
                />
                <YAxis
                  yAxisId="pct"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                  width={42}
                />
                <Tooltip
                  content={<FunnelStageTooltip />}
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,37,55,0.04)' }}
                />
                <Bar
                  yAxisId="count"
                  dataKey="activeCount"
                  name="Ativos na etapa"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={56}
                  className={onSelectStage ? 'cursor-pointer' : undefined}
                  onClick={handleChartStageClick}
                >
                  {metrics.stages.map((entry) => {
                    const dimmed = Boolean(highlightedStageId && highlightedStageId !== entry.stageId);
                    return (
                      <Cell
                        key={entry.stageId}
                        fill={entry.cor}
                        fillOpacity={dimmed ? 0.35 : 0.92}
                      />
                    );
                  })}
                  <LabelList
                    dataKey="occupancyPct"
                    position="top"
                    formatter={(val: unknown) => `${Number(val || 0)}%`}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fill: labelColor,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </Bar>
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="conversionFromEntryPct"
                  name="Conversão acumulada (%)"
                  stroke={lineColor}
                  strokeWidth={2.25}
                  dot={{ r: 4, fill: lineColor, strokeWidth: 2, stroke: isDark ? '#0F1629' : '#FFFFFF' }}
                  activeDot={{ r: 6 }}
                />
              </ComposedChart>
            ) : (
              <BarChart
                data={metrics.stages}
                layout="vertical"
                margin={{ top: 8, right: 54, left: 12, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="nomeCurto"
                  tick={{ fontSize: 12, fill: axisTickColor, fontWeight: 500 }}
                  axisLine={false}
                  tickLine={false}
                  width={98}
                />
                <Tooltip
                  content={<FunnelStageTooltip />}
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,37,55,0.04)' }}
                />
                <Bar
                  dataKey="occupancyPct"
                  name="Taxa de ocupação (%)"
                  radius={[0, 6, 6, 0]}
                  barSize={26}
                  className={onSelectStage ? 'cursor-pointer' : undefined}
                  onClick={handleChartStageClick}
                >
                  {metrics.stages.map((entry) => {
                    const dimmed = Boolean(highlightedStageId && highlightedStageId !== entry.stageId);
                    return (
                      <Cell
                        key={entry.stageId}
                        fill={entry.cor}
                        fillOpacity={dimmed ? 0.35 : 0.92}
                      />
                    );
                  })}
                  <LabelList
                    dataKey="occupancyPct"
                    position="right"
                    formatter={(val: unknown) => `${Number(val || 0)}%`}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      fill: labelColor,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  />
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Barra de Ocupação Textual Interativa por Etapa (sem pills, tabular-nums) */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {metrics.stages.map((stage) => {
          const isFocused = highlightedStageId === stage.stageId;
          return (
            <button
              key={stage.stageId}
              type="button"
              onClick={() => onSelectStage?.(stage.stageId)}
              disabled={!onSelectStage}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors disabled:cursor-default ${
                isFocused
                  ? 'border-[var(--color-primary)] dark:border-sky-400 bg-slate-50 dark:bg-slate-800/80'
                  : 'border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {stage.ordem}. {stage.nomeCurto}
                </span>
                <span
                  className="text-xs font-bold font-mono tabular-nums"
                  style={{ color: stage.cor }}
                >
                  {stage.occupancyPct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(stage.activeCount > 0 ? 6 : 0, stage.occupancyPct))}%`,
                    backgroundColor: stage.cor,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 tabular-nums truncate">
                {stage.activeCount} ativo(s) · Conv. {stage.conversionFromEntryPct}%
              </p>
            </button>
          );
        })}
      </div>

      {/* Rodapé Consolidado (metadados limpos com separadores tipográficos) */}
      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span>
            Carteira ativa: <strong className="text-slate-900 dark:text-slate-100">{metrics.totalActiveInFunnel}</strong>{' '}
            ({metrics.totalCasesActive} processos · {metrics.totalLeadsActive} leads)
          </span>
          {metrics.heaviestStage && (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Maior ocupação:{' '}
                <strong className="text-slate-900 dark:text-slate-100">
                  {metrics.heaviestStage.nome} ({metrics.heaviestStage.occupancyPct}%)
                </strong>
              </span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span>
            Conversão ponta a ponta:{' '}
            <strong className="text-slate-900 dark:text-slate-100">{metrics.entryToFinalizationPct}%</strong>
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
          {chartMode === 'combined' && (
            <span>Barras: ativos e % ocupação · Linha: conversão acumulada</span>
          )}
          {onSelectStage && <span>Clique em uma etapa para filtrar</span>}
        </div>
      </div>
    </section>
  );
};
