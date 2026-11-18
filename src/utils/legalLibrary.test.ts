import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SEED_LEGAL_SOURCES, SEED_VISA_CATEGORIES } from '../data/seeds';
import {
  buildProceduralGuideSteps,
  filterLegalLibrarySources,
  getApplicableVisaCategories,
  resolveActiveCaseVisaCategory,
} from './legalLibrary';

describe('legalLibrary — Portal Biblioteca Legal search & visa filtering', () => {
  it('filters documents specifically for Acordo Mercosul including Decreto 5.852 and Decreto 6.975', () => {
    const res = filterLegalLibrarySources({
      sources: SEED_LEGAL_SOURCES,
      visaCategories: SEED_VISA_CATEGORIES,
      query: '',
      visaGroup: 'mercosul',
      selectedVisaId: 'all',
      docKind: 'all',
    });

    const ids = new Set(res.map((s) => s.id));
    assert.equal(ids.has('leg_acordo_mercosul'), true);
    assert.equal(ids.has('leg_dec_5852'), true);
    assert.equal(ids.has('leg_dec_6975'), true);
    assert.equal(ids.has('leg_guia_procedimental_sermig'), true);
    assert.equal(ids.has('leg_lgpd'), false);
  });

  it('filters official SERMIG circulars and resolutions and supports accent-insensitive search', () => {
    const res = filterLegalLibrarySources({
      sources: SEED_LEGAL_SOURCES,
      visaCategories: SEED_VISA_CATEGORIES,
      query: 'prorrogacao janela',
      visaGroup: 'all',
      selectedVisaId: 'all',
      docKind: 'circulares_sermig',
    });

    assert.ok(res.some((s) => s.id === 'leg_circular_subcategorias_sermig'));
    assert.ok(res.every((s) => s.tipo === 'Circular' || s.tipo === 'Resolução'));
  });

  it('resolves client active visa category and builds 5 tailored SERMIG procedural steps', () => {
    const visa = resolveActiveCaseVisaCategory(
      SEED_VISA_CATEGORIES,
      undefined,
      'Residência Temporal - Acordo Mercosul',
    );
    assert.equal(visa?.codigo, '15');

    const steps = buildProceduralGuideSteps(visa);
    assert.equal(steps.length, 5);
    assert.ok(steps[1].resumo.includes('exterior'));
    assert.ok(steps[4].resumo.includes('24 meses'));

    const mercosulSource = SEED_LEGAL_SOURCES.find((s) => s.id === 'leg_dec_5852')!;
    const linked = getApplicableVisaCategories(mercosulSource, SEED_VISA_CATEGORIES);
    assert.ok(linked.some((v) => v.codigo === '15'));
  });
});
