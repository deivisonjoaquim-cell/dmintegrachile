import { auth } from '../firebase';
import { isDevE2eActive } from '../utils/devE2eBridge';

export type SermigLinkHealthStatus = 'online' | 'redirect' | 'degraded' | 'unreachable' | 'invalid_url';

export interface SermigSourceCheckResult {
  id: string;
  titulo: string;
  url: string;
  resolvedUrl: string;
  status: SermigLinkHealthStatus;
  httpStatus: number | null;
  latencyMs: number;
  pageTitle?: string;
  lastModified?: string;
  checkedAt: string;
  detail: string;
}

export interface SermigBatchCheckResponse {
  ok: true;
  checkedAt: string;
  verificationMode?: 'server_live' | 'browser_fallback';
  summary: {
    total: number;
    online: number;
    redirect: number;
    degraded: number;
    unreachable: number;
    invalidUrl: number;
  };
  results: SermigSourceCheckResult[];
}

const OFFICIAL_HOST_SUFFIXES = [
  'serviciomigraciones.cl',
  'sermig.cl',
  'extranjeria.gob.cl',
  'bcn.cl',
  'leychile.cl',
  'diariooficial.interior.gob.cl',
  'registrocivil.cl',
  'registrocivil.gob.cl',
  'chileatiende.gob.cl',
  'minrel.gob.cl',
  'sii.cl',
  'pdi.cl',
  'pdichile.cl',
  'planalto.gov.br',
  'cnj.jus.br',
  'gov.br',
  'itamaraty.gov.br',
  'justica.gov.br',
  'pf.gov.br',
  'mercosur.int',
  'mercosul.gov.br',
  'gob.cl',
];

function validateOfficialUrlBrowser(rawUrl: string): { valid: boolean; parsed?: URL; reason?: string } {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'Link oficial não informado.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'URL oficial com formato inválido.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Protocolo não permitido (apenas HTTP/HTTPS).' };
  }
  const host = parsed.hostname.toLowerCase();
  const isOfficial = OFFICIAL_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
  if (!isOfficial) {
    return {
      valid: false,
      reason: `Domínio "${host}" fora da lista de fontes oficiais SERMIG/BCN/Governo.`,
    };
  }
  return { valid: true, parsed };
}

async function runBrowserFallbackCheck(
  sources: Array<{ id: string; titulo: string; url: string }>,
): Promise<SermigBatchCheckResponse> {
  const checkedAt = new Date().toISOString();
  const results = await Promise.all(
    sources.slice(0, 40).map(async (src): Promise<SermigSourceCheckResult> => {
      const check = validateOfficialUrlBrowser(src.url);
      if (!check.valid || !check.parsed) {
        return {
          id: src.id,
          titulo: src.titulo,
          url: src.url || '',
          resolvedUrl: src.url || '',
          status: 'invalid_url',
          httpStatus: null,
          latencyMs: 0,
          checkedAt,
          detail: check.reason || 'URL oficial inválida.',
        };
      }

      const start = Date.now();
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 5500);
      try {
        // Browser no-cors probe verifies DNS + TLS + server reachability directly from the operator's network
        await fetch(check.parsed.toString(), {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal,
        });
        const latencyMs = Math.max(1, Date.now() - start);
        return {
          id: src.id,
          titulo: src.titulo,
          url: check.parsed.toString(),
          resolvedUrl: check.parsed.toString(),
          status: 'online',
          httpStatus: null,
          latencyMs,
          checkedAt,
          detail: `Domínio oficial validado (${check.parsed.hostname}) e acessível diretamente pelo navegador (${latencyMs} ms).`,
        };
      } catch (err) {
        const latencyMs = Math.max(1, Date.now() - start);
        const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));
        return {
          id: src.id,
          titulo: src.titulo,
          url: check.parsed.toString(),
          resolvedUrl: check.parsed.toString(),
          status: 'degraded',
          httpStatus: null,
          latencyMs,
          checkedAt,
          detail: isAbort
            ? `Domínio oficial validado (${check.parsed.hostname}), mas demorou para responder pelo navegador.`
            : `Domínio oficial validado (${check.parsed.hostname}) com restrição de rede/CORS no navegador — abra em nova aba para conferir.`,
        };
      } finally {
        window.clearTimeout(timer);
      }
    }),
  );

  const summary = {
    total: results.length,
    online: results.filter((r) => r.status === 'online').length,
    redirect: results.filter((r) => r.status === 'redirect').length,
    degraded: results.filter((r) => r.status === 'degraded').length,
    unreachable: results.filter((r) => r.status === 'unreachable').length,
    invalidUrl: results.filter((r) => r.status === 'invalid_url').length,
  };

  return {
    ok: true,
    checkedAt,
    verificationMode: 'browser_fallback',
    summary,
    results,
  };
}

export async function checkSermigOfficialLinksLive(
  sources: Array<{ id: string; titulo: string; url: string }>,
): Promise<SermigBatchCheckResponse> {
  if (import.meta.env.DEV && isDevE2eActive() && !auth.currentUser) {
    return runBrowserFallbackCheck(sources);
  }
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sessão expirada. Faça login novamente para verificar os portais SERMIG/BCN.');
  }

  try {
    const idToken = await user.getIdToken();
    const resp = await fetch('/api/legal/sermig-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ sources }),
    });

    // If the API route is unavailable (404/405/502/503), seamlessly fall back to browser verification
    if (resp.status === 404 || resp.status === 405 || resp.status === 502 || resp.status === 503) {
      return runBrowserFallbackCheck(sources);
    }

    const payload = (await resp.json().catch(() => ({}))) as Partial<SermigBatchCheckResponse> & {
      error?: string;
    };

    if (!resp.ok || !payload.ok || !Array.isArray(payload.results)) {
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(
          payload.error || 'Sem permissão ou sessão expirada para verificar os portais SERMIG/BCN.',
        );
      }
      return runBrowserFallbackCheck(sources);
    }

    return {
      ...(payload as SermigBatchCheckResponse),
      verificationMode: payload.verificationMode || 'server_live',
    };
  } catch (err) {
    if (err instanceof Error && (err.message.includes('Sessão expirada') || err.message.includes('Sem permissão'))) {
      throw err;
    }
    return runBrowserFallbackCheck(sources);
  }
}
