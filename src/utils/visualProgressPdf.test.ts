import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Case, CaseDocument, Client, Task } from '../types/domain';
import { DEFAULT_EMPRESA_CONFIG } from '../data/seeds';
import { computeClientTaskProgress } from './taskProgressMetrics';
import { buildVisualProgressPdfModel, isSubmittedDocument } from './visualProgressPdf';

function makeClient(id: string, nome: string): Client {
  return {
    id,
    nomeCompleto: nome,
    cpf: '000.000.000-00',
    email: `${id}@example.com`,
    whatsapp: '+5511999990000',
    portalLiberado: true,
    statusAcessoPortal: 'Liberado',
    createdAt: '2026-10-01T10:00:00.000Z',
  };
}

function makeCase(id: string, clientId: string, titulo: string): Case {
  return {
    id,
    clientId,
    titulo,
    tipoServico: 'Residência Temporal',
    etapaPipeline: 6,
    statusSermig: 'Em trâmite',
    numeroPedidoSermig: 'SERMIG-2026-991',
    portalLiberado: true,
    relatorioViabilidadeLiberado: true,
    prioridade: 'Alta',
    createdAt: '2026-10-05T10:00:00.000Z',
  };
}

function makeTask(id: string, clientId: string, caseId: string, status: Task['status']): Task {
  return {
    id,
    clientId,
    caseId,
    titulo: `Tarefa ${id}`,
    status,
    prioridade: 'Alta',
    prazo: '2026-12-10',
    createdAt: '2026-11-01T10:00:00.000Z',
  };
}

function makeDoc(id: string, caseId: string, clientId: string, status: CaseDocument['status']): CaseDocument {
  return {
    id,
    caseId,
    clientId,
    nomeDocumento: `Documento ${id}`,
    categoriaDoc: 'Identidade',
    pessoa: 'Titular',
    obrigatorio: true,
    peso: 2,
    ordemEmissao: 1,
    validadeDias: 90,
    exigeApostila: true,
    apostilado: status === 'Aprovado',
    exigeTraducao: false,
    traduzido: false,
    status,
    etapaEsteira: status === 'Aprovado' ? '6 Aprovado para Protocolo' : '2 Recebido/Triagem',
    versao: 1,
    arquivoNome: status === 'Pendente' ? undefined : `${id}.pdf`,
    updatedAt: '2026-11-12T10:00:00.000Z',
  };
}

describe('visualProgressPdf — Executive PDF Model & Pagination', () => {
  it('builds single-client PDF model with D&M branding, visual overview, and only submitted documents', () => {
    const client = makeClient('cli_1', 'Lucas Andrade');
    const activeCase = makeCase('case_1', 'cli_1', 'Residência Mercosul 15');
    const tasks = [
      makeTask('t1', 'cli_1', 'case_1', 'Concluída'),
      makeTask('t2', 'cli_1', 'case_1', 'Em andamento'),
      makeTask('t3', 'cli_1', 'case_1', 'Pendente'),
    ];
    const docs = [
      makeDoc('d1', 'case_1', 'cli_1', 'Aprovado'),
      makeDoc('d2', 'case_1', 'cli_1', 'Enviado'),
      makeDoc('d3', 'case_1', 'cli_1', 'Pendente'),
    ];
    const overview = computeClientTaskProgress({
      tasks,
      cases: [activeCase],
      clients: [client],
      selectedCaseId: 'case_1',
    });

    const model = buildVisualProgressPdfModel({
      empresa: DEFAULT_EMPRESA_CONFIG,
      client,
      activeCase,
      cases: [activeCase],
      clients: [client],
      tasks,
      docs,
      overview,
      now: new Date('2026-11-18T12:00:00.000Z'),
    });

    assert.match(model.brandName, /D&M Integra Chile/);
    assert.equal(model.stageNumber, 6);
    assert.equal(model.protocoloSermig, 'SERMIG-2026-991');
    assert.equal(model.submittedDocsCount, 2);
    assert.equal(model.approvedDocsCount, 1);
    assert.equal(model.reviewDocsCount, 1);
    assert.equal(model.pendingUploadCount, 1);
    assert.equal(isSubmittedDocument(docs[2]), false);
    assert.ok(model.pages.length >= 1);
    assert.equal(model.pages[0].taskRows.length, 3);
    assert.match(model.filename, /^LUCAS_ANDRADE_RESUMO_STATUS_PROCESSO_.*\.pdf$/);
  });

  it('paginates cleanly across multiple A4 pages when task and document lists are large', () => {
    const client = makeClient('cli_2', 'Fernanda Costa');
    const activeCase = makeCase('case_2', 'cli_2', 'Residência Temporal');
    const tasks = Array.from({ length: 18 }, (_, i) => makeTask(`t_${i}`, 'cli_2', 'case_2', 'Pendente'));
    const docs = Array.from({ length: 16 }, (_, i) => makeDoc(`d_${i}`, 'case_2', 'cli_2', 'Aprovado'));
    const overview = computeClientTaskProgress({
      tasks,
      cases: [activeCase],
      clients: [client],
      selectedCaseId: 'case_2',
    });

    const model = buildVisualProgressPdfModel({
      empresa: DEFAULT_EMPRESA_CONFIG,
      client,
      activeCase,
      cases: [activeCase],
      clients: [client],
      tasks,
      docs,
      overview,
    });

    assert.ok(model.pages.length >= 3);
    assert.equal(model.pages[0].isFirstPage, true);
    assert.equal(model.pages[1].isFirstPage, false);
    assert.equal(
      model.pages.reduce((acc, p) => acc + p.taskRows.length, 0),
      18,
    );
    assert.equal(
      model.pages.reduce((acc, p) => acc + p.docRows.length, 0),
      16,
    );
  });

  it('never truncates > 50 tasks and documents and numbers every generated page sequentially', () => {
    const client = makeClient('cli_3', 'Roberto Mendes');
    const activeCase = makeCase('case_3', 'cli_3', 'Residência Mercosul Família');
    const tasks = Array.from({ length: 55 }, (_, i) => makeTask(`t_big_${i}`, 'cli_3', 'case_3', 'Em andamento'));
    const docs = Array.from({ length: 55 }, (_, i) => makeDoc(`d_big_${i}`, 'case_3', 'cli_3', 'Aprovado'));
    const overview = computeClientTaskProgress({
      tasks,
      cases: [activeCase],
      clients: [client],
      selectedCaseId: 'case_3',
    });

    const model = buildVisualProgressPdfModel({
      empresa: DEFAULT_EMPRESA_CONFIG,
      client,
      activeCase,
      cases: [activeCase],
      clients: [client],
      tasks,
      docs,
      overview,
    });

    assert.ok(model.pages.length >= 6, `Expected >= 6 pages, got ${model.pages.length}`);
    assert.equal(
      model.pages.reduce((acc, p) => acc + p.taskRows.length, 0),
      55,
    );
    assert.equal(
      model.pages.reduce((acc, p) => acc + p.docRows.length, 0),
      55,
    );
    model.pages.forEach((p, idx) => {
      assert.equal(p.pageNumber, idx + 1);
      assert.equal(p.totalPages, model.pages.length);
    });
  });
});

