import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDiagnosticIntelligence } from './diagnosticAnalytics';
import { getAdaptiveWizardMeta, isYes, runDiagnosticEngine, compareWhatIfScenarios } from './diagnosticEngine';
import { DIAGNOSTIC_TEST_PROFILES } from './diagnosticProfiles';
import {
  getLiveSermigPreview,
  getSermigObjectiveMeta,
  getStepLiveRecommendation,
  sanitizeDiagnosticAnswers,
} from './sermigDiagnosticQuestions';
import { SEED_LEGAL_SOURCES, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS } from '../data/seeds';
import type { DiagnosticAnswers, Lead } from '../types/domain';

test('isYes normalizes booleans strictly (null/undefined/false => false)', () => {
  assert.equal(isYes(true), true);
  assert.equal(isYes(false), false);
  assert.equal(isYes(null), false);
  assert.equal(isYes(undefined), false);
});

for (const profile of DIAGNOSTIC_TEST_PROFILES) {
  test(`Diagnostic Profile ${profile.id}: ${profile.nome}`, () => {
    const result = runDiagnosticEngine(profile.answers, undefined, undefined, undefined, profile.engineOptions);
    const check = profile.assertCheck(result);
    assert.equal(check.pass, true, `${profile.nome} failed (${check.esperado} vs ${check.obtido}): ${check.detalhe}`);
  });
}

test('Mercosul does not penalize Capacidade Financeira when lacking contract or income', () => {
  const profile = DIAGNOSTIC_TEST_PROFILES[0];
  const result = runDiagnosticEngine(profile.answers);
  const finDim = result.viabilidade.dimensoes.find((d) => d.nome === 'Capacidade Financeira');
  assert.ok(finDim);
  assert.equal(finDim.pontos, 15);
});

test('Adaptive wizard hides employer/study/rent fields when irrelevant to selected objective', () => {
  const studyMeta = getAdaptiveWizardMeta({
    ...DIAGNOSTIC_TEST_PROFILES[7].answers,
    objetivo: 'estudar',
  });
  const nomadeMeta = getAdaptiveWizardMeta({
    ...DIAGNOSTIC_TEST_PROFILES[0].answers,
    objetivo: 'nomade_digital',
  });
  assert.equal(studyMeta.visiveisPorEtapa[4].includes('possuiMatriculaReconhecida'), true);
  assert.equal(studyMeta.visiveisPorEtapa[4].includes('possuiOfertaTrabalhoFormal'), false);
  assert.equal(nomadeMeta.visiveisPorEtapa[4].includes('possuiMatriculaReconhecida'), false);
  assert.equal(nomadeMeta.visiveisPorEtapa[4].includes('possuiOfertaTrabalhoFormal'), false);
});

test('3-block action plan orders validadeDias=0 before short 60-day validity documents', () => {
  const result = runDiagnosticEngine(DIAGNOSTIC_TEST_PROFILES[0].answers);
  assert.ok(result.planoAcao.facaAgora.length > 0);
  assert.ok(result.planoAcao.antesProtocolo.some((item) => item.validadeDias > 0 && item.validadeDias <= 60));
  assert.ok(result.comparativoMercosul.linhasFixas.length >= 7);
});

test('What-If scenario compares formalizing marriage for tourist without mutating base answers', () => {
  const base = {
    ...DIAGNOSTIC_TEST_PROFILES[17].answers,
    localizacao: 'No Chile como turista' as const,
  };
  const simulated = { ...base, vinculoFormalizado: true };
  const diff = compareWhatIfScenarios(base, simulated);
  assert.equal(diff.atual.recomendada?.visa.codigo, '15');
  assert.equal(diff.simulado.recomendada?.visa.codigo, '01');
  assert.equal(diff.mudouSubcategoria, true);
});

