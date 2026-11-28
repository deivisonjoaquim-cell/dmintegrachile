import React from 'react';
import { ArrowRight, CheckCircle2, Handshake, MessageCircle, ShieldCheck } from 'lucide-react';
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
        { value: '16 Rotas', label: 'Subcategorías migratorias', note: 'Decreto Supremo Nº 177/2022' },
        { value: 'Visto → RUT', label: 'Alcance directo claro', note: 'SERMIG, Estampado, PDI y Cédula' },
        { value: 'Red Aliada', label: 'Especialistas indicados', note: 'Vivienda, traducciones y SII' },
        { value: 'Ley 21.325', label: 'Base jurídica chilena', note: 'Protocolo oficial SERMIG' },
      ]
    : [
        { value: '16 Rotas', label: 'Subcategorias analisadas', note: 'Mercosul, Trabalho, Família e Renda' },
        { value: 'Visto → RUT', label: 'Escopo direto transparente', note: 'SERMIG, Estampado, PDI e Cédula' },
        { value: 'Rede Indicada', label: 'Parceiros independentes', note: 'Imóveis, traduções, cartório e SpA' },
        { value: 'Ley 21.325', label: 'Segurança jurídica real', note: 'Conformidade total com o SERMIG' },
      ];

  const scopeMilestones = isEs
    ? [
        { step: '01', title: 'Diagnóstico & Estrategia Legal', desc: 'Definimos tu visa ideal y cronograma documental en Brasil.' },
        { step: '02', title: 'Protocolo SERMIG & Estampado', desc: 'Revisión rigurosa, seguimiento de plazos y aprobación.' },
        { step: '03', title: 'Registro PDI & Cédula (RUT)', desc: 'Guía completa de ingreso, registro PDI y emisión del RUT.' },
      ]
    : [
        { step: '01', title: 'Diagnóstico & Rota Legal', desc: 'Definimos o visto ideal e o cronograma documental no Brasil.' },
        { step: '02', title: 'Protocolo SERMIG & Estampado', desc: 'Conferência técnica rigorosa e acompanhamento até a aprovação.' },
        { step: '03', title: 'Registro na PDI & Cédula (RUT)', desc: 'Orientação completa até o registro obrigatório na PDI e seu RUT.' },
      ];

  return (
    <section className="relative bg-[#070E1C] text-white overflow-hidden">
      {/* Full-bleed CMS Hero image with calibrated architectural scrim */}
      <div className="absolute inset-0 pointer-events-none select-none">
        <OptimizedImage
          src={resolvedHeroImg}
          alt={heroTitle}
          priority
          placeholderTone="dark"
          sizes="100vw"
          containerClassName="w-full h-full"
          className="w-full h-full object-cover object-center scale-[1.01]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#050B16]/95 via-[#070E1C]/82 to-[#070E1C]/48"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#070E1C] via-[#070E1C]/25 to-[#050B16]/45"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-12 pb-12 lg:pt-16 lg:pb-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          {/* Left 7 Columns — Editorial Headline & Primary Actions */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_EXECUTIVE }}
            className="lg:col-span-7 space-y-5"
          >
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="h-px w-8 bg-[#C9A86A]" />
              <p className="text-xs sm:text-[13px] font-semibold tracking-[0.08em] uppercase text-[#C9A86A]">
                {eyebrow}
              </p>
            </div>

            <h1 className="font-display text-[clamp(2.1rem,4vw,3.35rem)] font-bold tracking-[-0.032em] text-white leading-[1.07] text-balance">
              {heroTitle}
            </h1>

            <p className="text-base sm:text-[17px] text-slate-200 leading-[1.6] max-w-2xl">
              {heroSubtitle}
            </p>

            {heroHtml && (
              <div
                className="text-sm text-slate-300 leading-relaxed max-w-xl"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(heroHtml) }}
              />
            )}

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk(ctaDestino || '/diagnostico')}
                onTouchStart={() => prefetchRouteChunk(ctaDestino || '/diagnostico')}
                onClick={() => onNavigateAction(ctaDestino || '/diagnostico')}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-lg text-sm font-semibold text-[#070E1C] bg-[#E5C77B] hover:bg-[#F0D692] transition-colors whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(201,168,106,0.22)]"
              >
                {ctaPrimario}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg text-sm font-medium text-white border border-white/25 bg-white/[0.04] hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
              >
                <MessageCircle className="w-4 h-4 text-[#E5C77B]" aria-hidden="true" />
                {ctaSecundario}
              </a>
            </div>

            {heroDestaques.length > 0 && (
              <div className="pt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
                {heroDestaques.map((item, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A86A] shrink-0" aria-hidden="true" />
                    <span>{item}</span>
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Right 5 Columns — Architectural Scope & Partner Transparency Card */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: EASE_EXECUTIVE }}
            className="lg:col-span-5"
          >
            <div className="rounded-2xl border border-white/15 bg-[#0A1324]/88 backdrop-blur-md p-6 sm:p-7 space-y-6 shadow-[0_24px_64px_rgba(0,0,0,0.45)]">
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/10">
                <div className="space-y-1">
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.08em] text-[#C9A86A]">
                    {isEs ? 'Alcance Transparente D&M' : 'Escopo Transparente D&M'}
                  </p>
                  <h2 className="font-display text-lg font-bold text-white leading-snug">
                    {isEs
                      ? 'Conducción migratoria hasta tu RUT'
                      : 'Atuação direta até Visto, PDI e RUT'}
                  </h2>
                </div>
                <ShieldCheck className="w-5 h-5 text-[#C9A86A] shrink-0 mt-0.5" aria-hidden="true" />
              </div>

              <ol className="space-y-4">
                {scopeMilestones.map((item) => (
                  <li key={item.step} className="flex items-start gap-3.5">
                    <span className="font-mono text-xs font-semibold text-[#C9A86A] tabular-nums pt-0.5 shrink-0">
                      {item.step}.
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-white leading-snug">{item.title}</p>
                      <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="pt-4 border-t border-white/10 space-y-3">
                <div className="flex items-start gap-3">
                  <Handshake className="w-4 h-4 text-[#60A5FA] shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-slate-300 leading-relaxed">
                    <strong className="text-white">
                      {isEs ? '¿Necesitas vivienda, traducciones o contabilidad?' : 'Precisa de imóvel, tradução ou contabilidade?'}
                    </strong>{' '}
                    {isEs
                      ? 'Nuestro alcance directo llega hasta Visa, PDI y RUT; para vivienda y otras necesidades, recomendamos profesionales aliados independientes.'
                      : 'Nossa atuação direta vai até Visto, PDI e RUT; para imóveis e outras demandas, indicamos profissionais parceiros independentes.'}
                  </p>
                </div>
                <button
                  type="button"
                  onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                  onClick={() => onNavigateAction('/parceiros')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E5C77B] hover:text-white transition-colors"
                >
                  {isEs ? 'Conocer la Red de Aliados Indicados' : 'Conhecer a Rede de Parceiros Indicados'}
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Minimalist 4-column corporate credentials bar */}
        <div className="mt-14 lg:mt-20 pt-8 border-t border-white/15 grid grid-cols-2 lg:grid-cols-4 gap-8">
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
