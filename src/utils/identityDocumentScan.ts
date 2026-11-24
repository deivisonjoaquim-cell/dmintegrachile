import type { IdentityDocumentType, UserIdentityDocument } from '../types/domain';

// Synchronized verbatim with firebase-blueprint.json & firestore.rules
export const IDENTITY_DOC_MAX_DATA_URL_LENGTH = 650_000;
export const IDENTITY_DOC_MAX_SIZE_BYTES = 600_000;
export const IDENTITY_DOC_TITLE_MIN_LENGTH = 2;
export const IDENTITY_DOC_TITLE_MAX_LENGTH = 140;
export const IDENTITY_DOC_NUMBER_MAX_LENGTH = 60;
export const IDENTITY_DOC_COUNTRY_MAX_LENGTH = 60;
export const IDENTITY_DOC_EXPIRATION_MAX_LENGTH = 20;
export const IDENTITY_DOC_NOTES_MAX_LENGTH = 500;
export const IDENTITY_DOC_FILENAME_MAX_LENGTH = 200;
export const IDENTITY_DOC_MAX_SOURCE_UPLOAD_BYTES = 15 * 1024 * 1024;

export const SAFE_IDENTITY_DATA_URL_REGEX =
  /^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/;
export const IDENTITY_DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface IdentityDocTypeMeta {
  value: IdentityDocumentType;
  label: string;
  shortLabel: string;
  defaultTitle: string;
  defaultCountry: string;
  hint: string;
  aspectRatioLabel: string;
}

export const IDENTITY_DOC_TYPE_OPTIONS: IdentityDocTypeMeta[] = [
  {
    value: 'passaporte',
    label: 'Passaporte (Página de Dados)',
    shortLabel: 'Passaporte',
    defaultTitle: 'Passaporte — Página de Identificação',
    defaultCountry: 'Brasil',
    hint: 'Abra o passaporte plano e enquadre a página da foto e zona MRZ sem reflexos.',
    aspectRatioLabel: 'Passaporte aberto (1.42:1)',
  },
  {
    value: 'rg_cin',
    label: 'RG / CIN (Identidade Brasileira)',
    shortLabel: 'RG / CIN',
    defaultTitle: 'RG / Carteira de Identidade Nacional',
    defaultCountry: 'Brasil',
    hint: 'Posicione o documento sobre fundo escuro e garanta que CPF, foto e data de emissão estejam legíveis.',
    aspectRatioLabel: 'Cartão ID (1.58:1)',
  },
  {
    value: 'cedula_chile',
    label: 'Cédula de Identidad / RUT (Chile)',
    shortLabel: 'Cédula / RUT',
    defaultTitle: 'Cédula de Identidad Chilena (RUT)',
    defaultCountry: 'Chile',
    hint: 'Enquadre frente ou verso da Cédula Chilena evitando brilho no chip/código QR.',
    aspectRatioLabel: 'Cartão ID (1.58:1)',
  },
  {
    value: 'cnh',
    label: 'CNH (Carteira de Habilitação)',
    shortLabel: 'CNH',
    defaultTitle: 'Carteira Nacional de Habilitação (CNH)',
    defaultCountry: 'Brasil',
    hint: 'Capture a parte frontal com foto e número de registro bem nítidos.',
    aspectRatioLabel: 'Cartão ID (1.58:1)',
  },
  {
    value: 'cpf',
    label: 'Comprovante de CPF',
    shortLabel: 'CPF',
    defaultTitle: 'Comprovante de Inscrição no CPF',
    defaultCountry: 'Brasil',
    hint: 'Capture o cartão ou comprovante emitido pela Receita Federal.',
    aspectRatioLabel: 'Documento (1.58:1)',
  },
  {
    value: 'comprovante_residencia',
    label: 'Comprovante de Residência',
    shortLabel: 'Residência',
    defaultTitle: 'Comprovante de Endereço Atualizado',
    defaultCountry: 'Brasil',
    hint: 'Mostre claramente seu nome completo, endereço e data de emissão recente.',
    aspectRatioLabel: 'Folha A4 / Conta',
  },
  {
    value: 'outro',
    label: 'Outro Documento Oficial',
    shortLabel: 'Outro ID',
    defaultTitle: 'Documento de Identificação Complementar',
    defaultCountry: 'Brasil',
    hint: 'Enquadre todas as bordas do documento em local bem iluminado.',
    aspectRatioLabel: 'Documento',
  },
];

const VALID_DOC_TYPES = new Set<string>(IDENTITY_DOC_TYPE_OPTIONS.map((item) => item.value));
const VALID_MIME_TYPES = new Set<string>(['image/jpeg', 'image/webp', 'image/png']);

export function getIdentityDocTypeMeta(docType: IdentityDocumentType): IdentityDocTypeMeta {
  return (
    IDENTITY_DOC_TYPE_OPTIONS.find((opt) => opt.value === docType) ||
    IDENTITY_DOC_TYPE_OPTIONS[IDENTITY_DOC_TYPE_OPTIONS.length - 1]
  );
}

