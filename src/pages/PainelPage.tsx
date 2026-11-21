import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock,
  Columns3,
  DollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import { BrandLogo, BrandRibbon, BrandWordmark } from '../components/BrandLogo';
import { PainelAdminConfig } from '../components/painel/PainelAdminConfig';
import { PainelAgendaTarefas } from '../components/painel/PainelAgendaTarefas';
import { PainelChecklistVisto } from '../components/painel/PainelChecklistVisto';
import { PainelClientesCasos } from '../components/painel/PainelClientesCasos';
import { PainelDashboard } from '../components/painel/PainelDashboard';
import { PainelDocumentosExport } from '../components/painel/PainelDocumentosExport';
import { PainelFerramentas } from '../components/painel/PainelFerramentas';
import { PainelFinanceiro } from '../components/painel/PainelFinanceiro';
import { PainelFunnelKanbanDashboard } from '../components/painel/PainelFunnelKanbanDashboard';
import { PainelLeads } from '../components/painel/PainelLeads';
import { PainelParceirosLegal } from '../components/painel/PainelParceirosLegal';
import { SkeletonBlock } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';
import { useFirestore } from '../hooks/useFirestore';
import { subscribeStaffDocumentChat } from '../services/chatService';
import { reportAppError } from '../services/errorService';
import {
  convertLeadToClientAndCaseEnhanced,
  fetchAllSiteContentStaff,
  fetchStaffWorkspaceData,
  makeId,
  saveDocumentAudited,
} from '../services/firestoreService';
import type { CommunicationLog, Lead, SiteContent, Task, UserRole } from '../types/domain';
import { countUnreadChatForStaff, getPendingClientChatThreads } from '../utils/documentChat';
import { daysUntilDate, formatDateBR } from '../utils/formatters';
import type { MacroFunnelStageId } from '../utils/funnelModel';
import { countLegalReviewPending } from '../utils/legalSync';
import {
  getVisibleConfigSubTabs,
  getVisibleFinanceiroSubTabs,
  getVisiblePanelHubs,
  getVisibleProcessosSubTabs,
  resolveLegacyPanelRoute,
  type ConfigSubTab,
  type FinanceiroSubTab,
  type LegacyPanelSection,
  type PanelHubId,
  type ProcessosSubTab,
} from '../utils/panelNavigation';

type PanelTheme = 'light' | 'dark';
const PANEL_THEME_STORAGE_KEY = 'dm_painel_theme';

