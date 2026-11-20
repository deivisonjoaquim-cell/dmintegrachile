import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { useApp } from '../contexts/AppContext';
import { db, handleFirestoreError, OperationType, testConnection } from '../firebase';
import { translateAppError } from '../services/errorService';
import { makeId } from '../services/firestoreService';
import {
  devE2eDeleteDocument,
  devE2eSaveDocument,
  getDevE2eDataset,
  isDevE2eActive,
  subscribeDevE2eChanges,
} from '../utils/devE2eBridge';
import type {
  Client,
  DiagnosticSession,
  Lead,
  UserRole,
  ViabilityAssessment,
} from '../types/domain';
import { registrarAuditoria } from '../utils/audit';
import {
  sanitizeClientPayload,
  sanitizeDiagnosticLeadPayload,
  sanitizeDiagnosticSessionPayload,
  stripUndefinedDeep,
} from '../utils/firestorePayloads';

export {
  sanitizeClientPayload,
  sanitizeDiagnosticLeadPayload,
  sanitizeDiagnosticSessionPayload,
} from '../utils/firestorePayloads';

export interface UseFirestoreOptions {
  /** Ativa listeners em tempo real (onSnapshot) quando o usuário estiver autenticado. Padrão: true */
  realtime?: boolean;
}

export interface UseFirestoreResult {
  // Estado de conexão
  connected: boolean | null;
  checkConnection: () => Promise<boolean>;

  // Dados reativos de Clientes e Diagnósticos
  clients: Client[];
  activeClients: Client[];
  archivedClients: Client[];
  diagnostics: Lead[];

  // Estados de carregamento e erro
  loading: boolean;
  loadingClients: boolean;
  loadingDiagnostics: boolean;
  error: string | null;
  clearError: () => void;

  // Consultas auxiliares
  refresh: () => Promise<void>;
  getClientById: (clientId: string) => Client | undefined;
  getDiagnosticById: (leadId: string) => Lead | undefined;

  // CRUD de Clientes
  createClient: (
    input: Omit<Client, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  ) => Promise<Client>;
  updateClient: (
    clientId: string,
    patch: Partial<Client>,
    previous?: Client,
  ) => Promise<Client>;
  archiveClient: (client: Client) => Promise<void>;
  deleteClient: (client: Client) => Promise<void>;

  // CRUD de Diagnósticos (Leads, Sessões e Pareceres)
  saveDiagnostic: (
    input: Omit<Lead, 'id' | 'createdAt' | 'statusFunil'> & {
      id?: string;
      statusFunil?: Lead['statusFunil'];
      createdAt?: string;
    },
    options?: { existingLeadId?: string; createdAt?: string },
  ) => Promise<Lead>;
  updateDiagnostic: (
    leadId: string,
    patch: Partial<Lead>,
    previous?: Lead,
  ) => Promise<Lead>;
  deleteDiagnostic: (leadId: string, previous?: Lead) => Promise<void>;
  saveDiagnosticSession: (
    token: string,
    payload: Omit<DiagnosticSession, 'id' | 'updatedAt' | 'createdAt'> & { createdAt?: string },
    isNew: boolean,
  ) => Promise<DiagnosticSession>;
  getDiagnosticSession: (token: string) => Promise<DiagnosticSession | null>;
  saveViabilityAssessment: (
    assessment: Omit<ViabilityAssessment, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
    isNew: boolean,
    previous?: ViabilityAssessment,
  ) => Promise<ViabilityAssessment>;
}

function sortByNewest<T extends { createdAt?: string; updatedAt?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = b.createdAt || b.updatedAt || '';
    const dbDate = a.createdAt || a.updatedAt || '';
    return da.localeCompare(dbDate);
  });
}

function captureSnapshotError(err: unknown, op: OperationType, path: string, setError: (msg: string) => void) {
  try {
    handleFirestoreError(err, op, path);
  } catch (wrapped) {
    setError(translateAppError(wrapped, { source: 'useFirestore', operation: op, path }).message);
  }
}

/**
 * Hook `useFirestore` conectado à instância configurada via `firebase-applet-config.json`.
 * Gerencia em tempo real (com `onSnapshot` protegido por autenticação/RBAC) e com sanitização
 * alinhada ao `firebase-blueprint.json` os dados de **clientes** (`clients`) e **diagnósticos**
 * (`leads`, `diagnosticSessions`, `viabilityAssessments`).
 */
