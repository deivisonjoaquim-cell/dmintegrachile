import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type { UserProfile, UserRole, UserStatus } from '../types/domain';
import { sanitizeFirestoreData } from '../utils/firestoreUtils';

export const PRIMARY_ADMIN_EMAIL = 'deivisonjoaquim@gmail.com';

const ADMIN_VERIFY_CACHE_TTL_MS = 60_000;

export interface AdminSecurityVerificationResult {
  authorized: boolean;
  uid: string | null;
  email: string;
  emailVerified: boolean;
  role: UserRole | null;
  status: UserStatus | null;
  isPrimaryAdmin: boolean;
  repairedUserDoc: boolean;
  reason?: string;
  profile?: UserProfile;
}

interface CachedVerification {
  uid: string;
  checkedAt: number;
  result: AdminSecurityVerificationResult;
}

let cachedVerification: CachedVerification | null = null;

/**
 * Normaliza e verifica se o e-mail pertence ao administrador principal bootstrapado.
 */
export function normalizeEmail(email?: string | null): string {
  return (email || '').trim().toLowerCase();
}

export function isPrimaryAdminEmail(email?: string | null): boolean {
  return normalizeEmail(email) === PRIMARY_ADMIN_EMAIL;
}

/**
 * Constrói o documento normalizado e compatível com `isValidUser` em `firestore.rules`
 * para garantir que o administrador principal possua `role: 'admin'` e `status: 'ativo'`.
 */
export function buildEnsuredPrimaryAdminProfile(
  fbUser: Pick<User, 'uid' | 'email' | 'displayName' | 'photoURL'>,
  existingData?: Partial<UserProfile> | null,
  nowIso = new Date().toISOString(),
): { profile: UserProfile; needsWrite: boolean } {
  const email = normalizeEmail(fbUser.email || existingData?.email);
  const nome = (existingData?.nome || fbUser.displayName || email.split('@')[0] || 'Administrador')
    .trim()
    .slice(0, 200);
  const fotoUrl = (existingData?.fotoUrl ?? fbUser.photoURL ?? '').slice(0, 1000);

  const needsWrite =
    !existingData ||
    existingData.uid !== fbUser.uid ||
    normalizeEmail(existingData.email) !== email ||
    existingData.role !== 'admin' ||
    existingData.status !== 'ativo' ||
    !existingData.nome;

  const profile: UserProfile = {
    ...(existingData || {}),
    uid: fbUser.uid,
    nome: nome || 'Administrador',
    email,
    fotoUrl,
    role: 'admin',
    status: 'ativo',
    createdAt: existingData?.createdAt || nowIso,
    updatedAt: needsWrite ? nowIso : existingData?.updatedAt || nowIso,
  };

  return { profile, needsWrite };
}

/**
 * Avalia se um documento `users/{uid}` lido do Firestore representa um administrador validado.
 */
export function evaluateValidatedAdminRecord(params: {
  uid: string | null;
  email?: string | null;
  emailVerified: boolean;
  userDoc?: Partial<UserProfile> | null;
}): AdminSecurityVerificationResult {
  const normalizedEmail = normalizeEmail(params.email);
  const isPrimary = isPrimaryAdminEmail(normalizedEmail);

  if (!params.uid) {
    return {
      authorized: false,
      uid: null,
      email: normalizedEmail,
      emailVerified: false,
      role: null,
      status: null,
      isPrimaryAdmin: false,
      repairedUserDoc: false,
      reason: 'Nenhuma sessão autenticada encontrada. Faça login novamente com sua conta Google.',
    };
  }

  if (!params.emailVerified) {
    return {
      authorized: false,
      uid: params.uid,
      email: normalizedEmail,
      emailVerified: false,
      role: (params.userDoc?.role as UserRole) || null,
      status: (params.userDoc?.status as UserStatus) || null,
      isPrimaryAdmin: isPrimary,
      repairedUserDoc: false,
      reason: 'O e-mail da conta autenticada não está verificado pelo provedor de autenticação.',
    };
  }

  const role = (params.userDoc?.role as UserRole) || null;
  const status = (params.userDoc?.status as UserStatus) || null;

  if (role === 'admin' && status === 'ativo') {
    return {
      authorized: true,
      uid: params.uid,
      email: normalizedEmail,
      emailVerified: true,
      role,
      status,
      isPrimaryAdmin: isPrimary,
      repairedUserDoc: false,
      profile: params.userDoc as UserProfile,
    };
  }

  return {
    authorized: false,
    uid: params.uid,
    email: normalizedEmail,
    emailVerified: true,
    role,
    status,
    isPrimaryAdmin: isPrimary,
    repairedUserDoc: false,
    reason: isPrimary
      ? 'O perfil de administrador principal no Firestore precisa ser sincronizado como ativo.'
      : 'A conta autenticada não possui papel de administrador ativo no Firestore.',
  };
}

export function clearAdminVerificationCache(): void {
  cachedVerification = null;
}

/**
 * Verifica no Firestore (`users/{uid}`) se o usuário autenticado possui role `admin` e status `ativo`.
 * Para `deivisonjoaquim@gmail.com` (com e-mail verificado), garante automaticamente a existência e
 * integridade do documento `users/{uid}` com `role: 'admin'` e `status: 'ativo'`.
 */
