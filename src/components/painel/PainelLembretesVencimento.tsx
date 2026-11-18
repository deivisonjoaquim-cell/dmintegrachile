import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FolderOpen,
  Loader2,
  Mail,
  MessageCircle,
  Search,
  Send,
  X,
} from 'lucide-react';
import {
  fetchEmailAutomationHealth,
  findLatestEmailLogForDoc,
  sendExpirationReminderEmails,
  type EmailServiceHealth,
} from '../../services/emailReminderClient';
import { notifyClientProcessUpdate } from '../../services/notificationService';
import type {
  Case,
  CaseDocument,
  Client,
  CommunicationLog,
  Dependent,
  VisaRequirement,
} from '../../types/domain';
import {
  collectExpirationReminders,
  type ExpirationReminderItem,
} from '../../utils/documentExpiration';
import { buildWhatsAppUrl, formatDateBR } from '../../utils/formatters';

interface PainelLembretesVencimentoProps {
  docs: CaseDocument[];
  cases: Case[];
  clients: Client[];
  dependents?: Dependent[];
  visaRequirements?: VisaRequirement[];
  communicationLogs?: CommunicationLog[];
  brandName?: string;
  onOpenCase: (caseId: string) => void;
  onOpenChecklist?: (caseId?: string) => void;
  onLogWhatsApp: (
    clientId: string | undefined,
    caseId: string | undefined,
    assunto: string,
    msg: string,
  ) => Promise<void>;
  onEmailLogsCreated?: (logs: CommunicationLog[]) => void;
}

type ReminderFilter = 'todos' | 'vencidos' | 'criticos' | 'atencao' | 'sem_data';

const AUTO_EMAIL_ENABLED_KEY = 'dm_auto_email_reminders_enabled';
const AUTO_EMAIL_LAST_SWEEP_KEY = 'dm_auto_email_last_sweep_ms';

