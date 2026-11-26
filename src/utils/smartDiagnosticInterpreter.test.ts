import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSmartDiagnosticBrief,
  computeLiveDiagnosticIntelligence,
  parseFreeTextCaseToAnswers,
} from './smartDiagnosticInterpreter.ts';
import { runDiagnosticEngine } from './diagnosticEngine.ts';
import { SEED_LEGAL_SOURCES, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS } from '../data/seeds.ts';
import type { DiagnosticAnswers } from '../types/domain.ts';

const BASE_ANSWERS: DiagnosticAnswers = {
  nome: 'Carlos Teste',
  whatsapp: '+55 (11) 98888-7777',
  email: 'carlos@teste.com',
  cidadeUf: 'São Paulo - SP',
  origem: 'Site',
  localizacao: 'No Brasil',
  faixaEtaria: 'maior_18',
  mesesResidenciaChile: 0,
  entradaRecenteChileTurista: false,
  nacionalidadeBrasileira: true,
  possuiSegundaNacionalidade: false,
  segundaNacionalidadeQual: '',
  passaporteStatus: 'valido',
  passaporteValidadeMeses: 24,
  vinculoFamiliarChile: false,
  vinculoTipo: 'Cônjuge/União Civil',
  vinculoFormalizado: false,
  composicaoFamiliar: 'individual',
  pessoasFamilia: [],
  objetivo: 'explorar',
  possuiOfertaTrabalhoFormal: false,
  possuiMatriculaReconhecida: false,
  possuiRendaPassiva: false,
  faixaRendaMensalUsd: '1000_2500',
  possuiCapitalComprovadoOrigem: false,
  titularTemResidenciaChile: false,
  overstay: false,
  ordenAbandono: false,
  rejeicaoAnterior: false,
  antecedentesCriminais: false,
  riscoConsultaConsultor: [],
  familiaAcompanhante: false,
  quantidadeDependentes: 0,
  prazoPretendido: '1 a 3 meses',
  documentosJaPossui: [],
  lgpdAceito: true,
  lgpdVersao: '1.0',
};

describe('smartDiagnosticInterpreter — dynamic NLP parser & live intelligence', () => {
  it('extracts location, nationality, family dependents, objective and timeline from a Brazilian family description', () => {
    const parsed = parseFreeTextCaseToAnswers(
      'Sou brasileiro, moro em São Paulo, quero me mudar para Santiago em 2 meses com minha esposa e 2 filhos pelo Mercosul.',
    );

    assert.equal(parsed.patch.localizacao, 'No Brasil');
    assert.equal(parsed.patch.nacionalidadeBrasileira, true);
    assert.equal(parsed.patch.objetivo, 'explorar');
    assert.equal(parsed.patch.familiaAcompanhante, true);
    assert.equal(parsed.patch.composicaoFamiliar, 'familia_com_filhos');
    assert.equal(parsed.patch.quantidadeDependentes, 3);
    assert.equal(parsed.patch.prazoPretendido, '1 a 3 meses');
    assert.ok(parsed.matchedCount >= 4);
  });

  it('detects tourist status + formalized Chilean spouse + passport expiration warning accurately', () => {
    const parsed = parseFreeTextCaseToAnswers(
      'Estou no Chile como turista, sou casado oficialmente com chilena, mas meu passaporte vence em 5 meses.',
    );

    assert.equal(parsed.patch.localizacao, 'No Chile como turista');
    assert.equal(parsed.patch.vinculoFamiliarChile, true);
    assert.equal(parsed.patch.vinculoFormalizado, true);
    assert.equal(parsed.patch.familiarStatusChile, 'chileno');
    assert.equal(parsed.patch.passaporteStatus, 'valido');
    assert.equal(parsed.patch.passaporteValidadeMeses, 5);
  });

  it('detects formal job offer and passive retirement income USD bracket cleanly', () => {
    const job = parseFreeTextCaseToAnswers(
      'Moro no Brasil, recebi proposta de trabalho com contrato formal de uma empresa chilena para ir em 4 meses.',
    );
    assert.equal(job.patch.objetivo, 'trabalho_formal');
    assert.equal(job.patch.possuiOfertaTrabalhoFormal, true);
    assert.equal(job.patch.prazoPretendido, '3 a 6 meses');

    const retired = parseFreeTextCaseToAnswers(
      'Sou brasileiro aposentado com renda passiva de 3000 dólares por mês e passaporte vencido.',
    );
    assert.equal(retired.patch.objetivo, 'aposentado_renda');
    assert.equal(retired.patch.possuiRendaPassiva, true);
    assert.equal(retired.patch.faixaRendaMensalUsd, 'acima_2500');
    assert.equal(retired.patch.passaporteStatus, 'vencido');
  });

  it('computes live score delta, top-3 route race, and bottleneck optimizer cleanly', () => {
    const baseResult = runDiagnosticEngine(
      BASE_ANSWERS,
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      SEED_LEGAL_SOURCES,
    );

    const touristAnswers: DiagnosticAnswers = {
      ...BASE_ANSWERS,
      localizacao: 'No Chile como turista',
      passaporteValidadeMeses: 4,
    };
    const touristResult = runDiagnosticEngine(
      touristAnswers,
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      SEED_LEGAL_SOURCES,
    );

    const intel = computeLiveDiagnosticIntelligence(touristAnswers, touristResult, {
      score: Math.round(baseResult.viabilidade.total),
      routeCode: baseResult.recomendada?.visa.codigo || '15',
      routeName: baseResult.recomendada?.visa.nomePortugues || 'Acordo Mercosul',
    });

    assert.ok(intel.scoreDelta < 0, 'Expected negative score delta when switching to tourist with expiring passport');
    assert.ok(intel.impactBanner !== null, 'Expected live impact banner to explain score change');
    assert.ok(intel.routeRace.length >= 2, 'Expected live top competing routes');
    assert.equal(intel.routeRace[0].isLeader, true);
    assert.ok(intel.bottleneckOptimizer !== null, 'Expected bottleneck optimizer recommendation');
    assert.ok(intel.bottleneckOptimizer!.potentialBoostPts > 0);
  });

  it('builds a grounded strategic executive brief matching the deterministic engine output', () => {
    const res = runDiagnosticEngine(
      BASE_ANSWERS,
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      SEED_LEGAL_SOURCES,
    );
    const brief = buildSmartDiagnosticBrief(BASE_ANSWERS, res);

    assert.ok(brief.headline.includes(String(Math.round(res.viabilidade.total))));
    assert.ok(brief.whyLeaderWon.length > 20);
    assert.ok(brief.topStrength.pillar.length > 0);
    assert.equal(brief.smartNextMoves.length, 3);
  });
});
