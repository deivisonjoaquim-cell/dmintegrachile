import type { Case, Lead } from '../types/domain';
import {
  MACRO_FUNNEL_STAGES,
  getMacroStageForCase,
  getMacroStageForLead,
  type MacroFunnelStage,
  type MacroFunnelStageId,
} from './funnelModel';

export type FunnelPerformancePeriod = 'all' | '7d' | '30d' | '90d' | 'custom';

export type FunnelTransitionHealth = 'healthy' | 'attention' | 'critical' | 'neutral';

export interface FunnelTransitionMetric {
  id: string;
  fromStage: MacroFunnelStage;
  toStage: MacroFunnelStage;
  /** Quantos registros alcançaram a etapa de origem (inclui leads perdidos na entrada comercial) */
  enteredCount: number;
  /** Quantos registros avançaram para a etapa seguinte ou além dela */
  advancedCount: number;
  /** Quantos registros ficaram retidos na etapa de origem ou foram perdidos antes de avançar */
  droppedCount: number;
  /** Taxa de conversão da etapa de origem para a seguinte (0-100), ou null se base = 0 */
  conversionPct: number | null;
  /** Taxa de queda/retenção complementar (0-100), ou null se base = 0 */
  dropOffPct: number | null;
  /** Verdadeiro se esta transição representa o principal gargalo do funil no recorte atual */
  isPrimaryBottleneck: boolean;
  health: FunnelTransitionHealth;
}

export interface FunnelPerformanceSummary {
  period: FunnelPerformancePeriod;
  transitions: FunnelTransitionMetric[];
  primaryBottleneck: FunnelTransitionMetric | null;
  totalAnalyzed: number;
  activeLeadsCount: number;
  activeCasesCount: number;
  lostLeadsCount: number;
  /** Percentual de toda a base comercial analisada que chegou em Documentação ou além */
  overallCommercialConversionPct: number;
  /** Percentual dos registros analisados que chegou em Finalização */
  endToEndCompletionPct: number;
}

export interface DateRangeFilterOptions {
  period?: FunnelPerformancePeriod;
  fromDate?: string;
  toDate?: string;
  now?: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Converte string de data ISO ou YYYY-MM-DD em timestamp (ms) confiável.
 */
export function parseCreatedAtMs(value?: string | null): number | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Se for apenas YYYY-MM-DD, interpreta no meio do dia UTC para evitar deslocamentos de fuso
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = Date.parse(`${trimmed}T12:00:00Z`);
    return Number.isNaN(parsed) ? null : parsed;
  }

  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Avalia se uma data de criação (ISO) pertence ao período selecionado.
 */
export function matchesCreatedDateRange(
  isoDate: string | undefined | null,
  options?: DateRangeFilterOptions,
): boolean {
  const period = options?.period || 'all';
  if (period === 'all') return true;

  const ts = parseCreatedAtMs(isoDate);
  if (ts === null) return false;

  const now = options?.now ? new Date(options.now.getTime()) : new Date();

  if (period === '7d' || period === '30d' || period === '90d') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const cutoff = now.getTime() - days * MS_PER_DAY;
    return ts >= cutoff;
  }

  if (period === 'custom') {
    const rawFrom = (options?.fromDate || '').trim();
    const rawTo = (options?.toDate || '').trim();
    if (!rawFrom && !rawTo) return true;

    let startMs = rawFrom ? Date.parse(`${rawFrom}T00:00:00Z`) : null;
    let endMs = rawTo ? Date.parse(`${rawTo}T23:59:59.999Z`) : null;

    if (startMs !== null && Number.isNaN(startMs)) startMs = null;
    if (endMs !== null && Number.isNaN(endMs)) endMs = null;

    // Proteção caso usuário informe data inicial posterior à final
    if (startMs !== null && endMs !== null && startMs > endMs) {
      const swapFrom = Date.parse(`${rawTo}T00:00:00Z`);
      const swapTo = Date.parse(`${rawFrom}T23:59:59.999Z`);
      startMs = swapFrom;
      endMs = swapTo;
    }

    if (startMs !== null && ts < startMs) return false;
    if (endMs !== null && ts > endMs) return false;
    return true;
  }

  return true;
}

function classifyTransitionHealth(
  conversionPct: number | null,
  isPrimaryBottleneck: boolean,
): FunnelTransitionHealth {
  if (conversionPct === null) return 'neutral';
  if (isPrimaryBottleneck && conversionPct < 60) return 'critical';
  if (conversionPct < 45) return 'critical';
  if (conversionPct < 70 || isPrimaryBottleneck) return 'attention';
  return 'healthy';
}

/**
 * Calcula a taxa de conversão, a queda e o gargalo principal entre cada transição sequencial
 * dos 5 marcos do funil (Diagnóstico → Proposta → Documentação → Trâmite → Finalização).
 */
