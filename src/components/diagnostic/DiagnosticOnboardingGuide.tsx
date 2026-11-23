import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Check,
  Compass,
  FileDown,
  Scale,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BrandRibbon } from '../BrandLogo';

export const DIAGNOSTIC_ONBOARDING_STORAGE_KEY = 'dm_integra_diag_onboarding_v1';

export function hasSeenDiagnosticOnboarding(): boolean {
  try {
    return localStorage.getItem(DIAGNOSTIC_ONBOARDING_STORAGE_KEY) === 'seen';
  } catch {
    return false;
  }
}

export function markDiagnosticOnboardingSeen(): void {
  try {
    localStorage.setItem(DIAGNOSTIC_ONBOARDING_STORAGE_KEY, 'seen');
  } catch {
    // ignore storage restrictions
  }
}

interface OnboardingStepConfig {
  id: number;
  shortLabel: string;
  title: string;
  summary: string;
  targetSelectors: string[];
  desktopDock: 'right' | 'left' | 'center';
  highlights: { label: string; detail: string }[];
}

const ONBOARDING_STEPS: readonly OnboardingStepConfig[] = [
  {
    id: 1,
    shortLabel: 'Etapas adaptativas',
    title: '01. Questionário adaptativo em 6 etapas',
    summary:
      'As perguntas se ajustam automaticamente à sua localização, nacionalidade e objetivo migratório pela Ley Nº 21.325 e pelo Acordo Mercosul.',
    targetSelectors: ['[data-onboarding-target="wizard-form"]'],
    desktopDock: 'right',
    highlights: [
      {
        label: 'Correção de inconsistências em 1 clique',
        detail: 'Se alguma resposta conflitar com a norma chilena, o sistema sinaliza e sugere o ajuste imediato.',
      },
      {
        label: 'Salve e continue depois',
        detail: 'Gere um link pessoal na barra inferior para pausar e retomar de onde parou sem perder dados.',
      },
      {
        label: 'Privacidade conforme a LGPD',
        detail: 'Não solicitamos CPF nem número de passaporte nesta análise inicial.',
      },
    ],
  },
  {
    id: 2,
    shortLabel: 'Radar ao vivo',
    title: '02. Radar de viabilidade em tempo real',
    summary:
      'A cada resposta preenchida, o motor normativo recalcula seu índice de 0 a 100 e aponta a subcategoria SERMIG líder para o seu perfil.',
    targetSelectors: [
      '[data-onboarding-target="live-radar-mobile"]',
      '[data-onboarding-target="live-radar"]',
    ],
    desktopDock: 'left',
    highlights: [
      {
        label: 'Enquadramento dinâmico SERMIG',
        detail: 'Identifica na hora se sua melhor rota é o Acordo Mercosul (Subcategoria 15) ou outra categoria.',
      },
      {
        label: 'Cinco pilares transparentes',
        detail: 'Acompanhe elegibilidade, documentação, prazos e fatores de risco atualizados a cada escolha.',
      },
      {
        label: 'Alertas normativos preventivos',
        detail: 'Restrições de entrada como turista ou validade de passaporte aparecem antes do envio final.',
      },
    ],
  },
  {
    id: 3,
    shortLabel: 'Relatório & PDF',
    title: '03. Comparativo, simulador "E se..." e PDF',
    summary:
      'Ao concluir a etapa 6, você libera seu relatório completo para comparar rotas, simular mudanças de cenário e baixar o Dossiê oficial.',
    targetSelectors: ['[data-onboarding-target="final-actions"]'],
    desktopDock: 'center',
    highlights: [
      {
        label: 'Comparativo lado a lado',
        detail: 'Confronte a rota recomendada, o Acordo Mercosul (15) e uma 3ª alternativa com prazos e custos.',
      },
      {
        label: 'Simulador interativo "E se..."',
        detail: 'Teste como uma oferta de trabalho, vínculo familiar ou mudança de prazo altera sua pontuação.',
      },
      {
        label: 'Dossiê em PDF de 2 páginas',
        detail: 'Exporte o diagnóstico formatado com a identidade D&M Integra para consultar ou compartilhar.',
      },
    ],
  },
] as const;

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const DEMO_RADAR_PROFILES = [
  {
    id: 'mercosul',
    label: 'No Brasil · Mercosul',
    score: 88,
    route: 'Subcategoria 15 — Acordo Mercosul',
    note: 'Dispensa oferta de emprego prévia e permite trabalhar no Chile.',
    pillars: [
      { name: 'Elegibilidade legal', pct: 95 },
      { name: 'Prontidão documental', pct: 84 },
      { name: 'Risco migratório', pct: 92 },
    ],
  },
  {
    id: 'trabalho',
    label: 'Com oferta formal',
    score: 81,
    route: 'Subcategoria 02 — Atividade Remunerada',
    note: 'Requer contrato assinado em Notaría chilena com cláusulas obrigatórias.',
    pillars: [
      { name: 'Elegibilidade legal', pct: 90 },
      { name: 'Prontidão documental', pct: 72 },
      { name: 'Risco migratório', pct: 86 },
    ],
  },
] as const;

