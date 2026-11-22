import type { Case, Client, Lead } from '../types/domain';

export type AnalyticsHorizon = '6m' | '12m';

export interface MonthlyDiagnosticPoint {
  monthKey: string; // YYYY-MM
  label: string; // Ex: Nov/26
  diagnosticos: number;
  convertidos: number;
  taxaConversaoPct: number;
}

export interface ConversionStagePoint {
  etapa: string;
  etapaCurta: string;
  total: number;
  taxaSobreBasePct: number;
  cor: string;
}

export interface MigrationProfileSlice {
  id: string;
  nome: string;
  nomeCurto: string;
  total: number;
  percentual: number;
  convertidos: number;
  taxaConversaoPct: number;
  cor: string;
}

export interface PanelAnalyticsSummary {
  totalDiagnosticos: number;
  diagnosticosNoPeriodo: number;
  clientesConvertidos: number;
  totalClientesAtivos: number;
  totalProcessosAtivos: number;
  taxaConversaoGlobalPct: number;
  taxaConversaoPeriodoPct: number;
  perfilLider: MigrationProfileSlice | null;
  monthlySeries: MonthlyDiagnosticPoint[];
  conversionJourney: ConversionStagePoint[];
  profileDistribution: MigrationProfileSlice[];
}

const MONTH_NAMES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const PROFILE_CATALOG: Array<{
  id: string;
  nome: string;
  nomeCurto: string;
  cor: string;
  match: (rawText: string, objetivo?: string) => boolean;
}> = [
  {
    id: 'mercosul',
    nome: 'Acordo Mercosul (Subcat. 15)',
    nomeCurto: 'Mercosul (15)',
    cor: '#0B1F33',
    match: (t) => /mercosul|mercosur|subcat.*15|c[oó]d\.?\s*15/i.test(t),
  },
  {
    id: 'reunificacao',
    nome: 'Reunificação Familiar (Subcat. 01)',
    nomeCurto: 'Reunificação (01)',
    cor: '#146B43',
    match: (t) => /reunifica|familiar|v[ií]nculo|c[oô]njuge|filho|subcat.*0?1/i.test(t),
  },
  {
    id: 'trabalho',
    nome: 'Trabalho / Oferta Formal (Subcat. 02)',
    nomeCurto: 'Trabalho (02)',
    cor: '#C8A236',
    match: (t, obj) =>
      obj === 'trabalho_formal' ||
      obj === 'servicos_90d' ||
      obj === 'temporada' ||
      /trabalho|l[ií]cita|oferta|contrato|subcat.*0?2/i.test(t),
  },
  {
    id: 'prorrogacao_definitiva',
    nome: 'Prorrogação / Residência Definitiva',
    nomeCurto: 'Definitiva / Prorr.',
    cor: '#2563EB',
    match: (t) => /definitiva|prorroga|mudan[çc]a de subcategoria|ratifica/i.test(t),
  },
  {
    id: 'aposentado_renda',
    nome: 'Aposentado / Rentista (Subcat. 11)',
    nomeCurto: 'Rentista (11)',
    cor: '#0D9488',
    match: (t, obj) => obj === 'aposentado_renda' || /aposentad|rentista|jubilad|renda passiva|subcat.*11/i.test(t),
  },
  {
    id: 'investidor',
    nome: 'Empreendedor / Investidor (Subcat. 13)',
    nomeCurto: 'Investidor (13)',
    cor: '#A61C2B',
    match: (t, obj) => obj === 'empreender_investir' || /investidor|empreend|inversionista|subcat.*13/i.test(t),
  },
  {
    id: 'estudante',
    nome: 'Estudante (Subcat. 03)',
    nomeCurto: 'Estudante (03)',
    cor: '#7C3AED',
    match: (t, obj) => obj === 'estudar' || /estudan|estudo|matr[ií]cula|subcat.*0?3/i.test(t),
  },
];

