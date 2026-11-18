import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { AI_FALLBACK_LABEL } from './geminiFallbacks';

export const MSG_AI_HIGH_DEMAND =
  'O serviço de IA está com alta demanda. Tentamos novamente automaticamente; se não responder, geramos um rascunho pelas regras. Você pode tentar de novo em instantes.';
export const MSG_AI_OTHER_ERROR =
  'Não foi possível gerar o rascunho agora. Seus dados foram mantidos.';
export const MSG_AI_CONCURRENT_REQUEST =
  'Já existe uma solicitação de IA em andamento para sua conta. Aguarde a conclusão antes de tentar novamente.';

export type ModelTier = 'principal' | 'reserva' | 'regras';

export interface GeminiRuntimeConfig {
  apiKey: string;
  primaryModel: string;
  fallbackModel: string;
  timeoutMs: number;
  maxAttempts: number;
  fallbackAttempts: number;
  baseDelayMs: number;
}

export function getGeminiRuntimeConfig(): GeminiRuntimeConfig {
  const apiKey = process.env.GEMINI_API_KEY || '';
  const primaryModel = (process.env.GEMINI_MODEL_PRIMARY || '').trim() || 'gemini-4-hydrogen';
  const fallbackModel = (process.env.GEMINI_MODEL_FALLBACK || '').trim() || 'gemini-3.1-flash-lite';
  const parsedTimeout = Number(process.env.GEMINI_TIMEOUT_MS || 40000);
  const parsedMaxAttempts = Number(process.env.GEMINI_MAX_ATTEMPTS || 4);
  const parsedFallbackAttempts = Number(process.env.GEMINI_FALLBACK_ATTEMPTS || 2);
  const parsedBaseDelay = Number(process.env.GEMINI_RETRY_BASE_MS || 1000);

  return {
    apiKey,
    primaryModel,
    fallbackModel,
    timeoutMs: Number.isFinite(parsedTimeout) && parsedTimeout >= 1000 ? parsedTimeout : 40000,
    maxAttempts: Number.isFinite(parsedMaxAttempts) && parsedMaxAttempts >= 1 ? Math.min(6, parsedMaxAttempts) : 4,
    fallbackAttempts: Number.isFinite(parsedFallbackAttempts) && parsedFallbackAttempts >= 1 ? Math.min(3, parsedFallbackAttempts) : 2,
    baseDelayMs: Number.isFinite(parsedBaseDelay) && parsedBaseDelay >= 0 ? parsedBaseDelay : 1000,
  };
}

// =============================================================================
// Concurrency Guard per User (prevents double-click / simultaneous calls)
// =============================================================================
const activeUserCalls = new Map<string, { route: string; startedAt: number }>();
const STALE_LOCK_MS = 5 * 60 * 1000;

export function acquireUserAiLock(uid: string, route: string): boolean {
  const now = Date.now();
  const existing = activeUserCalls.get(uid);
  if (existing && now - existing.startedAt < STALE_LOCK_MS) {
    return false;
  }
  activeUserCalls.set(uid, { route, startedAt: now });
  return true;
}

export function releaseUserAiLock(uid: string): void {
  activeUserCalls.delete(uid);
}

// =============================================================================
// Error Classification & Retry-After Extraction
// =============================================================================
export interface ClassifiedGeminiError {
  statusCode?: number;
  kind: 'temporary' | 'definitive' | 'blocked' | 'malformed_json' | 'timeout' | 'config_missing';
  isHighDemand: boolean;
  retryable: boolean;
  retryAfterMs?: number;
  safeReason: string;
}

function readHeaderValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const h = headers as Record<string, unknown> & { get?: (k: string) => string | null };
  if (typeof h.get === 'function') {
    const val = h.get(name) || h.get(name.toLowerCase());
    if (val) return val;
  }
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(h)) {
    if (k.toLowerCase() === lower && typeof v === 'string') return v;
  }
  return undefined;
}

export function parseRetryAfterMs(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const secs = Number(trimmed);
    return Number.isFinite(secs) && secs > 0 ? Math.min(30000, Math.round(secs * 1000)) : undefined;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? Math.min(30000, delta) : undefined;
  }
  return undefined;
}

