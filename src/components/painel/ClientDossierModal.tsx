import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Briefcase,
  Download,
  FileText,
  GitMerge,
  Lock,
  MessageCircle,
  Send,
  Shield,
  Trash2,
  Upload,
  User,
  X,
} from 'lucide-react';
import { ConfirmActionModal, ConfirmTypedModal, UiButton } from '../ui/DesignSystem';
import { translateAppError } from '../../services/errorService';
import {
  archiveClientAudited,
  deleteClientCascadeAudited,
  deleteDocumentAudited,
  logSensitiveDocumentAccess,
  makeId,
  mergeClientsAudited,
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
  Deadline,
  Dependent,
  FinancialRecord,
  GeneratedDocument,
  MessageTemplate,
  Task,
  UserRole,
  ViabilityAssessment,
} from '../../types/domain';
import {
  applyTemplateVariables,
  buildWhatsAppUrl,
  daysUntilDate,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  formatStandardDocFilename,
  isValidCPF,
  maskCPF,
  maskPhoneBR,
  normalizeDigits,
  toIsoDate,
} from '../../utils/formatters';

type DossierTab =
  | 'dados'
  | 'passaporte'
  | 'familia'
  | 'casos'
  | 'documentos'
  | 'financeiro'
  | 'comunicacao'
  | 'portal_lgpd'
  | 'historico';

interface ClientDossierModalProps {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  allClients: Client[];
  role: UserRole;
  userName: string;
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
  auditLogs: AuditLog[];
  messageTemplates: MessageTemplate[];
  onRefresh: () => Promise<void>;
  onOpenCase: (caseId: string) => void;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
  onOpenContractModal?: (clientId: string, caseId?: string) => void;
}

