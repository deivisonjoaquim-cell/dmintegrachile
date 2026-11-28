import React, { useState } from 'react';
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Building2,
  Check,
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
  CURATED_TRUSTED_PARTNER_PROFILES,
  REFERRAL_BRIDGE_PILLARS,
  resolvePartnerPortrait,
} from '../../utils/trustedPartnersShowcase';
import { OptimizedImage } from '../OptimizedImage';

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
      ? 'D&M Integra Chile se dedica exclusivamente a la asesoría de inmigración (Visas SERMIG, PDI y RUT). La vivienda no es un servicio garantizado: actuamos solo como puente transparente hacia aliados inmobiliarios y especialistas de confianza.'
      : 'A D&M Integra Chile atua exclusivamente na assessoria de imigração (Vistos SERMIG, PDI e RUT). A moradia não é um serviço garantido — atuamos apenas como ponte de indicação curada para parceiros imobiliários e especialistas de confiança.');

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

      {/* 2. Transparent Bridge of Referral Architecture (Detailed Explanation) */}
      <div
        data-testid="referral-bridge-statement"
        className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B]"
      >
        {/* Left Executive Column: Exclusive Immigration Scope + Non-Guaranteed Housing Clarification */}
        <div className="lg:col-span-5 bg-[#070E1C] text-white p-7 sm:p-9 flex flex-col justify-between gap-7">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#E5C77B]">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isEs
                  ? 'ALCANCE EXCLUSIVO DE INMIGRACIÓN · D&M'
                  : 'ESCOPO EXCLUSIVO DE IMIGRAÇÃO · D&M'}
              </span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug text-balance">
              {isEs
                ? 'Conducimos únicamente tus trámites migratorios: Visa, PDI y RUT.'
                : 'Atuamos exclusivamente na assessoria de imigração: Vistos, PDI e RUT.'}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {isEs
                ? 'Nuestro contrato de consultoría abarca diagnóstico migratorio, auditoría documental en Brasil, protocolo ante el SERMIG, Estampado Electrónico, registro en la PDI y emisión de la Cédula de Identidad (RUT).'
                : 'Nosso serviço contratado abrange diagnóstico migratório, auditoria documental no Brasil, protocolo no SERMIG, Estampado Electrónico, registro obrigatório na PDI e emissão da Cédula de Identidade (RUT).'}
            </p>
          </div>

          <div className="pt-5 border-t border-white/15 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#E5C77B]">
              <Award className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isEs
                  ? 'Transparencia sobre vivienda y arriendo'
                  : 'Transparência total sobre moradia'}
              </span>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed">
              {isEs
                ? 'La vivienda no es un servicio garantizado por D&M Integra Chile. Actuamos únicamente como puente de indicación curada hacia corredores inmobiliarios y profesionales independientes de confianza.'
                : 'A moradia não é um serviço garantido pela D&M Integra Chile. Atuamos apenas como ponte de indicação curada para parceiros imobiliários e especialistas independentes de confiança.'}
            </p>
          </div>
        </div>

        {/* Right Column: 4-Step Bridge of Indication Guarantee */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0D1422] p-7 sm:p-9 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[#E5E7EB] dark:border-[#1E293B]">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                {isEs ? 'Cómo Funciona Nuestro Puente de Indicación' : 'Como Atuamos Apenas Como Ponte de Indicação'}
              </p>
              <h3 className="font-display text-lg font-bold text-[#0B1628] dark:text-white mt-0.5">
                {isEs
                  ? 'Transparencia jurídica y seguridad en cada derivación'
                  : 'Transparência jurídica e segurança em cada indicação'}
              </h3>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C6D14] dark:text-[#E5C77B]">
              <BadgeCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isEs ? 'Curaduría Verificada' : 'Curadoria Validada'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {REFERRAL_BRIDGE_PILLARS.map((pillar) => (
              <div key={pillar.num} className="space-y-1.5">
                <p className="font-mono text-xs font-semibold text-[#B08D57] dark:text-[#E5C77B]">
                  {pillar.num}.
                </p>
                <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white leading-snug">
                  {isEs ? pillar.titleEs : pillar.titlePt}
                </p>
                <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                  {isEs ? pillar.descEs : pillar.descPt}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Editorial Portraits Showcase with Validation Seals (4 Curated Specialties) */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold tracking-[0.06em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
              {isEs ? 'Especialistas Indicados · Sello de Validación D&M' : 'Profissionais Indicados · Selo de Validação D&M'}
            </p>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#0B1628] dark:text-white">
              {isEs
                ? 'Frentes cubiertas por nuestra red curada de confianza'
                : 'Frentes atendidas pela nossa rede de parceiros de confiança'}
            </h3>
          </div>
          <p className="text-xs text-[#6B7280] dark:text-slate-400 max-w-md sm:text-right">
            {isEs
              ? 'Derivación gratuita para clientes y futuros residentes, con contacto y contratación directa.'
              : 'Indicação transparente com selo de curadoria prévia e contratação direta com o profissional.'}
          </p>
        </div>

        <div
          data-testid="trusted-partners-portraits-grid"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {CURATED_TRUSTED_PARTNER_PROFILES.map((profile) => {
            const waText = isEs
              ? `¡Hola! Vi la sección de Aliados de Confianza en D&M Integra Chile y me gustaría solicitar ${profile.whatsappTopicEs}. Entiendo que la contratación es directa e independiente.`
              : `Olá! Vi a seção Parceiros de Confiança na D&M Integra Chile e gostaria de solicitar ${profile.whatsappTopicPt}. Ciente de que a contratação é direta e independente.`;

            return (
              <article
                key={profile.id}
                className="group bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#B08D57]/70 dark:hover:border-[#C9A86A]/65 rounded-2xl overflow-hidden flex flex-col justify-between transition-all hover:shadow-[0_16px_36px_rgba(7,14,28,0.08)] dark:hover:shadow-[0_16px_36px_rgba(0,0,0,0.45)]"
              >
                <div>
                  {/* Editorial Portrait with Subtle Scrim & Crisp Validation Seal */}
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#070E1C]">
                    <OptimizedImage
                      src={profile.portraitUrl}
                      alt={isEs ? profile.portraitAltEs : profile.portraitAltPt}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#070E1C]/95 via-[#070E1C]/30 to-transparent"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 space-y-1.5">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[#E5C77B] border-b border-[#E5C77B]/45 pb-1">
                        <BadgeCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{isEs ? profile.sealCodeEs : profile.sealCodePt}</span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-snug">
                        {isEs ? profile.regionEs : profile.regionPt}
                      </p>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 space-y-3.5">
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                        {isEs ? profile.kickerEs : profile.kickerPt}
                      </p>
                      <h4 className="font-display text-base font-bold text-[#0B1628] dark:text-white leading-snug">
                        {isEs ? profile.titleEs : profile.titlePt}
                      </h4>
                    </div>

                    <p className="text-xs sm:text-[13px] text-[#4B5563] dark:text-slate-300 leading-relaxed">
                      {isEs ? profile.summaryEs : profile.summaryPt}
                    </p>

                    <ul className="space-y-1.5 pt-2 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                      {(isEs ? profile.validationChecksEs : profile.validationChecksPt).map((check) => (
                        <li
                          key={check}
                          className="flex items-start gap-2 text-[11px] text-[#374151] dark:text-slate-300 leading-snug"
                        >
                          <Check className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#E5C77B] shrink-0 mt-0.5" aria-hidden="true" />
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>

                    <p className="text-[11px] text-[#6B7280] dark:text-slate-400 leading-relaxed pt-1">
                      {isEs ? profile.bridgeNoteEs : profile.bridgeNotePt}
                    </p>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-5 py-4 border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FAFBFD] dark:bg-[#0A111E] flex items-center justify-between gap-2 text-xs">
                  <a
                    href={buildWhatsAppUrl(whatsapp, waText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#047857] dark:text-emerald-400 hover:underline whitespace-nowrap"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    {isEs ? 'Solicitar indicación' : 'Solicitar indicação'}
                  </a>
                  {variant === 'home' && onNavigate ? (
                    <button
                      type="button"
                      onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                      onClick={() => onNavigate('/parceiros')}
                      className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                    >
                      {isEs ? 'Ver red →' : 'Ver rede →'}
                    </button>
                  ) : (
                    <span className="font-mono text-[11px] text-[#8C6D14] dark:text-[#E5C77B] whitespace-nowrap">
                      {isEs ? 'Validado' : 'Validado'}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>

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
