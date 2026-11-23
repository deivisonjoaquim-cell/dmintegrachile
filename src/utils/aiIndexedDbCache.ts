/**
 * Client-side IndexedDB cache with TTL expiration and LRU eviction for repetitive AI queries.
 *
 * Design goals:
 * - Zero Firestore read/write quota impact (stores strictly in the consultant's local browser IndexedDB).
 * - Content-addressable SHA-256 cache keys built from (userScope + endpoint + canonical JSON payload).
 *   Any edit to case data, client fields, dependents, or legal sources produces a fresh key automatically.
 * - Per-endpoint TTL policies (2h to 24h) + automatic expired-entry cleanup + LRU eviction.
 * - Never caches degraded rule-only fallbacks (`fallback: true` or `origem === 'regras'`).
 * - Graceful in-memory fallback when IndexedDB is unavailable (e.g., private mode or Node tests).
 */

import type { AiResponseMeta } from './aiClient';

export const AI_IDB_NAME = 'dm_integra_ai_cache_v1';
export const AI_IDB_VERSION = 1;
export const AI_IDB_STORE_RESPONSES = 'responses';
export const AI_IDB_STORE_META = 'meta';
export const AI_CACHE_MAX_ENTRIES = 180;
export const AI_CACHE_DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

export const AI_CACHE_TTL_BY_ENDPOINT: Record<string, number> = {
  '/api/ai/parecer': 2 * 60 * 60 * 1000, // 2h
  '/api/ai/diagnostico': 4 * 60 * 60 * 1000, // 4h
  '/api/ai/custos': 6 * 60 * 60 * 1000, // 6h
  '/api/ai/proposta': 6 * 60 * 60 * 1000, // 6h
  '/api/ai/parceiros-sinergia': 6 * 60 * 60 * 1000, // 6h
  '/api/ai/norma': 12 * 60 * 60 * 1000, // 12h
  '/api/ai/norma-verificar': 12 * 60 * 60 * 1000, // 12h
  '/api/ai/analisar-documento': 24 * 60 * 60 * 1000, // 24h
};

export interface AiCacheEntry<T = unknown> {
  key: string;
  endpoint: string;
  userScope: string;
  savedAt: number;
  expiresAt: number;
  lastAccessedAt: number;
  hitCount: number;
  sizeBytes: number;
  data: T;
}

export interface AiCacheStatsRecord {
  id: 'global';
  hits: number;
  misses: number;
  savedCalls: number;
  updatedAt: number;
}

export interface AiCacheLookupResult<T> {
  data: T;
  savedAt: number;
  expiresAt: number;
  hitCount: number;
  endpoint: string;
}

export interface AiCacheSummary {
  activeEntries: number;
  expiredEntries: number;
  totalBytes: number;
  hits: number;
  misses: number;
  savedCalls: number;
  byEndpoint: Record<string, number>;
  storageBackend: 'indexeddb' | 'memory';
}

// =============================================================================
// Canonical JSON Serialization & Deterministic Hashing
// =============================================================================

export function canonicalizeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalizeJson(item))).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const pairs = keys.map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`);
  return `{${pairs.join(',')}}`;
}

function fnv1aHex64(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + ((i & 0xff) << 1);
    h2 = Math.imul(h2, 0x01000193);
  }
  const p1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const p2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${p1}${p2}_${input.length.toString(16)}`;
}

export async function computeAiCacheKey(
  endpoint: string,
  payload: unknown,
  userScope = 'anon',
): Promise<string> {
  const normalizedEndpoint = endpoint.trim().toLowerCase();
  const canonical = canonicalizeJson(payload ?? null);
  const raw = `v1|${userScope}|${normalizedEndpoint}|${canonical}`;

  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
      const bytes = new TextEncoder().encode(raw);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
      const hex = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      return `${normalizedEndpoint}::${hex}`;
    }
  } catch {
    // Fallback to deterministic FNV-1a hash when subtle crypto is unavailable
  }
  return `${normalizedEndpoint}::${fnv1aHex64(raw)}`;
}

export function resolveEndpointCacheTtlMs(endpoint: string, overrideMs?: number): number {
  if (typeof overrideMs === 'number' && Number.isFinite(overrideMs) && overrideMs > 0) {
    return Math.round(overrideMs);
  }
  return AI_CACHE_TTL_BY_ENDPOINT[endpoint.trim().toLowerCase()] ?? AI_CACHE_DEFAULT_TTL_MS;
}

