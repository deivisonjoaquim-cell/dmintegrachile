import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FileDown, ListTodo, Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Case, CaseDocument, Client, EmpresaConfig, Task } from '../../types/domain';
import { computeClientTaskProgress } from '../../utils/taskProgressMetrics';
import { exportResumoProcessoClientePdf } from '../pdf/ClientPortalPdfDocuments';

interface PainelProgressoTarefasChartProps {
  empresa: EmpresaConfig;
  tasks: Task[];
  cases: Case[];
  clients: Client[];
  docs: CaseDocument[];
  selectedCaseId?: string | null;
  onOpenAgenda?: () => void;
  onOpenCase?: (caseId: string) => void;
}

interface CustomTooltipPayloadItem {
  payload?: {
    name: string;
    fullName: string;
    stageText: string;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
    totalTasks: number;
    concluidoPct: number;
  };
}

const ProgressBarTooltip: React.FC<{
  active?: boolean;
  payload?: CustomTooltipPayloadItem[];
}> = ({ active, payload }) => {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md text-xs text-slate-800 space-y-1">
      <p className="font-bold text-slate-900">{row.fullName}</p>
      {row.stageText && <p className="text-[11px] text-slate-500">{row.stageText}</p>}
      <div className="flex items-center gap-3 pt-0.5 tabular-nums">
        <span className="font-semibold text-[#16A34A]">Concluídas: {row.completedTasks} ({row.concluidoPct}%)</span>
        <span className="text-[#D97706]">Em andamento: {row.inProgressTasks}</span>
        <span className="text-slate-500">Pendentes: {row.pendingTasks}</span>
      </div>
    </div>
  );
};

