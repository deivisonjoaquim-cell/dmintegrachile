import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import multer from 'multer';

import {
  buildAnalisarDocumentoSpec,
  buildCustosSpec,
  buildDiagnosticoSpec,
  buildNormaSpec,
  buildNormaVerificarSpec,
  buildParecerSpec,
  buildPropostaSpec,
  runAiRouteExecution,
  type AiRouteDependencies,
} from './server/geminiRoutes.ts';
import {
  dispatchProcessPushNotification,
  type ProcessNotificationType,
} from './server/fcmService.ts';
import {
  dispatchExpirationReminderEmails,
  getSmtpConfigFromEnv,
  type EmailReminderItemPayload,
} from './server/emailReminderService.ts';
import {
  runBatchOfficialLegalCheck,
  type SermigSourceCheckInput,
} from './server/sermigLegalService.ts';
import { loadFirebaseServerConfig } from './server/firebaseServerConfig.ts';
import type { CommunicationLog } from './src/types/domain.ts';

const firebaseConfig = loadFirebaseServerConfig();

const IS_VERCEL = Boolean(process.env.VERCEL);
const PORT = Number(process.env.PORT || 3000);
const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || '(default)';
const UPLOAD_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), 'dm-integra-uploads')
  : path.resolve(process.cwd(), 'uploads');
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {
  // Ignore mkdir failures on restricted read-only environments
}

// =============================================================================
// Admin emails bootstrap list (from Secrets ADMIN_EMAILS + runtime owner fallback)
// =============================================================================
function getAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  const list = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Ensure runtime bootstrapped owner email is recognized
  list.push('deivisonjoaquim@gmail.com');
  return new Set(list);
}

// =============================================================================
// Firebase ID Token Verifier (via official Google x509 public certs)
// =============================================================================
interface DecodedToken {
  uid: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
}

let cachedCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getFirebasePublicCerts(): Promise<Record<string, string>> {
  if (cachedCerts && Date.now() < cachedCerts.expiresAt) {
    return cachedCerts.certs;
  }
  const resp = await fetch(
    'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
  );
  if (!resp.ok) {
    throw new Error('Não foi possível obter os certificados públicos do Firebase Auth.');
  }
  const cacheControl = resp.headers.get('cache-control') || '';
  const maxAgeMatch = /max-age=(\d+)/.exec(cacheControl);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;
  const certs = (await resp.json()) as Record<string, string>;
  cachedCerts = { certs, expiresAt: Date.now() + maxAgeMs };
  return certs;
}

async function verifyFirebaseIdToken(idToken: string): Promise<DecodedToken> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Token de autenticação inválido.');
  }
  const [headerB64, payloadB64, sigB64] = parts;
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
    alg?: string;
    kid?: string;
  };
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Cabeçalho do token inválido.');
  }
  const certs = await getFirebasePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new Error('Chave de assinatura do token não encontrada.');
  }
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const signature = Buffer.from(sigB64, 'base64url');
  if (!verifier.verify(cert, signature)) {
    throw new Error('Assinatura do token inválida.');
  }
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
    aud?: string;
    iss?: string;
    sub?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) {
    throw new Error('Audiência do token incompatível.');
  }
  if (payload.iss !== `https://securetoken.google.com/${PROJECT_ID}`) {
    throw new Error('Emissor do token inválido.');
  }
  if (!payload.sub || !payload.exp || payload.exp < nowSec) {
    throw new Error('Token expirado ou sem identificador de usuário.');
  }
  return {
    uid: payload.sub,
    email: (payload.email || '').toLowerCase(),
    email_verified: Boolean(payload.email_verified),
    name: payload.name,
    picture: payload.picture,
  };
}

async function fetchUserRoleFromFirestore(uid: string, idToken: string): Promise<{ role: string; status: string } | null> {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents/users/${encodeURIComponent(uid)}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return null;
    const doc = (await resp.json()) as {
      fields?: {
        role?: { stringValue?: string };
        status?: { stringValue?: string };
      };
    };
    return {
      role: doc.fields?.role?.stringValue || 'cliente',
      status: doc.fields?.status?.stringValue || 'pendente',
    };
  } catch {
    return null;
  }
}

interface AuthedRequest extends Request {
  authUser?: DecodedToken & { role: string; status: string; rawToken: string };
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Autenticação obrigatória. Faça login com Google para utilizar este recurso.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = await verifyFirebaseIdToken(token);
    if (!decoded.email_verified) {
      res.status(403).json({ error: 'E-mail não verificado pela conta Google.' });
      return;
    }
    const adminEmails = getAdminEmails();
    const userDoc = await fetchUserRoleFromFirestore(decoded.uid, token);
    const role = adminEmails.has(decoded.email) ? 'admin' : userDoc?.role || 'cliente';
    const status = adminEmails.has(decoded.email) ? 'ativo' : userDoc?.status || 'pendente';
    req.authUser = { ...decoded, role, status, rawToken: token };
    next();
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Sessão inválida ou expirada.' });
  }
}

