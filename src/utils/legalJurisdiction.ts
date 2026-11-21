import type { LegalSource } from '../types/domain';

export function getJurisdictionLabel(pais?: string | null): string {
  const normalized = (pais || '').toLowerCase();
  if (normalized.includes('brasil')) return 'Legislação Brasileira';
  if (normalized.includes('internacional') || normalized.includes('mercosul')) {
    return 'Acordo Internacional / Mercosul';
  }
  return 'Legislação Chilena';
}

export function getJurisdictionTextClass(pais?: string | null): string {
  const normalized = (pais || '').toLowerCase();
  if (normalized.includes('brasil')) return 'font-semibold text-emerald-800';
  if (normalized.includes('internacional') || normalized.includes('mercosul')) {
    return 'font-semibold text-amber-800';
  }
  return 'font-semibold text-[#0B1F33]';
}

export function formatLegalSourceWithJurisdiction(
  source: Pick<LegalSource, 'titulo' | 'numeroAno' | 'pais'>,
): string {
  const label = getJurisdictionLabel(source.pais);
  const num = source.numeroAno ? ` (${source.numeroAno})` : '';
  return `${label}: ${source.titulo}${num}`;
}
