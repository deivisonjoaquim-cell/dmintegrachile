import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  FileText,
  Globe,
  History,
  Link2,
  MessageCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Upload,
  Wifi,
  X,
} from 'lucide-react';
import { LegalBaseModal } from '../LegalBaseModal';
import { OptimizedImage } from '../OptimizedImage';
import { ConfirmActionModal } from '../ui/DesignSystem';
import { MediaAssetPicker } from './MediaAssetPicker';
import {
  checkSermigOfficialLinksLive,
  type SermigBatchCheckResponse,
  type SermigSourceCheckResult,
} from '../../services/sermigLegalClient';
import {
  callAiEndpoint,
  deleteDocumentAudited,
  deletePartnerAndPublicAudited,
  deletePartnerProposalAudited,
  makeId,
  rejectPartnerProposalAudited,
  saveDocumentAudited,
  syncOfficialLegalCatalog,
  syncPartnerAndPublic,
  uploadFileToServer,
} from '../../services/firestoreService';
import type {
  Case,
  DiagnosticRuleVersion,
  DocumentTemplate,
  EmpresaConfig,
  LegalSource,
  LegalSourceType,
  Partner,
  PartnerCategory,
  PartnerProposal,
  Task,
  UserProfile,
  UserRole,
  VisaCategory,
  VisaRequirement,
} from '../../types/domain';
import { buildWhatsAppUrl, formatDateBR, toIsoDate } from '../../utils/formatters';
import { isLegalSourceOutdated } from '../../utils/legalSync';
import {
  computePartnerNetworkMetrics,
  extractPartnerWebsiteFromMessage,
  isPartnerPublishedPublicly,
  normalizePartnerExternalUrl,
  PARTNER_CATEGORIES,
  sanitizePartnerImageUrl,
} from '../../utils/partnerHelpers';
import {
  clearAiDraftCache,
  compactLegalSourcesForAi,
  compactSourceForAi,
  loadAiDraftCache,
  prepareAiAttachment,
  sanitizeClientAiError,
  saveAiDraftCache,
  type AiResponseMeta,
} from '../../utils/aiClient';

interface PainelParceirosLegalProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  partners: Partner[];
  partnerProposals: PartnerProposal[];
  legalSources: LegalSource[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  cases?: Case[];
  activeDiagnosticRules?: DiagnosticRuleVersion;
  documentTemplates?: DocumentTemplate[];
  onRefresh: () => Promise<void>;
  onRefreshPublic: () => Promise<void>;
  onOpenCase?: (caseId: string) => void;
  sectionGroup?: 'parceiros' | 'legal' | 'todos';
}

type TabKey = 'propostas' | 'parceiros' | 'legal' | 'vistos';

interface LegalFilterPreset {
  id: string;
  nome: string;
  pais: string;
  tipo: string;
  status: string;
  onlyFav: boolean;
  q: string;
}

const PRESETS_STORAGE_KEY = 'dm_legal_filter_presets_v1';

