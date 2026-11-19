import nodemailer from 'nodemailer';
import type { CommunicationLog } from '../src/types/domain.ts';
import type { ExpirationSeverity } from '../src/utils/documentExpiration.ts';
import { formatDateBR } from '../src/utils/formatters.ts';

export interface SmtpRuntimeConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
  cooldownDays: number;
  configured: boolean;
}

export interface EmailReminderItemPayload {
  docId: string;
  caseId: string;
  caseTitle: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  nomeDocumento: string;
  pessoa: string;
  obrigatorio: boolean;
  status: string;
  severity: ExpirationSeverity;
  daysRemaining: number | null;
  dataEmissao?: string;
  dataValidadeEfetiva?: string;
  dataValidadeBR: string;
  statusLabel: string;
}

export interface EmailTransportLike {
  sendMail(mailOptions: {
    from: string;
    to: string;
    cc?: string;
    replyTo?: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<{ messageId?: string }>;
}

export interface EmailDispatchBatchInput {
  items: EmailReminderItemPayload[];
  communicationLogs?: CommunicationLog[];
  brandName?: string;
  portalUrl?: string;
  copyConsultantEmail?: string;
  forceSend?: boolean;
  previewOnly?: boolean;
  staffUid?: string;
  staffName?: string;
  rawToken?: string;
  projectId?: string;
  databaseId?: string;
  now?: Date;
  smtpOverride?: SmtpRuntimeConfig;
  transporterOverride?: EmailTransportLike;
}

export interface EmailDispatchItemOutcome {
  docId: string;
  clientEmail: string;
  status: 'sent' | 'preview' | 'skipped_cooldown' | 'skipped_no_email' | 'failed';
  reason?: string;
  messageId?: string;
}

export interface EmailDispatchBatchResult {
  ok: boolean;
  smtpConfigured: boolean;
  sentEmails: number;
  coveredDocs: number;
  skippedCooldown: number;
  skippedNoEmail: number;
  failedCount: number;
  warning?: string;
  previewHtml?: string;
  previewSubject?: string;
  previewTo?: string;
  outcomes: EmailDispatchItemOutcome[];
  createdLogs: CommunicationLog[];
}

export function getSmtpConfigFromEnv(env: Record<string, string | undefined> = process.env): SmtpRuntimeConfig {
  const host = (env.SMTP_HOST || '').trim();
  const portRaw = Number(env.SMTP_PORT || '587');
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 587;
  const secureEnv = (env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureEnv === 'true' || secureEnv === '1' || port === 465;
  const user = (env.SMTP_USER || '').trim();
  const pass = (env.SMTP_PASS || '').trim();
  const from = (env.SMTP_FROM || (user ? `D&M Integra Chile <${user}>` : 'D&M Integra Chile <noreply@dmintegrachile.com>')).trim();
  const replyTo = (env.SMTP_REPLY_TO || '').trim() || undefined;
  const cooldownRaw = Number(env.EXPIRATION_EMAIL_COOLDOWN_DAYS || '7');
  const cooldownDays = Number.isFinite(cooldownRaw) && cooldownRaw >= 1 ? Math.round(cooldownRaw) : 7;

  const configured = Boolean(host && user && pass);
  return {
    host,
    port,
    secure,
    user,
    pass,
    from,
    replyTo,
    cooldownDays,
    configured,
  };
}

export function isValidEmailAddress(email?: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isReminderInEmailCooldown(params: {
  docId: string;
  caseId?: string;
  nomeDocumento?: string;
  severity: ExpirationSeverity;
  communicationLogs: CommunicationLog[];
  cooldownDays?: number;
  now?: Date;
}): { inCooldown: boolean; lastSentAt?: string; effectiveCooldownDays: number } {
  const {
    docId,
    caseId,
    nomeDocumento,
    severity,
    communicationLogs,
    cooldownDays = 7,
    now = new Date(),
  } = params;

  const effectiveCooldownDays =
    severity === 'vencido' || severity === 'critico' ? Math.min(cooldownDays, 2) : cooldownDays;

  const matching = communicationLogs
    .filter((log) => {
      if (log.canal !== 'E-mail') return false;
      if (log.documentId && log.documentId === docId) return true;
      if (
        caseId &&
        nomeDocumento &&
        log.caseId === caseId &&
        (log.assunto || '').includes('Vencimento') &&
        (log.assunto || '').includes(nomeDocumento)
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  const latest = matching[0];
  if (!latest?.createdAt) {
    return { inCooldown: false, effectiveCooldownDays };
  }

  const parsedMs = Date.parse(latest.createdAt);
  if (!Number.isFinite(parsedMs)) {
    return { inCooldown: false, effectiveCooldownDays };
  }

  const diffDays = (now.getTime() - parsedMs) / 86400000;
  return {
    inCooldown: diffDays < effectiveCooldownDays,
    lastSentAt: latest.createdAt,
    effectiveCooldownDays,
  };
}

export function buildExpirationEmailTemplate(params: {
  brandName: string;
  clientName: string;
  caseTitle: string;
  items: EmailReminderItemPayload[];
  portalUrl?: string;
  replyTo?: string;
}): { subject: string; html: string; text: string } {
  const { brandName, clientName, caseTitle, items, portalUrl = '', replyTo } = params;
  const safeBrand = escapeHtml(brandName || 'D&M Integra Chile – Relocation & Assessoria');
  const safeClient = escapeHtml(clientName || 'Cliente');
  const safeCase = escapeHtml(caseTitle || 'Processo Migratório');

  const hasUrgent = items.some((i) => i.severity === 'vencido' || i.severity === 'critico');
  const subject =
    items.length === 1
      ? `${hasUrgent ? '[URGENTE] ' : ''}Lembrete de Vencimento: ${items[0].nomeDocumento} — ${brandName}`
      : `${hasUrgent ? '[URGENTE] ' : ''}Lembrete de Vencimento (${items.length} documentos) — ${brandName}`;

  const rowsHtml = items
    .map((item) => {
      const badgeColor =
        item.severity === 'vencido' || item.severity === 'critico' ? '#B91C1C' : '#B45309';
      const badgeBg =
        item.severity === 'vencido' || item.severity === 'critico' ? '#FEF2F2' : '#FFFBEB';
      const reqLabel = item.obrigatorio ? 'Obrigatório' : 'Complementar';
      const emissaoBr = item.dataEmissao ? formatDateBR(item.dataEmissao) : '—';
      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;vertical-align:top;">
            <div style="font-weight:700;color:#0F172A;font-size:14px;">${escapeHtml(item.nomeDocumento)}</div>
            <div style="font-size:12px;color:#64748B;margin-top:2px;">Titular/Pessoa: ${escapeHtml(item.pessoa)} · ${reqLabel}</div>
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#334155;white-space:nowrap;vertical-align:top;">
            <div>Emissão: ${escapeHtml(emissaoBr)}</div>
            <div style="font-weight:700;color:#0F172A;margin-top:2px;">Validade: ${escapeHtml(item.dataValidadeBR)}</div>
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #E2E8F0;vertical-align:top;text-align:right;">
            <span style="display:inline-block;padding:4px 9px;border-radius:6px;background:${badgeBg};color:${badgeColor};font-weight:700;font-size:12px;white-space:nowrap;">
              ${escapeHtml(item.statusLabel)}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  const portalSectionHtml = portalUrl
    ? `<div style="margin:24px 0 8px 0;">
        <a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:#0F2537;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;">
          Acessar Portal do Cliente
        </a>
      </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;color:#0F172A;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F1F5F9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E2E8F0;">
          <tr>
            <td style="height:6px;background:linear-gradient(90deg,#0F2537 75%,#D4AF37 75%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #E2E8F0;background:#0F2537;color:#FFFFFF;">
              <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#D4AF37;font-weight:700;">
                Lembrete Automático de Vencimento (&lt; 30 dias)
              </div>
              <div style="font-size:20px;font-weight:800;margin-top:4px;color:#FFFFFF;">
                ${safeBrand}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;">
                Olá, <strong>${safeClient}</strong>,
              </p>
              <p style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:#334155;">
                Identificamos no processo <strong>${safeCase}</strong> ${items.length === 1 ? 'um documento exigido com validade vencida ou próxima do vencimento (menos de 30 dias)' : `${items.length} documentos exigidos com validade vencida ou próxima do vencimento (menos de 30 dias)`}. Recomendamos providenciar a reemissão ou o envio da versão atualizada para evitar atrasos junto ao SERMIG.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;border-collapse:collapse;">
                <thead>
                  <tr style="background:#F8FAFC;border-bottom:1px solid #CBD5E1;">
                    <th align="left" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;">Documento</th>
                    <th align="left" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;">Datas</th>
                    <th align="right" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#475569;">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>

              ${portalSectionHtml}

              <p style="margin:18px 0 0 0;font-size:12.5px;line-height:1.5;color:#64748B;">
                Caso você já tenha reemitido ou apostilado ${items.length === 1 ? 'este documento' : 'estes documentos'}, basta anexar o novo arquivo diretamente no Portal do Cliente${replyTo ? ` ou responder a este e-mail (${escapeHtml(replyTo)})` : ''}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;">
              ${safeBrand} · Notificação automática de acompanhamento documental.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const lines = [
    `${brandName} — Lembrete de Vencimento (< 30 dias)`,
    '',
    `Olá, ${clientName || 'Cliente'},`,
    `No processo "${caseTitle || 'Processo Migratório'}", identificamos o(s) seguinte(s) documento(s) com vencimento próximo ou vencido:`,
    '',
    ...items.map(
      (i) =>
        `- ${i.nomeDocumento} (${i.pessoa}): ${i.statusLabel} | Validade: ${i.dataValidadeBR}`,
    ),
    '',
    portalUrl ? `Envie o documento atualizado pelo Portal do Cliente: ${portalUrl}` : 'Envie o documento atualizado pelo Portal do Cliente.',
  ];

  return { subject, html, text: lines.join('\n') };
}

export function createNodemailerTransporter(config: SmtpRuntimeConfig): EmailTransportLike {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

async function persistCommunicationLogViaRest(params: {
  log: CommunicationLog;
  rawToken: string;
  projectId: string;
  databaseId: string;
}): Promise<boolean> {
  const { log, rawToken, projectId, databaseId } = params;
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/communicationLogs?documentId=${encodeURIComponent(log.id)}`;
  const fields: Record<string, unknown> = {
    id: { stringValue: log.id },
    canal: { stringValue: 'E-mail' },
    assunto: { stringValue: log.assunto.slice(0, 250) },
    mensagem: { stringValue: log.mensagem.slice(0, 5000) },
    lidaPelaEquipe: { booleanValue: true },
    lidaPeloCliente: { booleanValue: false },
    createdAt: { stringValue: log.createdAt },
  };
  if (log.clientId) fields.clientId = { stringValue: log.clientId };
  if (log.caseId) fields.caseId = { stringValue: log.caseId };
  if (log.autorNome) fields.autorNome = { stringValue: log.autorNome.slice(0, 200) };
  if (log.origem) fields.origem = { stringValue: log.origem };
  if (log.remetenteUid) fields.remetenteUid = { stringValue: log.remetenteUid };
  if (log.documentId) fields.documentId = { stringValue: log.documentId };
  if (log.documentNome) fields.documentNome = { stringValue: log.documentNome.slice(0, 250) };

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rawToken}`,
      },
      body: JSON.stringify({ fields }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function dispatchExpirationReminderEmails(
  input: EmailDispatchBatchInput,
): Promise<EmailDispatchBatchResult> {
  const now = input.now ?? new Date();
  const smtp = input.smtpOverride ?? getSmtpConfigFromEnv();
  const brandName = (input.brandName || 'D&M Integra Chile – Relocation & Assessoria').trim();
  const communicationLogs = input.communicationLogs || [];

  const eligibleItems = input.items.filter(
    (i) => i.severity === 'vencido' || i.severity === 'critico' || i.severity === 'atencao',
  );

  const outcomes: EmailDispatchItemOutcome[] = [];
  const toSend: EmailReminderItemPayload[] = [];

  let skippedCooldown = 0;
  let skippedNoEmail = 0;

  for (const item of eligibleItems) {
    if (!isValidEmailAddress(item.clientEmail)) {
      skippedNoEmail += 1;
      outcomes.push({
        docId: item.docId,
        clientEmail: item.clientEmail || '',
        status: 'skipped_no_email',
        reason: 'Cliente sem e-mail válido cadastrado.',
      });
      continue;
    }

    if (!input.forceSend && !input.previewOnly) {
      const cd = isReminderInEmailCooldown({
        docId: item.docId,
        caseId: item.caseId,
        nomeDocumento: item.nomeDocumento,
        severity: item.severity,
        communicationLogs,
        cooldownDays: smtp.cooldownDays,
        now,
      });
      if (cd.inCooldown) {
        skippedCooldown += 1;
        outcomes.push({
          docId: item.docId,
          clientEmail: item.clientEmail,
          status: 'skipped_cooldown',
          reason: `Lembrete já enviado recentemente (intervalo de ${cd.effectiveCooldownDays} dias).`,
        });
        continue;
      }
    }

    toSend.push(item);
  }

  // Agrupa por (clientEmail + caseId) para enviar 1 e-mail consolidado e elegante por processo
  const grouped = new Map<string, EmailReminderItemPayload[]>();
  for (const item of toSend) {
    const key = `${item.clientEmail.trim().toLowerCase()}::${item.caseId}`;
    const bucket = grouped.get(key) || [];
    bucket.push(item);
    grouped.set(key, bucket);
  }

  if (input.previewOnly) {
    const previewSource = toSend.length > 0 ? Array.from(grouped.values())[0] : eligibleItems.slice(0, 3);
    if (previewSource.length === 0) {
      return {
        ok: false,
        smtpConfigured: smtp.configured,
        sentEmails: 0,
        coveredDocs: 0,
        skippedCooldown,
        skippedNoEmail,
        failedCount: 0,
        warning: 'Não há documentos com vencimento menor que 30 dias para pré-visualizar.',
        outcomes,
        createdLogs: [],
      };
    }
    const tpl = buildExpirationEmailTemplate({
      brandName,
      clientName: previewSource[0].clientName,
      caseTitle: previewSource[0].caseTitle,
      items: previewSource,
      portalUrl: input.portalUrl,
      replyTo: smtp.replyTo,
    });
    return {
      ok: true,
      smtpConfigured: smtp.configured,
      sentEmails: 0,
      coveredDocs: previewSource.length,
      skippedCooldown,
      skippedNoEmail,
      failedCount: 0,
      previewHtml: tpl.html,
      previewSubject: tpl.subject,
      previewTo: previewSource[0].clientEmail || '(sem e-mail cadastrado)',
      outcomes: previewSource.map((i) => ({
        docId: i.docId,
        clientEmail: i.clientEmail,
        status: 'preview',
      })),
      createdLogs: [],
    };
  }

  if (toSend.length === 0) {
    return {
      ok: true,
      smtpConfigured: smtp.configured,
      sentEmails: 0,
      coveredDocs: 0,
      skippedCooldown,
      skippedNoEmail,
      failedCount: 0,
      warning:
        skippedCooldown > 0
          ? 'Todos os lembretes elegíveis já receberam e-mail recentemente dentro da janela de controle.'
          : 'Nenhum documento elegível com e-mail válido para envio neste momento.',
      outcomes,
      createdLogs: [],
    };
  }

  if (!smtp.configured && !input.transporterOverride) {
    return {
      ok: false,
      smtpConfigured: false,
      sentEmails: 0,
      coveredDocs: 0,
      skippedCooldown,
      skippedNoEmail,
      failedCount: 0,
      warning:
        'Serviço SMTP do Nodemailer ainda não configurado no ambiente (defina SMTP_HOST, SMTP_USER e SMTP_PASS nos segredos do servidor). Use "Pré-visualizar E-mail" para validar o modelo.',
      outcomes,
      createdLogs: [],
    };
  }

  const transporter = input.transporterOverride ?? createNodemailerTransporter(smtp);
  const createdLogs: CommunicationLog[] = [];
  let sentEmails = 0;
  let coveredDocs = 0;
  let failedCount = 0;

  for (const [, groupItems] of grouped.entries()) {
    const first = groupItems[0];
    const tpl = buildExpirationEmailTemplate({
      brandName,
      clientName: first.clientName,
      caseTitle: first.caseTitle,
      items: groupItems,
      portalUrl: input.portalUrl,
      replyTo: smtp.replyTo,
    });

    try {
      const ccTarget =
        input.copyConsultantEmail &&
        isValidEmailAddress(input.copyConsultantEmail) &&
        input.copyConsultantEmail.trim().toLowerCase() !== first.clientEmail.trim().toLowerCase()
          ? input.copyConsultantEmail.trim()
          : undefined;

      const info = await transporter.sendMail({
        from: smtp.from,
        to: first.clientEmail.trim(),
        cc: ccTarget,
        replyTo: smtp.replyTo,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
      });

      sentEmails += 1;
      coveredDocs += groupItems.length;
      const nowIso = now.toISOString();

      for (const item of groupItems) {
        outcomes.push({
          docId: item.docId,
          clientEmail: item.clientEmail,
          status: 'sent',
          messageId: info.messageId,
        });

        const logId = `comm_email_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const logEntry: CommunicationLog = {
          id: logId,
          clientId: item.clientId,
          caseId: item.caseId,
          canal: 'E-mail',
          assunto: `Lembrete de Vencimento: ${item.nomeDocumento}`,
          mensagem: `E-mail automático enviado para ${item.clientEmail} (${item.statusLabel} · Validade: ${item.dataValidadeBR}).`,
          autorNome: input.staffName || 'Automação de E-mails (Nodemailer)',
          origem: 'equipe',
          remetenteUid: input.staffUid,
          documentId: item.docId,
          documentNome: item.nomeDocumento,
          lidaPelaEquipe: true,
          lidaPeloCliente: false,
          createdAt: nowIso,
        };

        if (input.rawToken && input.projectId && input.databaseId) {
          await persistCommunicationLogViaRest({
            log: logEntry,
            rawToken: input.rawToken,
            projectId: input.projectId,
            databaseId: input.databaseId,
          });
        }

        createdLogs.push(logEntry);
      }
    } catch (err) {
      failedCount += groupItems.length;
      const reason = err instanceof Error ? err.message : 'Falha SMTP ao enviar lembrete.';
      for (const item of groupItems) {
        outcomes.push({
          docId: item.docId,
          clientEmail: item.clientEmail,
          status: 'failed',
          reason,
        });
      }
    }
  }

  return {
    ok: failedCount === 0,
    smtpConfigured: true,
    sentEmails,
    coveredDocs,
    skippedCooldown,
    skippedNoEmail,
    failedCount,
    outcomes,
    createdLogs,
  };
}