export const ClientDossierModal: React.FC<ClientDossierModalProps> = ({
  open,
  onClose,
  client,
  allClients,
  role,
  userName,
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
  auditLogs,
  messageTemplates,
  onRefresh,
  onOpenCase,
  onLogWhatsApp,
  onOpenContractModal,
}) => {
  const isAssistente = role === 'assistente';
  const canEdit = role === 'admin' || role === 'consultor';

  const [tab, setTab] = useState<DossierTab>('dados');
  const [form, setForm] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [depToDelete, setDepToDelete] = useState<Dependent | null>(null);

  // Novo dependente
  const [depForm, setDepForm] = useState({
    nomeCompleto: '',
    parentesco: 'Cônjuge' as Dependent['parentesco'],
    idade: '',
    estudante: false,
    passaporteNumero: '',
    passaporteValidade: '',
  });

  // Novo documento na ficha do cliente
  const [docForm, setDocForm] = useState({
    caseId: '',
    nomeDocumento: '',
    categoriaDoc: 'Identidade' as CaseDocument['categoriaDoc'],
    pessoa: 'Titular',
    dataEmissao: '',
    validadeDias: '0',
    orgaoEmissor: '',
  });
  const [docUploading, setDocUploading] = useState(false);

  // Comunicação rápida
  const [commMsg, setCommMsg] = useState('');
  const [commCanal, setCommCanal] = useState<CommunicationLog['canal']>('WhatsApp');
  const [commTplId, setCommTplId] = useState('');

  useEffect(() => {
    if (open && client) {
      setForm({ ...client, passaporte: { ...(client.passaporte || {}) } });
      setFeedback(null);
      setErrorMsg(null);
      setTab('dados');
      const firstCase = cases.find((c) => c.clientId === client.id)?.id || '';
      setDocForm((prev) => ({ ...prev, caseId: firstCase }));
    }
  }, [open, client, cases]);

  const clientDeps = useMemo(() => (client ? dependents.filter((d) => d.clientId === client.id) : []), [dependents, client]);
  const clientCases = useMemo(() => (client ? cases.filter((c) => c.clientId === client.id) : []), [cases, client]);
  const clientDocs = useMemo(() => (client ? caseDocuments.filter((d) => d.clientId === client.id) : []), [caseDocuments, client]);
  const clientBudgets = useMemo(() => (client && !isAssistente ? budgets.filter((b) => b.clientId === client.id) : []), [budgets, client, isAssistente]);
  const clientFins = useMemo(
    () => (client && !isAssistente ? financialRecords.filter((f) => f.clientId === client.id) : []),
    [financialRecords, client, isAssistente],
  );
  const clientComms = useMemo(
    () => (client ? communicationLogs.filter((l) => l.clientId === client.id) : []),
    [communicationLogs, client],
  );
  const clientAudit = useMemo(
    () =>
      client
        ? auditLogs.filter((a) => a.entidadeId === client.id || a.depois?.includes(client.id) || a.antes?.includes(client.id))
        : [],
    [auditLogs, client],
  );

  // Possíveis duplicados por CPF, e-mail ou WhatsApp
  const duplicates = useMemo(() => {
    if (!form) return [];
    const cpfDigits = normalizeDigits(form.cpf);
    const whatsDigits = normalizeDigits(form.whatsapp);
    const mail = (form.email || '').trim().toLowerCase();
    return allClients.filter((other) => {
      if (other.id === form.id || other.arquivado) return false;
      const sameEmail = mail && other.email.toLowerCase() === mail;
      const sameCpf = cpfDigits.length === 11 && normalizeDigits(other.cpf) === cpfDigits;
      const sameWhats = whatsDigits.length >= 10 && normalizeDigits(other.whatsapp) === whatsDigits;
      return sameEmail || sameCpf || sameWhats;
    });
  }, [form, allClients]);

  if (!open || !client || !form) return null;

  const passportDays = daysUntilDate(form.passaporte?.validade);
  const passportRisk = passportDays !== null && passportDays < 365;

  const handleSaveClient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canEdit) return;
    setErrorMsg(null);
    if (form.cpf && form.cpf.trim() && !isValidCPF(form.cpf)) {
      setErrorMsg('CPF inválido pelos dígitos verificadores. Corrija ou deixe em branco.');
      return;
    }
    setSaving(true);
    try {
      const payload: Client = {
        ...form,
        nomeCompleto: form.nomeCompleto.trim(),
        email: form.email.trim().toLowerCase(),
        statusAcessoPortal: form.portalLiberado ? 'Liberado' : form.statusAcessoPortal || 'Pendente liberação',
      };
      await saveDocumentAudited('clients', client.id, payload as unknown as Record<string, unknown>, false, role, 'ficha_cliente', client);
      setFeedback('Dossiê do cliente salvo com sucesso.');
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleMerge = async (dup: Client) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const moved = await mergeClientsAudited({
        primaryClient: form,
        duplicateClient: dup,
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
      });
      setFeedback(`Cadastro de "${dup.nomeCompleto}" mesclado neste cliente (${moved} registro(s) unificado(s)).`);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleSendInvite = async () => {
    const portalUrl = `${window.location.origin}/acompanhar`;
    const msg = `Olá, ${form.nomeCompleto}! Seu Portal do Cliente D&M Integra Chile está pronto. Acesse em ${portalUrl} usando seu e-mail Google (${form.email}) para acompanhar etapas, prazos e enviar documentos.`;
    window.open(buildWhatsAppUrl(form.whatsapp, msg), '_blank', 'noopener,noreferrer');
    const now = new Date().toISOString();
    await saveDocumentAudited(
      'clients',
      client.id,
      { ...form, conviteEnviadoEm: now, portalLiberado: true, statusAcessoPortal: 'Liberado' },
      false,
      role,
      'enviar_convite_portal',
    );
    await onLogWhatsApp(client.id, clientCases[0]?.id, 'Convite Portal do Cliente', msg);
    setForm((prev) => (prev ? { ...prev, conviteEnviadoEm: now, portalLiberado: true, statusAcessoPortal: 'Liberado' } : prev));
    setFeedback('Convite enviado via WhatsApp e acesso ao Portal liberado!');
    await onRefresh();
  };

  const handleExportLgpdJson = () => {
    const payload = {
      exportadoEm: new Date().toISOString(),
      cliente: form,
      dependentes: clientDeps,
      casos: clientCases,
      documentos: clientDocs.map((d) => ({
        nome: d.nomeDocumento,
        categoria: d.categoriaDoc,
        pessoa: d.pessoa,
        status: d.status,
        dataEmissao: d.dataEmissao,
        validade: d.dataValidadeCalculada,
      })),
      comunicacoes: clientComms,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = formatStandardDocFilename(form.nomeCompleto, 'DADOS_LGPD', toIsoDate(new Date()), 'json');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddDocOnClient = async (file?: File) => {
    if (!docForm.nomeDocumento.trim()) {
      setErrorMsg('Informe o nome do documento.');
      return;
    }
    const targetCase = docForm.caseId || clientCases[0]?.id || 'sem_caso';
    setDocUploading(true);
    try {
      let arquivoUrl = '';
      let arquivoNome = '';
      if (file) {
        const up = await uploadFileToServer(file);
        arquivoUrl = up.url;
        arquivoNome = up.filename;
      }
      const id = makeId('doc');
      const vDias = Number(docForm.validadeDias || 0);
      const validadeCalc =
        docForm.dataEmissao && vDias > 0 ? toIsoDate(new Date(new Date(docForm.dataEmissao).getTime() + vDias * 86400000)) : undefined;
      const newDoc: CaseDocument = {
        id,
        caseId: targetCase,
        clientId: client.id,
        pessoa: docForm.pessoa,
        nomeDocumento: docForm.nomeDocumento.trim(),
        categoriaDoc: docForm.categoriaDoc,
        etapaEsteira: arquivoUrl ? '2 Recebido/Triagem' : '1 Aguardando Envio',
        ordemEmissao: clientDocs.length + 1,
        arquivoUrl: arquivoUrl || undefined,
        arquivoNome: arquivoNome || undefined,
        status: arquivoUrl ? 'Enviado' : 'Pendente',
        dataEmissao: docForm.dataEmissao || undefined,
        validadeDias: vDias,
        dataValidadeCalculada: validadeCalc,
        orgaoEmissor: docForm.orgaoEmissor || undefined,
        apostilado: false,
        traduzido: false,
        exigeApostila: false,
        exigeTraducao: false,
        obrigatorio: true,
        peso: 3,
        versao: 1,
      };
      await saveDocumentAudited('caseDocuments', id, newDoc as unknown as Record<string, unknown>, true, role, 'doc_ficha_cliente');
      setDocForm((prev) => ({ ...prev, nomeDocumento: '', dataEmissao: '', orgaoEmissor: '' }));
      setFeedback('Documento adicionado à ficha do cliente.');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao adicionar documento.');
    } finally {
      setDocUploading(false);
    }
  };

  const tabs: { id: DossierTab; label: string; hidden?: boolean }[] = [
    { id: 'dados', label: '1. Dados pessoais' },
    { id: 'passaporte', label: '2. Passaporte' },
    { id: 'familia', label: `3. Família (${clientDeps.length})` },
    { id: 'casos', label: `4. Casos (${clientCases.length})` },
    { id: 'documentos', label: `5. Documentos (${clientDocs.length})` },
    { id: 'financeiro', label: '6. Financeiro', hidden: isAssistente },
    { id: 'comunicacao', label: `7. Comunicação (${clientComms.length})` },
    { id: 'portal_lgpd', label: '8. Portal & LGPD' },
    { id: 'historico', label: '9. Histórico' },
  ];

  const relatedCountsSummary = [
    `${clientCases.length} caso(s)`,
    `${clientDeps.length} dependente(s)`,
    `${clientDocs.length} documento(s) do checklist`,
    `${clientBudgets.length} orçamento(s) e ${clientFins.length} lançamento(s)`,
    `${clientComms.length} registro(s) de comunicação`,
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">Dossiê do Cliente — {form.nomeCompleto}</h2>
              {form.arquivado && (
                <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold">ARQUIVADO</span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {form.email} · {form.whatsapp} · Portal: {form.portalLiberado ? 'Liberado' : form.statusAcessoPortal}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar dossiê do cliente" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex items-center gap-1 px-4 border-b border-slate-200 overflow-x-auto bg-slate-50">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap shrink-0 transition-colors ${
                  tab === t.id ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-white' : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {feedback && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">{feedback}</div>}
          {errorMsg && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C82333] font-medium">{errorMsg}</div>}

          {duplicates.length > 0 && canEdit && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Possível duplicidade detectada com: <strong>{duplicates.map((d) => d.nomeCompleto).join(', ')}</strong> (mesmo CPF, e-mail ou WhatsApp).
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {duplicates.map((d) => (
                  <UiButton key={d.id} type="button" size="sm" variant="primary" disabled={saving} onClick={() => void handleMerge(d)}>
                    <GitMerge className="w-3.5 h-3.5" />
                    Mesclar com {d.nomeCompleto.split(' ')[0]}
                  </UiButton>
                ))}
              </div>
            </div>
          )}

          {/* TAB 1: DADOS PESSOAIS */}
          {tab === 'dados' && (
            <form onSubmit={handleSaveClient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Nome completo *</label>
                  <input required disabled={!canEdit} value={form.nomeCompleto} onChange={(e) => setForm({ ...form, nomeCompleto: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">CPF (validado)</label>
                  <input
                    disabled={!canEdit}
                    value={form.cpf || ''}
                    onChange={(e) => setForm({ ...form, cpf: maskCPF(e.target.value) })}
                    placeholder="000.000.000-00"
                    className={`w-full px-3 py-2 rounded-lg border tabular-nums ${
                      form.cpf && form.cpf.replace(/\D/g, '').length === 11 && !isValidCPF(form.cpf) ? 'border-red-400 bg-red-50' : 'border-slate-300'
                    }`}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">E-mail Google *</label>
                  <input required type="email" disabled={!canEdit} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">WhatsApp *</label>
                  <input required disabled={!canEdit} value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: maskPhoneBR(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-slate-300 tabular-nums" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Preferência de contato</label>
                  <select disabled={!canEdit} value={form.preferenciaContato || 'WhatsApp'} onChange={(e) => setForm({ ...form, preferenciaContato: e.target.value as Client['preferenciaContato'] })} className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white">
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Ligação">Ligação</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data de nascimento</label>
                  <input type="date" disabled={!canEdit} value={form.dataNascimento || ''} onChange={(e) => setForm({ ...form, dataNascimento: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Estado civil</label>
                  <input disabled={!canEdit} value={form.estadoCivil || ''} onChange={(e) => setForm({ ...form, estadoCivil: e.target.value })} placeholder="Solteiro(a), Casado(a)..." className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nacionalidade</label>
                  <input disabled={!canEdit} value={form.nacionalidade || ''} onChange={(e) => setForm({ ...form, nacionalidade: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Naturalidade</label>
                  <input disabled={!canEdit} value={form.naturalidade || ''} onChange={(e) => setForm({ ...form, naturalidade: e.target.value })} placeholder="Cidade / UF" className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Profissão</label>
                  <input disabled={!canEdit} value={form.profissao || ''} onChange={(e) => setForm({ ...form, profissao: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Escolaridade</label>
                  <input disabled={!canEdit} value={form.escolaridade || ''} onChange={(e) => setForm({ ...form, escolaridade: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Idiomas</label>
                  <input disabled={!canEdit} value={form.idiomas || ''} onChange={(e) => setForm({ ...form, idiomas: e.target.value })} placeholder="Português, Espanhol..." className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Filiação (para certidões / SERMIG)</label>
                  <input disabled={!canEdit} value={form.filiacao || ''} onChange={(e) => setForm({ ...form, filiacao: e.target.value })} placeholder="Nome dos pais" className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Contato de emergência</label>
                  <input disabled={!canEdit} value={form.contatoEmergencia || ''} onChange={(e) => setForm({ ...form, contatoEmergencia: e.target.value })} placeholder="Nome e telefone" className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1">Endereço completo</label>
                  <input disabled={!canEdit} value={form.enderecoCompleto || ''} onChange={(e) => setForm({ ...form, enderecoCompleto: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300" />
                </div>
                <div className="sm:col-span-3">
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    Observações internas da equipe (NUNCA exibidas no Portal do Cliente)
                  </label>
                  <textarea rows={3} disabled={!canEdit} value={form.observacoesInternas || ''} onChange={(e) => setForm({ ...form, observacoesInternas: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/40" />
                </div>
              </div>
              {canEdit && (
                <div className="flex justify-end">
                  <UiButton type="submit" variant="primary" disabled={saving}>
                    {saving ? 'Salvando...' : 'Salvar Dados Pessoais'}
                  </UiButton>
                </div>
              )}
            </form>
          )}

          {/* TAB 2: PASSAPORTE */}
          {tab === 'passaporte' && (
            <form onSubmit={handleSaveClient} className="space-y-4">
              {passportRisk && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#C82333] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {passportDays !== null && passportDays <= 0
                      ? 'Passaporte VENCIDO! Necessária renovação imediata antes do protocolo.'
                      : `Passaporte vence em ${passportDays} dia(s) (< 12 meses). Recomende renovação antes do protocolo SERMIG.`}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Número do Passaporte</label>
                  <input
                    disabled={!canEdit}
                    value={form.passaporte?.numero || ''}
                    onChange={(e) => setForm({ ...form, passaporte: { ...(form.passaporte || {}), numero: e.target.value.toUpperCase() } })}
                    placeholder="Ex.: FX123456"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data de emissão</label>
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={form.passaporte?.emissao || ''}
                    onChange={(e) => setForm({ ...form, passaporte: { ...(form.passaporte || {}), emissao: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Data de validade</label>
                  <input
                    type="date"
                    disabled={!canEdit}
                    value={form.passaporte?.validade || ''}
                    onChange={(e) => setForm({ ...form, passaporte: { ...(form.passaporte || {}), validade: e.target.value } })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300"
                  />
                </div>
              </div>
              {canEdit && (
                <div className="flex justify-end">
                  <UiButton type="submit" variant="primary" disabled={saving}>
                    Salvar Passaporte
                  </UiButton>
                </div>
              )}
            </form>
          )}

          {/* TAB 3: FAMÍLIA / DEPENDENTES */}
          {tab === 'familia' && (
            <div className="space-y-4">
              {canEdit && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!depForm.nomeCompleto.trim()) return;
                    const id = makeId('dep');
                    const payload: Dependent = {
                      id,
                      clientId: client.id,
                      nomeCompleto: depForm.nomeCompleto.trim(),
                      parentesco: depForm.parentesco,
                      idade: depForm.idade ? Number(depForm.idade) : undefined,
                      estudante: depForm.estudante,
                      passaporteNumero: depForm.passaporteNumero || undefined,
                      passaporteValidade: depForm.passaporteValidade || undefined,
                    };
                    await saveDocumentAudited('dependents', id, payload as unknown as Record<string, unknown>, true, role, 'dependente_cliente');
                    setDepForm({ nomeCompleto: '', parentesco: 'Cônjuge', idade: '', estudante: false, passaporteNumero: '', passaporteValidade: '' });
                    await onRefresh();
                  }}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-6 gap-2.5 text-xs items-end"
                >
                  <div className="sm:col-span-2">
                    <label className="block font-semibold text-slate-700 mb-1">Nome do dependente *</label>
                    <input required value={depForm.nomeCompleto} onChange={(e) => setDepForm({ ...depForm, nomeCompleto: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Parentesco</label>
                    <select value={depForm.parentesco} onChange={(e) => setDepForm({ ...depForm, parentesco: e.target.value as Dependent['parentesco'] })} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white">
                      <option value="Cônjuge">Cônjuge</option>
                      <option value="Companheiro(a)">Companheiro(a)</option>
                      <option value="Filho(a)">Filho(a)</option>
                      <option value="Enteado(a)">Enteado(a)</option>
                      <option value="Pai/Mãe">Pai/Mãe</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Idade</label>
                    <input type="number" min={0} max={120} value={depForm.idade} onChange={(e) => setDepForm({ ...depForm, idade: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white" />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Val. Passaporte</label>
                    <input type="date" value={depForm.passaporteValidade} onChange={(e) => setDepForm({ ...depForm, passaporteValidade: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="inline-flex items-center gap-1.5 text-[11px]">
                      <input type="checkbox" checked={depForm.estudante} onChange={(e) => setDepForm({ ...depForm, estudante: e.target.checked })} />
                      Estudante (18–24a)
                    </label>
                    <UiButton type="submit" size="sm" variant="primary">
                      + Adicionar
                    </UiButton>
                  </div>
                </form>
              )}

              {clientDeps.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum dependente cadastrado.</p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                  {clientDeps.map((dep) => {
                    const depDays = daysUntilDate(dep.passaporteValidade);
                    return (
                      <div key={dep.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-slate-900">
                            {dep.nomeCompleto} ({dep.parentesco})
                          </p>
                          <p className="text-slate-500">
                            {dep.idade !== undefined ? `${dep.idade} anos · ` : ''}
                            {dep.estudante ? 'Estudante · ' : ''}
                            {dep.passaporteNumero ? `Passaporte ${dep.passaporteNumero} · ` : ''}
                            {dep.passaporteValidade ? `Validade ${formatDateBR(dep.passaporteValidade)}` : ''}
                            {depDays !== null && depDays < 365 && (
                              <span className="text-[#C82333] font-semibold ml-1">(Passaporte &lt; 12 meses!)</span>
                            )}
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setDepToDelete(dep)}
                            className="p-1.5 rounded border border-red-200 text-[#C82333] hover:bg-red-50"
                            aria-label="Remover dependente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CASOS */}
          {tab === 'casos' && (
            <div className="space-y-3">
              {clientCases.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum processo migratório aberto para este cliente ainda.</p>
              ) : (
                clientCases.map((c) => (
                  <div key={c.id} className="p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{c.titulo}</p>
                      <p className="text-slate-500">
                        {c.tipoServico} · Etapa {c.etapaPipeline}/15 · SERMIG: {c.statusSermig}
                      </p>
                    </div>
                    <UiButton
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        onClose();
                        onOpenCase(c.id);
                      }}
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      Abrir Ficha do Caso
                    </UiButton>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 5: DOCUMENTOS */}
          {tab === 'documentos' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                <p className="font-bold text-slate-900">Adicionar / Anexar Documento na Ficha do Cliente</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    value={docForm.nomeDocumento}
                    onChange={(e) => setDocForm({ ...docForm, nomeDocumento: e.target.value })}
                    placeholder="Nome do documento (ex.: Certidão de Casamento)"
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                  <select value={docForm.categoriaDoc} onChange={(e) => setDocForm({ ...docForm, categoriaDoc: e.target.value as CaseDocument['categoriaDoc'] })} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white">
                    <option value="Identidade">Identidade</option>
                    <option value="Antecedentes">Antecedentes</option>
                    <option value="Familiares">Familiares</option>
                    <option value="Profissional/Financeiro">Profissional/Financeiro</option>
                    <option value="Apostilas">Apostilas</option>
                    <option value="Traduções">Traduções</option>
                  </select>
                  <select value={docForm.pessoa} onChange={(e) => setDocForm({ ...docForm, pessoa: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white">
                    <option value="Titular">Titular</option>
                    {clientDeps.map((d) => (
                      <option key={d.id} value={d.nomeCompleto}>
                        {d.nomeCompleto}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <UiButton type="button" size="sm" variant="outline" disabled={docUploading} onClick={() => void handleAddDocOnClient()}>
                    Registrar item sem arquivo
                  </UiButton>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: 'var(--color-primary)' }}>
                    <Upload className="w-3.5 h-3.5" />
                    {docUploading ? 'Enviando...' : 'Anexar & Registrar Documento'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleAddDocOnClient(f);
                      }}
                    />
                  </label>
                </div>
              </div>

              {clientDocs.length === 0 ? (
                <p className="text-xs text-slate-500">Nenhum documento vinculado a este cliente.</p>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                  {clientDocs.map((d) => (
                    <div key={d.id} className="p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="font-semibold text-slate-900">
                          [{d.pessoa}] {d.nomeDocumento}
                        </p>
                        <p className="text-slate-500">
                          {d.categoriaDoc} · {d.status} · Emissão: {formatDateBR(d.dataEmissao)} · Validade: {formatDateBR(d.dataValidadeCalculada)}
                        </p>
                      </div>
                      {d.arquivoUrl && (
                        <a
                          href={d.arquivoUrl}
                          download={formatStandardDocFilename(d.pessoa, d.nomeDocumento, d.dataEmissao)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => void logSensitiveDocumentAccess(d, 'baixar', role)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Abrir / Baixar
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: FINANCEIRO (admin/consultor) */}
          {tab === 'financeiro' && !isAssistente && (
            <div className="space-y-4 text-xs">
              <div className="flex justify-between items-center">
                <p className="font-bold text-slate-900">Orçamentos ({clientBudgets.length}) &amp; Lançamentos ({clientFins.length})</p>
                {onOpenContractModal && (
                  <UiButton type="button" size="sm" variant="primary" onClick={() => onOpenContractModal(client.id, clientCases[0]?.id)}>
                    <FileText className="w-3.5 h-3.5" />
                    Gerar Contrato / Recibo
                  </UiButton>
                )}
              </div>
              {clientBudgets.map((b) => (
                <div key={b.id} className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex justify-between">
                  <span>
                    <strong>{b.numeroOrcamento}</strong> — {b.titulo} ({b.status})
                  </span>
                  <span className="font-bold tabular-nums">{formatCurrency(b.totalGeral, b.moedaPrincipal)}</span>
                </div>
              ))}
              {clientFins.map((f) => (
                <div key={f.id} className="p-3 rounded-lg border border-slate-200 flex justify-between">
                  <span>
                    {f.descricao} · Venc. {formatDateBR(f.vencimento)} ({f.status})
                  </span>
                  <span className="font-bold tabular-nums">{formatCurrency(f.valor, f.moeda)}</span>
                </div>
              ))}
              {clientBudgets.length === 0 && clientFins.length === 0 && <p className="text-slate-500">Nenhum registro financeiro para este cliente.</p>}
            </div>
          )}

          {/* TAB 7: COMUNICAÇÃO */}
          {tab === 'comunicacao' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <select
                    value={commTplId}
                    onChange={(e) => {
                      setCommTplId(e.target.value);
                      const tpl = messageTemplates.find((m) => m.id === e.target.value);
                      if (tpl) {
                        setCommMsg(
                          applyTemplateVariables(tpl.corpo, {
                            nome_cliente: form.nomeCompleto,
                            subcategoria_visto: clientCases[0]?.titulo || 'Residência no Chile',
                            documento_nome: 'Checklist documental',
                            prazo_data: formatDateBR(new Date()),
                          }),
                        );
                      }
                    }}
                    className="flex-1 min-w-[200px] px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Selecionar modelo pronto...</option>
                    {messageTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titulo}
                      </option>
                    ))}
                  </select>
                  <select value={commCanal} onChange={(e) => setCommCanal(e.target.value as CommunicationLog['canal'])} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white">
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="E-mail">E-mail</option>
                    <option value="Ligação">Ligação</option>
                    <option value="Sistema">Nota interna</option>
                  </select>
                </div>
                <textarea rows={3} value={commMsg} onChange={(e) => setCommMsg(e.target.value)} placeholder="Escreva a mensagem..." className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white" />
                <div className="flex flex-wrap gap-2">
                  <UiButton
                    type="button"
                    size="sm"
                    variant="success"
                    disabled={!commMsg.trim()}
                    onClick={async () => {
                      if (commCanal === 'WhatsApp' && form.whatsapp) {
                        window.open(buildWhatsAppUrl(form.whatsapp, commMsg), '_blank', 'noopener,noreferrer');
                      } else if (commCanal === 'E-mail' && form.email) {
                        window.location.href = `mailto:${form.email}?subject=${encodeURIComponent('D&M Integra Chile — Acompanhamento')}&body=${encodeURIComponent(commMsg)}`;
                      }
                      await onLogWhatsApp(client.id, clientCases[0]?.id, `${commCanal} — ${form.nomeCompleto}`, commMsg);
                      setCommMsg('');
                      setFeedback('Contato registrado na linha do tempo.');
                    }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Enviar &amp; Registrar Contato
                  </UiButton>
                </div>
              </div>

              <div className="space-y-2">
                {clientComms.map((log) => (
                  <div key={log.id} className="p-3 rounded-lg border border-slate-200">
                    <div className="flex justify-between text-slate-500">
                      <span className="font-bold text-slate-800">{log.canal} · {log.assunto}</span>
                      <span>{formatDateTimeBR(log.createdAt)} · {log.autorNome}</span>
                    </div>
                    <p className="text-slate-700 mt-1 whitespace-pre-wrap">{log.mensagem}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: PORTAL & LGPD */}
          {tab === 'portal_lgpd' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Acesso ao Portal do Cliente</h3>
                    <p className="text-slate-500">
                      Status atual: <strong>{form.portalLiberado ? 'Liberado' : form.statusAcessoPortal}</strong>
                      {form.conviteEnviadoEm ? ` · Convite enviado em ${formatDateTimeBR(form.conviteEnviadoEm)}` : ''}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <UiButton type="button" size="sm" variant="success" onClick={() => void handleSendInvite()}>
                        <Send className="w-3.5 h-3.5" />
                        Enviar Convite WhatsApp &amp; Liberar
                      </UiButton>
                      <UiButton
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const nextLib = !form.portalLiberado;
                          const nextClient: Client = {
                            ...form,
                            portalLiberado: nextLib,
                            statusAcessoPortal: nextLib ? 'Liberado' : 'Pendente liberação',
                          };
                          await saveDocumentAudited('clients', client.id, nextClient as unknown as Record<string, unknown>, false, role, 'portalLiberado');
                          setForm(nextClient);
                          await onRefresh();
                        }}
                      >
                        {form.portalLiberado ? 'Bloquear Portal' : 'Apenas Liberar Acesso'}
                      </UiButton>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-[var(--color-primary)]" />
                  Conformidade LGPD &amp; Retenção de Dados
                </h3>
                <p className="text-slate-600">
                  Consentimento: {form.lgpdAceito ? `Aceito (versão ${form.lgpdVersao || '1.0'}) em ${formatDateTimeBR(form.lgpdAceitoEm)}` : 'Ainda pendente de aceite no 1º acesso'}.
                </p>
                {form.lgpdExclusaoConcluidaEm && (
                  <p className="text-[#1E7E34] font-semibold">
                    Solicitação de exclusão LGPD concluída em {formatDateTimeBR(form.lgpdExclusaoConcluidaEm)}.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <UiButton type="button" size="sm" variant="outline" onClick={handleExportLgpdJson}>
                    <Download className="w-3.5 h-3.5" />
                    Exportar Dados LGPD (JSON)
                  </UiButton>
                  {canEdit && (
                    <UiButton
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await archiveClientAudited(form, role);
                        setFeedback('Cliente arquivado com segurança e acesso ao portal bloqueado.');
                        await onRefresh();
                      }}
                    >
                      <Archive className="w-3.5 h-3.5" />
                      Arquivar Cliente
                    </UiButton>
                  )}
                  {role === 'admin' && (
                    <UiButton type="button" size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir Definitivamente (Cascata)
                    </UiButton>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: HISTÓRICO */}
          {tab === 'historico' && (
            <div className="space-y-2 text-xs">
              {clientAudit.length === 0 ? (
                <p className="text-slate-500">Nenhuma alteração auditada registrada ainda.</p>
              ) : (
                clientAudit.map((a) => (
                  <div key={a.id} className="p-3 rounded-lg border border-slate-200 flex justify-between gap-2">
                    <span className="font-semibold text-slate-800">
                      {a.acao} · {a.entidade} ({a.campo || 'registro'})
                    </span>
                    <span className="text-slate-500">
                      {formatDateTimeBR(a.createdAt)} · {a.actorEmail}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmTypedModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={`Excluir definitivamente ${form.nomeCompleto}?`}
        description="Esta ação remove o cliente e todos os registros vinculados abaixo de forma irreversível (LGPD / exclusão em cascata). Recomendamos Arquivar caso deseje preservar contratos e recibos."
        summaryItems={relatedCountsSummary}
        requiredKeyword="EXCLUIR"
        confirmLabel="Excluir Cliente & Vínculos"
        alternativeLabel="Arquivar em vez de excluir"
        onAlternative={async () => {
          await archiveClientAudited(form, role);
          await onRefresh();
          onClose();
        }}
        onConfirm={async () => {
          await deleteClientCascadeAudited({
            client: form,
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
          });
          await onRefresh();
          onClose();
        }}
      />

      <ConfirmActionModal
        open={Boolean(depToDelete)}
        title="Remover Dependente"
        description={`Tem certeza que deseja excluir permanentemente o dependente "${depToDelete?.nomeCompleto || ''}"?`}
        confirmLabel="Excluir Dependente"
        tone="danger"
        onConfirm={async () => {
          if (!depToDelete) return;
          try {
            await deleteDocumentAudited('dependents', depToDelete.id, role, depToDelete);
            setFeedback(`Dependente "${depToDelete.nomeCompleto}" removido.`);
            setDepToDelete(null);
            await onRefresh();
          } catch (err) {
            throw new Error(translateAppError(err).message || 'Não foi possível remover o dependente.');
          }
        }}
        onClose={() => setDepToDelete(null)}
      />
    </div>
  );
};
