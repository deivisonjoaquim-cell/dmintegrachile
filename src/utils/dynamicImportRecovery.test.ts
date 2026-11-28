import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clearChunkRecoveryFlag,
  importModuleWithRetry,
  isDynamicImportChunkError,
  shouldTriggerChunkRecoveryReload,
} from './dynamicImportRecovery';

test('isDynamicImportChunkError detects Vercel / Vite stale chunk errors', () => {
  assert.equal(
    isDynamicImportChunkError(
      new TypeError(
        'Failed to fetch dynamically imported module: https://dmintegrachile.vercel.app/assets/clientDiagnosticPdf-CkCFRDFz.js',
      ),
    ),
    true,
  );
  assert.equal(
    isDynamicImportChunkError(new Error('Importing a module script failed.')),
    true,
  );
  assert.equal(
    isDynamicImportChunkError(new Error('ChunkLoadError: Loading chunk 42 failed')),
    true,
  );
  assert.equal(
    isDynamicImportChunkError(new Error('Network timeout while calling Firestore')),
    false,
  );
});

test('shouldTriggerChunkRecoveryReload prevents infinite reload loops within cooldown window', () => {
  const mem = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
  };

  assert.equal(shouldTriggerChunkRecoveryReload(100_000, mockStorage), true);
  assert.equal(shouldTriggerChunkRecoveryReload(105_000, mockStorage), false);
  assert.equal(shouldTriggerChunkRecoveryReload(120_000, mockStorage), true);

  clearChunkRecoveryFlag(mockStorage);
  assert.equal(shouldTriggerChunkRecoveryReload(121_000, mockStorage), true);
});

test('importModuleWithRetry succeeds when second attempt recovers from transient chunk failure', async () => {
  let attempts = 0;
  const result = await importModuleWithRetry(
    async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new TypeError(
          'Failed to fetch dynamically imported module: https://dmintegrachile.vercel.app/assets/clientDiagnosticPdf-CkCFRDFz.js',
        );
      }
      return { ok: true };
    },
    { maxRetries: 1, retryDelayMs: 5, reloadOnStaleChunk: false },
  );

  assert.equal(attempts, 2);
  assert.deepEqual(result, { ok: true });
});

test('importModuleWithRetry throws user-friendly message when stale chunk persists without reload', async () => {
  await assert.rejects(
    () =>
      importModuleWithRetry(
        async () => {
          throw new TypeError(
            'Failed to fetch dynamically imported module: https://dmintegrachile.vercel.app/assets/clientDiagnosticPdf-CkCFRDFz.js',
          );
        },
        { maxRetries: 1, retryDelayMs: 5, reloadOnStaleChunk: false },
      ),
    /Recarregue a página/i,
  );
});