export function useFirestore(options: UseFirestoreOptions = {}): UseFirestoreResult {
  const { realtime = true } = options;
  const { userProfile, authLoading } = useApp();

  const [connected, setConnected] = useState<boolean | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [diagnostics, setDiagnostics] = useState<Lead[]>([]);
  const [loadingClients, setLoadingClients] = useState<boolean>(false);
  const [loadingDiagnostics, setLoadingDiagnostics] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const role: UserRole | undefined = userProfile?.role;
  const isActiveStaff =
    Boolean(userProfile) &&
    userProfile?.status === 'ativo' &&
    (role === 'admin' || role === 'consultor' || role === 'assistente');
  const isActiveClient =
    Boolean(userProfile) && userProfile?.status === 'ativo' && role === 'cliente';

  const checkConnection = useCallback(async (): Promise<boolean> => {
    const ok = await testConnection();
    setConnected(ok);
    return ok;
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV && isDevE2eActive()) {
      setConnected(true);
      return;
    }
    void checkConnection();
  }, [checkConnection]);

  // Listeners reativos apenas quando Auth terminou e o usuário está autorizado
  useEffect(() => {
    if (import.meta.env.DEV && isDevE2eActive()) {
      const syncFromDevStore = () => {
        const ds = getDevE2eDataset();
        setClients(sortByNewest(ds.clients));
        setDiagnostics(sortByNewest(ds.leads));
        setLoadingClients(false);
        setLoadingDiagnostics(false);
      };
      syncFromDevStore();
      return subscribeDevE2eChanges(syncFromDevStore);
    }

    if (!realtime || authLoading || (!isActiveStaff && !isActiveClient) || !userProfile) {
      setLoadingClients(false);
      setLoadingDiagnostics(false);
      return;
    }

    setLoadingClients(true);
    setLoadingDiagnostics(true);

    const clientConstraints: QueryConstraint[] = isActiveStaff
      ? []
      : [where('userId', '==', userProfile.uid)];
    const leadConstraints: QueryConstraint[] = isActiveStaff
      ? []
      : [where('email', '==', userProfile.email.toLowerCase())];

    const unsubClients = onSnapshot(
      query(collection(db, 'clients'), ...clientConstraints),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) }));
        setClients(sortByNewest(list));
        setLoadingClients(false);
      },
      (err) => {
        setLoadingClients(false);
        captureSnapshotError(err, OperationType.LIST, 'clients', setError);
      },
    );

    const unsubLeads = onSnapshot(
      query(collection(db, 'leads'), ...leadConstraints),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, 'id'>) }));
        setDiagnostics(sortByNewest(list));
        setLoadingDiagnostics(false);
      },
      (err) => {
        setLoadingDiagnostics(false);
        captureSnapshotError(err, OperationType.LIST, 'leads', setError);
      },
    );

    return () => {
      unsubClients();
      unsubLeads();
    };
  }, [realtime, authLoading, isActiveStaff, isActiveClient, userProfile]);

  const refresh = useCallback(async () => {
    if (import.meta.env.DEV && isDevE2eActive()) {
      const ds = getDevE2eDataset();
      setClients(sortByNewest(ds.clients));
      setDiagnostics(sortByNewest(ds.leads));
      setLoadingClients(false);
      setLoadingDiagnostics(false);
      return;
    }
    if (authLoading || (!isActiveStaff && !isActiveClient) || !userProfile) return;
    setLoadingClients(true);
    setLoadingDiagnostics(true);
    try {
      const clientQ = isActiveStaff
        ? collection(db, 'clients')
        : query(collection(db, 'clients'), where('userId', '==', userProfile.uid));
      const leadQ = isActiveStaff
        ? collection(db, 'leads')
        : query(collection(db, 'leads'), where('email', '==', userProfile.email.toLowerCase()));

      const [cSnap, lSnap] = await Promise.all([
        getDocs(clientQ).catch((err) => handleFirestoreError(err, OperationType.LIST, 'clients')),
        getDocs(leadQ).catch((err) => handleFirestoreError(err, OperationType.LIST, 'leads')),
      ]);

      setClients(sortByNewest(cSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) }))));
      setDiagnostics(sortByNewest(lSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, 'id'>) }))));
      setError(null);
    } catch (err) {
      setError(translateAppError(err, { source: 'useFirestore.refresh' }).message);
    } finally {
      setLoadingClients(false);
      setLoadingDiagnostics(false);
    }
  }, [authLoading, isActiveStaff, isActiveClient, userProfile]);

  const createClient = useCallback(
    async (input: Omit<Client, 'id' | 'createdAt'> & { id?: string; createdAt?: string }): Promise<Client> => {
      const id = input.id || makeId('cli');
      const pathStr = `clients/${id}`;
      try {
        const sanitized = sanitizeClientPayload({ ...input, id }, { isNew: true });
        await setDoc(doc(db, 'clients', id), sanitized);
        if (role) {
          await registrarAuditoria('Criar', 'clients', id, 'cliente', null, sanitized, role);
        }
        return sanitized;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, pathStr);
      }
    },
    [role],
  );

  const updateClient = useCallback(
    async (clientId: string, patch: Partial<Client>, previous?: Client): Promise<Client> => {
      const pathStr = `clients/${clientId}`;
      try {
        const base = previous || clients.find((c) => c.id === clientId);
        const mergedInput = { ...(base || {}), ...patch, id: clientId } as Partial<Client> & { id: string };
        const sanitized = sanitizeClientPayload(mergedInput, { isNew: false });
        await setDoc(doc(db, 'clients', clientId), sanitized, { merge: true });
        if (role) {
          await registrarAuditoria('Atualizar', 'clients', clientId, 'cliente', base ?? null, sanitized, role);
        }
        return sanitized;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, pathStr);
      }
    },
    [clients, role],
  );

  const archiveClient = useCallback(
    async (client: Client): Promise<void> => {
      const now = new Date().toISOString();
      await updateClient(
        client.id,
        {
          arquivado: true,
          arquivadoEm: now,
          portalLiberado: false,
          statusAcessoPortal: 'Não solicitado',
        },
        client,
      );
    },
    [updateClient],
  );

  const deleteClient = useCallback(
    async (client: Client): Promise<void> => {
      if (role !== 'admin') {
        throw new Error('Somente administradores podem excluir um cliente.');
      }
      if (import.meta.env.DEV && isDevE2eActive()) {
        devE2eDeleteDocument('clients', client.id);
        return;
      }
      const pathStr = `clients/${client.id}`;
      try {
        await deleteDoc(doc(db, 'clients', client.id));
        await registrarAuditoria(
          'Excluir',
          'clients',
          client.id,
          'cliente',
          { nomeCompleto: client.nomeCompleto, email: client.email },
          null,
          role,
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, pathStr);
      }
    },
    [role],
  );

  const saveDiagnostic = useCallback(
    async (
      input: Omit<Lead, 'id' | 'createdAt' | 'statusFunil'> & {
        id?: string;
        statusFunil?: Lead['statusFunil'];
        createdAt?: string;
      },
      saveOpts?: { existingLeadId?: string; createdAt?: string },
    ): Promise<Lead> => {
      const existingId =
        saveOpts?.existingLeadId && saveOpts.existingLeadId !== 'local-preview'
          ? saveOpts.existingLeadId
          : input.id && input.id !== 'local-preview'
            ? input.id
            : '';
      const id = existingId || makeId('lead');
      const isNew = !existingId;
      const pathStr = `leads/${id}`;
      const forcePublicCreate = !isActiveStaff;

      try {
        const sanitized = sanitizeDiagnosticLeadPayload(
          {
            ...input,
            id,
            createdAt: saveOpts?.createdAt || input.createdAt,
          },
          { isNew, forcePublicCreate },
        );

        if (import.meta.env.DEV && isDevE2eActive()) {
          devE2eSaveDocument('leads', id, sanitized as unknown as Record<string, unknown>, isNew);
          return sanitized;
        }

        const writeDoc: Record<string, unknown> = { ...sanitized };
        if (!isNew && !isActiveStaff) {
          // Protege invariantes das regras públicas do Firestore em atualizações parciais
          delete writeDoc.notas;
          delete writeDoc.createdAt;
        }

        await setDoc(doc(db, 'leads', id), writeDoc, { merge: !isNew });
        if (isActiveStaff && role) {
          await registrarAuditoria(
            isNew ? 'Criar' : 'Atualizar',
            'leads',
            id,
            'diagnostico_lead',
            null,
            sanitized,
            role,
          );
        }
        return sanitized;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, pathStr);
      }
    },
    [isActiveStaff, role],
  );

  const updateDiagnostic = useCallback(
    async (leadId: string, patch: Partial<Lead>, previous?: Lead): Promise<Lead> => {
      const pathStr = `leads/${leadId}`;
      try {
        const base = previous || diagnostics.find((l) => l.id === leadId);
        const merged = { ...(base || {}), ...patch, id: leadId } as Partial<Lead> & { id: string };
        const sanitized = sanitizeDiagnosticLeadPayload(merged, { isNew: false });
        if (import.meta.env.DEV && isDevE2eActive()) {
          devE2eSaveDocument('leads', leadId, sanitized as unknown as Record<string, unknown>, false);
          return sanitized;
        }
        await setDoc(doc(db, 'leads', leadId), sanitized, { merge: true });
        if (role) {
          await registrarAuditoria('Atualizar', 'leads', leadId, 'diagnostico_lead', base ?? null, sanitized, role);
        }
        return sanitized;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, pathStr);
      }
    },
    [diagnostics, role],
  );

  const deleteDiagnostic = useCallback(
    async (leadId: string, previous?: Lead): Promise<void> => {
      if (role !== 'admin') {
        throw new Error('Somente administradores podem excluir registros de diagnóstico.');
      }
      if (import.meta.env.DEV && isDevE2eActive()) {
        devE2eDeleteDocument('leads', leadId);
        return;
      }
      const pathStr = `leads/${leadId}`;
      try {
        await deleteDoc(doc(db, 'leads', leadId));
        await registrarAuditoria(
          'Excluir',
          'leads',
          leadId,
          'diagnostico_lead',
          previous ? { nome: previous.nome, email: previous.email } : leadId,
          null,
          role,
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, pathStr);
      }
    },
    [role],
  );

  const saveDiagnosticSession = useCallback(
    async (
      token: string,
      payload: Omit<DiagnosticSession, 'id' | 'updatedAt' | 'createdAt'> & { createdAt?: string },
      isNew: boolean,
    ): Promise<DiagnosticSession> => {
      const pathStr = `diagnosticSessions/${token}`;
      try {
        const writePayload = sanitizeDiagnosticSessionPayload(token, payload, isNew);
        await setDoc(doc(db, 'diagnosticSessions', token), writePayload, { merge: !isNew });
        return writePayload as unknown as DiagnosticSession;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, pathStr);
      }
    },
    [],
  );

  const getDiagnosticSession = useCallback(async (token: string): Promise<DiagnosticSession | null> => {
    if (!token || token.length < 20) return null;
    try {
      const snap = await getDoc(doc(db, 'diagnosticSessions', token));
      if (!snap.exists()) return null;
      const data = snap.data() as DiagnosticSession;
      if (data.expiraEmMs && data.expiraEmMs <= Date.now()) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  }, []);

  const saveViabilityAssessment = useCallback(
    async (
      assessment: Omit<ViabilityAssessment, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
      isNew: boolean,
      previous?: ViabilityAssessment,
    ): Promise<ViabilityAssessment> => {
      const id = assessment.id || makeId('viab');
      const now = new Date().toISOString();
      const pathStr = `viabilityAssessments/${id}`;
      try {
        const clean = stripUndefinedDeep<ViabilityAssessment>({
          ...assessment,
          id,
          createdAt: assessment.createdAt || now,
        });
        await setDoc(doc(db, 'viabilityAssessments', id), clean, { merge: !isNew });
        if (role) {
          await registrarAuditoria(
            isNew ? 'Criar' : 'Atualizar',
            'viabilityAssessments',
            id,
            'parecer_tecnico',
            previous ?? null,
            clean,
            role,
          );
        }
        return clean;
      } catch (err) {
        handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, pathStr);
      }
    },
    [role],
  );

  const activeClients = useMemo(() => clients.filter((c) => !c.arquivado), [clients]);
  const archivedClients = useMemo(() => clients.filter((c) => Boolean(c.arquivado)), [clients]);

  const getClientById = useCallback(
    (clientId: string) => clients.find((c) => c.id === clientId),
    [clients],
  );

  const getDiagnosticById = useCallback(
    (leadId: string) => diagnostics.find((l) => l.id === leadId),
    [diagnostics],
  );

  return {
    connected,
    checkConnection,
    clients,
    activeClients,
    archivedClients,
    diagnostics,
    loading: loadingClients || loadingDiagnostics,
    loadingClients,
    loadingDiagnostics,
    error,
    clearError: useCallback(() => setError(null), []),
    refresh,
    getClientById,
    getDiagnosticById,
    createClient,
    updateClient,
    archiveClient,
    deleteClient,
    saveDiagnostic,
    updateDiagnostic,
    deleteDiagnostic,
    saveDiagnosticSession,
    getDiagnosticSession,
    saveViabilityAssessment,
  };
}
