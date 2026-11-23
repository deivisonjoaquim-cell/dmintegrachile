import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { auth } from '../../firebase';
import {
  deleteMediaAssetAdmin,
  fetchMediaAssetsStaff,
  makeId,
  saveMediaAssetAdmin,
} from '../../services/firestoreService';
import type { MediaAsset, UserRole } from '../../types/domain';
import {
  BUILT_IN_MEDIA_GALLERY,
  MediaAssetPreset,
  processImportedImageFile,
} from '../../utils/mediaImport';
import { resolveOptimizedImageSources } from '../../utils/imageOptimization';
import { UiButton, UiModal } from '../ui/DesignSystem';

interface MediaAssetPickerProps {
  label: string;
  value: string;
  onChange: (nextUrl: string) => void;
  preset?: MediaAssetPreset;
  hint?: string;
  role?: UserRole;
  actorEmail?: string;
  compact?: boolean;
}

export function MediaAssetPicker({
  label,
  value,
  onChange,
  preset = 'geral',
  hint,
  role = 'admin',
  actorEmail,
  compact = false,
}: MediaAssetPickerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [previewBg, setPreviewBg] = useState<'claro' | 'escuro' | 'xadrez'>(
    preset === 'logo' ? 'xadrez' : 'claro',
  );
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [serverMedia, setServerMedia] = useState<{ filename: string; url: string; size: number; createdAt: string }[]>([]);
  const [loadingLib, setLoadingLib] = useState(false);
  const [libFilter, setLibFilter] = useState<'todos' | MediaAssetPreset>('todos');

  const loadLibrary = async () => {
    setLoadingLib(true);
    try {
      const firestoreAssets = await fetchMediaAssetsStaff();
      setAssets(firestoreAssets);
      const user = auth.currentUser;
      if (user) {
        const token = await user.getIdToken();
        const resp = await fetch('/api/media', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const json = (await resp.json()) as {
            files?: { filename: string; url: string; size: number; createdAt: string }[];
          };
          setServerMedia(json.files || []);
        }
      }
    } catch {
      // ignore non-fatal media gallery error
    } finally {
      setLoadingLib(false);
    }
  };

  useEffect(() => {
    if (libraryOpen) {
      void loadLibrary();
    }
  }, [libraryOpen]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setErrorMsg('');
    setUploading(true);
    try {
      const processed = await processImportedImageFile(file, preset);
      onChange(processed.url);

      if (role === 'admin') {
        const asset: MediaAsset = {
          id: makeId('media'),
          nome: processed.nome.slice(0, 180),
          categoria: preset,
          mimeType: processed.mimeType,
          url: processed.url,
          largura: processed.largura,
          altura: processed.altura,
          tamanhoBytes: processed.tamanhoBytes,
          uploadedBy: actorEmail || 'admin',
          createdAt: new Date().toISOString(),
        };
        await saveMediaAssetAdmin(asset, role).catch(() => {});
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao importar imagem.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          const dt = new DataTransfer();
          dt.items.add(file);
          void handleFiles(dt.files);
          return;
        }
      }
    }
  };

  const handleDeleteAsset = async (asset: MediaAsset) => {
    try {
      await deleteMediaAssetAdmin(asset, role);
      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao remover mídia.');
    }
  };

  const handleDeleteServerMedia = async (filename: string, url: string) => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      await fetch(`/api/media/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setServerMedia((prev) => prev.filter((f) => f.url !== url));
    } catch {
      // ignore
    }
  };

  const previewBgClass =
    previewBg === 'escuro'
      ? 'bg-[#0F2537]'
      : previewBg === 'xadrez'
        ? 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:12px_12px] bg-slate-100'
        : 'bg-white';

  const filteredAssets = libFilter === 'todos' ? assets : assets.filter((a) => a.categoria === libFilter);
  const filteredBuiltIn =
    libFilter === 'todos'
      ? BUILT_IN_MEDIA_GALLERY
      : BUILT_IN_MEDIA_GALLERY.filter((b) => b.categoria === libFilter);

  return (
    <div
      onPaste={handlePaste}
      className="rounded-lg border border-slate-200 bg-white p-3.5 transition-colors focus-within:border-slate-400"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <span className="text-xs font-semibold text-slate-800">{label}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {value && (
            <>
              <div className="inline-flex flex-wrap rounded border border-slate-200 bg-slate-50 p-0.5 text-[10px] max-w-full">
                <button
                  type="button"
                  onClick={() => setPreviewBg('claro')}
                  className={`px-1.5 py-0.5 rounded-sm ${previewBg === 'claro' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500'}`}
                >
                  Claro
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('escuro')}
                  className={`px-1.5 py-0.5 rounded-sm ${previewBg === 'escuro' ? 'bg-slate-800 text-white font-semibold' : 'text-slate-500'}`}
                >
                  Escuro
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewBg('xadrez')}
                  className={`px-1.5 py-0.5 rounded-sm ${previewBg === 'xadrez' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-500'}`}
                >
                  Grade
                </button>
              </div>
              <button
                type="button"
                onClick={() => onChange('')}
                title="Remover imagem"
                className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100"
              >
                <X className="h-3 w-3" /> Limpar
              </button>
            </>
          )}
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'sm:grid-cols-[160px_1fr]'}`}>
        {/* Visual Preview Box */}
        <div
          className={`relative flex items-center justify-center overflow-hidden rounded-md border border-slate-200 ${previewBgClass} ${
            compact ? 'h-24' : 'h-28'
          }`}
        >
          {value ? (() => {
            const optimized = resolveOptimizedImageSources(value);
            return (
              <picture className="flex h-full w-full items-center justify-center">
                {optimized.webpSrcSet && (
                  <source srcSet={optimized.webpSrcSet} sizes="180px" type="image/webp" />
                )}
                <img
                  src={value}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  className={`max-h-full max-w-full ${
                    preset === 'logo' || preset === 'favicon' ? 'object-contain p-2.5' : 'h-full w-full object-cover'
                  }`}
                />
              </picture>
            );
          })() : (
            <div className="flex flex-col items-center justify-center gap-1 text-slate-400 text-[11px] px-2 text-center">
              <ImageIcon className="h-5 w-5" />
              <span>Sem imagem</span>
            </div>
          )}
        </div>

        {/* Dropzone + Controls */}
        <div className="flex flex-col justify-between gap-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFiles(e.dataTransfer.files);
            }}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2.5 text-xs transition-colors ${
              dragging
                ? 'border-[var(--color-primary)] bg-slate-50'
                : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
            }`}
          >
            <div className="flex items-center gap-2 text-slate-600">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin text-slate-700 shrink-0" />
              ) : (
                <Upload className="h-4 w-4 text-slate-500 shrink-0" />
              )}
              <span className="leading-snug">
                {uploading ? 'Otimizando e importando...' : 'Arraste, cole (Ctrl+V) ou selecione (PNG, JPG, WEBP, SVG, ICO)'}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,.ico,image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                className="hidden"
                onChange={(e) => void handleFiles(e.target.files)}
              />
              <UiButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> Importar arquivo
              </UiButton>
              <UiButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLibraryOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" /> Biblioteca
              </UiButton>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={value.startsWith('data:') ? '(Imagem importada e salva no banco)' : value}
              onChange={(e) => {
                if (!e.target.value.startsWith('(Imagem importada')) {
                  onChange(e.target.value);
                }
              }}
              readOnly={value.startsWith('data:')}
              placeholder="Ou cole a URL pública (https://... ou /src/assets/...)"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:border-[var(--color-primary)] focus:outline-none"
            />
          </div>
          {hint && <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>}
          {errorMsg && <p className="text-[11px] font-medium text-red-600">{errorMsg}</p>}
        </div>
      </div>

      <UiModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Biblioteca de Mídias, Logos & Banners"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'logo', label: 'Logos' },
                  { id: 'favicon', label: 'Favicons' },
                  { id: 'banner', label: 'Banners & Capas' },
                  { id: 'equipe', label: 'Equipe' },
                  { id: 'geral', label: 'Geral' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLibFilter(tab.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    libFilter === tab.id
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <UiButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" /> Subir nova mídia
            </UiButton>
          </div>

          {loadingLib ? (
            <div className="flex items-center justify-center py-10 text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando biblioteca...
            </div>
          ) : (
            <div className="space-y-5">
              {/* Imported Assets in Firestore */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Mídias Importadas ({filteredAssets.length})
                </h4>
                {filteredAssets.length === 0 ? (
                  <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-200 p-4">
                    Nenhuma mídia importada nesta categoria ainda. Importe um arquivo para salvá-lo aqui.
                  </p>
                ) : (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                    {filteredAssets.map((asset) => {
                      const selected = value === asset.url;
                      return (
                        <div
                          key={asset.id}
                          className={`group rounded-lg border overflow-hidden bg-white transition-all ${
                            selected ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onChange(asset.url);
                              setLibraryOpen(false);
                            }}
                            className="w-full text-left"
                          >
                            <div className="h-24 w-full bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:10px_10px] bg-slate-50 flex items-center justify-center overflow-hidden">
                              <img
                                src={asset.url}
                                alt={asset.nome}
                                loading="lazy"
                                decoding="async"
                                className={
                                  asset.categoria === 'logo' || asset.categoria === 'favicon'
                                    ? 'max-h-full max-w-full object-contain p-2'
                                    : 'h-full w-full object-cover'
                                }
                              />
                            </div>
                            <div className="p-2">
                              <p className="truncate text-xs font-medium text-slate-800">{asset.nome}</p>
                              <p className="text-[10px] text-slate-500">
                                {asset.largura ? `${asset.largura}×${asset.altura} · ` : ''}
                                {Math.max(1, Math.round(asset.tamanhoBytes / 1024))} KB
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center justify-between border-t border-slate-100 px-2 py-1 bg-slate-50/70">
                            <span className="text-[10px] uppercase text-slate-500">{asset.categoria}</span>
                            <div className="flex items-center gap-1">
                              {selected && <Check className="h-3.5 w-3.5 text-emerald-600" />}
                              {role === 'admin' && (
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteAsset(asset)}
                                  title="Excluir mídia"
                                  className="text-slate-400 hover:text-red-600 p-0.5"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Built-in Gallery */}
              {filteredBuiltIn.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Galeria Institucional Inclusa
                  </h4>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                    {filteredBuiltIn.map((item) => {
                      const selected = value === item.url;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onChange(item.url);
                            setLibraryOpen(false);
                          }}
                          className={`rounded-lg border overflow-hidden bg-white text-left transition-all ${
                            selected ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className={`h-24 w-full overflow-hidden flex items-center justify-center ${
                              item.categoria === 'logo' || item.categoria === 'favicon'
                                ? item.id.includes('escur')
                                  ? 'bg-[#081726]'
                                  : 'bg-[#F7F5F0]'
                                : 'bg-slate-100'
                            }`}
                          >
                            {(() => {
                              const optimized = resolveOptimizedImageSources(item.url);
                              return (
                                <picture className="flex h-full w-full items-center justify-center">
                                  {optimized.webpSrcSet && (
                                    <source srcSet={optimized.webpSrcSet} sizes="220px" type="image/webp" />
                                  )}
                                  <img
                                    src={item.url}
                                    alt={item.nome}
                                    loading="lazy"
                                    decoding="async"
                                    className={
                                      item.categoria === 'logo' || item.categoria === 'favicon'
                                        ? 'max-h-full max-w-full object-contain p-2.5'
                                        : 'h-full w-full object-cover'
                                    }
                                  />
                                </picture>
                              );
                            })()}
                          </div>
                          <div className="p-2 flex items-center justify-between gap-1">
                            <span className="truncate text-xs font-medium text-slate-800">{item.nome}</span>
                            {selected && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Express Server Uploads fallback */}
              {serverMedia.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                    Arquivos no Servidor ({serverMedia.length})
                  </h4>
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                    {serverMedia.map((f) => {
                      const selected = value === f.url;
                      return (
                        <div
                          key={f.url}
                          className={`rounded-lg border overflow-hidden bg-white ${
                            selected ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20' : 'border-slate-200'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onChange(f.url);
                              setLibraryOpen(false);
                            }}
                            className="w-full text-left"
                          >
                            <div className="h-20 w-full bg-slate-50 flex items-center justify-center overflow-hidden">
                              <img
                                src={f.url}
                                alt={f.filename}
                                loading="lazy"
                                decoding="async"
                                className="max-h-full max-w-full object-contain p-1"
                              />
                            </div>
                            <div className="p-2">
                              <p className="truncate text-[11px] font-medium text-slate-700">{f.filename}</p>
                            </div>
                          </button>
                          {role === 'admin' && (
                            <div className="flex justify-end border-t border-slate-100 px-2 py-1">
                              <button
                                type="button"
                                onClick={() => void handleDeleteServerMedia(f.filename, f.url)}
                                className="text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </UiModal>
    </div>
  );
}
