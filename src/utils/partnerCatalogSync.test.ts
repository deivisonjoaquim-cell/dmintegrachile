import test from 'node:test';
import assert from 'node:assert/strict';
import type { PartnerPublic } from '../types/domain';
import {
  findOrphanOrHiddenPublicPartnerIds,
  removePartnerById,
  resolvePublicPartnersFromCloud,
  shouldSeedInitialPartners,
} from './partnerCatalogSync';

const sampleBr: PartnerPublic = {
  id: 'part_br_1',
  nome: 'Cartório Brasil',
  categoria: 'Cartório/Apostilamento',
  pais: 'Brasil',
  cidadeRegiao: 'São Paulo - SP',
  whatsapp: '5511999990000',
  siteInstagram: 'https://cartoriobrasil.example',
  avaliacao: 5,
  descricaoPublica: 'Apostilamento e reconhecimento de firmas.',
  recomendadoAosClientes: true,
  statusHomologacao: 'Ativo/Indicado',
};

const sampleCl: PartnerPublic = {
  id: 'part_cl_1',
  nome: 'Corretora Santiago',
  categoria: 'Imobiliária/Moradia',
  pais: 'Chile',
  cidadeRegiao: 'Santiago - RM',
  whatsapp: '56999990000',
  siteInstagram: 'https://corretorasantiago.example',
  avaliacao: 5,
  descricaoPublica: 'Arriendo para estrangeiros sem fiador local.',
  recomendadoAosClientes: true,
  statusHomologacao: 'Ativo/Indicado',
};

const sampleSuspended: PartnerPublic = {
  id: 'part_susp',
  nome: 'Parceiro Suspenso',
  categoria: 'Outros',
  pais: 'Chile',
  cidadeRegiao: 'Valparaíso',
  whatsapp: '56988880000',
  siteInstagram: '',
  avaliacao: 4,
  descricaoPublica: 'Parceiro desativado para exibição pública.',
  recomendadoAosClientes: false,
  statusHomologacao: 'Ativo/Indicado',
};

test('shouldSeedInitialPartners only seeds brand-new empty workspace once', () => {
  assert.equal(
    shouldSeedInitialPartners({
      configAlreadyExisted: false,
      partnersSeededAt: undefined,
      existingPartnersCount: 0,
      existingPartnersPublicCount: 0,
    }),
    true,
  );
});

test('shouldSeedInitialPartners never resurrects deleted partners on existing workspace', () => {
  // Mesmo que o admin tenha excluído TODOS os parceiros (contagem = 0), não deve re-semear
  assert.equal(
    shouldSeedInitialPartners({
      configAlreadyExisted: true,
      partnersSeededAt: undefined,
      existingPartnersCount: 0,
      existingPartnersPublicCount: 0,
    }),
    false,
  );

  assert.equal(
    shouldSeedInitialPartners({
      configAlreadyExisted: false,
      partnersSeededAt: '2026-11-27T10:00:00.000Z',
      existingPartnersCount: 0,
      existingPartnersPublicCount: 0,
    }),
    false,
  );
});

test('resolvePublicPartnersFromCloud trusts empty cloud array and never injects seeds', () => {
  const result = resolvePublicPartnersFromCloud({
    firestorePartners: [],
    cloudSucceeded: true,
    cachedPartners: [sampleBr, sampleCl],
    fallbackSeeds: [sampleBr, sampleCl],
  });
  assert.deepEqual(result, []);
});

test('resolvePublicPartnersFromCloud trusts cloud list even with fewer than 2 Chile partners', () => {
  const result = resolvePublicPartnersFromCloud({
    firestorePartners: [sampleBr, sampleSuspended],
    cloudSucceeded: true,
    fallbackSeeds: [sampleBr, sampleCl],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'part_br_1');
});

test('resolvePublicPartnersFromCloud falls back to cache when cloud query fails offline', () => {
  const result = resolvePublicPartnersFromCloud({
    firestorePartners: [],
    cloudSucceeded: false,
    cachedPartners: [sampleCl],
    fallbackSeeds: [sampleBr, sampleCl],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'part_cl_1');
});

test('removePartnerById removes deleted partner cleanly', () => {
  const next = removePartnerById([sampleBr, sampleCl], 'part_cl_1');
  assert.equal(next.length, 1);
  assert.equal(next[0].id, 'part_br_1');
});

test('findOrphanOrHiddenPublicPartnerIds catches deleted, hidden, and non-active partners', () => {
  const toDelete = findOrphanOrHiddenPublicPartnerIds(
    [
      { id: 'part_active', recomendadoAosClientes: true, statusHomologacao: 'Ativo/Indicado' },
      { id: 'part_hidden', recomendadoAosClientes: false, statusHomologacao: 'Ativo/Indicado' },
      { id: 'part_paused', recomendadoAosClientes: true, statusHomologacao: 'Suspenso' },
    ],
    ['part_active', 'part_hidden', 'part_paused', 'part_deleted_orphan'],
  );
  assert.deepEqual(toDelete, ['part_hidden', 'part_paused', 'part_deleted_orphan']);
});
