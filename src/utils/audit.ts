import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AuditLog, RoleChangeAuditEvent, UserRole } from '../types/domain';
import { classifyAdminAuditAction } from './auditClassification';

export const ADMIN_AUDIT_SCOPE = 'painel';

const VALID_ROLES = new Set<UserRole>(['admin', 'consultor', 'assistente', 'cliente']);

function normalizeAuditRole(value: unknown): UserRole | null {
  const norm = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (VALID_ROLES.has(norm as UserRole)) {
    return norm as UserRole;
  }
  return null;
}

function tryParseObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export interface RoleTransitionInfo {
  oldRole: UserRole | 'nenhuma';
  newRole: UserRole;
  targetEmail?: string;
  targetNome?: string;
}

/**
 * Detecta se houve alteração efetiva no campo `role` entre os estados `antes` e `depois`.
 */
export function extractRoleTransition(antes: unknown, depois: unknown): RoleTransitionInfo | null {
  const beforeObj = tryParseObject(antes);
  const afterObj = tryParseObject(depois);
  const newRole = normalizeAuditRole(afterObj?.role);
  if (!newRole) return null;

  const oldRoleParsed = normalizeAuditRole(beforeObj?.role);
  const oldRole: UserRole | 'nenhuma' = oldRoleParsed ?? 'nenhuma';
  if (oldRole === newRole) return null;

  const targetEmail =
    typeof afterObj?.email === 'string'
      ? afterObj.email.trim()
      : typeof beforeObj?.email === 'string'
        ? beforeObj.email.trim()
        : undefined;

  const targetNome =
    typeof afterObj?.nome === 'string'
      ? afterObj.nome.trim()
      : typeof beforeObj?.nome === 'string'
        ? beforeObj.nome.trim()
        : undefined;

  return { oldRole, newRole, targetEmail, targetNome };
}

export interface RecordUserRoleChangeParams {
  targetUid: string;
  targetEmail?: string;
  targetNome?: string;
  oldRole: UserRole | 'nenhuma';
  newRole: UserRole;
  actorRole?: UserRole;
  reason?: string;
}

/**
 * Registra automaticamente uma alteração de permissão (`role`) nas subcoleções imutáveis:
 * - `adminAudit/painel/logs/{logId}` (monitoramento central do Painel)
 * - `users/{targetUid}/logs/{logId}` (histórico individual do usuário)
 * - `auditLogs/{logId}` (espelho legado para compatibilidade)
 *
 * Salva explicitamente o UID do administrador (`adminUid`), a data da alteração (`changedAt`)
 * e a permissão antiga (`oldRole`) versus a nova (`newRole`).
 */