function requireRole(allowed: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const role = req.authUser?.role || '';
    const status = req.authUser?.status || '';
    if (status === 'inativo') {
      res.status(403).json({ error: 'Usuário inativo. Contate o administrador.' });
      return;
    }
    if (!allowed.includes(role)) {
      res.status(403).json({ error: 'Seu papel de acesso não possui permissão para esta operação.' });
      return;
    }
    next();
  };
}

// =============================================================================
// Rate limiter (per UID) for /api/ai/*
// =============================================================================
const rateWindows = new Map<string, number[]>();
function aiRateLimit(req: AuthedRequest, res: Response, next: NextFunction): void {
  const key = req.authUser?.uid || req.ip || 'anon';
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxReqs = 25;
  const hits = (rateWindows.get(key) || []).filter((ts) => now - ts < windowMs);
  if (hits.length >= maxReqs) {
    res.status(429).json({ error: 'Limite temporário de requisições de IA atingido. Aguarde alguns minutos.' });
    return;
  }
  hits.push(now);
  rateWindows.set(key, hits);
  next();
}

// =============================================================================
// Gemini Route Dependencies (config resolved via env in server/geminiWrapper.ts)
// =============================================================================
const aiRouteDeps: AiRouteDependencies = {
  uploadDir: UPLOAD_DIR,
  projectId: PROJECT_ID,
  databaseId: DATABASE_ID,
};

// =============================================================================
// Multer upload validation (PDF/JPG/PNG/WEBP/SVG/ICO <= 10 MB)
// =============================================================================
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 48);
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/svg+xml',
      'image/x-icon',
      'image/vnd.microsoft.icon',
    ];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('Formato inválido. Envie PDF, PNG, JPG, WEBP, SVG ou ICO até 10 MB.'));
      return;
    }
    cb(null, true);
  },
});

function sanitizeSvgContent(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

// =============================================================================
// Express App
// =============================================================================
const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get(
  '/api/notifications/health',
  requireAuth,
  requireRole(['admin', 'consultor', 'assistente']),
  (_req: AuthedRequest, res: Response) => {
    res.json({
      ok: true,
      vapidEnvConfigured: Boolean((process.env.VITE_FIREBASE_VAPID_KEY || '').trim()),
      projectId: PROJECT_ID,
    });
  },
);

app.post(
  '/api/notifications/process-update',
  requireAuth,
  requireRole(['admin', 'consultor', 'assistente']),
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as {
      clientId?: string;
      caseId?: string;
      notificationId?: string;
      tipo?: ProcessNotificationType;
      titulo?: string;
      mensagem?: string;
      etapaPipeline?: number;
      statusSermig?: string;
      targetUrl?: string;
    };

    if (!body.clientId || !body.titulo || !body.mensagem) {
      res.status(400).json({ error: 'Campos clientId, titulo e mensagem são obrigatórios.' });
      return;
    }

    const result = await dispatchProcessPushNotification({
      clientId: body.clientId,
      caseId: body.caseId,
      notificationId: body.notificationId,
      tipo: body.tipo || 'geral',
      titulo: body.titulo,
      mensagem: body.mensagem,
      etapaPipeline: body.etapaPipeline,
      statusSermig: body.statusSermig,
      targetUrl: body.targetUrl || '/portal',
    });

    res.json(result);
  },
);

app.get(
  '/api/emails/health',
  requireAuth,
  requireRole(['admin', 'consultor', 'assistente']),
  (_req: AuthedRequest, res: Response) => {
    const smtp = getSmtpConfigFromEnv();
    res.json({
      ok: true,
      smtpConfigured: smtp.configured,
      from: smtp.from,
      cooldownDays: smtp.cooldownDays,
    });
  },
);

