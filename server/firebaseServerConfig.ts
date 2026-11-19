import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface FirebaseServerConfig {
  projectId: string;
  firestoreDatabaseId: string;
}

let cachedConfig: FirebaseServerConfig | null = null;

/**
 * Loads `firebase-applet-config.json` reliably across:
 * - Local dev (`tsx server.ts`)
 * - Standalone Node (`node server.ts`)
 * - Vercel Serverless Functions (where `api/index.ts` is bundled into `/var/task/api/...`
 *   while `process.cwd()` points to `/var/task`)
 */
export function loadFirebaseServerConfig(): FirebaseServerConfig {
  if (cachedConfig) return cachedConfig;

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(moduleDir, '../firebase-applet-config.json'),
    path.resolve(moduleDir, './firebase-applet-config.json'),
    path.resolve(moduleDir, '../../firebase-applet-config.json'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw) as Partial<FirebaseServerConfig>;
        if (parsed.projectId) {
          cachedConfig = {
            projectId: parsed.projectId,
            firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
          };
          return cachedConfig;
        }
      }
    } catch {
      // Try next candidate path
    }
  }

  if (process.env.FIREBASE_PROJECT_ID) {
    cachedConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      firestoreDatabaseId: process.env.FIREBASE_DATABASE_ID || '(default)',
    };
    return cachedConfig;
  }

  throw new Error(
    'Não foi possível localizar firebase-applet-config.json. Verifique a presença do arquivo na raiz do projeto ou defina FIREBASE_PROJECT_ID.',
  );
}
