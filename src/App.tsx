import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicLayout } from './components/PublicLayout';
import { SkeletonBlock } from './components/ui/DesignSystem';
import { AppProvider } from './contexts/AppContext';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const QuemSomosPage = lazy(() => import('./pages/QuemSomosPage').then((m) => ({ default: m.QuemSomosPage })));
const ParceirosPage = lazy(() => import('./pages/ParceirosPage').then((m) => ({ default: m.ParceirosPage })));
const DiagnosticoPage = lazy(() => import('./pages/DiagnosticoPage').then((m) => ({ default: m.DiagnosticoPage })));
const AuthGatePage = lazy(() => import('./pages/AuthGatePage').then((m) => ({ default: m.AuthGatePage })));
const PortalClientePage = lazy(() => import('./pages/PortalClientePage').then((m) => ({ default: m.PortalClientePage })));
const PainelPage = lazy(() => import('./pages/PainelPage').then((m) => ({ default: m.PainelPage })));

function normalizePath(raw: string): string {
  const withoutHash = raw.startsWith('#') ? raw.slice(1) : raw;
  const clean = withoutHash.split('?')[0].replace(/\/+$/, '') || '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function getInitialPath(): string {
  if (window.location.hash && window.location.hash.length > 1) {
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
  <div className="py-20 px-4 text-center max-w-lg mx-auto space-y-4">
    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Página não encontrada</p>
    <h1 className="text-3xl font-bold text-slate-900">Ops, este endereço não existe.</h1>
    <p className="text-sm text-slate-600">
      O caminho acessado não está disponível ou foi movido. Retorne à página inicial ou faça seu diagnóstico gratuito.
    </p>
    <div className="flex flex-wrap justify-center gap-3 pt-2">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        Voltar ao Início
      </button>
      <button
        type="button"
        onClick={() => onNavigate('/diagnostico')}
        className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
      >
        Fazer Diagnóstico Gratuito
      </button>
    </div>
  </div>
);

function RouterView() {
  const [currentPath, setCurrentPath] = useState<string>(getInitialPath);

  useEffect(() => {
    const sync = () => setCurrentPath(getInitialPath());
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
    };
  }, []);

  const navigate = useCallback(
    (target: string) => {
      const [pathPart, queryPart] = target.split('?');
      const next = normalizePath(pathPart);
      const nextFull = queryPart ? `${next}?${queryPart}` : next;
      if (next !== currentPath || queryPart) {
        window.history.pushState({}, '', nextFull);
        setCurrentPath(next);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
  return (
    <ErrorBoundary>
      <AppProvider>
        <RouterView />
      </AppProvider>
    </ErrorBoundary>
  );
}
