import { auth } from '../firebase';
import type { CommunicationLog } from '../types/domain';
import type { ExpirationReminderItem } from '../utils/documentExpiration';

async function getFirebaseIdToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sessão não autenticada. Faça login novamente para enviar e-mails.');
  }
  return user.getIdToken();
}

export interface EmailServiceHealth {
  ok: boolean;
  smtpConfigured: boolean;
  from?: string;
  cooldownDays: number;
}

export interface EmailReminderPayloadItem {
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
  severity: ExpirationReminderItem['severity'];
  daysRemaining: number | null;
  dataEmissao?: string;
  dataValidadeEfetiva?: string;
  dataValidadeBR: string;
  statusLabel: string;
}

export interface EmailDispatchResponse {
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
  outcomes: Array<{
    docId: string;
    clientEmail: string;
    status: 'sent' | 'preview' | 'skipped_cooldown' | 'skipped_no_email' | 'failed';
    reason?: string;
    messageId?: string;
  }>;
  createdLogs: CommunicationLog[];
}

export function mapReminderItemsToEmailPayload(items: ExpirationReminderItem[]): EmailReminderPayloadItem[] {
  return items.map((item) => ({
    docId: item.doc.id,
    caseId: item.caseObj.id,
    caseTitle: item.caseObj.titulo,
    clientId: item.client?.id || item.doc.clientId,
    clientName: item.client?.nomeCompleto || 'Cliente',
    clientEmail: item.client?.email || '',
    nomeDocumento: item.doc.nomeDocumento,
    pessoa: item.doc.pessoa || 'Titular',
    obrigatorio: item.doc.obrigatorio,
    status: item.doc.status,
    severity: item.severity,
    daysRemaining: item.daysRemaining,
    dataEmissao: item.dataEmissao,
    dataValidadeEfetiva: item.dataValidadeEfetiva,
    dataValidadeBR: item.dataValidadeBR,
    statusLabel: item.statusLabel,
  }));
}

export function findLatestEmailLogForDoc(
  docId: string,
  communicationLogs: CommunicationLog[],
): CommunicationLog | undefined {
  return communicationLogs
    .filter((log) => log.canal === 'E-mail' && log.documentId === docId)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
}

export async function fetchEmailAutomationHealth(): Promise<EmailServiceHealth> {
  if (!auth.currentUser) {
    return { ok: false, smtpConfigured: false, cooldownDays: 7 };
  }
  const token = await getFirebaseIdToken();
  const resp = await fetch('/api/emails/health', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    return { ok: false, smtpConfigured: false, cooldownDays: 7 };
  }
  return (await resp.json()) as EmailServiceHealth;
}

export async function sendExpirationReminderEmails(params: {
  items: ExpirationReminderItem[];
  communicationLogs: CommunicationLog[];
  brandName?: string;
  copyConsultant?: boolean;
  forceSend?: boolean;
  previewOnly?: boolean;
}): Promise<EmailDispatchResponse> {
  const token = await getFirebaseIdToken();
  const payloadItems = mapReminderItemsToEmailPayload(params.items);
  const portalUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/portal`
      : '';

  const resp = await fetch('/api/emails/expiration-reminders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      items: payloadItems,
      communicationLogs: params.communicationLogs,
      brandName: params.brandName,
      portalUrl,
      copyConsultant: Boolean(params.copyConsultant),
      forceSend: Boolean(params.forceSend),
      previewOnly: Boolean(params.previewOnly),
    }),
  });

  const data = (await resp.json().catch(() => ({}))) as Partial<EmailDispatchResponse> & {
    error?: string;
  };
  if (!resp.ok) {
    throw new Error(data.error || 'Falha ao acionar serviço de automação de e-mails.');
  }

  return data as EmailDispatchResponse;
}
