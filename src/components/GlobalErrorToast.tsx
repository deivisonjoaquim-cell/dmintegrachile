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
          ? 'bg-white border-red-300 text-slate-900 shadow-lg'
          : isWarning
            ? 'bg-white border-amber-300 text-slate-900 shadow-lg'
            : 'bg-white border-sky-300 text-slate-900 shadow-lg';

        const barClass = isError ? 'bg-[#C82333]' : isWarning ? 'bg-amber-600' : 'bg-[#0F2537]';

        return (
          <div
            key={entry.id}
            role={isError ? 'alert' : 'status'}
            className={`pointer-events-auto rounded-xl border overflow-hidden flex items-stretch ${containerClass}`}
          >
            <div className={`w-1.5 shrink-0 ${barClass}`} aria-hidden="true" />
            <div className="p-3.5 flex-1 min-w-0 flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {isError ? (
                  <AlertCircle className="w-4 h-4 text-[#C82333]" aria-hidden="true" />
                ) : isWarning ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden="true" />
                ) : (
                  <Info className="w-4 h-4 text-[#0F2537]" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs font-bold text-slate-900 leading-snug">{entry.title}</p>
                <p className="text-xs text-slate-700 leading-relaxed">{entry.message}</p>
                {entry.actionHint && (
                  <p className="text-[11px] text-slate-500 leading-snug pt-0.5">{entry.actionHint}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissAppError(entry.id)}
                aria-label={`Fechar aviso: ${entry.title}`}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
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
