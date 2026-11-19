import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  Eye,
  FileCheck2,
  FlaskConical,
  HelpCircle,
  MessageCircle,
  Printer,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { PdfPreviewModal } from './pdf/PdfPreviewModal';
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
} from '../utils/formatters';
import { getJurisdictionLabel, getJurisdictionTextClass } from '../utils/legalJurisdiction';

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
  leadHistory,
}) => {
  const [explainTab, setExplainTab] = useState<'cliente' | 'tecnico'>(mode === 'consultant' ? 'tecnico' : 'cliente');
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<'download' | 'preview' | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; filename: string; blobUrl: string } | null>(null);

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

  const closePdfPreview = () => {
    setPdfPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

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
    window.open(url, '_blank', 'noopener,noreferrer');
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
          <BrandLogo src={empresa.logoUrl} alt={empresa.nome_empresa} variant="emblem" className="h-12 w-12 shrink-0" />
          <div>
            <p className="text-base font-bold text-slate-900">{empresa.nome_empresa}</p>
            <p className="text-xs text-slate-600">{empresa.razao_social_cnpj_rut}</p>
          </div>
        </div>
        <div className="text-right text-xs text-slate-700">
          <p className="font-bold">Relatório de Pré-Análise Migratória</p>
          <p>Emitido em {formatDateBR(new Date())} (horário de Brasília)</p>
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
            onClick={() => void handleDownloadReactPdf()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Download className="w-3.5 h-3.5" />
            {pdfBusy === 'download' ? 'Gerando PDF...' : 'Baixar PDF A4'}
          </button>
          <button
            type="button"
            disabled={pdfBusy !== null}
            onClick={() => void handlePreviewReactPdf()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" />
            {pdfBusy === 'preview' ? 'Preparando...' : 'Pré-visualizar PDF'}
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
              <p className="font-bold text-slate-900">
                Revisar com o consultor em atendimento reservado (Legislação Brasileira — LGPD, Lei nº 13.709/2018):
              </p>
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

          {mode === 'public' && (
            <div className="no-print pt-4 border-t border-slate-200 flex flex-wrap gap-2.5">
              {onOpenCalendly && (
                <button
                  type="button"
                  onClick={onOpenCalendly}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Calendar className="w-4 h-4" />
                  Agendar consulta
                </button>
              )}
              {empresa.linkCalendly && (
                <a
                  href={empresa.linkCalendly}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Abrir agenda em nova aba
                </a>
              )}
              <button
                type="button"
                onClick={() => void handleSendWhatsApp()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1E7E34] hover:opacity-95"
              >
                <MessageCircle className="w-4 h-4" />
                Falar no WhatsApp
              </button>
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('/acompanhar')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <UserCheck className="w-4 h-4" />
                  Acompanhar meu processo
                </button>
              )}
            </div>
          )}
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
              <p className="text-xs font-semibold text-amber-800">Taxas Oficiais e Terceiros</p>
              <h2 className="text-lg font-bold text-slate-900">Estimativa de Taxas (BRL e CLP)</h2>
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
                Cada processo possui um escopo específico. Envie seu resultado para receber uma proposta personalizada (em BRL ou CLP) considerando:
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
                    const pessoasTexto = numPessoas === 1 ? '1 pessoa' : `${numPessoas} pessoas`;
                    const msgProposta = `Olá! Concluí meu diagnóstico na ${empresa.nome_empresa}${
                      savedLeadId && savedLeadId !== 'local-preview' ? ` (Protocolo ${savedLeadId})` : ''
                    }.\nPerfil: ${answers.nome || 'Visitante'} · ${pessoasTexto} · Subcategoria sugerida: ${recommendedTitle} (Viabilidade ${result.viabilidade.total}/100).\nGostaria de consultar os honorários e receber a proposta personalizada para minha assessoria.`;
                    const targetPhone = mode === 'consultant' ? answers.whatsapp || empresa.whatsapp : empresa.whatsapp;
                    window.open(buildWhatsAppUrl(targetPhone, msgProposta), '_blank', 'noopener,noreferrer');
                    if (onLogWhatsApp) {
                      void onLogWhatsApp(`Solicitação de Honorários: ${answers.nome || 'Lead'}`, msgProposta);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E7E34] text-white text-xs font-semibold hover:opacity-95"
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
                    Agendar consulta gratuita
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

      {/* Comparativo 3 vias reforçado (Recomendada x Mercosul 15 x Terceira opção) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 overflow-x-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Comparativo Lado a Lado (Recomendada × Mercosul 15 × 3ª Opção)</h2>
            <p className="text-xs text-slate-500">Top 3 elegíveis: {result.top3.map((c) => `${c.visa.codigo} (${c.nota})`).join(' · ')}</p>
          </div>
        </div>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="py-2.5 px-3 font-semibold">Critério</th>
              <th className="py-2.5 px-3 font-semibold text-slate-900">Subcategoria Principal</th>
              <th className="py-2.5 px-3 font-semibold">Mercosul (Cód. 15)</th>
              <th className="py-2.5 px-3 font-semibold">3ª Opção Alternativa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {result.comparativoMercosul.linhasFixas.map((row) => (
              <tr key={row.criterio}>
                <td className="py-2.5 px-3 font-semibold text-slate-700">{row.criterio}</td>
                <td className="py-2.5 px-3 text-slate-900 font-medium">{row.principal}</td>
                <td className="py-2.5 px-3 text-slate-700">{row.mercosul}</td>
                <td className="py-2.5 px-3 text-slate-600">{row.terceiraOpcao}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

        {result.fontesLegais.length > 0 && (
          <div className="pt-4 border-t border-slate-200 space-y-2">
            <p className="text-xs font-semibold text-slate-600">
              Fontes normativas consultadas (identificação por jurisdição)
            </p>
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-slate-50/50 text-xs">
              {result.fontesLegais.map((src) => (
                <li key={src.id} className="px-3.5 py-2.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-slate-800 font-medium">
                    {src.titulo}
                    {src.numeroAno ? ` (${src.numeroAno})` : ''}
                  </span>
                  <span className={getJurisdictionTextClass(src.pais)}>
                    {getJurisdictionLabel(src.pais)}
                  </span>
                </li>
              ))}
            </ul>
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
                <p className="text-xs text-slate-500">Documentos disponíveis e pendentes antes do protocolo</p>
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
