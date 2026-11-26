import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getJourneyPhases } from '../../utils/heroProfilePreview';
import { prefetchRouteChunk } from '../../utils/routePrefetch';
import { OptimizedImage } from '../OptimizedImage';

const EASE_EXECUTIVE = [0.16, 1, 0.3, 1] as const;
const BOARDROOM_PHOTO = '/src/assets/images/advisory_boardroom_minimal_1795699453098.jpg';

interface InteractiveJourneyShowcaseProps {
  sectionPad: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  imagemUrl?: string;
  onNavigateAction: (dest: string) => void;
}

export const InteractiveJourneyShowcase: React.FC<InteractiveJourneyShowcaseProps> = ({
  sectionPad,
  eyebrow,
  title,
  subtitle,
  imagemUrl,
  onNavigateAction,
}) => {
  const { locale } = useLanguage();
  const isEs = locale === 'es-CL';
  const phases = getJourneyPhases(locale);
  const [activeIndex, setActiveIndex] = useState(0);
  const resolvedPhoto = imagemUrl?.trim() || BOARDROOM_PHOTO;

  const currentPhase = phases[activeIndex] || phases[0];

  return (
    <section
      className={`${sectionPad} bg-white dark:bg-[#0D1422] border-y border-[#E5E7EB] dark:border-[#1E293B] text-[#0B1628] dark:text-white`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 space-y-14">
        {/* Clean Editorial Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-7 space-y-3">
            <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
              {eyebrow || (isEs ? 'Metodología de ejecución' : 'Metodologia de execução')}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-[1.12] text-[#0B1628] dark:text-white text-balance">
              {title ||
                (isEs
                  ? 'De Brasil a tu Cédula chilena, en cuatro fases estructuradas'
                  : 'Do Brasil à sua Cédula chilena, em quatro fases estruturadas')}
            </h2>
          </div>
          <div className="lg:col-span-5 lg:text-right space-y-4">
            <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed lg:text-left">
              {subtitle ||
                (isEs
                  ? 'Cada fase cuenta con entregables verificables, control legal de plazos (30, 60 y 90 días) y seguimiento en tu Portal del Cliente.'
                  : 'Cada etapa possui entregáveis verificáveis, controle legal de prazos (30, 60 e 90 dias) e acompanhamento no Portal do Cliente.')}
            </p>
          </div>
        </div>

        {/* Clean 4-Column Horizontal Phase Tabs (Zero Clutter) */}
        <div
          role="tablist"
          aria-label={isEs ? 'Fases del proceso migratorio' : 'Fases do processo migratório'}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-b border-[#E5E7EB] dark:border-[#1E293B]"
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
                className={`text-left py-5 px-4 border-b-2 transition-colors flex flex-col gap-1 ${
                  active
                    ? 'border-[#0F3D91] dark:border-[#60A5FA] bg-[#F7F8FA] dark:bg-[#151F32]'
                    : 'border-transparent hover:bg-[#F7F8FA]/60 dark:hover:bg-[#151F32]/50'
                }`}
              >
                <span
                  className={`font-mono text-xs font-semibold tabular-nums ${
                    active ? 'text-[#0F3D91] dark:text-[#60A5FA]' : 'text-[#6B7280] dark:text-slate-500'
                  }`}
                >
                  {phase.code} · {phase.timeframe}
                </span>
                <span
                  className={`font-display text-base font-bold leading-snug ${
                    active ? 'text-[#0B1628] dark:text-white' : 'text-[#4B5563] dark:text-slate-300'
                  }`}
                >
                  {phase.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Serene Editorial Stage: Active Phase Detail (7 cols) + Architectural Boardroom Photography (5 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between gap-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={currentPhase.code}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: EASE_EXECUTIVE }}
                className="space-y-6"
              >
                <div className="space-y-2.5">
                  <h3 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1628] dark:text-white leading-tight">
                    {currentPhase.code}. {currentPhase.title}
                  </h3>
                  <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl">
                    {currentPhase.subtitle}
                  </p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-[#6B7280] dark:text-slate-400">
                    {isEs ? 'Entregables de esta fase' : 'Entregáveis desta etapa'}
                  </p>
                  <ul className="space-y-3">
                    {currentPhase.deliverables.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-sm text-[#0B1628] dark:text-slate-200 leading-relaxed"
                      >
                        <Check
                          className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA] shrink-0 mt-1"
                          aria-hidden="true"
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#0B1628] dark:text-white">
                      {isEs ? 'Protección de plazo' : 'Controle de prazo legal'}
                    </p>
                    <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                      {currentPhase.deadlineGuard}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-[#0B1628] dark:text-white">
                      {isEs ? 'En tu Portal del Cliente' : 'No Portal do Cliente'}
                    </p>
                    <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                      {currentPhase.portalView}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-wrap items-center gap-5 pt-2">
              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
                onClick={() => onNavigateAction('/diagnostico')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-xs font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white hover:bg-[#16233B] dark:hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                {isEs ? 'Iniciar por el Diagnóstico' : 'Começar pelo Diagnóstico'}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk('/acompanhar')}
                onClick={() => onNavigateAction('/acompanhar')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline underline-offset-4 whitespace-nowrap"
              >
                {isEs ? 'Conocer el Portal del Cliente' : 'Acessar Portal do Cliente'}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-72 lg:h-full min-h-[320px] rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#151F32]">
              <OptimizedImage
                src={resolvedPhoto}
                alt={isEs ? 'Sala ejecutiva de asesoría migratoria en Santiago' : 'Sala executiva de assessoria migratória em Santiago'}
                sizes="(max-width: 1024px) 100vw, 40vw"
                containerClassName="w-full h-full"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
