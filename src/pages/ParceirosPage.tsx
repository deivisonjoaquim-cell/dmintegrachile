import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileCheck2,
  GraduationCap,
  Handshake,
  Heart,
  HeartPulse,
  Languages,
  Landmark,
  Loader2,
  MapPin,
  MessageCircle,
  Scale,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { ClientTestimonialsCarousel } from '../components/ClientTestimonialsCarousel';
import { OptimizedImage } from '../components/OptimizedImage';
import { PartnerGeolocationMap } from '../components/PartnerGeolocationMap';
import {
  PartnerSynergyAnalyzer,
  type PartnerSynergyResult,
} from '../components/PartnerSynergyAnalyzer';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useFavoritePartners } from '../hooks/useFavoritePartners';
import { submitPartnerProposalPublic } from '../services/firestoreService';
import type { CurrencyCode, PartnerCategory, PartnerPublic } from '../types/domain';
import { buildWhatsAppUrl } from '../utils/formatters';
import { processImportedImageFile } from '../utils/mediaImport';
import {
  computePartnerNetworkMetrics,
  filterAndSortPublicPartners,
  formatPhoneByCountry,
  matchesPartnerMacroGroup,
  normalizePartnerExternalUrl,
  PARTNER_CATEGORIES,
  PARTNER_MACRO_GROUPS,
  sanitizePartnerImageUrl,
  translatePartnerCategory,
  translatePartnerCountry,
  validatePartnerProposalInput,
  type PartnerMacroGroupId,
  type PublicPartnerSort,
} from '../utils/partnerHelpers';

const HERO_PARTNERS_IMAGE = '/src/assets/images/partners_executive_santiago_1795383896419.jpg';

type PartnersWorkspaceTab = 'diretorio' | 'sinergia' | 'seja_parceiro';

interface DemandAreaConfig {
  category: PartnerCategory;
  defaultPais: 'Brasil' | 'Chile' | 'Ambos';
  defaultMoeda: CurrencyCode;
  demandPt: string;
  demandEs: string;
  stagePt: string;
  stageEs: string;
}

