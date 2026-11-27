import fs from 'node:fs';
import path from 'node:path';
import type { Response } from 'express';
import { Type } from '@google/genai';
import {
  buildAnalisarDocumentoFallback,
  buildCustosFallback,
  buildDiagnosticoFallback,
  buildNormaFallback,
  buildNormaVerificarFallback,
  buildParecerFallback,
  buildPropostaFallback,
} from './geminiFallbacks.ts';
import {
  acquireUserAiLock,
  chamarGemini,
  getGeminiRuntimeConfig,
  isValidGeminiApiKey,
  MSG_AI_CONCURRENT_REQUEST,
  MSG_AI_OTHER_ERROR,
  releaseUserAiLock,
  resolveAlternativeAiProvidersFromEnv,
  type ChamarGeminiParams,
  type ChamarGeminiResult,
  type GeminiRuntimeConfig,
  type ModelTier,
} from './geminiWrapper.ts';

export interface AiEngineHealthStatus {
  ok: true;
  geminiConfigured: boolean;
  cloudAiConfigured: boolean;
  activeProvider: 'gemini' | 'groq' | 'openrouter' | 'local_rules';
  providers: {
    gemini: boolean;
    groq: boolean;
    openrouter: boolean;
    localRules: true;
  };
  vercelHobbyOptimized: true;
  mode: 'gemini_plus_rules' | 'rules_live_hybrid';
  primaryModel: string;
  fallbackModel: string;
  activeEngine: string;
  features: string[];
}

export function getAiEngineHealthStatus(): AiEngineHealthStatus {
  const cfg = getGeminiRuntimeConfig();
  const geminiConfigured = isValidGeminiApiKey(cfg.apiKey);
  const altProviders = resolveAlternativeAiProvidersFromEnv();
  const groqProvider = altProviders.find((p) => p.id === 'groq');
  const openRouterProvider = altProviders.find((p) => p.id === 'openrouter');
  const cloudAiConfigured = geminiConfigured || altProviders.length > 0;

  const activeProvider: AiEngineHealthStatus['activeProvider'] = geminiConfigured
    ? 'gemini'
    : groqProvider
      ? 'groq'
      : openRouterProvider
        ? 'openrouter'
        : 'local_rules';

  const activeEngine = geminiConfigured
    ? `IA Gemini (${cfg.primaryModel})`
    : groqProvider
      ? `IA em nuvem (${groqProvider.model})`
      : openRouterProvider
        ? `IA em nuvem (${openRouterProvider.model})`
        : 'Assistente de Regras SERMIG/BCN';

  return {
    ok: true,
    geminiConfigured,
    cloudAiConfigured,
    activeProvider,
    providers: {
      gemini: geminiConfigured,
      groq: Boolean(groqProvider),
      openrouter: Boolean(openRouterProvider),
      localRules: true,
    },
    vercelHobbyOptimized: true,
    mode: cloudAiConfigured ? 'gemini_plus_rules' : 'rules_live_hybrid',
    primaryModel: geminiConfigured ? cfg.primaryModel : altProviders[0]?.model || 'motor_local',
    fallbackModel: cfg.fallbackModel,
    activeEngine,
    features: [
      'diagnostico',
      'parecer',
      'analisar-documento',
      'custos',
      'proposta',
      'norma',
      'norma-verificar',
      'parceiros-sinergia',
    ],
  };
}

export interface RouteAuthUser {
  uid: string;
  email: string;
  role: string;
  rawToken?: string;
}

export interface AuditWriterOptions {
  projectId: string;
  databaseId: string;
  user?: RouteAuthUser;
  audit: ChamarGeminiResult<Record<string, unknown>>['audit'];
}

