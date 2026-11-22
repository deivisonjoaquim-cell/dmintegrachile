import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getBrandWebpUrl, resolveOptimizedImageSources } from './imageOptimization';

describe('imageOptimization — Responsive WebP Source Resolution', () => {
  it('resolves local editorial JPG photos to responsive 640w + 1280w WebP srcSet with JPG fallback', () => {
    const res = resolveOptimizedImageSources('/src/assets/images/hero_santiago_andes_1794944011226.jpg');
    assert.equal(res.isVector, false);
    assert.equal(res.fallbackSrc, '/src/assets/images/hero_santiago_andes_1794944011226.jpg');
    assert.equal(res.webpSrc, '/src/assets/images/hero_santiago_andes_1794944011226.webp');
    assert.equal(
      res.webpSrcSet,
      '/src/assets/images/hero_santiago_andes_1794944011226-640w.webp 640w, /src/assets/images/hero_santiago_andes_1794944011226.webp 1280w',
    );
  });

  it('resolves official PNG brand logos to lightweight WebP siblings', () => {
    const webp = getBrandWebpUrl('/assets/aistudio/logo-dm-integra-completa-clara_c33baf15.png');
    assert.equal(webp, '/assets/aistudio/logo-dm-integra-completa-clara_c33baf15.webp');
  });

  it('preserves SVG vectors and external custom URLs safely without broken WebP rewrites', () => {
    const svg = resolveOptimizedImageSources('/assets/aistudio/logo-dm-integra-emblema-claro_89e6f043.svg');
    assert.equal(svg.isVector, true);
    assert.equal(svg.webpSrc, undefined);

    const ext = resolveOptimizedImageSources('https://cdn.example.com/custom-banner.jpg');
    assert.equal(ext.isVector, false);
    assert.equal(ext.fallbackSrc, 'https://cdn.example.com/custom-banner.jpg');
    assert.equal(ext.webpSrc, undefined);
  });
});
