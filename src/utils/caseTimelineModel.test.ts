import assert from 'node:assert/strict';
import test from 'node:test';
import type { Case, CaseDocument, Deadline } from '../types/domain';
import { buildClientStatusTimeline } from './caseTimelineModel';

const baseCase: Case = {
  id: 'case_1',
  titulo: 'Residência Temporal Mercosul — João',
  clientId: 'cli_1',
  tipoServico: 'Residência Temporal',
  etapaPipeline: 8,
  statusSermig: 'Em trâmite',
  portalLiberado: true,
  modalidadeConsultoria: 'completa',
  relatorioViabilidadeLiberado: true,
  numeroPedidoSermig: 'SERMIG-2026-9988',
  dataProtocolo: '2026-04-10',
  prioridade: 'Alta',
  createdAt: '2026-03-01T10:00:00.000Z',
};

const sampleDocs: CaseDocument[] = [
  {
    id: 'doc_1',
    caseId: 'case_1',
    clientId: 'cli_1',
    pessoa: 'Titular',
    nomeDocumento: 'Passaporte',
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
  {
    id: 'doc_2',
    caseId: 'case_1',
    clientId: 'cli_1',
    pessoa: 'Titular',
    nomeDocumento: 'Antecedentes PF',
    categoriaDoc: 'Antecedentes',
    etapaEsteira: '4 Pendência/Reprovado',
    ordemEmissao: 2,
    status: 'Reprovado',
    validadeDias: 60,
    apostilado: false,
    traduzido: false,
    exigeApostila: true,
    exigeTraducao: false,
    obrigatorio: true,
    peso: 5,
    versao: 1,
  },
];

const sampleDeadlines: Deadline[] = [
  {
    id: 'dl_1',
    titulo: 'Responder requerimento SERMIG',
    tipo: 'Resposta Requerimento/Recurso',
    dataLimite: '2026-05-15',
    caseId: 'case_1',
    clientId: 'cli_1',
    concluido: false,
  },
];

test('buildClientStatusTimeline builds 15 milestones for completa modality with SERMIG status and attention alerts', () => {
  const model = buildClientStatusTimeline({
    activeCase: { ...baseCase, statusSermig: 'Requerimento de documentos', prazoRequerimento: '2026-05-15' },
    modality: 'completa',
    caseDocuments: sampleDocs,
    deadlines: sampleDeadlines,
    nowMs: Date.parse('2026-05-01T12:00:00.000Z'),
  });

  assert.equal(model.totalSteps, 15);
  assert.equal(model.currentStepNumber, 8);
  assert.equal(model.milestones.length, 15);
  assert.equal(model.phases.length, 4);
  assert.equal(model.currentMilestone?.status, 'attention');
  assert.equal(model.sermigBadge.tone, 'warning');
  assert.equal(model.sermigBadge.protocolNumber, 'SERMIG-2026-9988');
  assert.equal(model.alerts.length, 2); // SERMIG warning + rejected doc
  assert.equal(model.nextDeadline?.titulo, 'Responder requerimento SERMIG');
});

test('buildClientStatusTimeline maps orientativa modality to 6 milestones with owner separation', () => {
  const model = buildClientStatusTimeline({
    activeCase: { ...baseCase, etapaPipeline: 4, modalidadeConsultoria: 'orientativa' },
    modality: 'orientativa',
    caseDocuments: sampleDocs,
    deadlines: [],
    nowMs: Date.parse('2026-05-01T12:00:00.000Z'),
  });

  assert.equal(model.totalSteps, 6);
  assert.equal(model.milestones.length, 6);
  assert.equal(model.sermigBadge.label, 'Protocolo conduzido pelo cliente');
  assert.equal(model.phases.length, 2);
});