export const PainelParceirosLegal: React.FC<PainelParceirosLegalProps> = ({
  role,
  userProfile,
  empresa,
  partners,
  partnerProposals,
  legalSources,
  visaCategories,
  visaRequirements,
  cases = [],
  activeDiagnosticRules,
  documentTemplates = [],
  onRefresh,
  onRefreshPublic,
  onOpenCase,
  sectionGroup = 'todos',
}) => {
  const [tab, setTab] = useState<TabKey>(sectionGroup === 'legal' ? 'legal' : 'propostas');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (sectionGroup === 'parceiros') {
      setTab((prev) => (prev === 'legal' || prev === 'vistos' ? 'propostas' : prev));
    } else if (sectionGroup === 'legal') {
      setTab((prev) => (prev === 'propostas' || prev === 'parceiros' ? 'legal' : prev));
    }
  }, [sectionGroup]);

  // Busca & Filtros Base Legal
  const [searchLegal, setSearchLegal] = useState('');
  const [filterPais, setFilterPais] = useState<string>('Todos');
  const [filterTipo, setFilterTipo] = useState<string>('Todos');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [onlyFav, setOnlyFav] = useState(false);
  const [onlyOutdated, setOnlyOutdated] = useState(false);
  const [syncingOfficial, setSyncingOfficial] = useState(false);
  const [checkingLiveLinks, setCheckingLiveLinks] = useState(false);
  const [batchVerifying, setBatchVerifying] = useState(false);
  const [liveCheckMap, setLiveCheckMap] = useState<Record<string, SermigSourceCheckResult>>({});
  const [liveCheckSummary, setLiveCheckSummary] = useState<SermigBatchCheckResponse['summary'] | null>(null);
  const [liveCheckedAt, setLiveCheckedAt] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'verificacao_asc' | 'verificacao_desc' | 'titulo'>('verificacao_asc');

  // Filtros dinâmicos da aba Vistos & Requisitos SERMIG
  const [visaSearch, setVisaSearch] = useState('');
  const [visaInsideFilter, setVisaInsideFilter] = useState<'Todos' | 'Sim' | 'Condicional' | 'Não'>('Todos');
  const [visaVerifyFilter, setVisaVerifyFilter] = useState<'Todos' | 'Verificado' | 'A verificar'>('Todos');
  const [expandedVisaId, setExpandedVisaId] = useState<string | null>(null);
  const [savingVisaId, setSavingVisaId] = useState<string | null>(null);

  const [presets, setPresets] = useState<LegalFilterPreset[]>(() => {
    try {
      const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as LegalFilterPreset[]) : [];
    } catch {
      return [];
    }
  });

  // IA Proposta & Filtros Parceiros / Propostas
  const [aiPropLoadingId, setAiPropLoadingId] = useState<string | null>(null);
  const [aiPropProgress, setAiPropProgress] = useState<string | null>(null);
  const [approvingPropId, setApprovingPropId] = useState<string | null>(null);
  const [proposalSearch, setProposalSearch] = useState('');
  const [proposalStatusFilter, setProposalStatusFilter] = useState<'Todas' | PartnerProposal['status']>('Todas');

  const [partnerSearch, setPartnerSearch] = useState('');
  const [partnerPaisFilter, setPartnerPaisFilter] = useState<'Todos' | 'Brasil' | 'Chile' | 'Ambos'>('Todos');
  const [partnerCatFilter, setPartnerCatFilter] = useState<string>('Todas');
  const [partnerVisibilityFilter, setPartnerVisibilityFilter] = useState<'Todos' | 'publicados' | 'ocultos'>('Todos');
  const [togglingPartnerId, setTogglingPartnerId] = useState<string | null>(null);

  // Novo / Edição Parceiro
  const [partnerModal, setPartnerModal] = useState<Partial<Partner> | null>(null);
  const [savingPartner, setSavingPartner] = useState(false);

  // Modal genérico de confirmação para exclusões e recusas
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    description: string;
    details?: string[];
    confirmLabel: string;
    tone?: 'danger' | 'warning' | 'primary';
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Norma: Criação/Edição completa + IA + Vínculos + Histórico
  const [editingSource, setEditingSource] = useState<LegalSource | null>(null);
  const [isNewSource, setIsNewSource] = useState(false);
  const [normaNewText, setNormaNewText] = useState('');
  const [normaAttachment, setNormaAttachment] = useState<{
    name: string;
    fileBase64: string;
    mimeType: string;
  } | null>(null);
  const [normaAiDraft, setNormaAiDraft] = useState<(AiResponseMeta & {
    possuiAtualizacao?: boolean;
    situacaoAtual?: string;
    artigosExtraidos: string;
    resumoExecutivo: string;
    explicacaoCliente: string;
    impactosVistos: string[];
    divergencias: string[];
    fontesCitadas?: string[];
    fontesOnline?: Array<{ titulo: string; url: string }>;
  }) | null>(null);
  const [normaAiLoading, setNormaAiLoading] = useState(false);
  const [normaAiProgress, setNormaAiProgress] = useState<string | null>(null);

  // Modais de consulta Base Legal
  const [usageSource, setUsageSource] = useState<LegalSource | null>(null);
  const [historySource, setHistorySource] = useState<LegalSource | null>(null);
  const [compareHistIdx, setCompareHistIdx] = useState<number>(0);
  const [legalDrawerData, setLegalDrawerData] = useState<{ title: string; sources: LegalSource[] } | null>(null);

  useEffect(() => {
    if (!editingSource?.id) {
      setNormaAiDraft(null);
      setNormaAttachment(null);
      return;
    }
    const cached = loadAiDraftCache<
      AiResponseMeta & {
        possuiAtualizacao?: boolean;
        situacaoAtual?: string;
        artigosExtraidos: string;
        resumoExecutivo: string;
        explicacaoCliente: string;
        impactosVistos: string[];
        divergencias: string[];
        fontesCitadas?: string[];
        fontesOnline?: Array<{ titulo: string; url: string }>;
      }
    >(`norma_${editingSource.id}`);
    setNormaAiDraft(cached);
    setNormaAttachment(null);
  }, [editingSource?.id]);

  const diasAlerta = empresa.diasAlertaRevisaoLegal || 90;

  const isSourceOutdated = (s: LegalSource): boolean => isLegalSourceOutdated(s, diasAlerta);

  // Mapeamento de onde cada norma é usada no sistema
  const computeUsagesForSource = (s: LegalSource) => {
    const linkedVisas = visaCategories.filter(
      (v) =>
        (v.legalSourceIds && v.legalSourceIds.includes(s.id)) ||
        (s.tags || []).some((t) => v.codigo === t || v.nomePortugues.toLowerCase().includes(t.toLowerCase())),
    );
    const linkedVisaIds = new Set(linkedVisas.map((v) => v.id));
    const linkedReqs = visaRequirements.filter((r) => linkedVisaIds.has(r.visaCategoryId));
    const linkedRules = (activeDiagnosticRules?.regras || []).filter((r) => r.legalSourceId === s.id);
    const linkedTemplates = documentTemplates.filter(
      (tpl) =>
        (s.documentTemplateIds && s.documentTemplateIds.includes(tpl.id)) ||
        tpl.conteudoHtml.toLowerCase().includes(s.numeroAno.toLowerCase()),
    );
    const activeCasesAffected = cases.filter(
      (c) => !c.arquivado && !c.encerradoEm && c.visaCategoryId && linkedVisaIds.has(c.visaCategoryId),
    );
    return {
      linkedVisas,
      linkedReqs,
      linkedRules,
      linkedTemplates,
      deadlineTipos: s.deadlineTipos || [],
      activeCasesAffected,
    };
  };

  const healthStats = useMemo(() => {
    let vigente = 0;
    let aVerificar = 0;
    let alterada = 0;
    let revogada = 0;
    let outdated = 0;
    let missingLink = 0;
    let unlinked = 0;
    for (const s of legalSources) {
      if (s.statusVigencia === 'Vigente') vigente++;
      else if (s.statusVigencia === 'A verificar') aVerificar++;
      else if (s.statusVigencia === 'Alterada') alterada++;
      else if (s.statusVigencia === 'Revogada') revogada++;
      if (isSourceOutdated(s)) outdated++;
      if (!s.linkOficial?.trim()) missingLink++;
      const u = computeUsagesForSource(s);
      if (u.linkedVisas.length === 0 && u.linkedRules.length === 0 && u.linkedTemplates.length === 0) unlinked++;
    }
    return { vigente, aVerificar, alterada, revogada, outdated, missingLink, unlinked };
  }, [legalSources, visaCategories, activeDiagnosticRules, documentTemplates, diasAlerta]);

  const filteredLegal = useMemo(() => {
    let list = [...legalSources];
    if (filterPais !== 'Todos') list = list.filter((s) => s.pais === filterPais);
    if (filterTipo !== 'Todos') list = list.filter((s) => s.tipo === filterTipo);
    if (filterStatus !== 'Todos') list = list.filter((s) => s.statusVigencia === filterStatus);
    if (onlyFav) list = list.filter((s) => (s.favoritoPorUids || []).includes(userProfile.uid));
    if (onlyOutdated) list = list.filter((s) => isSourceOutdated(s));
    if (searchLegal.trim()) {
      const q = searchLegal.toLowerCase();
      list = list.filter(
        (s) =>
          s.titulo.toLowerCase().includes(q) ||
          s.numeroAno.toLowerCase().includes(q) ||
          s.artigos.toLowerCase().includes(q) ||
          (s.artigosEstruturados || []).some(
            (a) => a.numero.toLowerCase().includes(q) || a.resumo.toLowerCase().includes(q),
          ) ||
          s.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    list.sort((a, b) => {
      if (sortOrder === 'titulo') return a.titulo.localeCompare(b.titulo, 'pt-BR');
      const ta = Date.parse(a.ultimaVerificacao || '1970-01-01');
      const tb = Date.parse(b.ultimaVerificacao || '1970-01-01');
      return sortOrder === 'verificacao_asc' ? ta - tb : tb - ta;
    });
    return list;
  }, [legalSources, filterPais, filterTipo, filterStatus, onlyFav, onlyOutdated, searchLegal, sortOrder, userProfile.uid, diasAlerta]);

  const handleSavePreset = () => {
    const next: LegalFilterPreset = {
      id: makeId('pre'),
      nome: `${filterPais !== 'Todos' ? filterPais : 'Todos países'} · ${filterStatus}`,
      pais: filterPais,
      tipo: filterTipo,
      status: filterStatus,
      onlyFav,
      q: searchLegal,
    };
    const updated = [next, ...presets].slice(0, 6);
    setPresets(updated);
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(updated));
    setFeedback('Filtro salvo nos seus favoritos locais!');
  };

  const handleApplyPreset = (p: LegalFilterPreset) => {
    setFilterPais(p.pais);
    setFilterTipo(p.tipo);
    setFilterStatus(p.status);
    setOnlyFav(p.onlyFav);
    setSearchLegal(p.q);
  };

  const filteredVisas = useMemo(() => {
    const q = visaSearch.trim().toLowerCase();
    return visaCategories.filter((v) => {
      if (visaInsideFilter !== 'Todos' && v.permiteDentroChile !== visaInsideFilter) return false;
      if (visaVerifyFilter !== 'Todos' && v.statusVerificacao !== visaVerifyFilter) return false;
      if (!q) return true;
      const reqMatch = visaRequirements.some(
        (r) =>
          r.visaCategoryId === v.id &&
          (r.nomeDocumento.toLowerCase().includes(q) || (r.descricao || '').toLowerCase().includes(q)),
      );
      return (
        v.codigo.toLowerCase().includes(q) ||
        v.nomePortugues.toLowerCase().includes(q) ||
        v.nomeEspanhol.toLowerCase().includes(q) ||
        (v.descricao || '').toLowerCase().includes(q) ||
        reqMatch
      );
    });
  }, [visaCategories, visaRequirements, visaSearch, visaInsideFilter, visaVerifyFilter]);

  const handleToggleFavorite = async (s: LegalSource) => {
    setErrorMsg(null);
    try {
      const cur = s.favoritoPorUids || [];
      const next = cur.includes(userProfile.uid)
        ? cur.filter((id) => id !== userProfile.uid)
        : [...cur, userProfile.uid];
      await saveDocumentAudited(
        'legalSources',
        s.id,
        { ...s, favoritoPorUids: next },
        false,
        role,
        'favorito_norma',
      );
      await onRefreshPublic();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível atualizar favorito da norma.');
    }
  };

  // ===========================================================================
  // Métricas, Filtros e Ações de Parceiros & Propostas
  // ===========================================================================
  const partnerMetrics = useMemo(
    () => computePartnerNetworkMetrics(partners, partnerProposals),
    [partners, partnerProposals],
  );

  const filteredProposals = useMemo(() => {
    const q = proposalSearch.trim().toLowerCase();
    return partnerProposals.filter((p) => {
      if (proposalStatusFilter !== 'Todas' && p.status !== proposalStatusFilter) return false;
      if (!q) return true;
      return `${p.nome_empresa} ${p.responsavel} ${p.categoria} ${p.pais} ${p.cidade} ${p.email} ${p.proposta}`
        .toLowerCase()
        .includes(q);
    });
  }, [partnerProposals, proposalSearch, proposalStatusFilter]);

  const filteredPanelPartners = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase();
    return partners.filter((p) => {
      if (partnerPaisFilter !== 'Todos' && p.pais !== partnerPaisFilter) return false;
      if (partnerCatFilter !== 'Todas' && p.categoria !== partnerCatFilter) return false;
      const published = isPartnerPublishedPublicly(p);
      if (partnerVisibilityFilter === 'publicados' && !published) return false;
      if (partnerVisibilityFilter === 'ocultos' && published) return false;
      if (!q) return true;
      return `${p.nome} ${p.categoria} ${p.pais} ${p.cidadeRegiao} ${p.contato} ${p.email} ${p.tabelaValoresComissao}`
        .toLowerCase()
        .includes(q);
    });
  }, [partners, partnerSearch, partnerPaisFilter, partnerCatFilter, partnerVisibilityFilter]);

  const handleTogglePartnerPublic = async (partner: Partner) => {
    if (togglingPartnerId) return;
    setTogglingPartnerId(partner.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const currentlyPublished = isPartnerPublishedPublicly(partner);
      const updated: Partner = currentlyPublished
        ? { ...partner, recomendadoAosClientes: false }
        : { ...partner, recomendadoAosClientes: true, statusHomologacao: 'Ativo/Indicado' };
      await syncPartnerAndPublic(updated, false, role);
      setFeedback(
        currentlyPublished
          ? `Parceiro "${partner.nome}" ocultado da vitrine pública (/parceiros).`
          : `Parceiro "${partner.nome}" publicado na vitrine pública (/parceiros).`,
      );
      await Promise.all([onRefresh(), onRefreshPublic()]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível alterar a visibilidade do parceiro.');
    } finally {
      setTogglingPartnerId(null);
    }
  };

  // ===========================================================================
  // Propostas de Parceiros
  // ===========================================================================
  const handleAnalyzeProposalIa = async (prop: PartnerProposal) => {
    if (aiPropLoadingId) return;
    setAiPropLoadingId(prop.id);
    setAiPropProgress('Avaliando proposta...');
    setErrorMsg(null);
    try {
      const res = await callAiEndpoint<
        AiResponseMeta & {
          nota: number;
          riscos: string[];
          baseAplicada: string;
          sugestaoDecisao: string;
          textoIndicacao: string;
        }
      >(
        '/api/ai/proposta',
        {
          proposal: prop,
          legalSources: compactLegalSourcesForAi(legalSources),
        },
        {
          onProgress: (msg) => setAiPropProgress(msg),
        },
      );
      const prefixo =
        res.fallback || res.origem === 'regras'
          ? `[${res.origemLabel || 'Assistente de Regras SERMIG/BCN'}]\n`
          : '';
      const parecer = `${prefixo}Nota ${res.nota}/100 · Sugestão: ${res.sugestaoDecisao}\nBase: ${res.baseAplicada}\nRiscos: ${(res.riscos || []).join('; ')}`;
      await saveDocumentAudited(
        'partnerProposals',
        prop.id,
        {
          ...prop,
          status: 'Em Análise',
          parecerIa: parecer,
          textoIndicacao: res.textoIndicacao,
        },
        false,
        role,
        'parecer_ia_proposta',
      );
      setFeedback(
        res.fallback || res.origem === 'regras'
          ? `${res.origemLabel || 'Assistente de Regras SERMIG/BCN'}. ${res.mensagemUsuario || ''}`
          : `Parecer gerado pela IA para "${prop.nome_empresa}". Revise antes de aprovar.`,
      );
      await onRefresh();
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    } finally {
      setAiPropLoadingId(null);
      setAiPropProgress(null);
    }
  };

  const handleApproveProposal = async (prop: PartnerProposal) => {
    if (approvingPropId) return;
    setApprovingPropId(prop.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const partnerId = makeId('part');
      const { siteInstagram: extractedSite, cleanedMessage } = extractPartnerWebsiteFromMessage(prop.mensagem);
      const newPartner: Partner = {
        id: partnerId,
        nome: String(prop.nome_empresa || '').slice(0, 200),
        tipoPessoa: 'Pessoa Jurídica',
        categoria: prop.categoria,
        pais: prop.pais,
        cidadeRegiao: prop.cidade,
        contato: prop.responsavel,
        whatsapp: String(prop.whatsapp || '').slice(0, 40),
        email: prop.email,
        siteInstagram: extractedSite.slice(0, 300),
        logoUrl: (prop.logoUrl || '').trim().slice(0, 800000),
        moedaNegociacao: prop.moeda,
        tabelaValoresComissao: String(prop.proposta || '').slice(0, 2000),
        condicoesParceria: String(cleanedMessage || prop.proposta || '').slice(0, 2000),
        recomendadoAosClientes: true,
        avaliacao: 5,
        statusHomologacao: 'Ativo/Indicado',
        descricaoPublica: String(prop.textoIndicacao || cleanedMessage || prop.proposta || '').slice(0, 1000),
        observacoes: String(prop.parecerIa || 'Convertido a partir de proposta recebida no site.').slice(0, 3000),
      };
      await syncPartnerAndPublic(newPartner, true, role);
      await saveDocumentAudited(
        'partnerProposals',
        prop.id,
        { ...prop, status: 'Aprovada', partnerIdVinculado: partnerId },
        false,
        role,
        'aprovar_proposta',
      );
      setFeedback(`Parceiro "${newPartner.nome}" homologado e publicado em /parceiros.`);
      await Promise.all([onRefresh(), onRefreshPublic()]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível aprovar e converter a proposta em parceiro.');
    } finally {
      setApprovingPropId(null);
    }
  };

  const requestRejectProposal = (prop: PartnerProposal) => {
    setConfirmModal({
      title: 'Recusar proposta de parceria',
      description: `Deseja marcar a proposta de "${prop.nome_empresa}" como Recusada? O registro permanecerá no histórico para auditoria e poderá ser excluído posteriormente.`,
      confirmLabel: 'Recusar proposta',
      tone: 'warning',
      onConfirm: async () => {
        setErrorMsg(null);
        await rejectPartnerProposalAudited(prop, '', role);
        setFeedback(`Proposta de "${prop.nome_empresa}" marcada como Recusada.`);
        await onRefresh();
      },
    });
  };

  const requestDeleteProposal = (prop: PartnerProposal) => {
    setConfirmModal({
      title: 'Excluir proposta de parceria',
      description: `Confirma a exclusão permanente da proposta enviada por "${prop.nome_empresa}" (${prop.responsavel})? Esta ação será registrada em auditoria.`,
      details: [
        `Categoria: ${prop.categoria} · ${prop.pais}`,
        `Status atual: ${prop.status}`,
      ],
      confirmLabel: 'Excluir proposta',
      tone: 'danger',
      onConfirm: async () => {
        setErrorMsg(null);
        await deletePartnerProposalAudited(prop, role);
        setFeedback(`Proposta de "${prop.nome_empresa}" excluída.`);
        await onRefresh();
      },
    });
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerModal || savingPartner) return;
    setSavingPartner(true);
    setErrorMsg(null);
    try {
      const isNew = !partners.some((p) => p.id === partnerModal.id);
      const full: Partner = {
        id: partnerModal.id || makeId('part'),
        nome: (partnerModal.nome || '').trim().slice(0, 200),
        tipoPessoa: partnerModal.tipoPessoa || 'Pessoa Jurídica',
        categoria: (partnerModal.categoria || 'Outro') as PartnerCategory,
        pais: (partnerModal.pais || 'Chile') as Partner['pais'],
        cidadeRegiao: (partnerModal.cidadeRegiao || '').trim(),
        contato: (partnerModal.contato || '').trim(),
        whatsapp: (partnerModal.whatsapp || '').trim().slice(0, 40),
        email: (partnerModal.email || '').trim(),
        siteInstagram: (partnerModal.siteInstagram || '').trim(),
        logoUrl: (partnerModal.logoUrl || '').trim().slice(0, 800000),
        moedaNegociacao: partnerModal.moedaNegociacao || 'BRL',
        tabelaValoresComissao: (partnerModal.tabelaValoresComissao || '').slice(0, 2000),
        condicoesParceria: (partnerModal.condicoesParceria || '').slice(0, 2000),
        recomendadoAosClientes: Boolean(partnerModal.recomendadoAosClientes),
        avaliacao: Math.min(5, Math.max(1, Number(partnerModal.avaliacao || 5))),
        statusHomologacao: partnerModal.statusHomologacao || 'Ativo/Indicado',
        descricaoPublica: (partnerModal.descricaoPublica || '').slice(0, 1000),
        observacoes: (partnerModal.observacoes || '').slice(0, 3000),
      };
      await syncPartnerAndPublic(full, isNew, role);
      setPartnerModal(null);
      setFeedback(
        full.recomendadoAosClientes && full.statusHomologacao === 'Ativo/Indicado'
          ? `Parceiro "${full.nome}" salvo e publicado em /parceiros.`
          : `Parceiro "${full.nome}" salvo e ocultado da vitrine pública.`,
      );
      await Promise.all([onRefresh(), onRefreshPublic()]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível salvar os dados do parceiro.');
    } finally {
      setSavingPartner(false);
    }
  };

  const requestDeletePartner = (partner: Partner) => {
    setConfirmModal({
      title: 'Excluir parceiro comercial',
      description: `Deseja excluir definitivamente o parceiro "${partner.nome}"? Se ele estiver visível na vitrine pública (/parceiros), também será removido de lá.`,
      details: [
        `Categoria: ${partner.categoria} · ${partner.pais}`,
        `Status: ${partner.statusHomologacao}`,
      ],
      confirmLabel: 'Excluir parceiro',
      tone: 'danger',
      onConfirm: async () => {
        setErrorMsg(null);
        await deletePartnerAndPublicAudited(partner, role, partnerProposals);
        if (partnerModal?.id === partner.id) setPartnerModal(null);
        setFeedback(`Parceiro "${partner.nome}" excluído com sucesso.`);
        await Promise.all([onRefresh(), onRefreshPublic()]);
      },
    });
  };

  const requestDeleteLegalSource = (s: LegalSource) => {
    const usages = computeUsagesForSource(s);
    setConfirmModal({
      title: 'Excluir norma da Base Legal',
      description: `Confirma a exclusão da norma "${s.titulo}"? Recomendamos alterar o status para "Revogada" se houver processos históricos vinculados.`,
      details: [
        `Subcategorias SERMIG vinculadas: ${usages.linkedVisas.length}`,
        `Regras do diagnóstico: ${usages.linkedRules.length}`,
        `Casos ativos potencialmente afetados: ${usages.activeCasesAffected.length}`,
      ],
      confirmLabel: 'Excluir norma',
      tone: 'danger',
      onConfirm: async () => {
        setErrorMsg(null);
        await deleteDocumentAudited('legalSources', s.id, role, {
          titulo: s.titulo,
          numeroAno: s.numeroAno,
          pais: s.pais,
        });
        if (editingSource?.id === s.id) setEditingSource(null);
        setFeedback(`Norma "${s.titulo}" excluída da Base Legal.`);
        await Promise.all([onRefresh(), onRefreshPublic()]);
      },
    });
  };

  // ===========================================================================
  // Base Legal & Versionamento & Impacto
  // ===========================================================================
  const openNewNormModal = () => {
    setIsNewSource(true);
    setNormaNewText('');
    setNormaAiDraft(null);
    setEditingSource({
      id: makeId('leg'),
      titulo: '',
      tipo: 'Lei',
      pais: 'Chile',
      numeroAno: '',
      orgaoEmissor: '',
      artigos: '',
      artigosEstruturados: [],
      resumoPortugues: '',
      explicacaoCliente: '',
      textoIntegral: '',
      tags: [],
      linkOficial: '',
      versao: '1.0',
      statusVigencia: 'A verificar',
      historicoVersoes: [],
    });
  };

  const handleVerifySource = async (s: LegalSource) => {
    setErrorMsg(null);
    try {
      await saveDocumentAudited(
        'legalSources',
        s.id,
        {
          ...s,
          statusVigencia: 'Vigente',
          ultimaVerificacao: toIsoDate(new Date()),
          responsavelVerificacao: userProfile.nome || userProfile.email,
        },
        false,
        role,
        'verificar_norma',
      );
      setFeedback(`Norma "${s.titulo}" marcada como verificada e vigente.`);
      await onRefreshPublic();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível marcar a norma como verificada.');
    }
  };

  const handleCheckLiveSermigLinks = async (targetSources?: LegalSource[]) => {
    if (checkingLiveLinks) return;
    const list = (targetSources && targetSources.length > 0 ? targetSources : legalSources).filter(
      (s) => s.statusVigencia !== 'Revogada',
    );
    if (list.length === 0) {
      setFeedback('Nenhuma norma ativa encontrada para verificação de conectividade SERMIG/BCN.');
      return;
    }
    setCheckingLiveLinks(true);
    setErrorMsg(null);
    try {
      const report = await checkSermigOfficialLinksLive(
        list.map((s) => ({
          id: s.id,
          titulo: s.titulo,
          url: s.linkOficial || '',
        })),
      );
      setLiveCheckMap((prev) => {
        const next = { ...prev };
        for (const item of report.results) {
          next[item.id] = item;
        }
        return next;
      });
      if (!targetSources) {
        setLiveCheckSummary(report.summary);
        setLiveCheckedAt(report.checkedAt);
      }
      const reachable = report.summary.online + report.summary.redirect;
      const modeNote =
        report.verificationMode === 'browser_fallback'
          ? ' (verificação direta pelo navegador)'
          : ' (verificação HTTP ao vivo pelo servidor)';
      setFeedback(
        `Monitoramento SERMIG/BCN concluído${modeNote}: ${reachable} de ${report.summary.total} fonte(s) oficial(is) respondendo online` +
          (report.summary.degraded > 0 ? `, ${report.summary.degraded} com restrição WAF/rede` : '') +
          (report.summary.unreachable + report.summary.invalidUrl > 0
            ? `, ${report.summary.unreachable + report.summary.invalidUrl} com link a revisar.`
            : '.'),
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Não foi possível verificar os portais oficiais SERMIG/BCN.',
      );
    } finally {
      setCheckingLiveLinks(false);
    }
  };

  const handleBatchVerifyPendingNorms = async () => {
    if (batchVerifying) return;
    const pending = legalSources.filter(
      (s) => s.statusVigencia !== 'Revogada' && (s.statusVigencia === 'A verificar' || isSourceOutdated(s)),
    );
    if (pending.length === 0) {
      setFeedback('Todas as normas ativas já estão verificadas e dentro do prazo de revisão.');
      return;
    }
    setBatchVerifying(true);
    setErrorMsg(null);
    try {
      const todayIso = toIsoDate(new Date());
      const verifier = userProfile.nome || userProfile.email;
      for (const src of pending) {
        const live = liveCheckMap[src.id];
        const nextLink =
          live?.status === 'redirect' && live.resolvedUrl && live.resolvedUrl.startsWith('https://')
            ? live.resolvedUrl
            : src.linkOficial;
        await saveDocumentAudited(
          'legalSources',
          src.id,
          {
            ...src,
            linkOficial: nextLink,
            statusVigencia: 'Vigente',
            ultimaVerificacao: todayIso,
            responsavelVerificacao: verifier,
          },
          false,
          role,
          'verificacao_lote_sermig',
        );
      }
      await Promise.all([onRefresh(), onRefreshPublic()]);
      setFeedback(`${pending.length} norma(s) oficial(is) confirmada(s) como Vigente(s) e atualizada(s).`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Falha ao confirmar normas pendentes em lote.',
      );
    } finally {
      setBatchVerifying(false);
    }
  };

  const handleSelectNormaFile = async (file: File) => {
    setErrorMsg(null);
    try {
      const prepared = await prepareAiAttachment(file, {
        fallbackMimeType: 'application/pdf',
      });
      setNormaAttachment({
        name: file.name,
        fileBase64: prepared.fileBase64,
        mimeType: prepared.mimeType,
      });
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    }
  };

  const handleSyncOfficialBase = async () => {
    if (syncingOfficial) return;
    setSyncingOfficial(true);
    setErrorMsg(null);
    setFeedback(null);
    try {
      const result = await syncOfficialLegalCatalog(role);
      await Promise.all([onRefresh(), onRefreshPublic()]);
      if (result.updatedSources === 0 && result.updatedVisas === 0) {
        setFeedback('Base oficial SERMIG/BCN já está sincronizada (normas personalizadas preservadas).');
      } else {
        setFeedback(
          `Base oficial sincronizada: ${result.updatedSources} norma(s) e ${result.updatedVisas} subcategoria(s) de visto atualizadas com links oficiais.`,
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao sincronizar base oficial.');
    } finally {
      setSyncingOfficial(false);
    }
  };

  const handleAnalyzeNormaIa = async () => {
    if (!editingSource || normaAiLoading || (!normaNewText.trim() && !normaAttachment)) return;
    setNormaAiLoading(true);
    setNormaAiProgress('Analisando norma...');
    setErrorMsg(null);
    try {
      const res = await callAiEndpoint<
        AiResponseMeta & {
          artigosExtraidos: string;
          resumoExecutivo: string;
          explicacaoCliente: string;
          impactosVistos: string[];
          divergencias: string[];
        }
      >(
        '/api/ai/norma',
        {
          currentSource: compactSourceForAi(editingSource),
          newText: normaNewText,
          fileBase64: normaAttachment?.fileBase64,
          mimeType: normaAttachment?.mimeType,
        },
        {
          onProgress: (msg) => setNormaAiProgress(msg),
        },
      );
      setNormaAiDraft(res);
      saveAiDraftCache(`norma_${editingSource.id}`, res);
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    } finally {
      setNormaAiLoading(false);
      setNormaAiProgress(null);
    }
  };

  const handleVerifyNormaOnlineIa = async (targetSource?: LegalSource) => {
    const src = targetSource || editingSource;
    if (!src || normaAiLoading) return;
    if (targetSource) {
      setIsNewSource(false);
      setEditingSource(targetSource);
    }
    setNormaAiLoading(true);
    setNormaAiProgress('Consultando SERMIG e BCN LeyChile online...');
    setErrorMsg(null);
    try {
      const res = await callAiEndpoint<
        AiResponseMeta & {
          possuiAtualizacao: boolean;
          situacaoAtual: string;
          artigosExtraidos: string;
          resumoExecutivo: string;
          explicacaoCliente: string;
          impactosVistos: string[];
          divergencias: string[];
          fontesCitadas: string[];
          fontesOnline?: Array<{ titulo: string; url: string }>;
        }
      >(
        '/api/ai/norma-verificar',
        { currentSource: compactSourceForAi(src) },
        { onProgress: (msg) => setNormaAiProgress(msg) },
      );
      setNormaAiDraft(res);
      saveAiDraftCache(`norma_${src.id}`, res);
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    } finally {
      setNormaAiLoading(false);
      setNormaAiProgress(null);
    }
  };

  const handlePublishNormaUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource) return;
    setErrorMsg(null);
    try {
      const prevSource = legalSources.find((x) => x.id === editingSource.id);
      const nextVerNum = isNewSource
        ? editingSource.versao || '1.0'
        : (Number.parseFloat(editingSource.versao || '1.0') + 0.1).toFixed(1);
      const hist = editingSource.historicoVersoes || [];
      const nextHist = isNewSource
        ? hist
        : [
            ...hist,
            {
              versao: prevSource?.versao || editingSource.versao || '1.0',
              data: toIsoDate(new Date()),
              resumo: prevSource?.resumoPortugues || editingSource.resumoPortugues,
              textoSnapshot: prevSource?.textoIntegral || editingSource.textoIntegral,
            },
          ];

      const updated: LegalSource = {
        ...editingSource,
        titulo: editingSource.titulo.trim(),
        linkOficial: (editingSource.linkOficial || '').trim(),
        artigos: normaAiDraft?.artigosExtraidos || editingSource.artigos,
        resumoPortugues: normaAiDraft?.resumoExecutivo || editingSource.resumoPortugues,
        explicacaoCliente: normaAiDraft?.explicacaoCliente || editingSource.explicacaoCliente,
        textoIntegral: normaNewText.trim() || editingSource.textoIntegral,
        versao: nextVerNum,
        ultimaVerificacao: toIsoDate(new Date()),
        responsavelVerificacao: userProfile.nome || userProfile.email,
        historicoVersoes: nextHist,
      };
      await saveDocumentAudited(
        'legalSources',
        updated.id,
        updated as unknown as Record<string, unknown>,
        isNewSource,
        role,
        isNewSource ? 'criar_norma' : 'atualizar_norma',
        prevSource || null,
      );

      // Gerar tasks automáticas de revisão para casos ativos afetados se norma mudou
      let tasksCreated = 0;
      if (!isNewSource) {
        const usages = computeUsagesForSource(updated);
        for (const cs of usages.activeCasesAffected.slice(0, 15)) {
          const tId = makeId('task');
          const t: Task = {
            id: tId,
            titulo: `[Revisão Normativa] Verificar impacto de ${updated.numeroAno || updated.titulo}`,
            descricao: `Norma atualizada para v${nextVerNum} (${updated.statusVigencia}). Conferir requisitos e parecer do caso "${cs.titulo}".`,
            caseId: cs.id,
            clientId: cs.clientId,
            prazo: toIsoDate(new Date(Date.now() + 3 * 86400000)),
            prioridade: 'Alta',
            status: 'Pendente',
            createdAt: new Date().toISOString(),
          };
          await saveDocumentAudited('tasks', tId, t as unknown as Record<string, unknown>, true, role, 'revisao_norma_caso');
          tasksCreated++;
        }
      }

      clearAiDraftCache(`norma_${editingSource.id}`);
      setEditingSource(null);
      setNormaAiDraft(null);
      setNormaNewText('');
      setNormaAttachment(null);
      setIsNewSource(false);
      setFeedback(
        isNewSource
          ? `Norma "${updated.titulo}" cadastrada com sucesso.`
          : `Norma "${updated.titulo}" publicada na versão ${nextVerNum}.${
              tasksCreated > 0 ? ` ${tasksCreated} tarefa(s) de revisão criada(s) para casos afetados.` : ''
            }`,
      );
      await Promise.all([onRefresh(), onRefreshPublic()]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Não foi possível salvar a norma na Base Legal.',
      );
    }
  };

  const handleRestoreNormaVersion = async (src: LegalSource, histEntry: NonNullable<LegalSource['historicoVersoes']>[number]) => {
    setErrorMsg(null);
    try {
      const nextVer = (Number.parseFloat(src.versao || '1.0') + 0.1).toFixed(1);
      const restored: LegalSource = {
        ...src,
        resumoPortugues: histEntry.resumo,
        textoIntegral: histEntry.textoSnapshot ?? src.textoIntegral,
        versao: nextVer,
        historicoVersoes: [
          ...(src.historicoVersoes || []),
          {
            versao: src.versao,
            data: toIsoDate(new Date()),
            resumo: src.resumoPortugues,
            textoSnapshot: src.textoIntegral,
          },
        ],
      };
      await saveDocumentAudited(
        'legalSources',
        src.id,
        restored as unknown as Record<string, unknown>,
        false,
        role,
        `restaurar_norma_${histEntry.versao}`,
        src,
      );
      setHistorySource(null);
      setFeedback(`Versão ${histEntry.versao} restaurada como v${nextVer}.`);
      await onRefreshPublic();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível restaurar a versão anterior da norma.');
    }
  };

  if (role === 'assistente') {
    return (
      <div
        className="border border-slate-200 p-8 text-center text-sm text-slate-600"
        style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--card-radius, 12px)' }}
      >
        Acesso restrito a Administradores e Consultores.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {sectionGroup === 'parceiros'
              ? 'Parceiros Comerciais & Propostas'
              : sectionGroup === 'legal'
                ? 'Base Legal & Catálogo SERMIG'
                : 'Parceiros, Base Legal & Catálogo SERMIG'}
          </h1>
          <p className="text-xs text-slate-500">
            {sectionGroup === 'parceiros'
              ? 'Triagem de propostas recebidas, rede de parceiros ativos e regras de comissão isoladas da vitrine pública'
              : sectionGroup === 'legal'
                ? 'Leis, decretos, portais oficiais, subcategorias de vistos e requisitos migratórios'
                : 'Gestão comercial de parceiros (comissões isoladas da vitrine pública) e governança normativa'}
          </p>
        </div>
        {(tab === 'legal' || tab === 'vistos') && (
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'legal' && (
              <button
                type="button"
                disabled={checkingLiveLinks}
                onClick={() => void handleCheckLiveSermigLinks()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                <Wifi className={`w-3.5 h-3.5 ${checkingLiveLinks ? 'animate-pulse text-[var(--color-primary)]' : 'text-emerald-600'}`} />
                {checkingLiveLinks ? 'Testando Portais SERMIG/BCN...' : 'Verificar Links SERMIG (Ao Vivo)'}
              </button>
            )}
            {tab === 'legal' && (healthStats.aVerificar > 0 || healthStats.outdated > 0) && (
              <button
                type="button"
                disabled={batchVerifying}
                onClick={() => void handleBatchVerifyPendingNorms()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-xs font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/70 disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                {batchVerifying ? 'Confirmando...' : 'Confirmar Pendentes'}
              </button>
            )}
            <button
              type="button"
              disabled={syncingOfficial}
              onClick={() => void handleSyncOfficialBase()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingOfficial ? 'animate-spin' : ''}`} />
              {syncingOfficial ? 'Sincronizando...' : 'Sincronizar Base SERMIG/BCN'}
            </button>
            {tab === 'legal' && (
              <button
                type="button"
                onClick={openNewNormModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Nova Norma / Portal
              </button>
            )}
          </div>
        )}
      </div>

      {tab === 'legal' && liveCheckSummary && (
        <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0F1629] px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs tabular-nums">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              Status ao vivo SERMIG / BCN
            </span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
              {liveCheckSummary.online} online
            </span>
            {liveCheckSummary.redirect > 0 && (
              <span className="text-sky-700 dark:text-sky-400 font-semibold">
                {liveCheckSummary.redirect} redirecionada(s)
              </span>
            )}
            {liveCheckSummary.degraded > 0 && (
              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                {liveCheckSummary.degraded} protegida(s) por WAF
              </span>
            )}
            {liveCheckSummary.unreachable + liveCheckSummary.invalidUrl > 0 && (
              <span className="text-[#C82333] dark:text-red-400 font-semibold">
                {liveCheckSummary.unreachable + liveCheckSummary.invalidUrl} com link a revisar
              </span>
            )}
          </div>
          {liveCheckedAt && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Checado em {new Date(liveCheckedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          ...(sectionGroup !== 'legal'
            ? [
                { id: 'propostas', label: `Propostas Recebidas (${partnerProposals.length})` },
                { id: 'parceiros', label: `Parceiros (${partners.length})` },
              ]
            : []),
          ...(sectionGroup !== 'parceiros'
            ? [
                { id: 'legal', label: `Base Legal (${legalSources.length})` },
                { id: 'vistos', label: `Vistos & Requisitos (${visaCategories.length})` },
              ]
            : []),
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as TabKey)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap ${
              tab === t.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-slate-500'
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

      {/* KPI STRIP DO MÓDULO DE PARCEIROS */}
      {(tab === 'propostas' || tab === 'parceiros') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              setTab('propostas');
              setProposalStatusFilter('Nova');
            }}
            className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-colors"
          >
            <p className="text-xs text-slate-500">Propostas pendentes</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {partnerMetrics.pendingProposals}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
              {partnerMetrics.approvedProposals} aprovada(s) · {partnerMetrics.rejectedProposals} recusada(s)
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab('parceiros');
              setPartnerVisibilityFilter('publicados');
            }}
            className="text-left bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 transition-colors"
          >
            <p className="text-xs text-slate-500">Publicados em /parceiros</p>
            <p className="text-2xl font-bold text-[#146B43] font-mono tabular-nums mt-1">
              {partnerMetrics.publishedCount}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
              {partnerMetrics.hiddenCount} oculto(s) ou em análise
            </p>
          </button>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Cobertura binacional</p>
            <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
              {partnerMetrics.brazilCount} BR · {partnerMetrics.chileCount} CL
            </p>
            <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
              {partnerMetrics.binationalCount} binacional(is) · {partnerMetrics.uniqueCategories} especialidade(s)
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-500">Avaliação média da rede</p>
            <p className="text-2xl font-bold text-[#8C6D14] font-mono tabular-nums mt-1">
              {partnerMetrics.averageRating > 0 ? `${partnerMetrics.averageRating.toFixed(1)}/5` : '—'}
            </p>
            <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
              Base de {partnerMetrics.totalPartners} parceiro(s) cadastrado(s)
            </p>
          </div>
        </div>
      )}

      {/* PROPOSTAS */}
      {tab === 'propostas' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={proposalSearch}
                onChange={(e) => setProposalSearch(e.target.value)}
                placeholder="Buscar proposta por empresa, responsável, cidade ou categoria..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(['Todas', 'Nova', 'Em Análise', 'Aprovada', 'Recusada'] as const).map((st) => {
                const count =
                  st === 'Todas'
                    ? partnerProposals.length
                    : partnerProposals.filter((item) => item.status === st).length;
                const active = proposalStatusFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setProposalStatusFilter(st)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-colors ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {filteredProposals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {partnerProposals.length === 0
                  ? 'Nenhuma proposta de parceria recebida ainda.'
                  : 'Nenhuma proposta corresponde aos filtros selecionados.'}
              </p>
              {proposalStatusFilter !== 'Todas' || proposalSearch.trim() !== '' ? (
                <button
                  type="button"
                  onClick={() => {
                    setProposalStatusFilter('Todas');
                    setProposalSearch('');
                  }}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                >
                  Limpar filtros
                </button>
              ) : null}
            </div>
          ) : (
            filteredProposals.map((p) => {
              const statusTone =
                p.status === 'Aprovada'
                  ? 'text-[#146B43]'
                  : p.status === 'Recusada'
                    ? 'text-[#C82333]'
                    : p.status === 'Em Análise'
                      ? 'text-amber-700'
                      : 'text-[var(--color-primary)]';

              const safeProposalLogo = sanitizePartnerImageUrl(p.logoUrl);

              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      {safeProposalLogo && (
                        <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                          <OptimizedImage
                            src={safeProposalLogo}
                            alt={p.nome_empresa}
                            sizes="48px"
                            containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                            className="max-w-full max-h-full object-contain p-1"
                          />
                        </div>
                      )}
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs text-slate-500">
                          <span>{p.categoria}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{p.pais}{p.cidade ? ` (${p.cidade})` : ''}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono">Moeda {p.moeda}</span>
                          <span aria-hidden="true"> · </span>
                          <strong className={statusTone}>{p.status}</strong>
                          {p.createdAt ? ` · ${formatDateBR(p.createdAt)}` : ''}
                        </p>
                        <h3 className="text-base font-bold text-slate-900">{p.nome_empresa}</h3>
                        <p className="text-xs text-slate-600">
                          Responsável: <strong className="font-semibold text-slate-800">{p.responsavel}</strong> · {p.whatsapp} · {p.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={aiPropLoadingId !== null}
                        onClick={() => void handleAnalyzeProposalIa(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                        {aiPropLoadingId === p.id ? aiPropProgress || 'Analisando...' : 'Avaliar com IA'}
                      </button>
                      {p.status !== 'Aprovada' && (
                        <button
                          type="button"
                          disabled={approvingPropId !== null}
                          onClick={() => void handleApproveProposal(p)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#146B43] hover:bg-[#115a38] disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          {approvingPropId === p.id ? 'Homologando...' : 'Aprovar e Publicar'}
                        </button>
                      )}
                      {p.status !== 'Aprovada' && p.status !== 'Recusada' && (
                        <button
                          type="button"
                          onClick={() => requestRejectProposal(p)}
                          className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
                        >
                          Recusar
                        </button>
                      )}
                      <a
                        href={buildWhatsAppUrl(p.whatsapp, `Olá, ${p.responsavel}! Recebemos sua proposta de parceria da ${p.nome_empresa} na D&M Integra Chile.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Responder
                      </a>
                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => requestDeleteProposal(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50 whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1">
                    <div className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                      <p className="font-semibold text-slate-900 mb-1">Proposta comercial</p>
                      <p className="leading-relaxed whitespace-pre-wrap">{p.proposta || 'Não informada.'}</p>
                    </div>
                    {p.mensagem && (
                      <div className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                        <p className="font-semibold text-slate-900 mb-1">Apresentação institucional</p>
                        <p className="leading-relaxed whitespace-pre-wrap">{p.mensagem}</p>
                      </div>
                    )}
                  </div>

                  {p.parecerIa && (
                    <div className="text-xs text-slate-800 bg-amber-50/70 p-3.5 rounded-lg border border-amber-200 space-y-1">
                      <p className="font-semibold text-amber-950">Parecer técnico automatizado</p>
                      <p className="whitespace-pre-wrap leading-relaxed">{p.parecerIa}</p>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* PARCEIROS */}
      {tab === 'parceiros' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                placeholder="Buscar parceiro por nome, cidade, contato ou condição comercial..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              />
            </div>
            <select
              value={partnerPaisFilter}
              onChange={(e) => setPartnerPaisFilter(e.target.value as typeof partnerPaisFilter)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            >
              <option value="Todos">País: Todos</option>
              <option value="Brasil">Brasil</option>
              <option value="Chile">Chile</option>
              <option value="Ambos">Brasil &amp; Chile</option>
            </select>
            <select
              value={partnerCatFilter}
              onChange={(e) => setPartnerCatFilter(e.target.value)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            >
              <option value="Todas">Categoria: Todas</option>
              {PARTNER_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={partnerVisibilityFilter}
              onChange={(e) => setPartnerVisibilityFilter(e.target.value as typeof partnerVisibilityFilter)}
              className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            >
              <option value="Todos">Vitrine: Todos</option>
              <option value="publicados">Publicados em /parceiros</option>
              <option value="ocultos">Ocultos / Em análise</option>
            </select>
            <button
              type="button"
              onClick={() =>
                setPartnerModal({
                  id: makeId('part'),
                  nome: '',
                  tipoPessoa: 'Pessoa Jurídica',
                  categoria: 'Escritório de Advocacia',
                  pais: 'Chile',
                  moedaNegociacao: 'BRL',
                  recomendadoAosClientes: true,
                  avaliacao: 5,
                  statusHomologacao: 'Ativo/Indicado',
                })
              }
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Parceiro
            </button>
          </div>

          {filteredPanelPartners.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {partners.length === 0
                  ? 'Nenhum parceiro cadastrado ainda.'
                  : 'Nenhum parceiro corresponde aos filtros aplicados.'}
              </p>
              {partners.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPartnerSearch('');
                    setPartnerPaisFilter('Todos');
                    setPartnerCatFilter('Todas');
                    setPartnerVisibilityFilter('Todos');
                  }}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredPanelPartners.map((p) => {
                const published = isPartnerPublishedPublicly(p);
                const safeExternal = normalizePartnerExternalUrl(p.siteInstagram);
                const safeLogo = sanitizePartnerImageUrl(p.logoUrl);

                return (
                  <div
                    key={p.id}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2.5">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          {safeLogo && (
                            <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                              <OptimizedImage
                                src={safeLogo}
                                alt={p.nome}
                                sizes="48px"
                                containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                                className="max-w-full max-h-full object-contain p-1"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs text-slate-500">
                              <span className="font-semibold text-[#8C6D14]">{p.categoria}</span>
                              <span aria-hidden="true"> · </span>
                              <span>{p.pais}{p.cidadeRegiao ? ` (${p.cidadeRegiao})` : ''}</span>
                              <span aria-hidden="true"> · </span>
                              <strong className={published ? 'text-[#146B43]' : 'text-amber-700'}>
                                {p.statusHomologacao}
                              </strong>
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <h3 className="text-base font-bold text-slate-900 truncate">{p.nome}</h3>
                              <span className="inline-flex items-center gap-0.5 text-xs font-mono font-semibold text-slate-700 tabular-nums shrink-0">
                                <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                                {Number(p.avaliacao || 5).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => setPartnerModal(p)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          >
                            Editar
                          </button>
                          {role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => requestDeletePartner(p)}
                              aria-label={`Excluir parceiro ${p.nome}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50 whitespace-nowrap"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Excluir
                            </button>
                          )}
                        </div>
                      </div>

                      {(p.contato || p.whatsapp || p.email) && (
                        <p className="text-xs text-slate-600">
                          {p.contato ? `Contato: ${p.contato}` : ''}
                          {p.whatsapp ? `${p.contato ? ' · ' : ''}${p.whatsapp}` : ''}
                          {p.email ? ` · ${p.email}` : ''}
                        </p>
                      )}

                      {p.descricaoPublica && (
                        <p className="text-xs text-slate-600 leading-relaxed">{p.descricaoPublica}</p>
                      )}

                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs">
                        <p className="font-semibold text-slate-800">
                          Comissão interna ({p.moedaNegociacao}) — Confidencial
                        </p>
                        <p className="text-slate-700 leading-relaxed">
                          {p.tabelaValoresComissao || 'Sem regra de comissão cadastrada.'}
                        </p>
                        {p.condicoesParceria && (
                          <p className="text-slate-500 pt-1 border-t border-slate-200/80">
                            Condições: {p.condicoesParceria}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={published ? 'font-semibold text-[#146B43]' : 'text-slate-500'}>
                          Vitrine /parceiros: {published ? 'Publicado' : 'Oculto'}
                        </span>
                        {p.whatsapp && (
                          <a
                            href={buildWhatsAppUrl(p.whatsapp, `Olá ${p.contato || p.nome}, contato da equipe D&M Integra Chile.`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#146B43] font-semibold hover:underline"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        )}
                        {safeExternal && (
                          <a
                            href={safeExternal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 font-semibold hover:underline"
                          >
                            Site/IG
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={togglingPartnerId === p.id}
                        onClick={() => void handleTogglePartnerPublic(p)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
                          published
                            ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                        }`}
                      >
                        {togglingPartnerId === p.id
                          ? 'Atualizando...'
                          : published
                            ? 'Ocultar da vitrine'
                            : 'Publicar em /parceiros'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BASE LEGAL */}
      {tab === 'legal' && (
        <div className="space-y-4">
          {/* Painel Saúde da Base Legal */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <button
              type="button"
              onClick={() => {
                setFilterStatus(filterStatus === 'Vigente' ? 'Todos' : 'Vigente');
                setOnlyOutdated(false);
              }}
              className={`text-left bg-white border rounded-xl p-3 transition-colors ${
                filterStatus === 'Vigente' && !onlyOutdated ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-[11px] text-slate-500">Vigentes</p>
              <p className="text-lg font-bold text-[#1E7E34] tabular-nums">{healthStats.vigente}</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStatus(filterStatus === 'A verificar' ? 'Todos' : 'A verificar');
                setOnlyOutdated(false);
              }}
              className={`text-left bg-white border rounded-xl p-3 transition-colors ${
                filterStatus === 'A verificar' ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-[11px] text-slate-500">A verificar</p>
              <p className="text-lg font-bold text-amber-700 tabular-nums">{healthStats.aVerificar}</p>
            </button>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] text-slate-500">Alteradas / Revog.</p>
              <p className="text-lg font-bold text-slate-900 tabular-nums">
                {healthStats.alterada} / {healthStats.revogada}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOnlyOutdated((v) => !v);
                setFilterStatus('Todos');
              }}
              className={`text-left bg-white border rounded-xl p-3 transition-colors ${
                onlyOutdated ? 'border-[#C82333] bg-red-50/40' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <p className="text-[11px] text-slate-500">Revisão &gt; {diasAlerta}d</p>
              <p className="text-lg font-bold text-[#C82333] tabular-nums">{healthStats.outdated}</p>
            </button>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] text-slate-500">Sem link oficial</p>
              <p className="text-lg font-bold text-slate-700 tabular-nums">{healthStats.missingLink}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3">
              <p className="text-[11px] text-slate-500">Sem vínculos</p>
              <p className="text-lg font-bold text-slate-700 tabular-nums">{healthStats.unlinked}</p>
            </div>
          </div>

          {/* Busca, Filtros Avançados e Favoritos */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div className="lg:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={searchLegal}
                  onChange={(e) => setSearchLegal(e.target.value)}
                  placeholder="Buscar por título, nº/ano, artigo ou tag..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                />
              </div>
              <select
                value={filterPais}
                onChange={(e) => setFilterPais(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              >
                <option value="Todos">País: Todos</option>
                <option value="Chile">Chile</option>
                <option value="Brasil">Brasil</option>
                <option value="Mercosul">Mercosul</option>
              </select>
              <select
                value={filterTipo}
                onChange={(e) => setFilterTipo(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              >
                <option value="Todos">Tipo: Todos</option>
                <option value="Lei">Lei</option>
                <option value="Decreto">Decreto</option>
                <option value="Resolução">Resolução</option>
                <option value="Circular">Circular</option>
                <option value="Acordo Internacional">Acordo Internacional</option>
                <option value="Portal Oficial">Portal Oficial</option>
                <option value="Jurisprudência">Jurisprudência</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              >
                <option value="Todos">Status: Todos</option>
                <option value="Vigente">Vigente</option>
                <option value="A verificar">A verificar</option>
                <option value="Alterada">Alterada</option>
                <option value="Revogada">Revogada</option>
              </select>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              >
                <option value="verificacao_asc">Mais antiga primeiro</option>
                <option value="verificacao_desc">Mais recente primeiro</option>
                <option value="titulo">Ordem alfabética</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOnlyFav((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold ${
                    onlyFav ? 'bg-amber-50 border-amber-300 text-amber-900' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  <Star className="w-3.5 h-3.5" />
                  Apenas Favoritas
                </button>
                <button
                  type="button"
                  onClick={() => setOnlyOutdated((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-semibold ${
                    onlyOutdated ? 'bg-red-50 border-red-300 text-[#C82333]' : 'border-slate-300 text-slate-600'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Revisão Vencida (&gt; {diasAlerta}d)
                </button>
                <button
                  type="button"
                  onClick={handleSavePreset}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  Salvar filtro atual
                </button>
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200"
                  >
                    {p.nome}
                  </button>
                ))}
              </div>
              <span className="text-slate-500 tabular-nums">{filteredLegal.length} norma(s) exibida(s)</span>
            </div>
          </div>

          <div className="space-y-3">
            {filteredLegal.map((s) => {
              const outdated = isSourceOutdated(s);
              const isFav = (s.favoritoPorUids || []).includes(userProfile.uid);
              const usages = computeUsagesForSource(s);
              return (
                <div
                  key={s.id}
                  className={`bg-white border rounded-xl p-5 space-y-2.5 ${
                    s.statusVigencia === 'Revogada' ? 'border-slate-300 opacity-80 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs text-slate-500">
                        {s.pais} · {s.tipo} · {s.numeroAno || 'Portal'} · Versão {s.versao} · Status:{' '}
                        <strong>{s.statusVigencia}</strong>
                        {s.ultimaVerificacao ? ` · Verificada em ${formatDateBR(s.ultimaVerificacao)}` : ' · Nunca verificada'}
                        {s.responsavelVerificacao ? ` (${s.responsavelVerificacao})` : ''}
                      </p>
                      <h3 className="text-base font-bold text-slate-900">{s.titulo}</h3>
                      <p className="text-[11px] text-slate-500">
                        Vínculos: {usages.linkedVisas.length} visto(s) · {usages.linkedRules.length} regra(s) ·{' '}
                        {usages.activeCasesAffected.length} caso(s) ativo(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleToggleFavorite(s)}
                        aria-label="Favoritar norma"
                        className={`p-1.5 rounded-lg border ${
                          isFav ? 'bg-amber-50 border-amber-300 text-amber-600' : 'border-slate-300 text-slate-400'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                      {outdated && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309] mr-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Revisão &gt; {diasAlerta}d
                        </span>
                      )}
                      {s.statusVigencia !== 'Revogada' && (
                        <button
                          type="button"
                          onClick={() => void handleVerifySource(s)}
                          className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-900"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                          Verificada
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setUsageSource(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Onde é usada
                      </button>
                      {(s.historicoVersoes || []).length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setHistorySource(s);
                            setCompareHistIdx((s.historicoVersoes?.length || 1) - 1);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <History className="w-3.5 h-3.5" />
                          Histórico ({s.historicoVersoes?.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleVerifyNormaOnlineIa(s)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        <Globe className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        Verificar Online (IA)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewSource(false);
                          setEditingSource(s);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Editar / IA
                      </button>
                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => requestDeleteLegalSource(s)}
                          aria-label={`Excluir norma ${s.titulo}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-700">{s.resumoPortugues}</p>
                  <p className="text-xs text-slate-500">
                    <strong>Entenda a Lei:</strong> {s.explicacaoCliente}
                  </p>
                  {s.notasInternasConsultor && (
                    <p className="text-[11px] text-slate-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1">
                      <strong>Nota interna do consultor:</strong> {s.notasInternasConsultor}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
                    <div className="flex flex-wrap items-center gap-3">
                      {s.linkOficial && (
                        <a
                          href={s.linkOficial}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--color-primary)] dark:text-sky-400 font-semibold hover:underline"
                        >
                          Fonte oficial <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {s.arquivoPdfUrl && (
                        <a
                          href={s.arquivoPdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold hover:underline"
                        >
                          PDF anexado <FileText className="w-3 h-3" />
                        </a>
                      )}
                      {s.linkOficial && (
                        <button
                          type="button"
                          disabled={checkingLiveLinks}
                          onClick={() => void handleCheckLiveSermigLinks([s])}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-50"
                        >
                          <Wifi className="w-3 h-3" />
                          Testar link
                        </button>
                      )}
                    </div>

                    {liveCheckMap[s.id] && (() => {
                      const live = liveCheckMap[s.id];
                      const tone =
                        live.status === 'online'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : live.status === 'redirect'
                            ? 'text-sky-700 dark:text-sky-400'
                            : live.status === 'degraded'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-[#C82333] dark:text-red-400';
                      const label =
                        live.status === 'online'
                          ? `Online (${live.latencyMs}ms)`
                          : live.status === 'redirect'
                            ? `Redirecionado (${live.latencyMs}ms)`
                            : live.status === 'degraded'
                              ? `WAF/Lento (HTTP ${live.httpStatus ?? 'timeout'})`
                              : live.status === 'invalid_url'
                                ? 'Link inválido'
                                : `Indisponível (HTTP ${live.httpStatus ?? 'erro'})`;
                      return (
                        <div className="flex flex-wrap items-center gap-2 text-[11px] tabular-nums">
                          <span className={`font-semibold ${tone}`} title={live.detail}>
                            {label}
                            {live.pageTitle ? ` · ${live.pageTitle}` : ''}
                          </span>
                          {live.status === 'redirect' && live.resolvedUrl && live.resolvedUrl !== s.linkOficial && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await saveDocumentAudited(
                                    'legalSources',
                                    s.id,
                                    { ...s, linkOficial: live.resolvedUrl, ultimaVerificacao: toIsoDate(new Date()) },
                                    false,
                                    role,
                                    'atualizar_link_canonico_sermig',
                                  );
                                  setFeedback(`Link canônico atualizado para "${s.titulo}".`);
                                  await onRefreshPublic();
                                } catch (err) {
                                  setErrorMsg(err instanceof Error ? err.message : 'Falha ao atualizar URL canônica.');
                                }
                              }}
                              className="font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline"
                            >
                              Usar link atualizado
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISTOS & REQUISITOS SERMIG (Explorador Dinâmico) */}
      {tab === 'vistos' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#0F1629] border border-slate-200/90 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={visaSearch}
                onChange={(e) => setVisaSearch(e.target.value)}
                placeholder="Buscar subcategoria SERMIG, código ou documento exigido..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/80 text-xs text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={visaInsideFilter}
                onChange={(e) => setVisaInsideFilter(e.target.value as typeof visaInsideFilter)}
                aria-label="Filtrar por solicitação dentro do Chile"
                className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="Todos">Dentro do Chile: Todos</option>
                <option value="Sim">Permite dentro do Chile</option>
                <option value="Condicional">Condicional</option>
                <option value="Não">Somente do exterior</option>
              </select>

              <select
                value={visaVerifyFilter}
                onChange={(e) => setVisaVerifyFilter(e.target.value as typeof visaVerifyFilter)}
                aria-label="Filtrar por status de verificação SERMIG"
                className="px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
              >
                <option value="Todos">Verificação: Todas</option>
                <option value="Verificado">Verificado</option>
                <option value="A verificar">A verificar</option>
              </select>

              <span className="text-slate-500 dark:text-slate-400 tabular-nums px-1">
                {filteredVisas.length} de {visaCategories.length} subcategoria(s)
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-[#0F1629] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60">
                  <th className="py-3 px-4 font-semibold w-10" />
                  <th className="py-3 px-4 font-semibold">Código</th>
                  <th className="py-3 px-4 font-semibold">Subcategoria SERMIG</th>
                  <th className="py-3 px-4 font-semibold">Dentro do Chile</th>
                  <th className="py-3 px-4 font-semibold">Requisitos</th>
                  <th className="py-3 px-4 font-semibold">Base Legal</th>
                  <th className="py-3 px-4 font-semibold">Verificação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredVisas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-500 dark:text-slate-400">
                      Nenhuma subcategoria SERMIG encontrada para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredVisas.map((v) => {
                    const reqs = visaRequirements.filter((r) => r.visaCategoryId === v.id);
                    const isExpanded = expandedVisaId === v.id;
                    const linkedNorms = legalSources.filter(
                      (ls) =>
                        (v.legalSourceIds || []).includes(ls.id) ||
                        (v.codigo === '15' && ls.id.includes('mercosul')) ||
                        ls.id === 'leg_ley_21325' ||
                        ls.id === 'leg_dec_177_2022',
                    );
                    return (
                      <React.Fragment key={v.id}>
                        <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setExpandedVisaId(isExpanded ? null : v.id)}
                              aria-label={isExpanded ? 'Recolher requisitos' : 'Expandir requisitos'}
                              className="p-1 rounded hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-500"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          </td>
                          <td className="py-3 px-4 font-bold tabular-nums text-slate-900 dark:text-slate-100">{v.codigo}</td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() => setExpandedVisaId(isExpanded ? null : v.id)}
                              className="text-left group"
                            >
                              <p className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-primary)]">
                                {v.nomePortugues}
                              </p>
                              <p className="text-slate-500 dark:text-slate-400">{v.nomeEspanhol}</p>
                            </button>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                            {v.permiteDentroChile}
                          </td>
                          <td className="py-3 px-4 tabular-nums">
                            <button
                              type="button"
                              onClick={() => setExpandedVisaId(isExpanded ? null : v.id)}
                              className="font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline"
                            >
                              {reqs.length} item(ns)
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              type="button"
                              onClick={() =>
                                setLegalDrawerData({
                                  title: `Base Legal — Cód. ${v.codigo} (${v.nomePortugues})`,
                                  sources: linkedNorms,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              Base Legal ({linkedNorms.length})
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={savingVisaId === v.id}
                                onClick={async () => {
                                  setSavingVisaId(v.id);
                                  setErrorMsg(null);
                                  try {
                                    const nextStatus = v.statusVerificacao === 'Verificado' ? 'A verificar' : 'Verificado';
                                    await saveDocumentAudited(
                                      'visaCategories',
                                      v.id,
                                      {
                                        ...v,
                                        statusVerificacao: nextStatus,
                                        ultimaVerificacao: toIsoDate(new Date()),
                                      },
                                      false,
                                      role,
                                      'verificacao_visto',
                                    );
                                    setFeedback(`Subcategoria "${v.nomePortugues}" marcada como ${nextStatus}.`);
                                    await onRefreshPublic();
                                  } catch (err) {
                                    setErrorMsg(
                                      err instanceof Error ? err.message : 'Falha ao atualizar verificação da subcategoria SERMIG.',
                                    );
                                  } finally {
                                    setSavingVisaId(null);
                                  }
                                }}
                                className={`px-2.5 py-1 rounded border text-xs font-semibold disabled:opacity-50 whitespace-nowrap shrink-0 ${
                                  v.statusVerificacao === 'Verificado'
                                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-300'
                                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-300'
                                }`}
                              >
                                {savingVisaId === v.id ? 'Salvando...' : v.statusVerificacao}
                              </button>
                              {(role === 'admin' || role === 'consultor') && (
                                <button
                                  type="button"
                                  title="Excluir subcategoria SERMIG"
                                  aria-label={`Excluir subcategoria ${v.nomePortugues}`}
                                  onClick={() =>
                                    setConfirmModal({
                                      title: 'Excluir subcategoria de visto',
                                      description: `Tem certeza que deseja excluir a subcategoria SERMIG Cód. ${v.codigo} — "${v.nomePortugues}"?`,
                                      details:
                                        reqs.length > 0
                                          ? [
                                              `${reqs.length} requisito(s) vinculado(s) também serão removidos.`,
                                              'A exclusão será registrada na subcoleção de auditoria.',
                                            ]
                                          : ['A exclusão será registrada na subcoleção de auditoria.'],
                                      confirmLabel: 'Excluir subcategoria',
                                      tone: 'danger',
                                      onConfirm: async () => {
                                        for (const reqItem of reqs) {
                                          await deleteDocumentAudited('visaRequirements', reqItem.id, role, reqItem);
                                        }
                                        await deleteDocumentAudited('visaCategories', v.id, role, v);
                                        if (expandedVisaId === v.id) setExpandedVisaId(null);
                                        setConfirmModal(null);
                                        setFeedback(`Subcategoria "${v.nomePortugues}" excluída com auditoria.`);
                                        await onRefreshPublic();
                                      },
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 dark:border-red-900/60 text-[#C82333] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-semibold whitespace-nowrap shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Excluir
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-slate-900/40">
                            <td colSpan={7} className="px-6 py-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                                    Elegibilidade & Regras SERMIG — Cód. {v.codigo}
                                  </p>
                                  <p className="text-slate-600 dark:text-slate-400">
                                    {v.descricao || 'Consulte os requisitos documentais e normas vinculadas abaixo.'}
                                    {v.levaDefinitiva ? ` · Elegível à Residência Definitiva (${v.mesesDefinitiva || 24} meses).` : ''}
                                  </p>
                                </div>
                                {v.fonteUrl && (
                                  <a
                                    href={v.fonteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] dark:text-sky-400 hover:underline whitespace-nowrap"
                                  >
                                    Abrir página SERMIG <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>

                              {reqs.length === 0 ? (
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Nenhum requisito específico cadastrado para esta subcategoria.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {reqs.map((r) => (
                                    <div
                                      key={r.id}
                                      className="rounded-lg border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#0F1629] p-3 space-y-1"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="font-semibold text-slate-900 dark:text-slate-100">{r.nomeDocumento}</p>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <span className="text-[11px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                                            {r.obrigatorio ? 'Obrigatório' : 'Opcional'} · Peso {r.peso}
                                          </span>
                                          {(role === 'admin' || role === 'consultor') && (
                                            <button
                                              type="button"
                                              title="Excluir requisito"
                                              aria-label={`Excluir requisito ${r.nomeDocumento}`}
                                              onClick={() =>
                                                setConfirmModal({
                                                  title: 'Excluir requisito documental',
                                                  description: `Tem certeza que deseja excluir o requisito "${r.nomeDocumento}" da subcategoria Cód. ${v.codigo}?`,
                                                  details: ['A exclusão será registrada na subcoleção de auditoria.'],
                                                  confirmLabel: 'Excluir requisito',
                                                  tone: 'danger',
                                                  onConfirm: async () => {
                                                    await deleteDocumentAudited('visaRequirements', r.id, role, r);
                                                    setConfirmModal(null);
                                                    setFeedback(`Requisito "${r.nomeDocumento}" excluído com auditoria.`);
                                                    await onRefreshPublic();
                                                  },
                                                })
                                              }
                                              className="p-1 rounded border border-red-200 dark:border-red-900/60 text-[#C82333] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                        {r.categoriaDoc}
                                        {r.exigeApostila ? ' · Exige Apostila CNJ' : ''}
                                        {r.exigeTraducao ? ' · Exige Tradução' : ''}
                                        {r.validadeDias ? ` · Validade ${r.validadeDias}d` : ''}
                                      </p>
                                      {r.descricao && (
                                        <p className="text-[11px] text-slate-600 dark:text-slate-400">{r.descricao}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Parceiro Completo */}
      {partnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSavePartner} className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="text-lg font-bold text-slate-900">
                {partners.some((p) => p.id === partnerModal.id) ? `Editar Parceiro: ${partnerModal.nome}` : 'Cadastro de Parceiro'}
              </h2>
              <button type="button" onClick={() => setPartnerModal(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Nome / Razão Social *</label>
                <input
                  required
                  value={partnerModal.nome || ''}
                  onChange={(e) => setPartnerModal({ ...partnerModal, nome: e.target.value })}
                  placeholder="Nome / Empresa"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="sm:col-span-2">
                <MediaAssetPicker
                  label="Logo ou imagem representativa do parceiro"
                  value={partnerModal.logoUrl || ''}
                  onChange={(nextUrl) => setPartnerModal({ ...partnerModal, logoUrl: nextUrl })}
                  preset="logo"
                  role={role}
                  actorEmail={userProfile.email}
                  compact
                  hint="Envie logo, selo ou foto representativa (PNG, JPG, WebP ou SVG — convertida automaticamente para WebP) ou cole uma URL pública."
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
                <select
                  value={partnerModal.categoria || 'Outro'}
                  onChange={(e) => setPartnerModal({ ...partnerModal, categoria: e.target.value as PartnerCategory })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  {PARTNER_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo de Pessoa</label>
                <select
                  value={partnerModal.tipoPessoa || 'Pessoa Jurídica'}
                  onChange={(e) => setPartnerModal({ ...partnerModal, tipoPessoa: e.target.value as Partner['tipoPessoa'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Pessoa Jurídica">Pessoa Jurídica</option>
                  <option value="Pessoa Física">Pessoa Física</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">País</label>
                <select
                  value={partnerModal.pais || 'Chile'}
                  onChange={(e) => setPartnerModal({ ...partnerModal, pais: e.target.value as Partner['pais'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Brasil">Brasil</option>
                  <option value="Chile">Chile</option>
                  <option value="Ambos">Ambos</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cidade / Região</label>
                <input
                  value={partnerModal.cidadeRegiao || ''}
                  onChange={(e) => setPartnerModal({ ...partnerModal, cidadeRegiao: e.target.value })}
                  placeholder="Ex.: Santiago, São Paulo..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pessoa de Contato</label>
                <input
                  value={partnerModal.contato || ''}
                  onChange={(e) => setPartnerModal({ ...partnerModal, contato: e.target.value })}
                  placeholder="Nome do responsável"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">WhatsApp</label>
                <input
                  value={partnerModal.whatsapp || ''}
                  onChange={(e) => setPartnerModal({ ...partnerModal, whatsapp: e.target.value })}
                  placeholder="+55 / +56 ..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={partnerModal.email || ''}
                  onChange={(e) => setPartnerModal({ ...partnerModal, email: e.target.value })}
                  placeholder="contato@parceiro.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Site ou Instagram</label>
                <input
                  value={partnerModal.siteInstagram || ''}
                  onChange={(e) => setPartnerModal({ ...partnerModal, siteInstagram: e.target.value })}
                  placeholder="https://... ou @perfil"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status de Homologação</label>
                <select
                  value={partnerModal.statusHomologacao || 'Ativo/Indicado'}
                  onChange={(e) => setPartnerModal({ ...partnerModal, statusHomologacao: e.target.value as Partner['statusHomologacao'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Ativo/Indicado">Ativo/Indicado</option>
                  <option value="Em Análise">Em Análise</option>
                  <option value="Não Indicado/Suspenso">Não Indicado/Suspenso</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Moeda / Avaliação Interna</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={partnerModal.moedaNegociacao || 'BRL'}
                    onChange={(e) => setPartnerModal({ ...partnerModal, moedaNegociacao: e.target.value as Partner['moedaNegociacao'] })}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="BRL">BRL</option>
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                  </select>
                  <select
                    value={Number(partnerModal.avaliacao || 5)}
                    onChange={(e) => setPartnerModal({ ...partnerModal, avaliacao: Number(e.target.value) })}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value={5}>5 estrelas</option>
                    <option value={4}>4 estrelas</option>
                    <option value={3}>3 estrelas</option>
                    <option value={2}>2 estrelas</option>
                    <option value={1}>1 estrela</option>
                  </select>
                </div>
              </div>
            </div>

            <textarea
              rows={2}
              value={partnerModal.tabelaValoresComissao || ''}
              onChange={(e) => setPartnerModal({ ...partnerModal, tabelaValoresComissao: e.target.value })}
              placeholder="Tabela de valores e comissão (confidencial interno — nunca visível em /parceiros)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <textarea
              rows={2}
              value={partnerModal.condicoesParceria || ''}
              onChange={(e) => setPartnerModal({ ...partnerModal, condicoesParceria: e.target.value })}
              placeholder="Condições comerciais e prazos de atendimento"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <textarea
              rows={2}
              value={partnerModal.descricaoPublica || ''}
              onChange={(e) => setPartnerModal({ ...partnerModal, descricaoPublica: e.target.value })}
              placeholder="Descrição pública exibida em /parceiros"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <textarea
              rows={2}
              value={partnerModal.observacoes || ''}
              onChange={(e) => setPartnerModal({ ...partnerModal, observacoes: e.target.value })}
              placeholder="Observações internas / compliance"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={Boolean(partnerModal.recomendadoAosClientes)}
                onChange={(e) => setPartnerModal({ ...partnerModal, recomendadoAosClientes: e.target.checked })}
              />
              Recomendado aos clientes (publicar em /parceiros se Status for Ativo/Indicado)
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div>
                {role === 'admin' && partners.some((p) => p.id === partnerModal.id) && (
                  <button
                    type="button"
                    onClick={() => requestDeletePartner(partnerModal as Partner)}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Parceiro
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPartnerModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPartner}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {savingPartner ? 'Salvando...' : 'Salvar Parceiro'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Modal Criar / Atualizar Norma Completa */}
      {editingSource && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handlePublishNormaUpdate} className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {isNewSource ? 'Cadastrar Nova Norma / Portal Oficial' : `Atualizar Norma: ${editingSource.titulo}`}
              </h2>
              <button type="button" onClick={() => setEditingSource(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Título *</label>
                <input
                  required
                  value={editingSource.titulo}
                  onChange={(e) => setEditingSource({ ...editingSource, titulo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Número / Ano</label>
                <input
                  value={editingSource.numeroAno}
                  onChange={(e) => setEditingSource({ ...editingSource, numeroAno: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tipo</label>
                <select
                  value={editingSource.tipo}
                  onChange={(e) => setEditingSource({ ...editingSource, tipo: e.target.value as LegalSourceType })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Lei">Lei</option>
                  <option value="Decreto">Decreto</option>
                  <option value="Resolução">Resolução</option>
                  <option value="Circular">Circular</option>
                  <option value="Acordo Internacional">Acordo Internacional</option>
                  <option value="Portal Oficial">Portal Oficial</option>
                  <option value="Jurisprudência">Jurisprudência</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">País</label>
                <select
                  value={editingSource.pais}
                  onChange={(e) => setEditingSource({ ...editingSource, pais: e.target.value as LegalSource['pais'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Chile">Chile</option>
                  <option value="Brasil">Brasil</option>
                  <option value="Mercosul">Mercosul</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status de Vigência</label>
                <select
                  value={editingSource.statusVigencia}
                  onChange={(e) => setEditingSource({ ...editingSource, statusVigencia: e.target.value as LegalSource['statusVigencia'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="Vigente">Vigente</option>
                  <option value="A verificar">A verificar</option>
                  <option value="Alterada">Alterada</option>
                  <option value="Revogada">Revogada (nunca apagar)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Link Oficial (BCN / SERMIG / Planalto / CNJ)</label>
                <input
                  value={editingSource.linkOficial}
                  onChange={(e) => setEditingSource({ ...editingSource, linkOficial: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Órgão Emissor</label>
                <input
                  value={editingSource.orgaoEmissor}
                  onChange={(e) => setEditingSource({ ...editingSource, orgaoEmissor: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">Resumo Técnico em Português</label>
                <textarea
                  rows={2}
                  value={editingSource.resumoPortugues}
                  onChange={(e) => setEditingSource({ ...editingSource, resumoPortugues: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">Explicação Simples para o Cliente (&ldquo;Entenda a Lei&rdquo;)</label>
                <textarea
                  rows={2}
                  value={editingSource.explicacaoCliente}
                  onChange={(e) => setEditingSource({ ...editingSource, explicacaoCliente: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 mb-1">Notas Internas do Consultor (nunca visíveis ao cliente)</label>
                <input
                  value={editingSource.notasInternasConsultor || ''}
                  onChange={(e) => setEditingSource({ ...editingSource, notasInternasConsultor: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-900">Consulta Online SERMIG/BCN &amp; Comparação Assistida por IA</p>
                {!isNewSource && (
                  <button
                    type="button"
                    disabled={normaAiLoading}
                    onClick={() => void handleVerifyNormaOnlineIa()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    {normaAiLoading ? normaAiProgress || 'Consultando...' : 'Consultar SERMIG / BCN Online (IA)'}
                  </button>
                )}
              </div>
              <textarea
                rows={3}
                value={normaNewText}
                onChange={(e) => setNormaNewText(e.target.value)}
                placeholder="Opcional: cole aqui o novo texto normativo ou resolução oficial para comparar com a versão atual..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
              />
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  {normaAttachment ? `IA Anexo: ${normaAttachment.name}` : 'Anexar PDF/Img p/ IA'}
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSelectNormaFile(f);
                    }}
                  />
                </label>
                <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <FileText className="w-3.5 h-3.5" />
                  {editingSource.arquivoPdfUrl ? 'Substituir PDF salvo' : 'Salvar PDF no repositório'}
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setErrorMsg(null);
                      try {
                        const up = await uploadFileToServer(f);
                        setEditingSource({ ...editingSource, arquivoPdfUrl: up.url });
                        setFeedback(`PDF "${f.name}" anexado à norma com sucesso.`);
                      } catch (err) {
                        setErrorMsg(err instanceof Error ? err.message : 'Não foi possível enviar o PDF da norma.');
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={normaAiLoading || (!normaNewText.trim() && !normaAttachment)}
                  onClick={handleAnalyzeNormaIa}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                  {normaAiLoading ? normaAiProgress || 'Comparando...' : 'Analisar Texto/Anexo com IA'}
                </button>
              </div>
              {normaAiDraft && (
                <div className="p-3 rounded-lg bg-white border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-amber-900">
                        {normaAiDraft.origemLabel || 'Rascunho gerado pela IA'}
                      </span>
                      {normaAiDraft.situacaoAtual && (
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            normaAiDraft.possuiAtualizacao
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {normaAiDraft.situacaoAtual}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSource((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  artigos: normaAiDraft.artigosExtraidos || prev.artigos,
                                  resumoPortugues: normaAiDraft.resumoExecutivo || prev.resumoPortugues,
                                  explicacaoCliente: normaAiDraft.explicacaoCliente || prev.explicacaoCliente,
                                  statusVigencia: normaAiDraft.possuiAtualizacao ? 'Alterada' : 'Vigente',
                                }
                              : prev,
                          );
                        }}
                        className="px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold"
                      >
                        Aplicar nos campos
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          normaNewText.trim() || normaAttachment
                            ? void handleAnalyzeNormaIa()
                            : void handleVerifyNormaOnlineIa()
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 font-semibold"
                      >
                        <RotateCcw className="w-3 h-3" /> Reconsultar
                      </button>
                    </div>
                  </div>
                  <p><strong>Artigos / Dispositivos:</strong> {normaAiDraft.artigosExtraidos}</p>
                  <p><strong>Resumo sugerido:</strong> {normaAiDraft.resumoExecutivo}</p>
                  <p><strong>Entenda a Lei:</strong> {normaAiDraft.explicacaoCliente}</p>
                  {(normaAiDraft.impactosVistos || []).length > 0 && (
                    <p><strong>Impacto em vistos:</strong> {normaAiDraft.impactosVistos.join('; ')}</p>
                  )}
                  <p><strong>Divergências:</strong> {(normaAiDraft.divergencias || []).join('; ') || 'Nenhuma'}</p>
                  {(normaAiDraft.fontesOnline || []).length > 0 && (
                    <div className="pt-1 border-t border-slate-100 space-y-1">
                      <p className="font-semibold text-slate-700">Fontes oficiais encontradas na busca:</p>
                      <div className="flex flex-wrap gap-2">
                        {normaAiDraft.fontesOnline!.map((f, idx) => (
                          <a
                            key={`${f.url}_${idx}`}
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[11px] text-[var(--color-primary)] hover:underline"
                          >
                            {f.titulo} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingSource(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]">
                {isNewSource ? 'Cadastrar Norma' : 'Aprovar e Publicar Atualização'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal "Onde esta norma é usada" */}
      {usageSource && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Onde esta norma é usada</h2>
                <p className="text-xs text-slate-500">{usageSource.titulo}</p>
              </div>
              <button type="button" onClick={() => setUsageSource(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            {(() => {
              const u = computeUsagesForSource(usageSource);
              return (
                <div className="space-y-4 text-xs">
                  <div>
                    <p className="font-bold text-slate-800 mb-1">Subcategorias SERMIG ({u.linkedVisas.length})</p>
                    {u.linkedVisas.length === 0 ? (
                      <p className="text-slate-500">Nenhuma subcategoria vinculada diretamente.</p>
                    ) : (
                      <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                        {u.linkedVisas.map((v) => (
                          <li key={v.id}>Cód. {v.codigo} — {v.nomePortugues}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 mb-1">Regras do Diagnóstico ({u.linkedRules.length})</p>
                    {u.linkedRules.length === 0 ? (
                      <p className="text-slate-500">Nenhuma regra vinculada.</p>
                    ) : (
                      <ul className="list-disc list-inside text-slate-700 space-y-0.5">
                        {u.linkedRules.map((r) => (
                          <li key={r.id}>{r.codigo} — {r.nome}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 mb-1">Casos Ativos Afetados ({u.activeCasesAffected.length})</p>
                    {u.activeCasesAffected.length === 0 ? (
                      <p className="text-slate-500">Nenhum caso ativo impactado.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {u.activeCasesAffected.map((cs) => (
                          <div key={cs.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-semibold text-slate-800">{cs.titulo} (Etapa {cs.etapaPipeline})</span>
                            {onOpenCase && (
                              <button
                                type="button"
                                onClick={() => {
                                  setUsageSource(null);
                                  onOpenCase(cs.id);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold"
                              >
                                <Eye className="w-3 h-3" /> Abrir Caso
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Modal Histórico + Comparação Lado a Lado + Restauração */}
      {historySource && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Histórico e Comparação de Versões — {historySource.titulo}</h2>
                <p className="text-xs text-slate-500">Versão atual: {historySource.versao}</p>
              </div>
              <button type="button" onClick={() => setHistorySource(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            {(historySource.historicoVersoes || []).length > 0 && (
              <div className="space-y-4 text-xs">
                <div className="flex flex-wrap gap-2">
                  {historySource.historicoVersoes!.map((h, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCompareHistIdx(idx)}
                      className={`px-3 py-1.5 rounded-lg border font-semibold ${
                        compareHistIdx === idx ? 'border-[var(--color-primary)] bg-slate-900 text-white' : 'border-slate-300 text-slate-700'
                      }`}
                    >
                      v{h.versao} ({formatDateBR(h.data)})
                    </button>
                  ))}
                </div>
                {(() => {
                  const sel = historySource.historicoVersoes![compareHistIdx];
                  if (!sel) return null;
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                          <p className="font-bold text-slate-700">Versão Anterior (v{sel.versao} · {formatDateBR(sel.data)})</p>
                          <p className="text-slate-600 whitespace-pre-wrap">{sel.resumo}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-50/40 border border-emerald-200 space-y-2">
                          <p className="font-bold text-emerald-900">Versão Atual Publicada (v{historySource.versao})</p>
                          <p className="text-slate-800 whitespace-pre-wrap">{historySource.resumoPortugues}</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleRestoreNormaVersion(historySource, sel)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Restaurar v{sel.versao}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      <LegalBaseModal
        open={Boolean(legalDrawerData)}
        onClose={() => setLegalDrawerData(null)}
        title={legalDrawerData?.title}
        sources={legalDrawerData?.sources || []}
      />

      <ConfirmActionModal
        open={Boolean(confirmModal)}
        title={confirmModal?.title || 'Confirmar'}
        description={confirmModal?.description || ''}
        details={confirmModal?.details}
        confirmLabel={confirmModal?.confirmLabel}
        tone={confirmModal?.tone || 'danger'}
        onConfirm={async () => {
          if (confirmModal) await confirmModal.onConfirm();
        }}
        onClose={() => setConfirmModal(null)}
      />
    </div>
  );
};
