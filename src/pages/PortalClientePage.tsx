import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  BellOff,
  BellRing,
  BookOpen,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileSignature,
  FileText,
  FolderOpen,
  Handshake,
  HelpCircle,
  LogOut,
  MessageCircle,
  Printer,
  Scale,
  Shield,
  Star,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { CalendlyModal } from '../components/CalendlyModal';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { PdfPreviewModal } from '../components/pdf/PdfPreviewModal';
import { DocumentChatWidget } from '../components/portal/DocumentChatWidget';
import { PortalBibliotecaLegal } from '../components/portal/PortalBibliotecaLegal';
import { DrawSignaturePad, QrCodeSvg, UiButton } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';
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
  getBrowserPushSupport,
  getEffectiveVapidKey,
  hasActivePushTokenForUser,
  markAllClientNotificationsRead,
  markClientNotificationRead,
  registerClientPushToken,
  subscribeClientNotifications,
  subscribeForegroundFcm,
  type BrowserPushSupport,
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
  ViabilityAssessment,
} from '../types/domain';
import { calcularTermometroDocumentos } from '../utils/caseMetrics';
import { resolveDocumentExpiration } from '../utils/documentExpiration';
import {
  buildGoogleCalendarUrl,
  buildWhatsAppUrl,
  downloadIcsFile,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  formatStandardDocFilename,
  maskPhoneBR,
  sanitizeHtml,
} from '../utils/formatters';
import {
  CONSULTANCY_PLANS,
  mapPipelineStepToOrientativaStep,
  ORIENTATIVA_STAGES,
  resolveClientPortalAccess,
} from '../utils/portalAccess';
import { BrandLogo } from '../components/BrandLogo';

interface PortalClientePageProps {
  onNavigate: (path: string) => void;
}

type PortalTab = 'processo' | 'documentos' | 'biblioteca' | 'financeiro' | 'suporte' | 'dados';

