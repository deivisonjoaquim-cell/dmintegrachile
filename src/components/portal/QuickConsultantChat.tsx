import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCheck,
  Clock,
  FileText,
  MessageCircle,
  Search,
  Send,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { CaseDocument, CommunicationLog } from '../../types/domain';
import {
  markClientChatRepliesRead,
  sendClientDocumentQuestion,
  subscribeClientDocumentChat,
} from '../../services/chatService';
import {
  buildPortalChatSubject,
  countUnreadChatForClient,
  filterPortalChatMessages,
  PORTAL_CHAT_TOPICS,
  QUICK_CHAT_SUGGESTIONS,
  type PortalChatTopicId,
} from '../../utils/documentChat';
import { formatDateBR, formatDateTimeBR } from '../../utils/formatters';

export interface QuickConsultantChatProps {
  mode: 'embedded' | 'floating';
  clientId: string;
  caseId?: string;
  remetenteUid: string;
  autorNome: string;
  docs: CaseDocument[];
  caseTitle?: string;
  /** Controle externo opcional para abrir o drawer flutuante com contexto pré-preenchido */
  externalOpenNonce?: number;
  externalTopic?: PortalChatTopicId;
  externalPrefillMessage?: string;
  /** Mensagens compartilhadas opcionalmente (evita listeners duplicados se o pai já assina) */
  sharedMessages?: CommunicationLog[];
}

function getDateSeparatorLabel(iso: string | undefined): string {
  if (!iso) return 'Histórico';
  const day = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (day === today) return 'Hoje';
  if (day === yesterday) return 'Ontem';
  return formatDateBR(day);
}

