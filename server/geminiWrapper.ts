import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { AI_FALLBACK_LABEL } from './geminiFallbacks.ts';

export const DEFAULT_GEMINI_PRIMARY_MODEL = 'gemini-4-hydrogen';
export const DEFAULT_GEMINI_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

export const MSG_AI_HIGH_DEMAND =
  'O serviço de IA está com alta demanda. Tentamos novamente automaticamente; se não responder, geramos um rascunho pelas regras. Você pode tentar de novo em instantes.';
export const MSG_AI_OTHER_ERROR =
  'Não foi possível gerar o rascunho agora. Seus dados foram mantidos.';
export const MSG_AI_MISSING_KEY =
  'Modo de regras locais ativo: a chave GEMINI_API_KEY não está configurada no ambiente do servidor (verifique Settings > Secrets no AI Studio ou Environment Variables na Vercel).';
export const MSG_AI_INVALID_KEY =
  'Chave de IA inválida ou sem permissão de acesso no servidor. Verifique GEMINI_API_KEY em Settings > Secrets.';
export const MSG_AI_MODEL_NOT_FOUND =
  'Modelo de IA indisponível ou não encontrado na configuração atual do servidor.';
export const MSG_AI_BLOCKED =
  'Conteúdo bloqueado pelos filtros de segurança da IA. Ajuste o texto e tente novamente.';
export const MSG_AI_BAD_REQUEST =
  'A solicitação de IA não pôde ser processada com os parâmetros enviados. Revise os dados e tente novamente.';
export const MSG_AI_CONCURRENT_REQUEST =
  'Já existe uma solicitação de IA em andamento para sua conta. Aguarde a conclusão antes de tentar novamente.';

const API_KEY_PLACEHOLDERS = new Set([
  'MY_GEMINI_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'GEMINI_API_KEY',
  'REPLACE_ME',
  'CHANGEME',
  'UNDEFINED',
  'NULL',
]);

export function normalizeGeminiApiKey(raw: string | undefined): string {
  if (typeof raw !== 'string') return '';
  const stripped = raw.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
  if (!stripped || stripped.length < 10) return '';
  if (API_KEY_PLACEHOLDERS.has(stripped.toUpperCase())) return '';
  if (/^MY_[A-Z0-9_]+$/i.test(stripped) || /^YOUR_[A-Z0-9_]+$/i.test(stripped)) return '';
  return stripped;
}

export function isValidGeminiApiKey(raw: string | undefined): boolean {
  return Boolean(normalizeGeminiApiKey(raw));
}

export function resolveGeminiApiKeyFromEnv(env: Record<string, string | undefined> = process.env): string {
  const candidates = [
    env.GEMINI_API_KEY,
    env.GOOGLE_GENERATIVE_AI_API_KEY,
    env.GOOGLE_API_KEY,
    env.API_KEY,
  ];
  for (const candidate of candidates) {
    const clean = normalizeGeminiApiKey(candidate);
    if (clean) return clean;
  }
  return '';
}

const RETIRED_GEMINI_MODEL_RE = /^gemini-(?:1(?:\.\d+)?|2(?:\.\d+)?|pro|pro-vision)(?:-|$)/i;

