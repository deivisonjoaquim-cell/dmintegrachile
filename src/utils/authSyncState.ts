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
