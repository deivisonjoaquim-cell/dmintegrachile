import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Case, Client, EmpresaConfig, Lead, UserProfile } from '../types/domain';
import {
  buildFunnelPerformancePdfModel,
  buildRecentMonthOptions,
  resolveMonthBounds,
} from './funnelPerformancePdfModel';

const TEST_EMPRESA: EmpresaConfig = {
  nome_empresa: 'D&M Integra Chile',
  razao_social_cnpj_rut: 'D&M Integra Chile Assessoria Migratória Ltda.',
  responsavel_tecnico: 'Deivison Joaquim',
  endereco_cidade: 'São Paulo/SP · Santiago/CL',
  foro_comarca: 'São Paulo/SP',
  logoUrl: '',
  corPrimaria: '#0B1F33',
  corDestaque: '#C9A227',
  corFundo: '#F6F7F9',
  fontePrincipal: 'Plus Jakarta Sans',
  whatsapp: '+55 11 99999-0000',
  email: 'contato@dmintegrachile.com',
  siteInstagram: '',
  linkCalendly: '',
  emailGoogleAgenda: '',
  chavePix: '',
  linkPagamentoCartao: '',
  textoContratoPadrao: '',
  textoReciboPadrao: '',
  termoLgpd: '',
  termoLgpdVersao: '1.0',
  avisoLegal: 'Consultoria migratória privada independente.',
  bloqueioProtocoloMinimo: 100,
  diasAlertaRevisaoLegal: 90,
};

const clients: Client[] = [
  {
    id: 'cli_1',
    nomeCompleto: 'Fernanda Costa',
    cpf: '11122233344',
    email: 'fernanda@example.com',
    whatsapp: '+5511999990001',
    portalLiberado: true,
    statusAcessoPortal: 'Liberado',
    createdAt: '2026-11-05T10:00:00Z',
  },
];

const staffUsers: UserProfile[] = [
  {
    uid: 'u_1',
    nome: 'Deivison Joaquim',
    email: 'deivison@dmintegrachile.com',
    role: 'admin',
    status: 'ativo',
  },
];

function makeLead(id: string, statusFunil: Lead['statusFunil'], createdAt: string): Lead {
  return {
    id,
    nome: `Lead ${id}`,
    whatsapp: '+5511999991111',
    email: `${id}@example.com`,
    cidadeUf: 'São Paulo/SP',
    origem: 'Site',
    interesse: 'Residência Temporal',
    statusFunil,
    responsavelId: 'u_1',
    prioridade: 'Alta',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: createdAt,
    createdAt,
  };
}

describe('funnelPerformancePdfModel — Monthly Funnel Conversion & Bottleneck PDF', () => {
  it('resolves calendar month bounds and builds recent month options accurately', () => {
    const bounds = resolveMonthBounds('2026-11');
    assert.ok(bounds);
    assert.equal(bounds.fromDate, '2026-11-01');
    assert.equal(bounds.toDate, '2026-11-30');
    assert.match(bounds.label, /Novembro de 2026/);

    const opts = buildRecentMonthOptions(new Date('2026-11-18T12:00:00Z'), 3);
    assert.deepEqual(
      opts.map((o) => o.value),
      ['2026-11', '2026-10', '2026-09'],
    );
  });

  it('builds a multi-page monthly management report with bottleneck detection, breakdowns, and recommendations', () => {
    const leads: Lead[] = [
      makeLead('nov_1', 'Orçamento Enviado', '2026-11-03T10:00:00Z'),
      makeLead('nov_2', 'Orçamento Enviado', '2026-11-04T10:00:00Z'),
      makeLead('nov_3', 'Orçamento Enviado', '2026-11-05T10:00:00Z'),
      makeLead('nov_lost', 'Perdido', '2026-11-06T10:00:00Z'),
      makeLead('oct_old', 'Novo', '2026-10-12T10:00:00Z'), // fora de novembro
    ];

    const cases: Case[] = [
      {
        id: 'case_nov',
        clientId: 'cli_1',
        consultorId: 'u_1',
        titulo: 'Mercosul 15 — Fernanda',
        tipoServico: 'Residência Temporal',
        etapaPipeline: 15,
        statusSermig: 'Aprovado',
        portalLiberado: true,
        relatorioViabilidadeLiberado: true,
        prioridade: 'Alta',
        createdAt: '2026-11-08T10:00:00Z',
      },
    ];

    const model = buildFunnelPerformancePdfModel({
      empresa: TEST_EMPRESA,
      leads,
      cases,
      clients,
      staffUsers,
      monthKey: '2026-11',
      now: new Date('2026-11-18T12:00:00Z'),
    });

    assert.equal(model.filename, 'DM_Integra_Relatorio_Funil_2026-11_2026-11-18.pdf');
    assert.equal(model.summary.totalAnalyzed, 5); // 4 nov leads + 1 nov case (excludes oct_old)
    assert.equal(model.summary.primaryBottleneck?.id, 'proposta_documentacao');
    assert.equal(model.bottleneckStageName, 'Proposta');
    assert.equal(model.retainedTotalCount, 3);
    assert.ok(model.pages.length >= 2);
    assert.equal(model.pages[0].totalPages, model.pages.length);
    assert.equal(model.channelRows[0].origem, 'Site');
    assert.equal(model.assigneeRows[0].assigneeName, 'Deivison Joaquim');
    assert.ok(model.recommendations.length >= 1);
  });

  it('paginates cleanly into 3+ pages when many retained records exist in the bottleneck stage', () => {
    const leads: Lead[] = Array.from({ length: 12 }, (_, idx) =>
      makeLead(`l_${idx + 1}`, 'Orçamento Enviado', '2026-11-10T10:00:00Z'),
    );
    const cases: Case[] = [
      {
        id: 'c_1',
        clientId: 'cli_1',
        consultorId: 'u_1',
        titulo: 'Caso 1',
        tipoServico: 'Residência Temporal',
        etapaPipeline: 15,
        statusSermig: 'Aprovado',
        portalLiberado: true,
        relatorioViabilidadeLiberado: true,
        prioridade: 'Alta',
        createdAt: '2026-11-11T10:00:00Z',
      },
    ];

    const model = buildFunnelPerformancePdfModel({
      empresa: TEST_EMPRESA,
      leads,
      cases,
      clients,
      staffUsers,
      monthKey: '2026-11',
      now: new Date('2026-11-18T12:00:00Z'),
    });

    assert.equal(model.pages.length, 3);
    assert.equal(model.pages[1].retainedRows.length, 7);
    assert.equal(model.pages[2].retainedRows.length, 5);
    assert.equal(model.pages[2].showRecommendations, true);
  });
});
