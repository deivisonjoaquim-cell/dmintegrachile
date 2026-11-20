import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
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
import {
  SEED_PARTNERS,
  SEED_SITE_CONTENT,
} from '../data/seeds';
import {
  fetchAiHealthStatus,
  fetchRuleEngineBundleWithSync,
  linkGoogleUserToClientOrLead,
  runIdempotentSeedsIfAdmin,
  syncPendingOfflineDiagnosticToFirestore,
  syncRuleEngineDecisionLogToFirestore,
} from '../services/firestoreService';
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
  setLocalAiRuntimeNotice,
  subscribeOfflineEngineChanges,
  type CatalogSyncSource,
} from '../utils/offlineRuleEngineStore';
import type {
  DiagnosticRuleVersion,
  EmpresaConfig,
  LegalSource,
  PartnerPublic,
  SiteContent,
  UserProfile,
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
  forceSyncOfflineData: () => Promise<OfflineSyncResultSummary>;
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
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const initialSnapshot = React.useMemo(() => loadRuleEngineSnapshotSync(), []);

  const [empresa, setEmpresa] = useState<EmpresaConfig>(initialSnapshot.empresa);
  const [siteContent, setSiteContent] = useState<SiteContent[]>(SEED_SITE_CONTENT);
  const [partnersPublic, setPartnersPublic] = useState<PartnerPublic[]>(SEED_PARTNERS.map((p) => p.pub));
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

  // Aplica tema e layout dinâmicos lidos do Firestore (config/empresa) via CSS variables + Favicon
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', empresa.corPrimaria || '#0B1F33');
    root.style.setProperty('--color-accent', empresa.corDestaque || '#C8A236');
    root.style.setProperty('--color-bg', empresa.corFundo || '#F7F5F0');
    root.style.setProperty('--color-surface', empresa.corSuperficie || '#FFFFFF');
    root.style.setProperty('--color-text', empresa.corTexto || '#0B1523');
    root.style.setProperty('--color-footer-bg', empresa.corRodapeBg || '#081726');

    const fontMap: Record<string, string> = {
      'Plus Jakarta Sans': "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif",
      'DM Sans': "'DM Sans', 'Plus Jakarta Sans', system-ui, sans-serif",
      Manrope: "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif",
      'Public Sans': "'Public Sans', 'DM Sans', system-ui, sans-serif",
      Montserrat: "'Montserrat', system-ui, sans-serif",
      Merriweather: "'Merriweather', Georgia, serif",
      Inter: "'Inter', system-ui, sans-serif",
    };
    const displayMap: Record<string, string> = {
      'Playfair Display': "'Playfair Display', Georgia, serif",
      'Plus Jakarta Sans': "'Plus Jakarta Sans', system-ui, sans-serif",
      Outfit: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
      Manrope: "'Manrope', system-ui, sans-serif",
      Montserrat: "'Montserrat', system-ui, sans-serif",
    };
    root.style.setProperty('--font-main', fontMap[empresa.fontePrincipal] || fontMap['Plus Jakarta Sans']);
    root.style.setProperty('--font-display', displayMap[empresa.fonteDisplay || 'Playfair Display'] || displayMap['Playfair Display']);

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
  }, [empresa]);

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
    return subscribeOfflineEngineChanges(() => {
      const notice = getLocalAiRuntimeNotice();
      setAiRuntimeMode(notice.mode);
      setAiRuntimeReason(notice.reason || null);
      setPendingOfflineCounts(countPendingOfflineItems());
    });
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

      // Verifica saúde da IA em nuvem quando há equipe autenticada
      if (
        userProfile &&
        userProfile.status === 'ativo' &&
        (userProfile.role === 'admin' || userProfile.role === 'consultor' || userProfile.role === 'assistente')
      ) {
        const aiHealth = await fetchAiHealthStatus();
        if (aiHealth) {
          const hasCloudAi = Boolean(aiHealth.cloudAiConfigured ?? aiHealth.geminiConfigured);
          if (hasCloudAi) {
            setLocalAiRuntimeNotice('cloud');
          } else {
            setLocalAiRuntimeNotice(
              'local_rules',
              'Motor Local Inteligente ativo (100% funcional sem chave). Para ativar IA em nuvem gratuita na Vercel, configure GEMINI_API_KEY, GROQ_API_KEY ou OPENROUTER_API_KEY.',
            );
          }
        }
      }

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

  useEffect(() => {
    if (
      !userProfile ||
      userProfile.status !== 'ativo' ||
      (userProfile.role !== 'admin' && userProfile.role !== 'consultor' && userProfile.role !== 'assistente')
    ) {
      return;
    }
    let cancelled = false;
    void fetchAiHealthStatus().then((health) => {
      if (cancelled || !health) return;
      const hasCloudAi = Boolean(health.cloudAiConfigured ?? health.geminiConfigured);
      if (hasCloudAi) {
        setLocalAiRuntimeNotice('cloud');
      } else {
        setLocalAiRuntimeNotice(
          'local_rules',
          'Motor Local Inteligente ativo (100% funcional sem chave). Para ativar IA em nuvem gratuita na Vercel, configure GEMINI_API_KEY, GROQ_API_KEY ou OPENROUTER_API_KEY.',
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [userProfile]);

  const inFlightSyncRef = React.useRef<Map<string, Promise<UserProfile>>>(new Map());

  const runUserDocumentSync = useCallback(async (fbUser: User): Promise<UserProfile> => {
    const normalizedEmail = (fbUser.email || '').trim().toLowerCase();
    let isAdminEmail = isPrimaryAdminEmail(normalizedEmail);

    if (isAdminEmail) {
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

    let profile: UserProfile;
    if (!snap.exists()) {
      profile = {
        uid: fbUser.uid,
        nome: (fbUser.displayName || normalizedEmail.split('@')[0] || 'Usuário').slice(0, 200),
        email: normalizedEmail,
        fotoUrl: (fbUser.photoURL || '').slice(0, 1000),
        role: isAdminEmail ? 'admin' : 'cliente',
        status: isAdminEmail ? 'ativo' : 'pendente',
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(userRef, sanitizeFirestoreData(profile));
    } else {
      const existingData = snap.data() as Partial<UserProfile>;
      profile = {
        uid: existingData.uid || fbUser.uid,
        nome: existingData.nome || fbUser.displayName || normalizedEmail.split('@')[0] || 'Usuário',
        email: (existingData.email || normalizedEmail).toLowerCase(),
        fotoUrl: existingData.fotoUrl ?? fbUser.photoURL ?? '',
        role: existingData.role || (isAdminEmail ? 'admin' : 'cliente'),
        status: existingData.status || (isAdminEmail ? 'ativo' : 'pendente'),
        createdAt: existingData.createdAt || now,
        updatedAt: existingData.updatedAt || now,
        ...existingData,
      } as UserProfile;

      if (isAdminEmail && (profile.role !== 'admin' || profile.status !== 'ativo' || !existingData.uid)) {
        profile = {
          ...profile,
          uid: fbUser.uid,
          nome: (profile.nome || fbUser.displayName || 'Administrador').slice(0, 200),
          email: normalizedEmail || profile.email,
          role: 'admin',
          status: 'ativo',
          updatedAt: now,
        };
        await setDoc(userRef, sanitizeFirestoreData(profile), { merge: true });
      }
    }

    if (profile.role === 'admin') {
      await runIdempotentSeedsIfAdmin('admin');
      await refreshPublicData();
    } else if (profile.role === 'cliente') {
      profile = await linkGoogleUserToClientOrLead(profile);
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

  const refreshUserProfile = useCallback(async () => {
    if (!auth.currentUser) {
      setUserProfile(null);
      return;
    }
    try {
      const p = await syncUserDocument(auth.currentUser);
      setUserProfile(p);
    } catch (err) {
      reportAppError(err, { source: 'auth-profile-refresh', path: `users/${auth.currentUser.uid}` });
    }
  }, [syncUserDocument]);

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
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setAuthLoading(false);
        return;
      }
      try {
        const p = await syncUserDocument(user);
        setUserProfile(p);
        setAuthError(null);
      } catch (err) {
        const msg = mapFirebaseAuthErrorPT(err);
        setAuthError(msg);
        reportAppError(err, { source: 'auth-state-sync', path: `users/${user.uid}` });
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsub();
  }, [syncUserDocument, refreshPublicData]);

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
      const profile = await syncUserDocument(result.user);
      setUserProfile(profile);
      return profile;
    } catch (err) {
      const msg = mapFirebaseAuthErrorPT(err);
      setAuthError(msg);
      reportAppError(err, { source: 'auth-google-login' });
      return null;
    }
  }, [syncUserDocument]);

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
      setUserProfile(null);
      setFirebaseUser(null);
    }
  }, []);

  return (
    <AppContext.Provider
      value={{
        firebaseUser,
        userProfile,
        authLoading,
        authError,
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
        forceSyncOfflineData,
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
