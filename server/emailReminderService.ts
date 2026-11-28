import nodemailer from 'nodemailer';
import type { CommunicationLog } from '../src/types/domain.ts';
import type { ExpirationItemKind, ExpirationSeverity } from '../src/utils/documentExpiration.ts';
import { formatDateBR } from '../src/utils/formatters.ts';

export interface SmtpRuntimeConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
  alertDays: number;
  cooldownDays: number;
  configured: boolean;
}

export interface EmailReminderItemPayload {
  docId: string;
  itemKind?: ExpirationItemKind;
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
  verify?: () => Promise<unknown>;
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
  alertDaysOverride?: number;
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
  alertDays: number;
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

export interface SmtpVerificationResult {
  ok: boolean;
  smtpConfigured: boolean;
  hostLabel: string;
  port: number;
  secure: boolean;
  alertDays: number;
  cooldownDays: number;
  message: string;
}

export function getSmtpConfigFromEnv(env: Record<string, string | undefined> = process.env): SmtpRuntimeConfig {
  const host = (env.SMTP_HOST || '').trim();
  const portRaw = Number(env.SMTP_PORT || '587');
  const port = Number.isFinite(portRaw) && portRaw > 0 ? portRaw : 587;
  const secureEnv = (env.SMTP_SECURE || '').trim().toLowerCase();
  const secure = secureEnv === 'true' || secureEnv === '1' || port === 465;
  const user = (env.SMTP_USER || '').trim();
  const pass = (env.SMTP_PASS || '').trim();
  const from = (
    env.SMTP_FROM ||
    (user ? `D&M Integra Chile <${user}>` : 'D&M Integra Chile <noreply@dmintegrachile.com>')
  ).trim();
  const replyTo = (env.SMTP_REPLY_TO || '').trim() || undefined;
  const alertRaw = Number(env.EXPIRATION_ALERT_DAYS || '30');
  const alertDays = Number.isFinite(alertRaw) && alertRaw >= 1 && alertRaw <= 180 ? Math.round(alertRaw) : 30;
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
    alertDays,
    cooldownDays,
    configured,
  };
}

export function isValidEmailAddress(email?: string): boolean {
  if (!email) return false;
  const trimmed = email.trim();
  if (/[\r\n]/.test(trimmed) || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed);
}

export function sanitizeHeaderLine(raw: string): string {
  return String(raw || '').replace(/[\r\n]+/g, ' ').trim();
}

