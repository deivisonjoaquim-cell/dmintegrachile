import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCommandPaletteItems,
  buildDailyExecutiveBriefingText,
  buildDailyUrgenciesCsv,
  computeOperationalHealth,
  filterPendingDocsByQuery,
  filterTasksByQuery,
  filterUrgenciesByQuery,
  formatExecutiveDateBR,
  formatSyncTimeBR,
  getExecutiveGreeting,
  type PanelUrgencyItem,
} from './panelInsights';
import { getVisiblePanelHubs, getVisibleWorkflowStages } from './panelNavigation';
import type { Case, CaseDocument, Client, Deadline, Lead, LegalSource, Task } from '../types/domain';

test('getExecutiveGreeting adapts to morning, afternoon, evening and first name', () => {
  assert.equal(getExecutiveGreeting(9, 'Deivison Joaquim'), 'Bom dia, Deivison');
  assert.equal(getExecutiveGreeting(14, 'Maria Silva'), 'Boa tarde, Maria');
  assert.equal(getExecutiveGreeting(21, 'Carlos'), 'Boa noite, Carlos');
  assert.equal(getExecutiveGreeting(2, ''), 'Boa noite');
});

test('formatExecutiveDateBR and formatSyncTimeBR produce readable PT-BR outputs', () => {
  const sampleDate = new Date(2026, 10, 28, 9, 7);
  assert.equal(formatExecutiveDateBR(sampleDate), 'Sábado, 28 de novembro');
  assert.equal(formatSyncTimeBR(sampleDate), '09:07');
  assert.equal(formatSyncTimeBR(null), '—');
});

test('computeOperationalHealth classifies healthy, attention, and critical states accurately', () => {
  const futureDate = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);
  const pastDate = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);

  const healthy = computeOperationalHealth({
    deadlines: [
      {
        id: 'd1',
        caseId: 'c1',
        titulo: 'Prazo futuro',
        tipo: 'Prazo Legal 6 Meses SERMIG',
        dataLimite: futureDate,
        concluido: false,
      } as unknown as Deadline,
    ],
    avgDocsPct: 92,
    criticalUrgenciesCount: 0,
    pendingSignaturesCount: 0,
    pendingDocsCount: 0,
  });
  assert.equal(healthy.status, 'saudavel');
  assert.equal(healthy.slaCompliancePct, 100);

  const attention = computeOperationalHealth({
    deadlines: [
      {
        id: 'd1',
        caseId: 'c1',
        titulo: 'Prazo futuro',
        tipo: 'Prazo Legal 6 Meses SERMIG',
        dataLimite: futureDate,
        concluido: false,
      } as unknown as Deadline,
    ],
    avgDocsPct: 80,
    criticalUrgenciesCount: 0,
    pendingSignaturesCount: 2,
    pendingDocsCount: 1,
  });
  assert.equal(attention.status, 'atencao');
  assert.match(attention.summaryLine, /2 assinatura\(s\) pendente\(s\)/);

  const critical = computeOperationalHealth({
    deadlines: [
      {
        id: 'd1',
        caseId: 'c1',
        titulo: 'Prazo vencido',
        tipo: 'Resposta Requerimento/Recurso',
        dataLimite: pastDate,
        concluido: false,
      } as unknown as Deadline,
      {
        id: 'd2',
        caseId: 'c1',
        titulo: 'Prazo futuro',
        tipo: 'Prazo Legal 6 Meses SERMIG',
        dataLimite: futureDate,
        concluido: false,
      } as unknown as Deadline,
    ],
    avgDocsPct: 85,
    criticalUrgenciesCount: 1,
    pendingSignaturesCount: 0,
    pendingDocsCount: 0,
  });
  assert.equal(critical.status, 'critico');
  assert.equal(critical.overdueDeadlinesCount, 1);
  assert.equal(critical.slaCompliancePct, 50);
});

