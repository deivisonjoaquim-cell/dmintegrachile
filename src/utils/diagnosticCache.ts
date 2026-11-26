import type { DiagnosticAnswers } from '../types/domain';
import type { DiagnosticResult } from './diagnosticEngine';

export const DIAGNOSTIC_CACHE_STORAGE_KEY = 'dm_integra_diagnostic_cache_v3';
export const LEGACY_DIAGNOSTIC_DRAFT_KEY = 'dm_integra_diagnostico_rascunho_v2';
export const DEFAULT_DIAGNOSTIC_CACHE_TTL_DAYS = 30;

export interface StorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface DiagnosticDraftSnapshot {
  answers: DiagnosticAnswers;
  step: number;
  maxStepReached: number;
  sessionToken?: string;
  leadId?: string;
  leadCreatedAt?: string;
  sessionCreatedAt?: string;
  completionPct: number;
  updatedAt: string;
  expiresAtMs: number;
}

export interface DiagnosticCachedResult {
  answers: DiagnosticAnswers;
  result: DiagnosticResult;
  savedLeadId?: string | null;
  resumeUrl?: string | null;
  savedAt: string;
  expiresAtMs: number;
}

export interface DiagnosticLocalCache {
  version: 3;
  draft: DiagnosticDraftSnapshot | null;
  lastResult: DiagnosticCachedResult | null;
}

export interface SaveDiagnosticDraftInput {
  answers: DiagnosticAnswers;
  step: number;
  maxStepReached?: number;
  sessionToken?: string;
  leadId?: string | null;
  leadCreatedAt?: string;
  sessionCreatedAt?: string;
}

export interface SaveDiagnosticResultInput {
  answers: DiagnosticAnswers;
  result: DiagnosticResult;
  savedLeadId?: string | null;
  resumeUrl?: string | null;
  clearDraft?: boolean;
}

interface LegacyDraftPayload {
  answers?: DiagnosticAnswers;
  step?: number;
  sessionToken?: string;
  leadId?: string;
  leadCreatedAt?: string;
  sessionCreatedAt?: string;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

function clampStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  return Math.min(6, Math.max(1, Math.round(step)));
}

export function createEmptyDiagnosticCache(): DiagnosticLocalCache {
  return {
    version: 3,
    draft: null,
    lastResult: null,
  };
}

export function computeDraftCompletionPct(answers: Partial<DiagnosticAnswers>, step: number): number {
  const checks = [
    Boolean(answers.nome && answers.nome.trim().length >= 2),
    Boolean(answers.email && answers.email.includes('@')),
    Boolean(answers.whatsapp && answers.whatsapp.replace(/\D/g, '').length >= 10),
    Boolean(answers.localizacao),
    Boolean(answers.faixaEtaria),
    typeof answers.nacionalidadeBrasileira === 'boolean',
    Boolean(answers.passaporteStatus),
    typeof answers.vinculoFamiliarChile === 'boolean',
    Boolean(answers.objetivo),
    typeof answers.overstay === 'boolean' || (answers.riscoConsultaConsultor?.length ?? 0) > 0,
    Boolean(answers.prazoPretendido),
    Boolean(answers.lgpdAceito),
  ];

  const filledCount = checks.filter(Boolean).length;
  const fieldPct = Math.round((filledCount / checks.length) * 100);
  const stepFloor = Math.round(((clampStep(step) - 1) / 6) * 85);
  return Math.min(100, Math.max(fieldPct, stepFloor));
}

export function hasMeaningfulDraftContent(answers: Partial<DiagnosticAnswers>, step: number): boolean {
  if (clampStep(step) > 1) return true;
  if (answers.nome && answers.nome.trim().length > 0) return true;
  if (answers.email && answers.email.trim().length > 0) return true;
  if (answers.whatsapp && answers.whatsapp.replace(/\D/g, '').length > 0) return true;
  if (answers.cidadeUf && answers.cidadeUf.trim().length > 0) return true;
  if (answers.documentosJaPossui && answers.documentosJaPossui.length > 0) return true;
  if (answers.vinculoFamiliarChile === true) return true;
  if (answers.possuiOfertaTrabalhoFormal === true) return true;
  if (answers.possuiRendaPassiva === true) return true;
  return false;
}

