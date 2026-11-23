import assert from 'node:assert/strict';
import test from 'node:test';
import type { GenerateContentResponse } from '@google/genai';
import {
  analyzePartnerSynergy,
  sanitizeSynergyInput,
  validateAndGroundSynergyResponse,
  type SynergyPartnerCatalogItem,
} from './partnerSynergyService.ts';

const SAMPLE_PARTNERS: SynergyPartnerCatalogItem[] = [
  {
    id: 'part_trad',
    nome: 'Andes Traduções Juramentadas',
    categoria: 'Tradutor Juramentado',
    pais: 'Brasil',
    cidadeRegiao: 'São Paulo - SP',
    avaliacao: 5,
    descricaoPublica: 'Tradução juramentada de certidões civis e antecedentes para o SERMIG.',
  },
  {
    id: 'part_imob',
    nome: 'Cordillera Living Relocation',
    categoria: 'Imobiliária',
    pais: 'Chile',
    cidadeRegiao: 'Santiago (Providencia e Las Condes)',
    avaliacao: 4.9,
    descricaoPublica: 'Busca de apartamentos mobiliados e contrato de locação para recém-chegados.',
  },
  {
    id: 'part_contab',
    nome: 'Nexo Contábil Chile',
    categoria: 'Contabilidade / Abertura Empresa',
    pais: 'Chile',
    cidadeRegiao: 'Santiago',
    avaliacao: 4.8,
    descricaoPublica: 'Abertura de SpA, RUT de investidor e enquadramento tributário SII.',
  },
];

test('sanitizeSynergyInput validates required fields and deduplicates partners', () => {
  const invalid = sanitizeSynergyInput({ profile: { objetivo: '' }, partners: SAMPLE_PARTNERS });
  assert.equal(invalid.ok, false);

  const valid = sanitizeSynergyInput({
    profile: {
      objetivo: 'Empreender no Chile',
      etapaAtual: 'Planejando no Brasil',
      composicaoFamiliar: 'Casal',
      urgencia: '1 a 3 meses',
      locale: 'pt-BR',
    },
    partners: [...SAMPLE_PARTNERS, SAMPLE_PARTNERS[0]],
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.partners.length, 3);
    assert.equal(valid.profile.locale, 'pt-BR');
  }
});

test('validateAndGroundSynergyResponse filters out hallucinated partner IDs and sorts by score', () => {
  const grounded = validateAndGroundSynergyResponse(
    {
      resumoEstrategico: 'Plano recomendado para empreender em Santiago com segurança.',
      etapaSugerida: 'Preparação documental e estrutura societária',
      recomendacoes: [
        {
          partnerId: 'part_fake_hallucinated',
          scoreSinergia: 99,
          prioridade: 'Essencial',
          justificativa: 'Parceiro inventado',
          momentoIdeal: 'Agora',
          proximoPasso: 'Contato',
        },
        {
          partnerId: 'part_imob',
          scoreSinergia: 84,
          prioridade: 'Recomendado',
          justificativa: 'Apoia na busca de moradia em Providencia.',
          momentoIdeal: '30 dias antes da chegada',
          proximoPasso: 'Definir orçamento mensal',
        },
        {
          partnerId: 'part_contab',
          scoreSinergia: 112, // should clamp to 100
          prioridade: 'Essencial',
          justificativa: 'Essencial para abertura da SpA e RUT.',
          momentoIdeal: 'Imediato',
          proximoPasso: 'Agendar reunião de enquadramento',
        },
      ],
    },
    SAMPLE_PARTNERS,
  );

  assert.ok(grounded);
  assert.equal(grounded.recomendacoes.length, 2);
  assert.equal(grounded.recomendacoes[0].partnerId, 'part_contab');
  assert.equal(grounded.recomendacoes[0].scoreSinergia, 100);
  assert.equal(grounded.recomendacoes[1].partnerId, 'part_imob');
  assert.equal(grounded.recomendacoes[1].scoreSinergia, 84);
});

test('analyzePartnerSynergy returns 503 error instead of fake fallback when GEMINI_API_KEY is missing', async () => {
  const prev = process.env.GEMINI_API_KEY;
  const prev2 = process.env.GOOGLE_API_KEY;
  const prev3 = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const prev4 = process.env.API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.API_KEY;

  try {
    const res = await analyzePartnerSynergy({
      profile: {
        objetivo: 'Residência Mercosul',
        etapaAtual: 'No Brasil',
        composicaoFamiliar: 'Individual',
        urgencia: 'Imediata',
        locale: 'pt-BR',
      },
      partners: SAMPLE_PARTNERS,
      apiKey: '',
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.statusCode, 503);
      assert.equal(res.code, 'missing_api_key');
    }
  } finally {
    if (prev !== undefined) process.env.GEMINI_API_KEY = prev;
    if (prev2 !== undefined) process.env.GOOGLE_API_KEY = prev2;
    if (prev3 !== undefined) process.env.GOOGLE_GENERATIVE_AI_API_KEY = prev3;
    if (prev4 !== undefined) process.env.API_KEY = prev4;
  }
});

