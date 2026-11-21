export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

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

function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return undefined;
  return match[1].replace(/\s+/g, ' ').trim().slice(0, 140) || undefined;
}

export async function checkOfficialLegalSourceUrl(
  source: SermigSourceCheckInput,
  options?: { timeoutMs?: number; fetchFn?: FetchLike },
): Promise<SermigSourceCheckResult> {
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  const cleanUrl = (source.url || '').trim();

  if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
    return {
      id: source.id,
      titulo: source.titulo,
      url: cleanUrl,
      status: 'invalid_url',
      latencyMs: Date.now() - started,
      detail: 'URL oficial ausente ou sem protocolo https://.',
      checkedAt,
    };
  }

  const fetchImpl: FetchLike = options?.fetchFn || globalThis.fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 6000);

  try {
    const resp = await fetchImpl(cleanUrl, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'DM-Integra-Chile-LegalMonitor/1.0 (+https://serviciomigraciones.cl)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    const latencyMs = Date.now() - started;
    const resolvedUrl = resp.url || cleanUrl;
    const lastModified = resp.headers.get('last-modified') || undefined;
    const contentType = resp.headers.get('content-type') || '';

    let pageTitle: string | undefined;
    if (resp.ok && contentType.includes('text/html')) {
      try {
        const text = (await resp.text()).slice(0, 16000);
        pageTitle = extractHtmlTitle(text);
      } catch {
        // ignore body read error
      }
    }

    if (resp.status >= 200 && resp.status < 300) {
      const redirected = resolvedUrl !== cleanUrl && resp.redirected;
      return {
        id: source.id,
        titulo: source.titulo,
        url: cleanUrl,
        status: redirected ? 'redirect' : 'online',
        httpStatus: resp.status,
        resolvedUrl,
        pageTitle,
        lastModified,
        latencyMs,
        detail: redirected
          ? `Respondendo com redirecionamento para ${resolvedUrl}.`
          : `Portal oficial acessível (HTTP ${resp.status}).`,
        checkedAt,
      };
    }

    if (resp.status === 403 || resp.status === 429 || resp.status === 503) {
      return {
        id: source.id,
        titulo: source.titulo,
        url: cleanUrl,
        status: 'degraded',
        httpStatus: resp.status,
        resolvedUrl,
        lastModified,
        latencyMs,
        detail: `HTTP ${resp.status} (firewall/WAF governamental — abra o link manualmente no navegador).`,
        checkedAt,
      };
    }

    return {
      id: source.id,
      titulo: source.titulo,
      url: cleanUrl,
      status: 'unreachable',
      httpStatus: resp.status,
      resolvedUrl,
      latencyMs,
      detail: `Portal respondeu com HTTP ${resp.status}.`,
      checkedAt,
    };
  } catch (err) {
    const latencyMs = Date.now() - started;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      id: source.id,
      titulo: source.titulo,
      url: cleanUrl,
      status: isAbort ? 'degraded' : 'unreachable',
      latencyMs,
      detail: isAbort
        ? 'Tempo limite excedido ao consultar o portal oficial (possível firewall/latência).'
        : err instanceof Error
          ? err.message
          : 'Não foi possível conectar ao portal oficial.',
      checkedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runBatchOfficialLegalCheck(
  sources: SermigSourceCheckInput[],
  options?: { timeoutMs?: number; fetchFn?: FetchLike },
): Promise<SermigBatchCheckResponse> {
  const checkedAt = new Date().toISOString();
  const results = await Promise.all(
    sources.map((src) => checkOfficialLegalSourceUrl(src, options)),
  );
  const summary: SermigBatchCheckSummary = {
    total: results.length,
    online: results.filter((r) => r.status === 'online').length,
    redirect: results.filter((r) => r.status === 'redirect').length,
    degraded: results.filter((r) => r.status === 'degraded').length,
    unreachable: results.filter((r) => r.status === 'unreachable').length,
    invalidUrl: results.filter((r) => r.status === 'invalid_url').length,
  };
  return {
    checkedAt,
    verificationMode: 'server_http',
    summary,
    results,
  };
}
