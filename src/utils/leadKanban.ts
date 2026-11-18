import type { Lead } from '../types/domain';

export const FUNIL_STAGES: Lead['statusFunil'][] = [
  'Novo',
  'Contatado',
  'Diagnóstico Agendado',
  'Orçamento Enviado',
  'Fechado',
  'Perdido',
];

export type LeadUrgencyLevel = 'critica' | 'alta' | 'normal';

export interface LeadUrgencyInfo {
  level: LeadUrgencyLevel;
  label: string;
  reasons: string[];
  ageHours: number | null;
  ageCompact: string;
  slaOverdue: boolean;
  hasConsultantRisk: boolean;
  isIncomplete: boolean;
}

export interface LeadQuickEditPatch {
  statusFunil: Lead['statusFunil'];
  prioridade: Lead['prioridade'];
  temperatura?: Lead['temperatura'];
  motivoPerda?: string;
  notas?: string;
}

export function getLeadAgeHours(createdAt?: string, nowMs = Date.now()): number | null {
  if (!createdAt) return null;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((nowMs - ts) / 3600000));
}

export function formatAgeCompact(hours: number | null): string {
  if (hours === null) return '';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function computeLeadUrgency(lead: Lead, nowMs = Date.now()): LeadUrgencyInfo {
  const ageHours = getLeadAgeHours(lead.createdAt, nowMs);
  const ageCompact = formatAgeCompact(ageHours);
  const slaOverdue =
    lead.statusFunil === 'Novo' && !lead.primeiroContatoEm && ageHours !== null && ageHours >= 24;
  const hasConsultantRisk = Boolean(
    lead.respostasTriagem?.riscoConsultaConsultor?.length || lead.flagsRisco?.length,
  );
  const isIncomplete = Boolean(lead.statusConclusao && lead.statusConclusao !== 'Concluído');

  const reasons: string[] = [];
  if (lead.prioridade === 'Urgente') reasons.push('Prioridade urgente');
  if (slaOverdue) reasons.push(`Sem 1º contato há ${ageCompact}`);
  if (lead.prioridade === 'Alta') reasons.push('Alta prioridade');
  if (lead.temperatura === 'Quente') reasons.push('Lead quente');
  if (hasConsultantRisk) reasons.push('Ponto de atenção ao consultor');
  if (isIncomplete) reasons.push(`Diagnóstico ${lead.statusConclusao?.toLowerCase()} (Et. ${lead.etapaAtual || 1}/6)`);

  let level: LeadUrgencyLevel = 'normal';
  let label: string = lead.prioridade;

  if (lead.statusFunil !== 'Fechado' && lead.statusFunil !== 'Perdido') {
    if (lead.prioridade === 'Urgente' || slaOverdue) {
      level = 'critica';
      label = lead.prioridade === 'Urgente' && slaOverdue
        ? `Urgente · SLA ${ageCompact}`
        : lead.prioridade === 'Urgente'
          ? 'Urgente'
          : `SLA >24h (${ageCompact})`;
    } else if (lead.prioridade === 'Alta' || lead.temperatura === 'Quente' || hasConsultantRisk) {
      level = 'alta';
      label = lead.prioridade === 'Alta' ? 'Alta' : lead.temperatura === 'Quente' ? 'Quente' : 'Atenção';
    }
  }

  return {
    level,
    label,
    reasons,
    ageHours,
    ageCompact,
    slaOverdue,
    hasConsultantRisk,
    isIncomplete,
  };
}

export function buildUpdatedLeadFromPatch(
  lead: Lead,
  patch: LeadQuickEditPatch,
  nowIso = new Date().toISOString(),
): Lead {
  const sanitizedNotas = typeof patch.notas === 'string' ? patch.notas.slice(0, 4000) : lead.notas;
  const sanitizedMotivo =
    patch.statusFunil === 'Perdido'
      ? (patch.motivoPerda || lead.motivoPerda || 'Não informado').trim().slice(0, 500)
      : undefined;

  return {
    ...lead,
    statusFunil: patch.statusFunil,
    prioridade: patch.prioridade,
    temperatura: patch.temperatura ?? lead.temperatura,
    motivoPerda: sanitizedMotivo,
    notas: sanitizedNotas,
    primeiroContatoEm:
      patch.statusFunil !== 'Novo' && !lead.primeiroContatoEm ? nowIso : lead.primeiroContatoEm,
    updatedAt: nowIso,
  };
}
