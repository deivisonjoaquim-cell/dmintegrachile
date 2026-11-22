import React, { useState } from 'react';
import { Calendar, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { makeId, saveDocumentAudited } from '../services/firestoreService';
import { BrandRibbon } from './BrandLogo';

interface CalendlyModalProps {
  open: boolean;
  onClose: () => void;
  clientId?: string;
  caseId?: string;
  defaultTitle?: string;
  onConfirmed?: () => void;
}

export const CalendlyModal: React.FC<CalendlyModalProps> = ({
  open,
  onClose,
  clientId,
  caseId,
  defaultTitle = 'Reunião de Diagnóstico / Alinhamento',
  onConfirmed,
}) => {
  const { empresa, userProfile } = useApp();
  const [dataHora, setDataHora] = useState(() => {
    const d = new Date(Date.now() + 2 * 86400000);
    return `${d.toISOString().slice(0, 10)}T14:00`;
  });
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const calendlyUrl = (empresa.linkCalendly || '').trim();

  const handleConfirmBooking = async () => {
    setErrorMsg(null);
    if (!userProfile) {
      setErrorMsg('Para vincular o agendamento diretamente ao seu processo, acesse sua conta Google em "Portal do Cliente".');
      return;
    }
    setSaving(true);
    try {
      const id = makeId('apt');
      await saveDocumentAudited(
        'appointments',
        id,
        {
          id,
          titulo: defaultTitle,
          dataHoraInicio: dataHora,
          clientId: clientId || userProfile.clientId || '',
          caseId: caseId || '',
          tipo: 'Diagnóstico',
          linkReuniao: calendlyUrl,
          status: 'Confirmado',
          observacoes: 'Agendamento confirmado pelo usuário via modal Calendly.',
          createdAt: new Date().toISOString(),
        },
        true,
        userProfile.role,
      );
      setConfirmed(true);
      onConfirmed?.();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao registrar agendamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#071320]/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Agendar reunião no Calendly"
    >
      <div className="bg-white border border-[#E5DFD2] rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <BrandRibbon className="h-[3px] w-full" />
        <div className="bg-[#0B1F33] text-white flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-[#E5C76B]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#E5C76B]">
                Consultoria Migratória · Brasil &amp; Chile
              </p>
              <h2 className="font-display text-lg font-bold text-white truncate">Agendar Atendimento</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar agendamento"
            className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {calendlyUrl ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm text-[#4A5A6D]">Escolha o melhor horário abaixo ou abra o Calendly em uma nova aba.</p>
                <a
                  href={calendlyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-[#DDD6C7] bg-[#FAF9F6] text-xs font-semibold text-[#0B1F33] hover:bg-[#F1EDE4] whitespace-nowrap shrink-0 transition-colors"
                >
                  Abrir em nova aba
                  <ExternalLink className="w-3.5 h-3.5 text-[#8C6D14]" />
                </a>
              </div>
              <div className="w-full h-[420px] rounded-xl overflow-hidden border border-[#E5DFD2] bg-[#FAF9F6]">
                <iframe
                  title="Agenda Calendly"
                  src={calendlyUrl}
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-200 text-sm text-amber-950 leading-relaxed">
              O agendamento automático online está temporariamente indisponível. Você pode registrar sua preferência de horário abaixo ou falar diretamente conosco pelo WhatsApp.
            </div>
          )}

          <div className="pt-4 border-t border-[#E5DFD2]">
            <p className="brand-kicker mb-1">Registro no Portal</p>
            <h3 className="text-sm font-bold text-[#0B1F33] mb-3">Confirmar meu agendamento</h3>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-semibold text-[#0B1F33] mb-1" htmlFor="calendly-confirm-dt">
                  Data e horário escolhidos (horário de Brasília)
                </label>
                <input
                  id="calendly-confirm-dt"
                  type="datetime-local"
                  value={dataHora}
                  onChange={(e) => setDataHora(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-[#DDD6C7] bg-white text-sm text-[#0B1523] font-mono tabular-nums"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmBooking}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50 hover:opacity-95 transition-opacity"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? 'Confirmando...' : 'Confirmar meu agendamento'}
              </button>
            </div>
            {confirmed && (
              <p className="mt-3 text-sm text-[#146B43] flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Agendamento registrado com sucesso!
              </p>
            )}
            {errorMsg && <p className="mt-2 text-xs text-[#A61C2B] font-medium">{errorMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
