import { getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { loadFirebaseServerConfig } from './firebaseServerConfig.ts';

const firebaseConfig = loadFirebaseServerConfig();

export type ProcessNotificationType =
  | 'etapa_pipeline'
  | 'status_sermig'
  | 'documento'
  | 'mensagem_equipe'
  | 'parecer'
  | 'prazo'
  | 'geral';

interface StoredPushPreferences {
  statusProcesso?: boolean;
  documentos?: boolean;
  mensagensEquipe?: boolean;
}

export function isTokenSubscribedToType(
  tipo: ProcessNotificationType,
  preferencias?: StoredPushPreferences | null,
): boolean {
  if (!preferencias || typeof preferencias !== 'object') return true;
  if (tipo === 'documento') return preferencias.documentos !== false;
  if (tipo === 'mensagem_equipe') return preferencias.mensagensEquipe !== false;
  return preferencias.statusProcesso !== false;
}

export interface ProcessPushRequest {
  clientId: string;
  caseId?: string;
  notificationId?: string;
  tipo: ProcessNotificationType;
  titulo: string;
  mensagem: string;
  etapaPipeline?: number;
  statusSermig?: string;
  targetUrl?: string;
}

export interface ProcessPushResult {
  ok: boolean;
  iamPending?: boolean;
  sentCount: number;
  failedCount: number;
  totalTokens: number;
  deactivatedTokens: number;
  warning?: string;
}

const UNREGISTERED_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export function isUnregisteredFcmErrorCode(code?: string): boolean {
  return Boolean(code && UNREGISTERED_ERROR_CODES.has(code));
}

export function isIamPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; message?: unknown };
  const msg = typeof record.message === 'string' ? record.message : '';
  return (
    record.code === 7 ||
    record.code === 'PERMISSION_DENIED' ||
    record.code === 'permission-denied' ||
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('Missing or insufficient permissions') ||
    msg.includes('Could not load the default credentials') ||
    msg.includes('Unable to detect a Project Id')
  );
}

export function buildProcessNotificationMessage(input: ProcessPushRequest): {
  title: string;
  body: string;
  data: Record<string, string>;
} {
  const safeTitle = (input.titulo || 'Atualização do Processo — D&M Integra Chile')
    .trim()
    .slice(0, 140);
  const safeBody = (
    input.mensagem ||
    'Seu processo migratório recebeu uma atualização no Portal do Cliente.'
  )
    .trim()
    .slice(0, 480);

  const data: Record<string, string> = {
    title: safeTitle,
    body: safeBody,
    tipo: input.tipo || 'geral',
    clientId: (input.clientId || '').slice(0, 100),
    caseId: (input.caseId || '').slice(0, 100),
    notificationId: (input.notificationId || '').slice(0, 100),
    url: (input.targetUrl || '/portal').slice(0, 160),
  };

  if (typeof input.etapaPipeline === 'number' && Number.isFinite(input.etapaPipeline)) {
    data.etapaPipeline = String(Math.round(input.etapaPipeline));
  }
  if (input.statusSermig) {
    data.statusSermig = String(input.statusSermig).slice(0, 80);
  }

  return { title: safeTitle, body: safeBody, data };
}

let cachedAdminApp: App | null = null;
let cachedAdminDb: Firestore | null = null;
let cachedAdminMessaging: Messaging | null = null;

function getAdminServices(): { adminDb: Firestore; adminMessaging: Messaging } {
  if (!cachedAdminApp) {
    cachedAdminApp = getApps().length
      ? getApp()
      : initializeApp({ projectId: firebaseConfig.projectId });
  }
  if (!cachedAdminDb) {
    // Explicitamento vinculada ao firestoreDatabaseId nomeado do projeto
    cachedAdminDb = getFirestore(cachedAdminApp, firebaseConfig.firestoreDatabaseId);
  }
  if (!cachedAdminMessaging) {
    cachedAdminMessaging = getMessaging(cachedAdminApp);
  }
  return { adminDb: cachedAdminDb, adminMessaging: cachedAdminMessaging };
}

