import React from 'react';
import { ArrowRight, RotateCcw, SlidersHorizontal, TrendingDown, TrendingUp } from 'lucide-react';
import type { DiagnosticAnswers } from '../../types/domain';
import type { DiagnosticResult } from '../../utils/diagnosticEngine';

export type PublicSimLeverId =
  | 'protocolar_brasil'
  | 'entrar_turista'
  | 'oferta_trabalho'
  | 'passaporte_12m'
  | 'vinculo_familiar'
  | 'aplicacao_individual';

export interface PublicSimLeverSpec {
  id: PublicSimLeverId;
  label: string;
  description: string;
  isApplicable: (base: DiagnosticAnswers) => boolean;
  apply: (draft: DiagnosticAnswers) => DiagnosticAnswers;
}

export const PUBLIC_SIMULATOR_LEVERS: PublicSimLeverSpec[] = [
  {
    id: 'protocolar_brasil',
    label: 'Protocolar a partir do Brasil (Exterior)',
    description: 'Simula envio digital pelo SERMIG fora do Chile, evitando restrições de Permanencia Transitoria.',
    isApplicable: (base) => base.localizacao !== 'No Brasil',
    apply: (draft) => ({
      ...draft,
      localizacao: 'No Brasil',
      entradaRecenteChileTurista: false,
    }),
  },
  {
    id: 'entrar_turista',
    label: 'Testar entrada como turista no Chile',
    description: 'Mostra o impacto da Ley Nº 21.325 ao tentar solicitar residência já dentro do Chile sem exceção legal.',
    isApplicable: (base) => base.localizacao === 'No Brasil',
    apply: (draft) => ({
      ...draft,
      localizacao: 'No Chile como turista',
    }),
  },
  {
    id: 'oferta_trabalho',
    label: 'Possuir contrato ou oferta formal de emprego',
    description: 'Adiciona proposta formal de empresa chilena notariada ao cenário de elegibilidade.',
    isApplicable: (base) => !base.possuiOfertaTrabalhoFormal,
    apply: (draft) => ({
      ...draft,
      objetivo: 'trabalho_formal',
      possuiOfertaTrabalhoFormal: true,
      contratoNotariadoEmpresaChilena: true,
    }),
  },
  {
    id: 'passaporte_12m',
    label: 'Passaporte renovado (24 meses de validade)',
    description: 'Elimina penalizações de prontidão documental por passaporte próximo do vencimento.',
    isApplicable: (base) =>
      base.passaporteStatus !== 'valido' || (base.passaporteValidadeMeses ?? 0) < 12,
    apply: (draft) => ({
      ...draft,
      passaporteStatus: 'valido',
      passaporteValidadeMeses: 24,
    }),
  },
  {
    id: 'vinculo_familiar',
    label: 'Vínculo familiar formalizado no Chile',
    description: 'Simula casamento, Acuerdo de Unión Civil ou filho(a) chileno(a) registrado oficialmente.',
    isApplicable: (base) => !(base.vinculoFamiliarChile && base.vinculoFormalizado),
    apply: (draft) => ({
      ...draft,
      vinculoFamiliarChile: true,
      vinculoFormalizado: true,
      vinculoTipo: 'Cônjuge/União Civil',
      familiarStatusChile: 'chileno',
    }),
  },
  {
    id: 'aplicacao_individual',
    label: 'Aplicar primeiro como titular individual',
    description: 'Compara a complexidade documental entre protocolo individual e processo familiar simultâneo.',
    isApplicable: (base) => Boolean(base.familiaAcompanhante),
    apply: (draft) => ({
      ...draft,
      familiaAcompanhante: false,
      composicaoFamiliar: 'individual',
      quantidadeDependentes: 0,
    }),
  },
];

export function buildSimulatedPublicAnswers(
  baseAnswers: DiagnosticAnswers,
  activeLevers: PublicSimLeverId[],
): DiagnosticAnswers {
  let next: DiagnosticAnswers = { ...baseAnswers };
  for (const leverId of activeLevers) {
    const spec = PUBLIC_SIMULATOR_LEVERS.find((l) => l.id === leverId);
    if (spec && spec.isApplicable(baseAnswers)) {
      next = spec.apply(next);
    }
  }
  return next;
}

interface PublicWhatIfSimulatorProps {
  baseAnswers: DiagnosticAnswers;
  baseResult: DiagnosticResult;
  simulatedResult: DiagnosticResult | null;
  activeLevers: PublicSimLeverId[];
  onToggleLever: (id: PublicSimLeverId) => void;
  onReset: () => void;
}

