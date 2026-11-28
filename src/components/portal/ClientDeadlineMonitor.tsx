import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  Case,
  CaseDocument,
  Client,
  Deadline,
  Dependent,
  VisaRequirement,
} from '../../types/domain';
import {
  dispatchPortalExpirationEmailAlert,
  fetchPortalEmailAlertStatus,
  type PortalEmailAlertStatus,
} from '../../services/emailReminderClient';
import {
  buildAutoAlertFingerprint,
  buildClientDeadlineMonitorSnapshot,
  clampClientAlertDays,
  CLIENT_ALERT_DAY_PRESETS,
  formatDeadlineCountdownLabel,
  loadClientDeadlineAlertPrefs,
  saveClientDeadlineAlertPrefs,
  shouldAutoDispatchClientAlert,
  type ClientDeadlineAlertPrefs,
  type ClientMonitoredDeadlineItem,
} from '../../utils/clientDeadlineMonitor';
import { downloadIcsFile, formatDateTimeBR } from '../../utils/formatters';

export interface ClientDeadlineMonitorProps {
  uid: string;
  client: Client;
  dependents: Dependent[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines: Deadline[];
  visaRequirements: VisaRequirement[];
  brandName: string;
  onGoToDocuments?: () => void;
  onGoToProfileData?: () => void;
  onAskConsultant?: (context: { topic: 'prazos'; prefillMessage: string }) => void;
}

type MonitorFilter = 'all' | 'alert' | 'visto_prazo' | 'documento';

export const ClientDeadlineMonitor: React.FC<ClientDeadlineMonitorProps> = ({
  uid,
  client,
  dependents,
  cases,
  docs,
  deadlines,
  visaRequirements,
  brandName,
  onGoToDocuments,
  onGoToProfileData,
  onAskConsultant,
}) => {
  const [prefs, setPrefs] = useState<ClientDeadlineAlertPrefs>(() =>
    loadClientDeadlineAlertPrefs(uid),
  );
  const [customDaysInput, setCustomDaysInput] = useState<string>(String(prefs.alertDays));
  const [filter, setFilter] = useState<MonitorFilter>('all');
  const [smtpStatus, setSmtpStatus] = useState<PortalEmailAlertStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [busyMode, setBusyMode] = useState<'preview' | 'manual' | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(
    null,
  );
  const [previewModal, setPreviewModal] = useState<{
    subject: string;
    recipientEmail: string;
    html: string;
    eligibleCount: number;
  } | null>(null);

  const autoCheckDoneRef = useRef<string>('');

  useEffect(() => {
    const loaded = loadClientDeadlineAlertPrefs(uid);
    setPrefs(loaded);
    setCustomDaysInput(String(loaded.alertDays));
  }, [uid]);

  useEffect(() => {
    let active = true;
    setLoadingStatus(true);
    void fetchPortalEmailAlertStatus()
      .then((res) => {
        if (active) setSmtpStatus(res);
      })
      .catch(() => {
        if (active) {
          setSmtpStatus({
            ok: false,
            smtpConfigured: false,
            defaultAlertDays: 30,
            cooldownDays: 7,
            clientEmail: client.email || '',
          });
        }
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });
    return () => {
      active = false;
    };
  }, [client.email]);

  const snapshot = useMemo(
    () =>
      buildClientDeadlineMonitorSnapshot({
        client,
        dependents,
        cases,
        docs,
        deadlines,
        visaRequirements,
        alertDays: prefs.alertDays,
      }),
    [client, dependents, cases, docs, deadlines, visaRequirements, prefs.alertDays],
  );

  const primaryCaseTitle = cases[0]?.titulo || 'Acompanhamento de Visto e RUT';

  // Disparo automático silencioso via SMTP quando habilitado e há itens na janela de X dias (com cooldown)
  useEffect(() => {
    if (!smtpStatus || loadingStatus) return;
    if (
      !shouldAutoDispatchClientAlert({
        prefs,
        alertableReminders: snapshot.alertableReminders,
        smtpConfigured: smtpStatus.smtpConfigured,
      })
    ) {
      return;
    }

    const fp = buildAutoAlertFingerprint(snapshot.alertableReminders, prefs.alertDays);
    if (autoCheckDoneRef.current === fp) return;
    autoCheckDoneRef.current = fp;

    void dispatchPortalExpirationEmailAlert({
      items: snapshot.alertableReminders,
      alertDays: prefs.alertDays,
      mode: 'auto',
      clientName: client.nomeCompleto,
      caseTitle: primaryCaseTitle,
      brandName,
    })
      .then((res) => {
        if (res.sent || res.skippedCooldown) {
          const updated = saveClientDeadlineAlertPrefs(uid, {
            ...prefs,
            lastAutoAlertAt: new Date().toISOString(),
            lastAutoAlertFingerprint: fp,
          });
          setPrefs(updated);
          if (res.sent) {
            setFeedback({
              tone: 'ok',
              text: `Alerta automático enviado para ${res.recipientEmail} (${res.eligibleCount} item(ns) na janela de ${prefs.alertDays} dias).`,
            });
          }
        }
      })
      .catch(() => {
        // Silencioso no modo automático para não poluir a experiência do cliente
      });
  }, [
    smtpStatus,
    loadingStatus,
    prefs,
    snapshot.alertableReminders,
    client.nomeCompleto,
    primaryCaseTitle,
    brandName,
    uid,
  ]);

  const updateAlertDays = (nextDays: number) => {
    const clamped = clampClientAlertDays(nextDays, 30);
    setCustomDaysInput(String(clamped));
    const saved = saveClientDeadlineAlertPrefs(uid, { ...prefs, alertDays: clamped });
    setPrefs(saved);
  };

  const handleToggleAuto = () => {
    const saved = saveClientDeadlineAlertPrefs(uid, { ...prefs, enabled: !prefs.enabled });
    setPrefs(saved);
    setFeedback({
      tone: 'ok',
      text: saved.enabled
        ? `Alertas automáticos por e-mail ativados para ${saved.alertDays} dias antes do vencimento.`
        : 'Alertas automáticos pausados. Você ainda pode consultar todos os prazos e disparar envios manuais aqui.',
    });
  };

  const handleTriggerEmail = async (mode: 'preview' | 'manual') => {
    if (busyMode) return;
    if (snapshot.alertableReminders.length === 0) {
      setFeedback({
        tone: 'warn',
        text: `Nenhum visto ou documento expira nos próximos ${prefs.alertDays} dias. Aumente a antecedência (X dias) para incluir datas mais distantes.`,
      });
      return;
    }

    setBusyMode(mode);
    setFeedback(null);
    try {
      const res = await dispatchPortalExpirationEmailAlert({
        items: snapshot.alertableReminders,
        alertDays: prefs.alertDays,
        mode,
        clientName: client.nomeCompleto,
        caseTitle: primaryCaseTitle,
        brandName,
      });

      if (mode === 'preview' && res.previewHtml) {
        setPreviewModal({
          subject: res.subject,
          recipientEmail: res.recipientEmail,
          html: res.previewHtml,
          eligibleCount: res.eligibleCount,
        });
      } else if (mode === 'manual') {
        if (res.sent) {
          const saved = saveClientDeadlineAlertPrefs(uid, {
            ...prefs,
            lastManualAlertAt: new Date().toISOString(),
          });
          setPrefs(saved);
          setFeedback({ tone: 'ok', text: res.message });
        } else {
          setFeedback({ tone: res.smtpConfigured ? 'error' : 'warn', text: res.message });
          if (res.previewHtml) {
            setPreviewModal({
              subject: res.subject,
              recipientEmail: res.recipientEmail,
              html: res.previewHtml,
              eligibleCount: res.eligibleCount,
            });
          }
        }
      }
    } catch (err) {
      setFeedback({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Falha ao comunicar com o serviço de alertas SMTP.',
      });
    } finally {
      setBusyMode(null);
    }
  };

  const visibleItems = useMemo(() => {
    return snapshot.items.filter((item) => {
      if (filter === 'alert') return item.bucket === 'expired' || item.bucket === 'alert_window';
      if (filter === 'visto_prazo') return item.categoryGroup === 'visto_prazo';
      if (filter === 'documento') return item.categoryGroup === 'documento';
      return true;
    });
  }, [snapshot.items, filter]);

  const handleExportItemIcs = (item: ClientMonitoredDeadlineItem) => {
    downloadIcsFile({
      title: `Vencimento: ${item.titulo} (${brandName})`,
      description: `${item.sourceLabel} · ${item.statusLabel}. Acompanhe no Portal do Cliente.`,
      startIso: item.dataVencimento,
    });
  };

  const recipientDisplay = smtpStatus?.clientEmail || client.email || 'E-mail da sua conta Google';

  return (
    <section
      aria-label="Monitoramento proativo de prazos e alertas automáticos por e-mail"
      className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden"
    >
      {/* Cabeçalho + Resumo de Vencimentos */}
      <div className="p-5 sm:p-6 border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="brand-kicker flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-[#C9A86A]" />
              Monitoramento Proativo de Prazos · Visto, RUT &amp; Documentos
            </p>
            <h2 className="font-display text-xl font-bold text-[#070E1C] dark:text-white">
              Datas de Vencimento e Alertas Automáticos por E-mail (SMTP)
            </h2>
            <p className="text-xs text-[#475569] dark:text-slate-400 max-w-2xl leading-relaxed">
              Acompanhe em um só lugar a validade do seu visto, passaporte, certidões e prazos do SERMIG/RUT.
              Configure com quantos dias de antecedência deseja receber avisos automáticos no seu e-mail.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busyMode !== null}
              onClick={() => void handleTriggerEmail('preview')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#070E1C] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#182842] whitespace-nowrap disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
              {busyMode === 'preview' ? 'Gerando prévia...' : 'Pré-visualizar E-mail'}
            </button>
            <button
              type="button"
              disabled={busyMode !== null}
              onClick={() => void handleTriggerEmail('manual')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] hover:opacity-95 text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-[#C9A86A]" />
              {busyMode === 'manual' ? 'Enviando SMTP...' : 'Enviar Alerta Agora'}
            </button>
          </div>
        </div>

        {/* 4 KPIs numéricos limpos (tabular-nums) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-lg bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B]">
            <p className="text-[11px] font-semibold text-[#475569] dark:text-slate-400">Vencidos</p>
            <p
              className={`font-mono text-2xl font-bold tabular-nums mt-0.5 ${
                snapshot.summary.expiredCount > 0
                  ? 'text-red-700 dark:text-red-400'
                  : 'text-[#070E1C] dark:text-white'
              }`}
            >
              {snapshot.summary.expiredCount}
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">Ação imediata</p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B]">
            <p className="text-[11px] font-semibold text-[#475569] dark:text-slate-400">
              Em alerta (≤ {prefs.alertDays}d)
            </p>
            <p
              className={`font-mono text-2xl font-bold tabular-nums mt-0.5 ${
                snapshot.summary.inAlertWindowCount > 0
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-[#070E1C] dark:text-white'
              }`}
            >
              {snapshot.summary.inAlertWindowCount}
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
              Janela de aviso SMTP
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B]">
            <p className="text-[11px] font-semibold text-[#475569] dark:text-slate-400">
              Em dia (&gt; {prefs.alertDays}d)
            </p>
            <p className="font-mono text-2xl font-bold tabular-nums mt-0.5 text-emerald-700 dark:text-emerald-400">
              {snapshot.summary.upcomingCount}
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
              Sob vigia contínua
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B]">
            <p className="text-[11px] font-semibold text-[#475569] dark:text-slate-400">
              Próximo vencimento
            </p>
            <p className="font-mono text-lg font-bold tabular-nums mt-1 text-[#070E1C] dark:text-white truncate">
              {snapshot.summary.nextExpiring ? snapshot.summary.nextExpiring.dataVencimentoBR : '—'}
            </p>
            <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5 truncate">
              {snapshot.summary.nextExpiring
                ? formatDeadlineCountdownLabel(snapshot.summary.nextExpiring.daysRemaining)
                : 'Nenhuma data cadastrada'}
            </p>
          </div>
        </div>

        {/* Barra de Configuração de Antecedência (X dias antes via SMTP) */}
        <div className="rounded-xl bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B] p-4 space-y-3.5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#111C30] border border-[#E5E7EB] dark:border-[#24324A] flex items-center justify-center shrink-0 mt-0.5">
                <Mail className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#070E1C] dark:text-white">
                  Alerta Automático via SMTP · Destinatário verificado:{' '}
                  <span className="font-mono text-[#0F3D91] dark:text-[#60A5FA] break-all">
                    {recipientDisplay}
                  </span>
                </p>
                <p className="text-[11px] text-[#475569] dark:text-slate-400 mt-0.5">
                  {loadingStatus
                    ? 'Verificando conexão do servidor de e-mail...'
                    : smtpStatus?.smtpConfigured
                      ? `Servidor SMTP ativo. Disparos automáticos ocorrem ${prefs.alertDays} dia(s) antes do vencimento (com proteção anti-spam).`
                      : 'Servidor SMTP aguardando credenciais no servidor. As datas continuam sendo vigiadas aqui e a prévia do e-mail já está disponível.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={prefs.enabled}
              onClick={handleToggleAuto}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                prefs.enabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-white dark:bg-[#111C30] border-[#D1D5DB] dark:border-[#24324A] text-[#475569] dark:text-slate-300'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {prefs.enabled ? 'Alerta automático: Ativo' : 'Alerta automático: Pausado'}
            </button>
          </div>

          <div className="pt-3 border-t border-[#E5E7EB] dark:border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-400 mr-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#C9A86A]" />
                Avisar com antecedência de:
              </span>
              {CLIENT_ALERT_DAY_PRESETS.map((days) => {
                const active = prefs.alertDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    aria-pressed={active}
                    onClick={() => updateAlertDays(days)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors tabular-nums border ${
                      active
                        ? 'bg-[#070E1C] dark:bg-[#C9A86A] text-white dark:text-[#070E1C] border-[#070E1C] dark:border-[#C9A86A]'
                        : 'bg-white dark:bg-[#111C30] text-[#334155] dark:text-slate-300 border-[#D1D5DB] dark:border-[#24324A] hover:border-[#0F3D91]'
                    }`}
                  >
                    {days} dias
                  </button>
                );
              })}

              <label className="inline-flex items-center gap-1.5 text-xs text-[#475569] dark:text-slate-300 ml-1">
                <span>Outro:</span>
                <input
                  type="number"
                  min={1}
                  max={180}
                  value={customDaysInput}
                  onChange={(e) => setCustomDaysInput(e.target.value)}
                  onBlur={() => updateAlertDays(Number(customDaysInput))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') updateAlertDays(Number(customDaysInput));
                  }}
                  aria-label="Dias de antecedência personalizados"
                  className="w-16 px-2 py-1 rounded-md border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-mono text-[#070E1C] dark:text-white text-center tabular-nums"
                />
                <span>dias</span>
              </label>
            </div>

            {(prefs.lastAutoAlertAt || prefs.lastManualAlertAt) && (
              <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400 tabular-nums">
                Último disparo:{' '}
                {formatDateTimeBR(prefs.lastManualAlertAt || prefs.lastAutoAlertAt || '')}
              </span>
            )}
          </div>
        </div>

        {feedback && (
          <div
            role="status"
            className={`px-4 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between gap-3 ${
              feedback.tone === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200'
                : feedback.tone === 'warn'
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200'
                  : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Fechar aviso"
              className="p-0.5 opacity-70 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Filtros + Lista Proativa de Datas Monitoradas */}
      <div className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `Todos (${snapshot.summary.totalTracked})` },
                { id: 'alert', label: `Em alerta ≤ ${prefs.alertDays}d (${snapshot.summary.alertableCount})` },
                {
                  id: 'visto_prazo',
                  label: `Visto & SERMIG/RUT (${snapshot.items.filter((i) => i.categoryGroup === 'visto_prazo').length})`,
                },
                {
                  id: 'documento',
                  label: `Documentos (${snapshot.items.filter((i) => i.categoryGroup === 'documento').length})`,
                },
              ] as const
            ).map((tab) => {
              const active = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors tabular-nums whitespace-nowrap ${
                    active
                      ? 'bg-[#070E1C] dark:bg-white text-white dark:text-[#070E1C]'
                      : 'bg-[#F7F8FA] dark:bg-[#111C30] text-[#475569] dark:text-slate-300 hover:text-[#070E1C] dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {visibleItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D1D5DB] dark:border-[#24324A] p-6 text-center space-y-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-[#070E1C] dark:text-white">
              {snapshot.items.length === 0
                ? 'Nenhuma data de vencimento registrada ainda neste processo.'
                : 'Nenhum vencimento encontrado neste filtro.'}
            </p>
            <p className="text-xs text-[#475569] dark:text-slate-400 max-w-md mx-auto">
              Assim que a validade do seu passaporte, certidões ou visto for registrada, o painel exibirá a
              contagem regressiva e enviará lembretes automáticos {prefs.alertDays} dias antes.
            </p>
            {onGoToProfileData && !client.passaporte?.validade && (
              <button
                type="button"
                onClick={onGoToProfileData}
                className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F3D91] text-white text-xs font-semibold hover:opacity-95"
              >
                Cadastrar validade do passaporte
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden">
            {visibleItems.map((item) => {
              const isExpired = item.bucket === 'expired';
              const isAlert = item.bucket === 'alert_window';
              const countdownText = formatDeadlineCountdownLabel(item.daysRemaining);
              const progressPct = isExpired
                ? 100
                : Math.max(
                    6,
                    Math.min(100, Math.round(((prefs.alertDays - Math.min(item.daysRemaining, prefs.alertDays)) / Math.max(1, prefs.alertDays)) * 100)),
                  );

              return (
                <div
                  key={item.id}
                  className="p-4 bg-white dark:bg-[#0D1422] hover:bg-[#FAFBFD] dark:hover:bg-[#111B2E] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isExpired
                          ? 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                          : isAlert
                            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {isExpired ? (
                        <AlertTriangle className="w-4 h-4" />
                      ) : isAlert ? (
                        <Clock className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        <span className="font-bold uppercase tracking-wider text-[#0F3D91] dark:text-[#60A5FA]">
                          {item.sourceLabel}
                        </span>
                        <span className="text-[#94A3B8]">·</span>
                        <span
                          className={`font-semibold ${
                            isExpired
                              ? 'text-red-700 dark:text-red-400'
                              : isAlert
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                          }`}
                        >
                          {item.urgenciaLabel}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-[#070E1C] dark:text-white leading-snug">
                        {item.titulo}
                      </h3>

                      <p className="text-xs text-[#475569] dark:text-slate-400 font-mono tabular-nums">
                        Titular: {item.titularNome} · Vencimento:{' '}
                        <strong className="text-[#070E1C] dark:text-slate-100">
                          {item.dataVencimentoBR}
                        </strong>{' '}
                        ·{' '}
                        <span
                          className={
                            isExpired
                              ? 'text-red-700 dark:text-red-400 font-bold'
                              : isAlert
                                ? 'text-amber-700 dark:text-amber-400 font-bold'
                                : 'text-emerald-700 dark:text-emerald-400'
                          }
                        >
                          {countdownText}
                        </span>
                      </p>

                      {(isExpired || isAlert) && (
                        <div className="pt-1 max-w-xs">
                          <div className="h-1.5 rounded-full bg-[#E5E7EB] dark:bg-[#1E293B] overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isExpired ? 'bg-red-600' : 'bg-amber-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleExportItemIcs(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-semibold text-[#070E1C] dark:text-slate-200 hover:bg-[#F7F8FA] dark:hover:bg-[#182842] whitespace-nowrap"
                    >
                      <Calendar className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
                      Agenda (.ics)
                    </button>
                    {item.categoryGroup === 'documento' && onGoToDocuments && (
                      <button
                        type="button"
                        onClick={onGoToDocuments}
                        className="px-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] text-xs font-semibold text-[#070E1C] dark:text-slate-200 hover:bg-[#F7F8FA] dark:hover:bg-[#182842] whitespace-nowrap"
                      >
                        Ver documento
                      </button>
                    )}
                    {onAskConsultant && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskConsultant({
                            topic: 'prazos',
                            prefillMessage: `Olá! Gostaria de confirmar a ação necessária para "${item.titulo}" com vencimento em ${item.dataVencimentoBR} (${countdownText}).`,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F3D91] hover:bg-[#0B2E6E] text-xs font-semibold text-white whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chat Rápido
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {snapshot.missingCriticalDates.length > 0 && (
          <div className="rounded-lg bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B] p-3.5 text-xs text-[#475569] dark:text-slate-400 space-y-1">
            <p className="font-semibold text-[#070E1C] dark:text-slate-200">
              Datas ainda não preenchidas para monitoramento automático:
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {snapshot.missingCriticalDates.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Modal Seguro de Pré-visualização do E-mail SMTP (iframe sandboxed) */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pré-visualização do alerta por e-mail"
        >
          <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9A7B3E] dark:text-[#C9A86A]">
                  Pré-visualização do E-mail Automático ({previewModal.eligibleCount} item(ns))
                </p>
                <h3 className="text-sm font-bold text-[#070E1C] dark:text-white truncate mt-0.5">
                  {previewModal.subject}
                </h3>
                <p className="text-[11px] font-mono text-[#475569] dark:text-slate-400 truncate">
                  Para: {previewModal.recipientEmail}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                aria-label="Fechar pré-visualização"
                className="p-2 rounded-lg text-[#475569] dark:text-slate-300 hover:bg-[#F7F8FA] dark:hover:bg-[#152038]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 bg-[#F1F5F9] p-3 min-h-[380px]">
              <iframe
                title="Prévia do e-mail de alerta de vencimentos"
                sandbox=""
                srcDoc={previewModal.html}
                className="w-full h-[55vh] rounded-lg border border-[#E2E8F0] bg-white"
              />
            </div>

            <div className="px-5 py-3.5 border-t border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-between gap-3">
              <span className="text-xs text-[#475569] dark:text-slate-400">
                {smtpStatus?.smtpConfigured
                  ? 'Pronto para disparo imediato via servidor SMTP.'
                  : 'SMTP ainda não configurado pelo administrador.'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="px-3.5 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] text-xs font-semibold text-[#070E1C] dark:text-slate-200"
                >
                  Fechar
                </button>
                {smtpStatus?.smtpConfigured && (
                  <button
                    type="button"
                    disabled={busyMode !== null}
                    onClick={() => {
                      setPreviewModal(null);
                      void handleTriggerEmail('manual');
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0F3D91] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar agora
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
