import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  Calendar,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  FileSignature,
  FolderArchive,
  Lock,
  MessageCircle,
  Plus,
  Printer,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { LegalBaseModal } from '../LegalBaseModal';
import { ConfirmActionModal, ConfirmTypedModal, UiButton } from '../ui/DesignSystem';
import { ClientDossierModal } from './ClientDossierModal';
import { ContractGeneratorModal } from './ContractGeneratorModal';
import {
  clearAiDraftCache,
  compactCaseForAi,
  compactClientForAi,
  compactLegalSourcesForAi,
  loadAiDraftCache,
  prepareAiAttachment,
  sanitizeClientAiError,
  saveAiDraftCache,
  type AiResponseMeta,
} from '../../utils/aiClient';
import { CASE_TEMPLATES, PIPELINE_STAGES } from '../../data/seeds';
import {
  archiveClientAudited,
  callAiEndpoint,
  deleteCaseCascadeAudited,
  deleteCaseDocumentAudited,
  deleteClientCascadeAudited,
  deleteDocumentAudited,
  logSensitiveDocumentAccess,
  makeId,
  saveDocumentAudited,
  uploadFileToServer,
} from '../../services/firestoreService';
import { markStaffChatQuestionsRead, sendStaffDocumentChatReply } from '../../services/chatService';
import { notifyClientProcessUpdate } from '../../services/notificationService';
import type {
  Appointment,
  AuditLog,
  Budget,
  Case,
  CaseDocument,
  CaseFinancialSummary,
  Client,
  ClientNotificationType,
  CommunicationLog,
  CurrencyCode,
  Deadline,
  Dependent,
  DocCategory,
  DocumentStep,
  DocumentTemplate,
  EmpresaConfig,
  FinancialRecord,
  GeneratedDocument,
  LegalSource,
  MessageTemplate,
  PartnerPublic,
  Task,
  UserProfile,
  UserRole,
  ViabilityAssessment,
  VisaCategory,
  VisaRequirement,
} from '../../types/domain';
import { calcularTermometroDocumentos, gerarCronogramaEmissao } from '../../utils/caseMetrics';
import {
  applyTemplateVariables,
  buildGoogleCalendarUrl,
  buildWhatsAppUrl,
  daysUntilDate,
  downloadIcsFile,
  exportToCSV,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  formatStandardDocFilename,
  isValidCPF,
  maskCPF,
  maskPhoneBR,
  normalizeDigits,
  parseFlexibleDate,
  toIsoDate,
} from '../../utils/formatters';
import {
  countUnreadChatForStaff,
  inferChatSenderRole,
  sortChatMessagesChronologically,
} from '../../utils/documentChat';
import {
  MACRO_FUNNEL_STAGES,
  formatCaseStageSummary,
  getMacroStageForCase,
  getNextMacroStage,
  resolveTargetPipelineStep,
  type MacroFunnelStageId,
} from '../../utils/funnelModel';
import { reportAppError, translateAppError } from '../../services/errorService';
import { buildZipBlob, type ZipEntryInput } from '../../utils/zipBuilder';
import {
  getCaseContextConfig,
  getDocumentRowVisibility,
  serviceNeedsCurrentResidencyExpiry,
  serviceRequiresVisaCategory,
  type DynamicCaseTabId,
} from '../../utils/caseContextConfig';

interface PainelClientesCasosProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  clients: Client[];
  dependents: Dependent[];
  cases: Case[];
  caseFinancials: CaseFinancialSummary[];
  docs: CaseDocument[];
  tasks: Task[];
  deadlines: Deadline[];
  appointments: Appointment[];
  communicationLogs: CommunicationLog[];
  viabilityAssessments: ViabilityAssessment[];
  budgets: Budget[];
  financialRecords: FinancialRecord[];
  documentTemplates?: DocumentTemplate[];
  generatedDocuments?: GeneratedDocument[];
  auditLogs: AuditLog[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  messageTemplates: MessageTemplate[];
  partnersPublic: PartnerPublic[];
  selectedCaseId: string | null;
  requestedCaseTab?: { caseId: string; tab: CaseTab; seq: number } | null;
  requestedMacroStageFilter?: { stageId: MacroFunnelStageId | 'all'; seq: number } | null;
  requestedQuickAction?: { action: 'new_case' | 'new_client'; seq: number } | null;
  onSelectCase: (caseId: string | null) => void;
  onRefresh: () => Promise<void>;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
  mode?: 'casos' | 'clientes' | 'ambos';
}

type CaseTab = DynamicCaseTabId;

const DOCUMENT_STEPS: DocumentStep[] = [
  '1 Aguardando Envio',
  '2 Recebido/Triagem',
  '3 Em Conferência',
  '4 Pendência/Reprovado',
  '5 Pronto para Apostila/Tradução',
  '6 Aprovado para Protocolo',
];

const SERMIG_STATUSES: Case['statusSermig'][] = [
  'Não protocolado',
  'Em trâmite',
  'Requerimento de documentos',
  'Aprovado',
  'Rejeitado',
  'Em recurso',
];

const RELOCATION_DEFAULT_ITEMS = [
  '[Relocation] Baixar Estampado Electrónico no portal SERMIG',
  '[Relocation] Registrar entrada no Chile (PDI) dentro de 30/90 dias',
  '[Relocation] Agendar e emitir Cédula de Identidade no Registro Civil',
  '[Relocation] Ativar ClaveÚnica (Registro Civil / ChileAtiende)',
  '[Relocation] Obter RUT provisório / abrir conta bancária no Chile',
  '[Relocation] Conectar com imobiliária/parceiro para contrato de locação',
];

