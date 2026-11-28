import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  FileCheck2,
  GraduationCap,
  Handshake,
  HeartPulse,
  Landmark,
  Languages,
  MapPin,
  MessageCircle,
  Scale,
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
  matchesPartnerMacroGroup,
  PARTNER_MACRO_GROUPS,
  sanitizePartnerImageUrl,
  translatePartnerCategory,
  translatePartnerCountry,
  type PartnerMacroGroupId,
} from '../utils/partnerHelpers';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import { OptimizedImage } from './OptimizedImage';
import { HeroShowcase } from './home/HeroShowcase';
import { InteractiveJourneyShowcase } from './home/InteractiveJourneyShowcase';
import { RouteComparatorCard } from './home/RouteComparatorCard';
import { SermigSimulatorShowcase } from './home/SermigSimulatorShowcase';

const ANDES_HORIZON_BANNER = '/src/assets/images/andes_horizon_banner_1795635435326.jpg';

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

const EASE_EXECUTIVE = [0.16, 1, 0.3, 1] as const;

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
  const [homePartnerGroup, setHomePartnerGroup] = useState<PartnerMacroGroupId>('Todos');

  useEffect(() => {
    if (!serviceDrawer) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setServiceDrawer(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [serviceDrawer]);

  const density = empresa.layoutConfig?.densidadeSecoes || 'equilibrada';
  const sectionPad =
    density === 'compacta' ? 'py-16 lg:py-20' : density === 'ampla' ? 'py-24 lg:py-32' : 'py-20 lg:py-28';

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

  const whatsappHeroUrl = buildWhatsAppUrl(empresa.whatsapp, t.hero.waGreeting);

  const navigateAction = (dest: string) => {
    if (previewMode) return;
    if (dest.startsWith('http')) {
      openExternalSafe(dest);
    } else {
      onNavigate(dest);
    }
  };

  const getPartnerCategoryIcon = (category: string) => {
    switch (category) {
      case 'Escritório de Advocacia':
        return Scale;
      case 'Cartório / Apostilamento':
        return FileCheck2;
      case 'Tradutor Juramentado':
        return Languages;
      case 'Seguradora / Saúde':
        return HeartPulse;
      case 'Imobiliária':
        return Building2;
      case 'Escola / Universidade':
        return GraduationCap;
      case 'Contabilidade / Abertura Empresa':
        return Landmark;
      default:
        return Handshake;
    }
  };

  const renderPartnersGrid = (
    sec: { titulo: string; subtitulo: string; conteudoHtml?: string; ctaTexto?: string; ctaDestino?: string; metadados?: Record<string, unknown> },
    keyId: string,
  ) => {
    const isEs = locale === 'es-CL';
    const meta = (sec.metadados || {}) as Record<string, unknown>;
    const maxItens = Math.max(6, Number(meta.maxItens || 6));

    const filteredHomePartners =
      homePartnerGroup === 'Todos'
        ? partnersPublic
        : partnersPublic.filter((p) => matchesPartnerMacroGroup(p.categoria, homePartnerGroup));

    const visiblePartners = filteredHomePartners.slice(0, maxItens);

    const buildPartnerWaGreeting = (partner: PartnerPublic) =>
      isEs
        ? `¡Hola! Recibí la recomendación oficial de D&M Integra Chile para contactar a ${partner.nome}. Me gustaría consultar por sus servicios.`
        : `Olá! Recebi a indicação oficial da D&M Integra Chile para falar com ${partner.nome}. Gostaria de solicitar informações sobre atendimento.`;

    const referralSpecialties = [
      {
        id: 'imoveis',
        icon: Building2,
        kicker: isEs ? 'Vivienda · Indicación' : 'Moradia · Indicação',
        title: isEs ? 'Corredores e Inmobiliarias' : 'Imóveis & Moradia no Chile',
        desc: isEs
          ? 'Derivación a corredores locales en Santiago y regiones para arriendo o compra, con contratación directa.'
          : 'Indicação de corretores e imobiliárias locais em Santiago e regiões para busca de imóvel, com contratação direta.',
        waArea: 'imóveis e moradia no Chile',
      },
      {
        id: 'traducoes',
        icon: Languages,
        kicker: isEs ? 'Documentación · Indicación' : 'Documentação · Indicação',
        title: isEs ? 'Traductores Jurados' : 'Traduções Juramentadas',
        desc: isEs
          ? 'Especialistas para traducciones oficiales PT-ES de certificados, diplomas, contratos y documentos exigidos.'
          : 'Profissionais indicados para tradução oficial PT–ES de certidões, diplomas, contratos e documentos técnicos.',
        waArea: 'tradução juramentada',
      },
      {
        id: 'cartorios',
        icon: FileCheck2,
        kicker: isEs ? 'Brasil · Indicación' : 'Brasil · Indicação',
        title: isEs ? 'Notarías y Apostilla' : 'Cartórios & Apostilamento',
        desc: isEs
          ? 'Contacto con despachantes y notarías aliadas para emisión de certificados y Apostilla de La Haya sin demoras.'
          : 'Indicação de cartórios e despachantes parceiros para 2ª via de certidões e Apostila de Haia com agilidade.',
        waArea: 'cartórios e apostilamento',
      },
      {
        id: 'contabilidade',
        icon: Landmark,
        kicker: isEs ? 'Empresas · Indicación' : 'Empresas · Indicação',
        title: isEs ? 'Contabilidad y Apertura SpA' : 'Contabilidade & Empresas (SpA)',
        desc: isEs
          ? 'Contadores en Chile para constitución de SpA, inicio de actividades ante el SII y planificación tributaria.'
          : 'Contadores indicados no Chile para abertura de SpA, início de atividades no SII e planejamento fiscal.',
        waArea: 'contabilidade e abertura de empresa SpA',
      },
      {
        id: 'advocacia',
        icon: Scale,
        kicker: isEs ? 'Jurídico · Indicación' : 'Jurídico · Indicação',
        title: isEs ? 'Abogacía Complementaria' : 'Advocacia Complementar',
        desc: isEs
          ? 'Abogados chilenos y brasileños indicados para asuntos civiles, contractuales, laborales o patrimoniales.'
          : 'Escritórios parceiros indicados para demandas cíveis, trabalhistas, contratuais ou patrimoniais fora do visto.',
        waArea: 'advocacia complementar',
      },
      {
        id: 'protecao',
        icon: HeartPulse,
        kicker: isEs ? 'Familia · Indicación' : 'Família · Indicação',
        title: isEs ? 'Seguros, Salud y Colegios' : 'Seguros, Saúde & Escolas',
        desc: isEs
          ? 'Corredores independientes para seguro de viaje, planes de salud (Isapre/Fonasa) y orientación escolar.'
          : 'Profissionais indicados para seguro viagem, planos de saúde (Isapre/Fonasa) e orientação escolar para filhos.',
        waArea: 'seguros, saúde ou escolas no Chile',
      },
    ];

    return (
      <section
        key={keyId}
        data-testid="home-partners-section"
        className={`cv-auto ${sectionPad} bg-[#F7F8FA] dark:bg-[#070B12] border-t border-[#E5E7EB] dark:border-[#1E293B]`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 space-y-10">
          {/* Editorial Header */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <div className="flex items-center gap-2.5">
                <span aria-hidden="true" className="h-px w-6 bg-[#B08D57]" />
                <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
                  {translateText(String(meta.eyebrow || '')) ||
                    (isEs ? 'Red de Aliados Indicados' : 'Indicação de Profissionais Parceiros')}
                </p>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white text-balance leading-[1.1]">
                {translateText(sec.titulo)}
              </h2>
              <p className="text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {translateText(sec.subtitulo)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3.5 shrink-0">
              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                onClick={() => navigateAction('/parceiros?secao=mapa')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-white dark:bg-[#0D1422] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:border-[#0B1628] dark:hover:border-white transition-colors whitespace-nowrap"
              >
                <MapPin className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
                {isEs ? 'Mapa en Chile' : 'Ver no Mapa do Chile'}
              </button>
              <button
                type="button"
                onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                onClick={() => navigateAction(sec.ctaDestino || '/parceiros')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628] text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                {translateText(sec.ctaTexto) || t.sections.partnersDefaultCta}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Transparent Scope Strip: What D&M handles vs. What Independent Partners handle */}
          <div className="grid grid-cols-1 lg:grid-cols-2 rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B]">
            <div className="bg-[#0B1628] text-white p-6 sm:p-7 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#C9A86A]">
                <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{isEs ? '01 · ASESORÍA DIRECTA D&M INTEGRA CHILE' : '01 · ATUAÇÃO DIRETA DA D&M INTEGRA CHILE'}</span>
              </div>
              <p className="font-display text-lg font-bold text-white">
                {isEs ? 'Etapas migratorias hasta Visa, PDI y RUT' : 'Condução completa até Vistos, PDI e RUT'}
              </p>
              <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                {isEs
                  ? 'Enquadre legal, preparación documental en Brasil, postulación SERMIG, Estampado Electrónico, registro obligatorio en PDI y emisión de tu Cédula (RUT).'
                  : 'Enquadramento legal, cronograma documental no Brasil, protocolo no SERMIG, Estampado Electrónico, registro obrigatório na PDI e emissão da Cédula (RUT).'}
              </p>
            </div>
            <div className="bg-white dark:bg-[#0D1422] p-6 sm:p-7 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                <Handshake className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{isEs ? '02 · RED DE ALIADOS INDEPENDIENTES INDICADOS' : '02 · INDICAÇÃO DE PROFISSIONAIS PARCEIROS'}</span>
              </div>
              <p className="font-display text-lg font-bold text-[#0B1628] dark:text-white">
                {isEs ? 'Especialistas para otras situaciones en Brasil y Chile' : 'Para outras demandas fora da etapa migratória'}
              </p>
              <p className="text-xs sm:text-[13px] text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {isEs
                  ? 'Para vivienda/arriendo, traducciones juradas, notarías, contabilidad/SpA, asesoría jurídica complementaria, seguros y colegios, derivamos a aliados independientes con contratación directa.'
                  : 'Para imóveis/moradia, traduções juramentadas, cartórios, contabilidade/SpA, advocacia complementar, seguros e escolas, indicamos profissionais independentes com contratação direta.'}
              </p>
            </div>
          </div>

          {partnersPublic.length > 0 ? (
            <>
              {/* Interactive Macro-Group Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div
                  role="group"
                  aria-label={isEs ? 'Filtrar aliados por especialidad' : 'Filtrar parceiros por necessidade'}
                  className="flex flex-wrap items-center gap-2"
                >
                  {PARTNER_MACRO_GROUPS.map((group) => {
                    const count =
                      group.id === 'Todos'
                        ? partnersPublic.length
                        : partnersPublic.filter((p) => matchesPartnerMacroGroup(p.categoria, group.id)).length;
                    if (group.id !== 'Todos' && count === 0) return null;
                    const active = homePartnerGroup === group.id;
                    return (
                      <button
                        key={group.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setHomePartnerGroup(group.id)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap tabular-nums border ${
                          active
                            ? 'bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628] border-[#0B1628] dark:border-white'
                            : 'bg-white dark:bg-[#0D1422] text-[#4B5563] dark:text-slate-300 border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#0B1628]/40 dark:hover:border-slate-500 hover:text-[#0B1628] dark:hover:text-white'
                        }`}
                      >
                        {isEs ? group.labelEs : group.labelPt} ({count})
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-[#6B7280] dark:text-slate-400 font-mono tabular-nums">
                  {isEs
                    ? `Mostrando ${visiblePartners.length} de ${filteredHomePartners.length} aliados`
                    : `Exibindo ${visiblePartners.length} de ${filteredHomePartners.length} parceiros`}
                </p>
              </div>

              {/* Partner Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {visiblePartners.map((p) => {
                  const safeLogo = sanitizePartnerImageUrl(p.logoUrl);
                  const CatIcon = getPartnerCategoryIcon(p.categoria);
                  return (
                    <article
                      key={p.id}
                      className="group bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#0F3D91]/50 dark:hover:border-[#60A5FA]/50 rounded-xl p-6 flex flex-col justify-between gap-5 transition-all hover:shadow-[0_12px_32px_rgba(11,22,40,0.06)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 text-xs text-[#6B7280] dark:text-slate-400">
                          <span className="truncate font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                            {translatePartnerCategory(p.categoria, locale)} · {translatePartnerCountry(p.pais, locale)}
                          </span>
                          <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#0B1628] dark:text-slate-200 tabular-nums shrink-0">
                            <Star className="w-3.5 h-3.5 fill-[#B08D57] text-[#B08D57]" />
                            {Number(p.avaliacao || 5).toFixed(1)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3.5">
                          <div className="h-12 w-14 rounded-lg bg-[#F7F8FA] dark:bg-[#151F32] border border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-center overflow-hidden shrink-0">
                            {safeLogo ? (
                              <OptimizedImage
                                src={safeLogo}
                                alt={p.nome}
                                sizes="56px"
                                containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                                className="max-w-full max-h-full object-contain p-1.5"
                              />
                            ) : (
                              <CatIcon className="w-5 h-5 text-[#0F3D91] dark:text-[#60A5FA]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-display text-base font-bold text-[#0B1628] dark:text-white leading-snug line-clamp-2">
                              {p.nome}
                            </h3>
                            <p className="text-xs text-[#6B7280] dark:text-slate-400 truncate mt-0.5">
                              {p.cidadeRegiao}
                            </p>
                          </div>
                        </div>

                        <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed line-clamp-3">
                          {p.descricaoPublica}
                        </p>
                      </div>

                      <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-3 text-xs">
                        {p.whatsapp ? (
                          <a
                            href={buildWhatsAppUrl(p.whatsapp, buildPartnerWaGreeting(p))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-semibold text-[#047857] dark:text-emerald-400 hover:underline whitespace-nowrap"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {isEs ? 'Indicación WhatsApp' : 'Falar via indicação'}
                          </a>
                        ) : (
                          <span className="text-[#6B7280] dark:text-slate-400 truncate">
                            {isEs ? 'Aliado indicado' : 'Parceiro indicado'}
                          </span>
                        )}
                        <button
                          type="button"
                          onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                          onClick={() => navigateAction(`/parceiros?macro=${encodeURIComponent(homePartnerGroup)}`)}
                          className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                        >
                          {isEs ? 'Ver directorio →' : 'Ver na rede →'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            /* Curated 6-Specialty Referral Areas Grid (shown cleanly while directory is being populated) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {referralSpecialties.map((area) => {
                const AreaIcon = area.icon;
                return (
                  <article
                    key={area.id}
                    className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#0F3D91]/45 dark:hover:border-[#60A5FA]/45 rounded-xl p-6 flex flex-col justify-between gap-5 transition-all hover:shadow-[0_10px_28px_rgba(11,22,40,0.05)]"
                  >
                    <div className="space-y-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#0F3D91] dark:text-[#C9A86A]">
                          {area.kicker}
                        </span>
                        <div className="w-9 h-9 rounded-lg bg-[#F7F8FA] dark:bg-[#151F32] border border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-center text-[#0F3D91] dark:text-[#60A5FA] shrink-0">
                          <AreaIcon className="w-4 h-4" aria-hidden="true" />
                        </div>
                      </div>
                      <h3 className="font-display text-base font-bold text-[#0B1628] dark:text-white leading-snug">
                        {area.title}
                      </h3>
                      <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                        {area.desc}
                      </p>
                    </div>
                    <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-3 text-xs">
                      <a
                        href={buildWhatsAppUrl(
                          empresa.whatsapp,
                          isEs
                            ? `¡Hola! Me gustaría solicitar la indicación de un aliado independiente para ${area.waArea}.`
                            : `Olá! Gostaria de solicitar a indicação de um profissional parceiro para ${area.waArea}.`,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-semibold text-[#047857] dark:text-emerald-400 hover:underline whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {isEs ? 'Solicitar indicación' : 'Solicitar indicação'}
                      </a>
                      <button
                        type="button"
                        onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                        onClick={() => navigateAction('/parceiros')}
                        className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                      >
                        {isEs ? 'Cómo funciona →' : 'Ver detalhes →'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Executive Partner B2B Callout Bar */}
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] p-6 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1 max-w-2xl">
              <p className="text-sm font-bold text-[#0B1628] dark:text-white">
                {isEs
                  ? '¿Ofreces servicios profesionales en Brasil o Chile y quieres ser recomendado?'
                  : 'Atua no Brasil ou no Chile e deseja fazer parte da nossa rede de indicações?'}
              </p>
              <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300">
                {isEs
                  ? 'Credencia tu oficina o empresa sin cuota mensual: evaluamos cada postulación en hasta 48h.'
                  : 'Cadastre sua empresa sem mensalidade fixa para receber indicações qualificadas de clientes D&M.'}
              </p>
            </div>
            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk('/parceiros')}
              onClick={() => navigateAction('/parceiros?secao=seja-parceiro')}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#0B1628] dark:border-white text-xs font-semibold text-[#0B1628] dark:text-white hover:bg-[#0B1628] hover:text-white dark:hover:bg-white dark:hover:text-[#0B1628] transition-colors whitespace-nowrap shrink-0"
            >
              {isEs ? 'Postular como Aliado B2B' : 'Quero ser Parceiro'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
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
      const rawDestaques = (meta.destaques as string[] | undefined) || [
        'Atendimento humano e direto em português',
        'Rigor técnico no SERMIG, PDI e Cédula (RUT)',
        'Rede de parceiros indicados para demandas complementares',
      ];
      const heroDestaques = rawDestaques.map((d) => translateText(d));
      const eyebrow = translateText(meta.eyebrow as string | undefined) || t.hero.defaultEyebrow;
      const ctaPrimario =
        translateText(sec.ctaTexto || (meta.ctaPrimario as string | undefined)) || t.hero.defaultPrimaryCta;
      const ctaSecundario =
        translateText(meta.ctaSecundario as string | undefined) || t.hero.defaultSecondaryCta;

      const DEFAULT_HERO_TITLE =
        'Conquiste seu visto, PDI e RUT no Chile com segurança jurídica e zero dor de cabeça burocrática.';
      const rawHeroTitle = !sec.titulo ? DEFAULT_HERO_TITLE : sec.titulo;

      return (
        <HeroShowcase
          key={sec.id}
          eyebrow={eyebrow}
          heroTitle={translateText(rawHeroTitle)}
          heroSubtitle={translateText(sec.subtitulo)}
          heroHtml={translateText(sec.conteudoHtml)}
          ctaPrimario={ctaPrimario}
          ctaSecundario={ctaSecundario}
          ctaDestino={sec.ctaDestino || '/diagnostico'}
          whatsappUrl={whatsappHeroUrl}
          imagemUrl={sec.imagemUrl}
          heroDestaques={heroDestaques}
          onNavigateAction={navigateAction}
        />
      );
    }

    if (key === 'servicos') {
      const servicosItens = (meta.itens as ServiceItemMeta[] | undefined) || [];
      const showComparator = meta.mostrarComparador !== false;
      const plans = t.services.plans;

      return (
        <section
          key={sec.id}
          className={`${sectionPad} bg-[#F7F8FA] dark:bg-[#070B12] text-[#0B1628] dark:text-white`}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 space-y-20 lg:space-y-24">
            {/* 1. Áreas de Prática — Editorial header with CMS photo + Hairline-separated grid */}
            <div className="space-y-12">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className={`${sec.imagemUrl && meta.varianteLayout !== 'sem-imagem' ? 'lg:col-span-7' : 'lg:col-span-8'} space-y-3`}>
                  <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                    {translateText(meta.eyebrow as string | undefined) || t.services.defaultEyebrow}
                  </p>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight leading-[1.12] text-[#0B1628] dark:text-white text-balance">
                    {translateText(sec.titulo)}
                  </h2>
                  <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl pt-1">
                    {translateText(sec.subtitulo)}
                  </p>
                </div>

                {sec.imagemUrl && meta.varianteLayout !== 'sem-imagem' && (
                  <div className="lg:col-span-5">
                    <div className="aspect-[16/10] rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422]">
                      <OptimizedImage
                        src={sec.imagemUrl}
                        alt={translateText(sec.titulo)}
                        sizes="(max-width: 1024px) 100vw, 40vw"
                        className={`w-full h-full ${imgFitClass}`}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                {servicosItens.map((item, idx) => {
                  const localizedItem: ServiceItemMeta = {
                    ...item,
                    titulo: translateText(item.titulo),
                    descricao: translateText(item.descricao),
                  };
                  return (
                    <div
                      key={item.numero}
                      className={`py-8 sm:py-10 border-b border-[#E5E7EB] dark:border-[#1E293B] flex flex-col justify-between gap-6 ${
                        idx % 2 === 0 ? 'md:pr-10 md:border-r' : 'md:pl-10'
                      }`}
                    >
                      <div className="space-y-3">
                        <span className="font-mono text-xs font-semibold text-[#6B7280] dark:text-slate-400 tabular-nums">
                          {localizedItem.numero}.
                        </span>
                        <h3 className="font-display text-xl font-bold tracking-tight text-[#0B1628] dark:text-white">
                          {localizedItem.titulo}
                        </h3>
                        <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-lg">
                          {localizedItem.descricao}
                        </p>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => !previewMode && setServiceDrawer(localizedItem)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline underline-offset-4"
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

            {/* 2. Consulta Rápida de Rota Legal (único simulador rápido da Home — sem duplicidade) */}
            {showComparator && <RouteComparatorCard onNavigateAction={navigateAction} />}

            {/* 3. Modalidades de Assessoria — Clean 3-column Corporate Tier Comparison */}
            <div className="space-y-10">
              <div className="max-w-3xl space-y-3">
                <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                  {t.services.plansKicker}
                </p>
                <h3 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white text-balance">
                  {t.services.plansTitle}
                </h3>
                <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
                  {t.services.plansSubtitlePrefix}
                  <strong className="text-[#0B1628] dark:text-white">{t.services.plansOrientativaBold}</strong>
                  {t.services.plansOrientativaDesc}
                  <strong className="text-[#0B1628] dark:text-white">{t.services.plansCompletaBold}</strong>
                  {t.services.plansCompletaDesc}
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                {/* Tier 1: Diagnóstico Gratuito */}
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-8 flex flex-col justify-between gap-8">
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-[#6B7280] dark:text-slate-400">
                        {plans.diagnostico_gratuito.kicker}
                      </p>
                      <h4 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                        {plans.diagnostico_gratuito.nome}
                      </h4>
                      <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                        {plans.diagnostico_gratuito.subtitulo}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-[#0B1628] dark:text-slate-200 pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                      {plans.diagnostico_gratuito.escopoPrefix} {plans.diagnostico_gratuito.responsavelProtocolo}
                    </p>
                    <ul className="space-y-3 text-xs sm:text-[13px] text-[#4B5563] dark:text-slate-300">
                      {plans.diagnostico_gratuito.inclui.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigateAction('/diagnostico')}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-xs font-semibold text-[#0B1628] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#151F32] transition-colors"
                  >
                    {plans.diagnostico_gratuito.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tier 2: Consultoria Orientativa */}
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-8 flex flex-col justify-between gap-8">
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-[#0F3D91] dark:text-[#60A5FA]">
                        {plans.orientativa.kicker}
                      </p>
                      <h4 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                        {plans.orientativa.nome}
                      </h4>
                      <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                        {plans.orientativa.subtitulo}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-[#0B1628] dark:text-slate-200 pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                      {plans.orientativa.escopoPrefix} {plans.orientativa.responsavelProtocolo}
                    </p>
                    <ul className="space-y-3 text-xs sm:text-[13px] text-[#4B5563] dark:text-slate-300">
                      {plans.orientativa.inclui.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a
                    href={buildWhatsAppUrl(empresa.whatsapp, plans.orientativa.waMessage || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-xs font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white hover:bg-[#16233B] dark:hover:bg-slate-200 transition-colors"
                  >
                    {plans.orientativa.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Tier 3: Consultoria Completa (Destaque Executivo) */}
                <div className="bg-[#070E1C] dark:bg-[#111E33] border border-[#C9A86A]/45 text-white rounded-xl p-8 flex flex-col justify-between gap-8 shadow-[0_16px_40px_rgba(7,14,28,0.16)]">
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold tracking-[0.04em] text-[#E5C77B]">
                        {plans.completa.kicker}
                      </p>
                      <h4 className="font-display text-xl font-bold text-white">
                        {plans.completa.nome}
                      </h4>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {plans.completa.subtitulo}
                      </p>
                    </div>
                    <p className="text-xs font-medium text-slate-200 pt-4 border-t border-white/15">
                      {plans.completa.escopoPrefix} {plans.completa.responsavelProtocolo}
                    </p>
                    <ul className="space-y-3 text-xs sm:text-[13px] text-slate-200">
                      {plans.completa.inclui.map((item) => (
                        <li key={item} className="flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-[#E5C77B] shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a
                    href={buildWhatsAppUrl(empresa.whatsapp, plans.completa.waMessage || '')}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-xs font-semibold text-[#070E1C] bg-[#E5C77B] hover:bg-[#F0D692] transition-colors"
                  >
                    {plans.completa.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (key === 'como_funciona') {
      return (
        <React.Fragment key={sec.id}>
          <InteractiveJourneyShowcase
            sectionPad={sectionPad}
            eyebrow={meta.eyebrow ? translateText(String(meta.eyebrow)) : undefined}
            title={translateText(sec.titulo)}
            subtitle={translateText(sec.subtitulo)}
            imagemUrl={sec.imagemUrl}
            onNavigateAction={navigateAction}
          />
          <SermigSimulatorShowcase
            whatsapp={empresa.whatsapp}
            onNavigateAction={navigateAction}
          />
        </React.Fragment>
      );
    }

    if (key === 'diferenciais') {
      const difItens = (meta.itens as { titulo: string; descricao: string }[] | undefined) || [];
      const noImage = meta.varianteLayout === 'sem-imagem' || !sec.imagemUrl;
      const imageRight = meta.varianteLayout === 'imagem-direita';

      return (
        <section
          key={sec.id}
          className={`${sectionPad} bg-[#F7F8FA] dark:bg-[#070B12] text-[#0B1628] dark:text-white cv-auto`}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-stretch">
            {!noImage && (
              <div className={`lg:col-span-5 ${imageRight ? 'lg:order-2' : 'lg:order-1'}`}>
                <div className="h-80 lg:h-full min-h-[360px] rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422]">
                  <OptimizedImage
                    src={sec.imagemUrl}
                    alt={translateText(sec.titulo)}
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className={`w-full h-full ${imgFitClass}`}
                  />
                </div>
              </div>
            )}

            <div
              className={`${noImage ? 'lg:col-span-12 max-w-4xl mx-auto' : 'lg:col-span-7'} flex flex-col justify-center ${
                imageRight ? 'lg:order-1' : 'lg:order-2'
              }`}
            >
              <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA] mb-3">
                {translateText(meta.eyebrow as string | undefined) || t.sections.diferenciaisEyebrow}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white text-balance mb-3">
                {translateText(sec.titulo)}
              </h2>
              <p className="text-base text-[#4B5563] dark:text-slate-300 leading-relaxed mb-10">
                {translateText(sec.subtitulo)}
              </p>

              <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B] border-t border-[#E5E7EB] dark:border-[#1E293B]">
                {difItens.map((d, idx) => (
                  <div key={idx} className="py-5 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6">
                    <h3 className="sm:col-span-5 text-sm font-bold text-[#0B1628] dark:text-white">
                      {translateText(d.titulo)}
                    </h3>
                    <p className="sm:col-span-7 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                      {translateText(d.descricao)}
                    </p>
                  </div>
                ))}
              </div>

              {onOpenLawModal && (
                <div className="mt-8">
                  <button
                    type="button"
                    onClick={onOpenLawModal}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline underline-offset-4"
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

    if (key === 'quem_somos') {
      const portraitSrc =
        sec.imagemUrl?.trim() || '/src/assets/images/founder_executive_portrait_1795718964136.jpg';
      const responsavelLabel =
        (typeof meta.responsavel === 'string' && meta.responsavel.trim()) ||
        empresa.responsavel_tecnico ||
        'Diretoria Técnica D&M Integra Chile';

      const officeGallery = [
        {
          src: '/src/assets/images/founder_advisory_boardroom_1795718965144.jpg',
          alt: 'Planejamento estratégico de mudança e análise de dossiê no escritório',
          num: '01.',
          title:
            locale === 'es-CL'
              ? 'Planificación estratégica y dossier a medida'
              : 'Planejamento estratégico e dossiê sob medida',
          caption:
            locale === 'es-CL'
              ? 'Definimos tu visa y hoja de ruta antes de viajar.'
              : 'Definimos sua rota legal e prazos antes mesmo de embarcar.',
          span: 'lg:col-span-6',
          pos: 'object-[50%_20%]',
        },
        {
          src: '/src/assets/images/founder_office_client_call_1795706903356.jpg',
          alt: 'Reunião de consultoria migratória online com clientes',
          num: '02.',
          title:
            locale === 'es-CL'
              ? 'Sesiones individuales Brasil–Chile'
              : 'Conversas individuais em português',
          caption:
            locale === 'es-CL'
              ? 'Acompañamiento directo para alinear visa, familia y plazos.'
              : 'Atendimento direto para alinhar visto, documentos, prazos e indicações.',
          span: 'lg:col-span-6',
          pos: 'object-[55%_20%]',
        },
        {
          src: '/src/assets/images/founder_office_document_review_1795706904668.jpg',
          alt: 'Auditoria documental e revisão de dossiês no escritório',
          num: '03.',
          title:
            locale === 'es-CL'
              ? 'Revisión técnica de certificados y apostillas'
              : 'Auditoria de certidões, apostilas e contratos',
          caption:
            locale === 'es-CL'
              ? 'Cada documento validado antes de ingresar al SERMIG.'
              : 'Cada certidão e cláusula conferida antes do protocolo.',
          span: 'lg:col-span-6',
          pos: 'object-[55%_18%]',
        },
        {
          src: '/src/assets/images/founder_office_desk_work_1795706900230.jpg',
          alt: 'Gestão digital de processos SERMIG no escritório',
          num: '04.',
          title:
            locale === 'es-CL'
              ? 'Seguimiento continuo en SERMIG, PDI y RUT'
              : 'Controle ativo de prazos no SERMIG, PDI e RUT',
          caption:
            locale === 'es-CL'
              ? 'Monitoreo hasta tu Estampado Electrónico y residencia.'
              : 'Acompanhamento de perto até seu visto aprovado e RUT em mãos.',
          span: 'lg:col-span-6',
          pos: 'object-[55%_18%]',
        },
      ];

      return (
        <React.Fragment key={sec.id}>
          <section
            className={`${sectionPad} bg-white dark:bg-[#0D1422] border-y border-[#E5E7EB] dark:border-[#1E293B] text-[#0B1628] dark:text-white cv-auto`}
          >
            <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              <div className="lg:col-span-7 space-y-6">
                <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
                  {translateText(meta.eyebrow as string | undefined) || t.sections.quemSomosEyebrow}
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white text-balance leading-[1.12]">
                  {translateText(sec.titulo)}
                </h2>
                <p className="text-base sm:text-lg text-[#374151] dark:text-slate-200 leading-relaxed font-medium">
                  {translateText(sec.subtitulo)}
                </p>
                {sec.conteudoHtml && (
                  <div
                    className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(translateText(sec.conteudoHtml)) }}
                  />
                )}

                <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B] grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                  <div>
                    <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                      {locale === 'es-CL' ? 'Formación Jurídica' : 'Formação Jurídica'}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                      {locale === 'es-CL'
                        ? 'Derecho y conformidad normativa'
                        : 'Bacharel e Especialista em Direito'}
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                      {locale === 'es-CL' ? 'Ley Nº 21.325' : 'Ley Nº 21.325'}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                      {locale === 'es-CL'
                        ? 'SERMIG, Mercosur, PDI y RUT'
                        : 'SERMIG, Mercosul, PDI e RUT'}
                    </p>
                  </div>
                  <div>
                    <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                      {locale === 'es-CL' ? 'Trato Directo' : 'Atendimento Direto'}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">
                      {locale === 'es-CL'
                        ? '100% en portugués y sigilo LGPD'
                        : '100% em português e sigilo LGPD'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onMouseEnter={() => prefetchRouteChunk(sec.ctaDestino || '/quem-somos')}
                    onClick={() => navigateAction(sec.ctaDestino || '/quem-somos')}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0B1628] dark:bg-[#C9A86A] text-white dark:text-[#070E1C] text-sm font-semibold hover:bg-[#132542] dark:hover:bg-[#D8BA80] transition-colors"
                  >
                    {translateText(sec.ctaTexto) || t.sections.quemSomosCta}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="relative max-w-[390px] mx-auto">
                  <div
                    aria-hidden="true"
                    className="hidden sm:block absolute -inset-y-3 -right-3 left-6 rounded-2xl border border-[#B08D57]/35 dark:border-[#C9A86A]/30 pointer-events-none"
                  />
                  <figure className="relative rounded-2xl overflow-hidden border border-[#E2E8F0] dark:border-white/10 bg-[#0B1628] shadow-[0_22px_44px_-22px_rgba(11,22,40,0.3)] dark:shadow-[0_24px_52px_-20px_rgba(0,0,0,0.7)]">
                    <div className="aspect-[3/4] w-full overflow-hidden">
                      <OptimizedImage
                        src={portraitSrc}
                        alt={`${responsavelLabel} — ${translateText(sec.titulo)}`}
                        sizes="(max-width: 1024px) 92vw, 390px"
                        className={`w-full h-full ${imgFitClass} object-top`}
                      />
                    </div>
                    <figcaption className="bg-[#070E1C] text-white px-5 py-4 border-t border-[#C9A86A]/35 space-y-1">
                      <p className="font-display text-sm font-bold text-white leading-snug">
                        {responsavelLabel}
                      </p>
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-slate-300">
                          {locale === 'es-CL'
                            ? 'Asesoría Jurídica y Relocation'
                            : 'Assessoria Jurídica & Relocation'}
                        </span>
                        <span className="font-mono text-[#C9A86A] whitespace-nowrap shrink-0">
                          Brasil · Chile
                        </span>
                      </div>
                    </figcaption>
                  </figure>
                </div>
              </div>
            </div>

            {/* Galeria Editorial de Trabalho no Escritório */}
            <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-16 pt-14 border-t border-[#E5E7EB] dark:border-[#1E293B]">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
                    {locale === 'es-CL'
                      ? 'En la Oficina · Trabajo Técnico Directo'
                      : 'Na Prática · Como Cuidamos do Seu Processo'}
                  </p>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-[#0B1628] dark:text-white">
                    {locale === 'es-CL'
                      ? 'Rigor documental y acompañamiento cercano en cada etapa'
                      : 'Da conferência documental às reuniões de alinhamento com você'}
                  </h3>
                </div>
                <button
                  type="button"
                  onMouseEnter={() => prefetchRouteChunk('/quem-somos')}
                  onClick={() => navigateAction('/quem-somos')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F3D91] dark:text-[#C9A86A] hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                >
                  {locale === 'es-CL' ? 'Ver galería y credenciales completas' : 'Ver galeria e trajetória completa'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {officeGallery.map((item) => (
                  <figure
                    key={item.num}
                    className="group bg-[#F8FAFC] dark:bg-[#0A111E] rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#B08D57]/60 dark:hover:border-[#C9A86A]/55 transition-colors flex flex-col"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-[#0B1628]">
                      <OptimizedImage
                        src={item.src}
                        alt={item.alt}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className={`w-full h-full object-cover ${item.pos} transition-transform duration-500 ease-out group-hover:scale-[1.04]`}
                      />
                    </div>
                    <figcaption className="p-4 space-y-1 flex-1">
                      <p className="font-mono text-[11px] font-semibold text-[#B08D57] dark:text-[#C9A86A]">
                        {item.num}
                      </p>
                      <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white leading-snug">
                        {item.title}
                      </p>
                      <p className="text-xs text-[#4B5563] dark:text-slate-400 leading-relaxed">
                        {item.caption}
                      </p>
                    </figcaption>
                  </figure>
                ))}
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
      return (
        <section
          key={sec.id}
          className={`${sectionPad} bg-white dark:bg-[#0D1422] border-t border-[#E5E7EB] dark:border-[#1E293B]`}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 space-y-12">
            <div className="max-w-2xl space-y-2.5">
              {Boolean(meta.eyebrow) && (
                <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                  {translateText(String(meta.eyebrow))}
                </p>
              )}
              <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white">
                {translateText(sec.titulo)}
              </h2>
              <p className="text-base text-[#4B5563] dark:text-slate-300">
                {translateText(sec.subtitulo)}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {authorizedTestimonials.map((dep) => (
                <article
                  key={dep.id}
                  className="pt-6 border-t border-[#E5E7EB] dark:border-[#1E293B] flex flex-col justify-between gap-6"
                >
                  <p className="text-sm sm:text-[15px] text-[#0B1628] dark:text-slate-200 leading-relaxed">
                    &ldquo;{dep.depoimento}&rdquo;
                  </p>
                  <div className="text-xs space-y-0.5">
                    <p className="font-semibold text-[#0B1628] dark:text-white">{dep.nome}</p>
                    <p className="text-[#6B7280] dark:text-slate-400">
                      {[dep.cidadeOrigem, dep.subcategoria].filter(Boolean).join(' · ')}
                    </p>
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
      return (
        <section
          key={sec.id}
          className={`${sectionPad} bg-white dark:bg-[#0D1422] border-t border-[#E5E7EB] dark:border-[#1E293B]`}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-4 space-y-3">
              {Boolean(meta.eyebrow) && (
                <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                  {translateText(String(meta.eyebrow))}
                </p>
              )}
              <h2 className="font-display text-3xl font-bold tracking-tight text-[#0B1628] dark:text-white text-balance">
                {translateText(sec.titulo)}
              </h2>
              <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {translateText(sec.subtitulo)}
              </p>
            </div>

            <div className="lg:col-span-8 divide-y divide-[#E5E7EB] dark:divide-[#1E293B] border-y border-[#E5E7EB] dark:border-[#1E293B]">
              {perguntas.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-6 py-5 text-left group"
                    >
                      <span className="text-sm sm:text-base font-semibold text-[#0B1628] dark:text-white group-hover:text-[#0F3D91] dark:group-hover:text-[#60A5FA] transition-colors">
                        {translateText(item.pergunta)}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                          isOpen
                            ? 'rotate-180 text-[#0F3D91] dark:text-[#60A5FA]'
                            : 'text-[#6B7280] dark:text-slate-400'
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: EASE_EXECUTIVE }}
                          className="overflow-hidden"
                        >
                          <div className="pb-6 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl">
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
      return (
        <section
          key={sec.id}
          className="relative overflow-hidden bg-[#070E1C] text-white py-20 lg:py-28 cv-auto"
        >
          <div className="absolute inset-0 pointer-events-none select-none">
            <OptimizedImage
              src={sec.imagemUrl?.trim() || ANDES_HORIZON_BANNER}
              alt={translateText(sec.titulo)}
              sizes="100vw"
              placeholderTone="dark"
              containerClassName="w-full h-full"
              className="w-full h-full object-cover object-center opacity-25"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#060C18]/95 via-[#060C18]/85 to-[#060C18]/75"
            />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
            <div className="max-w-2xl space-y-4">
              <p className="text-xs font-semibold tracking-[0.06em] text-[#C9A86A]">
                {t.sections.contatoKicker}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white text-balance leading-[1.08]">
                {translateText(sec.titulo)}
              </h2>
              <p className="text-base text-slate-300 leading-relaxed">
                {translateText(sec.subtitulo)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 shrink-0">
              <button
                type="button"
                onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold text-[#070E1C] bg-[#E5C77B] hover:bg-[#F0D692] transition-colors whitespace-nowrap shadow-[0_8px_24px_rgba(201,168,106,0.2)]"
              >
                {translateText(sec.ctaTexto) || t.sections.contatoDefaultCta}
                <ArrowRight className="w-4 h-4" />
              </button>
              {onOpenCalendly ? (
                <button
                  type="button"
                  onClick={onOpenCalendly}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg text-sm font-medium border border-white/25 bg-white/[0.04] text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Calendar className="w-4 h-4 text-[#E5C77B]" />
                  {t.sections.contatoScheduleCta}
                </button>
              ) : (
                <a
                  href={whatsappHeroUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg text-sm font-medium border border-white/25 bg-white/[0.04] text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <MessageCircle className="w-4 h-4 text-[#E5C77B]" />
                  {t.sections.contatoWhatsappCta}
                </a>
              )}
            </div>
          </div>
        </section>
      );
    }

    if (key === 'bloco_livre') {
      const variante = (meta.varianteLayout as string) || (sec.imagemUrl ? 'texto-imagem-direita' : 'centralizado');
      const imgLeft = variante === 'texto-imagem-esquerda';
      const hasImage = Boolean(sec.imagemUrl) && variante !== 'centralizado' && variante !== 'cta-destaque';

      return (
        <section
          key={sec.id}
          className={`${sectionPad} bg-white dark:bg-[#0D1422] border-t border-[#E5E7EB] dark:border-[#1E293B]`}
        >
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            {hasImage ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className={`lg:col-span-7 space-y-4 ${imgLeft ? 'lg:order-2' : 'lg:order-1'}`}>
                  {Boolean(meta.eyebrow) && (
                    <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                      {translateText(String(meta.eyebrow))}
                    </p>
                  )}
                  <h2 className="font-display text-3xl font-bold text-[#0B1628] dark:text-white text-balance">
                    {translateText(sec.titulo)}
                  </h2>
                  {sec.subtitulo && (
                    <p className="text-base text-[#4B5563] dark:text-slate-300">{translateText(sec.subtitulo)}</p>
                  )}
                  {sec.conteudoHtml && (
                    <div
                      className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(translateText(sec.conteudoHtml)) }}
                    />
                  )}
                  {sec.ctaTexto && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white hover:opacity-90 transition-opacity"
                      >
                        {translateText(sec.ctaTexto)}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className={`lg:col-span-5 ${imgLeft ? 'lg:order-1' : 'lg:order-2'}`}>
                  <div className="h-72 sm:h-80 rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B]">
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
                  <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                    {translateText(String(meta.eyebrow))}
                  </p>
                )}
                <h2 className="font-display text-3xl font-bold text-[#0B1628] dark:text-white text-balance">
                  {translateText(sec.titulo)}
                </h2>
                {sec.subtitulo && (
                  <p className="text-base text-[#4B5563] dark:text-slate-300">{translateText(sec.subtitulo)}</p>
                )}
                {sec.conteudoHtml && (
                  <div
                    className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(translateText(sec.conteudoHtml)) }}
                  />
                )}
                {sec.ctaTexto && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white"
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
          <div
            className="fixed inset-0 z-50 bg-[#070B12]/70 backdrop-blur-[2px] flex justify-end"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget) setServiceDrawer(null);
            }}
          >
            <div className="bg-white dark:bg-[#0D1422] w-full max-w-md h-full flex flex-col justify-between overflow-hidden shadow-2xl border-l border-[#E5E7EB] dark:border-[#1E293B]">
              <div className="bg-[#0B1628] text-white px-6 py-6 flex items-start justify-between gap-3 shrink-0">
                <div>
                  <p className="text-xs font-mono text-[#C9A86A] tabular-nums">
                    {serviceDrawer.numero} · {t.services.drawer.headerPrefix}
                  </p>
                  <h3 className="font-display text-lg font-bold text-white mt-1 leading-snug">
                    {serviceDrawer.titulo}
                  </h3>
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

              <div className="p-6 flex-1 overflow-y-auto space-y-5">
                <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                  {serviceDrawer.descricao}
                </p>
                <dl className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B] border-y border-[#E5E7EB] dark:border-[#1E293B] text-xs">
                  <div className="py-4 space-y-1">
                    <dt className="font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                      {t.services.drawer.whoFor}
                    </dt>
                    <dd className="text-[#0B1628] dark:text-slate-200 leading-relaxed">
                      {serviceDrawer.paraQuem || drawerFallback?.paraQuem || t.services.drawer.defaultWhoFor}
                    </dd>
                  </div>
                  <div className="py-4 space-y-1">
                    <dt className="font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                      {t.services.drawer.framework}
                    </dt>
                    <dd className="text-[#0B1628] dark:text-slate-200 leading-relaxed">
                      {serviceDrawer.subcategoriaTipica ||
                        drawerFallback?.subcategoriaTipica ||
                        t.services.drawer.defaultFramework}
                    </dd>
                  </div>
                  <div className="py-4 space-y-1">
                    <dt className="font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                      {t.services.drawer.timeline}
                    </dt>
                    <dd className="text-[#0B1628] dark:text-slate-200 font-mono tabular-nums leading-relaxed">
                      {serviceDrawer.faixaPrazo ||
                        drawerFallback?.faixaPrazo ||
                        t.services.drawer.defaultTimeline}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="px-6 py-5 bg-[#F7F8FA] dark:bg-[#070B12] border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setServiceDrawer(null);
                    onNavigate('/diagnostico');
                  }}
                  className="w-full py-3 px-4 rounded-lg text-xs font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white hover:opacity-90 inline-flex items-center justify-center gap-2 transition-opacity"
                >
                  {t.services.drawer.ctaDiagnostic}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <a
                  href={buildWhatsAppUrl(
                    empresa.whatsapp,
                    t.services.drawer.waGreeting(serviceDrawer.titulo),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-white dark:bg-[#151F32] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#1E293B]"
                >
                  <MessageCircle className="w-4 h-4" />
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