export function resolveGeminiModelFromEnv(raw: string | undefined, defaultModel: string): string {
  if (typeof raw !== 'string') return defaultModel;
  const cleaned = raw
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .trim()
    .replace(/^models\//i, '');
  if (!cleaned) return defaultModel;
  // Reject pure numbers (e.g. accidental timeout value like "30000"), booleans, whitespace, or invalid chars
  if (
    /^\d+$/.test(cleaned) ||
    /^(true|false|null|undefined|none)$/i.test(cleaned) ||
    !/^[a-zA-Z][a-zA-Z0-9._-]{2,79}$/.test(cleaned) ||
    /^MY_/i.test(cleaned) ||
    RETIRED_GEMINI_MODEL_RE.test(cleaned)
  ) {
    console.warn(`[Gemini] Valor inválido ou obsoleto para modelo ("${cleaned}"); usando padrão "${defaultModel}".`);
    return defaultModel;
  }
  return cleaned;
}

export type ModelTier = 'principal' | 'reserva' | 'regras';

export interface GeminiRuntimeConfig {
  apiKey: string;
  primaryModel: string;
  fallbackModel: string;
  timeoutMs: number;
  maxAttempts: number;
  fallbackAttempts: number;
  baseDelayMs: number;
  maxWallClockMs?: number;
}

export function getEffectiveRuntimeConfig(
  runtime: GeminiRuntimeConfig,
  isVercelEnv = Boolean(process.env.VERCEL),
  hasExplicitOverride = false,
): GeminiRuntimeConfig & { maxWallClockMs: number } {
  if (isVercelEnv && !hasExplicitOverride) {
    return {
      ...runtime,
      timeoutMs: Math.min(runtime.timeoutMs, 14000),
      maxAttempts: Math.min(runtime.maxAttempts, 2),
      fallbackAttempts: Math.min(runtime.fallbackAttempts, 1),
      baseDelayMs: Math.min(runtime.baseDelayMs, 600),
      maxWallClockMs: Math.min(runtime.maxWallClockMs ?? 42000, 42000),
    };
  }
  return {
    ...runtime,
    maxWallClockMs: runtime.maxWallClockMs ?? (isVercelEnv ? 42000 : 180000),
  };
}

export function formatFatalAiErrorMessage(fatal: ClassifiedGeminiError): string {
  if (fatal.kind === 'config_missing') return MSG_AI_MISSING_KEY;
  if (fatal.kind === 'blocked') return MSG_AI_BLOCKED;
  if (fatal.statusCode === 401 || fatal.statusCode === 403 || fatal.safeReason === 'definitive_api_error') {
    return MSG_AI_INVALID_KEY;
  }
  if (fatal.statusCode === 404) return MSG_AI_MODEL_NOT_FOUND;
  if (fatal.statusCode === 400) return MSG_AI_BAD_REQUEST;
  return MSG_AI_OTHER_ERROR;
}

export function getGeminiRuntimeConfig(): GeminiRuntimeConfig {
  const apiKey = resolveGeminiApiKeyFromEnv();
  const primaryModel = resolveGeminiModelFromEnv(process.env.GEMINI_MODEL_PRIMARY, DEFAULT_GEMINI_PRIMARY_MODEL);
  const fallbackModel = resolveGeminiModelFromEnv(process.env.GEMINI_MODEL_FALLBACK, DEFAULT_GEMINI_FALLBACK_MODEL);
  const parsedTimeout = Number(process.env.GEMINI_TIMEOUT_MS || 40000);
  const parsedMaxAttempts = Number(process.env.GEMINI_MAX_ATTEMPTS || 4);
  const parsedFallbackAttempts = Number(process.env.GEMINI_FALLBACK_ATTEMPTS || 2);
  const parsedBaseDelay = Number(process.env.GEMINI_RETRY_BASE_MS || 1000);

  return {
    apiKey,
    primaryModel,
    fallbackModel,
    timeoutMs: Number.isFinite(parsedTimeout) && parsedTimeout >= 1000 ? Math.min(120000, parsedTimeout) : 40000,
    maxAttempts: Number.isFinite(parsedMaxAttempts) && parsedMaxAttempts >= 1 ? Math.min(6, parsedMaxAttempts) : 4,
    fallbackAttempts: Number.isFinite(parsedFallbackAttempts) && parsedFallbackAttempts >= 1 ? Math.min(3, parsedFallbackAttempts) : 2,
    baseDelayMs: Number.isFinite(parsedBaseDelay) && parsedBaseDelay >= 0 ? Math.min(15000, parsedBaseDelay) : 1000,
  };
}

// =============================================================================
// Concurrency Guard per User + Route (prevents double-click without blocking other tabs)
// =============================================================================
const activeUserCalls = new Map<string, { uid: string; route: string; startedAt: number }>();
const STALE_LOCK_MS = 5 * 60 * 1000;

function lockKey(uid: string, route: string): string {
  return `${uid}::${route}`;
}

export function acquireUserAiLock(uid: string, route: string): boolean {
  const now = Date.now();
  const key = lockKey(uid, route);
  const existing = activeUserCalls.get(key);
  if (existing && now - existing.startedAt < STALE_LOCK_MS) {
    return false;
  }
  activeUserCalls.set(key, { uid, route, startedAt: now });
  return true;
}

export function releaseUserAiLock(uid: string, route?: string): void {
  if (route) {
    activeUserCalls.delete(lockKey(uid, route));
    return;
  }
  const prefix = `${uid}::`;
  for (const key of activeUserCalls.keys()) {
    if (key.startsWith(prefix)) {
      activeUserCalls.delete(key);
    }
  }
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

  const tryParseObject = (candidate: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  };

  let obj = tryParseObject(cleaned);
  if (!obj) {
    // When tools like googleSearch are active, the model may prepend/append brief prose around JSON
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      obj = tryParseObject(cleaned.slice(firstBrace, lastBrace + 1));
    }
  }

  if (!obj) {
    return { ok: false };
  }
  if (validateJson) {
    const validated = validateJson(obj);
    if (!validated) return { ok: false };
    return { ok: true, data: validated };
  }
  return { ok: true, data: obj as T };
}