interface DiagnosticOnboardingGuideProps {
  open: boolean;
  onClose: (dontShowAgain: boolean) => void;
  onComplete: () => void;
}

export const DiagnosticOnboardingGuide: React.FC<DiagnosticOnboardingGuideProps> = ({
  open,
  onClose,
  onComplete,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [demoProfileId, setDemoProfileId] = useState<'mercosul' | 'trabalho'>('mercosul');
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const currentStep = ONBOARDING_STEPS[activeIndex];
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === ONBOARDING_STEPS.length - 1;

  // Reset to step 1 whenever reopened
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      setDirection(1);
    }
  }, [open]);

  const findVisibleTarget = useCallback((selectors: string[]): HTMLElement | null => {
    if (typeof document === 'undefined') return null;
    for (const selector of selectors) {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0) {
        return el;
      }
    }
    return null;
  }, []);

  const measureTarget = useCallback(() => {
    if (!open) return;
    const el = findVisibleTarget(currentStep.targetSelectors);
    if (!el) {
      setSpotlightRect(null);
      return;
    }
    const raw = el.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(8, raw.left - pad);
    const top = Math.max(8, raw.top - pad);
    const maxW = vw - left - 8;
    const maxH = vh - top - 8;
    // Clamp highlight height if target is taller than viewport so the spotlight stays legible
    const clampedHeight = Math.min(raw.height + pad * 2, Math.max(120, Math.min(maxH, vh * 0.72)));
    const clampedWidth = Math.min(raw.width + pad * 2, maxW);

    if (clampedWidth <= 20 || clampedHeight <= 20 || raw.bottom < 0 || raw.top > vh) {
      setSpotlightRect(null);
      return;
    }

    setSpotlightRect({
      top,
      left,
      width: clampedWidth,
      height: clampedHeight,
    });
  }, [open, currentStep, findVisibleTarget]);

  // Scroll target gently into view when step changes, then measure
  useEffect(() => {
    if (!open) return;
    const el = findVisibleTarget(currentStep.targetSelectors);
    if (el) {
      const rect = el.getBoundingClientRect();
      const isComfortablyVisible = rect.top >= 72 && rect.top < window.innerHeight * 0.65;
      if (!isComfortablyVisible) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    let rafId = 0;
    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measureTarget);
    };

    scheduleMeasure();
    const settleTimer = window.setTimeout(scheduleMeasure, 340);

    window.addEventListener('resize', scheduleMeasure, { passive: true });
    window.addEventListener('scroll', scheduleMeasure, { passive: true });

    let ro: ResizeObserver | null = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleMeasure);
      ro.observe(el);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(settleTimer);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure);
      ro?.disconnect();
    };
  }, [open, activeIndex, currentStep, findVisibleTarget, measureTarget]);

  const goToStep = useCallback((nextIdx: number) => {
    setActiveIndex((prev) => {
      const clamped = Math.max(0, Math.min(ONBOARDING_STEPS.length - 1, nextIdx));
      setDirection(clamped >= prev ? 1 : -1);
      return clamped;
    });
  }, []);

  const handleNext = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      goToStep(activeIndex + 1);
    }
  }, [isLast, activeIndex, goToStep, onComplete]);

  const handlePrev = useCallback(() => {
    if (!isFirst) {
      goToStep(activeIndex - 1);
    }
  }, [isFirst, activeIndex, goToStep]);

  // Keyboard navigation (Escape, ArrowRight, ArrowLeft)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose(dontShowAgain);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, dontShowAgain, onClose, handleNext, handlePrev]);

  const activeDemo = useMemo(
    () => DEMO_RADAR_PROFILES.find((p) => p.id === demoProfileId) || DEMO_RADAR_PROFILES[0],
    [demoProfileId],
  );

  const dockClass =
    currentStep.desktopDock === 'right'
      ? 'lg:justify-end lg:items-center lg:pr-10'
      : currentStep.desktopDock === 'left'
        ? 'lg:justify-start lg:items-center lg:pl-10'
        : 'lg:justify-center lg:items-center';

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[70] no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby="diag-onboarding-title"
          aria-describedby="diag-onboarding-desc"
        >
          {/* Scrim com recorte dinâmico (spotlight) para iluminar a área real da tela */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={() => onClose(dontShowAgain)}
            className="fixed inset-0 cursor-pointer"
          >
            <svg className="w-full h-full block" aria-hidden="true">
              <defs>
                <mask id="dm-diag-onboarding-spotlight-mask">
                  <rect x="0" y="0" width="100%" height="100%" fill="white" />
                  {spotlightRect && (
                    <rect
                      x={spotlightRect.left}
                      y={spotlightRect.top}
                      width={spotlightRect.width}
                      height={spotlightRect.height}
                      rx={16}
                      ry={16}
                      fill="black"
                    />
                  )}
                </mask>
              </defs>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="rgba(7, 19, 32, 0.72)"
                mask="url(#dm-diag-onboarding-spotlight-mask)"
              />
            </svg>
          </motion.div>

          {/* Moldura dourada sobre a região destacada */}
          {spotlightRect && (
            <motion.div
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                x: spotlightRect.left,
                y: spotlightRect.top,
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: spotlightRect.width,
                height: spotlightRect.height,
              }}
              className="fixed top-0 left-0 rounded-2xl border-2 border-[#C8A236] shadow-[0_0_0_4px_rgba(200,162,54,0.22)] pointer-events-none"
            />
          )}

          {/* Container posicionado para o card interativo (sem nunca cortar em mobile ou desktop) */}
          <div
            className={`fixed inset-0 flex items-end sm:items-center justify-center p-3 sm:p-6 pointer-events-none ${dockClass}`}
          >
            <motion.div
              ref={cardRef}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto w-full max-w-lg max-h-[86vh] flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] shadow-[0_24px_64px_rgba(7,19,32,0.42)]"
            >
              <BrandRibbon className="h-[3px] w-full shrink-0" />

              {/* Cabeçalho Marinho & Ouro */}
              <div className="bg-[#0B1F33] text-white px-5 sm:px-6 py-4 flex items-start justify-between gap-4 shrink-0">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-xs text-[#E5C76B] font-medium tabular-nums">
                    <Compass className="w-3.5 h-3.5 shrink-0" />
                    <span>Guia rápido do Diagnóstico</span>
                    <span aria-hidden="true" className="text-slate-500">·</span>
                    <span>
                      Passo {currentStep.id} de {ONBOARDING_STEPS.length}
                    </span>
                  </div>
                  <h2
                    id="diag-onboarding-title"
                    className="font-display text-lg sm:text-xl font-bold text-white leading-snug text-balance"
                  >
                    {currentStep.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onClose(dontShowAgain)}
                  aria-label="Fechar guia interativo"
                  className="p-2 min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Seletor clicável dos 3 passos */}
              <div className="px-5 sm:px-6 pt-3.5 pb-2 bg-[#FAF9F6] dark:bg-[#0A1828] border-b border-[#E5DFD2] dark:border-[#1C324B] shrink-0">
                <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Passos do guia">
                  {ONBOARDING_STEPS.map((st, idx) => {
                    const active = idx === activeIndex;
                    const done = idx < activeIndex;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => goToStep(idx)}
                        className={`px-2.5 py-2 rounded-lg text-left transition-colors border text-xs min-w-0 ${
                          active
                            ? 'bg-[#0B1F33] text-white border-[#0B1F33] dark:bg-[#C8A236] dark:text-[#0B1523] dark:border-[#C8A236] font-semibold'
                            : done
                              ? 'bg-white dark:bg-[#0D1E31] text-[#146B43] dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 font-medium'
                              : 'bg-white dark:bg-[#0D1E31] text-[#4A5A6D] dark:text-slate-300 border-[#E5DFD2] dark:border-[#1C324B] hover:border-[#C8A236]/60'
                        }`}
                      >
                        <span className="flex items-center justify-between gap-1 text-[10px] font-mono tabular-nums opacity-80">
                          <span>0{st.id}</span>
                          {done && <Check className="w-3 h-3 shrink-0" />}
                        </span>
                        <span className="block truncate mt-0.5">{st.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Corpo animado de cada passo */}
              <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentStep.id}
                    initial={{ opacity: 0, x: direction > 0 ? 16 : -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction > 0 ? -12 : 12 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-4"
                  >
                    <p
                      id="diag-onboarding-desc"
                      className="text-sm text-[#334155] dark:text-slate-200 leading-relaxed"
                    >
                      {currentStep.summary}
                    </p>

                    {/* Preview visual interativo específico de cada passo */}
                    {currentStep.id === 1 && (
                      <div className="rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#0A1828] p-4 space-y-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-[#4A5A6D] dark:text-slate-300">
                          <span className="font-semibold text-[#0B1F33] dark:text-white">
                            Jornada completa em ~3 minutos
                          </span>
                          <span className="font-mono tabular-nums text-[11px] text-[#8C6D14] dark:text-[#E5C76B]">
                            6 etapas
                          </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-[11px]">
                          {['Contato', 'Perfil', 'Vínculos', 'Objetivo', 'Histórico', 'Docs'].map((label, i) => (
                            <div
                              key={label}
                              className={`px-2 py-1.5 rounded-lg border text-center ${
                                i === 0
                                  ? 'bg-[#0B1F33] text-white border-[#0B1F33] dark:bg-[#1B4D7A] font-semibold'
                                  : 'bg-white dark:bg-[#0D1E31] text-[#4A5A6D] dark:text-slate-300 border-[#E5DFD2] dark:border-[#1C324B]'
                              }`}
                            >
                              <span className="block font-mono text-[10px] opacity-75 tabular-nums">0{i + 1}</span>
                              <span className="block truncate">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentStep.id === 2 && (
                      <div className="rounded-xl border border-[#1E3349] bg-[#0B1F33] text-white p-4 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#E5C76B]">
                            Teste o cálculo ao vivo
                          </span>
                          <div className="inline-flex rounded-lg bg-white/10 p-0.5 gap-0.5">
                            {DEMO_RADAR_PROFILES.map((prof) => {
                              const selected = prof.id === demoProfileId;
                              return (
                                <button
                                  key={prof.id}
                                  type="button"
                                  onClick={() => setDemoProfileId(prof.id)}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors whitespace-nowrap ${
                                    selected
                                      ? 'bg-[#C8A236] text-[#0B1523]'
                                      : 'text-slate-200 hover:text-white'
                                  }`}
                                >
                                  {prof.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-4 pt-1">
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-xs font-bold text-white leading-snug">{activeDemo.route}</p>
                            <p className="text-[11px] text-slate-300 leading-snug">{activeDemo.note}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="font-mono text-2xl font-bold text-[#E5C76B] tabular-nums">
                              {activeDemo.score}
                            </span>
                            <span className="font-mono text-xs text-slate-400">/100</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10">
                          {activeDemo.pillars.map((pil) => (
                            <div key={pil.name} className="space-y-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-1 text-[10px]">
                                <span className="text-slate-300 truncate">{pil.name}</span>
                                <span className="font-mono font-semibold text-white tabular-nums shrink-0">
                                  {pil.pct}%
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                                <motion.div
                                  className="h-full rounded-full bg-[#C8A236]"
                                  initial={false}
                                  animate={{ width: `${pil.pct}%` }}
                                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {currentStep.id === 3 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          {
                            icon: <Scale className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />,
                            title: 'Comparativo 3×',
                            desc: 'Recomendada × Mercosul 15 × 3ª Opção',
                          },
                          {
                            icon: <SlidersHorizontal className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />,
                            title: 'Simulador "E se..."',
                            desc: 'Teste cenários em tempo real',
                          },
                          {
                            icon: <FileDown className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />,
                            title: 'Dossiê PDF',
                            desc: 'Relatório de 2 páginas pronto para salvar',
                          },
                        ].map((item) => (
                          <div
                            key={item.title}
                            className="p-3 rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#0A1828] space-y-1.5"
                          >
                            {item.icon}
                            <p className="text-xs font-bold text-[#0B1F33] dark:text-white leading-snug">
                              {item.title}
                            </p>
                            <p className="text-[11px] text-[#4A5A6D] dark:text-slate-300 leading-snug">
                              {item.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Lista estruturada de destaques */}
                    <ul className="divide-y divide-[#EDE8DC] dark:divide-[#1C324B] border-t border-[#EDE8DC] dark:border-[#1C324B]">
                      {currentStep.highlights.map((item) => (
                        <li key={item.label} className="py-2.5 first:pt-3 last:pb-0 space-y-0.5">
                          <p className="text-xs font-bold text-[#0B1F33] dark:text-white leading-snug">
                            {item.label}
                          </p>
                          <p className="text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                            {item.detail}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Rodapé de controles */}
              <div className="px-5 sm:px-6 py-4 bg-[#FAF9F6] dark:bg-[#0A1828] border-t border-[#E5DFD2] dark:border-[#1C324B] space-y-3 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs text-[#4A5A6D] dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                      className="w-4 h-4 rounded border-[#DDD6C7] accent-[#0B1F33]"
                    />
                    <span>Não mostrar automaticamente na próxima visita</span>
                  </label>
                  <span className="text-[11px] text-[#4A5A6D] dark:text-slate-400 inline-flex items-center gap-1">
                    <BookmarkCheck className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
                    Reabra pelo botão &ldquo;Guia rápido&rdquo;
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onClose(dontShowAgain)}
                    className="px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
                  >
                    Pular guia
                  </button>

                  <div className="flex items-center gap-2">
                    {!isFirst && (
                      <button
                        type="button"
                        onClick={handlePrev}
                        className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] rounded-xl border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#0B1F33] dark:text-white hover:bg-[#FAF9F6] dark:hover:bg-[#11263D] transition-colors whitespace-nowrap shrink-0"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Voltar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleNext}
                      className={`inline-flex items-center gap-1.5 px-5 py-2 min-h-[40px] rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                        isLast
                          ? 'bg-[#C8A236] hover:bg-[#d6b145] text-[#0B1523] shadow-[0_6px_16px_rgba(200,162,54,0.28)]'
                          : 'bg-[#0B1F33] hover:bg-[#132E4A] dark:bg-[#C8A236] dark:hover:bg-[#d6b145] text-white dark:text-[#0B1523]'
                      }`}
                    >
                      {isLast ? 'Começar diagnóstico' : 'Próximo passo'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
