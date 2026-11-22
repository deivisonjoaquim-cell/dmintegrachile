import React from 'react';
import { Download, FileText, X } from 'lucide-react';
import { BrandRibbon } from '../BrandLogo';

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
      className="fixed inset-0 z-50 bg-[#071320]/80 backdrop-blur-xs flex items-center justify-center p-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white dark:bg-[#0D1E31] rounded-2xl max-w-4xl w-full h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-[#E5DFD2] dark:border-[#1C324B]">
        <BrandRibbon className="h-[3px] w-full" />
        <div className="px-5 py-3.5 bg-[#0B1F33] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-[#E5C76B]" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{title}</p>
              <p className="text-[11px] font-mono text-slate-300 truncate">{filename}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#C8A236] hover:bg-[#d6b145] text-[#0B1523] whitespace-nowrap transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Baixar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar pré-visualização do PDF"
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/15 whitespace-nowrap transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Fechar
            </button>
          </div>
        </div>
        <div className="flex-1 bg-[#EFECE4] dark:bg-[#071320] p-2 sm:p-4">
          <iframe
            src={blobUrl}
            title={title}
            className="w-full h-full rounded-xl border border-[#DDD6C7] dark:border-[#1C324B] bg-white shadow-sm"
          />
        </div>
      </div>
    </div>
  );
};
