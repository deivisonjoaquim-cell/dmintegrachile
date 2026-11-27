import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  Clock,
  CloudUpload,
  Download,
  Eye,
  FileCheck2,
  FileText,
  Scale,
  Search,
  ShieldCheck,
  Tag,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { CameraDocumentScannerModal } from '../CameraDocumentScannerModal';
import { auth, OperationType } from '../../firebase';
import { translateAppError } from '../../services/errorService';
import { updateClientPortalDocAudited } from '../../services/firestoreService';
import { uploadClientDocumentSecure } from '../../services/storageService';
import type {
  Case,
  CaseDocument,
  Client,
  Dependent,
  UserProfile,
  VisaRequirement,
} from '../../types/domain';
import {
  buildDocumentReviewMetadata,
  formatFileSizeBytes,
  formatReviewTagLabel,
  validateClientUploadFile,
} from '../../utils/documentUploadMetadata';
import { resolveDocumentExpiration } from '../../utils/documentExpiration';
import { sanitizeFirestoreData } from '../../utils/firestoreUtils';
import {
  formatDateBR,
  formatDateTimeBR,
  formatStandardDocFilename,
} from '../../utils/formatters';

function addDaysIso(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return isoDate;
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function isImageCaseDoc(d: Pick<CaseDocument, 'arquivoUrl' | 'arquivoMimeType' | 'arquivoNome'>): boolean {
  const url = (d.arquivoUrl || '').trim().toLowerCase();
  const mime = (d.arquivoMimeType || '').trim().toLowerCase();
  const name = (d.arquivoNome || '').trim().toLowerCase();
  if (mime.startsWith('image/')) return true;
  if (url.startsWith('data:image/')) return true;
  return /\.(webp|png|jpe?g|gif)(\?|#|$)/i.test(url) || /\.(webp|png|jpe?g|gif)$/i.test(name);
}

interface SecureDocumentUploadSectionProps {
  client: Client | null;
  activeCase: Case | null;
  docs: CaseDocument[];
  dependents: Dependent[];
  visaRequirements: VisaRequirement[];
  userProfile: UserProfile | null;
  onDocumentUploaded: () => Promise<void>;
  onOpenBiblioteca: () => void;
  onOpenLaw: () => void;
  onExportPdf: () => Promise<void>;
  pdfBusy: string | null;
}

type DocFilterKey = 'todos' | 'pendentes' | 'em_analise' | 'aprovados';

function getDocStatusMeta(status: CaseDocument['status']) {
  switch (status) {
    case 'Aprovado':
      return {
        label: 'Aprovado',
        colorClass: 'text-emerald-700',
        icon: CheckCircle2,
      };
    case 'Reprovado':
      return {
        label: 'Reprovado · Reenvio necessário',
        colorClass: 'text-red-700',
        icon: XCircle,
      };
    case 'Vencido':
      return {
        label: 'Vencido · Atualizar documento',
        colorClass: 'text-red-700',
        icon: AlertTriangle,
      };
    case 'Enviado':
      return {
        label: 'Enviado · Aguardando conferência',
        colorClass: 'text-sky-800',
        icon: Clock,
      };
    case 'Em análise':
      return {
        label: 'Em análise técnica',
        colorClass: 'text-amber-800',
        icon: Clock,
      };
    default:
      return {
        label: 'Pendente de envio',
        colorClass: 'text-slate-700',
        icon: Upload,
      };
  }
}

export const SecureDocumentUploadSection: React.FC<SecureDocumentUploadSectionProps> = ({
  client,
  activeCase,
  docs,
  dependents,
  visaRequirements,
  userProfile,
  onDocumentUploaded,
  onOpenBiblioteca,
  onOpenLaw,
  onExportPdf,
  pdfBusy,
}) => {
  const sortedDocs = useMemo(
    () => [...docs].sort((a, b) => a.ordemEmissao - b.ordemEmissao),
    [docs],
  );

  const defaultSelectedId = useMemo(() => {
    const priorityDoc = sortedDocs.find(
      (d) => d.status === 'Reprovado' || d.status === 'Vencido' || d.status === 'Pendente',
    );
    return priorityDoc?.id || sortedDocs[0]?.id || '';
  }, [sortedDocs]);

  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState<DocFilterKey>('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraTargetDoc, setCameraTargetDoc] = useState<CaseDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CaseDocument | null>(null);
  const dropInputRef = useRef<HTMLInputElement | null>(null);

  const effectiveSelectedId =
    selectedDocId && sortedDocs.some((d) => d.id === selectedDocId)
      ? selectedDocId
      : defaultSelectedId;

  const selectedDoc = useMemo(
    () => sortedDocs.find((d) => d.id === effectiveSelectedId) || null,
    [sortedDocs, effectiveSelectedId],
  );

  const evalByDocId = useMemo(
    () =>
      new Map(
        sortedDocs.map((d) => [
          d.id,
          resolveDocumentExpiration({
            doc: d,
            visaRequirements,
            client: client || undefined,
            dependents,
          }),
        ]),
      ),
    [sortedDocs, visaRequirements, client, dependents],
  );

  const expiringClientDocs = useMemo(
    () => sortedDocs.filter((d) => evalByDocId.get(d.id)?.isExpiringUnder30Days),
    [sortedDocs, evalByDocId],
  );

  const summaryCounts = useMemo(() => {
    const total = sortedDocs.length;
    const approved = sortedDocs.filter((d) => d.status === 'Aprovado').length;
    const inReview = sortedDocs.filter((d) => d.status === 'Enviado' || d.status === 'Em análise').length;
    const pending = sortedDocs.filter(
      (d) => d.status === 'Pendente' || d.status === 'Reprovado' || d.status === 'Vencido',
    ).length;
    return { total, approved, inReview, pending };
  }, [sortedDocs]);

  const filteredDocs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return sortedDocs.filter((d) => {
      if (statusFilter === 'pendentes' && !['Pendente', 'Reprovado', 'Vencido'].includes(d.status)) {
        return false;
      }
      if (statusFilter === 'em_analise' && !['Enviado', 'Em análise'].includes(d.status)) {
        return false;
      }
      if (statusFilter === 'aprovados' && d.status !== 'Aprovado') {
        return false;
      }
      if (q) {
        const hay = `${d.nomeDocumento} ${d.categoriaDoc} ${d.pessoa} ${(d.metadataTags || []).join(' ')}`.toLowerCase();
        return hay.includes(q);
      }
      return true;
    });
  }, [sortedDocs, statusFilter, searchTerm]);

  const previewAutoTags = useMemo(() => {
    if (!selectedDoc) return [];
    const nextVersion = selectedDoc.arquivoUrl ? Math.max(1, selectedDoc.versao || 1) + 1 : Math.max(1, selectedDoc.versao || 1);
    const preview = buildDocumentReviewMetadata({
      doc: selectedDoc,
      file: { name: 'documento.pdf', type: 'application/pdf', size: 1024 },
      mimeType: 'application/pdf',
      nextVersion,
      uploadedByUid: userProfile?.uid || 'client',
      uploadedByEmail: userProfile?.email || client?.email || '',
    });
    return preview.metadataTags;
  }, [selectedDoc, userProfile, client]);

  const executeSecureUpload = async (targetDoc: CaseDocument, file: File, explicitIssueDate?: string) => {
    setUploadFeedback(null);
    const check = validateClientUploadFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });
    if (!check.valid) {
      setUploadFeedback({ type: 'error', text: check.error || 'Arquivo inválido.' });
      return;
    }

    setUploadingDocId(targetDoc.id);
    setUploadProgress(5);

    try {
      const uploadRes = await uploadClientDocumentSecure({
        file,
        docItem: targetDoc,
        uploadedByUid: userProfile?.uid || client?.userId || 'cliente',
        uploadedByEmail: userProfile?.email || client?.email || '',
        onProgress: (pct) => setUploadProgress(pct),
      });

      const prevHist = (targetDoc.historicoVersoes || []).slice(-6);
      const safePrevUrl =
        targetDoc.arquivoUrl && !targetDoc.arquivoUrl.startsWith('data:')
          ? targetDoc.arquivoUrl
          : '';
      const nextHist = targetDoc.arquivoUrl
        ? [
            ...prevHist,
            {
              versao: targetDoc.versao || 1,
              arquivoUrl: safePrevUrl,
              data: uploadRes.uploadedAt,
              motivo: targetDoc.motivoReprovacao || 'Substituído pelo cliente',
            },
          ]
        : prevHist;

      const resolvedIssueDate = (explicitIssueDate || targetDoc.dataEmissao || '').trim();
      const resolvedExpirationDate =
        resolvedIssueDate && targetDoc.validadeDias > 0
          ? addDaysIso(resolvedIssueDate, targetDoc.validadeDias)
          : targetDoc.dataValidadeCalculada;

      const signedInUid = auth.currentUser?.uid || userProfile?.uid || undefined;

      const firestorePatch = sanitizeFirestoreData({
        arquivoUrl: uploadRes.downloadUrl,
        arquivoNome: uploadRes.arquivoNome,
        storagePath: uploadRes.storagePath,
        arquivoMimeType: uploadRes.arquivoMimeType,
        arquivoTamanhoBytes: uploadRes.arquivoTamanhoBytes,
        storageBackend: uploadRes.storageBackend,
        metadataTags: uploadRes.metadataTags,
        reviewMetadata: uploadRes.reviewMetadata,
        enviadoPorUid: signedInUid,
        enviadoEm: uploadRes.uploadedAt,
        status: 'Enviado' as const,
        etapaEsteira: '2 Recebido/Triagem' as const,
        dataEmissao: resolvedIssueDate || undefined,
        dataValidadeCalculada: resolvedExpirationDate || undefined,
        versao: uploadRes.nextVersion,
        historicoVersoes: nextHist,
        updatedAt: uploadRes.uploadedAt,
      });

      await updateClientPortalDocAudited(
        'caseDocuments',
        targetDoc.id,
        firestorePatch,
        'upload_documento_cliente',
        { status: targetDoc.status, versao: targetDoc.versao },
      );

      setIssueDate('');
      setUploadFeedback({
        type: 'success',
        text: `Documento "${targetDoc.nomeDocumento}" enviado com sucesso (v${uploadRes.nextVersion}, ${formatFileSizeBytes(uploadRes.arquivoTamanhoBytes)}) e marcado automaticamente para revisão técnica.`,
      });
      await onDocumentUploaded();
    } catch (err) {
      const translated = translateAppError(err, {
        source: 'client-document-upload',
        path: `caseDocuments/${targetDoc.id}`,
        operation: OperationType.UPDATE,
      });
      setUploadFeedback({
        type: 'error',
        text: `${translated.title}: ${translated.message}`,
      });
    } finally {
      setUploadingDocId(null);
      setUploadProgress(0);
    }
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && selectedDoc) {
      void executeSecureUpload(selectedDoc, droppedFile, issueDate);
    }
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho e métricas rápidas */}
      <section className="bg-white border border-[#E5DFD2] rounded-2xl p-5 sm:p-6 space-y-5 shadow-[0_2px_10px_rgba(11,31,51,0.03)]">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <p className="brand-kicker">
              Envio seguro · Cofre Documental · Revisão técnica automatizada
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-[#0B1F33] font-brand-sans mt-0.5">
              Central de Documentos do Processo
            </h2>
            <p className="text-xs text-[#4A5A6D] mt-1 max-w-2xl leading-relaxed">
              Envie arquivos PDF, JPG, PNG ou WEBP de até 10 MB. Cada documento recebe metadados automáticos de prioridade, categoria, versão e requisitos de apostila/tradução para agilizar a conferência da equipe.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print shrink-0">
            <button
              type="button"
              disabled={pdfBusy !== null}
              onClick={() => void onExportPdf()}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-lg border border-[#DDD6C7] bg-white text-xs font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-[#8C6D14]" aria-hidden="true" />
              {pdfBusy === 'progresso' ? 'Gerando PDF...' : 'Exportar Relatório (PDF)'}
            </button>
            <button
              type="button"
              onClick={onOpenBiblioteca}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-lg border border-[#DDD6C7] bg-white text-xs font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] whitespace-nowrap shrink-0"
            >
              <Scale className="w-3.5 h-3.5 text-[#0B1F33]" aria-hidden="true" />
              Biblioteca Legal
            </button>
            <button
              type="button"
              onClick={onOpenLaw}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-lg border border-[#DDD6C7] bg-white text-xs font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] whitespace-nowrap shrink-0"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#0B1F33]" aria-hidden="true" />
              Entenda a Lei
            </button>
          </div>
        </div>

        {/* Faixa de indicadores (single-elevation) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-[#F1EDE4]">
          <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2]">
            <p className="text-xs text-[#4A5A6D]">Total do checklist</p>
            <p className="text-xl font-bold font-mono text-[#0B1F33] tabular-nums mt-0.5">{summaryCounts.total}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2]">
            <p className="text-xs text-[#4A5A6D]">Aprovados</p>
            <p className="text-xl font-bold font-mono text-[#146B43] tabular-nums mt-0.5">{summaryCounts.approved}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2]">
            <p className="text-xs text-[#4A5A6D]">Em conferência</p>
            <p className="text-xl font-bold font-mono text-[#0B1F33] tabular-nums mt-0.5">{summaryCounts.inReview}</p>
          </div>
          <div className="p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2]">
            <p className="text-xs text-[#4A5A6D]">Pendentes / Ajustes</p>
            <p className="text-xl font-bold font-mono text-[#8C6D14] tabular-nums mt-0.5">{summaryCounts.pending}</p>
          </div>
        </div>

        {/* Alerta de vencimentos curtos (< 30 dias) */}
        {expiringClientDocs.length > 0 && (
          <div
            role="region"
            aria-label="Lembretes de vencimento dos documentos"
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-2.5"
          >
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs space-y-0.5">
              <p className="font-semibold text-[#0B1F33]">
                Atenção de validade: {expiringClientDocs.length} documento(s) vence(m) em menos de 30 dias
              </p>
              <p className="text-slate-700">
                {expiringClientDocs
                  .map((d) => `${d.nomeDocumento} (${evalByDocId.get(d.id)?.statusLabel})`)
                  .join(' · ')}
              </p>
            </div>
          </div>
        )}

        {/* Área dedicada de envio seguro (Drag & Drop) */}
        {sortedDocs.length > 0 && (
          <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] p-4 sm:p-5 space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#146B43] shrink-0" aria-hidden="true" />
                <h3 className="text-sm font-bold text-[#0B1F33]">
                  Enviar documento com validação e etiquetagem automática
                </h3>
              </div>
              {activeCase?.titulo && (
                <span className="text-xs text-slate-500">Processo: {activeCase.titulo}</span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label
                  htmlFor="portal-upload-doc-select"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  1. Selecione o documento do checklist
                </label>
                <select
                  id="portal-upload-doc-select"
                  value={effectiveSelectedId}
                  onChange={(e) => {
                    setSelectedDocId(e.target.value);
                    setUploadFeedback(null);
                  }}
                  disabled={uploadingDocId !== null}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {sortedDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      #{d.ordemEmissao} · {d.nomeDocumento} ({d.pessoa}) — {d.status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="portal-upload-issue-date"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  2. Data de emissão (opcional)
                </label>
                <input
                  id="portal-upload-issue-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  disabled={uploadingDocId !== null}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>

            {selectedDoc && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDropFile}
                className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                  dragActive
                    ? 'border-[var(--color-primary)] bg-sky-50/60'
                    : 'border-slate-300 bg-white hover:border-slate-400'
                }`}
              >
                <CloudUpload className="w-7 h-7 mx-auto text-slate-500 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-slate-900">
                  Arraste o arquivo aqui ou selecione no dispositivo
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Destino: <strong>{selectedDoc.nomeDocumento}</strong> ({selectedDoc.pessoa}) · PDF, JPG, PNG ou WEBP até 10 MB
                </p>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={uploadingDocId !== null}
                    onClick={() => dropInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <Upload className="w-4 h-4" aria-hidden="true" />
                    {uploadingDocId === selectedDoc.id
                      ? `Enviando... ${uploadProgress}%`
                      : selectedDoc.arquivoUrl
                        ? 'Substituir arquivo enviado'
                        : 'Escolher arquivo para envio'}
                  </button>
                  {userProfile && (
                    <button
                      type="button"
                      disabled={uploadingDocId !== null}
                      onClick={() => {
                        setCameraTargetDoc(selectedDoc);
                        setCameraModalOpen(true);
                      }}
                      className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      <Camera className="w-4 h-4 text-[#8C6D14]" aria-hidden="true" />
                      Escanear com Câmera
                    </button>
                  )}
                  <input
                    ref={dropInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && selectedDoc) {
                        void executeSecureUpload(selectedDoc, file, issueDate);
                      }
                      e.target.value = '';
                    }}
                  />
                </div>

                {/* Barra de progresso ao vivo */}
                {uploadingDocId !== null && (
                  <div className="mt-4 max-w-md mx-auto space-y-1.5" role="status" aria-live="polite">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Enviando arquivo e gravando metadados de revisão...</span>
                      <span className="tabular-nums">{uploadProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${Math.max(5, uploadProgress)}%`,
                          backgroundColor: 'var(--color-primary)',
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Prévia dos metadados automáticos aplicados ao envio */}
                {previewAutoTags.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 text-left flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                      <Tag className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      Etiquetas automáticas para revisão interna:
                    </span>
                    <span>
                      {previewAutoTags.map((tag) => formatReviewTagLabel(tag)).join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {uploadFeedback && (
              <div
                role={uploadFeedback.type === 'error' ? 'alert' : 'status'}
                className={`rounded-lg border px-4 py-3 text-xs flex items-start gap-2 ${
                  uploadFeedback.type === 'success'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                    : 'border-red-300 bg-red-50 text-red-950'
                }`}
              >
                {uploadFeedback.type === 'success' ? (
                  <FileCheck2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span className="leading-relaxed">{uploadFeedback.text}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Lista estruturada do checklist com busca, filtro e envio direto por linha */}
      <section className="bg-white border border-[#E5DFD2] rounded-2xl p-5 sm:p-6 space-y-4 shadow-[0_2px_10px_rgba(11,31,51,0.03)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[#0B1F33]">Relação Priorizada de Documentos</h3>
            <p className="text-xs text-[#4A5A6D]">
              Siga a ordem sugerida para preservar documentos com validade curta (ex.: Antecedentes de 60 dias).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 no-print">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrar documento..."
                aria-label="Filtrar documentos"
                className="pl-8 pr-3 min-h-[40px] rounded-lg border border-[#DDD6C7] bg-white text-xs text-[#0B1F33] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            {(
              [
                { key: 'todos', label: `Todos (${summaryCounts.total})` },
                { key: 'pendentes', label: `Pendentes (${summaryCounts.pending})` },
                { key: 'em_analise', label: `Em análise (${summaryCounts.inReview})` },
                { key: 'aprovados', label: `Aprovados (${summaryCounts.approved})` },
              ] as { key: DocFilterKey; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStatusFilter(opt.key)}
                className={`px-3 min-h-[40px] rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums transition-colors ${
                  statusFilter === opt.key
                    ? 'bg-[#0B1F33] text-white border-[#0B1F33]'
                    : 'bg-white text-[#0B1F33] border-[#DDD6C7] hover:bg-[#FAF9F6]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {sortedDocs.length === 0 ? (
          <p className="text-sm text-slate-600 py-8 text-center">
            Nenhum item documental gerado ainda para este processo.
          </p>
        ) : filteredDocs.length === 0 ? (
          <p className="text-sm text-slate-600 py-8 text-center">
            Nenhum documento encontrado para o filtro aplicado.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredDocs.map((d) => {
              const statusMeta = getDocStatusMeta(d.status);
              const StatusIcon = statusMeta.icon;
              const expEval = evalByDocId.get(d.id);
              const isExpiring = Boolean(expEval?.isExpiringUnder30Days);
              const isCritical = expEval?.severity === 'vencido' || expEval?.severity === 'critico';
              const suggestedName = formatStandardDocFilename(d.pessoa, d.nomeDocumento, d.dataEmissao, 'pdf');
              const isUploadingThis = uploadingDocId === d.id;

              const isImgDoc = Boolean(d.arquivoUrl && isImageCaseDoc(d));

              return (
                <div key={d.id} className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {isImgDoc && d.arquivoUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(d)}
                        title={`Visualizar ${d.nomeDocumento}`}
                        className="w-20 h-16 sm:w-24 sm:h-20 rounded-lg overflow-hidden border border-slate-200 bg-slate-900 shrink-0 group relative focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                      >
                        <img
                          src={d.arquivoUrl}
                          alt={d.nomeDocumento}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <span className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/35 transition-colors flex items-center justify-center">
                          <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </button>
                    )}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <p className="text-xs text-slate-500 tabular-nums">
                        Ordem #{d.ordemEmissao} · {d.pessoa} · {d.categoriaDoc}
                        {d.obrigatorio ? ' · Obrigatório' : ' · Opcional'}
                        {d.prazoSugeridoEmissao ? ` · Emitir até ${formatDateBR(d.prazoSugeridoEmissao)}` : ''}
                      </p>
                      <p className="text-sm font-bold text-slate-900">{d.nomeDocumento}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className={`inline-flex items-center gap-1.5 font-semibold ${statusMeta.colorClass}`}>
                        <StatusIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{statusMeta.label}</span>
                      </span>
                      <span className="text-slate-500 tabular-nums">
                        Etapa: {d.etapaEsteira} · Versão {d.versao}
                      </span>
                      {d.arquivoTamanhoBytes && (
                        <span className="text-slate-500 tabular-nums">
                          {formatFileSizeBytes(d.arquivoTamanhoBytes)}
                        </span>
                      )}
                      {d.enviadoEm && (
                        <span className="text-slate-500 tabular-nums">
                          Enviado em {formatDateTimeBR(d.enviadoEm)}
                        </span>
                      )}
                    </div>

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

                    {d.metadataTags && d.metadataTags.length > 0 && (
                      <p className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                        <Tag className="w-3 h-3 text-slate-400 shrink-0" aria-hidden="true" />
                        <span>
                          {d.metadataTags.map((t) => formatReviewTagLabel(t)).join(' · ')}
                        </span>
                      </p>
                    )}

                    <p className="text-[11px] text-slate-400 truncate">
                      {d.arquivoNome ? `Arquivo enviado: ${d.arquivoNome}` : `Nome sugerido: ${suggestedName}`}
                    </p>

                    {d.motivoReprovacao && (
                      <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
                        Motivo da pendência: {d.motivoReprovacao}
                      </p>
                    )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
                    {d.arquivoUrl && (
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(d)}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#0B1F33]" aria-hidden="true" />
                        Ver enviado
                      </button>
                    )}
                    {userProfile && (
                      <button
                        type="button"
                        disabled={uploadingDocId !== null}
                        onClick={() => {
                          setSelectedDocId(d.id);
                          setCameraTargetDoc(d);
                          setCameraModalOpen(true);
                        }}
                        title="Escanear documento com a câmera e salvar no perfil"
                        className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#8C6D14]" aria-hidden="true" />
                        Câmera
                      </button>
                    )}
                    <label className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-lg text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0" style={{ backgroundColor: 'var(--color-primary)' }}>
                      <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                      {isUploadingThis
                        ? `Enviando ${uploadProgress}%`
                        : d.arquivoUrl
                          ? 'Enviar nova versão'
                          : 'Enviar arquivo'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        className="hidden"
                        disabled={uploadingDocId !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setSelectedDocId(d.id);
                            void executeSecureUpload(d, file);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {previewDoc && previewDoc.arquivoUrl && (
        <div
          className="fixed inset-0 z-50 bg-[#071422]/85 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#0B1F33] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">
                  {previewDoc.pessoa} · {previewDoc.categoriaDoc} · v{previewDoc.versao}
                </p>
                <h4 className="font-display text-base font-bold text-white truncate mt-0.5">
                  {previewDoc.nomeDocumento}
                </h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewDoc.arquivoUrl}
                  download={
                    previewDoc.arquivoNome ||
                    formatStandardDocFilename(
                      previewDoc.pessoa,
                      previewDoc.nomeDocumento,
                      previewDoc.dataEmissao,
                      isImageCaseDoc(previewDoc) ? 'webp' : 'pdf',
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C8A236] hover:bg-[#B89228] text-xs font-bold text-[#0B1523] whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar arquivo
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  aria-label="Fechar visualização"
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 bg-[#071422] flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
              {isImageCaseDoc(previewDoc) ? (
                <img
                  src={previewDoc.arquivoUrl}
                  alt={previewDoc.nomeDocumento}
                  className="max-h-[66vh] w-auto object-contain rounded-lg border border-white/15 shadow-xl"
                />
              ) : (
                <iframe
                  src={previewDoc.arquivoUrl}
                  title={previewDoc.nomeDocumento}
                  className="w-full h-[66vh] rounded-lg bg-white border border-white/15"
                />
              )}
            </div>
            <div className="px-5 py-3 bg-[#FAF9F6] border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-mono">
              <span className="truncate">{previewDoc.arquivoNome || previewDoc.nomeDocumento}</span>
              <span className="tabular-nums">
                {previewDoc.arquivoTamanhoBytes ? `${formatFileSizeBytes(previewDoc.arquivoTamanhoBytes)} · ` : ''}
                {previewDoc.enviadoEm ? `Enviado em ${formatDateTimeBR(previewDoc.enviadoEm)}` : `Status: ${previewDoc.status}`}
              </span>
            </div>
          </div>
        </div>
      )}

      {userProfile && (
        <CameraDocumentScannerModal
          open={cameraModalOpen}
          onClose={() => {
            setCameraModalOpen(false);
            setCameraTargetDoc(null);
          }}
          userProfile={userProfile}
          initialMode="camera"
          caseDocumentTargetName={cameraTargetDoc?.nomeDocumento}
          onSaved={async (savedDoc, scannedFile, alsoAttachToCase) => {
            const targetDoc = cameraTargetDoc;
            setCameraModalOpen(false);
            setCameraTargetDoc(null);
            if (alsoAttachToCase && scannedFile && targetDoc) {
              await executeSecureUpload(targetDoc, scannedFile, issueDate);
            } else {
              setUploadFeedback({
                type: 'success',
                text: `Documento "${savedDoc.title}" escaneado e salvo diretamente no seu perfil no Firestore. Ele já aparece no seu Cofre de Identidade acima.`,
              });
            }
          }}
        />
      )}
    </div>
  );
};