export function classifyGeminiError(err: unknown): ClassifiedGeminiError {
  if (!err) {
    return { kind: 'temporary', isHighDemand: false, retryable: true, safeReason: 'unknown_error' };
  }
  const obj = typeof err === 'object' ? (err as Record<string, unknown>) : {};
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(obj);
  const lower = msg.toLowerCase();

  if (lower.includes('config_missing') || lower.includes('gemini_api_key não configurada')) {
    return { statusCode: 503, kind: 'config_missing', isHighDemand: false, retryable: false, safeReason: 'missing_api_key' };
  }

  if (lower.includes('malformed_json')) {
    return { kind: 'malformed_json', isHighDemand: false, retryable: false, safeReason: 'malformed_json' };
  }

  if (
    lower.includes('safety') ||
    lower.includes('prohibited_content') ||
    lower.includes('blocklist') ||
    lower.includes('recitation') ||
    lower.includes('response_blocked') ||
    lower.includes('blocked')
  ) {
    return { statusCode: 400, kind: 'blocked', isHighDemand: false, retryable: false, safeReason: 'response_blocked' };
  }

  if (lower.includes('timeout') || lower.includes('timed out') || obj.name === 'AbortError' || obj.name === 'TimeoutError') {
    return { statusCode: 504, kind: 'timeout', isHighDemand: true, retryable: true, safeReason: 'timeout' };
  }

  let statusCode: number | undefined;
  if (typeof obj.status === 'number') statusCode = obj.status;
  else if (typeof obj.statusCode === 'number') statusCode = obj.statusCode;
  else if (typeof obj.code === 'number') statusCode = obj.code;

  if (!statusCode) {
    const codeMatch = msg.match(/"code"\s*:\s*(\d{3})\b|\b(503|429|500|502|504|400|401|403|404)\b/);
    if (codeMatch) {
      statusCode = Number(codeMatch[1] || codeMatch[2]);
    }
  }

  const respObj = (obj.response && typeof obj.response === 'object' ? obj.response : {}) as Record<string, unknown>;
  const retryAfterHeader =
    readHeaderValue(obj.headers, 'retry-after') || readHeaderValue(respObj.headers, 'retry-after');
  const retryAfterMs = parseRetryAfterMs(retryAfterHeader);

  if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
    return {
      statusCode,
      kind: 'definitive',
      isHighDemand: false,
      retryable: false,
      safeReason: `http_${statusCode}`,
    };
  }
  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('unauthenticated') ||
    lower.includes('invalid_argument')
  ) {
    return {
      statusCode: statusCode || 400,
      kind: 'definitive',
      isHighDemand: false,
      retryable: false,
      safeReason: 'definitive_api_error',
    };
  }

  if (
    statusCode === 503 ||
    statusCode === 429 ||
    lower.includes('unavailable') ||
    lower.includes('resource_exhausted') ||
    lower.includes('high demand') ||
    lower.includes('overloaded')
  ) {
    return {
      statusCode: statusCode || 503,
      kind: 'temporary',
      isHighDemand: true,
      retryable: true,
      retryAfterMs,
      safeReason: `http_${statusCode || 503}_high_demand`,
    };
  }

  if (
    statusCode === 500 ||
    statusCode === 502 ||
    statusCode === 504 ||
    lower.includes('econnreset') ||
    lower.includes('etimedout') ||
    lower.includes('econnrefused') ||
    lower.includes('enotfound') ||
    lower.includes('fetch failed') ||
    lower.includes('network')
  ) {
    return {
      statusCode: statusCode || 500,
      kind: 'temporary',
      isHighDemand: false,
      retryable: true,
      retryAfterMs,
      safeReason: `transient_${statusCode || 'network'}`,
    };
  }

  return {
    statusCode,
    kind: 'temporary',
    isHighDemand: false,
    retryable: true,
    retryAfterMs,
    safeReason: 'transient_unknown',
  };
}

export function computeRetryDelayMs(
  attemptIndex: number,
  baseDelayMs: number,
  retryAfterMs?: number,
  rng: () => number = Math.random,
): number {
  const exp = baseDelayMs * Math.pow(2, Math.max(0, attemptIndex - 1));
  const jitterMax = Math.min(350, Math.round(exp * 0.25));
  const jitter = Math.round(rng() * jitterMax);
  const computed = exp + jitter;
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(30000, Math.max(computed, retryAfterMs));
  }
  return Math.min(30000, computed);
}

