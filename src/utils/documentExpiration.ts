import type {
  Case,
  CaseDocument,
  Client,
  Deadline,
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

export type ExpirationItemKind = 'documento' | 'visto' | 'prazo_visto';

export interface DocumentExpirationEvaluation {
  doc: CaseDocument;
  itemKind: ExpirationItemKind;
  validadeDias: number;
  dataEmissao?: string;
  dataValidadeEfetiva?: string;
  dataValidadeBR: string;
  daysRemaining: number | null;
  severity: ExpirationSeverity;
  isExpiringUnder30Days: boolean;
  statusLabel: string;
  sourceKind:
    | 'documento'
    | 'calculado_emissao'
    | 'passaporte_cadastro'
    | 'status_vencido'
    | 'visto_residencia'
    | 'prazo_legal'
    | 'sem_data';
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
    vistosAlerta: number;
    documentosAlerta: number;
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

const MONITORED_VISA_DEADLINE_TYPES = new Set<Deadline['tipo']>([
  'Vencimento Cédula',
  'Validade Passaporte',
  'Validade Documento',
  'Entrada no Chile 90d',
  'Janela Prorrogação',
]);

function evaluateTargetDate(params: {
  doc: CaseDocument;
  itemKind: ExpirationItemKind;
  validadeDias: number;
  dataEmissao?: string;
  dataValidadeEfetiva: string;
  sourceKind: DocumentExpirationEvaluation['sourceKind'];
  hoje: Date;
  warningDays?: number;
}): DocumentExpirationEvaluation {
  const {
    doc,
    itemKind,
    validadeDias,
    dataEmissao,
    dataValidadeEfetiva,
    sourceKind,
    hoje,
    warningDays = EXPIRATION_WARNING_DAYS,
  } = params;

  const daysRemaining = diffDaysFromReference(dataValidadeEfetiva, hoje);
  const dataValidadeBR = formatDateBR(dataValidadeEfetiva);

  if (daysRemaining !== null) {
    if (daysRemaining <= 0 || doc.status === 'Vencido') {
      const daysOver = Math.abs(daysRemaining);
      return {
        doc,
        itemKind,
        validadeDias,
        dataEmissao,
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
        itemKind,
        validadeDias,
        dataEmissao,
        dataValidadeEfetiva,
        dataValidadeBR,
        daysRemaining,
        severity: 'critico',
        isExpiringUnder30Days: true,
        statusLabel: daysRemaining === 1 ? 'Expira amanhã (1 dia)' : `Expira em ${daysRemaining} dias`,
        sourceKind,
      };
    }

    // Inclusive <= 30 days so the system sends alerts exactly 30 days before expiration
    if (daysRemaining <= warningDays) {
      return {
        doc,
        itemKind,
        validadeDias,
        dataEmissao,
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
      itemKind,
      validadeDias,
      dataEmissao,
      dataValidadeEfetiva,
      dataValidadeBR,
      daysRemaining,
      severity: 'valido',
      isExpiringUnder30Days: false,
      statusLabel: `Válido (${daysRemaining} dias restantes)`,
      sourceKind,
    };
  }

  return {
    doc,
    itemKind,
    validadeDias,
    dataEmissao,
    dataValidadeEfetiva: undefined,
    dataValidadeBR: '—',
    daysRemaining: null,
    severity: 'sem_data',
    isExpiringUnder30Days: false,
    statusLabel: 'Data não informada',
    sourceKind: 'sem_data',
  };
}

export function resolveDocumentExpiration(params: {
  doc: CaseDocument;
  visaRequirements?: VisaRequirement[];
  client?: Client;
  dependents?: Dependent[];
  hoje?: Date;
  warningDays?: number;
}): DocumentExpirationEvaluation {
  const {
    doc,
    visaRequirements = [],
    client,
    dependents = [],
    hoje = new Date(),
    warningDays = EXPIRATION_WARNING_DAYS,
  } = params;

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

  if (dataValidadeEfetiva) {
    return evaluateTargetDate({
      doc,
      itemKind: 'documento',
      validadeDias,
      dataEmissao: doc.dataEmissao,
      dataValidadeEfetiva,
      sourceKind,
      hoje,
      warningDays,
    });
  }

  if (doc.status === 'Vencido') {
    return {
      doc,
      itemKind: 'documento',
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
      itemKind: 'documento',
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
    itemKind: 'documento',
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

function makeSyntheticVisaDoc(params: {
  id: string;
  caseObj: Case;
  nomeDocumento: string;
  dataValidadeCalculada: string;
  orgaoEmissor: string;
}): CaseDocument {
  return {
    id: params.id,
    caseId: params.caseObj.id,
    clientId: params.caseObj.clientId,
    pessoa: 'Titular',
    nomeDocumento: params.nomeDocumento,
    categoriaDoc: 'Identidade',
    etapaEsteira: '6 Aprovado para Protocolo',
    ordemEmissao: 1,
    status: 'Aprovado',
    validadeDias: 0,
    dataValidadeCalculada: params.dataValidadeCalculada,
    orgaoEmissor: params.orgaoEmissor,
    apostilado: false,
    traduzido: false,
    exigeApostila: false,
    exigeTraducao: false,
    obrigatorio: true,
    peso: 5,
    versao: 1,
  };
}

export function collectExpirationReminders(params: {
  docs: CaseDocument[];
  cases: Case[];
  clients: Client[];
  dependents?: Dependent[];
  visaRequirements?: VisaRequirement[];
  deadlines?: Deadline[];
  hoje?: Date;
  warningDays?: number;
  includeArchivedCases?: boolean;
}): ExpirationSummaryResult {
  const {
    docs,
    cases,
    clients,
    dependents = [],
    visaRequirements = [],
    deadlines = [],
    hoje = new Date(),
    warningDays = EXPIRATION_WARNING_DAYS,
    includeArchivedCases = false,
  } = params;

  const activeCases = cases.filter((c) => includeArchivedCases || !c.arquivado);
  const caseMap = new Map(activeCases.map((c) => [c.id, c]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const expiringItems: ExpirationReminderItem[] = [];
  const upcomingItems: ExpirationReminderItem[] = [];
  const missingDateItems: ExpirationReminderItem[] = [];
  let monitoredCount = 0;

  const pushEvaluated = (evaluated: DocumentExpirationEvaluation, caseObj: Case, client?: Client) => {
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
  };

  // 1. Documentos exigidos no checklist
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
      warningDays,
    });
    pushEvaluated(evaluated, caseObj, client);
  }

  // 2. Expiração de Visto / Residência e Prazo Limite de Entrada (Estampado 90d) dos Processos
  for (const caseObj of activeCases) {
    const client = clientMap.get(caseObj.clientId);

    if (caseObj.dataVencimentoResidencia && parseFlexibleDate(caseObj.dataVencimentoResidencia)) {
      const syntheticDoc = makeSyntheticVisaDoc({
        id: `visa_exp_${caseObj.id}`,
        caseObj,
        nomeDocumento: `Visto / ${caseObj.tipoServico} (${caseObj.subcategoriaIa || 'Residência SERMIG'})`,
        dataValidadeCalculada: caseObj.dataVencimentoResidencia,
        orgaoEmissor: 'SERMIG Chile',
      });
      const evaluated = evaluateTargetDate({
        doc: syntheticDoc,
        itemKind: 'visto',
        validadeDias: 0,
        dataEmissao: caseObj.dataAprovacao,
        dataValidadeEfetiva: caseObj.dataVencimentoResidencia,
        sourceKind: 'visto_residencia',
        hoje,
        warningDays,
      });
      pushEvaluated(evaluated, caseObj, client);
    }

    if (caseObj.dataLimiteEntrada && parseFlexibleDate(caseObj.dataLimiteEntrada)) {
      const syntheticEntryDoc = makeSyntheticVisaDoc({
        id: `visa_entry_${caseObj.id}`,
        caseObj,
        nomeDocumento: 'Prazo Limite de Entrada no Chile (Estampado Electrónico 90d)',
        dataValidadeCalculada: caseObj.dataLimiteEntrada,
        orgaoEmissor: 'SERMIG / PDI',
      });
      const evaluated = evaluateTargetDate({
        doc: syntheticEntryDoc,
        itemKind: 'visto',
        validadeDias: 90,
        dataEmissao: caseObj.dataAprovacao,
        dataValidadeEfetiva: caseObj.dataLimiteEntrada,
        sourceKind: 'visto_residencia',
        hoje,
        warningDays,
      });
      pushEvaluated(evaluated, caseObj, client);
    }
  }

  // 3. Prazos abertos de Visto, Cédula, Passaporte ou Janela de Prorrogação (Deadlines)
  for (const dl of deadlines) {
    if (dl.concluido) continue;
    if (!MONITORED_VISA_DEADLINE_TYPES.has(dl.tipo)) continue;
    if (!dl.dataLimite || !parseFlexibleDate(dl.dataLimite)) continue;

    const caseObj = dl.caseId ? caseMap.get(dl.caseId) : activeCases.find((c) => c.clientId === dl.clientId);
    if (!caseObj) continue;
    const client = clientMap.get(dl.clientId || caseObj.clientId);

    const syntheticDeadlineDoc = makeSyntheticVisaDoc({
      id: `deadline_exp_${dl.id}`,
      caseObj,
      nomeDocumento: `${dl.tipo}: ${dl.titulo}`,
      dataValidadeCalculada: dl.dataLimite,
      orgaoEmissor: 'SERMIG / Registro Civil',
    });

    const evaluated = evaluateTargetDate({
      doc: syntheticDeadlineDoc,
      itemKind: dl.tipo === 'Validade Documento' ? 'documento' : 'prazo_visto',
      validadeDias: 0,
      dataValidadeEfetiva: dl.dataLimite,
      sourceKind: 'prazo_legal',
      hoje,
      warningDays,
    });
    pushEvaluated(evaluated, caseObj, client);
  }

  const sortByUrgency = (a: ExpirationReminderItem, b: ExpirationReminderItem) => {
    const aDays = a.daysRemaining ?? -9999;
    const bDays = b.daysRemaining ?? -9999;
    if (aDays !== bDays) return aDays - bDays;
    if (a.itemKind !== b.itemKind) return a.itemKind === 'visto' ? -1 : 1;
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
  const vistosAlerta = expiringItems.filter((i) => i.itemKind === 'visto' || i.itemKind === 'prazo_visto').length;
  const documentosAlerta = expiringItems.filter((i) => i.itemKind === 'documento').length;
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
      vistosAlerta,
      documentosAlerta,
      obrigatoriosEmAlerta,
      semData: missingDateItems.length,
    },
  };
}
