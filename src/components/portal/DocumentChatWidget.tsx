import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import {
  markClientChatRepliesRead,
  sendClientDocumentQuestion,
  subscribeClientDocumentChat,
} from '../../services/chatService';
import type { Case, CaseDocument, Client, CommunicationLog, UserProfile } from '../../types/domain';
import { countUnreadChatForClient, inferChatSenderRole } from '../../utils/documentChat';
import { formatDateTimeBR } from '../../utils/formatters';

interface DocumentChatWidgetProps {
  client: Client | null;
  activeCase: Case | null;
  docs: CaseDocument[];
  userProfile: UserProfile;
  onPortalToast?: (msg: string) => void;
}

export const DocumentChatWidget: React.FC<DocumentChatWidgetProps> = ({
  client,
  activeCase,
  docs,
  userProfile,
  onPortalToast,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CommunicationLog[]>([]);
  const [loadingChat, setLoadingChat] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const listEndRef = useRef<HTMLDivElement | null>(null);
  const clientId = userProfile.clientId || client?.id || '';

  useEffect(() => {
    if (!clientId) {
      setMessages([]);
      setLoadingChat(false);
      return;
    }
    setLoadingChat(true);
    setChatError(null);
    const unsub = subscribeClientDocumentChat(
      clientId,
      (next) => {
        setMessages(next);
        setLoadingChat(false);
      },
      () => {
        setChatError('Não foi possível sincronizar o chat em tempo real.');
        setLoadingChat(false);
      },
    );
    return () => unsub();
  }, [clientId]);

  const unreadCount = useMemo(() => countUnreadChatForClient(messages), [messages]);

  useEffect(() => {
    if (open && unreadCount > 0) {
      void markClientChatRepliesRead(messages).catch(() => undefined);
    }
  }, [open, unreadCount, messages]);

  useEffect(() => {
    if (open) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [open, messages.length]);

  if (!clientId) return null;

  const selectedDoc = docs.find((d) => d.id === selectedDocId) || null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setChatError(null);
    try {
      await sendClientDocumentQuestion({
        clientId,
        caseId: activeCase?.id,
        remetenteUid: userProfile.uid,
        autorNome: client?.nomeCompleto || userProfile.nome || userProfile.email,
        mensagem: text,
        documentId: selectedDoc?.id,
        documentNome: selectedDoc
          ? `${selectedDoc.nomeDocumento}${selectedDoc.pessoa && selectedDoc.pessoa !== 'Titular' ? ` (${selectedDoc.pessoa})` : ''}`
          : undefined,
      });
      setDraft('');
      onPortalToast?.('Sua dúvida foi enviada e registrada no histórico do processo.');
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Falha ao enviar sua dúvida.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-16 right-4 md:bottom-6 md:right-6 z-40 no-print">
      {open ? (
        <section
          aria-label="Chat rápido de dúvidas sobre documentos"
          className="w-[calc(100vw-2rem)] sm:w-[390px] max-h-[75vh] sm:max-h-[540px] bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold flex items-center gap-1.5 truncate">
                <MessageCircle className="w-4 h-4 shrink-0" />
                Chat de Dúvidas · Documentos
              </p>
              <p className="text-[11px] text-slate-300 truncate">
                Integrado ao histórico do seu processo
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar chat de dúvidas"
              className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3.5 py-2.5 border-b border-slate-200 bg-white">
            <label htmlFor="portal-chat-doc-select" className="block text-[11px] font-semibold text-slate-600 mb-1">
              Documento relacionado (opcional)
            </label>
            <select
              id="portal-chat-doc-select"
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
            >
              <option value="">Dúvida geral sobre documentos</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nomeDocumento}
                  {d.pessoa && d.pessoa !== 'Titular' ? ` (${d.pessoa})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-h-[200px] overflow-y-auto p-3.5 space-y-3 bg-slate-50">
            {loadingChat ? (
              <p className="text-xs text-slate-500 text-center py-8">Carregando histórico do chat...</p>
            ) : messages.length === 0 ? (
              <div className="p-3.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-800">Envie sua primeira dúvida</p>
                <p>
                  Escolha um documento acima (ou envie uma dúvida geral) e nossa equipe responderá diretamente aqui e no histórico do processo.
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isClient = inferChatSenderRole(msg) === 'cliente';
                return (
                  <div key={msg.id} className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs space-y-1 ${
                        isClient
                          ? 'text-white'
                          : 'bg-white border border-slate-200 text-slate-800'
                      }`}
                      style={isClient ? { backgroundColor: 'var(--color-primary)' } : undefined}
                    >
                      {msg.documentNome && (
                        <p className={`text-[10px] font-semibold ${isClient ? 'text-white/90' : 'text-[var(--color-primary)]'}`}>
                          Doc: {msg.documentNome}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.mensagem}</p>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 px-1 tabular-nums">
                      {isClient ? 'Você' : msg.autorNome || 'Consultoria'} · {formatDateTimeBR(msg.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={listEndRef} />
          </div>

          {chatError && (
            <div className="px-3.5 py-2 bg-red-50 border-t border-red-200 text-[11px] text-red-800">
              {chatError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-3 border-t border-slate-200 bg-white flex items-end gap-2">
            <textarea
              rows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Escreva sua dúvida sobre o documento..."
              aria-label="Mensagem de dúvida sobre documento"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs resize-none focus:outline-none focus:border-slate-500"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Enviar dúvida"
              className="min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Enviando...' : 'Enviar'}</span>
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir chat de dúvidas sobre documentos"
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 text-white border border-slate-700 shadow-lg hover:bg-slate-800 transition-colors flex items-center gap-2.5 text-xs font-semibold"
        >
          <MessageCircle className="w-4 h-4 shrink-0" />
          <span>Dúvidas de Documentos</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded bg-[#C82333] text-white text-[11px] font-bold tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
