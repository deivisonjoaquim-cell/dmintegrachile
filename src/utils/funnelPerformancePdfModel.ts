import type { Case, Client, EmpresaConfig, Lead, UserProfile } from '../types/domain';
import { formatDateBR, formatDateTimeBR, toIsoDate } from './formatters';
import {
  MACRO_FUNNEL_STAGES,
  getMacroStageForCase,
  getMacroStageForLead,
  type MacroFunnelStage,
  type MacroFunnelStageId,
} from './funnelModel';
import {
  computeFunnelPerformanceSummary,
  matchesCreatedDateRange,
  type FunnelPerformancePeriod,
  type FunnelPerformanceSummary,
} from './funnelPerformanceModel';
import { safeHexColor } from './visualProgressPdf';

export interface FunnelPdfMonthOption {
  value: string; // 'current' ou 'YYYY-MM'
  label: string;
}

export interface FunnelPdfStageRow {
  stage: MacroFunnelStage;
  leadsCount: number;
  casesCount: number;
  totalCount: number;
  sharePct: number;
}

export interface FunnelPdfChannelRow {
  origem: string;
  totalLeads: number;
  convertedCount: number;
  lostCount: number;
  conversionPct: number;
}

export interface FunnelPdfAssigneeRow {
  assigneeName: string;
  leadsCount: number;
  casesCount: number;
  totalCount: number;
}

export interface FunnelPdfBottleneckClientRow {
  id: string;
  name: string;
  kindLabel: 'Lead' | 'Processo';
  stageName: string;
  priority: string;
  assigneeName: string;
  createdAtLabel: string;
  detail: string;
}

export interface FunnelPdfPagePlan {
  pageNumber: number;
  totalPages: number;
  isFirstPage: boolean;
  showBreakdowns: boolean;
  showRetainedHeader: boolean;
  retainedRows: FunnelPdfBottleneckClientRow[];
  showRecommendations: boolean;
}

export interface FunnelPerformancePdfModel {
  filename: string;
  primaryColor: string;
  accentColor: string;
  brandName: string;
  brandSub: string;
  contactLine: string;
  generatedAt: string;
  periodLabel: string;
  periodTag: string;
  summary: FunnelPerformanceSummary;
  stageRows: FunnelPdfStageRow[];
  channelRows: FunnelPdfChannelRow[];
  assigneeRows: FunnelPdfAssigneeRow[];
  bottleneckStageName: string | null;
  retainedTotalCount: number;
  recommendations: string[];
  pages: FunnelPdfPagePlan[];
}

export interface FunnelPerformancePdfInput {
  empresa: EmpresaConfig;
  leads: Lead[];
  cases: Case[];
  clients?: Client[];
  staffUsers?: UserProfile[];
  /** Se 'YYYY-MM' for passado, gera o relatório mensal daquele mês calendário */
  monthKey?: string | null;
  period?: FunnelPerformancePeriod;
  fromDate?: string;
  toDate?: string;
  now?: Date;
}

const MONTH_NAMES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MONTH_SHORT_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

/**
 * Gera lista dos últimos N meses calendário (incluindo o mês atual) para exportação mensal.
 */
