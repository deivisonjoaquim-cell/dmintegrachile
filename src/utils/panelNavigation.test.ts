import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Case, CaseDocument, Client, CommunicationLog, Deadline, Lead, Task } from '../types/domain';
import {
  computeDailyPrioritySummary,
  getVisibleConfigSubTabs,
  getVisibleFinanceiroSubTabs,
  getVisiblePanelHubs,
  getVisibleProcessosSubTabs,
  getVisibleWorkflowStages,
  resolveActiveWorkflowStage,
  resolveLegacyPanelRoute,
} from './panelNavigation';

const baseClient: Client = {
  id: 'c1',
  nomeCompleto: 'Ana Paula Silva',
  cpf: '12345678900',
  email: 'ana@example.com',
  whatsapp: '+5511999990000',
  portalLiberado: true,
  statusAcessoPortal: 'Liberado',
  createdAt: '2026-10-01T10:00:00.000Z',
};

const baseCase: Case = {
  id: 'case1',
  clientId: 'c1',
  titulo: 'Residência Mercosul — Ana',
  tipoServico: 'Residência Temporal',
  etapaPipeline: 4,
  statusSermig: 'Não protocolado',
  portalLiberado: true,
  relatorioViabilidadeLiberado: true,
  prioridade: 'Alta',
  createdAt: '2026-10-02T10:00:00.000Z',
};

