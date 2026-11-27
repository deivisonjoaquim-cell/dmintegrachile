import type {
  DiagnosticAnswers,
  DiagnosticRuleVersion,
  EmpresaConfig,
  LegalSource,
  PartnerPublic,
  SiteContent,
  VisaCategory,
  VisaRequirement,
} from '../types/domain';
import {
  DEFAULT_DIAGNOSTIC_RULE_VERSION,
  DEFAULT_EMPRESA_CONFIG,
  SEED_LEGAL_SOURCES,
  SEED_PARTNERS,
  SEED_SITE_CONTENT,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type { DiagnosticResult } from './diagnosticEngine';
import type { AiDiagnosticDraft } from '../components/DiagnosticReportView';

export type CatalogSyncSource = 'nuvem' | 'cache_local' | 'seed_embutido';

export interface RuleEngineCatalogSnapshot {
  empresa: EmpresaConfig;
  siteContent: SiteContent[];
  partnersPublic: PartnerPublic[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeDiagnosticRules: DiagnosticRuleVersion;
  source: CatalogSyncSource;
  savedAt?: string;
}

export interface PendingOfflineDiagnostic {
  id: string;
  createdAt: string;
  sessionToken: string;
  existingLeadId?: string;
  leadPayload: Record<string, unknown>;
  sessionPayload: Record<string, unknown>;
}

export interface RuleEngineDecisionLog {
  id: string;
  createdAt: string;
  mode: 'online_nuvem' | 'online_fallback_regras' | 'offline';
  origin: string;
  leadName?: string;
  leadEmail?: string;
  leadId?: string;
  sessionToken?: string;
  ruleVersion: string;
  subcategoriaRecomendada: string;
  notaViabilidade: number;
  confianca: string;
  regrasAcionadas: string[];
  flagsRisco: string[];
  fontesLegaisCitadas: string[];
  motivoModoLocal?: string;
  syncStatus: 'sincronizado' | 'pendente';
}

export interface LocalAiRuntimeNotice {
  mode: 'cloud' | 'local_rules';
  reason?: string;
  updatedAt?: string;
}

const SNAPSHOT_KEY = 'dm_offline_catalog_snapshot_v1';
const PENDING_DIAG_KEY = 'dm_offline_pending_diagnostics_v1';
const DECISION_LOGS_KEY = 'dm_offline_rule_decision_logs_v1';
const AI_NOTICE_KEY = 'dm_offline_ai_runtime_notice_v1';

const listeners = new Set<() => void>();

function emitOfflineChange(): void {
  listeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

export function subscribeOfflineEngineChanges(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function buildSeedPartnersPublic(): PartnerPublic[] {
  return SEED_PARTNERS.filter((p) => p.full.recomendadoAosClientes).map((p) => p.pub);
}

export function loadRuleEngineSnapshotSync(): RuleEngineCatalogSnapshot {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SNAPSHOT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RuleEngineCatalogSnapshot>;
        if (parsed.empresa && Array.isArray(parsed.visaCategories)) {
          return {
            empresa: parsed.empresa,
            siteContent: parsed.siteContent || SEED_SITE_CONTENT,
            partnersPublic: Array.isArray(parsed.partnersPublic)
              ? parsed.partnersPublic
              : buildSeedPartnersPublic(),
            visaCategories: parsed.visaCategories,
            visaRequirements: parsed.visaRequirements || SEED_VISA_REQUIREMENTS,
            legalSources: parsed.legalSources || SEED_LEGAL_SOURCES,
            activeDiagnosticRules: parsed.activeDiagnosticRules || DEFAULT_DIAGNOSTIC_RULE_VERSION,
            source: parsed.source || 'cache_local',
            savedAt: parsed.savedAt,
          };
        }
      }
    } catch {
      // fallback to embedded seeds
    }
  }

  return {
    empresa: DEFAULT_EMPRESA_CONFIG,
    siteContent: SEED_SITE_CONTENT,
    partnersPublic: buildSeedPartnersPublic(),
    visaCategories: SEED_VISA_CATEGORIES,
    visaRequirements: SEED_VISA_REQUIREMENTS,
    legalSources: SEED_LEGAL_SOURCES,
    activeDiagnosticRules: DEFAULT_DIAGNOSTIC_RULE_VERSION,
    source: 'seed_embutido',
  };
}

export function saveRuleEngineSnapshot(snapshot: Omit<RuleEngineCatalogSnapshot, 'savedAt'>): string {
  const savedAt = new Date().toISOString();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        SNAPSHOT_KEY,
        JSON.stringify({ ...snapshot, savedAt }),
      );
    } catch {
      // ignore storage quota errors
    }
  }
  emitOfflineChange();
  return savedAt;
}

export function removePartnerFromOfflineSnapshot(partnerId: string): void {
  if (!partnerId || typeof window === 'undefined') return;
  try {
    const current = loadRuleEngineSnapshotSync();
    const nextPartners = current.partnersPublic.filter((p) => p.id !== partnerId);
    if (nextPartners.length !== current.partnersPublic.length) {
      saveRuleEngineSnapshot({
        empresa: current.empresa,
        siteContent: current.siteContent,
        partnersPublic: nextPartners,
        visaCategories: current.visaCategories,
        visaRequirements: current.visaRequirements,
        legalSources: current.legalSources,
        activeDiagnosticRules: current.activeDiagnosticRules,
        source: current.source,
      });
    }
  } catch {
    // ignore storage errors
  }
}

