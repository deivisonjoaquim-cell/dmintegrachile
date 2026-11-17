import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  MessageCircle,
  Plus,
  Printer,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  clearAiDraftCache,
  loadAiDraftCache,
  sanitizeClientAiError,
  saveAiDraftCache,
  type AiResponseMeta,
} from '../../utils/aiClient';
import {
  deleteDocumentAudited,
  makeId,
  saveDocumentAudited,
  saveEmpresaConfigAdmin,
  callAiEndpoint,
} from '../../services/firestoreService';
import type {
  Budget,
  BudgetItem,
  Case,
  Client,
  CurrencyCode,
  CustosPadrao,
  DocumentTemplate,
  EmpresaConfig,
  FinancialRecord,
  GeneratedDocument,
  UserProfile,
  UserRole,
} from '../../types/domain';
import {
  applyTemplateVariables,
  buildWhatsAppUrl,
  exportToCSV,
  formatCurrency,
  formatDateBR,
  toIsoDate,
} from '../../utils/formatters';

interface PainelFinanceiroProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  clients: Client[];
  cases: Case[];
  budgets: Budget[];
  financialRecords: FinancialRecord[];
  documentTemplates: DocumentTemplate[];
  generatedDocuments: GeneratedDocument[];
  onRefresh: () => Promise<void>;
  onRefreshPublic: () => Promise<void>;
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
}

type FinTab = 'orcamentos' | 'lancamentos' | 'documentos' | 'custos';

