import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Eye,
  FileCheck,
  FileText,
  History,
  Mail,
  MessageCircle,
  PenTool,
  Printer,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import { DrawSignaturePad, QrCodeSvg, UiButton } from '../ui/DesignSystem';
import { exportGeneratedOfficialDocPdf } from '../pdf/ClientPortalPdfDocuments';
import { SEED_DOCUMENT_TEMPLATES } from '../../data/seeds';
import { reportAppError } from '../../services/errorService';
import {
  makeId,
  saveDocumentAudited,
  setClientPortalAccessAudited,
  uploadFileToServer,
} from '../../services/firestoreService';
import type {
  Case,
  Client,
  CurrencyCode,
  Dependent,
  DocumentTemplate,
  EmpresaConfig,
  FinancialRecord,
  GeneratedDocument,
  UserProfile,
  UserRole,
} from '../../types/domain';
import {
  applyTemplateVariables,
  buildWhatsAppUrl,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  generateVerificationCode,
  openExternalSafe,
  valorPorExtenso,
} from '../../utils/formatters';
import { CONSULTANCY_PLANS, normalizePaidModality } from '../../utils/portalAccess';

interface ContractGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  clients: Client[];
  cases: Case[];
  dependents: Dependent[];
  documentTemplates: DocumentTemplate[];
  generatedDocuments: GeneratedDocument[];
  initialClientId?: string;
  initialCaseId?: string;
  initialTemplateId?: string;
  initialEditingDoc?: GeneratedDocument | null;
  initialReceiptRecord?: FinancialRecord | null;
  onRefresh: () => Promise<void>;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
}

const FINANCIAL_TYPES = new Set(['contrato', 'recibo', 'orcamento', 'aditivo', 'termo_encerramento']);