export async function recordAiAuditLog({ projectId, databaseId, user, audit }: AuditWriterOptions): Promise<void> {
  // Technical log only — zero sensitive client content
  console.info(
    `[AI_AUDIT] rota=${audit.rota} modelo=${audit.modeloTipo}(${audit.modeloNome}) tentativas=${audit.tentativas} resultado=${audit.resultado} motivo=${audit.statusMotivo}`,
  );

  if (!user?.rawToken || !projectId) return;
  try {
    const docId = `audit_ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const entityId = audit.rota.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/^_+/, '') || 'api_ai';
    const createdAt = new Date().toISOString();
    const depois = JSON.stringify({
      rota: audit.rota,
      modeloTipo: audit.modeloTipo,
      modeloNome: audit.modeloNome,
      tentativas: audit.tentativas,
      resultado: audit.resultado,
    });
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}/documents/auditLogs?documentId=${encodeURIComponent(docId)}`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user.rawToken}`,
      },
      body: JSON.stringify({
        fields: {
          id: { stringValue: docId },
          actorUid: { stringValue: user.uid },
          actorEmail: { stringValue: user.email },
          actorRole: { stringValue: user.role },
          acao: { stringValue: 'chamada_ia' },
          entidade: { stringValue: 'ia' },
          entidadeId: { stringValue: entityId.slice(0, 128) },
          campo: { stringValue: audit.modeloTipo },
          depois: { stringValue: depois.slice(0, 4000) },
          createdAt: { stringValue: createdAt },
        },
      }),
    });
  } catch {
    // Non-blocking audit persistence
  }
}

export function resolveAttachmentFromUploadUrl(
  uploadDir: string,
  arquivoUrl: unknown,
): { fileBase64: string; mimeType: string } | null {
  if (typeof arquivoUrl !== 'string' || !arquivoUrl.trim()) return null;

  if (arquivoUrl.startsWith('data:')) {
    const match = arquivoUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) return null;
    const mimeType = match[1].toLowerCase().trim();
    const allowedMimes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
    if (!allowedMimes.has(mimeType)) return null;
    const fileBase64 = match[2].replace(/\s+/g, '');
    if (!fileBase64 || fileBase64.length > 14 * 1024 * 1024) return null;
    return { fileBase64, mimeType };
  }

  if (!arquivoUrl.startsWith('/uploads/')) return null;
  const rel = arquivoUrl.slice('/uploads/'.length).split('?')[0];
  if (!rel || rel.includes('..') || rel.includes('/') || rel.includes('\\')) return null;
  const resolved = path.resolve(uploadDir, rel);
  if (!resolved.startsWith(uploadDir + path.sep)) return null;
  if (!fs.existsSync(resolved)) return null;

  const stat = fs.statSync(resolved);
  if (stat.size <= 0 || stat.size > 10 * 1024 * 1024) return null;

  const ext = path.extname(resolved).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
  };
  const mimeType = mimeMap[ext];
  if (!mimeType) return null;

  const buf = fs.readFileSync(resolved);
  return { fileBase64: buf.toString('base64'), mimeType };
}

const ALLOWED_REMOTE_ATTACHMENT_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

const ALLOWED_REMOTE_ATTACHMENT_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/**
 * Resolves allowlisted Firebase Storage HTTPS URLs into base64 inlineData
 * so Gemini multimodal routes can inspect documents uploaded to Cloud Storage.
 */
export async function enrichBodyWithRemoteAttachment(
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const existingBase64 = stripBase64DataPrefix(body.fileBase64);
  const existingMime = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';
  if (existingBase64 && existingMime) {
    return body;
  }

  const rawUrl = typeof body.arquivoUrl === 'string' ? body.arquivoUrl.trim() : '';
  if (!rawUrl.startsWith('https://')) {
    return body;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return body;
  }

  if (parsedUrl.protocol !== 'https:' || !ALLOWED_REMOTE_ATTACHMENT_HOSTS.has(parsedUrl.hostname)) {
    return body;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const resp = await fetch(parsedUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!resp.ok) return body;

    const headerMime = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    const fallbackMime = /\.pdf(\?|$)/i.test(rawUrl)
      ? 'application/pdf'
      : /\.png(\?|$)/i.test(rawUrl)
        ? 'image/png'
        : /\.webp(\?|$)/i.test(rawUrl)
          ? 'image/webp'
          : /\.jpe?g(\?|$)/i.test(rawUrl)
            ? 'image/jpeg'
            : '';
    const mimeType = ALLOWED_REMOTE_ATTACHMENT_MIMES.has(headerMime) ? headerMime : fallbackMime;
    if (!ALLOWED_REMOTE_ATTACHMENT_MIMES.has(mimeType)) return body;

    const arrBuf = await resp.arrayBuffer();
    if (arrBuf.byteLength <= 0 || arrBuf.byteLength > 6 * 1024 * 1024) {
      return body;
    }

    return {
      ...body,
      fileBase64: Buffer.from(arrBuf).toString('base64'),
      mimeType,
    };
  } catch {
    return body;
  } finally {
    clearTimeout(timer);
  }
}

function asStringArray(val: unknown): string[] | null {
  if (Array.isArray(val)) {
    return val
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
  }
  if (typeof val === 'string' && val.trim()) {
    return [val.trim()];
  }
  return null;
}

function asFiniteNumber(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const cleaned = val.trim().replace(',', '.');
    if (cleaned && /^-?\d+(?:\.\d+)?$/.test(cleaned)) {
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function compactServerLegalSources(raw: unknown, maxItems = 15) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, maxItems)
    .map((s) => ({
      titulo: typeof s.titulo === 'string' ? s.titulo.slice(0, 160) : '',
      numeroAno: typeof s.numeroAno === 'string' ? s.numeroAno.slice(0, 60) : '',
      artigos: typeof s.artigos === 'string' ? s.artigos.slice(0, 240) : '',
      resumoPortugues:
        typeof s.resumoPortugues === 'string'
          ? s.resumoPortugues.slice(0, 420)
          : typeof s.explicacaoSimples === 'string'
            ? s.explicacaoSimples.slice(0, 420)
            : '',
    }))
    .filter((s) => Boolean(s.titulo));
}

function compactServerCurrentSource(raw: unknown) {
  if (!raw || typeof raw !== 'object') return {};
  const s = raw as Record<string, unknown>;
  return {
    id: typeof s.id === 'string' ? s.id.slice(0, 128) : '',
    titulo: typeof s.titulo === 'string' ? s.titulo.slice(0, 200) : '',
    numeroAno: typeof s.numeroAno === 'string' ? s.numeroAno.slice(0, 80) : '',
    pais: typeof s.pais === 'string' ? s.pais.slice(0, 40) : 'Chile',
    artigos: typeof s.artigos === 'string' ? s.artigos.slice(0, 600) : '',
    resumoPortugues: typeof s.resumoPortugues === 'string' ? s.resumoPortugues.slice(0, 1200) : '',
    explicacaoCliente: typeof s.explicacaoCliente === 'string' ? s.explicacaoCliente.slice(0, 800) : '',
    linkOficial: typeof s.linkOficial === 'string' ? s.linkOficial.slice(0, 320) : '',
    statusVigencia: typeof s.statusVigencia === 'string' ? s.statusVigencia.slice(0, 40) : '',
  };
}

function stripBase64DataPrefix(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/^data:[^;]+;base64,/i, '').replace(/\s+/g, '');
}

// =============================================================================
// Route Specifications (all 6 /api/ai/* routes)
// =============================================================================
export interface AiRouteDependencies {
  uploadDir: string;
  projectId: string;
  databaseId: string;
  configOverride?: Partial<GeminiRuntimeConfig>;
  generateFn?: ChamarGeminiParams<Record<string, unknown>>['generateFn'];
  sleepFn?: ChamarGeminiParams<Record<string, unknown>>['sleepFn'];
  auditFn?: (opts: AuditWriterOptions) => Promise<void>;
}

export async function runAiRouteExecution<T extends Record<string, unknown>>(
  reqUser: RouteAuthUser | undefined,
  wantsProgressStream: boolean,
  res: Response,
  params: ChamarGeminiParams<T>,
  deps: AiRouteDependencies,
): Promise<ChamarGeminiResult<T> | null> {
  const uid = reqUser?.uid || 'anon';
  if (!acquireUserAiLock(uid, params.route)) {
    res.status(409).json({ error: MSG_AI_CONCURRENT_REQUEST });
    return null;
  }

  let streamStarted = false;
  let clientClosed = false;
  const writeNdjson = (obj: unknown) => {
    if (!wantsProgressStream || clientClosed || res.writableEnded || res.destroyed) return;
    if (!streamStarted) {
      streamStarted = true;
      res.status(200);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      (res as Response & { flushHeaders?: () => void }).flushHeaders?.();
    }
    res.write(`${JSON.stringify(obj)}\n`);
  };

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let lastProgressMsg = 'Consultando IA…';

  const onSocketClose = () => {
    clientClosed = true;
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };
  if (typeof (res as Response & { once?: (ev: string, fn: () => void) => void }).once === 'function') {
    res.once('close', onSocketClose);
  }

  try {
    if (wantsProgressStream) {
      writeNdjson({ type: 'progress', attempt: 1, maxAttempts: 2, modelTier: 'principal', message: lastProgressMsg });
      heartbeatTimer = setInterval(() => {
        if (!clientClosed && !res.writableEnded && !res.destroyed) {
          writeNdjson({ type: 'progress', attempt: 1, maxAttempts: 2, modelTier: 'principal', message: lastProgressMsg });
        }
      }, 4000);
    }

    const result = await chamarGemini<T>({
      ...params,
      configOverride: deps.configOverride ?? params.configOverride,
      generateFn: deps.generateFn ?? params.generateFn,
      sleepFn: deps.sleepFn ?? params.sleepFn,
      onProgress: (ev) => {
        if (ev.message) lastProgressMsg = ev.message;
        params.onProgress?.(ev);
        writeNdjson({ type: 'progress', ...ev });
      },
    });

    const auditFn = deps.auditFn || recordAiAuditLog;
    void auditFn({
      projectId: deps.projectId,
      databaseId: deps.databaseId,
      user: reqUser,
      audit: result.audit as ChamarGeminiResult<Record<string, unknown>>['audit'],
    });

    if (wantsProgressStream && streamStarted) {
      if (result.ok && result.payload) {
        writeNdjson({ type: 'result', data: result.payload });
      } else {
        writeNdjson({
          type: 'error',
          statusCode: result.statusCode,
          error: result.errorMessage || MSG_AI_OTHER_ERROR,
        });
      }
      res.end();
    } else if (result.ok && result.payload) {
      res.status(result.statusCode).json(result.payload);
    } else {
      res.status(result.statusCode || 400).json({ error: result.errorMessage || MSG_AI_OTHER_ERROR });
    }

    return result;
  } catch (err) {
    console.error(`[AI_ROUTE_ERROR] rota=${params.route}`, err instanceof Error ? err.message : err);
    if (wantsProgressStream && streamStarted) {
      writeNdjson({ type: 'error', statusCode: 500, error: MSG_AI_OTHER_ERROR });
      res.end();
    } else if (!res.headersSent) {
      res.status(500).json({ error: MSG_AI_OTHER_ERROR });
    }
    return null;
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    releaseUserAiLock(uid, params.route);
  }
}

function stripDiagnosticPiiForAi(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const src = raw as Record<string, unknown>;
  const { nome: _n, email: _e, whatsapp: _w, cidadeUf: _c, pessoasFamilia: _pf, ...safe } = src;
  return safe;
}

function normalizeCitationMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeCleanStrings(items: string[] | null, maxItems = 8): string[] {
  if (!items || items.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const clean = item.trim();
    if (!clean) continue;
    const key = normalizeCitationMatch(clean);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= maxItems) break;
  }
  return out;
}

export function groundDiagnosticCitations(
  rawCitations: string[] | null,
  sourcesBrief: Array<{ titulo: string; numeroAno: string; artigos: string }>,
): string[] {
  const catalogCitations = sourcesBrief.map((s) => {
    const num = s.numeroAno ? ` (${s.numeroAno})` : '';
    const art = s.artigos ? ` — ${s.artigos}` : '';
    return `${s.titulo}${num}${art}`;
  });

  if (sourcesBrief.length === 0) {
    return ['fonte a cadastrar'];
  }

  const candidateList = dedupeCleanStrings(rawCitations, 10);
  if (candidateList.length === 0) {
    return catalogCitations.slice(0, 6);
  }

  const grounded = candidateList.filter((cite) => {
    const normCite = normalizeCitationMatch(cite);
    if (normCite === 'fonte a cadastrar') return true;
    return sourcesBrief.some((src) => {
      const normTitle = normalizeCitationMatch(src.titulo);
      const normNum = normalizeCitationMatch(src.numeroAno);
      const shortTitle = normTitle.split('–')[0].split('-')[0].trim();
      return (
        (normNum.length >= 3 && normCite.includes(normNum)) ||
        (shortTitle.length >= 6 && normCite.includes(shortTitle)) ||
        (normTitle.length >= 6 && normTitle.includes(normCite))
      );
    });
  });

  return grounded.length > 0 ? grounded : catalogCitations.slice(0, 6);
}

export function buildDiagnosticoSpec(body: Record<string, unknown>) {
  const {
    answers,
    regrasAcionadas,
    visaCategories,
    legalSources,
    subcategoriaRecomendada,
    subcategoriaDetalhes,
    radarViabilidade,
    alternativas,
    flagsRisco,
    flagsRevisaoConsultor,
    contradicoes,
    alertas,
    prontidaoDocumental,
  } = body;
  const sourcesBrief = compactServerLegalSources(legalSources, 20);
  const categoriesBrief = Array.isArray(visaCategories) ? visaCategories.slice(0, 20) : [];
  const safeAnswers = stripDiagnosticPiiForAi(answers);

  return {
    route: '/api/ai/diagnostico',
    contents: JSON.stringify({
      fatosVerificados: {
        perfil: safeAnswers,
        subcategoriaRecomendada: subcategoriaRecomendada || null,
        subcategoriaDetalhes: subcategoriaDetalhes || null,
        radarViabilidade: radarViabilidade || null,
        alternativas: Array.isArray(alternativas) ? alternativas.slice(0, 3) : [],
        flagsRisco: Array.isArray(flagsRisco) ? flagsRisco.slice(0, 8) : [],
        flagsRevisaoConsultor: Array.isArray(flagsRevisaoConsultor) ? flagsRevisaoConsultor.slice(0, 6) : [],
        contradicoes: Array.isArray(contradicoes) ? contradicoes.slice(0, 6) : [],
        alertas: Array.isArray(alertas) ? alertas.slice(0, 8) : [],
        prontidaoDocumental: prontidaoDocumental || null,
        regrasAcionadas: Array.isArray(regrasAcionadas) ? regrasAcionadas.slice(0, 30) : [],
      },
      visaCategories: categoriesBrief,
      legalSources: sourcesBrief,
    }),
    systemInstruction:
      'Você é um especialista técnico em imigração Brasil-Chile da consultoria D&M Integra Chile. Responda EXCLUSIVAMENTE em português do Brasil e em JSON válido. ' +
      'REGRA ABSOLUTA 1 (IMUTABILIDADE DO MOTOR): Nunca altere nem contradiga a subcategoriaRecomendada, a pontuação total ou qualquer um dos 7 pilares em fatosVerificados.radarViabilidade; apenas explique com precisão técnica por que essa rota lidera e qual pilar merece ação prioritária. ' +
      'REGRA ABSOLUTA 2 (ZERO ALUCINAÇÃO NORMATIVA): Nunca invente leis, decretos, resoluções, números de artigos, taxas ou prazos que não constem explicitamente em legalSources ou fatosVerificados. Em fontesCitadas, cite APENAS registros presentes em legalSources; se não houver fonte cadastrada para alguma afirmação, escreva literalmente "fonte a cadastrar". ' +
      'REGRA ABSOLUTA 3 (PRECISÃO FACTUAL): Não presuma fatos não informados pelo usuário. Separe claramente riscos confirmados (flagsRisco) de pontos reservados para entrevista sigilosa (flagsRevisaoConsultor) e contradições detectadas (contradicoes). ' +
      'FORMATO: resumoExecutivo objetivo (2 a 4 frases citando a rota líder e a nota/veredito do Radar); riscos (até 5 itens concretos); perguntasConsultor (3 a 5 perguntas diretas para a reunião); pontosAtencao (3 a 5 pontos alinhados aos pilares mais baixos do Radar); proximosPassos (3 a 5 passos na ordem cronológica segura — mantendo emissão de Antecedentes PF de 60 dias por último). Este texto é um rascunho orientativo editável e exige revisão humana.',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        resumoExecutivo: { type: Type.STRING },
        riscos: { type: Type.ARRAY, items: { type: Type.STRING } },
        perguntasConsultor: { type: Type.ARRAY, items: { type: Type.STRING } },
        pontosAtencao: { type: Type.ARRAY, items: { type: Type.STRING } },
        fontesCitadas: { type: Type.ARRAY, items: { type: Type.STRING } },
        proximosPassos: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['resumoExecutivo', 'riscos', 'perguntasConsultor', 'pontosAtencao', 'fontesCitadas', 'proximosPassos'],
    },
    validateJson: (parsed: Record<string, unknown>) => {
      const unwrapped =
        parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
          ? (parsed.data as Record<string, unknown>)
          : parsed.diagnostico && typeof parsed.diagnostico === 'object' && !Array.isArray(parsed.diagnostico)
            ? (parsed.diagnostico as Record<string, unknown>)
            : parsed;
      const rawResumo =
        typeof unwrapped.resumoExecutivo === 'string'
          ? unwrapped.resumoExecutivo
          : typeof unwrapped.resumo_executivo === 'string'
            ? unwrapped.resumo_executivo
            : typeof unwrapped.resumo === 'string'
              ? unwrapped.resumo
              : '';
      if (!rawResumo.trim()) return null;
      const fb = buildDiagnosticoFallback(body);
      const riscos = dedupeCleanStrings(asStringArray(unwrapped.riscos), 6);
      const perguntasConsultor = dedupeCleanStrings(
        asStringArray(unwrapped.perguntasConsultor ?? unwrapped.perguntas_consultor),
        6,
      );
      const pontosAtencao = dedupeCleanStrings(
        asStringArray(unwrapped.pontosAtencao ?? unwrapped.pontos_atencao),
        6,
      );
      const proximosPassos = dedupeCleanStrings(
        asStringArray(unwrapped.proximosPassos ?? unwrapped.proximos_passos),
        6,
      );
      const fontesCitadas = groundDiagnosticCitations(
        asStringArray(unwrapped.fontesCitadas ?? unwrapped.fontes_citadas),
        sourcesBrief,
      );

      return {
        rascunho: true,
        resumoExecutivo: rawResumo.trim(),
        riscos: riscos.length > 0 ? riscos : fb.riscos,
        perguntasConsultor: perguntasConsultor.length > 0 ? perguntasConsultor : fb.perguntasConsultor,
        pontosAtencao: pontosAtencao.length > 0 ? pontosAtencao : fb.pontosAtencao,
        fontesCitadas,
        proximosPassos: proximosPassos.length > 0 ? proximosPassos : fb.proximosPassos,
      };
    },
    buildFallback: () => buildDiagnosticoFallback(body),
  };
}

function coerceParecerField(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (item && typeof item === 'object') {
          return Object.values(item as Record<string, unknown>)
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .join(' — ');
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => {
        const text = coerceParecerField(v);
        return text ? `${k}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

export function buildParecerSpec(body: Record<string, unknown>) {
  const rawCase = (body.caseData && typeof body.caseData === 'object' ? body.caseData : {}) as Record<string, unknown>;
  const rawClient = (body.clientData && typeof body.clientData === 'object' ? body.clientData : {}) as Record<string, unknown>;
  const rawChecklist =
    body.checklistResumo && typeof body.checklistResumo === 'object'
      ? (body.checklistResumo as Record<string, unknown>)
      : null;
  const rawPassport =
    rawClient.passaporte && typeof rawClient.passaporte === 'object'
      ? (rawClient.passaporte as Record<string, unknown>)
      : null;

  const subcategoriaResolvida =
    typeof body.subcategoria === 'string' && body.subcategoria.trim()
      ? body.subcategoria.trim().slice(0, 160)
      : typeof rawCase.subcategoria === 'string' && rawCase.subcategoria.trim()
        ? rawCase.subcategoria.trim().slice(0, 160)
        : typeof rawCase.subcategoriaIa === 'string' && rawCase.subcategoriaIa.trim()
          ? rawCase.subcategoriaIa.trim().slice(0, 160)
          : typeof rawCase.tipoServico === 'string' && rawCase.tipoServico.trim()
            ? rawCase.tipoServico.trim().slice(0, 160)
            : '';

  const caseBrief = {
    id: rawCase.id,
    titulo: typeof rawCase.titulo === 'string' ? rawCase.titulo.slice(0, 200) : '',
    tipoServico: typeof rawCase.tipoServico === 'string' ? rawCase.tipoServico.slice(0, 120) : '',
    subcategoria: subcategoriaResolvida,
    etapaPipeline: rawCase.etapaPipeline,
    statusPipeline: rawCase.statusPipeline,
    statusSermig: rawCase.statusSermig,
    localSolicitacao: rawCase.localSolicitacao,
    notaViabilidadeGeral: rawCase.notaViabilidadeGeral,
    observacoes: typeof rawCase.observacoes === 'string' ? rawCase.observacoes.slice(0, 1000) : '',
    parecerConsultor: typeof rawCase.parecerConsultor === 'string' ? rawCase.parecerConsultor.slice(0, 800) : '',
  };

  const clientBrief = {
    nomeCompleto: typeof rawClient.nomeCompleto === 'string' ? rawClient.nomeCompleto.slice(0, 120) : undefined,
    nacionalidade: typeof rawClient.nacionalidade === 'string' ? rawClient.nacionalidade.slice(0, 60) : undefined,
    localizacaoAtual: rawClient.localizacaoAtual,
    situacaoMigratoriaAtual: rawClient.situacaoMigratoriaAtual,
    motivoMudanca: rawClient.motivoMudanca,
    prazoDesejado: rawClient.prazoDesejado,
    profissao: rawClient.profissao,
    possuiFilhosMenores: rawClient.possuiFilhosMenores,
    quantidadeDependentes: rawClient.quantidadeDependentes,
    antecedentesCriminais: rawClient.antecedentesCriminais,
    restricaoEntrada: rawClient.restricaoEntrada,
    validadePassaporte: rawClient.validadePassaporte ?? rawPassport?.validade,
  };

  const dependentsBrief = Array.isArray(body.dependents)
    ? body.dependents
        .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === 'object'))
        .slice(0, 12)
        .map((d) => ({
          parentesco: d.parentesco,
          idade: d.idade,
          estudante: d.estudante,
          passaporteValidade: d.passaporteValidade,
        }))
    : [];

  const checklistBrief = rawChecklist
    ? {
        total: Number(rawChecklist.total || 0),
        aprovados: Number(rawChecklist.aprovados || 0),
        pendentes: Number(rawChecklist.pendentes || 0),
        percentualProntidao: Number(rawChecklist.percentualProntidao || 0),
        pendenciasPrincipais: Array.isArray(rawChecklist.pendenciasPrincipais)
          ? rawChecklist.pendenciasPrincipais
              .filter((x): x is string => typeof x === 'string')
              .slice(0, 8)
          : [],
      }
    : undefined;

  const focoConsultor = typeof body.focoConsultor === 'string' ? body.focoConsultor.trim().slice(0, 600) : '';
  const sourcesBrief = compactServerLegalSources(body.legalSources, 15);

  return {
    route: '/api/ai/parecer',
    contents: JSON.stringify({
      caseData: caseBrief,
      clientData: clientBrief,
      dependents: dependentsBrief,
      ...(checklistBrief ? { checklistResumo: checklistBrief } : {}),
      ...(focoConsultor ? { focoConsultor } : {}),
      legalSources: sourcesBrief,
    }),
    systemInstruction:
      'Você é um especialista jurídico migratório Brasil-Chile da consultoria D&M Integra Chile. Elabore um rascunho de Parecer Técnico Migratório completo, claro, executivo e acolhedor em português do Brasil (sem juridiquês excessivo). Preencha os 4 campos obrigatórios como strings (enquadramentoLegal, elegibilidadeRiscos, fundamentacaoNormativa, recomendacoes). Considere o estágio atual do caso, a prontidão do checklist, os dependentes e qualquer focoConsultor informado. Cite SOMENTE normas existentes em legalSources enviadas no contexto; caso falte base cadastrada para alguma afirmação, escreva literalmente "fonte a cadastrar". Responda exclusivamente em JSON válido.',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        enquadramentoLegal: { type: Type.STRING },
        elegibilidadeRiscos: { type: Type.STRING },
        fundamentacaoNormativa: { type: Type.STRING },
        recomendacoes: { type: Type.STRING },
      },
      required: ['enquadramentoLegal', 'elegibilidadeRiscos', 'fundamentacaoNormativa', 'recomendacoes'],
    },
    validateJson: (parsed: Record<string, unknown>) => {
      const unwrapped =
        parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
          ? (parsed.data as Record<string, unknown>)
          : parsed.parecer && typeof parsed.parecer === 'object' && !Array.isArray(parsed.parecer)
            ? (parsed.parecer as Record<string, unknown>)
            : parsed.parecerTecnico && typeof parsed.parecerTecnico === 'object' && !Array.isArray(parsed.parecerTecnico)
              ? (parsed.parecerTecnico as Record<string, unknown>)
              : parsed;
      const enquadramentoLegal = coerceParecerField(
        unwrapped.enquadramentoLegal ?? unwrapped.enquadramento_legal ?? unwrapped.enquadramento,
      );
      const elegibilidadeRiscos = coerceParecerField(
        unwrapped.elegibilidadeRiscos ?? unwrapped.elegibilidade_riscos ?? unwrapped.riscos ?? unwrapped.elegibilidade,
      );
      const fundamentacaoNormativa = coerceParecerField(
        unwrapped.fundamentacaoNormativa ?? unwrapped.fundamentacao_normativa ?? unwrapped.fundamentacao,
      );
      const recomendacoes = coerceParecerField(
        unwrapped.recomendacoes ??
          unwrapped.recomendacoes_cliente ??
          unwrapped.recomendacoesCliente ??
          unwrapped.proximosPassos,
      );
      if (!enquadramentoLegal && !recomendacoes && !elegibilidadeRiscos) {
        return null;
      }
      const fb = buildParecerFallback(body);
      return {
        rascunho: true,
        enquadramentoLegal: enquadramentoLegal || fb.enquadramentoLegal,
        elegibilidadeRiscos: elegibilidadeRiscos || fb.elegibilidadeRiscos,
        fundamentacaoNormativa: fundamentacaoNormativa || fb.fundamentacaoNormativa || 'fonte a cadastrar',
        recomendacoes: recomendacoes || fb.recomendacoes,
      };
    },
    buildFallback: () => buildParecerFallback(body),
  };
}

