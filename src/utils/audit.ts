import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { UserRole } from '../types/domain';

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
  const serialize = (v: unknown) => {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v.slice(0, 3900);
    try {
      return JSON.stringify(v).slice(0, 3900);
    } catch {
      return String(v).slice(0, 3900);
    }
  };
  try {
    await setDoc(doc(db, 'auditLogs', id), {
      id,
      actorUid: String(currentUser.uid).slice(0, 128),
      actorEmail: String(currentUser.email || '').slice(0, 200),
      actorRole: String(actorRole || 'usuario').slice(0, 40),
      acao: (String(acao || 'Atualizar').trim() || 'Atualizar').slice(0, 100),
      entidade: (String(entidade || 'sistema').trim() || 'sistema').slice(0, 100),
      entidadeId: (String(entidadeId || 'geral').trim() || 'geral').slice(0, 128),
      campo: (String(campo || 'geral').trim() || 'geral').slice(0, 120),
      antes: serialize(antes),
      depois: serialize(depois),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Audit logging is secondary telemetry and must never block or falsely alarm a completed save
    console.warn('Falha ao gravar registro de auditoria:', err instanceof Error ? err.message : String(err));
  }
}
