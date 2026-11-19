export type SermigLinkHealthStatus = 'online' | 'redirect' | 'degraded' | 'unreachable' | 'invalid_url';

export interface SermigSourceCheckInput {
  id: string;
  titulo: string;
  url: string;
}

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

const ALLOWED_OFFICIAL_HOST_SUFFIXES = [
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

export function isAllowedOfficialLegalUrl(rawUrl: string): { valid: boolean; parsed?: URL; reason?: string } {
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
  const isOfficial = ALLOWED_OFFICIAL_HOST_SUFFIXES.some(
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

export function extractHtmlTitle(html: string): string | undefined {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!match?.[1]) return undefined;
  const cleaned = match[1]
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, 140) : undefined;
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<{
  ok: boolean;
  status: number;
  url?: string;
  redirected?: boolean;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
}>;

export async function checkOfficialLegalSourceUrl(
  input: SermigSourceCheckInput,
  options?: { timeoutMs?: number; fetchFn?: FetchLike },
): Promise<SermigSourceCheckResult> {
  const checkedAt = new Date().toISOString();
  const timeoutMs = options?.timeoutMs ?? 7000;
  const fetchFn: FetchLike =
    options?.fetchFn ||
    ((url, init) => fetch(url, init) as unknown as ReturnType<FetchLike>);

  const check = isAllowedOfficialLegalUrl(input.url);
  if (!check.valid || !check.parsed) {
    return {
      id: input.id,
      titulo: input.titulo,
      url: input.url || '',
      resolvedUrl: input.url || '',
      status: 'invalid_url',
      httpStatus: null,
      latencyMs: 0,
      checkedAt,
      detail: check.reason || 'URL inválida.',
    };
  }

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const commonHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-CL,pt-BR;q=0.9,en;q=0.8',
    };

    // First try lightweight GET (many gov portals reject HEAD with 405/403)
    let resp = await fetchFn(check.parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: commonHeaders,
    });

    // If GET was blocked by WAF/bot-filter, try a fast HEAD request as fallback
    if ((resp.status === 403 || resp.status === 405 || resp.status === 406 || resp.status === 503) && !options?.fetchFn) {
      try {
        const headResp = await fetchFn(check.parsed.toString(), {
          method: 'HEAD',
          redirect: 'follow',
          signal: controller.signal,
          headers: commonHeaders,
        });
        if (headResp.status >= 200 && headResp.status < 400) {
          resp = headResp;
        }
      } catch {
        // Keep original GET response
      }
    }

    const latencyMs = Math.max(1, Date.now() - start);
    const resolvedUrl = resp.url || check.parsed.toString();
    const lastModified = resp.headers.get('last-modified') || undefined;
    const contentType = (resp.headers.get('content-type') || '').toLowerCase();

    let pageTitle: string | undefined;
    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      try {
        const body = await resp.text();
        pageTitle = extractHtmlTitle(body.slice(0, 32000));
      } catch {
        // Ignore body read error
      }
    }

    if (resp.status >= 200 && resp.status < 300) {
      const redirectedHost =
        Boolean(resp.redirected) && resolvedUrl.replace(/\/$/, '') !== check.parsed.toString().replace(/\/$/, '');
      return {
        id: input.id,
        titulo: input.titulo,
        url: check.parsed.toString(),
        resolvedUrl,
        status: redirectedHost ? 'redirect' : 'online',
        httpStatus: resp.status,
        latencyMs,
        pageTitle,
        lastModified,
        checkedAt,
        detail: redirectedHost
          ? `Portal oficial acessível com redirecionamento (HTTP ${resp.status}).`
          : `Portal oficial acessível e respondendo normalmente (HTTP ${resp.status}).`,
      };
    }

    // Some government WAFs return 403/429/405/503 to automated clients even when the site is online
    if (resp.status === 403 || resp.status === 429 || resp.status === 405 || resp.status === 503) {
      return {
        id: input.id,
        titulo: input.titulo,
        url: check.parsed.toString(),
        resolvedUrl,
        status: 'degraded',
        httpStatus: resp.status,
        latencyMs,
        pageTitle,
        lastModified,
        checkedAt,
        detail: `Portal oficial protegido por firewall governamental (HTTP ${resp.status}) — abra diretamente no navegador para conferir.`,
      };
    }

    return {
      id: input.id,
      titulo: input.titulo,
      url: check.parsed.toString(),
      resolvedUrl,
      status: 'unreachable',
      httpStatus: resp.status,
      latencyMs,
      pageTitle,
      lastModified,
      checkedAt,
      detail: `Portal retornou HTTP ${resp.status}. Verifique se o link oficial mudou.`,
    };
  } catch (err) {
    const latencyMs = Math.max(1, Date.now() - start);
    const isAbort = err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));
    return {
      id: input.id,
      titulo: input.titulo,
      url: check.parsed.toString(),
      resolvedUrl: check.parsed.toString(),
      status: isAbort ? 'degraded' : 'unreachable',
      httpStatus: null,
      latencyMs,
      checkedAt,
      detail: isAbort
        ? `Tempo limite excedido (${timeoutMs} ms) ao consultar o portal oficial.`
        : 'Não foi possível conectar ao portal oficial neste momento.',
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runBatchOfficialLegalCheck(
  sources: SermigSourceCheckInput[],
  options?: { timeoutMs?: number; concurrency?: number; fetchFn?: FetchLike },
): Promise<SermigBatchCheckResponse> {
  const checkedAt = new Date().toISOString();
  const safeList = sources.slice(0, 40);
  const concurrency = Math.max(1, Math.min(6, options?.concurrency ?? 4));
  const results: SermigSourceCheckResult[] = new Array(safeList.length);

  let cursor = 0;
  const worker = async () => {
    while (cursor < safeList.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await checkOfficialLegalSourceUrl(safeList[index], {
        timeoutMs: options?.timeoutMs,
        fetchFn: options?.fetchFn,
      });
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, safeList.length) }, () => worker()));

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
    verificationMode: 'server_live',
    summary,
    results,
  };
}
