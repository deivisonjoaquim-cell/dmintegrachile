import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer';
import {
  DEFAULT_DIAGNOSTIC_RULE_VERSION,
  DEFAULT_EMPRESA_CONFIG,
  SEED_LEGAL_SOURCES,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../../data/seeds';
import {
  DiagnosticoCompletoPdfDocument,
  DiagnosticoPdfDocument,
  DossieCasoPdfDocument,
  RelatorioProgressoPdfDocument,
  ResumoProcessoClientePdfDocument,
} from './ClientPortalPdfDocuments';
import type { Case, CaseDocument, Client, Deadline, Lead, Task, ViabilityAssessment } from '../../types/domain';
import { calcularTermometroDocumentos } from '../../utils/caseMetrics';
import { runDiagnosticEngine } from '../../utils/diagnosticEngine';
import { computeClientTaskProgress } from '../../utils/taskProgressMetrics';

const sampleClient: Client = {
  id: 'cli_test_1',
  nomeCompleto: 'Maria Fernanda Oliveira',
  cpf: '12345678900',
  email: 'maria@exemplo.com',
  whatsapp: '+55 11 99999-1234',
  portalLiberado: true,
  statusAcessoPortal: 'Liberado',
  createdAt: '2026-10-01T10:00:00.000Z',
};

const sampleCase: Case = {
  id: 'case_test_1',
  titulo: 'Residência Temporal Mercosul — Maria Fernanda',
  clientId: 'cli_test_1',
  tipoServico: 'Residência Temporal',
  etapaPipeline: 5,
  statusSermig: 'Não protocolado',
  portalLiberado: true,
  relatorioViabilidadeLiberado: true,
  prioridade: 'Alta',
  createdAt: '2026-10-02T10:00:00.000Z',
};

const sampleLead: Lead = {
  id: 'lead_test_1',
  nome: 'Maria Fernanda Oliveira',
  whatsapp: '+55 11 99999-1234',
  email: 'maria@exemplo.com',
  cidadeUf: 'São Paulo/SP',
  origem: 'Site',
  interesse: 'morar_brasil_chile',
  statusFunil: 'Fechado',
  prioridade: 'Alta',
  lgpdAceito: true,
  lgpdVersao: '1.0',
  lgpdData: '2026-10-01T09:00:00.000Z',
  subcategoriaSugerida: 'Acordo Mercosul',
  notaViabilidade: 92,
  confianca: 'Alta',
  versaoRegras: 'v2026.1',
  respostasTriagem: {
    nome: 'Maria Fernanda Oliveira',
    whatsapp: '+55 11 99999-1234',
    email: 'maria@exemplo.com',
    cidadeUf: 'São Paulo/SP',
    origem: 'Site',
    localizacao: 'No Brasil',
    nacionalidadeBrasileira: true,
    possuiSegundaNacionalidade: false,
    passaporteValidadeMeses: 24,
    vinculoFamiliarChile: false,
    vinculoFormalizado: null,
    objetivo: 'nomade_digital',
    possuiOfertaTrabalhoFormal: false,
    possuiMatriculaReconhecida: false,
    possuiRendaPassiva: false,
    possuiCapitalComprovadoOrigem: false,
    titularTemResidenciaChile: false,
    overstay: false,
    ordenAbandono: false,
    rejeicaoAnterior: false,
    antecedentesCriminais: false,
    familiaAcompanhante: false,
    quantidadeDependentes: 0,
    prazoPretendido: '1 a 3 meses',
    documentosJaPossui: ['Passaporte'],
    lgpdAceito: true,
    lgpdVersao: '1.0',
  },
  createdAt: '2026-10-01T09:00:00.000Z',
};

const sampleAssessment: ViabilityAssessment = {
  id: 'va_1',
  caseId: 'case_test_1',
  clientId: 'cli_test_1',
  versao: 1,
  enquadramentoLegal: 'Enquadramento elegível pelo Acordo sobre Residência do Mercosul.',
  elegibilidadeRiscos: 'Sem restrições impeditivas.',
  fundamentacaoNormativa: 'Ley 21.325 e Decreto Supremo 177.',
  recomendacoes: 'Emitir certidão de antecedentes e apostilar em até 60 dias antes do protocolo.',
  notaGeral: 92,
  rascunhoIa: false,
  liberadoAoCliente: true,
  autorNome: 'Equipe Técnica',
  createdAt: '2026-10-03T12:00:00.000Z',
};

const sampleDocs: CaseDocument[] = [
  {
    id: 'doc_1',
    caseId: 'case_test_1',
    clientId: 'cli_test_1',
    pessoa: 'Titular',
    nomeDocumento: 'Passaporte Válido',
    categoriaDoc: 'Identidade',
    etapaEsteira: '6 Aprovado para Protocolo',
    ordemEmissao: 1,
    status: 'Aprovado',
    validadeDias: 365,
    apostilado: false,
    traduzido: false,
    exigeApostila: false,
    exigeTraducao: false,
    obrigatorio: true,
    peso: 5,
    versao: 1,
  },
];

const sampleDeadlines: Deadline[] = [
  {
    id: 'dl_1',
    titulo: 'Protocolo SERMIG previsto',
    tipo: 'Prazo Legal 6 Meses SERMIG',
    dataLimite: '2026-12-20',
    caseId: 'case_test_1',
    clientId: 'cli_test_1',
    concluido: false,
  },
];

test('ClientPortalPdfDocuments renders valid PDF buffers for Diagnostico and Relatorio de Progresso', async () => {
  const diagBuf = await renderToBuffer(
    React.createElement(DiagnosticoPdfDocument, {
      empresa: DEFAULT_EMPRESA_CONFIG,
      client: sampleClient,
      dependents: [],
      activeCase: sampleCase,
      lead: sampleLead,
      assessments: [sampleAssessment],
    }) as React.ReactElement<DocumentProps>,
  );
  assert.ok(diagBuf.subarray(0, 5).toString('utf8').startsWith('%PDF-'));
  assert.ok(diagBuf.byteLength > 1000);

  const thermo = calcularTermometroDocumentos(sampleDocs, 100);
  const progBuf = await renderToBuffer(
    React.createElement(RelatorioProgressoPdfDocument, {
      empresa: DEFAULT_EMPRESA_CONFIG,
      client: sampleClient,
      dependents: [],
      activeCase: sampleCase,
      docs: sampleDocs,
      deadlines: sampleDeadlines,
      appointments: [],
      thermo,
      assessments: [sampleAssessment],
    }) as React.ReactElement<DocumentProps>,
  );
  assert.ok(progBuf.subarray(0, 5).toString('utf8').startsWith('%PDF-'));
  assert.ok(progBuf.byteLength > 1000);
});

test('DiagnosticoCompletoPdfDocument and DossieCasoPdfDocument render valid PDFs and respect hideCosts', async () => {
  const answers = sampleLead.respostasTriagem!;
  const result = runDiagnosticEngine(
    answers,
    SEED_VISA_CATEGORIES,
    SEED_VISA_REQUIREMENTS,
    SEED_LEGAL_SOURCES,
    {
      ruleVersion: DEFAULT_DIAGNOSTIC_RULE_VERSION,
      custosPadrao: DEFAULT_EMPRESA_CONFIG.custosPadrao,
    },
  );

  const fullPdf = await renderToBuffer(
    React.createElement(DiagnosticoCompletoPdfDocument, {
      empresa: DEFAULT_EMPRESA_CONFIG,
      result,
      answers,
      savedLeadId: sampleLead.id,
      hideCosts: false,
    }) as React.ReactElement<DocumentProps>,
  );
  assert.ok(fullPdf.subarray(0, 5).toString('utf8').startsWith('%PDF-'));
  assert.ok(fullPdf.byteLength > 1500);

  const assistantPdf = await renderToBuffer(
    React.createElement(DiagnosticoCompletoPdfDocument, {
      empresa: DEFAULT_EMPRESA_CONFIG,
      result,
      answers,
      savedLeadId: sampleLead.id,
      hideCosts: true,
    }) as React.ReactElement<DocumentProps>,
  );
  assert.ok(assistantPdf.subarray(0, 5).toString('utf8').startsWith('%PDF-'));
  assert.ok(assistantPdf.byteLength < fullPdf.byteLength);

  const thermo = calcularTermometroDocumentos(sampleDocs, 100);
  const dossiePdf = await renderToBuffer(
    React.createElement(DossieCasoPdfDocument, {
      empresa: DEFAULT_EMPRESA_CONFIG,
      client: sampleClient,
      activeCase: sampleCase,
      dependents: [],
      docs: sampleDocs,
      deadlines: sampleDeadlines,
      thermo,
      assessments: [sampleAssessment],
      filterMode: 'all',
    }) as React.ReactElement<DocumentProps>,
  );
  assert.ok(dossiePdf.subarray(0, 5).toString('utf8').startsWith('%PDF-'));
  assert.ok(dossiePdf.byteLength > 1000);
});

test('ResumoProcessoClientePdfDocument renders client-safe process status, tasks and submitted docs PDF', async () => {
  const sampleTasks: Task[] = [
    {
      id: 'task_1',
      titulo: 'Conferir passaporte e antecedentes PF',
      caseId: 'case_test_1',
      clientId: 'cli_test_1',
      prioridade: 'Alta',
      status: 'Concluída',
      prazo: '2026-10-15',
      createdAt: '2026-10-02T12:00:00.000Z',
    },
    {
      id: 'task_2',
      titulo: 'Protocolar pedido no SERMIG',
      caseId: 'case_test_1',
      clientId: 'cli_test_1',
      prioridade: 'Urgente',
      status: 'Em andamento',
      prazo: '2026-10-25',
      createdAt: '2026-10-05T12:00:00.000Z',
    },
  ];
  const submittedDoc: CaseDocument = {
    ...sampleDocs[0],
    arquivoNome: 'passaporte_maria.pdf',
    arquivoUrl: 'https://exemplo.invalid/passaporte.pdf',
    analisadoEm: '2026-10-10T14:00:00.000Z',
    versao: 2,
    historicoVersoes: [{ versao: 1, arquivoUrl: 'https://exemplo.invalid/v1.pdf', data: '2026-10-06T10:00:00.000Z' }],
  };
  const overview = computeClientTaskProgress({
    tasks: sampleTasks,
    cases: [sampleCase],
    clients: [sampleClient],
    selectedCaseId: sampleCase.id,
  });

  const summaryPdf = await renderToBuffer(
    React.createElement(ResumoProcessoClientePdfDocument, {
      empresa: DEFAULT_EMPRESA_CONFIG,
      client: sampleClient,
      activeCase: sampleCase,
      cases: [sampleCase],
      clients: [sampleClient],
      tasks: sampleTasks,
      docs: [submittedDoc],
      overview,
    }) as React.ReactElement<DocumentProps>,
  );

  assert.ok(summaryPdf.subarray(0, 5).toString('utf8').startsWith('%PDF-'));
  assert.ok(summaryPdf.byteLength > 1000);
});

function countPdfPages(buf: Buffer): number {
  const text = buf.toString('latin1');
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

test('GeneratedOfficialDocPdfDocument generates multiple A4 pages for long contracts without clipping', async () => {
  const { GeneratedOfficialDocPdfDocument } = await import('./ClientPortalPdfDocuments');
  const longClauses = Array.from(
    { length: 45 },
    (_, i) =>
      `CLÁUSULA ${i + 1}ª — OBRIGAÇÕES E PROCEDIMENTOS MIGRATÓRIOS\n` +
      `A contratada compromete-se a acompanhar integralmente o protocolo perante o Servicio Nacional de Migraciones (SERMIG), ` +
      `observando rigorosamente os prazos legais previstos na Ley 21.325 e Decreto Supremo 177, incluindo revisão documental, ` +
      `conferência de apostilamento de Haia, tradução juramentada e notificações eletrônicas ao titular e dependentes.\n`,
  ).join('\n');

  const pdfBuf = await renderToBuffer(
    React.createElement(GeneratedOfficialDocPdfDocument, {
      empresa: DEFAULT_EMPRESA_CONFIG,
      titulo: 'Contrato de Prestação de Serviços de Assessoria Migratória',
      conteudo: longClauses,
      codigoVerificacao: 'DM-2026-TEST-99',
      versao: 2,
      status: 'Assinado',
      clienteNome: sampleClient.nomeCompleto,
      assinadoEm: '2026-11-18T12:00:00.000Z',
    }) as React.ReactElement<DocumentProps>,
  );

  assert.ok(pdfBuf.subarray(0, 5).toString('utf8').startsWith('%PDF-'));
  const pageCount = countPdfPages(pdfBuf);
  assert.ok(pageCount >= 3, `Expected >= 3 pages for long contract, got ${pageCount}`);
});

test('ResumoProcessoClientePdfDocument paginates all 50 tasks and 50 submitted docs across multiple pages', async () => {
  const manyTasks: Task[] = Array.from({ length: 50 }, (_, i) => ({
    id: `task_multi_${i}`,
    titulo: `Etapa operacional detalhada número ${i + 1} para conferência SERMIG`,
    caseId: 'case_test_1',
    clientId: 'cli_test_1',
    prioridade: i % 2 === 0 ? 'Alta' : 'Média',
    status: i < 20 ? 'Concluída' : i < 35 ? 'Em andamento' : 'Pendente',
    prazo: '2026-12-15',
    createdAt: '2026-10-02T12:00:00.000Z',
  }));
  const manyDocs: CaseDocument[] = Array.from({ length: 50 }, (_, i) => ({
    ...sampleDocs[0],
    id: `doc_multi_${i}`,
    nomeDocumento: `Certidão Oficial Apostilada #${i + 1}`,
    arquivoNome: `certidao_${i + 1}.pdf`,
    arquivoUrl: `https://exemplo.invalid/certidao_${i + 1}.pdf`,
    updatedAt: '2026-11-10T10:00:00.000Z',
  }));
  const overview = computeClientTaskProgress({
    tasks: manyTasks,
    cases: [sampleCase],
    clients: [sampleClient],
    selectedCaseId: sampleCase.id,
  });

  const multiPdf = await renderToBuffer(
    React.createElement(ResumoProcessoClientePdfDocument, {
      empresa: DEFAULT_EMPRESA_CONFIG,
      client: sampleClient,
      activeCase: sampleCase,
      cases: [sampleCase],
      clients: [sampleClient],
      tasks: manyTasks,
      docs: manyDocs,
      overview,
    }) as React.ReactElement<DocumentProps>,
  );

  assert.ok(multiPdf.subarray(0, 5).toString('utf8').startsWith('%PDF-'));
  const pageCount = countPdfPages(multiPdf);
  assert.ok(pageCount >= 3, `Expected >= 3 pages for 50 tasks + 50 docs, got ${pageCount}`);
});

