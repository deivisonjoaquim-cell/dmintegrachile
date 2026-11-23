import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import type { Case, Client, Lead } from '../../types/domain';
import {
  computePanelAnalytics,
  type AnalyticsHorizon,
} from '../../utils/panelAnalyticsModel';
import type { LegacyPanelSection } from '../../utils/panelNavigation';

interface PainelAnalyticsRechartsProps {
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  isDark?: boolean;
  onNavigateSection?: (section: LegacyPanelSection) => void;
}

export const PainelAnalyticsRecharts: React.FC<PainelAnalyticsRechartsProps> = ({
  leads,
  clients,
  cases,
  isDark = false,
  onNavigateSection,
}) => {
  const [horizon, setHorizon] = useState<AnalyticsHorizon>('6m');

  const analytics = useMemo(
    () => computePanelAnalytics({ leads, clients, cases, horizon }),
    [leads, clients, cases, horizon],
  );

  const axisColor = isDark ? '#9AB0C7' : '#4A5A6D';
  const gridColor = isDark ? '#1C324B' : '#E5DFD2';
  const tooltipStyle: React.CSSProperties = {
    backgroundColor: isDark ? '#081726' : '#FFFFFF',
    borderColor: isDark ? '#1C324B' : '#E5DFD2',
    borderRadius: '10px',
    fontSize: '12px',
    color: isDark ? '#F1F5F9' : '#0B1F33',
    boxShadow: '0 10px 28px rgba(11,31,51,0.14)',
  };

  const hasMonthlyVolume = analytics.monthlySeries.some((m) => m.diagnosticos > 0 || m.convertidos > 0);
  const hasProfiles = analytics.profileDistribution.length > 0;

  return (
    <section
      aria-label="Painel Estatístico da Consultoria"
      className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl overflow-hidden shadow-[0_2px_10px_rgba(11,31,51,0.04)]"
    >
      {/* Filete institucional da marca */}
      <div className="brand-ribbon h-[3px] w-full" aria-hidden="true" />

      <div className="p-5 sm:p-6 space-y-6">
        {/* Cabeçalho + Seletor de Horizonte */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C6D14] dark:text-[#E5C76B]">
              Inteligência Analítica · D&amp;M Integra Chile
            </p>
            <h2 className="text-lg font-bold tracking-tight text-[#0B1F33] dark:text-slate-100">
              Painel Estatístico de Diagnósticos, Conversão &amp; Perfis Migratórios
            </h2>
            <p className="text-xs text-[#4A5A6D] dark:text-slate-400">
              Volume mensal de diagnósticos, taxa de conversão em clientes e distribuição das subcategorias migratórias (SERMIG)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
            <div
              role="group"
              aria-label="Período do painel estatístico"
              className="inline-flex flex-wrap items-center p-0.5 rounded-lg bg-[#F1EDE4] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] text-xs font-semibold max-w-full"
            >
              {(
                [
                  { id: '6m', label: 'Últimos 6 meses' },
                  { id: '12m', label: 'Últimos 12 meses' },
                ] as const
              ).map((opt) => {
                const active = horizon === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setHorizon(opt.id)}
                    className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-white dark:bg-[#0D1E31] text-[#0B1F33] dark:text-slate-100 shadow-xs'
                        : 'text-[#4A5A6D] dark:text-slate-400 hover:text-[#0B1F33] dark:hover:text-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('leads')}
                className="px-3 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#142942] whitespace-nowrap"
              >
                Ver Leads &amp; Diagnósticos →
              </button>
            )}
          </div>
        </div>

        {/* Faixa de 4 KPIs Estatísticos Consolidados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="min-w-0 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#081726]/60 p-4">
            <p className="text-[11px] font-semibold text-[#4A5A6D] dark:text-slate-400">
              Diagnósticos ({horizon === '6m' ? '6 meses' : '12 meses'})
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#0B1F33] dark:text-slate-100 mt-1">
              {analytics.diagnosticosNoPeriodo}
            </p>
            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-1 tabular-nums">
              Total histórico: {analytics.totalDiagnosticos}
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#081726]/60 p-4">
            <p className="text-[11px] font-semibold text-[#4A5A6D] dark:text-slate-400">
              Taxa de Conversão Global
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#146B43] dark:text-emerald-400 mt-1">
              {analytics.taxaConversaoGlobalPct}%
            </p>
            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-1 tabular-nums">
              No período: {analytics.taxaConversaoPeriodoPct}%
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#081726]/60 p-4">
            <p className="text-[11px] font-semibold text-[#4A5A6D] dark:text-slate-400">
              Clientes &amp; Processos Ativos
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#0B1F33] dark:text-slate-100 mt-1">
              {analytics.totalClientesAtivos}
            </p>
            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-1 tabular-nums">
              {analytics.totalProcessosAtivos} processo(s) em andamento
            </p>
          </div>

          <div className="min-w-0 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#081726]/60 p-4">
            <p className="text-[11px] font-semibold text-[#4A5A6D] dark:text-slate-400">
              Perfil Migratório Líder
            </p>
            <p className="text-sm sm:text-base font-bold text-[#8C6D14] dark:text-[#E5C76B] mt-1.5 leading-snug break-words">
              {analytics.perfilLider ? analytics.perfilLider.nomeCurto : 'Aguardando dados'}
            </p>
            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-1 tabular-nums">
              {analytics.perfilLider
                ? `${analytics.perfilLider.percentual}% dos perfis (${analytics.perfilLider.total})`
                : 'Sem diagnósticos classificados'}
            </p>
          </div>
        </div>

        {/* Grade Principal de Gráficos Recharts */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Gráfico 1: Volume Mensal de Diagnósticos + Convertidos + Taxa de Conversão */}
          <div className="xl:col-span-7 min-w-0 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] p-4 sm:p-5 space-y-3 bg-white dark:bg-[#081726]/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#0B1F33] dark:text-slate-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B] shrink-0" />
                  Volume de Diagnósticos por Mês &amp; Conversão
                </h3>
                <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-0.5">
                  Diagnósticos concluídos, clientes convertidos e linha de taxa de conversão mensal (%)
                </p>
              </div>
            </div>

            {!hasMonthlyVolume ? (
              <div className="h-[270px] rounded-lg border border-dashed border-[#DDD6C7] dark:border-[#1C324B] flex flex-col items-center justify-center text-center px-6 space-y-1.5">
                <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-200">
                  Ainda não há diagnósticos registrados nos últimos {horizon === '6m' ? '6' : '12'} meses.
                </p>
                <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 max-w-sm">
                  Assim que os clientes concluírem o Diagnóstico Inteligente no site, a curva mensal será atualizada automaticamente.
                </p>
              </div>
            ) : (
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={analytics.monthlySeries}
                    margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={{ stroke: gridColor }}
                      tickLine={false}
                      minTickGap={10}
                    />
                    <YAxis
                      yAxisId="left"
                      width={34}
                      allowDecimals={false}
                      tick={{ fill: axisColor, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      width={42}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: isDark ? '#E5C76B' : '#8C6D14', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: unknown, name: unknown) => {
                        const label = String(name || '');
                        if (label.includes('Conversão')) return [`${value}%`, label];
                        return [String(value), label];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar
                      yAxisId="left"
                      dataKey="diagnosticos"
                      name="Diagnósticos"
                      fill={isDark ? '#38BDF8' : '#0B1F33'}
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="convertidos"
                      name="Clientes Convertidos"
                      fill="#146B43"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="taxaConversaoPct"
                      name="Taxa de Conversão (%)"
                      stroke="#C8A236"
                      strokeWidth={2.5}
                      dot={{ r: 3.5, fill: '#C8A236', strokeWidth: 0 }}
                      activeDot={{ r: 5 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Gráfico 2: Distribuição de Perfis Migratórios (Donut Recharts) */}
          <div className="xl:col-span-5 min-w-0 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] p-4 sm:p-5 space-y-3 bg-white dark:bg-[#081726]/40">
            <div>
              <h3 className="text-sm font-bold text-[#0B1F33] dark:text-slate-100 flex items-center gap-2">
                <PieChartIcon className="w-4 h-4 text-[#146B43] dark:text-emerald-400 shrink-0" />
                Distribuição dos Perfis Migratórios
              </h3>
              <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-0.5">
                Participação por subcategoria sugerida nos diagnósticos e casos ativos
              </p>
            </div>

            {!hasProfiles ? (
              <div className="h-[270px] rounded-lg border border-dashed border-[#DDD6C7] dark:border-[#1C324B] flex flex-col items-center justify-center text-center px-6 space-y-1.5">
                <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-200">
                  Sem perfis migratórios para distribuir.
                </p>
                <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400">
                  Os perfis (Mercosul, Trabalho, Reunificação, Rentista, Investidor, Definitiva) aparecerão aqui automaticamente.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-5 h-[220px] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.profileDistribution}
                        dataKey="total"
                        nameKey="nomeCurto"
                        cx="50%"
                        cy="50%"
                        innerRadius="52%"
                        outerRadius="80%"
                        paddingAngle={2}
                      >
                        {analytics.profileDistribution.map((entry) => (
                          <Cell key={entry.id} fill={entry.cor} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: unknown, _name: unknown, item: { payload?: { percentual?: number; nome?: string } }) => [
                          `${value} (${item?.payload?.percentual ?? 0}%)`,
                          item?.payload?.nome || 'Perfil',
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="sm:col-span-7 space-y-1.5 max-h-[240px] overflow-y-auto pr-1 min-w-0">
                  {analytics.profileDistribution.map((slice) => (
                    <div
                      key={slice.id}
                      className="flex items-start justify-between gap-2 text-xs py-1.5 border-b border-[#F1EDE4] dark:border-[#1C324B]/70 last:border-b-0"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1"
                          style={{ backgroundColor: slice.cor }}
                          aria-hidden="true"
                        />
                        <span className="text-[#0B1F33] dark:text-slate-200 font-medium leading-snug break-words" title={slice.nome}>
                          {slice.nomeCurto}
                        </span>
                      </div>
                      <div className="text-right shrink-0 font-mono tabular-nums">
                        <span className="font-bold text-[#0B1F33] dark:text-slate-100">{slice.percentual}%</span>
                        <span className="text-[11px] text-[#4A5A6D] dark:text-slate-400 ml-1">({slice.total})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Gráfico 3: Curva de Conversão da Jornada do Cliente (AreaChart Recharts) */}
          <div className="xl:col-span-12 min-w-0 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] p-4 sm:p-5 space-y-3 bg-white dark:bg-[#081726]/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0B1F33] dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#146B43] dark:text-emerald-400 shrink-0" />
                  Taxa de Conversão ao Longo da Jornada de Clientes
                </h3>
                <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-0.5">
                  Retenção percentual e volume acumulado desde o diagnóstico inicial até a aprovação migratória
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono tabular-nums text-[#4A5A6D] dark:text-slate-300">
                {analytics.conversionJourney.map((stage) => (
                  <span key={stage.etapaCurta}>
                    {stage.etapaCurta}:{' '}
                    <strong className="text-[#0B1F33] dark:text-white">{stage.total}</strong> ({stage.taxaSobreBasePct}%)
                  </span>
                ))}
              </div>
            </div>

            <div className="h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={analytics.conversionJourney}
                  margin={{ top: 12, right: 20, left: 0, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="dmConversionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#146B43" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#146B43" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="etapaCurta"
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={{ stroke: gridColor }}
                    tickLine={false}
                    minTickGap={12}
                  />
                  <YAxis
                    width={42}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: axisColor, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: unknown, _name: unknown, item: { payload?: { total?: number; etapa?: string } }) => [
                      `${value}% (${item?.payload?.total ?? 0} registros)`,
                      item?.payload?.etapa || 'Etapa',
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="taxaSobreBasePct"
                    name="Taxa sobre a base"
                    stroke="#146B43"
                    strokeWidth={2.5}
                    fill="url(#dmConversionGradient)"
                    dot={{ r: 4, fill: '#C8A236', stroke: '#0B1F33', strokeWidth: 1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
