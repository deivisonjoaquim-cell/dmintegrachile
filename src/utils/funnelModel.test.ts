import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Case, Lead } from '../types/domain';
import {
  computeUnifiedFunnelMetrics,
  formatCaseStageSummary,
  getMacroStageForCase,
  getMacroStageForLead,
  getMacroStageForPipelineStep,
  getNextMacroStage,
  MACRO_FUNNEL_STAGES,
  resolveTargetPipelineStep,
} from './funnelModel';

function makeLead(id: string, statusFunil: Lead['statusFunil'], convertedCaseId?: string): Lead {
  return {
    id,
    nome: `Lead ${id}`,
    whatsapp: '+5511999990000',
    email: `${id}@example.com`,
    cidadeUf: 'São Paulo/SP',
    origem: 'Site',
    interesse: 'morar_brasil_chile',
    statusFunil,
    prioridade: 'Média',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: '2026-10-01T10:00:00.000Z',
    convertedCaseId,
    createdAt: '2026-10-01T10:00:00.000Z',
  };
}

function makeCase(
  id: string,
  etapaPipeline: number,
  options?: { statusSermig?: Case['statusSermig']; arquivado?: boolean },
): Case {
  return {
    id,
    clientId: `cli_${id}`,
    titulo: `Caso ${id}`,
    tipoServico: 'Residência Temporal',
    etapaPipeline,
    statusSermig: options?.statusSermig ?? 'Não protocolado',
    portalLiberado: true,
    relatorioViabilidadeLiberado: true,
    prioridade: 'Média',
    arquivado: options?.arquivado,
    createdAt: '2026-10-05T10:00:00.000Z',
  };
}

describe('funnelModel — 5-Milestone Streamlined Team Funnel', () => {
  it('defines exactly 5 ordered conversion milestones', () => {
    assert.equal(MACRO_FUNNEL_STAGES.length, 5);
    assert.deepEqual(
      MACRO_FUNNEL_STAGES.map((s) => s.id),
      ['diagnostico', 'proposta', 'documentacao', 'tramite', 'finalizacao'],
    );
    assert.deepEqual(
      MACRO_FUNNEL_STAGES.map((s) => s.ordem),
      [1, 2, 3, 4, 5],
    );
  });

  it('maps every legacy pipeline step (1..15) cleanly to its corresponding macro stage', () => {
    assert.equal(getMacroStageForPipelineStep(1).id, 'diagnostico');
    assert.equal(getMacroStageForPipelineStep(2).id, 'proposta');
    for (const step of [3, 4, 5, 6]) {
      assert.equal(getMacroStageForPipelineStep(step).id, 'documentacao');
    }
    for (const step of [7, 8, 9]) {
      assert.equal(getMacroStageForPipelineStep(step).id, 'tramite');
    }
    for (const step of [10, 11, 12, 13, 14, 15]) {
      assert.equal(getMacroStageForPipelineStep(step).id, 'finalizacao');
    }
    // Defensive fallback for null/undefined/0
    assert.equal(getMacroStageForPipelineStep(undefined).id, 'diagnostico');
    assert.equal(getMacroStageForPipelineStep(0).id, 'diagnostico');
  });

  it('maps pre-conversion leads to commercial stages and excludes closed/lost/converted leads', () => {
    assert.equal(getMacroStageForLead(makeLead('l1', 'Novo'))?.id, 'diagnostico');
    assert.equal(getMacroStageForLead(makeLead('l2', 'Contatado'))?.id, 'diagnostico');
    assert.equal(getMacroStageForLead(makeLead('l3', 'Diagnóstico Agendado'))?.id, 'diagnostico');
    assert.equal(getMacroStageForLead(makeLead('l4', 'Orçamento Enviado'))?.id, 'proposta');
    assert.equal(getMacroStageForLead(makeLead('l5', 'Fechado')), null);
    assert.equal(getMacroStageForLead(makeLead('l6', 'Perdido')), null);
    assert.equal(getMacroStageForLead(makeLead('l7', 'Orçamento Enviado', 'case_1')), null);
  });

  it('preserves sub-stage when already inside target macro stage, and resolves representative step otherwise', () => {
    assert.equal(resolveTargetPipelineStep('documentacao', 5), 5);
    assert.equal(resolveTargetPipelineStep('documentacao', 2), 3);
    assert.equal(resolveTargetPipelineStep('tramite', 5), 7);
    assert.equal(resolveTargetPipelineStep('finalizacao', 13), 13);
    assert.equal(resolveTargetPipelineStep('finalizacao', 8), 10);
  });

  it('computes next macro stage and formatted case summary', () => {
    assert.equal(getNextMacroStage('diagnostico')?.id, 'proposta');
    assert.equal(getNextMacroStage('proposta')?.id, 'documentacao');
    assert.equal(getNextMacroStage('documentacao')?.id, 'tramite');
    assert.equal(getNextMacroStage('tramite')?.id, 'finalizacao');
    assert.equal(getNextMacroStage('finalizacao'), null);

    const summary = formatCaseStageSummary(6);
    assert.equal(summary.macro.id, 'documentacao');
    assert.ok(summary.compactLabel.startsWith('Documentação · '));
    assert.equal(getMacroStageForCase(makeCase('c_ok', 10, { statusSermig: 'Aprovado' })).id, 'finalizacao');
  });

  it('computes unified conversion metrics without double-counting converted leads or archived cases', () => {
    const leads: Lead[] = [
      makeLead('l1', 'Novo'),
      makeLead('l2', 'Diagnóstico Agendado'),
      makeLead('l3', 'Orçamento Enviado'),
      makeLead('l4', 'Fechado', 'c1'),
      makeLead('l5', 'Perdido'),
    ];
    const cases: Case[] = [
      makeCase('c1', 4), // Documentação
      makeCase('c2', 5), // Documentação
      makeCase('c3', 6), // Documentação
      makeCase('c4', 8), // Trâmite
      makeCase('c5', 12, { statusSermig: 'Aprovado' }), // Finalização
      makeCase('c_arch', 15, { arquivado: true }), // Arquivado -> ignorado
    ];

    const metrics = computeUnifiedFunnelMetrics(leads, cases);
    assert.equal(metrics.totalActive, 8); // 3 active leads + 5 active cases
    assert.equal(metrics.totalConvertedCases, 5);
    assert.equal(metrics.totalLostLeads, 1);

    const byId = Object.fromEntries(metrics.stages.map((s) => [s.stage.id, s]));
    assert.equal(byId.diagnostico.leadsCount, 2);
    assert.equal(byId.diagnostico.totalCount, 2);
    assert.equal(byId.proposta.leadsCount, 1);
    assert.equal(byId.documentacao.casesCount, 3);
    assert.equal(byId.tramite.casesCount, 1);
    assert.equal(byId.finalizacao.casesCount, 1);

    // Reached counts (cumulative from Finalização back to Diagnóstico)
    assert.equal(byId.finalizacao.reachedCount, 1);
    assert.equal(byId.tramite.reachedCount, 2);
    assert.equal(byId.documentacao.reachedCount, 5);
    assert.equal(byId.proposta.reachedCount, 6);
    assert.equal(byId.diagnostico.reachedCount, 8);

    // Commercial conversion: 5 operational / (8 active + 1 lost) = 56%
    assert.equal(metrics.commercialConversionPct, 56);
    // Completion rate: 1 finalizacao / 5 active cases = 20%
    assert.equal(metrics.completionRatePct, 20);
    // Bottleneck among stages 1..4 is Documentação (3 items)
    assert.equal(metrics.bottleneckStage?.id, 'documentacao');
  });
});