export const PainelFinanceiro: React.FC<PainelFinanceiroProps> = ({
  role,
  userProfile,
  empresa,
  clients,
  cases,
  budgets,
  financialRecords,
  documentTemplates,
  generatedDocuments,
  onRefresh,
  onRefreshPublic,
  onLogWhatsApp,
}) => {
  if (role === 'assistente') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        Acesso restrito: este perfil não possui permissão para visualizar ou editar dados financeiros.
      </div>
    );
  }

  const [tab, setTab] = useState<FinTab>('orcamentos');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Novo Orçamento
  const [budgetModal, setBudgetModal] = useState(false);
  const [bClientId, setBClientId] = useState(clients[0]?.id || '');
  const [bCaseId, setBCaseId] = useState('');
  const [bTitulo, setBTitulo] = useState('Assessoria Residência Temporal Mercosul');
  const [bTipoCobranca, setBTipoCobranca] = useState<Budget['tipoCobranca']>('Por Etapa Realizada');
  const [bMoeda, setBMoeda] = useState<CurrencyCode>('BRL');
  const [bDesconto, setBDesconto] = useState(0);
  const [bCondicoes, setBCondicoes] = useState('50% na assinatura + 50% no protocolo SERMIG (Pix, Cartão ou Transferência).');
  const [bValidade, setBValidade] = useState(() => toIsoDate(new Date(Date.now() + 15 * 86400000)));
  const [bItems, setBItems] = useState<BudgetItem[]>([
    {
      id: makeId('bi'),
      descricao: 'Etapa 1 — Análise Técnica e Estruturação Documental',
      etapaVinculada: 'Etapa 2–3',
      valorHonorarios: 1800,
      taxasEstimadasTerceiros: 350,
      moeda: 'BRL',
      statusEtapa: 'Concluída/Faturável',
    },
    {
      id: makeId('bi'),
      descricao: 'Etapa 2 — Conferência Final, Protocolo SERMIG e Acompanhamento',
      etapaVinculada: 'Etapa 6–9',
      valorHonorarios: 1800,
      taxasEstimadasTerceiros: 450,
      moeda: 'BRL',
      statusEtapa: 'Aguardando',
    },
  ]);

  // Novo Lançamento Financeiro
  const [finModal, setFinModal] = useState(false);
  const [fClientId, setFClientId] = useState(clients[0]?.id || '');
  const [fCaseId, setFCaseId] = useState('');
  const [fTipo, setFTipo] = useState<FinancialRecord['tipo']>('Honorários');
  const [fDesc, setFDesc] = useState('');
  const [fMoeda, setFMoeda] = useState<CurrencyCode>('BRL');
  const [fValor, setFValor] = useState(0);
  const [fVenc, setFVenc] = useState(() => toIsoDate(new Date(Date.now() + 5 * 86400000)));

  // Editor de Documento Gerado
  const [genTplId, setGenTplId] = useState(documentTemplates[0]?.id || '');
  const [genClientId, setGenClientId] = useState(clients[0]?.id || '');
  const [genCaseId, setGenCaseId] = useState('');
  const [genValor, setGenValor] = useState('R$ 3.600,00');
  const [genForma, setGenForma] = useState('Pix em 2 parcelas');
  const [genEditorHtml, setGenEditorHtml] = useState('');
  const [genEditorTitle, setGenEditorTitle] = useState('');
  const [genEditorTipo, setGenEditorTipo] = useState('contrato');
  const [genFinanceiro, setGenFinanceiro] = useState(true);
  const [genLiberarCliente, setGenLiberarCliente] = useState(false);

  // IA Custos Referenciais
  const [aiCustosLoading, setAiCustosLoading] = useState(false);
  const [aiCustosProgress, setAiCustosProgress] = useState<string | null>(null);
  const [custosDraft, setCustosDraft] = useState<(CustosPadrao & AiResponseMeta) | null>(null);

  useEffect(() => {
    const cached = loadAiDraftCache<CustosPadrao & AiResponseMeta>('custos_padrao');
    if (cached) setCustosDraft(cached);
  }, []);

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const totalsByCurrency = useMemo(() => {
    const map: Record<CurrencyCode, { recebido: number; pendente: number; atrasado: number }> = {
      BRL: { recebido: 0, pendente: 0, atrasado: 0 },
      CLP: { recebido: 0, pendente: 0, atrasado: 0 },
      USD: { recebido: 0, pendente: 0, atrasado: 0 },
    };
    for (const f of financialRecords) {
      const bucket = map[f.moeda || 'BRL'];
      if (f.status === 'Pago') bucket.recebido += f.valor;
      else if (f.status === 'Atrasado') bucket.atrasado += f.valor;
      else bucket.pendente += f.valor;
    }
    return map;
  }, [financialRecords]);

  // ===========================================================================
  // Orçamentos
  // ===========================================================================
  const handleCreateBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const totalHon = bItems.reduce((a, b) => a + Number(b.valorHonorarios || 0), 0);
    const totalTax = bItems.reduce((a, b) => a + Number(b.taxasEstimadasTerceiros || 0), 0);
    const totalGeral = Math.max(0, totalHon + totalTax - Number(bDesconto || 0));
    const id = makeId('orc');
    const payload: Budget = {
      id,
      numeroOrcamento: `ORC-${new Date().getFullYear()}-${String(budgets.length + 1).padStart(3, '0')}`,
      clientId: bClientId || undefined,
      caseId: bCaseId || undefined,
      titulo: bTitulo.trim(),
      tipoCobranca: bTipoCobranca,
      moedaPrincipal: bMoeda,
      itens: bItems,
      desconto: Number(bDesconto || 0),
      totalHonorarios: totalHon,
      totalTaxas: totalTax,
      totalGeral,
      condicoesPagamento: bCondicoes,
      validade: bValidade,
      status: 'Enviado ao Cliente',
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('budgets', id, payload as unknown as Record<string, unknown>, true, role, 'orcamento');
    setBudgetModal(false);
    setFeedback(`Orçamento ${payload.numeroOrcamento} criado e liberado ao cliente.`);
    await onRefresh();
  };

  const handleFaturarItem = async (b: Budget, item: BudgetItem) => {
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
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('financialRecords', id, fin as unknown as Record<string, unknown>, true, role, 'faturamento_etapa');
    const updatedItens = b.itens.map((x) => (x.id === item.id ? { ...x, statusEtapa: 'Paga' as const } : x));
    await saveDocumentAudited(
      'budgets',
      b.id,
      { ...b, itens: updatedItens, status: 'Parcialmente Faturado' },
      false,
      role,
      'faturar_etapa',
    );
    setFeedback(`Lançamento financeiro criado para "${item.descricao}".`);
    await onRefresh();
  };

  // ===========================================================================
  // Lançamentos Financeiros
  // ===========================================================================
  const handleCreateFin = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = makeId('fin');
    const fin: FinancialRecord = {
      id,
      clientId: fClientId || undefined,
      caseId: fCaseId || undefined,
      tipo: fTipo,
      descricao: fDesc.trim(),
      moeda: fMoeda,
      valor: Number(fValor || 0),
      vencimento: fVenc,
      status: 'Pendente',
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('financialRecords', id, fin as unknown as Record<string, unknown>, true, role, 'lancamento_financeiro');
    setFinModal(false);
    setFDesc('');
    setFValor(0);
    setFeedback('Lançamento financeiro cadastrado.');
    await onRefresh();
  };

  // ===========================================================================
  // Modelos & Documentos Gerados (Bloqueio de [preencher])
  // ===========================================================================
  const handleLoadDocTemplate = (tplId: string) => {
    setGenTplId(tplId);
    const tpl = documentTemplates.find((t) => t.id === tplId);
    if (!tpl) return;
    const cl = clientMap.get(genClientId);
    const cs = cases.find((c) => c.id === genCaseId || c.clientId === genClientId);
    const filled = applyTemplateVariables(tpl.conteudoHtml, {
      empresa_nome: empresa.nome_empresa,
      empresa_doc: empresa.razao_social_cnpj_rut,
      empresa_endereco: empresa.endereco_cidade,
      empresa_responsavel: empresa.responsavel_tecnico,
      foro_comarca: empresa.foro_comarca,
      cliente_nome: cl?.nomeCompleto || '[preencher nome completo]',
      cliente_nacionalidade: cl?.nacionalidade || 'Brasileira',
      cliente_estado_civil: cl?.estadoCivil || '[preencher estado civil]',
      cliente_profissao: cl?.profissao || '[preencher profissão]',
      cliente_cpf: cl?.cpf || '[preencher CPF]',
      cliente_passaporte: cl?.passaporte?.numero || '[preencher passaporte]',
      cliente_endereco: cl?.enderecoCompleto || '[preencher endereço]',
      cliente_email: cl?.email || '',
      cliente_whatsapp: cl?.whatsapp || '',
      objeto_servico: cs?.titulo || 'Assessoria Migratória para Residência no Chile',
      valor_contrato: genValor,
      forma_pagamento: genForma,
      descricao_pagamento: 'Honorários de Assessoria Migratória',
      valor_pago: genValor,
      caso_titulo: cs?.titulo || '',
      data_atual: formatDateBR(new Date()),
    });
    setGenEditorTitle(tpl.titulo);
    setGenEditorTipo(tpl.tipo);
    setGenEditorHtml(filled);
    setGenFinanceiro(['contrato', 'recibo', 'orcamento'].includes(tpl.tipo));
  };

  const hasPendingPlaceholders = /\[preencher[^\]]*\]/i.test(genEditorHtml);

  const handleSaveGeneratedDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!genClientId) {
      setErrorMsg('Selecione um cliente para gerar o documento.');
      return;
    }
    if (hasPendingPlaceholders) {
      setErrorMsg('Bloqueado: substitua todos os marcadores "[preencher ...]" antes de salvar ou liberar ao cliente.');
      return;
    }
    const prevVersions = generatedDocuments.filter((g) => g.clientId === genClientId && g.tipo === genEditorTipo);
    const id = makeId('gdoc');
    const docRecord: GeneratedDocument = {
      id,
      tipo: genEditorTipo,
      titulo: genEditorTitle.trim(),
      clientId: genClientId,
      caseId: genCaseId || undefined,
      conteudoHtml: genEditorHtml,
      versao: prevVersions.length + 1,
      liberadoAoCliente: genLiberarCliente,
      financeiro: genFinanceiro,
      autorNome: userProfile.nome || userProfile.email,
      createdAt: new Date().toISOString(),
    };
    await saveDocumentAudited('generatedDocuments', id, docRecord as unknown as Record<string, unknown>, true, role, 'documento_gerado');
    setFeedback(`Documento "${docRecord.titulo}" (v${docRecord.versao}) salvo com sucesso!`);
    await onRefresh();
  };

  // ===========================================================================
  // IA Custos Referenciais
  // ===========================================================================
  const handleConsultarCustosIa = async () => {
    if (aiCustosLoading) return;
    setAiCustosLoading(true);
    setAiCustosProgress('Consultando custos referenciais...');
    setErrorMsg(null);
    try {
      const res = await callAiEndpoint<CustosPadrao & AiResponseMeta>(
        '/api/ai/custos',
        {
          currentCustos: empresa.custosPadrao,
        },
        {
          onProgress: (msg) => setAiCustosProgress(msg),
        },
      );
      setCustosDraft(res);
      saveAiDraftCache('custos_padrao', res);
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    } finally {
      setAiCustosLoading(false);
      setAiCustosProgress(null);
    }
  };

  const handleApproveCustos = async () => {
    if (!custosDraft || role !== 'admin') return;
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
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Financeiro, Orçamentos &amp; Contratos</h1>
          <p className="text-xs text-slate-500">
            Área restrita a Administradores e Consultores — oculta automaticamente para Assistentes
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setBudgetModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Orçamento
          </button>
          <button
            type="button"
            onClick={() => setFinModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Lançamento
          </button>
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                'financeiro-dm-integra',
                ['Cliente', 'Tipo', 'Descrição', 'Moeda', 'Valor', 'Vencimento', 'Status'],
                financialRecords.map((f) => [
                  clientMap.get(f.clientId || '')?.nomeCompleto || '',
                  f.tipo,
                  f.descricao,
                  f.moeda,
                  f.valor,
                  formatDateBR(f.vencimento),
                  f.status,
                ]),
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {/* KPIs Multimoeda */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
        {(['BRL', 'CLP', 'USD'] as CurrencyCode[]).map((cur) => (
          <div key={cur} className="bg-white border border-slate-200 rounded-xl p-4 space-y-1">
            <p className="text-xs font-semibold text-slate-500">Resumo em {cur}</p>
            <p className="text-lg font-bold text-[#1E7E34] tabular-nums">
              Recebido: {formatCurrency(totalsByCurrency[cur].recebido, cur)}
            </p>
            <p className="text-xs text-slate-600 tabular-nums">
              A receber: {formatCurrency(totalsByCurrency[cur].pendente, cur)} ·{' '}
              <span className="text-[#C82333]">Atraso: {formatCurrency(totalsByCurrency[cur].atrasado, cur)}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Sub-abas */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto no-print">
        {[
          { id: 'orcamentos', label: `Orçamentos (${budgets.length})` },
          { id: 'lancamentos', label: `Lançamentos & Parcelas (${financialRecords.length})` },
          { id: 'documentos', label: `Contratos & Recibos (${generatedDocuments.length})` },
          { id: 'custos', label: 'Custos Referenciais SERMIG/CNJ' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as FinTab)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap ${
              tab === t.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium no-print">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C82333] font-medium no-print">
          {errorMsg}
        </div>
      )}

      {/* ABA ORÇAMENTOS */}
      {tab === 'orcamentos' && (
        <div className="space-y-4">
          {budgets.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Nenhum orçamento cadastrado. Clique em &ldquo;Novo Orçamento&rdquo; para criar.
            </div>
          ) : (
            budgets.map((b) => {
              const cl = b.clientId ? clientMap.get(b.clientId) : undefined;
              return (
                <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-slate-500">
                        Nº {b.numeroOrcamento} · {b.tipoCobranca} · Validade {formatDateBR(b.validade)} · Status: {b.status}
                      </p>
                      <h2 className="text-lg font-bold text-slate-900 mt-0.5">{b.titulo}</h2>
                      <p className="text-xs text-slate-600">Cliente: {cl?.nomeCompleto || '—'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold tabular-nums text-slate-900">{formatCurrency(b.totalGeral, b.moedaPrincipal)}</p>
                      <p className="text-[11px] text-slate-500">
                        Honorários: {formatCurrency(b.totalHonorarios, b.moedaPrincipal)} · Taxas est.: {formatCurrency(b.totalTaxas, b.moedaPrincipal)}
                      </p>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {b.itens.map((item) => (
                      <div key={item.id} className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-900">{item.descricao}</p>
                          <p className="text-slate-500">
                            {item.etapaVinculada} · Status: {item.statusEtapa} · Honorários: {formatCurrency(item.valorHonorarios, item.moeda)} ·
                            Taxas est.: {formatCurrency(item.taxasEstimadasTerceiros, item.moeda)}
                          </p>
                        </div>
                        {item.statusEtapa !== 'Paga' && (
                          <button
                            type="button"
                            onClick={() => void handleFaturarItem(b, item)}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50"
                          >
                            Faturar Etapa
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 no-print">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir / PDF
                    </button>
                    {cl?.whatsapp && (
                      <button
                        type="button"
                        onClick={async () => {
                          const msg = `Olá, ${cl.nomeCompleto}! Segue o resumo do seu orçamento ${b.numeroOrcamento} (${b.titulo}): Total ${formatCurrency(b.totalGeral, b.moedaPrincipal)}. ${b.condicoesPagamento}. Você pode aprová-lo diretamente no Portal do Cliente.`;
                          window.open(buildWhatsAppUrl(cl.whatsapp, msg), '_blank', 'noopener,noreferrer');
                          await onLogWhatsApp(cl.id, b.caseId, `Orçamento ${b.numeroOrcamento}`, msg);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Enviar no WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ABA LANÇAMENTOS */}
      {tab === 'lancamentos' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          {financialRecords.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">Nenhum lançamento registrado ainda.</div>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                  <th className="py-3 px-4 font-semibold">Descrição / Cliente</th>
                  <th className="py-3 px-4 font-semibold">Tipo</th>
                  <th className="py-3 px-4 font-semibold">Vencimento</th>
                  <th className="py-3 px-4 font-semibold">Valor</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {financialRecords.map((f) => {
                  const cl = f.clientId ? clientMap.get(f.clientId) : undefined;
                  return (
                    <tr key={f.id}>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{f.descricao}</p>
                        <p className="text-xs text-slate-500">{cl?.nomeCompleto || '—'}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">{f.tipo}</td>
                      <td className="py-3 px-4 text-xs text-slate-700 tabular-nums">{formatDateBR(f.vencimento)}</td>
                      <td className="py-3 px-4 text-xs font-bold tabular-nums">{formatCurrency(f.valor, f.moeda)}</td>
                      <td className="py-3 px-4 text-xs">
                        <select
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
                            );
                            await onRefresh();
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 text-xs bg-white font-semibold"
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Pago">Pago</option>
                          <option value="Atrasado">Atrasado</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                        {f.comprovanteUrl && (
                          <a
                            href={f.comprovanteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline text-[var(--color-primary)]"
                          >
                            Comprovante
                          </a>
                        )}
                        {role === 'admin' && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteDocumentAudited('financialRecords', f.id, role, f);
                              await onRefresh();
                            }}
                            className="p-1.5 rounded border border-red-200 text-[#C82333]"
                            aria-label="Excluir lançamento"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ABA CONTRATOS & RECIBOS */}
      {tab === 'documentos' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleSaveGeneratedDoc} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Gerar Documento Oficial com Versionamento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Modelo</label>
                <select
                  value={genTplId}
                  onChange={(e) => handleLoadDocTemplate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  {documentTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.titulo}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente *</label>
                <select
                  required
                  value={genClientId}
                  onChange={(e) => setGenClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Valor formatado</label>
                <input
                  value={genValor}
                  onChange={(e) => setGenValor(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Forma de pagamento</label>
                <input
                  value={genForma}
                  onChange={(e) => setGenForma(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleLoadDocTemplate(genTplId)}
              className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              Preencher variáveis do cliente selecionado
            </button>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Título do documento</label>
              <input
                required
                value={genEditorTitle}
                onChange={(e) => setGenEditorTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Conteúdo editável</label>
              <textarea
                required
                rows={10}
                value={genEditorHtml}
                onChange={(e) => setGenEditorHtml(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-mono"
              />
              {hasPendingPlaceholders && (
                <p className="text-xs text-[#C82333] font-medium mt-1">
                  Atenção: ainda existem campos &ldquo;[preencher ...]&rdquo; no texto — substitua-os antes de salvar.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={genFinanceiro} onChange={(e) => setGenFinanceiro(e.target.checked)} />
                Documento financeiro (oculto para Assistente)
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={genLiberarCliente} onChange={(e) => setGenLiberarCliente(e.target.checked)} />
                Liberar no Portal do Cliente
              </label>
            </div>

            <button
              type="submit"
              disabled={hasPendingPlaceholders}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Salvar Nova Versão do Documento
            </button>
          </form>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="text-base font-bold text-slate-900">Documentos Emitidos</h2>
            {generatedDocuments.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum documento gerado ainda.</p>
            ) : (
              <div className="space-y-3">
                {generatedDocuments.map((gd) => (
                  <div key={gd.id} className="p-3.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {gd.titulo} (v{gd.versao})
                      </span>
                      <span className={gd.liberadoAoCliente ? 'text-[#1E7E34] font-semibold' : 'text-slate-500'}>
                        {gd.liberadoAoCliente ? 'Visível no Portal' : 'Interno'}
                      </span>
                    </div>
                    <p className="text-slate-500">
                      Cliente: {clientMap.get(gd.clientId)?.nomeCompleto || gd.clientId} · {formatDateBR(gd.createdAt)}
                    </p>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={async () => {
                          await saveDocumentAudited(
                            'generatedDocuments',
                            gd.id,
                            { ...gd, liberadoAoCliente: !gd.liberadoAoCliente },
                            false,
                            role,
                            'liberar_doc_gerado',
                          );
                          await onRefresh();
                        }}
                        className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 font-medium"
                      >
                        {gd.liberadoAoCliente ? 'Ocultar do Portal' : 'Liberar no Portal'}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-2.5 py-1 rounded border border-slate-300 text-slate-700 font-medium"
                      >
                        Imprimir PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA CUSTOS REFERENCIAIS */}
      {tab === 'custos' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Custos de Referência (SERMIG, CNJ e Registro Civil)</h2>
              <p className="text-xs text-slate-500">
                Estimativas utilizadas como referência nos orçamentos. Sempre confirmar nas fontes oficiais antes do fechamento.
              </p>
            </div>
            <button
              type="button"
              disabled={aiCustosLoading}
              onClick={handleConsultarCustosIa}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiCustosLoading ? aiCustosProgress || 'Consultando...' : 'Atualizar Referência com IA'}
            </button>
          </div>

          {aiCustosLoading && aiCustosProgress && (
            <p className="text-xs font-medium text-slate-600" role="status" aria-live="polite">
              {aiCustosProgress}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-500">Taxa SERMIG Mercosul</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(empresa.custosPadrao?.taxaSermigMercosulUsd, 'USD')}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-500">Apostila CNJ (média)</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(empresa.custosPadrao?.apostilaCnjBrl, 'BRL')}</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-slate-500">Tradução Juramentada (pág.)</p>
              <p className="text-lg font-bold tabular-nums">{formatCurrency(empresa.custosPadrao?.traducaoJuramentadaBrl, 'BRL')}</p>
            </div>
          </div>

          {custosDraft && (
            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  {custosDraft.fallback || custosDraft.origem === 'regras' ? (
                    <>
                      <span className="inline-block px-2.5 py-0.5 rounded bg-amber-100 border border-amber-300 font-bold text-amber-950">
                        {custosDraft.origemLabel || 'Rascunho gerado por regras — IA indisponível no momento'}
                      </span>
                      {custosDraft.mensagemUsuario && (
                        <p className="text-amber-900">{custosDraft.mensagemUsuario}</p>
                      )}
                    </>
                  ) : (
                    <p className="font-bold text-amber-900">
                      {custosDraft.origemLabel || 'Estimativa gerada pela IA'} (confirmar na fonte oficial antes de aprovar):
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={aiCustosLoading}
                  onClick={() => void handleConsultarCustosIa()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {aiCustosLoading ? aiCustosProgress || 'Tentando novamente...' : 'Tentar novamente com IA'}
                </button>
              </div>
              <p className="text-amber-900">{custosDraft.observacao}</p>
              <p className="tabular-nums">
                Mercosul: {formatCurrency(custosDraft.taxaSermigMercosulUsd, 'USD')} · Temporal:{' '}
                {formatCurrency(custosDraft.taxaSermigTemporalUsd, 'USD')} · Definitiva:{' '}
                {formatCurrency(custosDraft.taxaSermigDefinitivaUsd, 'USD')} · Apostila CNJ:{' '}
                {formatCurrency(custosDraft.apostilaCnjBrl, 'BRL')} · Cédula CLP:{' '}
                {formatCurrency(custosDraft.cedulaIdentidadeClp, 'CLP')}
              </p>
              {role === 'admin' && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleApproveCustos}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                  >
                    Aprovar e Salvar em Configurações
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustosDraft(null);
                      clearAiDraftCache('custos_padrao');
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs"
                  >
                    Descartar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal Novo Orçamento */}
      {budgetModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleCreateBudget} className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Novo Orçamento</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cliente *</label>
                <select
                  required
                  value={bClientId}
                  onChange={(e) => setBClientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">Título *</label>
                <input
                  required
                  value={bTitulo}
                  onChange={(e) => setBTitulo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tipo de cobrança</label>
                <select
                  value={bTipoCobranca}
                  onChange={(e) => setBTipoCobranca(e.target.value as Budget['tipoCobranca'])}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="Por Etapa Realizada">Por Etapa Realizada</option>
                  <option value="Por Serviço Escolhido">Por Serviço Escolhido</option>
                  <option value="Pacote Completo">Pacote Completo</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Moeda principal</label>
                <select
                  value={bMoeda}
                  onChange={(e) => setBMoeda(e.target.value as CurrencyCode)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                >
                  <option value="BRL">BRL (R$)</option>
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-700">Itens / Etapas</p>
              {bItems.map((it, idx) => (
                <div key={it.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <input
                    value={it.descricao}
                    onChange={(e) => {
                      const next = [...bItems];
                      next[idx] = { ...it, descricao: e.target.value };
                      setBItems(next);
                    }}
                    className="sm:col-span-2 px-2.5 py-1.5 rounded border border-slate-300 text-xs bg-white"
                  />
                  <input
                    type="number"
                    value={it.valorHonorarios}
                    onChange={(e) => {
                      const next = [...bItems];
                      next[idx] = { ...it, valorHonorarios: Number(e.target.value) };
                      setBItems(next);
                    }}
                    placeholder="Honorários"
                    className="px-2.5 py-1.5 rounded border border-slate-300 text-xs bg-white"
                  />
                  <input
                    type="number"
                    value={it.taxasEstimadasTerceiros}
                    onChange={(e) => {
                      const next = [...bItems];
                      next[idx] = { ...it, taxasEstimadasTerceiros: Number(e.target.value) };
                      setBItems(next);
                    }}
                    placeholder="Taxas est."
                    className="px-2.5 py-1.5 rounded border border-slate-300 text-xs bg-white"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBudgetModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Criar e Enviar ao Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Novo Lançamento */}
      {finModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleCreateFin} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Novo Lançamento Financeiro</h2>
            <select
              value={fClientId}
              onChange={(e) => setFClientId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
            >
              <option value="">Sem cliente vinculado</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nomeCompleto}
                </option>
              ))}
            </select>
            <input
              required
              value={fDesc}
              onChange={(e) => setFDesc(e.target.value)}
              placeholder="Descrição da parcela ou taxa..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <div className="grid grid-cols-3 gap-2">
              <select
                value={fMoeda}
                onChange={(e) => setFMoeda(e.target.value as CurrencyCode)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="BRL">BRL</option>
                <option value="CLP">CLP</option>
                <option value="USD">USD</option>
              </select>
              <input
                type="number"
                step="0.01"
                required
                value={fValor}
                onChange={(e) => setFValor(Number(e.target.value))}
                placeholder="Valor"
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
              />
              <input
                type="date"
                required
                value={fVenc}
                onChange={(e) => setFVenc(e.target.value)}
                className="px-2.5 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setFinModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Salvar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
