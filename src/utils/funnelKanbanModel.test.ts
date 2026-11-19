import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Case, CaseDocument, Client, Deadline, Lead, Task } from '../types/domain';
import { buildFunnelKanbanBoard, evaluateKanbanMove } from './funnelKanbanModel';

const clients: Client[] = [
  {
    id: 'cli_1',
    nomeCompleto: 'Beatriz Almeida',
    cpf: '11122233344',
    email: 'beatriz@example.com',
    whatsapp: '+5511999991111',
    portalLiberado: true,
    statusAcessoPortal: 'Liberado',
    createdAt: '2026-10-01T10:00:00.000Z',
  },
  {
    id: 'cli_2',
    nomeCompleto: 'Rafael Nogueira',
    cpf: '55566677788',
    email: 'rafael@example.com',
    whatsapp: '+5521988882222',
    portalLiberado: true,
    statusAcessoPortal: 'Liberado',
    createdAt: '2026-10-02T10:00:00.000Z',
  },
];

const leads: Lead[] = [
  {
    id: 'lead_1',
    nome: 'Camila Ferreira',
    whatsapp: '+5511977770001',
    email: 'camila@example.com',
    cidadeUf: 'Curitiba/PR',
    origem: 'Site',
    interesse: 'morar_brasil_chile',
    statusFunil: 'Novo',
    prioridade: 'Alta',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: '2026-11-10T10:00:00.000Z',
    subcategoriaSugerida: 'Acordo Mercosul',
    createdAt: '2026-11-10T10:00:00.000Z',
  },
  {
    id: 'lead_2',
    nome: 'Diego Martins',
    whatsapp: '+5511977770002',
    email: 'diego@example.com',
    cidadeUf: 'São Paulo/SP',
    origem: 'Instagram',
    interesse: 'trabalho_chile',
    statusFunil: 'Orçamento Enviado',
    prioridade: 'Média',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: '2026-11-11T10:00:00.000Z',
    subcategoriaSugerida: 'Contrato de Trabalho',
    createdAt: '2026-11-11T10:00:00.000Z',
  },
  {
    id: 'lead_converted',
    nome: 'Beatriz Almeida',
    whatsapp: '+5511999991111',
    email: 'beatriz@example.com',
    cidadeUf: 'São Paulo/SP',
    origem: 'Site',
    interesse: 'morar_brasil_chile',
    statusFunil: 'Fechado',
    prioridade: 'Alta',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: '2026-10-01T09:00:00.000Z',
    convertedCaseId: 'case_1',
    createdAt: '2026-10-01T09:00:00.000Z',
  },
];

const cases: Case[] = [
  {
    id: 'case_1',
    clientId: 'cli_1',
    titulo: 'Mercosul 15 — Beatriz',
    tipoServico: 'Residência Temporal',
    etapaPipeline: 5, // Documentação
    statusSermig: 'Não protocolado',
    portalLiberado: true,
    relatorioViabilidadeLiberado: true,
    prioridade: 'Alta',
    createdAt: '2026-10-03T10:00:00.000Z',
  },
  {
    id: 'case_2',
    clientId: 'cli_2',
    titulo: 'Residência Trabalho — Rafael',
    tipoServico: 'Residência Temporal',
    etapaPipeline: 12, // Finalização
    statusSermig: 'Aprovado',
    numeroPedidoSermig: 'SERMIG-2026-771',
    portalLiberado: true,
    relatorioViabilidadeLiberado: true,
    prioridade: 'Média',
    createdAt: '2026-10-04T10:00:00.000Z',
  },
];

const docs: CaseDocument[] = [
  {
    id: 'd1',
    caseId: 'case_1',
    clientId: 'cli_1',
    nomeDocumento: 'Passaporte',
    categoriaDoc: 'Identidade',
    pessoa: 'Titular',
    obrigatorio: true,
    peso: 2,
    ordemEmissao: 1,
    validadeDias: 365,
    exigeApostila: false,
    apostilado: false,
    exigeTraducao: false,
    traduzido: false,
    status: 'Aprovado',
    etapaEsteira: '6 Aprovado para Protocolo',
    versao: 1,
  },
  {
    id: 'd2',
    caseId: 'case_1',
    clientId: 'cli_1',
    nomeDocumento: 'Antecedentes PF',
    categoriaDoc: 'Antecedentes',
    pessoa: 'Titular',
    obrigatorio: true,
    peso: 2,
    ordemEmissao: 2,
    validadeDias: 60,
    exigeApostila: true,
    apostilado: false,
    exigeTraducao: false,
    traduzido: false,
    status: 'Pendente',
    etapaEsteira: '1 Aguardando Envio',
    versao: 1,
  },
];

const tasks: Task[] = [
  {
    id: 't1',
    caseId: 'case_1',
    clientId: 'cli_1',
    titulo: 'Conferir passaporte',
    prioridade: 'Alta',
    status: 'Concluída',
    createdAt: '2026-10-05T10:00:00.000Z',
  },
  {
    id: 't2',
    caseId: 'case_1',
    clientId: 'cli_1',
    titulo: 'Solicitar antecedentes PF',
    prioridade: 'Alta',
    status: 'Pendente',
    createdAt: '2026-10-06T10:00:00.000Z',
  },
];

