import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  Stamp,
} from 'lucide-react';
import type { Case, CaseDocument, PaidConsultancyModality } from '../../types/domain';
import {
  buildImmigrationJourneyProgress,
  type ImmigrationJourneyMacroStep,
  type JourneyMacroStatus,
} from '../../utils/immigrationProgressStepper';

export interface ImmigrationJourneyStepperProps {
  mode: 'gratuito' | 'pendente' | 'contratado';
  activeCase?: Case | null;
  modality?: PaidConsultancyModality;
  caseDocuments?: CaseDocument[];
  subcategoriaNome?: string;
  onSelectPhase?: (phaseKey: string) => void;
  onActionCta?: () => void;
  actionCtaLabel?: string;
}

function getStepVisual(status: JourneyMacroStatus, featured: boolean) {
  if (status === 'completed') {
    return {
      circleClass: 'bg-emerald-600 dark:bg-emerald-500 text-white border-emerald-600 dark:border-emerald-500',
      labelClass: 'text-emerald-700 dark:text-emerald-400',
      surfaceClass: featured
        ? 'border-[#C9A86A]/70 dark:border-[#C9A86A]/60 bg-[#FCFBF7] dark:bg-[#111927]'
        : 'border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422]',
      icon: CheckCircle2,
    };
  }
  if (status === 'attention') {
    return {
      circleClass: 'bg-amber-500 text-white border-amber-500 ring-4 ring-amber-500/20',
      labelClass: 'text-amber-700 dark:text-amber-300',
      surfaceClass: 'border-amber-300 dark:border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20',
      icon: AlertTriangle,
    };
  }
  if (status === 'current') {
    return {
      circleClass: featured
        ? 'bg-[#070E1C] dark:bg-[#C9A86A] text-[#C9A86A] dark:text-[#070E1C] border-[#C9A86A] ring-4 ring-[#C9A86A]/25'
        : 'bg-[#0F3D91] dark:bg-[#3B82F6] text-white border-[#0F3D91] dark:border-[#3B82F6] ring-4 ring-[#0F3D91]/20',
      labelClass: featured ? 'text-[#8C6D14] dark:text-[#C9A86A]' : 'text-[#0F3D91] dark:text-[#60A5FA]',
      surfaceClass: featured
        ? 'border-[#C9A86A] dark:border-[#C9A86A] bg-[#070E1C] text-white'
        : 'border-[#0F3D91]/50 dark:border-[#3B82F6]/60 bg-[#F8FAFC] dark:bg-[#101B2E]',
      icon: Clock,
    };
  }
  return {
    circleClass: featured
      ? 'bg-[#FCFBF7] dark:bg-[#141F33] text-[#8C6D14] dark:text-[#C9A86A] border-[#C9A86A]'
      : 'bg-white dark:bg-[#0D1422] text-slate-400 dark:text-slate-500 border-[#CBD5E1] dark:border-[#334155]',
    labelClass: featured ? 'text-[#8C6D14] dark:text-[#C9A86A]' : 'text-[#64748B] dark:text-slate-400',
    surfaceClass: featured
      ? 'border-[#C9A86A]/55 dark:border-[#C9A86A]/45 bg-[#FCFBF7] dark:bg-[#101829]'
      : 'border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422]',
    icon: null,
  };
}

