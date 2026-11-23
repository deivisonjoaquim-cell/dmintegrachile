import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Compass,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FlaskConical,
  HelpCircle,
  Lock,
  MessageCircle,
  Printer,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { PdfPreviewModal } from './pdf/PdfPreviewModal';
import { BrandRibbon } from './BrandLogo';
import { DiagnosticRadarChart } from './diagnostic/DiagnosticRadarChart';
import {
  buildSimulatedPublicAnswers,
  PublicWhatIfSimulator,
  type PublicSimLeverId,
} from './diagnostic/PublicWhatIfSimulator';
import type {
  DiagnosticAnswers,
  EmpresaConfig,
  LeadRuleHistoryEntry,
} from '../types/domain';
import type {
  ActionPlanItem,
  compareWhatIfScenarios,
  DiagnosticResult,
} from '../utils/diagnosticEngine';
import { SEED_MESSAGE_TEMPLATES } from '../data/seeds';
import {
  applyTemplateVariables,
  buildWhatsAppUrl,
  formatCurrency,
  formatDateBR,
  openExternalSafe,
} from '../utils/formatters';
import {
  buildBasicDiagnosticSummary,
  CONSULTANCY_PLANS,
} from '../utils/portalAccess';
import { useLanguage } from '../contexts/LanguageContext';

export interface AiDiagnosticDraft {
  rascunho?: boolean;
  fallback?: boolean;
  origem?: 'principal' | 'reserva' | 'regras';
  origemLabel?: string;
  mensagemUsuario?: string;
  resumoExecutivo: string;
  riscos?: string[];
  perguntasConsultor?: string[];
  pontosAtencao: string[];
  fontesCitadas: string[];
  proximosPassos: string[];
}

interface DiagnosticReportViewProps {
  mode: 'public' | 'consultant';
  result: DiagnosticResult;
  answers: DiagnosticAnswers;
  empresa: EmpresaConfig;
  hideCosts?: boolean;
  savedLeadId?: string | null;
  resumeUrl?: string | null;
  aiDraft?: AiDiagnosticDraft | null;
  aiLoading?: boolean;
  aiProgress?: string | null;
  aiError?: string | null;
  onRefineAi?: () => void;
  onUpdateAiDraft?: (next: AiDiagnosticDraft) => void;
  onOpenLaw?: () => void;
  onOpenCalendly?: () => void;
  onRestart?: () => void;
  onNavigate?: (path: string) => void;
  onLogWhatsApp?: (assunto: string, msg: string) => Promise<void>;
  whatIfAnswers?: DiagnosticAnswers | null;
  whatIfComparison?: ReturnType<typeof compareWhatIfScenarios> | null;
  onChangeWhatIf?: (next: DiagnosticAnswers) => void;
  onResetWhatIf?: () => void;
  onSimulatePublicAnswers?: (simAnswers: DiagnosticAnswers) => DiagnosticResult;
  leadHistory?: LeadRuleHistoryEntry[];
}

