import type {
  Case,
  CaseDocument,
  Client,
  Deadline,
  Lead,
  Task,
  UserProfile,
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
import {
  matchesCreatedDateRange,
  parseCreatedAtMs,
  type FunnelPerformancePeriod,
} from './funnelPerformanceModel';

export type FunnelKanbanCardKind = 'lead' | 'case';
export type FunnelKanbanFilterKind = 'all' | 'cases' | 'leads' | 'attention';
export type FunnelKanbanSortBy =
  | 'urgency_date'
  | 'created_desc'
  | 'created_asc'
  | 'progress_desc'
  | 'name_asc';

export interface FunnelKanbanAssigneeOption {
  id: string;
  label: string;
  count: number;
}

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
  createdAt?: string;
  assigneeId?: string;
  assigneeName?: string;
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
  assigneeOptions: FunnelKanbanAssigneeOption[];
  unassignedCount: number;
}

export interface FunnelKanbanFilters {
  query?: string;
  kind?: FunnelKanbanFilterKind;
  priority?: 'all' | 'Urgente' | 'Alta' | 'Média' | 'Baixa';
  assigneeId?: 'all' | 'unassigned' | string;
  datePreset?: FunnelPerformancePeriod;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: FunnelKanbanSortBy;
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
  // Base progress by macro milestone (1..5 -> 15%, 32%, 50%, 75%, 90%)
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

function formatFallbackAssigneeLabel(rawId: string): string {
  const trimmed = rawId.trim();
  if (!trimmed) return 'Sem responsável';
  if (trimmed.includes(' ') || trimmed.includes('@')) return trimmed;
  return trimmed.length > 14 ? `Consultor (${trimmed.slice(0, 8)}…)` : `Consultor (${trimmed})`;
}

function compareCards(a: FunnelKanbanCard, b: FunnelKanbanCard, sortBy: FunnelKanbanSortBy): number {
  const aTs = parseCreatedAtMs(a.createdAt);
  const bTs = parseCreatedAtMs(b.createdAt);

  if (sortBy === 'created_desc') {
    const aVal = aTs ?? Number.NEGATIVE_INFINITY;
    const bVal = bTs ?? Number.NEGATIVE_INFINITY;
    if (bVal !== aVal) return bVal - aVal;
    return a.clientName.localeCompare(b.clientName, 'pt-BR');
  }

  if (sortBy === 'created_asc') {
    const aVal = aTs ?? Number.POSITIVE_INFINITY;
    const bVal = bTs ?? Number.POSITIVE_INFINITY;
    if (aVal !== bVal) return aVal - bVal;
    return a.clientName.localeCompare(b.clientName, 'pt-BR');
  }

  if (sortBy === 'progress_desc') {
    if (b.progressPct !== a.progressPct) return b.progressPct - a.progressPct;
    return a.clientName.localeCompare(b.clientName, 'pt-BR');
  }

  if (sortBy === 'name_asc') {
    return a.clientName.localeCompare(b.clientName, 'pt-BR');
  }

  // Padrão ('urgency_date'): alertas de atenção primeiro, depois prioridade, depois data de criação mais recente
  if (a.hasAttention !== b.hasAttention) return a.hasAttention ? -1 : 1;
  const pDiff = priorityRank(a.priority) - priorityRank(b.priority);
  if (pDiff !== 0) return pDiff;
  const aVal = aTs ?? Number.NEGATIVE_INFINITY;
  const bVal = bTs ?? Number.NEGATIVE_INFINITY;
  if (bVal !== aVal) return bVal - aVal;
  return a.clientName.localeCompare(b.clientName, 'pt-BR');
}

/**
 * Constrói o modelo completo das 5 colunas do Dashboard de Funnel Kanban
 * (Diagnóstico, Proposta, Documentação, Trâmite, Finalização), unificando Leads ativos e Casos
 * sem contagem dupla, com filtros por pesquisa, data de criação, urgência e responsável, além de ordenação.
 */
export function buildFunnelKanbanBoard(input: {
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  docs: CaseDocument[];
  tasks: Task[];
  deadlines: Deadline[];
  staffUsers?: UserProfile[];
  currentUser?: UserProfile | null;
  bloqueioProtocoloMinimo?: number;
  filters?: FunnelKanbanFilters;
  now?: Date;
}): FunnelKanbanBoardModel {
  const minProtocolScore = input.bloqueioProtocoloMinimo ?? 100;
  const activeCases = input.cases.filter((c) => !c.arquivado);
  const clientById = new Map(input.clients.map((c) => [c.id, c]));

  const staffNameById = new Map<string, string>();
  for (const u of input.staffUsers || []) {
    if (u.uid) {
      staffNameById.set(u.uid, u.nome || u.email || u.uid);
    }
  }
  if (input.currentUser?.uid && !staffNameById.has(input.currentUser.uid)) {
    staffNameById.set(
      input.currentUser.uid,
      input.currentUser.nome || input.currentUser.email || input.currentUser.uid,
    );
  }

  const resolveAssigneeName = (rawId?: string): string | undefined => {
    const id = (rawId || '').trim();
    if (!id) return undefined;
    return staffNameById.get(id) || formatFallbackAssigneeLabel(id);
  };

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

    const assigneeId = (lead.responsavelId || '').trim() || undefined;

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
      createdAt: lead.createdAt,
      assigneeId,
      assigneeName: resolveAssigneeName(assigneeId),
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
    const assigneeId = (c.consultorId || '').trim() || undefined;

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
      createdAt: c.createdAt,
      assigneeId,
      assigneeName: resolveAssigneeName(assigneeId),
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

  // Constrói opções dinâmicas de responsáveis pela consultoria (equipe + atribuídos nos cartões)
  const assigneeCounts = new Map<string, number>();
  let unassignedCount = 0;
  for (const card of allCards) {
    if (card.assigneeId) {
      assigneeCounts.set(card.assigneeId, (assigneeCounts.get(card.assigneeId) || 0) + 1);
    } else {
      unassignedCount += 1;
    }
  }

  const assigneeIds = new Set<string>([
    ...Array.from(staffNameById.keys()),
    ...Array.from(assigneeCounts.keys()),
  ]);

  const assigneeOptions: FunnelKanbanAssigneeOption[] = Array.from(assigneeIds)
    .map((id) => ({
      id,
      label: staffNameById.get(id) || formatFallbackAssigneeLabel(id),
      count: assigneeCounts.get(id) || 0,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.label.localeCompare(b.label, 'pt-BR');
    });

  const query = (input.filters?.query || '').trim().toLowerCase();
  const kindFilter = input.filters?.kind || 'all';
  const priorityFilter = input.filters?.priority || 'all';
  const assigneeFilter = input.filters?.assigneeId || 'all';
  const datePreset = input.filters?.datePreset || 'all';
  const createdFrom = input.filters?.createdFrom;
  const createdTo = input.filters?.createdTo;
  const sortBy: FunnelKanbanSortBy = input.filters?.sortBy || 'urgency_date';

  const filteredCards = allCards.filter((card) => {
    if (kindFilter === 'cases' && card.kind !== 'case') return false;
    if (kindFilter === 'leads' && card.kind !== 'lead') return false;
    if (kindFilter === 'attention' && !card.hasAttention) return false;
    if (priorityFilter !== 'all' && card.priority !== priorityFilter) return false;

    if (assigneeFilter === 'unassigned') {
      if (card.assigneeId) return false;
    } else if (assigneeFilter !== 'all') {
      if (card.assigneeId !== assigneeFilter) return false;
    }

    if (
      !matchesCreatedDateRange(card.createdAt, {
        period: datePreset,
        fromDate: createdFrom,
        toDate: createdTo,
        now: input.now,
      })
    ) {
      return false;
    }

    if (query) {
      const haystack = [
        card.clientName,
        card.title,
        card.subtitle,
        card.email || '',
        card.sermigProtocol || '',
        card.sermigStatus || '',
        card.assigneeName || '',
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });

  filteredCards.sort((a, b) => compareCards(a, b, sortBy));

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
    assigneeOptions,
    unassignedCount,
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
