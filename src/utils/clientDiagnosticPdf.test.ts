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

test('buildClientDiagnosticDossierDoc gera PDF vetorial de 3 páginas com nome sanitizado, notas do consultor e assinatura digital', () => {
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
    consultantNotes: {
      text: 'Antecedentes da Polícia Federal devem ser emitidos após confirmação da janela de protocolo no SERMIG.',
      recommendation: 'Priorizar Apostila de Haia em cartório habilitado e conferência do passaporte.',
      authorName: 'Daniela Mendes',
      authorRole: 'Consultora de Imigração · Visto e RUT',
    },
    digitalSignature: {
      signerName: 'Daniela Mendes',
      signerRole: 'Responsável Técnica · D&M Integra Chile',
      signedAt: '2026-11-28T12:00:00.000Z',
    },
  });

  assert.equal(doc.getNumberOfPages(), 3, 'O Dossiê de Imigração oficial deve conter exatamente 3 páginas (incluindo Notas do Consultor e Assinatura Digital)');
  assert.match(
    filename,
    /^Dossie-Imigracao-DM-Integra-Joao-Alvares-Mendes-DM-TEST-001\.pdf$/,
    'O nome do arquivo PDF deve incluir a marca, nome sanitizado e protocolo',
  );

  const rawPdf = doc.output('datauristring');
  assert.ok(rawPdf.startsWith('data:application/pdf'), 'A saída deve ser um documento PDF válido');
  const bytes = doc.output('arraybuffer');
  assert.ok(bytes.byteLength > 3000, 'O PDF gerado deve possuir conteúdo vetorial completo nas 3 páginas');
});

test('buildClientDiagnosticDossierDoc funciona em modo resumo básico (sem result bruto) gerando 3 páginas válidas', () => {
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

  assert.equal(doc.getNumberOfPages(), 3);
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

  // Gera Dossiê PDF executivo com Gráfico Radar vetorial comparando perfil base e cenário simulado
  const baseSummary = buildBasicDiagnosticSummary(baseResult, touristBase);
  const simSummary = buildBasicDiagnosticSummary(simulatedResult, simulatedAnswers);
  const { doc: simPdfDoc, filename: simFilename } = buildClientDiagnosticDossierDoc({
    empresa: DEFAULT_EMPRESA_CONFIG,
    summary: baseSummary,
    result: baseResult,
    answers: touristBase,
    protocolo: 'DM-RADAR-SIM',
    simulatedDimensions: simSummary.dimensoes || null,
  });

  assert.equal(simPdfDoc.getNumberOfPages(), 3, 'O dossiê com gráfico radar, simulação, notas e assinatura digital deve manter 3 páginas A4');
  assert.match(simFilename, /DM-RADAR-SIM\.pdf$/);
  assert.ok(simPdfDoc.output('arraybuffer').byteLength > 3200, 'O PDF com radar vetorial, 4 fases, notas e assinatura deve conter geometria completa');
});

test('buildClientDiagnosticDossierDoc mantém exatamente 3 páginas com perfil complexo (família, riscos, custos, resumo IA e notas)', () => {
  const complexAnswers = createBaseAnswers({
    nome: 'Carlos Eduardo Pereira & Família',
    localizacao: 'No Chile como turista',
    passaporteStatus: 'vencido',
    passaporteValidadeMeses: 3,
    overstay: true,
    familiaAcompanhante: true,
    composicaoFamiliar: 'familia_com_filhos',
    quantidadeDependentes: 2,
    objetivo: 'trabalho_formal',
    possuiOfertaTrabalhoFormal: true,
  });

  const result = runDiagnosticEngine(
    complexAnswers,
    SEED_VISA_CATEGORIES,
    SEED_VISA_REQUIREMENTS,
    SEED_LEGAL_SOURCES,
    DEFAULT_EMPRESA_CONFIG,
  );

  const { doc, filename } = buildClientDiagnosticDossierDoc({
    empresa: DEFAULT_EMPRESA_CONFIG,
    result,
    answers: complexAnswers,
    protocolo: 'DM-COMPLEX-99',
    aiDraft: {
      resumoExecutivo:
        'Perfil com demanda de regularização prévia antes do protocolo oficial no SERMIG e emissão coordenada de certidões familiares.',
    },
    consultantNotes: {
      text: 'Caso familiar com necessidade de renovação do passaporte antes do pedido no SERMIG e acompanhamento coordenado da emissão dos RUTs.',
    },
  });

  assert.equal(doc.getNumberOfPages(), 3, 'Mesmo com alertas críticos, riscos, família e notas, o PDF deve permanecer em 3 páginas');
  assert.match(filename, /^Dossie-Imigracao-DM-Integra-Carlos-Eduardo-Pereira-Familia-DM-COMPLEX-99\.pdf$/);
  assert.ok(doc.output('arraybuffer').byteLength > 3400);
});

test('buildClientDiagnosticDossierDoc suporta idioma es-CL e opção hideCosts preservando 3 páginas', () => {
  const answers = createBaseAnswers({ nome: 'Sofía Martínez' });
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
    protocolo: 'CL-2026-01',
    locale: 'es-CL',
    hideCosts: true,
  });

  assert.equal(doc.getNumberOfPages(), 3, 'A versão es-CL sem exibição de custos deve manter exatamente 3 páginas');
  assert.match(filename, /^Dossier-Inmigracion-DM-Integra-Sofia-Martinez-CL-2026-01\.pdf$/);
  assert.ok(doc.output('datauristring').startsWith('data:application/pdf'));
});


