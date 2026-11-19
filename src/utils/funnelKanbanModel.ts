import type {
  Case,
  CaseDocument,
  Client,
  Deadline,
  Lead,
  Task,
} from '../types/domain';
import { calcularTermometroDocumentos } from './caseMetrics';
import { daysUntilDate } from './formatters';
import {
  MACRO_FUNNEL_STAGES,
  computeUnifiedFunnelMetrics,
  formatCaseStageSummary,
  getMacroStageForCase,
  getMacroStageForLead,
  getNextMacroStage,
  resolveTargetPipelineStep,
  type MacroFunnelStage,
  type MacroFunnelStageId,
  type UnifiedFunnelMetrics,
} from './funnelModel';

export type FunnelKanbanCardKind = 'lead' | 'case';
export type FunnelKanbanFilterKind = 'all' | 'cases' | 'leads' | 'attention';

export interface FunnelKanbanCard {
  id: string;
  kind: FunnelKanbanCardKind;
  stageId: MacroFunnelStageId;
  clientName: string;
  title: string;
  subtitle: string;
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  /** Progresso visual consolidado de 0 a 100 para acompanhar o cliente no funil */
  progressPct: number;
  docsPct: number | null;
  pendingDocsCount: number;
  completedTasksCount: number;
  totalTasksCount: number;
  hasAttention: boolean;
  attentionReason?: string;
  whatsapp?: string;
  email?: string;
  sermigStatus?: Case['statusSermig'];
  sermigProtocol?: string;
  nextStage: MacroFunnelStage | null;
  prevStage: MacroFunnelStage | null;
  lead?: Lead;
  caseRecord?: Case;
  client?: Client;
}

export interface FunnelKanbanColumn {
  stage: MacroFunnelStage;
  cards: FunnelKanbanCard[];
  conversionFromPrevPct: number | null;
  isBottleneck: boolean;
}

export interface FunnelKanbanBoardModel {
  columns: FunnelKanbanColumn[];
  metrics: UnifiedFunnelMetrics;
  totalVisibleCards: number;
  totalAllCards: number;
  attentionCardsCount: number;
}

export interface FunnelKanbanFilters {
  query?: string;
  kind?: FunnelKanbanFilterKind;
  priority?: 'all' | 'Urgente' | 'Alta' | 'Média' | 'Baixa';
}

function getPrevMacroStage(currentId: MacroFunnelStageId): MacroFunnelStage | null {
  const idx = MACRO_FUNNEL_STAGES.findIndex((s) => s.id === currentId);
  if (idx <= 0) return null;
  return MACRO_FUNNEL_STAGES[idx - 1];
}

function computeCaseVisualProgress(
  stage: MacroFunnelStage,
  docsPct: number,
  completedTasks: number,
  totalTasks: number,
  statusSermig: Case['statusSermig'],
): number {
  if (stage.id === 'finalizacao' && statusSermig === 'Aprovado') {
    return 100;
  }
  // Base progress by macro milestone (1..5 -> 15%, 35%, 55%, 78%, 92%)
  const stageBaseByOrder: Record<number, number> = {
    1: 15,
    2: 32,
    3: 50,
    4: 75,
    5: 90,
  };
  const base = stageBaseByOrder[stage.ordem] ?? 15;
  const taskRatio = totalTasks > 0 ? completedTasks / totalTasks : 0;
  // Blend milestone position (65%), document readiness (25%), and task progress (10%)
  const raw = Math.round(base * 0.65 + docsPct * 0.25 + taskRatio * 100 * 0.1);
  return Math.max(8, Math.min(99, raw));
}

function computeLeadVisualProgress(lead: Lead, stage: MacroFunnelStage): number {
  if (stage.id === 'proposta') return 35;
  if (lead.statusFunil === 'Diagnóstico Agendado') return 22;
  if (lead.statusFunil === 'Contatado') return 14;
  return 8;
}

function priorityRank(priority: FunnelKanbanCard['priority']): number {
  switch (priority) {
    case 'Urgente':
      return 0;
    case 'Alta':
      return 1;
    case 'Média':
      return 2;
    default:
      return 3;
  }
}

/**
 * Constrói o modelo completo das 5 colunas do Dashboard de Funnel Kanban
 * (Diagnóstico, Proposta, Documentação, Trâmite, Finalização), unificando Leads ativos e Casos
 * sem contagem dupla e calculando o progresso visual de cada cliente.
 */