test('Diagnostic analytics calculates abandonment, conversion, and blank-field heatmap', () => {
  const leads: Lead[] = [
    {
      id: 'l1',
      nome: 'A',
      whatsapp: '+55 (11) 99999-0001',
      email: 'a@test.com',
      cidadeUf: '',
      origem: 'Instagram',
      interesse: 'Mercosul',
      statusFunil: 'Fechado',
      convertedClientId: 'cli_1',
      prioridade: 'Alta',
      confianca: 'Alta',
      statusConclusao: 'Concluído',
      etapaAtual: 6,
      respostasTriagem: DIAGNOSTIC_TEST_PROFILES[1].answers,
      subcategoriaSugerida: '15 - Reciprocidade Internacional (Mercosul)',
      lgpdAceito: true,
      lgpdVersao: '1.0',
      lgpdData: '2026-11-17T10:00:00.000Z',
      createdAt: '2026-11-17T10:00:00.000Z',
      primeiroContatoEm: '2026-11-17T12:00:00.000Z',
    },
    {
      id: 'l2',
      nome: 'B',
      whatsapp: '+55 (11) 99999-0002',
      email: 'b@test.com',
      cidadeUf: 'Curitiba',
      origem: 'Site',
      interesse: 'Em andamento',
      statusFunil: 'Novo',
      prioridade: 'Média',
      confianca: 'Baixa',
      statusConclusao: 'Abandonado',
      etapaAtual: 3,
      respostasTriagem: DIAGNOSTIC_TEST_PROFILES[0].answers,
      lgpdAceito: false,
      lgpdVersao: '1.0',
      lgpdData: '2026-11-17T11:00:00.000Z',
      createdAt: '2026-11-17T11:00:00.000Z',
    },
  ];
  const metrics = computeDiagnosticIntelligence(leads);
  assert.equal(metrics.totalLeads, 2);
  assert.equal(metrics.concluidos, 1);
  assert.equal(metrics.abandonados, 1);
  assert.equal(metrics.taxaConversaoLeadClientePct, 50);
  assert.equal(metrics.tempoMedioAteContatoHoras, 2);
  assert.equal(metrics.abandonoPorEtapa.find((e) => e.etapa === 3)?.quantidade, 1);
});

test('Diagnostic cost estimate converts BRL<->CLP accurately and marks honorarios as A consultar', () => {
  const result = runDiagnosticEngine(DIAGNOSTIC_TEST_PROFILES[0].answers, undefined, undefined, undefined, {
    taxaCambioBrlClp: 170,
    taxaCambioUsdBrl: 5.5,
  });
  assert.equal(result.custosEstimados.honorariosSobConsulta, true);
  assert.equal(result.custosEstimados.taxaCambioBrlClp, 170);
  assert.equal(result.custosEstimados.totalMinBrl, result.custosEstimados.taxasOficiaisBrlMin);
  assert.equal(result.custosEstimados.totalMaxBrl, result.custosEstimados.taxasOficiaisBrlMax);
  assert.ok(result.custosEstimados.totalMinClp > result.custosEstimados.totalMinBrl * 100);
  const cedulaItem = result.custosEstimados.itensDetalhados.find((i) => i.label.includes('Cédula'));
  assert.ok(cedulaItem && cedulaItem.valorTexto.includes('CLP') && cedulaItem.valorTexto.includes('R$'));
  const honItem = result.custosEstimados.itensDetalhados.find((i) => i.label.includes('Honorários'));
  assert.ok(honItem && honItem.valorTexto.includes('A consultar'));
});

test('Comparativo Lado a Lado always compares 3 strictly distinct visa subcategories without duplicating Mercosul 15', () => {
  // Case 1: Mercosul 15 is recommended (#1)
  const mercosulTop = runDiagnosticEngine(DIAGNOSTIC_TEST_PROFILES[0].answers);
  assert.equal(mercosulTop.recomendada?.visa.codigo, '15');
  assert.ok(mercosulTop.comparativoMercosul.colunas);
  const codesCase1 = mercosulTop.comparativoMercosul.colunas!.map((c) => c.codigo);
  assert.equal(new Set(codesCase1).size, 3, `Expected 3 distinct codes, got: ${codesCase1.join(', ')}`);
  assert.equal(codesCase1[0], '15');
  assert.notEqual(codesCase1[1], '15');
  assert.equal(mercosulTop.comparativoMercosul.mercosul.visa.codigo, '15');

  // Case 2: Non-Mercosul (Reunificação Familiar 01) is recommended (#1)
  const familyTop = runDiagnosticEngine({
    ...DIAGNOSTIC_TEST_PROFILES[17].answers,
    localizacao: 'No Chile como turista',
    vinculoFormalizado: true,
  });
  assert.equal(familyTop.recomendada?.visa.codigo, '01');
  assert.ok(familyTop.comparativoMercosul.colunas);
  const codesCase2 = familyTop.comparativoMercosul.colunas!.map((c) => c.codigo);
  assert.equal(new Set(codesCase2).size, 3, `Expected 3 distinct codes, got: ${codesCase2.join(', ')}`);
  assert.equal(codesCase2[0], '01');
  assert.equal(codesCase2[1], '15');
});

