import type { Case, CaseDocument, Client, Deadline, Dependent, VisaRequirement } from '../types/domain';
import {
  collectExpirationReminders,
  type ExpirationItemKind,
  type ExpirationReminderItem,
} from './documentExpiration';

export const CLIENT_ALERT_DAY_PRESETS = [7, 15, 30, 45, 60] as const;

export interface ClientDeadlineAlertPrefs {
  enabled: boolean;
  alertDays: number;
  cooldownHours: number;
  lastAutoAlertAt?: string;
  lastAutoAlertFingerprint?: string;
  lastManualAlertAt?: string;
}

export const DEFAULT_CLIENT_DEADLINE_ALERT_PREFS: ClientDeadlineAlertPrefs = {
  enabled: true,
  alertDays: 30,
  cooldownHours: 24,
};

export type ClientDeadlineBucket = 'expired' | 'alert_window' | 'upcoming';

export interface ClientMonitoredDeadlineItem {
  id: string;
  itemKind: ExpirationItemKind;
  categoryGroup: 'visto_prazo' | 'documento';
  titulo: string;
  titularNome: string;
  dataVencimento: string;
  dataVencimentoBR: string;
  daysRemaining: number;
  bucket: ClientDeadlineBucket;
  urgenciaLabel: string;
  sourceLabel: string;
  statusLabel: string;
  reminder: ExpirationReminderItem;
}

export interface ClientDeadlineMonitorSnapshot {
  alertDays: number;
  items: ClientMonitoredDeadlineItem[];
  expiredItems: ClientMonitoredDeadlineItem[];
  inAlertWindowItems: ClientMonitoredDeadlineItem[];
  upcomingItems: ClientMonitoredDeadlineItem[];
  alertableReminders: ExpirationReminderItem[];
  missingCriticalDates: string[];
  summary: {
    totalTracked: number;
    expiredCount: number;
    inAlertWindowCount: number;
    upcomingCount: number;
    alertableCount: number;
    nextExpiring: ClientMonitoredDeadlineItem | null;
  };
}

export function clampClientAlertDays(days: unknown, fallback = 30): number {
  const num = Number(days);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(180, Math.max(1, Math.round(num)));
}

function getKindMeta(itemKind: ExpirationItemKind): {
  categoryGroup: 'visto_prazo' | 'documento';
  sourceLabel: string;
} {
  switch (itemKind) {
    case 'visto':
      return { categoryGroup: 'visto_prazo', sourceLabel: 'Visto / Residência' };
    case 'prazo_visto':
      return { categoryGroup: 'visto_prazo', sourceLabel: 'Prazo SERMIG / RUT' };
    case 'documento':
    default:
      return { categoryGroup: 'documento', sourceLabel: 'Documento do Dossiê' };
  }
}

export function formatDeadlineCountdownLabel(daysRemaining: number): string {
  if (daysRemaining < -1) return `Vencido há ${Math.abs(daysRemaining)} dias`;
  if (daysRemaining === -1) return 'Vencido ontem';
  if (daysRemaining === 0) return 'Vence hoje';
  if (daysRemaining === 1) return 'Vence amanhã';
  return `Faltam ${daysRemaining} dias`;
}

