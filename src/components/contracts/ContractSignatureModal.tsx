import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  PenTool,
  ShieldCheck,
  Type,
  Upload,
  X,
} from 'lucide-react';
import type { EmpresaConfig, GeneratedDocument, GeneratedDocumentSignatureMethod } from '../../types/domain';
import { BrandRibbon } from '../BrandLogo';
import { UiButton } from '../ui/DesignSystem';
import { ContractDocumentSheet } from './ContractDocumentSheet';
import { SignaturePadCanvas } from './SignaturePadCanvas';
import { SignatureCertificateCard } from './SignatureCertificateCard';
import { formatDateTimeBR } from '../../utils/formatters';
import {
  computeDocumentContentHash,
  formatSignatureHashShort,
  getSignatureMethodLabel,
  renderTypedSignatureToDataUrl,
  TYPED_SIGNATURE_STYLES,
  validateAndNormalizeSignatureDataUrl,
  validateSignerIdentity,
  type TypedSignatureStyleId,
} from '../../utils/contractSignature';
import type { ClientSignaturePatchMeta } from '../../utils/clientPortalPatches';

export interface ContractSignatureSubmitResult {
  assinaturaDataUrl?: string;
  assinaturaUrl?: string;
  assinadoEm: string;
  meta: ClientSignaturePatchMeta;
}

interface ContractSignatureModalProps {
  doc: GeneratedDocument;
  empresa: EmpresaConfig;
  defaultSignerName?: string;
  defaultSignerEmail?: string;
  defaultSignerDocument?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmitDigitalSignature: (
    doc: GeneratedDocument,
    signatureDataUrl: string,
    meta: ClientSignaturePatchMeta,
    nowIso: string,
  ) => Promise<void>;
  onSubmitSignedFile: (
    doc: GeneratedDocument,
    file: File,
    meta: ClientSignaturePatchMeta,
    nowIso: string,
  ) => Promise<string | void>;
  onDownloadPdf?: (docWithSignature: GeneratedDocument) => Promise<void>;
}

type SignMode = 'desenhar' | 'digitar' | 'pdf';
type MobilePane = 'contrato' | 'assinar';

interface PendingSignatureConfirmation {
  mode: SignMode;
  method: GeneratedDocumentSignatureMethod;
  signatureDataUrl?: string;
  file?: File;
  meta: ClientSignaturePatchMeta;
  resolvedHash: string;
}

