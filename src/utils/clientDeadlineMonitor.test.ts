import assert from 'node:assert/strict';
import test from 'node:test';
import type { Case, CaseDocument, Client, Deadline } from '../types/domain';
import {
  buildAutoAlertFingerprint,
  buildClientDeadlineMonitorSnapshot,
  clampClientAlertDays,
  DEFAULT_CLIENT_DEADLINE_ALERT_PREFS,
  formatDeadlineCountdownLabel,
  shouldAutoDispatchClientAlert,
} from './clientDeadlineMonitor';

const BASE_CLIENT: Client = {
  id: 'cli_1',
  nomeCompleto: 'Maria Silva',
  cpf: '12345678901',
  email: 'maria@example.com',
  whatsapp: '11999999999',
  passaporte: {
    numero: 'FZ123456',
    validade: '2026-06-10',
  },
  portalLiberado: true,
  statusAcessoPortal: 'Liberado',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const BASE_CASE: Case = {
  id: 'case_1',
  clientId: 'cli_1',
  titulo: 'Visto Residência Temporal — Mercosul',
  tipoServico: 'Residência Temporal',
  etapaPipeline: 4,
  statusSermig: 'Em trâmite',
  portalLiberado: true,
  relatorioViabilidadeLiberado: true,
  prioridade: 'Alta',
  dataVencimentoResidencia: '2026-05-25',
  createdAt: '2026-01-05T00:00:00.000Z',
};

const BASE_DOCS: CaseDocument[] = [
  {
    id: 'doc_1',
    caseId: 'case_1',
    clientId: 'cli_1',
    nomeDocumento: 'Antecedentes Criminais Polícia Federal',
    categoriaDoc: 'Antecedentes',
    etapaEsteira: '6 Aprovado para Protocolo',
    ordemEmissao: 1,
    pessoa: 'Titular',
    status: 'Aprovado',
    obrigatorio: true,
    validadeDias: 60,
    dataEmissao: '2026-03-20',
    dataValidadeCalculada: '2026-05-19',
    apostilado: true,
    traduzido: true,
    exigeApostila: true,
    exigeTraducao: true,
    peso: 1,
    versao: 1,
  },
  {
    id: 'doc_2',
    caseId: 'case_1',
    clientId: 'cli_1',
    nomeDocumento: 'Passaporte Brasileiro',
    categoriaDoc: 'Identidade',
    etapaEsteira: '6 Aprovado para Protocolo',
    ordemEmissao: 2,
    pessoa: 'Titular',
    status: 'Aprovado',
    obrigatorio: true,
    validadeDias: 3650,
    dataValidadeCalculada: '2026-06-10',
    apostilado: false,
    traduzido: false,
    exigeApostila: false,
    exigeTraducao: false,
    peso: 1,
    versao: 1,
  },
  {
    id: 'doc_3',
    caseId: 'case_1',
    clientId: 'cli_1',
    nomeDocumento: 'Certidão de Casamento',
    categoriaDoc: 'Familiares',
    etapaEsteira: '6 Aprovado para Protocolo',
    ordemEmissao: 3,
    pessoa: 'Titular',
    status: 'Aprovado',
    obrigatorio: true,
    validadeDias: 180,
    dataValidadeCalculada: '2026-10-15',
    apostilado: true,
    traduzido: true,
    exigeApostila: true,
    exigeTraducao: true,
    peso: 1,
    versao: 1,
  },
];

const BASE_DEADLINES: Deadline[] = [
  {
    id: 'dl_1',
    caseId: 'case_1',
    clientId: 'cli_1',
    tipo: 'Vencimento Cédula',
    titulo: 'Agendamento Emissão do RUT',
    dataLimite: '2026-05-05',
    concluido: false,
  },
];

test('clampClientAlertDays enforces 1..180 integer bounds', () => {
  assert.equal(clampClientAlertDays(15), 15);
  assert.equal(clampClientAlertDays(0), 1);
  assert.equal(clampClientAlertDays(999), 180);
  assert.equal(clampClientAlertDays('abc', 30), 30);
});

test('buildClientDeadlineMonitorSnapshot classifies items dynamically by alertDays threshold', () => {
  const refDate = new Date('2026-05-10T12:00:00Z');

  // With 20-day window: dl_1 (-5d expired), doc_1 (+9d in window), visto (+15d in window), passport (+31d upcoming), certidao (+158d upcoming)
  const snap20 = buildClientDeadlineMonitorSnapshot({
    client: BASE_CLIENT,
    cases: [BASE_CASE],
    docs: BASE_DOCS,
    deadlines: BASE_DEADLINES,
    alertDays: 20,
    referenceDate: refDate,
  });

  assert.equal(snap20.summary.expiredCount, 1);
  assert.equal(snap20.summary.inAlertWindowCount, 2);
  assert.equal(snap20.summary.upcomingCount, 2);
  assert.equal(snap20.summary.alertableCount, 3);

  // Expanding to 45 days moves passport (+31d) into alert window
  const snap45 = buildClientDeadlineMonitorSnapshot({
    client: BASE_CLIENT,
    cases: [BASE_CASE],
    docs: BASE_DOCS,
    deadlines: BASE_DEADLINES,
    alertDays: 45,
    referenceDate: refDate,
  });

  assert.equal(snap45.summary.expiredCount, 1);
  assert.equal(snap45.summary.inAlertWindowCount, 3);
  assert.equal(snap45.summary.upcomingCount, 1);
  assert.equal(snap45.summary.alertableCount, 4);
});

test('shouldAutoDispatchClientAlert respects enabled flag, smtp status, and cooldown deduplication', () => {
  const refDate = new Date('2026-05-10T12:00:00Z');
  const snap = buildClientDeadlineMonitorSnapshot({
    client: BASE_CLIENT,
    cases: [BASE_CASE],
    docs: BASE_DOCS,
    deadlines: BASE_DEADLINES,
    alertDays: 30,
    referenceDate: refDate,
  });

  const fp = buildAutoAlertFingerprint(snap.alertableReminders, 30);
  const nowMs = Date.parse('2026-05-10T12:00:00Z');

  assert.equal(
    shouldAutoDispatchClientAlert({
      prefs: DEFAULT_CLIENT_DEADLINE_ALERT_PREFS,
      alertableReminders: snap.alertableReminders,
      smtpConfigured: true,
      nowMs,
    }),
    true,
  );

  // Within 24h cooldown with same fingerprint -> false
  assert.equal(
    shouldAutoDispatchClientAlert({
      prefs: {
        ...DEFAULT_CLIENT_DEADLINE_ALERT_PREFS,
        lastAutoAlertAt: '2026-05-10T02:00:00Z',
        lastAutoAlertFingerprint: fp,
      },
      alertableReminders: snap.alertableReminders,
      smtpConfigured: true,
      nowMs,
    }),
    false,
  );

  // Disabled -> false
  assert.equal(
    shouldAutoDispatchClientAlert({
      prefs: { ...DEFAULT_CLIENT_DEADLINE_ALERT_PREFS, enabled: false },
      alertableReminders: snap.alertableReminders,
      smtpConfigured: true,
      nowMs,
    }),
    false,
  );
});

test('formatDeadlineCountdownLabel formats Brazilian Portuguese labels cleanly', () => {
  assert.equal(formatDeadlineCountdownLabel(-4), 'Vencido há 4 dias');
  assert.equal(formatDeadlineCountdownLabel(-1), 'Vencido ontem');
  assert.equal(formatDeadlineCountdownLabel(0), 'Vence hoje');
  assert.equal(formatDeadlineCountdownLabel(1), 'Vence amanhã');
  assert.equal(formatDeadlineCountdownLabel(12), 'Faltam 12 dias');
});
