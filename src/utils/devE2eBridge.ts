import type { User } from 'firebase/auth';
import type { Client, CommunicationLog, Lead, UserProfile } from '../types/domain';

export interface DevE2eDataset {
  clients: Client[];
  leads: Lead[];
  communicationLogs: CommunicationLog[];
  [collectionName: string]: unknown[];
}

const listeners = new Set<() => void>();
let e2eActive = false;
let e2eProfile: UserProfile | null = null;
const e2eDataset: DevE2eDataset = {
  clients: [],
  leads: [],
  communicationLogs: [],
};

function notifyListeners(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore listener error
    }
  });
}

export function isDevE2eActive(): boolean {
  if (!import.meta.env.DEV) return false;
  return e2eActive;
}

export function getDevE2eAuthProfile(): UserProfile | null {
  return e2eActive ? e2eProfile : null;
}

export function createDevE2eFirebaseUser(profile?: UserProfile | null): User {
  const activeProfile = profile || e2eProfile;
  const uid = activeProfile?.uid || 'dev-e2e-uid';
  const email = activeProfile?.email || 'dev@example.com';
  const nome = activeProfile?.nome || 'Dev User';
  return {
    uid,
    email,
    displayName: nome,
    emailVerified: true,
    isAnonymous: false,
    providerData: [],
    refreshToken: 'dev-e2e-token',
    tenantId: null,
    delete: async () => undefined,
    getIdToken: async () => 'dev-e2e-id-token',
    getIdTokenResult: async () => ({
      authTime: new Date().toISOString(),
      claims: {},
      expirationTime: new Date(Date.now() + 3600_000).toISOString(),
      issuedAtTime: new Date().toISOString(),
      signInProvider: 'google.com',
      signInSecondFactor: null,
      token: 'dev-e2e-id-token',
    }),
    reload: async () => undefined,
    toJSON: () => ({ uid, email }),
    metadata: {},
    phoneNumber: null,
    photoURL: null,
    providerId: 'firebase',
  } as User;
}

export function getDevE2eDataset(): DevE2eDataset {
  return e2eDataset;
}

export function devE2eSaveDocument(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
  _isNew?: boolean,
): void {
  if (!e2eDataset[collectionName]) {
    e2eDataset[collectionName] = [];
  }
  const list = e2eDataset[collectionName] as Array<Record<string, unknown>>;
  const idx = list.findIndex((item) => item.id === docId);
  const next = { ...data, id: docId };
  if (idx >= 0) {
    list[idx] = next;
  } else {
    list.push(next);
  }
  notifyListeners();
}

export function devE2eDeleteDocument(collectionName: string, docId: string): void {
  const list = e2eDataset[collectionName] as Array<Record<string, unknown>> | undefined;
  if (!list) return;
  e2eDataset[collectionName] = list.filter((item) => item.id !== docId);
  notifyListeners();
}

export function subscribeDevE2eChanges(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function configureDevE2eBridge(
  profile: UserProfile | null,
  seed?: Partial<DevE2eDataset>,
): void {
  e2eActive = Boolean(profile);
  e2eProfile = profile;
  if (seed) {
    Object.assign(e2eDataset, seed);
  }
  notifyListeners();
}
