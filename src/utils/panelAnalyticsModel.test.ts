import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Case, Client, Lead } from '../types/domain';
import { computePanelAnalytics } from './panelAnalyticsModel';

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: 'lead_1',
    nome: 'Lead Teste',
    email: 'lead@example.com',
    whatsapp: '+55 11 99999-0000',
    cidadeUf: 'São Paulo/SP',
    origem: 'Site',
    interesse: 'Assessoria Migratória',
    statusFunil: 'Novo',
    prioridade: 'Média',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: '2026-10-12T10:00:00.000Z',
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
    ...overrides,
  };
}

describe('panelAnalyticsModel — Recharts Consultancy Statistics Engine', () => {
  it('computes monthly diagnostic volume, conversion rates, and migration profile distribution accurately', () => {
    const now = new Date('2026-11-20T12:00:00.000Z');
    const leads: Lead[] = [
      makeLead({
        id: 'l1',
        statusFunil: 'Fechado',
        convertedClientId: 'c1',
        subcategoriaSugerida: 'Acordo Mercosul (Subcategoria 15)',
        createdAt: '2026-11-05T10:00:00.000Z',
      }),
      makeLead({
        id: 'l2',
        statusFunil: 'Novo',
        subcategoriaSugerida: 'Acordo Mercosul (Subcategoria 15)',
        createdAt: '2026-11-10T10:00:00.000Z',
      }),
      makeLead({
        id: 'l3',
        statusFunil: 'Fechado',
        convertedClientId: 'c2',
        subcategoriaSugerida: 'Reunificação Familiar (Subcategoria 01)',
        createdAt: '2026-10-15T10:00:00.000Z',
      }),
      makeLead({
        id: 'l4',
        statusFunil: 'Orçamento Enviado',
        subcategoriaSugerida: 'Atividades Lícitas com Contrato (Subcategoria 02)',
        createdAt: '2026-09-18T10:00:00.000Z',
      }),
    ];

    const clients: Client[] = [
      {
        id: 'c1',
        nomeCompleto: 'Cliente 1',
        cpf: '111.111.111-11',
        email: 'c1@example.com',
        whatsapp: '+55 11 99999-0001',
        nacionalidade: 'Brasileira',
        portalLiberado: true,
        statusAcessoPortal: 'Liberado',
        createdAt: '2026-11-06T00:00:00.000Z',
        updatedAt: '2026-11-06T00:00:00.000Z',
      },
      {
        id: 'c2',
        nomeCompleto: 'Cliente 2',
        cpf: '222.222.222-22',
        email: 'c2@example.com',
        whatsapp: '+55 11 99999-0002',
        nacionalidade: 'Brasileira',
        portalLiberado: true,
        statusAcessoPortal: 'Liberado',
        createdAt: '2026-10-20T00:00:00.000Z',
        updatedAt: '2026-10-20T00:00:00.000Z',
      },
    ];

    const cases: Case[] = [
      {
        id: 'case1',
        clientId: 'c1',
        titulo: 'Mercosul c1',
        tipoServico: 'Residência Temporal',
        statusSermig: 'Em trâmite',
        etapaPipeline: 10,
        portalLiberado: true,
        relatorioViabilidadeLiberado: true,
        prioridade: 'Alta',
        createdAt: '2026-11-07T00:00:00.000Z',
        updatedAt: '2026-11-07T00:00:00.000Z',
      },
    ];

    const result = computePanelAnalytics({
      leads,
      clients,
      cases,
      horizon: '6m',
      now,
    });

    assert.equal(result.monthlySeries.length, 6);
    assert.equal(result.totalDiagnosticos, 4);
    assert.equal(result.diagnosticosNoPeriodo, 4);
    assert.equal(result.taxaConversaoGlobalPct, 50);
    assert.equal(result.totalClientesAtivos, 2);
    assert.equal(result.totalProcessosAtivos, 1);

    const novBucket = result.monthlySeries.find((m) => m.monthKey === '2026-11');
    assert.ok(novBucket);
    assert.equal(novBucket.diagnosticos, 2);
    assert.equal(novBucket.convertidos, 1);
    assert.equal(novBucket.taxaConversaoPct, 50);

    const mercosul = result.profileDistribution.find((p) => p.id === 'mercosul');
    assert.ok(mercosul);
    assert.equal(mercosul.total, 2);
    assert.equal(mercosul.percentual, 50);
    assert.equal(result.perfilLider?.id, 'mercosul');
  });

  it('handles empty datasets cleanly without NaN or division by zero', () => {
    const result = computePanelAnalytics({
      leads: [],
      clients: [],
      cases: [],
      horizon: '12m',
      now: new Date('2026-11-20T12:00:00.000Z'),
    });

    assert.equal(result.monthlySeries.length, 12);
    assert.equal(result.totalDiagnosticos, 0);
    assert.equal(result.taxaConversaoGlobalPct, 0);
    assert.equal(result.profileDistribution.length, 0);
    assert.equal(result.perfilLider, null);
  });
});