export const PainelLembretesVencimento: React.FC<PainelLembretesVencimentoProps> = ({
  docs,
  cases,
  clients,
  dependents = [],
  visaRequirements = [],
  communicationLogs = [],
  brandName,
  onOpenCase,
  onOpenChecklist,
  onLogWhatsApp,
  onEmailLogsCreated,
}) => {
  const [filter, setFilter] = useState<ReminderFilter>('todos');
  const [queryText, setQueryText] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);

  const [emailHealth, setEmailHealth] = useState<EmailServiceHealth | null>(null);
  const [autoSweepEnabled, setAutoSweepEnabled] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(AUTO_EMAIL_ENABLED_KEY);
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [copyConsultant, setCopyConsultant] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    tone: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const [previewModal, setPreviewModal] = useState<{
    subject: string;
    to: string;
    html: string;
  } | null>(null);

  const autoSweptRef = useRef(false);

  useEffect(() => {
    let active = true;
    void fetchEmailAutomationHealth().then((health) => {
      if (active) setEmailHealth(health);
    });
    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(
    () =>
      collectExpirationReminders({
        docs,
        cases,
        clients,
        dependents,
        visaRequirements,
      }),
    [docs, cases, clients, dependents, visaRequirements],
  );

  const cooldownDays = emailHealth?.cooldownDays ?? 7;

  const eligiblePendingEmailItems = useMemo(() => {
    const nowMs = Date.now();
    return summary.expiringItems.filter((item) => {
      if (!item.client?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(item.client.email.trim())) {
        return false;
      }
      const lastLog = findLatestEmailLogForDoc(item.doc.id, communicationLogs);
      if (!lastLog?.createdAt) return true;
      const lastMs = Date.parse(lastLog.createdAt);
      if (!Number.isFinite(lastMs)) return true;
      const effectiveDays =
        item.severity === 'vencido' || item.severity === 'critico'
          ? Math.min(cooldownDays, 2)
          : cooldownDays;
      return (nowMs - lastMs) / 86400000 >= effectiveDays;
    });
  }, [summary.expiringItems, communicationLogs, cooldownDays]);

  const activeItems = useMemo(() => {
    const base: ExpirationReminderItem[] =
      filter === 'sem_data'
        ? summary.missingDateItems
        : filter === 'vencidos'
          ? summary.expiringItems.filter((i) => i.severity === 'vencido')
          : filter === 'criticos'
            ? summary.expiringItems.filter((i) => i.severity === 'critico')
            : filter === 'atencao'
              ? summary.expiringItems.filter((i) => i.severity === 'atencao')
              : summary.expiringItems;

    const q = queryText.trim().toLowerCase();
    if (!q) return base;
    return base.filter((item) => {
      const hay = `${item.doc.nomeDocumento} ${item.doc.pessoa} ${item.client?.nomeCompleto || ''} ${item.caseObj.titulo}`.toLowerCase();
      return hay.includes(q);
    });
  }, [summary, filter, queryText]);

  const syncPortalNotifications = useCallback(async (items: ExpirationReminderItem[]) => {
    const seenKeys = new Set<string>();
    for (const item of items) {
      const clientId = item.client?.id || item.doc.clientId;
      if (!clientId) continue;
      const dedupKey = `${clientId}::${item.doc.id}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);
      await notifyClientProcessUpdate({
        clientId,
        caseId: item.caseObj.id,
        tipo: 'prazo',
        titulo: `Vencimento próximo: ${item.doc.nomeDocumento}`,
        mensagem: `${item.statusLabel} (Validade: ${item.dataValidadeBR}). Enviamos um lembrete automático para o seu e-mail.`,
        linkDestino: '/portal',
      }).catch(() => undefined);
    }
  }, []);

  // Varredura automática diária silenciosa quando SMTP ativo + há itens pendentes fora do cooldown
  useEffect(() => {
    if (!autoSweepEnabled || !emailHealth?.smtpConfigured || autoSweptRef.current) return;
    if (eligiblePendingEmailItems.length === 0) return;

    try {
      const lastSweep = Number(window.localStorage.getItem(AUTO_EMAIL_LAST_SWEEP_KEY) || '0');
      if (Date.now() - lastSweep < 12 * 3600 * 1000) return;
    } catch {
      // prossegue
    }

    autoSweptRef.current = true;
    void (async () => {
      try {
        const res = await sendExpirationReminderEmails({
          items: eligiblePendingEmailItems,
          communicationLogs,
          brandName,
          copyConsultant,
        });
        try {
          window.localStorage.setItem(AUTO_EMAIL_LAST_SWEEP_KEY, String(Date.now()));
        } catch {
          // ignore
        }
        if (res.createdLogs.length > 0) {
          onEmailLogsCreated?.(res.createdLogs);
          const sentIds = new Set(
            res.outcomes.filter((o) => o.status === 'sent').map((o) => o.docId),
          );
          await syncPortalNotifications(
            eligiblePendingEmailItems.filter((i) => sentIds.has(i.doc.id)),
          );
          setEmailFeedback({
            tone: 'success',
            text: `Automação diária: ${res.sentEmails} e-mail(s) enviado(s) automaticamente cobrindo ${res.coveredDocs} documento(s) < 30 dias.`,
          });
        }
      } catch {
        // Falha silenciosa na varredura automática; envio manual permanece disponível
      }
    })();
  }, [
    autoSweepEnabled,
    emailHealth?.smtpConfigured,
    eligiblePendingEmailItems,
    communicationLogs,
    brandName,
    copyConsultant,
    onEmailLogsCreated,
    syncPortalNotifications,
  ]);

  const handleToggleAutoSweep = () => {
    setAutoSweepEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(AUTO_EMAIL_ENABLED_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleNotifyClient = async (item: ExpirationReminderItem) => {
    if (sendingId) return;
    setSendingId(item.doc.id);
    try {
      const clientName = item.client?.nomeCompleto ? `, ${item.client.nomeCompleto}` : '';
      const detail =
        item.severity === 'vencido'
          ? `o documento "${item.doc.nomeDocumento}" (${item.doc.pessoa}) consta como vencido (${item.dataValidadeBR}) e precisa ser reemitido`
          : `o documento "${item.doc.nomeDocumento}" (${item.doc.pessoa}) expira em ${item.daysRemaining} dia(s) (${item.dataValidadeBR})`;
      const msg = `Olá${clientName}! Lembrete de vencimento D&M Integra Chile: ${detail}. Caso já tenha atualizado, envie pelo Portal do Cliente.`;
      if (item.client?.whatsapp) {
        window.open(buildWhatsAppUrl(item.client.whatsapp, msg), '_blank', 'noopener,noreferrer');
      }
      await onLogWhatsApp(
        item.client?.id || item.doc.clientId,
        item.caseObj.id,
        `Lembrete de Vencimento: ${item.doc.nomeDocumento}`,
        msg,
      );
    } finally {
      setSendingId(null);
    }
  };

  const handleSendSingleEmail = async (item: ExpirationReminderItem, forceSend: boolean) => {
    if (sendingEmailId || batchBusy) return;
    setSendingEmailId(item.doc.id);
    setEmailFeedback(null);
    try {
      const res = await sendExpirationReminderEmails({
        items: [item],
        communicationLogs,
        brandName,
        copyConsultant,
        forceSend,
      });
      if (res.createdLogs.length > 0) {
        onEmailLogsCreated?.(res.createdLogs);
        await syncPortalNotifications([item]);
        setEmailFeedback({
          tone: 'success',
          text: `Lembrete enviado por e-mail para ${item.client?.email} referente a "${item.doc.nomeDocumento}".`,
        });
      } else if (!res.smtpConfigured) {
        setEmailFeedback({
          tone: 'warning',
          text:
            res.warning ||
            'Configure SMTP_HOST, SMTP_USER e SMTP_PASS no ambiente para ativar o envio real via Nodemailer.',
        });
      } else {
        setEmailFeedback({
          tone: res.failedCount > 0 ? 'error' : 'warning',
          text:
            res.outcomes[0]?.reason ||
            res.warning ||
            'Não foi possível concluir o envio deste e-mail.',
        });
      }
    } catch (err) {
      setEmailFeedback({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Erro ao enviar e-mail pelo Nodemailer.',
      });
    } finally {
      setSendingEmailId(null);
    }
  };

  const handleBatchSendEmails = async () => {
    if (batchBusy || sendingEmailId) return;
    setBatchBusy(true);
    setEmailFeedback(null);
    try {
      const targets =
        eligiblePendingEmailItems.length > 0 ? eligiblePendingEmailItems : summary.expiringItems;
      const res = await sendExpirationReminderEmails({
        items: targets,
        communicationLogs,
        brandName,
        copyConsultant,
      });
      if (res.createdLogs.length > 0) {
        onEmailLogsCreated?.(res.createdLogs);
        const sentIds = new Set(
          res.outcomes.filter((o) => o.status === 'sent').map((o) => o.docId),
        );
        await syncPortalNotifications(targets.filter((i) => sentIds.has(i.doc.id)));
        setEmailFeedback({
          tone: 'success',
          text: `${res.sentEmails} e-mail(s) enviado(s) via Nodemailer cobrindo ${res.coveredDocs} documento(s).`,
        });
      } else if (!res.smtpConfigured) {
        setEmailFeedback({
          tone: 'warning',
          text:
            res.warning ||
            'Serviço SMTP ainda não configurado no servidor. Use "Pré-visualizar E-mail" para validar o modelo.',
        });
      } else {
        setEmailFeedback({
          tone: res.failedCount > 0 ? 'error' : 'warning',
          text:
            res.warning ||
            'Nenhum e-mail elegível pendente fora do intervalo de controle.',
        });
      }
    } catch (err) {
      setEmailFeedback({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Falha no disparo em lote de e-mails.',
      });
    } finally {
      setBatchBusy(false);
    }
  };

  const handlePreviewEmail = async () => {
    if (previewBusy) return;
    setPreviewBusy(true);
    setEmailFeedback(null);
    try {
      const source =
        eligiblePendingEmailItems.length > 0
          ? eligiblePendingEmailItems
          : summary.expiringItems;
      const res = await sendExpirationReminderEmails({
        items: source,
        communicationLogs,
        brandName,
        previewOnly: true,
      });
      if (res.previewHtml) {
        setPreviewModal({
          subject: res.previewSubject || 'Lembrete de Vencimento (< 30 dias)',
          to: res.previewTo || '(cliente)',
          html: res.previewHtml,
        });
      } else {
        setEmailFeedback({
          tone: 'warning',
          text: res.warning || 'Não há documentos com vencimento < 30 dias para pré-visualizar.',
        });
      }
    } catch (err) {
      setEmailFeedback({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Não foi possível gerar a prévia do e-mail.',
      });
    } finally {
      setPreviewBusy(false);
    }
  };

  const { counts } = summary;

  return (
    <section
      aria-label="Lembretes de Vencimento de Documentos Exigidos"
      className="border border-slate-200 p-6 space-y-4"
      style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--card-radius, 12px)' }}
    >
      {/* Cabeçalho */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {counts.totalAlertas > 0 ? (
              <AlertTriangle
                className="w-5 h-5 shrink-0"
                style={{ color: counts.vencidos + counts.criticos7d > 0 ? '#DC2626' : '#D97706' }}
                aria-hidden="true"
              />
            ) : (
              <CalendarClock className="w-5 h-5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
            )}
            <h2 className="text-lg font-bold text-slate-900">Lembretes de Vencimento</h2>
          </div>
          <p className="text-xs text-slate-500">
            Verificação automática das datas dos documentos exigidos com expiração em menos de 30 dias e disparo por e-mail (Nodemailer / Firebase Functions)
          </p>
        </div>

        {/* Resumo numérico limpo em texto tabular */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
          <span className={counts.vencidos > 0 ? 'font-bold text-[#DC2626]' : 'text-slate-500'}>
            {counts.vencidos} vencido(s)
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className={counts.criticos7d > 0 ? 'font-bold text-[#DC2626]' : 'text-slate-500'}>
            {counts.criticos7d} crítico(s) ≤ 7d
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className={counts.atencao30d > 0 ? 'font-bold text-[#D97706]' : 'text-slate-500'}>
            {counts.atencao30d} em atenção (8–29d)
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-slate-500">
            {summary.monitoredCount} com data monitorada
          </span>
        </div>
      </div>

      {/* Barra de Automação de E-mails (Nodemailer / Firebase Functions) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
            <Mail className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" aria-hidden="true" />
            Automação de E-mail:
          </span>
          {emailHealth ? (
            <span
              className={`font-semibold ${
                emailHealth.smtpConfigured ? 'text-[#16A34A]' : 'text-[#B45309]'
              }`}
            >
              {emailHealth.smtpConfigured
                ? 'SMTP Nodemailer ativo'
                : 'SMTP pendente de configuração no servidor'}
            </span>
          ) : (
            <span className="text-slate-500">Verificando serviço SMTP...</span>
          )}
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span className="text-slate-600 tabular-nums">
            {eligiblePendingEmailItems.length} pendente(s) de envio automático
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoSweepEnabled}
              onChange={handleToggleAutoSweep}
              className="rounded border-slate-300 text-[var(--color-primary)]"
            />
            Envio automático diário
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={copyConsultant}
              onChange={(e) => setCopyConsultant(e.target.checked)}
              className="rounded border-slate-300 text-[var(--color-primary)]"
            />
            Cópia para mim
          </label>

          <button
            type="button"
            disabled={previewBusy || summary.expiringItems.length === 0}
            onClick={() => void handlePreviewEmail()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            {previewBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            Pré-visualizar E-mail
          </button>

          <button
            type="button"
            disabled={batchBusy || summary.expiringItems.length === 0}
            onClick={() => void handleBatchSendEmails()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {batchBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {batchBusy
              ? 'Enviando...'
              : `Disparar E-mails (${eligiblePendingEmailItems.length})`}
          </button>
        </div>
      </div>

      {emailFeedback && (
        <div
          role={emailFeedback.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2 ${
            emailFeedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : emailFeedback.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-900'
          }`}
        >
          <span>{emailFeedback.text}</span>
          <button
            type="button"
            onClick={() => setEmailFeedback(null)}
            className="font-semibold underline shrink-0"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Barra de filtros + busca */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg text-xs font-semibold"
          role="tablist"
          aria-label="Filtrar lembretes de vencimento"
        >
          {(
            [
              { id: 'todos', label: `Todos < 30d (${counts.totalAlertas})` },
              { id: 'vencidos', label: `Vencidos (${counts.vencidos})` },
              { id: 'criticos', label: `≤ 7 dias (${counts.criticos7d})` },
              { id: 'atencao', label: `8–29 dias (${counts.atencao30d})` },
              { id: 'sem_data', label: `Sem data (${counts.semData})` },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={filter === opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-2.5 py-1.5 rounded-md whitespace-nowrap tabular-nums transition-colors ${
                filter === opt.id
                  ? 'bg-white text-slate-900 border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Filtrar documento, cliente ou caso..."
            aria-label="Buscar nos lembretes de vencimento"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          />
        </div>
      </div>

      {/* Lista ou Empty State */}
      {activeItems.length === 0 ? (
        <div className="py-6 px-4 rounded-lg bg-slate-50/80 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs space-y-0.5">
              <p className="font-semibold text-slate-800">
                {filter === 'sem_data'
                  ? 'Todos os documentos com validade curta já possuem data registrada.'
                  : queryText.trim()
                    ? 'Nenhum documento encontrado com esse filtro de busca.'
                    : 'Nenhum documento exigido expira em menos de 30 dias.'}
              </p>
              <p className="text-slate-500 tabular-nums">
                {summary.upcomingItems.length > 0
                  ? `${summary.upcomingItems.length} documento(s) monitorado(s) estão com validade igual ou superior a 30 dias.`
                  : 'Preencha a data de emissão dos documentos no Checklist ou Dossiê para ativar a contagem automática.'}
              </p>
            </div>
          </div>
          {onOpenChecklist && (
            <button
              type="button"
              onClick={() => onOpenChecklist()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              Conferir datas no Checklist
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-200">
          {activeItems.map((item) => {
            const isCritical = item.severity === 'vencido' || item.severity === 'critico';
            const isWarning = item.severity === 'atencao';
            const statusColor = isCritical
              ? '#DC2626'
              : isWarning
                ? '#D97706'
                : '#475569';
            const latestEmailLog = findLatestEmailLogForDoc(item.doc.id, communicationLogs);
            const hasClientEmail = Boolean(
              item.client?.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(item.client.email.trim()),
            );

            return (
              <div
                key={item.doc.id}
                className="py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isCritical
                        ? 'bg-red-50 text-[#DC2626]'
                        : isWarning
                          ? 'bg-amber-50 text-[#D97706]'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                    title={item.statusLabel}
                  >
                    {item.severity === 'sem_data' ? (
                      <CalendarClock className="w-4 h-4" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                    )}
                  </div>

                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-bold tabular-nums" style={{ color: statusColor }}>
                        {item.statusLabel}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="font-medium text-slate-700">
                        {item.doc.obrigatorio ? 'Obrigatório' : 'Opcional'}
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="text-slate-500">Status atual: {item.doc.status}</span>
                      {latestEmailLog?.createdAt && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-semibold text-[#16A34A] tabular-nums">
                            E-mail enviado em {formatDateBR(latestEmailLog.createdAt)}
                          </span>
                        </>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {item.doc.nomeDocumento}{' '}
                      <span className="font-normal text-slate-500">({item.doc.pessoa})</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-600 tabular-nums">
                      <span>{item.client?.nomeCompleto || 'Cliente não vinculado'}</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="truncate max-w-[260px]">{item.caseObj.titulo}</span>
                      {item.dataEmissao && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span>Emissão: {formatDateBR(item.dataEmissao)}</span>
                        </>
                      )}
                      {item.dataValidadeEfetiva && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-800">
                            Expira em: {item.dataValidadeBR}
                          </span>
                        </>
                      )}
                      {item.validadeDias > 0 && (
                        <>
                          <span className="text-slate-300" aria-hidden="true">·</span>
                          <span>Regra: {item.validadeDias}d</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-11 lg:pl-0 shrink-0">
                  {onOpenChecklist && (
                    <button
                      type="button"
                      onClick={() => onOpenChecklist(item.caseObj.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      Checklist
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenCase(item.caseObj.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Abrir Caso
                  </button>
                  {item.severity !== 'sem_data' && (
                    <>
                      <button
                        type="button"
                        disabled={!hasClientEmail || sendingEmailId === item.doc.id || batchBusy}
                        onClick={() => void handleSendSingleEmail(item, Boolean(latestEmailLog))}
                        title={
                          hasClientEmail
                            ? `Enviar lembrete por e-mail para ${item.client?.email}`
                            : 'Cliente sem e-mail cadastrado'
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                      >
                        {sendingEmailId === item.doc.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Mail className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                        )}
                        {sendingEmailId === item.doc.id
                          ? 'Enviando...'
                          : latestEmailLog
                            ? 'Reenviar E-mail'
                            : 'Enviar E-mail'}
                      </button>

                      <button
                        type="button"
                        disabled={sendingId === item.doc.id}
                        onClick={() => void handleNotifyClient(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34] hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {sendingId === item.doc.id ? 'Registrando...' : 'Avisar Cliente'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Pré-visualização do E-mail Automático */}
      {previewModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pré-visualização do E-mail de Lembrete"
        >
          <div className="bg-white rounded-xl border border-slate-200 max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-slate-500 truncate">Para: {previewModal.to}</p>
                <h3 className="text-sm font-bold text-slate-900 truncate">{previewModal.subject}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal(null)}
                aria-label="Fechar pré-visualização"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-slate-100 overflow-auto flex-1">
              <iframe
                title="Pré-visualização do e-mail automático"
                srcDoc={previewModal.html}
                sandbox=""
                className="w-full min-h-[460px] bg-white rounded-lg border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
