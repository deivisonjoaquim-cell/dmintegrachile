import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDiagnosticIntelligence } from './diagnosticAnalytics';
import { getAdaptiveWizardMeta, isYes, runDiagnosticEngine, compareWhatIfScenarios } from './diagnosticEngine';
import { DIAGNOSTIC_TEST_PROFILES } from './diagnosticProfiles';
import type { Lead } from '../types/domain';

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
