import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Calculator,
  CalendarPlus,
  Check,
  ClipboardCheck,
  Copy,
} from 'lucide-react';
import { UiButton } from '../ui/DesignSystem';
import { makeId, saveDocumentAudited } from '../../services/firestoreService';
import type {
  Case,
  CurrencyCode,
  Deadline,
  EmpresaConfig,
  UserRole,
  VisaCategory,
  VisaRequirement,
} from '../../types/domain';
import { daysUntilDate, formatCurrency, formatDateBR, toIsoDate } from '../../utils/formatters';

interface PainelFerramentasProps {
  role: UserRole;
  empresa: EmpresaConfig;
  cases: Case[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  onRefresh: () => Promise<void>;
}

type ToolTab = 'prazos' | 'moedas' | 'checklist';

type DeadlineRuleKey =
  | 'estampado_90d'
  | 'pdi_cedula_30d'
  | 'prorrogacao_definitiva'
  | 'certidao_br_90d'
  | 'turismo_90d';

const DEADLINE_RULES: {
  key: DeadlineRuleKey;
  titulo: string;
  tipo: Deadline['tipo'];
  descricao: string;
  dias: number;
  modo: 'adicionar' | 'anteceder';
}[] = [
  {
    key: 'estampado_90d',
    titulo: 'Estampado Electrónico SERMIG (90 dias)',
    tipo: 'Entrada no Chile 90d',
    descricao: 'Prazo corrido após notificação de aprovação / pagamento de taxas para emitir e baixar o Estampado.',
    dias: 90,
    modo: 'adicionar',
  },
  {
    key: 'pdi_cedula_30d',
    titulo: 'Registro PDI & Cédula de Identidade (30 dias)',
    tipo: 'Vencimento Cédula',
    descricao: 'Prazo corrido após entrada no Chile ou obtenção do Estampado para agendar Registro Civil e registrar PDI.',
    dias: 30,
    modo: 'adicionar',
  },
  {
    key: 'prorrogacao_definitiva',
    titulo: 'Janela de Residência Definitiva / Prorrogação',
    tipo: 'Janela Prorrogação',
    descricao: 'Abertura da janela legal 90 dias antes do vencimento da Residência Temporal vigente (limite seguro: 10 dias antes).',
    dias: 90,
    modo: 'anteceder',
  },
  {
    key: 'certidao_br_90d',
    titulo: 'Validade de Antecedentes / Certidões Brasileiras (90 dias)',
    tipo: 'Validade Documento',
    descricao: 'Janela prática de aceitação no protocolo SERMIG contada da emissão da certidão no Brasil.',
    dias: 90,
    modo: 'adicionar',
  },
  {
    key: 'turismo_90d',
    titulo: 'Permanência como Turista no Chile (90 dias)',
    tipo: 'Prazo Legal 6 Meses SERMIG',
    descricao: 'Data limite inicial do visto de permanência transitória antes da necessidade de prorrogação (+90d pagos) ou saída.',
    dias: 90,
    modo: 'adicionar',
  },
];

export const PainelFerramentas: React.FC<PainelFerramentasProps> = ({
  role,
  empresa,
  cases,
  visaCategories,
  visaRequirements,
  onRefresh,
}) => {
  const [tab, setTab] = useState<ToolTab>('prazos');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // 1) Calculadora de Prazos Migratórios
  const [ruleKey, setRuleKey] = useState<DeadlineRuleKey>('estampado_90d');
  const [baseDate, setBaseDate] = useState<string>(() => toIsoDate(new Date()));
  const [linkCaseId, setLinkCaseId] = useState<string>('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  // 2) Conversor & Simulador Multi-Moeda
  const defaultBrlClp = empresa.taxaCambioBrlClp || 170;
  const defaultUsdBrl = empresa.taxaCambioUsdBrl || 5.75;
  const [convAmount, setConvAmount] = useState<number>(1000);
  const [convCurrency, setConvCurrency] = useState<CurrencyCode>('BRL');
  const [rateBrlClp, setRateBrlClp] = useState<number>(defaultBrlClp);
  const [rateUsdBrl, setRateUsdBrl] = useState<number>(defaultUsdBrl);
  const [simType, setSimType] = useState<'mercosul' | 'temporal' | 'definitiva'>('mercosul');
  const [simAdults, setSimAdults] = useState<number>(1);
  const [simMinors, setSimMinors] = useState<number>(0);
  const [simHonorariosBrl, setSimHonorariosBrl] = useState<number>(empresa.honorariosPadraoMinBrl || 2800);

  // 3) Simulador de Checklist por Subcategoria
  const activeVisas = useMemo(() => visaCategories.filter((v) => v.ativo), [visaCategories]);
  const [selectedVisaId, setSelectedVisaId] = useState<string>(() => activeVisas[0]?.id || 'visa_15_mercosul');
  const [chkDependents, setChkDependents] = useState<number>(0);
  const [chkLocation, setChkLocation] = useState<'brasil' | 'chile'>('brasil');

  const activeCases = useMemo(() => cases.filter((c) => !c.arquivado), [cases]);

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2200);
  };

