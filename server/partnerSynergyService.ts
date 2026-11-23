import { GoogleGenAI, ThinkingLevel, Type, type GenerateContentResponse } from '@google/genai';
import {
  classifyGeminiError,
  DEFAULT_GEMINI_FALLBACK_MODEL,
  DEFAULT_GEMINI_PRIMARY_MODEL,
  extractAndValidateJson,
  normalizeGeminiApiKey,
  resolveGeminiApiKeyFromEnv,
  resolveGeminiModelFromEnv,
} from './geminiWrapper.ts';

export interface SynergyClientProfile {
  objetivo: string;
  etapaAtual: string;
  composicaoFamiliar: string;
  urgencia: string;
  paisAtual?: string;
  necessidadesExtras?: string;
  locale: 'pt-BR' | 'es-CL';
}

export interface SynergyPartnerCatalogItem {
  id: string;
  nome: string;
  categoria: string;
  pais: string;
  cidadeRegiao: string;
  avaliacao: number;
  descricaoPublica: string;
}

export type SynergyPriority = 'Essencial' | 'Recomendado' | 'Complementar';

export interface PartnerSynergyRecommendation {
  partnerId: string;
  scoreSinergia: number;
  prioridade: SynergyPriority;
  justificativa: string;
  momentoIdeal: string;
  proximoPasso: string;
}

export interface PartnerSynergyAnalysisResult {
  resumoEstrategico: string;
  etapaSugerida: string;
  recomendacoes: PartnerSynergyRecommendation[];
  modeloUsado: string;
  analisadoEm: string;
}

export interface AnalyzePartnerSynergyOptions {
  profile: SynergyClientProfile;
  partners: SynergyPartnerCatalogItem[];
  apiKey?: string;
  model?: string;
  fallbackModel?: string;
  timeoutMs?: number;
  generateFn?: (args: {
    model: string;
    contents: string;
    config: Record<string, unknown>;
  }) => Promise<GenerateContentResponse>;
}

export interface AnalyzePartnerSynergyOutcome {
  ok: true;
  data: PartnerSynergyAnalysisResult;
}

export interface AnalyzePartnerSynergyError {
  ok: false;
  statusCode: number;
  error: string;
  code: string;
}

const VALID_PRIORITIES = new Set<SynergyPriority>(['Essencial', 'Recomendado', 'Complementar']);