export const PortalClientePage: React.FC<PortalClientePageProps> = ({ onNavigate }) => {
  const { userProfile, empresa, partnersPublic, legalSources, visaCategories, visaRequirements, logout } = useApp();
  const [tab, setTab] = useState<PortalTab>('processo');
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
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
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState<'diagnostico' | 'progresso' | 'preview' | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; filename: string; blobUrl: string } | null>(null);
  const [viewingGenDoc, setViewingGenDoc] = useState<GeneratedDocument | null>(null);
  const [signingGenDoc, setSigningGenDoc] = useState<GeneratedDocument | null>(null);
  const [signBusy, setSignBusy] = useState(false);

  const [notifications, setNotifications] = useState<ClientNotification[]>([]);
  const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
  const [pushSupport, setPushSupport] = useState<BrowserPushSupport>({ supported: false, permission: 'unsupported' });
  const [pushActive, setPushActive] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushToast, setPushToast] = useState<{ title: string; body: string } | null>(null);

  // Edição de dados próprios e dependentes
  const [editNome, setEditNome] = useState('');
  const [editWhats, setEditWhats] = useState('');
  const [editEndereco, setEditEndereco] = useState('');
  const [editProfissao, setEditProfissao] = useState('');
  const [npsNota, setNpsNota] = useState(5);
  const [npsComent, setNpsComent] = useState('');

  const loadPortal = useCallback(async () => {
    if (!userProfile?.clientId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchClientPortalData(userProfile.clientId);
      setClient(data.client);
      setDependents(data.dependents);
      setCases(data.cases);
      setDocs(data.caseDocuments);
      setDeadlines(data.deadlines);
      setAppointments(data.appointments);
      setAssessments(data.viabilityAssessments);
      setBudgets(data.budgets);
      setFinancials(data.financialRecords);
      setGenDocs(data.generatedDocuments);
      setClientLeads(data.leads);
      if (data.client) {
        setEditNome(data.client.nomeCompleto || '');
        setEditWhats(data.client.whatsapp || '');
        setEditEndereco(data.client.enderecoCompleto || '');
        setEditProfissao(data.client.profissao || '');
      }
    } finally {
      setLoading(false);
    }
  }, [userProfile?.clientId]);

  useEffect(() => {
    void loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    if (!userProfile?.clientId || !userProfile?.uid) return;
    let active = true;

    void getBrowserPushSupport().then((support) => {
      if (active) setPushSupport(support);
    });
    void hasActivePushTokenForUser(userProfile.uid)
      .then((hasTok) => {
        if (active) setPushActive(hasTok && typeof Notification !== 'undefined' && Notification.permission === 'granted');
      })
      .catch(() => undefined);

    const unsubNotifs = subscribeClientNotifications(
      userProfile.clientId,
      (list) => {
        if (active) setNotifications(list);
      },
    );

    const unsubFcm = subscribeForegroundFcm((payload) => {
      if (!active) return;
      const title = payload.notification?.title || payload.data?.title || 'Atualização do Processo';
      const body = payload.notification?.body || payload.data?.body || 'Seu processo teve uma nova movimentação.';
      setPushToast({ title, body });
      void loadPortal();
    });

    return () => {
      active = false;
      unsubNotifs();
      unsubFcm();
    };
  }, [userProfile?.clientId, userProfile?.uid, loadPortal]);

  if (!userProfile || userProfile.role !== 'cliente' || !userProfile.clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Portal do Cliente</h1>
          <p className="text-sm text-slate-600">
            Seu acesso ainda não está vinculado a um processo ativo ou aguarda liberação pelo consultor.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/acompanhar')}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Voltar para autenticação
          </button>
        </div>
      </div>
    );
  }

  const activeCase = cases[0] || null;
  const accessResolution = resolveClientPortalAccess({
    userProfile,
    client,
    activeCase,
    leads: clientLeads,
  });

  if (!loading && client && accessResolution.kind !== 'active_paid') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Acesso ao Portal Pendente</h1>
          <p className="text-sm text-slate-600">
            {accessResolution.kind === 'inactive'
              ? accessResolution.reason
              : 'O acesso completo ao seu Portal do Cliente está pendente de liberação pela consultoria.'}
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/acompanhar')}
            className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Ver resumo do acesso
          </button>
        </div>
      </div>
    );
  }

  const paidModality = accessResolution.kind === 'active_paid' ? accessResolution.modality : 'completa';
  const planSpec = CONSULTANCY_PLANS[paidModality];
  const isOrientativa = paidModality === 'orientativa';
  const orientativaCurrentStep = mapPipelineStepToOrientativaStep(activeCase?.etapaPipeline || 1);

  const activeDocs = activeCase ? docs.filter((d) => d.caseId === activeCase.id) : docs;
  const primaryLead = clientLeads[0] || null;
  const releasedAssessments = activeCase?.relatorioViabilidadeLiberado ? assessments : [];
  const thermo = calcularTermometroDocumentos(activeDocs, empresa.bloqueioProtocoloMinimo || 100);
  const needsLgpdAccept =
    client && (!client.lgpdAceito || client.lgpdVersao !== (empresa.termoLgpdVersao || '1.0'));
  const unreadNotifCount = notifications.filter((n) => !n.lida).length;
  const effectiveVapidKey = getEffectiveVapidKey(empresa);

  const handleEnablePush = async () => {
    if (!userProfile?.uid || !userProfile?.clientId || pushBusy) return;
    setPushBusy(true);
    setFeedbackMsg(null);
    try {
      await registerClientPushToken({
        uid: userProfile.uid,
        clientId: userProfile.clientId,
        vapidKey: effectiveVapidKey,
      });
      setPushActive(true);
      setPushSupport(await getBrowserPushSupport());
      setFeedbackMsg('Notificações push ativadas! Você será alertado sobre mudanças no seu processo.');
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
      setFeedbackMsg('Notificações push desativadas neste dispositivo.');
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Não foi possível desativar as notificações push.');
    } finally {
      setPushBusy(false);
    }
  };

  const handleExportDiagnosticoPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy('diagnostico');
    setFeedbackMsg(null);
    try {
      const { exportDiagnosticoPdf } = await import('../components/pdf/ClientPortalPdfDocuments');
      const filename = await exportDiagnosticoPdf({
        empresa,
        client,
        dependents,
        activeCase,
        lead: primaryLead,
        assessments: releasedAssessments,
      });
      setFeedbackMsg(`Diagnóstico exportado em PDF (${filename}).`);
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
      const mod = await import('../components/pdf/ClientPortalPdfDocuments');
      const { blob, filename } =
        kind === 'diagnostico'
          ? await mod.buildDiagnosticoPdfBlob({
              empresa,
              client,
              dependents,
              activeCase,
              lead: primaryLead,
              assessments: releasedAssessments,
            })
          : await mod.buildProgressoPdfBlob({
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
          title: kind === 'diagnostico' ? 'Pré-visualização: Diagnóstico & Viabilidade' : 'Pré-visualização: Relatório de Progresso',
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

  const handleUploadDoc = async (docItem: CaseDocument, file: File) => {
    setUploadingDocId(docItem.id);
    setFeedbackMsg(null);
    try {
      const uploaded = await uploadFileToServer(file);
      const prevHist = docItem.historicoVersoes || [];
      const nextHist = docItem.arquivoUrl
        ? [...prevHist, { versao: docItem.versao, arquivoUrl: docItem.arquivoUrl, data: new Date().toISOString() }]
        : prevHist;
      await saveDocumentAudited(
        'caseDocuments',
        docItem.id,
        {
          ...docItem,
          arquivoUrl: uploaded.url,
          arquivoNome: uploaded.filename,
          status: 'Enviado',
          etapaEsteira: '2 Recebido/Triagem',
          versao: docItem.arquivoUrl ? docItem.versao + 1 : docItem.versao,
          historicoVersoes: nextHist,
        },
        false,
        'cliente',
        'arquivoUrl',
        docItem.arquivoUrl,
      );
      setFeedbackMsg(`Documento "${docItem.nomeDocumento}" enviado com sucesso!`);
      await loadPortal();
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Falha no envio do documento.');
    } finally {
      setUploadingDocId(null);
    }
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
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header do Portal */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo
              src={empresa.logoUrl}
              alt={empresa.nome_empresa}
              brandShortName={empresa.nome_empresa.split('–')[0].trim()}
              imgClassName="h-8 w-auto max-w-[130px] object-contain shrink-0"
              fallbackClassName="w-8 h-8 btn-radius flex items-center justify-center text-xs font-bold text-white shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">
                Portal do Cliente · {planSpec.nome}
              </p>
              <p className="text-xs text-slate-500 truncate">{client?.nomeCompleto || userProfile.nome}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setNotifDrawerOpen(true)}
              aria-label="Abrir central de notificações do processo"
              className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Bell className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span className="hidden sm:inline">Alertas</span>
              {unreadNotifCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded bg-[#C82333] text-white text-[10px] font-bold tabular-nums">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Site público
            </button>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>

        {/* Abas desktop/tablet */}
        <nav className="hidden md:flex max-w-6xl mx-auto px-4 sm:px-6 items-center gap-1 overflow-x-auto border-t border-slate-100 no-print">
          {[
            { id: 'processo', label: 'Meu Processo & Etapas' },
            { id: 'documentos', label: 'Documentos & Prioridades' },
            { id: 'biblioteca', label: 'Biblioteca Legal' },
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
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)] font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-8 space-y-6">
        {pushToast && (
          <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-700 flex items-start justify-between gap-3 shadow-md">
            <div className="flex items-start gap-3">
              <BellRing className="w-5 h-5 text-[var(--color-accent)] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Nova atualização do processo</p>
                <p className="text-sm font-semibold mt-0.5">{pushToast.title}</p>
                <p className="text-xs text-slate-200 mt-0.5">{pushToast.body}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPushToast(null)}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 shrink-0"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {feedbackMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-900 flex items-center justify-between gap-2">
            <span>{feedbackMsg}</span>
            <button type="button" onClick={() => setFeedbackMsg(null)} className="text-xs underline">
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
                {/* Card de Notificações Push FCM & Últimos Alertas */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      {pushActive ? (
                        <BellRing className="w-5 h-5 text-[#1E7E34]" />
                      ) : (
                        <Bell className="w-5 h-5 text-[var(--color-primary)]" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Notificações em Tempo Real do Processo
                        {pushActive ? ' · Push Ativo' : ''}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {!pushSupport.supported
                          ? 'Alertas disponíveis na Central de Notificações do Portal (este navegador não suporta push em segundo plano).'
                          : pushSupport.permission === 'denied'
                            ? 'As notificações push estão bloqueadas nas permissões do navegador; libere no ícone de cadeado da barra de endereço.'
                            : !effectiveVapidKey
                              ? 'Alertas em tempo real ativos no Portal. Para push em segundo plano, aguarde a configuração da chave Web Push pelo administrador.'
                              : pushActive
                                ? 'Você receberá alertas automáticos neste dispositivo quando houver mudança de etapa, status SERMIG ou documento analisado.'
                                : 'Ative os alertas push para ser avisado imediatamente sobre atualizações de etapa, SERMIG e análise de documentos.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setNotifDrawerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <Bell className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      Ver histórico ({notifications.length})
                    </button>
                    {pushSupport.supported && effectiveVapidKey && pushSupport.permission !== 'denied' && (
                      pushActive ? (
                        <button
                          type="button"
                          disabled={pushBusy}
                          onClick={() => void handleDisablePush()}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap disabled:opacity-50"
                        >
                          <BellOff className="w-3.5 h-3.5" />
                          {pushBusy ? 'Atualizando...' : 'Desativar Push'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={pushBusy}
                          onClick={() => void handleEnablePush()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          {pushBusy ? 'Ativando...' : 'Ativar Alertas Push'}
                        </button>
                      )
                    )}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        {planSpec.nome}
                        {activeCase
                          ? isOrientativa
                            ? ` · ${activeCase.tipoServico} · Protocolo conduzido pelo cliente`
                            : ` · ${activeCase.tipoServico} · SERMIG: ${activeCase.statusSermig}`
                          : ' · Processo em estruturação'}
                      </p>
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                        {activeCase?.titulo || 'Acompanhamento de Residência no Chile'}
                      </h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-left sm:text-right mr-2">
                        <p className="text-xs text-slate-500">Prontidão Documental</p>
                        <p className="text-2xl font-bold tabular-nums" style={{ color: thermo.corHex }}>
                          {thermo.notaGeral}%
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 no-print">
                        <button
                          type="button"
                          disabled={pdfBusy !== null}
                          onClick={() => void handlePreviewPdf('progresso')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                          {pdfBusy === 'preview' ? 'Preparando...' : 'Pré-visualizar PDF'}
                        </button>
                        <button
                          type="button"
                          disabled={pdfBusy !== null}
                          onClick={() => void handleExportProgressoPdf()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {pdfBusy === 'progresso' ? 'Gerando PDF...' : 'Exportar Progresso (PDF)'}
                        </button>
                        <button
                          type="button"
                          disabled={pdfBusy !== null}
                          onClick={() => void handleExportDiagnosticoPdf()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <FileText className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                          {pdfBusy === 'diagnostico' ? 'Gerando PDF...' : 'Exportar Diagnóstico (PDF)'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Aviso de escopo conforme modalidade contratada */}
                  {isOrientativa && (
                    <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 mb-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
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
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold whitespace-nowrap shrink-0 hover:bg-slate-800"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Migrar para Completa
                      </a>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-6">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 mb-2">
                      <span>
                        {thermo.faltantesObrigatorios === 0
                          ? isOrientativa
                            ? 'Todos os documentos obrigatórios foram conferidos e aprovados para você protocolar!'
                            : 'Todos os documentos obrigatórios foram aprovados!'
                          : `Faltam ${thermo.faltantesObrigatorios} documento(s). Seu processo está ${thermo.notaGeral}% pronto.`}
                      </span>
                      <span className="tabular-nums">{thermo.notaGeral}%</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${thermo.notaGeral}%`, backgroundColor: thermo.corHex }}
                      />
                    </div>
                  </div>

                  {/* Linha do tempo diferenciada por modalidade */}
                  {isOrientativa ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h2 className="text-sm font-semibold text-slate-900">
                          Roteiro da Consultoria Orientativa (6 Etapas)
                        </h2>
                        <span className="text-xs text-slate-500 tabular-nums">
                          Etapa atual: {orientativaCurrentStep}/6
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {ORIENTATIVA_STAGES.map((st) => {
                          const done = st.numero < orientativaCurrentStep;
                          const active = st.numero === orientativaCurrentStep;
                          return (
                            <div
                              key={st.numero}
                              className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                                active
                                  ? 'border-[var(--color-primary)] bg-slate-900 text-white'
                                  : done
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                    : 'border-slate-200 bg-white text-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold tabular-nums">Etapa {st.numero}</span>
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                                    active ? 'text-amber-300' : done ? 'text-emerald-700' : 'text-slate-400'
                                  }`}
                                >
                                  {st.responsavel}
                                </span>
                              </div>
                              <p className={`font-semibold ${active ? 'text-white' : 'text-slate-900'}`}>{st.nome}</p>
                              <p className={`leading-relaxed ${active ? 'text-slate-300' : 'text-slate-600'}`}>
                                {st.descricao}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <h2 className="text-sm font-semibold text-slate-900">
                          Linha do tempo — Consultoria Completa (15 Etapas)
                        </h2>
                        <span className="text-xs text-slate-500 tabular-nums">
                          Etapa atual: {activeCase?.etapaPipeline || 1}/15
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                        {PIPELINE_STAGES.map((st) => {
                          const current = activeCase?.etapaPipeline || 1;
                          const done = st.numero < current;
                          const active = st.numero === current;
                          return (
                            <div
                              key={st.numero}
                              className={`p-3 rounded-lg border text-xs ${
                                active
                                  ? 'border-[var(--color-primary)] bg-slate-900 text-white'
                                  : done
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                    : 'border-slate-200 bg-white text-slate-500'
                              }`}
                            >
                              <p className="font-bold tabular-nums">Etapa {st.numero}</p>
                              <p className="mt-0.5 leading-snug">{st.nome}</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Diagnóstico Inicial & Parecer Técnico Liberado */}
                {(primaryLead || releasedAssessments.length > 0) && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-semibold text-slate-900">
                          Diagnóstico de Viabilidade &amp; Parecer Técnico
                        </h2>
                        <p className="text-xs text-slate-500">
                          Histórico do seu diagnóstico inicial e orientações técnicas liberadas pela consultoria
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 no-print">
                        <button
                          type="button"
                          disabled={pdfBusy !== null}
                          onClick={() => void handlePreviewPdf('diagnostico')}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Eye className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                          Pré-visualizar
                        </button>
                        <button
                          type="button"
                          disabled={pdfBusy !== null}
                          onClick={() => void handleExportDiagnosticoPdf()}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                          {pdfBusy === 'diagnostico' ? 'Gerando PDF...' : 'Baixar Diagnóstico (PDF)'}
                        </button>
                      </div>
                    </div>

                    {primaryLead && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                        <div>
                          <p className="text-slate-500">Subcategoria sugerida</p>
                          <p className="font-bold text-slate-900 mt-0.5">
                            {primaryLead.subcategoriaSugerida || primaryLead.interesse || 'Em análise'}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Índice de viabilidade</p>
                          <p className="font-bold text-slate-900 mt-0.5 tabular-nums">
                            {typeof primaryLead.notaViabilidade === 'number'
                              ? `${primaryLead.notaViabilidade}/100`
                              : 'Em avaliação'}
                            {primaryLead.confianca ? ` · Confiança ${primaryLead.confianca}` : ''}
                          </p>
                        </div>
                        <div>
                          <p className="text-slate-500">Realizado em</p>
                          <p className="font-bold text-slate-900 mt-0.5 tabular-nums">
                            {formatDateBR(primaryLead.createdAt)}
                            {primaryLead.versaoRegras ? ` · Regras ${primaryLead.versaoRegras}` : ''}
                          </p>
                        </div>
                      </div>
                    )}

                    {releasedAssessments.length > 0 && (
                      <div className="space-y-3 pt-1">
                        <p className="text-xs font-semibold text-slate-700">
                          Parecer Técnico Liberado (Versão {releasedAssessments[0].versao} · Nota{' '}
                          <span className="tabular-nums">{releasedAssessments[0].notaGeral}/100</span>)
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {releasedAssessments[0].enquadramentoLegal}
                        </p>
                        {releasedAssessments[0].fundamentacaoNormativa && (
                          <p className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-3">
                            {releasedAssessments[0].fundamentacaoNormativa}
                          </p>
                        )}
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">
                          {releasedAssessments[0].recomendacoes}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Documentos emitidos liberados */}
                {genDocs.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                    <h2 className="text-base font-semibold text-slate-900">Documentos Oficiais Disponíveis</h2>
                    {genDocs.map((gd) => {
                      const statusLabel = gd.canceladoEm ? 'Cancelado' : gd.status || 'Disponível';
                      return (
                        <div key={gd.id} className="p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-sm font-semibold text-slate-900">{gd.titulo}</p>
                            <p className="text-xs text-slate-500">
                              Status: <strong>{statusLabel}</strong> · Versão {gd.versao} · Emitido em {formatDateBR(gd.createdAt)}
                              {gd.codigoVerificacao ? ` · Código ${gd.codigoVerificacao}` : ''}
                            </p>
                            {gd.confirmadoLeituraEm && (
                              <p className="text-[11px] text-[#1E7E34] font-medium">
                                Leitura confirmada em {formatDateTimeBR(gd.confirmadoLeituraEm)}
                              </p>
                            )}
                            {gd.assinadoEm && (
                              <p className="text-[11px] text-[#1E7E34] font-medium">
                                Assinado em {formatDateTimeBR(gd.assinadoEm)}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => setViewingGenDoc(gd)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visualizar / Imprimir A4
                            </button>
                            {!gd.canceladoEm && gd.status !== 'Assinado' && (
                              <button
                                type="button"
                                onClick={() => setSigningGenDoc(gd)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                style={{ backgroundColor: 'var(--color-primary)' }}
                              >
                                <FileSignature className="w-3.5 h-3.5" />
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
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                    <h2 className="text-base font-semibold text-slate-900">Como está sendo sua experiência com a D&amp;M Integra Chile?</h2>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setNpsNota(n)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1 ${
                            npsNota === n ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]' : 'bg-white text-slate-700 border-slate-300'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                          {n}
                        </button>
                      ))}
                    </div>
                    <textarea
                      rows={2}
                      value={npsComent}
                      onChange={(e) => setNpsComent(e.target.value)}
                      placeholder="Deixe um comentário opcional..."
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleSendNps}
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Enviar avaliação
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ABA 2: DOCUMENTOS & PRIORIDADES */}
            {tab === 'documentos' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Relação Priorizada de Documentos</h2>
                    <p className="text-xs text-slate-500">
                      Envie PDF, JPG ou PNG de até 10 MB respeitando a ordem sugerida para preservar validades curtas (ex.: Antecedentes 60 dias).
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 no-print">
                    <button
                      type="button"
                      disabled={pdfBusy !== null}
                      onClick={() => void handleExportProgressoPdf()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <Download className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      {pdfBusy === 'progresso' ? 'Gerando PDF...' : 'Exportar Relatório (PDF)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('biblioteca')}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                    >
                      <Scale className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      Biblioteca Legal
                    </button>
                    <button
                      type="button"
                      onClick={() => setLawOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      Entenda a Lei
                    </button>
                  </div>
                </div>

                {activeDocs.length === 0 ? (
                  <p className="text-sm text-slate-600 py-6 text-center">Nenhum item documental gerado ainda para este processo.</p>
                ) : (
                  (() => {
                    const sortedDocs = [...activeDocs].sort((a, b) => a.ordemEmissao - b.ordemEmissao);
                    const evalByDocId = new Map(
                      sortedDocs.map((d) => [
                        d.id,
                        resolveDocumentExpiration({
                          doc: d,
                          visaRequirements,
                          client: client || undefined,
                          dependents,
                        }),
                      ]),
                    );
                    const expiringClientDocs = sortedDocs.filter(
                      (d) => evalByDocId.get(d.id)?.isExpiringUnder30Days,
                    );

                    return (
                      <>
                        {expiringClientDocs.length > 0 && (
                          <div
                            role="region"
                            aria-label="Lembretes de vencimento dos documentos"
                            className="rounded-xl border border-amber-200 bg-amber-50/75 px-4 py-3 flex items-start gap-2.5"
                          >
                            <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="text-xs space-y-0.5">
                              <p className="font-bold text-slate-900">
                                Lembretes de Vencimento: {expiringClientDocs.length} documento(s) expira(m) em menos de 30 dias
                              </p>
                              <p className="text-slate-700">
                                {expiringClientDocs
                                  .map((d) => `${d.nomeDocumento} (${evalByDocId.get(d.id)?.statusLabel})`)
                                  .join(' · ')}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="divide-y divide-slate-200">
                          {sortedDocs.map((d) => {
                            const expEval = evalByDocId.get(d.id);
                            const isExpiring = Boolean(expEval?.isExpiringUnder30Days);
                            const isCritical = expEval?.severity === 'vencido' || expEval?.severity === 'critico';
                            const suggestedName = formatStandardDocFilename(d.pessoa, d.nomeDocumento, d.dataEmissao, 'pdf');
                            return (
                              <div key={d.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <p className="text-xs text-slate-500">
                                    Ordem #{d.ordemEmissao} · {d.pessoa} · {d.categoriaDoc}
                                    {d.prazoSugeridoEmissao ? ` · Emitir até ${formatDateBR(d.prazoSugeridoEmissao)}` : ''}
                                  </p>
                                  <p className="text-sm font-semibold text-slate-900">{d.nomeDocumento}</p>
                                  <p className="text-xs font-medium" style={{ color: d.status === 'Aprovado' ? '#1E7E34' : d.status === 'Reprovado' ? '#C82333' : '#0F2537' }}>
                                    Status: {d.status} · Etapa: {d.etapaEsteira} · Versão {d.versao}
                                  </p>
                                  {isExpiring && expEval && (
                                    <p
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold tabular-nums"
                                      style={{ color: isCritical ? '#DC2626' : '#D97706' }}
                                    >
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                      <span>
                                        {expEval.statusLabel}
                                        {expEval.dataValidadeEfetiva ? ` (${expEval.dataValidadeBR})` : ''}
                                      </span>
                                    </p>
                                  )}
                                  <p className="text-[11px] text-slate-400">Nome sugerido do arquivo: {suggestedName}</p>
                                  {d.motivoReprovacao && (
                                    <p className="text-xs text-[#C82333]">Motivo da pendência: {d.motivoReprovacao}</p>
                                  )}
                                </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {d.arquivoUrl && (
                                <a
                                  href={d.arquivoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  Ver enviado
                                </a>
                              )}
                              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: 'var(--color-primary)' }}>
                                <Upload className="w-3.5 h-3.5" />
                                {uploadingDocId === d.id ? 'Enviando...' : d.arquivoUrl ? 'Reenviar' : 'Enviar arquivo'}
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                                  className="hidden"
                                  disabled={uploadingDocId === d.id}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleUploadDoc(d, f);
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                    );
                  })()
                )}
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

            {/* ABA 3: ORÇAMENTOS & FINANCEIRO */}
            {tab === 'financeiro' && (
              <div className="space-y-6">
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <h2 className="text-lg font-bold text-slate-900">Orçamentos Recebidos</h2>
                  {budgets.length === 0 ? (
                    <p className="text-sm text-slate-600">Nenhum orçamento enviado até o momento.</p>
                  ) : (
                    budgets.map((b) => (
                      <div key={b.id} className="p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-xs text-slate-500">
                              Nº {b.numeroOrcamento} · Validade {formatDateBR(b.validade)} · Status: {b.status}
                            </p>
                            <h3 className="text-base font-semibold text-slate-900">{b.titulo}</h3>
                          </div>
                          <p className="text-lg font-bold tabular-nums text-slate-900">
                            {formatCurrency(b.totalGeral, b.moedaPrincipal)}
                          </p>
                        </div>
                        <p className="text-xs text-slate-600">{b.condicoesPagamento}</p>
                        {b.status === 'Enviado ao Cliente' && (
                          <div className="flex flex-wrap gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => handleBudgetDecision(b, 'Aprovado')}
                              className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                            >
                              Aprovar orçamento
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBudgetDecision(b, 'Recusado')}
                              className="px-4 py-2 rounded-lg text-xs font-semibold border border-slate-300 text-slate-700"
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
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                    <h2 className="text-base font-semibold text-slate-900">Opções de Pagamento</h2>
                    {empresa.chavePix && (
                      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-700">Chave Pix:</span>{' '}
                          <span className="font-mono text-slate-900">{empresa.chavePix}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(empresa.chavePix);
                            setPixCopied(true);
                            setTimeout(() => setPixCopied(false), 2000);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {pixCopied ? 'Copiado!' : 'Copiar Pix'}
                        </button>
                      </div>
                    )}
                    {empresa.linkPagamentoCartao && (
                      <a
                        href={empresa.linkPagamentoCartao}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        Pagar com Cartão
                      </a>
                    )}
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <h2 className="text-base font-semibold text-slate-900">Parcelas e Lançamentos</h2>
                  {financials.length === 0 ? (
                    <p className="text-sm text-slate-600">Nenhuma parcela lançada.</p>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {financials.map((f) => (
                        <div key={f.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{f.descricao}</p>
                            <p className="text-xs text-slate-500">
                              {f.tipo} · Vencimento {formatDateBR(f.vencimento)} · Status: {f.status}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold tabular-nums">{formatCurrency(f.valor, f.moeda)}</span>
                            <label className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
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
                <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Agendamento e Canais de Atendimento</h2>
                    <p className="text-xs text-slate-500">Marque reuniões, adicione prazos ao Google Agenda ou tire dúvidas no WhatsApp.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCalendlyOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <Calendar className="w-4 h-4" />
                      Agendar no Calendly
                    </button>
                    <a
                      href={buildWhatsAppUrl(empresa.whatsapp, `Olá! Sou ${client?.nomeCompleto} e gostaria de falar sobre meu processo.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      Falar no WhatsApp
                    </a>
                    <button
                      type="button"
                      onClick={() => setTab('biblioteca')}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <Scale className="w-4 h-4 text-[var(--color-primary)]" />
                      Biblioteca Legal SERMIG
                    </button>
                    <button
                      type="button"
                      onClick={() => setLawOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
                    >
                      <BookOpen className="w-4 h-4" />
                      Entenda a Lei
                    </button>
                  </div>
                </div>

                {/* Reuniões e Prazos com Google Agenda e .ics */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <h3 className="text-base font-semibold text-slate-900">Minhas Reuniões e Prazos</h3>
                  {appointments.length === 0 && deadlines.length === 0 ? (
                    <p className="text-sm text-slate-600">Nenhuma reunião ou prazo cadastrado ainda.</p>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {appointments.map((apt) => (
                        <div key={apt.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{apt.titulo}</p>
                            <p className="text-xs text-slate-500">
                              {formatDateTimeBR(apt.dataHoraInicio)} · {apt.status}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <a
                              href={buildGoogleCalendarUrl({ title: apt.titulo, startIso: apt.dataHoraInicio })}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Google Agenda
                            </a>
                            <button
                              type="button"
                              onClick={() => downloadIcsFile({ title: apt.titulo, startIso: apt.dataHoraInicio })}
                              className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Baixar .ics
                            </button>
                          </div>
                        </div>
                      ))}
                      {deadlines.map((dl) => (
                        <div key={dl.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{dl.titulo}</p>
                            <p className="text-xs text-slate-500">
                              {dl.tipo} · Data limite: {formatDateBR(dl.dataLimite)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => downloadIcsFile({ title: dl.titulo, startIso: dl.dataLimite })}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Baixar .ics
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Parceiros recomendados */}
                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <Handshake className="w-5 h-5 text-[var(--color-accent)]" />
                    <h3 className="text-base font-semibold text-slate-900">Parceiros Recomendados</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {partnersPublic.map((p) => (
                      <div key={p.id} className="p-4 rounded-lg border border-slate-200">
                        <p className="text-xs text-slate-500">{p.categoria} · {p.pais}</p>
                        <p className="text-sm font-semibold text-slate-900 mt-1">{p.nome}</p>
                        <p className="text-xs text-slate-600 mt-1">{p.descricaoPublica}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ABA 5: MEUS DADOS & LGPD */}
            {tab === 'dados' && (
              <div className="space-y-6">
                <form onSubmit={handleSavePersonalData} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-[var(--color-primary)]" />
                    <h2 className="text-lg font-bold text-slate-900">Meus Dados Cadastrais</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pt-nome">Nome completo</label>
                      <input id="pt-nome" value={editNome} onChange={(e) => setEditNome(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pt-whats">WhatsApp</label>
                      <input id="pt-whats" value={editWhats} onChange={(e) => setEditWhats(maskPhoneBR(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pt-prof">Profissão</label>
                      <input id="pt-prof" value={editProfissao} onChange={(e) => setEditProfissao(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="pt-end">Endereço completo</label>
                      <input id="pt-end" value={editEndereco} onChange={(e) => setEditEndereco(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    Salvar alterações
                  </button>
                </form>

                {dependents.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
                    <h3 className="text-base font-semibold text-slate-900">Dependentes Vinculados</h3>
                    {dependents.map((dep) => (
                      <p key={dep.id} className="text-sm text-slate-700">
                        {dep.nomeCompleto} · {dep.parentesco}
                      </p>
                    ))}
                  </div>
                )}

                <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[var(--color-primary)]" />
                    <h3 className="text-base font-semibold text-slate-900">Privacidade e Direitos LGPD (Lei nº 13.709/2018)</h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Consentimento registrado na versão {client?.lgpdVersao || empresa.termoLgpdVersao}
                    {client?.lgpdAceitoEm ? ` em ${formatDateTimeBR(client.lgpdAceitoEm)}` : ''}.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleLgpdRequest('exportação')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Solicitar exportação de dados
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLgpdRequest('exclusão')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50"
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

      <footer className="bg-white border-t border-slate-200 py-5 px-4 sm:px-6 text-xs text-slate-500 text-center mb-16 md:mb-0">
        {empresa.avisoLegal}
      </footer>

      {/* Barra inferior mobile fixa com >=48px touch targets */}
      <nav
        aria-label="Navegação rápida do portal"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 grid grid-cols-6 no-print"
      >
        {[
          { id: 'processo', label: 'Processo', icon: <Briefcase className="w-4 h-4" /> },
          { id: 'documentos', label: 'Docs', icon: <FolderOpen className="w-4 h-4" /> },
          { id: 'biblioteca', label: 'Normas', icon: <Scale className="w-4 h-4" /> },
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
              className={`min-h-[52px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                active ? 'text-[var(--color-primary)] bg-slate-50' : 'text-slate-600'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modal Visualização / Impressão A4 Documento Oficial */}
      {viewingGenDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4 print-modal-backdrop" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl print-modal-dialog">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3 no-print">
              <div>
                <p className="text-sm font-bold text-slate-900">{viewingGenDoc.titulo}</p>
                <p className="text-[11px] text-slate-500">
                  Versão {viewingGenDoc.versao} · Código {viewingGenDoc.codigoVerificacao || viewingGenDoc.id}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!viewingGenDoc.confirmadoLeituraEm && (
                  <UiButton type="button" size="sm" variant="primary" onClick={() => void handleConfirmGenDocRead(viewingGenDoc)}>
                    Confirmar leitura
                  </UiButton>
                )}
                <UiButton
                  type="button"
                  size="sm"
                  variant="primary"
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
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar PDF A4
                </UiButton>
                <UiButton type="button" size="sm" variant="outline" onClick={() => window.print()}>
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </UiButton>
                <button type="button" onClick={() => setViewingGenDoc(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-6 sm:p-8 overflow-y-auto space-y-5 text-xs text-slate-800 print-modal-scroll">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm font-bold text-slate-900">{empresa.nome_empresa}</p>
                  <p className="text-[11px] text-slate-500">{empresa.razao_social_cnpj_rut}</p>
                </div>
                <QrCodeSvg value={viewingGenDoc.codigoVerificacao || viewingGenDoc.id} size={56} />
              </div>
              <div
                className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(viewingGenDoc.conteudoHtml) }}
              />
              {viewingGenDoc.assinaturaDataUrl && (
                <div className="pt-4 border-t border-slate-200 print-avoid-break">
                  <p className="text-[11px] font-semibold text-slate-600 mb-1">Assinatura registrada:</p>
                  <img src={viewingGenDoc.assinaturaDataUrl} alt="Assinatura" className="h-16 border border-slate-200 rounded bg-white" />
                </div>
              )}
              <p className="text-[10px] text-slate-500 pt-3 border-t border-slate-200">{empresa.avisoLegal}</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Assinatura / Anexo de Documento Oficial */}
      {signingGenDoc && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Assinar ou Anexar Documento Assinado</h3>
              <button type="button" onClick={() => setSigningGenDoc(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Desenhe sua assinatura digital abaixo ou envie o PDF assinado manualmente / via Gov.br para <strong>{signingGenDoc.titulo}</strong>.
            </p>
            <DrawSignaturePad
              disabled={signBusy}
              onSave={(dataUrl) => void handleSignGenDocCanvas(signingGenDoc, dataUrl)}
            />
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">
                <Upload className="w-3.5 h-3.5" />
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
              <button type="button" onClick={() => setSigningGenDoc(null)} className="px-3 py-2 text-xs text-slate-600">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal obrigatório LGPD no 1º acesso */}
      {needsLgpdAccept && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-[var(--color-primary)]" />
              <h2 className="text-lg font-bold text-slate-900">
                Aceite LGPD Obrigatório (Versão {empresa.termoLgpdVersao})
              </h2>
            </div>
            <div className="max-h-60 overflow-y-auto p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-700 whitespace-pre-wrap">
              {empresa.termoLgpd}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAcceptLgpd}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Li e aceito o Termo LGPD
              </button>
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
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[var(--color-primary)]" />
                  Atualizações do Processo
                </h3>
                <p className="text-xs text-slate-500">
                  Histórico de movimentações de etapa, SERMIG, documentos e pareceres liberados
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotifCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllClientNotificationsRead(notifications)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Marcar todas como lidas
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                  aria-label="Fechar central de notificações"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  Nenhuma notificação registrada para o seu processo até o momento.
                </p>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition-colors ${
                      notif.lida ? 'bg-white border-slate-200' : 'bg-slate-50 border-[var(--color-primary)]/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                            {notif.tipo === 'etapa_pipeline'
                              ? 'Etapa do Processo'
                              : notif.tipo === 'status_sermig'
                                ? 'Status SERMIG'
                                : notif.tipo === 'documento'
                                  ? 'Documento'
                                  : notif.tipo === 'parecer'
                                    ? 'Parecer Técnico'
                                    : notif.tipo === 'prazo'
                                      ? 'Prazo Legal'
                                      : 'Comunicado'}
                          </span>
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            {formatDateTimeBR(notif.createdAt)}
                          </span>
                          {!notif.lida && (
                            <span className="text-[10px] font-bold text-[#C82333] uppercase">Nova</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-slate-900">{notif.titulo}</p>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{notif.mensagem}</p>
                      </div>
                      {!notif.lida && (
                        <button
                          type="button"
                          onClick={() => void markClientNotificationRead(notif.id)}
                          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Check className="w-3 h-3" />
                          Marcar lida
                        </button>
                      )}
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
