import React, { useMemo, useState } from 'react';
import {
  ArrowDown,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  Globe2,
  GraduationCap,
  Handshake,
  HeartPulse,
  Languages,
  Landmark,
  MapPin,
  MessageCircle,
  Scale,
  Search,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import { BrandRibbon } from '../components/BrandLogo';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { submitPartnerProposalPublic } from '../services/firestoreService';
import type { CurrencyCode, PartnerCategory, PartnerPublic } from '../types/domain';
import { buildWhatsAppUrl } from '../utils/formatters';
import {
  computePartnerNetworkMetrics,
  filterAndSortPublicPartners,
  formatPhoneByCountry,
  normalizePartnerExternalUrl,
  PARTNER_CATEGORIES,
  translatePartnerCategory,
  translatePartnerCountry,
  type PublicPartnerSort,
} from '../utils/partnerHelpers';

function getCategoryIcon(category: string) {
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

export const ParceirosPage: React.FC = () => {
  const { partnersPublic, empresa } = useApp();
  const { locale } = useLanguage();
  const isEs = locale === 'es-CL';

  const [search, setSearch] = useState('');
  const [filterPais, setFilterPais] = useState<'Todos' | 'Brasil' | 'Chile' | 'Ambos'>('Todos');
  const [filterCat, setFilterCat] = useState('Todas');
  const [sortBy, setSortBy] = useState<PublicPartnerSort>('avaliacao');
  const [selectedPartner, setSelectedPartner] = useState<PartnerPublic | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Formulário Seja um Parceiro
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [categoria, setCategoria] = useState<PartnerCategory>('Tradutor Juramentado');
  const [pais, setPais] = useState<'Brasil' | 'Chile' | 'Ambos'>('Chile');
  const [cidade, setCidade] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [siteOuInstagram, setSiteOuInstagram] = useState('');
  const [moeda, setMoeda] = useState<CurrencyCode>('CLP');
  const [proposta, setProposta] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const metrics = useMemo(() => computePartnerNetworkMetrics(partnersPublic), [partnersPublic]);

  const activeCategories = useMemo(() => {
    const present = new Set(partnersPublic.map((p) => p.categoria));
    return PARTNER_CATEGORIES.filter((c) => present.has(c));
  }, [partnersPublic]);

  const countryCounts = useMemo(() => {
    let brasil = 0;
    let chile = 0;
    let ambos = 0;
    for (const p of partnersPublic) {
      if (p.pais === 'Brasil' || p.pais === 'Ambos') brasil++;
      if (p.pais === 'Chile' || p.pais === 'Ambos') chile++;
      if (p.pais === 'Ambos') ambos++;
    }
    return { todos: partnersPublic.length, brasil, chile, ambos };
  }, [partnersPublic]);

  const filteredPartners = useMemo(
    () =>
      filterAndSortPublicPartners(partnersPublic, {
        search,
        pais: filterPais,
        categoria: filterCat,
        sortBy,
      }),
    [partnersPublic, search, filterPais, filterCat, sortBy],
  );

  const hasActiveFilters = search.trim() !== '' || filterPais !== 'Todos' || filterCat !== 'Todas';

  const resetFilters = () => {
    setSearch('');
    setFilterPais('Todos');
    setFilterCat('Todas');
    setSortBy('avaliacao');
  };

  const buildReferralMessage = (partner: PartnerPublic): string =>
    isEs
      ? `¡Hola! Recibí la recomendación oficial de D&M Integra Chile para contactar a ${partner.nome}. Me gustaría consultar por sus servicios.`
      : `Olá! Recebi a indicação oficial da D&M Integra Chile para falar com ${partner.nome}. Gostaria de solicitar informações sobre atendimento.`;

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2200);
    } catch {
      // Clipboard unavailable in restricted context
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (honeypot.trim() !== '') {
      setFormError(
        isEs
          ? 'Envío bloqueado por validación anti-spam.'
          : 'Envio bloqueado por validação anti-spam.',
      );
      return;
    }
    if (!nomeEmpresa.trim() || !responsavel.trim() || !whatsapp.trim() || !email.includes('@')) {
      setFormError(
        isEs
          ? 'Completa nombre de la empresa, responsable, WhatsApp y un correo corporativo válido.'
          : 'Preencha nome da empresa, responsável, WhatsApp e um e-mail corporativo válido.',
      );
      return;
    }
    if (siteOuInstagram.trim() && !normalizePartnerExternalUrl(siteOuInstagram)) {
      setFormError(
        isEs
          ? 'Ingresa un sitio web válido (https://...) o un usuario de Instagram (@perfil).'
          : 'Informe um site válido (https://...) ou um perfil de Instagram (@usuario).',
      );
      return;
    }

    setSubmitting(true);
    try {
      const normalizedSite = normalizePartnerExternalUrl(siteOuInstagram);
      const composedMessage = [
        mensagem.trim(),
        normalizedSite ? `Site/Instagram: ${normalizedSite}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const id = await submitPartnerProposalPublic({
        nome_empresa: nomeEmpresa.trim(),
        categoria,
        pais,
        cidade: cidade.trim(),
        responsavel: responsavel.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim().toLowerCase(),
        moeda,
        proposta: proposta.trim(),
        mensagem: composedMessage,
        honeypot: '',
      });
      setSubmittedId(id);
      setNomeEmpresa('');
      setCidade('');
      setResponsavel('');
      setWhatsapp('');
      setEmail('');
      setSiteOuInstagram('');
      setProposta('');
      setMensagem('');
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : isEs
            ? 'No fue posible enviar la propuesta en este momento.'
            : 'Erro ao enviar proposta. Tente novamente.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const homologationSteps = isEs
    ? [
        {
          num: '01.',
          title: 'Curaduría Técnica',
          desc: 'Evaluamos experiencia comprobada en clientes brasileños y extranjeros que migran o invierten en Chile.',
        },
        {
          num: '02.',
          title: 'Validación Documental',
          desc: 'Verificamos registros profesionales, plazos de entrega y cumplimiento normativo en ambos países.',
        },
        {
          num: '03.',
          title: 'Condiciones Claras',
          desc: 'Establecemos tiempos de respuesta prioritarios y transparencia total en honorarios antes de recomendar.',
        },
        {
          num: '04.',
          title: 'Seguimiento Continuo',
          desc: 'Monitoreamos la satisfacción de los clientes atendidos y revisamos la homologación periódicamente.',
        },
      ]
    : [
        {
          num: '01.',
          title: 'Curadoria Técnica',
          desc: 'Avaliamos histórico comprovado no atendimento a brasileiros que residem, trabalham ou investem no Chile.',
        },
        {
          num: '02.',
          title: 'Verificação Documental',
          desc: 'Conferimos registros profissionais, validade jurídica dos documentos e aderência às exigências do SERMIG e CNJ.',
        },
        {
          num: '03.',
          title: 'Condições Transparentes',
          desc: 'Alinhamos prazos de entrega, atendimento prioritário e clareza de valores antes da publicação na rede.',
        },
        {
          num: '04.',
          title: 'Monitoramento Contínuo',
          desc: 'Acompanhamos o retorno dos clientes indicados e revisamos periodicamente a avaliação de cada parceiro.',
        },
      ];

  const brandName = empresa.nome_empresa || 'D&M Integra Chile';

  return (
    <div className="bg-[var(--color-bg)]">
      {/* Executive Navy Hero Band */}
      <section className="bg-[#0B1F33] text-white border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
            <div className="lg:col-span-8 space-y-4">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#E5C76B]">
                {isEs ? 'Red homologada · Brasil y Chile' : 'Rede homologada · Brasil & Chile'}
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.12] text-white text-balance max-w-3xl">
                {isEs
                  ? 'Aliados verificados para cada etapa de tu migración y establecimiento en Chile'
                  : 'Parceiros verificados para cada etapa da sua jornada entre Brasil e Chile'}
              </h1>
              <p className="text-base text-slate-300 leading-relaxed max-w-2xl">
                {isEs
                  ? 'Reunimos estudios jurídicos, traductores oficiales, notarías, corredoras y servicios de relocation evaluados por nuestro equipo técnico para reducir riesgos y acelerar tus trámites.'
                  : 'Reunimos tradutores juramentados, cartórios, escritórios jurídicos, imobiliárias e especialistas em relocation avaliados pela nossa diretoria para dar segurança do Brasil à vida no Chile.'}
              </p>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#diretorio-parceiros"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C8A236] hover:bg-[#b5912c] text-[#0B1F33] text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  {isEs ? 'Explorar directorio' : 'Explorar rede homologada'}
                  <ArrowDown className="w-4 h-4" />
                </a>
                <a
                  href="#seja-parceiro"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-white/25 hover:bg-white/10 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  <Handshake className="w-4 h-4 text-[#E5C76B]" />
                  {isEs ? 'Postular como aliado' : 'Quero ser parceiro'}
                </a>
              </div>
            </div>

            {/* Quantified Live Network Summary (computed from real published partners) */}
            <div className="lg:col-span-4 grid grid-cols-2 gap-4 border-t lg:border-t-0 lg:border-l border-white/15 pt-6 lg:pt-0 lg:pl-8">
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
                  {metrics.totalPartners}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {isEs ? 'Aliados homologados activos' : 'Parceiros ativos na rede'}
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-[#E5C76B] font-mono tabular-nums">
                  {metrics.uniqueCategories}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {isEs ? 'Especialidades cubiertas' : 'Especialidades atendidas'}
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
                  {metrics.averageRating > 0 ? `${metrics.averageRating.toFixed(1)}/5` : '—'}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {isEs ? 'Evaluación interna media' : 'Avaliação técnica média'}
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
                  2
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {isEs ? 'Países integrados (BR / CL)' : 'Países integrados (BR / CL)'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16 space-y-16">
        {/* Directory & Interactive Filter Section */}
        <section id="diretorio-parceiros" className="scroll-mt-24 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <p className="brand-kicker mb-1.5">
                {isEs ? 'Directorio verificado' : 'Diretório verificado'}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33]">
                {isEs ? 'Especialistas recomendados por área' : 'Especialistas recomendados por área'}
              </h2>
            </div>
            <p className="text-xs text-[#4A5A6D] tabular-nums">
              {isEs
                ? `Mostrando ${filteredPartners.length} de ${partnersPublic.length} aliado(s)`
                : `Exibindo ${filteredPartners.length} de ${partnersPublic.length} parceiro(s)`}
            </p>
          </div>

          {/* Search + Country Segmented Control + Sort */}
          <div className="bg-white border border-[#E5DFD2] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    isEs
                      ? 'Buscar por nombre, ciudad, comuna o especialidad...'
                      : 'Buscar por nome, cidade, região ou especialidade...'
                  }
                  aria-label={isEs ? 'Buscar aliado' : 'Buscar parceiro'}
                  className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-[#DDD6C7] text-sm text-[#0B1523] bg-white focus:outline-none focus:border-[#0B1F33]"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label={isEs ? 'Limpiar búsqueda' : 'Limpar busca'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Country Segmented Control */}
              <div
                role="group"
                aria-label={isEs ? 'Filtrar por país' : 'Filtrar por país'}
                className="inline-flex items-center p-1 rounded-lg bg-[#F4F1EA] border border-[#E5DFD2] overflow-x-auto"
              >
                {(
                  [
                    { id: 'Todos', label: isEs ? 'Todos' : 'Todos', count: countryCounts.todos },
                    { id: 'Brasil', label: 'Brasil', count: countryCounts.brasil },
                    { id: 'Chile', label: 'Chile', count: countryCounts.chile },
                    ...(countryCounts.ambos > 0
                      ? [{ id: 'Ambos' as const, label: isEs ? 'Binacional' : 'Binacional', count: countryCounts.ambos }]
                      : []),
                  ] as Array<{ id: 'Todos' | 'Brasil' | 'Chile' | 'Ambos'; label: string; count: number }>
                ).map((item) => {
                  const active = filterPais === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setFilterPais(item.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        active
                          ? 'bg-[#0B1F33] text-white'
                          : 'text-[#4A5A6D] hover:text-[#0B1F33]'
                      }`}
                    >
                      {item.label} ({item.count})
                    </button>
                  );
                })}
              </div>

              {/* Sort Control */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as PublicPartnerSort)}
                aria-label={isEs ? 'Ordenar aliados' : 'Ordenar parceiros'}
                className="px-3.5 py-2.5 rounded-lg border border-[#DDD6C7] text-xs font-semibold bg-white text-[#0B1F33] focus:outline-none focus:border-[#0B1F33]"
              >
                <option value="avaliacao">
                  {isEs ? 'Ordenar: Mejor evaluados' : 'Ordenar: Melhor avaliados'}
                </option>
                <option value="nome">
                  {isEs ? 'Ordenar: Alfabético (A–Z)' : 'Ordenar: Alfabético (A–Z)'}
                </option>
                <option value="pais">
                  {isEs ? 'Ordenar: País' : 'Ordenar: País'}
                </option>
              </select>
            </div>

            {/* Interactive Specialty Filter Bar */}
            {activeCategories.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#F1EDE4]">
                <button
                  type="button"
                  onClick={() => setFilterCat('Todas')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    filterCat === 'Todas'
                      ? 'bg-[#0B1F33] text-white'
                      : 'bg-[#F7F5F0] text-[#4A5A6D] hover:text-[#0B1F33] hover:bg-[#EFECE3]'
                  }`}
                >
                  {isEs ? 'Todas las especialidades' : 'Todas as especialidades'}
                </button>
                {activeCategories.map((cat) => {
                  const active = filterCat === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFilterCat(active ? 'Todas' : cat)}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-[#0B1F33] text-white'
                          : 'bg-[#F7F5F0] text-[#4A5A6D] hover:text-[#0B1F33] hover:bg-[#EFECE3]'
                      }`}
                    >
                      {translatePartnerCategory(cat, locale)}
                    </button>
                  );
                })}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="ml-auto text-xs font-semibold text-[#8C6D14] hover:underline whitespace-nowrap shrink-0"
                  >
                    {isEs ? 'Limpiar filtros' : 'Limpar filtros'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Partner Grid */}
          {filteredPartners.length === 0 ? (
            <div className="bg-white border border-[#E5DFD2] rounded-xl p-10 text-center space-y-3">
              <p className="text-base font-semibold text-[#0B1F33]">
                {isEs
                  ? 'No encontramos aliados con estos criterios.'
                  : 'Nenhum parceiro encontrado para os filtros aplicados.'}
              </p>
              <p className="text-sm text-[#4A5A6D] max-w-md mx-auto">
                {isEs
                  ? 'Intenta limpiar los filtros o solicita una recomendación directa a nuestro equipo de consultoría.'
                  : 'Tente limpar os filtros ou solicite uma indicação personalizada diretamente à nossa equipe.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F33] text-white text-xs font-semibold hover:opacity-95"
                >
                  {isEs ? 'Ver todos los aliados' : 'Ver todos os parceiros'}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPartners.map((p) => {
                const Icon = getCategoryIcon(p.categoria);
                const safeExternalUrl = normalizePartnerExternalUrl(p.siteInstagram);
                return (
                  <article
                    key={p.id}
                    className="bg-white border border-[#E5DFD2] hover:border-[#C8A236]/80 rounded-xl p-6 flex flex-col justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-[#F7F5F0] border border-[#E5DFD2] flex items-center justify-center text-[#0B1F33] shrink-0">
                          <Icon className="w-5 h-5 text-[#8C6D14]" />
                        </div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-[#0B1F33] font-mono tabular-nums pt-1">
                          <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                          <span>{Number(p.avaliacao || 5).toFixed(1)}/5</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#4A5A6D] mb-1.5">
                        <span className="font-semibold text-[#8C6D14]">
                          {translatePartnerCategory(p.categoria, locale)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-[#0B1F33]">
                          {translatePartnerCountry(p.pais, locale)}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-[#0B1F33] font-brand-sans leading-snug mb-2">
                        {p.nome}
                      </h3>

                      <p className="text-sm text-[#4A5A6D] leading-relaxed mb-4">
                        {p.descricaoPublica}
                      </p>

                      {p.cidadeRegiao && (
                        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 mb-5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.cidadeRegiao}</span>
                        </p>
                      )}
                    </div>

                    <div className="pt-4 border-t border-[#F1EDE4] flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-3">
                        {p.whatsapp && (
                          <a
                            href={buildWhatsAppUrl(p.whatsapp, buildReferralMessage(p))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#146B43] hover:underline whitespace-nowrap shrink-0"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        )}
                        {safeExternalUrl && (
                          <a
                            href={safeExternalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-[#0B1F33] hover:underline whitespace-nowrap shrink-0"
                          >
                            {isEs ? 'Sitio / IG' : 'Site / IG'}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedPartner(p)}
                        className="text-xs font-semibold text-[#0B1F33] hover:text-[#8C6D14] transition-colors whitespace-nowrap shrink-0"
                      >
                        {isEs ? 'Ver ficha →' : 'Ver detalhes →'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Homologation Protocol — 4-Step Editorial Rhythm */}
        <section className="bg-white border border-[#E5DFD2] rounded-2xl p-6 sm:p-10">
          <div className="max-w-2xl mb-8">
            <p className="brand-kicker mb-1.5">
              {isEs ? 'Criterios de homologación' : 'Critérios de homologação'}
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] text-balance">
              {isEs
                ? 'Cómo seleccionamos cada profesional de nuestra red'
                : 'Como selecionamos cada profissional da nossa rede'}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {homologationSteps.map((step) => (
              <div key={step.num} className="space-y-2 pt-4 border-t border-[#E5DFD2]">
                <p className="text-sm font-mono font-bold text-[#8C6D14] tabular-nums">{step.num}</p>
                <h3 className="text-base font-bold text-[#0B1F33]">{step.title}</h3>
                <p className="text-sm text-[#4A5A6D] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Seja um Parceiro Homologado — Architectural Split Layout */}
        <section
          id="seja-parceiro"
          className="scroll-mt-24 bg-white border border-[#E5DFD2] rounded-2xl overflow-hidden"
        >
          <BrandRibbon className="h-[3px] w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Left Navy Value Column */}
            <div className="lg:col-span-4 bg-[#0B1F33] text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-8">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#E5C76B]">
                  {isEs ? 'Acreditación B2B · Brasil y Chile' : 'Credenciamento B2B · Brasil & Chile'}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {isEs ? 'Sé un Aliado Homologado' : 'Seja um Parceiro Homologado'}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {isEs
                    ? 'Si ofreces servicios jurídicos, traducciones oficiales, notarías, seguros, corretaje inmobiliario o contabilidad en Brasil o Chile, envía tu propuesta a nuestra dirección técnica.'
                    : 'Oferece serviços jurídicos, cartoriais, de tradução juramentada, locação, saúde, contabilidade ou relocation no Brasil ou no Chile? Envie sua proposta para avaliação da nossa diretoria.'}
                </p>

                <div className="pt-4 border-t border-white/15 space-y-3 text-xs text-slate-200">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#E5C76B] shrink-0 mt-0.5" />
                    <span>
                      {isEs
                        ? 'Indicación calificada a clientes en proceso activo de migración y relocation.'
                        : 'Indicação qualificada para clientes em processo ativo de visto e relocation.'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Globe2 className="w-4 h-4 text-[#E5C76B] shrink-0 mt-0.5" />
                    <span>
                      {isEs
                        ? 'Presencia oficial en nuestro directorio público y portal de clientes.'
                        : 'Presença oficial em nossa vitrine pública e nas orientações do Portal do Cliente.'}
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Handshake className="w-4 h-4 text-[#E5C76B] shrink-0 mt-0.5" />
                    <span>
                      {isEs
                        ? 'Condiciones comerciales confidenciales gestionadas en ambiente privado.'
                        : 'Condições comerciais e acordos de comissão mantidos em sigilo interno.'}
                    </span>
                  </div>
                </div>
              </div>

              {empresa.whatsapp && (
                <div className="pt-5 border-t border-white/15 space-y-2">
                  <p className="text-xs text-slate-300">
                    {isEs ? '¿Prefieres conversar antes de postular?' : 'Prefere conversar antes de enviar?'}
                  </p>
                  <a
                    href={buildWhatsAppUrl(
                      empresa.whatsapp,
                      isEs
                        ? `Hola equipo de ${brandName}, me interesa presentar una propuesta de alianza institucional.`
                        : `Olá equipe ${brandName}, tenho interesse em apresentar uma proposta de parceria institucional.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-semibold text-[#E5C76B] hover:underline"
                  >
                    <MessageCircle className="w-4 h-4" />
                    {isEs ? 'Hablar con alianzas por WhatsApp' : 'Falar com área de parcerias no WhatsApp'}
                  </a>
                </div>
              )}
            </div>

            {/* Right Clean Form Column */}
            <div className="lg:col-span-8 p-6 sm:p-8 lg:p-10">
              {submittedId && (
                <div className="mb-6 p-4 sm:p-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#146B43] shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-bold">
                        {isEs ? 'Propuesta recibida con éxito' : 'Proposta recebida com sucesso'}
                      </p>
                      <p className="text-xs text-emerald-900 mt-1">
                        {isEs
                          ? 'Protocolo de registro:'
                          : 'Protocolo de registro:'}{' '}
                        <span className="font-mono font-semibold">{submittedId}</span>.{' '}
                        {isEs
                          ? 'Nuestro equipo revisará los antecedentes y se pondrá en contacto.'
                          : 'Nossa diretoria analisará os dados e retornará em breve.'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleCopyText(submittedId, 'protocolo')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-semibold text-emerald-900 hover:bg-emerald-100/50 whitespace-nowrap shrink-0 self-start sm:self-center"
                  >
                    {copiedId === 'protocolo' ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        {isEs ? 'Copiado' : 'Copiado'}
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        {isEs ? 'Copiar protocolo' : 'Copiar protocolo'}
                      </>
                    )}
                  </button>
                </div>
              )}

              {formError && (
                <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-[#C82333] text-sm font-medium">
                  {formError}
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                {/* Honeypot anti-spam oculto */}
                <div className="hidden" aria-hidden="true">
                  <label htmlFor="partner-honeypot">Não preencher</label>
                  <input
                    id="partner-honeypot"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-empresa">
                    {isEs ? 'Nombre de empresa o profesional *' : 'Nome da empresa ou profissional *'}
                  </label>
                  <input
                    id="p-empresa"
                    required
                    value={nomeEmpresa}
                    onChange={(e) => setNomeEmpresa(e.target.value)}
                    placeholder={isEs ? 'Ej.: Estudio Jurídico Andes' : 'Ex.: Andes Traduções Juramentadas'}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-cat">
                    {isEs ? 'Especialidad *' : 'Categoria *'}
                  </label>
                  <select
                    id="p-cat"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value as PartnerCategory)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  >
                    {PARTNER_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {translatePartnerCategory(c, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-pais">
                    {isEs ? 'País de operación *' : 'País de atuação *'}
                  </label>
                  <select
                    id="p-pais"
                    value={pais}
                    onChange={(e) => {
                      const nextPais = e.target.value as 'Brasil' | 'Chile' | 'Ambos';
                      setPais(nextPais);
                      if (nextPais === 'Brasil') setMoeda('BRL');
                      else if (nextPais === 'Chile') setMoeda('CLP');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm bg-white text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  >
                    <option value="Brasil">Brasil</option>
                    <option value="Chile">Chile</option>
                    <option value="Ambos">{isEs ? 'Brasil y Chile' : 'Brasil & Chile'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-cidade">
                    {isEs ? 'Ciudad / Región' : 'Cidade / Região'}
                  </label>
                  <input
                    id="p-cidade"
                    value={cidade}
                    onChange={(e) => setCidade(e.target.value)}
                    placeholder={isEs ? 'Ej.: Santiago (Providencia) / Online' : 'Ex.: São Paulo - SP / Santiago'}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-resp">
                    {isEs ? 'Nombre del responsable *' : 'Nome do responsável *'}
                  </label>
                  <input
                    id="p-resp"
                    required
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-whats">
                    WhatsApp *
                  </label>
                  <input
                    id="p-whats"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatPhoneByCountry(e.target.value, pais))}
                    placeholder={pais === 'Chile' ? '+56 9 8888 0000' : '+55 (11) 99999-0000'}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm tabular-nums text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-email">
                    {isEs ? 'Correo corporativo *' : 'E-mail corporativo *'}
                  </label>
                  <input
                    id="p-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@empresa.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-moeda">
                      {isEs ? 'Moneda' : 'Moeda'}
                    </label>
                    <select
                      id="p-moeda"
                      value={moeda}
                      onChange={(e) => setMoeda(e.target.value as CurrencyCode)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                    >
                      <option value="BRL">BRL (R$)</option>
                      <option value="CLP">CLP ($)</option>
                      <option value="USD">USD (US$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-site">
                      {isEs ? 'Sitio o Instagram' : 'Site ou Instagram'}
                    </label>
                    <input
                      id="p-site"
                      value={siteOuInstagram}
                      onChange={(e) => setSiteOuInstagram(e.target.value)}
                      placeholder="@perfil ou https://..."
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-prop">
                    {isEs
                      ? 'Propuesta comercial, plazos y beneficios para clientes'
                      : 'Proposta de valores, prazos e benefícios para clientes'}
                  </label>
                  <textarea
                    id="p-prop"
                    rows={3}
                    value={proposta}
                    onChange={(e) => setProposta(e.target.value)}
                    placeholder={
                      isEs
                        ? 'Describe tarifas referenciales, tiempos de entrega y condiciones especiales para clientes derivados...'
                        : 'Descreva prazos de entrega, tabela referencial e condições especiais para clientes indicados...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="p-msg">
                    {isEs
                      ? 'Presentación institucional y diferenciales'
                      : 'Apresentação institucional e diferenciais'}
                  </label>
                  <textarea
                    id="p-msg"
                    rows={2}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    placeholder={
                      isEs
                        ? 'Experiencia con brasileños en Chile, certificaciones, idiomas de atención...'
                        : 'Experiência com brasileiros no Chile, registros profissionais, atendimento em português...'
                    }
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-[#0B1523] focus:outline-none focus:border-[#0B1F33]"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-slate-500">
                    {isEs
                      ? 'Tus datos comerciales se revisan de forma confidencial.'
                      : 'Seus valores e condições comerciais são analisados em sigilo.'}
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {submitting
                      ? isEs
                        ? 'Enviando propuesta...'
                        : 'Enviando proposta...'
                      : isEs
                        ? 'Enviar propuesta de alianza'
                        : 'Enviar proposta de parceria'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>

      {/* Partner Details Modal */}
      {selectedPartner && (() => {
        const Icon = getCategoryIcon(selectedPartner.categoria);
        const safeExternal = normalizePartnerExternalUrl(selectedPartner.siteInstagram);
        const referralText = buildReferralMessage(selectedPartner);

        return (
          <div
            className="fixed inset-0 z-50 bg-[#0B1F33]/65 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="partner-detail-title"
            onClick={() => setSelectedPartner(null)}
          >
            <div
              className="bg-white border border-[#E5DFD2] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-[#0B1F33] text-white px-6 py-5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-5 h-5 text-[#E5C76B]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-[#E5C76B] font-semibold">
                      {translatePartnerCategory(selectedPartner.categoria, locale)} ·{' '}
                      {translatePartnerCountry(selectedPartner.pais, locale)}
                    </p>
                    <h2 id="partner-detail-title" className="text-xl font-bold text-white leading-snug mt-0.5">
                      {selectedPartner.nome}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPartner(null)}
                  aria-label={isEs ? 'Cerrar' : 'Fechar'}
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#4A5A6D] pb-4 border-b border-[#F1EDE4]">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#8C6D14]" />
                    {selectedPartner.cidadeRegiao || translatePartnerCountry(selectedPartner.pais, locale)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#0B1F33] font-mono tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                    {Number(selectedPartner.avaliacao || 5).toFixed(1)}/5 ·{' '}
                    {isEs ? 'Homologado' : 'Homologado'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-[#0B1F33]">
                    {isEs ? 'Sobre el aliado' : 'Sobre o parceiro'}
                  </p>
                  <p className="text-sm text-[#4A5A6D] leading-relaxed">
                    {selectedPartner.descricaoPublica}
                  </p>
                </div>

                <div className="rounded-xl bg-[#F7F5F0] border border-[#E5DFD2] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#0B1F33]">
                      {isEs ? 'Mensaje sugerido de presentación' : 'Mensagem sugerida de indicação'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCopyText(referralText, selectedPartner.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C6D14] hover:underline whitespace-nowrap shrink-0"
                    >
                      {copiedId === selectedPartner.id ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          {isEs ? 'Copiado' : 'Copiado'}
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          {isEs ? 'Copiar' : 'Copiar'}
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-[#4A5A6D] leading-relaxed">{referralText}</p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                  {safeExternal && (
                    <a
                      href={safeExternal}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                    >
                      {isEs ? 'Visitar sitio / Instagram' : 'Visitar site / Instagram'}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {selectedPartner.whatsapp && (
                    <a
                      href={buildWhatsAppUrl(selectedPartner.whatsapp, referralText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#146B43] hover:bg-[#115a38] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {isEs ? 'Contactar por WhatsApp' : 'Falar pelo WhatsApp'}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
