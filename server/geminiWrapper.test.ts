import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { GenerateContentResponse } from '@google/genai';
import type { Response } from 'express';
import {
  buildAnalisarDocumentoSpec,
  buildCustosSpec,
  buildDiagnosticoSpec,
  buildNormaSpec,
  buildNormaVerificarSpec,
  buildParecerSpec,
  buildPropostaSpec,
  getAiEngineHealthStatus,
  groundDiagnosticCitations,
  runAiRouteExecution,
  type AuditWriterOptions,
} from './geminiRoutes';
import {
  acquireUserAiLock,
  chamarGemini,
  classifyGeminiError,
  computeRetryDelayMs,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_PRIMARY_MODEL,
  DEFAULT_GROQ_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  getEffectiveRuntimeConfig,
  getGeminiRuntimeConfig,
  isValidGeminiApiKey,
  MSG_AI_BAD_REQUEST,
  MSG_AI_BLOCKED,
  MSG_AI_CONCURRENT_REQUEST,
  MSG_AI_HIGH_DEMAND,
  MSG_AI_INVALID_KEY,
  MSG_AI_MISSING_KEY,
  MSG_AI_MODEL_NOT_FOUND,
  MSG_AI_OTHER_ERROR,
  normalizeGeminiApiKey,
  parseRetryAfterMs,
  releaseUserAiLock,
  resolveAlternativeAiProvidersFromEnv,
  resolveGeminiApiKeyFromEnv,
  resolveGeminiModelFromEnv,
  type ChamarGeminiParams,
} from './geminiWrapper';
import {
  AI_FALLBACK_LABEL,
  buildNormaVerificarFallback,
  inspectUploadedDocumentBinary,
} from './geminiFallbacks';

const FORCED_503_MSG =
  '{"error":{"code":503,"status":"UNAVAILABLE","message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."}}';

function makeResponse(jsonObj: unknown, finishReason = 'STOP'): GenerateContentResponse {
  return {
    text: typeof jsonObj === 'string' ? jsonObj : JSON.stringify(jsonObj),
    candidates: [{ finishReason }],
  } as unknown as GenerateContentResponse;
}

function createMockExpressRes() {
  const headers: Record<string, string> = {};
  const chunks: string[] = [];
  let statusCode = 200;
  let jsonBody: unknown = null;
  let ended = false;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      headers[name.toLowerCase()] = value;
    },
    write(chunk: string) {
      chunks.push(chunk);
      return true;
    },
    end() {
      ended = true;
    },
    json(body: unknown) {
      jsonBody = body;
      ended = true;
      return this;
    },
  } as unknown as Response;

  return {
    res,
    getState: () => ({ statusCode, headers, chunks, jsonBody, ended }),
  };
}

