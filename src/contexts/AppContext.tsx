import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { useTheme } from './ThemeContext';
import {
  clearAdminVerificationCache,
  isPrimaryAdminEmail,
  verifyAndEnsureAdminAccess,
} from '../services/adminSecurityService';
import { reportAppError } from '../services/errorService';
import { sanitizeFirestoreData } from '../utils/firestoreUtils';
import {
  createDevE2eFirebaseUser,
  getDevE2eAuthProfile,
  isDevE2eActive,
  subscribeDevE2eChanges,
} from '../utils/devE2eBridge';
import { SEED_SITE_CONTENT } from '../data/seeds';
import {
  fetchRuleEngineBundleWithSync,
  fetchSignedInClientRecord,
  fetchSignedInUserDiagnosticLeads,
  linkGoogleUserToClientOrLead,
  runIdempotentSeedsIfAdmin,
  subscribePartnersPublicLive,
  syncPendingOfflineDiagnosticToFirestore,
  syncRuleEngineDecisionLogToFirestore,
} from '../services/firestoreService';
import {
  buildClientLinkAttemptKey,
  hasAuthPermissionDelta,
  isStaffRole,
  resolveSafePortalStage,
  resolveUserProfileFromFirestoreData,
  shouldAttemptClientAutoLink,
} from '../utils/authSyncState';
import {
  resolveClientPortalAccess,
  type PortalAccessResolution,
  type PortalLifecycleStage,
} from '../utils/portalAccess';
import {
  countPendingOfflineItems,
  getLocalAiRuntimeNotice,
  hydratePendingDiagnosticsFromIdb,
  hydrateRuleEngineLogsFromIdb,
  listPendingOfflineDiagnostics,
  listRuleEngineDecisionLogs,
  loadRuleEngineSnapshotSync,
  markRuleEngineDecisionSynced,
  removePendingOfflineDiagnostic,
  subscribeOfflineEngineChanges,
  updatePartnersInOfflineSnapshot,
  type CatalogSyncSource,
} from '../utils/offlineRuleEngineStore';
import {
  clearDiagnosticCacheStorage,
  clearDiagnosticDraftStorage,
  DIAGNOSTIC_CACHE_STORAGE_KEY,
  readDiagnosticCache,
  writeDiagnosticDraft,
  writeDiagnosticResult,
  type DiagnosticLocalCache,
  type SaveDiagnosticDraftInput,
  type SaveDiagnosticResultInput,
} from '../utils/diagnosticCache';
import type {
  Client,
  DiagnosticRuleVersion,
  EmpresaConfig,
  Lead,
  LegalSource,
  PartnerPublic,
  SiteContent,
  UserProfile,
  UserRole,
  VisaCategory,
  VisaRequirement,
} from '../types/domain';

export interface OfflineSyncResultSummary {
  ok: boolean;
  syncedCatalog: boolean;
  syncedLeads: number;
  syncedLogs: number;
  remainingPending: number;
  message: string;
}

