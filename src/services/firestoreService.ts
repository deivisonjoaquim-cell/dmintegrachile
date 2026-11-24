import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  clearAdminVerificationCache,
  executeValidatedAdminWrite,
  isPrimaryAdminEmail,
  verifyAndEnsureAdminAccess,
} from './adminSecurityService';
import {
  BRAND_ASSETS,
  isLegacyOrBrokenBrandUrl,
  resolveOfficialBrandUrl,
} from '../constants/brandAssets';
import { sanitizeClientAiError } from '../utils/aiClient';
import {
  computeAiCacheKey,
  getAiCachedResponse,
  setAiCachedResponse,
} from '../utils/aiIndexedDbCache';
import {
  DEFAULT_CONTRATO_TEMPLATE,
  DEFAULT_DIAGNOSTIC_RULE_VERSION,
  DEFAULT_EMPRESA_CONFIG,
  SEED_DOCUMENT_TEMPLATES,
  SEED_LEGAL_SOURCES,
  SEED_MESSAGE_TEMPLATES,
  SEED_PARTNERS,
  SEED_SITE_CONTENT,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type {
  Appointment,
  AuditLog,
  BancarioConfig,
  Budget,
  Case,
  CaseDocument,
  CaseFinancialSummary,
  Client,
  ClientTestimonial,
  CommunicationLog,
  Deadline,
  Dependent,
  DiagnosticAnswers,
  DiagnosticRuleVersion,
  DiagnosticSession,
  DocumentTemplate,
  EmpresaConfig,
  FinancialRecord,
  GeneratedDocument,
  Lead,
  LeadRuleHistoryEntry,
  LegalSource,
  MediaAsset,
  MessageTemplate,
  PaidConsultancyModality,
  Partner,
  PartnerProposal,
  PartnerPublic,
  SiteContent,
  Task,
  UserProfile,
  UserRole,
  ViabilityAssessment,
  VisaCategory,
  VisaRequirement,
} from '../types/domain';
import { registrarAuditoria } from '../utils/audit';
import { computeLeadPriorityAndTemperature, runDiagnosticEngine } from '../utils/diagnosticEngine';
import {
  normalizeCollectionWritePayload,
  sanitizeFirestoreData,
  validateBancarioConfigPayload,
  validateEmpresaConfigPayload,
} from '../utils/firestoreUtils';
import { buildOfficialLegalCatalogDiff } from '../utils/legalSync';
import {
  loadRuleEngineSnapshotSync,
  saveRuleEngineSnapshot,
  type CatalogSyncSource,
  type PendingOfflineDiagnostic,
  type RuleEngineDecisionLog,
} from '../utils/offlineRuleEngineStore';
import { reportAppError } from './errorService';

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function stripUndefined<T>(val: T): T {
  return sanitizeFirestoreData(val);
}

function isEffectiveAdmin(role?: UserRole): boolean {
  return role === 'admin' || isPrimaryAdminEmail(auth.currentUser?.email);
}

// =============================================================================
// Public Readers (Safe without login)
// =============================================================================
const LEGACY_IMAGE_REPLACEMENTS: Record<string, string> = {
  '/src/assets/images/quem_somos_founder_1794944012517.jpg': '/src/assets/images/quem_somos_founder_1794993847940.jpg',
  '/src/assets/images/about_consultoria_office_1794944011861.jpg': '/src/assets/images/about_consultoria_office_1794997278170.jpg',
  '/src/assets/images/service_relocation_chile_1794944013551.jpg': '/src/assets/images/service_relocation_chile_1794997277886.jpg',
};
const LEGACY_FORMACAO_VALUES = new Set([
  'Especialização em Direito Migratório Comparado Brasil–Chile, Gestão de Mobilidade Global e Conformidade LGPD.',
  'Especialização em Direito Migratório Comparado Brasil–Chile e Gestão de Mobilidade Internacional.',
]);
const CURRENT_FORMACAO_TITULO = 'Formação Acadêmica e Qualificação Jurídica';
const CURRENT_FORMACAO_TEXT =
  'Bacharel em Direito (Graduação de Nível Superior)\nEspecialista (Pós-graduação Lato Sensu) em Direito Penal e Processo Penal\nSólida base jurídica com foco em legislação penal, conformidade normativa e análise processual.';
const LEGACY_EXPERIENCIA_VALUES = new Set([
  'Mais de 8 anos conduzindo processos de Residência Temporal, Acordo Mercosul, Reunificação Familiar e Relocation Executivo em Santiago.',
  'Assessoria completa em Residência Temporal, Acordo Mercosul, Residência Definitiva e Relocation em Santiago.',
]);
const CURRENT_EXPERIENCIA_TITULO = 'Especialização e Escopo de Atuação';
const CURRENT_EXPERIENCIA_TEXT =
  'Com base e atendimento no Brasil, prestamos assessoria completa e fundamentada na legislação migratória vigente para trâmites de Residência Temporal, Acordo Mercosul, Reunificação Familiar e Relocation em qualquer região do Chile.\nAtuação pautada pela análise criteriosa de requisitos, preparação documental prévia à mudança e mitigação de riscos administrativos.';
const LEGACY_ENDERECO_CIDADE = 'Santiago, Chile · Atendimento Brasil & Chile';
const CURRENT_ENDERECO_CIDADE = 'Brasil · Atendimento para todo o Chile';
const LEGACY_RAZAO_SOCIAL = 'D&M Integra Consultoria Ltda. · CNPJ/RUT a configurar';
const LEGACY_RESPONSAVEL_TECNICO = 'Equipe Técnica D&M Integra Chile';
const LEGACY_TERMO_LGPD_LINE = '1. Controlador: D&M Integra Chile – Relocation & Assessoria.';
const CURRENT_TERMO_LGPD_LINE =
  '1. Controlador: D&M Integra Chile – Relocation & Assessoria (atuação autônoma como Pessoa Física sob marca própria).';

function normalizeEmpresaConfig(data: Partial<EmpresaConfig>): EmpresaConfig {
  const textoContratoPadrao =
    typeof data.textoContratoPadrao === 'string' && data.textoContratoPadrao.includes('inscrita sob CNPJ/RUT {{empresa_doc}}')
      ? DEFAULT_CONTRATO_TEMPLATE
      : data.textoContratoPadrao || DEFAULT_EMPRESA_CONFIG.textoContratoPadrao;

  const termoLgpd =
    typeof data.termoLgpd === 'string' && data.termoLgpd.includes(LEGACY_TERMO_LGPD_LINE)
      ? data.termoLgpd.replace(LEGACY_TERMO_LGPD_LINE, CURRENT_TERMO_LGPD_LINE)
      : data.termoLgpd || DEFAULT_EMPRESA_CONFIG.termoLgpd;

  const normalized: EmpresaConfig = {
    ...DEFAULT_EMPRESA_CONFIG,
    ...data,
    logoUrl: resolveOfficialBrandUrl(data.logoUrl, 'light'),
    logoDarkUrl: resolveOfficialBrandUrl(data.logoDarkUrl, 'dark'),
    faviconUrl: resolveOfficialBrandUrl(data.faviconUrl, 'favicon'),
    razao_social_cnpj_rut:
      !data.razao_social_cnpj_rut || data.razao_social_cnpj_rut === LEGACY_RAZAO_SOCIAL
        ? DEFAULT_EMPRESA_CONFIG.razao_social_cnpj_rut
        : data.razao_social_cnpj_rut,
    responsavel_tecnico:
      !data.responsavel_tecnico || data.responsavel_tecnico === LEGACY_RESPONSAVEL_TECNICO
        ? DEFAULT_EMPRESA_CONFIG.responsavel_tecnico
        : data.responsavel_tecnico,
    endereco_cidade:
      !data.endereco_cidade || data.endereco_cidade === LEGACY_ENDERECO_CIDADE
        ? CURRENT_ENDERECO_CIDADE
        : data.endereco_cidade,
    textoContratoPadrao,
    termoLgpd,
    layoutConfig: {
      ...(DEFAULT_EMPRESA_CONFIG.layoutConfig || {}),
      ...(data.layoutConfig || {}),
    },
  };
  if (data.siteDraft) {
    normalized.siteDraft = normalizeSiteContentAssets(data.siteDraft);
  } else {
    delete normalized.siteDraft;
  }
  return sanitizeFirestoreData(normalized);
}

function getUpgradedDocumentTemplateHtml(tpl: Partial<DocumentTemplate>): string | null {
  const html = typeof tpl.conteudoHtml === 'string' ? tpl.conteudoHtml : '';
  if (!html) return null;

  const seedMatch = (id: string) => SEED_DOCUMENT_TEMPLATES.find((s) => s.id === id)?.conteudoHtml || null;

  if ((tpl.id === 'doc_contrato' || tpl.codigo === 'contrato_consultoria') && html.includes('inscrita sob CNPJ/RUT {{empresa_doc}}')) {
    return seedMatch('doc_contrato');
  }
  if ((tpl.id === 'doc_recibo' || tpl.codigo === 'recibo_oficial') && html.includes('CNPJ/RUT: {{empresa_doc}}')) {
    return seedMatch('doc_recibo');
  }
  if ((tpl.id === 'doc_aditivo' || tpl.codigo === 'aditivo_contratual') && html.includes('CONTRATADA {{empresa_nome}} acordam')) {
    return seedMatch('doc_aditivo');
  }
  if (
    (tpl.id === 'doc_procuracao_simples' || tpl.codigo === 'procuracao_autorizacao') &&
    html.includes('autorizo {{empresa_nome}} ({{empresa_responsavel}})')
  ) {
    return seedMatch('doc_procuracao_simples');
  }
  if ((tpl.id === 'doc_termo_lgpd' || tpl.codigo === 'termo_lgpd') && html.includes('Controlador: {{empresa_nome}} ({{empresa_doc}})')) {
    return seedMatch('doc_termo_lgpd');
  }
  return null;
}

function normalizeDocumentTemplates(rows: DocumentTemplate[]): DocumentTemplate[] {
  return rows.map((row) => {
    const upgraded = getUpgradedDocumentTemplateHtml(row);
    return upgraded ? { ...row, conteudoHtml: upgraded } : row;
  });
}

function normalizeSiteContentAssets(rows: SiteContent[]): SiteContent[] {
  return rows.map((row) => {
    let next = row;
    const replacementImg = next.imagemUrl ? LEGACY_IMAGE_REPLACEMENTS[next.imagemUrl] : undefined;
    if (replacementImg) {
      next = { ...next, imagemUrl: replacementImg };
    }
    if (next.secao === 'quem_somos' && next.metadados) {
      const meta = { ...next.metadados };
      let changed = false;
      const formacaoAtual = String(meta.formacao || '').trim();
      if (!formacaoAtual || LEGACY_FORMACAO_VALUES.has(formacaoAtual)) {
        meta.formacaoTitulo = String(meta.formacaoTitulo || CURRENT_FORMACAO_TITULO);
        meta.formacao = CURRENT_FORMACAO_TEXT;
        changed = true;
      }
      const experienciaAtual = String(meta.experiencia || '').trim();
      if (!experienciaAtual || LEGACY_EXPERIENCIA_VALUES.has(experienciaAtual)) {
        meta.experienciaTitulo = String(meta.experienciaTitulo || CURRENT_EXPERIENCIA_TITULO);
        meta.experiencia = CURRENT_EXPERIENCIA_TEXT;
        changed = true;
      }
      if (changed) {
        next = { ...next, metadados: meta };
      }
    }
    return next;
  });
}

export async function fetchEmpresaConfig(): Promise<EmpresaConfig> {
  try {
    const snap = await getDoc(doc(db, 'config', 'empresa'));
    if (snap.exists()) {
      return normalizeEmpresaConfig(snap.data() as Partial<EmpresaConfig>);
    }
    return DEFAULT_EMPRESA_CONFIG;
  } catch {
    return DEFAULT_EMPRESA_CONFIG;
  }
}

export async function fetchSiteContentPublic(): Promise<SiteContent[]> {
  try {
    const q = query(collection(db, 'siteContent'), where('ativo', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return SEED_SITE_CONTENT;
    const rows = normalizeSiteContentAssets(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SiteContent, 'id'>) })),
    );
    return rows.sort((a, b) => a.ordem - b.ordem);
  } catch {
    return SEED_SITE_CONTENT;
  }
}

export async function fetchAllSiteContentStaff(): Promise<SiteContent[]> {
  try {
    const snap = await getDocs(collection(db, 'siteContent'));
    if (snap.empty) return SEED_SITE_CONTENT;
    const rows = normalizeSiteContentAssets(
      snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SiteContent, 'id'>) })),
    );
    return rows.sort((a, b) => a.ordem - b.ordem);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'siteContent');
  }
}

