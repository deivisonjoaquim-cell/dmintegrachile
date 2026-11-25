import React, { useState } from 'react';
import { ArrowRight, Check, Clock, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getJourneyPhases } from '../../utils/heroProfilePreview';
import { prefetchRouteChunk } from '../../utils/routePrefetch';

const EASE_ARCHITECTURAL = [0.16, 1, 0.3, 1] as const;

interface InteractiveJourneyShowcaseProps {
  sectionPad: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  onNavigateAction: (dest: string) => void;
}

export const InteractiveJourneyShowcase: React.FC<InteractiveJourneyShowcaseProps> = ({
  sectionPad,
  eyebrow,
  title,
  subtitle,
  onNavigateAction,
}) => {
  const { locale } = useLanguage();
  const isEs = locale === 'es-CL';
  const phases = getJourneyPhases(locale);
  const [activeIndex, setActiveIndex] = useState(0);

  const currentPhase = phases[activeIndex] || phases[0];
  const progressPct = Math.round(((activeIndex + 1) / phases.length) * 100);

  return (
    <section
      className={`${sectionPad} bg-[var(--color-surface)] border-y border-[var(--color-border-subtle)] text-[var(--color-text)]`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        {/* Editorial Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="h-[2px] w-7 bg-[#10B981]" aria-hidden="true" />
              <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399]">
                {eyebrow || (isEs ? 'Método en 4 fases claras' : 'Método em 4 fases claras')}
              </p>
            </div>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-[#090F1A] dark:text-white text-balance">
              {title ||
                (isEs
                  ? 'De Brasil a tu Cédula chilena, sin improvisaciones'
                  : 'Do Brasil à sua Cédula chilena, sem improvisos')}
            </h2>
            <p className="text-sm sm:text-base text-[#475569] dark:text-slate-300 leading-relaxed">
              {subtitle ||
                (isEs
                  ? 'Explora cada fase de la asesoría y mira qué entregables y protecciones legales recibes en tu Portal del Cliente.'
                  : 'Explore cada fase da assessoria e veja exatamente quais entregáveis e blindagens de prazo você acompanha no Portal do Cliente.')}
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
              onClick={() => onNavigateAction('/diagnostico')}
              className="inline-flex items-center gap-2 px-5 py-3 btn-radius text-xs font-bold text-white bg-[#090F1A] dark:bg-[#10B981] dark:text-[#041C16] hover:opacity-92 transition-opacity whitespace-nowrap"
            >
              {isEs ? 'Comenzar por la Fase 01' : 'Começar pela Fase 01'}
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Interactive Split: Clickable Phase Index (5 cols) + Dynamic Phase Canvas (7 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div
            role="tablist"
            aria-label={isEs ? 'Fases del proceso migratorio' : 'Fases do processo migratório'}
            className="lg:col-span-5 flex flex-col divide-y divide-[#E2E8F0] dark:divide-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl overflow-hidden bg-[#F8FAFC] dark:bg-[#0D1524]"
          >
            {phases.map((phase, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={phase.code}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveIndex(idx)}
                  className={`flex-1 text-left p-5 transition-colors flex items-start gap-4 ${
                    active
                      ? 'bg-[#090F1A] text-white dark:bg-[#131F33]'
                      : 'hover:bg-white dark:hover:bg-[#101B2E] text-[#090F1A] dark:text-slate-200'
                  }`}
                >
                  <span
                    className={`font-mono text-lg font-bold tabular-nums shrink-0 leading-none pt-0.5 ${
                      active ? 'text-[#34D399]' : 'text-[#94A3B8] dark:text-slate-500'
                    }`}
                  >
                    {phase.code}
                  </span>
                  <div className="min-w-0 space-y-1">
                    <p
                      className={`font-display text-base font-bold leading-snug ${
                        active ? 'text-white' : 'text-[#090F1A] dark:text-white'
                      }`}
                    >
                      {phase.title}
                    </p>
                    <p
                      className={`text-xs leading-relaxed ${
                        active ? 'text-slate-300' : 'text-[#475569] dark:text-slate-400'
                      }`}
                    >
                      {phase.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7 rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#090F1A] text-white p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-[#34D399] tabular-nums">
                  {isEs ? `Fase ${currentPhase.code} de 04` : `Fase ${currentPhase.code} de 04`} · {currentPhase.timeframe}
                </span>
                <span className="font-mono text-slate-400 tabular-nums">{progressPct}%</span>
              </div>
              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-[#10B981]"
                  initial={false}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.28, ease: EASE_ARCHITECTURAL }}
                />
              </div>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentPhase.code}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: EASE_ARCHITECTURAL }}
                className="space-y-6 flex-1 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                    {currentPhase.code}. {currentPhase.title}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed max-w-2xl">
                    {currentPhase.subtitle}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <p className="text-xs font-semibold text-[#D4A853]">
                    {isEs ? 'Entregables de esta fase' : 'O que você recebe nesta fase'}
                  </p>
                  <ul className="space-y-2.5">
                    {currentPhase.deliverables.map((item) => (
                      <li key={item} className="flex items-start gap-3 text-sm text-slate-100 leading-relaxed">
                        <Check className="w-4 h-4 text-[#34D399] shrink-0 mt-1" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 border-t border-white/12">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#D4A853] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {isEs ? 'Protección de plazo' : 'Proteção de prazo'}
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">{currentPhase.deadlineGuard}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#34D399] flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {isEs ? 'En tu Portal del Cliente' : 'No seu Portal do Cliente'}
                    </p>
                    <p className="text-xs text-slate-300 leading-relaxed">{currentPhase.portalView}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
