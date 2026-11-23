import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  FileCheck2,
  GraduationCap,
  Handshake,
  HeartPulse,
  Languages,
  Landmark,
  Loader2,
  MessageCircle,
  RotateCcw,
  Scale,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { OptimizedImage } from './OptimizedImage';
import type { PartnerPublic } from '../types/domain';
import { buildWhatsAppUrl } from '../utils/formatters';
import {
  sanitizePartnerImageUrl,
  translatePartnerCategory,
  translatePartnerCountry,
} from '../utils/partnerHelpers';
import {
  computeAiCacheKey,
  getAiCachedResponse,
  setAiCachedResponse,
} from '../utils/aiIndexedDbCache';

export interface PartnerSynergyRecommendation {
  partnerId: string;
  scoreSinergia: number;
  prioridade: 'Essencial' | 'Recomendado' | 'Complementar';
  justificativa: string;
  momentoIdeal: string;
  proximoPasso: string;
}

export interface PartnerSynergyResult {
  resumoEstrategico: string;
  etapaSugerida: string;
  recomendacoes: PartnerSynergyRecommendation[];
  modeloUsado: string;
  analisadoEm: string;
}

interface PartnerSynergyAnalyzerProps {
  partnersPublic: PartnerPublic[];
  locale: 'pt-BR' | 'es-CL';
  onSelectPartner: (partner: PartnerPublic) => void;
  onResultChange?: (result: PartnerSynergyResult | null) => void;
}

const DIAGNOSTIC_STORAGE_KEY = 'dm_integra_diagnostico_rascunho_v2';

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

function loadSavedDiagnosticProfile(): {
  objetivo?: string;
  etapaAtual?: string;
  composicaoFamiliar?: string;
  necessidadesExtras?: string;
} | null {
  try {
    const raw = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { answers?: Record<string, unknown> };
    const ans = parsed?.answers;
    if (!ans || typeof ans !== 'object') return null;

    const loc = String(ans.localizacao || '');
    const obj = String(ans.objetivoPrincipal || '');
    const depCount = Number(ans.qtdDependentes || 0);
    const hasSpouse = Boolean(ans.acompanhadoConjuge);
    const hasKids = Boolean(ans.acompanhadoFilhos);

    let objetivo = 'Residência Mercosul / Mudança definitiva';
    if (/trabalh|contrat/i.test(obj)) objetivo = 'Trabalho com contrato no Chile';
    else if (/empreend|invest|negoc|empres/i.test(obj)) objetivo = 'Empreender / Abrir empresa no Chile';
    else if (/estud/i.test(obj)) objetivo = 'Estudo / Pós-graduação no Chile';
    else if (/aposent|renda/i.test(obj)) objetivo = 'Aposentadoria / Renda passiva no Chile';

    const etapaAtual = /chile/i.test(loc)
      ? 'Já estou no Chile (regularização e instalação)'
      : 'Planejando no Brasil (documentação e apostilamento)';

    let composicaoFamiliar = 'Individual';
    if (hasKids || depCount > 1) composicaoFamiliar = 'Família com filhos';
    else if (hasSpouse || depCount === 1) composicaoFamiliar = 'Casal';

    const extras: string[] = [];
    if (ans.cidadeDestinoChile && typeof ans.cidadeDestinoChile === 'string') {
      extras.push(`Destino no Chile: ${ans.cidadeDestinoChile}`);
    }
    if (ans.possuiImovelAluguel === false) {
      extras.push('Necessita apoio para moradia no Chile');
    }

    return {
      objetivo,
      etapaAtual,
      composicaoFamiliar,
      necessidadesExtras: extras.join('. '),
    };
  } catch {
    return null;
  }
}

