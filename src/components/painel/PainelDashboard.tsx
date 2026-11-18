import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  FileWarning,
  FolderArchive,
  MessageCircle,
  Scale,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { PIPELINE_STAGES } from '../../data/seeds';
import type {
  Appointment,
  Case,
  CaseDocument,
  Client,
  CommunicationLog,
  Deadline,
  FinancialRecord,
  Lead,
  LegalSource,
  Task,
  UserRole,
} from '../../types/domain';
import { calcularTermometroDocumentos, calcularUrgencias } from '../../utils/caseMetrics';
import { countUnreadChatForStaff, getPendingClientChatThreads } from '../../utils/documentChat';
import { buildWhatsAppUrl, formatCurrency, formatDateBR, formatDateTimeBR, toIsoDate } from '../../utils/formatters';
import { countLegalReviewPending } from '../../utils/legalSync';

interface PainelDashboardProps {
  role: UserRole;
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines: Deadline[];
  tasks?: Task[];
  appointments?: Appointment[];
  financialRecords: FinancialRecord[];
  communicationLogs?: CommunicationLog[];
  legalSources?: LegalSource[];
  diasAlertaRevisaoLegal?: number;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
  onOpenCase: (caseId: string, targetTab?: 'resumo' | 'comunicacao') => void;
  onToggleTask?: (task: Task) => Promise<void>;
  onNavigateSection?: (
    section:
      | 'agenda'
      | 'leads'
      | 'clientes'
      | 'casos'
      | 'checklist'
      | 'documentos'
      | 'contratos'
      | 'financeiro'
      | 'parceiros'
      | 'legal'
      | 'ferramentas',
  ) => void;
}

