import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BellRing,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  Compass,
  FileCheck2,
  MapPin,
  MessageCircle,
  Quote,
  Radar,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useLanguage } from '../contexts/LanguageContext';
import type {
  EmpresaConfig,
  LegalSource,
  PartnerPublic,
  SiteContent,
  SiteSectionKey,
} from '../types/domain';
import { buildWhatsAppUrl, openExternalSafe, sanitizeHtml } from '../utils/formatters';
import {
  sanitizePartnerImageUrl,
  translatePartnerCategory,
  translatePartnerCountry,
} from '../utils/partnerHelpers';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import { BrandLogo, BrandRibbon } from './BrandLogo';
import { OptimizedImage } from './OptimizedImage';

export interface ServiceItemMeta {
  numero: string;
  titulo: string;
  descricao: string;
  paraQuem?: string;
  subcategoriaTipica?: string;
  faixaPrazo?: string;
}

interface HomeSectionsViewProps {
  empresa: EmpresaConfig;
  siteContent: SiteContent[];
  partnersPublic: PartnerPublic[];
  onNavigate: (path: string) => void;
  onOpenLawModal?: () => void;
  onOpenCalendly?: () => void;
  previewMode?: boolean;
}

const EASE_EXECUTIVE = [0.22, 1, 0.36, 1] as const;

function getSectionThemeClasses(tema: string | undefined, defaultTheme: 'claro' | 'suave' | 'escuro-primario') {
  const active = tema || defaultTheme;
  if (active === 'escuro-primario') {
    return {
      isDark: true,
      sectionStyle: { backgroundColor: 'var(--color-primary)' } as React.CSSProperties,
      sectionClass: 'text-white',
      headingClass: 'text-white',
      subClass: 'text-slate-200',
      eyebrowClass: 'text-[#E5C76B]',
      cardClass: 'bg-white/[0.06] border border-white/15 text-white hover:bg-white/[0.09] transition-all duration-200',
    };
  }
  if (active === 'suave') {
    return {
      isDark: false,
      sectionStyle: { backgroundColor: 'var(--color-bg)' } as React.CSSProperties,
      sectionClass: 'text-[var(--color-text)]',
      headingClass: 'text-[#0B1F33] dark:text-white',
      subClass: 'text-[#4A5A6D] dark:text-slate-300',
      eyebrowClass: 'text-[#8C6D14] dark:text-[#E5C76B]',
      cardClass:
        'bg-[var(--color-surface)] border border-[#E5DFD2] dark:border-[#1C324B] shadow-[0_2px_10px_rgba(11,31,51,0.03)] hover:border-[#C8A236]/60 hover:shadow-[0_12px_30px_rgba(11,31,51,0.07)] transition-all duration-200',
    };
  }
  return {
    isDark: false,
    sectionStyle: { backgroundColor: 'var(--color-surface)' } as React.CSSProperties,
    sectionClass: 'border-y border-[#E5DFD2] dark:border-[#1C324B] text-[var(--color-text)]',
    headingClass: 'text-[#0B1F33] dark:text-white',
    subClass: 'text-[#4A5A6D] dark:text-slate-300',
    eyebrowClass: 'text-[#8C6D14] dark:text-[#E5C76B]',
    cardClass:
      'bg-[var(--color-surface)] border border-[#E5DFD2] dark:border-[#1C324B] shadow-[0_2px_10px_rgba(11,31,51,0.03)] hover:border-[#C8A236]/60 hover:shadow-[0_12px_30px_rgba(11,31,51,0.07)] transition-all duration-200',
  };
}

/**
 * Geometric 7-pillar SVG radar diagram aligned to D&M Integra Chile logo palette
 * (Deep Navy #0B1F33, Gold Star #C8A236, Brazil Emerald #146B43, Chile Crimson #A61C2B).
 */
const ArchitecturalRadarVisual: React.FC = () => {
  const cx = 110;
  const cy = 110;
  const maxR = 82;
  const sides = 7;
  const scores = [0.96, 0.92, 0.98, 0.88, 0.94, 0.9, 0.95];

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
      className="w-44 h-44 sm:w-52 sm:h-52 shrink-0 select-none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="dmRadarFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#146B43" stopOpacity="0.48" />
          <stop offset="55%" stopColor="#C8A236" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#A61C2B" stopOpacity="0.30" />
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
            r="3.2"
            fill={idx % 3 === 0 ? '#E5C76B' : idx % 3 === 1 ? '#34D399' : '#F87171'}
            stroke="#0B1F33"
            strokeWidth="1.2"
          />
        );
      })}

      <circle cx={cx} cy={cy} r="3" fill="#E5C76B" />
    </svg>
  );
};

