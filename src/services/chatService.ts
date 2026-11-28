import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type { CommunicationLog, UserRole } from '../types/domain';
import { ensureSignedInClientPortalSynced, makeId, saveDocumentAudited } from './firestoreService';
import { notifyClientProcessUpdate } from './notificationService';
import {
  buildClientDocumentChatPayload,
  buildStaffChatReplyPayload,
  sortChatMessagesChronologically,
} from '../utils/documentChat';
import { normalizeCollectionWritePayload } from '../utils/firestoreUtils';
import {
  getDevE2eDataset,
  isDevE2eActive,
  subscribeDevE2eChanges,
} from '../utils/devE2eBridge';

function isPermissionDeniedError(err: unknown): boolean {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '').toLowerCase()
      : '';
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    code.includes('permission-denied') ||
    msg.includes('permission-denied') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('insufficient permissions')
  );
}

/**
 * Revalida o token JWT do Firebase Auth e sincroniza o vínculo `users/{uid}.clientId`
 * antes de repetir leituras ou envios no Chat Portal.
 */
export async function resyncPortalChatSession(): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;
  try {
    await currentUser.getIdToken(true);
    await ensureSignedInClientPortalSynced();
    return true;
  } catch {
    return false;
  }
}

export function subscribeClientDocumentChat(
  clientId: string,
  onUpdate: (messages: CommunicationLog[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  if (!clientId) {
    onUpdate([]);
    return () => {};
  }
  if (import.meta.env.DEV && isDevE2eActive()) {
    const emit = () => {
      const list = getDevE2eDataset().communicationLogs.filter(
        (l) => l.clientId === clientId && l.canal === 'Chat Portal',
      );
      onUpdate(sortChatMessagesChronologically(list));
    };
    emit();
    return subscribeDevE2eChanges(emit);
  }

  let disposed = false;
  let retriedAfterSync = false;
  let activeUnsub: Unsubscribe | null = null;

  const attachListener = () => {
    if (disposed) return;
    const q = query(
      collection(db, 'communicationLogs'),
      where('clientId', '==', clientId),
      where('canal', '==', 'Chat Portal'),
    );
    activeUnsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<CommunicationLog, 'id'>),
        }));
        onUpdate(sortChatMessagesChronologically(list));
      },
      (err) => {
        if (!disposed && !retriedAfterSync && isPermissionDeniedError(err) && auth.currentUser) {
          retriedAfterSync = true;
          activeUnsub?.();
          activeUnsub = null;
          void resyncPortalChatSession().finally(() => {
            if (!disposed) {
              attachListener();
            }
          });
          return;
        }
        console.warn(
          '[Portal] Falha na assinatura de communicationLogs (Chat Portal):',
          err instanceof Error ? err.message : String(err),
        );
        onError?.(err);
      },
    );
  };

  attachListener();

  return () => {
    disposed = true;
    activeUnsub?.();
    activeUnsub = null;
  };
}

export function subscribeStaffDocumentChat(
  onUpdate: (messages: CommunicationLog[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  if (import.meta.env.DEV && isDevE2eActive()) {
    const emit = () => {
      const list = getDevE2eDataset().communicationLogs.filter((l) => l.canal === 'Chat Portal');
      onUpdate(sortChatMessagesChronologically(list));
    };
    emit();
    return subscribeDevE2eChanges(emit);
  }
  const q = query(
    collection(db, 'communicationLogs'),
    where('canal', '==', 'Chat Portal'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<CommunicationLog, 'id'>),
      }));
      onUpdate(sortChatMessagesChronologically(list));
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'communicationLogs');
      } catch (handledErr) {
        onError?.(handledErr);
      }
    },
  );
}