app.post(
  '/api/emails/expiration-reminders',
  requireAuth,
  requireRole(['admin', 'consultor', 'assistente']),
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as {
      items?: EmailReminderItemPayload[];
      communicationLogs?: CommunicationLog[];
      brandName?: string;
      portalUrl?: string;
      copyConsultant?: boolean;
      forceSend?: boolean;
      previewOnly?: boolean;
    };

    if (!Array.isArray(body.items)) {
      res.status(400).json({ error: 'Informe a lista de documentos para verificação de vencimento.' });
      return;
    }

    const appUrl = (process.env.APP_URL || '').trim().replace(/\/$/, '');
    const portalUrl = body.portalUrl || (appUrl ? `${appUrl}/portal` : '');

    const result = await dispatchExpirationReminderEmails({
      items: body.items.slice(0, 100),
      communicationLogs: Array.isArray(body.communicationLogs) ? body.communicationLogs.slice(0, 500) : [],
      brandName: body.brandName,
      portalUrl,
      copyConsultantEmail: body.copyConsultant ? req.authUser?.email : undefined,
      forceSend: Boolean(body.forceSend),
      previewOnly: Boolean(body.previewOnly),
      staffUid: req.authUser?.uid,
      staffName: req.authUser?.name || req.authUser?.email || 'Equipe D&M Integra Chile',
      rawToken: req.authUser?.rawToken,
      projectId: PROJECT_ID,
      databaseId: DATABASE_ID,
    });

    res.json(result);
  },
);

app.post('/api/auth/check-admin', requireAuth, (req: AuthedRequest, res: Response) => {
  const adminEmails = getAdminEmails();
  const isAdminEmail = Boolean(req.authUser && adminEmails.has(req.authUser.email));
  res.json({
    isAdminEmail,
    email: req.authUser?.email || '',
  });
});

app.post('/api/upload', requireAuth, (req: AuthedRequest, res: Response) => {
  upload.single('file')(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof Error ? err.message : 'Falha no upload do arquivo.';
      res.status(400).json({ error: msg });
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado.' });
      return;
    }
    if (req.file.mimetype === 'image/svg+xml' || req.file.originalname.toLowerCase().endsWith('.svg')) {
      try {
        const rawSvg = fs.readFileSync(req.file.path, 'utf8');
        fs.writeFileSync(req.file.path, sanitizeSvgContent(rawSvg), 'utf8');
      } catch {
        // ignore if read fails
      }
    }
    res.json({
      url: `/uploads/${req.file.filename}`,
      filename: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

app.get('/api/media', requireAuth, requireRole(['admin', 'consultor', 'assistente']), (_req: AuthedRequest, res: Response) => {
  try {
    const entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true });
    const items = entries
      .filter((e) => e.isFile() && /\.(png|jpe?g|webp|svg|ico)$/i.test(e.name))
      .map((e) => {
        const st = fs.statSync(path.join(UPLOAD_DIR, e.name));
        return {
          filename: e.name,
          url: `/uploads/${e.name}`,
          size: st.size,
          updatedAt: st.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Erro ao listar mídias.' });
  }
});

app.delete('/api/media/:filename', requireAuth, requireRole(['admin']), (req: AuthedRequest, res: Response) => {
  const safeName = path.basename(req.params.filename || '');
  if (!safeName || safeName.includes('..')) {
    res.status(400).json({ error: 'Nome de arquivo inválido.' });
    return;
  }
  const fullPath = path.join(UPLOAD_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Arquivo não encontrado.' });
    return;
  }
  fs.unlinkSync(fullPath);
  res.json({ ok: true });
});

// -----------------------------------------------------------------------------
// 1. /api/ai/diagnostico — Refina parecer orientativo (exige sessão Google válida)
// -----------------------------------------------------------------------------
app.post('/api/ai/diagnostico', requireAuth, aiRateLimit, async (req: AuthedRequest, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const rawSize = Buffer.byteLength(JSON.stringify(body), 'utf8');
  if (rawSize > 64 * 1024) {
    res.status(413).json({ error: 'Carga de dados do diagnóstico excede o limite máximo permitido (64 KB).' });
    return;
  }
  if (!body.answers || !Array.isArray(body.regrasAcionadas)) {
    res.status(400).json({ error: 'Dados do diagnóstico incompletos.' });
    return;
  }
  const wantsStream = req.headers['x-ai-progress'] === '1';
  await runAiRouteExecution(req.authUser, wantsStream, res, buildDiagnosticoSpec(body), aiRouteDeps);
});

// -----------------------------------------------------------------------------
// 2. /api/ai/parecer — Parecer Técnico confrontado com Base Legal (admin/consultor)
// -----------------------------------------------------------------------------
app.post(
  '/api/ai/parecer',
  requireAuth,
  requireRole(['admin', 'consultor']),
  aiRateLimit,
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const wantsStream = req.headers['x-ai-progress'] === '1';
    await runAiRouteExecution(req.authUser, wantsStream, res, buildParecerSpec(body), aiRouteDeps);
  },
);

// -----------------------------------------------------------------------------
// 3. /api/ai/analisar-documento — Análise multimodal sugestiva (staff, com anexo)
// -----------------------------------------------------------------------------
app.post(
  '/api/ai/analisar-documento',
  requireAuth,
  requireRole(['admin', 'consultor', 'assistente']),
  aiRateLimit,
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const wantsStream = req.headers['x-ai-progress'] === '1';
    await runAiRouteExecution(req.authUser, wantsStream, res, buildAnalisarDocumentoSpec(body, UPLOAD_DIR), aiRouteDeps);
  },
);

// -----------------------------------------------------------------------------
// 4. /api/ai/custos — Referência estimada de taxas SERMIG / CNJ / Tradução
// -----------------------------------------------------------------------------
app.post(
  '/api/ai/custos',
  requireAuth,
  requireRole(['admin', 'consultor']),
  aiRateLimit,
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const wantsStream = req.headers['x-ai-progress'] === '1';
    await runAiRouteExecution(req.authUser, wantsStream, res, buildCustosSpec(body), aiRouteDeps);
  },
);

// -----------------------------------------------------------------------------
// 5. /api/ai/proposta — Parecer de proposta de parceiro confrontado com legalSources
// -----------------------------------------------------------------------------
app.post(
  '/api/ai/proposta',
  requireAuth,
  requireRole(['admin', 'consultor']),
  aiRateLimit,
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const wantsStream = req.headers['x-ai-progress'] === '1';
    await runAiRouteExecution(req.authUser, wantsStream, res, buildPropostaSpec(body), aiRouteDeps);
  },
);

// -----------------------------------------------------------------------------
// 6. /api/ai/norma — Análise e comparação de atualização normativa (texto e/ou anexo)
// -----------------------------------------------------------------------------
app.post(
  '/api/ai/norma',
  requireAuth,
  requireRole(['admin', 'consultor']),
  aiRateLimit,
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    const wantsStream = req.headers['x-ai-progress'] === '1';
    await runAiRouteExecution(req.authUser, wantsStream, res, buildNormaSpec(body, UPLOAD_DIR), aiRouteDeps);
  },
);