export async function fetchPartnersPublic(): Promise<PartnerPublic[]> {
  try {
    const q = query(
      collection(db, 'partnersPublic'),
      where('recomendadoAosClientes', '==', true),
      where('statusHomologacao', '==', 'Ativo/Indicado'),
    );
    const snap = await getDocs(q);
    if (snap.empty) return SEED_PARTNERS.map((p) => p.pub);
    const firestorePartners = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PartnerPublic, 'id'>),
    }));
    // If Firestore holds only the initial 3 legacy seed partners (only 1 in Chile),
    // merge missing curated Chile relocation partners by ID so the interactive map has rich coverage
    // without ever overwriting admin-edited partners.
    const existingIds = new Set(firestorePartners.map((p) => p.id));
    const chileCount = firestorePartners.filter((p) => p.pais === 'Chile' || p.pais === 'Ambos').length;
    if (chileCount < 2) {
      const missingChileSeeds = SEED_PARTNERS.map((p) => p.pub).filter(
        (seed) => !existingIds.has(seed.id) && (seed.pais === 'Chile' || seed.pais === 'Ambos'),
      );
      return [...firestorePartners, ...missingChileSeeds];
    }
    return firestorePartners;
  } catch {
    return SEED_PARTNERS.map((p) => p.pub);
  }
}

export async function fetchVisaCatalogPublic(): Promise<{
  categories: VisaCategory[];
  requirements: VisaRequirement[];
  legalSources: LegalSource[];
}> {
  try {
    const [catSnap, reqSnap, legSnap] = await Promise.all([
      getDocs(query(collection(db, 'visaCategories'), where('ativo', '==', true))),
      getDocs(query(collection(db, 'visaRequirements'), where('peso', '>=', 1))),
      getDocs(query(collection(db, 'legalSources'), where('statusVigencia', 'in', ['Vigente', 'Alterada', 'Revogada', 'A verificar']))),
    ]);
    const categories = catSnap.empty
      ? SEED_VISA_CATEGORIES
      : catSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisaCategory, 'id'>) }));
    const requirements = reqSnap.empty
      ? SEED_VISA_REQUIREMENTS
      : reqSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisaRequirement, 'id'>) }));
    const legalSources = legSnap.empty
      ? SEED_LEGAL_SOURCES
      : legSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LegalSource, 'id'>) }));

    // Auto-reparar código 15 (Reciprocidade Internacional/Mercosul) sempre como Verificado
    const mercosulSeed = SEED_VISA_CATEGORIES.find((v) => v.codigo === '15')!;
    const repairedCategories = categories.map((c) => (c.codigo === '15' ? { ...c, ...mercosulSeed, id: c.id } : c));
    return { categories: repairedCategories, requirements, legalSources };
  } catch {
    return {
      categories: SEED_VISA_CATEGORIES,
      requirements: SEED_VISA_REQUIREMENTS,
      legalSources: SEED_LEGAL_SOURCES,
    };
  }
}

export async function fetchActiveDiagnosticRules(): Promise<DiagnosticRuleVersion> {
  try {
    const q = query(collection(db, 'diagnosticRuleVersions'), where('ativa', '==', true));
    const snap = await getDocs(q);
    if (snap.empty) return DEFAULT_DIAGNOSTIC_RULE_VERSION;
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DiagnosticRuleVersion, 'id'>) }));
    rows.sort((a, b) => (b.dataPublicacao || '').localeCompare(a.dataPublicacao || ''));
    return rows[0] || DEFAULT_DIAGNOSTIC_RULE_VERSION;
  } catch {
    return DEFAULT_DIAGNOSTIC_RULE_VERSION;
  }
}

export async function fetchAllDiagnosticRuleVersions(): Promise<DiagnosticRuleVersion[]> {
  try {
    const snap = await getDocs(collection(db, 'diagnosticRuleVersions'));
    if (snap.empty) return [DEFAULT_DIAGNOSTIC_RULE_VERSION];
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DiagnosticRuleVersion, 'id'>) }));
    return rows.sort((a, b) => (b.createdAt || b.dataPublicacao || '').localeCompare(a.createdAt || a.dataPublicacao || ''));
  } catch {
    return [DEFAULT_DIAGNOSTIC_RULE_VERSION];
  }
}

export async function publishDiagnosticRuleVersion(
  nextVersion: DiagnosticRuleVersion,
  previousActiveVersion: DiagnosticRuleVersion | null,
  role: UserRole,
): Promise<void> {
  if (!isEffectiveAdmin(role)) throw new Error('Somente administradores podem publicar versões de regras.');
  const now = new Date().toISOString();
  const payload: DiagnosticRuleVersion = sanitizeFirestoreData({
    ...nextVersion,
    ativa: true,
    createdAt: nextVersion.createdAt || now,
  });
  await executeValidatedAdminWrite(`diagnosticRuleVersions/${nextVersion.id}`, OperationType.WRITE, async () => {
    const existingVersions = await fetchAllDiagnosticRuleVersions().catch(() => []);
    await Promise.all(
      existingVersions
        .filter((v) => v.ativa && v.id !== nextVersion.id)
        .map((v) =>
          setDoc(doc(db, 'diagnosticRuleVersions', v.id), sanitizeFirestoreData({ ...v, ativa: false }), { merge: true }),
        ),
    );
    await setDoc(doc(db, 'diagnosticRuleVersions', nextVersion.id), payload);
  });
  await registrarAuditoria(
    'Publicar Versão Regras',
    'diagnosticRuleVersions',
    nextVersion.id,
    'versao_regras',
    previousActiveVersion ? { versao: previousActiveVersion.versao, regrasCount: previousActiveVersion.regras.length } : null,
    { versao: payload.versao, resumoMudanca: payload.resumoMudanca, publicadoPor: payload.publicadoPor },
    'admin',
  );
}

