import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  CopyPlus,
  Download,
  FileText,
  MessageCircle,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  clearAiDraftCache,
  loadAiDraftCache,
  sanitizeClientAiError,
  saveAiDraftCache,
  type AiResponseMeta,
} from '../../utils/aiClient';
import { translateAppError } from '../../services/errorService';
import {
  cleanupServerUploadUrl,
  deleteDocumentAudited,
  makeId,
  saveDocumentAudited,
  saveEmpresaConfigAdmin,
  setClientPortalAccessAudited,
  callAiEndpoint,
} from '../../services/firestoreService';
import { normalizePaidModality } from '../../utils/portalAccess';
import {
  BUDGET_PRESET_TEMPLATES,
  calculateBudgetTotals,
  computeBudgetMetrics,
  convertBudgetSummaryCurrencies,
  formatBudgetWhatsAppMessage,
  generateNextBudgetNumber,
  getBudgetValidityState,
  type BudgetPresetTemplate,
} from '../../utils/budgetUtils';
import {
  computeFinancialMetrics,
  formatPaymentReminderWhatsApp,
  generateInstallments,
  getEffectiveFinancialStatus,
  normalizeExchangeRates,
  type ThirdPartyCostEstimate,
  type ThirdPartyCostInput,
} from '../../utils/financeUtils';
import { ConfirmActionModal } from '../ui/DesignSystem';
import { ContractGeneratorModal } from './ContractGeneratorModal';
import { BudgetPrintModal } from './BudgetPrintModal';
import { CustosReferenciaisTab } from './CustosReferenciaisTab';
import type {
  Budget,
  BudgetItem,
  Case,
  Client,
  CurrencyCode,
  CustosPadrao,
  Dependent,
  DocumentTemplate,
  EmpresaConfig,
  FinancialRecord,
  GeneratedDocument,
  PaidConsultancyModality,
  UserProfile,
  UserRole,
} from '../../types/domain';
import {
  buildWhatsAppUrl,
  exportToCSV,
  formatCurrency,
  formatDateBR,
  openExternalSafe,
  toIsoDate,
} from '../../utils/formatters';

interface PainelFinanceiroProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  clients: Client[];
  cases: Case[];
  dependents?: Dependent[];
  budgets: Budget[];
  financialRecords: FinancialRecord[];
  documentTemplates: DocumentTemplate[];
  generatedDocuments: GeneratedDocument[];
  onRefresh: () => Promise<void>;
  onRefreshPublic: () => Promise<void>;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
  sectionGroup?: 'financeiro' | 'contratos' | 'todos';
}

type FinTab = 'orcamentos' | 'lancamentos' | 'documentos' | 'custos';

const DEFAULT_BUDGET_ITEMS = (): BudgetItem[] => [
  {
    id: makeId('bi'),
    descricao: 'Etapa 1 — Análise Técnica e Estruturação Documental',
    etapaVinculada: 'Etapa 1–3',
    valorHonorarios: 1800,
    taxasEstimadasTerceiros: 350,
    moeda: 'BRL',
    statusEtapa: 'Concluída/Faturável',
  },
  {
    id: makeId('bi'),
    descricao: 'Etapa 2 — Conferência Final, Protocolo SERMIG e Acompanhamento',
    etapaVinculada: 'Etapa 4–9',
    valorHonorarios: 1800,
    taxasEstimadasTerceiros: 450,
    moeda: 'BRL',
    statusEtapa: 'Aguardando',
  },
];

