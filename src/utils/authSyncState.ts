import type { UserProfile, UserRole } from '../types/domain';

export const STAFF_ROLES: readonly UserRole[] = ['admin', 'consultor', 'assistente'];

export function isStaffRole(role?: string | null): role is 'admin' | 'consultor' | 'assistente' {
  return role === 'admin' || role === 'consultor' || role === 'assistente';
}

export function isActiveStaffProfile(profile?: Pick<UserProfile, 'role' | 'status'> | null): boolean {
  return Boolean(profile && isStaffRole(profile.role) && profile.status === 'ativo');
}

export interface ResolveUserProfileInput {
  uid: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  isAdminEmail: boolean;
  existingData?: Partial<UserProfile> | null;
  nowIso: string;
}

export interface ResolvedUserProfileResult {
  profile: UserProfile;
  needsCreate: boolean;
  needsAdminRepair: boolean;
}

/**
 * Resolve de forma determinística o perfil e as permissões de um usuário autenticado
 * a partir do documento persistido em `users/{uid}` e das regras de papel da conta.
 */
export function resolveUserProfileFromFirestoreData(
  input: ResolveUserProfileInput,
): ResolvedUserProfileResult {
  const normalizedEmail = (input.email || '').trim().toLowerCase();
  const fallbackName = (input.displayName || normalizedEmail.split('@')[0] || 'Usuário').slice(0, 200);
  const fallbackPhoto = (input.photoURL || '').slice(0, 1000);

  if (!input.existingData) {
    const profile: UserProfile = {
      uid: input.uid,
      nome: fallbackName,
      email: normalizedEmail,
      fotoUrl: fallbackPhoto,
      role: input.isAdminEmail ? 'admin' : 'cliente',
      status: input.isAdminEmail ? 'ativo' : 'pendente',
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    };
    return { profile, needsCreate: true, needsAdminRepair: false };
  }

  const existing = input.existingData;
  const rawRole = typeof existing.role === 'string' ? existing.role.trim().toLowerCase() : '';
  const resolvedRole: UserRole =
    rawRole === 'admin' || rawRole === 'consultor' || rawRole === 'assistente' || rawRole === 'cliente'
      ? rawRole
      : input.isAdminEmail
        ? 'admin'
        : 'cliente';

  const rawStatus = typeof existing.status === 'string' ? existing.status.trim().toLowerCase() : '';
  const resolvedStatus: UserProfile['status'] =
    rawStatus === 'ativo' || rawStatus === 'pendente' || rawStatus === 'inativo'
      ? rawStatus
      : isStaffRole(resolvedRole) || input.isAdminEmail
        ? 'ativo'
        : 'pendente';

  const baseProfile: UserProfile = {
    ...existing,
    uid: existing.uid || input.uid,
    nome: existing.nome || fallbackName,
    email: (existing.email || normalizedEmail).trim().toLowerCase(),
    fotoUrl: existing.fotoUrl ?? fallbackPhoto,
    role: resolvedRole,
    status: resolvedStatus,
    createdAt: existing.createdAt || input.nowIso,
    updatedAt: existing.updatedAt || input.nowIso,
  };

  const needsAdminRepair =
    input.isAdminEmail &&
    (baseProfile.role !== 'admin' || baseProfile.status !== 'ativo' || !existing.uid);

  if (needsAdminRepair) {
    return {
      profile: {
        ...baseProfile,
        uid: input.uid,
        nome: (baseProfile.nome || input.displayName || 'Administrador').slice(0, 200),
        email: normalizedEmail || baseProfile.email,
        role: 'admin',
        status: 'ativo',
        updatedAt: input.nowIso,
      },
      needsCreate: false,
      needsAdminRepair: true,
    };
  }

  return {
    profile: baseProfile,
    needsCreate: false,
    needsAdminRepair: false,
  };
}

/**
 * Detecta se houve alteração de permissão (`role`, `status` ou `clientId`) em `users/{uid}`
 * que exija atualização automática do estado de autenticação/token em tempo real.
 */
