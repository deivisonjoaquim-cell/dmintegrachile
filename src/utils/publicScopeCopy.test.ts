import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasLegacyHousingPromise,
  hasLegacyPdiReference,
  normalizePublicScopeText,
} from './publicScopeCopy';

test('detects legacy housing guarantee phrases reliably', () => {
  assert.equal(
    hasLegacyHousingPromise(
      'Mude-se para o Chile com segurança jurídica, moradia garantida e zero dor de cabeça burocrática.',
    ),
    true,
  );
  assert.equal(
    hasLegacyHousingPromise('Apoio do visto ao arriendo sem fiador local'),
    true,
  );
  assert.equal(
    hasLegacyHousingPromise(
      'Conquiste seu visto e RUT no Chile com segurança jurídica.',
    ),
    false,
  );
});

test('upgrades exact legacy Firestore hero title to accurate Visto e RUT scope without PDI', () => {
  const result = normalizePublicScopeText(
    'Mude-se para o Chile com segurança jurídica, moradia garantida e zero dor de cabeça burocrática.',
  );
  assert.equal(hasLegacyHousingPromise(result), false);
  assert.equal(hasLegacyPdiReference(result), false);
  assert.match(result, /visto e RUT/i);
});

test('upgrades legacy journey and footer copy without leaving housing promises or PDI', () => {
  const journey = normalizePublicScopeText(
    'Da decisão no Brasil às chaves da sua casa no Chile, em 4 fases claras',
  );
  const footer = normalizePublicScopeText(
    'Acompanhamento jurídico e humano para brasileiros que querem viver no Chile com segurança, moradia certa e zero dor de cabeça burocrática.',
  );

  assert.equal(hasLegacyHousingPromise(journey), false);
  assert.equal(hasLegacyPdiReference(journey), false);
  assert.match(journey, /visto aprovado e RUT/i);
  assert.equal(hasLegacyHousingPromise(footer), false);
  assert.equal(hasLegacyPdiReference(footer), false);
  assert.match(footer, /parceiros/i);
});

test('strips legacy PDI references from stored Firestore CMS copy cleanly', () => {
  const legacyHero = normalizePublicScopeText(
    'Atuamos exclusivamente na assessoria de imigração (Vistos SERMIG, PDI e RUT).',
  );
  assert.equal(hasLegacyPdiReference(legacyHero), false);
  assert.match(legacyHero, /Vistos SERMIG e RUT/i);
});

test('preserves intentional custom admin copy unchanged', () => {
  const custom = 'Assessoria boutique para executivos brasileiros em Santiago.';
  assert.equal(normalizePublicScopeText(custom), custom);
});

test('falls back to regex sanitization for partially edited legacy copy', () => {
  const partial = 'Mudança segura com moradia garantida e arriendo sem fiador local.';
  const sanitized = normalizePublicScopeText(partial);
  assert.equal(hasLegacyHousingPromise(sanitized), false);
  assert.equal(hasLegacyPdiReference(sanitized), false);
  assert.match(sanitized, /visto e RUT/i);
  assert.match(sanitized, /parceiros imobiliários/i);
});
