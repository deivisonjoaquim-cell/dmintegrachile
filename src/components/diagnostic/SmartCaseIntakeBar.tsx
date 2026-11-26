import React, { useMemo, useState } from 'react';
import { Check, RotateCcw, Sparkles, Wand2 } from 'lucide-react';
import type { DiagnosticAnswers } from '../../types/domain';
import {
  parseFreeTextCaseToAnswers,
  SMART_CASE_EXAMPLES,
} from '../../utils/smartDiagnosticInterpreter';

interface SmartCaseIntakeBarProps {
  currentAnswers: DiagnosticAnswers;
  onApplyPatch: (patch: Partial<DiagnosticAnswers>, matchedCount: number) => void;
  onUndoLastPatch?: () => void;
  canUndo?: boolean;
}

export const SmartCaseIntakeBar: React.FC<SmartCaseIntakeBarProps> = ({
  onApplyPatch,
  onUndoLastPatch,
  canUndo = false,
}) => {
  const [caseText, setCaseText] = useState('');
  const [appliedSummary, setAppliedSummary] = useState<string | null>(null);

  const parsed = useMemo(() => parseFreeTextCaseToAnswers(caseText), [caseText]);

  const handleApply = () => {
    if (parsed.matchedCount === 0) return;
    onApplyPatch(parsed.patch, parsed.matchedCount);
    setAppliedSummary(
      `${parsed.matchedCount} ${parsed.matchedCount === 1 ? 'parâmetro aplicado' : 'parâmetros aplicados'} às etapas 2–6. O Radar à direita já foi recalculado.`,
    );
  };

  const handleSelectExample = (text: string) => {
    setCaseText(text);
    const instant = parseFreeTextCaseToAnswers(text);
    if (instant.matchedCount > 0) {
      onApplyPatch(instant.patch, instant.matchedCount);
      setAppliedSummary(
        `Cenário carregado (${instant.matchedCount} parâmetros aplicados). Revise os detalhes ou siga para a Etapa 2.`,
      );
    }
  };

  return (
    <div
      data-testid="smart-case-intake"
      className="rounded-xl border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] p-4 sm:p-5 space-y-3.5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C9A86A] shrink-0" />
            Assistente de Preenchimento Inteligente (opcional)
          </p>
          <p className="text-xs text-[#475569] dark:text-slate-400 leading-relaxed">
            Descreva sua situação em uma frase ou escolha um cenário abaixo para pré-configurar automaticamente as etapas 2 a 6 e ver o Radar reagir ao vivo.
          </p>
        </div>

        {canUndo && onUndoLastPatch && (
          <button
            type="button"
            onClick={() => {
              onUndoLastPatch();
              setAppliedSummary(null);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#111C30] text-[11px] font-semibold text-[#0B1628] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#192842] transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Desfazer
          </button>
        )}
      </div>

      {/* Exemplos clicáveis em 1 clique */}
      <div className="flex flex-wrap gap-2">
        {SMART_CASE_EXAMPLES.map((ex) => {
          const isSelected = caseText.trim() === ex.text.trim();
          return (
            <button
              key={ex.id}
              type="button"
              data-testid={`smart-example-${ex.id}`}
              onClick={() => handleSelectExample(ex.text)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-[#0B1628] dark:bg-[#3B82F6] text-white border-[#0B1628] dark:border-[#3B82F6]'
                  : 'bg-white dark:bg-[#111C30] text-[#0B1628] dark:text-slate-200 border-[#E5E7EB] dark:border-[#1E293B] hover:border-[#0F3D91] dark:hover:border-[#60A5FA]'
              }`}
            >
              {ex.label}
            </button>
          );
        })}
      </div>

      {/* Campo de texto livre */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <textarea
          id="diag-smart-intake"
          rows={2}
          value={caseText}
          onChange={(e) => {
            setCaseText(e.target.value);
            if (appliedSummary) setAppliedSummary(null);
          }}
          placeholder="Ex.: Sou brasileiro em SP, quero mudar para Santiago em 3 meses com esposa e 1 filho pelo Mercosul..."
          className="flex-1 px-3.5 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#0D1524] text-xs sm:text-sm text-[#0B1628] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/30 dark:focus:ring-[#3B82F6]/40 resize-none"
        />
        <button
          type="button"
          data-testid="smart-apply-btn"
          disabled={parsed.matchedCount === 0}
          onClick={handleApply}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0F3D91] hover:bg-[#0B2E6E] dark:bg-[#3B82F6] dark:hover:bg-[#2563EB] text-xs font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
        >
          <Wand2 className="w-3.5 h-3.5" />
          Aplicar ({parsed.matchedCount})
        </button>
      </div>

      {/* Sinais detectados em tempo real */}
      {parsed.detectedSignals.length > 0 && (
        <div className="space-y-1.5 pt-0.5">
          <p className="text-[11px] font-medium text-[#475569] dark:text-slate-400">
            Parâmetros identificados automaticamente:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {parsed.detectedSignals.map((sig) => (
              <span
                key={sig.id}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border ${
                  sig.tone === 'atencao'
                    ? 'bg-amber-50 dark:bg-amber-950/35 border-amber-200 dark:border-amber-700/50 text-amber-900 dark:text-amber-200'
                    : sig.tone === 'positivo'
                      ? 'bg-emerald-50 dark:bg-emerald-950/35 border-emerald-200 dark:border-emerald-700/50 text-emerald-900 dark:text-emerald-200'
                      : 'bg-white dark:bg-[#111C30] border-[#E5E7EB] dark:border-[#24324A] text-[#0B1628] dark:text-slate-200'
                }`}
              >
                {sig.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Confirmação discreta após aplicação */}
      {appliedSummary && (
        <div
          data-testid="smart-applied-banner"
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-xs text-emerald-900 dark:text-emerald-200 font-medium"
        >
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span>{appliedSummary}</span>
        </div>
      )}
    </div>
  );
};
