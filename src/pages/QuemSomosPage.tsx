import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Expand,
  MessageCircle,
  Scale,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { OptimizedImage } from '../components/OptimizedImage';
import { useSeoMetadata } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { buildWhatsAppUrl, sanitizeHtml } from '../utils/formatters';

interface QuemSomosPageProps {
  onNavigate: (path: string) => void;
}

interface OfficeGalleryPhoto {
  id: string;
  index: string;
  src: string;
  alt: string;
  title: string;
  description: string;
  location: string;
  spanClass: string;
  aspectClass: string;
  objectPositionClass: string;
}

const FOUNDER_EXECUTIVE_PORTRAIT = '/src/assets/images/founder_executive_portrait_1795718964136.jpg';

const OFFICE_GALLERY_PHOTOS: OfficeGalleryPhoto[] = [
  {
    id: 'boardroom',
    index: '01',
    src: '/src/assets/images/founder_advisory_boardroom_1795718965144.jpg',
    alt: 'Responsável técnico apresentando dossiê de planejamento migratório Brasil–Chile em sala executiva',
    title: 'Planejamento estratégico e dossiê sob medida',
    description:
      'Estruturamos cada visto, prazo consular e etapa de mudança antes mesmo do seu embarque, eliminando improvisos.',
    location: 'Enquadramento & Estratégia',
    spanClass: 'lg:col-span-7',
    aspectClass: 'aspect-[4/3] lg:aspect-auto lg:h-[340px]',
    objectPositionClass: 'object-[50%_20%]',
  },
  {
    id: 'client-call',
    index: '02',
    src: '/src/assets/images/founder_office_client_call_1795706903356.jpg',
    alt: 'Reunião individual online com famílias brasileiras planejando residência no Chile',
    title: 'Atendimento consultivo direto em português',
    description:
      'Você conversa diretamente com quem conduz o seu processo — clareza sobre vistos, custos em UF e adaptação familiar.',
    location: 'Reuniões Individuais',
    spanClass: 'lg:col-span-5',
    aspectClass: 'aspect-[4/3] lg:aspect-auto lg:h-[340px]',
    objectPositionClass: 'object-[55%_20%]',
  },
  {
    id: 'document-review',
    index: '03',
    src: '/src/assets/images/founder_office_document_review_1795706904668.jpg',
    alt: 'Auditoria minuciosa de certidões apostiladas, contratos e dossiês migratórios',
    title: 'Auditoria rigorosa de certidões, apostilas e contratos',
    description:
      'Revisamos cada certidão, Apostila de Haia e cláusula de arriendo item por item para blindar você contra golpes e exigências.',
    location: 'Conformidade Documental',
    spanClass: 'lg:col-span-5',
    aspectClass: 'aspect-[4/3] lg:aspect-auto lg:h-[340px]',
    objectPositionClass: 'object-[55%_18%]',
  },
  {
    id: 'sermig-desk',
    index: '04',
    src: '/src/assets/images/founder_office_desk_work_1795706900230.jpg',
    alt: 'Acompanhamento digital contínuo de protocolos e prazos no portal do SERMIG',
    title: 'Gestão ativa de protocolos e prazos no SERMIG',
    description:
      'Acompanhamento contínuo do protocolo até o Estampado Electrónico, registro na PDI e emissão do RUT definitivo.',
    location: 'Portal SERMIG · PDI · RUT',
    spanClass: 'lg:col-span-7',
    aspectClass: 'aspect-[4/3] lg:aspect-auto lg:h-[340px]',
    objectPositionClass: 'object-[55%_18%]',
  },
];

