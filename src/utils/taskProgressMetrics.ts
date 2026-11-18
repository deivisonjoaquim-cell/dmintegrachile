import type { Case, Client, Task } from '../types/domain';

export interface ClientTaskProgressRow {
  id: string;
  label: string;
  clientName: string;
  caseTitle?: string;
  etapaPipeline?: number;
  statusSermig?: Case['statusSermig'];
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  concluidoPct: number;
  emAndamentoPct: number;
  pendentePct: number;
}

export interface TaskProgressOverview {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  concluidoPct: number;
  emAndamentoPct: number;
  pendentePct: number;
  activeLabel: string;
  stageSummary: string;
  rows: ClientTaskProgressRow[];
}

function toPercentages(completed: number, inProgress: number, total: number) {
  if (total <= 0) {
    return { concluidoPct: 0, emAndamentoPct: 0, pendentePct: 100 };
  }
  const concluidoPct = Math.round((completed / total) * 100);
  const rawInProgress = Math.round((inProgress / total) * 100);
  const emAndamentoPct = Math.min(100 - concluidoPct, rawInProgress);
  const pendentePct = Math.max(0, 100 - concluidoPct - emAndamentoPct);
  return { concluidoPct, emAndamentoPct, pendentePct };
}

export function computeClientTaskProgress(params: {
  tasks: Task[];
  cases: Case[];
  clients: Client[];
  selectedClientId?: string | null;
  selectedCaseId?: string | null;
}): TaskProgressOverview {
  const { tasks, cases, clients, selectedClientId, selectedCaseId } = params;

  const activeClients = clients.filter((c) => !c.arquivado);
  const activeCases = cases.filter((c) => !c.arquivado);
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const caseMap = new Map(cases.map((c) => [c.id, c]));

  const resolveTaskClientId = (t: Task): string | undefined => {
    if (t.clientId) return t.clientId;
    if (t.caseId) return caseMap.get(t.caseId)?.clientId;
    return undefined;
  };

  let filteredTasks = tasks;
  let activeLabel = 'Todos os clientes ativos';
  let stageSummary = `${activeCases.length} caso(s) em andamento`;

  if (selectedCaseId) {
    const targetCase = caseMap.get(selectedCaseId);
    const targetClient = targetCase ? clientMap.get(targetCase.clientId) : undefined;
    filteredTasks = tasks.filter(
      (t) => t.caseId === selectedCaseId || (targetCase && !t.caseId && t.clientId === targetCase.clientId),
    );
    activeLabel = targetClient
      ? `${targetClient.nomeCompleto} — ${targetCase?.titulo || ''}`
      : targetCase?.titulo || 'Processo selecionado';
    if (targetCase) {
      stageSummary = `Etapa ${targetCase.etapaPipeline}/15 · SERMIG: ${targetCase.statusSermig}`;
    }
  } else if (selectedClientId) {
    const targetClient = clientMap.get(selectedClientId);
    const clientCases = activeCases.filter((c) => c.clientId === selectedClientId);
    const primaryCase = clientCases[0];
    filteredTasks = tasks.filter((t) => resolveTaskClientId(t) === selectedClientId);
    activeLabel = targetClient?.nomeCompleto || 'Cliente selecionado';
    if (primaryCase) {
      stageSummary = `Etapa ${primaryCase.etapaPipeline}/15 · SERMIG: ${primaryCase.statusSermig}`;
    } else {
      stageSummary = 'Sem caso ativo vinculado';
    }
  }

  const totalTasks = filteredTasks.length;
  const completedTasks = filteredTasks.filter((t) => t.status === 'Concluída').length;
  const inProgressTasks = filteredTasks.filter((t) => t.status === 'Em andamento').length;
  const pendingTasks = Math.max(0, totalTasks - completedTasks - inProgressTasks);
  const pct = toPercentages(completedTasks, inProgressTasks, totalTasks);

  // Breakdown por cliente para visualização comparativa no Recharts
  const rows: ClientTaskProgressRow[] = [];
  const candidateClients = selectedClientId
    ? activeClients.filter((c) => c.id === selectedClientId)
    : selectedCaseId
      ? activeClients.filter((c) => c.id === caseMap.get(selectedCaseId)?.clientId)
      : activeClients;

  for (const cli of candidateClients) {
    const cliCases = activeCases.filter((c) => c.clientId === cli.id);
    const primaryCase = selectedCaseId ? caseMap.get(selectedCaseId) || cliCases[0] : cliCases[0];
    const cliTasks = selectedCaseId
      ? filteredTasks
      : tasks.filter((t) => resolveTaskClientId(t) === cli.id);

    if (cliTasks.length === 0 && !selectedClientId && !selectedCaseId) continue;

    const cTotal = cliTasks.length;
    const cDone = cliTasks.filter((t) => t.status === 'Concluída').length;
    const cProg = cliTasks.filter((t) => t.status === 'Em andamento').length;
    const cPend = Math.max(0, cTotal - cDone - cProg);
    const cPct = toPercentages(cDone, cProg, cTotal);

    rows.push({
      id: cli.id,
      label: cli.nomeCompleto.split(' ').slice(0, 2).join(' '),
      clientName: cli.nomeCompleto,
      caseTitle: primaryCase?.titulo,
      etapaPipeline: primaryCase?.etapaPipeline,
      statusSermig: primaryCase?.statusSermig,
      totalTasks: cTotal,
      completedTasks: cDone,
      inProgressTasks: cProg,
      pendingTasks: cPend,
      ...cPct,
    });
  }

  if (rows.length === 0 && totalTasks > 0) {
    rows.push({
      id: 'geral',
      label: selectedCaseId || selectedClientId ? activeLabel : 'Operação Geral',
      clientName: activeLabel,
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      ...pct,
    });
  }

  rows.sort((a, b) => b.concluidoPct - a.concluidoPct || b.totalTasks - a.totalTasks);

  return {
    totalTasks,
    completedTasks,
    inProgressTasks,
    pendingTasks,
    concluidoPct: totalTasks > 0 ? pct.concluidoPct : 0,
    emAndamentoPct: totalTasks > 0 ? pct.emAndamentoPct : 0,
    pendentePct: totalTasks > 0 ? pct.pendentePct : 0,
    activeLabel,
    stageSummary,
    rows,
  };
}
