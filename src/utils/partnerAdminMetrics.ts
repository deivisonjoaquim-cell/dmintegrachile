import type { Partner, PartnerCategory } from '../types/domain';
import {
  isPartnerPublishedPublicly,
  matchesPartnerMacroGroup,
  PARTNER_MACRO_GROUPS,
  type PartnerMacroGroupId,
} from './partnerHelpers';

export type PartnerAdminSortBy = 'avaliacao' | 'recentes' | 'nome' | 'publicados' | 'completude';

export interface PartnerProfileCompleteness {
  scorePct: number;
  filledCount: number;
  totalChecks: number;
  missingLabels: string[];
  readyToPublish: boolean;
}

export function evaluatePartnerCompleteness(partner: Partner): PartnerProfileCompleteness {
  const checks: Array<{ ok: boolean; label: string }> = [
    { ok: Boolean(partner.nome?.trim()), label: 'Nome' },
    { ok: Boolean(partner.whatsapp?.trim() || partner.email?.trim()), label: 'Contato' },
    { ok: Boolean(partner.cidadeRegiao?.trim()), label: 'Cidade/Região' },
    { ok: Boolean(partner.descricaoPublica?.trim() && partner.descricaoPublica.trim().length >= 20), label: 'Descrição pública' },
    { ok: Boolean(partner.tabelaValoresComissao?.trim()), label: 'Regra de comissão' },
    { ok: Boolean(partner.logoUrl?.trim()), label: 'Logo/Foto' },
  ];

  const filledCount = checks.filter((c) => c.ok).length;
  const missingLabels = checks.filter((c) => !c.ok).map((c) => c.label);
  const scorePct = Math.round((filledCount / checks.length) * 100);
  const readyToPublish = Boolean(
    partner.nome?.trim() &&
      (partner.whatsapp?.trim() || partner.email?.trim()) &&
      partner.descricaoPublica?.trim(),
  );

  return {
    scorePct,
    filledCount,
    totalChecks: checks.length,
    missingLabels,
    readyToPublish,
  };
}

export interface PartnerPillarCoverage {
  groupId: PartnerMacroGroupId;
  label: string;
  totalCount: number;
  publishedCount: number;
  hasGap: boolean;
}

export function computePartnerEcosystemCoverage(partners: Partner[]): PartnerPillarCoverage[] {
  const macroPillars = PARTNER_MACRO_GROUPS.filter((g) => g.id !== 'Todos');
  return macroPillars.map((group) => {
    const matched = partners.filter((p) => matchesPartnerMacroGroup(p.categoria, group.id));
    const publishedCount = matched.filter((p) => isPartnerPublishedPublicly(p)).length;
    return {
      groupId: group.id,
      label: group.labelPt,
      totalCount: matched.length,
      publishedCount,
      hasGap: publishedCount === 0,
    };
  });
}

