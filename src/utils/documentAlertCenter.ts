import type { Case, CaseDocument, Client, Deadline, Dependent, VisaRequirement } from '../types/domain';
import { formatDeadlineCountdownLabel, buildClientDeadlineMonitorSnapshot } from './clientDeadlineMonitor';
import type { ExpirationReminderItem } from './documentExpiration';

export type AlertTrafficLevel = 'vermelho' | 'amarelo' | 'verde';

export interface DocumentAlertCardItem {
  id: string;
  level: AlertTrafficLevel;
  levelLabel: string;
  titulo: string;
  titularNome: string;
  sourceLabel: string;
  categoryGroup: 'visto_prazo' | 'documento';
  dataVencimento: string;
  dataVencimentoBR: string;
  daysRemaining: number;
  countdownLabel: string;
  guidance: string;
  proximityPct: number;
  reminder: ExpirationReminderItem;
}

export interface DocumentAlertCenterSnapshot {
  criticalThresholdDays: number;
  warningThresholdDays: number;
  overallStatus: 'critico' | 'atencao' | 'saudavel' | 'vazio';
  cards: DocumentAlertCardItem[];
  counts: {
    total: number;
    vermelho: number;
    amarelo: number;
    verde: number;
  };
  missingDatesCount: number;
  missingDatesHints: string[];
}

export const DEFAULT_CRITICAL_THRESHOLD_DAYS = 15;
export const DEFAULT_WARNING_THRESHOLD_DAYS = 45;

export function classifyAlertTrafficLevel(
  daysRemaining: number,
  criticalThresholdDays = DEFAULT_CRITICAL_THRESHOLD_DAYS,
  warningThresholdDays = DEFAULT_WARNING_THRESHOLD_DAYS,
): AlertTrafficLevel {
  if (daysRemaining <= criticalThresholdDays) return 'vermelho';
  if (daysRemaining <= warningThresholdDays) return 'amarelo';
  return 'verde';
}

export function getAlertTrafficLevelLabel(level: AlertTrafficLevel, daysRemaining: number): string {
  if (level === 'vermelho') {
    return daysRemaining < 0 ? 'Vencido · Crítico' : 'Urgente · Crítico';
  }
  if (level === 'amarelo') {
    return 'Atenção · Próximo';
  }
  return 'Em dia · Seguro';
}

export function getAlertGuidanceCopy(level: AlertTrafficLevel, daysRemaining: number, categoryGroup: 'visto_prazo' | 'documento'): string {
  if (daysRemaining < 0) {
    return categoryGroup === 'visto_prazo'
      ? 'Prazo vencido. Fale imediatamente com o consultor para regularização.'
      : 'Documento vencido. Providencie nova emissão e envie no cofre documental.';
  }
  if (level === 'vermelho') {
    return categoryGroup === 'visto_prazo'
      ? 'Prazo crítico em menos de 15 dias. Priorize esta etapa junto ao consultor.'
      : 'Vencimento iminente. Solicite renovação/reemissão imediatamente.';
  }
  if (level === 'amarelo') {
    return categoryGroup === 'visto_prazo'
      ? 'Prazo se aproximando. Revise os requisitos e antecipe o agendamento.'
      : 'Planeje a atualização com antecedência para evitar atrasos no protocolo SERMIG.';
  }
  return 'Validade confortável — monitorado automaticamente pelo seu painel.';
}

export function computeAlertProximityPct(daysRemaining: number, warningThresholdDays: number): number {
  if (daysRemaining <= 0) return 100;
  const horizon = Math.max(warningThresholdDays * 2, 90);
  const ratio = 1 - Math.min(daysRemaining, horizon) / horizon;
  return Math.max(8, Math.min(100, Math.round(ratio * 100)));
}