export const PainelProgressoTarefasChart: React.FC<PainelProgressoTarefasChartProps> = ({
  empresa,
  tasks,
  cases,
  clients,
  docs,
  selectedCaseId,
  onOpenAgenda,
  onOpenCase,
}) => {
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [collapsed, setCollapsed] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const activeClients = useMemo(
    () =>
      clients
        .filter((c) => !c.arquivado)
        .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto)),
    [clients],
  );

  const activeCases = useMemo(() => cases.filter((c) => !c.arquivado), [cases]);

  // Se um caso específico está aberto, sincroniza o cliente automaticamente caso usuário não tenha fixado outro
  const effectiveCaseFilter = selectedClientId ? null : selectedCaseId || null;

  useEffect(() => {
    if (selectedCaseId) {
      setSelectedClientId('');
    }
  }, [selectedCaseId]);

  const overview = useMemo(
    () =>
      computeClientTaskProgress({
        tasks,
        cases: activeCases,
        clients: activeClients,
        selectedClientId: selectedClientId || null,
        selectedCaseId: effectiveCaseFilter,
      }),
    [tasks, activeCases, activeClients, selectedClientId, effectiveCaseFilter],
  );

  const chartData = useMemo(() => {
    if (overview.rows.length > 0 && !effectiveCaseFilter && !selectedClientId) {
      return overview.rows.slice(0, 5).map((r) => ({
        name: r.label,
        fullName: r.clientName,
        stageText:
          r.etapaPipeline && r.statusSermig
            ? `Etapa ${r.etapaPipeline}/15 · SERMIG: ${r.statusSermig}`
            : r.caseTitle || '',
        concluidoPct: r.concluidoPct,
        emAndamentoPct: r.emAndamentoPct,
        pendentePct: r.pendentePct,
        completedTasks: r.completedTasks,
        inProgressTasks: r.inProgressTasks,
        pendingTasks: r.pendingTasks,
        totalTasks: r.totalTasks,
      }));
    }

    return [
      {
        name: selectedClientId || effectiveCaseFilter ? 'Progresso' : 'Consolidado',
        fullName: overview.activeLabel,
        stageText: overview.stageSummary,
        concluidoPct: overview.concluidoPct,
        emAndamentoPct: overview.emAndamentoPct,
        pendentePct: overview.totalTasks > 0 ? overview.pendentePct : 100,
        completedTasks: overview.completedTasks,
        inProgressTasks: overview.inProgressTasks,
        pendingTasks: overview.pendingTasks,
        totalTasks: overview.totalTasks,
      },
    ];
  }, [overview, effectiveCaseFilter, selectedClientId]);

  const singleTargetCase = useMemo(() => {
    if (effectiveCaseFilter) {
      return activeCases.find((c) => c.id === effectiveCaseFilter) || null;
    }
    if (selectedClientId) {
      return activeCases.find((c) => c.clientId === selectedClientId) || null;
    }
    return null;
  }, [activeCases, effectiveCaseFilter, selectedClientId]);

  const targetClient = useMemo(() => {
    const cid = singleTargetCase?.clientId || selectedClientId;
    if (!cid) return null;
    return clients.find((c) => c.id === cid) || null;
  }, [singleTargetCase, selectedClientId, clients]);

  const filteredTasksForPdf = useMemo(() => {
    const caseClientMap = new Map(cases.map((c) => [c.id, c.clientId]));
    if (effectiveCaseFilter) {
      const cObj = cases.find((c) => c.id === effectiveCaseFilter);
      return tasks.filter(
        (t) => t.caseId === effectiveCaseFilter || (cObj && !t.caseId && t.clientId === cObj.clientId),
      );
    }
    if (selectedClientId) {
      return tasks.filter(
        (t) => t.clientId === selectedClientId || (t.caseId && caseClientMap.get(t.caseId) === selectedClientId),
      );
    }
    return tasks;
  }, [tasks, cases, effectiveCaseFilter, selectedClientId]);

  const filteredDocsForPdf = useMemo(() => {
    if (effectiveCaseFilter) {
      return docs.filter((d) => d.caseId === effectiveCaseFilter);
    }
    if (selectedClientId) {
      return docs.filter((d) => d.clientId === selectedClientId);
    }
    const activeCaseIds = new Set(activeCases.map((c) => c.id));
    return docs.filter((d) => activeCaseIds.has(d.caseId));
  }, [docs, activeCases, effectiveCaseFilter, selectedClientId]);

  const handleExportSummaryPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPdfError(null);
    try {
      await exportResumoProcessoClientePdf({
        empresa,
        client: targetClient,
        activeCase: singleTargetCase,
        cases: activeCases,
        clients: activeClients,
        tasks: filteredTasksForPdf,
        docs: filteredDocsForPdf,
        overview,
      });
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Não foi possível gerar o PDF de resumo do processo.',
      );
    } finally {
      setPdfBusy(false);
    }
  };

  const chartHeight = chartData.length > 1 ? Math.min(210, chartData.length * 36 + 22) : 54;

  return (
    <section
      aria-label="Progresso do status de imigração por tarefas concluídas"
      className="mb-6 border border-slate-200 px-5 py-4 space-y-3 no-print"
      style={{ backgroundColor: 'var(--color-surface)', borderRadius: 'var(--card-radius, 12px)' }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="text-sm font-bold text-slate-900">
              Progresso do Status de Imigração (Tarefas Concluídas)
            </h2>
            <span
              className="text-sm font-bold tabular-nums"
              style={{
                color:
                  overview.concluidoPct >= 80
                    ? '#16A34A'
                    : overview.concluidoPct >= 40
                      ? 'var(--color-primary)'
                      : '#D97706',
              }}
            >
              {overview.concluidoPct}% concluído
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{overview.activeLabel}</span>
            <span aria-hidden="true">·</span>
            <span>{overview.stageSummary}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">
              {overview.completedTasks} de {overview.totalTasks} tarefa(s) concluída(s)
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="Filtrar progresso de tarefas por cliente"
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 max-w-[240px]"
          >
            <option value="">
              {effectiveCaseFilter ? 'Processo selecionado no painel' : 'Todos os clientes ativos'}
            </option>
            {activeClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nomeCompleto}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void handleExportSummaryPdf()}
            title="Gerar PDF para o cliente com status do processo, progresso das tarefas e histórico de documentos enviados (sem expor o diagnóstico completo)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {pdfBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            {pdfBusy ? 'Gerando PDF...' : 'Gerar PDF Resumo'}
          </button>

          {singleTargetCase && onOpenCase && (
            <button
              type="button"
              onClick={() => onOpenCase(singleTargetCase.id)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Abrir Processo
            </button>
          )}

          {onOpenAgenda && (
            <button
              type="button"
              onClick={onOpenAgenda}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <ListTodo className="w-3.5 h-3.5" />
              Tarefas
            </button>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir gráfico de progresso' : 'Recolher gráfico de progresso'}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 shrink-0"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {pdfError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-center justify-between gap-2"
        >
          <span>{pdfError}</span>
          <button type="button" onClick={() => setPdfError(null)} className="font-semibold underline shrink-0">
            Fechar
          </button>
        </div>
      )}

      {!collapsed && (
        <>
          {overview.totalTasks === 0 ? (
            <div className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-100">
              <span>Nenhuma tarefa operacional registrada para este filtro ainda.</span>
              {onOpenAgenda && (
                <button
                  type="button"
                  onClick={onOpenAgenda}
                  className="font-semibold text-[var(--color-primary)] hover:underline"
                >
                  Criar primeira tarefa
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-full" style={{ height: chartHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 2, right: 8, left: chartData.length > 1 ? 8 : 0, bottom: 2 }}
                    barSize={chartData.length > 1 ? 18 : 22}
                  >
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={chartData.length > 1 ? 115 : 74}
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ProgressBarTooltip />}
                      cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                    />
                    <Bar
                      dataKey="concluidoPct"
                      name="Concluídas"
                      stackId="progress"
                      fill="#16A34A"
                      radius={[4, 0, 0, 4]}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="emAndamentoPct"
                      name="Em andamento"
                      stackId="progress"
                      fill="#D97706"
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="pendentePct"
                      name="Pendentes"
                      stackId="progress"
                      fill="#E2E8F0"
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                <div className="flex flex-wrap items-center gap-4 tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#16A34A] inline-block" aria-hidden="true" />
                    Concluídas ({overview.completedTasks})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706] inline-block" aria-hidden="true" />
                    Em andamento ({overview.inProgressTasks})
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#E2E8F0] inline-block border border-slate-300" aria-hidden="true" />
                    Pendentes ({overview.pendingTasks})
                  </span>
                </div>
                {overview.rows.length > 5 && !selectedClientId && !effectiveCaseFilter && (
                  <span className="text-slate-500">
                    Exibindo 5 de {overview.rows.length} clientes com tarefas
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
