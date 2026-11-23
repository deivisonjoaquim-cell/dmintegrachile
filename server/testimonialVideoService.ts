import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertPathInsideBaseDir } from './imagePreprocessor.ts';

export const MAX_TESTIMONIAL_VIDEO_BYTES = 8 * 1024 * 1024; // 8 MB

export interface VideoMagicCheckResult {
  ok: true;
  ext: '.webm' | '.mp4' | '.mov';
  canonicalMime: 'video/webm' | 'video/mp4' | 'video/quicktime';
}

const ALLOWED_VIDEO_MIMES = new Set([
  'video/webm',
  'video/mp4',
  'video/quicktime',
]);

export function normalizeVideoMimeType(rawMime: string): string {
  return (rawMime || '').split(';')[0].trim().toLowerCase();
}

export function isAllowedTestimonialVideoMime(rawMime: string): boolean {
  return ALLOWED_VIDEO_MIMES.has(normalizeVideoMimeType(rawMime));
}

/**
 * Inspects file header magic bytes to confirm the buffer is genuinely a WebM/EBML
 * or ISO Base Media (MP4 / QuickTime MOV) video container and not a disguised script/HTML payload.
 */
export function detectVideoContainerByMagicBytes(
  header: Buffer,
  declaredMime: string,
): VideoMagicCheckResult | { ok: false; error: string } {
  if (!header || header.length < 12) {
    return { ok: false, error: 'Arquivo de vídeo incompleto ou corrompido.' };
  }

  const normalizedMime = normalizeVideoMimeType(declaredMime);
  if (!ALLOWED_VIDEO_MIMES.has(normalizedMime)) {
    return {
      ok: false,
      error: 'Formato de vídeo não suportado. Grave via webcam ou envie WebM/MP4 até 8 MB.',
    };
  }

  // WebM / Matroska EBML header: 0x1A 0x45 0xDF 0xA3
  const isEbml =
    header[0] === 0x1a &&
    header[1] === 0x45 &&
    header[2] === 0xdf &&
    header[3] === 0xa3;

  if (isEbml) {
    return {
      ok: true,
      ext: '.webm',
      canonicalMime: 'video/webm',
    };
  }

  // ISO BMFF (MP4 / QuickTime MOV): bytes 4..7 == 'ftyp'
  const boxType = header.subarray(4, 8).toString('ascii');
  if (boxType === 'ftyp') {
    const brand = header.subarray(8, 12).toString('ascii').toLowerCase();
    if (brand === 'qt  ' || normalizedMime === 'video/quicktime') {
      return {
        ok: true,
        ext: '.mov',
        canonicalMime: 'video/quicktime',
      };
    }
    return {
      ok: true,
      ext: '.mp4',
      canonicalMime: 'video/mp4',
    };
  }

  return {
    ok: false,
    error: 'O conteúdo do arquivo não corresponde a um vídeo WebM ou MP4 válido.',
  };
}

export function saveValidatedTestimonialVideo(params: {
  buffer: Buffer;
  declaredMime: string;
  uploadDir: string;
}):
  | { ok: true; url: string; filename: string; mimeType: string; size: number }
  | { ok: false; error: string; statusCode: number } {
  const { buffer, declaredMime, uploadDir } = params;

  if (!buffer || buffer.length === 0) {
    return { ok: false, error: 'Nenhum vídeo foi recebido.', statusCode: 400 };
  }
  if (buffer.length > MAX_TESTIMONIAL_VIDEO_BYTES) {
    return {
      ok: false,
      error: 'O vídeo excede o limite de 8 MB. Grave um depoimento curto de até 30 segundos.',
      statusCode: 413,
    };
  }

  const detected = detectVideoContainerByMagicBytes(buffer.subarray(0, 32), declaredMime);
  if (!detected.ok) {
    return { ok: false, error: detected.error, statusCode: 400 };
  }

  const testimonialsDir = assertPathInsideBaseDir(
    path.join(uploadDir, 'testimonials'),
    uploadDir,
  );
  fs.mkdirSync(testimonialsDir, { recursive: true });

  const randomToken = crypto.randomBytes(6).toString('hex');
  const filename = `depoimento_${Date.now()}_${randomToken}${detected.ext}`;
  const targetPath = assertPathInsideBaseDir(
    path.join(testimonialsDir, filename),
    testimonialsDir,
  );

  fs.writeFileSync(targetPath, buffer);

  return {
    ok: true,
    url: `/uploads/testimonials/${filename}`,
    filename,
    mimeType: detected.canonicalMime,
    size: buffer.length,
  };
}
