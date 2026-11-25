import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CalendarClock,
  CheckCircle2,
  Coins,
  FileCheck2,
  Info,
  Lock,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  Users,
} from 'lucide-react';
import type { Case, Client, Dependent, EmpresaConfig, VisaCategory, VisaRequirement } from '../types/domain';
import { formatCurrency, formatDateBR } from '../utils/formatters';
import {
  runSermigSimulation,
  type SermigCurrency,
  type SermigLocationOption,
} from '../utils/sermigSimulator';

export interface SermigSimulatorProps {
  mode: 'client' | 'admin';
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  empresa?: Partial<EmpresaConfig>;
  /** Em modo cliente: cliente autenticado e seu caso/dependentes */
  client?: Client | null;
  activeCase?: Case | null;
  dependents?: Dependent[];
  /** Em modo admin: lista completa de clientes/casos/dependentes + handler para liberar/bloquear simulador */
  clients?: Client[];
  cases?: Case[];
  allDependents?: Dependent[];
  canManageRelease?: boolean;
  onToggleClientSimulatorAccess?: (client: Client, nextEnabled: boolean) => Promise<void>;
}

function defaultTargetDateIso(): string {
  const dt = new Date(Date.now() + 60 * 86_400_000);
  return dt.toISOString().slice(0, 10);
}

