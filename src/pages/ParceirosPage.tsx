import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import {
  ArrowRight,
  Award,
  Bookmark,
  Briefcase,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  FileCheck2,
  Globe2,
  GraduationCap,
  Handshake,
  Heart,
  HeartPulse,
  Image as ImageIcon,
  Languages,
  Landmark,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { BrandRibbon } from '../components/BrandLogo';
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
  getPartnerMacroGroupLabel,
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
    demandPt: 'Certidões civis, diplomas e antecedentes exigidos antes do protocolo de visto.',
    demandEs: 'Certificados civiles, diplomas y antecedentes requeridos antes de solicitar visa.',
    stagePt: 'Pré-embarque · Brasil',
    stageEs: 'Pre-embarque · Brasil',
  },
  {
    category: 'Cartório / Apostilamento',
    defaultPais: 'Brasil',
    defaultMoeda: 'BRL',
    demandPt: 'Emissão de 2ª via atualizada e Apostila de Haia com envio ágil para famílias.',
    demandEs: 'Emisión de actas actualizadas y Apostilla de La Haya con despacho ágil.',
    stagePt: 'Documentação · CNJ',
    stageEs: 'Documentación · Haya',
  },
  {
    category: 'Imobiliária',
    defaultPais: 'Chile',
    defaultMoeda: 'CLP',
    demandPt: 'Locação em Santiago e regiões para recém-chegados sem histórico de crédito local.',
    demandEs: 'Arriendo en Santiago y regiones para recién llegados sin historial crediticio local.',
    stagePt: 'Chegada · Moradia',
    stageEs: 'Llegada · Vivienda',
  },
  {
    category: 'Contabilidade / Abertura Empresa',
    defaultPais: 'Chile',
    defaultMoeda: 'CLP',
    demandPt: 'Constituição de SpA, RUT empresarial, início de atividades no SII e tributação.',
    demandEs: 'Constitución de SpA, RUT empresarial, inicio de actividades SII y tributación.',
    stagePt: 'Negócios · SII',
    stageEs: 'Negocios · SII',
  },
  {
    category: 'Escritório de Advocacia',
    defaultPais: 'Ambos',
    defaultMoeda: 'USD',
    demandPt: 'Estruturação societária, contratos internacionais, recursos e planejamento patrimonial.',
    demandEs: 'Estructuración societaria, contratos internacionales y planificación patrimonial.',
    stagePt: 'Jurídico · Binacional',
    stageEs: 'Legal · Binacional',
  },
  {
    category: 'Seguradora / Saúde',
    defaultPais: 'Ambos',
    defaultMoeda: 'CLP',
    demandPt: 'Seguro viagem obrigatório, planos Isapre, seguros residenciais e proteção familiar.',
    demandEs: 'Seguro de viaje obligatorio, planes Isapre, seguros de hogar y protección familiar.',
    stagePt: 'Proteção · Saúde',
    stageEs: 'Protección · Salud',
  },
  {
    category: 'Escola / Universidade',
    defaultPais: 'Chile',
    defaultMoeda: 'CLP',
    demandPt: 'Matrícula bilíngue para filhos, cursos de espanhol e programas de pós-graduação.',
    demandEs: 'Matrícula bilingüe para hijos, cursos de español y programas de posgrado.',
    stagePt: 'Educação · Família',
    stageEs: 'Educación · Familia',
  },
  {
    category: 'Despachante',
    defaultPais: 'Ambos',
    defaultMoeda: 'CLP',
    demandPt: 'Trâmites veiculares, validações presenciais, pet relocation e logística documental.',
    demandEs: 'Trámites vehiculares, gestiones presenciales, traslado de mascotas y logística.',
    stagePt: 'Operacional · Relocation',
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
  const { partnersPublic, empresa } = useApp();
  const { locale } = useLanguage();
  const isEs = locale === 'es-CL';

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

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Formulário Seja um Parceiro
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

  // Close Partner Detail Modal on Escape key
  useEffect(() => {
    if (!selectedPartner) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedPartner(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedPartner]);

  // Smooth-scroll to interactive Chile map when navigated with ?secao=mapa or #mapa-parceiros
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('secao') === 'mapa' || window.location.hash === '#mapa-parceiros') {
      const timer = window.setTimeout(() => {
        const el = document.getElementById('mapa-parceiros');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 180);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, []);

  const metrics = useMemo(() => computePartnerNetworkMetrics(partnersPublic), [partnersPublic]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of partnersPublic) {
      counts.set(p.categoria, (counts.get(p.categoria) || 0) + 1);
    }
    return counts;
  }, [partnersPublic]);

  const macroGroupCounts = useMemo(() => {
    const counts = new Map<PartnerMacroGroupId, number>();
    for (const group of PARTNER_MACRO_GROUPS) {
      if (group.id === 'Todos') {
        counts.set(group.id, partnersPublic.length);
      } else {
        counts.set(
          group.id,
          partnersPublic.filter((p) => matchesPartnerMacroGroup(p.categoria, group.id)).length,
        );
      }
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

  const handleSelectTopCategory = (groupId: PartnerMacroGroupId) => {
    setFilterMacroGroup(groupId);
    setFilterCat('Todas');
    if (groupId !== 'Todos') {
      scrollToSection('diretorio-parceiros');
    }
  };

  const handleApplyForArea = (area: DemandAreaConfig) => {
    setCategoria(area.category);
    setPais(area.defaultPais);
    setMoeda(area.defaultMoeda);
    setPrefilledNotice(area.category);
    setFormError(null);
    scrollToSection('seja-parceiro');
    setTimeout(() => {
      companyInputRef.current?.focus({ preventScroll: true });
    }, 550);
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
            ? 'La imagen es demasiado grande. Intenta con un logo más ligero (PNG/JPG/WebP menor a 300 KB).'
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
        {
          num: '01.',
          title: 'Postulación en 2 minutos',
          desc: 'Envía los datos de tu empresa, especialidad, logo oficial y propuesta comercial confidencial.',
        },
        {
          num: '02.',
          title: 'Curaduría en hasta 48h hábiles',
          desc: 'Nuestra dirección valida trayectoria, registros profesionales y calidad de atención a brasileños.',
        },
        {
          num: '03.',
          title: 'Alineación comercial privada',
          desc: 'Definimos plazos prioritarios y beneficios o acuerdos en BRL, CLP o USD bajo total reserva.',
        },
        {
          num: '04.',
          title: 'Vitrina oficial + Indicaciones IA',
          desc: 'Tu marca se publica con logo en el directorio y comienza a recibir derivaciones calificadas.',
        },
      ]
    : [
        {
          num: '01.',
          title: 'Cadastro objetivo em 2 min',
          desc: 'Envie os dados da empresa, especialidade, logo oficial e condições comerciais em sigilo.',
        },
        {
          num: '02.',
          title: 'Curadoria em até 48h úteis',
          desc: 'Nossa diretoria verifica histórico, registros profissionais e padrão de atendimento ao público Brasil–Chile.',
        },
        {
          num: '03.',
          title: 'Alinhamento comercial privado',
          desc: 'Definimos prazos prioritários e benefícios ou comissionamento em BRL, CLP ou USD em ambiente confidencial.',
        },
        {
          num: '04.',
          title: 'Vitrine oficial + Indicações via IA',
          desc: 'Sua marca entra no diretório com logo e passa a ser recomendada aos clientes com perfil compatível.',
        },
      ];

  const partnerFaqs = isEs
    ? [
        {
          q: '¿Tiene algún costo mensual o membresía formar parte de la red?',
          a: 'No. La postulación y permanencia en la red homologada de D&M Integra Chile no tiene cuota mensual. Los acuerdos comerciales (beneficios exclusivos para clientes o esquemas de derivación) se alinean caso a caso de forma transparente.',
        },
        {
          q: '¿Mis tarifas, comisiones o condiciones comerciales se publican en el sitio?',
          a: 'Nunca. Toda condición financiera, tabla referencial o acuerdo de comisión permanece estrictamente confidencial en nuestro panel administrativo privado. En la vitrina pública solo se muestra tu marca, especialidad, ubicación y canales oficiales.',
        },
        {
          q: '¿Puedo postular si atiendo 100% online desde Brasil o desde regiones de Chile?',
          a: 'Sí. Muchos servicios críticos —como traducción juramentada, apostilla, contabilidad, asesoría jurídica o seguros— operan de forma remota en ambos países. Solo indica "Online" junto a tu ciudad al completar el formulario.',
        },
        {
          q: '¿Cómo llegan los clientes hasta mi empresa tras la homologación?',
          a: 'Por tres frentes complementarios: recomendación directa de nuestros consultores durante el seguimiento del proceso migratorio, sugerencias automatizadas del Analizador de Sinergia con IA y contacto directo vía WhatsApp desde la vitrina oficial.',
        },
      ]
    : [
        {
          q: 'Existe alguma mensalidade ou taxa fixa para integrar a rede homologada?',
          a: 'Não. O credenciamento e a permanência na vitrine oficial da D&M Integra Chile não têm mensalidade fixa. Trabalhamos com condições transparentes — seja benefício diferenciado ao cliente indicado ou acordo de indicação alinhado caso a caso.',
        },
        {
          q: 'Meus valores, comissões ou tabela comercial ficam visíveis ao público?',
          a: 'Jamais. Todas as condições comerciais, percentuais e notas de negociação ficam protegidas em ambiente administrativo sigiloso. Na vitrine pública aparecem apenas sua marca/logo, especialidade, região e canais oficiais.',
        },
        {
          q: 'Empresas que atendem 100% online no Brasil ou em regiões do Chile podem participar?',
          a: 'Sim. Grande parte da demanda — tradução juramentada, cartório/apostilamento, contabilidade, advocacia, seguros e assessoria imobiliária — funciona em modelo remoto ou híbrido. Basta informar sua cidade e indicar atendimento online.',
        },
        {
          q: 'Como os clientes chegam até a minha empresa após a homologação?',
          a: 'Por três canais integrados: indicação consultiva ativa durante a jornada de visto e relocation, recomendação inteligente do módulo de Sinergia IA conforme o perfil do cliente e acesso direto ao seu WhatsApp na vitrine oficial.',
        },
      ];

  const brandName = empresa.nome_empresa || 'D&M Integra Chile';
  const safeFormLogoPreview = sanitizePartnerImageUrl(logoUrl);
  const PreviewCategoryIcon = getCategoryIcon(categoria);

  return (
    <MotionConfig reducedMotion="user">
      <div className="bg-[var(--color-bg)]">
        {/* Executive Split Hero Band */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#071422] via-[#0B1F33] to-[#0E2842] text-white border-b border-white/10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20 blur-3xl"
            style={{ background: 'radial-gradient(circle, #C8A236 0%, transparent 70%)' }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-16 w-80 h-80 rounded-full opacity-15 blur-3xl"
            style={{ background: 'radial-gradient(circle, #146B43 0%, transparent 70%)' }}
          />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-10 lg:pt-14 lg:pb-12 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
              {/* Left Strategic Copy & Dual CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-7 flex flex-col justify-between gap-6 py-1"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5">
                    <span className="h-[2px] w-7 bg-[#C8A236]" aria-hidden="true" />
                    <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#E5C76B]">
                      {isEs
                        ? 'Programa de Alianzas B2B · Brasil y Chile'
                        : 'Programa de Parcerias B2B · Brasil & Chile'}
                    </p>
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold leading-[1.1] text-white text-balance">
                    {isEs
                      ? 'Conecta tu empresa con clientes calificados que migran e invierten en Chile'
                      : 'Conecte sua empresa a clientes qualificados em mudança e negócios no Chile'}
                  </h1>
                  <p className="text-base text-slate-300 leading-relaxed max-w-2xl">
                    {isEs
                      ? 'Integra la red homologada de D&M Integra Chile: destaca tu marca en nuestra vitrina oficial, visualiza cobertura geográfica en Chile y opera sin cuota mensual en ambos países.'
                      : 'Integre a rede homologada da D&M Integra Chile: destaque sua marca na vitrine oficial, explore nossa cobertura geográfica no Chile e cresça no eixo Brasil–Chile sem mensalidade fixa.'}
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => scrollToSection('seja-parceiro')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#C8A236] hover:bg-[#b5912c] text-[#0B1F33] text-sm font-semibold shadow-[0_8px_22px_rgba(200,162,54,0.28)] transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap shrink-0"
                    >
                      <Handshake className="w-4 h-4" />
                      {isEs ? 'Quiero ser aliado homologado' : 'Quero ser parceiro homologado'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollToSection('mapa-parceiros')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-white/25 bg-white/[0.06] hover:bg-white/12 text-white text-sm font-semibold transition-all duration-150 whitespace-nowrap shrink-0"
                    >
                      <MapPin className="w-4 h-4 text-[#E5C76B]" />
                      {isEs ? 'Ver mapa en Chile' : 'Explorar mapa no Chile'}
                    </button>
                  </div>

                  <p className="text-xs text-slate-300 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="text-[#E5C76B] font-semibold">
                      {isEs ? 'Sin cuota mensual' : 'Zero mensalidade'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{isEs ? 'Revisión en 48h hábiles' : 'Análise em até 48h úteis'}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {isEs ? 'Acuerdos confidenciales en BRL / CLP / USD' : 'Sigilo comercial em BRL · CLP · USD'}
                    </span>
                  </p>
                </div>
              </motion.div>

              {/* Right Executive Editorial Visual */}
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-5 group relative rounded-2xl overflow-hidden border border-white/15 min-h-[260px] sm:min-h-[300px] bg-[#081726] shadow-[0_20px_48px_rgba(0,0,0,0.35)]"
              >
                <OptimizedImage
                  src={HERO_PARTNERS_IMAGE}
                  alt={
                    isEs
                      ? 'Sala ejecutiva de alianzas corporativas en Santiago con vista a la Cordillera de los Andes'
                      : 'Sala executiva de parcerias corporativas em Santiago com vista para a Cordilheira dos Andes'
                  }
                  priority
                  placeholderTone="dark"
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  containerClassName="relative w-full h-full min-h-[260px] sm:min-h-[300px]"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#0B1F33]/94 via-[#0B1F33]/35 to-transparent"
                />
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E5C76B]">
                    {isEs ? 'Ecosistema Corporativo · Santiago & Brasil' : 'Ecossistema Corporativo · Santiago & Brasil'}
                  </p>
                  <p className="text-sm font-medium text-white mt-1 leading-snug">
                    {isEs
                      ? 'Curaduría selectiva de despachos, traductores, corredoras y especialistas en relocation.'
                      : 'Curadoria seletiva de escritórios, tradutores, imobiliárias, contabilidades e especialistas em relocation.'}
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Full-Width 4-Column Quantified Network Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-8 border-t border-white/15">
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
                  {metrics.totalPartners}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {isEs ? 'Aliados homologados activos' : 'Parceiros homologados ativos'}
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-[#E5C76B] font-mono tabular-nums">
                  {metrics.uniqueCategories}/8
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {isEs ? 'Especialidades con demanda activa' : 'Especialidades com demanda ativa'}
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
                  {metrics.averageRating > 0 ? `${metrics.averageRating.toFixed(1)}/5` : '5.0/5'}
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {isEs ? 'Evaluación técnica de la red' : 'Avaliação técnica média da rede'}
                </p>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-white font-mono tabular-nums">
                  48h
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  {isEs ? 'Retorno inicial de postulaciones' : 'Prazo de retorno inicial (úteis)'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Top Category Filter System + Quick Section Navigation */}
        <section
          aria-label={isEs ? 'Filtrar aliados por categoría principal' : 'Filtrar parceiros por categoria principal'}
          className="bg-white dark:bg-[#0D1E31] border-b border-[#E5DFD2] dark:border-[#1C324B]"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 lg:pb-0">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8C6D14] dark:text-[#E5C76B] whitespace-nowrap shrink-0 pr-1">
                {isEs ? 'Categorías:' : 'Categorias:'}
              </span>
              {PARTNER_MACRO_GROUPS.map((group) => {
                const count = macroGroupCounts.get(group.id) || 0;
                const active = filterMacroGroup === group.id;
                return (
                  <button
                    key={group.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectTopCategory(group.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      active
                        ? 'bg-[#0B1F33] text-white dark:bg-[#C8A236] dark:text-[#0B1F33]'
                        : 'bg-[#F7F5F0] dark:bg-[#11263D] text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white hover:bg-[#EFECE3] dark:hover:bg-[#173352]'
                    }`}
                  >
                    <span>{isEs ? group.labelEs : group.labelPt}</span>
                    <span className={active ? 'opacity-80' : 'opacity-65'}>({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-[#F1EDE4] dark:border-[#1C324B] shrink-0">
              <button
                type="button"
                onClick={() => scrollToSection('mapa-parceiros')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#146B43] dark:text-emerald-400 hover:underline transition-colors whitespace-nowrap shrink-0"
              >
                <MapPin className="w-3.5 h-3.5" />
                {isEs ? 'Mapa en Chile' : 'Mapa no Chile'}
              </button>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={() => scrollToSection('parceiros-salvos')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:text-[#8C6D14] dark:hover:text-[#E5C76B] transition-colors whitespace-nowrap shrink-0 tabular-nums"
              >
                <Heart
                  className={`w-3.5 h-3.5 ${
                    savedPartners.length > 0 ? 'fill-[#C82333] text-[#C82333]' : 'text-[#8C6D14] dark:text-[#E5C76B]'
                  }`}
                />
                {isEs ? 'Salvos' : 'Salvos'} ({savedPartners.length})
              </button>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={() => scrollToSection('sinergia-ia')}
                className="text-xs font-semibold text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {isEs ? 'Sinergia IA' : 'Sinergia IA'}
              </button>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={() => scrollToSection('depoimentos-clientes')}
                className="text-xs font-semibold text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                {isEs ? 'Testimonios' : 'Depoimentos'}
              </button>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <button
                type="button"
                onClick={() => scrollToSection('seja-parceiro')}
                className="text-xs font-semibold text-[#8C6D14] dark:text-[#E5C76B] hover:underline whitespace-nowrap shrink-0"
              >
                {isEs ? 'Enviar propuesta' : 'Enviar proposta'}
              </button>
            </div>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 lg:py-14 space-y-16">
          {/* Quick-Access Saved Partners Section (Parceiros Salvos) */}
          <section
            id="parceiros-salvos"
            className="scroll-mt-24 bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl p-5 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] flex items-center justify-center shrink-0">
                  <Bookmark className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-base font-bold text-[#0B1F33] dark:text-white flex items-center gap-2">
                    <span>{isEs ? 'Aliados Guardados' : 'Parceiros Salvos'}</span>
                    <span className="text-xs font-mono font-semibold text-[#8C6D14] dark:text-[#E5C76B] tabular-nums">
                      ({savedPartners.length})
                    </span>
                  </h2>
                  <p className="text-xs text-[#4A5A6D] dark:text-slate-400">
                    {savedPartners.length > 0
                      ? isEs
                        ? 'Acceso rápido a tus aliados favoritos para comparar o contactar por WhatsApp.'
                        : 'Acesso rápido aos seus parceiros favoritados para comparar ou acionar no WhatsApp.'
                      : isEs
                        ? 'Haz clic en "Guardar" en cualquier tarjeta del directorio para armar tu lista rápida.'
                        : 'Clique em "Favoritar" em qualquer card do diretório para montar sua lista de acesso rápido.'}
                  </p>
                </div>
              </div>

              {savedPartners.length > 0 ? (
                <button
                  type="button"
                  onClick={clearFavorites}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4A5A6D] dark:text-slate-400 hover:text-[#C82333] dark:hover:text-red-400 transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {isEs ? 'Limpiar guardados' : 'Limpar salvos'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => scrollToSection('diretorio-parceiros')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C6D14] dark:text-[#E5C76B] hover:underline whitespace-nowrap shrink-0 self-start sm:self-center"
                >
                  {isEs ? 'Explorar directorio' : 'Explorar diretório'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {savedPartners.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-[#F1EDE4] dark:border-[#1C324B]">
                {savedPartners.map((partner) => {
                  const SavedIcon = getCategoryIcon(partner.categoria);
                  const safeSavedLogo = sanitizePartnerImageUrl(partner.logoUrl);
                  return (
                    <div
                      key={partner.id}
                      className="rounded-xl bg-[#FAF9F6] dark:bg-[#0A192A] border border-[#E5DFD2] dark:border-[#1C324B] p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-white dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] flex items-center justify-center overflow-hidden shrink-0">
                            {safeSavedLogo ? (
                              <OptimizedImage
                                src={safeSavedLogo}
                                alt={partner.nome}
                                sizes="40px"
                                containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                                className="max-w-full max-h-full object-contain p-1"
                              />
                            ) : (
                              <SavedIcon className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-semibold text-[#8C6D14] dark:text-[#E5C76B] truncate">
                              {translatePartnerCategory(partner.categoria, locale)}
                            </p>
                            <h3 className="text-sm font-bold text-[#0B1F33] dark:text-white truncate">
                              {partner.nome}
                            </h3>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeFavorite(partner.id)}
                          aria-label={isEs ? `Quitar ${partner.nome} de guardados` : `Remover ${partner.nome} dos salvos`}
                          title={isEs ? 'Quitar de guardados' : 'Remover dos salvos'}
                          className="p-1.5 rounded-lg text-[#C82333] hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                        >
                          <Heart className="w-4 h-4 fill-[#C82333]" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-[#EFECE3] dark:border-[#1C324B] text-xs">
                        {partner.whatsapp ? (
                          <a
                            href={buildWhatsAppUrl(partner.whatsapp, buildReferralMessage(partner))}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-semibold text-[#146B43] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-[#4A5A6D] dark:text-slate-400 truncate">
                            {translatePartnerCountry(partner.pais, locale)}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedPartner(partner)}
                          className="font-semibold text-[#0B1F33] dark:text-[#E5C76B] hover:text-[#8C6D14] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          {isEs ? 'Ver ficha →' : 'Ver detalhes →'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Interactive Chile Partner Geolocation Map (Google Maps Platform) */}
          <PartnerGeolocationMap
            partners={partnersPublic}
            locale={locale}
            externalMacroGroup={filterMacroGroup}
            onSelectPartner={(partner) => setSelectedPartner(partner)}
            buildReferralMessage={buildReferralMessage}
          />

          {/* B2B Partner Value Proposition — Asymmetric Bento Grid */}
          <section id="programa-b2b" className="scroll-mt-24 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="brand-kicker mb-1.5">
                  {isEs ? 'Beneficios para empresas y especialistas' : 'Benefícios para empresas e especialistas'}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] dark:text-white text-balance">
                  {isEs
                    ? 'Por qué los mejores especialistas eligen operar con D&M Integra Chile'
                    : 'Por que especialistas de referência escolhem atuar com a D&M Integra Chile'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => scrollToSection('seja-parceiro')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#8C6D14] dark:text-[#E5C76B] hover:text-[#0B1F33] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 self-start lg:self-end"
              >
                {isEs ? 'Postular mi empresa ahora' : 'Cadastrar minha empresa agora'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Bento 1: Qualified Client Pipeline (Wide) */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-7 bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] flex items-center justify-center text-[#8C6D14] dark:text-[#E5C76B]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0B1F33] dark:text-white font-brand-sans">
                    {isEs
                      ? 'Flujo continuo de clientes con necesidad real y presupuesto definido'
                      : 'Fluxo qualificado de clientes com demanda real em cada fase da mudança'}
                  </h3>
                  <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                    {isEs
                      ? 'Nuestros clientes llegan perfilados desde el Diagnóstico Inteligente y el acompañamiento de visa. Recibes contactos en el momento exacto en que necesitan traducir documentos, arrendar vivienda, abrir una empresa SpA o contratar salud.'
                      : 'Nossos clientes chegam mapeados pelo Diagnóstico Inteligente e pelo pipeline de assessoria migratória. Sua empresa é acionada no momento exato de decisão — sem perder tempo com leads curiosos.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-[#F1EDE4] dark:border-[#1C324B]">
                  <div>
                    <p className="text-xs font-mono font-bold text-[#8C6D14] dark:text-[#E5C76B]">01 · BRASIL</p>
                    <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-0.5">
                      {isEs ? 'Documentos, apostilla y traducción' : 'Cartório, apostilamento e tradução'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-[#8C6D14] dark:text-[#E5C76B]">02 · TRANSICIÓN</p>
                    <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-0.5">
                      {isEs ? 'Visado, seguros y planificación' : 'Visto, seguros, jurídico e planejamento'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-mono font-bold text-[#8C6D14] dark:text-[#E5C76B]">03 · CHILE</p>
                    <p className="text-xs text-[#4A5A6D] dark:text-slate-400 mt-0.5">
                      {isEs ? 'Vivienda, empresa SpA, colegios' : 'Imóveis, empresa SpA, escolas e saúde'}
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Bento 2: Brand Showcase + AI Synergy (Navy Accent) */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.38, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-5 bg-[#0B1F33] text-white border border-[#0B1F33] dark:border-[#1C324B] rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-[#E5C76B]">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-white font-brand-sans">
                    {isEs
                      ? 'Tu logo en la vitrina oficial + recomendación inteligente por IA'
                      : 'Sua marca na vitrine oficial + recomendação inteligente via IA'}
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {isEs
                      ? 'Además de figurar con tu logo y enlace directo a WhatsApp, nuestro Analizador de Sinergia con IA recomienda automáticamente a tu empresa cuando el perfil del cliente coincide con tu especialidad.'
                      : 'Além de exibir sua logo e botão direto de WhatsApp no diretório público, nosso Analisador de Sinergia com IA recomenda sua empresa automaticamente para clientes compatíveis.'}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/15 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#E5C76B] font-semibold">
                    {isEs ? 'Sello Oficial Homologado' : 'Selo Oficial Homologado'}
                  </span>
                  <button
                    type="button"
                    onClick={() => scrollToSection('sinergia-ia')}
                    className="text-white hover:text-[#E5C76B] font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    {isEs ? 'Probar módulo IA →' : 'Ver módulo IA →'}
                  </button>
                </div>
              </motion.div>

              {/* Bento 3: Zero Monthly Fee & Commercial Confidentiality */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.38, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-5 bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl p-6 sm:p-8 space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] flex items-center justify-center text-[#0B1F33] dark:text-[#E5C76B]">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-bold text-[#0B1F33] dark:text-white font-brand-sans">
                  {isEs
                    ? 'Cero costo fijo y confidencialidad comercial'
                    : 'Zero mensalidade fixa e sigilo comercial absoluto'}
                </h3>
                <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                  {isEs
                    ? 'No cobramos mensualidad por presencia en la red. Los acuerdos de beneficios al cliente o referidos en BRL, CLP o USD quedan resguardados exclusivamente en nuestro panel interno.'
                    : 'Não cobramos mensalidade para compor a rede. Suas tabelas referenciais, condições preferenciais ou acordos de indicação em BRL, CLP ou USD permanecem em sigilo interno.'}
                </p>
              </motion.div>

              {/* Bento 4: 4 Executive Pillars */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.38, delay: 0.14, ease: [0.22, 1, 0.36, 1] }}
                className="lg:col-span-7 bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-2 gap-5"
              >
                <div className="flex items-start gap-3">
                  <Award className="w-5 h-5 text-[#8C6D14] dark:text-[#E5C76B] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#0B1F33] dark:text-white">
                      {isEs ? 'Posicionamiento de autoridad' : 'Autoridade perante o cliente'}
                    </h4>
                    <p className="text-xs text-[#4A5A6D] dark:text-slate-300 mt-1 leading-relaxed">
                      {isEs
                        ? 'Los clientes te contactan ya con confianza institucional por la recomendación directa de nuestra consultora.'
                        : 'O cliente chega já confiando no seu trabalho graças à curadoria e indicação direta da consultoria.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Globe2 className="w-5 h-5 text-[#8C6D14] dark:text-[#E5C76B] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#0B1F33] dark:text-white">
                      {isEs ? 'Alcance binacional BR–CL' : 'Alcance binacional BR–CL'}
                    </h4>
                    <p className="text-xs text-[#4A5A6D] dark:text-slate-300 mt-1 leading-relaxed">
                      {isEs
                        ? 'Sitio bilingüe (portugués y español chileno) listo para captar familias, ejecutivos e inversionistas.'
                        : 'Plataforma bilíngue (português e espanhol chileno) desenhada para famílias, profissionais e investidores.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-[#8C6D14] dark:text-[#E5C76B] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#0B1F33] dark:text-white">
                      {isEs ? 'Aprobación ágil en 48h hábiles' : 'Aprovação ágil em até 48h úteis'}
                    </h4>
                    <p className="text-xs text-[#4A5A6D] dark:text-slate-300 mt-1 leading-relaxed">
                      {isEs
                        ? 'Proceso sin burocracia: analizamos tu propuesta y coordinamos el alta directamente con los socios.'
                        : 'Processo sem burocracia: analisamos sua proposta e fazemos o alinhamento direto com a diretoria.'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Briefcase className="w-5 h-5 text-[#8C6D14] dark:text-[#E5C76B] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#0B1F33] dark:text-white">
                      {isEs ? 'Sin exclusividad restrictiva' : 'Sem exclusividade restritiva'}
                    </h4>
                    <p className="text-xs text-[#4A5A6D] dark:text-slate-300 mt-1 leading-relaxed">
                      {isEs
                        ? 'Mantienes total autonomía operativa y comercial sobre tu cartera y precios de atención.'
                        : 'Você mantém total autonomia sobre sua operação, agenda e carteira de clientes.'}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </section>

          {/* High-Demand Specialties — Interactive Partner Recruitment Cards */}
          <section id="areas-demanda" className="scroll-mt-24 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="brand-kicker mb-1.5">
                  {isEs ? 'Especialidades con demanda abierta' : 'Especialidades com demanda aberta'}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] dark:text-white text-balance">
                  {isEs
                    ? '¿Actúas en alguna de estas áreas? Tenemos clientes buscando tu servicio'
                    : 'Atua em alguma destas áreas? Temos clientes buscando seu serviço'}
                </h2>
              </div>
              <p className="text-xs text-[#4A5A6D] dark:text-slate-400">
                {isEs
                  ? 'Selecciona tu especialidad para prellenar tu postulación'
                  : 'Clique na sua área para pré-preencher a candidatura'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {HIGH_DEMAND_AREAS.map((area, idx) => {
                const AreaIcon = getCategoryIcon(area.category);
                const activeCount = categoryCounts.get(area.category) || 0;

                return (
                  <motion.div
                    key={area.category}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.12 }}
                    transition={{
                      duration: 0.34,
                      delay: Math.min(idx * 0.04, 0.2),
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] hover:border-[#C8A236] rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="w-9 h-9 rounded-lg bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] flex items-center justify-center text-[#0B1F33] dark:text-[#E5C76B]">
                          <AreaIcon className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />
                        </div>
                        <span className="text-[11px] font-mono font-semibold text-[#4A5A6D] dark:text-slate-400 tabular-nums">
                          {activeCount > 0
                            ? isEs
                              ? `${activeCount} activo(s)`
                              : `${activeCount} ativo(s)`
                            : isEs
                              ? 'Cupos abiertos'
                              : 'Vagas abertas'}
                        </span>
                      </div>

                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8C6D14] dark:text-[#E5C76B]">
                          {isEs ? area.stageEs : area.stagePt}
                        </p>
                        <h3 className="text-sm font-bold text-[#0B1F33] dark:text-white mt-0.5 leading-snug">
                          {translatePartnerCategory(area.category, locale)}
                        </h3>
                        <p className="text-xs text-[#4A5A6D] dark:text-slate-300 mt-1.5 leading-relaxed">
                          {isEs ? area.demandEs : area.demandPt}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyForArea(area)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B1F33] dark:text-[#E5C76B] hover:text-[#8C6D14] dark:hover:text-white transition-colors pt-3 border-t border-[#F1EDE4] dark:border-[#1C324B] whitespace-nowrap shrink-0"
                    >
                      {isEs ? 'Postular en esta área' : 'Candidatar nesta área'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </section>

          {/* AI Partner Synergy Module */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <PartnerSynergyAnalyzer
              partnersPublic={partnersPublic}
              locale={locale}
              onSelectPartner={(partner) => setSelectedPartner(partner)}
              onResultChange={setSynergyResult}
            />
          </motion.div>

          {/* Directory & Interactive Filter Section */}
          <section id="diretorio-parceiros" className="scroll-mt-24 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <p className="brand-kicker mb-1.5">
                  {isEs ? 'Vitrina oficial verificada' : 'Vitrine oficial verificada'}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] dark:text-white">
                  {isEs ? 'Aliados homologados por especialidad' : 'Parceiros homologados por área'}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {filterMacroGroup !== 'Todos' && (
                  <button
                    type="button"
                    onClick={() => setFilterMacroGroup('Todos')}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] text-xs font-semibold text-[#0B1F33] dark:text-[#E5C76B]"
                  >
                    <span>{getPartnerMacroGroupLabel(filterMacroGroup, locale)}</span>
                    <X className="w-3 h-3" />
                  </button>
                )}
                <p className="text-xs text-[#4A5A6D] dark:text-slate-400 tabular-nums">
                  {isEs
                    ? `Mostrando ${filteredPartners.length} de ${partnersPublic.length} aliado(s)`
                    : `Exibindo ${filteredPartners.length} de ${partnersPublic.length} parceiro(s)`}
                </p>
              </div>
            </div>

            {/* Search + Country Segmented Control + Sort */}
            <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-4 sm:p-5 space-y-4">
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
                    className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] text-sm text-[#0B1523] dark:text-slate-100 bg-white dark:bg-[#081524] placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label={isEs ? 'Limpiar búsqueda' : 'Limpar busca'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Country Segmented Control */}
                <div
                  role="group"
                  aria-label={isEs ? 'Filtrar por país' : 'Filtrar por país'}
                  className="inline-flex items-center p-1 rounded-lg bg-[#F4F1EA] dark:bg-[#081524] border border-[#E5DFD2] dark:border-[#1C324B] overflow-x-auto"
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
                            ? 'bg-[#0B1F33] text-white dark:bg-[#C8A236] dark:text-[#0B1F33]'
                            : 'text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white'
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
                  className="px-3.5 py-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] text-xs font-semibold bg-white dark:bg-[#081524] text-[#0B1F33] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
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
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#F1EDE4] dark:border-[#1C324B]">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterCat('Todas');
                      setFilterMacroGroup('Todos');
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                      filterCat === 'Todas' && filterMacroGroup === 'Todos'
                        ? 'bg-[#0B1F33] text-white dark:bg-[#C8A236] dark:text-[#0B1F33]'
                        : 'bg-[#F7F5F0] dark:bg-[#11263D] text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white hover:bg-[#EFECE3] dark:hover:bg-[#173352]'
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
                        onClick={() => {
                          setFilterMacroGroup('Todos');
                          setFilterCat(active ? 'Todas' : cat);
                        }}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          active
                            ? 'bg-[#0B1F33] text-white dark:bg-[#C8A236] dark:text-[#0B1F33]'
                            : 'bg-[#F7F5F0] dark:bg-[#11263D] text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white hover:bg-[#EFECE3] dark:hover:bg-[#173352]'
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
                      className="ml-auto text-xs font-semibold text-[#8C6D14] dark:text-[#E5C76B] hover:underline whitespace-nowrap shrink-0"
                    >
                      {isEs ? 'Limpiar filtros' : 'Limpar filtros'}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Partner Grid — Uses animate (not whileInView) so dynamically filtered cards never get stuck hidden */}
            {filteredPartners.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
                className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-10 text-center space-y-3"
              >
                <p className="text-base font-semibold text-[#0B1F33] dark:text-white">
                  {isEs
                    ? 'No encontramos aliados con estos criterios.'
                    : 'Nenhum parceiro encontrado para os filtros aplicados.'}
                </p>
                <p className="text-sm text-[#4A5A6D] dark:text-slate-300 max-w-md mx-auto">
                  {isEs
                    ? 'Intenta limpiar los filtros o postula tu empresa si ofreces este servicio entre Brasil y Chile.'
                    : 'Tente limpar os filtros ou cadastre sua empresa caso atue nesta especialidade no eixo Brasil–Chile.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1F33] text-xs font-semibold hover:opacity-95 whitespace-nowrap shrink-0"
                    >
                      {isEs ? 'Ver todos los aliados' : 'Ver todos os parceiros'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => scrollToSection('seja-parceiro')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] text-xs font-semibold text-[#0B1F33] dark:text-slate-200 hover:bg-[#F7F5F0] dark:hover:bg-[#11263D] whitespace-nowrap shrink-0"
                  >
                    {isEs ? 'Postular mi empresa' : 'Cadastrar minha empresa'}
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                  {filteredPartners.map((p, index) => {
                    const Icon = getCategoryIcon(p.categoria);
                    const safeExternalUrl = normalizePartnerExternalUrl(p.siteInstagram);
                    const safeLogoUrl = sanitizePartnerImageUrl(p.logoUrl);
                    const synergyMatch = synergyByPartnerId.get(p.id);
                    const saved = isFavorite(p.id);

                    return (
                      <motion.article
                        key={p.id}
                        layout
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{
                          duration: 0.34,
                          delay: Math.min(index * 0.04, 0.2),
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className={`bg-white dark:bg-[#0D1E31] border rounded-xl p-6 flex flex-col justify-between transition-colors ${
                          synergyMatch
                            ? 'border-[#C8A236] ring-1 ring-[#C8A236]/25'
                            : 'border-[#E5DFD2] dark:border-[#1C324B] hover:border-[#C8A236]/80'
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-3 mb-4">
                            {safeLogoUrl ? (
                              <div className="h-14 w-24 rounded-lg bg-white border border-[#E5DFD2] dark:border-[#253D58] flex items-center justify-center overflow-hidden shrink-0">
                                <OptimizedImage
                                  src={safeLogoUrl}
                                  alt={p.nome}
                                  sizes="96px"
                                  containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                                  className="max-w-full max-h-full object-contain p-1.5"
                                />
                              </div>
                            ) : (
                              <div className="w-11 h-11 rounded-lg bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] flex items-center justify-center text-[#0B1F33] dark:text-[#E5C76B] shrink-0">
                                <Icon className="w-5 h-5 text-[#8C6D14] dark:text-[#E5C76B]" />
                              </div>
                            )}
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1 text-xs font-semibold text-[#0B1F33] dark:text-slate-100 font-mono tabular-nums">
                                  <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                                  <span>{Number(p.avaliacao || 5).toFixed(1)}/5</span>
                                </div>
                                <button
                                  type="button"
                                  aria-pressed={saved}
                                  onClick={() => toggleFavorite(p.id)}
                                  title={
                                    saved
                                      ? isEs
                                        ? 'Quitar de guardados'
                                        : 'Remover dos salvos'
                                      : isEs
                                        ? 'Guardar aliado'
                                        : 'Favoritar parceiro'
                                  }
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                                    saved
                                      ? 'border-[#C82333]/35 bg-red-50 dark:bg-red-950/40 text-[#C82333] dark:text-red-300'
                                      : 'border-[#E5DFD2] dark:border-[#253D58] bg-[#FAF9F6] dark:bg-[#11263D] text-[#4A5A6D] dark:text-slate-300 hover:border-[#C8A236] hover:text-[#0B1F33] dark:hover:text-white'
                                  }`}
                                >
                                  <Heart
                                    className={`w-3.5 h-3.5 ${saved ? 'fill-[#C82333] text-[#C82333] dark:fill-red-400 dark:text-red-400' : ''}`}
                                  />
                                  <span>
                                    {saved
                                      ? isEs
                                        ? 'Guardado'
                                        : 'Salvo'
                                      : isEs
                                        ? 'Guardar'
                                        : 'Favoritar'}
                                  </span>
                                </button>
                              </div>
                              {synergyMatch && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold font-mono tabular-nums text-[#146B43] dark:text-emerald-400">
                                  <Sparkles className="w-3 h-3 text-[#C8A236]" />
                                  Sinergia {synergyMatch.score}%
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#4A5A6D] dark:text-slate-400 mb-1.5">
                            <span className="font-semibold text-[#8C6D14] dark:text-[#E5C76B]">
                              {translatePartnerCategory(p.categoria, locale)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-medium text-[#0B1F33] dark:text-slate-200">
                              {translatePartnerCountry(p.pais, locale)}
                            </span>
                          </div>

                          <h3 className="text-lg font-bold text-[#0B1F33] dark:text-white font-brand-sans leading-snug mb-2">
                            {p.nome}
                          </h3>

                          <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed mb-4">
                            {p.descricaoPublica}
                          </p>

                          {p.cidadeRegiao && (
                            <p className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{p.cidadeRegiao}</span>
                            </p>
                          )}
                        </div>

                        <div className="pt-4 border-t border-[#F1EDE4] dark:border-[#1C324B] flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-3">
                            {p.whatsapp && (
                              <a
                                href={buildWhatsAppUrl(p.whatsapp, buildReferralMessage(p))}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#146B43] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
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
                                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white hover:underline whitespace-nowrap shrink-0"
                              >
                                {isEs ? 'Sitio / IG' : 'Site / IG'}
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedPartner(p)}
                            className="text-xs font-semibold text-[#0B1F33] dark:text-[#E5C76B] hover:text-[#8C6D14] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                          >
                            {isEs ? 'Ver ficha →' : 'Ver detalhes →'}
                          </button>
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            {/* Inline B2B Conversion Prompt Below Directory */}
            <div className="rounded-xl bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm text-[#0B1F33] dark:text-white">
                <span className="font-semibold">
                  {isEs ? '¿Tu marca aún no aparece aquí?' : 'Sua marca ainda não está na vitrine?'}
                </span>{' '}
                <span className="text-[#4A5A6D] dark:text-slate-300">
                  {isEs
                    ? 'Envía tu propuesta comercial y suma tu logo a nuestra red binacional.'
                    : 'Envie sua proposta comercial e coloque sua logo diante de clientes em mudança para o Chile.'}
                </span>
              </p>
              <button
                type="button"
                onClick={() => scrollToSection('seja-parceiro')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#8C6D14] dark:text-[#E5C76B] hover:text-[#0B1F33] dark:hover:text-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                {isEs ? 'Solicitar homologación' : 'Solicitar homologação'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </section>

          {/* 4-Step Partner Onboarding Timeline */}
          <section className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl p-6 sm:p-10">
            <div className="max-w-2xl mb-8">
              <p className="brand-kicker mb-1.5">
                {isEs ? 'Proceso de acreditación' : 'Processo de credenciamento'}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] dark:text-white text-balance">
                {isEs
                  ? 'Del registro a las primeras indicaciones en cuatro pasos claros'
                  : 'Do cadastro às primeiras indicações em quatro etapas transparentes'}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {onboardingSteps.map((step, idx) => (
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{
                    duration: 0.34,
                    delay: idx * 0.05,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="space-y-2 pt-4 border-t border-[#E5DFD2] dark:border-[#1C324B]"
                >
                  <p className="text-sm font-mono font-bold text-[#8C6D14] dark:text-[#E5C76B] tabular-nums">{step.num}</p>
                  <h3 className="text-base font-bold text-[#0B1F33] dark:text-white">{step.title}</h3>
                  <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">{step.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Client Integration Testimonials Carousel + Webcam Short Video Studio */}
          <div id="depoimentos-clientes" className="scroll-mt-24">
            <ClientTestimonialsCarousel locale={locale} />
          </div>

          {/* Seja um Parceiro Homologado — Architectural Split Layout with LIVE Showcase Preview */}
          <motion.section
            id="seja-parceiro"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="scroll-mt-24 bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl overflow-hidden"
          >
            <BrandRibbon className="h-[3px] w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Left Navy Value Column + Real-Time Live Partner Card Preview */}
              <div className="lg:col-span-5 bg-[#0B1F33] text-white p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-8">
                <div className="space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#E5C76B]">
                    {isEs ? 'Acreditación B2B · Sin costo fijo' : 'Credenciamento B2B · Zero mensalidade'}
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                    {isEs ? 'Sé un Aliado Homologado' : 'Seja um Parceiro Homologado'}
                  </h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {isEs
                      ? 'Completa los datos de tu empresa y sube tu logo. Nuestra dirección revisará tu postulación en hasta 48 horas hábiles.'
                      : 'Preencha os dados da sua empresa e envie sua logo. Nossa diretoria avalia sua candidatura e retorna em até 48 horas úteis.'}
                  </p>

                  {/* Real-Time Live Showcase Card Preview */}
                  <div className="pt-3 space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E5C76B]">
                      {isEs ? 'Vista previa en la vitrina oficial' : 'Pré-visualização na vitrine oficial'}
                    </p>
                    <div className="rounded-xl bg-white text-[#0B1F33] p-4 border border-white/20 shadow-lg space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        {safeFormLogoPreview ? (
                          <div className="h-12 w-20 rounded-lg bg-white border border-[#E5DFD2] flex items-center justify-center overflow-hidden shrink-0">
                            <OptimizedImage
                              src={safeFormLogoPreview}
                              alt={nomeEmpresa || 'Logo'}
                              sizes="80px"
                              containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                              className="max-w-full max-h-full object-contain p-1"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-[#F7F5F0] border border-[#E5DFD2] flex items-center justify-center shrink-0">
                            <PreviewCategoryIcon className="w-5 h-5 text-[#8C6D14]" />
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-xs font-semibold text-[#0B1F33] font-mono tabular-nums">
                          <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                          <span>5.0/5</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-[11px] text-[#4A5A6D]">
                          <span className="font-semibold text-[#8C6D14]">
                            {translatePartnerCategory(categoria, locale)}
                          </span>{' '}
                          ·{' '}
                          <span className="font-medium text-[#0B1F33]">
                            {translatePartnerCountry(pais, locale)}
                          </span>
                        </p>
                        <p className="text-base font-bold text-[#0B1F33] leading-snug mt-0.5 truncate">
                          {nomeEmpresa.trim() ||
                            (isEs ? 'Nombre de tu empresa aquí' : 'Nome da sua empresa aqui')}
                        </p>
                        <p className="text-xs text-[#4A5A6D] mt-1 line-clamp-2 leading-relaxed">
                          {mensagem.trim() ||
                            (isEs
                              ? 'Tu presentación institucional aparecerá destacada para los clientes en proceso de migración y relocation.'
                              : 'Sua apresentação institucional aparecerá em destaque para clientes em processo de visto e relocation.')}
                        </p>
                      </div>

                      <div className="pt-2.5 border-t border-[#F1EDE4] flex items-center justify-between text-[11px]">
                        <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {cidade.trim() || (pais === 'Brasil' ? 'São Paulo / Online' : 'Santiago / Online')}
                          </span>
                        </span>
                        <span className="font-semibold text-[#146B43] whitespace-nowrap shrink-0">
                          WhatsApp · {isEs ? 'Ver ficha →' : 'Ver detalhes →'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/15 space-y-2.5 text-xs text-slate-200">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#E5C76B] shrink-0 mt-0.5" />
                      <span>
                        {isEs
                          ? 'Derivaciones calificadas desde el Diagnóstico Inteligente y consultoría.'
                          : 'Indicações qualificadas vindas do Diagnóstico Inteligente e consultoria.'}
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-[#E5C76B] shrink-0 mt-0.5" />
                      <span>
                        {isEs
                          ? 'Condiciones comerciales y acuerdos privados jamás se exponen al público.'
                          : 'Condições comerciais e acordos mantidos em sigilo no painel interno.'}
                      </span>
                    </div>
                  </div>
                </div>

                {empresa.whatsapp && (
                  <div className="pt-5 border-t border-white/15 space-y-2">
                    <p className="text-xs text-slate-300">
                      {isEs ? '¿Prefieres conversar antes de postular?' : 'Prefere alinhar antes de enviar?'}
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
              <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10">
                {prefilledNotice && (
                  <div className="mb-5 px-4 py-3 rounded-xl bg-[#FBF8EE] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] text-xs text-[#0B1F33] dark:text-slate-100 flex items-center justify-between gap-3">
                    <span>
                      {isEs ? 'Área preseleccionada:' : 'Área pré-selecionada:'}{' '}
                      <strong className="text-[#8C6D14] dark:text-[#E5C76B]">
                        {translatePartnerCategory(prefilledNotice, locale)}
                      </strong>
                      . {isEs ? 'Completa tus datos para enviar la candidatura.' : 'Complete seus dados para enviar a candidatura.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrefilledNotice(null)}
                      aria-label={isEs ? 'Cerrar aviso' : 'Fechar aviso'}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-white shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {submittedId && (
                  <div className="mb-6 p-4 sm:p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-[#146B43] dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-bold">
                          {isEs ? 'Propuesta recibida con éxito' : 'Proposta recebida com sucesso'}
                        </p>
                        <p className="text-xs text-emerald-900 dark:text-emerald-200 mt-1">
                          {isEs ? 'Protocolo de registro:' : 'Protocolo de registro:'}{' '}
                          <span className="font-mono font-semibold">{submittedId}</span>.{' '}
                          {isEs
                            ? 'Nuestro equipo revisará los antecedentes en hasta 48h hábiles.'
                            : 'Nossa diretoria analisará os dados e retornará em até 48h úteis.'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCopyText(submittedId, 'protocolo')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-[#0D1E31] text-xs font-semibold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/50 dark:hover:bg-emerald-900/40 whitespace-nowrap shrink-0 self-start sm:self-center"
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
                  <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-[#C82333] dark:text-red-300 text-sm font-medium">
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
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-empresa">
                      {isEs ? 'Nombre de empresa o profesional *' : 'Nome da empresa ou profissional *'}
                    </label>
                    <input
                      ref={companyInputRef}
                      id="p-empresa"
                      required
                      maxLength={140}
                      value={nomeEmpresa}
                      onChange={(e) => setNomeEmpresa(e.target.value)}
                      placeholder={isEs ? 'Ej.: Estudio Jurídico Andes' : 'Ex.: Andes Traduções Juramentadas'}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-cat">
                      {isEs ? 'Especialidad *' : 'Categoria *'}
                    </label>
                    <select
                      id="p-cat"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value as PartnerCategory)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] text-sm bg-white dark:bg-[#081524] text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    >
                      {PARTNER_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {translatePartnerCategory(c, locale)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-pais">
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
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] text-sm bg-white dark:bg-[#081524] text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    >
                      <option value="Brasil">Brasil</option>
                      <option value="Chile">Chile</option>
                      <option value="Ambos">{isEs ? 'Brasil y Chile' : 'Brasil & Chile'}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-cidade">
                      {isEs ? 'Ciudad / Región' : 'Cidade / Região'}
                    </label>
                    <input
                      id="p-cidade"
                      maxLength={120}
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder={isEs ? 'Ej.: Santiago (Providencia) / Online' : 'Ex.: São Paulo - SP / Santiago / Online'}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-resp">
                      {isEs ? 'Nombre del responsable *' : 'Nome do responsável *'}
                    </label>
                    <input
                      id="p-resp"
                      required
                      maxLength={140}
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-whats">
                      WhatsApp *
                    </label>
                    <input
                      id="p-whats"
                      required
                      maxLength={40}
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatPhoneByCountry(e.target.value, pais))}
                      placeholder={pais === 'Chile' ? '+56 9 8888 0000' : '+55 (11) 99999-0000'}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm tabular-nums text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-email">
                      {isEs ? 'Correo corporativo *' : 'E-mail corporativo *'}
                    </label>
                    <input
                      id="p-email"
                      type="email"
                      required
                      maxLength={200}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contato@empresa.com"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-moeda">
                        {isEs ? 'Moneda' : 'Moeda'}
                      </label>
                      <select
                        id="p-moeda"
                        value={moeda}
                        onChange={(e) => setMoeda(e.target.value as CurrencyCode)}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] text-sm bg-white dark:bg-[#081524] text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                      >
                        <option value="BRL">BRL (R$)</option>
                        <option value="CLP">CLP ($)</option>
                        <option value="USD">USD (US$)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-site">
                        {isEs ? 'Sitio o Instagram' : 'Site ou Instagram'}
                      </label>
                      <input
                        id="p-site"
                        maxLength={200}
                        value={siteOuInstagram}
                        onChange={(e) => setSiteOuInstagram(e.target.value)}
                        placeholder="@perfil ou https://..."
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                      />
                    </div>
                  </div>

                  {/* Optional Partner Logo / Representative Image Upload */}
                  <div className="md:col-span-2 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#0A192A] p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-[#0B1F33] dark:text-slate-200" htmlFor="p-logo-url">
                        {isEs
                          ? 'Logo o imagen representativa (aparecerá en la vista previa y vitrina)'
                          : 'Logo ou imagem representativa (aparece na prévia e na vitrine)'}
                      </label>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            setLogoUrl('');
                            setLogoUploadError(null);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#C82333] dark:text-red-400 hover:underline"
                        >
                          <X className="w-3.5 h-3.5" />
                          {isEs ? 'Quitar imagen' : 'Remover imagem'}
                        </button>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="h-14 w-24 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] bg-white flex items-center justify-center overflow-hidden shrink-0">
                        {safeFormLogoPreview ? (
                          <OptimizedImage
                            src={safeFormLogoPreview}
                            alt={nomeEmpresa || 'Logo'}
                            sizes="96px"
                            containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                            className="max-w-full max-h-full object-contain p-1.5"
                          />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-400" />
                        )}
                      </div>

                      <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                          className="hidden"
                          onChange={(e) => void handleProposalLogoFile(e.target.files)}
                        />
                        <button
                          type="button"
                          disabled={uploadingLogo}
                          onClick={() => logoFileInputRef.current?.click()}
                          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#11263D] hover:bg-slate-50 dark:hover:bg-[#173352] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          {uploadingLogo ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              {isEs ? 'Optimizando...' : 'Otimizando...'}
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              {isEs ? 'Subir logo / imagen' : 'Enviar logo / imagem'}
                            </>
                          )}
                        </button>
                        <input
                          id="p-logo-url"
                          type="text"
                          value={
                            logoUrl.startsWith('data:')
                              ? isEs
                                ? '(Imagen cargada y optimizada en WebP)'
                                : '(Imagem carregada e otimizada em WebP)'
                              : logoUrl
                          }
                          readOnly={logoUrl.startsWith('data:')}
                          onChange={(e) => {
                            if (!e.target.value.startsWith('(')) {
                              setLogoUrl(e.target.value);
                            }
                          }}
                          placeholder={
                            isEs
                              ? 'O pega una URL pública de tu logo (https://...)'
                              : 'Ou cole a URL pública da sua logo (https://...)'
                          }
                          className="flex-1 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-xs text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                        />
                      </div>
                    </div>

                    {logoUploadError && (
                      <p className="text-xs font-medium text-[#C82333] dark:text-red-400">{logoUploadError}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-prop">
                      {isEs
                        ? 'Propuesta comercial, plazos y beneficios para clientes'
                        : 'Proposta de valores, prazos e benefícios para clientes'}
                    </label>
                    <textarea
                      id="p-prop"
                      rows={3}
                      maxLength={2500}
                      value={proposta}
                      onChange={(e) => setProposta(e.target.value)}
                      placeholder={
                        isEs
                          ? 'Describe tarifas referenciales, tiempos de entrega y condiciones especiales para clientes derivados...'
                          : 'Descreva prazos de entrega, tabela referencial e condições especiais para clientes indicados...'
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1.5" htmlFor="p-msg">
                      {isEs
                        ? 'Presentación institucional y diferenciales'
                        : 'Apresentação institucional e diferenciais'}
                    </label>
                    <textarea
                      id="p-msg"
                      rows={2}
                      maxLength={2500}
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      placeholder={
                        isEs
                          ? 'Experiencia con brasileños en Chile, certificaciones, idiomas de atención...'
                          : 'Experiência com brasileiros no Chile, registros profissionais, atendimento em português...'
                      }
                      className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                    />
                  </div>

                  <div className="md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isEs
                        ? 'Sin cuota mensual · Revisión confidencial en hasta 48h hábiles.'
                        : 'Zero mensalidade · Análise confidencial em até 48h úteis.'}
                    </p>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1F33] disabled:opacity-50 hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {isEs ? 'Enviando propuesta...' : 'Enviando proposta...'}
                        </>
                      ) : (
                        <>
                          {isEs ? 'Enviar propuesta de alianza' : 'Enviar proposta de parceria'}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.section>

          {/* Interactive B2B Partner FAQ Accordion */}
          <section id="faq-parceiros" className="scroll-mt-24 space-y-6">
            <div className="max-w-2xl">
              <p className="brand-kicker mb-1.5">
                {isEs ? 'Preguntas frecuentes de aliados' : 'Perguntas frequentes de parceiros'}
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] dark:text-white">
                {isEs
                  ? 'Dudas habituales sobre el programa B2B'
                  : 'Dúvidas frequentes sobre o programa B2B'}
              </h2>
            </div>

            <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl divide-y divide-[#E5DFD2] dark:divide-[#1C324B]">
              {partnerFaqs.map((item, idx) => {
                const isOpen = openFaqIdx === idx;
                return (
                  <div key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                      aria-expanded={isOpen}
                      className="w-full px-6 py-5 flex items-center justify-between gap-4 text-left hover:bg-[#FAF9F6] dark:hover:bg-[#11263D] transition-colors"
                    >
                      <span className="text-sm sm:text-base font-bold text-[#0B1F33] dark:text-white leading-snug">
                        {item.q}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B] shrink-0 transition-transform duration-200 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p className="px-6 pb-5 text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed max-w-4xl">
                            {item.a}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Partner Details Modal with Escape Key + Framer Motion Entrance */}
        <AnimatePresence>
          {selectedPartner && (() => {
            const Icon = getCategoryIcon(selectedPartner.categoria);
            const safeExternal = normalizePartnerExternalUrl(selectedPartner.siteInstagram);
            const safeModalLogo = sanitizePartnerImageUrl(selectedPartner.logoUrl);
            const referralText = buildReferralMessage(selectedPartner);
            const modalSaved = isFavorite(selectedPartner.id);

            return (
              <motion.div
                key="partner-modal-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-[#0B1F33]/65 flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="partner-detail-title"
                onClick={() => setSelectedPartner(null)}
              >
                <motion.div
                  key="partner-modal-card"
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="bg-[#0B1F33] text-white px-6 py-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      {safeModalLogo ? (
                        <div className="h-12 w-16 rounded-lg bg-white border border-white/20 flex items-center justify-center overflow-hidden shrink-0 mt-0.5">
                          <OptimizedImage
                            src={safeModalLogo}
                            alt={selectedPartner.nome}
                            sizes="64px"
                            containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                            className="max-w-full max-h-full object-contain p-1"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="w-5 h-5 text-[#E5C76B]" />
                        </div>
                      )}
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
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#4A5A6D] dark:text-slate-300 pb-4 border-b border-[#F1EDE4] dark:border-[#1C324B]">
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
                        {selectedPartner.cidadeRegiao || translatePartnerCountry(selectedPartner.pais, locale)}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[#0B1F33] dark:text-white font-mono tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                        {Number(selectedPartner.avaliacao || 5).toFixed(1)}/5 · Homologado
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-200">
                        {isEs ? 'Sobre el aliado' : 'Sobre o parceiro'}
                      </p>
                      <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                        {selectedPartner.descricaoPublica}
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-[#0B1F33] dark:text-white">
                          {isEs ? 'Mensaje sugerido de presentación' : 'Mensagem sugerida de indicação'}
                        </p>
                        <button
                          type="button"
                          onClick={() => void handleCopyText(referralText, selectedPartner.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C6D14] dark:text-[#E5C76B] hover:underline whitespace-nowrap shrink-0"
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
                      <p className="text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed">{referralText}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2">
                      <button
                        type="button"
                        aria-pressed={modalSaved}
                        onClick={() => toggleFavorite(selectedPartner.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          modalSaved
                            ? 'border-[#C82333]/35 bg-red-50 dark:bg-red-950/40 text-[#C82333] dark:text-red-300'
                            : 'border-slate-300 dark:border-[#253D58] text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D]'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${modalSaved ? 'fill-[#C82333] text-[#C82333] dark:fill-red-400 dark:text-red-400' : ''}`}
                        />
                        {modalSaved
                          ? isEs
                            ? 'Guardado en favoritos'
                            : 'Salvo nos favoritos'
                          : isEs
                            ? 'Guardar aliado'
                            : 'Favoritar parceiro'}
                      </button>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {safeExternal && (
                          <a
                            href={safeExternal}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#253D58] text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D] whitespace-nowrap shrink-0"
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
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
};
