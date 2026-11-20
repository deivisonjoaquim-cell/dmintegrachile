import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import { loadFirebaseServerConfig } from './firebaseServerConfig';

// Generate ephemeral RSA-2048 keypair in-process so Firebase Auth JWT verification runs for real
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const TEST_KID = 'test-kid-2026';
const PUBLIC_KEY_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const FIREBASE_CFG = loadFirebaseServerConfig();

function signFirebaseJwt(claims: {
  uid: string;
  email: string;
  email_verified?: boolean;
  name?: string;
}): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: TEST_KID, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      aud: FIREBASE_CFG.projectId,
      iss: `https://securetoken.google.com/${FIREBASE_CFG.projectId}`,
      sub: claims.uid,
      user_id: claims.uid,
      email: claims.email,
      email_verified: claims.email_verified ?? true,
      name: claims.name || 'Tester',
      iat: nowSec - 10,
      exp: nowSec + 3600,
    }),
  ).toString('base64url');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

async function parseAiResponse(resp: Response): Promise<{
  isNdjson: boolean;
  events: Array<{ type: string; message?: string; data?: Record<string, unknown>; statusCode?: number; error?: string }>;
  resultPayload: Record<string, unknown> | null;
}> {
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/x-ndjson')) {
    const raw = await resp.text();
    const lines = raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const events = lines.map(
      (l) =>
        JSON.parse(l) as {
          type: string;
          message?: string;
          data?: Record<string, unknown>;
          statusCode?: number;
          error?: string;
        },
    );
    const resultEvent = events.find((e) => e.type === 'result');
    return {
      isNdjson: true,
      events,
      resultPayload: resultEvent?.data || null,
    };
  }
  const json = (await resp.json()) as Record<string, unknown>;
  return {
    isNdjson: false,
    events: [],
    resultPayload: json,
  };
}

