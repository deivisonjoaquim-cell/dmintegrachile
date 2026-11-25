import React from 'react';
import { ArrowRight, BellRing, FileCheck2, Radar } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { EmpresaConfig } from '../../types/domain';
import { prefetchRouteChunk } from '../../utils/routePrefetch';
import { BrandLogo, BrandRibbon } from '../BrandLogo';
import { OptimizedImage } from '../OptimizedImage';

const EASE_ARCHITECTURAL = [0.16, 1, 0.3, 1] as const;
const ATELIER_DESK_PHOTO = '/src/assets/images/consultancy_atelier_desk_1795635434902.jpg';

const ArchitecturalRadarVisual: React.FC = () => {
  const cx = 110;
  const cy = 110;
  const maxR = 82;
  const sides = 7;
  const scores = [0.92, 0.86, 0.94, 0.84, 0.9, 0.88, 0.91];

  const getPoint = (idx: number, radius: number) => {
    const angle = (Math.PI * 2 * idx) / sides - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  };

  const rings = [0.33, 0.66, 1].map((scale) =>
    Array.from({ length: sides }, (_, idx) => {
      const p = getPoint(idx, maxR * scale);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' '),
  );

  const dataPolygon = scores
    .map((score, idx) => {
      const p = getPoint(idx, maxR * score);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox="0 0 220 220"
      className="w-40 h-40 sm:w-48 sm:h-48 shrink-0 select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dmRadarFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" stopOpacity="0.48" />
          <stop offset="55%" stopColor="#D4A853" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#047857" stopOpacity="0.34" />
        </linearGradient>
      </defs>

      {rings.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth={i === 2 ? '1.1' : '0.8'}
        />
      ))}

      {Array.from({ length: sides }, (_, idx) => {
        const outer = getPoint(idx, maxR);
        return (
          <line
            key={idx}
            x1={cx}
            y1={cy}
            x2={outer.x}
            y2={outer.y}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="0.8"
          />
        );
      })}

      <polygon
        points={dataPolygon}
        fill="url(#dmRadarFill)"
        stroke="#34D399"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {scores.map((score, idx) => {
        const p = getPoint(idx, maxR * score);
        return (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="3.2"
            fill={idx % 2 === 0 ? '#34D399' : '#D4A853'}
            stroke="#090F1A"
            strokeWidth="1.4"
          />
        );
      })}

      <circle cx={cx} cy={cy} r="2.8" fill="#34D399" />
    </svg>
  );
};

interface TechArchitectureBentoProps {
  empresa: EmpresaConfig;
  brandShortName: string;
  sectionPad: string;
  onNavigateAction: (dest: string) => void;
}

