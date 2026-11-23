import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  detectVideoContainerByMagicBytes,
  MAX_TESTIMONIAL_VIDEO_BYTES,
  saveValidatedTestimonialVideo,
} from './testimonialVideoService';

describe('testimonialVideoService — magic-byte validation, size caps & confined storage', () => {
  it('accepts valid WebM EBML video buffers and valid MP4 ftyp buffers', () => {
    const webmBuf = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]),
      Buffer.alloc(128, 0x22),
    ]);
    const webmRes = detectVideoContainerByMagicBytes(webmBuf, 'video/webm;codecs=vp8,opus');
    assert.equal(webmRes.ok, true);
    if (webmRes.ok) {
      assert.equal(webmRes.ext, '.webm');
      assert.equal(webmRes.canonicalMime, 'video/webm');
    }

    const mp4Buf = Buffer.concat([
      Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]),
      Buffer.alloc(128, 0x11),
    ]);
    const mp4Res = detectVideoContainerByMagicBytes(mp4Buf, 'video/mp4');
    assert.equal(mp4Res.ok, true);
    if (mp4Res.ok) {
      assert.equal(mp4Res.ext, '.mp4');
      assert.equal(mp4Res.canonicalMime, 'video/mp4');
    }
  });

  it('rejects disguised HTML/script payloads claiming to be video/webm and oversized buffers', async () => {
    const fakeHtml = Buffer.from('<!doctype html><script>alert(1)</script>'.repeat(5), 'utf8');
    const htmlRes = detectVideoContainerByMagicBytes(fakeHtml, 'video/webm');
    assert.equal(htmlRes.ok, false);

    const unsupportedMime = detectVideoContainerByMagicBytes(
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]),
      'text/html',
    );
    assert.equal(unsupportedMime.ok, false);

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-video-oversize-'));
    try {
      const oversized = Buffer.alloc(MAX_TESTIMONIAL_VIDEO_BYTES + 1, 0x00);
      oversized[0] = 0x1a;
      oversized[1] = 0x45;
      oversized[2] = 0xdf;
      oversized[3] = 0xa3;
      const sizeRes = saveValidatedTestimonialVideo({
        buffer: oversized,
        declaredMime: 'video/webm',
        uploadDir: tmpDir,
      });
      assert.equal(sizeRes.ok, false);
      if (!sizeRes.ok) {
        assert.equal(sizeRes.statusCode, 413);
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('writes validated short videos inside UPLOAD_DIR/testimonials with safe random filenames', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dm-video-test-'));
    try {
      const webmBuf = Buffer.concat([
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]),
        Buffer.alloc(256, 0x33),
      ]);
      const saved = saveValidatedTestimonialVideo({
        buffer: webmBuf,
        declaredMime: 'video/webm',
        uploadDir: tmpDir,
      });
      assert.equal(saved.ok, true);
      if (saved.ok) {
        assert.match(saved.url, /^\/uploads\/testimonials\/depoimento_[a-zA-Z0-9_\-]+\.webm$/);
        assert.equal(saved.size, webmBuf.length);

        const diskPath = path.join(tmpDir, 'testimonials', path.basename(saved.url));
        const stat = await fs.stat(diskPath);
        assert.equal(stat.size, webmBuf.length);
      }
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