export function buildAnalisarDocumentoSpec(body: Record<string, unknown>, uploadDir: string) {
  const { nomeEsperado, textoObservacao, arquivoUrl } = body;
  let fileBase64 = stripBase64DataPrefix(body.fileBase64);
  let mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';

  if ((!fileBase64 || !mimeType) && arquivoUrl) {
    const resolved = resolveAttachmentFromUploadUrl(uploadDir, arquivoUrl);
    if (resolved) {
      fileBase64 = resolved.fileBase64;
      mimeType = resolved.mimeType;
    }
  }

  const enrichedBody = { ...body, fileBase64, mimeType };
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    {
      text: `Analise o documento enviado para o checklist migratório "${nomeEsperado || 'Documento'}". Observação complementar: ${textoObservacao || 'Nenhuma'}. Extraia nome identificado, data de emissão (dd/mm/aaaa se visível), órgão emissor, idioma, se há indício de Apostila da Haia, legibilidade e sugira Aprovar, Revisar ou Reprovar (sempre como sugestão para decisão humana).`,
    },
  ];
  if (fileBase64 && mimeType) {
    parts.push({ inlineData: { mimeType, data: fileBase64 } });
  }

  return {
    route: '/api/ai/analisar-documento',
    contents: { parts },
    systemInstruction:
      'Você realiza pré-conferência documental em português do Brasil. Nunca aprove automaticamente — devolva apenas sugestão técnica fundamentada.',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        nomeIdentificado: { type: Type.STRING },
        dataEmissao: { type: Type.STRING },
        orgaoEmissor: { type: Type.STRING },
        idioma: { type: Type.STRING },
        possuiApostila: { type: Type.BOOLEAN },
        legibilidade: { type: Type.STRING },
        sugestao: { type: Type.STRING },
        justificativa: { type: Type.STRING },
      },
      required: [
        'nomeIdentificado',
        'dataEmissao',
        'orgaoEmissor',
        'idioma',
        'possuiApostila',
        'legibilidade',
        'sugestao',
        'justificativa',
      ],
    },
    validateJson: (parsed: Record<string, unknown>) => {
      if (
        typeof parsed.nomeIdentificado !== 'string' ||
        typeof parsed.sugestao !== 'string' ||
        typeof parsed.justificativa !== 'string'
      ) {
        return null;
      }
      return {
        rascunho: true,
        nomeIdentificado: parsed.nomeIdentificado,
        dataEmissao: typeof parsed.dataEmissao === 'string' ? parsed.dataEmissao : 'Não informada',
        orgaoEmissor: typeof parsed.orgaoEmissor === 'string' ? parsed.orgaoEmissor : 'fonte a cadastrar',
        idioma: typeof parsed.idioma === 'string' ? parsed.idioma : 'A conferir',
        possuiApostila: Boolean(parsed.possuiApostila),
        legibilidade: typeof parsed.legibilidade === 'string' ? parsed.legibilidade : 'Regular',
        sugestao: parsed.sugestao,
        justificativa: parsed.justificativa,
      };
    },
    buildFallback: () => buildAnalisarDocumentoFallback(enrichedBody),
  };
}

