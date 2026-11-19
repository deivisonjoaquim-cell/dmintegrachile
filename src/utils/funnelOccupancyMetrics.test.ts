import test from 'node:test';
import assert from 'node:assert/strict';
import type { Case, Lead } from '../types/domain';
import { computeFunnelOccupancyMetrics } from './funnelOccupancyMetrics';

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: overrides.id || 'lead_1',
    nome: overrides.nome || 'Lead Teste',
    whatsapp: '+5511999999999',
    email: 'lead@example.com',
    cidadeUf: 'São Paulo/SP',
    origem: 'Site',
    interesse: 'Residência Temporal',
    statusFunil: 'Novo',
    prioridade: 'Média',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: '2026-11-15T10:00:00.000Z',
    createdAt: '2026-11-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeCase(overrides: Partial<Case>): Case {
  return {
    id: overrides.id || 'case_1',
    clientId: overrides.clientId || 'cli_1',
    titulo: overrides.titulo || 'Residência Temporal',
    tipoServico: 'Residência Temporal',
    etapaPipeline: 5,
    statusSermig: 'Em trâmite',
    portalLiberado: true,
    relatorioViabilidadeLiberado: true,
    prioridade: 'Média',
    createdAt: '2026-11-15T10:00:00.000Z',
    ...overrides,
  };
}

test('computeFunnelOccupancyMetrics computes occupancy % and conversion across all 5 stages', () => {
  const leads: Lead[] = [
    makeLead({ id: 'l1', statusFunil: 'Novo' }), // diagnostico
    makeLead({ id: 'l2', statusFunil: 'Orçamento Enviado' }), // proposta
    makeLead({ id: 'l3', statusFunil: 'Perdido' }), // lost lead (counts in entry denominator, not active occupancy)
  ];

  const cases: Case[] = [
    makeCase({ id: 'c1', etapaPipeline: 5 }), // documentacao
    makeCase({ id: 'c2', etapaPipeline: 6 }), // documentacao
    makeCase({ id: 'c3', etapaPipeline: 8 }), // tramite
    makeCase({ id: 'c4', etapaPipeline: 14, statusSermig: 'Aprovado' }), // finalizacao
    makeCase({ id: 'c5', etapaPipeline: 14, arquivado: true }), // ignored
  ];

  const result = computeFunnelOccupancyMetrics({
    leads,
    cases,
    period: 'all',
  });

  assert.equal(result.totalActiveInFunnel, 6);
  assert.equal(result.totalLeadsActive, 2);
  assert.equal(result.totalCasesActive, 4);
  assert.equal(result.lostLeadsCount, 1);
  assert.equal(result.stages.length, 5);

  const byId = new Map(result.stages.map((s) => [s.stageId, s]));
  assert.equal(byId.get('diagnostico')?.activeCount, 1);
  assert.equal(byId.get('proposta')?.activeCount, 1);
  assert.equal(byId.get('documentacao')?.activeCount, 2);
  assert.equal(byId.get('tramite')?.activeCount, 1);
  assert.equal(byId.get('finalizacao')?.activeCount, 1);

  assert.equal(byId.get('documentacao')?.occupancyPct, 33.3);
  assert.equal(byId.get('documentacao')?.isHeaviestOccupancy, true);
  assert.equal(result.heaviestStage?.stageId, 'documentacao');

  // Cumulative reach: entry = 6 active + 1 lost = 7; proposta+ = 5; doc+ = 4; tramite+ = 2; finalizacao = 1
  assert.equal(byId.get('diagnostico')?.cumulativeReached, 7);
  assert.equal(byId.get('proposta')?.cumulativeReached, 5);
  assert.equal(byId.get('documentacao')?.cumulativeReached, 4);
  assert.equal(byId.get('tramite')?.cumulativeReached, 2);
  assert.equal(byId.get('finalizacao')?.cumulativeReached, 1);
  assert.equal(result.entryToFinalizationPct, Math.round((1 / 7) * 100));
});

test('computeFunnelOccupancyMetrics handles empty workspace and period filtering cleanly', () => {
  const empty = computeFunnelOccupancyMetrics({ leads: [], cases: [] });
  assert.equal(empty.totalActiveInFunnel, 0);
  assert.equal(empty.heaviestStage, null);
  assert.equal(empty.entryToFinalizationPct, 0);
  assert.ok(empty.stages.every((s) => s.occupancyPct === 0 && s.activeCount === 0));

  const now = new Date('2026-11-19T12:00:00.000Z');
  const filtered = computeFunnelOccupancyMetrics({
    leads: [
      makeLead({ id: 'old', createdAt: '2026-08-01T10:00:00.000Z' }),
      makeLead({ id: 'recent', createdAt: '2026-11-17T10:00:00.000Z' }),
    ],
    cases: [],
    period: '7d',
    now,
  });
  assert.equal(filtered.totalActiveInFunnel, 1);
  assert.equal(filtered.stages[0].occupancyPct, 100);
});