const HIGH_DEMAND_AREAS: DemandAreaConfig[] = [
  {
    category: 'Tradutor Juramentado',
    defaultPais: 'Brasil',
    defaultMoeda: 'BRL',
    demandPt: 'Traduções aceitas de primeira pelo SERMIG, evitando gastos em dobro ou documentos recusados.',
    demandEs: 'Certificados civiles, diplomas y antecedentes requeridos antes de solicitar visa.',
    stagePt: 'Pré-embarque · Brasil',
    stageEs: 'Pre-embarque · Brasil',
  },
  {
    category: 'Cartório / Apostilamento',
    defaultPais: 'Brasil',
    defaultMoeda: 'BRL',
    demandPt: 'Certidões atualizadas e Apostila de Haia no prazo certo para nada vencer antes do protocolo.',
    demandEs: 'Emisión de actas actualizadas y Apostilla de La Haya con despacho ágil.',
    stagePt: 'Documentação · CNJ',
    stageEs: 'Documentación · Haya',
  },
  {
    category: 'Imobiliária',
    defaultPais: 'Chile',
    defaultMoeda: 'CLP',
    demandPt: 'Corretores e imobiliárias independentes indicados para auxiliar na busca de imóveis e leitura contratual no Chile.',
    demandEs: 'Corredoras inmobiliarias independientes recomendadas para búsqueda de vivienda y revisión contractual en Chile.',
    stagePt: 'Imóveis · Indicação',
    stageEs: 'Vivienda · Derivación',
  },
  {
    category: 'Contabilidade / Abertura Empresa',
    defaultPais: 'Chile',
    defaultMoeda: 'CLP',
    demandPt: 'Abertura de empresa (SpA), RUT empresarial e tributação clara no SII sem dor de cabeça fiscal.',
    demandEs: 'Constitución de SpA, RUT empresarial, inicio de actividades SII y tributación.',
    stagePt: 'Negócios · SII',
    stageEs: 'Negocios · SII',
  },
  {
    category: 'Escritório de Advocacia',
    defaultPais: 'Ambos',
    defaultMoeda: 'USD',
    demandPt: 'Proteção jurídica em contratos internacionais, estrutura societária e planejamento patrimonial.',
    demandEs: 'Estructuración societaria, contratos internacionales y planificación patrimonial.',
    stagePt: 'Jurídico · Binacional',
    stageEs: 'Legal · Binacional',
  },
  {
    category: 'Seguradora / Saúde',
    defaultPais: 'Ambos',
    defaultMoeda: 'CLP',
    demandPt: 'Seguro viagem, planos Isapre e proteção residencial para você e sua família chegarem amparados.',
    demandEs: 'Seguro de viaje obligatorio, planes Isapre, seguros de hogar y protección familiar.',
    stagePt: 'Proteção · Saúde',
    stageEs: 'Protección · Salud',
  },
  {
    category: 'Escola / Universidade',
    defaultPais: 'Chile',
    defaultMoeda: 'CLP',
    demandPt: 'Acolhimento escolar bilíngue para seus filhos, cursos de espanhol e instituições reconhecidas.',
    demandEs: 'Matrícula bilingüe para hijos, cursos de español y programas de posgrado.',
    stagePt: 'Educação · Família',
    stageEs: 'Educación · Familia',
  },
  {
    category: 'Despachante',
    defaultPais: 'Ambos',
    defaultMoeda: 'CLP',
    demandPt: 'Apoio presencial seguro para pet relocation, trâmites locais e logística documental sem estresse.',
    demandEs: 'Trámites veiculares, gestiones presenciales, traslado de mascotas y logística.',
    stagePt: 'Apoio Local · Chile',
    stageEs: 'Operativo · Relocation',
  },
];

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
  const { partnersPublic, empresa, siteContent } = useApp();
  const { locale } = useLanguage();
  const isEs = locale === 'es-CL';
  const parceirosSection = siteContent.find((s) => s.secao === 'parceiros');
  const heroPartnersImg = parceirosSection?.imagemUrl?.trim() || HERO_PARTNERS_IMAGE;

  const [activeTab, setActiveTab] = useState<PartnersWorkspaceTab>('diretorio');
  const [search, setSearch] = useState('');
  const [filterPais, setFilterPais] = useState<'Todos' | 'Brasil' | 'Chile' | 'Ambos'>('Todos');
  const [filterCat, setFilterCat] = useState('Todas');
  const [filterMacroGroup, setFilterMacroGroup] = useState<PartnerMacroGroupId>('Todos');
  const [sortBy, setSortBy] = useState<PublicPartnerSort>('avaliacao');
  const [selectedPartner, setSelectedPartner] = useState<PartnerPublic | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [synergyResult, setSynergyResult] = useState<PartnerSynergyResult | null>(null);
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const { favoriteIds, isFavorite, toggleFavorite, removeFavorite, clearFavorites } = useFavoritePartners();

  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [categoria, setCategoria] = useState<PartnerCategory>('Tradutor Juramentado');
  const [pais, setPais] = useState<'Brasil' | 'Chile' | 'Ambos'>('Chile');
  const [cidade, setCidade] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [siteOuInstagram, setSiteOuInstagram] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const companyInputRef = useRef<HTMLInputElement | null>(null);
  const [moeda, setMoeda] = useState<CurrencyCode>('CLP');
  const [proposta, setProposta] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [prefilledNotice, setPrefilledNotice] = useState<PartnerCategory | null>(null);

  const scrollToSection = (sectionId: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  useEffect(() => {
    if (!selectedPartner) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedPartner(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPartner]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const secao = params.get('secao');
    const macroParam = params.get('macro');
    if (macroParam && PARTNER_MACRO_GROUPS.some((g) => g.id === macroParam)) {
      setFilterMacroGroup(macroParam as PartnerMacroGroupId);
      setActiveTab('diretorio');
    }
    if (secao === 'seja-parceiro') {
      setActiveTab('seja_parceiro');
      const timer = window.setTimeout(() => {
        const el = document.getElementById('seja-parceiro-form');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 180);
      return () => window.clearTimeout(timer);
    }
    if (secao === 'mapa' || window.location.hash === '#mapa-parceiros') {
      setActiveTab('diretorio');
      const timer = window.setTimeout(() => {
        const el = document.getElementById('mapa-parceiros');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 180);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  const metrics = useMemo(() => computePartnerNetworkMetrics(partnersPublic), [partnersPublic]);

  const macroGroupCounts = useMemo(() => {
    const counts = new Map<PartnerMacroGroupId, number>();
    for (const group of PARTNER_MACRO_GROUPS) {
      counts.set(
        group.id,
        group.id === 'Todos'
          ? partnersPublic.length
          : partnersPublic.filter((p) => matchesPartnerMacroGroup(p.categoria, group.id)).length,
      );
    }
    return counts;
  }, [partnersPublic]);

  const savedPartners = useMemo(() => {
    if (favoriteIds.length === 0) return [];
    const byId = new Map(partnersPublic.map((p) => [p.id, p]));
    return favoriteIds
      .map((id) => byId.get(id))
      .filter((partner): partner is PartnerPublic => Boolean(partner));
  }, [favoriteIds, partnersPublic]);

  const synergyByPartnerId = useMemo(() => {
    const map = new Map<string, { score: number; prioridade: string }>();
    if (!synergyResult) return map;
    for (const rec of synergyResult.recomendacoes) {
      map.set(rec.partnerId, { score: rec.scoreSinergia, prioridade: rec.prioridade });
    }
    return map;
  }, [synergyResult]);

  const activeCategories = useMemo(() => {
    const present = new Set(partnersPublic.map((p) => p.categoria));
    return PARTNER_CATEGORIES.filter((c) => present.has(c));
  }, [partnersPublic]);

  const filteredPartners = useMemo(
    () =>
      filterAndSortPublicPartners(partnersPublic, {
        search,
        pais: filterPais,
        categoria: filterCat,
        macroGroup: filterMacroGroup,
        sortBy,
      }),
    [partnersPublic, search, filterPais, filterCat, filterMacroGroup, sortBy],
  );

  const hasActiveFilters =
    search.trim() !== '' || filterPais !== 'Todos' || filterCat !== 'Todas' || filterMacroGroup !== 'Todos';

  const resetFilters = () => {
    setSearch('');
    setFilterPais('Todos');
    setFilterCat('Todas');
    setFilterMacroGroup('Todos');
    setSortBy('avaliacao');
  };

  const handleApplyForArea = (area: DemandAreaConfig) => {
    setCategoria(area.category);
    setPais(area.defaultPais);
    setMoeda(area.defaultMoeda);
    setPrefilledNotice(area.category);
    setFormError(null);
    setActiveTab('seja_parceiro');
    scrollToSection('seja-parceiro-form');
    window.setTimeout(() => {
      companyInputRef.current?.focus({ preventScroll: true });
    }, 350);
  };

  const buildReferralMessage = (partner: PartnerPublic): string =>
    isEs
      ? `¡Hola! Recibí la recomendación oficial de D&M Integra Chile para contactar a ${partner.nome}. Me gustaría consultar por sus servicios.`
      : `Olá! Recebi a indicação oficial da D&M Integra Chile para falar com ${partner.nome}. Gostaria de solicitar informações sobre atendimento.`;

  const handleCopyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2200);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleProposalLogoFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setLogoUploadError(null);
    setUploadingLogo(true);
    try {
      const processed = await processImportedImageFile(file, 'logo');
      if (processed.url.length > 295000) {
        setLogoUploadError(
          isEs
            ? 'La imagen es demasiado grande. Intenta con un logo más ligero (menor a 300 KB).'
            : 'A imagem ficou acima do limite permitido. Envie um arquivo mais leve (PNG, JPG ou WebP).',
        );
      } else {
        setLogoUrl(processed.url);
      }
    } catch (err) {
      setLogoUploadError(
        err instanceof Error
          ? err.message
          : isEs
            ? 'No fue posible procesar la imagen seleccionada.'
            : 'Não foi possível processar a imagem selecionada.',
      );
    } finally {
      setUploadingLogo(false);
      if (logoFileInputRef.current) logoFileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validatePartnerProposalInput({
      nomeEmpresa,
      responsavel,
      whatsapp,
      email,
      siteOuInstagram,
      logoUrl,
      honeypot,
      locale,
    });

    if (!validation.ok) {
      setFormError(validation.error);
      return;
    }

    setSubmitting(true);
    try {
      const composedMessage = [
        mensagem.trim(),
        validation.normalizedSite ? `Site/Instagram: ${validation.normalizedSite}` : '',
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
        logoUrl: validation.sanitizedLogo || '',
        honeypot: '',
      });
      setSubmittedId(id);
      setPrefilledNotice(null);
      setNomeEmpresa('');
      setCidade('');
      setResponsavel('');
      setWhatsapp('');
      setEmail('');
      setSiteOuInstagram('');
      setLogoUrl('');
      setLogoUploadError(null);
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

  const onboardingSteps = isEs
    ? [
        { num: '01.', title: 'Postulación en 2 minutos', desc: 'Envía los datos de tu empresa, especialidad, logo oficial y propuesta confidencial.' },
        { num: '02.', title: 'Curaduría en hasta 48h', desc: 'Validamos trayectoria, registros profesionales y calidad de atención.' },
        { num: '03.', title: 'Alineación comercial', desc: 'Definimos beneficios y acuerdos en BRL, CLP o USD bajo total reserva.' },
        { num: '04.', title: 'Vitrina oficial', desc: 'Tu marca se publica en el directorio y recibe derivaciones calificadas.' },
      ]
    : [
        { num: '01.', title: 'Cadastro em 2 minutos', desc: 'Envie os dados da empresa, especialidade, logo oficial e condições em sigilo.' },
        { num: '02.', title: 'Curadoria em até 48h', desc: 'Validamos histórico, registros profissionais e padrão de atendimento Brasil–Chile.' },
        { num: '03.', title: 'Alinhamento comercial', desc: 'Definimos prazos prioritários e condições em BRL, CLP ou USD em sigilo.' },
        { num: '04.', title: 'Vitrine oficial', desc: 'Sua marca entra no diretório homologado e recebe indicações qualificadas.' },
      ];

  const partnerFaqs = isEs
    ? [
        { q: '¿Tiene algún costo mensual formar parte de la red?', a: 'No. La postulación y permanencia en la red homologada de D&M Integra Chile no tiene cuota mensual.' },
        { q: '¿Mis tarifas o comisiones se publican en el sitio?', a: 'Nunca. Toda condición financiera permanece estrictamente confidencial en nuestro panel privado.' },
        { q: '¿Puedo postular si atiendo 100% online?', a: 'Sí. Servicios como traducción juramentada, apostilla, contabilidad o asesoría jurídica operan de forma remota en ambos países.' },
      ]
    : [
        { q: 'Existe alguma mensalidade para integrar a rede homologada?', a: 'Não. O credenciamento e a permanência na vitrine oficial da D&M Integra Chile não possuem mensalidade fixa.' },
        { q: 'Meus valores ou acordos comerciais ficam públicos?', a: 'Jamais. Todas as condições comerciais ficam protegidas em ambiente administrativo sigiloso; apenas sua marca e canais oficiais vão à vitrine.' },
        { q: 'Empresas com atendimento 100% online podem participar?', a: 'Sim. Tradução juramentada, cartório, contabilidade, advocacia e seguros operam perfeitamente em modelo remoto ou híbrido.' },
      ];

  const safeFormLogoPreview = sanitizePartnerImageUrl(logoUrl);

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg-[#F7F8FA] dark:bg-[#070B12] text-[#0B1628] dark:text-white">
        {/* 1. Executive Hero */}
        <section className="relative overflow-hidden bg-[#070E1C] text-white">
          <div className="absolute inset-0 pointer-events-none select-none">
            <OptimizedImage
              src={heroPartnersImg}
              alt={isEs ? 'Ecosistema corporativo en Santiago' : 'Ecossistema corporativo em Santiago'}
              priority
              placeholderTone="dark"
              sizes="100vw"
              containerClassName="w-full h-full"
              className="w-full h-full object-cover opacity-35"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-[#060C18]/96 via-[#060C18]/86 to-[#060C18]/60"
            />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 pt-16 pb-14 lg:pt-24 lg:pb-16 space-y-12">
            <div className="max-w-3xl space-y-5">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-px w-8 bg-[#C9A86A]" />
                <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#C9A86A]">
                  {isEs ? 'Red de Aliados Indicados · Brasil y Chile' : 'Rede de Profissionais Indicados · Brasil & Chile'}
                </p>
              </div>
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight leading-[1.08] text-white text-balance">
                {isEs
                  ? 'Especialistas independientes recomendados para complementar tu proceso en Chile'
                  : 'Profissionais parceiros indicados para o que vai além do seu visto, PDI e RUT'}
              </h1>
              <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
                {isEs
                  ? 'Nuestra consultoría conduce tu regularización migratoria hasta Visa, PDI y RUT. Para vivienda, traducciones juradas, notarías, contabilidad, asesoría legal y salud, recomendamos aliados independientes verificados.'
                  : 'A D&M conduz diretamente sua regularização migratória até Vistos (SERMIG), PDI e RUT. Para imóveis, traduções juramentadas, cartórios, contabilidade, advocacia e saúde, indicamos profissionais independentes avaliados.'}
              </p>
              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('diretorio');
                    scrollToSection('diretorio-parceiros');
                  }}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#E5C77B] hover:bg-[#F0D692] text-[#070E1C] text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  {isEs ? 'Explorar directorio de aliados' : 'Explorar parceiros indicados'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('diretorio');
                    scrollToSection('mapa-parceiros');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-white/25 bg-white/[0.04] text-white hover:bg-white/10 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  <MapPin className="w-4 h-4 text-[#E5C77B]" />
                  {isEs ? 'Ver mapa en Chile' : 'Ver no mapa do Chile'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('seja_parceiro');
                    scrollToSection('seja-parceiro-form');
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-white/15 text-slate-200 hover:text-white hover:border-white/35 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {isEs ? 'Quiero ser aliado B2B' : 'Quero ser parceiro'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 pt-8 border-t border-white/15">
              <div>
                <p className="font-mono text-2xl sm:text-3xl font-semibold text-white tabular-nums">
                  {metrics.totalPartners > 0 ? metrics.totalPartners : isEs ? 'Curaduría' : 'Sob Demanda'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {metrics.totalPartners > 0
                    ? isEs
                      ? 'Aliados homologados activos'
                      : 'Parceiros homologados ativos'
                    : isEs
                      ? 'Indicaciones curadas por perfil'
                      : 'Indicações selecionadas por perfil'}
                </p>
              </div>
              <div>
                <p className="font-mono text-2xl sm:text-3xl font-semibold text-white tabular-nums">
                  {metrics.totalPartners > 0 ? `${metrics.uniqueCategories}/8` : '8 Áreas'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {metrics.totalPartners > 0
                    ? isEs
                      ? 'Especialidades cubiertas'
                      : 'Especialidades atendidas'
                    : isEs
                      ? 'Vivienda, traducción, legal y más'
                      : 'Imóveis, tradução, jurídico e mais'}
                </p>
              </div>
              <div>
                <p className="font-mono text-2xl sm:text-3xl font-semibold text-white tabular-nums">
                  {metrics.totalPartners > 0
                    ? metrics.averageRating > 0
                      ? `${metrics.averageRating.toFixed(1)}/5`
                      : '5.0/5'
                    : '100%'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {metrics.totalPartners > 0
                    ? isEs
                      ? 'Evaluación técnica media'
                      : 'Avaliação técnica média'
                    : isEs
                      ? 'Contratación directa e independiente'
                      : 'Contratação direta e independente'}
                </p>
              </div>
              <div>
                <p className="font-mono text-2xl sm:text-3xl font-semibold text-[#E5C77B] tabular-nums">
                  48h
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {isEs ? 'Retorno inicial B2B' : 'Prazo de curadoria B2B'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Clean 3-Tab Workspace Switcher (Eliminates 12-section clutter!) */}
        <div className="bg-white dark:bg-[#0D1422] border-b border-[#E5E7EB] dark:border-[#1E293B] sticky top-[64px] lg:top-[76px] z-30">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 flex items-center gap-8 overflow-x-auto">
            {[
              {
                id: 'diretorio' as const,
                label:
                  partnersPublic.length > 0
                    ? isEs
                      ? `Directorio y Mapa (${partnersPublic.length})`
                      : `Diretório & Mapa (${partnersPublic.length})`
                    : isEs
                      ? 'Red de Indicaciones'
                      : 'Rede de Indicações',
              },
              { id: 'sinergia' as const, label: isEs ? 'Recomendación IA' : 'Sinergia IA' },
              { id: 'seja_parceiro' as const, label: isEs ? 'Ser Aliado B2B' : 'Seja Parceiro B2B' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 text-sm whitespace-nowrap shrink-0 border-b-2 transition-colors ${
                    active
                      ? 'border-[#0F3D91] dark:border-[#60A5FA] text-[#0B1628] dark:text-white font-semibold'
                      : 'border-transparent text-[#4B5563] dark:text-slate-400 font-medium hover:text-[#0B1628] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Active Workspace Content */}
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-12 lg:py-16 space-y-16">
          {activeTab === 'diretorio' && (
            <>
              {/* Saved Partners Strip — ONLY shown when the user actually saved partners */}
              {savedPartners.length > 0 && (
                <section
                  id="parceiros-salvos"
                  className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-sm font-bold text-[#0B1628] dark:text-white">
                      {isEs ? 'Aliados Guardados' : 'Parceiros Salvos'} ({savedPartners.length})
                    </h2>
                    <button
                      type="button"
                      onClick={clearFavorites}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B7280] hover:text-[#B91C1C] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isEs ? 'Limpiar' : 'Limpar'}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedPartners.map((partner) => (
                      <div
                        key={partner.id}
                        className="p-4 rounded-lg bg-[#F7F8FA] dark:bg-[#151F32] border border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-[#6B7280] dark:text-slate-400 truncate">
                            {translatePartnerCategory(partner.categoria, locale)}
                          </p>
                          <p className="text-sm font-semibold text-[#0B1628] dark:text-white truncate">
                            {partner.nome}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setSelectedPartner(partner)}
                            className="text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline"
                          >
                            {isEs ? 'Ver' : 'Abrir'}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFavorite(partner.id)}
                            aria-label={`Remover ${partner.nome}`}
                            className="p-1 text-[#B91C1C]"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Transparent Referral Model Bar */}
              <section
                aria-label={isEs ? 'Cómo funciona nuestra red de derivaciones' : 'Como funciona nossa rede de indicações'}
                className="grid grid-cols-1 md:grid-cols-3 rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] divide-y md:divide-y-0 md:divide-x divide-[#E5E7EB] dark:divide-[#1E293B]"
              >
                <div className="p-6 space-y-2">
                  <p className="font-mono text-[11px] font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                    01 · {isEs ? 'ALCANCE TRANSPARENTE' : 'ESCOPO TRANSPARENTE'}
                  </p>
                  <h2 className="font-display text-base font-bold text-[#0B1628] dark:text-white">
                    {isEs ? 'D&M llega hasta Visa, PDI y RUT' : 'D&M conduz até Visto, PDI e RUT'}
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                    {isEs
                      ? 'Nuestra consultoría abarca hasta Visa, PDI y RUT; para vivienda y demás etapas en Chile, derivamos con transparencia a especialistas aliados.'
                      : 'Nossa consultoria atua até Visto, PDI e RUT; para imóveis e demais demandas fora do processo migratório, fazemos indicação transparente de profissionais parceiros.'}
                  </p>
                </div>
                <div className="p-6 space-y-2">
                  <p className="font-mono text-[11px] font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                    02 · {isEs ? 'CURADURÍA PREVIA' : 'CURADORIA PRÉVIA'}
                  </p>
                  <h2 className="font-display text-base font-bold text-[#0B1628] dark:text-white">
                    {isEs ? 'Especialistas evaluados' : 'Profissionais selecionados'}
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                    {isEs
                      ? 'Cada aliado es revisado por historial técnico, claridad comercial y experiencia atendiendo brasileños en Chile.'
                      : 'Cada parceiro listado passa por triagem de histórico, postura ética e experiência no atendimento a brasileiros.'}
                  </p>
                </div>
                <div className="p-6 space-y-2">
                  <p className="font-mono text-[11px] font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                    03 · {isEs ? 'CONTRATACIÓN DIRECTA' : 'CONTRATAÇÃO DIRETA'}
                  </p>
                  <h2 className="font-display text-base font-bold text-[#0B1628] dark:text-white">
                    {isEs ? 'Libertad total de elección' : 'Autonomia e contato direto'}
                  </h2>
                  <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                    {isEs
                      ? 'Conversas directamente con el especialista indicado, comparas presupuestos y contratas libremente según tus necesidades.'
                      : 'Você conversa diretamente com o profissional indicado pelo WhatsApp, analisa propostas e decide com total autonomia.'}
                  </p>
                </div>
              </section>

              {/* Clean Filter & Directory Section */}
              <section id="diretorio-parceiros" className="scroll-mt-32 space-y-8">
                {partnersPublic.length > 0 && (
                <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-5 sm:p-6 space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {PARTNER_MACRO_GROUPS.map((group) => {
                      const count = macroGroupCounts.get(group.id) || 0;
                      const active = filterMacroGroup === group.id;
                      return (
                        <button
                          key={group.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setFilterMacroGroup(group.id);
                            setFilterCat('Todas');
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap tabular-nums ${
                            active
                              ? 'bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628]'
                              : 'bg-[#F7F8FA] dark:bg-[#151F32] text-[#4B5563] dark:text-slate-300 hover:text-[#0B1628] dark:hover:text-white'
                          }`}
                        >
                          {isEs ? group.labelEs : group.labelPt} ({count})
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B]">
                    <div className="md:col-span-5 relative">
                      <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={isEs ? 'Buscar por nombre, ciudad o especialidad...' : 'Buscar por nome, cidade ou especialidade...'}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm text-[#0B1628] dark:text-white focus:bg-white dark:focus:bg-[#1A263C] focus:border-[#0F3D91] focus:outline-none"
                      />
                    </div>
                    <select
                      aria-label="Filtrar por país"
                      value={filterPais}
                      onChange={(e) => setFilterPais(e.target.value as typeof filterPais)}
                      className="md:col-span-2 px-3 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-xs font-medium text-[#0B1628] dark:text-white"
                    >
                      <option value="Todos">{isEs ? 'Todos los países' : 'Todos os países'}</option>
                      <option value="Chile">Chile</option>
                      <option value="Brasil">Brasil</option>
                      <option value="Ambos">{isEs ? 'Brasil y Chile' : 'Brasil e Chile'}</option>
                    </select>
                    <select
                      aria-label="Filtrar por especialidade"
                      value={filterCat}
                      onChange={(e) => setFilterCat(e.target.value)}
                      className="md:col-span-3 px-3 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-xs font-medium text-[#0B1628] dark:text-white"
                    >
                      <option value="Todas">{isEs ? 'Todas las especialidades' : 'Todas as especialidades'}</option>
                      {activeCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {translatePartnerCategory(cat, locale)}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="Ordenar resultados"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as PublicPartnerSort)}
                      className="md:col-span-2 px-3 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-xs font-medium text-[#0B1628] dark:text-white"
                    >
                      <option value="avaliacao">{isEs ? 'Mejor evaluados' : 'Melhor avaliação'}</option>
                      <option value="nome">{isEs ? 'Nombre A–Z' : 'Nome A–Z'}</option>
                    </select>
                  </div>

                  {hasActiveFilters && (
                    <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-slate-400">
                      <span className="tabular-nums">
                        {filteredPartners.length} {isEs ? 'resultados encontrados' : 'resultados encontrados'}
                      </span>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline"
                      >
                        {isEs ? 'Limpiar filtros' : 'Limpar filtros'}
                      </button>
                    </div>
                  )}
                </div>
                )}

                {filteredPartners.length === 0 ? (
                  partnersPublic.length === 0 ? (
                    <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl p-8 sm:p-10 space-y-6">
                      <div className="max-w-2xl space-y-2">
                        <p className="text-xs font-mono font-semibold uppercase tracking-[0.06em] text-[#0F3D91] dark:text-[#C9A86A]">
                          {isEs ? 'Curaduría Activa · Indicaciones Personalizadas' : 'Curadoria Ativa · Indicações Personalizadas'}
                        </p>
                        <h3 className="font-display text-xl sm:text-2xl font-bold text-[#0B1628] dark:text-white">
                          {isEs
                            ? '¿Necesitas un profesional indicado en Brasil o Chile?'
                            : 'Precisa de indicação de profissional no Brasil ou no Chile?'}
                        </h3>
                        <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                          {isEs
                            ? 'Nuestro catálogo público está en actualización con nuevos aliados homologados. Mientras tanto, nuestro equipo realiza derivaciones personalizadas para vivienda/arriendo, traducciones juradas, notarías, contabilidad SpA, abogacía y seguros.'
                            : 'Nosso catálogo público está recebendo novos parceiros homologados. Enquanto isso, nossa equipe faz indicações diretas e personalizadas para imóveis/moradia, traduções juramentadas, cartórios, contabilidade SpA, advocacia complementar e seguros.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {HIGH_DEMAND_AREAS.map((area) => {
                          const Icon = getCategoryIcon(area.category);
                          return (
                            <div
                              key={area.category}
                              className="p-4 rounded-xl bg-[#F7F8FA] dark:bg-[#151F32] border border-[#E5E7EB] dark:border-[#1E293B] space-y-2"
                            >
                              <div className="flex items-center gap-2 text-[11px] font-semibold text-[#0F3D91] dark:text-[#C9A86A]">
                                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                                <span>{isEs ? area.stageEs : area.stagePt}</span>
                              </div>
                              <p className="font-display text-sm font-bold text-[#0B1628] dark:text-white">
                                {translatePartnerCategory(area.category, locale)}
                              </p>
                              <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                                {isEs ? area.demandEs : area.demandPt}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pt-2">
                        <a
                          href={buildWhatsAppUrl(
                            empresa.whatsapp,
                            isEs
                              ? '¡Hola! Me gustaría solicitar una indicación de profesional aliado (vivienda, traducción, contabilidad u otra área) a través de D&M Integra Chile.'
                              : 'Olá! Gostaria de solicitar a indicação de um profissional parceiro (imóveis, tradução, contabilidade ou outra área) pela D&M Integra Chile.',
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0B1628] dark:bg-[#E5C77B] text-white dark:text-[#070E1C] text-xs font-semibold hover:opacity-90 transition-opacity"
                        >
                          <MessageCircle className="w-4 h-4" />
                          {isEs ? 'Solicitar indicación por WhatsApp' : 'Solicitar indicação pelo WhatsApp'}
                        </a>
                        <button
                          type="button"
                          onClick={() => setActiveTab('seja_parceiro')}
                          className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-xs font-semibold text-[#0B1628] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#151F32] transition-colors"
                        >
                          {isEs ? 'Quiero postular como aliado B2B' : 'Quero me cadastrar como parceiro'}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-12 text-center space-y-3">
                      <p className="text-base font-semibold text-[#0B1628] dark:text-white">
                        {isEs ? 'Ningún aliado coincide con los filtros.' : 'Nenhum parceiro encontrado para esses filtros.'}
                      </p>
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="px-4 py-2 rounded-lg text-xs font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white"
                      >
                        {isEs ? 'Mostrar todos' : 'Ver todos os parceiros'}
                      </button>
                    </div>
                  )
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPartners.map((partner) => {
                      const CatIcon = getCategoryIcon(partner.categoria);
                      const safeLogo = sanitizePartnerImageUrl(partner.logoUrl);
                      const fav = isFavorite(partner.id);
                      const synergy = synergyByPartnerId.get(partner.id);

                      return (
                        <article
                          key={partner.id}
                          className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#0F3D91]/50 dark:hover:border-[#60A5FA]/50 rounded-xl p-6 flex flex-col justify-between gap-6 transition-all hover:shadow-[0_12px_32px_rgba(11,22,40,0.06)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3.5 min-w-0">
                                <div className="w-12 h-12 rounded-lg bg-[#F7F8FA] dark:bg-[#151F32] border border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-center overflow-hidden shrink-0">
                                  {safeLogo ? (
                                    <OptimizedImage
                                      src={safeLogo}
                                      alt={partner.nome}
                                      sizes="48px"
                                      containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                                      className="max-w-full max-h-full object-contain p-1"
                                    />
                                  ) : (
                                    <CatIcon className="w-5 h-5 text-[#0F3D91] dark:text-[#60A5FA]" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[11px] font-semibold text-[#0F3D91] dark:text-[#60A5FA] truncate">
                                    {translatePartnerCategory(partner.categoria, locale)} · {translatePartnerCountry(partner.pais, locale)}
                                  </p>
                                  <h3 className="font-display text-base font-bold text-[#0B1628] dark:text-white leading-snug line-clamp-2 mt-0.5">
                                    {partner.nome}
                                  </h3>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleFavorite(partner.id)}
                                aria-label={fav ? `Remover ${partner.nome} dos salvos` : `Salvar ${partner.nome}`}
                                className="p-1.5 rounded-lg text-[#6B7280] hover:text-[#B91C1C] transition-colors shrink-0"
                              >
                                <Heart className={`w-4 h-4 ${fav ? 'fill-[#B91C1C] text-[#B91C1C]' : ''}`} />
                              </button>
                            </div>

                            <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed line-clamp-3">
                              {partner.descricaoPublica}
                            </p>

                            <div className="flex items-center justify-between gap-2 text-xs text-[#6B7280] dark:text-slate-400">
                              <span className="inline-flex items-center gap-1.5 truncate">
                                <MapPin className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF]" aria-hidden="true" />
                                <span className="truncate">{partner.cidadeRegiao}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#0B1628] dark:text-slate-200 tabular-nums shrink-0">
                                <Star className="w-3.5 h-3.5 fill-[#B08D57] text-[#B08D57]" />
                                {Number(partner.avaliacao || 5).toFixed(1)}
                                {synergy ? ` · IA ${synergy.score}%` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-3 text-xs">
                            {partner.whatsapp ? (
                              <a
                                href={buildWhatsAppUrl(partner.whatsapp, buildReferralMessage(partner))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-semibold text-[#047857] dark:text-emerald-400 hover:underline whitespace-nowrap"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                {isEs ? 'Indicación WhatsApp' : 'Solicitar via WhatsApp'}
                              </a>
                            ) : (
                              <span className="text-[#6B7280] dark:text-slate-500">
                                {isEs ? 'Consulta directa' : 'Indicação consultiva'}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedPartner(partner)}
                              className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                            >
                              {isEs ? 'Ver perfil →' : 'Ver detalhes →'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Interactive Chile Partner Map */}
              <PartnerGeolocationMap
                partners={partnersPublic}
                locale={locale}
                externalMacroGroup={filterMacroGroup}
                onSelectPartner={(partner) => setSelectedPartner(partner)}
                buildReferralMessage={buildReferralMessage}
              />
            </>
          )}

          {activeTab === 'sinergia' && (
            <div className="space-y-14">
              <section id="sinergia-ia">
                <PartnerSynergyAnalyzer
                  partnersPublic={partnersPublic}
                  locale={locale}
                  onSelectPartner={(partner) => setSelectedPartner(partner)}
                  onResultChange={(res) => setSynergyResult(res)}
                />
              </section>
              <section id="depoimentos-clientes">
                <ClientTestimonialsCarousel locale={locale} />
              </section>
            </div>
          )}

          {activeTab === 'seja_parceiro' && (
            <div className="space-y-16">
              {/* 4-Step Corporate Onboarding */}
              <section className="space-y-8">
                <div className="max-w-2xl space-y-2">
                  <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                    {isEs ? 'Proceso de homologación' : 'Processo de homologação'}
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1628] dark:text-white">
                    {isEs ? 'Cómo integrarte a nuestra red B2B' : 'Como integrar sua empresa à nossa rede'}
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {onboardingSteps.map((step) => (
                    <div key={step.num} className="pt-5 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-2">
                      <p className="font-mono text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA]">{step.num}</p>
                      <h3 className="font-display text-base font-bold text-[#0B1628] dark:text-white">{step.title}</h3>
                      <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* High-Demand Sectors */}
              <section className="space-y-6">
                <div className="space-y-1.5">
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1628] dark:text-white">
                    {isEs ? 'Áreas con demanda prioritaria' : 'Especialidades com demanda prioritária'}
                  </h2>
                  <p className="text-sm text-[#4B5563] dark:text-slate-300">
                    {isEs
                      ? 'Selecciona una especialidad para prellenar tu postulación.'
                      : 'Selecione uma área para pré-preencher sua proposta comercial.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {HIGH_DEMAND_AREAS.map((area) => (
                    <button
                      key={area.category}
                      type="button"
                      onClick={() => handleApplyForArea(area)}
                      className="text-left bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#0F3D91] dark:hover:border-[#60A5FA] rounded-xl p-5 flex flex-col justify-between gap-3 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-medium text-[#6B7280] dark:text-slate-400">
                          {isEs ? area.stageEs : area.stagePt}
                        </p>
                        <p className="text-sm font-bold text-[#0B1628] dark:text-white">
                          {translatePartnerCategory(area.category, locale)}
                        </p>
                        <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                          {isEs ? area.demandEs : area.demandPt}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                        {isEs ? 'Postular área →' : 'Candidatar área →'}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* B2B Proposal Form */}
              <section
                id="seja-parceiro-form"
                className="scroll-mt-32 bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-6 sm:p-10 space-y-6"
              >
                <div className="max-w-2xl space-y-2">
                  <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                    {isEs ? 'Postulación confidencial' : 'Credenciamento confidencial'}
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1628] dark:text-white">
                    {isEs ? 'Envía tu propuesta de alianza' : 'Envie sua proposta de parceria'}
                  </h2>
                  <p className="text-sm text-[#4B5563] dark:text-slate-300">
                    {isEs
                      ? 'Tus condiciones comerciales permanecen privadas para nuestra dirección.'
                      : 'Suas condições comerciais ficam em sigilo exclusivo com nossa diretoria.'}
                  </p>
                </div>

                {prefilledNotice && (
                  <p className="text-xs text-[#0F3D91] dark:text-[#60A5FA] font-medium">
                    {isEs ? 'Especialidad seleccionada:' : 'Especialidade pré-selecionada:'}{' '}
                    <strong>{translatePartnerCategory(prefilledNotice, locale)}</strong>
                  </p>
                )}

                {submittedId ? (
                  <div className="p-6 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      {isEs ? '¡Propuesta recibida con éxito!' : 'Proposta enviada com sucesso!'}
                    </div>
                    <p className="text-xs text-emerald-700 dark:text-emerald-200">
                      {isEs
                        ? `Protocolo ${submittedId}. Nuestro equipo responderá en hasta 48h hábiles.`
                        : `Protocolo ${submittedId}. Nossa equipe retornará em até 48h úteis.`}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSubmittedId(null)}
                      className="mt-2 text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline"
                    >
                      {isEs ? 'Enviar otra postulación' : 'Enviar nova proposta'}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <input
                      type="text"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                      aria-hidden="true"
                      className="hidden"
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="p-empresa" className="block text-xs font-semibold mb-1.5">
                          {isEs ? 'Nombre de la empresa *' : 'Nome da empresa *'}
                        </label>
                        <input
                          ref={companyInputRef}
                          id="p-empresa"
                          type="text"
                          required
                          value={nomeEmpresa}
                          onChange={(e) => setNomeEmpresa(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="p-cat" className="block text-xs font-semibold mb-1.5">
                          {isEs ? 'Especialidad *' : 'Especialidade *'}
                        </label>
                        <select
                          id="p-cat"
                          value={categoria}
                          onChange={(e) => setCategoria(e.target.value as PartnerCategory)}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        >
                          {PARTNER_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {translatePartnerCategory(c, locale)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="p-pais" className="block text-xs font-semibold mb-1.5">
                          {isEs ? 'País de operación' : 'País de atuação'}
                        </label>
                        <select
                          id="p-pais"
                          value={pais}
                          onChange={(e) => setPais(e.target.value as 'Brasil' | 'Chile' | 'Ambos')}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        >
                          <option value="Chile">Chile</option>
                          <option value="Brasil">Brasil</option>
                          <option value="Ambos">{isEs ? 'Brasil y Chile' : 'Brasil e Chile'}</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="p-cidade" className="block text-xs font-semibold mb-1.5">
                          {isEs ? 'Ciudad / Región' : 'Cidade / Região'}
                        </label>
                        <input
                          id="p-cidade"
                          type="text"
                          value={cidade}
                          onChange={(e) => setCidade(e.target.value)}
                          placeholder="Ex.: Santiago / São Paulo / Online"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="p-resp" className="block text-xs font-semibold mb-1.5">
                          {isEs ? 'Nombre del responsable *' : 'Responsável comercial *'}
                        </label>
                        <input
                          id="p-resp"
                          type="text"
                          required
                          value={responsavel}
                          onChange={(e) => setResponsavel(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="p-wa" className="block text-xs font-semibold mb-1.5">
                          WhatsApp *
                        </label>
                        <input
                          id="p-wa"
                          type="tel"
                          required
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(formatPhoneByCountry(e.target.value, pais))}
                          placeholder={pais === 'Chile' ? '+56 9 1234 5678' : '+55 11 99999-9999'}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="p-email" className="block text-xs font-semibold mb-1.5">
                          E-mail corporativo *
                        </label>
                        <input
                          id="p-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        />
                      </div>
                      <div>
                        <label htmlFor="p-site" className="block text-xs font-semibold mb-1.5">
                          Site ou Instagram
                        </label>
                        <input
                          id="p-site"
                          type="text"
                          value={siteOuInstagram}
                          onChange={(e) => setSiteOuInstagram(e.target.value)}
                          placeholder="https://..."
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div>
                        <label htmlFor="p-moeda" className="block text-xs font-semibold mb-1.5">
                          {isEs ? 'Moneda referencial' : 'Moeda de referência'}
                        </label>
                        <select
                          id="p-moeda"
                          value={moeda}
                          onChange={(e) => setMoeda(e.target.value as CurrencyCode)}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                        >
                          <option value="CLP">CLP</option>
                          <option value="BRL">BRL</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => handleProposalLogoFile(e.target.files)}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-xs font-semibold hover:bg-[#F7F8FA] dark:hover:bg-[#151F32]"
                        >
                          {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          {isEs ? 'Adjuntar logo oficial (opcional)' : 'Enviar logo oficial (opcional)'}
                        </button>
                        {safeFormLogoPreview && (
                          <img
                            src={safeFormLogoPreview}
                            alt="Logo"
                            className="h-9 w-auto rounded border border-[#E5E7EB] bg-white p-1"
                          />
                        )}
                        {logoUploadError && <span className="text-xs text-[#B91C1C]">{logoUploadError}</span>}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="p-proposta" className="block text-xs font-semibold mb-1.5">
                        {isEs ? 'Propuesta comercial / beneficio a clientes (confidencial)' : 'Proposta comercial / benefício aos clientes (sigiloso)'}
                      </label>
                      <textarea
                        id="p-proposta"
                        rows={3}
                        value={proposta}
                        onChange={(e) => setProposta(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                      />
                    </div>

                    <div>
                      <label htmlFor="p-msg" className="block text-xs font-semibold mb-1.5">
                        {isEs ? 'Descripción pública de los servicios' : 'Apresentação institucional da empresa'}
                      </label>
                      <textarea
                        id="p-msg"
                        rows={2}
                        value={mensagem}
                        onChange={(e) => setMensagem(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-sm"
                      />
                    </div>

                    {formError && <p className="text-xs font-medium text-[#B91C1C]">{formError}</p>}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628] text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                    >
                      {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isEs ? 'Enviar postulación B2B' : 'Enviar proposta de parceria'}
                    </button>
                  </form>
                )}
              </section>

              {/* Concise Partner FAQ */}
              <section className="max-w-3xl space-y-6">
                <h2 className="font-display text-2xl font-bold text-[#0B1628] dark:text-white">
                  {isEs ? 'Preguntas frecuentes del programa' : 'Perguntas frequentes sobre parcerias'}
                </h2>
                <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B] border-y border-[#E5E7EB] dark:border-[#1E293B]">
                  {partnerFaqs.map((item, idx) => {
                    const open = openFaqIdx === idx;
                    return (
                      <div key={item.q}>
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setOpenFaqIdx(open ? null : idx)}
                          className="w-full py-4 flex items-center justify-between gap-4 text-left"
                        >
                          <span className="text-sm font-semibold text-[#0B1628] dark:text-white">{item.q}</span>
                          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <p className="pb-4 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">{item.a}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Partner Detail Modal */}
        {selectedPartner && (
          <div
            className="fixed inset-0 z-50 bg-[#070B12]/75 backdrop-blur-[2px] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={selectedPartner.nome}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedPartner(null);
            }}
          >
            <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
              <div className="bg-[#0B1628] text-white p-6 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                  {(() => {
                    const modalLogo = sanitizePartnerImageUrl(selectedPartner.logoUrl);
                    const ModalCatIcon = getCategoryIcon(selectedPartner.categoria);
                    return (
                      <div className="w-12 h-12 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                        {modalLogo ? (
                          <OptimizedImage
                            src={modalLogo}
                            alt={selectedPartner.nome}
                            sizes="48px"
                            containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                            className="max-w-full max-h-full object-contain p-1"
                          />
                        ) : (
                          <ModalCatIcon className="w-5 h-5 text-[#E5C77B]" />
                        )}
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-[#C9A86A]">
                      {translatePartnerCategory(selectedPartner.categoria, locale)} · {translatePartnerCountry(selectedPartner.pais, locale)}
                    </p>
                    <h3 className="font-display text-xl font-bold text-white mt-1 leading-snug">
                      {selectedPartner.nome}
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 mt-1.5">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#C9A86A]" />
                        {selectedPartner.cidadeRegiao}
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-white">
                        <Star className="w-3.5 h-3.5 fill-[#C9A86A] text-[#C9A86A]" />
                        {Number(selectedPartner.avaliacao || 5).toFixed(1)}/5
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPartner(null)}
                  aria-label="Fechar detalhes"
                  className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 text-sm">
                <p className="text-[#4B5563] dark:text-slate-300 leading-relaxed">
                  {selectedPartner.descricaoPublica}
                </p>

                <div className="rounded-xl bg-[#F7F8FA] dark:bg-[#111A2B] border border-[#E5E7EB] dark:border-[#1E293B] p-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{isEs ? 'DERIVACIÓN TRANSPARENTE' : 'INDICAÇÃO TRANSPARENTE'}</span>
                  </div>
                  <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                    {isEs
                      ? 'Este especialista opera de forma independiente. D&M Integra Chile realiza la recomendación y tú contratas directamente sin obligación.'
                      : 'Este profissional ou empresa atua de forma independente. A D&M realiza a indicação qualificada e você negocia e contrata diretamente.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {selectedPartner.whatsapp && (
                    <a
                      href={buildWhatsAppUrl(selectedPartner.whatsapp, buildReferralMessage(selectedPartner))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628] text-xs font-semibold hover:opacity-90 transition-opacity"
                    >
                      <MessageCircle className="w-4 h-4" />
                      {isEs ? 'Contactar por WhatsApp' : 'Falar via indicação D&M'}
                    </a>
                  )}
                  {selectedPartner.whatsapp && (
                    <button
                      type="button"
                      onClick={() => handleCopyText(selectedPartner.whatsapp, 'whatsapp')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-xs font-medium text-[#0B1628] dark:text-slate-200 hover:border-[#0B1628] dark:hover:border-white transition-colors"
                    >
                      {copiedId === 'whatsapp' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedId === 'whatsapp'
                        ? (isEs ? 'Copiado' : 'Copiado')
                        : selectedPartner.whatsapp}
                    </button>
                  )}
                  {(() => {
                    const safeSiteUrl = normalizePartnerExternalUrl(selectedPartner.siteInstagram);
                    if (!safeSiteUrl) return null;
                    return (
                      <a
                        href={safeSiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-xs font-medium text-[#0B1628] dark:text-slate-200 hover:border-[#0B1628] dark:hover:border-white transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Website / Instagram
                      </a>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
};