// =============================================================================
// JSON Extraction & Validation Helper
// =============================================================================
export function extractAndValidateJson<T>(
  response: GenerateContentResponse,
  validateJson?: (parsed: Record<string, unknown>) => T | null,
): { ok: true; data: T } | { ok: false; blocked?: boolean } {
  const firstCandidate = response.candidates?.[0];
  const finishReason = firstCandidate?.finishReason ? String(firstCandidate.finishReason).toUpperCase() : '';
  if (
    finishReason === 'SAFETY' ||
    finishReason === 'RECITATION' ||
    finishReason === 'PROHIBITED_CONTENT' ||
    finishReason === 'BLOCKLIST' ||
    finishReason === 'SPII'
  ) {
    return { ok: false, blocked: true };
  }

  const rawText = (response.text || '').trim();
  if (!rawText) {
    return { ok: false };
  }
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false };
    }
    const obj = parsed as Record<string, unknown>;
    if (validateJson) {
      const validated = validateJson(obj);
      if (!validated) return { ok: false };
      return { ok: true, data: validated };
    }
    return { ok: true, data: obj as T };
  } catch {
    return { ok: false };
  }
}

// =============================================================================
// Core Unified Wrapper: chamarGemini()
// =============================================================================
export interface GeminiGenerateArgs {
  model: string;
  contents: unknown;
  config: Record<string, unknown>;
}

export interface ChamarGeminiParams<T extends Record<string, unknown>> {
  route: string;
  contents: unknown;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
  tools?: unknown[];
  validateJson: (parsed: Record<string, unknown>) => T | null;
  buildFallback: () => T;
  onProgress?: (event: { attempt: number; maxAttempts: number; modelTier: ModelTier; message: string }) => void;
  // Dependency injection overrides for testing (keeps runtime decoupled and cleanly testable)
  configOverride?: Partial<GeminiRuntimeConfig>;
  generateFn?: (args: GeminiGenerateArgs) => Promise<GenerateContentResponse>;
  sleepFn?: (ms: number) => Promise<void>;
  rngFn?: () => number;
}

