import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Case, Client, CommunicationLog } from '../src/types/domain';
import { collectExpirationReminders } from '../src/utils/documentExpiration';
import {
  buildExpirationEmailTemplate,
  dispatchExpirationReminderEmails,
  getSmtpConfigFromEnv,
  isReminderInEmailCooldown,
  verifySmtpConnection,
  type EmailReminderItemPayload,
  type EmailTransportLike,
} from './emailReminderService';

function makeItem(overrides: Partial<EmailReminderItemPayload> = {}): EmailReminderItemPayload {
  return {
    docId: 'doc_ant_1',
    itemKind: 'documento',
    caseId: 'case_1',
    caseTitle: 'Residência Mercosul — João',
    clientId: 'cli_1',
    clientName: 'João Silva',
    clientEmail: 'joao@example.com',
    nomeDocumento: 'Certidão de Antecedentes PF',
    pessoa: 'Titular',
    obrigatorio: true,
    status: 'Aprovado',
    severity: 'atencao',
    daysRemaining: 14,
    dataEmissao: '2026-09-01',
    dataValidadeEfetiva: '2026-12-02',
    dataValidadeBR: '02/12/2026',
    statusLabel: 'Expira em 14 dias',
    ...overrides,
  };
}

describe('emailReminderService — Nodemailer 30-Day Visa & Document Expiration Alerts', () => {
  it('parses SMTP env configuration including EXPIRATION_ALERT_DAYS defaulting to 30', () => {
    const emptyCfg = getSmtpConfigFromEnv({});
    assert.equal(emptyCfg.configured, false);
    assert.equal(emptyCfg.port, 587);
    assert.equal(emptyCfg.cooldownDays, 7);
    assert.equal(emptyCfg.alertDays, 30);

    const activeCfg = getSmtpConfigFromEnv({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USER: 'contato@dmintegrachile.com',
      SMTP_PASS: 'app-password',
      EXPIRATION_EMAIL_COOLDOWN_DAYS: '5',
      EXPIRATION_ALERT_DAYS: '30',
    });
    assert.equal(activeCfg.configured, true);
    assert.equal(activeCfg.secure, true);
    assert.equal(activeCfg.cooldownDays, 5);
    assert.equal(activeCfg.alertDays, 30);
  });

  it('triggers visa expiration alert inclusively at 30 days and excludes 31 days', () => {
    const hoje = new Date('2026-11-01T12:00:00.000Z');
    const clients: Client[] = [
      {
        id: 'cli_1',
        nomeCompleto: 'Mariana Costa',
        cpf: '000.000.000-00',
        email: 'mariana@example.com',
        whatsapp: '+55 11 99999-0000',
        nacionalidade: 'Brasileira',
        portalLiberado: true,
        statusAcessoPortal: 'Liberado',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];
    const cases: Case[] = [
      {
        id: 'case_30d',
        clientId: 'cli_1',
        titulo: 'Residência Temporal Mercosul',
        tipoServico: 'Residência Temporal',
        statusSermig: 'Em trâmite',
        etapaPipeline: 12,
        portalLiberado: true,
        relatorioViabilidadeLiberado: true,
        prioridade: 'Alta',
        dataVencimentoResidencia: '2026-12-01', // exactly 30 days ahead
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'case_31d',
        clientId: 'cli_1',
        titulo: 'Residência 31 dias',
        tipoServico: 'Residência Temporal',
        statusSermig: 'Em trâmite',
        etapaPipeline: 12,
        portalLiberado: true,
        relatorioViabilidadeLiberado: true,
        prioridade: 'Média',
        dataVencimentoResidencia: '2026-12-02', // 31 days ahead -> outside 30-day window
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const summary = collectExpirationReminders({
      docs: [],
      cases,
      clients,
      hoje,
      warningDays: 30,
    });

    assert.equal(summary.expiringItems.length, 1);
    assert.equal(summary.counts.vistosAlerta, 1);
    assert.equal(summary.expiringItems[0].itemKind, 'visto');
    assert.equal(summary.expiringItems[0].caseObj.id, 'case_30d');
    assert.equal(summary.expiringItems[0].daysRemaining, 30);
  });

  it('renders dedicated 30-day visa subject prefix and escapes HTML safely', () => {
    const visaTpl = buildExpirationEmailTemplate({
      brandName: 'D&M Integra Chile – Relocation & Assessoria',
      clientName: 'Ana <Script>',
      caseTitle: 'Residência Temporal',
      items: [
        makeItem({
          docId: 'visa_exp_case_1',
          itemKind: 'visto',
          nomeDocumento: 'Vencimento do Visto / Residência (Residência Temporal)',
          severity: 'atencao',
          daysRemaining: 30,
          statusLabel: 'Expira em 30 dias',
        }),
      ],
      portalUrl: 'https://example.com/portal',
    });

    assert.match(visaTpl.subject, /\[ALERTA DE VISTO · 30 DIAS\]/);
    assert.match(visaTpl.html, /D&amp;M Integra Chile/);
    assert.match(visaTpl.html, /Ana &lt;Script&gt;/);
    assert.ok(!visaTpl.html.includes('<Script>'));
    assert.match(visaTpl.html, /Expira em 30 dias/);
    assert.match(visaTpl.text, /Vencimento do Visto/);
  });

  it('enforces cooldown deduplication (7d normal, 2d critical) and allows forceSend bypass', async () => {
    const now = new Date('2026-11-18T12:00:00.000Z');
    const recentLogs: CommunicationLog[] = [
      {
        id: 'log_1',
        clientId: 'cli_1',
        caseId: 'case_1',
        canal: 'E-mail',
        assunto: 'Lembrete de Vencimento: Certidão de Antecedentes PF',
        mensagem: 'Enviado anteriormente',
        autorNome: 'Equipe D&M Integra Chile',
        documentId: 'doc_ant_1',
        createdAt: '2026-11-15T12:00:00.000Z',
      },
    ];

    const cdNormal = isReminderInEmailCooldown({
      docId: 'doc_ant_1',
      severity: 'atencao',
      communicationLogs: recentLogs,
      cooldownDays: 7,
      now,
    });
    assert.equal(cdNormal.inCooldown, true);

    const cdCrit = isReminderInEmailCooldown({
      docId: 'doc_ant_1',
      severity: 'critico',
      communicationLogs: recentLogs,
      cooldownDays: 7,
      now,
    });
    assert.equal(cdCrit.inCooldown, false);

    const sentCalls: Array<{ to: string; subject: string }> = [];
    const mockTransport: EmailTransportLike = {
      async sendMail(opts) {
        sentCalls.push({ to: opts.to, subject: opts.subject });
        return { messageId: 'msg_123' };
      },
    };

    const skippedRes = await dispatchExpirationReminderEmails({
      items: [makeItem()],
      communicationLogs: recentLogs,
      now,
      transporterOverride: mockTransport,
      smtpOverride: getSmtpConfigFromEnv({
        SMTP_HOST: 'smtp.test.local',
        SMTP_USER: 'bot@test.local',
        SMTP_PASS: 'secret',
      }),
    });

    assert.equal(skippedRes.sentEmails, 0);
    assert.equal(skippedRes.skippedCooldown, 1);
    assert.equal(sentCalls.length, 0);

    const forcedRes = await dispatchExpirationReminderEmails({
      items: [makeItem(), makeItem({ docId: 'doc_pass_2', nomeDocumento: 'Passaporte' })],
      communicationLogs: recentLogs,
      forceSend: true,
      now,
      transporterOverride: mockTransport,
      smtpOverride: getSmtpConfigFromEnv({
        SMTP_HOST: 'smtp.test.local',
        SMTP_USER: 'bot@test.local',
        SMTP_PASS: 'secret',
      }),
    });

    assert.equal(forcedRes.ok, true);
    assert.equal(forcedRes.sentEmails, 1);
    assert.equal(forcedRes.coveredDocs, 2);
    assert.equal(forcedRes.createdLogs.length, 2);
    assert.equal(sentCalls.length, 1);
  });

  it('verifies SMTP connection status safely with mock transporter or unconfigured env', async () => {
    const unconfigured = await verifySmtpConnection({
      smtpOverride: getSmtpConfigFromEnv({}),
    });
    assert.equal(unconfigured.ok, false);
    assert.equal(unconfigured.smtpConfigured, false);

    const verified = await verifySmtpConnection({
      smtpOverride: getSmtpConfigFromEnv({
        SMTP_HOST: 'smtp.test.local',
        SMTP_USER: 'bot@test.local',
        SMTP_PASS: 'secret',
      }),
      transporterOverride: {
        async sendMail() {
          return { messageId: 'ok' };
        },
        async verify() {
          return true;
        },
      },
    });
    assert.equal(verified.ok, true);
    assert.equal(verified.smtpConfigured, true);
  });
});
