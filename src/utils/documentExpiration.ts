import type {
  Case,
  CaseDocument,
  Client,
  Dependent,
  VisaRequirement,
} from '../types/domain';
import { formatDateBR, parseFlexibleDate, toIsoDate } from './formatters';

export const EXPIRATION_WARNING_DAYS = 30;

export type ExpirationSeverity =
  | 'vencido'
  | 'critico'
  | 'atencao'
  | 'valido'
  | 'sem_data'
  | 'sem_vencimento';

export interface DocumentExpirationEvaluation {
  doc: CaseDocument;
  validadeDias: number;
  dataEmissao?: string;
  dataValidadeEfetiva?: string;
  dataValidadeBR: string;
  daysRemaining: number | null;
  severity: ExpirationSeverity;
  isExpiringUnder30Days: boolean;
  statusLabel: string;
  sourceKind: 'documento' | 'calculado_emissao' | 'passaporte_cadastro' | 'status_vencido' | 'sem_data';
}

export interface ExpirationReminderItem extends DocumentExpirationEvaluation {
  caseObj: Case;
  client?: Client;
}

export interface ExpirationSummaryResult {
  expiringItems: ExpirationReminderItem[];
  upcomingItems: ExpirationReminderItem[];
  missingDateItems: ExpirationReminderItem[];
  monitoredCount: number;
  counts: {
    totalAlertas: number;
    vencidos: number;
    criticos7d: number;
    atencao30d: number;
    obrigatoriosEmAlerta: number;
    semData: number;
  };
}

export function computeCalculatedExpirationIso(
  dataEmissao?: string,
  validadeDias?: number,
): string | undefined {
  const days = Number(validadeDias || 0);
  if (!dataEmissao || days <= 0) return undefined;
  const parsed = parseFlexibleDate(dataEmissao);
  if (!parsed) return undefined;
  return toIsoDate(new Date(parsed.getTime() + days * 86400000));
}

function diffDaysFromReference(targetDateStr: string, hoje: Date): number | null {
  const parsed = parseFlexibleDate(targetDateStr);
  if (!parsed) return null;
  const refIso = toIsoDate(hoje);
  const refNoon = parseFlexibleDate(refIso) ?? hoje;
  return Math.round((parsed.getTime() - refNoon.getTime()) / 86400000);
}

function isPassportDocName(name: string): boolean {
  return /passaporte/i.test(name || '');
}

export function resolveDocumentExpiration(params: {
  doc: CaseDocument;
  visaRequirements?: VisaRequirement[];
  client?: Client;
  dependents?: Dependent[];
  hoje?: Date;
}): DocumentExpirationEvaluation {
  const { doc, visaRequirements = [], client, dependents = [], hoje = new Date() } = params;

  const matchedReq = doc.visaRequirementId
    ? visaRequirements.find((r) => r.id === doc.visaRequirementId)
    : undefined;
  const validadeDias = Number(doc.validadeDias || matchedReq?.validadeDias || 0);

  let dataValidadeEfetiva: string | undefined;
  let sourceKind: DocumentExpirationEvaluation['sourceKind'] = 'sem_data';

  const calculatedFromEmission = computeCalculatedExpirationIso(doc.dataEmissao, validadeDias);

  if (doc.dataValidadeCalculada && parseFlexibleDate(doc.dataValidadeCalculada)) {
    dataValidadeEfetiva = doc.dataValidadeCalculada;
    sourceKind = 'documento';
  } else if (calculatedFromEmission) {
    dataValidadeEfetiva = calculatedFromEmission;
    sourceKind = 'calculado_emissao';
  } else if (isPassportDocName(doc.nomeDocumento)) {
    const pessoaNorm = (doc.pessoa || 'Titular').trim();
    if (pessoaNorm === 'Titular' && client?.passaporte?.validade && parseFlexibleDate(client.passaporte.validade)) {
      dataValidadeEfetiva = client.passaporte.validade;
      sourceKind = 'passaporte_cadastro';
    } else if (pessoaNorm !== 'Titular') {
      const dep = dependents.find(
        (d) =>
          d.clientId === doc.clientId &&
          d.nomeCompleto.trim().toLowerCase() === pessoaNorm.toLowerCase(),
      );
      if (dep?.passaporteValidade && parseFlexibleDate(dep.passaporteValidade)) {
        dataValidadeEfetiva = dep.passaporteValidade;
        sourceKind = 'passaporte_cadastro';
      }
    }
  }

  const daysRemaining = dataValidadeEfetiva ? diffDaysFromReference(dataValidadeEfetiva, hoje) : null;
  const dataValidadeBR = dataValidadeEfetiva ? formatDateBR(dataValidadeEfetiva) : '—';

  if (daysRemaining !== null) {
    if (daysRemaining <= 0 || doc.status === 'Vencido') {
      const daysOver = Math.abs(daysRemaining);
      return {
        doc,
        validadeDias,
        dataEmissao: doc.dataEmissao,
        dataValidadeEfetiva,
        dataValidadeBR,
        daysRemaining,
        severity: 'vencido',
        isExpiringUnder30Days: true,
        statusLabel:
          daysRemaining === 0
            ? 'Vence hoje'
            : daysRemaining < 0
              ? `Vencido há ${daysOver} dia(s)`
              : 'Marcado como vencido',
        sourceKind,
      };
    }

    if (daysRemaining <= 7) {
      return {
        doc,
        validadeDias,
        dataEmissao: doc.dataEmissao,
        dataValidadeEfetiva,
        dataValidadeBR,
        daysRemaining,
        severity: 'critico',
        isExpiringUnder30Days: true,
        statusLabel: daysRemaining === 1 ? 'Expira amanhã (1 dia)' : `Expira em ${daysRemaining} dias`,
        sourceKind,
      };
    }

    if (daysRemaining < EXPIRATION_WARNING_DAYS) {
      return {
        doc,
        validadeDias,
        dataEmissao: doc.dataEmissao,
        dataValidadeEfetiva,
        dataValidadeBR,
        daysRemaining,
        severity: 'atencao',
        isExpiringUnder30Days: true,
        statusLabel: `Expira em ${daysRemaining} dias`,
        sourceKind,
      };
    }

    return {
      doc,
      validadeDias,
      dataEmissao: doc.dataEmissao,
      dataValidadeEfetiva,
      dataValidadeBR,
      daysRemaining,
      severity: 'valido',
      isExpiringUnder30Days: false,
      statusLabel: `Válido (${daysRemaining} dias restantes)`,
      sourceKind,
    };
  }

  if (doc.status === 'Vencido') {
    return {
      doc,
      validadeDias,
      dataEmissao: doc.dataEmissao,
      dataValidadeEfetiva: undefined,
      dataValidadeBR: '—',
      daysRemaining: null,
      severity: 'vencido',
      isExpiringUnder30Days: true,
      statusLabel: 'Status marcado como vencido',
      sourceKind: 'status_vencido',
    };
  }

  if (validadeDias > 0) {
    return {
      doc,
      validadeDias,
      dataEmissao: doc.dataEmissao,
      dataValidadeEfetiva: undefined,
      dataValidadeBR: '—',
      daysRemaining: null,
      severity: 'sem_data',
      isExpiringUnder30Days: false,
      statusLabel: `Aguardando data de emissão (validade ${validadeDias}d)`,
      sourceKind: 'sem_data',
    };
  }

  return {
    doc,
    validadeDias,
    dataEmissao: doc.dataEmissao,
    dataValidadeEfetiva: undefined,
    dataValidadeBR: '—',
    daysRemaining: null,
    severity: 'sem_vencimento',
    isExpiringUnder30Days: false,
    statusLabel: 'Sem vencimento curto',
    sourceKind: 'sem_data',
  };
}

