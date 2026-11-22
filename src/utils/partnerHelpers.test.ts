import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Partner, PartnerProposal, PartnerPublic } from '../types/domain';
import {
  computePartnerNetworkMetrics,
  filterAndSortPublicPartners,
  normalizePartnerExternalUrl,
  PARTNER_CATEGORIES,
  sanitizePartnerImageUrl,
  translatePartnerCategory,
} from './partnerHelpers';

const SAMPLE_PUBLIC: PartnerPublic[] = [
  {
    id: 'p1',
    nome: 'Andes Traduções Juramentadas',
    categoria: 'Tradutor Juramentado',
    pais: 'Brasil',
    cidadeRegiao: 'São Paulo',
    whatsapp: '+55 11 98888-1122',
    siteInstagram: '@andestraducoes',
    avaliacao: 5,
    descricaoPublica: 'Traduções juramentadas português–espanhol.',
    recomendadoAosClientes: true,
    statusHomologacao: 'Ativo/Indicado',
  },
  {
    id: 'p2',
    nome: 'Providencia Relocation Imóveis',
    categoria: 'Imobiliária',
    pais: 'Chile',
    cidadeRegiao: 'Santiago',
    whatsapp: '+56 9 8888 5566',
    siteInstagram: 'https://providencia.cl',
    avaliacao: 4,
    descricaoPublica: 'Locação em Santiago para recém-chegados.',
    recomendadoAosClientes: true,
    statusHomologacao: 'Ativo/Indicado',
  },
  {
    id: 'p3',
    nome: 'Aliança Jurídica Binacional',
    categoria: 'Escritório de Advocacia',
    pais: 'Ambos',
    cidadeRegiao: 'São Paulo & Santiago',
    whatsapp: '+56 9 7777 4433',
    siteInstagram: 'aliancabinacional.com',
    avaliacao: 5,
    descricaoPublica: 'Assessoria societária e tributária Brasil-Chile.',
    recomendadoAosClientes: true,
    statusHomologacao: 'Ativo/Indicado',
  },
];

describe('partnerHelpers — URL safety, filtering, sorting & metrics', () => {
  it('normalizes valid @handles and domains while blocking unsafe URL schemes', () => {
    assert.equal(normalizePartnerExternalUrl('@andestraducoes'), 'https://instagram.com/andestraducoes');
    assert.equal(normalizePartnerExternalUrl('providencia.cl/imoveis'), 'https://providencia.cl/imoveis');
    assert.equal(normalizePartnerExternalUrl('https://dmintegrachile.com'), 'https://dmintegrachile.com/');
    assert.equal(normalizePartnerExternalUrl('javascript:alert(1)'), null);
    assert.equal(normalizePartnerExternalUrl('data:text/html,<script>alert(1)</script>'), null);
    assert.equal(normalizePartnerExternalUrl('invalid text without dot'), null);
  });

  it('validates partner image/logo URLs safely and rejects dangerous schemes or traversal', () => {
    assert.equal(sanitizePartnerImageUrl('https://cdn.example.com/logo.webp'), 'https://cdn.example.com/logo.webp');
    assert.equal(sanitizePartnerImageUrl('/uploads/partner_logo.webp'), '/uploads/partner_logo.webp');
    assert.equal(
      sanitizePartnerImageUrl('data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA='),
      'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
    );
    assert.equal(sanitizePartnerImageUrl('/uploads/../secret.png'), null);
    assert.equal(sanitizePartnerImageUrl('javascript:alert(1)'), null);
    assert.equal(sanitizePartnerImageUrl('data:text/html;base64,PHNjcmlwdD4='), null);
  });

  it('filters public partners by country (including binational Ambos), category, search and sort order', () => {
    const chileMatches = filterAndSortPublicPartners(SAMPLE_PUBLIC, {
      search: '',
      pais: 'Chile',
      categoria: 'Todas',
      sortBy: 'avaliacao',
    });
    assert.deepEqual(
      chileMatches.map((p) => p.id),
      ['p3', 'p2'],
    );

    const searchMatches = filterAndSortPublicPartners(SAMPLE_PUBLIC, {
      search: 'santiago',
      pais: 'Todos',
      categoria: 'Todas',
      sortBy: 'nome',
    });
    assert.deepEqual(
      searchMatches.map((p) => p.id),
      ['p3', 'p2'],
    );
  });

  it('computes accurate partner network metrics and Chilean Spanish category translations', () => {
    const partners: Array<Pick<Partner, 'pais' | 'categoria' | 'avaliacao' | 'recomendadoAosClientes' | 'statusHomologacao'>> = [
      { pais: 'Brasil', categoria: 'Tradutor Juramentado', avaliacao: 5, recomendadoAosClientes: true, statusHomologacao: 'Ativo/Indicado' },
      { pais: 'Chile', categoria: 'Imobiliária', avaliacao: 4, recomendadoAosClientes: true, statusHomologacao: 'Ativo/Indicado' },
      { pais: 'Ambos', categoria: 'Escritório de Advocacia', avaliacao: 5, recomendadoAosClientes: false, statusHomologacao: 'Em Análise' },
    ];
    const proposals: Array<Pick<PartnerProposal, 'status'>> = [
      { status: 'Nova' },
      { status: 'Em Análise' },
      { status: 'Aprovada' },
      { status: 'Recusada' },
    ];

    const metrics = computePartnerNetworkMetrics(partners, proposals);
    assert.equal(metrics.totalPartners, 3);
    assert.equal(metrics.publishedCount, 2);
    assert.equal(metrics.hiddenCount, 1);
    assert.equal(metrics.uniqueCategories, 3);
    assert.equal(metrics.averageRating, 4.7);
    assert.equal(metrics.pendingProposals, 2);
    assert.equal(metrics.approvedProposals, 1);
    assert.equal(metrics.rejectedProposals, 1);
    assert.ok(PARTNER_CATEGORIES.includes('Tradutor Juramentado'));
    assert.equal(translatePartnerCategory('Imobiliária', 'es-CL'), 'Corretaje Inmobiliario');
  });
});
