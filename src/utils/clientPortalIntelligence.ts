import type {
  Appointment,
  Budget,
  Case,
  CaseDocument,
  Deadline,
  FinancialRecord,
  GeneratedDocument,
} from '../types/domain';
import type { ThermometerResult } from './caseMetrics';

export type PortalActionTab =
  | 'processo'
  | 'documentos'
  | 'biblioteca'
  | 'simulador'
  | 'financeiro'
  | 'suporte'
  | 'dados';

export interface ClientNextAction {
  id: string;
  priority: 'critica' | 'alta' | 'normal';
  category: 'documento' | 'assinatura' | 'prazo' | 'financeiro' | 'lgpd' | 'simulador' | 'agenda';
  title: string;
  detail: string;
  ctaLabel: string;
  targetTab: PortalActionTab;
  targetGenDocId?: string;
}

export interface ClientPortalKpis {
  pipelineStage: number;
  pipelineTotal: number;
  statusSermig: string;
  readinessPct: number;
  approvedDocsCount: number;
  mandatoryDocsCount: number;
  pendingActionsCount: number;
  reprovedDocsCount: number;
  unsignedDocsCount: number;
  nextMilestoneLabel: string;
  nextMilestoneSub: string;
}

export interface ClientActionCenterResult {
  kpis: ClientPortalKpis;
  primaryAction: ClientNextAction | null;
  actions: ClientNextAction[];
  allClearMessage: string;
}

function diffDaysFromNow(isoDate: string | undefined, nowMs: number): number | null {
  if (!isoDate) return null;
  const parsed = Date.parse(isoDate);
  if (Number.isNaN(parsed)) return null;
  return Math.ceil((parsed - nowMs) / (1000 * 60 * 60 * 24));
}

function formatShortDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export interface BuildClientActionCenterInput {
  activeCase: Case | null;
  docs: CaseDocument[];
  deadlines: Deadline[];
  appointments: Appointment[];
  genDocs: GeneratedDocument[];
  budgets: Budget[];
  financials: FinancialRecord[];
  thermo: ThermometerResult;
  needsLgpdAccept: boolean;
  canAccessSimulator: boolean;
  now?: Date;
}

/**
 * Pure deterministic engine that prioritizes what the client should do next
 * inside the Client Portal without clutter or guesswork.
 */
