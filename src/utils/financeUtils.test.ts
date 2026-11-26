import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMonthsIso,
  computeFinancialMetrics,
  convertToBrl,
  estimateProcessThirdPartyCosts,
  formatPaymentReminderWhatsApp,
  generateInstallments,
  getEffectiveFinancialStatus,
} from './financeUtils';
import type { FinancialRecord } from '../types/domain';

test('convertToBrl converts USD and CLP using provided rates', () => {
  assert.equal(convertToBrl(100, 'BRL', { usdBrl: 5.5, brlClp: 170 }), 100);
  assert.equal(convertToBrl(100, 'USD', { usdBrl: 5.5, brlClp: 170 }), 550);
  assert.equal(convertToBrl(17000, 'CLP', { usdBrl: 5.5, brlClp: 170 }), 100);
});

test('getEffectiveFinancialStatus flags past-due pending records as overdue', () => {
  const overdue = getEffectiveFinancialStatus({ status: 'Pendente', vencimento: '2026-05-01' }, '2026-05-10');
  assert.equal(overdue.effectiveStatus, 'Atrasado');
  assert.equal(overdue.isImplicitlyOverdue, true);
  assert.equal(overdue.daysUntilDue, -9);

  const paid = getEffectiveFinancialStatus({ status: 'Pago', vencimento: '2026-05-01' }, '2026-05-10');
  assert.equal(paid.effectiveStatus, 'Pago');
  assert.equal(paid.isImplicitlyOverdue, false);

  const upcoming = getEffectiveFinancialStatus({ status: 'Pendente', vencimento: '2026-05-15' }, '2026-05-10');
  assert.equal(upcoming.effectiveStatus, 'Pendente');
  assert.equal(upcoming.daysUntilDue, 5);
});

test('computeFinancialMetrics consolidates multi-currency records and collection rate accurately', () => {
  const records: FinancialRecord[] = [
    {
      id: 'f1',
      tipo: 'Honorários',
      descricao: 'Etapa 1',
      moeda: 'BRL',
      valor: 2000,
      vencimento: '2026-05-05',
      dataPagamento: '2026-05-04',
      status: 'Pago',
      createdAt: '2026-05-01T00:00:00Z',
    },
    {
      id: 'f2',
      tipo: 'Taxa SERMIG',
      descricao: 'Taxa Mercosul',
      moeda: 'USD',
      valor: 100,
      vencimento: '2026-05-15',
      status: 'Pendente',
      createdAt: '2026-05-01T00:00:00Z',
    },
    {
      id: 'f3',
      tipo: 'Honorários',
      descricao: 'Etapa 2 atrasada',
      moeda: 'BRL',
      valor: 1000,
      vencimento: '2026-05-02',
      status: 'Pendente',
      createdAt: '2026-05-01T00:00:00Z',
    },
  ];

  const m = computeFinancialMetrics(records, { usdBrl: 5.5, brlClp: 170 }, '2026-05-10');
  assert.equal(m.paidCount, 1);
  assert.equal(m.pendingCount, 1);
  assert.equal(m.overdueCount, 1);
  assert.equal(m.dueSoonCount, 1);
  assert.equal(m.consolidatedBrl.recebido, 2000);
  assert.equal(m.consolidatedBrl.pendente, 550);
  assert.equal(m.consolidatedBrl.atrasado, 1000);
  assert.equal(m.consolidatedBrl.total, 3550);
  assert.equal(m.collectionRatePct, 56);
});

test('generateInstallments splits amounts without cent drift and clamps month-end dates', () => {
  assert.equal(addMonthsIso('2026-01-31', 1), '2026-02-28');

  const parcelas = generateInstallments({
    descricaoBase: 'Honorários Assessoria',
    valorTotal: 1000,
    parcelas: 3,
    primeiroVencimento: '2026-01-31',
    moeda: 'BRL',
  });

  assert.equal(parcelas.length, 3);
  assert.equal(parcelas[0].valor, 333.34);
  assert.equal(parcelas[1].valor, 333.33);
  assert.equal(parcelas[2].valor, 333.33);
  const sum = Math.round(parcelas.reduce((acc, p) => acc + p.valor, 0) * 100) / 100;
  assert.equal(sum, 1000);
  assert.equal(parcelas[1].vencimento, '2026-02-28');
  assert.equal(parcelas[2].vencimento, '2026-03-31');
});

test('estimateProcessThirdPartyCosts calculates multi-applicant third-party fees', () => {
  const est = estimateProcessThirdPartyCosts(
    {
      visaType: 'mercosul',
      pessoas: 2,
      apostilasPorPessoa: 3,
      paginasTraducaoTotal: 2,
      incluirCedulaRut: true,
    },
    {
      taxaSermigMercosulUsd: 90,
      apostilaCnjBrl: 85,
      traducaoJuramentadaBrl: 120,
      cedulaIdentidadeClp: 4270,
    },
    { usdBrl: 5.5, brlClp: 170 },
  );

  assert.equal(est.sermigUsd, 180);
  assert.equal(est.sermigBrl, 990);
  assert.equal(est.apostilasBrl, 510);
  assert.equal(est.traducoesBrl, 240);
  assert.equal(est.cedulaClp, 8540);
  assert.ok(est.totalBrl > 1780);
  assert.ok(est.totalUsd > 320);
  assert.ok(est.totalClp > 300000);
});

test('formatPaymentReminderWhatsApp adapts tone for overdue vs upcoming and includes Pix key', () => {
  const msg = formatPaymentReminderWhatsApp(
    {
      id: 'f1',
      tipo: 'Honorários',
      descricao: 'Parcela 1/2',
      moeda: 'BRL',
      valor: 1500,
      vencimento: '2026-05-01',
      status: 'Pendente',
      createdAt: '2026-04-20T00:00:00Z',
    },
    'Ana',
    'pix@dmintegra.cl',
    '2026-05-10',
  );

  assert.ok(msg.includes('Ana'));
  assert.ok(msg.includes('venceu'));
  assert.ok(msg.includes('pix@dmintegra.cl'));
});
