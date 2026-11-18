import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Briefcase,
  Calculator,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  DollarSign,
  FileSignature,
  FolderArchive,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Palette,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sliders,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { PainelAdminConfig } from '../components/painel/PainelAdminConfig';
import { PainelAgendaTarefas } from '../components/painel/PainelAgendaTarefas';
import { PainelChecklistVisto } from '../components/painel/PainelChecklistVisto';
import { PainelClientesCasos } from '../components/painel/PainelClientesCasos';
import { PainelDashboard } from '../components/painel/PainelDashboard';
import { PainelDocumentosExport } from '../components/painel/PainelDocumentosExport';
import { PainelFerramentas } from '../components/painel/PainelFerramentas';
import { PainelFinanceiro } from '../components/painel/PainelFinanceiro';
import { PainelLeads } from '../components/painel/PainelLeads';
import { PainelParceirosLegal } from '../components/painel/PainelParceirosLegal';
import { PainelProgressoTarefasChart } from '../components/painel/PainelProgressoTarefasChart';
import { SkeletonBlock } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';
import { useFirestore } from '../hooks/useFirestore';
import {
  fetchAllSiteContentStaff,
  fetchStaffWorkspaceData,
  makeId,
  saveDocumentAudited,
} from '../services/firestoreService';
import { subscribeStaffDocumentChat } from '../services/chatService';
import type { CommunicationLog, SiteContent, Task, UserRole } from '../types/domain';
import { countUnreadChatForStaff, getPendingClientChatThreads } from '../utils/documentChat';
import { daysUntilDate, formatDateBR } from '../utils/formatters';
import { countLegalReviewPending } from '../utils/legalSync';

interface PainelPageProps {
  onNavigate: (path: string) => void;
}

type PanelSection =
  | 'dashboard'
  | 'agenda'
  | 'leads'
  | 'clientes'
  | 'casos'
  | 'checklist'
  | 'documentos'
  | 'contratos'
  | 'financeiro'
  | 'parceiros'
  | 'legal'
  | 'ferramentas'
  | 'admin_site'
  | 'admin_regras'
  | 'admin_gov';

interface RecentItem {
  id: string;
  label: string;
  type: 'caso' | 'secao';
  section: PanelSection;
  caseId?: string;
}

