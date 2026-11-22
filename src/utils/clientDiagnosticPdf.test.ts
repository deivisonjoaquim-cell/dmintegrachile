import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSimulatedPublicAnswers } from '../components/diagnostic/PublicWhatIfSimulator';
import {
  DEFAULT_EMPRESA_CONFIG,
  SEED_LEGAL_SOURCES,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type { DiagnosticAnswers } from '../types/domain';
import { buildClientDiagnosticDossierDoc } from './clientDiagnosticPdf';
import { runDiagnosticEngine } from './diagnosticEngine';
import { buildBasicDiagnosticSummary } from './portalAccess';

function createBaseAnswers(overrides: Partial<DiagnosticAnswers> = {}): DiagnosticAnswers {
  return {
    nome: 'Mariana Souza',
    email: 'mariana.souza@example.com',
    whatsapp: '+55 (11) 98888-7777',
    cidadeUf: 'São Paulo / SP',
    origem: 'Site',
    localizacao: 'No Brasil',
    nacionalidadeBrasileira: true,
    possuiSegundaNacionalidade: false,
    passaporteStatus: 'valido',
    passaporteValidadeMeses: 24,
    vinculoFamiliarChile: false,
    vinculoFormalizado: false,
    objetivo: 'explorar',
    possuiOfertaTrabalhoFormal: false,
    contratoNotariadoEmpresaChilena: false,
    possuiMatriculaReconhecida: false,
    possuiRendaPassiva: false,
    possuiCapitalComprovadoOrigem: false,
    titularTemResidenciaChile: false,
    overstay: false,
    ordenAbandono: false,
    rejeicaoAnterior: false,
    antecedentesCriminais: false,
    familiaAcompanhante: false,
    composicaoFamiliar: 'individual',
    quantidadeDependentes: 0,
    prazoPretendido: '3 a 6 meses',
    documentosJaPossui: ['Passaporte válido', 'Certidão de Nascimento'],
    lgpdAceito: true,
    lgpdVersao: '1.0',
    ...overrides,
  };
}

test('buildClientDiagnosticDossierDoc gera PDF vetorial de 2 páginas com nome sanitizado a partir do resultado completo', () => {
  const answers = createBaseAnswers({ nome: 'João Álvares Mendes' });
  const result = runDiagnosticEngine(
    answers,
    SEED_VISA_CATEGORIES,
    SEED_VISA_REQUIREMENTS,
    SEED_LEGAL_SOURCES,
    DEFAULT_EMPRESA_CONFIG,
  );

  const { doc, filename } = buildClientDiagnosticDossierDoc({
    empresa: DEFAULT_EMPRESA_CONFIG,
    result,
    answers,
    protocolo: 'DM-TEST-001',
  });

  assert.equal(doc.getNumberOfPages(), 2, 'O dossiê oficial do cliente deve conter exatamente 2 páginas');
  assert.match(
    filename,
    /^Dossie-Diagnostico-DM-Integra-Joao-Alvares-Mendes-DM-TEST-001\.pdf$/,
    'O nome do arquivo PDF deve incluir a marca, nome sanitizado e protocolo',
  );

  const rawPdf = doc.output('datauristring');
  assert.ok(rawPdf.startsWith('data:application/pdf'), 'A saída deve ser um documento PDF válido');
  const bytes = doc.output('arraybuffer');
  assert.ok(bytes.byteLength > 2000, 'O PDF gerado deve possuir conteúdo vetorial completo');
});

test('buildClientDiagnosticDossierDoc funciona em modo resumo básico (sem result bruto) gerando 2 páginas válidas', () => {
  const answers = createBaseAnswers({
    localizacao: 'No Chile como turista',
    familiaAcompanhante: true,
    composicaoFamiliar: 'familia_com_filhos',
    quantidadeDependentes: 2,
  });
  const result = runDiagnosticEngine(
    answers,
    SEED_VISA_CATEGORIES,
    SEED_VISA_REQUIREMENTS,
    SEED_LEGAL_SOURCES,
    DEFAULT_EMPRESA_CONFIG,
  );
  const summary = buildBasicDiagnosticSummary(result, answers);

  const { doc, filename } = buildClientDiagnosticDossierDoc({
    empresa: DEFAULT_EMPRESA_CONFIG,
    summary,
    protocolo: 'DM-RESUMO-02',
  });

  assert.equal(doc.getNumberOfPages(), 2);
  assert.ok(filename.endsWith('.pdf'));
});

test('buildSimulatedPublicAnswers aplica cenários E-se sem mutar o perfil base e recalcula viabilidade real', () => {
  const touristBase = createBaseAnswers({
    localizacao: 'No Chile como turista',
    passaporteStatus: 'valido',
    passaporteValidadeMeses: 4,
    familiaAcompanhante: true,
    composicaoFamiliar: 'casal',
    quantidadeDependentes: 1,
  });

  const baseResult = runDiagnosticEngine(
    touristBase,
    SEED_VISA_CATEGORIES,
    SEED_VISA_REQUIREMENTS,
    SEED_LEGAL_SOURCES,
    DEFAULT_EMPRESA_CONFIG,
  );

  const simulatedAnswers = buildSimulatedPublicAnswers(touristBase, [
    'protocolar_brasil',
    'passaporte_12m',
    'aplicacao_individual',
  ]);

  // Verifica imutabilidade do objeto base
  assert.equal(touristBase.localizacao, 'No Chile como turista');
  assert.equal(touristBase.passaporteValidadeMeses, 4);
  assert.equal(touristBase.familiaAcompanhante, true);

  // Verifica aplicação das alavancas no cenário simulado
  assert.equal(simulatedAnswers.localizacao, 'No Brasil');
  assert.equal(simulatedAnswers.passaporteStatus, 'valido');
  assert.equal(simulatedAnswers.passaporteValidadeMeses, 24);
  assert.equal(simulatedAnswers.familiaAcompanhante, false);
  assert.equal(simulatedAnswers.quantidadeDependentes, 0);

  const simulatedResult = runDiagnosticEngine(
    simulatedAnswers,
    SEED_VISA_CATEGORIES,
    SEED_VISA_REQUIREMENTS,
    SEED_LEGAL_SOURCES,
    DEFAULT_EMPRESA_CONFIG,
  );

  assert.ok(
    simulatedResult.viabilidade.total > baseResult.viabilidade.total,
    `Protocolar do Brasil com passaporte renovado deve elevar a viabilidade (base=${baseResult.viabilidade.total}, sim=${simulatedResult.viabilidade.total})`,
  );
});