export interface ChamarGeminiResult<T extends Record<string, unknown>> {
  ok: boolean;
  statusCode: number;
  payload?: T & {
    fallback: boolean;
    origem: ModelTier;
    origemLabel: string;
    modeloUsado: string;
    tentativas: number;
    mensagemUsuario?: string;
  };
  errorMessage?: string;
  audit: {
    rota: string;
    modeloTipo: ModelTier;
    modeloNome: string;
    tentativas: number;
    resultado: 'sucesso' | 'fallback_regras' | 'erro_definitivo';
    statusMotivo: string;
  };
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSingleAttemptWithTimeout(
  generateFn: (args: GeminiGenerateArgs) => Promise<GenerateContentResponse>,
  args: GeminiGenerateArgs,
  timeoutMs: number,
): Promise<GenerateContentResponse> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const callPromise = generateFn({
      ...args,
      config: {
        ...args.config,
        abortSignal: controller.signal,
      },
    });
    callPromise.catch(() => {});
    return await Promise.race([callPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function chamarGemini<T extends Record<string, unknown>>(
  params: ChamarGeminiParams<T>,
): Promise<ChamarGeminiResult<T>> {
  const runtime = { ...getGeminiRuntimeConfig(), ...(params.configOverride || {}) };
  const sleep = params.sleepFn || defaultSleep;
  const rng = params.rngFn || Math.random;

  let generateFn = params.generateFn;
  if (!generateFn) {
    if (!runtime.apiKey || runtime.apiKey === 'MY_GEMINI_API_KEY') {
      const fb = params.buildFallback();
      return {
        ok: true,
        statusCode: 200,
        payload: {
          ...fb,
          fallback: true,
          origem: 'regras',
          origemLabel: AI_FALLBACK_LABEL,
          modeloUsado: 'regras',
          tentativas: 0,
          mensagemUsuario: MSG_AI_OTHER_ERROR,
        },
        audit: {
          rota: params.route,
          modeloTipo: 'regras',
          modeloNome: 'regras',
          tentativas: 0,
          resultado: 'fallback_regras',
          statusMotivo: 'missing_api_key',
        },
      };
    }
    const ai = new GoogleGenAI({
      apiKey: runtime.apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    generateFn = (args) =>
      ai.models.generateContent({
        model: args.model,
        contents: args.contents as never,
        config: args.config as never,
      });
  }

  let totalAttempts = 0;
  let lastError: ClassifiedGeminiError | null = null;
  let sawMalformedJson = false;

  const tryModelPhase = async (
    modelName: string,
    tier: 'principal' | 'reserva',
    maxTries: number,
  ): Promise<{ matched?: T; fatal?: ClassifiedGeminiError }> => {
    let malformedRetriesLeft = 1;

    for (let attempt = 1; attempt <= maxTries; attempt++) {
      totalAttempts += 1;
      params.onProgress?.({
        attempt,
        maxAttempts: maxTries,
        modelTier: tier,
        message:
          tier === 'principal'
            ? attempt === 1
              ? `Consultando IA (tentativa 1 de ${maxTries})…`
              : `Tentativa ${attempt} de ${maxTries}…`
            : `Tentando modelo reserva (${attempt} de ${maxTries})…`,
      });

      try {
        const requestConfig: Record<string, unknown> = {
          systemInstruction: params.systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: params.responseSchema,
        };
        if (params.tools && params.tools.length > 0) {
          requestConfig.tools = params.tools;
        }

        const resp = await runSingleAttemptWithTimeout(
          generateFn!,
          {
            model: modelName,
            contents: params.contents,
            config: requestConfig,
          },
          runtime.timeoutMs,
        );

        const attachGrounding = (data: T): T => {
          const chunks = resp.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (!Array.isArray(chunks) || chunks.length === 0) return data;
          const fontesOnline = chunks
            .map((c: { web?: { uri?: string; title?: string } }) => ({
              titulo: typeof c?.web?.title === 'string' && c.web.title.trim() ? c.web.title.trim() : 'Fonte oficial',
              url: typeof c?.web?.uri === 'string' ? c.web.uri.trim() : '',
            }))
            .filter((x) => Boolean(x.url))
            .slice(0, 8);
          if (fontesOnline.length === 0) return data;
          return { ...data, fontesOnline } as T;
        };

        const parsed = extractAndValidateJson<T>(resp, params.validateJson);
        if (parsed.ok) {
          return { matched: attachGrounding(parsed.data) };
        }
        if (parsed.blocked) {
          return {
            fatal: {
              statusCode: 400,
              kind: 'blocked',
              isHighDemand: false,
              retryable: false,
              safeReason: 'response_blocked',
            },
          };
        }

        // JSON came back malformed -> retry ONCE without consuming extra full error loop
        sawMalformedJson = true;
        if (malformedRetriesLeft > 0) {
          malformedRetriesLeft -= 1;
          totalAttempts += 1;
          params.onProgress?.({
            attempt,
            maxAttempts: maxTries,
            modelTier: tier,
            message: 'Resposta JSON incompleta — repetindo uma vez…',
          });
          const retryResp = await runSingleAttemptWithTimeout(
            generateFn!,
            {
              model: modelName,
              contents: params.contents,
              config: requestConfig,
            },
            runtime.timeoutMs,
          );
          const second = extractAndValidateJson<T>(retryResp, params.validateJson);
          if (second.ok) {
            const retryChunks = retryResp.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (Array.isArray(retryChunks) && retryChunks.length > 0) {
              const fontesOnline = retryChunks
                .map((c: { web?: { uri?: string; title?: string } }) => ({
                  titulo: typeof c?.web?.title === 'string' && c.web.title.trim() ? c.web.title.trim() : 'Fonte oficial',
                  url: typeof c?.web?.uri === 'string' ? c.web.uri.trim() : '',
                }))
                .filter((x) => Boolean(x.url))
                .slice(0, 8);
              if (fontesOnline.length > 0) {
                return { matched: { ...second.data, fontesOnline } as T };
              }
            }
            return { matched: second.data };
          }
          if (second.blocked) {
            return {
              fatal: {
                statusCode: 400,
                kind: 'blocked',
                isHighDemand: false,
                retryable: false,
                safeReason: 'response_blocked',
              },
            };
          }
        }

        lastError = {
          kind: 'malformed_json',
          isHighDemand: false,
          retryable: false,
          safeReason: 'malformed_json_after_retry',
        };
        return {};
      } catch (err) {
        const classified = classifyGeminiError(err);
        lastError = classified;
        console.error(
          `[Gemini][${params.route}] model=${modelName} tier=${tier} attempt=${attempt}/${maxTries} reason=${classified.safeReason}`,
        );

        if (!classified.retryable) {
          return { fatal: classified };
        }

        if (attempt < maxTries) {
          const delayMs = computeRetryDelayMs(attempt, runtime.baseDelayMs, classified.retryAfterMs, rng);
          params.onProgress?.({
            attempt: attempt + 1,
            maxAttempts: maxTries,
            modelTier: tier,
            message: `Tentativa ${attempt + 1} de ${maxTries}…`,
          });
          await sleep(delayMs);
        }
      }
    }
    return {};
  };

  // Phase 1: Primary model (up to 4 attempts)
  const primaryOutcome = await tryModelPhase(runtime.primaryModel, 'principal', runtime.maxAttempts);
  if (primaryOutcome.matched) {
    return {
      ok: true,
      statusCode: 200,
      payload: {
        ...primaryOutcome.matched,
        fallback: false,
        origem: 'principal',
        origemLabel: 'Rascunho gerado por IA (modelo principal)',
        modeloUsado: runtime.primaryModel,
        tentativas: totalAttempts,
      },
      audit: {
        rota: params.route,
        modeloTipo: 'principal',
        modeloNome: runtime.primaryModel,
        tentativas: totalAttempts,
        resultado: 'sucesso',
        statusMotivo: 'ok',
      },
    };
  }
  if (primaryOutcome.fatal) {
    return {
      ok: false,
      statusCode: primaryOutcome.fatal.statusCode || 400,
      errorMessage: MSG_AI_OTHER_ERROR,
      audit: {
        rota: params.route,
        modeloTipo: 'principal',
        modeloNome: runtime.primaryModel,
        tentativas: totalAttempts,
        resultado: 'erro_definitivo',
        statusMotivo: primaryOutcome.fatal.safeReason,
      },
    };
  }

  // Phase 2: Lighter backup model if configured and different from primary
  if (runtime.fallbackModel && runtime.fallbackModel !== runtime.primaryModel && !sawMalformedJson) {
    const backupOutcome = await tryModelPhase(runtime.fallbackModel, 'reserva', runtime.fallbackAttempts);
    if (backupOutcome.matched) {
      return {
        ok: true,
        statusCode: 200,
        payload: {
          ...backupOutcome.matched,
          fallback: false,
          origem: 'reserva',
          origemLabel: 'Rascunho gerado por IA (modelo reserva)',
          modeloUsado: runtime.fallbackModel,
          tentativas: totalAttempts,
        },
        audit: {
          rota: params.route,
          modeloTipo: 'reserva',
          modeloNome: runtime.fallbackModel,
          tentativas: totalAttempts,
          resultado: 'sucesso',
          statusMotivo: 'ok_reserva',
        },
      };
    }
    if (backupOutcome.fatal) {
      return {
        ok: false,
        statusCode: backupOutcome.fatal.statusCode || 400,
        errorMessage: MSG_AI_OTHER_ERROR,
        audit: {
          rota: params.route,
          modeloTipo: 'reserva',
          modeloNome: runtime.fallbackModel,
          tentativas: totalAttempts,
          resultado: 'erro_definitivo',
          statusMotivo: backupOutcome.fatal.safeReason,
        },
      };
    }
  }

  // Phase 3: Deterministic rule-based fallback (never leave user without result on temp errors/malformed JSON)
  const fallbackDraft = params.buildFallback();
  const finalErr = lastError as ClassifiedGeminiError | null;
  const isHighDemand = Boolean(finalErr?.isHighDemand);
  const mensagemUsuario = isHighDemand ? MSG_AI_HIGH_DEMAND : MSG_AI_OTHER_ERROR;

  return {
    ok: true,
    statusCode: 200,
    payload: {
      ...fallbackDraft,
      fallback: true,
      origem: 'regras',
      origemLabel: AI_FALLBACK_LABEL,
      modeloUsado: 'regras',
      tentativas: totalAttempts,
      mensagemUsuario,
    },
    audit: {
      rota: params.route,
      modeloTipo: 'regras',
      modeloNome: 'regras',
      tentativas: totalAttempts,
      resultado: 'fallback_regras',
      statusMotivo: finalErr?.safeReason || 'fallback',
    },
  };
}