export const SermigSimulator: React.FC<SermigSimulatorProps> = ({
  mode,
  visaCategories,
  visaRequirements,
  empresa,
  client,
  activeCase,
  dependents = [],
  clients = [],
  cases = [],
  allDependents = [],
  canManageRelease = false,
  onToggleClientSimulatorAccess,
}) => {
  const activeVisas = useMemo(
    () => visaCategories.filter((v) => v.ativo !== false),
    [visaCategories],
  );

  const initialVisaId = useMemo(() => {
    if (activeCase?.visaCategoryId && activeVisas.some((v) => v.id === activeCase.visaCategoryId)) {
      return activeCase.visaCategoryId;
    }
    const mercosul = activeVisas.find((v) => v.codigo === '15');
    return mercosul?.id || activeVisas[0]?.id || '';
  }, [activeCase?.visaCategoryId, activeVisas]);

  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [visaId, setVisaId] = useState<string>(initialVisaId);
  const [localizacaoAtual, setLocalizacaoAtual] = useState<SermigLocationOption>('brasil_exterior');
  const [dataAlvoProtocolo, setDataAlvoProtocolo] = useState<string>(
    client?.dataPrevistaMudanca?.slice(0, 10) || defaultTargetDateIso(),
  );
  const [quantidadeDependentes, setQuantidadeDependentes] = useState<number>(dependents.length);
  const [possuiAntecedentesLimpos, setPossuiAntecedentesLimpos] = useState<boolean>(true);
  const [possuiPassaporteValido12m, setPossuiPassaporteValido12m] = useState<boolean>(true);
  const [possuiComprovacaoFinanceiraOuContrato, setPossuiComprovacaoFinanceiraOuContrato] = useState<boolean>(true);
  const [vinculoFamiliarChile, setVinculoFamiliarChile] = useState<boolean>(false);
  const [moedaExibicao, setMoedaExibicao] = useState<SermigCurrency>('BRL');

  // Admin client release management state
  const [clientReleaseSearch, setClientReleaseSearch] = useState('');
  const [clientReleaseFilter, setClientReleaseFilter] = useState<'all' | 'liberado' | 'bloqueado'>('all');
  const [togglingClientId, setTogglingClientId] = useState<string | null>(null);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  const handleLoadClientScenario = (targetClientId: string) => {
    setSelectedClientId(targetClientId);
    if (!targetClientId) return;
    const foundClient = clients.find((c) => c.id === targetClientId);
    if (!foundClient) return;

    const clientCase = cases.find((cs) => cs.clientId === foundClient.id && !cs.arquivado);
    const clientDeps = allDependents.filter((d) => d.clientId === foundClient.id);

    if (clientCase?.visaCategoryId && activeVisas.some((v) => v.id === clientCase.visaCategoryId)) {
      setVisaId(clientCase.visaCategoryId);
    }
    setQuantidadeDependentes(Math.min(8, clientDeps.length));
    if (foundClient.dataPrevistaMudanca && /^\d{4}-\d{2}-\d{2}/.test(foundClient.dataPrevistaMudanca)) {
      setDataAlvoProtocolo(foundClient.dataPrevistaMudanca.slice(0, 10));
    }
  };

  const simulation = useMemo(
    () =>
      runSermigSimulation(
        {
          visaId,
          localizacaoAtual,
          dataAlvoProtocolo,
          quantidadeDependentes,
          possuiAntecedentesLimpos,
          possuiPassaporteValido12m,
          possuiComprovacaoFinanceiraOuContrato,
          vinculoFamiliarChile,
          moedaExibicao,
        },
        activeVisas,
        visaRequirements,
        empresa,
      ),
    [
      visaId,
      localizacaoAtual,
      dataAlvoProtocolo,
      quantidadeDependentes,
      possuiAntecedentesLimpos,
      possuiPassaporteValido12m,
      possuiComprovacaoFinanceiraOuContrato,
      vinculoFamiliarChile,
      moedaExibicao,
      activeVisas,
      visaRequirements,
      empresa,
    ],
  );

  const managedClients = useMemo(() => {
    const q = clientReleaseSearch.trim().toLowerCase();
    return clients
      .filter((c) => !c.arquivado)
      .filter((c) => {
        if (clientReleaseFilter === 'liberado' && c.simuladorSermigLiberado !== true) return false;
        if (clientReleaseFilter === 'bloqueado' && c.simuladorSermigLiberado === true) return false;
        if (!q) return true;
        return (
          (c.nomeCompleto || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.cpf || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  }, [clients, clientReleaseSearch, clientReleaseFilter]);

  const releasedClientsCount = useMemo(
    () => clients.filter((c) => !c.arquivado && c.simuladorSermigLiberado === true).length,
    [clients],
  );

  const handleToggleRelease = async (target: Client) => {
    if (!onToggleClientSimulatorAccess || togglingClientId) return;
    const nextEnabled = target.simuladorSermigLiberado !== true;
    setTogglingClientId(target.id);
    setAdminFeedback(null);
    try {
      await onToggleClientSimulatorAccess(target, nextEnabled);
      setAdminFeedback(
        nextEnabled
          ? `Simulador SERMIG liberado para ${target.nomeCompleto}.`
          : `Acesso ao Simulador SERMIG revogado para ${target.nomeCompleto}.`,
      );
    } catch (err) {
      setAdminFeedback(
        err instanceof Error ? err.message : 'Não foi possível atualizar a liberação do simulador.',
      );
    } finally {
      setTogglingClientId(null);
    }
  };

  const displayTotal =
    moedaExibicao === 'BRL'
      ? formatCurrency(simulation.custos.totalBrl, 'BRL')
      : moedaExibicao === 'CLP'
        ? formatCurrency(simulation.custos.totalClp, 'CLP')
        : formatCurrency(simulation.custos.totalUsd, 'USD');

  const statusTone =
    simulation.elegibilidadeStatus === 'elegivel'
      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
      : simulation.elegibilidadeStatus === 'condicional'
        ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
        : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200';

  return (
    <div className="space-y-6" data-testid={`sermig-simulator-${mode}`}>
      {/* Cabeçalho do Simulador SERMIG */}
      <section className="rounded-2xl bg-[#090F1A] dark:bg-[#0D1524] border border-white/10 dark:border-[#1E293B] p-6 text-white shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#34D399]">
              <Calculator className="w-3.5 h-3.5" aria-hidden="true" />
              {mode === 'admin'
                ? 'Área Técnica da Equipe · Simulador SERMIG'
                : 'Ferramenta Exclusiva Liberada · Simulador SERMIG'}
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-white">
              Simulador de Cenários Migratórios SERMIG (Chile)
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Simule elegibilidade conforme a <strong className="text-white">Ley Nº 21.325</strong> e{' '}
              <strong className="text-white">Decreto Nº 177/2022</strong>, calcule o cronograma reverso das janelas
              críticas (60d Polícia Federal, 90d Estampado, 30d PDI) e estime taxas oficiais em BRL, CLP e USD.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {(['BRL', 'CLP', 'USD'] as SermigCurrency[]).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => setMoedaExibicao(cur)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors ${
                  moedaExibicao === cur
                    ? 'bg-[#10B981] text-[#041C16]'
                    : 'bg-white/10 text-slate-200 hover:bg-white/15'
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>

        {/* Barra de carregamento de perfil de cliente no modo Admin */}
        {mode === 'admin' && clients.length > 0 && (
          <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <Sparkles className="w-4 h-4 text-[#D4A853] shrink-0" aria-hidden="true" />
              <span>Carregar dados reais de um cliente para simulação rápida:</span>
            </div>
            <select
              aria-label="Selecionar cliente para carregar no simulador"
              value={selectedClientId}
              onChange={(e) => handleLoadClientScenario(e.target.value)}
              className="px-3 py-2 rounded-lg bg-[#131F33] border border-white/15 text-xs font-medium text-white min-w-[240px] max-w-full focus:outline-none focus:border-[#10B981]"
            >
              <option value="">Simulação avulsa (parâmetros livres)</option>
              {clients
                .filter((c) => !c.arquivado)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeCompleto} ({c.simuladorSermigLiberado ? 'Simulador Liberado' : 'Bloqueado'})
                  </option>
                ))}
            </select>
          </div>
        )}
      </section>

      {/* Grid principal: Parâmetros (esquerda) + Resultados em Tempo Real (direita) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Coluna de Parâmetros */}
        <section
          aria-label="Parâmetros da simulação SERMIG"
          className="xl:col-span-5 bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl p-5 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#E2E8F0] dark:border-[#1E293B]">
            <h3 className="text-sm font-bold text-[#090F1A] dark:text-white">Parâmetros do Cenário</h3>
            <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
              Cálculo em tempo real
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="sim-visa" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Subcategoria SERMIG
            </label>
            <select
              id="sim-visa"
              value={visaId}
              onChange={(e) => setVisaId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090F1A] text-xs sm:text-sm text-[#090F1A] dark:text-slate-100 focus:outline-none focus:border-[#10B981]"
            >
              {activeVisas.map((v) => (
                <option key={v.id} value={v.id}>
                  [{v.codigo}] {v.nomePortugues}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
              Localização no momento do protocolo
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  { id: 'brasil_exterior', label: 'Brasil / Exterior' },
                  { id: 'chile_turista', label: 'Chile (Turista)' },
                  { id: 'chile_residente', label: 'Chile (Residente)' },
                ] as { id: SermigLocationOption; label: string }[]
              ).map((opt) => {
                const active = localizacaoAtual === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLocalizacaoAtual(opt.id)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#090F1A] dark:bg-[#10B981] text-white dark:text-[#041C16] border-[#090F1A] dark:border-[#10B981]'
                        : 'bg-[#F8FAFC] dark:bg-[#131F33] text-[#334155] dark:text-slate-300 border-[#E2E8F0] dark:border-[#1E293B] hover:border-[#10B981]/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="sim-date" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                Data-alvo de protocolo
              </label>
              <input
                id="sim-date"
                type="date"
                value={dataAlvoProtocolo}
                onChange={(e) => setDataAlvoProtocolo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090F1A] text-xs sm:text-sm font-mono text-[#090F1A] dark:text-slate-100 focus:outline-none focus:border-[#10B981]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sim-deps" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                Dependentes acompanhantes
              </label>
              <input
                id="sim-deps"
                type="number"
                min={0}
                max={8}
                value={quantidadeDependentes}
                onChange={(e) => setQuantidadeDependentes(Math.max(0, Math.min(8, Number(e.target.value) || 0)))}
                className="w-full px-3 py-2 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090F1A] text-xs sm:text-sm font-mono text-[#090F1A] dark:text-slate-100 focus:outline-none focus:border-[#10B981]"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-[#E2E8F0] dark:border-[#1E293B]">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
              Requisitos &amp; Condições Legais
            </p>
            {[
              {
                id: 'sim-antecedentes',
                checked: possuiAntecedentesLimpos,
                onChange: setPossuiAntecedentesLimpos,
                label: 'Certidão de Antecedentes Criminais (PF) sem registros',
              },
              {
                id: 'sim-passaporte',
                checked: possuiPassaporteValido12m,
                onChange: setPossuiPassaporteValido12m,
                label: 'Passaporte válido por mais de 12 meses',
              },
              {
                id: 'sim-renda',
                checked: possuiComprovacaoFinanceiraOuContrato,
                onChange: setPossuiComprovacaoFinanceiraOuContrato,
                label: 'Possui comprovação financeira, contrato ou matrícula (se exigido)',
              },
              {
                id: 'sim-vinculo',
                checked: vinculoFamiliarChile,
                onChange: setVinculoFamiliarChile,
                label: 'Possui vínculo familiar formalizado com chileno/residente no Chile',
              },
            ].map((item) => (
              <label
                key={item.id}
                htmlFor={item.id}
                className="flex items-start gap-2.5 text-xs text-[#334155] dark:text-slate-300 cursor-pointer"
              >
                <input
                  id={item.id}
                  type="checkbox"
                  checked={item.checked}
                  onChange={(e) => item.onChange(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 dark:border-slate-600 accent-[#10B981]"
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>

          {/* Documentos-chave da subcategoria */}
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400 flex items-center gap-1.5">
              <FileCheck2 className="w-3.5 h-3.5 text-[#10B981]" aria-hidden="true" />
              Checklist Base da Subcategoria ({simulation.documentosChave.length})
            </p>
            <ul className="space-y-1.5">
              {simulation.documentosChave.map((doc) => (
                <li
                  key={doc.nome}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs px-3 py-2 rounded-lg bg-[#F8FAFC] dark:bg-[#131F33]/70 border border-[#E2E8F0] dark:border-[#1E293B]"
                >
                  <span className="font-medium text-[#0F172A] dark:text-slate-100">{doc.nome}</span>
                  <span className="flex items-center gap-1.5 text-[10px] font-mono text-[#64748B] dark:text-slate-400">
                    {doc.validadeDias ? `${doc.validadeDias}d` : ''}
                    {doc.exigeApostila ? ' · Apostila' : ''}
                    {doc.exigeTraducao ? ' · Tradução' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Coluna de Resultados */}
        <div className="xl:col-span-7 space-y-5">
          {/* Veredito & KPIs */}
          <section className={`rounded-2xl border p-5 space-y-4 ${statusTone}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                  {simulation.elegibilidadeStatus === 'elegivel' ? (
                    <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                  ) : simulation.elegibilidadeStatus === 'condicional' ? (
                    <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                  )}
                  {simulation.elegibilidadeLabel}
                </div>
                <h3 className="font-display text-lg font-bold">
                  [{simulation.visa.codigo}] {simulation.visa.nomePortugues}
                </h3>
                <p className="text-xs leading-relaxed opacity-90">{simulation.resumoExecutivo}</p>
              </div>

              <div className="px-4 py-2.5 rounded-xl bg-white/80 dark:bg-[#090F1A]/70 border border-current/15 text-right shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-75">Aderência Legal</p>
                <p className="font-mono text-2xl font-bold tabular-nums">
                  {simulation.pontuacaoAdesao}
                  <span className="text-xs font-normal opacity-75">/100</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
              <div className="rounded-xl bg-white/75 dark:bg-[#090F1A]/60 px-3 py-2 border border-current/10">
                <p className="text-[10px] uppercase opacity-75">Permite Trabalhar</p>
                <p className="text-xs font-bold mt-0.5">{simulation.visa.permiteTrabalhar ? 'Sim' : 'Restrito'}</p>
              </div>
              <div className="rounded-xl bg-white/75 dark:bg-[#090F1A]/60 px-3 py-2 border border-current/10">
                <p className="text-[10px] uppercase opacity-75">Dentro do Chile</p>
                <p className="text-xs font-bold mt-0.5">{simulation.visa.permiteDentroChile}</p>
              </div>
              <div className="rounded-xl bg-white/75 dark:bg-[#090F1A]/60 px-3 py-2 border border-current/10">
                <p className="text-[10px] uppercase opacity-75">Leva à Definitiva</p>
                <p className="text-xs font-bold mt-0.5">
                  {simulation.visa.levaDefinitiva ? `Sim (${simulation.visa.mesesDefinitiva || 24}m)` : 'Não direta'}
                </p>
              </div>
              <div className="rounded-xl bg-white/75 dark:bg-[#090F1A]/60 px-3 py-2 border border-current/10">
                <p className="text-[10px] uppercase opacity-75">Análise Estimada</p>
                <p className="text-xs font-bold font-mono tabular-nums mt-0.5">
                  {simulation.prazoEstimadoAnaliseMeses.min}–{simulation.prazoEstimadoAnaliseMeses.max} meses
                </p>
              </div>
            </div>
          </section>

          {/* Alertas Legais */}
          {simulation.alertasLegais.length > 0 && (
            <section className="bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-bold text-[#090F1A] dark:text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-[#10B981]" aria-hidden="true" />
                Enquadramento &amp; Alertas Normativos
              </h3>
              <div className="space-y-2.5">
                {simulation.alertasLegais.map((al, idx) => (
                  <div
                    key={`${al.titulo}-${idx}`}
                    className={`rounded-xl p-3.5 border text-xs space-y-1 ${
                      al.nivel === 'critico'
                        ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200'
                        : al.nivel === 'atencao'
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
                          : 'bg-[#F8FAFC] dark:bg-[#131F33]/70 border-[#E2E8F0] dark:border-[#1E293B] text-[#334155] dark:text-slate-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">{al.titulo}</p>
                      <span className="font-mono text-[10px] opacity-80">{al.baseLegal}</span>
                    </div>
                    <p className="leading-relaxed opacity-90">{al.detalhe}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Estimativa de Taxas & Custos Oficiais */}
          <section className="bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#090F1A] dark:text-white flex items-center gap-2">
                  <Coins className="w-4 h-4 text-[#D4A853]" aria-hidden="true" />
                  Estimativa de Taxas Oficiais ({simulation.custos.totalPessoas}{' '}
                  {simulation.custos.totalPessoas === 1 ? 'pessoa' : 'pessoas'})
                </h3>
                <p className="text-[11px] text-[#64748B] dark:text-slate-400 mt-0.5">
                  Valores governamentais/cartoriais referenciais (não incluem honorários de consultoria).
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                  Total Estimado ({moedaExibicao})
                </p>
                <p className="font-mono text-xl font-bold text-[#047857] dark:text-[#34D399] tabular-nums">
                  {displayTotal}
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl overflow-hidden">
              {simulation.custos.itens.map((item) => {
                const valueStr =
                  moedaExibicao === 'BRL'
                    ? formatCurrency(item.valorBrl, 'BRL')
                    : moedaExibicao === 'CLP'
                      ? formatCurrency(item.valorClp, 'CLP')
                      : formatCurrency(item.valorUsd, 'USD');
                return (
                  <div
                    key={item.item}
                    className="p-3 bg-[#F8FAFC]/60 dark:bg-[#131F33]/40 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#090F1A] dark:text-slate-100">{item.item}</p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400">{item.detalhe}</p>
                    </div>
                    <span className="font-mono font-bold text-[#090F1A] dark:text-slate-100 tabular-nums shrink-0">
                      {valueStr}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Cronograma Reverso SERMIG */}
          <section className="bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-[#090F1A] dark:text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-[#10B981]" aria-hidden="true" />
                Cronograma Reverso &amp; Prazos Legais
              </h3>
              <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                Protocolo-alvo: {formatDateBR(dataAlvoProtocolo)}
              </span>
            </div>

            <ol className="space-y-2.5">
              {simulation.cronogramaReverso.map((step) => (
                <li
                  key={step.ordem}
                  className="flex items-start gap-3 p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#131F33]/60 border border-[#E2E8F0] dark:border-[#1E293B]"
                >
                  <span className="w-6 h-6 rounded-lg bg-[#090F1A] dark:bg-[#10B981] text-white dark:text-[#041C16] font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    0{step.ordem}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-[#090F1A] dark:text-white">{step.marco}</p>
                      <span className="font-mono text-[11px] font-semibold text-[#047857] dark:text-[#34D399] tabular-nums">
                        {formatDateBR(step.dataSugeridaIso)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#475569] dark:text-slate-300">{step.janelaLegal}</p>
                    {step.alerta && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">{step.alerta}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>

      {/* Painel exclusivo do Administrador: Controle de Liberação do Simulador para Clientes */}
      {mode === 'admin' && (
        <section
          aria-label="Controle de liberação do Simulador SERMIG para clientes"
          className="bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#047857] dark:text-[#34D399]">
                Permissões do Portal do Cliente
              </p>
              <h3 className="font-display text-lg font-bold text-[#090F1A] dark:text-white mt-0.5 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#10B981]" aria-hidden="true" />
                Liberação do Simulador SERMIG por Cliente
              </h3>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                O Simulador SERMIG só aparece no Portal do Cliente quando liberado expressamente aqui (ou no dossiê do cliente).
              </p>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#131F33] border border-[#E2E8F0] dark:border-[#1E293B] text-xs font-mono shrink-0">
              <span className="font-bold text-[#047857] dark:text-[#34D399] tabular-nums">{releasedClientsCount}</span>
              <span className="text-[#64748B] dark:text-slate-400">
                {' '}
                de {clients.filter((c) => !c.arquivado).length} liberado(s)
              </span>
            </div>
          </div>

          {adminFeedback && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                {adminFeedback}
              </span>
              <button
                type="button"
                onClick={() => setAdminFeedback(null)}
                className="underline font-semibold shrink-0"
              >
                Fechar
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
              <input
                type="search"
                value={clientReleaseSearch}
                onChange={(e) => setClientReleaseSearch(e.target.value)}
                placeholder="Buscar cliente por nome, e-mail ou CPF..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090F1A] text-xs text-[#090F1A] dark:text-slate-100 focus:outline-none focus:border-[#10B981]"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {(
                [
                  { id: 'all', label: 'Todos' },
                  { id: 'liberado', label: 'Liberados' },
                  { id: 'bloqueado', label: 'Bloqueados' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setClientReleaseFilter(f.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    clientReleaseFilter === f.id
                      ? 'bg-[#090F1A] dark:bg-[#10B981] text-white dark:text-[#041C16] border-transparent'
                      : 'bg-white dark:bg-[#131F33] text-[#475569] dark:text-slate-300 border-[#E2E8F0] dark:border-[#1E293B]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {managedClients.length === 0 ? (
            <p className="text-xs text-[#64748B] dark:text-slate-400 py-6 text-center">
              Nenhum cliente encontrado para o filtro atual.
            </p>
          ) : (
            <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl overflow-hidden max-h-[360px] overflow-y-auto">
              {managedClients.map((cl) => {
                const isReleased = cl.simuladorSermigLiberado === true;
                const isBusy = togglingClientId === cl.id;
                return (
                  <div
                    key={cl.id}
                    className="p-3.5 bg-white dark:bg-[#0D1524] hover:bg-[#F8FAFC] dark:hover:bg-[#131F33]/50 flex flex-wrap items-center justify-between gap-3 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[#090F1A] dark:text-white truncate">
                        {cl.nomeCompleto}
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-slate-400 truncate">
                        {cl.email} · Portal: {cl.portalLiberado ? 'Liberado' : cl.statusAcessoPortal}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold ${
                          isReleased
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isReleased ? (
                          <Unlock className="w-3 h-3" aria-hidden="true" />
                        ) : (
                          <Lock className="w-3 h-3" aria-hidden="true" />
                        )}
                        {isReleased ? 'Liberado' : 'Bloqueado'}
                      </span>
                      {canManageRelease && onToggleClientSimulatorAccess && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleToggleRelease(cl)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                            isReleased
                              ? 'border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              : 'bg-[#090F1A] dark:bg-[#10B981] text-white dark:text-[#041C16] hover:opacity-90'
                          }`}
                        >
                          {isBusy ? 'Salvando...' : isReleased ? 'Revogar' : 'Liberar Simulador'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
