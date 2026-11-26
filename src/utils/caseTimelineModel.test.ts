import test from 'node:test';
import assert from 'node:assert/strict';
import type { Case, CaseDocument, Deadline } from '../types/domain';
import {
  buildClientStatusTimeline,
  filterProcessMilestones,
  getProcessStepStatusLabel,
  resolveProcessStepStatus,
  summarizeProcessTimeline,
} from './caseTimelineModel';

const SAMPLE_CASE = {
  id: 'case-101',
  clientId: 'client-101',
  titulo: 'Residência Temporal — Mercosul',
  etapaPipeline: 8,
  statusSermig: 'Em trâmite',
  numeroPedidoSermig: 'SRM-2026-88412',
  dataContrato: '2026-08-10',
  dataProtocolo: '2026-09-22',
  createdAt: '2026-08-01',
  updatedAt: '2026-10-15',
} as unknown as Case;

const SAMPLE_DOCS: CaseDocument[] = [
  {
    id: 'doc-1',
    caseId: 'case-101',
    clientId: 'client-101',
    nomeDocumento: 'Passaporte válido',
    obrigatorio: true,
    status: 'Aprovado',
  } as CaseDocument,
  {
    id: 'doc-2',
    caseId: 'case-101',
    clientId: 'client-101',
    nomeDocumento: 'Antecedentes Criminais Apostilados',
    obrigatorio: true,
    status: 'Aprovado',
  } as CaseDocument,
];

const SAMPLE_DEADLINES: Deadline[] = [
  {
    id: 'dl-1',
    caseId: 'case-101',
    clientId: 'client-101',
    tipo: 'Prazo Legal 6 Meses SERMIG',
    titulo: 'Acompanhar movimentação SERMIG',
    dataLimite: '2026-12-10',
    concluido: false,
  } as Deadline,
];

test('resolveProcessStepStatus maps completed, current, attention and upcoming accurately', () => {
  assert.equal(resolveProcessStepStatus('completed'), 'aprovado');
  assert.equal(resolveProcessStepStatus('current'), 'em_analise');
  assert.equal(resolveProcessStepStatus('attention'), 'pendente');
  assert.equal(resolveProcessStepStatus('upcoming'), 'pendente');

  assert.equal(getProcessStepStatusLabel('completed'), 'Aprovado');
  assert.equal(getProcessStepStatusLabel('current'), 'Em análise');
  assert.equal(getProcessStepStatusLabel('attention'), 'Pendente · Atenção');
  assert.equal(getProcessStepStatusLabel('upcoming'), 'Pendente · Próximo passo');
});

test('summarizeProcessTimeline and filterProcessMilestones return accurate counts for Completa modality', () => {
  const timeline = buildClientStatusTimeline({
    activeCase: SAMPLE_CASE,
    modality: 'completa',
    caseDocuments: SAMPLE_DOCS,
    deadlines: SAMPLE_DEADLINES,
    nowMs: Date.UTC(2026, 10, 26),
  });

  const summary = summarizeProcessTimeline(timeline.milestones);
  assert.equal(summary.total, 15);
  assert.equal(summary.aprovadas, 7);
  assert.equal(summary.emAnalise, 1);
  assert.equal(summary.pendentes, 7);
  assert.equal(summary.attentionCount, 0);

  const approved = filterProcessMilestones(timeline.milestones, 'aprovado');
  const inReview = filterProcessMilestones(timeline.milestones, 'em_analise');
  const pending = filterProcessMilestones(timeline.milestones, 'pendente');

  assert.equal(approved.length, 7);
  assert.equal(inReview.length, 1);
  assert.equal(inReview[0].numero, 8);
  assert.equal(pending.length, 7);
});

test('attention stage on SERMIG document requirement maps to pendente with attentionCount', () => {
  const timeline = buildClientStatusTimeline({
    activeCase: { ...SAMPLE_CASE, statusSermig: 'Requerimento de documentos', etapaPipeline: 9 },
    modality: 'completa',
    caseDocuments: SAMPLE_DOCS,
    deadlines: SAMPLE_DEADLINES,
    nowMs: Date.UTC(2026, 10, 26),
  });

  const summary = summarizeProcessTimeline(timeline.milestones);
  assert.equal(summary.aprovadas, 8);
  assert.equal(summary.attentionCount, 1);
  assert.equal(summary.pendentes, 7);

  const pendingInAnalisePhase = filterProcessMilestones(timeline.milestones, 'pendente', 'analise');
  assert.ok(pendingInAnalisePhase.some((m) => m.numero === 9 && m.status === 'attention'));
});
