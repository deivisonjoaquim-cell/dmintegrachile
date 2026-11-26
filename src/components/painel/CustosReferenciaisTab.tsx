import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, RotateCcw, Save, Sparkles } from 'lucide-react';
import type { AiResponseMeta } from '../../utils/aiClient';
import type { CustosPadrao, EmpresaConfig, UserRole } from '../../types/domain';
import { estimateProcessThirdPartyCosts, type ThirdPartyCostEstimate, type ThirdPartyCostInput } from '../../utils/financeUtils';
import { formatCurrency } from '../../utils/formatters';

interface CustosReferenciaisTabProps {
  role: UserRole;
  empresa: EmpresaConfig;
  aiCustosLoading: boolean;
  aiCustosProgress: string | null;
  aiCustosError: string | null;
  approvingCustos: boolean;
  custosDraft: (CustosPadrao & AiResponseMeta) | null;
  onConsultarCustosIa: (forceRefresh?: boolean) => Promise<void>;
  onApproveCustos: () => Promise<void>;
  onDiscardCustosDraft: () => void;
  onSaveManualCustos: (payload: {
    custosPadrao: CustosPadrao;
    taxaCambioBrlClp: number;
    taxaCambioUsdBrl: number;
    honorariosPadraoMinBrl?: number;
    honorariosPadraoMaxBrl?: number;
  }) => Promise<void>;
  onCreateBudgetFromSimulation: (sim: {
    input: ThirdPartyCostInput;
    estimate: ThirdPartyCostEstimate;
  }) => void;
}

