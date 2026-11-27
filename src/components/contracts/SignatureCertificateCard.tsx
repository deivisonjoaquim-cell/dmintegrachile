import React from 'react';
import { CheckCircle2, ExternalLink, FileCheck2, ShieldCheck } from 'lucide-react';
import type { GeneratedDocument } from '../../types/domain';
import { buildSignatureCertificateSummary } from '../../utils/contractSignature';
import { formatDateTimeBR } from '../../utils/formatters';

interface SignatureCertificateCardProps {
  doc: Partial<GeneratedDocument>;
  fallbackSigner?: { nome?: string; email?: string; documento?: string };
  compact?: boolean;
}

/**
 * Certificado institucional de assinatura eletrônica exibido no documento A4,
 * no Portal do Cliente e no Painel da Consultoria.
 */
export const SignatureCertificateCard: React.FC<SignatureCertificateCardProps> = ({
  doc,
  fallbackSigner,
  compact = false,
}) => {
  const cert = buildSignatureCertificateSummary(doc, fallbackSigner);
  if (!cert.hasSignature && !cert.confirmedReadAtIso) return null;

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/25 p-4 space-y-3 print-avoid-break">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200/80 dark:border-emerald-900/50 pb-2.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
            Certificado de Assinatura Eletrônica
          </p>
        </div>
        {cert.verificationCode && (
          <p className="text-[11px] font-mono tabular-nums text-emerald-800 dark:text-emerald-300">
            Cód. {cert.verificationCode}
          </p>
        )}
      </div>

      {cert.signatureImageUrl && (
        <div className="bg-white border border-emerald-200/90 rounded-lg p-3 flex flex-col items-start gap-1.5">
          <img
            src={cert.signatureImageUrl}
            alt="Assinatura eletrônica registrada"
            className={`${compact ? 'h-14' : 'h-16 sm:h-20'} max-w-full object-contain`}
          />
          {cert.signerName && (
            <div className="w-full pt-1.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-900">{cert.signerName}</span>
              {cert.signerDocument && (
                <span className="font-mono tabular-nums text-slate-500">Doc. {cert.signerDocument}</span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[11px] text-emerald-950 dark:text-emerald-100">
        {cert.signerName && (
          <div>
            <span className="text-emerald-800/80 dark:text-emerald-300/80">Signatário: </span>
            <strong className="font-semibold">{cert.signerName}</strong>
          </div>
        )}
        {cert.signerEmail && (
          <div className="truncate">
            <span className="text-emerald-800/80 dark:text-emerald-300/80">Conta autenticada: </span>
            <span className="font-mono">{cert.signerEmail}</span>
          </div>
        )}
        {cert.signedAtIso && (
          <div>
            <span className="text-emerald-800/80 dark:text-emerald-300/80">Data e hora: </span>
            <span className="font-mono tabular-nums font-semibold">{formatDateTimeBR(cert.signedAtIso)}</span>
          </div>
        )}
        {cert.hasSignature && (
          <div>
            <span className="text-emerald-800/80 dark:text-emerald-300/80">Modalidade: </span>
            <span className="font-medium">{cert.methodLabel}</span>
          </div>
        )}
        {cert.hashFull && (
          <div className="sm:col-span-2">
            <span className="text-emerald-800/80 dark:text-emerald-300/80">Integridade SHA-256: </span>
            <span
              className="font-mono tabular-nums text-[10px] break-all text-emerald-900 dark:text-emerald-200"
              title={cert.hashFull}
            >
              {compact ? cert.hashShort : cert.hashFull}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
        {cert.confirmedReadAtIso ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Leitura confirmada em <span className="font-mono tabular-nums">{formatDateTimeBR(cert.confirmedReadAtIso)}</span>
          </span>
        ) : (
          <span className="text-emerald-800/80 dark:text-emerald-300/80">
            Registro auditado eletronicamente (Lei nº 14.063/2020)
          </span>
        )}

        {cert.signedFileUrl && (
          <a
            href={cert.signedFileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-emerald-900 dark:text-emerald-200 underline hover:opacity-80 whitespace-nowrap"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            Abrir arquivo assinado
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </div>
  );
};
