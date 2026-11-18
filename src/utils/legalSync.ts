import type { LegalSource, VisaCategory } from '../types/domain';
import { parseFlexibleDate } from './formatters';

export const GENERIC_OFFICIAL_URLS = new Set([
  '',
  'https://www.bcn.cl/leychile',
  'https://www.planalto.gov.br',
  'https://www.cnj.jus.br',
  'https://www.mercosur.int',
]);

export function isLegalSourceOutdated(source: LegalSource, diasAlerta = 90, nowMs = Date.now()): boolean {
  if (source.statusVigencia === 'Revogada') return false;
  if (!source.ultimaVerificacao) return true;
  const parsed = parseFlexibleDate(source.ultimaVerificacao);
  if (!parsed) return true;
  const diffDays = Math.floor((nowMs - parsed.getTime()) / 86400000);
  return diffDays > diasAlerta;
}

export function countLegalReviewPending(
  sources: LegalSource[],
  diasAlerta = 90,
  nowMs = Date.now(),
): {
  aVerificar: number;
  outdated: number;
  totalAttention: number;
} {
  let aVerificar = 0;
  let outdated = 0;
  let totalAttention = 0;

  for (const s of sources) {
    const needsVerify = s.statusVigencia === 'A verificar';
    const isOutdated = isLegalSourceOutdated(s, diasAlerta, nowMs);
    if (needsVerify) aVerificar += 1;
    if (isOutdated) outdated += 1;
    if (needsVerify || isOutdated) totalAttention += 1;
  }

  return { aVerificar, outdated, totalAttention };
}

export function canSafelyUpgradeSeedSource(existing: LegalSource | undefined, seed: LegalSource): boolean {
  if (!existing) return true;
  if (existing.statusVigencia === 'Alterada' || existing.statusVigencia === 'Revogada') return false;
  if (existing.notasInternasConsultor && existing.notasInternasConsultor.trim().length > 0) return false;
  if (existing.versao && existing.versao !== '1.0') return false;

  const hasGenericUrl = GENERIC_OFFICIAL_URLS.has((existing.linkOficial || '').trim());
  const seedHasSpecificUrl = !GENERIC_OFFICIAL_URLS.has((seed.linkOficial || '').trim());
  const needsStatusUpgrade = existing.statusVigencia === 'A verificar' && seed.statusVigencia === 'Vigente';
  const needsTitleOrSummaryFix =
    existing.id === 'leg_dec_5852' &&
    existing.titulo.includes('Promulgação Acordo Mercosul') &&
    seed.titulo !== existing.titulo;

  return (hasGenericUrl && seedHasSpecificUrl) || needsStatusUpgrade || needsTitleOrSummaryFix;
}

export function buildOfficialLegalCatalogDiff(
  currentSources: LegalSource[],
  currentVisas: VisaCategory[],
  seedSources: LegalSource[],
  seedVisas: VisaCategory[],
): {
  sourcesToUpsert: LegalSource[];
  visasToUpsert: VisaCategory[];
} {
  const existingSourceMap = new Map(currentSources.map((s) => [s.id, s]));
  const sourcesToUpsert: LegalSource[] = [];

  for (const seed of seedSources) {
    const existing = existingSourceMap.get(seed.id);
    if (!existing) {
      sourcesToUpsert.push(seed);
    } else if (canSafelyUpgradeSeedSource(existing, seed)) {
      sourcesToUpsert.push({
        ...existing,
        ...seed,
        favoritoPorUids: existing.favoritoPorUids,
        arquivoPdfUrl: existing.arquivoPdfUrl || seed.arquivoPdfUrl,
        textoIntegral: existing.textoIntegral || seed.textoIntegral,
        historicoVersoes: existing.historicoVersoes,
      });
    }
  }

  const existingVisaMap = new Map(currentVisas.map((v) => [v.id, v]));
  const visasToUpsert: VisaCategory[] = [];

  for (const seedVisa of seedVisas) {
    const existing = existingVisaMap.get(seedVisa.id);
    if (!existing) {
      visasToUpsert.push(seedVisa);
      continue;
    }
    const existingLinks = existing.legalSourceIds || [];
    const seedLinks = seedVisa.legalSourceIds || [];
    const missingLinks = seedLinks.some((id) => !existingLinks.includes(id));
    const needsVerifUpgrade =
      existing.statusVerificacao === 'A verificar' && seedVisa.statusVerificacao === 'Verificado';

    if (missingLinks || needsVerifUpgrade || existing.codigo === '15') {
      const mergedLinks = Array.from(new Set([...existingLinks, ...seedLinks]));
      visasToUpsert.push({
        ...existing,
        legalSourceIds: mergedLinks,
        statusVerificacao: needsVerifUpgrade || existing.codigo === '15' ? seedVisa.statusVerificacao : existing.statusVerificacao,
        ultimaVerificacao:
          needsVerifUpgrade || existing.codigo === '15'
            ? seedVisa.ultimaVerificacao || existing.ultimaVerificacao
            : existing.ultimaVerificacao,
        fonteUrl: existing.fonteUrl || seedVisa.fonteUrl,
      });
    }
  }

  return { sourcesToUpsert, visasToUpsert };
}
