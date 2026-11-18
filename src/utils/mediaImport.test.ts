import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSvgText, BUILT_IN_MEDIA_GALLERY } from './mediaImport';

describe('sanitizeSvgText', () => {
  it('removes script tags and foreignObject blocks while preserving valid SVG', () => {
    const dirty = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <script>alert('xss')</script>
        <foreignObject width="50" height="50"><body><div>XSS</div></body></foreignObject>
        <circle cx="50" cy="50" r="40" fill="#1D2B4C" />
      </svg>
    `;
    const clean = sanitizeSvgText(dirty);
    assert.ok(!clean.includes('<script'));
    assert.ok(!clean.includes('<foreignObject'));
    assert.ok(clean.includes('<circle cx="50" cy="50" r="40" fill="#1D2B4C" />'));
    assert.ok(clean.includes('<svg'));
  });

  it('strips inline event handlers and javascript: URIs', () => {
    const dirty = `
      <svg onload="fetch('https://evil.test')" onclick=alert(1)>
        <a href="javascript:alert(2)"><rect width="10" height="10" onerror='bad()' /></a>
      </svg>
    `;
    const clean = sanitizeSvgText(dirty);
    assert.ok(!/onload\s*=/i.test(clean));
    assert.ok(!/onclick\s*=/i.test(clean));
    assert.ok(!/onerror\s*=/i.test(clean));
    assert.ok(!/javascript:/i.test(clean));
    assert.ok(clean.includes('<rect width="10" height="10"'));
  });

  it('provides non-empty built-in media gallery presets', () => {
    assert.ok(Array.isArray(BUILT_IN_MEDIA_GALLERY));
    assert.ok(BUILT_IN_MEDIA_GALLERY.length >= 4);
    for (const item of BUILT_IN_MEDIA_GALLERY) {
      assert.ok(item.url.startsWith('/'));
      assert.ok(item.nome.length > 0);
    }
  });
});
