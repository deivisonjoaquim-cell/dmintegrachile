import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import {
  dismissAppError,
  subscribeToAppErrors,
  type AppErrorLogEntry,
} from '../services/errorService';

const AUTO_DISMISS_MS = 9000;

export const GlobalErrorToast: React.FC = () => {
  const [entries, setEntries] = useState<AppErrorLogEntry[]>([]);

  useEffect(() => {
    return subscribeToAppErrors((next) => {
      setEntries(next);
    });
  }, []);

  useEffect(() => {
    if (entries.length === 0) return;
    const timers = entries.map((entry) =>
      window.setTimeout(() => {
        dismissAppError(entry.id);
      }, entry.level === 'info' ? 5000 : AUTO_DISMISS_MS),
    );
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Notificações do sistema"
      className="fixed bottom-4 right-4 z-[90] flex flex-col gap-2.5 max-w-md w-[calc(100vw-2rem)] pointer-events-none no-print"
    >
      {entries.map((entry) => {
        const isError = entry.level === 'error';
        const isWarning = entry.level === 'warning';

        const containerClass = isError
          ? 'bg-white dark:bg-[#0D1E31] border-red-200 dark:border-red-900/70 text-[#0B1523] dark:text-slate-100 shadow-[0_12px_30px_rgba(11,31,51,0.12)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)]'
          : isWarning
            ? 'bg-white dark:bg-[#0D1E31] border-amber-200 dark:border-amber-800/70 text-[#0B1523] dark:text-slate-100 shadow-[0_12px_30px_rgba(11,31,51,0.12)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)]'
            : 'bg-white dark:bg-[#0D1E31] border-[#E5DFD2] dark:border-[#1C324B] text-[#0B1523] dark:text-slate-100 shadow-[0_12px_30px_rgba(11,31,51,0.12)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.45)]';

        const topBarClass = isError ? 'bg-[#A61C2B]' : isWarning ? 'bg-[#C8A236]' : 'bg-[#0B1F33] dark:bg-[#E5C76B]';

        return (
          <div
            key={entry.id}
            role={isError ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-xl border overflow-hidden flex flex-col ${containerClass}`}
          >
            <div className={`h-[2.5px] w-full ${topBarClass}`} aria-hidden="true" />
            <div className="p-3.5 flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {isError ? (
                  <AlertCircle className="w-4 h-4 text-[#A61C2B] dark:text-rose-400" aria-hidden="true" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-[#B45309] dark:text-amber-400" aria-hidden="true" />
                ) : (
                  <Info className="w-4 h-4 text-[#0B1F33] dark:text-[#E5C76B]" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-bold text-[#0B1F33] dark:text-white leading-snug">{entry.title}</p>
                <p className="text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed">{entry.message}</p>
                {entry.actionHint && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug pt-0.5">{entry.actionHint}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissAppError(entry.id)}
                aria-label={`Fechar aviso: ${entry.title}`}
                className="p-1 rounded-md text-slate-400 hover:text-[#0B1F33] dark:hover:text-white hover:bg-[#F7F5F0] dark:hover:bg-[#11263D] shrink-0 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
