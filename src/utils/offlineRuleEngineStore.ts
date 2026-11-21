import {
  DEFAULT_DIAGNOSTIC_RULE_VERSION,
  DEFAULT_EMPRESA_CONFIG,
  SEED_LEGAL_SOURCES,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type {
  AuditLog,
  DiagnosticAnswers,
  DiagnosticRuleVersion,
  EmpresaConfig,
  Lead,
  LegalSource,
  VisaCategory,
  VisaRequirement,
} from '../types/domain';
import type { AiResponseMeta } from './aiClient';
import type { DiagnosticResult } from './diagnosticEngine';

// =============================================================================
// Types
// =============================================================================

export type CatalogSyncSource = 'cloud' | 'local_snapshot' | 'seed';

export interface RuleEngineSnapshot {
  version: number;
  savedAt: string;
  source: CatalogSyncSource;
  empresa: EmpresaConfig;
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeDiagnosticRules: DiagnosticRuleVersion;
}

export type RuleDecisionMode = 'offline' | 'online_fallback_regras' | 'online_nuvem';

export type RuleDecisionOrigin =
  | 'diagnostico_publico'
  | 'diagnostico_ia_regras'
  | 'parecer_regras'
  | 'custos_regras'
  | 'norma_regras'
  | 'documento_regras'
  | 'proposta_regras';

export type RuleDecisionSyncStatus = 'pendente' | 'sincronizado' | 'revisado';

export interface RuleEngineDecisionLog {
  id: string;
  createdAt: string;
  mode: RuleDecisionMode;
  origin: RuleDecisionOrigin;
  leadName?: string;
  leadEmail?: string;
  leadId?: string;
  sessionToken?: string;
  ruleVersion: string;
  subcategoriaRecomendada: string;
  notaViabilidade?: number;
  confianca?: string;
  regrasAcionadas: string[];
  flagsRisco: string[];
  fontesLegaisCitadas: string[];
  motivoModoLocal?: string;
  syncStatus: RuleDecisionSyncStatus;
  syncedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  storageOrigin?: 'local' | 'nuvem';
}

export interface PendingOfflineDiagnostic {
  id: string;
  createdAt: string;
  sessionToken: string;
  existingLeadId?: string;
  leadPayload: {
    nome: string;
    whatsapp: string;
    email: string;
    cidadeUf: string;
    origem: Lead['origem'];
    interesse: string;
    respostasTriagem: DiagnosticAnswers;
    subcategoriaSugerida: string;
    notaViabilidade: number;
    confianca: 'Alta' | 'Média' | 'Baixa';
    temperatura: 'Quente' | 'Morno' | 'Frio';
    prioridade: 'Urgente' | 'Alta' | 'Média' | 'Baixa';
    flagsRisco: string[];
    versaoRegras: string;
    sessionToken: string;
    statusConclusao: 'Concluído';
    etapaAtual: number;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    lgpdAceito: boolean;
    lgpdVersao: string;
    lgpdData: string;
  };
  sessionPayload: {
    etapaAtual: number;
    answers: DiagnosticAnswers;
    concluido: boolean;
    expiraEmMs: number;
    utm?: { source?: string; medium?: string; campaign?: string };
  };
}

export interface LocalAiRuntimeNotice {
  mode: 'unknown' | 'cloud' | 'local_rules';
  reason?: string;
  updatedAt: string;
}

export interface LocalDiagnosticDraftOutput extends AiResponseMeta {
  rascunho: boolean;
  resumoExecutivo: string;
  riscos: string[];
  perguntasConsultor: string[];
  pontosAtencao: string[];
  fontesCitadas: string[];
  proximosPassos: string[];
}

// =============================================================================
// Storage Keys & IndexedDB Constants
// =============================================================================

const IDB_NAME = 'dm_integra_offline_engine_v1';
const IDB_VERSION = 1;
const STORE_KV = 'kv_store';

const LS_SNAPSHOT_KEY = 'dm_integra_rule_snapshot_v1';
const LS_LOGS_KEY = 'dm_integra_rule_decision_logs_v1';
const LS_PENDING_DIAG_KEY = 'dm_integra_pending_offline_diags_v1';
const LS_AI_NOTICE_KEY = 'dm_integra_ai_runtime_notice_v1';

const MAX_LOCAL_LOGS = 200;
const MAX_PENDING_DIAGS = 50;

const listeners = new Set<() => void>();

export function subscribeOfflineEngineChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitOfflineEngineChange(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // keep store resilient
    }
  }
}

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore private browsing / restricted storage
  }
  return null;
}

