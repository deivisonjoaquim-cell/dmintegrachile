import React from 'react';
import { CloudOff } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface OfflineModeStatusBarProps {
  variant?: 'public' | 'panel';
  isDark?: boolean;
  alwaysShow?: boolean;
  onOpenDecisionLogs?: () => void;
}

/**
 * Discreet offline-only notice. Renders nothing when the browser is online.
 * Automatic background sync happens silently in AppContext without UI clutter.
 */
export const OfflineModeStatusBar: React.FC<OfflineModeStatusBarProps> = ({
  variant = 'public',
  isDark = false,
}) => {
  const { isOnline } = useApp();

  if (isOnline) {
    return null;
  }

  const containerClass =
    variant === 'public'
      ? 'border-b no-print bg-rose-50 border-rose-200 text-rose-950'
      : `rounded-xl border px-4 py-2.5 no-print ${
          isDark
            ? 'bg-rose-950/70 border-rose-800/70 text-rose-100'
            : 'bg-rose-50 border-rose-200 text-rose-950'
        }`;

  return (
    <div role="status" aria-live="polite" className={containerClass} data-testid="offline-mode-status-bar">
      <div
        className={
          variant === 'public'
            ? 'max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2 text-xs font-medium'
            : 'flex items-center gap-2 text-xs font-medium'
        }
      >
        <CloudOff className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
        <span>Sem conexão com a internet. As alterações serão sincronizadas automaticamente ao reconectar.</span>
      </div>
    </div>
  );
};