export function estimateBase64ByteSize(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const base64 = dataUrl.slice(commaIdx + 1);
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function buildIdentityDocumentFileName(
  docType: IdentityDocumentType,
  title: string,
  mimeType: 'image/jpeg' | 'image/webp' | 'image/png',
  now: Date = new Date(),
): string {
  const slug = (title || docType)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const ext = mimeType === 'image/webp' ? 'webp' : mimeType === 'image/png' ? 'png' : 'jpg';
  const base = `${docType}_${slug || 'documento'}_${yyyy}${mm}${dd}.${ext}`;
  return base.slice(0, IDENTITY_DOC_FILENAME_MAX_LENGTH);
}

export function maskDocumentNumber(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.length <= 4) return '••••';
  const visibleTail = trimmed.slice(-4);
  return `${'•'.repeat(Math.min(8, trimmed.length - 4))}${visibleTail}`;
}

export interface IdentityDocumentValidationInput {
  id: string;
  ownerUid: string;
  docType: string;
  title: string;
  documentNumber?: string;
  issuingCountry?: string;
  expirationDate?: string;
  notes?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  imageDataUrl: string;
  captureMethod: string;
}

export interface IdentityDocumentValidationResult {
  valid: boolean;
  error?: string;
}

export function validateIdentityDocumentPayload(
  input: IdentityDocumentValidationInput,
): IdentityDocumentValidationResult {
  if (!IDENTITY_DOC_ID_REGEX.test(input.id)) {
    return { valid: false, error: 'Identificador do documento inválido.' };
  }
  if (!IDENTITY_DOC_ID_REGEX.test(input.ownerUid)) {
    return { valid: false, error: 'Usuário autenticado inválido.' };
  }
  if (!VALID_DOC_TYPES.has(input.docType)) {
    return { valid: false, error: 'Tipo de documento de identificação não suportado.' };
  }
  const title = input.title.trim();
  if (title.length < IDENTITY_DOC_TITLE_MIN_LENGTH || title.length > IDENTITY_DOC_TITLE_MAX_LENGTH) {
    return {
      valid: false,
      error: `Informe um título entre ${IDENTITY_DOC_TITLE_MIN_LENGTH} e ${IDENTITY_DOC_TITLE_MAX_LENGTH} caracteres.`,
    };
  }
  if (input.documentNumber && input.documentNumber.trim().length > IDENTITY_DOC_NUMBER_MAX_LENGTH) {
    return {
      valid: false,
      error: `O número do documento deve ter no máximo ${IDENTITY_DOC_NUMBER_MAX_LENGTH} caracteres.`,
    };
  }
  if (input.issuingCountry && input.issuingCountry.trim().length > IDENTITY_DOC_COUNTRY_MAX_LENGTH) {
    return {
      valid: false,
      error: `O país emissor deve ter no máximo ${IDENTITY_DOC_COUNTRY_MAX_LENGTH} caracteres.`,
    };
  }
  if (input.expirationDate && input.expirationDate.trim().length > 0) {
    const exp = input.expirationDate.trim();
    if (exp.length > IDENTITY_DOC_EXPIRATION_MAX_LENGTH || !ISO_DATE_REGEX.test(exp)) {
      return {
        valid: false,
        error: 'Informe a data de validade no formato AAAA-MM-DD.',
      };
    }
  }
  if (input.notes && input.notes.trim().length > IDENTITY_DOC_NOTES_MAX_LENGTH) {
    return {
      valid: false,
      error: `As observações devem ter no máximo ${IDENTITY_DOC_NOTES_MAX_LENGTH} caracteres.`,
    };
  }
  if (!input.fileName || input.fileName.length < 3 || input.fileName.length > IDENTITY_DOC_FILENAME_MAX_LENGTH) {
    return { valid: false, error: 'Nome de arquivo inválido.' };
  }
  if (!VALID_MIME_TYPES.has(input.mimeType)) {
    return { valid: false, error: 'Formato de imagem inválido. Utilize JPG, PNG ou WEBP.' };
  }
  if (!SAFE_IDENTITY_DATA_URL_REGEX.test(input.imageDataUrl)) {
    return {
      valid: false,
      error: 'A imagem digitalizada deve estar em formato raster seguro (JPEG, WEBP ou PNG).',
    };
  }
  if (input.imageDataUrl.length > IDENTITY_DOC_MAX_DATA_URL_LENGTH) {
    return {
      valid: false,
      error: 'A imagem digitalizada excedeu o limite seguro do perfil no Firestore. Reduza a resolução ou tente novamente.',
    };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > IDENTITY_DOC_MAX_SIZE_BYTES) {
    return {
      valid: false,
      error: 'O tamanho da imagem digitalizada deve ficar entre 1 B e 600 KB para armazenamento direto no perfil.',
    };
  }
  if (input.captureMethod !== 'camera' && input.captureMethod !== 'upload') {
    return { valid: false, error: 'Método de captura inválido.' };
  }
  return { valid: true };
}

export interface CompressedScanResult {
  imageDataUrl: string;
  mimeType: 'image/jpeg' | 'image/webp';
  sizeBytes: number;
  width: number;
  height: number;
}

