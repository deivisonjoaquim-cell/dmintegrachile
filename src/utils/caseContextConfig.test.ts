import assert from 'node:assert/strict';
import test from 'node:test';
import type { Case } from '../types/domain';
import {
  getCaseContextConfig,
  getDocumentRowVisibility,
  serviceNeedsCurrentResidencyExpiry,
  serviceRequiresVisaCategory,
} from './caseContextConfig';

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: 'case_test',
    titulo: 'Caso Teste',
    clientId: 'cli_1',
    tipoServico: 'Residência Temporal',
    visaCategoryId: 'visa_15_mercosul',
    etapaPipeline: 4,
    statusSermig: 'Não protocolado',
    portalLiberado: false,
    relatorioViabilidadeLiberado: false,
    prioridade: 'Alta',
    createdAt: '2026-01-10T10:00:00.000Z',
    ...overrides,
  };
}

test('Relocation Completo oculta todos os campos SERMIG e parecer, e ativa aba Relocation', () => {
  const ctx = getCaseContextConfig({
    caseObj: makeCase({ tipoServico: 'Relocation Completo', visaCategoryId: undefined }),
    role: 'admin',
    dependentsCount: 0,
    docsCount: 2,
    pendingDocsCount: 1,
    docReadinessPct: 50,
    minProtocolReadinessPct: 100,
    unreadChatCount: 0,
    hasRelocationTasks: false,
  });

  assert.equal(ctx.isRelocationOnly, true);
  assert.equal(ctx.usesSermig, false);
  assert.equal(ctx.fields.subcategoriaSermig, false);
  assert.equal(ctx.fields.numeroPedidoSermig, false);
  assert.equal(ctx.fields.dataProtocolo, false);
  assert.equal(ctx.fields.comprovanteProtocolo, false);
  assert.equal(ctx.fields.notasSermig, false);
  assert.equal(ctx.fields.dataLimiteEntrada, false);
  assert.equal(ctx.fields.dataVencimentoResidencia, false);
  assert.equal(ctx.fields.prazoRequerimento, false);
  assert.equal(ctx.fields.parecerTecnico, false);

  const tabIds = ctx.visibleTabs.map((t) => t.id);
  assert.ok(tabIds.includes('relocation'));
  assert.ok(!tabIds.includes('dependentes'));
  assert.deepEqual(ctx.relevantDeadlineTypes, ['Validade Documento', 'Vencimento Cédula']);
  assert.equal(ctx.nextAction.targetTab, 'relocation');
});

test('Residência Temporal pré-protocolo oculta campos de protocolo/pós-aprovação e expande parecer', () => {
  const ctx = getCaseContextConfig({
    caseObj: makeCase({ tipoServico: 'Residência Temporal', etapaPipeline: 4, statusSermig: 'Não protocolado' }),
    role: 'consultor',
    dependentsCount: 0,
    docsCount: 5,
    pendingDocsCount: 2,
    docReadinessPct: 60,
    minProtocolReadinessPct: 100,
    unreadChatCount: 1,
    hasRelocationTasks: false,
  });

  assert.equal(ctx.usesSermig, true);
  assert.equal(ctx.hasProtocolStarted, false);
  assert.equal(ctx.fields.subcategoriaSermig, true);
  assert.equal(ctx.fields.numeroPedidoSermig, false);
  assert.equal(ctx.fields.dataProtocolo, false);
  assert.equal(ctx.fields.comprovanteProtocolo, false);
  assert.equal(ctx.fields.dataLimiteEntrada, false);
  assert.equal(ctx.fields.dataVencimentoResidencia, false);
  assert.equal(ctx.fields.prazoRequerimento, false);
  assert.equal(ctx.fields.parecerTecnico, true);
  assert.equal(ctx.fields.parecerExpandedByDefault, true);

  const tabIds = ctx.visibleTabs.map((t) => t.id);
  assert.ok(!tabIds.includes('dependentes'));
  assert.ok(!tabIds.includes('relocation'));
  assert.ok(tabIds.includes('financeiro'));
  assert.equal(ctx.hiddenOptionalTabs.length, 2);
});