export const ImmigrationJourneyStepper: React.FC<ImmigrationJourneyStepperProps> = ({
  mode,
  activeCase = null,
  modality = 'completa',
  caseDocuments = [],
  subcategoriaNome,
  onSelectPhase,
  onActionCta,
  actionCtaLabel,
}) => {
  const model = useMemo(
    () =>
      buildImmigrationJourneyProgress({
        mode,
        activeCase,
        modality,
        caseDocuments,
        subcategoriaNome,
      }),
    [mode, activeCase, modality, caseDocuments, subcategoriaNome],
  );

  const [selectedStepId, setSelectedStepId] = useState<ImmigrationJourneyMacroStep['id']>(
    model.currentStep.id,
  );

  useEffect(() => {
    setSelectedStepId(model.currentStep.id);
  }, [model.currentStep.id]);

  const selectedStep = useMemo(
    () => model.steps.find((s) => s.id === selectedStepId) || model.currentStep,
    [model.steps, model.currentStep, selectedStepId],
  );

  const fillFraction =
    model.steps.length > 1
      ? Math.min(100, Math.max(0, (model.currentStepIndex / (model.steps.length - 1)) * 100))
      : 0;

  return (
    <section
      data-testid="immigration-journey-stepper"
      aria-label="Indicador de Progresso do Processo de Imigração"
      className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-5 sm:p-6 space-y-6"
    >
      {/* Cabeçalho executivo da trilha */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold tracking-[0.06em] text-[#8C6D14] dark:text-[#C9A86A]">
            Jornada Oficial de Imigração · Foco em Visto (SERMIG) &amp; RUT
          </p>
          <h2 className="font-display text-lg sm:text-xl font-bold text-[#070E1C] dark:text-white leading-snug">
            {model.stageCaption}
          </h2>
          <p className="text-xs text-[#475569] dark:text-slate-400">
            Acompanhe em qual marco do processo você está. Os marcos de <strong className="text-[#070E1C] dark:text-white">Visto (SERMIG)</strong> e <strong className="text-[#070E1C] dark:text-white">Emissão do RUT</strong> são o centro da nossa assessoria.
          </p>
        </div>

        <div className="flex items-baseline gap-3 shrink-0">
          <div className="text-left sm:text-right">
            <p className="text-[11px] text-[#64748B] dark:text-slate-400">Evolução da trilha</p>
            <p className="font-mono text-2xl sm:text-3xl font-bold text-[#070E1C] dark:text-white tabular-nums">
              {model.progressPercent}%
            </p>
          </div>
        </div>
      </div>

      {/* Linha horizontal desktop / vertical mobile com destaque para Visto e RUT */}
      <div className="relative">
        {/* Trilho horizontal conector (desktop) */}
        <div
          aria-hidden="true"
          className="hidden lg:block absolute left-[10%] right-[10%] top-[22px] h-0.5 bg-[#E5E7EB] dark:bg-[#1E293B]"
        >
          <div
            className="h-full bg-[#0F3D91] dark:bg-[#C9A86A] transition-all duration-300"
            style={{ width: `${fillFraction}%` }}
          />
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" aria-label="Marcos principais até Visto e RUT">
          {model.steps.map((step) => {
            const visual = getStepVisual(step.status, step.featured);
            const StatusIcon = visual.icon;
            const isSelected = selectedStep.id === step.id;
            const isFeaturedCurrentDark = step.featured && step.status === 'current';

            return (
              <li key={step.id} className="relative">
                <button
                  type="button"
                  data-testid={`journey-step-${step.id}`}
                  data-featured={step.featured ? 'true' : 'false'}
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedStepId(step.id);
                    if (onSelectPhase) onSelectPhase(step.targetPhaseKey);
                  }}
                  className={`w-full h-full text-left rounded-xl border p-3.5 transition-colors flex flex-col justify-between gap-3 ${
                    visual.surfaceClass
                  } ${
                    isSelected
                      ? 'ring-2 ring-[#0F3D91]/40 dark:ring-[#C9A86A]/50'
                      : 'hover:border-[#0F3D91]/40 dark:hover:border-[#60A5FA]/40'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center font-mono text-xs font-bold tabular-nums shrink-0 ${visual.circleClass}`}
                      >
                        {StatusIcon ? (
                          <StatusIcon className="w-4 h-4" aria-hidden="true" />
                        ) : step.id === 'visto' ? (
                          <Stamp className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : step.id === 'rut' ? (
                          <CreditCard className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          step.stepNumber
                        )}
                      </span>
                      <span
                        className={`text-[11px] font-semibold whitespace-nowrap ${
                          isFeaturedCurrentDark ? 'text-[#E5C76B]' : visual.labelClass
                        }`}
                      >
                        {step.statusLabel}
                      </span>
                    </div>

                    <div className="space-y-0.5">
                      {step.featuredTag && (
                        <p
                          className={`text-[10px] font-bold tracking-[0.06em] ${
                            isFeaturedCurrentDark
                              ? 'text-[#E5C76B]'
                              : 'text-[#8C6D14] dark:text-[#C9A86A]'
                          }`}
                        >
                          {step.featuredTag}
                        </p>
                      )}
                      <p
                        className={`text-sm font-bold leading-snug ${
                          isFeaturedCurrentDark ? 'text-white' : 'text-[#070E1C] dark:text-white'
                        }`}
                      >
                        {step.shortTitle}
                      </p>
                      <p
                        className={`text-[11px] leading-snug ${
                          isFeaturedCurrentDark ? 'text-slate-300' : 'text-[#475569] dark:text-slate-400'
                        }`}
                      >
                        {step.subtitle}
                      </p>
                    </div>
                  </div>

                  {step.dateHint && (
                    <p
                      className={`pt-2 border-t text-[11px] font-mono tabular-nums truncate ${
                        isFeaturedCurrentDark
                          ? 'border-white/15 text-slate-200'
                          : 'border-[#E5E7EB] dark:border-[#1E293B] text-[#475569] dark:text-slate-400'
                      }`}
                    >
                      {step.dateHint}
                    </p>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Destaques Executivos: Visto (SERMIG) & Emissão do RUT lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div
          data-testid="journey-highlight-visto"
          className="rounded-xl bg-[#070E1C] text-white p-4 sm:p-5 border border-[#1E293B] flex flex-col justify-between gap-2.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-white/10 text-[#C9A86A] flex items-center justify-center shrink-0">
                <Stamp className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#C9A86A]">Marco Oficial 01 · SERMIG</p>
                <h3 className="text-sm font-bold text-white">Visto de Residência (SERMIG)</h3>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-slate-200 whitespace-nowrap shrink-0">
              {model.visaHighlight.statusLabel}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{model.visaHighlight.summary}</p>
        </div>

        <div
          data-testid="journey-highlight-rut"
          className="rounded-xl bg-[#FCFBF7] dark:bg-[#111927] text-[#070E1C] dark:text-white p-4 sm:p-5 border border-[#C9A86A]/55 flex flex-col justify-between gap-2.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-lg bg-[#070E1C] dark:bg-[#C9A86A]/20 text-[#C9A86A] flex items-center justify-center shrink-0">
                <CreditCard className="w-4 h-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-[#8C6D14] dark:text-[#C9A86A]">
                  Marco Oficial 02 · Registro Civil
                </p>
                <h3 className="text-sm font-bold text-[#070E1C] dark:text-white">
                  Cédula de Identidade (RUT)
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-[#8C6D14] dark:text-[#C9A86A] whitespace-nowrap shrink-0">
              {model.rutHighlight.statusLabel}
            </span>
          </div>
          <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">{model.rutHighlight.summary}</p>
        </div>
      </div>

      {/* Detalhe da etapa selecionada */}
      <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <FileCheck2 className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 text-xs">
            <p className="font-bold text-[#070E1C] dark:text-white">
              Etapa {selectedStep.stepNumber} · {selectedStep.title}{' '}
              <span className="font-normal text-[#64748B] dark:text-slate-400">({selectedStep.statusLabel})</span>
            </p>
            <p className="text-[#475569] dark:text-slate-300 mt-0.5 leading-relaxed">{selectedStep.detail}</p>
          </div>
        </div>
        {onActionCta && actionCtaLabel && (
          <button
            type="button"
            onClick={onActionCta}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-white text-xs font-semibold hover:opacity-95 whitespace-nowrap shrink-0"
          >
            {actionCtaLabel}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
};
