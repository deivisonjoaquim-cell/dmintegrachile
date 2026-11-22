import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { SITE_TRANSLATIONS, translateSeedText, type SiteLocale, type SiteTranslations } from '../utils/i18n';

const STORAGE_KEY = 'dm_site_locale';

interface LanguageContextValue {
  locale: SiteLocale;
  isEsCL: boolean;
  t: SiteTranslations;
  setLocale: (next: SiteLocale) => void;
  toggleLocale: () => void;
  translateText: (text: string | undefined) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLocale(): SiteLocale {
  if (typeof window === 'undefined') return 'pt-BR';
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'es-CL' || saved === 'pt-BR') return saved;
  } catch {
    // Ignore storage restriction in embedded iframes
  }
  return 'pt-BR';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<SiteLocale>(getInitialLocale);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore storage restriction
    }
  }, [locale]);

  const setLocale = useCallback((next: SiteLocale) => {
    setLocaleState(next);
  }, []);

  const toggleLocale = useCallback(() => {
    setLocaleState((prev) => (prev === 'pt-BR' ? 'es-CL' : 'pt-BR'));
  }, []);

  const translateText = useCallback(
    (text: string | undefined) => translateSeedText(text, locale),
    [locale],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      isEsCL: locale === 'es-CL',
      t: SITE_TRANSLATIONS[locale],
      setLocale,
      toggleLocale,
      translateText,
    }),
    [locale, setLocale, toggleLocale, translateText],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    return {
      locale: 'pt-BR',
      isEsCL: false,
      t: SITE_TRANSLATIONS['pt-BR'],
      setLocale: () => undefined,
      toggleLocale: () => undefined,
      translateText: (text) => text || '',
    };
  }
  return ctx;
}
