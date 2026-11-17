import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
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
      actorUid: currentUser.uid,
      actorEmail: currentUser.email || '',
      actorRole: actorRole || 'usuario',
      acao,
      entidade,
      entidadeId: String(entidadeId || 'geral').slice(0, 128),
      campo: String(campo || 'geral').slice(0, 120),
      antes: serialize(antes),
      depois: serialize(depois),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Audit logging should not crash user flow if offline, but still surfaces permission issues via structured logger
    try {
      handleFirestoreError(err, OperationType.CREATE, `auditLogs/${id}`);
    } catch {
      // Logged in handleFirestoreError
    }
  }
}
