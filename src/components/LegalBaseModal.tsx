import React from 'react';
import { BookOpen, ExternalLink, X } from 'lucide-react';
import type { LegalSource } from '../types/domain';
import { formatDateBR } from '../utils/formatters';

interface LegalBaseModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  sources: LegalSource[];
  clientFriendlyOnly?: boolean;
}

export const LegalBaseModal: React.FC<LegalBaseModalProps> = ({
  open,
  onClose,
  title = 'Base Legal Aplicável',
  sources,
  clientFriendlyOnly = false,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar base legal"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {sources.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhuma norma vinculada ainda. Fonte a cadastrar pela equipe técnica.</p>
          ) : (
            sources.map((src) => (
              <article key={src.id} className="pb-5 border-b border-slate-200 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h3 className="text-base font-semibold text-slate-900">{src.titulo}</h3>
                  {!clientFriendlyOnly && (
                    <span className="text-xs font-medium text-slate-600">
                      {src.pais} · {src.tipo} · {src.statusVigencia}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  {src.orgaoEmissor}
                  {src.artigos ? ` · ${src.artigos}` : ''}
                  {src.ultimaVerificacao ? ` · Revisado em ${formatDateBR(src.ultimaVerificacao)}` : ''}
                </p>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {clientFriendlyOnly ? src.explicacaoCliente : src.resumoPortugues || src.explicacaoCliente}
                </p>
                {src.linkOficial && (
                  <a
                    href={src.linkOficial}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline mt-2"
                  >
                    Consultar fonte oficial
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
