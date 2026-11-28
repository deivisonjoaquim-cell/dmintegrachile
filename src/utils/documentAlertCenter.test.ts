import assert from 'node:assert/strict';
import test from 'node:test';
import type { Case, CaseDocument, Client, Deadline } from '../types/domain';
import {
  buildDocumentAlertCenterSnapshot,
  classifyAlertTrafficLevel,
  filterAlertCenterCards,
} from './documentAlertCenter';

const CLIENT: Client = {
  id: 'cli_alert_1',
  nomeCompleto: 'Fernanda Costa',
  cpf: '98765432100',
  email: 'fernanda@example.com',
  whatsapp: '11988887777',
  passaporte: { numero: 'AB112233', validade: '2026-08-20' },
  portalLiberado: true,
  statusAcessoPortal: 'Liberado',
  createdAt: '2026-01-01T00:00:00Z',
};

const CASE_ITEM: Case = {
  id: 'case_alert_1',
  clientId: 'cli_alert_1',
  titulo: 'Residência Temporal — Mercosul',
  tipoServico: 'Residência Temporal',
  etapaPipeline: 4,
  statusSermig: 'Em trâmite',
  portalLiberado: true,
  relatorioViabilidadeLiberado: true,
  prioridade: 'Alta',
  dataVencimentoResidencia: '2026-06-08',
  createdAt: '2026-01-05T00:00:00Z',
};

const DOCS: CaseDocument[] = [
  {
    id: 'doc_red',
    caseId: 'case_alert_1',
    clientId: 'cli_alert_1',
    nomeDocumento: 'Antecedentes Criminais Polícia Federal',
    categoriaDoc: 'Antecedentes',
    etapaEsteira: '6 Aprovado para Protocolo',
    ordemEmissao: 1,
    pessoa: 'Titular',
    status: 'Aprovado',
    obrigatorio: true,
    validadeDias: 60,
    dataValidadeCalculada: '2026-05-18', // +8 days -> vermelho (<= 15)
    apostilado: true,
    traduzido: true,
    exigeApostila: true,
    exigeTraducao: true,
    peso: 1,
    versao: 1,
  },
  {
    id: 'doc_green',
    caseId: 'case_alert_1',
    clientId: 'cli_alert_1',
    nomeDocumento: 'Certidão de Nascimento Apostilada',
    categoriaDoc: 'Familiares',
    etapaEsteira: '6 Aprovado para Protocolo',
    ordemEmissao: 2,
    pessoa: 'Titular',
    status: 'Aprovado',
    obrigatorio: true,
    validadeDias: 180,
    dataValidadeCalculada: '2026-10-15', // +158 days -> verde (> 45)
    apostilado: true,
    traduzido: true,
    exigeApostila: true,
    exigeTraducao: true,
    peso: 1,
    versao: 1,
  },
];

const DEADLINES: Deadline[] = [
  {
    id: 'dl_expired',
    caseId: 'case_alert_1',
    clientId: 'cli_alert_1',
    tipo: 'Vencimento Cédula',
    titulo: 'Agendamento Emissão do RUT',
    dataLimite: '2026-05-05', // -5 days -> vermelho
    concluido: false,
  },
];

test('classifyAlertTrafficLevel maps proximity into vermelho (<=15d), amarelo (16..45d), and verde (>45d)', () => {
  assert.equal(classifyAlertTrafficLevel(-3), 'vermelho');
  assert.equal(classifyAlertTrafficLevel(0), 'vermelho');
  assert.equal(classifyAlertTrafficLevel(15), 'vermelho');
  assert.equal(classifyAlertTrafficLevel(16), 'amarelo');
  assert.equal(classifyAlertTrafficLevel(45), 'amarelo');
  assert.equal(classifyAlertTrafficLevel(46), 'verde');
});

test('buildDocumentAlertCenterSnapshot consolidates deadlines into sorted vermelho/amarelo/verde cards', () => {
  const refDate = new Date('2026-05-10T12:00:00Z');
  const snap = buildDocumentAlertCenterSnapshot({
    client: CLIENT,
    cases: [CASE_ITEM],
    docs: DOCS,
    deadlines: DEADLINES,
    referenceDate: refDate,
  });

  // Items: dl_expired (-5d, vermelho), doc_red (+8d, vermelho), Visto (+29d, amarelo), Passaporte (+102d, verde), Certidão (+158d, verde)
  assert.equal(snap.overallStatus, 'critico');
  assert.equal(snap.counts.vermelho, 2);
  assert.equal(snap.counts.amarelo, 1);
  assert.equal(snap.counts.verde, 2);
  assert.equal(snap.counts.total, 5);

  // Order must start with vermelho (most urgent first), then amarelo, then verde
  assert.equal(snap.cards[0].level, 'vermelho');
  assert.equal(snap.cards[0].daysRemaining, -5);
  assert.equal(snap.cards[2].level, 'amarelo');
  assert.equal(snap.cards[4].level, 'verde');

  const onlyYellow = filterAlertCenterCards(snap.cards, { level: 'amarelo' });
  assert.equal(onlyYellow.length, 1);
  assert.match(onlyYellow[0].titulo, /Residência|Visto/i);

  const searchRut = filterAlertCenterCards(snap.cards, { level: 'todos', search: 'RUT' });
  assert.equal(searchRut.length, 1);
});
