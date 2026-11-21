import type {
  CaseDocument,
  CaseDocumentReviewMetadata,
  DocumentReviewPriority,
} from '../types/domain';

export const MAX_CLIENT_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_MAP: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const ALLOWED_EXT_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  mimeType: string;
  extension: string;
}

export function slugifyTagPart(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function sanitizeUploadFilename(originalName: string): string {
  const trimmed = (originalName || 'documento').trim();
  const lastDot = trimmed.lastIndexOf('.');
  const rawBase = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const rawExt = lastDot > 0 ? trimmed.slice(lastDot + 1).toLowerCase() : '';

  const cleanBase = rawBase
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90);

  const cleanExt = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 8);
  const safeBase = cleanBase || 'documento';
  return cleanExt ? `${safeBase}.${cleanExt}` : safeBase;
}

export function validateClientUploadFile(file: {
  name: string;
  type: string;
  size: number;
}): FileValidationResult {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    return {
      valid: false,
      error: 'O arquivo selecionado está vazio. Escolha um PDF ou imagem legível.',
      mimeType: '',
      extension: '',
    };
  }

  if (file.size > MAX_CLIENT_UPLOAD_BYTES) {
    return {
      valid: false,
      error: 'O arquivo excede o limite de 10 MB. Compacte o PDF ou reduza a resolução da imagem.',
      mimeType: file.type || '',
      extension: '',
    };
  }

  const normalizedType = (file.type || '').trim().toLowerCase();
  const extFromName = (file.name || '').split('.').pop()?.toLowerCase() || '';

  if (normalizedType && ALLOWED_MIME_MAP[normalizedType]) {
    return {
      valid: true,
      mimeType: normalizedType === 'image/jpg' ? 'image/jpeg' : normalizedType,
      extension: ALLOWED_MIME_MAP[normalizedType],
    };
  }

  if (extFromName && ALLOWED_EXT_MAP[extFromName]) {
    return {
      valid: true,
      mimeType: ALLOWED_EXT_MAP[extFromName],
      extension: extFromName === 'jpeg' ? 'jpg' : extFromName,
    };
  }

  return {
    valid: false,
    error: 'Formato não permitido. Envie somente arquivos PDF, JPG, PNG ou WEBP.',
    mimeType: normalizedType,
    extension: extFromName,
  };
}

export function formatFileSizeBytes(bytes?: number): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function buildClientStoragePath(params: {
  clientId: string;
  caseId: string;
  documentId: string;
  version: number;
  originalFileName: string;
}): string {
  const safeClient = params.clientId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'client';
  const safeCase = params.caseId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'case';
  const safeDoc = params.documentId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'doc';
  const safeVer = Math.max(1, Math.round(params.version || 1));
  const safeFile = sanitizeUploadFilename(params.originalFileName);
  return `clients/${safeClient}/cases/${safeCase}/documents/${safeDoc}/v${safeVer}_${safeFile}`.slice(0, 500);
}

export function computeReviewPriority(doc: Pick<CaseDocument, 'obrigatorio' | 'validadeDias' | 'status'>): DocumentReviewPriority {
  if (doc.status === 'Reprovado' || doc.status === 'Vencido') {
    return 'alta';
  }
  if (doc.obrigatorio && doc.validadeDias > 0 && doc.validadeDias <= 90) {
    return 'alta';
  }
  if (doc.obrigatorio) {
    return 'media';
  }
  return 'normal';
}

export interface BuiltDocumentUploadMetadata {
  storagePath: string;
  sanitizedFileName: string;
  customMetadata: Record<string, string>;
  reviewMetadata: CaseDocumentReviewMetadata;
  metadataTags: string[];
}

/**
 * Generates deterministic Firebase Storage customMetadata and structured Firestore
 * review tags so internal staff can triage uploaded client documents immediately.
 */
