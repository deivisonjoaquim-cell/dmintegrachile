import React from 'react';
import {
  Cloud,
  CloudOff,
  Database,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  ClipboardList,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface OfflineModeStatusBarProps {
  variant?: 'public' | 'panel';
  isDark?: boolean;
  alwaysShow?: boolean;
  onOpenDecisionLogs?: () => void;
}

function formatSyncTimePtBr(iso?: string | null): string {
  if (!iso) return 'ainda não sincronizado';
  try {
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return 'agora';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(dt);
  } catch {
    return 'recente';
  }
}

export const OfflineModeStatusBar: React.FC<OfflineModeStatusBarProps> = ({
  variant = 'public',
  isDark = false,
  alwaysShow = false,
  onOpenDecisionLogs,
}) => {
  const {
    isOnline,
    catalogSource,
    lastRulesSyncAt,
    aiRuntimeMode,
    aiRuntimeReason,
    pendingOfflineCounts,
    syncingOffline,
    lastSyncFeedback,
    forceSyncOfflineData,
  } = useApp();

  const isLocalRulesMode = !isOnline || catalogSource !== 'cloud' || aiRuntimeMode === 'local_rules';
  const hasPending = pendingOfflineCounts.total > 0;

  if (!alwaysShow && !isLocalRulesMode && !hasPending && !lastSyncFeedback) {
    return null;
  }

  let tone: 'offline' | 'local' | 'pending' | 'synced' = 'synced';
  let title = 'Nuvem conectada · Motor de regras sincronizado';
  let subtitle = `Base local atualizada (${formatSyncTimePtBr(lastRulesSyncAt)}).`;

  if (!isOnline) {
    tone = 'offline';
    title = 'Modo local offline ativo — Motor de regras em persistência local';
    subtitle = `Sem conexão de rede. Diagnóstico e orientações seguem operando com a base salva no dispositivo (${formatSyncTimePtBr(lastRulesSyncAt)}).`;
  } else if (aiRuntimeMode === 'local_rules') {
    tone = 'local';
    title = 'Modo de regras locais ativo — IA em nuvem indisponível no momento';
    subtitle =
      aiRuntimeReason ||
      'O motor determinístico local está operando normalmente e registrando as decisões para revisão da consultoria.';
  } else if (catalogSource !== 'cloud') {
    tone = 'local';
    title = 'Modo local ativo — Base do motor carregada do armazenamento local';
    subtitle = `Última sincronização com a nuvem: ${formatSyncTimePtBr(lastRulesSyncAt)}.`;
  } else if (hasPending) {
    tone = 'pending';
    title = `Conexão restabelecida — ${pendingOfflineCounts.total} registro(s) local(is) aguardando sincronização`;
    subtitle = `${pendingOfflineCounts.pendingLeads} diagnóstico(s) e ${pendingOfflineCounts.pendingLogs} log(s) de decisão do motor de regras prontos para envio à nuvem.`;
  }

  const palette =
    tone === 'offline'
      ? isDark
        ? 'bg-rose-950/80 border-rose-800/70 text-rose-100'
        : 'bg-rose-50 border-rose-200 text-rose-950'
      : tone === 'local'
        ? isDark
          ? 'bg-amber-950/70 border-amber-700/60 text-amber-100'
          : 'bg-amber-50 border-amber-200/90 text-amber-950'
        : tone === 'pending'
          ? isDark
            ? 'bg-sky-950/70 border-sky-700/60 text-sky-100'
            : 'bg-sky-50 border-sky-200 text-sky-950'
          : isDark
            ? 'bg-emerald-950/50 border-emerald-800/50 text-emerald-100'
            : 'bg-emerald-50 border-emerald-200 text-emerald-950';

  const iconNode =
    tone === 'offline' ? (
      <CloudOff className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
    ) : tone === 'local' ? (
      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
    ) : tone === 'pending' ? (
      <Database className="w-4 h-4 shrink-0 text-sky-600 dark:text-sky-400" />
    ) : (
      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
    );

  const containerClass =
    variant === 'public'
      ? `border-b no-print transition-colors ${palette}`
      : `rounded-xl border px-4 py-3 no-print transition-colors ${palette}`;

  const innerClass =
    variant === 'public'
      ? 'max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5'
      : 'flex flex-col md:flex-row md:items-center justify-between gap-3';

  return (
    <div role="status" aria-live="polite" className={containerClass} data-testid="offline-mode-status-bar">
      <div className={innerClass}>
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5">{iconNode}</div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold leading-snug">{title}</p>
              {hasPending && tone !== 'pending' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/10 text-[11px] font-semibold tabular-nums">
                  {pendingOfflineCounts.total} pendente(s)
                </span>
              )}
            </div>
            <p className="text-[11px] opacity-85 leading-relaxed mt-0.5">{subtitle}</p>
            {lastSyncFeedback && (
              <p className="text-[11px] font-medium mt-1 opacity-95 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 shrink-0" />
                <span>{lastSyncFeedback}</span>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {variant === 'panel' && onOpenDecisionLogs && (
            <button
              type="button"
              onClick={onOpenDecisionLogs}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                isDark
                  ? 'bg-slate-900/70 border-slate-700 text-slate-100 hover:bg-slate-800'
                  : 'bg-white/90 border-slate-300 text-slate-800 hover:bg-white'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Logs do Motor Local
            </button>
          )}
          <button
            type="button"
            disabled={syncingOffline}
            onClick={() => void forceSyncOfflineData()}
            data-testid="force-sync-offline-btn"
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-60 ${
              isDark
                ? 'bg-white text-slate-950 hover:bg-slate-100'
                : 'bg-[#0B1F33] text-white hover:bg-[#132E4A] shadow-xs'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
            {syncingOffline ? 'Sincronizando...' : 'Forçar sincronização'}
          </button>
        </div>
      </div>
    </div>
  );
};
