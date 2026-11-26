import type { CurrencyCode, CustosPadrao, FinancialRecord } from '../types/domain';
import { formatCurrency, formatDateBR } from './formatters';

export interface ExchangeRates {
  brlClp: number;
  usdBrl: number;
}

export interface CurrencyTotals {
  recebido: number;
  pendente: number;
  atrasado: number;
  total: number;
}

export interface ConsolidatedFinanceMetrics {
  byCurrency: Record<CurrencyCode, CurrencyTotals>;
  consolidatedBrl: CurrencyTotals;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  dueSoonCount: number;
  collectionRatePct: number;
  byTypeBrl: Array<{
    tipo: FinancialRecord['tipo'];
    recebidoBrl: number;
    abertoBrl: number;
    totalBrl: number;
    count: number;
  }>;
  monthlySeries: Array<{
    monthKey: string;
    label: string;
    recebidoBrl: number;
    previstoBrl: number;
  }>;
}

export interface InstallmentDraft {
  parcelaIndex: number;
  totalParcelas: number;
  descricao: string;
  valor: number;
  vencimento: string;
}

export interface ThirdPartyCostInput {
  visaType: 'mercosul' | 'temporal' | 'definitiva';
  pessoas: number;
  apostilasPorPessoa: number;
  paginasTraducaoTotal: number;
  incluirCedulaRut: boolean;
}

