import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  FileCheck2,
  GraduationCap,
  Handshake,
  HeartPulse,
  Landmark,
  Languages,
  MapPin,
  MessageCircle,
  Scale,
  Star,
} from 'lucide-react';
import type { PartnerPublic } from '../../types/domain';
import { buildWhatsAppUrl } from '../../utils/formatters';
import {
  matchesPartnerMacroGroup,
  PARTNER_MACRO_GROUPS,
  sanitizePartnerImageUrl,
  translatePartnerCategory,
  translatePartnerCountry,
  type PartnerMacroGroupId,
} from '../../utils/partnerHelpers';
import { prefetchRouteChunk } from '../../utils/routePrefetch';
import {
  buildPartnerValidationSeals,
  resolvePartnerPortrait,
} from '../../utils/trustedPartnersShowcase';
import { OptimizedImage } from '../OptimizedImage';
import { CuratedPartnerNetwork } from './CuratedPartnerNetwork';

interface TrustedPartnersShowcaseProps {
  variant: 'home' | 'directory';
  locale: 'pt-BR' | 'es-CL';
  whatsapp: string;
  partnersPublic: PartnerPublic[];
  sectionPad?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaDestination?: string;
  maxLiveItems?: number;
  onNavigate?: (path: string) => void;
  onSelectPartner?: (partner: PartnerPublic) => void;
  onOpenProposalTab?: () => void;
}

function getPartnerCategoryIcon(category: string) {
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
}

