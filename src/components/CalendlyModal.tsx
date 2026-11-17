import React, { useState } from 'react';
import { Calendar, CheckCircle2, ExternalLink, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { makeId, saveDocumentAudited } from '../services/firestoreService';

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
      setErrorMsg('Para registrar o agendamento diretamente no seu processo, faça login com Google em "Acompanhar processo".');
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
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Agendar reunião no Calendly"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold text-slate-900">Agendar Atendimento</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar agendamento"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {calendlyUrl ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-600">Escolha o melhor horário abaixo ou abra o Calendly em uma nova aba.</p>
                <a
                  href={calendlyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Abrir em nova aba
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="w-full h-[420px] rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                <iframe
                  title="Agenda Calendly"
                  src={calendlyUrl}
                  className="w-full h-full border-0"
                />
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
              O link do Calendly ainda não foi configurado em Configurações &gt; Empresa. Você pode registrar a confirmação de horário abaixo ou falar via WhatsApp.
            </div>
          )}

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Confirmar meu agendamento no sistema</h3>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-700 mb-1" htmlFor="calendly-confirm-dt">
                  Data e horário escolhidos (America/Sao_Paulo)
                </label>
                <input
                  id="calendly-confirm-dt"
                  type="datetime-local"
                  value={dataHora}
                  onChange={(e) => setDataHora(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={handleConfirmBooking}
                className="px-4 py-2.5 rounded-lg text-sm font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? 'Confirmando...' : 'Confirmar meu agendamento'}
              </button>
            </div>
            {confirmed && (
              <p className="mt-3 text-sm text-[#1E7E34] flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Agendamento registrado com sucesso!
              </p>
            )}
            {errorMsg && <p className="mt-2 text-xs text-[#C82333]">{errorMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
