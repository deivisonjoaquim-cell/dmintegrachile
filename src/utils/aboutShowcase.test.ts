import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CURATED_ABOUT_TESTIMONIALS,
  OFFICE_OPERATIONS_SLIDES,
  formatSlideCounter,
  getNextSlideIndex,
  getPrevSlideIndex,
  mergeAboutTestimonials,
} from './aboutShowcase';

test('getNextSlideIndex wraps around circularly and handles edge sizes', () => {
  assert.equal(getNextSlideIndex(0, 5), 1);
  assert.equal(getNextSlideIndex(4, 5), 0);
  assert.equal(getNextSlideIndex(-1, 5), 0);
  assert.equal(getNextSlideIndex(0, 1), 0);
  assert.equal(getNextSlideIndex(0, 0), 0);
});

test('getPrevSlideIndex wraps around circularly and handles edge sizes', () => {
  assert.equal(getPrevSlideIndex(0, 5), 4);
  assert.equal(getPrevSlideIndex(3, 5), 2);
  assert.equal(getPrevSlideIndex(0, 1), 0);
  assert.equal(getPrevSlideIndex(2, 0), 0);
});

test('formatSlideCounter formats 1-indexed zero-padded counters safely', () => {
  assert.equal(formatSlideCounter(0, 5), '01 / 05');
  assert.equal(formatSlideCounter(4, 5), '05 / 05');
  assert.equal(formatSlideCounter(99, 5), '05 / 05');
  assert.equal(formatSlideCounter(-2, 5), '01 / 05');
  assert.equal(formatSlideCounter(0, 0), '00 / 00');
});

test('OFFICE_OPERATIONS_SLIDES contains 5 complete daily office scenes', () => {
  assert.equal(OFFICE_OPERATIONS_SLIDES.length, 5);
  for (const slide of OFFICE_OPERATIONS_SLIDES) {
    assert.ok(slide.id.length > 0);
    assert.ok(slide.imageUrl.startsWith('/src/assets/images/'));
    assert.ok(slide.title.length > 10);
    assert.ok(slide.description.length > 20);
  }
});

test('mergeAboutTestimonials prioritizes authorized Firestore testimonials and supplements cleanly', () => {
  const mergedDefault = mergeAboutTestimonials(undefined, 3);
  assert.equal(mergedDefault.length, 3);
  assert.deepEqual(mergedDefault, CURATED_ABOUT_TESTIMONIALS);

  const mergedWithCustom = mergeAboutTestimonials(
    [
      {
        id: 't1',
        nome: 'Mariana Costa',
        cidadeOrigem: 'Porto Alegre → Ñuñoa, Santiago',
        subcategoria: 'Acordo Mercosul',
        depoimento: 'Atendimento claro, ágil e extremamente acolhedor do começo ao fim.',
        autorizado: true,
      },
      {
        id: 't2',
        nome: 'Nao Autorizado',
        depoimento: 'Não deve aparecer.',
        autorizado: false,
      },
    ],
    3,
  );

  assert.equal(mergedWithCustom.length, 3);
  assert.equal(mergedWithCustom[0].nome, 'Mariana Costa');
  assert.equal(mergedWithCustom[0].origemDestino, 'Porto Alegre → Ñuñoa, Santiago');
  assert.equal(mergedWithCustom.some((t) => t.nome === 'Nao Autorizado'), false);
});