export const DiagnosticReportView: React.FC<DiagnosticReportViewProps> = ({
  mode,
  result,
  answers,
  empresa,
  hideCosts = false,
  savedLeadId,
  resumeUrl,
  aiDraft,
  aiLoading = false,
  aiProgress = null,
  aiError = null,
  onRefineAi,
  onUpdateAiDraft,
  onOpenLaw,
  onOpenCalendly,
  onRestart,
  onNavigate,
  onLogWhatsApp,
  whatIfAnswers,
  whatIfComparison,
  onChangeWhatIf,
  onResetWhatIf,
  onSimulatePublicAnswers,
  leadHistory,
}) => {
  const { locale, isEsCL } = useLanguage();
  const [explainTab, setExplainTab] = useState<'cliente' | 'tecnico'>(mode === 'consultant' ? 'tecnico' : 'cliente');
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'download' | 'preview' | 'download-2p' | 'preview-2p' | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; filename: string; blobUrl: string } | null>(null);
  const [publicSimLevers, setPublicSimLevers] = useState<PublicSimLeverId[]>([]);

  const publicSimulatedResult = useMemo(() => {
    if (mode !== 'public' || !onSimulatePublicAnswers || publicSimLevers.length === 0) return null;
    const simAnswers = buildSimulatedPublicAnswers(answers, publicSimLevers);
    return onSimulatePublicAnswers(simAnswers);
  }, [mode, onSimulatePublicAnswers, publicSimLevers, answers]);

  const publicSimulatedDimensions = useMemo(() => {
    if (!publicSimulatedResult) return null;
    return buildBasicDiagnosticSummary(publicSimulatedResult, answers).dimensoes || null;
  }, [publicSimulatedResult, answers]);

  const togglePublicSimLever = (leverId: PublicSimLeverId) => {
    setPublicSimLevers((prev) =>
      prev.includes(leverId) ? prev.filter((id) => id !== leverId) : [...prev, leverId],
    );
  };

  const closePdfPreview = () => {
    setPdfPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  const scoreColor =
    result.viabilidade.total >= 80
      ? '#1E7E34'
      : result.viabilidade.total >= 60
        ? '#0F2537'
        : result.viabilidade.total >= 40
          ? '#D4AF37'
          : '#C82333';

  const confidenceBadge =
    result.confianca === 'Alta'
      ? 'bg-emerald-50 text-[#1E7E34] border-emerald-200'
      : result.confianca === 'Média'
        ? 'bg-amber-50 text-amber-800 border-amber-200'
        : 'bg-red-50 text-[#C82333] border-red-200';

  const tpl = SEED_MESSAGE_TEMPLATES.find((t) => t.codigo === 'POS_DIAGNOSTICO') || SEED_MESSAGE_TEMPLATES[0];
  const recommendedTitle = result.recomendada
    ? `${result.recomendada.visa.codigo} - ${result.recomendada.visa.nomePortugues}`
    : 'Análise complementar necessária';

  const waMessage = tpl
    ? applyTemplateVariables(tpl.corpo, {
        nome_cliente: answers.nome || 'Visitante',
        subcategoria_visto: `${recommendedTitle} (Viabilidade ${result.viabilidade.total}/100 · Confiança ${result.confianca})`,
        documento_nome: 'Pré-checklist inicial',
        motivo_reprovacao: '',
        prazo_data: formatDateBR(new Date()),
        valor: '',
        chave_pix: '',
      })
    : `Olá! Concluí meu diagnóstico na ${empresa.nome_empresa}. Subcategoria indicada: ${recommendedTitle}.`;

  const handlePrintPdf = () => {
    window.print();
  };

  // MODO PÚBLICO (DIAGNÓSTICO GRATUITO): Dossiê Preliminar estruturado de nível profissional.
  // Mantém reservados à consultoria contratada (Orientativa/Completa) e à Área da Equipe (mode="consultant"):
  // plano de ação com ordem exata de certidões, tabela de taxas BRL/CLP/USD, checklist individualizado por familiar e PDF técnico completo.
  if (mode === 'public') {
    const basic = buildBasicDiagnosticSummary(result, answers);
    const planOrientativa = CONSULTANCY_PLANS.orientativa;
    const planCompleta = CONSULTANCY_PLANS.completa;
    const protocoloRef = savedLeadId ? savedLeadId.slice(-8).toUpperCase() : 'PRELIMINAR';
    const dataEmissao = formatDateBR(basic.dataCalculo || new Date().toISOString());

    const buildPlanWaUrl = (planLabel: string) =>
      buildWhatsAppUrl(
        empresa.whatsapp,
        `Olá! Concluí o Diagnóstico Gratuito na ${empresa.nome_empresa} (Protocolo #${protocoloRef} · ${basic.subcategoriaNome} · Viabilidade ${basic.notaViabilidade}/100) e quero saber mais sobre a ${planLabel}.`,
      );

    const handleCopyPublicSummary = () => {
      const lines = [
        `Dossiê Preliminar de Elegibilidade Migratória — ${empresa.nome_empresa}`,
        `Protocolo: #${protocoloRef} · Emitido em ${dataEmissao}`,
        basic.nome ? `Interessado(a): ${basic.nome}` : null,
        `Rota principal sugerida: ${basic.subcategoriaNome}`,
        `Índice de viabilidade preliminar: ${basic.notaViabilidade}/100 (${basic.veredito}) · Confiança ${basic.confianca}`,
        `Perfil: ${basic.perfilResumo?.localizacao || ''} · ${basic.familiaResumo || ''}`,
        basic.alertaGeral ? `Ponto de atenção: ${basic.alertaGeral}` : null,
      ].filter(Boolean);
      navigator.clipboard?.writeText(lines.join('\n')).then(() => {
        setCopiedMsg(true);
        window.setTimeout(() => setCopiedMsg(false), 2600);
      }).catch(() => {});
    };

    const handleDownloadPublicDossierPdf = async () => {
      if (pdfBusy) return;
      setPdfBusy('download');
      setPdfFeedback(null);
      try {
        const { exportClientDiagnosticPdf } = await import('../utils/clientDiagnosticPdf');
        const filename = await exportClientDiagnosticPdf({
          empresa,
          summary: basic,
          result,
          answers,
          protocolo: protocoloRef,
          simulatedDimensions: publicSimulatedDimensions,
          hideCosts,
          locale,
          aiDraft,
        });
        setPdfFeedback(
          isEsCL
            ? `Diagnóstico migratorio completo (2 páginas PDF) descargado (${filename}).`
            : `Diagnóstico migratório completo em PDF (2 páginas) baixado (${filename}).`,
        );
      } catch (err) {
        setPdfFeedback(
          err instanceof Error
            ? err.message
            : isEsCL
              ? 'No fue posible generar el diagnóstico en PDF.'
              : 'Não foi possível gerar o diagnóstico em PDF.',
        );
      } finally {
        setPdfBusy(null);
      }
    };

    const handlePreviewPublicDossierPdf = async () => {
      if (pdfBusy) return;
      setPdfBusy('preview');
      setPdfFeedback(null);
      try {
        const { buildClientDiagnosticPdfBlob } = await import('../utils/clientDiagnosticPdf');
        const { blob, filename } = await buildClientDiagnosticPdfBlob({
          empresa,
          summary: basic,
          result,
          answers,
          protocolo: protocoloRef,
          simulatedDimensions: publicSimulatedDimensions,
          hideCosts,
          locale,
          aiDraft,
        });
        const blobUrl = URL.createObjectURL(blob);
        setPdfPreview((prev) => {
          if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
          return {
            title: isEsCL
              ? 'Diagnóstico Migratorio Completo D&M Integra (PDF 2 Páginas)'
              : 'Diagnóstico Migratório Completo D&M Integra (PDF 2 Páginas)',
            filename,
            blobUrl,
          };
        });
      } catch (err) {
        setPdfFeedback(
          err instanceof Error
            ? err.message
            : isEsCL
              ? 'No fue posible abrir la vista previa en PDF.'
              : 'Não foi possível abrir a pré-visualização em PDF.',
        );
      } finally {
        setPdfBusy(null);
      }
    };

    const scoreToneText =
      basic.notaViabilidade >= 75
        ? 'text-emerald-300'
        : basic.notaViabilidade >= 50
          ? 'text-[#E6C55A]'
          : 'text-amber-300';

    const scoreBarColor =
      basic.notaViabilidade >= 75
        ? '#22C55E'
        : basic.notaViabilidade >= 50
          ? '#D4AF37'
          : '#F59E0B';

    const confidenceTone =
      basic.confianca === 'Alta'
        ? 'text-emerald-300'
        : basic.confianca === 'Média'
          ? 'text-[#E6C55A]'
          : 'text-amber-300';

    const protocoloDentroLabel =
      basic.permiteDentroChile === 'Sim'
        ? 'Permitido dentro do Chile'
        : basic.permiteDentroChile === 'Não'
          ? 'Protocolo do exterior (fora do Chile)'
          : basic.permiteDentroChile === 'Condicional'
            ? 'Condicional — depende da situação migratória'
            : 'Sob validação técnica';

    return (
      <div className="space-y-8">
        {/* 1. CABEÇALHO EDITORIAL DO DOSSIÊ EXECUTIVO */}
        <section className="bg-white border border-[#E5DFD2] rounded-2xl overflow-hidden shadow-[0_12px_32px_rgba(11,31,51,0.06)]">
          <BrandRibbon className="h-[3px] w-full" />

          {/* Faixa Executiva Superior */}
          <div className="bg-[#0B1F33] text-white px-6 sm:px-9 py-7 sm:py-9">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="space-y-3.5 max-w-2xl">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold tracking-[0.12em] uppercase text-slate-300">
                  <span className="text-[#E6C55A]">Dossiê de Elegibilidade Migratória</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono tabular-nums">Protocolo #{protocoloRef}</span>
                  <span className="text-slate-500">·</span>
                  <span className={confidenceTone}>Confiança {basic.confianca}</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono tabular-nums">{dataEmissao}</span>
                </div>

                <div className="space-y-1.5">
                  {basic.nome && (
                    <p className="text-xs text-slate-300">
                      Preparado para <strong className="text-white font-semibold">{basic.nome}</strong>
                    </p>
                  )}
                  <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-[1.15] text-balance">
                    {basic.subcategoriaNome}
                  </h1>
                  {basic.subcategoriaEspanhol && (
                    <p className="text-xs sm:text-sm italic text-slate-300/90">
                      Designação oficial SERMIG: {basic.subcategoriaEspanhol}
                    </p>
                  )}
                </div>

                <p className="text-sm text-slate-200/90 leading-relaxed pt-1">
                  {basic.resumoBasico}
                </p>
              </div>

              {/* Bloco de Índice de Viabilidade — Âncora Visual Dominante */}
              <div className="lg:w-[276px] shrink-0 rounded-xl bg-white/[0.06] border border-white/15 p-5 space-y-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-300">
                    Índice de Viabilidade
                  </p>
                  <span className={`text-[11px] font-semibold ${scoreToneText}`}>
                    {basic.vereditoNivel === 'alta'
                      ? 'Alta aderência'
                      : basic.vereditoNivel === 'moderada'
                        ? 'Viável c/ plano'
                        : 'Requer estratégia'}
                  </span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono text-5xl font-bold tabular-nums leading-none text-white">
                    {basic.notaViabilidade}
                  </span>
                  <span className="font-mono text-base font-medium text-slate-400 tabular-nums">/100</span>
                </div>

                <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(8, Math.min(100, basic.notaViabilidade))}%`,
                      backgroundColor: scoreBarColor,
                    }}
                  />
                </div>

                <p className="text-xs text-slate-200 leading-snug">{basic.veredito}</p>
              </div>
            </div>

            {/* Barra de ações utilitárias + Exportação PDF Oficial (jsPDF) */}
            <div className="no-print mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-300">
                <span>
                  Localização: <strong className="text-white">{basic.perfilResumo?.localizacao || answers.localizacao}</strong>
                </span>
                <span className="text-slate-500">·</span>
                <span>
                  Composição: <strong className="text-white">{basic.familiaResumo}</strong>
                </span>
                {basic.perfilResumo?.prazo && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span>
                      Horizonte: <strong className="text-white">{basic.perfilResumo.prazo}</strong>
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={pdfBusy !== null}
                  onClick={() => void handleDownloadPublicDossierPdf()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#C8A236] hover:bg-[#d6b145] text-[#0B1523] font-bold whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {pdfBusy === 'download'
                    ? isEsCL
                      ? 'Generando PDF...'
                      : 'Gerando PDF...'
                    : isEsCL
                      ? 'Exportar Diagnóstico PDF (2 Páginas)'
                      : 'Exportar Diagnóstico PDF (2 Páginas)'}
                </button>
                <button
                  type="button"
                  disabled={pdfBusy !== null}
                  onClick={() => void handlePreviewPublicDossierPdf()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {pdfBusy === 'preview'
                    ? isEsCL
                      ? 'Abriendo...'
                      : 'Abrindo...'
                    : isEsCL
                      ? 'Vista previa PDF'
                      : 'Pré-visualizar PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPublicSummary}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedMsg
                    ? isEsCL
                      ? 'Resumen copiado'
                      : 'Resumo copiado'
                    : isEsCL
                      ? 'Copiar resumen'
                      : 'Copiar resumo'}
                </button>
              </div>
            </div>

            {pdfFeedback && (
              <div className="no-print mt-3 px-3.5 py-2 rounded-lg bg-white/10 border border-white/15 text-xs text-[#E6C55A] flex items-center justify-between gap-2">
                <span>{pdfFeedback}</span>
                <button
                  type="button"
                  onClick={() => setPdfFeedback(null)}
                  className="text-slate-300 hover:text-white underline text-[11px]"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>

          {/* 4 Parâmetros Estratégicos (faixa limpa com divisórias hairline) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5DFD2] bg-[#FAF9F6] border-b border-[#E5DFD2]">
            <div className="p-5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Local de Protocolo
              </p>
              <p className="text-sm font-bold text-[#0B1F33] leading-snug">{protocoloDentroLabel}</p>
            </div>
            <div className="p-5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Autorização de Trabalho
              </p>
              <p className="text-sm font-bold text-[#0B1F33] leading-snug">
                {basic.permiteTrabalhar === undefined
                  ? 'Conforme subcategoria'
                  : basic.permiteTrabalhar
                    ? 'Sim · Atividade remunerada liberada'
                    : 'Não · Restrita a esta categoria'}
              </p>
            </div>
            <div className="p-5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Residência Definitiva
              </p>
              <p className="text-sm font-bold text-[#0B1F33] leading-snug">
                {basic.levaDefinitiva === undefined
                  ? 'Sob validação técnica'
                  : basic.levaDefinitiva
                    ? 'Elegível cumprindo prazo legal'
                    : 'Exige mudança de subcategoria'}
              </p>
            </div>
            <div className="p-5 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Referência de Prazo SERMIG
              </p>
              <p className="text-sm font-bold text-[#0B1F33] leading-snug tabular-nums">
                {basic.prazoEstimadoResumo || 'Conforme fila oficial SERMIG'}
              </p>
            </div>
          </div>

          {/* Corpo Analítico do Dossiê */}
          <div className="p-6 sm:p-9 space-y-9">
            {/* Alerta Crítico (quando aplicável) */}
            {basic.temAlertaCritico && basic.alertaGeral && (
              <div className="p-5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 flex items-start gap-3.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-900">
                    Ponto de Atenção Prioritário no Seu Perfil
                  </p>
                  <p className="text-sm leading-relaxed text-amber-950">{basic.alertaGeral}</p>
                </div>
              </div>
            )}

            {/* 2. GRÁFICO RADAR DE 7 PILARES + DECOMPOSIÇÃO POR DIMENSÃO */}
            {basic.dimensoes && basic.dimensoes.length > 0 && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-[#E5DFD2]">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8C6D14]">
                      Raio-X de Viabilidade
                    </p>
                    <h2 className="font-display text-lg sm:text-xl font-bold text-[#0B1F33] mt-0.5">
                      Gráfico Radar &amp; Pilares Técnicos da Pontuação
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 tabular-nums">
                    Total consolidado:{' '}
                    <strong className="font-mono text-[#0B1F33]">{basic.notaViabilidade}/100 pontos</strong>
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                  {/* Esquerda: Gráfico Radar Vetorial Interativo */}
                  <div className="lg:col-span-5">
                    <DiagnosticRadarChart
                      dimensions={basic.dimensoes}
                      simulatedDimensions={publicSimulatedDimensions}
                    />
                  </div>

                  {/* Direita: Barras detalhadas por pilar */}
                  <div className="lg:col-span-7 space-y-4">
                    {basic.dimensoes.map((dim) => {
                      const simMatch = publicSimulatedDimensions?.find((s) => s.nome === dim.nome);
                      const barFill =
                        dim.percentual >= 75
                          ? '#146B43'
                          : dim.percentual >= 50
                            ? '#0B1F33'
                            : '#B7791F';
                      return (
                        <div key={dim.nome} className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-sm font-semibold text-[#0B1F33]">{dim.nome}</span>
                            <span className="font-mono text-xs font-bold tabular-nums text-slate-700 shrink-0">
                              {dim.pontos}/{dim.maximo} pts ({dim.percentual}%)
                              {simMatch && simMatch.percentual !== dim.percentual && (
                                <span
                                  className={`ml-1.5 ${
                                    simMatch.percentual > dim.percentual ? 'text-[#146B43]' : 'text-[#A61C2B]'
                                  }`}
                                >
                                  → {simMatch.percentual}%
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[#EFECE4] overflow-hidden relative">
                            <div
                              className="h-full rounded-full transition-all duration-300"
                              style={{ width: `${Math.max(4, dim.percentual)}%`, backgroundColor: barFill }}
                            />
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{dim.observacao}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2B. SIMULADOR INTERATIVO "E SE..." NO RESULTADO */}
            {onSimulatePublicAnswers && (
              <div className="no-print pt-1">
                <PublicWhatIfSimulator
                  baseAnswers={answers}
                  baseResult={result}
                  simulatedResult={publicSimulatedResult}
                  activeLevers={publicSimLevers}
                  onToggleLever={togglePublicSimLever}
                  onReset={() => setPublicSimLevers([])}
                />
              </div>
            )}

            {/* 3. PONTOS FORTES vs. PONTOS DE ATENÇÃO */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] p-5 sm:p-6 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[#146B43]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Por que esta rota se destaca no seu perfil
                </div>
                <ul className="space-y-2.5 text-sm text-slate-700">
                  {(basic.pontosFortes && basic.pontosFortes.length > 0
                    ? basic.pontosFortes
                    : ['Enquadramento preliminar compatível com as normas vigentes do SERMIG.']
                  ).map((item) => (
                    <li key={item} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#146B43] shrink-0 mt-2" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-[#E5DFD2] bg-white p-5 sm:p-6 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-[#8C6D14]">
                  <Compass className="w-4 h-4 shrink-0" />
                  Pontos de verificação antes de emitir certidões
                </div>
                {basic.pontosAtencao && basic.pontosAtencao.length > 0 ? (
                  <ul className="space-y-2.5 text-sm text-slate-700">
                    {basic.pontosAtencao.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 leading-relaxed">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#C9A227] shrink-0 mt-2" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Não identificamos bloqueios críticos imediatos nas respostas informadas. A etapa decisiva agora é validar validade de antecedentes (60 dias), apostilamento e sequência correta de protocolo para evitar exigências do SERMIG.
                  </p>
                )}
              </div>
            </div>

            {/* 4. ROTEIRO MACRO EM 4 FASES */}
            {basic.roteiroMacro && basic.roteiroMacro.length > 0 && (
              <div className="space-y-4 pt-2">
                <div className="pb-3 border-b border-[#E5DFD2]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8C6D14]">
                    Visão Estruturada da Jornada
                  </p>
                  <h2 className="font-display text-lg sm:text-xl font-bold text-[#0B1F33] mt-0.5">
                    Roteiro Macro do Processo em 4 Fases
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {basic.roteiroMacro.map((stepItem) => (
                    <div
                      key={stepItem.fase}
                      className="rounded-xl border border-[#E5DFD2] bg-white p-4 flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold tabular-nums text-[#8C6D14]">
                            FASE 0{stepItem.fase}
                          </span>
                          <span className="text-[11px] text-[#4A5A6D] truncate">{stepItem.foco}</span>
                        </div>
                        <h3 className="text-sm font-bold text-[#0B1F33] leading-snug">{stepItem.titulo}</h3>
                        <p className="text-xs text-[#4A5A6D] leading-relaxed">{stepItem.resumo}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4B. RADAR DE PRAZOS & VALIDADES CRÍTICAS SERMIG (Especialista em Imigração) */}
            <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] overflow-hidden">
              <div className="px-5 py-3.5 bg-[#0B1F33] text-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#E5C76B]" />
                  <p className="text-xs font-bold uppercase tracking-[0.12em]">
                    Radar de Validades &amp; Prazos Críticos — SERMIG / Ley Nº 21.325
                  </p>
                </div>
                <span className="text-[11px] font-mono text-slate-300">Referência operacional Brasil – Chile</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E5DFD2]">
                <div className="p-4 space-y-1">
                  <p className="font-mono text-base font-bold tabular-nums text-[#A61C2B]">60 dias</p>
                  <p className="text-xs font-bold text-[#0B1F33]">Antecedentes Polícia Federal</p>
                  <p className="text-[11px] text-[#4A5A6D] leading-relaxed">
                    Certidão vence rápido no SERMIG; deve ser emitida por último, imediatamente antes do protocolo.
                  </p>
                </div>
                <div className="p-4 space-y-1">
                  <p className="font-mono text-base font-bold tabular-nums text-[#8C6D14]">Haia CNJ</p>
                  <p className="text-xs font-bold text-[#0B1F33]">Apostilamento Obrigatório</p>
                  <p className="text-[11px] text-[#4A5A6D] leading-relaxed">
                    Certidões civis e antecedentes emitidos no Brasil exigem Apostila da Haia com QR Code legível.
                  </p>
                </div>
                <div className="p-4 space-y-1">
                  <p className="font-mono text-base font-bold tabular-nums text-[#0B1F33]">90 dias</p>
                  <p className="text-xs font-bold text-[#0B1F33]">Ingresso pós-Estampado</p>
                  <p className="text-[11px] text-[#4A5A6D] leading-relaxed">
                    Após aprovação e download do Estampado Electrónico, respeite o prazo legal para entrada no Chile.
                  </p>
                </div>
                <div className="p-4 space-y-1">
                  <p className="font-mono text-base font-bold tabular-nums text-[#146B43]">30 dias</p>
                  <p className="text-xs font-bold text-[#0B1F33]">Registro PDI &amp; Cédula</p>
                  <p className="text-[11px] text-[#4A5A6D] leading-relaxed">
                    Prazo legal após o ingresso no Chile para registrar a residência na PDI e solicitar Cédula/RUT.
                  </p>
                </div>
              </div>
            </div>

            {/* 5. ROTAS ALTERNATIVAS MAPEADAS */}
            {basic.alternativasMapeadas && basic.alternativasMapeadas.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-bold text-[#0B1F33]">
                    Rotas secundárias também avaliadas no seu perfil
                  </h3>
                  <span className="text-[11px] text-slate-500">Comparativo técnico completo disponível na consultoria</span>
                </div>
                <div className="rounded-xl border border-[#E5DFD2] overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FAF9F6] border-b border-[#E5DFD2] text-[11px] text-slate-500">
                        <th className="py-2.5 px-4 font-semibold">Subcategoria Alternativa</th>
                        <th className="py-2.5 px-4 font-semibold">Pedido dentro do Chile</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Aderência Preliminar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5DFD2] bg-white">
                      {basic.alternativasMapeadas.map((alt) => (
                        <tr key={alt.codigo}>
                          <td className="py-3 px-4 font-semibold text-slate-900">{alt.nome}</td>
                          <td className="py-3 px-4 text-slate-600">{alt.permiteDentroChile}</td>
                          <td className="py-3 px-4 text-right font-bold tabular-nums text-[#0B1F33]">
                            {alt.aderencia}/100
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. O QUE É LIBERADO NA CONSULTORIA */}
            <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] p-5 sm:p-6 space-y-3.5">
              <div className="flex items-center gap-2 text-sm font-bold text-[#0B1F33]">
                <Lock className="w-4 h-4 text-[#8C6D14] shrink-0" />
                Entregáveis técnicos liberados ao contratar a consultoria
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5 text-xs text-slate-700">
                {basic.itensBloqueados.map((item) => (
                  <li key={item} className="flex items-start gap-2 leading-relaxed">
                    <FileCheck2 className="w-3.5 h-3.5 text-[#8C6D14] shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 7. PRÓXIMO PASSO — COMPARATIVO DAS DUAS MODALIDADES DE CONSULTORIA */}
        <section className="no-print bg-white border border-[#E5DFD2] rounded-2xl p-6 sm:p-9 space-y-6">
          <div className="space-y-1.5 max-w-2xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8C6D14]">
              Próximo passo — Escolha como prefere conduzir seu processo
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0B1F33]">
              Transforme este diagnóstico em um processo seguro e bem protocolado
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Opte pela <strong>Consultoria Orientativa</strong> (você protocola com nossa conferência técnica e checklist exato) ou pela <strong>Consultoria Completa</strong> (nossa equipe executa e acompanha todas as etapas por você).
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consultoria Orientativa */}
            <div className="rounded-2xl border border-[#E5DFD2] bg-[#FAF9F6] p-6 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {planOrientativa.badgeLabel}
                  </p>
                  <h3 className="font-display text-xl font-bold text-[#0B1F33]">{planOrientativa.nome}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{planOrientativa.subtitulo}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-[#E5DFD2] text-xs text-slate-700 leading-relaxed">
                  <strong className="text-[#0B1F33]">Protocolo SERMIG:</strong> realizado pelo próprio cliente com nosso guia técnico e auditoria prévia dos documentos.
                </div>

                <ul className="space-y-2.5 text-xs text-slate-700">
                  {planOrientativa.inclui.map((item) => (
                    <li key={item} className="flex items-start gap-2 leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-[#146B43] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2">
                <a
                  href={buildPlanWaUrl(planOrientativa.nome)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (onLogWhatsApp) void onLogWhatsApp('Interesse Consultoria Orientativa', waMessage);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#0B1F33] text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar sobre Consultoria Orientativa
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Consultoria Completa */}
            <div className="rounded-2xl border-2 border-[#0B1F33] bg-[#0B1F33] text-white p-6 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#E6C55A]">
                    {planCompleta.badgeLabel} · Execução integral
                  </p>
                  <h3 className="font-display text-xl font-bold text-white">{planCompleta.nome}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{planCompleta.subtitulo}</p>
                </div>

                <div className="p-3.5 rounded-xl bg-white/10 border border-white/15 text-xs text-slate-100 leading-relaxed">
                  <strong className="text-white">Protocolo SERMIG:</strong> conduzido integralmente pela nossa equipe, do dossiê ao Estampado Eletrônico e Cédula.
                </div>

                <ul className="space-y-2.5 text-xs text-slate-200">
                  {planCompleta.inclui.map((item) => (
                    <li key={item} className="flex items-start gap-2 leading-relaxed">
                      <CheckCircle2 className="w-4 h-4 text-[#E6C55A] shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2">
                <a
                  href={buildPlanWaUrl(planCompleta.nome)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    if (onLogWhatsApp) void onLogWhatsApp('Interesse Consultoria Completa', waMessage);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#C9A227] text-[#0B1523] text-sm font-bold hover:bg-[#d6b13a] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar sobre Consultoria Completa
                  <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-[#E5DFD2] text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              {onOpenCalendly && (
                <button
                  type="button"
                  onClick={onOpenCalendly}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#DDD6C7] bg-white font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] hover:border-[#C8A236]/60 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#8C6D14]" />
                  Agendar conversa inicial
                </button>
              )}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('/acompanhar')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#DDD6C7] bg-white font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] hover:border-[#C8A236]/60 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-[#0B1F33]" />
                  Já contratei — acessar Portal
                </button>
              )}
            </div>
            {onRestart && (
              <button
                type="button"
                onClick={onRestart}
                className="inline-flex items-center gap-1.5 text-[#4A5A6D] hover:text-[#0B1F33] font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Refazer diagnóstico
              </button>
            )}
          </div>
        </section>

        <p className="text-[11px] text-slate-500 text-center max-w-3xl mx-auto leading-relaxed">
          {empresa.avisoLegal}
        </p>

        <PdfPreviewModal
          open={Boolean(pdfPreview)}
          title={pdfPreview?.title || 'Dossiê de Elegibilidade Migratória'}
          filename={pdfPreview?.filename || 'dossie-diagnostico.pdf'}
          blobUrl={pdfPreview?.blobUrl || null}
          onClose={closePdfPreview}
          onDownload={() => {
            if (!pdfPreview) return;
            const a = document.createElement('a');
            a.href = pdfPreview.blobUrl;
            a.download = pdfPreview.filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
          }}
        />
      </div>
    );
  }

  const handleDownloadReactPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy('download');
    setPdfFeedback(null);
    try {
      const { exportDiagnosticoCompletoPdf } = await import('./pdf/ClientPortalPdfDocuments');
      const filename = await exportDiagnosticoCompletoPdf({
        empresa,
        result,
        answers,
        aiDraft,
        hideCosts,
        savedLeadId,
      });
      setPdfFeedback(`PDF gerado e baixado (${filename}).`);
    } catch (err) {
      setPdfFeedback(err instanceof Error ? err.message : 'Não foi possível gerar o PDF do diagnóstico.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleDownloadExecutiveClientJsPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy('download-2p');
    setPdfFeedback(null);
    try {
      const { exportClientDiagnosticPdf } = await import('../utils/clientDiagnosticPdf');
      const protocoloRef = savedLeadId ? savedLeadId.slice(-8).toUpperCase() : 'PRELIMINAR';
      const filename = await exportClientDiagnosticPdf({
        empresa,
        result,
        answers,
        protocolo: protocoloRef,
        hideCosts,
        locale,
        aiDraft,
      });
      setPdfFeedback(`Diagnóstico Completo D&M Integra (jsPDF 2 páginas) baixado (${filename}).`);
    } catch (err) {
      setPdfFeedback(err instanceof Error ? err.message : 'Não foi possível gerar o Diagnóstico em PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handlePreviewExecutiveClientJsPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy('preview-2p');
    setPdfFeedback(null);
    try {
      const { buildClientDiagnosticPdfBlob } = await import('../utils/clientDiagnosticPdf');
      const protocoloRef = savedLeadId ? savedLeadId.slice(-8).toUpperCase() : 'PRELIMINAR';
      const { blob, filename } = await buildClientDiagnosticPdfBlob({
        empresa,
        result,
        answers,
        protocolo: protocoloRef,
        hideCosts,
        locale,
        aiDraft,
      });
      const blobUrl = URL.createObjectURL(blob);
      setPdfPreview((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return {
          title: 'Diagnóstico Migratório Completo D&M Integra (PDF 2 Páginas)',
          filename,
          blobUrl,
        };
      });
    } catch (err) {
      setPdfFeedback(err instanceof Error ? err.message : 'Não foi possível abrir a pré-visualização em PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handlePreviewReactPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy('preview');
    setPdfFeedback(null);
    try {
      const { buildDiagnosticoCompletoPdfBlob } = await import('./pdf/ClientPortalPdfDocuments');
      const { blob, filename } = await buildDiagnosticoCompletoPdfBlob({
        empresa,
        result,
        answers,
        aiDraft,
        hideCosts,
        savedLeadId,
      });
      const blobUrl = URL.createObjectURL(blob);
      setPdfPreview((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return {
          title: 'Pré-visualização: Relatório de Pré-Análise Migratória',
          filename,
          blobUrl,
        };
      });
    } catch (err) {
      setPdfFeedback(err instanceof Error ? err.message : 'Não foi possível abrir a pré-visualização em PDF.');
    } finally {
      setPdfBusy(null);
    }
  };

  const handleSendWhatsApp = async () => {
    const targetPhone = mode === 'consultant' ? answers.whatsapp || empresa.whatsapp : empresa.whatsapp;
    const url = buildWhatsAppUrl(targetPhone, waMessage);
    openExternalSafe(url);
    if (onLogWhatsApp) {
      await onLogWhatsApp(`Resumo Diagnóstico: ${answers.nome || 'Lead'}`, waMessage);
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(waMessage);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2500);
    } catch {
      // ignore clipboard errors
    }
  };

  const renderActionBlock = (title: string, badge: string, items: ActionPlanItem[], accentClass: string) => (
    <div className={`rounded-xl border p-4 space-y-2.5 ${accentClass}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
          {badge}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhuma ação pendente neste bloco.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="bg-white rounded-lg border border-slate-200/80 p-3 text-xs space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-900">{item.titulo}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 tabular-nums">
                  {item.validadeDias > 0 ? `Validade ${item.validadeDias}d` : 'Sem vencimento'}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">{item.detalhe}</p>
              <p className="text-[11px] text-slate-500">Órgão: {item.orgao}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Perfil 29 — Dados insuficientes
  if (result.dadosInsuficientes || !result.recomendada) {
    return (
      <div className="space-y-6">
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-sm flex items-start justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{result.avisoOrientativo}</p>
              <p className="text-xs text-amber-800 mt-1">{empresa.avisoLegal}</p>
            </div>
          </div>
          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refazer diagnóstico
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4">
          <h2 className="text-xl font-bold text-slate-900">Dados insuficientes para indicação de subcategoria</h2>
          <p className="text-sm text-slate-600">{result.mensagemDadosInsuficientes}</p>
          <ul className="space-y-1.5 text-sm text-slate-700">
            {result.informacoesQueMudariamResultado.map((info, i) => (
              <li key={i} className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                <span>{info}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4" id="diagnostic-report-root">
      {/* Cabeçalho A4 para Impressão / PDF */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-center gap-3">
          {empresa.logoUrl ? (
            <img src={empresa.logoUrl} alt={empresa.nome_empresa} className="h-12 w-auto object-contain" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#0F2537] text-white flex items-center justify-center font-bold text-sm">
              D&amp;M
            </div>
          )}
          <div>
            <p className="text-base font-bold text-slate-900">{empresa.nome_empresa}</p>
            <p className="text-xs text-slate-600">{empresa.razao_social_cnpj_rut}</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-700">
          <p className="font-bold">Relatório de Pré-Análise Migratória</p>
          <p>Emitido em {formatDateBR(new Date())} (America/Sao_Paulo)</p>
          <p>
            Regras {result.versaoRegras.versao} · {formatDateBR(result.versaoRegras.dataPublicacao)}
          </p>
        </div>
      </div>

      {/* Resumo Cliente no PDF/Topo */}
      <div className="hidden print:grid grid-cols-2 gap-3 p-3 rounded-lg border border-slate-300 text-xs">
        <div>
          <span className="font-semibold">Titular:</span> {answers.nome || '—'}
        </div>
        <div>
          <span className="font-semibold">E-mail / WhatsApp:</span> {answers.email || '—'} · {answers.whatsapp || '—'}
        </div>
        <div>
          <span className="font-semibold">Localização atual:</span> {answers.localizacao || '—'}
        </div>
        <div>
          <span className="font-semibold">Cidade / UF:</span> {answers.cidadeUf || '—'}
        </div>
      </div>

      {/* Aviso orientativo obrigatório + barra de ações */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{result.avisoOrientativo}</p>
            <p className="text-xs text-amber-800">{empresa.avisoLegal}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-amber-900">
              <span>
                Versão das regras: <strong>{result.versaoRegras.versao}</strong> ({formatDateBR(result.versaoRegras.dataPublicacao)})
              </span>
              {savedLeadId && savedLeadId !== 'local-preview' && (
                <span>· Protocolo: <strong>{savedLeadId}</strong></span>
              )}
              {resumeUrl && (
                <span>
                  · Link salvo:{' '}
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(resumeUrl).catch(() => {})}
                    className="underline font-semibold"
                  >
                    Copiar link do diagnóstico
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            disabled={pdfBusy !== null}
            onClick={() => void handleDownloadExecutiveClientJsPdf()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-[#0B1523] bg-[#C8A236] hover:bg-[#d6b145] whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {pdfBusy === 'download-2p' ? 'Gerando PDF...' : 'Exportar Diagnóstico PDF (2 Págs)'}
          </button>
          <button
            type="button"
            disabled={pdfBusy !== null}
            onClick={() => void handlePreviewExecutiveClientJsPdf()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#C8A236]/50 bg-[#FAF9F6] text-xs font-semibold text-[#0B1F33] hover:bg-[#F3EFE4] whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-[#8C6D14]" />
            {pdfBusy === 'preview-2p' ? 'Preparando...' : 'Pré-visualizar (2 Págs)'}
          </button>
          <button
            type="button"
            disabled={pdfBusy !== null}
            onClick={() => void handleDownloadReactPdf()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Download className="w-3.5 h-3.5" />
            {pdfBusy === 'download' ? 'Gerando PDF...' : 'Baixar PDF A4 (Interno)'}
          </button>
          <button
            type="button"
            disabled={pdfBusy !== null}
            onClick={() => void handlePreviewReactPdf()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" />
            {pdfBusy === 'preview' ? 'Preparando...' : 'Pré-visualizar Interno'}
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir
          </button>
          <button
            type="button"
            onClick={() => void handleSendWhatsApp()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1E7E34] text-white text-xs font-semibold hover:opacity-95 whitespace-nowrap shrink-0"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Enviar WhatsApp
          </button>
          <button
            type="button"
            onClick={() => void handleCopySummary()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Copy className="w-3.5 h-3.5" />
            {copiedMsg ? 'Resumo copiado!' : 'Copiar resumo'}
          </button>
          {onRestart && (
            <button
              type="button"
              onClick={onRestart}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-slate-800 hover:bg-amber-100/50 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Refazer
            </button>
          )}
        </div>
      </div>

      {pdfFeedback && (
        <div className="no-print p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
          <span>{pdfFeedback}</span>
          <button type="button" onClick={() => setPdfFeedback(null)} className="underline">
            Fechar
          </button>
        </div>
      )}

      {/* Contradições detectadas & Confiança */}
      {(result.contradicoes.length > 0 || result.informacoesQueMudariamResultado.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {result.contradicoes.length > 0 && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50/70 space-y-2">
              <div className="flex items-center gap-2 text-[#C82333] font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                Contradições detectadas ({result.contradicoes.length})
              </div>
              <ul className="space-y-2 text-xs text-slate-800">
                {result.contradicoes.map((c) => (
                  <li key={c.codigo} className="p-2.5 rounded-lg bg-white border border-red-200/80 space-y-1">
                    <p className="font-semibold text-slate-900">{c.titulo}</p>
                    <p className="text-slate-600">{c.descricao}</p>
                    <p className="font-medium text-[#C82333]">Pergunta de esclarecimento: {c.perguntaEsclarecimento}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.informacoesQueMudariamResultado.length > 0 && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[var(--color-primary)]" />
                Informações que mudariam este resultado
              </p>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {result.informacoesQueMudariamResultado.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-bold text-[var(--color-primary)]">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Alertas críticos / operacionais + Flags neutras "Prefiro falar com o consultor" */}
      {(result.alertas.length > 0 || result.flagsRevisaoConsultor.length > 0) && (
        <div className="space-y-2.5">
          {result.alertas.map((alerta, idx) => {
            const isCritico = alerta.includes('Risco Alto') || alerta.includes('Requer saída') || alerta.includes('Passaporte vencido');
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border text-sm font-medium flex items-start gap-3 ${
                  isCritico
                    ? 'bg-red-50 border-red-200 text-[#C82333]'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{alerta}</span>
              </div>
            );
          })}

          {result.flagsRevisaoConsultor.length > 0 && (
            <div className="p-3.5 rounded-xl border border-slate-300 bg-slate-50 text-xs text-slate-800 space-y-1">
              <p className="font-bold text-slate-900">Revisar com o consultor em atendimento reservado (LGPD):</p>
              <ul className="space-y-1">
                {result.flagsRevisaoConsultor.map((f) => (
                  <li key={f.campo}>• {f.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Card Principal + Indicador de Confiança + Viabilidade 7 Dimensões */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p className="text-xs font-semibold text-slate-500">
                Subcategoria recomendada · Código {result.recomendada.visa.codigo}
              </p>
              <span className={`px-2.5 py-0.5 rounded-md border text-xs font-semibold ${confidenceBadge}`}>
                Confiança: {result.confianca}
              </span>
            </div>

            {result.situacaoResidenciaAtual && (
              <div className="mb-3 inline-block px-3 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
                Situação atual: {result.situacaoResidenciaAtual}
              </div>
            )}

            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">
              {result.recomendada.visa.nomePortugues}
            </h2>
            <p className="text-sm text-slate-500 italic mb-3">{result.recomendada.visa.nomeEspanhol}</p>
            <p className="text-sm text-slate-700 leading-relaxed mb-4">{result.recomendada.motivo}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3.5 border-y border-slate-200 text-sm">
              <div>
                <p className="text-xs text-slate-500">Pontuação</p>
                <p className="font-bold text-slate-900 tabular-nums">{result.recomendada.nota}/100</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Permite trabalhar?</p>
                <p className="font-semibold text-slate-900">{result.recomendada.visa.permiteTrabalhar ? 'Sim' : 'Não'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">De dentro do Chile?</p>
                <p className="font-semibold text-slate-900">{result.recomendada.visa.permiteDentroChile}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Residência Definitiva</p>
                <p className="font-semibold text-slate-900">
                  {result.recomendada.visa.levaDefinitiva ? `Em ${result.recomendada.visa.mesesDefinitiva || 24} meses` : 'Não direta'}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div>
                <p className="text-xs font-semibold text-slate-700">Caminho operacional indicado</p>
                <p className="text-sm text-slate-600">{result.caminho}</p>
              </div>
              <div className="text-xs text-slate-500">
                {result.fatoresConfianca.join(' · ')}
              </div>
            </div>
          </div>
        </div>

        {/* Viabilidade 7 Dimensões */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">Índice de Viabilidade</p>
              <h3 className="text-xl font-bold text-slate-900">{result.viabilidade.veredito}</h3>
            </div>
            <div className="text-right">
              <span className="text-3xl font-bold tabular-nums" style={{ color: scoreColor }}>
                {result.viabilidade.total}
              </span>
              <span className="text-sm text-slate-500">/100</span>
            </div>
          </div>

          <div className="space-y-3">
            {result.viabilidade.dimensoes.map((dim) => {
              const pct = Math.round((dim.pontos / dim.maximo) * 100);
              return (
                <div key={dim.nome}>
                  <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>{dim.nome}</span>
                    <span className="tabular-nums">
                      {dim.pontos}/{dim.maximo}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: scoreColor }} />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{dim.observacao}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Plano de Ação em 3 Blocos */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Plano de Ação Personalizado em 3 Etapas</h2>
          <p className="text-xs text-slate-500">
            Ordenado por validade e prazo: documentos sem validade e mais demorados primeiro; certidões de 60 dias por último antes do protocolo.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {renderActionBlock('1. Faça agora', 'Imediato', result.planoAcao.facaAgora, 'border-slate-200 bg-slate-50/70')}
          {renderActionBlock('2. Em 30 dias', 'Preparação', result.planoAcao.em30Dias, 'border-slate-200 bg-slate-50/70')}
          {renderActionBlock('3. Antes do protocolo', 'Validade curta (60d)', result.planoAcao.antesProtocolo, 'border-amber-200 bg-amber-50/40')}
        </div>
      </div>

      {/* Taxas Oficiais (BRL e CLP) + Honorários A Consultar (Oculto para role assistente!) + Cronograma */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {!hideCosts && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div>
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">Taxas Oficiais &amp; Terceiros</p>
              <h2 className="text-lg font-bold text-slate-900">Estimativa de Taxas (BRL ↔ CLP)</h2>
              <p className="text-xs text-slate-500">{result.custosEstimados.avisoEstimativa}</p>
              <p className="text-[11px] font-medium text-slate-600 mt-1 tabular-nums">
                Câmbio de referência: 1 BRL ≈ {result.custosEstimados.taxaCambioBrlClp.toLocaleString('pt-BR')} CLP · 1 USD ≈ R${' '}
                {result.custosEstimados.taxaCambioUsdBrl.toFixed(2).replace('.', ',')}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Taxas estimadas em Reais</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {formatCurrency(result.custosEstimados.totalMinBrl, 'BRL')} a {formatCurrency(result.custosEstimados.totalMaxBrl, 'BRL')}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Conversão equivalente em Pesos Chilenos</p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">
                  {formatCurrency(result.custosEstimados.totalMinClp, 'CLP')} a {formatCurrency(result.custosEstimados.totalMaxClp, 'CLP')}
                </p>
              </div>
            </div>
            <ul className="divide-y divide-slate-200 text-xs">
              {result.custosEstimados.itensDetalhados.map((item, idx) => (
                <li key={idx} className="py-2 flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-3">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="font-semibold text-slate-900 tabular-nums sm:text-right">{item.valorTexto}</span>
                </li>
              ))}
            </ul>

            <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 space-y-2.5 no-print">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-900">Honorários de Assessoria D&amp;M: A consultar</p>
                <span className="text-[11px] font-semibold text-amber-800">Proposta sob medida</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cada processo tem um escopo diferente. Envie seu resultado para receber uma proposta fechada (em BRL ou CLP) considerando:
              </p>
              <ul className="text-[11px] text-slate-600 space-y-0.5">
                {result.custosEstimados.honorariosMotivosVariacao.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const numPessoas =
                      answers.familiaAcompanhante === true ? 1 + Math.max(1, answers.quantidadeDependentes || 1) : 1;
                    const msgProposta = `Olá! Concluí meu diagnóstico na ${empresa.nome_empresa}${
                      savedLeadId && savedLeadId !== 'local-preview' ? ` (Protocolo ${savedLeadId})` : ''
                    }.\nPerfil: ${answers.nome || 'Visitante'} · ${numPessoas} pessoa(s) · Subcategoria sugerida: ${recommendedTitle} (Viabilidade ${result.viabilidade.total}/100).\nGostaria de consultar os honorários e receber a proposta personalizada para minha assessoria.`;
                    const targetPhone = mode === 'consultant' ? answers.whatsapp || empresa.whatsapp : empresa.whatsapp;
                    openExternalSafe(buildWhatsAppUrl(targetPhone, msgProposta));
                    if (onLogWhatsApp) {
                      void onLogWhatsApp(`Solicitação de Honorários: ${answers.nome || 'Lead'}`, msgProposta);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#146B43] text-white text-xs font-semibold hover:opacity-95"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Consultar honorários no WhatsApp
                </button>
                {onOpenCalendly && (
                  <button
                    type="button"
                    onClick={onOpenCalendly}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-100"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Agendar conversa gratuita
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className={`bg-white border border-slate-200 rounded-2xl p-6 space-y-4 ${hideCosts ? 'lg:col-span-2' : ''}`}>
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[var(--color-primary)]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Cronograma Estimado em Faixas</h2>
              <p className="text-xs text-slate-500">Sem garantia de data exata ou deferimento automático</p>
            </div>
          </div>
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="font-semibold text-slate-900">Preparação documental</p>
              <p className="text-slate-600 mt-0.5">{result.cronogramaFaixas.preparacaoDocumental}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="font-semibold text-slate-900">Protocolo no SERMIG</p>
              <p className="text-slate-600 mt-0.5">{result.cronogramaFaixas.protocoloSermig}</p>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="font-semibold text-slate-900">Resposta do SERMIG</p>
              <p className="text-slate-600 mt-0.5">{result.cronogramaFaixas.respostaSermig}</p>
            </div>
            <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              {result.cronogramaFaixas.observacaoLegal}
            </p>
          </div>
        </div>
      </div>

      {/* Diagnóstico por Pessoa (somente quando família foi selecionada) */}
      {result.diagnosticoPorPessoa.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[var(--color-primary)]" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Consolidado Familiar — Diagnóstico por Pessoa</h2>
              <p className="text-xs text-slate-500">Diferenciação explícita de Titular e Dependentes</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.diagnosticoPorPessoa.map((p, idx) => (
              <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{p.nome}</p>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      p.papel === 'Titular' ? 'bg-[#0F2537] text-white' : 'bg-white border border-slate-300 text-slate-700'
                    }`}
                  >
                    {p.papel} · {p.parentesco}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[var(--color-primary)]">{p.subcategoriaIndicada}</p>
                <p className="text-xs text-slate-600">{p.observacao}</p>
                <ul className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-200">
                  {p.documentosEspecificos.map((d, j) => (
                    <li key={j}>• {d}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparativo 3 vias reforçado (3 subcategorias distintas, sem duplicar Mercosul 15) */}
      {(() => {
        const comp = result.comparativoMercosul;
        const principalIsMercosul = comp.principal?.visa.codigo === '15';
        const col1 = comp.colunas?.[0] || {
          papel: principalIsMercosul ? 'Recomendada · Mercosul 15' : 'Subcategoria Recomendada',
          codigo: comp.principal?.visa.codigo || '—',
          nomePortugues: comp.principal?.visa.nomePortugues || 'Principal',
          nota: comp.principal?.nota ?? 0,
          isPrincipal: true,
          isMercosul: principalIsMercosul,
        };
        const col2 = comp.colunas?.[1] || {
          papel: principalIsMercosul ? '2ª Opção Alternativa' : 'Mercosul (Cód. 15)',
          codigo: (comp.segundaOpcao || comp.mercosul).visa.codigo,
          nomePortugues: (comp.segundaOpcao || comp.mercosul).visa.nomePortugues,
          nota: (comp.segundaOpcao || comp.mercosul).nota,
          isPrincipal: false,
          isMercosul: (comp.segundaOpcao || comp.mercosul).visa.codigo === '15',
        };
        const col3 = comp.colunas?.[2] || {
          papel: '3ª Opção Alternativa',
          codigo: comp.terceiraOpcao?.visa.codigo || '—',
          nomePortugues: comp.terceiraOpcao?.visa.nomePortugues || 'Alternativa',
          nota: comp.terceiraOpcao?.nota ?? 0,
          isPrincipal: false,
          isMercosul: comp.terceiraOpcao?.visa.codigo === '15',
        };
        const sectionTitle = principalIsMercosul
          ? 'Comparativo Lado a Lado (Recomendada · Mercosul 15 × 2ª Opção × 3ª Opção)'
          : 'Comparativo Lado a Lado (Recomendada × Mercosul 15 × 3ª Opção)';

        return (
          <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl overflow-hidden shadow-[0_8px_26px_rgba(11,31,51,0.05)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.3)]">
            <div className="px-6 py-5 border-b border-[#EFECE3] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#0A1828] flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8C6D14] dark:text-[#E5C76B] mb-1">
                  Análise Comparativa Técnica · 3 Rotas Distintas
                </p>
                <h2 className="text-lg font-bold text-[#0B1F33] dark:text-white">{sectionTitle}</h2>
              </div>
              <p className="text-xs font-mono text-[#4A5A6D] dark:text-slate-300 tabular-nums shrink-0">
                Top 3 elegíveis: {result.top3.map((c) => `Cód. ${c.visa.codigo} (${c.nota})`).join(' · ')}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5DFD2] dark:border-[#1C324B] bg-[#F7F5F0] dark:bg-[#11263D]">
                    <th className="py-3.5 px-4 font-bold uppercase tracking-[0.08em] text-[11px] text-[#4A5A6D] dark:text-slate-300 w-[20%] align-top">
                      Critério
                    </th>
                    <th className="py-3.5 px-4 align-top w-[28%] bg-[#0B1F33]/[0.04] dark:bg-[#C8A236]/[0.1] border-x border-[#E5DFD2] dark:border-[#1F3752]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8C6D14] dark:text-[#E5C76B]">
                            {col1.papel}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#146B43] dark:text-emerald-400 tabular-nums">
                            {col1.nota}/100
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#0B1F33] dark:text-white leading-snug">
                          Cód. {col1.codigo} · {col1.nomePortugues}
                        </p>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 align-top w-[26%] border-r border-[#E5DFD2] dark:border-[#1F3752]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#4A5A6D] dark:text-slate-400">
                            {col2.papel}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#0B1F33] dark:text-slate-200 tabular-nums">
                            {col2.nota}/100
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#0B1F33] dark:text-slate-100 leading-snug">
                          Cód. {col2.codigo} · {col2.nomePortugues}
                        </p>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 align-top w-[26%]">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#4A5A6D] dark:text-slate-400">
                            {col3.papel}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-[#4A5A6D] dark:text-slate-300 tabular-nums">
                            {col3.nota}/100
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#0B1F33] dark:text-slate-200 leading-snug">
                          Cód. {col3.codigo} · {col3.nomePortugues}
                        </p>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE3] dark:divide-[#172C44]">
                  {comp.linhasFixas.map((row, idx) => (
                    <tr
                      key={row.criterio}
                      className={
                        idx % 2 === 1
                          ? 'bg-[#FAF9F6]/70 dark:bg-[#0A1828]/55'
                          : 'bg-white dark:bg-[#0D1E31]'
                      }
                    >
                      <td className="py-3 px-4 font-semibold text-[#0B1F33] dark:text-slate-200 align-top">
                        {row.criterio}
                      </td>
                      <td className="py-3 px-4 text-[#0B1F33] dark:text-white font-semibold bg-[#0B1F33]/[0.025] dark:bg-[#C8A236]/[0.05] border-x border-[#EFECE3] dark:border-[#1C324B] align-top leading-relaxed">
                        {row.principal}
                      </td>
                      <td className="py-3 px-4 text-[#37475A] dark:text-slate-200 border-r border-[#EFECE3] dark:border-[#1C324B] align-top leading-relaxed">
                        {row.mercosul}
                      </td>
                      <td className="py-3 px-4 text-[#4A5A6D] dark:text-slate-300 align-top leading-relaxed">
                        {row.terceiraOpcao}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Simulador "E se" para Consultor (somente modo consultant) */}
      {mode === 'consultant' && whatIfAnswers && onChangeWhatIf && (
        <div className="no-print bg-white border-2 border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-[var(--color-primary)]" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Simulador &quot;E se&quot; (Sem salvar alterações)</h2>
                <p className="text-xs text-slate-500">
                  Teste hipóteses na reunião (formalizar união, oferta formal, renovar passaporte) comparando com o diagnóstico original.
                </p>
              </div>
            </div>
            {onResetWhatIf && (
              <button
                type="button"
                onClick={onResetWhatIf}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Restaurar respostas originais
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={whatIfAnswers.vinculoFormalizado === true}
                onChange={(e) =>
                  onChangeWhatIf({
                    ...whatIfAnswers,
                    vinculoFamiliarChile: e.target.checked ? true : whatIfAnswers.vinculoFamiliarChile,
                    vinculoFormalizado: e.target.checked,
                  })
                }
              />
              <span>Formalizar vínculo familiar</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={whatIfAnswers.possuiOfertaTrabalhoFormal === true}
                onChange={(e) =>
                  onChangeWhatIf({
                    ...whatIfAnswers,
                    objetivo: e.target.checked ? 'trabalho_formal' : whatIfAnswers.objetivo,
                    possuiOfertaTrabalhoFormal: e.target.checked,
                  })
                }
              />
              <span>Assinar contrato formal</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={(whatIfAnswers.passaporteValidadeMeses || 0) >= 24 && whatIfAnswers.passaporteStatus !== 'vencido'}
                onChange={(e) =>
                  onChangeWhatIf({
                    ...whatIfAnswers,
                    passaporteStatus: e.target.checked ? 'valido' : 'vencido',
                    passaporteValidadeMeses: e.target.checked ? 36 : 0,
                  })
                }
              />
              <span>Passaporte renovado (36m)</span>
            </label>
            <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={whatIfAnswers.localizacao === 'No Brasil'}
                onChange={(e) =>
                  onChangeWhatIf({
                    ...whatIfAnswers,
                    localizacao: e.target.checked ? 'No Brasil' : answers.localizacao,
                    entradaRecenteChileTurista: false,
                  })
                }
              />
              <span>Simular retorno ao Brasil</span>
            </label>
          </div>

          {whatIfComparison && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50">
                <p className="text-[11px] font-bold uppercase text-slate-500 mb-1">Cenário Atual Salvo</p>
                <p className="text-sm font-bold text-slate-900">
                  {whatIfComparison.atual.recomendada?.visa.codigo} – {whatIfComparison.atual.recomendada?.visa.nomePortugues}
                </p>
                <p className="text-xs text-slate-600 mt-1 tabular-nums">
                  Viabilidade: {whatIfComparison.atual.viabilidade.total}/100 ({whatIfComparison.atual.viabilidade.veredito}) · Confiança:{' '}
                  {whatIfComparison.atual.confianca}
                </p>
              </div>
              <div className="p-4 rounded-xl border-2 border-[var(--color-primary)] bg-white">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="text-[11px] font-bold uppercase text-[var(--color-primary)]">Cenário Simulado (&quot;E se&quot;)</p>
                  <span
                    className={`text-xs font-bold tabular-nums ${
                      whatIfComparison.deltaViabilidade >= 0 ? 'text-[#1E7E34]' : 'text-[#C82333]'
                    }`}
                  >
                    {whatIfComparison.deltaViabilidade >= 0 ? `+${whatIfComparison.deltaViabilidade}` : whatIfComparison.deltaViabilidade} pts viabilidade
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">
                  {whatIfComparison.simulado.recomendada?.visa.codigo} – {whatIfComparison.simulado.recomendada?.visa.nomePortugues}
                </p>
                <p className="text-xs text-slate-600 mt-1 tabular-nums">
                  Viabilidade: {whatIfComparison.simulado.viabilidade.total}/100 ({whatIfComparison.simulado.viabilidade.veredito}) · Confiança:{' '}
                  {whatIfComparison.simulado.confianca}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Explicabilidade: "Por que esta indicação?" (Cliente vs Consultor) + IA Opcional */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Por que esta indicação?</h2>
            <p className="text-xs text-slate-500">
              Versão {result.versaoRegras.versao} · Explicação transparente ao cliente e trilha técnica ao consultor
            </p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <div className="flex items-center p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setExplainTab('cliente')}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                  explainTab === 'cliente' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Visão Cliente
              </button>
              <button
                type="button"
                onClick={() => setExplainTab('tecnico')}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${
                  explainTab === 'tecnico' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Visão Técnica
              </button>
            </div>
            {onOpenLaw && (
              <button
                type="button"
                onClick={onOpenLaw}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                <BookOpen className="w-4 h-4" />
                Ver Base Legal ({result.fontesLegais.length})
              </button>
            )}
            {onRefineAi && (
              <button
                type="button"
                disabled={aiLoading}
                onClick={onRefineAi}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Sparkles className="w-4 h-4" />
                {aiLoading ? aiProgress || 'Refinando com IA...' : 'Refinar parecer com IA'}
              </button>
            )}
          </div>
        </div>

        {explainTab === 'cliente' ? (
          <ul className="space-y-2 text-sm text-slate-700">
            {result.explicacaoCliente.map((msg, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#1E7E34] shrink-0 mt-0.5" />
                <span>{msg}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <ul className="space-y-1.5 text-xs text-slate-700">
              {result.regrasAcionadas.map((regra, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 mt-0.5" />
                  <span>{regra}</span>
                </li>
              ))}
            </ul>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-2 px-3 font-semibold">Subcategoria</th>
                    <th className="py-2 px-3 font-semibold">Base</th>
                    <th className="py-2 px-3 font-semibold">Ajustes</th>
                    <th className="py-2 px-3 font-semibold">Nota Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {result.notasPorSubcategoria.map((n) => (
                    <tr key={n.codigo}>
                      <td className="py-2 px-3 font-medium text-slate-900">
                        {n.codigo} – {n.nomePortugues}
                      </td>
                      <td className="py-2 px-3 tabular-nums">{n.notaBase}</td>
                      <td className="py-2 px-3 tabular-nums">{n.ajustes >= 0 ? `+${n.ajustes}` : n.ajustes}</td>
                      <td className="py-2 px-3 font-bold tabular-nums text-[var(--color-primary)]">{n.notaFinal}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {aiLoading && aiProgress && (
          <p className="text-xs font-medium text-slate-600" role="status" aria-live="polite">
            {aiProgress}
          </p>
        )}

        {aiError && (
          <p role="alert" className="text-xs text-[#C82333] bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {aiError}
          </p>
        )}

        {aiDraft && (
          <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-1">
                {aiDraft.fallback || aiDraft.origem === 'regras' ? (
                  <>
                    <span className="inline-block px-2.5 py-1 rounded-md bg-amber-100 border border-amber-300 text-[11px] font-bold text-amber-950">
                      {aiDraft.origemLabel || 'Rascunho gerado por regras — IA indisponível no momento'}
                    </span>
                    {aiDraft.mensagemUsuario && (
                      <p className="text-xs text-amber-900">{aiDraft.mensagemUsuario}</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs font-bold text-slate-800">
                    {aiDraft.origemLabel || 'Rascunho editável gerado por IA'} (sujeito à revisão do consultor · cita exclusivamente fontes cadastradas)
                  </p>
                )}
              </div>
              {onRefineAi && (
                <button
                  type="button"
                  disabled={aiLoading}
                  onClick={onRefineAi}
                  className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {aiLoading ? aiProgress || 'Tentando novamente...' : 'Tentar novamente com IA'}
                </button>
              )}
            </div>
            {onUpdateAiDraft ? (
              <textarea
                rows={4}
                value={aiDraft.resumoExecutivo}
                onChange={(e) => onUpdateAiDraft({ ...aiDraft, resumoExecutivo: e.target.value })}
                aria-label="Editar resumo executivo gerado por IA"
                className="w-full p-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800"
              />
            ) : (
              <p className="text-sm text-slate-800 leading-relaxed">{aiDraft.resumoExecutivo}</p>
            )}
            {aiDraft.riscos && aiDraft.riscos.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Riscos apontados no rascunho</p>
                <ul className="text-xs text-slate-600 space-y-1">
                  {aiDraft.riscos.map((r, i) => (
                    <li key={i}>• {r}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiDraft.perguntasConsultor && aiDraft.perguntasConsultor.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Perguntas sugeridas ao consultor</p>
                <ul className="text-xs text-slate-600 space-y-1">
                  {aiDraft.perguntasConsultor.map((q, i) => (
                    <li key={i}>• {q}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiDraft.pontosAtencao?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1">Pontos de atenção</p>
                <ul className="text-xs text-slate-600 space-y-1">
                  {aiDraft.pontosAtencao.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}
            {aiDraft.fontesCitadas?.length > 0 && (
              <p className="text-xs text-slate-500">Fontes citadas: {aiDraft.fontesCitadas.join(' · ')}</p>
            )}
          </div>
        )}
      </div>

      {/* Prontidão Documental (Semáforo + Checklist) + Perguntas + Descartadas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[var(--color-primary)]" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">Termômetro e Checklist Documental</h2>
                <p className="text-xs text-slate-500">Documentos já disponíveis vs. pendentes antes do protocolo</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                  result.checklistProntidao.semaforo === 'Verde'
                    ? 'bg-emerald-50 text-[#1E7E34] border-emerald-200'
                    : result.checklistProntidao.semaforo === 'Amarelo'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-red-50 text-[#C82333] border-red-200'
                }`}
              >
                Semáforo: {result.checklistProntidao.semaforo} ({result.checklistProntidao.percentualInicial}%)
              </span>
            </div>
          </div>

          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${result.checklistProntidao.percentualInicial}%`, backgroundColor: 'var(--color-primary)' }}
            />
          </div>

          <div className="divide-y divide-slate-200">
            {result.checklistProntidao.itens.map((item) => (
              <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{item.nomeDocumento}</p>
                  <p className="text-xs text-slate-500">
                    {item.categoriaDoc} · {item.obrigatorio ? 'Obrigatório' : 'Opcional'} ·{' '}
                    {item.validadeDias > 0 ? `Validade ${item.validadeDias} dias` : 'Sem vencimento curto'}
                    {item.exigeApostila ? ' · Apostila' : ''}
                    {item.exigeTraducao ? ' · Tradução' : ''}
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold shrink-0 border ${
                    item.statusInicial === 'Já possui'
                      ? 'bg-emerald-50 text-[#1E7E34] border-emerald-200'
                      : item.statusInicial === 'Crítico / Validade curta'
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  {item.statusInicial}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[var(--color-primary)]" />
              Perguntas para a reunião
            </h2>
            <ul className="space-y-2 text-xs text-slate-600">
              {result.perguntasComplementares.map((q, i) => (
                <li key={i}>• {q}</li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-base font-bold text-slate-900 mb-3">Subcategorias descartadas</h2>
            <ul className="space-y-2 text-xs text-slate-600">
              {result.descartadas.slice(0, 6).map((d) => (
                <li key={d.codigo}>
                  <span className="font-semibold text-slate-800">
                    {d.codigo} – {d.nomePortugues}:
                  </span>{' '}
                  {d.motivo}
                </li>
              ))}
            </ul>
          </div>

          {mode === 'consultant' && leadHistory && leadHistory.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="text-base font-bold text-slate-900 mb-3">Histórico de Recálculos</h2>
              <ul className="space-y-2 text-xs text-slate-600">
                {leadHistory.map((h, i) => (
                  <li key={i} className="border-b border-slate-100 pb-1.5">
                    <span className="font-semibold text-slate-800">{h.versaoRegras}</span> ({formatDateBR(h.dataCalculo)}):{' '}
                    {h.subcategoriaSugerida} · {h.notaViabilidade}/100 ({h.confianca})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Rodapé legal impresso no PDF A4 */}
      <div className="hidden print:block pt-4 border-t border-slate-300 text-[11px] text-slate-600 space-y-1">
        <p className="font-bold text-slate-800">{result.avisoOrientativo}</p>
        <p>{empresa.avisoLegal}</p>
      </div>

      <PdfPreviewModal
        open={Boolean(pdfPreview)}
        title={pdfPreview?.title || 'Pré-visualização do Diagnóstico'}
        filename={pdfPreview?.filename || 'diagnostico.pdf'}
        blobUrl={pdfPreview?.blobUrl || null}
        onClose={closePdfPreview}
        onDownload={() => {
          if (!pdfPreview) return;
          const a = document.createElement('a');
          a.href = pdfPreview.blobUrl;
          a.download = pdfPreview.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }}
      />
    </div>
  );
};