const ROLE_DISPLAY: Record<UserRole, string> = {
  admin: 'Administrador',
  consultor: 'Consultor',
  assistente: 'Assistente',
  cliente: 'Cliente',
};

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

  const [section, setSection] = useState<PanelSection>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffSiteContent, setStaffSiteContent] = useState<SiteContent[]>(siteContent);

  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const quickCreateRef = useRef<HTMLDivElement | null>(null);

  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof fetchStaffWorkspaceData>> | null>(null);
  const [liveChatLogs, setLiveChatLogs] = useState<CommunicationLog[]>([]);
  const [caseTabRequest, setCaseTabRequest] = useState<{
    caseId: string;
    tab: 'resumo' | 'comunicacao';
    seq: number;
  } | null>(null);
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
  }, [workspace, liveChatLogs, firestore.clients, firestore.diagnostics, firestore.loadingClients, firestore.loadingDiagnostics]);

  // Global keyboard shortcut "/" or Ctrl+K for command search + outside click for Quick Create
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

  const pushRecent = useCallback((item: RecentItem) => {
    setRecents((prev) => [item, ...prev.filter((r) => r.id !== item.id)].slice(0, 5));
  }, []);

  const handleOpenCase = (caseId: string, targetTab?: 'resumo' | 'comunicacao') => {
    setSelectedCaseId(caseId);
    setSection('casos');
    if (targetTab) {
      setCaseTabRequest({ caseId, tab: targetTab, seq: Date.now() });
    }
    const c = effectiveWorkspace?.cases.find((x) => x.id === caseId);
    if (c) {
      pushRecent({ id: `case_${caseId}`, label: c.titulo, type: 'caso', section: 'casos', caseId });
    }
  };

  const handleOpenChecklist = (caseId?: string) => {
    if (caseId) setSelectedCaseId(caseId);
    setSection('checklist');
    setMobileMenuOpen(false);
  };

  const handleSelectSection = (next: PanelSection) => {
    setSection(next);
    if (next !== 'casos') setSelectedCaseId(null);
    setMobileMenuOpen(false);
  };

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

  const navCounts = useMemo(() => {
    const legalAttention = countLegalReviewPending(legalSources, empresa.diasAlertaRevisaoLegal || 90).totalAttention;
    if (!effectiveWorkspace) {
      return { agenda: 0, leads: 0, clientes: 0, casos: 0, checklist: 0, documentos: 0, contratos: 0, parceiros: 0, legal: legalAttention };
    }
    const openTasks = effectiveWorkspace.tasks.filter((t) => t.status !== 'Concluída').length;
    const urgentDeadlines = effectiveWorkspace.deadlines.filter((d) => {
      if (d.concluido) return false;
      const diff = daysUntilDate(d.dataLimite);
      return diff !== null && diff <= 15;
    }).length;
    const newLeads = effectiveWorkspace.leads.filter((l) => l.statusFunil === 'Novo').length;
    const activeClients = effectiveWorkspace.clients.filter((c) => !c.arquivado).length;
    const activeCasesList = effectiveWorkspace.cases.filter((c) => !c.arquivado);
    const activeCaseIds = new Set(activeCasesList.map((c) => c.id));
    const activeCases = activeCasesList.length;
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
      agenda: openTasks + urgentDeadlines,
      leads: newLeads,
      clientes: activeClients,
      casos: activeCases,
      checklist: pendingChecklist,
      documentos: docsToCheck,
      contratos: effectiveWorkspace.generatedDocuments.length,
      parceiros: openProposals,
      legal: legalAttention,
    };
  }, [effectiveWorkspace, legalSources, empresa.diasAlertaRevisaoLegal]);

  const navGroups: {
    group: string;
    items: { id: PanelSection; label: string; icon: React.ReactNode; visible: boolean; badge?: number }[];
  }[] = useMemo(
    () => [
      {
        group: 'Operação Diária',
        items: [
          {
            id: 'dashboard',
            label: 'Visão Geral',
            icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
            visible: true,
          },
          {
            id: 'agenda',
            label: 'Agenda, Tarefas & Prazos',
            icon: <CalendarClock className="w-4 h-4 shrink-0" />,
            visible: true,
            badge: navCounts.agenda > 0 ? navCounts.agenda : undefined,
          },
        ],
      },
      {
        group: 'Atendimento & CRM',
        items: [
          {
            id: 'leads',
            label: 'Leads & Diagnósticos',
            icon: <UserCheck className="w-4 h-4 shrink-0" />,
            visible: true,
            badge: navCounts.leads > 0 ? navCounts.leads : undefined,
          },
          {
            id: 'clientes',
            label: 'Clientes (CRM)',
            icon: <Users className="w-4 h-4 shrink-0" />,
            visible: true,
            badge: navCounts.clientes > 0 ? navCounts.clientes : undefined,
          },
          {
            id: 'casos',
            label: 'Casos & Pipeline',
            icon: <Briefcase className="w-4 h-4 shrink-0" />,
            visible: true,
            badge: navCounts.casos > 0 ? navCounts.casos : undefined,
          },
          {
            id: 'checklist',
            label: 'Checklist por Visto',
            icon: <ClipboardCheck className="w-4 h-4 shrink-0" />,
            visible: true,
            badge: navCounts.checklist > 0 ? navCounts.checklist : undefined,
          },
          {
            id: 'documentos',
            label: 'Dossiês & Arquivos',
            icon: <FolderArchive className="w-4 h-4 shrink-0" />,
            visible: true,
            badge: navCounts.documentos > 0 ? navCounts.documentos : undefined,
          },
        ],
      },
      {
        group: 'Comercial & Financeiro',
        items: [
          {
            id: 'contratos',
            label: 'Contratos & Recibos',
            icon: <FileSignature className="w-4 h-4 shrink-0" />,
            visible: role === 'admin' || role === 'consultor',
            badge: navCounts.contratos > 0 ? navCounts.contratos : undefined,
          },
          {
            id: 'financeiro',
            label: 'Financeiro & Orçamentos',
            icon: <DollarSign className="w-4 h-4 shrink-0" />,
            visible: role === 'admin' || role === 'consultor',
          },
          {
            id: 'parceiros',
            label: 'Parceiros & Propostas',
            icon: <Handshake className="w-4 h-4 shrink-0" />,
            visible: role === 'admin' || role === 'consultor',
            badge: navCounts.parceiros > 0 ? navCounts.parceiros : undefined,
          },
        ],
      },
      {
        group: 'Normativa & Ferramentas',
        items: [
          {
            id: 'legal',
            label: 'Base Legal & Vistos',
            icon: <Scale className="w-4 h-4 shrink-0" />,
            visible: role === 'admin' || role === 'consultor',
            badge: navCounts.legal > 0 ? navCounts.legal : undefined,
          },
          {
            id: 'ferramentas',
            label: 'Calculadoras & Simulador',
            icon: <Calculator className="w-4 h-4 shrink-0" />,
            visible: true,
          },
        ],
      },
      {
        group: 'Administração',
        items: [
          {
            id: 'admin_site',
            label: 'Site, Logos & CMS',
            icon: <Palette className="w-4 h-4 shrink-0" />,
            visible: role === 'admin',
          },
          {
            id: 'admin_regras',
            label: 'Motor de Diagnóstico',
            icon: <Sliders className="w-4 h-4 shrink-0" />,
            visible: role === 'admin',
          },
          {
            id: 'admin_gov',
            label: 'Equipe, Bancário & Audit.',
            icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
            visible: role === 'admin',
          },
        ],
      },
    ],
    [role, navCounts],
  );

  const visibleFlatNav = useMemo(
    () => navGroups.flatMap((g) => g.items.filter((i) => i.visible)),
    [navGroups],
  );

  const searchResults = useMemo(() => {
    if (!effectiveWorkspace || !globalQuery.trim()) return [];
    const q = globalQuery.toLowerCase();
    const out: { id: string; category: string; title: string; subtitle: string; onSelect: () => void }[] = [];

    if (
      q.includes('checklist') ||
      q.includes('visto') ||
      q.includes('requisit') ||
      q.includes('doc')
    ) {
      out.push({
        id: 'tool_checklist_visto',
        category: 'Checklist',
        title: 'Checklist de Documentos por Visto',
        subtitle: 'Conferir requisitos da categoria e marcar conclusão',
        onSelect: () => {
          handleSelectSection('checklist');
          setGlobalSearchOpen(false);
        },
      });
    }

    if (
      q.includes('calc') ||
      q.includes('praz') ||
      q.includes('cambi') ||
      q.includes('câmb') ||
      q.includes('clp') ||
      q.includes('checklist') ||
      q.includes('simula')
    ) {
      out.push({
        id: 'tool_ferramentas',
        category: 'Ferramenta',
        title: 'Calculadoras de Prazos, Câmbio BRL/CLP & Simulador',
        subtitle: 'Abrir utilitários da consultoria',
        onSelect: () => {
          handleSelectSection('ferramentas');
          setGlobalSearchOpen(false);
        },
      });
    }

    for (const c of effectiveWorkspace.cases) {
      if (c.titulo.toLowerCase().includes(q) || (c.numeroPedidoSermig || '').toLowerCase().includes(q)) {
        out.push({
          id: `case_${c.id}`,
          category: 'Caso',
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
            else handleSelectSection('clientes');
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
            handleSelectSection('leads');
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
            else handleSelectSection('agenda');
            setGlobalSearchOpen(false);
          },
        });
      }
    }
    for (const dl of effectiveWorkspace.deadlines) {
      if (dl.titulo.toLowerCase().includes(q) || dl.tipo.toLowerCase().includes(q)) {
        out.push({
          id: `dl_${dl.id}`,
          category: 'Prazo',
          title: dl.titulo,
          subtitle: `${dl.tipo} · Limite ${formatDateBR(dl.dataLimite)}`,
          onSelect: () => {
            if (dl.caseId) handleOpenCase(dl.caseId);
            else handleSelectSection('agenda');
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
              handleSelectSection('legal');
              setGlobalSearchOpen(false);
            },
          });
        }
      }
    }
    return out.slice(0, 14);
  }, [effectiveWorkspace, globalQuery, legalSources, role]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] text-sm text-slate-600">
        Verificando credenciais da equipe...
      </div>
    );
  }

  if (!userProfile || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
        <div
          className="border border-slate-200 p-8 max-w-md w-full text-center space-y-4"
          style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--card-radius, 12px)' }}
        >
          <h1 className="text-xl font-bold text-slate-900">Painel Interno da Equipe</h1>
          <p className="text-sm text-slate-600">
            Acesso restrito a colaboradores ativos da consultoria D&amp;M Integra Chile.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('/entrar-equipe')}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Entrar como Equipe
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
            >
              Voltar ao Site
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeNavMeta = visibleFlatNav.find((n) => n.id === section);
  const activeCaseTitle = selectedCaseId
    ? effectiveWorkspace?.cases.find((c) => c.id === selectedCaseId)?.titulo
    : null;

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      {/* Sidebar Desktop agrupada e recolhível */}
      <aside
        className={`hidden lg:flex lg:flex-col bg-white border-r border-slate-200 shrink-0 no-print transition-all ${
          sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-2">
          <button type="button" onClick={() => onNavigate('/')} className="flex items-center gap-2.5 text-left min-w-0">
            {empresa.logoUrl ? (
              <img
                src={empresa.logoUrl}
                alt={empresa.nome_empresa}
                referrerPolicy="no-referrer"
                className={sidebarCollapsed ? 'h-7 w-7 object-contain shrink-0' : 'h-8 max-w-[120px] object-contain shrink-0'}
              />
            ) : null}
            {!sidebarCollapsed && (
              <div className="min-w-0">
                {!empresa.logoUrl && (
                  <p className="text-sm font-bold text-slate-900 truncate">{empresa.nome_empresa.split('–')[0].trim()}</p>
                )}
                <p className="text-[11px] font-medium text-slate-500 truncate">
                  {ROLE_DISPLAY[userProfile.role]}
                </p>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto" aria-label="Menu do painel operacional">
          {navGroups.map((g) => {
            const groupVisible = g.items.filter((i) => i.visible);
            if (groupVisible.length === 0) return null;
            return (
              <div key={g.group} className="space-y-1">
                {!sidebarCollapsed && (
                  <p className="px-3 text-[11px] font-semibold text-slate-400">{g.group}</p>
                )}
                {groupVisible.map((item) => {
                  const isActive = section === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.label}
                      onClick={() => handleSelectSection(item.id)}
                      className={`w-full flex items-center ${
                        sidebarCollapsed ? 'justify-center px-2' : 'justify-between gap-2 px-3'
                      } py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                        isActive ? 'text-white' : 'text-slate-700 hover:bg-slate-100'
                      }`}
                      style={isActive ? { backgroundColor: 'var(--color-primary)' } : undefined}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {item.icon}
                        {!sidebarCollapsed && <span className="truncate whitespace-nowrap">{item.label}</span>}
                      </span>
                      {!sidebarCollapsed && item.badge !== undefined && (
                        <span
                          className={`text-[11px] font-bold tabular-nums shrink-0 ${
                            isActive ? 'text-white/90' : 'text-slate-400'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {!sidebarCollapsed && recents.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Recentes
              </p>
              {recents.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => (r.caseId ? handleOpenCase(r.caseId) : handleSelectSection(r.section))}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-[11px] text-slate-600 hover:bg-slate-100 truncate"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          {!sidebarCollapsed && (
            <>
              <p className="text-xs font-semibold text-slate-900 truncate">{userProfile.nome}</p>
              <p className="text-[11px] text-slate-500 truncate">{userProfile.email}</p>
            </>
          )}
          <div className={`flex gap-2 pt-1 ${sidebarCollapsed ? 'flex-col' : ''}`}>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {sidebarCollapsed ? 'Site' : 'Site Público'}
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              {!sidebarCollapsed && 'Sair'}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Desktop + Mobile com Breadcrumb, Atualizar, Busca Global e Criar Novo */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-3 no-print sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Abrir menu do painel"
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-700"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <nav className="flex items-center gap-1.5 text-xs text-slate-500 truncate" aria-label="Breadcrumb">
              <button
                type="button"
                onClick={() => handleSelectSection('dashboard')}
                className="hover:text-slate-900 font-medium whitespace-nowrap"
              >
                Painel
              </button>
              <span>/</span>
              <span className="font-semibold text-slate-900 truncate whitespace-nowrap">
                {activeNavMeta?.label || 'Início'}
              </span>
              {activeCaseTitle && (
                <>
                  <span>/</span>
                  <span className="text-[var(--color-primary)] font-semibold truncate max-w-[200px]">
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
                    handleSelectSection('casos');
                  }
                }}
                title="Abrir dúvida de documento enviada no Chat do Portal"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-semibold hover:bg-amber-100 whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Dúvidas Chat</span>
                <span className="font-bold tabular-nums">({unreadChatCount})</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleRefreshAll()}
              disabled={refreshing}
              title="Atualizar dados sincronizados"
              aria-label="Atualizar dados do painel"
              className="p-2 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-600 hover:bg-slate-100 whitespace-nowrap"
              aria-label="Busca global (pressione barra ou Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Buscar cliente, caso, tarefa...</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded">
                /
              </kbd>
            </button>

            <div className="relative" ref={quickCreateRef}>
              <button
                type="button"
                onClick={() => setQuickCreateOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Criar novo</span>
              </button>
              {quickCreateOpen && (
                <div className="absolute right-0 mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-40 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSection('clientes');
                      setQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-800"
                  >
                    + Novo Cliente (CRM)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSection('casos');
                      setQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-800"
                  >
                    + Novo Caso Migratório
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSection('agenda');
                      setQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-800"
                  >
                    + Tarefa, Prazo ou Reunião
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSection('leads');
                      setQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-800"
                  >
                    Triagem de Leads
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSection('checklist');
                      setQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-800"
                  >
                    Checklist de Documentos por Visto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectSection('ferramentas');
                      setQuickCreateOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-800"
                  >
                    Calculadoras &amp; Simulador
                  </button>
                  {(role === 'admin' || role === 'consultor') && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectSection('contratos');
                          setQuickCreateOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-800"
                      >
                        + Gerar Contrato / Recibo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectSection('financeiro');
                          setQuickCreateOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-100 font-medium text-slate-800"
                      >
                        + Novo Orçamento / Lançamento
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 p-3 space-y-1 no-print">
            {visibleFlatNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectSection(item.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold ${
                  section === item.id ? 'text-white' : 'text-slate-700'
                }`}
                style={section === item.id ? { backgroundColor: 'var(--color-primary)' } : undefined}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && <span className="tabular-nums opacity-80">{item.badge}</span>}
              </button>
            ))}
          </div>
        )}

        <main
          className={`flex-1 min-w-0 p-4 sm:p-6 lg:p-8 w-full mx-auto ${
            section === 'leads' ? 'max-w-[1560px]' : 'max-w-7xl'
          }`}
        >
          {firestore.error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 flex items-center justify-between gap-3">
              <span>Erro ao sincronizar dados com o Firestore: {firestore.error}</span>
              <button
                type="button"
                onClick={firestore.clearError}
                className="font-semibold underline shrink-0"
              >
                Dispensar
              </button>
            </div>
          )}
          {loading || !effectiveWorkspace ? (
            <SkeletonBlock rows={5} />
          ) : (
            <>
              <PainelProgressoTarefasChart
                empresa={empresa}
                tasks={effectiveWorkspace.tasks}
                cases={effectiveWorkspace.cases}
                clients={effectiveWorkspace.clients}
                docs={effectiveWorkspace.caseDocuments}
                selectedCaseId={selectedCaseId}
                onOpenAgenda={() => handleSelectSection('agenda')}
                onOpenCase={handleOpenCase}
              />

              {section === 'dashboard' && (
                <PainelDashboard
                  role={userProfile.role}
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
                  diasAlertaRevisaoLegal={empresa.diasAlertaRevisaoLegal || 90}
                  brandName={empresa.nome_empresa}
                  onLogWhatsApp={handleLogWhatsApp}
                  onEmailLogsCreated={handleEmailLogsCreated}
                  onOpenCase={handleOpenCase}
                  onOpenChecklist={handleOpenChecklist}
                  onToggleTask={handleQuickToggleTask}
                  onNavigateSection={(sec) => handleSelectSection(sec)}
                />
              )}

              {section === 'agenda' && (
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

              {section === 'leads' && (
                <PainelLeads
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  leads={effectiveWorkspace.leads}
                  clients={effectiveWorkspace.clients}
                  tasks={effectiveWorkspace.tasks}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  legalSources={legalSources}
                  activeRules={activeDiagnosticRules}
                  messageTemplates={effectiveWorkspace.messageTemplates}
                  onRefresh={handleRefreshAll}
                  onLogWhatsApp={handleLogWhatsApp}
                  onOpenCase={handleOpenCase}
                />
              )}

              {(section === 'clientes' || section === 'casos') && (
                <PainelClientesCasos
                  mode={section === 'clientes' ? 'clientes' : 'casos'}
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
                  requestedCaseTab={caseTabRequest}
                  onSelectCase={(id) => {
                    if (id) handleOpenCase(id);
                    else setSelectedCaseId(null);
                  }}
                  onRefresh={handleRefreshAll}
                  onLogWhatsApp={handleLogWhatsApp}
                />
              )}

              {section === 'checklist' && (
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
                  onNavigateSection={(sec) => handleSelectSection(sec)}
                />
              )}

              {section === 'documentos' && (
                <PainelDocumentosExport
                  role={userProfile.role}
                  empresa={empresa}
                  clients={effectiveWorkspace.clients}
                  dependents={effectiveWorkspace.dependents}
                  cases={effectiveWorkspace.cases}
                  docs={effectiveWorkspace.caseDocuments}
                  deadlines={effectiveWorkspace.deadlines}
                  avisoLegal={empresa.avisoLegal}
                />
              )}

              {(section === 'financeiro' || section === 'contratos') &&
                (role === 'admin' || role === 'consultor') && (
                  <PainelFinanceiro
                    sectionGroup={section === 'contratos' ? 'contratos' : 'financeiro'}
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

              {(section === 'parceiros' || section === 'legal') &&
                (role === 'admin' || role === 'consultor') && (
                  <PainelParceirosLegal
                    sectionGroup={section === 'legal' ? 'legal' : 'parceiros'}
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

              {section === 'ferramentas' && (
                <PainelFerramentas
                  role={userProfile.role}
                  empresa={empresa}
                  cases={effectiveWorkspace.cases}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  onRefresh={handleRefreshAll}
                />
              )}

              {(section === 'admin_site' || section === 'admin_regras' || section === 'admin_gov') &&
                role === 'admin' && (
                  <PainelAdminConfig
                    sectionGroup={
                      section === 'admin_site' ? 'site' : section === 'admin_regras' ? 'regras' : 'governanca'
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

        <footer className="bg-white border-t border-slate-200 px-6 py-4 text-[11px] text-slate-500 text-center">
          {empresa.avisoLegal}
        </footer>
      </div>

      {/* Modal de Busca Global */}
      {globalSearchOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-start justify-center p-4 pt-16"
          role="dialog"
          aria-modal="true"
          aria-label="Busca global"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                ref={searchInputRef}
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                placeholder="Buscar clientes, casos, tarefas, prazos, documentos ou calculadoras..."
                className="flex-1 text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(false)}
                className="px-2 py-1 rounded text-xs text-slate-500 hover:bg-slate-100"
              >
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {!globalQuery.trim() ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  Digite um nome, CPF, e-mail, nº SERMIG, tarefa, prazo ou norma (ex.: Mercosul, Ley 21.325, câmbio)...
                </p>
              ) : searchResults.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">Nenhum resultado encontrado.</p>
              ) : (
                searchResults.map((res) => (
                  <button
                    key={res.id}
                    type="button"
                    onClick={res.onSelect}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{res.title}</p>
                      <p className="text-[11px] text-slate-500 truncate">{res.subtitle}</p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 shrink-0">
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
