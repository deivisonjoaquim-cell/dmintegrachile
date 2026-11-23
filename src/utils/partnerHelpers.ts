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

export type PartnerMacroGroupId =
  | 'Todos'
  | 'Juridico'
  | 'Imobiliario'
  | 'Financeiro'
  | 'Documental'
  | 'SaudeEducacao'
  | 'Operacional';

export interface PartnerMacroGroup {
  id: PartnerMacroGroupId;
  labelPt: string;
  labelEs: string;
  categories: readonly PartnerCategory[];
}

export const PARTNER_MACRO_GROUPS: readonly PartnerMacroGroup[] = [
  {
    id: 'Todos',
    labelPt: 'Todas as áreas',
    labelEs: 'Todas las áreas',
    categories: PARTNER_CATEGORIES,
  },
  {
    id: 'Juridico',
    labelPt: 'Jurídico',
    labelEs: 'Jurídico',
    categories: ['Escritório de Advocacia'],
  },
  {
    id: 'Imobiliario',
    labelPt: 'Imobiliário',
    labelEs: 'Inmobiliario',
    categories: ['Imobiliária'],
  },
  {
    id: 'Financeiro',
    labelPt: 'Financeiro',
    labelEs: 'Financiero',
    categories: ['Contabilidade / Abertura Empresa'],
  },
  {
    id: 'Documental',
    labelPt: 'Documental',
    labelEs: 'Documental',
    categories: ['Tradutor Juramentado', 'Cartório / Apostilamento'],
  },
  {
    id: 'SaudeEducacao',
    labelPt: 'Saúde & Educação',
    labelEs: 'Salud y Educación',
    categories: ['Seguradora / Saúde', 'Escola / Universidade'],
  },
  {
    id: 'Operacional',
    labelPt: 'Operacional',
    labelEs: 'Operativo',
    categories: ['Despachante', 'Outro'],
  },
] as const;

export function matchesPartnerMacroGroup(
  category: string,
  macroGroup: PartnerMacroGroupId = 'Todos',
): boolean {
  if (macroGroup === 'Todos') return true;
  const group = PARTNER_MACRO_GROUPS.find((g) => g.id === macroGroup);
  if (!group) return true;
  return (group.categories as readonly string[]).includes(category);
}

export function getPartnerMacroGroupLabel(
  macroGroup: PartnerMacroGroupId,
  locale: 'pt-BR' | 'es-CL',
): string {
  const group = PARTNER_MACRO_GROUPS.find((g) => g.id === macroGroup);
  if (!group) return macroGroup;
  return locale === 'es-CL' ? group.labelEs : group.labelPt;
}

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

/**
 * Validates partner logo / representative image URLs.
 * Allows https/http URLs, local app asset paths (/uploads/, /assets/, /src/assets/, /images/),
 * and inline base64 image data URLs (webp, png, jpeg, svg+xml, x-icon).
 */
