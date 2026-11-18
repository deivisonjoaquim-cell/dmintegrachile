import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bell,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  History,
  Layout,
  Monitor,
  Palette,
  Play,
  Plus,
  RotateCcw,
  Shield,
  Sliders,
  Smartphone,
  Sparkles,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import { auth } from '../../firebase';
import { getEffectiveVapidKey } from '../../services/notificationService';
import {
  fetchAllDiagnosticRuleVersions,
  fetchBancarioConfigAdmin,
  fetchUsersList,
  makeId,
  publishDiagnosticRuleVersion,
  saveBancarioConfigAdmin,
  saveDocumentAudited,
  saveEmpresaConfigAdmin,
} from '../../services/firestoreService';
import type {
  AuditLog,
  BancarioConfig,
  DiagnosticRuleItem,
  DiagnosticRuleVersion,
  DisplayFontChoice,
  EmpresaConfig,
  FontChoice,
  LegalSource,
  NavLinkConfig,
  PartnerPublic,
  SiteContent,
  SiteLayoutConfig,
  UserProfile,
  UserRole,
  VisaCategory,
  VisaRequirement,
} from '../../types/domain';
import { runDiagnosticEngine } from '../../utils/diagnosticEngine';
import { DIAGNOSTIC_TEST_PROFILES } from '../../utils/diagnosticProfiles';
import { exportToCSV, formatDateBR, formatDateTimeBR } from '../../utils/formatters';
import { HomeSectionsView } from '../HomeSectionsView';
import { MediaAssetPicker } from './MediaAssetPicker';

interface PainelAdminConfigProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  siteContent: SiteContent[];
  partnersPublic?: PartnerPublic[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeDiagnosticRules: DiagnosticRuleVersion;
  auditLogs: AuditLog[];
  onRefresh: () => Promise<void>;
  onRefreshPublic: () => Promise<void>;
  sectionGroup?: 'site' | 'regras' | 'governanca' | 'todos';
}

type AdminTab = 'aparencia' | 'cms' | 'bancario' | 'equipe' | 'auditoria' | 'regras' | 'testes';

interface ThemePreset {
  id: string;
  nome: string;
  descricao: string;
  corPrimaria: string;
  corDestaque: string;
  corFundo: string;
  corSuperficie: string;
  corTexto: string;
  corRodapeBg: string;
  fonteDisplay: DisplayFontChoice;
  fontePrincipal: FontChoice;
  raioBordas: NonNullable<SiteLayoutConfig['raioBordas']>;
}

const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'santiago_exec',
    nome: 'Executivo Santiago',
    descricao: 'Marinho institucional & ouro fosco',
    corPrimaria: '#0F2537',
    corDestaque: '#D4AF37',
    corFundo: '#F8F9FA',
    corSuperficie: '#FFFFFF',
    corTexto: '#0F172A',
    corRodapeBg: '#0B1B29',
    fonteDisplay: 'Plus Jakarta Sans',
    fontePrincipal: 'Plus Jakarta Sans',
    raioBordas: 'editorial',
  },
  {
    id: 'andes_editorial',
    nome: 'Andes Editorial',
    descricao: 'Verde petróleo, areia quente & serifada clássica',
    corPrimaria: '#133C3B',
    corDestaque: '#C97A40',
    corFundo: '#F9F8F5',
    corSuperficie: '#FFFFFF',
    corTexto: '#142221',
    corRodapeBg: '#0C2625',
    fonteDisplay: 'Playfair Display',
    fontePrincipal: 'DM Sans',
    raioBordas: 'editorial',
  },
  {
    id: 'boutique_juridica',
    nome: 'Boutique Jurídica',
    descricao: 'Grafite solene, âmbar discreto & geometria nítida',
    corPrimaria: '#18181B',
    corDestaque: '#B45309',
    corFundo: '#F8FAFC',
    corSuperficie: '#FFFFFF',
    corTexto: '#09090B',
    corRodapeBg: '#111827',
    fonteDisplay: 'Outfit',
    fontePrincipal: 'Public Sans',
    raioBordas: 'sharp',
  },
  {
    id: 'mercosul_moderno',
    nome: 'Mercosul Contemporâneo',
    descricao: 'Azul pacífico, esmeralda & contornos suaves',
    corPrimaria: '#1E3A8A',
    corDestaque: '#10B981',
    corFundo: '#F8FAFC',
    corSuperficie: '#FFFFFF',
    corTexto: '#0F172A',
    corRodapeBg: '#0F172A',
    fonteDisplay: 'Manrope',
    fontePrincipal: 'Manrope',
    raioBordas: 'arredondado',
  },
];

const DEFAULT_NAV_LINKS: NavLinkConfig[] = [
  { path: '/', label: 'Início', visivel: true },
  { path: '/quem-somos', label: 'Quem Somos', visivel: true },
  { path: '/parceiros', label: 'Parceiros', visivel: true },
  { path: '/diagnostico', label: 'Diagnóstico', visivel: true },
  { path: '/acompanhar', label: 'Portal do Cliente', visivel: true },
];

function computePreviewCssVars(cfg: EmpresaConfig): React.CSSProperties {
  const fontMap: Record<string, string> = {
    'Plus Jakarta Sans': "'Plus Jakarta Sans', 'DM Sans', system-ui, sans-serif",
    'DM Sans': "'DM Sans', 'Plus Jakarta Sans', system-ui, sans-serif",
    Manrope: "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif",
    'Public Sans': "'Public Sans', 'DM Sans', system-ui, sans-serif",
    Montserrat: "'Montserrat', system-ui, sans-serif",
    Merriweather: "'Merriweather', Georgia, serif",
    Inter: "'Inter', system-ui, sans-serif",
  };
  const displayMap: Record<string, string> = {
    'Plus Jakarta Sans': "'Plus Jakarta Sans', system-ui, sans-serif",
    Outfit: "'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif",
    Manrope: "'Manrope', system-ui, sans-serif",
    'Playfair Display': "'Playfair Display', Georgia, serif",
    Montserrat: "'Montserrat', system-ui, sans-serif",
  };
  const raio = cfg.layoutConfig?.raioBordas || 'editorial';
  const radiusCard = raio === 'sharp' ? '0.375rem' : raio === 'arredondado' ? '1.5rem' : '1rem';
  const radiusButton = raio === 'sharp' ? '0.25rem' : raio === 'arredondado' ? '9999px' : '0.625rem';

  return {
    '--color-primary': cfg.corPrimaria || '#0F2537',
    '--color-accent': cfg.corDestaque || '#D4AF37',
    '--color-bg': cfg.corFundo || '#F8F9FA',
    '--color-surface': cfg.corSuperficie || '#FFFFFF',
    '--color-text': cfg.corTexto || '#0F172A',
    '--color-footer-bg': cfg.corRodapeBg || '#0B1B29',
    '--font-main': fontMap[cfg.fontePrincipal] || fontMap['Plus Jakarta Sans'],
    '--font-display': displayMap[cfg.fonteDisplay || cfg.fontePrincipal] || displayMap['Plus Jakarta Sans'],
    '--radius-card': radiusCard,
    '--radius-button': radiusButton,
    backgroundColor: cfg.corFundo || '#F8F9FA',
    color: cfg.corTexto || '#0F172A',
    fontFamily: fontMap[cfg.fontePrincipal] || fontMap['Plus Jakarta Sans'],
  } as React.CSSProperties;
}