describe('panelNavigation — Simplified 6-Hub Panel Architecture & RBAC', () => {
  it('exposes streamlined hubs including Funil Kanban for admin/consultor and hides financeiro for assistente', () => {
    assert.deepEqual(
      getVisiblePanelHubs('admin').map((h) => h.id),
      ['hoje', 'funil', 'leads', 'processos', 'agenda', 'financeiro', 'config'],
    );
    assert.deepEqual(
      getVisiblePanelHubs('consultor').map((h) => h.id),
      ['hoje', 'funil', 'leads', 'processos', 'agenda', 'financeiro', 'config'],
    );
    assert.deepEqual(
      getVisiblePanelHubs('assistente').map((h) => h.id),
      ['hoje', 'funil', 'leads', 'processos', 'agenda', 'config'],
    );
    assert.deepEqual(resolveLegacyPanelRoute('funil', 'assistente'), { hub: 'funil' });
  });

  it('orders operational workflow stages 1 to 6 sequentially and enforces RBAC on Stage 6 (Financeiro)', () => {
    const adminStages = getVisibleWorkflowStages('admin');
    assert.deepEqual(
      adminStages.map((s) => s.stepNumber),
      [1, 2, 3, 4, 5, 6],
    );
    assert.deepEqual(
      adminStages.map((s) => s.id),
      [
        'etapa_1_leads',
        'etapa_2_clientes',
        'etapa_3_casos',
        'etapa_4_documentos',
        'etapa_5_agenda',
        'etapa_6_financeiro',
      ],
    );

    const assistenteStages = getVisibleWorkflowStages('assistente');
    assert.deepEqual(
      assistenteStages.map((s) => s.stepNumber),
      [1, 2, 3, 4, 5],
    );

    assert.equal(resolveActiveWorkflowStage('leads', 'casos'), 'etapa_1_leads');
    assert.equal(resolveActiveWorkflowStage('processos', 'clientes'), 'etapa_2_clientes');
    assert.equal(resolveActiveWorkflowStage('processos', 'casos'), 'etapa_3_casos');
    assert.equal(resolveActiveWorkflowStage('processos', 'checklist'), 'etapa_4_documentos');
    assert.equal(resolveActiveWorkflowStage('processos', 'dossies'), 'etapa_4_documentos');
    assert.equal(resolveActiveWorkflowStage('agenda', 'casos'), 'etapa_5_agenda');
    assert.equal(resolveActiveWorkflowStage('financeiro', 'casos'), 'etapa_6_financeiro');
    assert.equal(resolveActiveWorkflowStage('hoje', 'casos'), null);
  });

  it('enforces RBAC cleanly across Processos, Financeiro and Config sub-tabs', () => {
    assert.equal(getVisibleProcessosSubTabs('assistente').length, 4);
    assert.equal(getVisibleFinanceiroSubTabs('assistente').length, 0);
    assert.equal(getVisibleFinanceiroSubTabs('consultor').length, 2);

    assert.deepEqual(
      getVisibleConfigSubTabs('assistente').map((t) => t.id),
      ['ferramentas'],
    );
    assert.deepEqual(
      getVisibleConfigSubTabs('consultor').map((t) => t.id),
      ['ferramentas', 'legal', 'parceiros'],
    );
    assert.deepEqual(
      getVisibleConfigSubTabs('admin').map((t) => t.id),
      ['ferramentas', 'legal', 'parceiros', 'admin_site', 'admin_regras', 'admin_gov'],
    );
  });

  it('maps every legacy section route to its corresponding consolidated hub/sub-tab with RBAC fallback', () => {
    assert.deepEqual(resolveLegacyPanelRoute('dashboard', 'admin'), { hub: 'hoje' });
    assert.deepEqual(resolveLegacyPanelRoute('clientes', 'assistente'), {
      hub: 'processos',
      processosTab: 'clientes',
    });
    assert.deepEqual(resolveLegacyPanelRoute('checklist', 'consultor'), {
      hub: 'processos',
      processosTab: 'checklist',
    });
    assert.deepEqual(resolveLegacyPanelRoute('documentos', 'admin'), {
      hub: 'processos',
      processosTab: 'dossies',
    });
    assert.deepEqual(resolveLegacyPanelRoute('contratos', 'consultor'), {
      hub: 'financeiro',
      financeiroTab: 'contratos',
    });
    // Assistente blocked from financeiro & admin routes
    assert.deepEqual(resolveLegacyPanelRoute('financeiro', 'assistente'), { hub: 'hoje' });
    assert.deepEqual(resolveLegacyPanelRoute('legal', 'assistente'), {
      hub: 'config',
      configTab: 'ferramentas',
    });
    assert.deepEqual(resolveLegacyPanelRoute('admin_gov', 'consultor'), {
      hub: 'config',
      configTab: 'ferramentas',
    });
    assert.deepEqual(resolveLegacyPanelRoute('admin_site', 'admin'), {
      hub: 'config',
      configTab: 'admin_site',
    });
  });

  it('prioritizes daily recommended action accurately (critical urgencies > unread chat > docs > leads > tasks)', () => {
    const overdueDeadline: Deadline = {
      id: 'dl1',
      titulo: 'Prazo Entrada no Chile',
      tipo: 'Entrada no Chile 90d',
      dataLimite: '2026-11-10',
      caseId: 'case1',
      clientId: 'c1',
      concluido: false,
    };
    const pendingDoc: CaseDocument = {
      id: 'doc1',
      caseId: 'case1',
      clientId: 'c1',
      nomeDocumento: 'Passaporte',
      categoriaDoc: 'Identidade',
      pessoa: 'Titular',
      obrigatorio: true,
      peso: 3,
      ordemEmissao: 1,
      validadeDias: 365,
      exigeApostila: false,
      apostilado: false,
      exigeTraducao: false,
      traduzido: false,
      status: 'Enviado',
      etapaEsteira: '2 Recebido/Triagem',
      versao: 1,
    };
    const unreadChat: CommunicationLog = {
      id: 'comm1',
      clientId: 'c1',
      caseId: 'case1',
      canal: 'Chat Portal',
      assunto: 'Dúvida sobre apostila',
      mensagem: 'Precisa apostilar o passaporte?',
      autorNome: 'Ana Paula Silva',
      origem: 'cliente',
      lidaPelaEquipe: false,
      createdAt: '2026-11-18T11:00:00.000Z',
    };
    const newLead: Lead = {
      id: 'l1',
      nome: 'Carlos Eduardo',
      whatsapp: '+5521999998888',
      email: 'carlos@example.com',
      cidadeUf: 'Rio de Janeiro/RJ',
      origem: 'Site',
      interesse: 'morar_brasil_chile',
      statusFunil: 'Novo',
      prioridade: 'Alta',
      lgpdAceito: true,
      lgpdVersao: '1.0',
      lgpdData: '2026-11-18T09:00:00.000Z',
      createdAt: '2026-11-18T09:00:00.000Z',
    };
    const openTask: Task = {
      id: 't1',
      titulo: 'Enviar checklist',
      caseId: 'case1',
      clientId: 'c1',
      prioridade: 'Alta',
      status: 'Pendente',
      createdAt: '2026-11-18T08:00:00.000Z',
    };

    // 1. Critical urgency wins
    const s1 = computeDailyPrioritySummary({
      role: 'admin',
      leads: [newLead],
      clients: [baseClient],
      cases: [baseCase],
      docs: [pendingDoc],
      deadlines: [overdueDeadline],
      tasks: [openTask],
      appointments: [],
      financialRecords: [],
      communicationLogs: [unreadChat],
      todayIso: '2026-11-18',
    });
    assert.equal(s1.recommendedAction.tone, 'critical');
    assert.ok(s1.criticalUrgenciesCount >= 1);

    // 2. Without critical urgency, unread chat wins
    const s2 = computeDailyPrioritySummary({
      role: 'admin',
      leads: [newLead],
      clients: [baseClient],
      cases: [baseCase],
      docs: [pendingDoc],
      deadlines: [],
      tasks: [openTask],
      appointments: [],
      financialRecords: [],
      communicationLogs: [unreadChat],
      todayIso: '2026-11-18',
    });
    assert.equal(s2.recommendedAction.tone, 'warning');
    assert.match(s2.recommendedAction.label, /dúvida/i);

    // 3. Without chat, docs to review wins
    const s3 = computeDailyPrioritySummary({
      role: 'admin',
      leads: [newLead],
      clients: [baseClient],
      cases: [baseCase],
      docs: [pendingDoc],
      deadlines: [],
      tasks: [openTask],
      appointments: [],
      financialRecords: [],
      communicationLogs: [],
      todayIso: '2026-11-18',
    });
    assert.equal(s3.recommendedAction.target, 'checklist');

    // 4. Clean state shows calm status
    const s4 = computeDailyPrioritySummary({
      role: 'admin',
      leads: [],
      clients: [baseClient],
      cases: [baseCase],
      docs: [],
      deadlines: [],
      tasks: [],
      appointments: [],
      financialRecords: [],
      communicationLogs: [],
      todayIso: '2026-11-18',
    });
    assert.equal(s4.recommendedAction.label, 'Operação em dia');
  });
});
