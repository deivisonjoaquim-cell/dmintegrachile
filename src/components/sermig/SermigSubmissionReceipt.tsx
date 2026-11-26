import React from 'react';
import { AlertTriangle, CheckCircle2, Printer, RotateCcw, ShieldCheck } from 'lucide-react';
import { QrCodeSvg } from '../ui/DesignSystem';
import { formatCurrency, formatDateTimeBR } from '../../utils/formatters';
import type { SermigSimulatedReceipt } from '../../utils/sermigSimulator';

interface SermigSubmissionReceiptProps {
  receipt: SermigSimulatedReceipt;
  onRestart: () => void;
}

export const SermigSubmissionReceipt: React.FC<SermigSubmissionReceiptProps> = ({
  receipt,
  onRestart,
}) => {
  return (
    <div className="space-y-6" data-testid="sermig-simulated-receipt">
      {/* Comprovante oficial simulado */}
      <div className="rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] overflow-hidden bg-white dark:bg-[#0B1320]">
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-800/60 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Solicitud ingresada correctamente (Ambiente de Simulación)
              </p>
              <h4 className="font-display text-lg sm:text-xl font-bold text-[#0F172A] dark:text-white mt-0.5">
                Comprobante de Ingreso de Solicitud — SERMIG
              </h4>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] bg-white dark:bg-[#131F33] text-xs font-semibold text-[#0F172A] dark:text-slate-100 hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              Imprimir Comprovante
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0039A6] hover:bg-[#002F87] text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Nova Simulação
            </button>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Bloco Folio + QR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E2E8F0] dark:border-[#1E293B]">
            <div className="space-y-1">
              <p className="text-xs text-[#64748B] dark:text-slate-400">ID / Número de Solicitud (Simulado)</p>
              <p
                className="font-mono text-2xl sm:text-3xl font-bold text-[#0039A6] dark:text-blue-400 tabular-nums tracking-tight"
                data-testid="sermig-receipt-folio"
              >
                {receipt.folioSolicitud}
              </p>
              <p className="text-xs text-[#475569] dark:text-slate-300 font-mono tabular-nums">
                Código verificador: {receipt.codigoVerificacion} · {formatDateTimeBR(receipt.fechaHoraIngresoIso)}
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-center">
              <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]">
                <QrCodeSvg value={`${receipt.folioSolicitud}|${receipt.codigoVerificacion}`} size={64} />
              </div>
            </div>
          </div>

          {/* Tabela de dados protocolados */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
            <div className="pb-2 border-b border-[#F1F5F9] dark:border-[#1E293B]">
              <dt className="text-[#64748B] dark:text-slate-400">Trámite</dt>
              <dd className="font-semibold text-[#0F172A] dark:text-white mt-0.5">{receipt.tramiteLabelEs}</dd>
            </div>
            <div className="pb-2 border-b border-[#F1F5F9] dark:border-[#1E293B]">
              <dt className="text-[#64748B] dark:text-slate-400">Subcategoría Migratoria</dt>
              <dd className="font-semibold text-[#0F172A] dark:text-white mt-0.5">
                {receipt.subcategoriaEs && receipt.subcategoriaPt
                  ? `${receipt.subcategoriaEs} (${receipt.subcategoriaPt})`
                  : receipt.subcategoriaEs || receipt.subcategoriaPt || 'Residencia Temporal'}
              </dd>
            </div>
            <div className="pb-2 border-b border-[#F1F5F9] dark:border-[#1E293B]">
              <dt className="text-[#64748B] dark:text-slate-400">Titular Solicitante</dt>
              <dd className="font-semibold text-[#0F172A] dark:text-white mt-0.5">{receipt.titularCompleto}</dd>
            </div>
            <div className="pb-2 border-b border-[#F1F5F9] dark:border-[#1E293B]">
              <dt className="text-[#64748B] dark:text-slate-400">Documento de Identificación</dt>
              <dd className="font-mono font-semibold text-[#0F172A] dark:text-white mt-0.5">{receipt.documentoResumo}</dd>
            </div>
            <div className="pb-2 border-b border-[#F1F5F9] dark:border-[#1E293B]">
              <dt className="text-[#64748B] dark:text-slate-400">Correo de Notificación Oficial (Art. 146)</dt>
              <dd className="font-semibold text-[#0F172A] dark:text-white mt-0.5">{receipt.correoNotificacion}</dd>
            </div>
            <div className="pb-2 border-b border-[#F1F5F9] dark:border-[#1E293B]">
              <dt className="text-[#64748B] dark:text-slate-400">Resumen de Expediente</dt>
              <dd className="font-mono font-semibold text-[#0F172A] dark:text-white mt-0.5 tabular-nums">
                {receipt.totalDocumentosAnexados} documentos anexados · {receipt.totalDependientes} dependente(s)
              </dd>
            </div>
          </dl>

          <div className="p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-[#131F33]/60 border border-[#E2E8F0] dark:border-[#1E293B] text-xs text-[#334155] dark:text-slate-300">
            <strong className="text-[#0F172A] dark:text-white">Importante sobre taxas:</strong> Na data do envio no
            portal SERMIG o valor pago é <strong className="font-mono">USD 0,00</strong>. A taxa migratória estimada
            em <strong className="font-mono">{formatCurrency(receipt.taxaEstimadaUsd, 'USD')}</strong> (≈{' '}
            <strong className="font-mono">{formatCurrency(receipt.taxaEstimadaBrl, 'BRL')}</strong>) só é cobrada
            meses depois, após a aprovação, mediante Orden de Giro.
          </div>
        </div>
      </div>

      {/* Auditoria de Treino D&M + Próximas etapas no portal real */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#0B1320] p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              Auditoria do Seu Treino
            </h5>
            <span className="font-mono text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {receipt.readinessScore}/100
            </span>
          </div>

          <ul className="space-y-1.5 text-xs text-[#334155] dark:text-slate-300">
            {receipt.passedChecks.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {receipt.warnings.length > 0 && (
            <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-1.5">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Pontos de atenção antes do envio real ({receipt.warnings.length})
              </p>
              {receipt.warnings.map((w, idx) => (
                <div key={`${w.field}-${idx}`} className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{w.message}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#0B1320] p-5 space-y-3">
          <h5 className="text-sm font-bold text-[#0F172A] dark:text-white">
            O que acontece depois no Portal SERMIG real
          </h5>
          <ol className="space-y-2.5 text-xs">
            {receipt.proximasEtapasReais.map((stage) => (
              <li key={stage.ordem} className="space-y-0.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-[#0F172A] dark:text-white">
                    {stage.ordem}. {stage.titulo}
                  </span>
                  <span className="font-mono text-[11px] text-[#0039A6] dark:text-blue-400 tabular-nums">
                    {stage.prazoReferencia}
                  </span>
                </div>
                <p className="text-[#475569] dark:text-slate-300 leading-relaxed">{stage.detalhe}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
};
