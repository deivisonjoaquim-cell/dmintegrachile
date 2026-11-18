import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowRightCircle,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  GripVertical,
  MessageCircle,
  X,
} from 'lucide-react';
import type { Lead, UserRole } from '../../types/domain';
import { formatDateBR } from '../../utils/formatters';

export const FUNIL_STAGES: Lead['statusFunil'][] = [
  'Novo',
  'Contatado',
  'Diagnóstico Agendado',
  'Orçamento Enviado',
  'Fechado',
  'Perdido',
];

type KanbanSortMode = 'recentes' | 'maior_nota' | 'prioridade' | 'sla_contato';
type KanbanDensity = 'detalhado' | 'compacto';

interface PainelLeadsKanbanProps {
  leads: Lead[];
  role: UserRole;
  selectedLeadIds: string[];
  convertingId: string | null;
  movingLeadId: string | null;
  onToggleSelect: (id: string) => void;
  onMoveStage: (lead: Lead, nextStage: Lead['statusFunil'], motivoPerda?: string) => Promise<void>;
  onInspectLead: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onSendWhatsApp: (lead: Lead) => Promise<void>;
  onConvertLead: (lead: Lead) => Promise<void>;
  onOpenCase: (caseId: string) => void;
}

const STAGE_ACCENTS: Record<Lead['statusFunil'], string> = {
  Novo: 'border-t-slate-700',
  Contatado: 'border-t-sky-700',
  'Diagnóstico Agendado': 'border-t-amber-600',
  'Orçamento Enviado': 'border-t-indigo-700',
  Fechado: 'border-t-[#1E7E34]',
  Perdido: 'border-t-[#C82333]',
};

const PRIORITY_WEIGHT: Record<Lead['prioridade'], number> = {
  Urgente: 4,
  Alta: 3,
  Média: 2,
  Baixa: 1,
};

const LOSS_PRESETS = [
  'Sem retorno após tentativas de contato',
  'Orçamento acima da expectativa atual',
  'Adiou plano de mudança para o Chile',
  'Perfil inelegível no momento',
  'Lead duplicado / teste',
];

function getLeadAgeHours(createdAt?: string): number | null {
  if (!createdAt) return null;
  const ts = Date.parse(createdAt);
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / 3600000));
}

