import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPartnerValidationSeals,
  CURATED_TRUSTED_PARTNER_PROFILES,
  PARTNER_PORTRAIT_BY_SPECIALTY,
  REFERRAL_BRIDGE_PILLARS,
  resolvePartnerPortrait,
} from './trustedPartnersShowcase';

test('CURATED_TRUSTED_PARTNER_PROFILES provides 4 validated editorial profiles with local portraits and transparent bridge copy', () => {
  assert.equal(CURATED_TRUSTED_PARTNER_PROFILES.length, 4);
  for (const profile of CURATED_TRUSTED_PARTNER_PROFILES) {
    assert.ok(profile.portraitUrl.startsWith('/src/assets/images/'), `Expected local asset for ${profile.id}`);
    assert.ok(profile.portraitUrl.endsWith('.jpg'), `Expected jpg asset for ${profile.id}`);
    assert.ok(profile.sealCodePt.includes('Selo Curadoria D&M'));
    assert.ok(profile.validationChecksPt.length >= 3);
    assert.equal(profile.summaryPt.toLowerCase().includes('moradia garantida'), false);
    assert.equal(profile.bridgeNotePt.toLowerCase().includes('sem fiador'), false);
  }
  // Real estate profile explicitly clarifies housing is not guaranteed
  const realEstate = CURATED_TRUSTED_PARTNER_PROFILES[0];
  assert.equal(realEstate.category, 'Imobiliária');
  assert.ok(realEstate.bridgeNotePt.toLowerCase().includes('moradia não é um serviço garantido'));
});

test('REFERRAL_BRIDGE_PILLARS covers exclusive immigration scope, non-guaranteed housing, bridge model, and direct contracting', () => {
  assert.equal(REFERRAL_BRIDGE_PILLARS.length, 4);
  const combined = REFERRAL_BRIDGE_PILLARS.map((p) => `${p.titlePt} ${p.descPt}`).join(' ').toLowerCase();
  assert.ok(combined.includes('exclusivamente'));
  assert.ok(combined.includes('pdi'));
  assert.ok(combined.includes('rut'));
  assert.ok(combined.includes('moradia não é'));
  assert.ok(combined.includes('ponte de'));
});

test('resolvePartnerPortrait maps all partner categories to valid generated editorial portraits', () => {
  assert.equal(resolvePartnerPortrait('Imobiliária'), PARTNER_PORTRAIT_BY_SPECIALTY.imobiliaria);
  assert.equal(resolvePartnerPortrait('Tradutor Juramentado'), PARTNER_PORTRAIT_BY_SPECIALTY.traducao);
  assert.equal(resolvePartnerPortrait('Cartório / Apostilamento'), PARTNER_PORTRAIT_BY_SPECIALTY.traducao);
  assert.equal(resolvePartnerPortrait('Contabilidade / Abertura Empresa'), PARTNER_PORTRAIT_BY_SPECIALTY.contabilidade);
  assert.equal(resolvePartnerPortrait('Escritório de Advocacia'), PARTNER_PORTRAIT_BY_SPECIALTY.advocacia);
});

test('buildPartnerValidationSeals returns localized validation seals for live partners', () => {
  const ptSeals = buildPartnerValidationSeals(
    { categoria: 'Imobiliária', pais: 'Chile', avaliacao: 4.9 },
    'pt-BR',
  );
  assert.deepEqual(ptSeals, [
    'Selo Curadoria D&M',
    'Ponte de Indicação Direta',
    'Atuação Local no Chile',
  ]);

  const esSeals = buildPartnerValidationSeals(
    { categoria: 'Escritório de Advocacia', pais: 'Ambos', avaliacao: 5 },
    'es-CL',
  );
  assert.deepEqual(esSeals, [
    'Sello Curaduría D&M',
    'Puente de Indicación Directa',
    'Cobertura Brasil–Chile',
  ]);
});
