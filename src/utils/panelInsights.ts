import type {
  Case,
  CaseDocument,
  Client,
  Deadline,
  Lead,
  LegalSource,
  Task,
  UserRole,
} from '../types/domain';
import type { calcularUrgencias } from './caseMetrics';
import { daysUntilDate, formatCurrency, formatDateBR } from './formatters';
import type { OperationalWorkflowStage, PanelHubDefinition } from './panelNavigation';

export type PanelUrgencyItem = ReturnType<typeof calcularUrgencias>[number];

export function normalizeSearchText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function extractFirstName(fullName?: string): string {
  const cleaned = (fullName || '').trim();
  if (!cleaned) return '';
  return cleaned.split(/\s+/)[0] || '';
}

export function getExecutiveGreeting(hour: number, fullName?: string): string {
  const normalizedHour = ((Math.floor(hour) % 24) + 24) % 24;
  const base =
    normalizedHour >= 5 && normalizedHour < 12
      ? 'Bom dia'
      : normalizedHour >= 12 && normalizedHour < 18
        ? 'Boa tarde'
        : 'Boa noite';
  const firstName = extractFirstName(fullName);
  return firstName ? `${base}, ${firstName}` : base;
}

const WEEKDAYS_PT = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
];

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

export function formatExecutiveDateBR(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  const weekday = WEEKDAYS_PT[date.getDay()] || '';
  const day = date.getDate();
  const month = MONTHS_PT[date.getMonth()] || '';
  return `${weekday}, ${day} de ${month}`;
}