export function buildRecentMonthOptions(now = new Date(), count = 6): FunnelPdfMonthOption[] {
  const options: FunnelPdfMonthOption[] = [];
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth(); // 0..11

  for (let i = 0; i < count; i += 1) {
    const d = new Date(Date.UTC(baseYear, baseMonth - i, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    options.push({
      value: key,
      label: `${MONTH_SHORT_PT[m]}/${y}`,
    });
  }
  return options;
}

export function resolveMonthBounds(monthKey: string): {
  fromDate: string;
  toDate: string;
  label: string;
  fileSlug: string;
} | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;

  const lastDay = new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  const mm = String(monthIdx + 1).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');

  return {
    fromDate: `${year}-${mm}-01`,
    toDate: `${year}-${mm}-${dd}`,
    label: `Relatório Mensal · ${MONTH_NAMES_PT[monthIdx]} de ${year}`,
    fileSlug: `${year}-${mm}`,
  };
}

function buildRecommendations(summary: FunnelPerformanceSummary): string[] {
  if (summary.totalAnalyzed === 0) {
    return [
      'Sem registros no período selecionado. Amplie a janela de análise ou revise a captura de novos diagnósticos.',
    ];
  }

  const recs: string[] = [];
  const b = summary.primaryBottleneck;

  if (b) {
    switch (b.fromStage.id) {
      case 'diagnostico':
        recs.push(
          `Gargalo em Diagnóstico → Proposta (${b.conversionPct}% de avanço; ${b.droppedCount} retido(s)/perdido(s)): padronizar retorno comercial em até 24h após o diagnóstico e reforçar qualificação inicial.`,
        );
        break;
      case 'proposta':
        recs.push(
          `Gargalo em Proposta → Documentação (${b.conversionPct}% de avanço; ${b.droppedCount} proposta(s) sem fechamento): estruturar cadência de follow-up (D+2, D+5, D+10) com apresentação clara de prazos e garantias contratuais.`,
        );
        break;
      case 'documentacao':
        recs.push(
          `Gargalo em Documentação → Trâmite (${b.conversionPct}% de avanço; ${b.droppedCount} dossiê(s) em preparação): priorizar conferência de certidões, apostilamento CNJ e destravamento de itens reprovados para atingir o mínimo de protocolo.`,
        );
        break;
      case 'tramite':
        recs.push(
          `Gargalo em Trâmite → Finalização (${b.conversionPct}% de avanço; ${b.droppedCount} caso(s) em trâmite): monitorar semanalmente requerimentos SERMIG e preparar antecipadamente o roteiro de Estampado Electrónico e Cédula.`,
        );
        break;
      default:
        break;
    }
  } else {
    recs.push(
      'Fluxo equilibrado no período analisado, sem gargalo crítico de retenção entre etapas consecutivas.',
    );
  }

  if (summary.lostLeadsCount > 0) {
    const lossPct = Math.round((summary.lostLeadsCount / summary.totalAnalyzed) * 100);
    recs.push(
      `Perdas comerciais representam ${lossPct}% da base analisada (${summary.lostLeadsCount} lead(s) perdido(s)). Recomenda-se revisar os motivos de perda por canal de origem.`,
    );
  }

  if (summary.overallCommercialConversionPct < 40 && summary.totalAnalyzed >= 3) {
    recs.push(
      `Conversão comercial geral em ${summary.overallCommercialConversionPct}%: avaliar segmentação de tráfego e clareza dos requisitos de elegibilidade antes da proposta.`,
    );
  } else if (summary.overallCommercialConversionPct >= 60) {
    recs.push(
      `Conversão comercial sólida (${summary.overallCommercialConversionPct}%): manter capacidade operacional da equipe de documentação e acompanhamento SERMIG para absorver o volume.`,
    );
  }

  return recs.slice(0, 4);
}

/**
 * Monta o modelo paginado completo para o Relatório Gerencial em PDF do Resumo de Desempenho do Funil.
 */
export function buildFunnelPerformancePdfModel(
  input: FunnelPerformancePdfInput,
): FunnelPerformancePdfModel {
  const now = input.now || new Date();
  const monthBounds =
    input.monthKey && input.monthKey !== 'current'
      ? resolveMonthBounds(input.monthKey)
      : null;

  const effectivePeriod: FunnelPerformancePeriod = monthBounds
    ? 'custom'
    : input.period || 'all';
  const effectiveFrom = monthBounds ? monthBounds.fromDate : input.fromDate;
  const effectiveTo = monthBounds ? monthBounds.toDate : input.toDate;

  let periodLabel = 'Histórico Completo';
  let periodTag = 'todos';

  if (monthBounds) {
    periodLabel = monthBounds.label;
    periodTag = monthBounds.fileSlug;
  } else if (effectivePeriod === '7d') {
    periodLabel = 'Últimos 7 dias';
    periodTag = 'ultimos-7d';
  } else if (effectivePeriod === '30d') {
    periodLabel = 'Últimos 30 dias';
    periodTag = 'ultimos-30d';
  } else if (effectivePeriod === '90d') {
    periodLabel = 'Últimos 90 dias';
    periodTag = 'ultimos-90d';
  } else if (effectivePeriod === 'custom') {
    const f = effectiveFrom ? formatDateBR(effectiveFrom) : 'Início';
    const t = effectiveTo ? formatDateBR(effectiveTo) : 'Hoje';
    periodLabel = `Período Personalizado · ${f} a ${t}`;
    periodTag = `${effectiveFrom || 'inicio'}_${effectiveTo || toIsoDate(now)}`;
  }

  const summary = computeFunnelPerformanceSummary({
    leads: input.leads,
    cases: input.cases,
    period: effectivePeriod,
    fromDate: effectiveFrom,
    toDate: effectiveTo,
    now,
  });

  const dateFilter = {
    period: effectivePeriod,
    fromDate: effectiveFrom,
    toDate: effectiveTo,
    now,
  };

  const filteredLeads = input.leads.filter((l) => matchesCreatedDateRange(l.createdAt, dateFilter));
  const activeCases = input.cases.filter(
    (c) => !c.arquivado && matchesCreatedDateRange(c.createdAt, dateFilter),
  );

  const clientNameById = new Map((input.clients || []).map((c) => [c.id, c.nomeCompleto]));
  const staffNameById = new Map(
    (input.staffUsers || []).map((u) => [u.uid, u.nome || u.email || u.uid]),
  );

  // Distribuição por 5 marcos
  const stageLeads: Record<MacroFunnelStageId, number> = {
    diagnostico: 0,
    proposta: 0,
    documentacao: 0,
    tramite: 0,
    finalizacao: 0,
  };
  const stageCases: Record<MacroFunnelStageId, number> = {
    diagnostico: 0,
    proposta: 0,
    documentacao: 0,
    tramite: 0,
    finalizacao: 0,
  };

  for (const l of filteredLeads) {
    const st = getMacroStageForLead(l);
    if (st) stageLeads[st.id] += 1;
  }
  for (const c of activeCases) {
    const st = getMacroStageForCase(c);
    stageCases[st.id] += 1;
  }

  const activeTotal = summary.activeLeadsCount + summary.activeCasesCount;
  const stageRows: FunnelPdfStageRow[] = MACRO_FUNNEL_STAGES.map((stage) => {
    const lc = stageLeads[stage.id];
    const cc = stageCases[stage.id];
    const total = lc + cc;
    return {
      stage,
      leadsCount: lc,
      casesCount: cc,
      totalCount: total,
      sharePct: activeTotal > 0 ? Math.round((total / activeTotal) * 100) : 0,
    };
  });

  // Desempenho por canal de origem (leads do período)
  const channelMap = new Map<string, { total: number; converted: number; lost: number }>();
  for (const l of filteredLeads) {
    const key = l.origem || 'Outro';
    const cur = channelMap.get(key) || { total: 0, converted: 0, lost: 0 };
    cur.total += 1;
    if (l.statusFunil === 'Fechado' || Boolean(l.convertedCaseId)) {
      cur.converted += 1;
    } else if (l.statusFunil === 'Perdido') {
      cur.lost += 1;
    }
    channelMap.set(key, cur);
  }
  const channelRows: FunnelPdfChannelRow[] = Array.from(channelMap.entries())
    .map(([origem, stats]) => ({
      origem,
      totalLeads: stats.total,
      convertedCount: stats.converted,
      lostCount: stats.lost,
      conversionPct: stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.totalLeads - a.totalLeads);

  // Distribuição por responsável pela consultoria
  const assigneeMap = new Map<string, { leadsCount: number; casesCount: number }>();
  for (const l of filteredLeads) {
    if (!getMacroStageForLead(l)) continue;
    const name = l.responsavelId
      ? staffNameById.get(l.responsavelId) || `Consultor (${l.responsavelId.slice(0, 8)})`
      : 'Sem responsável';
    const cur = assigneeMap.get(name) || { leadsCount: 0, casesCount: 0 };
    cur.leadsCount += 1;
    assigneeMap.set(name, cur);
  }
  for (const c of activeCases) {
    const name = c.consultorId
      ? staffNameById.get(c.consultorId) || `Consultor (${c.consultorId.slice(0, 8)})`
      : 'Sem responsável';
    const cur = assigneeMap.get(name) || { leadsCount: 0, casesCount: 0 };
    cur.casesCount += 1;
    assigneeMap.set(name, cur);
  }
  const assigneeRows: FunnelPdfAssigneeRow[] = Array.from(assigneeMap.entries())
    .map(([assigneeName, stats]) => ({
      assigneeName,
      leadsCount: stats.leadsCount,
      casesCount: stats.casesCount,
      totalCount: stats.leadsCount + stats.casesCount,
    }))
    .sort((a, b) => b.totalCount - a.totalCount);

  // Clientes/Leads retidos na etapa do gargalo principal (ou na etapa de maior volume se não houver gargalo crítico)
  const targetStage =
    summary.primaryBottleneck?.fromStage ||
    stageRows.slice(0, 4).sort((a, b) => b.totalCount - a.totalCount)[0]?.stage ||
    null;

  const retainedRows: FunnelPdfBottleneckClientRow[] = [];
  if (targetStage) {
    for (const l of filteredLeads) {
      const st = getMacroStageForLead(l);
      if (st?.id !== targetStage.id) continue;
      retainedRows.push({
        id: `lead:${l.id}`,
        name: l.nome || 'Lead sem nome',
        kindLabel: 'Lead',
        stageName: targetStage.nome,
        priority: l.prioridade || 'Média',
        assigneeName: l.responsavelId
          ? staffNameById.get(l.responsavelId) || 'Consultor'
          : 'Sem responsável',
        createdAtLabel: formatDateBR(l.createdAt),
        detail: `${l.statusFunil}${l.subcategoriaSugerida ? ` · ${l.subcategoriaSugerida}` : ''}`,
      });
    }
    for (const c of activeCases) {
      const st = getMacroStageForCase(c);
      if (st.id !== targetStage.id) continue;
      retainedRows.push({
        id: `case:${c.id}`,
        name: clientNameById.get(c.clientId) || c.titulo,
        kindLabel: 'Processo',
        stageName: targetStage.nome,
        priority: c.prioridade || 'Média',
        assigneeName: c.consultorId
          ? staffNameById.get(c.consultorId) || 'Consultor'
          : 'Sem responsável',
        createdAtLabel: formatDateBR(c.createdAt),
        detail: `${c.tipoServico} · ${c.statusSermig}`,
      });
    }
  }

  const recommendations = buildRecommendations(summary);

  // Paginação determinística A4:
  // Página 1: Cabeçalho executivo + KPIs + Gargalo + 4 Transições + Tabela dos 5 Marcos
  // Página 2+: Canais + Responsáveis + Tabela paginada de clientes retidos + Recomendações gerenciais
  const pages: FunnelPdfPagePlan[] = [
    {
      pageNumber: 1,
      totalPages: 1,
      isFirstPage: true,
      showBreakdowns: false,
      showRetainedHeader: false,
      retainedRows: [],
      showRecommendations: false,
    },
  ];

  const hasSecondPageContent =
    channelRows.length > 0 || assigneeRows.length > 0 || retainedRows.length > 0 || recommendations.length > 0;

  if (hasSecondPageContent) {
    const firstDetailRows = retainedRows.slice(0, 7);
    const remainingRows = retainedRows.slice(7);

    pages.push({
      pageNumber: 2,
      totalPages: 2,
      isFirstPage: false,
      showBreakdowns: true,
      showRetainedHeader: retainedRows.length > 0,
      retainedRows: firstDetailRows,
      showRecommendations: remainingRows.length === 0,
    });

    const ROWS_PER_EXTRA_PAGE = 16;
    for (let i = 0; i < remainingRows.length; i += ROWS_PER_EXTRA_PAGE) {
      const slice = remainingRows.slice(i, i + ROWS_PER_EXTRA_PAGE);
      const isLast = i + ROWS_PER_EXTRA_PAGE >= remainingRows.length;
      pages.push({
        pageNumber: pages.length + 1,
        totalPages: pages.length + 1,
        isFirstPage: false,
        showBreakdowns: false,
        showRetainedHeader: true,
        retainedRows: slice,
        showRecommendations: isLast,
      });
    }
  }

  const totalPages = pages.length;
  for (const p of pages) {
    p.totalPages = totalPages;
  }

  const brandName = (input.empresa.nome_empresa || 'D&M Integra Chile').trim();
  const brandSub = [input.empresa.razao_social_cnpj_rut, input.empresa.endereco_cidade]
    .filter(Boolean)
    .join(' · ');
  const contactLine = [input.empresa.email, input.empresa.whatsapp].filter(Boolean).join(' · ');
  const filename = `DM_Integra_Relatorio_Funil_${periodTag}_${toIsoDate(now)}.pdf`;

  return {
    filename,
    primaryColor: safeHexColor(input.empresa.corPrimaria, '#0B1F33'),
    accentColor: safeHexColor(input.empresa.corDestaque, '#C9A227'),
    brandName,
    brandSub,
    contactLine,
    generatedAt: formatDateTimeBR(now.toISOString()),
    periodLabel,
    periodTag,
    summary,
    stageRows,
    channelRows,
    assigneeRows,
    bottleneckStageName: targetStage?.nome || null,
    retainedTotalCount: retainedRows.length,
    recommendations,
    pages,
  };
}
