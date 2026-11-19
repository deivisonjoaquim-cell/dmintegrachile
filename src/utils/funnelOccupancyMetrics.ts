import type { Case, Lead } from '../types/domain';
import {
  MACRO_FUNNEL_STAGES,
  getMacroStageForCase,
  getMacroStageForLead,
  type MacroFunnelStage,
  type MacroFunnelStageId,
} from './funnelModel';
import {
  matchesCreatedDateRange,
  type DateRangeFilterOptions,
  type FunnelPerformancePeriod,
} from './funnelPerformanceModel';

export interface FunnelStageOccupancyRow {
  stageId: MacroFunnelStageId;
  ordem: number;
  nome: string;
  nomeCurto: string;
  cor: string;
  /** Quantidade de leads ativos atualmente nesta etapa */
  leadsCount: number;
  /** Quantidade de processos ativos atualmente nesta etapa */
  casesCount: number;
  /** Total de registros ativos ocupando esta etapa agora */
  activeCount: number;
  /** Taxa de ocupação desta etapa sobre o total de registros ativos no funil (0–100) */
  occupancyPct: number;
  /** Total acumulado de registros que alcançaram ou ultrapassaram esta etapa */
  cumulativeReached: number;
  /** Taxa de conversão em relação à etapa imediatamente anterior (0–100), ou null sem base */
  conversionFromPrevPct: number | null;
  /** Retenção acumulada desde a entrada no funil (Diagnóstico -> esta etapa, 0–100) */
  conversionFromEntryPct: number;
  /** Verdadeiro se esta etapa concentra a maior fatia da carteira ativa */
  isHeaviestOccupancy: boolean;
}

export interface FunnelOccupancyDashboardMetrics {
  period: FunnelPerformancePeriod;
  stages: FunnelStageOccupancyRow[];
  totalActiveInFunnel: number;
  totalLeadsActive: number;
  totalCasesActive: number;
  lostLeadsCount: number;
  heaviestStage: FunnelStageOccupancyRow | null;
  entryToFinalizationPct: number;
}

const SHORT_LABELS: Record<MacroFunnelStageId, string> = {
  diagnostico: 'Diagnóstico',
  proposta: 'Proposta',
  documentacao: 'Documentação',
  tramite: 'Trâmite',
  finalizacao: 'Finalização',
};

/**
 * Calcula métricas consolidadas de ocupação por etapa e funil de conversão
 * para visualização em gráficos (Recharts) nos 5 marcos do processo migratório.
 */
export function computeFunnelOccupancyMetrics(input: {
  leads: Lead[];
  cases: Case[];
  period?: FunnelPerformancePeriod;
  fromDate?: string;
  toDate?: string;
  now?: Date;
}): FunnelOccupancyDashboardMetrics {
  const period = input.period || 'all';
  const dateFilter: DateRangeFilterOptions = {
    period,
    fromDate: input.fromDate,
    toDate: input.toDate,
    now: input.now,
  };

  const leadsInRange = input.leads.filter((l) => matchesCreatedDateRange(l.createdAt, dateFilter));
  const casesInRange = input.cases.filter(
    (c) => !c.arquivado && matchesCreatedDateRange(c.createdAt, dateFilter),
  );

  const lostLeadsCount = leadsInRange.filter((l) => l.statusFunil === 'Perdido').length;

  const leadsByStage: Record<MacroFunnelStageId, number> = {
    diagnostico: 0,
    proposta: 0,
    documentacao: 0,
    tramite: 0,
    finalizacao: 0,
  };

  const casesByStage: Record<MacroFunnelStageId, number> = {
    diagnostico: 0,
    proposta: 0,
    documentacao: 0,
    tramite: 0,
    finalizacao: 0,
  };

  let totalLeadsActive = 0;
  for (const lead of leadsInRange) {
    const stage = getMacroStageForLead(lead);
    if (!stage) continue;
    leadsByStage[stage.id] += 1;
    totalLeadsActive += 1;
  }

  let totalCasesActive = 0;
  for (const c of casesInRange) {
    const stage = getMacroStageForCase(c);
    casesByStage[stage.id] += 1;
    totalCasesActive += 1;
  }

  const totalActiveInFunnel = totalLeadsActive + totalCasesActive;

  // Acumulado de alcance (todos que chegaram ou passaram pela etapa i)
  const activeByIdx = MACRO_FUNNEL_STAGES.map(
    (stage) => leadsByStage[stage.id] + casesByStage[stage.id],
  );

  const cumulativeByIdx = MACRO_FUNNEL_STAGES.map((_, idx) => {
    let sum = 0;
    for (let j = idx; j < activeByIdx.length; j += 1) {
      sum += activeByIdx[j];
    }
    // Na entrada do funil (Diagnóstico), inclui leads perdidos no período para refletir o topo real de conversão
    if (idx === 0) {
      sum += lostLeadsCount;
    }
    return sum;
  });

  const topEntryCount = cumulativeByIdx[0] || 0;

  let maxActiveCount = 0;
  let heaviestIdx = -1;
  activeByIdx.forEach((cnt, idx) => {
    if (cnt > maxActiveCount) {
      maxActiveCount = cnt;
      heaviestIdx = idx;
    }
  });

  const stages: FunnelStageOccupancyRow[] = MACRO_FUNNEL_STAGES.map(
    (stage: MacroFunnelStage, idx: number) => {
      const leadsCount = leadsByStage[stage.id];
      const casesCount = casesByStage[stage.id];
      const activeCount = leadsCount + casesCount;
      const occupancyPct =
        totalActiveInFunnel > 0
          ? Number(((activeCount / totalActiveInFunnel) * 100).toFixed(1))
          : 0;

      const cumulativeReached = cumulativeByIdx[idx];
      const prevCumulative = idx > 0 ? cumulativeByIdx[idx - 1] : cumulativeReached;
      const conversionFromPrevPct =
        idx === 0
          ? cumulativeReached > 0
            ? 100
            : null
          : prevCumulative > 0
            ? Math.round((cumulativeReached / prevCumulative) * 100)
            : null;

      const conversionFromEntryPct =
        topEntryCount > 0 ? Math.round((cumulativeReached / topEntryCount) * 100) : 0;

      return {
        stageId: stage.id,
        ordem: stage.ordem,
        nome: stage.nome,
        nomeCurto: SHORT_LABELS[stage.id],
        cor: stage.corHex,
        leadsCount,
        casesCount,
        activeCount,
        occupancyPct,
        cumulativeReached,
        conversionFromPrevPct,
        conversionFromEntryPct,
        isHeaviestOccupancy: idx === heaviestIdx && maxActiveCount > 0,
      };
    },
  );

  const heaviestStage = heaviestIdx >= 0 ? stages[heaviestIdx] : null;
  const finalStage = stages[stages.length - 1];
  const entryToFinalizationPct = finalStage ? finalStage.conversionFromEntryPct : 0;

  return {
    period,
    stages,
    totalActiveInFunnel,
    totalLeadsActive,
    totalCasesActive,
    lostLeadsCount,
    heaviestStage,
    entryToFinalizationPct,
  };
}