export function sanitizePartnerImageUrl(raw?: string | null): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed || trimmed.length > 800000) return null;

  if (/^data:image\/(?:webp|png|jpeg|jpg|svg\+xml|x-icon|vnd\.microsoft\.icon);base64,[a-zA-Z0-9+/=\s]+$/i.test(trimmed)) {
    return trimmed;
  }

  if (/^\/(?:uploads|assets|src\/assets|images)\/[a-zA-Z0-9._\-/]+$/i.test(trimmed) && !trimmed.includes('..')) {
    return trimmed;
  }

  if (/^(javascript|vbscript|file|data):/i.test(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
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
  macroGroup?: PartnerMacroGroupId;
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

    if (filters.macroGroup && filters.macroGroup !== 'Todos') {
      if (!matchesPartnerMacroGroup(p.categoria, filters.macroGroup)) {
        return false;
      }
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

/**
 * Extracts a normalized external URL stored inside a proposal message
 * (e.g., "Site/Instagram: https://...") and returns both the URL and cleaned message.
 */
export function extractPartnerWebsiteFromMessage(rawMessage?: string | null): {
  siteInstagram: string;
  cleanedMessage: string;
} {
  const text = (rawMessage || '').trim();
  if (!text) return { siteInstagram: '', cleanedMessage: '' };

  const lines = text.split(/\r?\n/);
  let extractedUrl = '';
  const remaining: string[] = [];

  for (const line of lines) {
    const match = line.match(/^\s*Site\/Instagram\s*:\s*(.+)$/i);
    if (match && !extractedUrl) {
      const normalized = normalizePartnerExternalUrl(match[1]);
      if (normalized) {
        extractedUrl = normalized;
        continue;
      }
    }
    remaining.push(line);
  }

  return {
    siteInstagram: extractedUrl,
    cleanedMessage: remaining.join('\n').trim(),
  };
}

export interface PartnerProposalValidationInput {
  nomeEmpresa: string;
  responsavel: string;
  whatsapp: string;
  email: string;
  siteOuInstagram?: string;
  logoUrl?: string;
  honeypot?: string;
  locale: 'pt-BR' | 'es-CL';
}

export function validatePartnerProposalInput(
  input: PartnerProposalValidationInput,
): { ok: true; normalizedSite: string | null; sanitizedLogo: string | null } | { ok: false; error: string } {
  const isEs = input.locale === 'es-CL';

  if ((input.honeypot || '').trim() !== '') {
    return {
      ok: false,
      error: isEs ? 'Envío bloqueado por validación anti-spam.' : 'Envio bloqueado por validação anti-spam.',
    };
  }

  if (input.nomeEmpresa.trim().length < 2) {
    return {
      ok: false,
      error: isEs
        ? 'Ingresa el nombre completo de tu empresa o consulta profesional.'
        : 'Informe o nome completo da empresa ou profissional.',
    };
  }

  if (input.responsavel.trim().length < 2) {
    return {
      ok: false,
      error: isEs
        ? 'Ingresa el nombre de la persona responsable.'
        : 'Informe o nome completo do responsável.',
    };
  }

  const phoneDigits = input.whatsapp.replace(/\D/g, '');
  if (phoneDigits.length < 8 || input.whatsapp.trim().length > 40) {
    return {
      ok: false,
      error: isEs
        ? 'Ingresa un número de WhatsApp válido con código de país y área (mínimo 8 dígitos).'
        : 'Informe um WhatsApp válido com DDD/DDI (mínimo de 8 dígitos).',
    };
  }

  const emailTrimmed = input.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailTrimmed) || emailTrimmed.length > 200) {
    return {
      ok: false,
      error: isEs
        ? 'Ingresa un correo electrónico corporativo válido.'
        : 'Informe um e-mail corporativo válido.',
    };
  }

  const siteTrimmed = (input.siteOuInstagram || '').trim();
  const normalizedSite = siteTrimmed ? normalizePartnerExternalUrl(siteTrimmed) : null;
  if (siteTrimmed && !normalizedSite) {
    return {
      ok: false,
      error: isEs
        ? 'Ingresa un sitio web válido (https://...) o un usuario de Instagram (@perfil).'
        : 'Informe um site válido (https://...) ou um perfil de Instagram (@usuario).',
    };
  }

  const logoTrimmed = (input.logoUrl || '').trim();
  const sanitizedLogo = logoTrimmed ? sanitizePartnerImageUrl(logoTrimmed) : null;
  if (logoTrimmed && !sanitizedLogo) {
    return {
      ok: false,
      error: isEs
        ? 'Ingresa una URL de imagen válida (https://...) o sube un archivo de imagen.'
        : 'Informe uma URL de imagem válida (https://...) ou envie um arquivo de imagem.',
    };
  }
  if (sanitizedLogo && sanitizedLogo.length > 300000) {
    return {
      ok: false,
      error: isEs
        ? 'La imagen supera el tamaño máximo permitido (300 KB). Intenta con un archivo más ligero.'
        : 'A imagem excede o limite permitido (300 KB). Envie um arquivo mais leve.',
    };
  }

  return { ok: true, normalizedSite, sanitizedLogo };
}
