import assert from 'node:assert/strict';
import test from 'node:test';
import { buildClientActionCenter } from './clientPortalIntelligence';
import type { Case, CaseDocument, Deadline, FinancialRecord, GeneratedDocument } from '../types/domain';

const NOW = new Date('2026-11-26T12:00:00Z');

const BASE_CASE = {
  id: 'case_1',
  clientId: 'cli_1',
  titulo: 'Residência Temporal Mercosul',
  tipoServico: 'Consultoria Completa',
  etapaPipeline: 4,
  statusSermig: 'Em preparação',
  portalLiberado: true,
  relatorioViabilidadeLiberado: true,
  prioridade: 'Normal',
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-20T10:00:00Z',
} as unknown as Case;

test('prioritizes reproved documents as critical primary action', () => {
  const docs = [
    {
      id: 'd1',
      caseId: 'case_1',
      nomeDocumento: 'Antecedentes PF',
      obrigatorio: true,
      status: 'Reprovado',
      motivoReprovacao: 'Arquivo cortado na lateral',
    },
    {
      id: 'd2',
      caseId: 'case_1',
      nomeDocumento: 'Passaporte',
      obrigatorio: true,
      status: 'Aprovado',
    },
  ] as unknown as CaseDocument[];

  const res = buildClientActionCenter({
    activeCase: BASE_CASE,
    docs,
    deadlines: [],
    appointments: [],
    genDocs: [],
    budgets: [],
    financials: [],
    thermo: { notaGeral: 50, faltantesObrigatorios: 1, bloqueadoProtocolo: true } as any,
    needsLgpdAccept: false,
    canAccessSimulator: false,
    now: NOW,
  });

  assert.equal(res.primaryAction?.priority, 'critica');
  assert.equal(res.primaryAction?.targetTab, 'documentos');
  assert.match(res.primaryAction?.title || '', /Antecedentes PF/);
  assert.equal(res.kpis.reprovedDocsCount, 1);
  assert.equal(res.kpis.approvedDocsCount, 1);
  assert.equal(res.kpis.mandatoryDocsCount, 2);
});

test('surfaces unsigned official documents and upcoming deadlines cleanly', () => {
  const genDocs = [
    {
      id: 'gd_1',
      titulo: 'Contrato de Prestação de Serviços',
      status: 'Disponível',
      versao: 1,
      createdAt: '2026-11-20T10:00:00Z',
    },
  ] as unknown as GeneratedDocument[];

  const deadlines = [
    {
      id: 'dl_1',
      titulo: 'Renovação de certidão consular',
      tipo: 'Validade Documento',
      dataLimite: '2026-11-29T12:00:00Z',
      concluido: false,
    },
  ] as Deadline[];

  const res = buildClientActionCenter({
    activeCase: BASE_CASE,
    docs: [],
    deadlines,
    appointments: [],
    genDocs,
    budgets: [],
    financials: [],
    thermo: { notaGeral: 100, faltantesObrigatorios: 0, bloqueadoProtocolo: false } as any,
    needsLgpdAccept: false,
    canAccessSimulator: true,
    now: NOW,
  });

  assert.equal(res.kpis.unsignedDocsCount, 1);
  assert.equal(res.primaryAction?.category, 'prazo'); // 3 days -> critica
  assert.ok(res.actions.some((a) => a.category === 'assinatura' && a.targetGenDocId === 'gd_1'));
  assert.ok(res.actions.some((a) => a.category === 'simulador'));
  assert.match(res.kpis.nextMilestoneSub, /Renovação de certidão consular/);
});

test('flags overdue financial installment and returns allClear when nothing pending', () => {
  const overdueFin = [
    {
      id: 'fin_1',
      descricao: 'Parcela 2/3 Consultoria',
      valor: 1500,
      moeda: 'BRL',
      vencimento: '2026-11-20T12:00:00Z',
      status: 'Pendente',
    },
  ] as FinancialRecord[];

  const withDebt = buildClientActionCenter({
    activeCase: BASE_CASE,
    docs: [],
    deadlines: [],
    appointments: [],
    genDocs: [],
    budgets: [],
    financials: overdueFin,
    thermo: { notaGeral: 100, faltantesObrigatorios: 0, bloqueado: false } as any,
    needsLgpdAccept: false,
    canAccessSimulator: false,
    now: NOW,
  });

  assert.equal(withDebt.primaryAction?.category, 'financeiro');
  assert.equal(withDebt.primaryAction?.priority, 'critica');

  const clean = buildClientActionCenter({
    activeCase: BASE_CASE,
    docs: [],
    deadlines: [],
    appointments: [],
    genDocs: [],
    budgets: [],
    financials: [],
    thermo: { notaGeral: 100, faltantesObrigatorios: 0, bloqueado: false } as any,
    needsLgpdAccept: false,
    canAccessSimulator: false,
    now: NOW,
  });

  assert.equal(clean.primaryAction, null);
  assert.equal(clean.actions.length, 0);
  assert.equal(clean.kpis.pendingActionsCount, 0);
});
