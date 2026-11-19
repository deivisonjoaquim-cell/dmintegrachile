import { PIPELINE_STAGES } from '../data/seeds';
import type { Case, Lead } from '../types/domain';

export type MacroFunnelStageId =
  | 'diagnostico'
  | 'proposta'
  | 'documentacao'
  | 'tramite'
  | 'finalizacao';

export interface MacroFunnelStage {
  id: MacroFunnelStageId;
  ordem: number;
  nome: string;
  nomeCurto: string;
  marcoConversao: string;
  descricao: string;
  corHex: string;
  barClass: string;
  /** Etapas legadas (1-15) consolidadas neste macro-estágio */
  legacyPipelineSteps: number[];
  /** Etapa legada representativa usada ao mover um caso diretamente para este estágio */
  representativePipelineStep: number;
  /** Status legados de Lead associados a este marco */
  leadStatuses: Lead['statusFunil'][];
  /** Status de Lead representativo para compatibilidade com Firestore */
  representativeLeadStatus?: Lead['statusFunil'];
}

export const MACRO_FUNNEL_STAGES: MacroFunnelStage[] = [
  {
    id: 'diagnostico',
    ordem: 1,
    nome: 'Diagnóstico',
    nomeCurto: 'Diagnóstico',
    marcoConversao: 'Qualificação e enquadramento migratório concluídos',
    descricao: 'Captação, triagem de viabilidade e alinhamento da subcategoria de visto.',
    corHex: '#334155',
    barClass: 'bg-slate-700',
    legacyPipelineSteps: [1],
    representativePipelineStep: 1,
    leadStatuses: ['Novo', 'Contatado', 'Diagnóstico Agendado'],
    representativeLeadStatus: 'Diagnóstico Agendado',
  },
  {
    id: 'proposta',
    ordem: 2,
    nome: 'Proposta',
    nomeCurto: 'Proposta',
    marcoConversao: 'Orçamento aprovado e contrato assinado',
    descricao: 'Envio de orçamento oficial, negociação comercial e formalização contratual.',
    corHex: '#0369A1',
    barClass: 'bg-sky-700',
    legacyPipelineSteps: [2],
    representativePipelineStep: 2,
    leadStatuses: ['Orçamento Enviado'],
    representativeLeadStatus: 'Orçamento Enviado',
  },
  {
    id: 'documentacao',
    ordem: 3,
    nome: 'Documentação',
    nomeCurto: 'Documentação',
    marcoConversao: 'Dossiê 100% conferido, apostilado e traduzido',
    descricao: 'Coleta, conferência técnica, apostilamento CNJ, tradução juramentada e revisão final.',
    corHex: '#B45309',
    barClass: 'bg-amber-600',
    legacyPipelineSteps: [3, 4, 5, 6],
    representativePipelineStep: 3,
    leadStatuses: [],
  },
  {
    id: 'tramite',
    ordem: 4,
    nome: 'Trâmite',
    nomeCurto: 'Trâmite',
    marcoConversao: 'Protocolo SERMIG registrado e resolução deferida',
    descricao: 'Protocolo em Trámites Digitales, acompanhamento de prazos legais e resposta a requerimentos.',
    corHex: '#4338CA',
    barClass: 'bg-indigo-700',
    legacyPipelineSteps: [7, 8, 9],
    representativePipelineStep: 7,
    leadStatuses: [],
  },
  {
    id: 'finalizacao',
    ordem: 5,
    nome: 'Finalização',
    nomeCurto: 'Finalização',
    marcoConversao: 'Estampado emitido, Cédula/Relocation e encerramento',
    descricao: 'Estampado Electrónico, entrada no Chile, Cédula de Identidade, Relocation e encerramento.',
    corHex: '#1E7E34',
    barClass: 'bg-[#1E7E34]',
    legacyPipelineSteps: [10, 11, 12, 13, 14, 15],
    representativePipelineStep: 10,
    leadStatuses: [],
  },
];