function extractMonthKey(iso?: string): string | null {
  if (!iso || typeof iso !== 'string') return null;
  const match = /^(\d{4})-(\d{2})/.exec(iso.trim());
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, monthStr] = monthKey.split('-');
  const idx = Number(monthStr) - 1;
  const name = MONTH_NAMES_PT[idx] || monthStr;
  return `${name}/${year.slice(-2)}`;
}

function buildRecentMonthKeys(monthsCount: number, now: Date): string[] {
  const keys: string[] = [];
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const d = new Date(baseYear, baseMonth - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

function isLeadConverted(lead: Lead): boolean {
  return Boolean(lead.convertedClientId || lead.convertedCaseId || lead.statusFunil === 'Fechado');
}

function classifyMigrationProfile(rawText: string, objetivo?: string): { id: string; nome: string; nomeCurto: string; cor: string } {
  const normalized = (rawText || '').trim();
  for (const item of PROFILE_CATALOG) {
    if (item.match(normalized, objetivo)) {
      return { id: item.id, nome: item.nome, nomeCurto: item.nomeCurto, cor: item.cor };
    }
  }
  return {
    id: 'outros',
    nome: 'Outros Perfis / Em Avaliação',
    nomeCurto: 'Outros Perfis',
    cor: '#64748B',
  };
}

export function computePanelAnalytics(params: {
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  horizon?: AnalyticsHorizon;
  now?: Date;
}): PanelAnalyticsSummary {
  const { leads, clients, cases, horizon = '6m', now = new Date() } = params;
  const monthsCount = horizon === '12m' ? 12 : 6;
  const monthKeys = buildRecentMonthKeys(monthsCount, now);
  const monthSet = new Set(monthKeys);

  const monthBuckets = new Map<string, { diagnosticos: number; convertidos: number }>();
  for (const mk of monthKeys) {
    monthBuckets.set(mk, { diagnosticos: 0, convertidos: 0 });
  }

  let diagnosticosNoPeriodo = 0;
  let convertidosNoPeriodo = 0;

  for (const lead of leads) {
    const mk = extractMonthKey(lead.createdAt);
    if (mk && monthSet.has(mk)) {
      const bucket = monthBuckets.get(mk)!;
      bucket.diagnosticos += 1;
      diagnosticosNoPeriodo += 1;
      if (isLeadConverted(lead)) {
        bucket.convertidos += 1;
        convertidosNoPeriodo += 1;
      }
    }
  }

  const monthlySeries: MonthlyDiagnosticPoint[] = monthKeys.map((mk) => {
    const b = monthBuckets.get(mk) || { diagnosticos: 0, convertidos: 0 };
    const taxaConversaoPct =
      b.diagnosticos > 0 ? Math.round((b.convertidos / b.diagnosticos) * 100) : 0;
    return {
      monthKey: mk,
      label: formatMonthLabel(mk),
      diagnosticos: b.diagnosticos,
      convertidos: b.convertidos,
      taxaConversaoPct,
    };
  });

  const activeClients = clients.filter((c) => !c.arquivado);
  const activeCases = cases.filter((c) => !c.arquivado);

  const totalDiagnosticos = leads.length;
  const convertedLeadsCount = leads.filter(isLeadConverted).length;
  const clientesConvertidos = Math.max(convertedLeadsCount, activeClients.length);
  const denominatorGlobal = Math.max(totalDiagnosticos, clientesConvertidos);
  const taxaConversaoGlobalPct =
    totalDiagnosticos > 0
      ? Math.min(100, Math.round((convertedLeadsCount / totalDiagnosticos) * 100))
      : activeClients.length > 0
        ? 100
        : 0;
  const taxaConversaoPeriodoPct =
    diagnosticosNoPeriodo > 0
      ? Math.round((convertidosNoPeriodo / diagnosticosNoPeriodo) * 100)
      : 0;

  const emAtendimentoOuProposta = leads.filter(
    (l) =>
      l.statusFunil === 'Contatado' ||
      l.statusFunil === 'Diagnóstico Agendado' ||
      l.statusFunil === 'Orçamento Enviado' ||
      isLeadConverted(l),
  ).length;

  const aprovadosOuConcluidos = activeCases.filter(
    (c) => c.statusSermig === 'Aprovado' || c.etapaPipeline >= 13,
  ).length;

  const baseForJourney = Math.max(1, denominatorGlobal);
  const conversionJourney: ConversionStagePoint[] = [
    {
      etapa: 'Diagnósticos Realizados',
      etapaCurta: 'Diagnósticos',
      total: totalDiagnosticos,
      taxaSobreBasePct: totalDiagnosticos > 0 ? 100 : 0,
      cor: '#0B1F33',
    },
    {
      etapa: 'Qualificados / Proposta',
      etapaCurta: 'Qualificados',
      total: emAtendimentoOuProposta,
      taxaSobreBasePct: totalDiagnosticos > 0 ? Math.round((emAtendimentoOuProposta / baseForJourney) * 100) : 0,
      cor: '#1B4D7A',
    },
    {
      etapa: 'Clientes Convertidos',
      etapaCurta: 'Convertidos',
      total: convertedLeadsCount,
      taxaSobreBasePct: totalDiagnosticos > 0 ? Math.round((convertedLeadsCount / baseForJourney) * 100) : 0,
      cor: '#C8A236',
    },
    {
      etapa: 'Processos Ativos',
      etapaCurta: 'Em Trâmite',
      total: activeCases.length,
      taxaSobreBasePct: Math.min(100, Math.round((activeCases.length / baseForJourney) * 100)),
      cor: '#146B43',
    },
    {
      etapa: 'Aprovados / Finalizados',
      etapaCurta: 'Aprovados',
      total: aprovadosOuConcluidos,
      taxaSobreBasePct: Math.min(100, Math.round((aprovadosOuConcluidos / baseForJourney) * 100)),
      cor: '#0F5434',
    },
  ];

  // Distribuição de perfis migratórios (usa leads com diagnóstico; se vazio, complementa com processos)
  const profileMap = new Map<
    string,
    { id: string; nome: string; nomeCurto: string; cor: string; total: number; convertidos: number }
  >();

  if (leads.length > 0) {
    for (const lead of leads) {
      const hint = `${lead.subcategoriaSugerida || ''} ${lead.interesse || ''} ${lead.respostasTriagem?.localizacao || ''}`;
      const cls = classifyMigrationProfile(hint, lead.respostasTriagem?.objetivo || undefined);
      const entry = profileMap.get(cls.id) || { ...cls, total: 0, convertidos: 0 };
      entry.total += 1;
      if (isLeadConverted(lead)) entry.convertidos += 1;
      profileMap.set(cls.id, entry);
    }
  } else if (activeCases.length > 0) {
    for (const c of activeCases) {
      const hint = `${c.subcategoriaIa || ''} ${c.tipoServico || ''} ${c.titulo || ''}`;
      const cls = classifyMigrationProfile(hint);
      const entry = profileMap.get(cls.id) || { ...cls, total: 0, convertidos: 0 };
      entry.total += 1;
      entry.convertidos += 1;
      profileMap.set(cls.id, entry);
    }
  }

  const totalProfileEntries = Array.from(profileMap.values()).reduce((sum, item) => sum + item.total, 0);
  const profileDistribution: MigrationProfileSlice[] = Array.from(profileMap.values())
    .sort((a, b) => b.total - a.total)
    .map((item) => ({
      ...item,
      percentual: totalProfileEntries > 0 ? Math.round((item.total / totalProfileEntries) * 100) : 0,
      taxaConversaoPct: item.total > 0 ? Math.round((item.convertidos / item.total) * 100) : 0,
    }));

  return {
    totalDiagnosticos,
    diagnosticosNoPeriodo,
    clientesConvertidos: convertedLeadsCount,
    totalClientesAtivos: activeClients.length,
    totalProcessosAtivos: activeCases.length,
    taxaConversaoGlobalPct,
    taxaConversaoPeriodoPct,
    perfilLider: profileDistribution[0] || null,
    monthlySeries,
    conversionJourney,
    profileDistribution,
  };
}