function isValidDraft(draft: unknown, nowMs: number): draft is DiagnosticDraftSnapshot {
  if (!draft || typeof draft !== 'object') return false;
  const candidate = draft as Partial<DiagnosticDraftSnapshot>;
  if (!candidate.answers || typeof candidate.answers !== 'object') return false;
  if (typeof candidate.expiresAtMs === 'number' && candidate.expiresAtMs <= nowMs) return false;
  return true;
}

function isValidCachedResult(entry: unknown, nowMs: number): entry is DiagnosticCachedResult {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<DiagnosticCachedResult>;
  if (!candidate.answers || typeof candidate.answers !== 'object') return false;
  if (!candidate.result || typeof candidate.result !== 'object') return false;
  if (!candidate.result.viabilidade || typeof candidate.result.viabilidade.total !== 'number') return false;
  if (typeof candidate.expiresAtMs === 'number' && candidate.expiresAtMs <= nowMs) return false;
  return true;
}

function persistCache(cache: DiagnosticLocalCache, storage: StorageLike | null): void {
  if (!storage) return;
  try {
    if (!cache.draft && !cache.lastResult) {
      storage.removeItem(DIAGNOSTIC_CACHE_STORAGE_KEY);
      return;
    }
    storage.setItem(DIAGNOSTIC_CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore storage quota or private mode restrictions safely
  }
}

export function readDiagnosticCache(
  storage: StorageLike | null = getDefaultStorage(),
  nowMs: number = Date.now(),
  ttlDays: number = DEFAULT_DIAGNOSTIC_CACHE_TTL_DAYS,
): DiagnosticLocalCache {
  if (!storage) return createEmptyDiagnosticCache();

  try {
    const raw = storage.getItem(DIAGNOSTIC_CACHE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DiagnosticLocalCache>;
      const draft = isValidDraft(parsed.draft, nowMs)
        ? {
            ...parsed.draft,
            step: clampStep(parsed.draft.step),
            maxStepReached: Math.max(clampStep(parsed.draft.step), clampStep(parsed.draft.maxStepReached || parsed.draft.step)),
            completionPct:
              typeof parsed.draft.completionPct === 'number'
                ? parsed.draft.completionPct
                : computeDraftCompletionPct(parsed.draft.answers, parsed.draft.step),
          }
        : null;

      const lastResult = isValidCachedResult(parsed.lastResult, nowMs) ? parsed.lastResult : null;
      const normalized: DiagnosticLocalCache = {
        version: 3,
        draft,
        lastResult,
      };

      // Prune expired entries back to storage so stale entries do not linger
      if (parsed.draft !== draft || parsed.lastResult !== lastResult) {
        persistCache(normalized, storage);
      }
      return normalized;
    }

    // Seamless migration from legacy v2 draft key
    const legacyRaw = storage.getItem(LEGACY_DIAGNOSTIC_DRAFT_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as LegacyDraftPayload;
      if (legacy.answers && typeof legacy.answers === 'object') {
        const step = clampStep(legacy.step ?? 1);
        const migrated: DiagnosticLocalCache = {
          version: 3,
          draft: {
            answers: legacy.answers,
            step,
            maxStepReached: step,
            sessionToken: legacy.sessionToken,
            leadId: legacy.leadId,
            leadCreatedAt: legacy.leadCreatedAt,
            sessionCreatedAt: legacy.sessionCreatedAt,
            completionPct: computeDraftCompletionPct(legacy.answers, step),
            updatedAt: new Date(nowMs).toISOString(),
            expiresAtMs: nowMs + Math.max(1, ttlDays) * 86_400_000,
          },
          lastResult: null,
        };
        persistCache(migrated, storage);
        storage.removeItem(LEGACY_DIAGNOSTIC_DRAFT_KEY);
        return migrated;
      }
    }
  } catch {
    return createEmptyDiagnosticCache();
  }

  return createEmptyDiagnosticCache();
}

export function writeDiagnosticDraft(
  input: SaveDiagnosticDraftInput,
  storage: StorageLike | null = getDefaultStorage(),
  nowMs: number = Date.now(),
  ttlDays: number = DEFAULT_DIAGNOSTIC_CACHE_TTL_DAYS,
): DiagnosticLocalCache {
  const existing = readDiagnosticCache(storage, nowMs, ttlDays);
  const step = clampStep(input.step);
  const maxStepReached = Math.max(
    step,
    clampStep(input.maxStepReached ?? existing.draft?.maxStepReached ?? step),
  );

  const nextDraft: DiagnosticDraftSnapshot = {
    answers: { ...input.answers },
    step,
    maxStepReached,
    sessionToken: input.sessionToken ?? existing.draft?.sessionToken,
    leadId: input.leadId ?? existing.draft?.leadId,
    leadCreatedAt: input.leadCreatedAt ?? existing.draft?.leadCreatedAt,
    sessionCreatedAt: input.sessionCreatedAt ?? existing.draft?.sessionCreatedAt,
    completionPct: computeDraftCompletionPct(input.answers, step),
    updatedAt: new Date(nowMs).toISOString(),
    expiresAtMs: nowMs + Math.max(1, ttlDays) * 86_400_000,
  };

  const nextCache: DiagnosticLocalCache = {
    version: 3,
    draft: nextDraft,
    lastResult: existing.lastResult,
  };

  persistCache(nextCache, storage);
  try {
    storage?.removeItem(LEGACY_DIAGNOSTIC_DRAFT_KEY);
  } catch {
    // ignore
  }
  return nextCache;
}

export function writeDiagnosticResult(
  input: SaveDiagnosticResultInput,
  storage: StorageLike | null = getDefaultStorage(),
  nowMs: number = Date.now(),
  ttlDays: number = DEFAULT_DIAGNOSTIC_CACHE_TTL_DAYS,
): DiagnosticLocalCache {
  const existing = readDiagnosticCache(storage, nowMs, ttlDays);
  const shouldClearDraft = input.clearDraft ?? true;

  const nextResult: DiagnosticCachedResult = {
    answers: { ...input.answers },
    result: input.result,
    savedLeadId: input.savedLeadId ?? null,
    resumeUrl: input.resumeUrl ?? null,
    savedAt: new Date(nowMs).toISOString(),
    expiresAtMs: nowMs + Math.max(1, ttlDays) * 86_400_000,
  };

  const nextCache: DiagnosticLocalCache = {
    version: 3,
    draft: shouldClearDraft ? null : existing.draft,
    lastResult: nextResult,
  };

  persistCache(nextCache, storage);
  try {
    storage?.removeItem(LEGACY_DIAGNOSTIC_DRAFT_KEY);
  } catch {
    // ignore
  }
  return nextCache;
}

export function clearDiagnosticDraftStorage(
  storage: StorageLike | null = getDefaultStorage(),
  nowMs: number = Date.now(),
): DiagnosticLocalCache {
  const existing = readDiagnosticCache(storage, nowMs);
  const nextCache: DiagnosticLocalCache = {
    version: 3,
    draft: null,
    lastResult: existing.lastResult,
  };
  persistCache(nextCache, storage);
  try {
    storage?.removeItem(LEGACY_DIAGNOSTIC_DRAFT_KEY);
  } catch {
    // ignore
  }
  return nextCache;
}

export function clearDiagnosticCacheStorage(
  storage: StorageLike | null = getDefaultStorage(),
): DiagnosticLocalCache {
  const empty = createEmptyDiagnosticCache();
  try {
    storage?.removeItem(DIAGNOSTIC_CACHE_STORAGE_KEY);
    storage?.removeItem(LEGACY_DIAGNOSTIC_DRAFT_KEY);
  } catch {
    // ignore
  }
  return empty;
}

export function formatCacheTimestampPT(iso?: string | null): string {
  if (!iso) return '';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} às ${hh}:${min}`;
}
