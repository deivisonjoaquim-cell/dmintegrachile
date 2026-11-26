import React from 'react';
import { ArrowRight, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useLanguage } from '../../contexts/LanguageContext';
import { sanitizeHtml } from '../../utils/formatters';
import { prefetchRouteChunk } from '../../utils/routePrefetch';
import { OptimizedImage } from '../OptimizedImage';

const EASE_EXECUTIVE = [0.16, 1, 0.3, 1] as const;

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
  const resolvedHeroImg = imagemUrl?.trim() || DEFAULT_HERO_PHOTO;

  const credentials = isEs
    ? [
        { value: '16', label: 'Subcategorías migratorias', note: 'Decreto Supremo Nº 177/2022' },
        { value: '15 Etapas', label: 'Seguimiento transparente', note: 'Portal del Cliente en línea' },
        { value: '7 Pilares', label: 'Evaluación técnica previa', note: 'Diagnóstico de viabilidad' },
        { value: 'Ley 21.325', label: 'Base jurídica chilena', note: 'Protocolo oficial SERMIG' },
      ]
    : [
        { value: '16', label: 'Subcategorias migratórias', note: 'Decreto Supremo Nº 177/2022' },
        { value: '15 Etapas', label: 'Acompanhamento transparente', note: 'Portal do Cliente online' },
        { value: '7 Pilares', label: 'Avaliação técnica prévia', note: 'Diagnóstico de viabilidade' },
        { value: 'Ley 21.325', label: 'Base jurídica chilena', note: 'Protocolo oficial SERMIG' },
      ];

  return (
    <section className="relative bg-[#070E1C] text-white overflow-hidden">
      {/* Full-bleed CMS Hero image (respecting user's uploaded/configured image) */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <OptimizedImage
          src={resolvedHeroImg}
          alt={heroTitle}
          priority
          placeholderTone="dark"
          sizes="100vw"
          containerClassName="w-full h-full"
          className="w-full h-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#060C18]/92 via-[#060C18]/72 to-[#060C18]/24"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#060C18] via-[#060C18]/20 to-[#060C18]/35"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-20 pb-14 lg:pt-28 lg:pb-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_EXECUTIVE }}
          className="max-w-3xl space-y-6"
        >
          <p className="text-xs sm:text-[13px] font-semibold tracking-[0.06em] text-[#C9A86A]">
            {eyebrow}
          </p>

          <h1 className="font-display text-[clamp(2.4rem,4.8vw,4.15rem)] font-bold tracking-[-0.034em] text-white leading-[1.06] text-balance">
            {heroTitle}
          </h1>

          <p className="text-base sm:text-lg text-slate-200 leading-[1.65] max-w-2xl">
            {heroSubtitle}
          </p>

          {heroHtml && (
            <div
              className="text-sm text-slate-300 leading-relaxed max-w-xl"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(heroHtml) }}
            />
          )}

          <div className="flex flex-wrap items-center gap-4 pt-3">
            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk(ctaDestino || '/diagnostico')}
              onTouchStart={() => prefetchRouteChunk(ctaDestino || '/diagnostico')}
              onClick={() => onNavigateAction(ctaDestino || '/diagnostico')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg text-sm font-semibold text-[#0B1628] bg-white hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              {ctaPrimario}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg text-sm font-medium text-white border border-white/25 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-4 h-4 text-slate-300" aria-hidden="true" />
              {ctaSecundario}
            </a>
          </div>

          {heroDestaques.length > 0 && (
            <div className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-300">
              {heroDestaques.map((item, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && (
                    <span aria-hidden="true" className="hidden sm:inline text-white/25">
                      ·
                    </span>
                  )}
                  <span>{item}</span>
                </React.Fragment>
              ))}
            </div>
          )}
        </motion.div>

        {/* Minimalist 4-column corporate credentials bar */}
        <div className="mt-16 lg:mt-24 pt-8 border-t border-white/15 grid grid-cols-2 lg:grid-cols-4 gap-8">
          {credentials.map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="font-mono text-xl sm:text-2xl font-semibold text-white tabular-nums tracking-tight">
                {item.value}
              </p>
              <p className="text-xs sm:text-sm font-medium text-slate-200">{item.label}</p>
              <p className="text-xs text-slate-400">{item.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
