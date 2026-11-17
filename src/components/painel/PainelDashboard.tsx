import React, { useMemo, useState } from 'react';
import { AlertTriangle, MessageCircle, TrendingUp, Users } from 'lucide-react';
import { PIPELINE_STAGES } from '../../data/seeds';
import type {
  Case,
  CaseDocument,
  Client,
  Deadline,
  FinancialRecord,
  Lead,
  UserRole,
} from '../../types/domain';
import { calcularTermometroDocumentos, calcularUrgencias } from '../../utils/caseMetrics';
import { buildWhatsAppUrl, formatCurrency } from '../../utils/formatters';

interface PainelDashboardProps {
  role: UserRole;
  leads: Lead[];
  clients: Client[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines: Deadline[];
  financialRecords: FinancialRecord[];
  onLogWhatsApp: (clientId: string | undefined, caseId: string | undefined, assunto: string, msg: string) => Promise<void>;
  onOpenCase: (caseId: string) => void;
}

export const PainelDashboard: React.FC<PainelDashboardProps> = ({
  role,
  leads,
  clients,
  cases,
  docs,
  deadlines,
  financialRecords,
  onLogWhatsApp,
  onOpenCase,
}) => {
  const [filterOrigem, setFilterOrigem] = useState('Todas');
  const isAssistente = role === 'assistente';

  const urgencias = useMemo(
    () =>
      calcularUrgencias({
        cases,
        clients,
        docs,
        deadlines,
        financialRecords: isAssistente ? [] : financialRecords,
        role,
      }),
    [cases, clients, docs, deadlines, financialRecords, role, isAssistente],
  );

  const filteredLeads = useMemo(
    () => (filterOrigem === 'Todas' ? leads : leads.filter((l) => l.origem === filterOrigem)),
    [leads, filterOrigem],
  );

  const avgThermometer = useMemo(() => {
    if (cases.length === 0) return 0;
    const scores = cases.map((c) => {
      const cDocs = docs.filter((d) => d.caseId === c.id);
      return calcularTermometroDocumentos(cDocs).notaGeral;
    });
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [cases, docs]);

  const topReprovados = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of docs) {
      if (d.status === 'Reprovado') {
        counts.set(d.nomeDocumento, (counts.get(d.nomeDocumento) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [docs]);

  const npsMedio = useMemo(() => {
    const rated = cases.filter((c) => typeof c.npsNota === 'number');
    if (rated.length === 0) return null;
    const sum = rated.reduce((a, c) => a + (c.npsNota || 0), 0);
    return (sum / rated.length).toFixed(1);
  }, [cases]);

  const receitaTotalBrl = useMemo(() => {
    if (isAssistente) return 0;
    return financialRecords.filter((f) => f.status === 'Pago' && f.moeda === 'BRL').reduce((a, b) => a + b.valor, 0);
  }, [financialRecords, isAssistente]);

  const inadimplenciaBrl = useMemo(() => {
    if (isAssistente) return 0;
    return financialRecords.filter((f) => f.status === 'Atrasado' && f.moeda === 'BRL').reduce((a, b) => a + b.valor, 0);
  }, [financialRecords, isAssistente]);

  const handleNotifyUrgency = async (u: (typeof urgencias)[number]) => {
    const text = `Olá${u.clientNome ? `, ${u.clientNome}` : ''}! Alerta operacional D&M Integra Chile: ${u.titulo} — ${u.detalhe} (Data ref.: ${u.dataReferenciaBR}).`;
    if (u.clientWhatsapp) {
      window.open(buildWhatsAppUrl(u.clientWhatsapp, text), '_blank', 'noopener,noreferrer');
    }
    await onLogWhatsApp(u.clientId, u.caseId, `Alerta WhatsApp: ${u.categoria}`, text);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Visão Geral &amp; Central de Urgências</h1>
          <p className="text-xs text-slate-500">Monitoramento em tempo real de prazos críticos, funil e operação migratória</p>
        </div>
        <select
          value={filterOrigem}
          onChange={(e) => setFilterOrigem(e.target.value)}
          aria-label="Filtrar métricas por origem"
          className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-medium"
        >
          <option value="Todas">Todas as origens de leads</option>
          <option value="Site">Site</option>
          <option value="Instagram">Instagram</option>
          <option value="Indicação">Indicação</option>
          <option value="Parceiro">Parceiro</option>
          <option value="Outro">Outro</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Leads no funil</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{filteredLeads.length}</p>
          <p className="text-xs text-slate-500 mt-1">
            {filteredLeads.filter((l) => l.statusFunil === 'Fechado').length} convertidos
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Casos ativos / Clientes</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {cases.length} / {clients.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Termômetro médio: {avgThermometer}%</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Urgências identificadas</p>
          <p className="text-2xl font-bold mt-1 tabular-nums" style={{ color: urgencias.length > 0 ? '#C82333' : '#1E7E34' }}>
            {urgencias.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">NPS médio: {npsMedio ? `${npsMedio}/5` : 'Sem avaliações'}</p>
        </div>
        {!isAssistente ? (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Receita recebida / Em atraso (BRL)</p>
            <p className="text-xl font-bold text-[#1E7E34] mt-1 tabular-nums">{formatCurrency(receitaTotalBrl, 'BRL')}</p>
            <p className="text-xs text-[#C82333] mt-1 tabular-nums">Em atraso: {formatCurrency(inadimplenciaBrl, 'BRL')}</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-medium text-slate-500">Documentos na esteira</p>
            <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{docs.length}</p>
            <p className="text-xs text-slate-500 mt-1">
              {docs.filter((d) => d.status === 'Enviado' || d.status === 'Em análise').length} aguardando conferência
            </p>
          </div>
        )}
      </div>

      {/* Central de Urgências */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#C82333]" />
            <h2 className="text-lg font-bold text-slate-900">Central de Urgências</h2>
          </div>
          <span className="text-xs text-slate-500">
            Vencimentos ≤ 15d · Estampado 90d · Prorrogação · &gt;180d SERMIG · Descargos
          </span>
        </div>

        {urgencias.length === 0 ? (
          <p className="text-sm text-slate-600 py-4">Nenhum alerta crítico pendente no momento.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {urgencias.map((u) => (
              <div key={u.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold" style={{ color: u.severidade === 'Critica' ? '#C82333' : '#B45309' }}>
                    {u.categoria} · {u.severidade} · Ref.: {u.dataReferenciaBR}
                  </p>
                  <p className="text-sm font-semibold text-slate-900 mt-0.5">{u.titulo}</p>
                  <p className="text-xs text-slate-600">
                    {u.clientNome ? `${u.clientNome} — ` : ''}
                    {u.detalhe}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {u.caseId && (
                    <button
                      type="button"
                      onClick={() => onOpenCase(u.caseId!)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Abrir Caso
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNotifyUrgency(u)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Avisar no WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Métricas gerenciais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="text-base font-semibold text-slate-900">Casos por Etapa do Pipeline</h2>
          </div>
          <div className="space-y-2">
            {PIPELINE_STAGES.filter((st) => cases.some((c) => c.etapaPipeline === st.numero)).length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum caso ativo cadastrado ainda.</p>
            ) : (
              PIPELINE_STAGES.map((st) => {
                const count = cases.filter((c) => c.etapaPipeline === st.numero).length;
                if (count === 0) return null;
                return (
                  <div key={st.numero} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                    <span className="text-slate-700">
                      Etapa {st.numero}: {st.nome}
                    </span>
                    <span className="font-bold tabular-nums text-slate-900">{count}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="text-base font-semibold text-slate-900">Documentos Mais Reprovados</h2>
          </div>
          {topReprovados.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhuma reprovação documental registrada até o momento.</p>
          ) : (
            <div className="space-y-2">
              {topReprovados.map(([nome, qtd]) => (
                <div key={nome} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-100">
                  <span className="text-slate-700">{nome}</span>
                  <span className="font-bold tabular-nums text-[#C82333]">{qtd} reprovação(ões)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