export async function dispatchProcessPushNotification(
  input: ProcessPushRequest,
): Promise<ProcessPushResult> {
  if (!input.clientId || !input.clientId.trim()) {
    return {
      ok: false,
      sentCount: 0,
      failedCount: 0,
      totalTokens: 0,
      deactivatedTokens: 0,
      warning: 'clientId é obrigatório para envio de notificação push.',
    };
  }

  try {
    const { adminDb, adminMessaging } = getAdminServices();
    const tokenSnap = await adminDb
      .collection('fcmTokens')
      .where('clientId', '==', input.clientId.trim())
      .where('ativo', '==', true)
      .get();

    if (tokenSnap.empty) {
      if (input.notificationId) {
        await adminDb
          .collection('clientNotifications')
          .doc(input.notificationId)
          .set(
            {
              pushEnviado: false,
              pushEnviadosQtd: 0,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          )
          .catch(() => undefined);
      }
      return {
        ok: true,
        sentCount: 0,
        failedCount: 0,
        totalTokens: 0,
        deactivatedTokens: 0,
        warning:
          'Cliente ainda não ativou notificações push no navegador; alerta registrado no Portal do Cliente.',
      };
    }

    const tokenDocs = tokenSnap.docs
      .map((docSnap) => {
        const data = docSnap.data() as {
          token?: string;
          preferencias?: StoredPushPreferences;
        };
        return {
          docId: docSnap.id,
          token: typeof data.token === 'string' ? data.token.trim() : '',
          preferencias: data.preferencias,
        };
      })
      .filter(
        (item) =>
          item.token.length >= 20 &&
          isTokenSubscribedToType(input.tipo, item.preferencias),
      );

    if (tokenDocs.length === 0) {
      return {
        ok: true,
        sentCount: 0,
        failedCount: 0,
        totalTokens: 0,
        deactivatedTokens: 0,
        warning:
          'Cliente optou por não receber alertas push desta categoria; aviso registrado no Portal do Cliente.',
      };
    }

    const msg = buildProcessNotificationMessage(input);
    const batchResp = await adminMessaging.sendEachForMulticast({
      tokens: tokenDocs.map((t) => t.token),
      notification: {
        title: msg.title,
        body: msg.body,
      },
      data: msg.data,
      webpush: {
        notification: {
          title: msg.title,
          body: msg.body,
          tag: msg.data.notificationId || msg.data.caseId || 'dm-integra-processo',
        },
        fcmOptions: {
          link: msg.data.url,
        },
      },
    });

    let deactivatedTokens = 0;
    const nowIso = new Date().toISOString();

    await Promise.all(
      batchResp.responses.map(async (resp, idx) => {
        if (!resp.success && isUnregisteredFcmErrorCode(resp.error?.code)) {
          const targetDocId = tokenDocs[idx]?.docId;
          if (targetDocId) {
            deactivatedTokens += 1;
            await adminDb
              .collection('fcmTokens')
              .doc(targetDocId)
              .set({ ativo: false, updatedAt: nowIso }, { merge: true })
              .catch(() => undefined);
          }
        }
      }),
    );

    if (input.notificationId) {
      await adminDb
        .collection('clientNotifications')
        .doc(input.notificationId)
        .set(
          {
            pushEnviado: batchResp.successCount > 0,
            pushEnviadosQtd: batchResp.successCount,
            updatedAt: nowIso,
          },
          { merge: true },
        )
        .catch(() => undefined);
    }

    return {
      ok: true,
      sentCount: batchResp.successCount,
      failedCount: batchResp.failureCount,
      totalTokens: tokenDocs.length,
      deactivatedTokens,
    };
  } catch (err) {
    if (isIamPermissionError(err)) {
      return {
        ok: false,
        iamPending: true,
        sentCount: 0,
        failedCount: 0,
        totalTokens: 0,
        deactivatedTokens: 0,
        warning:
          'Permissão IAM pendente no projeto Firebase para envio via Cloud Messaging no servidor; o alerta já está disponível no Portal do Cliente.',
      };
    }
    return {
      ok: false,
      sentCount: 0,
      failedCount: 0,
      totalTokens: 0,
      deactivatedTokens: 0,
      warning:
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir o disparo FCM no momento.',
    };
  }
}
