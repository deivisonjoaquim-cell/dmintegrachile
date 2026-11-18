import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FolderOpen,
  MessageCircle,
  Search,
} from 'lucide-react';
import type {
  Case,
  CaseDocument,
  Client,
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
  onOpenCase: (caseId: string) => void;
  onOpenChecklist?: (caseId?: string) => void;
  onLogWhatsApp: (
    clientId: string | undefined,
    caseId: string | undefined,
    assunto: string,
    msg: string,
  ) => Promise<void>;
}

type ReminderFilter = 'todos' | 'vencidos' | 'criticos' | 'atencao' | 'sem_data';

export const PainelLembretesVencimento: React.FC<PainelLembretesVencimentoProps> = ({
  docs,
  cases,
  clients,
  dependents = [],
  visaRequirements = [],
  onOpenCase,
  onOpenChecklist,
  onLogWhatsApp,
}) => {
  const [filter, setFilter] = useState<ReminderFilter>('todos');
  const [queryText, setQueryText] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);

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
            Verificação automática das datas dos documentos exigidos com expiração em menos de 30 dias
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
                    <button
                      type="button"
                      disabled={sendingId === item.doc.id}
                      onClick={() => void handleNotifyClient(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34] hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {sendingId === item.doc.id ? 'Registrando...' : 'Avisar Cliente'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