function loadPanelTheme(): PanelTheme {
  try {
    return window.localStorage.getItem(PANEL_THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function savePanelTheme(theme: PanelTheme): void {
  try {
    window.localStorage.setItem(PANEL_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

interface PainelPageProps {
  onNavigate: (path: string) => void;
}

interface RecentCaseItem {
  id: string;
  label: string;
  caseId: string;
}

const ROLE_DISPLAY: Record<UserRole, string> = {
  admin: 'Administrador',
  consultor: 'Consultor',
  assistente: 'Assistente',
  cliente: 'Cliente',
};

const HUB_ICONS: Record<PanelHubId, React.ReactNode> = {
  hoje: <LayoutDashboard className="w-4 h-4 shrink-0" />,
  funil: <Columns3 className="w-4 h-4 shrink-0" />,
  leads: <UserCheck className="w-4 h-4 shrink-0" />,
  processos: <Briefcase className="w-4 h-4 shrink-0" />,
  agenda: <CalendarClock className="w-4 h-4 shrink-0" />,
  financeiro: <DollarSign className="w-4 h-4 shrink-0" />,
  config: <Settings className="w-4 h-4 shrink-0" />,
};

const SIDEBAR_GROUPS: { id: string; label: string; hubIds: PanelHubId[] }[] = [
  { id: 'rotina', label: 'Dia a Dia', hubIds: ['hoje', 'funil', 'agenda'] },
  { id: 'operacao', label: 'Leads & Processos', hubIds: ['leads', 'processos'] },
  { id: 'gestao', label: 'Gestão', hubIds: ['financeiro', 'config'] },
];

export const PainelPage: React.FC<PainelPageProps> = ({ onNavigate }) => {
  const {
    userProfile,
    authLoading,
    empresa,
    siteContent,
    partnersPublic,
    visaCategories,
    visaRequirements,
    legalSources,
    activeDiagnosticRules,
    logout,
    refreshPublicData,
  } = useApp();

  // Arquitetura simplificada de 6 hubs + sub-abas contextuais
  const [activeHub, setActiveHub] = useState<PanelHubId>('hoje');
  const [processosTab, setProcessosTab] = useState<ProcessosSubTab>('casos');
  const [financeiroTab, setFinanceiroTab] = useState<FinanceiroSubTab>('financeiro');
  const [configTab, setConfigTab] = useState<ConfigSubTab>('ferramentas');

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [requestedCaseTab, setRequestedCaseTab] = useState<{
    caseId: string;
    tab: 'resumo' | 'comunicacao';
    seq: number;
  } | null>(null);
  const [requestedStageFilter, setRequestedStageFilter] = useState<{
    stageId: MacroFunnelStageId | 'all';
    seq: number;
  } | null>(null);
  const [requestedQuickAction, setRequestedQuickAction] = useState<{
    action: 'new_case' | 'new_client';
    seq: number;
  } | null>(null);
  const [requestedOpenLead, setRequestedOpenLead] = useState<{
    leadId: string;
    seq: number;
  } | null>(null);
  const [requestedQuickLeadSeq, setRequestedQuickLeadSeq] = useState(0);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffSiteContent, setStaffSiteContent] = useState<SiteContent[]>(siteContent);

  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [recents, setRecents] = useState<RecentCaseItem[]>([]);
  const [panelTheme, setPanelTheme] = useState<PanelTheme>(() => loadPanelTheme());

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickCreateRef = useRef<HTMLDivElement | null>(null);

  const isDark = panelTheme === 'dark';
  const panelThemeClass = isDark ? 'dark panel-dark' : '';

  const handleTogglePanelTheme = useCallback(() => {
    setPanelTheme((prev) => {
      const next: PanelTheme = prev === 'dark' ? 'light' : 'dark';
      savePanelTheme(next);
      return next;
    });
  }, []);

  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof fetchStaffWorkspaceData>> | null>(null);
  const [liveChatLogs, setLiveChatLogs] = useState<CommunicationLog[]>([]);
  const firestore = useFirestore();

  const role = userProfile?.role;
  const isStaff =
    Boolean(userProfile) &&
    userProfile?.status === 'ativo' &&
    (role === 'admin' || role === 'consultor' || role === 'assistente');

  const loadWorkspace = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!userProfile || !isStaff) {
        setLoading(false);
        return;
      }
      if (!options?.silent) {
        setLoading(true);
      }
      try {
        const [ws, cms] = await Promise.all([
          fetchStaffWorkspaceData(userProfile.role),
          fetchAllSiteContentStaff().catch(() => siteContent),
        ]);
        setWorkspace(ws);
        setStaffSiteContent(cms);
      } catch (err) {
        reportAppError(err, { source: 'painel-workspace-load' });
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [userProfile, isStaff, siteContent],
  );

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!isStaff) {
      setLiveChatLogs([]);
      return;
    }
    const unsub = subscribeStaffDocumentChat(
      (logs) => setLiveChatLogs(logs),
      () => undefined,
    );
    return () => unsub();
  }, [isStaff]);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadWorkspace({ silent: Boolean(workspace) }), firestore.refresh()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadWorkspace, firestore, workspace]);

  const effectiveWorkspace = useMemo(() => {
    if (!workspace) return null;
    const mergedCommMap = new Map<string, CommunicationLog>();
    for (const log of workspace.communicationLogs) {
      mergedCommMap.set(log.id, log);
    }
    for (const chatLog of liveChatLogs) {
      mergedCommMap.set(chatLog.id, chatLog);
    }
    const mergedCommunicationLogs = Array.from(mergedCommMap.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || ''),
    );
    return {
      ...workspace,
      clients: !firestore.loadingClients ? firestore.clients : workspace.clients,
      leads: !firestore.loadingDiagnostics ? firestore.diagnostics : workspace.leads,
      communicationLogs: mergedCommunicationLogs,
    };
  }, [
    workspace,
    liveChatLogs,
    firestore.clients,
    firestore.diagnostics,
    firestore.loadingClients,
    firestore.loadingDiagnostics,
  ]);

  // Atalhos de teclado: "/" ou Ctrl+K abre busca global; Esc fecha popovers
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen(true);
      } else if (
        e.key === '/' &&
        document.activeElement &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)
      ) {
        e.preventDefault();
        setGlobalSearchOpen(true);
      } else if (e.key === 'Escape') {
        setGlobalSearchOpen(false);
        setQuickCreateOpen(false);
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
        setQuickCreateOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  useEffect(() => {
    if (globalSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 40);
    } else {
      setGlobalQuery('');
    }
  }, [globalSearchOpen]);

  const handleLogWhatsApp = async (
    clientId: string | undefined,
    caseId: string | undefined,
    assunto: string,
    mensagem: string,
  ) => {
    if (!userProfile) return;
    const id = makeId('comm');
    await saveDocumentAudited(
      'communicationLogs',
      id,
      {
        id,
        canal: 'WhatsApp',
        assunto,
        mensagem,
        clientId: clientId || '',
        caseId: caseId || '',
        autorNome: userProfile.nome || userProfile.email,
        createdAt: new Date().toISOString(),
      },
      true,
      userProfile.role,
      'comunicacao_whatsapp',
    );
    await handleRefreshAll();
  };

  const handleEmailLogsCreated = useCallback((newLogs: CommunicationLog[]) => {
    if (!newLogs || newLogs.length === 0) return;
    setWorkspace((prev) => {
      if (!prev) return prev;
      const existingIds = new Set(prev.communicationLogs.map((l) => l.id));
      const fresh = newLogs.filter((l) => !existingIds.has(l.id));
      if (fresh.length === 0) return prev;
      return {
        ...prev,
        communicationLogs: [...fresh, ...prev.communicationLogs],
      };
    });
  }, []);

  const handleQuickToggleTask = async (task: Task) => {
    if (!userProfile) return;
    const nextStatus = task.status === 'Concluída' ? 'Pendente' : 'Concluída';
    await saveDocumentAudited(
      'tasks',
      task.id,
      { ...task, status: nextStatus },
      false,
      userProfile.role,
      'concluir_tarefa_painel',
      task,
    );
    await handleRefreshAll();
  };

  const pushRecentCase = useCallback((caseId: string, label: string) => {
    setRecents((prev) => [{ id: `case_${caseId}`, label, caseId }, ...prev.filter((r) => r.caseId !== caseId)].slice(0, 4));
  }, []);

  const handleSelectHub = useCallback((hub: PanelHubId) => {
    setActiveHub(hub);
    if (hub !== 'processos') setSelectedCaseId(null);
    setMobileMenuOpen(false);
  }, []);

  const handleNavigateLegacySection = useCallback(
    (legacySec: LegacyPanelSection) => {
      const resolved = resolveLegacyPanelRoute(legacySec, role);
      setActiveHub(resolved.hub);
      if (resolved.processosTab) setProcessosTab(resolved.processosTab);
      if (resolved.financeiroTab) setFinanceiroTab(resolved.financeiroTab);
      if (resolved.configTab) setConfigTab(resolved.configTab);
      if (resolved.hub !== 'processos' || resolved.processosTab !== 'casos') {
        setSelectedCaseId(null);
      }
      setMobileMenuOpen(false);
    },
    [role],
  );

  const handleOpenCase = useCallback(
    (caseId: string, targetTab?: 'resumo' | 'comunicacao') => {
      setSelectedCaseId(caseId);
      setActiveHub('processos');
      setProcessosTab('casos');
      if (targetTab) {
        setRequestedCaseTab({ caseId, tab: targetTab, seq: Date.now() });
      }
      const c = effectiveWorkspace?.cases.find((x) => x.id === caseId);
      if (c) pushRecentCase(caseId, c.titulo);
      setMobileMenuOpen(false);
    },
    [effectiveWorkspace, pushRecentCase],
  );

  const handleOpenChecklist = useCallback((caseId?: string) => {
    if (caseId) setSelectedCaseId(caseId);
    setActiveHub('processos');
    setProcessosTab('checklist');
    setMobileMenuOpen(false);
  }, []);

  const handleOpenFunnelStage = useCallback((stageId: MacroFunnelStageId) => {
    if (stageId === 'diagnostico' || stageId === 'proposta') {
      setActiveHub('leads');
      setSelectedCaseId(null);
    } else {
      setActiveHub('processos');
      setProcessosTab('casos');
      setSelectedCaseId(null);
      setRequestedStageFilter({ stageId, seq: Date.now() });
    }
    setMobileMenuOpen(false);
  }, []);

  const handleOpenLead = useCallback((leadId?: string) => {
    setActiveHub('leads');
    setSelectedCaseId(null);
    if (leadId) {
      setRequestedOpenLead({ leadId, seq: Date.now() });
    }
    setMobileMenuOpen(false);
  }, []);

  const handleQuickCreateLead = useCallback(() => {
    setQuickCreateOpen(false);
    setActiveHub('leads');
    setSelectedCaseId(null);
    setRequestedQuickLeadSeq(Date.now());
    setMobileMenuOpen(false);
  }, []);

  const handleConvertLeadFromKanban = useCallback(
    async (lead: Lead) => {
      if (!userProfile || !effectiveWorkspace) return null;
      if (userProfile.role !== 'admin' && userProfile.role !== 'consultor') return null;
      const res = await convertLeadToClientAndCaseEnhanced({
        lead,
        clients: effectiveWorkspace.clients,
        visaCategories,
        visaRequirements,
        legalSources,
        activeRules: activeDiagnosticRules,
        empresa,
        role: userProfile.role,
        autorNome: userProfile.nome || userProfile.email,
        initialPipelineStep: 3,
      });
      await handleRefreshAll();
      return { caseId: res.caseId, docsCount: res.docsCount, tasksCount: res.tasksCount };
    },
    [
      userProfile,
      effectiveWorkspace,
      visaCategories,
      visaRequirements,
      legalSources,
      activeDiagnosticRules,
      empresa,
      handleRefreshAll,
    ],
  );

  const triggerQuickCreate = useCallback(
    (action: 'new_lead' | 'new_case' | 'new_client' | 'agenda' | 'contratos' | 'financeiro') => {
      setQuickCreateOpen(false);
      if (action === 'new_lead') {
        handleQuickCreateLead();
      } else if (action === 'new_case') {
        setActiveHub('processos');
        setProcessosTab('casos');
        setSelectedCaseId(null);
        setRequestedQuickAction({ action: 'new_case', seq: Date.now() });
      } else if (action === 'new_client') {
        setActiveHub('processos');
        setProcessosTab('clientes');
        setSelectedCaseId(null);
        setRequestedQuickAction({ action: 'new_client', seq: Date.now() });
      } else {
        handleNavigateLegacySection(action);
      }
    },
    [handleNavigateLegacySection, handleQuickCreateLead],
  );

  const visibleHubs = useMemo(() => getVisiblePanelHubs(role), [role]);
  const visibleProcessosTabs = useMemo(() => getVisibleProcessosSubTabs(role), [role]);
  const visibleFinanceiroTabs = useMemo(() => getVisibleFinanceiroSubTabs(role), [role]);
  const visibleConfigTabs = useMemo(() => getVisibleConfigSubTabs(role), [role]);

  const unreadChatCount = useMemo(
    () => countUnreadChatForStaff(effectiveWorkspace?.communicationLogs || []),
    [effectiveWorkspace],
  );

  const firstPendingChatThread = useMemo(() => {
    if (!effectiveWorkspace) return null;
    const threads = getPendingClientChatThreads(
      effectiveWorkspace.communicationLogs,
      effectiveWorkspace.clients,
      effectiveWorkspace.cases,
    );
    return threads.find((t) => t.caseId) || null;
  }, [effectiveWorkspace]);

  const hubBadges = useMemo(() => {
    const legalAttention = countLegalReviewPending(legalSources, empresa.diasAlertaRevisaoLegal || 90).totalAttention;
    if (!effectiveWorkspace) {
      return {
        hoje: 0,
        funil: 0,
        leads: 0,
        processos: 0,
        agenda: 0,
        financeiro: 0,
        config: role === 'assistente' ? 0 : legalAttention,
        checklist: 0,
        docsToCheck: 0,
        legal: legalAttention,
        parceiros: 0,
      };
    }
    const openTasks = effectiveWorkspace.tasks.filter((t) => t.status !== 'Concluída').length;
    const urgentDeadlines = effectiveWorkspace.deadlines.filter((d) => {
      if (d.concluido) return false;
      const diff = daysUntilDate(d.dataLimite);
      return diff !== null && diff <= 15;
    }).length;
    const newLeads = effectiveWorkspace.leads.filter((l) => l.statusFunil === 'Novo').length;
    const activeLeadsCount = effectiveWorkspace.leads.filter(
      (l) => l.statusFunil !== 'Perdido' && l.statusFunil !== 'Fechado' && !l.convertedCaseId,
    ).length;
    const activeCasesList = effectiveWorkspace.cases.filter((c) => !c.arquivado);
    const activeCaseIds = new Set(activeCasesList.map((c) => c.id));
    const pendingChecklist = effectiveWorkspace.caseDocuments.filter(
      (d) => activeCaseIds.has(d.caseId) && d.status !== 'Aprovado',
    ).length;
    const docsToCheck = effectiveWorkspace.caseDocuments.filter(
      (d) => d.status === 'Enviado' || d.status === 'Em análise',
    ).length;
    const openProposals = effectiveWorkspace.partnerProposals.filter(
      (p) => p.status === 'Nova' || p.status === 'Em Análise',
    ).length;

    return {
      hoje: urgentDeadlines + unreadChatCount,
      funil: activeLeadsCount + activeCasesList.length,
      leads: newLeads,
      processos: activeCasesList.length,
      agenda: openTasks + urgentDeadlines,
      financeiro: effectiveWorkspace.generatedDocuments.length,
      config: role === 'assistente' ? 0 : legalAttention + openProposals,
      checklist: pendingChecklist,
      docsToCheck,
      legal: legalAttention,
      parceiros: openProposals,
    };
  }, [effectiveWorkspace, legalSources, empresa.diasAlertaRevisaoLegal, role, unreadChatCount]);

  const searchResults = useMemo(() => {
    if (!effectiveWorkspace || !globalQuery.trim()) return [];
    const q = globalQuery.toLowerCase();
    const out: { id: string; category: string; title: string; subtitle: string; onSelect: () => void }[] = [];

    if (q.includes('calc') || q.includes('cambi') || q.includes('câmb') || q.includes('simula')) {
      out.push({
        id: 'tool_ferramentas',
        category: 'Ferramenta',
        title: 'Calculadoras de Prazos, Câmbio BRL/CLP & Simulador',
        subtitle: 'Abrir em Recursos & Config.',
        onSelect: () => {
          handleNavigateLegacySection('ferramentas');
          setGlobalSearchOpen(false);
        },
      });
    }

    for (const c of effectiveWorkspace.cases) {
      if (c.titulo.toLowerCase().includes(q) || (c.numeroPedidoSermig || '').toLowerCase().includes(q)) {
        out.push({
          id: `case_${c.id}`,
          category: 'Processo',
          title: c.titulo,
          subtitle: `Etapa ${c.etapaPipeline} · SERMIG ${c.statusSermig}`,
          onSelect: () => {
            handleOpenCase(c.id);
            setGlobalSearchOpen(false);
          },
        });
      }
    }
    for (const cli of effectiveWorkspace.clients) {
      if (
        cli.nomeCompleto.toLowerCase().includes(q) ||
        (cli.cpf || '').toLowerCase().includes(q) ||
        cli.email.toLowerCase().includes(q)
      ) {
        const linkedCase = effectiveWorkspace.cases.find((c) => c.clientId === cli.id);
        out.push({
          id: `cli_${cli.id}`,
          category: 'Cliente',
          title: cli.nomeCompleto,
          subtitle: `${cli.email} · ${cli.whatsapp}`,
          onSelect: () => {
            if (linkedCase) handleOpenCase(linkedCase.id);
            else handleNavigateLegacySection('clientes');
            setGlobalSearchOpen(false);
          },
        });
      }
    }
    for (const l of effectiveWorkspace.leads) {
      if (
        l.nome.toLowerCase().includes(q) ||
        l.email.toLowerCase().includes(q) ||
        (l.subcategoriaSugerida || '').toLowerCase().includes(q)
      ) {
        out.push({
          id: `lead_${l.id}`,
          category: 'Lead',
          title: l.nome,
          subtitle: `${l.statusFunil} · ${l.subcategoriaSugerida || l.interesse}`,
          onSelect: () => {
            handleSelectHub('leads');
            setGlobalSearchOpen(false);
          },
        });
      }
    }
    for (const t of effectiveWorkspace.tasks) {
      if (t.titulo.toLowerCase().includes(q)) {
        out.push({
          id: `task_${t.id}`,
          category: 'Tarefa',
          title: t.titulo,
          subtitle: `${t.status} · ${t.prioridade}${t.prazo ? ` · Até ${formatDateBR(t.prazo)}` : ''}`,
          onSelect: () => {
            if (t.caseId) handleOpenCase(t.caseId);
            else handleSelectHub('agenda');
            setGlobalSearchOpen(false);
          },
        });
      }
    }
    for (const d of effectiveWorkspace.caseDocuments) {
      if (d.nomeDocumento.toLowerCase().includes(q) || d.pessoa.toLowerCase().includes(q)) {
        out.push({
          id: `doc_${d.id}`,
          category: 'Documento',
          title: d.nomeDocumento,
          subtitle: `${d.pessoa} · ${d.status}`,
          onSelect: () => {
            handleOpenCase(d.caseId);
            setGlobalSearchOpen(false);
          },
        });
      }
    }
    if (role === 'admin' || role === 'consultor') {
      for (const s of legalSources) {
        if (s.titulo.toLowerCase().includes(q) || s.numeroAno.toLowerCase().includes(q)) {
          out.push({
            id: `leg_${s.id}`,
            category: 'Base Legal',
            title: s.titulo,
            subtitle: `${s.pais} · ${s.tipo} · ${s.statusVigencia}`,
            onSelect: () => {
              handleNavigateLegacySection('legal');
              setGlobalSearchOpen(false);
            },
          });
        }
      }
    }
    return out.slice(0, 12);
  }, [effectiveWorkspace, globalQuery, legalSources, role, handleNavigateLegacySection, handleOpenCase, handleSelectHub]);

  if (authLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center bg-[var(--color-bg)] text-sm text-slate-600 dark:text-slate-300 ${panelThemeClass}`}>
        Verificando credenciais da equipe...
      </div>
    );
  }

  if (!userProfile || !isStaff) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)] ${panelThemeClass}`}>
        <div
          className="border border-[#E5DFD2] dark:border-[#1C324B] max-w-md w-full overflow-hidden shadow-[0_12px_36px_rgba(11,31,51,0.08)]"
          style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card, 16px)' }}
        >
          <BrandRibbon className="h-[3px] w-full" />
          <div className="p-8 sm:p-10 text-center space-y-5">
            <div className="flex justify-center">
              <BrandLogo
                src={empresa.logoUrl}
                alt={empresa.nome_empresa}
                variant={isDark ? 'emblem-dark' : 'emblem'}
                className="h-14 w-14 object-contain"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#9A7B1C] dark:text-amber-400">
                Consultoria Migratória · Área da Equipe
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Painel Interno da Equipe
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Acesso exclusivo para consultores e administradores ativos da {empresa.nome_empresa}.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('/entrar-equipe')}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white transition-all duration-150 hover:opacity-95 shadow-[0_2px_6px_rgba(11,31,51,0.18)]"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Entrar como Equipe
              </button>
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="px-5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Voltar ao Site
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeHubMeta = visibleHubs.find((h) => h.id === activeHub);
  const activeCaseTitle = selectedCaseId
    ? effectiveWorkspace?.cases.find((c) => c.id === selectedCaseId)?.titulo
    : null;
  const activeLogoUrl = isDark && empresa.logoDarkUrl ? empresa.logoDarkUrl : empresa.logoUrl;

  const activeSubTabLabel =
    activeHub === 'processos'
      ? visibleProcessosTabs.find((t) => t.id === processosTab)?.label
      : activeHub === 'financeiro'
        ? visibleFinanceiroTabs.find((t) => t.id === financeiroTab)?.label
        : activeHub === 'config'
          ? visibleConfigTabs.find((t) => t.id === configTab)?.label
          : null;

  return (
    <div className={`min-h-screen flex bg-[var(--color-bg)] text-[#0B1523] dark:text-slate-100 transition-colors panel-workspace ${panelThemeClass}`}>
      {/* Sidebar Desktop Enxuta padronizada pela identidade D&M */}
      <aside
        className={`hidden lg:flex lg:flex-col bg-white dark:bg-[#0D1E31] border-r border-[#E5DFD2] dark:border-[#1C324B] shrink-0 no-print transition-all ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-[272px]'
        }`}
      >
        <BrandRibbon className="h-[3px] w-full" />
        <div className="h-14 px-3 border-b border-[#E5DFD2] dark:border-[#1C324B] flex items-center justify-between gap-1.5">
          <button type="button" onClick={() => onNavigate('/')} className="flex items-center gap-2 text-left min-w-0">
            <BrandLogo
              src={activeLogoUrl}
              alt={empresa.nome_empresa}
              variant={isDark ? 'emblem-dark' : 'emblem'}
              className="h-8 w-8 object-contain shrink-0"
            />
            {!sidebarCollapsed && (
              <BrandWordmark tone={isDark ? 'dark' : 'light'} size="sm" className="whitespace-nowrap" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className="p-1.5 rounded-lg border border-[#E5DFD2] dark:border-[#1C324B] text-slate-600 dark:text-slate-300 hover:bg-[#F7F5F0] dark:hover:bg-[#152B44] shrink-0"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto" aria-label="Navegação principal do painel">
          {SIDEBAR_GROUPS.map((group) => {
            const groupHubs = group.hubIds
              .map((id) => visibleHubs.find((h) => h.id === id))
              .filter((h): h is NonNullable<typeof h> => Boolean(h));
            if (groupHubs.length === 0) return null;
            return (
              <div key={group.id} className="space-y-1">
                {!sidebarCollapsed && (
                  <p className="px-3 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                    {group.label}
                  </p>
                )}
                {groupHubs.map((hub) => {
                  const isActive = activeHub === hub.id;
                  const badge = hubBadges[hub.id];
                  return (
                    <button
                      key={hub.id}
                      type="button"
                      title={hub.description}
                      onClick={() => handleSelectHub(hub.id)}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? 'justify-center px-2' : 'justify-between gap-2 px-3'
                      } py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-white font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                      }`}
                      style={isActive ? { backgroundColor: 'var(--color-primary)' } : undefined}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {HUB_ICONS[hub.id]}
                        {!sidebarCollapsed && <span className="truncate whitespace-nowrap">{hub.label}</span>}
                      </span>
                      {!sidebarCollapsed && badge > 0 && (
                        <span
                          className={`text-xs font-semibold tabular-nums shrink-0 ${
                            isActive ? 'text-white/90' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {!sidebarCollapsed && recents.length > 0 && (
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Processos recentes
              </p>
              {recents.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleOpenCase(r.caseId)}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 truncate"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          {!sidebarCollapsed && (
            <div className="px-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{userProfile.nome}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {ROLE_DISPLAY[userProfile.role]}
              </p>
            </div>
          )}

          <div className={`flex items-center gap-1.5 ${sidebarCollapsed ? 'flex-col' : ''}`}>
            <button
              type="button"
              onClick={handleTogglePanelTheme}
              title={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              aria-label={isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => void handleRefreshAll()}
              disabled={refreshing}
              title="Sincronizar dados agora"
              aria-label="Sincronizar dados agora"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              title="Sair do painel"
              aria-label="Sair do painel"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!sidebarCollapsed && <span>Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <BrandRibbon className="h-[3px] w-full no-print" />
        {/* Topbar Limpa: Breadcrumb à esquerda · Busca + Ação Primária à direita */}
        <header className="bg-white/92 dark:bg-[#0D1E31]/92 backdrop-blur-md border-b border-[#E5DFD2] dark:border-[#1C324B] px-4 sm:px-6 h-14 flex items-center justify-between gap-4 no-print sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir menu do painel"
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
            <nav className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 truncate" aria-label="Localização atual">
              <button
                type="button"
                onClick={() => handleSelectHub('hoje')}
                className="hover:text-slate-900 dark:hover:text-slate-100 font-medium whitespace-nowrap"
              >
                Painel
              </button>
              <span aria-hidden="true">/</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedCaseId(null);
                  handleSelectHub(activeHub);
                }}
                className={`truncate whitespace-nowrap ${
                  !activeSubTabLabel && !activeCaseTitle
                    ? 'font-semibold text-slate-900 dark:text-slate-100'
                    : 'hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {activeHubMeta?.label || 'Hoje'}
              </button>
              {activeSubTabLabel && !activeCaseTitle && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate whitespace-nowrap">
                    {activeSubTabLabel}
                  </span>
                </>
              )}
              {activeCaseTitle && (
                <>
                  <span aria-hidden="true">/</span>
                  <span className="font-semibold text-[var(--color-primary)] dark:text-sky-400 truncate max-w-[240px]">
                    {activeCaseTitle}
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {unreadChatCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (firstPendingChatThread?.caseId) {
                    handleOpenCase(firstPendingChatThread.caseId, 'comunicacao');
                  } else {
                    handleSelectHub('hoje');
                  }
                }}
                title="Responder dúvida enviada no Portal do Cliente"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700/70 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-100 whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Portal</span>
                <span className="tabular-nums">{unreadChatCount}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 whitespace-nowrap"
              aria-label="Busca rápida (pressione barra ou Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Buscar...</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
                /
              </kbd>
            </button>

            <div className="relative" ref={quickCreateRef}>
              <button
                type="button"
                onClick={() => setQuickCreateOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo</span>
              </button>
              {quickCreateOpen && (
                <div className="absolute right-0 mt-1.5 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5 z-40 text-xs">
                  <button
                    type="button"
                    onClick={() => triggerQuickCreate('new_lead')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-[var(--color-primary)] dark:text-sky-400"
                  >
                    Novo Lead (Chegada Rápida)
                  </button>
                  <button
                    type="button"
                    onClick={() => triggerQuickCreate('new_case')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
                  >
                    Novo Processo
                  </button>
                  {(role === 'admin' || role === 'consultor') && (
                    <button
                      type="button"
                      onClick={() => triggerQuickCreate('new_client')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
                    >
                      Novo Cliente
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => triggerQuickCreate('agenda')}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
                  >
                    Tarefa, Prazo ou Reunião
                  </button>
                  {(role === 'admin' || role === 'consultor') && (
                    <>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                      <button
                        type="button"
                        onClick={() => triggerQuickCreate('contratos')}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
                      >
                        Contrato / Recibo PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => triggerQuickCreate('financeiro')}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
                      >
                        Orçamento / Lançamento
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Menu Mobile Simplificado */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 space-y-1 no-print">
            {visibleHubs.map((hub) => {
              const badge = hubBadges[hub.id];
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => handleSelectHub(hub.id)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium ${
                    activeHub === hub.id
                      ? 'text-white font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  style={activeHub === hub.id ? { backgroundColor: 'var(--color-primary)' } : undefined}
                >
                  <span className="flex items-center gap-2.5">
                    {HUB_ICONS[hub.id]}
                    <span>{hub.label}</span>
                  </span>
                  {badge > 0 && <span className="text-xs tabular-nums opacity-85">{badge}</span>}
                </button>
              );
            })}
            <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={handleTogglePanelTheme}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {isDark ? 'Modo Claro' : 'Modo Escuro'}
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </div>
        )}

        <main
          className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 w-full mx-auto space-y-5 ${
            activeHub === 'leads' || activeHub === 'funil' ? 'max-w-[1600px]' : 'max-w-7xl'
          }`}
        >
          {firestore.error && (
            <div className="rounded-xl border border-red-200 dark:border-red-800/70 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-800 dark:text-red-300 flex items-center justify-between gap-3">
              <span>{firestore.error}</span>
              <button
                type="button"
                onClick={firestore.clearError}
                className="font-semibold underline shrink-0"
              >
                Dispensar
              </button>
            </div>
          )}

          {/* Barra de Sub-Abas Contextuais (Processos / Financeiro / Config) */}
          {activeHub === 'processos' && !selectedCaseId && (
            <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 w-fit max-w-full no-print">
              {visibleProcessosTabs.map((tab) => {
                const active = processosTab === tab.id;
                const count =
                  tab.id === 'casos'
                    ? hubBadges.processos
                    : tab.id === 'checklist'
                      ? hubBadges.checklist
                      : tab.id === 'dossies'
                        ? hubBadges.docsToCheck
                        : undefined;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setProcessosTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                    {count !== undefined && count > 0 ? ` (${count})` : ''}
                  </button>
                );
              })}
            </div>
          )}

          {activeHub === 'financeiro' && visibleFinanceiroTabs.length > 0 && (
            <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 w-fit max-w-full no-print">
              {visibleFinanceiroTabs.map((tab) => {
                const active = financeiroTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFinanceiroTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {activeHub === 'config' && visibleConfigTabs.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 w-fit max-w-full no-print">
              {visibleConfigTabs.map((tab) => {
                const active = configTab === tab.id;
                const count =
                  tab.id === 'legal'
                    ? hubBadges.legal
                    : tab.id === 'parceiros'
                      ? hubBadges.parceiros
                      : undefined;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setConfigTab(tab.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    {tab.label}
                    {count !== undefined && count > 0 ? ` (${count})` : ''}
                  </button>
                );
              })}
            </div>
          )}

          {loading || !effectiveWorkspace ? (
            <SkeletonBlock rows={5} />
          ) : (
            <>
              {/* HUB 1: HOJE */}
              {activeHub === 'hoje' && (
                <PainelDashboard
                  role={userProfile.role}
                  empresa={empresa}
                  isDark={isDark}
                  leads={effectiveWorkspace.leads}
                  clients={effectiveWorkspace.clients}
                  dependents={effectiveWorkspace.dependents}
                  cases={effectiveWorkspace.cases}
                  docs={effectiveWorkspace.caseDocuments}
                  deadlines={effectiveWorkspace.deadlines}
                  tasks={effectiveWorkspace.tasks}
                  appointments={effectiveWorkspace.appointments}
                  financialRecords={effectiveWorkspace.financialRecords}
                  communicationLogs={effectiveWorkspace.communicationLogs}
                  legalSources={legalSources}
                  visaRequirements={visaRequirements}
                  staffUsers={effectiveWorkspace.staffUsers}
                  diasAlertaRevisaoLegal={empresa.diasAlertaRevisaoLegal || 90}
                  brandName={empresa.nome_empresa}
                  onLogWhatsApp={handleLogWhatsApp}
                  onEmailLogsCreated={handleEmailLogsCreated}
                  onOpenCase={handleOpenCase}
                  onOpenChecklist={handleOpenChecklist}
                  onOpenFunnelStage={handleOpenFunnelStage}
                  onToggleTask={handleQuickToggleTask}
                  onNavigateSection={handleNavigateLegacySection}
                />
              )}

              {/* HUB 2: FUNIL KANBAN (5 MARCOS DE CONVERSÃO) */}
              {activeHub === 'funil' && (
                <PainelFunnelKanbanDashboard
                  role={userProfile.role}
                  currentUser={userProfile}
                  staffUsers={effectiveWorkspace.staffUsers}
                  empresa={empresa}
                  isDark={isDark}
                  leads={effectiveWorkspace.leads}
                  clients={effectiveWorkspace.clients}
                  cases={effectiveWorkspace.cases}
                  docs={effectiveWorkspace.caseDocuments}
                  tasks={effectiveWorkspace.tasks}
                  deadlines={effectiveWorkspace.deadlines}
                  onOpenCase={handleOpenCase}
                  onOpenLeads={handleOpenLead}
                  onQuickCreateLead={handleQuickCreateLead}
                  onConvertLead={handleConvertLeadFromKanban}
                  onRefresh={handleRefreshAll}
                />
              )}

              {/* HUB 3: LEADS */}
              {activeHub === 'leads' && (
                <PainelLeads
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  leads={effectiveWorkspace.leads}
                  clients={effectiveWorkspace.clients}
                  tasks={effectiveWorkspace.tasks}
                  auditLogs={effectiveWorkspace.auditLogs}
                  requestedOpenLead={requestedOpenLead}
                  requestedQuickLeadSeq={requestedQuickLeadSeq}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  legalSources={legalSources}
                  activeRules={activeDiagnosticRules}
                  messageTemplates={effectiveWorkspace.messageTemplates}
                  panelTheme={panelTheme}
                  onToggleTheme={handleTogglePanelTheme}
                  onRefresh={handleRefreshAll}
                  onLogWhatsApp={handleLogWhatsApp}
                  onOpenCase={handleOpenCase}
                />
              )}

              {/* HUB 3: PROCESSOS (Funil de Casos + Clientes + Checklist + Dossiês) */}
              {activeHub === 'processos' && (processosTab === 'casos' || processosTab === 'clientes') && (
                <PainelClientesCasos
                  mode={processosTab === 'clientes' ? 'clientes' : 'casos'}
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  clients={effectiveWorkspace.clients}
                  dependents={effectiveWorkspace.dependents}
                  cases={effectiveWorkspace.cases}
                  caseFinancials={effectiveWorkspace.caseFinancials}
                  docs={effectiveWorkspace.caseDocuments}
                  tasks={effectiveWorkspace.tasks}
                  deadlines={effectiveWorkspace.deadlines}
                  appointments={effectiveWorkspace.appointments}
                  communicationLogs={effectiveWorkspace.communicationLogs}
                  viabilityAssessments={effectiveWorkspace.viabilityAssessments}
                  budgets={effectiveWorkspace.budgets}
                  financialRecords={effectiveWorkspace.financialRecords}
                  documentTemplates={effectiveWorkspace.documentTemplates}
                  generatedDocuments={effectiveWorkspace.generatedDocuments}
                  auditLogs={effectiveWorkspace.auditLogs}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  legalSources={legalSources}
                  messageTemplates={effectiveWorkspace.messageTemplates}
                  partnersPublic={partnersPublic}
                  selectedCaseId={selectedCaseId}
                  requestedCaseTab={requestedCaseTab}
                  requestedMacroStageFilter={requestedStageFilter}
                  requestedQuickAction={requestedQuickAction}
                  onSelectCase={(id) => {
                    if (id) handleOpenCase(id);
                    else setSelectedCaseId(null);
                  }}
                  onRefresh={handleRefreshAll}
                  onLogWhatsApp={handleLogWhatsApp}
                />
              )}

              {activeHub === 'processos' && processosTab === 'checklist' && (
                <PainelChecklistVisto
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  clients={effectiveWorkspace.clients}
                  dependents={effectiveWorkspace.dependents}
                  cases={effectiveWorkspace.cases}
                  docs={effectiveWorkspace.caseDocuments}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  selectedCaseId={selectedCaseId}
                  onSelectCase={setSelectedCaseId}
                  onRefresh={handleRefreshAll}
                  onOpenCase={handleOpenCase}
                  onNavigateSection={(sec) => handleNavigateLegacySection(sec)}
                />
              )}

              {activeHub === 'processos' && processosTab === 'dossies' && (
                <PainelDocumentosExport
                  role={userProfile.role}
                  empresa={empresa}
                  clients={effectiveWorkspace.clients}
                  dependents={effectiveWorkspace.dependents}
                  cases={effectiveWorkspace.cases}
                  docs={effectiveWorkspace.caseDocuments}
                  deadlines={effectiveWorkspace.deadlines}
                  avisoLegal={empresa.avisoLegal}
                  onRefresh={handleRefreshAll}
                />
              )}

              {/* HUB 4: AGENDA */}
              {activeHub === 'agenda' && (
                <PainelAgendaTarefas
                  role={userProfile.role}
                  clients={effectiveWorkspace.clients}
                  cases={effectiveWorkspace.cases}
                  tasks={effectiveWorkspace.tasks}
                  deadlines={effectiveWorkspace.deadlines}
                  appointments={effectiveWorkspace.appointments}
                  onRefresh={handleRefreshAll}
                  onOpenCase={handleOpenCase}
                />
              )}

              {/* HUB 5: FINANCEIRO & CONTRATOS */}
              {activeHub === 'financeiro' && (role === 'admin' || role === 'consultor') && (
                <PainelFinanceiro
                  sectionGroup={financeiroTab === 'contratos' ? 'contratos' : 'financeiro'}
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  clients={effectiveWorkspace.clients}
                  cases={effectiveWorkspace.cases}
                  dependents={effectiveWorkspace.dependents}
                  budgets={effectiveWorkspace.budgets}
                  financialRecords={effectiveWorkspace.financialRecords}
                  documentTemplates={effectiveWorkspace.documentTemplates}
                  generatedDocuments={effectiveWorkspace.generatedDocuments}
                  onRefresh={handleRefreshAll}
                  onRefreshPublic={refreshPublicData}
                  onLogWhatsApp={handleLogWhatsApp}
                />
              )}

              {/* HUB 6: RECURSOS & CONFIGURAÇÕES */}
              {activeHub === 'config' && configTab === 'ferramentas' && (
                <PainelFerramentas
                  role={userProfile.role}
                  empresa={empresa}
                  cases={effectiveWorkspace.cases}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  onRefresh={handleRefreshAll}
                />
              )}

              {activeHub === 'config' &&
                (configTab === 'parceiros' || configTab === 'legal') &&
                (role === 'admin' || role === 'consultor') && (
                  <PainelParceirosLegal
                    sectionGroup={configTab === 'legal' ? 'legal' : 'parceiros'}
                    role={userProfile.role}
                    userProfile={userProfile}
                    empresa={empresa}
                    partners={effectiveWorkspace.partners}
                    partnerProposals={effectiveWorkspace.partnerProposals}
                    legalSources={legalSources}
                    visaCategories={visaCategories}
                    visaRequirements={visaRequirements}
                    cases={effectiveWorkspace.cases}
                    activeDiagnosticRules={activeDiagnosticRules}
                    documentTemplates={effectiveWorkspace.documentTemplates}
                    onRefresh={handleRefreshAll}
                    onRefreshPublic={refreshPublicData}
                    onOpenCase={handleOpenCase}
                  />
                )}

              {activeHub === 'config' &&
                (configTab === 'admin_site' || configTab === 'admin_regras' || configTab === 'admin_gov') &&
                role === 'admin' && (
                  <PainelAdminConfig
                    sectionGroup={
                      configTab === 'admin_site'
                        ? 'site'
                        : configTab === 'admin_regras'
                          ? 'regras'
                          : 'governanca'
                    }
                    role={userProfile.role}
                    userProfile={userProfile}
                    empresa={empresa}
                    siteContent={staffSiteContent}
                    partnersPublic={partnersPublic}
                    visaCategories={visaCategories}
                    visaRequirements={visaRequirements}
                    legalSources={legalSources}
                    activeDiagnosticRules={activeDiagnosticRules}
                    auditLogs={effectiveWorkspace.auditLogs}
                    onRefresh={handleRefreshAll}
                    onRefreshPublic={refreshPublicData}
                  />
                )}
            </>
          )}
        </main>

        <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3.5 text-[11px] text-slate-500 dark:text-slate-400 text-center no-print">
          {empresa.avisoLegal}
        </footer>
      </div>

      {/* Modal de Busca Global */}
      {globalSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 flex items-start justify-center p-4 pt-16"
          role="dialog"
          aria-modal="true"
          aria-label="Busca rápida"
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Buscar cliente, processo, lead, tarefa ou norma..."
                className="flex-1 text-sm bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(false)}
                className="px-2 py-1 rounded text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {!globalQuery.trim() ? (
                <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Digite um nome, CPF, e-mail, nº SERMIG, tarefa ou norma legal...
                </p>
              ) : searchResults.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhum resultado encontrado.
                </p>
              ) : (
                searchResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={res.onSelect}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{res.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{res.subtitle}</p>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {res.category}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