export async function verifyAndEnsureAdminAccess(
  fbUser: User | null = auth.currentUser,
  options?: { force?: boolean },
): Promise<AdminSecurityVerificationResult> {
  if (!fbUser) {
    clearAdminVerificationCache();
    return evaluateValidatedAdminRecord({
      uid: null,
      email: null,
      emailVerified: false,
      userDoc: null,
    });
  }

  if (
    !options?.force &&
    cachedVerification &&
    cachedVerification.uid === fbUser.uid &&
    cachedVerification.result.authorized &&
    Date.now() - cachedVerification.checkedAt < ADMIN_VERIFY_CACHE_TTL_MS
  ) {
    return cachedVerification.result;
  }

  const normalizedEmail = normalizeEmail(fbUser.email);
  const isPrimary = isPrimaryAdminEmail(normalizedEmail);

  if (!fbUser.emailVerified) {
    const unverified = evaluateValidatedAdminRecord({
      uid: fbUser.uid,
      email: normalizedEmail,
      emailVerified: false,
      userDoc: null,
    });
    clearAdminVerificationCache();
    return unverified;
  }

  const userRef = doc(db, 'users', fbUser.uid);
  let existingData: Partial<UserProfile> | null = null;
  try {
    const snap = await getDoc(userRef);
    existingData = snap.exists() ? (snap.data() as Partial<UserProfile>) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
  }

  let repairedUserDoc = false;
  let effectiveDoc: Partial<UserProfile> | null = existingData;

  if (isPrimary) {
    const { profile, needsWrite } = buildEnsuredPrimaryAdminProfile(fbUser, existingData);
    if (needsWrite) {
      try {
        await setDoc(userRef, sanitizeFirestoreData(profile));
        repairedUserDoc = true;
        effectiveDoc = profile;
      } catch (err) {
        handleFirestoreError(err, existingData ? OperationType.UPDATE : OperationType.CREATE, `users/${fbUser.uid}`);
      }
    } else {
      effectiveDoc = profile;
    }
  }

  const result: AdminSecurityVerificationResult = {
    ...evaluateValidatedAdminRecord({
      uid: fbUser.uid,
      email: normalizedEmail,
      emailVerified: fbUser.emailVerified,
      userDoc: effectiveDoc,
    }),
    repairedUserDoc,
  };

  if (result.authorized) {
    cachedVerification = {
      uid: fbUser.uid,
      checkedAt: Date.now(),
      result,
    };
  } else {
    clearAdminVerificationCache();
  }

  return result;
}

/**
 * Verifica no Firestore (`users/{uid}`) se a conta autenticada possui um dos papéis permitidos
 * (`admin`, `consultor`, `assistente`, `cliente`) e status ativo (ou admin principal bootstrapado).
 */
export async function verifyStaffRoleAccess(
  allowedRoles: UserRole[] = ['admin', 'consultor', 'assistente'],
  fbUser: User | null = auth.currentUser,
  options?: { force?: boolean },
): Promise<AdminSecurityVerificationResult> {
  if (!fbUser) {
    return evaluateValidatedAdminRecord({
      uid: null,
      email: null,
      emailVerified: false,
      userDoc: null,
    });
  }

  const normalizedEmail = normalizeEmail(fbUser.email);
  const isPrimary = isPrimaryAdminEmail(normalizedEmail);

  if (isPrimary && allowedRoles.includes('admin')) {
    return verifyAndEnsureAdminAccess(fbUser, options);
  }

  if (!fbUser.emailVerified) {
    return {
      authorized: false,
      uid: fbUser.uid,
      email: normalizedEmail,
      emailVerified: false,
      role: null,
      status: null,
      isPrimaryAdmin: isPrimary,
      repairedUserDoc: false,
      reason: 'O e-mail da conta autenticada não está verificado.',
    };
  }

  let existingData: Partial<UserProfile> | null = null;
  try {
    const snap = await getDoc(doc(db, 'users', fbUser.uid));
    existingData = snap.exists() ? (snap.data() as Partial<UserProfile>) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
  }

  const role = (existingData?.role as UserRole) || null;
  const status = (existingData?.status as UserStatus) || (role && role !== 'cliente' ? 'ativo' : null);
  const authorized = Boolean(role && allowedRoles.includes(role) && status === 'ativo');

  return {
    authorized,
    uid: fbUser.uid,
    email: normalizedEmail,
    emailVerified: true,
    role,
    status,
    isPrimaryAdmin: isPrimary,
    repairedUserDoc: false,
    profile: existingData as UserProfile | undefined,
    reason: authorized
      ? undefined
      : `Permissão insuficiente no Firestore (papel atual: ${role || 'não definido'}, status: ${status || 'não definido'}).`,
  };
}

/**
 * Executa uma operação de escrita administrativa no Firestore (ex.: `config/empresa`, `config/bancario`)
 * após validar no Firestore que o usuário é um administrador ativo.
 * Caso ocorra erro de permissão por token desatualizado ou documento recém-sincronizado,
 * renova o ID Token + revalida `users/{uid}` e tenta a gravação novamente uma vez.
 */
export async function executeValidatedAdminWrite<T>(
  targetPath: string,
  operation: OperationType,
  writeFn: () => Promise<T>,
): Promise<T> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    handleFirestoreError(new Error('auth/unauthenticated'), operation, targetPath);
  }

  const check = await verifyAndEnsureAdminAccess(currentUser);
  if (!check.authorized) {
    handleFirestoreError(
      new Error(check.reason || 'permission-denied: Conta sem permissão de administrador validada.'),
      operation,
      targetPath,
    );
  }

  try {
    return await writeFn();
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
    const isPermError =
      rawMsg.includes('permission-denied') ||
      rawMsg.includes('missing or insufficient permissions') ||
      rawMsg.includes('insufficient permissions');

    if (isPermError) {
      try {
        await currentUser.getIdToken(true);
        clearAdminVerificationCache();
        const recheck = await verifyAndEnsureAdminAccess(currentUser, { force: true });
        if (recheck.authorized) {
          return await writeFn();
        }
      } catch (retryErr) {
        handleFirestoreError(retryErr, operation, targetPath);
      }
    }

    handleFirestoreError(err, operation, targetPath);
  }
}
