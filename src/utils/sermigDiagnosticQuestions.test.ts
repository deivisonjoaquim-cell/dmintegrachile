import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEED_LEGAL_SOURCES,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type { DiagnosticAnswers } from '../types/domain';
import {
  detectDiagnosticContradictions,
  isMercosulEligibleNationality,
  runDiagnosticEngine,
} from './diagnosticEngine';
import {
  formatLegalCitationInline,
  formatLegalSourceWithJurisdiction,
  getJurisdictionLabel,
  getJurisdictionShortLabel,
} from './legalJurisdiction';
import {
  getDynamicDocumentOptions,
  getLiveSermigPreview,
  getResidentSubcategoryOptions,
  getSermigObjectiveMeta,
  sanitizeDiagnosticAnswers,
} from './sermigDiagnosticQuestions';

function baseAnswers(overrides: Partial<DiagnosticAnswers> = {}): DiagnosticAnswers {
  return {
    nome: 'Teste SERMIG',
    whatsapp: '+55 11 99999-0000',
    email: 'teste@example.com',
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
    ...overrides,
  };
}

test('sanitizeDiagnosticAnswers limpa campos órfãos ao mudar localização, passaporte, família e objetivo', () => {
  const residente = baseAnswers({
    localizacao: 'No Chile com residência',
    mesesResidenciaChile: 26,
    residenteSubcategoriaAtual: '15',
    residenteVenceEmDias: 'entre_90_e_10',
    residenteMesesForaUltimoAno: 2,
  });

  const mudouParaBrasil = sanitizeDiagnosticAnswers(residente, { localizacao: 'No Brasil' });
  assert.equal(mudouParaBrasil.mesesResidenciaChile, 0);
  assert.equal(mudouParaBrasil.residenteSubcategoriaAtual, undefined);
  assert.equal(mudouParaBrasil.residenteVenceEmDias, undefined);
  assert.equal(mudouParaBrasil.residenteMesesForaUltimoAno, undefined);

  const semPassaporte = sanitizeDiagnosticAnswers(mudouParaBrasil, { passaporteStatus: 'nao_possui' });
  assert.equal(semPassaporte.passaporteValidadeMeses, 0);

  const comFamilia = baseAnswers({
    familiaAcompanhante: true,
    composicaoFamiliar: 'casal',
    quantidadeDependentes: 2,
    pessoasFamilia: [{ nome: 'Cônjuge', papel: 'Dependente', parentesco: 'Cônjuge', nacionalidadeBrasileira: true }],
  });
  const voltouSolo = sanitizeDiagnosticAnswers(comFamilia, { familiaAcompanhante: false });
  assert.equal(voltouSolo.composicaoFamiliar, 'individual');
  assert.equal(voltouSolo.quantidadeDependentes, 0);
  assert.equal(voltouSolo.pessoasFamilia?.length, 0);
});

test('isMercosulEligibleNationality reconhece segunda nacionalidade de país do Acordo Mercosul', () => {
  const argentino = baseAnswers({
    nacionalidadeBrasileira: false,
    possuiSegundaNacionalidade: true,
    segundaNacionalidadeQual: 'Argentina',
  });
  assert.equal(isMercosulEligibleNationality(argentino), true);

  const italiano = baseAnswers({
    nacionalidadeBrasileira: false,
    possuiSegundaNacionalidade: true,
    segundaNacionalidadeQual: 'Italiana',
  });
  assert.equal(isMercosulEligibleNationality(italiano), false);
});

