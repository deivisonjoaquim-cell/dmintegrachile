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
  MSG_AI_CONCURRENT_REQUEST,
  MSG_AI_OTHER_ERROR,
  releaseUserAiLock,
  type ChamarGeminiParams,
  type ChamarGeminiResult,
  type GeminiRuntimeConfig,
  type ModelTier,
} from './geminiWrapper.ts';

export interface AiEngineHealthStatus {
  ok: true;
  geminiConfigured: boolean;
  mode: 'gemini_plus_rules' | 'rules_live_hybrid';
  primaryModel: string;
  fallbackModel: string;
  activeEngine: string;
  features: string[];
}

export function getAiEngineHealthStatus(): AiEngineHealthStatus {
  const cfg = getGeminiRuntimeConfig();
  const geminiConfigured = Boolean(cfg.apiKey && cfg.apiKey !== 'MY_GEMINI_API_KEY');
  return {
    ok: true,
    geminiConfigured,
    mode: geminiConfigured ? 'gemini_plus_rules' : 'rules_live_hybrid',
    primaryModel: cfg.primaryModel,
    fallbackModel: cfg.fallbackModel,
    activeEngine: geminiConfigured
      ? `IA Gemini (${cfg.primaryModel} + reserva ${cfg.fallbackModel}) com fallback local`
      : 'Motor Local Inteligente + Consulta HTTP SERMIG/BCN ao vivo',
    features: [
      'diagnostico',
      'parecer',
      'analisar-documento',
      'custos',
      'proposta',
      'norma',
      'norma-verificar',
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

function asStringArray(val: unknown): string[] | null {
  if (!Array.isArray(val)) return null;
  return val.filter((x): x is string => typeof x === 'string');
}

function asFiniteNumber(val: unknown): number | null {
  return typeof val === 'number' && Number.isFinite(val) ? val : null;
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
  const writeNdjson = (obj: unknown) => {
    if (!wantsProgressStream) return;
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

  try {
    const result = await chamarGemini<T>({
      ...params,
      configOverride: deps.configOverride ?? params.configOverride,
      generateFn: deps.generateFn ?? params.generateFn,
      sleepFn: deps.sleepFn ?? params.sleepFn,
      onProgress: (ev) => {
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
  } catch {
    if (wantsProgressStream && streamStarted) {
      writeNdjson({ type: 'error', statusCode: 500, error: MSG_AI_OTHER_ERROR });
      res.end();
    } else if (!res.headersSent) {
      res.status(500).json({ error: MSG_AI_OTHER_ERROR });
    }
    return null;
  } finally {
    releaseUserAiLock(uid, params.route);
  }
}

export function buildDiagnosticoSpec(body: Record<string, unknown>) {
  const { answers, regrasAcionadas, visaCategories, legalSources, subcategoriaRecomendada } = body;
  const sourcesBrief = Array.isArray(legalSources)
    ? legalSources.slice(0, 20).map((s: Record<string, unknown>) => ({
        titulo: s.titulo,
        numeroAno: s.numeroAno,
        artigos: s.artigos,
        resumoPortugues: s.resumoPortugues,
      }))
    : [];
  const categoriesBrief = Array.isArray(visaCategories) ? visaCategories.slice(0, 20) : [];

  return {
    route: '/api/ai/diagnostico',
    contents: JSON.stringify({
      answers,
      subcategoriaRecomendada: subcategoriaRecomendada || null,
      regrasAcionadas: Array.isArray(regrasAcionadas) ? regrasAcionadas.slice(0, 30) : [],
      visaCategories: categoriesBrief,
      legalSources: sourcesBrief,
    }),
    systemInstruction:
      'Você é um assistente técnico de imigração Brasil-Chile da consultoria D&M Integra Chile. Responda EXCLUSIVAMENTE em português do Brasil. REGRA ABSOLUTA 1: Nunca altere a subcategoria recomendada pelas regras — apenas explique e contextualize. REGRA ABSOLUTA 2: Nunca invente normas, leis, decretos ou artigos; cite APENAS os registros presentes em legalSources enviados na entrada. Se não houver norma aplicável na lista para alguma afirmação, escreva literalmente "fonte a cadastrar". Este texto é um rascunho orientativo editável e exige revisão humana.',
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
      if (typeof parsed.resumoExecutivo !== 'string' || !parsed.resumoExecutivo.trim()) return null;
      return {
        rascunho: true,
        resumoExecutivo: parsed.resumoExecutivo.trim(),
        riscos: asStringArray(parsed.riscos) || [],
        perguntasConsultor: asStringArray(parsed.perguntasConsultor) || [],
        pontosAtencao: asStringArray(parsed.pontosAtencao) || [],
        fontesCitadas: asStringArray(parsed.fontesCitadas) || ['fonte a cadastrar'],
        proximosPassos: asStringArray(parsed.proximosPassos) || [],
      };
    },
    buildFallback: () => buildDiagnosticoFallback(body),
  };
}

export function buildParecerSpec(body: Record<string, unknown>) {
  const { caseData, clientData, dependents, legalSources } = body;
  return {
    route: '/api/ai/parecer',
    contents: JSON.stringify({ caseData, clientData, dependents, legalSources }),
    systemInstruction:
      'Elabore um rascunho de Parecer Técnico Migratório em português do Brasil. Cite SOMENTE normas existentes em legalSources enviadas no contexto; caso falte base para alguma afirmação, escreva "fonte a cadastrar".',
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
      if (
        typeof parsed.enquadramentoLegal !== 'string' ||
        typeof parsed.elegibilidadeRiscos !== 'string' ||
        typeof parsed.fundamentacaoNormativa !== 'string' ||
        typeof parsed.recomendacoes !== 'string'
      ) {
        return null;
      }
      if (!parsed.enquadramentoLegal.trim() || !parsed.recomendacoes.trim()) return null;
      return {
        rascunho: true,
        enquadramentoLegal: parsed.enquadramentoLegal,
        elegibilidadeRiscos: parsed.elegibilidadeRiscos,
        fundamentacaoNormativa: parsed.fundamentacaoNormativa,
        recomendacoes: parsed.recomendacoes,
      };
    },
    buildFallback: () => buildParecerFallback(body),
  };
}

export function buildAnalisarDocumentoSpec(body: Record<string, unknown>, uploadDir: string) {
  const { nomeEsperado, textoObservacao, arquivoUrl } = body;
  let fileBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
  let mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';

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
  const { proposal, legalSources } = body;
  return {
    route: '/api/ai/proposta',
    contents: JSON.stringify({ proposal, legalSources }),
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
        nota,
        riscos: asStringArray(parsed.riscos) || [],
        baseAplicada: parsed.baseAplicada,
        sugestaoDecisao: parsed.sugestaoDecisao,
        textoIndicacao: typeof parsed.textoIndicacao === 'string' ? parsed.textoIndicacao : '',
      };
    },
    buildFallback: () => buildPropostaFallback(body),
  };
}

export function buildNormaSpec(body: Record<string, unknown>, uploadDir: string) {
  const { currentSource, newText, arquivoUrl } = body;
  let fileBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
  let mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';

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
      text: `Analise o texto/documento normativo e compare com a norma vigente cadastrada:\nNorma atual: ${JSON.stringify(currentSource || {})}\nNovo texto: ${newText || '(ver anexo)'}`,
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
        resumoExecutivo: parsed.resumoExecutivo,
        explicacaoCliente: typeof parsed.explicacaoCliente === 'string' ? parsed.explicacaoCliente : '',
        impactosVistos: asStringArray(parsed.impactosVistos) || [],
        divergencias: asStringArray(parsed.divergencias) || [],
      };
    },
    buildFallback: () => buildNormaFallback(enrichedBody),
  };
}

