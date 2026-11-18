import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CommunicationLog } from '../src/types/domain';
import {
  buildExpirationEmailTemplate,
  dispatchExpirationReminderEmails,
  getSmtpConfigFromEnv,
  isReminderInEmailCooldown,
  type EmailReminderItemPayload,
  type EmailTransportLike,
} from './emailReminderService';

function makeItem(overrides: Partial<EmailReminderItemPayload> = {}): EmailReminderItemPayload {
  return {
    docId: 'doc_ant_1',
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

describe('emailReminderService — Nodemailer Expiration Reminders (< 30 days)', () => {
  it('parses SMTP env configuration safely without exposing unconfigured state as active', () => {
    const emptyCfg = getSmtpConfigFromEnv({});
    assert.equal(emptyCfg.configured, false);
    assert.equal(emptyCfg.port, 587);
    assert.equal(emptyCfg.cooldownDays, 7);

    const activeCfg = getSmtpConfigFromEnv({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '465',
      SMTP_USER: 'contato@dmintegrachile.com',
      SMTP_PASS: 'app-password',
      EXPIRATION_EMAIL_COOLDOWN_DAYS: '5',
    });
    assert.equal(activeCfg.configured, true);
    assert.equal(activeCfg.secure, true);
    assert.equal(activeCfg.cooldownDays, 5);
  });

  it('builds escaped PT-BR HTML email template with D&M branding and document table', () => {
    const tpl = buildExpirationEmailTemplate({
      brandName: 'D&M Integra Chile – Relocation & Assessoria',
      clientName: 'Ana <Script>',
      caseTitle: 'Residência Temporal',
      items: [makeItem({ severity: 'critico', daysRemaining: 3, statusLabel: 'Expira em 3 dias' })],
      portalUrl: 'https://example.com/portal',
    });

    assert.match(tpl.subject, /\[URGENTE\]/);
    assert.match(tpl.html, /D&amp;M Integra Chile/);
    assert.match(tpl.html, /Ana &lt;Script&gt;/);
    assert.ok(!tpl.html.includes('<Script>'));
    assert.match(tpl.html, /Expira em 3 dias/);
    assert.match(tpl.text, /Certidão de Antecedentes PF/);
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
        createdAt: '2026-11-15T12:00:00.000Z', // 3 days ago
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
    // 3 days ago > 2d critical cooldown -> ready to remind again
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
    // Grouped into 1 consolidated email for the same client+case
    assert.equal(forcedRes.sentEmails, 1);
    assert.equal(forcedRes.coveredDocs, 2);
    assert.equal(forcedRes.createdLogs.length, 2);
    assert.equal(sentCalls.length, 1);
  });

  it('returns preview HTML safely even when SMTP is not configured', async () => {
    const res = await dispatchExpirationReminderEmails({
      items: [makeItem()],
      previewOnly: true,
      smtpOverride: getSmtpConfigFromEnv({}),
    });

    assert.equal(res.ok, true);
    assert.equal(res.smtpConfigured, false);
    assert.ok(res.previewHtml && res.previewHtml.includes('Certidão de Antecedentes PF'));
  });
});