export async function recordUserRoleChangeLog(
  params: RecordUserRoleChangeParams,
): Promise<RoleChangeAuditEvent | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;

  const id = `role_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();
  const adminUid = String(currentUser.uid).slice(0, 128);
  const adminEmail = String(currentUser.email || '').slice(0, 200);
  const adminNome = String(currentUser.displayName || currentUser.email || 'Administrador').slice(0, 200);
  const targetUid = String(params.targetUid || '').trim().slice(0, 128);
  if (!targetUid) return null;

  const targetEmail = String(params.targetEmail || '').trim().slice(0, 200);
  const targetNome = String(params.targetNome || targetEmail || targetUid).trim().slice(0, 200);
  const oldRole: UserRole | 'nenhuma' = params.oldRole || 'nenhuma';
  const newRole: UserRole = params.newRole;
  const reason = (params.reason || `Alteração de role: ${oldRole} → ${newRole}`).slice(0, 500);
  const cleanActorRole: 'admin' | 'consultor' | 'assistente' | 'cliente' | 'usuario' =
    params.actorRole && VALID_ROLES.has(params.actorRole) ? params.actorRole : 'admin';

  const resumo = `Alteração de permissão (role) · ${targetEmail || targetUid}: ${oldRole} → ${newRole}`.slice(0, 500);
  const antesJson = JSON.stringify({ role: oldRole, email: targetEmail || undefined, uid: targetUid }).slice(0, 3900);
  const depoisJson = JSON.stringify({
    role: newRole,
    email: targetEmail || undefined,
    uid: targetUid,
    adminUid,
    changedAt: nowIso,
  }).slice(0, 3900);

  const event: RoleChangeAuditEvent = {
    id,
    adminUid,
    adminEmail,
    adminNome,
    targetUid,
    targetEmail,
    targetNome,
    oldRole,
    newRole,
    changedAt: nowIso,
    createdAt: nowIso,
    reason,
  };

  const writes: Promise<unknown>[] = [
    // 1. Central subcollection `adminAudit/painel/logs/{logId}`
    setDoc(doc(db, 'adminAudit', ADMIN_AUDIT_SCOPE, 'logs', id), {
      id,
      actorUid: adminUid,
      actorEmail: adminEmail,
      actorNome: adminNome,
      actorRole: cleanActorRole,
      acao: 'Alterar Permissão',
      tipoOperacao: 'permission',
      sensivel: true,
      entidade: 'users',
      entidadeId: targetUid,
      campo: 'alterar_permissao_role',
      resumo,
      antes: antesJson,
      depois: depoisJson,
      createdAt: nowIso,
      adminUid,
      targetUid,
      targetEmail,
      targetNome,
      oldRole,
      newRole,
      changedAt: nowIso,
    }),
    // 2. Per-user immutable subcollection `users/{targetUid}/logs/{logId}`
    setDoc(doc(db, 'users', targetUid, 'logs', id), {
      id,
      adminUid,
      adminEmail,
      adminNome,
      targetUid,
      targetEmail,
      targetNome,
      oldRole,
      newRole,
      changedAt: nowIso,
      createdAt: nowIso,
      reason,
    }),
    // 3. Legacy flat collection mirror `auditLogs/{logId}`
    setDoc(doc(db, 'auditLogs', id), {
      id,
      actorUid: adminUid,
      actorEmail: adminEmail,
      actorRole: cleanActorRole,
      acao: 'Alterar Permissão',
      entidade: 'users',
      entidadeId: targetUid,
      campo: 'alterar_permissao_role',
      antes: antesJson,
      depois: depoisJson,
      createdAt: nowIso,
    }),
  ];

  try {
    const results = await Promise.allSettled(writes);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === results.length && failed[0]?.status === 'rejected') {
      console.warn(
        'Falha ao gravar evento de alteração de role na subcoleção logs:',
        failed[0].reason instanceof Error ? failed[0].reason.message : String(failed[0].reason),
      );
    }
  } catch (err) {
    console.warn(
      'Falha ao gravar evento de alteração de role:',
      err instanceof Error ? err.message : String(err),
    );
  }

  return event;
}

/**
 * Converte um documento de `adminAudit/painel/logs` em `RoleChangeAuditEvent` quando se trata de alteração de role.
 */
export function parseRoleChangeFromAuditLog(log: AuditLog): RoleChangeAuditEvent | null {
  if (log.oldRole && log.newRole) {
    return {
      id: log.id,
      adminUid: log.adminUid || log.actorUid,
      adminEmail: log.actorEmail || '',
      adminNome: log.actorNome || log.actorEmail || 'Administrador',
      targetUid: log.targetUid || log.entidadeId,
      targetEmail: log.targetEmail || '',
      targetNome: log.targetNome || log.targetEmail || log.entidadeId,
      oldRole: log.oldRole,
      newRole: log.newRole,
      changedAt: log.changedAt || log.createdAt,
      createdAt: log.createdAt,
      reason: log.resumo,
    };
  }

  if (log.entidade === 'users' && (log.campo === 'alterar_permissao_role' || log.tipoOperacao === 'permission')) {
    const transition = extractRoleTransition(log.antes, log.depois);
    if (transition) {
      return {
        id: log.id,
        adminUid: log.adminUid || log.actorUid,
        adminEmail: log.actorEmail || '',
        adminNome: log.actorNome || log.actorEmail || 'Administrador',
        targetUid: log.targetUid || log.entidadeId,
        targetEmail: log.targetEmail || transition.targetEmail || '',
        targetNome: log.targetNome || transition.targetNome || transition.targetEmail || log.entidadeId,
        oldRole: transition.oldRole,
        newRole: transition.newRole,
        changedAt: log.changedAt || log.createdAt,
        createdAt: log.createdAt,
        reason: log.resumo,
      };
    }
  }

  return null;
}

/**
 * Monitoramento em tempo real (`onSnapshot`) na subcoleção `adminAudit/painel/logs`
 * focado em eventos de alteração de `role` de usuários.
 */
export function subscribeRoleChangeEvents(
  onEvents: (events: RoleChangeAuditEvent[]) => void,
  onError?: (err: Error) => void,
  maxLogs = 100,
): Unsubscribe {
  const q = query(
    collection(db, 'adminAudit', ADMIN_AUDIT_SCOPE, 'logs'),
    orderBy('createdAt', 'desc'),
    limit(maxLogs),
  );

  return onSnapshot(
    q,
    (snap) => {
      const events: RoleChangeAuditEvent[] = [];
      for (const docSnap of snap.docs) {
        const logData = { id: docSnap.id, ...(docSnap.data() as Omit<AuditLog, 'id'>) };
        const parsed = parseRoleChangeFromAuditLog(logData);
        if (parsed) {
          events.push(parsed);
        }
      }
      onEvents(events);
    },
    (err) => {
      if (onError) onError(err);
    },
  );
}

export async function registrarAuditoria(
  acao: string,
  entidade: string,
  entidadeId: string,
  campo: string,
  antes: unknown,
  depois: unknown,
  actorRole?: UserRole,
): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const cleanEntidade = (String(entidade || 'sistema').trim() || 'sistema').slice(0, 100);
  const cleanEntidadeId = (String(entidadeId || 'geral').trim() || 'geral').slice(0, 128);
  const cleanCampo = (String(campo || 'geral').trim() || 'geral').slice(0, 120);

  // Automaticamente captura qualquer alteração no campo `role` de documentos em `users`
  if (cleanEntidade === 'users') {
    const transition = extractRoleTransition(antes, depois);
    if (transition) {
      await recordUserRoleChangeLog({
        targetUid: cleanEntidadeId,
        targetEmail: transition.targetEmail,
        targetNome: transition.targetNome,
        oldRole: transition.oldRole,
        newRole: transition.newRole,
        actorRole,
        reason: `${acao || 'Atualizar'} (${cleanCampo})`,
      });
      return;
    }
  }

  const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const nowIso = new Date().toISOString();

  const serialize = (v: unknown) => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v.slice(0, 3900);
    try {
      return JSON.stringify(v).slice(0, 3900);
    } catch {
      return String(v).slice(0, 3900);
    }
  };

  const cleanRole: 'admin' | 'consultor' | 'assistente' | 'cliente' | 'usuario' =
    actorRole === 'admin' || actorRole === 'consultor' || actorRole === 'assistente' || actorRole === 'cliente'
      ? actorRole
      : 'usuario';

  const cleanAcao = (String(acao || 'Atualizar').trim() || 'Atualizar').slice(0, 100);
  const cleanAntes = serialize(antes);
  const cleanDepois = serialize(depois);

  const classification = classifyAdminAuditAction({
    acao: cleanAcao,
    entidade: cleanEntidade,
    entidadeId: cleanEntidadeId,
    campo: cleanCampo,
  });

  const actorUid = String(currentUser.uid).slice(0, 128);
  const actorEmail = String(currentUser.email || '').slice(0, 200);
  const actorNome = String(currentUser.displayName || currentUser.email || 'Equipe').slice(0, 200);

  const writes: Promise<unknown>[] = [];

  // 1. Canonical Firestore subcollection `adminAudit/painel/logs/{logId}` for staff/admin actions
  if (cleanRole === 'admin' || cleanRole === 'consultor' || cleanRole === 'assistente') {
    writes.push(
      setDoc(doc(db, 'adminAudit', ADMIN_AUDIT_SCOPE, 'logs', id), {
        id,
        actorUid,
        actorEmail,
        actorNome,
        actorRole: cleanRole,
        acao: cleanAcao,
        tipoOperacao: classification.tipoOperacao,
        sensivel: classification.sensivel,
        entidade: cleanEntidade,
        entidadeId: cleanEntidadeId,
        campo: cleanCampo,
        resumo: classification.resumo,
        antes: cleanAntes,
        depois: cleanDepois,
        createdAt: nowIso,
      }),
    );
  }

  // 2. Legacy flat collection `auditLogs/{logId}` mirror for backward compatibility
  writes.push(
    setDoc(doc(db, 'auditLogs', id), {
      id,
      actorUid,
      actorEmail,
      actorRole: cleanRole,
      acao: cleanAcao,
      entidade: cleanEntidade,
      entidadeId: cleanEntidadeId,
      campo: cleanCampo,
      antes: cleanAntes,
      depois: cleanDepois,
      createdAt: nowIso,
    }),
  );

  try {
    const results = await Promise.allSettled(writes);
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === results.length && failed[0]?.status === 'rejected') {
      console.warn(
        'Falha ao gravar registro de auditoria:',
        failed[0].reason instanceof Error ? failed[0].reason.message : String(failed[0].reason),
      );
    }
  } catch (err) {
    // Audit logging must never block or falsely alarm a completed save
    console.warn('Falha ao gravar registro de auditoria:', err instanceof Error ? err.message : String(err));
  }
}