export const QuickConsultantChat: React.FC<QuickConsultantChatProps> = ({
  mode,
  clientId,
  caseId,
  remetenteUid,
  autorNome,
  docs,
  caseTitle,
  externalOpenNonce,
  externalTopic,
  externalPrefillMessage,
  sharedMessages,
}) => {
  const [open, setOpen] = useState(mode === 'embedded');
  const [internalMessages, setInternalMessages] = useState<CommunicationLog[]>([]);
  const [topic, setTopic] = useState<PortalChatTopicId>('processo_visto');
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [originFilter, setOriginFilter] = useState<'all' | 'cliente' | 'equipe'>('all');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [justSentMsg, setJustSentMsg] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const messages = sharedMessages ?? internalMessages;

  // Assina em tempo real no Firestore apenas quando o pai não forneceu `sharedMessages`
  useEffect(() => {
    if (sharedMessages !== undefined) return;
    if (!clientId) return;
    const unsub = subscribeClientDocumentChat(
      clientId,
      (list) => setInternalMessages(list),
      () => {
        // Silencioso; Firestore pode estar sincronizando
      },
    );
    return () => unsub();
  }, [clientId, sharedMessages]);

  // Abertura programática com contexto (ex.: clique em "Chat Rápido" dentro do monitor de prazos)
  useEffect(() => {
    if (!externalOpenNonce) return;
    if (mode === 'floating') setOpen(true);
    if (externalTopic) setTopic(externalTopic);
    if (externalPrefillMessage) setDraft(externalPrefillMessage);
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
  }, [externalOpenNonce, externalTopic, externalPrefillMessage, mode]);

  const unreadCount = useMemo(() => countUnreadChatForClient(messages), [messages]);

  const filteredMessages = useMemo(
    () => filterPortalChatMessages(messages, searchQuery, originFilter),
    [messages, searchQuery, originFilter],
  );

  // Marca respostas do consultor como lidas quando visível
  useEffect(() => {
    const isVisible = mode === 'embedded' || open;
    if (!isVisible || unreadCount === 0) return;
    void markClientChatRepliesRead(messages).catch(() => {});
  }, [mode, open, unreadCount, messages]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    const isVisible = mode === 'embedded' || open;
    if (!isVisible) return;
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [mode, open, filteredMessages.length]);

  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedDocId),
    [docs, selectedDocId],
  );

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sending) return;
    const text = draft.trim();
    if (!text) return;

    setSending(true);
    setErrorMsg(null);
    try {
      const assunto = buildPortalChatSubject(topic, selectedDoc?.nomeDocumento);
      await sendClientDocumentQuestion({
        clientId,
        caseId,
        remetenteUid,
        autorNome,
        mensagem: text,
        assunto,
        documentId: selectedDoc?.id,
        documentNome: selectedDoc?.nomeDocumento,
      });
      setDraft('');
      setJustSentMsg(true);
      window.setTimeout(() => setJustSentMsg(false), 2400);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Não foi possível enviar sua mensagem agora.',
      );
    } finally {
      setSending(false);
    }
  };

  const renderChatBody = () => (
    <div className="flex flex-col h-full">
      {/* Barra de Tópico + Documento + Busca no Histórico */}
      <div className="px-4 py-3 bg-[#F7F8FA] dark:bg-[#0B1220] border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-400 mb-1">
              Assunto da consulta
            </label>
            <select
              value={topic}
              onChange={(e) => {
                const next = e.target.value as PortalChatTopicId;
                setTopic(next);
                if (next !== 'documento') setSelectedDocId('');
              }}
              aria-label="Selecionar assunto da mensagem"
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs font-medium text-[#070E1C] dark:text-white focus:outline-none focus:border-[#0F3D91]"
            >
              {PORTAL_CHAT_TOPICS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#475569] dark:text-slate-400 mb-1">
              Vincular documento (opcional)
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => {
                setSelectedDocId(e.target.value);
                if (e.target.value) setTopic('documento');
              }}
              aria-label="Vincular documento específico à dúvida"
              className="w-full px-2.5 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs text-[#070E1C] dark:text-white focus:outline-none focus:border-[#0F3D91]"
            >
              <option value="">Nenhum documento específico</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nomeDocumento} ({d.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Busca e filtro no histórico registrado */}
        {messages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar no histórico de mensagens..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-xs text-[#070E1C] dark:text-white focus:outline-none focus:border-[#0F3D91]"
              />
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              {(
                [
                  { id: 'all', label: `Todas (${messages.length})` },
                  { id: 'equipe', label: 'Consultor' },
                  { id: 'cliente', label: 'Minhas' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setOriginFilter(f.id)}
                  className={`px-2 py-1 rounded-md font-semibold transition-colors whitespace-nowrap ${
                    originFilter === f.id
                      ? 'bg-[#070E1C] dark:bg-[#C9A86A] text-white dark:text-[#070E1C]'
                      : 'text-[#475569] dark:text-slate-400 hover:bg-white dark:hover:bg-[#152238]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Área de Histórico de Mensagens */}
      <div
        ref={listRef}
        className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white dark:bg-[#0D1422] ${
          mode === 'embedded' ? 'min-h-[280px] max-h-[420px]' : 'max-h-[340px] min-h-[240px]'
        }`}
      >
        {filteredMessages.length === 0 ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F7F8FA] dark:bg-[#111C30] border border-[#E5E7EB] dark:border-[#1E293B] flex items-center justify-center mx-auto">
              <MessageCircle className="w-5 h-5 text-[#0F3D91] dark:text-[#60A5FA]" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-[#070E1C] dark:text-white">
                {messages.length === 0
                  ? 'Canal direto registrado com seu consultor'
                  : 'Nenhuma mensagem corresponde à busca'}
              </p>
              <p className="text-xs text-[#475569] dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                {messages.length === 0
                  ? 'Todas as perguntas sobre Visto (SERMIG), emissão do RUT, documentos e prazos ficam salvas permanentemente no histórico do seu processo.'
                  : 'Limpe o termo de busca ou altere o filtro para visualizar todas as conversas registradas.'}
              </p>
            </div>
          </div>
        ) : (
          filteredMessages.map((msg, idx) => {
            const isClient = msg.origem === 'cliente';
            const currentDay = (msg.createdAt || '').slice(0, 10);
            const prevDay = idx > 0 ? (filteredMessages[idx - 1]?.createdAt || '').slice(0, 10) : '';
            const showDateDivider = idx === 0 || currentDay !== prevDay;

            return (
              <React.Fragment key={msg.id}>
                {showDateDivider && (
                  <div className="flex items-center gap-2 py-1">
                    <span className="h-px flex-1 bg-[#E5E7EB] dark:bg-[#1E293B]" />
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-[#64748B] dark:text-slate-400">
                      {getDateSeparatorLabel(msg.createdAt)}
                    </span>
                    <span className="h-px flex-1 bg-[#E5E7EB] dark:bg-[#1E293B]" />
                  </div>
                )}

                <div className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      isClient
                        ? 'bg-[#070E1C] dark:bg-[#0F3D91] text-white rounded-br-xs'
                        : 'bg-[#F7F8FA] dark:bg-[#152036] text-[#070E1C] dark:text-slate-100 border border-[#E5E7EB] dark:border-[#24324A] rounded-bl-xs'
                    }`}
                  >
                    {msg.assunto && (
                      <div
                        className={`flex items-center gap-1 text-[10px] font-bold mb-1 ${
                          isClient ? 'text-[#E5C77B]' : 'text-[#0F3D91] dark:text-[#60A5FA]'
                        }`}
                      >
                        <FileText className="w-3 h-3 shrink-0" />
                        <span className="truncate">{msg.assunto}</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.mensagem}</p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-[#64748B] dark:text-slate-400 mt-1 px-1 font-mono tabular-nums">
                    <span>{isClient ? 'Você' : msg.autorNome || 'Consultor D&M'}</span>
                    <span>·</span>
                    <span>{formatDateTimeBR(msg.createdAt)}</span>
                    {isClient && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-0.5">
                          {msg.lidaPelaEquipe ? (
                            <>
                              <CheckCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>Lida</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>Registrada</span>
                            </>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
      </div>

      {/* Sugestões Rápidas de Consulta */}
      <div className="px-4 py-2 bg-[#FAFBFD] dark:bg-[#0A1220] border-t border-[#E5E7EB] dark:border-[#1E293B] flex items-center gap-1.5 overflow-x-auto">
        {QUICK_CHAT_SUGGESTIONS.map((sug) => (
          <button
            key={sug.label}
            type="button"
            onClick={() => {
              setTopic(sug.topic);
              setDraft(sug.text);
              inputRef.current?.focus();
            }}
            className="px-2.5 py-1 rounded-md border border-[#D1D5DB] dark:border-[#24324A] bg-white dark:bg-[#111C30] text-[11px] font-medium text-[#334155] dark:text-slate-300 hover:border-[#0F3D91] hover:text-[#0F3D91] dark:hover:text-[#60A5FA] whitespace-nowrap shrink-0 transition-colors"
          >
            + {sug.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950/50 border-t border-red-200 dark:border-red-800 text-[11px] text-red-700 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {justSentMsg && !errorMsg && (
        <div className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" />
          Mensagem registrada no protocolo do seu processo.
        </div>
      )}

      {/* Formulário de Envio */}
      <form
        onSubmit={handleSend}
        className="p-3 bg-white dark:bg-[#0D1422] border-t border-[#E5E7EB] dark:border-[#1E293B] flex items-end gap-2"
      >
        <textarea
          ref={inputRef}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Escreva sua dúvida ao consultor (Enter para enviar)..."
          maxLength={2000}
          className="flex-1 resize-none px-3 py-2 rounded-lg border border-[#D1D5DB] dark:border-[#24324A] bg-[#F7F8FA] dark:bg-[#111C30] text-xs text-[#070E1C] dark:text-white focus:bg-white dark:focus:bg-[#152238] focus:border-[#0F3D91] focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Enviar mensagem ao consultor"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-lg bg-[#070E1C] dark:bg-[#0F3D91] hover:opacity-95 text-white text-xs font-semibold disabled:opacity-40 whitespace-nowrap shrink-0 transition-opacity"
        >
          <Send className="w-3.5 h-3.5 text-[#C9A86A]" />
          <span>{sending ? 'Enviando...' : 'Enviar'}</span>
        </button>
      </form>
    </div>
  );

  // Modo incorporado (card completo dentro do Painel do Cliente)
  if (mode === 'embedded') {
    return (
      <section
        id="chat-rapido-consultor"
        aria-label="Chat Rápido registrado com o consultor"
        className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-[#070E1C] text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4 text-[#C9A86A]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#C9A86A]">
                Chat Rápido · Histórico Registrado
              </p>
              <h2 className="font-display text-base font-bold text-white truncate">
                Comunicação Direta com seu Consultor
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-300 font-mono tabular-nums shrink-0">
            {caseTitle && <span className="hidden sm:inline truncate max-w-[220px]">{caseTitle}</span>}
            <span>{messages.length} msg(s)</span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded bg-red-600 text-white font-bold">
                {unreadCount} nova(s)
              </span>
            )}
          </div>
        </div>
        {renderChatBody()}
      </section>
    );
  }

  // Modo flutuante (botão discreto + gaveta acessível em qualquer aba do Portal)
  return (
    <div className="fixed bottom-5 right-5 z-40 no-print">
      {open ? (
        <div className="w-[min(410px,calc(100vw-2rem))] rounded-2xl bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] shadow-[0_24px_60px_rgba(7,14,28,0.28)] flex flex-col overflow-hidden">
          <div className="px-4 py-3.5 bg-[#070E1C] text-white flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-[#C9A86A]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold leading-tight truncate">
                  Chat Rápido · Consultor
                </p>
                <p className="text-[10px] text-slate-300 truncate">
                  Histórico salvo · Visto, RUT e Documentos
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar Chat Rápido"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {renderChatBody()}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative inline-flex items-center gap-2.5 px-4 py-3 rounded-xl bg-[#070E1C] dark:bg-[#0F3D91] text-white text-xs font-bold shadow-[0_12px_32px_rgba(7,14,28,0.32)] hover:opacity-95 transition-opacity border border-white/15"
        >
          <MessageCircle className="w-4 h-4 text-[#C9A86A]" />
          <span>Chat Rápido</span>
          {unreadCount > 0 && (
            <span className="ml-0.5 min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-mono font-bold inline-flex items-center justify-center tabular-nums">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};
