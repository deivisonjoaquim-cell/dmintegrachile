import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clearAiDraftCache,
  CLIENT_MSG_AI_GENERIC_ERROR,
  CLIENT_MSG_AI_HIGH_DEMAND,
  loadAiDraftCache,
  sanitizeClientAiError,
  saveAiDraftCache,
} from './aiClient';

describe('aiClient — Error Sanitization & Short-Lived Cache', () => {
  it('sanitizes raw 503/429 Gemini JSON into clean Portuguese message', () => {
    const rawJson503 =
      '{"error":{"code":503,"status":"UNAVAILABLE","message":"This model is currently experiencing high demand."}}';
    assert.equal(sanitizeClientAiError(rawJson503), CLIENT_MSG_AI_HIGH_DEMAND);
    assert.equal(sanitizeClientAiError(new Error(rawJson503)), CLIENT_MSG_AI_HIGH_DEMAND);
    assert.equal(sanitizeClientAiError('HTTP 429 RESOURCE_EXHAUSTED'), CLIENT_MSG_AI_HIGH_DEMAND);
  });

  it('never leaks raw JSON or English stack errors on unknown errors', () => {
    assert.equal(sanitizeClientAiError('{"error":{"code":500,"message":"Internal error"}}'), CLIENT_MSG_AI_GENERIC_ERROR);
    assert.equal(sanitizeClientAiError(new Error('TypeError: Cannot read properties of undefined')), CLIENT_MSG_AI_GENERIC_ERROR);
  });

  it('preserves vetted Portuguese messages', () => {
    const vetted = 'Faça login com sua conta Google para utilizar o apoio de IA.';
    assert.equal(sanitizeClientAiError(vetted), vetted);
  });

  it('stores, loads, expires and clears short-lived local cache entries', () => {
    const store = new Map<string, string>();
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    };
    try {
      saveAiDraftCache('parecer_123', { resumo: 'Rascunho preservado' }, 60_000);
      assert.deepEqual(loadAiDraftCache<{ resumo: string }>('parecer_123'), { resumo: 'Rascunho preservado' });

      saveAiDraftCache('expirado', { resumo: 'Velho' }, -1000);
      assert.equal(loadAiDraftCache('expirado'), null);

      clearAiDraftCache('parecer_123');
      assert.equal(loadAiDraftCache('parecer_123'), null);
    } finally {
      if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = prevWindow;
    }
  });
});
