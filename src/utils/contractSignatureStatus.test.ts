import test from 'node:test';
import assert from 'node:assert/strict';
import type { Case, Client, GeneratedDocument } from '../types/domain';
import {
  buildContractReminderWhatsAppMessage,
  buildContractSignatureRows,
  computeContractSignatureMetrics,
  filterContractSignatureRows,
  resolveLastSignatureInteraction,
} from './contractSignatureStatus';

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'cli_1',
  nomeCompleto: 'Maria Clara Silva',
  cpf: '123.456.789-00',
  email: 'maria@example.com',
  whatsapp: '+55 11 99999-1111',
  portalLiberado: true,
  statusAcessoPortal: 'Liberado',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

const makeCase = (overrides: Partial<Case> = {}): Case => ({
  id: 'case_1',
  clientId: 'cli_1',
  titulo: 'Residência Temporária — Rentista',
  tipoServico: 'Residência Temporal',
  etapaPipeline: 5,
  statusSermig: 'Não protocolado',
  portalLiberado: true,
  relatorioViabilidadeLiberado: false,
  prioridade: 'Média',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
  ...overrides,
});

const makeDoc = (overrides: Partial<GeneratedDocument> = {}): GeneratedDocument => ({
  id: 'doc_1',
  clientId: 'cli_1',
  caseId: 'case_1',
  tipo: 'Contrato',
  titulo: 'Contrato de Assessoria Migratória',
  conteudoHtml: '<p>Cláusula 1</p>',
  versao: 1,
  codigoVerificacao: 'DM-2026-001',
  financeiro: true,
  liberadoAoCliente: true,
  autorNome: 'Consultor D&M',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
  ...overrides,
});

test('resolveLastSignatureInteraction prioritizes canceled, signed, read-confirmed, updated, and created timestamps', () => {
  const canceled = resolveLastSignatureInteraction(
    makeDoc({
      canceladoEm: '2026-11-25T15:00:00.000Z',
      assinadoEm: '2026-11-24T12:00:00.000Z',
    }),
  );
  assert.equal(canceled.at, '2026-11-25T15:00:00.000Z');
  assert.match(canceled.label, /Cancelado/i);

  const signed = resolveLastSignatureInteraction(
    makeDoc({
      status: 'Assinado',
      assinadoEm: '2026-11-26T14:30:00.000Z',
      assinaturaMetodo: 'desenhada',
      assinaturaDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    }),
  );
  assert.equal(signed.at, '2026-11-26T14:30:00.000Z');
  assert.match(signed.label, /Assinado · Assinatura manuscrita digital/i);

  const readConfirmed = resolveLastSignatureInteraction(
    makeDoc({
      confirmadoLeituraEm: '2026-11-26T09:15:00.000Z',
      confirmadoLeituraPor: 'Maria Clara Silva',
    }),
  );
  assert.equal(readConfirmed.at, '2026-11-26T09:15:00.000Z');
  assert.equal(readConfirmed.label, 'Leitura confirmada por Maria Clara Silva');

  const updated = resolveLastSignatureInteraction(
    makeDoc({
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-22T11:00:00.000Z',
      liberadoAoCliente: true,
    }),
  );
  assert.equal(updated.at, '2026-11-22T11:00:00.000Z');
  assert.equal(updated.label, 'Atualizado e disponível no Portal');

  const draft = resolveLastSignatureInteraction(
    makeDoc({
      liberadoAoCliente: false,
    }),
  );
  assert.equal(draft.at, '2026-11-20T10:00:00.000Z');
  assert.match(draft.label, /Gerado internamente/i);
});