/**
 * Applies gentle document clarity enhancement (mild contrast & brightness lift)
 * so photographed identification cards and passports read crisply.
 */
export function applyDocumentScanEnhancement(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const contrast = 1.18;
  const brightness = 8;
  const intercept = 128 * (1 - contrast) + brightness;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, Math.round(data[i] * contrast + intercept)));
    data[i + 1] = Math.max(0, Math.min(255, Math.round(data[i + 1] * contrast + intercept)));
    data[i + 2] = Math.max(0, Math.min(255, Math.round(data[i + 2] * contrast + intercept)));
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Captures a live HTMLVideoElement frame or loaded HTMLImageElement onto an
 * offscreen canvas, applies optional rotation and document scan clarity filter,
 * and adaptively compresses so the resulting Data URL always fits comfortably
 * inside the Firestore profile document budget (<= 650,000 chars / <= 600 KB).
 */
export function captureVisualSourceToCompressedScan(
  source: HTMLVideoElement | HTMLImageElement,
  options?: {
    rotationDeg?: 0 | 90 | 180 | 270;
    enhancedScan?: boolean;
    maxDimensionPx?: number;
  },
): CompressedScanResult {
  const rotation = options?.rotationDeg ?? 0;
  const enhancedScan = Boolean(options?.enhancedScan);
  const srcWidth =
    source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth || source.width;
  const srcHeight =
    source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight || source.height;

  if (!srcWidth || !srcHeight) {
    throw new Error('Não foi possível capturar a imagem da câmera. Aguarde o vídeo inicializar.');
  }

  const maxDimCandidates = [options?.maxDimensionPx ?? 1280, 1080, 900, 760];
  const qualitySteps = [0.84, 0.74, 0.64, 0.52, 0.42];
  const safeMaxDataUrl = 610_000;
  const safeMaxBytes = 560_000;

  let lastResult: CompressedScanResult | null = null;

  for (const maxDim of maxDimCandidates) {
    const scale = Math.min(1, maxDim / Math.max(srcWidth, srcHeight));
    const drawW = Math.max(1, Math.round(srcWidth * scale));
    const drawH = Math.max(1, Math.round(srcHeight * scale));
    const swapped = rotation === 90 || rotation === 270;
    const outW = swapped ? drawH : drawW;
    const outH = swapped ? drawW : drawH;

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d', { willReadFrequently: enhancedScan });
    if (!ctx) {
      throw new Error('Seu navegador não suportou o processamento de imagem via Canvas.');
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outW, outH);

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(source, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    if (enhancedScan) {
      try {
        applyDocumentScanEnhancement(ctx, outW, outH);
      } catch {
        // Fallback silently to unmodified draw if canvas pixel access is restricted
      }
    }

    for (const quality of qualitySteps) {
      // Prefer WebP when supported by the browser (smaller & sharper for text), fallback to JPEG
      let dataUrl = canvas.toDataURL('image/webp', quality);
      let mimeType: 'image/jpeg' | 'image/webp' = 'image/webp';
      if (!dataUrl.startsWith('data:image/webp;base64,')) {
        dataUrl = canvas.toDataURL('image/jpeg', quality);
        mimeType = 'image/jpeg';
      }

      const sizeBytes = estimateBase64ByteSize(dataUrl);
      lastResult = {
        imageDataUrl: dataUrl,
        mimeType,
        sizeBytes,
        width: outW,
        height: outH,
      };

      if (dataUrl.length <= safeMaxDataUrl && sizeBytes <= safeMaxBytes) {
        return lastResult;
      }
    }
  }

  if (
    lastResult &&
    lastResult.imageDataUrl.length <= IDENTITY_DOC_MAX_DATA_URL_LENGTH &&
    lastResult.sizeBytes <= IDENTITY_DOC_MAX_SIZE_BYTES
  ) {
    return lastResult;
  }

  throw new Error(
    'A imagem capturada ficou muito grande mesmo após compressão. Aproxime ou enquadre apenas o documento.',
  );
}

export async function readImageFileToCompressedScan(
  file: File,
  options?: {
    rotationDeg?: 0 | 90 | 180 | 270;
    enhancedScan?: boolean;
  },
): Promise<CompressedScanResult> {
  if (!file.type || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
    throw new Error('Selecione uma imagem válida nos formatos JPG, PNG ou WEBP.');
  }
  if (file.size <= 0) {
    throw new Error('O arquivo selecionado está vazio.');
  }
  if (file.size > IDENTITY_DOC_MAX_SOURCE_UPLOAD_BYTES) {
    throw new Error('A foto selecionada excede 15 MB. Selecione uma imagem menor.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível abrir a imagem selecionada.'));
      el.src = objectUrl;
    });

    return captureVisualSourceToCompressedScan(img, options);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function dataUrlToFile(
  dataUrl: string,
  fileName: string,
  mimeType: 'image/jpeg' | 'image/webp' | 'image/png',
): File {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], fileName, { type: mimeType });
}

export function sortIdentityDocsNewestFirst(
  docs: UserIdentityDocument[],
): UserIdentityDocument[] {
  return [...docs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}