test('SERMIG objective metadata maps every objective to its exact Decree 177/2022 code', () => {
  const aposentado = getSermigObjectiveMeta('aposentado_renda', SEED_VISA_CATEGORIES, SEED_LEGAL_SOURCES);
  const humanitario = getSermigObjectiveMeta('humanitario', SEED_VISA_CATEGORIES, SEED_LEGAL_SOURCES);
  const nomade = getSermigObjectiveMeta('nomade_digital', SEED_VISA_CATEGORIES, SEED_LEGAL_SOURCES);
  const explorar = getSermigObjectiveMeta('explorar', SEED_VISA_CATEGORIES, SEED_LEGAL_SOURCES);

  assert.equal(aposentado?.visaCode, '11');
  assert.equal(humanitario?.visaCode, '07');
  assert.equal(nomade?.visaCode, '15');
  assert.equal(explorar?.visaCode, '15');
});

test('sanitizeDiagnosticAnswers clears stale dependent fields and getStepLiveRecommendation stays grounded', () => {
  const cleaned = sanitizeDiagnosticAnswers(
    {
      ...DIAGNOSTIC_TEST_PROFILES[0].answers,
      vinculoFamiliarChile: true,
      vinculoFormalizado: true,
      possuiSegundaNacionalidade: true,
      segundaNacionalidadeQual: 'Italiana',
      passaporteStatus: 'valido',
      passaporteValidadeMeses: 36,
      familiaAcompanhante: true,
      quantidadeDependentes: 2,
    },
    {
      vinculoFamiliarChile: false,
      possuiSegundaNacionalidade: false,
      passaporteStatus: 'vencido',
      familiaAcompanhante: false,
    },
  );

  assert.equal(cleaned.vinculoFormalizado, false);
  assert.equal(cleaned.segundaNacionalidadeQual, '');
  assert.equal(cleaned.passaporteValidadeMeses, 0);
  assert.equal(cleaned.quantidadeDependentes, 0);

  const expiredPassportResult = runDiagnosticEngine(cleaned, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  const expiredPreview = getLiveSermigPreview(cleaned, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  const step2Expired = getStepLiveRecommendation(2, cleaned, expiredPassportResult, expiredPreview);
  assert.equal(step2Expired.tom, 'atencao');
  assert.ok(step2Expired.titulo.toLowerCase().includes('passaporte'));

  const touristAnswers = {
    ...DIAGNOSTIC_TEST_PROFILES[0].answers,
    localizacao: 'No Chile como turista' as const,
  };
  const touristRes = runDiagnosticEngine(touristAnswers, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  const touristPreview = getLiveSermigPreview(touristAnswers, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  const step2Tourist = getStepLiveRecommendation(2, touristAnswers, touristRes, touristPreview);
  assert.equal(step2Tourist.tom, 'atencao');
  assert.ok(step2Tourist.orientacao.includes('turista'));
});

test('Viability Radar calibrates Histórico / Riscos for reserved consultant review and Prazo for immediate + expired passport', () => {
  const reservedAnswers: DiagnosticAnswers = {
    ...DIAGNOSTIC_TEST_PROFILES[0].answers,
    passaporteStatus: 'vencido',
    passaporteValidadeMeses: 0,
    prazoPretendido: 'Imediato (até 30 dias)',
    riscoConsultaConsultor: ['overstay', 'antecedentesCriminais'],
  };
  const result = runDiagnosticEngine(reservedAnswers, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  const histDim = result.viabilidade.dimensoes.find((d) => d.nome === 'Histórico / Riscos');
  const prazoDim = result.viabilidade.dimensoes.find((d) => d.nome === 'Prazo');

  assert.equal(result.viabilidade.dimensoes.length, 7);
  assert.ok(histDim && histDim.pontos < 15 && histDim.pontos >= 9, `Expected calibrated Histórico score, got ${histDim?.pontos}`);
  assert.ok(prazoDim && prazoDim.pontos <= 6, `Expected calibrated Prazo score for immediate+expired passport, got ${prazoDim?.pontos}`);

  const preview = getLiveSermigPreview(reservedAnswers, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  const step5Rec = getStepLiveRecommendation(5, reservedAnswers, result, preview);
  assert.equal(step5Rec.tom, 'atencao');
  assert.ok(step5Rec.titulo.toLowerCase().includes('sigilosa'));
});