export function buildDocumentReviewMetadata(params: {
  doc: CaseDocument;
  file: { name: string; type: string; size: number };
  mimeType: string;
  nextVersion: number;
  uploadedByUid: string;
  uploadedByEmail: string;
  nowIso?: string;
}): BuiltDocumentUploadMetadata {
  const nowIso = params.nowIso || new Date().toISOString();
  const sanitizedFileName = sanitizeUploadFilename(params.file.name);
  const storagePath = buildClientStoragePath({
    clientId: params.doc.clientId,
    caseId: params.doc.caseId,
    documentId: params.doc.id,
    version: params.nextVersion,
    originalFileName: params.file.name,
  });

  const priority = computeReviewPriority(params.doc);
  const isTitular = params.doc.pessoa.trim().toLowerCase() === 'titular';
  const catSlug = slugifyTagPart(params.doc.categoriaDoc) || 'geral';
  const isPdf = params.mimeType === 'application/pdf';

  const tags: string[] = [
    'pendente-revisao',
    `prioridade-${priority}`,
    params.doc.obrigatorio ? 'obrigatorio' : 'opcional',
    `cat:${catSlug}`,
    isTitular ? 'titular' : 'dependente',
    isPdf ? 'formato-pdf' : 'formato-imagem',
    `v${params.nextVersion}`,
  ];

  if (params.doc.exigeApostila && !params.doc.apostilado) {
    tags.push('apostila-haia');
  }
  if (params.doc.exigeTraducao && !params.doc.traduzido) {
    tags.push('traducao-juramentada');
  }
  if (params.doc.validadeDias > 0 && params.doc.validadeDias <= 90) {
    tags.push('validade-curta');
  }
  if (params.doc.status === 'Reprovado' || params.doc.status === 'Vencido') {
    tags.push('reenvio-correcao');
  }

  const dedupedTags = Array.from(new Set(tags)).slice(0, 20);

  const reviewMetadata: CaseDocumentReviewMetadata = {
    reviewStatus: 'pending_internal_review',
    reviewPriority: priority,
    documentCategory: params.doc.categoriaDoc,
    person: params.doc.pessoa,
    version: params.nextVersion,
    requiresApostille: Boolean(params.doc.exigeApostila),
    requiresTranslation: Boolean(params.doc.exigeTraducao),
    mandatory: Boolean(params.doc.obrigatorio),
    uploadedByUid: params.uploadedByUid.slice(0, 128),
    uploadedByEmail: params.uploadedByEmail.trim().toLowerCase().slice(0, 200),
    uploadedAt: nowIso,
    originalFileName: params.file.name.trim().slice(0, 250),
    sanitizedFileName: sanitizedFileName.slice(0, 250),
    mimeType: params.mimeType.slice(0, 100),
    fileSizeBytes: params.file.size,
    storagePath,
    expirationDays: params.doc.validadeDias > 0 ? params.doc.validadeDias : undefined,
  };

  // Firebase Storage customMetadata values must be strings
  const customMetadata: Record<string, string> = {
    clientId: params.doc.clientId,
    caseId: params.doc.caseId,
    documentId: params.doc.id,
    documentName: params.doc.nomeDocumento.slice(0, 180),
    documentCategory: params.doc.categoriaDoc,
    person: params.doc.pessoa.slice(0, 80),
    version: String(params.nextVersion),
    reviewStatus: reviewMetadata.reviewStatus,
    reviewPriority: priority,
    mandatory: String(Boolean(params.doc.obrigatorio)),
    requiresApostille: String(Boolean(params.doc.exigeApostila)),
    requiresTranslation: String(Boolean(params.doc.exigeTraducao)),
    uploadedByUid: reviewMetadata.uploadedByUid,
    uploadedByEmail: reviewMetadata.uploadedByEmail,
    uploadedAt: nowIso,
    reviewTags: dedupedTags.join(','),
  };

  return {
    storagePath,
    sanitizedFileName,
    customMetadata,
    reviewMetadata,
    metadataTags: dedupedTags,
  };
}

const TAG_LABEL_MAP: Record<string, string> = {
  'pendente-revisao': 'Revisão interna pendente',
  'prioridade-alta': 'Prioridade alta',
  'prioridade-media': 'Prioridade média',
  'prioridade-normal': 'Prioridade normal',
  obrigatorio: 'Obrigatório',
  opcional: 'Opcional',
  titular: 'Titular',
  dependente: 'Dependente',
  'formato-pdf': 'PDF',
  'formato-imagem': 'Imagem',
  'apostila-haia': 'Exige Apostila de Haia',
  'traducao-juramentada': 'Exige Tradução',
  'validade-curta': 'Validade curta',
  'reenvio-correcao': 'Reenvio após pendência',
};

export function formatReviewTagLabel(tag: string): string {
  if (TAG_LABEL_MAP[tag]) return TAG_LABEL_MAP[tag];
  if (tag.startsWith('cat:')) {
    const raw = tag.slice(4).replace(/-/g, ' ');
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Categoria';
  }
  if (/^v\d+$/.test(tag)) {
    return `Versão ${tag.slice(1)}`;
  }
  return tag;
}