export function isCacheableAiResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const meta = data as AiResponseMeta;
  if (meta.fallback === true) return false;
  if (meta.origem === 'regras') return false;
  return true;
}

function estimatePayloadBytes(data: unknown): number {
  try {
    return JSON.stringify(data).length * 2;
  } catch {
    return 0;
  }
}

// =============================================================================
// Storage Abstraction: IndexedDB Primary + Graceful In-Memory Fallback
// =============================================================================

const memoryResponses = new Map<string, AiCacheEntry>();
let memoryStats: AiCacheStatsRecord = {
  id: 'global',
  hits: 0,
  misses: 0,
  savedCalls: 0,
  updatedAt: Date.now(),
};

let dbPromise: Promise<IDBDatabase | null> | null = null;

function hasIndexedDbSupport(): boolean {
  return typeof globalThis !== 'undefined' && typeof globalThis.indexedDB !== 'undefined' && globalThis.indexedDB !== null;
}

function openAiCacheDb(): Promise<IDBDatabase | null> {
  if (!hasIndexedDbSupport()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = globalThis.indexedDB.open(AI_IDB_NAME, AI_IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(AI_IDB_STORE_RESPONSES)) {
          const store = db.createObjectStore(AI_IDB_STORE_RESPONSES, { keyPath: 'key' });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
          store.createIndex('endpoint', 'endpoint', { unique: false });
          store.createIndex('lastAccessedAt', 'lastAccessedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(AI_IDB_STORE_META)) {
          db.createObjectStore(AI_IDB_STORE_META, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        resolve(null);
      };
      req.onblocked = () => {
        resolve(null);
      };
    } catch {
      dbPromise = null;
      resolve(null);
    }
  });

  return dbPromise;
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB request failed'));
  });
}

async function updateStats(delta: { hits?: number; misses?: number; savedCalls?: number }): Promise<void> {
  const now = Date.now();
  const db = await openAiCacheDb();
  if (!db) {
    memoryStats = {
      id: 'global',
      hits: memoryStats.hits + (delta.hits ?? 0),
      misses: memoryStats.misses + (delta.misses ?? 0),
      savedCalls: memoryStats.savedCalls + (delta.savedCalls ?? 0),
      updatedAt: now,
    };
    return;
  }

  try {
    const tx = db.transaction(AI_IDB_STORE_META, 'readwrite');
    const store = tx.objectStore(AI_IDB_STORE_META);
    const existing = (await idbRequest(store.get('global'))) as AiCacheStatsRecord | undefined;
    const next: AiCacheStatsRecord = {
      id: 'global',
      hits: (existing?.hits ?? 0) + (delta.hits ?? 0),
      misses: (existing?.misses ?? 0) + (delta.misses ?? 0),
      savedCalls: (existing?.savedCalls ?? 0) + (delta.savedCalls ?? 0),
      updatedAt: now,
    };
    store.put(next);
  } catch {
    // Ignore non-critical telemetry errors
  }
}

// =============================================================================
// Public Cache API
// =============================================================================

export async function getAiCachedResponse<T>(
  key: string,
  options?: { nowMs?: number; recordStats?: boolean },
): Promise<AiCacheLookupResult<T> | null> {
  if (!key) return null;
  const now = options?.nowMs ?? Date.now();
  const trackStats = options?.recordStats !== false;
  const db = await openAiCacheDb();

  if (!db) {
    const entry = memoryResponses.get(key);
    if (!entry) {
      if (trackStats) await updateStats({ misses: 1 });
      return null;
    }
    if (now > entry.expiresAt || !isCacheableAiResponse(entry.data)) {
      memoryResponses.delete(key);
      if (trackStats) await updateStats({ misses: 1 });
      return null;
    }
    entry.lastAccessedAt = now;
    entry.hitCount += 1;
    memoryResponses.set(key, entry);
    if (trackStats) await updateStats({ hits: 1, savedCalls: 1 });
    return {
      data: entry.data as T,
      savedAt: entry.savedAt,
      expiresAt: entry.expiresAt,
      hitCount: entry.hitCount,
      endpoint: entry.endpoint,
    };
  }

  try {
    const tx = db.transaction(AI_IDB_STORE_RESPONSES, 'readwrite');
    const store = tx.objectStore(AI_IDB_STORE_RESPONSES);
    const entry = (await idbRequest(store.get(key))) as AiCacheEntry<T> | undefined;

    if (!entry) {
      if (trackStats) void updateStats({ misses: 1 });
      return null;
    }

    if (now > entry.expiresAt || !isCacheableAiResponse(entry.data)) {
      store.delete(key);
      if (trackStats) void updateStats({ misses: 1 });
      return null;
    }

    const updated: AiCacheEntry<T> = {
      ...entry,
      lastAccessedAt: now,
      hitCount: (entry.hitCount || 0) + 1,
    };
    store.put(updated);
    if (trackStats) void updateStats({ hits: 1, savedCalls: 1 });

    return {
      data: updated.data,
      savedAt: updated.savedAt,
      expiresAt: updated.expiresAt,
      hitCount: updated.hitCount,
      endpoint: updated.endpoint,
    };
  } catch {
    return null;
  }
}

