import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserRole } from '../types/domain';
import { classifyAdminAuditAction } from './auditClassification';

export const ADMIN_AUDIT_SCOPE = 'painel';

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
  const cleanEntidade = (String(entidade || 'sistema').trim() || 'sistema').slice(0, 100);
  const cleanEntidadeId = (String(entidadeId || 'geral').trim() || 'geral').slice(0, 128);
  const cleanCampo = (String(campo || 'geral').trim() || 'geral').slice(0, 120);
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