// =============================================================================
// Idempotent Admin Seed & Auto-repair Cód. 15
// =============================================================================
export async function runIdempotentSeedsIfAdmin(role: UserRole): Promise<void> {
  if (!isEffectiveAdmin(role)) return;
  try {
    const cfgRef = doc(db, 'config', 'empresa');
    const cfgSnap = await getDoc(cfgRef);
    if (!cfgSnap.exists()) {
      await setDoc(cfgRef, validateEmpresaConfigPayload(DEFAULT_EMPRESA_CONFIG));
    } else {
      const data = cfgSnap.data() as Partial<EmpresaConfig>;
      const cfgPatch: Record<string, unknown> = {};
      if (data.razao_social_cnpj_rut === LEGACY_RAZAO_SOCIAL) {
        cfgPatch.razao_social_cnpj_rut = DEFAULT_EMPRESA_CONFIG.razao_social_cnpj_rut;
      }
      if (data.responsavel_tecnico === LEGACY_RESPONSAVEL_TECNICO) {
        cfgPatch.responsavel_tecnico = DEFAULT_EMPRESA_CONFIG.responsavel_tecnico;
      }
      if (data.endereco_cidade === LEGACY_ENDERECO_CIDADE) {
        cfgPatch.endereco_cidade = CURRENT_ENDERECO_CIDADE;
      }
      if (typeof data.textoContratoPadrao === 'string' && data.textoContratoPadrao.includes('inscrita sob CNPJ/RUT {{empresa_doc}}')) {
        cfgPatch.textoContratoPadrao = DEFAULT_CONTRATO_TEMPLATE;
      }
      if (typeof data.termoLgpd === 'string' && data.termoLgpd.includes(LEGACY_TERMO_LGPD_LINE)) {
        cfgPatch.termoLgpd = data.termoLgpd.replace(LEGACY_TERMO_LGPD_LINE, CURRENT_TERMO_LGPD_LINE);
      }
      if (isLegacyOrBrokenBrandUrl(data.logoUrl)) {
        cfgPatch.logoUrl = BRAND_ASSETS.logoLightPng;
        cfgPatch.layoutConfig = {
          ...(DEFAULT_EMPRESA_CONFIG.layoutConfig || {}),
          ...(data.layoutConfig || {}),
          logoAlturaPx: Math.max(44, Number(data.layoutConfig?.logoAlturaPx || 46)),
          mostrarNomeComLogo: false,
        };
      }
      if (isLegacyOrBrokenBrandUrl(data.logoDarkUrl)) {
        cfgPatch.logoDarkUrl = BRAND_ASSETS.logoDarkPng;
      }
      if (isLegacyOrBrokenBrandUrl(data.faviconUrl)) {
        cfgPatch.faviconUrl = BRAND_ASSETS.emblemLightSvg;
      }
      if (Array.isArray(data.siteDraft) && data.siteDraft.some((s) => s?.imagemUrl && Boolean(LEGACY_IMAGE_REPLACEMENTS[s.imagemUrl]))) {
        cfgPatch.siteDraft = normalizeSiteContentAssets(data.siteDraft);
      }
      if (Object.keys(cfgPatch).length > 0) {
        const mergedValidated = validateEmpresaConfigPayload({
          ...data,
          ...cfgPatch,
        } as Partial<EmpresaConfig>);
        await setDoc(cfgRef, mergedValidated);
      }
    }

    const siteSnap = await getDocs(collection(db, 'siteContent'));
    if (siteSnap.empty) {
      await Promise.all(
        SEED_SITE_CONTENT.map((s) => setDoc(doc(db, 'siteContent', s.id), { ...s, updatedAt: new Date().toISOString() })),
      );
    } else {
      const docsToUpgrade = siteSnap.docs.filter((d) => {
        const data = d.data() as Partial<SiteContent>;
        const hasLegacyImg = Boolean(data.imagemUrl && LEGACY_IMAGE_REPLACEMENTS[data.imagemUrl]);
        const meta = (data.metadados || {}) as Record<string, unknown>;
        const formacaoAtual = String(meta.formacao || '').trim();
        const experienciaAtual = String(meta.experiencia || '').trim();
        const hasLegacyFormacao =
          data.secao === 'quem_somos' && (!formacaoAtual || LEGACY_FORMACAO_VALUES.has(formacaoAtual));
        const hasLegacyExperiencia =
          data.secao === 'quem_somos' && (!experienciaAtual || LEGACY_EXPERIENCIA_VALUES.has(experienciaAtual));
        return hasLegacyImg || hasLegacyFormacao || hasLegacyExperiencia;
      });
      if (docsToUpgrade.length > 0) {
        await Promise.all(
          docsToUpgrade.map((d) => {
            const data = d.data() as Partial<SiteContent>;
            const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
            const replacementImg = data.imagemUrl ? LEGACY_IMAGE_REPLACEMENTS[data.imagemUrl] : undefined;
            if (replacementImg) {
              patch.imagemUrl = replacementImg;
            }
            const meta = { ...((data.metadados || {}) as Record<string, unknown>) };
            let metaChanged = false;
            const formacaoAtual = String(meta.formacao || '').trim();
            if (data.secao === 'quem_somos' && (!formacaoAtual || LEGACY_FORMACAO_VALUES.has(formacaoAtual))) {
              meta.formacaoTitulo = meta.formacaoTitulo || CURRENT_FORMACAO_TITULO;
              meta.formacao = CURRENT_FORMACAO_TEXT;
              metaChanged = true;
            }
            const experienciaAtual = String(meta.experiencia || '').trim();
            if (data.secao === 'quem_somos' && (!experienciaAtual || LEGACY_EXPERIENCIA_VALUES.has(experienciaAtual))) {
              meta.experienciaTitulo = meta.experienciaTitulo || CURRENT_EXPERIENCIA_TITULO;
              meta.experiencia = CURRENT_EXPERIENCIA_TEXT;
              metaChanged = true;
            }
            if (metaChanged) {
              patch.metadados = meta;
            }
            return updateDoc(doc(db, 'siteContent', d.id), patch);
          }),
        );
      }
    }

    // Sempre auto-reparar Cód. 15
    const mercosul = SEED_VISA_CATEGORIES.find((v) => v.codigo === '15')!;
    await setDoc(doc(db, 'visaCategories', mercosul.id), { ...mercosul, updatedAt: new Date().toISOString() }, { merge: true });

    const visaSnap = await getDocs(collection(db, 'visaCategories'));
    if (visaSnap.size < 3) {
      await Promise.all(
        SEED_VISA_CATEGORIES.map((v) =>
          setDoc(doc(db, 'visaCategories', v.id), { ...v, updatedAt: new Date().toISOString() }, { merge: true }),
        ),
      );
    }

    const reqSnap = await getDocs(collection(db, 'visaRequirements'));
    if (reqSnap.empty) {
      await Promise.all(SEED_VISA_REQUIREMENTS.map((r) => setDoc(doc(db, 'visaRequirements', r.id), r)));
    }

    const legSnap = await getDocs(collection(db, 'legalSources'));
    if (legSnap.empty) {
      await Promise.all(
        SEED_LEGAL_SOURCES.map((l) => setDoc(doc(db, 'legalSources', l.id), { ...l, updatedAt: new Date().toISOString() })),
      );
    } else {
      const existingLegIds = new Set(legSnap.docs.map((d) => d.id));
      const missingSeeds = SEED_LEGAL_SOURCES.filter((s) => !existingLegIds.has(s.id));
      if (missingSeeds.length > 0) {
        await Promise.all(
          missingSeeds.map((l) => setDoc(doc(db, 'legalSources', l.id), { ...l, updatedAt: new Date().toISOString() })),
        );
      }
    }

    const msgSnap = await getDocs(collection(db, 'messageTemplates'));
    if (msgSnap.empty) {
      await Promise.all(SEED_MESSAGE_TEMPLATES.map((m) => setDoc(doc(db, 'messageTemplates', m.id), m)));
    }

    const docTplSnap = await getDocs(collection(db, 'documentTemplates'));
    if (docTplSnap.empty) {
      await Promise.all(SEED_DOCUMENT_TEMPLATES.map((dt) => setDoc(doc(db, 'documentTemplates', dt.id), dt)));
    } else {
      const tplsToUpgrade = docTplSnap.docs
        .map((d) => ({
          id: d.id,
          upgradedHtml: getUpgradedDocumentTemplateHtml({ id: d.id, ...(d.data() as Partial<DocumentTemplate>) }),
        }))
        .filter((item): item is { id: string; upgradedHtml: string } => Boolean(item.upgradedHtml));
      if (tplsToUpgrade.length > 0) {
        await Promise.all(
          tplsToUpgrade.map((item) =>
            updateDoc(doc(db, 'documentTemplates', item.id), {
              conteudoHtml: item.upgradedHtml,
            }),
          ),
        );
      }
    }

    const partPubSnap = await getDocs(collection(db, 'partnersPublic'));
    const existingPartnerIds = new Set(partPubSnap.docs.map((d) => d.id));
    const missingSeedPartners = SEED_PARTNERS.filter((p) => !existingPartnerIds.has(p.pub.id));
    if (partPubSnap.empty || missingSeedPartners.length > 0) {
      const targets = partPubSnap.empty ? SEED_PARTNERS : missingSeedPartners;
      await Promise.all(
        targets.flatMap((p) => [
          setDoc(doc(db, 'partners', p.full.id), { ...p.full, createdAt: new Date().toISOString() }),
          setDoc(doc(db, 'partnersPublic', p.pub.id), { ...p.pub, updatedAt: new Date().toISOString() }),
        ]),
      );
    }

    const rulesSnap = await getDocs(collection(db, 'diagnosticRuleVersions'));
    if (rulesSnap.empty) {
      await setDoc(doc(db, 'diagnosticRuleVersions', DEFAULT_DIAGNOSTIC_RULE_VERSION.id), {
        ...DEFAULT_DIAGNOSTIC_RULE_VERSION,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn('Aviso ao executar seed idempotente:', err);
  }
}

// =============================================================================
// Public Submissions
// =============================================================================
export async function submitPartnerProposalPublic(
  payload: Omit<PartnerProposal, 'id' | 'status' | 'createdAt'> & { honeypot?: string },
): Promise<string> {
  const id = makeId('prop');
  try {
    await setDoc(
      doc(db, 'partnerProposals', id),
      sanitizeFirestoreData({
        ...payload,
        id,
        status: 'Nova',
        createdAt: new Date().toISOString(),
      }),
    );
    return id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `partnerProposals/${id}`);
  }
}

export function generateSecureSessionToken(): string {
  const bytes = new Uint8Array(18);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return 'sess_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function saveDiagnosticSession(
  token: string,
  payload: Omit<DiagnosticSession, 'id' | 'updatedAt' | 'createdAt'> & { createdAt?: string },
  isNew: boolean,
): Promise<DiagnosticSession> {
  const now = new Date().toISOString();
  const session: DiagnosticSession = stripUndefined({
    id: token,
    etapaAtual: payload.etapaAtual,
    answers: payload.answers,
    concluido: payload.concluido,
    leadId: payload.leadId || '',
    expiraEmMs: payload.expiraEmMs,
    utm: payload.utm,
    createdAt: payload.createdAt || now,
    updatedAt: now,
  });
  const writePayload: Record<string, unknown> = { ...session };
  if (!isNew && !payload.createdAt) {
    delete writePayload.createdAt;
  }
  await setDoc(doc(db, 'diagnosticSessions', token), writePayload, { merge: !isNew });
  return session;
}

export async function fetchDiagnosticSessionByToken(token: string): Promise<DiagnosticSession | null> {
  if (!token || token.length < 20) return null;
  try {
    const snap = await getDoc(doc(db, 'diagnosticSessions', token));
    if (!snap.exists()) return null;
    const data = snap.data() as DiagnosticSession;
    if (data.expiraEmMs && data.expiraEmMs <= Date.now()) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function submitDiagnosticLeadPublic(
  payload: Omit<Lead, 'id' | 'createdAt' | 'statusFunil'>,
  options?: { existingLeadId?: string; createdAt?: string },
): Promise<{ leadId: string; createdAt?: string }> {
  const now = new Date().toISOString();
  const existingId = options?.existingLeadId && options.existingLeadId !== 'local-preview' ? options.existingLeadId : '';
  const id = existingId || makeId('lead');
  const createdAt = options?.createdAt || (existingId ? undefined : now);
  const docPayload: Record<string, unknown> = stripUndefined({
    ...payload,
    id,
    statusFunil: 'Novo',
    createdAt,
    updatedAt: now,
  });
  try {
    if (existingId) {
      // Nunca sobrescreve notas nem createdAt original ao atualizar publicamente (exigido pelas regras Firestore)
      delete docPayload.notas;
      delete docPayload.createdAt;
      await setDoc(doc(db, 'leads', id), docPayload, { merge: true });
    } else {
      await setDoc(doc(db, 'leads', id), docPayload);
    }
    return { leadId: id, createdAt };
  } catch (err) {
    handleFirestoreError(err, existingId ? OperationType.UPDATE : OperationType.CREATE, `leads/${id}`);
  }
}

export async function recalculateLeadsWithRules(
  targetLeads: Lead[],
  ruleVersion: DiagnosticRuleVersion,
  categories: VisaCategory[],
  requirements: VisaRequirement[],
  legalSources: LegalSource[],
  empresa: EmpresaConfig,
  role: UserRole,
): Promise<number> {
  let updatedCount = 0;
  const now = new Date().toISOString();
  for (const lead of targetLeads) {
    if (!lead.respostasTriagem) continue;
    const diag = runDiagnosticEngine(lead.respostasTriagem, categories, requirements, legalSources, {
      ruleVersion,
      custosPadrao: empresa.custosPadrao,
      honorariosMinBrl: ruleVersion.honorariosMinBrl ?? empresa.honorariosPadraoMinBrl,
      honorariosMaxBrl: ruleVersion.honorariosMaxBrl ?? empresa.honorariosPadraoMaxBrl,
      taxaCambioBrlClp: ruleVersion.taxaCambioBrlClp ?? empresa.taxaCambioBrlClp,
      taxaCambioUsdBrl: ruleVersion.taxaCambioUsdBrl ?? empresa.taxaCambioUsdBrl,
    });
    if (!diag.recomendada) continue;
    const prevEntry: LeadRuleHistoryEntry = {
      versaoRegras: lead.versaoRegras || 'anterior',
      dataCalculo: lead.updatedAt || lead.createdAt,
      subcategoriaSugerida: lead.subcategoriaSugerida || lead.interesse || '—',
      notaViabilidade: lead.notaViabilidade ?? 0,
      confianca: lead.confianca || 'Média',
    };
    const nextHist = [...(lead.historicoResultados || []), prevEntry];
    const { prioridade, temperatura } = computeLeadPriorityAndTemperature(lead.respostasTriagem, diag);
    await saveDocumentAudited(
      'leads',
      lead.id,
      {
        ...lead,
        subcategoriaSugerida: `${diag.recomendada.visa.codigo} - ${diag.recomendada.visa.nomePortugues}`,
        interesse: diag.recomendada.visa.nomePortugues,
        notaViabilidade: diag.viabilidade.total,
        confianca: diag.confianca,
        temperatura,
        prioridade,
        flagsRisco: diag.flagsRisco.map((f) => f.pergunta),
        versaoRegras: ruleVersion.versao,
        historicoResultados: nextHist,
        updatedAt: now,
      },
      false,
      role,
      'recalculo_regras_diagnostico',
      { subcategoria: lead.subcategoriaSugerida, nota: lead.notaViabilidade, versao: lead.versaoRegras },
    );
    updatedCount += 1;
  }
  return updatedCount;
}

export async function syncDiagnosticFollowUpTasks(
  leads: Lead[],
  existingTasks: Task[],
  role: UserRole,
): Promise<number> {
  if (role !== 'admin' && role !== 'consultor' && role !== 'assistente') return 0;
  let created = 0;
  const existingTitles = new Set(existingTasks.map((t) => t.titulo));
  const nowMs = Date.now();

  for (const lead of leads) {
    if (lead.statusFunil === 'Fechado' || lead.statusFunil === 'Perdido') continue;

    // Lead que abandonou após informar contato -> Task "Retomar contato"
    if (lead.statusConclusao === 'Abandonado') {
      const title = `Retomar contato (abandono Etapa ${lead.etapaAtual || 1}): ${lead.nome}`;
      if (!existingTitles.has(title)) {
        const taskId = makeId('task');
        await saveDocumentAudited(
          'tasks',
          taskId,
          {
            id: taskId,
            titulo: title,
            descricao: `WhatsApp: ${lead.whatsapp} · E-mail: ${lead.email}. Lead interrompeu o diagnóstico antes da conclusão (sem envio automático externo).`,
            prazo: new Date(nowMs + 4 * 3600000).toISOString().slice(0, 10),
            prioridade: 'Alta',
            status: 'Pendente',
            createdAt: new Date().toISOString(),
          },
          true,
          role,
          'task_abandono_diagnostico',
        );
        existingTitles.add(title);
        created += 1;
      }
      continue;
    }

    // Leads concluídos em status 'Novo' -> Lembretes de follow-up 24h e 72h
    if (lead.statusFunil === 'Novo' && (!lead.statusConclusao || lead.statusConclusao === 'Concluído')) {
      const baseTs = Date.parse(lead.createdAt || '') || nowMs;
      const t24 = `Follow-up 24h diagnóstico: ${lead.nome}`;
      const t72 = `Follow-up 72h diagnóstico: ${lead.nome}`;
      if (!existingTitles.has(t24)) {
        const id24 = makeId('task');
        await saveDocumentAudited(
          'tasks',
          id24,
          {
            id: id24,
            titulo: t24,
            descricao: `Subcategoria: ${lead.subcategoriaSugerida || lead.interesse}. Contato: ${lead.whatsapp}.`,
            responsavelId: lead.responsavelId || '',
            prazo: new Date(baseTs + 24 * 3600000).toISOString().slice(0, 10),
            prioridade: lead.prioridade === 'Urgente' || lead.prioridade === 'Alta' ? 'Alta' : 'Média',
            status: 'Pendente',
            createdAt: new Date().toISOString(),
          },
          true,
          role,
          'task_followup_24h',
        );
        existingTitles.add(t24);
        created += 1;
      }
      if (!existingTitles.has(t72)) {
        const id72 = makeId('task');
        await saveDocumentAudited(
          'tasks',
          id72,
          {
            id: id72,
            titulo: t72,
            descricao: `Segundo acompanhamento do diagnóstico (${lead.subcategoriaSugerida || lead.interesse}). WhatsApp: ${lead.whatsapp}.`,
            responsavelId: lead.responsavelId || '',
            prazo: new Date(baseTs + 72 * 3600000).toISOString().slice(0, 10),
            prioridade: 'Média',
            status: 'Pendente',
            createdAt: new Date().toISOString(),
          },
          true,
          role,
          'task_followup_72h',
        );
        existingTitles.add(t72);
        created += 1;
      }
    }
  }
  return created;
}

export async function convertLeadToClientAndCaseEnhanced(params: {
  lead: Lead;
  clients: Client[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeRules: DiagnosticRuleVersion;
  empresa: EmpresaConfig;
  role: UserRole;
  autorNome: string;
  modalidadeConsultoria?: PaidConsultancyModality;
}): Promise<{ clientId: string; caseId: string; clientReused: boolean; docsCount: number; tasksCount: number }> {
  const {
    lead,
    clients,
    visaCategories,
    visaRequirements,
    legalSources,
    activeRules,
    empresa,
    role,
    autorNome,
    modalidadeConsultoria,
  } = params;
  const chosenModality: PaidConsultancyModality = modalidadeConsultoria || lead.modalidadeInteresse || 'completa';
  const cleanPhone = (p: string) => p.replace(/\D/g, '');
  const existingClient = clients.find(
    (c) =>
      c.email.toLowerCase() === lead.email.toLowerCase() ||
      (cleanPhone(c.whatsapp) && cleanPhone(c.whatsapp) === cleanPhone(lead.whatsapp)),
  );

  let clientId = existingClient?.id;
  if (!clientId) {
    clientId = makeId('cli');
    const newClient: Client = {
      id: clientId,
      nomeCompleto: lead.nome,
      cpf: '',
      email: lead.email.trim().toLowerCase(),
      whatsapp: lead.whatsapp,
      enderecoCompleto: lead.cidadeUf,
      objetivoChile: lead.interesse,
      portalLiberado: false,
      statusAcessoPortal: 'Pendente liberação',
      modalidadeConsultoria: chosenModality,
      lgpdAceito: lead.lgpdAceito,
      lgpdAceitoEm: lead.lgpdData,
      lgpdVersao: lead.lgpdVersao,
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('clients', clientId, newClient as unknown as Record<string, unknown>, true, role, 'conversao_lead');
  } else if (existingClient && existingClient.modalidadeConsultoria !== chosenModality) {
    await saveDocumentAudited(
      'clients',
      existingClient.id,
      { ...existingClient, modalidadeConsultoria: chosenModality },
      false,
      role,
      'modalidadeConsultoria',
      existingClient.modalidadeConsultoria,
    );
  }

  const matchedVisa =
    visaCategories.find((v) => (lead.subcategoriaSugerida || '').startsWith(v.codigo)) ||
    visaCategories.find((v) => v.codigo === '15') ||
    visaCategories[0];

  const caseId = makeId('case');
  const newCase: Case = {
    id: caseId,
    titulo: `${lead.nome} – ${matchedVisa?.nomePortugues || lead.interesse || 'Residência no Chile'}`,
    clientId,
    tipoServico: 'Residência Temporal',
    visaCategoryId: matchedVisa?.id || 'visa_15_mercosul',
    subcategoriaIa: lead.subcategoriaSugerida || '',
    etapaPipeline: 2,
    statusSermig: 'Não protocolado',
    portalLiberado: Boolean(existingClient?.portalLiberado),
    modalidadeConsultoria: chosenModality,
    relatorioViabilidadeLiberado: false,
    prioridade: lead.prioridade || 'Alta',
    notaViabilidadeGeral: lead.notaViabilidade,
    createdAt: new Date().toISOString(),
  };
  await saveDocumentAudited('cases', caseId, newCase as unknown as Record<string, unknown>, true, role, 'conversao_lead');

  // Gerar diagnóstico completo para vincular checklist por pessoa, plano de ação em tarefas e parecer inicial
  const answers: DiagnosticAnswers | undefined = lead.respostasTriagem;
  let docsCount = 0;
  let tasksCount = 0;

  if (answers) {
    const diag = runDiagnosticEngine(answers, visaCategories, visaRequirements, legalSources, {
      ruleVersion: activeRules,
      custosPadrao: empresa.custosPadrao,
      honorariosMinBrl: activeRules.honorariosMinBrl ?? empresa.honorariosPadraoMinBrl,
      honorariosMaxBrl: activeRules.honorariosMaxBrl ?? empresa.honorariosPadraoMaxBrl,
    });

    // Dependentes e checklist por pessoa
    const depNames: string[] = [];
    if (diag.diagnosticoPorPessoa.length > 0) {
      for (const p of diag.diagnosticoPorPessoa) {
        if (p.papel === 'Dependente') {
          depNames.push(p.nome);
          const depId = makeId('dep');
          const depRecord: Dependent = {
            id: depId,
            clientId,
            nomeCompleto: p.nome,
            parentesco:
              p.parentesco.includes('Cônjuge')
                ? 'Cônjuge'
                : p.parentesco.includes('Filho')
                  ? 'Filho(a)'
                  : 'Outro',
          };
          await saveDocumentAudited('dependents', depId, depRecord as unknown as Record<string, unknown>, true, role, 'dependente_lead');
        }
      }
    }

    const pessoasParaChecklist = ['Titular', ...depNames];
    const reqs = visaRequirements.filter((r) => r.visaCategoryId === (matchedVisa?.id || 'visa_15_mercosul'));

    for (const pessoa of pessoasParaChecklist) {
      for (const req of reqs) {
        const docId = makeId('doc');
        const caseDoc: CaseDocument = {
          id: docId,
          caseId,
          clientId,
          pessoa,
          visaRequirementId: req.id,
          nomeDocumento: req.nomeDocumento,
          categoriaDoc: req.categoriaDoc,
          etapaEsteira: '1 Aguardando Envio',
          ordemEmissao: req.ordemPrioridadeEmissao,
          status: 'Pendente',
          validadeDias: req.validadeDias,
          apostilado: false,
          traduzido: false,
          exigeApostila: req.exigeApostila,
          exigeTraducao: req.exigeTraducao,
          obrigatorio: req.obrigatorio,
          peso: req.peso,
          versao: 1,
        };
        await saveDocumentAudited('caseDocuments', docId, caseDoc as unknown as Record<string, unknown>, true, role, 'checklist_lead');
        docsCount += 1;
      }
    }

    // Tarefas do plano de ação (Faça agora + Em 30 dias + Antes do protocolo)
    const allActions = [
      ...diag.planoAcao.facaAgora.slice(0, 3).map((a) => ({ ...a, grupo: 'Faça agora' })),
      ...diag.planoAcao.em30Dias.slice(0, 2).map((a) => ({ ...a, grupo: 'Em 30 dias' })),
      ...diag.planoAcao.antesProtocolo.slice(0, 2).map((a) => ({ ...a, grupo: 'Antes do protocolo' })),
    ];
    for (const act of allActions) {
      const taskId = makeId('task');
      const t: Task = {
        id: taskId,
        titulo: `[${act.grupo}] ${act.titulo}`,
        descricao: act.detalhe,
        caseId,
        clientId,
        prioridade: act.grupo === 'Faça agora' ? 'Alta' : 'Média',
        status: 'Pendente',
        createdAt: new Date().toISOString(),
      };
      await saveDocumentAudited('tasks', taskId, t as unknown as Record<string, unknown>, true, role, 'plano_acao_lead');
      tasksCount += 1;
    }

    // Parecer técnico inicial vinculado ao caso
    const assessmentId = makeId('viab');
    const assessment: ViabilityAssessment = {
      id: assessmentId,
      caseId,
      clientId,
      versao: 1,
      enquadramentoLegal: `Indicação inicial (${diag.versaoRegras.versao}): ${lead.subcategoriaSugerida || matchedVisa?.nomePortugues}. Confiança: ${diag.confianca}.`,
      elegibilidadeRiscos:
        diag.flagsRisco.length > 0
          ? diag.flagsRisco.map((f) => f.pergunta).join('; ')
          : diag.flagsRevisaoConsultor.length > 0
            ? diag.flagsRevisaoConsultor.map((f) => f.label).join('; ')
            : 'Sem flags de risco alto declaradas.',
      fundamentacaoNormativa: diag.fontesLegais.map((f) => `${f.titulo} (${f.numeroAno})`).join(' · '),
      recomendacoes: diag.caminho,
      notaGeral: diag.viabilidade.total,
      rascunhoIa: false,
      liberadoAoCliente: false,
      autorNome,
      createdAt: new Date().toISOString(),
    };
    if (role === 'admin' || role === 'consultor') {
      await saveDocumentAudited('viabilityAssessments', assessmentId, assessment as unknown as Record<string, unknown>, true, role, 'parecer_inicial_lead');
    }
  }

  await saveDocumentAudited(
    'leads',
    lead.id,
    {
      ...lead,
      statusFunil: 'Fechado',
      primeiroContatoEm: lead.primeiroContatoEm || new Date().toISOString(),
      convertedClientId: clientId,
      convertedCaseId: caseId,
    },
    false,
    role,
    'conversao_em_caso',
  );

  return { clientId, caseId, clientReused: Boolean(existingClient), docsCount, tasksCount };
}

// =============================================================================
// Generic Audited CRUD Helpers
// =============================================================================
function isFirestorePermissionError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    raw.includes('permission-denied') ||
    raw.includes('missing or insufficient permissions') ||
    raw.includes('insufficient permissions')
  );
}

export async function saveDocumentAudited<T extends Record<string, unknown>>(
  collectionName: string,
  id: string,
  data: T,
  isNew: boolean,
  actorRole?: UserRole,
  campoLabel = 'registro',
  antes?: unknown,
): Promise<void> {
  const pathStr = `${collectionName}/${id}`;
  const normalized = normalizeCollectionWritePayload(collectionName, id, {
    ...data,
    id,
    updatedAt: new Date().toISOString(),
  });

  // For `cases`, legacy documents may contain `valorContrato`, which `firestore.rules` forbids.
  // Explicitly pass `deleteField()` on merge updates so Firestore purges any legacy key.
  const writePayload: Record<string, unknown> =
    collectionName === 'cases' && !isNew
      ? { ...normalized, valorContrato: deleteField() }
      : normalized;

  const performWrite = async () => {
    const useMerge = !isNew && collectionName !== 'config';
    if (useMerge) {
      await setDoc(doc(db, collectionName, id), writePayload, { merge: true });
    } else {
      await setDoc(doc(db, collectionName, id), normalized);
    }
    await registrarAuditoria(
      isNew ? 'Criar' : 'Atualizar',
      collectionName,
      id,
      campoLabel,
      antes ?? null,
      normalized,
      actorRole,
    );
  };

  try {
    await performWrite();
  } catch (err) {
    const currentUser = auth.currentUser;
    if (isFirestorePermissionError(err) && currentUser) {
      try {
        await currentUser.getIdToken(true);
        if (isPrimaryAdminEmail(currentUser.email)) {
          clearAdminVerificationCache();
          await verifyAndEnsureAdminAccess(currentUser, { force: true });
        }
        await performWrite();
        return;
      } catch (retryErr) {
        handleFirestoreError(retryErr, isNew ? OperationType.CREATE : OperationType.UPDATE, pathStr);
      }
    }
    handleFirestoreError(err, isNew ? OperationType.CREATE : OperationType.UPDATE, pathStr);
  }
}

export async function deleteDocumentAudited(
  collectionName: string,
  id: string,
  actorRole?: UserRole,
  antes?: unknown,
): Promise<void> {
  const pathStr = `${collectionName}/${id}`;
  const performDelete = async () => {
    await deleteDoc(doc(db, collectionName, id));
    await registrarAuditoria('Excluir', collectionName, id, 'registro', antes ?? id, null, actorRole);
  };
  try {
    await performDelete();
  } catch (err) {
    const currentUser = auth.currentUser;
    if (isFirestorePermissionError(err) && currentUser) {
      try {
        await currentUser.getIdToken(true);
        if (isPrimaryAdminEmail(currentUser.email)) {
          clearAdminVerificationCache();
          await verifyAndEnsureAdminAccess(currentUser, { force: true });
        }
        await performDelete();
        return;
      } catch (retryErr) {
        handleFirestoreError(retryErr, OperationType.DELETE, pathStr);
      }
    }
    handleFirestoreError(err, OperationType.DELETE, pathStr);
  }
}

export async function logSensitiveDocumentAccess(
  docItem: Pick<CaseDocument, 'id' | 'caseId' | 'clientId' | 'nomeDocumento' | 'categoriaDoc' | 'pessoa'>,
  action: 'visualizar' | 'baixar',
  role: UserRole,
): Promise<void> {
  if (docItem.categoriaDoc !== 'Antecedentes' && docItem.categoriaDoc !== 'Identidade') return;
  try {
    await registrarAuditoria(
      action === 'baixar' ? 'Download Doc Sensível' : 'Visualização Doc Sensível',
      'caseDocuments',
      docItem.id,
      `acesso_${action}`,
      null,
      {
        caseId: docItem.caseId,
        clientId: docItem.clientId,
        pessoa: docItem.pessoa,
        nomeDocumento: docItem.nomeDocumento,
        categoriaDoc: docItem.categoriaDoc,
      },
      role,
    );
  } catch {
    // non-blocking
  }
}

export async function setClientPortalAccessAudited(params: {
  client: Client;
  portalLiberado: boolean;
  modalidadeConsultoria?: PaidConsultancyModality;
  role: UserRole;
  extraClientFields?: Partial<Client>;
}): Promise<{ userLinked: boolean; syncedCases: number; updatedClient: Client }> {
  const { client, portalLiberado, modalidadeConsultoria, role, extraClientFields } = params;
  if (role !== 'admin' && role !== 'consultor') {
    throw new Error('Apenas Admin ou Consultor podem liberar ou alterar o acesso ao Portal do Cliente.');
  }

  const now = new Date().toISOString();
  const normalizedEmail = (client.email || '').trim().toLowerCase();
  const nextModality: PaidConsultancyModality =
    modalidadeConsultoria || client.modalidadeConsultoria || 'completa';

  // 1. Procura conta Google (users/{uid}) correspondente ao cliente
  let matchedUserUid = client.userId || '';
  let matchedUserData: UserProfile | null = null;

  try {
    if (matchedUserUid) {
      const uSnap = await getDoc(doc(db, 'users', matchedUserUid));
      if (uSnap.exists()) {
        matchedUserData = uSnap.data() as UserProfile;
      } else {
        matchedUserUid = '';
      }
    }

    if (!matchedUserUid && normalizedEmail) {
      const uq = await getDocs(query(collection(db, 'users'), where('email', '==', normalizedEmail)));
      if (!uq.empty) {
        const candidate = uq.docs.find((d) => (d.data() as UserProfile).role === 'cliente') || uq.docs[0];
        matchedUserUid = candidate.id;
        matchedUserData = candidate.data() as UserProfile;
      } else {
        // Fallback case-insensitive em caso de e-mail salvo com maiúsculas no legado
        const allUsersSnap = await getDocs(collection(db, 'users'));
        const foundDoc = allUsersSnap.docs.find((d) => {
          const data = d.data() as UserProfile;
          return data.role === 'cliente' && (data.email || '').trim().toLowerCase() === normalizedEmail;
        });
        if (foundDoc) {
          matchedUserUid = foundDoc.id;
          matchedUserData = foundDoc.data() as UserProfile;
        }
      }
    }
  } catch {
    // Non-blocking: se usuário ainda não criou conta Google, será sincronizado no 1º login
  }

  // 2. Atualiza clients/{clientId} com e-mail normalizado, modalidade e userId vinculado
  const updatedClient: Client = {
    ...client,
    ...extraClientFields,
    email: normalizedEmail || client.email,
    userId: matchedUserUid || client.userId,
    portalLiberado,
    statusAcessoPortal: portalLiberado ? 'Liberado' : 'Pendente liberação',
    modalidadeConsultoria: nextModality,
    updatedAt: now,
  };

  await saveDocumentAudited(
    'clients',
    client.id,
    updatedClient as unknown as Record<string, unknown>,
    false,
    role,
    'portalLiberado',
    {
      portalLiberado: client.portalLiberado,
      statusAcessoPortal: client.statusAcessoPortal,
      modalidadeConsultoria: client.modalidadeConsultoria,
    },
  );

  // 3. Sincroniza users/{uid} se o cliente já fez login alguma vez (somente role === 'cliente')
  let userLinked = false;
  if (matchedUserUid && matchedUserData && matchedUserData.role === 'cliente') {
    try {
      await updateDoc(doc(db, 'users', matchedUserUid), {
        clientId: client.id,
        status: portalLiberado ? 'ativo' : 'pendente',
        updatedAt: now,
      });
      userLinked = true;
    } catch (err) {
      reportAppError(err, {
        source: 'portal-sync-user',
        operation: OperationType.UPDATE,
        path: `users/${matchedUserUid}`,
      });
    }
  }

  // 4. Sincroniza os casos vinculados ao cliente
  let syncedCases = 0;
  try {
    const casesSnap = await getDocs(query(collection(db, 'cases'), where('clientId', '==', client.id)));
    for (const cDoc of casesSnap.docs) {
      const cData = cDoc.data() as Case;
      if (cData.portalLiberado !== portalLiberado || cData.modalidadeConsultoria !== nextModality) {
        await updateDoc(doc(db, 'cases', cDoc.id), {
          portalLiberado,
          modalidadeConsultoria: nextModality,
          updatedAt: now,
        });
        syncedCases += 1;
      }
    }
  } catch {
    // Non-blocking
  }

  return { userLinked, syncedCases, updatedClient };
}

export async function archiveClientAudited(client: Client, role: UserRole): Promise<void> {
  const now = new Date().toISOString();
  await saveDocumentAudited(
    'clients',
    client.id,
    {
      ...client,
      arquivado: true,
      arquivadoEm: now,
      portalLiberado: false,
      statusAcessoPortal: 'Não solicitado',
    },
    false,
    role,
    'arquivar_cliente',
    { arquivado: client.arquivado ?? false, portalLiberado: client.portalLiberado },
  );
  if (client.userId) {
    try {
      const uSnap = await getDoc(doc(db, 'users', client.userId));
      if (uSnap.exists() && (uSnap.data() as UserProfile).role === 'cliente') {
        await updateDoc(doc(db, 'users', client.userId), { status: 'pendente', updatedAt: now });
      }
    } catch {
      // ignore
    }
  }
}

export async function mergeClientsAudited(params: {
  primaryClient: Client;
  duplicateClient: Client;
  dependents: Dependent[];
  cases: Case[];
  caseFinancials: CaseFinancialSummary[];
  caseDocuments: CaseDocument[];
  tasks: Task[];
  deadlines: Deadline[];
  appointments: Appointment[];
  communicationLogs: CommunicationLog[];
  viabilityAssessments: ViabilityAssessment[];
  budgets: Budget[];
  financialRecords: FinancialRecord[];
  generatedDocuments: GeneratedDocument[];
  role: UserRole;
}): Promise<number> {
  const {
    primaryClient,
    duplicateClient,
    dependents,
    cases,
    caseFinancials,
    caseDocuments,
    tasks,
    deadlines,
    appointments,
    communicationLogs,
    viabilityAssessments,
    budgets,
    financialRecords,
    generatedDocuments,
    role,
  } = params;
  if (role !== 'admin' && role !== 'consultor') {
    throw new Error('Sem permissão para mesclar cadastros de clientes.');
  }
  const now = new Date().toISOString();
  const mergedPrimary: Client = {
    ...primaryClient,
    cpf: primaryClient.cpf || duplicateClient.cpf || '',
    whatsapp: primaryClient.whatsapp || duplicateClient.whatsapp || '',
    email: primaryClient.email || duplicateClient.email || '',
    nacionalidade: primaryClient.nacionalidade || duplicateClient.nacionalidade,
    profissao: primaryClient.profissao || duplicateClient.profissao,
    estadoCivil: primaryClient.estadoCivil || duplicateClient.estadoCivil,
    enderecoCompleto: primaryClient.enderecoCompleto || duplicateClient.enderecoCompleto,
    filiacao: primaryClient.filiacao || duplicateClient.filiacao,
    naturalidade: primaryClient.naturalidade || duplicateClient.naturalidade,
    idiomas: primaryClient.idiomas || duplicateClient.idiomas,
    contatoEmergencia: primaryClient.contatoEmergencia || duplicateClient.contatoEmergencia,
    passaporte: primaryClient.passaporte?.numero ? primaryClient.passaporte : duplicateClient.passaporte,
    observacoes: [primaryClient.observacoes, duplicateClient.observacoes].filter(Boolean).join('\n'),
    observacoesInternas: [primaryClient.observacoesInternas, duplicateClient.observacoesInternas].filter(Boolean).join('\n'),
    lgpdAceito: primaryClient.lgpdAceito || duplicateClient.lgpdAceito,
    lgpdAceitoEm: primaryClient.lgpdAceitoEm || duplicateClient.lgpdAceitoEm,
    lgpdVersao: primaryClient.lgpdVersao || duplicateClient.lgpdVersao,
  };
  await saveDocumentAudited(
    'clients',
    primaryClient.id,
    mergedPrimary as unknown as Record<string, unknown>,
    false,
    role,
    'mesclar_cliente_destino',
    { mergedFrom: duplicateClient.id },
  );

  let movedCount = 0;
  const moveCol = async <T extends { id: string; clientId?: string }>(col: string, items: T[]) => {
    for (const item of items.filter((i) => i.clientId === duplicateClient.id)) {
      await setDoc(doc(db, col, item.id), { clientId: primaryClient.id, updatedAt: now }, { merge: true });
      movedCount += 1;
    }
  };

  await Promise.all([
    moveCol('dependents', dependents),
    moveCol('cases', cases),
    moveCol('caseDocuments', caseDocuments),
    moveCol('tasks', tasks),
    moveCol('deadlines', deadlines),
    moveCol('appointments', appointments),
    moveCol('communicationLogs', communicationLogs),
    moveCol('viabilityAssessments', viabilityAssessments),
    moveCol('budgets', budgets),
    moveCol('financialRecords', financialRecords),
    moveCol('generatedDocuments', generatedDocuments),
    ...caseFinancials
      .filter((cf) => cf.clientId === duplicateClient.id)
      .map(async (cf) => {
        await setDoc(doc(db, 'caseFinancials', cf.caseId), { clientId: primaryClient.id, updatedAt: now }, { merge: true });
        movedCount += 1;
      }),
  ]);

  await saveDocumentAudited(
    'clients',
    duplicateClient.id,
    {
      ...duplicateClient,
      arquivado: true,
      arquivadoEm: now,
      mescladoEm: now,
      portalLiberado: false,
      statusAcessoPortal: 'Não solicitado',
      observacoesInternas: `${duplicateClient.observacoesInternas ? duplicateClient.observacoesInternas + '\n' : ''}Mesclado no cadastro ${primaryClient.id} (${primaryClient.nomeCompleto}) em ${now}.`,
    },
    false,
    role,
    'mesclar_cliente_origem',
    { mergedInto: primaryClient.id },
  );

  await registrarAuditoria(
    'Mesclar Clientes',
    'clients',
    primaryClient.id,
    'mesclagem',
    { originClientId: duplicateClient.id, originNome: duplicateClient.nomeCompleto },
    { targetClientId: primaryClient.id, targetNome: primaryClient.nomeCompleto, movedCount },
    role,
  );
  return movedCount;
}

export async function deleteClientCascadeAudited(params: {
  client: Client;
  dependents: Dependent[];
  cases: Case[];
  caseFinancials: CaseFinancialSummary[];
  caseDocuments: CaseDocument[];
  tasks: Task[];
  deadlines: Deadline[];
  appointments: Appointment[];
  communicationLogs: CommunicationLog[];
  viabilityAssessments: ViabilityAssessment[];
  budgets: Budget[];
  financialRecords: FinancialRecord[];
  generatedDocuments: GeneratedDocument[];
  role: UserRole;
  lgpdJustification?: string;
}): Promise<number> {
  const {
    client,
    dependents,
    cases,
    caseFinancials,
    caseDocuments,
    tasks,
    deadlines,
    appointments,
    communicationLogs,
    viabilityAssessments,
    budgets,
    financialRecords,
    generatedDocuments,
    role,
    lgpdJustification,
  } = params;
  if (role !== 'admin' && role !== 'consultor') {
    throw new Error('Apenas administradores ou consultores podem excluir definitivamente um cliente.');
  }
  const caseIds = new Set(cases.filter((c) => c.clientId === client.id).map((c) => c.id));
  let deleted = 0;

  const delCol = async <T extends { id: string; clientId?: string; caseId?: string }>(col: string, list: T[]) => {
    for (const item of list.filter((i) => i.clientId === client.id || (i.caseId && caseIds.has(i.caseId)))) {
      await deleteDoc(doc(db, col, item.id));
      deleted += 1;
    }
  };

  await Promise.all([
    delCol('dependents', dependents),
    delCol('caseDocuments', caseDocuments),
    delCol('tasks', tasks),
    delCol('deadlines', deadlines),
    delCol('appointments', appointments),
    delCol('communicationLogs', communicationLogs),
    delCol('viabilityAssessments', viabilityAssessments),
    delCol('budgets', budgets),
    delCol('financialRecords', financialRecords),
    delCol('generatedDocuments', generatedDocuments),
    ...caseFinancials
      .filter((cf) => cf.clientId === client.id || caseIds.has(cf.caseId))
      .map(async (cf) => {
        await deleteDoc(doc(db, 'caseFinancials', cf.caseId));
        deleted += 1;
      }),
    ...Array.from(caseIds).map(async (cid) => {
      await deleteDoc(doc(db, 'cases', cid));
      deleted += 1;
    }),
  ]);

  await deleteDoc(doc(db, 'clients', client.id));
  await registrarAuditoria(
    lgpdJustification ? 'Exclusão LGPD Cliente' : 'Exclusão em Cascata Cliente',
    'clients',
    client.id,
    'exclusao_cliente',
    { nome: client.nomeCompleto, email: client.email },
    { deletedRelatedCount: deleted, lgpdJustification: lgpdJustification || 'Confirmado no painel' },
    role,
  );
  return deleted;
}

export async function deleteCaseCascadeAudited(params: {
  caseItem: Case;
  caseFinancials?: CaseFinancialSummary[];
  caseDocuments?: CaseDocument[];
  tasks?: Task[];
  deadlines?: Deadline[];
  appointments?: Appointment[];
  communicationLogs?: CommunicationLog[];
  viabilityAssessments?: ViabilityAssessment[];
  budgets?: Budget[];
  financialRecords?: FinancialRecord[];
  generatedDocuments?: GeneratedDocument[];
  role: UserRole;
}): Promise<number> {
  const {
    caseItem,
    caseFinancials = [],
    caseDocuments = [],
    tasks = [],
    deadlines = [],
    appointments = [],
    communicationLogs = [],
    viabilityAssessments = [],
    budgets = [],
    financialRecords = [],
    generatedDocuments = [],
    role,
  } = params;

  if (role !== 'admin' && role !== 'consultor') {
    throw new Error('Apenas administradores ou consultores podem excluir casos.');
  }

  let deleted = 0;

  const delColByCase = async <T extends { id: string; caseId?: string }>(col: string, list: T[]) => {
    for (const item of list.filter((i) => i.caseId === caseItem.id)) {
      await deleteDoc(doc(db, col, item.id));
      deleted += 1;
    }
  };

  await Promise.all([
    delColByCase('caseDocuments', caseDocuments),
    delColByCase('tasks', tasks),
    delColByCase('deadlines', deadlines),
    delColByCase('appointments', appointments),
    delColByCase('communicationLogs', communicationLogs),
    delColByCase('viabilityAssessments', viabilityAssessments),
    delColByCase('budgets', budgets),
    delColByCase('financialRecords', financialRecords),
    delColByCase('generatedDocuments', generatedDocuments),
    ...caseFinancials
      .filter((cf) => cf.caseId === caseItem.id)
      .map(async (cf) => {
        await deleteDoc(doc(db, 'caseFinancials', cf.caseId));
        deleted += 1;
      }),
  ]);

  await deleteDoc(doc(db, 'cases', caseItem.id));
  await registrarAuditoria(
    'Excluir Caso',
    'cases',
    caseItem.id,
    'exclusao_cascata_caso',
    {
      titulo: caseItem.titulo,
      clientId: caseItem.clientId,
      etapaPipeline: caseItem.etapaPipeline,
      statusSermig: caseItem.statusSermig,
    },
    { deletedRelatedCount: deleted },
    role,
  );
  return deleted;
}

// =============================================================================
// Specific Domain Helpers
// =============================================================================
export async function fetchUsersList(): Promise<UserProfile[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }
}

export async function fetchBancarioConfigAdmin(): Promise<BancarioConfig> {
  try {
    const snap = await getDoc(doc(db, 'config', 'bancario'));
    if (!snap.exists()) {
      return { dados_bancarios_br: '', dados_bancarios_cl: '', dados_wise: '' };
    }
    return snap.data() as BancarioConfig;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, 'config/bancario');
  }
}

export async function saveBancarioConfigAdmin(data: BancarioConfig, antes: BancarioConfig): Promise<void> {
  const validated = validateBancarioConfigPayload(data);
  await executeValidatedAdminWrite('config/bancario', OperationType.WRITE, async () => {
    await setDoc(doc(db, 'config', 'bancario'), validated);
  });
  await registrarAuditoria('Atualizar', 'config', 'bancario', 'dados_bancarios', antes, validated, 'admin');
}

export async function saveEmpresaConfigAdmin(data: EmpresaConfig, antes: EmpresaConfig): Promise<void> {
  const validated = validateEmpresaConfigPayload(data);
  await executeValidatedAdminWrite('config/empresa', OperationType.WRITE, async () => {
    await setDoc(doc(db, 'config', 'empresa'), validated);
  });
  await registrarAuditoria('Atualizar', 'config', 'empresa', 'configuracao_geral', antes, validated, 'admin');
}

export async function syncPartnerAndPublic(partner: Partner, isNew: boolean, role: UserRole): Promise<void> {
  const cleanLogoUrl = (partner.logoUrl || '').trim().slice(0, 800000);
  const partnerToSave: Partner = {
    ...partner,
    logoUrl: cleanLogoUrl,
  };
  await saveDocumentAudited('partners', partnerToSave.id, partnerToSave as unknown as Record<string, unknown>, isNew, role);
  const pubRef = doc(db, 'partnersPublic', partnerToSave.id);
  if (partnerToSave.recomendadoAosClientes && partnerToSave.statusHomologacao === 'Ativo/Indicado') {
    const pubPayload: PartnerPublic = sanitizeFirestoreData({
      id: partnerToSave.id,
      nome: partnerToSave.nome,
      categoria: partnerToSave.categoria,
      pais: partnerToSave.pais,
      cidadeRegiao: partnerToSave.cidadeRegiao,
      whatsapp: partnerToSave.whatsapp,
      siteInstagram: partnerToSave.siteInstagram,
      logoUrl: cleanLogoUrl,
      avaliacao: partnerToSave.avaliacao,
      descricaoPublica: partnerToSave.descricaoPublica || partnerToSave.condicoesParceria || '',
      recomendadoAosClientes: true,
      statusHomologacao: 'Ativo/Indicado',
      updatedAt: new Date().toISOString(),
    });
    await setDoc(pubRef, pubPayload);
  } else {
    try {
      await deleteDoc(pubRef);
    } catch {
      // ignore if didn't exist
    }
  }
}

export async function fetchStaffWorkspaceData(role: UserRole): Promise<{
  leads: Lead[];
  clients: Client[];
  dependents: Dependent[];
  cases: Case[];
  caseFinancials: CaseFinancialSummary[];
  caseDocuments: CaseDocument[];
  tasks: Task[];
  deadlines: Deadline[];
  appointments: Appointment[];
  communicationLogs: CommunicationLog[];
  viabilityAssessments: ViabilityAssessment[];
  budgets: Budget[];
  financialRecords: FinancialRecord[];
  partners: Partner[];
  partnerProposals: PartnerProposal[];
  messageTemplates: MessageTemplate[];
  documentTemplates: DocumentTemplate[];
  generatedDocuments: GeneratedDocument[];
  auditLogs: AuditLog[];
  staffUsers: UserProfile[];
}> {
  const canSeeFinance = role === 'admin' || role === 'consultor';

  const safeList = async <T,>(col: string, qOverride?: ReturnType<typeof query>): Promise<T[]> => {
    try {
      const snap = await getDocs(qOverride || collection(db, col));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as T);
    } catch (err) {
      reportAppError(err, {
        source: 'workspace-load',
        path: col,
        operation: OperationType.LIST,
      });
      return [];
    }
  };

  const [
    leads,
    clients,
    dependents,
    cases,
    caseDocuments,
    tasks,
    deadlines,
    appointments,
    communicationLogs,
    viabilityAssessments,
    messageTemplates,
    documentTemplates,
    generatedDocuments,
    legacyAuditLogs,
    adminActionLogs,
    caseFinancials,
    budgets,
    financialRecords,
    partners,
    partnerProposals,
    rawUsers,
  ] = await Promise.all([
    safeList<Lead>('leads'),
    safeList<Client>('clients'),
    safeList<Dependent>('dependents'),
    safeList<Case>('cases'),
    safeList<CaseDocument>('caseDocuments'),
    safeList<Task>('tasks'),
    safeList<Deadline>('deadlines'),
    safeList<Appointment>('appointments'),
    safeList<CommunicationLog>('communicationLogs'),
    safeList<ViabilityAssessment>('viabilityAssessments'),
    safeList<MessageTemplate>('messageTemplates'),
    safeList<DocumentTemplate>('documentTemplates'),
    canSeeFinance
      ? safeList<GeneratedDocument>('generatedDocuments')
      : safeList<GeneratedDocument>(
          'generatedDocuments',
          query(collection(db, 'generatedDocuments'), where('financeiro', '==', false)),
        ),
    safeList<AuditLog>('auditLogs', query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'))),
    canSeeFinance ? fetchAdminActionLogs() : Promise.resolve([]),
    canSeeFinance ? safeList<CaseFinancialSummary>('caseFinancials') : Promise.resolve([]),
    canSeeFinance ? safeList<Budget>('budgets') : Promise.resolve([]),
    canSeeFinance ? safeList<FinancialRecord>('financialRecords') : Promise.resolve([]),
    canSeeFinance ? safeList<Partner>('partners') : Promise.resolve([]),
    canSeeFinance ? safeList<PartnerProposal>('partnerProposals') : Promise.resolve([]),
    canSeeFinance ? safeList<UserProfile & { id?: string }>('users') : Promise.resolve([]),
  ]);

  const mergedAuditMap = new Map<string, AuditLog>();
  for (const log of adminActionLogs) {
    mergedAuditMap.set(log.id, { ...log, sourceSubcollection: 'adminAudit/painel/logs' });
  }
  for (const legacy of legacyAuditLogs) {
    if (!mergedAuditMap.has(legacy.id)) {
      mergedAuditMap.set(legacy.id, { ...legacy, sourceSubcollection: 'auditLogs' });
    }
  }
  const auditLogs = Array.from(mergedAuditMap.values()).sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );

  const staffUsers: UserProfile[] = rawUsers
    .map((u) => ({
      ...u,
      uid: u.uid || u.id || '',
    }))
    .filter(
      (u) =>
        Boolean(u.uid) &&
        (u.role === 'admin' || u.role === 'consultor' || u.role === 'assistente') &&
        u.status !== 'inativo',
    )
    .sort((a, b) => (a.nome || a.email || '').localeCompare(b.nome || b.email || '', 'pt-BR'));

  return {
    leads,
    clients,
    dependents,
    cases,
    caseFinancials,
    caseDocuments,
    tasks,
    deadlines,
    appointments,
    communicationLogs,
    viabilityAssessments,
    budgets,
    financialRecords,
    partners,
    partnerProposals,
    messageTemplates: messageTemplates.length > 0 ? messageTemplates : SEED_MESSAGE_TEMPLATES,
    documentTemplates: documentTemplates.length > 0 ? normalizeDocumentTemplates(documentTemplates) : SEED_DOCUMENT_TEMPLATES,
    generatedDocuments,
    auditLogs,
    staffUsers,
  };
}

export async function fetchAdminActionLogs(): Promise<AuditLog[]> {
  try {
    const q = query(collection(db, 'adminAudit', 'painel', 'logs'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<AuditLog, 'id'>),
      sourceSubcollection: 'adminAudit/painel/logs' as const,
    }));
  } catch (err) {
    reportAppError(err, {
      source: 'admin-audit-logs',
      path: 'adminAudit/painel/logs',
      operation: OperationType.LIST,
    });
    return [];
  }
}

