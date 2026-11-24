import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type { IdentityDocumentType, UserIdentityDocument, UserRole } from '../types/domain';
import { registrarAuditoria } from '../utils/audit';
import { sanitizeFirestoreData } from '../utils/firestoreUtils';
import {
  buildIdentityDocumentFileName,
  sortIdentityDocsNewestFirst,
  validateIdentityDocumentPayload,
} from '../utils/identityDocumentScan';
import { makeId } from './firestoreService';

export interface SaveUserIdentityDocumentInput {
  docType: IdentityDocumentType;
  title: string;
  documentNumber?: string;
  issuingCountry?: string;
  expirationDate?: string;
  notes?: string;
  mimeType: 'image/jpeg' | 'image/webp' | 'image/png';
  sizeBytes: number;
  width?: number;
  height?: number;
  imageDataUrl: string;
  captureMethod: 'camera' | 'upload';
  enhancedScan?: boolean;
  fileName?: string;
}

export interface UpdateUserIdentityDocumentMetadataInput {
  docType: IdentityDocumentType;
  title: string;
  documentNumber?: string;
  issuingCountry?: string;
  expirationDate?: string;
  notes?: string;
}

function getIdentityCollectionPath(uid: string): string {
  return `users/${uid}/identityDocuments`;
}

/**
 * Fetches all scanned identification documents stored directly in a user's
 * Firestore profile subcollection (`/users/{uid}/identityDocuments`).
 * Includes explicit `where('ownerUid', '==', uid)` to satisfy Secure List Queries.
 */
export async function listUserIdentityDocuments(uid: string): Promise<UserIdentityDocument[]> {
  if (!uid) return [];
  const colPath = getIdentityCollectionPath(uid);
  try {
    const q = query(collection(db, 'users', uid, 'identityDocuments'), where('ownerUid', '==', uid));
    const snap = await getDocs(q);
    const items = snap.docs.map((d) => ({
      ...(d.data() as UserIdentityDocument),
      id: d.id,
    }));
    return sortIdentityDocsNewestFirst(items);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

/**
 * Subscribes in real time to a user's stored identification documents in Firestore.
 */
export function subscribeUserIdentityDocuments(
  uid: string,
  onData: (docs: UserIdentityDocument[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  if (!uid) {
    onData([]);
    return () => undefined;
  }
  const colPath = getIdentityCollectionPath(uid);
  const q = query(collection(db, 'users', uid, 'identityDocuments'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({
        ...(d.data() as UserIdentityDocument),
        id: d.id,
      }));
      onData(sortIdentityDocsNewestFirst(items));
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch {
        // Already logged and reported by handleFirestoreError; avoid unhandled rejection in listener
      }
    },
  );
}

/**
 * Validates and saves a scanned identification document directly into
 * `/users/{uid}/identityDocuments/{docId}` on Firestore.
 */
export async function saveUserIdentityDocument(
  uid: string,
  input: SaveUserIdentityDocumentInput,
  actorRole: UserRole = 'cliente',
): Promise<UserIdentityDocument> {
  const nowIso = new Date().toISOString();
  const docId = makeId('iddoc');
  const title = input.title.trim();
  const fileName =
    input.fileName?.trim() ||
    buildIdentityDocumentFileName(input.docType, title, input.mimeType);

  const validation = validateIdentityDocumentPayload({
    id: docId,
    ownerUid: uid,
    docType: input.docType,
    title,
    documentNumber: input.documentNumber,
    issuingCountry: input.issuingCountry,
    expirationDate: input.expirationDate,
    notes: input.notes,
    fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    imageDataUrl: input.imageDataUrl,
    captureMethod: input.captureMethod,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Dados do documento de identificação inválidos.');
  }

  const payload: UserIdentityDocument = sanitizeFirestoreData({
    id: docId,
    ownerUid: uid,
    docType: input.docType,
    title,
    documentNumber: input.documentNumber?.trim() || undefined,
    issuingCountry: input.issuingCountry?.trim() || undefined,
    expirationDate: input.expirationDate?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    fileName,
    mimeType: input.mimeType,
    sizeBytes: Math.round(input.sizeBytes),
    width: typeof input.width === 'number' ? Math.round(input.width) : undefined,
    height: typeof input.height === 'number' ? Math.round(input.height) : undefined,
    imageDataUrl: input.imageDataUrl,
    storageBackend: 'firestore_profile' as const,
    captureMethod: input.captureMethod,
    enhancedScan: Boolean(input.enhancedScan),
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const docPath = `${getIdentityCollectionPath(uid)}/${docId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'identityDocuments', docId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }

  await registrarAuditoria(
    'CRIAR_DOCUMENTO_IDENTIDADE_PERFIL',
    'userIdentityDocuments',
    docId,
    input.docType,
    null,
    {
      docType: payload.docType,
      title: payload.title,
      captureMethod: payload.captureMethod,
      sizeBytes: payload.sizeBytes,
    },
    actorRole,
  );

  return payload;
}

/**
 * Updates only editable metadata fields on an existing profile identity document
 * (preserving immutable `ownerUid`, `id`, `imageDataUrl`, and `createdAt`).
 */
export async function updateUserIdentityDocumentMetadata(
  uid: string,
  existingDoc: UserIdentityDocument,
  patch: UpdateUserIdentityDocumentMetadataInput,
  actorRole: UserRole = 'cliente',
): Promise<void> {
  const nowIso = new Date().toISOString();
  const title = patch.title.trim();

  const validation = validateIdentityDocumentPayload({
    id: existingDoc.id,
    ownerUid: existingDoc.ownerUid,
    docType: patch.docType,
    title,
    documentNumber: patch.documentNumber,
    issuingCountry: patch.issuingCountry,
    expirationDate: patch.expirationDate,
    notes: patch.notes,
    fileName: existingDoc.fileName,
    mimeType: existingDoc.mimeType,
    sizeBytes: existingDoc.sizeBytes,
    imageDataUrl: existingDoc.imageDataUrl,
    captureMethod: existingDoc.captureMethod,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Metadados inválidos.');
  }

  const updateBody = {
    docType: patch.docType,
    title,
    documentNumber: patch.documentNumber?.trim() || deleteField(),
    issuingCountry: patch.issuingCountry?.trim() || deleteField(),
    expirationDate: patch.expirationDate?.trim() || deleteField(),
    notes: patch.notes?.trim() || deleteField(),
    updatedAt: nowIso,
  };

  const docPath = `${getIdentityCollectionPath(uid)}/${existingDoc.id}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'identityDocuments', existingDoc.id), updateBody);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }

  await registrarAuditoria(
    'ATUALIZAR_DOCUMENTO_IDENTIDADE_PERFIL',
    'userIdentityDocuments',
    existingDoc.id,
    patch.docType,
    { title: existingDoc.title, docType: existingDoc.docType },
    { title, docType: patch.docType },
    actorRole,
  );
}

/**
 * Deletes a scanned identification document from the user's Firestore profile.
 */
export async function deleteUserIdentityDocument(
  uid: string,
  docId: string,
  actorRole: UserRole = 'cliente',
): Promise<void> {
  const docPath = `${getIdentityCollectionPath(uid)}/${docId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'identityDocuments', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }

  await registrarAuditoria(
    'EXCLUIR_DOCUMENTO_IDENTIDADE_PERFIL',
    'userIdentityDocuments',
    docId,
    'registro',
    docId,
    null,
    actorRole,
  );
}
