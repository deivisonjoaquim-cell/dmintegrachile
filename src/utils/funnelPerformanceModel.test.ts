import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Case, Lead } from '../types/domain';
import {
  computeFunnelPerformanceSummary,
  matchesCreatedDateRange,
} from './funnelPerformanceModel';

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: overrides.id || 'lead_1',
    nome: overrides.nome || 'Lead Teste',
    whatsapp: '+5511999990000',
    email: 'lead@teste.com',
    cidadeUf: 'São Paulo/SP',
    origem: 'Site',
    interesse: 'Residência Temporal',
    statusFunil: 'Novo',
    prioridade: 'Média',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: '2026-10-01T10:00:00Z',
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

function makeCase(overrides: Partial<Case>): Case {
  return {
    id: overrides.id || 'case_1',
    titulo: overrides.titulo || 'Processo Teste',
    clientId: overrides.clientId || 'cli_1',
    tipoServico: 'Residência Temporal',
    etapaPipeline: 3,
    statusSermig: 'Não protocolado',
    portalLiberado: true,
    relatorioViabilidadeLiberado: true,
    prioridade: 'Média',
    createdAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

describe('funnelPerformanceModel — Step-by-Step Conversion & Bottleneck Detection', () => {
  it('calculates conversion and drop-off for all 4 transitions including lost leads without double counting converted leads', () => {
    const leads: Lead[] = [
      makeLead({ id: 'l1', statusFunil: 'Novo' }), // Diagnóstico (1)
      makeLead({ id: 'l2', statusFunil: 'Perdido' }), // Perdido (entra na base comercial de Diagnóstico)
      makeLead({ id: 'l3', statusFunil: 'Orçamento Enviado' }), // Proposta (1)
      makeLead({ id: 'l4', statusFunil: 'Orçamento Enviado' }), // Proposta (2)
      makeLead({ id: 'l5', statusFunil: 'Fechado', convertedCaseId: 'c1' }), // Ignorado (já é caso)
    ];

    const cases: Case[] = [
      makeCase({ id: 'c1', etapaPipeline: 4 }), // Documentação
      makeCase({ id: 'c2', etapaPipeline: 7, statusSermig: 'Em trâmite' }), // Trâmite
      makeCase({ id: 'c3', etapaPipeline: 12, statusSermig: 'Aprovado' }), // Finalização
      makeCase({ id: 'c4', etapaPipeline: 3, arquivado: true }), // Arquivado (ignorado)
    ];

    const summary = computeFunnelPerformanceSummary({ leads, cases, period: 'all' });

    assert.equal(summary.transitions.length, 4);
    assert.equal(summary.totalAnalyzed, 7); // 3 active leads + 3 active cases + 1 lost lead
    assert.equal(summary.lostLeadsCount, 1);

    // Stage counts: Diag=1 (+1 lost = 2 não avançaram), Prop=2, Doc=1, Tram=1, Fin=1
    // Reached: Fin=1, Tram=2, Doc=3, Prop=5, Diag=6 (+1 lost => entry=7)
    const [t1, t2, t3, t4] = summary.transitions;

    // Diagnóstico -> Proposta: 5 de 7 avançaram (71%)
    assert.equal(t1.id, 'diagnostico_proposta');
    assert.equal(t1.enteredCount, 7);
    assert.equal(t1.advancedCount, 5);
    assert.equal(t1.droppedCount, 2);
    assert.equal(t1.conversionPct, 71);
    assert.equal(t1.dropOffPct, 29);

    // Proposta -> Documentação: 3 de 5 avançaram (60%)
    assert.equal(t2.id, 'proposta_documentacao');
    assert.equal(t2.enteredCount, 5);
    assert.equal(t2.advancedCount, 3);
    assert.equal(t2.droppedCount, 2);
    assert.equal(t2.conversionPct, 60);
    assert.equal(t2.dropOffPct, 40);

    // Documentação -> Trâmite: 2 de 3 avançaram (67%)
    assert.equal(t3.id, 'documentacao_tramite');
    assert.equal(t3.enteredCount, 3);
    assert.equal(t3.advancedCount, 2);
    assert.equal(t3.conversionPct, 67);

    // Trâmite -> Finalização: 1 de 2 avançaram (50%) -> menor taxa => Gargalo prioritário!
    assert.equal(t4.id, 'tramite_finalizacao');
    assert.equal(t4.enteredCount, 2);
    assert.equal(t4.advancedCount, 1);
    assert.equal(t4.conversionPct, 50);
    assert.equal(t4.dropOffPct, 50);
    assert.equal(t4.isPrimaryBottleneck, true);
    assert.equal(summary.primaryBottleneck?.id, 'tramite_finalizacao');
  });

  it('filters records accurately by relative periods (7d, 30d, 90d) and custom date ranges (including inverted bounds)', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    const leads: Lead[] = [
      makeLead({ id: 'recent', statusFunil: 'Orçamento Enviado', createdAt: '2026-11-15T10:00:00Z' }), // 3d ago
      makeLead({ id: 'mid', statusFunil: 'Novo', createdAt: '2026-10-25T10:00:00Z' }), // 24d ago
      makeLead({ id: 'old', statusFunil: 'Novo', createdAt: '2026-07-01T10:00:00Z' }), // >90d ago
    ];
    const cases: Case[] = [
      makeCase({ id: 'c_recent', etapaPipeline: 4, createdAt: '2026-11-16T10:00:00Z' }), // 2d ago
    ];

    const last7d = computeFunnelPerformanceSummary({ leads, cases, period: '7d', now });
    assert.equal(last7d.totalAnalyzed, 2); // recent + c_recent
    assert.equal(last7d.transitions[1].conversionPct, 50); // Proposta -> Doc: 1 de 2

    const last30d = computeFunnelPerformanceSummary({ leads, cases, period: '30d', now });
    assert.equal(last30d.totalAnalyzed, 3); // recent + mid + c_recent

    // Custom date range with inverted from/to still works cleanly
    assert.equal(
      matchesCreatedDateRange('2026-10-25T10:00:00Z', {
        period: 'custom',
        fromDate: '2026-10-31',
        toDate: '2026-10-01',
      }),
      true,
    );
    assert.equal(
      matchesCreatedDateRange('2026-11-15T10:00:00Z', {
        period: 'custom',
        fromDate: '2026-10-01',
        toDate: '2026-10-31',
      }),
      false,
    );

    // Empty period yields neutral transitions and no bottleneck
    const emptyCustom = computeFunnelPerformanceSummary({
      leads,
      cases,
      period: 'custom',
      fromDate: '2025-01-01',
      toDate: '2025-01-31',
    });
    assert.equal(emptyCustom.totalAnalyzed, 0);
    assert.equal(emptyCustom.primaryBottleneck, null);
    assert.equal(emptyCustom.transitions.every((t) => t.conversionPct === null && t.health === 'neutral'), true);
  });
});