export function buildCustosSpec(body: Record<string, unknown>) {
  const { currentCustos } = body;
  return {
    route: '/api/ai/custos',
    contents: JSON.stringify({ currentCustos, dataAtual: new Date().toISOString().slice(0, 10) }),
    systemInstruction:
      'Forneça estimativas referenciais de custos oficiais para brasileiros no processo migratório ao Chile (taxas SERMIG em USD, Apostila CNJ em BRL, tradução juramentada por página em BRL, Cédula de Identidade no Chile em CLP). Marque explicitamente como "estimativa — confirmar na fonte oficial" e inclua observação das fontes oficiais (SERMIG, CNJ, Registro Civil).',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        taxaSermigMercosulUsd: { type: Type.NUMBER },
        taxaSermigTemporalUsd: { type: Type.NUMBER },
        taxaSermigDefinitivaUsd: { type: Type.NUMBER },
        apostilaCnjBrl: { type: Type.NUMBER },
        traducaoJuramentadaBrl: { type: Type.NUMBER },
        cedulaIdentidadeClp: { type: Type.NUMBER },
        observacao: { type: Type.STRING },
        atualizadoEm: { type: Type.STRING },
      },
      required: [
        'taxaSermigMercosulUsd',
        'taxaSermigTemporalUsd',
        'taxaSermigDefinitivaUsd',
        'apostilaCnjBrl',
        'traducaoJuramentadaBrl',
        'cedulaIdentidadeClp',
        'observacao',
        'atualizadoEm',
      ],
    },
    validateJson: (parsed: Record<string, unknown>) => {
      const m = asFiniteNumber(parsed.taxaSermigMercosulUsd);
      const t = asFiniteNumber(parsed.taxaSermigTemporalUsd);
      const d = asFiniteNumber(parsed.taxaSermigDefinitivaUsd);
      const a = asFiniteNumber(parsed.apostilaCnjBrl);
      const tr = asFiniteNumber(parsed.traducaoJuramentadaBrl);
      const c = asFiniteNumber(parsed.cedulaIdentidadeClp);
      if (m === null || t === null || d === null || a === null || tr === null || c === null) return null;
      return {
        estimativa: true,
        taxaSermigMercosulUsd: m,
        taxaSermigTemporalUsd: t,
        taxaSermigDefinitivaUsd: d,
        apostilaCnjBrl: a,
        traducaoJuramentadaBrl: tr,
        cedulaIdentidadeClp: c,
        observacao: typeof parsed.observacao === 'string' ? parsed.observacao : 'Estimativa — confirmar na fonte oficial.',
        atualizadoEm: typeof parsed.atualizadoEm === 'string' ? parsed.atualizadoEm : new Date().toISOString().slice(0, 10),
      };
    },
    buildFallback: () => buildCustosFallback(body),
  };
}

