import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOutsourcedReferralWhatsAppMessage,
  DIRECT_IMMIGRATION_SCOPE_STEPS,
  filterOutsourcedVerticals,
  OUTSOURCED_PARTNER_VERTICALS,
} from './curatedPartnerNetwork';

test('DIRECT_IMMIGRATION_SCOPE_STEPS defines exclusive Visto and RUT scope without PDI', () => {
  assert.equal(DIRECT_IMMIGRATION_SCOPE_STEPS.length, 4);
  const combined = DIRECT_IMMIGRATION_SCOPE_STEPS.map((s) => `${s.titlePt} ${s.detailPt}`).join(' ');
  assert.match(combined, /visto/i);
  assert.match(combined, /SERMIG/i);
  assert.match(combined, /\bRUT\b/);
  assert.doesNotMatch(combined, /\bPDI\b/i);
});

test('OUTSOURCED_PARTNER_VERTICALS explicitly covers imobiliario, juridico and cambio with clear separation disclaimers', () => {
  const ids = OUTSOURCED_PARTNER_VERTICALS.map((v) => v.id);
  assert.deepEqual(ids, ['imobiliario', 'juridico', 'cambio']);

  for (const vertical of OUTSOURCED_PARTNER_VERTICALS) {
    assert.ok(vertical.portraitUrl.startsWith('/src/assets/images/'));
    assert.match(vertical.categoryLabelPt, /terceirizado/i);
    assert.match(vertical.dmRolePt, /ponte/i);
    assert.ok(vertical.deliverablesPt.length >= 3);
    assert.ok(vertical.disclaimerPt.length > 40);
    assert.doesNotMatch(vertical.summaryPt + vertical.disclaimerPt, /\bPDI\b/i);
  }

  const realEstate = OUTSOURCED_PARTNER_VERTICALS.find((v) => v.id === 'imobiliario');
  assert.ok(realEstate);
  assert.match(realEstate.disclaimerPt, /moradia não é um serviço garantido/i);
});

test('filterOutsourcedVerticals filters cleanly by vertical or returns all', () => {
  assert.equal(filterOutsourcedVerticals('todos').length, 3);
  assert.deepEqual(
    filterOutsourcedVerticals('cambio').map((v) => v.id),
    ['cambio'],
  );
  assert.deepEqual(
    filterOutsourcedVerticals('imobiliario').map((v) => v.id),
    ['imobiliario'],
  );
  assert.deepEqual(
    filterOutsourcedVerticals('juridico').map((v) => v.id),
    ['juridico'],
  );
});

test('buildOutsourcedReferralWhatsAppMessage reinforces direct immigration scope and independent contracting', () => {
  const fx = OUTSOURCED_PARTNER_VERTICALS.find((v) => v.id === 'cambio')!;
  const msgPt = buildOutsourcedReferralWhatsAppMessage(fx, 'pt-BR');
  assert.match(msgPt, /consultoria de imigração \(Visto e RUT\)/i);
  assert.match(msgPt, /direta e independente/i);

  const msgEs = buildOutsourcedReferralWhatsAppMessage(fx, 'es-CL');
  assert.match(msgEs, /consultoría de inmigración \(Visa y RUT\)/i);
  assert.match(msgEs, /directa e independiente/i);
});
