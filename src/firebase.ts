import { getApp, getApps, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, GoogleAuthProvider, setPersistence } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getMessaging, isSupported as isMessagingSupported, type Messaging } from 'firebase/messaging';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { reportAppError } from './services/errorService';

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseProjectId = firebaseConfig.projectId;
export const firebaseDatabaseId = firebaseConfig.firestoreDatabaseId;
export const firebaseConfigSummary = {
  projectId: firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  firestoreDatabaseId: firebaseConfig.firestoreDatabaseId,
  storageBucket: firebaseConfig.storageBucket,
  messagingSenderId: firebaseConfig.messagingSenderId,
  appId: firebaseConfig.appId,
} as const;

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
auth.languageCode = 'pt-BR';

let cachedMessaging: Messaging | null = null;

/**
 * Lazily resolves Firebase Cloud Messaging only in browsers that support Web Push & Service Workers.
 */
export async function getFirebaseMessagingSafe(): Promise<Messaging | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  const supported = await isMessagingSupported().catch(() => false);
  if (!supported) return null;
  if (!cachedMessaging) {
    cachedMessaging = getMessaging(app);
  }
  return cachedMessaging;
}

if (typeof window !== 'undefined') {
  void setPersistence(auth, browserLocalPersistence).catch(() => {
    // Fallback automático caso o navegador bloqueie localStorage em modo restrito
  });
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);
  const enrichedError = new Error(serialized);
  reportAppError(enrichedError, {
    source: 'firestore',
    operation: operationType,
    path,
  });
  throw enrichedError;
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'config', 'empresa'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Erro de conexão com o Firestore. Verifique a configuração do Firebase.');
      reportAppError(error, {
        source: 'firestore-connection',
        operation: OperationType.GET,
        path: 'config/empresa',
      });
    }
    return false;
  }
}

void testConnection();