export const HomeSectionsView: React.FC<HomeSectionsViewProps> = ({
  empresa,
  siteContent,
  partnersPublic,
  onNavigate,
  onOpenLawModal,
  onOpenCalendly,
  previewMode = false,
}) => {
  const { locale, t, translateText } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [serviceDrawer, setServiceDrawer] = useState<ServiceItemMeta | null>(null);
  const [compLocal, setCompLocal] = useState<'brasil' | 'turista_chile' | 'residente_chile'>('brasil');
  const [compObj, setCompObj] = useState<'morar_trabalhar' | 'trabalho_oferta' | 'estudar' | 'renda' | 'familia'>('morar_trabalhar');
  const [compVinculo, setCompVinculo] = useState<'nao' | 'sim'>('nao');

  const density = empresa.layoutConfig?.densidadeSecoes || 'equilibrada';
  const sectionPad =
    density === 'compacta' ? 'py-10 lg:py-12' : density === 'ampla' ? 'py-20 lg:py-28' : 'py-14 lg:py-20';

  const brandShortName = empresa.nome_empresa.split('–')[0].trim();

  const hasExplicitPartnersSection = useMemo(
    () => siteContent.some((s) => s.secao === 'parceiros'),
    [siteContent],
  );

  const orderedSections = useMemo(
    () => [...siteContent].filter((s) => s.ativo && s.secao !== 'rodape').sort((a, b) => a.ordem - b.ordem),
    [siteContent],
  );

  const authorizedTestimonials = useMemo(
    () => (empresa.depoimentosAutorizados || []).filter((d) => d.autorizado && d.depoimento.trim()),
    [empresa.depoimentosAutorizados],
  );

  const comparatorRecommendation = useMemo(() => {
    const routes = t.comparator.routes;
    if (compLocal === 'residente_chile') {
      return routes.residente;
    }
    if (compVinculo === 'sim' || compObj === 'familia') {
      return {
        titulo: routes.familia.titulo,
        baseLegal: routes.familia.baseLegal,
        protocoloRegra:
          compLocal === 'turista_chile' ? routes.familia.protocoloTurista : routes.familia.protocoloExterior,
        trabalho: routes.familia.trabalho,
        prazoEstimado: routes.familia.prazoEstimado,
        resumo: routes.familia.resumo,
        alerta: compLocal === 'turista_chile' ? routes.familia.alertaTurista : undefined,
      };
    }
    if (compObj === 'trabalho_oferta') {
      return {
        ...routes.trabalho,
        alerta: compLocal === 'turista_chile' ? routes.trabalho.alertaTurista : undefined,
      };
    }
    if (compObj === 'estudar') {
      return {
        ...routes.estudar,
        alerta: compLocal === 'turista_chile' ? routes.estudar.alertaTurista : undefined,
      };
    }
    if (compObj === 'renda') {
      return {
        ...routes.renda,
        alerta: compLocal === 'turista_chile' ? routes.renda.alertaTurista : undefined,
      };
    }
    return {
      ...routes.mercosul,
      alerta: compLocal === 'turista_chile' ? routes.mercosul.alertaTurista : undefined,
    };
  }, [compLocal, compObj, compVinculo, t]);

  const whatsappHeroUrl = buildWhatsAppUrl(empresa.whatsapp, t.hero.waGreeting);

  const navigateAction = (dest: string) => {
    if (previewMode) return;
    if (dest.startsWith('http')) {
      openExternalSafe(dest);
    } else {
      onNavigate(dest);
    }
  };

  const renderTechArchitectureBento = (keyId: string) => (
    <section
      key={keyId}
      className={`${sectionPad} bg-[#FAF9F6] dark:bg-[#091625] border-b border-[#E5DFD2] dark:border-[#1C324B]`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="max-w-3xl space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="h-[2px] w-7 bg-[#C8A236]" aria-hidden="true" />
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C6D14] dark:text-[#E5C76B]">
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
          {/* Card 1: Motor de Diagnóstico Inteligente + Radar de 7 Pilares */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: EASE_EXECUTIVE }}
            className="lg:col-span-7 relative rounded-2xl bg-gradient-to-br from-[#0B1F33] via-[#0D243C] to-[#081726] text-white border border-[#1E3A5F] hover:border-[#C8A236]/55 overflow-hidden shadow-[0_20px_46px_rgba(11,31,51,0.22)] transition-colors duration-200 flex flex-col justify-between"
          >
            <BrandRibbon className="h-[3px] w-full" />
            <div className="p-6 sm:p-8 flex flex-col justify-between gap-6 flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-3 flex-1">
                  <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#E5C76B]">
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
                {t.techBento.radarCard.pillars.map((pillar) => (
                  <div
                    key={pillar.label}
                    className="rounded-xl bg-white/[0.05] border border-white/10 px-3 py-2.5 backdrop-blur-xs"
                  >
                    <p className="font-mono text-base font-bold text-[#E5C76B] tabular-nums">
                      {pillar.score}
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{pillar.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => navigateAction('/diagnostico')}
                  className="inline-flex items-center gap-2 px-5 py-3 btn-radius text-xs font-bold text-[#0B1523] shadow-[0_8px_20px_rgba(200,162,54,0.28)] transition-all duration-150 hover:opacity-95 hover:-translate-y-0.5 whitespace-nowrap"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  {t.techBento.radarCard.cta}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Monitoramento & Alertas Automáticos 30 Dias */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.06, ease: EASE_EXECUTIVE }}
            className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] hover:border-[#C8A236]/55 p-6 sm:p-8 flex flex-col justify-between gap-6 shadow-[0_10px_30px_rgba(11,31,51,0.05)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.3)] transition-colors duration-200"
          >
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#A61C2B] dark:text-rose-400">
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

            <div className="space-y-3">
              {t.techBento.alertsCard.rules.map((rule, idx) => (
                <div
                  key={rule.code}
                  className="flex items-start gap-3.5 p-3.5 rounded-xl bg-[#FAF9F6] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1F3752]"
                >
                  <span
                    className={`font-mono text-xs font-bold px-2.5 py-1.5 rounded-lg tabular-nums shrink-0 ${
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
                    <p className="text-[11.5px] text-[#4A5A6D] dark:text-slate-300 leading-relaxed mt-0.5">{rule.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Card 3: Portal do Cliente & Identidade Oficial */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, delay: 0.12, ease: EASE_EXECUTIVE }}
            className="lg:col-span-12 rounded-2xl bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] hover:border-[#C8A236]/55 p-6 sm:p-8 shadow-[0_10px_30px_rgba(11,31,51,0.05)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.3)] transition-colors duration-200"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-8 space-y-3">
                <div className="flex items-center gap-3">
                  <BrandLogo
                    variant="emblem"
                    lazy
                    alt={empresa.nome_empresa}
                    brandShortName={brandShortName}
                    imgClassName="w-11 h-11 object-contain shrink-0"
                  />
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#146B43] dark:text-emerald-400">
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
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FAF9F6] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1F3752] text-[11.5px] font-semibold text-[#0B1F33] dark:text-slate-100"
                    >
                      <span className="font-mono text-[10px] font-bold text-[#8C6D14] dark:text-[#E5C76B] tabular-nums">
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
                  onClick={() => navigateAction('/acompanhar')}
                  className="w-full lg:w-64 inline-flex items-center justify-center gap-2 px-5 py-3 btn-radius text-xs font-semibold text-white transition-all duration-150 hover:opacity-95 hover:-translate-y-0.5 whitespace-nowrap"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <FileCheck2 className="w-4 h-4 text-[#E5C76B]" />
                  {t.techBento.portalCard.primaryCta}
                </button>
                <button
                  type="button"
                  onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
                  onTouchStart={() => prefetchRouteChunk('/diagnostico')}
                  onClick={() => navigateAction('/diagnostico')}
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

  const renderPartnersGrid = (
    sec: { titulo: string; subtitulo: string; conteudoHtml?: string; ctaTexto?: string; ctaDestino?: string; metadados?: Record<string, unknown> },
    keyId: string,
  ) => {
    if (partnersPublic.length === 0) return null;
    const meta = (sec.metadados || {}) as Record<string, unknown>;
    const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'suave');
    const maxItens = Math.max(1, Number(meta.maxItens || 3));
    return (
      <section key={keyId} className={`cv-auto ${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              {Boolean(meta.eyebrow) && (
                <p className={`text-xs font-semibold mb-1.5 ${theme.eyebrowClass}`}>
                  {translateText(String(meta.eyebrow))}
                </p>
              )}
              <h2 className={`font-display text-2xl sm:text-3xl font-bold text-balance mb-2 ${theme.headingClass}`}>
                {translateText(sec.titulo)}
              </h2>
              <p className={`text-base ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>
              {sec.conteudoHtml && (
                <p className={`text-xs mt-2 ${theme.subClass}`}>{translateText(sec.conteudoHtml)}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                onFocus={() => prefetchRouteChunk('/parceiros')}
                onClick={() => navigateAction('/parceiros?secao=mapa')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                  theme.isDark
                    ? 'border-white/25 text-white hover:bg-white/10'
                    : 'border-[#DDD6C7] dark:border-[#243E5C] bg-white dark:bg-[#11263D] text-[#0B1F33] dark:text-[#E5C76B] hover:border-[#C8A236]/80'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-[#146B43] dark:text-emerald-400" />
                {locale === 'es-CL' ? 'Mapa en Chile' : 'Mapa no Chile'}
              </button>
              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                onFocus={() => prefetchRouteChunk('/parceiros')}
                onClick={() => navigateAction(sec.ctaDestino || '/parceiros')}
                className={`inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap shrink-0 hover:underline ${
                  theme.isDark ? 'text-[#E5C76B]' : 'text-[#0B1F33] dark:text-[#E5C76B]'
                }`}
              >
                {translateText(sec.ctaTexto) || t.sections.partnersDefaultCta}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {partnersPublic.slice(0, maxItens).map((p, idx) => {
              const safeLogo = sanitizePartnerImageUrl(p.logoUrl);
              return (
                <motion.article
                  key={p.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{
                    duration: 0.36,
                    delay: Math.min(idx * 0.06, 0.24),
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={`${theme.cardClass} card-radius p-6 flex flex-col justify-between transition-all duration-200 hover:border-[#C8A236]/80 hover:-translate-y-0.5`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 text-xs mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {safeLogo && (
                          <div className="h-10 w-16 rounded-md bg-white border border-[#E5DFD2] flex items-center justify-center overflow-hidden shrink-0">
                            <OptimizedImage
                              src={safeLogo}
                              alt={p.nome}
                              sizes="64px"
                              containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                              className="max-w-full max-h-full object-contain p-1"
                            />
                          </div>
                        )}
                        <span className={`font-semibold truncate ${theme.isDark ? 'text-[#E5C76B]' : 'text-[#8C6D14] dark:text-[#E5C76B]'}`}>
                          {translatePartnerCategory(p.categoria, locale)} · {translatePartnerCountry(p.pais, locale)}
                        </span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-semibold tabular-nums shrink-0 ${
                          theme.isDark ? 'text-white' : 'text-[#0B1F33] dark:text-slate-100'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                        {Number(p.avaliacao || 5).toFixed(1)}/5
                      </span>
                    </div>
                    <h3 className={`text-base font-bold mb-2 ${theme.headingClass}`}>{p.nome}</h3>
                    <p className={`text-sm leading-relaxed mb-4 ${theme.subClass}`}>{p.descricaoPublica}</p>
                  </div>

                  <div
                    className={`pt-3.5 border-t flex items-center justify-between gap-3 ${
                      theme.isDark ? 'border-white/15' : 'border-[#F1EDE4] dark:border-[#1C324B]'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center gap-1 text-xs truncate ${
                        theme.isDark ? 'text-slate-300' : 'text-[#4A5A6D] dark:text-slate-300'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <span className="truncate">{p.cidadeRegiao}</span>
                    </span>
                    <button
                      type="button"
                      onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                      onClick={() => navigateAction('/parceiros?secao=mapa')}
                      className={`text-xs font-semibold whitespace-nowrap shrink-0 hover:underline ${
                        theme.isDark ? 'text-[#E5C76B]' : 'text-[#0B1F33] dark:text-[#E5C76B]'
                      }`}
                    >
                      {locale === 'es-CL' ? 'Ver en mapa →' : 'Ver no mapa →'}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>
    );
  };

  const renderSection = (sec: SiteContent) => {
    const key: SiteSectionKey = sec.secao;
    const meta = (sec.metadados || {}) as Record<string, unknown>;
    const imgFitClass = meta.imagemObjectFit === 'contain' ? 'object-contain bg-slate-50 p-3' : 'object-cover';

    if (key === 'hero') {
      const variante = (meta.varianteLayout as string) || 'split-direita';
      const rawDestaques = (meta.destaques as string[] | undefined) || [
        'Atendimento 100% em português do Brasil',
        'Base normativa alinhada à Ley 21.325 e SERMIG',
        'Acompanhamento transparente em 15 etapas',
      ];
      const heroDestaques = rawDestaques.map((d) => translateText(d));
      const eyebrow = translateText(meta.eyebrow as string | undefined) || t.hero.defaultEyebrow;
      const ctaPrimario = translateText(sec.ctaTexto || (meta.ctaPrimario as string | undefined)) || t.hero.defaultPrimaryCta;
      const ctaSecundario = translateText(meta.ctaSecundario as string | undefined) || t.hero.defaultSecondaryCta;
      const badgeTitulo = translateText(meta.badgeTitulo as string | undefined) || t.hero.defaultBadgeTitle;
      const badgeSubtitulo = translateText(meta.badgeSubtitulo as string | undefined) || t.hero.defaultBadgeSubtitle;
      const heroTitle = translateText(sec.titulo);
      const heroSubtitle = translateText(sec.subtitulo);
      const heroHtml = translateText(sec.conteudoHtml);

      if (variante === 'banner-cheio') {
        return (
          <React.Fragment key={sec.id}>
            <section className="relative overflow-hidden bg-[#0B1F33] text-white border-b border-slate-800">
              {sec.imagemUrl && (
                <OptimizedImage
                  src={sec.imagemUrl}
                  alt={heroTitle}
                  priority
                  placeholderTone="dark"
                  sizes="100vw"
                  containerClassName="absolute inset-0 w-full h-full overflow-hidden"
                  className="w-full h-full object-cover opacity-35"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#071422]/95 via-[#0B1F33]/80 to-[#0B1F33]/55" />
              <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
                <div className="max-w-3xl space-y-5">
                  <div className="flex items-center gap-3">
                    <BrandLogo
                      variant="emblem-dark"
                      alt={empresa.nome_empresa}
                      brandShortName={brandShortName}
                      imgClassName="w-10 h-10 object-contain shrink-0"
                    />
                    <p className="text-xs font-semibold tracking-[0.12em] uppercase text-[#E5C76B]">{eyebrow}</p>
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-balance">
                    {heroTitle}
                  </h1>
                  <p className="text-base sm:text-lg text-slate-200 leading-relaxed">{heroSubtitle}</p>
                  {heroHtml && (
                    <div
                      className="text-sm text-slate-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(heroHtml) }}
                    />
                  )}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                      className="inline-flex items-center gap-2 px-6 py-3.5 btn-radius text-sm font-bold text-[#0B1523] transition-opacity hover:opacity-95 whitespace-nowrap"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    >
                      {ctaPrimario}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <a
                      href={whatsappHeroUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-3.5 btn-radius text-sm font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {ctaSecundario}
                    </a>
                  </div>
                </div>
                {heroDestaques.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-white/15 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {heroDestaques.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                        <p className="text-sm font-medium text-slate-100">{item}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            {renderTechArchitectureBento(`${sec.id}_tech_bento`)}
          </React.Fragment>
        );
      }

      if (variante === 'centralizado') {
        return (
          <React.Fragment key={sec.id}>
            <section className="bg-[var(--color-surface)] border-b border-[#E5DFD2] dark:border-[#1C324B]">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 lg:py-20 text-center space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <BrandLogo
                    variant="emblem"
                    alt={empresa.nome_empresa}
                    brandShortName={brandShortName}
                    imgClassName="w-14 h-14 object-contain"
                  />
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C6D14] dark:text-[#E5C76B]">{eyebrow}</p>
                </div>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#0B1F33] dark:text-white leading-[1.1] text-balance">
                  {heroTitle}
                </h1>
                <p className="text-base sm:text-lg text-[#4A5A6D] dark:text-slate-300 leading-relaxed max-w-3xl mx-auto">{heroSubtitle}</p>
                {heroHtml && (
                  <div
                    className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed max-w-2xl mx-auto"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(heroHtml) }}
                  />
                )}
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 btn-radius text-sm font-semibold text-white transition-opacity hover:opacity-95 whitespace-nowrap"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {ctaPrimario}
                    <ArrowRight className="w-4 h-4 text-[#E5C76B]" />
                  </button>
                  <a
                    href={whatsappHeroUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3.5 btn-radius text-sm font-semibold text-[#0B1F33] dark:text-slate-100 border border-[#DDD6C7] dark:border-[#243E5C] bg-white dark:bg-[#11263D] hover:bg-[#FAF9F6] dark:hover:bg-[#183350] whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4 text-[#146B43] dark:text-emerald-400" />
                    {ctaSecundario}
                  </a>
                </div>
                {sec.imagemUrl && (
                  <div className="relative h-64 sm:h-96 card-radius overflow-hidden border border-[#E5DFD2] dark:border-[#1C324B] bg-[#0B1F33] text-left mt-8">
                    <OptimizedImage
                      src={sec.imagemUrl}
                      alt={heroTitle}
                      priority
                      placeholderTone="dark"
                      sizes="(max-width: 1024px) 100vw, 960px"
                      className={`w-full h-full ${imgFitClass}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#071422]/85 via-transparent to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#E5C76B]">{badgeTitulo}</p>
                      <p className="text-base font-semibold mt-0.5">{badgeSubtitulo}</p>
                    </div>
                  </div>
                )}
                {heroDestaques.length > 0 && (
                  <div className="mt-10 pt-8 border-t border-[#E5DFD2] dark:border-[#1C324B] grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                    {heroDestaques.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                        <p className="text-sm font-medium text-[#0B1F33] dark:text-slate-200">{item}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            {renderTechArchitectureBento(`${sec.id}_tech_bento`)}
          </React.Fragment>
        );
      }

      const imageFirst = variante === 'split-esquerda';
      return (
        <React.Fragment key={sec.id}>
          <section className="bg-[var(--color-surface)] border-b border-[#E5DFD2] dark:border-[#1C324B] relative overflow-hidden">
            {/* Grade arquitetônica sutil + luz atmosférica inspirada em precisão cartográfica Brasil–Chile */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.34] dark:opacity-[0.14]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 1px 1px, rgba(200, 162, 54, 0.24) 1px, transparent 0)',
                backgroundSize: '28px 28px',
              }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-28 -left-24 w-[420px] h-[420px] rounded-full opacity-[0.12] dark:opacity-[0.16] blur-3xl"
              style={{ background: 'radial-gradient(circle, #C8A236 0%, transparent 72%)' }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-32 right-12 w-[360px] h-[360px] rounded-full opacity-[0.09] dark:opacity-[0.14] blur-3xl"
              style={{ background: 'radial-gradient(circle, #146B43 0%, transparent 72%)' }}
            />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-20">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: EASE_EXECUTIVE }}
                  className={`lg:col-span-7 flex flex-col justify-center ${imageFirst ? 'lg:order-2' : 'lg:order-1'}`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <span className="h-[2px] w-7 shrink-0 bg-[#C8A236]" aria-hidden="true" />
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C6D14] dark:text-[#E5C76B]">
                      {eyebrow}
                    </p>
                  </div>

                  <h1 className="font-display text-[clamp(2.2rem,3.8vw,3.45rem)] font-bold tracking-[-0.025em] text-[#0B1F33] dark:text-white leading-[1.08] text-balance mb-5">
                    {heroTitle}
                  </h1>

                  <p className="text-base sm:text-[17px] text-[#4A5A6D] dark:text-slate-300 leading-[1.65] max-w-2xl mb-4">
                    {heroSubtitle}
                  </p>

                  {heroHtml && (
                    <div
                      className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed max-w-2xl mb-7"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(heroHtml) }}
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-3.5 pt-1">
                    <button
                      type="button"
                      onMouseEnter={() => prefetchRouteChunk(sec.ctaDestino || '/diagnostico')}
                      onTouchStart={() => prefetchRouteChunk(sec.ctaDestino || '/diagnostico')}
                      onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                      className="inline-flex items-center gap-2.5 px-6.5 py-3.5 btn-radius text-sm font-semibold text-white shadow-[0_10px_26px_rgba(11,31,51,0.24)] transition-all duration-150 hover:opacity-95 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      {ctaPrimario}
                      <ArrowRight className="w-4 h-4 text-[#E5C76B]" />
                    </button>
                    <a
                      href={whatsappHeroUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5.5 py-3.5 btn-radius text-sm font-semibold text-[#0B1F33] dark:text-slate-100 border border-[#DDD6C7] dark:border-[#243E5C] bg-white dark:bg-[#11263D] hover:bg-[#FAF9F6] dark:hover:bg-[#183350] hover:border-[#C8A236]/70 transition-all duration-150 whitespace-nowrap shrink-0"
                    >
                      <MessageCircle className="w-4 h-4 text-[#146B43] dark:text-emerald-400" />
                      {ctaSecundario}
                    </a>
                  </div>

                  {/* Faixa de métricas arquitetônicas com paleta da marca */}
                  <div className="mt-8 pt-6 border-t border-[#E5DFD2] dark:border-[#1C324B] grid grid-cols-3 gap-4 max-w-xl">
                    <div>
                      <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#0B1F33] dark:text-white">
                        {t.hero.metric1Value}
                      </p>
                      <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-0.5">{t.hero.metric1Label}</p>
                    </div>
                    <div>
                      <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#8C6D14] dark:text-[#E5C76B]">
                        {t.hero.metric2Value}
                      </p>
                      <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-0.5">{t.hero.metric2Label}</p>
                    </div>
                    <div>
                      <p className="text-lg sm:text-xl font-bold font-mono tabular-nums text-[#146B43] dark:text-emerald-400">
                        {t.hero.metric3Value}
                      </p>
                      <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-0.5">{t.hero.metric3Label}</p>
                    </div>
                  </div>
                </motion.div>

                {/* Quadro visual flagship guiado pela logo oficial D&M Integra Chile */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.08, ease: EASE_EXECUTIVE }}
                  className={`lg:col-span-5 ${imageFirst ? 'lg:order-1' : 'lg:order-2'}`}
                >
                  <div className="group relative h-full min-h-[430px] card-radius overflow-hidden border border-[#1E3A5F]/25 dark:border-[#C8A236]/25 bg-[#0B1F33] shadow-[0_24px_60px_rgba(11,31,51,0.24)] flex flex-col justify-between">
                    {sec.imagemUrl ? (
                      <OptimizedImage
                        src={sec.imagemUrl}
                        alt={heroTitle}
                        priority
                        placeholderTone="dark"
                        sizes="(max-width: 1024px) 100vw, 42vw"
                        containerClassName="absolute inset-0 w-full h-full overflow-hidden"
                        className={`w-full h-full ${imgFitClass} transition-transform duration-700 group-hover:scale-[1.03]`}
                      />
                    ) : null}

                    <div className="absolute inset-0 bg-gradient-to-b from-[#071422]/75 via-[#071422]/35 to-[#071422]/94" />

                    {/* Cabeçalho com Emblema Oficial D&M Integra Chile */}
                    <div className="relative z-10 p-5 sm:p-6">
                      <div className="inline-flex items-center gap-3 rounded-xl bg-[#071422]/82 backdrop-blur-md border border-white/15 px-3.5 py-2.5 max-w-full">
                        <BrandLogo
                          variant="emblem-dark"
                          alt={empresa.nome_empresa}
                          brandShortName={brandShortName}
                          imgClassName="w-10 h-10 object-contain shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B] truncate">
                            {t.hero.crestLabel}
                          </p>
                          <p className="text-xs text-slate-200 truncate">{t.hero.crestTagline}</p>
                        </div>
                      </div>
                    </div>

                    {/* Painel inferior executivo com módulos da plataforma */}
                    <div className="relative z-10 p-5 sm:p-6 space-y-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="h-[2px] w-5 bg-[#C8A236]" aria-hidden="true" />
                          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">
                            {badgeTitulo}
                          </p>
                        </div>
                        <p className="text-sm sm:text-base font-semibold text-white leading-snug">
                          {badgeSubtitulo}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 rounded-xl bg-[#071422]/82 backdrop-blur-md border border-white/12 p-3">
                        {t.hero.intelModules.map((mod) => (
                          <div
                            key={mod.code}
                            className="flex items-center justify-between gap-3 py-1 border-b border-white/10 last:border-b-0 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] font-bold text-[#E5C76B] tabular-nums">
                                {mod.code}
                              </span>
                              <span className="text-slate-300 truncate">{mod.label}</span>
                            </div>
                            <span className="font-mono text-[11px] font-semibold text-white whitespace-nowrap shrink-0">
                              {mod.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {heroDestaques.length > 0 && (
                <div className="mt-12 pt-7 border-t border-[#E5DFD2] dark:border-[#1C324B] grid grid-cols-1 md:grid-cols-3 gap-6">
                  {heroDestaques.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <ShieldCheck
                        className="w-5 h-5 shrink-0 mt-0.5"
                        style={{ color: idx === 0 ? '#146B43' : idx === 1 ? '#C8A236' : '#A61C2B' }}
                      />
                      <p className="text-sm font-medium text-[#0B1F33] dark:text-slate-200 leading-snug">{item}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {renderTechArchitectureBento(`${sec.id}_tech_bento`)}
        </React.Fragment>
      );
    }

    if (key === 'servicos') {
      const servicosItens = (meta.itens as ServiceItemMeta[] | undefined) || [];
      const variante = (meta.varianteLayout as string) || 'grade-2';
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'suave');
      const showComparator = meta.mostrarComparador !== false;
      const gridClass =
        variante === 'grade-4'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5'
          : variante === 'lista-editorial'
            ? 'space-y-4'
            : 'grid grid-cols-1 md:grid-cols-2 gap-6';

      const plans = t.services.plans;

      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
            <div>
              <div className="max-w-3xl mb-10">
                <p className={`text-[11px] font-bold uppercase tracking-[0.14em] mb-2.5 ${theme.eyebrowClass}`}>
                  {translateText(meta.eyebrow as string | undefined) || t.services.defaultEyebrow}
                </p>
                <h2 className={`font-display text-2xl sm:text-[34px] font-bold tracking-tight leading-tight text-balance mb-3 ${theme.headingClass}`}>
                  {translateText(sec.titulo)}
                </h2>
                <p className={`text-base leading-relaxed ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>
              </div>

              <div className={gridClass}>
                {servicosItens.map((item) => {
                  const localizedItem: ServiceItemMeta = {
                    ...item,
                    titulo: translateText(item.titulo),
                    descricao: translateText(item.descricao),
                  };
                  return (
                    <div
                      key={item.numero}
                      className={`${theme.cardClass} card-radius p-6 sm:p-7 flex ${
                        variante === 'lista-editorial' ? 'flex-col md:flex-row md:items-center' : 'flex-col'
                      } justify-between gap-5`}
                    >
                      <div className="flex-1">
                        <p
                          className={`text-[11px] font-bold uppercase tracking-[0.12em] mb-2.5 tabular-nums ${
                            theme.isDark ? 'text-[#E5C76B]' : 'text-[#8F6F16]'
                          }`}
                        >
                          {localizedItem.numero} · {t.services.solutionPrefix}
                        </p>
                        <h3 className={`text-lg font-bold tracking-tight mb-2 ${theme.headingClass}`}>
                          {localizedItem.titulo}
                        </h3>
                        <p className={`text-sm leading-relaxed ${theme.subClass}`}>{localizedItem.descricao}</p>
                      </div>
                      <div className={`shrink-0 pt-3 border-t ${theme.isDark ? 'border-white/15' : 'border-[#F1EDE4]'}`}>
                        <button
                          type="button"
                          onClick={() => !previewMode && setServiceDrawer(localizedItem)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold hover:underline underline-offset-4 ${
                            theme.isDark ? 'text-[#E5C76B]' : ''
                          }`}
                          style={!theme.isDark ? { color: 'var(--color-primary)' } : undefined}
                        >
                          {t.services.learnMore}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modalidades de Consultoria: Diagnóstico Gratuito, Orientativa e Completa */}
            <div className="pt-4 space-y-6">
              <div className="max-w-3xl">
                <p className={`text-[11px] font-bold uppercase tracking-[0.14em] mb-2 ${theme.eyebrowClass}`}>
                  {t.services.plansKicker}
                </p>
                <h3 className={`font-display text-xl sm:text-3xl font-bold tracking-tight text-balance mb-2 ${theme.headingClass}`}>
                  {t.services.plansTitle}
                </h3>
                <p className={`text-sm sm:text-base leading-relaxed ${theme.subClass}`}>
                  {t.services.plansSubtitlePrefix}
                  <strong>{t.services.plansOrientativaBold}</strong>
                  {t.services.plansOrientativaDesc}
                  <strong>{t.services.plansCompletaBold}</strong>
                  {t.services.plansCompletaDesc}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
                {/* 1. Diagnóstico Gratuito */}
                <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] hover:border-[#C8A236]/60 card-radius p-6 flex flex-col justify-between gap-6 text-[#0B1F33] dark:text-white shadow-[0_4px_18px_rgba(11,31,51,0.04)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.28)] transition-all duration-200 hover:-translate-y-0.5">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8C6D14] dark:text-[#E5C76B]">
                        {plans.diagnostico_gratuito.kicker}
                      </p>
                      <h4 className="text-lg font-bold tracking-tight text-[#0B1F33] dark:text-white">
                        {plans.diagnostico_gratuito.nome}
                      </h4>
                      <p className="text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                        {plans.diagnostico_gratuito.subtitulo}
                      </p>
                    </div>
                    <p className="text-[11px] font-semibold text-[#0B1F33] dark:text-slate-200 pt-3 border-t border-[#F1EDE4] dark:border-[#1C324B]">
                      {plans.diagnostico_gratuito.escopoPrefix} {plans.diagnostico_gratuito.responsavelProtocolo}
                    </p>
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {plans.diagnostico_gratuito.inclui.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#146B43] dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateAction('/diagnostico')}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 btn-radius border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 hover:bg-[#F1EDE4] dark:hover:bg-[#183350] transition-colors"
                  >
                    {plans.diagnostico_gratuito.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2. Consultoria Orientativa */}
                <div className="bg-white dark:bg-[#0D1E31] border border-[#0B1F33]/30 dark:border-[#2E547A] hover:border-[#C8A236]/70 card-radius p-6 flex flex-col justify-between gap-6 text-[#0B1F33] dark:text-white shadow-[0_8px_26px_rgba(11,31,51,0.06)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.32)] transition-all duration-200 hover:-translate-y-0.5">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0B1F33] dark:text-[#E5C76B]">
                        {plans.orientativa.kicker}
                      </p>
                      <h4 className="text-lg font-bold tracking-tight text-[#0B1F33] dark:text-white">
                        {plans.orientativa.nome}
                      </h4>
                      <p className="text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                        {plans.orientativa.subtitulo}
                      </p>
                    </div>
                    <p className="text-[11px] font-semibold text-[#0B1F33] dark:text-slate-200 pt-3 border-t border-[#F1EDE4] dark:border-[#1C324B]">
                      {plans.orientativa.escopoPrefix} {plans.orientativa.responsavelProtocolo}
                    </p>
                    <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                      {plans.orientativa.inclui.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#0B1F33] dark:text-[#E5C76B] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a
                    href={buildWhatsAppUrl(empresa.whatsapp, plans.orientativa.waMessage || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 btn-radius text-xs font-semibold text-white transition-opacity hover:opacity-95"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {plans.orientativa.cta}
                  </a>
                </div>

                {/* 3. Consultoria Completa */}
                <div
                  className="card-radius p-6 flex flex-col justify-between gap-6 text-white shadow-[0_18px_40px_rgba(11,31,51,0.26)] border border-[#C8A236]/60 bg-gradient-to-br from-[#0B1F33] via-[#0F2A46] to-[#081726] transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B]">
                        {plans.completa.kicker}
                      </p>
                      <h4 className="text-lg font-bold tracking-tight text-white">
                        {plans.completa.nome}
                      </h4>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {plans.completa.subtitulo}
                      </p>
                    </div>
                    <p className="text-[11px] font-semibold text-[#E5C76B] pt-3 border-t border-white/15">
                      {plans.completa.escopoPrefix} {plans.completa.responsavelProtocolo}
                    </p>
                    <ul className="space-y-2 text-xs text-slate-100">
                      {plans.completa.inclui.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#E5C76B] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a
                    href={buildWhatsAppUrl(empresa.whatsapp, plans.completa.waMessage || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 btn-radius text-xs font-bold text-[#0B1523] shadow-[0_6px_18px_rgba(200,162,54,0.28)] transition-opacity hover:opacity-95"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {plans.completa.cta}
                  </a>
                </div>
              </div>
            </div>

            {showComparator && (
              <div className="bg-[var(--color-surface)] border border-[#E5DFD2] dark:border-[#1C324B] card-radius overflow-hidden shadow-[0_12px_34px_rgba(11,31,51,0.07)] dark:shadow-[0_16px_38px_rgba(0,0,0,0.34)] text-[#0B1F33] dark:text-white">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-7 p-6 sm:p-8 space-y-5 flex flex-col justify-center">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8C6D14] dark:text-[#E5C76B]">
                          {t.comparator.kicker}
                        </p>
                      </div>
                      <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#0B1F33] dark:text-white">
                        {t.comparator.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                        {t.comparator.subtitle}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                      <div>
                        <label className="block font-semibold text-[#0B1F33] dark:text-slate-200 mb-1.5">{t.comparator.labelWhere}</label>
                        <select
                          value={compLocal}
                          onChange={(e) => setCompLocal(e.target.value as typeof compLocal)}
                          className="w-full px-3 py-2.5 btn-radius border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-[#0B1F33] dark:text-slate-100 focus:bg-white dark:focus:bg-[#16304D] focus:border-[#0B1F33] dark:focus:border-[#E5C76B] focus:outline-none transition-colors"
                        >
                          <option value="brasil">{t.comparator.whereOptions.brasil}</option>
                          <option value="turista_chile">{t.comparator.whereOptions.turista_chile}</option>
                          <option value="residente_chile">{t.comparator.whereOptions.residente_chile}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-[#0B1F33] dark:text-slate-200 mb-1.5">{t.comparator.labelGoal}</label>
                        <select
                          value={compObj}
                          onChange={(e) => setCompObj(e.target.value as typeof compObj)}
                          className="w-full px-3 py-2.5 btn-radius border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-[#0B1F33] dark:text-slate-100 focus:bg-white dark:focus:bg-[#16304D] focus:border-[#0B1F33] dark:focus:border-[#E5C76B] focus:outline-none transition-colors"
                        >
                          <option value="morar_trabalhar">{t.comparator.goalOptions.morar_trabalhar}</option>
                          <option value="trabalho_oferta">{t.comparator.goalOptions.trabalho_oferta}</option>
                          <option value="estudar">{t.comparator.goalOptions.estudar}</option>
                          <option value="renda">{t.comparator.goalOptions.renda}</option>
                          <option value="familia">{t.comparator.goalOptions.familia}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-[#0B1F33] dark:text-slate-200 mb-1.5">{t.comparator.labelTie}</label>
                        <select
                          value={compVinculo}
                          onChange={(e) => setCompVinculo(e.target.value as typeof compVinculo)}
                          className="w-full px-3 py-2.5 btn-radius border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-[#0B1F33] dark:text-slate-100 focus:bg-white dark:focus:bg-[#16304D] focus:border-[#0B1F33] dark:focus:border-[#E5C76B] focus:outline-none transition-colors"
                        >
                          <option value="nao">{t.comparator.tieOptions.nao}</option>
                          <option value="sim">{t.comparator.tieOptions.sim}</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div
                    className="lg:col-span-5 p-6 sm:p-8 text-white flex flex-col justify-between space-y-5 border-t lg:border-t-0 lg:border-l border-white/10 bg-gradient-to-br from-[#0B1F33] to-[#081726]"
                  >
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E5C76B]">
                          {t.comparator.resultKicker}
                        </p>
                        <p className="font-display text-lg sm:text-xl font-bold tracking-tight text-white leading-snug">
                          {comparatorRecommendation.titulo}
                        </p>
                        <p className="text-[11px] font-mono text-slate-300">
                          {comparatorRecommendation.baseLegal}
                        </p>
                      </div>
                      <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed">
                        {comparatorRecommendation.resumo}
                      </p>
                      <dl className="grid grid-cols-1 gap-2 pt-2.5 border-t border-white/15 text-[11px]">
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-slate-400">{t.comparator.dtProtocol}</dt>
                          <dd className="text-right font-semibold text-white">{comparatorRecommendation.protocoloRegra}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-slate-400">{t.comparator.dtWork}</dt>
                          <dd className="text-right font-semibold text-emerald-300">{comparatorRecommendation.trabalho}</dd>
                        </div>
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="text-slate-400">{t.comparator.dtReference}</dt>
                          <dd className="text-right font-mono tabular-nums text-[#E5C76B]">{comparatorRecommendation.prazoEstimado}</dd>
                        </div>
                      </dl>
                      {comparatorRecommendation.alerta && (
                        <p className="text-[11px] font-medium text-amber-100 bg-amber-500/15 border border-amber-400/35 rounded-lg p-2.5 leading-relaxed">
                          {comparatorRecommendation.alerta}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateAction('/diagnostico')}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 btn-radius text-xs font-bold text-[#0B1523] transition-all duration-150 hover:opacity-95"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    >
                      {t.comparator.ctaValidate}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      );
    }

    if (key === 'diferenciais') {
      const difItens = (meta.itens as { titulo: string; descricao: string }[] | undefined) || [];
      const variante = (meta.varianteLayout as string) || 'imagem-esquerda';
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'claro');
      const noImage = variante === 'sem-imagem' || !sec.imagemUrl;
      const imageRight = variante === 'imagem-direita';

      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass} cv-auto`} style={theme.sectionStyle}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            {!noImage && (
              <div className={`lg:col-span-5 ${imageRight ? 'lg:order-2' : 'lg:order-1'}`}>
                <div className="group h-72 lg:h-full min-h-[300px] card-radius overflow-hidden border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#0D1E31] shadow-[0_14px_36px_rgba(11,31,51,0.1)]">
                  <OptimizedImage
                    src={sec.imagemUrl}
                    alt={translateText(sec.titulo)}
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className={`w-full h-full ${imgFitClass} transition-transform duration-700 group-hover:scale-[1.03]`}
                  />
                </div>
              </div>
            )}
            <div className={`${noImage ? 'lg:col-span-12 max-w-4xl mx-auto' : 'lg:col-span-7'} flex flex-col justify-center ${imageRight ? 'lg:order-1' : 'lg:order-2'}`}>
              <p className={`text-[11px] font-bold uppercase tracking-[0.14em] mb-2 ${theme.eyebrowClass}`}>
                {translateText(meta.eyebrow as string | undefined) || t.sections.diferenciaisEyebrow}
              </p>
              <h2 className={`font-display text-2xl sm:text-3xl font-bold text-balance mb-3 ${theme.headingClass}`}>
                {translateText(sec.titulo)}
              </h2>
              <p className={`text-base mb-8 ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>
              <div className="space-y-6">
                {difItens.map((d, idx) => (
                  <div key={idx} className={`pb-6 border-b ${theme.isDark ? 'border-white/15' : 'border-[#E5DFD2] dark:border-[#1C324B]'} last:border-b-0 last:pb-0`}>
                    <h3 className={`text-base font-bold mb-1 ${theme.headingClass}`}>{translateText(d.titulo)}</h3>
                    <p className={`text-sm leading-relaxed ${theme.subClass}`}>{translateText(d.descricao)}</p>
                  </div>
                ))}
              </div>
              {onOpenLawModal && (
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={onOpenLawModal}
                    className={`inline-flex items-center gap-2 text-sm font-semibold hover:underline ${theme.isDark ? 'text-white' : 'text-[#0B1F33] dark:text-[#E5C76B]'}`}
                  >
                    <BookOpen className="w-4 h-4" />
                    {t.sections.understandLawCta}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (key === 'como_funciona') {
      const passos = (meta.passos as { passo: string; titulo: string; descricao: string }[] | undefined) || [];
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'suave');
      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-12">
              {Boolean(meta.eyebrow) && (
                <p className={`text-[11px] font-bold uppercase tracking-[0.14em] mb-2.5 ${theme.eyebrowClass}`}>
                  {translateText(String(meta.eyebrow))}
                </p>
              )}
              <h2 className={`font-display text-2xl sm:text-[34px] font-bold tracking-tight leading-tight text-balance mb-3 ${theme.headingClass}`}>
                {translateText(sec.titulo)}
              </h2>
              <p className={`text-base leading-relaxed ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {passos.map((p) => (
                <div key={p.passo} className={`${theme.cardClass} card-radius p-6 sm:p-7 flex flex-col justify-between`}>
                  <div>
                    <div className={`flex items-center justify-between gap-2 mb-4 pb-3 border-b ${theme.isDark ? 'border-white/15' : 'border-[#F1EDE4]'}`}>
                      <p className="font-mono text-2xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--color-accent)' }}>
                        {p.passo}
                      </p>
                      <span className={`h-[2px] w-6 ${theme.isDark ? 'bg-white/25' : 'bg-[#DDD6C7]'}`} aria-hidden="true" />
                    </div>
                    <h3 className={`text-base font-bold tracking-tight mb-2 ${theme.headingClass}`}>
                      {translateText(p.titulo)}
                    </h3>
                    <p className={`text-sm leading-relaxed ${theme.subClass}`}>{translateText(p.descricao)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (key === 'quem_somos') {
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'claro');
      return (
        <React.Fragment key={sec.id}>
          <section className={`${sectionPad} ${theme.sectionClass} cv-auto`} style={theme.sectionStyle}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7">
                <p className={`text-[11px] font-bold uppercase tracking-[0.14em] mb-2 ${theme.eyebrowClass}`}>
                  {translateText(meta.eyebrow as string | undefined) || t.sections.quemSomosEyebrow}
                </p>
                <h2 className={`font-display text-2xl sm:text-3xl font-bold text-balance mb-3 ${theme.headingClass}`}>
                  {translateText(sec.titulo)}
                </h2>
                <p className={`text-base mb-4 ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>
                {sec.conteudoHtml && (
                  <div
                    className={`text-sm leading-relaxed mb-6 ${theme.isDark ? 'text-slate-200' : 'text-[#4A5A6D] dark:text-slate-300'}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(translateText(sec.conteudoHtml)) }}
                  />
                )}
                <button
                  type="button"
                  onMouseEnter={() => prefetchRouteChunk(sec.ctaDestino || '/quem-somos')}
                  onTouchStart={() => prefetchRouteChunk(sec.ctaDestino || '/quem-somos')}
                  onClick={() => navigateAction(sec.ctaDestino || '/quem-somos')}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 btn-radius border text-sm font-semibold transition-colors ${
                    theme.isDark
                      ? 'border-white/30 text-white hover:bg-white/10'
                      : 'border-[#DDD6C7] dark:border-[#243E5C] text-[#0B1F33] dark:text-slate-100 hover:bg-[#FAF9F6] dark:hover:bg-[#11263D] hover:border-[#C8A236]/60'
                  }`}
                >
                  {translateText(sec.ctaTexto) || t.sections.quemSomosCta}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              <div className="lg:col-span-5">
                <div className="group aspect-[3/4] max-w-sm mx-auto card-radius overflow-hidden border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#0D1E31] shadow-[0_14px_36px_rgba(11,31,51,0.1)]">
                  {sec.imagemUrl ? (
                    <OptimizedImage
                      src={sec.imagemUrl}
                      alt={translateText(sec.titulo)}
                      sizes="(max-width: 1024px) 92vw, 384px"
                      className={`w-full h-full ${imgFitClass} transition-transform duration-700 group-hover:scale-[1.03]`}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {!hasExplicitPartnersSection &&
            renderPartnersGrid(
              {
                titulo: t.sections.partnersFallbackTitle,
                subtitulo: t.sections.partnersFallbackSubtitle,
              },
              `${sec.id}_fallback_partners`,
            )}
        </React.Fragment>
      );
    }

    if (key === 'parceiros') {
      return renderPartnersGrid(sec, sec.id);
    }

    if (key === 'depoimentos') {
      if (authorizedTestimonials.length === 0) return null;
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'claro');
      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl mb-10">
              {Boolean(meta.eyebrow) && (
                <p className={`text-xs font-semibold mb-2 ${theme.eyebrowClass}`}>
                  {translateText(String(meta.eyebrow))}
                </p>
              )}
              <h2 className={`font-display text-2xl sm:text-3xl font-bold mb-2 ${theme.headingClass}`}>
                {translateText(sec.titulo)}
              </h2>
              <p className={`text-base ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {authorizedTestimonials.map((dep) => (
                <article key={dep.id} className={`${theme.cardClass} card-radius p-6 space-y-3`}>
                  <Quote className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                  <p className={`text-sm leading-relaxed ${theme.subClass}`}>&ldquo;{dep.depoimento}&rdquo;</p>
                  <div className={`pt-3 border-t ${theme.isDark ? 'border-white/15' : 'border-[#E5DFD2]'} text-xs`}>
                    <p className={`font-bold ${theme.headingClass}`}>{dep.nome}</p>
                    <p className={theme.eyebrowClass}>{[dep.cidadeOrigem, dep.subcategoria].filter(Boolean).join(' · ')}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      );
    }

    if (key === 'faq') {
      const perguntas = (meta.perguntas as { pergunta: string; resposta: string }[] | undefined) || [];
      if (perguntas.length === 0) return null;
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'claro');
      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            {Boolean(meta.eyebrow) && (
              <p className={`text-xs font-semibold mb-2 ${theme.eyebrowClass}`}>
                {translateText(String(meta.eyebrow))}
              </p>
            )}
            <h2 className={`font-display text-2xl sm:text-3xl font-bold text-balance mb-2 ${theme.headingClass}`}>
              {translateText(sec.titulo)}
            </h2>
            <p className={`text-base mb-8 ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>
            <div className="divide-y divide-[#E5DFD2] dark:divide-[#1C324B] border border-[#E5DFD2] dark:border-[#1C324B] card-radius bg-[var(--color-surface)] text-[#0B1F33] dark:text-white overflow-hidden shadow-[0_4px_16px_rgba(11,31,51,0.04)] dark:shadow-[0_10px_28px_rgba(0,0,0,0.28)]">
              {perguntas.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-[#FAF9F6] dark:hover:bg-[#11263D] transition-colors"
                    >
                      <span className="text-sm sm:text-base font-semibold text-[#0B1F33] dark:text-white">
                        {translateText(item.pergunta)}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#8C6D14] dark:text-[#E5C76B]' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22, ease: EASE_EXECUTIVE }}
                          className="overflow-hidden"
                        >
                          <div className="px-6 pb-5 text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                            {translateText(item.resposta)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      );
    }

    if (key === 'contato') {
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'escuro-primario');
      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass} relative overflow-hidden cv-auto`} style={theme.sectionStyle}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-7">
            <div className="flex justify-center">
              <BrandLogo
                variant="emblem-dark"
                lazy
                alt={empresa.nome_empresa}
                brandShortName={brandShortName}
                imgClassName="w-14 h-14 object-contain"
              />
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 justify-center">
                <span className="h-[1px] w-8 bg-[#C9A227]/70" aria-hidden="true" />
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#E5C76B]">
                  {t.sections.contatoKicker}
                </p>
                <span className="h-[1px] w-8 bg-[#C9A227]/70" aria-hidden="true" />
              </div>
              <h2 className={`font-display text-2xl sm:text-4xl font-bold tracking-tight text-balance ${theme.headingClass}`}>
                {translateText(sec.titulo)}
              </h2>
              <p className={`text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${theme.subClass}`}>
                {translateText(sec.subtitulo)}
              </p>
              {sec.conteudoHtml && (
                <p className="text-xs opacity-80 mt-2">{translateText(sec.conteudoHtml)}</p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                className="inline-flex items-center gap-2 px-6.5 py-3.5 btn-radius text-sm font-bold text-[#0B1523] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-all duration-150 hover:opacity-95 hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {translateText(sec.ctaTexto) || t.sections.contatoDefaultCta}
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href={whatsappHeroUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-6 py-3.5 btn-radius text-sm font-semibold border transition-all duration-150 ${
                  theme.isDark ? 'text-white border-white/30 hover:bg-white/10' : 'text-slate-900 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                {t.sections.contatoWhatsappCta}
              </a>
              {onOpenCalendly && (
                <button
                  type="button"
                  onClick={onOpenCalendly}
                  className={`inline-flex items-center gap-2 px-5.5 py-3.5 btn-radius text-sm font-semibold border transition-all duration-150 ${
                    theme.isDark ? 'text-white border-white/30 hover:bg-white/10' : 'text-slate-900 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  {t.sections.contatoScheduleCta}
                </button>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (key === 'bloco_livre') {
      const variante = (meta.varianteLayout as string) || (sec.imagemUrl ? 'texto-imagem-direita' : 'centralizado');
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'claro');
      const imgLeft = variante === 'texto-imagem-esquerda';
      const hasImage = Boolean(sec.imagemUrl) && variante !== 'centralizado' && variante !== 'cta-destaque';

      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {hasImage ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className={`lg:col-span-7 space-y-4 ${imgLeft ? 'lg:order-2' : 'lg:order-1'}`}>
                  {Boolean(meta.eyebrow) && (
                    <p className={`text-xs font-semibold ${theme.eyebrowClass}`}>
                      {translateText(String(meta.eyebrow))}
                    </p>
                  )}
                  <h2 className={`font-display text-2xl sm:text-3xl font-bold text-balance ${theme.headingClass}`}>
                    {translateText(sec.titulo)}
                  </h2>
                  {sec.subtitulo && <p className={`text-base ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>}
                  {sec.conteudoHtml && (
                    <div
                      className={`text-sm leading-relaxed ${theme.subClass}`}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(translateText(sec.conteudoHtml)) }}
                    />
                  )}
                  {sec.ctaTexto && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                        className="inline-flex items-center gap-2 px-5 py-2.5 btn-radius text-sm font-semibold text-white"
                        style={{
                          backgroundColor: theme.isDark ? 'var(--color-accent)' : 'var(--color-primary)',
                          color: theme.isDark ? '#0F172A' : '#FFFFFF',
                        }}
                      >
                        {translateText(sec.ctaTexto)}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className={`lg:col-span-5 ${imgLeft ? 'lg:order-1' : 'lg:order-2'}`}>
                  <div className="h-72 sm:h-80 card-radius overflow-hidden border border-slate-200/80 bg-slate-100">
                    <OptimizedImage
                      src={sec.imagemUrl}
                      alt={translateText(sec.titulo)}
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      className={`w-full h-full ${imgFitClass}`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto text-center space-y-4">
                {Boolean(meta.eyebrow) && (
                  <p className={`text-xs font-semibold ${theme.eyebrowClass}`}>
                    {translateText(String(meta.eyebrow))}
                  </p>
                )}
                <h2 className={`font-display text-2xl sm:text-3xl font-bold text-balance ${theme.headingClass}`}>
                  {translateText(sec.titulo)}
                </h2>
                {sec.subtitulo && <p className={`text-base ${theme.subClass}`}>{translateText(sec.subtitulo)}</p>}
                {sec.conteudoHtml && (
                  <div
                    className={`text-sm leading-relaxed ${theme.subClass}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(translateText(sec.conteudoHtml)) }}
                  />
                )}
                {sec.imagemUrl && (
                  <div className="pt-3 max-w-xl mx-auto">
                    <div className="max-h-80 overflow-hidden card-radius border border-slate-200">
                      <OptimizedImage
                        src={sec.imagemUrl}
                        alt={translateText(sec.titulo)}
                        sizes="(max-width: 768px) 100vw, 576px"
                        className={`w-full max-h-80 mx-auto ${imgFitClass}`}
                      />
                    </div>
                  </div>
                )}
                {sec.ctaTexto && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                      className="inline-flex items-center gap-2 px-6 py-3 btn-radius text-sm font-semibold"
                      style={{
                        backgroundColor: theme.isDark ? 'var(--color-accent)' : 'var(--color-primary)',
                        color: theme.isDark ? '#0F172A' : '#FFFFFF',
                      }}
                    >
                      {translateText(sec.ctaTexto)}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      );
    }

    return null;
  };

  const drawerFallback = serviceDrawer ? t.services.fallbackDetails[serviceDrawer.numero] : undefined;

  return (
    <MotionConfig reducedMotion="user">
      <div>
        {orderedSections.map((sec) => renderSection(sec))}

        {serviceDrawer && !previewMode && (
          <div className="fixed inset-0 z-50 bg-[#071422]/75 backdrop-blur-[2px] flex justify-end" role="dialog" aria-modal="true">
            <div className="bg-white w-full max-w-md h-full flex flex-col justify-between overflow-hidden shadow-2xl border-l border-[#E5DFD2]">
              <BrandRibbon className="h-[3px] w-full shrink-0" />
              <div className="bg-[#0B1F33] text-white px-6 py-5 flex items-start justify-between gap-3 shrink-0">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E5C76B] font-mono tabular-nums">
                    {serviceDrawer.numero} · {t.services.drawer.headerPrefix}
                  </p>
                  <h3 className="font-display text-lg font-bold text-white mt-1 leading-snug">{serviceDrawer.titulo}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setServiceDrawer(null)}
                  aria-label={t.services.drawer.closeLabel}
                  className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                <p className="text-sm text-[#4A5A6D] leading-relaxed">{serviceDrawer.descricao}</p>
                <div className="space-y-3 text-xs pt-1">
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C6D14]">
                      {t.services.drawer.whoFor}
                    </p>
                    <p className="text-[#0B1F33] mt-1 leading-relaxed">
                      {serviceDrawer.paraQuem || drawerFallback?.paraQuem || t.services.drawer.defaultWhoFor}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C6D14]">
                      {t.services.drawer.framework}
                    </p>
                    <p className="text-[#0B1F33] mt-1 leading-relaxed">
                      {serviceDrawer.subcategoriaTipica || drawerFallback?.subcategoriaTipica || t.services.drawer.defaultFramework}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2]">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C6D14]">
                      {t.services.drawer.timeline}
                    </p>
                    <p className="text-[#0B1F33] font-mono tabular-nums mt-1 leading-relaxed">
                      {serviceDrawer.faixaPrazo || drawerFallback?.faixaPrazo || t.services.drawer.defaultTimeline}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-[#FAF9F6] border-t border-[#E5DFD2] space-y-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setServiceDrawer(null);
                    onNavigate('/diagnostico');
                  }}
                  className="w-full py-3 px-4 btn-radius text-xs font-bold text-white inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {t.services.drawer.ctaDiagnostic}
                  <ArrowRight className="w-3.5 h-3.5 text-[#E5C76B]" />
                </button>
                <a
                  href={buildWhatsAppUrl(
                    empresa.whatsapp,
                    t.services.drawer.waGreeting(serviceDrawer.titulo),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 btn-radius border border-[#DDD6C7] bg-white text-xs font-semibold text-[#0B1F33] hover:bg-[#FAF9F6]"
                >
                  <MessageCircle className="w-4 h-4 text-[#146B43]" />
                  {t.services.drawer.ctaWhatsapp}
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
};

// Re-export type for convenience in PainelAdminConfig
export type { LegalSource };
