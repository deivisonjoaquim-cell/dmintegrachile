/**
 * Centralized lazy route loaders + intent-based prefetching (hover/focus/touchstart)
 * so navigating between routes on mobile feels instantaneous without bloating initial JS.
 */

export const routeLoaders = {
  '/quem-somos': () => import('../pages/QuemSomosPage'),
  '/parceiros': () => import('../pages/ParceirosPage'),
  '/diagnostico': () => import('../pages/DiagnosticoPage'),
  '/acompanhar': () => import('../pages/AuthGatePage'),
  '/entrar-equipe': () => import('../pages/AuthGatePage'),
  '/portal': () => import('../pages/PortalClientePage'),
  '/painel': () => import('../pages/PainelPage'),
  '/logos': () => import('../pages/LogosPage'),
  '/kit-logos': () => import('../pages/LogosPage'),
} as const;

export type PrefetchableRoute = keyof typeof routeLoaders;

const prefetchedRoutes = new Set<string>();

/**
 * Warms the JS chunk for a target route on hover, focus, or touchstart.
 * Respects Save-Data / slow 2G connections to protect mobile bandwidth.
 */
export function prefetchRouteChunk(rawPath: string): void {
  if (typeof window === 'undefined') return;
  const cleanPath = rawPath.split('?')[0].replace(/\/+$/, '') || '/';
  if (prefetchedRoutes.has(cleanPath)) return;

  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  if (nav.connection?.saveData || nav.connection?.effectiveType === 'slow-2g') {
    return;
  }

  const loader = routeLoaders[cleanPath as PrefetchableRoute];
  if (!loader) return;

  prefetchedRoutes.add(cleanPath);
  void loader().catch(() => {
    prefetchedRoutes.delete(cleanPath);
  });
}
