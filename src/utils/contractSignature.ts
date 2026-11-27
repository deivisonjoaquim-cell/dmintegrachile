import type { GeneratedDocument, GeneratedDocumentSignatureMethod } from '../types/domain';

export type TypedSignatureStyleId = 'classica' | 'editorial' | 'executiva';

export interface TypedSignatureStyle {
  id: TypedSignatureStyleId;
  label: string;
  description: string;
  cssFontFamily: string;
  canvasFont: string;
  fontStyle: 'italic' | 'normal';
}

export const TYPED_SIGNATURE_STYLES: TypedSignatureStyle[] = [
  {
    id: 'classica',
    label: 'Clássica Caligráfica',
    description: 'Traço cursivo refinado para contratos',
    cssFontFamily: '"Dancing Script", "Brush Script MT", "Segoe Script", "Snell Roundhand", Georgia, serif',
    canvasFont: '600 56px "Dancing Script", "Brush Script MT", "Segoe Script", Georgia, serif',
    fontStyle: 'normal',
  },
  {
    id: 'editorial',
    label: 'Editorial Itálica',
    description: 'Serifa institucional em itálico elegante',
    cssFontFamily: '"Playfair Display", Georgia, "Times New Roman", serif',
    canvasFont: 'italic 600 40px "Playfair Display", Georgia, "Times New Roman", serif',
    fontStyle: 'italic',
  },
  {
    id: 'executiva',
    label: 'Executiva Formal',
    description: 'Assinatura limpa e de alta legibilidade',
    cssFontFamily: '"Plus Jakarta Sans", "DM Sans", -apple-system, sans-serif',
    canvasFont: '600 34px "Plus Jakarta Sans", "DM Sans", sans-serif',
    fontStyle: 'normal',
  },
];

export interface SignatureAuditMetadata {
  assinaturaMetodo?: GeneratedDocumentSignatureMethod;
  assinadoPorNome?: string;
  assinadoPorEmail?: string;
  assinadoPorDocumento?: string;
  assinaturaHashSha256?: string;
  assinaturaUserAgent?: string;
  assinaturaAceiteTermo?: boolean;
}

export interface SignerValidationResult {
  valid: boolean;
  error?: string;
  normalizedNome: string;
  normalizedEmail: string;
  normalizedDocumento: string;
}

export function validateSignerIdentity(input: {
  nome: string;
  email?: string;
  documento?: string;
  aceiteTermo: boolean;
}): SignerValidationResult {
  const normalizedNome = (input.nome || '').trim().replace(/\s+/g, ' ').slice(0, 200);
  const normalizedEmail = (input.email || '').trim().toLowerCase().slice(0, 200);
  const normalizedDocumento = (input.documento || '').trim().slice(0, 80);

  if (normalizedNome.length < 3 || !normalizedNome.includes(' ')) {
    return {
      valid: false,
      error: 'Informe seu nome completo (nome e sobrenome) para formalizar a assinatura.',
      normalizedNome,
      normalizedEmail,
      normalizedDocumento,
    };
  }
  if (!input.aceiteTermo) {
    return {
      valid: false,
      error: 'Confirme a leitura integral e o aceite eletrônico do contrato antes de assinar.',
      normalizedNome,
      normalizedEmail,
      normalizedDocumento,
    };
  }
  return {
    valid: true,
    normalizedNome,
    normalizedEmail,
    normalizedDocumento,
  };
}

export function getSignatureMethodLabel(method?: GeneratedDocumentSignatureMethod | string): string {
  switch (method) {
    case 'desenhada':
      return 'Assinatura manuscrita digital';
    case 'tipografica':
      return 'Assinatura eletrônica tipográfica';
    case 'pdf_anexado':
      return 'Documento assinado anexado (PDF/Imagem)';
    case 'externa':
      return 'Assinatura externa (Gov.br / Autentique)';
    default:
      return 'Assinatura eletrônica registrada';
  }
}

export function formatSignatureHashShort(hash?: string | null): string {
  const clean = (hash || '').trim().toUpperCase();
  if (!clean) return '';
  if (clean.length <= 16) return clean;
  return `${clean.slice(0, 10)}…${clean.slice(-8)}`;
}

function fallbackDeterministicShaLikeHex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let h3 = 0x85ebca6b;
  let h4 = 0xc2b2ae35;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 0x85ebca6b) >>> 0;
    h3 = Math.imul(h3 ^ (ch * 31 + i), 0xc2b2ae35) >>> 0;
    h4 = Math.imul(h4 ^ ((ch << 3) ^ i), 0x27d4eb2d) >>> 0;
  }
  const parts = [h1, h2, h3, h4, h1 ^ h3, h2 ^ h4, (h1 + h2) >>> 0, (h3 + h4) >>> 0];
  return parts.map((n) => n.toString(16).padStart(8, '0')).join('');
}

/**
 * Calcula o selo criptográfico SHA-256 (64 hex chars) sobre o conteúdo do contrato + identificação.
 * Usa Web Crypto API nativa (Node 20+ e navegadores modernos) com fallback determinístico.
 */
