import fs from 'node:fs';
import path from 'node:path';

export interface FirebaseServerConfig {
  projectId: string;
  firestoreDatabaseId: string;
  authDomain?: string;
  apiKey?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const FALLBACK_CONFIG: FirebaseServerConfig = {
  projectId: 'gen-lang-client-0947959506',
  firestoreDatabaseId: 'ai-studio-9fb61fde-cee1-40db-bb8b-ce86ef2d5c98',
  authDomain: 'gen-lang-client-0947959506.firebaseapp.com',
  storageBucket: 'gen-lang-client-0947959506.firebasestorage.app',
  messagingSenderId: '1076872213311',
  appId: '1:1076872213311:web:07abae77b1858f0646198a',
};

let cachedConfig: FirebaseServerConfig | null = null;

export function loadFirebaseServerConfig(): FirebaseServerConfig {
  if (cachedConfig) return cachedConfig;

  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), 'src', 'firebase-applet-config.json'),
  ];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const raw = fs.readFileSync(candidate, 'utf8');
        const parsed = JSON.parse(raw) as Partial<FirebaseServerConfig>;
        if (parsed.projectId) {
          cachedConfig = {
            ...FALLBACK_CONFIG,
            ...parsed,
            projectId: parsed.projectId,
            firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
          };
          return cachedConfig;
        }
      }
    } catch {
      // try next candidate
    }
  }

  cachedConfig = {
    ...FALLBACK_CONFIG,
    projectId: process.env.FIREBASE_PROJECT_ID || FALLBACK_CONFIG.projectId,
    firestoreDatabaseId: process.env.FIRESTORE_DATABASE_ID || FALLBACK_CONFIG.firestoreDatabaseId,
  };
  return cachedConfig;
}