export function updatePartnersInOfflineSnapshot(partnersPublic: PartnerPublic[]): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadRuleEngineSnapshotSync();
    saveRuleEngineSnapshot({
      empresa: current.empresa,
      siteContent: current.siteContent,
      partnersPublic,
      visaCategories: current.visaCategories,
      visaRequirements: current.visaRequirements,
      legalSources: current.legalSources,
      activeDiagnosticRules: current.activeDiagnosticRules,
      source: 'nuvem',
    });
  } catch {
    // ignore storage errors
  }
}

export function listPendingOfflineDiagnostics(): PendingOfflineDiagnostic[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PENDING_DIAG_KEY);
    return raw ? (JSON.parse(raw) as PendingOfflineDiagnostic[]) : [];
  } catch {
    return [];
  }
}

export function savePendingOfflineDiagnostic(item: PendingOfflineDiagnostic): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = listPendingOfflineDiagnostics().filter(
      (x) => x.sessionToken !== item.sessionToken,
    );
    existing.push(item);
    window.localStorage.setItem(PENDING_DIAG_KEY, JSON.stringify(existing.slice(-30)));
  } catch {
    // ignore storage errors
  }
  emitOfflineChange();
}

export function removePendingOfflineDiagnostic(sessionToken: string): void {
  if (typeof window === 'undefined') return;
  try {
    const next = listPendingOfflineDiagnostics().filter(
      (x) => x.sessionToken !== sessionToken,
    );
    window.localStorage.setItem(PENDING_DIAG_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  emitOfflineChange();
}

export function listRuleEngineDecisionLogs(): RuleEngineDecisionLog[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DECISION_LOGS_KEY);
    return raw ? (JSON.parse(raw) as RuleEngineDecisionLog[]) : [];
  } catch {
    return [];
  }
}

export function recordRuleEngineDecision(
  input: Omit<RuleEngineDecisionLog, 'id' | 'createdAt'>,
): RuleEngineDecisionLog {
  const entry: RuleEngineDecisionLog = {
    ...input,
    id: `relog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      const list = listRuleEngineDecisionLogs();
      list.unshift(entry);
      window.localStorage.setItem(DECISION_LOGS_KEY, JSON.stringify(list.slice(0, 60)));
    } catch {
      // ignore storage errors
    }
  }
  emitOfflineChange();
  return entry;
}

export function markRuleEngineDecisionSynced(logId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = listRuleEngineDecisionLogs().map((l) =>
      l.id === logId ? { ...l, syncStatus: 'sincronizado' as const } : l,
    );
    window.localStorage.setItem(DECISION_LOGS_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
  emitOfflineChange();
}

export async function hydrateRuleEngineLogsFromIdb(): Promise<void> {
  // LocalStorage already loaded synchronously
}

export async function hydratePendingDiagnosticsFromIdb(): Promise<void> {
  // LocalStorage already loaded synchronously
}

export function countPendingOfflineItems(): {
  pendingLeads: number;
  pendingLogs: number;
  total: number;
} {
  const pendingLeads = listPendingOfflineDiagnostics().length;
  const pendingLogs = listRuleEngineDecisionLogs().filter((l) => l.syncStatus === 'pendente').length;
  return { pendingLeads, pendingLogs, total: pendingLeads + pendingLogs };
}

export function getLocalAiRuntimeNotice(): LocalAiRuntimeNotice {
  if (typeof window === 'undefined') return { mode: 'cloud' };
  try {
    const raw = window.localStorage.getItem(AI_NOTICE_KEY);
    if (!raw) return { mode: 'cloud' };
    return JSON.parse(raw) as LocalAiRuntimeNotice;
  } catch {
    return { mode: 'cloud' };
  }
}

export function setLocalAiRuntimeNotice(
  mode: 'cloud' | 'local_rules',
  reason?: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      AI_NOTICE_KEY,
      JSON.stringify({ mode, reason, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // ignore storage errors
  }
  emitOfflineChange();
}

export function buildLocalDiagnosticSynthesis(
  answers: DiagnosticAnswers,
  result: DiagnosticResult,
  reason?: string,
): AiDiagnosticDraft {
  const rec = result.recomendada?.visa;
  const subLabel = rec ? `${rec.codigo} — ${rec.nomePortugues}` : 'Análise técnica personalizada';
  return {
    rascunho: true,
    fallback: true,
    origem: 'regras',
    origemLabel: 'Motor Determinístico SERMIG (Regras Locais)',
    mensagemUsuario: reason,
    resumoExecutivo: `Pré-enquadramento para ${answers.nome || 'o interessado'}: rota prioritária sugerida em ${subLabel}, com índice preliminar de ${result.viabilidade.total}/100 e confiança ${result.confianca}.`,
    riscos: result.flagsRisco.map((f) => `${f.pergunta}: ${f.orientacao}`),
    pontosAtencao:
      result.alertas.length > 0
        ? result.alertas.slice(0, 5)
        : ['Confirmar validade do passaporte e antecedentes apostilados antes do protocolo.'],
    fontesCitadas: result.fontesLegais.map(
      (f) => `${f.titulo}${f.numeroAno ? ` (${f.numeroAno})` : ''}`,
    ),
    proximosPassos: [
      'Revisar o enquadramento com a consultoria para confirmar a estratégia e documentos obrigatórios.',
      'Escolher a modalidade de consultoria (Orientativa ou Completa) conforme sua necessidade.',
    ],
  };
}