export function hasAuthPermissionDelta(
  current: Pick<UserProfile, 'role' | 'status' | 'clientId'> | null | undefined,
  incoming: Partial<Pick<UserProfile, 'role' | 'status' | 'clientId'>> | null | undefined,
): boolean {
  if (!current || !incoming) return false;
  const nextRole =
    incoming.role === 'admin' ||
    incoming.role === 'consultor' ||
    incoming.role === 'assistente' ||
    incoming.role === 'cliente'
      ? incoming.role
      : current.role;
  const nextStatus =
    incoming.status === 'ativo' || incoming.status === 'pendente' || incoming.status === 'inativo'
      ? incoming.status
      : current.status;
  const nextClientId =
    typeof incoming.clientId === 'string' ? incoming.clientId : current.clientId;

  return (
    nextRole !== current.role ||
    nextStatus !== current.status ||
    nextClientId !== current.clientId
  );
}

/**
 * Gera uma chave determinística para impedir retentativas em loop de vínculo
 * `users/{uid} <-> clients/{clientId}` para o mesmo estado de liberação.
 */
export function buildClientLinkAttemptKey(params: {
  uid: string;
  clientId: string;
  portalLiberado: boolean;
}): string {
  return `${params.uid}::${params.clientId}::${params.portalLiberado ? '1' : '0'}`;
}

/**
 * Determina se o listener em tempo real deve disparar o vínculo automático
 * `linkGoogleUserToClientOrLead`, bloqueando loops infinitos caso a tentativa
 * já tenha sido executada para o mesmo `(uid, clientId, portalLiberado)`.
 */
export function shouldAttemptClientAutoLink(params: {
  userProfile: Pick<UserProfile, 'uid' | 'role' | 'status' | 'clientId'> | null | undefined;
  client: { id: string; portalLiberado?: boolean; arquivado?: boolean; userId?: string } | null | undefined;
  attemptedKeys: ReadonlySet<string>;
}): { shouldAttempt: boolean; key: string | null } {
  const { userProfile, client, attemptedKeys } = params;
  if (!userProfile || !client) return { shouldAttempt: false, key: null };
  if (userProfile.role !== 'cliente' || userProfile.status === 'inativo') {
    return { shouldAttempt: false, key: null };
  }
  if (client.portalLiberado !== true || client.arquivado === true) {
    return { shouldAttempt: false, key: null };
  }
  const needsCommit =
    userProfile.clientId !== client.id ||
    userProfile.status !== 'ativo' ||
    !client.userId;
  if (!needsCommit) {
    return { shouldAttempt: false, key: null };
  }
  const key = buildClientLinkAttemptKey({
    uid: userProfile.uid,
    clientId: client.id,
    portalLiberado: true,
  });
  if (attemptedKeys.has(key)) {
    return { shouldAttempt: false, key };
  }
  return { shouldAttempt: true, key };
}

/**
 * Resolve o estágio do Portal do Cliente sem jamais prender a interface
 * em estado infinito de 'loading' caso o vínculo do perfil não consiga
 * atualizar `users/{uid}.clientId` em uma tentativa anterior.
 */
export function resolveSafePortalStage(params: {
  authLoading: boolean;
  portalAccessLoading: boolean;
  userProfile: Pick<UserProfile, 'role' | 'status' | 'clientId'> | null | undefined;
  portalAccessKind: 'unauthenticated' | 'inactive' | 'active_paid' | 'pending_release' | 'free_diagnostic_only' | 'no_record' | null;
  portalAccessClientId?: string | null;
  linkAttemptExhausted: boolean;
}): 'loading' | 'unauthenticated' | 'gratuito' | 'pendente' | 'contratado' | 'inativo' {
  const {
    authLoading,
    portalAccessLoading,
    userProfile,
    portalAccessKind,
    portalAccessClientId,
    linkAttemptExhausted,
  } = params;

  if (authLoading) return 'loading';
  if (!userProfile || userProfile.role !== 'cliente') return 'unauthenticated';
  if (portalAccessLoading) return 'loading';
  if (!portalAccessKind || portalAccessKind === 'unauthenticated') return 'unauthenticated';
  if (portalAccessKind === 'inactive') return 'inativo';
  if (portalAccessKind === 'active_paid') {
    if (portalAccessClientId && userProfile.clientId !== portalAccessClientId) {
      return linkAttemptExhausted ? 'pendente' : 'loading';
    }
    return 'contratado';
  }
  if (portalAccessKind === 'pending_release') return 'pendente';
  return 'gratuito';
}