describe('chamarGemini() — Unified Retry, Backup Model, Timeout & Fallbacks', () => {
  it('reads model names from environment variables instead of hardcoding', () => {
    const prevPrimary = process.env.GEMINI_MODEL_PRIMARY;
    const prevFallback = process.env.GEMINI_MODEL_FALLBACK;
    try {
      process.env.GEMINI_MODEL_PRIMARY = 'custom-primary-model';
      process.env.GEMINI_MODEL_FALLBACK = 'custom-lite-model';
      const cfg = getGeminiRuntimeConfig();
      assert.equal(cfg.primaryModel, 'custom-primary-model');
      assert.equal(cfg.fallbackModel, 'custom-lite-model');
    } finally {
      if (prevPrimary === undefined) delete process.env.GEMINI_MODEL_PRIMARY;
      else process.env.GEMINI_MODEL_PRIMARY = prevPrimary;
      if (prevFallback === undefined) delete process.env.GEMINI_MODEL_FALLBACK;
      else process.env.GEMINI_MODEL_FALLBACK = prevFallback;
    }
  });

  it('calculates exponential backoff + jitter and respects Retry-After header', () => {
    assert.equal(parseRetryAfterMs('3'), 3000);
    const d1 = computeRetryDelayMs(1, 1000, undefined, () => 0);
    const d2 = computeRetryDelayMs(2, 1000, undefined, () => 0);
    const d3 = computeRetryDelayMs(3, 1000, undefined, () => 0);
    assert.equal(d1, 1000);
    assert.equal(d2, 2000);
    assert.equal(d3, 4000);

    const withRetryAfter = computeRetryDelayMs(1, 1000, 5000, () => 0);
    assert.equal(withRetryAfter, 5000);
  });

  it('on forced 503 UNAVAILABLE: retries 4x on primary, switches to backup model, and delivers backup result when backup recovers', async () => {
    const calls: Array<{ model: string }> = [];
    const delays: number[] = [];
    const progressMessages: string[] = [];

    const spec = buildParecerSpec({
      caseData: { titulo: 'Mercosul Família', tipoServico: 'Residência Temporal' },
      clientData: { nomeCompleto: 'Ana Silva', localizacaoAtual: 'Brasil' },
      dependents: [{ nomeCompleto: 'João Silva' }],
      legalSources: [{ titulo: 'Acordo Mercosul', numeroAno: 'Decreto 1496/2009', artigos: 'Art. 4' }],
    });

    const result = await chamarGemini({
      ...spec,
      configOverride: {
        apiKey: 'test-key',
        primaryModel: 'gemini-4-hydrogen',
        fallbackModel: 'gemini-3.1-flash-lite',
        maxAttempts: 4,
        fallbackAttempts: 2,
        baseDelayMs: 1000,
        timeoutMs: 40000,
      },
      rngFn: () => 0.5,
      sleepFn: async (ms) => {
        delays.push(ms);
      },
      onProgress: (ev) => {
        progressMessages.push(ev.message);
      },
      generateFn: async ({ model }) => {
        calls.push({ model });
        if (model === 'gemini-4-hydrogen') {
          const err = new Error(FORCED_503_MSG) as Error & { status?: number; headers?: Record<string, string> };
          err.status = 503;
          err.headers = { 'retry-after': '1' };
          throw err;
        }
        return makeResponse({
          enquadramentoLegal: 'Enquadramento pelo modelo reserva',
          elegibilidadeRiscos: 'Sem óbices críticos',
          fundamentacaoNormativa: 'Acordo Mercosul (Decreto 1496/2009)',
          recomendacoes: 'Emitir certidões na ordem recomendada',
        });
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.statusCode, 200);
    assert.equal(calls.filter((c) => c.model === 'gemini-4-hydrogen').length, 4);
    assert.equal(calls.filter((c) => c.model === 'gemini-3.1-flash-lite').length, 1);
    assert.equal(delays.length, 3);
    assert.equal(delays[0] >= 1000, true);
    assert.equal(delays[1] >= 2000, true);
    assert.equal(delays[2] >= 4000, true);
    assert.equal(result.payload?.origem, 'reserva');
    assert.equal(result.payload?.fallback, false);
    assert.equal(result.payload?.tentativas, 5);
    assert.equal(result.audit.modeloTipo, 'reserva');
    assert.equal(result.audit.modeloNome, 'gemini-3.1-flash-lite');
    assert.equal(result.audit.resultado, 'sucesso');
    assert.ok(progressMessages.some((m) => m.includes('Tentativa 2 de 4')));
    assert.ok(progressMessages.some((m) => m.includes('modelo reserva')));
  });

  it('on forced 503 across BOTH primary and backup: delivers rule-based fallback with Portuguese message and no raw JSON for all 6 routes (including attachments)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-upload-test-'));
    try {
      const dummyFile = path.join(tmpDir, 'antecedentes_teste.pdf');
      fs.writeFileSync(dummyFile, Buffer.from('%PDF-1.4 fake test pdf content'));

      const specs = [
        buildDiagnosticoSpec({
          answers: { localizacao: 'No Brasil', passaporteValidadeMeses: 24 },
          subcategoriaRecomendada: '15 - Acordo Mercosul',
          regrasAcionadas: ['Regra Mercosul: nacionalidade brasileira elegível.'],
          legalSources: [],
        }),
        buildParecerSpec({
          caseData: { titulo: 'Caso Teste', tipoServico: 'Residência Temporal', notaViabilidadeGeral: 88 },
          clientData: { nomeCompleto: 'Cliente Privado Não Vazar' },
          dependents: [],
          legalSources: [],
        }),
        buildPropostaSpec({
          proposal: { nome_empresa: 'Cartório Parceiro', categoria: 'Tradução', pais: 'Brasil', proposta: 'Tabela fixa 180 BRL' },
          legalSources: [],
        }),
        buildNormaSpec(
          {
            currentSource: { titulo: 'Ley 21.325', artigos: 'Art. 15', resumoPortugues: 'Texto anterior' },
            newText: 'Artículo 70 sobre Residencia Temporal Mercosur y prórroga.',
            fileBase64: Buffer.from('fake-pdf-bytes').toString('base64'),
            mimeType: 'application/pdf',
          },
          tmpDir,
        ),
        buildCustosSpec({
          currentCustos: { taxaSermigMercosulUsd: 95, apostilaCnjBrl: 190 },
        }),
        buildAnalisarDocumentoSpec(
          {
            nomeEsperado: 'Antecedentes Criminais PF',
            arquivoUrl: '/uploads/antecedentes_teste.pdf',
            textoObservacao: 'Emissão: 10/10/2026 | Apostilado marcado: true',
          },
          tmpDir,
        ),
      ];

      for (const spec of specs as Array<ChamarGeminiParams<Record<string, unknown>>>) {
        const modelsTried: string[] = [];
        const result = await chamarGemini<Record<string, unknown>>({
          ...spec,
          configOverride: {
            apiKey: 'test-key',
            primaryModel: 'gemini-4-hydrogen',
            fallbackModel: 'gemini-3.1-flash-lite',
            maxAttempts: 4,
            fallbackAttempts: 2,
            baseDelayMs: 1,
          },
          sleepFn: async () => {},
          generateFn: async ({ model }) => {
            modelsTried.push(model);
            const err = new Error(FORCED_503_MSG) as Error & { status?: number };
            err.status = 503;
            throw err;
          },
        });

        assert.equal(result.ok, true, `Expected fallback OK on ${spec.route}`);
        assert.equal(result.statusCode, 200);
        assert.equal(modelsTried.filter((m) => m === 'gemini-4-hydrogen').length, 4);
        assert.equal(modelsTried.filter((m) => m === 'gemini-3.1-flash-lite').length, 2);
        assert.equal(result.payload?.fallback, true);
        assert.equal(result.payload?.origem, 'regras');
        assert.equal(result.payload?.origemLabel, AI_FALLBACK_LABEL);
        assert.equal(result.payload?.mensagemUsuario, MSG_AI_HIGH_DEMAND);
        assert.equal(result.audit.modeloTipo, 'regras');
        assert.equal(result.audit.tentativas, 6);
        assert.equal(result.audit.resultado, 'fallback_regras');

        // Zero raw JSON leaked to user message
        const serializedPayload = JSON.stringify(result.payload);
        assert.equal(serializedPayload.includes('UNAVAILABLE'), false);
        assert.equal(serializedPayload.includes('high demand'), false);
      }

      // Check specifically "fonte a cadastrar" when legalSources is empty
      const parecerEmptySources = await chamarGemini({
        ...buildParecerSpec({ caseData: { titulo: 'Sem Fonte' }, clientData: {}, legalSources: [] }),
        configOverride: { apiKey: 'k', maxAttempts: 1, fallbackAttempts: 1, baseDelayMs: 0 },
        sleepFn: async () => {},
        generateFn: async () => {
          const e = new Error(FORCED_503_MSG) as Error & { status?: number };
          e.status = 503;
          throw e;
        },
      });
      assert.equal(parecerEmptySources.payload?.fundamentacaoNormativa, 'fonte a cadastrar');

      // Check document attachment fallback resolves local file and sets sugestao = "Revisar"
      const docSpec = buildAnalisarDocumentoSpec(
        {
          nomeEsperado: 'Antecedentes Criminais PF',
          arquivoUrl: '/uploads/antecedentes_teste.pdf',
          textoObservacao: 'Emissão: 10/10/2026 | Apostilado marcado: true',
        },
        tmpDir,
      );
      const docRes = await chamarGemini({
        ...docSpec,
        configOverride: { apiKey: 'k', maxAttempts: 1, fallbackAttempts: 1, baseDelayMs: 0 },
        sleepFn: async () => {},
        generateFn: async ({ contents }) => {
          const c = contents as { parts: Array<{ inlineData?: { mimeType: string; data: string } }> };
          assert.equal(c.parts.some((p) => p.inlineData?.mimeType === 'application/pdf'), true);
          const e = new Error(FORCED_503_MSG) as Error & { status?: number };
          e.status = 503;
          throw e;
        },
      });
      assert.equal(docRes.payload?.sugestao, 'Revisar');
      assert.equal(docRes.payload?.possuiApostila, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('does NOT retry on definitive errors (400/401/403/404) or safety-blocked responses and returns distinct Portuguese errors', async () => {
    const cases: Array<{ code: number; expectedMessage: string; expectedAttempts: number }> = [
      { code: 400, expectedMessage: MSG_AI_BAD_REQUEST, expectedAttempts: 1 },
      { code: 401, expectedMessage: MSG_AI_INVALID_KEY, expectedAttempts: 1 },
      { code: 403, expectedMessage: MSG_AI_INVALID_KEY, expectedAttempts: 1 },
      { code: 404, expectedMessage: MSG_AI_MODEL_NOT_FOUND, expectedAttempts: 2 },
    ];
    for (const { code, expectedMessage, expectedAttempts } of cases) {
      let attempts = 0;
      const modelsTried: string[] = [];
      const res = await chamarGemini({
        ...buildCustosSpec({}),
        configOverride: { apiKey: 'k', maxAttempts: 4, fallbackAttempts: 2, baseDelayMs: 0 },
        sleepFn: async () => {},
        generateFn: async ({ model }) => {
          attempts += 1;
          modelsTried.push(model);
          const err = new Error(`{"error":{"code":${code},"message":"Invalid request or API key"}}`) as Error & { status?: number };
          err.status = code;
          throw err;
        },
      });
      assert.equal(attempts, expectedAttempts, `HTTP ${code} attempt count mismatch`);
      assert.equal(new Set(modelsTried).size, attempts, `HTTP ${code} must not retry the same model`);
      assert.equal(res.ok, false);
      assert.equal(res.statusCode, code);
      assert.equal(res.errorMessage, expectedMessage);
      assert.equal(res.audit.resultado, 'erro_definitivo');
    }

    let blockedAttempts = 0;
    const blockedRes = await chamarGemini({
      ...buildCustosSpec({}),
      configOverride: { apiKey: 'k', maxAttempts: 4, fallbackAttempts: 2, baseDelayMs: 0 },
      sleepFn: async () => {},
      generateFn: async () => {
        blockedAttempts += 1;
        return makeResponse({}, 'SAFETY');
      },
    });
    assert.equal(blockedAttempts, 1);
    assert.equal(blockedRes.ok, false);
    assert.equal(blockedRes.errorMessage, MSG_AI_BLOCKED);
  });

  it('uses MSG_AI_MISSING_KEY rule fallback without network calls when GEMINI_API_KEY and alternatives are absent', async () => {
    const res = await chamarGemini({
      ...buildCustosSpec({ currentCustos: { taxaSermigMercosulUsd: 88 } }),
      configOverride: { apiKey: '', maxAttempts: 4, fallbackAttempts: 2, baseDelayMs: 0 },
      alternativeProviders: [],
    });
    assert.equal(res.ok, true);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload?.fallback, true);
    assert.equal(res.payload?.origem, 'regras');
    assert.equal(res.payload?.mensagemUsuario, MSG_AI_MISSING_KEY);
    assert.equal(res.audit.statusMotivo, 'missing_api_key');
  });

  it('caps timeoutMs, retry counts, and maxWallClockMs for Vercel Hobby (10s ceiling) when no explicit override', () => {
    const baseCfg = {
      apiKey: 'k',
      primaryModel: 'gemini-4-hydrogen',
      fallbackModel: 'gemini-3.1-flash-lite',
      timeoutMs: 40000,
      maxAttempts: 4,
      fallbackAttempts: 2,
      baseDelayMs: 1000,
    };
    const vercelCfg = getEffectiveRuntimeConfig(baseCfg, true, false);
    assert.equal(vercelCfg.timeoutMs <= 6200, true);
    assert.equal(vercelCfg.maxAttempts <= 1, true);
    assert.equal(vercelCfg.fallbackAttempts <= 1, true);
    assert.equal(vercelCfg.baseDelayMs <= 300, true);
    assert.equal(vercelCfg.maxWallClockMs <= 8200, true);
  });

  it('extracts base64 inlineData from data: URIs in buildAnalisarDocumentoSpec', async () => {
    const sampleDataUri = `data:image/png;base64,${Buffer.from('fake-png-bytes').toString('base64')}`;
    const spec = buildAnalisarDocumentoSpec(
      {
        nomeEsperado: 'Passaporte Titular',
        arquivoUrl: sampleDataUri,
        textoObservacao: 'Passaporte válido',
      },
      os.tmpdir(),
    );
    let sawInlinePng = false;
    const res = await chamarGemini({
      ...spec,
      configOverride: { apiKey: 'k', maxAttempts: 1, fallbackAttempts: 1, baseDelayMs: 0 },
      generateFn: async ({ contents }) => {
        const c = contents as { parts: Array<{ inlineData?: { mimeType: string; data: string } }> };
        sawInlinePng = c.parts.some((p) => p.inlineData?.mimeType === 'image/png');
        return makeResponse({
          nomeIdentificado: 'Passaporte Brasileiro',
          dataEmissao: '2024-01-10',
          orgaoEmissor: 'Polícia Federal',
          idioma: 'Português',
          possuiApostila: false,
          legibilidade: 'Boa',
          sugestao: 'Aprovar',
          justificativa: 'Dados coerentes.',
        });
      },
    });
    assert.equal(sawInlinePng, true);
    assert.equal(res.ok, true);
    assert.equal(res.payload?.sugestao, 'Aprovar');
  });

  it('retries once on malformed JSON and then uses deterministic rule fallback if still malformed', async () => {
    let attempts = 0;
    const spec = buildCustosSpec({ currentCustos: { taxaSermigMercosulUsd: 90 } });
    const res = await chamarGemini({
      ...spec,
      configOverride: { apiKey: 'k', maxAttempts: 4, fallbackAttempts: 2, baseDelayMs: 0 },
      sleepFn: async () => {},
      generateFn: async () => {
        attempts += 1;
        return makeResponse('NOT_VALID_JSON {{{');
      },
    });

    assert.equal(attempts, 2);
    assert.equal(res.ok, true);
    assert.equal(res.payload?.fallback, true);
    assert.equal(res.payload?.origem, 'regras');
    assert.equal(res.payload?.mensagemUsuario, MSG_AI_OTHER_ERROR);
  });

  it('aborts and retries when an attempt exceeds timeoutMs', async () => {
    let attempts = 0;
    const spec = buildCustosSpec({});
    const res = await chamarGemini({
      ...spec,
      configOverride: { apiKey: 'k', timeoutMs: 25, maxAttempts: 2, fallbackAttempts: 1, baseDelayMs: 0 },
      sleepFn: async () => {},
      generateFn: async ({ config }) => {
        attempts += 1;
        if (attempts === 1) {
          return await new Promise<GenerateContentResponse>((_resolve, reject) => {
            const sig = config.abortSignal as AbortSignal | undefined;
            sig?.addEventListener('abort', () => reject(new Error('Aborted due to timeout')));
          });
        }
        return makeResponse({
          taxaSermigMercosulUsd: 90,
          taxaSermigTemporalUsd: 90,
          taxaSermigDefinitivaUsd: 120,
          apostilaCnjBrl: 185,
          traducaoJuramentadaBrl: 210,
          cedulaIdentidadeClp: 4270,
          observacao: 'Estimativa — confirmar na fonte oficial',
          atualizadoEm: '2026-11-17',
        });
      },
    });
    assert.equal(attempts, 2);
    assert.equal(res.ok, true);
    assert.equal(res.payload?.origem, 'principal');
  });

  it('enforces per-user concurrency lock and streams NDJSON progress on runAiRouteExecution without leaking PII in audit', async () => {
    const uid = 'uid_concurrency_test';
    assert.equal(acquireUserAiLock(uid, '/api/ai/parecer'), true);
    try {
      const mockDup = createMockExpressRes();
      await runAiRouteExecution(
        { uid, email: 'c@test.com', role: 'consultor' },
        true,
        mockDup.res,
        buildParecerSpec({ caseData: {}, clientData: {} }),
        {
          uploadDir: os.tmpdir(),
          projectId: 'p',
          databaseId: '(default)',
        },
      );
      assert.equal(mockDup.getState().statusCode, 409);
      assert.deepEqual(mockDup.getState().jsonBody, { error: MSG_AI_CONCURRENT_REQUEST });
    } finally {
      releaseUserAiLock(uid);
    }

    const audits: AuditWriterOptions[] = [];
    const mockStream = createMockExpressRes();
    const spec = buildParecerSpec({
      caseData: { titulo: 'Caso Sigiloso' },
      clientData: { nomeCompleto: 'Maria Secreta CPF 000.111.222-33' },
      legalSources: [],
    });

    await runAiRouteExecution(
      { uid: 'uid_stream_test', email: 'c@test.com', role: 'consultor' },
      true,
      mockStream.res,
      spec,
      {
        uploadDir: os.tmpdir(),
        projectId: 'p',
        databaseId: '(default)',
        configOverride: { apiKey: 'k', maxAttempts: 4, fallbackAttempts: 2, baseDelayMs: 0 },
        sleepFn: async () => {},
        auditFn: async (opts) => {
          audits.push(opts);
        },
        generateFn: async () => {
          const err = new Error(FORCED_503_MSG) as Error & { status?: number };
          err.status = 503;
          throw err;
        },
      },
    );

    const state = mockStream.getState();
    assert.equal(state.headers['content-type'], 'application/x-ndjson; charset=utf-8');
    const events = state.chunks
      .join('')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string; message?: string; data?: Record<string, unknown> });

    assert.ok(events.some((e) => e.type === 'progress' && e.message?.includes('Tentativa 2 de 4')));
    const resultEvent = events.find((e) => e.type === 'result');
    assert.ok(resultEvent?.data);
    assert.equal(resultEvent.data.origem, 'regras');
    assert.equal(resultEvent.data.origemLabel, AI_FALLBACK_LABEL);
    assert.equal(resultEvent.data.mensagemUsuario, MSG_AI_HIGH_DEMAND);

    // Verify audit omits PII and tracks route, model tier, attempts, and result
    assert.equal(audits.length, 1);
    assert.equal(audits[0].audit.rota, '/api/ai/parecer');
    assert.equal(audits[0].audit.modeloTipo, 'regras');
    assert.equal(audits[0].audit.tentativas, 6);
    assert.equal(audits[0].audit.resultado, 'fallback_regras');
    assert.equal(JSON.stringify(audits[0].audit).includes('Maria Secreta'), false);
    assert.equal(classifyGeminiError(FORCED_503_MSG).isHighDemand, true);
  });

  it('forwards googleSearch tool on buildNormaVerificarSpec and extracts groundingChunks into fontesOnline', async () => {
    let capturedTools: unknown;
    const spec = buildNormaVerificarSpec({
      currentSource: {
        titulo: 'Decreto Supremo Nº 177/2022',
        numeroAno: 'Decreto Nº 177/2022',
        pais: 'Chile',
        linkOficial: 'https://www.bcn.cl/leychile/navegar?idNorma=1176043',
      },
    });

    const res = await chamarGemini({
      ...spec,
      configOverride: { apiKey: 'k', maxAttempts: 2, fallbackAttempts: 1, baseDelayMs: 0 },
      sleepFn: async () => {},
      generateFn: async ({ config }) => {
        capturedTools = config.tools;
        return {
          text: JSON.stringify({
            possuiAtualizacao: false,
            situacaoAtual: 'Vigente',
            artigosExtraidos: 'Subcategorías de Residencia Temporal',
            resumoExecutivo: 'Norma confirmada na BCN LeyChile sem alterações impeditivas.',
            explicacaoCliente: 'Esta regra define os tipos de visto temporário no Chile.',
            impactosVistos: ['Acordo Mercosul', 'Vínculo Familiar'],
            divergencias: [],
            fontesCitadas: ['https://www.bcn.cl/leychile/navegar?idNorma=1176043'],
          }),
          candidates: [
            {
              finishReason: 'STOP',
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: 'https://www.bcn.cl/leychile/navegar?idNorma=1176043',
                      title: 'BCN LeyChile - Decreto 177',
                    },
                  },
                  {
                    web: {
                      uri: 'https://serviciomigraciones.cl/residencia-temporal/',
                      title: 'SERMIG - Residencia Temporal',
                    },
                  },
                ],
              },
            },
          ],
        } as unknown as GenerateContentResponse;
      },
    });

    assert.deepEqual(capturedTools, [{ googleSearch: {} }]);
    assert.equal(res.ok, true);
    assert.equal(res.payload?.origem, 'principal');
    const data = res.payload as Record<string, unknown>;
    assert.equal(data.situacaoAtual, 'Vigente');
    const fontesOnline = data.fontesOnline as Array<{ titulo: string; url: string }>;
    assert.equal(Array.isArray(fontesOnline), true);
    assert.equal(fontesOnline.length, 2);
    assert.equal(fontesOnline[0].url, 'https://www.bcn.cl/leychile/navegar?idNorma=1176043');
    assert.equal(fontesOnline[1].titulo, 'SERMIG - Residencia Temporal');
  });

  it('uses deterministic rule fallback in PT-BR with official link when buildNormaVerificarSpec hits 503', async () => {
    const spec = buildNormaVerificarSpec({
      currentSource: {
        titulo: 'Decreto Supremo Nº 181/2023 (PNME)',
        numeroAno: 'Decreto Nº 181/2023',
        pais: 'Chile',
        linkOficial: 'https://www.bcn.cl/leychile/navegar?idNorma=1215233',
      },
    });

    const res = await chamarGemini({
      ...spec,
      configOverride: { apiKey: 'k', maxAttempts: 2, fallbackAttempts: 1, baseDelayMs: 0 },
      sleepFn: async () => {},
      generateFn: async () => {
        const err = new Error(FORCED_503_MSG) as Error & { status?: number };
        err.status = 503;
        throw err;
      },
    });

    assert.equal(res.ok, true);
    assert.equal(res.payload?.fallback, true);
    assert.equal(res.payload?.origem, 'regras');
    const data = res.payload as Record<string, unknown>;
    assert.equal(data.possuiAtualizacao, false);
    assert.ok(String(data.resumoExecutivo).includes('Decreto Supremo Nº 181/2023'));
    assert.deepEqual(data.fontesCitadas, [
      'https://www.bcn.cl/leychile/navegar?idNorma=1215233',
      'https://serviciomigraciones.cl',
      'https://www.bcn.cl/leychile',
    ]);
  });

  it('isolates concurrency locks per (uid, route) so parecer does not block custos for the same user', () => {
    const uid = 'uid_per_route_lock';
    assert.equal(acquireUserAiLock(uid, '/api/ai/parecer'), true);
    assert.equal(acquireUserAiLock(uid, '/api/ai/parecer'), false);
    // Different route on the same uid proceeds immediately
    assert.equal(acquireUserAiLock(uid, '/api/ai/custos'), true);
    releaseUserAiLock(uid, '/api/ai/parecer');
    assert.equal(acquireUserAiLock(uid, '/api/ai/parecer'), true);
    releaseUserAiLock(uid, '/api/ai/parecer');
    releaseUserAiLock(uid, '/api/ai/custos');
  });

  it('injects JSON field schema hint into systemInstruction when tools (Google Search Grounding) are active', async () => {
    let capturedSystemInstruction = '';
    const spec = buildNormaVerificarSpec({
      currentSource: {
        titulo: 'Ley 21.325',
        numeroAno: '21.325',
        linkOficial: 'https://www.bcn.cl/leychile/navegar?idNorma=1158549',
      },
    });
    const res = await chamarGemini({
      ...spec,
      configOverride: { apiKey: 'k', maxAttempts: 1, fallbackAttempts: 0, baseDelayMs: 0 },
      generateFn: async ({ config }) => {
        capturedSystemInstruction = String(config?.systemInstruction || '');
        return makeResponse({
          possuiAtualizacao: false,
          situacaoAtual: 'Vigente',
          artigosExtraidos: 'Art. 15',
          resumoExecutivo: 'Resumo ok',
          explicacaoCliente: 'Explicação ok',
          impactosVistos: ['Mercosul'],
          divergencias: [],
          fontesCitadas: ['https://www.bcn.cl/leychile'],
        });
      },
    });

    assert.equal(res.ok, true);
    assert.ok(capturedSystemInstruction.includes('possuiAtualizacao'));
    assert.ok(capturedSystemInstruction.includes('situacaoAtual'));
    assert.ok(capturedSystemInstruction.includes('explicacaoCliente'));
  });

  it('inspects PDF and PNG headers locally and flags corrupted headers in buildAnalisarDocumentoFallback', () => {
    const fakePdfBytes = Buffer.from(
      '%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\n/Type /Page\n/Type /Page\nApostila da Haia Policia Federal 2026-03-10\n%%EOF',
      'utf8',
    ).toString('base64');
    const pdfInfo = inspectUploadedDocumentBinary(fakePdfBytes, 'application/pdf');
    assert.ok(pdfInfo);
    assert.equal(pdfInfo.kind, 'pdf');
    assert.equal(pdfInfo.validHeader, true);
    assert.equal(pdfInfo.pdfVersion, '1.7');
    assert.equal(pdfInfo.estimatedPages, 2);
    assert.equal(pdfInfo.detectedDate, '2026-03-10');
    assert.ok(pdfInfo.detectedKeywords.includes('Apostila/Haia'));

    // Valid PNG IHDR header (1200x1600)
    const pngBuf = Buffer.alloc(32);
    pngBuf.write('89504e470d0a1a0a', 0, 'hex');
    pngBuf.writeUInt32BE(13, 8);
    pngBuf.write('IHDR', 12, 'ascii');
    pngBuf.writeUInt32BE(1200, 16);
    pngBuf.writeUInt32BE(1600, 20);
    const pngInfo = inspectUploadedDocumentBinary(pngBuf.toString('base64'), 'image/png');
    assert.ok(pngInfo);
    assert.equal(pngInfo.kind, 'png');
    assert.equal(pngInfo.validHeader, true);
    assert.equal(pngInfo.width, 1200);
    assert.equal(pngInfo.height, 1600);

    // Corrupted payload claiming to be PDF triggers Reprovar in fallback
    const badSpec = buildAnalisarDocumentoSpec(
      {
        nomeEsperado: 'Passaporte Titular',
        fileBase64: Buffer.from('not-a-valid-pdf-binary', 'utf8').toString('base64'),
        mimeType: 'application/pdf',
      },
      '',
    );
    const badRes = badSpec.buildFallback() as Record<string, unknown>;
    assert.equal(badRes.sugestao, 'Reprovar');
  });

  it('performs live official portal probe inside buildNormaVerificarFallback when fetchFn is provided', async () => {
    const out = await buildNormaVerificarFallback(
      {
        currentSource: {
          id: 'src_bcn',
          titulo: 'Ley de Migración',
          numeroAno: '21.325',
          linkOficial: 'https://www.bcn.cl/leychile/navegar?idNorma=1158549',
        },
      },
      {
        fetchFn: async () =>
          new Response('<html><head><title>Biblioteca del Congreso Nacional</title></head></html>', {
            status: 200,
            headers: { 'content-type': 'text/html', 'last-modified': 'Mon, 01 Sep 2025 12:00:00 GMT' },
          }),
      },
    );
    assert.equal(out.possuiAtualizacao, false);
    assert.ok(out.situacaoAtual.includes('HTTP 200'));
    assert.ok(out.resumoExecutivo.includes('Biblioteca del Congreso Nacional'));
  });

  it('sanitizes quoted/padded API keys, rejects placeholders, and supports standard server env aliases', () => {
    assert.equal(normalizeGeminiApiKey(''), '');
    assert.equal(normalizeGeminiApiKey('MY_GEMINI_API_KEY'), '');
    assert.equal(normalizeGeminiApiKey('"MY_GEMINI_API_KEY"'), '');
    assert.equal(normalizeGeminiApiKey('YOUR_API_KEY'), '');
    assert.equal(normalizeGeminiApiKey('short'), '');
    assert.equal(normalizeGeminiApiKey('  "AQ.validTestKey1234567890"  '), 'AQ.validTestKey1234567890');
    assert.equal(isValidGeminiApiKey('AIzaSyValidKeyExample12345'), true);

    assert.equal(
      resolveGeminiApiKeyFromEnv({
        GEMINI_API_KEY: 'MY_GEMINI_API_KEY',
        GOOGLE_API_KEY: '  "AIzaSyFallbackServerKey999"  ',
      }),
      'AIzaSyFallbackServerKey999',
    );
    assert.equal(
      resolveGeminiApiKeyFromEnv({
        GEMINI_API_KEY: 'AQ.PrimaryKeyTakesPrecedence123',
        GOOGLE_API_KEY: 'AIzaSySecondaryKey999',
      }),
      'AQ.PrimaryKeyTakesPrecedence123',
    );
  });

  it('rejects numeric/corrupted or retired model env values (like "30000" or "gemini-2.5-flash") and defaults safely', () => {
    assert.equal(resolveGeminiModelFromEnv('30000', DEFAULT_GEMINI_PRIMARY_MODEL), DEFAULT_GEMINI_PRIMARY_MODEL);
    assert.equal(resolveGeminiModelFromEnv('false', DEFAULT_GEMINI_FALLBACK_MODEL), DEFAULT_GEMINI_FALLBACK_MODEL);
    assert.equal(resolveGeminiModelFromEnv('gemini-2.5-flash', DEFAULT_GEMINI_PRIMARY_MODEL), DEFAULT_GEMINI_PRIMARY_MODEL);
    assert.equal(resolveGeminiModelFromEnv('gemini-1.5-pro', DEFAULT_GEMINI_PRIMARY_MODEL), DEFAULT_GEMINI_PRIMARY_MODEL);
    assert.equal(resolveGeminiModelFromEnv('models/gemini-4-hydrogen', DEFAULT_GEMINI_PRIMARY_MODEL), 'gemini-4-hydrogen');
    assert.equal(resolveGeminiModelFromEnv('"gemini-3.1-flash-lite"', DEFAULT_GEMINI_FALLBACK_MODEL), 'gemini-3.1-flash-lite');
  });

  it('auto-recovers to DEFAULT_GEMINI_PRIMARY_MODEL when a custom configured primary model returns HTTP 404', async () => {
    const modelsTried: string[] = [];
    const res = await chamarGemini({
      ...buildCustosSpec({}),
      configOverride: {
        apiKey: 'AQ.ValidTestKey1234567890',
        primaryModel: 'custom-typo-model',
        fallbackModel: DEFAULT_GEMINI_FALLBACK_MODEL,
        maxAttempts: 2,
        fallbackAttempts: 1,
        baseDelayMs: 0,
      },
      sleepFn: async () => {},
      generateFn: async ({ model }) => {
        modelsTried.push(model);
        if (model === 'custom-typo-model') {
          const err = new Error('models/custom-typo-model is not found') as Error & { status?: number };
          err.status = 404;
          throw err;
        }
        return makeResponse({
          taxaSermigMercosulUsd: 90,
          taxaSermigTemporalUsd: 90,
          taxaSermigDefinitivaUsd: 120,
          apostilaCnjBrl: 185,
          traducaoJuramentadaBrl: 210,
          cedulaIdentidadeClp: 4270,
          observacao: 'Estimativa — confirmar na fonte oficial',
          atualizadoEm: '2026-11-20',
        });
      },
    });
    assert.equal(res.ok, true);
    assert.equal(res.payload?.origem, 'principal');
    assert.equal(res.payload?.modeloUsado, DEFAULT_GEMINI_PRIMARY_MODEL);
    assert.deepEqual(modelsTried, ['custom-typo-model', DEFAULT_GEMINI_PRIMARY_MODEL]);
  });

  it('resolves free-tier alternative AI providers (Groq and OpenRouter) from env and rejects placeholders', () => {
    const empty = resolveAlternativeAiProvidersFromEnv({
      GROQ_API_KEY: 'MY_GROQ_API_KEY',
      OPENROUTER_API_KEY: 'short',
    });
    assert.equal(empty.length, 0);

    const both = resolveAlternativeAiProvidersFromEnv({
      GROQ_API_KEY: 'gsk_validGroqFreeKey123456',
      OPENROUTER_API_KEY: 'sk-or-v1-validOpenRouterKey123456',
    });
    assert.equal(both.length, 2);
    assert.equal(both[0].id, 'groq');
    assert.equal(both[0].model, DEFAULT_GROQ_MODEL);
    assert.equal(both[0].endpoint, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(both[1].id, 'openrouter');
    assert.equal(both[1].model, DEFAULT_OPENROUTER_MODEL);
    assert.equal(both[1].endpoint, 'https://openrouter.ai/api/v1/chat/completions');
  });

  it('uses Groq free tier automatically when GEMINI_API_KEY is absent', async () => {
    let calledUrl = '';
    const res = await chamarGemini({
      ...buildCustosSpec({ currentCustos: { taxaSermigMercosulUsd: 90 } }),
      configOverride: { apiKey: '', maxAttempts: 1, fallbackAttempts: 1, baseDelayMs: 0 },
      alternativeProviders: [
        {
          id: 'groq',
          label: 'Groq (gratuito)',
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          apiKey: 'gsk_testValidGroqKey123456',
          model: DEFAULT_GROQ_MODEL,
        },
      ],
      altFetchFn: (async (url: string | URL | Request) => {
        calledUrl = String(url);
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    taxaSermigMercosulUsd: 90,
                    taxaSermigTemporalUsd: 90,
                    taxaSermigDefinitivaUsd: 120,
                    apostilaCnjBrl: 185,
                    traducaoJuramentadaBrl: 210,
                    cedulaIdentidadeClp: 4270,
                    observacao: 'Estimativa via Groq gratuito',
                    atualizadoEm: '2026-11-20',
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }) as typeof fetch,
    });

    assert.equal(calledUrl, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(res.ok, true);
    assert.equal(res.payload?.fallback, false);
    assert.equal(res.payload?.origem, 'principal');
    assert.equal(res.payload?.modeloUsado, `groq/${DEFAULT_GROQ_MODEL}`);
    assert.equal(res.audit.statusMotivo, 'ok_groq');
    assert.equal(res.audit.resultado, 'sucesso');
  });

  it('fails over from Gemini 503 to Groq free tier before falling back to local rules', async () => {
    const res = await chamarGemini({
      ...buildCustosSpec({ currentCustos: { taxaSermigMercosulUsd: 90 } }),
      configOverride: { apiKey: 'AQ.ValidTestKey1234567890', maxAttempts: 1, fallbackAttempts: 1, baseDelayMs: 0 },
      sleepFn: async () => {},
      generateFn: async () => {
        const err = new Error(FORCED_503_MSG) as Error & { status?: number };
        err.status = 503;
        throw err;
      },
      alternativeProviders: [
        {
          id: 'groq',
          label: 'Groq (gratuito)',
          endpoint: 'https://api.groq.com/openai/v1/chat/completions',
          apiKey: 'gsk_testValidGroqKey123456',
          model: DEFAULT_GROQ_MODEL,
        },
      ],
      altFetchFn: (async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    taxaSermigMercosulUsd: 92,
                    taxaSermigTemporalUsd: 92,
                    taxaSermigDefinitivaUsd: 120,
                    apostilaCnjBrl: 190,
                    traducaoJuramentadaBrl: 220,
                    cedulaIdentidadeClp: 4270,
                    observacao: 'Failover via Groq gratuito',
                    atualizadoEm: '2026-11-20',
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )) as typeof fetch,
    });

    assert.equal(res.ok, true);
    assert.equal(res.payload?.fallback, false);
    assert.equal(res.payload?.origem, 'reserva');
    assert.equal(res.payload?.modeloUsado, `groq/${DEFAULT_GROQ_MODEL}`);
    assert.equal(res.audit.statusMotivo, 'ok_groq');
  });

  it('reports cloudAiConfigured, activeProvider, and vercelHobbyOptimized accurately in getAiEngineHealthStatus()', () => {
    const saved = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
      API_KEY: process.env.API_KEY,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    };

    try {
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.API_KEY;
      delete process.env.GROQ_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      const localHealth = getAiEngineHealthStatus();
      assert.equal(localHealth.cloudAiConfigured, false);
      assert.equal(localHealth.activeProvider, 'local_rules');
      assert.equal(localHealth.providers.localRules, true);
      assert.equal(localHealth.vercelHobbyOptimized, true);

      process.env.GROQ_API_KEY = 'gsk_validGroqKeyForHealthTest123';
      const groqHealth = getAiEngineHealthStatus();
      assert.equal(groqHealth.geminiConfigured, false);
      assert.equal(groqHealth.cloudAiConfigured, true);
      assert.equal(groqHealth.activeProvider, 'groq');
      assert.equal(groqHealth.providers.groq, true);
      assert.equal(groqHealth.mode, 'gemini_plus_rules');
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('rejects out-of-range numeric env vars like GEMINI_MAX_ATTEMPTS=30000 and falls back to safe default 2', () => {
    const saved = {
      GEMINI_MAX_ATTEMPTS: process.env.GEMINI_MAX_ATTEMPTS,
      GEMINI_FALLBACK_ATTEMPTS: process.env.GEMINI_FALLBACK_ATTEMPTS,
      GEMINI_TIMEOUT_MS: process.env.GEMINI_TIMEOUT_MS,
    };
    try {
      process.env.GEMINI_MAX_ATTEMPTS = '30000';
      process.env.GEMINI_FALLBACK_ATTEMPTS = '30000';
      process.env.GEMINI_TIMEOUT_MS = '200';
      const cfg = getGeminiRuntimeConfig();
      assert.equal(cfg.maxAttempts, 2);
      assert.equal(cfg.fallbackAttempts, 2);
      assert.equal(cfg.timeoutMs, 25000);
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('compacts oversized inputs and accepts valid partial parecer and stringified custos numbers', () => {
    const parecerSpec = buildParecerSpec({
      caseData: { titulo: 'Mercosul', observacoes: 'A'.repeat(4000) },
      clientData: { localizacaoAtual: 'Brasil', passaporte: { validade: '2030-01-01' } },
      dependents: Array.from({ length: 15 }, (_, i) => ({ vinculo: `Filho ${i}`, nomeCompleto: 'Privado' })),
      legalSources: Array.from({ length: 20 }, (_, i) => ({
        titulo: `Norma ${i}`,
        textoIntegral: 'Z'.repeat(5000),
      })),
    });
    const promptStr = String(parecerSpec.contents);
    assert.equal(promptStr.includes('Privado'), false);
    assert.equal(promptStr.length < 18000, true);

    const validatedParecer = parecerSpec.validateJson({
      enquadramentoLegal: 'Acordo Mercosul (Subcategoria 15).',
      elegibilidadeRiscos: '',
      fundamentacaoNormativa: '',
      recomendacoes: 'Emitir antecedentes PF e apostilar.',
    });
    assert.ok(validatedParecer);
    assert.equal(validatedParecer.enquadramentoLegal, 'Acordo Mercosul (Subcategoria 15).');
    assert.ok(validatedParecer.elegibilidadeRiscos.length > 0);
    assert.ok(validatedParecer.fundamentacaoNormativa.length > 0);

    const custosSpec = buildCustosSpec({});
    const validatedCustos = custosSpec.validateJson({
      taxaSermigMercosulUsd: '90',
      taxaSermigTemporalUsd: '90,5',
      taxaSermigDefinitivaUsd: 120,
      apostilaCnjBrl: '185',
      traducaoJuramentadaBrl: '210',
      cedulaIdentidadeClp: '4270',
      observacao: 'Estimativa — confirmar na fonte oficial',
      atualizadoEm: '2026-11-23',
    });
    assert.ok(validatedCustos);
    assert.equal(validatedCustos.taxaSermigMercosulUsd, 90);
    assert.equal(validatedCustos.taxaSermigTemporalUsd, 90.5);
  });

  it('strips PII from buildDiagnosticoSpec prompt and removes hallucinated citations via groundDiagnosticCitations', () => {
    const legalSources = [
      {
        titulo: 'Ley de Migración y Extranjería',
        numeroAno: 'Ley Nº 21.325',
        artigos: 'Art. 69 e Art. 70',
      },
      {
        titulo: 'Decreto Supremo Nº 177/2022',
        numeroAno: 'Decreto 177/2022',
        artigos: 'Subcategoría 15 (Mercosur)',
      },
    ];

    const spec = buildDiagnosticoSpec({
      answers: {
        nome: 'Nome Privado Teste',
        email: 'privado@exemplo.com',
        whatsapp: '+55 11 99999-8888',
        cidadeUf: 'São Paulo/SP',
        localizacao: 'No Brasil',
        passaporteValidadeMeses: 24,
      },
      subcategoriaRecomendada: '15 - Reciprocidade Internacional (Mercosul)',
      radarViabilidade: {
        total: 88,
        veredito: 'Alta viabilidade',
        confianca: 'Alta',
        dimensoes: [
          { nome: 'Elegibilidade Legal', pontos: 25, maximo: 25, observacao: 'Nacionalidade brasileira.' },
        ],
      },
      regrasAcionadas: ['Acordo Mercosul aplicável.'],
      legalSources,
    });

    const promptText = String(spec.contents);
    assert.equal(promptText.includes('Nome Privado Teste'), false);
    assert.equal(promptText.includes('privado@exemplo.com'), false);
    assert.equal(promptText.includes('+55 11 99999-8888'), false);
    assert.equal(promptText.includes('radarViabilidade'), true);

    const validated = spec.validateJson({
      resumoExecutivo: 'Perfil com 88/100 no Radar para Mercosul.',
      pontosAtencao: ['Emitir antecedentes PF por último.', 'Emitir antecedentes PF por último.'],
      proximosPassos: ['Apostilar certidão de nascimento.'],
      fontesCitadas: ['Ley Nº 21.325 — Art. 69', 'Lei Inventada 99.999/2099 (alucinação)'],
    });

    assert.ok(validated);
    assert.deepEqual(validated.pontosAtencao, ['Emitir antecedentes PF por último.']);
    assert.deepEqual(validated.fontesCitadas, ['Ley Nº 21.325 — Art. 69']);

    // When all citations are hallucinated, falls back strictly to verified catalog sources
    const groundedFallback = groundDiagnosticCitations(
      ['Resolução Fictícia 888/2099'],
      legalSources,
    );
    assert.equal(groundedFallback.length, 2);
    assert.ok(groundedFallback[0].includes('Ley de Migración'));
    assert.deepEqual(groundDiagnosticCitations(['Qualquer norma'], []), ['fonte a cadastrar']);
  });
});