function openOfflineIdb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) {
          db.createObjectStore(STORE_KV);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openOfflineIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(value, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      try {
        db.close();
      } catch {
        // ignore
      }
      resolve();
    }
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openOfflineIdb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(key);
      req.onsuccess = () => {
        const res = (req.result as T | undefined) ?? null;
        db.close();
        resolve(res);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      try {
        db.close();
      } catch {
        // ignore
      }
      resolve(null);
    }
  });
}

function readJsonFromLocalStorage<T>(key: string): T | null {
  const ls = getSafeLocalStorage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonToLocalStorage(key: string, value: unknown): void {
  const ls = getSafeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors; IndexedDB holds full copy
  }
}

// =============================================================================
// 1. Rule Engine Snapshot Persistence (IndexedDB + LocalStorage Mirror)
// =============================================================================

export function getSeedRuleEngineSnapshot(): RuleEngineSnapshot {
  return {
    version: 1,
    savedAt: '',
    source: 'seed',
    empresa: DEFAULT_EMPRESA_CONFIG,
    visaCategories: SEED_VISA_CATEGORIES,
    visaRequirements: SEED_VISA_REQUIREMENTS,
    legalSources: SEED_LEGAL_SOURCES,
    activeDiagnosticRules: DEFAULT_DIAGNOSTIC_RULE_VERSION,
  };
}

function isValidRuleSnapshot(raw: unknown): raw is RuleEngineSnapshot {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Partial<RuleEngineSnapshot>;
  return (
    Array.isArray(obj.visaCategories) &&
    obj.visaCategories.length > 0 &&
    Array.isArray(obj.visaRequirements) &&
    Array.isArray(obj.legalSources) &&
    Boolean(obj.activeDiagnosticRules && typeof obj.activeDiagnosticRules === 'object') &&
    Boolean(obj.empresa && typeof obj.empresa === 'object')
  );
}

export function loadRuleEngineSnapshotSync(): RuleEngineSnapshot {
  const cached = readJsonFromLocalStorage<RuleEngineSnapshot>(LS_SNAPSHOT_KEY);
  if (isValidRuleSnapshot(cached)) {
    return {
      ...cached,
      source: 'local_snapshot',
    };
  }
  return getSeedRuleEngineSnapshot();
}

export async function loadRuleEngineSnapshotAsync(): Promise<RuleEngineSnapshot> {
  const fromIdb = await idbGet<RuleEngineSnapshot>(LS_SNAPSHOT_KEY);
  if (isValidRuleSnapshot(fromIdb)) {
    writeJsonToLocalStorage(LS_SNAPSHOT_KEY, fromIdb);
    return {
      ...fromIdb,
      source: 'local_snapshot',
    };
  }
  return loadRuleEngineSnapshotSync();
}

export async function saveRuleEngineSnapshot(input: {
  empresa: EmpresaConfig;
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeDiagnosticRules: DiagnosticRuleVersion;
  source?: CatalogSyncSource;
}): Promise<RuleEngineSnapshot> {
  const snapshot: RuleEngineSnapshot = {
    version: 1,
    savedAt: new Date().toISOString(),
    source: input.source || 'cloud',
    empresa: input.empresa,
    visaCategories: input.visaCategories,
    visaRequirements: input.visaRequirements,
    legalSources: input.legalSources,
    activeDiagnosticRules: input.activeDiagnosticRules,
  };
  writeJsonToLocalStorage(LS_SNAPSHOT_KEY, snapshot);
  await idbPut(LS_SNAPSHOT_KEY, snapshot);
  emitOfflineEngineChange();
  return snapshot;
}

// =============================================================================
// 2. Internal Rule Engine Decision Log (Local Persistence + Cloud Merge)
// =============================================================================

