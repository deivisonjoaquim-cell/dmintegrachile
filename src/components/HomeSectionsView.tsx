import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  Compass,
  MessageCircle,
  Quote,
  Scale,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import type {
  EmpresaConfig,
  LegalSource,
  PartnerPublic,
  SiteContent,
  SiteSectionKey,
} from '../types/domain';
import { buildWhatsAppUrl, sanitizeHtml } from '../utils/formatters';
import { BrandLogo } from './BrandLogo';

export interface ServiceItemMeta {
  numero: string;
  titulo: string;
  descricao: string;
  paraQuem?: string;
  subcategoriaTipica?: string;
  faixaPrazo?: string;
  jurisdicao?: string;
}

const SERVICE_DETAILS_FALLBACK: Record<
  string,
  { paraQuem: string; subcategoriaTipica: string; faixaPrazo: string; jurisdicao: string }
> = {
  '01': {
    paraQuem: 'Brasileiros que planejam morar, trabalhar ou empreender no Chile, com ou sem oferta prévia de emprego.',
    subcategoriaTipica:
      'Subcategoria 15 (Acordo Mercosul · Brasil–Chile) ou Subcategorias 01, 02, 03, 11 e 13 da legislação chilena (Decreto Supremo Nº 177/2022)',
    faixaPrazo: 'Preparação documental: 15 a 35 dias · Análise do SERMIG: 3 a 8 meses em média',
    jurisdicao: 'Legislação Chilena · Acordo Mercosul',
  },
  '02': {
    paraQuem: 'Residentes temporais no Chile que precisam prorrogar o visto, alterar subcategoria ou solicitar a Residência Definitiva.',
    subcategoriaTipica:
      'Prorrogação, Mudança de Subcategoria e Residência Definitiva (24 meses) — legislação chilena (Ley Nº 21.325 e Decreto Nº 296/2022)',
    faixaPrazo: 'Janela legal: de 90 a 10 dias antes do vencimento da residência atual',
    jurisdicao: 'Legislação Chilena (SERMIG)',
  },
  '03': {
    paraQuem:
      'Pessoas e famílias que desejam evitar exigências, indeferimentos ou o vencimento dos Antecedentes da Polícia Federal (60 dias).',
    subcategoriaTipica:
      'Certidões civis e Polícia Federal (Brasil), Apostila de Haia (Resolução brasileira CNJ nº 228/2016) e tradução juramentada',
    faixaPrazo: 'Cronograma reverso ajustado à data prevista do protocolo no SERMIG',
    jurisdicao: 'Normas Brasileiras · Exigências Chilenas',
  },
  '04': {
    paraQuem: 'Recém-aprovados que ingressarão no Chile para cumprir o registro na PDI e emitir a Cédula de Identidade.',
    subcategoriaTipica:
      'Estampado Electrónico (SERMIG), Registro na PDI, Cédula de Identidade (Registro Civil do Chile), ClaveÚnica e RUT',
    faixaPrazo: 'Ingresso em até 90 dias após o Estampado, seguido pelos agendamentos presenciais',
    jurisdicao: 'Procedimentos no Chile (PDI · Registro Civil)',
  },
};

interface HomeSectionsViewProps {
  empresa: EmpresaConfig;
  siteContent: SiteContent[];
  partnersPublic: PartnerPublic[];
  onNavigate: (path: string) => void;
  onOpenLawModal?: () => void;
  onOpenCalendly?: () => void;
  previewMode?: boolean;
}

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
      headingClass: 'text-[var(--color-text)]',
      subClass: 'text-slate-600',
      eyebrowClass: 'text-[#8F6F16]',
      cardClass:
        'bg-[var(--color-surface)] border border-slate-200/90 shadow-[0_1px_2px_rgba(11,31,51,0.03)] hover:border-slate-300 hover:shadow-[0_10px_28px_rgba(11,31,51,0.06)] transition-all duration-200',
    };
  }
  return {
    isDark: false,
    sectionStyle: { backgroundColor: 'var(--color-surface)' } as React.CSSProperties,
    sectionClass: 'border-y border-slate-200/80 text-[var(--color-text)]',
    headingClass: 'text-[var(--color-text)]',
    subClass: 'text-slate-600',
    eyebrowClass: 'text-[#8F6F16]',
    cardClass:
      'bg-[var(--color-surface)] border border-slate-200/90 shadow-[0_1px_2px_rgba(11,31,51,0.03)] hover:border-slate-300 hover:shadow-[0_10px_28px_rgba(11,31,51,0.06)] transition-all duration-200',
  };
}