export function buildClientDeadlineMonitorSnapshot(params: {
  client: Client;
  dependents?: Dependent[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines?: Deadline[];
  visaRequirements?: VisaRequirement[];
  alertDays: number;
  referenceDate?: Date;
}): ClientDeadlineMonitorSnapshot {
  const alertDays = clampClientAlertDays(params.alertDays);
  const referenceDate = params.referenceDate ?? new Date();

  const collected = collectExpirationReminders({
    clients: [params.client],
    dependents: params.dependents || [],
    cases: params.cases,
    docs: params.docs,
    deadlines: params.deadlines || [],
    visaRequirements: params.visaRequirements || [],
    hoje: referenceDate,
    warningDays: alertDays,
  });

  const combined = [...collected.expiringItems, ...collected.upcomingItems]
    .filter((item) => typeof item.daysRemaining === 'number' && Boolean(item.dataValidadeEfetiva))
    .sort((a, b) => (a.daysRemaining ?? 99999) - (b.daysRemaining ?? 99999));

  const items: ClientMonitoredDeadlineItem[] = combined.map((rem) => {
    const daysRemaining = rem.daysRemaining ?? 0;
    const meta = getKindMeta(rem.itemKind);
    const bucket: ClientDeadlineBucket =
      daysRemaining < 0
        ? 'expired'
        : daysRemaining <= alertDays
          ? 'alert_window'
          : 'upcoming';

    const urgenciaLabel =
      bucket === 'expired'
        ? 'Vencido · Ação imediata'
        : daysRemaining <= 7
          ? 'Crítico · Urgente'
          : bucket === 'alert_window'
            ? `Dentro da janela (${alertDays}d)`
            : 'Monitorado em dia';

    return {
      id: rem.doc.id,
      itemKind: rem.itemKind,
      categoryGroup: meta.categoryGroup,
      titulo: rem.doc.nomeDocumento,
      titularNome: rem.doc.pessoa || params.client.nomeCompleto || 'Titular',
      dataVencimento: rem.dataValidadeEfetiva || '',
      dataVencimentoBR: rem.dataValidadeBR,
      daysRemaining,
      bucket,
      urgenciaLabel,
      sourceLabel: meta.sourceLabel,
      statusLabel: rem.statusLabel,
      reminder: rem,
    };
  });

  const expiredItems = items.filter((i) => i.bucket === 'expired');
  const inAlertWindowItems = items.filter((i) => i.bucket === 'alert_window');
  const upcomingItems = items.filter((i) => i.bucket === 'upcoming');
  const alertableReminders = items
    .filter((i) => i.bucket === 'expired' || i.bucket === 'alert_window')
    .map((i) => i.reminder);

  const missingCriticalDates: string[] = [];
  if (!params.client.passaporte?.validade) {
    missingCriticalDates.push('Validade do passaporte do titular (preencha na aba Dados para ativar monitoramento)');
  }
  const hasAnyVisaDate = params.cases.some(
    (c) => Boolean(c.dataVencimentoResidencia) || Boolean(c.dataLimiteEntrada),
  );
  if (params.cases.length > 0 && !hasAnyVisaDate) {
    missingCriticalDates.push(
      'Data de vencimento do visto ou limite do Estampado Eletrônico (atualizada pelo consultor após aprovação)',
    );
  }

  const nextExpiring =
    items.find((i) => i.daysRemaining >= 0) ??
    (expiredItems.length > 0 ? expiredItems[expiredItems.length - 1] : null);

  return {
    alertDays,
    items,
    expiredItems,
    inAlertWindowItems,
    upcomingItems,
    alertableReminders,
    missingCriticalDates,
    summary: {
      totalTracked: items.length,
      expiredCount: expiredItems.length,
      inAlertWindowCount: inAlertWindowItems.length,
      upcomingCount: upcomingItems.length,
      alertableCount: alertableReminders.length,
      nextExpiring,
    },
  };
}

export function buildAutoAlertFingerprint(
  reminders: ExpirationReminderItem[],
  alertDays: number,
): string {
  const keys = reminders
    .map((r) => `${r.doc.id}:${r.dataValidadeEfetiva || ''}`)
    .sort()
    .join('|');
  return `d${clampClientAlertDays(alertDays)}::${keys}`;
}

export function shouldAutoDispatchClientAlert(params: {
  prefs: ClientDeadlineAlertPrefs;
  alertableReminders: ExpirationReminderItem[];
  smtpConfigured: boolean;
  nowMs?: number;
}): boolean {
  if (!params.prefs.enabled || !params.smtpConfigured) return false;
  if (params.alertableReminders.length === 0) return false;

  const nowMs = params.nowMs ?? Date.now();
  const fingerprint = buildAutoAlertFingerprint(params.alertableReminders, params.prefs.alertDays);
  const cooldownMs = Math.max(1, params.prefs.cooldownHours || 24) * 3_600_000;

  if (
    params.prefs.lastAutoAlertFingerprint === fingerprint &&
    params.prefs.lastAutoAlertAt
  ) {
    const lastMs = Date.parse(params.prefs.lastAutoAlertAt);
    if (Number.isFinite(lastMs) && nowMs - lastMs < cooldownMs) {
      return false;
    }
  }
  return true;
}

function getPrefsStorageKey(uid: string): string {
  return `dm_client_deadline_alert_prefs_v1_${uid}`;
}

export function loadClientDeadlineAlertPrefs(uid: string): ClientDeadlineAlertPrefs {
  if (!uid || typeof window === 'undefined') {
    return { ...DEFAULT_CLIENT_DEADLINE_ALERT_PREFS };
  }
  try {
    const raw = window.localStorage.getItem(getPrefsStorageKey(uid));
    if (!raw) return { ...DEFAULT_CLIENT_DEADLINE_ALERT_PREFS };
    const parsed = JSON.parse(raw) as Partial<ClientDeadlineAlertPrefs>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      alertDays: clampClientAlertDays(parsed.alertDays, 30),
      cooldownHours: Math.min(168, Math.max(1, Number(parsed.cooldownHours || 24))),
      lastAutoAlertAt: typeof parsed.lastAutoAlertAt === 'string' ? parsed.lastAutoAlertAt : undefined,
      lastAutoAlertFingerprint:
        typeof parsed.lastAutoAlertFingerprint === 'string'
          ? parsed.lastAutoAlertFingerprint
          : undefined,
      lastManualAlertAt:
        typeof parsed.lastManualAlertAt === 'string' ? parsed.lastManualAlertAt : undefined,
    };
  } catch {
    return { ...DEFAULT_CLIENT_DEADLINE_ALERT_PREFS };
  }
}

export function saveClientDeadlineAlertPrefs(
  uid: string,
  prefs: ClientDeadlineAlertPrefs,
): ClientDeadlineAlertPrefs {
  const normalized: ClientDeadlineAlertPrefs = {
    enabled: Boolean(prefs.enabled),
    alertDays: clampClientAlertDays(prefs.alertDays, 30),
    cooldownHours: Math.min(168, Math.max(1, Number(prefs.cooldownHours || 24))),
    lastAutoAlertAt: prefs.lastAutoAlertAt,
    lastAutoAlertFingerprint: prefs.lastAutoAlertFingerprint,
    lastManualAlertAt: prefs.lastManualAlertAt,
  };
  if (uid && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getPrefsStorageKey(uid), JSON.stringify(normalized));
    } catch {
      // ignore storage errors
    }
  }
  return normalized;
}
