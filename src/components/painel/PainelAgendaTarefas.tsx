import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { EmptyState, UiButton } from '../ui/DesignSystem';
import { deleteDocumentAudited, makeId, saveDocumentAudited } from '../../services/firestoreService';
import type {
  Appointment,
  Case,
  Client,
  Deadline,
  Task,
  UserRole,
} from '../../types/domain';
import {
  buildGoogleCalendarUrl,
  daysUntilDate,
  downloadIcsFile,
  formatDateBR,
  toIsoDate,
} from '../../utils/formatters';

interface PainelAgendaTarefasProps {
  role: UserRole;
  clients: Client[];
  cases: Case[];
  tasks: Task[];
  deadlines: Deadline[];
  appointments: Appointment[];
  onRefresh: () => Promise<void>;
  onOpenCase: (caseId: string) => void;
  initialTab?: 'hoje' | 'tarefas' | 'prazos' | 'agenda';
}

type AgendaTab = 'hoje' | 'tarefas' | 'prazos' | 'agenda';

export const PainelAgendaTarefas: React.FC<PainelAgendaTarefasProps> = ({
  role,
  clients,
  cases,
  tasks,
  deadlines,
  appointments,
  onRefresh,
  onOpenCase,
  initialTab = 'hoje',
}) => {
  const canDelete = role === 'admin' || role === 'consultor';
  const [tab, setTab] = useState<AgendaTab>(initialTab);
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Quick creation state
  const [createType, setCreateType] = useState<'none' | 'task' | 'deadline' | 'appointment'>('none');
  const [targetCaseId, setTargetCaseId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [dateValue, setDateValue] = useState(() => toIsoDate(new Date(Date.now() + 3 * 86400000)));
  const [timeValue, setTimeValue] = useState('10:00');
  const [priority, setPriority] = useState<Task['prioridade']>('Alta');
  const [deadlineType, setDeadlineType] = useState<Deadline['tipo']>('Prazo Legal 6 Meses SERMIG');
  const [aptType, setAptType] = useState<Appointment['tipo']>('Conferência Documental');
  const [description, setDescription] = useState('');

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);
  const activeCases = useMemo(() => cases.filter((c) => !c.arquivado), [cases]);

  const q = search.trim().toLowerCase();

  const sortedTasks = useMemo(() => {
    return tasks
      .filter((t) => (showCompleted ? true : t.status !== 'Concluída'))
      .filter((t) => {
        if (!q) return true;
        const c = t.caseId ? caseMap.get(t.caseId) : undefined;
        return (
          t.titulo.toLowerCase().includes(q) ||
          (t.descricao || '').toLowerCase().includes(q) ||
          (c?.titulo || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.status === 'Concluída' && b.status !== 'Concluída') return 1;
        if (a.status !== 'Concluída' && b.status === 'Concluída') return -1;
        return (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31');
      });
  }, [tasks, showCompleted, q, caseMap]);

  const sortedDeadlines = useMemo(() => {
    return deadlines
      .filter((d) => (showCompleted ? true : !d.concluido))
      .filter((d) => {
        if (!q) return true;
        const c = d.caseId ? caseMap.get(d.caseId) : undefined;
        return (
          d.titulo.toLowerCase().includes(q) ||
          d.tipo.toLowerCase().includes(q) ||
          (c?.titulo || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.concluido && !b.concluido) return 1;
        if (!a.concluido && b.concluido) return -1;
        return (a.dataLimite || '9999-12-31').localeCompare(b.dataLimite || '9999-12-31');
      });
  }, [deadlines, showCompleted, q, caseMap]);

  const sortedAppointments = useMemo(() => {
    return appointments
      .filter((a) => (showCompleted ? true : a.status !== 'Cancelado' && a.status !== 'Realizado'))
      .filter((a) => {
        if (!q) return true;
        const c = a.caseId ? caseMap.get(a.caseId) : undefined;
        return (
          a.titulo.toLowerCase().includes(q) ||
          a.tipo.toLowerCase().includes(q) ||
          (c?.titulo || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.dataHoraInicio || '').localeCompare(b.dataHoraInicio || ''));
  }, [appointments, showCompleted, q, caseMap]);

  const stats = useMemo(() => {
    const openTasks = tasks.filter((t) => t.status !== 'Concluída').length;
    const criticalDeadlines = deadlines.filter((d) => {
      if (d.concluido) return false;
      const days = daysUntilDate(d.dataLimite);
      return days !== null && days <= 15;
    }).length;
    const upcomingApts = appointments.filter(
      (a) => a.status === 'Agendado' || a.status === 'Confirmado',
    ).length;
    const doneTotal =
      tasks.filter((t) => t.status === 'Concluída').length +
      deadlines.filter((d) => d.concluido).length;
    return { openTasks, criticalDeadlines, upcomingApts, doneTotal };
  }, [tasks, deadlines, appointments]);

  const toggleTask = async (task: Task) => {
    setBusyId(task.id);
    try {
      const nextStatus: Task['status'] = task.status === 'Concluída' ? 'Pendente' : 'Concluída';
      await saveDocumentAudited(
        'tasks',
        task.id,
        { ...task, status: nextStatus },
        false,
        role,
        'status_tarefa',
        { status: task.status },
      );
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const toggleDeadline = async (dl: Deadline) => {
    setBusyId(dl.id);
    try {
      await saveDocumentAudited(
        'deadlines',
        dl.id,
        { ...dl, concluido: !dl.concluido },
        false,
        role,
        'status_prazo',
        { concluido: dl.concluido },
      );
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const updateAppointmentStatus = async (apt: Appointment, status: Appointment['status']) => {
    setBusyId(apt.id);
    try {
      await saveDocumentAudited(
        'appointments',
        apt.id,
        { ...apt, status },
        false,
        role,
        'status_agendamento',
        { status: apt.status },
      );
      await onRefresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || createType === 'none') return;
    const linkedCase = targetCaseId ? caseMap.get(targetCaseId) : undefined;
    const clientId = linkedCase?.clientId;

    if (createType === 'task') {
      const id = makeId('task');
      const payload: Task = {
        id,
        titulo: title.trim(),
        descricao: description.trim() || undefined,
        caseId: linkedCase?.id,
        clientId,
        prazo: dateValue || undefined,
        prioridade: priority,
        status: 'Pendente',
        createdAt: new Date().toISOString(),
      };
      await saveDocumentAudited('tasks', id, payload as unknown as Record<string, unknown>, true, role, 'nova_tarefa');
      setFeedback('Tarefa adicionada com sucesso.');
    } else if (createType === 'deadline') {
      const id = makeId('dl');
      const payload: Deadline = {
        id,
        titulo: title.trim(),
        tipo: deadlineType,
        dataLimite: dateValue,
        caseId: linkedCase?.id,
        clientId,
        concluido: false,
      };
      await saveDocumentAudited('deadlines', id, payload as unknown as Record<string, unknown>, true, role, 'novo_prazo');
      setFeedback('Prazo migratório registrado.');
    } else if (createType === 'appointment') {
      const id = makeId('apt');
      const isoStart = `${dateValue}T${timeValue || '10:00'}:00`;
      const payload: Appointment = {
        id,
        titulo: title.trim(),
        tipo: aptType,
        dataHoraInicio: isoStart,
        caseId: linkedCase?.id,
        clientId,
        status: 'Agendado',
        observacoes: description.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await saveDocumentAudited('appointments', id, payload as unknown as Record<string, unknown>, true, role, 'novo_agendamento');
      setFeedback('Agendamento criado com sucesso.');
    }

    setTitle('');
    setDescription('');
    setCreateType('none');
    await onRefresh();
  };

  const renderCaseBadge = (caseId?: string, clientId?: string) => {
    const c = caseId ? caseMap.get(caseId) : undefined;
    const cl = clientId ? clientMap.get(clientId) : c ? clientMap.get(c.clientId) : undefined;
    if (!c && !cl) return <span className="text-slate-400">Geral da equipe</span>;
    return (
      <span className="text-slate-600">
        {cl?.nomeCompleto || 'Cliente'}
        {c ? ` · ${c.titulo}` : ''}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Agenda, Tarefas &amp; Prazos</h1>
          <p className="text-xs text-slate-500">
            Controle centralizado de prazos SERMIG/PDI, entregas da equipe e agendamentos com clientes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UiButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateType(createType === 'task' ? 'none' : 'task')}
          >
            <Plus className="w-3.5 h-3.5" /> Nova Tarefa
          </UiButton>
          <UiButton
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCreateType(createType === 'deadline' ? 'none' : 'deadline')}
          >
            <AlertTriangle className="w-3.5 h-3.5" /> Novo Prazo
          </UiButton>
          <UiButton
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setCreateType(createType === 'appointment' ? 'none' : 'appointment')}
          >
            <Calendar className="w-3.5 h-3.5" /> Novo Agendamento
          </UiButton>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-800 flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="underline">
            Fechar
          </button>
        </div>
      )}

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-4">
          <p className="text-xs font-medium text-slate-500">Tarefas em Aberto</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{stats.openTasks}</p>
        </div>
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-4">
          <p className="text-xs font-medium text-slate-500">Prazos Críticos (&le; 15d)</p>
          <p
            className="text-2xl font-bold mt-1 tabular-nums"
            style={{ color: stats.criticalDeadlines > 0 ? '#C82333' : '#1E7E34' }}
          >
            {stats.criticalDeadlines}
          </p>
        </div>
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-4">
          <p className="text-xs font-medium text-slate-500">Agendamentos Ativos</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{stats.upcomingApts}</p>
        </div>
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-4">
          <p className="text-xs font-medium text-slate-500">Itens Concluídos</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{stats.doneTotal}</p>
        </div>
      </div>

      {/* Inline Creation Drawer */}
      {createType !== 'none' && (
        <form
          onSubmit={handleCreateSubmit}
          className="bg-[var(--color-surface)] border border-slate-200 card-radius p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              {createType === 'task'
                ? 'Nova Tarefa Operacional'
                : createType === 'deadline'
                  ? 'Novo Prazo Legal / Migratório'
                  : 'Novo Agendamento / Reunião'}
            </h2>
            <button
              type="button"
              onClick={() => setCreateType('none')}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Cancelar
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Título *</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  createType === 'task'
                    ? 'Ex.: Solicitar antecedentes apostilados'
                    : createType === 'deadline'
                      ? 'Ex.: Limite Estampado Electrónico (90 dias)'
                      : 'Ex.: Conferência documental pré-protocolo'
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vincular a um Caso</label>
              <select
                value={targetCaseId}
                onChange={(e) => setTargetCaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="">Sem vínculo específico</option>
                {activeCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Data</label>
              <input
                type="date"
                required
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            {createType === 'task' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prioridade</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Task['prioridade'])}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Média">Média</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>
            )}

            {createType === 'deadline' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria do Prazo</label>
                <select
                  value={deadlineType}
                  onChange={(e) => setDeadlineType(e.target.value as Deadline['tipo'])}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="Prazo Legal 6 Meses SERMIG">Prazo Legal 6 Meses SERMIG</option>
                  <option value="Entrada no Chile 90d">Entrada no Chile 90d</option>
                  <option value="Janela Prorrogação">Janela Prorrogação</option>
                  <option value="Elegibilidade Definitiva">Elegibilidade Definitiva</option>
                  <option value="Validade Documento">Validade Documento</option>
                  <option value="Validade Passaporte">Validade Passaporte</option>
                  <option value="Resposta Requerimento/Recurso">Resposta Requerimento/Recurso</option>
                  <option value="Vencimento Cédula">Vencimento Cédula</option>
                  <option value="Parcela/Reunião">Parcela/Reunião</option>
                </select>
              </div>
            )}

            {createType === 'appointment' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Horário</label>
                  <input
                    type="time"
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo</label>
                  <select
                    value={aptType}
                    onChange={(e) => setAptType(e.target.value as Appointment['tipo'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                  >
                    <option value="Diagnóstico">Diagnóstico</option>
                    <option value="Reunião de Onboarding">Reunião de Onboarding</option>
                    <option value="Conferência Documental">Conferência Documental</option>
                    <option value="Acompanhamento">Acompanhamento</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </>
            )}

            {(createType === 'task' || createType === 'appointment') && (
              <div className="md:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Observações / Detalhes</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Instruções rápidas ou pauta da reunião..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <UiButton type="submit" variant="primary" size="sm">
              Salvar Registro
            </UiButton>
          </div>
        </form>
      )}

      {/* Filter & View Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {(
            [
              { id: 'hoje', label: 'Visão Geral' },
              { id: 'tarefas', label: `Tarefas (${sortedTasks.length})` },
              { id: 'prazos', label: `Prazos (${sortedDeadlines.length})` },
              { id: 'agenda', label: `Agendamentos (${sortedAppointments.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tarefa, prazo ou cliente..."
              className="pl-8 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-xs w-64"
            />
          </div>
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 px-2 py-1.5 rounded-lg border border-slate-200 bg-white cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
            />
            Mostrar concluídos
          </label>
        </div>
      </div>

      {/* Tarefas Section */}
      {(tab === 'hoje' || tab === 'tarefas') && (
        <section className="bg-[var(--color-surface)] border border-slate-200 card-radius overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Tarefas Operacionais</h2>
            <span className="text-xs text-slate-500 tabular-nums">{sortedTasks.length} item(ns)</span>
          </div>
          {sortedTasks.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<CheckCircle2 className="w-5 h-5" />}
                title="Nenhuma tarefa nesta visão"
                description="Adicione uma nova tarefa ou sincronize follow-ups de diagnósticos na aba de Leads."
                actionLabel="Nova Tarefa"
                onAction={() => setCreateType('task')}
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {(tab === 'hoje' ? sortedTasks.slice(0, 8) : sortedTasks).map((t) => {
                const days = daysUntilDate(t.prazo);
                const overdue = days !== null && days < 0 && t.status !== 'Concluída';
                return (
                  <div
                    key={t.id}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={t.status === 'Concluída'}
                        disabled={busyId === t.id}
                        onChange={() => void toggleTask(t)}
                        aria-label={`Marcar tarefa ${t.titulo} como concluída`}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-semibold ${
                            t.status === 'Concluída' ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {t.titulo}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span
                            className={
                              t.prioridade === 'Urgente' || overdue
                                ? 'font-semibold text-[#C82333]'
                                : t.prioridade === 'Alta'
                                  ? 'font-semibold text-amber-700'
                                  : ''
                            }
                          >
                            {t.prioridade}
                          </span>
                          <span aria-hidden="true">·</span>
                          {renderCaseBadge(t.caseId, t.clientId)}
                          {t.prazo && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className={`tabular-nums ${overdue ? 'text-[#C82333] font-semibold' : ''}`}>
                                Até {formatDateBR(t.prazo)}
                                {overdue ? ` (${Math.abs(days!)}d em atraso)` : ''}
                              </span>
                            </>
                          )}
                        </div>
                        {t.descricao && <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-2xl">{t.descricao}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.caseId && (
                        <button
                          type="button"
                          onClick={() => onOpenCase(t.caseId!)}
                          className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Abrir Caso
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteDocumentAudited('tasks', t.id, role, t);
                            await onRefresh();
                          }}
                          aria-label="Excluir tarefa"
                          className="p-1.5 rounded text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Prazos Section */}
      {(tab === 'hoje' || tab === 'prazos') && (
        <section className="bg-[var(--color-surface)] border border-slate-200 card-radius overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Prazos Legais &amp; Migratórios</h2>
            <span className="text-xs text-slate-500 tabular-nums">{sortedDeadlines.length} prazo(s)</span>
          </div>
          {sortedDeadlines.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Clock className="w-5 h-5" />}
                title="Nenhum prazo pendente"
                description="Use o botão Novo Prazo ou a Calculadora de Prazos Migratórios para registrar datas SERMIG/PDI."
                actionLabel="Registrar Prazo"
                onAction={() => setCreateType('deadline')}
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {(tab === 'hoje' ? sortedDeadlines.slice(0, 8) : sortedDeadlines).map((dl) => {
                const days = daysUntilDate(dl.dataLimite);
                const isUrgent = !dl.concluido && days !== null && days <= 15;
                return (
                  <div
                    key={dl.id}
                    className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <input
                        type="checkbox"
                        checked={dl.concluido}
                        disabled={busyId === dl.id}
                        onChange={() => void toggleDeadline(dl)}
                        aria-label={`Marcar prazo ${dl.titulo} como cumprido`}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300"
                      />
                      <div className="min-w-0">
                        <p className={`text-xs font-semibold ${dl.concluido ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                          {dl.titulo}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span className="font-medium text-slate-700">{dl.tipo}</span>
                          <span aria-hidden="true">·</span>
                          {renderCaseBadge(dl.caseId, dl.clientId)}
                          <span aria-hidden="true">·</span>
                          <span className={`tabular-nums font-semibold ${isUrgent ? 'text-[#C82333]' : 'text-slate-700'}`}>
                            {formatDateBR(dl.dataLimite)}
                            {days !== null && !dl.concluido
                              ? days < 0
                                ? ` (vencido há ${Math.abs(days)}d)`
                                : ` (em ${days}d)`
                              : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          downloadIcsFile({
                            title: `[Prazo ${dl.tipo}] ${dl.titulo}`,
                            startIso: `${dl.dataLimite}T09:00:00`,
                            description: 'Prazo acompanhado no painel D&M Integra Chile',
                          })
                        }
                        title="Baixar lembrete de calendário (.ics)"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="w-3 h-3" /> .ics
                      </button>
                      {dl.caseId && (
                        <button
                          type="button"
                          onClick={() => onOpenCase(dl.caseId!)}
                          className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Abrir Caso
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={async () => {
                            await deleteDocumentAudited('deadlines', dl.id, role, dl);
                            await onRefresh();
                          }}
                          aria-label="Excluir prazo"
                          className="p-1.5 rounded text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Agendamentos Section */}
      {(tab === 'hoje' || tab === 'agenda') && (
        <section className="bg-[var(--color-surface)] border border-slate-200 card-radius overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Agenda &amp; Reuniões</h2>
            <span className="text-xs text-slate-500 tabular-nums">{sortedAppointments.length} evento(s)</span>
          </div>
          {sortedAppointments.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Calendar className="w-5 h-5" />}
                title="Nenhum agendamento ativo"
                description="Agende conferências documentais, protocolos ou diagnósticos vinculados aos casos."
                actionLabel="Novo Agendamento"
                onAction={() => setCreateType('appointment')}
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {sortedAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900">{apt.titulo}</p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                      <span className="font-medium text-slate-700">{apt.tipo}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {formatDateBR(apt.dataHoraInicio)} {apt.dataHoraInicio.slice(11, 16)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Status: {apt.status}</span>
                      <span aria-hidden="true">·</span>
                      {renderCaseBadge(apt.caseId, apt.clientId)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <select
                      value={apt.status}
                      disabled={busyId === apt.id}
                      onChange={(e) => void updateAppointmentStatus(apt, e.target.value as Appointment['status'])}
                      aria-label={`Status de ${apt.titulo}`}
                      className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px]"
                    >
                      <option value="Agendado">Agendado</option>
                      <option value="Confirmado">Confirmado</option>
                      <option value="Realizado">Realizado</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                    <a
                      href={buildGoogleCalendarUrl({
                        title: apt.titulo,
                        startIso: apt.dataHoraInicio,
                        details: apt.observacoes || `${apt.tipo} — D&M Integra Chile`,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink className="w-3 h-3" /> Google Agenda
                    </a>
                    {apt.caseId && (
                      <button
                        type="button"
                        onClick={() => onOpenCase(apt.caseId!)}
                        className="px-2.5 py-1 rounded border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Abrir Caso
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
