import type { Partner, PartnerProposal, PartnerPublic } from '../types/domain';

export interface PartnerSeedDecisionInput {
  configAlreadyExisted: boolean;
  partnersSeededAt?: string | null;
  existingPartnersCount: number;
  existingPartnersPublicCount: number;
}

export interface PartnerVisibilityRecord {
  id: string;
  recomendadoAosClientes?: boolean;
  statusHomologacao?: string;
  deleted?: boolean;
  deletedAt?: string | null;
}

/**
 * Indica se um parceiro está ativo (não marcado como excluído/soft-deleted).
 */
export function isPartnerActive(
  partner: Pick<PartnerVisibilityRecord, 'deleted' | 'deletedAt'> | null | undefined,
): boolean {
  if (!partner) return false;
  if (partner.deleted === true) return false;
  if (typeof partner.deletedAt === 'string' && partner.deletedAt.trim().length > 0) return false;
  return true;
}

/**
 * Indica se um parceiro deve aparecer nas vitrines públicas (`/parceiros`, `/`, `/portal`).
 */
export function isPartnerPubliclyVisible(
  partner: Pick<
    PartnerVisibilityRecord,
    'recomendadoAosClientes' | 'statusHomologacao' | 'deleted' | 'deletedAt'
  > | null | undefined,
): boolean {
  if (!partner) return false;
  return (
    isPartnerActive(partner) &&
    partner.recomendadoAosClientes === true &&
    partner.statusHomologacao === 'Ativo/Indicado'
  );
}

/**
 * Filtra parceiros removendo qualquer item marcado como `deleted` ou com `deletedAt` preenchido.
 * Garante que dashboards internos e vitrines nunca exibam parceiros marcados como excluídos.
 */
export function filterActivePartners<T extends Pick<PartnerVisibilityRecord, 'deleted' | 'deletedAt'>>(
  partners: T[],
): T[] {
  return partners.filter((partner) => isPartnerActive(partner));
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
  firestorePartners: Array<PartnerPublic & { deleted?: boolean; deletedAt?: string | null }>;
  cloudSucceeded: boolean;
  cachedPartners?: PartnerPublic[] | null;
  fallbackSeeds?: PartnerPublic[];
}): PartnerPublic[] {
  if (params.cloudSucceeded) {
    return params.firestorePartners.filter((p) => isPartnerPubliclyVisible(p));
  }
  if (Array.isArray(params.cachedPartners)) {
    return params.cachedPartners.filter((p) => isPartnerPubliclyVisible(p));
  }
  return (params.fallbackSeeds ?? []).filter((p) => isPartnerPubliclyVisible(p));
}

/**
 * Remove um parceiro por ID de um array de parceiros (útil para atualização otimista e limpeza de cache local).
 */
export function removePartnerById<T extends { id: string }>(items: T[], partnerId: string): T[] {
  if (!partnerId) return items;
  return items.filter((item) => item.id !== partnerId);
}

/**
 * Identifica IDs presentes em `partnersPublic` que não deveriam estar publicados:
 * - parceiros que já foram excluídos da coleção principal `partners` (órfãos);
 * - parceiros marcados como excluídos (`deleted === true` ou `deletedAt`);
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
    return !isPartnerPubliclyVisible(authoritative);
  });
}

export interface LinkedProposalCascadeUpdate {
  proposalId: string;
  patch: {
    partnerIdVinculado: string;
    observacoesInternas: string;
    updatedAt: string;
  };
}

/**
 * Calcula atualizações em cascata para propostas (`partnerProposals`) vinculadas a um parceiro
 * que acabou de ser excluído ou marcado como removido, evitando referências órfãs no painel.
 */
export function buildLinkedProposalUnlinkPatches(
  proposals: Array<Pick<PartnerProposal, 'id' | 'partnerIdVinculado' | 'observacoesInternas'>>,
  deletedPartner: Pick<Partner, 'id' | 'nome'>,
  nowIso: string,
): LinkedProposalCascadeUpdate[] {
  const seen = new Set<string>();
  const noteSuffix = `Parceiro "${deletedPartner.nome}" removido do painel em ${nowIso.slice(0, 10)}.`;
  const updates: LinkedProposalCascadeUpdate[] = [];

  for (const prop of proposals) {
    if (!prop?.id || seen.has(prop.id)) continue;
    if (prop.partnerIdVinculado !== deletedPartner.id) continue;
    seen.add(prop.id);
    const existingNotes = (prop.observacoesInternas || '').trim();
    const mergedNotes = existingNotes
      ? existingNotes.includes(noteSuffix)
        ? existingNotes
        : `${existingNotes}\n${noteSuffix}`.slice(0, 2900)
      : noteSuffix;
    updates.push({
      proposalId: prop.id,
      patch: {
        partnerIdVinculado: '',
        observacoesInternas: mergedNotes,
        updatedAt: nowIso,
      },
    });
  }

  return updates;
}
