import type { Budget, BudgetItem, CurrencyCode, CustosPadrao, PaidConsultancyModality } from '../types/domain';
import { formatCurrency, formatDateBR } from './formatters';

export interface BudgetTotals {
  totalHonorarios: number;
  totalTaxas: number;
  subtotal: number;
  descontoAplicado: number;
  totalGeral: number;
  faturadoHonorarios: number;
  pendenteHonorarios: number;
  etapasPagas: number;
  etapasTotais: number;
}

export interface BudgetPresetTemplate {
  id: string;
  label: string;
  titulo: string;
  modalidadeConsultoria: PaidConsultancyModality;
  tipoCobranca: Budget['tipoCobranca'];
  moedaPrincipal: CurrencyCode;
  condicoesPagamento: string;
  buildItems: (custos?: CustosPadrao, usdBrl?: number) => Omit<BudgetItem, 'id'>[];
}

export interface BudgetValidityInfo {
  state: 'vigente' | 'vence_em_breve' | 'vencido' | 'concluido';
  label: string;
  daysRemaining: number | null;
}

export interface BudgetMetricsSummary {
  totalCount: number;
  rascunhosCount: number;
  enviadosCount: number;
  aprovadosCount: number;
  recusadosCount: number;
  vencendoEmBreveCount: number;
  vencidosCount: number;
  taxaAprovacaoPct: number;
  valorAbertoPorMoeda: Record<CurrencyCode, number>;
  valorAprovadoPorMoeda: Record<CurrencyCode, number>;
}