export function sortAdminPartners(partners: Partner[], sortBy: PartnerAdminSortBy): Partner[] {
  const copy = [...partners];
  copy.sort((a, b) => {
    if (sortBy === 'nome') {
      return a.nome.localeCompare(b.nome, 'pt-BR');
    }
    if (sortBy === 'publicados') {
      const pubDiff = Number(isPartnerPublishedPublicly(b)) - Number(isPartnerPublishedPublicly(a));
      if (pubDiff !== 0) return pubDiff;
      return (b.avaliacao || 0) - (a.avaliacao || 0);
    }
    if (sortBy === 'completude') {
      const compDiff = evaluatePartnerCompleteness(b).scorePct - evaluatePartnerCompleteness(a).scorePct;
      if (compDiff !== 0) return compDiff;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    }
    if (sortBy === 'recentes') {
      const tB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      const tA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      if (tB !== tA) return tB - tA;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    }
    // Default: avaliacao
    const ratingDiff = (b.avaliacao || 0) - (a.avaliacao || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return Number(isPartnerPublishedPublicly(b)) - Number(isPartnerPublishedPublicly(a));
  });
  return copy;
}

export function buildClientPartnerReferralMessage(partner: Partner, empresaName = 'D&M Integra Chile'): string {
  const cityText = partner.cidadeRegiao ? ` (${partner.cidadeRegiao} · ${partner.pais})` : ` (${partner.pais})`;
  const contactLine = partner.whatsapp
    ? `WhatsApp do parceiro: ${partner.whatsapp}`
    : partner.email
      ? `E-mail do parceiro: ${partner.email}`
      : 'Contato disponível na vitrine de parceiros.';

  const scopeDisclaimer =
    partner.categoria === 'Imobiliária'
      ? 'Lembrando com total transparência que a D&M Integra Chile atua exclusivamente na assessoria de imigração (Visto e RUT) e não garante moradia — atuamos apenas como ponte de indicação para profissionais independentes de confiança.'
      : 'Lembrando com total transparência que a D&M Integra Chile atua exclusivamente na assessoria de imigração (Visto e RUT); esta é uma indicação curada de profissional independente parceiro.';

  return (
    `Indicação de Parceiro Verificado — ${empresaName}\n\n` +
    `Profissional/Empresa: ${partner.nome}\n` +
    `Especialidade: ${partner.categoria}${cityText}\n` +
    `${contactLine}\n` +
    `${partner.siteInstagram ? `Site/Instagram: ${partner.siteInstagram}\n` : ''}` +
    `${partner.descricaoPublica ? `\nSobre o serviço: ${partner.descricaoPublica}\n` : ''}` +
    `\n${scopeDisclaimer}`
  );
}

export interface PartnerQuickTemplate {
  id: string;
  label: string;
  categoria: PartnerCategory;
  pais: 'Brasil' | 'Chile' | 'Ambos';
  cidadeRegiao: string;
  moedaNegociacao: 'BRL' | 'CLP' | 'USD';
  descricaoPublica: string;
  condicoesParceria: string;
}

export const PARTNER_QUICK_TEMPLATES: PartnerQuickTemplate[] = [
  {
    id: 'tpl_imobiliaria_cl',
    label: 'Imobiliária / Corretor (Santiago)',
    categoria: 'Imobiliária',
    pais: 'Chile',
    cidadeRegiao: 'Providencia / Las Condes, Santiago',
    moedaNegociacao: 'CLP',
    descricaoPublica:
      'Corretor independente indicado para apoiar brasileiros na busca de imóveis, visitas e conferência de contrato de locação em Santiago.',
    condicoesParceria: 'Atuação 100% independente da assessoria migratória (apenas ponte de indicação).',
  },
  {
    id: 'tpl_juridico_cl',
    label: 'Advogado / Jurídico Binacional',
    categoria: 'Escritório de Advocacia',
    pais: 'Ambos',
    cidadeRegiao: 'Las Condes, Santiago · São Paulo',
    moedaNegociacao: 'USD',
    descricaoPublica:
      'Assessoria jurídica independente para contratos internacionais, estrutura societária e planejamento patrimonial Brasil–Chile.',
    condicoesParceria: 'Primeira triagem com condição diferenciada para clientes indicados pela D&M.',
  },
  {
    id: 'tpl_tradutor_br',
    label: 'Tradutor Juramentado (BR)',
    categoria: 'Tradutor Juramentado',
    pais: 'Brasil',
    cidadeRegiao: 'Atendimento Nacional (Online)',
    moedaNegociacao: 'BRL',
    descricaoPublica:
      'Traduções juramentadas de certidões civis, diplomas e antecedentes no padrão exigido para protocolos migratórios no Chile.',
    condicoesParceria: 'Prazo expresso e envio digital assinado com certificado ICP-Brasil.',
  },
  {
    id: 'tpl_contabil_cl',
    label: 'Contabilidade & Câmbio / SpA',
    categoria: 'Contabilidade / Abertura Empresa',
    pais: 'Chile',
    cidadeRegiao: 'Santiago Centro / Providencia',
    moedaNegociacao: 'CLP',
    descricaoPublica:
      'Apoio independente para abertura de SpA, RUT empresarial, início de atividades no SII e orientação tributária para brasileiros no Chile.',
    condicoesParceria: 'Atendimento em português e espanhol para clientes indicados.',
  },
];

function csvEscape(val: string | number | boolean | undefined | null): string {
  const str = String(val ?? '');
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildPartnersCsv(partners: Partner[]): string {
  const headers = [
    'Nome',
    'Categoria',
    'Pais',
    'Cidade/Regiao',
    'Status Homologacao',
    'Vitrine Publica',
    'Avaliacao',
    'Contato',
    'WhatsApp',
    'Email',
    'Moeda',
    'Comissao Interna',
    'Condicoes Parceria',
  ];
  const rows = partners.map((p) => [
    p.nome,
    p.categoria,
    p.pais,
    p.cidadeRegiao || '',
    p.statusHomologacao,
    isPartnerPublishedPublicly(p) ? 'Publicado' : 'Oculto',
    Number(p.avaliacao || 5).toFixed(1),
    p.contato || '',
    p.whatsapp || '',
    p.email || '',
    p.moedaNegociacao,
    p.tabelaValoresComissao || '',
    p.condicoesParceria || '',
  ]);

  return [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}