test('analyzePartnerSynergy parses valid Gemini JSON response and propagates upstream errors honestly', async () => {
  const success = await analyzePartnerSynergy({
    profile: {
      objetivo: 'Empreender no Chile',
      etapaAtual: 'Documentação no Brasil',
      composicaoFamiliar: 'Casal',
      urgencia: '1 a 3 meses',
      locale: 'pt-BR',
    },
    partners: SAMPLE_PARTNERS,
    model: 'gemini-4-hydrogen',
    generateFn: async (args) => {
      assert.equal(args.model, 'gemini-4-hydrogen');
      return {
        text: JSON.stringify({
          resumoEstrategico: 'Foque primeiro na tradução das certidões e na abertura da SpA.',
          etapaSugerida: 'Fase 1: Documentação & Estrutura Societária',
          recomendacoes: [
            {
              partnerId: 'part_trad',
              scoreSinergia: 95,
              prioridade: 'Essencial',
              justificativa: 'Acelera tradução juramentada obrigatória das certidões.',
              momentoIdeal: 'Antes do envio ao SERMIG',
              proximoPasso: 'Enviar PDFs das certidões para orçamento',
            },
            {
              partnerId: 'part_contab',
              scoreSinergia: 91,
              prioridade: 'Essencial',
              justificativa: 'Estrutura a SpA no Chile e o RUT de investidor.',
              momentoIdeal: 'Em paralelo à documentação',
              proximoPasso: 'Validar objeto social e capital inicial',
            },
          ],
        }),
        candidates: [{ finishReason: 'STOP' }],
      } as unknown as GenerateContentResponse;
    },
  });

  assert.equal(success.ok, true);
  if (success.ok) {
    assert.equal(success.data.recomendacoes.length, 2);
    assert.equal(success.data.recomendacoes[0].partnerId, 'part_trad');
    assert.equal(success.data.modeloUsado, 'gemini-4-hydrogen');
  }

  const upstreamFailure = await analyzePartnerSynergy({
    profile: {
      objetivo: 'Empreender no Chile',
      etapaAtual: 'Documentação no Brasil',
      composicaoFamiliar: 'Casal',
      urgencia: '1 a 3 meses',
      locale: 'es-CL',
    },
    partners: SAMPLE_PARTNERS,
    generateFn: async () => {
      const err = new Error('503 Service Unavailable') as Error & { status?: number };
      err.status = 503;
      throw err;
    },
  });

  assert.equal(upstreamFailure.ok, false);
  if (!upstreamFailure.ok) {
    assert.equal(upstreamFailure.statusCode, 502);
    assert.match(upstreamFailure.error, /alta demanda/i);
  }
});

test('analyzePartnerSynergy fails over to fallback model when primary returns 503', async () => {
  const modelsTried: string[] = [];
  const res = await analyzePartnerSynergy({
    profile: {
      objetivo: 'Empreender no Chile',
      etapaAtual: 'Documentação no Brasil',
      composicaoFamiliar: 'Casal',
      urgencia: '1 a 3 meses',
      locale: 'pt-BR',
    },
    partners: SAMPLE_PARTNERS,
    model: 'gemini-4-hydrogen',
    fallbackModel: 'gemini-3.1-flash-lite',
    generateFn: async (args) => {
      modelsTried.push(args.model);
      if (args.model === 'gemini-4-hydrogen') {
        const err = new Error('503 UNAVAILABLE') as Error & { status?: number };
        err.status = 503;
        throw err;
      }
      return {
        text: JSON.stringify({
          resumoEstrategico: 'Plano via modelo reserva.',
          etapaSugerida: 'Fase 1',
          recomendacoes: [
            {
              partnerId: 'part_trad',
              scoreSinergia: 92,
              prioridade: 'Essencial',
              justificativa: 'Traduções oficiais.',
              momentoIdeal: 'Imediato',
              proximoPasso: 'Solicitar orçamento',
            },
          ],
        }),
        candidates: [{ finishReason: 'STOP' }],
      } as unknown as GenerateContentResponse;
    },
  });

  assert.equal(res.ok, true);
  assert.deepEqual(modelsTried, ['gemini-4-hydrogen', 'gemini-3.1-flash-lite']);
  if (res.ok) {
    assert.equal(res.data.modeloUsado, 'gemini-3.1-flash-lite');
  }
});
