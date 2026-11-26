import assert from 'node:assert/strict';
import test from 'node:test';
import type { Budget, BudgetItem } from '../types/domain';
import {
  BUDGET_PRESET_TEMPLATES,
  calculateBudgetTotals,
  computeBudgetMetrics,
  convertBudgetSummaryCurrencies,
  formatBudgetWhatsAppMessage,
  generateNextBudgetNumber,
  getBudgetValidityState,
} from './budgetUtils';

const sampleItems: BudgetItem[] = [
  {
    id: 'i1',
    descricao: 'Etapa 1 — Auditoria',
    etapaVinculada: 'Etapa 1–3',
    valorHonorarios: 1800,
    taxasEstimadasTerceiros: 300,
    moeda: 'BRL',
    statusEtapa: 'Paga',
  },
  {
    id: 'i2',
    descricao: 'Etapa 2 — Protocolo SERMIG',
    etapaVinculada: 'Etapa 4–9',
    valorHonorarios: 2200,
    taxasEstimadasTerceiros: 500,
    moeda: 'BRL',
    statusEtapa: 'Aguardando',
  },
];

test('calculateBudgetTotals computes honorarios, taxas, clamped discount, and stage invoice progress', () => {
  const totals = calculateBudgetTotals(sampleItems, 400);
  assert.equal(totals.totalHonorarios, 4000);
  assert.equal(totals.totalTaxas, 800);
  assert.equal(totals.subtotal, 4800);
  assert.equal(totals.descontoAplicado, 400);
  assert.equal(totals.totalGeral, 4400);
  assert.equal(totals.faturadoHonorarios, 1800);
  assert.equal(totals.pendenteHonorarios, 2200);
  assert.equal(totals.etapasPagas, 1);
  assert.equal(totals.etapasTotais, 2);

  // Discount larger than subtotal clamps cleanly to subtotal
  const clamped = calculateBudgetTotals(sampleItems, 99999);
  assert.equal(clamped.descontoAplicado, 4800);
  assert.equal(clamped.totalGeral, 0);
});

test('generateNextBudgetNumber finds max sequential number for the given year without collisions', () => {
  const next = generateNextBudgetNumber(
    [
      { numeroOrcamento: 'ORC-2026-001' },
      { numeroOrcamento: 'ORC-2026-004' },
      { numeroOrcamento: 'ORC-2025-019' },
    ],
    2026,
  );
  assert.equal(next, 'ORC-2026-005');
  assert.equal(generateNextBudgetNumber([], 2026), 'ORC-2026-001');
});

test('convertBudgetSummaryCurrencies converts across BRL, USD, and CLP accurately', () => {
  const fromBrl = convertBudgetSummaryCurrencies(560, 'BRL', { brlClp: 170, usdBrl: 5.6 });
  assert.equal(fromBrl.BRL, 560);
  assert.equal(fromBrl.USD, 100);
  assert.equal(fromBrl.CLP, 95200);

  const fromUsd = convertBudgetSummaryCurrencies(100, 'USD', { brlClp: 170, usdBrl: 5.6 });
  assert.equal(fromUsd.BRL, 560);
  assert.equal(fromUsd.CLP, 95200);
});

test('getBudgetValidityState identifies expired, expiring soon, active, and concluded budgets', () => {
  assert.equal(getBudgetValidityState('2026-11-20', 'Enviado ao Cliente', '2026-11-26').state, 'vencido');
  assert.equal(getBudgetValidityState('2026-11-28', 'Enviado ao Cliente', '2026-11-26').state, 'vence_em_breve');
  assert.equal(getBudgetValidityState('2026-12-15', 'Enviado ao Cliente', '2026-11-26').state, 'vigente');
  assert.equal(getBudgetValidityState('2026-11-01', 'Aprovado', '2026-11-26').state, 'concluido');
});

test('computeBudgetMetrics aggregates open/approved values and approval conversion rate', () => {
  const baseBudget: Budget = {
    id: 'b1',
    numeroOrcamento: 'ORC-2026-001',
    titulo: 'Mercosul',
    tipoCobranca: 'Por Etapa Realizada',
    moedaPrincipal: 'BRL',
    itens: sampleItems,
    desconto: 0,
    totalHonorarios: 4000,
    totalTaxas: 800,
    totalGeral: 4800,
    condicoesPagamento: '50/50',
    validade: '2026-11-28',
    status: 'Enviado ao Cliente',
    createdAt: '2026-11-20T00:00:00Z',
  };

  const metrics = computeBudgetMetrics(
    [
      baseBudget,
      { ...baseBudget, id: 'b2', numeroOrcamento: 'ORC-2026-002', status: 'Aprovado', totalGeral: 3600 },
      { ...baseBudget, id: 'b3', numeroOrcamento: 'ORC-2026-003', status: 'Recusado', totalGeral: 2000 },
    ],
    '2026-11-26',
  );

  assert.equal(metrics.totalCount, 3);
  assert.equal(metrics.enviadosCount, 1);
  assert.equal(metrics.aprovadosCount, 1);
  assert.equal(metrics.recusadosCount, 1);
  assert.equal(metrics.vencendoEmBreveCount, 1);
  assert.equal(metrics.taxaAprovacaoPct, 50);
  assert.equal(metrics.valorAbertoPorMoeda.BRL, 4800);
  assert.equal(metrics.valorAprovadoPorMoeda.BRL, 3600);
});

test('BUDGET_PRESET_TEMPLATES and formatBudgetWhatsAppMessage generate complete commercial content', () => {
  assert.equal(BUDGET_PRESET_TEMPLATES.length, 4);
  const mercosulItems = BUDGET_PRESET_TEMPLATES[0].buildItems({ apostilaCnjBrl: 90, taxaSermigMercosulUsd: 100 }, 5.5);
  assert.equal(mercosulItems.length, 3);
  assert.equal(mercosulItems[1].taxasEstimadasTerceiros, 550);

  const msg = formatBudgetWhatsAppMessage(
    {
      id: 'b1',
      numeroOrcamento: 'ORC-2026-001',
      titulo: 'Assessoria Mercosul',
      tipoCobranca: 'Por Etapa Realizada',
      moedaPrincipal: 'BRL',
      itens: sampleItems,
      desconto: 200,
      totalHonorarios: 4000,
      totalTaxas: 800,
      totalGeral: 4600,
      condicoesPagamento: '50% entrada + 50% protocolo',
      validade: '2026-12-10',
      status: 'Enviado ao Cliente',
      createdAt: '2026-11-26T00:00:00Z',
    },
    'João Silva',
  );
  assert.ok(msg.includes('ORC-2026-001'));
  assert.ok(msg.includes('João Silva'));
  assert.ok(msg.includes('Etapa 1 — Auditoria'));
  assert.ok(msg.includes('Desconto especial'));
});