export const PainelFinanceiro: React.FC<PainelFinanceiroProps> = ({
  role,
  userProfile,
  empresa,
  clients,
  cases,
  dependents = [],
  budgets,
  financialRecords,
  documentTemplates,
  generatedDocuments,
  onRefresh,
  onRefreshPublic,
  onLogWhatsApp,
  sectionGroup = 'todos',
}) => {
  const [tab, setTab] = useState<FinTab>(sectionGroup === 'contratos' ? 'documentos' : 'orcamentos');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    col: 'budgets' | 'financialRecords' | 'generatedDocuments';
    id: string;
    label: string;
    item: Budget | FinancialRecord | GeneratedDocument;
    fileUrl?: string;
  } | null>(null);

  useEffect(() => {
    if (sectionGroup === 'contratos') {
      setTab('documentos');
    } else if (sectionGroup === 'financeiro') {
      setTab((prev) => (prev === 'documentos' ? 'orcamentos' : prev));
    }
  }, [sectionGroup]);

  const exchangeRates = useMemo(
    () => normalizeExchangeRates({ brlClp: empresa.taxaCambioBrlClp, usdBrl: empresa.taxaCambioUsdBrl }),
    [empresa.taxaCambioBrlClp, empresa.taxaCambioUsdBrl],
  );

  // ===========================================================================
  // Filtros e estados da Aba Orçamentos
  // ===========================================================================
  const [budgetSearch, setBudgetSearch] = useState('');
  const [budgetStatusFilter, setBudgetStatusFilter] = useState<'Todos' | Budget['status']>('Todos');
  const [copiedBudgetId, setCopiedBudgetId] = useState<string | null>(null);
  const [previewBudget, setPreviewBudget] = useState<Budget | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);

  // Modal Criar / Editar Orçamento
  const [budgetModal, setBudgetModal] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [bNumero, setBNumero] = useState('');
  const [bClientId, setBClientId] = useState(clients[0]?.id || '');
  const [bCaseId, setBCaseId] = useState('');
  const [bTitulo, setBTitulo] = useState('Assessoria Residência Temporal Mercosul');
  const [bModalidade, setBModalidade] = useState<PaidConsultancyModality>('completa');
  const [bTipoCobranca, setBTipoCobranca] = useState<Budget['tipoCobranca']>('Por Etapa Realizada');
  const [bMoeda, setBMoeda] = useState<CurrencyCode>('BRL');
  const [bDesconto, setBDesconto] = useState(0);
  const [bCondicoes, setBCondicoes] = useState('50% na assinatura + 50% no protocolo SERMIG (Pix, Cartão ou Transferência).');
  const [bValidade, setBValidade] = useState(() => toIsoDate(new Date(Date.now() + 15 * 86400000)));
  const [bStatus, setBStatus] = useState<Budget['status']>('Enviado ao Cliente');
  const [bItems, setBItems] = useState<BudgetItem[]>(DEFAULT_BUDGET_ITEMS);

  // ===========================================================================
  // Filtros e estados da Aba Lançamentos
  // ===========================================================================
  const [finSearch, setFinSearch] = useState('');
  const [finStatusFilter, setFinStatusFilter] = useState<'Todos' | FinancialRecord['status']>('Todos');
  const [finTipoFilter, setFinTipoFilter] = useState<'Todos' | FinancialRecord['tipo']>('Todos');
  const [finMoedaFilter, setFinMoedaFilter] = useState<'Todas' | CurrencyCode>('Todas');
  const [syncingOverdue, setSyncingOverdue] = useState(false);
  const [savingFin, setSavingFin] = useState(false);

  // Modal Criar / Editar Lançamento Financeiro
  const [finModal, setFinModal] = useState(false);
  const [editingFinId, setEditingFinId] = useState<string | null>(null);
  const [fClientId, setFClientId] = useState(clients[0]?.id || '');
  const [fCaseId, setFCaseId] = useState('');
  const [fTipo, setFTipo] = useState<FinancialRecord['tipo']>('Honorários');
  const [fDesc, setFDesc] = useState('');
  const [fMoeda, setFMoeda] = useState<CurrencyCode>('BRL');
  const [fValor, setFValor] = useState(0);
  const [fVenc, setFVenc] = useState(() => toIsoDate(new Date(Date.now() + 5 * 86400000)));
  const [fStatus, setFStatus] = useState<FinancialRecord['status']>('Pendente');
  const [fForma, setFForma] = useState<NonNullable<FinancialRecord['formaPagamento']>>('Pix');
  const [fParcelas, setFParcelas] = useState(1);

  // Modal Unificado de Contratos, Recibos & Documentos Gerados
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [editingGenDoc, setEditingGenDoc] = useState<GeneratedDocument | null>(null);
  const [receiptFinRecord, setReceiptFinRecord] = useState<FinancialRecord | null>(null);

  // IA Custos Referenciais
  const [aiCustosLoading, setAiCustosLoading] = useState(false);
  const [aiCustosProgress, setAiCustosProgress] = useState<string | null>(null);
  const [aiCustosError, setAiCustosError] = useState<string | null>(null);
  const [approvingCustos, setApprovingCustos] = useState(false);
  const [custosDraft, setCustosDraft] = useState<(CustosPadrao & AiResponseMeta) | null>(null);

  useEffect(() => {
    const cached = loadAiDraftCache<CustosPadrao & AiResponseMeta>('custos_padrao');
    if (cached) setCustosDraft(cached);
  }, []);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const caseMap = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases]);

  const financeMetrics = useMemo(
    () => computeFinancialMetrics(financialRecords, exchangeRates),
    [financialRecords, exchangeRates],
  );
  const budgetMetrics = useMemo(() => computeBudgetMetrics(budgets), [budgets]);

  const implicitlyOverdueRecords = useMemo(
    () => financialRecords.filter((f) => getEffectiveFinancialStatus(f).isImplicitlyOverdue),
    [financialRecords],
  );

  const clientCasesForBudget = useMemo(
    () => (bClientId ? cases.filter((c) => c.clientId === bClientId) : cases),
    [cases, bClientId],
  );

  const clientCasesForFin = useMemo(
    () => (fClientId ? cases.filter((c) => c.clientId === fClientId) : cases),
    [cases, fClientId],
  );

  const modalBudgetTotals = useMemo(() => calculateBudgetTotals(bItems, bDesconto), [bItems, bDesconto]);
  const modalBudgetConverted = useMemo(
    () => convertBudgetSummaryCurrencies(modalBudgetTotals.totalGeral, bMoeda, exchangeRates),
    [modalBudgetTotals.totalGeral, bMoeda, exchangeRates],
  );

  const installmentPreview = useMemo(() => {
    if (editingFinId || fParcelas <= 1 || fValor <= 0) return [];
    return generateInstallments({
      descricaoBase: fDesc || fTipo,
      valorTotal: fValor,
      parcelas: fParcelas,
      primeiroVencimento: fVenc,
      moeda: fMoeda,
    });
  }, [editingFinId, fParcelas, fValor, fDesc, fTipo, fVenc, fMoeda]);

  const filteredBudgets = useMemo(() => {
    const q = budgetSearch.trim().toLowerCase();
    return [...budgets]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .filter((b) => {
        if (budgetStatusFilter !== 'Todos' && b.status !== budgetStatusFilter) return false;
        if (!q) return true;
        const cl = b.clientId ? clientMap.get(b.clientId)?.nomeCompleto || '' : '';
        return (
          b.numeroOrcamento.toLowerCase().includes(q) ||
          b.titulo.toLowerCase().includes(q) ||
          cl.toLowerCase().includes(q) ||
          b.tipoCobranca.toLowerCase().includes(q)
        );
      });
  }, [budgets, budgetSearch, budgetStatusFilter, clientMap]);

  const filteredFinancials = useMemo(() => {
    const q = finSearch.trim().toLowerCase();
    return [...financialRecords]
      .sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''))
      .filter((f) => {
        const eff = getEffectiveFinancialStatus(f).effectiveStatus;
        if (finStatusFilter !== 'Todos' && eff !== finStatusFilter) return false;
        if (finTipoFilter !== 'Todos' && f.tipo !== finTipoFilter) return false;
        if (finMoedaFilter !== 'Todas' && f.moeda !== finMoedaFilter) return false;
        if (!q) return true;
        const cl = f.clientId ? clientMap.get(f.clientId)?.nomeCompleto || '' : '';
        return (
          f.descricao.toLowerCase().includes(q) ||
          cl.toLowerCase().includes(q) ||
          f.tipo.toLowerCase().includes(q) ||
          (f.reciboNumero || '').toLowerCase().includes(q)
        );
      });
  }, [financialRecords, finSearch, finStatusFilter, finTipoFilter, finMoedaFilter, clientMap]);

  // ===========================================================================
  // Helpers de Orçamentos (Criar, Editar, Presets, Duplicar, Faturar)
  // ===========================================================================
  const openNewBudgetModal = () => {
    setEditingBudgetId(null);
    setBNumero(generateNextBudgetNumber(budgets));
    const defaultClient = clients[0]?.id || '';
    setBClientId(defaultClient);
    setBCaseId('');
    setBTitulo('Assessoria Completa — Residência Temporal Acordo Mercosul');
    setBModalidade('completa');
    setBTipoCobranca('Por Etapa Realizada');
    setBMoeda('BRL');
    setBDesconto(0);
    setBCondicoes('50% na assinatura + 50% no protocolo SERMIG (Pix, Cartão ou Transferência).');
    setBValidade(toIsoDate(new Date(Date.now() + 15 * 86400000)));
    setBStatus('Enviado ao Cliente');
    setBItems(DEFAULT_BUDGET_ITEMS());
    setBudgetModal(true);
  };

  const openEditBudgetModal = (b: Budget) => {
    setEditingBudgetId(b.id);
    setBNumero(b.numeroOrcamento);
    setBClientId(b.clientId || '');
    setBCaseId(b.caseId || '');
    setBTitulo(b.titulo);
    setBModalidade(b.modalidadeConsultoria || 'completa');
    setBTipoCobranca(b.tipoCobranca);
    setBMoeda(b.moedaPrincipal || 'BRL');
    setBDesconto(Number(b.desconto || 0));
    setBCondicoes(b.condicoesPagamento || '');
    setBValidade(b.validade || toIsoDate(new Date(Date.now() + 15 * 86400000)));
    setBStatus(b.status);
    setBItems(b.itens.length > 0 ? b.itens.map((it) => ({ ...it })) : DEFAULT_BUDGET_ITEMS());
    setBudgetModal(true);
  };

  const applyBudgetPreset = (preset: BudgetPresetTemplate) => {
    setBTitulo(preset.titulo);
    setBModalidade(preset.modalidadeConsultoria);
    setBTipoCobranca(preset.tipoCobranca);
    setBMoeda(preset.moedaPrincipal);
    setBCondicoes(preset.condicoesPagamento);
    const items = preset.buildItems(empresa.custosPadrao, exchangeRates.usdBrl).map((it) => ({
      ...it,
      id: makeId('bi'),
    }));
    setBItems(items);
  };

  const handleCreateBudgetFromSimulation = ({
    input,
    estimate,
  }: {
    input: ThirdPartyCostInput;
    estimate: ThirdPartyCostEstimate;
  }) => {
    openNewBudgetModal();
    const labelMap: Record<ThirdPartyCostInput['visaType'], string> = {
      mercosul: 'Residência Temporal Mercosul',
      temporal: 'Residência Temporal',
      definitiva: 'Residência Definitiva',
    };
    const honRef = Math.max(1800, Number(empresa.honorariosPadraoMinBrl || 3600));
    const honEtapa1 = Math.round(honRef * 0.5);
    const honEtapa2 = Math.max(0, honRef - honEtapa1);
    setBTitulo(
      `Assessoria ${labelMap[input.visaType]} (${input.pessoas} ${input.pessoas === 1 ? 'pessoa' : 'pessoas'})`,
    );
    setBItems([
      {
        id: makeId('bi'),
        descricao: `Etapa 1 — Diagnóstico, Checklist e Documentação Brasil (${input.apostilasPorPessoa * input.pessoas} apostila(s)${input.paginasTraducaoTotal > 0 ? ` + ${input.paginasTraducaoTotal} pág. tradução` : ''})`,
        etapaVinculada: 'Etapa 1–4',
        valorHonorarios: honEtapa1,
        taxasEstimadasTerceiros: Math.round(estimate.apostilasBrl + estimate.traducoesBrl),
        moeda: 'BRL',
        statusEtapa: 'Concluída/Faturável',
      },
      {
        id: makeId('bi'),
        descricao: `Etapa 2 — Protocolo SERMIG (${input.pessoas}x · ${formatCurrency(estimate.sermigUsd, 'USD')})${input.incluirCedulaRut ? ' + Orientação PDI e Cédula RUT' : ''}`,
        etapaVinculada: 'Etapa 5–13',
        valorHonorarios: honEtapa2,
        taxasEstimadasTerceiros: Math.round(estimate.sermigBrl + estimate.cedulaBrl),
        moeda: 'BRL',
        statusEtapa: 'Aguardando',
      },
    ]);
    setTab('orcamentos');
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingBudget) return;
    if (bItems.length === 0) {
      setErrorMsg('Adicione pelo menos 1 etapa ou item ao orçamento.');
      return;
    }
    setSavingBudget(true);
    setErrorMsg(null);
    try {
      const normalizedItems: BudgetItem[] = bItems.map((it) => ({
        ...it,
        descricao: it.descricao.trim() || 'Etapa de Assessoria',
        etapaVinculada: it.etapaVinculada.trim() || 'Etapa única',
        valorHonorarios: Math.max(0, Number(it.valorHonorarios || 0)),
        taxasEstimadasTerceiros: Math.max(0, Number(it.taxasEstimadasTerceiros || 0)),
        moeda: bMoeda,
      }));
      const totals = calculateBudgetTotals(normalizedItems, bDesconto);
      const existing = editingBudgetId ? budgets.find((x) => x.id === editingBudgetId) : undefined;
      const id = existing?.id || makeId('orc');
      const numeroOrcamento = existing?.numeroOrcamento || bNumero || generateNextBudgetNumber(budgets);

      const payload: Budget = {
        ...(existing || {}),
        id,
        numeroOrcamento,
        clientId: bClientId || undefined,
        caseId: bCaseId || undefined,
        titulo: bTitulo.trim(),
        modalidadeConsultoria: bModalidade,
        tipoCobranca: bTipoCobranca,
        moedaPrincipal: bMoeda,
        taxaCambioBrlClp: exchangeRates.brlClp,
        taxaCambioUsdBrl: exchangeRates.usdBrl,
        itens: normalizedItems,
        desconto: totals.descontoAplicado,
        totalHonorarios: totals.totalHonorarios,
        totalTaxas: totals.totalTaxas,
        totalGeral: totals.totalGeral,
        condicoesPagamento: bCondicoes.trim(),
        validade: bValidade,
        status: bStatus,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDocumentAudited(
        'budgets',
        id,
        payload as unknown as Record<string, unknown>,
        !existing,
        role,
        existing ? 'editar_orcamento' : 'orcamento',
        existing,
      );
      setBudgetModal(false);
      setFeedback(
        existing
          ? `Orçamento ${numeroOrcamento} atualizado com sucesso.`
          : `Orçamento ${numeroOrcamento} criado (${bStatus}).`,
      );
      await onRefresh();
    } catch (err) {
      setErrorMsg(translateAppError(err, { path: 'budgets' }).message);
    } finally {
      setSavingBudget(false);
    }
  };

  const handleDuplicateBudget = async (source: Budget) => {
    setErrorMsg(null);
    try {
      const id = makeId('orc');
      const nextNum = generateNextBudgetNumber(budgets);
      const clone: Budget = {
        ...source,
        id,
        numeroOrcamento: nextNum,
        titulo: `${source.titulo} (Cópia)`,
        status: 'Rascunho',
        validade: toIsoDate(new Date(Date.now() + 15 * 86400000)),
        aprovadoEm: undefined,
        itens: source.itens.map((it) => ({
          ...it,
          id: makeId('bi'),
          statusEtapa: it.statusEtapa === 'Paga' ? 'Aguardando' : it.statusEtapa,
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await saveDocumentAudited('budgets', id, clone as unknown as Record<string, unknown>, true, role, 'duplicar_orcamento');
      setFeedback(`Orçamento duplicado como ${nextNum} (Rascunho).`);
      await onRefresh();
    } catch (err) {
      setErrorMsg(translateAppError(err, { path: 'budgets' }).message);
    }
  };

  const handleUpdateBudgetStatus = async (b: Budget, nextStatus: Budget['status']) => {
    setErrorMsg(null);
    try {
      await saveDocumentAudited(
        'budgets',
        b.id,
        {
          ...b,
          status: nextStatus,
          aprovadoEm: nextStatus === 'Aprovado' ? b.aprovadoEm || new Date().toISOString() : b.aprovadoEm,
          updatedAt: new Date().toISOString(),
        },
        false,
        role,
        'status_orcamento',
        b,
      );
      setFeedback(`Status de ${b.numeroOrcamento} atualizado para "${nextStatus}".`);
      await onRefresh();
    } catch (err) {
      setErrorMsg(translateAppError(err, { path: 'budgets' }).message);
    }
  };

  const handleFaturarItem = async (b: Budget, item: BudgetItem) => {
    setErrorMsg(null);
    try {
      const id = makeId('fin');
      const valor = Number(item.valorHonorarios || 0);
      const fin: FinancialRecord = {
        id,
        clientId: b.clientId,
        caseId: b.caseId,
        budgetId: b.id,
        tipo: 'Honorários',
        descricao: `${b.numeroOrcamento} — ${item.descricao}`,
        etapaReferencia: item.etapaVinculada,
        moeda: item.moeda || b.moedaPrincipal,
        valor,
        vencimento: toIsoDate(new Date(Date.now() + 5 * 86400000)),
        status: 'Pendente',
        formaPagamento: 'Pix',
        createdAt: new Date().toISOString(),
      };
      await saveDocumentAudited('financialRecords', id, fin as unknown as Record<string, unknown>, true, role, 'faturamento_etapa');
      const updatedItens = b.itens.map((x) => (x.id === item.id ? { ...x, statusEtapa: 'Paga' as const } : x));
      const allPaid = updatedItens.every((x) => x.statusEtapa === 'Paga');
      await saveDocumentAudited(
        'budgets',
        b.id,
        {
          ...b,
          itens: updatedItens,
          status: allPaid ? 'Aprovado' : 'Parcialmente Faturado',
          updatedAt: new Date().toISOString(),
        },
        false,
        role,
        'faturar_etapa',
        b,
      );
      setFeedback(`Lançamento financeiro criado para "${item.descricao}".`);
      await onRefresh();
    } catch (err) {
      setErrorMsg(translateAppError(err, { path: 'financialRecords' }).message);
    }
  };

  const handleFaturarRestante = async (b: Budget) => {
    const unpaid = b.itens.filter((it) => it.statusEtapa !== 'Paga' && Number(it.valorHonorarios || 0) > 0);
    if (unpaid.length === 0) return;
    setErrorMsg(null);
    try {
      for (let i = 0; i < unpaid.length; i += 1) {
        const item = unpaid[i];
        const id = makeId('fin');
        const fin: FinancialRecord = {
          id,
          clientId: b.clientId,
          caseId: b.caseId,
          budgetId: b.id,
          tipo: 'Honorários',
          descricao: `${b.numeroOrcamento} — ${item.descricao}`,
          etapaReferencia: item.etapaVinculada,
          moeda: item.moeda || b.moedaPrincipal,
          valor: Number(item.valorHonorarios || 0),
          vencimento: toIsoDate(new Date(Date.now() + (5 + i * 30) * 86400000)),
          status: 'Pendente',
          formaPagamento: 'Pix',
          createdAt: new Date().toISOString(),
        };
        await saveDocumentAudited('financialRecords', id, fin as unknown as Record<string, unknown>, true, role, 'faturamento_lote');
      }
      const updatedItens = b.itens.map((x) => ({ ...x, statusEtapa: 'Paga' as const }));
      await saveDocumentAudited(
        'budgets',
        b.id,
        { ...b, itens: updatedItens, status: 'Aprovado', updatedAt: new Date().toISOString() },
        false,
        role,
        'faturar_restante',
        b,
      );
      setFeedback(`${unpaid.length} etapa(s) de ${b.numeroOrcamento} faturada(s) em Lançamentos.`);
      await onRefresh();
    } catch (err) {
      setErrorMsg(translateAppError(err, { path: 'financialRecords' }).message);
    }
  };

  const handleCopyBudgetSummary = async (b: Budget) => {
    const clName = (b.clientId ? clientMap.get(b.clientId)?.nomeCompleto : undefined) || 'Cliente';
    const msg = formatBudgetWhatsAppMessage(b, clName, empresa.nome_empresa);
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedBudgetId(b.id);
      setTimeout(() => setCopiedBudgetId((prev) => (prev === b.id ? null : prev)), 2500);
    } catch {
      setErrorMsg('Não foi possível copiar o resumo automaticamente.');
    }
  };

  // ===========================================================================
  // Helpers de Lançamentos Financeiros (Criar, Parcelar, Editar, Dar Baixa)
  // ===========================================================================
  const openNewFinModal = () => {
    setEditingFinId(null);
    setFClientId(clients[0]?.id || '');
    setFCaseId('');
    setFTipo('Honorários');
    setFDesc('');
    setFMoeda('BRL');
    setFValor(0);
    setFVenc(toIsoDate(new Date(Date.now() + 5 * 86400000)));
    setFStatus('Pendente');
    setFForma('Pix');
    setFParcelas(1);
    setFinModal(true);
  };

  const openEditFinModal = (f: FinancialRecord) => {
    setEditingFinId(f.id);
    setFClientId(f.clientId || '');
    setFCaseId(f.caseId || '');
    setFTipo(f.tipo);
    setFDesc(f.descricao);
    setFMoeda(f.moeda);
    setFValor(Number(f.valor || 0));
    setFVenc(f.vencimento || toIsoDate(new Date()));
    setFStatus(f.status);
    setFForma(f.formaPagamento || 'Pix');
    setFParcelas(1);
    setFinModal(true);
  };

  const handleSaveFin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingFin) return;
    setSavingFin(true);
    setErrorMsg(null);
    try {
      if (editingFinId) {
        const existing = financialRecords.find((x) => x.id === editingFinId);
        if (!existing) return;
        const updated: FinancialRecord = {
          ...existing,
          clientId: fClientId || undefined,
          caseId: fCaseId || undefined,
          tipo: fTipo,
          descricao: fDesc.trim(),
          moeda: fMoeda,
          valor: Math.max(0, Number(fValor || 0)),
          vencimento: fVenc,
          status: fStatus,
          formaPagamento: fForma,
          dataPagamento: fStatus === 'Pago' ? existing.dataPagamento || toIsoDate(new Date()) : undefined,
          updatedAt: new Date().toISOString(),
        };
        await saveDocumentAudited(
          'financialRecords',
          existing.id,
          updated as unknown as Record<string, unknown>,
          false,
          role,
          'editar_lancamento',
          existing,
        );
        setFeedback('Lançamento financeiro atualizado.');
      } else {
        const installments = generateInstallments({
          descricaoBase: fDesc.trim() || fTipo,
          valorTotal: Math.max(0, Number(fValor || 0)),
          parcelas: fParcelas,
          primeiroVencimento: fVenc,
          moeda: fMoeda,
        });
        for (const inst of installments) {
          const id = makeId('fin');
          const fin: FinancialRecord = {
            id,
            clientId: fClientId || undefined,
            caseId: fCaseId || undefined,
            tipo: fTipo,
            descricao: inst.descricao,
            moeda: fMoeda,
            valor: inst.valor,
            vencimento: inst.vencimento,
            status: installments.length === 1 ? fStatus : 'Pendente',
            formaPagamento: fForma,
            dataPagamento: installments.length === 1 && fStatus === 'Pago' ? toIsoDate(new Date()) : undefined,
            createdAt: new Date().toISOString(),
          };
          await saveDocumentAudited('financialRecords', id, fin as unknown as Record<string, unknown>, true, role, 'lancamento_financeiro');
        }
        setFeedback(
          installments.length > 1
            ? `${installments.length} parcelas cadastradas com vencimentos mensais.`
            : 'Lançamento financeiro cadastrado.',
        );
      }
      setFinModal(false);
      await onRefresh();
    } catch (err) {
      setErrorMsg(translateAppError(err, { path: 'financialRecords' }).message);
    } finally {
      setSavingFin(false);
    }
  };

  const handleQuickMarkPaid = async (f: FinancialRecord) => {
    setErrorMsg(null);
    try {
      await saveDocumentAudited(
        'financialRecords',
        f.id,
        {
          ...f,
          status: 'Pago',
          dataPagamento: toIsoDate(new Date()),
          formaPagamento: f.formaPagamento || 'Pix',
          updatedAt: new Date().toISOString(),
        },
        false,
        role,
        'baixa_pagamento',
        f,
      );
      setFeedback(`Pagamento confirmado para "${f.descricao}".`);
      await onRefresh();
    } catch (err) {
      setErrorMsg(translateAppError(err, { path: 'financialRecords' }).message);
    }
  };

  const handleSyncOverdueRecords = async () => {
    if (implicitlyOverdueRecords.length === 0 || syncingOverdue) return;
    setSyncingOverdue(true);
    setErrorMsg(null);
    try {
      for (const rec of implicitlyOverdueRecords) {
        await saveDocumentAudited(
          'financialRecords',
          rec.id,
          { ...rec, status: 'Atrasado', updatedAt: new Date().toISOString() },
          false,
          role,
          'atualizar_atrasado',
          rec,
        );
      }
      setFeedback(`${implicitlyOverdueRecords.length} lançamento(s) vencido(s) marcado(s) como Atrasado.`);
      await onRefresh();
    } catch (err) {
      setErrorMsg(translateAppError(err, { path: 'financialRecords' }).message);
    } finally {
      setSyncingOverdue(false);
    }
  };

  // ===========================================================================
  // Recibo sequencial e abertura do gerador de contratos
  // ===========================================================================
  const openNewContractGenerator = () => {
    setEditingGenDoc(null);
    setReceiptFinRecord(null);
    setContractModalOpen(true);
  };

  const openReceiptFromRecord = async (fin: FinancialRecord) => {
    const seq =
      fin.reciboNumero ||
      `REC-${new Date().getFullYear()}-${String(generatedDocuments.filter((g) => g.tipo === 'recibo').length + 1).padStart(3, '0')}`;
    if (!fin.reciboNumero) {
      await saveDocumentAudited('financialRecords', fin.id, { ...fin, reciboNumero: seq }, false, role, 'reciboNumero');
    }
    setEditingGenDoc(null);
    setReceiptFinRecord({ ...fin, reciboNumero: seq });
    setContractModalOpen(true);
  };

  // ===========================================================================
  // Custos Referenciais (IA + Manual)
  // ===========================================================================
  const handleConsultarCustosIa = async (forceRefresh = false) => {
    if (aiCustosLoading) return;
    setAiCustosLoading(true);
    setAiCustosProgress(forceRefresh ? 'Consultando custos referenciais (atualização forçada)...' : 'Consultando custos referenciais...');
    setAiCustosError(null);
    setErrorMsg(null);
    try {
      const res = await callAiEndpoint<CustosPadrao & AiResponseMeta>(
        '/api/ai/custos',
        { currentCustos: empresa.custosPadrao },
        { onProgress: (msg) => setAiCustosProgress(msg), bypassCache: forceRefresh },
      );
      setCustosDraft(res);
      saveAiDraftCache('custos_padrao', res);
    } catch (err) {
      const msg = sanitizeClientAiError(err);
      setAiCustosError(msg);
      setErrorMsg(msg);
    } finally {
      setAiCustosLoading(false);
      setAiCustosProgress(null);
    }
  };

  const handleApproveCustos = async () => {
    if (!custosDraft || role !== 'admin' || approvingCustos) return;
    setApprovingCustos(true);
    setAiCustosError(null);
    setErrorMsg(null);
    try {
      const {
        rascunho: _r,
        estimativa: _e,
        fallback: _f,
        origem: _o,
        origemLabel: _ol,
        modeloUsado: _m,
        tentativas: _t,
        mensagemUsuario: _mu,
        ...pureCustos
      } = custosDraft;
      const nextCfg: EmpresaConfig = {
        ...empresa,
        custosPadrao: { ...pureCustos, fonteObservacao: 'Aprovado pelo administrador a partir da estimativa referencial' },
      };
      await saveEmpresaConfigAdmin(nextCfg, empresa);
      setCustosDraft(null);
      clearAiDraftCache('custos_padrao');
      setFeedback('Tabela de custos de referência atualizada em Configurações!');
      await onRefreshPublic();
    } catch (err) {
      const translated = translateAppError(err, { path: 'config/empresa' });
      const msg = translated.actionHint ? `${translated.title}: ${translated.message} ${translated.actionHint}` : translated.message;
      setAiCustosError(msg);
      setErrorMsg(msg);
    } finally {
      setApprovingCustos(false);
    }
  };

  const handleSaveManualCustos = async (payload: {
    custosPadrao: CustosPadrao;
    taxaCambioBrlClp: number;
    taxaCambioUsdBrl: number;
    honorariosPadraoMinBrl?: number;
    honorariosPadraoMaxBrl?: number;
  }) => {
    setErrorMsg(null);
    try {
      const nextCfg: EmpresaConfig = {
        ...empresa,
        custosPadrao: payload.custosPadrao,
        taxaCambioBrlClp: payload.taxaCambioBrlClp,
        taxaCambioUsdBrl: payload.taxaCambioUsdBrl,
        honorariosPadraoMinBrl: payload.honorariosPadraoMinBrl,
        honorariosPadraoMaxBrl: payload.honorariosPadraoMaxBrl,
      };
      await saveEmpresaConfigAdmin(nextCfg, empresa);
      setFeedback('Tabela de custos referenciais e câmbio atualizada com sucesso!');
      await onRefreshPublic();
    } catch (err) {
      const translated = translateAppError(err, { path: 'config/empresa' });
      setErrorMsg(translated.actionHint ? `${translated.title}: ${translated.message}` : translated.message);
    }
  };

  if (role === 'assistente') {
    return (
      <div
        className="border border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-[#0D1422]"
        style={{ borderRadius: 'var(--card-radius, 12px)' }}
      >
        Acesso restrito: este perfil não possui permissão para visualizar ou editar dados financeiros.
      </div>
    );
  }

  const maxMonthlyVal = Math.max(
    1,
    ...financeMetrics.monthlySeries.map((m) => m.recebidoBrl + m.previstoBrl),
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho do Módulo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {sectionGroup === 'contratos'
              ? 'Contratos, Recibos & Termos Oficiais'
              : sectionGroup === 'financeiro'
                ? 'Financeiro, Orçamentos & Custos'
                : 'Financeiro, Orçamentos & Contratos'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {sectionGroup === 'contratos'
              ? 'Emissão com QR verificador, assinatura eletrônica, liberação no Portal e histórico de versões'
              : `Gestão multimoeda (BRL · USD · CLP) · Câmbio base 1 USD = R$ ${exchangeRates.usdBrl.toFixed(2)} · 1 BRL = ${exchangeRates.brlClp} CLP`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sectionGroup === 'contratos' ? (
            <button
              type="button"
              onClick={openNewContractGenerator}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Gerar Novo Contrato / Documento
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={openNewBudgetModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Orçamento
              </button>
              <button
                type="button"
                onClick={openNewFinModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Novo Lançamento
              </button>
              <button
                type="button"
                onClick={() =>
                  exportToCSV(
                    tab === 'orcamentos' ? 'orcamentos-dm-integra' : 'financeiro-dm-integra',
                    tab === 'orcamentos'
                      ? ['Número', 'Cliente', 'Título', 'Modelo', 'Moeda', 'Honorários', 'Taxas Est.', 'Desconto', 'Total', 'Validade', 'Status']
                      : ['Cliente', 'Tipo', 'Descrição', 'Forma', 'Moeda', 'Valor', 'Vencimento', 'Pagamento', 'Status'],
                    tab === 'orcamentos'
                      ? filteredBudgets.map((b) => [
                          b.numeroOrcamento,
                          clientMap.get(b.clientId || '')?.nomeCompleto || '',
                          b.titulo,
                          b.tipoCobranca,
                          b.moedaPrincipal,
                          b.totalHonorarios,
                          b.totalTaxas,
                          b.desconto,
                          b.totalGeral,
                          formatDateBR(b.validade),
                          b.status,
                        ])
                      : filteredFinancials.map((f) => [
                          clientMap.get(f.clientId || '')?.nomeCompleto || '',
                          f.tipo,
                          f.descricao,
                          f.formaPagamento || '',
                          f.moeda,
                          f.valor,
                          formatDateBR(f.vencimento),
                          f.dataPagamento ? formatDateBR(f.dataPagamento) : '',
                          getEffectiveFinancialStatus(f).effectiveStatus,
                        ]),
                  )
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPIs Consolidados + Resumo por Moeda */}
      {sectionGroup !== 'contratos' && (
        <div className="space-y-3 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Recebido Consolidado (BRL)</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#1E7E34] dark:text-emerald-400">
                {formatCurrency(financeMetrics.consolidatedBrl.recebido, 'BRL')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {financeMetrics.paidCount} pago(s) · Adimplência {financeMetrics.collectionRatePct}%
              </p>
            </div>

            <div className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">A Receber (Em Dia)</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(financeMetrics.consolidatedBrl.pendente, 'BRL')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {financeMetrics.pendingCount} pendente(s)
                {financeMetrics.dueSoonCount > 0 ? ` · ${financeMetrics.dueSoonCount} vence(m) em 7d` : ''}
              </p>
            </div>

            <div className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Em Atraso / Vencidos</p>
              <p
                className={`text-xl font-bold font-mono tabular-nums ${
                  financeMetrics.consolidatedBrl.atrasado > 0
                    ? 'text-[#C82333] dark:text-red-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {formatCurrency(financeMetrics.consolidatedBrl.atrasado, 'BRL')}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {financeMetrics.overdueCount} lançamento(s) em atraso
              </p>
            </div>

            <div className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Orçamentos em Negociação</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {formatCurrency(
                  budgetMetrics.valorAbertoPorMoeda.BRL +
                    budgetMetrics.valorAbertoPorMoeda.USD * exchangeRates.usdBrl +
                    budgetMetrics.valorAbertoPorMoeda.CLP / exchangeRates.brlClp,
                  'BRL',
                )}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {budgetMetrics.enviadosCount} enviado(s) · {budgetMetrics.aprovadosCount} aprovado(s) ({budgetMetrics.taxaAprovacaoPct}%)
              </p>
            </div>
          </div>

          {/* Linha compacta por moeda original */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {(['BRL', 'USD', 'CLP'] as CurrencyCode[]).map((cur) => {
              const bucket = financeMetrics.byCurrency[cur];
              return (
                <div
                  key={cur}
                  className="bg-slate-50/80 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Caixa {cur}</span>
                  <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    Rec. <strong className="text-[#1E7E34] dark:text-emerald-400">{formatCurrency(bucket.recebido, cur)}</strong> · Pend.{' '}
                    {formatCurrency(bucket.pendente + bucket.atrasado, cur)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-abas */}
      {sectionGroup !== 'contratos' && (
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 dark:border-slate-800 no-print">
          {[
            { id: 'orcamentos', label: `Orçamentos & Propostas (${budgets.length})` },
            { id: 'lancamentos', label: `Lançamentos & Fluxo (${financialRecords.length})` },
            ...(sectionGroup === 'todos' ? [{ id: 'documentos', label: `Contratos & Recibos (${generatedDocuments.length})` }] : []),
            { id: 'custos', label: 'Custos, Câmbio & Simulador' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as FinTab)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)] dark:text-[#60A5FA]'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-900 dark:text-emerald-200 font-medium flex items-center justify-between gap-2 no-print">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} aria-label="Fechar aviso" className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-[#C82333] dark:text-red-300 font-medium flex items-center justify-between gap-2 no-print">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} aria-label="Fechar erro" className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 1: ORÇAMENTOS & PROPOSTAS */}
      {/* ===================================================================== */}
      {tab === 'orcamentos' && (
        <div className="space-y-4">
          {/* Barra de Busca e Filtros */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 no-print">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={budgetSearch}
                onChange={(e) => setBudgetSearch(e.target.value)}
                placeholder="Buscar por número (ORC-...), cliente ou título da proposta..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
              {(['Todos', 'Rascunho', 'Enviado ao Cliente', 'Aprovado', 'Parcialmente Faturado', 'Recusado'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setBudgetStatusFilter(st)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      budgetStatusFilter === st
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ),
              )}
            </div>
          </div>

          {budgetMetrics.vencidosCount > 0 || budgetMetrics.vencendoEmBreveCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg px-4 py-2.5 no-print">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Atenção à validade comercial: {budgetMetrics.vencidosCount} proposta(s) vencida(s) ·{' '}
                {budgetMetrics.vencendoEmBreveCount} vence(m) nos próximos 5 dias.
              </span>
            </div>
          ) : null}

          {filteredBudgets.length === 0 ? (
            <div className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {budgets.length === 0
                  ? 'Nenhum orçamento cadastrado ainda. Use modelos prontos ou crie uma proposta personalizada.'
                  : 'Nenhum orçamento encontrado com os filtros selecionados.'}
              </p>
              {budgets.length === 0 && (
                <button
                  type="button"
                  onClick={openNewBudgetModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Criar Primeiro Orçamento
                </button>
              )}
            </div>
          ) : (
            filteredBudgets.map((b) => {
              const cl = b.clientId ? clientMap.get(b.clientId) : undefined;
              const linkedCase = b.caseId ? caseMap.get(b.caseId) : undefined;
              const totals = calculateBudgetTotals(b.itens, b.desconto);
              const validity = getBudgetValidityState(b.validade, b.status);
              const converted = convertBudgetSummaryCurrencies(totals.totalGeral, b.moedaPrincipal, {
                brlClp: b.taxaCambioBrlClp || exchangeRates.brlClp,
                usdBrl: b.taxaCambioUsdBrl || exchangeRates.usdBrl,
              });
              const unpaidCount = b.itens.filter((it) => it.statusEtapa !== 'Paga').length;
              const progressPct =
                totals.etapasTotais > 0 ? Math.round((totals.etapasPagas / totals.etapasTotais) * 100) : 0;

              return (
                <div
                  key={b.id}
                  className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4"
                >
                  {/* Cabeçalho do Orçamento */}
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{b.numeroOrcamento}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-sans">{b.tipoCobranca}</span>
                        {b.modalidadeConsultoria && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-sans">
                              {b.modalidadeConsultoria === 'completa' ? 'Consultoria Completa' : 'Consultoria Orientativa'}
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            validity.state === 'vencido'
                              ? 'text-[#C82333] dark:text-red-400 font-sans font-semibold'
                              : validity.state === 'vence_em_breve'
                                ? 'text-amber-700 dark:text-amber-400 font-sans font-semibold'
                                : 'font-sans'
                          }
                        >
                          Validade {formatDateBR(b.validade)} ({validity.label})
                        </span>
                      </div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{b.titulo}</h2>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Cliente: <strong className="text-slate-900 dark:text-white">{cl?.nomeCompleto || '—'}</strong>
                        {linkedCase ? ` · Caso: ${linkedCase.titulo}` : ''}
                      </p>
                    </div>

                    <div className="text-left sm:text-right space-y-0.5 shrink-0">
                      <p className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                        {formatCurrency(totals.totalGeral, b.moedaPrincipal)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        Honorários: {formatCurrency(totals.totalHonorarios, b.moedaPrincipal)} · Taxas est.:{' '}
                        {formatCurrency(totals.totalTaxas, b.moedaPrincipal)}
                        {totals.descontoAplicado > 0
                          ? ` · Desc.: -${formatCurrency(totals.descontoAplicado, b.moedaPrincipal)}`
                          : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                        Ref.: {b.moedaPrincipal !== 'BRL' ? `${formatCurrency(converted.BRL, 'BRL')} · ` : ''}
                        {b.moedaPrincipal !== 'USD' ? `${formatCurrency(converted.USD, 'USD')} · ` : ''}
                        {b.moedaPrincipal !== 'CLP' ? formatCurrency(converted.CLP, 'CLP') : ''}
                      </p>
                    </div>
                  </div>

                  {/* Barra de progresso de faturamento */}
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                      <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1E7E34] dark:bg-emerald-500 transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {totals.etapasPagas}/{totals.etapasTotais} etapa(s) faturada(s)
                      </span>
                    </div>
                    {unpaidCount > 1 && (
                      <button
                        type="button"
                        onClick={() => void handleFaturarRestante(b)}
                        className="text-xs font-semibold text-[var(--color-primary)] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                      >
                        Faturar todas as {unpaidCount} etapas pendentes
                      </button>
                    )}
                  </div>

                  {/* Itens do Orçamento */}
                  <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                    {b.itens.map((item) => (
                      <div key={item.id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white">{item.descricao}</p>
                          <p className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                            <span className="font-sans">{item.etapaVinculada} · {item.statusEtapa}</span> · Honorários:{' '}
                            {formatCurrency(item.valorHonorarios, item.moeda || b.moedaPrincipal)} · Taxas est.:{' '}
                            {formatCurrency(item.taxasEstimadasTerceiros, item.moeda || b.moedaPrincipal)}
                          </p>
                        </div>
                        {item.statusEtapa !== 'Paga' ? (
                          <button
                            type="button"
                            onClick={() => void handleFaturarItem(b, item)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                          >
                            Faturar Etapa
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#1E7E34] dark:text-emerald-400 font-semibold whitespace-nowrap">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Faturada
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {b.condicoesPagamento && (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-800 dark:text-slate-200">Condições:</strong> {b.condicoesPagamento}
                    </p>
                  )}

                  {/* Ações do Orçamento */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 no-print">
                    <select
                      aria-label={`Status do orçamento ${b.numeroOrcamento}`}
                      value={b.status}
                      onChange={(e) => void handleUpdateBudgetStatus(b, e.target.value as Budget['status'])}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
                    >
                      <option value="Rascunho">Rascunho</option>
                      <option value="Enviado ao Cliente">Enviado ao Cliente</option>
                      <option value="Aprovado">Aprovado</option>
                      <option value="Parcialmente Faturado">Parcialmente Faturado</option>
                      <option value="Recusado">Recusado</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => openEditBudgetModal(b)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleDuplicateBudget(b)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <CopyPlus className="w-3.5 h-3.5" />
                      Duplicar
                    </button>

                    <button
                      type="button"
                      onClick={() => setPreviewBudget(b)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Proposta A4 / PDF
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCopyBudgetSummary(b)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedBudgetId === b.id ? 'Copiado!' : 'Copiar Resumo'}
                    </button>

                    {cl?.whatsapp && (
                      <button
                        type="button"
                        onClick={async () => {
                          const msg = formatBudgetWhatsAppMessage(b, cl.nomeCompleto, empresa.nome_empresa);
                          openExternalSafe(buildWhatsAppUrl(cl.whatsapp, msg));
                          await onLogWhatsApp(cl.id, b.caseId, `Orçamento ${b.numeroOrcamento}`, msg);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34] hover:bg-[#176429] whitespace-nowrap"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </button>
                    )}

                    {role === 'admin' && (
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            col: 'budgets',
                            id: b.id,
                            label: `orçamento ${b.numeroOrcamento}`,
                            item: b,
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-xs font-semibold text-[#C82333] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 ml-auto whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 2: LANÇAMENTOS & FLUXO DE CAIXA */}
      {/* ===================================================================== */}
      {tab === 'lancamentos' && (
        <div className="space-y-5">
          {/* Painel Visual: Fluxo Mensal (6 meses) + Distribuição por Categoria */}
          {financialRecords.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 no-print">
              <div className="lg:col-span-7 bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">Fluxo de Caixa Mensal (Consolidado BRL)</h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Recebido (verde) vs. Previsto/Em aberto (azul) por mês de referência
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2.5 items-end h-32 pt-2">
                  {financeMetrics.monthlySeries.map((m) => {
                    const recPct = Math.round((m.recebidoBrl / maxMonthlyVal) * 100);
                    const prevPct = Math.round((m.previstoBrl / maxMonthlyVal) * 100);
                    return (
                      <div key={m.monthKey} className="flex flex-col items-center gap-1.5 h-full justify-end">
                        <div className="w-full flex items-end justify-center gap-1 h-20">
                          <div
                            title={`Recebido ${m.label}: ${formatCurrency(m.recebidoBrl, 'BRL')}`}
                            className="w-3.5 rounded-t bg-[#1E7E34] dark:bg-emerald-500 transition-all"
                            style={{ height: `${Math.max(m.recebidoBrl > 0 ? 10 : 2, recPct)}%` }}
                          />
                          <div
                            title={`Previsto ${m.label}: ${formatCurrency(m.previstoBrl, 'BRL')}`}
                            className="w-3.5 rounded-t bg-slate-300 dark:bg-slate-600 transition-all"
                            style={{ height: `${Math.max(m.previstoBrl > 0 ? 10 : 2, prevPct)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {m.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-5 bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">Receita &amp; Custos por Categoria (BRL)</h2>
                <div className="space-y-2.5 text-xs">
                  {financeMetrics.byTypeBrl.map((entry) => {
                    const pct =
                      financeMetrics.consolidatedBrl.total > 0
                        ? Math.round((entry.totalBrl / financeMetrics.consolidatedBrl.total) * 100)
                        : 0;
                    return (
                      <div key={entry.tipo} className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-700 dark:text-slate-200">
                            {entry.tipo} <span className="text-slate-400">({entry.count})</span>
                          </span>
                          <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(entry.totalBrl, 'BRL')}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: 'var(--color-primary)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Alerta de parcelas vencidas ainda marcadas como Pendente */}
          {implicitlyOverdueRecords.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 text-xs text-[#C82333] dark:text-red-300 no-print">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {implicitlyOverdueRecords.length} lançamento(s) com vencimento ultrapassado ainda constam como &ldquo;Pendente&rdquo;.
                </span>
              </div>
              <button
                type="button"
                disabled={syncingOverdue}
                onClick={() => void handleSyncOverdueRecords()}
                className="px-3 py-1.5 rounded-lg bg-[#C82333] text-white font-semibold hover:opacity-95 disabled:opacity-50 whitespace-nowrap"
              >
                {syncingOverdue ? 'Atualizando...' : 'Marcar como Atrasado'}
              </button>
            </div>
          )}

          {/* Barra de Filtros de Lançamentos */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 no-print">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={finSearch}
                onChange={(e) => setFinSearch(e.target.value)}
                placeholder="Buscar por descrição, cliente ou recibo..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                {(['Todos', 'Pendente', 'Atrasado', 'Pago'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFinStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      finStatusFilter === st
                        ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <select
                aria-label="Filtrar por tipo de lançamento"
                value={finTipoFilter}
                onChange={(e) => setFinTipoFilter(e.target.value as 'Todos' | FinancialRecord['tipo'])}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="Todos">Todos os tipos</option>
                <option value="Honorários">Honorários</option>
                <option value="Taxa SERMIG">Taxa SERMIG</option>
                <option value="Apostila/Tradução">Apostila/Tradução</option>
                <option value="Despachante/Outros">Despachante/Outros</option>
              </select>
              <select
                aria-label="Filtrar por moeda"
                value={finMoedaFilter}
                onChange={(e) => setFinMoedaFilter(e.target.value as 'Todas' | CurrencyCode)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
              >
                <option value="Todas">Todas moedas</option>
                <option value="BRL">BRL</option>
                <option value="USD">USD</option>
                <option value="CLP">CLP</option>
              </select>
            </div>
          </div>

          {/* Tabela de Lançamentos */}
          <div className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-w-full">
            {filteredFinancials.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {financialRecords.length === 0
                    ? 'Nenhum lançamento registrado ainda.'
                    : 'Nenhum lançamento corresponde aos filtros aplicados.'}
                </p>
                {financialRecords.length === 0 && (
                  <button
                    type="button"
                    onClick={openNewFinModal}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Cadastrar Primeiro Lançamento
                  </button>
                )}
              </div>
            ) : (
              <table className="w-full min-w-[920px] text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60">
                    <th className="py-3 px-4 font-semibold">Descrição / Cliente</th>
                    <th className="py-3 px-4 font-semibold">Tipo &amp; Forma</th>
                    <th className="py-3 px-4 font-semibold">Vencimento</th>
                    <th className="py-3 px-4 font-semibold text-right">Valor</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredFinancials.map((f) => {
                    const cl = f.clientId ? clientMap.get(f.clientId) : undefined;
                    const dueInfo = getEffectiveFinancialStatus(f);
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900 dark:text-white text-xs">{f.descricao}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {cl?.nomeCompleto || 'Sem cliente vinculado'}
                            {f.dataPagamento && f.status === 'Pago' ? ` · Pago em ${formatDateBR(f.dataPagamento)}` : ''}
                          </p>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                          <p>{f.tipo}</p>
                          {f.formaPagamento && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{f.formaPagamento}</p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-mono tabular-nums whitespace-nowrap">
                          <p className="text-slate-800 dark:text-slate-200">{formatDateBR(f.vencimento)}</p>
                          {dueInfo.effectiveStatus === 'Atrasado' && dueInfo.daysUntilDue !== null && (
                            <p className="font-sans text-[11px] font-semibold text-[#C82333] dark:text-red-400">
                              Atrasado há {Math.abs(dueInfo.daysUntilDue)}d
                            </p>
                          )}
                          {dueInfo.effectiveStatus === 'Pendente' && dueInfo.daysUntilDue !== null && dueInfo.daysUntilDue <= 5 && (
                            <p className="font-sans text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              {dueInfo.daysUntilDue === 0 ? 'Vence hoje' : `Vence em ${dueInfo.daysUntilDue}d`}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs font-bold font-mono tabular-nums text-right text-slate-900 dark:text-white whitespace-nowrap">
                          {formatCurrency(f.valor, f.moeda)}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          <select
                            aria-label={`Status do lançamento ${f.descricao}`}
                            value={f.status}
                            onChange={async (e) => {
                              const status = e.target.value as FinancialRecord['status'];
                              await saveDocumentAudited(
                                'financialRecords',
                                f.id,
                                { ...f, status, dataPagamento: status === 'Pago' ? toIsoDate(new Date()) : f.dataPagamento },
                                false,
                                role,
                                'status_financeiro',
                                f,
                              );
                              await onRefresh();
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-xs font-semibold bg-white dark:bg-slate-900 ${
                              f.status === 'Pago'
                                ? 'border-emerald-300 dark:border-emerald-800 text-[#1E7E34] dark:text-emerald-400'
                                : dueInfo.effectiveStatus === 'Atrasado'
                                  ? 'border-red-300 dark:border-red-800 text-[#C82333] dark:text-red-400'
                                  : 'border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100'
                            }`}
                          >
                            <option value="Pendente">Pendente</option>
                            <option value="Pago">Pago</option>
                            <option value="Atrasado">Atrasado</option>
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap justify-end items-center gap-1.5">
                            {f.status !== 'Pago' && (
                              <button
                                type="button"
                                onClick={() => void handleQuickMarkPaid(f)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E7E34] text-white text-xs font-semibold hover:bg-[#176429] whitespace-nowrap"
                              >
                                <Check className="w-3 h-3" />
                                Dar Baixa
                              </button>
                            )}
                            {f.status !== 'Pago' && cl?.whatsapp && (
                              <button
                                type="button"
                                onClick={async () => {
                                  const msg = formatPaymentReminderWhatsApp(f, cl.nomeCompleto, empresa.chavePix);
                                  openExternalSafe(buildWhatsAppUrl(cl.whatsapp, msg));
                                  await onLogWhatsApp(cl.id, f.caseId, `Lembrete de Pagamento — ${f.descricao}`, msg);
                                }}
                                title="Enviar lembrete cordial no WhatsApp"
                                aria-label={`Enviar lembrete de pagamento para ${cl.nomeCompleto}`}
                                className="p-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 text-[#1E7E34] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {f.status === 'Pago' && (
                              <button
                                type="button"
                                onClick={() => void openReceiptFromRecord(f)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-xs font-semibold text-emerald-900 dark:text-emerald-300 hover:bg-emerald-100 whitespace-nowrap"
                              >
                                <FileText className="w-3 h-3" />
                                {f.reciboNumero ? `Recibo ${f.reciboNumero}` : 'Gerar Recibo'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditFinModal(f)}
                              aria-label={`Editar lançamento ${f.descricao}`}
                              className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            {f.comprovanteUrl && (
                              <a
                                href={f.comprovanteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs underline text-[var(--color-primary)] dark:text-[#60A5FA] whitespace-nowrap px-1"
                              >
                                Comprovante
                              </a>
                            )}
                            {role === 'admin' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    col: 'financialRecords',
                                    id: f.id,
                                    label: `lançamento "${f.descricao}"`,
                                    item: f,
                                    fileUrl: f.comprovanteUrl,
                                  })
                                }
                                className="p-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-[#C82333] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 shrink-0"
                                aria-label={`Excluir lançamento ${f.descricao}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 3: CONTRATOS & RECIBOS */}
      {/* ===================================================================== */}
      {tab === 'documentos' && (
        <div className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Contratos, Recibos &amp; Termos Oficiais (13 Modelos)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preenchimento automático com QR verificador, assinatura eletrônica, histórico de versões e cancelamento auditado.
              </p>
            </div>
            <button
              type="button"
              onClick={openNewContractGenerator}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Gerar Novo Contrato / Documento
            </button>
          </div>

          {generatedDocuments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-8 text-center">
              Nenhum contrato, recibo ou termo gerado ainda. Clique em &ldquo;Gerar Novo Contrato / Documento&rdquo;.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {generatedDocuments.map((gd) => {
                const docClient = clientMap.get(gd.clientId);
                const portalStillLocked = Boolean(gd.liberadoAoCliente && docClient && !docClient.portalLiberado);
                return (
                  <div
                    key={gd.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-2 flex flex-col justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {gd.titulo} (v{gd.versao})
                        </span>
                        <span
                          className={`font-semibold text-[11px] ${
                            gd.canceladoEm
                              ? 'text-[#C82333] dark:text-red-400'
                              : gd.status === 'Assinado'
                                ? 'text-[#1E7E34] dark:text-emerald-400'
                                : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {gd.canceladoEm ? 'Cancelado' : gd.status || 'Rascunho'}
                        </span>
                      </div>
                      <p className="text-slate-500 dark:text-slate-400">
                        Cliente: {docClient?.nomeCompleto || gd.clientId} · {formatDateBR(gd.createdAt)}
                        {gd.codigoVerificacao ? ` · Cód. ${gd.codigoVerificacao}` : ''}
                      </p>
                      <p className={gd.liberadoAoCliente ? 'text-[#1E7E34] dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                        {gd.liberadoAoCliente ? 'Disponível no Portal do Cliente' : 'Uso Interno'}
                        {gd.confirmadoLeituraEm ? ' · Leitura confirmada pelo cliente' : ''}
                      </p>
                      {portalStillLocked && docClient && (
                        <div className="mt-1.5 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-950 dark:text-amber-200 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] leading-snug">
                            O acesso ao Portal de <strong>{docClient.nomeCompleto}</strong> ainda está bloqueado.
                          </span>
                          {(role === 'admin' || role === 'consultor') && (
                            <button
                              type="button"
                              onClick={async () => {
                                await setClientPortalAccessAudited({
                                  client: docClient,
                                  portalLiberado: true,
                                  modalidadeConsultoria: normalizePaidModality(docClient.modalidadeConsultoria),
                                  role,
                                });
                                setFeedback(`Portal do Cliente LIBERADO para ${docClient.nomeCompleto}! Os documentos já ficam visíveis.`);
                                await onRefresh();
                              }}
                              className="px-2.5 py-1 rounded bg-[#0B1F33] text-white text-[11px] font-semibold hover:opacity-95 whitespace-nowrap shrink-0"
                            >
                              Liberar Portal Agora
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingGenDoc(gd);
                          setReceiptFinRecord(null);
                          setContractModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        Abrir / Editar / A4
                      </button>
                      {!gd.canceladoEm && (
                        <button
                          type="button"
                          onClick={async () => {
                            const nextLib = !gd.liberadoAoCliente;
                            await saveDocumentAudited(
                              'generatedDocuments',
                              gd.id,
                              { ...gd, liberadoAoCliente: nextLib },
                              false,
                              role,
                              'liberar_doc_gerado',
                            );
                            if (nextLib && docClient && !docClient.portalLiberado) {
                              setFeedback(
                                `Documento "${gd.titulo}" marcado como visível. Libere também o Portal de ${docClient.nomeCompleto}.`,
                              );
                            } else {
                              setFeedback(
                                nextLib
                                  ? `Documento "${gd.titulo}" liberado para visualização no Portal do Cliente.`
                                  : `Documento "${gd.titulo}" ocultado do Portal do Cliente.`,
                              );
                            }
                            await onRefresh();
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium"
                        >
                          {gd.liberadoAoCliente ? 'Ocultar do Portal' : 'Liberar no Portal'}
                        </button>
                      )}
                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              col: 'generatedDocuments',
                              id: gd.id,
                              label: `documento "${gd.titulo}"`,
                              item: gd,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900/60 text-[#C82333] dark:text-red-400 font-semibold hover:bg-red-50 ml-auto"
                        >
                          <Trash2 className="w-3 h-3" />
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 4: CUSTOS REFERENCIAIS, CÂMBIO & SIMULADOR */}
      {/* ===================================================================== */}
      {tab === 'custos' && (
        <CustosReferenciaisTab
          role={role}
          empresa={empresa}
          aiCustosLoading={aiCustosLoading}
          aiCustosProgress={aiCustosProgress}
          aiCustosError={aiCustosError}
          approvingCustos={approvingCustos}
          custosDraft={custosDraft}
          onConsultarCustosIa={handleConsultarCustosIa}
          onApproveCustos={handleApproveCustos}
          onDiscardCustosDraft={() => {
            setCustosDraft(null);
            clearAiDraftCache('custos_padrao');
          }}
          onSaveManualCustos={handleSaveManualCustos}
          onCreateBudgetFromSimulation={handleCreateBudgetFromSimulation}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAL CRIAR / EDITAR ORÇAMENTO */}
      {/* ===================================================================== */}
      {budgetModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingBudgetId ? 'Editar Orçamento' : 'Novo Orçamento'}
        >
          <form
            onSubmit={handleSaveBudget}
            className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingBudgetId ? `Editar Orçamento ${bNumero}` : `Novo Orçamento (${bNumero})`}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use um modelo pronto calibrado com a tabela SERMIG/CNJ ou personalize etapas, valores e condições.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBudgetModal(false)}
                aria-label="Fechar modal de orçamento"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modelos Prontos (1 clique) */}
            {!editingBudgetId && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Modelos Comerciais Prontos</p>
                <div className="flex flex-wrap gap-1.5">
                  {BUDGET_PRESET_TEMPLATES.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyBudgetPreset(preset)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Campos Principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cliente *</label>
                <select
                  required
                  value={bClientId}
                  onChange={(e) => {
                    setBClientId(e.target.value);
                    setBCaseId('');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Caso Vinculado</label>
                <select
                  value={bCaseId}
                  onChange={(e) => setBCaseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">Opcional...</option>
                  {clientCasesForBudget.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.titulo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Modalidade</label>
                <select
                  value={bModalidade}
                  onChange={(e) => setBModalidade(e.target.value as PaidConsultancyModality)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="completa">Consultoria Completa</option>
                  <option value="orientativa">Consultoria Orientativa</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Título da Proposta *</label>
                <input
                  required
                  value={bTitulo}
                  onChange={(e) => setBTitulo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status Inicial</label>
                <select
                  value={bStatus}
                  onChange={(e) => setBStatus(e.target.value as Budget['status'])}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="Enviado ao Cliente">Enviado ao Cliente (visível no Portal)</option>
                  <option value="Rascunho">Rascunho (uso interno)</option>
                  <option value="Aprovado">Aprovado</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Modelo de Cobrança</label>
                <select
                  value={bTipoCobranca}
                  onChange={(e) => setBTipoCobranca(e.target.value as Budget['tipoCobranca'])}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="Por Etapa Realizada">Por Etapa Realizada</option>
                  <option value="Por Serviço Escolhido">Por Serviço Escolhido</option>
                  <option value="Pacote Completo">Pacote Completo</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Moeda Principal</label>
                <select
                  value={bMoeda}
                  onChange={(e) => setBMoeda(e.target.value as CurrencyCode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="BRL">BRL (R$)</option>
                  <option value="USD">USD ($)</option>
                  <option value="CLP">CLP ($)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Validade da Proposta *</label>
                <input
                  type="date"
                  required
                  value={bValidade}
                  onChange={(e) => setBValidade(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
                />
              </div>
            </div>

            {/* Itens / Etapas Dinâmicos */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Itens e Etapas ({bItems.length})
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setBItems((prev) => [
                      ...prev,
                      {
                        id: makeId('bi'),
                        descricao: `Etapa ${prev.length + 1} — `,
                        etapaVinculada: `Etapa ${prev.length + 1}`,
                        valorHonorarios: 0,
                        taxasEstimadasTerceiros: 0,
                        moeda: bMoeda,
                        statusEtapa: 'Aguardando',
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Etapa / Item
                </button>
              </div>

              {bItems.map((it, idx) => (
                <div
                  key={it.id}
                  className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                    <input
                      required
                      value={it.descricao}
                      onChange={(e) => {
                        const next = [...bItems];
                        next[idx] = { ...it, descricao: e.target.value };
                        setBItems(next);
                      }}
                      placeholder="Descrição da etapa ou entrega..."
                      className="sm:col-span-6 w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <input
                      value={it.etapaVinculada}
                      onChange={(e) => {
                        const next = [...bItems];
                        next[idx] = { ...it, etapaVinculada: e.target.value };
                        setBItems(next);
                      }}
                      placeholder="Etapa (ex: 1–3)"
                      className="sm:col-span-2 w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.valorHonorarios}
                      onChange={(e) => {
                        const next = [...bItems];
                        next[idx] = { ...it, valorHonorarios: Number(e.target.value) };
                        setBItems(next);
                      }}
                      placeholder="Honorários"
                      aria-label={`Honorários do item ${idx + 1}`}
                      className="sm:col-span-2 w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
                    />
                    <div className="sm:col-span-2 flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.taxasEstimadasTerceiros}
                        onChange={(e) => {
                          const next = [...bItems];
                          next[idx] = { ...it, taxasEstimadasTerceiros: Number(e.target.value) };
                          setBItems(next);
                        }}
                        placeholder="Taxas est."
                        aria-label={`Taxas estimadas do item ${idx + 1}`}
                        className="w-full min-w-0 px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
                      />
                      {bItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBItems((prev) => prev.filter((x) => x.id !== it.id))}
                          aria-label={`Remover item ${idx + 1}`}
                          className="p-1.5 rounded border border-red-200 dark:border-red-900/60 text-[#C82333] dark:text-red-400 hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desconto + Condições + Resumo ao vivo */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start text-xs pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="md:col-span-7 space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Desconto Comercial ({bMoeda})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bDesconto}
                    onChange={(e) => setBDesconto(Math.max(0, Number(e.target.value) || 0))}
                    className="w-40 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Condições de Pagamento &amp; Observações
                  </label>
                  <textarea
                    rows={2}
                    value={bCondicoes}
                    onChange={(e) => setBCondicoes(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="md:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Honorários</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatCurrency(modalBudgetTotals.totalHonorarios, bMoeda)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Taxas Est. Terceiros</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(modalBudgetTotals.totalTaxas, bMoeda)}
                  </span>
                </div>
                {modalBudgetTotals.descontoAplicado > 0 && (
                  <div className="flex justify-between text-[#1E7E34] dark:text-emerald-400">
                    <span>Desconto</span>
                    <span className="font-mono tabular-nums font-semibold">
                      -{formatCurrency(modalBudgetTotals.descontoAplicado, bMoeda)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between pt-2 mt-1 border-t border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white">
                  <span>Total Geral</span>
                  <span className="font-mono tabular-nums">{formatCurrency(modalBudgetTotals.totalGeral, bMoeda)}</span>
                </div>
                <p className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400 pt-0.5">
                  Ref.: {formatCurrency(modalBudgetConverted.BRL, 'BRL')} · {formatCurrency(modalBudgetConverted.USD, 'USD')} ·{' '}
                  {formatCurrency(modalBudgetConverted.CLP, 'CLP')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={savingBudget}
                onClick={() => setBudgetModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingBudget}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {savingBudget
                  ? 'Salvando...'
                  : editingBudgetId
                    ? 'Salvar Alterações'
                    : bStatus === 'Rascunho'
                      ? 'Salvar Rascunho'
                      : 'Criar e Liberar ao Cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL CRIAR / EDITAR LANÇAMENTO FINANCEIRO (COM PARCELAMENTO) */}
      {/* ===================================================================== */}
      {finModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingFinId ? 'Editar Lançamento Financeiro' : 'Novo Lançamento Financeiro'}
        >
          <form
            onSubmit={handleSaveFin}
            className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingFinId ? 'Editar Lançamento Financeiro' : 'Novo Lançamento / Parcelamento'}
              </h2>
              <button
                type="button"
                onClick={() => setFinModal(false)}
                aria-label="Fechar modal de lançamento"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Cliente</label>
                <select
                  value={fClientId}
                  onChange={(e) => {
                    setFClientId(e.target.value);
                    setFCaseId('');
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">Sem cliente vinculado</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nomeCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Caso Vinculado</label>
                <select
                  value={fCaseId}
                  onChange={(e) => setFCaseId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="">Opcional...</option>
                  {clientCasesForFin.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.titulo}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Categoria / Tipo</label>
                <select
                  value={fTipo}
                  onChange={(e) => setFTipo(e.target.value as FinancialRecord['tipo'])}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="Honorários">Honorários</option>
                  <option value="Taxa SERMIG">Taxa SERMIG</option>
                  <option value="Apostila/Tradução">Apostila/Tradução</option>
                  <option value="Despachante/Outros">Despachante/Outros</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Forma de Pagamento</label>
                <select
                  value={fForma}
                  onChange={(e) => setFForma(e.target.value as NonNullable<FinancialRecord['formaPagamento']>)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="Pix">Pix</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Wise">Wise</option>
                  <option value="Boleto">Boleto</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Descrição *</label>
              <input
                required
                value={fDesc}
                onChange={(e) => setFDesc(e.target.value)}
                placeholder="Ex.: Honorários Assessoria Mercosul — Etapa 1"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Moeda</label>
                <select
                  value={fMoeda}
                  onChange={(e) => setFMoeda(e.target.value as CurrencyCode)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                >
                  <option value="BRL">BRL</option>
                  <option value="USD">USD</option>
                  <option value="CLP">CLP</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {!editingFinId && fParcelas > 1 ? 'Valor Total *' : 'Valor *'}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={fValor}
                  onChange={(e) => setFValor(Number(e.target.value))}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {!editingFinId && fParcelas > 1 ? '1º Vencimento *' : 'Vencimento *'}
                </label>
                <input
                  type="date"
                  required
                  value={fVenc}
                  onChange={(e) => setFVenc(e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!editingFinId && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Parcelamento Mensal</label>
                  <select
                    value={fParcelas}
                    onChange={(e) => setFParcelas(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n === 1 ? '1x (Lançamento único)' : `${n}x parcelas mensais iguais`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {(editingFinId || fParcelas === 1) && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={fStatus}
                    onChange={(e) => setFStatus(e.target.value as FinancialRecord['status'])}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  >
                    <option value="Pendente">Pendente</option>
                    <option value="Pago">Pago</option>
                    <option value="Atrasado">Atrasado</option>
                  </select>
                </div>
              )}
            </div>

            {/* Prévia das parcelas */}
            {installmentPreview.length > 1 && (
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  Prévia do parcelamento ({installmentPreview.length} lançamentos)
                </p>
                <div className="max-h-28 overflow-y-auto space-y-1 font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300">
                  {installmentPreview.map((p) => (
                    <div key={p.parcelaIndex} className="flex justify-between gap-2">
                      <span className="font-sans truncate">{p.descricao}</span>
                      <span className="whitespace-nowrap">
                        {formatDateBR(p.vencimento)} · <strong>{formatCurrency(p.valor, fMoeda)}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={savingFin}
                onClick={() => setFinModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingFin}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {savingFin
                  ? 'Salvando...'
                  : editingFinId
                    ? 'Salvar Alterações'
                    : fParcelas > 1
                      ? `Gerar ${fParcelas} Parcelas`
                      : 'Salvar Lançamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Proposta Comercial Imprimível (A4) */}
      <BudgetPrintModal
        budget={previewBudget}
        client={previewBudget?.clientId ? clientMap.get(previewBudget.clientId) : undefined}
        linkedCase={previewBudget?.caseId ? caseMap.get(previewBudget.caseId) : undefined}
        empresa={empresa}
        onClose={() => setPreviewBudget(null)}
      />

      <ContractGeneratorModal
        open={contractModalOpen}
        onClose={() => {
          setContractModalOpen(false);
          setEditingGenDoc(null);
          setReceiptFinRecord(null);
        }}
        role={role}
        userProfile={userProfile}
        empresa={empresa}
        clients={clients}
        cases={cases}
        dependents={dependents}
        documentTemplates={documentTemplates}
        generatedDocuments={generatedDocuments}
        initialEditingDoc={editingGenDoc}
        initialReceiptRecord={receiptFinRecord}
        onRefresh={onRefresh}
        onLogWhatsApp={onLogWhatsApp}
      />

      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Confirmar Exclusão"
        description={`Deseja excluir permanentemente ${deleteTarget?.label || 'este registro'}? Esta operação é auditada e irreversível.`}
        confirmLabel="Excluir Permanentemente"
        tone="danger"
        onConfirm={async () => {
          if (!deleteTarget) return;
          setErrorMsg(null);
          try {
            await deleteDocumentAudited(deleteTarget.col, deleteTarget.id, role, deleteTarget.item);
            if (deleteTarget.fileUrl) {
              await cleanupServerUploadUrl(deleteTarget.fileUrl);
            }
            setFeedback(`Exclusão concluída (${deleteTarget.label}).`);
            setDeleteTarget(null);
            await onRefresh();
          } catch (err) {
            throw new Error(translateAppError(err).message || 'Não foi possível concluir a exclusão.');
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