export interface ThirdPartyCostEstimate {
  sermigUsd: number;
  sermigBrl: number;
  apostilasBrl: number;
  traducoesBrl: number;
  cedulaClp: number;
  cedulaBrl: number;
  totalBrl: number;
  totalUsd: number;
  totalClp: number;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function normalizeExchangeRates(rates?: Partial<ExchangeRates>): ExchangeRates {
  const brlClp = rates?.brlClp && Number.isFinite(rates.brlClp) && rates.brlClp > 0 ? rates.brlClp : 170;
  const usdBrl = rates?.usdBrl && Number.isFinite(rates.usdBrl) && rates.usdBrl > 0 ? rates.usdBrl : 5.6;
  return { brlClp, usdBrl };
}

export function convertToBrl(amount: number, currency: CurrencyCode, rates?: Partial<ExchangeRates>): number {
  const safe = Number.isFinite(amount) ? amount : 0;
  const { brlClp, usdBrl } = normalizeExchangeRates(rates);
  if (currency === 'USD') return roundMoney(safe * usdBrl);
  if (currency === 'CLP') return roundMoney(safe / brlClp);
  return roundMoney(safe);
}

export function getEffectiveFinancialStatus(
  record: Pick<FinancialRecord, 'status' | 'vencimento'>,
  todayIso = new Date().toISOString().slice(0, 10),
): { effectiveStatus: FinancialRecord['status']; isImplicitlyOverdue: boolean; daysUntilDue: number | null } {
  if (record.status === 'Pago') {
    return { effectiveStatus: 'Pago', isImplicitlyOverdue: false, daysUntilDue: null };
  }
  const venc = (record.vencimento || '').slice(0, 10);
  if (!venc || !/^\d{4}-\d{2}-\d{2}$/.test(venc)) {
    return { effectiveStatus: record.status, isImplicitlyOverdue: false, daysUntilDue: null };
  }
  const dueDate = new Date(`${venc}T00:00:00Z`);
  const todayDate = new Date(`${todayIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(todayDate.getTime())) {
    return { effectiveStatus: record.status, isImplicitlyOverdue: false, daysUntilDue: null };
  }
  const diffDays = Math.round((dueDate.getTime() - todayDate.getTime()) / 86_400_000);
  if (diffDays < 0) {
    return {
      effectiveStatus: 'Atrasado',
      isImplicitlyOverdue: record.status !== 'Atrasado',
      daysUntilDue: diffDays,
    };
  }
  return {
    effectiveStatus: record.status,
    isImplicitlyOverdue: false,
    daysUntilDue: diffDays,
  };
}

const MONTH_LABELS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function formatMonthShort(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return monthKey;
  return `${MONTH_LABELS_PT[idx]}/${y.slice(2)}`;
}

function buildRecentMonthKeys(todayIso: string, monthsBack = 3, monthsAhead = 2): string[] {
  const base = new Date(`${todayIso.slice(0, 10)}T00:00:00Z`);
  const keys: string[] = [];
  for (let offset = -monthsBack; offset <= monthsAhead; offset += 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

export function computeFinancialMetrics(
  records: FinancialRecord[],
  rates?: Partial<ExchangeRates>,
  todayIso = new Date().toISOString().slice(0, 10),
): ConsolidatedFinanceMetrics {
  const normRates = normalizeExchangeRates(rates);
  const byCurrency: Record<CurrencyCode, CurrencyTotals> = {
    BRL: { recebido: 0, pendente: 0, atrasado: 0, total: 0 },
    CLP: { recebido: 0, pendente: 0, atrasado: 0, total: 0 },
    USD: { recebido: 0, pendente: 0, atrasado: 0, total: 0 },
  };
  const consolidatedBrl: CurrencyTotals = { recebido: 0, pendente: 0, atrasado: 0, total: 0 };

  const typeOrder: FinancialRecord['tipo'][] = [
    'Honorários',
    'Taxa SERMIG',
    'Apostila/Tradução',
    'Despachante/Outros',
  ];
  const typeMap = new Map<
    FinancialRecord['tipo'],
    { tipo: FinancialRecord['tipo']; recebidoBrl: number; abertoBrl: number; totalBrl: number; count: number }
  >(typeOrder.map((tipo) => [tipo, { tipo, recebidoBrl: 0, abertoBrl: 0, totalBrl: 0, count: 0 }]));

  const monthKeys = buildRecentMonthKeys(todayIso, 3, 2);
  const monthBuckets = new Map<string, { monthKey: string; label: string; recebidoBrl: number; previstoBrl: number }>(
    monthKeys.map((k) => [k, { monthKey: k, label: formatMonthShort(k), recebidoBrl: 0, previstoBrl: 0 }]),
  );

  let paidCount = 0;
  let pendingCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;

  for (const r of records) {
    const cur: CurrencyCode = r.moeda || 'BRL';
    const val = Math.max(0, Number(r.valor || 0));
    const valBrl = convertToBrl(val, cur, normRates);
    const { effectiveStatus, daysUntilDue } = getEffectiveFinancialStatus(r, todayIso);

    byCurrency[cur].total = roundMoney(byCurrency[cur].total + val);
    consolidatedBrl.total = roundMoney(consolidatedBrl.total + valBrl);

    const typeEntry = typeMap.get(r.tipo) || {
      tipo: r.tipo,
      recebidoBrl: 0,
      abertoBrl: 0,
      totalBrl: 0,
      count: 0,
    };
    typeEntry.count += 1;
    typeEntry.totalBrl = roundMoney(typeEntry.totalBrl + valBrl);

    if (effectiveStatus === 'Pago') {
      byCurrency[cur].recebido = roundMoney(byCurrency[cur].recebido + val);
      consolidatedBrl.recebido = roundMoney(consolidatedBrl.recebido + valBrl);
      typeEntry.recebidoBrl = roundMoney(typeEntry.recebidoBrl + valBrl);
      paidCount += 1;
    } else if (effectiveStatus === 'Atrasado') {
      byCurrency[cur].atrasado = roundMoney(byCurrency[cur].atrasado + val);
      consolidatedBrl.atrasado = roundMoney(consolidatedBrl.atrasado + valBrl);
      typeEntry.abertoBrl = roundMoney(typeEntry.abertoBrl + valBrl);
      overdueCount += 1;
    } else {
      byCurrency[cur].pendente = roundMoney(byCurrency[cur].pendente + val);
      consolidatedBrl.pendente = roundMoney(consolidatedBrl.pendente + valBrl);
      typeEntry.abertoBrl = roundMoney(typeEntry.abertoBrl + valBrl);
      pendingCount += 1;
      if (daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 7) {
        dueSoonCount += 1;
      }
    }
    typeMap.set(r.tipo, typeEntry);

    const refDate = effectiveStatus === 'Pago' ? r.dataPagamento || r.vencimento : r.vencimento;
    const mk = (refDate || '').slice(0, 7);
    const mBucket = monthBuckets.get(mk);
    if (mBucket) {
      if (effectiveStatus === 'Pago') {
        mBucket.recebidoBrl = roundMoney(mBucket.recebidoBrl + valBrl);
      } else {
        mBucket.previstoBrl = roundMoney(mBucket.previstoBrl + valBrl);
      }
    }
  }

  const collectionRatePct =
    consolidatedBrl.total > 0 ? Math.round((consolidatedBrl.recebido / consolidatedBrl.total) * 100) : 0;

  return {
    byCurrency,
    consolidatedBrl,
    paidCount,
    pendingCount,
    overdueCount,
    dueSoonCount,
    collectionRatePct,
    byTypeBrl: Array.from(typeMap.values()),
    monthlySeries: Array.from(monthBuckets.values()),
  };
}

export function addMonthsIso(isoDate: string, monthsToAdd: number): string {
  const clean = isoDate.slice(0, 10);
  const [yStr, mStr, dStr] = clean.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
    return isoDate;
  }
  const targetMonthIndex = m - 1 + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(d, lastDayOfTargetMonth);
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export function generateInstallments(params: {
  descricaoBase: string;
  valorTotal: number;
  parcelas: number;
  primeiroVencimento: string;
  moeda: CurrencyCode;
}): InstallmentDraft[] {
  const count = Math.max(1, Math.min(24, Math.floor(params.parcelas || 1)));
  const total = Math.max(0, Number(params.valorTotal || 0));
  const baseDesc = params.descricaoBase.trim() || 'Parcela';

  if (count === 1) {
    return [
      {
        parcelaIndex: 1,
        totalParcelas: 1,
        descricao: baseDesc,
        valor: params.moeda === 'CLP' ? Math.round(total) : roundMoney(total),
        vencimento: params.primeiroVencimento,
      },
    ];
  }

  const isZeroDecimal = params.moeda === 'CLP';
  const unitFactor = isZeroDecimal ? 1 : 100;
  const totalUnits = Math.round(total * unitFactor);
  const baseUnits = Math.floor(totalUnits / count);
  let remainder = totalUnits - baseUnits * count;

  const list: InstallmentDraft[] = [];
  for (let i = 0; i < count; i += 1) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    const valor = (baseUnits + extra) / unitFactor;
    list.push({
      parcelaIndex: i + 1,
      totalParcelas: count,
      descricao: `${baseDesc} (${i + 1}/${count})`,
      valor: isZeroDecimal ? Math.round(valor) : roundMoney(valor),
      vencimento: addMonthsIso(params.primeiroVencimento, i),
    });
  }
  return list;
}

export function estimateProcessThirdPartyCosts(
  input: ThirdPartyCostInput,
  custos?: CustosPadrao,
  rates?: Partial<ExchangeRates>,
): ThirdPartyCostEstimate {
  const { brlClp, usdBrl } = normalizeExchangeRates(rates);
  const pessoas = Math.max(1, Math.min(12, Math.floor(input.pessoas || 1)));
  const apostilasPorPessoa = Math.max(0, Math.min(20, Math.floor(input.apostilasPorPessoa || 0)));
  const paginasTraducaoTotal = Math.max(0, Math.min(100, Math.floor(input.paginasTraducaoTotal || 0)));

  const taxaUnitUsd =
    input.visaType === 'definitiva'
      ? Number(custos?.taxaSermigDefinitivaUsd ?? 130)
      : input.visaType === 'temporal'
        ? Number(custos?.taxaSermigTemporalUsd ?? 110)
        : Number(custos?.taxaSermigMercosulUsd ?? 90);

  const apostilaUnitBrl = Number(custos?.apostilaCnjBrl ?? 85);
  const traducaoUnitBrl = Number(custos?.traducaoJuramentadaBrl ?? 120);
  const cedulaUnitClp = Number(custos?.cedulaIdentidadeClp ?? 4270);

  const sermigUsd = roundMoney(taxaUnitUsd * pessoas);
  const sermigBrl = roundMoney(sermigUsd * usdBrl);
  const apostilasBrl = roundMoney(apostilaUnitBrl * apostilasPorPessoa * pessoas);
  const traducoesBrl = roundMoney(traducaoUnitBrl * paginasTraducaoTotal);
  const cedulaClp = input.incluirCedulaRut ? Math.round(cedulaUnitClp * pessoas) : 0;
  const cedulaBrl = roundMoney(cedulaClp / brlClp);

  const totalBrl = roundMoney(sermigBrl + apostilasBrl + traducoesBrl + cedulaBrl);
  const totalUsd = roundMoney(totalBrl / usdBrl);
  const totalClp = Math.round(totalBrl * brlClp);

  return {
    sermigUsd,
    sermigBrl,
    apostilasBrl,
    traducoesBrl,
    cedulaClp,
    cedulaBrl,
    totalBrl,
    totalUsd,
    totalClp,
  };
}

export function formatPaymentReminderWhatsApp(
  record: FinancialRecord,
  clientName: string,
  chavePix?: string,
  todayIso = new Date().toISOString().slice(0, 10),
): string {
  const { effectiveStatus } = getEffectiveFinancialStatus(record, todayIso);
  const valorFmt = formatCurrency(record.valor, record.moeda);
  const vencFmt = formatDateBR(record.vencimento);

  const intro =
    effectiveStatus === 'Atrasado'
      ? `Olá, ${clientName}! Tudo bem? Passando para lembrar com carinho sobre o lançamento *${record.descricao}* no valor de *${valorFmt}*, que venceu em ${vencFmt}.`
      : `Olá, ${clientName}! Tudo bem? Passando apenas para lembrar do próximo vencimento referente a *${record.descricao}* no valor de *${valorFmt}*, previsto para ${vencFmt}.`;

  const pixLine = chavePix ? `\n\nChave Pix para facilidade: *${chavePix}*` : '';
  return `${intro}${pixLine}\n\nAssim que efetuar o pagamento, você pode anexar o comprovante diretamente no Portal do Cliente ou enviar por aqui mesmo. Qualquer dúvida ou necessidade de ajuste de data, estou à disposição!`;
}
