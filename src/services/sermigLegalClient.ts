import { auth } from '../firebase';

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

export async function checkSermigOfficialLinksLive(
  sources: Array<{ id: string; titulo: string; url: string }>,
): Promise<SermigBatchCheckResponse> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sessão expirada. Faça login novamente para verificar os portais SERMIG/BCN.');
  }
  const idToken = await user.getIdToken();
  const resp = await fetch('/api/legal/sermig-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ sources }),
  });

  const payload = (await resp.json().catch(() => ({}))) as Partial<SermigBatchCheckResponse> & {
    error?: string;
  };

  if (!resp.ok || !payload.ok || !Array.isArray(payload.results)) {
    throw new Error(
      payload.error || `Falha ao verificar portais SERMIG/BCN (HTTP ${resp.status}).`,
    );
  }

  return payload as SermigBatchCheckResponse;
}