// -----------------------------------------------------------------------------
// 7. /api/ai/norma-verificar — Verificação online SERMIG/BCN via Google Search Grounding
// -----------------------------------------------------------------------------
app.post(
  '/api/ai/norma-verificar',
  requireAuth,
  requireRole(['admin', 'consultor']),
  aiRateLimit,
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    if (!body.currentSource || typeof body.currentSource !== 'object') {
      res.status(400).json({ error: 'Informe a norma atual para consulta oficial.' });
      return;
    }
    const wantsStream = req.headers['x-ai-progress'] === '1';
    await runAiRouteExecution(req.authUser, wantsStream, res, buildNormaVerificarSpec(body), aiRouteDeps);
  },
);

// -----------------------------------------------------------------------------
// 8. /api/legal/sermig-check — Verificação HTTP ao vivo dos portais oficiais SERMIG / BCN / Gov
// -----------------------------------------------------------------------------
app.post(
  '/api/legal/sermig-check',
  requireAuth,
  requireRole(['admin', 'consultor']),
  async (req: AuthedRequest, res: Response) => {
    const body = (req.body || {}) as { sources?: unknown };
    if (!Array.isArray(body.sources) || body.sources.length === 0) {
      res.status(400).json({ error: 'Informe ao menos uma norma oficial para verificação.' });
      return;
    }
    const cleanSources: SermigSourceCheckInput[] = body.sources
      .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id.slice(0, 128) : '',
        titulo: typeof item.titulo === 'string' ? item.titulo.slice(0, 240) : 'Norma oficial',
        url: typeof item.url === 'string' ? item.url.slice(0, 600) : '',
      }))
      .filter((item) => Boolean(item.id));

    if (cleanSources.length === 0) {
      res.status(400).json({ error: 'Nenhuma norma válida encontrada na solicitação.' });
      return;
    }

    try {
      const report = await runBatchOfficialLegalCheck(cleanSources);
      res.json(report);
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Erro ao verificar disponibilidade das fontes SERMIG/BCN.',
      });
    }
  },
);

app.get('/api/legal/sermig-check/health', (_req, res) => {
  res.json({ ok: true, mode: IS_VERCEL ? 'vercel-serverless' : 'node-server' });
});

// Garantir resposta JSON limpa para qualquer rota /api/* inexistente (evita HTML 404)
app.all('/api/*', (_req, res) => {
  res.status(404).json({ error: 'Rota de API não encontrada.' });
});

// =============================================================================
// Vite Dev Middleware / Production Static Serving (somente fora da Vercel)
// Na Vercel, arquivos estáticos são servidos pelo CDN (dist/) e /api/* via api/index.ts
// =============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vitePkg = 'vite';
    const { createServer: createViteServer } = await import(/* @vite-ignore */ vitePkg);
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor D&M Integra Chile ativo em http://localhost:${PORT}`);
  });
}

if (!IS_VERCEL) {
  void startServer();
}

export { app };
export default app;
