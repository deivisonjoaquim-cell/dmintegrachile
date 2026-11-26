import React, { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, MessageCircle, Quote } from 'lucide-react';
import { OfficeOperationsCarousel } from '../components/about/OfficeOperationsCarousel';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { OptimizedImage } from '../components/OptimizedImage';
import { useSeoMetadata } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { mergeAboutTestimonials } from '../utils/aboutShowcase';
import { buildWhatsAppUrl, sanitizeHtml } from '../utils/formatters';

interface QuemSomosPageProps {
  onNavigate: (path: string) => void;
}

export const QuemSomosPage: React.FC<QuemSomosPageProps> = ({ onNavigate }) => {
  const { siteContent, empresa, legalSources } = useApp();
  const { translateText } = useLanguage();
  const [lawModalOpen, setLawModalOpen] = useState(false);

  const quemSomos = siteContent.find((s) => s.secao === 'quem_somos');
  const meta = (quemSomos?.metadados || {}) as Record<string, string>;
  const timeline = empresa.quemSomosMarcoHistorico || [];

  const testimonials = useMemo(
    () => mergeAboutTestimonials(empresa.depoimentosAutorizados, 3),
    [empresa.depoimentosAutorizados],
  );

  const whatsappUrl = buildWhatsAppUrl(
    empresa.whatsapp,
    'Olá! Conheci a história da D&M Integra Chile e gostaria de tirar dúvidas sobre minha mudança para o Chile.',
  );

  useSeoMetadata({
    title: quemSomos?.seoTitulo || `Quem Somos | ${empresa.nome_empresa}`,
    description:
      quemSomos?.seoDescricao ||
      quemSomos?.subtitulo ||
      'Conheça nossa equipe, nossa rotina no escritório e como conduzimos cada mudança do Brasil para o Chile com rigor jurídico e acolhimento.',
    orgName: empresa.nome_empresa,
    email: empresa.email,
    whatsapp: empresa.whatsapp,
  });

  const formacaoLines = (
    meta.formacao ||
    'Bacharel em Direito (Graduação de Nível Superior)\nEspecialista (Pós-graduação Lato Sensu) em Direito Penal e Processo Penal\nSólida base jurídica com foco em legislação, conformidade normativa e análise processual.'
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const experienciaLines = (
    meta.experiencia ||
    'Com base e atendimento próximo no Brasil e rede operacional homologada no Chile, conduzimos trâmites de Residência Temporal, Acordo Mercosul, Reunificação Familiar e Relocation em todo o território chileno.\nCada projeto nasce de uma análise criteriosa de requisitos, preparação documental prévia ao embarque e proteção contra riscos burocráticos ou contratuais.'
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const expertiseItems = [
    {
      number: '01.',
      title: meta.formacaoTitulo || 'Formação Acadêmica e Base Jurídica',
      lines: formacaoLines,
    },
    {
      number: '02.',
      title: meta.experienciaTitulo || 'Especialização em Imigração e Relocation',
      lines: experienciaLines,
    },
    {
      number: '03.',
      title: 'Ética, Previsibilidade e Sigilo (LGPD)',
      lines: [
        meta.missao ||
          'Conduzir cada processo com transparência documental, cumprimento rigoroso de prazos e respeito integral à LGPD (Lei brasileira nº 13.709/2018).',
      ],
    },
    {
      number: '04.',
      title: 'Domínio das Normas Migratórias do Chile',
      lines: [
        meta.credenciais ||
          'Atuação fundamentada na Ley chilena Nº 21.325, no Decreto Nº 177/2022, no Acordo Mercosul e nas diretrizes oficiais do SERMIG e da PDI.',
      ],
    },
  ];

  const responsibleName = meta.responsavel || empresa.responsavel_tecnico || 'Direção Técnica';

  return (
    <div className="bg-[#F7F8FA] dark:bg-[#070B12] text-[#0B1628] dark:text-white">
      {/* 1. Abertura Editorial Humana & Institucional */}
      <section className="bg-white dark:bg-[#0D1422] border-b border-[#E5E7EB] dark:border-[#1E293B] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#60A5FA]">
              Quem Cuida da Sua Mudança · {empresa.nome_empresa}
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#0B1628] dark:text-white leading-[1.07] text-balance">
              {translateText(quemSomos?.titulo) ||
                'Rigor técnico no processo, acolhimento real com a sua família'}
            </h1>
            {quemSomos?.subtitulo && (
              <p className="text-base sm:text-lg text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl">
                {translateText(quemSomos.subtitulo)}
              </p>
            )}
            {quemSomos?.conteudoHtml && (
              <div
                className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(translateText(quemSomos.conteudoHtml)),
                }}
              />
            )}

            {/* Indicadores editoriais sem caixas (zero pills) */}
            <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B] grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl">
              <div className="space-y-1">
                <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                  100% em Português
                </p>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Atendimento direto · sem juridiquês
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                  Ley Nº 21.325
                </p>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  SERMIG · Acordo Mercosul · PDI
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                  Conformidade LGPD
                </p>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Sigilo absoluto dos seus documentos
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('/diagnostico')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Iniciar Diagnóstico Gratuito
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setLawModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-sm font-medium text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#151F32] transition-colors whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA]" aria-hidden="true" />
                Entender as regras do Chile
              </button>
            </div>
          </div>

          {/* Retrato Executivo da Liderança com legenda limpa abaixo */}
          <div className="lg:col-span-5">
            <figure className="max-w-[400px] mx-auto space-y-3.5">
              <div className="aspect-[4/5] rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#151F32]">
                {quemSomos?.imagemUrl ? (
                  <OptimizedImage
                    src={quemSomos.imagemUrl}
                    alt={responsibleName}
                    priority
                    sizes="(max-width: 1024px) 100vw, 400px"
                    className="w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#6B7280] dark:text-slate-400 text-sm">
                    Foto institucional
                  </div>
                )}
              </div>
              <figcaption className="flex items-baseline justify-between gap-4 px-1">
                <div>
                  <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                    {responsibleName}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-slate-400">
                    Direção Técnica · Assessoria Migratória Brasil–Chile
                  </p>
                </div>
                <span className="font-mono text-[11px] text-[#0F3D91] dark:text-[#60A5FA] shrink-0">
                  BR · CL
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* 2. Carrossel Fotográfico Profissional — Operações Diárias no Escritório */}
      <section
        data-testid="quem-somos-office-gallery"
        className="bg-[#F7F8FA] dark:bg-[#070B12] border-b border-[#E5E7EB] dark:border-[#1E293B] py-20 lg:py-28"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <OfficeOperationsCarousel />
        </div>
      </section>

      {/* 3. Expertise da Equipe & Credenciais (Layout Editorial Assimétrico) */}
      <section className="bg-white dark:bg-[#0D1422] border-b border-[#E5E7EB] dark:border-[#1E293B] py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            {/* Coluna de Liderança e Filosofia */}
            <div className="lg:col-span-5 space-y-8">
              <div className="space-y-3">
                <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#60A5FA]">
                  Expertise &amp; Compromisso Humano
                </p>
                <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white leading-[1.12] text-balance">
                  Precisão jurídica para proteger seu projeto. Escuta humana para acolher sua história.
                </h2>
                <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
                  Mudar de país envolve carreira, patrimônio e a tranquilidade de quem você ama. Unimos método documental de escritório corporativo com acompanhamento próximo do Brasil até a entrega das chaves no Chile.
                </p>
              </div>

              <div className="rounded-2xl bg-[#070E1C] text-white p-7 sm:p-8 space-y-6 border border-white/10">
                <div className="space-y-1.5">
                  <p className="font-mono text-[11px] text-[#C9A86A]">01. Segurança Jurídica</p>
                  <p className="text-sm font-semibold text-white">Domínio Real das Regras do Chile</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Pedidos estruturados segundo a Ley Nº 21.325 e o Acordo Mercosul para blindar você contra rejeições e atrasos no SERMIG.
                  </p>
                </div>

                <div className="pt-5 border-t border-white/10 space-y-1.5">
                  <p className="font-mono text-[11px] text-[#C9A86A]">02. Do Brasil ao Arriendo</p>
                  <p className="text-sm font-semibold text-white">Zero Improviso Antes de Embarcar</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Sincronizamos certidões, Apostila de Haia, PDI, RUT e o apoio para moradia sem fiador local para você chegar tranquilo.
                  </p>
                </div>

                <div className="pt-5 border-t border-white/10 space-y-1.5">
                  <p className="font-mono text-[11px] text-[#C9A86A]">03. Acolhimento &amp; Sigilo</p>
                  <p className="text-sm font-semibold text-white">Você Fala com Quem Acompanha Seu Caso</p>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Atendimento humano em português, total clareza de prazos e proteção absoluta dos seus documentos sob a LGPD.
                  </p>
                </div>
              </div>
            </div>

            {/* Coluna de Credenciais Numeradas (Hairlines limpos) */}
            <div className="lg:col-span-7 divide-y divide-[#E5E7EB] dark:divide-[#1E293B] border-t border-b border-[#E5E7EB] dark:border-[#1E293B]">
              {expertiseItems.map((item) => (
                <div key={item.number} className="py-7 sm:py-8 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6">
                  <div className="sm:col-span-2">
                    <span className="font-mono text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                      {item.number}
                    </span>
                  </div>
                  <div className="sm:col-span-10 space-y-2.5">
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#0B1628] dark:text-white tracking-tight">
                      {item.title}
                    </h3>
                    <div className="space-y-2 text-sm sm:text-[15px] text-[#4B5563] dark:text-slate-300 leading-relaxed">
                      {item.lines.map((line, idx) => (
                        <p key={idx}>{line}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {timeline.length > 0 && (
            <div className="mt-20 pt-16 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-10">
              <div className="max-w-xl space-y-2">
                <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#60A5FA]">
                  Nossa Trajetória
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0B1628] dark:text-white">
                  Marcos que consolidaram nosso método
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
                {timeline.map((m, idx) => (
                  <div
                    key={idx}
                    className="pt-6 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-2.5"
                  >
                    <p className="text-lg font-bold font-mono tabular-nums text-[#0F3D91] dark:text-[#60A5FA]">
                      {m.ano}
                    </p>
                    <p className="font-display text-base font-bold text-[#0B1628] dark:text-white">
                      {m.titulo}
                    </p>
                    <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                      {m.descricao}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4. Depoimentos Curtos & Histórias Reais */}
      <section
        data-testid="quem-somos-testimonials"
        className="bg-[#F7F8FA] dark:bg-[#070B12] border-b border-[#E5E7EB] dark:border-[#1E293B] py-20 lg:py-24"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-2.5">
              <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#60A5FA]">
                Histórias Reais · Confiança Construída na Prática
              </p>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white leading-[1.12] text-balance">
                Quem confiou o plano de mudança à nossa equipe
              </h2>
            </div>
            <p className="text-sm text-[#4B5563] dark:text-slate-400 max-w-sm">
              Relatos objetivos de brasileiros que superaram a burocracia migratória e o desafio do primeiro contrato de moradia no Chile.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {testimonials.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] p-7 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <Quote
                    className="w-5 h-5 text-[#B08D57] dark:text-[#C9A86A]"
                    aria-hidden="true"
                  />
                  <p className="text-sm sm:text-[15px] text-[#1F2937] dark:text-slate-200 leading-relaxed">
                    “{item.depoimento}”
                  </p>
                </div>

                <footer className="pt-5 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-1">
                  <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                    {item.nome}
                  </p>
                  <p className="text-xs text-[#4B5563] dark:text-slate-400">
                    {item.origemDestino}
                  </p>
                  <p className="font-mono text-[11px] text-[#0F3D91] dark:text-[#60A5FA]">
                    {item.rotaServico}
                  </p>
                </footer>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Convite Consultivo Final */}
      <section className="bg-[#070E1C] text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-3">
            <p className="font-mono text-xs text-[#C9A86A]">
              Próximo Passo · Atendimento Consultivo
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">
              Pronto para planejar sua mudança ao Chile com clareza e respaldo?
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Faça seu diagnóstico gratuito em 2 minutos ou converse diretamente com nossa equipe pelo WhatsApp para tirar dúvidas sem compromisso.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/diagnostico')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold bg-white text-[#0B1628] hover:bg-slate-200 transition-colors whitespace-nowrap"
            >
              Iniciar Diagnóstico Gratuito
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-white/20 text-sm font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 text-[#C9A86A]" aria-hidden="true" />
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

      <LegalBaseModal
        open={lawModalOpen}
        onClose={() => setLawModalOpen(false)}
        title="Entenda a Legislação — Normas em Linguagem Clara"
        sources={legalSources}
        clientFriendlyOnly
      />
    </div>
  );
};