export const QuemSomosPage: React.FC<QuemSomosPageProps> = ({ onNavigate }) => {
  const { siteContent, empresa, legalSources } = useApp();
  const { translateText } = useLanguage();
  const [lawModalOpen, setLawModalOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const quemSomos = siteContent.find((s) => s.secao === 'quem_somos');
  const meta = (quemSomos?.metadados || {}) as Record<string, string>;
  const timeline = empresa.quemSomosMarcoHistorico || [];

  const portraitSrc = quemSomos?.imagemUrl?.trim() || FOUNDER_EXECUTIVE_PORTRAIT;
  const responsavelNome = meta.responsavel || empresa.responsavel_tecnico || 'Diretoria Técnica D&M Integra Chile';
  const waUrl = buildWhatsAppUrl(
    empresa.whatsapp,
    'Olá! Conheci a trajetória da D&M Integra Chile na página Quem Somos e gostaria de tirar dúvidas sobre minha mudança para o Chile.',
  );

  useSeoMetadata({
    title: quemSomos?.seoTitulo || `Quem Somos | ${empresa.nome_empresa}`,
    description:
      quemSomos?.seoDescricao ||
      quemSomos?.subtitulo ||
      'Conheça quem conduz sua mudança ao Chile com rigor jurídico, acolhimento familiar e transparência em cada etapa.',
    orgName: empresa.nome_empresa,
    email: empresa.email,
    whatsapp: empresa.whatsapp,
  });

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxIndex(null);
      } else if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % OFFICE_GALLERY_PHOTOS.length,
        );
      } else if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null
            ? null
            : (prev - 1 + OFFICE_GALLERY_PHOTOS.length) % OFFICE_GALLERY_PHOTOS.length,
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex]);

  const formacaoLines = (
    meta.formacao ||
    'Bacharel em Direito (Graduação de Nível Superior)\nEspecialista (Pós-graduação Lato Sensu) em Direito Penal e Processo Penal\nSólida base jurídica com foco em legislação penal, conformidade normativa e análise processual.'
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const experienciaLines = (
    meta.experiencia ||
    'Com base e atendimento no Brasil, prestamos assessoria completa e fundamentada na legislação migratória vigente para trâmites de Residência Temporal, Acordo Mercosul, Reunificação Familiar e Relocation em qualquer região do Chile.\nAtuação pautada pela análise criteriosa de requisitos, preparação documental prévia à mudança e mitigação de riscos administrativos.'
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const activePhoto = lightboxIndex !== null ? OFFICE_GALLERY_PHOTOS[lightboxIndex] : null;

  return (
    <div className="bg-[#F7F8FA] dark:bg-[#070B12] text-[#0B1628] dark:text-white">
      {/* 1. Editorial Institutional Opening — Executive Narrative + Framed Sunlit Portrait */}
      <section className="relative overflow-hidden bg-white dark:bg-[#0D1422] border-b border-[#E5E7EB] dark:border-[#1E293B] py-16 lg:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-[#F8FAFC] to-transparent dark:from-[#0B1526]/70 dark:to-transparent"
        />

        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
              Quem Cuida da Sua Mudança · {empresa.nome_empresa}
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#0B1628] dark:text-white leading-[1.08] text-balance">
              {translateText(quemSomos?.titulo) || 'Rigor técnico no processo, acolhimento real com a sua família'}
            </h1>
            {quemSomos?.subtitulo && (
              <p className="text-base sm:text-lg text-[#374151] dark:text-slate-200 leading-relaxed max-w-2xl font-medium">
                {translateText(quemSomos.subtitulo)}
              </p>
            )}
            {quemSomos?.conteudoHtml && (
              <div
                className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(translateText(quemSomos.conteudoHtml)) }}
              />
            )}

            {/* Architectural Institutional Proof Line */}
            <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B] grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-2xl">
              <div className="space-y-1">
                <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                  Base Jurídica Sólida
                </p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400 leading-relaxed">
                  Bacharel em Direito com Pós-graduação em Processo e Conformidade
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                  Domínio Brasil–Chile
                </p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400 leading-relaxed">
                  Ley Nº 21.325, SERMIG, PDI, RUT e arriendo em UF sem avalista
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                  Atendimento Direto
                </p>
                <p className="text-xs text-[#4B5563] dark:text-slate-400 leading-relaxed">
                  100% em português, sem intermediários e com sigilo LGPD
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => onNavigate('/diagnostico')}
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold text-white dark:text-[#070E1C] bg-[#0B1628] dark:bg-[#C9A86A] hover:bg-[#132542] dark:hover:bg-[#D8BA80] transition-colors whitespace-nowrap"
              >
                Iniciar Diagnóstico Gratuito
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLawModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-sm font-medium text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#151F32] transition-colors whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#0F3D91] dark:text-[#C9A86A]" />
                Entender as regras do Chile
              </button>
            </div>
          </div>

          {/* Executive Framed Portrait with Subtle Gold Offset & Nameplate */}
          <div className="lg:col-span-5">
            <div className="relative max-w-[400px] mx-auto">
              <div
                aria-hidden="true"
                className="hidden sm:block absolute -inset-y-3 -right-3 left-6 rounded-2xl border border-[#B08D57]/35 dark:border-[#C9A86A]/30 pointer-events-none"
              />
              <figure className="relative rounded-2xl overflow-hidden border border-[#E2E8F0] dark:border-white/10 bg-[#0B1628] shadow-[0_24px_48px_-24px_rgba(11,22,40,0.32)] dark:shadow-[0_24px_56px_-20px_rgba(0,0,0,0.75)]">
                <div className="aspect-[3/4] w-full overflow-hidden">
                  <OptimizedImage
                    src={portraitSrc}
                    alt={`${responsavelNome} — D&M Integra Chile`}
                    priority
                    sizes="(max-width: 1024px) 92vw, 400px"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
                <figcaption className="relative bg-[#070E1C] text-white px-5 py-4 border-t border-[#C9A86A]/35 space-y-1">
                  <p className="font-display text-sm font-bold text-white leading-snug">
                    {responsavelNome}
                  </p>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300">Direito &amp; Mobilidade Brasil–Chile</span>
                    <span className="font-mono text-[11px] font-medium text-[#C9A86A] whitespace-nowrap shrink-0">
                      Ley 21.325
                    </span>
                  </div>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Institutional Governance Strip */}
      <section className="bg-[#070E1C] text-white py-14 lg:py-16 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-3 gap-10 divide-y md:divide-y-0 md:divide-x divide-white/12">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-[#C9A86A]">
              <Scale className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="font-mono text-xs">01. Segurança Jurídica</p>
            </div>
            <h2 className="font-display text-lg font-bold text-white">Domínio Real das Regras do Chile</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Conduzimos cada pedido alinhado à Ley Nº 21.325 e ao Acordo Mercosul para blindar você contra rejeições e atrasos no SERMIG.
            </p>
          </div>
          <div className="pt-8 md:pt-0 md:pl-10 space-y-2.5">
            <div className="flex items-center gap-2 text-[#C9A86A]">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="font-mono text-xs">02. Do Brasil ao Arriendo</p>
            </div>
            <h2 className="font-display text-lg font-bold text-white">Zero Improviso Antes de Embarcar</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Sincronizamos certidões, Apostila de Haia, PDI, RUT e o apoio para moradia sem fiador local para você chegar tranquilo.
            </p>
          </div>
          <div className="pt-8 md:pt-0 md:pl-10 space-y-2.5">
            <div className="flex items-center gap-2 text-[#C9A86A]">
              <Users className="w-4 h-4 shrink-0" aria-hidden="true" />
              <p className="font-mono text-xs">03. Acolhimento &amp; Sigilo</p>
            </div>
            <h2 className="font-display text-lg font-bold text-white">Atendimento Humano em Português</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Você fala direto com quem acompanha o seu caso, com total transparência de prazos e proteção absoluta dos seus documentos (LGPD).
            </p>
          </div>
        </div>
      </section>

      {/* 3. Nosso Escritório e Rotina Técnica — Editorial Asymmetric 4-Photo Bento Showcase */}
      <section
        data-testid="quem-somos-office-gallery"
        className="bg-white dark:bg-[#0D1422] border-b border-[#E5E7EB] dark:border-[#1E293B] py-16 lg:py-24"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 space-y-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
                Na Prática · Bastidores da Sua Assessoria
              </p>
              <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white text-balance leading-[1.12]">
                Cuidado real em cada documento, prazo e decisão da sua mudança
              </h2>
              <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
                Veja como conduzimos cada caso no dia a dia: do planejamento estratégico inicial à revisão minuciosa de certidões apostiladas e monitoramento contínuo no portal do SERMIG.
              </p>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-slate-400 shrink-0">
              Clique em qualquer foto para ampliar os detalhes
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {OFFICE_GALLERY_PHOTOS.map((photo, idx) => (
              <figure
                key={photo.id}
                className={`${photo.spanClass} group flex flex-col bg-[#F8FAFC] dark:bg-[#0A111E] rounded-2xl overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#B08D57]/65 dark:hover:border-[#C9A86A]/55 transition-colors`}
              >
                <button
                  type="button"
                  onClick={() => setLightboxIndex(idx)}
                  aria-label={`Ampliar foto: ${photo.title}`}
                  className={`relative w-full ${photo.aspectClass} overflow-hidden bg-[#0B1628] text-left cursor-zoom-in focus-visible:outline-2 focus-visible:outline-[#0F3D91]`}
                >
                  <OptimizedImage
                    src={photo.src}
                    alt={photo.alt}
                    sizes="(max-width: 1024px) 100vw, 55vw"
                    className={`w-full h-full object-cover ${photo.objectPositionClass} transition-transform duration-500 ease-out group-hover:scale-[1.03]`}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#070E1C]/75 via-[#070E1C]/20 to-transparent"
                  />
                  <div className="pointer-events-none absolute bottom-3.5 inset-x-4 flex items-center justify-between gap-3">
                    <span className="font-mono text-[11px] font-semibold tracking-wider text-white/95">
                      {photo.index}. {photo.location}
                    </span>
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#070E1C]/70 text-white border border-white/20 backdrop-blur-sm opacity-90 group-hover:opacity-100 transition-opacity">
                      <Expand className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </button>

                <figcaption className="p-5 sm:p-6 space-y-1.5 flex-1 flex flex-col justify-center">
                  <h3 className="font-display text-base sm:text-lg font-bold text-[#0B1628] dark:text-white leading-snug">
                    {photo.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                    {photo.description}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Academic & Legal Credentials (Architectural Hairline Grid) */}
      <section className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="max-w-2xl space-y-2.5 mb-12">
            <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
              Formação &amp; Governança Técnica
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white text-balance">
              Credenciais jurídicas que sustentam cada decisão do seu processo
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-[#E5E7EB] dark:border-[#1E293B]">
            <div className="py-8 md:pr-10 md:border-r border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
              <p className="font-mono text-xs font-semibold text-[#B08D57] dark:text-[#C9A86A]">01.</p>
              <h3 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                {meta.formacaoTitulo || 'Formação Acadêmica e Qualificação Jurídica'}
              </h3>
              <div className="space-y-2 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {formacaoLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>

            <div className="py-8 md:pl-10 border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
              <p className="font-mono text-xs font-semibold text-[#B08D57] dark:text-[#C9A86A]">02.</p>
              <h3 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                {meta.experienciaTitulo || 'Especialização e Escopo de Atuação'}
              </h3>
              <div className="space-y-2 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {experienciaLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>

            <div className="py-8 md:pr-10 md:border-r border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
              <p className="font-mono text-xs font-semibold text-[#B08D57] dark:text-[#C9A86A]">03.</p>
              <h3 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                Missão e Ética
              </h3>
              <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {meta.missao ||
                  'Conduzir cada processo com transparência documental, cumprimento rigoroso de prazos e respeito integral à LGPD (Lei brasileira nº 13.709/2018).'}
              </p>
            </div>

            <div className="py-8 md:pl-10 border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
              <p className="font-mono text-xs font-semibold text-[#B08D57] dark:text-[#C9A86A]">04.</p>
              <h3 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                Credenciais e Conformidade
              </h3>
              <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {meta.credenciais ||
                  'Atuação alinhada à Ley chilena Nº 21.325, ao Decreto chileno Nº 177/2022, ao Acordo Mercosul e à LGPD (Lei brasileira nº 13.709/2018).'}
              </p>
            </div>
          </div>

          {timeline.length > 0 && (
            <div className="mt-20 space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#C9A86A]">
                  Trajetória
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1628] dark:text-white">
                  Marcos da Nossa História
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {timeline.map((m, idx) => (
                  <div
                    key={idx}
                    className="pt-6 border-t-2 border-[#0B1628]/15 dark:border-[#C9A86A]/35 space-y-2"
                  >
                    <p className="text-xl font-bold font-mono tabular-nums text-[#0F3D91] dark:text-[#C9A86A]">
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

      {/* 5. Closing Executive Consultation Band */}
      <section className="bg-[#070E1C] text-white py-16 lg:py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#C9A86A]">
              Atendimento Consultivo Brasil–Chile
            </p>
            <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white text-balance leading-[1.12]">
              Converse diretamente com quem vai conduzir a sua mudança ao Chile
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Faça o diagnóstico gratuito em 2 minutos ou tire suas dúvidas sobre visto, RUT e arriendo direto pelo WhatsApp, sem compromisso.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('/diagnostico')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold text-[#070E1C] bg-[#C9A86A] hover:bg-[#D8BA80] transition-colors whitespace-nowrap"
            >
              Iniciar Diagnóstico Gratuito
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-white/25 text-sm font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 text-[#C9A86A]" />
              Falar com um Especialista
            </a>
          </div>
        </div>
      </section>

      {/* Editorial Photo Lightbox Modal */}
      {activePhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={activePhoto.title}
          className="fixed inset-0 z-50 bg-[#050A14]/92 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-[#0B1628] border border-white/15 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-white/10 text-white">
              <p className="font-mono text-xs text-[#C9A86A]">
                {activePhoto.index} / 0{OFFICE_GALLERY_PHOTOS.length} · {activePhoto.location}
              </p>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="Fechar visualização ampliada"
                className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-white/15 text-slate-200 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative bg-[#070E1C] aspect-[16/10] w-full overflow-hidden">
              <OptimizedImage
                src={activePhoto.src}
                alt={activePhoto.alt}
                priority
                sizes="(max-width: 1024px) 100vw, 896px"
                placeholderTone="dark"
                className={`w-full h-full object-cover ${activePhoto.objectPositionClass}`}
              />
              <button
                type="button"
                aria-label="Foto anterior"
                onClick={() =>
                  setLightboxIndex((prev) =>
                    prev === null
                      ? 0
                      : (prev - 1 + OFFICE_GALLERY_PHOTOS.length) % OFFICE_GALLERY_PHOTOS.length,
                  )
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-[#070E1C]/80 border border-white/20 text-white hover:bg-[#070E1C] flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                aria-label="Próxima foto"
                onClick={() =>
                  setLightboxIndex((prev) =>
                    prev === null ? 0 : (prev + 1) % OFFICE_GALLERY_PHOTOS.length,
                  )
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-[#070E1C]/80 border border-white/20 text-white hover:bg-[#070E1C] flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4 bg-[#0B1628] text-white space-y-1">
              <p className="font-display text-base font-bold">{activePhoto.title}</p>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {activePhoto.description}
              </p>
            </div>
          </div>
        </div>
      )}

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