export function buildDocumentAlertCenterSnapshot(params: {
  client: Client;
  dependents?: Dependent[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines?: Deadline[];
  visaRequirements?: VisaRequirement[];
  criticalThresholdDays?: number;
  warningThresholdDays?: number;
  referenceDate?: Date;
}): DocumentAlertCenterSnapshot {
  const criticalThresholdDays = Math.max(1, Math.min(30, Math.round(params.criticalThresholdDays ?? DEFAULT_CRITICAL_THRESHOLD_DAYS)));
  const warningThresholdDays = Math.max(
    criticalThresholdDays + 1,
    Math.min(180, Math.round(params.warningThresholdDays ?? DEFAULT_WARNING_THRESHOLD_DAYS)),
  );

  const baseSnapshot = buildClientDeadlineMonitorSnapshot({
    client: params.client,
    dependents: params.dependents,
    cases: params.cases,
    docs: params.docs,
    deadlines: params.deadlines,
    visaRequirements: params.visaRequirements,
    alertDays: warningThresholdDays,
    referenceDate: params.referenceDate,
  });

  const cards: DocumentAlertCardItem[] = baseSnapshot.items.map((item) => {
    const level = classifyAlertTrafficLevel(item.daysRemaining, criticalThresholdDays, warningThresholdDays);
    return {
      id: item.id,
      level,
      levelLabel: getAlertTrafficLevelLabel(level, item.daysRemaining),
      titulo: item.titulo,
      titularNome: item.titularNome,
      sourceLabel: item.sourceLabel,
      categoryGroup: item.categoryGroup,
      dataVencimento: item.dataVencimento,
      dataVencimentoBR: item.dataVencimentoBR,
      daysRemaining: item.daysRemaining,
      countdownLabel: formatDeadlineCountdownLabel(item.daysRemaining),
      guidance: getAlertGuidanceCopy(level, item.daysRemaining, item.categoryGroup),
      proximityPct: computeAlertProximityPct(item.daysRemaining, warningThresholdDays),
      reminder: item.reminder,
    };
  });

  // Se o titular cadastrou a validade do passaporte no perfil mas ainda não existe um item de checklist de Passaporte,
  // incluímos o monitoramento automático na Central de Alertas para nenhuma data crítica passar despercebida.
  const hasPassportCard = cards.some((c) => /passaporte|pasaporte/i.test(c.titulo));
  const rawPassportVal = params.client.passaporte?.validade?.trim();
  if (!hasPassportCard && rawPassportVal) {
    const parsedMs = Date.parse(rawPassportVal.length === 10 ? `${rawPassportVal}T12:00:00Z` : rawPassportVal);
    if (!Number.isNaN(parsedMs)) {
      const ref = params.referenceDate ?? new Date();
      const refMid = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate());
      const targetDate = new Date(parsedMs);
      const targetMid = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
      const daysRemaining = Math.round((targetMid - refMid) / 86_400_000);
      const level = classifyAlertTrafficLevel(daysRemaining, criticalThresholdDays, warningThresholdDays);
      const dd = String(targetDate.getUTCDate()).padStart(2, '0');
      const mm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
      const yyyy = targetDate.getUTCFullYear();
      const dataVencimentoBR = `${dd}/${mm}/${yyyy}`;
      const titular = params.client.nomeCompleto || 'Titular';
      const syntheticReminder: ExpirationReminderItem = {
        doc: {
          id: `passport_profile_${params.client.id}`,
          caseId: params.cases[0]?.id || '',
          clientId: params.client.id,
          nomeDocumento: 'Passaporte do Titular',
          categoriaDoc: 'Identidade',
          etapaEsteira: '1 Aguardando Envio',
          ordemEmissao: 0,
          pessoa: titular,
          status: daysRemaining < 0 ? 'Vencido' : 'Aprovado',
          obrigatorio: true,
          validadeDias: 3650,
          dataValidadeCalculada: rawPassportVal,
          apostilado: false,
          traduzido: false,
          exigeApostila: false,
          exigeTraducao: false,
          peso: 5,
          versao: 1,
        },
        itemKind: 'documento',
        validadeDias: 3650,
        dataValidadeEfetiva: rawPassportVal,
        dataValidadeBR: dataVencimentoBR,
        daysRemaining,
        severity: daysRemaining < 0 ? 'vencido' : daysRemaining <= 7 ? 'critico' : daysRemaining <= warningThresholdDays ? 'atencao' : 'valido',
        isExpiringUnder30Days: daysRemaining <= 30,
        statusLabel: formatDeadlineCountdownLabel(daysRemaining),
        sourceKind: 'passaporte_cadastro',
        caseObj: params.cases[0] || {
          id: '',
          clientId: params.client.id,
          titulo: 'Processo Migratório',
          tipoServico: 'Visto e RUT',
          etapaPipeline: 1,
          statusSermig: 'Em preparação',
        },
        client: params.client,
      };
      cards.push({
        id: `passport_profile_${params.client.id}`,
        level,
        levelLabel: getAlertTrafficLevelLabel(level, daysRemaining),
        titulo: 'Passaporte do Titular',
        titularNome: titular,
        sourceLabel: 'Passaporte (Cadastro)',
        categoryGroup: 'documento',
        dataVencimento: rawPassportVal,
        dataVencimentoBR,
        daysRemaining,
        countdownLabel: formatDeadlineCountdownLabel(daysRemaining),
        guidance: getAlertGuidanceCopy(level, daysRemaining, 'documento'),
        proximityPct: computeAlertProximityPct(daysRemaining, warningThresholdDays),
        reminder: syntheticReminder,
      });
    }
  }

  // Sort: vermelho -> amarelo -> verde, then earliest expiration first
  const levelWeight: Record<AlertTrafficLevel, number> = {
    vermelho: 0,
    amarelo: 1,
    verde: 2,
  };
  cards.sort((a, b) => {
    const wDiff = levelWeight[a.level] - levelWeight[b.level];
    if (wDiff !== 0) return wDiff;
    return a.daysRemaining - b.daysRemaining;
  });

  const vermelho = cards.filter((c) => c.level === 'vermelho').length;
  const amarelo = cards.filter((c) => c.level === 'amarelo').length;
  const verde = cards.filter((c) => c.level === 'verde').length;

  const overallStatus: DocumentAlertCenterSnapshot['overallStatus'] =
    cards.length === 0
      ? 'vazio'
      : vermelho > 0
        ? 'critico'
        : amarelo > 0
          ? 'atencao'
          : 'saudavel';

  return {
    criticalThresholdDays,
    warningThresholdDays,
    overallStatus,
    cards,
    counts: {
      total: cards.length,
      vermelho,
      amarelo,
      verde,
    },
    missingDatesCount: baseSnapshot.missingCriticalDates.length,
    missingDatesHints: baseSnapshot.missingCriticalDates,
  };
}

export function filterAlertCenterCards(
  cards: DocumentAlertCardItem[],
  options: {
    level: 'todos' | AlertTrafficLevel;
    search?: string;
  },
): DocumentAlertCardItem[] {
  const q = (options.search || '').trim().toLowerCase();
  return cards.filter((card) => {
    if (options.level !== 'todos' && card.level !== options.level) return false;
    if (!q) return true;
    return (
      card.titulo.toLowerCase().includes(q) ||
      card.sourceLabel.toLowerCase().includes(q) ||
      card.titularNome.toLowerCase().includes(q) ||
      card.dataVencimentoBR.toLowerCase().includes(q)
    );
  });
}
