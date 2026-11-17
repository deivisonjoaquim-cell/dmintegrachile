import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_VISA_REQUIREMENTS } from '../data/seeds';
import type { CaseDocument, FinancialRecord } from '../types/domain';
import { calcularTermometroDocumentos, calcularUrgencias, gerarCronogramaEmissao } from './caseMetrics';
import { formatDateBR, isValidWhatsApp, maskCPF, maskPhoneBR } from './formatters';

test('weighted thermometer uses lowest score across titular and dependents', () => {
  const docs: CaseDocument[] = [
    {
      id: 'd1',
      caseId: 'c1',
      clientId: 'cl1',
      pessoa: 'Titular',
      nomeDocumento: 'Passaporte',
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
      id: 'd2',
      caseId: 'c1',
      clientId: 'cl1',
      pessoa: 'Dependente 1',
      nomeDocumento: 'Certidão',
      categoriaDoc: 'Familiares',
      etapaEsteira: '2 Recebido/Triagem',
      ordemEmissao: 2,
      status: 'Enviado',
      validadeDias: 60,
      apostilado: false,
      traduzido: false,
      exigeApostila: true,
      exigeTraducao: true,
      obrigatorio: true,
      peso: 5,
      versao: 1,
    },
  ];
  const res = calcularTermometroDocumentos(docs, 100);
  assert.equal(res.notaGeral, 40);
  assert.equal(res.bloqueadoProtocolo, true);
  assert.equal(res.corHex, '#D4AF37');
});

test('emission schedule orders no-expiry first and short-validity (60d) last', () => {
  const mercosulReqs = SEED_VISA_REQUIREMENTS.filter((r) => r.visaCategoryId === 'visa_15_mercosul');
  const schedule = gerarCronogramaEmissao(mercosulReqs, '2026-12-20');
  const first = schedule[0];
  const antIndex = schedule.findIndex((s) => s.requirement.validadeDias === 60);
  assert.equal(first.requirement.validadeDias, 0);
  assert.ok(antIndex > 0);
});

test('urgency center hides financial overdue alerts from assistente role', () => {
  const fin: FinancialRecord[] = [
    {
      id: 'f1',
      tipo: 'Honorários',
      descricao: 'Parcela 1',
      moeda: 'BRL',
      valor: 1500,
      vencimento: '2026-11-01',
      status: 'Atrasado',
      createdAt: '2026-10-01',
    },
  ];
  const asConsultor = calcularUrgencias({
    cases: [],
    clients: [],
    docs: [],
    deadlines: [],
    financialRecords: fin,
    role: 'consultor',
    hoje: new Date('2026-11-17T12:00:00Z'),
  });
  const asAssistente = calcularUrgencias({
    cases: [],
    clients: [],
    docs: [],
    deadlines: [],
    financialRecords: fin,
    role: 'assistente',
    hoje: new Date('2026-11-17T12:00:00Z'),
  });
  assert.equal(asConsultor.length, 1);
  assert.equal(asAssistente.length, 0);
});

test('masks and PT-BR date formatting work accurately including keystroke-by-keystroke WhatsApp', () => {
  assert.equal(maskCPF('12345678901'), '123.456.789-01');
  assert.equal(maskPhoneBR('21987654321'), '+55 (21) 98765-4321');
  assert.equal(maskPhoneBR('1133334444'), '+55 (11) 3333-4444');
  assert.equal(formatDateBR('2026-11-17'), '17/11/2026');

  // Simula digitação tecla a tecla (não pode duplicar +55 no DDD)
  let typed = '';
  for (const ch of '21987654321') {
    typed = maskPhoneBR(typed + ch);
  }
  assert.equal(typed, '+55 (21) 98765-4321');

  // Simula DDD 55 (RS) digitado tecla a tecla
  let ddd55 = '';
  for (const ch of '55999998888') {
    ddd55 = maskPhoneBR(ddd55 + ch);
  }
  assert.equal(ddd55, '+55 (55) 99999-8888');

  // Simula apagar até limpar completamente
  let deleting = '+55 (11) 9';
  deleting = maskPhoneBR(deleting.slice(0, -1)); // "+55 (11) " -> "+55 (11"
  assert.equal(deleting, '+55 (11');
  deleting = maskPhoneBR(deleting.slice(0, -1)); // "+55 (1"
  assert.equal(deleting, '+55 (1');
  deleting = maskPhoneBR(deleting.slice(0, -1)); // "+55 (" -> ""
  assert.equal(deleting, '');

  // Simula número chileno +56 tecla a tecla
  let chile = '';
  for (const ch of '+56988885566') {
    chile = maskPhoneBR(chile + ch);
  }
  assert.equal(chile, '+56 9 8888 5566');

  assert.equal(isValidWhatsApp('+55 (21) 98765-4321'), true);
  assert.equal(isValidWhatsApp('+55 (11) 3333-4444'), true);
  assert.equal(isValidWhatsApp('+56 9 8888 5566'), true);
  assert.equal(isValidWhatsApp('+55 (11) 987'), false);
});
