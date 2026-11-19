import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Download,
  Loader2,
  TrendingDown,
} from 'lucide-react';
import { reportAppError } from '../../services/errorService';
import type { Case, Client, EmpresaConfig, Lead, UserProfile } from '../../types/domain';
import type { MacroFunnelStageId } from '../../utils/funnelModel';
import {
  computeFunnelPerformanceSummary,
  type FunnelPerformancePeriod,
  type FunnelTransitionMetric,
} from '../../utils/funnelPerformanceModel';
import { buildRecentMonthOptions } from '../../utils/funnelPerformancePdfModel';
import { exportFunnelPerformancePdf } from '../pdf/FunnelPerformancePdf';

interface PainelFunnelPerformanceSummaryProps {
  leads: Lead[];
  cases: Case[];
  empresa?: EmpresaConfig;
  clients?: Client[];
  staffUsers?: UserProfile[];
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
  empresa,
  clients = [],
  staffUsers = [],
  period,
  fromDate,
  toDate,
  highlightedStageId = null,
  onChangePeriod,
  onSelectStage,
  onOpenKanban,
}) => {
  const [reportScope, setReportScope] = useState<string>('current');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportSuccessFile, setExportSuccessFile] = useState<string | null>(null);

  const monthOptions = useMemo(
    () => [
      { value: 'current', label: 'Período atual' },
      ...buildRecentMonthOptions(undefined, 6),
    ],
    [],
  );

  useEffect(() => {
    if (!exportSuccessFile) return;
    const timer = window.setTimeout(() => setExportSuccessFile(null), 5000);
    return () => window.clearTimeout(timer);
  }, [exportSuccessFile]);

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

  const handleExportPdf = async () => {
    if (!empresa || exportingPdf) return;
    setExportingPdf(true);
    setExportSuccessFile(null);
    try {
      const filename = await exportFunnelPerformancePdf({
        empresa,
        leads,
        cases,
        clients,
        staffUsers,
        monthKey: reportScope === 'current' ? null : reportScope,
        period,
        fromDate,
        toDate,
      });
      setExportSuccessFile(filename);
    } catch (err) {
      reportAppError(err, { source: 'funnel-performance-pdf-export' });
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <section
      aria-label="Resumo de desempenho e conversão do funil"
      className="bg-white dark:bg-[#0F1629] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(11,31,51,0.04)]"
    >
      {/* Filete arquitetônico discreto de identidade executiva */}
      <div className="flex h-[3px] w-full" aria-hidden="true">
        <div className="flex-[4] bg-[var(--color-primary)]" />
        <div className="flex-1 bg-[var(--color-accent)]" />
      </div>

      <div className="p-5 space-y-4">
        {/* Cabeçalho + Seletor de Período + Exportação Mensal em PDF */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Desempenho &amp; Conversão entre Etapas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Taxas de avanço e retenção etapa a etapa para identificar gargalos e emitir relatórios gerenciais
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div
              role="group"
              aria-label="Filtrar período de análise de conversão"
              className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700/70 text-xs font-medium"
            >
              {PERIOD_OPTIONS.map((opt) => {
                const active = period === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChangePeriod(opt.id)}
                    className={`px-2.5 py-1 rounded-md whitespace-nowrap transition-all duration-150 ${
                      active
                        ? 'bg-white dark:bg-[#0F1629] text-slate-900 dark:text-slate-100 font-semibold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
              {period === 'custom' && (
                <span className="px-2.5 py-1 rounded-md bg-white dark:bg-[#0F1629] text-slate-900 dark:text-slate-100 font-semibold shadow-xs whitespace-nowrap">
                  Personalizado
                </span>
              )}
            </div>

            {empresa && (
              <div className="inline-flex items-center gap-1.5">
                <select
                  value={reportScope}
                  onChange={(e) => setReportScope(e.target.value)}
                  aria-label="Mês do relatório PDF"
                  disabled={exportingPdf}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-400 disabled:opacity-50"
                >
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.value === 'current' ? 'PDF: Período atual' : `PDF: ${opt.label}`}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void handleExportPdf()}
                  disabled={exportingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap transition-all duration-150 hover:opacity-95 disabled:opacity-60 shadow-[0_1px_2px_rgba(11,31,51,0.18)]"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {exportingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <Download className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{exportingPdf ? 'Gerando PDF...' : 'Relatório PDF'}</span>
                </button>
              </div>
            )}

            {onOpenKanban && (
              <button
                type="button"
                onClick={onOpenKanban}
                className="text-xs font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline whitespace-nowrap pl-1"
              >
                Abrir Funil Kanban →
              </button>
            )}
          </div>
        </div>

        {/* Confirmação discreta de download */}
        {exportSuccessFile && (
          <div
            role="status"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/70 dark:bg-emerald-950/30 text-xs text-emerald-900 dark:text-emerald-200"
          >
            <Check className="w-3.5 h-3.5 shrink-0 text-[#1E7E34] dark:text-emerald-400" />
            <span className="truncate">
              Relatório gerencial baixado com sucesso: <strong className="font-semibold">{exportSuccessFile}</strong>
            </span>
          </div>
        )}

        {/* Faixa de KPIs Consolidados + Diagnóstico do Gargalo */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 pb-3 border-b border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Base analisada:{' '}
              <strong className="text-slate-900 dark:text-slate-100">{summary.totalAnalyzed}</strong>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              Conversão comercial:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {summary.overallCommercialConversionPct}%
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
            <span>
              Conclusão ponta a ponta:{' '}
              <strong className="text-[#1E7E34] dark:text-emerald-400">
                {summary.endToEndCompletionPct}%
              </strong>
            </span>
            {summary.lostLeadsCount > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
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
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
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
                  className={`text-left rounded-xl border p-4 space-y-2.5 transition-all duration-150 ${
                    isSelected
                      ? 'border-[var(--color-primary)] bg-slate-50 dark:bg-slate-800/80 ring-1 ring-[var(--color-primary)]/20'
                      : t.isPrimaryBottleneck
                        ? 'border-red-200/90 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20 hover:border-red-300 dark:hover:border-red-800'
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-800/60'
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
                    <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                      {t.conversionPct !== null ? `${t.conversionPct}%` : '—'}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${meta.textClass}`}>
                      {meta.icon}
                      <span>{meta.label}</span>
                    </span>
                  </div>

                  <div className="h-1.5 rounded-full bg-slate-200/90 dark:bg-slate-700/80 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
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
      </div>
    </section>
  );
};