export const CustosReferenciaisTab: React.FC<CustosReferenciaisTabProps> = ({
  role,
  empresa,
  aiCustosLoading,
  aiCustosProgress,
  aiCustosError,
  approvingCustos,
  custosDraft,
  onConsultarCustosIa,
  onApproveCustos,
  onDiscardCustosDraft,
  onSaveManualCustos,
  onCreateBudgetFromSimulation,
}) => {
  const isAdmin = role === 'admin';

  // Form editável da tabela de referência & câmbio
  const [taxaMercosulUsd, setTaxaMercosulUsd] = useState<number>(empresa.custosPadrao?.taxaSermigMercosulUsd ?? 90);
  const [taxaTemporalUsd, setTaxaTemporalUsd] = useState<number>(empresa.custosPadrao?.taxaSermigTemporalUsd ?? 110);
  const [taxaDefinitivaUsd, setTaxaDefinitivaUsd] = useState<number>(empresa.custosPadrao?.taxaSermigDefinitivaUsd ?? 130);
  const [apostilaBrl, setApostilaBrl] = useState<number>(empresa.custosPadrao?.apostilaCnjBrl ?? 85);
  const [traducaoBrl, setTraducaoBrl] = useState<number>(empresa.custosPadrao?.traducaoJuramentadaBrl ?? 120);
  const [cedulaClp, setCedulaClp] = useState<number>(empresa.custosPadrao?.cedulaIdentidadeClp ?? 4270);
  const [brlClp, setBrlClp] = useState<number>(empresa.taxaCambioBrlClp ?? 170);
  const [usdBrl, setUsdBrl] = useState<number>(empresa.taxaCambioUsdBrl ?? 5.6);
  const [honMinBrl, setHonMinBrl] = useState<number>(empresa.honorariosPadraoMinBrl ?? 2800);
  const [honMaxBrl, setHonMaxBrl] = useState<number>(empresa.honorariosPadraoMaxBrl ?? 5800);
  const [observacao, setObservacao] = useState<string>(empresa.custosPadrao?.observacao || '');
  const [savingManual, setSavingManual] = useState(false);

  useEffect(() => {
    setTaxaMercosulUsd(empresa.custosPadrao?.taxaSermigMercosulUsd ?? 90);
    setTaxaTemporalUsd(empresa.custosPadrao?.taxaSermigTemporalUsd ?? 110);
    setTaxaDefinitivaUsd(empresa.custosPadrao?.taxaSermigDefinitivaUsd ?? 130);
    setApostilaBrl(empresa.custosPadrao?.apostilaCnjBrl ?? 85);
    setTraducaoBrl(empresa.custosPadrao?.traducaoJuramentadaBrl ?? 120);
    setCedulaClp(empresa.custosPadrao?.cedulaIdentidadeClp ?? 4270);
    setBrlClp(empresa.taxaCambioBrlClp ?? 170);
    setUsdBrl(empresa.taxaCambioUsdBrl ?? 5.6);
    setHonMinBrl(empresa.honorariosPadraoMinBrl ?? 2800);
    setHonMaxBrl(empresa.honorariosPadraoMaxBrl ?? 5800);
    setObservacao(empresa.custosPadrao?.observacao || '');
  }, [empresa]);

  // Simulador rápido de custos de terceiros
  const [simVisaType, setSimVisaType] = useState<ThirdPartyCostInput['visaType']>('mercosul');
  const [simPessoas, setSimPessoas] = useState<number>(1);
  const [simApostilas, setSimApostilas] = useState<number>(3);
  const [simPaginasTrad, setSimPaginasTrad] = useState<number>(0);
  const [simIncluirCedula, setSimIncluirCedula] = useState<boolean>(true);

  const liveCustos: CustosPadrao = useMemo(
    () => ({
      taxaSermigMercosulUsd: taxaMercosulUsd,
      taxaSermigTemporalUsd: taxaTemporalUsd,
      taxaSermigDefinitivaUsd: taxaDefinitivaUsd,
      apostilaCnjBrl: apostilaBrl,
      traducaoJuramentadaBrl: traducaoBrl,
      cedulaIdentidadeClp: cedulaClp,
      observacao,
    }),
    [taxaMercosulUsd, taxaTemporalUsd, taxaDefinitivaUsd, apostilaBrl, traducaoBrl, cedulaClp, observacao],
  );

  const simInput: ThirdPartyCostInput = useMemo(
    () => ({
      visaType: simVisaType,
      pessoas: simPessoas,
      apostilasPorPessoa: simApostilas,
      paginasTraducaoTotal: simPaginasTrad,
      incluirCedulaRut: simIncluirCedula,
    }),
    [simVisaType, simPessoas, simApostilas, simPaginasTrad, simIncluirCedula],
  );

  const simEstimate = useMemo(
    () => estimateProcessThirdPartyCosts(simInput, liveCustos, { brlClp, usdBrl }),
    [simInput, liveCustos, brlClp, usdBrl],
  );

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || savingManual) return;
    setSavingManual(true);
    try {
      await onSaveManualCustos({
        custosPadrao: {
          ...empresa.custosPadrao,
          taxaSermigMercosulUsd: Number(taxaMercosulUsd) || 0,
          taxaSermigTemporalUsd: Number(taxaTemporalUsd) || 0,
          taxaSermigDefinitivaUsd: Number(taxaDefinitivaUsd) || 0,
          apostilaCnjBrl: Number(apostilaBrl) || 0,
          traducaoJuramentadaBrl: Number(traducaoBrl) || 0,
          cedulaIdentidadeClp: Number(cedulaClp) || 0,
          observacao: observacao.trim(),
          atualizadoEm: new Date().toISOString(),
          fonteObservacao: 'Atualização direta pelo administrador na aba Custos & Câmbio',
        },
        taxaCambioBrlClp: Number(brlClp) > 0 ? Number(brlClp) : 170,
        taxaCambioUsdBrl: Number(usdBrl) > 0 ? Number(usdBrl) : 5.6,
        honorariosPadraoMinBrl: Number(honMinBrl) || 0,
        honorariosPadraoMaxBrl: Number(honMaxBrl) || 0,
      });
    } finally {
      setSavingManual(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Bloco 1: Tabela de Custos Oficiais & Câmbio */}
      <form
        onSubmit={handleSaveManual}
        className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Tabela de Custos Referenciais (SERMIG, CNJ, Registro Civil) &amp; Câmbio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Estes parâmetros calibram automaticamente os modelos de orçamento, o consolidado multimoeda e o simulador abaixo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={aiCustosLoading}
              onClick={() => void onConsultarCustosIa(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {aiCustosLoading ? aiCustosProgress || 'Consultando...' : 'Atualizar Referência com IA'}
            </button>
            {isAdmin && (
              <button
                type="submit"
                disabled={savingManual}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Save className="w-3.5 h-3.5" />
                {savingManual ? 'Salvando...' : 'Salvar Tabela & Câmbio'}
              </button>
            )}
          </div>
        </div>

        {aiCustosLoading && aiCustosProgress && (
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
            {aiCustosProgress}
          </p>
        )}

        {aiCustosError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-[#C82333] dark:text-red-300 font-medium flex flex-wrap items-center justify-between gap-2">
            <span>{aiCustosError}</span>
            <button
              type="button"
              disabled={aiCustosLoading}
              onClick={() => void onConsultarCustosIa(true)}
              className="px-2.5 py-1 rounded border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 text-[#C82333] dark:text-red-300 font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Grade de parâmetros editáveis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">SERMIG Mercosul (USD)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={!isAdmin}
              value={taxaMercosulUsd}
              onChange={(e) => setTaxaMercosulUsd(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">SERMIG Temporal (USD)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={!isAdmin}
              value={taxaTemporalUsd}
              onChange={(e) => setTaxaTemporalUsd(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">SERMIG Definitiva (USD)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={!isAdmin}
              value={taxaDefinitivaUsd}
              onChange={(e) => setTaxaDefinitivaUsd(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Apostila CNJ (BRL)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={!isAdmin}
              value={apostilaBrl}
              onChange={(e) => setApostilaBrl(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Tradução Juram. (BRL/pág.)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              disabled={!isAdmin}
              value={traducaoBrl}
              onChange={(e) => setTraducaoBrl(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>

          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Cédula RUT (CLP)</span>
            <input
              type="number"
              step="10"
              min="0"
              disabled={!isAdmin}
              value={cedulaClp}
              onChange={(e) => setCedulaClp(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Câmbio USD → BRL</span>
            <input
              type="number"
              step="0.01"
              min="0.1"
              disabled={!isAdmin}
              value={usdBrl}
              onChange={(e) => setUsdBrl(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Câmbio BRL → CLP</span>
            <input
              type="number"
              step="1"
              min="1"
              disabled={!isAdmin}
              value={brlClp}
              onChange={(e) => setBrlClp(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Honorários Ref. Mín (BRL)</span>
            <input
              type="number"
              step="50"
              min="0"
              disabled={!isAdmin}
              value={honMinBrl}
              onChange={(e) => setHonMinBrl(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Honorários Ref. Máx (BRL)</span>
            <input
              type="number"
              step="50"
              min="0"
              disabled={!isAdmin}
              value={honMaxBrl}
              onChange={(e) => setHonMaxBrl(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-70"
            />
          </label>
        </div>

        <label className="block space-y-1 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Nota de Referência / Fonte Oficial</span>
          <input
            type="text"
            disabled={!isAdmin}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: Valores conferidos no portal SERMIG e CNJ — confirmar câmbio comercial na emissão."
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white disabled:opacity-70"
          />
        </label>

        {/* Sugestão da IA com comparativo lado a lado */}
        {custosDraft && (
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <p className="font-bold text-amber-950 dark:text-amber-200">
                  {custosDraft.origemLabel || 'Estimativa referencial sugerida'}
                  {custosDraft.fromCache ? ' · Cache local' : ''}
                </p>
                {custosDraft.mensagemUsuario && (
                  <p className="text-amber-900/90 dark:text-amber-300/90">{custosDraft.mensagemUsuario}</p>
                )}
              </div>
              <button
                type="button"
                disabled={aiCustosLoading || approvingCustos}
                onClick={() => void onConsultarCustosIa(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {aiCustosLoading ? 'Atualizando...' : 'Consultar novamente'}
              </button>
            </div>
            {custosDraft.observacao && (
              <p className="text-amber-950 dark:text-amber-200 leading-relaxed">{custosDraft.observacao}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 font-mono tabular-nums">
              {[
                { label: 'Mercosul', cur: empresa.custosPadrao?.taxaSermigMercosulUsd, next: custosDraft.taxaSermigMercosulUsd, unit: 'USD' as const },
                { label: 'Temporal', cur: empresa.custosPadrao?.taxaSermigTemporalUsd, next: custosDraft.taxaSermigTemporalUsd, unit: 'USD' as const },
                { label: 'Definitiva', cur: empresa.custosPadrao?.taxaSermigDefinitivaUsd, next: custosDraft.taxaSermigDefinitivaUsd, unit: 'USD' as const },
                { label: 'Apostila CNJ', cur: empresa.custosPadrao?.apostilaCnjBrl, next: custosDraft.apostilaCnjBrl, unit: 'BRL' as const },
                { label: 'Tradução', cur: empresa.custosPadrao?.traducaoJuramentadaBrl, next: custosDraft.traducaoJuramentadaBrl, unit: 'BRL' as const },
                { label: 'Cédula RUT', cur: empresa.custosPadrao?.cedulaIdentidadeClp, next: custosDraft.cedulaIdentidadeClp, unit: 'CLP' as const },
              ].map((row) => (
                <div
                  key={row.label}
                  className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 space-y-0.5"
                >
                  <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400">{row.label}</p>
                  <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(row.next, row.unit)}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Atual: {formatCurrency(row.cur, row.unit)}
                  </p>
                </div>
              ))}
            </div>
            {isAdmin && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  disabled={approvingCustos}
                  onClick={() => void onApproveCustos()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34] hover:bg-[#176429] disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {approvingCustos ? 'Salvando...' : 'Aprovar e Aplicar na Tabela'}
                </button>
                <button
                  type="button"
                  disabled={approvingCustos}
                  onClick={onDiscardCustosDraft}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs font-medium disabled:opacity-50"
                >
                  Descartar
                </button>
              </div>
            )}
          </div>
        )}
      </form>

      {/* Bloco 2: Simulador Rápido de Custos de Terceiros */}
      <div className="bg-white dark:bg-[#0D1422] border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[var(--color-primary)]" />
              Simulador Rápido de Taxas e Desembolsos de Terceiros
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Estime instantaneamente quanto o cliente gastará com SERMIG, apostilamentos CNJ, traduções e cédula RUT e transforme em orçamento.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCreateBudgetFromSimulation({ input: simInput, estimate: simEstimate })}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Criar Orçamento com esta Simulação
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controles */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Modalidade SERMIG</span>
              <select
                value={simVisaType}
                onChange={(e) => setSimVisaType(e.target.value as ThirdPartyCostInput['visaType'])}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="mercosul">Residência Temporal — Acordo Mercosul</option>
                <option value="temporal">Residência Temporal (Trabalho, Vínculo, Renda)</option>
                <option value="definitiva">Residência Definitiva</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Pessoas no Processo (Titular + Dep.)</span>
              <input
                type="number"
                min={1}
                max={12}
                value={simPessoas}
                onChange={(e) => setSimPessoas(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Apostilas CNJ por pessoa</span>
              <input
                type="number"
                min={0}
                max={20}
                value={simApostilas}
                onChange={(e) => setSimApostilas(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
              />
            </label>
            <label className="block space-y-1">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Páginas de Tradução Juramentada (total)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={simPaginasTrad}
                onChange={(e) => setSimPaginasTrad(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tabular-nums"
              />
            </label>
            <label className="sm:col-span-2 inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={simIncluirCedula}
                onChange={(e) => setSimIncluirCedula(e.target.checked)}
                className="rounded border-slate-300"
              />
              Incluir emissão da Cédula de Identidade para Estrangeiros (RUT — Registro Civil Chile)
            </label>
          </div>

          {/* Resultado */}
          <div className="lg:col-span-5 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
            <p className="font-semibold text-slate-900 dark:text-white">Resumo Estimado de Desembolsos</p>
            <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between gap-2">
                <span>Taxa SERMIG ({simPessoas}x · {formatCurrency(simEstimate.sermigUsd, 'USD')})</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(simEstimate.sermigBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Apostilas CNJ ({simApostilas * simPessoas} un.)</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(simEstimate.apostilasBrl, 'BRL')}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Tradução Juramentada ({simPaginasTrad} pág.)</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                  {formatCurrency(simEstimate.traducoesBrl, 'BRL')}
                </span>
              </div>
              {simIncluirCedula && (
                <div className="flex justify-between gap-2">
                  <span>Cédula RUT ({formatCurrency(simEstimate.cedulaClp, 'CLP')})</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(simEstimate.cedulaBrl, 'BRL')}
                  </span>
                </div>
              )}
            </div>
            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="font-bold text-slate-900 dark:text-white">Total Terceiros (BRL)</span>
                <span className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(simEstimate.totalBrl, 'BRL')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Equivalente: {formatCurrency(simEstimate.totalUsd, 'USD')} · {formatCurrency(simEstimate.totalClp, 'CLP')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
