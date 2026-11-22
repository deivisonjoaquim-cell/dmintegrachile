import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import {
  assertPathInsideBaseDir,
  getCompanionMobileWebpFilename,
  preprocessAssetDirectoryToWebp,
  preprocessUploadedImageToWebp,
} from './imagePreprocessor.ts';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('imagePreprocessor — Automatic WebP Conversion & Mobile Variants', () => {
  it('converts wide uploaded PNG/JPG into optimized WebP + 640w mobile variant and removes original', async () => {
    const dir = makeTempDir('dm-img-upload-');
    try {
      const sourcePath = path.join(dir, '1700000000_hero_banner.png');
      await sharp({
        create: {
          width: 1600,
          height: 900,
          channels: 4,
          background: { r: 15, g: 37, b: 55, alpha: 1 },
        },
      })
        .png({ compressionLevel: 0 })
        .toFile(sourcePath);

      const result = await preprocessUploadedImageToWebp({
        inputPath: sourcePath,
        uploadDir: dir,
      });

      assert.equal(result.mimeType, 'image/webp');
      assert.equal(result.convertedToWebp, true);
      assert.equal(result.outputFilename, '1700000000_hero_banner.webp');
      assert.equal(result.mobileFilename, '1700000000_hero_banner-640w.webp');
      assert.equal(result.width, 1280);
      assert.equal(fs.existsSync(sourcePath), false, 'Original PNG upload should be removed');
      assert.equal(fs.existsSync(result.outputPath), true, 'Desktop WebP should exist');
      assert.equal(Boolean(result.mobilePath && fs.existsSync(result.mobilePath)), true, 'Mobile 640w WebP should exist');
      assert.ok(result.sizeBytes < result.originalSizeBytes, 'WebP should be smaller than uncompressed PNG');

      const mobileMeta = await sharp(result.mobilePath!).metadata();
      assert.equal(mobileMeta.format, 'webp');
      assert.equal(mobileMeta.width, 640);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects spoofed non-image files and cleans up the invalid upload', async () => {
    const dir = makeTempDir('dm-img-spoof-');
    try {
      const fakePath = path.join(dir, '1700000001_fake.jpg');
      fs.writeFileSync(fakePath, '<html><script>alert(1)</script></html>', 'utf8');

      await assert.rejects(
        () => preprocessUploadedImageToWebp({ inputPath: fakePath, uploadDir: dir }),
        /imagem válida|unsupported image format|Input file contains unsupported image format/i,
      );
      assert.equal(fs.existsSync(fakePath), false, 'Invalid spoofed file must be deleted');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('blocks path traversal outside upload base directory', () => {
    const base = makeTempDir('dm-img-confine-');
    try {
      assert.throws(() => assertPathInsideBaseDir(path.join(base, '..', 'outside.jpg'), base));
      assert.equal(getCompanionMobileWebpFilename('123_photo.webp'), '123_photo-640w.webp');
      assert.equal(getCompanionMobileWebpFilename('123_photo-640w.webp'), null);
    } finally {
      fs.rmSync(base, { recursive: true, force: true });
    }
  });

  it('batch-preprocesses asset directories idempotently while preserving originals when configured', async () => {
    const dir = makeTempDir('dm-img-batch-');
    try {
      const jpgPath = path.join(dir, 'editorial_sample.jpg');
      await sharp({
        create: {
          width: 1400,
          height: 800,
          channels: 3,
          background: { r: 201, g: 162, b: 77 },
        },
      })
        .jpeg({ quality: 95 })
        .toFile(jpgPath);

      const firstRun = await preprocessAssetDirectoryToWebp({
        dir,
        preserveOriginals: true,
        generateMobileVariant: true,
      });

      assert.equal(firstRun.processedCount, 1);
      assert.equal(firstRun.skippedCount, 0);
      assert.equal(fs.existsSync(jpgPath), true, 'Original JPG should be preserved');
      assert.equal(fs.existsSync(path.join(dir, 'editorial_sample.webp')), true);
      assert.equal(fs.existsSync(path.join(dir, 'editorial_sample-640w.webp')), true);

      const secondRun = await preprocessAssetDirectoryToWebp({
        dir,
        preserveOriginals: true,
        generateMobileVariant: true,
      });
      assert.equal(secondRun.processedCount, 0);
      assert.equal(secondRun.skippedCount, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