export async function setAiCachedResponse<T>(params: {
  key: string;
  endpoint: string;
  userScope?: string;
  data: T;
  ttlMs?: number;
  nowMs?: number;
  maxEntries?: number;
}): Promise<boolean> {
  if (!params.key || !isCacheableAiResponse(params.data)) {
    return false;
  }

  const now = params.nowMs ?? Date.now();
  const ttlMs = resolveEndpointCacheTtlMs(params.endpoint, params.ttlMs);
  const maxEntries = Math.max(1, params.maxEntries ?? AI_CACHE_MAX_ENTRIES);

  // Strip transient cache marker fields before persisting
  const cleanData =
    params.data && typeof params.data === 'object'
      ? (() => {
          const clone = { ...(params.data as Record<string, unknown>) };
          delete clone.fromCache;
          delete clone.cachedAt;
          delete clone.cacheExpiresAt;
          return clone as T;
        })()
      : params.data;

  const entry: AiCacheEntry<T> = {
    key: params.key,
    endpoint: params.endpoint.trim().toLowerCase(),
    userScope: params.userScope || 'anon',
    savedAt: now,
    expiresAt: now + ttlMs,
    lastAccessedAt: now,
    hitCount: 0,
    sizeBytes: estimatePayloadBytes(cleanData),
    data: cleanData,
  };

  const db = await openAiCacheDb();
  if (!db) {
    // Prune expired entries first
    for (const [k, v] of memoryResponses.entries()) {
      if (now > v.expiresAt) memoryResponses.delete(k);
    }
    memoryResponses.set(entry.key, entry);
    if (memoryResponses.size > maxEntries) {
      const sorted = Array.from(memoryResponses.values()).sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      const toRemove = memoryResponses.size - maxEntries;
      for (let i = 0; i < toRemove; i++) {
        memoryResponses.delete(sorted[i].key);
      }
    }
    return true;
  }

  try {
    const tx = db.transaction(AI_IDB_STORE_RESPONSES, 'readwrite');
    const store = tx.objectStore(AI_IDB_STORE_RESPONSES);
    store.put(entry);

    // Enforce TTL cleanup & LRU ceiling in the same write transaction
    const allEntries = (await idbRequest(store.getAll())) as AiCacheEntry[];
    const active: AiCacheEntry[] = [];
    for (const item of allEntries) {
      if (now > item.expiresAt) {
        store.delete(item.key);
      } else {
        active.push(item);
      }
    }
    if (active.length > maxEntries) {
      active.sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
      const overflow = active.length - maxEntries;
      for (let i = 0; i < overflow; i++) {
        if (active[i].key !== entry.key) {
          store.delete(active[i].key);
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function purgeExpiredAiCache(nowMs = Date.now()): Promise<number> {
  const db = await openAiCacheDb();
  let removed = 0;

  if (!db) {
    for (const [k, v] of memoryResponses.entries()) {
      if (nowMs > v.expiresAt) {
        memoryResponses.delete(k);
        removed += 1;
      }
    }
    return removed;
  }

  try {
    const tx = db.transaction(AI_IDB_STORE_RESPONSES, 'readwrite');
    const store = tx.objectStore(AI_IDB_STORE_RESPONSES);
    const all = (await idbRequest(store.getAll())) as AiCacheEntry[];
    for (const item of all) {
      if (nowMs > item.expiresAt) {
        store.delete(item.key);
        removed += 1;
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

export async function clearAiIndexedDbCache(options?: {
  endpoint?: string;
  resetStats?: boolean;
}): Promise<number> {
  const targetEndpoint = options?.endpoint?.trim().toLowerCase();
  const db = await openAiCacheDb();

  if (!db) {
    let removed = 0;
    if (targetEndpoint) {
      for (const [k, v] of memoryResponses.entries()) {
        if (v.endpoint === targetEndpoint) {
          memoryResponses.delete(k);
          removed += 1;
        }
      }
    } else {
      removed = memoryResponses.size;
      memoryResponses.clear();
    }
    if (options?.resetStats) {
      memoryStats = { id: 'global', hits: 0, misses: 0, savedCalls: 0, updatedAt: Date.now() };
    }
    return removed;
  }

  try {
    const stores = options?.resetStats
      ? [AI_IDB_STORE_RESPONSES, AI_IDB_STORE_META]
      : [AI_IDB_STORE_RESPONSES];
    const tx = db.transaction(stores, 'readwrite');
    const respStore = tx.objectStore(AI_IDB_STORE_RESPONSES);
    let removed = 0;

    if (targetEndpoint) {
      const all = (await idbRequest(respStore.getAll())) as AiCacheEntry[];
      for (const item of all) {
        if (item.endpoint === targetEndpoint) {
          respStore.delete(item.key);
          removed += 1;
        }
      }
    } else {
      removed = await idbRequest(respStore.count());
      respStore.clear();
    }

    if (options?.resetStats) {
      const metaStore = tx.objectStore(AI_IDB_STORE_META);
      metaStore.put({ id: 'global', hits: 0, misses: 0, savedCalls: 0, updatedAt: Date.now() });
    }
    return removed;
  } catch {
    return 0;
  }
}

export async function getAiCacheSummary(nowMs = Date.now()): Promise<AiCacheSummary> {
  const db = await openAiCacheDb();

  if (!db) {
    let activeEntries = 0;
    let expiredEntries = 0;
    let totalBytes = 0;
    const byEndpoint: Record<string, number> = {};
    for (const item of memoryResponses.values()) {
      if (nowMs > item.expiresAt) {
        expiredEntries += 1;
      } else {
        activeEntries += 1;
        totalBytes += item.sizeBytes || 0;
        byEndpoint[item.endpoint] = (byEndpoint[item.endpoint] || 0) + 1;
      }
    }
    return {
      activeEntries,
      expiredEntries,
      totalBytes,
      hits: memoryStats.hits,
      misses: memoryStats.misses,
      savedCalls: memoryStats.savedCalls,
      byEndpoint,
      storageBackend: 'memory',
    };
  }

  try {
    const tx = db.transaction([AI_IDB_STORE_RESPONSES, AI_IDB_STORE_META], 'readonly');
    const all = (await idbRequest(tx.objectStore(AI_IDB_STORE_RESPONSES).getAll())) as AiCacheEntry[];
    const stats = (await idbRequest(tx.objectStore(AI_IDB_STORE_META).get('global'))) as
      | AiCacheStatsRecord
      | undefined;

    let activeEntries = 0;
    let expiredEntries = 0;
    let totalBytes = 0;
    const byEndpoint: Record<string, number> = {};

    for (const item of all) {
      if (nowMs > item.expiresAt) {
        expiredEntries += 1;
      } else {
        activeEntries += 1;
        totalBytes += item.sizeBytes || 0;
        byEndpoint[item.endpoint] = (byEndpoint[item.endpoint] || 0) + 1;
      }
    }

    return {
      activeEntries,
      expiredEntries,
      totalBytes,
      hits: stats?.hits ?? 0,
      misses: stats?.misses ?? 0,
      savedCalls: stats?.savedCalls ?? 0,
      byEndpoint,
      storageBackend: 'indexeddb',
    };
  } catch {
    return {
      activeEntries: 0,
      expiredEntries: 0,
      totalBytes: 0,
      hits: 0,
      misses: 0,
      savedCalls: 0,
      byEndpoint: {},
      storageBackend: 'memory',
    };
  }
}

export function formatCacheExpiryTimeBR(expiresAt: number | undefined): string {
  if (!expiresAt || !Number.isFinite(expiresAt)) return '';
  try {
    return new Date(expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
