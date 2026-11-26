import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, FileWarning, Trash2, Upload } from 'lucide-react';
import {
  SERMIG_MAX_FILE_BYTES,
  SERMIG_PF_MAX_AGE_DAYS,
  validateSermigAttachmentFile,
  type SermigDocumentSlot,
  type SermigUploadedAttachment,
} from '../../utils/sermigSimulator';

interface SermigDocumentUploaderProps {
  slots: SermigDocumentSlot[];
  attachments: Record<string, SermigUploadedAttachment>;
  onChangeAttachment: (slotId: string, attachment: SermigUploadedAttachment | null) => void;
  onAttachAllDemoValid: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function daysOld(iso?: string): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const now = new Date();
  const fromUtc = Date.UTC(y, m - 1, d);
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((nowUtc - fromUtc) / 86_400_000);
}

export const SermigDocumentUploader: React.FC<SermigDocumentUploaderProps> = ({
  slots,
  attachments,
  onChangeAttachment,
  onAttachAllDemoValid,
}) => {
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});

  const handleRealFileSelect = (slot: SermigDocumentSlot, file?: File) => {
    if (!file) return;
    const check = validateSermigAttachmentFile(
      { name: file.name, size: file.size, type: file.type },
      slot,
    );
    if (!check.ok) {
      setSlotErrors((prev) => ({ ...prev, [slot.id]: check.error || 'Arquivo inválido.' }));
      return;
    }
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slot.id];
      return next;
    });
    const recentIso = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    onChangeAttachment(slot.id, {
      slotId: slot.id,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || (slot.accepts === 'image' ? 'image/jpeg' : 'application/pdf'),
      simulatedSample: false,
      dataEmissao: slot.isAntecedentesPf ? recentIso : undefined,
      apostilaConfirmada: slot.exigeApostila,
      traducaoConfirmada: slot.exigeTraducao,
      attachedAtIso: new Date().toISOString(),
    });
  };

  const handleAttachSample = (slot: SermigDocumentSlot) => {
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slot.id];
      return next;
    });
    const isImage = slot.accepts === 'image';
    const recentIso = new Date(Date.now() - 12 * 86_400_000).toISOString().slice(0, 10);
    onChangeAttachment(slot.id, {
      slotId: slot.id,
      fileName: isImage ? 'foto_carnet_fondo_blanco_treino.jpg' : `${slot.id.replace('slot_', '')}_apostilado_treino.pdf`,
      fileSizeBytes: isImage ? 420_000 : 1_180_000,
      mimeType: isImage ? 'image/jpeg' : 'application/pdf',
      simulatedSample: true,
      dataEmissao: slot.isAntecedentesPf ? recentIso : undefined,
      apostilaConfirmada: slot.exigeApostila,
      traducaoConfirmada: slot.exigeTraducao,
      attachedAtIso: new Date().toISOString(),
    });
  };

  const handleTestOversizedError = (slot: SermigDocumentSlot) => {
    const check = validateSermigAttachmentFile(
      { name: 'documento_muito_pesado.pdf', size: SERMIG_MAX_FILE_BYTES + 2_400_000, type: 'application/pdf' },
      slot,
    );
    setSlotErrors((prev) => ({
      ...prev,
      [slot.id]: check.error || 'Arquivo excede o limite de 5 MB.',
    }));
  };

  const attachedCount = slots.filter((s) => Boolean(attachments[s.id])).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div>
          <h4 className="text-base font-bold text-[#0F172A] dark:text-white">
            Carga de Antecedentes y Documentos Adjuntos
          </h4>
          <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
            Anexe arquivos reais para testar validação local (nada sai do seu navegador) ou use os PDFs de treino ·{' '}
            <span className="font-mono font-semibold tabular-nums text-[#0039A6] dark:text-blue-400">
              {attachedCount}/{slots.length} anexados
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onAttachAllDemoValid}
          className="px-3.5 py-2 rounded-lg border border-[#0039A6]/30 dark:border-blue-500/40 bg-[#EFF6FF] dark:bg-blue-950/30 text-xs font-semibold text-[#0039A6] dark:text-blue-300 hover:bg-blue-100/70 dark:hover:bg-blue-950/50 transition-colors whitespace-nowrap"
        >
          Anexar todos os PDFs de treino
        </button>
      </div>

      <div className="space-y-4">
        {slots.map((slot) => {
          const att = attachments[slot.id];
          const err = slotErrors[slot.id];
          const pfAge = slot.isAntecedentesPf && att?.dataEmissao ? daysOld(att.dataEmissao) : null;
          const pfExpired = pfAge !== null && pfAge > SERMIG_PF_MAX_AGE_DAYS;

          return (
            <div
              key={slot.id}
              className={`rounded-xl border p-4 space-y-3 transition-colors ${
                pfExpired || err
                  ? 'border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20'
                  : att
                    ? 'border-emerald-300 dark:border-emerald-800/70 bg-emerald-50/30 dark:bg-emerald-950/15'
                    : 'border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC]/70 dark:bg-[#0B1320]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#64748B] dark:text-slate-400">
                    <span className="font-mono font-semibold text-[#0039A6] dark:text-blue-400">
                      {slot.codigoCampoSermig}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{slot.obrigatorio ? 'Obligatorio' : 'Opcional'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {slot.accepts === 'image' ? 'JPG/PNG' : slot.accepts === 'pdf' ? 'PDF' : 'PDF/JPG/PNG'} máx.{' '}
                      {slot.maxSizeMb} MB
                    </span>
                    {slot.exigeApostila && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#0F172A] dark:text-slate-200">Apostila CNJ</span>
                      </>
                    )}
                    {typeof slot.validadeDias === 'number' && slot.validadeDias > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">Validade {slot.validadeDias}d</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm font-bold text-[#0F172A] dark:text-white leading-snug">
                    {slot.nombreEspanol}
                  </p>
                  <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                    {slot.descripcionGuia}
                  </p>
                </div>

                {att && (
                  <button
                    type="button"
                    onClick={() => onChangeAttachment(slot.id, null)}
                    aria-label={`Remover anexo de ${slot.nombrePortugues}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    Remover
                  </button>
                )}
              </div>

              {err && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2"
                >
                  <FileWarning className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{err}</span>
                </div>
              )}

              {!att ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0039A6] hover:bg-[#002F87] text-white text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                    Adjuntar archivo ({slot.accepts === 'image' ? 'JPG/PNG' : 'PDF'})
                    <input
                      type="file"
                      className="sr-only"
                      accept={slot.accepts === 'image' ? '.jpg,.jpeg,.png' : slot.accepts === 'pdf' ? '.pdf' : '.pdf,.jpg,.jpeg,.png'}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        handleRealFileSelect(slot, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAttachSample(slot)}
                    className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] bg-white dark:bg-[#131F33] text-xs font-semibold text-[#0F172A] dark:text-slate-100 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors whitespace-nowrap"
                  >
                    Usar arquivo de treino
                  </button>
                  {slot.isAntecedentesPf && (
                    <button
                      type="button"
                      onClick={() => handleTestOversizedError(slot)}
                      className="px-3 py-2 rounded-lg text-xs font-medium text-[#64748B] dark:text-slate-400 hover:text-rose-700 dark:hover:text-rose-300 underline underline-offset-2 whitespace-nowrap"
                    >
                      Testar erro (&gt; 5 MB)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                      <FileText className="w-3.5 h-3.5 text-[#64748B] shrink-0" aria-hidden="true" />
                      <span className="font-medium text-[#0F172A] dark:text-slate-100 truncate">
                        {att.fileName}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-[#64748B] dark:text-slate-400 tabular-nums shrink-0">
                      {formatFileSize(att.fileSizeBytes)} · {att.simulatedSample ? 'Treino' : 'Arquivo local'}
                    </span>
                  </div>

                  {/* Controles específicos de conformidade SERMIG (Data PF 60d + Apostila CNJ) */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    {slot.isAntecedentesPf && (
                      <div className="flex flex-wrap items-center gap-2">
                        <label
                          htmlFor={`pf-date-${slot.id}`}
                          className="font-semibold text-[#0F172A] dark:text-slate-200"
                        >
                          Fecha de emisión (PF):
                        </label>
                        <input
                          id={`pf-date-${slot.id}`}
                          type="date"
                          value={att.dataEmissao || ''}
                          onChange={(e) =>
                            onChangeAttachment(slot.id, {
                              ...att,
                              dataEmissao: e.target.value,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] bg-white dark:bg-[#090F1A] font-mono text-xs text-[#0F172A] dark:text-slate-100"
                        />
                        {pfAge !== null && (
                          <span
                            className={`font-mono text-[11px] font-semibold tabular-nums ${
                              pfExpired
                                ? 'text-rose-700 dark:text-rose-300'
                                : pfAge > 45
                                  ? 'text-amber-700 dark:text-amber-300'
                                  : 'text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {pfAge} dia(s) · {pfExpired ? 'VENCIDA (> 60d)' : 'Dentro dos 60d'}
                          </span>
                        )}
                      </div>
                    )}

                    {slot.exigeApostila && (
                      <label className="inline-flex items-center gap-2 cursor-pointer text-[#334155] dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={Boolean(att.apostilaConfirmada)}
                          onChange={(e) =>
                            onChangeAttachment(slot.id, {
                              ...att,
                              apostilaConfirmada: e.target.checked,
                            })
                          }
                          className="rounded border-slate-300 accent-[#0039A6]"
                        />
                        <span>Contém Apostila de Haia (CNJ) no mesmo PDF</span>
                      </label>
                    )}
                  </div>

                  {pfExpired && (
                    <div
                      role="alert"
                      className="p-2.5 rounded-lg bg-rose-100/70 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2"
                    >
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>
                        Atenção: Certidão da Polícia Federal emitida há mais de 60 dias será rejeitada no SERMIG.
                        Altere a data acima para uma emissão recente para simular o envio regular.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
