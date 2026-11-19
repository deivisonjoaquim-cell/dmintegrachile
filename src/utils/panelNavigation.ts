import type {
  Appointment,
  Case,
  CaseDocument,
  Client,
  CommunicationLog,
  Deadline,
  FinancialRecord,
  Lead,
  Task,
  UserRole,
} from '../types/domain';
import { calcularUrgencias } from './caseMetrics';
import { countUnreadChatForStaff } from './documentChat';
import { toIsoDate } from './formatters';

/**
 * Nova arquitetura simplificada do Painel da Equipe:
 * Reduz 15 itens fragmentados na barra lateral para 6 hubs orientados ao fluxo real de trabalho.
 */
export type PanelHubId = 'hoje' | 'leads' | 'processos' | 'agenda' | 'financeiro' | 'config';

export type ProcessosSubTab = 'casos' | 'clientes' | 'checklist' | 'dossies';
export type FinanceiroSubTab = 'financeiro' | 'contratos';
export type ConfigSubTab =
  | 'ferramentas'
  | 'legal'
  | 'parceiros'
  | 'admin_site'
  | 'admin_regras'
  | 'admin_gov';

export type LegacyPanelSection =
  | 'dashboard'
  | 'hoje'
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
  | 'ferramentas'
  | 'admin_site'
  | 'admin_regras'
  | 'admin_gov';

export interface PanelHubDefinition {
  id: PanelHubId;
  label: string;
  shortLabel: string;
  description: string;
  roles: UserRole[];
}

export interface PanelSubTabDefinition<T extends string> {
  id: T;
  label: string;
  description: string;
  roles: UserRole[];
}

export const PANEL_HUBS: PanelHubDefinition[] = [
  {
    id: 'hoje',
    label: 'Hoje',
    shortLabel: 'Hoje',
    description: 'Central diária com urgências, tarefas, conferência documental e funil de 5 marcos',
    roles: ['admin', 'consultor', 'assistente'],
  },
  {
    id: 'leads',
    label: 'Leads',
    shortLabel: 'Leads',
    description: 'Triagem comercial, diagnósticos e propostas (Etapas 1 e 2)',
    roles: ['admin', 'consultor', 'assistente'],
  },
  {
    id: 'processos',
    label: 'Processos',
    shortLabel: 'Processos',
    description: 'Funil de casos, clientes, checklists por visto e dossiês (Etapas 3 a 5)',
    roles: ['admin', 'consultor', 'assistente'],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    shortLabel: 'Agenda',
    description: 'Tarefas, prazos legais SERMIG e reuniões',
    roles: ['admin', 'consultor', 'assistente'],
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    shortLabel: 'Financeiro',
    description: 'Orçamentos, lançamentos, contratos e recibos oficiais',
    roles: ['admin', 'consultor'],
  },
  {
    id: 'config',
    label: 'Recursos & Config.',
    shortLabel: 'Config.',
    description: 'Calculadoras, base legal, parceiros e administração do sistema',
    roles: ['admin', 'consultor', 'assistente'],
  },
];

export const PROCESSOS_SUBTABS: PanelSubTabDefinition<ProcessosSubTab>[] = [
  {
    id: 'casos',
    label: 'Funil de Casos',
    description: 'Kanban de 5 marcos e gestão completa de processos',
    roles: ['admin', 'consultor', 'assistente'],
  },
  {
    id: 'clientes',
    label: 'Clientes',
    description: 'Cadastro CRM, dependentes e liberação de portal',
    roles: ['admin', 'consultor', 'assistente'],
  },
  {
    id: 'checklist',
    label: 'Checklist por Visto',
    description: 'Conferência documental por categoria migratória',
    roles: ['admin', 'consultor', 'assistente'],
  },
  {
    id: 'dossies',
    label: 'Dossiês & PDFs',
    description: 'Exportação consolidada e pacotes SERMIG',
    roles: ['admin', 'consultor', 'assistente'],
  },
];

export const FINANCEIRO_SUBTABS: PanelSubTabDefinition<FinanceiroSubTab>[] = [
  {
    id: 'financeiro',
    label: 'Orçamentos & Caixa',
    description: 'Propostas comerciais, parcelas e inadimplência',
    roles: ['admin', 'consultor'],
  },
  {
    id: 'contratos',
    label: 'Contratos & Recibos',
    description: 'Geração de documentos oficiais e PDF A4 multipáginas',
    roles: ['admin', 'consultor'],
  },
];

