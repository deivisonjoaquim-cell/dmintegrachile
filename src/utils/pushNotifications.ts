import type { ClientNotificationType, PushNotificationPreferences } from '../types/domain';

export type PushNotificationCategory = keyof PushNotificationPreferences;

export const DEFAULT_PUSH_PREFERENCES: PushNotificationPreferences = {
  statusProcesso: true,
  documentos: true,
  mensagensEquipe: true,
};

export interface VapidValidationResult {
  valid: boolean;
  normalized: string;
  error?: string;
}

export interface ResolvedVapidConfig {
  key: string;
  source: 'env' | 'admin' | 'none';
  valid: boolean;
  error?: string;
}

/**
 * Validates a Firebase Cloud Messaging Web Push VAPID public key.
 * Standard uncompressed P-256 VAPID public keys are Base64URL-encoded (~87 chars, starting with "B").
 */
export function validateVapidPublicKey(rawKey?: string | null): VapidValidationResult {
  const normalized = (rawKey || '').trim();
  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      error: 'Chave pública VAPID não informada.',
    };
  }
  if (/\s/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'A chave pública VAPID não pode conter espaços ou quebras de linha.',
    };
  }
  if (normalized.includes('BEGIN') || normalized.includes('PRIVATE')) {
    return {
      valid: false,
      normalized,
      error: 'Informe apenas a chave PÚBLICA Web Push (VAPID), nunca uma chave privada.',
    };
  }
  if (normalized.length < 65 || normalized.length > 200) {
    return {
      valid: false,
      normalized,
      error: 'Formato inválido: a chave pública VAPID do Firebase normalmente possui cerca de 87 caracteres Base64URL.',
    };
  }
  if (!/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'A chave pública VAPID deve conter apenas caracteres Base64URL (letras, números, "-" e "_").',
    };
  }
  return { valid: true, normalized };
}

/**
 * Resolves the effective VAPID key giving precedence to the Vercel/Vite env var,
 * then falling back to the Admin Panel key stored in Firestore `config/empresa`.
 */
export function resolveVapidConfig(
  envKey?: string | null,
  adminKey?: string | null,
): ResolvedVapidConfig {
  const cleanEnv = (envKey || '').trim();
  if (cleanEnv) {
    const check = validateVapidPublicKey(cleanEnv);
    return {
      key: check.normalized,
      source: 'env',
      valid: check.valid,
      error: check.error,
    };
  }

  const cleanAdmin = (adminKey || '').trim();
  if (cleanAdmin) {
    const check = validateVapidPublicKey(cleanAdmin);
    return {
      key: check.normalized,
      source: 'admin',
      valid: check.valid,
      error: check.error,
    };
  }

  return {
    key: '',
    source: 'none',
    valid: false,
  };
}

export function normalizePushPreferences(
  raw?: Partial<PushNotificationPreferences> | null,
): PushNotificationPreferences {
  return {
    statusProcesso: raw?.statusProcesso !== false,
    documentos: raw?.documentos !== false,
    mensagensEquipe: raw?.mensagensEquipe !== false,
  };
}

export function getNotificationCategoryForType(
  tipo?: ClientNotificationType | string | null,
): PushNotificationCategory {
  if (tipo === 'documento') return 'documentos';
  if (tipo === 'mensagem_equipe') return 'mensagensEquipe';
  return 'statusProcesso';
}

export function shouldDeliverNotificationForPreferences(
  tipo: ClientNotificationType | string | null | undefined,
  prefs?: Partial<PushNotificationPreferences> | null,
): boolean {
  const normalized = normalizePushPreferences(prefs);
  const category = getNotificationCategoryForType(tipo);
  return normalized[category] === true;
}

export function getPortalTabForNotification(
  tipo?: ClientNotificationType | string | null,
  linkDestino?: string | null,
): 'processo' | 'documentos' | 'suporte' {
  if (linkDestino) {
    if (linkDestino.includes('tab=documentos')) return 'documentos';
    if (linkDestino.includes('tab=suporte')) return 'suporte';
    if (linkDestino.includes('tab=processo')) return 'processo';
  }
  if (tipo === 'documento') return 'documentos';
  if (tipo === 'mensagem_equipe') return 'suporte';
  return 'processo';
}

export function buildNotificationTargetUrl(
  tipo: ClientNotificationType,
  explicitLink?: string,
): string {
  if (explicitLink && explicitLink.includes('tab=')) return explicitLink;
  const tab = getPortalTabForNotification(tipo, explicitLink);
  return `/portal?tab=${tab}`;
}

export function getNotificationTypeLabel(tipo?: ClientNotificationType | string | null): string {
  switch (tipo) {
    case 'etapa_pipeline':
      return 'Etapa do Processo';
    case 'status_sermig':
      return 'Status SERMIG';
    case 'documento':
      return 'Documento';
    case 'mensagem_equipe':
      return 'Mensagem da Equipe';
    case 'parecer':
      return 'Parecer Técnico';
    case 'prazo':
      return 'Prazo Legal';
    default:
      return 'Comunicado';
  }
}