export async function fetchClientPortalData(clientId: string): Promise<{
  client: Client | null;
  dependents: Dependent[];
  cases: Case[];
  caseDocuments: CaseDocument[];
  deadlines: Deadline[];
  appointments: Appointment[];
  viabilityAssessments: ViabilityAssessment[];
  budgets: Budget[];
  financialRecords: FinancialRecord[];
  generatedDocuments: GeneratedDocument[];
  leads: Lead[];
}> {
  const byClient = <T,>(col: string, extraWhere?: ReturnType<typeof where>) => {
    const constraints = [where('clientId', '==', clientId)];
    if (extraWhere) constraints.push(extraWhere);
    return getDocs(query(collection(db, col), ...constraints))
      .then((snap) => snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as T))
      .catch((err) => {
        console.warn(`[Portal] Falha ao consultar ${col} para clientId=${clientId}:`, err instanceof Error ? err.message : String(err));
        return [] as T[];
      });
  };

  const clientSnap = await getDoc(doc(db, 'clients', clientId)).catch((err) => {
    console.warn(`[Portal] Falha ao ler clients/${clientId}:`, err instanceof Error ? err.message : String(err));
    return null;
  });
  const client = clientSnap?.exists() ? ({ id: clientSnap.id, ...(clientSnap.data() as Omit<Client, 'id'>) }) : null;

  const userEmail = (auth.currentUser?.email || client?.email || '').trim().toLowerCase();
  const fetchClientLeads = fetchSignedInUserDiagnosticLeads(userEmail);

  const [
    dependents,
    rawCases,
    caseDocuments,
    deadlines,
    appointments,
    rawAssessments,
    budgets,
    financialRecords,
    rawGeneratedDocuments,
    leads,
  ] = await Promise.all([
    byClient<Dependent>('dependents'),
    byClient<Case>('cases'),
    byClient<CaseDocument>('caseDocuments'),
    byClient<Deadline>('deadlines'),
    byClient<Appointment>('appointments'),
    byClient<ViabilityAssessment>('viabilityAssessments', where('liberadoAoCliente', '==', true)),
    byClient<Budget>('budgets', where('status', 'in', ['Enviado ao Cliente', 'Aprovado', 'Recusado', 'Parcialmente Faturado'])),
    byClient<FinancialRecord>('financialRecords'),
    byClient<GeneratedDocument>('generatedDocuments', where('liberadoAoCliente', '==', true)),
    fetchClientLeads,
  ]);

  const docsCountByCase = new Map<string, number>();
  for (const d of caseDocuments) {
    docsCountByCase.set(d.caseId, (docsCountByCase.get(d.caseId) || 0) + 1);
  }

  const cases = [...rawCases].sort((a, b) => {
    const aDocs = docsCountByCase.get(a.id) || 0;
    const bDocs = docsCountByCase.get(b.id) || 0;
    if (aDocs > 0 && bDocs === 0) return -1;
    if (bDocs > 0 && aDocs === 0) return 1;
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
  });

  const viabilityAssessments = [...rawAssessments].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  );

  const generatedDocuments = [...rawGeneratedDocuments].sort((a, b) =>
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''),
  );

  return {
    client,
    dependents,
    cases,
    caseDocuments,
    deadlines,
    appointments,
    viabilityAssessments,
    budgets,
    financialRecords,
    generatedDocuments,
    leads,
  };
}