// =============================================================================
// Core Unified Wrapper: chamarGemini()
// =============================================================================
export interface GeminiGenerateArgs {
  model: string;
  contents: unknown;
  config: Record<string, unknown>;
}

export function describeResponseSchemaHint(responseSchema: Record<string, unknown>): string {
  const props = responseSchema?.properties as Record<string, { type?: string }> | undefined;
  if (!props || typeof props !== 'object') return '';
  const entries = Object.entries(props).map(([k, v]) => `"${k}" (${String(v?.type || 'STRING').toLowerCase()})`);
  return entries.length > 0 ? ` Campos JSON obrigatórios: ${entries.join(', ')}.` : '';
}

export interface ChamarGeminiParams<T extends Record<string, unknown>> {
  route: string;
  contents: unknown;
  systemInstruction: string;
  responseSchema: Record<string, unknown>;
  tools?: unknown[];
  validateJson: (parsed: Record<string, unknown>) => T | null;
  buildFallback: () => T | Promise<T>;
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
  const baseRuntime = { ...getGeminiRuntimeConfig(), ...(params.configOverride || {}) };
  const runtime = getEffectiveRuntimeConfig(
    baseRuntime,
    Boolean(process.env.VERCEL),
    Boolean(params.configOverride && !params.configOverride.maxWallClockMs),
  );
  const startedAtMs = Date.now();
  const sleep = params.sleepFn || defaultSleep;
  const rng = params.rngFn || Math.random;