test('accent-insensitive search filters urgencies, tasks and pending documents cleanly', () => {
  const urgencias: PanelUrgencyItem[] = [
    {
      id: 'u1',
      categoria: 'Descargos / Requerimento',
      severidade: 'Critica',
      titulo: 'Subsanación SERMIG pendente',
      detalhe: 'Enviar apostila de antecedentes',
      clientNome: 'João Pereira',
      dataReferenciaBR: '30/11/2026',
    },
    {
      id: 'u2',
      categoria: 'Documento vencendo',
      severidade: 'Alta',
      titulo: 'Passaporte próximo do vencimento',
      detalhe: 'Renovar antes do protocolo',
      clientNome: 'Ana Costa',
      dataReferenciaBR: '15/12/2026',
    },
  ];
  assert.equal(filterUrgenciesByQuery(urgencias, 'joao').length, 1);
  assert.equal(filterUrgenciesByQuery(urgencias, 'subsanacion').length, 1);
  assert.equal(filterUrgenciesByQuery(urgencias, '').length, 2);

  const tasks: Task[] = [
    { id: 't1', titulo: 'Conferir certidão de nascimento', status: 'Pendente', prioridade: 'Alta', createdAt: '' } as unknown as Task,
    { id: 't2', titulo: 'Agendar reunião de alinhamento', status: 'Pendente', prioridade: 'Média', createdAt: '' } as unknown as Task,
  ];
  assert.equal(filterTasksByQuery(tasks, 'certidao').length, 1);

  const docs: CaseDocument[] = [
    { id: 'doc1', caseId: 'c1', nomeDocumento: 'Certidão de Antecedentes PF', pessoa: 'João', status: 'Enviado' } as unknown as CaseDocument,
    { id: 'doc2', caseId: 'c1', nomeDocumento: 'Comprovante de Renda', pessoa: 'Ana', status: 'Em análise' } as unknown as CaseDocument,
  ];
  assert.equal(filterPendingDocsByQuery(docs, 'antecedentes').length, 1);
  assert.equal(filterPendingDocsByQuery(docs, 'ana').length, 1);
});

test('buildDailyExecutiveBriefingText respects RBAC and includes top priorities', () => {
  const health = computeOperationalHealth({
    deadlines: [],
    avgDocsPct: 78,
    criticalUrgenciesCount: 1,
    pendingSignaturesCount: 2,
    pendingDocsCount: 3,
  });
  const urgencias: PanelUrgencyItem[] = [
    {
      id: 'u1',
      categoria: 'Descargos / Requerimento',
      severidade: 'Critica',
      titulo: 'Prazo SERMIG vence amanhã',
      detalhe: 'Protocolar resposta',
      clientNome: 'Lucas Mendes',
      dataReferenciaBR: '29/11/2026',
    },
  ];

  const adminBriefing = buildDailyExecutiveBriefingText({
    brandName: 'D&M Integra Chile',
    dateLabel: 'Sábado, 28 de novembro',
    role: 'admin',
    activeCasesCount: 12,
    activeClientsCount: 10,
    avgDocsPct: 78,
    urgencias,
    openTasksCount: 5,
    pendingDocsCount: 3,
    unreadChatCount: 2,
    pendingSignaturesCount: 2,
    receitaBrl: 15000,
    inadimplenciaBrl: 1200,
    health,
  });
  assert.match(adminBriefing, /Financeiro \(BRL\)/);
  assert.match(adminBriefing, /Contratos pendentes de assinatura: 2/);
  assert.match(adminBriefing, /Lucas Mendes — Prazo SERMIG vence amanhã/);

  const assistenteBriefing = buildDailyExecutiveBriefingText({
    brandName: 'D&M Integra Chile',
    dateLabel: 'Sábado, 28 de novembro',
    role: 'assistente',
    activeCasesCount: 12,
    activeClientsCount: 10,
    avgDocsPct: 78,
    urgencias: [],
    openTasksCount: 5,
    pendingDocsCount: 3,
    unreadChatCount: 0,
    pendingSignaturesCount: 2,
    receitaBrl: 15000,
    inadimplenciaBrl: 1200,
    health,
  });
  assert.doesNotMatch(assistenteBriefing, /Financeiro \(BRL\)/);
  assert.match(assistenteBriefing, /Sem urgências críticas/);
});