describe('Live Express API Integration (JWT RS256 + Role Guards + All 7 AI Routes + Upload + SERMIG)', () => {
  let baseUrl = '';
  let serverInstance: ReturnType<typeof import('node:http').Server.prototype.listen> | null = null;
  let originalFetch: typeof globalThis.fetch;
  let prevNodeEnv: string | undefined;
  let prevGeminiKey: string | undefined;

  const adminToken = signFirebaseJwt({
    uid: 'uid_admin_bootstrapped',
    email: 'deivisonjoaquim@gmail.com',
    name: 'Deivison Admin',
  });
  const consultorToken = signFirebaseJwt({
    uid: 'uid_consultor_int',
    email: 'consultor.teste@dmintegra.cl',
    name: 'Consultor Teste',
  });
  const clienteToken = signFirebaseJwt({
    uid: 'uid_cliente_int',
    email: 'cliente.teste@dmintegra.cl',
    name: 'Cliente Teste',
  });

  before(async () => {
    prevNodeEnv = process.env.NODE_ENV;
    prevGeminiKey = process.env.GEMINI_API_KEY;
    process.env.NODE_ENV = 'test';
    delete process.env.GEMINI_API_KEY;

    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

      // Pass through local requests hitting our ephemeral Express server
      if (baseUrl && url.startsWith(baseUrl)) {
        return originalFetch(input, init);
      }

      // Stub Google x509 certs endpoint for Firebase ID token verification
      if (url.startsWith('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com')) {
        return new Response(JSON.stringify({ [TEST_KID]: PUBLIC_KEY_PEM }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'cache-control': 'public, max-age=3600',
          },
        });
      }

      // Stub Firestore REST API user role lookups & audit writes
      if (url.startsWith('https://firestore.googleapis.com/')) {
        if (url.includes('/documents/users/uid_consultor_int')) {
          return new Response(
            JSON.stringify({
              fields: {
                role: { stringValue: 'consultor' },
                status: { stringValue: 'ativo' },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        if (url.includes('/documents/users/uid_cliente_int')) {
          return new Response(
            JSON.stringify({
              fields: {
                role: { stringValue: 'cliente' },
                status: { stringValue: 'ativo' },
              },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        // Audit log commit / creation -> 200 OK
        return new Response(JSON.stringify({ name: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      // Stub official SERMIG / BCN legal URL checks
      if (url.includes('bcn.cl') || url.includes('serviciomigraciones.cl')) {
        return new Response('<html><head><title>Portal Oficial SERMIG / BCN</title></head><body>Vigente</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html', 'last-modified': 'Wed, 15 Oct 2025 10:00:00 GMT' },
        });
      }

      return new Response('Mock Not Found', { status: 404 });
    }) as typeof globalThis.fetch;

    const { app } = await import('../server');
    await new Promise<void>((resolve) => {
      const srv = app.listen(0, '127.0.0.1', () => {
        serverInstance = srv as ReturnType<typeof import('node:http').Server.prototype.listen>;
        const addr = srv.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    globalThis.fetch = originalFetch;
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNodeEnv;
    if (prevGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGeminiKey;

    if (serverInstance) {
      await new Promise<void>((resolve) => {
        serverInstance!.close(() => resolve());
      });
    }
  });

  it('serves GET /api/health and enforces auth/role on GET /api/ai/health & POST /api/auth/check-admin', async () => {
    const healthResp = await originalFetch(`${baseUrl}/api/health`);
    assert.equal(healthResp.status, 200);
    const healthJson = (await healthResp.json()) as { ok: boolean; timestamp: string };
    assert.equal(healthJson.ok, true);
    assert.ok(typeof healthJson.timestamp === 'string');

    // Unauthenticated AI health -> 401
    const unauthedAi = await originalFetch(`${baseUrl}/api/ai/health`);
    assert.equal(unauthedAi.status, 401);

    // Cliente AI health -> 403
    const clientAi = await originalFetch(`${baseUrl}/api/ai/health`, {
      headers: { Authorization: `Bearer ${clienteToken}` },
    });
    assert.equal(clientAi.status, 403);

    // Admin AI health -> 200 with structured non-secret runtime info
    const adminAi = await originalFetch(`${baseUrl}/api/ai/health`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminAi.status, 200);
    const aiHealth = (await adminAi.json()) as {
      ok: boolean;
      geminiConfigured: boolean;
      mode: string;
      activeEngine: string;
    };
    assert.equal(aiHealth.ok, true);
    assert.equal(aiHealth.geminiConfigured, false);
    assert.equal(aiHealth.mode, 'rules_live_hybrid');
    assert.ok(aiHealth.activeEngine.toLowerCase().includes('motor local inteligente'));

    // Bootstrap check-admin
    const checkAdminResp = await originalFetch(`${baseUrl}/api/auth/check-admin`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(checkAdminResp.status, 200);
    const checkAdminJson = (await checkAdminResp.json()) as { isAdminEmail: boolean; email: string };
    assert.equal(checkAdminJson.isAdminEmail, true);
    assert.equal(checkAdminJson.email, 'deivisonjoaquim@gmail.com');
  });

  it('executes all 7 /api/ai/* endpoints (JSON + NDJSON streaming) and enforces role barriers cleanly', async () => {
    const routes = [
      {
        path: '/api/ai/diagnostico',
        allowCliente: true,
        body: {
          answers: {
            nome: 'Carlos',
            localizacaoAtual: 'Brasil',
            objetivoPrincipal: 'Morar e trabalhar (Acordo Mercosul)',
          },
          subcategoriaRecomendada: '15 - Acordo Mercosul',
          regrasAcionadas: ['Nacionalidade Mercosul'],
          legalSources: [{ titulo: 'Acordo Mercosul', linkOficial: 'https://serviciomigraciones.cl' }],
        },
      },
      {
        path: '/api/ai/parecer',
        allowCliente: false,
        body: {
          caseData: { titulo: 'Mercosul 2026', tipoServico: 'Residência Temporal', subcategoria: '15' },
          clientData: { nomeCompleto: 'Roberto Almeida', localizacaoAtual: 'Brasil', antecedentesCriminais: false },
          legalSources: [{ titulo: 'Ley 21.325' }],
        },
      },
      {
        path: '/api/ai/proposta',
        allowCliente: false,
        body: {
          proposal: { nome_empresa: 'Traduções Sul', categoria: 'Tradutor', pais: 'Brasil', proposta: 'Tabela reduzida em 15%' },
        },
      },
      {
        path: '/api/ai/norma',
        allowCliente: false,
        body: {
          currentSource: { titulo: 'Decreto 177', artigos: 'Art. 10' },
          newText: 'Artículo 15: Residencia Temporal Mercosur vigente 2 años.',
        },
      },
      {
        path: '/api/ai/norma-verificar',
        allowCliente: false,
        body: {
          currentSource: { titulo: 'Ley 21.325', linkOficial: 'https://www.bcn.cl/leychile/navegar?idNorma=1158549' },
        },
      },
      {
        path: '/api/ai/custos',
        allowCliente: false,
        body: { currentCustos: { taxaSermigMercosulUsd: 90, apostilaCnjBrl: 185 } },
      },
      {
        path: '/api/ai/analisar-documento',
        allowCliente: false,
        body: {
          nomeEsperado: 'Antecedentes Polícia Federal',
          fileBase64: Buffer.from('%PDF-1.5\n/Type /Page\nPolicia Federal Apostila\n%%EOF').toString('base64'),
          mimeType: 'application/pdf',
          textoObservacao: 'Apostilado marcado: true',
        },
      },
    ];

    for (const r of routes) {
      // Unauthed must return 401
      const unauthed = await originalFetch(`${baseUrl}${r.path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(r.body),
      });
      assert.equal(unauthed.status, 401, `${r.path} must reject unauthed with 401`);

      // Cliente: allowed only on public-authenticated /api/ai/diagnostico, blocked (403) on all internal staff AI routes
      const clienteResp = await originalFetch(`${baseUrl}${r.path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${clienteToken}`,
        },
        body: JSON.stringify(r.body),
      });
      assert.equal(
        clienteResp.status,
        r.allowCliente ? 200 : 403,
        `${r.path} expected ${r.allowCliente ? 200 : 403} for cliente`,
      );

      // Admin plain JSON -> 200 with structured rules payload
      const adminJsonResp = await originalFetch(`${baseUrl}${r.path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify(r.body),
      });
      assert.equal(adminJsonResp.status, 200, `${r.path} JSON mode should return 200`);
      const jsonPayload = (await adminJsonResp.json()) as Record<string, unknown>;
      assert.equal(jsonPayload.origem, 'regras');
      assert.equal(jsonPayload.fallback, true);

      // Consultor request with `x-ai-progress: 1` (fast JSON fallback when key absent or NDJSON stream when streaming)
      const streamReqResp = await originalFetch(`${baseUrl}${r.path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${consultorToken}`,
          'x-ai-progress': '1',
        },
        body: JSON.stringify(r.body),
      });
      assert.equal(streamReqResp.status, 200, `${r.path} stream mode should return 200`);
      const { isNdjson, events, resultPayload } = await parseAiResponse(streamReqResp);
      if (isNdjson) {
        assert.ok(events.some((e) => e.type === 'progress'));
      }
      assert.ok(resultPayload && resultPayload.origem === 'regras');
    }
  });

  it('sanitizes uploaded SVG files (strips scripts), allows download and admin DELETE cleanup, and checks SERMIG links', async () => {
    // 1) Upload SVG with XSS payload -> sanitized before saving
    const form = new FormData();
    const evilSvg = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><rect width="10" height="10" /></svg>';
    form.append('file', new Blob([evilSvg], { type: 'image/svg+xml' }), 'logo-teste.svg');

    const upResp = await originalFetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    assert.equal(upResp.status, 200);
    const upJson = (await upResp.json()) as { url: string; filename: string };
    assert.ok(upJson.url.startsWith('/uploads/'));
    const savedDiskFilename = upJson.url.replace('/uploads/', '');

    const dlResp = await originalFetch(`${baseUrl}${upJson.url}`);
    assert.equal(dlResp.status, 200);
    const dlText = await dlResp.text();
    assert.equal(dlText.includes('<script'), false);
    assert.ok(dlText.includes('<rect'));

    // Consultor cannot delete media library assets (admin only)
    const consultorMediaDel = await originalFetch(`${baseUrl}/api/media/${encodeURIComponent(savedDiskFilename)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${consultorToken}` },
    });
    assert.equal(consultorMediaDel.status, 403);

    // Cliente cannot delete uploads (staff only)
    const clienteUploadDel = await originalFetch(`${baseUrl}/api/uploads/${encodeURIComponent(savedDiskFilename)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${clienteToken}` },
    });
    assert.equal(clienteUploadDel.status, 403);

    // Admin cleanup works and deletes saved file on disk
    const adminDel = await originalFetch(`${baseUrl}/api/uploads/${encodeURIComponent(savedDiskFilename)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(adminDel.status, 200);
    const delJson = (await adminDel.json()) as { ok: boolean; deleted: boolean };
    assert.equal(delJson.ok, true);
    assert.equal(delJson.deleted, true);

    // 2) Live SERMIG check batch endpoint
    const sermigResp = await originalFetch(`${baseUrl}/api/legal/sermig-check`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        sources: [
          {
            id: 'src_test_bcn',
            titulo: 'Ley 21.325',
            url: 'https://www.bcn.cl/leychile/navegar?idNorma=1158549',
          },
        ],
      }),
    });
    assert.equal(sermigResp.status, 200);
    const sermigJson = (await sermigResp.json()) as { summary: { total: number; online: number } };
    assert.equal(sermigJson.summary.total, 1);
    assert.equal(sermigJson.summary.online, 1);
  });
});
