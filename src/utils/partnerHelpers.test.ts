import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Partner, PartnerProposal, PartnerPublic } from '../types/domain';
import {
  computePartnerNetworkMetrics,
  extractPartnerWebsiteFromMessage,
  filterAndSortPublicPartners,
  getPartnerMacroGroupLabel,
  matchesPartnerMacroGroup,
  normalizePartnerExternalUrl,
  PARTNER_CATEGORIES,
  PARTNER_MACRO_GROUPS,
  sanitizePartnerImageUrl,
  translatePartnerCategory,
  validatePartnerProposalInput,
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
  {
    id: 'p4',
    nome: 'Cordillera Contabilidade & SpA',
    categoria: 'Contabilidade / Abertura Empresa',
    pais: 'Chile',
    cidadeRegiao: 'Las Condes, Santiago',
    whatsapp: '+56 9 6666 3322',
    siteInstagram: 'https://cordilleraspa.cl',
    avaliacao: 5,
    descricaoPublica: 'Abertura de SpA, contabilidade e SII para brasileiros.',
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

  it('filters public partners by country (including binational Ambos), category, macro group, search and sort order', () => {
    const chileMatches = filterAndSortPublicPartners(SAMPLE_PUBLIC, {
      search: '',
      pais: 'Chile',
      categoria: 'Todas',
      sortBy: 'avaliacao',
    });
    assert.deepEqual(
      chileMatches.map((p) => p.id),
      ['p3', 'p4', 'p2'],
    );

    const searchMatches = filterAndSortPublicPartners(SAMPLE_PUBLIC, {
      search: 'santiago',
      pais: 'Todos',
      categoria: 'Todas',
      sortBy: 'nome',
    });
    assert.deepEqual(
      searchMatches.map((p) => p.id),
      ['p3', 'p4', 'p2'],
    );

    const juridicoMatches = filterAndSortPublicPartners(SAMPLE_PUBLIC, {
      search: '',
      pais: 'Todos',
      categoria: 'Todas',
      macroGroup: 'Juridico',
      sortBy: 'nome',
    });
    assert.deepEqual(
      juridicoMatches.map((p) => p.id),
      ['p3'],
    );

    const financeiroMatches = filterAndSortPublicPartners(SAMPLE_PUBLIC, {
      search: '',
      pais: 'Todos',
      categoria: 'Todas',
      macroGroup: 'Financeiro',
      sortBy: 'nome',
    });
    assert.deepEqual(
      financeiroMatches.map((p) => p.id),
      ['p4'],
    );

    assert.equal(matchesPartnerMacroGroup('Imobiliária', 'Imobiliario'), true);
    assert.equal(matchesPartnerMacroGroup('Tradutor Juramentado', 'Documental'), true);
    assert.equal(matchesPartnerMacroGroup('Imobiliária', 'Juridico'), false);
    assert.ok(PARTNER_MACRO_GROUPS.length >= 6);
    assert.equal(getPartnerMacroGroupLabel('Imobiliario', 'es-CL'), 'Inmobiliario');
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

  it('extracts Site/Instagram metadata cleanly from proposal messages', () => {
    const extracted = extractPartnerWebsiteFromMessage(
      'Atendimento bilíngue em Santiago.\nSite/Instagram: https://escritorioandes.cl\nEquipe com 10 anos de mercado.',
    );
    assert.equal(extracted.siteInstagram, 'https://escritorioandes.cl/');
    assert.equal(
      extracted.cleanedMessage,
      'Atendimento bilíngue em Santiago.\nEquipe com 10 anos de mercado.',
    );

    const noSite = extractPartnerWebsiteFromMessage('Apenas apresentação institucional.');
    assert.equal(noSite.siteInstagram, '');
    assert.equal(noSite.cleanedMessage, 'Apenas apresentação institucional.');
  });

  it('validates partner proposal submissions matching Firestore security rules in PT-BR and ES-CL', () => {
    const valid = validatePartnerProposalInput({
      nomeEmpresa: 'Estudio Andes Legal',
      responsavel: 'Camila Rojas',
      whatsapp: '+56 9 8888 7766',
      email: 'contacto@andeslegal.cl',
      siteOuInstagram: '@andeslegal',
      logoUrl: 'https://cdn.andeslegal.cl/logo.webp',
      honeypot: '',
      locale: 'pt-BR',
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.normalizedSite, 'https://instagram.com/andeslegal');
      assert.equal(valid.sanitizedLogo, 'https://cdn.andeslegal.cl/logo.webp');
    }

    const shortPhone = validatePartnerProposalInput({
      nomeEmpresa: 'Empresa Teste',
      responsavel: 'João Silva',
      whatsapp: '1234',
      email: 'joao@empresa.com',
      siteOuInstagram: '',
      logoUrl: '',
      honeypot: '',
      locale: 'pt-BR',
    });
    assert.equal(shortPhone.ok, false);

    const badEmailEs = validatePartnerProposalInput({
      nomeEmpresa: 'Empresa Chile',
      responsavel: 'Matías Pérez',
      whatsapp: '+56 9 8765 4321',
      email: 'invalido',
      siteOuInstagram: '',
      logoUrl: '',
      honeypot: '',
      locale: 'es-CL',
    });
    assert.equal(badEmailEs.ok, false);

    const botTrap = validatePartnerProposalInput({
      nomeEmpresa: 'Spam Bot Co',
      responsavel: 'Bot',
      whatsapp: '+55 11 99999-0000',
      email: 'bot@spam.com',
      siteOuInstagram: '',
      logoUrl: '',
      honeypot: 'http://spam.link',
      locale: 'pt-BR',
    });
    assert.equal(botTrap.ok, false);
  });
});

