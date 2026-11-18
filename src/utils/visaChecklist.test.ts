import assert from 'node:assert/strict';
import test from 'node:test';
import type { Case, CaseDocument, VisaRequirement } from '../types/domain';
import {
  buildCaseDocumentFromChecklistToggle,
  buildVisaChecklistEntries,
  summarizeChecklist,
} from './visaChecklist';

const MOCK_REQS: VisaRequirement[] = [
  {
    id: 'req_1',
    visaCategoryId: 'visa_15_mercosul',
    nomeDocumento: 'Passaporte válido',
    categoriaDoc: 'Identidade',
    descricao: 'Passaporte com validade mínima de 12 meses.',
    comoObterInstrucoes: 'Polícia Federal.',
    comoObterUrl: 'https://www.gov.br',
    obrigatorio: true,
    peso: 5,
    ordemPrioridadeEmissao: 1,
    exigeApostila: false,
    exigeTraducao: false,
    validadeDias: 0,
    orgaoEmissor: 'Polícia Federal',
  },
  {
    id: 'req_2',
    visaCategoryId: 'visa_15_mercosul',
    nomeDocumento: 'Certidão de Antecedentes Criminais PF',
    categoriaDoc: 'Antecedentes',
    descricao: 'Antecedentes federais apostilados.',
    comoObterInstrucoes: 'Emitir no portal da PF.',
    comoObterUrl: 'https://www.gov.br/pf',
    obrigatorio: true,
    peso: 5,
    ordemPrioridadeEmissao: 2,
    exigeApostila: true,
    exigeTraducao: false,
    validadeDias: 60,
    orgaoEmissor: 'Polícia Federal',
  },
  {
    id: 'req_3',
    visaCategoryId: 'visa_15_mercosul',
    nomeDocumento: 'Comprovante opcional de residência',
    categoriaDoc: 'Identidade',
    descricao: 'Opcional.',
    comoObterInstrucoes: 'Conta recente.',
    comoObterUrl: '',
    obrigatorio: false,
    peso: 1,
    ordemPrioridadeEmissao: 3,
    exigeApostila: false,
    exigeTraducao: false,
    validadeDias: 90,
    orgaoEmissor: 'Concessionária',
  },
  {
    id: 'req_dep_1',
    visaCategoryId: 'fluxo_dependente',
    nomeDocumento: 'Certidão de Nascimento / Casamento',
    categoriaDoc: 'Familiares',
    descricao: 'Comprova vínculo familiar.',
    comoObterInstrucoes: 'Cartório.',
    comoObterUrl: '',
    obrigatorio: true,
    peso: 5,
    ordemPrioridadeEmissao: 1,
    exigeApostila: true,
    exigeTraducao: false,
    validadeDias: 180,
    orgaoEmissor: 'Cartório',
  },
];

const MOCK_CASE: Case = {
  id: 'case_1',
  titulo: 'Mercosul — Maria Silva',
  clientId: 'client_1',
  tipoServico: 'Residência Temporal',
  visaCategoryId: 'visa_15_mercosul',
  etapaPipeline: 3,
  statusSermig: 'Não protocolado',
  portalLiberado: true,
  relatorioViabilidadeLiberado: false,
  prioridade: 'Alta',
  createdAt: '2026-01-01T10:00:00.000Z',
};

test('buildVisaChecklistEntries matches existing CaseDocument by visaRequirementId or normalized name', () => {
  const existingDocs: CaseDocument[] = [
    {
      id: 'doc_existing_1',
      caseId: 'case_1',
      clientId: 'client_1',
      pessoa: 'Titular',
      visaRequirementId: 'req_1',
      nomeDocumento: 'Passaporte válido',
      categoriaDoc: 'Identidade',
      etapaEsteira: '6 Aprovado para Protocolo',
      ordemEmissao: 1,
      status: 'Aprovado',
      validadeDias: 0,
      apostilado: false,
      traduzido: false,
      exigeApostila: false,
      exigeTraducao: false,
      obrigatorio: true,
      peso: 5,
      versao: 1,
    },
    {
      id: 'doc_existing_2',
      caseId: 'case_1',
      clientId: 'client_1',
      pessoa: 'Titular',
      nomeDocumento: 'certidao de antecedentes criminais pf',
      categoriaDoc: 'Antecedentes',
      etapaEsteira: '2 Recebido/Triagem',
      ordemEmissao: 2,
      status: 'Enviado',
      validadeDias: 60,
      apostilado: true,
      traduzido: false,
      exigeApostila: true,
      exigeTraducao: false,
      obrigatorio: true,
      peso: 5,
      versao: 1,
    },
  ];

  const entries = buildVisaChecklistEntries({
    visaCategoryId: 'visa_15_mercosul',
    pessoa: 'Titular',
    visaRequirements: MOCK_REQS,
    caseDocuments: existingDocs,
  });

  assert.equal(entries.length, 3);
  assert.equal(entries[0].completed, true);
  assert.equal(entries[0].document?.id, 'doc_existing_1');
  assert.equal(entries[1].completed, false);
  assert.equal(entries[1].status, 'Enviado');
  assert.equal(entries[1].apostilado, true);
  assert.equal(entries[2].completed, false);
  assert.equal(entries[2].document, undefined);

  const summary = summarizeChecklist(entries);
  assert.deepEqual(summary, {
    total: 3,
    completed: 1,
    pending: 2,
    totalObrigatorios: 2,
    completedObrigatorios: 1,
    percentTotal: 33,
    percentObrigatorios: 50,
  });
});

test('buildVisaChecklistEntries switches to dependent requirements for non-Titular people', () => {
  const entries = buildVisaChecklistEntries({
    visaCategoryId: 'visa_15_mercosul',
    pessoa: 'João Silva',
    visaRequirements: MOCK_REQS,
    caseDocuments: [],
  });

  assert.equal(entries.length, 1);
  assert.equal(entries[0].requirement?.id, 'req_dep_1');
});

test('buildCaseDocumentFromChecklistToggle creates valid new CaseDocument and toggles existing ones', () => {
  const entries = buildVisaChecklistEntries({
    visaCategoryId: 'visa_15_mercosul',
    pessoa: 'Titular',
    visaRequirements: MOCK_REQS,
    caseDocuments: [],
  });

  // Create on toggle from virtual requirement
  const created = buildCaseDocumentFromChecklistToggle({
    entry: entries[1],
    activeCase: MOCK_CASE,
    pessoa: 'Titular',
    analisadoPor: 'consultor@dmintegra.cl',
    newId: 'doc_new_123',
    nowIso: '2026-02-01T12:00:00.000Z',
  });

  assert.equal(created.isNew, true);
  assert.equal(created.docId, 'doc_new_123');
  assert.equal(created.payload.status, 'Aprovado');
  assert.equal(created.payload.etapaEsteira, '6 Aprovado para Protocolo');
  assert.equal(created.payload.visaRequirementId, 'req_2');
  assert.equal(created.payload.versao, 1);

  // Toggle back to Pendente on existing doc
  const updated = buildCaseDocumentFromChecklistToggle({
    entry: {
      ...entries[1],
      document: created.payload,
      status: 'Aprovado',
      completed: true,
    },
    activeCase: MOCK_CASE,
    pessoa: 'Titular',
    analisadoPor: 'consultor@dmintegra.cl',
    newId: 'unused',
    nowIso: '2026-02-01T13:00:00.000Z',
  });

  assert.equal(updated.isNew, false);
  assert.equal(updated.docId, 'doc_new_123');
  assert.equal(updated.payload.status, 'Pendente');
  assert.equal(updated.payload.etapaEsteira, '1 Aguardando Envio');
});