export async function fetchSignedInUserDiagnosticLeads(email?: string | null): Promise<Lead[]> {
  const rawEmail = (email || auth.currentUser?.email || '').trim();
  const lowerEmail = rawEmail.toLowerCase();
  if (!lowerEmail) return [];

  const results = new Map<string, Lead>();
  const queries = [query(collection(db, 'leads'), where('email', '==', lowerEmail))];
  if (rawEmail && rawEmail !== lowerEmail) {
    queries.push(query(collection(db, 'leads'), where('email', '==', rawEmail)));
  }

  for (const q of queries) {
    try {
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        results.set(d.id, { id: d.id, ...(d.data() as Record<string, unknown>) } as Lead);
      }
    } catch {
      // ignore individual query errors
    }
  }

  return Array.from(results.values()).sort((a, b) =>
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''),
  );
}

export async function fetchSignedInClientRecord(
  uid: string,
  email?: string | null,
  knownClientId?: string | null,
): Promise<Client | null> {
  const authEmail = (auth.currentUser?.email || '').trim();
  const rawEmail = (email || authEmail || '').trim();
  const lowerEmail = rawEmail.toLowerCase();
  const authLowerEmail = authEmail.toLowerCase();
  const found: Client[] = [];

  const addClient = (id: string, data: Omit<Client, 'id'>) => {
    if (!found.some((c) => c.id === id)) {
      found.push({ id, ...data });
    }
  };

  if (knownClientId) {
    try {
      const directSnap = await getDoc(doc(db, 'clients', knownClientId));
      if (directSnap.exists()) {
        addClient(directSnap.id, directSnap.data() as Omit<Client, 'id'>);
      }
    } catch (err) {
      console.warn(`[Portal] Falha ao ler clients/${knownClientId}:`, err instanceof Error ? err.message : String(err));
    }
  }

  const tryQuery = async (label: string, q: ReturnType<typeof query>) => {
    try {
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        addClient(d.id, d.data() as Omit<Client, 'id'>);
      }
    } catch (err) {
      console.warn(`[Portal] Falha na consulta clients (${label}):`, err instanceof Error ? err.message : String(err));
    }
  };

  if (uid) {
    await tryQuery('userId', query(collection(db, 'clients'), where('userId', '==', uid)));
  }

  const emailCandidates = Array.from(
    new Set([lowerEmail, rawEmail, authLowerEmail, authEmail].filter(Boolean)),
  );
  for (const candidate of emailCandidates) {
    await tryQuery(`email=${candidate}`, query(collection(db, 'clients'), where('email', '==', candidate)));
  }

  if (found.length === 0) return null;
  // Prioriza cliente ativo com portal liberado e não arquivado
  const activeUnlocked = found.find((c) => c.portalLiberado === true && !c.arquivado);
  if (activeUnlocked) return activeUnlocked;
  const nonArchived = found.find((c) => !c.arquivado);
  return nonArchived || found[0];
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

