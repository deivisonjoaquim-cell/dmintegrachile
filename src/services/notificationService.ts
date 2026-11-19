import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from 'firebase/messaging';
import { app, auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  ClientNotification,
  ClientNotificationType,
  EmpresaConfig,
  FcmTokenRecord,
} from '../types/domain';
import { makeId } from './firestoreService';

export interface BrowserPushSupport {
  supported: boolean;
  fcmSupported: boolean;
  permission: NotificationPermission | 'unsupported';
}

export type PushActivationMode = 'fcm' | 'browser_realtime';

export interface EnableClientPushResult {
  mode: PushActivationMode;
  token?: string;
  docId?: string;
  note?: string;
}

const shownBrowserNotificationIds = new Set<string>();

function getRealtimePushStorageKey(uid: string): string {
  return `dm_browser_push_optin_${uid}`;
}

export function isBrowserRealtimePushOptedIn(uid: string): boolean {
  if (!uid || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(getRealtimePushStorageKey(uid)) === '1';
  } catch {
    return false;
  }
}

export function setBrowserRealtimePushOptedIn(uid: string, enabled: boolean): void {
  if (!uid || typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(getRealtimePushStorageKey(uid), '1');
    } else {
      window.localStorage.removeItem(getRealtimePushStorageKey(uid));
    }
  } catch {
    // ignore storage errors
  }
}

export async function showBrowserProcessNotification(params: {
  id?: string;
  title: string;
  body: string;
  url?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const dedupeKey = params.id?.trim();
  if (dedupeKey) {
    if (shownBrowserNotificationIds.has(dedupeKey)) {
      return false;
    }
    shownBrowserNotificationIds.add(dedupeKey);
    if (shownBrowserNotificationIds.size > 200) {
      const oldest = shownBrowserNotificationIds.values().next().value;
      if (oldest) shownBrowserNotificationIds.delete(oldest);
    }
  }

  const targetUrl = params.url || '/portal';
  const options: NotificationOptions = {
    body: params.body,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: dedupeKey || `sermig-${Date.now()}`,
    data: { url: targetUrl },
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(params.title, options);
        return true;
      }
    }
  } catch {
    // Fall back to direct Notification API below
  }

  try {
    const notif = new Notification(params.title, options);
    notif.onclick = () => {
      try {
        window.focus();
        if (targetUrl && window.location.pathname !== targetUrl) {
          window.history.pushState({}, '', targetUrl);
        }
      } catch {
        // ignore focus errors
      }
      notif.close();
    };
    return true;
  } catch {
    return false;
  }
}

export async function sendTestBrowserNotification(empresaNome?: string): Promise<boolean> {
  return showBrowserProcessNotification({
    title: `${empresaNome || 'Portal do Cliente'} · Alertas ativos`,
    body: 'As notificações de atualização do seu processo de imigração estão funcionando neste navegador.',
    url: '/portal',
  });
}

export interface ProcessUpdateNotificationInput {
  clientId: string;
  caseId?: string;
  tipo: ClientNotificationType;
  titulo: string;
  mensagem: string;
  etapaPipeline?: number;
  statusSermig?: string;
  linkDestino?: string;
  criadoPorUid?: string;
  criadoPorNome?: string;
}

export interface ProcessUpdatePushResponse {
  ok: boolean;
  iamPending?: boolean;
  sentCount: number;
  failedCount: number;
  totalTokens: number;
  deactivatedTokens: number;
  warning?: string;
}

export interface NotifyClientResult {
  notification: ClientNotification;
  pushResult: ProcessUpdatePushResponse;
}

function hashTokenShort(token: string): string {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 10);
}

function stripUndefinedFields<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      out[key] = val;
    }
  }
  return out as T;
}

export function getEffectiveVapidKey(empresa?: Pick<EmpresaConfig, 'fcmVapidPublicKey'> | null): string {
  const envKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
  if (envKey) return envKey;
  return (empresa?.fcmVapidPublicKey || '').trim();
}

export async function getBrowserPushSupport(): Promise<BrowserPushSupport> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, fcmSupported: false, permission: 'unsupported' };
  }
  const hasSw = 'serviceWorker' in navigator;
  const fcmSupported = hasSw ? await isSupported().catch(() => false) : false;
  return {
    supported: true,
    fcmSupported,
    permission: Notification.permission,
  };
}