export const BUDGET_PRESET_TEMPLATES: BudgetPresetTemplate[] = [
  {
    id: 'mercosul_etapas',
    label: 'Residência Mercosul (Por Etapas)',
    titulo: 'Assessoria Completa — Residência Temporal Acordo Mercosul',
    modalidadeConsultoria: 'completa',
    tipoCobranca: 'Por Etapa Realizada',
    moedaPrincipal: 'BRL',
    condicoesPagamento:
      '50% na assinatura do contrato + 50% na entrega do protocolo SERMIG (Pix, Cartão ou Transferência).',
    buildItems: (custos, usdBrl = 5.6) => {
      const apostila = Number(custos?.apostilaCnjBrl || 85);
      const sermigUsd = Number(custos?.taxaSermigMercosulUsd || 90);
      const sermigBrl = Math.round(sermigUsd * usdBrl);
      return [
        {
          descricao: 'Etapa 1 — Diagnóstico Jurídico, Checklist Personalizado e Auditoria Documental',
          etapaVinculada: 'Etapa 1–3',
          valorHonorarios: 1800,
          taxasEstimadasTerceiros: Math.round(apostila * 3),
          moeda: 'BRL',
          statusEtapa: 'Concluída/Faturável',
        },
        {
          descricao: 'Etapa 2 — Conferência de Apostilas, Protocolo SERMIG e Acompanhamento até Estampado',
          etapaVinculada: 'Etapa 4–9',
          valorHonorarios: 1800,
          taxasEstimadasTerceiros: sermigBrl,
          moeda: 'BRL',
          statusEtapa: 'Aguardando',
        },
        {
          descricao: 'Etapa 3 — Orientação PDI, Registro Civil e Emissão da Cédula de Identidade (RUT)',
          etapaVinculada: 'Etapa 10–13',
          valorHonorarios: 600,
          taxasEstimadasTerceiros: 80,
          moeda: 'BRL',
          statusEtapa: 'Aguardando',
        },
      ];
    },
  },
  {
    id: 'temporal_trabalho_renda',
    label: 'Residência Temporal (Trabalho / Renda)',
    titulo: 'Assessoria Completa — Residência Temporal (Trabalho, Vínculo ou Renda)',
    modalidadeConsultoria: 'completa',
    tipoCobranca: 'Por Etapa Realizada',
    moedaPrincipal: 'BRL',
    condicoesPagamento:
      '40% na assinatura + 40% no protocolo SERMIG + 20% na aprovação do Estampado Electrónico.',
    buildItems: (custos, usdBrl = 5.6) => {
      const apostila = Number(custos?.apostilaCnjBrl || 85);
      const traducao = Number(custos?.traducaoJuramentadaBrl || 120);
      const sermigUsd = Number(custos?.taxaSermigTemporalUsd || 110);
      return [
        {
          descricao: 'Etapa 1 — Enquadramento Normativo, Validação de Contrato/Renda e Revisão Documental',
          etapaVinculada: 'Etapa 1–4',
          valorHonorarios: 2200,
          taxasEstimadasTerceiros: Math.round(apostila * 4 + traducao * 2),
          moeda: 'BRL',
          statusEtapa: 'Concluída/Faturável',
        },
        {
          descricao: 'Etapa 2 — Montagem do Dossiê Digital, Protocolo SERMIG e Resposta a Subsanaciones',
          etapaVinculada: 'Etapa 5–10',
          valorHonorarios: 2200,
          taxasEstimadasTerceiros: Math.round(sermigUsd * usdBrl),
          moeda: 'BRL',
          statusEtapa: 'Aguardando',
        },
        {
          descricao: 'Etapa 3 — Pós-Aprovação (PDI, RUT e Integração Inicial no Chile)',
          etapaVinculada: 'Etapa 11–14',
          valorHonorarios: 900,
          taxasEstimadasTerceiros: 90,
          moeda: 'BRL',
          statusEtapa: 'Aguardando',
        },
      ];
    },
  },
  {
    id: 'relocation_arriendo',
    label: 'Pacote Visto + Relocation & Arriendo',
    titulo: 'Pacote Executivo — Regularização Migratória + Relocation e Moradia (Arriendo)',
    modalidadeConsultoria: 'completa',
    tipoCobranca: 'Pacote Completo',
    moedaPrincipal: 'BRL',
    condicoesPagamento:
      'Entrada de 40% na contratação + 3 parcelas mensais sem juros via Pix, Wise ou Cartão.',
    buildItems: (custos, usdBrl = 5.6) => {
      const apostila = Number(custos?.apostilaCnjBrl || 85);
      const sermigUsd = Number(custos?.taxaSermigMercosulUsd || 90);
      return [
        {
          descricao: 'Regularização Migratória Completa (Visto SERMIG + PDI + Cédula RUT)',
          etapaVinculada: 'Etapa 1–12',
          valorHonorarios: 3900,
          taxasEstimadasTerceiros: Math.round(sermigUsd * usdBrl + apostila * 3),
          moeda: 'BRL',
          statusEtapa: 'Concluída/Faturável',
        },
        {
          descricao: 'Curadoria de Moradia (Arriendo em UF), Análise Contratual e Apoio Sem Fiador Local',
          etapaVinculada: 'Relocation',
          valorHonorarios: 2400,
          taxasEstimadasTerceiros: 0,
          moeda: 'BRL',
          statusEtapa: 'Aguardando',
        },
        {
          descricao: 'Integração Bancária, Saúde (Fonasa/Isapre) e Checklist Escolar/Familiar',
          etapaVinculada: 'Chegada Chile',
          valorHonorarios: 950,
          taxasEstimadasTerceiros: 0,
          moeda: 'BRL',
          statusEtapa: 'Aguardando',
        },
      ];
    },
  },
  {
    id: 'consultoria_orientativa',
    label: 'Consultoria Orientativa & Revisão',
    titulo: 'Consultoria Orientativa — Plano de Mudança e Revisão Documental',
    modalidadeConsultoria: 'orientativa',
    tipoCobranca: 'Por Serviço Escolhido',
    moedaPrincipal: 'BRL',
    condicoesPagamento: 'Pagamento único via Pix ou Cartão antes da reunião estratégica.',
    buildItems: () => [
      {
        descricao: 'Sessão Estratégica Individual (60 min) + Parecer de Enquadramento Migratório',
        etapaVinculada: 'Etapa 1–2',
        valorHonorarios: 690,
        taxasEstimadasTerceiros: 0,
        moeda: 'BRL',
        statusEtapa: 'Concluída/Faturável',
      },
      {
        descricao: 'Checklist Cronológico Personalizado (Certidões, Apostilas e Simulação de Custos)',
        etapaVinculada: 'Etapa 3',
        valorHonorarios: 350,
        taxasEstimadasTerceiros: 0,
        moeda: 'BRL',
        statusEtapa: 'Aguardando',
      },
    ],
  },
];

