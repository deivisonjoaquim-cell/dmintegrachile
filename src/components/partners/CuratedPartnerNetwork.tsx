import React, { useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Landmark,
  MessageCircle,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import {
  buildOutsourcedReferralWhatsAppMessage,
  DIRECT_IMMIGRATION_SCOPE_STEPS,
  filterOutsourcedVerticals,
  OUTSOURCED_PARTNER_VERTICALS,
  type OutsourcedPartnerFilter,
  type OutsourcedPartnerVerticalId,
} from '../../utils/curatedPartnerNetwork';
import { buildWhatsAppUrl } from '../../utils/formatters';
import { prefetchRouteChunk } from '../../utils/routePrefetch';
import { OptimizedImage } from '../OptimizedImage';

interface CuratedPartnerNetworkProps {
  locale: 'pt-BR' | 'es-CL';
  whatsapp: string;
  compact?: boolean;
  onNavigate?: (path: string) => void;
  onExploreVertical?: (macroGroup: string) => void;
}

function getVerticalIcon(id: OutsourcedPartnerVerticalId) {
  switch (id) {
    case 'imobiliario':
      return Building2;
    case 'juridico':
      return Scale;
    case 'cambio':
      return Landmark;
  }
}

export const CuratedPartnerNetwork: React.FC<CuratedPartnerNetworkProps> = ({
  locale,
  whatsapp,
  compact = false,
  onNavigate,
  onExploreVertical,
}) => {
  const isEs = locale === 'es-CL';
  const [activeFilter, setActiveFilter] = useState<OutsourcedPartnerFilter>('todos');
  const visibleVerticals = filterOutsourcedVerticals(activeFilter);

  const filterOptions: Array<{ id: OutsourcedPartnerFilter; label: string }> = [
    {
      id: 'todos',
      label: isEs
        ? `Todos los tercerizados (${OUTSOURCED_PARTNER_VERTICALS.length})`
        : `Todos os terceirizados (${OUTSOURCED_PARTNER_VERTICALS.length})`,
    },
    { id: 'imobiliario', label: isEs ? 'Inmobiliario' : 'Imobiliário' },
    { id: 'juridico', label: isEs ? 'Jurídico' : 'Jurídico' },
    { id: 'cambio', label: isEs ? 'Cambio' : 'Câmbio' },
  ];

  return (
    <div data-testid="curated-partner-network" className="space-y-8">
      {/* ZONA A: NOSSA ASSESSORIA DE IMIGRAÇÃO (ESCOPO DIRETO D&M) */}
      <div
        data-testid="direct-immigration-scope-card"
        className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl overflow-hidden border border-[#1E293B] bg-[#070E1C] text-white"
      >
        {/* Left: Direct Consultancy Positioning */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between gap-6 border-b lg:border-b-0 lg:border-r border-white/12">
          <div className="space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#E5C77B]">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {isEs
                  ? 'CONSULTORÍA DE INMIGRACIÓN · CONTRATO DIRECTO D&M'
                  : 'CONSULTORIA DE IMIGRAÇÃO · CONTRATO DIRETO D&M'}
              </span>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-white leading-snug text-balance">
              {isEs
                ? 'Lo que ejecutamos directamente: Visa SERMIG y proceso de RUT.'
                : 'O que executamos diretamente: Visto SERMIG e processo de RUT.'}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">
              {isEs
                ? 'Somos una consultoría especializada exclusivamente en inmigración Brasil–Chile. Nuestro contrato cubre la estrategia legal migratoria, el expediente documental y el acompañamiento hasta la emisión de tu Cédula (RUT).'
                : 'Somos uma consultoria especializada exclusivamente em imigração Brasil–Chile. Nosso contrato cobre a estratégia migratória, a conferência documental e a condução até a emissão do seu RUT.'}
            </p>
          </div>

          <div className="pt-5 border-t border-white/12 space-y-2">
            <p className="text-xs font-semibold text-[#E5C77B]">
              {isEs
                ? 'Separación clara frente a servicios tercerizados'
                : 'Separação clara frente a serviços terceirizados'}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {isEs
                ? 'No somos inmobiliaria, estudio jurídico general ni casa de cambio. La vivienda no es un servicio garantizado: para inmobiliario, jurídico y cambio actuamos únicamente como puente curado hacia socios independientes.'
                : 'Não somos imobiliária, escritório jurídico generalista nem corretora de câmbio. Moradia não é serviço garantido: para imobiliário, jurídico e câmbio atuamos apenas como ponte curada para parceiros independentes.'}
            </p>
          </div>
        </div>

        {/* Right: 4 Direct Immigration Deliverables */}
        <div className="lg:col-span-7 p-6 sm:p-8 bg-[#0B1628] flex flex-col justify-between gap-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#93C5FD]">
                {isEs ? 'Alcance Contratado · Ejecución D&M' : 'Escopo Contratado · Execução D&M'}
              </p>
              <p className="font-display text-base font-bold text-white mt-0.5">
                {isEs
                  ? '4 pilares de nuestra asesoría de inmigración'
                  : '4 pilares da nossa assessoria de imigração'}
              </p>
            </div>
            <span className="font-mono text-xs font-semibold text-[#E5C77B]">
              {isEs ? 'Exclusivo Visa & RUT' : 'Exclusivo Visto & RUT'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {DIRECT_IMMIGRATION_SCOPE_STEPS.map((step) => (
              <div key={step.num} className="space-y-1.5">
                <p className="font-mono text-xs font-semibold text-[#E5C77B] tabular-nums">
                  {step.num}.
                </p>
                <p className="font-display text-sm font-bold text-white leading-snug">
                  {isEs ? step.titleEs : step.titlePt}
                </p>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isEs ? step.detailEs : step.detailPt}
                </p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            <span>
              {isEs
                ? 'Contrato directo con D&M Integra Chile · Transparencia total en cada etapa.'
                : 'Contrato direto com a D&M Integra Chile · Transparência total em cada etapa.'}
            </span>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/diagnostico')}
                className="inline-flex items-center gap-1.5 font-semibold text-[#E5C77B] hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {isEs ? 'Iniciar Diagnóstico de Visa' : 'Iniciar Diagnóstico de Visto'}
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ZONA B: SERVIÇOS TERCEIRIZADOS INDEPENDENTES (IMOBILIÁRIO · JURÍDICO · CÂMBIO) */}
      <div className="space-y-6 pt-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E5E7EB] dark:border-[#1E293B]">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-xs font-semibold tracking-[0.06em] uppercase text-[#8C6D14] dark:text-[#E5C77B]">
              {isEs
                ? 'Servicios Tercerizados Independientes · Red de Aliados Curada'
                : 'Serviços Terceirizados Independentes · Rede de Parceiros Curada'}
            </p>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#0B1628] dark:text-white text-balance">
              {isEs
                ? 'Frentes externas con contratación directa: Inmobiliario, Jurídico y Cambio'
                : 'Frentes externas com contratação direta: Imobiliário, Jurídico e Câmbio'}
            </h3>
            <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
              {isEs
                ? 'Estos servicios no forman parte del contrato de asesoría migratoria de D&M. Curamos especialistas independientes para protegerte y actuamos solo como puente de indicación.'
                : 'Estes serviços não integram o contrato de assessoria migratória da D&M. Curamos especialistas independentes para proteger você e atuamos somente como ponte de indicação.'}
            </p>
          </div>

          {/* Interactive Filter Controls */}
          <div
            role="group"
            aria-label={
              isEs
                ? 'Filtrar servicios tercerizados por especialidad'
                : 'Filtrar serviços terceirizados por especialidade'
            }
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#ECEFF4] dark:bg-[#111B2E] border border-[#E2E8F0] dark:border-[#1E293B] shrink-0 self-start md:self-end"
          >
            {filterOptions.map((opt) => {
              const active = activeFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveFilter(opt.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white dark:bg-[#070E1C] text-[#0B1628] dark:text-white shadow-sm'
                      : 'text-[#475569] dark:text-slate-300 hover:text-[#0B1628] dark:hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Visual Cards Grid */}
        <div
          data-testid="outsourced-partner-cards-grid"
          className={`grid grid-cols-1 gap-6 ${
            visibleVerticals.length === 1
              ? 'max-w-xl'
              : compact
                ? 'md:grid-cols-3'
                : 'md:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {visibleVerticals.map((vertical) => {
            const VerticalIcon = getVerticalIcon(vertical.id);
            const waText = buildOutsourcedReferralWhatsAppMessage(vertical, locale);

            return (
              <article
                key={vertical.id}
                data-testid={`outsourced-card-${vertical.id}`}
                className="group bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#B08D57]/75 dark:hover:border-[#C9A86A]/70 rounded-2xl overflow-hidden flex flex-col justify-between transition-all hover:shadow-[0_16px_36px_rgba(7,14,28,0.08)] dark:hover:shadow-[0_16px_36px_rgba(0,0,0,0.45)]"
              >
                <div>
                  {/* Editorial Visual Portrait with Contrast Scrim */}
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#070E1C]">
                    <OptimizedImage
                      src={vertical.portraitUrl}
                      alt={isEs ? vertical.portraitAltEs : vertical.portraitAltPt}
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="w-full h-full object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 bg-gradient-to-t from-[#070E1C]/95 via-[#070E1C]/35 to-transparent"
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[#E5C77B] border-b border-[#E5C77B]/45 pb-1">
                        <BadgeCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{isEs ? vertical.sealEs : vertical.sealPt}</span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-snug">
                        {isEs ? vertical.regionEs : vertical.regionPt}
                      </p>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-5 sm:p-6 space-y-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8C6D14] dark:text-[#E5C77B]">
                        <VerticalIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{isEs ? vertical.categoryLabelEs : vertical.categoryLabelPt}</span>
                      </div>
                      <h4 className="font-display text-lg font-bold text-[#0B1628] dark:text-white leading-snug">
                        {isEs ? vertical.titleEs : vertical.titlePt}
                      </h4>
                    </div>

                    <p className="text-xs sm:text-[13px] text-[#4B5563] dark:text-slate-300 leading-relaxed">
                      {isEs ? vertical.summaryEs : vertical.summaryPt}
                    </p>

                    {/* Explicit Role Separation Matrix (Hairline Divided — Zero Nested Boxes) */}
                    <dl className="pt-3 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-2 text-xs">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="font-semibold text-[#64748B] dark:text-slate-400 shrink-0">
                          {isEs ? 'Rol de D&M:' : 'Papel da D&M:'}
                        </dt>
                        <dd className="text-right font-semibold text-[#0B1628] dark:text-white">
                          {isEs ? vertical.dmRoleEs : vertical.dmRolePt}
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="font-semibold text-[#64748B] dark:text-slate-400 shrink-0">
                          {isEs ? 'Ejecución:' : 'Execução:'}
                        </dt>
                        <dd className="text-right text-[#334155] dark:text-slate-200">
                          {isEs ? vertical.partnerExecutionEs : vertical.partnerExecutionPt}
                        </dd>
                      </div>
                    </dl>

                    {/* Deliverables */}
                    <ul className="space-y-1.5 pt-3 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                      {(isEs ? vertical.deliverablesEs : vertical.deliverablesPt).map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-2 text-xs text-[#374151] dark:text-slate-300 leading-snug"
                        >
                          <Check
                            className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Scope Disclaimer */}
                    <p className="text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed pt-2 border-t border-[#E5E7EB]/70 dark:border-[#1E293B]">
                      {isEs ? vertical.disclaimerEs : vertical.disclaimerPt}
                    </p>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 sm:px-6 py-4 border-t border-[#E5E7EB] dark:border-[#1E293B] bg-[#FAFBFD] dark:bg-[#0A111E] flex items-center justify-between gap-3 text-xs">
                  <a
                    href={buildWhatsAppUrl(whatsapp, waText)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold text-[#047857] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                    {isEs ? 'Solicitar indicación' : 'Solicitar indicação'}
                  </a>
                  {onExploreVertical ? (
                    <button
                      type="button"
                      onClick={() => onExploreVertical(vertical.macroGroupLink)}
                      className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                    >
                      {isEs ? 'Ver socios →' : 'Ver parceiros →'}
                    </button>
                  ) : onNavigate ? (
                    <button
                      type="button"
                      onMouseEnter={() => prefetchRouteChunk('/parceiros')}
                      onClick={() =>
                        onNavigate(`/parceiros?macro=${encodeURIComponent(vertical.macroGroupLink)}`)
                      }
                      className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap shrink-0"
                    >
                      {isEs ? 'Explorar red →' : 'Explorar rede →'}
                    </button>
                  ) : (
                    <span className="font-mono text-[11px] text-[#8C6D14] dark:text-[#E5C77B] whitespace-nowrap shrink-0">
                      {isEs ? 'Tercerizado' : 'Terceirizado'}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};
