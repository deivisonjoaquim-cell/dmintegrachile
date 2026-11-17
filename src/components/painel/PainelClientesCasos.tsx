import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Download,
  FileCheck,
  FileText,
  Lock,
  MessageCircle,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  clearAiDraftCache,
  loadAiDraftCache,
  sanitizeClientAiError,
  saveAiDraftCache,
  type AiResponseMeta,
} from '../../utils/aiClient';
import { PIPELINE_STAGES } from '../../data/seeds';
import {
  callAiEndpoint,
  deleteDocumentAudited,
  makeId,
  saveDocumentAudited,
  uploadFileToServer,
} from '../../services/firestoreService';
import type {
  Appointment,
  AuditLog,
  Budget,
  Case,
  CaseDocument,
  CaseFinancialSummary,
  Client,
  CommunicationLog,
  CurrencyCode,
  Deadline,
  Dependent,
  DocumentStep,
  EmpresaConfig,
  FinancialRecord,
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
  downloadIcsFile,
  exportToCSV,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  maskCPF,
  maskPhoneBR,
  parseFlexibleDate,
  toIsoDate,
} from '../../utils/formatters';

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
  auditLogs: AuditLog[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  messageTemplates: MessageTemplate[];
  partnersPublic: PartnerPublic[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string | null) => void;
  onRefresh: () => Promise<void>;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
}

