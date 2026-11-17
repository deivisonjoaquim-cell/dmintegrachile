import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PublicLayout } from './components/PublicLayout';
import { AppProvider } from './contexts/AppContext';
import { AuthGatePage } from './pages/AuthGatePage';
import { DiagnosticoPage } from './pages/DiagnosticoPage';
import { HomePage } from './pages/HomePage';
import { PainelPage } from './pages/PainelPage';
import { ParceirosPage } from './pages/ParceirosPage';
import { PortalClientePage } from './pages/PortalClientePage';
import { QuemSomosPage } from './pages/QuemSomosPage';

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
      const next = normalizePath(target);
      if (next !== currentPath) {
        window.history.pushState({}, '', next);
        setCurrentPath(next);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentPath],
  );

  if (currentPath === '/portal') {
    return <PortalClientePage onNavigate={navigate} />;
  }
  if (currentPath === '/painel') {
    return <PainelPage onNavigate={navigate} />;
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
    default:
      pageNode = <HomePage onNavigate={navigate} />;
      break;
  }

  return (
    <PublicLayout currentPath={currentPath} onNavigate={navigate}>
      {pageNode}
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