interface AppContextValue {
  firebaseUser: User | null;
  userProfile: UserProfile | null;
  authLoading: boolean;
  authError: string | null;
  portalClient: Client | null;
  portalLeads: Lead[];
  portalAccess: PortalAccessResolution | null;
  portalStage: PortalLifecycleStage;
  portalAccessLoading: boolean;
  empresa: EmpresaConfig;
  siteContent: SiteContent[];
  partnersPublic: PartnerPublic[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeDiagnosticRules: DiagnosticRuleVersion;
  isOnline: boolean;
  catalogSource: CatalogSyncSource;
  lastRulesSyncAt: string | null;
  aiRuntimeMode: 'unknown' | 'cloud' | 'local_rules';
  aiRuntimeReason: string | null;
  pendingOfflineCounts: { pendingLeads: number; pendingLogs: number; total: number };
  syncingOffline: boolean;
  lastSyncFeedback: string | null;
  loginWithGoogle: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  refreshPublicData: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  refreshClientPortalAccess: () => Promise<PortalAccessResolution | null>;
  forceSyncOfflineData: () => Promise<OfflineSyncResultSummary>;
  diagnosticCache: DiagnosticLocalCache;
  hasDiagnosticDraft: boolean;
  hasCachedDiagnosticResult: boolean;
  saveDiagnosticDraft: (input: SaveDiagnosticDraftInput) => DiagnosticLocalCache;
  saveDiagnosticResultCache: (input: SaveDiagnosticResultInput) => DiagnosticLocalCache;
  clearDiagnosticDraft: () => void;
  clearDiagnosticCache: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function mapFirebaseAuthErrorPT(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = `${code} ${err instanceof Error ? err.message : String(err)}`;
  if (msg.includes('popup-closed-by-user') || msg.includes('cancelled-popup-request')) {
    return 'Login cancelado antes da conclusão. Clique novamente para escolher sua conta Google.';
  }
  if (msg.includes('popup-blocked')) {
    return 'O navegador bloqueou a janela de login do Google. Libere pop-ups para este site e tente novamente.';
  }
  if (msg.includes('unauthorized-domain')) {
    return 'Este domínio ainda não está autorizado no Firebase Authentication. Verifique a lista de domínios autorizados.';
  }
  if (msg.includes('user-disabled')) {
    return 'Esta conta Google foi desativada no Firebase Authentication. Entre em contato com o administrador.';
  }
  if (msg.includes('account-exists-with-different-credential')) {
    return 'Já existe uma conta cadastrada com este e-mail usando outro método de acesso.';
  }
  if (msg.includes('operation-not-allowed')) {
    return 'O provedor Google Sign-In não está habilitado no projeto Firebase. Ative-o no console do Firebase Authentication.';
  }
  if (msg.includes('network-request-failed')) {
    return 'Falha de conexão ao autenticar. Verifique sua internet e tente novamente.';
  }
  return 'Não foi possível concluir o login com Google. Tente novamente.';
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isDark } = useTheme();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Estado centralizado do Portal do Cliente (transição Gratuito ↔ Pendente ↔ Contratado)
  const [portalClient, setPortalClient] = useState<Client | null>(null);
  const [portalLeads, setPortalLeads] = useState<Lead[]>([]);
  const [portalAccessLoading, setPortalAccessLoading] = useState(false);
  const [portalLinkAttemptExhausted, setPortalLinkAttemptExhausted] = useState(false);
  const portalSyncSeqRef = useRef(0);
  const inFlightPortalSyncRef = useRef<Map<string, Promise<PortalAccessResolution | null>>>(new Map());
  const lastSyncedPortalUidRef = useRef<string | null>(null);
  const attemptedClientLinkKeysRef = useRef<Set<string>>(new Set());
  const lastPortalClientJsonRef = useRef<string>('');
  const userProfileRef = useRef<UserProfile | null>(null);
  userProfileRef.current = userProfile;

  const setPortalClientIfChanged = useCallback((nextClient: Client | null) => {
    const serialized = nextClient ? JSON.stringify(nextClient) : '';
    if (serialized === lastPortalClientJsonRef.current) return;
    lastPortalClientJsonRef.current = serialized;
    setPortalClient(nextClient);
  }, []);

  const initialSnapshot = React.useMemo(() => loadRuleEngineSnapshotSync(), []);

  const [empresa, setEmpresa] = useState<EmpresaConfig>(initialSnapshot.empresa);
  const [siteContent, setSiteContent] = useState<SiteContent[]>(SEED_SITE_CONTENT);
  const [partnersPublic, setPartnersPublic] = useState<PartnerPublic[]>(
    initialSnapshot.source === 'nuvem' || initialSnapshot.source === 'cache_local'
      ? initialSnapshot.partnersPublic
      : [],
  );
  const [visaCategories, setVisaCategories] = useState<VisaCategory[]>(initialSnapshot.visaCategories);
  const [visaRequirements, setVisaRequirements] = useState<VisaRequirement[]>(initialSnapshot.visaRequirements);
  const [legalSources, setLegalSources] = useState<LegalSource[]>(initialSnapshot.legalSources);
  const [activeDiagnosticRules, setActiveDiagnosticRules] = useState<DiagnosticRuleVersion>(
    initialSnapshot.activeDiagnosticRules,
  );

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine !== false,
  );
  const [catalogSource, setCatalogSource] = useState<CatalogSyncSource>(initialSnapshot.source);
  const [lastRulesSyncAt, setLastRulesSyncAt] = useState<string | null>(initialSnapshot.savedAt || null);
  const [aiRuntimeMode, setAiRuntimeMode] = useState<'unknown' | 'cloud' | 'local_rules'>(
    () => getLocalAiRuntimeNotice().mode,
  );
  const [aiRuntimeReason, setAiRuntimeReason] = useState<string | null>(
    () => getLocalAiRuntimeNotice().reason || null,
  );
  const [pendingOfflineCounts, setPendingOfflineCounts] = useState(() => countPendingOfflineItems());
  const [syncingOffline, setSyncingOffline] = useState(false);
  const [lastSyncFeedback, setLastSyncFeedback] = useState<string | null>(null);

