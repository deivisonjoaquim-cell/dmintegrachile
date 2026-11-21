import { auth } from '../firebase';

export interface SermigSourceCheckInput {
  id: string;
  titulo: string;
  url: string;
}

export type SermigSourceCheckStatus =
  | 'online'
  | 'redirect'
  | 'degraded'
  | 'unreachable'
  | 'invalid_url';

export interface SermigSourceCheckResult {
  id: string;
  titulo: string;
  url: string;
  status: SermigSourceCheckStatus;
  httpStatus?: number;
  resolvedUrl?: string;
  pageTitle?: string;
  lastModified?: string;
  latencyMs: number;
  detail: string;
  checkedAt: string;
}

export interface SermigBatchCheckSummary {
  total: number;
  online: number;
  redirect: number;
  degraded: number;
  unreachable: number;
  invalidUrl: number;
}

export interface SermigBatchCheckResponse {
  checkedAt: string;
  verificationMode: 'server_http' | 'browser_fallback';
  summary: SermigBatchCheckSummary;
  results: SermigSourceCheckResult[];
}

async function runBrowserFallbackCheck(
  sources: SermigSourceCheckInput[],
): Promise<SermigBatchCheckResponse> {
  const checkedAt = new Date().toISOString();
  const results: SermigSourceCheckResult[] = await Promise.all(
    sources.map(async (src) => {
      const started = Date.now();
      const cleanUrl = (src.url || '').trim();
      if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
        return {
          id: src.id,
          titulo: src.titulo,
          url: cleanUrl,
          status: 'invalid_url' as const,
          latencyMs: Date.now() - started,
          detail: 'URL oficial ausente ou inválida.',
          checkedAt,
        };
      }
      try {
        await fetch(cleanUrl, { mode: 'no-cors' });
        return {
          id: src.id,
          titulo: src.titulo,
          url: cleanUrl,
          status: 'online' as const,
          latencyMs: Date.now() - started,
          detail: 'Domínio acessível pelo navegador (verificação em modo estático).',
          checkedAt,
        };
      } catch {
        return {
          id: src.id,
          titulo: src.titulo,
          url: cleanUrl,
          status: 'degraded' as const,
          latencyMs: Date.now() - started,
          detail: 'Verificação direta bloqueada por CORS/rede; clique para abrir o portal oficial.',
          checkedAt,
        };
      }
    }),
  );

  return {
    checkedAt,
    verificationMode: 'browser_fallback',
    summary: {
      total: results.length,
      online: results.filter((r) => r.status === 'online').length,
      redirect: results.filter((r) => r.status === 'redirect').length,
      degraded: results.filter((r) => r.status === 'degraded').length,
      unreachable: results.filter((r) => r.status === 'unreachable').length,
      invalidUrl: results.filter((r) => r.status === 'invalid_url').length,
    },
    results,
  };
}

export async function checkSermigOfficialLinksLive(
  sources: SermigSourceCheckInput[],
): Promise<SermigBatchCheckResponse> {
  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const resp = await fetch('/api/legal/sermig-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ sources }),
    });
    const contentType = resp.headers.get('content-type') || '';
    if (resp.ok && contentType.includes('application/json')) {
      return (await resp.json()) as SermigBatchCheckResponse;
    }
  } catch {
    // Fallback cleanly for static Vercel Free deployments
  }
  return runBrowserFallbackCheck(sources);
}
