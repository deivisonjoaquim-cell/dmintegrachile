import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

export const RASTER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
export const CONVERTIBLE_RASTER_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const MAX_INPUT_PIXELS = 64_000_000; // ~8000x8000 safety limit against decompression bombs

export interface PreprocessedUploadResult {
  outputFilename: string;
  outputPath: string;
  url: string;
  mobileFilename?: string;
  mobilePath?: string;
  mobileUrl?: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalSizeBytes: number;
  savedPercent: number;
  mimeType: 'image/webp';
  convertedToWebp: true;
}

export interface DirectoryPreprocessOptions {
  dir: string;
  preserveOriginals?: boolean;
  generateMobileVariant?: boolean;
  maxWidth?: number;
  mobileWidth?: number;
  quality?: number;
  mobileQuality?: number;
  force?: boolean;
}

export interface DirectoryPreprocessItem {
  sourceFile: string;
  outputFile: string;
  mobileFile?: string;
  originalBytes: number;
  webpBytes: number;
  mobileBytes?: number;
  skipped: boolean;
}

export interface DirectoryPreprocessReport {
  dir: string;
  processedCount: number;
  skippedCount: number;
  totalOriginalBytes: number;
  totalWebpBytes: number;
  totalMobileBytes: number;
  items: DirectoryPreprocessItem[];
}

export function assertPathInsideBaseDir(targetPath: string, baseDir: string): string {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) {
    throw new Error('Caminho de arquivo fora do diretório permitido.');
  }
  return resolvedTarget;
}

export function isRasterImageUpload(mimeType: string, filename: string): boolean {
  const normalizedMime = (mimeType || '').trim().toLowerCase();
  const ext = path.extname(filename || '').toLowerCase();
  return CONVERTIBLE_RASTER_MIMES.has(normalizedMime) || RASTER_IMAGE_EXTENSIONS.has(ext);
}

export function getCompanionMobileWebpFilename(filename: string): string | null {
  const safeName = path.basename(filename || '');
  if (!safeName.toLowerCase().endsWith('.webp') || safeName.toLowerCase().endsWith('-640w.webp')) {
    return null;
  }
  const base = safeName.slice(0, -5);
  return `${base}-640w.webp`;
}

/**
 * Converts an uploaded raster image (JPG/PNG/WebP) inside `uploadDir` into an
 * optimized WebP asset (plus a 640w mobile responsive variant for wide images),
 * validating real image headers, normalizing EXIF rotation, stripping PII
 * metadata, and removing the heavy original file.
 */
