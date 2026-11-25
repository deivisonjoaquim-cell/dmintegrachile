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

  it('filters legal library documents by file type (PDF vs Portal) and expiration date in real time', () => {
    const customSources = [
      {
        ...SEED_LEGAL_SOURCES[0],
        id: 'doc_pdf_expiring',
        titulo: 'Circular SERMIG PDF Temporária 2026',
        arquivoPdfUrl: 'https://example.com/circular-2026.pdf',
        dataExpiracao: '2026-12-15',
        statusVigencia: 'Vigente' as const,
      },
      {
        ...SEED_LEGAL_SOURCES[1],
        id: 'doc_portal_expired',
        titulo: 'Decreto Revogado Exemplo',
        arquivoPdfUrl: undefined,
        dataExpiracao: '2025-01-10',
        statusVigencia: 'Revogada' as const,
      },
      {
        ...SEED_LEGAL_SOURCES[2],
        id: 'doc_portal_long',
        titulo: 'Norma Vigente Longo Prazo',
        arquivoPdfUrl: undefined,
        dataExpiracao: '2028-06-30',
        statusVigencia: 'Vigente' as const,
      },
    ];

    // 1. Filter by PDF file format
    const pdfOnly = filterLegalLibrarySources({
      sources: customSources,
      visaCategories: SEED_VISA_CATEGORIES,
      query: '',
      visaGroup: 'all',
      selectedVisaId: 'all',
      docKind: 'all',
      fileFormat: 'pdf',
      referenceDateIso: '2026-11-25',
    });
    assert.deepEqual(pdfOnly.map((s) => s.id), ['doc_pdf_expiring']);

    // 2. Filter by expiring within 90 days
    const expiringSoon = filterLegalLibrarySources({
      sources: customSources,
      visaCategories: SEED_VISA_CATEGORIES,
      query: '',
      visaGroup: 'all',
      selectedVisaId: 'all',
      docKind: 'all',
      expirationFilter: 'expirando_90d',
      referenceDateIso: '2026-11-25',
    });
    assert.deepEqual(expiringSoon.map((s) => s.id), ['doc_pdf_expiring']);

    // 3. Filter by expired/revoked
    const expiredOnly = filterLegalLibrarySources({
      sources: customSources,
      visaCategories: SEED_VISA_CATEGORIES,
      query: '',
      visaGroup: 'all',
      selectedVisaId: 'all',
      docKind: 'all',
      expirationFilter: 'expirada_revogada',
      referenceDateIso: '2026-11-25',
    });
    assert.deepEqual(expiredOnly.map((s) => s.id), ['doc_portal_expired']);

    // 4. Filter by explicit expirationBeforeDate limit
    const expiringBeforeEndOf2026 = filterLegalLibrarySources({
      sources: customSources,
      visaCategories: SEED_VISA_CATEGORIES,
      query: '',
      visaGroup: 'all',
      selectedVisaId: 'all',
      docKind: 'all',
      expirationBeforeDate: '2026-12-31',
      referenceDateIso: '2026-11-25',
    });
    const ids = new Set(expiringBeforeEndOf2026.map((s) => s.id));
    assert.equal(ids.has('doc_pdf_expiring'), true);
    assert.equal(ids.has('doc_portal_expired'), true);
    assert.equal(ids.has('doc_portal_long'), false);
  });
});
