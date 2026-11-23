import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  canonicalizeJson,
  clearAiIndexedDbCache,
  computeAiCacheKey,
  getAiCachedResponse,
  getAiCacheSummary,
  isCacheableAiResponse,
  purgeExpiredAiCache,
  resolveEndpointCacheTtlMs,
  setAiCachedResponse,
} from './aiIndexedDbCache';

describe('aiIndexedDbCache — Deterministic Keys, TTL Expiration, Fallback Guard & LRU', () => {
  test('generates identical SHA-256 cache keys regardless of object property order and isolates by userScope', async () => {
    const k1 = await computeAiCacheKey(
      '/api/ai/parecer',
      { caseData: { id: 'c1', titulo: 'Mercosul' }, clientData: { nome: 'Ana', cpf: '123' } },
      'uid-consultor-1',
    );
    const k2 = await computeAiCacheKey(
      '/api/ai/parecer',
      { clientData: { cpf: '123', nome: 'Ana' }, caseData: { titulo: 'Mercosul', id: 'c1' } },
      'uid-consultor-1',
    );
    const kDifferentPayload = await computeAiCacheKey(
      '/api/ai/parecer',
      { clientData: { cpf: '123', nome: 'Ana Maria' }, caseData: { titulo: 'Mercosul', id: 'c1' } },
      'uid-consultor-1',
    );
    const kDifferentUser = await computeAiCacheKey(
      '/api/ai/parecer',
      { caseData: { id: 'c1', titulo: 'Mercosul' }, clientData: { nome: 'Ana', cpf: '123' } },
      'uid-consultor-2',
    );

    assert.equal(k1, k2);
    assert.notEqual(k1, kDifferentPayload);
    assert.notEqual(k1, kDifferentUser);
    assert.equal(canonicalizeJson({ b: 2, a: 1, ignored: undefined }), '{"a":1,"b":2}');
  });

  test('stores valid AI responses, serves cache hits before TTL expiry, and evicts after expiry', async () => {
    await clearAiIndexedDbCache({ resetStats: true });

    const key = await computeAiCacheKey('/api/ai/parecer', { id: 'case-ttl' }, 'uid-1');
    const t0 = 1_700_000_000_000;

    const stored = await setAiCachedResponse({
      key,
      endpoint: '/api/ai/parecer',
      userScope: 'uid-1',
      data: {
        enquadramentoLegal: 'Acordo Mercosul',
        recomendacoes: 'Apostilar antecedentes.',
        fallback: false,
        origem: 'principal',
      },
      ttlMs: 60_000,
      nowMs: t0,
    });
    assert.equal(stored, true);

    const hit = await getAiCachedResponse<{ enquadramentoLegal: string }>(key, { nowMs: t0 + 30_000 });
    assert.ok(hit);
    assert.equal(hit.data.enquadramentoLegal, 'Acordo Mercosul');
    assert.equal(hit.hitCount, 1);

    const expired = await getAiCachedResponse<{ enquadramentoLegal: string }>(key, { nowMs: t0 + 61_000 });
    assert.equal(expired, null);

    const summary = await getAiCacheSummary(t0 + 61_000);
    assert.equal(summary.hits, 1);
    assert.equal(summary.savedCalls, 1);
    assert.equal(summary.misses, 1);
    assert.equal(summary.activeEntries, 0);
  });

  test('refuses to cache degraded rule-based fallbacks so temporary outages do not poison cache', async () => {
    await clearAiIndexedDbCache({ resetStats: true });
    assert.equal(isCacheableAiResponse({ fallback: true, origem: 'regras', enquadramentoLegal: 'x' }), false);
    assert.equal(isCacheableAiResponse({ fallback: false, origem: 'regras', enquadramentoLegal: 'x' }), false);
    assert.equal(isCacheableAiResponse({ fallback: false, origem: 'reserva', enquadramentoLegal: 'x' }), true);

    const key = await computeAiCacheKey('/api/ai/parecer', { id: 'case-fb' }, 'uid-1');
    const saved = await setAiCachedResponse({
      key,
      endpoint: '/api/ai/parecer',
      userScope: 'uid-1',
      data: { fallback: true, origem: 'regras', enquadramentoLegal: 'fallback local' },
    });
    assert.equal(saved, false);
    assert.equal(await getAiCachedResponse(key), null);
  });

  test('evicts least-recently-used entries when exceeding maxEntries and purges expired records cleanly', async () => {
    await clearAiIndexedDbCache({ resetStats: true });
    const t0 = 1_700_000_000_000;

    const kA = await computeAiCacheKey('/api/ai/custos', { v: 'A' }, 'uid-1');
    const kB = await computeAiCacheKey('/api/ai/custos', { v: 'B' }, 'uid-1');
    const kC = await computeAiCacheKey('/api/ai/norma', { v: 'C' }, 'uid-1');

    await setAiCachedResponse({
      key: kA,
      endpoint: '/api/ai/custos',
      data: { v: 'A', fallback: false },
      ttlMs: 100_000,
      nowMs: t0,
      maxEntries: 2,
    });
    await setAiCachedResponse({
      key: kB,
      endpoint: '/api/ai/custos',
      data: { v: 'B', fallback: false },
      ttlMs: 10_000,
      nowMs: t0 + 100,
      maxEntries: 2,
    });

    // Touch A so B becomes least recently used
    const hitA = await getAiCachedResponse<{ v: string }>(kA, { nowMs: t0 + 200 });
    assert.equal(hitA?.data.v, 'A');

    // Insert C with maxEntries=2 -> B should be evicted
    await setAiCachedResponse({
      key: kC,
      endpoint: '/api/ai/norma',
      data: { v: 'C', fallback: false },
      ttlMs: 5_000,
      nowMs: t0 + 300,
      maxEntries: 2,
    });

    assert.equal(await getAiCachedResponse(kB, { nowMs: t0 + 400 }), null);
    assert.equal((await getAiCachedResponse<{ v: string }>(kA, { nowMs: t0 + 400 }))?.data.v, 'A');
    assert.equal((await getAiCachedResponse<{ v: string }>(kC, { nowMs: t0 + 400 }))?.data.v, 'C');

    // Purge expired C after t0 + 6000
    const purged = await purgeExpiredAiCache(t0 + 6_000);
    assert.equal(purged, 1);

    // Endpoint TTL defaults
    assert.equal(resolveEndpointCacheTtlMs('/api/ai/parecer'), 2 * 60 * 60 * 1000);
    assert.equal(resolveEndpointCacheTtlMs('/api/ai/analisar-documento'), 24 * 60 * 60 * 1000);

    // Clear only one endpoint
    const clearedCustos = await clearAiIndexedDbCache({ endpoint: '/api/ai/custos' });
    assert.equal(clearedCustos, 1);
    assert.equal((await getAiCacheSummary(t0 + 6_000)).activeEntries, 0);
  });
});