export async function computeDocumentContentHash(params: {
  conteudoHtml: string;
  titulo?: string;
  docId?: string;
  versao?: number;
  codigoVerificacao?: string;
}): Promise<string> {
  const canonical = [
    (params.docId || '').trim(),
    String(params.versao ?? 1),
    (params.codigoVerificacao || '').trim(),
    (params.titulo || '').trim(),
    (params.conteudoHtml || '').replace(/\r\n/g, '\n').trim(),
  ].join('\n::\n');

  try {
    const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : undefined;
    if (subtle && typeof TextEncoder !== 'undefined') {
      const encoded = new TextEncoder().encode(canonical);
      const digest = await subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback determinístico em contextos sem crypto.subtle (ex.: HTTP não-seguro)
  }

  return fallbackDeterministicShaLikeHex(canonical);
}

/**
 * Renderiza uma assinatura tipográfica de alta resolução (2x HiDPI) em PNG data URL.
 */
export function renderTypedSignatureToDataUrl(
  fullName: string,
  styleId: TypedSignatureStyleId = 'classica',
  inkColor = '#0B1F33',
): string {
  if (typeof document === 'undefined') return '';
  const cleanName = fullName.trim().slice(0, 80);
  if (!cleanName) return '';

  const style = TYPED_SIGNATURE_STYLES.find((s) => s.id === styleId) || TYPED_SIGNATURE_STYLES[0];
  const width = 640;
  const height = 180;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Ajusta dinamicamente o tamanho da fonte se o nome for longo
  let fontSize = style.id === 'classica' ? 68 : style.id === 'editorial' ? 50 : 42;
  const minFontSize = 24;
  const buildFont = (px: number) => {
    if (style.id === 'classica') {
      return `600 ${px}px "Dancing Script", "Brush Script MT", "Segoe Script", Georgia, serif`;
    }
    if (style.id === 'editorial') {
      return `italic 600 ${px}px "Playfair Display", Georgia, "Times New Roman", serif`;
    }
    return `600 ${px}px "Plus Jakarta Sans", "DM Sans", -apple-system, sans-serif`;
  };

  ctx.font = buildFont(fontSize);
  while (ctx.measureText(cleanName).width > width - 64 && fontSize > minFontSize) {
    fontSize -= 2;
    ctx.font = buildFont(fontSize);
  }

  ctx.fillStyle = inkColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(cleanName, width / 2, height / 2 - 4);

  // Traço fino sutil abaixo da assinatura
  const textWidth = Math.min(width - 96, Math.max(180, ctx.measureText(cleanName).width * 0.85));
  ctx.strokeStyle = inkColor;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo((width - textWidth) / 2, height * 0.74);
  ctx.lineTo((width + textWidth) / 2, height * 0.74);
  ctx.stroke();
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/png');
}

export interface SignatureCertificateSummary {
  hasSignature: boolean;
  signerName: string;
  signerEmail: string;
  signerDocument: string;
  signedAtIso: string;
  methodLabel: string;
  verificationCode: string;
  hashFull: string;
  hashShort: string;
  confirmedReadAtIso: string;
  confirmedReadBy: string;
  signatureImageUrl: string;
  signedFileUrl: string;
}

export function buildSignatureCertificateSummary(
  doc: Partial<GeneratedDocument>,
  fallbackSigner?: { nome?: string; email?: string; documento?: string },
): SignatureCertificateSummary {
  const signatureImageUrl = (doc.assinaturaDataUrl || '').trim();
  const signedFileUrl = (doc.assinaturaUrl || '').trim();
  const signedAtIso = (doc.assinadoEm || '').trim();
  const hasSignature = Boolean(signatureImageUrl || signedFileUrl || signedAtIso || doc.status === 'Assinado');

  const inferredMethod: GeneratedDocumentSignatureMethod | undefined =
    doc.assinaturaMetodo ||
    (signedFileUrl && !signatureImageUrl
      ? 'pdf_anexado'
      : signatureImageUrl
        ? 'desenhada'
        : doc.assinaturaLinkExterno
          ? 'externa'
          : undefined);

  const hashFull = (doc.assinaturaHashSha256 || '').trim();

  return {
    hasSignature,
    signerName: (doc.assinadoPorNome || fallbackSigner?.nome || '').trim(),
    signerEmail: (doc.assinadoPorEmail || fallbackSigner?.email || '').trim(),
    signerDocument: (doc.assinadoPorDocumento || fallbackSigner?.documento || '').trim(),
    signedAtIso,
    methodLabel: getSignatureMethodLabel(inferredMethod),
    verificationCode: (doc.codigoVerificacao || doc.id || '').trim(),
    hashFull,
    hashShort: formatSignatureHashShort(hashFull),
    confirmedReadAtIso: (doc.confirmadoLeituraEm || '').trim(),
    confirmedReadBy: (doc.confirmadoLeituraPor || '').trim(),
    signatureImageUrl,
    signedFileUrl,
  };
}