test('buildDailyUrgenciesCsv outputs UTF-8 BOM and escapes semicolons safely', () => {
  const csv = buildDailyUrgenciesCsv(
    [
      {
        id: 'u1',
        categoria: 'Descargos / Requerimento',
        severidade: 'Critica',
        titulo: 'Protocolo; Urgente',
        detalhe: 'Enviar hoje',
        clientNome: 'Mariana',
        dataReferenciaBR: '28/11/2026',
      },
    ],
    [
      { id: 't1', titulo: 'Revisar PDF', status: 'Pendente', prioridade: 'Alta', prazo: '2026-12-01', createdAt: '' } as unknown as Task,
      { id: 't2', titulo: 'Já concluída', status: 'Concluída', prioridade: 'Baixa', createdAt: '' } as unknown as Task,
    ],
  );
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /"Protocolo; Urgente"/);
  assert.match(csv, /Revisar PDF/);
  assert.doesNotMatch(csv, /Já concluída/);
});

test('buildCommandPaletteItems exposes empty-query quick actions and respects RBAC', () => {
  const baseData = {
    isDark: false,
    cases: [
      {
        id: 'c1',
        clientId: 'cli1',
        titulo: 'Visto Temporário — Sofia',
        etapaPipeline: 8,
        statusSermig: 'Em análise',
        numeroPedidoSermig: 'SERMIG-2026-99',
      } as unknown as Case,
    ],
    clients: [
      {
        id: 'cli1',
        nomeCompleto: 'Sofia Andrade',
        email: 'sofia@example.com',
        cpf: '123.456.789-00',
        whatsapp: '5511999999999',
      } as unknown as Client,
    ],
    leads: [
      {
        id: 'l1',
        nome: 'Rafael Lima',
        email: 'rafael@example.com',
        statusFunil: 'Novo',
        interesse: 'Visto Mercosul',
      } as unknown as Lead,
    ],
    tasks: [
      {
        id: 't1',
        titulo: 'Apostilar diploma',
        status: 'Pendente',
        prioridade: 'Alta',
        caseId: 'c1',
      } as unknown as Task,
    ],
    docs: [
      {
        id: 'd1',
        caseId: 'c1',
        nomeDocumento: 'Passaporte Válido',
        pessoa: 'Sofia',
        status: 'Enviado',
      } as unknown as CaseDocument,
    ],
    legalSources: [
      {
        id: 'leg1',
        titulo: 'Ley 21.325 de Migración',
        numeroAno: '21.325/2021',
        pais: 'Chile',
        tipo: 'Lei',
        statusVigencia: 'Vigente',
      } as unknown as LegalSource,
    ],
  };

  const emptyAdmin = buildCommandPaletteItems({
    ...baseData,
    query: '',
    role: 'admin',
    visibleHubs: getVisiblePanelHubs('admin'),
    visibleStages: getVisibleWorkflowStages('admin'),
  });
  assert.ok(emptyAdmin.some((i) => i.id === 'qa_new_case'));
  assert.ok(emptyAdmin.some((i) => i.id === 'qa_signatures'));

  const emptyAssistente = buildCommandPaletteItems({
    ...baseData,
    query: '',
    role: 'assistente',
    visibleHubs: getVisiblePanelHubs('assistente'),
    visibleStages: getVisibleWorkflowStages('assistente'),
  });
  assert.ok(emptyAssistente.some((i) => i.id === 'qa_new_case'));
  assert.ok(!emptyAssistente.some((i) => i.id === 'qa_signatures'));

  const searchSermig = buildCommandPaletteItems({
    ...baseData,
    query: 'SERMIG-2026-99',
    role: 'admin',
    visibleHubs: getVisiblePanelHubs('admin'),
    visibleStages: getVisibleWorkflowStages('admin'),
  });
  assert.equal(searchSermig[0]?.id, 'case_c1');

  const searchLegalAssistente = buildCommandPaletteItems({
    ...baseData,
    query: '21.325',
    role: 'assistente',
    visibleHubs: getVisiblePanelHubs('assistente'),
    visibleStages: getVisibleWorkflowStages('assistente'),
  });
  assert.equal(searchLegalAssistente.some((i) => i.category === 'Base Legal'), false);
});
