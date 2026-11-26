import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Compass,
  FileCheck2,
  FileSignature,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type {
  ClientActionCenterResult,
  ClientNextAction,
  PortalActionTab,
} from '../../utils/clientPortalIntelligence';

interface ClientActionCenterCardProps {
  center: ClientActionCenterResult;
  onSelectTab: (tab: PortalActionTab) => void;
  onOpenSignDoc?: (genDocId: string) => void;
}

export const ClientActionCenterCard: React.FC<ClientActionCenterCardProps> = ({
  center,
  onSelectTab,
  onOpenSignDoc,
}) => {
  const { kpis, actions, allClearMessage } = center;

  const handleActionClick = (action: ClientNextAction) => {
    if (action.targetGenDocId && onOpenSignDoc) {
      onOpenSignDoc(action.targetGenDocId);
      return;
    }
    onSelectTab(action.targetTab);
  };

  return (
    <section
      data-testid="client-action-center"
      aria-label="Resumo executivo e próximas ações do cliente"
      className="space-y-4"
    >
      {/* 4 Indicadores Executivos (KPI Strip) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] p-4 space-y-1">
          <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">
            Etapa do Processo
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#0B1628] dark:text-white">
            {kpis.pipelineStage}
            <span className="text-sm font-normal text-slate-400">/{kpis.pipelineTotal}</span>
          </p>
          <p className="text-xs text-[#475569] dark:text-slate-300 truncate">{kpis.statusSermig}</p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] p-4 space-y-1">
          <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">
            Prontidão Documental
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-[#0F3D91] dark:text-[#60A5FA]">
            {kpis.readinessPct}%
          </p>
          <p className="text-xs text-[#475569] dark:text-slate-300 tabular-nums">
            {kpis.mandatoryDocsCount > 0
              ? `${kpis.approvedDocsCount} de ${kpis.mandatoryDocsCount} obrigatórios`
              : 'Checklist em preparação'}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] p-4 space-y-1">
          <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">
            Pendências Prioritárias
          </p>
          <p
            className={`font-mono text-2xl font-bold tabular-nums ${
              kpis.pendingActionsCount > 0
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {kpis.pendingActionsCount}
          </p>
          <p className="text-xs text-[#475569] dark:text-slate-300 truncate">
            {kpis.reprovedDocsCount > 0
              ? `${kpis.reprovedDocsCount} doc(s) para reenvio`
              : kpis.unsignedDocsCount > 0
                ? `${kpis.unsignedDocsCount} assinatura(s) pendente(s)`
                : 'Nenhuma trava crítica'}
          </p>
        </div>

        <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] p-4 space-y-1">
          <p className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-[#C9A86A]" />
            Próximo Marco
          </p>
          <p className="font-mono text-lg sm:text-xl font-bold tabular-nums text-[#0B1628] dark:text-white leading-tight pt-0.5">
            {kpis.nextMilestoneLabel}
          </p>
          <p className="text-xs text-[#475569] dark:text-slate-300 truncate" title={kpis.nextMilestoneSub}>
            {kpis.nextMilestoneSub}
          </p>
        </div>
      </div>

      {/* Central de Próximas Ações Recomendadas */}
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#1E293B] flex flex-wrap items-center justify-between gap-2 bg-[#F7F8FA] dark:bg-[#111A2C]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#C9A86A] shrink-0" />
            <h2 className="text-sm font-semibold text-[#0B1628] dark:text-white">
              Central de Próximas Ações
            </h2>
          </div>
          <span className="text-[11px] font-medium text-[#64748B] dark:text-slate-400">
            Ordenado automaticamente por prioridade
          </span>
        </div>

        {actions.length === 0 ? (
          <div className="p-5 flex items-center gap-3 text-sm text-emerald-800 dark:text-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/15">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <p className="text-xs sm:text-sm leading-relaxed">{allClearMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B]">
            {actions.map((action) => {
              const Icon =
                action.priority === 'critica'
                  ? ShieldAlert
                  : action.category === 'assinatura'
                    ? FileSignature
                    : action.category === 'simulador'
                      ? Compass
                      : action.category === 'documento'
                        ? FileCheck2
                        : AlertTriangle;

              const badgeStyle =
                action.priority === 'critica'
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60'
                  : action.priority === 'alta'
                    ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/60'
                    : 'bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

              return (
                <div
                  key={action.id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F7F8FA]/60 dark:hover:bg-[#111A2C]/50 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${badgeStyle}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-semibold text-[#0B1628] dark:text-white leading-snug">
                        {action.title}
                      </p>
                      <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                        {action.detail}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleActionClick(action)}
                    className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      action.priority === 'critica'
                        ? 'bg-[#0B1628] hover:bg-[#152847] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] text-white'
                        : 'border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#192842]'
                    }`}
                  >
                    {action.ctaLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