export function buildPropostaSpec(body: Record<string, unknown>) {
  const rawProp = (body.proposal && typeof body.proposal === 'object' ? body.proposal : {}) as Record<string, unknown>;
  const proposalBrief = {
    nome_empresa: typeof rawProp.nome_empresa === 'string' ? rawProp.nome_empresa.slice(0, 200) : '',
    categoria: typeof rawProp.categoria === 'string' ? rawProp.categoria.slice(0, 100) : '',
    pais: typeof rawProp.pais === 'string' ? rawProp.pais.slice(0, 60) : '',
    cidade: typeof rawProp.cidade === 'string' ? rawProp.cidade.slice(0, 120) : '',
    responsavel: typeof rawProp.responsavel === 'string' ? rawProp.responsavel.slice(0, 120) : '',
    moeda: typeof rawProp.moeda === 'string' ? rawProp.moeda.slice(0, 20) : '',
    proposta: typeof rawProp.proposta === 'string' ? rawProp.proposta.slice(0, 2400) : '',
    mensagem: typeof rawProp.mensagem === 'string' ? rawProp.mensagem.slice(0, 2400) : '',
    status: typeof rawProp.status === 'string' ? rawProp.status.slice(0, 40) : '',
  };
  const sourcesBrief = compactServerLegalSources(body.legalSources, 15);
  return {
    route: '/api/ai/proposta',
    contents: JSON.stringify({ proposal: proposalBrief, legalSources: sourcesBrief }),
    systemInstruction:
      'Avalie a proposta comercial de parceria para a D&M Integra Chile em português do Brasil, confrontando aderência legal/compliance somente com legalSources fornecidas (ou escreva "fonte a cadastrar"). Gere nota de 0 a 100, riscos, base aplicada, sugestão (indicar | indicar com ressalvas | recusar) e texto curto de indicação ao cliente.',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        nota: { type: Type.NUMBER },
        riscos: { type: Type.ARRAY, items: { type: Type.STRING } },
        baseAplicada: { type: Type.STRING },
        sugestaoDecisao: { type: Type.STRING },
        textoIndicacao: { type: Type.STRING },
      },
      required: ['nota', 'riscos', 'baseAplicada', 'sugestaoDecisao', 'textoIndicacao'],
    },
    validateJson: (parsed: Record<string, unknown>) => {
      const nota = asFiniteNumber(parsed.nota);
      if (nota === null || typeof parsed.baseAplicada !== 'string' || typeof parsed.sugestaoDecisao !== 'string') {
        return null;
      }
      return {
        rascunho: true,
        nota: Math.round(Math.min(100, Math.max(0, nota))),
        riscos: asStringArray(parsed.riscos) || [],
        baseAplicada: parsed.baseAplicada.trim(),
        sugestaoDecisao: parsed.sugestaoDecisao.trim(),
        textoIndicacao: typeof parsed.textoIndicacao === 'string' ? parsed.textoIndicacao.trim() : '',
      };
    },
    buildFallback: () => buildPropostaFallback(body),
  };
}