export function makeRuleLogId(): string {
  return `rlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listRuleEngineDecisionLogs(): RuleEngineDecisionLog[] {
  const list = readJsonFromLocalStorage<RuleEngineDecisionLog[]>(LS_LOGS_KEY);
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is RuleEngineDecisionLog => Boolean(item && typeof item === 'object' && typeof item.id === 'string'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function hydrateRuleEngineLogsFromIdb(): Promise<RuleEngineDecisionLog[]> {
  const fromIdb = await idbGet<RuleEngineDecisionLog[]>(LS_LOGS_KEY);
  const fromLs = listRuleEngineDecisionLogs();
  if (!Array.isArray(fromIdb) || fromIdb.length === 0) {
    return fromLs;
  }
  const byId = new Map<string, RuleEngineDecisionLog>();
  for (const item of fromIdb) {
    if (item?.id) byId.set(item.id, item);
  }
  for (const item of fromLs) {
    if (item?.id) byId.set(item.id, item);
  }
  const merged = Array.from(byId.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_LOCAL_LOGS);
  writeJsonToLocalStorage(LS_LOGS_KEY, merged);
  emitOfflineEngineChange();
  return merged;
}

function persistRuleLogs(logs: RuleEngineDecisionLog[]): void {
  const trimmed = logs
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_LOCAL_LOGS);
  writeJsonToLocalStorage(LS_LOGS_KEY, trimmed);
  void idbPut(LS_LOGS_KEY, trimmed);
  emitOfflineEngineChange();
}

export function recordRuleEngineDecision(
  input: Omit<RuleEngineDecisionLog, 'id' | 'createdAt' | 'syncStatus' | 'storageOrigin'> & {
    id?: string;
    createdAt?: string;
    syncStatus?: RuleDecisionSyncStatus;
  },
): RuleEngineDecisionLog {
  const entry: RuleEngineDecisionLog = {
    id: (input.id || makeRuleLogId()).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
    createdAt: input.createdAt || new Date().toISOString(),
    mode: input.mode,
    origin: input.origin,
    leadName: input.leadName?.slice(0, 160),
    leadEmail: input.leadEmail?.toLowerCase().slice(0, 180),
    leadId: input.leadId?.slice(0, 128),
    sessionToken: input.sessionToken?.slice(0, 128),
    ruleVersion: (input.ruleVersion || '1.0').slice(0, 40),
    subcategoriaRecomendada: (input.subcategoriaRecomendada || 'Análise complementar').slice(0, 200),
    notaViabilidade: typeof input.notaViabilidade === 'number' ? input.notaViabilidade : undefined,
    confianca: input.confianca?.slice(0, 40),
    regrasAcionadas: (input.regrasAcionadas || []).slice(0, 25).map((r) => String(r).slice(0, 260)),
    flagsRisco: (input.flagsRisco || []).slice(0, 20).map((f) => String(f).slice(0, 220)),
    fontesLegaisCitadas: (input.fontesLegaisCitadas || []).slice(0, 15).map((s) => String(s).slice(0, 200)),
    motivoModoLocal: input.motivoModoLocal?.slice(0, 240),
    syncStatus: input.syncStatus || (input.mode === 'online_nuvem' ? 'sincronizado' : 'pendente'),
    storageOrigin: 'local',
  };

  const current = listRuleEngineDecisionLogs();
  const deduped = current.filter((item) => item.id !== entry.id);
  persistRuleLogs([entry, ...deduped]);
  return entry;
}

export function markRuleEngineDecisionSynced(logId: string, syncedAt = new Date().toISOString()): void {
  const current = listRuleEngineDecisionLogs();
  const next: RuleEngineDecisionLog[] = current.map((item) =>
    item.id === logId
      ? {
          ...item,
          syncStatus: (item.syncStatus === 'revisado' ? 'revisado' : 'sincronizado') as RuleDecisionSyncStatus,
          syncedAt,
        }
      : item,
  );
  persistRuleLogs(next);
}

export function markRuleEngineDecisionReviewed(
  logId: string,
  reviewer: string,
  reviewNotes?: string,
): RuleEngineDecisionLog | null {
  const now = new Date().toISOString();
  const current = listRuleEngineDecisionLogs();
  let updated: RuleEngineDecisionLog | null = null;
  const next = current.map((item) => {
    if (item.id !== logId) return item;
    updated = {
      ...item,
      syncStatus: 'revisado',
      reviewedBy: reviewer.slice(0, 140),
      reviewedAt: now,
      reviewNotes: reviewNotes?.trim().slice(0, 600) || item.reviewNotes,
    };
    return updated;
  });
  if (updated) {
    persistRuleLogs(next);
  }
  return updated;
}

export function buildAuditLogPayloadForRuleDecision(log: RuleEngineDecisionLog): {
  entidade: 'motor_regras_offline';
  entidadeId: string;
  acao: string;
  campo: string;
  depois: string;
} {
  const compact = {
    id: log.id,
    createdAt: log.createdAt,
    mode: log.mode,
    origin: log.origin,
    leadName: log.leadName || '',
    leadEmail: log.leadEmail || '',
    leadId: log.leadId || '',
    ruleVersion: log.ruleVersion,
    subcategoriaRecomendada: log.subcategoriaRecomendada,
    notaViabilidade: log.notaViabilidade,
    confianca: log.confianca || '',
    regrasAcionadas: log.regrasAcionadas.slice(0, 12),
    flagsRisco: log.flagsRisco.slice(0, 8),
    fontesLegaisCitadas: log.fontesLegaisCitadas.slice(0, 8),
    motivoModoLocal: log.motivoModoLocal || '',
    syncStatus: log.syncStatus,
    reviewedBy: log.reviewedBy || '',
    reviewedAt: log.reviewedAt || '',
    reviewNotes: log.reviewNotes || '',
  };
  let serialized = JSON.stringify(compact);
  if (serialized.length > 3850) {
    compact.regrasAcionadas = compact.regrasAcionadas.slice(0, 6).map((r) => r.slice(0, 140));
    compact.flagsRisco = compact.flagsRisco.slice(0, 5).map((f) => f.slice(0, 120));
    compact.fontesLegaisCitadas = compact.fontesLegaisCitadas.slice(0, 5).map((s) => s.slice(0, 120));
    serialized = JSON.stringify(compact).slice(0, 3900);
  }
  return {
    entidade: 'motor_regras_offline',
    entidadeId: log.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128),
    acao: log.syncStatus === 'revisado' ? 'revisao_diagnostico_offline' : 'decisao_motor_regras',
    campo: log.mode,
    depois: serialized,
  };
}

export function parseRuleDecisionLogsFromAuditLogs(auditLogs: AuditLog[]): RuleEngineDecisionLog[] {
  const byId = new Map<string, RuleEngineDecisionLog>();
  for (const a of auditLogs) {
    if (a.entidade !== 'motor_regras_offline' || !a.depois) continue;
    try {
      const parsed = JSON.parse(a.depois) as Partial<RuleEngineDecisionLog>;
      const id = parsed.id || a.entidadeId;
      if (!id) continue;
      const existing = byId.get(id);
      const isReviewEvent = a.acao === 'revisao_diagnostico_offline' || parsed.syncStatus === 'revisado';
      const candidate: RuleEngineDecisionLog = {
        id,
        createdAt: parsed.createdAt || a.createdAt,
        mode: (parsed.mode as RuleDecisionMode) || (a.campo as RuleDecisionMode) || 'offline',
        origin: (parsed.origin as RuleDecisionOrigin) || 'diagnostico_publico',
        leadName: parsed.leadName || existing?.leadName,
        leadEmail: parsed.leadEmail || existing?.leadEmail,
        leadId: parsed.leadId || existing?.leadId,
        sessionToken: parsed.sessionToken || existing?.sessionToken,
        ruleVersion: parsed.ruleVersion || existing?.ruleVersion || '1.0',
        subcategoriaRecomendada: parsed.subcategoriaRecomendada || existing?.subcategoriaRecomendada || 'Análise complementar',
        notaViabilidade: parsed.notaViabilidade ?? existing?.notaViabilidade,
        confianca: parsed.confianca || existing?.confianca,
        regrasAcionadas: Array.isArray(parsed.regrasAcionadas) ? parsed.regrasAcionadas : existing?.regrasAcionadas || [],
        flagsRisco: Array.isArray(parsed.flagsRisco) ? parsed.flagsRisco : existing?.flagsRisco || [],
        fontesLegaisCitadas: Array.isArray(parsed.fontesLegaisCitadas)
          ? parsed.fontesLegaisCitadas
          : existing?.fontesLegaisCitadas || [],
        motivoModoLocal: parsed.motivoModoLocal || existing?.motivoModoLocal,
        syncStatus: isReviewEvent || existing?.syncStatus === 'revisado' ? 'revisado' : 'sincronizado',
        syncedAt: a.createdAt || existing?.syncedAt,
        reviewedBy: parsed.reviewedBy || (isReviewEvent ? a.actorEmail : existing?.reviewedBy),
        reviewedAt: parsed.reviewedAt || (isReviewEvent ? a.createdAt : existing?.reviewedAt),
        reviewNotes: parsed.reviewNotes || existing?.reviewNotes,
        storageOrigin: 'nuvem',
      };
      byId.set(id, candidate);
    } catch {
      // ignore non-JSON legacy logs
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mergeLocalAndCloudRuleLogs(
  localLogs: RuleEngineDecisionLog[],
  cloudLogs: RuleEngineDecisionLog[],
): RuleEngineDecisionLog[] {
  const byId = new Map<string, RuleEngineDecisionLog>();
  for (const c of cloudLogs) {
    byId.set(c.id, c);
  }
  for (const l of localLogs) {
    const cloud = byId.get(l.id);
    if (!cloud) {
      byId.set(l.id, l);
    } else {
      const reviewed = cloud.syncStatus === 'revisado' || l.syncStatus === 'revisado';
      byId.set(l.id, {
        ...cloud,
        ...l,
        syncStatus: reviewed ? 'revisado' : cloud.syncStatus === 'sincronizado' ? 'sincronizado' : l.syncStatus,
        syncedAt: cloud.syncedAt || l.syncedAt,
        reviewedBy: l.reviewedBy || cloud.reviewedBy,
        reviewedAt: l.reviewedAt || cloud.reviewedAt,
        reviewNotes: l.reviewNotes || cloud.reviewNotes,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// =============================================================================
// 3. Pending Offline Diagnostics Queue (Zero-Loss Submissions While Offline)
// =============================================================================

export function listPendingOfflineDiagnostics(): PendingOfflineDiagnostic[] {
  const list = readJsonFromLocalStorage<PendingOfflineDiagnostic[]>(LS_PENDING_DIAG_KEY);
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is PendingOfflineDiagnostic => Boolean(item && item.id && item.leadPayload));
}

export function savePendingOfflineDiagnostic(entry: PendingOfflineDiagnostic): PendingOfflineDiagnostic[] {
  const current = listPendingOfflineDiagnostics();
  const next = [entry, ...current.filter((item) => item.sessionToken !== entry.sessionToken)].slice(
    0,
    MAX_PENDING_DIAGS,
  );
  writeJsonToLocalStorage(LS_PENDING_DIAG_KEY, next);
  void idbPut(LS_PENDING_DIAG_KEY, next);
  emitOfflineEngineChange();
  return next;
}

export function removePendingOfflineDiagnostic(sessionToken: string): PendingOfflineDiagnostic[] {
  const current = listPendingOfflineDiagnostics();
  const next = current.filter((item) => item.sessionToken !== sessionToken);
  writeJsonToLocalStorage(LS_PENDING_DIAG_KEY, next);
  void idbPut(LS_PENDING_DIAG_KEY, next);
  emitOfflineEngineChange();
  return next;
}

export async function hydratePendingDiagnosticsFromIdb(): Promise<PendingOfflineDiagnostic[]> {
  const fromIdb = await idbGet<PendingOfflineDiagnostic[]>(LS_PENDING_DIAG_KEY);
  const fromLs = listPendingOfflineDiagnostics();
  if (!Array.isArray(fromIdb) || fromIdb.length === 0) return fromLs;
  const byToken = new Map<string, PendingOfflineDiagnostic>();
  for (const item of fromIdb) {
    if (item?.sessionToken) byToken.set(item.sessionToken, item);
  }
  for (const item of fromLs) {
    if (item?.sessionToken) byToken.set(item.sessionToken, item);
  }
  const merged = Array.from(byToken.values()).slice(0, MAX_PENDING_DIAGS);
  writeJsonToLocalStorage(LS_PENDING_DIAG_KEY, merged);
  emitOfflineEngineChange();
  return merged;
}

// =============================================================================
// 4. Local AI Runtime Notice (Tracks Cloud AI vs Local Rules Status)
// =============================================================================

export function getLocalAiRuntimeNotice(): LocalAiRuntimeNotice {
  const saved = readJsonFromLocalStorage<LocalAiRuntimeNotice>(LS_AI_NOTICE_KEY);
  if (saved && (saved.mode === 'cloud' || saved.mode === 'local_rules' || saved.mode === 'unknown')) {
    return saved;
  }
  return { mode: 'unknown', updatedAt: '' };
}

export function setLocalAiRuntimeNotice(mode: 'cloud' | 'local_rules', reason?: string): void {
  const next: LocalAiRuntimeNotice = {
    mode,
    reason: reason?.slice(0, 260),
    updatedAt: new Date().toISOString(),
  };
  writeJsonToLocalStorage(LS_AI_NOTICE_KEY, next);
  emitOfflineEngineChange();
}

export function countPendingOfflineItems(): { pendingLeads: number; pendingLogs: number; total: number } {
  const pendingLeads = listPendingOfflineDiagnostics().length;
  const pendingLogs = listRuleEngineDecisionLogs().filter((l) => l.syncStatus === 'pendente').length;
  return {
    pendingLeads,
    pendingLogs,
    total: pendingLeads + pendingLogs,
  };
}

// =============================================================================
// 5. Pure Client-Side Local Rule-Engine Synthesis (Works 100% Offline)
// =============================================================================

export function buildLocalDiagnosticSynthesis(
  answers: DiagnosticAnswers,
  result: DiagnosticResult,
  reasonMessage?: string,
): LocalDiagnosticDraftOutput {
  const subLabel = result.recomendada
    ? `${result.recomendada.visa.codigo} - ${result.recomendada.visa.nomePortugues}`
    : 'Análise complementar pelo consultor';
  const isInChile =
    answers.localizacao === 'No Chile como turista' || answers.localizacao === 'No Chile com residência';
  const localText = isInChile
    ? 'no Chile (atenção às restrições da Ley 21.325 para mudança de status em território chileno)'
    : 'fora do Chile (cenário padrão para protocolo do exterior via portal SERMIG)';

  const fontesCitadas =
    result.fontesLegais.length > 0
      ? result.fontesLegais.map((f) => `${f.titulo}${f.numeroAno ? ` (${f.numeroAno})` : ''}`)
      : ['fonte a cadastrar'];

  const riscos = [
    ...result.flagsRisco.map((f) => `${f.pergunta} — ${f.orientacao}`),
    ...result.flagsRevisaoConsultor.map((f) => `Revisão consultiva pendente: ${f.label}`),
  ];
  if (riscos.length === 0) {
    riscos.push('Sem impedimentos críticos identificados na triagem local; validar vigência documental antes do protocolo.');
  }

  const pontosAtencao = result.regrasAcionadas.slice(0, 6);
  if (pontosAtencao.length === 0) {
    pontosAtencao.push('Conferir validade de passaporte, certidões apostiladas (Haia) e janela de 60 dias dos antecedentes criminais.');
  }

  const acoesIniciais = (result.planoAcao?.facaAgora || [])
    .slice(0, 2)
    .map((etapa) => `${etapa.titulo}: ${etapa.detalhe}`);
  const proximosPassos = [
    'Conferir a lista de documentos obrigatórios e prazos de emissão/apostilamento na etapa de preparação.',
    'Validar este diagnóstico offline com a equipe de consultoria assim que a sincronização em nuvem for concluída.',
    ...acoesIniciais,
    ...(result.cronogramaFaixas?.preparacaoDocumental
      ? [`Preparação documental estimada: ${result.cronogramaFaixas.preparacaoDocumental}.`]
      : []),
  ];

  return {
    rascunho: true,
    fallback: true,
    origem: 'regras',
    origemLabel: 'Assistente de Regras SERMIG/BCN',
    modeloUsado: 'regras_sermig',
    tentativas: 0,
    mensagemUsuario:
      reasonMessage ||
      'Síntese orientativa estruturada pelas regras migratórias SERMIG/BCN.',
    resumoExecutivo: `Enquadramento apontado pelas regras ${result.versaoRegras.versao}: ${subLabel} (viabilidade ${result.viabilidade.total}/100, confiança ${result.confianca}). Solicitante atualmente ${localText}.`,
    riscos: riscos.slice(0, 6),
    perguntasConsultor: [
      'Confirmar data prevista de embarque e validade atual do passaporte de todos os viajantes.',
      'Validar necessidade de tradução juramentada e ordem ideal de emissão dos antecedentes criminais (validade curta de 60 dias).',
      'Conferir se há dependentes ou vínculos familiares que exigem certidões de inteiro teor atualizadas.',
    ],
    pontosAtencao,
    fontesCitadas,
    proximosPassos: proximosPassos.slice(0, 5),
  };
}