export const ContractGeneratorModal: React.FC<ContractGeneratorModalProps> = ({
  open,
  onClose,
  role,
  userProfile,
  empresa,
  clients,
  cases,
  dependents,
  documentTemplates,
  generatedDocuments,
  initialClientId,
  initialCaseId,
  initialTemplateId,
  initialEditingDoc,
  initialReceiptRecord,
  onRefresh,
  onLogWhatsApp,
}) => {
  const isAssistente = role === 'assistente';

  const availableTemplates = useMemo(() => {
    const merged = documentTemplates.length >= SEED_DOCUMENT_TEMPLATES.length ? documentTemplates : SEED_DOCUMENT_TEMPLATES;
    return isAssistente ? merged.filter((t) => !FINANCIAL_TYPES.has(t.tipo)) : merged;
  }, [documentTemplates, isAssistente]);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [tplId, setTplId] = useState<string>(availableTemplates[0]?.id || 'doc_contrato');
  const [clientId, setClientId] = useState<string>(initialClientId || clients[0]?.id || '');
  const [caseId, setCaseId] = useState<string>(initialCaseId || '');
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('contrato');
  const [valorNumerico, setValorNumerico] = useState<number>(3600);
  const [moeda, setMoeda] = useState<CurrencyCode>('BRL');
  const [formaPagamento, setFormaPagamento] = useState('50% na assinatura + 50% no protocolo SERMIG (Pix/Transferência)');
  const [conteudoHtml, setConteudoHtml] = useState('');
  const [status, setStatus] = useState<GeneratedDocument['status']>('Rascunho');
  const [liberadoAoCliente, setLiberadoAoCliente] = useState(false);
  const [financeiro, setFinanceiro] = useState(true);
  const [editMotivo, setEditMotivo] = useState('');

  // Cláusulas opcionais para contratos
  const [incluirDependentes, setIncluirDependentes] = useState(true);
  const [incluirParcelamento, setIncluirParcelamento] = useState(true);
  const [incluirTaxasTerceiros, setIncluirTaxasTerceiros] = useState(true);

  // Sub-views / modais internos
  const [viewMode, setViewMode] = useState<'editor' | 'preview' | 'historico' | 'assinar'>('editor');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelBox, setShowCancelBox] = useState(false);
  const [externalSignLink, setExternalSignLink] = useState('');
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const currentDoc = useMemo(
    () => (selectedDocId ? generatedDocuments.find((g) => g.id === selectedDocId) || null : null),
    [selectedDocId, generatedDocuments],
  );

  const clientCases = useMemo(() => cases.filter((c) => c.clientId === clientId), [cases, clientId]);
  const clientDependents = useMemo(() => dependents.filter((d) => d.clientId === clientId), [dependents, clientId]);

  const fillTemplate = (
    targetTplId: string,
    targetClientId: string,
    targetCaseId: string,
    opts?: {
      valor?: number;
      cur?: CurrencyCode;
      forma?: string;
      reciboNumero?: string;
      reciboDesc?: string;
      incDep?: boolean;
      incParc?: boolean;
      incTax?: boolean;
    },
  ) => {
    const tpl = availableTemplates.find((t) => t.id === targetTplId) || availableTemplates[0];
    if (!tpl) return;
    const cl = clientMap.get(targetClientId);
    const cs = cases.find((c) => c.id === targetCaseId) || cases.find((c) => c.clientId === targetClientId);
    const deps = dependents.filter((d) => d.clientId === targetClientId);

    const vNum = opts?.valor ?? valorNumerico;
    const cur = opts?.cur ?? moeda;
    const valorFmt = `${formatCurrency(vNum, cur)} (${valorPorExtenso(vNum, cur)})`;
    const baseText =
      tpl.id === 'doc_contrato' && empresa.textoContratoPadrao
        ? empresa.textoContratoPadrao
        : tpl.id === 'doc_recibo' && empresa.textoReciboPadrao
          ? `RECIBO OFICIAL Nº ${opts?.reciboNumero || 'REC-AUTO'}\n\n${empresa.textoReciboPadrao}\n\nMeio de pagamento: {{forma_pagamento}}\nDistinção: Valores de honorários e eventuais reembolsos de taxas conforme discriminado.\n\n{{empresa_endereco}}, {{data_atual}}.\n\n{{empresa_responsavel}} — Marca {{empresa_nome}}\n{{empresa_doc}}`
          : tpl.conteudoHtml;

    let filled = applyTemplateVariables(baseText, {
      empresa_nome: empresa.nome_empresa,
      empresa_doc: empresa.razao_social_cnpj_rut,
      empresa_endereco: empresa.endereco_cidade,
      empresa_responsavel: empresa.responsavel_tecnico,
      foro_comarca: empresa.foro_comarca,
      cliente_nome: cl?.nomeCompleto || '[preencher nome completo]',
      cliente_nacionalidade: cl?.nacionalidade || 'Brasileira',
      cliente_estado_civil: cl?.estadoCivil || '[preencher estado civil]',
      cliente_profissao: cl?.profissao || '[preencher profissão]',
      cliente_cpf: cl?.cpf || '[preencher CPF]',
      cliente_passaporte: cl?.passaporte?.numero || '[preencher passaporte]',
      cliente_endereco: cl?.enderecoCompleto || '[preencher endereço]',
      cliente_email: cl?.email || '',
      cliente_whatsapp: cl?.whatsapp || '',
      objeto_servico: cs?.titulo || 'Assessoria Migratória para Residência no Chile',
      valor_contrato: valorFmt,
      forma_pagamento: opts?.forma ?? formaPagamento,
      descricao_pagamento: opts?.reciboDesc || 'Honorários de Assessoria Migratória',
      valor_pago: valorFmt,
      caso_titulo: cs?.titulo || 'Processo Migratório Chile',
      data_atual: formatDateBR(new Date()),
    });

    const modality = normalizePaidModality(cl?.modalidadeConsultoria || cs?.modalidadeConsultoria);
    const modalitySpec = CONSULTANCY_PLANS[modality];

    if (tpl.tipo === 'contrato') {
      const addDep = opts?.incDep ?? incluirDependentes;
      const addParc = opts?.incParc ?? incluirParcelamento;
      const addTax = opts?.incTax ?? incluirTaxasTerceiros;
      const extras: string[] = [];
      extras.push(
        modality === 'orientativa'
          ? `CLÁUSULA DE MODALIDADE – CONSULTORIA ORIENTATIVA\nFica expressamente ajustado que o presente contrato refere-se à modalidade ${modalitySpec.nome}. Caberá à CONTRATADA fornecer diagnóstico técnico, checklist personalizado na ordem de validade, conferência prévia dos documentos enviados no Portal e orientação passo a passo por reunião/chat. O protocolo oficial no sistema do SERMIG (Servicio Nacional de Migraciones) e o acompanhamento direto das notificações oficiais serão realizados pelo próprio CONTRATANTE.`
          : `CLÁUSULA DE MODALIDADE – CONSULTORIA COMPLETA (GESTÃO INTEGRAL)\nFica expressamente ajustado que o presente contrato refere-se à modalidade ${modalitySpec.nome}. Caberá à CONTRATADA conduzir integralmente a organização do dossiê, conferência documental, realização do protocolo oficial junto ao SERMIG, monitoramento de prazos e eventuais requerimentos oficiais, além das orientações pós-aprovação (Estampado Eletrônico, PDI e Cédula/RUN).`,
      );
      if (addDep && deps.length > 0) {
        extras.push(
          `CLÁUSULA ADICIONAL – DEPENDENTES VINCULADOS\nIncluem-se no escopo operacional os seguintes dependentes familiares: ${deps
            .map((d) => `${d.nomeCompleto} (${d.parentesco})`)
            .join('; ')}.`,
        );
      }
      if (addParc) {
        extras.push(
          `CLÁUSULA ADICIONAL – CONDIÇÕES DE PARCELAMENTO\nForma ajustada: ${opts?.forma ?? formaPagamento}. O atraso superior a 10 dias suspende o protocolo até regularização financeira.`,
        );
      }
      if (addTax) {
        extras.push(
          `CLÁUSULA ADICIONAL – TAXAS OFICIAIS E TERCEIROS\nTaxas governamentais do SERMIG, Registro Civil (Cédula), Apostila de Haia (CNJ) e traduções juramentadas correm por conta direta do CONTRATANTE, sem retenção pelo(a) CONTRATADO(A) salvo reembolso comprovado.`,
        );
      }
      if (extras.length > 0) {
        filled += '\n\n' + extras.join('\n\n');
      }
    }

    setTplId(tpl.id);
    setTitulo(opts?.reciboNumero ? `Recibo Oficial ${opts.reciboNumero} — ${cl?.nomeCompleto || ''}` : tpl.titulo);
    setTipo(tpl.tipo);
    setFinanceiro(FINANCIAL_TYPES.has(tpl.tipo));
    setConteudoHtml(filled);
  };

  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    setErrorMsg(null);
    setShowCancelBox(false);
    setCancelReason('');

    if (initialEditingDoc) {
      setSelectedDocId(initialEditingDoc.id);
      setClientId(initialEditingDoc.clientId);
      setCaseId(initialEditingDoc.caseId || '');
      setTitulo(initialEditingDoc.titulo);
      setTipo(initialEditingDoc.tipo);
      setConteudoHtml(initialEditingDoc.conteudoHtml);
      setStatus(initialEditingDoc.status || 'Rascunho');
      setLiberadoAoCliente(initialEditingDoc.liberadoAoCliente);
      setFinanceiro(initialEditingDoc.financeiro);
      setExternalSignLink(initialEditingDoc.assinaturaLinkExterno || '');
      setViewMode('editor');
      return;
    }

    if (initialReceiptRecord) {
      const nextNum = `REC-${new Date().getFullYear()}-${String(
        generatedDocuments.filter((g) => g.tipo === 'recibo').length + 1,
      ).padStart(3, '0')}`;
      const targetCid = initialReceiptRecord.clientId || initialClientId || clients[0]?.id || '';
      const targetCase = initialReceiptRecord.caseId || initialCaseId || '';
      setSelectedDocId(null);
      setClientId(targetCid);
      setCaseId(targetCase);
      setValorNumerico(initialReceiptRecord.valor);
      setMoeda(initialReceiptRecord.moeda);
      setFormaPagamento(initialReceiptRecord.formaPagamento || 'Transferência / Pix');
      setStatus('Revisado');
      setLiberadoAoCliente(true);
      setViewMode('preview');
      fillTemplate('doc_recibo', targetCid, targetCase, {
        valor: initialReceiptRecord.valor,
        cur: initialReceiptRecord.moeda,
        forma: initialReceiptRecord.formaPagamento || 'Pix / Transferência',
        reciboNumero: initialReceiptRecord.reciboNumero || nextNum,
        reciboDesc: `${initialReceiptRecord.tipo}: ${initialReceiptRecord.descricao}`,
      });
      return;
    }

    const cid = initialClientId || clients[0]?.id || '';
    const csid = initialCaseId || cases.find((c) => c.clientId === cid)?.id || '';
    const tid = initialTemplateId || availableTemplates[0]?.id || 'doc_contrato';
    setSelectedDocId(null);
    setClientId(cid);
    setCaseId(csid);
    setStatus('Rascunho');
    setLiberadoAoCliente(false);
    setViewMode('editor');
    fillTemplate(tid, cid, csid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEditingDoc?.id, initialReceiptRecord?.id, initialClientId, initialCaseId, initialTemplateId]);

  const missingPlaceholders = useMemo(() => {
    const matches = conteudoHtml.match(/\[preencher[^\]]*\]/gi) || [];
    return Array.from(new Set(matches));
  }, [conteudoHtml]);

  if (!open) return null;

  const hasPendingPlaceholders = missingPlaceholders.length > 0;
  const isCancelled = Boolean(currentDoc?.canceladoEm);

  const handleSave = async (nextStatusOverride?: GeneratedDocument['status']) => {
    setErrorMsg(null);
    if (!clientId) {
      setErrorMsg('Selecione o cliente antes de salvar.');
      return;
    }
    if (isAssistente && financeiro) {
      setErrorMsg('Perfil Assistente não tem permissão para emitir documentos financeiros.');
      return;
    }
    if (hasPendingPlaceholders) {
      setErrorMsg(`Bloqueado: substitua todos os marcadores pendentes (${missingPlaceholders.join(', ')}) antes de finalizar.`);
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const targetStatus = nextStatusOverride || status;
      if (currentDoc) {
        const nextHist = [
          ...(currentDoc.historicoVersoes || []),
          {
            versao: currentDoc.versao,
            conteudoHtml: currentDoc.conteudoHtml,
            data: currentDoc.updatedAt || currentDoc.createdAt,
            autor: userProfile.nome || userProfile.email,
            motivo: editMotivo.trim() || 'Nova edição no documento',
          },
        ];
        const updated: GeneratedDocument = {
          ...currentDoc,
          tipo,
          titulo: titulo.trim(),
          clientId,
          caseId: caseId || undefined,
          conteudoHtml,
          versao: currentDoc.versao + 1,
          status: targetStatus,
          codigoVerificacao: currentDoc.codigoVerificacao || generateVerificationCode('DOC'),
          historicoVersoes: nextHist,
          liberadoAoCliente,
          financeiro,
          assinaturaLinkExterno: externalSignLink || currentDoc.assinaturaLinkExterno,
        };
        await saveDocumentAudited('generatedDocuments', currentDoc.id, updated as unknown as Record<string, unknown>, false, role, 'editar_doc_gerado', currentDoc);
        setStatus(targetStatus);
        setEditMotivo('');
        setFeedback(`Documento atualizado para v${updated.versao} (${updated.status}).`);
      } else {
        const id = makeId('gdoc');
        const code = generateVerificationCode(tipo === 'recibo' ? 'REC' : 'DOC');
        const record: GeneratedDocument = {
          id,
          tipo,
          titulo: titulo.trim() || 'Documento Institucional',
          clientId,
          caseId: caseId || undefined,
          conteudoHtml,
          versao: 1,
          status: targetStatus,
          codigoVerificacao: code,
          historicoVersoes: [],
          liberadoAoCliente,
          financeiro,
          assinaturaLinkExterno: externalSignLink || undefined,
          autorNome: userProfile.nome || userProfile.email,
          createdAt: now,
        };
        await saveDocumentAudited('generatedDocuments', id, record as unknown as Record<string, unknown>, true, role, 'criar_doc_gerado');
        setSelectedDocId(id);
        setStatus(targetStatus);
        setFeedback(`Documento "${record.titulo}" criado (${code}).`);
      }
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignatureData = async (signatureDataUrl: string) => {
    if (!currentDoc) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const updated: GeneratedDocument = {
        ...currentDoc,
        status: 'Assinado',
        assinaturaDataUrl: signatureDataUrl,
        assinadoEm: now,
      };
      await saveDocumentAudited('generatedDocuments', currentDoc.id, updated as unknown as Record<string, unknown>, false, role, 'assinatura_doc');
      setStatus('Assinado');
      setFeedback('Assinatura registrada com sucesso!');
      setViewMode('preview');
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleUploadSignedPdf = async (file: File) => {
    if (!currentDoc) return;
    setSaving(true);
    try {
      const uploaded = await uploadFileToServer(file);
      const now = new Date().toISOString();
      const updated: GeneratedDocument = {
        ...currentDoc,
        status: 'Assinado',
        assinaturaUrl: uploaded.url,
        assinadoEm: now,
      };
      await saveDocumentAudited('generatedDocuments', currentDoc.id, updated as unknown as Record<string, unknown>, false, role, 'upload_doc_assinado');
      setStatus('Assinado');
      setFeedback('Documento assinado anexado!');
      await onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha no upload da assinatura.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelDoc = async () => {
    if (!currentDoc || !cancelReason.trim()) {
      setErrorMsg('Informe o motivo do cancelamento.');
      return;
    }
    setSaving(true);
    try {
      const updated: GeneratedDocument = {
        ...currentDoc,
        status: 'Arquivado',
        liberadoAoCliente: false,
        motivoCancelamento: cancelReason.trim(),
        canceladoEm: new Date().toISOString(),
      };
      await saveDocumentAudited('generatedDocuments', currentDoc.id, updated as unknown as Record<string, unknown>, false, role, 'cancelar_doc_gerado', currentDoc);
      setShowCancelBox(false);
      setFeedback('Documento cancelado com registro auditado (histórico preservado).');
      await onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const selectedClient = clientMap.get(clientId);
  const verCode = currentDoc?.codigoVerificacao || 'PRE-VISUALIZACAO';

  const handleDownloadPdf = async () => {
    setErrorMsg(null);
    setExportingPdf(true);
    try {
      const filename = await exportGeneratedOfficialDocPdf({
        empresa,
        titulo: titulo || 'Documento Oficial',
        conteudo: conteudoHtml,
        codigoVerificacao: verCode,
        versao: currentDoc?.versao || 1,
        status,
        clienteNome: selectedClient?.nomeCompleto,
        assinaturaDataUrl: currentDoc?.assinaturaDataUrl,
        assinadoEm: currentDoc?.assinadoEm,
        confirmadoLeituraEm: currentDoc?.confirmadoLeituraEm,
        canceladoMotivo: isCancelled ? currentDoc?.motivoCancelamento : undefined,
      });
      setFeedback(`PDF multi-páginas gerado: ${filename}`);
    } catch (err) {
      reportAppError(err, { source: 'pdf' });
      setErrorMsg('Não foi possível gerar o PDF agora. Use a opção Imprimir ou tente novamente.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 flex items-center justify-center p-3 sm:p-4 print-modal-backdrop" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl print-modal-dialog">
        {/* Topbar */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">
                {currentDoc ? `${currentDoc.titulo} (v${currentDoc.versao})` : 'Gerador de Contratos, Recibos & Documentos'}
              </h2>
              <p className="text-[11px] text-slate-500">
                13 modelos oficiais · Versionamento com histórico · Código verificador QR · Aviso de revisão jurídica
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 max-w-full">
            {(['editor', 'preview', 'historico', 'assinar'] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={(m === 'historico' || m === 'assinar') && !currentDoc}
                onClick={() => setViewMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${
                  viewMode === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                {m === 'editor' ? 'Editar' : m === 'preview' ? 'Prévia A4 / PDF' : m === 'historico' ? `Versões (${currentDoc?.historicoVersoes?.length || 0})` : 'Assinatura'}
              </button>
            ))}
            <button type="button" onClick={onClose} aria-label="Fechar gerador" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 print-modal-scroll">
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

          {isCancelled && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C82333] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>
                <strong>DOCUMENTO CANCELADO</strong> em {formatDateTimeBR(currentDoc?.canceladoEm)} — Motivo: {currentDoc?.motivoCancelamento}
              </span>
            </div>
          )}

          {viewMode === 'editor' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Modelo (13 disponíveis)</label>
                  <select
                    value={tplId}
                    onChange={(e) => fillTemplate(e.target.value, clientId, caseId)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    {availableTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Cliente *</label>
                  <select
                    value={clientId}
                    onChange={(e) => {
                      const nextCid = e.target.value;
                      const firstCase = cases.find((c) => c.clientId === nextCid)?.id || '';
                      setClientId(nextCid);
                      setCaseId(firstCase);
                      if (!currentDoc) fillTemplate(tplId, nextCid, firstCase);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="">Selecione...</option>
                    {clients.filter((c) => !c.arquivado).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nomeCompleto}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Caso vinculado</label>
                  <select
                    value={caseId}
                    onChange={(e) => {
                      setCaseId(e.target.value);
                      if (!currentDoc) fillTemplate(tplId, clientId, e.target.value);
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="">Nenhum / Geral</option>
                    {clientCases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.titulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Ciclo de vida / Status</label>
                  <select
                    value={status}
                    disabled={isCancelled}
                    onChange={(e) => setStatus(e.target.value as GeneratedDocument['status'])}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                  >
                    <option value="Rascunho">Rascunho</option>
                    <option value="Revisado">Revisado</option>
                    <option value="Enviado">Enviado</option>
                    <option value="Assinado">Assinado</option>
                    <option value="Arquivado">Arquivado</option>
                  </select>
                </div>
              </div>

              {!isAssistente && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex gap-2">
                    <div className="w-24">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Moeda</label>
                      <select value={moeda} onChange={(e) => setMoeda(e.target.value as CurrencyCode)} className="w-full px-2 py-1.5 rounded-lg border border-slate-300 text-xs bg-white">
                        <option value="BRL">BRL</option>
                        <option value="CLP">CLP</option>
                        <option value="USD">USD</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Valor (com extenso auto)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={valorNumerico}
                        onChange={(e) => setValorNumerico(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs tabular-nums"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Forma de pagamento</label>
                    <input
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs"
                    />
                  </div>
                  <div className="flex items-end">
                    <UiButton
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={() => fillTemplate(tplId, clientId, caseId)}
                    >
                      Reaplicar variáveis ({formatCurrency(valorNumerico, moeda)})
                    </UiButton>
                  </div>
                </div>
              )}

              {tipo === 'contrato' && (
                <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700">Cláusulas opcionais:</span>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={incluirDependentes}
                      onChange={(e) => {
                        setIncluirDependentes(e.target.checked);
                        fillTemplate(tplId, clientId, caseId, { incDep: e.target.checked });
                      }}
                    />
                    Incluir dependentes ({clientDependents.length})
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={incluirParcelamento}
                      onChange={(e) => {
                        setIncluirParcelamento(e.target.checked);
                        fillTemplate(tplId, clientId, caseId, { incParc: e.target.checked });
                      }}
                    />
                    Cláusula de parcelamento
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={incluirTaxasTerceiros}
                      onChange={(e) => {
                        setIncluirTaxasTerceiros(e.target.checked);
                        fillTemplate(tplId, clientId, caseId, { incTax: e.target.checked });
                      }}
                    />
                    Cláusula de taxas terceiros (SERMIG/CNJ)
                  </label>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título do documento</label>
                <input
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">Corpo do documento</label>
                  <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Nota jurídica: Revisar com advogado antes do uso
                  </span>
                </div>
                <textarea
                  rows={12}
                  value={conteudoHtml}
                  onChange={(e) => setConteudoHtml(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${
                    hasPendingPlaceholders ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                  }`}
                />
                {hasPendingPlaceholders && (
                  <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-950 flex flex-wrap items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Campos pendentes bloqueando finalização:</span>
                    {missingPlaceholders.map((m) => (
                      <span key={m} className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono font-bold text-[11px]">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {currentDoc && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Motivo da revisão (para histórico de versões)</label>
                  <input
                    value={editMotivo}
                    onChange={(e) => setEditMotivo(e.target.value)}
                    placeholder="Ex.: Ajuste de parcelas e endereço atualizado do titular"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={financeiro}
                    disabled={isAssistente}
                    onChange={(e) => setFinanceiro(e.target.checked)}
                  />
                  Documento financeiro (oculto para Assistente)
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={liberadoAoCliente}
                    onChange={(e) => setLiberadoAoCliente(e.target.checked)}
                  />
                  Disponibilizar no Portal do Cliente
                </label>
              </div>
              {liberadoAoCliente && selectedClient && !selectedClient.portalLiberado && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Atenção: o acesso ao Portal do Cliente de <strong>{selectedClient.nomeCompleto}</strong> ainda está bloqueado (o cliente verá apenas &ldquo;Diagnóstico Gratuito&rdquo; até o portal ser liberado).
                  </span>
                  {(role === 'admin' || role === 'consultor') && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={async () => {
                        setSaving(true);
                        try {
                          await setClientPortalAccessAudited({
                            client: selectedClient,
                            portalLiberado: true,
                            modalidadeConsultoria: normalizePaidModality(selectedClient.modalidadeConsultoria),
                            role,
                          });
                          setFeedback(`Portal do Cliente LIBERADO para ${selectedClient.nomeCompleto}!`);
                          await onRefresh();
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-[#0B1F33] text-white text-xs font-semibold hover:opacity-95 whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      Liberar Portal do Cliente Agora
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {viewMode === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2 no-print">
                <p className="text-xs text-slate-600">
                  Pré-visualização A4 institucional pronta para impressão ou exportação em PDF pelo navegador.
                </p>
                <div className="flex flex-wrap gap-2">
                  <UiButton
                    type="button"
                    size="sm"
                    variant="primary"
                    disabled={exportingPdf}
                    onClick={() => void handleDownloadPdf()}
                  >
                    <Download className="w-3.5 h-3.5" />
                    {exportingPdf ? 'Gerando PDF...' : 'Baixar PDF A4'}
                  </UiButton>
                  <UiButton type="button" size="sm" variant="outline" onClick={() => window.print()}>
                    <Printer className="w-3.5 h-3.5" />
                    Imprimir
                  </UiButton>
                  {selectedClient?.whatsapp && (
                    <UiButton
                      type="button"
                      size="sm"
                      variant="success"
                      onClick={async () => {
                        const msg = `Olá, ${selectedClient.nomeCompleto}! O documento "${titulo}" (cód. ${verCode}) foi disponibilizado para você no Portal do Cliente.`;
                        openExternalSafe(buildWhatsAppUrl(selectedClient.whatsapp, msg));
                        await onLogWhatsApp(selectedClient.id, caseId || undefined, `Envio Doc: ${titulo}`, msg);
                        if (currentDoc && currentDoc.status !== 'Assinado') {
                          await handleSave('Enviado');
                        }
                      }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Enviar no WhatsApp
                    </UiButton>
                  )}
                  {selectedClient?.email && (
                    <a
                      href={`mailto:${selectedClient.email}?subject=${encodeURIComponent(titulo)}&body=${encodeURIComponent(
                        `Olá ${selectedClient.nomeCompleto},\n\nSegue o documento "${titulo}" (Código de verificação: ${verCode}) disponível no seu Portal do Cliente.`,
                      )}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      E-mail
                    </a>
                  )}
                </div>
              </div>

              {/* A4 Sheet */}
              <div className="bg-white border border-slate-300 rounded-xl p-4 sm:p-8 lg:p-10 max-w-full sm:max-w-3xl mx-auto shadow-xs space-y-6 text-slate-900 print-sheet">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {empresa.logoUrl ? (
                      <img src={empresa.logoUrl} alt={empresa.nome_empresa} className="h-12 w-auto object-contain shrink-0" />
                    ) : (
                      <span
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        D&amp;M
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 break-words">{empresa.nome_empresa}</p>
                      <p className="text-[11px] text-slate-500 break-words">{empresa.razao_social_cnpj_rut}</p>
                      <p className="text-[11px] text-slate-500 break-words">
                        {empresa.endereco_cidade} · {empresa.email} · {empresa.whatsapp}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 text-right shrink-0">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Verificação</p>
                      <p className="text-xs font-mono font-bold text-slate-900">{verCode}</p>
                      <p className="text-[10px] text-slate-500">v{currentDoc?.versao || 1} · {status}</p>
                    </div>
                    <QrCodeSvg value={verCode} size={56} />
                  </div>
                </div>

                {isCancelled && (
                  <div className="p-2 border-2 border-[#C82333] text-center text-xs font-bold text-[#C82333] uppercase">
                    DOCUMENTO CANCELADO — SEM VALIDADE ({currentDoc?.motivoCancelamento})
                  </div>
                )}

                <h3 className="text-base font-bold text-center text-slate-900 uppercase">{titulo}</h3>

                <div className="text-xs leading-relaxed whitespace-pre-wrap text-slate-800">{conteudoHtml}</div>

                {(currentDoc?.assinaturaDataUrl || currentDoc?.assinaturaUrl || currentDoc?.confirmadoLeituraEm) && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                    {currentDoc?.assinaturaDataUrl && (
                      <div>
                        <p className="font-semibold">Assinatura Eletrônica Registrada ({formatDateTimeBR(currentDoc.assinadoEm)}):</p>
                        <img src={currentDoc.assinaturaDataUrl} alt="Assinatura" className="h-16 mt-1 border border-emerald-200 bg-white rounded" />
                      </div>
                    )}
                    {currentDoc?.assinaturaUrl && (
                      <p>
                        Documento assinado anexado:{' '}
                        <a href={currentDoc.assinaturaUrl} target="_blank" rel="noopener noreferrer" className="underline font-semibold">
                          Abrir arquivo assinado
                        </a>
                      </p>
                    )}
                    {currentDoc?.confirmadoLeituraEm && (
                      <p className="font-medium">
                        Leitura confirmada pelo cliente em {formatDateTimeBR(currentDoc.confirmadoLeituraEm)}.
                      </p>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-500 space-y-1">
                  <p>{empresa.avisoLegal}</p>
                  <p className="italic">Nota interna de controle: Revisar com advogado antes do uso.</p>
                </div>
              </div>
            </div>
          )}

          {viewMode === 'historico' && currentDoc && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-[var(--color-primary)]" />
                Histórico de Versões — Comparação com Versão Atual (v{currentDoc.versao})
              </h3>
              {(currentDoc.historicoVersoes || []).length === 0 ? (
                <p className="text-xs text-slate-500">Esta é a versão inicial (v1) deste documento.</p>
              ) : (
                <div className="space-y-4">
                  {[...(currentDoc.historicoVersoes || [])].reverse().map((hv, idx) => (
                    <div key={idx} className="border border-slate-200 rounded-xl p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-bold text-slate-900">
                          Versão {hv.versao} · {formatDateTimeBR(hv.data)} · {hv.autor}
                        </span>
                        <span className="text-slate-600">{hv.motivo}</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <p className="font-semibold text-slate-600 mb-1">Versão {hv.versao} (Anterior)</p>
                          <pre className="whitespace-pre-wrap font-mono text-slate-700 max-h-48 overflow-y-auto">{hv.conteudoHtml}</pre>
                        </div>
                        <div className="p-3 rounded-lg bg-emerald-50/40 border border-emerald-200">
                          <p className="font-semibold text-emerald-800 mb-1">Versão Atual (v{currentDoc.versao})</p>
                          <pre className="whitespace-pre-wrap font-mono text-slate-800 max-h-48 overflow-y-auto">{currentDoc.conteudoHtml}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'assinar' && currentDoc && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-4 rounded-xl border border-slate-200 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <PenTool className="w-4 h-4 text-[var(--color-primary)]" />
                    Assinatura Desenhada no Aplicativo
                  </h3>
                  <DrawSignaturePad initialDataUrl={currentDoc.assinaturaDataUrl} onSave={handleSaveSignatureData} />
                </div>

                <div className="p-4 rounded-xl border border-slate-200 space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-[var(--color-primary)]" />
                    Anexar PDF Assinado ou Link Externo (Gov.br / Autentique)
                  </h3>
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 cursor-pointer hover:bg-slate-50">
                    <Upload className="w-3.5 h-3.5" />
                    Anexar documento já assinado (PDF/Imagem)
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleUploadSignedPdf(f);
                      }}
                    />
                  </label>
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Link de assinatura externa (opcional)</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={externalSignLink}
                        onChange={(e) => setExternalSignLink(e.target.value)}
                        placeholder="https://assinador.gov.br/..."
                        className="flex-1 min-w-0 w-full sm:w-auto px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                      />
                      <UiButton type="button" size="sm" onClick={() => void handleSave()}>
                        Salvar Link
                      </UiButton>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showCancelBox && currentDoc && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 space-y-2 no-print">
              <p className="text-xs font-bold text-[#C82333]">Cancelar documento emitido (nunca excluir — mantém histórico auditado)</p>
              <input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Informe o motivo formal do cancelamento..."
                className="w-full px-3 py-2 rounded-lg border border-red-300 text-xs bg-white"
              />
              <div className="flex flex-wrap justify-end gap-2">
                <UiButton type="button" size="sm" variant="outline" onClick={() => setShowCancelBox(false)}>
                  Voltar
                </UiButton>
                <UiButton type="button" size="sm" variant="danger" onClick={() => void handleCancelDoc()}>
                  Confirmar Cancelamento
                </UiButton>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex flex-wrap items-center gap-2">
            {currentDoc && !isCancelled && (
              <UiButton type="button" size="sm" variant="danger" onClick={() => setShowCancelBox(true)}>
                Cancelar Documento
              </UiButton>
            )}
            <UiButton type="button" size="sm" variant="outline" onClick={() => setViewMode(viewMode === 'preview' ? 'editor' : 'preview')}>
              <Eye className="w-3.5 h-3.5" />
              {viewMode === 'preview' ? 'Voltar para Edição' : 'Visualizar A4'}
            </UiButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <UiButton type="button" size="sm" variant="outline" onClick={onClose}>
              Fechar
            </UiButton>
            {!isCancelled && (
              <>
                <UiButton type="button" size="sm" variant="outline" disabled={saving || hasPendingPlaceholders} onClick={() => void handleSave('Revisado')}>
                  <FileCheck className="w-3.5 h-3.5" />
                  Salvar como Revisado
                </UiButton>
                <UiButton type="button" size="sm" variant="primary" disabled={saving || hasPendingPlaceholders} onClick={() => void handleSave()}>
                  {saving ? 'Salvando...' : currentDoc ? 'Salvar Nova Versão' : 'Gerar & Salvar Documento'}
                </UiButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