type CaseTab = 'resumo' | 'dependentes' | 'documentos' | 'financeiro' | 'agenda' | 'comunicacao' | 'relocation' | 'historico';

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
  auditLogs,
  visaCategories,
  visaRequirements,
  legalSources,
  messageTemplates,
  partnersPublic,
  selectedCaseId,
  onSelectCase,
  onRefresh,
  onLogWhatsApp,
}) => {
  const isAssistente = role === 'assistente';
  const canManageClients = role === 'admin' || role === 'consultor';

  const [subView, setSubView] = useState<'casos' | 'clientes'>('casos');
  const [casesLayout, setCasesLayout] = useState<'lista' | 'kanban'>('lista');
  const [search, setSearch] = useState('');
  const [caseTab, setCaseTab] = useState<CaseTab>('resumo');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modais de criação
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Partial<Client> | null>(null);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [newCaseForm, setNewCaseForm] = useState({
    titulo: '',
    clientId: clients[0]?.id || '',
    tipoServico: 'Residência Temporal' as Case['tipoServico'],
    visaCategoryId: 'visa_15_mercosul',
    prioridade: 'Alta' as Case['prioridade'],
  });

  // Override de bloqueio mínimo de protocolo
  const [overrideModal, setOverrideModal] = useState<{ targetStage: number; justificativa: string } | null>(null);

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
  const [printMode, setPrintMode] = useState<'relacao' | 'apostila' | 'pacote' | null>(null);
  const [aiDocLoadingId, setAiDocLoadingId] = useState<string | null>(null);
  const [aiDocProgress, setAiDocProgress] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);

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
    if (activeCase?.id) {
      if (next) saveAiDraftCache(`parecer_${activeCase.id}`, next);
      else clearAiDraftCache(`parecer_${activeCase.id}`);
    }
  };

  // Formulários internos da Ficha do Caso
  const [depForm, setDepForm] = useState({ nomeCompleto: '', parentesco: 'Cônjuge' as Dependent['parentesco'], cpf: '', passaporteNumero: '' });
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
  const activeCase = useMemo(() => cases.find((c) => c.id === selectedCaseId) || null, [cases, selectedCaseId]);
  const activeClient = useMemo(() => (activeCase ? clientMap.get(activeCase.clientId) || null : null), [activeCase, clientMap]);

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(
      (c) => c.nomeCompleto.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.cpf || '').includes(q),
    );
  }, [clients, search]);

  const filteredCases = useMemo(() => {
    if (!search.trim()) return cases;
    const q = search.toLowerCase();
    return cases.filter((c) => {
      const cl = clientMap.get(c.clientId);
      return (
        c.titulo.toLowerCase().includes(q) ||
        (cl?.nomeCompleto || '').toLowerCase().includes(q) ||
        (c.numeroPedidoSermig || '').toLowerCase().includes(q)
      );
    });
  }, [cases, clientMap, search]);

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

  // ===========================================================================
  // Handlers de Caso
  // ===========================================================================
  const handleCreateCase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCaseForm.clientId || !newCaseForm.titulo.trim()) {
      setErrorMsg('Selecione o cliente e informe o título do caso.');
      return;
    }
    const id = makeId('case');
    const payload: Case = {
      id,
      titulo: newCaseForm.titulo.trim(),
      clientId: newCaseForm.clientId,
      consultorId: userProfile.uid,
      tipoServico: newCaseForm.tipoServico,
      visaCategoryId: newCaseForm.visaCategoryId,
      etapaPipeline: 2,
      statusSermig: 'Não protocolado',
      portalLiberado: clientMap.get(newCaseForm.clientId)?.portalLiberado || false,
      relatorioViabilidadeLiberado: false,
      prioridade: newCaseForm.prioridade,
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('cases', id, payload as unknown as Record<string, unknown>, true, role, 'novo_caso');
    setCaseModalOpen(false);
    setNewCaseForm({
      titulo: '',
      clientId: clients[0]?.id || '',
      tipoServico: 'Residência Temporal',
      visaCategoryId: 'visa_15_mercosul',
      prioridade: 'Alta',
    });
    setFeedback('Caso criado com sucesso!');
    await onRefresh();
    onSelectCase(id);
  };

  const handleSaveCaseField = async (patch: Partial<Case>, fieldLabel = 'atualizacao_caso') => {
    if (!activeCase) return;
    const updated: Case = { ...activeCase, ...patch };
    // Garantia estrita de que valorContrato nunca entra em cases
    delete (updated as unknown as Record<string, unknown>).valorContrato;
    await saveDocumentAudited('cases', activeCase.id, updated as unknown as Record<string, unknown>, false, role, fieldLabel, activeCase);
    setFeedback('Dados do caso atualizados.');
    await onRefresh();
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

  const activeVisaReqs = useMemo(() => {
    if (!activeCase?.visaCategoryId) return [];
    return visaRequirements.filter((r) => r.visaCategoryId === activeCase.visaCategoryId);
  }, [visaRequirements, activeCase]);

  const schedulePreview = useMemo(
    () => gerarCronogramaEmissao(activeVisaReqs, dataAlvoProtocolo),
    [activeVisaReqs, dataAlvoProtocolo],
  );

  // ===========================================================================
  // Mudança de etapa com verificação de bloqueio mínimo
  // ===========================================================================
  const handleStageChange = async (targetStage: number) => {
    if (!activeCase) return;
    if (targetStage >= 7 && thermo.bloqueadoProtocolo && !activeCase.overrideProtocoloMinimo) {
      setOverrideModal({ targetStage, justificativa: '' });
      return;
    }
    await handleSaveCaseField({ etapaPipeline: targetStage }, 'etapaPipeline');
  };

  const handleConfirmOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideModal || !overrideModal.justificativa.trim() || !activeCase) return;
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
    setOverrideModal(null);
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
          caseData: activeCase,
          clientData: activeClient,
          dependents: caseDependents,
          legalSources,
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
    if (patch.dataEmissao && next.validadeDias > 0) {
      const dt = parseFlexibleDate(patch.dataEmissao);
      if (dt) {
        next.dataValidadeCalculada = toIsoDate(new Date(dt.getTime() + next.validadeDias * 86400000));
      }
    }
    if (patch.status === 'Aprovado') {
      next.etapaEsteira = '6 Aprovado para Protocolo';
      next.motivoReprovacao = '';
    } else if (patch.status === 'Reprovado') {
      next.etapaEsteira = '4 Pendência/Reprovado';
    }
    await saveDocumentAudited('caseDocuments', docItem.id, next as unknown as Record<string, unknown>, false, role, 'documento_caso', docItem);
    await onRefresh();
  };

  const handleUploadDocStaff = async (docItem: CaseDocument, file: File) => {
    setUploadingDocId(docItem.id);
    setErrorMsg(null);
    try {
      const uploaded = await uploadFileToServer(file);
      const prevHist = docItem.historicoVersoes || [];
      const nextHist = docItem.arquivoUrl
        ? [...prevHist, { versao: docItem.versao, arquivoUrl: docItem.arquivoUrl, data: new Date().toISOString() }]
        : prevHist;
      await handleUpdateDoc(docItem, {
        arquivoUrl: uploaded.url,
        arquivoNome: uploaded.filename,
        status: 'Em análise',
        etapaEsteira: '3 Em Conferência',
        versao: docItem.arquivoUrl ? docItem.versao + 1 : docItem.versao,
        historicoVersoes: nextHist,
      });
      setFeedback(`Arquivo "${uploaded.filename}" anexado ao documento.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro no upload.');
    } finally {
      setUploadingDocId(null);
    }
  };

  const handleAnalyzeDocIa = async (docItem: CaseDocument) => {
    if (aiDocLoadingId) return;
    setAiDocLoadingId(docItem.id);
    setAiDocProgress('Analisando anexo...');
    setErrorMsg(null);
    try {
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
      cpf: depForm.cpf,
      passaporteNumero: depForm.passaporteNumero,
    };
    await saveDocumentAudited('dependents', id, payload as unknown as Record<string, unknown>, true, role, 'dependente');
    setDepForm({ nomeCompleto: '', parentesco: 'Cônjuge', cpf: '', passaporteNumero: '' });
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

  // ===========================================================================
  // Renderização: Ficha do Caso (8 Abas)
  // ===========================================================================
  if (activeCase) {
    const allTabs: { id: CaseTab; label: string; hidden?: boolean }[] = [
      { id: 'resumo', label: '1. Resumo & Viabilidade' },
      { id: 'dependentes', label: `2. Dependentes (${caseDependents.length})` },
      { id: 'documentos', label: `3. Documentos (${caseDocs.length})` },
      { id: 'financeiro', label: '4. Orçamento & Financeiro', hidden: isAssistente },
      { id: 'agenda', label: '5. Agenda & Prazos' },
      { id: 'comunicacao', label: '6. Comunicação' },
      { id: 'relocation', label: '7. Relocation' },
      { id: 'historico', label: '8. Histórico' },
    ];

    const visibleTabs = allTabs.filter((t) => !t.hidden);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <button
            type="button"
            onClick={() => onSelectCase(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar aos Casos
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white tabular-nums" style={{ color: thermo.corHex }}>
              Termômetro: {thermo.notaGeral}% · {thermo.faixa}
            </span>
            <select
              value={activeCase.etapaPipeline}
              onChange={(e) => void handleStageChange(Number(e.target.value))}
              aria-label="Etapa do pipeline"
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
            >
              {PIPELINE_STAGES.map((st) => (
                <option key={st.numero} value={st.numero}>
                  Etapa {st.numero}: {st.nome}
                </option>
              ))}
            </select>
            <select
              value={activeCase.statusSermig}
              onChange={(e) => void handleSaveCaseField({ statusSermig: e.target.value as Case['statusSermig'] }, 'statusSermig')}
              aria-label="Status SERMIG"
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
            >
              {SERMIG_STATUSES.map((s) => (
                <option key={s} value={s}>
                  SERMIG: {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">
                Cliente: {activeClient?.nomeCompleto || '—'} · {activeClient?.email} · {activeClient?.whatsapp}
              </p>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">{activeCase.titulo}</h1>
            </div>
            <div className="flex flex-wrap gap-2 no-print">
              <button
                type="button"
                onClick={() => void handleSaveCaseField({ portalLiberado: !activeCase.portalLiberado }, 'portalLiberado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  activeCase.portalLiberado ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                {activeCase.portalLiberado ? 'Portal Liberado ao Cliente' : 'Liberar Caso no Portal'}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveCaseField({ relatorioViabilidadeLiberado: !activeCase.relatorioViabilidadeLiberado }, 'relatorioViabilidadeLiberado')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  activeCase.relatorioViabilidadeLiberado ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                {activeCase.relatorioViabilidadeLiberado ? 'Parecer Visível ao Cliente' : 'Liberar Parecer ao Cliente'}
              </button>
            </div>
          </div>

          {/* 8 Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pt-2 no-print">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setCaseTab(t.id)}
                className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                  caseTab === t.id
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
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

          {/* ABA 1: RESUMO & VIABILIDADE */}
          {caseTab === 'resumo' && (
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Número do Pedido SERMIG</label>
                  <input
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data do Protocolo</label>
                  <input
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Data Limite Entrada (90d Estampado)</label>
                  <input
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vencimento da Residência (Janela Prorrogação)</label>
                  <input
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
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prazo Requerimento / Descargos</label>
                  <input
                    type="date"
                    defaultValue={activeCase.prazoRequerimento || ''}
                    onBlur={(e) => {
                      if (e.target.value !== (activeCase.prazoRequerimento || '')) {
                        void handleSaveCaseField({ prazoRequerimento: e.target.value }, 'prazoRequerimento');
                      }
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              </div>

              {activeCase.overrideProtocoloMinimo && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <p className="font-semibold">Override de Protocolo Mínimo Registrado</p>
                  <p>
                    Autorizado por {activeCase.overrideProtocoloMinimo.autorizadoPor} em{' '}
                    {formatDateTimeBR(activeCase.overrideProtocoloMinimo.data)}: {activeCase.overrideProtocoloMinimo.justificativa}
                  </p>
                </div>
              )}

              {!isAssistente && (
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Parecer Técnico &amp; Viabilidade (Confrontado com Base Legal)</h3>
                      <p className="text-xs text-slate-500">
                        A IA gera um rascunho citando exclusivamente a Base Legal cadastrada. Edite e aprove antes de liberar ao cliente.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={aiParecerLoading}
                      onClick={handleGenerateAiParecer}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {aiParecerLoading ? aiParecerProgress || 'Gerando rascunho...' : 'Gerar Rascunho de Parecer com IA'}
                    </button>
                  </div>

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
                                {parecerDraft.origemLabel || 'Rascunho gerado por regras — IA indisponível no momento'}
                              </p>
                              {parecerDraft.mensagemUsuario && (
                                <p className="text-xs text-amber-900">{parecerDraft.mensagemUsuario}</p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg">
                              {parecerDraft.origemLabel || 'Rascunho editável gerado pela IA'} — revise e ajuste antes de aprovar.
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
                          {aiParecerLoading ? aiParecerProgress || 'Tentando novamente...' : 'Tentar novamente com IA'}
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
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Elegibilidade &amp; Riscos</label>
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
                      <p className="text-xs font-semibold text-slate-700">Versões Salvas:</p>
                      {caseAssessments.map((va) => (
                        <div key={va.id} className="bg-white border border-slate-200 rounded-lg p-3.5 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900">
                              Versão {va.versao} · {formatDateTimeBR(va.createdAt)} · {va.autorNome}
                            </span>
                            <span className={va.liberadoAoCliente ? 'text-[#1E7E34] font-semibold' : 'text-slate-500'}>
                              {va.liberadoAoCliente ? 'Liberado ao cliente' : 'Uso interno'}
                            </span>
                          </div>
                          <p className="text-slate-700 whitespace-pre-wrap">{va.enquadramentoLegal}</p>
                          <p className="text-slate-600 whitespace-pre-wrap">{va.recomendacoes}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: DEPENDENTES */}
          {caseTab === 'dependentes' && (
            <div className="space-y-5 pt-2">
              {canManageClients && (
                <form onSubmit={handleAddDependent} className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Passaporte / CPF</label>
                    <input
                      value={depForm.passaporteNumero}
                      onChange={(e) => setDepForm({ ...depForm, passaporteNumero: e.target.value })}
                      placeholder="Nº passaporte"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    + Adicionar
                  </button>
                </form>
              )}

              {caseDependents.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">Nenhum dependente vinculado a este cliente.</p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                  {caseDependents.map((dep) => (
                    <div key={dep.id} className="p-4 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{dep.nomeCompleto}</p>
                        <p className="text-slate-500">
                          {dep.parentesco} {dep.passaporteNumero ? `· Passaporte ${dep.passaporteNumero}` : ''}
                        </p>
                      </div>
                      {canManageClients && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteDocumentAudited('dependents', dep.id, role, dep);
                            await onRefresh();
                          }}
                          className="p-1.5 rounded-lg border border-red-200 text-[#C82333] hover:bg-red-50"
                          aria-label={`Remover ${dep.nomeCompleto}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ABA 3: DOCUMENTOS (Checklist, Esteira, Termômetro, Cronograma, IA) */}
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
                  <button
                    type="button"
                    onClick={handleGenerateChecklistDocs}
                    className="w-full px-3 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    Gerar Checklist do Visto (Titular + Dep.)
                  </button>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPrintMode('relacao')}
                      className="px-2 py-1.5 rounded-lg border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Relação A4
                    </button>
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
                  </div>
                </div>
              </div>

              {/* Cronograma Reverso de Emissões */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3 no-print">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cronograma Inteligente de Emissão Reversa</h3>
                    <p className="text-xs text-slate-500">
                      Calcula datas sugeridas a partir da data-alvo do protocolo para evitar vencimento de certidões (ex.: Antecedentes PF 60d).
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
                      Aplicar datas ao checklist
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

              {/* Adicionar documento manual */}
              <form onSubmit={handleAddManualDoc} className="flex flex-wrap gap-2 items-center no-print">
                <input
                  value={newDocName}
                  onChange={(e) => setNewDocName(e.target.value)}
                  placeholder="Adicionar documento extra ao checklist..."
                  className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
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
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  + Incluir documento
                </button>
              </form>

              {/* Lista de documentos na esteira */}
              {caseDocs.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">
                  Clique em &ldquo;Gerar Checklist do Visto&rdquo; acima para criar a esteira documental.
                </p>
              ) : (
                <div className="space-y-3">
                  {[...caseDocs]
                    .sort((a, b) => a.ordemEmissao - b.ordemEmissao)
                    .map((d) => (
                      <div key={d.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-slate-500">
                              Ordem #{d.ordemEmissao} · {d.pessoa} · {d.categoriaDoc} · Peso {d.peso}/5 ·{' '}
                              {d.obrigatorio ? 'Obrigatório' : 'Opcional'}
                              {d.prazoSugeridoEmissao ? ` · Emitir até ${formatDateBR(d.prazoSugeridoEmissao)}` : ''}
                            </p>
                            <p className="text-sm font-bold text-slate-900">{d.nomeDocumento}</p>
                            {d.analiseIaSugestao && (
                              <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 mt-1.5">
                                {d.analiseIaSugestao}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
                            {d.arquivoUrl && (
                              <a
                                href={d.arquivoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Abrir v{d.versao}
                              </a>
                            )}
                            <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 cursor-pointer hover:bg-slate-50">
                              <Upload className="w-3.5 h-3.5" />
                              {uploadingDocId === d.id ? 'Enviando...' : 'Anexar'}
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) void handleUploadDocStaff(d, f);
                                }}
                              />
                            </label>
                            <button
                              type="button"
                              disabled={aiDocLoadingId !== null}
                              onClick={() => void handleAnalyzeDocIa(d)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                              {aiDocLoadingId === d.id ? aiDocProgress || 'Analisando...' : 'Sugestão IA'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs pt-2 border-t border-slate-100 no-print">
                          <select
                            value={d.status}
                            onChange={(e) => void handleUpdateDoc(d, { status: e.target.value as CaseDocument['status'] })}
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
                          <input
                            type="date"
                            value={d.dataEmissao || ''}
                            onChange={(e) => void handleUpdateDoc(d, { dataEmissao: e.target.value })}
                            title="Data de emissão"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                          />
                          <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                            <input
                              type="checkbox"
                              checked={d.apostilado}
                              onChange={(e) => void handleUpdateDoc(d, { apostilado: e.target.checked })}
                            />
                            Apostilado
                          </label>
                          <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                            <input
                              type="checkbox"
                              checked={d.traduzido}
                              onChange={(e) => void handleUpdateDoc(d, { traduzido: e.target.checked })}
                            />
                            Traduzido
                          </label>
                        </div>

                        {d.status === 'Reprovado' && (
                          <input
                            defaultValue={d.motivoReprovacao || ''}
                            onBlur={(e) => {
                              if (e.target.value !== (d.motivoReprovacao || '')) {
                                void handleUpdateDoc(d, { motivoReprovacao: e.target.value });
                              }
                            }}
                            placeholder="Informe o motivo da reprovação para o cliente visualizar no Portal..."
                            className="w-full px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs text-[#C82333]"
                          />
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* Área de impressão A4 / Checklist Haia / Pacote SERMIG */}
              {printMode && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                  <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3 no-print">
                      <h3 className="text-base font-bold text-slate-900">
                        {printMode === 'relacao'
                          ? 'Relação Priorizada de Documentos (A4)'
                          : printMode === 'apostila'
                            ? 'Checklist Apostila de Haia & Traduções'
                            : 'Pacote Consolidado SERMIG'}
                      </h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          Imprimir / PDF
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
                        <strong>Cliente:</strong> {activeClient?.nomeCompleto} · <strong>Processo:</strong> {activeCase.titulo}
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
                            .filter((d) => (printMode === 'apostila' ? d.exigeApostila || d.exigeTraducao : true))
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
                    <option value="Validade Documento">Validade Documento</option>
                    <option value="Entrada no Chile 90d">Entrada no Chile 90d</option>
                    <option value="Janela Prorrogação">Janela Prorrogação</option>
                    <option value="Prazo Legal 6 Meses SERMIG">Prazo Legal 6 Meses SERMIG</option>
                    <option value="Resposta Requerimento/Recurso">Resposta Requerimento/Recurso</option>
                    <option value="Vencimento Cédula">Vencimento Cédula</option>
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
                      <div className="flex gap-2 pt-1">
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
                      <div className="flex gap-2 pt-1">
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
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ABA 6: COMUNICAÇÃO */}
          {caseTab === 'comunicacao' && (
            <div className="space-y-5 pt-2">
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
                {caseComms.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between text-slate-500">
                      <span className="font-semibold text-slate-800">{log.canal} · {log.assunto}</span>
                      <span>{formatDateTimeBR(log.createdAt)} · {log.autorNome}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{log.mensagem}</p>
                  </div>
                ))}
              </div>
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

          {/* ABA 8: HISTÓRICO */}
          {caseTab === 'historico' && (
            <div className="space-y-2 pt-2">
              {caseLogs.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhuma alteração auditada vinculada diretamente ainda.</p>
              ) : (
                caseLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border border-slate-200 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span className="font-semibold text-slate-800">
                        {log.acao} · {log.entidade} ({log.campo || 'registro'})
                      </span>
                      <span>{formatDateTimeBR(log.createdAt)} · {log.actorEmail}</span>
                    </div>
                  </div>
                ))
              )}
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
              <p className="text-xs text-slate-600">
                O termômetro documental deste caso está em <strong>{thermo.notaGeral}%</strong>, abaixo do mínimo configurado para protocolo no SERMIG.
                Para avançar para a Etapa {overrideModal.targetStage} mesmo assim, registre a justificativa auditada abaixo:
              </p>
              <textarea
                required
                rows={3}
                value={overrideModal.justificativa}
                onChange={(e) => setOverrideModal({ ...overrideModal, justificativa: e.target.value })}
                placeholder="Justificativa técnica do consultor..."
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
      </div>
    );
  }

  // ===========================================================================
  // Renderização: Lista / Kanban de Casos & Gestão de Clientes
  // ===========================================================================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clientes &amp; Casos Migratórios</h1>
          <p className="text-xs text-slate-500">
            Cadastre clientes com ou sem liberação imediata do Portal e conduza processos nas 15 etapas do pipeline
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setSubView('casos')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${subView === 'casos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Casos ({cases.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('clientes')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold ${subView === 'clientes' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
            >
              Clientes ({clients.length})
            </button>
          </div>

          {canManageClients && (
            <button
              type="button"
              onClick={openNewClientModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Novo Cliente
            </button>
          )}
          <button
            type="button"
            onClick={() => setCaseModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Caso
          </button>
        </div>
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

      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por cliente, título do caso, CPF ou nº pedido SERMIG..."
          className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-sm"
        />
        {subView === 'casos' && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCasesLayout(casesLayout === 'lista' ? 'kanban' : 'lista')}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Visualização: {casesLayout === 'lista' ? 'Lista' : 'Kanban'}
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
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        )}
      </div>

      {subView === 'clientes' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          {filteredClients.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Nenhum cliente cadastrado ainda.</div>
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
                  <tr key={cl.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{cl.nomeCompleto}</p>
                      <p className="text-xs text-slate-500">{cl.email}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 tabular-nums">
                      {cl.cpf || 'CPF pendente'} · {cl.whatsapp}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className={cl.portalLiberado ? 'text-[#1E7E34] font-semibold' : 'text-slate-600'}>
                        {cl.portalLiberado ? 'Liberado' : cl.statusAcessoPortal}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {cl.lgpdAceito ? `Aceito v${cl.lgpdVersao || '1.0'}` : 'Pendente'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      {canManageClients && (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleTogglePortalCliente(cl)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {cl.portalLiberado ? 'Bloquear Portal' : 'Liberar Portal'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClient(cl);
                              setClientModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Editar
                          </button>
                        </>
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
                  <th className="py-3 px-4 font-semibold">Status SERMIG</th>
                  <th className="py-3 px-4 font-semibold">Termômetro</th>
                  <th className="py-3 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredCases.map((c) => {
                  const cl = clientMap.get(c.clientId);
                  const t = calcularTermometroDocumentos(docs.filter((d) => d.caseId === c.id));
                  const st = PIPELINE_STAGES.find((p) => p.numero === c.etapaPipeline);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{c.titulo}</p>
                        <p className="text-xs text-slate-500">{cl?.nomeCompleto || '—'} · {c.tipoServico}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">
                        Etapa {c.etapaPipeline}: {st?.nome}
                      </td>
                      <td className="py-3 px-4 text-xs font-medium text-slate-700">{c.statusSermig}</td>
                      <td className="py-3 px-4 text-xs font-bold tabular-nums" style={{ color: t.corHex }}>
                        {t.notaGeral}%
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onSelectCase(c.id)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: 'var(--color-primary)' }}
                        >
                          Abrir Ficha (8 Abas)
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((st) => {
            const colCases = filteredCases.filter((c) => c.etapaPipeline === st.numero);
            return (
              <div key={st.numero} className="min-w-[240px] w-[240px] shrink-0 bg-slate-100/80 border border-slate-200 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>
                    {st.numero}. {st.nome}
                  </span>
                  <span className="tabular-nums">{colCases.length}</span>
                </div>
                {colCases.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCase(c.id)}
                    className="w-full text-left bg-white border border-slate-200 rounded-lg p-3 hover:border-[var(--color-primary)] transition-colors space-y-1"
                  >
                    <p className="text-xs font-bold text-slate-900 line-clamp-2">{c.titulo}</p>
                    <p className="text-[11px] text-slate-500">{clientMap.get(c.clientId)?.nomeCompleto || 'Cliente'}</p>
                    <p className="text-[11px] font-medium text-[var(--color-primary)]">{c.statusSermig}</p>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Novo/Editar Cliente */}
      {clientModalOpen && editingClient && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveClient} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Cadastro de Cliente</h2>
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

      {/* Modal Novo Caso */}
      {caseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleCreateCase} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Abrir Novo Caso Migratório</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente *</label>
              <select
                required
                value={newCaseForm.clientId}
                onChange={(e) => setNewCaseForm({ ...newCaseForm, clientId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="">Selecione um cliente...</option>
                {clients.map((c) => (
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
                Criar Caso
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
