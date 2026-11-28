import assert from 'node:assert/strict';
import test from 'node:test';
import type { Partner } from '../types/domain';
import {
  buildClientPartnerReferralMessage,
  buildPartnersCsv,
  computePartnerEcosystemCoverage,
  evaluatePartnerCompleteness,
  sortAdminPartners,
} from './partnerAdminMetrics';

const FULL_PARTNER: Partner = {
  id: 'p1',
  nome: 'Andes Imóveis Santiago',
  tipoPessoa: 'Pessoa Jurídica',
  categoria: 'Imobiliária',
  pais: 'Chile',
  cidadeRegiao: 'Providencia, Santiago',
  contato: 'Rodrigo',
  whatsapp: '+56911112222',
  email: 'contato@andesimoveis.cl',
  siteInstagram: 'https://andesimoveis.cl',
  logoUrl: 'https://example.com/logo.png',
  moedaNegociacao: 'CLP',
  tabelaValoresComissao: '15% sobre taxa de corretagem',
  condicoesParceria: 'Atendimento em português com contrato formal independente.',
  descricaoPublica: 'Corretor independente indicado para aluguel de médio e longo prazo em Santiago.',
  recomendadoAosClientes: true,
  avaliacao: 4.9,
  statusHomologacao: 'Ativo/Indicado',
  observacoes: 'Parceiro homologado com avaliação positiva.',
  createdAt: '2026-04-01T00:00:00Z',
};

const INCOMPLETE_PARTNER: Partner = {
  id: 'p2',
  nome: 'Borges Traduções',
  tipoPessoa: 'Pessoa Física',
  categoria: 'Tradutor Juramentado',
  pais: 'Brasil',
  cidadeRegiao: '',
  contato: '',
  whatsapp: '',
  email: '',
  siteInstagram: '',
  moedaNegociacao: 'BRL',
  tabelaValoresComissao: '',
  condicoesParceria: '',
  descricaoPublica: '',
  recomendadoAosClientes: false,
  avaliacao: 5.0,
  statusHomologacao: 'Em Análise',
  observacoes: '',
  createdAt: '2026-05-01T00:00:00Z',
};

test('evaluatePartnerCompleteness scores profile fields accurately', () => {
  const full = evaluatePartnerCompleteness(FULL_PARTNER);
  assert.equal(full.scorePct, 100);
  assert.equal(full.missingLabels.length, 0);
  assert.equal(full.readyToPublish, true);

  const partial = evaluatePartnerCompleteness(INCOMPLETE_PARTNER);
  assert.ok(partial.scorePct < 50);
  assert.equal(partial.readyToPublish, false);
  assert.ok(partial.missingLabels.includes('Descrição pública'));
});

test('computePartnerEcosystemCoverage flags pillars with zero published partners', () => {
  const cov = computePartnerEcosystemCoverage([FULL_PARTNER, INCOMPLETE_PARTNER]);
  const imob = cov.find((c) => c.groupId === 'Imobiliario');
  const jur = cov.find((c) => c.groupId === 'Juridico');
  assert.equal(imob?.publishedCount, 1);
  assert.equal(imob?.hasGap, false);
  assert.equal(jur?.publishedCount, 0);
  assert.equal(jur?.hasGap, true);
});

test('sortAdminPartners, referral message disclaimer, and CSV export behave deterministically', () => {
  const byCompleteness = sortAdminPartners([INCOMPLETE_PARTNER, FULL_PARTNER], 'completude');
  assert.equal(byCompleteness[0].id, 'p1');

  const byRecent = sortAdminPartners([FULL_PARTNER, INCOMPLETE_PARTNER], 'recentes');
  assert.equal(byRecent[0].id, 'p2');

  const referral = buildClientPartnerReferralMessage(FULL_PARTNER);
  assert.match(referral, /Visto e RUT/);
  assert.match(referral, /não garante moradia/i);
  assert.doesNotMatch(referral, /\bPDI\b/);

  const csv = buildPartnersCsv([FULL_PARTNER, INCOMPLETE_PARTNER]);
  assert.match(csv, /^Nome,Categoria,Pais/);
  assert.match(csv, /Andes Imóveis Santiago/);
  assert.match(csv, /Publicado/);
});
