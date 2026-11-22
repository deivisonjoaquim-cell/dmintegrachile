import React from 'react';
import { BookOpen, ExternalLink, FileText, X } from 'lucide-react';
import type { LegalSource } from '../types/domain';
import { formatDateBR } from '../utils/formatters';
import { getJurisdictionLabel, getJurisdictionTextClass } from '../utils/legalJurisdiction';
import { BrandRibbon } from './BrandLogo';

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
      className="fixed inset-0 z-50 bg-[#071320]/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        <BrandRibbon className="h-[2.5px] w-full" />
        <div className="bg-[#0B1F33] text-white flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-[#E5C76B]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#E5C76B]">
                Marco Normativo · Brasil &amp; Chile
              </p>
              <h2 className="font-display text-lg font-bold text-white truncate">{title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar base legal"
            className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {sources.length === 0 ? (
            <p className="text-sm text-[#4A5A6D] dark:text-slate-400">Nenhuma norma vinculada ainda. Fonte a cadastrar pela equipe técnica.</p>
          ) : (
            sources.map((src) => (
              <article key={src.id} className="pb-5 border-b border-[#E5DFD2] dark:border-[#1C324B] last:border-b-0 last:pb-0 space-y-2">
                <div className="space-y-1">
                  <p className="text-xs text-[#4A5A6D] dark:text-slate-400">
                    <span className={getJurisdictionTextClass(src.pais)}>{getJurisdictionLabel(src.pais)}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{src.tipo}</span>
                    {!clientFriendlyOnly && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span>{src.statusVigencia}</span>
                      </>
                    )}
                  </p>
                  <h3 className="text-base font-bold text-[#0B1F33] dark:text-slate-100">{src.titulo}</h3>
                </div>

                <p className="text-xs text-[#4A5A6D] dark:text-slate-400 tabular-nums">
                  {src.numeroAno ? `${src.numeroAno} · ` : ''}
                  {clientFriendlyOnly
                    ? src.ultimaVerificacao
                      ? `Última revisão normativa em ${formatDateBR(src.ultimaVerificacao)}`
                      : `Referência oficial (${getJurisdictionLabel(src.pais)})`
                    : `${src.orgaoEmissor}${src.artigos ? ` · ${src.artigos}` : ''}${
                        src.ultimaVerificacao ? ` · Revisado em ${formatDateBR(src.ultimaVerificacao)}` : ''
                      }`}
                </p>

                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  {clientFriendlyOnly ? src.explicacaoCliente : src.resumoPortugues || src.explicacaoCliente}
                </p>

                {!clientFriendlyOnly && src.artigosEstruturados && src.artigosEstruturados.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FAF9F6] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] space-y-1.5 text-xs">
                    <p className="font-semibold text-[#0B1F33] dark:text-slate-200">Artigos e dispositivos estruturados:</p>
                    {src.artigosEstruturados.map((art, i) => (
                      <p key={i} className="text-slate-700 dark:text-slate-300">
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
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F33] dark:text-[#E5C76B] hover:underline"
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
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4A5A6D] dark:text-slate-300 hover:underline"
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

        <div className="px-6 py-3.5 border-t border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#081726] flex flex-wrap items-center justify-between gap-2 text-xs text-[#4A5A6D] dark:text-slate-400">
          <span>
            Referência oficial:{' '}
            <a
              href="https://serviciomigraciones.cl/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-[#0B1F33] dark:text-[#E5C76B] underline"
            >
              SERMIG (Servicio Nacional de Migraciones)
            </a>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#11263D] font-semibold text-[#0B1F33] dark:text-slate-100 hover:bg-[#F1EDE4] dark:hover:bg-[#17304D] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