export function collectExpirationReminders(params: {
  docs: CaseDocument[];
  cases: Case[];
  clients: Client[];
  dependents?: Dependent[];
  visaRequirements?: VisaRequirement[];
  hoje?: Date;
  includeArchivedCases?: boolean;
}): ExpirationSummaryResult {
  const {
    docs,
    cases,
    clients,
    dependents = [],
    visaRequirements = [],
    hoje = new Date(),
    includeArchivedCases = false,
  } = params;

  const caseMap = new Map(
    cases.filter((c) => includeArchivedCases || !c.arquivado).map((c) => [c.id, c]),
  );
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const expiringItems: ExpirationReminderItem[] = [];
  const upcomingItems: ExpirationReminderItem[] = [];
  const missingDateItems: ExpirationReminderItem[] = [];
  let monitoredCount = 0;

  for (const doc of docs) {
    const caseObj = caseMap.get(doc.caseId);
    if (!caseObj) continue;
    const client = clientMap.get(doc.clientId || caseObj.clientId);

    const evaluated = resolveDocumentExpiration({
      doc,
      visaRequirements,
      client,
      dependents,
      hoje,
    });

    const item: ExpirationReminderItem = {
      ...evaluated,
      caseObj,
      client,
    };

    if (evaluated.dataValidadeEfetiva) {
      monitoredCount += 1;
    }

    if (evaluated.isExpiringUnder30Days) {
      expiringItems.push(item);
    } else if (evaluated.severity === 'valido') {
      upcomingItems.push(item);
    } else if (evaluated.severity === 'sem_data') {
      missingDateItems.push(item);
    }
  }

  const sortByUrgency = (a: ExpirationReminderItem, b: ExpirationReminderItem) => {
    const aDays = a.daysRemaining ?? -9999;
    const bDays = b.daysRemaining ?? -9999;
    if (aDays !== bDays) return aDays - bDays;
    if (a.doc.obrigatorio !== b.doc.obrigatorio) return a.doc.obrigatorio ? -1 : 1;
    return a.doc.nomeDocumento.localeCompare(b.doc.nomeDocumento);
  };

  expiringItems.sort(sortByUrgency);
  upcomingItems.sort(sortByUrgency);
  missingDateItems.sort((a, b) => {
    if (a.doc.obrigatorio !== b.doc.obrigatorio) return a.doc.obrigatorio ? -1 : 1;
    return a.doc.validadeDias - b.doc.validadeDias;
  });

  const vencidos = expiringItems.filter((i) => i.severity === 'vencido').length;
  const criticos7d = expiringItems.filter((i) => i.severity === 'critico').length;
  const atencao30d = expiringItems.filter((i) => i.severity === 'atencao').length;
  const obrigatoriosEmAlerta = expiringItems.filter((i) => i.doc.obrigatorio).length;

  return {
    expiringItems,
    upcomingItems,
    missingDateItems,
    monitoredCount,
    counts: {
      totalAlertas: expiringItems.length,
      vencidos,
      criticos7d,
      atencao30d,
      obrigatoriosEmAlerta,
      semData: missingDateItems.length,
    },
  };
}
