import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Compass, MessageCircle, ShieldCheck } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';
import { sanitizeHtml } from '../../utils/formatters';
import {
  getHeroQuickProfileById,
  getHeroQuickProfiles,
  type HeroQuickProfileId,
} from '../../utils/heroProfilePreview';
import { prefetchRouteChunk } from '../../utils/routePrefetch';
import { OptimizedImage } from '../OptimizedImage';

const EASE_ARCHITECTURAL = [0.16, 1, 0.3, 1] as const;

const DEFAULT_HERO_PHOTO = '/src/assets/images/hero_santiago_twilight_1795635432589.jpg';

interface HeroShowcaseProps {
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroHtml?: string;
  ctaPrimario: string;
  ctaSecundario: string;
  ctaDestino: string;
  whatsappUrl: string;
  imagemUrl?: string;
  heroDestaques: string[];
  onNavigateAction: (dest: string) => void;
}

export const HeroShowcase: React.FC<HeroShowcaseProps> = ({
  eyebrow,
  heroTitle,
  heroSubtitle,
  heroHtml,
  ctaPrimario,
  ctaSecundario,
  ctaDestino,
  whatsappUrl,
  imagemUrl,
  heroDestaques,
  onNavigateAction,
}) => {
  const { locale } = useLanguage();
  const isEs = locale === 'es-CL';
  const [selectedProfileId, setSelectedProfileId] = useState<HeroQuickProfileId>('mercosul');

  const profiles = getHeroQuickProfiles(locale);
  const activeProfile = getHeroQuickProfileById(selectedProfileId, locale);
  const heroPhoto = imagemUrl || DEFAULT_HERO_PHOTO;

  const proofMetrics = isEs
    ? [
        { value: '16', label: 'Subcategorías Decreto 177/2022', note: 'Ley Nº 21.325' },
        { value: '7 Pilares', label: 'Radar técnico de viabilidad', note: 'Cálculo en vivo' },
        { value: '15 Etapas', label: 'Seguimiento en el Portal', note: 'De Brasil al RUT' },
        { value: '30 · 60 · 90d', label: 'Control legal de plazos', note: 'PDI, PF y Prórroga' },
      ]
    : [
        { value: '16', label: 'Subcategorias Decreto 177/2022', note: 'Ley Nº 21.325' },
        { value: '7 Pilares', label: 'Radar técnico de viabilidade', note: 'Cálculo ao vivo' },
        { value: '15 Etapas', label: 'Rastreamento no Portal', note: 'Do Brasil ao RUT' },
        { value: '30 · 60 · 90d', label: 'Blindagem legal de prazos', note: 'PDI, PF e Prorrogação' },
      ];

  return (
    <section className="relative bg-[#090F1A] text-white overflow-hidden border-b border-white/10">
      {/* Full-bleed twilight Santiago + Andes backdrop with measured editorial contrast scrim */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <OptimizedImage
          src={heroPhoto}
          alt={heroTitle}
          priority
          placeholderTone="dark"
          sizes="100vw"
          containerClassName="w-full h-full"
          className="w-full h-full object-cover object-center opacity-55"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#060B14]/96 via-[#090F1A]/86 to-[#090F1A]/62"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#090F1A] via-transparent to-[#060B14]/65"
        />
        {/* Subtle architectural hairline coordinate grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-8 lg:pt-14 lg:pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-10 items-stretch">
          {/* Left 7 cols: Bold Architectural Proposition + Single High-Intent Primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_ARCHITECTURAL }}
            className="lg:col-span-7 flex flex-col justify-center"
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="h-[2px] w-8 bg-[#10B981] shrink-0" aria-hidden="true" />
              <p className="text-xs sm:text-[13px] font-semibold text-[#34D399] tracking-[0.01em]">
                {eyebrow}
              </p>
            </div>

            <h1 className="font-display text-[clamp(2.35rem,4.5vw,3.95rem)] font-bold tracking-[-0.032em] text-white leading-[1.04] text-balance mb-5">
              {heroTitle}
            </h1>

            <p className="text-base sm:text-lg text-slate-200 leading-[1.62] max-w-2xl mb-4">
              {heroSubtitle}
            </p>

            {heroHtml && (
              <div
                className="text-sm text-slate-300 leading-relaxed max-w-2xl mb-8"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(heroHtml) }}
              />
            )}

            <div className="flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk(ctaDestino || '/diagnostico')}
                onTouchStart={() => prefetchRouteChunk(ctaDestino || '/diagnostico')}
                onClick={() => onNavigateAction(ctaDestino || '/diagnostico')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 btn-radius text-sm font-bold text-[#041C16] bg-[#10B981] hover:bg-[#34D399] shadow-[0_12px_28px_rgba(16,185,129,0.28)] transition-all duration-150 whitespace-nowrap shrink-0"
              >
                {ctaPrimario}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3.5 btn-radius text-sm font-semibold text-white border border-white/25 bg-white/[0.06] hover:bg-white/[0.12] backdrop-blur-sm transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4 text-[#34D399]" aria-hidden="true" />
                {ctaSecundario}
              </a>
            </div>

            {heroDestaques.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/12 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                {heroDestaques.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <ShieldCheck
                      className="w-4 h-4 shrink-0 mt-0.5 text-[#D4A853]"
                      aria-hidden="true"
                    />
                    <p className="text-xs text-slate-200 leading-snug">{item}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Right 5 cols: Interactive Instant Eligibility Quick-Selector (Immediate Client Value Above the Fold) */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08, ease: EASE_ARCHITECTURAL }}
            className="lg:col-span-5 flex flex-col justify-center"
          >
            <div className="rounded-2xl bg-[#0D1524]/92 backdrop-blur-md border border-white/15 p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)] flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#D4A853]">
                    <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {isEs ? 'Simulador rápido · Elige tu perfil' : 'Simulador rápido · Escolha seu perfil'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">SERMIG</span>
                </div>

                {/* Interactive Segmented Profile Buttons */}
                <div
                  role="tablist"
                  aria-label={isEs ? 'Perfiles de residencia en Chile' : 'Perfis de residência no Chile'}
                  className="flex flex-wrap gap-1.5"
                >
                  {profiles.map((profile) => {
                    const active = profile.id === selectedProfileId;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSelectedProfileId(profile.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap ${
                          active
                            ? 'bg-white text-[#090F1A] shadow-sm'
                            : 'bg-white/[0.06] text-slate-300 hover:bg-white/[0.12] hover:text-white border border-white/10'
                        }`}
                      >
                        {profile.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Legal Route Result */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeProfile.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: EASE_ARCHITECTURAL }}
                  className="space-y-4 pt-4 border-t border-white/12"
                >
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] text-[#34D399]">{activeProfile.legalBasis}</p>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-snug">
                      {activeProfile.routeTitle}
                    </h2>
                    <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed pt-1">
                      {activeProfile.summary}
                    </p>
                  </div>

                  <dl className="space-y-2.5 pt-3 border-t border-white/10 text-xs">
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-400 shrink-0">
                        {isEs ? 'Protocolo' : 'Onde protocolar'}
                      </dt>
                      <dd className="text-right font-medium text-white">{activeProfile.protocolOrigin}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-400 shrink-0">
                        {isEs ? 'Trabajo' : 'Direito ao trabalho'}
                      </dt>
                      <dd className="text-right font-medium text-[#34D399]">{activeProfile.workPermission}</dd>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <dt className="text-slate-400 shrink-0">
                        {isEs ? 'Punto clave' : 'Regra crítica'}
                      </dt>
                      <dd className="text-right font-medium text-[#E5C16C]">{activeProfile.criticalRule}</dd>
                    </div>
                  </dl>
                </motion.div>
              </AnimatePresence>

              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
                onClick={() => onNavigateAction(activeProfile.diagnosticPath)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 btn-radius text-xs font-bold text-white bg-white/[0.1] hover:bg-white/[0.16] border border-white/20 transition-colors whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" aria-hidden="true" />
                {isEs
                  ? 'Validar este perfil en el Diagnóstico (2 min)'
                  : 'Validar este perfil no Diagnóstico (2 min)'}
                <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </div>

        {/* Full-Width 4-Column Architectural Proof Strip Below Hero Split */}
        <div className="mt-8 lg:mt-10 pt-5 border-t border-white/12 grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">
          {proofMetrics.map((metric) => (
            <div key={metric.label} className="min-w-0 space-y-1">
              <p className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums tracking-tight whitespace-nowrap">
                {metric.value}
              </p>
              <p className="text-xs sm:text-[13px] font-medium text-slate-200 leading-snug">
                {metric.label}
              </p>
              <p className="text-[11px] font-mono text-[#D4A853]">{metric.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
