import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_EMPRESA_CONFIG, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS } from '../data/seeds';
import { runSermigSimulation } from './sermigSimulator';

describe('sermigSimulator — SERMIG legal scenario, timeline & fee engine', () => {
  it('simulates Mercosul (15) from Brazil with clean profile as eligible and computes 60-day PF window', () => {
    const result = runSermigSimulation(
      {
        visaCode: '15',
        localizacaoAtual: 'brasil_exterior',
        dataAlvoProtocolo: '2026-12-01',
        quantidadeDependentes: 1,
        possuiAntecedentesLimpos: true,
        possuiPassaporteValido12m: true,
        possuiComprovacaoFinanceiraOuContrato: true,
        vinculoFamiliarChile: false,
        moedaExibicao: 'BRL',
      },
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      DEFAULT_EMPRESA_CONFIG,
    );

    assert.equal(result.visa.codigo, '15');
    assert.equal(result.elegibilidadeStatus, 'elegivel');
    assert.ok(result.pontuacaoAdesao >= 80);
    assert.equal(result.custos.totalPessoas, 2);
    assert.ok(result.custos.totalBrl > 0);
    assert.ok(result.custos.totalClp > result.custos.totalBrl);
    assert.ok(result.custos.totalUsd > 0);

    // Antecedentes PF milestone must be scheduled 15 days before protocol (within 60-day validity rule)
    const pfStep = result.cronogramaReverso.find((m) => m.marco.includes('Antecedentes'));
    assert.ok(pfStep);
    assert.equal(pfStep.dataSugeridaIso, '2026-11-16');
    assert.match(pfStep.janelaLegal, /60 dias/i);
  });

  it('flags critical legal blocker under Ley 21.325 when tourist in Chile simulates exterior-only visa', () => {
    const result = runSermigSimulation(
      {
        visaCode: '15',
        localizacaoAtual: 'chile_turista',
        dataAlvoProtocolo: '2026-12-15',
        quantidadeDependentes: 0,
        possuiAntecedentesLimpos: true,
        possuiPassaporteValido12m: true,
        possuiComprovacaoFinanceiraOuContrato: true,
        vinculoFamiliarChile: false,
        moedaExibicao: 'USD',
      },
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      DEFAULT_EMPRESA_CONFIG,
    );

    assert.equal(result.elegibilidadeStatus, 'bloqueio_legal');
    assert.equal(result.requerSaidaDoChile, true);
    assert.ok(result.alertasLegais.some((a) => a.nivel === 'critico' && a.baseLegal.includes('21.325')));
  });

  it('allows inside-Chile protocol for Reunificação Familiar (01) with formalized family link', () => {
    const result = runSermigSimulation(
      {
        visaCode: '01',
        localizacaoAtual: 'chile_turista',
        dataAlvoProtocolo: '2026-12-20',
        quantidadeDependentes: 0,
        possuiAntecedentesLimpos: true,
        possuiPassaporteValido12m: true,
        possuiComprovacaoFinanceiraOuContrato: true,
        vinculoFamiliarChile: true,
        moedaExibicao: 'CLP',
      },
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      DEFAULT_EMPRESA_CONFIG,
    );

    assert.equal(result.visa.codigo, '01');
    assert.equal(result.protocoloPermitidoNoChile, true);
    assert.equal(result.requerSaidaDoChile, false);
    assert.equal(result.elegibilidadeStatus, 'elegivel');
  });

  it('scales official SERMIG & apostille costs proportionally with dependents', () => {
    const solo = runSermigSimulation(
      {
        visaCode: '15',
        localizacaoAtual: 'brasil_exterior',
        dataAlvoProtocolo: '2027-01-10',
        quantidadeDependentes: 0,
        possuiAntecedentesLimpos: true,
        possuiPassaporteValido12m: true,
        possuiComprovacaoFinanceiraOuContrato: true,
        vinculoFamiliarChile: false,
        moedaExibicao: 'BRL',
      },
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      DEFAULT_EMPRESA_CONFIG,
    );

    const family = runSermigSimulation(
      {
        visaCode: '15',
        localizacaoAtual: 'brasil_exterior',
        dataAlvoProtocolo: '2027-01-10',
        quantidadeDependentes: 2,
        possuiAntecedentesLimpos: true,
        possuiPassaporteValido12m: true,
        possuiComprovacaoFinanceiraOuContrato: true,
        vinculoFamiliarChile: false,
        moedaExibicao: 'BRL',
      },
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      DEFAULT_EMPRESA_CONFIG,
    );

    assert.equal(solo.custos.totalPessoas, 1);
    assert.equal(family.custos.totalPessoas, 3);
    assert.ok(family.custos.totalBrl > solo.custos.totalBrl * 2.5);
  });
});
