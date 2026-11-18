import React from 'react';
import { Download, FileText, X } from 'lucide-react';

interface PdfPreviewModalProps {
  open: boolean;
  title: string;
  filename: string;
  blobUrl: string | null;
  onClose: () => void;
  onDownload: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  open,
  title,
  filename,
  blobUrl,
  onClose,
  onDownload,
}) => {
  if (!open || !blobUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white rounded-2xl max-w-4xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileText className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{title}</p>
              <p className="text-[11px] text-slate-500 truncate">{filename}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Download className="w-3.5 h-3.5" />
              Baixar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar pré-visualização do PDF"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Fechar
            </button>
          </div>
        </div>
        <div className="flex-1 bg-slate-200 p-2 sm:p-4">
          <iframe
            src={blobUrl}
            title={title}
            className="w-full h-full rounded-lg border border-slate-300 bg-white"
          />
        </div>
      </div>
    </div>
  );
};
