import type { Partner, PartnerCategory, PartnerProposal, PartnerPublic } from '../types/domain';

export const PARTNER_CATEGORIES: readonly PartnerCategory[] = [
  'Escritório de Advocacia',
  'Cartório / Apostilamento',
  'Tradutor Juramentado',
  'Seguradora / Saúde',
  'Imobiliária',
  'Escola / Universidade',
  'Despachante',
  'Contabilidade / Abertura Empresa',
  'Outro',
] as const;

const CATEGORY_ES_CL_MAP: Record<string, string> = {
  'Escritório de Advocacia': 'Estudio Jurídico',
  'Cartório / Apostilamento': 'Notaría / Apostilla',
  'Tradutor Juramentado': 'Traductor Oficial',
  'Seguradora / Saúde': 'Seguros / Salud',
  Imobiliária: 'Corretaje Inmobiliario',
  'Escola / Universidade': 'Colegios / Universidades',
  Despachante: 'Gestoría Documental',
  'Contabilidade / Abertura Empresa': 'Contabilidad / Creación de Empresas',
  Outro: 'Otros Servicios',
};

const COUNTRY_ES_CL_MAP: Record<string, string> = {
  Brasil: 'Brasil',
  Chile: 'Chile',
  Ambos: 'Brasil y Chile',
};

export function translatePartnerCategory(category: string, locale: 'pt-BR' | 'es-CL'): string {
  if (locale === 'es-CL') {
    return CATEGORY_ES_CL_MAP[category] || category;
  }
  return category;
}

export function translatePartnerCountry(country: string, locale: 'pt-BR' | 'es-CL'): string {
  if (locale === 'es-CL') {
    return COUNTRY_ES_CL_MAP[country] || country;
  }
  return country === 'Ambos' ? 'Brasil & Chile' : country;
}

/**
 * Normalizes partner website or Instagram handles into safe https:// URLs.
 * Strictly blocks javascript:, data:, vbscript:, or malformed schemes.
 */
export function normalizePartnerExternalUrl(raw?: string | null): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;

  // Reject dangerous or non-web schemes explicitly
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return null;
  }

  let candidate = trimmed;
  if (candidate.startsWith('@')) {
    const handle = candidate.slice(1).replace(/[^a-zA-Z0-9._]/g, '');
    if (!handle) return null;
    candidate = `https://instagram.com/${handle}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    if (candidate.includes(' ') || !candidate.includes('.')) {
      return null;
    }
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export type PublicPartnerSort = 'avaliacao' | 'nome' | 'pais';

export interface PublicPartnerFilters {
  search: string;
  pais: 'Todos' | 'Brasil' | 'Chile' | 'Ambos';
  categoria: string;
  sortBy: PublicPartnerSort;
}

export function filterAndSortPublicPartners(
  partners: PartnerPublic[],
  filters: PublicPartnerFilters,
): PartnerPublic[] {
  const q = filters.search.trim().toLowerCase();

  const filtered = partners.filter((p) => {
    if (filters.pais === 'Ambos') {
      if (p.pais !== 'Ambos') return false;
    } else if (filters.pais !== 'Todos') {
      if (p.pais !== filters.pais && p.pais !== 'Ambos') return false;
    }

    if (filters.categoria !== 'Todas' && p.categoria !== filters.categoria) {
      return false;
    }

    if (q) {
      const haystack = `${p.nome} ${p.categoria} ${p.cidadeRegiao} ${p.descricaoPublica} ${p.pais}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sortBy === 'nome') {
      return a.nome.localeCompare(b.nome, 'pt-BR');
    }
    if (filters.sortBy === 'pais') {
      const countryDiff = a.pais.localeCompare(b.pais, 'pt-BR');
      if (countryDiff !== 0) return countryDiff;
      return b.avaliacao - a.avaliacao;
    }
    // Default: rating desc, then alphabetical
    const ratingDiff = (b.avaliacao || 0) - (a.avaliacao || 0);
    if (ratingDiff !== 0) return ratingDiff;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

export interface PartnerNetworkMetrics {
  totalPartners: number;
  publishedCount: number;
  hiddenCount: number;
  brazilCount: number;
  chileCount: number;
  binationalCount: number;
  uniqueCategories: number;
  averageRating: number;
  pendingProposals: number;
  approvedProposals: number;
  rejectedProposals: number;
}

export function computePartnerNetworkMetrics(
  partners: Array<{
    pais: string;
    categoria: string;
    avaliacao: number;
    recomendadoAosClientes: boolean;
    statusHomologacao: string;
  }>,
  proposals: Array<Pick<PartnerProposal, 'status'>> = [],
): PartnerNetworkMetrics {
  const totalPartners = partners.length;
  let publishedCount = 0;
  let brazilCount = 0;
  let chileCount = 0;
  let binationalCount = 0;
  let ratingSum = 0;
  const categories = new Set<string>();

  for (const p of partners) {
    if (p.recomendadoAosClientes && p.statusHomologacao === 'Ativo/Indicado') {
      publishedCount++;
    }
    if (p.pais === 'Brasil') brazilCount++;
    else if (p.pais === 'Chile') chileCount++;
    else if (p.pais === 'Ambos') binationalCount++;

    if (p.categoria) categories.add(p.categoria);
    ratingSum += Number(p.avaliacao || 0);
  }

  let pendingProposals = 0;
  let approvedProposals = 0;
  let rejectedProposals = 0;
  for (const prop of proposals) {
    if (prop.status === 'Nova' || prop.status === 'Em Análise') pendingProposals++;
    else if (prop.status === 'Aprovada') approvedProposals++;
    else if (prop.status === 'Recusada') rejectedProposals++;
  }

  return {
    totalPartners,
    publishedCount,
    hiddenCount: Math.max(0, totalPartners - publishedCount),
    brazilCount,
    chileCount,
    binationalCount,
    uniqueCategories: categories.size,
    averageRating: totalPartners > 0 ? Number((ratingSum / totalPartners).toFixed(1)) : 0,
    pendingProposals,
    approvedProposals,
    rejectedProposals,
  };
}

export function isPartnerPublishedPublicly(
  partner: Pick<Partner, 'recomendadoAosClientes' | 'statusHomologacao'>,
): boolean {
  return Boolean(partner.recomendadoAosClientes && partner.statusHomologacao === 'Ativo/Indicado');
}

export function formatPhoneByCountry(raw: string, country: 'Brasil' | 'Chile' | 'Ambos'): string {
  const cleaned = raw.replace(/[^\d+()\-\s]/g, '').slice(0, 24);
  if (country === 'Chile') {
    const digits = cleaned.replace(/\D/g, '');
    if (digits.startsWith('56') && digits.length >= 11) {
      return `+56 ${digits.slice(2, 3)} ${digits.slice(3, 7)} ${digits.slice(7, 11)}`;
    }
    return cleaned;
  }
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 11 && !cleaned.startsWith('+')) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.startsWith('55') && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  }
  return cleaned;
}
