import type { PartnerPublic } from '../types/domain';

export interface PartnerSeedDecisionInput {
  configAlreadyExisted: boolean;
  partnersSeededAt?: string | null;
  existingPartnersCount: number;
  existingPartnersPublicCount: number;
}

/**
 * Determina se o catálogo inicial de parceiros (SEED_PARTNERS) deve ser semeado no Firestore.
 *
 * Regra anti-ressurreição:
 * - Só semeia parceiros iniciais na criação de um workspace novo (`!configAlreadyExisted`)
 *   quando não há registro prévio de seed (`!partnersSeededAt`) e ambas coleções estão vazias.
 * - Em workspaces já inicializados (`configAlreadyExisted === true` ou `partnersSeededAt` preenchido),
 *   NUNCA recria parceiros de seed que tenham sido excluídos, suspensos ou ocultados pelo administrador.
 */
export function shouldSeedInitialPartners(input: PartnerSeedDecisionInput): boolean {
  if (input.partnersSeededAt && input.partnersSeededAt.trim().length > 0) {
    return false;
  }
  if (input.configAlreadyExisted) {
    return false;
  }
  return input.existingPartnersCount === 0 && input.existingPartnersPublicCount === 0;
}

/**
 * Resolve a lista pública de parceiros respeitando integralmente o estado da nuvem.
 *
 * - Quando a consulta ao Firestore teve sucesso (`cloudSucceeded === true`), confia 100% no
 *   resultado retornado — inclusive se estiver vazio (`[]`) ou tiver menos de 2 parceiros no Chile.
 *   Nunca re-injeta `SEED_PARTNERS` sobre um catálogo administrado pelo usuário.
 * - Somente quando há falha real de conectividade (`cloudSucceeded === false`) recorre ao fallback
 *   em cache local (ou seeds caso ainda não exista snapshot salvo).
 */
export function resolvePublicPartnersFromCloud(params: {
  firestorePartners: PartnerPublic[];
  cloudSucceeded: boolean;
  cachedPartners?: PartnerPublic[] | null;
  fallbackSeeds?: PartnerPublic[];
}): PartnerPublic[] {
  if (params.cloudSucceeded) {
    return params.firestorePartners.filter(
      (p) => p.recomendadoAosClientes === true && p.statusHomologacao === 'Ativo/Indicado',
    );
  }
  if (Array.isArray(params.cachedPartners)) {
    return params.cachedPartners;
  }
  return params.fallbackSeeds ?? [];
}

/**
 * Remove um parceiro por ID de um array de parceiros públicos (útil para atualização otimista e limpeza de cache local).
 */
export function removePartnerById<T extends { id: string }>(items: T[], partnerId: string): T[] {
  if (!partnerId) return items;
  return items.filter((item) => item.id !== partnerId);
}

export interface PartnerVisibilityRecord {
  id: string;
  recomendadoAosClientes?: boolean;
  statusHomologacao?: string;
}

/**
 * Identifica IDs presentes em `partnersPublic` que não deveriam estar publicados:
 * - parceiros que já foram excluídos da coleção principal `partners` (órfãos);
 * - parceiros cujo registro em `partners` está oculto (`!recomendadoAosClientes`)
 *   ou não está com `statusHomologacao === 'Ativo/Indicado'`.
 */
export function findOrphanOrHiddenPublicPartnerIds(
  partners: PartnerVisibilityRecord[],
  publicPartnerIds: string[],
): string[] {
  const byId = new Map<string, PartnerVisibilityRecord>();
  for (const partner of partners) {
    if (partner?.id) {
      byId.set(partner.id, partner);
    }
  }

  return publicPartnerIds.filter((pubId) => {
    const authoritative = byId.get(pubId);
    if (!authoritative) return true;
    return (
      authoritative.recomendadoAosClientes !== true ||
      authoritative.statusHomologacao !== 'Ativo/Indicado'
    );
  });
}