export async function hasActivePushTokenForUser(uid: string): Promise<boolean> {
  if (!uid) return false;
  try {
    const q = query(
      collection(db, 'fcmTokens'),
      where('uid', '==', uid),
      where('ativo', '==', true),
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'fcmTokens');
  }
}

export async function registerClientPushToken(params: {
  uid: string;
  clientId: string;
  vapidKey: string;
}): Promise<{ token: string; docId: string }> {
  const { uid, clientId, vapidKey } = params;
  const cleanVapid = vapidKey.trim();
  if (!cleanVapid) {
    throw new Error(
      'Chave pública Web Push (VAPID) ainda não configurada. Solicite ao administrador configurar em Site & Configurações.',
    );
  }

  const support = await getBrowserPushSupport();
  if (!support.fcmSupported) {
    throw new Error(
      'Este navegador não suporta notificações push em segundo plano via Firebase Cloud Messaging.',
    );
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'As notificações estão bloqueadas nas permissões do navegador. Libere o acesso para este site na barra de endereço.'
        : 'Permissão de notificações não concedida.',
    );
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
  });
  await navigator.serviceWorker.ready;

  const messaging = getMessaging(app);
  const fcmToken = await getToken(messaging, {
    vapidKey: cleanVapid,
    serviceWorkerRegistration: registration,
  });

  if (!fcmToken || fcmToken.trim().length < 10) {
    throw new Error(
      'Não foi possível obter o token do dispositivo no Firebase Cloud Messaging.',
    );
  }

  const docId = `fcm_${uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32)}_${hashTokenShort(fcmToken)}`;
  const nowIso = new Date().toISOString();
  const payload: FcmTokenRecord = {
    id: docId,
    uid,
    clientId,
    token: fcmToken,
    plataforma: 'web',
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 240),
    ativo: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  try {
    await setDoc(doc(db, 'fcmTokens', docId), stripUndefinedFields({ ...payload }));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `fcmTokens/${docId}`);
  }

  return { token: fcmToken, docId };
}

/**
 * Ativa notificações push no navegador do cliente:
 * 1) Quando a chave VAPID e o Firebase Cloud Messaging estão disponíveis, registra o token FCM completo (inclusive segundo plano).
 * 2) Caso contrário, solicita permissão nativa do navegador e ativa alertas instantâneos em tempo real via Firestore.
 */
export async function enableClientBrowserNotifications(params: {
  uid: string;
  clientId: string;
  vapidKey?: string;
}): Promise<EnableClientPushResult> {
  const { uid, clientId, vapidKey = '' } = params;
  const support = await getBrowserPushSupport();
  if (!support.supported) {
    throw new Error('Este navegador não suporta a API de notificações do sistema.');
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'As notificações estão bloqueadas nas permissões do navegador. Libere o acesso no ícone de cadeado da barra de endereço.'
        : 'Permissão de notificações não concedida.',
    );
  }

  const cleanVapid = vapidKey.trim();
  if (cleanVapid && support.fcmSupported) {
    try {
      const { token, docId } = await registerClientPushToken({
        uid,
        clientId,
        vapidKey: cleanVapid,
      });
      setBrowserRealtimePushOptedIn(uid, true);
      return {
        mode: 'fcm',
        token,
        docId,
      };
    } catch (fcmErr) {
      setBrowserRealtimePushOptedIn(uid, true);
      return {
        mode: 'browser_realtime',
        note:
          fcmErr instanceof Error
            ? `Alertas em tempo real ativados no navegador (FCM em segundo plano indisponível: ${fcmErr.message}).`
            : 'Alertas em tempo real ativados no navegador.',
      };
    }
  }

  setBrowserRealtimePushOptedIn(uid, true);
  return {
    mode: 'browser_realtime',
    note: 'Alertas instantâneos do navegador ativados! Você receberá avisos nativos sempre que seu processo for atualizado.',
  };
}

export async function deactivateUserPushTokens(uid: string): Promise<number> {
  if (!uid) return 0;
  setBrowserRealtimePushOptedIn(uid, false);
  try {
    const q = query(
      collection(db, 'fcmTokens'),
      where('uid', '==', uid),
      where('ativo', '==', true),
    );
    const snap = await getDocs(q);
    const nowIso = new Date().toISOString();
    await Promise.all(
      snap.docs.map((d) =>
        updateDoc(doc(db, 'fcmTokens', d.id), {
          ativo: false,
          updatedAt: nowIso,
        }),
      ),
    );
    return snap.size;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'fcmTokens');
  }
}

