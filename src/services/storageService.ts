import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { storage } from '../firebase';
import type {
  CaseDocument,
  CaseDocumentReviewMetadata,
  DocumentStorageBackend,
} from '../types/domain';
import {
  buildDocumentReviewMetadata,
  validateClientUploadFile,
} from '../utils/documentUploadMetadata';
import { convertRasterImageFileToWebp, uploadFileToServer } from './firestoreService';

export interface SecureClientDocumentUploadResult {
  downloadUrl: string;
  storagePath?: string;
  storageBackend: DocumentStorageBackend;
  arquivoNome: string;
  arquivoMimeType: string;
  arquivoTamanhoBytes: number;
  metadataTags: string[];
  reviewMetadata: CaseDocumentReviewMetadata;
  nextVersion: number;
  uploadedAt: string;
  usedFallbackStorage: boolean;
}

function uploadToFirebaseStorageWithProgress(params: {
  file: File;
  storagePath: string;
  contentType: string;
  customMetadata: Record<string, string>;
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const storageRef = ref(storage, params.storagePath);
    const task = uploadBytesResumable(storageRef, params.file, {
      contentType: params.contentType,
      customMetadata: params.customMetadata,
    });

    let settled = false;
    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          task.cancel();
        } catch {
          // ignore
        }
        reject(new Error('storage/timeout: Tempo limite excedido ao enviar para o Firebase Storage.'));
      }
    }, params.timeoutMs ?? 25000);

    task.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 92);
          params.onProgress?.(Math.min(92, Math.max(5, pct)));
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeoutId);
          reject(error);
        }
      },
      async () => {
        if (settled) return;
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          settled = true;
          clearTimeout(timeoutId);
          params.onProgress?.(100);
          resolve(url);
        } catch (err) {
          settled = true;
          clearTimeout(timeoutId);
          reject(err);
        }
      },
    );
  });
}

/**
 * Uploads a client immigration document to Firebase Storage with automatic
 * internal-review custom metadata tagging. Falls back cleanly to server/inline
 * upload if Firebase Storage bucket rules or CORS are unavailable in the
 * current environment, while preserving all structured review metadata tags.
 */
export async function uploadClientDocumentSecure(params: {
  file: File;
  docItem: CaseDocument;
  uploadedByUid: string;
  uploadedByEmail: string;
  onProgress?: (percent: number) => void;
}): Promise<SecureClientDocumentUploadResult> {
  const validation = validateClientUploadFile({
    name: params.file.name,
    type: params.file.type,
    size: params.file.size,
  });

  if (!validation.valid) {
    throw new Error(validation.error || 'Arquivo inválido para envio.');
  }

  // Pré-processa imagens enviadas (JPG/PNG) automaticamente para WebP mantendo legibilidade documental
  const preparedFile =
    validation.mimeType === 'application/pdf'
      ? params.file
      : await convertRasterImageFileToWebp(params.file, 1600, 0.85);
  const effectiveMimeType =
    preparedFile.type === 'image/webp' ? 'image/webp' : validation.mimeType;

  const nextVersion = params.docItem.arquivoUrl ? Math.max(1, params.docItem.versao || 1) + 1 : Math.max(1, params.docItem.versao || 1);
  const nowIso = new Date().toISOString();

  const built = buildDocumentReviewMetadata({
    doc: params.docItem,
    file: {
      name: preparedFile.name,
      type: effectiveMimeType,
      size: preparedFile.size,
    },
    mimeType: effectiveMimeType,
    nextVersion,
    uploadedByUid: params.uploadedByUid,
    uploadedByEmail: params.uploadedByEmail,
    nowIso,
  });

  params.onProgress?.(8);

  try {
    const downloadUrl = await uploadToFirebaseStorageWithProgress({
      file: preparedFile,
      storagePath: built.storagePath,
      contentType: effectiveMimeType,
      customMetadata: built.customMetadata,
      onProgress: params.onProgress,
    });

    return {
      downloadUrl,
      storagePath: built.storagePath,
      storageBackend: 'firebase_storage',
      arquivoNome: built.sanitizedFileName,
      arquivoMimeType: effectiveMimeType,
      arquivoTamanhoBytes: preparedFile.size,
      metadataTags: built.metadataTags,
      reviewMetadata: built.reviewMetadata,
      nextVersion,
      uploadedAt: nowIso,
      usedFallbackStorage: false,
    };
  } catch (storageErr) {
    console.warn(
      '[StorageService] Firebase Storage indisponível para este upload; aplicando fallback seguro com metadados preservados:',
      storageErr instanceof Error ? storageErr.message : String(storageErr),
    );
    params.onProgress?.(45);
    const fallbackRes = await uploadFileToServer(preparedFile);
    const fallbackUrl = fallbackRes.url;
    params.onProgress?.(100);

    const backend: DocumentStorageBackend = fallbackUrl.startsWith('data:')
      ? 'inline_data_url'
      : 'server_upload';

    return {
      downloadUrl: fallbackUrl,
      storagePath: undefined,
      storageBackend: backend,
      arquivoNome: fallbackRes.filename || built.sanitizedFileName,
      arquivoMimeType: fallbackRes.mimeType || effectiveMimeType,
      arquivoTamanhoBytes: fallbackRes.size || preparedFile.size,
      metadataTags: built.metadataTags,
      reviewMetadata: {
        ...built.reviewMetadata,
        storagePath: undefined,
      },
      nextVersion,
      uploadedAt: nowIso,
      usedFallbackStorage: true,
    };
  }
}