export const HomeSectionsView: React.FC<HomeSectionsViewProps> = ({
  empresa,
  siteContent,
  partnersPublic,
  onNavigate,
  onOpenLawModal,
  onOpenCalendly,
  previewMode = false,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [serviceDrawer, setServiceDrawer] = useState<ServiceItemMeta | null>(null);
  const [compLocal, setCompLocal] = useState<'brasil' | 'turista_chile' | 'residente_chile'>('brasil');
  const [compObj, setCompObj] = useState<'morar_trabalhar' | 'trabalho_oferta' | 'estudar' | 'renda' | 'familia'>(
    'morar_trabalhar',
  );
  const [compVinculo, setCompVinculo] = useState<'nao' | 'sim'>('nao');

  const density = empresa.layoutConfig?.densidadeSecoes || 'equilibrada';
  const sectionPad =
    density === 'compacta' ? 'py-10 lg:py-12' : density === 'ampla' ? 'py-20 lg:py-26' : 'py-14 lg:py-20';

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

  const brandShortName = empresa.nome_empresa.split('–')[0].trim();

  const comparatorRecommendation = useMemo(() => {
    if (compLocal === 'residente_chile') {
      return {
        jurisdicao: 'Legislação Chilena · Ley Nº 21.325 e Decreto Nº 296/2022',
        titulo: 'Prorrogação ou Residência Definitiva',
        resumo:
          'Avaliamos o tempo de residência vigente, os períodos de ausência do país e a janela legal de 90 a 10 dias anteriores ao vencimento.',
        alerta: 'Mantenha o protocolo dentro da janela legal da legislação chilena para preservar sua regularidade migratória.',
      };
    }
    if (compVinculo === 'sim' || compObj === 'familia') {
      return {
        jurisdicao: 'Legislação Chilena · Decreto Supremo Nº 177/2022',
        titulo: 'Reunificação Familiar (Subcategoria 01)',
        resumo:
          'Com vínculo formalizado (casamento, união civil registrada ou filho chileno), a solicitação pode ser analisada inclusive para quem já se encontra no Chile.',
        alerta:
          compLocal === 'turista_chile'
            ? 'Caso o vínculo ainda não esteja formalizado em registro civil, a legislação chilena exige que o pedido inicial seja protocolado a partir do exterior.'
            : undefined,
      };
    }
    if (compObj === 'trabalho_oferta') {
      return {
        jurisdicao: 'Acordo Internacional (Mercosul) · Legislação Chilena',
        titulo: 'Acordo Mercosul (Subcategoria 15) ou Atividades Lícitas (Subcategoria 02)',
        resumo:
          'Para brasileiros, o Acordo Mercosul costuma oferecer maior liberdade profissional, sem vínculo exclusivo a um único empregador. Comparamos ambas as opções no diagnóstico.',
        alerta:
          compLocal === 'turista_chile'
            ? 'Atenção: pela regra geral da legislação chilena, o protocolo inicial deve ocorrer fora do território chileno.'
            : undefined,
      };
    }
    if (compObj === 'estudar') {
      return {
        jurisdicao: 'Acordo Internacional (Mercosul) · Legislação Chilena',
        titulo: 'Acordo Mercosul (Subcategoria 15) ou Estudantes (Subcategoria 03)',
        resumo:
          'Quem possui nacionalidade brasileira pode optar pelo Acordo Mercosul — que autoriza trabalho amplo e leva diretamente à Residência Definitiva — ou pela subcategoria chilena de Estudantes.',
        alerta:
          compLocal === 'turista_chile'
            ? 'Atenção: a solicitação inicial exige protocolo eletrônico a partir do exterior.'
            : undefined,
      };
    }
    if (compObj === 'renda') {
      return {
        jurisdicao: 'Acordo Internacional (Mercosul) · Legislação Chilena',
        titulo: 'Acordo Mercosul (Subcategoria 15) ou Aposentados e Rentistas (Subcategoria 11)',
        resumo:
          'Avaliamos se a comprovação de renda passiva é vantajosa ou se a via Mercosul simplifica o conjunto documental do seu processo.',
        alerta:
          compLocal === 'turista_chile'
            ? 'Atenção: pela regra geral da Ley chilena Nº 21.325, o pedido inicial deve ser enviado fora do território chileno.'
            : undefined,
      };
    }
    return {
      jurisdicao: 'Acordo Internacional (Mercosul · Brasil–Chile)',
      titulo: 'Acordo Mercosul — Subcategoria 15',
      resumo:
        'Principal alternativa para cidadãos brasileiros: dispensa oferta prévia de emprego ou comprovação de renda e autoriza o trabalho regular no Chile.',
      alerta:
        compLocal === 'turista_chile'
          ? 'Atenção: quem está no Chile como turista, sem vínculo familiar formalizado, precisa sair do território chileno para protocolar o pedido inicial.'
          : undefined,
    };
  }, [compLocal, compObj, compVinculo]);

  const whatsappHeroUrl = buildWhatsAppUrl(
    empresa.whatsapp,
    'Olá! Gostaria de receber informações sobre assessoria migratória para o Chile.',
  );

  const navigateAction = (dest: string) => {
    if (previewMode) return;
    if (dest.startsWith('http')) {
      window.open(dest, '_blank', 'noopener,noreferrer');
    } else {
      onNavigate(dest);
    }
  };

  const renderPartnersGrid = (
    sec: {
      titulo: string;
      subtitulo: string;
      conteudoHtml?: string;
      ctaTexto?: string;
      ctaDestino?: string;
      metadados?: Record<string, unknown>;
    },
    keyId: string,
  ) => {
    if (partnersPublic.length === 0) return null;
    const meta = (sec.metadados || {}) as Record<string, unknown>;
    const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'suave');
    const maxItens = Math.max(1, Number(meta.maxItens || 3));
    return (
      <section key={keyId} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div className="max-w-2xl">
              {Boolean(meta.eyebrow) && (
                <p className={`text-xs font-semibold mb-1.5 ${theme.eyebrowClass}`}>{String(meta.eyebrow)}</p>
              )}
              <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight mb-2 ${theme.headingClass}`}>
                {sec.titulo}
              </h2>
              <p className={`text-base ${theme.subClass}`}>{sec.subtitulo}</p>
              {sec.conteudoHtml && <p className={`text-xs mt-2 ${theme.subClass}`}>{sec.conteudoHtml}</p>}
            </div>
            <button
              type="button"
              onClick={() => navigateAction(sec.ctaDestino || '/parceiros')}
              className={`inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap shrink-0 hover:underline ${
                theme.isDark ? 'text-white' : ''
              }`}
              style={!theme.isDark ? { color: 'var(--color-primary)' } : undefined}
            >
              {sec.ctaTexto || 'Explorar rede de parceiros'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {partnersPublic.slice(0, maxItens).map((p) => (
              <div key={p.id} className={`${theme.cardClass} card-radius p-6 flex flex-col justify-between gap-4`}>
                <div>
                  <p className={`text-xs font-medium mb-2 ${theme.isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                    {p.categoria} · {p.pais}
                  </p>
                  <h3 className={`text-base font-bold mb-2 ${theme.headingClass}`}>{p.nome}</h3>
                  <p className={`text-sm leading-relaxed ${theme.subClass}`}>{p.descricaoPublica}</p>
                </div>
                <p
                  className={`text-xs pt-3 border-t ${
                    theme.isDark ? 'border-white/10 text-slate-300' : 'border-slate-100 text-slate-500'
                  }`}
                >
                  {p.cidadeRegiao}
                </p>
              </div>
            ))}
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
      const heroDestaques = (meta.destaques as string[] | undefined) || [
        'Atendimento integral em português do Brasil',
        'Base normativa alinhada à legislação chilena (Ley Nº 21.325) e ao SERMIG',
        'Acompanhamento transparente em 15 etapas no Portal do Cliente',
      ];
      const eyebrow =
        (meta.eyebrow as string) ||
        'Assessoria Migratória Brasil–Chile · Legislação Chilena (Ley Nº 21.325) e Acordo Mercosul';
      const ctaPrimario = sec.ctaTexto || (meta.ctaPrimario as string) || 'Fazer Diagnóstico Gratuito';
      const ctaSecundario = (meta.ctaSecundario as string) || 'Falar no WhatsApp';
      const badgeTitulo = (meta.badgeTitulo as string) || 'Atuação Brasil–Chile';
      const badgeSubtitulo =
        (meta.badgeSubtitulo as string) ||
        'Do diagnóstico SERMIG à emissão da Cédula de Identidade chilena';

      if (variante === 'banner-cheio') {
        return (
          <section key={sec.id} className="relative overflow-hidden bg-[#0B1B29] text-white border-b border-slate-800">
            {sec.imagemUrl && (
              <img
                src={sec.imagemUrl}
                alt={sec.titulo}
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover opacity-30"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#071422]/95 via-[#071422]/80 to-[#071422]/55" />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-22">
              <div className="max-w-3xl space-y-5">
                <div className="flex items-center gap-3.5">
                  <BrandLogo
                    src={empresa.logoDarkUrl || empresa.logoUrl}
                    alt={empresa.nome_empresa}
                    variant="emblem-dark"
                    className="h-14 w-14 shrink-0"
                  />
                  <div>
                    <p className="text-sm font-bold text-white tracking-tight">{brandShortName}</p>
                    <p className="text-xs font-medium text-[#E5C76B]">{eyebrow}</p>
                  </div>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] text-balance">
                  {sec.titulo}
                </h1>
                <p className="text-base sm:text-lg text-slate-200 leading-relaxed">{sec.subtitulo}</p>
                {sec.conteudoHtml && (
                  <div
                    className="text-sm text-slate-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(sec.conteudoHtml) }}
                  />
                )}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                    className="inline-flex items-center gap-2 px-6 py-3.5 btn-radius text-sm font-bold text-[#0B1523] transition-opacity hover:opacity-95"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    {ctaPrimario}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href={whatsappHeroUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3.5 btn-radius text-sm font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors"
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
        );
      }

      if (variante === 'centralizado') {
        return (
          <section key={sec.id} className="bg-[var(--color-surface)] border-b border-slate-200">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 lg:py-20 text-center space-y-6">
              <div className="flex justify-center">
                <BrandLogo
                  src={empresa.logoUrl}
                  alt={empresa.nome_empresa}
                  variant="full"
                  className="h-24 sm:h-28 w-auto max-w-[340px] object-contain"
                />
              </div>
              <p className="text-xs font-semibold tracking-wide text-[#8F6F16]">{eyebrow}</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[var(--color-text)] leading-[1.1] text-balance">
                {sec.titulo}
              </h1>
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl mx-auto">{sec.subtitulo}</p>
              {sec.conteudoHtml && (
                <div
                  className="text-sm text-slate-600 leading-relaxed max-w-2xl mx-auto"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(sec.conteudoHtml) }}
                />
              )}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 btn-radius text-sm font-semibold text-white transition-opacity hover:opacity-95"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {ctaPrimario}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href={whatsappHeroUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3.5 btn-radius text-sm font-semibold text-slate-800 border border-slate-300 bg-white hover:bg-slate-50"
                >
                  <MessageCircle className="w-4 h-4 text-[#1E7E34]" />
                  {ctaSecundario}
                </a>
              </div>
              {sec.imagemUrl && (
                <div className="relative h-64 sm:h-96 card-radius overflow-hidden border border-slate-200 bg-slate-900 text-left mt-8">
                  <img
                    src={sec.imagemUrl}
                    alt={sec.titulo}
                    referrerPolicy="no-referrer"
                    className={`w-full h-full ${imgFitClass}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 text-white">
                    <p className="text-xs font-medium text-slate-200">{badgeTitulo}</p>
                    <p className="text-base font-semibold mt-0.5">{badgeSubtitulo}</p>
                  </div>
                </div>
              )}
              {heroDestaques.length > 0 && (
                <div className="mt-10 pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                  {heroDestaques.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                      <p className="text-sm font-medium text-slate-800">{item}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      }

      const imageFirst = variante === 'split-esquerda';
      return (
        <section
          key={sec.id}
          className="bg-[var(--color-surface)] border-b border-slate-200/80 relative overflow-hidden"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              {/* Coluna Editorial Principal */}
              <div className={`lg:col-span-7 flex flex-col justify-center ${imageFirst ? 'lg:order-2' : 'lg:order-1'}`}>
                {/* Identidade Institucional Visível na Dobra Principal */}
                <div className="flex items-center gap-4 pb-5 mb-6 border-b border-slate-200/80">
                  <BrandLogo
                    src={empresa.logoUrl}
                    alt={empresa.nome_empresa}
                    variant="emblem"
                    className="h-14 w-14 sm:h-16 sm:w-16 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-text)] leading-tight">
                      {brandShortName}
                    </p>
                    <p className="text-xs font-semibold text-[#8F6F16] mt-0.5 leading-snug">
                      {eyebrow}
                    </p>
                  </div>
                </div>

                <h1 className="text-[clamp(2.15rem,3.6vw,3.3rem)] font-bold tracking-[-0.03em] text-[var(--color-text)] leading-[1.08] text-balance mb-4">
                  {sec.titulo}
                </h1>
                <p className="text-base sm:text-[17px] text-slate-600 leading-[1.65] max-w-2xl mb-4">
                  {sec.subtitulo}
                </p>
                {sec.conteudoHtml && (
                  <div
                    className="text-sm text-slate-600 leading-relaxed max-w-2xl mb-7"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(sec.conteudoHtml) }}
                  />
                )}

                {/* Ações Primárias */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                    className="inline-flex items-center gap-2.5 px-6.5 py-3.5 btn-radius text-sm font-semibold text-white shadow-[0_6px_18px_rgba(11,31,51,0.18)] transition-all duration-150 hover:opacity-95 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {ctaPrimario}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href={whatsappHeroUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5.5 py-3.5 btn-radius text-sm font-semibold text-slate-800 border border-slate-300/90 bg-white hover:bg-slate-50 hover:border-slate-400 transition-all duration-150 whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 text-[#1E7E34]" />
                    {ctaSecundario}
                  </a>
                  <button
                    type="button"
                    onClick={() => navigateAction('/acompanhar')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-[var(--color-primary)] transition-colors whitespace-nowrap shrink-0"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Acompanhar meu processo
                  </button>
                </div>
              </div>

              {/* Coluna Visual Executiva — Fotografia + Selo da Marca */}
              <div className={`lg:col-span-5 ${imageFirst ? 'lg:order-1' : 'lg:order-2'}`}>
                <div className="relative h-80 sm:h-96 lg:h-full min-h-[410px] card-radius overflow-hidden border border-slate-200/90 bg-[#0B1F33] shadow-[0_18px_42px_rgba(11,31,51,0.14)]">
                  {sec.imagemUrl ? (
                    <img
                      src={sec.imagemUrl}
                      alt={sec.titulo}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full ${imgFitClass}`}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm">
                      Santiago do Chile · Assessoria Internacional
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#071422]/92 via-[#071422]/30 to-[#071422]/15" />

                  {/* Selo institucional no topo direito sobre a imagem */}
                  <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold tracking-wide text-white/95 bg-[#071422]/65 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/15">
                      Brasil · Chile · SERMIG
                    </span>
                  </div>

                  {/* Base institucional com emblema escuro */}
                  <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3.5 text-white">
                    <BrandLogo
                      src={empresa.logoDarkUrl || empresa.logoUrl}
                      alt={empresa.nome_empresa}
                      variant="emblem-dark"
                      className="h-12 w-12 shrink-0 drop-shadow-md"
                    />
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-semibold tracking-wide text-[#E5C76B]">{badgeTitulo}</p>
                      <p className="text-sm sm:text-base font-semibold leading-snug text-white">{badgeSubtitulo}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Faixa Arquitetônica de Confiança (4 Pilares Diretos, zero cards aninhados) */}
            <div className="mt-10 pt-7 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  kicker: 'Atendimento',
                  titulo: '100% em Português',
                  desc: heroDestaques[0] || 'Condução integral a partir do Brasil para todo o território chileno.',
                },
                {
                  kicker: 'Legislação Chilena',
                  titulo: 'Ley Nº 21.325 & SERMIG',
                  desc: 'Enquadramento atualizado pelos Decretos chilenos Nº 177 e Nº 296/2022.',
                },
                {
                  kicker: 'Acordo Internacional',
                  titulo: 'Mercosul (Cód. 15)',
                  desc: 'Residência Temporal para brasileiros com direito a trabalho regular no Chile.',
                },
                {
                  kicker: 'Legislação Brasileira',
                  titulo: 'LGPD & Apostila CNJ',
                  desc: 'Conformidade com a Lei brasileira nº 13.709/2018 e cronograma de certidões.',
                },
              ].map((pillar) => (
                <div key={pillar.titulo} className="space-y-1">
                  <p className="text-[11px] font-semibold tracking-wide text-[#8F6F16]">{pillar.kicker}</p>
                  <p className="text-sm font-bold text-slate-900">{pillar.titulo}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{pillar.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
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

      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-14">
            {/* Bloco 1: Simulador Orientativo Rápido em Destaque */}
            {showComparator && (
              <div className="bg-[var(--color-surface)] border border-slate-200/90 card-radius overflow-hidden shadow-[0_8px_28px_rgba(11,31,51,0.06)] text-slate-900">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-7 p-6 sm:p-8 space-y-5 flex flex-col justify-center">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Compass className="w-4 h-4 text-[#8F6F16]" />
                        <p className="text-xs font-semibold tracking-wide text-[#8F6F16]">
                          Pré-enquadramento rápido · Base SERMIG
                        </p>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                        Qual via migratória melhor atende ao seu perfil?
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                        Selecione três informações básicas para visualizar a rota indicada pela legislação chilena e pelo Acordo Mercosul antes de abrir o diagnóstico completo.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">Onde você está atualmente?</label>
                        <select
                          value={compLocal}
                          onChange={(e) => setCompLocal(e.target.value as typeof compLocal)}
                          className="w-full px-3 py-2.5 btn-radius border border-slate-300 bg-white text-slate-900 focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                        >
                          <option value="brasil">No Brasil ou no exterior</option>
                          <option value="turista_chile">No Chile como turista</option>
                          <option value="residente_chile">Já resido regularmente no Chile</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">Principal objetivo</label>
                        <select
                          value={compObj}
                          onChange={(e) => setCompObj(e.target.value as typeof compObj)}
                          className="w-full px-3 py-2.5 btn-radius border border-slate-300 bg-white text-slate-900 focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                        >
                          <option value="morar_trabalhar">Morar ou empreender no Chile</option>
                          <option value="trabalho_oferta">Trabalhar com contrato formal</option>
                          <option value="estudar">Estudar no Chile</option>
                          <option value="renda">Viver de aposentadoria ou renda</option>
                          <option value="familia">Reunificação com familiar no Chile</option>
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">Vínculo familiar formal?</label>
                        <select
                          value={compVinculo}
                          onChange={(e) => setCompVinculo(e.target.value as typeof compVinculo)}
                          className="w-full px-3 py-2.5 btn-radius border border-slate-300 bg-white text-slate-900 focus:border-[var(--color-primary)] focus:outline-none transition-colors"
                        >
                          <option value="nao">Não possuo vínculo</option>
                          <option value="sim">Sim (cônjuge ou filho chileno)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div
                    className="lg:col-span-5 p-6 sm:p-8 text-white flex flex-col justify-between space-y-4"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-semibold tracking-wide text-[#E5C76B]">
                        {comparatorRecommendation.jurisdicao}
                      </p>
                      <p className="text-lg font-bold tracking-tight text-white leading-snug">
                        {comparatorRecommendation.titulo}
                      </p>
                      <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed">
                        {comparatorRecommendation.resumo}
                      </p>
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
                      Validar meu perfil no Diagnóstico Gratuito
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Bloco 2: Portfólio de Serviços Especializados */}
            <div>
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
                <div className="max-w-2xl">
                  <p className={`text-xs font-semibold tracking-wide mb-2 ${theme.eyebrowClass}`}>
                    {(meta.eyebrow as string) || 'Serviços especializados'}
                  </p>
                  <h2
                    className={`text-2xl sm:text-[34px] font-bold tracking-tight leading-tight text-balance mb-3 ${theme.headingClass}`}
                  >
                    {sec.titulo}
                  </h2>
                  <p className={`text-base leading-relaxed ${theme.subClass}`}>{sec.subtitulo}</p>
                </div>
                {onOpenLawModal && (
                  <button
                    type="button"
                    onClick={onOpenLawModal}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold hover:underline underline-offset-4 whitespace-nowrap shrink-0 ${
                      theme.isDark ? 'text-[#E5C76B]' : 'text-[var(--color-primary)]'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    Consultar base legal Brasil–Chile
                  </button>
                )}
              </div>

              <div className={gridClass}>
                {servicosItens.map((item) => {
                  const fallback = SERVICE_DETAILS_FALLBACK[item.numero];
                  const jurisLabel = item.jurisdicao || fallback?.jurisdicao || 'Legislação Chilena · SERMIG';
                  return (
                    <div
                      key={item.numero}
                      className={`${theme.cardClass} card-radius p-6 sm:p-7 flex ${
                        variante === 'lista-editorial' ? 'flex-col md:flex-row md:items-center' : 'flex-col'
                      } justify-between gap-5`}
                    >
                      <div className="flex-1 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-xs font-bold tracking-wide tabular-nums ${
                              theme.isDark ? 'text-[#E5C76B]' : 'text-[#8F6F16]'
                            }`}
                          >
                            {item.numero} · {jurisLabel}
                          </span>
                        </div>
                        <h3 className={`text-lg font-bold tracking-tight ${theme.headingClass}`}>{item.titulo}</h3>
                        <p className={`text-sm leading-relaxed ${theme.subClass}`}>{item.descricao}</p>
                      </div>
                      <div
                        className={`shrink-0 pt-3 border-t flex items-center justify-between gap-3 ${
                          theme.isDark ? 'border-white/10' : 'border-slate-100'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => !previewMode && setServiceDrawer(item)}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold hover:underline underline-offset-4 ${
                            theme.isDark ? 'text-white' : ''
                          }`}
                          style={!theme.isDark ? { color: 'var(--color-primary)' } : undefined}
                        >
                          Ver escopo, requisitos e prazos
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              {!noImage && (
                <div className={`lg:col-span-5 ${imageRight ? 'lg:order-2' : 'lg:order-1'}`}>
                  <div className="h-72 lg:h-full min-h-[320px] card-radius overflow-hidden border border-slate-200 bg-slate-100">
                    <img
                      src={sec.imagemUrl}
                      alt={sec.titulo}
                      referrerPolicy="no-referrer"
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
                <p className={`text-xs font-semibold mb-2 ${theme.eyebrowClass}`}>
                  {(meta.eyebrow as string) || 'Nossa metodologia'}
                </p>
                <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight text-balance mb-3 ${theme.headingClass}`}>
                  {sec.titulo}
                </h2>
                <p className={`text-base mb-8 ${theme.subClass}`}>{sec.subtitulo}</p>
                <div className="space-y-5">
                  {difItens.map((d, idx) => (
                    <div
                      key={idx}
                      className={`pb-5 border-b ${
                        theme.isDark ? 'border-white/15' : 'border-slate-200'
                      } last:border-b-0 last:pb-0`}
                    >
                      <h3 className={`text-base font-bold mb-1 ${theme.headingClass}`}>{d.titulo}</h3>
                      <p className={`text-sm leading-relaxed ${theme.subClass}`}>{d.descricao}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quadro Bilateral de Transparência Legal (Chile vs. Mercosul vs. Brasil) */}
            <div
              className={`pt-8 border-t ${
                theme.isDark ? 'border-white/15' : 'border-slate-200'
              } space-y-5`}
            >
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold ${theme.eyebrowClass}`}>Marco Legal Bilateral</p>
                  <h3 className={`text-lg font-bold tracking-tight mt-0.5 ${theme.headingClass}`}>
                    Clareza sobre o que é legislação chilena, acordo internacional e legislação brasileira
                  </h3>
                </div>
                {onOpenLawModal && (
                  <button
                    type="button"
                    onClick={onOpenLawModal}
                    className={`inline-flex items-center gap-2 text-xs font-semibold hover:underline underline-offset-4 whitespace-nowrap shrink-0 ${
                      theme.isDark ? 'text-white' : ''
                    }`}
                    style={!theme.isDark ? { color: 'var(--color-primary)' } : undefined}
                  >
                    <BookOpen className="w-4 h-4" />
                    Abrir guia das leis em linguagem clara
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                <div className={`${theme.cardClass} card-radius p-5 space-y-1.5`}>
                  <p className="font-bold text-[var(--color-primary)]">Legislação Chilena</p>
                  <p className={`leading-relaxed ${theme.subClass}`}>
                    Ley Nº 21.325 (Ley de Migración y Extranjería), Decretos Supremos Nº 177/2022 e Nº 296/2022, Ley Nº 19.880 e normativas do SERMIG, PDI e Registro Civil do Chile.
                  </p>
                </div>
                <div className={`${theme.cardClass} card-radius p-5 space-y-1.5`}>
                  <p className="font-bold text-[#9A7618]">Acordo Internacional (Mercosul)</p>
                  <p className={`leading-relaxed ${theme.subClass}`}>
                    Acordo sobre Residência para Nacionais do Mercosul (Decreto chileno Nº 1.497/2009 e promulgação brasileira), fundamento da Subcategoria 15 de reciprocidade.
                  </p>
                </div>
                <div className={`${theme.cardClass} card-radius p-5 space-y-1.5`}>
                  <p className="font-bold text-[#146B43]">Legislação Brasileira</p>
                  <p className={`leading-relaxed ${theme.subClass}`}>
                    LGPD (Lei brasileira nº 13.709/2018) na proteção dos seus dados, Resolução CNJ nº 228/2016 (Apostila de Haia em cartórios brasileiros) e emissão de certidões pela Polícia Federal.
                  </p>
                </div>
              </div>
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
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div className="max-w-2xl">
                {Boolean(meta.eyebrow) && (
                  <p className={`text-xs font-semibold tracking-wide mb-2 ${theme.eyebrowClass}`}>
                    {String(meta.eyebrow)}
                  </p>
                )}
                <h2
                  className={`text-2xl sm:text-[34px] font-bold tracking-tight leading-tight text-balance mb-3 ${theme.headingClass}`}
                >
                  {sec.titulo}
                </h2>
                <p className={`text-base leading-relaxed ${theme.subClass}`}>{sec.subtitulo}</p>
              </div>
              <button
                type="button"
                onClick={() => navigateAction('/diagnostico')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline underline-offset-4 whitespace-nowrap shrink-0"
                style={!theme.isDark ? { color: 'var(--color-primary)' } : { color: '#E5C76B' }}
              >
                Começar pela Etapa 01 agora
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {passos.map((p) => (
                <div key={p.passo} className={`${theme.cardClass} card-radius p-6 sm:p-7 flex flex-col justify-between`}>
                  <div>
                    <div
                      className={`flex items-center justify-between gap-2 mb-4 pb-3 border-b ${
                        theme.isDark ? 'border-white/10' : 'border-slate-100'
                      }`}
                    >
                      <p className="text-2xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--color-accent)' }}>
                        {p.passo}
                      </p>
                      <span className="h-[2px] w-7 bg-slate-200/90" aria-hidden="true" />
                    </div>
                    <h3 className={`text-base font-bold tracking-tight mb-2 ${theme.headingClass}`}>{p.titulo}</h3>
                    <p className={`text-sm leading-relaxed ${theme.subClass}`}>{p.descricao}</p>
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
          <section className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7 space-y-4">
                <p className={`text-xs font-semibold ${theme.eyebrowClass}`}>
                  {(meta.eyebrow as string) || 'Quem Somos'}
                </p>
                <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight text-balance ${theme.headingClass}`}>
                  {sec.titulo}
                </h2>
                <p className={`text-base ${theme.subClass}`}>{sec.subtitulo}</p>
                {sec.conteudoHtml && (
                  <div
                    className={`text-sm leading-relaxed ${theme.isDark ? 'text-slate-200' : 'text-slate-700'}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(sec.conteudoHtml) }}
                  />
                )}
                {Boolean(meta.credenciais) && (
                  <p className={`text-xs pt-2 border-t ${theme.isDark ? 'border-white/15 text-slate-300' : 'border-slate-200 text-slate-500'}`}>
                    {String(meta.credenciais)}
                  </p>
                )}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => navigateAction(sec.ctaDestino || '/quem-somos')}
                    className={`inline-flex items-center gap-2 px-5 py-2.5 btn-radius border text-sm font-semibold transition-colors ${
                      theme.isDark
                        ? 'border-white/30 text-white hover:bg-white/10'
                        : 'border-slate-300 text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {sec.ctaTexto || 'Conheça nossa trajetória e credenciais'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="lg:col-span-5">
                <div className="aspect-[3/4] max-w-sm mx-auto card-radius overflow-hidden border border-slate-200 bg-slate-100 shadow-[0_12px_30px_rgba(11,31,51,0.08)]">
                  {sec.imagemUrl ? (
                    <img
                      src={sec.imagemUrl}
                      alt={sec.titulo}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full ${imgFitClass}`}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {!hasExplicitPartnersSection &&
            renderPartnersGrid(
              {
                titulo: 'Parceiros recomendados',
                subtitulo:
                  'Rede homologada no Brasil e no Chile para apostilamentos, traduções juramentadas e relocation.',
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
                <p className={`text-xs font-semibold mb-2 ${theme.eyebrowClass}`}>{String(meta.eyebrow)}</p>
              )}
              <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight mb-2 ${theme.headingClass}`}>
                {sec.titulo}
              </h2>
              <p className={`text-base ${theme.subClass}`}>{sec.subtitulo}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {authorizedTestimonials.map((dep) => (
                <article key={dep.id} className={`${theme.cardClass} card-radius p-6 space-y-3`}>
                  <Quote className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
                  <p className={`text-sm leading-relaxed ${theme.subClass}`}>&ldquo;{dep.depoimento}&rdquo;</p>
                  <div className="pt-2 border-t border-slate-200/70 text-xs">
                    <p className={`font-bold ${theme.headingClass}`}>{dep.nome}</p>
                    <p className={theme.eyebrowClass}>
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
      const theme = getSectionThemeClasses(meta.temaSecao as string | undefined, 'claro');
      return (
        <section key={sec.id} className={`${sectionPad} ${theme.sectionClass}`} style={theme.sectionStyle}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-3">
              {Boolean(meta.eyebrow) && (
                <p className={`text-xs font-semibold ${theme.eyebrowClass}`}>{String(meta.eyebrow)}</p>
              )}
              <h2 className={`text-2xl sm:text-3xl font-bold tracking-tight text-balance ${theme.headingClass}`}>
                {sec.titulo}
              </h2>
              <p className={`text-sm leading-relaxed ${theme.subClass}`}>{sec.subtitulo}</p>
              {onOpenLawModal && (
                <button
                  type="button"
                  onClick={onOpenLawModal}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold hover:underline underline-offset-4 pt-2"
                  style={!theme.isDark ? { color: 'var(--color-primary)' } : { color: '#E5C76B' }}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Consultar normas chilenas e brasileiras
                </button>
              )}
            </div>

            <div className="lg:col-span-8 divide-y divide-slate-200 border border-slate-200 card-radius bg-[var(--color-surface)] text-slate-900 overflow-hidden">
              {perguntas.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm sm:text-base font-semibold text-slate-900">{item.pergunta}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{item.resposta}</div>
                    )}
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
        <section
          key={sec.id}
          className={`${sectionPad} ${theme.sectionClass} relative overflow-hidden`}
          style={theme.sectionStyle}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6">
            <div className="flex justify-center">
              <BrandLogo
                src={empresa.logoDarkUrl || empresa.logoUrl}
                alt={empresa.nome_empresa}
                variant={theme.isDark ? 'emblem-dark' : 'emblem'}
                className="h-18 w-18 object-contain"
              />
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-3 justify-center">
                <span className="h-[1px] w-8 bg-[#C9A227]/70" aria-hidden="true" />
                <p className="text-xs font-semibold tracking-wide text-[#E5C76B]">
                  {brandShortName} · Próximo passo
                </p>
                <span className="h-[1px] w-8 bg-[#C9A227]/70" aria-hidden="true" />
              </div>
              <h2 className={`text-2xl sm:text-4xl font-bold tracking-tight text-balance ${theme.headingClass}`}>
                {sec.titulo}
              </h2>
              <p className={`text-base sm:text-lg max-w-2xl mx-auto leading-relaxed ${theme.subClass}`}>
                {sec.subtitulo}
              </p>
              {sec.conteudoHtml && <p className="text-xs opacity-80 mt-2">{sec.conteudoHtml}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-1">
              <button
                type="button"
                onClick={() => navigateAction(sec.ctaDestino || '/diagnostico')}
                className="inline-flex items-center gap-2 px-6.5 py-3.5 btn-radius text-sm font-bold text-[#0B1523] shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-all duration-150 hover:opacity-95 hover:-translate-y-0.5"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                {sec.ctaTexto || 'Iniciar Diagnóstico Gratuito'}
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
                Falar pelo WhatsApp
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
                  Agendar consulta
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
                  {Boolean(meta.eyebrow) && <p className={`text-xs font-semibold ${theme.eyebrowClass}`}>{String(meta.eyebrow)}</p>}
                  <h2 className={`text-2xl sm:text-3xl font-bold text-balance ${theme.headingClass}`}>{sec.titulo}</h2>
                  {sec.subtitulo && <p className={`text-base ${theme.subClass}`}>{sec.subtitulo}</p>}
                  {sec.conteudoHtml && (
                    <div
                      className={`text-sm leading-relaxed ${theme.subClass}`}
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(sec.conteudoHtml) }}
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
                        {sec.ctaTexto}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div className={`lg:col-span-5 ${imgLeft ? 'lg:order-1' : 'lg:order-2'}`}>
                  <div className="h-72 sm:h-80 card-radius overflow-hidden border border-slate-200/80 bg-slate-100">
                    <img
                      src={sec.imagemUrl}
                      alt={sec.titulo}
                      referrerPolicy="no-referrer"
                      className={`w-full h-full ${imgFitClass}`}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto text-center space-y-4">
                {Boolean(meta.eyebrow) && <p className={`text-xs font-semibold ${theme.eyebrowClass}`}>{String(meta.eyebrow)}</p>}
                <h2 className={`text-2xl sm:text-3xl font-bold text-balance ${theme.headingClass}`}>{sec.titulo}</h2>
                {sec.subtitulo && <p className={`text-base ${theme.subClass}`}>{sec.subtitulo}</p>}
                {sec.conteudoHtml && (
                  <div
                    className={`text-sm leading-relaxed ${theme.subClass}`}
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(sec.conteudoHtml) }}
                  />
                )}
                {sec.imagemUrl && (
                  <div className="pt-3">
                    <img
                      src={sec.imagemUrl}
                      alt={sec.titulo}
                      referrerPolicy="no-referrer"
                      className={`max-h-80 mx-auto card-radius border border-slate-200 ${imgFitClass}`}
                    />
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
                      {sec.ctaTexto}
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

  return (
    <div>
      {orderedSections.map((sec) => renderSection(sec))}

      {serviceDrawer && !previewMode && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex justify-end" role="dialog" aria-modal="true">
          <div className="bg-white w-full max-w-md h-full p-6 sm:p-8 flex flex-col justify-between overflow-y-auto shadow-2xl">
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#8F6F16] tabular-nums">
                    Serviço {serviceDrawer.numero} ·{' '}
                    {serviceDrawer.jurisdicao ||
                      SERVICE_DETAILS_FALLBACK[serviceDrawer.numero]?.jurisdicao ||
                      'Legislação Chilena · SERMIG'}
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">{serviceDrawer.titulo}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setServiceDrawer(null)}
                  aria-label="Fechar detalhes do serviço"
                  className="p-2 btn-radius text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{serviceDrawer.descricao}</p>
              <div className="space-y-3 text-xs pt-2">
                <div className="p-3.5 card-radius bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-900">Para quem é indicado</p>
                  <p className="text-slate-600 mt-1">
                    {serviceDrawer.paraQuem ||
                      SERVICE_DETAILS_FALLBACK[serviceDrawer.numero]?.paraQuem ||
                      'Avaliado individualmente no diagnóstico.'}
                  </p>
                </div>
                <div className="p-3.5 card-radius bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-900">Enquadramento normativo e documentos típicos</p>
                  <p className="text-slate-600 mt-1">
                    {serviceDrawer.subcategoriaTipica ||
                      SERVICE_DETAILS_FALLBACK[serviceDrawer.numero]?.subcategoriaTipica ||
                      'Conforme legislação chilena vigente (SERMIG).'}
                  </p>
                </div>
                <div className="p-3.5 card-radius bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-900">Faixa referencial de prazos</p>
                  <p className="text-slate-600 mt-1">
                    {serviceDrawer.faixaPrazo ||
                      SERVICE_DETAILS_FALLBACK[serviceDrawer.numero]?.faixaPrazo ||
                      'Definido conforme fila do SERMIG.'}
                  </p>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setServiceDrawer(null);
                  onNavigate('/diagnostico');
                }}
                className="w-full py-2.5 px-4 btn-radius text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Iniciar diagnóstico para este serviço
              </button>
              <a
                href={buildWhatsAppUrl(
                  empresa.whatsapp,
                  `Olá! Gostaria de saber mais sobre o serviço: ${serviceDrawer.titulo}.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 btn-radius border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <MessageCircle className="w-4 h-4 text-[#1E7E34]" />
                Consultar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Re-export type for convenience in PainelAdminConfig
export type { LegalSource };