export function buildFunnelKanbanBoard(input: {
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  docs: CaseDocument[];
  tasks: Task[];
  deadlines: Deadline[];
  bloqueioProtocoloMinimo?: number;
  filters?: FunnelKanbanFilters;
}): FunnelKanbanBoardModel {
  const minProtocolScore = input.bloqueioProtocoloMinimo ?? 100;
  const activeCases = input.cases.filter((c) => !c.arquivado);
  const clientById = new Map(input.clients.map((c) => [c.id, c]));

  const docsByCase = new Map<string, CaseDocument[]>();
  for (const doc of input.docs) {
    const arr = docsByCase.get(doc.caseId) || [];
    arr.push(doc);
    docsByCase.set(doc.caseId, arr);
  }

  const tasksByCase = new Map<string, Task[]>();
  for (const task of input.tasks) {
    if (!task.caseId) continue;
    const arr = tasksByCase.get(task.caseId) || [];
    arr.push(task);
    tasksByCase.set(task.caseId, arr);
  }

  const deadlinesByCase = new Map<string, Deadline[]>();
  for (const dl of input.deadlines) {
    if (!dl.caseId || dl.concluido) continue;
    const arr = deadlinesByCase.get(dl.caseId) || [];
    arr.push(dl);
    deadlinesByCase.set(dl.caseId, arr);
  }

  const allCards: FunnelKanbanCard[] = [];

  // 1. Leads ativos (ainda não convertidos em cliente/caso)
  for (const lead of input.leads) {
    const stage = getMacroStageForLead(lead);
    if (!stage) continue;

    const needsFirstContact = lead.statusFunil === 'Novo';
    const hasRiskFlags = Boolean(lead.flagsRisco && lead.flagsRisco.length > 0);
    const hasAttention = needsFirstContact || hasRiskFlags || lead.prioridade === 'Urgente';
    const attentionReason = needsFirstContact
      ? 'Aguardando 1º contato'
      : hasRiskFlags
        ? 'Revisão técnica indicada'
        : lead.prioridade === 'Urgente'
          ? 'Prioridade urgente'
          : undefined;

    allCards.push({
      id: `lead:${lead.id}`,
      kind: 'lead',
      stageId: stage.id,
      clientName: lead.nome || 'Lead sem nome',
      title: lead.subcategoriaSugerida || lead.interesse || 'Diagnóstico inicial',
      subtitle: `${lead.statusFunil}${lead.origem ? ` · ${lead.origem}` : ''}`,
      priority: lead.prioridade || 'Média',
      progressPct: computeLeadVisualProgress(lead, stage),
      docsPct: null,
      pendingDocsCount: 0,
      completedTasksCount: 0,
      totalTasksCount: 0,
      hasAttention,
      attentionReason,
      whatsapp: lead.whatsapp,
      email: lead.email,
      nextStage: getNextMacroStage(stage.id),
      prevStage: getPrevMacroStage(stage.id),
      lead,
    });
  }

  // 2. Casos ativos (com progresso real de etapa + documentos + tarefas + prazos)
  for (const c of activeCases) {
    const stage = getMacroStageForCase(c);
    const client = clientById.get(c.clientId);
    const cDocs = docsByCase.get(c.id) || [];
    const cTasks = tasksByCase.get(c.id) || [];
    const cDeadlines = deadlinesByCase.get(c.id) || [];

    const thermo = calcularTermometroDocumentos(cDocs, minProtocolScore);
    const pendingDocsCount = cDocs.filter((d) => d.status !== 'Aprovado').length;
    const rejectedDocsCount = cDocs.filter((d) => d.status === 'Reprovado' || d.status === 'Vencido').length;
    const completedTasksCount = cTasks.filter((t) => t.status === 'Concluída').length;
    const totalTasksCount = cTasks.length;

    let urgentDeadlineDays: number | null = null;
    for (const dl of cDeadlines) {
      const diff = daysUntilDate(dl.dataLimite);
      if (diff !== null && diff <= 15) {
        urgentDeadlineDays = urgentDeadlineDays === null ? diff : Math.min(urgentDeadlineDays, diff);
      }
    }

    const hasAttention =
      rejectedDocsCount > 0 ||
      urgentDeadlineDays !== null ||
      c.statusSermig === 'Requerimento de documentos' ||
      c.prioridade === 'Urgente';

    let attentionReason: string | undefined;
    if (urgentDeadlineDays !== null) {
      attentionReason =
        urgentDeadlineDays < 0
          ? `Prazo vencido (${Math.abs(urgentDeadlineDays)}d)`
          : `Prazo em ${urgentDeadlineDays}d`;
    } else if (c.statusSermig === 'Requerimento de documentos') {
      attentionReason = 'Requerimento SERMIG aberto';
    } else if (rejectedDocsCount > 0) {
      attentionReason = `${rejectedDocsCount} doc(s) reprovado/vencido`;
    } else if (c.prioridade === 'Urgente') {
      attentionReason = 'Caso prioritário';
    }

    const stageSummary = formatCaseStageSummary(c.etapaPipeline);
    const progressPct = computeCaseVisualProgress(
      stage,
      thermo.notaGeral,
      completedTasksCount,
      totalTasksCount,
      c.statusSermig,
    );

    allCards.push({
      id: `case:${c.id}`,
      kind: 'case',
      stageId: stage.id,
      clientName: client?.nomeCompleto || c.titulo,
      title: c.titulo,
      subtitle: `${stageSummary.subStageName} · ${c.tipoServico}`,
      priority: c.prioridade || 'Média',
      progressPct,
      docsPct: thermo.notaGeral,
      pendingDocsCount,
      completedTasksCount,
      totalTasksCount,
      hasAttention,
      attentionReason,
      whatsapp: client?.whatsapp,
      email: client?.email,
      sermigStatus: c.statusSermig,
      sermigProtocol: c.numeroPedidoSermig,
      nextStage: getNextMacroStage(stage.id),
      prevStage: getPrevMacroStage(stage.id),
      caseRecord: c,
      client,
    });
  }

  const query = (input.filters?.query || '').trim().toLowerCase();
  const kindFilter = input.filters?.kind || 'all';
  const priorityFilter = input.filters?.priority || 'all';

  const filteredCards = allCards.filter((card) => {
    if (kindFilter === 'cases' && card.kind !== 'case') return false;
    if (kindFilter === 'leads' && card.kind !== 'lead') return false;
    if (kindFilter === 'attention' && !card.hasAttention) return false;
    if (priorityFilter !== 'all' && card.priority !== priorityFilter) return false;

    if (query) {
      const haystack = [
        card.clientName,
        card.title,
        card.subtitle,
        card.email || '',
        card.sermigProtocol || '',
        card.sermigStatus || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  // Sort cards within each column: attention first, then priority, then client name
  filteredCards.sort((a, b) => {
    if (a.hasAttention !== b.hasAttention) return a.hasAttention ? -1 : 1;
    const pDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (pDiff !== 0) return pDiff;
    return a.clientName.localeCompare(b.clientName, 'pt-BR');
  });

  const metrics = computeUnifiedFunnelMetrics(input.leads, activeCases);
  const metricByStageId = new Map(metrics.stages.map((m) => [m.stage.id, m]));

  const columns: FunnelKanbanColumn[] = MACRO_FUNNEL_STAGES.map((stage) => {
    const stageCards = filteredCards.filter((card) => card.stageId === stage.id);
    const stageMetric = metricByStageId.get(stage.id);
    return {
      stage,
      cards: stageCards,
      conversionFromPrevPct: stageMetric?.conversionFromPrevPct ?? null,
      isBottleneck: metrics.bottleneckStage?.id === stage.id && stageCards.length > 0,
    };
  });

  return {
    columns,
    metrics,
    totalVisibleCards: filteredCards.length,
    totalAllCards: allCards.length,
    attentionCardsCount: allCards.filter((c) => c.hasAttention).length,
  };
}

export type KanbanMoveEvaluation =
  | { allowed: false; reason: 'same-stage' }
  | { allowed: false; reason: 'requires-lead-conversion'; message: string }
  | { allowed: false; reason: 'protocol-gate-blocked'; message: string; caseId: string }
  | {
      allowed: true;
      entity: 'lead';
      leadId: string;
      nextStatusFunil: Lead['statusFunil'];
    }
  | {
      allowed: true;
      entity: 'case';
      caseId: string;
      targetPipelineStep: number;
      nextStatusSermig?: Case['statusSermig'];
    };

/**
 * Valida a movimentação de um cartão no Funil Kanban entre os 5 marcos,
 * garantindo integridade operacional (conversão de lead e trava documental pré-protocolo).
 */
export function evaluateKanbanMove(input: {
  card: FunnelKanbanCard;
  targetStageId: MacroFunnelStageId;
  bloqueioProtocoloMinimo?: number;
}): KanbanMoveEvaluation {
  const { card, targetStageId } = input;
  const minProtocol = input.bloqueioProtocoloMinimo ?? 100;

  if (card.stageId === targetStageId) {
    return { allowed: false, reason: 'same-stage' };
  }

  if (card.kind === 'lead' && card.lead) {
    if (targetStageId === 'diagnostico') {
      return {
        allowed: true,
        entity: 'lead',
        leadId: card.lead.id,
        nextStatusFunil: 'Diagnóstico Agendado',
      };
    }
    if (targetStageId === 'proposta') {
      return {
        allowed: true,
        entity: 'lead',
        leadId: card.lead.id,
        nextStatusFunil: 'Orçamento Enviado',
      };
    }
    return {
      allowed: false,
      reason: 'requires-lead-conversion',
      message: `Para mover "${card.clientName}" para Documentação ou adiante, converta o lead em Cliente e Processo na aba Leads.`,
    };
  }

  if (card.kind === 'case' && card.caseRecord) {
    const targetStep = resolveTargetPipelineStep(targetStageId, card.caseRecord.etapaPipeline);
    const docsPct = card.docsPct ?? 0;

    if (targetStep >= 7 && card.caseRecord.etapaPipeline < 7 && docsPct < minProtocol) {
      return {
        allowed: false,
        reason: 'protocol-gate-blocked',
        caseId: card.caseRecord.id,
        message: `"${card.clientName}" está com ${docsPct}% dos documentos aprovados (mínimo ${minProtocol}% para avançar para Trâmite/SERMIG).`,
      };
    }

    const nextStatusSermig =
      targetStep >= 7 && card.caseRecord.statusSermig === 'Não protocolado'
        ? ('Em trâmite' as const)
        : undefined;

    return {
      allowed: true,
      entity: 'case',
      caseId: card.caseRecord.id,
      targetPipelineStep: targetStep,
      nextStatusSermig,
    };
  }

  return { allowed: false, reason: 'same-stage' };
}
