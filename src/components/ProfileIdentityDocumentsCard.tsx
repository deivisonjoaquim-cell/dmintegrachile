import React, { useEffect, useState } from 'react';
import {
  Camera,
  Check,
  Download,
  Edit3,
  Eye,
  EyeOff,
  FileImage,
  Loader2,
  ScanLine,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { BrandRibbon } from './BrandLogo';
import { CameraDocumentScannerModal } from './CameraDocumentScannerModal';
import { translateAppError } from '../services/errorService';
import {
  deleteUserIdentityDocument,
  subscribeUserIdentityDocuments,
  updateUserIdentityDocumentMetadata,
} from '../services/identityDocumentService';
import type { IdentityDocumentType, UserIdentityDocument, UserProfile } from '../types/domain';
import { formatFileSizeBytes } from '../utils/documentUploadMetadata';
import { formatDateBR, formatDateTimeBR } from '../utils/formatters';
import {
  getIdentityDocTypeMeta,
  IDENTITY_DOC_TYPE_OPTIONS,
  maskDocumentNumber,
} from '../utils/identityDocumentScan';

interface ProfileIdentityDocumentsCardProps {
  userProfile: UserProfile;
  /** Optional override when staff (admin/consultor) inspects a client's profile-stored IDs in read-only mode */
  targetUid?: string;
  readOnly?: boolean;
  compact?: boolean;
  title?: string;
  subtitle?: string;
}

export const ProfileIdentityDocumentsCard: React.FC<ProfileIdentityDocumentsCardProps> = ({
  userProfile,
  targetUid,
  readOnly = false,
  compact = false,
  title = 'Documentos de Identificação no Perfil',
  subtitle = 'Escaneie passaporte, RG/CIN, CNH ou Cédula Chilena diretamente com sua câmera para manter uma cópia segura no seu perfil no Firestore.',
}) => {
  const effectiveUid = targetUid || userProfile.uid;

  const [docs, setDocs] = useState<UserIdentityDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<'camera' | 'upload'>('camera');

  const [previewDoc, setPreviewDoc] = useState<UserIdentityDocument | null>(null);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit metadata modal state
  const [editingDoc, setEditingDoc] = useState<UserIdentityDocument | null>(null);
  const [editDocType, setEditDocType] = useState<IdentityDocumentType>('passaporte');
  const [editTitle, setEditTitle] = useState('');
  const [editNumber, setEditNumber] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editExpiration, setEditExpiration] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!effectiveUid) {
      setDocs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    const unsub = subscribeUserIdentityDocuments(
      effectiveUid,
      (items) => {
        setDocs(items);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        const translated = translateAppError(err, {
          source: 'profile-identity-docs-list',
          path: `users/${effectiveUid}/identityDocuments`,
        });
        setErrorMsg(`${translated.title}: ${translated.message}`);
      },
    );
    return () => unsub();
  }, [effectiveUid]);

  const openScanner = (mode: 'camera' | 'upload') => {
    setSuccessMsg(null);
    setErrorMsg(null);
    setScannerMode(mode);
    setScannerOpen(true);
  };

  const handleOpenEdit = (item: UserIdentityDocument) => {
    setEditingDoc(item);
    setEditDocType(item.docType);
    setEditTitle(item.title);
    setEditNumber(item.documentNumber || '');
    setEditCountry(item.issuingCountry || '');
    setEditExpiration(item.expirationDate || '');
    setEditNotes(item.notes || '');
    setErrorMsg(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc || savingEdit) return;
    setSavingEdit(true);
    setErrorMsg(null);
    try {
      await updateUserIdentityDocumentMetadata(
        effectiveUid,
        editingDoc,
        {
          docType: editDocType,
          title: editTitle,
          documentNumber: editNumber,
          issuingCountry: editCountry,
          expirationDate: editExpiration,
          notes: editNotes,
        },
        userProfile.role,
      );
      setSuccessMsg(`Dados de "${editTitle.trim()}" atualizados no seu perfil.`);
      setEditingDoc(null);
    } catch (err) {
      const translated = translateAppError(err, {
        source: 'profile-identity-docs-update',
        path: `users/${effectiveUid}/identityDocuments/${editingDoc.id}`,
      });
      setErrorMsg(`${translated.title}: ${translated.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async (item: UserIdentityDocument) => {
    if (deletingId) return;
    setDeletingId(item.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await deleteUserIdentityDocument(effectiveUid, item.id, userProfile.role);
      setConfirmDeleteId(null);
      if (previewDoc?.id === item.id) {
        setPreviewDoc(null);
      }
      setSuccessMsg(`Documento "${item.title}" removido do seu perfil.`);
    } catch (err) {
      const translated = translateAppError(err, {
        source: 'profile-identity-docs-delete',
        path: `users/${effectiveUid}/identityDocuments/${item.id}`,
      });
      setErrorMsg(`${translated.title}: ${translated.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = (item: UserIdentityDocument) => {
    const a = document.createElement('a');
    a.href = item.imageDataUrl;
    a.download = item.fileName || `${item.docType}.webp`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <section
      className={`bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl ${
        compact ? 'p-4 sm:p-5' : 'p-5 sm:p-6'
      } space-y-4 shadow-[0_2px_10px_rgba(11,31,51,0.03)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)] text-left`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C6D14] dark:text-[#E5C76B] flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            Cofre Privado · Câmera &amp; Firestore
          </p>
          <h3 className="font-display text-lg sm:text-xl font-bold text-[#0B1F33] dark:text-white leading-snug">
            {title}
          </h3>
          <p className="text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        </div>

        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openScanner('camera')}
              className="inline-flex items-center gap-2 px-4 min-h-[42px] rounded-lg bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1523] text-xs font-bold hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <Camera className="w-4 h-4 text-[#E5C76B] dark:text-[#0B1523]" />
              Escanear com Câmera
            </button>
            <button
              type="button"
              onClick={() => openScanner('upload')}
              className="inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 hover:bg-white dark:hover:bg-[#16304C] whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
              Enviar foto
            </button>
          </div>
        )}
      </div>

      {/* Feedback alerts */}
      {successMsg && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/35 px-3.5 py-2.5 text-xs text-emerald-950 dark:text-emerald-200 flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#146B43] dark:text-emerald-400 shrink-0" />
            {successMsg}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            aria-label="Fechar mensagem"
            className="text-emerald-800 dark:text-emerald-300 hover:opacity-75"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/35 px-3.5 py-2.5 text-xs text-[#A61C2B] dark:text-red-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-xs text-[#4A5A6D] dark:text-slate-300">
          <Loader2 className="w-4 h-4 animate-spin text-[#8C6D14] dark:text-[#E5C76B]" />
          Carregando documentos salvos no perfil...
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D]/60 p-6 text-center space-y-3">
          <div className="w-11 h-11 rounded-xl bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] mx-auto flex items-center justify-center text-[#8C6D14] dark:text-[#E5C76B]">
            <ScanLine className="w-5 h-5" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <p className="text-sm font-bold text-[#0B1F33] dark:text-white">
              Nenhum documento de identificação salvo no perfil ainda
            </p>
            <p className="text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
              {readOnly
                ? 'Este cliente ainda não digitalizou documentos de identificação no perfil.'
                : 'Use a câmera do seu celular ou computador para escanear Passaporte, RG/CIN, CNH ou Cédula Chilena com otimização automática de nitidez.'}
            </p>
          </div>
          {!readOnly && (
            <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => openScanner('camera')}
                className="inline-flex items-center gap-2 px-4 min-h-[40px] rounded-lg bg-[#C8A236] hover:bg-[#B89228] text-xs font-bold text-[#0B1523] transition-colors"
              >
                <Camera className="w-4 h-4" />
                Digitalizar primeiro documento
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`grid grid-cols-1 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-2'} gap-4`}>
          {docs.map((item) => {
            const meta = getIdentityDocTypeMeta(item.docType);
            const isRevealed = Boolean(revealedIds[item.id]);
            const isConfirmingDelete = confirmDeleteId === item.id;
            const isDeleting = deletingId === item.id;

            return (
              <article
                key={item.id}
                className="rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#11263D] overflow-hidden flex flex-col justify-between"
              >
                <div className="flex gap-3.5 p-3.5">
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(item)}
                    className="w-24 h-20 sm:w-28 sm:h-22 rounded-lg overflow-hidden border border-[#E5DFD2] dark:border-[#243E5C] bg-[#071422] shrink-0 group relative focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                    title="Ampliar documento"
                  >
                    <img
                      src={item.imageDataUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <span className="absolute inset-0 bg-[#071422]/0 group-hover:bg-[#071422]/35 transition-colors flex items-center justify-center">
                      <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </span>
                  </button>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C6D14] dark:text-[#E5C76B] truncate">
                        {meta.shortLabel}
                        {item.issuingCountry ? ` · ${item.issuingCountry}` : ''}
                      </span>
                      <span className="text-[10px] font-mono text-[#4A5A6D] dark:text-slate-400 shrink-0">
                        {item.captureMethod === 'camera' ? 'Câmera' : 'Upload'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-[#0B1F33] dark:text-white leading-snug line-clamp-2">
                      {item.title}
                    </h4>

                    {item.documentNumber && (
                      <div className="flex items-center gap-1.5 text-xs font-mono text-[#0B1F33] dark:text-slate-200">
                        <span className="truncate">
                          Nº {isRevealed ? item.documentNumber : maskDocumentNumber(item.documentNumber)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setRevealedIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                          }
                          aria-label={isRevealed ? 'Ocultar número do documento' : 'Mostrar número do documento'}
                          className="p-0.5 text-[#4A5A6D] dark:text-slate-400 hover:text-[#0B1F33] dark:hover:text-white"
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 font-mono tabular-nums">
                      {item.expirationDate ? `Validade ${formatDateBR(item.expirationDate)} · ` : ''}
                      {formatFileSizeBytes(item.sizeBytes)} · {formatDateTimeBR(item.createdAt)}
                    </p>

                    {item.notes && (
                      <p className="text-[11px] text-[#4A5A6D] dark:text-slate-300 line-clamp-1">
                        {item.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Action strip */}
                <div className="px-3.5 py-2.5 bg-white dark:bg-[#0D1E31] border-t border-[#E5DFD2] dark:border-[#1C324B] flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#DDD6C7] dark:border-[#243E5C] text-[11px] font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#16304C]"
                    >
                      <FileImage className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
                      Ampliar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#DDD6C7] dark:border-[#243E5C] text-[11px] font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#16304C]"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Baixar
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-[#DDD6C7] dark:border-[#243E5C] text-[11px] font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#FAF9F6] dark:hover:bg-[#16304C]"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    )}
                  </div>

                  {!readOnly && (
                    <div className="flex items-center gap-1.5">
                      {isConfirmingDelete ? (
                        <>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => void handleConfirmDelete(item)}
                            className="px-2.5 py-1.5 rounded-md bg-[#A61C2B] text-white text-[11px] font-semibold hover:opacity-95 disabled:opacity-50"
                          >
                            {isDeleting ? 'Removendo...' : 'Confirmar exclusão'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1.5 rounded-md border border-[#DDD6C7] dark:border-[#243E5C] text-[11px] font-semibold text-[#4A5A6D] dark:text-slate-300"
                          >
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label={`Excluir ${item.title}`}
                          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-[#A61C2B] dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Camera Scanner Modal */}
      {!readOnly && (
        <CameraDocumentScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          userProfile={userProfile}
          initialMode={scannerMode}
          onSaved={(saved) => {
            setSuccessMsg(`"${saved.title}" digitalizado e armazenado com segurança no seu perfil.`);
          }}
        />
      )}

      {/* Lightbox Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-[#071422]/85 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <BrandRibbon className="h-[3px] w-full shrink-0" />
            <div className="px-5 py-4 bg-[#0B1F33] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">
                  {getIdentityDocTypeMeta(previewDoc.docType).label}
                </p>
                <h4 className="font-display text-base font-bold text-white truncate mt-0.5">
                  {previewDoc.title}
                </h4>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(previewDoc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C8A236] hover:bg-[#B89228] text-xs font-bold text-[#0B1523]"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar
                </button>
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
            <div className="p-4 sm:p-6 bg-[#071422] flex-1 overflow-auto flex items-center justify-center">
              <img
                src={previewDoc.imageDataUrl}
                alt={previewDoc.title}
                className="max-h-[65vh] w-auto object-contain rounded-lg border border-white/15 shadow-xl"
              />
            </div>
            <div className="px-5 py-3 bg-[#FAF9F6] dark:bg-[#081524] border-t border-[#E5DFD2] dark:border-[#1C324B] flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A5A6D] dark:text-slate-300 font-mono">
              <span>
                {previewDoc.documentNumber ? `Nº ${previewDoc.documentNumber} · ` : ''}
                {previewDoc.issuingCountry || 'País não informado'}
                {previewDoc.expirationDate ? ` · Validade ${formatDateBR(previewDoc.expirationDate)}` : ''}
              </span>
              <span>
                {formatFileSizeBytes(previewDoc.sizeBytes)} · Salvo em {formatDateTimeBR(previewDoc.createdAt)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingDoc && !readOnly && (
        <div
          className="fixed inset-0 z-50 bg-[#071422]/80 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEdit}
            className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
          >
            <BrandRibbon className="h-[3px] w-full" />
            <div className="px-5 py-4 bg-[#0B1F33] text-white flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">
                  Editar Metadados
                </p>
                <h4 className="font-display text-base font-bold text-white mt-0.5">
                  Atualizar Documento no Perfil
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                aria-label="Fechar edição"
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                  Tipo de documento
                </label>
                <select
                  value={editDocType}
                  onChange={(e) => setEditDocType(e.target.value as IdentityDocumentType)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white"
                >
                  {IDENTITY_DOC_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                  Título *
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={140}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    Número do documento
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={editNumber}
                    onChange={(e) => setEditNumber(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm font-mono text-[#0B1F33] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    País emissor
                  </label>
                  <input
                    type="text"
                    maxLength={60}
                    value={editCountry}
                    onChange={(e) => setEditCountry(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                  Data de validade
                </label>
                <input
                  type="date"
                  value={editExpiration}
                  onChange={(e) => setEditExpiration(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm font-mono text-[#0B1F33] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-[#FAF9F6] dark:bg-[#081524] border-t border-[#E5DFD2] dark:border-[#1C324B] flex justify-end gap-2">
              <button
                type="button"
                disabled={savingEdit}
                onClick={() => setEditingDoc(null)}
                className="px-4 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] text-xs font-semibold text-[#4A5A6D] dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 rounded-lg bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1523] text-xs font-bold disabled:opacity-50"
              >
                {savingEdit ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
};
