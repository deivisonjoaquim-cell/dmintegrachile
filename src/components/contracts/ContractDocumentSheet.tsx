import React, { useMemo, useState } from 'react';
import { FileText, Scale, ShieldCheck } from 'lucide-react';
import type { EmpresaConfig, GeneratedDocument } from '../../types/domain';
import { formatDateBR, formatDateTimeBR, sanitizeHtml } from '../../utils/formatters';
import { parseContractDocumentLayout } from '../../utils/contractDocumentLayout';
import { QrCodeSvg } from '../ui/DesignSystem';
import { SignatureCertificateCard } from './SignatureCertificateCard';

export interface ContractDocumentSheetProps {
  doc: Partial<GeneratedDocument> & { titulo: string; conteudoHtml: string };
  empresa: EmpresaConfig;
  fallbackSigner?: { nome?: string; email?: string; documento?: string };
  showClauseNav?: boolean;
  showCertificate?: boolean;
  compactHeader?: boolean;
}

/**
 * Folha A4 editorial bem enquadrada e distribuída para contratos e documentos oficiais.
 * Converte texto de contrato em blocos estruturados (cabeçalho institucional, quadro resumo,
 * qualificação das partes, cláusulas numeradas com índice rápido e bloco bilateral de assinaturas).
 */
export const ContractDocumentSheet: React.FC<ContractDocumentSheetProps> = ({
  doc,
  empresa,
  fallbackSigner,
  showClauseNav = true,
  showCertificate = true,
  compactHeader = false,
}) => {
  const [comfortableFont, setComfortableFont] = useState(false);

  const parsed = useMemo(
    () => parseContractDocumentLayout(doc.conteudoHtml, doc.titulo),
    [doc.conteudoHtml, doc.titulo],
  );

  const fallbackHtml = useMemo(() => sanitizeHtml(doc.conteudoHtml), [doc.conteudoHtml]);
  const hasStructuredLayout = parsed.clauses.length > 0 || parsed.parties.length > 0;
  const verificationCode = doc.codigoVerificacao || doc.id || 'D&M-OFICIAL';
  const statusLabel = doc.canceladoEm ? 'Cancelado' : doc.status || 'Disponível';

  const scrollToClause = (clauseId: string) => {
    const el = document.getElementById(`contract-sheet-${clauseId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <article
      data-testid="contract-document-sheet"
      className="bg-white border border-[#DED7C8] rounded-xl text-[#0B1F33] shadow-xs overflow-hidden"
    >
      {/* Faixa institucional superior tricolor */}
      <div className="h-1 w-full flex" aria-hidden="true">
        <span className="flex-1 bg-[#146B43]" />
        <span className="flex-1 bg-[#C8A236]" />
        <span className="flex-1 bg-[#0B1F33]" />
        <span className="flex-1 bg-[#A61C2B]" />
      </div>

      <div className={compactHeader ? 'p-5 sm:p-7 space-y-6' : 'p-6 sm:p-10 space-y-7'}>
        {/* Cabeçalho Institucional Enquadrado */}
        <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#E5DFD2]">
          <div className="space-y-1 min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-[#8C6D14]">
              Instrumento Oficial · Assessoria de Imigração (Visto &amp; RUT)
            </p>
            <h3 className="font-display text-base sm:text-lg font-bold text-[#0B1F33] leading-snug">
              {parsed.title}
            </h3>
            <p className="text-xs font-semibold text-[#0B1F33]">{empresa.nome_empresa}</p>
            <p className="text-[11px] font-mono text-[#4A5A6D]">
              {empresa.razao_social_cnpj_rut} · {empresa.endereco_cidade}
            </p>
            <p className="text-[11px] text-[#4A5A6D]">
              {empresa.email} · {empresa.whatsapp}
            </p>
          </div>
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
            <QrCodeSvg value={verificationCode} size={56} />
            <div className="text-right font-mono text-[10px] text-[#4A5A6D] tabular-nums space-y-0.5">
              <p className="font-bold text-[#0B1F33]">Cód. {verificationCode}</p>
              <p>
                v{doc.versao || 1} · {statusLabel}
              </p>
            </div>
          </div>
        </header>

        {doc.canceladoEm && (
          <div className="p-3 rounded-lg border border-[#C82333]/50 bg-[#FEF2F2] text-center text-xs font-bold text-[#991B1B]">
            DOCUMENTO CANCELADO — SEM VALIDADE JURÍDICA
            {doc.motivoCancelamento ? ` (${doc.motivoCancelamento})` : ''}
          </div>
        )}

        {/* Quadro Resumo Executivo do Documento */}
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-[#F8F6F1] border border-[#E5DFD2] text-xs">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold text-[#64748B]">Contratante / Titular</dt>
            <dd className="font-bold text-[#0B1F33] truncate mt-0.5">
              {doc.assinadoPorNome || fallbackSigner?.nome || 'Titular do Processo'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold text-[#64748B]">Escopo Direto</dt>
            <dd className="font-bold text-[#0B1F33] truncate mt-0.5">Visto (SERMIG) &amp; RUT</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold text-[#64748B]">Emissão</dt>
            <dd className="font-mono font-semibold text-[#0B1F33] tabular-nums mt-0.5">
              {doc.createdAt ? formatDateBR(doc.createdAt) : formatDateBR(new Date())}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold text-[#64748B]">Situação</dt>
            <dd className="font-bold text-[#0F3D91] mt-0.5">{statusLabel}</dd>
          </div>
        </dl>

        {/* Navegação rápida por cláusulas + ajuste de leitura confortável */}
        {showClauseNav && parsed.clauses.length > 1 && (
          <div className="no-print flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#ECE6DA]">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4A5A6D] mr-1">
                <FileText className="w-3.5 h-3.5 text-[#8C6D14]" aria-hidden="true" />
                Cláusulas:
              </span>
              {parsed.clauses.map((cl) => (
                <button
                  key={cl.id}
                  type="button"
                  onClick={() => scrollToClause(cl.id)}
                  className="px-2.5 py-1 rounded-md border border-[#E5DFD2] bg-[#FAF8F4] hover:border-[#0F3D91] hover:text-[#0F3D91] text-[11px] font-medium text-[#334155] transition-colors whitespace-nowrap"
                >
                  {cl.shortLabel}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setComfortableFont((v) => !v)}
              className="px-2.5 py-1 rounded-md border border-[#E5DFD2] bg-white hover:bg-[#FAF8F4] text-[11px] font-semibold text-[#0B1F33] whitespace-nowrap shrink-0"
            >
              {comfortableFont ? 'Fonte padrão' : 'Aumentar leitura'}
            </button>
          </div>
        )}

        {/* Corpo Estruturado ou Fallback HTML */}
        {hasStructuredLayout ? (
          <div className={`space-y-6 ${comfortableFont ? 'text-sm leading-[1.75]' : 'text-[13px] leading-[1.68]'}`}>
            {/* Preâmbulo */}
            {parsed.preamble.length > 0 && (
              <div className="space-y-2 text-[#1E293B]">
                {parsed.preamble.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            )}

            {/* Qualificação das Partes em 2 colunas bem distribuídas */}
            {parsed.parties.length > 0 && (
              <section aria-label="Qualificação das Partes" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {parsed.parties.map((party) => (
                  <div
                    key={party.role}
                    className="rounded-xl border border-[#E5DFD2] bg-[#FCFBF8] p-4 space-y-1.5"
                  >
                    <p className="text-[11px] font-bold tracking-[0.06em] text-[#8C6D14]">{party.role}</p>
                    <p className="text-xs text-[#0B1F33] leading-relaxed">{party.text}</p>
                  </div>
                ))}
              </section>
            )}

            {/* Cláusulas Numeradas */}
            <div className="space-y-5">
              {parsed.clauses.map((clause) => (
                <section
                  key={clause.id}
                  id={`contract-sheet-${clause.id}`}
                  className={
                    clause.isScopeTransparency
                      ? 'rounded-xl border border-[#D8C592] bg-[#FDF9EE] p-4 sm:p-5 space-y-2.5'
                      : 'space-y-2 pb-4 border-b border-[#F0ECE3] last:border-b-0 last:pb-0'
                  }
                >
                  <div className="flex items-start gap-2">
                    {clause.isScopeTransparency && (
                      <Scale className="w-4 h-4 text-[#8C6D14] shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <h4 className="text-xs sm:text-[13px] font-bold tracking-[0.02em] text-[#0B1F33]">
                      {clause.heading}
                    </h4>
                  </div>
                  <div className="space-y-2 text-[#1E293B] text-justify">
                    {clause.paragraphs.map((p, idx) => {
                      const isSubItem = /^\d+\.\d+\.?\s/.test(p);
                      return (
                        <p key={idx} className={isSubItem ? 'pl-2' : undefined}>
                          {p}
                        </p>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>

            {/* Fechamento (Local e Data) */}
            {parsed.closingDateLine && (
              <p className="text-xs font-semibold text-[#0B1F33] pt-2">{parsed.closingDateLine}</p>
            )}

            {/* Bloco Bilateral de Assinaturas Alinhado 50/50 */}
            <section
              aria-label="Bloco de Assinaturas"
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-[#E5DFD2] print-avoid-break"
            >
              <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF8F4] p-4 flex flex-col justify-between min-h-[124px]">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8C6D14]">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>CONTRATADO(A) · Consultoria</span>
                </div>
                <div className="pt-5">
                  <p className="font-display italic text-base text-[#0B1F33] leading-none mb-2">
                    {empresa.responsavel_tecnico.split('—')[0].trim() || empresa.nome_empresa}
                  </p>
                  <div className="border-t border-[#CBD5E1] pt-2">
                    <p className="text-xs font-bold text-[#0B1F33]">{empresa.nome_empresa}</p>
                    <p className="text-[11px] text-[#4A5A6D] mt-0.5">{empresa.razao_social_cnpj_rut}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF8F4] p-4 flex flex-col justify-between min-h-[124px]">
                <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#0F3D91]">
                  <span>CONTRATANTE · Titular</span>
                  {doc.assinadoEm && (
                    <span className="font-mono text-[10px] text-emerald-700 tabular-nums">
                      Assinado {formatDateTimeBR(doc.assinadoEm)}
                    </span>
                  )}
                </div>
                <div className="pt-3">
                  {doc.assinaturaDataUrl ? (
                    <img
                      src={doc.assinaturaDataUrl}
                      alt="Assinatura eletrônica do contratante"
                      className="h-12 max-w-full object-contain mb-1.5"
                    />
                  ) : (
                    <div className="h-10 flex items-end pb-1 text-[11px] italic text-[#94A3B8]">
                      Aguardando formalização eletrônica
                    </div>
                  )}
                  <div className="border-t border-[#CBD5E1] pt-2">
                    <p className="text-xs font-bold text-[#0B1F33]">
                      {doc.assinadoPorNome || fallbackSigner?.nome || 'Contratante'}
                    </p>
                    {(doc.assinadoPorDocumento || fallbackSigner?.documento) && (
                      <p className="text-[11px] font-mono text-[#4A5A6D] mt-0.5">
                        Doc.: {doc.assinadoPorDocumento || fallbackSigner?.documento}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div
            className="prose prose-sm max-w-none text-xs sm:text-[13px] text-[#0B1F33] whitespace-pre-wrap leading-relaxed"
            dangerouslySetInnerHTML={{ __html: fallbackHtml }}
          />
        )}

        {/* Certificado Criptográfico SHA-256 quando assinado ou leitura confirmada */}
        {showCertificate && (
          <SignatureCertificateCard doc={doc} fallbackSigner={fallbackSigner} />
        )}

        {/* Rodapé institucional do instrumento */}
        <footer className="pt-4 border-t border-[#E5DFD2] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-[#4A5A6D]">
          <p className="leading-relaxed">{empresa.avisoLegal}</p>
          <p className="font-mono tabular-nums whitespace-nowrap shrink-0">
            Cód. {verificationCode} · v{doc.versao || 1}
          </p>
        </footer>
      </div>
    </article>
  );
};
