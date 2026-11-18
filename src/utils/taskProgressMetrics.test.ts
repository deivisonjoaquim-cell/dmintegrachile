import assert from 'node:assert/strict';
import test from 'node:test';
import type { Case, Client, Task } from '../types/domain';
import { computeClientTaskProgress } from './taskProgressMetrics';

const MOCK_CLIENTS: Client[] = [
  {
    id: 'cli_1',
    nomeCompleto: 'Ana Paula Costa',
    cpf: '111.111.111-11',
    email: 'ana@example.com',
    whatsapp: '+5511999990001',
    portalLiberado: true,
    statusAcessoPortal: 'Liberado',
    createdAt: '2026-01-01T10:00:00Z',
  },
  {
    id: 'cli_2',
    nomeCompleto: 'Carlos Eduardo Lima',
    cpf: '222.222.222-22',
    email: 'carlos@example.com',
    whatsapp: '+5511999990002',
    portalLiberado: true,
    statusAcessoPortal: 'Liberado',
    createdAt: '2026-01-02T10:00:00Z',
  },
];

const MOCK_CASES: Case[] = [
  {
    id: 'case_1',
    titulo: 'Mercosul Ana',
    clientId: 'cli_1',
    tipoServico: 'Residência Temporal',
    etapaPipeline: 8,
    statusSermig: 'Em trâmite',
    portalLiberado: true,
    relatorioViabilidadeLiberado: true,
    prioridade: 'Alta',
    createdAt: '2026-01-01T10:00:00Z',
  },
  {
    id: 'case_2',
    titulo: 'Trabalho Carlos',
    clientId: 'cli_2',
    tipoServico: 'Residência Temporal',
    etapaPipeline: 4,
    statusSermig: 'Não protocolado',
    portalLiberado: false,
    relatorioViabilidadeLiberado: false,
    prioridade: 'Média',
    createdAt: '2026-01-02T10:00:00Z',
  },
];

const MOCK_TASKS: Task[] = [
  { id: 't1', titulo: 'Apostilar RG', caseId: 'case_1', clientId: 'cli_1', prioridade: 'Alta', status: 'Concluída', createdAt: '2026-01-03T10:00:00Z' },
  { id: 't2', titulo: 'Emitir PF', caseId: 'case_1', clientId: 'cli_1', prioridade: 'Alta', status: 'Concluída', createdAt: '2026-01-03T10:00:00Z' },
  { id: 't3', titulo: 'Protocolar SERMIG', caseId: 'case_1', prioridade: 'Urgente', status: 'Em andamento', createdAt: '2026-01-04T10:00:00Z' },
  { id: 't4', titulo: 'Pagar taxa', clientId: 'cli_2', prioridade: 'Média', status: 'Pendente', createdAt: '2026-01-05T10:00:00Z' },
];

test('computeClientTaskProgress calculates consolidated completion percentages and per-client rows', () => {
  const overview = computeClientTaskProgress({
    tasks: MOCK_TASKS,
    cases: MOCK_CASES,
    clients: MOCK_CLIENTS,
  });

  assert.equal(overview.totalTasks, 4);
  assert.equal(overview.completedTasks, 2);
  assert.equal(overview.inProgressTasks, 1);
  assert.equal(overview.pendingTasks, 1);
  assert.equal(overview.concluidoPct, 50);
  assert.equal(overview.emAndamentoPct, 25);
  assert.equal(overview.pendentePct, 25);
  assert.equal(overview.rows.length, 2);
  assert.equal(overview.rows[0].clientName, 'Ana Paula Costa');
  assert.equal(overview.rows[0].concluidoPct, 67);
});

test('computeClientTaskProgress filters accurately when a specific case or client is selected', () => {
  const caseView = computeClientTaskProgress({
    tasks: MOCK_TASKS,
    cases: MOCK_CASES,
    clients: MOCK_CLIENTS,
    selectedCaseId: 'case_1',
  });

  assert.equal(caseView.totalTasks, 3);
  assert.equal(caseView.completedTasks, 2);
  assert.equal(caseView.inProgressTasks, 1);
  assert.equal(caseView.concluidoPct, 67);
  assert.match(caseView.stageSummary, /Etapa 8\/15/);

  const clientView = computeClientTaskProgress({
    tasks: MOCK_TASKS,
    cases: MOCK_CASES,
    clients: MOCK_CLIENTS,
    selectedClientId: 'cli_2',
  });

  assert.equal(clientView.totalTasks, 1);
  assert.equal(clientView.completedTasks, 0);
  assert.equal(clientView.pendentePct, 100);
});