export const CONFIG_SUBTABS: PanelSubTabDefinition<ConfigSubTab>[] = [
  {
    id: 'ferramentas',
    label: 'Calculadoras',
    description: 'Prazos SERMIG, câmbio BRL/CLP e simulador de custos',
    roles: ['admin', 'consultor', 'assistente'],
  },
  {
    id: 'legal',
    label: 'Base Legal',
    description: 'Normas SERMIG/BCN, vistos e verificação de vigência',
    roles: ['admin', 'consultor'],
  },
  {
    id: 'parceiros',
    label: 'Parceiros',
    description: 'Rede de parceiros e propostas recebidas',
    roles: ['admin', 'consultor'],
  },
  {
    id: 'admin_site',
    label: 'Site & Marca',
    description: 'Identidade visual, logos, cores e textos públicos',
    roles: ['admin'],
  },
  {
    id: 'admin_regras',
    label: 'Regras Diagnóstico',
    description: 'Versões e parâmetros do motor de elegibilidade',
    roles: ['admin'],
  },
  {
    id: 'admin_gov',
    label: 'Equipe & Auditoria',
    description: 'Usuários, dados bancários e trilha de auditoria',
    roles: ['admin'],
  },
];

export function getVisiblePanelHubs(role?: UserRole): PanelHubDefinition[] {
  if (!role) return [];
  return PANEL_HUBS.filter((hub) => hub.roles.includes(role));
}

export function getVisibleProcessosSubTabs(role?: UserRole): PanelSubTabDefinition<ProcessosSubTab>[] {
  if (!role) return [];
  return PROCESSOS_SUBTABS.filter((tab) => tab.roles.includes(role));
}

export function getVisibleFinanceiroSubTabs(role?: UserRole): PanelSubTabDefinition<FinanceiroSubTab>[] {
  if (!role) return [];
  return FINANCEIRO_SUBTABS.filter((tab) => tab.roles.includes(role));
}

export function getVisibleConfigSubTabs(role?: UserRole): PanelSubTabDefinition<ConfigSubTab>[] {
  if (!role) return [];
  return CONFIG_SUBTABS.filter((tab) => tab.roles.includes(role));
}

export interface ResolvedPanelRoute {
  hub: PanelHubId;
  processosTab?: ProcessosSubTab;
  financeiroTab?: FinanceiroSubTab;
  configTab?: ConfigSubTab;
}

/**
 * Converte qualquer seção legada (15 rotas antigas) na rota estruturada dos 6 novos hubs,
 * respeitando estritamente o RBAC do papel autenticado.
 */
export function resolveLegacyPanelRoute(
  legacySection: LegacyPanelSection,
  role?: UserRole,
): ResolvedPanelRoute {
  const canCommercial = role === 'admin' || role === 'consultor';
  const isAdmin = role === 'admin';

  switch (legacySection) {
    case 'dashboard':
    case 'hoje':
      return { hub: 'hoje' };
    case 'leads':
      return { hub: 'leads' };
    case 'agenda':
      return { hub: 'agenda' };
    case 'casos':
      return { hub: 'processos', processosTab: 'casos' };
    case 'clientes':
      return { hub: 'processos', processosTab: 'clientes' };
    case 'checklist':
      return { hub: 'processos', processosTab: 'checklist' };
    case 'documentos':
      return { hub: 'processos', processosTab: 'dossies' };
    case 'financeiro':
      return canCommercial
        ? { hub: 'financeiro', financeiroTab: 'financeiro' }
        : { hub: 'hoje' };
    case 'contratos':
      return canCommercial
        ? { hub: 'financeiro', financeiroTab: 'contratos' }
        : { hub: 'hoje' };
    case 'ferramentas':
      return { hub: 'config', configTab: 'ferramentas' };
    case 'legal':
      return canCommercial
        ? { hub: 'config', configTab: 'legal' }
        : { hub: 'config', configTab: 'ferramentas' };
    case 'parceiros':
      return canCommercial
        ? { hub: 'config', configTab: 'parceiros' }
        : { hub: 'config', configTab: 'ferramentas' };
    case 'admin_site':
      return isAdmin
        ? { hub: 'config', configTab: 'admin_site' }
        : { hub: 'config', configTab: 'ferramentas' };
    case 'admin_regras':
      return isAdmin
        ? { hub: 'config', configTab: 'admin_regras' }
        : { hub: 'config', configTab: 'ferramentas' };
    case 'admin_gov':
      return isAdmin
        ? { hub: 'config', configTab: 'admin_gov' }
        : { hub: 'config', configTab: 'ferramentas' };
    default:
      return { hub: 'hoje' };
  }
}