export const PainelClientesCasos: React.FC<PainelClientesCasosProps> = ({
  role,
  userProfile,
  empresa,
  clients,
  dependents,
  cases,
  caseFinancials,
  docs,
  tasks,
  deadlines,
  appointments,
  communicationLogs,
  viabilityAssessments,
  budgets,
  financialRecords,
  documentTemplates = [],
  generatedDocuments = [],
  auditLogs,
  visaCategories,
  visaRequirements,
  legalSources,
  messageTemplates,
  partnersPublic,
  selectedCaseId,
  requestedCaseTab,
  requestedMacroStageFilter,
  requestedQuickAction,
  onSelectCase,
  onRefresh,
  onLogWhatsApp,
  mode = 'ambos',
}) => {
  const isAssistente = role === 'assistente';
  const isAdmin = role === 'admin';
  const canManageClients = role === 'admin' || role === 'consultor';

  const [subView, setSubView] = useState<'casos' | 'clientes'>(mode === 'clientes' ? 'clientes' : 'casos');
  useEffect(() => {
    if (mode === 'clientes') setSubView('clientes');
    else if (mode === 'casos') setSubView('casos');
  }, [mode]);
  const [casesLayout, setCasesLayout] = useState<'lista' | 'kanban'>('kanban');
  const [search, setSearch] = useState('');
  const [caseTab, setCaseTab] = useState<CaseTab>('resumo');
  useEffect(() => {
    if (requestedCaseTab && requestedCaseTab.caseId === selectedCaseId) {
      setCaseTab(requestedCaseTab.tab);
    }
  }, [requestedCaseTab, selectedCaseId]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pushTipo, setPushTipo] = useState<ClientNotificationType>('geral');
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushSending, setPushSending] = useState(false);
  const [chatReplyMsg, setChatReplyMsg] = useState('');
  const [chatReplyDocId, setChatReplyDocId] = useState('');
  const [chatReplySendPush, setChatReplySendPush] = useState(true);
  const [chatReplySending, setChatReplySending] = useState(false);

  // Filtros de Clientes e Casos
  const [clientPortalFilter, setClientPortalFilter] = useState<'all' | 'liberado' | 'pendente'>('all');
  const [clientPassportFilter, setClientPassportFilter] = useState<'all' | 'expiring_12m'>('all');
  const [clientPendingFilter, setClientPendingFilter] = useState<'all' | 'com_pendencias'>('all');
  const [showArchivedClients, setShowArchivedClients] = useState(false);

  const [caseStageFilter, setCaseStageFilter] = useState<string>('all');
  const [casePriorityFilter, setCasePriorityFilter] = useState<string>('all');
  const [caseSermigFilter, setCaseSermigFilter] = useState<string>('all');
  const [caseVisaFilter, setCaseVisaFilter] = useState<string>('all');
  const [caseCriticalOnly, setCaseCriticalOnly] = useState(false);
  const [showMoreCaseFilters, setShowMoreCaseFilters] = useState(false);

  // Modais de criação e dossiê
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [dossierClientId, setDossierClientId] = useState<string | null>(null);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractModalInit, setContractModalInit] = useState<{ clientId?: string; caseId?: string }>({});
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [csvRawText, setCsvRawText] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);

  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [newCaseTemplateId, setNewCaseTemplateId] = useState<string>(CASE_TEMPLATES[0]?.id || '');
  const [newCaseForm, setNewCaseForm] = useState({
    titulo: '',
    clientId: clients[0]?.id || '',
    tipoServico: 'Residência Temporal' as Case['tipoServico'],
    visaCategoryId: 'visa_15_mercosul',
    prioridade: 'Alta' as Case['prioridade'],
    etapaInicial: 2,
    dataVencimentoResidencia: '',
  });
  const [showAllCaseFields, setShowAllCaseFields] = useState(false);
  const [forcedOptionalTabs, setForcedOptionalTabs] = useState<Partial<Record<'dependentes' | 'relocation', boolean>>>({});
  const [parecerExpanded, setParecerExpanded] = useState(true);
  const [commSubView, setCommSubView] = useState<'atendimento' | 'auditoria'>('atendimento');

  useEffect(() => {
    if (!requestedMacroStageFilter) return;
    setSubView('casos');
    if (requestedMacroStageFilter.stageId === 'all') {
      setCaseStageFilter('all');
    } else {
      setCaseStageFilter(`macro:${requestedMacroStageFilter.stageId}`);
    }
  }, [requestedMacroStageFilter]);

  useEffect(() => {
    if (!requestedQuickAction) return;
    if (requestedQuickAction.action === 'new_case') {
      setSubView('casos');
      setCaseModalOpen(true);
    } else if (requestedQuickAction.action === 'new_client' && canManageClients) {
      setSubView('clientes');
      setEditingClient({
        nomeCompleto: '',
        cpf: '',
        email: '',
        whatsapp: '',
        portalLiberado: false,
        statusAcessoPortal: 'Pendente liberação',
      });
      setClientModalOpen(true);
    }
  }, [requestedQuickAction, canManageClients]);

  // Override de bloqueio mínimo de protocolo & Encerramento de caso
  const [overrideModal, setOverrideModal] = useState<{ targetStage: number; reasons: string[]; justificativa: string } | null>(null);
  const [closeCaseModalOpen, setCloseCaseModalOpen] = useState(false);
  const [closeCaseReason, setCloseCaseReason] = useState('');
  const [sermigStatusNote, setSermigStatusNote] = useState('');
  const [uploadingProtocolo, setUploadingProtocolo] = useState(false);

  // IA e Cronograma na ficha do caso
  const [aiParecerLoading, setAiParecerLoading] = useState(false);
  const [aiParecerProgress, setAiParecerProgress] = useState<string | null>(null);
  const [parecerDraft, setParecerDraft] = useState<(AiResponseMeta & {
    enquadramentoLegal: string;
    elegibilidadeRiscos: string;
    fundamentacaoNormativa: string;
    recomendacoes: string;
    notaGeral: number;
    liberadoAoCliente: boolean;
  }) | null>(null);

  const [dataAlvoProtocolo, setDataAlvoProtocolo] = useState(() => {
    const d = new Date(Date.now() + 45 * 86400000);
    return toIsoDate(d);
  });
  const [printMode, setPrintMode] = useState<'relacao' | 'apostila' | 'pacote' | 'dossie_caso' | null>(null);
  const [casePdfBusy, setCasePdfBusy] = useState(false);
  const [aiDocLoadingId, setAiDocLoadingId] = useState<string | null>(null);
  const [aiDocProgress, setAiDocProgress] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

  // Filtros, seleção em lote, modal completo e preview na aba Documentos
  const [docPersonFilter, setDocPersonFilter] = useState<string>('Todos');
  const [docStatusFilter, setDocStatusFilter] = useState<string>('Todos');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [zipBusy, setZipBusy] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<CaseDocument | null>(null);
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Partial<CaseDocument> | null>(null);

  // Modais de exclusão auditada
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<{
    kind: 'doc' | 'docs_batch' | 'dependent' | 'task' | 'deadline' | 'appointment' | 'viability' | 'comm';
    title: string;
    description: string;
    confirmLabel: string;
    item?: unknown;
    docs?: CaseDocument[];
  } | null>(null);
  const [deleteClientTarget, setDeleteClientTarget] = useState<Client | null>(null);
  const [deleteCaseTarget, setDeleteCaseTarget] = useState<Case | null>(null);

  useEffect(() => {
    if (!selectedCaseId) {
      setParecerDraft(null);
      return;
    }
    const cached = loadAiDraftCache<
      AiResponseMeta & {
        enquadramentoLegal: string;
        elegibilidadeRiscos: string;
        fundamentacaoNormativa: string;
        recomendacoes: string;
        notaGeral: number;
        liberadoAoCliente: boolean;
      }
    >(`parecer_${selectedCaseId}`);
    setParecerDraft(cached);
    setSelectedDocIds([]);
    setDocPersonFilter('Todos');
    setDocStatusFilter('Todos');
    setChatReplyMsg('');
    setChatReplyDocId('');
    setShowAllCaseFields(false);
    setForcedOptionalTabs({});
    setCommSubView('atendimento');
  }, [selectedCaseId]);

  const updateParecerDraft = (
    next:
      | (AiResponseMeta & {
          enquadramentoLegal: string;
          elegibilidadeRiscos: string;
          fundamentacaoNormativa: string;
          recomendacoes: string;
          notaGeral: number;
          liberadoAoCliente: boolean;
        })
      | null,
  ) => {
    setParecerDraft(next);
    if (selectedCaseId) {
      if (next) saveAiDraftCache(`parecer_${selectedCaseId}`, next);
      else clearAiDraftCache(`parecer_${selectedCaseId}`);
    }
  };

  // Formulários internos da Ficha do Caso
  const [depForm, setDepForm] = useState({
    nomeCompleto: '',
    parentesco: 'Cônjuge' as Dependent['parentesco'],
    idade: '',
    estudante: false,
    passaporteNumero: '',
    passaporteValidade: '',
  });
  const [newDocName, setNewDocName] = useState('');
  const [newDocPessoa, setNewDocPessoa] = useState('Titular');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPrazo, setNewTaskPrazo] = useState('');
  const [newDeadlineTitle, setNewDeadlineTitle] = useState('');
  const [newDeadlineTipo, setNewDeadlineTipo] = useState<Deadline['tipo']>('Validade Documento');
  const [newDeadlineDate, setNewDeadlineDate] = useState('');
  const [newAptTitle, setNewAptTitle] = useState('');
  const [newAptDate, setNewAptDate] = useState('');
  const [newAptTipo, setNewAptTipo] = useState<Appointment['tipo']>('Conferência Documental');

  // Comunicação
  const [commTplId, setCommTplId] = useState(messageTemplates[0]?.id || '');
  const [commMsg, setCommMsg] = useState('');
  const [commCanal, setCommCanal] = useState<CommunicationLog['canal']>('WhatsApp');

  // Financeiro do caso (Admin/Consultor)
  const [finContractValor, setFinContractValor] = useState<string>('');
  const [finContractMoeda, setFinContractMoeda] = useState<CurrencyCode>('BRL');
  const [finContractLiberado, setFinContractLiberado] = useState(false);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const dossierClient = useMemo(
    () => clients.find((c) => c.id === dossierClientId) || null,
    [clients, dossierClientId],
  );
  const activeCase = useMemo(() => cases.find((c) => c.id === selectedCaseId) || null, [cases, selectedCaseId]);
  const activeClient = useMemo(() => (activeCase ? clientMap.get(activeCase.clientId) || null : null), [activeCase, clientMap]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (!showArchivedClients && c.arquivado) return false;
      if (clientPortalFilter === 'liberado' && !c.portalLiberado) return false;
      if (clientPortalFilter === 'pendente' && c.portalLiberado) return false;
      if (clientPassportFilter === 'expiring_12m') {
        const days = daysUntilDate(c.passaporte?.validade);
        if (days === null || days > 365) return false;
      }
      if (clientPendingFilter === 'com_pendencias') {
        const hasPendingDoc = docs.some((d) => d.clientId === c.id && d.status !== 'Aprovado');
        if (!hasPendingDoc) return false;
      }
      if (!q) return true;
      return (
        c.nomeCompleto.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.cpf || '').includes(q) ||
        normalizeDigits(c.whatsapp).includes(normalizeDigits(q) || '__none__')
      );
    });
  }, [clients, search, showArchivedClients, clientPortalFilter, clientPassportFilter, clientPendingFilter, docs]);

  const filteredCases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((c) => {
      if (caseStageFilter !== 'all') {
        if (caseStageFilter.startsWith('macro:')) {
          const macroId = caseStageFilter.slice(6);
          if (getMacroStageForCase(c).id !== macroId) return false;
        } else if (String(c.etapaPipeline) !== caseStageFilter) {
          return false;
        }
      }
      if (casePriorityFilter !== 'all' && c.prioridade !== casePriorityFilter) return false;
      if (caseSermigFilter !== 'all' && c.statusSermig !== caseSermigFilter) return false;
      if (caseVisaFilter !== 'all' && c.visaCategoryId !== caseVisaFilter) return false;
      if (caseCriticalOnly) {
        const hasCritical = deadlines.some((d) => {
          if (d.caseId !== c.id || d.concluido) return false;
          const rem = daysUntilDate(d.dataLimite);
          return rem !== null && rem <= 30;
        });
        if (!hasCritical) return false;
      }
      if (!q) return true;
      const cl = clientMap.get(c.clientId);
      return (
        c.titulo.toLowerCase().includes(q) ||
        (cl?.nomeCompleto || '').toLowerCase().includes(q) ||
        (c.numeroPedidoSermig || '').toLowerCase().includes(q)
      );
    });
  }, [
    cases,
    clientMap,
    search,
    caseStageFilter,
    casePriorityFilter,
    caseSermigFilter,
    caseVisaFilter,
    caseCriticalOnly,
    deadlines,
  ]);

  // ===========================================================================
  // Handlers de Cliente
  // ===========================================================================
  const openNewClientModal = () => {
    setEditingClient({
      id: makeId('cli'),
      nomeCompleto: '',
      cpf: '',
      email: '',
      whatsapp: '',
      nacionalidade: 'Brasileira',
      profissao: '',
      enderecoCompleto: '',
      portalLiberado: false,
      statusAcessoPortal: 'Não solicitado',
      createdAt: new Date().toISOString(),
    });
    setClientModalOpen(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !canManageClients) return;
    setErrorMsg(null);
    const cpfDigits = normalizeDigits(editingClient.cpf);
    if (cpfDigits && !isValidCPF(cpfDigits)) {
      setErrorMsg('CPF inválido pelos dígitos verificadores. Corrija ou deixe em branco.');
      return;
    }
    const isNew = !clients.some((c) => c.id === editingClient.id);
    const payload: Client = {
      id: editingClient.id || makeId('cli'),
      nomeCompleto: (editingClient.nomeCompleto || '').trim(),
      cpf: editingClient.cpf || '',
      email: (editingClient.email || '').trim().toLowerCase(),
      whatsapp: editingClient.whatsapp || '',
      nacionalidade: editingClient.nacionalidade || 'Brasileira',
      profissao: editingClient.profissao || '',
      enderecoCompleto: editingClient.enderecoCompleto || '',
      estadoCivil: editingClient.estadoCivil || '',
      objetivoChile: editingClient.objetivoChile || '',
      portalLiberado: Boolean(editingClient.portalLiberado),
      statusAcessoPortal: editingClient.portalLiberado ? 'Liberado' : editingClient.statusAcessoPortal || 'Não solicitado',
      observacoes: editingClient.observacoes || '',
      createdAt: editingClient.createdAt || new Date().toISOString(),
    };
    await saveDocumentAudited('clients', payload.id, payload as unknown as Record<string, unknown>, isNew, role, 'cliente');
    setClientModalOpen(false);
    setEditingClient(null);
    setFeedback(`Cliente "${payload.nomeCompleto}" salvo com sucesso.`);
    await onRefresh();
  };

  const handleTogglePortalCliente = async (cl: Client) => {
    if (!canManageClients) return;
    const nextLib = !cl.portalLiberado;
    await saveDocumentAudited(
      'clients',
      cl.id,
      {
        ...cl,
        portalLiberado: nextLib,
        statusAcessoPortal: nextLib ? 'Liberado' : 'Pendente liberação',
      },
      false,
      role,
      'portalLiberado',
      cl.portalLiberado,
    );
    setFeedback(`Acesso ao Portal para ${cl.nomeCompleto}: ${nextLib ? 'Liberado' : 'Bloqueado/Pendente'}.`);
    await onRefresh();
  };

  const handleSendPortalInvite = async (cl: Client) => {
    const portalUrl = `${window.location.origin}/acompanhar`;
    const msg = `Olá, ${cl.nomeCompleto}! Seu acesso ao Portal do Cliente D&M Integra Chile está disponível. Acesse com o e-mail ${cl.email} em: ${portalUrl}`;
    if (cl.whatsapp) {
      window.open(buildWhatsAppUrl(cl.whatsapp, msg), '_blank', 'noopener,noreferrer');
    }
    const nowIso = new Date().toISOString();
    await saveDocumentAudited(
      'clients',
      cl.id,
      { ...cl, conviteEnviadoEm: nowIso },
      false,
      role,
      'conviteEnviadoEm',
      cl.conviteEnviadoEm,
    );
    await onLogWhatsApp(cl.id, undefined, 'Convite Portal do Cliente', msg);
    setFeedback(`Convite enviado e registrado para ${cl.nomeCompleto}.`);
  };

  // CSV Import Parsing & Bulk Creation
  const parsedCsvPreview = useMemo(() => {
    const lines = csvRawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];
    const startIdx = lines[0].toLowerCase().includes('nome') && lines[0].toLowerCase().includes('email') ? 1 : 0;
    const rows: {
      rowNum: number;
      nomeCompleto: string;
      email: string;
      whatsapp: string;
      cpf: string;
      status: 'valido' | 'duplicado' | 'invalido';
      motivo?: string;
    }[] = [];

    for (let i = startIdx; i < lines.length; i += 1) {
      const sep = lines[i].includes(';') ? ';' : ',';
      const cols = lines[i].split(sep).map((c) => c.replace(/^"|"$/g, '').trim());
      const nomeCompleto = cols[0] || '';
      const email = (cols[1] || '').toLowerCase();
      const whatsapp = cols[2] || '';
      const cpf = cols[3] ? maskCPF(cols[3]) : '';
      if (!nomeCompleto || !email.includes('@')) {
        rows.push({ rowNum: i + 1, nomeCompleto, email, whatsapp, cpf, status: 'invalido', motivo: 'Nome ou e-mail inválido' });
        continue;
      }
      if (cpf && !isValidCPF(cpf)) {
        rows.push({ rowNum: i + 1, nomeCompleto, email, whatsapp, cpf, status: 'invalido', motivo: 'CPF inválido' });
        continue;
      }
      const dup = clients.find(
        (c) =>
          c.email.toLowerCase() === email ||
          (cpf && normalizeDigits(c.cpf) === normalizeDigits(cpf)) ||
          (whatsapp && normalizeDigits(c.whatsapp) && normalizeDigits(c.whatsapp) === normalizeDigits(whatsapp)),
      );
      if (dup) {
        rows.push({ rowNum: i + 1, nomeCompleto, email, whatsapp, cpf, status: 'duplicado', motivo: `Já existe: ${dup.nomeCompleto}` });
        continue;
      }
      rows.push({ rowNum: i + 1, nomeCompleto, email, whatsapp: maskPhoneBR(whatsapp) || whatsapp, cpf, status: 'valido' });
    }
    return rows;
  }, [csvRawText, clients]);

  const handleConfirmCsvImport = async () => {
    const validRows = parsedCsvPreview.filter((r) => r.status === 'valido');
    if (validRows.length === 0 || !canManageClients) return;
    setCsvImporting(true);
    try {
      for (const r of validRows) {
        const id = makeId('cli');
        const payload: Client = {
          id,
          nomeCompleto: r.nomeCompleto,
          email: r.email,
          whatsapp: r.whatsapp || '+55 (00) 00000-0000',
          cpf: r.cpf,
          nacionalidade: 'Brasileira',
          portalLiberado: false,
          statusAcessoPortal: 'Não solicitado',
          createdAt: new Date().toISOString(),
        };
        await saveDocumentAudited('clients', id, payload as unknown as Record<string, unknown>, true, role, 'importar_csv');
      }
      setCsvImportOpen(false);
      setCsvRawText('');
      setFeedback(`${validRows.length} cliente(s) importado(s) com sucesso!`);
      await onRefresh();
    } finally {
      setCsvImporting(false);
    }
  };

  // ===========================================================================
  // Handlers de Caso
  // ===========================================================================
  const createChecklistForCase = async (caseId: string, clientId: string, visaCatId: string) => {
    const reqs = visaRequirements.filter((r) => r.visaCategoryId === visaCatId);
    const deps = dependents.filter((d) => d.clientId === clientId);
    const pessoas = ['Titular', ...deps.map((d) => d.nomeCompleto)];
    const sched = gerarCronogramaEmissao(reqs, dataAlvoProtocolo);
    let created = 0;

    for (const pessoa of pessoas) {
      const targetReqs =
        pessoa === 'Titular'
          ? sched
          : gerarCronogramaEmissao(
              visaRequirements.filter((r) => r.visaCategoryId === 'fluxo_dependente'),
              dataAlvoProtocolo,
            );
      const listToUse = targetReqs.length > 0 ? targetReqs : sched;
      for (const item of listToUse) {
        const docId = makeId('doc');
        const newDoc: CaseDocument = {
          id: docId,
          caseId,
          clientId,
          pessoa,
          visaRequirementId: item.requirement.id,
          nomeDocumento: item.requirement.nomeDocumento,
          categoriaDoc: item.requirement.categoriaDoc,
          etapaEsteira: '1 Aguardando Envio',
          ordemEmissao: item.ordem,
          prazoSugeridoEmissao: item.dataSugeridaIso,
          status: 'Pendente',
          validadeDias: item.requirement.validadeDias,
          apostilado: false,
          traduzido: false,
          exigeApostila: item.requirement.exigeApostila,
          exigeTraducao: item.requirement.exigeTraducao,
          obrigatorio: item.requirement.obrigatorio,
          peso: item.requirement.peso,
          versao: 1,
        };
        await saveDocumentAudited('caseDocuments', docId, newDoc as unknown as Record<string, unknown>, true, role, 'gerar_checklist');
        created += 1;
      }
    }
    return created;
  };

  const handleApplyCaseTemplate = (tplId: string) => {
    setNewCaseTemplateId(tplId);
    const tpl = CASE_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    const cli = clientMap.get(newCaseForm.clientId);
    setNewCaseForm((prev) => ({
      ...prev,
      tipoServico: tpl.tipoServico,
      visaCategoryId: tpl.visaCategoryId,
      prioridade: tpl.prioridade,
      etapaInicial: tpl.etapaInicial,
      titulo: prev.titulo || (cli ? `${cli.nomeCompleto} — ${tpl.nome}` : tpl.nome),
    }));
  };

  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseForm.clientId || !newCaseForm.titulo.trim()) {
      setErrorMsg('Selecione o cliente e informe o título do caso.');
      return;
    }
    const tpl = CASE_TEMPLATES.find((t) => t.id === newCaseTemplateId);
    const id = makeId('case');
    const requiresVisa = serviceRequiresVisaCategory(newCaseForm.tipoServico);
    const needsResidencyExpiry = serviceNeedsCurrentResidencyExpiry(newCaseForm.tipoServico);
    const payload: Case = {
      id,
      titulo: newCaseForm.titulo.trim(),
      clientId: newCaseForm.clientId,
      consultorId: userProfile.uid,
      tipoServico: newCaseForm.tipoServico,
      visaCategoryId: requiresVisa ? newCaseForm.visaCategoryId : undefined,
      etapaPipeline: newCaseForm.etapaInicial || tpl?.etapaInicial || 2,
      statusSermig: 'Não protocolado',
      dataVencimentoResidencia:
        needsResidencyExpiry && newCaseForm.dataVencimentoResidencia
          ? newCaseForm.dataVencimentoResidencia
          : undefined,
      portalLiberado: clientMap.get(newCaseForm.clientId)?.portalLiberado || false,
      relatorioViabilidadeLiberado: false,
      prioridade: newCaseForm.prioridade,
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('cases', id, payload as unknown as Record<string, unknown>, true, role, 'novo_caso');

    // Criar checklist documental padrão + tarefas iniciais + prazo sugerido do template
    if (tpl) {
      if (requiresVisa && payload.visaCategoryId) {
        await createChecklistForCase(id, payload.clientId, payload.visaCategoryId);
      }
      for (const tTitle of tpl.tarefasIniciais) {
        const tId = makeId('task');
        await saveDocumentAudited(
          'tasks',
          tId,
          {
            id: tId,
            titulo: tTitle,
            caseId: id,
            clientId: payload.clientId,
            prioridade: tpl.prioridade,
            status: 'Pendente',
            createdAt: new Date().toISOString(),
          },
          true,
          role,
          'tarefa_template',
        );
      }
      const prazoSugerido = tpl.prazoSugeridoDias ?? 0;
      if (prazoSugerido > 0) {
        const dlId = makeId('dl');
        await saveDocumentAudited(
          'deadlines',
          dlId,
          {
            id: dlId,
            titulo: `Meta de entrega/protocolo (${tpl.nome})`,
            tipo: 'Validade Documento',
            dataLimite: toIsoDate(new Date(Date.now() + prazoSugerido * 86400000)),
            caseId: id,
            clientId: payload.clientId,
            concluido: false,
          },
          true,
          role,
          'prazo_template',
        );
      }
    }

    setCaseModalOpen(false);
    setNewCaseForm({
      titulo: '',
      clientId: clients[0]?.id || '',
      tipoServico: 'Residência Temporal',
      visaCategoryId: 'visa_15_mercosul',
      prioridade: 'Alta',
      etapaInicial: 2,
      dataVencimentoResidencia: '',
    });
    setFeedback(
      requiresVisa
        ? 'Caso criado com checklist, tarefas iniciais e prazo sugerido!'
        : 'Caso de Relocation criado com trilha inicial!',
    );
    await onRefresh();
    onSelectCase(id);
  };

  const emitClientProcessAlert = async (params: {
    caseObj: Case;
    tipo: ClientNotificationType;
    titulo: string;
    mensagem: string;
    etapaPipeline?: number;
    statusSermig?: string;
  }) => {
    try {
      return await notifyClientProcessUpdate({
        clientId: params.caseObj.clientId,
        caseId: params.caseObj.id,
        tipo: params.tipo,
        titulo: params.titulo,
        mensagem: params.mensagem,
        etapaPipeline: params.etapaPipeline,
        statusSermig: params.statusSermig,
        linkDestino: '/portal',
        criadoPorUid: userProfile.uid,
        criadoPorNome: userProfile.nome || userProfile.email,
      });
    } catch {
      return null;
    }
  };

  const handleSaveCaseField = async (patch: Partial<Case>, fieldLabel = 'atualizacao_caso') => {
    if (!activeCase) return;
    const prevStage = activeCase.etapaPipeline;
    const prevViabReleased = Boolean(activeCase.relatorioViabilidadeLiberado);
    const updated: Case = { ...activeCase, ...patch };
    delete (updated as unknown as Record<string, unknown>).valorContrato;
    await saveDocumentAudited('cases', activeCase.id, updated as unknown as Record<string, unknown>, false, role, fieldLabel, activeCase);

    let extraNotice = '';
    if (typeof patch.etapaPipeline === 'number' && patch.etapaPipeline !== prevStage) {
      const stageMeta = PIPELINE_STAGES.find((s) => s.numero === patch.etapaPipeline);
      const res = await emitClientProcessAlert({
        caseObj: updated,
        tipo: 'etapa_pipeline',
        titulo: `Processo avançou para Etapa ${patch.etapaPipeline}: ${stageMeta?.nome || 'Atualização'}`,
        mensagem: `Seu processo "${updated.titulo}" avançou para a Etapa ${patch.etapaPipeline} (${stageMeta?.nome || 'Nova etapa'}). Acesse o Portal do Cliente para acompanhar os próximos passos.`,
        etapaPipeline: patch.etapaPipeline,
      });
      if (res?.pushResult.sentCount) {
        extraNotice = ` (Alerta enviado ao Portal e via Push para ${res.pushResult.sentCount} dispositivo(s)).`;
      } else if (res) {
        extraNotice = ' (Alerta registrado no Portal do Cliente).';
      }
    } else if (patch.relatorioViabilidadeLiberado === true && !prevViabReleased) {
      await emitClientProcessAlert({
        caseObj: updated,
        tipo: 'parecer',
        titulo: 'Parecer Técnico de Viabilidade disponível',
        mensagem: `O Parecer Técnico do seu processo "${updated.titulo}" foi liberado para consulta e exportação em PDF no Portal do Cliente.`,
      });
      extraNotice = ' (Cliente notificado no Portal).';
    }

    setFeedback(`Dados do caso atualizados.${extraNotice}`);
    await onRefresh();
  };

  const handleSermigStatusChange = async (nextStatus: Case['statusSermig'], note?: string) => {
    if (!activeCase) return;
    const statusChanged = nextStatus !== activeCase.statusSermig;
    const cleanNote = note?.trim();
    const entry = {
      status: nextStatus,
      data: new Date().toISOString(),
      nota: cleanNote || undefined,
      autor: userProfile.nome || userProfile.email,
    };
    const nextHist = [...(activeCase.historicoStatusSermig || []), entry];
    await handleSaveCaseField({ statusSermig: nextStatus, historicoStatusSermig: nextHist }, 'statusSermig');
    if (statusChanged || cleanNote) {
      await emitClientProcessAlert({
        caseObj: { ...activeCase, statusSermig: nextStatus },
        tipo: 'status_sermig',
        titulo: `Status SERMIG atualizado: ${nextStatus}`,
        mensagem: cleanNote
          ? `Nova atualização do SERMIG no processo "${activeCase.titulo}" (${nextStatus}): ${cleanNote}`
          : `O status do seu processo "${activeCase.titulo}" no SERMIG foi atualizado para "${nextStatus}".`,
        statusSermig: nextStatus,
      });
    }
    setSermigStatusNote('');
  };

  // Dados filtrados do caso ativo
  const caseDocs = useMemo(() => (activeCase ? docs.filter((d) => d.caseId === activeCase.id) : []), [docs, activeCase]);
  const caseDependents = useMemo(
    () => (activeCase ? dependents.filter((d) => d.clientId === activeCase.clientId) : []),
    [dependents, activeCase],
  );
  const caseTasks = useMemo(() => (activeCase ? tasks.filter((t) => t.caseId === activeCase.id) : []), [tasks, activeCase]);
  const caseDeadlines = useMemo(
    () => (activeCase ? deadlines.filter((d) => d.caseId === activeCase.id) : []),
    [deadlines, activeCase],
  );
  const caseAppointments = useMemo(
    () => (activeCase ? appointments.filter((a) => a.caseId === activeCase.id) : []),
    [appointments, activeCase],
  );
  const caseComms = useMemo(
    () => (activeCase ? communicationLogs.filter((l) => l.caseId === activeCase.id || l.clientId === activeCase.clientId) : []),
    [communicationLogs, activeCase],
  );
  const caseChatLogs = useMemo(() => sortChatMessagesChronologically(caseComms), [caseComms]);
  const caseUnreadChatCount = useMemo(() => countUnreadChatForStaff(caseChatLogs), [caseChatLogs]);

  useEffect(() => {
    if (activeCase && caseTab === 'comunicacao' && caseUnreadChatCount > 0) {
      void markStaffChatQuestionsRead(caseChatLogs).catch(() => undefined);
    }
  }, [activeCase, caseTab, caseUnreadChatCount, caseChatLogs]);
  const caseAssessments = useMemo(
    () => (activeCase ? viabilityAssessments.filter((v) => v.caseId === activeCase.id).sort((a, b) => b.versao - a.versao) : []),
    [viabilityAssessments, activeCase],
  );
  const caseFinancial = useMemo(
    () => (activeCase && !isAssistente ? caseFinancials.find((f) => f.caseId === activeCase.id) || null : null),
    [caseFinancials, activeCase, isAssistente],
  );
  const caseBudgets = useMemo(
    () => (activeCase && !isAssistente ? budgets.filter((b) => b.caseId === activeCase.id || b.clientId === activeCase.clientId) : []),
    [budgets, activeCase, isAssistente],
  );
  const caseFinRecords = useMemo(
    () => (activeCase && !isAssistente ? financialRecords.filter((f) => f.caseId === activeCase.id || f.clientId === activeCase.clientId) : []),
    [financialRecords, activeCase, isAssistente],
  );
  const caseLogs = useMemo(
    () => (activeCase ? auditLogs.filter((l) => l.entidadeId === activeCase.id || l.depois?.includes(activeCase.id)) : []),
    [auditLogs, activeCase],
  );

  const thermo = useMemo(
    () => calcularTermometroDocumentos(caseDocs, empresa.bloqueioProtocoloMinimo || 100),
    [caseDocs, empresa.bloqueioProtocoloMinimo],
  );

  const caseCtx = useMemo(() => {
    if (!activeCase) return null;
    const pendingDocsCount = caseDocs.filter((d) => d.status !== 'Aprovado').length;
    const hasRelocationTasks = caseTasks.some((t) => t.titulo.startsWith('[Relocation]'));
    return getCaseContextConfig({
      caseObj: activeCase,
      role,
      dependentsCount: caseDependents.length,
      docsCount: caseDocs.length,
      pendingDocsCount,
      docReadinessPct: thermo.notaGeral,
      minProtocolReadinessPct: empresa.bloqueioProtocoloMinimo || 100,
      unreadChatCount: caseUnreadChatCount,
      hasRelocationTasks,
      forceTabs: forcedOptionalTabs,
      showAllFields: showAllCaseFields,
    });
  }, [
    activeCase,
    role,
    caseDependents.length,
    caseDocs,
    caseTasks,
    thermo.notaGeral,
    empresa.bloqueioProtocoloMinimo,
    caseUnreadChatCount,
    forcedOptionalTabs,
    showAllCaseFields,
  ]);

  useEffect(() => {
    if (!caseCtx) return;
    if (!caseCtx.visibleTabs.some((t) => t.id === caseTab)) {
      setCaseTab('resumo');
    }
  }, [caseCtx, caseTab]);

  useEffect(() => {
    if (!caseCtx) return;
    setParecerExpanded(caseCtx.fields.parecerExpandedByDefault || Boolean(parecerDraft));
  }, [activeCase?.id, caseCtx?.fields.parecerExpandedByDefault]);

  useEffect(() => {
    if (!caseCtx) return;
    if (!caseCtx.relevantDeadlineTypes.includes(newDeadlineTipo)) {
      setNewDeadlineTipo(caseCtx.relevantDeadlineTypes[0] || 'Validade Documento');
    }
  }, [caseCtx, newDeadlineTipo]);

  const activeVisaCategory = useMemo(
    () => visaCategories.find((v) => v.id === activeCase?.visaCategoryId) || null,
    [visaCategories, activeCase],
  );

  const activeCaseLegalSources = useMemo(() => {
    const ids = activeVisaCategory?.legalSourceIds || [];
    if (ids.length > 0) {
      const matched = legalSources.filter((s) => ids.includes(s.id));
      if (matched.length > 0) return matched;
    }
    return legalSources;
  }, [activeVisaCategory, legalSources]);

  const activeVisaReqs = useMemo(() => {
    if (!activeCase?.visaCategoryId) return [];
    return visaRequirements.filter((r) => r.visaCategoryId === activeCase.visaCategoryId);
  }, [visaRequirements, activeCase]);

  const schedulePreview = useMemo(
    () => gerarCronogramaEmissao(activeVisaReqs, dataAlvoProtocolo),
    [activeVisaReqs, dataAlvoProtocolo],
  );

  // ===========================================================================
  // Mudança de etapa com verificação de bloqueio mínimo + contrato + apostilas + tarefas padrão
  // ===========================================================================
  const createDefaultStageTasks = async (targetStage: number, caseObj: Case) => {
    const stageMeta = PIPELINE_STAGES.find((p) => p.numero === targetStage);
    if (!stageMeta) return;
    for (const tarefaNome of stageMeta.tarefasPadrao) {
      if (caseTasks.some((t) => t.titulo === tarefaNome)) continue;
      const tId = makeId('task');
      await saveDocumentAudited(
        'tasks',
        tId,
        {
          id: tId,
          titulo: tarefaNome,
          caseId: caseObj.id,
          clientId: caseObj.clientId,
          prioridade: 'Média',
          status: 'Pendente',
          createdAt: new Date().toISOString(),
        },
        true,
        role,
        'tarefa_etapa',
      );
    }
  };

  const handleStageChange = async (targetStage: number) => {
    if (!activeCase) return;
    setErrorMsg(null);
    if (targetStage >= 7 && !activeCase.overrideProtocoloMinimo) {
      const reasons: string[] = [];
      if (thermo.bloqueadoProtocolo) {
        reasons.push(`Termômetro documental em ${thermo.notaGeral}% (mínimo exigido: ${empresa.bloqueioProtocoloMinimo || 100}%).`);
      }
      const hasSignedContract =
        Boolean(activeCase.dataContrato) ||
        generatedDocuments.some(
          (g) =>
            g.clientId === activeCase.clientId &&
            (!g.caseId || g.caseId === activeCase.id) &&
            (g.tipo === 'contrato' || g.tipo === 'procuracao') &&
            (g.status === 'Assinado' || Boolean(g.assinadoEm)) &&
            !g.canceladoEm,
        );
      if (!hasSignedContract) {
        reasons.push('Nenhum contrato assinado ou data de contrato registrada para o caso.');
      }
      const pendingApostilles = caseDocs.filter((d) => d.obrigatorio && d.exigeApostila && !d.apostilado);
      if (pendingApostilles.length > 0) {
        reasons.push(`${pendingApostilles.length} documento(s) obrigatório(s) ainda aguardam Apostila de Haia.`);
      }
      if (reasons.length > 0) {
        if (!isAdmin) {
          setErrorMsg(
            `Protocolo bloqueado na Etapa ${targetStage}: ${reasons.join(' ')} Somente um Administrador pode autorizar override.`,
          );
          return;
        }
        setOverrideModal({ targetStage, reasons, justificativa: '' });
        return;
      }
    }
    await handleSaveCaseField({ etapaPipeline: targetStage }, 'etapaPipeline');
    await createDefaultStageTasks(targetStage, activeCase);
  };

  const handleConfirmOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModal || !overrideModal.justificativa.trim() || !activeCase || !isAdmin) return;
    await handleSaveCaseField(
      {
        etapaPipeline: overrideModal.targetStage,
        overrideProtocoloMinimo: {
          autorizadoPor: userProfile.nome || userProfile.email,
          justificativa: overrideModal.justificativa.trim(),
          data: new Date().toISOString(),
        },
      },
      'override_protocolo_minimo',
    );
    await createDefaultStageTasks(overrideModal.targetStage, activeCase);
    setOverrideModal(null);
  };

  const handleGenerateAutomaticDeadlines = async () => {
    if (!activeCase) return;
    let created = 0;
    const ensureDeadline = async (titulo: string, tipo: Deadline['tipo'], dataLimite: string) => {
      if (!dataLimite) return;
      if (deadlines.some((d) => d.caseId === activeCase.id && d.titulo === titulo && d.dataLimite === dataLimite)) return;
      const dlId = makeId('dl');
      await saveDocumentAudited(
        'deadlines',
        dlId,
        {
          id: dlId,
          titulo,
          tipo,
          dataLimite,
          caseId: activeCase.id,
          clientId: activeCase.clientId,
          concluido: false,
        },
        true,
        role,
        'prazo_automatico',
      );
      created += 1;
    };

    for (const d of caseDocs) {
      if (d.dataValidadeCalculada) {
        await ensureDeadline(`Vencimento: ${d.nomeDocumento} (${d.pessoa})`, 'Validade Documento', d.dataValidadeCalculada);
      }
    }
    if (activeClient?.passaporte?.validade) {
      await ensureDeadline(`Validade Passaporte — ${activeClient.nomeCompleto}`, 'Validade Passaporte', activeClient.passaporte.validade);
    }
    for (const dep of caseDependents) {
      if (dep.passaporteValidade) {
        await ensureDeadline(`Validade Passaporte — ${dep.nomeCompleto}`, 'Validade Passaporte', dep.passaporteValidade);
      }
    }
    if (activeCase.dataLimiteEntrada) {
      await ensureDeadline('Data limite de entrada no Chile (90 dias do Estampado)', 'Entrada no Chile 90d', activeCase.dataLimiteEntrada);
    }
    if (activeCase.dataVencimentoResidencia) {
      const dt = parseFlexibleDate(activeCase.dataVencimentoResidencia);
      if (dt) {
        await ensureDeadline('Início janela Prorrogação/Definitiva (90 dias antes)', 'Janela Prorrogação', toIsoDate(new Date(dt.getTime() - 90 * 86400000)));
        await ensureDeadline('Fim janela Prorrogação/Definitiva (10 dias antes)', 'Janela Prorrogação', toIsoDate(new Date(dt.getTime() - 10 * 86400000)));
      }
    }
    if (activeCase.dataProtocolo) {
      const dt = parseFlexibleDate(activeCase.dataProtocolo);
      if (dt) {
        await ensureDeadline('Prazo legal 180 dias SERMIG (Ley 19.880)', 'Prazo Legal 6 Meses SERMIG', toIsoDate(new Date(dt.getTime() + 180 * 86400000)));
      }
    }
    if (activeCase.prazoRequerimento) {
      await ensureDeadline('Prazo Requerimento / Descargos SERMIG', 'Resposta Requerimento/Recurso', activeCase.prazoRequerimento);
    }
    setFeedback(created > 0 ? `${created} prazo(s) automático(s) gerado(s) com sucesso!` : 'Todos os prazos calculáveis já estão cadastrados.');
    await onRefresh();
  };

  const handleDuplicateCaseStructure = async () => {
    if (!activeCase) return;
    const id = makeId('case');
    const clone: Case = {
      id,
      titulo: `${activeCase.titulo} (Cópia estrutura)`,
      clientId: activeCase.clientId,
      consultorId: userProfile.uid,
      tipoServico: activeCase.tipoServico,
      visaCategoryId: activeCase.visaCategoryId,
      etapaPipeline: 2,
      statusSermig: 'Não protocolado',
      portalLiberado: activeCase.portalLiberado,
      relatorioViabilidadeLiberado: false,
      prioridade: activeCase.prioridade,
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('cases', id, clone as unknown as Record<string, unknown>, true, role, 'duplicar_caso');
    for (const d of caseDocs) {
      const dId = makeId('doc');
      const docCopy: CaseDocument = {
        id: dId,
        caseId: id,
        clientId: activeCase.clientId,
        pessoa: d.pessoa,
        visaRequirementId: d.visaRequirementId,
        nomeDocumento: d.nomeDocumento,
        categoriaDoc: d.categoriaDoc,
        etapaEsteira: '1 Aguardando Envio',
        ordemEmissao: d.ordemEmissao,
        status: 'Pendente',
        validadeDias: d.validadeDias,
        apostilado: false,
        traduzido: false,
        exigeApostila: d.exigeApostila,
        exigeTraducao: d.exigeTraducao,
        obrigatorio: d.obrigatorio,
        peso: d.peso,
        versao: 1,
      };
      await saveDocumentAudited('caseDocuments', dId, docCopy as unknown as Record<string, unknown>, true, role, 'duplicar_doc_checklist');
    }
    setFeedback('Estrutura do caso e checklist duplicados sem arquivos pessoais.');
    await onRefresh();
    onSelectCase(id);
  };

  const handleCloseCaseConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !closeCaseReason.trim()) return;
    await handleSaveCaseField(
      {
        etapaPipeline: 15,
        motivoEncerramento: closeCaseReason.trim(),
        encerradoEm: new Date().toISOString(),
      },
      'encerrar_caso',
    );
    setCloseCaseModalOpen(false);
    setCloseCaseReason('');
  };

  // ===========================================================================
  // Parecer Técnico IA (Admin/Consultor)
  // ===========================================================================
  const handleGenerateAiParecer = async () => {
    if (!activeCase || !activeClient || isAssistente || aiParecerLoading) return;
    setAiParecerLoading(true);
    setAiParecerProgress('Iniciando consulta à IA...');
    setErrorMsg(null);
    try {
      const resp = await callAiEndpoint<
        AiResponseMeta & {
          enquadramentoLegal: string;
          elegibilidadeRiscos: string;
          fundamentacaoNormativa: string;
          recomendacoes: string;
        }
      >(
        '/api/ai/parecer',
        {
          caseData: compactCaseForAi(activeCase as unknown as Record<string, unknown>),
          clientData: compactClientForAi(activeClient as unknown as Record<string, unknown>),
          dependents: caseDependents.slice(0, 12),
          legalSources: compactLegalSourcesForAi(legalSources),
        },
        {
          onProgress: (msg) => setAiParecerProgress(msg),
        },
      );
      updateParecerDraft({
        fallback: resp.fallback,
        origem: resp.origem,
        origemLabel: resp.origemLabel,
        mensagemUsuario: resp.mensagemUsuario,
        enquadramentoLegal: resp.enquadramentoLegal || '',
        elegibilidadeRiscos: resp.elegibilidadeRiscos || '',
        fundamentacaoNormativa: resp.fundamentacaoNormativa || '',
        recomendacoes: resp.recomendacoes || '',
        notaGeral: activeCase.notaViabilidadeGeral || thermo.notaGeral || 85,
        liberadoAoCliente: false,
      });
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    } finally {
      setAiParecerLoading(false);
      setAiParecerProgress(null);
    }
  };

  const handleSaveParecerDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !parecerDraft || isAssistente) return;
    const id = makeId('viab');
    const nextVersion = (caseAssessments[0]?.versao || 0) + 1;
    const record: ViabilityAssessment = {
      id,
      caseId: activeCase.id,
      clientId: activeCase.clientId,
      versao: nextVersion,
      enquadramentoLegal: parecerDraft.enquadramentoLegal,
      elegibilidadeRiscos: parecerDraft.elegibilidadeRiscos,
      fundamentacaoNormativa: parecerDraft.fundamentacaoNormativa,
      recomendacoes: parecerDraft.recomendacoes,
      notaGeral: parecerDraft.notaGeral,
      rascunhoIa: parecerDraft.origem !== 'regras',
      liberadoAoCliente: parecerDraft.liberadoAoCliente,
      autorNome: userProfile.nome || userProfile.email,
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('viabilityAssessments', id, record as unknown as Record<string, unknown>, true, role, 'parecer_tecnico');
    if (parecerDraft.liberadoAoCliente && !activeCase.relatorioViabilidadeLiberado) {
      await handleSaveCaseField({ relatorioViabilidadeLiberado: true, parecerConsultor: parecerDraft.recomendacoes }, 'liberar_parecer');
    } else {
      await onRefresh();
    }
    updateParecerDraft(null);
    setFeedback(`Parecer Técnico v${nextVersion} aprovado e salvo.`);
  };

  // ===========================================================================
  // Documentos do Caso & Cronograma
  // ===========================================================================
  const handleGenerateChecklistDocs = async () => {
    if (!activeCase) return;
    const reqs = visaRequirements.filter((r) => r.visaCategoryId === (activeCase.visaCategoryId || 'visa_15_mercosul'));
    if (reqs.length === 0) {
      setErrorMsg('Esta subcategoria não possui requisitos padrão cadastrados ainda.');
      return;
    }
    const pessoas = ['Titular', ...caseDependents.map((d) => d.nomeCompleto)];
    const sched = gerarCronogramaEmissao(reqs, dataAlvoProtocolo);
    let created = 0;

    for (const pessoa of pessoas) {
      const targetReqs =
        pessoa === 'Titular'
          ? sched
          : gerarCronogramaEmissao(
              visaRequirements.filter((r) => r.visaCategoryId === 'fluxo_dependente'),
              dataAlvoProtocolo,
            );
      const listToUse = targetReqs.length > 0 ? targetReqs : sched;
      for (const item of listToUse) {
        const exists = caseDocs.some(
          (d) => d.pessoa === pessoa && d.nomeDocumento === item.requirement.nomeDocumento,
        );
        if (exists) continue;
        const id = makeId('doc');
        const newDoc: CaseDocument = {
          id,
          caseId: activeCase.id,
          clientId: activeCase.clientId,
          pessoa,
          visaRequirementId: item.requirement.id,
          nomeDocumento: item.requirement.nomeDocumento,
          categoriaDoc: item.requirement.categoriaDoc,
          etapaEsteira: '1 Aguardando Envio',
          ordemEmissao: item.ordem,
          prazoSugeridoEmissao: item.dataSugeridaIso,
          status: 'Pendente',
          validadeDias: item.requirement.validadeDias,
          apostilado: false,
          traduzido: false,
          exigeApostila: item.requirement.exigeApostila,
          exigeTraducao: item.requirement.exigeTraducao,
          obrigatorio: item.requirement.obrigatorio,
          peso: item.requirement.peso,
          versao: 1,
        };
        await saveDocumentAudited('caseDocuments', id, newDoc as unknown as Record<string, unknown>, true, role, 'gerar_checklist');
        created++;
      }
    }
    setFeedback(created > 0 ? `${created} item(ns) documental(is) adicionados ao checklist.` : 'Checklist já completo para titular e dependentes.');
    await onRefresh();
  };

  const handleApplyCronogramaDatas = async () => {
    for (const item of schedulePreview) {
      const matching = caseDocs.filter((d) => d.visaRequirementId === item.requirement.id || d.nomeDocumento === item.requirement.nomeDocumento);
      for (const d of matching) {
        await saveDocumentAudited(
          'caseDocuments',
          d.id,
          { ...d, ordemEmissao: item.ordem, prazoSugeridoEmissao: item.dataSugeridaIso },
          false,
          role,
          'cronograma_emissao',
        );
      }
    }
    setFeedback('Datas sugeridas do cronograma reverso aplicadas ao checklist!');
    await onRefresh();
  };

  const handleAddManualDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !newDocName.trim()) return;
    const id = makeId('doc');
    const newDoc: CaseDocument = {
      id,
      caseId: activeCase.id,
      clientId: activeCase.clientId,
      pessoa: newDocPessoa || 'Titular',
      nomeDocumento: newDocName.trim(),
      categoriaDoc: 'Identidade',
      etapaEsteira: '1 Aguardando Envio',
      ordemEmissao: caseDocs.length + 1,
      status: 'Pendente',
      validadeDias: 0,
      apostilado: false,
      traduzido: false,
      exigeApostila: false,
      exigeTraducao: false,
      obrigatorio: true,
      peso: 3,
      versao: 1,
    };
    await saveDocumentAudited('caseDocuments', id, newDoc as unknown as Record<string, unknown>, true, role, 'doc_manual');
    setNewDocName('');
    await onRefresh();
  };

  const handleUpdateDoc = async (docItem: CaseDocument, patch: Partial<CaseDocument>) => {
    const next: CaseDocument = {
      ...docItem,
      ...patch,
      analisadoPor: userProfile.nome || userProfile.email,
      analisadoEm: new Date().toISOString(),
    };
    if ((patch.dataEmissao !== undefined || patch.validadeDias !== undefined) && next.validadeDias > 0 && next.dataEmissao) {
      const dt = parseFlexibleDate(next.dataEmissao);
      if (dt) {
        next.dataValidadeCalculada = toIsoDate(new Date(dt.getTime() + next.validadeDias * 86400000));
      }
    }
    if (patch.status === 'Aprovado') {
      const needsApostilleOrTranslation =
        (next.exigeApostila && !next.apostilado) || (next.exigeTraducao && !next.traduzido);
      if (needsApostilleOrTranslation) {
        next.etapaEsteira = '5 Pronto para Apostila/Tradução';
        if (activeCase) {
          const pendItems: string[] = [];
          if (next.exigeApostila && !next.apostilado) pendItems.push('Apostila de Haia');
          if (next.exigeTraducao && !next.traduzido) pendItems.push('Tradução Juramentada');
          const taskTitle = `Providenciar ${pendItems.join(' e ')}: ${next.nomeDocumento} (${next.pessoa})`;
          if (!caseTasks.some((t) => t.titulo === taskTitle)) {
            const tId = makeId('task');
            await saveDocumentAudited(
              'tasks',
              tId,
              {
                id: tId,
                titulo: taskTitle,
                caseId: activeCase.id,
                clientId: activeCase.clientId,
                prioridade: 'Alta',
                status: 'Pendente',
                createdAt: new Date().toISOString(),
              },
              true,
              role,
              'auto_rota_apostila',
            );
          }
        }
      } else {
        next.etapaEsteira = '6 Aprovado para Protocolo';
      }
      next.motivoReprovacao = '';
    } else if (patch.status === 'Reprovado') {
      next.etapaEsteira = '4 Pendência/Reprovado';
    }
    await saveDocumentAudited('caseDocuments', docItem.id, next as unknown as Record<string, unknown>, false, role, 'documento_caso', docItem);
    if (activeCase && patch.status && patch.status !== docItem.status && (patch.status === 'Aprovado' || patch.status === 'Reprovado')) {
      await emitClientProcessAlert({
        caseObj: activeCase,
        tipo: 'documento',
        titulo:
          patch.status === 'Aprovado'
            ? `Documento aprovado: ${next.nomeDocumento}`
            : `Documento com pendência: ${next.nomeDocumento}`,
        mensagem:
          patch.status === 'Aprovado'
            ? `O documento "${next.nomeDocumento}" (${next.pessoa}) foi conferido e aprovado pela equipe.`
            : `O documento "${next.nomeDocumento}" (${next.pessoa}) precisa de atenção${next.motivoReprovacao ? `: ${next.motivoReprovacao}` : '. Acesse o Portal do Cliente para reenviar.'}`,
      });
    }
    await onRefresh();
  };

  const handleSaveFullDocModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !editingDoc || !editingDoc.nomeDocumento?.trim()) return;
    const isNew = !caseDocs.some((d) => d.id === editingDoc.id);
    const validadeDias = Number(editingDoc.validadeDias || 0);
    let dataValidadeCalculada = editingDoc.dataValidadeCalculada || '';
    if (editingDoc.dataEmissao && validadeDias > 0) {
      const dt = parseFlexibleDate(editingDoc.dataEmissao);
      if (dt) dataValidadeCalculada = toIsoDate(new Date(dt.getTime() + validadeDias * 86400000));
    }
    const docId = editingDoc.id || makeId('doc');
    const payload: CaseDocument = {
      id: docId,
      caseId: activeCase.id,
      clientId: activeCase.clientId,
      pessoa: editingDoc.pessoa || 'Titular',
      visaRequirementId: editingDoc.visaRequirementId,
      nomeDocumento: editingDoc.nomeDocumento.trim(),
      categoriaDoc: (editingDoc.categoriaDoc as DocCategory) || 'Identidade',
      etapaEsteira: (editingDoc.etapaEsteira as DocumentStep) || '1 Aguardando Envio',
      ordemEmissao: Number(editingDoc.ordemEmissao || caseDocs.length + 1),
      prazoSugeridoEmissao: editingDoc.prazoSugeridoEmissao || '',
      arquivoUrl: editingDoc.arquivoUrl,
      arquivoNome: editingDoc.arquivoNome,
      anexos: editingDoc.anexos || [],
      status: editingDoc.status || 'Pendente',
      dataEmissao: editingDoc.dataEmissao || '',
      validadeDias,
      dataValidadeCalculada,
      orgaoEmissor: editingDoc.orgaoEmissor || '',
      apostilado: Boolean(editingDoc.apostilado),
      traduzido: Boolean(editingDoc.traduzido),
      exigeApostila: Boolean(editingDoc.exigeApostila),
      exigeTraducao: Boolean(editingDoc.exigeTraducao),
      obrigatorio: editingDoc.obrigatorio ?? true,
      peso: Number(editingDoc.peso || 3),
      motivoReprovacao: editingDoc.motivoReprovacao || '',
      observacoes: editingDoc.observacoes || '',
      versao: editingDoc.versao || 1,
      historicoVersoes: editingDoc.historicoVersoes || [],
    };
    const prevDoc = caseDocs.find((d) => d.id === docId);
    await saveDocumentAudited('caseDocuments', docId, payload as unknown as Record<string, unknown>, isNew, role, 'documento_modal');
    if (payload.status !== prevDoc?.status && (payload.status === 'Aprovado' || payload.status === 'Reprovado')) {
      await emitClientProcessAlert({
        caseObj: activeCase,
        tipo: 'documento',
        titulo:
          payload.status === 'Aprovado'
            ? `Documento aprovado: ${payload.nomeDocumento}`
            : `Documento com pendência: ${payload.nomeDocumento}`,
        mensagem:
          payload.status === 'Aprovado'
            ? `O documento "${payload.nomeDocumento}" (${payload.pessoa}) foi aprovado pela consultoria.`
            : `O documento "${payload.nomeDocumento}" (${payload.pessoa}) apresentou pendência${payload.motivoReprovacao ? `: ${payload.motivoReprovacao}` : '. Confira no Portal do Cliente.'}`,
      });
    }
    setDocModalOpen(false);
    setEditingDoc(null);
    setFeedback(`Documento "${payload.nomeDocumento}" salvo.`);
    await onRefresh();
  };

  const handleUploadDocStaff = async (docItem: CaseDocument, files: FileList | File[]) => {
    const fileArr = Array.from(files);
    if (fileArr.length === 0) return;
    setUploadingDocId(docItem.id);
    setErrorMsg(null);
    try {
      const uploadedItems: { nome: string; url: string; data: string; tamanhoBytes?: number }[] = [];
      for (const f of fileArr) {
        if (f.size > 10 * 1024 * 1024) {
          throw new Error(`O arquivo "${f.name}" excede 10 MB.`);
        }
        const uploaded = await uploadFileToServer(f);
        uploadedItems.push({ nome: uploaded.filename, url: uploaded.url, data: new Date().toISOString(), tamanhoBytes: f.size });
      }
      const primary = uploadedItems[0];
      const prevHist = docItem.historicoVersoes || [];
      const nextHist = docItem.arquivoUrl
        ? [...prevHist, { versao: docItem.versao, arquivoUrl: docItem.arquivoUrl, data: new Date().toISOString() }]
        : prevHist;
      const mergedAnexos = [...(docItem.anexos || []), ...uploadedItems];
      await handleUpdateDoc(docItem, {
        arquivoUrl: primary.url,
        arquivoNome: primary.nome,
        anexos: mergedAnexos,
        status: 'Em análise',
        etapaEsteira: '3 Em Conferência',
        versao: docItem.arquivoUrl ? docItem.versao + 1 : docItem.versao,
        historicoVersoes: nextHist,
      });
      setFeedback(`${uploadedItems.length} arquivo(s) anexado(s) ao documento "${docItem.nomeDocumento}".`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro no upload.');
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleBatchDocAction = async (
    action: 'aprovar' | 'apostilado' | 'traduzido' | 'complementacao',
  ) => {
    const targets = caseDocs.filter((d) => selectedDocIds.includes(d.id));
    if (targets.length === 0) return;
    for (const d of targets) {
      if (action === 'aprovar') await handleUpdateDoc(d, { status: 'Aprovado' });
      if (action === 'apostilado') await handleUpdateDoc(d, { apostilado: true });
      if (action === 'traduzido') await handleUpdateDoc(d, { traduzido: true });
      if (action === 'complementacao') {
        await handleUpdateDoc(d, {
          status: 'Reprovado',
          motivoReprovacao: d.motivoReprovacao || 'Solicitada complementação ou novo arquivo legível.',
        });
      }
    }
    setSelectedDocIds([]);
    setFeedback(`Ação em lote aplicada em ${targets.length} documento(s).`);
  };

  const handleDownloadCaseZip = async (subsetPessoa?: string) => {
    if (!activeCase) return;
    setZipBusy(true);
    try {
      const docsToPack = subsetPessoa && subsetPessoa !== 'Todos' ? caseDocs.filter((d) => d.pessoa === subsetPessoa) : caseDocs;
      const entries: ZipEntryInput[] = [];
      const indexLines = [
        `D&M Integra Chile — Pacote Documental`,
        `Caso: ${activeCase.titulo}`,
        `Cliente: ${activeClient?.nomeCompleto || ''}`,
        `Filtro Pessoa: ${subsetPessoa || 'Todos'}`,
        `Gerado em: ${new Date().toISOString()}`,
        '',
      ];
      for (const d of docsToPack) {
        indexLines.push(`- [${d.pessoa}] ${d.nomeDocumento} | Status: ${d.status} | Emissao: ${formatDateBR(d.dataEmissao)}`);
        if (d.arquivoUrl) {
          void logSensitiveDocumentAccess(d, 'baixar', role);
          const ext = d.arquivoNome?.split('.').pop() || 'pdf';
          const stdName = formatStandardDocFilename(d.pessoa, d.nomeDocumento, d.dataEmissao, ext);
          try {
            const resp = await fetch(d.arquivoUrl);
            if (resp.ok) {
              const buf = new Uint8Array(await resp.arrayBuffer());
              entries.push({ name: `${d.pessoa}/${stdName}`, data: buf });
            }
          } catch {
            entries.push({ name: `${d.pessoa}/${stdName}.url.txt`, data: d.arquivoUrl });
          }
        }
      }
      entries.unshift({ name: '00_INDICE_DOSSIE.txt', data: indexLines.join('\n') });
      const blob = buildZipBlob(entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formatStandardDocFilename(activeClient?.nomeCompleto || 'Caso', subsetPessoa || 'Dossie', toIsoDate(new Date()), 'zip')}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback('Pacote ZIP gerado com índice e nomes padronizados.');
    } finally {
      setZipBusy(false);
    }
  };

  const handleAnalyzeDocIa = async (docItem: CaseDocument) => {
    if (aiDocLoadingId) return;
    setAiDocLoadingId(docItem.id);
    setAiDocProgress('Analisando anexo...');
    setErrorMsg(null);
    try {
      let fileBase64: string | undefined;
      let mimeType: string | undefined;

      if (docItem.arquivoUrl && !docItem.arquivoUrl.startsWith('data:')) {
        try {
          const fileResp = await fetch(docItem.arquivoUrl);
          if (fileResp.ok) {
            const blob = await fileResp.blob();
            if (blob.size > 0) {
              const prepared = await prepareAiAttachment(blob);
              fileBase64 = prepared.fileBase64;
              mimeType = prepared.mimeType;
            }
          }
        } catch (prepErr) {
          if (prepErr instanceof Error && prepErr.message.includes('excede o limite')) {
            throw prepErr;
          }
          // Segue com arquivoUrl / observação quando o fetch direto não estiver disponível
        }
      }

      const resp = await callAiEndpoint<
        AiResponseMeta & {
          nomeIdentificado: string;
          dataEmissao: string;
          orgaoEmissor: string;
          idioma: string;
          possuiApostila: boolean;
          legibilidade: string;
          sugestao: string;
          justificativa: string;
        }
      >(
        '/api/ai/analisar-documento',
        {
          nomeEsperado: docItem.nomeDocumento,
          arquivoUrl: docItem.arquivoUrl || '',
          ...(fileBase64 && mimeType ? { fileBase64, mimeType } : {}),
          textoObservacao: `Arquivo: ${docItem.arquivoNome || 'Não informado'} | Apostilado marcado: ${docItem.apostilado} | Emissão informada: ${docItem.dataEmissao || 'Não informada'}`,
        },
        {
          onProgress: (msg) => setAiDocProgress(msg),
        },
      );
      const tag =
        resp.fallback || resp.origem === 'regras'
          ? `[${resp.origemLabel || 'Rascunho gerado por regras — IA indisponível no momento'} · Sugestão: ${resp.sugestao}]`
          : `[Sugestão IA: ${resp.sugestao}]`;
      const resumo = `${tag} Órgão: ${resp.orgaoEmissor} · Emissão: ${resp.dataEmissao} · Apostila: ${resp.possuiApostila ? 'Sim' : 'Não'} · ${resp.justificativa}`;
      await handleUpdateDoc(docItem, { analiseIaSugestao: resumo });
      setFeedback(
        resp.fallback || resp.origem === 'regras'
          ? `${resp.origemLabel || 'Rascunho gerado por regras — IA indisponível no momento'}. ${resp.mensagemUsuario || 'A decisão final permanece com o analista.'}`
          : 'Pré-análise sugestiva da IA concluída. A decisão final permanece com o analista.',
      );
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    } finally {
      setAiDocLoadingId(null);
      setAiDocProgress(null);
    }
  };

  // ===========================================================================
  // Dependentes, Agenda, Comunicação, Relocation e Financeiro do Caso
  // ===========================================================================
  const handleAddDependent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !depForm.nomeCompleto.trim() || isAssistente) return;
    const id = makeId('dep');
    const payload: Dependent = {
      id,
      clientId: activeCase.clientId,
      nomeCompleto: depForm.nomeCompleto.trim(),
      parentesco: depForm.parentesco,
      idade: depForm.idade ? Number(depForm.idade) : undefined,
      estudante: depForm.estudante,
      passaporteNumero: depForm.passaporteNumero,
      passaporteValidade: depForm.passaporteValidade || undefined,
    };
    await saveDocumentAudited('dependents', id, payload as unknown as Record<string, unknown>, true, role, 'dependente');
    setDepForm({ nomeCompleto: '', parentesco: 'Cônjuge', idade: '', estudante: false, passaporteNumero: '', passaporteValidade: '' });
    await onRefresh();
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !newTaskTitle.trim()) return;
    const id = makeId('task');
    const payload: Task = {
      id,
      titulo: newTaskTitle.trim(),
      caseId: activeCase.id,
      clientId: activeCase.clientId,
      prazo: newTaskPrazo,
      prioridade: 'Alta',
      status: 'Pendente',
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('tasks', id, payload as unknown as Record<string, unknown>, true, role, 'tarefa');
    setNewTaskTitle('');
    setNewTaskPrazo('');
    await onRefresh();
  };

  const handleGenerateRelocationTasks = async () => {
    if (!activeCase) return;
    for (const titulo of RELOCATION_DEFAULT_ITEMS) {
      if (caseTasks.some((t) => t.titulo === titulo)) continue;
      const id = makeId('task');
      const payload: Task = {
        id,
        titulo,
        caseId: activeCase.id,
        clientId: activeCase.clientId,
        prioridade: 'Média',
        status: 'Pendente',
        createdAt: new Date().toISOString(),
      };
      await saveDocumentAudited('tasks', id, payload as unknown as Record<string, unknown>, true, role, 'relocation_task');
    }
    setFeedback('Checklist operacional de Relocation gerado.');
    await onRefresh();
  };

  const handleAddDeadline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !newDeadlineTitle.trim() || !newDeadlineDate) return;
    const id = makeId('dl');
    const payload: Deadline = {
      id,
      titulo: newDeadlineTitle.trim(),
      tipo: newDeadlineTipo,
      dataLimite: newDeadlineDate,
      caseId: activeCase.id,
      clientId: activeCase.clientId,
      concluido: false,
    };
    await saveDocumentAudited('deadlines', id, payload as unknown as Record<string, unknown>, true, role, 'prazo');
    setNewDeadlineTitle('');
    setNewDeadlineDate('');
    await onRefresh();
  };

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !newAptTitle.trim() || !newAptDate) return;
    const id = makeId('apt');
    const payload: Appointment = {
      id,
      titulo: newAptTitle.trim(),
      dataHoraInicio: newAptDate,
      tipo: newAptTipo,
      caseId: activeCase.id,
      clientId: activeCase.clientId,
      status: 'Agendado',
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('appointments', id, payload as unknown as Record<string, unknown>, true, role, 'agendamento');
    setNewAptTitle('');
    setNewAptDate('');
    await onRefresh();
  };

  const handleApplyMsgTemplate = (tplId: string) => {
    setCommTplId(tplId);
    const tpl = messageTemplates.find((t) => t.id === tplId);
    if (!tpl || !activeClient || !activeCase) return;
    const filled = applyTemplateVariables(tpl.corpo, {
      nome_cliente: activeClient.nomeCompleto,
      subcategoria_visto: activeCase.titulo,
      documento_nome: caseDocs.find((d) => d.status !== 'Aprovado')?.nomeDocumento || 'Checklist do processo',
      motivo_reprovacao: caseDocs.find((d) => d.status === 'Reprovado')?.motivoReprovacao || '',
      prazo_data: formatDateBR(activeCase.prazoRequerimento || activeCase.dataLimiteEntrada || new Date()),
      valor: caseFinancial ? formatCurrency(caseFinancial.valorContrato, caseFinancial.moeda) : '',
      chave_pix: empresa.chavePix || '',
    });
    setCommMsg(filled);
  };

  const handleSendComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || !activeClient || !commMsg.trim()) return;
    if (commCanal === 'WhatsApp' && activeClient.whatsapp) {
      window.open(buildWhatsAppUrl(activeClient.whatsapp, commMsg), '_blank', 'noopener,noreferrer');
    }
    await onLogWhatsApp(activeClient.id, activeCase.id, `${commCanal}: ${activeCase.titulo}`, commMsg);
    setCommMsg('');
    setFeedback('Comunicação registrada no histórico do caso.');
  };

  const handleSaveCaseFinancial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCase || isAssistente) return;
    const valor = Number(finContractValor || 0);
    const payload: CaseFinancialSummary = {
      caseId: activeCase.id,
      clientId: activeCase.clientId,
      valorContrato: Number.isNaN(valor) ? 0 : valor,
      moeda: finContractMoeda,
      liberadoAoCliente: finContractLiberado,
    };
    await saveDocumentAudited('caseFinancials', activeCase.id, payload as unknown as Record<string, unknown>, !caseFinancial, role, 'contrato_caso');
    setFeedback('Resumo financeiro do contrato atualizado.');
    await onRefresh();
  };

  const clientDeleteSummary = useMemo(() => {
    if (!deleteClientTarget) return [];
    const cid = deleteClientTarget.id;
    return [
      `${dependents.filter((d) => d.clientId === cid).length} dependente(s)`,
      `${cases.filter((c) => c.clientId === cid).length} caso(s)`,
      `${docs.filter((d) => d.clientId === cid).length} documento(s)`,
      `${tasks.filter((t) => t.clientId === cid).length} tarefa(s) e ${deadlines.filter((dl) => dl.clientId === cid).length} prazo(s)`,
      `${budgets.filter((b) => b.clientId === cid).length} orçamento(s) e ${financialRecords.filter((f) => f.clientId === cid).length} lançamento(s)`,
      `${generatedDocuments.filter((g) => g.clientId === cid).length} contrato(s)/documento(s) gerado(s)`,
    ];
  }, [deleteClientTarget, dependents, cases, docs, tasks, deadlines, budgets, financialRecords, generatedDocuments]);

  const caseDeleteSummary = useMemo(() => {
    if (!deleteCaseTarget) return [];
    const cid = deleteCaseTarget.id;
    return [
      `${docs.filter((d) => d.caseId === cid).length} documento(s)`,
      `${tasks.filter((t) => t.caseId === cid).length} tarefa(s), ${deadlines.filter((dl) => dl.caseId === cid).length} prazo(s) e ${appointments.filter((a) => a.caseId === cid).length} reunião(ões)`,
      `${viabilityAssessments.filter((v) => v.caseId === cid).length} parecer(es) técnico(s)`,
      `${communicationLogs.filter((l) => l.caseId === cid).length} registro(s) de comunicação`,
      `${budgets.filter((b) => b.caseId === cid).length} orçamento(s) e ${financialRecords.filter((f) => f.caseId === cid).length} lançamento(s)`,
      `${generatedDocuments.filter((g) => g.caseId === cid).length} documento(s) gerado(s)`,
    ];
  }, [deleteCaseTarget, docs, tasks, deadlines, appointments, viabilityAssessments, communicationLogs, budgets, financialRecords, generatedDocuments]);

  const renderDeleteModals = () => (
    <>
      <ConfirmActionModal
        open={Boolean(confirmDeleteItem)}
        title={confirmDeleteItem?.title || 'Confirmar Exclusão'}
        description={confirmDeleteItem?.description || 'Tem certeza que deseja excluir este registro permanentemente?'}
        confirmLabel={confirmDeleteItem?.confirmLabel || 'Excluir'}
        tone="danger"
        onConfirm={async () => {
          if (!confirmDeleteItem) return;
          setErrorMsg(null);
          try {
            if (confirmDeleteItem.kind === 'doc') {
              const d = confirmDeleteItem.item as CaseDocument;
              await deleteCaseDocumentAudited(d, role);
              setSelectedDocIds((prev) => prev.filter((id) => id !== d.id));
              if (previewDocModal?.id === d.id) setPreviewDocModal(null);
              setFeedback(`Documento "${d.nomeDocumento}" excluído com auditoria.`);
            } else if (confirmDeleteItem.kind === 'docs_batch') {
              const batch = confirmDeleteItem.docs || [];
              for (const d of batch) {
                await deleteCaseDocumentAudited(d, role);
              }
              setSelectedDocIds([]);
              setFeedback(`${batch.length} documento(s) excluído(s) com auditoria.`);
            } else if (confirmDeleteItem.kind === 'dependent') {
              const dep = confirmDeleteItem.item as Dependent;
              await deleteDocumentAudited('dependents', dep.id, role, dep);
              setFeedback(`Dependente "${dep.nomeCompleto}" removido.`);
            } else if (confirmDeleteItem.kind === 'task') {
              const t = confirmDeleteItem.item as Task;
              await deleteDocumentAudited('tasks', t.id, role, t);
              setFeedback(`Tarefa "${t.titulo}" excluída.`);
            } else if (confirmDeleteItem.kind === 'deadline') {
              const dl = confirmDeleteItem.item as Deadline;
              await deleteDocumentAudited('deadlines', dl.id, role, dl);
              setFeedback(`Prazo "${dl.titulo}" excluído.`);
            } else if (confirmDeleteItem.kind === 'appointment') {
              const apt = confirmDeleteItem.item as Appointment;
              await deleteDocumentAudited('appointments', apt.id, role, apt);
              setFeedback(`Agendamento "${apt.titulo}" excluído.`);
            } else if (confirmDeleteItem.kind === 'viability') {
              const va = confirmDeleteItem.item as ViabilityAssessment;
              await deleteDocumentAudited('viabilityAssessments', va.id, role, va);
              setFeedback(`Parecer Técnico v${va.versao} excluído.`);
            } else if (confirmDeleteItem.kind === 'comm') {
              const log = confirmDeleteItem.item as CommunicationLog;
              await deleteDocumentAudited('communicationLogs', log.id, role, log);
              setFeedback('Registro de comunicação excluído.');
            }
            setConfirmDeleteItem(null);
            await onRefresh();
          } catch (err) {
            throw new Error(translateAppError(err).message || 'Não foi possível concluir a exclusão.');
          }
        }}
        onClose={() => setConfirmDeleteItem(null)}
      />

      {deleteClientTarget && (
        <ConfirmTypedModal
          open={Boolean(deleteClientTarget)}
          onClose={() => setDeleteClientTarget(null)}
          title={`Excluir definitivamente ${deleteClientTarget.nomeCompleto}?`}
          description="Esta ação remove o cliente e todos os registros vinculados abaixo de forma irreversível (LGPD / exclusão em cascata)."
          summaryItems={clientDeleteSummary}
          requiredKeyword="EXCLUIR"
          confirmLabel="Excluir Cliente & Vínculos"
          alternativeLabel="Arquivar em vez de excluir"
          onAlternative={async () => {
            await archiveClientAudited(deleteClientTarget, role);
            setFeedback(`Cliente "${deleteClientTarget.nomeCompleto}" arquivado.`);
            await onRefresh();
            setDeleteClientTarget(null);
          }}
          onConfirm={async () => {
            const deletedCount = await deleteClientCascadeAudited({
              client: deleteClientTarget,
              dependents,
              cases,
              caseFinancials,
              caseDocuments: docs,
              tasks,
              deadlines,
              appointments,
              communicationLogs,
              viabilityAssessments,
              budgets,
              financialRecords,
              generatedDocuments,
              role,
            });
            setFeedback(`Cliente "${deleteClientTarget.nomeCompleto}" e ${deletedCount} vínculo(s) excluídos com auditoria.`);
            if (selectedCaseId && cases.some((c) => c.id === selectedCaseId && c.clientId === deleteClientTarget.id)) {
              onSelectCase(null);
            }
            setDeleteClientTarget(null);
            await onRefresh();
          }}
        />
      )}

      {deleteCaseTarget && (
        <ConfirmTypedModal
          open={Boolean(deleteCaseTarget)}
          onClose={() => setDeleteCaseTarget(null)}
          title={`Excluir definitivamente o caso "${deleteCaseTarget.titulo}"?`}
          description="Esta ação exclui o processo e todos os documentos, tarefas, prazos, pareceres, comunicações e lançamentos vinculados."
          summaryItems={caseDeleteSummary}
          requiredKeyword="EXCLUIR"
          confirmLabel="Excluir Processo & Vínculos"
          onConfirm={async () => {
            const wasActive = selectedCaseId === deleteCaseTarget.id;
            const deletedCount = await deleteCaseCascadeAudited({
              caseItem: deleteCaseTarget,
              caseFinancials,
              caseDocuments: docs,
              tasks,
              deadlines,
              appointments,
              communicationLogs,
              viabilityAssessments,
              budgets,
              financialRecords,
              generatedDocuments,
              role,
            });
            setFeedback(`Processo "${deleteCaseTarget.titulo}" e ${deletedCount} vínculo(s) excluídos.`);
            setDeleteCaseTarget(null);
            if (wasActive) onSelectCase(null);
            await onRefresh();
          }}
        />
      )}
    </>
  );

  // ===========================================================================
  // Renderização: Ficha Dinâmica do Caso
  // ===========================================================================
  if (activeCase && caseCtx) {
    const filteredCaseDocs = caseDocs
      .filter((d) => (docPersonFilter === 'Todos' ? true : d.pessoa === docPersonFilter))
      .filter((d) => (docStatusFilter === 'Todos' ? true : d.status === docStatusFilter))
      .sort((a, b) => a.ordemEmissao - b.ordemEmissao);
    const allDocPessoas = Array.from(new Set(['Titular', ...caseDependents.map((d) => d.nomeCompleto), ...caseDocs.map((d) => d.pessoa)]));
    const nextActionToneClasses =
      caseCtx.nextAction.tone === 'warning'
        ? 'bg-amber-50 border-amber-200 text-amber-950'
        : caseCtx.nextAction.tone === 'success'
          ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
          : 'bg-slate-50 border-slate-200 text-slate-900';

    return (
      <div className="space-y-5">
        {/* Cabeçalho Unificado e Dinâmico do Caso */}
        <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-xl px-4 py-3.5 shadow-xs space-y-3 no-print">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => onSelectCase(null)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0 mt-0.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">{activeCase.titulo}</h1>
                  <span className="text-xs font-medium text-slate-500">· {activeCase.tipoServico}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                  {activeClient && (
                    <button
                      type="button"
                      onClick={() => setDossierClientId(activeClient.id)}
                      className="font-medium text-[var(--color-primary)] hover:underline text-left"
                    >
                      {activeClient.nomeCompleto}
                    </button>
                  )}
                  {activeClient?.email && <span>· {activeClient.email}</span>}
                  {activeClient?.whatsapp && <span>· {activeClient.whatsapp}</span>}
                  {activeCase.encerradoEm && (
                    <span className="text-slate-700 font-semibold">
                      · Encerrado em {formatDateTimeBR(activeCase.encerradoEm)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {caseDocs.length > 0 && (
                <span className="text-xs font-semibold tabular-nums px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200" style={{ color: thermo.corHex }}>
                  Docs {thermo.notaGeral}%
                </span>
              )}
              {caseCtx.usesSermig && (
                <select
                  value={activeCase.statusSermig}
                  onChange={(e) => void handleSermigStatusChange(e.target.value as Case['statusSermig'])}
                  aria-label="Status SERMIG"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800"
                >
                  {SERMIG_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      SERMIG: {s}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => void handleSaveCaseField({ portalLiberado: !activeCase.portalLiberado }, 'portalLiberado')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  activeCase.portalLiberado
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {activeCase.portalLiberado ? 'Portal Liberado' : 'Liberar Portal'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setContractModalInit({ clientId: activeCase.clientId, caseId: activeCase.id });
                  setContractModalOpen(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <FileSignature className="w-3.5 h-3.5" />
                Contrato
              </button>
              {caseCtx.usesSermig && (
                <button
                  type="button"
                  onClick={() => setLegalModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[var(--color-primary)] hover:bg-slate-50 whitespace-nowrap"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Base Legal
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setDeleteCaseTarget(activeCase)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-semibold text-[#C82333] hover:bg-red-50 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Caso
                </button>
              )}
            </div>
          </div>

          {/* Barra Interativa dos 5 Marcos + Sub-etapa compacta */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 flex-1">
              {MACRO_FUNNEL_STAGES.map((stage) => {
                const isCurrent = caseCtx.currentMacroStage.id === stage.id;
                const isDone = stage.ordem < caseCtx.currentMacroStage.ordem;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => {
                      const targetStep = resolveTargetPipelineStep(stage.id, activeCase.etapaPipeline);
                      if (targetStep !== activeCase.etapaPipeline) {
                        void handleStageChange(targetStep);
                      }
                    }}
                    title={stage.marcoConversao}
                    className={`px-2.5 py-1.5 rounded-lg text-left transition-colors border text-xs ${
                      isCurrent
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] font-semibold'
                        : isDone
                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-100/70'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block truncate whitespace-nowrap">
                      {stage.ordem}. {stage.nome}
                    </span>
                  </button>
                );
              })}
            </div>
            <select
              value={activeCase.etapaPipeline}
              onChange={(e) => void handleStageChange(Number(e.target.value))}
              aria-label="Sub-etapa operacional"
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 lg:max-w-[230px]"
            >
              {PIPELINE_STAGES.map((st) => (
                <option key={st.numero} value={st.numero}>
                  Etapa {st.numero}: {st.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          {/* Abas Dinâmicas conforme o tipo e momento do caso */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 no-print">
            <div className="flex items-center gap-1 overflow-x-auto">
              {caseCtx.visibleTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCaseTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                    caseTab === t.id
                      ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{t.label}</span>
                  {typeof t.badgeCount === 'number' && t.badgeCount > 0 && (
                    <span className="text-[11px] font-semibold text-slate-500 tabular-nums">({t.badgeCount})</span>
                  )}
                </button>
              ))}
            </div>

            {caseCtx.hiddenOptionalTabs.length > 0 && (
              <div className="flex items-center gap-1.5 pb-1.5">
                {caseCtx.hiddenOptionalTabs.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setForcedOptionalTabs((prev) => ({ ...prev, [opt.id]: true }));
                      setCaseTab(opt.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-slate-300 text-[11px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 bg-white"
                  >
                    <Plus className="w-3 h-3" />
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {feedback && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium no-print">
              {feedback}
            </div>
          )}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C82333] font-medium no-print">
              {errorMsg}
            </div>
          )}

          {/* ABA RESUMO DINÂMICO */}
          {caseTab === 'resumo' && (
            <div className="space-y-5 pt-1">
              {/* Orientação contextual do próximo passo */}
              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border ${nextActionToneClasses} no-print`}>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold">{caseCtx.nextAction.titulo}</p>
                  <p className="text-xs opacity-85">{caseCtx.nextAction.descricao}</p>
                </div>
                {caseCtx.nextAction.targetTab !== 'resumo' && (
                  <button
                    type="button"
                    onClick={() => setCaseTab(caseCtx.nextAction.targetTab)}
                    className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-900 hover:bg-slate-50 shrink-0"
                  >
                    {caseCtx.nextAction.ctaLabel}
                  </button>
                )}
              </div>

              {/* Campos dinâmicos do caso (somente os relevantes ao caso aberto) */}
              <div className="border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Dados Essenciais do Caso</h2>
                    <p className="text-xs text-slate-500">
                      {showAllCaseFields
                        ? 'Exibindo todos os campos disponíveis do processo.'
                        : 'Exibindo apenas os campos pertinentes ao serviço e etapa atual deste caso.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllCaseFields((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 hover:bg-slate-100 no-print"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    {showAllCaseFields ? 'Mostrar apenas campos do caso' : 'Exibir todos os campos'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Serviço</label>
                    <select
                      value={activeCase.tipoServico}
                      onChange={(e) => void handleSaveCaseField({ tipoServico: e.target.value as Case['tipoServico'] }, 'tipoServico')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="Residência Temporal">Residência Temporal</option>
                      <option value="Residência Definitiva">Residência Definitiva</option>
                      <option value="Prorrogação">Prorrogação</option>
                      <option value="Mudança de Subcategoria">Mudança de Subcategoria</option>
                      <option value="Ratificação">Ratificação</option>
                      <option value="Relocation Completo">Relocation Completo</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade</label>
                    <select
                      value={activeCase.prioridade}
                      onChange={(e) => void handleSaveCaseField({ prioridade: e.target.value as Case['prioridade'] }, 'prioridade')}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>

                  {caseCtx.fields.subcategoriaSermig && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategoria SERMIG</label>
                      <select
                        value={activeCase.visaCategoryId || 'visa_15_mercosul'}
                        onChange={(e) => void handleSaveCaseField({ visaCategoryId: e.target.value }, 'visaCategoryId')}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                      >
                        {visaCategories.map((v) => (
                          <option key={v.id} value={v.id}>
                            Cód. {v.codigo} — {v.nomePortugues}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {caseCtx.fields.numeroPedidoSermig && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Número do Pedido SERMIG</label>
                      <input
                        key={`pedido-${activeCase.id}-${activeCase.numeroPedidoSermig || ''}`}
                        defaultValue={activeCase.numeroPedidoSermig || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (activeCase.numeroPedidoSermig || '')) {
                            void handleSaveCaseField({ numeroPedidoSermig: e.target.value }, 'numeroPedidoSermig');
                          }
                        }}
                        placeholder="Ex.: SOL-2026-000123"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  )}

                  {caseCtx.fields.dataProtocolo && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Data do Protocolo</label>
                      <input
                        key={`proto-${activeCase.id}-${activeCase.dataProtocolo || ''}`}
                        type="date"
                        defaultValue={activeCase.dataProtocolo || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (activeCase.dataProtocolo || '')) {
                            void handleSaveCaseField({ dataProtocolo: e.target.value }, 'dataProtocolo');
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  )}

                  {caseCtx.fields.dataLimiteEntrada && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Data Limite de Entrada (90d)</label>
                      <input
                        key={`entrada-${activeCase.id}-${activeCase.dataLimiteEntrada || ''}`}
                        type="date"
                        defaultValue={activeCase.dataLimiteEntrada || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (activeCase.dataLimiteEntrada || '')) {
                            void handleSaveCaseField({ dataLimiteEntrada: e.target.value }, 'dataLimiteEntrada');
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  )}

                  {caseCtx.fields.dataVencimentoResidencia && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Vencimento da Residência</label>
                      <input
                        key={`venc-${activeCase.id}-${activeCase.dataVencimentoResidencia || ''}`}
                        type="date"
                        defaultValue={activeCase.dataVencimentoResidencia || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (activeCase.dataVencimentoResidencia || '')) {
                            void handleSaveCaseField({ dataVencimentoResidencia: e.target.value }, 'dataVencimentoResidencia');
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                      />
                    </div>
                  )}

                  {caseCtx.fields.prazoRequerimento && (
                    <div>
                      <label className="block text-xs font-semibold text-amber-900 mb-1">Prazo Requerimento / Descargos</label>
                      <input
                        key={`req-${activeCase.id}-${activeCase.prazoRequerimento || ''}`}
                        type="date"
                        defaultValue={activeCase.prazoRequerimento || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (activeCase.prazoRequerimento || '')) {
                            void handleSaveCaseField({ prazoRequerimento: e.target.value }, 'prazoRequerimento');
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-amber-300 bg-amber-50/40 text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Comprovante e Notas SERMIG — exibidos apenas quando há protocolo/histórico SERMIG */}
              {(caseCtx.fields.comprovanteProtocolo || caseCtx.fields.notasSermig) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 no-print">
                  {caseCtx.fields.comprovanteProtocolo && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                      <p className="text-xs font-bold text-slate-900">Comprovante Oficial de Protocolo SERMIG</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeCase.comprovanteProtocoloUrl && (
                          <a
                            href={activeCase.comprovanteProtocoloUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Comprovante
                          </a>
                        )}
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-100">
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingProtocolo ? 'Enviando...' : activeCase.comprovanteProtocoloUrl ? 'Substituir comprovante' : 'Anexar comprovante'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            disabled={uploadingProtocolo}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingProtocolo(true);
                              try {
                                const up = await uploadFileToServer(file);
                                await handleSaveCaseField({ comprovanteProtocoloUrl: up.url }, 'comprovanteProtocoloUrl');
                              } finally {
                                setUploadingProtocolo(false);
                              }
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {caseCtx.fields.notasSermig && (
                    <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
                      <p className="text-xs font-bold text-slate-900">Notas e Despachos SERMIG</p>
                      <div className="flex flex-wrap gap-2">
                        <input
                          value={sermigStatusNote}
                          onChange={(e) => setSermigStatusNote(e.target.value)}
                          placeholder="Registrar despacho, notificação ou protocolo..."
                          className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                        />
                        <UiButton
                          type="button"
                          size="sm"
                          variant="primary"
                          onClick={() => void handleSermigStatusChange(activeCase.statusSermig, sermigStatusNote)}
                        >
                          Salvar Nota
                        </UiButton>
                      </div>
                      {(activeCase.historicoStatusSermig || []).length > 0 && (
                        <div className="max-h-28 overflow-y-auto space-y-1 pt-1 border-t border-slate-100 text-[11px] text-slate-600">
                          {[...(activeCase.historicoStatusSermig || [])].reverse().map((h, idx) => (
                            <p key={idx}>
                              <strong>{h.status}</strong> ({formatDateTimeBR(h.data)} · {h.autor}){h.nota ? ` — ${h.nota}` : ''}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeCase.overrideProtocoloMinimo && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <p className="font-semibold">Exceção de Protocolo Mínimo Registrada</p>
                  <p>
                    Autorizada por {activeCase.overrideProtocoloMinimo.autorizadoPor} em{' '}
                    {formatDateTimeBR(activeCase.overrideProtocoloMinimo.data)}: {activeCase.overrideProtocoloMinimo.justificativa}
                  </p>
                </div>
              )}

              {/* Parecer Técnico (apenas em casos migratórios e recolhível após protocolo) */}
              {caseCtx.fields.parecerTecnico && (
                <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setParecerExpanded((prev) => !prev)}
                      className="flex items-center gap-2 text-left"
                    >
                      {parecerExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Parecer Técnico e Viabilidade
                          {caseAssessments.length > 0 && (
                            <span className="ml-2 text-xs font-medium text-slate-500">
                              ({caseAssessments.length} {caseAssessments.length === 1 ? 'versão' : 'versões'})
                            </span>
                          )}
                        </h3>
                        {parecerExpanded && (
                          <p className="text-xs text-slate-500">
                            Gere um rascunho fundamentado na Base Legal, edite e aprove antes de liberar ao cliente.
                          </p>
                        )}
                      </div>
                    </button>

                    <div className="flex flex-wrap items-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() =>
                          void handleSaveCaseField(
                            { relatorioViabilidadeLiberado: !activeCase.relatorioViabilidadeLiberado },
                            'relatorioViabilidadeLiberado',
                          )
                        }
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                          activeCase.relatorioViabilidadeLiberado
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {activeCase.relatorioViabilidadeLiberado ? 'Visível no Portal' : 'Liberar ao Cliente'}
                      </button>
                      <button
                        type="button"
                        disabled={aiParecerLoading}
                        onClick={() => {
                          setParecerExpanded(true);
                          void handleGenerateAiParecer();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {aiParecerLoading ? aiParecerProgress || 'Gerando...' : 'Gerar Rascunho'}
                      </button>
                    </div>
                  </div>

                  {parecerExpanded && (
                    <>
                      {aiParecerLoading && aiParecerProgress && (
                        <p className="text-xs font-medium text-slate-600" role="status" aria-live="polite">
                          {aiParecerProgress}
                        </p>
                      )}

                      {parecerDraft && (
                        <form onSubmit={handleSaveParecerDraft} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="space-y-1">
                              {parecerDraft.fallback || parecerDraft.origem === 'regras' ? (
                                <>
                                  <p className="text-xs font-bold text-amber-950 bg-amber-100 border border-amber-300 px-3 py-1.5 rounded-lg inline-block">
                                    {parecerDraft.origemLabel || 'Rascunho gerado por regras — serviço indisponível no momento'}
                                  </p>
                                  {parecerDraft.mensagemUsuario && (
                                    <p className="text-xs text-amber-900">{parecerDraft.mensagemUsuario}</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                                  {parecerDraft.origemLabel || 'Rascunho editável'} — revise e ajuste antes de aprovar.
                                </p>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={aiParecerLoading}
                              onClick={() => void handleGenerateAiParecer()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              {aiParecerLoading ? aiParecerProgress || 'Tentando novamente...' : 'Gerar novamente'}
                            </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Enquadramento Legal</label>
                              <textarea
                                rows={4}
                                value={parecerDraft.enquadramentoLegal}
                                onChange={(e) => updateParecerDraft({ ...parecerDraft, enquadramentoLegal: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Elegibilidade e Riscos</label>
                              <textarea
                                rows={4}
                                value={parecerDraft.elegibilidadeRiscos}
                                onChange={(e) => updateParecerDraft({ ...parecerDraft, elegibilidadeRiscos: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Fundamentação Normativa</label>
                              <textarea
                                rows={3}
                                value={parecerDraft.fundamentacaoNormativa}
                                onChange={(e) => updateParecerDraft({ ...parecerDraft, fundamentacaoNormativa: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">Recomendações ao Cliente</label>
                              <textarea
                                rows={3}
                                value={parecerDraft.recomendacoes}
                                onChange={(e) => updateParecerDraft({ ...parecerDraft, recomendacoes: e.target.value })}
                                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={parecerDraft.liberadoAoCliente}
                                onChange={(e) => updateParecerDraft({ ...parecerDraft, liberadoAoCliente: e.target.checked })}
                              />
                              Liberar versão aprovada no Portal do Cliente
                            </label>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => updateParecerDraft(null)}
                                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                              >
                                Descartar
                              </button>
                              <button
                                type="submit"
                                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                              >
                                Aprovar e Salvar Versão
                              </button>
                            </div>
                          </div>
                        </form>
                      )}

                      {caseAssessments.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-700">Versões Salvas</p>
                          {caseAssessments.map((va) => (
                            <div key={va.id} className="bg-white border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-900">
                                  Versão {va.versao} · {formatDateTimeBR(va.createdAt)} · {va.autorNome}
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className={va.liberadoAoCliente ? 'text-[#1E7E34] font-semibold' : 'text-slate-500'}>
                                    {va.liberadoAoCliente ? 'Liberado ao cliente' : 'Uso interno'}
                                  </span>
                                  {isAdmin && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setConfirmDeleteItem({
                                          kind: 'viability',
                                          title: `Excluir Parecer Técnico v${va.versao}`,
                                          description: 'Deseja excluir permanentemente esta versão de parecer técnico? Esta operação será auditada.',
                                          confirmLabel: 'Excluir Parecer',
                                          item: va,
                                        });
                                      }}
                                      aria-label={`Excluir parecer versão ${va.versao}`}
                                      className="p-1 rounded border border-red-200 text-[#C82333] hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-slate-700 whitespace-pre-wrap">{va.enquadramentoLegal}</p>
                              <p className="text-slate-600 whitespace-pre-wrap">{va.recomendacoes}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Ações operacionais do caso */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 no-print">
                <div className="flex flex-wrap gap-2">
                  {caseCtx.usesSermig && (
                    <UiButton type="button" size="sm" variant="outline" onClick={() => void handleGenerateAutomaticDeadlines()}>
                      <Calendar className="w-3.5 h-3.5" />
                      Gerar Prazos
                    </UiButton>
                  )}
                  <UiButton
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={casePdfBusy}
                    onClick={async () => {
                      if (!activeCase || casePdfBusy) return;
                      setCasePdfBusy(true);
                      try {
                        const { exportDossieCasoPdf } = await import('../pdf/ClientPortalPdfDocuments');
                        const currentThermo = calcularTermometroDocumentos(caseDocs, empresa.bloqueioProtocoloMinimo || 100);
                        const fn = await exportDossieCasoPdf({
                          empresa,
                          client: activeClient,
                          activeCase,
                          dependents: caseDependents,
                          docs: caseDocs,
                          deadlines: caseDeadlines,
                          thermo: currentThermo,
                          assessments: caseAssessments,
                        });
                        setFeedback(`Dossiê PDF gerado (${fn}).`);
                      } catch (err) {
                        setErrorMsg(err instanceof Error ? err.message : 'Erro ao gerar PDF do dossiê.');
                      } finally {
                        setCasePdfBusy(false);
                      }
                    }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {casePdfBusy ? 'Gerando PDF...' : 'Baixar Dossiê (PDF)'}
                  </UiButton>
                  <UiButton type="button" size="sm" variant="outline" onClick={() => setPrintMode('dossie_caso')}>
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir A4
                  </UiButton>
                  <UiButton type="button" size="sm" variant="outline" onClick={() => void handleDuplicateCaseStructure()}>
                    <Copy className="w-3.5 h-3.5" />
                    Duplicar Caso
                  </UiButton>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {!activeCase.encerradoEm && (
                    <UiButton type="button" size="sm" variant="danger" onClick={() => setCloseCaseModalOpen(true)}>
                      Encerrar Caso
                    </UiButton>
                  )}
                  {isAdmin && (
                    <UiButton type="button" size="sm" variant="outline" onClick={() => setDeleteCaseTarget(activeCase)}>
                      <Trash2 className="w-3.5 h-3.5 text-[#C82333]" />
                      Excluir Processo
                    </UiButton>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: DEPENDENTES */}
          {caseTab === 'dependentes' && (
            <div className="space-y-5 pt-2">
              {canManageClients && (
                <form onSubmit={handleAddDependent} className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-3 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Nome completo do dependente</label>
                    <input
                      required
                      value={depForm.nomeCompleto}
                      onChange={(e) => setDepForm({ ...depForm, nomeCompleto: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Parentesco</label>
                    <select
                      value={depForm.parentesco}
                      onChange={(e) => setDepForm({ ...depForm, parentesco: e.target.value as Dependent['parentesco'] })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="Cônjuge">Cônjuge</option>
                      <option value="Companheiro(a)">Companheiro(a)</option>
                      <option value="Filho(a)">Filho(a)</option>
                      <option value="Enteado(a)">Enteado(a)</option>
                      <option value="Pai/Mãe">Pai/Mãe</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Idade</label>
                    <input
                      type="number"
                      min={0}
                      max={110}
                      value={depForm.idade}
                      onChange={(e) => setDepForm({ ...depForm, idade: e.target.value })}
                      placeholder="Ex.: 12"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Passaporte</label>
                    <input
                      value={depForm.passaporteNumero}
                      onChange={(e) => setDepForm({ ...depForm, passaporteNumero: e.target.value })}
                      placeholder="Nº passaporte"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Validade Passaporte</label>
                    <input
                      type="date"
                      value={depForm.passaporteValidade}
                      onChange={(e) => setDepForm({ ...depForm, passaporteValidade: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={depForm.estudante}
                        onChange={(e) => setDepForm({ ...depForm, estudante: e.target.checked })}
                      />
                      Dependente estudante (aplicável prorrogação até 24 anos, Art. 74 Ley 21.325)
                    </label>
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      + Adicionar Dependente
                    </button>
                  </div>
                </form>
              )}

              {caseDependents.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">Nenhum dependente vinculado a este cliente.</p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                  {caseDependents.map((dep) => {
                    const passDays = daysUntilDate(dep.passaporteValidade);
                    const depDocsCount = caseDocs.filter((d) => d.pessoa === dep.nomeCompleto).length;
                    return (
                      <div key={dep.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {dep.nomeCompleto}
                            {dep.idade !== undefined ? ` (${dep.idade} anos)` : ''}
                            {dep.estudante ? ' · Estudante' : ''}
                          </p>
                          <p className="text-slate-500">
                            {dep.parentesco}
                            {dep.passaporteNumero ? ` · Passaporte ${dep.passaporteNumero}` : ''}
                            {dep.passaporteValidade ? ` · Val. ${formatDateBR(dep.passaporteValidade)}` : ''}
                          </p>
                          {passDays !== null && passDays < 365 && (
                            <p className="text-[11px] font-semibold text-amber-800 mt-0.5">
                              Alerta: passaporte com menos de 12 meses de validade ({passDays} dias).
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setDocPersonFilter(dep.nomeCompleto);
                              setCaseTab('documentos');
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Ver Documentos ({depDocsCount})
                          </button>
                          {canManageClients && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmDeleteItem({
                                  kind: 'dependent',
                                  title: 'Remover Dependente',
                                  description: `Tem certeza que deseja excluir permanentemente o dependente "${dep.nomeCompleto}"?`,
                                  confirmLabel: 'Excluir Dependente',
                                  item: dep,
                                });
                              }}
                              className="p-1.5 rounded-lg border border-red-200 text-[#C82333] hover:bg-red-50"
                              aria-label={`Remover ${dep.nomeCompleto}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* ABA 3: DOCUMENTOS (Checklist, Esteira, Termômetro, Cronograma, IA, Lote, ZIP, Preview) */}
          {caseTab === 'documentos' && (
            <div className="space-y-6 pt-2">
              {/* Termômetro e ações em lote */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 no-print">
                <div className="lg:col-span-2 p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-900">
                      Termômetro Ponderado (mínimo para protocolo: {empresa.bloqueioProtocoloMinimo || 100}%)
                    </p>
                    <span className="text-base font-bold tabular-nums" style={{ color: thermo.corHex }}>
                      {thermo.notaGeral}% · {thermo.faixa}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${thermo.notaGeral}%`, backgroundColor: thermo.corHex }} />
                  </div>
                  {thermo.porPessoa.length > 0 && (
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
                      {thermo.porPessoa.map((p) => (
                        <span key={p.pessoa}>
                          <strong>{p.pessoa}:</strong> {p.nota}% ({p.aprovados}/{p.totalObrigatorios} obrig.)
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-center gap-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={handleGenerateChecklistDocs}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Gerar Checklist
                    </button>
                    <button
                      type="button"
                      disabled={zipBusy || caseDocs.length === 0}
                      onClick={() => void handleDownloadCaseZip(docPersonFilter)}
                      className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <FolderArchive className="w-3.5 h-3.5" />
                      {zipBusy ? 'Gerando...' : 'Baixar ZIP'}
                    </button>
                  </div>
                  <div className={caseCtx.usesSermig ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-1 gap-1.5'}>
                    <button
                      type="button"
                      onClick={() => setPrintMode('relacao')}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Relação A4
                    </button>
                    {caseCtx.usesSermig && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPrintMode('apostila')}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Checklist Haia
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintMode('pacote')}
                          className="px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Pacote SERMIG
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Cronograma Reverso de Emissões (somente antes do protocolo em casos SERMIG) */}
              {caseCtx.usesSermig && !caseCtx.hasProtocolStarted && (
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 no-print">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Cronograma de Emissão Reversa</h3>
                      <p className="text-xs text-slate-500">
                        Calcula datas sugeridas a partir da data-alvo do protocolo para evitar vencimento de certidões.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="date"
                        value={dataAlvoProtocolo}
                        onChange={(e) => setDataAlvoProtocolo(e.target.value)}
                        aria-label="Data alvo do protocolo"
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCronogramaDatas}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        Aplicar datas
                      </button>
                    </div>
                  </div>
                  {schedulePreview.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {schedulePreview.map((item) => (
                        <div key={item.requirement.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          <p className="font-semibold text-slate-900">
                            #{item.ordem} {item.requirement.nomeDocumento}
                          </p>
                          <p className="text-slate-600 mt-0.5">
                            Emitir até <strong className="tabular-nums">{item.dataSugeridaBR}</strong> · {item.janelaObservacao}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Filtros por Pessoa/Status + Modal Documento Completo */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 no-print">
                <div className="flex flex-wrap items-center gap-2">
                  {allDocPessoas.length > 1 && (
                    <select
                      value={docPersonFilter}
                      onChange={(e) => setDocPersonFilter(e.target.value)}
                      aria-label="Filtrar documentos por pessoa"
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                    >
                      <option value="Todos">Pessoa: Todos ({caseDocs.length})</option>
                      {allDocPessoas.map((p) => (
                        <option key={p} value={p}>
                          {p} ({caseDocs.filter((d) => d.pessoa === p).length})
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    value={docStatusFilter}
                    onChange={(e) => setDocStatusFilter(e.target.value)}
                    aria-label="Filtrar documentos por status"
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
                  >
                    <option value="Todos">Status: Todos</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Enviado">Enviado</option>
                    <option value="Em análise">Em análise</option>
                    <option value="Aprovado">Aprovado</option>
                    <option value="Reprovado">Reprovado</option>
                    <option value="Vencido">Vencido</option>
                  </select>
                  {caseCtx.usesSermig && (
                    <button
                      type="button"
                      onClick={() => setLegalModalOpen(true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-[var(--color-primary)]"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      Ver Base Legal
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setEditingDoc({
                      id: makeId('doc'),
                      pessoa: docPersonFilter === 'Todos' ? 'Titular' : docPersonFilter,
                      categoriaDoc: 'Identidade',
                      etapaEsteira: '1 Aguardando Envio',
                      ordemEmissao: caseDocs.length + 1,
                      status: 'Pendente',
                      validadeDias: 0,
                      exigeApostila: false,
                      exigeTraducao: false,
                      obrigatorio: true,
                      peso: 3,
                      versao: 1,
                    });
                    setDocModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Documento Completo
                </button>
              </div>

              {/* Barra de ações em lote */}
              {selectedDocIds.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-900 text-white text-xs no-print">
                  <span className="font-semibold inline-flex items-center gap-1.5">
                    <CheckSquare className="w-4 h-4" />
                    {selectedDocIds.length === 1
                      ? '1 documento selecionado'
                      : `${selectedDocIds.length} documentos selecionados`}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleBatchDocAction('aprovar')}
                      className="px-2.5 py-1 rounded bg-[#1E7E34] font-semibold"
                    >
                      Aprovar em lote
                    </button>
                    {caseCtx.usesSermig && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleBatchDocAction('apostilado')}
                          className="px-2.5 py-1 rounded bg-white text-slate-900 font-semibold"
                        >
                          Marcar Apostilado
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleBatchDocAction('traduzido')}
                          className="px-2.5 py-1 rounded bg-white text-slate-900 font-semibold"
                        >
                          Marcar Traduzido
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleBatchDocAction('complementacao')}
                      className="px-2.5 py-1 rounded bg-[#C82333] font-semibold"
                    >
                      Solicitar Complementação
                    </button>
                    {canManageClients && (
                      <button
                        type="button"
                        onClick={() => {
                          const targets = caseDocs.filter((d) => selectedDocIds.includes(d.id));
                          if (targets.length === 0) return;
                          setConfirmDeleteItem({
                            kind: 'docs_batch',
                            title: `Excluir ${targets.length} documento(s)`,
                            description: `Tem certeza que deseja excluir permanentemente ${targets.length} documento(s) selecionado(s) e seus arquivos enviados?`,
                            confirmLabel: 'Excluir Selecionados',
                            docs: targets,
                          });
                        }}
                        className="px-2.5 py-1 rounded border border-red-400 text-red-200 hover:bg-red-900/40 font-semibold"
                      >
                        Excluir selecionados
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedDocIds([])}
                      className="px-2.5 py-1 rounded border border-slate-500"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
              )}

              {/* Adicionar documento rápido */}
              <form onSubmit={handleAddManualDoc} className="flex flex-wrap gap-2 items-center no-print">
                <input
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Adicionar documento extra ao checklist..."
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
                {caseDependents.length > 0 && (
                  <select
                    value={newDocPessoa}
                    onChange={(e) => setNewDocPessoa(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="Titular">Titular</option>
                    {caseDependents.map((d) => (
                      <option key={d.id} value={d.nomeCompleto}>
                        {d.nomeCompleto}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  + Incluir documento
                </button>
              </form>

              {/* Lista de documentos na esteira */}
              {filteredCaseDocs.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  Nenhum documento correspondente aos filtros. Clique em &ldquo;Gerar Checklist&rdquo; ou &ldquo;Novo Documento Completo&rdquo;.
                </p>
              ) : (
                <div className="space-y-3">
                  {filteredCaseDocs.map((d) => {
                    const expDays = daysUntilDate(d.dataValidadeCalculada);
                    const expiresBeforeProtocol =
                      Boolean(d.dataValidadeCalculada) && Boolean(dataAlvoProtocolo) && d.dataValidadeCalculada! < dataAlvoProtocolo;
                    const isSelected = selectedDocIds.includes(d.id);
                    const stdFilename = formatStandardDocFilename(
                      d.pessoa,
                      d.nomeDocumento,
                      d.dataEmissao,
                      d.arquivoNome?.split('.').pop() || 'pdf',
                    );
                    const whatsDocMsg = `Olá ${activeClient?.nomeCompleto || ''}, sobre o documento "${d.nomeDocumento}" (${d.pessoa}): ${
                      d.motivoReprovacao
                        ? `precisamos de ajuste/reenvio por: ${d.motivoReprovacao}.`
                        : 'aguardamos o envio pelo Portal do Cliente.'
                    }`;

                    return (
                      <div key={d.id} className={`border rounded-xl p-4 space-y-3 ${isSelected ? 'border-[var(--color-primary)] bg-slate-50/70' : 'border-slate-200'}`}>
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                setSelectedDocIds((prev) =>
                                  e.target.checked ? [...prev, d.id] : prev.filter((id) => id !== d.id),
                                )
                              }
                              aria-label={`Selecionar ${d.nomeDocumento}`}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-xs text-slate-500">
                                Ordem #{d.ordemEmissao} · {d.pessoa} · {d.categoriaDoc} · Peso {d.peso}/5 ·{' '}
                                {d.obrigatorio ? 'Obrigatório' : 'Opcional'}
                                {d.prazoSugeridoEmissao ? ` · Emitir até ${formatDateBR(d.prazoSugeridoEmissao)}` : ''}
                              </p>
                              <p className="text-sm font-bold text-slate-900">{d.nomeDocumento}</p>
                              <div className="flex flex-wrap gap-2 mt-1 text-[11px]">
                                {d.dataValidadeCalculada && (
                                  <span
                                    className={`font-semibold ${
                                      expDays !== null && expDays <= 0
                                        ? 'text-[#C82333]'
                                        : expDays !== null && expDays <= 7
                                          ? 'text-[#C82333]'
                                          : expDays !== null && expDays <= 30
                                            ? 'text-amber-700'
                                            : 'text-slate-600'
                                    }`}
                                  >
                                    {expDays !== null && expDays <= 0
                                      ? `Vencido (${formatDateBR(d.dataValidadeCalculada)})`
                                      : expDays !== null && expDays <= 7
                                        ? `Vence em ${expDays}d`
                                        : expDays !== null && expDays <= 15
                                          ? `Vence em ${expDays}d`
                                          : expDays !== null && expDays <= 30
                                            ? `Vence em ${expDays}d`
                                            : `Válido até ${formatDateBR(d.dataValidadeCalculada)}`}
                                  </span>
                                )}
                                {expiresBeforeProtocol && (
                                  <span className="font-semibold text-[#C82333]">
                                    Vence antes do protocolo estimado ({formatDateBR(dataAlvoProtocolo)})
                                  </span>
                                )}
                                {d.orgaoEmissor && <span className="text-slate-500">Órgão: {d.orgaoEmissor}</span>}
                                {(d.anexos?.length || 0) > 1 && (
                                  <span className="text-slate-500">{d.anexos!.length} anexo(s)</span>
                                )}
                              </div>
                              {d.analiseIaSugestao && (
                                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 mt-1.5">
                                  {d.analiseIaSugestao}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 shrink-0 no-print">
                            {d.arquivoUrl && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void logSensitiveDocumentAccess(d, 'visualizar', role);
                                    setPreviewDocModal(d);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  Preview v{d.versao}
                                </button>
                                <a
                                  href={d.arquivoUrl}
                                  download={stdFilename}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => void logSensitiveDocumentAccess(d, 'baixar', role)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Baixar
                                </a>
                              </>
                            )}
                            <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                              <Upload className="w-3.5 h-3.5" />
                              {uploadingDocId === d.id ? 'Enviando...' : 'Anexar'}
                              <input
                                type="file"
                                multiple
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.length) void handleUploadDocStaff(d, e.target.files);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDoc(d);
                                setDocModalOpen(true);
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={aiDocLoadingId !== null}
                              onClick={() => void handleAnalyzeDocIa(d)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                              {aiDocLoadingId === d.id ? aiDocProgress || 'Analisando...' : 'Sugestão IA'}
                            </button>
                            {activeClient?.whatsapp && (
                              <button
                                type="button"
                                onClick={async () => {
                                  window.open(buildWhatsAppUrl(activeClient.whatsapp, whatsDocMsg), '_blank', 'noopener,noreferrer');
                                  await onLogWhatsApp(activeClient.id, activeCase.id, `Cobrança Doc: ${d.nomeDocumento}`, whatsDocMsg);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Cobrar
                              </button>
                            )}
                            {canManageClients && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmDeleteItem({
                                    kind: 'doc',
                                    title: 'Excluir Documento',
                                    description: `Deseja excluir permanentemente "${d.nomeDocumento}" (${d.pessoa})? O anexo armazenado também será removido.`,
                                    confirmLabel: 'Excluir Documento',
                                    item: d,
                                  });
                                }}
                                aria-label={`Excluir documento ${d.nomeDocumento}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Excluir
                              </button>
                            )}
                          </div>
                        </div>

                        {(() => {
                          const rowVis = getDocumentRowVisibility(d);
                          return (
                            <div className="flex flex-wrap items-center gap-2 text-xs pt-2 border-t border-slate-100 no-print">
                              <select
                                value={d.status}
                                onChange={(e) => {
                                  const nextSt = e.target.value as CaseDocument['status'];
                                  if (nextSt === 'Reprovado' && !d.motivoReprovacao) {
                                    void handleUpdateDoc(d, {
                                      status: 'Reprovado',
                                      motivoReprovacao: 'Documento pendente de ajuste — informe o detalhe específico abaixo.',
                                    });
                                  } else {
                                    void handleUpdateDoc(d, { status: nextSt });
                                  }
                                }}
                                aria-label="Status do documento"
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                              >
                                <option value="Pendente">Pendente</option>
                                <option value="Enviado">Enviado</option>
                                <option value="Em análise">Em análise</option>
                                <option value="Aprovado">Aprovado</option>
                                <option value="Reprovado">Reprovado</option>
                                <option value="Vencido">Vencido</option>
                              </select>
                              <select
                                value={d.etapaEsteira}
                                onChange={(e) => void handleUpdateDoc(d, { etapaEsteira: e.target.value as DocumentStep })}
                                aria-label="Etapa da esteira"
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                              >
                                {DOCUMENT_STEPS.map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                              {rowVis.showEmissionDate && (
                                <input
                                  type="date"
                                  value={d.dataEmissao || ''}
                                  onChange={(e) => void handleUpdateDoc(d, { dataEmissao: e.target.value })}
                                  title="Data de emissão"
                                  aria-label="Data de emissão"
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                                />
                              )}
                              {rowVis.showApostilleToggle && (
                                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                                  <input
                                    type="checkbox"
                                    checked={d.apostilado}
                                    onChange={(e) => void handleUpdateDoc(d, { apostilado: e.target.checked })}
                                  />
                                  Apostilado{d.exigeApostila && !d.apostilado ? ' (obrig.)' : ''}
                                </label>
                              )}
                              {rowVis.showTranslationToggle && (
                                <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                                  <input
                                    type="checkbox"
                                    checked={d.traduzido}
                                    onChange={(e) => void handleUpdateDoc(d, { traduzido: e.target.checked })}
                                  />
                                  Traduzido{d.exigeTraducao && !d.traduzido ? ' (obrig.)' : ''}
                                </label>
                              )}
                            </div>
                          );
                        })()}

                        {d.status === 'Reprovado' && (
                          <div className="space-y-1">
                            <label className="block text-[11px] font-bold text-[#C82333]">
                              Motivo da reprovação (obrigatório — exibido ao cliente no Portal):
                            </label>
                            <input
                              required
                              defaultValue={d.motivoReprovacao || ''}
                              onBlur={(e) => {
                                if (e.target.value !== (d.motivoReprovacao || '')) {
                                  void handleUpdateDoc(d, { motivoReprovacao: e.target.value });
                                }
                              }}
                              placeholder="Informe o motivo específico da reprovação..."
                              className="w-full px-3 py-1.5 rounded-lg border border-red-300 bg-red-50 text-xs text-[#C82333]"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Área de impressão A4 / Checklist Haia / Pacote SERMIG / Dossiê Caso */}
              {printMode && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                  <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
                      <h3 className="text-base font-bold text-slate-900">
                        {printMode === 'relacao'
                          ? 'Relação Priorizada de Documentos (A4)'
                          : printMode === 'apostila'
                            ? 'Checklist Apostila de Haia & Traduções'
                            : printMode === 'dossie_caso'
                              ? 'Dossiê Consolidado do Caso (A4)'
                              : 'Pacote Consolidado SERMIG (Somente Aprovados)'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={casePdfBusy}
                          onClick={async () => {
                            if (!activeCase || casePdfBusy) return;
                            setCasePdfBusy(true);
                            try {
                              const { exportDossieCasoPdf } = await import('../pdf/ClientPortalPdfDocuments');
                              const thermo = calcularTermometroDocumentos(caseDocs, empresa.bloqueioProtocoloMinimo || 100);
                              const modeFilter =
                                printMode === 'apostila' ? 'apostila' : printMode === 'pacote' ? 'pacote' : 'all';
                              const fn = await exportDossieCasoPdf({
                                empresa,
                                client: activeClient,
                                activeCase,
                                dependents: caseDependents,
                                docs: caseDocs,
                                deadlines: caseDeadlines,
                                thermo,
                                assessments: caseAssessments,
                                filterMode: modeFilter,
                              });
                              setFeedback(`PDF exportado com sucesso (${fn}).`);
                            } catch (err) {
                              setErrorMsg(err instanceof Error ? err.message : 'Erro ao exportar PDF.');
                            } finally {
                              setCasePdfBusy(false);
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          <Download className="w-3.5 h-3.5" />
                          {casePdfBusy ? 'Gerando PDF...' : 'Baixar PDF A4'}
                        </button>
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Imprimir
                        </button>
                        <button
                          type="button"
                          onClick={() => setPrintMode(null)}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 text-xs">
                      <p className="font-bold text-sm text-slate-900">{empresa.nome_empresa}</p>
                      <p>
                        <strong>Cliente:</strong> {activeClient?.nomeCompleto} · <strong>Processo:</strong> {activeCase.titulo} ·{' '}
                        <strong>SERMIG:</strong> {activeCase.statusSermig} ({activeCase.numeroPedidoSermig || 'S/Nº'})
                      </p>
                      <table className="w-full border-collapse border border-slate-300 text-left">
                        <thead>
                          <tr className="bg-slate-100">
                            <th className="p-2 border border-slate-300">Ordem</th>
                            <th className="p-2 border border-slate-300">Pessoa</th>
                            <th className="p-2 border border-slate-300">Documento</th>
                            <th className="p-2 border border-slate-300">Prazo Sugerido</th>
                            <th className="p-2 border border-slate-300">Apostila / Tradução</th>
                            <th className="p-2 border border-slate-300">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {caseDocs
                            .filter((d) => {
                              if (printMode === 'apostila') return d.exigeApostila || d.exigeTraducao;
                              if (printMode === 'pacote') return d.status === 'Aprovado';
                              return true;
                            })
                            .sort((a, b) => a.ordemEmissao - b.ordemEmissao)
                            .map((d) => (
                              <tr key={d.id}>
                                <td className="p-2 border border-slate-300 tabular-nums">#{d.ordemEmissao}</td>
                                <td className="p-2 border border-slate-300">{d.pessoa}</td>
                                <td className="p-2 border border-slate-300">{d.nomeDocumento}</td>
                                <td className="p-2 border border-slate-300 tabular-nums">{formatDateBR(d.prazoSugeridoEmissao)}</td>
                                <td className="p-2 border border-slate-300">
                                  {d.exigeApostila ? (d.apostilado ? 'Apostilado' : 'Pendente Apostila') : 'Não exige'} /{' '}
                                  {d.exigeTraducao ? (d.traduzido ? 'Traduzido' : 'Pendente Trad.') : 'Não exige'}
                                </td>
                                <td className="p-2 border border-slate-300">{d.status}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                      {printMode === 'dossie_caso' && caseDeadlines.length > 0 && (
                        <div className="pt-2">
                          <p className="font-bold mb-1">Prazos do Processo:</p>
                          {caseDeadlines.map((dl) => (
                            <p key={dl.id}>• {dl.titulo} — {formatDateBR(dl.dataLimite)} ({dl.concluido ? 'Concluído' : 'Ativo'})</p>
                          ))}
                        </div>
                      )}
                      <p className="text-[11px] text-slate-500 pt-2">{empresa.avisoLegal}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ABA 4: ORÇAMENTO & FINANCEIRO (OCULTO PARA ASSISTENTE) */}
          {caseTab === 'financeiro' && !isAssistente && (
            <div className="space-y-6 pt-2">
              <form onSubmit={handleSaveCaseFinancial} className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Valor do Contrato</label>
                  <input
                    type="number"
                    step="0.01"
                    value={finContractValor || (caseFinancial ? String(caseFinancial.valorContrato) : '')}
                    onChange={(e) => setFinContractValor(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Moeda</label>
                  <select
                    value={finContractMoeda}
                    onChange={(e) => setFinContractMoeda(e.target.value as CurrencyCode)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="BRL">BRL (R$)</option>
                    <option value="CLP">CLP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 pb-2">
                  <input
                    type="checkbox"
                    checked={finContractLiberado}
                    onChange={(e) => setFinContractLiberado(e.target.checked)}
                  />
                  Visível ao cliente no Portal
                </label>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Salvar Valor do Contrato
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">Orçamentos do Cliente ({caseBudgets.length})</h3>
                  {caseBudgets.length === 0 ? (
                    <p className="text-xs text-slate-500">Crie ou envie orçamentos na aba Financeiro do menu lateral.</p>
                  ) : (
                    caseBudgets.map((b) => (
                      <div key={b.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{b.titulo}</p>
                          <p className="text-slate-500">Nº {b.numeroOrcamento} · {b.status}</p>
                        </div>
                        <span className="font-bold tabular-nums">{formatCurrency(b.totalGeral, b.moedaPrincipal)}</span>
                      </div>
                    ))
                  )}
                </div>

                <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">Parcelas &amp; Lançamentos ({caseFinRecords.length})</h3>
                  {caseFinRecords.length === 0 ? (
                    <p className="text-xs text-slate-500">Nenhum lançamento financeiro vinculado.</p>
                  ) : (
                    caseFinRecords.map((f) => (
                      <div key={f.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs flex justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{f.descricao}</p>
                          <p className="text-slate-500">Venc. {formatDateBR(f.vencimento)} · {f.status}</p>
                        </div>
                        <span className="font-bold tabular-nums">{formatCurrency(f.valor, f.moeda)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 5: AGENDA & PRAZOS */}
          {caseTab === 'agenda' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
              {/* Tarefas */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Tarefas Operacionais</h3>
                <form onSubmit={handleAddTask} className="space-y-2">
                  <input
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="Nova tarefa..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newTaskPrazo}
                      onChange={(e) => setNewTaskPrazo(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                      Criar
                    </button>
                  </div>
                </form>
                <div className="space-y-2">
                  {caseTasks.map((t) => (
                    <div key={t.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between gap-2">
                      <div>
                        <p className={t.status === 'Concluída' ? 'line-through text-slate-400' : 'font-semibold text-slate-800'}>{t.titulo}</p>
                        {t.prazo && <p className="text-[11px] text-slate-500">Prazo: {formatDateBR(t.prazo)}</p>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            await saveDocumentAudited(
                              'tasks',
                              t.id,
                              { ...t, status: t.status === 'Concluída' ? 'Pendente' : 'Concluída' },
                              false,
                              role,
                              'status_tarefa',
                            );
                            await onRefresh();
                          }}
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] font-medium"
                        >
                          {t.status === 'Concluída' ? 'Reabrir' : 'Concluir'}
                        </button>
                        {canManageClients && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteItem({
                                kind: 'task',
                                title: 'Excluir Tarefa',
                                description: `Tem certeza que deseja excluir a tarefa "${t.titulo}"?`,
                                confirmLabel: 'Excluir Tarefa',
                                item: t,
                              });
                            }}
                            aria-label="Excluir tarefa"
                            className="p-1 rounded border border-red-200 text-[#C82333] hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prazos */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Prazos Legais</h3>
                <form onSubmit={handleAddDeadline} className="space-y-2">
                  <input
                    value={newDeadlineTitle}
                    onChange={(e) => setNewDeadlineTitle(e.target.value)}
                    placeholder="Título do prazo..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <select
                    value={newDeadlineTipo}
                    onChange={(e) => setNewDeadlineTipo(e.target.value as Deadline['tipo'])}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    {caseCtx.relevantDeadlineTypes.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={newDeadlineDate}
                      onChange={(e) => setNewDeadlineDate(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                      Criar
                    </button>
                  </div>
                </form>
                <div className="space-y-2">
                  {caseDeadlines.map((dl) => (
                    <div key={dl.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <p className="font-semibold text-slate-900">{dl.titulo}</p>
                      <p className="text-[11px] text-slate-500">
                        {dl.tipo} · {formatDateBR(dl.dataLimite)}
                      </p>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => downloadIcsFile({ title: dl.titulo, startIso: dl.dataLimite })}
                            className="text-[11px] underline text-[var(--color-primary)]"
                          >
                            Baixar .ics
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await saveDocumentAudited('deadlines', dl.id, { ...dl, concluido: !dl.concluido }, false, role, 'prazo');
                              await onRefresh();
                            }}
                            className="text-[11px] underline text-slate-600"
                          >
                            {dl.concluido ? 'Concluído' : 'Marcar concluído'}
                          </button>
                        </div>
                        {canManageClients && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteItem({
                                kind: 'deadline',
                                title: 'Excluir Prazo Legal',
                                description: `Tem certeza que deseja excluir o prazo "${dl.titulo}"?`,
                                confirmLabel: 'Excluir Prazo',
                                item: dl,
                              });
                            }}
                            aria-label="Excluir prazo"
                            className="p-1 rounded border border-red-200 text-[#C82333] hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reuniões */}
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Reuniões &amp; Agenda</h3>
                <form onSubmit={handleAddAppointment} className="space-y-2">
                  <input
                    value={newAptTitle}
                    onChange={(e) => setNewAptTitle(e.target.value)}
                    placeholder="Assunto da reunião..."
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                  <select
                    value={newAptTipo}
                    onChange={(e) => setNewAptTipo(e.target.value as Appointment['tipo'])}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="Diagnóstico">Diagnóstico</option>
                    <option value="Reunião de Onboarding">Reunião de Onboarding</option>
                    <option value="Conferência Documental">Conferência Documental</option>
                    <option value="Acompanhamento">Acompanhamento</option>
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={newAptDate}
                      onChange={(e) => setNewAptDate(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                    <button type="submit" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                      Agendar
                    </button>
                  </div>
                </form>
                <div className="space-y-2">
                  {caseAppointments.map((apt) => (
                    <div key={apt.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-1">
                      <p className="font-semibold text-slate-900">{apt.titulo}</p>
                      <p className="text-[11px] text-slate-500">{formatDateTimeBR(apt.dataHoraInicio)} · {apt.status}</p>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <div className="flex gap-2">
                          <a
                            href={buildGoogleCalendarUrl({ title: apt.titulo, startIso: apt.dataHoraInicio })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] underline text-[var(--color-primary)]"
                          >
                            Google Agenda
                          </a>
                          <button
                            type="button"
                            onClick={() => downloadIcsFile({ title: apt.titulo, startIso: apt.dataHoraInicio })}
                            className="text-[11px] underline text-slate-600"
                          >
                            Baixar .ics
                          </button>
                        </div>
                        {canManageClients && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteItem({
                                kind: 'appointment',
                                title: 'Excluir Agendamento',
                                description: `Tem certeza que deseja excluir o agendamento "${apt.titulo}"?`,
                                confirmLabel: 'Excluir Agendamento',
                                item: apt,
                              });
                            }}
                            aria-label="Excluir agendamento"
                            className="p-1 rounded border border-red-200 text-[#C82333] hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ABA COMUNICAÇÃO E AUDITORIA */}
          {caseTab === 'comunicacao' && (
            <div className="space-y-5 pt-2">
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3 no-print">
                <button
                  type="button"
                  onClick={() => setCommSubView('atendimento')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    commSubView === 'atendimento'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Atendimento e Chat ({caseComms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCommSubView('auditoria')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    commSubView === 'auditoria'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Auditoria do Caso ({caseLogs.length})
                </button>
              </div>

              {commSubView === 'auditoria' ? (
                <div className="space-y-2">
                  {caseLogs.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3">Nenhuma alteração auditada vinculada diretamente a este caso ainda.</p>
                  ) : (
                    caseLogs.map((log) => (
                      <div key={log.id} className="p-3 rounded-lg border border-slate-200 text-xs">
                        <div className="flex flex-wrap justify-between gap-2 text-slate-500">
                          <span className="font-semibold text-slate-800">
                            {log.acao} · {log.entidade} ({log.campo || 'registro'})
                          </span>
                          <span className="tabular-nums">{formatDateTimeBR(log.createdAt)} · {log.actorEmail}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <>
              {/* Chat de Dúvidas sobre Documentos (Portal do Cliente) */}
              <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4 text-[var(--color-primary)]" />
                      Chat de Dúvidas sobre Documentos (Portal do Cliente)
                    </h3>
                    <p className="text-xs text-slate-500">
                      As dúvidas enviadas pelo cliente no Portal aparecem aqui em tempo real e ficam salvas no histórico do processo.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600 tabular-nums">
                    {caseChatLogs.length === 1 ? '1 mensagem' : `${caseChatLogs.length} mensagens`}
                  </span>
                </div>

                {caseChatLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    Nenhuma dúvida enviada pelo cliente neste processo pelo chat do Portal. Você também pode iniciar uma orientação rápida abaixo.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    {caseChatLogs.map((msg) => {
                      const isClientMsg = inferChatSenderRole(msg) === 'cliente';
                      return (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg border text-xs space-y-1 ${
                            isClientMsg
                              ? 'bg-amber-50/70 border-amber-200'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                            <span className="font-bold text-slate-900">
                              {isClientMsg ? `Cliente · ${msg.autorNome || activeClient?.nomeCompleto || 'Cliente'}` : `Equipe · ${msg.autorNome}`}
                            </span>
                            <span className="tabular-nums">{formatDateTimeBR(msg.createdAt)}</span>
                          </div>
                          {msg.documentNome && (
                            <p className="text-[11px] font-semibold text-[var(--color-primary)]">
                              Doc: {msg.documentNome}
                            </p>
                          )}
                          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{msg.mensagem}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!activeCase || !chatReplyMsg.trim() || chatReplySending) return;
                    setChatReplySending(true);
                    setErrorMsg(null);
                    try {
                      const refDoc = caseDocs.find((d) => d.id === chatReplyDocId);
                      await sendStaffDocumentChatReply({
                        clientId: activeCase.clientId,
                        caseId: activeCase.id,
                        remetenteUid: userProfile.uid,
                        autorNome: userProfile.nome || userProfile.email,
                        mensagem: chatReplyMsg.trim(),
                        documentId: refDoc?.id,
                        documentNome: refDoc
                          ? `${refDoc.nomeDocumento}${refDoc.pessoa && refDoc.pessoa !== 'Titular' ? ` (${refDoc.pessoa})` : ''}`
                          : undefined,
                        role,
                        existingCaseChatLogs: caseChatLogs,
                        sendPushAlert: chatReplySendPush,
                      });
                      setChatReplyMsg('');
                      setChatReplyDocId('');
                      setFeedback(
                        chatReplySendPush
                          ? 'Resposta enviada ao Chat do Portal, registrada no histórico e notificada ao cliente.'
                          : 'Resposta enviada ao Chat do Portal e registrada no histórico do processo.',
                      );
                      await onRefresh();
                    } catch (err) {
                      setErrorMsg(err instanceof Error ? err.message : 'Falha ao responder no Chat do Portal.');
                    } finally {
                      setChatReplySending(false);
                    }
                  }}
                  className="space-y-2.5 pt-1"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-center">
                    <select
                      value={chatReplyDocId}
                      onChange={(e) => setChatReplyDocId(e.target.value)}
                      aria-label="Documento de referência da resposta"
                      className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    >
                      <option value="">Resposta geral (ou vincular documento...)</option>
                      {caseDocs.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nomeDocumento}
                          {d.pessoa && d.pessoa !== 'Titular' ? ` (${d.pessoa})` : ''}
                        </option>
                      ))}
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={chatReplySendPush}
                        onChange={(e) => setChatReplySendPush(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <span>Alertar cliente via Push/Portal ao responder</span>
                    </label>
                  </div>
                  <textarea
                    required
                    rows={2}
                    value={chatReplyMsg}
                    onChange={(e) => setChatReplyMsg(e.target.value)}
                    placeholder="Escreva sua resposta para o cliente visualizar imediatamente no widget do Portal..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  />
                  <button
                    type="submit"
                    disabled={chatReplySending || !chatReplyMsg.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    {chatReplySending ? 'Enviando resposta...' : 'Responder no Chat do Portal'}
                  </button>
                </form>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!activeCase || !pushTitle.trim() || !pushMessage.trim() || pushSending) return;
                  setPushSending(true);
                  setErrorMsg(null);
                  try {
                    const res = await notifyClientProcessUpdate({
                      clientId: activeCase.clientId,
                      caseId: activeCase.id,
                      tipo: pushTipo,
                      titulo: pushTitle.trim(),
                      mensagem: pushMessage.trim(),
                      etapaPipeline: activeCase.etapaPipeline,
                      statusSermig: activeCase.statusSermig,
                      linkDestino: '/portal',
                      criadoPorUid: userProfile.uid,
                      criadoPorNome: userProfile.nome || userProfile.email,
                    });
                    setPushTitle('');
                    setPushMessage('');
                    if (res.pushResult.sentCount > 0) {
                      setFeedback(
                        `Notificação registrada no Portal e push enviado para ${res.pushResult.sentCount} dispositivo(s).`,
                      );
                    } else {
                      setFeedback(
                        res.pushResult.warning ||
                          'Alerta registrado no Portal do Cliente em tempo real.',
                      );
                    }
                  } catch (err) {
                    setErrorMsg(err instanceof Error ? err.message : 'Erro ao enviar notificação.');
                  } finally {
                    setPushSending(false);
                  }
                }}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                      <Bell className="w-4 h-4 text-[var(--color-primary)]" />
                      Enviar Notificação Push &amp; Alerta no Portal (FCM)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Envia push via Firebase Cloud Messaging (se ativado pelo cliente) e registra alerta em tempo real no Portal.
                    </p>
                  </div>
                  <select
                    value={pushTipo}
                    onChange={(e) => setPushTipo(e.target.value as ClientNotificationType)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value="geral">Comunicado Geral</option>
                    <option value="etapa_pipeline">Atualização de Etapa</option>
                    <option value="status_sermig">Status SERMIG</option>
                    <option value="documento">Análise de Documento</option>
                    <option value="prazo">Alerta de Prazo</option>
                    <option value="parecer">Parecer Técnico</option>
                  </select>
                </div>
                <input
                  required
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="Título da notificação (ex.: Novo despacho no SERMIG ou documento aprovado)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
                <textarea
                  required
                  rows={2}
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                  placeholder="Mensagem objetiva para o cliente visualizar no dispositivo e no Portal..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
                <button
                  type="submit"
                  disabled={pushSending}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Send className="w-3.5 h-3.5" />
                  {pushSending ? 'Enviando notificação...' : 'Disparar Push & Registrar no Portal'}
                </button>
              </form>

              <form onSubmit={handleSendComm} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap gap-3">
                  <select
                    value={commTplId}
                    onChange={(e) => handleApplyMsgTemplate(e.target.value)}
                    className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="">Selecionar modelo pronto...</option>
                    {messageTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titulo}
                      </option>
                    ))}
                  </select>
                  <select
                    value={commCanal}
                    onChange={(e) => setCommCanal(e.target.value as CommunicationLog['canal'])}
                    className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Ligação">Ligação</option>
                    <option value="Sistema">Registro Interno</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  value={commMsg}
                  onChange={(e) => setCommMsg(e.target.value)}
                  placeholder="Escreva a mensagem ou selecione um modelo acima..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  {commCanal === 'WhatsApp' ? 'Enviar no WhatsApp & Registrar' : 'Registrar Comunicação'}
                </button>
              </form>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">Histórico Completo de Comunicações ({caseComms.length})</h4>
                {caseComms.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {log.canal === 'Chat Portal'
                          ? `Chat Portal (${log.origem === 'cliente' ? 'Cliente' : 'Equipe'})`
                          : log.canal}{' '}
                        · {log.assunto}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums">{formatDateTimeBR(log.createdAt)} · {log.autorNome}</span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDeleteItem({
                                kind: 'comm',
                                title: 'Excluir Registro de Comunicação',
                                description: `Tem certeza que deseja excluir o registro "${log.assunto}" do histórico?`,
                                confirmLabel: 'Excluir Registro',
                                item: log,
                              });
                            }}
                            aria-label="Excluir registro de comunicação"
                            className="p-1 rounded border border-red-200 text-[#C82333] hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {log.documentNome && (
                      <p className="text-[11px] font-semibold text-[var(--color-primary)]">
                        Documento: {log.documentNome}
                      </p>
                    )}
                    <p className="text-slate-700 whitespace-pre-wrap">{log.mensagem}</p>
                  </div>
                ))}
              </div>
                </>
              )}
            </div>
          )}

          {/* ABA 7: RELOCATION */}
          {caseTab === 'relocation' && (
            <div className="space-y-5 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Trilha Pós-Chegada no Chile</h3>
                  <p className="text-xs text-slate-500">Estampado Electrónico, PDI, Cédula de Identidade, ClaveÚnica, RUT e Rede Homologada</p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateRelocationTasks}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Gerar Checklist Relocation
                </button>
              </div>
              <div className="space-y-2">
                {caseTasks
                  .filter((t) => t.titulo.startsWith('[Relocation]'))
                  .map((t) => (
                    <div key={t.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                      <span className={t.status === 'Concluída' ? 'line-through text-slate-400' : 'font-medium text-slate-800'}>
                        {t.titulo.replace('[Relocation] ', '')}
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await saveDocumentAudited(
                            'tasks',
                            t.id,
                            { ...t, status: t.status === 'Concluída' ? 'Pendente' : 'Concluída' },
                            false,
                            role,
                            'relocation_status',
                          );
                          await onRefresh();
                        }}
                        className="px-3 py-1 rounded-lg border border-slate-300 bg-white font-semibold"
                      >
                        {t.status === 'Concluída' ? 'Concluído' : 'Concluir'}
                      </button>
                    </div>
                  ))}
              </div>
              <div className="pt-2 border-t border-slate-200">
                <p className="text-xs font-bold text-slate-900 mb-2">Parceiros Recomendados para Indicação ao Cliente</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {partnersPublic.map((p) => (
                    <div key={p.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                      <p className="font-semibold text-slate-900">{p.nome}</p>
                      <p className="text-slate-500">{p.categoria} · {p.pais}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal de Override do Bloqueio Mínimo de Protocolo */}
        {overrideModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <form onSubmit={handleConfirmOverride} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
              <div className="flex items-center gap-2 text-[#C82333]">
                <Lock className="w-5 h-5" />
                <h3 className="text-base font-bold">Bloqueio de Protocolo Mínimo ({empresa.bloqueioProtocoloMinimo || 100}%)</h3>
              </div>
              <div className="text-xs text-slate-700 space-y-1 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="font-semibold text-[#C82333]">Pendências impeditivas para Etapa {overrideModal.targetStage}:</p>
                {overrideModal.reasons.map((r, i) => (
                  <p key={i}>• {r}</p>
                ))}
              </div>
              <textarea
                required
                rows={3}
                value={overrideModal.justificativa}
                onChange={(e) => setOverrideModal({ ...overrideModal, justificativa: e.target.value })}
                placeholder="Justificativa técnica do administrador..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideModal(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#C82333]">
                  Autorizar Override &amp; Avançar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Encerrar Caso */}
        {closeCaseModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <form onSubmit={handleCloseCaseConfirm} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">Encerrar Caso Migratório</h3>
              <p className="text-xs text-slate-600">
                O caso avançará para a Etapa 15 (Encerrado) mantendo todo o dossiê, documentos e auditoria preservados.
              </p>
              <textarea
                required
                rows={3}
                value={closeCaseReason}
                onChange={(e) => setCloseCaseReason(e.target.value)}
                placeholder="Motivo do encerramento (ex.: Cédula emitida e relocation concluído, desistência formal...)"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setCloseCaseModalOpen(false)} className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#C82333]">
                  Confirmar Encerramento
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Modal Preview Documento (PDF/Imagem) */}
        {previewDocModal && previewDocModal.arquivoUrl && (
          <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">{previewDocModal.nomeDocumento}</p>
                  <p className="text-[11px] text-slate-500">{previewDocModal.pessoa} · Versão {previewDocModal.versao}</p>
                </div>
                <button type="button" onClick={() => setPreviewDocModal(null)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 bg-slate-100 p-4 overflow-auto flex items-center justify-center min-h-[380px]">
                {/\.(png|jpg|jpeg|webp)(\?|$)/i.test(previewDocModal.arquivoUrl) ? (
                  <img src={previewDocModal.arquivoUrl} alt={previewDocModal.nomeDocumento} className="max-h-[70vh] object-contain rounded" />
                ) : (
                  <iframe src={previewDocModal.arquivoUrl} title={previewDocModal.nomeDocumento} className="w-full h-[70vh] bg-white rounded border border-slate-200" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Completo de Documento */}
        {docModalOpen && editingDoc && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <form onSubmit={handleSaveFullDocModal} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-base font-bold text-slate-900">Detalhes do Documento</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nome do documento *</label>
                  <input
                    required
                    value={editingDoc.nomeDocumento || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, nomeDocumento: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pessoa</label>
                  <select
                    value={editingDoc.pessoa || 'Titular'}
                    onChange={(e) => setEditingDoc({ ...editingDoc, pessoa: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="Titular">Titular</option>
                    {caseDependents.map((dep) => (
                      <option key={dep.id} value={dep.nomeCompleto}>{dep.nomeCompleto}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoria</label>
                  <select
                    value={editingDoc.categoriaDoc || 'Identidade'}
                    onChange={(e) => setEditingDoc({ ...editingDoc, categoriaDoc: e.target.value as DocCategory })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                  >
                    {['Identidade', 'Antecedentes', 'Familiares', 'Profissional/Financeiro', 'Apostilas', 'Traduções', 'Fotos', 'Taxas'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data de emissão</label>
                  <input
                    type="date"
                    value={editingDoc.dataEmissao || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, dataEmissao: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Validade (dias, 0 = não vence)</label>
                  <input
                    type="number"
                    min={0}
                    value={editingDoc.validadeDias ?? 0}
                    onChange={(e) => setEditingDoc({ ...editingDoc, validadeDias: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 tabular-nums"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Órgão emissor</label>
                  <input
                    value={editingDoc.orgaoEmissor || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, orgaoEmissor: e.target.value })}
                    placeholder="Ex.: Polícia Federal, Cartório RCPN, Receita Federal"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(editingDoc.exigeApostila)}
                    onChange={(e) => setEditingDoc({ ...editingDoc, exigeApostila: e.target.checked })}
                  />
                  Exige Apostila de Haia
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(editingDoc.exigeTraducao)}
                    onChange={(e) => setEditingDoc({ ...editingDoc, exigeTraducao: e.target.checked })}
                  />
                  Exige Tradução Juramentada
                </label>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Observações</label>
                  <textarea
                    rows={2}
                    value={editingDoc.observacoes || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, observacoes: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  {canManageClients && editingDoc.id && caseDocs.some((d) => d.id === editingDoc.id) && (
                    <button
                      type="button"
                      onClick={() => {
                        const targetDoc = caseDocs.find((d) => d.id === editingDoc.id);
                        if (!targetDoc) return;
                        setDocModalOpen(false);
                        setConfirmDeleteItem({
                          kind: 'doc',
                          title: 'Excluir Documento',
                          description: `Deseja excluir permanentemente "${targetDoc.nomeDocumento}"?`,
                          confirmLabel: 'Excluir Documento',
                          item: targetDoc,
                        });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Documento
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDocModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
                    Cancelar
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                    Salvar Documento
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        <LegalBaseModal
          open={legalModalOpen}
          onClose={() => setLegalModalOpen(false)}
          title={`Base Legal — ${activeVisaCategory?.nomePortugues || activeCase.tipoServico}`}
          sources={activeCaseLegalSources}
        />

        <ClientDossierModal
          open={Boolean(dossierClient)}
          onClose={() => setDossierClientId(null)}
          client={dossierClient}
          allClients={clients}
          role={role}
          userName={userProfile.nome || userProfile.email}
          dependents={dependents}
          cases={cases}
          caseFinancials={caseFinancials}
          caseDocuments={docs}
          tasks={tasks}
          deadlines={deadlines}
          appointments={appointments}
          communicationLogs={communicationLogs}
          viabilityAssessments={viabilityAssessments}
          budgets={budgets}
          financialRecords={financialRecords}
          generatedDocuments={generatedDocuments}
          auditLogs={auditLogs}
          messageTemplates={messageTemplates}
          onRefresh={onRefresh}
          onOpenCase={(cId) => {
            setDossierClientId(null);
            onSelectCase(cId);
          }}
          onLogWhatsApp={onLogWhatsApp}
          onOpenContractModal={(clId, csId) => {
            setDossierClientId(null);
            setContractModalInit({ clientId: clId, caseId: csId });
            setContractModalOpen(true);
          }}
        />

        <ContractGeneratorModal
          open={contractModalOpen}
          onClose={() => setContractModalOpen(false)}
          role={role}
          userProfile={userProfile}
          empresa={empresa}
          clients={clients}
          cases={cases}
          dependents={dependents}
          documentTemplates={documentTemplates}
          generatedDocuments={generatedDocuments}
          initialClientId={contractModalInit.clientId}
          initialCaseId={contractModalInit.caseId}
          onRefresh={onRefresh}
          onLogWhatsApp={onLogWhatsApp}
        />

        {renderDeleteModals()}
      </div>
    );
  }

  // ===========================================================================
  // Renderização: Lista / Kanban de Casos & Gestão de Clientes
  // ===========================================================================
  const editingClientDuplicate =
    clientModalOpen && editingClient
      ? clients.find(
          (c) =>
            c.id !== editingClient.id &&
            ((editingClient.email && c.email.toLowerCase() === editingClient.email.trim().toLowerCase()) ||
              (editingClient.cpf && normalizeDigits(editingClient.cpf) && normalizeDigits(c.cpf) === normalizeDigits(editingClient.cpf)) ||
              (editingClient.whatsapp && normalizeDigits(editingClient.whatsapp) && normalizeDigits(c.whatsapp) === normalizeDigits(editingClient.whatsapp))),
        ) || null
      : null;

  const activeExtraCaseFiltersCount =
    (casePriorityFilter !== 'all' ? 1 : 0) +
    (caseSermigFilter !== 'all' ? 1 : 0) +
    (caseVisaFilter !== 'all' ? 1 : 0) +
    (caseCriticalOnly ? 1 : 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {mode === 'clientes'
              ? 'Clientes'
              : mode === 'casos'
                ? 'Processos'
                : 'Clientes & Processos'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {mode === 'clientes'
              ? 'Cadastro de clientes, dependentes e acesso ao Portal do Cliente.'
              : 'Acompanhe cada cliente em 5 etapas simples: Diagnóstico, Abertura, Documentos, Protocolo SERMIG e Finalização.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {mode === 'ambos' && (
            <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setSubView('casos')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${subView === 'casos' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Processos ({cases.length})
              </button>
              <button
                type="button"
                onClick={() => setSubView('clientes')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold ${subView === 'clientes' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
              >
                Clientes ({clients.filter((c) => !c.arquivado).length})
              </button>
            </div>
          )}

          {canManageClients && (mode === 'ambos' || mode === 'clientes') && (
            <>
              <button
                type="button"
                onClick={() => setCsvImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Upload className="w-3.5 h-3.5" />
                Importar CSV
              </button>
              <button
                type="button"
                onClick={openNewClientModal}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold ${
                  mode === 'clientes'
                    ? 'text-white'
                    : 'border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
                style={mode === 'clientes' ? { backgroundColor: 'var(--color-primary)' } : undefined}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Novo Cliente
              </button>
            </>
          )}
          {(mode === 'ambos' || mode === 'casos') && (
            <button
              type="button"
              onClick={() => setCaseModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Processo
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 font-medium">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-[#C82333] dark:text-red-300 font-medium">
          {errorMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        {/* Barra rápida de 5 etapas em 1 clique para Processos */}
        {subView === 'casos' && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setCaseStageFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                caseStageFilter === 'all'
                  ? 'bg-[#0B1F33] dark:bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos ({cases.filter((c) => !c.arquivado).length})
            </button>
            {MACRO_FUNNEL_STAGES.map((m) => {
              const value = `macro:${m.id}`;
              const active = caseStageFilter === value;
              const count = cases.filter((c) => !c.arquivado && getMacroStageForCase(c).id === m.id).length;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setCaseStageFilter(value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors tabular-nums ${
                    active
                      ? 'bg-[#0B1F33] dark:bg-sky-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {m.ordem}. {m.nome} ({count})
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, título do processo, CPF, WhatsApp ou nº SERMIG..."
            className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm"
          />
          {subView === 'casos' ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowMoreCaseFilters((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold whitespace-nowrap ${
                  showMoreCaseFilters || activeExtraCaseFiltersCount > 0
                    ? 'border-[#0B1F33] dark:border-sky-500 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Mais filtros{activeExtraCaseFiltersCount > 0 ? ` (${activeExtraCaseFiltersCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setCasesLayout(casesLayout === 'lista' ? 'kanban' : 'lista')}
                className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap"
              >
                Ver como: {casesLayout === 'lista' ? 'Kanban' : 'Lista'}
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToCSV(
                    'casos-dm-integra',
                    ['Título', 'Cliente', 'Serviço', 'Etapa', 'Status SERMIG', 'Prioridade'],
                    filteredCases.map((c) => [
                      c.titulo,
                      clientMap.get(c.clientId)?.nomeCompleto || '',
                      c.tipoServico,
                      `Etapa ${c.etapaPipeline}`,
                      c.statusSermig,
                      c.prioridade,
                    ]),
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'clientes-dm-integra',
                  ['Nome', 'E-mail', 'WhatsApp', 'CPF', 'Portal', 'LGPD'],
                  filteredClients.map((cl) => [
                    cl.nomeCompleto,
                    cl.email,
                    cl.whatsapp,
                    cl.cpf || '',
                    cl.portalLiberado ? 'Liberado' : cl.statusAcessoPortal,
                    cl.lgpdAceito ? `v${cl.lgpdVersao || '1.0'}` : 'Pendente',
                  ]),
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          )}
        </div>

        {/* Filtros específicos da visão ativa */}
        {subView === 'clientes' ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={clientPortalFilter}
              onChange={(e) => setClientPortalFilter(e.target.value as 'all' | 'liberado' | 'pendente')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">Portal: Todos</option>
              <option value="liberado">Portal Liberado</option>
              <option value="pendente">Portal Pendente/Bloqueado</option>
            </select>
            <select
              value={clientPassportFilter}
              onChange={(e) => setClientPassportFilter(e.target.value as 'all' | 'expiring_12m')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">Passaporte: Todos</option>
              <option value="expiring_12m">Passaporte &lt; 12 meses</option>
            </select>
            <select
              value={clientPendingFilter}
              onChange={(e) => setClientPendingFilter(e.target.value as 'all' | 'com_pendencias')}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">Pendências: Todas</option>
              <option value="com_pendencias">Com documentos pendentes</option>
            </select>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={showArchivedClients}
                onChange={(e) => setShowArchivedClients(e.target.checked)}
              />
              Mostrar arquivados
            </label>
          </div>
        ) : showMoreCaseFilters ? (
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2 text-xs">
            <select
              value={casePriorityFilter}
              onChange={(e) => setCasePriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">Prioridade: Todas</option>
              <option value="Urgente">Urgente</option>
              <option value="Alta">Alta</option>
              <option value="Média">Média</option>
              <option value="Baixa">Baixa</option>
            </select>
            <select
              value={caseSermigFilter}
              onChange={(e) => setCaseSermigFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">SERMIG: Todos</option>
              {SERMIG_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={caseVisaFilter}
              onChange={(e) => setCaseVisaFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
            >
              <option value="all">Subcategoria: Todas</option>
              {visaCategories.map((v) => (
                <option key={v.id} value={v.id}>{v.codigo} — {v.nomePortugues}</option>
              ))}
            </select>
            <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={caseCriticalOnly}
                onChange={(e) => setCaseCriticalOnly(e.target.checked)}
              />
              Prazos críticos (&le; 30d)
            </label>
            {activeExtraCaseFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCasePriorityFilter('all');
                  setCaseSermigFilter('all');
                  setCaseVisaFilter('all');
                  setCaseCriticalOnly(false);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Limpar filtros
              </button>
            )}
          </div>
        ) : null}
      </div>

      {subView === 'clientes' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          {filteredClients.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Nenhum cliente encontrado com os filtros atuais.</div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">CPF / WhatsApp</th>
                  <th className="py-3 px-4 font-semibold">Portal do Cliente</th>
                  <th className="py-3 px-4 font-semibold">LGPD</th>
                  <th className="py-3 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredClients.map((cl) => (
                  <tr key={cl.id} className={`hover:bg-slate-50/60 ${cl.arquivado ? 'opacity-60' : ''}`}>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">
                        {cl.nomeCompleto}
                        {cl.arquivado ? ' (Arquivado)' : ''}
                      </p>
                      <p className="text-xs text-slate-500">{cl.email}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 tabular-nums">
                      {cl.cpf || 'CPF pendente'} · {cl.whatsapp}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className={cl.portalLiberado ? 'text-[#1E7E34] font-semibold' : 'text-slate-600'}>
                        {cl.portalLiberado ? 'Liberado' : cl.statusAcessoPortal}
                      </span>
                      {cl.conviteEnviadoEm && (
                        <p className="text-[11px] text-slate-400">Convite: {formatDateBR(cl.conviteEnviadoEm)}</p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {cl.lgpdAceito ? `Aceito v${cl.lgpdVersao || '1.0'}` : 'Pendente'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDossierClientId(cl.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        Abrir Cliente
                      </button>
                      {canManageClients && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleSendPortalInvite(cl)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Enviar Convite
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTogglePortalCliente(cl)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {cl.portalLiberado ? 'Bloquear' : 'Liberar'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                if (cl.arquivado) {
                                  await saveDocumentAudited(
                                    'clients',
                                    cl.id,
                                    { ...cl, arquivado: false, arquivadoEm: '' },
                                    false,
                                    role,
                                    'reativar_cliente',
                                  );
                                  setFeedback(`Cliente "${cl.nomeCompleto}" reativado.`);
                                } else {
                                  await archiveClientAudited(cl, role);
                                  setFeedback(`Cliente "${cl.nomeCompleto}" arquivado.`);
                                }
                                await onRefresh();
                              } catch (err) {
                                setErrorMsg(translateAppError(err).message || 'Erro ao atualizar arquivamento do cliente.');
                              }
                            }}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {cl.arquivado ? 'Reativar' : 'Arquivar'}
                          </button>
                        </>
                      )}
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setDeleteClientTarget(cl)}
                          aria-label={`Excluir cliente ${cl.nomeCompleto}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : casesLayout === 'lista' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          {filteredCases.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Nenhum caso encontrado.</div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-semibold">Processo</th>
                  <th className="py-3 px-4 font-semibold">Etapa Pipeline</th>
                  <th className="py-3 px-4 font-semibold">SERMIG &amp; Prazos</th>
                  <th className="py-3 px-4 font-semibold">Termômetro / Docs</th>
                  {!isAssistente && <th className="py-3 px-4 font-semibold">Contrato</th>}
                  <th className="py-3 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCases.map((c) => {
                  const cl = clientMap.get(c.clientId);
                  const cDocs = docs.filter((d) => d.caseId === c.id);
                  const pendingDocs = cDocs.filter((d) => d.status !== 'Aprovado').length;
                  const t = calcularTermometroDocumentos(cDocs);
                  const stageSummary = formatCaseStageSummary(c.etapaPipeline);
                  const nextDl = deadlines
                    .filter((d) => d.caseId === c.id && !d.concluido)
                    .sort((a, b) => a.dataLimite.localeCompare(b.dataLimite))[0];
                  const cFin = !isAssistente ? caseFinancials.find((f) => f.caseId === c.id) : null;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{c.titulo}</p>
                        <p className="text-xs text-slate-500">
                          {cl?.nomeCompleto || '—'} · {c.tipoServico} · {c.prioridade}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <p className="font-semibold" style={{ color: stageSummary.macro.corHex }}>
                          {stageSummary.macro.ordem}. {stageSummary.macro.nome}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {stageSummary.subStageName}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        <p className="font-medium">{c.statusSermig}</p>
                        {nextDl && (
                          <p className="text-[11px] text-slate-500">
                            Próx.: {formatDateBR(nextDl.dataLimite)}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs">
                        <p className="font-bold tabular-nums" style={{ color: t.corHex }}>
                          {t.notaGeral}%
                        </p>
                        <p className="text-[11px] text-slate-500">{pendingDocs} pendência(s)</p>
                      </td>
                      {!isAssistente && (
                        <td className="py-3 px-4 text-xs tabular-nums text-slate-800">
                          {cFin ? formatCurrency(cFin.valorContrato, cFin.moeda) : '—'}
                        </td>
                      )}
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c.id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          Abrir Processo
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeleteCaseTarget(c)}
                            aria-label={`Excluir processo ${c.titulo}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-[#C82333] hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Excluir
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <p>
              <strong>Funil Simplificado (5 Marcos de Conversão):</strong> etapas operacionais consolidadas para visão executiva sem excesso de colunas.
            </p>
            <span className="tabular-nums font-semibold text-slate-800">
              {filteredCases.length} caso(s) no quadro
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5 items-start">
            {MACRO_FUNNEL_STAGES.map((macro) => {
              const colCases = filteredCases.filter((c) => getMacroStageForCase(c).id === macro.id);
              const nextMacro = getNextMacroStage(macro.id);
              return (
                <div
                  key={macro.id}
                  className="bg-slate-100/80 border border-slate-200 rounded-xl overflow-hidden flex flex-col min-w-0"
                >
                  <div className="h-1.5 w-full" style={{ backgroundColor: macro.corHex }} />
                  <div className="p-3 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {macro.ordem}. {macro.nome}
                        </p>
                        <p className="text-[10px] text-slate-500 leading-snug mt-0.5">
                          {macro.marcoConversao}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-xs font-bold tabular-nums text-slate-800 shrink-0">
                        {colCases.length}
                      </span>
                    </div>

                    {colCases.length === 0 ? (
                      <div className="py-6 text-center text-[11px] text-slate-400 border border-dashed border-slate-300 rounded-lg bg-white/50">
                        Nenhum caso neste marco
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {colCases.map((c) => {
                          const cDocs = docs.filter((d) => d.caseId === c.id);
                          const pendingDocs = cDocs.filter((d) => d.status !== 'Aprovado').length;
                          const t = calcularTermometroDocumentos(cDocs, empresa.bloqueioProtocoloMinimo || 100);
                          const cFin = !isAssistente ? caseFinancials.find((f) => f.caseId === c.id) : null;
                          const nextDl = deadlines
                            .filter((d) => d.caseId === c.id && !d.concluido)
                            .sort((a, b) => a.dataLimite.localeCompare(b.dataLimite))[0];
                          const subSummary = formatCaseStageSummary(c.etapaPipeline);
                          const blockedForTramite =
                            nextMacro?.id === 'tramite' && t.notaGeral < (empresa.bloqueioProtocoloMinimo || 100);

                          return (
                            <div
                              key={c.id}
                              className="bg-white border border-slate-200 rounded-lg p-3 hover:border-[var(--color-primary)] transition-colors space-y-1.5"
                            >
                              <button
                                type="button"
                                onClick={() => onSelectCase(c.id)}
                                className="w-full text-left space-y-1"
                              >
                                <p className="text-xs font-bold text-slate-900 line-clamp-2">{c.titulo}</p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {clientMap.get(c.clientId)?.nomeCompleto || 'Cliente'}
                                </p>
                                <p className="text-[10px] font-medium text-slate-600 truncate">
                                  Sub-etapa: {subSummary.subStageName}
                                </p>
                              </button>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-semibold text-[var(--color-primary)] truncate">
                                  {c.statusSermig}
                                </span>
                                <span className="font-bold tabular-nums shrink-0" style={{ color: t.corHex }}>
                                  {t.notaGeral}%
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 tabular-nums">
                                {pendingDocs} doc(s) pend.
                                {nextDl ? ` · Próx. ${formatDateBR(nextDl.dataLimite)}` : ''}
                                {!isAssistente && cFin ? ` · ${formatCurrency(cFin.valorContrato, cFin.moeda)}` : ''}
                              </p>
                              {(nextMacro || isAdmin) && (
                                <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => onSelectCase(c.id)}
                                    className="text-[10px] font-semibold text-slate-600 hover:text-slate-900"
                                  >
                                    Abrir ficha
                                  </button>
                                  <div className="flex items-center gap-1">
                                    {nextMacro && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (blockedForTramite) {
                                            onSelectCase(c.id);
                                            return;
                                          }
                                          const targetStep = resolveTargetPipelineStep(nextMacro.id, c.etapaPipeline);
                                          try {
                                            await saveDocumentAudited(
                                              'cases',
                                              c.id,
                                              { ...c, etapaPipeline: targetStep },
                                              false,
                                              role,
                                              `avanco_funil_${nextMacro.id}`,
                                              { etapaPipeline: c.etapaPipeline },
                                            );
                                            await onRefresh();
                                          } catch (err) {
                                            reportAppError(err, { source: 'case-kanban-advance', path: `cases/${c.id}` });
                                          }
                                        }}
                                        title={
                                          blockedForTramite
                                            ? `Termômetro em ${t.notaGeral}%. Abra a ficha para conferir pendências ou aplicar override.`
                                            : `Avançar caso para ${nextMacro.nome}`
                                        }
                                        className={`text-[10px] font-semibold px-2 py-1 rounded border transition-colors ${
                                          blockedForTramite
                                            ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                                            : 'border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100'
                                        }`}
                                      >
                                        {blockedForTramite ? 'Validar p/ Trâmite' : `→ ${nextMacro.nomeCurto}`}
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        type="button"
                                        onClick={() => setDeleteCaseTarget(c)}
                                        aria-label={`Excluir processo ${c.titulo}`}
                                        className="p-1 rounded border border-red-200 text-[#C82333] hover:bg-red-50"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Novo/Editar Cliente */}
      {clientModalOpen && editingClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveClient} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Cadastro de Cliente</h2>
            {editingClientDuplicate && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950 flex items-center justify-between gap-2">
                <span>
                  Possível duplicado encontrado: <strong>{editingClientDuplicate.nomeCompleto}</strong> ({editingClientDuplicate.email}).
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setClientModalOpen(false);
                    setDossierClientId(editingClientDuplicate.id);
                  }}
                  className="underline font-semibold shrink-0"
                >
                  Abrir Dossiê
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome completo *</label>
                <input
                  required
                  value={editingClient.nomeCompleto || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, nomeCompleto: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Google *</label>
                <input
                  required
                  type="email"
                  value={editingClient.email || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp *</label>
                <input
                  required
                  value={editingClient.whatsapp || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, whatsapp: maskPhoneBR(e.target.value) })}
                  placeholder="+55 (00) 00000-0000"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">CPF</label>
                <input
                  value={editingClient.cpf || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, cpf: maskCPF(e.target.value) })}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Profissão</label>
                <input
                  value={editingClient.profissao || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, profissao: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(editingClient.portalLiberado)}
                onChange={(e) => setEditingClient({ ...editingClient, portalLiberado: e.target.checked })}
              />
              Liberar acesso ao Portal do Cliente imediatamente (pode cadastrar sem convite e liberar depois)
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClientModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Salvar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Importar Clientes CSV */}
      {csvImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">Importar Clientes via CSV</h2>
              <button type="button" onClick={() => setCsvImportOpen(false)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Formato esperado (separado por ponto e vírgula ou vírgula): <code>Nome;Email;WhatsApp;CPF</code>
            </p>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                void f.text().then((txt) => setCsvRawText(txt));
              }}
              className="text-xs"
            />
            <textarea
              rows={5}
              value={csvRawText}
              onChange={(e) => setCsvRawText(e.target.value)}
              placeholder="Maria Silva;maria@email.com;+55 11 99999-0000;000.000.000-00"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
            />
            {parsedCsvPreview.length > 0 && (
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 text-xs">
                {parsedCsvPreview.map((r) => (
                  <div key={r.rowNum} className="px-3 py-2 flex items-center justify-between gap-2">
                    <span className="truncate">
                      Linha {r.rowNum}: <strong>{r.nomeCompleto || '—'}</strong> ({r.email || 'sem email'})
                    </span>
                    <span className={r.status === 'valido' ? 'text-[#1E7E34] font-semibold' : 'text-[#C82333] font-semibold'}>
                      {r.status === 'valido' ? 'Válido' : r.motivo}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCsvImportOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
                Cancelar
              </button>
              <button
                type="button"
                disabled={csvImporting || parsedCsvPreview.filter((r) => r.status === 'valido').length === 0}
                onClick={() => void handleConfirmCsvImport()}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {csvImporting
                  ? 'Importando...'
                  : `Importar ${parsedCsvPreview.filter((r) => r.status === 'valido').length} válido(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Caso com Template Selector */}
      {caseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleCreateCase} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Abrir Novo Caso Migratório</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Template Operacional</label>
              <select
                value={newCaseTemplateId}
                onChange={(e) => handleApplyCaseTemplate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {CASE_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {CASE_TEMPLATES.find((t) => t.id === newCaseTemplateId)?.descricao}
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente *</label>
              <select
                required
                value={newCaseForm.clientId}
                onChange={(e) => setNewCaseForm({ ...newCaseForm, clientId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">Selecione um cliente...</option>
                {clients.filter((c) => !c.arquivado).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeCompleto} ({c.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Título do Processo *</label>
              <input
                required
                value={newCaseForm.titulo}
                onChange={(e) => setNewCaseForm({ ...newCaseForm, titulo: e.target.value })}
                placeholder="Ex.: João Silva – Residência Temporal Mercosul"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de Serviço</label>
                <select
                  value={newCaseForm.tipoServico}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, tipoServico: e.target.value as Case['tipoServico'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="Residência Temporal">Residência Temporal</option>
                  <option value="Residência Definitiva">Residência Definitiva</option>
                  <option value="Prorrogação">Prorrogação</option>
                  <option value="Mudança de Subcategoria">Mudança de Subcategoria</option>
                  <option value="Ratificação">Ratificação</option>
                  <option value="Relocation Completo">Relocation Completo</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade</label>
                <select
                  value={newCaseForm.prioridade}
                  onChange={(e) => setNewCaseForm({ ...newCaseForm, prioridade: e.target.value as Case['prioridade'] })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
              {serviceRequiresVisaCategory(newCaseForm.tipoServico) && (
                <div className={serviceNeedsCurrentResidencyExpiry(newCaseForm.tipoServico) ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategoria SERMIG</label>
                  <select
                    value={newCaseForm.visaCategoryId}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, visaCategoryId: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    {visaCategories.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.codigo} — {v.nomePortugues}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {serviceNeedsCurrentResidencyExpiry(newCaseForm.tipoServico) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vencimento da Residência Atual</label>
                  <input
                    type="date"
                    value={newCaseForm.dataVencimentoResidencia}
                    onChange={(e) => setNewCaseForm({ ...newCaseForm, dataVencimentoResidencia: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCaseModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {serviceRequiresVisaCategory(newCaseForm.tipoServico) ? 'Criar Caso com Checklist' : 'Criar Caso de Relocation'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ClientDossierModal
        open={Boolean(dossierClient)}
        onClose={() => setDossierClientId(null)}
        client={dossierClient}
        allClients={clients}
        role={role}
        userName={userProfile.nome || userProfile.email}
        dependents={dependents}
        cases={cases}
        caseFinancials={caseFinancials}
        caseDocuments={docs}
        tasks={tasks}
        deadlines={deadlines}
        appointments={appointments}
        communicationLogs={communicationLogs}
        viabilityAssessments={viabilityAssessments}
        budgets={budgets}
        financialRecords={financialRecords}
        generatedDocuments={generatedDocuments}
        auditLogs={auditLogs}
        messageTemplates={messageTemplates}
        onRefresh={onRefresh}
        onOpenCase={(cId) => {
          setDossierClientId(null);
          onSelectCase(cId);
        }}
        onLogWhatsApp={onLogWhatsApp}
        onOpenContractModal={(clId, csId) => {
          setDossierClientId(null);
          setContractModalInit({ clientId: clId, caseId: csId });
          setContractModalOpen(true);
        }}
      />

      <ContractGeneratorModal
        open={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        role={role}
        userProfile={userProfile}
        empresa={empresa}
        clients={clients}
        cases={cases}
        dependents={dependents}
        documentTemplates={documentTemplates}
        generatedDocuments={generatedDocuments}
        initialClientId={contractModalInit.clientId}
        initialCaseId={contractModalInit.caseId}
        onRefresh={onRefresh}
        onLogWhatsApp={onLogWhatsApp}
      />

      {renderDeleteModals()}
    </div>
  );
};
