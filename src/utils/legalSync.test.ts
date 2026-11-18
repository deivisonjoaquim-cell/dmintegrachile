import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SEED_LEGAL_SOURCES, SEED_VISA_CATEGORIES } from '../data/seeds';
import type { LegalSource, VisaCategory } from '../types/domain';
import {
  buildOfficialLegalCatalogDiff,
  canSafelyUpgradeSeedSource,
  countLegalReviewPending,
  isLegalSourceOutdated,
} from './legalSync';

const NOW_MS = Date.parse('2026-11-18T12:00:00Z');

function makeSource(overrides: Partial<LegalSource> = {}): LegalSource {
  return {
    id: 'leg_teste',
    titulo: 'Norma Teste',
    tipo: 'Lei',
    pais: 'Chile',
    numeroAno: '1/2025',
    orgaoEmissor: 'SERMIG',
    artigos: 'Art. 1',
    resumoPortugues: 'Resumo',
    explicacaoCliente: 'Explicação',
    textoIntegral: '',
    tags: [],
    linkOficial: 'https://serviciomigraciones.cl',
    versao: '1.0',
    statusVigencia: 'Vigente',
    ultimaVerificacao: '2026-11-18',
    ...overrides,
  };
}

describe('legalSync — Base Legal SERMIG/BCN governance helpers', () => {
  it('flags missing or expired ultimaVerificacao unless Revogada', () => {
    assert.equal(isLegalSourceOutdated(makeSource({ ultimaVerificacao: '2026-11-01' }), 90, NOW_MS), false);
    assert.equal(isLegalSourceOutdated(makeSource({ ultimaVerificacao: '2026-06-01' }), 90, NOW_MS), true);
    assert.equal(isLegalSourceOutdated(makeSource({ ultimaVerificacao: undefined }), 90, NOW_MS), true);
    assert.equal(
      isLegalSourceOutdated(makeSource({ statusVigencia: 'Revogada', ultimaVerificacao: '2020-01-01' }), 90, NOW_MS),
      false,
    );
  });

  it('counts pending verification and outdated norms accurately', () => {
    const counts = countLegalReviewPending(
      [
        makeSource({ id: '1', statusVigencia: 'Vigente', ultimaVerificacao: '2026-11-10' }),
        makeSource({ id: '2', statusVigencia: 'A verificar', ultimaVerificacao: '2026-11-10' }),
        makeSource({ id: '3', statusVigencia: 'Vigente', ultimaVerificacao: '2025-01-01' }),
        makeSource({ id: '4', statusVigencia: 'A verificar', ultimaVerificacao: undefined }),
      ],
      90,
      NOW_MS,
    );
    assert.equal(counts.aVerificar, 2);
    assert.equal(counts.outdated, 2);
    assert.equal(counts.totalAttention, 3);
  });

  it('preserves customized norms (version != 1.0 or consultant notes) during official sync', () => {
    const seedDec177 = SEED_LEGAL_SOURCES.find((s) => s.id === 'leg_dec_177_2022')!;
    const customized: LegalSource = {
      ...seedDec177,
      versao: '1.2',
      notasInternasConsultor: 'Parecer interno mantido',
      linkOficial: 'https://www.bcn.cl/leychile',
    };
    assert.equal(canSafelyUpgradeSeedSource(customized, seedDec177), false);

    const legacyDefault: LegalSource = {
      ...seedDec177,
      versao: '1.0',
      linkOficial: 'https://www.bcn.cl/leychile',
      statusVigencia: 'A verificar',
      ultimaVerificacao: undefined,
    };
    assert.equal(canSafelyUpgradeSeedSource(legacyDefault, seedDec177), true);
  });

  it('computes missing official norms (Decreto 181, Decreto 6975, SERMIG Estampado) and visa links safely', () => {
    const legacySources: LegalSource[] = [
      {
        ...SEED_LEGAL_SOURCES.find((s) => s.id === 'leg_dec_296')!,
        linkOficial: 'https://www.bcn.cl/leychile',
        statusVigencia: 'A verificar',
        ultimaVerificacao: undefined,
      },
    ];
    const legacyVisas: VisaCategory[] = [
      {
        ...SEED_VISA_CATEGORIES.find((v) => v.id === 'visa_01_reunificacao')!,
        statusVerificacao: 'A verificar',
        legalSourceIds: ['leg_ley_21325'],
      },
    ];

    const diff = buildOfficialLegalCatalogDiff(legacySources, legacyVisas, SEED_LEGAL_SOURCES, SEED_VISA_CATEGORIES);
    const upsertedIds = new Set(diff.sourcesToUpsert.map((s) => s.id));
    assert.ok(upsertedIds.has('leg_dec_181_2023'));
    assert.ok(upsertedIds.has('leg_dec_6975'));
    assert.ok(upsertedIds.has('leg_sermig_estampado'));
    assert.ok(upsertedIds.has('leg_dec_296'));

    const upgradedDec296 = diff.sourcesToUpsert.find((s) => s.id === 'leg_dec_296')!;
    assert.equal(upgradedDec296.linkOficial, 'https://www.bcn.cl/leychile/navegar?idNorma=1172573');
    assert.equal(upgradedDec296.statusVigencia, 'Vigente');

    const upgradedReunif = diff.visasToUpsert.find((v) => v.id === 'visa_01_reunificacao')!;
    assert.equal(upgradedReunif.statusVerificacao, 'Verificado');
    assert.ok((upgradedReunif.legalSourceIds || []).includes('leg_dec_181_2023'));
  });
});