export function buildNormaVerificarSpec(body: Record<string, unknown>) {
  const currentSource = (body.currentSource && typeof body.currentSource === 'object' ? body.currentSource : {}) as Record<string, unknown>;
  const titulo = typeof currentSource.titulo === 'string' ? currentSource.titulo : '';
  const numeroAno = typeof currentSource.numeroAno === 'string' ? currentSource.numeroAno : '';
  const pais = typeof currentSource.pais === 'string' ? currentSource.pais : 'Chile';
  const linkOficial = typeof currentSource.linkOficial === 'string' ? currentSource.linkOficial : '';
  const dataHoje = new Date().toISOString().slice(0, 10);

  return {
    route: '/api/ai/norma-verificar',
    tools: [{ googleSearch: {} }],
    contents: `Data atual: ${dataHoje}.
Pesquise nas fontes oficiais (${pais === 'Brasil' ? 'planalto.gov.br, cnj.jus.br, gov.br/pf' : 'serviciomigraciones.cl, bcn.cl/leychile, diariooficial.interior.gob.cl'}) sobre a seguinte norma/portal cadastrado na consultoria D&M Integra Chile:
Título: ${titulo}
Número/Ano: ${numeroAno}
Link oficial cadastrado: ${linkOficial || 'Não informado'}
Resumo vigente cadastrado no sistema: ${JSON.stringify(currentSource)}

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

