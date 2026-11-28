import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FilePlus2,
  FileSignature,
  FileText,
  Layers,
  MessageCircle,
  Plus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { SEED_DOCUMENT_TEMPLATES } from '../../data/seeds';
import {
  makeId,
  saveDocumentAudited,
  setClientPortalAccessAudited,
} from '../../services/firestoreService';
import { translateAppError } from '../../services/errorService';
import type {
  Case,
  Client,
  CurrencyCode,
  Dependent,
  DocumentTemplate,
  EmpresaConfig,
  GeneratedDocument,
  UserProfile,
  UserRole,
} from '../../types/domain';
import { buildWhatsAppUrl, openExternalSafe } from '../../utils/formatters';
import {
  buildMultiDocumentBatchRecords,
  buildMultiDocumentWhatsAppNotice,
  findUnresolvedPlaceholders,
  getSignatureDocTypeMeta,
  renderTemplateForClient,
  SIGNATURE_PACKAGE_PRESETS,
  type PackageDraftItem,
} from '../../utils/multiDocumentPackage';
import { normalizePaidModality } from '../../utils/portalAccess';

export interface MultiDocumentPackageModalProps {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  clients: Client[];
  cases: Case[];
  dependents?: Dependent[];
  documentTemplates: DocumentTemplate[];
  generatedDocuments: GeneratedDocument[];
  initialClientId?: string;
  initialCaseId?: string;
  onRefresh: () => Promise<void>;
  onLogWhatsApp: (
    clientId: string | undefined,
    caseId: string | undefined,
    assunto: string,
    msg: string,
  ) => Promise<void>;
}

const FINANCIAL_TYPES = new Set(['contrato', 'recibo', 'orcamento', 'aditivo', 'termo_encerramento']);

const CUSTOM_DOC_TYPES: Array<{ value: string; label: string }> = [
  { value: 'recibo', label: 'Recibo de Pagamento' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'procuracao', label: 'Procuração / Autorização' },
  { value: 'termo_ciencia', label: 'Termo de Ciência' },
  { value: 'orcamento', label: 'Orçamento / Proposta' },
  { value: 'aditivo', label: 'Aditivo Contratual' },
  { value: 'declaracao_residencia', label: 'Declaração' },
  { value: 'documento_personalizado', label: 'Documento Personalizado' },
];