function formatAgeCompact(hours: number | null): string {
  if (hours === null) return '';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export const PainelLeadsKanban: React.FC<PainelLeadsKanbanProps> = ({
  leads,
  role,
  selectedLeadIds,
  convertingId,
  movingLeadId,
  onToggleSelect,
  onMoveStage,
  onInspectLead,
  onEditLead,
  onSendWhatsApp,
  onConvertLead,
  onOpenCase,
}) => {
  const [sortMode, setSortMode] = useState<KanbanSortMode>('recentes');
  const [density, setDensity] = useState<KanbanDensity>('detalhado');
  const [showLostColumn, setShowLostColumn] = useState(true);
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Lead['statusFunil'] | null>(null);
  const [lossModalLead, setLossModalLead] = useState<Lead | null>(null);
  const [lossReason, setLossReason] = useState('');

  const visibleStages = useMemo(
    () => (showLostColumn ? FUNIL_STAGES : FUNIL_STAGES.filter((st) => st !== 'Perdido')),
    [showLostColumn],
  );

  const summary = useMemo(() => {
    const active = leads.filter((l) => l.statusFunil !== 'Perdido' && l.statusFunil !== 'Fechado');
    const hotOrUrgent = active.filter(
      (l) => l.temperatura === 'Quente' || l.prioridade === 'Urgente' || l.prioridade === 'Alta',
    ).length;
    const uncontactedOver24h = leads.filter((l) => {
      if (l.statusFunil !== 'Novo' || l.primeiroContatoEm) return false;
      const hrs = getLeadAgeHours(l.createdAt);
      return hrs !== null && hrs >= 24;
    }).length;
    const closedCount = leads.filter((l) => l.statusFunil === 'Fechado').length;
    const conversionPct = leads.length > 0 ? Math.round((closedCount / leads.length) * 100) : 0;
    return {
      activeCount: active.length,
      hotOrUrgent,
      uncontactedOver24h,
      closedCount,
      conversionPct,
    };
  }, [leads]);

  const sortColumnLeads = (colLeads: Lead[]): Lead[] => {
    return [...colLeads].sort((a, b) => {
      if (sortMode === 'maior_nota') {
        return (b.notaViabilidade || 0) - (a.notaViabilidade || 0);
      }
      if (sortMode === 'prioridade') {
        const pDiff = PRIORITY_WEIGHT[b.prioridade] - PRIORITY_WEIGHT[a.prioridade];
        if (pDiff !== 0) return pDiff;
        return (b.notaViabilidade || 0) - (a.notaViabilidade || 0);
      }
      if (sortMode === 'sla_contato') {
        const aSla = a.primeiroContatoEm ? 0 : getLeadAgeHours(a.createdAt) || 0;
        const bSla = b.primeiroContatoEm ? 0 : getLeadAgeHours(b.createdAt) || 0;
        return bSla - aSla;
      }
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  };

  const requestMoveStage = (lead: Lead, nextStage: Lead['statusFunil']) => {
    if (lead.statusFunil === nextStage) return;
    if (nextStage === 'Perdido') {
      setLossModalLead(lead);
      setLossReason(lead.motivoPerda || LOSS_PRESETS[0]);
      return;
    }
    void onMoveStage(lead, nextStage);
  };

  const handleConfirmLoss = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lossModalLead) return;
    const target = lossModalLead;
    const reason = lossReason.trim() || 'Sem motivo informado';
    setLossModalLead(null);
    setLossReason('');
    await onMoveStage(target, 'Perdido', reason);
  };

  const handleDropOnStage = (e: React.DragEvent, stage: Lead['statusFunil']) => {
    e.preventDefault();
    const droppedId = e.dataTransfer.getData('text/plain') || draggingLeadId;
    setDragOverStage(null);
    setDraggingLeadId(null);
    if (!droppedId) return;
    const lead = leads.find((item) => item.id === droppedId);
    if (!lead || lead.statusFunil === stage) return;
    requestMoveStage(lead, stage);
  };

  const toggleCollapseStage = (stage: Lead['statusFunil']) => {
    setCollapsedStages((prev) => ({ ...prev, [stage]: !prev[stage] }));
  };

  return (
    <div className="space-y-4">
      {/* Barra Resumo do Pipeline & Controles do Kanban */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:divide-x sm:divide-slate-200 text-xs">
          <div className="sm:pr-4">
            <p className="text-slate-500">Em negociação</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums">{summary.activeCount}</p>
          </div>
          <div className="sm:px-4">
            <p className="text-slate-500">Quentes / Alta prioridade</p>
            <p className="text-lg font-bold text-amber-700 tabular-nums">{summary.hotOrUrgent}</p>
          </div>
          <div className="sm:px-4">
            <p className="text-slate-500">Sem 1º contato (&gt;24h)</p>
            <p className={`text-lg font-bold tabular-nums ${summary.uncontactedOver24h > 0 ? 'text-[#C82333]' : 'text-slate-900'}`}>
              {summary.uncontactedOver24h}
            </p>
          </div>
          <div className="sm:pl-4">
            <p className="text-slate-500">Fechados no funil</p>
            <p className="text-lg font-bold text-[#1E7E34] tabular-nums">
              {summary.closedCount} ({summary.conversionPct}%)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as KanbanSortMode)}
            aria-label="Ordenar cards do Kanban"
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white"
          >
            <option value="recentes">Ordenar: Mais recentes</option>
            <option value="prioridade">Ordenar: Prioridade / Urgência</option>
            <option value="maior_nota">Ordenar: Maior viabilidade</option>
            <option value="sla_contato">Ordenar: Aguardando contato</option>
          </select>

          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setDensity('detalhado')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                density === 'detalhado' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Detalhado
            </button>
            <button
              type="button"
              onClick={() => setDensity('compacto')}
              className={`px-2.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                density === 'compacto' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Compacto
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowLostColumn((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {showLostColumn ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showLostColumn ? 'Ocultar Perdidos' : 'Mostrar Perdidos'}
          </button>
        </div>
      </div>

      {/* Board Horizontal com Drag & Drop */}
      <div className="flex gap-4 overflow-x-auto pb-3 items-start">
        {visibleStages.map((stage, stageIdx) => {
          const colLeads = sortColumnLeads(leads.filter((l) => l.statusFunil === stage));
          const isCollapsed = Boolean(collapsedStages[stage]);
          const isDropTarget = dragOverStage === stage;
          const scored = colLeads.filter((l) => typeof l.notaViabilidade === 'number');
          const avgScore =
            scored.length > 0
              ? Math.round(scored.reduce((acc, item) => acc + (item.notaViabilidade || 0), 0) / scored.length)
              : null;
          const nextStage = stageIdx < FUNIL_STAGES.length - 2 ? FUNIL_STAGES[stageIdx + 1] : null;

          if (isCollapsed) {
            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStage(stage);
                }}
                onDragLeave={() => setDragOverStage((prev) => (prev === stage ? null : prev))}
                onDrop={(e) => handleDropOnStage(e, stage)}
                className={`w-16 shrink-0 bg-slate-100 border border-slate-200 border-t-2 ${STAGE_ACCENTS[stage]} rounded-xl p-3 flex flex-col items-center justify-between min-h-[260px] transition-colors ${
                  isDropTarget ? 'ring-2 ring-[var(--color-primary)]/40 bg-slate-200/70' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleCollapseStage(stage)}
                  title={`Expandir coluna ${stage}`}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 writing-mode-vertical"
                >
                  <span className="block tabular-nums text-sm font-bold mb-2">{colLeads.length}</span>
                  <span className="block text-[11px] leading-tight text-center">{stage}</span>
                </button>
              </div>
            );
          }

          return (
            <section
              key={stage}
              aria-label={`Coluna ${stage}`}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverStage !== stage) setDragOverStage(stage);
              }}
              onDragLeave={() => setDragOverStage((prev) => (prev === stage ? null : prev))}
              onDrop={(e) => handleDropOnStage(e, stage)}
              className={`w-[295px] sm:w-[310px] shrink-0 bg-slate-100/80 border border-slate-200 border-t-2 ${STAGE_ACCENTS[stage]} rounded-xl p-3 space-y-3 transition-colors ${
                isDropTarget ? 'ring-2 ring-[var(--color-primary)]/50 bg-slate-200/60' : ''
              }`}
            >
              {/* Cabeçalho da coluna */}
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200/80">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold text-slate-900 truncate">{stage}</h2>
                    <span className="text-xs font-bold text-slate-600 tabular-nums">({colLeads.length})</span>
                  </div>
                  <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                    {avgScore !== null ? `Viabilidade média ${avgScore}/100` : 'Sem notas calculadas'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCollapseStage(stage)}
                  title="Recolher coluna"
                  className="px-2 py-1 rounded text-[11px] font-medium text-slate-500 hover:bg-slate-200/70 hover:text-slate-800 whitespace-nowrap shrink-0"
                >
                  Recolher
                </button>
              </div>

              {/* Lista de cards */}
              <div className="space-y-2.5 min-h-[140px]">
                {colLeads.length === 0 ? (
                  <div className="py-8 px-3 text-center border border-dashed border-slate-300 rounded-lg text-xs text-slate-500">
                    {isDropTarget ? `Solte o lead aqui para mover para "${stage}"` : 'Nenhum lead nesta etapa'}
                  </div>
                ) : (
                  colLeads.map((l) => {
                    const ageHours = getLeadAgeHours(l.createdAt);
                    const ageLabel = formatAgeCompact(ageHours);
                    const needsContactAlert = stage === 'Novo' && !l.primeiroContatoEm && ageHours !== null && ageHours >= 24;
                    const hasConsultorRisk = Boolean(l.respostasTriagem?.riscoConsultaConsultor?.length);
                    const isIncomplete = Boolean(l.statusConclusao && l.statusConclusao !== 'Concluído');
                    const isMoving = movingLeadId === l.id;
                    const isSelected = selectedLeadIds.includes(l.id);

                    return (
                      <article
                        key={l.id}
                        draggable={!isMoving}
                        onDragStart={(e) => {
                          setDraggingLeadId(l.id);
                          e.dataTransfer.setData('text/plain', l.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                          setDraggingLeadId(null);
                          setDragOverStage(null);
                        }}
                        className={`bg-white border rounded-lg p-3 space-y-2.5 transition-opacity cursor-grab active:cursor-grabbing ${
                          isSelected ? 'border-[var(--color-primary)]' : 'border-slate-200 hover:border-slate-300'
                        } ${draggingLeadId === l.id || isMoving ? 'opacity-55' : ''}`}
                      >
                        {/* Linha superior: seleção + metadados sem pílulas */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelect(l.id)}
                              aria-label={`Selecionar ${l.nome}`}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] text-slate-500 tabular-nums truncate">
                                <span
                                  className={
                                    l.prioridade === 'Urgente'
                                      ? 'font-bold text-[#C82333]'
                                      : l.prioridade === 'Alta'
                                        ? 'font-bold text-amber-700'
                                        : 'font-medium text-slate-600'
                                  }
                                >
                                  {l.prioridade}
                                </span>
                                {l.temperatura ? ` · ${l.temperatura}` : ''}
                                {ageLabel ? ` · ${ageLabel}` : ''}
                              </p>
                              <h3 className="text-sm font-bold text-slate-900 truncate leading-snug">{l.nome}</h3>
                            </div>
                          </div>
                          <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0 mt-0.5" aria-hidden="true" />
                        </div>

                        {/* Subcategoria + Nota */}
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-600 truncate">
                            {l.subcategoriaSugerida || l.interesse || 'Enquadramento em análise'}
                          </span>
                          <span className="font-bold tabular-nums text-[var(--color-primary)] shrink-0">
                            {typeof l.notaViabilidade === 'number' ? `${l.notaViabilidade}/100` : '—'}
                          </span>
                        </div>

                        {density === 'detalhado' && (
                          <div className="space-y-1 text-[11px] text-slate-500">
                            <p className="truncate">
                              {l.origem}
                              {l.cidadeUf ? ` · ${l.cidadeUf}` : ''}
                              {l.createdAt ? ` · ${formatDateBR(l.createdAt)}` : ''}
                            </p>
                            {needsContactAlert && (
                              <p className="inline-flex items-center gap-1 font-semibold text-[#C82333] tabular-nums">
                                <Clock className="w-3 h-3 shrink-0" />
                                Sem 1º contato há {ageLabel}
                              </p>
                            )}
                            {isIncomplete && (
                              <p className="font-semibold text-amber-700">
                                Diagnóstico {l.statusConclusao?.toLowerCase()} (Etapa {l.etapaAtual || 1}/6)
                              </p>
                            )}
                            {hasConsultorRisk && (
                              <p className="inline-flex items-center gap-1 font-semibold text-amber-800">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                Sinalizou ponto de atenção ao consultor
                              </p>
                            )}
                            {stage === 'Perdido' && l.motivoPerda && (
                              <p className="text-[#C82333] truncate">Motivo: {l.motivoPerda}</p>
                            )}
                            {l.notas && (
                              <p className="text-slate-600 truncate">Nota: {l.notas}</p>
                            )}
                          </div>
                        )}

                        {/* Controles rápidos de movimentação e ações */}
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between gap-1.5">
                            <select
                              value={l.statusFunil}
                              disabled={isMoving}
                              aria-label={`Mover ${l.nome} de etapa`}
                              onChange={(e) => requestMoveStage(l, e.target.value as Lead['statusFunil'])}
                              className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-200 text-[11px] font-medium text-slate-700 bg-slate-50"
                            >
                              {FUNIL_STAGES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>

                            {nextStage && (
                              <button
                                type="button"
                                disabled={isMoving}
                                onClick={() => requestMoveStage(l, nextStage)}
                                title={`Avançar para ${nextStage}`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 disabled:opacity-50"
                              >
                                Avançar
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              {l.respostasTriagem && (
                                <button
                                  type="button"
                                  onClick={() => onInspectLead(l)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                                >
                                  <Eye className="w-3 h-3" />
                                  Analisar
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void onSendWhatsApp(l)}
                                title="Enviar WhatsApp com modelo selecionado"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#1E7E34] font-semibold text-white whitespace-nowrap shrink-0"
                              >
                                <MessageCircle className="w-3 h-3" />
                                WhatsApp
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {l.convertedCaseId ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenCase(l.convertedCaseId!)}
                                  className="px-2 py-1 rounded border border-slate-200 font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                                >
                                  Ver Caso
                                </button>
                              ) : (role === 'admin' || role === 'consultor') ? (
                                <button
                                  type="button"
                                  disabled={convertingId === l.id}
                                  onClick={() => void onConvertLead(l)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
                                  style={{ backgroundColor: 'var(--color-primary)' }}
                                >
                                  <ArrowRightCircle className="w-3 h-3" />
                                  {convertingId === l.id ? '...' : 'Converter'}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => onEditLead(l)}
                                aria-label={`Editar ${l.nome}`}
                                className="p-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Modal de Motivo de Perda ao mover para Perdido */}
      {lossModalLead && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleConfirmLoss} className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold text-slate-900">Mover para &quot;Perdido&quot; — {lossModalLead.nome}</h3>
              <button
                type="button"
                onClick={() => setLossModalLead(null)}
                aria-label="Cancelar movimentação"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Registre o motivo da perda para alimentar o painel de Inteligência e métricas de conversão.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {LOSS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLossReason(preset)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors ${
                    lossReason === preset
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <div>
              <label htmlFor="kanban-loss-reason" className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo detalhado
              </label>
              <input
                id="kanban-loss-reason"
                type="text"
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                placeholder="Descreva o motivo..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLossModalLead(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#C82333]"
              >
                Confirmar perda
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
