import test from 'node:test';
import assert from 'node:assert/strict';
import type { Case, CaseDocument } from '../types/domain';
import { buildImmigrationJourneyProgress } from './immigrationProgressStepper';

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: 'case-1',
    clientId: 'client-1',
    titulo: 'Residência Temporal — Acordo Mercosul',
    tipoServico: 'Residência Temporal',
    subcategoriaIa: 'Acordo de Residência Mercosul',
    etapaPipeline: 7,
    statusSermig: 'Em trâmite',
    portalLiberado: true,
    relatorioViabilidadeLiberado: true,
    prioridade: 'Alta',
    numeroPedidoSermig: 'SRM-2026-9981',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}

test('buildImmigrationJourneyProgress highlights Visto and RUT as featured milestones without PDI', () => {
  const model = buildImmigrationJourneyProgress({
    mode: 'contratado',
    activeCase: makeCase({ etapaPipeline: 8, statusSermig: 'Em trâmite' }),
    modality: 'completa',
  });

  assert.equal(model.steps.length, 5);
  const featuredIds = model.steps.filter((s) => s.featured).map((s) => s.id);
  assert.deepEqual(featuredIds, ['visto', 'rut']);
  assert.equal(model.currentStep.id, 'visto');
  assert.equal(model.steps[0].status, 'completed');
  assert.equal(model.steps[1].status, 'completed');
  assert.equal(model.steps[2].status, 'current');
  assert.equal(model.steps[4].status, 'upcoming');
  assert.equal(model.visaHighlight.protocolNumber, 'SRM-2026-9981');

  const allText = [
    model.stageCaption,
    model.visaHighlight.summary,
    model.rutHighlight.summary,
    ...model.steps.map((s) => `${s.title} ${s.subtitle} ${s.detail}`),
  ].join(' ');
  assert.doesNotMatch(allText, /\bPDI\b/i);
});

test('buildImmigrationJourneyProgress flags attention on Visto when SERMIG requires documents', () => {
  const model = buildImmigrationJourneyProgress({
    mode: 'contratado',
    activeCase: makeCase({ etapaPipeline: 9, statusSermig: 'Requerimento de documentos' }),
    modality: 'completa',
  });

  assert.equal(model.currentStep.id, 'visto');
  assert.equal(model.currentStep.status, 'attention');
  assert.equal(model.visaHighlight.status, 'attention');
});

test('buildImmigrationJourneyProgress highlights RUT stage when pipeline reaches stages 12-14', () => {
  const model = buildImmigrationJourneyProgress({
    mode: 'contratado',
    activeCase: makeCase({
      etapaPipeline: 13,
      statusSermig: 'Aprovado',
      dataAprovacao: '2026-11-10',
    }),
    modality: 'completa',
  });

  assert.equal(model.currentStep.id, 'rut');
  assert.equal(model.steps[2].status, 'completed');
  assert.equal(model.steps[3].status, 'completed');
  assert.equal(model.steps[4].status, 'current');
  assert.equal(model.rutHighlight.status, 'current');
});

test('buildImmigrationJourneyProgress supports gratuito mode and flags rejected docs in dossie stage', () => {
  const freeModel = buildImmigrationJourneyProgress({
    mode: 'gratuito',
    subcategoriaNome: 'Acordo Mercosul',
  });
  assert.equal(freeModel.currentStep.id, 'diagnostico');
  assert.equal(freeModel.progressPercent, 16);

  const rejectedDocs: CaseDocument[] = [
    {
      id: 'd1',
      caseId: 'case-1',
      clientId: 'client-1',
      pessoa: 'Titular',
      nomeDocumento: 'Antecedentes PF',
      categoriaDoc: 'Antecedentes',
      etapaEsteira: '4 Pendência/Reprovado',
      ordemEmissao: 1,
      status: 'Reprovado',
      validadeDias: 60,
      apostilado: false,
      traduzido: false,
      exigeApostila: true,
      exigeTraducao: false,
      obrigatorio: true,
      peso: 15,
      versao: 1,
      updatedAt: '2026-11-02',
    },
  ];
  const dossieModel = buildImmigrationJourneyProgress({
    mode: 'contratado',
    activeCase: makeCase({ etapaPipeline: 4 }),
    caseDocuments: rejectedDocs,
    modality: 'completa',
  });
  assert.equal(dossieModel.currentStep.id, 'dossie');
  assert.equal(dossieModel.currentStep.status, 'attention');
});