export const PainelDashboard: React.FC<PainelDashboardProps> = ({
  role,
  leads,
  clients,
  cases,
  docs,
  deadlines,
  tasks = [],
  appointments = [],
  financialRecords,
  communicationLogs = [],
  legalSources = [],
  diasAlertaRevisaoLegal = 90,
  onLogWhatsApp,
  onOpenCase,
  onToggleTask,
  onNavigateSection,
}) => {
  const [filterOrigem, setFilterOrigem] = useState('Todas');
  const [urgencyFilter, setUrgencyFilter] = useState<'todas' | 'Critica' | 'Alta' | 'Media'>('todas');
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const isAssistente = role === 'assistente';

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--card-radius, 12px)',
  };

  const urgencias = useMemo(
    () =>
      calcularUrgencias({
        cases,
        clients,
        docs,
        deadlines,
        financialRecords: isAssistente ? [] : financialRecords,
        role,
      }),
    [cases, clients, docs, deadlines, financialRecords, role, isAssistente],
  );

  const filteredUrgencias = useMemo(
    () => (urgencyFilter === 'todas' ? urgencias : urgencias.filter((u) => u.severidade === urgencyFilter)),
    [urgencias, urgencyFilter],
  );

  const filteredLeads = useMemo(
    () => (filterOrigem === 'Todas' ? leads : leads.filter((l) => l.origem === filterOrigem)),
    [leads, filterOrigem],
  );

  const activeClients = useMemo(() => clients.filter((c) => !c.arquivado), [clients]);
  const activeCases = useMemo(() => cases.filter((c) => !c.arquivado), [cases]);

  const avgThermometer = useMemo(() => {
    if (activeCases.length === 0) return 0;
    const scores = activeCases.map((c) => {
      const cDocs = docs.filter((d) => d.caseId === c.id);
      return calcularTermometroDocumentos(cDocs).notaGeral;
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [activeCases, docs]);

  const topReprovados = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of docs) {
      if (d.status === 'Reprovado') {
        counts.set(d.nomeDocumento, (counts.get(d.nomeDocumento) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [docs]);

  const npsMedio = useMemo(() => {
    const rated = activeCases.filter((c) => typeof c.npsNota === 'number');
    if (rated.length === 0) return null;
    const sum = rated.reduce((a, c) => a + (c.npsNota || 0), 0);
    return (sum / rated.length).toFixed(1);
  }, [activeCases]);

  const receitaTotalBrl = useMemo(() => {
    if (isAssistente) return 0;
    return financialRecords.filter((f) => f.status === 'Pago' && f.moeda === 'BRL').reduce((a, b) => a + b.valor, 0);
  }, [financialRecords, isAssistente]);

  const inadimplenciaBrl = useMemo(() => {
    if (isAssistente) return 0;
    return financialRecords.filter((f) => f.status === 'Atrasado' && f.moeda === 'BRL').reduce((a, b) => a + b.valor, 0);
  }, [financialRecords, isAssistente]);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const pendingTasksToday = useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'Concluída')
        .sort((a, b) => (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31'))
        .slice(0, 6),
    [tasks],
  );
  const totalOpenTasks = useMemo(() => tasks.filter((t) => t.status !== 'Concluída').length, [tasks]);
  const appointmentsToday = useMemo(
    () =>
      appointments
        .filter((a) => a.status !== 'Cancelado' && (a.dataHoraInicio || '').startsWith(todayIso))
        .sort((a, b) => a.dataHoraInicio.localeCompare(b.dataHoraInicio)),
    [appointments, todayIso],
  );
  const pendingDocsReview = useMemo(
    () => docs.filter((d) => d.status === 'Enviado' || d.status === 'Em análise').slice(0, 6),
    [docs],
  );
  const totalPendingDocs = useMemo(
    () => docs.filter((d) => d.status === 'Enviado' || d.status === 'Em análise').length,
    [docs],
  );
  const portalPendingClients = useMemo(
    () => activeClients.filter((c) => c.statusAcessoPortal === 'Pendente liberação'),
    [activeClients],
  );

  const pipelineRows = useMemo(() => {
    const rows = PIPELINE_STAGES.map((st) => ({
      numero: st.numero,
      nome: st.nome,
      count: activeCases.filter((c) => c.etapaPipeline === st.numero).length,
    })).filter((r) => r.count > 0);
    const maxCount = rows.reduce((m, r) => Math.max(m, r.count), 1);
    return { rows, maxCount };
  }, [activeCases]);

  const chatThreads = useMemo(
    () => getPendingClientChatThreads(communicationLogs, clients, cases).slice(0, 5),
    [communicationLogs, clients, cases],
  );
  const unreadChatTotal = useMemo(() => countUnreadChatForStaff(communicationLogs), [communicationLogs]);
  const legalPending = useMemo(
    () => countLegalReviewPending(legalSources, diasAlertaRevisaoLegal),
    [legalSources, diasAlertaRevisaoLegal],
  );

  const handleNotifyUrgency = async (u: (typeof urgencias)[number]) => {
    const text = `Olá${u.clientNome ? `, ${u.clientNome}` : ''}! Alerta operacional D&M Integra Chile: ${u.titulo} — ${u.detalhe} (Data ref.: ${u.dataReferenciaBR}).`;
    if (u.clientWhatsapp) {
      window.open(buildWhatsAppUrl(u.clientWhatsapp, text), '_blank', 'noopener,noreferrer');
    }
    await onLogWhatsApp(u.clientId, u.caseId, `Alerta WhatsApp: ${u.categoria}`, text);
  };

  const handleQuickToggleTask = async (task: Task) => {
    if (!onToggleTask || busyTaskId) return;
    setBusyTaskId(task.id);
    try {
      await onToggleTask(task);
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hoje &amp; Central de Operações</h1>
          <p className="text-xs text-slate-500">
            Resumo diário acionável: prazos críticos, conferência documental, agenda e funil operacional
          </p>
        </div>
        <select
          value={filterOrigem}
          onChange={(e) => setFilterOrigem(e.target.value)}
          aria-label="Filtrar métricas por origem"
          className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-medium"
        >
          <option value="Todas">Todas as origens de leads</option>
          <option value="Site">Site</option>
          <option value="Instagram">Instagram</option>
          <option value="Indicação">Indicação</option>
          <option value="Parceiro">Parceiro</option>
          <option value="Outro">Outro</option>
        </select>
      </div>

      {/* Atalhos Rápidos da Operação */}
      {onNavigateSection && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            {
              sec: 'leads' as const,
              title: 'Triagem de Leads',
              sub: `${filteredLeads.filter((l) => l.statusFunil === 'Novo').length} novo(s) aguardando`,
              icon: <UserCheck className="w-4 h-4 text-[var(--color-primary)]" />,
            },
            {
              sec: 'agenda' as const,
              title: 'Agenda, Tarefas & Prazos',
              sub: `${totalOpenTasks} tarefa(s) em aberto`,
              icon: <Calendar className="w-4 h-4 text-[var(--color-primary)]" />,
            },
            {
              sec: 'checklist' as const,
              title: 'Checklist por Visto',
              sub: `${totalPendingDocs} doc(s) em conferência`,
              icon: <ClipboardCheck className="w-4 h-4 text-[var(--color-primary)]" />,
            },
            {
              sec: 'ferramentas' as const,
              title: 'Calculadoras & Simulador',
              sub: 'Prazos SERMIG · Câmbio · Custos',
              icon: <Calculator className="w-4 h-4 text-[var(--color-primary)]" />,
            },
          ].map((item) => (
            <button
              key={item.sec}
              type="button"
              onClick={() => onNavigateSection(item.sec)}
              className="text-left border border-slate-200 px-4 py-3 hover:border-slate-300 transition-colors flex items-center justify-between gap-2 group"
              style={cardStyle}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">{item.title}</p>
                  <p className="text-[11px] text-slate-500 truncate tabular-nums">{item.sub}</p>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Alerta Governança Normativa SERMIG / BCN */}
      {!isAssistente && legalPending.totalAttention > 0 && onNavigateSection && (
        <div
          className="border border-amber-200 bg-amber-50/70 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          style={{ borderRadius: 'var(--card-radius, 12px)' }}
        >
          <div className="flex items-start gap-3">
            <Scale className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-950">
                Governança Normativa SERMIG / BCN — {legalPending.totalAttention} norma(s) pedindo atenção
              </p>
              <p className="text-[11px] text-amber-900">
                {legalPending.aVerificar > 0 ? `${legalPending.aVerificar} aguardando verificação` : 'Status vigentes'}
                {legalPending.outdated > 0
                  ? ` · ${legalPending.outdated} sem conferência há mais de ${diasAlertaRevisaoLegal} dias`
                  : ''}
                . Use o verificador online com IA ou sincronize a base oficial.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateSection('legal')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white shrink-0"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Revisar Base Legal
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigateSection?.('leads')}
          className="text-left border border-slate-200 p-5 hover:border-slate-300 transition-colors"
          style={cardStyle}
        >
          <p className="text-xs font-medium text-slate-500">Leads no funil</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{filteredLeads.length}</p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            {filteredLeads.filter((l) => l.statusFunil === 'Novo').length} aguardando 1º contato
          </p>
        </button>

        <button
          type="button"
          onClick={() => onNavigateSection?.('casos')}
          className="text-left border border-slate-200 p-5 hover:border-slate-300 transition-colors"
          style={cardStyle}
        >
          <p className="text-xs font-medium text-slate-500">Casos ativos / Clientes</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {activeCases.length} / {activeClients.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            Termômetro médio: {avgThermometer}%
            {portalPendingClients.length > 0 ? ` · ${portalPendingClients.length} portal pendente` : ''}
          </p>
        </button>

        <div className="border border-slate-200 p-5" style={cardStyle}>
          <p className="text-xs font-medium text-slate-500">Urgências identificadas</p>
          <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: urgencias.length > 0 ? '#C82333' : '#1E7E34' }}>
            {urgencias.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 tabular-nums">
            NPS médio: {npsMedio ? `${npsMedio}/5` : 'Sem avaliações'}
          </p>
        </div>

        {!isAssistente ? (
          <button
            type="button"
            onClick={() => onNavigateSection?.('financeiro')}
            className="text-left border border-slate-200 p-5 hover:border-slate-300 transition-colors"
            style={cardStyle}
          >
            <p className="text-xs font-medium text-slate-500">Receita recebida / Em atraso (BRL)</p>
            <p className="text-xl font-bold text-[#1E7E34] mt-1 tabular-nums">{formatCurrency(receitaTotalBrl, 'BRL')}</p>
            <p className="text-xs text-[#C82333] mt-1 tabular-nums">Em atraso: {formatCurrency(inadimplenciaBrl, 'BRL')}</p>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigateSection?.('documentos')}
            className="text-left border border-slate-200 p-5 hover:border-slate-300 transition-colors"
            style={cardStyle}
          >
            <p className="text-xs font-medium text-slate-500">Documentos na esteira</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{docs.length}</p>
            <p className="text-xs text-slate-500 mt-1 tabular-nums">{totalPendingDocs} aguardando conferência</p>
          </button>
        )}
      </div>

      {/* O que fazer hoje */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="border border-slate-200 p-5 space-y-3" style={cardStyle}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-[var(--color-primary)]" />
              Tarefas Prioritárias ({totalOpenTasks})
            </h2>
            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('agenda')}
                className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline whitespace-nowrap"
              >
                Ver todas
              </button>
            )}
          </div>
          {pendingTasksToday.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma tarefa pendente no momento.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {pendingTasksToday.map((t) => (
                <li key={t.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {onToggleTask && (
                      <button
                        type="button"
                        disabled={busyTaskId === t.id}
                        onClick={() => void handleQuickToggleTask(t)}
                        aria-label={`Concluir tarefa ${t.titulo}`}
                        title="Marcar como concluída"
                        className="mt-0.5 text-slate-400 hover:text-[#1E7E34] shrink-0 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{t.titulo}</p>
                      <p className="text-[11px] text-slate-500 tabular-nums">
                        {t.prioridade} {t.prazo ? `· Até ${formatDateBR(t.prazo)}` : ''}
                      </p>
                    </div>
                  </div>
                  {t.caseId && (
                    <button
                      type="button"
                      onClick={() => onOpenCase(t.caseId!)}
                      className="px-2 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 shrink-0 hover:bg-slate-50"
                    >
                      Abrir
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-slate-200 p-5 space-y-3" style={cardStyle}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileWarning className="w-4 h-4 text-amber-700" />
              Docs para Conferir ({totalPendingDocs})
            </h2>
            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('documentos')}
                className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline whitespace-nowrap"
              >
                Dossiês
              </button>
            )}
          </div>
          {pendingDocsReview.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhum documento enviado aguardando triagem.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {pendingDocsReview.map((d) => (
                <li key={d.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{d.nomeDocumento}</p>
                    <p className="text-[11px] text-slate-500">
                      {d.pessoa} · {d.status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCase(d.caseId)}
                    className="px-2 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 shrink-0 hover:bg-slate-50"
                  >
                    Conferir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border border-slate-200 p-5 space-y-3" style={cardStyle}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-primary)]" />
              Agenda de Hoje ({appointmentsToday.length})
            </h2>
            {onNavigateSection && (
              <button
                type="button"
                onClick={() => onNavigateSection('agenda')}
                className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline whitespace-nowrap"
              >
                Abrir agenda
              </button>
            )}
          </div>
          {appointmentsToday.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma reunião agendada para hoje ({formatDateBR(todayIso)}).</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {appointmentsToday.map((a) => (
                <li key={a.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{a.titulo}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">
                      {a.dataHoraInicio.slice(11, 16) || formatDateBR(a.dataHoraInicio)} · {a.tipo}
                    </p>
                  </div>
                  {a.caseId && (
                    <button
                      type="button"
                      onClick={() => onOpenCase(a.caseId!)}
                      className="px-2 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 shrink-0 hover:bg-slate-50"
                    >
                      Caso
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Dúvidas Rápidas no Chat (Portal do Cliente) */}
      <section className="border border-slate-200 p-5 space-y-3" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-[var(--color-primary)]" />
              Dúvidas Rápidas no Chat (Documentos)
            </h2>
            <p className="text-xs text-slate-500">
              Mensagens enviadas pelo cliente no widget do Portal e integradas ao histórico de cada processo
            </p>
          </div>
          <span
            className={`text-xs font-bold tabular-nums ${
              unreadChatTotal > 0 ? 'text-[#C82333]' : 'text-slate-600'
            }`}
          >
            {unreadChatTotal > 0
              ? `${unreadChatTotal} não lida(s)`
              : `${chatThreads.length} conversa(s)`}
          </span>
        </div>

        {chatThreads.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">
            Nenhuma dúvida de documento enviada pelos clientes no chat até o momento.
          </p>
        ) : (
          <div className="divide-y divide-slate-200">
            {chatThreads.map((thread) => (
              <div
                key={thread.clientId}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{thread.clientName}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 truncate">{thread.caseTitle}</span>
                    <span
                      className={`font-semibold tabular-nums ${
                        thread.unreadCount > 0
                          ? 'text-[#C82333]'
                          : thread.awaitingReply
                            ? 'text-amber-700'
                            : 'text-[#1E7E34]'
                      }`}
                    >
                      {thread.unreadCount > 0
                        ? `· ${thread.unreadCount} nova(s)`
                        : thread.awaitingReply
                          ? '· Aguardando resposta'
                          : '· Respondido'}
                    </span>
                  </div>
                  {thread.lastMessage.documentNome && (
                    <p className="text-[11px] font-semibold text-[var(--color-primary)]">
                      Doc: {thread.lastMessage.documentNome}
                    </p>
                  )}
                  <p className="text-slate-700 line-clamp-2">{thread.lastMessage.mensagem}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    Última atividade: {formatDateTimeBR(thread.lastMessage.createdAt)}
                  </p>
                </div>
                <div className="shrink-0">
                  {thread.caseId ? (
                    <button
                      type="button"
                      onClick={() => onOpenCase(thread.caseId, 'comunicacao')}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    >
                      Responder no Histórico
                    </button>
                  ) : (
                    onNavigateSection && (
                      <button
                        type="button"
                        onClick={() => onNavigateSection('clientes')}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        Abrir Clientes
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Central de Urgências */}
      <section className="border border-slate-200 p-6 space-y-4" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#C82333]" />
              <h2 className="text-lg font-bold text-slate-900">Central de Urgências</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Vencimentos ≤ 15d · Estampado 90d · Prorrogação · &gt;180d SERMIG · Descargos
            </p>
          </div>

          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            {(
              [
                { id: 'todas', label: `Todas (${urgencias.length})` },
                { id: 'Critica', label: `Críticas (${urgencias.filter((u) => u.severidade === 'Critica').length})` },
                { id: 'Alta', label: `Altas (${urgencias.filter((u) => u.severidade === 'Alta').length})` },
                { id: 'Media', label: `Médias (${urgencias.filter((u) => u.severidade === 'Media').length})` },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setUrgencyFilter(opt.id)}
                className={`px-2.5 py-1 rounded-md whitespace-nowrap tabular-nums transition-colors ${
                  urgencyFilter === opt.id ? 'bg-white text-slate-900 border border-slate-200' : 'text-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {filteredUrgencias.length === 0 ? (
          <p className="text-sm text-slate-600 py-4">Nenhum alerta nesta severidade no momento.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredUrgencias.map((u) => (
              <div key={u.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tabular-nums" style={{ color: u.severidade === 'Critica' ? '#C82333' : '#B45309' }}>
                    {u.categoria} · {u.severidade} · Ref.: {u.dataReferenciaBR}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{u.titulo}</p>
                  <p className="text-xs text-slate-600">
                    {u.clientNome ? `${u.clientNome} — ` : ''}
                    {u.detalhe}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.caseId && (
                    <button
                      type="button"
                      onClick={() => onOpenCase(u.caseId!)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                    >
                      Abrir Caso
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNotifyUrgency(u)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34] whitespace-nowrap"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Avisar no WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Métricas gerenciais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border border-slate-200 p-6 space-y-3" style={cardStyle}>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="text-base font-semibold text-slate-900">Casos por Etapa do Pipeline</h2>
          </div>
          <div className="space-y-2.5">
            {pipelineRows.rows.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum caso ativo cadastrado ainda.</p>
            ) : (
              pipelineRows.rows.map((st) => {
                const pct = Math.max(8, Math.round((st.count / pipelineRows.maxCount) * 100));
                return (
                  <div key={st.numero} className="space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="text-slate-700 truncate">
                        Etapa {st.numero}: {st.nome}
                      </span>
                      <span className="font-bold tabular-nums text-slate-900 shrink-0">{st.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: 'var(--color-primary)' }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="border border-slate-200 p-6 space-y-3" style={cardStyle}>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="text-base font-semibold text-slate-900">Documentos Mais Reprovados</h2>
          </div>
          {topReprovados.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma reprovação documental registrada até o momento.</p>
          ) : (
            <div className="space-y-2">
              {topReprovados.map(([nome, qtd]) => (
                <div key={nome} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-700">{nome}</span>
                  <span className="font-bold tabular-nums text-[#C82333]">{qtd} reprovação(ões)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