export const PartnerSynergyAnalyzer: React.FC<PartnerSynergyAnalyzerProps> = ({
  partnersPublic,
  locale,
  onSelectPartner,
  onResultChange,
}) => {
  const isEs = locale === 'es-CL';

  const objetivoOptions = useMemo(
    () =>
      isEs
        ? [
            'Residencia Mercosur / Mudanza definitiva',
            'Trabajo con contrato en Chile',
            'Emprender / Crear empresa (SpA) en Chile',
            'Estudios / Postgrado en Chile',
            'Jubilación / Rentista en Chile',
            'Relocation familiar completo (vivienda y colegios)',
          ]
        : [
            'Residência Mercosul / Mudança definitiva',
            'Trabalho com contrato no Chile',
            'Empreender / Abrir empresa (SpA) no Chile',
            'Estudo / Pós-graduação no Chile',
            'Aposentadoria / Renda passiva no Chile',
            'Relocation familiar completo (moradia e escolas)',
          ],
    [isEs],
  );

  const etapaOptions = useMemo(
    () =>
      isEs
        ? [
            'Planificando desde Brasil (etapa inicial)',
            'Reuniendo documentos, apostillas y traducciones',
            'Llegada a Chile (próximos 30 a 90 días)',
            'Ya estoy en Chile (regularización e instalación)',
          ]
        : [
            'Planejando no Brasil (etapa inicial)',
            'Reunindo documentos, apostilamento e traduções',
            'Chegada ao Chile (próximos 30 a 90 dias)',
            'Já estou no Chile (regularização e instalação)',
          ],
    [isEs],
  );

  const familiaOptions = useMemo(
    () =>
      isEs
        ? ['Individual', 'Pareja', 'Familia con hijos', 'Familia con hijos y mascotas']
        : ['Individual', 'Casal', 'Família com filhos', 'Família com filhos e pets'],
    [isEs],
  );

  const urgenciaOptions = useMemo(
    () =>
      isEs
        ? ['Inmediata (hasta 30 días)', 'Corto plazo (1 a 3 meses)', 'Planificación (3 a 6+ meses)']
        : ['Imediata (até 30 dias)', 'Curto prazo (1 a 3 meses)', 'Planejamento (3 a 6+ meses)'],
    [isEs],
  );

  const [objetivoIdx, setObjetivoIdx] = useState(0);
  const [etapaIdx, setEtapaIdx] = useState(1);
  const [familiaIdx, setFamiliaIdx] = useState(0);
  const [urgenciaIdx, setUrgenciaIdx] = useState(1);
  const [necessidadesExtras, setNecessidadesExtras] = useState('');

  const objetivo = objetivoOptions[objetivoIdx] || objetivoOptions[0];
  const etapaAtual = etapaOptions[etapaIdx] || etapaOptions[0];
  const composicaoFamiliar = familiaOptions[familiaIdx] || familiaOptions[0];
  const urgencia = urgenciaOptions[urgenciaIdx] || urgenciaOptions[0];

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<PartnerSynergyResult | null>(null);
  const [importedDiagnostic, setImportedDiagnostic] = useState(false);

  const savedDiagnostic = useMemo(() => loadSavedDiagnosticProfile(), []);

  const partnerById = useMemo(() => {
    const map = new Map<string, PartnerPublic>();
    for (const p of partnersPublic) map.set(p.id, p);
    return map;
  }, [partnersPublic]);

  const handleImportDiagnostic = () => {
    if (!savedDiagnostic) return;
    if (savedDiagnostic.objetivo) {
      if (/trabalho/i.test(savedDiagnostic.objetivo)) setObjetivoIdx(1);
      else if (/empreender/i.test(savedDiagnostic.objetivo)) setObjetivoIdx(2);
      else if (/estudo/i.test(savedDiagnostic.objetivo)) setObjetivoIdx(3);
      else if (/aposentadoria/i.test(savedDiagnostic.objetivo)) setObjetivoIdx(4);
      else setObjetivoIdx(0);
    }
    if (savedDiagnostic.etapaAtual) {
      setEtapaIdx(/já estou no chile/i.test(savedDiagnostic.etapaAtual) ? 3 : 1);
    }
    if (savedDiagnostic.composicaoFamiliar) {
      if (/filhos/i.test(savedDiagnostic.composicaoFamiliar)) setFamiliaIdx(2);
      else if (/casal/i.test(savedDiagnostic.composicaoFamiliar)) setFamiliaIdx(1);
      else setFamiliaIdx(0);
    }
    if (savedDiagnostic.necessidadesExtras) setNecessidadesExtras(savedDiagnostic.necessidadesExtras);
    setImportedDiagnostic(true);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || partnersPublic.length === 0) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      const compactPartners = partnersPublic.slice(0, 40).map((p) => ({
        id: p.id,
        nome: p.nome,
        categoria: p.categoria,
        pais: p.pais,
        cidadeRegiao: p.cidadeRegiao,
        avaliacao: p.avaliacao,
        descricaoPublica: p.descricaoPublica,
      }));

      const payload = {
        profile: {
          objetivo,
          etapaAtual,
          composicaoFamiliar,
          urgencia,
          necessidadesExtras: necessidadesExtras.trim(),
          locale,
        },
        partners: compactPartners,
      };
      const cacheKey = await computeAiCacheKey('/api/ai/parceiros-sinergia', payload, 'public_synergy');
      const cached = await getAiCachedResponse<PartnerSynergyResult>(cacheKey);
      if (cached) {
        setResult(cached.data);
        onResultChange?.(cached.data);
        return;
      }

      const resp = await fetch('/api/ai/parceiros-sinergia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await resp.json().catch(() => ({}))) as PartnerSynergyResult & { error?: string };
      if (!resp.ok) {
        throw new Error(
          json.error ||
            (isEs
              ? 'No fue posible ejecutar el análisis de sinergia en este momento.'
              : 'Não foi possível executar a análise de sinergia no momento.'),
        );
      }

      void setAiCachedResponse({
        key: cacheKey,
        endpoint: '/api/ai/parceiros-sinergia',
        userScope: 'public_synergy',
        data: json,
      });

      setResult(json);
      onResultChange?.(json);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isEs
            ? 'Error de conexión al analizar la sinergia con IA.'
            : 'Erro de conexão ao analisar a sinergia com IA.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setErrorMsg(null);
    onResultChange?.(null);
  };

  const translatePriority = (priority: PartnerSynergyRecommendation['prioridade']): string => {
    if (!isEs) return priority;
    if (priority === 'Essencial') return 'Esencial';
    if (priority === 'Recomendado') return 'Recomendado';
    return 'Complementario';
  };

  const priorityToneClass = (priority: PartnerSynergyRecommendation['prioridade']): string => {
    if (priority === 'Essencial') return 'text-[#146B43] dark:text-emerald-400';
    if (priority === 'Recomendado') return 'text-[#8C6D14] dark:text-[#E5C76B]';
    return 'text-[#4A5A6D] dark:text-slate-400';
  };

  if (partnersPublic.length === 0) return null;

  return (
    <section
      id="sinergia-ia"
      className="scroll-mt-24 bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl overflow-hidden"
    >
      {/* Top Executive Header */}
      <div className="bg-[#0B1F33] text-white px-6 py-6 sm:px-8 sm:py-7 border-b border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] uppercase text-[#E5C76B]">
              <Sparkles className="w-3.5 h-3.5" />
              {isEs ? 'Inteligencia Artificial · Curaduría Personalizada' : 'Inteligência Artificial · Curadoria Personalizada'}
            </p>
            <h2 className="font-display text-2xl sm:text-[1.75rem] font-bold text-white leading-tight text-balance">
              {isEs
                ? 'Descubre qué aliados tienen mayor sinergia con tu perfil migratorio'
                : 'Descubra quais parceiros têm maior sinergia com o seu perfil migratório'}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              {isEs
                ? 'Nuestra IA cruza tu objetivo, etapa actual y necesidades familiares con los aliados homologados de nuestra red para recomendar el orden ideal de contratación.'
                : 'Nossa IA cruza seu objetivo, etapa atual e composição familiar com os parceiros homologados da rede para indicar exatamente quem acionar e em qual momento.'}
            </p>
          </div>

          {savedDiagnostic && (
            <button
              type="button"
              onClick={handleImportDiagnostic}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/25 hover:bg-white/10 text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 self-start lg:self-end"
            >
              <Wand2 className="w-3.5 h-3.5 text-[#E5C76B]" />
              {importedDiagnostic
                ? isEs
                  ? 'Datos del Diagnóstico aplicados'
                  : 'Dados do Diagnóstico aplicados'
                : isEs
                  ? 'Importar datos de mi Diagnóstico'
                  : 'Importar dados do meu Diagnóstico'}
            </button>
          )}
        </div>
      </div>

      {/* Form + Results Body */}
      <div className="p-6 sm:p-8 space-y-6">
        <form onSubmit={handleAnalyze} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="syn-objetivo" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1.5">
              {isEs ? 'Objetivo principal en Chile' : 'Objetivo principal no Chile'}
            </label>
            <select
              id="syn-objetivo"
              value={objetivoIdx}
              onChange={(e) => setObjetivoIdx(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] bg-white dark:bg-[#081524] text-xs sm:text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
            >
              {objetivoOptions.map((opt, idx) => (
                <option key={opt} value={idx}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="syn-etapa" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1.5">
              {isEs ? 'Etapa actual de tu jornada' : 'Etapa atual da jornada'}
            </label>
            <select
              id="syn-etapa"
              value={etapaIdx}
              onChange={(e) => setEtapaIdx(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] bg-white dark:bg-[#081524] text-xs sm:text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
            >
              {etapaOptions.map((opt, idx) => (
                <option key={opt} value={idx}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="syn-familia" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1.5">
              {isEs ? 'Composición familiar' : 'Composição familiar'}
            </label>
            <select
              id="syn-familia"
              value={familiaIdx}
              onChange={(e) => setFamiliaIdx(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] bg-white dark:bg-[#081524] text-xs sm:text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
            >
              {familiaOptions.map((opt, idx) => (
                <option key={opt} value={idx}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="syn-urgencia" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1.5">
              {isEs ? 'Plazo previsto' : 'Prazo / Urgência'}
            </label>
            <select
              id="syn-urgencia"
              value={urgenciaIdx}
              onChange={(e) => setUrgenciaIdx(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] bg-white dark:bg-[#081524] text-xs sm:text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
            >
              {urgenciaOptions.map((opt, idx) => (
                <option key={opt} value={idx}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-3">
            <label htmlFor="syn-extras" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1.5">
              {isEs ? 'Necesidades específicas (opcional)' : 'Necessidades específicas (opcional)'}
            </label>
            <input
              id="syn-extras"
              type="text"
              value={necessidadesExtras}
              onChange={(e) => setNecessidadesExtras(e.target.value)}
              maxLength={400}
              placeholder={
                isEs
                  ? 'Ej.: necesito traducir certificados, buscar departamento en Providencia y abrir una SpA...'
                  : 'Ex.: preciso traduzir certidões, buscar apartamento em Providencia e abrir empresa SpA...'
              }
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] bg-white dark:bg-[#081524] text-sm text-[#0B1523] dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
            />
          </div>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#0B1F33] hover:bg-[#132d48] dark:bg-[#C8A236] dark:hover:bg-[#b5912c] text-white dark:text-[#0B1F33] text-sm font-semibold transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E5C76B] dark:text-[#0B1F33]" />
                  {isEs ? 'Analizando...' : 'Analisando...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-[#E5C76B] dark:text-[#0B1F33]" />
                  {isEs ? 'Analizar sinergia' : 'Analisar sinergia'}
                </>
              )}
            </button>
            {result && !loading && (
              <button
                type="button"
                onClick={handleReset}
                title={isEs ? 'Limpiar análisis' : 'Limpar análise'}
                aria-label={isEs ? 'Limpiar análisis' : 'Limpar análise'}
                className="p-2.5 rounded-lg border border-[#DDD6C7] dark:border-[#253D58] text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white hover:bg-[#F7F5F0] dark:hover:bg-[#142942] shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* Honest Error Feedback (no fake fallback) */}
        <AnimatePresence mode="wait">
          {errorMsg && (
            <motion.div
              key="synergy-error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
              className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 p-4 flex items-start gap-3 text-sm text-[#9B1C27] dark:text-red-300"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">
                  {isEs ? 'No fue posible completar el análisis de IA' : 'Não foi possível concluir a análise com IA'}
                </p>
                <p className="text-xs leading-relaxed">{errorMsg}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI Recommendations Output */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div
              key={result.analisadoEm}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-5 pt-4 border-t border-[#EFECE3] dark:border-[#1C324B]"
            >
              {/* Strategic Summary Band */}
              <div className="rounded-xl bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#8C6D14] dark:text-[#E5C76B] uppercase tracking-wider">
                    {isEs ? 'Diagnóstico de sinergia' : 'Síntese estratégica de sinergia'} · {result.etapaSugerida}
                  </p>
                  <p className="text-sm text-[#0B1F33] dark:text-slate-100 leading-relaxed">{result.resumoEstrategico}</p>
                </div>
                <div className="shrink-0 text-left md:text-right border-t md:border-t-0 md:border-l border-[#DDD6C7] dark:border-[#253D58] pt-3 md:pt-0 md:pl-5">
                  <p className="text-2xl font-bold font-mono tabular-nums text-[#0B1F33] dark:text-white">
                    {result.recomendacoes.length}
                  </p>
                  <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400">
                    {isEs ? 'Aliados recomendados' : 'Parceiros compatíveis'}
                  </p>
                </div>
              </div>

              {/* Ranked Synergy Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.recomendacoes.map((rec, idx) => {
                  const partner = partnerById.get(rec.partnerId);
                  if (!partner) return null;
                  const Icon = getCategoryIcon(partner.categoria);
                  const safeLogo = sanitizePartnerImageUrl(partner.logoUrl);
                  const referralMsg = isEs
                    ? `¡Hola! A través del análisis de sinergia de D&M Integra Chile para mi perfil (${objetivo}), recibí la recomendación de contactar a ${partner.nome}. ${rec.proximoPasso}`
                    : `Olá! Pelo analisador de sinergia da D&M Integra Chile para o meu perfil (${objetivo}), recebi a indicação de falar com ${partner.nome}. ${rec.proximoPasso}`;

                  return (
                    <motion.article
                      key={rec.partnerId}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.34,
                        delay: Math.min(idx * 0.06, 0.24),
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className="rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-white dark:bg-[#0A192A] p-5 flex flex-col justify-between gap-4 hover:border-[#C8A236]/80 transition-colors"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-11 h-11 rounded-lg bg-[#F7F5F0] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#253D58] flex items-center justify-center overflow-hidden shrink-0">
                              {safeLogo ? (
                                <OptimizedImage
                                  src={safeLogo}
                                  alt={partner.nome}
                                  sizes="48px"
                                  containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                                  className="max-w-full max-h-full object-contain p-1"
                                />
                              ) : (
                                <Icon className="w-5 h-5 text-[#8C6D14] dark:text-[#E5C76B]" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 truncate">
                                <span className={`font-semibold ${priorityToneClass(rec.prioridade)}`}>
                                  {translatePriority(rec.prioridade)}
                                </span>
                                <span aria-hidden="true"> · </span>
                                <span>{translatePartnerCategory(partner.categoria, locale)}</span>
                              </p>
                              <h3 className="text-base font-bold text-[#0B1F33] dark:text-white truncate">{partner.nome}</h3>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-lg font-bold font-mono tabular-nums text-[#0B1F33] dark:text-[#E5C76B] leading-none">
                              {rec.scoreSinergia}%
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-[#4A5A6D] dark:text-slate-400 mt-0.5">
                              {isEs ? 'Sinergia' : 'Sinergia'}
                            </p>
                          </div>
                        </div>

                        {/* Minimalist Synergy Progress Rail */}
                        <div className="h-1.5 w-full rounded-full bg-[#EFECE3] dark:bg-[#1C324B] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${rec.scoreSinergia}%` }}
                            transition={{ duration: 0.55, delay: 0.1 + idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                            className="h-full rounded-full bg-[#0B1F33] dark:bg-[#C8A236]"
                          />
                        </div>

                        <p className="text-xs sm:text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">{rec.justificativa}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#F1EDE4] dark:border-[#1C324B] text-xs">
                          <div>
                            <p className="font-semibold text-[#0B1F33] dark:text-slate-200">
                              {isEs ? 'Momento ideal' : 'Momento ideal'}
                            </p>
                            <p className="text-[#4A5A6D] dark:text-slate-400 mt-0.5">{rec.momentoIdeal}</p>
                          </div>
                          <div>
                            <p className="font-semibold text-[#0B1F33] dark:text-slate-200">
                              {isEs ? 'Próximo paso' : 'Próximo passo'}
                            </p>
                            <p className="text-[#4A5A6D] dark:text-slate-400 mt-0.5">{rec.proximoPasso}</p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#F1EDE4] dark:border-[#1C324B] flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[11px] text-[#4A5A6D] dark:text-slate-400">
                          {translatePartnerCountry(partner.pais, locale)}
                          {partner.cidadeRegiao ? ` · ${partner.cidadeRegiao}` : ''}
                        </span>
                        <div className="flex items-center gap-3">
                          {partner.whatsapp && (
                            <a
                              href={buildWhatsAppUrl(partner.whatsapp, referralMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#146B43] dark:text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => onSelectPartner(partner)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#0B1F33] dark:text-[#E5C76B] hover:text-[#8C6D14] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
                          >
                            {isEs ? 'Ver ficha' : 'Ver detalhes'}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