export const MACRO_FUNNEL_BY_ID: Record<MacroFunnelStageId, MacroFunnelStage> = {
  diagnostico: MACRO_FUNNEL_STAGES[0],
  proposta: MACRO_FUNNEL_STAGES[1],
  documentacao: MACRO_FUNNEL_STAGES[2],
  tramite: MACRO_FUNNEL_STAGES[3],
  finalizacao: MACRO_FUNNEL_STAGES[4],
};

/**
 * Mapeia qualquer etapa legada do pipeline (1 a 15) para um dos 5 marcos de conversão.
 */
export function getMacroStageForPipelineStep(etapaPipeline?: number | null): MacroFunnelStage {
  const step = Number(etapaPipeline) || 1;
  if (step <= 1) return MACRO_FUNNEL_BY_ID.diagnostico;
  if (step === 2) return MACRO_FUNNEL_BY_ID.proposta;
  if (step >= 3 && step <= 6) return MACRO_FUNNEL_BY_ID.documentacao;
  if (step >= 7 && step <= 9) return MACRO_FUNNEL_BY_ID.tramite;
  return MACRO_FUNNEL_BY_ID.finalizacao;
}

/**
 * Mapeia um Caso para o seu marco atual no funil simplificado.
 */
export function getMacroStageForCase(c: Pick<Case, 'etapaPipeline' | 'statusSermig'>): MacroFunnelStage {
  if (c.statusSermig === 'Aprovado' && (c.etapaPipeline || 1) >= 10) {
    return MACRO_FUNNEL_BY_ID.finalizacao;
  }
  return getMacroStageForPipelineStep(c.etapaPipeline);
}

/**
 * Mapeia um Lead (pré-conversão) para o marco comercial correspondente.
 * Leads já convertidos em caso ou perdidos retornam null para não duplicar contagem no funil ativo.
 */
export function getMacroStageForLead(
  lead: Pick<Lead, 'statusFunil' | 'convertedCaseId'>,
): MacroFunnelStage | null {
  if (lead.statusFunil === 'Perdido' || lead.statusFunil === 'Fechado' || lead.convertedCaseId) {
    return null;
  }
  if (lead.statusFunil === 'Orçamento Enviado') {
    return MACRO_FUNNEL_BY_ID.proposta;
  }
  return MACRO_FUNNEL_BY_ID.diagnostico;
}

/**
 * Retorna a etapa legada (1-15) representativa ao mover um caso para um macro-estágio.
 * Se o caso já está dentro daquele macro-estágio, preserva a sub-etapa atual.
 */
export function resolveTargetPipelineStep(
  targetMacroId: MacroFunnelStageId,
  currentPipelineStep?: number,
): number {
  const stage = MACRO_FUNNEL_BY_ID[targetMacroId];
  if (currentPipelineStep && stage.legacyPipelineSteps.includes(currentPipelineStep)) {
    return currentPipelineStep;
  }
  return stage.representativePipelineStep;
}

/**
 * Retorna o próximo macro-estágio na ordem de conversão, ou null se já estiver em Finalização.
 */
export function getNextMacroStage(currentId: MacroFunnelStageId): MacroFunnelStage | null {
  const idx = MACRO_FUNNEL_STAGES.findIndex((s) => s.id === currentId);
  if (idx < 0 || idx >= MACRO_FUNNEL_STAGES.length - 1) return null;
  return MACRO_FUNNEL_STAGES[idx + 1];
}

/**
 * Retorna o rótulo amigável combinando o macro-estágio e a sub-etapa operacional legada.
 */
export function formatCaseStageSummary(etapaPipeline: number): {
  macro: MacroFunnelStage;
  subStageName: string;
  compactLabel: string;
} {
  const macro = getMacroStageForPipelineStep(etapaPipeline);
  const sub = PIPELINE_STAGES.find((s) => s.numero === etapaPipeline);
  const subStageName = sub?.nome || `Etapa ${etapaPipeline}`;
  return {
    macro,
    subStageName,
    compactLabel: `${macro.nome} · ${subStageName}`,
  };
}

export interface FunnelStageMetric {
  stage: MacroFunnelStage;
  leadsCount: number;
  casesCount: number;
  totalCount: number;
  /** Quantos registros alcançaram este marco ou avançaram além dele */
  reachedCount: number;
  /** Taxa de conversão do marco anterior para este marco (0-100) */
  conversionFromPrevPct: number | null;
}