export async function convertRasterImageFileToWebp(
  file: File,
  maxDimension = 1600,
  quality = 0.84,
): Promise<File> {
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const isConvertible =
    ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type.toLowerCase()) ||
    ['jpg', 'jpeg', 'png'].includes(ext);

  if (!isConvertible || typeof document === 'undefined' || typeof Image === 'undefined') {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao decodificar imagem para WebP.'));
      el.src = objectUrl;
    });

    const ratio = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round(img.width * ratio));
    const height = Math.max(1, Math.round(img.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), 'image/webp', quality),
    );
    if (!blob || blob.type !== 'image/webp') {
      return file;
    }

    const webpName = file.name.replace(/\.(jpe?g|png)$/i, '.webp');
    return new File([blob], webpName, {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressImageToDataUrl(file: File, maxDimension = 1280, quality = 0.8): Promise<string> {
  const originalUrl = await readFileAsDataUrl(file);
  if (typeof document === 'undefined' || typeof Image === 'undefined') return originalUrl;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
      const width = Math.max(1, Math.round(img.width * ratio));
      const height = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(originalUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      let compressed = canvas.toDataURL('image/webp', quality);
      if (!compressed.startsWith('data:image/webp')) {
        compressed = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(compressed.length < originalUrl.length || compressed.startsWith('data:image/webp') ? compressed : originalUrl);
    };
    img.onerror = () => resolve(originalUrl);
    img.src = originalUrl;
  });
}

export interface ServerUploadResult {
  url: string;
  filename: string;
  mobileUrl?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  convertedToWebp?: boolean;
}

export async function uploadFileToServer(file: File): Promise<ServerUploadResult> {
  const user = auth.currentUser;
  if (!user) throw new Error('Faça login para enviar arquivos.');
  const allowed = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon',
  ];
  const ext = file.name.toLowerCase().split('.').pop() || '';
  const allowedExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'svg', 'ico'];
  if (!allowed.includes(file.type) && !allowedExt.includes(ext)) {
    throw new Error('Formato não permitido. Envie PDF, JPG, PNG, WEBP, SVG ou ICO.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('O arquivo excede o limite máximo de 10 MB.');
  }

  // 1. Tenta o endpoint /api/upload quando disponível (converte imagens automaticamente para WebP + 640w via sharp)
  try {
    const token = await user.getIdToken();
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch('/api/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const contentType = (resp.headers.get('content-type') || '').toLowerCase();
    if (resp.ok && contentType.includes('application/json')) {
      const data = (await resp.json()) as {
        url?: string;
        mobileUrl?: string;
        filename?: string;
        mimeType?: string;
        size?: number;
        width?: number;
        height?: number;
        convertedToWebp?: boolean;
        error?: string;
      };
      if (data.url) {
        return {
          url: data.url,
          mobileUrl: data.mobileUrl,
          filename: data.filename || file.name,
          mimeType: data.mimeType,
          size: data.size,
          width: data.width,
          height: data.height,
          convertedToWebp: data.convertedToWebp,
        };
      }
    }
  } catch {
    // Em hospedagem estática (Vercel Free), /api/upload não usa disco local — segue para fallback seguro
  }

  // 2. Fallback compatível com Vercel Free (sem disco local): conversão automática para WebP + DataURL segura para Firestore
  const isRasterImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext);
  if (isRasterImage) {
    const webpName = file.name.replace(/\.(jpe?g|png)$/i, '.webp');
    const dataUrl = await compressImageToDataUrl(file);
    if (dataUrl.length > 650_000) {
      const smaller = await compressImageToDataUrl(file, 960, 0.64);
      if (smaller.length > 680_000) {
        throw new Error('A imagem ficou grande demais para armazenamento direto na hospedagem gratuita. Reduza a resolução ou envie em formato menor.');
      }
      return {
        url: smaller,
        filename: webpName,
        mimeType: smaller.startsWith('data:image/webp') ? 'image/webp' : file.type,
        size: Math.round((smaller.length * 3) / 4),
        convertedToWebp: smaller.startsWith('data:image/webp'),
      };
    }
    return {
      url: dataUrl,
      filename: webpName,
      mimeType: dataUrl.startsWith('data:image/webp') ? 'image/webp' : file.type,
      size: Math.round((dataUrl.length * 3) / 4),
      convertedToWebp: dataUrl.startsWith('data:image/webp'),
    };
  }

  if (file.size > 480 * 1024) {
    throw new Error(
      'No plano gratuito (Vercel/Firebase), PDFs enviados diretamente precisam ter até 480 KB. Comprima o PDF (ex.: iLovePDF) ou envie foto/imagem nítida do documento.',
    );
  }
  const dataUrl = await readFileAsDataUrl(file);
  return { url: dataUrl, filename: file.name, mimeType: file.type, size: file.size };
}