test('Prorrogação em Requerimento exibe protocolo, vencimento e prazo de requerimento, sem entrada 90d', () => {
  const ctx = getCaseContextConfig({
    caseObj: makeCase({
      tipoServico: 'Prorrogação',
      etapaPipeline: 8,
      statusSermig: 'Requerimento de documentos',
      numeroPedidoSermig: 'SOL-2026-999',
    }),
    role: 'admin',
    dependentsCount: 2,
    docsCount: 6,
    pendingDocsCount: 0,
    docReadinessPct: 100,
    minProtocolReadinessPct: 100,
    unreadChatCount: 0,
    hasRelocationTasks: false,
  });

  assert.equal(ctx.hasProtocolStarted, true);
  assert.equal(ctx.fields.numeroPedidoSermig, true);
  assert.equal(ctx.fields.dataProtocolo, true);
  assert.equal(ctx.fields.comprovanteProtocolo, true);
  assert.equal(ctx.fields.dataVencimentoResidencia, true);
  assert.equal(ctx.fields.prazoRequerimento, true);
  assert.equal(ctx.fields.dataLimiteEntrada, false);
  assert.equal(ctx.fields.parecerExpandedByDefault, false);

  const tabIds = ctx.visibleTabs.map((t) => t.id);
  assert.ok(tabIds.includes('dependentes'));
  assert.ok(!tabIds.includes('relocation'));
  assert.ok(!ctx.relevantDeadlineTypes.includes('Entrada no Chile 90d'));
  assert.ok(ctx.relevantDeadlineTypes.includes('Janela Prorrogação'));
  assert.ok(ctx.relevantDeadlineTypes.includes('Resposta Requerimento/Recurso'));
  assert.equal(ctx.nextAction.tone, 'warning');
});

test('Assistente não vê Financeiro nem Parecer Técnico, e showAllFields libera campos opcionais', () => {
  const ctx = getCaseContextConfig({
    caseObj: makeCase({ tipoServico: 'Residência Temporal', etapaPipeline: 3 }),
    role: 'assistente',
    dependentsCount: 0,
    docsCount: 0,
    pendingDocsCount: 0,
    docReadinessPct: 0,
    minProtocolReadinessPct: 100,
    unreadChatCount: 0,
    hasRelocationTasks: false,
    showAllFields: true,
  });

  assert.ok(!ctx.visibleTabs.some((t) => t.id === 'financeiro'));
  assert.equal(ctx.fields.parecerTecnico, false);
  assert.equal(ctx.fields.numeroPedidoSermig, true);
  assert.equal(ctx.fields.dataLimiteEntrada, true);
  assert.equal(ctx.fields.prazoRequerimento, true);
});

test('getDocumentRowVisibility oculta controles irrelevantes ao documento específico', () => {
  const simpleDoc = getDocumentRowVisibility({
    validadeDias: 0,
    dataEmissao: undefined,
    exigeApostila: false,
    apostilado: false,
    exigeTraducao: false,
    traduzido: false,
  });
  assert.deepEqual(simpleDoc, {
    showEmissionDate: false,
    showApostilleToggle: false,
    showTranslationToggle: false,
  });

  const certidaoAntecedentes = getDocumentRowVisibility({
    validadeDias: 60,
    dataEmissao: undefined,
    exigeApostila: true,
    apostilado: false,
    exigeTraducao: false,
    traduzido: false,
  });
  assert.deepEqual(certidaoAntecedentes, {
    showEmissionDate: true,
    showApostilleToggle: true,
    showTranslationToggle: false,
  });
});

test('Helpers do modal de Novo Caso respondem ao tipoServico', () => {
  assert.equal(serviceRequiresVisaCategory('Relocation Completo'), false);
  assert.equal(serviceRequiresVisaCategory('Residência Temporal'), true);
  assert.equal(serviceNeedsCurrentResidencyExpiry('Prorrogação'), true);
  assert.equal(serviceNeedsCurrentResidencyExpiry('Residência Definitiva'), true);
  assert.equal(serviceNeedsCurrentResidencyExpiry('Residência Temporal'), false);
});