export interface UnifiedFunnelMetrics {
  stages: FunnelStageMetric[];
  totalActive: number;
  totalConvertedCases: number;
  totalLostLeads: number;
  /** Taxa geral de conversão de Diagnóstico até contratação (Documentação+) */
  commercialConversionPct: number;
  /** Taxa de conclusão de processos ativos até Finalização */
  completionRatePct: number;
  /** Estágio com maior acúmulo operacional (gargalo) */
  bottleneckStage: MacroFunnelStage | null;
}

/**
 * Calcula métricas consolidadas do funil unificado (Leads pré-venda + Casos ativos).
 * Elimina contagem dupla ignorando leads já convertidos (statusFunil === 'Fechado' ou convertedCaseId).
 */
export function computeUnifiedFunnelMetrics(
  leads: Lead[],
  cases: Case[],
): UnifiedFunnelMetrics {
  const activeCases = cases.filter((c) => !c.arquivado);
  const lostLeads = leads.filter((l) => l.statusFunil === 'Perdido').length;

  const leadsByStage: Record<MacroFunnelStageId, number> = {
    diagnostico: 0,
    proposta: 0,
    documentacao: 0,
    tramite: 0,
    finalizacao: 0,
  };

  for (const lead of leads) {
    const stage = getMacroStageForLead(lead);
    if (stage) {
      leadsByStage[stage.id] += 1;
    }
  }

  const casesByStage: Record<MacroFunnelStageId, number> = {
    diagnostico: 0,
    proposta: 0,
    documentacao: 0,
    tramite: 0,
    finalizacao: 0,
  };

  for (const c of activeCases) {
    const stage = getMacroStageForCase(c);
    casesByStage[stage.id] += 1;
  }

  const totals = MACRO_FUNNEL_STAGES.map((st) => leadsByStage[st.id] + casesByStage[st.id]);

  // Acumulado regressivo: quem está em um estágio avançado já passou pelos anteriores
  const reached: number[] = new Array(MACRO_FUNNEL_STAGES.length).fill(0);
  for (let i = MACRO_FUNNEL_STAGES.length - 1; i >= 0; i -= 1) {
    reached[i] = totals[i] + (i < MACRO_FUNNEL_STAGES.length - 1 ? reached[i + 1] : 0);
  }

  const stages: FunnelStageMetric[] = MACRO_FUNNEL_STAGES.map((stage, idx) => {
    const prevReached = idx > 0 ? reached[idx - 1] : null;
    const conversionFromPrevPct =
      prevReached !== null
        ? prevReached > 0
          ? Math.round((reached[idx] / prevReached) * 100)
          : 0
        : null;

    return {
      stage,
      leadsCount: leadsByStage[stage.id],
      casesCount: casesByStage[stage.id],
      totalCount: totals[idx],
      reachedCount: reached[idx],
      conversionFromPrevPct,
    };
  });

  const totalActive = totals.reduce((a, b) => a + b, 0);
  const totalCommercialBase = totalActive + lostLeads;
  const enteredOperationalCount = reached[2]; // Documentação + Trâmite + Finalização
  const commercialConversionPct =
    totalCommercialBase > 0 ? Math.round((enteredOperationalCount / totalCommercialBase) * 100) : 0;

  const completionRatePct =
    activeCases.length > 0 ? Math.round((casesByStage.finalizacao / activeCases.length) * 100) : 0;

  // Gargalo: estágio intermediário (Diagnóstico..Trâmite) com maior volume acumulado
  const operationalStages = stages.slice(0, 4);
  let bottleneckStage: MacroFunnelStage | null = null;
  let maxVol = 0;
  for (const item of operationalStages) {
    if (item.totalCount > maxVol) {
      maxVol = item.totalCount;
      bottleneckStage = item.stage;
    }
  }

  return {
    stages,
    totalActive,
    totalConvertedCases: activeCases.length,
    totalLostLeads: lostLeads,
    commercialConversionPct,
    completionRatePct,
    bottleneckStage,
  };
}