export function buildClientActionCenter(input: BuildClientActionCenterInput): ClientActionCenterResult {
  const {
    activeCase,
    docs,
    deadlines,
    appointments,
    genDocs,
    budgets,
    financials,
    thermo,
    needsLgpdAccept,
    canAccessSimulator,
    now = new Date(),
  } = input;

  const nowMs = now.getTime();
  const actions: ClientNextAction[] = [];

  // 1. Reproved documents (highest priority)
  const reprovedDocs = docs.filter((d) => d.status === 'Reprovado');
  if (reprovedDocs.length > 0) {
    const first = reprovedDocs[0];
    actions.push({
      id: 'act_reproved_docs',
      priority: 'critica',
      category: 'documento',
      title:
        reprovedDocs.length === 1
          ? `Reenviar documento reprovado: ${first.nomeDocumento}`
          : `${reprovedDocs.length} documentos precisam de reenvio`,
      detail: first.motivoReprovacao
        ? `Motivo registrado pela consultoria: ${first.motivoReprovacao}`
        : 'A consultoria solicitou nova cópia legível ou atualizada para seguir com o protocolo.',
      ctaLabel: 'Corrigir documento',
      targetTab: 'documentos',
    });
  }

  // 2. Expiring or expired documents (within 15 days)
  const expiringDocs = docs
    .map((d) => ({ doc: d, days: diffDaysFromNow(d.dataValidadeCalculada, nowMs) }))
    .filter((item) => item.days !== null && item.days <= 15 && item.doc.status !== 'Aprovado');

  if (expiringDocs.length > 0) {
    expiringDocs.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
    const urgent = expiringDocs[0];
    const isExpired = (urgent.days ?? 0) <= 0;
    actions.push({
      id: 'act_expiring_doc',
      priority: 'critica',
      category: 'documento',
      title: isExpired
        ? `Validade expirada: ${urgent.doc.nomeDocumento}`
        : `Validade curta (${urgent.days}d): ${urgent.doc.nomeDocumento}`,
      detail: isExpired
        ? 'Emita uma via atualizada antes do protocolo no SERMIG para evitar indeferimento.'
        : 'Este documento está próximo do vencimento — priorize a conferência ou atualização com a equipe.',
      ctaLabel: 'Ver documentos',
      targetTab: 'documentos',
    });
  }

  // 3. Official generated documents pending signature
  const unsignedDocs = genDocs.filter((gd) => !gd.canceladoEm && gd.status !== 'Assinado');
  if (unsignedDocs.length > 0) {
    const docToSign = unsignedDocs[0];
    actions.push({
      id: `act_sign_${docToSign.id}`,
      priority: 'alta',
      category: 'assinatura',
      title:
        unsignedDocs.length === 1
          ? `Assinar documento oficial: ${docToSign.titulo}`
          : `${unsignedDocs.length} documentos oficiais aguardam assinatura`,
      detail: 'Você pode assinar digitalmente no próprio portal ou anexar a versão assinada em PDF.',
      ctaLabel: 'Assinar agora',
      targetTab: 'documentos',
      targetGenDocId: docToSign.id,
    });
  }

  // 4. Pending mandatory documents
  if (thermo.faltantesObrigatorios > 0) {
    const pendingMandatory = docs.filter(
      (d) => d.obrigatorio && d.status !== 'Aprovado' && d.status !== 'Em análise' && d.status !== 'Reprovado',
    );
    const nextDocName = pendingMandatory[0]?.nomeDocumento;
    actions.push({
      id: 'act_missing_mandatory',
      priority: 'alta',
      category: 'documento',
      title:
        thermo.faltantesObrigatorios === 1
          ? 'Falta apenas 1 documento obrigatório'
          : `Enviar ${thermo.faltantesObrigatorios} documentos obrigatórios pendentes`,
      detail: nextDocName
        ? `Próximo item sugerido na ordem SERMIG: ${nextDocName}.`
        : 'Complete o envio na aba de Documentos para liberar a fase de protocolo.',
      ctaLabel: 'Enviar documentos',
      targetTab: 'documentos',
    });
  }

  // 5. Pending budgets awaiting client approval
  const openBudgets = budgets.filter((b) => b.status === 'Enviado ao Cliente');
  if (openBudgets.length > 0) {
    actions.push({
      id: 'act_open_budget',
      priority: 'alta',
      category: 'financeiro',
      title:
        openBudgets.length === 1
          ? `Orçamento aguardando sua aprovação (${openBudgets[0].numeroOrcamento})`
          : `${openBudgets.length} orçamentos aguardando decisão`,
      detail: 'Revise o escopo e as condições de pagamento na aba Financeiro.',
      ctaLabel: 'Revisar orçamento',
      targetTab: 'financeiro',
    });
  }

  // 6. Overdue or upcoming financial installments (<= 5 days)
  const urgentFinancials = financials
    .filter((f) => f.status !== 'Pago')
    .map((f) => ({ rec: f, days: diffDaysFromNow(f.vencimento, nowMs) }))
    .filter((item) => item.days !== null && item.days <= 5)
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

  if (urgentFinancials.length > 0) {
    const fin = urgentFinancials[0];
    const overdue = (fin.days ?? 0) < 0;
    actions.push({
      id: 'act_financial_due',
      priority: overdue ? 'critica' : 'normal',
      category: 'financeiro',
      title: overdue
        ? `Parcela em atraso: ${fin.rec.descricao}`
        : `Vencimento próximo: ${fin.rec.descricao}`,
      detail: `Vencimento em ${formatShortDate(fin.rec.vencimento)}. Você pode copiar o Pix ou anexar o comprovante diretamente no portal.`,
      ctaLabel: 'Abrir financeiro',
      targetTab: 'financeiro',
    });
  }

  // 7. Urgent deadlines within 10 days
  const upcomingDeadlines = deadlines
    .filter((d) => !d.concluido)
    .map((d) => ({ dl: d, days: diffDaysFromNow(d.dataLimite, nowMs) }))
    .filter((item) => item.days !== null && item.days >= 0)
    .sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

  if (upcomingDeadlines.length > 0 && (upcomingDeadlines[0].days ?? 999) <= 10) {
    const dl = upcomingDeadlines[0];
    actions.push({
      id: 'act_deadline_soon',
      priority: (dl.days ?? 99) <= 3 ? 'critica' : 'alta',
      category: 'prazo',
      title: `Prazo em ${dl.days === 0 ? 'hoje' : `${dl.days} dia(s)`}: ${dl.dl.titulo}`,
      detail: `Data limite registrada: ${formatShortDate(dl.dl.dataLimite)}. Adicione ao seu calendário para não perder o prazo.`,
      ctaLabel: 'Ver agenda',
      targetTab: 'suporte',
    });
  }

  // 8. LGPD acceptance pending
  if (needsLgpdAccept) {
    actions.push({
      id: 'act_lgpd',
      priority: 'alta',
      category: 'lgpd',
      title: 'Confirmar aceite atualizado do Termo LGPD',
      detail: 'Necessário para manter o tratamento seguro dos seus documentos conforme a Lei nº 13.709/2018.',
      ctaLabel: 'Confirmar LGPD',
      targetTab: 'dados',
    });
  }

  // 9. Simulator ready to practice (if enabled & no critical blockers)
  if (canAccessSimulator && actions.length < 3) {
    actions.push({
      id: 'act_simulator',
      priority: 'normal',
      category: 'simulador',
      title: 'Simulador do Portal SERMIG liberado para treino',
      detail: 'Pratique o passo a passo de protocolo no portal oficial com seus dados pré-carregados antes do envio real.',
      ctaLabel: 'Abrir simulador',
      targetTab: 'simulador',
    });
  }

  // Sort by severity: critica > alta > normal
  const weight: Record<ClientNextAction['priority'], number> = { critica: 0, alta: 1, normal: 2 };
  actions.sort((a, b) => weight[a.priority] - weight[b.priority]);

  // Compute Next Milestone (earliest future appointment or deadline)
  const upcomingAppointments = appointments
    .filter((a) => a.status !== 'Cancelado' && a.status !== 'Realizado')
    .map((a) => ({ label: a.titulo, iso: a.dataHoraInicio, days: diffDaysFromNow(a.dataHoraInicio, nowMs), kind: 'Reunião' }))
    .filter((item) => item.days !== null && item.days >= 0);

  const milestoneCandidates = [
    ...upcomingAppointments,
    ...upcomingDeadlines.map((d) => ({
      label: d.dl.titulo,
      iso: d.dl.dataLimite,
      days: d.days,
      kind: 'Prazo',
    })),
  ].sort((a, b) => (a.days ?? 999) - (b.days ?? 999));

  const nextMilestone = milestoneCandidates[0] || null;
  const mandatoryDocs = docs.filter((d) => d.obrigatorio);
  const approvedMandatory = mandatoryDocs.filter((d) => d.status === 'Aprovado').length;

  const kpis: ClientPortalKpis = {
    pipelineStage: activeCase?.etapaPipeline || 1,
    pipelineTotal: 8,
    statusSermig: activeCase?.statusSermig || 'Preparação',
    readinessPct: Math.round(thermo.notaGeral || 0),
    approvedDocsCount: approvedMandatory,
    mandatoryDocsCount: mandatoryDocs.length,
    pendingActionsCount: actions.filter((a) => a.priority !== 'normal').length,
    reprovedDocsCount: reprovedDocs.length,
    unsignedDocsCount: unsignedDocs.length,
    nextMilestoneLabel: nextMilestone ? formatShortDate(nextMilestone.iso) : 'Sem prazo urgente',
    nextMilestoneSub: nextMilestone
      ? `${nextMilestone.kind}: ${nextMilestone.label}`
      : 'Acompanhe novas atualizações por aqui',
  };

  return {
    kpis,
    primaryAction: actions[0] || null,
    actions: actions.slice(0, 4),
    allClearMessage:
      'Tudo em dia no seu processo. Nossa equipe notificará você imediatamente sobre qualquer nova etapa no SERMIG.',
  };
}