export const PainelAdminConfig: React.FC<PainelAdminConfigProps> = ({
  role,
  userProfile,
  empresa,
  siteContent,
  partnersPublic = [],
  visaCategories,
  visaRequirements,
  legalSources,
  activeDiagnosticRules,
  auditLogs,
  onRefresh,
  onRefreshPublic,
  sectionGroup = 'todos',
}) => {
  const [tab, setTab] = useState<AdminTab>(
    sectionGroup === 'regras' ? 'regras' : sectionGroup === 'governanca' ? 'equipe' : 'aparencia',
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingEmpresa, setSavingEmpresa] = useState(false);
  const [fcmHealthMsg, setFcmHealthMsg] = useState<string | null>(null);
  const [fcmChecking, setFcmChecking] = useState(false);

  // Empresa & Aparência
  const [cfg, setCfg] = useState<EmpresaConfig>(empresa);

  // Bancário (admin only)
  const [bancario, setBancario] = useState<BancarioConfig | null>(null);
  const [bancarioOrig, setBancarioOrig] = useState<BancarioConfig | null>(null);

  // Equipe
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [editingMember, setEditingMember] = useState<UserProfile | null>(null);

  // Studio CMS (Rascunho separado de Publicado)
  const [siteDraft, setSiteDraft] = useState<SiteContent[]>(() => {
    const base = empresa.siteDraft && empresa.siteDraft.length > 0 ? empresa.siteDraft : siteContent;
    return [...base].sort((a, b) => a.ordem - b.ordem);
  });
  const [editingCms, setEditingCms] = useState<SiteContent | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [legalTextTab, setLegalTextTab] = useState<'contrato' | 'recibo' | 'lgpd' | null>(null);

  // Regras do Diagnóstico
  const [ruleVersions, setRuleVersions] = useState<DiagnosticRuleVersion[]>([activeDiagnosticRules]);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [draftRules, setDraftRules] = useState<DiagnosticRuleVersion>(() => ({
    ...activeDiagnosticRules,
    versao: `${activeDiagnosticRules.versao}-edicao`,
    resumoMudanca: '',
    regras: activeDiagnosticRules.regras.map((r) => ({ ...r })),
  }));
  const [draftTestGate, setDraftTestGate] = useState<{
    testedHash: string;
    allPassed: boolean;
    results: { id: number; nome: string; pass: boolean; esperado: string; obtido: string; detalhe: string }[];
  } | null>(null);
  const [publishingRules, setPublishingRules] = useState(false);

  // Testes Diagnóstico (30 perfis)
  const [testResults, setTestResults] = useState<
    { id: number; nome: string; pass: boolean; esperado: string; obtido: string; detalhe: string }[] | null
  >(null);

  // Auditoria filter
  const [auditFilter, setAuditFilter] = useState('');

  // Sincronização assíncrona caso empresa / siteContent / regras atualizem do servidor
  useEffect(() => {
    setCfg(empresa);
  }, [empresa]);

  useEffect(() => {
    const base = empresa.siteDraft && empresa.siteDraft.length > 0 ? empresa.siteDraft : siteContent;
    setSiteDraft([...base].sort((a, b) => a.ordem - b.ordem));
  }, [empresa.siteDraft, siteContent]);

  useEffect(() => {
    setDraftRules({
      ...activeDiagnosticRules,
      versao: `${activeDiagnosticRules.versao}-edicao`,
      resumoMudanca: '',
      regras: activeDiagnosticRules.regras.map((r) => ({ ...r })),
    });
  }, [activeDiagnosticRules]);

  const draftHash = useMemo(() => JSON.stringify(draftRules.regras), [draftRules.regras]);

  const staleLegalAlerts = useMemo(() => {
    const maxDays = cfg.diasAlertaRevisaoLegal || empresa.diasAlertaRevisaoLegal || 90;
    const nowMs = Date.now();
    const alerts: { ruleName: string; sourceTitle: string; motivo: string }[] = [];
    for (const rule of draftRules.regras) {
      if (!rule.ativa || !rule.legalSourceId) continue;
      const src = legalSources.find((s) => s.id === rule.legalSourceId);
      if (!src) {
        alerts.push({ ruleName: rule.nome, sourceTitle: rule.legalSourceId, motivo: 'Fonte legal vinculada não encontrada na biblioteca.' });
        continue;
      }
      if (src.statusVigencia !== 'Vigente') {
        alerts.push({ ruleName: rule.nome, sourceTitle: src.titulo, motivo: `Status da norma: ${src.statusVigencia}.` });
        continue;
      }
      const verTs = Date.parse(src.ultimaVerificacao || '');
      if (!verTs || (nowMs - verTs) / 86400000 > maxDays) {
        alerts.push({
          ruleName: rule.nome,
          sourceTitle: src.titulo,
          motivo: `Sem verificação legal há mais de ${maxDays} dias (${formatDateBR(src.ultimaVerificacao)}).`,
        });
      }
    }
    return alerts;
  }, [draftRules.regras, legalSources, cfg.diasAlertaRevisaoLegal, empresa.diasAlertaRevisaoLegal]);

  const impactPreview = useMemo(() => {
    let changedTop = 0;
    let totalScoreDelta = 0;
    let counted = 0;
    for (const prof of DIAGNOSTIC_TEST_PROFILES) {
      const baseRes = runDiagnosticEngine(prof.answers, visaCategories, visaRequirements, legalSources, {
        ruleVersion: activeDiagnosticRules,
        custosPadrao: empresa.custosPadrao,
      });
      const draftRes = runDiagnosticEngine(prof.answers, visaCategories, visaRequirements, legalSources, {
        ruleVersion: draftRules,
        custosPadrao: empresa.custosPadrao,
      });
      if (baseRes.recomendada?.visa.codigo !== draftRes.recomendada?.visa.codigo) changedTop += 1;
      if (baseRes.recomendada && draftRes.recomendada) {
        totalScoreDelta += draftRes.recomendada.nota - baseRes.recomendada.nota;
        counted += 1;
      }
    }
    return {
      changedTop,
      avgDelta: counted > 0 ? (totalScoreDelta / counted).toFixed(1) : '0.0',
    };
  }, [activeDiagnosticRules, draftRules, visaCategories, visaRequirements, legalSources, empresa.custosPadrao]);

  const filteredLogs = useMemo(() => {
    if (!auditFilter.trim()) return auditLogs;
    const q = auditFilter.toLowerCase();
    return auditLogs.filter(
      (l) =>
        l.acao.toLowerCase().includes(q) ||
        l.entidade.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q),
    );
  }, [auditLogs, auditFilter]);

  useEffect(() => {
    if (role !== 'admin') return;
    if (sectionGroup === 'site') {
      setTab((prev) => (prev === 'aparencia' || prev === 'cms' ? prev : 'aparencia'));
    } else if (sectionGroup === 'regras') {
      setTab((prev) => (prev === 'regras' || prev === 'testes' ? prev : 'regras'));
      if (!rulesLoaded) {
        void fetchAllDiagnosticRuleVersions().then((list) => {
          setRuleVersions(list);
          setRulesLoaded(true);
        });
      }
    } else if (sectionGroup === 'governanca') {
      setTab((prev) => (prev === 'equipe' || prev === 'bancario' || prev === 'auditoria' ? prev : 'equipe'));
      if (!usersLoaded) {
        void fetchUsersList().then((list) => {
          setUsersList(list);
          setUsersLoaded(true);
        });
      }
      if (!bancario) {
        void fetchBancarioConfigAdmin().then((b) => {
          setBancario(b);
          setBancarioOrig(b);
        });
      }
    }
  }, [sectionGroup, role, rulesLoaded, usersLoaded, bancario]);

  if (role !== 'admin') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        Área exclusiva de Administradores.
      </div>
    );
  }

  const layoutCfg: SiteLayoutConfig = cfg.layoutConfig || {};
  const navLinks =
    layoutCfg.linksNavegacao && layoutCfg.linksNavegacao.length > 0 ? layoutCfg.linksNavegacao : DEFAULT_NAV_LINKS;

  const updateLayout = (patch: Partial<SiteLayoutConfig>) => {
    setCfg((prev) => ({
      ...prev,
      layoutConfig: {
        ...(prev.layoutConfig || {}),
        ...patch,
      },
    }));
  };

  const applyThemePreset = (preset: ThemePreset) => {
    setCfg((prev) => ({
      ...prev,
      corPrimaria: preset.corPrimaria,
      corDestaque: preset.corDestaque,
      corFundo: preset.corFundo,
      corSuperficie: preset.corSuperficie,
      corTexto: preset.corTexto,
      corRodapeBg: preset.corRodapeBg,
      fonteDisplay: preset.fonteDisplay,
      fontePrincipal: preset.fontePrincipal,
      layoutConfig: {
        ...(prev.layoutConfig || {}),
        raioBordas: preset.raioBordas,
      },
    }));
    setFeedback(`Paleta "${preset.nome}" aplicada no editor. Clique em "Salvar Configurações e Layout" para publicar no site.`);
  };

  const loadBancario = async () => {
    const b = await fetchBancarioConfigAdmin();
    setBancario(b);
    setBancarioOrig(b);
  };

  const loadUsers = async () => {
    const list = await fetchUsersList();
    setUsersList(list);
    setUsersLoaded(true);
  };

  const loadRuleVersions = async () => {
    const list = await fetchAllDiagnosticRuleVersions();
    setRuleVersions(list);
    setRulesLoaded(true);
  };

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavingEmpresa(true);
    try {
      await saveEmpresaConfigAdmin(cfg, empresa);
      setFeedback('Identidade visual, logos, layout e configurações salvos e aplicados ao site!');
      await onRefreshPublic();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao salvar configurações.');
    } finally {
      setSavingEmpresa(false);
    }
  };

  const handleSaveBancario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bancario) return;
    await saveBancarioConfigAdmin(bancario, bancarioOrig || bancario);
    setBancarioOrig(bancario);
    setFeedback('Dados bancários internos salvos com sigilo (somente Admin).');
  };

  const handleSaveCmsDraftItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCms) return;
    setSiteDraft((prev) => {
      const exists = prev.some((s) => s.id === editingCms.id);
      const next = exists ? prev.map((s) => (s.id === editingCms.id ? editingCms : s)) : [...prev, editingCms];
      return next.sort((a, b) => a.ordem - b.ordem);
    });
    setEditingCms(null);
    setFeedback('Seção atualizada no Rascunho do Studio. Salve o rascunho ou clique em "Publicar Site" para ir ao ar.');
  };

  const handleCreateCustomBlock = () => {
    const nextOrd = siteDraft.length > 0 ? Math.max(...siteDraft.map((s) => s.ordem)) + 1 : 1;
    const newBlock: SiteContent = {
      id: makeId('sec'),
      secao: 'bloco_livre',
      titulo: 'Novo Bloco Personalizado',
      subtitulo: 'Adicione um subtítulo explicativo para esta nova seção.',
      conteudoHtml: 'Descreva aqui diferenciais, novidades, avisos ou orientações para brasileiros no Chile.',
      imagemUrl: '',
      ctaTexto: 'Fazer Diagnóstico',
      ctaDestino: '/diagnostico',
      ordem: nextOrd,
      ativo: true,
      metadados: {
        eyebrow: 'Seção Especial',
        varianteLayout: 'texto-imagem-direita',
        temaSecao: 'claro',
        imagemObjectFit: 'cover',
      },
    };
    setEditingCms(newBlock);
  };

  const handleDuplicateSection = (sec: SiteContent) => {
    const nextOrd = siteDraft.length > 0 ? Math.max(...siteDraft.map((s) => s.ordem)) + 1 : 1;
    const dup: SiteContent = {
      ...sec,
      id: makeId('sec'),
      secao: 'bloco_livre',
      titulo: `${sec.titulo} (Cópia)`,
      ordem: nextOrd,
      ativo: true,
      metadados: {
        ...(sec.metadados || {}),
        varianteLayout: sec.imagemUrl ? 'texto-imagem-direita' : 'centralizado',
      },
    };
    setSiteDraft((prev) => [...prev, dup].sort((a, b) => a.ordem - b.ordem));
    setFeedback(`Bloco duplicado a partir de "${sec.titulo}".`);
  };

  const handleDeleteCustomSection = (id: string) => {
    setSiteDraft((prev) =>
      prev
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, ordem: idx + 1 })),
    );
    setFeedback('Bloco personalizado removido do rascunho.');
  };

  const handleMoveDraftSection = (id: string, dir: -1 | 1) => {
    setSiteDraft((prev) => {
      const sorted = [...prev].sort((a, b) => a.ordem - b.ordem);
      const idx = sorted.findIndex((s) => s.id === id);
      const targetIdx = idx + dir;
      if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return prev;
      const copy = [...sorted];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy.map((s, i) => ({ ...s, ordem: i + 1 }));
    });
  };

  const handleSaveDraftToServer = async () => {
    const nextCfg: EmpresaConfig = {
      ...cfg,
      siteDraft,
    };
    await saveEmpresaConfigAdmin(nextCfg, empresa);
    setCfg(nextCfg);
    setFeedback('Rascunho do site salvo com segurança (o site público permanece inalterado até publicar).');
    await onRefreshPublic();
  };

  const handlePublishSite = async () => {
    setErrorMsg(null);
    const now = new Date().toISOString();
    const curVerNum = Number.parseInt((cfg.siteVersaoAtual || 'v1').replace(/\D/g, '') || '1', 10);
    const nextVersao = `v${curVerNum + 1}`;
    const prevSnapshot = {
      versao: cfg.siteVersaoAtual || 'v1',
      publicadoEm: cfg.sitePublicadoEm || now,
      publicadoPor: userProfile.email,
      secoes: siteContent,
    };
    const nextHistorico = [prevSnapshot, ...(cfg.siteHistorico || [])].slice(0, 10);

    await Promise.all(
      siteDraft.map((sec) =>
        saveDocumentAudited(
          'siteContent',
          sec.id,
          sec as unknown as Record<string, unknown>,
          false,
          role,
          `publicar_cms_${sec.secao}`,
        ),
      ),
    );

    const nextCfg: EmpresaConfig = {
      ...cfg,
      siteDraft,
      sitePublicadoEm: now,
      siteVersaoAtual: nextVersao,
      siteHistorico: nextHistorico,
    };
    await saveEmpresaConfigAdmin(nextCfg, empresa);
    setCfg(nextCfg);
    setFeedback(`Site público publicado (${nextVersao}) com todas as seções, layout, logos e mídias!`);
    await Promise.all([onRefresh(), onRefreshPublic()]);
  };

  const handleRestoreSiteVersion = async (histItem: NonNullable<EmpresaConfig['siteHistorico']>[number]) => {
    setSiteDraft([...histItem.secoes].sort((a, b) => a.ordem - b.ordem));
    await Promise.all(
      histItem.secoes.map((sec) =>
        saveDocumentAudited(
          'siteContent',
          sec.id,
          sec as unknown as Record<string, unknown>,
          false,
          role,
          `restaurar_cms_${histItem.versao}`,
        ),
      ),
    );
    const nextCfg: EmpresaConfig = {
      ...cfg,
      siteDraft: histItem.secoes,
      sitePublicadoEm: new Date().toISOString(),
      siteVersaoAtual: `${histItem.versao}-restaurada`,
    };
    await saveEmpresaConfigAdmin(nextCfg, empresa);
    setCfg(nextCfg);
    setFeedback(`Versão ${histItem.versao} restaurada e publicada no site!`);
    await Promise.all([onRefresh(), onRefreshPublic()]);
  };

  const updateDraftRuleItem = (id: string, patch: Partial<DiagnosticRuleItem>) => {
    setDraftRules((prev) => ({
      ...prev,
      regras: prev.regras.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const handleRunDraftTests = () => {
    const results = DIAGNOSTIC_TEST_PROFILES.map((prof) => {
      const res = runDiagnosticEngine(prof.answers, visaCategories, visaRequirements, legalSources, {
        ruleVersion: draftRules,
        custosPadrao: empresa.custosPadrao,
        honorariosMinBrl: draftRules.honorariosMinBrl,
        honorariosMaxBrl: draftRules.honorariosMaxBrl,
        taxaCambioBrlClp: draftRules.taxaCambioBrlClp,
        taxaCambioUsdBrl: draftRules.taxaCambioUsdBrl,
      });
      const check = prof.assertCheck(res);
      return { id: prof.id, nome: prof.nome, ...check };
    });
    const allPassed = results.every((r) => r.pass);
    setDraftTestGate({ testedHash: draftHash, allPassed, results });
  };

  const handlePublishRules = async () => {
    setErrorMsg(null);
    if (!draftTestGate || draftTestGate.testedHash !== draftHash || !draftTestGate.allPassed) {
      setErrorMsg('Execute os 30 testes com sucesso neste rascunho antes de publicar.');
      return;
    }
    if (!draftRules.versao.trim()) {
      setErrorMsg('Informe o identificador da nova versão das regras (ex.: v2.2).');
      return;
    }
    setPublishingRules(true);
    try {
      const newVersion: DiagnosticRuleVersion = {
        ...draftRules,
        id: makeId('rules'),
        versao: draftRules.versao.trim(),
        dataPublicacao: new Date().toISOString().slice(0, 10),
        publicadoPor: userProfile.email,
        ativa: true,
        resumoMudanca: draftRules.resumoMudanca.trim() || 'Ajuste de parâmetros pelo administrador',
      };
      await publishDiagnosticRuleVersion(newVersion, activeDiagnosticRules, role);
      setFeedback(`Nova versão ${newVersion.versao} publicada e registrada na Auditoria!`);
      await onRefreshPublic();
      await onRefresh();
      await loadRuleVersions();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao publicar versão das regras.');
    } finally {
      setPublishingRules(false);
    }
  };

  const handleRun30Profiles = () => {
    const results = DIAGNOSTIC_TEST_PROFILES.map((prof) => {
      const res = runDiagnosticEngine(prof.answers, visaCategories, visaRequirements, legalSources, {
        ruleVersion: activeDiagnosticRules,
        custosPadrao: empresa.custosPadrao,
      });
      const check = prof.assertCheck(res);
      return { id: prof.id, nome: prof.nome, ...check };
    });
    setTestResults(results);
  };

  const handleDownloadBackupJson = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      empresa,
      siteContent,
      visaCategories,
      visaRequirements,
      legalSources,
      auditLogsCount: auditLogs.length,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-dm-integra-chile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper para editar metadados estruturados da seção atual
  const updateEditingMeta = (patch: Record<string, unknown>) => {
    setEditingCms((prev) =>
      prev
        ? {
            ...prev,
            metadados: {
              ...(prev.metadados || {}),
              ...patch,
            },
          }
        : null,
    );
  };

  const editMeta = (editingCms?.metadados || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {sectionGroup === 'site'
            ? 'Site, Logos & Studio CMS'
            : sectionGroup === 'regras'
              ? 'Motor & Regras do Diagnóstico'
              : sectionGroup === 'governanca'
                ? 'Equipe, Dados Bancários & Auditoria'
                : 'Administração, Studio Visual, Mídias & Auditoria'}
        </h1>
        <p className="text-xs text-slate-500">
          {sectionGroup === 'site'
            ? 'Personalize identidade visual, logos, fontes, layout completo, seções do site e textos legais'
            : sectionGroup === 'regras'
              ? 'Edite pesos, critérios de elegibilidade, histórico de versões e execute os 30 perfis de teste'
              : sectionGroup === 'governanca'
                ? 'Gerencie colaboradores e permissões, dados bancários internos (sigilo Admin) e trilha de auditoria'
                : 'Personalize identidade visual, logos, fontes, layout completo, seções do site, equipe, dados bancários e regras do motor'}
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          ...(sectionGroup === 'todos' || sectionGroup === 'site'
            ? [
                { id: 'aparencia', label: 'Identidade, Logos & Layout' },
                { id: 'cms', label: `Studio do Site (${siteDraft.length})` },
              ]
            : []),
          ...(sectionGroup === 'todos' || sectionGroup === 'regras'
            ? [
                { id: 'regras', label: 'Regras do Diagnóstico' },
                { id: 'testes', label: 'Testar Diagnóstico (30 Perfis)' },
              ]
            : []),
          ...(sectionGroup === 'todos' || sectionGroup === 'governanca'
            ? [
                { id: 'equipe', label: 'Equipe & Quem Somos' },
                { id: 'bancario', label: 'Dados Bancários' },
                { id: 'auditoria', label: `Auditoria (${auditLogs.length})` },
              ]
            : []),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id as AdminTab);
              if (t.id === 'bancario' && !bancario) void loadBancario();
              if (t.id === 'equipe' && !usersLoaded) void loadUsers();
              if (t.id === 'regras' && !rulesLoaded) void loadRuleVersions();
            }}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap ${
              tab === t.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C82333] font-medium">
          {errorMsg}
        </div>
      )}

      {/* IDENTIDADE, LOGOS & LAYOUT */}
      {tab === 'aparencia' && (
        <form onSubmit={handleSaveEmpresa} className="space-y-6">
          {/* Bloco 1: Importação de Logos & Favicon */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
                  Logos, Marca &amp; Favicon (Importação + Galeria)
                </h2>
                <p className="text-xs text-slate-500">
                  Importe arquivos PNG (com fundo transparente), SVG vetorial, WEBP, JPG ou ICO. As imagens otimizadas ficam salvas com segurança no banco de dados.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MediaAssetPicker
                label="Logo Principal (Cabeçalho Claro & Portal)"
                value={cfg.logoUrl}
                onChange={(url) => setCfg({ ...cfg, logoUrl: url })}
                preset="logo"
                role={role}
                actorEmail={userProfile.email}
                hint="Recomendado: PNG ou SVG horizontal transparente. Exibido no topo do site, login e painel."
              />
              <MediaAssetPicker
                label="Logo Negativo / Rodapé Escuro (Opcional)"
                value={cfg.logoDarkUrl || ''}
                onChange={(url) => setCfg({ ...cfg, logoDarkUrl: url })}
                preset="logo"
                role={role}
                actorEmail={userProfile.email}
                hint="Versão clara/branca do logotipo para o rodapé escuro. Se vazio, usa o Logo Principal."
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
              <div className="lg:col-span-2">
                <MediaAssetPicker
                  label="Favicon (Ícone da Aba do Navegador)"
                  value={cfg.faviconUrl || ''}
                  onChange={(url) => setCfg({ ...cfg, faviconUrl: url })}
                  preset="favicon"
                  role={role}
                  actorEmail={userProfile.email}
                  compact
                  hint="Ícone quadrado (PNG, SVG ou ICO 128×128px) exibido na aba do navegador."
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                    <span>Altura do Logo no Cabeçalho</span>
                    <span className="tabular-nums text-[var(--color-primary)]">{layoutCfg.logoAlturaPx ?? 36} px</span>
                  </div>
                  <input
                    type="range"
                    min={24}
                    max={60}
                    step={2}
                    value={layoutCfg.logoAlturaPx ?? 36}
                    onChange={(e) => updateLayout({ logoAlturaPx: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
                <label className="flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layoutCfg.mostrarNomeComLogo !== false}
                    onChange={(e) => updateLayout({ mostrarNomeComLogo: e.target.checked })}
                  />
                  Mostrar nome da marca ao lado do logo
                </label>
              </div>
            </div>
          </section>

          {/* Bloco 2: Paleta de Cores, Tipografia & Geometria */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Palette className="w-4 h-4 text-[var(--color-primary)]" />
                Tema Visual, Cores, Fontes &amp; Geometria
              </h2>
              <p className="text-xs text-slate-500">
                Aplique um tema completo em 1 clique ou ajuste cada cor e fonte individualmente.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {THEME_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyThemePreset(preset)}
                  className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-400 text-left transition-all"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: preset.corPrimaria }} />
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: preset.corDestaque }} />
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: preset.corFundo }} />
                    <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: preset.corRodapeBg }} />
                  </div>
                  <p className="text-xs font-bold text-slate-900">{preset.nome}</p>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{preset.descricao}</p>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cor Primária</label>
                <input
                  type="color"
                  value={cfg.corPrimaria}
                  onChange={(e) => setCfg({ ...cfg, corPrimaria: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cor Destaque</label>
                <input
                  type="color"
                  value={cfg.corDestaque}
                  onChange={(e) => setCfg({ ...cfg, corDestaque: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Fundo da Página</label>
                <input
                  type="color"
                  value={cfg.corFundo}
                  onChange={(e) => setCfg({ ...cfg, corFundo: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cards / Superfícies</label>
                <input
                  type="color"
                  value={cfg.corSuperficie || '#FFFFFF'}
                  onChange={(e) => setCfg({ ...cfg, corSuperficie: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cor do Texto</label>
                <input
                  type="color"
                  value={cfg.corTexto || '#0F172A'}
                  onChange={(e) => setCfg({ ...cfg, corTexto: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Rodapé Escuro</label>
                <input
                  type="color"
                  value={cfg.corRodapeBg || '#0B1B29'}
                  onChange={(e) => setCfg({ ...cfg, corRodapeBg: e.target.value })}
                  className="w-full h-10 rounded-lg border border-slate-300 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fonte dos Títulos (Display)</label>
                <select
                  value={cfg.fonteDisplay || 'Plus Jakarta Sans'}
                  onChange={(e) => setCfg({ ...cfg, fonteDisplay: e.target.value as DisplayFontChoice })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="Outfit">Outfit (Moderno Geométrico)</option>
                  <option value="Manrope">Manrope (Consultoria Técnica)</option>
                  <option value="Playfair Display">Playfair Display (Editorial Clássico)</option>
                  <option value="Montserrat">Montserrat</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fonte dos Textos (Corpo)</label>
                <select
                  value={cfg.fontePrincipal}
                  onChange={(e) => setCfg({ ...cfg, fontePrincipal: e.target.value as FontChoice })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                  <option value="DM Sans">DM Sans</option>
                  <option value="Manrope">Manrope</option>
                  <option value="Public Sans">Public Sans</option>
                  <option value="Montserrat">Montserrat</option>
                  <option value="Merriweather">Merriweather</option>
                  <option value="Inter">Inter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Geometria / Raio das Bordas</label>
                <select
                  value={layoutCfg.raioBordas || 'editorial'}
                  onChange={(e) => updateLayout({ raioBordas: e.target.value as SiteLayoutConfig['raioBordas'] })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="sharp">Retas &amp; Precisas (Sharp)</option>
                  <option value="editorial">Editorial Equilibrado (Padrão)</option>
                  <option value="arredondado">Suaves &amp; Arredondadas</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Espaçamento das Seções</label>
                <select
                  value={layoutCfg.densidadeSecoes || 'equilibrada'}
                  onChange={(e) => updateLayout({ densidadeSecoes: e.target.value as SiteLayoutConfig['densidadeSecoes'] })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="compacta">Compacto (Mais denso)</option>
                  <option value="equilibrada">Equilibrado (Padrão)</option>
                  <option value="ampla">Amplo (Editorial respirado)</option>
                </select>
              </div>
            </div>
          </section>

          {/* Bloco 3: Estrutura do Cabeçalho, Menu de Navegação e Rodapé */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layout className="w-4 h-4 text-[var(--color-primary)]" />
                Cabeçalho, Menu de Navegação, Rodapé &amp; Botões Flutuantes
              </h2>
              <p className="text-xs text-slate-500">
                Controle rótulos do menu superior, botão de destaque do cabeçalho, textos do rodapé e ações móveis.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Estilo do Cabeçalho</label>
                <select
                  value={layoutCfg.estiloCabecalho || 'sticky_vidro'}
                  onChange={(e) => updateLayout({ estiloCabecalho: e.target.value as SiteLayoutConfig['estiloCabecalho'] })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="sticky_vidro">Fixo com Efeito Vidro (Sticky Glass)</option>
                  <option value="solido">Fixo Sólido com Sombra</option>
                  <option value="minimal">Estático Minimalista</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Texto do Botão do Cabeçalho</label>
                <input
                  value={layoutCfg.textoCtaCabecalho ?? 'Área da equipe'}
                  onChange={(e) => updateLayout({ textoCtaCabecalho: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Destino do Botão do Cabeçalho</label>
                <input
                  value={layoutCfg.destinoCtaCabecalho ?? '/entrar-equipe'}
                  onChange={(e) => updateLayout({ destinoCtaCabecalho: e.target.value })}
                  placeholder="/entrar-equipe ou /diagnostico"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-800">Links do Menu Principal (Cabeçalho &amp; Rodapé)</p>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                {navLinks.map((lnk, idx) => (
                  <div key={lnk.path} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-slate-500">{lnk.path}</span>
                      <label className="inline-flex items-center gap-1 text-[11px] font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={lnk.visivel !== false}
                          onChange={(e) => {
                            const updated = navLinks.map((x, i) =>
                              i === idx ? { ...x, visivel: e.target.checked } : x,
                            );
                            updateLayout({ linksNavegacao: updated });
                          }}
                        />
                        Visível
                      </label>
                    </div>
                    <input
                      value={lnk.label}
                      onChange={(e) => {
                        const updated = navLinks.map((x, i) =>
                          i === idx ? { ...x, label: e.target.value } : x,
                        );
                        updateLayout({ linksNavegacao: updated });
                      }}
                      className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subtítulo Institucional do Rodapé</label>
                <input
                  value={layoutCfg.rodapeSubtitulo ?? ''}
                  onChange={(e) => updateLayout({ rodapeSubtitulo: e.target.value })}
                  placeholder="Consultoria especializada em imigração..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Texto de Copyright do Rodapé</label>
                <input
                  value={layoutCfg.rodapeCopyright ?? 'Todos os direitos reservados.'}
                  onChange={(e) => updateLayout({ rodapeCopyright: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-6 pt-1 text-xs">
              <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layoutCfg.mostrarBotaoWhatsappFlutuante !== false}
                  onChange={(e) => updateLayout({ mostrarBotaoWhatsappFlutuante: e.target.checked })}
                />
                Exibir botão flutuante do WhatsApp (Desktop)
              </label>
              <label className="inline-flex items-center gap-2 font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={layoutCfg.mostrarBarraCtaMobile !== false}
                  onChange={(e) => updateLayout({ mostrarBarraCtaMobile: e.target.checked })}
                />
                Exibir barra fixa de ação no rodapé Mobile
              </label>
            </div>
          </section>

          {/* Bloco 4: Dados Institucionais, Contatos, Câmbio, Parâmetros & Textos Jurídicos */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-900">Dados Institucionais, Canais &amp; Parâmetros Operacionais</h2>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
              Atuação como <strong>Pessoa Física</strong> com a marca de exposição <strong>D&amp;M Integra Chile</strong> (sem necessidade de CNPJ ou RUT). Preencha seu nome completo e CPF opcional nos campos abaixo quando desejar exibir nos contratos e recibos.
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome de Exposição / Marca (Pessoa Física)</label>
                <input
                  value={cfg.nome_empresa}
                  onChange={(e) => setCfg({ ...cfg, nome_empresa: e.target.value })}
                  placeholder="D&M Integra Chile – Relocation & Assessoria"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Identificação Pessoa Física / Marca (CPF opcional)</label>
                <input
                  value={cfg.razao_social_cnpj_rut}
                  onChange={(e) => setCfg({ ...cfg, razao_social_cnpj_rut: e.target.value })}
                  placeholder="Atuação como Pessoa Física · Marca própria D&M Integra Chile"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Titular / Responsável (Pessoa Física)</label>
                <input
                  value={cfg.responsavel_tecnico}
                  onChange={(e) => setCfg({ ...cfg, responsavel_tecnico: e.target.value })}
                  placeholder="Seu nome completo (Pessoa Física)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Base / Cidades de Atendimento</label>
                <input
                  value={cfg.endereco_cidade}
                  onChange={(e) => setCfg({ ...cfg, endereco_cidade: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Foro / Comarca</label>
                <input
                  value={cfg.foro_comarca}
                  onChange={(e) => setCfg({ ...cfg, foro_comarca: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Oficial</label>
                <input
                  value={cfg.whatsapp}
                  onChange={(e) => setCfg({ ...cfg, whatsapp: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instagram / Rede Social</label>
                <input
                  value={cfg.siteInstagram}
                  onChange={(e) => setCfg({ ...cfg, siteInstagram: e.target.value })}
                  placeholder="https://instagram.com/..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">LinkedIn Oficial (Opcional)</label>
                <input
                  value={cfg.siteLinkedIn || ''}
                  onChange={(e) => setCfg({ ...cfg, siteLinkedIn: e.target.value })}
                  placeholder="https://linkedin.com/company/..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Link Calendly</label>
                <input
                  value={cfg.linkCalendly}
                  onChange={(e) => setCfg({ ...cfg, linkCalendly: e.target.value })}
                  placeholder="https://calendly.com/..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chave Pix</label>
                <input
                  value={cfg.chavePix}
                  onChange={(e) => setCfg({ ...cfg, chavePix: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Link Pagamento Cartão</label>
                <input
                  value={cfg.linkPagamentoCartao}
                  onChange={(e) => setCfg({ ...cfg, linkPagamentoCartao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Oficial</label>
                <input
                  value={cfg.email}
                  onChange={(e) => setCfg({ ...cfg, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bloqueio Mínimo Protocolo (%)</label>
                <input
                  type="number"
                  min={50}
                  max={100}
                  value={cfg.bloqueioProtocoloMinimo}
                  onChange={(e) => setCfg({ ...cfg, bloqueioProtocoloMinimo: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Alerta Revisão Legal (dias)</label>
                <input
                  type="number"
                  min={15}
                  max={365}
                  value={cfg.diasAlertaRevisaoLegal}
                  onChange={(e) => setCfg({ ...cfg, diasAlertaRevisaoLegal: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expiração Link Diagnóstico (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={cfg.diasExpiracaoLinkDiagnostico ?? 30}
                  onChange={(e) => setCfg({ ...cfg, diasExpiracaoLinkDiagnostico: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Câmbio Referência: 1 BRL = ? CLP</label>
                <input
                  type="number"
                  min={10}
                  step="0.5"
                  value={cfg.taxaCambioBrlClp ?? 175}
                  onChange={(e) => setCfg({ ...cfg, taxaCambioBrlClp: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Câmbio Referência: 1 USD = ? BRL</label>
                <input
                  type="number"
                  min={1}
                  step="0.05"
                  value={cfg.taxaCambioUsdBrl ?? 5.7}
                  onChange={(e) => setCfg({ ...cfg, taxaCambioUsdBrl: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Retenção LGPD (dias)</label>
                <input
                  type="number"
                  min={180}
                  max={3650}
                  value={cfg.retencaoDadosDias ?? 1825}
                  onChange={(e) => setCfg({ ...cfg, retencaoDadosDias: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Referência Interna Honorários Mín (BRL)</label>
                <input
                  type="number"
                  min={0}
                  value={cfg.honorariosPadraoMinBrl ?? 2900}
                  onChange={(e) => setCfg({ ...cfg, honorariosPadraoMinBrl: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Referência Interna Honorários Máx (BRL)</label>
                <input
                  type="number"
                  min={0}
                  value={cfg.honorariosPadraoMaxBrl ?? 5800}
                  onChange={(e) => setCfg({ ...cfg, honorariosPadraoMaxBrl: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Aviso Legal no Rodapé</label>
                <input
                  value={cfg.avisoLegal}
                  onChange={(e) => setCfg({ ...cfg, avisoLegal: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            {/* SEO Padrão */}
            <div className="pt-4 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título SEO Padrão</label>
                <input
                  value={cfg.seoTituloPadrao || ''}
                  onChange={(e) => setCfg({ ...cfg, seoTituloPadrao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Descrição SEO Padrão</label>
                <input
                  value={cfg.seoDescricaoPadrao || ''}
                  onChange={(e) => setCfg({ ...cfg, seoDescricaoPadrao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            {/* Notificações Push (Firebase Cloud Messaging — Web Push) */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-[var(--color-primary)]" />
                    Notificações Push para Clientes (Firebase Cloud Messaging)
                  </p>
                  <p className="text-xs text-slate-500">
                    Cole a chave pública do par de certificados Web Push obtida em Firebase Console → Configurações do projeto → Cloud Messaging.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={fcmChecking}
                  onClick={async () => {
                    setFcmChecking(true);
                    setFcmHealthMsg(null);
                    try {
                      const token = auth.currentUser ? await auth.currentUser.getIdToken() : '';
                      const resp = await fetch('/api/notifications/health', {
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                      });
                      const data = (await resp.json()) as {
                        ok?: boolean;
                        vapidEnvConfigured?: boolean;
                        error?: string;
                      };
                      const hasEffectiveVapid = Boolean(getEffectiveVapidKey(cfg));
                      if (resp.ok && data.ok) {
                        setFcmHealthMsg(
                          hasEffectiveVapid
                            ? 'Serviço FCM ativo e chave pública Web Push (VAPID) configurada.'
                            : 'Servidor pronto para FCM. Falta preencher a Chave Pública Web Push (VAPID) abaixo e salvar.',
                        );
                      } else {
                        setFcmHealthMsg(data.error || 'Não foi possível verificar o endpoint FCM.');
                      }
                    } catch (err) {
                      setFcmHealthMsg(err instanceof Error ? err.message : 'Erro ao verificar FCM.');
                    } finally {
                      setFcmChecking(false);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {fcmChecking ? 'Verificando...' : 'Verificar Status FCM'}
                </button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chave Pública Web Push (VAPID Key — FCM)
                </label>
                <input
                  value={cfg.fcmVapidPublicKey || ''}
                  onChange={(e) => setCfg({ ...cfg, fcmVapidPublicKey: e.target.value })}
                  placeholder="Ex.: BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
                />
              </div>
              {fcmHealthMsg && (
                <p className="text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {fcmHealthMsg}
                </p>
              )}
            </div>

            {/* Textos-Base Editáveis com Versionamento & Vigência */}
            <div className="pt-4 border-t border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">Textos-Base Jurídicos e Termos (Versionados)</p>
                  <p className="text-[11px] text-amber-800">
                    Nota jurídica interna: modelos de contrato, recibo e termo LGPD devem ser revisados por advogado antes do uso.
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['contrato', 'recibo', 'lgpd'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setLegalTextTab(legalTextTab === k ? null : k)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                        legalTextTab === k ? 'border-[var(--color-primary)] bg-slate-900 text-white' : 'border-slate-300 text-slate-700'
                      }`}
                    >
                      {k === 'contrato' ? 'Contrato Padrão' : k === 'recibo' ? 'Recibo Padrão' : 'Termo LGPD'}
                    </button>
                  ))}
                </div>
              </div>

              {legalTextTab === 'contrato' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Versão do Contrato</label>
                      <input
                        value={cfg.textoContratoVersao || '1.0'}
                        onChange={(e) => setCfg({ ...cfg, textoContratoVersao: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Vigência</label>
                      <input
                        type="date"
                        value={cfg.textoContratoVigencia || ''}
                        onChange={(e) => setCfg({ ...cfg, textoContratoVigencia: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <textarea
                    rows={8}
                    value={cfg.textoContratoPadrao}
                    onChange={(e) => setCfg({ ...cfg, textoContratoPadrao: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                  />
                </div>
              )}

              {legalTextTab === 'recibo' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Versão do Recibo</label>
                      <input
                        value={cfg.textoReciboVersao || '1.0'}
                        onChange={(e) => setCfg({ ...cfg, textoReciboVersao: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Vigência</label>
                      <input
                        type="date"
                        value={cfg.textoReciboVigencia || ''}
                        onChange={(e) => setCfg({ ...cfg, textoReciboVigencia: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <textarea
                    rows={6}
                    value={cfg.textoReciboPadrao}
                    onChange={(e) => setCfg({ ...cfg, textoReciboPadrao: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                  />
                </div>
              )}

              {legalTextTab === 'lgpd' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Versão do Termo LGPD</label>
                      <input
                        value={cfg.termoLgpdVersao}
                        onChange={(e) => setCfg({ ...cfg, termoLgpdVersao: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Data de Vigência</label>
                      <input
                        type="date"
                        value={cfg.termoLgpdVigencia || ''}
                        onChange={(e) => setCfg({ ...cfg, termoLgpdVigencia: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                      />
                    </div>
                  </div>
                  <textarea
                    rows={6}
                    value={cfg.termoLgpd}
                    onChange={(e) => setCfg({ ...cfg, termoLgpd: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono bg-white"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={savingEmpresa}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {savingEmpresa ? 'Salvando...' : 'Salvar Configurações, Logos e Layout'}
              </button>
              <button
                type="button"
                onClick={handleDownloadBackupJson}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
              >
                <Download className="w-3.5 h-3.5" />
                Exportar Backup JSON
              </button>
            </div>
          </section>
        </form>
      )}

      {/* CMS DO SITE STUDIO */}
      {tab === 'cms' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Studio do Site Público (Versão publicada: {cfg.siteVersaoAtual || 'v1'})
              </h2>
              <p className="text-xs text-slate-500">
                Crie blocos personalizados, escolha variantes de layout, edite itens internos, importe imagens e teste na prévia real antes de publicar.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCreateCustomBlock}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Seção (Bloco Livre)
              </button>
              <button
                type="button"
                onClick={() => setShowLivePreview((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Eye className="w-3.5 h-3.5" />
                {showLivePreview ? 'Ocultar Prévia' : 'Prévia ao Vivo'}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveDraftToServer()}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Salvar Rascunho
              </button>
              <button
                type="button"
                onClick={() => void handlePublishSite()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Publicar Site
              </button>
            </div>
          </div>

          {showLivePreview && (
            <div className="bg-slate-900 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-white">
                <span className="font-semibold">Pré-visualização Fiel do Rascunho (Com Tema, Logos e Variantes Atuais)</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewMode('desktop')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded ${
                      previewMode === 'desktop' ? 'bg-white text-slate-900 font-semibold' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewMode('mobile')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded ${
                      previewMode === 'mobile' ? 'bg-white text-slate-900 font-semibold' : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" /> 390px
                  </button>
                </div>
              </div>
              <div
                className={`mx-auto rounded-xl border border-slate-700 overflow-hidden shadow-2xl ${
                  previewMode === 'mobile' ? 'max-w-[390px]' : 'w-full'
                }`}
                style={computePreviewCssVars(cfg)}
              >
                {/* Mini Header fiel */}
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 min-w-0">
                    {cfg.logoUrl && (
                      <img
                        src={cfg.logoUrl}
                        alt={cfg.nome_empresa}
                        style={{ height: `${Math.min(40, Math.max(22, layoutCfg.logoAlturaPx || 32))}px` }}
                        className="w-auto object-contain"
                      />
                    )}
                    {(layoutCfg.mostrarNomeComLogo !== false || !cfg.logoUrl) && (
                      <span className="text-xs font-bold truncate" style={{ color: cfg.corTexto || '#0F172A' }}>
                        {cfg.nome_empresa.split('–')[0].trim()}
                      </span>
                    )}
                  </div>
                  {previewMode === 'desktop' && (
                    <div className="hidden md:flex items-center gap-4 text-[11px] font-medium text-slate-600">
                      {navLinks
                        .filter((l) => l.visivel !== false)
                        .map((l) => (
                          <span key={l.path}>{l.label}</span>
                        ))}
                    </div>
                  )}
                  <span
                    className="px-2.5 py-1 btn-radius text-[10px] font-semibold text-white shrink-0"
                    style={{ backgroundColor: cfg.corPrimaria }}
                  >
                    {layoutCfg.textoCtaCabecalho || 'Área da equipe'}
                  </span>
                </div>

                {/* Corpo Real do Site Renderizado */}
                <div className="max-h-[540px] overflow-y-auto">
                  <HomeSectionsView
                    empresa={cfg}
                    siteContent={siteDraft}
                    partnersPublic={partnersPublic}
                    onNavigate={() => {}}
                    previewMode
                  />
                  {/* Mini Footer fiel */}
                  <div
                    className="px-6 py-6 text-slate-300 text-xs flex flex-wrap items-center justify-between gap-3"
                    style={{ backgroundColor: cfg.corRodapeBg || '#0B1B29' }}
                  >
                    <div className="flex items-center gap-2.5">
                      {(cfg.logoDarkUrl || cfg.logoUrl) && (
                        <img
                          src={cfg.logoDarkUrl || cfg.logoUrl}
                          alt={cfg.nome_empresa}
                          className="h-6 w-auto object-contain"
                        />
                      )}
                      <span className="font-semibold text-white">{cfg.nome_empresa}</span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      © {new Date().getFullYear()} · {layoutCfg.rodapeCopyright || 'Todos os direitos reservados.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lista Ordenável de Seções */}
          <div className="space-y-3">
            {siteDraft
              .slice()
              .sort((a, b) => a.ordem - b.ordem)
              .map((sec, idx) => {
                const secMeta = (sec.metadados || {}) as Record<string, unknown>;
                return (
                  <div
                    key={sec.id}
                    className={`bg-white border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      sec.ativo ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-75'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {sec.imagemUrl && (
                        <img
                          src={sec.imagemUrl}
                          alt=""
                          className="w-14 h-12 rounded-lg object-cover border border-slate-200 shrink-0 hidden sm:block"
                        />
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          #{sec.ordem} · {sec.secao}
                          {secMeta.varianteLayout ? ` · ${String(secMeta.varianteLayout)}` : ''}
                          {' · '}
                          {sec.ativo ? 'Visível' : 'Oculta'}
                        </p>
                        <p className="text-sm font-bold text-slate-900 truncate">{sec.titulo}</p>
                        <p className="text-xs text-slate-600 line-clamp-1">{sec.subtitulo}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveDraftSection(sec.id, -1)}
                        aria-label={`Subir seção ${sec.secao}`}
                        className="p-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === siteDraft.length - 1}
                        onClick={() => handleMoveDraftSection(sec.id, 1)}
                        aria-label={`Descer seção ${sec.secao}`}
                        className="p-1.5 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSiteDraft((prev) =>
                            prev.map((x) => (x.id === sec.id ? { ...x, ativo: !x.ativo } : x)),
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700"
                      >
                        {sec.ativo ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {sec.ativo ? 'Ocultar' : 'Ativar'}
                      </button>
                      {sec.secao !== 'rodape' && (
                        <button
                          type="button"
                          onClick={() => handleDuplicateSection(sec)}
                          title="Duplicar como Bloco Livre"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {sec.secao === 'bloco_livre' && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomSection(sec.id)}
                          title="Excluir bloco personalizado"
                          className="p-1.5 rounded-lg border border-red-200 text-[#C82333] hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEditingCms(sec)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Depoimentos Autorizados */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Depoimentos de Clientes (Exibição Condicional)</h3>
                <p className="text-xs text-slate-500">
                  Apenas depoimentos marcados como &ldquo;Autorizado pelo cliente&rdquo; aparecem no site público quando a seção Depoimentos estiver ativa.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setCfg((prev) => ({
                    ...prev,
                    depoimentosAutorizados: [
                      ...(prev.depoimentosAutorizados || []),
                      {
                        id: makeId('dep'),
                        nome: 'Nome do Cliente',
                        cidadeOrigem: 'São Paulo - SP',
                        subcategoria: 'Residência Temporal Mercosul',
                        depoimento: '',
                        autorizado: false,
                        dataAutorizacao: new Date().toISOString().slice(0, 10),
                      },
                    ],
                  }))
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Depoimento
              </button>
            </div>

            {(cfg.depoimentosAutorizados || []).length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum depoimento cadastrado (a seção fica oculta automaticamente ao público).</p>
            ) : (
              <div className="space-y-3">
                {(cfg.depoimentosAutorizados || []).map((dep, idx) => (
                  <div key={dep.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                    <input
                      value={dep.nome}
                      onChange={(e) => {
                        const list = [...(cfg.depoimentosAutorizados || [])];
                        list[idx] = { ...dep, nome: e.target.value };
                        setCfg({ ...cfg, depoimentosAutorizados: list });
                      }}
                      placeholder="Nome ou iniciais"
                      className="px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                    <input
                      value={dep.cidadeOrigem || ''}
                      onChange={(e) => {
                        const list = [...(cfg.depoimentosAutorizados || [])];
                        list[idx] = { ...dep, cidadeOrigem: e.target.value };
                        setCfg({ ...cfg, depoimentosAutorizados: list });
                      }}
                      placeholder="Cidade/UF de origem"
                      className="px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                    <input
                      value={dep.subcategoria || ''}
                      onChange={(e) => {
                        const list = [...(cfg.depoimentosAutorizados || [])];
                        list[idx] = { ...dep, subcategoria: e.target.value };
                        setCfg({ ...cfg, depoimentosAutorizados: list });
                      }}
                      placeholder="Subcategoria do processo"
                      className="px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                    <textarea
                      rows={2}
                      value={dep.depoimento}
                      onChange={(e) => {
                        const list = [...(cfg.depoimentosAutorizados || [])];
                        list[idx] = { ...dep, depoimento: e.target.value };
                        setCfg({ ...cfg, depoimentosAutorizados: list });
                      }}
                      placeholder="Texto do depoimento real..."
                      className="md:col-span-2 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <label className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={dep.autorizado}
                          onChange={(e) => {
                            const list = [...(cfg.depoimentosAutorizados || [])];
                            list[idx] = { ...dep, autorizado: e.target.checked };
                            setCfg({ ...cfg, depoimentosAutorizados: list });
                          }}
                        />
                        Autorizado
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const list = (cfg.depoimentosAutorizados || []).filter((x) => x.id !== dep.id);
                          setCfg({ ...cfg, depoimentosAutorizados: list });
                        }}
                        className="p-1.5 rounded border border-red-200 text-[#C82333]"
                        aria-label="Excluir depoimento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linha do Tempo Quem Somos */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Linha do Tempo (/quem-somos)</h3>
              <button
                type="button"
                onClick={() =>
                  setCfg((prev) => ({
                    ...prev,
                    quemSomosMarcoHistorico: [
                      ...(prev.quemSomosMarcoHistorico || []),
                      { ano: String(new Date().getFullYear()), titulo: 'Novo Marco', descricao: '' },
                    ],
                  }))
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar Marco
              </button>
            </div>
            {(cfg.quemSomosMarcoHistorico || []).map((marco, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-6 gap-2 text-xs p-3 rounded-lg bg-slate-50 border border-slate-200">
                <input
                  value={marco.ano}
                  onChange={(e) => {
                    const list = [...(cfg.quemSomosMarcoHistorico || [])];
                    list[idx] = { ...marco, ano: e.target.value };
                    setCfg({ ...cfg, quemSomosMarcoHistorico: list });
                  }}
                  placeholder="Ano"
                  className="px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                />
                <input
                  value={marco.titulo}
                  onChange={(e) => {
                    const list = [...(cfg.quemSomosMarcoHistorico || [])];
                    list[idx] = { ...marco, titulo: e.target.value };
                    setCfg({ ...cfg, quemSomosMarcoHistorico: list });
                  }}
                  placeholder="Título"
                  className="sm:col-span-2 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                />
                <input
                  value={marco.descricao}
                  onChange={(e) => {
                    const list = [...(cfg.quemSomosMarcoHistorico || [])];
                    list[idx] = { ...marco, descricao: e.target.value };
                    setCfg({ ...cfg, quemSomosMarcoHistorico: list });
                  }}
                  placeholder="Descrição"
                  className="sm:col-span-2 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCfg({
                      ...cfg,
                      quemSomosMarcoHistorico: (cfg.quemSomosMarcoHistorico || []).filter((_, i) => i !== idx),
                    })
                  }
                  className="px-2 py-1 rounded border border-red-200 text-[#C82333] font-semibold"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>

          {/* Histórico de Versões Publicadas + Restaurar */}
          {(cfg.siteHistorico || []).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--color-primary)]" />
                Histórico de Versões do Site ({cfg.siteHistorico?.length})
              </h3>
              <div className="divide-y divide-slate-200 text-xs">
                {(cfg.siteHistorico || []).map((h, i) => (
                  <div key={`${h.versao}_${i}`} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-900">{h.versao}</span> · Publicado por {h.publicadoPor} em{' '}
                      {formatDateTimeBR(h.publicadoEm)}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleRestoreSiteVersion(h)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restaurar versão anterior
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DADOS BANCÁRIOS */}
      {tab === 'bancario' && (
        <form onSubmit={handleSaveBancario} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-base font-bold text-slate-900">Dados Bancários Confidenciais (Somente Admin)</h2>
          </div>
          {bancario ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dados Bancários Brasil (Banco / Agência / Conta — Titular Pessoa Física)</label>
                <textarea
                  rows={3}
                  value={bancario.dados_bancarios_br}
                  onChange={(e) => setBancario({ ...bancario, dados_bancarios_br: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dados Bancários no Chile (Opcional — Cuenta Vista / Corriente / RUT, se aplicável)</label>
                <textarea
                  rows={3}
                  value={bancario.dados_bancarios_cl}
                  onChange={(e) => setBancario({ ...bancario, dados_bancarios_cl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dados Wise / Remessa Internacional</label>
                <textarea
                  rows={2}
                  value={bancario.dados_wise}
                  onChange={(e) => setBancario({ ...bancario, dados_wise: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Salvar Dados Bancários
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-500">Carregando dados bancários...</p>
          )}
        </form>
      )}

      {/* EQUIPE & QUEM SOMOS */}
      {tab === 'equipe' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-semibold">Usuário</th>
                  <th className="py-3 px-4 font-semibold">E-mail</th>
                  <th className="py-3 px-4 font-semibold">Papel (Role)</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Perfil Quem Somos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {usersList.map((u) => (
                  <tr key={u.uid}>
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.nome}</td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={async (e) => {
                          const nextRole = e.target.value as UserRole;
                          await saveDocumentAudited('users', u.uid, { ...u, role: nextRole }, false, role, 'alterar_papel_usuario');
                          await loadUsers();
                          setFeedback(`Papel de ${u.email} alterado para ${nextRole}.`);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-semibold"
                      >
                        <option value="admin">admin</option>
                        <option value="consultor">consultor</option>
                        <option value="assistente">assistente</option>
                        <option value="cliente">cliente</option>
                      </select>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={u.status}
                        onChange={async (e) => {
                          const nextStatus = e.target.value as UserProfile['status'];
                          await saveDocumentAudited('users', u.uid, { ...u, status: nextStatus }, false, role, 'alterar_status_usuario');
                          await loadUsers();
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="ativo">ativo</option>
                        <option value="pendente">pendente</option>
                        <option value="inativo">inativo</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {u.role !== 'cliente' && (
                        <button
                          type="button"
                          onClick={() => setEditingMember(u)}
                          className="px-3 py-1 rounded-lg border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Editar Bio / Credenciais
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AUDITORIA GLOBAL */}
      {tab === 'auditoria' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-between">
            <input
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              placeholder="Filtrar auditoria por ação, entidade ou usuário..."
              className="flex-1 min-w-[240px] px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            />
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'auditoria-dm-integra',
                  ['Data', 'Ator', 'Papel', 'Ação', 'Entidade', 'ID', 'Campo'],
                  filteredLogs.map((l) => [
                    formatDateTimeBR(l.createdAt),
                    l.actorEmail,
                    l.actorRole,
                    l.acao,
                    l.entidade,
                    l.entidadeId,
                    l.campo || '',
                  ]),
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            {filteredLogs.slice(0, 80).map((l) => (
              <div key={l.id} className="p-3.5 text-xs flex flex-wrap justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">
                    {l.acao} · {l.entidade}
                  </span>{' '}
                  <span className="text-slate-500">({l.entidadeId})</span>
                </div>
                <div className="text-slate-500">
                  {l.actorEmail} ({l.actorRole}) · {formatDateTimeBR(l.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGRAS DO DIAGNÓSTICO SEM CÓDIGO */}
      {tab === 'regras' && (
        <div className="space-y-6">
          {staleLegalAlerts.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-950">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                Alerta de Revisão Normativa ({staleLegalAlerts.length} norma(s) ligada(s) às regras)
              </p>
              <ul className="space-y-1">
                {staleLegalAlerts.map((al, i) => (
                  <li key={i}>
                    <strong>{al.ruleName}</strong> → {al.sourceTitle}: {al.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[var(--color-primary)]" />
                  Editor Estruturado das Regras do Diagnóstico (Ativa: {activeDiagnosticRules.versao})
                </h2>
                <p className="text-xs text-slate-500">
                  Edite pesos, notas base e justificativas sem código. A publicação é liberada somente após aprovação nos 30 testes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRunDraftTests}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Play className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  Rodar 30 Testes neste Rascunho
                </button>
                <button
                  type="button"
                  disabled={
                    publishingRules ||
                    !draftTestGate ||
                    draftTestGate.testedHash !== draftHash ||
                    !draftTestGate.allPassed
                  }
                  onClick={() => void handlePublishRules()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {publishingRules ? 'Publicando...' : 'Publicar Nova Versão'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nova Versão *</label>
                <input
                  value={draftRules.versao}
                  onChange={(e) => setDraftRules({ ...draftRules, versao: e.target.value })}
                  placeholder="Ex.: v2.2"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Resumo da Mudança (Auditoria)</label>
                <input
                  value={draftRules.resumoMudanca}
                  onChange={(e) => setDraftRules({ ...draftRules, resumoMudanca: e.target.value })}
                  placeholder="Ex.: Ajuste de pontuação Mercosul / tabela de honorários"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <p className="text-[11px] text-slate-500">Pré-visualização de impacto (30 perfis)</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {impactPreview.changedTop} troca(s) de líder · Δ médio {impactPreview.avgDelta} pts
                </p>
              </div>
            </div>

            {draftTestGate && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  draftTestGate.testedHash !== draftHash
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : draftTestGate.allPassed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-[#C82333]'
                }`}
              >
                <span className="font-semibold">
                  {draftTestGate.testedHash !== draftHash
                    ? 'Rascunho alterado após o último teste — execute novamente os 30 testes para liberar a publicação.'
                    : draftTestGate.allPassed
                      ? 'Portão de qualidade aprovado: 30/30 testes passaram! Publicação liberada.'
                      : `Publicação bloqueada: ${draftTestGate.results.filter((r) => !r.pass).length} teste(s) falhou(aram).`}
                </span>
              </div>
            )}

            <div className="space-y-3">
              {draftRules.regras.map((rule) => (
                <div key={rule.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-200 font-bold text-slate-800">{rule.codigo}</span>
                      <span className="font-bold text-slate-900">{rule.nome}</span>
                      <span className="text-slate-500">({rule.condicao} → {rule.categoriaAlvo})</span>
                    </div>
                    <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.ativa}
                        onChange={(e) => updateDraftRuleItem(rule.id, { ativa: e.target.checked })}
                      />
                      Regra ativa
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Nota Base (0-100)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rule.notaBase}
                        onChange={(e) => updateDraftRuleItem(rule.id, { notaBase: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Ajuste (-50 a +30)</label>
                      <input
                        type="number"
                        min={-50}
                        max={30}
                        value={rule.ajusteNota}
                        onChange={(e) => updateDraftRuleItem(rule.id, { ajusteNota: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-600 mb-1">Norma vinculada (Biblioteca Legal)</label>
                      <select
                        value={rule.legalSourceId || ''}
                        onChange={(e) => updateDraftRuleItem(rule.id, { legalSourceId: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="">Sem vínculo direto</option>
                        {legalSources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.titulo} ({s.statusVigencia})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-600 mb-1">Explicação para o cliente</label>
                      <input
                        value={rule.explicacaoCliente}
                        onChange={(e) => updateDraftRuleItem(rule.id, { explicacaoCliente: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-600 mb-1">Explicação técnica do consultor</label>
                      <input
                        value={rule.explicacaoTecnica}
                        onChange={(e) => updateDraftRuleItem(rule.id, { explicacaoTecnica: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--color-primary)]" />
              Histórico de Versões Publicadas ({ruleVersions.length})
            </h3>
            <div className="divide-y divide-slate-200 text-xs">
              {ruleVersions.map((v) => (
                <div key={v.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900">{v.versao}</span>{' '}
                    {v.ativa && (
                      <span className="ml-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[#1E7E34] font-bold text-[10px]">
                        ATIVA
                      </span>
                    )}
                    <p className="text-slate-600 mt-0.5">{v.resumoMudanca}</p>
                  </div>
                  <div className="text-slate-500 text-right">
                    <p>{v.publicadoPor}</p>
                    <p>{formatDateBR(v.dataPublicacao)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TESTAR DIAGNÓSTICO (30 PERFIS) */}
      {tab === 'testes' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Verificação do Motor de Diagnóstico (30 Perfis Obrigatórios)</h2>
              <p className="text-xs text-slate-500">
                Valida Mercosul, turista sem vínculo, humanitário, flags isoladas, opção consultor, menor, casal, contradições, passaporte vencido, prorrogação/definitiva e regressão de regra.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRun30Profiles}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Play className="w-3.5 h-3.5" />
              Executar 30 Testes Agora
            </button>
          </div>

          {testResults && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800">
                Resultado: {testResults.filter((r) => r.pass).length} / {testResults.length} aprovado(s) (versão ativa: {activeDiagnosticRules.versao})
              </div>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {testResults.map((r) => (
                  <div key={r.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      {r.pass ? (
                        <CheckCircle2 className="w-4 h-4 text-[#1E7E34] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#C82333] shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-900">
                          #{r.id} — {r.nome}
                        </p>
                        <p className="text-slate-600">
                          <strong>Esperado:</strong> {r.esperado}
                        </p>
                        <p className="text-slate-700">
                          <strong>Obtido:</strong> {r.obtido}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded border font-bold shrink-0 self-start sm:self-center ${
                        r.pass
                          ? 'bg-emerald-50 border-emerald-200 text-[#1E7E34]'
                          : 'bg-red-50 border-red-200 text-[#C82333]'
                      }`}
                    >
                      {r.pass ? 'APROVADO' : 'REPROVADO'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL COMPLETO DE EDIÇÃO DE SEÇÃO CMS + LAYOUT + SUB-ITENS + MÍDIA */}
      {editingCms && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveCmsDraftItem} className="bg-white rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Editar Seção no Rascunho: {editingCms.secao}</h2>
                <p className="text-xs text-slate-500">Personalize layout, tema, textos, imagem/banner e itens internos desta seção.</p>
              </div>
            </div>

            {/* Aparência & Variante da Seção */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fundo / Tema da Seção</label>
                <select
                  value={(editMeta.temaSecao as string) || ''}
                  onChange={(e) => updateEditingMeta({ temaSecao: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">Padrão da seção</option>
                  <option value="claro">Claro (Superfície)</option>
                  <option value="suave">Suave (Cor de Fundo)</option>
                  <option value="escuro-primario">Destaque Escuro (Cor Primária)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Variante de Layout</label>
                {editingCms.secao === 'hero' ? (
                  <select
                    value={(editMeta.varianteLayout as string) || 'split-direita'}
                    onChange={(e) => updateEditingMeta({ varianteLayout: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="split-direita">Dividido (Imagem à Direita)</option>
                    <option value="split-esquerda">Dividido Invertido (Imagem à Esquerda)</option>
                    <option value="centralizado">Centralizado com Imagem Abaixo</option>
                    <option value="banner-cheio">Banner Fundo Cheio (Hero Imersivo)</option>
                  </select>
                ) : editingCms.secao === 'servicos' ? (
                  <select
                    value={(editMeta.varianteLayout as string) || 'grade-2'}
                    onChange={(e) => updateEditingMeta({ varianteLayout: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="grade-2">Grade 2 Colunas</option>
                    <option value="grade-4">Grade 4 Colunas</option>
                    <option value="lista-editorial">Lista Editorial Horizontal</option>
                  </select>
                ) : editingCms.secao === 'diferenciais' ? (
                  <select
                    value={(editMeta.varianteLayout as string) || 'imagem-esquerda'}
                    onChange={(e) => updateEditingMeta({ varianteLayout: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="imagem-esquerda">Imagem à Esquerda</option>
                    <option value="imagem-direita">Imagem à Direita</option>
                    <option value="sem-imagem">Sem Imagem (Texto Centralizado)</option>
                  </select>
                ) : editingCms.secao === 'bloco_livre' ? (
                  <select
                    value={(editMeta.varianteLayout as string) || 'texto-imagem-direita'}
                    onChange={(e) => updateEditingMeta({ varianteLayout: e.target.value })}
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="texto-imagem-direita">Texto + Imagem à Direita</option>
                    <option value="texto-imagem-esquerda">Imagem à Esquerda + Texto</option>
                    <option value="centralizado">Centralizado</option>
                    <option value="cta-destaque">Bloco Destaque / CTA</option>
                  </select>
                ) : (
                  <input
                    disabled
                    value="Padrão responsivo"
                    className="w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-slate-100 text-slate-500"
                  />
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Eyebrow (Rótulo Superior)</label>
                <input
                  value={(editMeta.eyebrow as string) || ''}
                  onChange={(e) => updateEditingMeta({ eyebrow: e.target.value })}
                  placeholder="Ex.: Assessoria Brasil – Chile"
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
            </div>

            {/* Textos e CTAs Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Título *</label>
                <input
                  required
                  value={editingCms.titulo}
                  onChange={(e) => setEditingCms({ ...editingCms, titulo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Subtítulo</label>
                <textarea
                  rows={2}
                  value={editingCms.subtitulo}
                  onChange={(e) => setEditingCms({ ...editingCms, subtitulo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Texto / Conteúdo</label>
                <textarea
                  rows={3}
                  value={editingCms.conteudoHtml}
                  onChange={(e) => setEditingCms({ ...editingCms, conteudoHtml: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Texto Botão CTA Principal</label>
                <input
                  value={editingCms.ctaTexto || ''}
                  onChange={(e) => setEditingCms({ ...editingCms, ctaTexto: e.target.value })}
                  placeholder="Ex.: Fazer Diagnóstico Gratuito"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Destino Botão CTA Principal</label>
                <input
                  value={editingCms.ctaDestino || ''}
                  onChange={(e) => setEditingCms({ ...editingCms, ctaDestino: e.target.value })}
                  placeholder="Ex.: /diagnostico ou https://..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SEO Título (Opcional)</label>
                <input
                  value={editingCms.seoTitulo || ''}
                  onChange={(e) => setEditingCms({ ...editingCms, seoTitulo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Enquadramento da Imagem</label>
                <select
                  value={(editMeta.imagemObjectFit as string) || 'cover'}
                  onChange={(e) => updateEditingMeta({ imagemObjectFit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="cover">Preencher quadro (Cover / Crop)</option>
                  <option value="contain">Imagem inteira sem cortes (Contain)</option>
                </select>
              </div>
            </div>

            {/* Importação & Biblioteca de Imagem da Seção */}
            <MediaAssetPicker
              label="Imagem / Banner da Seção"
              value={editingCms.imagemUrl}
              onChange={(url) => setEditingCms({ ...editingCms, imagemUrl: url })}
              preset={editingCms.secao === 'quem_somos' ? 'equipe' : 'banner'}
              role={role}
              actorEmail={userProfile.email}
              hint="Importe uma nova imagem ou escolha na Biblioteca de Mídias."
            />

            {/* SUB-EDITORES ESPECÍFICOS POR SEÇÃO */}
            {editingCms.secao === 'hero' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <p className="font-bold text-slate-900">Configurações Exclusivas do Hero</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Texto CTA Secundário</label>
                    <input
                      value={(editMeta.ctaSecundario as string) || 'Falar no WhatsApp'}
                      onChange={(e) => updateEditingMeta({ ctaSecundario: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Legenda Foto (Título)</label>
                    <input
                      value={(editMeta.badgeTitulo as string) || 'Operação Brasil & Santiago'}
                      onChange={(e) => updateEditingMeta({ badgeTitulo: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Legenda Foto (Subtítulo)</label>
                    <input
                      value={(editMeta.badgeSubtitulo as string) || ''}
                      onChange={(e) => updateEditingMeta({ badgeSubtitulo: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                </div>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Destaques Inferiores do Hero</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = [...((editMeta.destaques as string[]) || [])];
                        list.push('Novo destaque institucional');
                        updateEditingMeta({ destaques: list });
                      }}
                      className="px-2 py-1 rounded border border-slate-300 bg-white font-semibold"
                    >
                      + Destaque
                    </button>
                  </div>
                  {((editMeta.destaques as string[]) || []).map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        value={item}
                        onChange={(e) => {
                          const list = [...((editMeta.destaques as string[]) || [])];
                          list[i] = e.target.value;
                          updateEditingMeta({ destaques: list });
                        }}
                        className="flex-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = ((editMeta.destaques as string[]) || []).filter((_, idx) => idx !== i);
                          updateEditingMeta({ destaques: list });
                        }}
                        className="px-2 py-1 rounded border border-red-200 text-red-700 bg-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editingCms.secao === 'servicos' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-900">Cartões de Serviços &amp; Comparador</p>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editMeta.mostrarComparador !== false}
                        onChange={(e) => updateEditingMeta({ mostrarComparador: e.target.checked })}
                      />
                      Exibir Comparador &ldquo;Qual caminho serve para mim?&rdquo;
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const list = [...((editMeta.itens as Record<string, string>[]) || [])];
                        list.push({
                          numero: String(list.length + 1).padStart(2, '0'),
                          titulo: 'Novo Serviço',
                          descricao: '',
                        });
                        updateEditingMeta({ itens: list });
                      }}
                      className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold"
                    >
                      + Serviço
                    </button>
                  </div>
                </div>
                {((editMeta.itens as Record<string, string>[]) || []).map((srv, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                      <input
                        value={srv.numero || ''}
                        onChange={(e) => {
                          const list = [...((editMeta.itens as Record<string, string>[]) || [])];
                          list[i] = { ...srv, numero: e.target.value };
                          updateEditingMeta({ itens: list });
                        }}
                        placeholder="01"
                        className="px-2 py-1 rounded border border-slate-300"
                      />
                      <input
                        value={srv.titulo || ''}
                        onChange={(e) => {
                          const list = [...((editMeta.itens as Record<string, string>[]) || [])];
                          list[i] = { ...srv, titulo: e.target.value };
                          updateEditingMeta({ itens: list });
                        }}
                        placeholder="Título do serviço"
                        className="sm:col-span-4 px-2 py-1 rounded border border-slate-300 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = ((editMeta.itens as Record<string, string>[]) || []).filter((_, idx) => idx !== i);
                          updateEditingMeta({ itens: list });
                        }}
                        className="px-2 py-1 rounded border border-red-200 text-red-700"
                      >
                        Remover
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={srv.descricao || ''}
                      onChange={(e) => {
                        const list = [...((editMeta.itens as Record<string, string>[]) || [])];
                        list[i] = { ...srv, descricao: e.target.value };
                        updateEditingMeta({ itens: list });
                      }}
                      placeholder="Descrição exibida no card"
                      className="w-full px-2 py-1 rounded border border-slate-300"
                    />
                  </div>
                ))}
              </div>
            )}

            {editingCms.secao === 'diferenciais' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Lista de Diferenciais</p>
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...((editMeta.itens as { titulo: string; descricao: string }[]) || [])];
                      list.push({ titulo: 'Novo Diferencial', descricao: '' });
                      updateEditingMeta({ itens: list });
                    }}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold"
                  >
                    + Diferencial
                  </button>
                </div>
                {((editMeta.itens as { titulo: string; descricao: string }[]) || []).map((d, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={d.titulo}
                        onChange={(e) => {
                          const list = [...((editMeta.itens as { titulo: string; descricao: string }[]) || [])];
                          list[i] = { ...d, titulo: e.target.value };
                          updateEditingMeta({ itens: list });
                        }}
                        placeholder="Título"
                        className="flex-1 px-2 py-1 rounded border border-slate-300 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = ((editMeta.itens as { titulo: string; descricao: string }[]) || []).filter((_, idx) => idx !== i);
                          updateEditingMeta({ itens: list });
                        }}
                        className="px-2 py-1 rounded border border-red-200 text-red-700"
                      >
                        Remover
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={d.descricao}
                      onChange={(e) => {
                        const list = [...((editMeta.itens as { titulo: string; descricao: string }[]) || [])];
                        list[i] = { ...d, descricao: e.target.value };
                        updateEditingMeta({ itens: list });
                      }}
                      placeholder="Descrição"
                      className="w-full px-2 py-1 rounded border border-slate-300"
                    />
                  </div>
                ))}
              </div>
            )}

            {editingCms.secao === 'como_funciona' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Etapas da Jornada</p>
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...((editMeta.passos as { passo: string; titulo: string; descricao: string }[]) || [])];
                      list.push({ passo: String(list.length + 1).padStart(2, '0'), titulo: 'Nova Etapa', descricao: '' });
                      updateEditingMeta({ passos: list });
                    }}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold"
                  >
                    + Passo
                  </button>
                </div>
                {((editMeta.passos as { passo: string; titulo: string; descricao: string }[]) || []).map((p, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                      <input
                        value={p.passo}
                        onChange={(e) => {
                          const list = [...((editMeta.passos as { passo: string; titulo: string; descricao: string }[]) || [])];
                          list[i] = { ...p, passo: e.target.value };
                          updateEditingMeta({ passos: list });
                        }}
                        placeholder="01"
                        className="px-2 py-1 rounded border border-slate-300"
                      />
                      <input
                        value={p.titulo}
                        onChange={(e) => {
                          const list = [...((editMeta.passos as { passo: string; titulo: string; descricao: string }[]) || [])];
                          list[i] = { ...p, titulo: e.target.value };
                          updateEditingMeta({ passos: list });
                        }}
                        placeholder="Título da etapa"
                        className="sm:col-span-4 px-2 py-1 rounded border border-slate-300 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = ((editMeta.passos as { passo: string; titulo: string; descricao: string }[]) || []).filter((_, idx) => idx !== i);
                          updateEditingMeta({ passos: list });
                        }}
                        className="px-2 py-1 rounded border border-red-200 text-red-700"
                      >
                        Remover
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={p.descricao}
                      onChange={(e) => {
                        const list = [...((editMeta.passos as { passo: string; titulo: string; descricao: string }[]) || [])];
                        list[i] = { ...p, descricao: e.target.value };
                        updateEditingMeta({ passos: list });
                      }}
                      placeholder="Descrição"
                      className="w-full px-2 py-1 rounded border border-slate-300"
                    />
                  </div>
                ))}
              </div>
            )}

            {editingCms.secao === 'quem_somos' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
                <p className="font-bold text-slate-900">Metadados da Página /quem-somos</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Responsável / Diretoria</label>
                    <input
                      value={(editMeta.responsavel as string) || ''}
                      onChange={(e) => updateEditingMeta({ responsavel: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Credenciais &amp; Conformidade</label>
                    <input
                      value={(editMeta.credenciais as string) || ''}
                      onChange={(e) => updateEditingMeta({ credenciais: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Título da Formação Acadêmica</label>
                    <input
                      value={(editMeta.formacaoTitulo as string) || 'Formação Acadêmica e Qualificação Jurídica'}
                      onChange={(e) => updateEditingMeta({ formacaoTitulo: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white mb-2"
                    />
                    <label className="block font-semibold text-slate-700 mb-1">Formação Acadêmica &amp; Qualificação Jurídica</label>
                    <textarea
                      rows={4}
                      value={(editMeta.formacao as string) || ''}
                      onChange={(e) => updateEditingMeta({ formacao: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Título da Especialização / Escopo</label>
                    <input
                      value={(editMeta.experienciaTitulo as string) || 'Especialização e Escopo de Atuação'}
                      onChange={(e) => updateEditingMeta({ experienciaTitulo: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white mb-2"
                    />
                    <label className="block font-semibold text-slate-700 mb-1">Especialização e Escopo de Atuação</label>
                    <textarea
                      rows={4}
                      value={(editMeta.experiencia as string) || ''}
                      onChange={(e) => updateEditingMeta({ experiencia: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Missão &amp; Ética</label>
                    <textarea
                      rows={2}
                      value={(editMeta.missao as string) || ''}
                      onChange={(e) => updateEditingMeta({ missao: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {editingCms.secao === 'parceiros' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <label className="block font-semibold text-slate-700 mb-1">Quantidade máxima de parceiros exibidos na Home</label>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={Number(editMeta.maxItens || 3)}
                  onChange={(e) => updateEditingMeta({ maxItens: Number(e.target.value) })}
                  className="w-32 px-2.5 py-1.5 rounded border border-slate-300 bg-white tabular-nums"
                />
              </div>
            )}

            {editingCms.secao === 'faq' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-900">Perguntas e Respostas (FAQ)</p>
                  <button
                    type="button"
                    onClick={() => {
                      const list = [...((editMeta.perguntas as { pergunta: string; resposta: string }[]) || [])];
                      list.push({ pergunta: 'Nova pergunta frequente?', resposta: '' });
                      updateEditingMeta({ perguntas: list });
                    }}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold"
                  >
                    + Pergunta
                  </button>
                </div>
                {((editMeta.perguntas as { pergunta: string; resposta: string }[]) || []).map((faqItem, i) => (
                  <div key={i} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={faqItem.pergunta}
                        onChange={(e) => {
                          const list = [...((editMeta.perguntas as { pergunta: string; resposta: string }[]) || [])];
                          list[i] = { ...faqItem, pergunta: e.target.value };
                          updateEditingMeta({ perguntas: list });
                        }}
                        placeholder="Pergunta"
                        className="flex-1 px-2 py-1 rounded border border-slate-300 font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const list = ((editMeta.perguntas as { pergunta: string; resposta: string }[]) || []).filter((_, idx) => idx !== i);
                          updateEditingMeta({ perguntas: list });
                        }}
                        className="px-2 py-1 rounded border border-red-200 text-red-700"
                      >
                        Remover
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={faqItem.resposta}
                      onChange={(e) => {
                        const list = [...((editMeta.perguntas as { pergunta: string; resposta: string }[]) || [])];
                        list[i] = { ...faqItem, resposta: e.target.value };
                        updateEditingMeta({ perguntas: list });
                      }}
                      placeholder="Resposta"
                      className="w-full px-2 py-1 rounded border border-slate-300"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button type="button" onClick={() => setEditingCms(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Aplicar ao Rascunho
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Quem Somos (Equipe) com MediaAssetPicker */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveDocumentAudited(
                'users',
                editingMember.uid,
                editingMember as unknown as Record<string, unknown>,
                false,
                role,
                'quem_somos_membro',
              );
              setEditingMember(null);
              setFeedback('Perfil institucional atualizado!');
              await loadUsers();
            }}
            className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-slate-900">Perfil Institucional: {editingMember.nome}</h2>
            <div className="space-y-3 text-xs">
              <MediaAssetPicker
                label="Foto Oficial do Membro da Equipe"
                value={editingMember.quemSomosFotoUrl || ''}
                onChange={(url) => setEditingMember({ ...editingMember, quemSomosFotoUrl: url })}
                preset="equipe"
                role={role}
                actorEmail={userProfile.email}
                compact
              />
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Formação Acadêmica e Jurídica</label>
                <textarea
                  rows={2}
                  value={editingMember.quemSomosFormacao || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, quemSomosFormacao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Experiência Migratória Brasil ↔ Chile</label>
                <textarea
                  rows={2}
                  value={editingMember.quemSomosExperiencia || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, quemSomosExperiencia: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Biografia / Missão</label>
                <textarea
                  rows={3}
                  value={editingMember.quemSomosBio || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, quemSomosBio: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Credenciais Comprovadas (opcional)</label>
                <input
                  value={editingMember.quemSomosCredenciais || ''}
                  onChange={(e) => setEditingMember({ ...editingMember, quemSomosCredenciais: e.target.value })}
                  placeholder="Somente credenciais reais e comprovadas"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingMember(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Salvar Perfil
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
