import type {
  Case,
  CaseDocument,
  DocCategory,
  VisaRequirement,
} from '../types/domain';

export interface ChecklistRowEntry {
  key: string;
  requirement?: VisaRequirement;
  document?: CaseDocument;
  nomeDocumento: string;
  categoriaDoc: DocCategory;
  ordem: number;
  obrigatorio: boolean;
  peso: number;
  validadeDias: number;
  exigeApostila: boolean;
  exigeTraducao: boolean;
  apostilado: boolean;
  traduzido: boolean;
  orgaoEmissor: string;
  comoObterInstrucoes?: string;
  comoObterUrl?: string;
  dataEmissao?: string;
  dataValidadeCalculada?: string;
  status: CaseDocument['status'];
  completed: boolean;
}

export interface ChecklistSummary {
  total: number;
  completed: number;
  pending: number;
  totalObrigatorios: number;
  completedObrigatorios: number;
  percentTotal: number;
  percentObrigatorios: number;
}

export function normalizeChecklistDocName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getApplicableRequirementsForPerson(
  visaCategoryId: string,
  pessoa: string,
  visaRequirements: VisaRequirement[],
): VisaRequirement[] {
  const isDependent = pessoa.trim() !== '' && pessoa.trim() !== 'Titular';
  if (isDependent) {
    const depReqs = visaRequirements.filter((r) => r.visaCategoryId === 'fluxo_dependente');
    if (depReqs.length > 0) {
      return [...depReqs].sort(
        (a, b) =>
          a.ordemPrioridadeEmissao - b.ordemPrioridadeEmissao ||
          a.nomeDocumento.localeCompare(b.nomeDocumento),
      );
    }
  }
  return visaRequirements
    .filter((r) => r.visaCategoryId === visaCategoryId)
    .sort(
      (a, b) =>
        a.ordemPrioridadeEmissao - b.ordemPrioridadeEmissao ||
        a.nomeDocumento.localeCompare(b.nomeDocumento),
    );
}

export function buildVisaChecklistEntries(params: {
  visaCategoryId: string;
  pessoa: string;
  visaRequirements: VisaRequirement[];
  caseDocuments: CaseDocument[];
  includeExtraCaseDocs?: boolean;
}): ChecklistRowEntry[] {
  const {
    visaCategoryId,
    pessoa,
    visaRequirements,
    caseDocuments,
    includeExtraCaseDocs = true,
  } = params;

  const normalizedPerson = pessoa.trim() || 'Titular';
  const reqs = getApplicableRequirementsForPerson(visaCategoryId, normalizedPerson, visaRequirements);
  const personDocs = caseDocuments.filter(
    (d) => (d.pessoa || 'Titular').trim() === normalizedPerson,
  );

  const matchedDocIds = new Set<string>();

  const entries: ChecklistRowEntry[] = reqs.map((req) => {
    const normReqName = normalizeChecklistDocName(req.nomeDocumento);
    const matchedDoc =
      personDocs.find((d) => d.visaRequirementId === req.id) ||
      personDocs.find((d) => normalizeChecklistDocName(d.nomeDocumento) === normReqName);

    if (matchedDoc) {
      matchedDocIds.add(matchedDoc.id);
    }

    const status: CaseDocument['status'] = matchedDoc?.status || 'Pendente';
    return {
      key: `req_${req.id}`,
      requirement: req,
      document: matchedDoc,
      nomeDocumento: matchedDoc?.nomeDocumento || req.nomeDocumento,
      categoriaDoc: matchedDoc?.categoriaDoc || req.categoriaDoc,
      ordem: matchedDoc?.ordemEmissao ?? req.ordemPrioridadeEmissao,
      obrigatorio: matchedDoc?.obrigatorio ?? req.obrigatorio,
      peso: matchedDoc?.peso ?? req.peso,
      validadeDias: matchedDoc?.validadeDias ?? req.validadeDias,
      exigeApostila: matchedDoc?.exigeApostila ?? req.exigeApostila,
      exigeTraducao: matchedDoc?.exigeTraducao ?? req.exigeTraducao,
      apostilado: matchedDoc?.apostilado ?? false,
      traduzido: matchedDoc?.traduzido ?? false,
      orgaoEmissor: matchedDoc?.orgaoEmissor || req.orgaoEmissor || '',
      comoObterInstrucoes: req.comoObterInstrucoes,
      comoObterUrl: req.comoObterUrl,
      dataEmissao: matchedDoc?.dataEmissao,
      dataValidadeCalculada: matchedDoc?.dataValidadeCalculada,
      status,
      completed: status === 'Aprovado',
    };
  });

  if (includeExtraCaseDocs) {
    for (const doc of personDocs) {
      if (matchedDocIds.has(doc.id)) continue;
      entries.push({
        key: `doc_${doc.id}`,
        document: doc,
        nomeDocumento: doc.nomeDocumento,
        categoriaDoc: doc.categoriaDoc,
        ordem: doc.ordemEmissao || entries.length + 1,
        obrigatorio: doc.obrigatorio,
        peso: doc.peso || 3,
        validadeDias: doc.validadeDias || 0,
        exigeApostila: doc.exigeApostila,
        exigeTraducao: doc.exigeTraducao,
        apostilado: doc.apostilado,
        traduzido: doc.traduzido,
        orgaoEmissor: doc.orgaoEmissor || '',
        dataEmissao: doc.dataEmissao,
        dataValidadeCalculada: doc.dataValidadeCalculada,
        status: doc.status,
        completed: doc.status === 'Aprovado',
      });
    }
  }

  return entries.sort(
    (a, b) => a.ordem - b.ordem || a.nomeDocumento.localeCompare(b.nomeDocumento),
  );
}