export function sanitizeSynergyInput(body: Record<string, unknown>): {
  ok: true;
  profile: SynergyClientProfile;
  partners: SynergyPartnerCatalogItem[];
} | {
  ok: false;
  error: string;
} {
  const rawProfile = body.profile && typeof body.profile === 'object' ? (body.profile as Record<string, unknown>) : null;
  const rawPartners = Array.isArray(body.partners) ? body.partners : null;

  if (!rawProfile) {
    return { ok: false, error: 'Informe o perfil do cliente para análise de sinergia.' };
  }
  if (!rawPartners || rawPartners.length === 0) {
    return { ok: false, error: 'Não há parceiros homologados disponíveis para análise.' };
  }

  const locale: 'pt-BR' | 'es-CL' = rawProfile.locale === 'es-CL' ? 'es-CL' : 'pt-BR';
  const objetivo = typeof rawProfile.objetivo === 'string' ? rawProfile.objetivo.trim().slice(0, 160) : '';
  const etapaAtual = typeof rawProfile.etapaAtual === 'string' ? rawProfile.etapaAtual.trim().slice(0, 160) : '';
  const composicaoFamiliar =
    typeof rawProfile.composicaoFamiliar === 'string' ? rawProfile.composicaoFamiliar.trim().slice(0, 120) : '';
  const urgencia = typeof rawProfile.urgencia === 'string' ? rawProfile.urgencia.trim().slice(0, 120) : '';
  const paisAtual = typeof rawProfile.paisAtual === 'string' ? rawProfile.paisAtual.trim().slice(0, 80) : '';
  const necessidadesExtras =
    typeof rawProfile.necessidadesExtras === 'string' ? rawProfile.necessidadesExtras.trim().slice(0, 600) : '';

  if (!objetivo || !etapaAtual) {
    return {
      ok: false,
      error:
        locale === 'es-CL'
          ? 'Selecciona tu objetivo principal y etapa actual antes de analizar la sinergia.'
          : 'Selecione o objetivo principal e a etapa atual antes de analisar a sinergia.',
    };
  }

  const seenIds = new Set<string>();
  const partners: SynergyPartnerCatalogItem[] = [];
  for (const item of rawPartners.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id.trim().slice(0, 128) : '';
    const nome = typeof rec.nome === 'string' ? rec.nome.trim().slice(0, 160) : '';
    if (!id || !nome || seenIds.has(id)) continue;
    seenIds.add(id);
    partners.push({
      id,
      nome,
      categoria: typeof rec.categoria === 'string' ? rec.categoria.trim().slice(0, 100) : 'Outro',
      pais: typeof rec.pais === 'string' ? rec.pais.trim().slice(0, 60) : 'Chile',
      cidadeRegiao: typeof rec.cidadeRegiao === 'string' ? rec.cidadeRegiao.trim().slice(0, 140) : '',
      avaliacao:
        typeof rec.avaliacao === 'number' && Number.isFinite(rec.avaliacao)
          ? Math.min(5, Math.max(1, Number(rec.avaliacao.toFixed(1))))
          : 5,
      descricaoPublica:
        typeof rec.descricaoPublica === 'string' ? rec.descricaoPublica.trim().slice(0, 500) : '',
    });
  }

  if (partners.length === 0) {
    return {
      ok: false,
      error:
        locale === 'es-CL'
          ? 'No se encontraron aliados válidos para realizar la evaluación.'
          : 'Nenhum parceiro válido foi enviado para análise.',
    };
  }

  return {
    ok: true,
    profile: {
      objetivo,
      etapaAtual,
      composicaoFamiliar: composicaoFamiliar || (locale === 'es-CL' ? 'Individual' : 'Individual'),
      urgencia: urgencia || (locale === 'es-CL' ? '1 a 3 meses' : '1 a 3 meses'),
      paisAtual: paisAtual || undefined,
      necessidadesExtras: necessidadesExtras || undefined,
      locale,
    },
    partners,
  };
}

function normalizePriority(raw: unknown): SynergyPriority {
  if (typeof raw === 'string') {
    const clean = raw.trim();
    if (VALID_PRIORITIES.has(clean as SynergyPriority)) {
      return clean as SynergyPriority;
    }
    const lower = clean.toLowerCase();
    if (lower.includes('essenc') || lower.includes('esenc') || lower.includes('alta') || lower.includes('crit')) {
      return 'Essencial';
    }
    if (lower.includes('recom') || lower.includes('méd') || lower.includes('med')) {
      return 'Recomendado';
    }
  }
  return 'Complementar';
}

export function buildPartnerSynergySchema(): Record<string, unknown> {
  return {
    type: Type.OBJECT,
    properties: {
      resumoEstrategico: { type: Type.STRING },
      etapaSugerida: { type: Type.STRING },
      recomendacoes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            partnerId: { type: Type.STRING },
            scoreSinergia: { type: Type.NUMBER },
            prioridade: { type: Type.STRING },
            justificativa: { type: Type.STRING },
            momentoIdeal: { type: Type.STRING },
            proximoPasso: { type: Type.STRING },
          },
          required: [
            'partnerId',
            'scoreSinergia',
            'prioridade',
            'justificativa',
            'momentoIdeal',
            'proximoPasso',
          ],
        },
      },
    },
    required: ['resumoEstrategico', 'etapaSugerida', 'recomendacoes'],
  };
}