export function buildNormaSpec(body: Record<string, unknown>, uploadDir: string) {
  const currentSourceBrief = compactServerCurrentSource(body.currentSource);
  const newText = typeof body.newText === 'string' ? body.newText.trim().slice(0, 18000) : '';
  const { arquivoUrl } = body;
  let fileBase64 = stripBase64DataPrefix(body.fileBase64);
  let mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().toLowerCase() : '';

  if ((!fileBase64 || !mimeType) && arquivoUrl) {
    const resolved = resolveAttachmentFromUploadUrl(uploadDir, arquivoUrl);
    if (resolved) {
      fileBase64 = resolved.fileBase64;
      mimeType = resolved.mimeType;
    }
  }

  const enrichedBody = { ...body, fileBase64, mimeType };
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    {
      text: `Analise o texto/documento normativo e compare com a norma vigente cadastrada:\nNorma atual: ${JSON.stringify(currentSourceBrief)}\nNovo texto: ${newText || '(ver anexo)'}`,
    },
  ];
  if (fileBase64 && mimeType) {
    parts.push({ inlineData: { mimeType, data: fileBase64 } });
  }

  return {
    route: '/api/ai/norma',
    contents: { parts },
    systemInstruction:
      'Extraia artigos principais, compare com a versão vigente, gere resumo executivo em português do Brasil, explicação simples para o cliente ("Entenda a Lei"), impactos em visto/requisitos e divergências encontradas. Nunca invente dispositivos que não constem no texto enviado.',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        artigosExtraidos: { type: Type.STRING },
        resumoExecutivo: { type: Type.STRING },
        explicacaoCliente: { type: Type.STRING },
        impactosVistos: { type: Type.ARRAY, items: { type: Type.STRING } },
        divergencias: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['artigosExtraidos', 'resumoExecutivo', 'explicacaoCliente', 'impactosVistos', 'divergencias'],
    },
    validateJson: (parsed: Record<string, unknown>) => {
      if (typeof parsed.resumoExecutivo !== 'string' || !parsed.resumoExecutivo.trim()) return null;
      return {
        rascunho: true,
        artigosExtraidos: typeof parsed.artigosExtraidos === 'string' ? parsed.artigosExtraidos : 'fonte a cadastrar',
        resumoExecutivo: parsed.resumoExecutivo.trim(),
        explicacaoCliente: typeof parsed.explicacaoCliente === 'string' ? parsed.explicacaoCliente.trim() : '',
        impactosVistos: asStringArray(parsed.impactosVistos) || [],
        divergencias: asStringArray(parsed.divergencias) || [],
      };
    },
    buildFallback: () => buildNormaFallback(enrichedBody),
  };
}

