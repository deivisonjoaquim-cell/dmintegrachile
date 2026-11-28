import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { BrandRibbon } from './components/BrandLogo';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GlobalErrorToast } from './components/GlobalErrorToast';
import { PublicLayout } from './components/PublicLayout';
import { SkeletonBlock } from './components/ui/DesignSystem';
import { AppProvider } from './contexts/AppContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { HomePage } from './pages/HomePage';
import { installGlobalErrorHandlers } from './services/errorService';
import { lazyWithRetry } from './utils/dynamicImportRecovery';
import { routeLoaders } from './utils/routePrefetch';

const QuemSomosPage = lazyWithRetry(() => routeLoaders['/quem-somos']().then((m) => ({ default: m.QuemSomosPage })));
const ParceirosPage = lazyWithRetry(() => routeLoaders['/parceiros']().then((m) => ({ default: m.ParceirosPage })));
const DiagnosticoPage = lazyWithRetry(() => routeLoaders['/diagnostico']().then((m) => ({ default: m.DiagnosticoPage })));
const AuthGatePage = lazyWithRetry(() => routeLoaders['/acompanhar']().then((m) => ({ default: m.AuthGatePage })));
const PortalClientePage = lazyWithRetry(() => routeLoaders['/portal']().then((m) => ({ default: m.PortalClientePage })));
const PainelPage = lazyWithRetry(() => routeLoaders['/painel']().then((m) => ({ default: m.PainelPage })));
const LogosPage = lazyWithRetry(() => routeLoaders['/logos']().then((m) => ({ default: m.LogosPage })));

function normalizePath(raw: string): string {
  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  const clean = withoutHash.split('?')[0].replace(/\/+$/, '') || '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function getInitialPath(): string {
  if (window.location.hash && window.location.hash.startsWith('#/')) {
    return normalizePath(window.location.hash);
  }
  return normalizePath(window.location.pathname);
}

const PageLoader: React.FC = () => (
  <div className="max-w-5xl mx-auto p-6 sm:p-10">
    <SkeletonBlock rows={4} />
  </div>
);

const NotFoundView: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => (
  <div className="py-16 sm:py-24 px-4">
    <div className="max-w-lg mx-auto bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl overflow-hidden text-center shadow-[0_12px_36px_rgba(11,31,51,0.06)]">
      <BrandRibbon className="h-[3px] w-full" />
      <div className="p-8 sm:p-10 space-y-4">
        <p className="brand-kicker">Erro 404 · Página não encontrada</p>
        <h1 className="font-display text-3xl font-bold text-[#0B1F33] dark:text-white">Este endereço não está disponível.</h1>
        <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
          O caminho acessado foi movido ou não existe mais. Retorne à página inicial ou inicie o diagnóstico migratório completo.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white hover:opacity-95 transition-opacity"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Voltar ao Início
          </button>
          <button
            type="button"
            onClick={() => onNavigate('/diagnostico')}
            className="px-5 py-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#11263D] hover:bg-[#F1EDE4] dark:hover:bg-[#183350] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 transition-colors"
          >
            Fazer Diagnóstico Completo
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ROUTE_TITLES: Record<string, string> = {
  '/': 'D&M Integra Chile – Relocation & Assessoria',
  '/quem-somos': 'Quem Somos | D&M Integra Chile – Relocation & Assessoria',
  '/parceiros': 'Rede de Parceiros | D&M Integra Chile – Relocation & Assessoria',
  '/diagnostico': 'Diagnóstico Migratório Gratuito | D&M Integra Chile',
  '/acompanhar': 'Acompanhar Meu Processo | D&M Integra Chile',
  '/entrar-equipe': 'Área da Equipe | D&M Integra Chile',
  '/portal': 'Portal do Cliente | D&M Integra Chile',
  '/painel': 'Painel da Consultoria | D&M Integra Chile',
  '/logos': 'Kit de Identidade & Logos | D&M Integra Chile',
  '/kit-logos': 'Kit de Identidade & Logos | D&M Integra Chile',
};

function RouterView() {
  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);

  useEffect(() => {
    const sync = () => {
      // Ignore in-page section anchors (#seja-parceiro, #diretorio-parceiros) so they never trigger 404
      if (window.location.hash && !window.location.hash.startsWith('#/')) {
        return;
      }
      setCurrentPath(getInitialPath());
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = ROUTE_TITLES[currentPath] || 'D&M Integra Chile – Relocation & Assessoria';
  }, [currentPath]);

  const navigate = useCallback(
    (target: string) => {
      const [pathPart, queryPart] = target.split('?');
      const next = normalizePath(pathPart);
      const nextFull = queryPart ? `${next}?${queryPart}` : next;
      if (next !== currentPath || queryPart) {
        window.history.pushState({}, '', nextFull);
        setCurrentPath(next);
      }
      if (!queryPart || !queryPart.includes('secao=')) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [currentPath],
  );

  if (currentPath === '/portal') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PortalClientePage onNavigate={navigate} />
      </Suspense>
    );
  }
  if (currentPath === '/painel') {
    return (
      <Suspense fallback={<PageLoader />}>
        <PainelPage onNavigate={navigate} />
      </Suspense>
    );
  }

  let pageNode: React.ReactNode;
  switch (currentPath) {
    case '/quem-somos':
      pageNode = <QuemSomosPage onNavigate={navigate} />;
      break;
    case '/parceiros':
      pageNode = <ParceirosPage />;
      break;
    case '/diagnostico':
      pageNode = <DiagnosticoPage onNavigate={navigate} />;
      break;
    case '/acompanhar':
      pageNode = <AuthGatePage mode="cliente" onNavigate={navigate} />;
      break;
    case '/entrar-equipe':
      pageNode = <AuthGatePage mode="equipe" onNavigate={navigate} />;
      break;
    case '/logos':
    case '/kit-logos':
      pageNode = <LogosPage onNavigate={navigate} />;
      break;
    case '/':
      pageNode = <HomePage onNavigate={navigate} />;
      break;
    default:
      pageNode = <NotFoundView onNavigate={navigate} />;
      break;
  }

  return (
    <PublicLayout currentPath={currentPath} onNavigate={navigate}>
      <Suspense fallback={<PageLoader />}>{pageNode}</Suspense>
    </PublicLayout>
  );
}

export default function App() {
  useEffect(() => {
    installGlobalErrorHandlers();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LanguageProvider>
          <AppProvider>
            <RouterView />
            <GlobalErrorToast />
          </AppProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