export function validateAndGroundSynergyResponse(
  parsed: Record<string, unknown>,
  catalogPartners: SynergyPartnerCatalogItem[],
): Omit<PartnerSynergyAnalysisResult, 'modeloUsado' | 'analisadoEm'> | null {
  const resumoEstrategico =
    typeof parsed.resumoEstrategico === 'string' ? parsed.resumoEstrategico.trim().slice(0, 900) : '';
  const etapaSugerida =
    typeof parsed.etapaSugerida === 'string' ? parsed.etapaSugerida.trim().slice(0, 180) : '';

  if (!resumoEstrategico || !Array.isArray(parsed.recomendacoes)) {
    return null;
  }

  const validIds = new Set(catalogPartners.map((p) => p.id));
  const seen = new Set<string>();
  const grounded: PartnerSynergyRecommendation[] = [];

  for (const item of parsed.recomendacoes) {
    if (!item || typeof item !== 'object') continue;
    const rec = item as Record<string, unknown>;
    const partnerId = typeof rec.partnerId === 'string' ? rec.partnerId.trim() : '';
    if (!partnerId || !validIds.has(partnerId) || seen.has(partnerId)) continue;

    const rawScore = Number(rec.scoreSinergia);
    if (!Number.isFinite(rawScore)) continue;

    const justificativa = typeof rec.justificativa === 'string' ? rec.justificativa.trim().slice(0, 420) : '';
    const momentoIdeal = typeof rec.momentoIdeal === 'string' ? rec.momentoIdeal.trim().slice(0, 140) : '';
    const proximoPasso = typeof rec.proximoPasso === 'string' ? rec.proximoPasso.trim().slice(0, 220) : '';
    if (!justificativa) continue;

    seen.add(partnerId);
    grounded.push({
      partnerId,
      scoreSinergia: Math.round(Math.min(100, Math.max(0, rawScore))),
      prioridade: normalizePriority(rec.prioridade),
      justificativa,
      momentoIdeal: momentoIdeal || 'Imediato',
      proximoPasso: proximoPasso || 'Solicitar orçamento inicial',
    });
  }

  if (grounded.length === 0) {
    return null;
  }

  grounded.sort((a, b) => b.scoreSinergia - a.scoreSinergia);

  return {
    resumoEstrategico,
    etapaSugerida: etapaSugerida || 'Planejamento e Execução',
    recomendacoes: grounded.slice(0, 6),
  };
}

