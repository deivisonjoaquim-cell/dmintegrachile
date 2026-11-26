import React from 'react';
import { BookOpen, Check, Globe, Lock, ShieldCheck } from 'lucide-react';
import { SERMIG_PORTAL_STEPS, type SermigPortalStepId, type SermigStepMeta } from '../../utils/sermigSimulator';

interface SermigPortalChromeProps {
  currentStep: SermigPortalStepId;
  completedSteps: SermigPortalStepId[];
  authenticatedUserLabel?: string;
  onSelectStep?: (step: SermigPortalStepId) => void;
  onLogoutSimulated?: () => void;
  children: React.ReactNode;
}

export const SermigPortalChrome: React.FC<SermigPortalChromeProps> = ({
  currentStep,
  completedSteps,
  authenticatedUserLabel,
  onSelectStep,
  onLogoutSimulated,
  children,
}) => {
  const stepMeta: SermigStepMeta =
    SERMIG_PORTAL_STEPS.find((s) => s.id === currentStep) || SERMIG_PORTAL_STEPS[0];

  const wizardSteps = SERMIG_PORTAL_STEPS.filter((s) => s.id !== 'acceso');
  const currentOrder = stepMeta.order;

  return (
    <div
      className="rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] bg-white dark:bg-[#0D1524] overflow-hidden shadow-sm"
      data-testid="sermig-portal-frame"
    >
      {/* Barra de endereço simulada do navegador oficial */}
      <div className="bg-[#F1F5F9] dark:bg-[#090F1A] border-b border-[#CBD5E1] dark:border-[#1E293B] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="hidden sm:flex items-center gap-1.5 shrink-0" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-white dark:bg-[#131F33] border border-[#CBD5E1] dark:border-[#1E293B] min-w-0 flex-1 max-w-xl">
            <Lock className="w-3 h-3 text-[#0F766E] dark:text-[#34D399] shrink-0" aria-hidden="true" />
            <span className="font-mono text-[11px] text-[#334155] dark:text-slate-300 truncate">
              https://tramites.extranjeria.gob.cl{stepMeta.urlPath}
            </span>
          </div>
        </div>
        <span className="text-[11px] font-medium text-[#64748B] dark:text-slate-400 whitespace-nowrap shrink-0">
          Simulação Interativa · Nenhum dado é enviado ao governo
        </span>
      </div>

      {/* Faixa institucional Gobierno de Chile (Azul + Vermelho oficiais) */}
      <div className="flex h-1.5 w-full" aria-hidden="true">
        <div className="w-1/2 bg-[#0039A6]" />
        <div className="w-1/2 bg-[#D52B1E]" />
      </div>

      {/* Header institucional fiel ao Portal de Trámites Digitales SERMIG */}
      <header className="bg-[#0039A6] dark:bg-[#0A2558] text-white px-4 sm:px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-md bg-white text-[#0039A6] flex flex-col items-center justify-center shrink-0 font-bold leading-none select-none"
              aria-hidden="true"
            >
              <span className="text-[9px] tracking-tight text-[#D52B1E] font-extrabold">GOB</span>
              <span className="text-[11px] tracking-tight font-extrabold">CL</span>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-blue-100/90 leading-tight truncate">
                Ministerio del Interior y Seguridad Pública · Gobierno de Chile
              </p>
              <h3 className="text-sm sm:text-base font-bold tracking-tight text-white leading-snug truncate">
                Servicio Nacional de Migraciones — Portal de Trámites Digitales
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            <span className="hidden sm:inline-flex items-center gap-1 text-blue-100">
              <Globe className="w-3.5 h-3.5" aria-hidden="true" />
              Español (CL)
            </span>
            {authenticatedUserLabel && currentStep !== 'acceso' && (
              <div className="flex items-center gap-2 pl-3 border-l border-white/25">
                <span className="max-w-[160px] truncate font-medium text-white">{authenticatedUserLabel}</span>
                {onLogoutSimulated && (
                  <button
                    type="button"
                    onClick={onLogoutSimulated}
                    className="px-2.5 py-1 rounded border border-white/30 text-[11px] font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                  >
                    Cerrar sesión
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Stepper de etapas do trâmite (visível após login simulado) */}
      {currentStep !== 'acceso' && (
        <nav
          aria-label="Etapas da solicitação no portal SERMIG"
          className="bg-[#F8FAFC] dark:bg-[#0B1320] border-b border-[#E2E8F0] dark:border-[#1E293B] px-3 sm:px-5 py-3 overflow-x-auto"
        >
          <ol className="flex items-center justify-between gap-1.5 min-w-[680px]">
            {wizardSteps.map((step) => {
              const isActive = step.id === currentStep;
              const isDone = completedSteps.includes(step.id) || step.order < currentOrder;
              const canJump = Boolean(onSelectStep) && (isDone || isActive) && currentStep !== 'comprobante';

              return (
                <li key={step.id} className="flex-1 min-w-0">
                  <button
                    type="button"
                    disabled={!canJump}
                    onClick={() => canJump && onSelectStep?.(step.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                      isActive
                        ? 'bg-[#0039A6] text-white disabled:opacity-100'
                        : isDone
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50 disabled:opacity-100 disabled:cursor-default'
                          : 'text-[#64748B] dark:text-slate-400 opacity-70 cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full text-[11px] font-mono font-bold flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-white text-[#0039A6]'
                          : isDone
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {isDone && !isActive ? <Check className="w-3 h-3" aria-hidden="true" /> : step.order}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold truncate leading-tight">{step.labelEs}</span>
                      <span
                        className={`block text-[10px] truncate leading-tight ${
                          isActive ? 'text-blue-100' : 'opacity-80'
                        }`}
                      >
                        {step.labelPt}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      )}

      {/* Conteúdo principal da tela simulada */}
      <div className="p-4 sm:p-6 bg-white dark:bg-[#0D1524] text-[#0F172A] dark:text-slate-100">
        {children}
      </div>

      {/* Rodapé institucional discreto */}
      <footer className="bg-[#F8FAFC] dark:bg-[#090F1A] border-t border-[#E2E8F0] dark:border-[#1E293B] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#64748B] dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0039A6] dark:text-blue-400" aria-hidden="true" />
          Simulador educacional inspirado no fluxo oficial tramites.extranjeria.gob.cl (Ley Nº 21.325)
        </span>
        <span>Nenhum arquivo ou dado pessoal é transmitido ao SERMIG real.</span>
      </footer>
    </div>
  );
};

interface SermigGuideSidebarProps {
  currentStep: SermigPortalStepId;
}

export const SermigGuideSidebar: React.FC<SermigGuideSidebarProps> = ({ currentStep }) => {
  const stepMeta = SERMIG_PORTAL_STEPS.find((s) => s.id === currentStep) || SERMIG_PORTAL_STEPS[0];

  return (
    <aside
      aria-label="Guia passo a passo em português"
      className="rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#0B1320] p-5 space-y-4"
    >
      <div className="space-y-1">
        <p className="text-xs font-semibold text-[#0039A6] dark:text-[#60A5FA] flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
          Guia Prático em Português
        </p>
        <h4 className="font-display text-base font-bold text-[#0F172A] dark:text-white leading-snug">
          {stepMeta.guideTitle}
        </h4>
      </div>

      <p className="text-xs sm:text-[13px] text-[#334155] dark:text-slate-300 leading-relaxed">
        {stepMeta.guideSummary}
      </p>

      <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-2">
        <p className="text-xs font-semibold text-[#991B1B] dark:text-rose-300">
          Erros mais comuns nesta tela
        </p>
        <ul className="space-y-2 text-xs text-[#475569] dark:text-slate-300 list-disc pl-4">
          {stepMeta.commonMistakes.map((mistake) => (
            <li key={mistake} className="leading-relaxed">
              {mistake}
            </li>
          ))}
        </ul>
      </div>

      <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-1.5">
        <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399]">
          Orientação da Consultoria
        </p>
        <p className="text-xs text-[#334155] dark:text-slate-300 leading-relaxed">
          {stepMeta.proTip}
        </p>
      </div>
    </aside>
  );
};
