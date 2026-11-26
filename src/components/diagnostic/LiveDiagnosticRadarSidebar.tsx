import React from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Clock,
  Compass,
  FileCheck2,
  Scale,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { DiagnosticAnswers } from '../../types/domain';
import type { DiagnosticResult } from '../../utils/diagnosticEngine';
import { getStepLiveRecommendation, type LiveSermigPreview } from '../../utils/sermigDiagnosticQuestions';
import { getJurisdictionTextClass } from '../../utils/legalJurisdiction';
import type { LiveDiagnosticIntelligence } from '../../utils/smartDiagnosticInterpreter';
import { LiveViabilityGauge } from './DiagnosticRadarChart';

interface StepItem {
  readonly num: number;
  readonly title: string;
}

interface LiveDiagnosticRadarSidebarProps {
  answers: DiagnosticAnswers;
  step: number;
  maxStepReached?: number;
  steps: readonly StepItem[];
  livePreview: LiveSermigPreview;
  liveResult: DiagnosticResult;
  intelligence?: LiveDiagnosticIntelligence;
  contradictionsCount: number;
  isAdmin: boolean;
  onJumpToStep?: (stepNum: number) => void;
}

export const LiveDiagnosticRadarSidebar: React.FC<LiveDiagnosticRadarSidebarProps> = ({
  answers,
  step,
  maxStepReached = step,
  steps,
  livePreview,
  liveResult,
  intelligence,
  contradictionsCount,
  isAdmin,
  onJumpToStep,
}) => {
  const score = Math.round(liveResult.viabilidade?.total || 0);
  const allDimensions = liveResult.viabilidade?.dimensoes || [];
  const stepRecommendation = getStepLiveRecommendation(step, answers, liveResult, livePreview);

  const protocolRuleText =
    answers.localizacao === 'No Chile como turista'
      ? 'Pela Ley Nº 21.325, a troca de turista para residência dentro do Chile sofre restrição legal, salvo exceções como reunificação familiar formalizada.'
      : answers.localizacao === 'No Chile com residência'
        ? 'Residentes vigentes podem protocolar prorrogação, mudança de subcategoria ou Residência Definitiva dentro do Chile (janela legal de 90 a 10 dias antes do vencimento).'
        : 'Protocolo digital realizado pelo portal oficial SERMIG ainda fora do Chile, com aprovação prévia ao embarque.';

  const impact = intelligence?.impactBanner || null;
  const routeRace = intelligence?.routeRace || [];
  const optimizer = intelligence?.bottleneckOptimizer || null;
  const timeline = intelligence?.smartTimeline || null;

  return (
    <aside data-onboarding-target="live-radar" className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
      {/* Painel Principal: Radar de Viabilidade ao Vivo (Corporate Navy + Sapphire + Brass) */}
      <div className="rounded-xl overflow-hidden border border-[#1E293B] bg-[#070E1C] text-white shadow-[0_14px_34px_rgba(7,14,28,0.18)]">
        <div className="p-5 space-y-5">
          {/* Título do Radar */}
          <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-white/10">
            <div>
              <p className="text-xs font-semibold text-[#C9A86A] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                Radar de Viabilidade ao vivo
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Recalculado em tempo real pela base SERMIG
              </p>
            </div>
            <span className="font-mono text-[11px] font-bold text-slate-300 tabular-nums shrink-0">
              {step}/6
            </span>
          </div>

          {/* Pulso Dinâmico de Impacto (aparece quando pontuação ou rota muda) */}
          <AnimatePresence initial={false}>
            {impact && (
              <motion.div
                key={`${impact.headline}-${score}`}
                data-testid="live-impact-banner"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 leading-snug ${
                  impact.tone === 'positivo'
                    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
                    : impact.tone === 'atencao'
                      ? 'bg-amber-500/15 border-amber-400/35 text-amber-100'
                      : 'bg-blue-500/15 border-blue-400/30 text-blue-100'
                }`}
              >
                {impact.tone === 'positivo' ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-[#C9A86A] shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="font-bold">{impact.headline}</p>
                  <p className="text-[11px] opacity-90 mt-0.5">{impact.detail}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Medidor Radial + Rota Líder */}
          <div className="flex items-center gap-4">
            <LiveViabilityGauge score={score} confidence={liveResult.confianca} size={118} />

            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[11px] font-medium text-slate-400">
                Tendência atual SERMIG
              </p>
              {livePreview.subcategoriaLider ? (
                <>
                  <p data-testid="live-radar-route" className="text-sm font-bold text-white leading-snug">
                    {livePreview.subcategoriaLider.nomePortugues}
                  </p>
                  <p className="text-[11px] text-slate-300 italic leading-snug line-clamp-2">
                    {livePreview.subcategoriaLider.nomeEspanhol}
                  </p>
                </>
              ) : (
                <p className="text-xs text-slate-300 leading-relaxed">
                  Avance nas etapas para identificar sua rota principal.
                </p>
              )}
              {livePreview.situacaoResidenciaAtual && (
                <p className="text-[11px] font-semibold text-[#C9A86A] pt-0.5">
                  {livePreview.situacaoResidenciaAtual}
                </p>
              )}
            </div>
          </div>

          {/* Corrida Dinâmica das Top-3 Rotas SERMIG */}
          {routeRace.length > 1 && (
            <div data-testid="live-route-race" className="pt-3.5 border-t border-white/10 space-y-2.5">
              <p className="text-[11px] font-medium text-slate-300">
                Disputa ao vivo · Top {routeRace.length} rotas SERMIG
              </p>
              <div className="space-y-2">
                {routeRace.map((item) => (
                  <div key={item.codigo} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span
                        className={`truncate ${
                          item.isLeader ? 'font-semibold text-white' : 'text-slate-300'
                        }`}
                        title={item.nomePortugues}
                      >
                        <span className="font-mono text-[#C9A86A] mr-1">Cód.{item.codigo}</span>
                        {item.nomePortugues}
                      </span>
                      <span className="font-mono font-semibold text-slate-200 tabular-nums shrink-0">
                        {item.compatibilityPct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={false}
                        animate={{
                          width: `${Math.max(10, item.compatibilityPct)}%`,
                          backgroundColor: item.isLeader ? '#3B82F6' : '#64748B',
                        }}
                        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">{item.highlightTag}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barras ao vivo dos 7 pilares de viabilidade */}
          {allDimensions.length > 0 && (
            <div className="pt-3.5 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-medium text-slate-300">
                  7 pilares do Radar em tempo real
                </p>
                <span className="font-mono text-[10px] text-[#60A5FA] tabular-nums">
                  {liveResult.viabilidade?.veredito || 'Em cálculo'}
                </span>
              </div>
              <div className="space-y-2">
                {allDimensions.map((dim) => {
                  const pct =
                    dim.maximo > 0 ? Math.min(100, Math.max(0, Math.round((dim.pontos / dim.maximo) * 100))) : 0;
                  const fill = pct >= 75 ? '#3B82F6' : pct >= 50 ? '#C9A86A' : '#F59E0B';
                  return (
                    <div key={dim.nome} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-2 text-[11px]">
                        <span className="text-slate-200 truncate" title={dim.observacao}>
                          {dim.nome}
                        </span>
                        <span className="font-mono font-semibold text-white tabular-nums shrink-0">
                          {dim.pontos}/{dim.maximo}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          initial={false}
                          animate={{ width: `${Math.max(4, pct)}%`, backgroundColor: fill }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Maior Alavanca de Viabilidade (Otimizador em tempo real) */}
          {optimizer && (
            <div
              data-testid="live-bottleneck-optimizer"
              className="rounded-lg bg-white/[0.05] border border-white/12 p-3.5 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-[#C9A86A] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  Maior alavanca do seu índice
                </p>
                <span className="font-mono text-[11px] font-bold text-emerald-300 tabular-nums">
                  +{optimizer.potentialBoostPts} pts
                </span>
              </div>
              <p className="text-xs font-semibold text-white leading-snug">{optimizer.actionTitle}</p>
              <p className="text-[11px] text-slate-300 leading-relaxed">{optimizer.actionDetail}</p>
              {onJumpToStep && optimizer.targetStep !== step && optimizer.targetStep <= maxStepReached && (
                <button
                  type="button"
                  onClick={() => onJumpToStep(optimizer.targetStep)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#60A5FA] hover:text-white transition-colors pt-0.5"
                >
                  Revisar na Etapa 0{optimizer.targetStep}
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Alerta ativo ou verificação limpa */}
          {contradictionsCount > 0 ? (
            <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-400/35 text-xs text-amber-100 flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[#C9A86A] shrink-0 mt-0.5" />
              <span>
                {contradictionsCount === 1
                  ? '1 inconsistência detectada — use a correção em 1 clique no formulário.'
                  : `${contradictionsCount} inconsistências detectadas — revise os alertas no formulário.`}
              </span>
            </div>
          ) : livePreview.alertaPrincipal ? (
            <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-400/35 text-xs text-amber-100 flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[#C9A86A] shrink-0 mt-0.5" />
              <span>{livePreview.alertaPrincipal}</span>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-emerald-500/12 border border-emerald-400/25 text-xs text-emerald-100 flex items-start gap-2 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Sem contradições normativas detectadas até o momento.</span>
            </div>
          )}

          {/* Bloco técnico adicional exclusivo para Administradores */}
          {isAdmin && livePreview.prontoParaPrevia && (
            <div className="pt-3.5 border-t border-white/10 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-lg bg-white/[0.05] border border-white/10 p-2.5">
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <FileCheck2 className="w-3 h-3 text-[#60A5FA]" />
                    Obrigatórios
                  </p>
                  <p className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                    {livePreview.requisitosObrigatoriosCount} itens
                  </p>
                </div>
                <div className="rounded-lg bg-white/[0.05] border border-white/10 p-2.5">
                  <p className="text-[10px] text-slate-400">Validade 60 dias</p>
                  <p className="font-mono text-sm font-bold text-white tabular-nums mt-0.5">
                    {livePreview.requisitosPrazoCurtoCount}{' '}
                    {livePreview.requisitosPrazoCurtoCount === 1 ? 'certidão' : 'certidões'}
                  </p>
                </div>
              </div>
              {livePreview.fontesLegais.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-slate-400">
                    Normas consultadas (Admin)
                  </p>
                  <ul className="space-y-1">
                    {livePreview.fontesLegais.map((src) => (
                      <li key={src.id} className="text-[11px] text-slate-300 leading-snug">
                        <span className="text-[#C9A86A] font-semibold">{src.jurisdicao}</span>
                        {' · '}
                        {src.titulo.split('–')[0].trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cartão Secundário: Recomendação da Etapa + Previsão de Cronograma + Progresso */}
      <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-5 space-y-4">
        <div
          className={`rounded-lg border p-3.5 space-y-1.5 ${
            stepRecommendation.tom === 'atencao'
              ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/50'
              : stepRecommendation.tom === 'positivo'
                ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-800/50'
                : 'bg-[#F7F8FA] dark:bg-[#111A2C] border-[#E5E7EB] dark:border-[#1E293B]'
          }`}
        >
          <p className="text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
            Recomendação da etapa 0{stepRecommendation.etapa}
          </p>
          <p className="text-xs font-bold text-[#0B1628] dark:text-white leading-snug">{stepRecommendation.titulo}</p>
          <p className="text-[11px] text-[#475569] dark:text-slate-300 leading-relaxed">{stepRecommendation.orientacao}</p>
          <p className="text-[11px] font-medium text-[#0B1628] dark:text-slate-100 pt-1 border-t border-black/5 dark:border-white/10">
            <strong>Ação prática:</strong> {stepRecommendation.acaoPratica}
          </p>
        </div>

        {/* Previsão de Cronograma SERMIG */}
        {timeline && (
          <div className="rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#111A2C] p-3.5 space-y-2">
            <p className="text-xs font-semibold text-[#0B1628] dark:text-white flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#C9A86A] shrink-0" />
              Previsão de Cronograma SERMIG
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[#64748B] dark:text-slate-400 block">Preparo documental</span>
                <span className="font-mono font-semibold text-[#0B1628] dark:text-white tabular-nums">
                  {timeline.docPrep}
                </span>
              </div>
              <div>
                <span className="text-[#64748B] dark:text-slate-400 block">Análise SERMIG</span>
                <span className="font-mono font-semibold text-[#0B1628] dark:text-white tabular-nums">
                  {timeline.sermigWait}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-[#475569] dark:text-slate-300 leading-snug pt-1 border-t border-[#E5E7EB] dark:border-[#1E293B]">
              {timeline.pfWarning}
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA] flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 shrink-0" />
            Jurisdição SERMIG · {answers.localizacao}
          </p>
          <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">{protocolRuleText}</p>
        </div>

        <div className="pt-3.5 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-1.5">
          <p className="text-xs font-semibold text-[#0B1628] dark:text-white mb-2">
            Progresso das 6 etapas
          </p>
          {steps.map((item) => {
            const done = item.num < step;
            const active = item.num === step;
            const reachable = Boolean(onJumpToStep && item.num <= maxStepReached);
            return (
              <button
                key={item.num}
                type="button"
                disabled={!reachable}
                onClick={() => {
                  if (reachable && onJumpToStep) onJumpToStep(item.num);
                }}
                className={`w-full flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-colors text-left ${
                  active
                    ? 'border-[#0B1628] dark:border-[#3B82F6] bg-[#F7F8FA] dark:bg-[#131F33] font-semibold text-[#0B1628] dark:text-white'
                    : done
                      ? 'border-emerald-200/90 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/35'
                      : reachable
                        ? 'border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] text-slate-600 dark:text-slate-300 hover:bg-[#F7F8FA] dark:hover:bg-[#131F33]'
                        : 'border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] text-slate-400 dark:text-slate-500 cursor-not-allowed'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-bold tabular-nums">0{item.num}</span>
                  <span className="truncate">{item.title}</span>
                </span>
                {done && <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />}
                {active && <span className="text-[11px] font-semibold text-[#0F3D91] dark:text-[#60A5FA]">Atual</span>}
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#1E293B] text-[11px] text-[#64748B] dark:text-slate-400 leading-relaxed">
          Ao concluir a etapa 6, você libera imediatamente o <strong className="text-[#0B1628] dark:text-white">Gráfico Radar</strong>, o{' '}
          <strong className="text-[#0B1628] dark:text-white">Simulador &ldquo;E se...&rdquo;</strong> e o{' '}
          <strong className="text-[#0B1628] dark:text-white">Dossiê PDF de 2 páginas</strong>.
          {isAdmin && (
            <span className={`block mt-1 ${getJurisdictionTextClass('Brasil')}`}>
              Proteção de dados conforme LGPD (Lei nº 13.709/2018).
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};