export const ContractSignatureModal: React.FC<ContractSignatureModalProps> = ({
  doc,
  empresa,
  defaultSignerName = '',
  defaultSignerEmail = '',
  defaultSignerDocument = '',
  busy = false,
  onClose,
  onSubmitDigitalSignature,
  onSubmitSignedFile,
  onDownloadPdf,
}) => {
  const [signMode, setSignMode] = useState<SignMode>('desenhar');
  const [mobilePane, setMobilePane] = useState<MobilePane>('contrato');
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signerDocument, setSignerDocument] = useState(defaultSignerDocument);
  const [aceiteTermo, setAceiteTermo] = useState(false);

  const [drawnDataUrl, setDrawnDataUrl] = useState<string | null>(null);
  const [typedStyle, setTypedStyle] = useState<TypedSignatureStyleId>('classica');
  const [typedInk, setTypedInk] = useState<'#0B1F33' | '#0F3D91'>('#0B1F33');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [readProgress, setReadProgress] = useState(0);
  const [reachedBottom, setReachedBottom] = useState(false);
  const [contentHash, setContentHash] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingSignatureConfirmation | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completedDoc, setCompletedDoc] = useState<GeneratedDocument | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const contractScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    void computeDocumentContentHash({
      conteudoHtml: doc.conteudoHtml,
      titulo: doc.titulo,
      docId: doc.id,
      versao: doc.versao,
      codigoVerificacao: doc.codigoVerificacao,
    }).then((hash) => {
      if (active) setContentHash(hash);
    });
    return () => {
      active = false;
    };
  }, [doc]);

  useEffect(() => {
    const el = contractScrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 24) {
      setReadProgress(100);
      setReachedBottom(true);
    }
  }, [doc.conteudoHtml, mobilePane]);

  const handleContractScroll = () => {
    const el = contractScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 12) {
      setReadProgress(100);
      setReachedBottom(true);
      return;
    }
    const pct = Math.min(100, Math.max(0, Math.round((el.scrollTop / maxScroll) * 100)));
    setReadProgress((prev) => Math.max(prev, pct));
    if (pct >= 92) {
      setReachedBottom(true);
    }
  };

  const selectedTypedStyleObj = useMemo(
    () => TYPED_SIGNATURE_STYLES.find((s) => s.id === typedStyle) || TYPED_SIGNATURE_STYLES[0],
    [typedStyle],
  );

  const isWorking = busy || submitting;

  const canPrepareConfirmation = useMemo(() => {
    if (isWorking || !aceiteTermo || signerName.trim().length < 3) return false;
    if (signMode === 'desenhar') return Boolean(drawnDataUrl);
    if (signMode === 'digitar') return signerName.trim().includes(' ');
    return Boolean(selectedFile);
  }, [isWorking, aceiteTermo, signerName, signMode, drawnDataUrl, selectedFile]);

  /**
   * Etapa 1: Valida identidade, assinatura (base64 compacta) e abre o modal de confirmação final.
   */
  const handleRequestConfirmationModal = async () => {
    setValidationError(null);
    setConfirmError(null);

    const identityCheck = validateSignerIdentity({
      nome: signerName,
      email: defaultSignerEmail,
      documento: signerDocument,
      aceiteTermo,
    });
    if (!identityCheck.valid) {
      setValidationError(identityCheck.error || 'Revise os dados do signatário.');
      return;
    }

    const resolvedHash =
      contentHash ||
      (await computeDocumentContentHash({
        conteudoHtml: doc.conteudoHtml,
        titulo: doc.titulo,
        docId: doc.id,
        versao: doc.versao,
        codigoVerificacao: doc.codigoVerificacao,
      }));
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 280) : '';
    const method: GeneratedDocumentSignatureMethod =
      signMode === 'desenhar' ? 'desenhada' : signMode === 'digitar' ? 'tipografica' : 'pdf_anexado';

    const baseMeta: ClientSignaturePatchMeta = {
      assinaturaMetodo: method,
      assinadoPorNome: identityCheck.normalizedNome,
      assinadoPorEmail: identityCheck.normalizedEmail || undefined,
      assinadoPorDocumento: identityCheck.normalizedDocumento || undefined,
      assinaturaHashSha256: resolvedHash,
      assinaturaUserAgent: ua || undefined,
      assinaturaAceiteTermo: true,
      confirmadoLeituraPor: doc.confirmadoLeituraPor || identityCheck.normalizedNome,
    };

    if (signMode === 'desenhar') {
      const check = validateAndNormalizeSignatureDataUrl(drawnDataUrl || '');
      if (!check.valid) {
        setValidationError(check.error || 'Desenhe sua assinatura no quadro antes de continuar.');
        return;
      }
      setPendingConfirm({
        mode: 'desenhar',
        method,
        signatureDataUrl: check.dataUrl,
        meta: baseMeta,
        resolvedHash,
      });
      return;
    }

    if (signMode === 'digitar') {
      const rendered = renderTypedSignatureToDataUrl(identityCheck.normalizedNome, typedStyle, typedInk);
      const check = validateAndNormalizeSignatureDataUrl(rendered);
      if (!check.valid) {
        setValidationError(
          check.error || 'Não foi possível gerar a assinatura tipográfica. Tente o modo Desenhar.',
        );
        return;
      }
      setPendingConfirm({
        mode: 'digitar',
        method,
        signatureDataUrl: check.dataUrl,
        meta: baseMeta,
        resolvedHash,
      });
      return;
    }

    if (!selectedFile) {
      setValidationError('Selecione o arquivo PDF ou imagem já assinado antes de continuar.');
      return;
    }

    setPendingConfirm({
      mode: 'pdf',
      method,
      file: selectedFile,
      meta: baseMeta,
      resolvedHash,
    });
  };

  /**
   * Etapa 2 (dentro do modal de confirmação): Persiste no Firestore e exibe o Certificado SHA-256.
   */
  const handleFinalizeSignature = async () => {
    if (!pendingConfirm || submitting) return;
    setConfirmError(null);
    setSubmitting(true);

    const nowIso = new Date().toISOString();
    const meta: ClientSignaturePatchMeta = {
      ...pendingConfirm.meta,
      confirmadoLeituraEm: doc.confirmadoLeituraEm || nowIso,
    };

    try {
      if (pendingConfirm.mode === 'desenhar' || pendingConfirm.mode === 'digitar') {
        const dataUrl = pendingConfirm.signatureDataUrl || '';
        const check = validateAndNormalizeSignatureDataUrl(dataUrl);
        if (!check.valid) {
          setConfirmError(check.error || 'Assinatura inválida. Volte e desenhe novamente.');
          return;
        }
        await onSubmitDigitalSignature(doc, check.dataUrl, meta, nowIso);
        setPendingConfirm(null);
        setCompletedDoc({
          ...doc,
          status: 'Assinado',
          assinaturaDataUrl: check.dataUrl,
          assinadoEm: nowIso,
          ...meta,
        });
      } else if (pendingConfirm.file) {
        const uploadedUrl = await onSubmitSignedFile(doc, pendingConfirm.file, meta, nowIso);
        setPendingConfirm(null);
        setCompletedDoc({
          ...doc,
          status: 'Assinado',
          assinaturaUrl: typeof uploadedUrl === 'string' ? uploadedUrl : doc.assinaturaUrl,
          assinadoEm: nowIso,
          ...meta,
        });
      }
    } catch (err) {
      setConfirmError(
        err instanceof Error
          ? err.message
          : 'Não foi possível concluir a assinatura agora. Seus dados foram preservados; tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadSignedPdf = async (targetDoc: GeneratedDocument) => {
    if (!onDownloadPdf || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await onDownloadPdf(targetDoc);
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#071422]/80 backdrop-blur-[2px] flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-signature-modal-title"
    >
      <div className="relative bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden shadow-2xl">
        <BrandRibbon className="h-[3px] w-full shrink-0" />

        {/* Header institucional */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#0B1F33] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-wide text-[#E5C76B]">
              Formalização Eletrônica de Contrato
            </p>
            <h3
              id="contract-signature-modal-title"
              className="font-display text-sm sm:text-base font-bold text-white truncate mt-0.5"
            >
              {doc.titulo}
            </h3>
            <p className="text-[11px] font-mono tabular-nums text-slate-300 mt-0.5">
              Versão {doc.versao} · Cód. {doc.codigoVerificacao || doc.id}
              {contentHash ? ` · SHA-256 ${contentHash.slice(0, 8).toUpperCase()}…${contentHash.slice(-6).toUpperCase()}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDownloadPdf && !completedDoc && (
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={() => void handleDownloadSignedPdf(doc)}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-xs font-semibold text-white hover:bg-white/20 whitespace-nowrap disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {downloadingPdf ? 'Gerando...' : 'Baixar PDF'}
              </button>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={onClose}
              aria-label="Fechar janela de assinatura"
              className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Estado pós-assinatura concluída com Certificado Eletrônico */}
        {completedDoc ? (
          <div className="p-5 sm:p-8 overflow-y-auto space-y-6">
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-bold text-[#070E1C] dark:text-white">
                    Contrato assinado e formalizado com sucesso
                  </h4>
                  <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
                    Sua assinatura eletrônica foi registrada com selo criptográfico SHA-256 em{' '}
                    <strong className="font-mono tabular-nums text-[#070E1C] dark:text-white">
                      {formatDateTimeBR(completedDoc.assinadoEm)}
                    </strong>
                    . Uma cópia autenticada já está disponível no seu Portal do Cliente.
                  </p>
                </div>
              </div>

              <SignatureCertificateCard
                doc={completedDoc}
                fallbackSigner={{
                  nome: signerName,
                  email: defaultSignerEmail,
                  documento: signerDocument,
                }}
              />

              <div className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                {onDownloadPdf && (
                  <UiButton
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={downloadingPdf}
                    onClick={() => void handleDownloadSignedPdf(completedDoc)}
                  >
                    <Download className="w-4 h-4" />
                    {downloadingPdf ? 'Gerando PDF A4...' : 'Baixar Contrato Assinado (PDF A4)'}
                  </UiButton>
                )}
                <UiButton type="button" variant="outline" size="md" onClick={onClose}>
                  Concluir e Voltar ao Portal
                </UiButton>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Alternador mobile entre Leitura e Assinatura */}
            <div className="lg:hidden px-4 py-2.5 bg-[#F7F8FA] dark:bg-[#0B1220] border-b border-[#E5E7EB] dark:border-[#1E293B] shrink-0">
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-200/70 dark:bg-[#132035] rounded-lg">
                <button
                  type="button"
                  onClick={() => setMobilePane('contrato')}
                  className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    mobilePane === 'contrato'
                      ? 'bg-white dark:bg-[#0D1422] text-[#070E1C] dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  1. Ler Contrato ({readProgress}%)
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePane('assinar')}
                  className={`inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    mobilePane === 'assinar'
                      ? 'bg-white dark:bg-[#0D1422] text-[#070E1C] dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <FileSignature className="w-3.5 h-3.5" />
                  2. Assinar Agora
                </button>
              </div>
            </div>

            {/* Corpo principal 2 colunas no desktop */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Coluna Esquerda: Leitura integral do contrato */}
              <div
                className={`${
                  mobilePane === 'contrato' ? 'flex' : 'hidden'
                } lg:flex lg:col-span-7 flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#080E1A]`}
              >
                {/* Barra de progresso de leitura */}
                <div className="px-4 sm:px-6 py-2.5 bg-white dark:bg-[#0D1422] border-b border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-3 shrink-0">
                  <span className="text-xs font-semibold text-[#070E1C] dark:text-slate-100">
                    Revisão integral do documento
                  </span>
                  <div className="flex items-center gap-2.5">
                    <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-200 ${
                          reachedBottom ? 'bg-emerald-600' : 'bg-[#0F3D91]'
                        }`}
                        style={{ width: `${Math.max(8, readProgress)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {reachedBottom ? 'Leitura concluída' : `${readProgress}%`}
                    </span>
                  </div>
                </div>

                {/* Folha A4 rolável com enquadramento editorial */}
                <div
                  ref={contractScrollRef}
                  onScroll={handleContractScroll}
                  className="flex-1 overflow-y-auto p-4 sm:p-6"
                >
                  <ContractDocumentSheet
                    doc={doc}
                    empresa={empresa}
                    fallbackSigner={{
                      nome: signerName || defaultSignerName,
                      email: defaultSignerEmail,
                      documento: signerDocument || defaultSignerDocument,
                    }}
                    showClauseNav
                    showCertificate={false}
                    compactHeader
                  />
                </div>

                {/* Ação rápida no mobile para avançar para assinatura */}
                <div className="lg:hidden px-4 py-3 bg-white dark:bg-[#0D1422] border-t border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-2 shrink-0">
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {reachedBottom ? 'Contrato revisado.' : 'Role para revisar as cláusulas.'}
                  </span>
                  <UiButton type="button" size="sm" variant="primary" onClick={() => setMobilePane('assinar')}>
                    Ir para Assinatura
                  </UiButton>
                </div>
              </div>

              {/* Coluna Direita: Painel de Assinatura Eletrônica */}
              <div
                className={`${
                  mobilePane === 'assinar' ? 'flex' : 'hidden'
                } lg:flex lg:col-span-5 flex-col min-h-0 bg-white dark:bg-[#0D1422]`}
              >
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                  {/* Seletor de modalidade (controle segmentado) */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-[#070E1C] dark:text-slate-200">
                      Escolha como deseja assinar
                    </label>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-[#132035] rounded-lg">
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => {
                          setSignMode('desenhar');
                          setValidationError(null);
                        }}
                        className={`inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                          signMode === 'desenhar'
                            ? 'bg-white dark:bg-[#0D1422] text-[#070E1C] dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-[#070E1C]'
                        }`}
                      >
                        <PenTool className="w-3.5 h-3.5 shrink-0" />
                        Desenhar
                      </button>
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => {
                          setSignMode('digitar');
                          setValidationError(null);
                        }}
                        className={`inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                          signMode === 'digitar'
                            ? 'bg-white dark:bg-[#0D1422] text-[#070E1C] dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-[#070E1C]'
                        }`}
                      >
                        <Type className="w-3.5 h-3.5 shrink-0" />
                        Digitar
                      </button>
                      <button
                        type="button"
                        disabled={isWorking}
                        onClick={() => {
                          setSignMode('pdf');
                          setValidationError(null);
                        }}
                        className={`inline-flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                          signMode === 'pdf'
                            ? 'bg-white dark:bg-[#0D1422] text-[#070E1C] dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-300 hover:text-[#070E1C]'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5 shrink-0" />
                        Anexar PDF
                      </button>
                    </div>
                  </div>

                  {/* Identificação do Signatário */}
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[#070E1C] dark:text-slate-200">
                      Identificação do signatário
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label
                          htmlFor="signer-fullname"
                          className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                        >
                          Nome completo (como constará no certificado)
                        </label>
                        <input
                          id="signer-fullname"
                          type="text"
                          value={signerName}
                          disabled={isWorking}
                          onChange={(e) => setSignerName(e.target.value)}
                          placeholder="Ex.: Maria Clara Silva"
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-sm text-[#070E1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/30"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label
                            htmlFor="signer-doc"
                            className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1"
                          >
                            CPF ou Passaporte
                          </label>
                          <input
                            id="signer-doc"
                            type="text"
                            value={signerDocument}
                            disabled={isWorking}
                            onChange={(e) => setSignerDocument(e.target.value)}
                            placeholder="000.000.000-00"
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-mono text-[#070E1C] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/30"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                            Conta Google autenticada
                          </label>
                          <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0B1220]/70 text-xs font-mono text-slate-600 dark:text-slate-300 truncate">
                            {defaultSignerEmail || 'Sessão autenticada'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Área interativa do modo selecionado */}
                  {signMode === 'desenhar' && (
                    <div className="space-y-1.5">
                      <SignaturePadCanvas
                        disabled={isWorking}
                        hideSaveButton
                        onChange={(dataUrl) => {
                          setDrawnDataUrl(dataUrl);
                          if (dataUrl) setValidationError(null);
                        }}
                      />
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Use o mouse, trackpad ou dedo na tela para assinar com traço contínuo de alta precisão.
                      </p>
                    </div>
                  )}

                  {signMode === 'digitar' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                          Estilo caligráfico
                        </span>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTypedInk('#0B1F33')}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              typedInk === '#0B1F33'
                                ? 'bg-[#0B1F33] text-white border-[#0B1F33]'
                                : 'bg-white dark:bg-[#111C30] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            Preto
                          </button>
                          <button
                            type="button"
                            onClick={() => setTypedInk('#0F3D91')}
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                              typedInk === '#0F3D91'
                                ? 'bg-[#0F3D91] text-white border-[#0F3D91]'
                                : 'bg-white dark:bg-[#111C30] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                            }`}
                          >
                            Azul
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5">
                        {TYPED_SIGNATURE_STYLES.map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setTypedStyle(st.id)}
                            className={`p-2 rounded-lg border text-left transition-colors ${
                              typedStyle === st.id
                                ? 'border-[#0F3D91] bg-[#0F3D91]/5 dark:bg-[#0F3D91]/15'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#132035]'
                            }`}
                          >
                            <p className="text-[11px] font-semibold text-[#070E1C] dark:text-white truncate">
                              {st.label.split(' ')[0]}
                            </p>
                            <p
                              className="text-sm truncate mt-1"
                              style={{
                                fontFamily: st.cssFontFamily,
                                fontStyle: st.fontStyle,
                                color: typedInk,
                              }}
                            >
                              {signerName.trim() || 'Sua Assinatura'}
                            </p>
                          </button>
                        ))}
                      </div>

                      {/* Pré-visualização da assinatura tipográfica */}
                      <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white px-4 py-4 text-center space-y-1.5">
                        <p
                          className="text-3xl sm:text-4xl leading-snug break-words"
                          style={{
                            fontFamily: selectedTypedStyleObj.cssFontFamily,
                            fontStyle: selectedTypedStyleObj.fontStyle,
                            color: typedInk,
                          }}
                        >
                          {signerName.trim() || 'Digite seu nome completo acima'}
                        </p>
                        <div className="mx-auto max-w-[260px] border-t border-slate-300 pt-1 text-[10px] font-mono text-slate-500">
                          Prévia da assinatura ({selectedTypedStyleObj.label})
                        </div>
                      </div>
                    </div>
                  )}

                  {signMode === 'pdf' && (
                    <div className="space-y-3">
                      <label className="block rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-[#F7F8FA] dark:bg-[#0B1220] p-5 text-center cursor-pointer hover:border-[#0F3D91] transition-colors">
                        <Upload className="w-5 h-5 mx-auto text-[#0F3D91] dark:text-[#60A5FA] mb-2" />
                        <p className="text-xs font-semibold text-[#070E1C] dark:text-white">
                          {selectedFile ? selectedFile.name : 'Clique para selecionar o contrato assinado'}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                          {selectedFile
                            ? `${(selectedFile.size / 1024).toFixed(0)} KB · Pronto para envio`
                            : 'Aceita PDF assinado via Gov.br, Autentique ou cópia digitalizada (PDF, JPG, PNG até 10 MB).'}
                        </p>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          disabled={isWorking}
                          onChange={(e) => {
                            const f = e.target.files?.[0] || null;
                            setSelectedFile(f);
                            if (f) setValidationError(null);
                          }}
                        />
                      </label>

                      {doc.assinaturaLinkExterno && (
                        <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#111C30] flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-600 dark:text-slate-300">
                            Link externo de assinatura configurado:
                          </span>
                          <a
                            href={doc.assinaturaLinkExterno}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                          >
                            Abrir Gov.br / Externo
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Declaração legal obrigatória */}
                  <label className="flex items-start gap-2.5 p-3.5 rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={aceiteTermo}
                      disabled={isWorking}
                      onChange={(e) => {
                        setAceiteTermo(e.target.checked);
                        if (e.target.checked) setValidationError(null);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#0F3D91] focus:ring-[#0F3D91]"
                    />
                    <span className="text-xs text-[#334155] dark:text-slate-300 leading-relaxed">
                      Declaro que li integralmente o documento <strong>{doc.titulo}</strong> e concordo em formalizá-lo
                      por meio de assinatura eletrônica com registro de data, conta autenticada e selo SHA-256 (Lei nº
                      14.063/2020 e MP nº 2.200-2/2001).
                    </span>
                  </label>

                  {validationError && (
                    <div
                      role="alert"
                      className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs font-medium text-red-800 dark:text-red-300"
                    >
                      {validationError}
                    </div>
                  )}
                </div>

                {/* Rodapé fixo do painel de assinatura */}
                <div className="px-4 sm:px-5 py-3 border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] flex items-center justify-between gap-2 shrink-0">
                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>SHA-256 ativo</span>
                  </div>
                  <div className="flex items-center justify-end gap-2 w-full sm:w-auto">
                    <button
                      type="button"
                      disabled={isWorking}
                      onClick={onClose}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      Cancelar
                    </button>
                    <UiButton
                      type="button"
                      variant="primary"
                      size="sm"
                      className="!px-4 !py-2 whitespace-nowrap"
                      disabled={!canPrepareConfirmation}
                      onClick={() => void handleRequestConfirmationModal()}
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      Revisar e Assinar
                    </UiButton>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Modal de Confirmação Final antes de gravar no Firestore */}
        {pendingConfirm && !completedDoc && (
          <div
            className="absolute inset-0 z-30 bg-[#071422]/75 backdrop-blur-[2px] flex items-center justify-center p-4"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="signature-final-confirm-title"
          >
            <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
              <div className="px-5 py-4 bg-[#0B1F33] text-white flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-[#E5C76B]">Confirmação Obrigatória</p>
                  <h4 id="signature-final-confirm-title" className="text-sm sm:text-base font-bold text-white mt-0.5">
                    Confirmar formalização da assinatura
                  </h4>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setPendingConfirm(null);
                    setConfirmError(null);
                  }}
                  aria-label="Voltar para revisão"
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                  Verifique os dados abaixo antes de concluir. Após a confirmação, a assinatura será registrada com
                  validade jurídica, carimbo de data/hora e selo criptográfico SHA-256.
                </p>

                {/* Resumo estruturado */}
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B] text-xs">
                  <div className="sm:col-span-2">
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Documento</dt>
                    <dd className="font-semibold text-[#070E1C] dark:text-white mt-0.5">
                      {doc.titulo} <span className="font-mono text-slate-500">(v{doc.versao})</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Signatário</dt>
                    <dd className="font-semibold text-[#070E1C] dark:text-white mt-0.5 truncate">
                      {pendingConfirm.meta.assinadoPorNome}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">CPF / Passaporte</dt>
                    <dd className="font-mono text-[#070E1C] dark:text-slate-200 mt-0.5 truncate">
                      {pendingConfirm.meta.assinadoPorDocumento || 'Não informado'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Modalidade</dt>
                    <dd className="text-[#070E1C] dark:text-slate-200 mt-0.5">
                      {getSignatureMethodLabel(pendingConfirm.method)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Selo SHA-256</dt>
                    <dd className="font-mono tabular-nums text-[#070E1C] dark:text-slate-200 mt-0.5">
                      {formatSignatureHashShort(pendingConfirm.resolvedHash)}
                    </dd>
                  </div>
                </dl>

                {/* Prévia da assinatura capturada */}
                {pendingConfirm.signatureDataUrl ? (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Prévia da assinatura que será aplicada ao documento
                    </p>
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-3 flex items-center justify-center">
                      <img
                        src={pendingConfirm.signatureDataUrl}
                        alt="Prévia da assinatura capturada"
                        className="max-h-24 w-auto object-contain"
                      />
                    </div>
                  </div>
                ) : pendingConfirm.file ? (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F7F8FA] dark:bg-[#0B1220] text-xs flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#070E1C] dark:text-white truncate">
                      {pendingConfirm.file.name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                      {(pendingConfirm.file.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ) : null}

                {confirmError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs font-medium text-red-800 dark:text-red-300 flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{confirmError}</span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                  <UiButton
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                    onClick={() => {
                      setPendingConfirm(null);
                      setConfirmError(null);
                    }}
                  >
                    Voltar e Revisar
                  </UiButton>
                  <UiButton
                    type="button"
                    variant="primary"
                    size="sm"
                    disabled={submitting}
                    onClick={() => void handleFinalizeSignature()}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {submitting ? 'Registrando assinatura...' : 'Confirmar e Assinar Definitivamente'}
                  </UiButton>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