export async function fetchMediaAssetsStaff(): Promise<MediaAsset[]> {
  try {
    const snap = await getDocs(collection(db, 'mediaAssets'));
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MediaAsset, 'id'>) }));
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export async function saveMediaAssetAdmin(asset: MediaAsset, role: UserRole): Promise<void> {
  if (!isEffectiveAdmin(role)) throw new Error('Apenas administradores podem gerenciar a biblioteca de mídias.');
  const payload = normalizeCollectionWritePayload(
    'mediaAssets',
    asset.id,
    stripUndefined(asset as unknown as Record<string, unknown>),
  );
  await executeValidatedAdminWrite(`mediaAssets/${asset.id}`, OperationType.CREATE, async () => {
    await setDoc(doc(db, 'mediaAssets', asset.id), payload);
  });
  await registrarAuditoria('Criar', 'mediaAssets', asset.id, 'midia_importada', null, { nome: asset.nome, categoria: asset.categoria, tamanhoBytes: asset.tamanhoBytes }, 'admin');
}

export async function deleteMediaAssetAdmin(asset: MediaAsset, role: UserRole): Promise<void> {
  if (!isEffectiveAdmin(role)) throw new Error('Apenas administradores podem excluir mídias.');
  await executeValidatedAdminWrite(`mediaAssets/${asset.id}`, OperationType.DELETE, async () => {
    await deleteDoc(doc(db, 'mediaAssets', asset.id));
    if (asset.url.startsWith('/uploads/')) {
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        const filename = asset.url.replace('/uploads/', '');
        await fetch(`/api/media/${encodeURIComponent(filename)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
  });
  await registrarAuditoria('Excluir', 'mediaAssets', asset.id, 'midia_excluida', { nome: asset.nome, categoria: asset.categoria }, null, 'admin');
}

export interface CallAiOptions {
  onProgress?: (message: string, attempt?: number, maxAttempts?: number) => void;
  timeoutMs?: number;
  streamProgress?: boolean;
  /** Ignora leitura do cache local IndexedDB e força nova consulta à IA (atualiza o cache ao concluir) */
  bypassCache?: boolean;
  /** Desativa leitura e gravação no cache local para esta chamada específica */
  disableCache?: boolean;
  /** TTL customizado em milissegundos para esta entrada no IndexedDB */
  cacheTtlMs?: number;
}

export async function callAiEndpoint<T>(endpoint: string, body: unknown, options?: CallAiOptions): Promise<T> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Faça login com sua conta Google para utilizar o apoio de IA.');
  }

  const useCache = options?.disableCache !== true;
  const cacheKey = useCache ? await computeAiCacheKey(endpoint, body, user.uid) : '';

  if (useCache && !options?.bypassCache && cacheKey) {
    const cached = await getAiCachedResponse<T>(cacheKey);
    if (cached) {
      options?.onProgress?.('Resultado recuperado do cache local (sem custo de API)…', 1, 1);
      if (cached.data && typeof cached.data === 'object' && !Array.isArray(cached.data)) {
        return {
          ...(cached.data as Record<string, unknown>),
          fromCache: true,
          cachedAt: cached.savedAt,
          cacheExpiresAt: cached.expiresAt,
        } as T;
      }
      return cached.data;
    }
  }

  const clientTimeoutMs = Math.max(15000, Math.min(180000, options?.timeoutMs ?? 90000));
  const useStream = options?.streamProgress === true && Boolean(options?.onProgress);
  const serializedBody = JSON.stringify(body);

  const executeAttempt = async (forceRefreshToken: boolean): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string; retryable: boolean }> => {
    const token = await user.getIdToken(forceRefreshToken);
    const controller = new AbortController();
    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, clientTimeoutMs);

    try {
      let resp: Response;
      try {
        resp = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: useStream ? 'application/x-ndjson, application/json' : 'application/json',
            Authorization: `Bearer ${token}`,
            ...(useStream ? { 'x-ai-progress': '1' } : {}),
          },
          body: serializedBody,
          signal: controller.signal,
        });
      } catch (networkErr) {
        if (timedOut) {
          return {
            ok: false,
            status: 504,
            message: 'Tempo limite excedido ao aguardar resposta do servidor de IA. Tente novamente em instantes.',
            retryable: false,
          };
        }
        return {
          ok: false,
          status: 0,
          message: sanitizeClientAiError(networkErr),
          retryable: true,
        };
      }

      const contentType = (resp.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/x-ndjson') && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult: T | null = null;
        let streamError: string | null = null;

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const ev = JSON.parse(trimmed) as {
                  type?: string;
                  message?: string;
                  attempt?: number;
                  maxAttempts?: number;
                  data?: T;
                  error?: string;
                };
                if (ev.type === 'progress' && ev.message) {
                  options?.onProgress?.(ev.message, ev.attempt, ev.maxAttempts);
                } else if (ev.type === 'result' && ev.data) {
                  finalResult = ev.data;
                } else if (ev.type === 'error') {
                  streamError = sanitizeClientAiError(ev.error || '');
                }
              } catch {
                // ignore partial line
              }
            }
          }
        } catch (readErr) {
          if (timedOut) {
            return {
              ok: false,
              status: 504,
              message: 'Tempo limite excedido ao aguardar resposta do servidor de IA. Tente novamente em instantes.',
              retryable: false,
            };
          }
          return { ok: false, status: resp.status || 502, message: sanitizeClientAiError(readErr), retryable: true };
        }
        if (buffer.trim()) {
          try {
            const ev = JSON.parse(buffer.trim()) as { type?: string; data?: T; error?: string };
            if (ev.type === 'result' && ev.data) finalResult = ev.data;
            else if (ev.type === 'error') streamError = sanitizeClientAiError(ev.error || '');
          } catch {
            // ignore
          }
        }

        if (streamError) {
          const isTransientStream = resp.status >= 500 || resp.status === 429;
          return { ok: false, status: resp.status || 500, message: streamError, retryable: isTransientStream };
        }
        if (finalResult) {
          return { ok: true, data: finalResult };
        }
        return {
          ok: false,
          status: resp.status || 502,
          message: 'Resposta incompleta do servidor de IA. Tente novamente em instantes.',
          retryable: true,
        };
      }

      let rawText = '';
      try {
        rawText = await resp.text();
        if (rawText.trim().startsWith('<')) {
          return {
            ok: false,
            status: resp.status || 502,
            message: 'Falha temporária de comunicação com o servidor de IA. Tente novamente em instantes.',
            retryable: true,
          };
        }
        const data = (rawText ? JSON.parse(rawText) : {}) as T & { error?: unknown };
        if (!resp.ok) {
          const isTransientHttp =
            resp.status === 408 ||
            resp.status === 429 ||
            resp.status === 500 ||
            resp.status === 502 ||
            resp.status === 503 ||
            resp.status === 504;
          return {
            ok: false,
            status: resp.status,
            message: sanitizeClientAiError(data.error || rawText || String(resp.status)),
            retryable: isTransientHttp,
          };
        }
        return { ok: true, data };
      } catch (err) {
        if (timedOut) {
          return {
            ok: false,
            status: 504,
            message: 'Tempo limite excedido ao aguardar resposta do servidor de IA. Tente novamente em instantes.',
            retryable: false,
          };
        }
        const isTransientHttp = resp.status >= 500 || !resp.ok;
        return {
          ok: false,
          status: resp.status || 502,
          message: sanitizeClientAiError(err instanceof Error ? err.message : rawText || String(resp.status)),
          retryable: isTransientHttp,
        };
      }
    } finally {
      clearTimeout(timeoutHandle);
    }
  };

  options?.onProgress?.('Consultando IA…', 1, 3);
  let outcome = await executeAttempt(false);

  // Se o token Firebase expirou ou houve pequena diferença de relógio, força renovação e tenta novamente
  if (!outcome.ok && outcome.status === 401) {
    options?.onProgress?.('Renovando sessão e tentando novamente…', 2, 3);
    outcome = await executeAttempt(true);
  }

  // Re-tentativa automática com backoff exponencial (até 2 tentativas extras) para falhas transitórias de rede/proxy/5xx/429
  const retryDelaysMs = [700, 1600];
  for (let retryIdx = 0; retryIdx < retryDelaysMs.length && !outcome.ok && outcome.retryable; retryIdx++) {
    const attemptNum = retryIdx + 2;
    const totalAttempts = retryDelaysMs.length + 1;
    options?.onProgress?.(
      `Reconectando ao servidor de IA (tentativa ${attemptNum} de ${totalAttempts})…`,
      attemptNum,
      totalAttempts,
    );
    await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[retryIdx]));
    outcome = await executeAttempt(false);
    if (!outcome.ok && outcome.status === 401) {
      options?.onProgress?.('Renovando sessão e tentando novamente…', attemptNum, totalAttempts);
      outcome = await executeAttempt(true);
    }
  }

  if (outcome.ok) {
    const meta = outcome.data as unknown as { fallback?: boolean; origem?: string } | null;
    const isDegradedFallback = Boolean(meta && (meta.fallback === true || meta.origem === 'regras'));
    if (useCache && cacheKey && !isDegradedFallback) {
      void setAiCachedResponse({
        key: cacheKey,
        endpoint,
        userScope: user.uid,
        data: outcome.data,
        ttlMs: options?.cacheTtlMs,
      });
    }
    return outcome.data;
  }

  console.warn(`[AI] Falha em ${endpoint} após re-tentativas (status=${outcome.status}): ${outcome.message}`);
  throw new Error(outcome.message);
}

export async function linkGoogleUserToClientOrLead(user: UserProfile): Promise<UserProfile> {
  if (user.role !== 'cliente' || user.status === 'inativo') {
    return user;
  }

  try {
    const matchedClient = await fetchSignedInClientRecord(user.uid, user.email, user.clientId);
    if (!matchedClient) {
      // Sem cadastro de cliente: permanece pendente (pode visualizar apenas diagnóstico gratuito básico)
      return user;
    }

    const now = new Date().toISOString();
    const shouldBeActive = matchedClient.portalLiberado === true && !matchedClient.arquivado;
    const targetStatus: UserProfile['status'] = shouldBeActive ? 'ativo' : 'pendente';

    // 1. Vincula userId no documento do cliente se ainda estiver vazio
    if (!matchedClient.userId) {
      await updateDoc(doc(db, 'clients', matchedClient.id), {
        userId: user.uid,
        updatedAt: now,
      }).catch(() => {});
    }

    // 2. Sincroniza clientId e status em users/{uid} (autorizado pelas regras do Firestore quando portalLiberado == true)
    if (user.clientId !== matchedClient.id || user.status !== targetStatus) {
      await updateDoc(doc(db, 'users', user.uid), {
        clientId: matchedClient.id,
        status: targetStatus,
        updatedAt: now,
      });
    }

    return {
      ...user,
      clientId: matchedClient.id,
      status: targetStatus,
      updatedAt: now,
    };
  } catch (err) {
    reportAppError(err, {
      source: 'portal-link-client',
      operation: OperationType.UPDATE,
      path: `users/${user.uid}`,
    });
  }
  return user;
}

export async function syncOfficialLegalCatalog(
  role: UserRole,
): Promise<{ updatedSources: number; updatedVisas: number }> {
  if (role !== 'admin' && role !== 'consultor') {
    throw new Error('Somente administradores ou consultores podem sincronizar a Base Legal oficial.');
  }

  const [legSnap, visaSnap] = await Promise.all([
    getDocs(collection(db, 'legalSources')),
    getDocs(collection(db, 'visaCategories')),
  ]);

  const currentSources = legSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LegalSource, 'id'>) }));
  const currentVisas = visaSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisaCategory, 'id'>) }));

  const { sourcesToUpsert, visasToUpsert } = buildOfficialLegalCatalogDiff(
    currentSources,
    currentVisas,
    SEED_LEGAL_SOURCES,
    SEED_VISA_CATEGORIES,
  );

  const nowIso = new Date().toISOString();
  const todayIso = nowIso.slice(0, 10);

  await Promise.all([
    ...sourcesToUpsert.map((src) =>
      setDoc(doc(db, 'legalSources', src.id), stripUndefined({ ...src, updatedAt: nowIso }), { merge: true }),
    ),
    ...visasToUpsert.map((visa) =>
      setDoc(doc(db, 'visaCategories', visa.id), stripUndefined({ ...visa, updatedAt: nowIso }), { merge: true }),
    ),
  ]);

  if (role === 'admin' && (sourcesToUpsert.length > 0 || visasToUpsert.length > 0)) {
    try {
      const cfgRef = doc(db, 'config', 'empresa');
      const cfgSnap = await getDoc(cfgRef);
      const currentCfg = cfgSnap.exists() ? (cfgSnap.data() as Partial<EmpresaConfig>) : DEFAULT_EMPRESA_CONFIG;
      await setDoc(
        cfgRef,
        validateEmpresaConfigPayload({
          ...currentCfg,
          ultimaRevisaoNormativa: todayIso,
        }),
      );
    } catch {
      // non-blocking metadata timestamp update
    }
  }

  await registrarAuditoria(
    'Sincronizar Base Legal Oficial SERMIG/BCN',
    'legalSources',
    'catalogo_sermig',
    'sincronizar_base_legal',
    { totalNormas: currentSources.length, totalVistos: currentVisas.length },
    { updatedSources: sourcesToUpsert.length, updatedVisas: visasToUpsert.length },
    role,
  );

  return {
    updatedSources: sourcesToUpsert.length,
    updatedVisas: visasToUpsert.length,
  };
}

export async function cleanupServerUploadUrl(fileUrl?: string | null): Promise<void> {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
  const filename = fileUrl.split('/').pop();
  if (!filename) return;
  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    if (!idToken) return;
    await fetch(`/api/uploads/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch {
    // Non-blocking on static Vercel Free hosting
  }
}

export async function deleteCaseDocumentAudited(
  docItem: CaseDocument,
  role: UserRole,
): Promise<void> {
  if (docItem.arquivoUrl) {
    await cleanupServerUploadUrl(docItem.arquivoUrl);
  }
  await deleteDocumentAudited(
    'caseDocuments',
    docItem.id,
    role,
    docItem,
  );
}

export async function rejectPartnerProposalAudited(
  prop: PartnerProposal,
  _motivo: string,
  role: UserRole,
): Promise<void> {
  const updated: PartnerProposal = {
    ...prop,
    status: 'Recusada',
  };
  await saveDocumentAudited(
    'partnerProposals',
    prop.id,
    updated as unknown as Record<string, unknown>,
    false,
    role,
    'status_proposta',
    prop.status,
  );
}

export async function deletePartnerProposalAudited(
  prop: PartnerProposal,
  role: UserRole,
): Promise<void> {
  await deleteDocumentAudited(
    'partnerProposals',
    prop.id,
    role,
    prop,
  );
}

export async function deletePartnerAndPublicAudited(
  partner: Partner,
  role: UserRole,
  _proposals?: PartnerProposal[],
): Promise<void> {
  await deleteDocumentAudited(
    'partners',
    partner.id,
    role,
    partner,
  );
  try {
    await deleteDoc(doc(db, 'partnersPublic', partner.id));
  } catch {
    // Ignore if partner was not publicly listed
  }
}

export async function fetchRuleEngineBundleWithSync(): Promise<{
  empresa: EmpresaConfig;
  siteContent: SiteContent[];
  partnersPublic: PartnerPublic[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeDiagnosticRules: DiagnosticRuleVersion;
  source: CatalogSyncSource;
  savedAt?: string;
  fromCloud: boolean;
}> {
  try {
    const [empresa, siteContent, partnersPublic, catalog, activeDiagnosticRules] =
      await Promise.all([
        fetchEmpresaConfig(),
        fetchSiteContentPublic(),
        fetchPartnersPublic(),
        fetchVisaCatalogPublic(),
        fetchActiveDiagnosticRules(),
      ]);

    const snapshot = {
      empresa,
      siteContent,
      partnersPublic,
      visaCategories: catalog.categories,
      visaRequirements: catalog.requirements,
      legalSources: catalog.legalSources,
      activeDiagnosticRules,
      source: 'nuvem' as const,
    };
    const savedAt = saveRuleEngineSnapshot(snapshot);
    return { ...snapshot, savedAt, fromCloud: true };
  } catch {
    const fallback = loadRuleEngineSnapshotSync();
    return { ...fallback, fromCloud: false };
  }
}

export async function syncPendingOfflineDiagnosticToFirestore(
  item: PendingOfflineDiagnostic,
): Promise<void> {
  const leadPayload = item.leadPayload as unknown as Omit<Lead, 'id' | 'createdAt'>;
  await submitDiagnosticLeadPublic(
    leadPayload,
    item.existingLeadId ? { existingLeadId: item.existingLeadId } : undefined,
  );
  if (item.sessionToken && item.sessionPayload) {
    await saveDiagnosticSession(
      item.sessionToken,
      item.sessionPayload as unknown as Omit<DiagnosticSession, 'id' | 'createdAt' | 'updatedAt'>,
      true,
    ).catch(() => undefined);
  }
}

export async function syncRuleEngineDecisionLogToFirestore(
  log: RuleEngineDecisionLog,
  role?: UserRole,
): Promise<void> {
  await registrarAuditoria(
    'Decisão Motor de Regras',
    'diagnosticSessions',
    log.sessionToken || log.id,
    'motor_regras_offline',
    undefined,
    {
      mode: log.mode,
      origin: log.origin,
      ruleVersion: log.ruleVersion,
      subcategoriaRecomendada: log.subcategoriaRecomendada,
      notaViabilidade: log.notaViabilidade,
      confianca: log.confianca,
    },
    role || 'cliente',
  );
}

export async function fetchPublicClientTestimonials(): Promise<ClientTestimonial[]> {
  try {
    const q = query(
      collection(db, 'clientTestimonials'),
      where('aprovado', '==', true),
      where('autorizado', '==', true),
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<ClientTestimonial, 'id'>) }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'clientTestimonials');
    return [];
  }
}

export async function submitClientTestimonialPublic(
  input: Omit<ClientTestimonial, 'id' | 'createdAt' | 'updatedAt' | 'aprovado'>,
): Promise<ClientTestimonial> {
  const id = makeId('dep');
  const now = new Date().toISOString();
  const safeVideoUrl =
    input.videoUrl && /^\/uploads\/testimonials\/[a-zA-Z0-9_\-\.]+$/.test(input.videoUrl)
      ? input.videoUrl.slice(0, 500)
      : '';

  const payload: ClientTestimonial = stripUndefined({
    id,
    nome: (input.nome || '').trim().slice(0, 140),
    cidadeOrigem: (input.cidadeOrigem || '').trim().slice(0, 120),
    cidadeDestino: (input.cidadeDestino || '').trim().slice(0, 120),
    tipoVisto: (input.tipoVisto || '').trim().slice(0, 120),
    categoriaParceiro: (input.categoriaParceiro || '').trim().slice(0, 100),
    depoimento: (input.depoimento || '').trim().slice(0, 1200),
    videoUrl: safeVideoUrl,
    videoMimeType: safeVideoUrl ? (input.videoMimeType || 'video/webm').slice(0, 60) : '',
    duracaoSegundos: safeVideoUrl
      ? Math.max(0, Math.min(45, Math.round(Number(input.duracaoSegundos || 0))))
      : 0,
    avaliacao: Math.max(1, Math.min(5, Math.round(Number(input.avaliacao || 5)))),
    autorizado: Boolean(input.autorizado),
    aprovado: true,
    honeypot: '',
    createdAt: now,
    updatedAt: now,
  });

  try {
    await setDoc(doc(db, 'clientTestimonials', id), payload);
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `clientTestimonials/${id}`);
    throw err;
  }
}



