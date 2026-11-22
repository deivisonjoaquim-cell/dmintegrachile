import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';
import {
  markClientChatRepliesRead,
  sendClientDocumentQuestion,
  subscribeClientDocumentChat,
} from '../../services/chatService';
import type { Case, CaseDocument, Client, CommunicationLog, UserProfile } from '../../types/domain';
import { countUnreadChatForClient, inferChatSenderRole } from '../../utils/documentChat';
import { BrandRibbon } from '../BrandLogo';
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
          className="w-[calc(100vw-2rem)] sm:w-[395px] max-h-[75vh] sm:max-h-[550px] bg-white border border-[#E5DFD2] rounded-2xl shadow-[0_18px_42px_rgba(11,31,51,0.22)] flex flex-col overflow-hidden"
        >
          <BrandRibbon className="h-[3px] w-full" />
          <div className="px-4 py-3.5 bg-[#0B1F33] text-white flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold flex items-center gap-1.5 truncate">
                <MessageCircle className="w-4 h-4 text-[#E5C76B] shrink-0" />
                Chat de Dúvidas · Documentos
              </p>
              <p className="text-[11px] text-slate-300 truncate mt-0.5">
                Integrado ao histórico oficial do seu processo
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar chat de dúvidas"
              className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white shrink-0 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3.5 py-2.5 border-b border-[#E5DFD2] bg-white">
            <label htmlFor="portal-chat-doc-select" className="block text-[11px] font-semibold text-[#0B1F33] mb-1">
              Documento relacionado (opcional)
            </label>
            <select
              id="portal-chat-doc-select"
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#DDD6C7] text-xs bg-[#FAF9F6] text-[#0B1523]"
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

          <div className="flex-1 min-h-[200px] overflow-y-auto p-3.5 space-y-3 bg-[#FAF9F6]">
            {loadingChat ? (
              <p className="text-xs text-[#4A5A6D] text-center py-8">Carregando histórico do chat...</p>
            ) : messages.length === 0 ? (
              <div className="p-4 rounded-xl bg-white border border-[#E5DFD2] text-xs text-[#4A5A6D] space-y-1">
                <p className="font-bold text-[#0B1F33]">Envie sua primeira dúvida</p>
                <p className="leading-relaxed">
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
                          ? 'bg-[#0B1F33] text-white'
                          : 'bg-white border border-[#E5DFD2] text-[#0B1523]'
                      }`}
                    >
                      {msg.documentNome && (
                        <p className={`text-[10px] font-semibold ${isClient ? 'text-[#E5C76B]' : 'text-[#8C6D14]'}`}>
                          Doc: {msg.documentNome}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.mensagem}</p>
                    </div>
                    <p className="text-[10px] text-[#4A5A6D] mt-1 px-1 font-mono tabular-nums">
                      {isClient ? 'Você' : msg.autorNome || 'Consultoria'} · {formatDateTimeBR(msg.createdAt)}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={listEndRef} />
          </div>

          {chatError && (
            <div className="px-3.5 py-2 bg-red-50 border-t border-red-200 text-[11px] text-[#A61C2B]">
              {chatError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-3 border-t border-[#E5DFD2] bg-white flex items-end gap-2">
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
              className="flex-1 px-3 py-2 rounded-lg border border-[#DDD6C7] bg-[#FAF9F6] text-xs text-[#0B1523] resize-none focus:bg-white focus:outline-none focus:border-[#0B1F33]"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Enviar dúvida"
              className="min-h-[40px] px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0B1F33] hover:opacity-95 text-white inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50 transition-opacity"
            >
              <Send className="w-3.5 h-3.5 text-[#E5C76B]" />
              <span>{sending ? 'Enviando...' : 'Enviar'}</span>
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir chat de dúvidas sobre documentos"
          className="min-h-[46px] px-4.5 py-2.5 rounded-full bg-[#0B1F33] text-white border border-[#C8A236]/45 shadow-[0_12px_28px_rgba(11,31,51,0.28)] hover:bg-[#132E4A] hover:-translate-y-0.5 transition-all duration-150 flex items-center gap-2.5 text-xs font-semibold"
        >
          <MessageCircle className="w-4 h-4 text-[#E5C76B] shrink-0" />
          <span>Dúvidas de Documentos</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#C8A236] text-[#0B1523] text-[11px] font-mono font-bold tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