export const MultiDocumentPackageModal: React.FC<MultiDocumentPackageModalProps> = ({
  open,
  onClose,
  role,
  userProfile,
  empresa,
  clients,
  cases,
  dependents = [],
  documentTemplates,
  generatedDocuments,
  initialClientId,
  initialCaseId,
  onRefresh,
  onLogWhatsApp,
}) => {
  const isAssistente = role === 'assistente';

  const availableTemplates = useMemo(() => {
    const merged =
      documentTemplates.length >= SEED_DOCUMENT_TEMPLATES.length
        ? documentTemplates
        : SEED_DOCUMENT_TEMPLATES;
    return isAssistente ? merged.filter((t) => !FINANCIAL_TYPES.has(t.tipo)) : merged;
  }, [documentTemplates, isAssistente]);

  const [clientId, setClientId] = useState<string>(initialClientId || clients[0]?.id || '');
  const [caseId, setCaseId] = useState<string>(initialCaseId || '');
  const [valorNumerico, setValorNumerico] = useState<number>(3600);
  const [moeda, setMoeda] = useState<CurrencyCode>('BRL');
  const [formaPagamento, setFormaPagamento] = useState(
    '50% na assinatura + 50% no protocolo SERMIG (Pix/Transferência)',
  );
  const [descricaoPagamento, setDescricaoPagamento] = useState(
    'Honorários de Assessoria Migratória (Visto e RUT)',
  );
  const [liberadoAoCliente, setLiberadoAoCliente] = useState<boolean>(true);
  const [unlockPortalIfBlocked, setUnlockPortalIfBlocked] = useState<boolean>(true);

  const [draftItems, setDraftItems] = useState<PackageDraftItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentResult, setSentResult] = useState<{
    client: Client;
    docs: GeneratedDocument[];
  } | null>(null);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) || null,
    [clients, clientId],
  );
  const clientCases = useMemo(
    () => cases.filter((c) => c.clientId === clientId),
    [cases, clientId],
  );
  const selectedCase = useMemo(
    () => clientCases.find((c) => c.id === caseId) || clientCases[0] || null,
    [clientCases, caseId],
  );
  const clientDependents = useMemo(
    () => dependents.filter((d) => d.clientId === clientId),
    [dependents, clientId],
  );

  const existingReceiptCount = useMemo(
    () => generatedDocuments.filter((g) => g.tipo === 'recibo').length,
    [generatedDocuments],
  );

  const buildRenderedDraft = (
    tpl: DocumentTemplate,
    targetClient: Client,
    targetCase: Case | null,
    receiptOrdinal: number,
  ): PackageDraftItem => {
    const reciboNum = `REC-${new Date().getFullYear()}-${String(existingReceiptCount + receiptOrdinal).padStart(3, '0')}`;
    const rendered = renderTemplateForClient({
      template: tpl,
      empresa,
      client: targetClient,
      caseItem: targetCase,
      dependents: dependents.filter((d) => d.clientId === targetClient.id),
      valorNumerico,
      moeda,
      formaPagamento,
      reciboNumero: tpl.tipo === 'recibo' ? reciboNum : undefined,
      descricaoPagamento,
    });
    return {
      key: `${tpl.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      templateId: tpl.id,
      tipo: tpl.tipo,
      titulo: rendered.titulo,
      conteudoHtml: rendered.conteudoHtml,
      financeiro: rendered.financeiro,
    };
  };

  const applyPreset = (templateIds: string[], targetClient?: Client | null, targetCase?: Case | null) => {
    const cl = targetClient ?? selectedClient;
    if (!cl) {
      setDraftItems([]);
      setActiveKey(null);
      return;
    }
    const cs = targetCase !== undefined ? targetCase : selectedCase;
    let receiptSeq = 1;
    const next: PackageDraftItem[] = [];
    for (const tplId of templateIds) {
      const tpl = availableTemplates.find((t) => t.id === tplId);
      if (!tpl) continue;
      next.push(buildRenderedDraft(tpl, cl, cs, tpl.tipo === 'recibo' ? receiptSeq++ : receiptSeq));
    }
    setDraftItems(next);
    setActiveKey(next[0]?.key || null);
    setErrorMsg(null);
  };

  useEffect(() => {
    if (!open) return;
    const cid = initialClientId || clients[0]?.id || '';
    const cl = clients.find((c) => c.id === cid) || null;
    const csid = initialCaseId || cases.find((c) => c.clientId === cid)?.id || '';
    const cs = cases.find((c) => c.id === csid) || null;
    setClientId(cid);
    setCaseId(csid);
    setErrorMsg(null);
    setSentResult(null);
    setLiberadoAoCliente(true);
    setUnlockPortalIfBlocked(true);

    // Inicia com o Kit mais comum: Contrato + Recibo + Termo SERMIG
    const initialIds = isAssistente
      ? ['doc_procuracao_simples', 'doc_termo_sermig', 'doc_termo_lgpd']
      : ['doc_contrato', 'doc_recibo', 'doc_termo_sermig'];
    if (cl) {
      applyPreset(initialIds, cl, cs);
    } else {
      setDraftItems([]);
      setActiveKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialClientId, initialCaseId]);

  const handleChangeClient = (nextClientId: string) => {
    setClientId(nextClientId);
    const cl = clients.find((c) => c.id === nextClientId) || null;
    const nextCase = cases.find((c) => c.clientId === nextClientId) || null;
    setCaseId(nextCase?.id || '');
    if (!cl) return;

    // Re-renderiza os modelos já selecionados para o novo cliente
    let receiptSeq = 1;
    const refreshed = draftItems.map((item) => {
      if (item.templateId) {
        const tpl = availableTemplates.find((t) => t.id === item.templateId);
        if (tpl) {
          return buildRenderedDraft(tpl, cl, nextCase, tpl.tipo === 'recibo' ? receiptSeq++ : receiptSeq);
        }
      }
      return item;
    });
    setDraftItems(refreshed);
    setActiveKey(refreshed[0]?.key || null);
  };

  const handleToggleTemplate = (tpl: DocumentTemplate) => {
    if (!selectedClient) return;
    const existing = draftItems.find((item) => item.templateId === tpl.id && !item.isCustom);
    if (existing) {
      const next = draftItems.filter((item) => item.key !== existing.key);
      setDraftItems(next);
      if (activeKey === existing.key) {
        setActiveKey(next[0]?.key || null);
      }
      return;
    }
    const receiptOrdinal = draftItems.filter((i) => i.tipo === 'recibo').length + 1;
    const created = buildRenderedDraft(tpl, selectedClient, selectedCase, receiptOrdinal);
    setDraftItems((prev) => [...prev, created]);
    setActiveKey(created.key);
  };

  const handleAddCustomDocument = (defaultTipo: string = 'recibo') => {
    if (!selectedClient) return;
    const receiptOrdinal = draftItems.filter((i) => i.tipo === 'recibo').length + 1;
    const reciboNum = `REC-${new Date().getFullYear()}-${String(existingReceiptCount + receiptOrdinal).padStart(3, '0')}`;
    const isRecibo = defaultTipo === 'recibo';
    const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newItem: PackageDraftItem = {
      key,
      tipo: defaultTipo,
      titulo: isRecibo
        ? `Recibo Oficial ${reciboNum} (Parcela ${receiptOrdinal}) — ${selectedClient.nomeCompleto}`
        : `Documento Adicional para Aprovação — ${selectedClient.nomeCompleto}`,
      conteudoHtml: isRecibo
        ? `RECIBO OFICIAL Nº ${reciboNum}\n\nRecebemos de ${selectedClient.nomeCompleto}, CPF ${selectedClient.cpf || 'conforme cadastro'}, o valor referente à parcela ${receiptOrdinal} dos honorários de assessoria migratória (Visto e RUT) — ${selectedCase?.titulo || 'Processo Chile'}.\n\nForma de pagamento: ${formaPagamento}.\n\n${empresa.endereco_cidade}.\n\n${empresa.responsavel_tecnico} — ${empresa.nome_empresa}`
        : `DOCUMENTO OFICIAL PARA CIÊNCIA, APROVAÇÃO E ASSINATURA\n\nTitular: ${selectedClient.nomeCompleto}\nProcesso: ${selectedCase?.titulo || 'Assessoria Migratória Chile (Visto e RUT)'}\n\nDescreva aqui as condições, termos ou valores específicos deste documento.\n\n${empresa.responsavel_tecnico} — ${empresa.nome_empresa}`,
      financeiro: FINANCIAL_TYPES.has(defaultTipo),
      isCustom: true,
    };
    setDraftItems((prev) => [...prev, newItem]);
    setActiveKey(key);
  };

  const handleRemoveItem = (key: string) => {
    setDraftItems((prev) => {
      const next = prev.filter((item) => item.key !== key);
      if (activeKey === key) {
        setActiveKey(next[0]?.key || null);
      }
      return next;
    });
  };

  const handleUpdateActiveItem = (patch: Partial<PackageDraftItem>) => {
    if (!activeKey) return;
    setDraftItems((prev) =>
      prev.map((item) => {
        if (item.key !== activeKey) return item;
        const nextTipo = patch.tipo ?? item.tipo;
        return {
          ...item,
          ...patch,
          financeiro: patch.tipo ? FINANCIAL_TYPES.has(nextTipo) : item.financeiro,
        };
      }),
    );
  };

  const handleReapplyValuesToAll = () => {
    if (!selectedClient) return;
    let receiptSeq = 1;
    const refreshed = draftItems.map((item) => {
      if (!item.templateId) return item;
      const tpl = availableTemplates.find((t) => t.id === item.templateId);
      if (!tpl) return item;
      const rendered = buildRenderedDraft(tpl, selectedClient, selectedCase, tpl.tipo === 'recibo' ? receiptSeq++ : receiptSeq);
      return { ...rendered, key: item.key };
    });
    setDraftItems(refreshed);
  };

  const activeItem = useMemo(
    () => draftItems.find((i) => i.key === activeKey) || draftItems[0] || null,
    [draftItems, activeKey],
  );

  const placeholderIssues = useMemo(() => findUnresolvedPlaceholders(draftItems), [draftItems]);

  const handleSendPackage = async () => {
    setErrorMsg(null);
    if (!selectedClient) {
      setErrorMsg('Selecione um cliente para enviar o pacote de documentos.');
      return;
    }
    if (draftItems.length === 0) {
      setErrorMsg('Adicione pelo menos um documento (Contrato, Recibo, Termo, etc.) ao pacote.');
      return;
    }
    if (placeholderIssues.length > 0) {
      const first = placeholderIssues[0];
      setActiveKey(first.key);
      setErrorMsg(
        `Complete os campos pendentes em "${first.titulo}" (${first.placeholders.join(', ')}) antes de enviar.`,
      );
      return;
    }
    if (isAssistente && draftItems.some((item) => item.financeiro)) {
      setErrorMsg('Perfil Assistente não possui permissão para enviar documentos financeiros (Contrato/Recibo).');
      return;
    }

    setSaving(true);
    try {
      const records = buildMultiDocumentBatchRecords({
        items: draftItems,
        clientId: selectedClient.id,
        caseId: selectedCase?.id,
        autorNome: userProfile.nome || userProfile.email,
        liberadoAoCliente,
        idFactory: makeId,
      });

      for (const rec of records) {
        await saveDocumentAudited(
          'generatedDocuments',
          rec.id,
          rec as unknown as Record<string, unknown>,
          true,
          role,
          'enviar_pacote_doc_assinatura',
        );
      }

      if (liberadoAoCliente && unlockPortalIfBlocked && !selectedClient.portalLiberado) {
        await setClientPortalAccessAudited({
          client: selectedClient,
          portalLiberado: true,
          modalidadeConsultoria: normalizePaidModality(selectedClient.modalidadeConsultoria),
          role,
        });
      }

      await onRefresh();
      setSentResult({ client: selectedClient, docs: records });
    } catch (err) {
      const friendly = translateAppError(err, { source: 'pacote-documentos' });
      setErrorMsg(`${friendly.title}: ${friendly.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenWhatsAppNotice = async () => {
    if (!sentResult) return;
    const phone = sentResult.client.whatsapp?.trim() || '';
    if (!phone) {
      setErrorMsg('Este cliente não possui WhatsApp cadastrado.');
      return;
    }
    const msg = buildMultiDocumentWhatsAppNotice({
      clientName: sentResult.client.nomeCompleto,
      empresaName: empresa.nome_empresa,
      documents: sentResult.docs,
    });
    const url = buildWhatsAppUrl(phone, msg);
    if (!url) {
      setErrorMsg('Número de WhatsApp inválido.');
      return;
    }
    openExternalSafe(url);
    await onLogWhatsApp(
      sentResult.client.id,
      selectedCase?.id,
      `Envio de pacote (${sentResult.docs.length} docs para assinatura)`,
      msg,
    ).catch(() => undefined);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Enviar Pacote de Documentos para Assinatura e Aprovação"
    >
      <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8C6D14] dark:text-[#C9A86A]">
              Envio em Lote · Assinatura Eletrônica &amp; Aprovação
            </p>
            <h2 className="text-base sm:text-lg font-bold text-[#070E1C] dark:text-white truncate">
              Enviar Múltiplos Documentos ao Cliente (Contrato, Recibo, Termos, Procuração)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de envio em lote"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-[#17253B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Confirmation State */}
        {sentResult ? (
          <div className="p-6 sm:p-8 overflow-y-auto space-y-5">
            <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 flex items-start gap-3.5">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-emerald-950 dark:text-emerald-200">
                  {sentResult.docs.length} documento(s) enviados com sucesso para {sentResult.client.nomeCompleto}!
                </h3>
                <p className="text-xs text-emerald-900/90 dark:text-emerald-300 leading-relaxed">
                  {liberadoAoCliente
                    ? 'Todos os documentos já estão visíveis no Portal do Cliente em fila sequencial para leitura, aprovação e assinatura eletrônica com certificado SHA-256.'
                    : 'Documentos salvos como rascunho interno. Você pode liberá-los individualmente na Central de Assinaturas.'}
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden">
              {sentResult.docs.map((doc, idx) => {
                const meta = getSignatureDocTypeMeta(doc.tipo);
                return (
                  <div
                    key={doc.id}
                    className="px-4 py-3 bg-white dark:bg-[#0B1220] flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-[#070E1C] dark:text-white">
                        {idx + 1}. {doc.titulo}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400 font-mono tabular-nums">
                        {meta.shortLabel} · Cód. {doc.codigoVerificacao} · Status: {doc.status}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {doc.liberadoAoCliente ? 'Liberado no Portal' : 'Rascunho interno'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
              {sentResult.client.whatsapp && (
                <button
                  type="button"
                  onClick={() => void handleOpenWhatsAppNotice()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#146B43] hover:bg-[#115a38] text-white text-xs font-semibold whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Avisar cliente no WhatsApp ({sentResult.docs.length} docs)
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-white text-xs font-semibold whitespace-nowrap"
              >
                Concluir e voltar ao painel
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Body: Split Configuration + Document Customizer */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {errorMsg && (
                <div
                  role="alert"
                  className="px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs font-medium text-red-800 dark:text-red-300 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Step 1: Cliente, Processo e Valores base */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1">
                    Cliente destinatário *
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => handleChangeClient(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs text-[#070E1C] dark:text-white"
                  >
                    <option value="">Selecione o cliente...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nomeCompleto} ({c.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1">
                    Processo vinculado
                  </label>
                  <select
                    value={caseId}
                    onChange={(e) => setCaseId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs text-[#070E1C] dark:text-white"
                  >
                    <option value="">Processo principal / Geral</option>
                    {clientCases.map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.titulo}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1">
                    Valor base (Contrato / Recibo)
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={moeda}
                      onChange={(e) => setMoeda(e.target.value as CurrencyCode)}
                      aria-label="Moeda"
                      className="w-20 px-2 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs font-mono text-[#070E1C] dark:text-white"
                    >
                      <option value="BRL">BRL</option>
                      <option value="CLP">CLP</option>
                      <option value="USD">USD</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={valorNumerico}
                      onChange={(e) => setValorNumerico(Number(e.target.value) || 0)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs font-mono tabular-nums text-[#070E1C] dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1">
                    Condição de pagamento
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs text-[#070E1C] dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={handleReapplyValuesToAll}
                      title="Atualizar valor e forma de pagamento nos modelos selecionados"
                      className="px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-[11px] font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:bg-slate-50 whitespace-nowrap"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[#475569] dark:text-slate-400 mr-1">
                      Kits prontos:
                    </span>
                    {SIGNATURE_PACKAGE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset.templateIds)}
                        title={preset.descricao}
                        className="px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-[11px] font-semibold text-[#070E1C] dark:text-slate-200 hover:border-[#0F3D91] dark:hover:border-[#60A5FA] whitespace-nowrap"
                      >
                        {preset.nome}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={descricaoPagamento}
                      onChange={(e) => setDescricaoPagamento(e.target.value)}
                      placeholder="Descrição do recibo..."
                      className="w-56 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-[11px] text-[#070E1C] dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Seletor de Múltiplos Documentos + Editor Individual */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* Left Column: Multi-select templates + custom docs */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-[#070E1C] dark:text-white flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
                      1. Marque os documentos do pacote ({draftItems.length})
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleAddCustomDocument('recibo')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:opacity-90 whitespace-nowrap"
                      >
                        <Plus className="w-3 h-3" />
                        + Recibo extra
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddCustomDocument('documento_personalizado')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-[11px] font-semibold text-[#070E1C] dark:text-slate-200 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <FilePlus2 className="w-3 h-3" />
                        + Avulso
                      </button>
                    </div>
                  </div>

                  {/* Checklist de templates disponíveis */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5 max-h-[250px] overflow-y-auto pr-1">
                    {availableTemplates.map((tpl) => {
                      const checked = draftItems.some((i) => i.templateId === tpl.id && !i.isCustom);
                      const meta = getSignatureDocTypeMeta(tpl.tipo);
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => handleToggleTemplate(tpl)}
                          className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-start gap-2.5 ${
                            checked
                              ? 'bg-[#0F3D91]/8 dark:bg-[#0F3D91]/20 border-[#0F3D91] dark:border-[#60A5FA]'
                              : 'bg-white dark:bg-[#0B1220] border-[#E5E7EB] dark:border-[#1E293B] hover:border-slate-400'
                          }`}
                        >
                          <span
                            className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                              checked
                                ? 'bg-[#0F3D91] border-[#0F3D91] text-white'
                                : 'border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-[#070E1C] dark:text-white truncate">
                              {tpl.titulo}
                            </p>
                            <p className="text-[11px] text-[#64748B] dark:text-slate-400">
                              {meta.shortLabel}
                              {meta.financial ? ' · Financeiro' : ' · Operacional'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Fila atual selecionada */}
                  <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      Fila selecionada para envio ({draftItems.length})
                    </p>
                    {draftItems.length === 0 ? (
                      <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                        Selecione um kit ou marque os documentos acima.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-1">
                        {draftItems.map((item, idx) => {
                          const isSelected = activeItem?.key === item.key;
                          const hasWarn = /\[preencher[^\]]*\]/i.test(item.conteudoHtml);
                          const meta = getSignatureDocTypeMeta(item.tipo);
                          return (
                            <div
                              key={item.key}
                              className={`rounded-lg border px-3 py-2 flex items-center justify-between gap-2 transition-colors ${
                                isSelected
                                  ? 'bg-[#070E1C] dark:bg-[#17253B] text-white border-[#070E1C] dark:border-[#3B82F6]'
                                  : 'bg-[#F7F8FA] dark:bg-[#0B1220] text-[#070E1C] dark:text-slate-200 border-[#E5E7EB] dark:border-[#1E293B]'
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setActiveKey(item.key)}
                                className="flex-1 min-w-0 text-left"
                              >
                                <p className="text-xs font-semibold truncate">
                                  {idx + 1}. {item.titulo}
                                </p>
                                <p
                                  className={`text-[11px] ${
                                    isSelected ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {meta.shortLabel}
                                  {hasWarn ? ' · Pendência de preenchimento' : ' · Pronto para envio'}
                                </p>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.key)}
                                aria-label={`Remover ${item.titulo} do pacote`}
                                className={`p-1 rounded hover:bg-red-500/15 ${
                                  isSelected ? 'text-red-300' : 'text-red-600 dark:text-red-400'
                                }`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Live Editor for Active Document */}
                <div className="lg:col-span-7 bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-4 flex flex-col gap-3">
                  {activeItem ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-bold text-[#070E1C] dark:text-white flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#C9A86A]" />
                          2. Revisar e personalizar documento selecionado
                        </h3>
                        <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {getSignatureDocTypeMeta(activeItem.tipo).shortLabel}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1">
                            Título exibido ao cliente
                          </label>
                          <input
                            type="text"
                            value={activeItem.titulo}
                            onChange={(e) => handleUpdateActiveItem({ titulo: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1">
                            Tipo do documento
                          </label>
                          <select
                            value={activeItem.tipo}
                            onChange={(e) => handleUpdateActiveItem({ tipo: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs text-[#070E1C] dark:text-white"
                          >
                            {CUSTOM_DOC_TYPES.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex-1 flex flex-col">
                        <label className="block text-[11px] font-semibold text-[#475569] dark:text-slate-400 mb-1">
                          Conteúdo oficial (formatado automaticamente em A4 para assinatura e PDF)
                        </label>
                        <textarea
                          rows={13}
                          value={activeItem.conteudoHtml}
                          onChange={(e) => handleUpdateActiveItem({ conteudoHtml: e.target.value })}
                          className="w-full flex-1 px-3.5 py-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs leading-relaxed font-mono text-[#070E1C] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/30"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12 space-y-2">
                      <FileSignature className="w-8 h-8 text-slate-400" />
                      <p className="text-sm font-semibold text-[#070E1C] dark:text-white">
                        Nenhum documento selecionado
                      </p>
                      <p className="text-xs text-slate-500 max-w-sm">
                        Escolha um kit pronto ou marque Contrato, Recibo, Procuração ou Termos à esquerda para revisar e enviar ao cliente.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Opções de liberação */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-[#070E1C] dark:text-slate-200 font-medium">
                    <input
                      type="checkbox"
                      checked={liberadoAoCliente}
                      onChange={(e) => setLiberadoAoCliente(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Liberar imediatamente no Portal do Cliente para assinatura e aprovação
                  </label>
                  {selectedClient && !selectedClient.portalLiberado && liberadoAoCliente && (
                    <label className="inline-flex items-center gap-2 cursor-pointer text-amber-800 dark:text-amber-300 font-medium">
                      <input
                        type="checkbox"
                        checked={unlockPortalIfBlocked}
                        onChange={(e) => setUnlockPortalIfBlocked(e.target.checked)}
                        className="rounded border-amber-400"
                      />
                      Liberar acesso ao Portal para {selectedClient.nomeCompleto.split(' ')[0]} automaticamente
                    </label>
                  )}
                </div>

                {clientDependents.length > 0 && (
                  <span className="text-[11px] text-[#64748B] dark:text-slate-400">
                    {clientDependents.length} dependente(s) incluído(s) no contrato
                  </span>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <p className="text-xs text-[#475569] dark:text-slate-400 tabular-nums">
                {draftItems.length > 0 ? (
                  <>
                    <strong className="text-[#070E1C] dark:text-white">{draftItems.length} documento(s)</strong> no pacote
                    {placeholderIssues.length > 0 ? (
                      <span className="text-amber-700 dark:text-amber-400 font-semibold">
                        {' '}· {placeholderIssues.length} com campo pendente
                      </span>
                    ) : (
                      <span className="text-emerald-700 dark:text-emerald-400 font-semibold"> · Todos prontos</span>
                    )}
                  </>
                ) : (
                  'Selecione ao menos 1 documento para continuar'
                )}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111B2E] text-xs font-semibold text-[#070E1C] dark:text-slate-200 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || draftItems.length === 0 || !selectedClient}
                  onClick={() => void handleSendPackage()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5 text-[#C9A86A] dark:text-white" />
                  {saving
                    ? `Enviando ${draftItems.length} documento(s)...`
                    : `Enviar ${draftItems.length} documento(s) para assinatura`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