export const TrustedPartnersShowcase: React.FC<TrustedPartnersShowcaseProps> = ({
  variant,
  locale,
  whatsapp,
  partnersPublic,
  sectionPad = 'py-20 lg:py-28',
  eyebrow,
  title,
  subtitle,
  ctaLabel,
  ctaDestination = '/parceiros',
  maxLiveItems = 6,
  onNavigate,
  onSelectPartner,
  onOpenProposalTab,
}) => {
  const isEs = locale === 'es-CL';
  const [macroGroup, setMacroGroup] = useState<PartnerMacroGroupId>('Todos');

  const filteredLivePartners =
    macroGroup === 'Todos'
      ? partnersPublic
      : partnersPublic.filter((p) => matchesPartnerMacroGroup(p.categoria, macroGroup));

  const visibleLivePartners = filteredLivePartners.slice(0, maxLiveItems);

  const buildPartnerWaGreeting = (partner: PartnerPublic) =>
    isEs
      ? `¡Hola! Recibí la derivación curada de D&M Integra Chile para contactar a ${partner.nome}. Me gustaría consultar directamente por sus servicios.`
      : `Olá! Recebi a indicação curada da D&M Integra Chile para falar com ${partner.nome}. Gostaria de solicitar informações diretamente sobre atendimento.`;

  const resolvedEyebrow =
    eyebrow || (isEs ? 'Aliados de Confianza · Puente de Derivación' : 'Parceiros de Confiança · Ponte de Indicação Curada');
  const resolvedTitle =
    title ||
    (isEs
      ? 'Aliados de Confianza: actuación exclusiva en inmigración e indicación curada'
      : 'Parceiros de Confiança: atuamos exclusivamente em imigração e conectamos você a especialistas validados');
  const resolvedSubtitle =
    subtitle ||
    (isEs
      ? 'D&M Integra Chile se dedica exclusivamente a la asesoría de inmigración (Visa SERMIG y RUT). La vivienda no es un servicio garantizado: actuamos solo como puente transparente hacia aliados inmobiliarios y especialistas de confianza.'
      : 'A D&M Integra Chile atua exclusivamente na assessoria de imigração (Visto SERMIG e RUT). A moradia não é um serviço garantido — atuamos apenas como ponte de indicação curada para parceiros imobiliários e especialistas de confiança.');

  const innerContent = (
    <div data-testid="trusted-partners-showcase" className="space-y-12">
      {/* 1. Editorial Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-3xl space-y-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="h-px w-7 bg-[#B08D57]" />
            <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
              {resolvedEyebrow}
            </p>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white text-balance leading-[1.1]">
            {resolvedTitle}
          </h2>
          <p className="text-base text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl">
            {resolvedSubtitle}
          </p>
        </div>

        {variant === 'home' && onNavigate && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk('/parceiros')}
              onClick={() => onNavigate('/parceiros?secao=mapa')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-white dark:bg-[#0D1422] text-xs font-semibold text-[#0B1628] dark:text-slate-100 hover:border-[#0B1628] dark:hover:border-white transition-colors whitespace-nowrap"
            >
              <MapPin className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
              {isEs ? 'Ver mapa en Chile' : 'Mapa no Chile'}
            </button>
            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk('/parceiros')}
              onClick={() => onNavigate(ctaDestination)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B1628] dark:bg-[#E5C77B] text-white dark:text-[#070E1C] text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              {ctaLabel || (isEs ? 'Explorar Red de Confianza' : 'Explorar Parceiros de Confiança')}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Curated Partner Network: Clear Separation Between Direct Immigration Consultancy & Outsourced Services (Imobiliário, Jurídico, Câmbio) */}
      <CuratedPartnerNetwork
        locale={locale}
        whatsapp={whatsapp}
        onNavigate={onNavigate}
        onExploreVertical={
          variant === 'home' && partnersPublic.length > 0
            ? (macro) => {
                if (PARTNER_MACRO_GROUPS.some((g) => g.id === macro)) {
                  setMacroGroup(macro as PartnerMacroGroupId);
                }
              }
            : undefined
        }
      />

      {/* 4. Live Firestore Partners Grid (rendered automatically on Home whenever active partners exist) */}
      {variant === 'home' && partnersPublic.length > 0 && (
        <div className="space-y-6 pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div
              role="group"
              aria-label={isEs ? 'Filtrar aliados registrados por especialidad' : 'Filtrar parceiros cadastrados por área'}
              className="flex flex-wrap items-center gap-2"
            >
              {PARTNER_MACRO_GROUPS.map((group) => {
                const count =
                  group.id === 'Todos'
                    ? partnersPublic.length
                    : partnersPublic.filter((p) => matchesPartnerMacroGroup(p.categoria, group.id)).length;
                if (group.id !== 'Todos' && count === 0) return null;
                const active = macroGroup === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setMacroGroup(group.id)}
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
                ? `Mostrando ${visibleLivePartners.length} de ${filteredLivePartners.length} aliados homologados`
                : `Exibindo ${visibleLivePartners.length} de ${filteredLivePartners.length} parceiros homologados`}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleLivePartners.map((p) => {
              const safeLogo = sanitizePartnerImageUrl(p.logoUrl);
              const CatIcon = getPartnerCategoryIcon(p.categoria);
              const seals = buildPartnerValidationSeals(p, locale);
              const fallbackPortrait = resolvePartnerPortrait(p.categoria);
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
                      <div className="h-14 w-14 rounded-xl bg-[#F7F8FA] dark:bg-[#151F32] border border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-center overflow-hidden shrink-0">
                        {safeLogo ? (
                          <OptimizedImage
                            src={safeLogo}
                            alt={p.nome}
                            sizes="56px"
                            containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                            className="max-w-full max-h-full object-contain p-1.5"
                          />
                        ) : (
                          <OptimizedImage
                            src={fallbackPortrait}
                            alt={p.nome}
                            sizes="56px"
                            containerClassName="relative w-full h-full"
                            className="w-full h-full object-cover object-top"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-display text-base font-bold text-[#0B1628] dark:text-white leading-snug line-clamp-2">
                          {p.nome}
                        </h4>
                        <p className="text-xs text-[#6B7280] dark:text-slate-400 truncate mt-0.5 inline-flex items-center gap-1">
                          <CatIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
                          <span className="truncate">{p.cidadeRegiao}</span>
                        </p>
                      </div>
                    </div>

                    <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed line-clamp-3">
                      {p.descricaoPublica}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-[#8C6D14] dark:text-[#E5C77B]">
                      <span className="inline-flex items-center gap-1">
                        <BadgeCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        {seals[0]}
                      </span>
                      <span aria-hidden="true" className="text-[#CBD5E1] dark:text-slate-600">·</span>
                      <span className="text-[#6B7280] dark:text-slate-400">{seals[1]}</span>
                    </div>
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
                        {isEs ? 'Aliado validado' : 'Parceiro validado'}
                      </span>
                    )}
                    {onSelectPartner ? (
                      <button
                        type="button"
                        onClick={() => onSelectPartner(p)}
                        className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                      >
                        {isEs ? 'Ver perfil →' : 'Ver detalhes →'}
                      </button>
                    ) : onNavigate ? (
                      <button
                        type="button"
                        onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                        onClick={() => onNavigate(`/parceiros?macro=${encodeURIComponent(macroGroup)}`)}
                        className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                      >
                        {isEs ? 'Ver directorio →' : 'Ver na rede →'}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Executive Partner B2B Callout Bar */}
      <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] p-6 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="space-y-1 max-w-2xl">
          <p className="text-sm font-bold text-[#0B1628] dark:text-white">
            {isEs
              ? '¿Eres corredor inmobiliario, traductor, contador o abogado en Brasil o Chile?'
              : 'É corretor imobiliário, tradutor, contador ou advogado no Brasil ou no Chile?'}
          </p>
          <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300">
            {isEs
              ? 'Postula al Sello de Curaduría D&M sin cuota mensual fija y recibe derivaciones cualificadas con contratación directa.'
              : 'Candidate-se ao Selo de Curadoria D&M sem mensalidade fixa para receber indicações qualificadas com contratação direta.'}
          </p>
        </div>
        <button
          type="button"
          onMouseEnter={() => prefetchRouteChunk('/parceiros')}
          onClick={() => {
            if (onOpenProposalTab) {
              onOpenProposalTab();
            } else if (onNavigate) {
              onNavigate('/parceiros?secao=seja-parceiro');
            }
          }}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-[#0B1628] dark:border-white text-xs font-semibold text-[#0B1628] dark:text-white hover:bg-[#0B1628] hover:text-white dark:hover:bg-white dark:hover:text-[#0B1628] transition-colors whitespace-nowrap shrink-0"
        >
          {isEs ? 'Postular como Aliado de Confianza' : 'Quero ser Parceiro de Confiança'}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );

  if (variant === 'directory') {
    return (
      <section data-testid="trusted-partners-section" className="space-y-10">
        {innerContent}
      </section>
    );
  }

  return (
    <section
      data-testid="home-partners-section"
      className={`cv-auto ${sectionPad} bg-[#F7F8FA] dark:bg-[#070B12] border-t border-[#E5E7EB] dark:border-[#1E293B]`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">{innerContent}</div>
    </section>
  );
};