export async function sendClientDocumentQuestion(params: {
  clientId: string;
  caseId?: string;
  remetenteUid: string;
  autorNome: string;
  mensagem: string;
  assunto?: string;
  documentId?: string;
  documentNome?: string;
}): Promise<CommunicationLog> {
  const id = makeId('chat');
  // Sempre prioriza o UID autenticado real do Firebase Auth para garantir conformidade estrita
  // com `incoming().remetenteUid == request.auth.uid` em firestore.rules.
  const effectiveUid = (auth.currentUser?.uid || params.remetenteUid || '').trim();
  const payload = buildClientDocumentChatPayload({
    id,
    clientId: params.clientId,
    caseId: params.caseId,
    remetenteUid: effectiveUid,
    autorNome: params.autorNome,
    mensagem: params.mensagem,
    assunto: params.assunto,
    documentId: params.documentId,
    documentNome: params.documentNome,
  });

  const cleanPayload = normalizeCollectionWritePayload(
    'communicationLogs',
    id,
    { ...payload } as unknown as Record<string, unknown>,
  );

  try {
    await setDoc(doc(db, 'communicationLogs', id), cleanPayload);
  } catch (err) {
    if (isPermissionDeniedError(err) && auth.currentUser) {
      try {
        await resyncPortalChatSession();
        await setDoc(doc(db, 'communicationLogs', id), cleanPayload);
        return payload;
      } catch (retryErr) {
        handleFirestoreError(retryErr, OperationType.CREATE, `communicationLogs/${id}`);
      }
    }
    handleFirestoreError(err, OperationType.CREATE, `communicationLogs/${id}`);
  }
  return payload;
}

export async function markClientChatRepliesRead(messages: CommunicationLog[]): Promise<void> {
  const unread = messages.filter(
    (m) => m.canal === 'Chat Portal' && m.origem === 'equipe' && m.lidaPeloCliente !== true,
  );
  if (unread.length === 0) return;
  const nowIso = new Date().toISOString();
  const performBatch = () =>
    Promise.all(
      unread.map((m) =>
        updateDoc(doc(db, 'communicationLogs', m.id), {
          lidaPeloCliente: true,
          updatedAt: nowIso,
        }),
      ),
    );
  try {
    await performBatch();
  } catch (err) {
    if (isPermissionDeniedError(err) && auth.currentUser) {
      try {
        await resyncPortalChatSession();
        await performBatch();
        return;
      } catch (retryErr) {
        handleFirestoreError(retryErr, OperationType.UPDATE, 'communicationLogs');
      }
    }
    handleFirestoreError(err, OperationType.UPDATE, 'communicationLogs');
  }
}

export async function markStaffChatQuestionsRead(messages: CommunicationLog[]): Promise<void> {
  const unread = messages.filter(
    (m) => m.canal === 'Chat Portal' && m.origem === 'cliente' && m.lidaPelaEquipe !== true,
  );
  if (unread.length === 0) return;
  const nowIso = new Date().toISOString();
  try {
    await Promise.all(
      unread.map((m) =>
        updateDoc(doc(db, 'communicationLogs', m.id), {
          lidaPelaEquipe: true,
          updatedAt: nowIso,
        }),
      ),
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, 'communicationLogs');
  }
}

export async function sendStaffDocumentChatReply(params: {
  clientId: string;
  caseId?: string;
  remetenteUid?: string;
  autorNome: string;
  mensagem: string;
  documentId?: string;
  documentNome?: string;
  role: UserRole;
  existingCaseChatLogs?: CommunicationLog[];
  sendPushAlert?: boolean;
}): Promise<CommunicationLog> {
  const id = makeId('chat');
  const effectiveUid = (auth.currentUser?.uid || params.remetenteUid || '').trim() || undefined;
  const payload = buildStaffChatReplyPayload({
    id,
    clientId: params.clientId,
    caseId: params.caseId,
    remetenteUid: effectiveUid,
    autorNome: params.autorNome,
    mensagem: params.mensagem,
    documentId: params.documentId,
    documentNome: params.documentNome,
  });

  await saveDocumentAudited(
    'communicationLogs',
    id,
    payload as unknown as Record<string, unknown>,
    true,
    params.role,
    'chat_portal_resposta',
  );

  if (params.existingCaseChatLogs && params.existingCaseChatLogs.length > 0) {
    await markStaffChatQuestionsRead(params.existingCaseChatLogs).catch(() => undefined);
  }

  if (params.sendPushAlert) {
    await notifyClientProcessUpdate({
      clientId: params.clientId,
      caseId: params.caseId,
      tipo: 'mensagem_equipe',
      titulo: payload.documentNome
        ? `Mensagem da equipe sobre: ${payload.documentNome}`.slice(0, 190)
        : 'Nova mensagem da equipe no Portal',
      mensagem: payload.mensagem.slice(0, 300),
      linkDestino: payload.documentId ? '/portal?tab=documentos' : '/portal?tab=suporte',
      criadoPorUid: effectiveUid,
      criadoPorNome: params.autorNome,
    }).catch(() => undefined);
  }

  return payload;
}