const deadlines: Deadline[] = [];

describe('funnelKanbanModel — Simplified 5-Column Client Funnel Kanban', () => {
  it('builds 5 ordered columns unifying active leads and cases without duplicating converted leads', () => {
    const board = buildFunnelKanbanBoard({
      leads,
      clients,
      cases,
      docs,
      tasks,
      deadlines,
    });

    assert.equal(board.columns.length, 5);
    assert.deepEqual(
      board.columns.map((c) => c.stage.id),
      ['diagnostico', 'proposta', 'documentacao', 'tramite', 'finalizacao'],
    );
    // 2 active leads + 2 active cases = 4 unique cards (lead_converted is excluded!)
    assert.equal(board.totalAllCards, 4);
    assert.equal(board.totalVisibleCards, 4);

    const byId = Object.fromEntries(board.columns.map((c) => [c.stage.id, c]));
    assert.equal(byId.diagnostico.cards.length, 1);
    assert.equal(byId.diagnostico.cards[0].clientName, 'Camila Ferreira');
    assert.equal(byId.proposta.cards.length, 1);
    assert.equal(byId.proposta.cards[0].clientName, 'Diego Martins');
    assert.equal(byId.documentacao.cards.length, 1);
    assert.equal(byId.documentacao.cards[0].clientName, 'Beatriz Almeida');
    assert.equal(byId.documentacao.cards[0].docsPct, 50);
    assert.equal(byId.documentacao.cards[0].completedTasksCount, 1);
    assert.equal(byId.documentacao.cards[0].totalTasksCount, 2);
    assert.equal(byId.tramite.cards.length, 0);
    assert.equal(byId.finalizacao.cards.length, 1);
    assert.equal(byId.finalizacao.cards[0].progressPct, 100);
  });

  it('filters cards cleanly by search query, kind (cases/leads/attention), and priority', () => {
    const onlyCases = buildFunnelKanbanBoard({
      leads,
      clients,
      cases,
      docs,
      tasks,
      deadlines,
      filters: { kind: 'cases' },
    });
    assert.equal(onlyCases.totalVisibleCards, 2);

    const searchRafael = buildFunnelKanbanBoard({
      leads,
      clients,
      cases,
      docs,
      tasks,
      deadlines,
      filters: { query: 'SERMIG-2026-771' },
    });
    assert.equal(searchRafael.totalVisibleCards, 1);
    assert.equal(searchRafael.columns[4].cards[0].clientName, 'Rafael Nogueira');

    const onlyAttention = buildFunnelKanbanBoard({
      leads,
      clients,
      cases,
      docs,
      tasks,
      deadlines,
      filters: { kind: 'attention' },
    });
    // Camila (Novo lead awaiting first contact) needs attention
    assert.equal(onlyAttention.totalVisibleCards, 1);
    assert.equal(onlyAttention.columns[0].cards[0].clientName, 'Camila Ferreira');
  });

  it('enforces transition rules: allows lead Diagnóstico->Proposta, requires conversion for Documentação, and enforces protocol gate for Cases', () => {
    const board = buildFunnelKanbanBoard({
      leads,
      clients,
      cases,
      docs,
      tasks,
      deadlines,
      bloqueioProtocoloMinimo: 100,
    });

    const leadCard = board.columns[0].cards[0];
    const moveLeadToProposta = evaluateKanbanMove({
      card: leadCard,
      targetStageId: 'proposta',
    });
    assert.deepEqual(moveLeadToProposta, {
      allowed: true,
      entity: 'lead',
      leadId: 'lead_1',
      nextStatusFunil: 'Orçamento Enviado',
    });

    const moveLeadToDoc = evaluateKanbanMove({
      card: leadCard,
      targetStageId: 'documentacao',
    });
    assert.equal(moveLeadToDoc.allowed, false);
    if (!moveLeadToDoc.allowed) {
      assert.equal(moveLeadToDoc.reason, 'requires-lead-conversion');
    }

    // Case with 50% docs blocked from Trâmite when minimum is 100%
    const caseCard = board.columns[2].cards[0];
    const blockedMove = evaluateKanbanMove({
      card: caseCard,
      targetStageId: 'tramite',
      bloqueioProtocoloMinimo: 100,
    });
    assert.equal(blockedMove.allowed, false);
    if (!blockedMove.allowed) {
      assert.equal(blockedMove.reason, 'protocol-gate-blocked');
    }

    // Same case allowed when minimum threshold is met (e.g. 50%)
    const allowedMove = evaluateKanbanMove({
      card: caseCard,
      targetStageId: 'tramite',
      bloqueioProtocoloMinimo: 50,
    });
    assert.deepEqual(allowedMove, {
      allowed: true,
      entity: 'case',
      caseId: 'case_1',
      targetPipelineStep: 7,
      nextStatusSermig: 'Em trâmite',
    });
  });
});