  let generateFn = params.generateFn;
  if (!generateFn) {
    const cleanApiKey = normalizeGeminiApiKey(runtime.apiKey);
    if (!cleanApiKey) {
      const fb = await params.buildFallback();
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
          mensagemUsuario: MSG_AI_MISSING_KEY,
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
      apiKey: cleanApiKey,
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
      const remainingBudgetMs = runtime.maxWallClockMs - (Date.now() - startedAtMs);
      if (attempt > 1 && remainingBudgetMs < 2500) {
        lastError = lastError || {
          statusCode: 504,
          kind: 'timeout',
          isHighDemand: true,
          retryable: true,
          safeReason: 'wall_clock_budget_exhausted',
        };
        break;
      }
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
        const hasTools = Boolean(params.tools && params.tools.length > 0);
        const schemaHint = hasTools ? describeResponseSchemaHint(params.responseSchema) : '';
        const requestConfig: Record<string, unknown> = hasTools
          ? {
              // When search grounding tools are active, omit responseMimeType/responseSchema to prevent 400 INVALID_ARGUMENT
              systemInstruction: `${params.systemInstruction}\nResponda EXCLUSIVAMENTE com um único objeto JSON válido (sem markdown ou texto fora do JSON) seguindo exatamente o esquema solicitado.${schemaHint}`,
              tools: params.tools,
            }
          : {
              systemInstruction: params.systemInstruction,
              responseMimeType: 'application/json',
              responseSchema: params.responseSchema,
            };

        const attemptTimeoutMs = Math.max(20, Math.min(runtime.timeoutMs, Math.max(20, remainingBudgetMs - 1000)));
        const resp = await runSingleAttemptWithTimeout(
          generateFn!,
          {
            model: modelName,
            contents: params.contents,
            config: requestConfig,
          },
          runtime.timeoutMs <= 200 ? runtime.timeoutMs : attemptTimeoutMs,
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
        const retryRemainingMs = runtime.maxWallClockMs - (Date.now() - startedAtMs);
        if (malformedRetriesLeft > 0 && (runtime.timeoutMs <= 200 || retryRemainingMs >= 1500)) {
          malformedRetriesLeft -= 1;
          totalAttempts += 1;
          params.onProgress?.({
            attempt,
            maxAttempts: maxTries,
            modelTier: tier,
            message: 'Resposta JSON incompleta — repetindo uma vez…',
          });
          const retryTimeoutMs =
            runtime.timeoutMs <= 200
              ? runtime.timeoutMs
              : Math.max(20, Math.min(runtime.timeoutMs, Math.max(20, retryRemainingMs - 1000)));
          const retryResp = await runSingleAttemptWithTimeout(
            generateFn!,
            {
              model: modelName,
              contents: params.contents,
              config: requestConfig,
            },
            retryTimeoutMs,
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
          const remainingAfter = runtime.maxWallClockMs - (Date.now() - startedAtMs);
          if (remainingAfter - delayMs < 2500 && runtime.maxWallClockMs < 100000) {
            break;
          }
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

  // Phase 1: Primary model (up to maxAttempts within wall clock budget)
  let effectivePrimaryModel = runtime.primaryModel;
  let primaryOutcome = await tryModelPhase(effectivePrimaryModel, 'principal', runtime.maxAttempts);
  if (primaryOutcome.fatal?.statusCode === 404 && effectivePrimaryModel !== DEFAULT_GEMINI_PRIMARY_MODEL) {
    console.warn(
      `[Gemini][${params.route}] Modelo configurado "${effectivePrimaryModel}" retornou 404; alternando para "${DEFAULT_GEMINI_PRIMARY_MODEL}".`,
    );
    effectivePrimaryModel = DEFAULT_GEMINI_PRIMARY_MODEL;
    primaryOutcome = await tryModelPhase(effectivePrimaryModel, 'principal', runtime.maxAttempts);
  }
  if (primaryOutcome.matched) {
    return {
      ok: true,
      statusCode: 200,
      payload: {
        ...primaryOutcome.matched,
        fallback: false,
        origem: 'principal',
        origemLabel: 'Rascunho gerado por IA (modelo principal)',
        modeloUsado: effectivePrimaryModel,
        tentativas: totalAttempts,
      },
      audit: {
        rota: params.route,
        modeloTipo: 'principal',
        modeloNome: effectivePrimaryModel,
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
      errorMessage: formatFatalAiErrorMessage(primaryOutcome.fatal),
      audit: {
        rota: params.route,
        modeloTipo: 'principal',
        modeloNome: effectivePrimaryModel,
        tentativas: totalAttempts,
        resultado: 'erro_definitivo',
        statusMotivo: primaryOutcome.fatal.safeReason,
      },
    };
  }

  // Phase 2: Lighter backup model if configured, different from primary, and budget remains
  const remainingBeforeBackup = runtime.maxWallClockMs - (Date.now() - startedAtMs);
  if (
    runtime.fallbackModel &&
    runtime.fallbackModel !== runtime.primaryModel &&
    !sawMalformedJson &&
    remainingBeforeBackup >= 2500
  ) {
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
        errorMessage: formatFatalAiErrorMessage(backupOutcome.fatal),
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

  // Phase 3: Deterministic rule-based + live-check fallback (never leave user without result on temp errors/malformed JSON)
  const fallbackDraft = await params.buildFallback();
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