export async function analyzePartnerSynergy(
  options: AnalyzePartnerSynergyOptions,
): Promise<AnalyzePartnerSynergyOutcome | AnalyzePartnerSynergyError> {
  const { profile, partners } = options;
  const isEs = profile.locale === 'es-CL';
  const model = resolveGeminiModelFromEnv(
    options.model ?? process.env.GEMINI_MODEL_PRIMARY,
    DEFAULT_GEMINI_PRIMARY_MODEL,
  );
  const timeoutMs = Math.max(2000, Math.min(45000, options.timeoutMs ?? 25000));

  let generateFn = options.generateFn;
  if (!generateFn) {
    const apiKey = normalizeGeminiApiKey(options.apiKey ?? resolveGeminiApiKeyFromEnv());
    if (!apiKey) {
      return {
        ok: false,
        statusCode: 503,
        code: 'missing_api_key',
        error: isEs
          ? 'El módulo de inteligencia artificial aún no tiene clave configurada en el servidor. Intenta nuevamente más tarde.'
          : 'O módulo de inteligência artificial ainda não possui chave configurada no servidor. Tente novamente mais tarde.',
      };
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    generateFn = (args) =>
      ai.models.generateContent({
        model: args.model,
        contents: args.contents,
        config: args.config as never,
      });
  }

  const languageDirective = isEs
    ? 'Responde EXCLUSIVAMENTE en español de Chile (es-CL), tono ejecutivo, claro y práctico.'
    : 'Responda EXCLUSIVAMENTE em português do Brasil (pt-BR), em tom executivo, claro e objetivo.';

  const systemInstruction = [
    'Você é um especialista sênior em imigração Brasil-Chile e relocation corporativo da D&M Integra Chile.',
    languageDirective,
    'Sua tarefa é analisar o perfil migratório do cliente e cruzar com a lista de parceiros homologados fornecida em JSON.',
    'REGRAS OBRIGATÓRIAS:',
    '1. Recomende SOMENTE parceiros cujo "partnerId" exista exatamente no array "partners" enviado na entrada. Nunca invente parceiros ou IDs.',
    '2. Selecione até 4 parceiros com maior sinergia real para o momento e objetivo do cliente, ordenados do maior scoreSinergia (0 a 100) para o menor.',
    '3. O campo "prioridade" deve ser exatamente um destes valores: "Essencial", "Recomendado" ou "Complementar".',
    '4. Justifique de forma personalizada por que cada parceiro ajuda esse perfil específico (ex.: tradução juramentada, apostilamento no Brasil, abertura de empresa no Chile, imóvel, seguro saúde, assessoria jurídica), indicando "momentoIdeal" e "proximoPasso" práticos.',
    '5. Nunca invente preços, leis não citadas ou garantias de aprovação de visto.',
  ].join('\n');

  const contents = JSON.stringify({
    clientProfile: {
      objetivo: profile.objetivo,
      etapaAtual: profile.etapaAtual,
      composicaoFamiliar: profile.composicaoFamiliar,
      urgencia: profile.urgencia,
      paisAtual: profile.paisAtual || '',
      necessidadesExtras: profile.necessidadesExtras || '',
    },
    partners,
  });

  const fallbackModel = resolveGeminiModelFromEnv(
    options.fallbackModel ?? process.env.GEMINI_MODEL_FALLBACK,
    DEFAULT_GEMINI_FALLBACK_MODEL,
  );
  const candidateModels =
    fallbackModel && fallbackModel !== model ? [model, fallbackModel] : [model];

  let lastClassified: ReturnType<typeof classifyGeminiError> | null = null;

  for (let idx = 0; idx < candidateModels.length; idx += 1) {
    const activeModel = candidateModels[idx];
    const isGemini4 = /^gemini-4-/i.test(activeModel);
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
        model: activeModel,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: buildPartnerSynergySchema(),
          ...(isGemini4 ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          abortSignal: controller.signal,
        },
      });
      callPromise.catch(() => {});

      const response = await Promise.race([callPromise, timeoutPromise]);
      const extracted = extractAndValidateJson(response, (parsed) =>
        validateAndGroundSynergyResponse(parsed, partners),
      );

      if (!extracted.ok) {
        if (extracted.blocked) {
          return {
            ok: false,
            statusCode: 400,
            code: 'response_blocked',
            error: isEs
              ? 'La consulta fue bloqueada por filtros de seguridad. Ajusta la descripción e intenta nuevamente.'
              : 'A análise foi bloqueada pelos filtros de segurança. Ajuste a descrição e tente novamente.',
          };
        }
        if (idx + 1 < candidateModels.length) continue;
        return {
          ok: false,
          statusCode: 502,
          code: 'invalid_ai_response',
          error: isEs
            ? 'La IA devolvió una respuesta incompleta. Intenta analizar nuevamente en unos segundos.'
            : 'A IA retornou uma resposta incompleta. Tente analisar novamente em alguns segundos.',
        };
      }

      return {
        ok: true,
        data: {
          ...extracted.data,
          modeloUsado: activeModel,
          analisadoEm: new Date().toISOString(),
        },
      };
    } catch (err) {
      const classified = classifyGeminiError(err);
      lastClassified = classified;
      if ((classified.retryable || classified.statusCode === 404) && idx + 1 < candidateModels.length) {
        continue;
      }
      break;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  const classified = lastClassified || {
    kind: 'temporary' as const,
    isHighDemand: false,
    retryable: true,
    safeReason: 'transient_unknown',
  };
  const statusCode =
    classified.kind === 'timeout'
      ? 504
      : classified.statusCode === 429
        ? 429
        : classified.statusCode === 401 || classified.statusCode === 403
          ? 502
          : classified.statusCode === 400
            ? 400
            : 502;

  const errorMessage =
    classified.isHighDemand || statusCode === 429 || statusCode === 504
      ? isEs
        ? 'El servicio de IA está con alta demanda en este momento. Intenta nuevamente en unos segundos.'
        : 'O serviço de IA está com alta demanda no momento. Tente novamente em alguns segundos.'
      : isEs
        ? 'No fue posible completar el análisis de sinergia con IA en este momento.'
        : 'Não foi possível concluir a análise de sinergia com IA no momento.';

  return {
    ok: false,
    statusCode,
    code: classified.safeReason,
    error: errorMessage,
  };
}