export async function preprocessUploadedImageToWebp(params: {
  inputPath: string;
  uploadDir: string;
  maxWidth?: number;
  mobileWidth?: number;
  quality?: number;
  mobileQuality?: number;
}): Promise<PreprocessedUploadResult> {
  const uploadDir = path.resolve(params.uploadDir);
  const resolvedInput = assertPathInsideBaseDir(params.inputPath, uploadDir);
  const maxWidth = params.maxWidth ?? 1280;
  const mobileWidth = params.mobileWidth ?? 640;
  const quality = params.quality ?? 82;
  const mobileQuality = params.mobileQuality ?? 80;

  if (!fs.existsSync(resolvedInput)) {
    throw new Error('Arquivo de imagem enviado não encontrado para pré-processamento.');
  }

  const originalStat = fs.statSync(resolvedInput);
  const originalSizeBytes = originalStat.size;

  const inputExt = path.extname(resolvedInput).toLowerCase();
  const baseName = path.basename(resolvedInput, inputExt).replace(/-640w$/i, '');
  const finalFilename = `${baseName}.webp`;
  const finalOutputPath = assertPathInsideBaseDir(path.join(uploadDir, finalFilename), uploadDir);
  const tempOutputPath = assertPathInsideBaseDir(
    path.join(uploadDir, `${baseName}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`),
    uploadDir,
  );

  let mobileFilename: string | undefined;
  let mobileOutputPath: string | undefined;

  try {
    const probe = sharp(resolvedInput, { limitInputPixels: MAX_INPUT_PIXELS });
    const meta = await probe.metadata();
    const allowedFormats = new Set(['jpeg', 'png', 'webp']);
    if (!meta.format || !allowedFormats.has(meta.format)) {
      throw new Error('O conteúdo do arquivo não corresponde a uma imagem válida (JPG, PNG ou WebP).');
    }

    const desktopInfo = await sharp(resolvedInput, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width: maxWidth,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({
        quality,
        alphaQuality: 92,
        effort: 4,
        smartSubsample: true,
      })
      .toFile(tempOutputPath);

    if (desktopInfo.width > mobileWidth) {
      mobileFilename = `${baseName}-640w.webp`;
      mobileOutputPath = assertPathInsideBaseDir(path.join(uploadDir, mobileFilename), uploadDir);
      await sharp(resolvedInput, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({
          width: mobileWidth,
          withoutEnlargement: true,
          fit: 'inside',
        })
        .webp({
          quality: mobileQuality,
          alphaQuality: 90,
          effort: 4,
          smartSubsample: true,
        })
        .toFile(mobileOutputPath);
    }

    fs.renameSync(tempOutputPath, finalOutputPath);

    if (resolvedInput !== finalOutputPath && fs.existsSync(resolvedInput)) {
      fs.unlinkSync(resolvedInput);
    }

    const finalStat = fs.statSync(finalOutputPath);
    const savedPercent =
      originalSizeBytes > 0
        ? Math.max(0, Math.round(((originalSizeBytes - finalStat.size) / originalSizeBytes) * 100))
        : 0;

    return {
      outputFilename: finalFilename,
      outputPath: finalOutputPath,
      url: `/uploads/${finalFilename}`,
      mobileFilename,
      mobilePath: mobileOutputPath,
      mobileUrl: mobileFilename ? `/uploads/${mobileFilename}` : undefined,
      width: desktopInfo.width,
      height: desktopInfo.height,
      sizeBytes: finalStat.size,
      originalSizeBytes,
      savedPercent,
      mimeType: 'image/webp',
      convertedToWebp: true,
    };
  } catch (err) {
    // Clean up temporary or invalid uploaded files safely
    for (const candidate of [tempOutputPath, mobileOutputPath, resolvedInput]) {
      if (candidate && fs.existsSync(candidate)) {
        try {
          fs.unlinkSync(candidate);
        } catch {
          // ignore cleanup failure
        }
      }
    }
    throw err instanceof Error ? err : new Error('Falha ao converter imagem enviada para WebP.');
  }
}

/**
 * Batch-converts all raster images in a directory into optimized WebP assets
 * (and optional 640w mobile variants). Skips up-to-date outputs unless `force`
 * is enabled, making it fast and idempotent in build hooks.
 */
export async function preprocessAssetDirectoryToWebp(
  options: DirectoryPreprocessOptions,
): Promise<DirectoryPreprocessReport> {
  const targetDir = path.resolve(options.dir);
  const preserveOriginals = options.preserveOriginals ?? true;
  const generateMobileVariant = options.generateMobileVariant ?? true;
  const maxWidth = options.maxWidth ?? 1280;
  const mobileWidth = options.mobileWidth ?? 640;
  const quality = options.quality ?? 82;
  const mobileQuality = options.mobileQuality ?? 80;
  const force = options.force ?? false;

  const report: DirectoryPreprocessReport = {
    dir: targetDir,
    processedCount: 0,
    skippedCount: 0,
    totalOriginalBytes: 0,
    totalWebpBytes: 0,
    totalMobileBytes: 0,
    items: [],
  };

  if (!fs.existsSync(targetDir)) {
    return report;
  }

  const entries = fs.readdirSync(targetDir, { withFileTypes: true });
  const rasterSources = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(jpe?g|png)$/i.test(name))
    .sort();

  for (const fileName of rasterSources) {
    const sourcePath = assertPathInsideBaseDir(path.join(targetDir, fileName), targetDir);
    const ext = path.extname(fileName);
    const baseName = path.basename(fileName, ext);
    const outputFileName = `${baseName}.webp`;
    const outputPath = assertPathInsideBaseDir(path.join(targetDir, outputFileName), targetDir);
    const mobileFileName = `${baseName}-640w.webp`;
    const mobilePath = assertPathInsideBaseDir(path.join(targetDir, mobileFileName), targetDir);

    const srcStat = fs.statSync(sourcePath);
    const meta = await sharp(sourcePath, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    const needsMobile = generateMobileVariant && (meta.width || 0) > mobileWidth;

    const desktopFresh =
      !force && fs.existsSync(outputPath) && fs.statSync(outputPath).mtimeMs >= srcStat.mtimeMs;
    const mobileFresh =
      !needsMobile ||
      (!force && fs.existsSync(mobilePath) && fs.statSync(mobilePath).mtimeMs >= srcStat.mtimeMs);

    if (desktopFresh && mobileFresh) {
      const existingWebpSize = fs.statSync(outputPath).size;
      const existingMobileSize = needsMobile && fs.existsSync(mobilePath) ? fs.statSync(mobilePath).size : undefined;
      report.skippedCount += 1;
      report.totalOriginalBytes += srcStat.size;
      report.totalWebpBytes += existingWebpSize;
      report.totalMobileBytes += existingMobileSize ?? existingWebpSize;
      report.items.push({
        sourceFile: fileName,
        outputFile: outputFileName,
        mobileFile: needsMobile ? mobileFileName : undefined,
        originalBytes: srcStat.size,
        webpBytes: existingWebpSize,
        mobileBytes: existingMobileSize,
        skipped: true,
      });
      continue;
    }

    await sharp(sourcePath, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({
        width: maxWidth,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .webp({
        quality,
        alphaQuality: 92,
        effort: 5,
        smartSubsample: true,
      })
      .toFile(outputPath);

    let mobileBytes: number | undefined;
    if (needsMobile) {
      await sharp(sourcePath, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({
          width: mobileWidth,
          withoutEnlargement: true,
          fit: 'inside',
        })
        .webp({
          quality: mobileQuality,
          alphaQuality: 90,
          effort: 5,
          smartSubsample: true,
        })
        .toFile(mobilePath);
      mobileBytes = fs.statSync(mobilePath).size;
    }

    const webpBytes = fs.statSync(outputPath).size;

    if (!preserveOriginals) {
      fs.unlinkSync(sourcePath);
    }

    report.processedCount += 1;
    report.totalOriginalBytes += srcStat.size;
    report.totalWebpBytes += webpBytes;
    report.totalMobileBytes += mobileBytes ?? webpBytes;
    report.items.push({
      sourceFile: fileName,
      outputFile: outputFileName,
      mobileFile: needsMobile ? mobileFileName : undefined,
      originalBytes: srcStat.size,
      webpBytes,
      mobileBytes,
      skipped: false,
    });
  }

  return report;
}
