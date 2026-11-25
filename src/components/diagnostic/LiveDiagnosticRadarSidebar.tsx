import React from 'react';
import { AlertTriangle, Check, Compass, FileCheck2, Scale, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { BrandRibbon } from '../BrandLogo';
import type { DiagnosticAnswers } from '../../types/domain';
import type { DiagnosticResult } from '../../utils/diagnosticEngine';
import { getStepLiveRecommendation, type LiveSermigPreview } from '../../utils/sermigDiagnosticQuestions';
import { getJurisdictionTextClass } from '../../utils/legalJurisdiction';
import { LiveViabilityGauge } from './DiagnosticRadarChart';

interface StepItem {
  readonly num: number;
  readonly title: string;
}

interface LiveDiagnosticRadarSidebarProps {
  answers: DiagnosticAnswers;
  step: number;
  steps: readonly StepItem[];
  livePreview: LiveSermigPreview;
  liveResult: DiagnosticResult;
  contradictionsCount: number;
  isAdmin: boolean;
}

export const LiveDiagnosticRadarSidebar: React.FC<LiveDiagnosticRadarSidebarProps> = ({
  answers,
  step,
  steps,
  livePreview,
  liveResult,
  contradictionsCount,
  isAdmin,
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

  return (
    <aside data-onboarding-target="live-radar" className="lg:col-span-4 lg:sticky lg:top-24 space-y-4">
      {/* Painel Principal: Radar de Viabilidade ao Vivo (Azul Marinho + Ouro) */}
      <div className="rounded-2xl overflow-hidden border border-[#1E3349] bg-[#0B1F33] text-white shadow-[0_14px_34px_rgba(11,31,51,0.16)]">
        <BrandRibbon className="h-[3px] w-full" />

        <div className="p-5 space-y-5">
          {/* Título do Radar */}
          <div className="flex items-start justify-between gap-2 pb-3.5 border-b border-white/10">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E6C55A] flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 shrink-0" />
                Radar de Viabilidade ao Vivo
              </p>
              <p className="text-xs text-slate-300 mt-1">
                Leitura normativa atualizada a cada resposta
              </p>
            </div>
            <span className="font-mono text-[11px] font-bold text-slate-300 tabular-nums shrink-0">
              {step}/6
            </span>
          </div>

          {/* Medidor Radial + Rota Líder */}
          <div className="flex items-center gap-4">
            <LiveViabilityGauge score={score} confidence={liveResult.confianca} size={122} />

            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Tendência atual SERMIG
              </p>
              {livePreview.subcategoriaLider ? (
                <>
                  <p className="text-sm font-bold text-white leading-snug">
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
                <p className="text-[11px] font-semibold text-[#E6C55A] pt-0.5">
                  {livePreview.situacaoResidenciaAtual}
                </p>
              )}
            </div>
          </div>

          {/* Barras ao vivo dos 7 pilares de viabilidade */}
          {allDimensions.length > 0 && (
            <div className="pt-3.5 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  7 Pilares do Radar em tempo real
                </p>
                <span className="font-mono text-[10px] text-[#E6C55A] tabular-nums">
                  {liveResult.viabilidade?.veredito || 'Em cálculo'}
                </span>
              </div>
              <div className="space-y-2">
                {allDimensions.map((dim) => {
                  const pct =
                    dim.maximo > 0 ? Math.min(100, Math.max(0, Math.round((dim.pontos / dim.maximo) * 100))) : 0;
                  const fill = pct >= 75 ? '#22C55E' : pct >= 50 ? '#C8A236' : '#F59E0B';
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

          {/* Alerta ativo ou verificação limpa */}
          {contradictionsCount > 0 ? (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/35 text-xs text-amber-100 flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[#E6C55A] shrink-0 mt-0.5" />
              <span>
                {contradictionsCount === 1
                  ? '1 inconsistência detectada — use a correção em 1 clique no formulário.'
                  : `${contradictionsCount} inconsistências detectadas — revise os alertas no formulário.`}
              </span>
            </div>
          ) : livePreview.alertaPrincipal ? (
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/35 text-xs text-amber-100 flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-[#E6C55A] shrink-0 mt-0.5" />
              <span>{livePreview.alertaPrincipal}</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-500/12 border border-emerald-400/25 text-xs text-emerald-100 flex items-start gap-2 leading-relaxed">
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
                    <FileCheck2 className="w-3 h-3 text-emerald-400" />
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Normas consultadas (Admin)
                  </p>
                  <ul className="space-y-1">
                    {livePreview.fontesLegais.map((src) => (
                      <li key={src.id} className="text-[11px] text-slate-300 leading-snug">
                        <span className="text-[#E6C55A] font-semibold">{src.jurisdicao}</span>
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

      {/* Cartão Claro: Recomendação Dinâmica da Etapa + Jurisdição + Mapa das 6 Etapas */}
      <div className="bg-white border border-[#E5DFD2] rounded-2xl p-5 space-y-4">
        <div
          className={`rounded-xl border p-3.5 space-y-1.5 ${
            stepRecommendation.tom === 'atencao'
              ? 'bg-amber-50/70 border-amber-200'
              : stepRecommendation.tom === 'positivo'
                ? 'bg-emerald-50/60 border-emerald-200'
                : 'bg-[#FAF9F6] border-[#E5DFD2]'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8C6D14]">
            Recomendação da Etapa 0{stepRecommendation.etapa}
          </p>
          <p className="text-xs font-bold text-[#0B1F33] leading-snug">{stepRecommendation.titulo}</p>
          <p className="text-[11px] text-slate-700 leading-relaxed">{stepRecommendation.orientacao}</p>
          <p className="text-[11px] font-medium text-[#0B1F33] pt-1 border-t border-black/5">
            <strong>Ação prática:</strong> {stepRecommendation.acaoPratica}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8C6D14] flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 shrink-0" />
            Jurisdição SERMIG · {answers.localizacao}
          </p>
          <p className="text-xs text-slate-600 leading-relaxed">{protocolRuleText}</p>
        </div>

        <div className="pt-3.5 border-t border-[#E5DFD2] space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#0B1F33] mb-2">
            Progresso das 6 Etapas
          </p>
          {steps.map((item) => {
            const done = item.num < step;
            const active = item.num === step;
            return (
              <motion.div
                key={item.num}
                layout
                animate={{ scale: active ? 1.01 : 1 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-colors ${
                  active
                    ? 'border-[#0B1F33] bg-[#F7F5F0] font-semibold text-[#0B1F33] shadow-[0_3px_10px_rgba(11,31,51,0.06)]'
                    : done
                      ? 'border-emerald-200/90 bg-emerald-50/40 text-[#146B43]'
                      : 'border-[#EDE8DC] bg-white text-slate-500'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-bold tabular-nums">0{item.num}</span>
                  <span className="truncate">{item.title}</span>
                </span>
                {done && <Check className="w-3.5 h-3.5 text-[#146B43] shrink-0" />}
                {active && <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C6D14]">Atual</span>}
              </motion.div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-[#E5DFD2] text-[11px] text-slate-500 leading-relaxed">
          Ao concluir a etapa 6, você libera imediatamente o <strong className="text-[#0B1F33]">Gráfico Radar</strong>, o{' '}
          <strong className="text-[#0B1F33]">Simulador &ldquo;E se...&rdquo;</strong> e o{' '}
          <strong className="text-[#0B1F33]">Dossiê PDF de 2 páginas</strong>.
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
