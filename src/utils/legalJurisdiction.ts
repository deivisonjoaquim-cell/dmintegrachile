import type { LegalSource } from '../types/domain';

export type LegalJurisdiction = LegalSource['pais'];

/**
 * Rótulo institucional claro indicando se a norma pertence à legislação brasileira,
 * à legislação chilena ou a tratado/acordo internacional (Mercosul).
 */
export function getJurisdictionLabel(pais: LegalJurisdiction): string {
  if (pais === 'Brasil') return 'Legislação Brasileira';
  if (pais === 'Chile') return 'Legislação Chilena';
  return 'Acordo Internacional (Mercosul · Brasil–Chile)';
}

/**
 * Rótulo curto para uso inline em resumos e citações contextuais.
 */
export function getJurisdictionShortLabel(pais: LegalJurisdiction): string {
  if (pais === 'Brasil') return 'Lei / Norma Brasileira';
  if (pais === 'Chile') return 'Lei / Norma Chilena';
  return 'Acordo Internacional (Mercosul)';
}

/**
 * Classe tipográfica discreta (sem pílulas estáticas) para diferenciar visualmente
 * normas chilenas, brasileiras e acordos internacionais.
 */
export function getJurisdictionTextClass(pais: LegalJurisdiction): string {
  if (pais === 'Brasil') return 'text-[#146B43] dark:text-emerald-400 font-semibold';
  if (pais === 'Chile') return 'text-[var(--color-primary)] dark:text-sky-400 font-semibold';
  return 'text-[#9A7618] dark:text-amber-300 font-semibold';
}

/**
 * Formata uma fonte legal completa com indicação explícita da jurisdição.
 */
export function formatLegalSourceWithJurisdiction(
  source: Pick<LegalSource, 'titulo' | 'numeroAno' | 'pais'>,
): string {
  const jurisdicao = getJurisdictionLabel(source.pais);
  const numero = source.numeroAno ? ` (${source.numeroAno})` : '';
  return `${jurisdicao} · ${source.titulo}${numero}`;
}

/**
 * Formata citação compacta inline (ex.: "Ley Nº 21.325 — Legislação Chilena").
 */
export function formatLegalCitationInline(
  source: Pick<LegalSource, 'titulo' | 'numeroAno' | 'pais'>,
): string {
  const shortTitle = source.titulo.split('–')[0].trim();
  const jurisdicao = getJurisdictionLabel(source.pais);
  return `${shortTitle} (${jurisdicao})`;
}