export function formatSyncTimeBR(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '—';
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export type OperationalHealthStatus = 'saudavel' | 'atencao' | 'critico';

export interface OperationalHealthSnapshot {
  status: OperationalHealthStatus;
  label: string;
  slaCompliancePct: number;
  overdueDeadlinesCount: number;
  openDeadlinesCount: number;
  avgDocsPct: number;
  pendingSignaturesCount: number;
  criticalUrgenciesCount: number;
  summaryLine: string;
}

export function computeOperationalHealth(input: {
  deadlines: Deadline[];
  avgDocsPct: number;
  criticalUrgenciesCount: number;
  pendingSignaturesCount: number;
  pendingDocsCount: number;
  referenceDate?: Date;
}): OperationalHealthSnapshot {
  const openDeadlines = input.deadlines.filter((d) => !d.concluido);
  let overdueDeadlinesCount = 0;
  for (const dl of openDeadlines) {
    const diff = daysUntilDate(dl.dataLimite);
    if (diff !== null && diff < 0) {
      overdueDeadlinesCount += 1;
    }
  }

  const slaCompliancePct =
    openDeadlines.length === 0
      ? 100
      : Math.max(0, Math.round(((openDeadlines.length - overdueDeadlinesCount) / openDeadlines.length) * 100));

  let status: OperationalHealthStatus = 'saudavel';
  let label = 'Operação em dia';

  if (input.criticalUrgenciesCount > 0 || overdueDeadlinesCount > 0) {
    status = 'critico';
    label = 'Prioridade crítica';
  } else if (
    input.pendingDocsCount > 0 ||
    input.pendingSignaturesCount > 0 ||
    (input.avgDocsPct > 0 && input.avgDocsPct < 70)
  ) {
    status = 'atencao';
    label = 'Atenção operacional';
  }

  const parts: string[] = [`Prazos no SLA: ${slaCompliancePct}%`];
  if (overdueDeadlinesCount > 0) {
    parts.push(`${overdueDeadlinesCount} prazo(s) vencido(s)`);
  }
  if (input.pendingSignaturesCount > 0) {
    parts.push(`${input.pendingSignaturesCount} assinatura(s) pendente(s)`);
  }
  if (input.pendingDocsCount > 0) {
    parts.push(`${input.pendingDocsCount} doc(s) p/ conferir`);
  }

  return {
    status,
    label,
    slaCompliancePct,
    overdueDeadlinesCount,
    openDeadlinesCount: openDeadlines.length,
    avgDocsPct: input.avgDocsPct,
    pendingSignaturesCount: input.pendingSignaturesCount,
    criticalUrgenciesCount: input.criticalUrgenciesCount,
    summaryLine: parts.join(' · '),
  };
}

export function filterUrgenciesByQuery(urgencias: PanelUrgencyItem[], query: string): PanelUrgencyItem[] {
  const q = normalizeSearchText(query);
  if (!q) return urgencias;
  return urgencias.filter((u) => {
    const haystack = normalizeSearchText(
      `${u.titulo} ${u.clientNome || ''} ${u.detalhe} ${u.categoria} ${u.severidade}`,
    );
    return haystack.includes(q);
  });
}

export function filterTasksByQuery(tasks: Task[], query: string): Task[] {
  const q = normalizeSearchText(query);
  if (!q) return tasks;
  return tasks.filter((t) => {
    const haystack = normalizeSearchText(`${t.titulo} ${t.prioridade} ${t.status} ${t.descricao || ''}`);
    return haystack.includes(q);
  });
}

export function filterPendingDocsByQuery(docs: CaseDocument[], query: string): CaseDocument[] {
  const q = normalizeSearchText(query);
  if (!q) return docs;
  return docs.filter((d) => {
    const haystack = normalizeSearchText(`${d.nomeDocumento} ${d.pessoa} ${d.status} ${d.observacoes || ''}`);
    return haystack.includes(q);
  });
}

export interface DailyBriefingInput {
  brandName: string;
  dateLabel: string;
  role: UserRole;
  activeCasesCount: number;
  activeClientsCount: number;
  avgDocsPct: number;
  urgencias: PanelUrgencyItem[];
  openTasksCount: number;
  pendingDocsCount: number;
  unreadChatCount: number;
  pendingSignaturesCount: number;
  receitaBrl?: number;
  inadimplenciaBrl?: number;
  health: OperationalHealthSnapshot;
}

export function buildDailyExecutiveBriefingText(input: DailyBriefingInput): string {
  const lines: string[] = [
    `${input.brandName} — Resumo Operacional (${input.dateLabel})`,
    `Status: ${input.health.label} · ${input.health.summaryLine}`,
    '',
    `• Processos ativos: ${input.activeCasesCount} (${input.activeClientsCount} clientes · Docs ${input.avgDocsPct}%)`,
    `• Urgências: ${input.urgencias.length} (${input.health.criticalUrgenciesCount} crítica(s)) · Tarefas em aberto: ${input.openTasksCount}`,
    `• Documentos p/ conferir: ${input.pendingDocsCount} · Dúvidas no Portal: ${input.unreadChatCount}`,
  ];

  if (input.role !== 'assistente') {
    lines.push(`• Contratos pendentes de assinatura: ${input.pendingSignaturesCount}`);
    if (typeof input.receitaBrl === 'number' && typeof input.inadimplenciaBrl === 'number') {
      lines.push(
        `• Financeiro (BRL): Recebido ${formatCurrency(input.receitaBrl, 'BRL')} · Em atraso ${formatCurrency(input.inadimplenciaBrl, 'BRL')}`,
      );
    }
  }

  if (input.urgencias.length > 0) {
    lines.push('', 'Principais prioridades:');
    for (const u of input.urgencias.slice(0, 5)) {
      const clientPrefix = u.clientNome ? `${u.clientNome} — ` : '';
      lines.push(`- [${u.severidade}] ${clientPrefix}${u.titulo} (${u.dataReferenciaBR})`);
    }
  } else {
    lines.push('', 'Sem urgências críticas registradas no momento.');
  }

  return lines.join('\n');
}

function escapeCsvCell(value: string): string {
  const text = String(value ?? '').replace(/\r?\n/g, ' ');
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildDailyUrgenciesCsv(urgencias: PanelUrgencyItem[], tasks: Task[]): string {
  const header = ['Tipo', 'Severidade/Prioridade', 'Título', 'Cliente / Detalhe', 'Data Referência'];
  const rows: string[][] = [header];

  for (const u of urgencias) {
    rows.push([
      `Urgência (${u.categoria})`,
      u.severidade,
      u.titulo,
      u.clientNome ? `${u.clientNome} — ${u.detalhe}` : u.detalhe,
      u.dataReferenciaBR,
    ]);
  }

  for (const t of tasks.filter((item) => item.status !== 'Concluída')) {
    rows.push([
      'Tarefa',
      t.prioridade,
      t.titulo,
      t.descricao || t.status,
      t.prazo ? formatDateBR(t.prazo) : 'Sem prazo',
    ]);
  }

  return `\uFEFF${rows.map((cols) => cols.map(escapeCsvCell).join(';')).join('\n')}`;
}

export type CommandItemCategory =
  | 'Ação Rápida'
  | 'Navegação'
  | 'Processo'
  | 'Cliente'
  | 'Lead'
  | 'Tarefa'
  | 'Documento'
  | 'Base Legal'
  | 'Ferramenta';

export type CommandItemAction =
  | { type: 'hub'; hubId: PanelHubDefinition['id'] }
  | { type: 'stage'; stage: OperationalWorkflowStage }
  | { type: 'quick_create'; action: 'new_case' | 'new_client' | 'agenda' | 'contratos' | 'financeiro' }
  | { type: 'legacy'; section: 'assinaturas' | 'ferramentas' | 'legal' | 'clientes' | 'parceiros' | 'checklist' }
  | { type: 'case'; caseId: string }
  | { type: 'toggle_theme' }
  | { type: 'refresh' };

export interface CommandPaletteItem {
  id: string;
  category: CommandItemCategory;
  title: string;
  subtitle: string;
  keywords: string;
  action: CommandItemAction;
}

export interface BuildCommandPaletteInput {
  query: string;
  role: UserRole | undefined;
  isDark: boolean;
  visibleHubs: PanelHubDefinition[];
  visibleStages: OperationalWorkflowStage[];
  cases: Case[];
  clients: Client[];
  leads: Lead[];
  tasks: Task[];
  docs: CaseDocument[];
  legalSources: LegalSource[];
  maxResults?: number;
}

export function buildCommandPaletteItems(input: BuildCommandPaletteInput): CommandPaletteItem[] {
  const maxResults = input.maxResults ?? 14;
  const q = normalizeSearchText(input.query);
  const canManageBusiness = input.role === 'admin' || input.role === 'consultor';

  const quickActions: CommandPaletteItem[] = [
    {
      id: 'qa_new_case',
      category: 'Ação Rápida',
      title: 'Novo Processo Migratório',
      subtitle: 'Criar caso de Visto SERMIG e RUT',
      keywords: 'novo processo caso visto sermig criar',
      action: { type: 'quick_create', action: 'new_case' },
    },
    ...(canManageBusiness
      ? [
          {
            id: 'qa_new_client',
            category: 'Ação Rápida' as const,
            title: 'Novo Cliente no CRM',
            subtitle: 'Cadastrar titular e liberar acesso ao Portal',
            keywords: 'novo cliente crm cadastro portal criar',
            action: { type: 'quick_create' as const, action: 'new_client' as const },
          },
          {
            id: 'qa_signatures',
            category: 'Ação Rápida' as const,
            title: 'Status de Assinaturas de Contratos',
            subtitle: 'Conferir contratos assinados e pendentes dos clientes',
            keywords: 'assinatura contrato pendente assinado status',
            action: { type: 'legacy' as const, section: 'assinaturas' as const },
          },
          {
            id: 'qa_partners',
            category: 'Ação Rápida' as const,
            title: 'Rede de Parceiros Curados',
            subtitle: 'Gerenciar indicações de parceiros confiáveis',
            keywords: 'parceiro parceiros indicacao imobiliaria rede',
            action: { type: 'legacy' as const, section: 'parceiros' as const },
          },
        ]
      : []),
    {
      id: 'qa_checklist',
      category: 'Ação Rápida',
      title: 'Conferir Checklist de Documentos',
      subtitle: 'Abrir triagem e validades documentais por visto',
      keywords: 'checklist documento conferir triagem apostila',
      action: { type: 'legacy', section: 'checklist' },
    },
    {
      id: 'qa_refresh',
      category: 'Ação Rápida',
      title: 'Sincronizar Dados do Painel',
      subtitle: 'Atualizar processos, clientes, leads e mensagens agora',
      keywords: 'sincronizar atualizar refresh recarregar dados',
      action: { type: 'refresh' },
    },
    {
      id: 'qa_theme',
      category: 'Ação Rápida',
      title: input.isDark ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro',
      subtitle: 'Trocar aparência visual do painel da consultoria',
      keywords: 'tema escuro claro dark light aparencia',
      action: { type: 'toggle_theme' },
    },
  ];

  const navItems: CommandPaletteItem[] = [
    ...input.visibleHubs.map((hub) => ({
      id: `nav_hub_${hub.id}`,
      category: 'Navegação' as const,
      title: hub.label,
      subtitle: hub.description,
      keywords: `${hub.label} ${hub.shortLabel} ${hub.description}`,
      action: { type: 'hub' as const, hubId: hub.id },
    })),
    ...input.visibleStages.map((stage) => ({
      id: `nav_stage_${stage.id}`,
      category: 'Navegação' as const,
      title: `Etapa 0${stage.stepNumber} · ${stage.label}`,
      subtitle: stage.description,
      keywords: `etapa ${stage.stepNumber} ${stage.label} ${stage.shortLabel} ${stage.description}`,
      action: { type: 'stage' as const, stage },
    })),
  ];

  // Quando o campo está vazio, exibe Ações Rápidas + Principais Hubs imediatamente
  if (!q) {
    return [...quickActions.slice(0, 5), ...navItems.slice(0, 6)].slice(0, maxResults);
  }

  const results: CommandPaletteItem[] = [];

  for (const item of [...quickActions, ...navItems]) {
    if (normalizeSearchText(`${item.title} ${item.subtitle} ${item.keywords}`).includes(q)) {
      results.push(item);
    }
  }

  if (q.includes('calc') || q.includes('cambi') || q.includes('simula')) {
    results.push({
      id: 'tool_ferramentas',
      category: 'Ferramenta',
      title: 'Calculadoras de Prazos, Câmbio BRL/CLP & Simulador',
      subtitle: 'Abrir em Recursos & Configurações',
      keywords: 'calculadora cambio simulador prazos',
      action: { type: 'legacy', section: 'ferramentas' },
    });
  }

  for (const c of input.cases) {
    if (normalizeSearchText(`${c.titulo} ${c.numeroPedidoSermig || ''} ${c.etapaPipeline}`).includes(q)) {
      results.push({
        id: `case_${c.id}`,
        category: 'Processo',
        title: c.titulo,
        subtitle: `Etapa ${c.etapaPipeline} · SERMIG ${c.statusSermig}`,
        keywords: c.titulo,
        action: { type: 'case', caseId: c.id },
      });
    }
  }

  for (const cli of input.clients) {
    if (normalizeSearchText(`${cli.nomeCompleto} ${cli.cpf || ''} ${cli.email} ${cli.whatsapp || ''}`).includes(q)) {
      const linkedCase = input.cases.find((c) => c.clientId === cli.id);
      results.push({
        id: `cli_${cli.id}`,
        category: 'Cliente',
        title: cli.nomeCompleto,
        subtitle: `${cli.email}${cli.whatsapp ? ` · ${cli.whatsapp}` : ''}`,
        keywords: cli.nomeCompleto,
        action: linkedCase ? { type: 'case', caseId: linkedCase.id } : { type: 'legacy', section: 'clientes' },
      });
    }
  }

  for (const l of input.leads) {
    if (normalizeSearchText(`${l.nome} ${l.email} ${l.subcategoriaSugerida || ''} ${l.interesse || ''}`).includes(q)) {
      results.push({
        id: `lead_${l.id}`,
        category: 'Lead',
        title: l.nome,
        subtitle: `${l.statusFunil} · ${l.subcategoriaSugerida || l.interesse}`,
        keywords: l.nome,
        action: { type: 'hub', hubId: 'leads' },
      });
    }
  }

  for (const t of input.tasks) {
    if (normalizeSearchText(`${t.titulo} ${t.prioridade} ${t.status}`).includes(q)) {
      results.push({
        id: `task_${t.id}`,
        category: 'Tarefa',
        title: t.titulo,
        subtitle: `${t.status} · ${t.prioridade}${t.prazo ? ` · Até ${formatDateBR(t.prazo)}` : ''}`,
        keywords: t.titulo,
        action: t.caseId ? { type: 'case', caseId: t.caseId } : { type: 'hub', hubId: 'agenda' },
      });
    }
  }

  for (const d of input.docs) {
    if (normalizeSearchText(`${d.nomeDocumento} ${d.pessoa} ${d.status}`).includes(q)) {
      results.push({
        id: `doc_${d.id}`,
        category: 'Documento',
        title: d.nomeDocumento,
        subtitle: `${d.pessoa} · ${d.status}`,
        keywords: d.nomeDocumento,
        action: { type: 'case', caseId: d.caseId },
      });
    }
  }

  if (canManageBusiness) {
    for (const s of input.legalSources) {
      if (normalizeSearchText(`${s.titulo} ${s.numeroAno} ${s.pais}`).includes(q)) {
        results.push({
          id: `leg_${s.id}`,
          category: 'Base Legal',
          title: s.titulo,
          subtitle: `${s.pais} · ${s.tipo} · ${s.statusVigencia}`,
          keywords: s.titulo,
          action: { type: 'legacy', section: 'legal' },
        });
      }
    }
  }

  // Deduplicate by id preserving order
  const seen = new Set<string>();
  const unique: CommandPaletteItem[] = [];
  for (const item of results) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }

  return unique.slice(0, maxResults);
}
