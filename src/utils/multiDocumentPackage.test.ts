import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_EMPRESA_CONFIG, SEED_DOCUMENT_TEMPLATES } from '../data/seeds';
import type { Case, Client, GeneratedDocument } from '../types/domain';
import {
  buildMultiDocumentBatchRecords,
  buildMultiDocumentWhatsAppNotice,
  findUnresolvedPlaceholders,
  getSignatureDocTypeMeta,
  matchesDocumentTypeGroup,
  renderTemplateForClient,
  SIGNATURE_PACKAGE_PRESETS,
  summarizeClientSignatureQueue,
} from './multiDocumentPackage';

const MOCK_CLIENT: Client = {
  id: 'cli_multi_1',
  nomeCompleto: 'Carlos Eduardo Mendes',
  cpf: '123.456.789-00',
  email: 'carlos@example.com',
  whatsapp: '5511999998888',
  nacionalidade: 'Brasileira',
  estadoCivil: 'Casado',
  profissao: 'Engenheiro',
  enderecoCompleto: 'Rua das Flores, 100 - São Paulo/SP',
  passaporte: { numero: 'FZ998877', validade: '2029-10-01' },
  portalLiberado: true,
  statusAcessoPortal: 'Liberado',
  modalidadeConsultoria: 'completa',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const MOCK_CASE: Case = {
  id: 'case_multi_1',
  clientId: 'cli_multi_1',
  titulo: 'Residência Temporal — Acordo Mercosul',
  tipoServico: 'Residência Temporal',
  etapaPipeline: 2,
  statusSermig: 'Não protocolado',
  portalLiberado: true,
  relatorioViabilidadeLiberado: true,
  prioridade: 'Alta',
  createdAt: '2026-01-02T00:00:00.000Z',
};

test('renderTemplateForClient fills Contrato, Recibo, and Procuração cleanly without unresolved placeholders', () => {
  const contratoTpl = SEED_DOCUMENT_TEMPLATES.find((t) => t.id === 'doc_contrato')!;
  const reciboTpl = SEED_DOCUMENT_TEMPLATES.find((t) => t.id === 'doc_recibo')!;
  const procTpl = SEED_DOCUMENT_TEMPLATES.find((t) => t.id === 'doc_procuracao_simples')!;

  const items = [contratoTpl, reciboTpl, procTpl].map((tpl, idx) => {
    const rendered = renderTemplateForClient({
      template: tpl,
      empresa: DEFAULT_EMPRESA_CONFIG,
      client: MOCK_CLIENT,
      caseItem: MOCK_CASE,
      valorNumerico: 3800,
      moeda: 'BRL',
      formaPagamento: '50% na assinatura + 50% no protocolo',
      reciboNumero: 'REC-2026-001',
    });
    return {
      key: `item_${idx}`,
      templateId: tpl.id,
      tipo: tpl.tipo,
      ...rendered,
    };
  });

  assert.equal(items.length, 3);
  assert.match(items[0].conteudoHtml, /Carlos Eduardo Mendes/);
  assert.match(items[1].titulo, /REC-2026-001/);
  assert.match(items[1].conteudoHtml, /3\.800,00/);
  assert.match(items[2].conteudoHtml, /FZ998877/);
  assert.equal(findUnresolvedPlaceholders(items).length, 0);

  let seq = 1;
  const records = buildMultiDocumentBatchRecords({
    items,
    clientId: MOCK_CLIENT.id,
    caseId: MOCK_CASE.id,
    autorNome: 'Consultor Teste',
    liberadoAoCliente: true,
    idFactory: (p) => `${p}_${seq++}`,
    nowIso: '2026-05-10T10:00:00.000Z',
  });

  assert.equal(records.length, 3);
  assert.equal(records[0].tipo, 'contrato');
  assert.equal(records[1].tipo, 'recibo');
  assert.equal(records[2].tipo, 'procuracao');
  assert.equal(records.every((r) => r.liberadoAoCliente && r.status === 'Enviado'), true);
  assert.ok(records[1].codigoVerificacao?.startsWith('REC-'));
});

test('summarizeClientSignatureQueue tracks multi-document progress and nextPendingDoc', () => {
  const docs: GeneratedDocument[] = [
    {
      id: 'd1',
      tipo: 'contrato',
      titulo: 'Contrato de Consultoria',
      clientId: 'c1',
      conteudoHtml: 'Contrato',
      versao: 1,
      status: 'Assinado',
      assinadoEm: '2026-05-09T12:00:00Z',
      liberadoAoCliente: true,
      financeiro: true,
      autorNome: 'Admin',
      createdAt: '2026-05-08T12:00:00Z',
    },
    {
      id: 'd2',
      tipo: 'recibo',
      titulo: 'Recibo Oficial REC-2026-001',
      clientId: 'c1',
      conteudoHtml: 'Recibo',
      versao: 1,
      status: 'Enviado',
      confirmadoLeituraEm: '2026-05-09T13:00:00Z',
      liberadoAoCliente: true,
      financeiro: true,
      autorNome: 'Admin',
      createdAt: '2026-05-08T12:00:00Z',
    },
    {
      id: 'd3',
      tipo: 'termo_ciencia',
      titulo: 'Termo de Ciência SERMIG',
      clientId: 'c1',
      conteudoHtml: 'Termo',
      versao: 1,
      status: 'Enviado',
      liberadoAoCliente: true,
      financeiro: false,
      autorNome: 'Admin',
      createdAt: '2026-05-08T12:00:00Z',
    },
  ];

  const queue = summarizeClientSignatureQueue(docs);
  assert.equal(queue.totalActive, 3);
  assert.equal(queue.signedCount, 1);
  assert.equal(queue.pendingCount, 2);
  assert.equal(queue.readConfirmedPendingCount, 1);
  assert.equal(queue.progressPct, 33);
  assert.equal(queue.nextPendingDoc?.id, 'd2');
  assert.equal(queue.typeBreakdown.length, 3);
});

test('document type metadata, group filters, presets, and WhatsApp notice work cleanly', () => {
  assert.equal(getSignatureDocTypeMeta('recibo').shortLabel, 'Recibo');
  assert.equal(matchesDocumentTypeGroup('recibo', 'recibo'), true);
  assert.equal(matchesDocumentTypeGroup('procuracao', 'termos_procuracao'), true);
  assert.equal(matchesDocumentTypeGroup('orcamento', 'orcamento_aditivo'), true);
  assert.ok(SIGNATURE_PACKAGE_PRESETS.length >= 4);

  const msg = buildMultiDocumentWhatsAppNotice({
    clientName: 'Carlos Eduardo',
    empresaName: 'D&M Integra Chile',
    documents: [
      { titulo: 'Contrato de Consultoria', tipo: 'contrato', codigoVerificacao: 'DOC-111' },
      { titulo: 'Recibo Oficial REC-001', tipo: 'recibo', codigoVerificacao: 'REC-222' },
    ],
  });
  assert.match(msg, /2 documentos/);
  assert.match(msg, /Recibo Oficial REC-001/);
  assert.match(msg, /Visto e RUT/);
});