export function subscribeForegroundFcm(
  onPayload: (payload: MessagePayload) => void,
): () => void {
  let active = true;
  let unsubscribeFn: (() => void) | null = null;

  void getBrowserPushSupport().then((support) => {
    if (!active || !support.fcmSupported || Notification.permission !== 'granted') return;
    try {
      const messaging = getMessaging(app);
      unsubscribeFn = onMessage(messaging, (payload) => {
        if (active) onPayload(payload);
      });
    } catch {
      // Ignore if messaging cannot initialize in this frame
    }
  });

  return () => {
    active = false;
    if (unsubscribeFn) unsubscribeFn();
  };
}

export function subscribeClientNotifications(
  clientId: string,
  onUpdate: (notifications: ClientNotification[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  if (!clientId) {
    onUpdate([]);
    return () => {};
  }
  const q = query(
    collection(db, 'clientNotifications'),
    where('clientId', '==', clientId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<ClientNotification, 'id'>) }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      onUpdate(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'clientNotifications');
      } catch (handledErr) {
        onError?.(handledErr);
      }
    },
  );
}

export async function markClientNotificationRead(notificationId: string): Promise<void> {
  if (!notificationId) return;
  const nowIso = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'clientNotifications', notificationId), {
      lida: true,
      lidaEm: nowIso,
      updatedAt: nowIso,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `clientNotifications/${notificationId}`);
  }
}

export async function markAllClientNotificationsRead(
  notifications: ClientNotification[],
): Promise<void> {
  const unread = notifications.filter((n) => !n.lida);
  if (unread.length === 0) return;
  const nowIso = new Date().toISOString();
  try {
    await Promise.all(
      unread.map((n) =>
        updateDoc(doc(db, 'clientNotifications', n.id), {
          lida: true,
          lidaEm: nowIso,
          updatedAt: nowIso,
        }),
      ),
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'clientNotifications');
  }
}

export async function notifyClientProcessUpdate(
  input: ProcessUpdateNotificationInput,
): Promise<NotifyClientResult> {
  const notifId = makeId('notif');
  const nowIso = new Date().toISOString();

  const notification: ClientNotification = stripUndefinedFields({
    id: notifId,
    clientId: input.clientId,
    caseId: input.caseId,
    titulo: input.titulo.trim().slice(0, 190),
    mensagem: input.mensagem.trim().slice(0, 950),
    tipo: input.tipo,
    etapaPipeline: input.etapaPipeline,
    statusSermig: input.statusSermig,
    linkDestino: input.linkDestino || '/portal',
    lida: false,
    pushEnviado: false,
    pushEnviadosQtd: 0,
    criadoPorUid: input.criadoPorUid,
    criadoPorNome: input.criadoPorNome,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  try {
    await setDoc(doc(db, 'clientNotifications', notifId), notification);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `clientNotifications/${notifId}`);
  }

  let pushResult: ProcessUpdatePushResponse = {
    ok: false,
    sentCount: 0,
    failedCount: 0,
    totalTokens: 0,
    deactivatedTokens: 0,
    warning: 'Sessão não autenticada para disparo push.',
  };

  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    if (idToken) {
      const resp = await fetch('/api/notifications/process-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          clientId: input.clientId,
          caseId: input.caseId,
          notificationId: notifId,
          tipo: input.tipo,
          titulo: notification.titulo,
          mensagem: notification.mensagem,
          etapaPipeline: input.etapaPipeline,
          statusSermig: input.statusSermig,
          targetUrl: input.linkDestino || '/portal',
        }),
      });
      if (resp.ok) {
        pushResult = (await resp.json()) as ProcessUpdatePushResponse;
      } else {
        const errBody = (await resp.json().catch(() => ({}))) as { error?: string };
        pushResult = {
          ok: false,
          sentCount: 0,
          failedCount: 0,
          totalTokens: 0,
          deactivatedTokens: 0,
          warning: errBody.error || `HTTP ${resp.status}`,
        };
      }
    }
  } catch (err) {
    pushResult = {
      ok: false,
      sentCount: 0,
      failedCount: 0,
      totalTokens: 0,
      deactivatedTokens: 0,
      warning: err instanceof Error ? err.message : 'Falha de rede no envio FCM.',
    };
  }

  return { notification, pushResult };
}
