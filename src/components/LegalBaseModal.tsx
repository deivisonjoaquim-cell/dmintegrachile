import React from 'react';
import { BookOpen, ExternalLink, FileText, X } from 'lucide-react';
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
              <article key={src.id} className="pb-5 border-b border-slate-200 last:border-b-0 last:pb-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{src.titulo}</h3>
                  {!clientFriendlyOnly && (
                    <span className="text-xs font-medium text-slate-600">
                      {src.pais} · {src.tipo} · {src.statusVigencia}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-500">
                  {src.numeroAno ? `${src.numeroAno} · ` : ''}
                  {clientFriendlyOnly
                    ? src.ultimaVerificacao
                      ? `Última revisão normativa em ${formatDateBR(src.ultimaVerificacao)}`
                      : 'Referência oficial SERMIG'
                    : `${src.orgaoEmissor}${src.artigos ? ` · ${src.artigos}` : ''}${
                        src.ultimaVerificacao ? ` · Revisado em ${formatDateBR(src.ultimaVerificacao)}` : ''
                      }`}
                </p>

                <p className="text-sm text-slate-700 leading-relaxed">
                  {clientFriendlyOnly ? src.explicacaoCliente : src.resumoPortugues || src.explicacaoCliente}
                </p>

                {!clientFriendlyOnly && src.artigosEstruturados && src.artigosEstruturados.length > 0 && (
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <p className="font-semibold text-slate-800">Artigos e dispositivos estruturados:</p>
                    {src.artigosEstruturados.map((art, i) => (
                      <p key={i} className="text-slate-700">
                        <strong>{art.numero}</strong>
                        {art.titulo ? ` (${art.titulo})` : ''}: {art.resumo}
                      </p>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  {src.linkOficial && (
                    <a
                      href={src.linkOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)] hover:underline"
                    >
                      Consultar fonte oficial
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {!clientFriendlyOnly && src.arquivoPdfUrl && (
                    <a
                      href={src.arquivoPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 hover:underline"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Abrir PDF normativo
                    </a>
                  )}
                </div>
              </article>
            ))
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            Referência oficial:{' '}
            <a
              href="https://serviciomigraciones.cl/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[var(--color-primary)] underline"
            >
              SERMIG (Servicio Nacional de Migraciones)
            </a>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-100"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
