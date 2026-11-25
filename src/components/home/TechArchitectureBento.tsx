import React from 'react';
import { ArrowRight, BellRing, FileCheck2, Radar } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { EmpresaConfig } from '../../types/domain';
import { prefetchRouteChunk } from '../../utils/routePrefetch';
import { BrandLogo, BrandRibbon } from '../BrandLogo';

const EASE_EXECUTIVE = [0.22, 1, 0.36, 1] as const;

/**
 * Geometric 7-pillar SVG radar emblem representing the 7 weighted axes
 * evaluated by the SERMIG / Ley 21.325 diagnostic engine.
 */
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
          <stop offset="0%" stopColor="#146B43" stopOpacity="0.44" />
          <stop offset="55%" stopColor="#C8A236" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#A61C2B" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      {rings.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="rgba(229, 199, 107, 0.22)"
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
            stroke="rgba(255, 255, 255, 0.14)"
            strokeWidth="0.8"
          />
        );
      })}

      <polygon
        points={dataPolygon}
        fill="url(#dmRadarFill)"
        stroke="#E5C76B"
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
            r="3"
            fill={idx % 3 === 0 ? '#E5C76B' : idx % 3 === 1 ? '#34D399' : '#F87171'}
            stroke="#0B1F33"
            strokeWidth="1.2"
          />
        );
      })}

      <circle cx={cx} cy={cy} r="2.8" fill="#E5C76B" />
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
      className={`${sectionPad} bg-[#FAF9F6] dark:bg-[#091625] border-b border-[#E5DFD2] dark:border-[#1C324B]`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="max-w-3xl space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="h-[2px] w-7 bg-[#C8A236]" aria-hidden="true" />
            <p className="text-xs font-semibold text-[#8C6D14] dark:text-[#E5C76B]">
              {t.techBento.eyebrow}
            </p>
          </div>
          <h2 className="font-display text-2xl sm:text-[34px] font-bold tracking-tight leading-[1.15] text-[#0B1F33] dark:text-white text-balance">
            {t.techBento.heading}
          </h2>
          <p className="text-sm sm:text-base text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
            {t.techBento.subheading}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Card 1: Motor de Diagnóstico Inteligente + Especificações Reais */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, ease: EASE_EXECUTIVE }}
            className="lg:col-span-7 relative rounded-2xl bg-[#0B1F33] text-white border border-[#1E3A5F] hover:border-[#C8A236]/55 overflow-hidden transition-colors duration-200 flex flex-col justify-between"
          >
            <BrandRibbon className="h-[2.5px] w-full" />
            <div className="p-6 sm:p-8 flex flex-col justify-between gap-6 flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#E5C76B]">
                    <Radar className="w-4 h-4 shrink-0" />
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
                  <div
                    key={spec.label}
                    className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5"
                  >
                    <p className="font-mono text-base font-bold text-[#E5C76B] tabular-nums">
                      {spec.score}
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{spec.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
                  onClick={() => onNavigateAction('/diagnostico')}
                  className="inline-flex items-center gap-2 px-5 py-3 btn-radius text-xs font-bold text-[#0B1523] transition-opacity hover:opacity-95 whitespace-nowrap"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {t.techBento.radarCard.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Prevenção Automática de Prazos */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: 0.05, ease: EASE_EXECUTIVE }}
            className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] hover:border-[#C8A236]/55 p-6 sm:p-8 flex flex-col justify-between gap-6 transition-colors duration-200"
          >
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#A61C2B] dark:text-rose-400">
                <BellRing className="w-4 h-4 shrink-0" />
                <span>{t.techBento.alertsCard.kicker}</span>
              </div>
              <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight leading-snug text-[#0B1F33] dark:text-white">
                {t.techBento.alertsCard.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                {t.techBento.alertsCard.description}
              </p>
            </div>

            <div className="divide-y divide-[#EDE8DC] dark:divide-[#1C324B] border-t border-[#EDE8DC] dark:border-[#1C324B]">
              {t.techBento.alertsCard.rules.map((rule, idx) => (
                <div key={rule.code} className="flex items-start gap-3.5 py-3.5 first:pt-4 last:pb-0">
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md tabular-nums shrink-0 ${
                      idx === 0
                        ? 'bg-[#A61C2B] text-white'
                        : idx === 1
                          ? 'bg-[#0B1F33] dark:bg-[#C8A236] text-[#E5C76B] dark:text-[#0B1523]'
                          : 'bg-[#146B43] text-white'
                    }`}
                  >
                    {rule.code}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0B1F33] dark:text-white">{rule.title}</p>
                    <p className="text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed mt-0.5">{rule.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Card 3: Portal do Cliente & Acompanhamento em 15 Etapas */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.4, delay: 0.1, ease: EASE_EXECUTIVE }}
            className="lg:col-span-12 rounded-2xl bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] hover:border-[#C8A236]/55 p-6 sm:p-8 transition-colors duration-200"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-3">
                  <BrandLogo
                    variant="emblem"
                    lazy
                    alt={empresa.nome_empresa}
                    brandShortName={brandShortName}
                    imgClassName="w-10 h-10 object-contain shrink-0"
                  />
                  <div>
                    <p className="text-xs font-semibold text-[#146B43] dark:text-emerald-400">
                      {t.techBento.portalCard.kicker}
                    </p>
                    <h3 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[#0B1F33] dark:text-white leading-snug">
                      {t.techBento.portalCard.title}
                    </h3>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed max-w-3xl">
                  {t.techBento.portalCard.description}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                  {t.techBento.portalCard.milestones.map((m, idx) => (
                    <div
                      key={m}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1F3752] text-xs font-medium text-[#0B1F33] dark:text-slate-100"
                    >
                      <span className="font-mono text-[11px] font-bold text-[#8C6D14] dark:text-[#E5C76B] tabular-nums">
                        0{idx + 1}
                      </span>
                      <span className="truncate">{m}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2.5 lg:items-end justify-end">
                <button
                  type="button"
                  onMouseEnter={() => prefetchRouteChunk('/acompanhar')}
                  onTouchStart={() => prefetchRouteChunk('/acompanhar')}
                  onClick={() => onNavigateAction('/acompanhar')}
                  className="w-full lg:w-64 inline-flex items-center justify-center gap-2 px-5 py-3 btn-radius text-xs font-semibold text-white transition-opacity hover:opacity-95 whitespace-nowrap"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <FileCheck2 className="w-4 h-4 text-[#E5C76B]" />
                  {t.techBento.portalCard.primaryCta}
                </button>
                <button
                  type="button"
                  onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
                  onTouchStart={() => prefetchRouteChunk('/diagnostico')}
                  onClick={() => onNavigateAction('/diagnostico')}
                  className="w-full lg:w-64 inline-flex items-center justify-center gap-2 px-5 py-3 btn-radius text-xs font-semibold text-[#0B1F33] dark:text-slate-100 border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] hover:bg-[#F1EDE4] dark:hover:bg-[#183350] transition-colors whitespace-nowrap"
                >
                  {t.techBento.portalCard.secondaryCta}
                  <ArrowRight className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