export interface DailyPrioritySummary {
  criticalUrgenciesCount: number;
  totalUrgenciesCount: number;
  openTasksCount: number;
  docsToReviewCount: number;
  appointmentsTodayCount: number;
  newLeadsCount: number;
  unreadChatsCount: number;
  recommendedAction: {
    label: string;
    detail: string;
    target: LegacyPanelSection;
    tone: 'critical' | 'warning' | 'normal';
  };
}

/**
 * Resume o foco imediato do dia para a equipe saber exatamente por onde começar em segundos.
 */
export function computeDailyPrioritySummary(input: {
  role: UserRole;
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines: Deadline[];
  tasks: Task[];
  appointments: Appointment[];
  financialRecords: FinancialRecord[];
  communicationLogs: CommunicationLog[];
  todayIso?: string;
}): DailyPrioritySummary {
  const todayIso = input.todayIso || toIsoDate(new Date());
  const isAssistente = input.role === 'assistente';

  const urgencias = calcularUrgencias({
    cases: input.cases,
    clients: input.clients,
    docs: input.docs,
    deadlines: input.deadlines,
    financialRecords: isAssistente ? [] : input.financialRecords,
    role: input.role,
  });

  const criticalUrgenciesCount = urgencias.filter((u) => u.severidade === 'Critica').length;
  const openTasksCount = input.tasks.filter((t) => t.status !== 'Concluída').length;
  const docsToReviewCount = input.docs.filter(
    (d) => d.status === 'Enviado' || d.status === 'Em análise',
  ).length;
  const appointmentsTodayCount = input.appointments.filter(
    (a) => a.status !== 'Cancelado' && (a.dataHoraInicio || '').startsWith(todayIso),
  ).length;
  const newLeadsCount = input.leads.filter((l) => l.statusFunil === 'Novo').length;
  const unreadChatsCount = countUnreadChatForStaff(input.communicationLogs);

  let recommendedAction: DailyPrioritySummary['recommendedAction'];
  if (criticalUrgenciesCount > 0) {
    recommendedAction = {
      label: `Resolver ${criticalUrgenciesCount} urgência(s) crítica(s)`,
      detail: 'Existem prazos legais ou vencimentos críticos exigindo ação imediata.',
      target: 'hoje',
      tone: 'critical',
    };
  } else if (unreadChatsCount > 0) {
    recommendedAction = {
      label: `Responder ${unreadChatsCount} dúvida(s) no Portal`,
      detail: 'Clientes enviaram perguntas sobre documentos aguardando retorno.',
      target: 'hoje',
      tone: 'warning',
    };
  } else if (docsToReviewCount > 0) {
    recommendedAction = {
      label: `Conferir ${docsToReviewCount} documento(s) enviado(s)`,
      detail: 'Aprovar ou solicitar ajuste para destravar o protocolo SERMIG.',
      target: 'checklist',
      tone: 'warning',
    };
  } else if (newLeadsCount > 0) {
    recommendedAction = {
      label: `Atender ${newLeadsCount} novo(s) lead(s)`,
      detail: 'Solicitantes recém-chegados aguardando primeiro contato comercial.',
      target: 'leads',
      tone: 'normal',
    };
  } else if (openTasksCount > 0) {
    recommendedAction = {
      label: `Avançar nas ${openTasksCount} tarefa(s) em aberto`,
      detail: 'Operação em dia — acompanhe a lista priorizada na Agenda.',
      target: 'agenda',
      tone: 'normal',
    };
  } else {
    recommendedAction = {
      label: 'Operação em dia',
      detail: 'Nenhuma pendência crítica agora. Revise o funil de processos ativos.',
      target: 'casos',
      tone: 'normal',
    };
  }

  return {
    criticalUrgenciesCount,
    totalUrgenciesCount: urgencias.length,
    openTasksCount,
    docsToReviewCount,
    appointmentsTodayCount,
    newLeadsCount,
    unreadChatsCount,
    recommendedAction,
  };
}
