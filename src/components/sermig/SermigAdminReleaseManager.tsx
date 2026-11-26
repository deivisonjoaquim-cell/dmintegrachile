import React, { useMemo, useState } from 'react';
import { CheckCircle2, Lock, Search, Unlock, Users } from 'lucide-react';
import type { Client } from '../../types/domain';

interface SermigAdminReleaseManagerProps {
  clients: Client[];
  canManageRelease: boolean;
  onToggleClientSimulatorAccess?: (client: Client, nextEnabled: boolean) => Promise<void>;
}

export const SermigAdminReleaseManager: React.FC<SermigAdminReleaseManagerProps> = ({
  clients,
  canManageRelease,
  onToggleClientSimulatorAccess,
}) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'liberado' | 'bloqueado'>('all');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeClients = useMemo(() => clients.filter((c) => !c.arquivado), [clients]);

  const releasedCount = useMemo(
    () => activeClients.filter((c) => c.simuladorSermigLiberado === true).length,
    [activeClients],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeClients
      .filter((c) => {
        if (filter === 'liberado' && c.simuladorSermigLiberado !== true) return false;
        if (filter === 'bloqueado' && c.simuladorSermigLiberado === true) return false;
        if (!q) return true;
        return (
          (c.nomeCompleto || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.cpf || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  }, [activeClients, search, filter]);

  const handleToggle = async (target: Client) => {
    if (!onToggleClientSimulatorAccess || togglingId) return;
    const nextEnabled = target.simuladorSermigLiberado !== true;
    setTogglingId(target.id);
    setFeedback(null);
    try {
      await onToggleClientSimulatorAccess(target, nextEnabled);
      setFeedback(
        nextEnabled
          ? `Simulador do Portal SERMIG liberado para ${target.nomeCompleto}.`
          : `Acesso ao Simulador do Portal SERMIG revogado para ${target.nomeCompleto}.`,
      );
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Não foi possível atualizar a liberação do simulador.',
      );
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <section
      aria-label="Controle de liberação do Simulador do Portal SERMIG para clientes"
      className="rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0D1524] p-5 sm:p-6 space-y-4"
      data-testid="sermig-admin-release-manager"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0] dark:border-[#1E293B]">
        <div className="space-y-0.5">
          <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-[#0039A6] dark:text-blue-400" aria-hidden="true" />
            Liberação do Simulador SERMIG por Cliente
          </h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400">
            O Simulador do Portal de Entrada SERMIG só fica visível no Portal do Cliente quando liberado aqui ou no
            dossiê do cliente.
          </p>
        </div>
        <div className="text-xs font-mono text-[#475569] dark:text-slate-300 shrink-0 tabular-nums">
          <strong className="text-[#047857] dark:text-[#34D399]">{releasedCount}</strong> de {activeClients.length}{' '}
          cliente(s) liberado(s)
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            {feedback}
          </span>
          <button type="button" onClick={() => setFeedback(null)} className="underline font-semibold shrink-0">
            Fechar
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar cliente para liberar simulador SERMIG"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome, e-mail ou CPF..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090F1A] text-xs text-[#0F172A] dark:text-slate-100 focus:outline-none focus:border-[#0039A6]"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F1F5F9] dark:bg-[#090F1A] shrink-0">
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
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filter === f.id
                  ? 'bg-white dark:bg-[#131F33] text-[#0F172A] dark:text-white shadow-xs'
                  : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-[#64748B] dark:text-slate-400 py-8 text-center">
          Nenhum cliente encontrado para o filtro atual.
        </p>
      ) : (
        <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B] rounded-lg overflow-hidden max-h-[420px] overflow-y-auto">
          {filtered.map((cl) => {
            const isReleased = cl.simuladorSermigLiberado === true;
            const isBusy = togglingId === cl.id;
            return (
              <div
                key={cl.id}
                className="p-3.5 bg-white dark:bg-[#0D1524] hover:bg-[#F8FAFC] dark:hover:bg-[#131F33]/50 flex flex-wrap items-center justify-between gap-3 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-white truncate">
                    {cl.nomeCompleto}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-slate-400 truncate">
                    {cl.email} · Portal: {cl.portalLiberado ? 'Liberado' : cl.statusAcessoPortal}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      isReleased
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-[#64748B] dark:text-slate-400'
                    }`}
                  >
                    {isReleased ? (
                      <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    {isReleased ? 'Liberado' : 'Bloqueado'}
                  </span>

                  {canManageRelease && onToggleClientSimulatorAccess && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleToggle(cl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 whitespace-nowrap ${
                        isReleased
                          ? 'border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                          : 'bg-[#0039A6] hover:bg-[#002F87] text-white'
                      }`}
                    >
                      {isBusy ? 'Salvando...' : isReleased ? 'Revogar acesso' : 'Liberar Simulador'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
