import assert from 'node:assert/strict';
import test from 'node:test';
import { SEED_PARTNERS } from '../data/seeds';
import type { PartnerPublic } from '../types/domain';
import {
  calculateHaversineKm,
  classifyPartnerMacroCategory,
  computeChileGeoDistribution,
  resolvePartnersWithGeo,
} from './partnerGeolocation';

test('resolvePartnersWithGeo maps all seed partners including Chile Imobiliário and Jurídico hubs', () => {
  const pubs = SEED_PARTNERS.map((p) => p.pub);
  const resolved = resolvePartnersWithGeo(pubs);

  assert.equal(resolved.length, pubs.length);

  const summary = computeChileGeoDistribution(resolved);
  assert.ok(summary.chileCount >= 6, 'Should have at least 6 mapped partners in Chile');
  assert.ok(summary.imobiliarioCount >= 3, 'Should include at least 3 Imobiliário partners');
  assert.ok(summary.juridicoCount >= 2, 'Should include at least 2 Jurídico partners');
  assert.ok(summary.hubs.length >= 4, 'Should cover multiple Chilean comunas/regions');
});

test('resolvePartnersWithGeo prevents coordinate collision for custom partners in the same comuna', () => {
  const customPartners: PartnerPublic[] = [
    {
      id: 'custom_1',
      nome: 'Imobiliária A',
      categoria: 'Imobiliária',
      pais: 'Chile',
      cidadeRegiao: 'Las Condes, Santiago',
      whatsapp: '+56 9 1111 1111',
      siteInstagram: '',
      avaliacao: 5,
      descricaoPublica: 'Teste A',
      recomendadoAosClientes: true,
      statusHomologacao: 'Ativo/Indicado',
    },
    {
      id: 'custom_2',
      nome: 'Advocacia B',
      categoria: 'Escritório de Advocacia',
      pais: 'Chile',
      cidadeRegiao: 'Las Condes, Santiago',
      whatsapp: '+56 9 2222 2222',
      siteInstagram: '',
      avaliacao: 5,
      descricaoPublica: 'Teste B',
      recomendadoAosClientes: true,
      statusHomologacao: 'Ativo/Indicado',
    },
  ];

  const resolved = resolvePartnersWithGeo(customPartners);
  assert.equal(resolved.length, 2);
  assert.equal(resolved[0].isChile, true);
  assert.equal(resolved[1].isChile, true);
  assert.notDeepEqual(resolved[0].position, resolved[1].position);
});

test('classifyPartnerMacroCategory maps categories cleanly', () => {
  assert.equal(classifyPartnerMacroCategory('Imobiliária'), 'Imobiliario');
  assert.equal(classifyPartnerMacroCategory('Escritório de Advocacia'), 'Juridico');
  assert.equal(classifyPartnerMacroCategory('Contabilidade / Abertura Empresa'), 'Financeiro');
  assert.equal(classifyPartnerMacroCategory('Tradutor Juramentado'), 'Documental');
  assert.equal(classifyPartnerMacroCategory('Seguradora / Saúde'), 'SaudeEducacao');
});

test('calculateHaversineKm returns accurate Santiago to Viña del Mar distance', () => {
  const santiago = { lat: -33.4489, lng: -70.6693 };
  const vina = { lat: -33.0153, lng: -71.5505 };
  const km = calculateHaversineKm(santiago, vina);
  assert.ok(km > 90 && km < 115, `Expected ~95-105km, got ${km}`);
});