export function summarizeChecklist(entries: ChecklistRowEntry[]): ChecklistSummary {
  const total = entries.length;
  const completed = entries.filter((e) => e.completed).length;
  const pending = total - completed;
  const obrigatorios = entries.filter((e) => e.obrigatorio);
  const totalObrigatorios = obrigatorios.length;
  const completedObrigatorios = obrigatorios.filter((e) => e.completed).length;

  const percentTotal = total > 0 ? Math.round((completed / total) * 100) : 0;
  const percentObrigatorios =
    totalObrigatorios > 0
      ? Math.round((completedObrigatorios / totalObrigatorios) * 100)
      : percentTotal;

  return {
    total,
    completed,
    pending,
    totalObrigatorios,
    completedObrigatorios,
    percentTotal,
    percentObrigatorios,
  };
}

export function buildCaseDocumentFromChecklistToggle(params: {
  entry: ChecklistRowEntry;
  activeCase: Case;
  pessoa: string;
  analisadoPor: string;
  nextStatus?: CaseDocument['status'];
  nextApostilado?: boolean;
  nextTraduzido?: boolean;
  nextDataEmissao?: string;
  nextDataValidadeCalculada?: string;
  nowIso?: string;
  newId: string;
}): { docId: string; isNew: boolean; payload: CaseDocument } {
  const {
    entry,
    activeCase,
    pessoa,
    analisadoPor,
    nextStatus,
    nextApostilado,
    nextTraduzido,
    nextDataEmissao,
    nextDataValidadeCalculada,
    nowIso = new Date().toISOString(),
    newId,
  } = params;

  const existing = entry.document;
  const resolvedStatus: CaseDocument['status'] =
    nextStatus ?? (entry.completed ? 'Pendente' : 'Aprovado');

  const resolvedStep: CaseDocument['etapaEsteira'] =
    resolvedStatus === 'Aprovado'
      ? '6 Aprovado para Protocolo'
      : resolvedStatus === 'Em análise'
        ? '3 Em Conferência'
        : resolvedStatus === 'Enviado'
          ? '2 Recebido/Triagem'
          : resolvedStatus === 'Reprovado' || resolvedStatus === 'Vencido'
            ? '4 Pendência/Reprovado'
            : '1 Aguardando Envio';

  if (existing) {
    const payload: CaseDocument = {
      ...existing,
      status: resolvedStatus,
      etapaEsteira: resolvedStep,
      apostilado: nextApostilado ?? existing.apostilado,
      traduzido: nextTraduzido ?? existing.traduzido,
      dataEmissao: nextDataEmissao !== undefined ? nextDataEmissao : existing.dataEmissao,
      dataValidadeCalculada:
        nextDataValidadeCalculada !== undefined
          ? nextDataValidadeCalculada
          : existing.dataValidadeCalculada,
      analisadoPor,
      analisadoEm: nowIso,
      updatedAt: nowIso,
    };
    return { docId: existing.id, isNew: false, payload };
  }

  const req = entry.requirement;
  const payload: CaseDocument = {
    id: newId,
    caseId: activeCase.id,
    clientId: activeCase.clientId,
    pessoa: pessoa.trim() || 'Titular',
    visaRequirementId: req?.id,
    nomeDocumento: entry.nomeDocumento,
    categoriaDoc: entry.categoriaDoc,
    etapaEsteira: resolvedStep,
    ordemEmissao: entry.ordem,
    status: resolvedStatus,
    dataEmissao: nextDataEmissao,
    validadeDias: entry.validadeDias,
    dataValidadeCalculada: nextDataValidadeCalculada,
    orgaoEmissor: entry.orgaoEmissor || '',
    apostilado: nextApostilado ?? false,
    traduzido: nextTraduzido ?? false,
    exigeApostila: entry.exigeApostila,
    exigeTraducao: entry.exigeTraducao,
    obrigatorio: entry.obrigatorio,
    peso: entry.peso,
    versao: 1,
    analisadoPor,
    analisadoEm: nowIso,
    updatedAt: nowIso,
  };

  return { docId: newId, isNew: true, payload };
}
