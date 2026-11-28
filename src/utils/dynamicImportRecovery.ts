import React from 'react';

const CHUNK_RELOAD_STORAGE_KEY = 'dm_chunk_recovery_last_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

/**
 * Identifica erros de carregamento de módulo dinâmico (ex.: deploy novo na Vercel
 * invalidando hashes antigos em abas já abertas ou cache intermediário).
 */
export function isDynamicImportChunkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : String(error ?? '');

  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('importing a module script failed') ||
    normalized.includes('error loading dynamically imported module') ||
    normalized.includes('loading chunk') ||
    normalized.includes('loading css chunk') ||
    normalized.includes('chunkloaderror') ||
    (normalized.includes('failed to fetch') && normalized.includes('/assets/')) ||
    (normalized.includes('text/html') && normalized.includes('mime type'))
  );
}

/**
 * Verifica se é seguro recarregar a página para sincronizar o novo bundle
 * sem nunca entrar em loop infinito de recarregamentos.
 */
export function shouldTriggerChunkRecoveryReload(
  nowMs: number = Date.now(),
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null,
): boolean {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.sessionStorage
        : null;

  if (!store) return false;
  try {
    const prevRaw = store.getItem(CHUNK_RELOAD_STORAGE_KEY);
    const prevMs = prevRaw ? Number(prevRaw) : 0;
    if (Number.isFinite(prevMs) && prevMs > 0 && nowMs - prevMs < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }
    store.setItem(CHUNK_RELOAD_STORAGE_KEY, String(nowMs));
    return true;
  } catch {
    return false;
  }
}

export function clearChunkRecoveryFlag(
  storage?: Pick<Storage, 'removeItem'> | null,
): void {
  const store =
    storage !== undefined
      ? storage
      : typeof window !== 'undefined'
        ? window.sessionStorage
        : null;
  if (!store) return;
  try {
    store.removeItem(CHUNK_RELOAD_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function reloadCurrentPageForFreshBundle(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * Executa um `import()` dinâmico com retentativa automática e recuperação transparente
 * caso o deploy na nuvem tenha atualizado os nomes de chunks com hash.
 */
export async function importModuleWithRetry<T>(
  importer: () => Promise<T>,
  options?: {
    maxRetries?: number;
    retryDelayMs?: number;
    reloadOnStaleChunk?: boolean;
  },
): Promise<T> {
  const maxRetries = Math.max(0, options?.maxRetries ?? 1);
  const retryDelayMs = Math.max(0, options?.retryDelayMs ?? 350);
  const reloadOnStaleChunk = options?.reloadOnStaleChunk ?? true;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const mod = await importer();
      return mod;
    } catch (err) {
      lastError = err;
      if (!isDynamicImportChunkError(err)) {
        throw err;
      }
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
      }
    }
  }

  if (reloadOnStaleChunk && isDynamicImportChunkError(lastError) && shouldTriggerChunkRecoveryReload()) {
    reloadCurrentPageForFreshBundle();
    // Mantém a promise pendente brevemente enquanto o navegador conclui o reload
    return new Promise<T>(() => {});
  }

  throw new Error(
    'Uma atualização recente do sistema foi publicada. Recarregue a página (F5) para concluir a operação com a versão mais nova.',
  );
}

/**
 * Versão resiliente do React.lazy para páginas, abas e modais sob demanda.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
): React.LazyExoticComponent<T> {
  return React.lazy(() => importModuleWithRetry(importer));
}

let globalChunkRecoveryInstalled = false;

/**
 * Registra listeners globais (`vite:preloadError` + rejeições de import dinâmico)
 * para recuperar automaticamente abas antigas após novos deploys.
 */
export function installChunkLoadRecovery(): void {
  if (typeof window === 'undefined' || globalChunkRecoveryInstalled) return;
  globalChunkRecoveryInstalled = true;

  window.addEventListener('vite:preloadError', (event: Event) => {
    const customEvent = event as CustomEvent<{ payload?: unknown }>;
    if (shouldTriggerChunkRecoveryReload()) {
      event.preventDefault();
      reloadCurrentPageForFreshBundle();
    } else if (customEvent.detail?.payload) {
      console.warn('[BundleRecovery] Preload error after recent reload:', customEvent.detail.payload);
    }
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    if (isDynamicImportChunkError(event.reason) && shouldTriggerChunkRecoveryReload()) {
      event.preventDefault();
      reloadCurrentPageForFreshBundle();
    }
  });
}
