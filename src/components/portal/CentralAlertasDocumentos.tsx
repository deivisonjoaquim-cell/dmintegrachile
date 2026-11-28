import React, { useMemo, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  BellRing,
  Calendar,
  CheckCircle2,
  FileUp,
  MessageSquare,
  Search,
  ShieldCheck,
} from 'lucide-react';
import type { Case, CaseDocument, Client, Deadline, Dependent, VisaRequirement } from '../../types/domain';
import {
  buildDocumentAlertCenterSnapshot,
  filterAlertCenterCards,
  type AlertTrafficLevel,
  type DocumentAlertCardItem,
} from '../../utils/documentAlertCenter';
import { downloadIcsFile } from '../../utils/formatters';

import type { PortalChatTopicId } from '../../utils/documentChat';

export interface CentralAlertasDocumentosProps {
  client: Client;
  dependents?: Dependent[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines?: Deadline[];
  visaRequirements?: VisaRequirement[];
  brandName?: string;
  onGoToDocuments?: () => void;
  onGoToProfileData?: () => void;
  onAskConsultant?: (context: { topic: PortalChatTopicId; prefillMessage: string }) => void;
  onOpenSmtpConfig?: () => void;
}

const LEVEL_STYLES: Record<
  AlertTrafficLevel,
  {
    cardBg: string;
    cardBorder: string;
    titleText: string;
    accentText: string;
    barBg: string;
    barFill: string;
    icon: React.ComponentType<{ className?: string }>;
    shortName: string;
    rangeDesc: string;
  }
> = {
  vermelho: {
    cardBg: 'bg-red-50/85 dark:bg-red-950/35',
    cardBorder: 'border-red-200 dark:border-red-900/70',
    titleText: 'text-red-950 dark:text-red-100',
    accentText: 'text-red-700 dark:text-red-300',
    barBg: 'bg-red-200/80 dark:bg-red-950',
    barFill: 'bg-red-600 dark:bg-red-500',
    icon: AlertOctagon,
    shortName: 'Vermelho · Crítico',
    rangeDesc: 'Vencido ou ≤ 15 dias',
  },
  amarelo: {
    cardBg: 'bg-amber-50/85 dark:bg-amber-950/30',
    cardBorder: 'border-amber-200 dark:border-amber-800/70',
    titleText: 'text-amber-950 dark:text-amber-100',
    accentText: 'text-amber-800 dark:text-amber-300',
    barBg: 'bg-amber-200/80 dark:bg-amber-950',
    barFill: 'bg-amber-500 dark:bg-amber-400',
    icon: AlertTriangle,
    shortName: 'Amarelo · Atenção',
    rangeDesc: '16 a 45 dias',
  },
  verde: {
    cardBg: 'bg-emerald-50/80 dark:bg-emerald-950/25',
    cardBorder: 'border-emerald-200 dark:border-emerald-900/70',
    titleText: 'text-emerald-950 dark:text-emerald-100',
    accentText: 'text-emerald-700 dark:text-emerald-300',
    barBg: 'bg-emerald-200/75 dark:bg-emerald-950',
    barFill: 'bg-emerald-600 dark:bg-emerald-500',
    icon: CheckCircle2,
    shortName: 'Verde · Em dia',
    rangeDesc: 'Acima de 45 dias',
  },
};

export const CentralAlertasDocumentos: React.FC<CentralAlertasDocumentosProps> = ({
  client,
  dependents = [],
  cases,
  docs,
  deadlines = [],
  visaRequirements = [],
  brandName = 'D&M Integra Chile',
  onGoToDocuments,
  onGoToProfileData,
  onAskConsultant,
  onOpenSmtpConfig,
}) => {
  const [levelFilter, setLevelFilter] = useState<'todos' | AlertTrafficLevel>('todos');
  const [search, setSearch] = useState('');

  const snapshot = useMemo(
    () =>
      buildDocumentAlertCenterSnapshot({
        client,
        dependents,
        cases,
        docs,
        deadlines,
        visaRequirements,
      }),
    [client, dependents, cases, docs, deadlines, visaRequirements],
  );

  const visibleCards = useMemo(
    () => filterAlertCenterCards(snapshot.cards, { level: levelFilter, search }),
    [snapshot.cards, levelFilter, search],
  );

  const handleExportCardIcs = (card: DocumentAlertCardItem) => {
    downloadIcsFile({
      title: `Prazo: ${card.titulo} (${brandName})`,
      description: `${card.sourceLabel} · ${card.countdownLabel}. ${card.guidance}`,
      startIso: card.dataVencimento,
    });
  };

  return (
    <section
      data-testid="central-alertas-documentos"
      aria-label="Central de Alertas de Prazos de Documentos"
      className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-5 sm:p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="brand-kicker flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5 text-[#C9A86A]" />
            Central de Alertas · Semáforo de Vencimentos (Visto, RUT &amp; Documentos)
          </p>
          <h2 className="font-display text-xl font-bold text-[#070E1C] dark:text-white">
            Central de Alertas de Prazos Documentais
          </h2>
          <p className="text-xs text-[#475569] dark:text-slate-400 max-w-2xl leading-relaxed">
            Todos os prazos do seu passaporte, certidões, visto e RUT consolidados em um painel visual:
            vermelho para urgência (≤ 15 dias ou vencido), amarelo para atenção (16 a 45 dias) e verde para documentos em dia.
          </p>
        </div>

        {onOpenSmtpConfig && (
          <button
            type="button"
            onClick={onOpenSmtpConfig}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-[#F7F8FA] dark:bg-[#111C30] text-xs font-semibold text-[#070E1C] dark:text-slate-100 hover:bg-white dark:hover:bg-[#182842] whitespace-nowrap shrink-0 self-start"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#0F3D91] dark:text-[#60A5FA]" />
            Alertas automáticos por e-mail
          </button>
        )}
      </div>

      {/* 3 Interactive Traffic-Light Filter Summary Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {(['vermelho', 'amarelo', 'verde'] as AlertTrafficLevel[]).map((lvl) => {
          const style = LEVEL_STYLES[lvl];
          const Icon = style.icon;
          const count = snapshot.counts[lvl];
          const active = levelFilter === lvl;
          return (
            <button
              key={lvl}
              type="button"
              aria-pressed={active}
              onClick={() => setLevelFilter((prev) => (prev === lvl ? 'todos' : lvl))}
              className={`text-left rounded-xl border p-4 transition-all ${style.cardBg} ${style.cardBorder} ${
                active ? 'ring-2 ring-offset-1 ring-[#070E1C] dark:ring-white dark:ring-offset-[#0D1422]' : 'hover:opacity-95'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${style.accentText}`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {style.shortName}
                </span>
                <span className={`font-mono text-2xl font-bold tabular-nums ${style.titleText}`}>
                  {count}
                </span>
              </div>
              <p className={`text-[11px] mt-1.5 ${style.accentText} opacity-90`}>
                {style.rangeDesc}
                {active ? ' · Filtro ativo (clique para limpar)' : ' · Clique para filtrar'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar + Search */}
      {snapshot.counts.total > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B] w-fit">
            {(
              [
                { id: 'todos', label: `Todos (${snapshot.counts.total})` },
                { id: 'vermelho', label: `Vermelho (${snapshot.counts.vermelho})` },
                { id: 'amarelo', label: `Amarelo (${snapshot.counts.amarelo})` },
                { id: 'verde', label: `Verde (${snapshot.counts.verde})` },
              ] as const
            ).map((tab) => {
              const active = levelFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLevelFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap font-mono tabular-nums ${
                    active
                      ? 'bg-[#070E1C] dark:bg-[#0F3D91] text-white'
                      : 'text-[#475569] dark:text-slate-300 hover:text-[#070E1C] dark:hover:text-white'
                  }`}
                >
                  <span className="font-sans">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar documento, visto ou data..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-[#F7F8FA] dark:bg-[#0B1220] text-xs text-[#070E1C] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/30"
            />
          </div>
        </div>
      )}

      {/* Colored Document Alert Cards Grid */}
      {visibleCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D1D5DB] dark:border-[#24324A] p-7 text-center space-y-2.5">
          <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <p className="text-sm font-bold text-[#070E1C] dark:text-white">
            {snapshot.counts.total === 0
              ? 'Nenhum prazo documental registrado ainda'
              : 'Nenhum documento nesta faixa de cor'}
          </p>
          <p className="text-xs text-[#475569] dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            {snapshot.counts.total === 0
              ? 'Cadastre a validade do seu passaporte ou envie seus documentos no cofre para acompanhar cada vencimento com cards coloridos (verde, amarelo e vermelho).'
              : 'Ótima notícia! Você pode alternar para "Todos" para visualizar todos os seus prazos monitorados.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            {snapshot.counts.total > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setLevelFilter('todos');
                  setSearch('');
                }}
                className="px-3.5 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-white text-xs font-semibold"
              >
                Exibir todos os prazos ({snapshot.counts.total})
              </button>
            ) : (
              <>
                {onGoToProfileData && !client.passaporte?.validade && (
                  <button
                    type="button"
                    onClick={onGoToProfileData}
                    className="px-3.5 py-2 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] text-white text-xs font-semibold"
                  >
                    Informar validade do passaporte
                  </button>
                )}
                {onGoToDocuments && (
                  <button
                    type="button"
                    onClick={onGoToDocuments}
                    className="px-3.5 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] text-xs font-semibold text-[#070E1C] dark:text-slate-200"
                  >
                    Abrir meus documentos
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {visibleCards.map((card) => {
            const style = LEVEL_STYLES[card.level];
            const Icon = style.icon;
            return (
              <article
                key={card.id}
                data-alert-level={card.level}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-3 ${style.cardBg} ${style.cardBorder}`}
              >
                <div className="space-y-2">
                  {/* Quiet metadata row (zero pills, icon + explicit semantic text) */}
                  <div className={`flex items-center justify-between gap-2 text-[11px] font-semibold ${style.accentText}`}>
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{card.levelLabel}</span>
                    </span>
                    <span className="font-mono tabular-nums shrink-0 opacity-90">
                      {card.dataVencimentoBR}
                    </span>
                  </div>

                  {/* Document Title & Source */}
                  <div>
                    <h3 className={`text-sm font-bold leading-snug ${style.titleText}`}>
                      {card.titulo}
                    </h3>
                    <p className={`text-[11px] mt-0.5 ${style.accentText} opacity-85`}>
                      {card.sourceLabel} · {card.titularNome}
                    </p>
                  </div>

                  {/* Countdown + Proximity Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`font-mono text-base font-bold tabular-nums ${style.titleText}`}>
                        {card.countdownLabel}
                      </span>
                      <span className={`text-[10.5px] font-mono tabular-nums ${style.accentText}`}>
                        Validade: {card.dataVencimentoBR}
                      </span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${style.barBg}`}>
                      <div
                        className={`h-full rounded-full transition-all ${style.barFill}`}
                        style={{ width: `${card.proximityPct}%` }}
                      />
                    </div>
                  </div>

                  <p className={`text-[11.5px] leading-relaxed ${style.titleText} opacity-90`}>
                    {card.guidance}
                  </p>
                </div>

                {/* Card Actions */}
                <div className="pt-2.5 border-t border-black/10 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {onGoToDocuments && card.categoryGroup === 'documento' && (
                      <button
                        type="button"
                        onClick={onGoToDocuments}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-[#0D1422]/90 border border-black/10 dark:border-white/15 text-[11px] font-semibold text-[#070E1C] dark:text-white hover:bg-white whitespace-nowrap"
                      >
                        <FileUp className="w-3 h-3" />
                        Atualizar
                      </button>
                    )}
                    {onAskConsultant && (
                      <button
                        type="button"
                        onClick={() =>
                          onAskConsultant({
                            topic: card.categoryGroup === 'visto_prazo' ? 'prazos' : 'documento',
                            prefillMessage: `Olá! Preciso de orientação sobre o prazo de "${card.titulo}" (vencimento em ${card.dataVencimentoBR} · ${card.countdownLabel}).`,
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-[#0D1422]/90 border border-black/10 dark:border-white/15 text-[11px] font-semibold text-[#070E1C] dark:text-white hover:bg-white whitespace-nowrap"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Consultar
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExportCardIcs(card)}
                    title="Salvar lembrete no calendário (.ics)"
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold hover:underline whitespace-nowrap ${style.accentText}`}
                  >
                    <Calendar className="w-3 h-3" />
                    Agenda (.ics)
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Helpful hint when critical dates are still missing */}
      {snapshot.missingDatesHints.length > 0 && (
        <div className="pt-2 border-t border-[#E5E7EB] dark:border-[#1E293B] flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-[#475569] dark:text-slate-400">
          <span>
            <strong className="text-[#070E1C] dark:text-white">Dica de proteção:</strong>{' '}
            {snapshot.missingDatesHints[0]}
          </span>
          {onGoToProfileData && !client.passaporte?.validade && (
            <button
              type="button"
              onClick={onGoToProfileData}
              className="font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
            >
              Preencher na aba Dados →
            </button>
          )}
        </div>
      )}
    </section>
  );
};