test('solicitante individual não recebe pergunta de reunião sobre passaportes da família', () => {
  const solo = baseAnswers({ familiaAcompanhante: false, composicaoFamiliar: 'individual' });
  const diag = runDiagnosticEngine(solo, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  const asksFamilyPassports = diag.perguntasComplementares.some((q) =>
    q.toLowerCase().includes('todos os familiares'),
  );
  assert.equal(asksFamilyPassports, false);
});

test('getDynamicDocumentOptions adapta lista de documentos conforme subcategoria SERMIG líder', () => {
  const estudanteEstrangeiro = baseAnswers({
    nacionalidadeBrasileira: false,
    objetivo: 'estudar',
    possuiMatriculaReconhecida: true,
  });
  const docsEstudante = getDynamicDocumentOptions(
    estudanteEstrangeiro,
    SEED_VISA_CATEGORIES,
    SEED_VISA_REQUIREMENTS,
    SEED_LEGAL_SOURCES,
  );
  assert.match(docsEstudante.subcategoriaLabel, /03|Estudante/i);
  assert.ok(docsEstudante.options.length >= 2);

  const medico = baseAnswers({
    nacionalidadeBrasileira: false,
    objetivo: 'tratamento_medico',
    possuiCertificadoMedicoChile: true,
  });
  const docsMedico = getDynamicDocumentOptions(medico, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  assert.ok(docsMedico.options.some((o) => o.value.includes('Certificado médico')));
});

test('getLiveSermigPreview retorna prévia SERMIG com jurisdição explícita em fontesLegais', () => {
  const ans = baseAnswers({ localizacao: 'No Brasil', nacionalidadeBrasileira: true, objetivo: 'explorar' });
  const preview = getLiveSermigPreview(ans, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, SEED_LEGAL_SOURCES);
  assert.equal(preview.prontoParaPrevia, true);
  assert.equal(preview.subcategoriaLider?.codigo, '15');
  assert.equal(preview.regraProtocolo, 'exterior');
  assert.ok(preview.fontesLegais.length > 0);
  assert.ok(
    preview.fontesLegais.every(
      (f) =>
        f.jurisdicao === 'Legislação Chilena' ||
        f.jurisdicao === 'Legislação Brasileira' ||
        f.jurisdicao === 'Acordo Internacional (Mercosul · Brasil–Chile)',
    ),
  );
});

test('detectDiagnosticContradictions oferece fixPatch para correção em 1 clique', () => {
  const broken = baseAnswers({ passaporteStatus: 'valido', passaporteValidadeMeses: 0 });
  const conts = detectDiagnosticContradictions(broken);
  const pasZero = conts.find((c) => c.codigo === 'CONT-PAS-ZERO');
  assert.ok(pasZero);
  assert.ok(pasZero.fixPatch);
  assert.ok(pasZero.fixLabel);
  const fixed = sanitizeDiagnosticAnswers(broken, pasZero.fixPatch!);
  assert.equal(fixed.passaporteStatus, 'vencido');
});

test('getSermigObjectiveMeta e getResidentSubcategoryOptions retornam metadados consistentes da base SERMIG', () => {
  const metaInvest = getSermigObjectiveMeta('empreender_investir', SEED_VISA_CATEGORIES, SEED_LEGAL_SOURCES);
  assert.equal(metaInvest?.visaCode, '13');
  assert.match(metaInvest?.legalSourcesLabel || '', /Legislação Chilena/i);

  const subcats = getResidentSubcategoryOptions(SEED_VISA_CATEGORIES);
  assert.ok(subcats.some((s) => s.codigo === '15' && s.levaDefinitiva === true));
  assert.ok(subcats.some((s) => s.codigo === '04' && s.levaDefinitiva === false));
});

test('legalJurisdiction formata explicitamente Legislação Brasileira, Legislação Chilena e Acordo Mercosul', () => {
  assert.equal(getJurisdictionLabel('Brasil'), 'Legislação Brasileira');
  assert.equal(getJurisdictionLabel('Chile'), 'Legislação Chilena');
  assert.equal(getJurisdictionLabel('Mercosul'), 'Acordo Internacional (Mercosul · Brasil–Chile)');

  assert.equal(getJurisdictionShortLabel('Brasil'), 'Lei / Norma Brasileira');
  assert.equal(getJurisdictionShortLabel('Chile'), 'Lei / Norma Chilena');

  const formattedBr = formatLegalSourceWithJurisdiction({
    titulo: 'LGPD – Lei Geral de Proteção de Dados',
    numeroAno: 'Lei nº 13.709/2018',
    pais: 'Brasil',
  });
  assert.match(formattedBr, /^Legislação Brasileira · /);

  const formattedCl = formatLegalCitationInline({
    titulo: 'Ley Nº 21.325 – Ley de Migración y Extranjería',
    numeroAno: 'Ley Nº 21.325/2021',
    pais: 'Chile',
  });
  assert.equal(formattedCl, 'Ley Nº 21.325 (Legislação Chilena)');
});
