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
  DEFAULT_DIAGNOSTIC_RULE_VERSION,
  DEFAULT_EMPRESA_CONFIG,
  SEED_LEGAL_SOURCES,
  SEED_PARTNERS,
  SEED_SITE_CONTENT,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import {
  fetchActiveDiagnosticRules,
  fetchEmpresaConfig,
  fetchPartnersPublic,
  fetchSiteContentPublic,
  fetchVisaCatalogPublic,
  linkGoogleUserToClientOrLead,
  runIdempotentSeedsIfAdmin,
} from '../services/firestoreService';
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
  loginWithGoogle: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  clearAuthError: () => void;
  refreshPublicData: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
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

  const [empresa, setEmpresa] = useState<EmpresaConfig>(DEFAULT_EMPRESA_CONFIG);
  const [siteContent, setSiteContent] = useState<SiteContent[]>(SEED_SITE_CONTENT);
  const [partnersPublic, setPartnersPublic] = useState<PartnerPublic[]>(SEED_PARTNERS.map((p) => p.pub));
  const [visaCategories, setVisaCategories] = useState<VisaCategory[]>(SEED_VISA_CATEGORIES);
  const [visaRequirements, setVisaRequirements] = useState<VisaRequirement[]>(SEED_VISA_REQUIREMENTS);
  const [legalSources, setLegalSources] = useState<LegalSource[]>(SEED_LEGAL_SOURCES);
  const [activeDiagnosticRules, setActiveDiagnosticRules] = useState<DiagnosticRuleVersion>(DEFAULT_DIAGNOSTIC_RULE_VERSION);

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

  const refreshPublicData = useCallback(async () => {
    const [cfg, content, partners, catalog, rules] = await Promise.all([
      fetchEmpresaConfig(),
      fetchSiteContentPublic(),
      fetchPartnersPublic(),
      fetchVisaCatalogPublic(),
      fetchActiveDiagnosticRules(),
    ]);
    setEmpresa(cfg);
    setSiteContent(content);
    setPartnersPublic(partners);
    setVisaCategories(catalog.categories);
    setVisaRequirements(catalog.requirements);
    setLegalSources(catalog.legalSources);
    setActiveDiagnosticRules(rules);
  }, []);

  useEffect(() => {
    void refreshPublicData();
  }, [refreshPublicData]);

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
  }, [syncUserDocument]);

  const loginWithGoogle = useCallback(async (): Promise<UserProfile | null> => {
    setAuthError(null);
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
        loginWithGoogle,
        logout,
        clearAuthError,
        refreshPublicData,
        refreshUserProfile,
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
