import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  Briefcase,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileSignature,
  FileText,
  FolderOpen,
  Handshake,
  HelpCircle,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  Printer,
  RefreshCw,
  Scale,
  Shield,
  ShieldCheck,
  Star,
  Sun,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { CalendlyModal } from '../components/CalendlyModal';
import { DiagnosticRadarChart } from '../components/diagnostic/DiagnosticRadarChart';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { PdfPreviewModal } from '../components/pdf/PdfPreviewModal';
import { ClientActionCenterCard } from '../components/portal/ClientActionCenterCard';
import { DocumentChatWidget } from '../components/portal/DocumentChatWidget';
import { ImmigrationStatusTimeline } from '../components/portal/ImmigrationStatusTimeline';
import { PortalBibliotecaLegal } from '../components/portal/PortalBibliotecaLegal';
import { SecureDocumentUploadSection } from '../components/portal/SecureDocumentUploadSection';
import { ProfileIdentityDocumentsCard } from '../components/ProfileIdentityDocumentsCard';
import { SermigSimulator } from '../components/SermigSimulator';
import { DrawSignaturePad, QrCodeSvg, UiButton } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import { PIPELINE_STAGES } from '../data/seeds';
import {
  fetchClientPortalData,
  makeId,
  saveDocumentAudited,
  uploadFileToServer,
} from '../services/firestoreService';
import { reportAppError } from '../services/errorService';
import {
  deactivateUserPushTokens,
  enableClientBrowserNotifications,
  fetchUserPushState,
  getBrowserPushSupport,
  getEffectiveVapidConfig,
  markAllClientNotificationsRead,
  markClientNotificationRead,
  sendTestBrowserNotification,
  showBrowserProcessNotification,
  subscribeClientNotifications,
  subscribeForegroundFcm,
  updateUserPushPreferences,
  type BrowserPushSupport,
  type PushActivationMode,
} from '../services/notificationService';
import type {
  Appointment,
  Budget,
  Case,
  CaseDocument,
  Client,
  ClientNotification,
  Deadline,
  Dependent,
  FinancialRecord,
  GeneratedDocument,
  Lead,
  PushNotificationPreferences,
  ViabilityAssessment,
} from '../types/domain';
import {
  DEFAULT_PUSH_PREFERENCES,
  getNotificationTypeLabel,
  getPortalTabForNotification,
  shouldDeliverNotificationForPreferences,
} from '../utils/pushNotifications';
import { calcularTermometroDocumentos } from '../utils/caseMetrics';
import {
  buildGoogleCalendarUrl,
  buildWhatsAppUrl,
  downloadIcsFile,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  maskPhoneBR,
  sanitizeHtml,
} from '../utils/formatters';
import {
  buildBasicDiagnosticSummary,
  buildBasicLeadSummary,
  CONSULTANCY_PLANS,
  resolveClientPortalAccess,
  type BasicDiagnosticSummary,
} from '../utils/portalAccess';
import { runDiagnosticEngine } from '../utils/diagnosticEngine';
import { buildClientActionCenter } from '../utils/clientPortalIntelligence';
import { BrandLogo, BrandRibbon } from '../components/BrandLogo';

interface PortalClientePageProps {
  onNavigate: (path: string) => void;
}

type PortalTab = 'processo' | 'documentos' | 'biblioteca' | 'simulador' | 'financeiro' | 'suporte' | 'dados';

const ALLOWED_PORTAL_TABS: PortalTab[] = ['processo', 'documentos', 'biblioteca', 'simulador', 'financeiro', 'suporte', 'dados'];

function readInitialPortalTab(): PortalTab {
  if (typeof window === 'undefined') return 'processo';
  const param = new URLSearchParams(window.location.search).get('tab') as PortalTab | null;
  if (param && ALLOWED_PORTAL_TABS.includes(param)) return param;
  return 'processo';
}