export function buildNormaVerificarSpec(body: Record<string, unknown>) {
  const currentSourceBrief = compactServerCurrentSource(body.currentSource);
  const titulo = currentSourceBrief.titulo || '';
  const numeroAno = currentSourceBrief.numeroAno || '';
  const pais = currentSourceBrief.pais || 'Chile';
  const linkOficial = currentSourceBrief.linkOficial || '';
  const dataHoje = new Date().toISOString().slice(0, 10);

  return {
    route: '/api/ai/norma-verificar',
    tools: [{ googleSearch: {} }],
    contents: `Data atual: ${dataHoje}.
Pesquise nas fontes oficiais (${pais === 'Brasil' ? 'planalto.gov.br, cnj.jus.br, gov.br/pf' : 'serviciomigraciones.cl, bcn.cl/leychile, diariooficial.interior.gob.cl'}) sobre a seguinte norma/portal cadastrado na consultoria D&M Integra Chile:
Título: ${titulo}
Número/Ano: ${numeroAno}
Link oficial cadastrado: ${linkOficial || 'Não informado'}
Resumo vigente cadastrado no sistema: ${JSON.stringify(currentSourceBrief)}

Verifique se existem atualizações normativas recentes, resoluções exentas complementares, mudanças de prazo (ex.: validade de antecedentes, prorrogação, estampado electrónico, requisitos por subcategoria) ou alterações na BCN LeyChile / SERMIG / Planalto. Retorne um comparativo técnico objetivo em português do Brasil sem inventar artigos ou números não encontrados na busca.`,
    systemInstruction:
      'Você é um pesquisador jurídico migratório Brasil-Chile. Use a busca Google para consultar prioritariamente serviciomigraciones.cl, bcn.cl/leychile, planalto.gov.br e cnj.jus.br. Nunca invente artigos, decretos ou resoluções que não apareçam nos resultados da busca. Devolva apenas JSON válido.',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        possuiAtualizacao: { type: Type.BOOLEAN },
        situacaoAtual: { type: Type.STRING },
        artigosExtraidos: { type: Type.STRING },
        resumoExecutivo: { type: Type.STRING },
        explicacaoCliente: { type: Type.STRING },
        impactosVistos: { type: Type.ARRAY, items: { type: Type.STRING } },
        divergencias: { type: Type.ARRAY, items: { type: Type.STRING } },
        fontesCitadas: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        'possuiAtualizacao',
        'situacaoAtual',
        'artigosExtraidos',
        'resumoExecutivo',
        'explicacaoCliente',
        'impactosVistos',
        'divergencias',
        'fontesCitadas',
      ],
    },
    validateJson: (parsed: Record<string, unknown>) => {
      if (typeof parsed.resumoExecutivo !== 'string' || !parsed.resumoExecutivo.trim()) return null;
      return {
        rascunho: true,
        possuiAtualizacao: Boolean(parsed.possuiAtualizacao),
        situacaoAtual:
          typeof parsed.situacaoAtual === 'string' && parsed.situacaoAtual.trim()
            ? parsed.situacaoAtual.trim()
            : 'Confirmar na fonte oficial',
        artigosExtraidos:
          typeof parsed.artigosExtraidos === 'string' && parsed.artigosExtraidos.trim()
            ? parsed.artigosExtraidos
            : 'fonte a cadastrar',
        resumoExecutivo: parsed.resumoExecutivo.trim(),
        explicacaoCliente: typeof parsed.explicacaoCliente === 'string' ? parsed.explicacaoCliente : '',
        impactosVistos: asStringArray(parsed.impactosVistos) || [],
        divergencias: asStringArray(parsed.divergencias) || [],
        fontesCitadas: asStringArray(parsed.fontesCitadas) || [],
      };
    },
    buildFallback: () => buildNormaVerificarFallback(body),
  };
}