export function computeFunnelPerformanceSummary(input: {
  leads: Lead[];
  cases: Case[];
  period?: FunnelPerformancePeriod;
  fromDate?: string;
  toDate?: string;
  now?: Date;
}): FunnelPerformanceSummary {
  const period = input.period || 'all';
  const dateFilter: DateRangeFilterOptions = {
    period,
    fromDate: input.fromDate,
    toDate: input.toDate,
    now: input.now,
  };

  const filteredLeads = input.leads.filter((l) => matchesCreatedDateRange(l.createdAt, dateFilter));
  const activeCases = input.cases.filter(
    (c) => !c.arquivado && matchesCreatedDateRange(c.createdAt, dateFilter),
  );

  const lostLeadsCount = filteredLeads.filter((l) => l.statusFunil === 'Perdido').length;

  const countsByStage: Record<MacroFunnelStageId, number> = {
    diagnostico: 0,
    proposta: 0,
    documentacao: 0,
    tramite: 0,
    finalizacao: 0,
  };

  let activeLeadsCount = 0;
  for (const lead of filteredLeads) {
    const stage = getMacroStageForLead(lead);
    if (stage) {
      countsByStage[stage.id] += 1;
      activeLeadsCount += 1;
    }
  }

  for (const c of activeCases) {
    const stage = getMacroStageForCase(c);
    countsByStage[stage.id] += 1;
  }

  const stageTotals = MACRO_FUNNEL_STAGES.map((s) => countsByStage[s.id]);

  // Acumulado regressivo: quem está em etapas posteriores atravessou as anteriores
  const reached: number[] = new Array(MACRO_FUNNEL_STAGES.length).fill(0);
  for (let i = MACRO_FUNNEL_STAGES.length - 1; i >= 0; i -= 1) {
    reached[i] = stageTotals[i] + (i < MACRO_FUNNEL_STAGES.length - 1 ? reached[i + 1] : 0);
  }

  // Leads perdidos compõem a base de entrada de Diagnóstico para refletir perdas comerciais reais
  const entryCounts = reached.map((val, idx) => (idx === 0 ? val + lostLeadsCount : val));

  const rawTransitions = MACRO_FUNNEL_STAGES.slice(0, -1).map((fromStage, idx) => {
    const toStage = MACRO_FUNNEL_STAGES[idx + 1];
    const enteredCount = entryCounts[idx];
    const advancedCount = reached[idx + 1];
    const droppedCount = Math.max(0, enteredCount - advancedCount);
    const conversionPct =
      enteredCount > 0 ? Math.round((advancedCount / enteredCount) * 100) : null;
    const dropOffPct = conversionPct !== null ? Math.max(0, 100 - conversionPct) : null;

    return {
      id: `${fromStage.id}_${toStage.id}`,
      fromStage,
      toStage,
      enteredCount,
      advancedCount,
      droppedCount,
      conversionPct,
      dropOffPct,
    };
  });

  // Identifica o gargalo prioritário: menor taxa de conversão entre transições com base > 0 e queda > 0
  let bottleneckId: string | null = null;
  let worstRate = Number.POSITIVE_INFINITY;
  let maxDropOnTie = -1;

  for (const t of rawTransitions) {
    if (t.enteredCount <= 0 || t.droppedCount <= 0 || t.conversionPct === null) continue;
    if (
      t.conversionPct < worstRate ||
      (t.conversionPct === worstRate && t.droppedCount > maxDropOnTie)
    ) {
      worstRate = t.conversionPct;
      maxDropOnTie = t.droppedCount;
      bottleneckId = t.id;
    }
  }

  const transitions: FunnelTransitionMetric[] = rawTransitions.map((t) => {
    const isPrimaryBottleneck = t.id === bottleneckId;
    return {
      ...t,
      isPrimaryBottleneck,
      health: classifyTransitionHealth(t.conversionPct, isPrimaryBottleneck),
    };
  });

  const primaryBottleneck = transitions.find((t) => t.isPrimaryBottleneck) || null;
  const totalAnalyzed = activeLeadsCount + activeCases.length + lostLeadsCount;
  const enteredOperational = reached[2]; // Documentação + Trâmite + Finalização
  const overallCommercialConversionPct =
    totalAnalyzed > 0 ? Math.round((enteredOperational / totalAnalyzed) * 100) : 0;
  const endToEndCompletionPct =
    totalAnalyzed > 0 ? Math.round((reached[4] / totalAnalyzed) * 100) : 0;

  return {
    period,
    transitions,
    primaryBottleneck,
    totalAnalyzed,
    activeLeadsCount,
    activeCasesCount: activeCases.length,
    lostLeadsCount,
    overallCommercialConversionPct,
    endToEndCompletionPct,
  };
}