export const PortalClientePage: React.FC<PortalClientePageProps> = ({ onNavigate }) => {
  const {
    userProfile,
    portalClient,
    portalLeads,
    portalAccess,
    portalStage,
    portalAccessLoading,
    empresa,
    partnersPublic,
    legalSources,
    visaCategories,
    visaRequirements,
    logout,
    refreshClientPortalAccess,
  } = useApp();
  const { isDark, toggleTheme } = useTheme();
  const [tab, setTab] = useState<PortalTab>(readInitialPortalTab);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(portalClient);
  const [dependents, setDependents] = useState<Dependent[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [assessments, setAssessments] = useState<ViabilityAssessment[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [financials, setFinancials] = useState<FinancialRecord[]>([]);
  const [genDocs, setGenDocs] = useState<GeneratedDocument[]>([]);
  const [clientLeads, setClientLeads] = useState<Lead[]>([]);

  const [calendlyOpen, setCalendlyOpen] = useState(false);
  const [lawOpen, setLawOpen] = useState(false);
  const [pixCopied, setPixCopied] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<'diagnostico' | 'progresso' | 'preview' | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; filename: string; blobUrl: string } | null>(null);
  const [viewingGenDoc, setViewingGenDoc] = useState<GeneratedDocument | null>(null);
  const [signingGenDoc, setSigningGenDoc] = useState<GeneratedDocument | null>(null);
  const [signBusy, setSignBusy] = useState(false);

  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [pushSupport, setPushSupport] = useState<BrowserPushSupport>({
    supported: false,
    fcmSupported: false,
    permission: 'unsupported',
  });
  const [pushActive, setPushActive] = useState(false);
  const [pushMode, setPushMode] = useState<PushActivationMode | 'inactive'>('inactive');
  const [pushPrefs, setPushPrefs] = useState<PushNotificationPreferences>({ ...DEFAULT_PUSH_PREFERENCES });
  const [pushPrefsBusy, setPushPrefsBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [testNotifBusy, setTestNotifBusy] = useState(false);
  const [pushToast, setPushToast] = useState<{ title: string; body: string; tab?: PortalTab } | null>(null);

  const pushActiveRef = useRef(false);
  const pushPrefsRef = useRef<PushNotificationPreferences>({ ...DEFAULT_PUSH_PREFERENCES });
  const initialNotifLoadedRef = useRef(false);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());

  pushActiveRef.current = pushActive;
  pushPrefsRef.current = pushPrefs;

  // Edição de dados próprios e dependentes
  const [editNome, setEditNome] = useState('');
  const [editWhats, setEditWhats] = useState('');
  const [editEndereco, setEditEndereco] = useState('');
  const [editProfissao, setEditProfissao] = useState('');
  const [npsNota, setNpsNota] = useState(5);
  const [npsComent, setNpsComent] = useState('');
  const [showPortalRadar, setShowPortalRadar] = useState(false);
  const [pushSettingsOpen, setPushSettingsOpen] = useState(false);
  const [officialDocSearch, setOfficialDocSearch] = useState('');
  const [officialDocStatusFilter, setOfficialDocStatusFilter] = useState<'todos' | 'pendentes' | 'assinados'>('todos');

  const portalRadarDimensions = useMemo(() => {
    const leadAnswers = clientLeads[0]?.respostasTriagem;
    if (!leadAnswers) return null;
    try {
      const fullResult = runDiagnosticEngine(
        leadAnswers,
        visaCategories,
        visaRequirements,
        legalSources,
        empresa,
      );
      const summary = buildBasicDiagnosticSummary(fullResult, leadAnswers);
      return summary.dimensoes && summary.dimensoes.length > 0 ? summary.dimensoes : null;
    } catch {
      return null;
    }
  }, [clientLeads, visaCategories, visaRequirements, legalSources, empresa]);

  const [syncCheckBusy, setSyncCheckBusy] = useState(false);
  const [syncCheckMsg, setSyncCheckMsg] = useState<string | null>(null);

  const effectiveClientId =
    portalStage === 'contratado'
      ? portalClient?.id || userProfile?.clientId || null
      : null;

  // Mantém o registro local de cliente e leads sincronizado com as atualizações em tempo real do AppContext
  useEffect(() => {
    if (portalClient) {
      setClient(portalClient);
      setEditNome((prev) => prev || portalClient.nomeCompleto || '');
      setEditWhats((prev) => prev || portalClient.whatsapp || '');
      setEditEndereco((prev) => prev || portalClient.enderecoCompleto || '');
      setEditProfissao((prev) => prev || portalClient.profissao || '');
    }
  }, [portalClient]);

  const canAccessSimulator = Boolean(
    (client || portalClient)?.simuladorSermigLiberado === true ||
      (portalAccess && 'capabilities' in portalAccess && portalAccess.capabilities.showSermigSimulator),
  );

  useEffect(() => {
    if (tab === 'simulador' && !canAccessSimulator) {
      setTab('processo');
    }
  }, [tab, canAccessSimulator]);

  useEffect(() => {
    if (portalLeads.length > 0) {
      setClientLeads(portalLeads);
    }
  }, [portalLeads]);

  const loadPortal = useCallback(async () => {
    // Aguarda portalStage === 'contratado' (com users/{uid}.clientId já gravado no Firestore pelo AppContext)
    // antes de consultar coleções protegidas por isCliente().
    if (portalStage !== 'contratado' || !effectiveClientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchClientPortalData(effectiveClientId);
      const resolvedClient = data.client || portalClient;
      setClient(resolvedClient);
      setDependents(data.dependents);
      setCases(data.cases);
      setDocs(data.caseDocuments);
      setDeadlines(data.deadlines);
      setAppointments(data.appointments);
      setAssessments(data.viabilityAssessments);
      setBudgets(data.budgets);
      setFinancials(data.financialRecords);
      setGenDocs(data.generatedDocuments);
      setClientLeads(data.leads.length > 0 ? data.leads : portalLeads);
      if (resolvedClient) {
        setEditNome(resolvedClient.nomeCompleto || '');
        setEditWhats(resolvedClient.whatsapp || '');
        setEditEndereco(resolvedClient.enderecoCompleto || '');
        setEditProfissao(resolvedClient.profissao || '');
      }
    } finally {
      setLoading(false);
    }
  }, [portalStage, effectiveClientId, portalClient, portalLeads]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    if (portalStage !== 'contratado' || !effectiveClientId || !userProfile?.uid) return;
    let active = true;
    initialNotifLoadedRef.current = false;
    seenNotifIdsRef.current = new Set();

    void getBrowserPushSupport().then((support) => {
      if (active) setPushSupport(support);
    });
    void fetchUserPushState(userProfile.uid)
      .then((state) => {
        if (!active) return;
        setPushActive(state.active);
        setPushMode(state.mode);
        setPushPrefs(state.preferencias);
      })
      .catch(() => undefined);

    const unsubNotifs = subscribeClientNotifications(
      effectiveClientId,
      (list) => {
        if (!active) return;
        setNotifications(list);

        if (!initialNotifLoadedRef.current) {
          list.forEach((n) => seenNotifIdsRef.current.add(n.id));
          initialNotifLoadedRef.current = true;
          return;
        }

        const freshUnread = list.filter((n) => !n.lida && !seenNotifIdsRef.current.has(n.id));
        list.forEach((n) => seenNotifIdsRef.current.add(n.id));

        if (freshUnread.length > 0) {
          const latest = freshUnread[0];
          if (shouldDeliverNotificationForPreferences(latest.tipo, pushPrefsRef.current)) {
            const targetTab = getPortalTabForNotification(latest.tipo, latest.linkDestino);
            setPushToast({ title: latest.titulo, body: latest.mensagem, tab: targetTab });
            if (pushActiveRef.current) {
              void showBrowserProcessNotification({
                id: latest.id,
                title: latest.titulo,
                body: latest.mensagem,
                url: latest.linkDestino || `/portal?tab=${targetTab}`,
              });
            }
          }
          void loadPortal();
        }
      },
    );

    const unsubFcm = subscribeForegroundFcm((payload) => {
      if (!active) return;
      const tipo = payload.data?.tipo;
      if (!shouldDeliverNotificationForPreferences(tipo, pushPrefsRef.current)) {
        void loadPortal();
        return;
      }
      const notifId = payload.data?.notificationId;
      if (notifId) {
        seenNotifIdsRef.current.add(notifId);
      }
      const title = payload.notification?.title || payload.data?.title || 'Atualização do Processo';
      const body = payload.notification?.body || payload.data?.body || 'Seu processo teve uma nova movimentação.';
      const targetTab = getPortalTabForNotification(tipo, payload.data?.url);
      setPushToast({ title, body, tab: targetTab });
      if (pushActiveRef.current) {
        void showBrowserProcessNotification({
          id: notifId,
          title,
          body,
          url: payload.data?.url || `/portal?tab=${targetTab}`,
        });
      }
      void loadPortal();
    });

    return () => {
      active = false;
      unsubNotifs();
      unsubFcm();
    };
  }, [portalStage, effectiveClientId, userProfile?.uid, loadPortal]);

  const handleManualPortalRefresh = async () => {
    if (syncCheckBusy) return;
    setSyncCheckBusy(true);
    setSyncCheckMsg(null);
    try {
      const resolved = await refreshClientPortalAccess();
      if (resolved?.kind === 'active_paid') {
        setSyncCheckMsg(null);
      } else if (resolved?.kind === 'pending_release') {
        setSyncCheckMsg('Cadastro localizado, mas o acesso completo ainda aguarda liberação pela equipe no painel.');
      } else {
        setSyncCheckMsg('Acesso mantido no modo Diagnóstico Gratuito. Confirme com o consultor o e-mail vinculado à contratação.');
      }
    } finally {
      setSyncCheckBusy(false);
    }
  };

  if (portalStage === 'loading' || portalAccessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F8FA] dark:bg-[#070B12]">
        <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden max-w-md w-full text-center shadow-[0_12px_36px_rgba(7,14,28,0.08)]">
          <BrandRibbon className="h-[3px] w-full" />
          <div className="p-8 space-y-3">
            <RefreshCw className="w-6 h-6 text-[#0F3D91] dark:text-[#60A5FA] animate-spin mx-auto" />
            <h1 className="text-lg font-bold text-[#0B1628] dark:text-white">Sincronizando Portal do Cliente...</h1>
            <p className="text-sm text-[#475569] dark:text-slate-300">
              Validando sua permissão no Firestore e preparando seus documentos.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile || userProfile.role !== 'cliente' || portalStage === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F8FA] dark:bg-[#070B12]">
        <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden max-w-md w-full text-center shadow-[0_12px_36px_rgba(7,14,28,0.08)]">
          <BrandRibbon className="h-[3px] w-full" />
          <div className="p-8 space-y-4">
            <h1 className="font-display text-2xl font-bold text-[#0B1628] dark:text-white">Portal do Cliente</h1>
            <p className="text-sm text-[#475569] dark:text-slate-300">
              Faça login com sua conta Google para acompanhar seu diagnóstico ou processo contratado.
            </p>
            <button
              type="button"
              onClick={() => onNavigate('/acompanhar')}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0B1628] hover:bg-[#152847] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] transition-colors"
            >
              Entrar no Portal do Cliente
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (portalStage === 'inativo') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F7F8FA] dark:bg-[#070B12]">
        <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden max-w-md w-full text-center shadow-[0_12px_36px_rgba(7,14,28,0.08)]">
          <BrandRibbon className="h-[3px] w-full" />
          <div className="p-8 space-y-4">
            <p className="brand-kicker">Portal do Cliente · Conta Desativada</p>
            <h1 className="font-display text-2xl font-bold text-[#0B1628] dark:text-white">Acesso Temporariamente Inativo</h1>
            <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              {portalAccess?.kind === 'inactive'
                ? portalAccess.reason
                : 'Seu acesso ao portal está inativo no momento. Fale com a consultoria para reativar.'}
            </p>
            <div className="flex flex-wrap justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#192842]"
              >
                Trocar conta Google
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Transição unificada: Modo Diagnóstico Gratuito ou Liberação Pendente gerenciado centralmente pelo AppContext.
  // Assim que a equipe liberar portalLiberado=true no Firestore, o AppContext transiciona automaticamente para 'contratado'.
  if (portalStage === 'gratuito' || portalStage === 'pendente') {
    const basicSummary =
      portalAccess?.kind === 'free_diagnostic_only'
        ? portalAccess.basicDiagnostic
        : portalAccess?.kind === 'pending_release'
          ? portalAccess.basicDiagnostic
          : null;
    const isPending = portalStage === 'pendente';

    return (
      <div className="min-h-screen flex flex-col bg-[#F7F8FA] dark:bg-[#070B12]">
        <header className="bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-xl border-b border-[#E5E7EB] dark:border-[#1E293B] sticky top-0 z-30">
          <BrandRibbon className="h-[3px] w-full no-print" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 min-h-16 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BrandLogo
                src={empresa.logoUrl}
                alt={empresa.nome_empresa}
                brandShortName={empresa.nome_empresa.split('–')[0].trim()}
                variant={isDark ? 'dark' : 'light'}
                imgClassName="h-9 w-auto max-w-[160px] object-contain shrink-0"
              />
              <div className="min-w-0 border-l border-[#E5E7EB] dark:border-[#1E293B] pl-3">
                <p className="text-xs sm:text-sm font-bold text-[#0B1628] dark:text-white truncate">
                  Portal do Cliente ·{' '}
                  <span className="text-[#0F3D91] dark:text-[#C9A86A]">
                    {isPending ? 'Liberação em Andamento' : 'Diagnóstico Gratuito'}
                  </span>
                </p>
                <p className="text-xs text-[#475569] dark:text-slate-400 truncate">{userProfile.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
                aria-pressed={isDark}
                className="inline-flex items-center justify-center p-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-[#0B1628] dark:text-slate-200 hover:bg-[#F7F8FA] dark:hover:bg-[#192842]"
              >
                {isDark ? <Sun className="w-3.5 h-3.5 text-[#C9A86A]" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                disabled={syncCheckBusy}
                onClick={() => void handleManualPortalRefresh()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#192842] whitespace-nowrap disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncCheckBusy ? 'animate-spin' : ''}`} />
                {syncCheckBusy ? 'Verificando...' : 'Verificar liberação'}
              </button>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#475569] dark:text-slate-300 hover:bg-[#F7F8FA] dark:hover:bg-[#111C30] whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
          <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#070E1C] text-[#C9A86A] flex items-center justify-center shrink-0">
                {isPending ? <Clock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0F3D91] dark:text-[#C9A86A]">
                  {isPending ? 'Cadastro localizado · Aguardando ativação' : 'Modo Diagnóstico Gratuito'}
                </p>
                <h1 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                  {isPending
                    ? 'Seu portal completo será liberado automaticamente aqui'
                    : 'Resumo inicial disponível — liberação automática ao contratar'}
                </h1>
                <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                  {isPending
                    ? `Identificamos seu cadastro (${portalClient?.nomeCompleto || userProfile.nome}). Assim que o consultor ativar seu acesso no painel, esta tela muda automaticamente para o Portal Contratado.`
                    : 'Você pode consultar seu diagnóstico básico e já adiantar a digitalização segura dos seus documentos de identidade abaixo.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={buildWhatsAppUrl(
                  empresa.whatsapp,
                  `Olá! Estou conectado no Portal do Cliente com ${userProfile.email} e gostaria de confirmar a liberação da minha consultoria.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F3D91] hover:bg-[#0B2E6E] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] text-white text-xs font-semibold whitespace-nowrap transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                Falar com a equipe
              </a>
            </div>
          </div>

          {syncCheckMsg && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-950 dark:text-amber-200">
              {syncCheckMsg}
            </div>
          )}

          {basicSummary && (
            <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden">
              <div className="bg-[#070E1C] text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C9A86A]">
                    Resumo do Diagnóstico Preliminar
                  </p>
                  <h2 className="font-display text-xl font-bold text-white mt-1">{basicSummary.subcategoriaNome}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider text-slate-300">Viabilidade</p>
                  <p className="font-mono text-3xl font-bold tabular-nums text-[#C9A86A]">
                    {basicSummary.notaViabilidade}
                    <span className="text-sm font-normal text-slate-300">/100</span>
                  </p>
                </div>
              </div>
              <div className="p-5 sm:p-6 space-y-4">
                <p className="text-sm text-[#0B1628] dark:text-slate-200 leading-relaxed">{basicSummary.resumoBasico}</p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('/diagnostico')}
                    className="px-4 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-[#F7F8FA] dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-white dark:hover:bg-[#192842]"
                  >
                    Atualizar / Refazer Diagnóstico
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/acompanhar')}
                    className="px-4 py-2 rounded-lg bg-[#0B1628] dark:bg-[#3B82F6] text-xs font-semibold text-white hover:opacity-95"
                  >
                    Ver planos de consultoria
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Simulador SERMIG liberado expressamente pelo administrador */}
          {canAccessSimulator && (
            <SermigSimulator
              mode="client"
              visaCategories={visaCategories}
              visaRequirements={visaRequirements}
              empresa={empresa}
              client={portalClient}
              activeCase={null}
              dependents={[]}
            />
          )}

          {/* Documentos de identidade escaneados via câmera sempre acessíveis ao titular */}
          <ProfileIdentityDocumentsCard
            userProfile={userProfile}
            title="Seus Documentos Escaneados via Câmera"
            subtitle="Os documentos salvos no seu perfil ficam imediatamente disponíveis no seu dossiê assim que o portal completo for liberado."
          />
        </main>
      </div>
    );
  }

  const activeCase = cases[0] || null;
  const resolvedClient = client || portalClient;
  const accessResolution =
    portalAccess?.kind === 'active_paid'
      ? portalAccess
      : resolveClientPortalAccess({
          userProfile,
          client: resolvedClient,
          activeCase,
          leads: clientLeads,
        });

  const paidModality = accessResolution.kind === 'active_paid' ? accessResolution.modality : 'completa';
  const planSpec = CONSULTANCY_PLANS[paidModality];
  const isOrientativa = paidModality === 'orientativa';

  const activeCaseDocs = activeCase ? docs.filter((d) => d.caseId === activeCase.id) : docs;
  const activeDocs = activeCaseDocs.length > 0 ? activeCaseDocs : docs;
  const primaryLead = clientLeads[0] || null;
  const releasedAssessments = assessments.filter((a) => a.liberadoAoCliente === true);
  const thermo = calcularTermometroDocumentos(activeDocs, empresa.bloqueioProtocoloMinimo || 100);
  const needsLgpdAccept = Boolean(
    client && (!client.lgpdAceito || client.lgpdVersao !== (empresa.termoLgpdVersao || '1.0')),
  );
  const unreadNotifCount = notifications.filter((n) => !n.lida).length;
  const vapidConfig = getEffectiveVapidConfig(empresa);

  const clientActionCenter = buildClientActionCenter({
    activeCase,
    docs: activeDocs,
    deadlines,
    appointments,
    genDocs,
    budgets,
    financials,
    thermo,
    needsLgpdAccept,
    canAccessSimulator,
  });

  const filteredGenDocs = genDocs.filter((gd) => {
    if (officialDocStatusFilter === 'pendentes' && (gd.canceladoEm || gd.status === 'Assinado')) return false;
    if (officialDocStatusFilter === 'assinados' && gd.status !== 'Assinado') return false;
    const q = officialDocSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      gd.titulo.toLowerCase().includes(q) ||
      (gd.codigoVerificacao || '').toLowerCase().includes(q) ||
      (gd.status || '').toLowerCase().includes(q)
    );
  });

  const handleEnablePush = async () => {
    if (!userProfile?.uid || !userProfile?.clientId || pushBusy) return;
    setPushBusy(true);
    setFeedbackMsg(null);
    try {
      const result = await enableClientBrowserNotifications({
        uid: userProfile.uid,
        clientId: userProfile.clientId,
        vapidKey: vapidConfig.valid ? vapidConfig.key : '',
        preferencias: pushPrefs,
      });
      setPushActive(true);
      setPushMode(result.mode);
      setPushPrefs(result.preferencias);
      setPushSupport(await getBrowserPushSupport());
      setFeedbackMsg(
        result.mode === 'fcm'
          ? 'Notificações push em segundo plano (FCM) ativadas neste dispositivo!'
          : result.note || 'Alertas instantâneos do navegador ativados!',
      );
    } catch (err) {
      setPushSupport(await getBrowserPushSupport());
      setFeedbackMsg(err instanceof Error ? err.message : 'Não foi possível ativar as notificações push.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    if (!userProfile?.uid || pushBusy) return;
    setPushBusy(true);
    setFeedbackMsg(null);
    try {
      await deactivateUserPushTokens(userProfile.uid);
      setPushActive(false);
      setPushMode('inactive');
      setFeedbackMsg('Notificações push desativadas neste dispositivo.');
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Não foi possível desativar as notificações push.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleTogglePushCategory = async (category: keyof PushNotificationPreferences) => {
    if (!userProfile?.uid || pushPrefsBusy) return;
    const nextPrefs: PushNotificationPreferences = {
      ...pushPrefs,
      [category]: !pushPrefs[category],
    };
    setPushPrefs(nextPrefs);
    setPushPrefsBusy(true);
    try {
      const saved = await updateUserPushPreferences(userProfile.uid, nextPrefs);
      setPushPrefs(saved);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Não foi possível atualizar as preferências de alertas.');
    } finally {
      setPushPrefsBusy(false);
    }
  };

  const handleTestNotification = async () => {
    if (!userProfile?.uid || !userProfile?.clientId || testNotifBusy) return;
    setTestNotifBusy(true);
    setFeedbackMsg(null);
    try {
      const support = await getBrowserPushSupport();
      setPushSupport(support);
      if (!support.supported) {
        setFeedbackMsg('Este navegador não suporta notificações nativas do sistema.');
        return;
      }
      if (support.permission === 'denied') {
        setFeedbackMsg(
          'As notificações estão bloqueadas nas permissões do navegador. Libere no ícone de cadeado da barra de endereço.',
        );
        return;
      }
      if (!pushActive || support.permission !== 'granted') {
        const result = await enableClientBrowserNotifications({
          uid: userProfile.uid,
          clientId: userProfile.clientId,
          vapidKey: vapidConfig.valid ? vapidConfig.key : '',
          preferencias: pushPrefs,
        });
        setPushActive(true);
        setPushMode(result.mode);
        setPushPrefs(result.preferencias);
        setPushSupport(await getBrowserPushSupport());
      }
      const sent = await sendTestBrowserNotification(empresa.nome_empresa);
      setFeedbackMsg(
        sent
          ? 'Notificação de teste disparada! Verifique o aviso exibido pelo seu navegador.'
          : 'Permissão concedida, mas o navegador bloqueou a exibição do alerta de teste (verifique o modo Não Perturbe do sistema).',
      );
    } catch (err) {
      setPushSupport(await getBrowserPushSupport());
      setFeedbackMsg(err instanceof Error ? err.message : 'Não foi possível enviar a notificação de teste.');
    } finally {
      setTestNotifBusy(false);
    }
  };

  const handleOpenNotificationItem = async (notif: ClientNotification) => {
    const targetTab = getPortalTabForNotification(notif.tipo, notif.linkDestino);
    setTab(targetTab);
    setNotifDrawerOpen(false);
    if (!notif.lida) {
      await markClientNotificationRead(notif.id).catch(() => undefined);
    }
  };

  const buildPortalClientDiagnosticPdfInput = () => {
    if (primaryLead?.respostasTriagem) {
      const fullResult = runDiagnosticEngine(
        primaryLead.respostasTriagem,
        visaCategories,
        visaRequirements,
        legalSources,
        empresa,
      );
      return {
        empresa,
        result: fullResult,
        answers: primaryLead.respostasTriagem,
        summary: buildBasicDiagnosticSummary(fullResult, primaryLead.respostasTriagem),
        protocolo: primaryLead.id,
      };
    }

    if (primaryLead) {
      return {
        empresa,
        summary: buildBasicLeadSummary(primaryLead),
        protocolo: primaryLead.id,
      };
    }

    const latestAssessment = releasedAssessments[0];
    const fallbackScore = latestAssessment ? Math.round(latestAssessment.notaGeral || 0) : thermo.notaGeral;
    const fallbackSummary: BasicDiagnosticSummary = {
      nome: client?.nomeCompleto || userProfile?.nome,
      notaViabilidade: fallbackScore,
      veredito:
        fallbackScore >= 75
          ? 'Perfil com alta aderência técnica'
          : fallbackScore >= 50
            ? 'Perfil viável com acompanhamento técnico'
            : 'Perfil em estruturação com consultoria',
      vereditoNivel: fallbackScore >= 75 ? 'alta' : fallbackScore >= 50 ? 'moderada' : 'atencao',
      confianca: 'Alta',
      subcategoriaCodigo: activeCase?.subcategoriaIa || 'SERMIG',
      subcategoriaNome: activeCase?.titulo || activeCase?.tipoServico || 'Residência Temporal no Chile',
      resumoBasico:
        latestAssessment?.enquadramentoLegal ||
        `Dossiê de acompanhamento do processo ${activeCase?.titulo || 'migratório'} sob gestão da ${empresa.nome_empresa}.`,
      temAlertaCritico: false,
      itensBloqueados: [],
      dataCalculo: latestAssessment?.createdAt || activeCase?.updatedAt || new Date().toISOString(),
    };

    return {
      empresa,
      summary: fallbackSummary,
      protocolo: activeCase?.id,
    };
  };

  const handleExportDiagnosticoPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy('diagnostico');
    setFeedbackMsg(null);
    try {
      const { exportClientDiagnosticPdf } = await import('../utils/clientDiagnosticPdf');
      const filename = await exportClientDiagnosticPdf(buildPortalClientDiagnosticPdfInput());
      setFeedbackMsg(`Dossiê do diagnóstico exportado em PDF (${filename}).`);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Não foi possível gerar o PDF do diagnóstico.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleExportProgressoPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy('progresso');
    setFeedbackMsg(null);
    try {
      const { exportProgressoPdf } = await import('../components/pdf/ClientPortalPdfDocuments');
      const filename = await exportProgressoPdf({
        empresa,
        client,
        dependents,
        activeCase,
        docs: activeDocs,
        deadlines,
        appointments,
        thermo,
        assessments: releasedAssessments,
      });
      setFeedbackMsg(`Relatório de progresso exportado em PDF (${filename}).`);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Não foi possível gerar o PDF do relatório de progresso.');
    } finally {
      setPdfBusy(null);
    }
  };

  const closePdfPreview = () => {
    setPdfPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  const handlePreviewPdf = async (kind: 'diagnostico' | 'progresso') => {
    if (pdfBusy) return;
    setPdfBusy('preview');
    setFeedbackMsg(null);
    try {
      const { blob, filename } =
        kind === 'diagnostico'
          ? await (await import('../utils/clientDiagnosticPdf')).buildClientDiagnosticPdfBlob(
              buildPortalClientDiagnosticPdfInput(),
            )
          : await (await import('../components/pdf/ClientPortalPdfDocuments')).buildProgressoPdfBlob({
              empresa,
              client,
              dependents,
              activeCase,
              docs: activeDocs,
              deadlines,
              appointments,
              thermo,
              assessments: releasedAssessments,
            });
      const blobUrl = URL.createObjectURL(blob);
      setPdfPreview((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return {
          title:
            kind === 'diagnostico'
              ? 'Pré-visualização: Dossiê de Diagnóstico (2 Páginas)'
              : 'Pré-visualização: Relatório de Progresso',
          filename,
          blobUrl,
        };
      });
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Não foi possível preparar a pré-visualização em PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleAcceptLgpd = async () => {
    if (!client) return;
    await saveDocumentAudited(
      'clients',
      client.id,
      {
        ...client,
        lgpdAceito: true,
        lgpdAceitoEm: new Date().toISOString(),
        lgpdVersao: empresa.termoLgpdVersao || '1.0',
      },
      false,
      'cliente',
      'lgpdAceito',
      client.lgpdAceito,
    );
    await loadPortal();
  };

  const handleBudgetDecision = async (b: Budget, decision: 'Aprovado' | 'Recusado') => {
    await saveDocumentAudited(
      'budgets',
      b.id,
      { ...b, status: decision, aprovadoEm: new Date().toISOString() },
      false,
      'cliente',
      'status',
      b.status,
    );
    setFeedbackMsg(`Orçamento ${b.numeroOrcamento} marcado como ${decision}.`);
    await loadPortal();
  };

  const handleUploadComprovante = async (fin: FinancialRecord, file: File) => {
    try {
      const uploaded = await uploadFileToServer(file);
      await saveDocumentAudited(
        'financialRecords',
        fin.id,
        { ...fin, comprovanteUrl: uploaded.url },
        false,
        'cliente',
        'comprovanteUrl',
        fin.comprovanteUrl,
      );
      setFeedbackMsg('Comprovante enviado para conferência da consultoria.');
      await loadPortal();
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Erro ao enviar comprovante.');
    }
  };

  const handleSavePersonalData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client) return;
    await saveDocumentAudited(
      'clients',
      client.id,
      {
        ...client,
        nomeCompleto: editNome,
        whatsapp: editWhats,
        enderecoCompleto: editEndereco,
        profissao: editProfissao,
      },
      false,
      'cliente',
      'dados_pessoais',
    );
    setFeedbackMsg('Seus dados foram atualizados.');
    await loadPortal();
  };

  const handleLgpdRequest = async (tipo: 'exportação' | 'exclusão') => {
    if (!client) return;
    const taskId = makeId('task');
    await saveDocumentAudited(
      'tasks',
      taskId,
      {
        id: taskId,
        titulo: `Solicitação LGPD de ${tipo} de dados — ${client.nomeCompleto}`,
        descricao: `Titular solicitou ${tipo} dos dados pelo Portal do Cliente em ${formatDateTimeBR(new Date())}.`,
        clientId: client.id,
        caseId: activeCase?.id || '',
        prioridade: 'Alta',
        status: 'Pendente',
        createdAt: new Date().toISOString(),
      },
      true,
      'cliente',
      `lgpd_${tipo}`,
    );
    setFeedbackMsg(`Solicitação de ${tipo} LGPD registrada com sucesso.`);
  };

  const handleConfirmGenDocRead = async (gd: GeneratedDocument) => {
    const nowIso = new Date().toISOString();
    await saveDocumentAudited(
      'generatedDocuments',
      gd.id,
      {
        ...gd,
        confirmadoLeituraEm: nowIso,
        confirmadoLeituraPor: client?.nomeCompleto || userProfile?.nome || userProfile?.email || 'Cliente',
        updatedAt: nowIso,
      },
      false,
      'cliente',
      'confirmadoLeituraEm',
    );
    setViewingGenDoc((prev) => (prev && prev.id === gd.id ? { ...prev, confirmadoLeituraEm: nowIso } : prev));
    setFeedbackMsg(`Leitura de "${gd.titulo}" confirmada.`);
    await loadPortal();
  };

  const handleSignGenDocCanvas = async (gd: GeneratedDocument, dataUrl: string) => {
    setSignBusy(true);
    try {
      const nowIso = new Date().toISOString();
      await saveDocumentAudited(
        'generatedDocuments',
        gd.id,
        {
          ...gd,
          assinaturaDataUrl: dataUrl,
          status: 'Assinado',
          assinadoEm: nowIso,
          updatedAt: nowIso,
        },
        false,
        'cliente',
        'assinatura_cliente',
      );
      setSigningGenDoc(null);
      setFeedbackMsg(`Documento "${gd.titulo}" assinado com sucesso!`);
      await loadPortal();
    } finally {
      setSignBusy(false);
    }
  };

  const handleUploadSignedGenDocPdf = async (gd: GeneratedDocument, file: File) => {
    setSignBusy(true);
    try {
      const uploaded = await uploadFileToServer(file);
      const nowIso = new Date().toISOString();
      await saveDocumentAudited(
        'generatedDocuments',
        gd.id,
        {
          ...gd,
          assinaturaUrl: uploaded.url,
          status: 'Assinado',
          assinadoEm: nowIso,
          updatedAt: nowIso,
        },
        false,
        'cliente',
        'assinatura_pdf_cliente',
      );
      setSigningGenDoc(null);
      setFeedbackMsg(`Arquivo assinado de "${gd.titulo}" enviado com sucesso!`);
      await loadPortal();
    } finally {
      setSignBusy(false);
    }
  };

  const handleSendNps = async () => {
    if (!activeCase) return;
    await saveDocumentAudited(
      'cases',
      activeCase.id,
      { ...activeCase, npsNota, npsComentario: npsComent },
      false,
      'cliente',
      'nps',
    );
    setFeedbackMsg('Obrigado pela sua avaliação!');
    await loadPortal();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] dark:bg-[#070B12]">
      {/* Header do Portal (Corporate Light/Dark) */}
      <header className="bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-xl border-b border-[#E5E7EB] dark:border-[#1E293B] sticky top-0 z-30">
        <BrandRibbon className="h-[3px] w-full no-print" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <BrandLogo
              src={empresa.logoUrl}
              alt={empresa.nome_empresa}
              brandShortName={empresa.nome_empresa.split('–')[0].trim()}
              variant={isDark ? 'dark' : 'light'}
              imgClassName="h-9 sm:h-10 w-auto max-w-[135px] sm:max-w-[190px] object-contain shrink-0"
            />
            <div className="min-w-0 border-l border-[#E5E7EB] dark:border-[#1E293B] pl-2.5 sm:pl-3">
              <p className="text-xs sm:text-sm font-bold text-[#0B1628] dark:text-white leading-snug break-words">
                Portal do Cliente · <span className="text-[#0F3D91] dark:text-[#C9A86A]">{planSpec.nome}</span>
              </p>
              <p className="text-xs text-[#475569] dark:text-slate-400 leading-snug break-words">{client?.nomeCompleto || userProfile.nome}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
              aria-pressed={isDark}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-[#0B1628] dark:text-slate-200 hover:bg-[#F7F8FA] dark:hover:bg-[#192842] transition-colors"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-[#C9A86A]" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setNotifDrawerOpen(true)}
              aria-label="Abrir central de notificações do processo"
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#192842] transition-colors whitespace-nowrap"
            >
              <Bell className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
              <span className="hidden sm:inline">Alertas</span>
              {unreadNotifCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-[#A61C2B] text-white text-[10px] font-bold tabular-nums">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-medium text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#192842] transition-colors whitespace-nowrap"
            >
              Site público
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#475569] dark:text-slate-300 hover:bg-[#F7F8FA] dark:hover:bg-[#111C30] hover:text-[#0B1628] dark:hover:text-white transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>

        {/* Abas desktop/tablet */}
        <nav className="hidden md:flex max-w-6xl mx-auto px-4 sm:px-6 items-center gap-1 overflow-x-auto border-t border-[#E5E7EB] dark:border-[#1E293B] no-print">
          {[
            { id: 'processo', label: 'Meu Processo & Etapas' },
            { id: 'documentos', label: 'Documentos & Prioridades' },
            { id: 'biblioteca', label: 'Biblioteca Legal' },
            ...(canAccessSimulator ? [{ id: 'simulador', label: 'Simulador SERMIG' }] : []),
            { id: 'financeiro', label: 'Orçamentos & Financeiro' },
            { id: 'suporte', label: 'Agendamento & Suporte' },
            { id: 'dados', label: 'Meus Dados & LGPD' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as PortalTab)}
              className={`px-3.5 py-3 text-xs sm:text-sm font-medium border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                tab === item.id
                  ? 'border-[#0F3D91] dark:border-[#3B82F6] text-[#0B1628] dark:text-white font-semibold'
                  : 'border-transparent text-[#475569] dark:text-slate-400 hover:text-[#0B1628] dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8 space-y-6">
        {pushToast && (
          <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-700 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <BellRing className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Nova atualização do processo</p>
                <p className="text-sm font-semibold mt-0.5">{pushToast.title}</p>
                <p className="text-xs text-slate-200 mt-0.5">{pushToast.body}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {pushToast.tab && (
                <button
                  type="button"
                  onClick={() => {
                    if (pushToast.tab) setTab(pushToast.tab);
                    setPushToast(null);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white whitespace-nowrap shrink-0"
                >
                  Abrir aba
                </button>
              )}
              <button
                type="button"
                onClick={() => setPushToast(null)}
                className="p-1 rounded hover:bg-slate-800 text-slate-300 shrink-0"
                aria-label="Fechar aviso"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {feedbackMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center justify-between gap-2">
            <span>{feedbackMsg}</span>
            <button type="button" onClick={() => setFeedbackMsg(null)} className="text-xs underline shrink-0">
              Fechar
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
            Carregando informações do seu processo...
          </div>
        ) : (
          <>
            {/* ABA 1: PROCESSO & ETAPAS */}
            {tab === 'processo' && (
              <div className="space-y-6">
                {/* 1. Cabeçalho Executivo do Processo + Prontidão Documental */}
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden shadow-[0_6px_24px_rgba(7,14,28,0.06)]">
                  <div className="bg-[#070E1C] text-white px-5 sm:px-7 py-6 border-b border-[#1E293B]">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C9A86A]">
                          {planSpec.nome}
                          {activeCase
                            ? isOrientativa
                              ? ` · ${activeCase.tipoServico} · Protocolo conduzido pelo cliente`
                              : ` · ${activeCase.tipoServico} · SERMIG: ${activeCase.statusSermig}`
                            : ' · Processo em estruturação'}
                        </p>
                        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                          {activeCase?.titulo || 'Acompanhamento de Residência no Chile'}
                        </h1>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 shrink-0">
                        <div className="text-left sm:text-right pr-2 sm:border-r sm:border-white/15 sm:pr-4">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
                            Prontidão Documental
                          </p>
                          <p className="text-3xl font-bold font-mono tabular-nums text-[#C9A86A]">
                            {thermo.notaGeral}%
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 no-print">
                          <button
                            type="button"
                            disabled={pdfBusy !== null}
                            onClick={() => void handleExportDiagnosticoPdf()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-[#C9A86A] hover:bg-[#d6b67a] text-xs font-bold text-[#070E1C] whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {pdfBusy === 'diagnostico' ? 'Gerando PDF...' : 'Dossiê Diagnóstico (PDF)'}
                          </button>
                          <button
                            type="button"
                            disabled={pdfBusy !== null}
                            onClick={() => void handleExportProgressoPdf()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-white/25 bg-white/10 hover:bg-white/15 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5 text-[#C9A86A]" />
                            {pdfBusy === 'progresso' ? 'Gerando PDF...' : 'Relatório de Progresso'}
                          </button>
                          <button
                            type="button"
                            disabled={pdfBusy !== null}
                            onClick={() => void handlePreviewPdf('progresso')}
                            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-white/20 text-xs font-medium text-slate-200 hover:bg-white/10 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {pdfBusy === 'preview' ? 'Preparando...' : 'Pré-visualizar'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Barra de Prontidão Documental Integrada */}
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <div className="flex justify-between text-xs font-medium text-slate-200 mb-2">
                        <span>
                          {thermo.faltantesObrigatorios === 0
                            ? isOrientativa
                              ? 'Todos os documentos obrigatórios foram conferidos e aprovados para você protocolar!'
                              : 'Todos os documentos obrigatórios foram aprovados!'
                            : `Faltam ${thermo.faltantesObrigatorios} documento(s) obrigatório(s). Seu processo está ${thermo.notaGeral}% pronto.`}
                        </span>
                        <span className="font-mono font-bold tabular-nums text-[#C9A86A]">{thermo.notaGeral}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${thermo.notaGeral}%`,
                            background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 55%, #C9A86A 100%)',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Central Inteligente de KPIs + Próximas Ações Prioritárias */}
                  <div className="p-5 sm:p-6 space-y-6">
                    <ClientActionCenterCard
                      center={clientActionCenter}
                      onSelectTab={(nextTab) => setTab(nextTab)}
                      onOpenSignDoc={(genDocId) => {
                        const targetDoc = genDocs.find((g) => g.id === genDocId);
                        if (targetDoc) {
                          setSigningGenDoc(targetDoc);
                        } else {
                          setTab('documentos');
                        }
                      }}
                    />

                    {/* Barra compacta e expansível de Notificações Push (mantém a 1ª dobra limpa) */}
                    <section
                      aria-label="Preferências de notificações push do processo"
                      className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] p-4 space-y-3 no-print"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#111C30] border border-[#E5E7EB] dark:border-[#24324A] flex items-center justify-center shrink-0">
                            {pushActive ? (
                              <BellRing className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Bell className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0B1628] dark:text-white">
                              Alertas do Processo ·{' '}
                              <span className="font-semibold text-[#475569] dark:text-slate-300">
                                {!pushSupport.supported
                                  ? 'Somente no portal'
                                  : pushSupport.permission === 'denied'
                                    ? 'Bloqueado no navegador'
                                    : pushActive
                                      ? pushMode === 'fcm'
                                        ? 'Push ativo (FCM)'
                                        : 'Alertas ativos'
                                      : 'Desativado'}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {pushSupport.supported && pushSupport.permission !== 'denied' && !pushActive && (
                            <button
                              type="button"
                              disabled={pushBusy}
                              onClick={() => void handleEnablePush()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F3D91] hover:bg-[#0B2E6E] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                            >
                              <BellRing className="w-3.5 h-3.5" />
                              {pushBusy ? 'Ativando...' : 'Ativar Push'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setPushSettingsOpen((v) => !v)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#192842]"
                          >
                            {pushSettingsOpen ? 'Ocultar preferências' : 'Preferências'}
                            {pushSettingsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotifDrawerOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#192842] tabular-nums"
                          >
                            Histórico ({notifications.length})
                          </button>
                        </div>
                      </div>

                      {pushSettingsOpen && (
                        <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-[#475569] dark:text-slate-300">
                              Escolha quais categorias disparam alertas instantâneos neste dispositivo:
                            </p>
                            {pushSupport.supported && pushSupport.permission !== 'denied' && (
                              <div className="flex items-center gap-2">
                                {pushActive && (
                                  <button
                                    type="button"
                                    disabled={pushBusy}
                                    onClick={() => void handleDisablePush()}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#475569] dark:text-slate-300 disabled:opacity-50"
                                  >
                                    <BellOff className="w-3.5 h-3.5" />
                                    Desativar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={testNotifBusy || pushBusy}
                                  onClick={() => void handleTestNotification()}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 disabled:opacity-50"
                                >
                                  <Bell className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
                                  {testNotifBusy ? 'Enviando...' : 'Testar alerta'}
                                </button>
                              </div>
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                            {(
                              [
                                {
                                  key: 'statusProcesso' as const,
                                  label: 'Etapas e status SERMIG',
                                  desc: 'Mudanças de fase, prazos e pareceres',
                                },
                                {
                                  key: 'documentos' as const,
                                  label: 'Documentos e checklist',
                                  desc: 'Aprovações, pendências e solicitações',
                                },
                                {
                                  key: 'mensagensEquipe' as const,
                                  label: 'Mensagens da equipe',
                                  desc: 'Respostas do consultor no chat do portal',
                                },
                              ] as const
                            ).map((cat) => {
                              const checked = pushPrefs[cat.key];
                              return (
                                <button
                                  key={cat.key}
                                  type="button"
                                  role="switch"
                                  aria-checked={checked}
                                  disabled={pushPrefsBusy}
                                  onClick={() => void handleTogglePushCategory(cat.key)}
                                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 min-h-[44px] rounded-lg border text-left transition-colors disabled:opacity-60 ${
                                    checked
                                      ? 'border-[#0F3D91]/40 dark:border-[#3B82F6]/50 bg-white dark:bg-[#111C30]'
                                      : 'border-[#E5E7EB] dark:border-[#1E293B] bg-white/60 dark:bg-[#0D1422]'
                                  }`}
                                >
                                  <div className="min-w-0 space-y-0.5">
                                    <p className="text-xs font-semibold text-[#0B1628] dark:text-white leading-snug break-words">{cat.label}</p>
                                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-snug break-words">{cat.desc}</p>
                                  </div>
                                  <span
                                    aria-hidden="true"
                                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                      checked ? 'bg-[#0F3D91] dark:bg-[#3B82F6]' : 'bg-slate-300 dark:bg-slate-700'
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                        checked ? 'translate-x-[18px]' : 'translate-x-[3px]'
                                      }`}
                                    />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>
                  {/* Aviso de escopo conforme modalidade contratada */}
                  {isOrientativa && (
                    <div className="p-4 rounded-xl bg-amber-50/75 border border-amber-200 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-amber-950">
                          Modalidade contratada: Consultoria Orientativa
                        </p>
                        <p className="text-xs text-amber-900 leading-relaxed">
                          Nossa equipe entrega seu checklist na ordem correta, realiza a conferência técnica de cada documento enviado aqui e orienta o passo a passo. O protocolo no sistema oficial do SERMIG é realizado diretamente por você.
                        </p>
                      </div>
                      <a
                        href={buildWhatsAppUrl(
                          empresa.whatsapp,
                          `Olá! Sou cliente na Consultoria Orientativa (${client?.nomeCompleto || ''}) e gostaria de saber como migrar para a Consultoria Completa.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B1F33] text-white text-xs font-semibold whitespace-nowrap shrink-0 hover:opacity-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Migrar para Completa
                      </a>
                    </div>
                  )}

                  {/* Linha do tempo visual conectada ao Firestore em tempo real */}
                  <ImmigrationStatusTimeline
                    clientId={client?.id}
                    activeCase={activeCase}
                    modality={paidModality}
                    initialDocs={activeDocs}
                    initialDeadlines={deadlines}
                    initialNotifications={notifications}
                    onNavigateTab={(target) => setTab(target)}
                  />
                  </div>
                </div>

                {/* Diagnóstico Inicial & Parecer Técnico Liberado */}
                {(primaryLead || releasedAssessments.length > 0) && (
                  <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="brand-kicker">Dossiê Técnico · Exportável em PDF</p>
                        <h2 className="text-lg font-bold text-[#070E1C] dark:text-white font-brand-sans mt-0.5">
                          Diagnóstico de Viabilidade &amp; Parecer Técnico
                        </h2>
                        <p className="text-xs text-[#475569] dark:text-slate-400">
                          Histórico do seu diagnóstico completo e orientações técnicas liberadas pela consultoria
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 no-print">
                        <button
                          type="button"
                          disabled={pdfBusy !== null}
                          onClick={() => void handlePreviewPdf('diagnostico')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#16233B] whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
                          Pré-visualizar Dossiê
                        </button>
                        <button
                          type="button"
                          disabled={pdfBusy !== null}
                          onClick={() => void handleExportDiagnosticoPdf()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-xs font-semibold text-white hover:opacity-95 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-[#C9A86A]" />
                          {pdfBusy === 'diagnostico' ? 'Gerando PDF...' : 'Baixar Dossiê (PDF 2 Págs)'}
                        </button>
                      </div>
                    </div>

                    {primaryLead && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B] text-xs">
                        <div>
                          <p className="text-[#475569] dark:text-slate-400">Subcategoria sugerida</p>
                          <p className="font-bold text-[#070E1C] dark:text-white mt-0.5">
                            {primaryLead.subcategoriaSugerida || primaryLead.interesse || 'Em análise'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#475569] dark:text-slate-400">Índice de viabilidade</p>
                          <p className="font-bold font-mono text-[#070E1C] dark:text-white mt-0.5 tabular-nums">
                            {typeof primaryLead.notaViabilidade === 'number'
                              ? `${primaryLead.notaViabilidade}/100`
                              : 'Em avaliação'}
                            {primaryLead.confianca ? ` · Confiança ${primaryLead.confianca}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-[#475569] dark:text-slate-400">Realizado em</p>
                          <p className="font-bold font-mono text-[#070E1C] dark:text-white mt-0.5 tabular-nums">
                            {formatDateBR(primaryLead.createdAt)}
                            {primaryLead.versaoRegras ? ` · Regras ${primaryLead.versaoRegras}` : ''}
                          </p>
                        </div>
                      </div>
                    )}

                    {portalRadarDimensions && (
                      <div className="pt-1 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPortalRadar((v) => !v)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-xs font-semibold text-[#070E1C] dark:text-white hover:border-[#0F3D91] dark:hover:border-[#60A5FA] transition-colors"
                          >
                            <Compass className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
                            {showPortalRadar ? 'Ocultar Gráfico Radar (7 Pilares)' : 'Ver Gráfico Radar (7 Pilares)'}
                            {showPortalRadar ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          <span className="text-[11px] text-[#475569] dark:text-slate-400">
                            Motor determinístico SERMIG · 7 dimensões de elegibilidade
                          </span>
                        </div>

                        {showPortalRadar && (
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center p-4 sm:p-5 rounded-xl bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B]">
                            <div className="lg:col-span-5">
                              <DiagnosticRadarChart dimensions={portalRadarDimensions} />
                            </div>
                            <div className="lg:col-span-7 space-y-3">
                              {portalRadarDimensions.map((dim) => (
                                <div key={dim.nome} className="space-y-1">
                                  <div className="flex items-baseline justify-between gap-2 text-xs">
                                    <span className="font-semibold text-[#070E1C] dark:text-white">{dim.nome}</span>
                                    <span className="font-mono font-bold tabular-nums text-[#475569] dark:text-slate-300">
                                      {dim.pontos}/{dim.maximo} pts ({dim.percentual}%)
                                    </span>
                                  </div>
                                  <div className="h-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#1E293B] overflow-hidden">
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${Math.max(4, dim.percentual)}%`,
                                        backgroundColor:
                                          dim.percentual >= 75
                                            ? '#10B981'
                                            : dim.percentual >= 50
                                              ? '#3B82F6'
                                              : '#C9A86A',
                                      }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {releasedAssessments.length > 0 && (
                      <div className="space-y-3 pt-2 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                        <p className="text-xs font-bold text-[#070E1C] dark:text-white">
                          Parecer Técnico Liberado (Versão {releasedAssessments[0].versao} · Nota{' '}
                          <span className="font-mono tabular-nums text-[#0F3D91] dark:text-[#60A5FA]">{releasedAssessments[0].notaGeral}/100</span>)
                        </p>
                        <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {releasedAssessments[0].enquadramentoLegal}
                        </p>
                        {releasedAssessments[0].fundamentacaoNormativa && (
                          <p className="text-xs text-[#070E1C] dark:text-slate-200 whitespace-pre-wrap bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-3.5 leading-relaxed">
                            {releasedAssessments[0].fundamentacaoNormativa}
                          </p>
                        )}
                        <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {releasedAssessments[0].recomendacoes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Documentos emitidos liberados */}
                {genDocs.length > 0 && (
                  <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-3.5">
                    <div>
                      <p className="brand-kicker">Acervo Contratual · Assinatura &amp; A4</p>
                      <h2 className="text-base font-bold text-[#070E1C] dark:text-white mt-0.5">Documentos Oficiais Disponíveis</h2>
                    </div>
                    {genDocs.map((gd) => {
                      const statusLabel = gd.canceladoEm ? 'Cancelado' : gd.status || 'Disponível';
                      return (
                        <div key={gd.id} className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-sm font-bold text-[#070E1C] dark:text-white">{gd.titulo}</p>
                            <p className="text-xs text-[#475569] dark:text-slate-400 font-mono tabular-nums">
                              Status: <strong className="font-sans text-[#070E1C] dark:text-white">{statusLabel}</strong> · v{gd.versao} · {formatDateBR(gd.createdAt)}
                              {gd.codigoVerificacao ? ` · Cód. ${gd.codigoVerificacao}` : ''}
                            </p>
                            {gd.confirmadoLeituraEm && (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                Leitura confirmada em {formatDateTimeBR(gd.confirmadoLeituraEm)}
                              </p>
                            )}
                            {gd.assinadoEm && (
                              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                Assinado em {formatDateTimeBR(gd.assinadoEm)}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setViewingGenDoc(gd)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#16233B]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visualizar / Imprimir A4
                            </button>
                            {!gd.canceladoEm && gd.status !== 'Assinado' && (
                              <button
                                type="button"
                                onClick={() => setSigningGenDoc(gd)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-xs font-semibold text-white hover:opacity-95"
                              >
                                <FileSignature className="w-3.5 h-3.5 text-[#C9A86A]" />
                                Assinar / Anexar Assinado
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Pesquisa NPS após Protocolo (7) ou Aprovação */}
                {activeCase && (activeCase.etapaPipeline >= 7 || activeCase.statusSermig === 'Aprovado') && !activeCase.npsNota && (
                  <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-3.5">
                    <div>
                      <p className="brand-kicker">Qualidade do Atendimento</p>
                      <h2 className="text-base font-bold text-[#070E1C] dark:text-white mt-0.5">
                        Como está sendo sua experiência com a D&amp;M Integra Chile?
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNpsNota(n)}
                          className={`px-3.5 py-2 rounded-lg border text-xs font-bold font-mono inline-flex items-center gap-1 transition-colors ${
                            npsNota === n
                              ? 'bg-[#070E1C] dark:bg-[#0F3D91] text-white border-[#070E1C] dark:border-[#3B82F6]'
                              : 'bg-[#F7F8FA] dark:bg-[#0B1220] text-[#070E1C] dark:text-slate-200 border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#0F3D91]'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${npsNota === n ? 'text-[#C9A86A]' : 'text-[#9A7B3E] dark:text-[#C9A86A]'}`} />
                          {n}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={2}
                      value={npsComent}
                      onChange={(e) => setNpsComent(e.target.value)}
                      placeholder="Deixe um comentário opcional..."
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-sm text-[#070E1C] dark:text-white focus:bg-white dark:focus:bg-[#111B2E] focus:border-[#0F3D91] dark:focus:border-[#60A5FA] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleSendNps}
                      className="px-4 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-xs font-semibold text-white hover:opacity-95"
                    >
                      Enviar avaliação
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: DOCUMENTOS & ENVIO SEGURO */}
            {tab === 'documentos' && (
              <div className="space-y-6">
                {/* Faixa de confirmação de permissão Firestore (Acesso Completo / Orientativa) */}
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-[#070E1C] text-[#C9A86A] flex items-center justify-center shrink-0">
                      <ShieldCheck className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                        Permissão Verificada no Firestore · {planSpec.nome} Liberada
                      </p>
                      <p className="text-xs text-[#475569] dark:text-slate-300 mt-0.5 leading-relaxed">
                        Acesso completo confirmado para <strong className="text-[#0B1628] dark:text-white">{client?.email || userProfile.email}</strong>. Seus documentos oficiais liberados, digitalizações via câmera e checklist do processo estão sincronizados em tempo real.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums shrink-0 text-[#0B1628] dark:text-white">
                    <span className="px-2.5 py-1 rounded-md border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#111C30]">
                      Oficiais: <strong>{genDocs.length + releasedAssessments.length}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-md border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#111C30]">
                      Checklist: <strong>{activeDocs.length}</strong>
                    </span>
                  </div>
                </div>

                {/* Cofre de Documentos Digitalizados via Câmera (/users/{uid}/identityDocuments) */}
                <ProfileIdentityDocumentsCard
                  userProfile={userProfile}
                  title="Documentos Escaneados via Câmera & Identificação"
                  subtitle="Todos os documentos capturados pela câmera ou enviados para seu perfil aparecem aqui com visualização instantânea, edição de metadados e download."
                />

                {(genDocs.length > 0 || releasedAssessments.length > 0) && (
                  <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="brand-kicker">Acervo Liberado pela Consultoria</p>
                        <h2 className="font-display text-lg sm:text-xl font-bold text-[#0B1628] dark:text-white mt-0.5">
                          Documentos Oficiais &amp; Pareceres Disponíveis ({genDocs.length + releasedAssessments.length})
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => void loadPortal()}
                        className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-[#F7F8FA] dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-white dark:hover:bg-[#192842]"
                      >
                        Atualizar lista
                      </button>
                    </div>

                    {genDocs.length > 0 && (
                      <div className="space-y-3">
                        {/* Busca e filtro rápido em tempo real para documentos oficiais */}
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <input
                            type="search"
                            value={officialDocSearch}
                            onChange={(e) => setOfficialDocSearch(e.target.value)}
                            placeholder="Buscar documento oficial por título ou código..."
                            className="flex-1 px-3 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-[#F7F8FA] dark:bg-[#0B1220] text-xs sm:text-sm text-[#0B1628] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/30"
                          />
                          <div className="inline-flex rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] p-0.5 shrink-0">
                            {(
                              [
                                { id: 'todos', label: 'Todos' },
                                { id: 'pendentes', label: 'Pendentes' },
                                { id: 'assinados', label: 'Assinados' },
                              ] as const
                            ).map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setOfficialDocStatusFilter(f.id)}
                                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                  officialDocStatusFilter === f.id
                                    ? 'bg-[#0B1628] dark:bg-[#3B82F6] text-white'
                                    : 'text-[#475569] dark:text-slate-300 hover:text-[#0B1628] dark:hover:text-white'
                                }`}
                              >
                                {f.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {filteredGenDocs.length === 0 ? (
                          <p className="text-xs text-[#64748B] dark:text-slate-400 py-3">
                            Nenhum documento oficial encontrado para o filtro atual.
                          </p>
                        ) : (
                        <div className="space-y-2.5">
                        {filteredGenDocs.map((gd) => {
                          const statusLabel = gd.canceladoEm ? 'Cancelado' : gd.status || 'Disponível';
                          return (
                            <div
                              key={gd.id}
                              className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA]/70 dark:bg-[#0B1220] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-0.5 min-w-0">
                                <p className="text-sm font-bold text-[#0B1628] dark:text-white break-words">{gd.titulo}</p>
                                <p className="text-xs text-[#475569] dark:text-slate-400 font-mono tabular-nums">
                                  Status: <strong className="font-sans text-[#0B1628] dark:text-slate-100">{statusLabel}</strong> · v{gd.versao} · {formatDateBR(gd.createdAt)}
                                  {gd.codigoVerificacao ? ` · Cód. ${gd.codigoVerificacao}` : ''}
                                </p>
                                {gd.confirmadoLeituraEm && (
                                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                    Leitura confirmada em {formatDateTimeBR(gd.confirmadoLeituraEm)}
                                  </p>
                                )}
                                {gd.assinadoEm && (
                                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                                    Assinado em {formatDateTimeBR(gd.assinadoEm)}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setViewingGenDoc(gd)}
                                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#192842]"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Visualizar / Imprimir A4
                                </button>
                                {!gd.canceladoEm && gd.status !== 'Assinado' && (
                                  <button
                                    type="button"
                                    onClick={() => setSigningGenDoc(gd)}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#0B1628] hover:bg-[#152847] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB]"
                                  >
                                    <FileSignature className="w-3.5 h-3.5 text-[#C9A86A] dark:text-white" />
                                    Assinar / Anexar Assinado
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        </div>
                        )}
                      </div>
                    )}

                    {releasedAssessments.length > 0 && (
                      <div className="space-y-2.5 pt-2 border-t border-[#E5DFD2]">
                        {releasedAssessments.map((va) => (
                          <div
                            key={va.id}
                            className="p-4 rounded-xl border border-[#E5DFD2] bg-[#FAF9F6]/70 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-bold text-[#0B1F33]">
                                Parecer Técnico de Viabilidade · Versão {va.versao} ({va.notaGeral}/100)
                              </p>
                              <button
                                type="button"
                                disabled={pdfBusy !== null}
                                onClick={() => void handleExportDiagnosticoPdf()}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0B1F33] text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
                              >
                                <Download className="w-3.5 h-3.5 text-[#E5C76B]" />
                                Baixar Dossiê (PDF)
                              </button>
                            </div>
                            <p className="text-xs text-[#4A5A6D] whitespace-pre-wrap leading-relaxed">
                              {va.enquadramentoLegal}
                            </p>
                            {va.recomendacoes && (
                              <p className="text-xs text-[#0B1F33] whitespace-pre-wrap leading-relaxed">
                                {va.recomendacoes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <SecureDocumentUploadSection
                  client={client}
                  activeCase={activeCase}
                  docs={activeDocs}
                  dependents={dependents}
                  visaRequirements={visaRequirements}
                  userProfile={userProfile}
                  onDocumentUploaded={loadPortal}
                  onOpenBiblioteca={() => setTab('biblioteca')}
                  onOpenLaw={() => setLawOpen(true)}
                  onExportPdf={handleExportProgressoPdf}
                  pdfBusy={pdfBusy}
                />
              </div>
            )}

            {/* ABA: BIBLIOTECA LEGAL */}
            {tab === 'biblioteca' && (
              <PortalBibliotecaLegal
                legalSources={legalSources}
                visaCategories={visaCategories}
                visaRequirements={visaRequirements}
                activeCase={activeCase}
              />
            )}

            {/* ABA: SIMULADOR SERMIG (Somente quando liberado pelo administrador) */}
            {tab === 'simulador' && canAccessSimulator && (
              <SermigSimulator
                mode="client"
                visaCategories={visaCategories}
                visaRequirements={visaRequirements}
                empresa={empresa}
                client={resolvedClient}
                activeCase={activeCase}
                dependents={dependents}
              />
            )}

            {/* ABA 3: ORÇAMENTOS & FINANCEIRO */}
            {tab === 'financeiro' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-4">
                  <div>
                    <p className="brand-kicker">Propostas Comerciais</p>
                    <h2 className="font-display text-xl font-bold text-[#070E1C] dark:text-white mt-0.5">Orçamentos Recebidos</h2>
                  </div>
                  {budgets.length === 0 ? (
                    <p className="text-sm text-[#475569] dark:text-slate-400">Nenhum orçamento enviado até o momento.</p>
                  ) : (
                    budgets.map((b) => (
                      <div key={b.id} className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-mono text-[#475569] dark:text-slate-400 tabular-nums">
                              Nº {b.numeroOrcamento} · Validade {formatDateBR(b.validade)} · Status: <strong className="font-sans text-[#070E1C] dark:text-white">{b.status}</strong>
                            </p>
                            <h3 className="text-base font-bold text-[#070E1C] dark:text-white mt-0.5">{b.titulo}</h3>
                          </div>
                          <p className="font-mono text-lg font-bold tabular-nums text-[#070E1C] dark:text-white">
                            {formatCurrency(b.totalGeral, b.moedaPrincipal)}
                          </p>
                        </div>
                        <p className="text-xs text-[#475569] dark:text-slate-400">{b.condicoesPagamento}</p>
                        {b.status === 'Enviado ao Cliente' && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => handleBudgetDecision(b, 'Aprovado')}
                              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800"
                            >
                              Aprovar orçamento
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBudgetDecision(b, 'Recusado')}
                              className="px-4 py-2 rounded-lg text-xs font-semibold border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#111B2E] text-[#070E1C] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#16233B]"
                            >
                              Recusar
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* Pix e Pagamento */}
                {(empresa.chavePix || empresa.linkPagamentoCartao) && (
                  <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-3.5">
                    <div>
                      <p className="brand-kicker">Canais de Quitação</p>
                      <h2 className="text-base font-bold text-[#070E1C] dark:text-white mt-0.5">Opções de Pagamento</h2>
                    </div>
                    {empresa.chavePix && (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B]">
                        <div className="text-xs">
                          <span className="font-semibold text-[#9A7B3E] dark:text-[#C9A86A] uppercase tracking-wider text-[10px] block">Chave Pix Oficial</span>
                          <span className="font-mono text-sm font-semibold text-[#070E1C] dark:text-white">{empresa.chavePix}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(empresa.chavePix);
                            setPixCopied(true);
                            setTimeout(() => setPixCopied(false), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-xs font-semibold text-white hover:opacity-95"
                        >
                          <Copy className="w-3.5 h-3.5 text-[#C9A86A]" />
                          {pixCopied ? 'Copiado!' : 'Copiar Pix'}
                        </button>
                      </div>
                    )}
                    {empresa.linkPagamentoCartao && (
                      <a
                        href={empresa.linkPagamentoCartao}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C9A86A] text-xs font-bold text-[#070E1C] hover:opacity-95"
                      >
                        Pagar com Cartão
                      </a>
                    )}
                  </div>
                )}

                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-3.5">
                  <div>
                    <p className="brand-kicker">Extrato do Processo</p>
                    <h2 className="text-base font-bold text-[#070E1C] dark:text-white mt-0.5">Parcelas e Lançamentos</h2>
                  </div>
                  {financials.length === 0 ? (
                    <p className="text-sm text-[#475569] dark:text-slate-400">Nenhuma parcela lançada.</p>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B]">
                      {financials.map((f) => (
                        <div key={f.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#070E1C] dark:text-white">{f.descricao}</p>
                            <p className="text-xs text-[#475569] dark:text-slate-400 font-mono tabular-nums">
                              {f.tipo} · Venc. {formatDateBR(f.vencimento)} · <strong className="font-sans text-[#070E1C] dark:text-white">{f.status}</strong>
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold tabular-nums text-[#070E1C] dark:text-white">
                              {formatCurrency(f.valor, f.moeda)}
                            </span>
                            <label className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-white cursor-pointer hover:bg-white dark:hover:bg-[#16233B]">
                              {f.comprovanteUrl ? 'Atualizar comprovante' : 'Anexar comprovante'}
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleUploadComprovante(f, file);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 4: AGENDAMENTO & SUPORTE */}
            {tab === 'suporte' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="brand-kicker">Atendimento Especializado</p>
                    <h2 className="font-display text-xl font-bold text-[#070E1C] dark:text-white mt-0.5">Agendamento e Canais de Atendimento</h2>
                    <p className="text-xs text-[#475569] dark:text-slate-400 mt-0.5">Marque reuniões, adicione prazos ao Google Agenda ou tire dúvidas no WhatsApp.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCalendlyOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-xs font-semibold text-white hover:opacity-95"
                    >
                      <Calendar className="w-4 h-4 text-[#C9A86A]" />
                      Agendar no Calendly
                    </button>
                    <a
                      href={buildWhatsAppUrl(empresa.whatsapp, `Olá! Sou ${client?.nomeCompleto} e gostaria de falar sobre meu processo.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Falar no WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => setTab('biblioteca')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#16233B]"
                    >
                      <Scale className="w-4 h-4 text-[#9A7B3E] dark:text-[#C9A86A]" />
                      Biblioteca Legal SERMIG
                    </button>
                    <button
                      type="button"
                      onClick={() => setLawOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#16233B]"
                    >
                      <BookOpen className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA]" />
                      Entenda a Lei
                    </button>
                  </div>
                </div>

                {/* Reuniões e Prazos com Google Agenda e .ics */}
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-3.5">
                  <div>
                    <p className="brand-kicker">Agenda do Processo</p>
                    <h3 className="text-base font-bold text-[#070E1C] dark:text-white mt-0.5">Minhas Reuniões e Prazos</h3>
                  </div>
                  {appointments.length === 0 && deadlines.length === 0 ? (
                    <p className="text-sm text-[#475569] dark:text-slate-400">Nenhuma reunião ou prazo cadastrado ainda.</p>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B]">
                      {appointments.map((apt) => (
                        <div key={apt.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#070E1C] dark:text-white">{apt.titulo}</p>
                            <p className="text-xs font-mono text-[#475569] dark:text-slate-400 tabular-nums">
                              {formatDateTimeBR(apt.dataHoraInicio)} · <span className="font-sans">{apt.status}</span>
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <a
                              href={buildGoogleCalendarUrl({ title: apt.titulo, startIso: apt.dataHoraInicio })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#16233B]"
                            >
                              Google Agenda
                            </a>
                            <button
                              type="button"
                              onClick={() => downloadIcsFile({ title: apt.titulo, startIso: apt.dataHoraInicio })}
                              className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-white dark:hover:bg-[#16233B]"
                            >
                              Baixar .ics
                            </button>
                          </div>
                        </div>
                      ))}
                      {deadlines.map((dl) => (
                        <div key={dl.id} className="py-3.5 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#070E1C] dark:text-white">{dl.titulo}</p>
                            <p className="text-xs font-mono text-[#475569] dark:text-slate-400 tabular-nums">
                              <span className="font-sans">{dl.tipo}</span> · Data limite: {formatDateBR(dl.dataLimite)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => downloadIcsFile({ title: dl.titulo, startIso: dl.dataLimite })}
                            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-white dark:hover:bg-[#16233B]"
                          >
                            Baixar .ics
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Parceiros recomendados */}
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-3.5">
                  <div className="flex items-center gap-2">
                    <Handshake className="w-5 h-5 text-[#9A7B3E] dark:text-[#C9A86A]" />
                    <h3 className="text-base font-bold text-[#070E1C] dark:text-white">Parceiros Recomendados</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {partnersPublic.map((p) => (
                      <div key={p.id} className="p-4 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220]">
                        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#9A7B3E] dark:text-[#C9A86A]">{p.categoria} · {p.pais}</p>
                        <p className="text-sm font-bold text-[#070E1C] dark:text-white mt-1">{p.nome}</p>
                        <p className="text-xs text-[#475569] dark:text-slate-400 mt-1 leading-relaxed">{p.descricaoPublica}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ABA 5: MEUS DADOS & LGPD */}
            {tab === 'dados' && (
              <div className="space-y-6">
                <form onSubmit={handleSavePersonalData} className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <User className="w-5 h-5 text-[#0F3D91] dark:text-[#60A5FA]" />
                    <h2 className="font-display text-xl font-bold text-[#070E1C] dark:text-white">Meus Dados Cadastrais</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#070E1C] dark:text-slate-200 mb-1.5" htmlFor="pt-nome">Nome completo</label>
                      <input id="pt-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-sm text-[#070E1C] dark:text-white focus:bg-white dark:focus:bg-[#111B2E] focus:border-[#0F3D91] dark:focus:border-[#60A5FA] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#070E1C] dark:text-slate-200 mb-1.5" htmlFor="pt-whats">WhatsApp</label>
                      <input id="pt-whats" value={editWhats} onChange={(e) => setEditWhats(maskPhoneBR(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-sm font-mono tabular-nums text-[#070E1C] dark:text-white focus:bg-white dark:focus:bg-[#111B2E] focus:border-[#0F3D91] dark:focus:border-[#60A5FA] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#070E1C] dark:text-slate-200 mb-1.5" htmlFor="pt-prof">Profissão</label>
                      <input id="pt-prof" value={editProfissao} onChange={(e) => setEditProfissao(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-sm text-[#070E1C] dark:text-white focus:bg-white dark:focus:bg-[#111B2E] focus:border-[#0F3D91] dark:focus:border-[#60A5FA] focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#070E1C] dark:text-slate-200 mb-1.5" htmlFor="pt-end">Endereço completo</label>
                      <input id="pt-end" value={editEndereco} onChange={(e) => setEditEndereco(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-sm text-[#070E1C] dark:text-white focus:bg-white dark:focus:bg-[#111B2E] focus:border-[#0F3D91] dark:focus:border-[#60A5FA] focus:outline-none" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-xs font-semibold text-white hover:opacity-95 transition-opacity"
                  >
                    Salvar alterações
                  </button>
                </form>

                {userProfile && <ProfileIdentityDocumentsCard userProfile={userProfile} />}

                {dependents.length > 0 && (
                  <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-2.5">
                    <p className="brand-kicker">Núcleo Familiar</p>
                    <h3 className="text-base font-bold text-[#070E1C] dark:text-white">Dependentes Vinculados</h3>
                    <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B]">
                      {dependents.map((dep) => (
                        <p key={dep.id} className="py-2 text-sm text-[#070E1C] dark:text-white">
                          <strong>{dep.nomeCompleto}</strong> <span className="text-[#475569] dark:text-slate-400">· {dep.parentesco}</span>
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-5 h-5 text-[#9A7B3E] dark:text-[#C9A86A]" />
                    <h3 className="text-base font-bold text-[#070E1C] dark:text-white">Privacidade e Direitos LGPD (Lei nº 13.709/2018)</h3>
                  </div>
                  <p className="text-xs text-[#475569] dark:text-slate-400 font-mono tabular-nums">
                    Consentimento registrado na versão {client?.lgpdVersao || empresa.termoLgpdVersao}
                    {client?.lgpdAceitoEm ? ` em ${formatDateTimeBR(client.lgpdAceitoEm)}` : ''}.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleLgpdRequest('exportação')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#16233B]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Solicitar exportação de dados
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLgpdRequest('exclusão')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 dark:border-red-900/50 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Solicitar exclusão de dados
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="bg-white dark:bg-[#0B1220] border-t border-[#E5E7EB] dark:border-[#1E293B] py-5 px-4 sm:px-6 text-xs text-[#475569] dark:text-slate-400 text-center mb-16 md:mb-0">
        {empresa.avisoLegal}
      </footer>

      {/* Barra inferior mobile fixa com >=48px touch targets */}
      <nav
        aria-label="Navegação rápida do portal"
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0B1220]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[#1E293B] grid ${
          canAccessSimulator ? 'grid-cols-7' : 'grid-cols-6'
        } no-print shadow-[0_-4px_16px_rgba(7,14,28,0.08)]`}
      >
        {[
          { id: 'processo', label: 'Processo', icon: <Briefcase className="w-4 h-4" /> },
          { id: 'documentos', label: 'Docs', icon: <FolderOpen className="w-4 h-4" /> },
          { id: 'biblioteca', label: 'Normas', icon: <Scale className="w-4 h-4" /> },
          ...(canAccessSimulator
            ? [{ id: 'simulador', label: 'Simulador', icon: <Calculator className="w-4 h-4" /> }]
            : []),
          { id: 'financeiro', label: 'Financeiro', icon: <CreditCard className="w-4 h-4" /> },
          { id: 'suporte', label: 'Suporte', icon: <HelpCircle className="w-4 h-4" /> },
          { id: 'dados', label: 'Dados', icon: <User className="w-4 h-4" /> },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as PortalTab)}
              className={`relative min-h-[54px] min-w-0 px-0.5 flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors ${
                active
                  ? 'text-[#0F3D91] dark:text-[#60A5FA] bg-[#F7F8FA] dark:bg-[#111C30]'
                  : 'text-[#64748B] dark:text-slate-400'
              }`}
            >
              {active && <span className="absolute top-0 inset-x-1.5 h-[2.5px] bg-[#0F3D91] dark:bg-[#3B82F6] rounded-b" aria-hidden="true" />}
              {item.icon}
              <span className="max-w-full truncate leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal Visualização / Impressão A4 Documento Oficial */}
      {viewingGenDoc && (
        <div className="fixed inset-0 z-50 bg-[#071422]/75 backdrop-blur-[2px] flex items-center justify-center p-4 print-modal-backdrop" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5DFD2] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl print-modal-dialog">
            <BrandRibbon className="h-[3px] w-full shrink-0 no-print" />
            <div className="px-5 py-4 bg-[#0B1F33] text-white flex items-center justify-between gap-3 no-print shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">Documento Oficial A4</p>
                <p className="font-display text-base font-bold text-white truncate mt-0.5">{viewingGenDoc.titulo}</p>
                <p className="text-[11px] font-mono text-slate-300 tabular-nums">
                  Versão {viewingGenDoc.versao} · Código {viewingGenDoc.codigoVerificacao || viewingGenDoc.id}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {!viewingGenDoc.confirmadoLeituraEm && (
                  <button
                    type="button"
                    onClick={() => void handleConfirmGenDocRead(viewingGenDoc)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    Confirmar leitura
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const { exportGeneratedOfficialDocPdf } = await import('../components/pdf/ClientPortalPdfDocuments');
                      await exportGeneratedOfficialDocPdf({
                        empresa,
                        titulo: viewingGenDoc.titulo,
                        conteudo: viewingGenDoc.conteudoHtml,
                        codigoVerificacao: viewingGenDoc.codigoVerificacao || viewingGenDoc.id,
                        versao: viewingGenDoc.versao,
                        status: viewingGenDoc.status,
                        clienteNome: client?.nomeCompleto,
                        assinaturaDataUrl: viewingGenDoc.assinaturaDataUrl,
                        assinadoEm: viewingGenDoc.assinadoEm,
                        confirmadoLeituraEm: viewingGenDoc.confirmadoLeituraEm,
                        canceladoMotivo: viewingGenDoc.canceladoEm ? viewingGenDoc.motivoCancelamento : undefined,
                      });
                    } catch (err) {
                      reportAppError(err, { source: 'pdf' });
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C8A236] hover:bg-[#d6b145] text-[#0B1523] text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar PDF A4
                </button>
                <UiButton type="button" size="sm" variant="outline" onClick={() => window.print()} className="!bg-white/10 !border-white/20 !text-white hover:!bg-white/20">
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </UiButton>
                <button type="button" onClick={() => setViewingGenDoc(null)} className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 sm:p-8 overflow-y-auto space-y-5 text-xs text-[#0B1F33] print-modal-scroll">
              <div className="flex items-center justify-between border-b border-[#E5DFD2] pb-4">
                <div>
                  <p className="text-sm font-bold text-[#0B1F33]">{empresa.nome_empresa}</p>
                  <p className="text-[11px] font-mono text-[#4A5A6D]">{empresa.razao_social_cnpj_rut}</p>
                </div>
                <QrCodeSvg value={viewingGenDoc.codigoVerificacao || viewingGenDoc.id} size={56} />
              </div>
              <div
                className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingGenDoc.conteudoHtml) }}
              />
              {viewingGenDoc.assinaturaDataUrl && (
                <div className="pt-4 border-t border-[#E5DFD2] print-avoid-break">
                  <p className="text-[11px] font-semibold text-[#4A5A6D] mb-1">Assinatura registrada:</p>
                  <img src={viewingGenDoc.assinaturaDataUrl} alt="Assinatura" className="h-16 border border-[#E5DFD2] rounded bg-white" />
                </div>
              )}
              <p className="text-[10px] text-[#4A5A6D] pt-3 border-t border-[#E5DFD2]">{empresa.avisoLegal}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Assinatura / Anexo de Documento Oficial */}
      {signingGenDoc && (
        <div className="fixed inset-0 z-50 bg-[#071422]/75 backdrop-blur-[2px] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5DFD2] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <BrandRibbon className="h-[3px] w-full" />
            <div className="px-6 py-4 bg-[#0B1F33] text-white flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">Assinatura Digital</p>
                <h3 className="font-display text-base font-bold text-white mt-0.5">Assinar ou Anexar Documento Assinado</h3>
              </div>
              <button type="button" onClick={() => setSigningGenDoc(null)} className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs text-[#4A5A6D] leading-relaxed">
                Desenhe sua assinatura digital abaixo ou envie o PDF assinado manualmente / via Gov.br para <strong className="text-[#0B1F33]">{signingGenDoc.titulo}</strong>.
              </p>
              <DrawSignaturePad
                disabled={signBusy}
                onSave={(dataUrl) => void handleSignGenDocCanvas(signingGenDoc, dataUrl)}
              />
              <div className="pt-3 border-t border-[#E5DFD2] flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DDD6C7] bg-[#FAF9F6] text-xs font-semibold text-[#0B1F33] cursor-pointer hover:bg-white">
                  <Upload className="w-3.5 h-3.5 text-[#8C6D14]" />
                  {signBusy ? 'Enviando...' : 'Ou enviar PDF assinado'}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    disabled={signBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleUploadSignedGenDocPdf(signingGenDoc, f);
                    }}
                  />
                </label>
                <button type="button" onClick={() => setSigningGenDoc(null)} className="px-3 py-2 text-xs font-semibold text-[#4A5A6D] hover:text-[#0B1F33]">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal obrigatório LGPD no 1º acesso */}
      {needsLgpdAccept && (
        <div className="fixed inset-0 z-50 bg-[#071422]/75 backdrop-blur-[2px] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5DFD2] rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl">
            <BrandRibbon className="h-[3px] w-full" />
            <div className="px-6 py-4 bg-[#0B1F33] text-white flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#E5C76B] shrink-0" />
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">Lei nº 13.709/2018</p>
                <h2 className="font-display text-lg font-bold text-white">
                  Aceite LGPD Obrigatório (Versão {empresa.termoLgpdVersao})
                </h2>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="max-h-60 overflow-y-auto p-4 rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] text-xs text-[#0B1F33] whitespace-pre-wrap leading-relaxed">
                {empresa.termoLgpd}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAcceptLgpd}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-95"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Li e aceito o Termo LGPD
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <PdfPreviewModal
        open={Boolean(pdfPreview)}
        title={pdfPreview?.title || 'Pré-visualização PDF'}
        filename={pdfPreview?.filename || 'relatorio.pdf'}
        blobUrl={pdfPreview?.blobUrl || null}
        onClose={closePdfPreview}
        onDownload={() => {
          if (!pdfPreview) return;
          const a = document.createElement('a');
          a.href = pdfPreview.blobUrl;
          a.download = pdfPreview.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }}
      />

      <CalendlyModal open={calendlyOpen} onClose={() => setCalendlyOpen(false)} clientId={client?.id} caseId={activeCase?.id} onConfirmed={loadPortal} />
      <LegalBaseModal open={lawOpen} onClose={() => setLawOpen(false)} title="Entenda a Lei" sources={legalSources} clientFriendlyOnly />

      {/* Central de Notificações do Processo */}
      {notifDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-[#071422]/75 backdrop-blur-[2px] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-[#E5DFD2] rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <BrandRibbon className="h-[3px] w-full shrink-0" />
            <div className="px-5 py-4 bg-[#0B1F33] text-white flex items-center justify-between gap-3 shrink-0">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">Central de Alertas</p>
                <h3 className="font-display text-base font-bold text-white flex items-center gap-2 mt-0.5">
                  <Bell className="w-4 h-4 text-[#E5C76B]" />
                  Atualizações do Processo
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Histórico de movimentações de etapa, SERMIG, documentos e pareceres liberados
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllClientNotificationsRead(notifications)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    <Check className="w-3.5 h-3.5 text-[#E5C76B]" />
                    Marcar todas como lidas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                  aria-label="Fechar central de notificações"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 bg-[#FAF9F6]">
              {notifications.length === 0 ? (
                <p className="text-sm text-[#4A5A6D] py-8 text-center">
                  Nenhuma notificação registrada para o seu processo até o momento.
                </p>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      notif.lida ? 'bg-white border-[#E5DFD2]' : 'bg-white border-[#C8A236]/70 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C6D14]">
                            {getNotificationTypeLabel(notif.tipo)}
                          </span>
                          <span className="text-[11px] font-mono text-[#4A5A6D] tabular-nums">
                            {formatDateTimeBR(notif.createdAt)}
                          </span>
                          {!notif.lida && (
                            <span className="text-[10px] font-bold text-[#A61C2B] uppercase">Nova</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-[#0B1F33]">{notif.titulo}</p>
                        <p className="text-xs text-[#4A5A6D] whitespace-pre-wrap leading-relaxed">{notif.mensagem}</p>
                      </div>
                      <div className="shrink-0 flex flex-col sm:flex-row items-end sm:items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleOpenNotificationItem(notif)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DDD6C7] bg-white text-[11px] font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] whitespace-nowrap"
                        >
                          Abrir aba
                        </button>
                        {!notif.lida && (
                          <button
                            type="button"
                            onClick={() => void markClientNotificationRead(notif.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DDD6C7] bg-[#FAF9F6] text-[11px] font-semibold text-[#0B1F33] hover:bg-white whitespace-nowrap"
                          >
                            <Check className="w-3 h-3" />
                            Marcar lida
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <DocumentChatWidget
        client={client}
        activeCase={activeCase}
        docs={activeDocs}
        userProfile={userProfile}
        onPortalToast={(msg) => setFeedbackMsg(msg)}
      />
    </div>
  );
};
