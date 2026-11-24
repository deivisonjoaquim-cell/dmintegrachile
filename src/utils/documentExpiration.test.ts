import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectExpirationReminders,
  computeCalculatedExpirationIso,
  resolveDocumentExpiration,
} from './documentExpiration';
import type { Case, CaseDocument, Client, VisaRequirement } from '../types/domain';

const baseCase: Case = {
  id: 'case_1',
  titulo: 'Mercosul - João Silva',
  clientId: 'cli_1',
  tipoServico: 'Residência Temporal',
  visaCategoryId: 'visa_15_mercosul',
  etapaPipeline: 5,
  statusSermig: 'Não protocolado',
  portalLiberado: true,
  relatorioViabilidadeLiberado: true,
  prioridade: 'Alta',
  createdAt: '2026-10-01T12:00:00Z',
};

const baseClient: Client = {
  id: 'cli_1',
  nomeCompleto: 'João Silva',
  cpf: '123.456.789-00',
  email: 'joao@example.com',
  whatsapp: '+55 (11) 99999-0000',
  passaporte: { numero: 'BR12345', validade: '2026-12-05' },
  portalLiberado: true,
  statusAcessoPortal: 'Liberado',
  createdAt: '2026-10-01T12:00:00Z',
};

const makeDoc = (partial: Partial<CaseDocument>): CaseDocument => ({
  id: partial.id || 'doc_1',
  caseId: 'case_1',
  clientId: 'cli_1',
  pessoa: 'Titular',
  nomeDocumento: 'Antecedentes Criminais PF',
  categoriaDoc: 'Antecedentes',
  etapaEsteira: '6 Aprovado para Protocolo',
  ordemEmissao: 1,
  status: 'Aprovado',
  validadeDias: 60,
  apostilado: true,
  traduzido: false,
  exigeApostila: true,
  exigeTraducao: false,
  obrigatorio: true,
  peso: 5,
  versao: 1,
  ...partial,
});

test('computeCalculatedExpirationIso adds validadeDias accurately', () => {
  assert.equal(computeCalculatedExpirationIso('2026-10-01', 60), '2026-11-30');
  assert.equal(computeCalculatedExpirationIso('2026-10-01', 0), undefined);
  assert.equal(computeCalculatedExpirationIso('', 60), undefined);
});

test('resolveDocumentExpiration flags items expiring in <= 30 days and ignores > 30 days', () => {
  const hoje = new Date('2026-11-18T12:00:00-03:00');

  // 20 days remaining -> atencao (<= 30d)
  const doc20d = makeDoc({ id: 'doc_20d', dataValidadeCalculada: '2026-12-08' });
  const res20d = resolveDocumentExpiration({ doc: doc20d, hoje });
  assert.equal(res20d.daysRemaining, 20);
  assert.equal(res20d.severity, 'atencao');
  assert.equal(res20d.isExpiringUnder30Days, true);

  // 5 days remaining -> critico (<= 7d)
  const doc5d = makeDoc({ id: 'doc_5d', dataValidadeCalculada: '2026-11-23' });
  const res5d = resolveDocumentExpiration({ doc: doc5d, hoje });
  assert.equal(res5d.daysRemaining, 5);
  assert.equal(res5d.severity, 'critico');
  assert.equal(res5d.isExpiringUnder30Days, true);

  // 30 days remaining -> inclusive boundary (atencao)
  const doc30d = makeDoc({ id: 'doc_30d', dataValidadeCalculada: '2026-12-18' });
  const res30d = resolveDocumentExpiration({ doc: doc30d, hoje });
  assert.equal(res30d.daysRemaining, 30);
  assert.equal(res30d.severity, 'atencao');
  assert.equal(res30d.isExpiringUnder30Days, true);

  // 31 days remaining -> outside 30-day window (valido)
  const doc31d = makeDoc({ id: 'doc_31d', dataValidadeCalculada: '2026-12-19' });
  const res31d = resolveDocumentExpiration({ doc: doc31d, hoje });
  assert.equal(res31d.daysRemaining, 31);
  assert.equal(res31d.severity, 'valido');
  assert.equal(res31d.isExpiringUnder30Days, false);

  // Computed directly from dataEmissao + requirement.validadeDias when dataValidadeCalculada is absent
  const reqs: VisaRequirement[] = [
    {
      id: 'req_pf',
      visaCategoryId: 'visa_15_mercosul',
      nomeDocumento: 'Antecedentes PF',
      categoriaDoc: 'Antecedentes',
      obrigatorio: true,
      peso: 5,
      validadeDias: 60,
      exigeApostila: true,
      exigeTraducao: false,
      ordemPrioridadeEmissao: 1,
      orgaoEmissor: 'Polícia Federal',
      descricao: 'Certidão de antecedentes criminais emitida pela Polícia Federal.',
      comoObterInstrucoes: 'Emitir no portal da Polícia Federal.',
      comoObterUrl: 'https://www.gov.br/pf',
    },
  ];
  const docFromEmission = makeDoc({
    id: 'doc_emissao',
    visaRequirementId: 'req_pf',
    validadeDias: 0,
    dataEmissao: '2026-09-25', // +60d = 2026-11-24 -> 6d remaining
    dataValidadeCalculada: undefined,
  });
  const resEmissao = resolveDocumentExpiration({
    doc: docFromEmission,
    visaRequirements: reqs,
    hoje,
  });
  assert.equal(resEmissao.dataValidadeEfetiva, '2026-11-24');
  assert.equal(resEmissao.daysRemaining, 6);
  assert.equal(resEmissao.severity, 'critico');
  assert.equal(resEmissao.isExpiringUnder30Days, true);
});

test('collectExpirationReminders aggregates expiring, passport fallback, missing dates, and skips archived cases', () => {
  const hoje = new Date('2026-11-18T12:00:00-03:00');
  const docs: CaseDocument[] = [
    makeDoc({ id: 'd1', dataValidadeCalculada: '2026-11-15' }), // -3d -> vencido
    makeDoc({ id: 'd2', nomeDocumento: 'Passaporte Válido', validadeDias: 0, dataValidadeCalculada: undefined }), // client.passaporte.validade 2026-12-05 -> 17d -> atencao
    makeDoc({ id: 'd3', nomeDocumento: 'Certidão Nascimento', validadeDias: 60, dataEmissao: undefined, dataValidadeCalculada: undefined }), // sem_data
    makeDoc({ id: 'd4', dataValidadeCalculada: '2027-01-10' }), // >= 30d -> valido
    makeDoc({ id: 'd_arch', caseId: 'case_archived', dataValidadeCalculada: '2026-11-20' }),
  ];
  const archivedCase: Case = { ...baseCase, id: 'case_archived', arquivado: true };

  const result = collectExpirationReminders({
    docs,
    cases: [baseCase, archivedCase],
    clients: [baseClient],
    hoje,
  });

  assert.equal(result.counts.totalAlertas, 2);
  assert.equal(result.counts.vencidos, 1);
  assert.equal(result.counts.atencao30d, 1);
  assert.equal(result.counts.semData, 1);
  assert.equal(result.expiringItems[0].doc.id, 'd1');
  assert.equal(result.expiringItems[1].doc.id, 'd2');
  assert.equal(result.expiringItems[1].sourceKind, 'passaporte_cadastro');
  assert.equal(result.upcomingItems.length, 1);
  assert.equal(result.upcomingItems[0].doc.id, 'd4');
});
