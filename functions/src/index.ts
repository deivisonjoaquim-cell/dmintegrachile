import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/v2';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import nodemailer from 'nodemailer';

const FIRESTORE_DATABASE_ID = 'ai-studio-9fb61fde-cee1-40db-bb8b-ce86ef2d5c98';
const EXPIRATION_WARNING_DAYS = 30;
const COOLDOWN_NORMAL_DAYS = 7;
const COOLDOWN_CRITICAL_DAYS = 2;

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app, FIRESTORE_DATABASE_ID);

interface CaseDocRecord {
  id: string;
  caseId: string;
  clientId: string;
  pessoa?: string;
  nomeDocumento: string;
  status: string;
  obrigatorio?: boolean;
  dataEmissao?: string;
  dataValidadeCalculada?: string;
  validadeDias?: number;
}

interface ClientRecord {
  id: string;
  nomeCompleto?: string;
  email?: string;
  passaporte?: { validade?: string };
}

interface CaseRecord {
  id: string;
  clientId: string;
  titulo?: string;
  arquivado?: boolean;
}

function parseFlexibleDate(str?: string): Date | null {
  if (!str) return null;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str.trim());
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00-03:00`);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (iso) return new Date(`${str.trim()}T12:00:00-03:00`);
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveEffectiveExpirationDate(doc: CaseDocRecord, client?: ClientRecord): Date | null {
  if (doc.dataValidadeCalculada) {
    const direct = parseFlexibleDate(doc.dataValidadeCalculada);
    if (direct) return direct;
  }
  const days = Number(doc.validadeDias || 0);
  if (doc.dataEmissao && days > 0) {
    const issued = parseFlexibleDate(doc.dataEmissao);
    if (issued) return new Date(issued.getTime() + days * 86400000);
  }
  if (/passaporte/i.test(doc.nomeDocumento || '') && (doc.pessoa || 'Titular') === 'Titular') {
    const passDate = parseFlexibleDate(client?.passaporte?.validade);
    if (passDate) return passDate;
  }
  return null;
}

function formatDateBR(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createTransporter() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const port = Number(process.env.SMTP_PORT || '587');
  const secure = (process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return {
    from: (process.env.SMTP_FROM || `D&M Integra Chile <${user}>`).trim(),
    transporter: nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    }),
  };
}

async function processExpiringDocumentReminders(targetDocId?: string): Promise<{ sent: number; skipped: number }> {
  const mailer = createTransporter();
  if (!mailer) {
    logger.warn('SMTP_HOST / SMTP_USER / SMTP_PASS não configurados nas variáveis do Firebase Functions.');
    return { sent: 0, skipped: 0 };
  }

  const now = new Date();
  const docsSnap = targetDocId
    ? await db.collection('caseDocuments').where('__name__', '==', targetDocId).get()
    : await db.collection('caseDocuments').get();

  if (docsSnap.empty) return { sent: 0, skipped: 0 };

  const [casesSnap, clientsSnap, logsSnap] = await Promise.all([
    db.collection('cases').get(),
    db.collection('clients').get(),
    db.collection('communicationLogs').where('canal', '==', 'E-mail').get(),
  ]);

  const caseMap = new Map<string, CaseRecord>();
  casesSnap.forEach((d) => caseMap.set(d.id, { id: d.id, ...(d.data() as Omit<CaseRecord, 'id'>) }));

  const clientMap = new Map<string, ClientRecord>();
  clientsSnap.forEach((d) => clientMap.set(d.id, { id: d.id, ...(d.data() as Omit<ClientRecord, 'id'>) }));

  const lastSentByDoc = new Map<string, number>();
  logsSnap.forEach((d) => {
    const data = d.data() as { documentId?: string; createdAt?: string };
    if (!data.documentId || !data.createdAt) return;
    const ms = Date.parse(data.createdAt);
    if (!Number.isFinite(ms)) return;
    const prev = lastSentByDoc.get(data.documentId) || 0;
    if (ms > prev) lastSentByDoc.set(data.documentId, ms);
  });

  type Candidate = {
    doc: CaseDocRecord;
    caseObj: CaseRecord;
    client: ClientRecord;
    daysRemaining: number;
    expirationBR: string;
    statusLabel: string;
  };

  const grouped = new Map<string, Candidate[]>();
  let skipped = 0;

  for (const docSnap of docsSnap.docs) {
    const doc = { id: docSnap.id, ...(docSnap.data() as Omit<CaseDocRecord, 'id'>) };
    const caseObj = caseMap.get(doc.caseId);
    if (!caseObj || caseObj.arquivado) continue;

    const client = clientMap.get(doc.clientId || caseObj.clientId);
    if (!client?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(client.email.trim())) {
      skipped += 1;
      continue;
    }

    const expDate = resolveEffectiveExpirationDate(doc, client);
    if (!expDate && doc.status !== 'Vencido') continue;

    const daysRemaining = expDate ? Math.round((expDate.getTime() - now.getTime()) / 86400000) : 0;
    if (daysRemaining >= EXPIRATION_WARNING_DAYS && doc.status !== 'Vencido') continue;

    const isCritical = daysRemaining <= 7 || doc.status === 'Vencido';
    const cooldownDays = isCritical ? COOLDOWN_CRITICAL_DAYS : COOLDOWN_NORMAL_DAYS;
    const lastMs = lastSentByDoc.get(doc.id);
    if (lastMs && (now.getTime() - lastMs) / 86400000 < cooldownDays) {
      skipped += 1;
      continue;
    }

    const statusLabel =
      daysRemaining <= 0
        ? `Vencido (${Math.abs(daysRemaining)}d)`
        : daysRemaining === 1
          ? 'Expira amanhã (1 dia)'
          : `Expira em ${daysRemaining} dias`;

    const key = `${client.email.trim().toLowerCase()}::${caseObj.id}`;
    const list = grouped.get(key) || [];
    list.push({
      doc,
      caseObj,
      client,
      daysRemaining,
      expirationBR: expDate ? formatDateBR(expDate) : '—',
      statusLabel,
    });
    grouped.set(key, list);
  }

  let sent = 0;
  const nowIso = now.toISOString();
  const portalUrl = (process.env.APP_URL || '').trim().replace(/\/$/, '')
    ? `${(process.env.APP_URL || '').trim().replace(/\/$/, '')}/portal`
    : '';

  for (const [, items] of grouped.entries()) {
    const first = items[0];
    const subject =
      items.length === 1
        ? `Lembrete de Vencimento: ${first.doc.nomeDocumento} — D&M Integra Chile`
        : `Lembrete de Vencimento (${items.length} documentos) — D&M Integra Chile`;

    const rowsHtml = items
      .map(
        (i) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;font-weight:700;color:#0F172A;">
          ${escapeHtml(i.doc.nomeDocumento)} (${escapeHtml(i.doc.pessoa || 'Titular')})
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#334155;">${escapeHtml(i.expirationBR)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #E2E8F0;color:#B91C1C;font-weight:700;">${escapeHtml(i.statusLabel)}</td>
      </tr>`,
      )
      .join('');

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">
        <div style="background:#0F2537;color:#FFFFFF;padding:20px 24px;">
          <div style="font-size:11px;color:#D4AF37;font-weight:700;text-transform:uppercase;">Lembrete Automático (&lt; 30 dias)</div>
          <div style="font-size:18px;font-weight:800;margin-top:4px;">D&amp;M Integra Chile – Relocation &amp; Assessoria</div>
        </div>
        <div style="padding:20px 24px;color:#0F172A;">
          <p>Olá, <strong>${escapeHtml(first.client.nomeCompleto || 'Cliente')}</strong>,</p>
          <p>No processo <strong>${escapeHtml(first.caseObj.titulo || 'Migratório')}</strong>, os seguintes documentos exigidos estão vencidos ou expiram em menos de 30 dias:</p>
          <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #E2E8F0;font-size:13px;">
            <thead>
              <tr style="background:#F8FAFC;text-align:left;">
                <th style="padding:8px 12px;">Documento</th>
                <th style="padding:8px 12px;">Validade</th>
                <th style="padding:8px 12px;">Prazo</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          ${portalUrl ? `<p style="margin-top:18px;"><a href="${escapeHtml(portalUrl)}" style="background:#0F2537;color:#FFFFFF;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700;">Acessar Portal do Cliente</a></p>` : ''}
        </div>
      </div>`;

    await mailer.transporter.sendMail({
      from: mailer.from,
      to: first.client.email!.trim(),
      subject,
      html,
      text: items.map((i) => `${i.doc.nomeDocumento}: ${i.statusLabel} (Validade: ${i.expirationBR})`).join('\n'),
    });

    sent += 1;

    for (const item of items) {
      const logId = `comm_fn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await db.collection('communicationLogs').doc(logId).set({
        id: logId,
        clientId: item.client.id,
        caseId: item.caseObj.id,
        canal: 'E-mail',
        assunto: `Lembrete de Vencimento: ${item.doc.nomeDocumento}`,
        mensagem: `E-mail automático agendado (Firebase Functions + Nodemailer) enviado para ${item.client.email} (${item.statusLabel}).`,
        autorNome: 'Automação Agendada (Firebase Functions)',
        origem: 'equipe',
        documentId: item.doc.id,
        documentNome: item.doc.nomeDocumento,
        lidaPelaEquipe: true,
        lidaPeloCliente: false,
        createdAt: nowIso,
      });

      const notifId = `notif_exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await db.collection('clientNotifications').doc(notifId).set({
        id: notifId,
        clientId: item.client.id,
        caseId: item.caseObj.id,
        titulo: `Documento próximo do vencimento: ${item.doc.nomeDocumento}`,
        mensagem: `${item.statusLabel} (Validade: ${item.expirationBR}). Enviamos também um lembrete para o seu e-mail.`,
        tipo: 'prazo',
        linkDestino: '/portal',
        lida: false,
        createdAt: nowIso,
      });
    }
  }

  return { sent, skipped };
}

export const enviarLembretesVencimentoDocumentos = onSchedule(
  {
    schedule: 'every day 09:00',
    timeZone: 'America/Sao_Paulo',
    region: 'us-central1',
    secrets: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
  },
  async () => {
    const summary = await processExpiringDocumentReminders();
    logger.info('Execução diária de lembretes de vencimento (< 30 dias)', summary);
  },
);

export const verificarVencimentoAoAtualizarDocumento = onDocumentWritten(
  {
    document: 'caseDocuments/{docId}',
    database: FIRESTORE_DATABASE_ID,
    region: 'us-central1',
    secrets: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
  },
  async (event) => {
    const docId = event.params.docId;
    if (!event.data?.after.exists) return;
    const summary = await processExpiringDocumentReminders(docId);
    logger.info(`Verificação de vencimento ao salvar documento ${docId}`, summary);
  },
);