export function sanitizeHttpUrl(raw?: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
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
  alertDays?: number;
}): { subject: string; html: string; text: string } {
  const {
    brandName,
    clientName,
    caseTitle,
    items,
    portalUrl = '',
    replyTo,
    alertDays = 30,
  } = params;
  const safeBrand = escapeHtml(brandName || 'D&M Integra Chile – Relocation & Assessoria');
  const safeClient = escapeHtml(clientName || 'Cliente');
  const safeCase = escapeHtml(caseTitle || 'Processo Migratório');
  const cleanPortalUrl = sanitizeHttpUrl(portalUrl);

  const hasUrgent = items.some((i) => i.severity === 'vencido' || i.severity === 'critico');
  const hasVisaItem = items.some((i) => i.itemKind === 'visto' || i.itemKind === 'prazo_visto');
  const cleanBrandLine = sanitizeHeaderLine(brandName || 'D&M Integra Chile');
  const subjectPrefix = hasUrgent ? '[URGENTE] ' : hasVisaItem ? '[ALERTA DE VISTO · 30 DIAS] ' : '';

  const subject = sanitizeHeaderLine(
    items.length === 1
      ? `${subjectPrefix}Lembrete de Vencimento: ${items[0].nomeDocumento} — ${cleanBrandLine}`
      : `${subjectPrefix}Lembrete de Vencimento (${items.length} itens ≤ ${alertDays} dias) — ${cleanBrandLine}`,
  );

  const rowsHtml = items
    .map((item) => {
      const badgeColor =
        item.severity === 'vencido' || item.severity === 'critico' ? '#A61C2B' : '#8C6D14';
      const badgeBg =
        item.severity === 'vencido' || item.severity === 'critico' ? '#FEF2F2' : '#FEF9EC';
      const kindLabel =
        item.itemKind === 'visto'
          ? 'Visto / Residência'
          : item.itemKind === 'prazo_visto'
            ? 'Prazo Migratório'
            : item.obrigatorio
              ? 'Documento Obrigatório'
              : 'Documento Complementar';
      const emissaoBr = item.dataEmissao ? formatDateBR(item.dataEmissao) : '—';
      return `
        <tr>
          <td style="padding:12px 14px;border-bottom:1px solid #E5DFD2;vertical-align:top;">
            <div style="font-size:10px;letter-spacing:0.8px;text-transform:uppercase;color:${
              item.itemKind === 'visto' || item.itemKind === 'prazo_visto' ? '#146B43' : '#8C6D14'
            };font-weight:700;margin-bottom:3px;">${escapeHtml(kindLabel)}</div>
            <div style="font-weight:700;color:#0B1F33;font-size:14px;">${escapeHtml(item.nomeDocumento)}</div>
            <div style="font-size:12px;color:#4A5A6D;margin-top:2px;">Titular/Pessoa: ${escapeHtml(item.pessoa)}</div>
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #E5DFD2;font-size:13px;color:#334155;white-space:nowrap;vertical-align:top;">
            <div>Emissão/Ref.: ${escapeHtml(emissaoBr)}</div>
            <div style="font-weight:700;color:#0B1F33;margin-top:2px;">Validade: ${escapeHtml(item.dataValidadeBR)}</div>
          </td>
          <td style="padding:12px 14px;border-bottom:1px solid #E5DFD2;vertical-align:top;text-align:right;">
            <span style="display:inline-block;padding:4px 9px;border-radius:6px;background:${badgeBg};color:${badgeColor};font-weight:700;font-size:12px;white-space:nowrap;border:1px solid ${badgeColor}33;">
              ${escapeHtml(item.statusLabel)}
            </span>
          </td>
        </tr>
      `;
    })
    .join('');

  const portalSectionHtml = cleanPortalUrl
    ? `<div style="margin:24px 0 8px 0;">
        <a href="${escapeHtml(cleanPortalUrl)}" style="display:inline-block;background:#0B1F33;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:8px;border-bottom:2px solid #C8A236;">
          Acessar Portal do Cliente
        </a>
      </div>`
    : '';

  const introContext = hasVisaItem
    ? `Identificamos no processo <strong>${safeCase}</strong> alerta(s) crítico(s) de vencimento de visto, residência ou documento dentro da janela preventiva de <strong>${alertDays} dias</strong>. Recomendamos iniciar imediatamente os procedimentos de prorrogação, emissão ou envio no Portal do Cliente para preservar sua regularidade junto ao SERMIG (Chile).`
    : `Identificamos no processo <strong>${safeCase}</strong> ${
        items.length === 1
          ? `um documento exigido com validade vencida ou expirando dentro de ${alertDays} dias`
          : `${items.length} documentos exigidos com validade vencida ou expirando dentro de ${alertDays} dias`
      }. Recomendamos providenciar a reemissão ou o envio da versão atualizada para evitar atrasos junto ao SERMIG.`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#F7F5F0;font-family:'Plus Jakarta Sans',Arial,Helvetica,sans-serif;color:#0B1523;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F5F0;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;width:100%;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E5DFD2;">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#146B43 0%,#146B43 24%,#C8A236 24%,#C8A236 42%,#0B1F33 42%,#0B1F33 78%,#A61C2B 78%,#A61C2B 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:24px 28px;border-bottom:1px solid #1C324B;background:#0B1F33;color:#FFFFFF;">
              <div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;color:#E5C76B;font-weight:700;">
                Alerta Preventivo Automático · Janela de ${alertDays} Dias
              </div>
              <div style="font-size:21px;font-weight:800;margin-top:4px;color:#FFFFFF;font-family:Georgia,serif;">
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
                ${introContext}
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E5DFD2;border-radius:8px;overflow:hidden;border-collapse:collapse;">
                <thead>
                  <tr style="background:#FAF9F6;border-bottom:1px solid #E5DFD2;">
                    <th align="left" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#4A5A6D;">Item / Documento</th>
                    <th align="left" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#4A5A6D;">Datas</th>
                    <th align="right" style="padding:10px 14px;font-size:11px;text-transform:uppercase;letter-spacing:0.6px;color:#4A5A6D;">Prazo</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>

              ${portalSectionHtml}

              <p style="margin:18px 0 0 0;font-size:12.5px;line-height:1.5;color:#4A5A6D;">
                Caso você já tenha renovado, reemitido ou apostilado ${items.length === 1 ? 'este item' : 'estes itens'}, basta anexar o novo arquivo diretamente no Portal do Cliente${replyTo ? ` ou responder a este e-mail (${escapeHtml(replyTo)})` : ''}.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 28px;background:#FAF9F6;border-top:1px solid #E5DFD2;font-size:11px;color:#64748B;">
              ${safeBrand} · Monitoramento automático de vistos e prazos migratórios (SERMIG · Ley Nº 21.325).
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const lines = [
    `${brandName} — Alerta Preventivo de Vencimento (≤ ${alertDays} dias)`,
    '',
    `Olá, ${clientName || 'Cliente'},`,
    `No processo "${caseTitle || 'Processo Migratório'}", identificamos o(s) seguinte(s) visto(s)/documento(s) com vencimento em até ${alertDays} dias ou vencidos:`,
    '',
    ...items.map(
      (i) =>
        `- [${i.itemKind === 'visto' ? 'VISTO' : i.itemKind === 'prazo_visto' ? 'PRAZO' : 'DOC'}] ${i.nomeDocumento} (${i.pessoa}): ${i.statusLabel} | Validade: ${i.dataValidadeBR}`,
    ),
    '',
    cleanPortalUrl
      ? `Envie a atualização pelo Portal do Cliente: ${cleanPortalUrl}`
      : 'Envie a atualização pelo Portal do Cliente.',
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

export async function verifySmtpConnection(params?: {
  smtpOverride?: SmtpRuntimeConfig;
  transporterOverride?: EmailTransportLike;
}): Promise<SmtpVerificationResult> {
  const smtp = params?.smtpOverride ?? getSmtpConfigFromEnv();
  const hostLabel = smtp.host ? `${smtp.host}:${smtp.port}` : 'Não configurado';

  if (!smtp.configured && !params?.transporterOverride) {
    return {
      ok: false,
      smtpConfigured: false,
      hostLabel,
      port: smtp.port,
      secure: smtp.secure,
      alertDays: smtp.alertDays,
      cooldownDays: smtp.cooldownDays,
      message:
        'Defina SMTP_HOST, SMTP_USER e SMTP_PASS nos segredos do servidor (conforme .env.example) para habilitar o envio real pelo Nodemailer.',
    };
  }

  const transporter = params?.transporterOverride ?? createNodemailerTransporter(smtp);
  try {
    if (typeof transporter.verify === 'function') {
      await transporter.verify();
    }
    return {
      ok: true,
      smtpConfigured: true,
      hostLabel,
      port: smtp.port,
      secure: smtp.secure,
      alertDays: smtp.alertDays,
      cooldownDays: smtp.cooldownDays,
      message: `Conexão SMTP validada com sucesso (${hostLabel}). Alertas automáticos configurados para ≤ ${smtp.alertDays} dias antes do vencimento.`,
    };
  } catch (err) {
    return {
      ok: false,
      smtpConfigured: smtp.configured,
      hostLabel,
      port: smtp.port,
      secure: smtp.secure,
      alertDays: smtp.alertDays,
      cooldownDays: smtp.cooldownDays,
      message:
        err instanceof Error
          ? `Falha na autenticação/conexão SMTP: ${err.message}`
          : 'Não foi possível validar a conexão com o servidor SMTP.',
    };
  }
}

export async function sendTestExpirationEmail(params: {
  toEmail: string;
  brandName?: string;
  portalUrl?: string;
  smtpOverride?: SmtpRuntimeConfig;
  transporterOverride?: EmailTransportLike;
}): Promise<{ ok: boolean; smtpConfigured: boolean; message: string; messageId?: string }> {
  const smtp = params.smtpOverride ?? getSmtpConfigFromEnv();
  if (!isValidEmailAddress(params.toEmail)) {
    return {
      ok: false,
      smtpConfigured: smtp.configured,
      message: 'Informe um endereço de e-mail válido para receber o teste.',
    };
  }

  if (!smtp.configured && !params.transporterOverride) {
    return {
      ok: false,
      smtpConfigured: false,
      message:
        'SMTP do Nodemailer não configurado no ambiente (defina SMTP_HOST, SMTP_USER e SMTP_PASS nos segredos do servidor).',
    };
  }

  const sampleDate = new Date(Date.now() + smtp.alertDays * 86400000);
  const sampleIso = sampleDate.toISOString().slice(0, 10);
  const sampleItems: EmailReminderItemPayload[] = [
    {
      docId: 'test_visa_30d',
      itemKind: 'visto',
      caseId: 'case_test',
      caseTitle: 'Teste de Alerta Automático — Residência Temporal Mercosul',
      clientId: 'cli_test',
      clientName: 'Teste Administrativo',
      clientEmail: params.toEmail.trim(),
      nomeDocumento: 'Visto / Residência Temporal (Subcategoria 15 — Mercosul)',
      pessoa: 'Titular',
      obrigatorio: true,
      status: 'Aprovado',
      severity: 'atencao',
      daysRemaining: smtp.alertDays,
      dataValidadeEfetiva: sampleIso,
      dataValidadeBR: formatDateBR(sampleIso),
      statusLabel: `Expira em ${smtp.alertDays} dias`,
    },
  ];

  const tpl = buildExpirationEmailTemplate({
    brandName: params.brandName || 'D&M Integra Chile – Relocation & Assessoria',
    clientName: 'Equipe / Teste de Automação',
    caseTitle: 'Validação de Envio Automático (Nodemailer SMTP)',
    items: sampleItems,
    portalUrl: params.portalUrl,
    replyTo: smtp.replyTo,
    alertDays: smtp.alertDays,
  });

  const transporter = params.transporterOverride ?? createNodemailerTransporter(smtp);
  try {
    const info = await transporter.sendMail({
      from: smtp.from,
      to: params.toEmail.trim(),
      replyTo: smtp.replyTo,
      subject: `[TESTE SMTP] ${tpl.subject}`,
      text: tpl.text,
      html: tpl.html,
    });
    return {
      ok: true,
      smtpConfigured: true,
      messageId: info.messageId,
      message: `E-mail de teste enviado com sucesso para ${params.toEmail.trim()} via Nodemailer.`,
    };
  } catch (err) {
    return {
      ok: false,
      smtpConfigured: true,
      message: err instanceof Error ? `Erro SMTP ao enviar teste: ${err.message}` : 'Falha ao enviar e-mail de teste.',
    };
  }
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
  const effectiveAlertDays =
    typeof input.alertDaysOverride === 'number' && Number.isFinite(input.alertDaysOverride)
      ? Math.min(180, Math.max(1, Math.round(input.alertDaysOverride)))
      : smtp.alertDays;
  const brandName = (input.brandName || 'D&M Integra Chile – Relocation & Assessoria').trim();
  const communicationLogs = input.communicationLogs || [];

  const eligibleItems = input.items.filter(
    (i) =>
      i.severity === 'vencido' ||
      i.severity === 'critico' ||
      i.severity === 'atencao' ||
      (typeof i.daysRemaining === 'number' && i.daysRemaining <= effectiveAlertDays),
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
        alertDays: smtp.alertDays,
        sentEmails: 0,
        coveredDocs: 0,
        skippedCooldown,
        skippedNoEmail,
        failedCount: 0,
        warning: `Não há vistos ou documentos com vencimento em até ${smtp.alertDays} dias para pré-visualizar.`,
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
      alertDays: smtp.alertDays,
    });
    return {
      ok: true,
      smtpConfigured: smtp.configured,
      alertDays: smtp.alertDays,
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
      alertDays: smtp.alertDays,
      sentEmails: 0,
      coveredDocs: 0,
      skippedCooldown,
      skippedNoEmail,
      failedCount: 0,
      warning:
        skippedCooldown > 0
          ? 'Todos os lembretes elegíveis já receberam e-mail recentemente dentro da janela de controle.'
          : 'Nenhum visto ou documento elegível com e-mail válido para envio neste momento.',
      outcomes,
      createdLogs: [],
    };
  }

  if (!smtp.configured && !input.transporterOverride) {
    return {
      ok: false,
      smtpConfigured: false,
      alertDays: smtp.alertDays,
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
      alertDays: effectiveAlertDays,
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
        const kindTag =
          item.itemKind === 'visto'
            ? `Alerta de Visto (≤ ${effectiveAlertDays}d)`
            : item.itemKind === 'prazo_visto'
              ? 'Alerta de Prazo Migratório'
              : 'Lembrete de Vencimento';
        const logEntry: CommunicationLog = {
          id: logId,
          clientId: item.clientId,
          caseId: item.caseId,
          canal: 'E-mail',
          assunto: `${kindTag}: ${item.nomeDocumento}`,
          mensagem: `E-mail automático enviado via Nodemailer para ${item.clientEmail} (${item.statusLabel} · Validade: ${item.dataValidadeBR}).`,
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
    alertDays: effectiveAlertDays,
    sentEmails,
    coveredDocs,
    skippedCooldown,
    skippedNoEmail,
    failedCount,
    outcomes,
    createdLogs,
  };
}

export interface ClientSelfExpirationAlertInput {
  recipientEmail: string;
  clientName: string;
  caseTitle?: string;
  brandName?: string;
  portalUrl?: string;
  alertDays: number;
  mode: 'preview' | 'auto' | 'manual';
  items: EmailReminderItemPayload[];
  smtpOverride?: SmtpRuntimeConfig;
  transporterOverride?: EmailTransportLike;
}

export interface ClientSelfExpirationAlertResult {
  ok: boolean;
  mode: 'preview' | 'auto' | 'manual';
  smtpConfigured: boolean;
  sent: boolean;
  alertDays: number;
  recipientEmail: string;
  eligibleCount: number;
  subject: string;
  previewHtml: string;
  messageId?: string;
  message: string;
}

export async function dispatchClientSelfExpirationAlert(
  input: ClientSelfExpirationAlertInput,
): Promise<ClientSelfExpirationAlertResult> {
  const smtp = input.smtpOverride ?? getSmtpConfigFromEnv();
  const safeAlertDays = Math.min(180, Math.max(1, Math.round(Number(input.alertDays) || smtp.alertDays || 30)));
  const recipientEmail = (input.recipientEmail || '').trim().toLowerCase();

  if (!isValidEmailAddress(recipientEmail)) {
    return {
      ok: false,
      mode: input.mode,
      smtpConfigured: smtp.configured,
      sent: false,
      alertDays: safeAlertDays,
      recipientEmail,
      eligibleCount: 0,
      subject: '',
      previewHtml: '',
      message: 'Sua conta não possui um e-mail válido verificado para receber alertas.',
    };
  }

  const eligible = (input.items || [])
    .slice(0, 30)
    .filter((item) => typeof item.daysRemaining === 'number' && item.daysRemaining <= safeAlertDays)
    .map((item) => ({
      ...item,
      clientEmail: recipientEmail,
      clientName: (input.clientName || item.clientName || 'Cliente').slice(0, 140),
    }));

  if (eligible.length === 0) {
    return {
      ok: true,
      mode: input.mode,
      smtpConfigured: smtp.configured,
      sent: false,
      alertDays: safeAlertDays,
      recipientEmail,
      eligibleCount: 0,
      subject: '',
      previewHtml: '',
      message: `Nenhum visto ou documento com vencimento dentro dos próximos ${safeAlertDays} dias.`,
    };
  }

  const tpl = buildExpirationEmailTemplate({
    brandName: (input.brandName || 'D&M Integra Chile – Assessoria de Imigração').trim(),
    clientName: (input.clientName || 'Cliente').trim().slice(0, 140),
    caseTitle: (input.caseTitle || 'Acompanhamento de Visto e RUT').trim().slice(0, 180),
    items: eligible,
    portalUrl: input.portalUrl,
    replyTo: smtp.replyTo,
    alertDays: safeAlertDays,
  });

  if (input.mode === 'preview') {
    return {
      ok: true,
      mode: 'preview',
      smtpConfigured: smtp.configured,
      sent: false,
      alertDays: safeAlertDays,
      recipientEmail,
      eligibleCount: eligible.length,
      subject: tpl.subject,
      previewHtml: tpl.html,
      message: `Prévia pronta com ${eligible.length} item(ns) na janela de ${safeAlertDays} dias.`,
    };
  }

  if (!smtp.configured && !input.transporterOverride) {
    return {
      ok: false,
      mode: input.mode,
      smtpConfigured: false,
      sent: false,
      alertDays: safeAlertDays,
      recipientEmail,
      eligibleCount: eligible.length,
      subject: tpl.subject,
      previewHtml: tpl.html,
      message:
        'O servidor de e-mail (SMTP) ainda não foi ativado pelo administrador. Você já pode visualizar a prévia do alerta aqui no painel.',
    };
  }

  const transporter = input.transporterOverride ?? createNodemailerTransporter(smtp);
  try {
    const info = await transporter.sendMail({
      from: smtp.from,
      to: recipientEmail,
      replyTo: smtp.replyTo,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });

    return {
      ok: true,
      mode: input.mode,
      smtpConfigured: true,
      sent: true,
      alertDays: safeAlertDays,
      recipientEmail,
      eligibleCount: eligible.length,
      subject: tpl.subject,
      previewHtml: tpl.html,
      messageId: info.messageId,
      message: `Alerta enviado via SMTP para ${recipientEmail} (${eligible.length} item(ns) com vencimento em até ${safeAlertDays} dias).`,
    };
  } catch (err) {
    return {
      ok: false,
      mode: input.mode,
      smtpConfigured: true,
      sent: false,
      alertDays: safeAlertDays,
      recipientEmail,
      eligibleCount: eligible.length,
      subject: tpl.subject,
      previewHtml: tpl.html,
      message:
        err instanceof Error
          ? `Falha ao enviar alerta por e-mail: ${err.message}`
          : 'Não foi possível concluir o envio SMTP no momento.',
    };
  }
}