export function calculateBudgetTotals(items: BudgetItem[], rawDiscount = 0): BudgetTotals {
  let totalHonorarios = 0;
  let totalTaxas = 0;
  let faturadoHonorarios = 0;
  let pendenteHonorarios = 0;
  let etapasPagas = 0;

  for (const item of items) {
    const hon = Math.max(0, Number.isFinite(Number(item.valorHonorarios)) ? Number(item.valorHonorarios) : 0);
    const tax = Math.max(
      0,
      Number.isFinite(Number(item.taxasEstimadasTerceiros)) ? Number(item.taxasEstimadasTerceiros) : 0,
    );
    totalHonorarios += hon;
    totalTaxas += tax;
    if (item.statusEtapa === 'Paga') {
      faturadoHonorarios += hon;
      etapasPagas += 1;
    } else {
      pendenteHonorarios += hon;
    }
  }

  const subtotal = roundMoney(totalHonorarios + totalTaxas);
  const safeDiscount = Math.max(0, Number.isFinite(Number(rawDiscount)) ? Number(rawDiscount) : 0);
  const descontoAplicado = roundMoney(Math.min(subtotal, safeDiscount));
  const totalGeral = roundMoney(Math.max(0, subtotal - descontoAplicado));

  return {
    totalHonorarios: roundMoney(totalHonorarios),
    totalTaxas: roundMoney(totalTaxas),
    subtotal,
    descontoAplicado,
    totalGeral,
    faturadoHonorarios: roundMoney(faturadoHonorarios),
    pendenteHonorarios: roundMoney(pendenteHonorarios),
    etapasPagas,
    etapasTotais: items.length,
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function convertBudgetSummaryCurrencies(
  amount: number,
  baseCurrency: CurrencyCode,
  rates?: { brlClp?: number; usdBrl?: number },
): Record<CurrencyCode, number> {
  const safeAmount = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const brlClp = rates?.brlClp && rates.brlClp > 0 ? rates.brlClp : 170;
  const usdBrl = rates?.usdBrl && rates.usdBrl > 0 ? rates.usdBrl : 5.6;

  let inBrl = safeAmount;
  if (baseCurrency === 'USD') {
    inBrl = safeAmount * usdBrl;
  } else if (baseCurrency === 'CLP') {
    inBrl = safeAmount / brlClp;
  }

  return {
    BRL: roundMoney(inBrl),
    USD: roundMoney(inBrl / usdBrl),
    CLP: Math.round(inBrl * brlClp),
  };
}

export function generateNextBudgetNumber(budgets: Pick<Budget, 'numeroOrcamento'>[], year = new Date().getFullYear()): string {
  const prefix = `ORC-${year}-`;
  let maxSeq = 0;
  for (const b of budgets) {
    const raw = String(b.numeroOrcamento || '').trim();
    if (raw.startsWith(prefix)) {
      const seq = Number(raw.slice(prefix.length));
      if (Number.isInteger(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function getBudgetValidityState(
  validadeIso: string | undefined,
  status: Budget['status'],
  todayIso = new Date().toISOString().slice(0, 10),
): BudgetValidityInfo {
  if (status === 'Aprovado' || status === 'Parcialmente Faturado' || status === 'Recusado') {
    return { state: 'concluido', label: status, daysRemaining: null };
  }
  if (!validadeIso) {
    return { state: 'vigente', label: 'Sem prazo definido', daysRemaining: null };
  }

  const validDate = new Date(`${validadeIso.slice(0, 10)}T00:00:00Z`);
  const todayDate = new Date(`${todayIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(validDate.getTime()) || Number.isNaN(todayDate.getTime())) {
    return { state: 'vigente', label: 'Validade ativa', daysRemaining: null };
  }

  const diffDays = Math.round((validDate.getTime() - todayDate.getTime()) / 86_400_000);
  if (diffDays < 0) {
    return {
      state: 'vencido',
      label: `Vencido há ${Math.abs(diffDays)} dia(s)`,
      daysRemaining: diffDays,
    };
  }
  if (diffDays === 0) {
    return { state: 'vence_em_breve', label: 'Vence hoje', daysRemaining: 0 };
  }
  if (diffDays <= 5) {
    return { state: 'vence_em_breve', label: `Vence em ${diffDays} dia(s)`, daysRemaining: diffDays };
  }
  return { state: 'vigente', label: `Válido por ${diffDays} dias`, daysRemaining: diffDays };
}

export function computeBudgetMetrics(
  budgets: Budget[],
  todayIso = new Date().toISOString().slice(0, 10),
): BudgetMetricsSummary {
  const valorAbertoPorMoeda: Record<CurrencyCode, number> = { BRL: 0, CLP: 0, USD: 0 };
  const valorAprovadoPorMoeda: Record<CurrencyCode, number> = { BRL: 0, CLP: 0, USD: 0 };
  let rascunhosCount = 0;
  let enviadosCount = 0;
  let aprovadosCount = 0;
  let recusadosCount = 0;
  let vencendoEmBreveCount = 0;
  let vencidosCount = 0;

  for (const b of budgets) {
    const cur: CurrencyCode = b.moedaPrincipal || 'BRL';
    const total = Number(b.totalGeral || 0);
    if (b.status === 'Rascunho') {
      rascunhosCount += 1;
      valorAbertoPorMoeda[cur] = roundMoney(valorAbertoPorMoeda[cur] + total);
    } else if (b.status === 'Enviado ao Cliente') {
      enviadosCount += 1;
      valorAbertoPorMoeda[cur] = roundMoney(valorAbertoPorMoeda[cur] + total);
    } else if (b.status === 'Aprovado' || b.status === 'Parcialmente Faturado') {
      aprovadosCount += 1;
      valorAprovadoPorMoeda[cur] = roundMoney(valorAprovadoPorMoeda[cur] + total);
    } else if (b.status === 'Recusado') {
      recusadosCount += 1;
    }

    const validity = getBudgetValidityState(b.validade, b.status, todayIso);
    if (validity.state === 'vence_em_breve') vencendoEmBreveCount += 1;
    if (validity.state === 'vencido') vencidosCount += 1;
  }

  const decididos = aprovadosCount + recusadosCount;
  const taxaAprovacaoPct = decididos > 0 ? Math.round((aprovadosCount / decididos) * 100) : 0;

  return {
    totalCount: budgets.length,
    rascunhosCount,
    enviadosCount,
    aprovadosCount,
    recusadosCount,
    vencendoEmBreveCount,
    vencidosCount,
    taxaAprovacaoPct,
    valorAbertoPorMoeda,
    valorAprovadoPorMoeda,
  };
}

export function formatBudgetWhatsAppMessage(
  budget: Budget,
  clientName: string,
  empresaName = 'D&M Integra Chile',
): string {
  const lines: string[] = [
    `Olá, ${clientName}! Tudo bem?`,
    `Segue a proposta comercial *${budget.numeroOrcamento}* da *${empresaName}*:`,
    '',
    `*${budget.titulo}*`,
    `Modelo: ${budget.tipoCobranca} · Validade: ${formatDateBR(budget.validade)}`,
    '',
    '*Detalhamento das Etapas:*',
  ];

  budget.itens.forEach((it, idx) => {
    const cur = it.moeda || budget.moedaPrincipal;
    const taxPart =
      Number(it.taxasEstimadasTerceiros || 0) > 0
        ? ` (+ taxas est. terceiros: ${formatCurrency(it.taxasEstimadasTerceiros, cur)})`
        : '';
    lines.push(`${idx + 1}. ${it.descricao} — Honorários: ${formatCurrency(it.valorHonorarios, cur)}${taxPart}`);
  });

  lines.push('');
  lines.push(`• Honorários: ${formatCurrency(budget.totalHonorarios, budget.moedaPrincipal)}`);
  if (budget.totalTaxas > 0) {
    lines.push(`• Taxas estimadas de terceiros (SERMIG/cartório): ${formatCurrency(budget.totalTaxas, budget.moedaPrincipal)}`);
  }
  if (budget.desconto > 0) {
    lines.push(`• Desconto especial: -${formatCurrency(budget.desconto, budget.moedaPrincipal)}`);
  }
  lines.push(`• *Investimento Total Estimado: ${formatCurrency(budget.totalGeral, budget.moedaPrincipal)}*`);

  if (budget.condicoesPagamento) {
    lines.push('');
    lines.push(`*Condições de pagamento:* ${budget.condicoesPagamento}`);
  }

  lines.push('');
  lines.push('Você pode revisar e aprovar este orçamento diretamente no seu Portal do Cliente. Qualquer dúvida, estou à disposição!');
  return lines.join('\n');
}