export const TechArchitectureBento: React.FC<TechArchitectureBentoProps> = ({
  empresa,
  brandShortName,
  sectionPad,
  onNavigateAction,
}) => {
  const { t } = useLanguage();

  return (
    <section
      className={`${sectionPad} bg-[#F8FAFC] dark:bg-[#060A12] border-b border-[#E2E8F0] dark:border-[#1E293B]`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="max-w-3xl space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="h-[2px] w-7 bg-[#10B981]" aria-hidden="true" />
            <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399]">
              {t.techBento.eyebrow}
            </p>
          </div>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight leading-[1.1] text-[#090F1A] dark:text-white text-balance">
            {t.techBento.heading}
          </h2>
          <p className="text-sm sm:text-base text-[#475569] dark:text-slate-300 leading-relaxed">
            {t.techBento.subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Card 1: Midnight Obsidian Motor de Diagnóstico + Radar SVG */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.36, ease: EASE_ARCHITECTURAL }}
            className="lg:col-span-7 relative rounded-2xl bg-[#090F1A] text-white border border-slate-800 hover:border-[#10B981]/50 overflow-hidden transition-colors duration-200 flex flex-col justify-between"
          >
            <BrandRibbon className="h-[2px] w-full" />
            <div className="p-6 sm:p-8 flex flex-col justify-between gap-6 flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#34D399]">
                    <Radar className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{t.techBento.radarCard.kicker}</span>
                  </div>
                  <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight leading-snug text-white">
                    {t.techBento.radarCard.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {t.techBento.radarCard.description}
                  </p>
                </div>
                <div className="flex items-center justify-center md:justify-end">
                  <ArchitecturalRadarVisual />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-white/10">
                {t.techBento.radarCard.pillars.map((spec) => (
                  <div key={spec.label} className="space-y-0.5">
                    <p className="font-mono text-base font-bold text-[#D4A853] tabular-nums">
                      {spec.score}
                    </p>
                    <p className="text-[11px] text-slate-300 leading-snug">{spec.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
                  onClick={() => onNavigateAction('/diagnostico')}
                  className="inline-flex items-center gap-2 px-5 py-3 btn-radius text-xs font-bold text-[#041C16] bg-[#10B981] hover:bg-[#34D399] transition-colors whitespace-nowrap"
                >
                  {t.techBento.radarCard.cta}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Prevenção Automática de Prazos */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.36, delay: 0.05, ease: EASE_ARCHITECTURAL }}
            className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#047857]/40 p-6 sm:p-8 flex flex-col justify-between gap-6 transition-colors duration-200"
          >
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#B91C1C] dark:text-rose-400">
                <BellRing className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{t.techBento.alertsCard.kicker}</span>
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight leading-snug text-[#090F1A] dark:text-white">
                {t.techBento.alertsCard.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
                {t.techBento.alertsCard.description}
              </p>
            </div>

            <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] border-t border-[#E2E8F0] dark:border-[#1E293B]">
              {t.techBento.alertsCard.rules.map((rule, idx) => (
                <div key={rule.code} className="flex items-start gap-3.5 py-3.5 first:pt-4 last:pb-0">
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md tabular-nums shrink-0 ${
                      idx === 0
                        ? 'bg-[#B91C1C] text-white'
                        : idx === 1
                          ? 'bg-[#090F1A] dark:bg-[#D4A853] text-[#E5C16C] dark:text-[#090F1A]'
                          : 'bg-[#047857] text-white'
                    }`}
                  >
                    {rule.code}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#090F1A] dark:text-white">{rule.title}</p>
                    <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed mt-0.5">{rule.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Card 3: Portal do Cliente & Editorial Atelier Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.36, delay: 0.1, ease: EASE_ARCHITECTURAL }}
            className="lg:col-span-12 rounded-2xl bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] overflow-hidden"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between gap-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      variant="emblem"
                      lazy
                      alt={empresa.nome_empresa}
                      brandShortName={brandShortName}
                      imgClassName="w-10 h-10 object-contain shrink-0"
                    />
                    <div>
                      <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399]">
                        {t.techBento.portalCard.kicker}
                      </p>
                      <h3 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[#090F1A] dark:text-white leading-snug">
                        {t.techBento.portalCard.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed max-w-3xl">
                    {t.techBento.portalCard.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                  {t.techBento.portalCard.milestones.map((m, idx) => (
                    <div key={m} className="space-y-0.5">
                      <span className="font-mono text-xs font-bold text-[#047857] dark:text-[#34D399] tabular-nums">
                        0{idx + 1}
                      </span>
                      <p className="text-xs font-semibold text-[#090F1A] dark:text-slate-100 leading-snug">
                        {m}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onMouseEnter={() => prefetchRouteChunk('/acompanhar')}
                    onTouchStart={() => prefetchRouteChunk('/acompanhar')}
                    onClick={() => onNavigateAction('/acompanhar')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 btn-radius text-xs font-bold text-white bg-[#090F1A] dark:bg-[#10B981] dark:text-[#041C16] hover:opacity-92 transition-opacity whitespace-nowrap"
                  >
                    <FileCheck2 className="w-4 h-4 text-[#34D399] dark:text-[#041C16]" aria-hidden="true" />
                    {t.techBento.portalCard.primaryCta}
                  </button>
                  <button
                    type="button"
                    onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
                    onTouchStart={() => prefetchRouteChunk('/diagnostico')}
                    onClick={() => onNavigateAction('/diagnostico')}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 btn-radius text-xs font-semibold text-[#090F1A] dark:text-slate-100 border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#131F33] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2942] transition-colors whitespace-nowrap"
                  >
                    {t.techBento.portalCard.secondaryCta}
                    <ArrowRight className="w-3.5 h-3.5 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-4 relative min-h-[240px] lg:min-h-full bg-[#090F1A] border-t lg:border-t-0 lg:border-l border-[#E2E8F0] dark:border-[#1E293B]">
                <OptimizedImage
                  src={ATELIER_DESK_PHOTO}
                  alt={t.techBento.portalCard.title}
                  sizes="(max-width: 1024px) 100vw, 34vw"
                  containerClassName="w-full h-full"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