  // Cálculo da data alvo
  const deadlineCalc = useMemo(() => {
    const rule = DEADLINE_RULES.find((r) => r.key === ruleKey) || DEADLINE_RULES[0];
    const parsed = new Date(`${baseDate}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return { rule, targetIso: '', safeIso: '', daysLeft: null as number | null };
    }
    const ms = parsed.getTime();
    const targetDate = new Date(
      rule.modo === 'adicionar' ? ms + rule.dias * 86400000 : ms - rule.dias * 86400000,
    );
    const safeDate =
      rule.modo === 'anteceder'
        ? new Date(ms - 10 * 86400000)
        : new Date(targetDate.getTime() - 10 * 86400000);
    const targetIso = toIsoDate(targetDate);
    const safeIso = toIsoDate(safeDate);
    return {
      rule,
      targetIso,
      safeIso,
      daysLeft: daysUntilDate(targetIso),
    };
  }, [ruleKey, baseDate]);

  const handleSaveDeadlineToCase = async () => {
    if (!linkCaseId || !deadlineCalc.targetIso) return;
    setSavingDeadline(true);
    try {
      const c = cases.find((x) => x.id === linkCaseId);
      const id = makeId('dl');
      const dl: Deadline = {
        id,
        caseId: linkCaseId,
        clientId: c?.clientId,
        titulo: deadlineCalc.rule.titulo,
        tipo: deadlineCalc.rule.tipo,
        dataLimite: deadlineCalc.targetIso,
        concluido: false,
      };
      await saveDocumentAudited(
        'deadlines',
        id,
        dl as unknown as Record<string, unknown>,
        true,
        role,
        'prazo_calculadora',
      );
      setFeedback(`Prazo "${dl.titulo}" salvo no caso "${c?.titulo || linkCaseId}".`);
      await onRefresh();
    } finally {
      setSavingDeadline(false);
    }
  };

  // Conversões financeiras
  const convertedValues = useMemo(() => {
    const safeClp = Math.max(1, rateBrlClp);
    const safeUsd = Math.max(0.1, rateUsdBrl);
    const brl =
      convCurrency === 'BRL'
        ? convAmount
        : convCurrency === 'USD'
          ? convAmount * safeUsd
          : convAmount / safeClp;
    return {
      BRL: brl,
      USD: brl / safeUsd,
      CLP: Math.round(brl * safeClp),
    };
  }, [convAmount, convCurrency, rateBrlClp, rateUsdBrl]);

  const costSimulation = useMemo(() => {
    const pessoas = Math.max(1, simAdults + simMinors);
    const taxasSermigUnitUsd =
      simType === 'mercosul'
        ? empresa.custosPadrao?.taxaSermigMercosulUsd ?? 90
        : simType === 'definitiva'
          ? empresa.custosPadrao?.taxaSermigDefinitivaUsd ?? 100
          : empresa.custosPadrao?.taxaSermigTemporalUsd ?? 90;
    const sermigUsd = taxasSermigUnitUsd * pessoas;
    const sermigBrl = sermigUsd * rateUsdBrl;
    const docsPerPerson = 3;
    const apostilaUnitBrl = empresa.custosPadrao?.apostilaCnjBrl ?? 145;
    const traducaoUnitBrl = empresa.custosPadrao?.traducaoJuramentadaBrl ?? 160;
    const apostilasBrl = apostilaUnitBrl * docsPerPerson * pessoas;
    const traducoesBrl = traducaoUnitBrl * docsPerPerson * pessoas;
    const cedulaUnitClp = empresa.custosPadrao?.cedulaIdentidadeClp ?? 4270;
    const cedulasClp = cedulaUnitClp * pessoas;
    const cedulasBrl = cedulasClp / Math.max(1, rateBrlClp);
    const totalTerceirosBrl = sermigBrl + apostilasBrl + traducoesBrl + cedulasBrl;
    const totalGeralBrl = totalTerceirosBrl + simHonorariosBrl;
    return {
      pessoas,
      sermigUsd,
      sermigBrl,
      apostilasBrl,
      traducoesBrl,
      cedulasClp,
      cedulasBrl,
      totalTerceirosBrl,
      totalGeralBrl,
      totalGeralClp: Math.round(totalGeralBrl * rateBrlClp),
      totalGeralUsd: totalGeralBrl / Math.max(0.1, rateUsdBrl),
    };
  }, [simType, simAdults, simMinors, simHonorariosBrl, rateBrlClp, rateUsdBrl, empresa.custosPadrao]);

  const checklistSimulation = useMemo(() => {
    const visa = activeVisas.find((v) => v.id === selectedVisaId) || activeVisas[0];
    const reqs = visaRequirements
      .filter((r) => r.visaCategoryId === visa?.id)
      .sort((a, b) => a.ordemPrioridadeEmissao - b.ordemPrioridadeEmissao);
    return { visa, reqs };
  }, [activeVisas, selectedVisaId, visaRequirements]);

  const checklistFormattedText = useMemo(() => {
    if (!checklistSimulation.visa) return '';
    const lines = [
      `Checklist Documental — ${checklistSimulation.visa.codigo} ${checklistSimulation.visa.nomePortugues}`,
      `Estrutura: 1 Titular${chkDependents > 0 ? ` + ${chkDependents} Dependente(s)` : ''} · Local: ${chkLocation === 'brasil' ? 'Solicitação do Brasil' : 'Solicitação dentro do Chile'}`,
      '',
      ...checklistSimulation.reqs.map((r, i) => {
        const flags = [
          r.obrigatorio ? 'Obrigatório' : 'Complementar',
          r.exigeApostila ? 'Apostilar (CNJ)' : null,
          r.exigeTraducao ? 'Traduzir (ES)' : null,
          r.validadeDias > 0 ? `Validade ${r.validadeDias}d` : null,
        ]
          .filter(Boolean)
          .join(' · ');
        return `${i + 1}. ${r.nomeDocumento} [${flags}]`;
      }),
    ];
    return lines.join('\n');
  }, [checklistSimulation, chkDependents, chkLocation]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ferramentas da Consultoria</h1>
          <p className="text-xs text-slate-500">
            Calculadoras operacionais exclusivas para prazos migratórios Chile/BR, câmbio multi-moeda e simulação de checklist
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {(
            [
              { id: 'prazos', label: 'Prazos Migratórios', icon: <CalendarPlus className="w-3.5 h-3.5" /> },
              { id: 'moedas', label: 'Câmbio & Custos', icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
              { id: 'checklist', label: 'Simulador Checklist', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
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

      {/* 1. Calculadora de Prazos Migratórios */}
      {tab === 'prazos' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-[var(--color-surface)] border border-slate-200 card-radius p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--color-primary)]" />
              <h2 className="text-base font-bold text-slate-900">Calculadora de Prazos Chile / SERMIG</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Regra / Marco Migratório</label>
                <select
                  value={ruleKey}
                  onChange={(e) => setRuleKey(e.target.value as DeadlineRuleKey)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-medium"
                >
                  {DEADLINE_RULES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.titulo}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">{deadlineCalc.rule.descricao}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {deadlineCalc.rule.modo === 'anteceder'
                    ? 'Data de Vencimento da Residência Atual'
                    : 'Data de Referência (Emissão / Entrada / Notificação)'}
                </label>
                <input
                  type="date"
                  value={baseDate}
                  onChange={(e) => setBaseDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium text-slate-500">
                  {deadlineCalc.rule.modo === 'anteceder' ? 'Abertura da Janela Legal' : 'Data Limite Calculada'}
                </p>
                <p className="text-xl font-bold text-slate-900 mt-1 tabular-nums">
                  {deadlineCalc.targetIso ? formatDateBR(deadlineCalc.targetIso) : '—'}
                </p>
                <p className="text-xs text-slate-600 mt-1 tabular-nums">
                  {deadlineCalc.daysLeft === null
                    ? '—'
                    : deadlineCalc.daysLeft < 0
                      ? `Passou há ${Math.abs(deadlineCalc.daysLeft)} dia(s)`
                      : `Faltam ${deadlineCalc.daysLeft} dia(s)`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-medium text-slate-500">Margem Operacional Recomendada</p>
                <p className="text-xl font-bold text-[var(--color-primary)] mt-1 tabular-nums">
                  {deadlineCalc.safeIso ? formatDateBR(deadlineCalc.safeIso) : '—'}
                </p>
                <p className="text-xs text-slate-600 mt-1">10 dias de folga preventiva antes do limite</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 bg-[var(--color-surface)] border border-slate-200 card-radius p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Registrar Prazo Direto no Caso</h3>
            <p className="text-xs text-slate-600">
              Vincule o prazo calculado diretamente a um caso ativo para acionar alertas automáticos na Central de Urgências.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Selecionar Caso Ativo</label>
              <select
                value={linkCaseId}
                onChange={(e) => setLinkCaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
              >
                <option value="">Escolha um caso...</option>
                {activeCases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <UiButton
                type="button"
                variant="primary"
                size="sm"
                disabled={!linkCaseId || !deadlineCalc.targetIso || savingDeadline}
                onClick={() => void handleSaveDeadlineToCase()}
              >
                <CalendarPlus className="w-3.5 h-3.5" />
                {savingDeadline ? 'Salvando...' : 'Salvar Prazo no Caso'}
              </UiButton>
              <UiButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  copyText(
                    'prazo_calc',
                    `${deadlineCalc.rule.titulo}: data de referência ${formatDateBR(baseDate)} -> limite ${formatDateBR(deadlineCalc.targetIso)} (margem preventiva: ${formatDateBR(deadlineCalc.safeIso)}).`,
                  )
                }
              >
                {copiedId === 'prazo_calc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'prazo_calc' ? 'Copiado!' : 'Copiar para WhatsApp'}
              </UiButton>
            </div>
          </div>
        </div>
      )}

      {/* 2. Conversor Multi-Moeda & Simulador de Custos */}
      {tab === 'moedas' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-[var(--color-surface)] border border-slate-200 card-radius p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Conversor Rápido (BRL / CLP / USD)</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Valor</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={convAmount}
                  onChange={(e) => setConvAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Moeda Base</label>
                <select
                  value={convCurrency}
                  onChange={(e) => setConvCurrency(e.target.value as CurrencyCode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  <option value="BRL">BRL (Real)</option>
                  <option value="CLP">CLP (Peso Chileno)</option>
                  <option value="USD">USD (Dólar)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Cotação 1 BRL em CLP</label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={rateBrlClp}
                  onChange={(e) => setRateBrlClp(Number(e.target.value) || defaultBrlClp)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 mb-1">Cotação 1 USD em BRL</label>
                <input
                  type="number"
                  min={0.5}
                  step="0.01"
                  value={rateUsdBrl}
                  onChange={(e) => setRateUsdBrl(Number(e.target.value) || defaultUsdBrl)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {(['BRL', 'CLP', 'USD'] as const).map((cur) => (
                <div key={cur} className="px-4 py-3 flex items-center justify-between bg-slate-50/70">
                  <span className="text-xs font-semibold text-slate-600">{cur}</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {formatCurrency(convertedValues[cur], cur)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-7 bg-[var(--color-surface)] border border-slate-200 card-radius p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">Estimador Rápido de Custos Familiares</h2>
              <UiButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  copyText(
                    'sim_custos',
                    `Estimativa Referencial (${costSimulation.pessoas} pessoa(s) · ${simType.toUpperCase()}):\n- Taxas SERMIG: ${formatCurrency(costSimulation.sermigUsd, 'USD')} (~${formatCurrency(costSimulation.sermigBrl, 'BRL')})\n- Apostilamentos (est.): ${formatCurrency(costSimulation.apostilasBrl, 'BRL')}\n- Traduções Juramentadas (est.): ${formatCurrency(costSimulation.traducoesBrl, 'BRL')}\n- Cédulas Registro Civil: ${formatCurrency(costSimulation.cedulasClp, 'CLP')}\n- Honorários consultoria: ${formatCurrency(simHonorariosBrl, 'BRL')}\nTotal aproximado: ${formatCurrency(costSimulation.totalGeralBrl, 'BRL')} (${formatCurrency(costSimulation.totalGeralClp, 'CLP')}).\n*Valores referenciais sujeitos à análise do caso.`,
                  )
                }
              >
                {copiedId === 'sim_custos' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId === 'sim_custos' ? 'Resumo Copiado!' : 'Copiar Resumo WhatsApp'}
              </UiButton>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Enquadramento</label>
                <select
                  value={simType}
                  onChange={(e) => setSimType(e.target.value as 'mercosul' | 'temporal' | 'definitiva')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  <option value="mercosul">Mercosul</option>
                  <option value="temporal">Temporal Geral</option>
                  <option value="definitiva">Definitiva</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Adultos</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={simAdults}
                  onChange={(e) => setSimAdults(Math.max(1, Number(e.target.value) || 1))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Menores</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={simMinors}
                  onChange={(e) => setSimMinors(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Honorários (BRL)</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={simHonorariosBrl}
                  onChange={(e) => setSimHonorariosBrl(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl text-xs">
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Taxas SERMIG ({costSimulation.pessoas}x)</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(costSimulation.sermigUsd, 'USD')} ({formatCurrency(costSimulation.sermigBrl, 'BRL')})
                </span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Apostilas CNJ estimadas (~3 docs/pessoa)</span>
                <span className="font-semibold tabular-nums">{formatCurrency(costSimulation.apostilasBrl, 'BRL')}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Traduções Juramentadas estimadas</span>
                <span className="font-semibold tabular-nums">{formatCurrency(costSimulation.traducoesBrl, 'BRL')}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between">
                <span className="text-slate-600">Cédulas de Identidade Chile</span>
                <span className="font-semibold tabular-nums">{formatCurrency(costSimulation.cedulasClp, 'CLP')}</span>
              </div>
              <div className="px-4 py-3 flex justify-between bg-slate-50 font-bold text-slate-900">
                <span>Total Estimado (Taxas + Terceiros + Honorários)</span>
                <span className="tabular-nums text-[var(--color-primary)]">
                  {formatCurrency(costSimulation.totalGeralBrl, 'BRL')} · {formatCurrency(costSimulation.totalGeralClp, 'CLP')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Simulador de Checklist Documental */}
      {tab === 'checklist' && (
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subcategoria / Visto</label>
                <select
                  value={selectedVisaId}
                  onChange={(e) => setSelectedVisaId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  {activeVisas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.codigo} - {v.nomePortugues}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dependentes</label>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={chkDependents}
                  onChange={(e) => setChkDependents(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Onde iniciará</label>
                <select
                  value={chkLocation}
                  onChange={(e) => setChkLocation(e.target.value as 'brasil' | 'chile')}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs"
                >
                  <option value="brasil">Do Brasil (Consular/Online)</option>
                  <option value="chile">Já no Chile</option>
                </select>
              </div>
            </div>
            <UiButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => copyText('chk_sim', checklistFormattedText)}
            >
              {copiedId === 'chk_sim' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedId === 'chk_sim' ? 'Checklist Copiado!' : 'Copiar Checklist'}
            </UiButton>
          </div>

          {checklistSimulation.visa && (
            <div className="space-y-3">
              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                <span className="font-bold text-slate-900">
                  {checklistSimulation.visa.codigo} — {checklistSimulation.visa.nomePortugues}
                </span>
                <span aria-hidden="true">·</span>
                <span>Dentro do Chile: {checklistSimulation.visa.permiteDentroChile}</span>
                <span aria-hidden="true">·</span>
                <span>Vigência: {checklistSimulation.visa.vigenciaMeses} meses</span>
                <span aria-hidden="true">·</span>
                <span>{checklistSimulation.reqs.length} documento(s) base por titular</span>
              </div>

              {checklistSimulation.reqs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  Nenhum requisito específico cadastrado para esta subcategoria ainda. Cadastre na aba Base Legal &amp; Vistos.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 pr-3 font-semibold">Ordem</th>
                        <th className="py-2 pr-3 font-semibold">Documento</th>
                        <th className="py-2 pr-3 font-semibold">Categoria</th>
                        <th className="py-2 pr-3 font-semibold">Exigências</th>
                        <th className="py-2 text-right font-semibold">Validade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {checklistSimulation.reqs.map((req) => (
                        <tr key={req.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 pr-3 tabular-nums font-semibold text-slate-700">
                            {String(req.ordemPrioridadeEmissao).padStart(2, '0')}
                          </td>
                          <td className="py-2.5 pr-3 font-medium text-slate-900">{req.nomeDocumento}</td>
                          <td className="py-2.5 pr-3 text-slate-600">{req.categoriaDoc}</td>
                          <td className="py-2.5 pr-3 text-slate-600">
                            {[
                              req.obrigatorio ? 'Obrigatório' : 'Opcional',
                              req.exigeApostila ? 'Apostila' : null,
                              req.exigeTraducao ? 'Tradução ES' : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </td>
                          <td className="py-2.5 text-right tabular-nums text-slate-600">
                            {req.validadeDias > 0 ? `${req.validadeDias} dias` : 'Sem vencimento'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