test('buildContractSignatureRows classifies stages, detects portalBlocked, and sorts by urgency priority', () => {
  const nowMs = Date.parse('2026-11-27T12:00:00.000Z');
  const clients = [
    makeClient({ id: 'cli_open', nomeCompleto: 'Ana Souza', portalLiberado: true }),
    makeClient({ id: 'cli_locked', nomeCompleto: 'Bruno Lima', portalLiberado: false }),
  ];
  const cases = [
    makeCase({ id: 'case_open', clientId: 'cli_open', titulo: 'Visto Profissional' }),
    makeCase({ id: 'case_locked', clientId: 'cli_locked', titulo: 'Visto Nômade' }),
  ];

  const docs: GeneratedDocument[] = [
    makeDoc({
      id: 'doc_canceled',
      clientId: 'cli_open',
      canceladoEm: '2026-11-26T10:00:00.000Z',
      titulo: 'Contrato Cancelado',
    }),
    makeDoc({
      id: 'doc_signed',
      clientId: 'cli_open',
      caseId: 'case_open',
      status: 'Assinado',
      assinadoEm: '2026-11-26T18:00:00.000Z',
      assinaturaDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      assinaturaMetodo: 'desenhada',
      titulo: 'Contrato Assinado',
    }),
    makeDoc({
      id: 'doc_draft',
      clientId: 'cli_open',
      liberadoAoCliente: false,
      titulo: 'Contrato Rascunho',
    }),
    makeDoc({
      id: 'doc_pending_locked',
      clientId: 'cli_locked',
      caseId: 'case_locked',
      liberadoAoCliente: true,
      createdAt: '2026-11-22T12:00:00.000Z',
      updatedAt: '2026-11-22T12:00:00.000Z',
      titulo: 'Contrato Aguardando',
    }),
    makeDoc({
      id: 'doc_read_confirmed',
      clientId: 'cli_open',
      caseId: 'case_open',
      liberadoAoCliente: true,
      confirmadoLeituraEm: '2026-11-27T08:00:00.000Z',
      confirmadoLeituraPor: 'Ana Souza',
      titulo: 'Contrato Leitura Confirmada',
    }),
  ];

  const rows = buildContractSignatureRows(docs, clients, cases, nowMs);

  assert.deepEqual(
    rows.map((r) => r.doc.id),
    ['doc_read_confirmed', 'doc_pending_locked', 'doc_draft', 'doc_signed', 'doc_canceled'],
  );

  const lockedRow = rows.find((r) => r.doc.id === 'doc_pending_locked')!;
  assert.equal(lockedRow.portalBlocked, true);
  assert.equal(lockedRow.daysPending, 5);
  assert.equal(lockedRow.stage, 'pendente_aguardando');

  const signedRow = rows.find((r) => r.doc.id === 'doc_signed')!;
  assert.equal(signedRow.isSigned, true);
  assert.equal(signedRow.isPending, false);
  assert.equal(signedRow.daysPending, null);

  const metrics = computeContractSignatureMetrics(rows);
  assert.equal(metrics.total, 5);
  assert.equal(metrics.totalActive, 4);
  assert.equal(metrics.pendentes, 3);
  assert.equal(metrics.pendentesLiberados, 2);
  assert.equal(metrics.pendentesLeituraConfirmada, 1);
  assert.equal(metrics.pendentesInternos, 1);
  assert.equal(metrics.assinados, 1);
  assert.equal(metrics.cancelados, 1);
  assert.equal(metrics.taxaAssinaturaPct, 25);
});

test('filterContractSignatureRows filters by tab and search across client, document, case, and code', () => {
  const clients = [
    makeClient({ id: 'cli_1', nomeCompleto: 'Carla Mendes', email: 'carla@example.com' }),
    makeClient({ id: 'cli_2', nomeCompleto: 'Diego Ferreira', email: 'diego@example.com' }),
  ];
  const cases = [
    makeCase({ id: 'case_1', clientId: 'cli_1', titulo: 'Visto Vínculo Familiar' }),
    makeCase({ id: 'case_2', clientId: 'cli_2', titulo: 'Visto Investidor' }),
  ];
  const docs = [
    makeDoc({
      id: 'd1',
      clientId: 'cli_1',
      caseId: 'case_1',
      titulo: 'Contrato Assessoria Completa',
      codigoVerificacao: 'DM-AA11',
    }),
    makeDoc({
      id: 'd2',
      clientId: 'cli_2',
      caseId: 'case_2',
      titulo: 'Procuração Migratória',
      codigoVerificacao: 'DM-BB22',
      status: 'Assinado',
      assinadoEm: '2026-11-26T10:00:00.000Z',
    }),
  ];

  const rows = buildContractSignatureRows(docs, clients, cases);
  assert.equal(filterContractSignatureRows(rows, { statusFilter: 'pendentes' }).length, 1);
  assert.equal(filterContractSignatureRows(rows, { statusFilter: 'assinados' }).length, 1);
  assert.equal(filterContractSignatureRows(rows, { statusFilter: 'todos' }).length, 2);
  assert.equal(filterContractSignatureRows(rows, { statusFilter: 'todos', search: 'DM-BB22' })[0]?.doc.id, 'd2');
  assert.equal(filterContractSignatureRows(rows, { statusFilter: 'todos', search: 'vínculo' })[0]?.doc.id, 'd1');
});

test('buildContractReminderWhatsAppMessage formats friendly personalized reminder', () => {
  const [row] = buildContractSignatureRows([makeDoc()], [makeClient()], [makeCase()]);
  const msg = buildContractReminderWhatsAppMessage(row, 'D&M Integra Chile');
  assert.match(msg, /Olá, Maria!/);
  assert.match(msg, /D&M Integra Chile/);
  assert.match(msg, /Contrato de Assessoria Migratória/);
  assert.match(msg, /DM-2026-001/);
});