  // Cache local centralizado de rascunho e resultado do diagnóstico migratório
  const [diagnosticCache, setDiagnosticCache] = useState<DiagnosticLocalCache>(() => readDiagnosticCache());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === DIAGNOSTIC_CACHE_STORAGE_KEY) {
        setDiagnosticCache(readDiagnosticCache());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const saveDiagnosticDraft = useCallback(
    (input: SaveDiagnosticDraftInput): DiagnosticLocalCache => {
      const ttlDays = Math.max(1, empresa.diasExpiracaoLinkDiagnostico || 30);
      const next = writeDiagnosticDraft(input, undefined, Date.now(), ttlDays);
      setDiagnosticCache(next);
      return next;
    },
    [empresa.diasExpiracaoLinkDiagnostico],
  );

  const saveDiagnosticResultCache = useCallback(
    (input: SaveDiagnosticResultInput): DiagnosticLocalCache => {
      const ttlDays = Math.max(1, empresa.diasExpiracaoLinkDiagnostico || 30);
      const next = writeDiagnosticResult(input, undefined, Date.now(), ttlDays);
      setDiagnosticCache(next);
      return next;
    },
    [empresa.diasExpiracaoLinkDiagnostico],
  );

  const clearDiagnosticDraft = useCallback(() => {
    const next = clearDiagnosticDraftStorage();
    setDiagnosticCache(next);
  }, []);

  const clearDiagnosticCache = useCallback(() => {
    const next = clearDiagnosticCacheStorage();
    setDiagnosticCache(next);
  }, []);

  // Aplica tema e layout dinâmicos lidos do Firestore (config/empresa) via CSS variables + Favicon
  // No modo escuro (.dark), remove overrides inline de cores claras para respeitar a paleta escura em index.css
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.style.removeProperty('--color-primary');
      root.style.removeProperty('--color-accent');
      root.style.removeProperty('--color-bg');
      root.style.removeProperty('--color-surface');
      root.style.removeProperty('--color-text');
      root.style.removeProperty('--color-footer-bg');
    } else {
      const legacyPrimary = new Set(['#0B1F33', '#0b1f33', '#0F172A', '#0f172a']);
      const legacyBg = new Set(['#F7F5F0', '#f7f5f0', '#FAF9F6', '#faf9f6']);
      const legacyAccent = new Set(['#C8A236', '#c8a236', '#C9A227', '#c9a227']);
      const legacyFooter = new Set(['#081726', '#081726']);

      const resolvedPrimary =
        !empresa.corPrimaria || legacyPrimary.has(empresa.corPrimaria) ? '#090F1A' : empresa.corPrimaria;
      const resolvedAccent =
        !empresa.corDestaque || legacyAccent.has(empresa.corDestaque) ? '#10B981' : empresa.corDestaque;
      const resolvedBg =
        !empresa.corFundo || legacyBg.has(empresa.corFundo) ? '#F8FAFC' : empresa.corFundo;
      const resolvedFooter =
        !empresa.corRodapeBg || legacyFooter.has(empresa.corRodapeBg) ? '#060B14' : empresa.corRodapeBg;

      root.style.setProperty('--color-primary', resolvedPrimary);
      root.style.setProperty('--color-accent', resolvedAccent);
      root.style.setProperty('--color-bg', resolvedBg);
      root.style.setProperty('--color-surface', empresa.corSuperficie || '#FFFFFF');
      root.style.setProperty('--color-text', empresa.corTexto || '#090F1A');
      root.style.setProperty('--color-footer-bg', resolvedFooter);
    }

    const fontMap: Record<string, string> = {
      'DM Sans': "'DM Sans', system-ui, -apple-system, sans-serif",
      'Plus Jakarta Sans': "'DM Sans', system-ui, -apple-system, sans-serif",
      Manrope: "'Manrope', 'DM Sans', system-ui, sans-serif",
      'Public Sans': "'Public Sans', 'DM Sans', system-ui, sans-serif",
      Montserrat: "'Montserrat', 'DM Sans', system-ui, sans-serif",
      Merriweather: "'Merriweather', Georgia, serif",
      Inter: "'DM Sans', system-ui, sans-serif",
    };
    const displayMap: Record<string, string> = {
      'Bricolage Grotesque': "'Bricolage Grotesque', 'DM Sans', system-ui, sans-serif",
      'Playfair Display': "'Bricolage Grotesque', 'DM Sans', system-ui, sans-serif",
      'Plus Jakarta Sans': "'Bricolage Grotesque', 'DM Sans', system-ui, sans-serif",
      Outfit: "'Outfit', 'Bricolage Grotesque', system-ui, sans-serif",
      Manrope: "'Manrope', 'Bricolage Grotesque', system-ui, sans-serif",
      Montserrat: "'Montserrat', 'Bricolage Grotesque', system-ui, sans-serif",
    };
    root.style.setProperty('--font-main', fontMap[empresa.fontePrincipal] || fontMap['DM Sans']);
    root.style.setProperty(
      '--font-display',
      displayMap[empresa.fonteDisplay || 'Bricolage Grotesque'] || displayMap['Bricolage Grotesque'],
    );

    const raio = empresa.layoutConfig?.raioBordas || 'editorial';
    if (raio === 'sharp') {
      root.style.setProperty('--radius-card', '0.375rem');
      root.style.setProperty('--radius-button', '0.25rem');
    } else if (raio === 'arredondado') {
      root.style.setProperty('--radius-card', '1.5rem');
      root.style.setProperty('--radius-button', '9999px');
    } else {
      root.style.setProperty('--radius-card', '1rem');
      root.style.setProperty('--radius-button', '0.625rem');
    }

    if (empresa.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = empresa.faviconUrl;
    }
  }, [empresa, isDark]);

  const refreshPublicDataWithStatus = useCallback(async (): Promise<boolean> => {
    const bundle = await fetchRuleEngineBundleWithSync();
    setEmpresa(bundle.empresa);
    setSiteContent(bundle.siteContent);
    setPartnersPublic(bundle.partnersPublic);
    setVisaCategories(bundle.visaCategories);
    setVisaRequirements(bundle.visaRequirements);
    setLegalSources(bundle.legalSources);
    setActiveDiagnosticRules(bundle.activeDiagnosticRules);
    setCatalogSource(bundle.source);
    if (bundle.savedAt) {
      setLastRulesSyncAt(bundle.savedAt);
    }
    return bundle.fromCloud;
  }, []);

  const refreshPublicData = useCallback(async (): Promise<void> => {
    await refreshPublicDataWithStatus();
  }, [refreshPublicDataWithStatus]);

  useEffect(() => {
    void refreshPublicData();
    void Promise.all([hydrateRuleEngineLogsFromIdb(), hydratePendingDiagnosticsFromIdb()]).then(() => {
      setPendingOfflineCounts(countPendingOfflineItems());
    });
    const unsubOffline = subscribeOfflineEngineChanges(() => {
      const notice = getLocalAiRuntimeNotice();
      setAiRuntimeMode(notice.mode);
      setAiRuntimeReason(notice.reason || null);
      setPendingOfflineCounts(countPendingOfflineItems());
    });
    const unsubPartnersPublic =
      import.meta.env.DEV && isDevE2eActive()
        ? () => undefined
        : subscribePartnersPublicLive(
            (livePartners) => {
              setPartnersPublic(livePartners);
              updatePartnersInOfflineSnapshot(livePartners);
            },
            () => {
              // Fallback silencioso caso o cliente esteja offline
            },
          );
    return () => {
      unsubOffline();
      unsubPartnersPublic();
    };
  }, [refreshPublicData]);

  const forceSyncOfflineData = useCallback(async (): Promise<OfflineSyncResultSummary> => {
    setSyncingOffline(true);
    setLastSyncFeedback(null);
    const onlineNow = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    setIsOnline(onlineNow);

    try {
      if (!onlineNow) {
        const counts = countPendingOfflineItems();
        const message =
          'Dispositivo ainda sem conexão de rede. O motor local segue operando com os dados salvos.';
        setLastSyncFeedback(message);
        return {
          ok: false,
          syncedCatalog: false,
          syncedLeads: 0,
          syncedLogs: 0,
          remainingPending: counts.total,
          message,
        };
      }

      const syncedCatalog = await refreshPublicDataWithStatus();

      let syncedLeads = 0;
      const pendingDiags = listPendingOfflineDiagnostics();
      for (const item of pendingDiags) {
        try {
          await syncPendingOfflineDiagnosticToFirestore(item);
          removePendingOfflineDiagnostic(item.sessionToken);
          syncedLeads += 1;
        } catch {
          // mantém na fila local para próxima tentativa
        }
      }

      let syncedLogs = 0;
      if (auth.currentUser || (import.meta.env.DEV && isDevE2eActive())) {
        const pendingLogs = listRuleEngineDecisionLogs().filter((l) => l.syncStatus === 'pendente');
        for (const log of pendingLogs) {
          try {
            await syncRuleEngineDecisionLogToFirestore(log, userProfile?.role);
            markRuleEngineDecisionSynced(log.id);
            syncedLogs += 1;
          } catch {
            // mantém pendente localmente
          }
        }
      }

      const remaining = countPendingOfflineItems();
      setPendingOfflineCounts(remaining);

      const parts: string[] = [];
      parts.push(
        syncedCatalog
          ? 'Catálogo do motor de regras sincronizado com a nuvem'
          : 'Não foi possível alcançar o Firestore agora (mantida base local)',
      );
      if (syncedLeads > 0) parts.push(`${syncedLeads} diagnóstico(s) offline enviado(s)`);
      if (syncedLogs > 0) parts.push(`${syncedLogs} log(s) de decisão sincronizado(s)`);
      if (remaining.total > 0 && !auth.currentUser && remaining.pendingLogs > 0) {
        parts.push(`${remaining.pendingLogs} log(s) aguardam login da equipe para subir à nuvem`);
      }

      const message = `${parts.join(' · ')}.`;
      setLastSyncFeedback(message);
      return {
        ok: syncedCatalog,
        syncedCatalog,
        syncedLeads,
        syncedLogs,
        remainingPending: remaining.total,
        message,
      };
    } finally {
      setSyncingOffline(false);
    }
  }, [refreshPublicDataWithStatus, userProfile]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setIsOnline(true);
      void forceSyncOfflineData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setLastSyncFeedback(null);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [forceSyncOfflineData]);

  const inFlightSyncRef = React.useRef<Map<string, Promise<UserProfile>>>(new Map());
  const authSyncSeqRef = React.useRef(0);

  const runUserDocumentSync = useCallback(async (fbUser: User): Promise<UserProfile> => {
    const normalizedEmail = (fbUser.email || '').trim().toLowerCase();

    // Garante token JWT atualizado no SDK antes de qualquer leitura/gravação no Firestore,
    // eliminando erros de permissão pós-login e a necessidade de "Sincronizar permissões".
    await fbUser.getIdToken(true).catch(() => undefined);

    let isAdminEmail = isPrimaryAdminEmail(normalizedEmail);

    if (isAdminEmail) {
      clearAdminVerificationCache();
      const adminCheck = await verifyAndEnsureAdminAccess(fbUser, { force: true });
      if (adminCheck.authorized && adminCheck.profile) {
        await runIdempotentSeedsIfAdmin('admin');
        await refreshPublicData();
        return adminCheck.profile;
      }
    }

    if (!isAdminEmail) {
      try {
        const token = await fbUser.getIdToken();
        const resp = await fetch('/api/auth/check-admin', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        const contentType = resp.headers.get('content-type') || '';
        if (resp.ok && contentType.includes('application/json')) {
          const json = (await resp.json()) as { isAdminEmail?: boolean };
          isAdminEmail = Boolean(json.isAdminEmail);
        }
      } catch {
        // ignore if offline or static hosting without /api proxy
      }
    }

    const userRef = doc(db, 'users', fbUser.uid);
    const snap = await getDoc(userRef);
    const now = new Date().toISOString();

    const resolved = resolveUserProfileFromFirestoreData({
      uid: fbUser.uid,
      email: normalizedEmail,
      displayName: fbUser.displayName,
      photoURL: fbUser.photoURL,
      isAdminEmail,
      existingData: snap.exists() ? (snap.data() as Partial<UserProfile>) : null,
      nowIso: now,
    });

    let profile = resolved.profile;
    if (resolved.needsCreate) {
      await setDoc(userRef, sanitizeFirestoreData(profile));
    } else if (resolved.needsAdminRepair) {
      await setDoc(userRef, sanitizeFirestoreData(profile), { merge: true });
    }

    if (profile.role === 'admin' && profile.status === 'ativo') {
      await runIdempotentSeedsIfAdmin('admin');
      await refreshPublicData();
    } else if (profile.role === 'cliente') {
      // Força sincronização completa de users/{uid}.clientId, status='ativo' e clients/{id}.userId
      // durante o próprio login antes de liberar o Portal do Cliente.
      profile = await linkGoogleUserToClientOrLead(profile, { force: true });
    }
    return profile;
  }, [refreshPublicData]);

  const syncUserDocument = useCallback(
    (fbUser: User): Promise<UserProfile> => {
      const existingPromise = inFlightSyncRef.current.get(fbUser.uid);
      if (existingPromise) return existingPromise;
      const promise = runUserDocumentSync(fbUser).finally(() => {
        inFlightSyncRef.current.delete(fbUser.uid);
      });
      inFlightSyncRef.current.set(fbUser.uid, promise);
      return promise;
    },
    [runUserDocumentSync],
  );

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const runClientPortalSync = useCallback(
    async (profileInput: UserProfile | null): Promise<PortalAccessResolution | null> => {
      const seq = ++portalSyncSeqRef.current;
      if (!profileInput || profileInput.role !== 'cliente') {
        lastSyncedPortalUidRef.current = null;
        setPortalClientIfChanged(null);
        setPortalLeads([]);
        setPortalLinkAttemptExhausted(false);
        setPortalAccessLoading(false);
        return null;
      }

      setPortalAccessLoading(true);
      try {
        let effectiveProfile = profileInput;
        const [matchedClient, leads] = await Promise.all([
          fetchSignedInClientRecord(effectiveProfile.uid, effectiveProfile.email, effectiveProfile.clientId),
          fetchSignedInUserDiagnosticLeads(effectiveProfile.email),
        ]);

        // Garante que users/{uid}.clientId e status='ativo' estejam gravados no Firestore
        // ANTES de expor portalStage='contratado', mas sem nunca entrar em loop se falhar.
        const autoLinkCheck = shouldAttemptClientAutoLink({
          userProfile: effectiveProfile,
          client: matchedClient,
          attemptedKeys: attemptedClientLinkKeysRef.current,
        });

        let exhausted = false;
        if (autoLinkCheck.shouldAttempt && matchedClient && autoLinkCheck.key) {
          attemptedClientLinkKeysRef.current.add(autoLinkCheck.key);
          const linked = await linkGoogleUserToClientOrLead(effectiveProfile, {
            force: true,
            knownClient: matchedClient,
          });
          effectiveProfile = linked;
          if (seq === portalSyncSeqRef.current) {
            setUserProfile(linked);
          }
          if (linked.clientId !== matchedClient.id) {
            exhausted = true;
          }
        } else if (
          matchedClient &&
          matchedClient.portalLiberado === true &&
          !matchedClient.arquivado &&
          effectiveProfile.clientId !== matchedClient.id
        ) {
          const key = buildClientLinkAttemptKey({
            uid: effectiveProfile.uid,
            clientId: matchedClient.id,
            portalLiberado: true,
          });
          exhausted = attemptedClientLinkKeysRef.current.has(key);
        }

        if (seq !== portalSyncSeqRef.current) {
          return null;
        }

        lastSyncedPortalUidRef.current = effectiveProfile.uid;
        setPortalLinkAttemptExhausted(exhausted);
        setPortalClientIfChanged(matchedClient);
        setPortalLeads(leads);
        return resolveClientPortalAccess({
          userProfile: effectiveProfile,
          client: matchedClient,
          leads,
        });
      } catch (err) {
        console.warn(
          '[Portal] Falha ao sincronizar estado do portal do cliente:',
          err instanceof Error ? err.message : String(err),
        );
        return null;
      } finally {
        if (seq === portalSyncSeqRef.current) {
          setPortalAccessLoading(false);
        }
      }
    },
    [setPortalClientIfChanged],
  );

  const syncClientPortalState = useCallback(
    (profileInput: UserProfile | null): Promise<PortalAccessResolution | null> => {
      if (!profileInput || profileInput.role !== 'cliente') {
        return runClientPortalSync(profileInput);
      }
      const existingPromise = inFlightPortalSyncRef.current.get(profileInput.uid);
      if (existingPromise) return existingPromise;
      const promise = runClientPortalSync(profileInput).finally(() => {
        inFlightPortalSyncRef.current.delete(profileInput.uid);
      });
      inFlightPortalSyncRef.current.set(profileInput.uid, promise);
      return promise;
    },
    [runClientPortalSync],
  );

  const refreshUserProfile = useCallback(async () => {
    if (!auth.currentUser) {
      lastSyncedPortalUidRef.current = null;
      attemptedClientLinkKeysRef.current.clear();
      setUserProfile(null);
      setPortalClientIfChanged(null);
      setPortalLeads([]);
      setPortalLinkAttemptExhausted(false);
      setPortalAccessLoading(false);
      return;
    }
    try {
      attemptedClientLinkKeysRef.current.clear();
      setPortalLinkAttemptExhausted(false);
      const p = await syncUserDocument(auth.currentUser);
      setUserProfile(p);
      if (p.role === 'cliente') {
        await syncClientPortalState(p);
      }
    } catch (err) {
      reportAppError(err, { source: 'auth-profile-refresh', path: `users/${auth.currentUser.uid}` });
    }
  }, [syncUserDocument, syncClientPortalState, setPortalClientIfChanged]);

  const refreshClientPortalAccess = useCallback(async (): Promise<PortalAccessResolution | null> => {
    attemptedClientLinkKeysRef.current.clear();
    setPortalLinkAttemptExhausted(false);
    if (auth.currentUser) {
      try {
        const freshProfile = await syncUserDocument(auth.currentUser);
        setUserProfile(freshProfile);
        return await syncClientPortalState(freshProfile);
      } catch (err) {
        reportAppError(err, { source: 'portal-access-manual-refresh', path: `users/${auth.currentUser.uid}` });
      }
    }
    return syncClientPortalState(userProfileRef.current);
  }, [syncUserDocument, syncClientPortalState]);

  // Sincronização em tempo real de `users/{uid}` para TODOS os perfis autenticados
  // (administradores, consultores, assistentes e clientes), garantindo atualização automática
  // de permissões sem necessidade de clicar em "Sincronizar permissões".
  const activeAuthUid = userProfile?.uid || null;
  const activeClientUid = userProfile?.role === 'cliente' ? userProfile.uid : null;
  const activeClientId = userProfile?.role === 'cliente' ? portalClient?.id || userProfile.clientId || null : null;

  useEffect(() => {
    if (!activeAuthUid) return;
    if (import.meta.env.DEV && isDevE2eActive()) return;

    const unsubUser = onSnapshot(
      doc(db, 'users', activeAuthUid),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Partial<UserProfile>;
        const current = userProfileRef.current;
        if (!current || current.uid !== activeAuthUid) return;
        if (!hasAuthPermissionDelta(current, data)) return;

        const nextRole: UserRole =
          data.role === 'admin' ||
          data.role === 'consultor' ||
          data.role === 'assistente' ||
          data.role === 'cliente'
            ? data.role
            : current.role;
        const nextStatus: UserProfile['status'] =
          data.status === 'ativo' || data.status === 'pendente' || data.status === 'inativo'
            ? data.status
            : current.status;
        const nextClientId =
          typeof data.clientId === 'string' ? data.clientId : current.clientId;

        const updated: UserProfile = {
          ...current,
          ...data,
          uid: activeAuthUid,
          role: nextRole,
          status: nextStatus,
          clientId: nextClientId,
        };

        void auth.currentUser?.getIdToken(true).catch(() => undefined);
        if (isStaffRole(nextRole) || isStaffRole(current.role)) {
          clearAdminVerificationCache();
        }
        setUserProfile(updated);
        if (nextRole === 'cliente') {
          void syncClientPortalState(updated);
        } else {
          lastSyncedPortalUidRef.current = null;
          setPortalClientIfChanged(null);
          setPortalLeads([]);
          setPortalLinkAttemptExhausted(false);
          setPortalAccessLoading(false);
        }
      },
      (err) => {
        console.warn(
          `[Auth] Listener de permissões users/${activeAuthUid}:`,
          err instanceof Error ? err.message : String(err),
        );
      },
    );

    return () => unsubUser();
  }, [activeAuthUid, syncClientPortalState, setPortalClientIfChanged]);

  useEffect(() => {
    if (!activeClientUid || !userProfileRef.current) {
      lastSyncedPortalUidRef.current = null;
      setPortalClientIfChanged(null);
      setPortalLeads([]);
      setPortalLinkAttemptExhausted(false);
      setPortalAccessLoading(false);
      return;
    }

    // Evita disparo redundante caso o login/onAuthStateChanged já tenha sincronizado este UID
    if (lastSyncedPortalUidRef.current === activeClientUid) {
      return;
    }

    void syncClientPortalState(userProfileRef.current);
  }, [activeClientUid, syncClientPortalState, setPortalClientIfChanged]);

  useEffect(() => {
    if (!activeClientUid || !activeClientId) return;
    if (import.meta.env.DEV && isDevE2eActive()) return;

    const unsubClient = onSnapshot(
      doc(db, 'clients', activeClientId),
      (snap) => {
        if (!snap.exists()) return;
        const nextClient: Client = { id: snap.id, ...(snap.data() as Omit<Client, 'id'>) };
        const current = userProfileRef.current;

        const autoLinkCheck = shouldAttemptClientAutoLink({
          userProfile: current,
          client: nextClient,
          attemptedKeys: attemptedClientLinkKeysRef.current,
        });

        if (autoLinkCheck.shouldAttempt && current && autoLinkCheck.key) {
          attemptedClientLinkKeysRef.current.add(autoLinkCheck.key);
          setPortalAccessLoading(true);
          void linkGoogleUserToClientOrLead(current, {
            force: true,
            knownClient: nextClient,
          })
            .then((linked) => {
              setUserProfile(linked);
              setPortalClientIfChanged(nextClient);
              setPortalLinkAttemptExhausted(linked.clientId !== nextClient.id);
            })
            .finally(() => {
              setPortalAccessLoading(false);
            });
          return;
        }

        setPortalClientIfChanged(nextClient);
      },
      () => {
        // Fallback silencioso caso o cliente ainda não tenha permissão de escuta direta no documento
      },
    );

    return () => unsubClient();
  }, [activeClientUid, activeClientId, setPortalClientIfChanged]);

  const portalAccess = useMemo<PortalAccessResolution | null>(() => {
    if (!userProfile || userProfile.role !== 'cliente') return null;
    return resolveClientPortalAccess({
      userProfile,
      client: portalClient,
      leads: portalLeads,
    });
  }, [userProfile, portalClient, portalLeads]);

  const portalStage = useMemo<PortalLifecycleStage>(() => {
    return resolveSafePortalStage({
      authLoading,
      portalAccessLoading,
      userProfile,
      portalAccessKind: portalAccess?.kind ?? null,
      portalAccessClientId: portalAccess?.kind === 'active_paid' ? portalAccess.client.id : null,
      linkAttemptExhausted: portalLinkAttemptExhausted,
    });
  }, [authLoading, portalAccessLoading, userProfile, portalAccess, portalLinkAttemptExhausted]);

  useEffect(() => {
    if (import.meta.env.DEV && isDevE2eActive()) {
      setFirebaseUser(createDevE2eFirebaseUser() as unknown as User);
      setUserProfile(getDevE2eAuthProfile());
      setAuthError(null);
      setAuthLoading(false);
      return subscribeDevE2eChanges(() => {
        void refreshPublicData();
      });
    }
    const unsub = onAuthStateChanged(auth, async (user) => {
      const seq = ++authSyncSeqRef.current;
      setFirebaseUser(user);
      if (!user) {
        clearAdminVerificationCache();
        portalSyncSeqRef.current += 1;
        lastSyncedPortalUidRef.current = null;
        attemptedClientLinkKeysRef.current.clear();
        setUserProfile(null);
        setPortalClientIfChanged(null);
        setPortalLeads([]);
        setPortalLinkAttemptExhausted(false);
        setPortalAccessLoading(false);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      try {
        const p = await syncUserDocument(user);
        if (seq !== authSyncSeqRef.current) return;
        setUserProfile(p);
        if (p.role === 'cliente') {
          await syncClientPortalState(p);
        }
        if (seq === authSyncSeqRef.current) {
          setAuthError(null);
        }
      } catch (err) {
        if (seq !== authSyncSeqRef.current) return;
        const msg = mapFirebaseAuthErrorPT(err);
        setAuthError(msg);
        reportAppError(err, { source: 'auth-state-sync', path: `users/${user.uid}` });
      } finally {
        if (seq === authSyncSeqRef.current) {
          setAuthLoading(false);
        }
      }
    });
    return () => unsub();
  }, [syncUserDocument, syncClientPortalState, refreshPublicData, setPortalClientIfChanged]);

  const loginWithGoogle = useCallback(async (): Promise<UserProfile | null> => {
    setAuthError(null);
    if (import.meta.env.DEV && isDevE2eActive()) {
      const profile = getDevE2eAuthProfile();
      setFirebaseUser(createDevE2eFirebaseUser() as unknown as User);
      setUserProfile(profile);
      return profile;
    }
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const seq = ++authSyncSeqRef.current;
      attemptedClientLinkKeysRef.current.clear();
      setPortalLinkAttemptExhausted(false);
      setAuthLoading(true);
      const profile = await syncUserDocument(result.user);
      if (seq === authSyncSeqRef.current) {
        setUserProfile(profile);
      }
      if (profile.role === 'cliente') {
        await syncClientPortalState(profile);
      }
      if (seq === authSyncSeqRef.current) {
        setAuthLoading(false);
      }
      return profile;
    } catch (err) {
      setAuthLoading(false);
      const msg = mapFirebaseAuthErrorPT(err);
      setAuthError(msg);
      reportAppError(err, { source: 'auth-google-login' });
      return null;
    }
  }, [syncUserDocument, syncClientPortalState]);

  const logout = useCallback(async () => {
    if (import.meta.env.DEV && isDevE2eActive()) {
      try {
        window.sessionStorage.removeItem('__DM_E2E_SESSION__');
      } catch {
        // ignore
      }
      setUserProfile(null);
      setFirebaseUser(null);
      return;
    }
    try {
      await signOut(auth);
    } catch (err) {
      reportAppError(err, { source: 'auth-logout' });
    } finally {
      clearAdminVerificationCache();
      portalSyncSeqRef.current += 1;
      lastSyncedPortalUidRef.current = null;
      attemptedClientLinkKeysRef.current.clear();
      setPortalClientIfChanged(null);
      setPortalLeads([]);
      setPortalLinkAttemptExhausted(false);
      setPortalAccessLoading(false);
      setUserProfile(null);
      setFirebaseUser(null);
    }
  }, [setPortalClientIfChanged]);

  return (
    <AppContext.Provider
      value={{
        firebaseUser,
        userProfile,
        authLoading,
        authError,
        portalClient,
        portalLeads,
        portalAccess,
        portalStage,
        portalAccessLoading,
        empresa,
        siteContent,
        partnersPublic,
        visaCategories,
        visaRequirements,
        legalSources,
        activeDiagnosticRules,
        isOnline,
        catalogSource,
        lastRulesSyncAt,
        aiRuntimeMode,
        aiRuntimeReason,
        pendingOfflineCounts,
        syncingOffline,
        lastSyncFeedback,
        loginWithGoogle,
        logout,
        clearAuthError,
        refreshPublicData,
        refreshUserProfile,
        refreshClientPortalAccess,
        forceSyncOfflineData,
        diagnosticCache,
        hasDiagnosticDraft: Boolean(diagnosticCache.draft),
        hasCachedDiagnosticResult: Boolean(diagnosticCache.lastResult),
        saveDiagnosticDraft,
        saveDiagnosticResultCache,
        clearDiagnosticDraft,
        clearDiagnosticCache,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp deve ser usado dentro de AppProvider');
  return ctx;
}