export const PublicWhatIfSimulator: React.FC<PublicWhatIfSimulatorProps> = ({
  baseAnswers,
  baseResult,
  simulatedResult,
  activeLevers,
  onToggleLever,
  onReset,
}) => {
  const availableLevers = PUBLIC_SIMULATOR_LEVERS.filter((l) => l.isApplicable(baseAnswers));
  const baseScore = Math.round(baseResult.viabilidade?.total || 0);
  const simScore = simulatedResult ? Math.round(simulatedResult.viabilidade?.total || 0) : baseScore;
  const delta = simScore - baseScore;

  const baseRoute = baseResult.recomendada?.visa.nomePortugues || 'Análise complementar';
  const simRoute = simulatedResult?.recomendada?.visa.nomePortugues || baseRoute;
  const routeChanged = Boolean(simulatedResult && simRoute !== baseRoute);

  return (
    <div
      data-testid="public-whatif-simulator"
      className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] overflow-hidden"
    >
      {/* Cabeçalho executivo em azul marinho corporativo */}
      <div className="bg-[#070E1C] text-white px-5 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="w-4 h-4 text-[#C9A86A]" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C9A86A]">
              Simulador Interativo &ldquo;E se...&rdquo;
            </p>
            <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
              Teste hipóteses e veja o impacto em tempo real no gráfico radar
            </h3>
          </div>
        </div>

        {activeLevers.length > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restaurar perfil original
          </button>
        )}
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
          Ative uma ou mais variáveis abaixo para simular como decisões práticas alteram sua pontuação de viabilidade e a rota recomendada pelo SERMIG — sem alterar os dados enviados no seu diagnóstico.
        </p>

        {/* Alavancas clicáveis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {availableLevers.map((lever) => {
            const active = activeLevers.includes(lever.id);
            return (
              <button
                key={lever.id}
                type="button"
                role="switch"
                aria-checked={active}
                data-testid={`whatif-lever-${lever.id}`}
                onClick={() => onToggleLever(lever.id)}
                className={`text-left p-3.5 rounded-xl border transition-all duration-150 flex items-start justify-between gap-3 ${
                  active
                    ? 'border-[#0F3D91] dark:border-[#3B82F6] bg-[#F7F8FA] dark:bg-[#111C30]'
                    : 'border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0B1220] hover:border-[#0F3D91]/60 dark:hover:border-[#3B82F6]/60'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <p className="text-xs font-bold text-[#0B1628] dark:text-white leading-snug">{lever.label}</p>
                  <p className="text-[11px] text-[#475569] dark:text-slate-400 leading-relaxed">{lever.description}</p>
                </div>
                <span
                  aria-hidden="true"
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full mt-0.5 transition-colors ${
                    active ? 'bg-[#0F3D91] dark:bg-[#3B82F6]' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      active ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* Resultado comparativo ao vivo */}
        {activeLevers.length > 0 && simulatedResult && (
          <div
            data-testid="whatif-impact-summary"
            className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#111A2C] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="space-y-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#0F3D91] dark:text-[#C9A86A]">
                Impacto calculado no cenário simulado
              </p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">{baseScore}/100</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono text-lg font-bold text-[#0B1628] dark:text-white tabular-nums">{simScore}/100</span>
                <span
                  className={`inline-flex items-center gap-1 font-mono text-xs font-bold tabular-nums px-2 py-0.5 rounded ${
                    delta > 0
                      ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                      : delta < 0
                        ? 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {delta > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : delta < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : null}
                  {delta > 0 ? `+${delta} pts` : `${delta} pts`}
                </span>
              </div>
              {routeChanged ? (
                <p className="text-xs text-[#0B1628] dark:text-slate-100 pt-1">
                  <strong>Nova rota líder no cenário:</strong> {simRoute}
                </p>
              ) : (
                <p className="text-xs text-[#475569] dark:text-slate-300 pt-1">
                  Rota líder mantida: <strong className="text-[#0B1628] dark:text-white">{baseRoute}</strong> · Polígono comparativo atualizado no gráfico radar acima.
                </p>
              )}
            </div>

            <div className="text-left md:text-right shrink-0 text-xs">
              <p className="text-[#64748B] dark:text-slate-400">Confiança simulada</p>
              <p className="font-bold text-[#0B1628] dark:text-white">{simulatedResult.confianca}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
