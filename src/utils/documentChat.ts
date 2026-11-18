import type { Case, Client, CommunicationLog } from '../types/domain';

export const CHAT_ASSUNTO_MAX_LEN = 250;
export const CHAT_MENSAGEM_MAX_LEN = 5000;
export const CHAT_AUTOR_MAX_LEN = 200;
export const CHAT_DOC_NOME_MAX_LEN = 250;

export interface BuildClientChatPayloadInput {
  id: string;
  clientId: string;
  caseId?: string;
  remetenteUid: string;
  autorNome: string;
  mensagem: string;
  documentId?: string;
  documentNome?: string;
  createdAt?: string;
}

export interface BuildStaffChatReplyInput {
  id: string;
  clientId: string;
  caseId?: string;
  remetenteUid?: string;
  autorNome: string;
  mensagem: string;
  documentId?: string;
  documentNome?: string;
  createdAt?: string;
}

export interface ChatThreadSummary {
  clientId: string;
  clientName: string;
  caseId: string;
  caseTitle: string;
  unreadCount: number;
  totalMessages: number;
  awaitingReply: boolean;
  lastMessage: CommunicationLog;
}

function normalizeOptionalString(value: string | undefined, maxLen: number): string | undefined {
  const trimmed = (value || '').trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLen);
}

export function isPortalChatLog(log: Pick<CommunicationLog, 'canal'>): boolean {
  return log.canal === 'Chat Portal';
}

export function inferChatSenderRole(log: Pick<CommunicationLog, 'origem'>): 'cliente' | 'equipe' {
  return log.origem === 'cliente' ? 'cliente' : 'equipe';
}

export function buildClientDocumentChatPayload(input: BuildClientChatPayloadInput): CommunicationLog {
  const cleanMensagem = input.mensagem.trim().slice(0, CHAT_MENSAGEM_MAX_LEN);
  if (!cleanMensagem) {
    throw new Error('Digite sua dúvida antes de enviar.');
  }
  const cleanClientId = input.clientId.trim().slice(0, 128);
  if (!cleanClientId) {
    throw new Error('Cliente não identificado para enviar a mensagem.');
  }
  const cleanUid = input.remetenteUid.trim().slice(0, 128);
  if (!cleanUid) {
    throw new Error('Sessão do cliente inválida.');
  }

  const cleanDocName = normalizeOptionalString(input.documentNome, CHAT_DOC_NOME_MAX_LEN);
  const cleanDocId = normalizeOptionalString(input.documentId, 128);
  const cleanCaseId = normalizeOptionalString(input.caseId, 128);
  const cleanAutor = (input.autorNome.trim() || 'Cliente').slice(0, CHAT_AUTOR_MAX_LEN);
  const createdAt = input.createdAt || new Date().toISOString();

  const assunto = (
    cleanDocName ? `Dúvida sobre documento: ${cleanDocName}` : 'Dúvida sobre documentos do processo'
  ).slice(0, CHAT_ASSUNTO_MAX_LEN);

  return {
    id: input.id.trim().slice(0, 128),
    canal: 'Chat Portal',
    assunto,
    mensagem: cleanMensagem,
    clientId: cleanClientId,
    caseId: cleanCaseId,
    autorNome: cleanAutor,
    origem: 'cliente',
    remetenteUid: cleanUid,
    documentId: cleanDocId,
    documentNome: cleanDocName,
    lidaPelaEquipe: false,
    lidaPeloCliente: true,
    createdAt,
    updatedAt: createdAt,
  };
}

export function buildStaffChatReplyPayload(input: BuildStaffChatReplyInput): CommunicationLog {
  const cleanMensagem = input.mensagem.trim().slice(0, CHAT_MENSAGEM_MAX_LEN);
  if (!cleanMensagem) {
    throw new Error('Digite uma resposta antes de enviar.');
  }
  const cleanClientId = input.clientId.trim().slice(0, 128);
  if (!cleanClientId) {
    throw new Error('Cliente não identificado para responder.');
  }

  const cleanDocName = normalizeOptionalString(input.documentNome, CHAT_DOC_NOME_MAX_LEN);
  const cleanDocId = normalizeOptionalString(input.documentId, 128);
  const cleanCaseId = normalizeOptionalString(input.caseId, 128);
  const cleanUid = normalizeOptionalString(input.remetenteUid, 128);
  const cleanAutor = (input.autorNome.trim() || 'Consultoria D&M').slice(0, CHAT_AUTOR_MAX_LEN);
  const createdAt = input.createdAt || new Date().toISOString();

  const assunto = (
    cleanDocName ? `Resposta — ${cleanDocName}` : 'Resposta da consultoria (Chat Portal)'
  ).slice(0, CHAT_ASSUNTO_MAX_LEN);

  return {
    id: input.id.trim().slice(0, 128),
    canal: 'Chat Portal',
    assunto,
    mensagem: cleanMensagem,
    clientId: cleanClientId,
    caseId: cleanCaseId,
    autorNome: cleanAutor,
    origem: 'equipe',
    remetenteUid: cleanUid,
    documentId: cleanDocId,
    documentNome: cleanDocName,
    lidaPelaEquipe: true,
    lidaPeloCliente: false,
    createdAt,
    updatedAt: createdAt,
  };
}

export function sortChatMessagesChronologically(logs: CommunicationLog[]): CommunicationLog[] {
  return logs
    .filter(isPortalChatLog)
    .slice()
    .sort((a, b) => {
      const cmp = (a.createdAt || '').localeCompare(b.createdAt || '');
      if (cmp !== 0) return cmp;
      return (a.id || '').localeCompare(b.id || '');
    });
}

export function countUnreadChatForClient(logs: CommunicationLog[]): number {
  return logs.filter(
    (l) => isPortalChatLog(l) && l.origem === 'equipe' && l.lidaPeloCliente !== true,
  ).length;
}

export function countUnreadChatForStaff(logs: CommunicationLog[]): number {
  return logs.filter(
    (l) => isPortalChatLog(l) && l.origem === 'cliente' && l.lidaPelaEquipe !== true,
  ).length;
}

export function getPendingClientChatThreads(
  logs: CommunicationLog[],
  clients: Client[],
  cases: Case[],
): ChatThreadSummary[] {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const grouped = new Map<string, CommunicationLog[]>();

  for (const log of sortChatMessagesChronologically(logs)) {
    const cId = (log.clientId || '').trim();
    if (!cId) continue;
    const bucket = grouped.get(cId) || [];
    bucket.push(log);
    grouped.set(cId, bucket);
  }

  const threads: ChatThreadSummary[] = [];
  for (const [clientId, msgs] of grouped.entries()) {
    const lastMessage = msgs[msgs.length - 1];
    if (!lastMessage) continue;
    const unreadCount = countUnreadChatForStaff(msgs);
    const clientObj = clientMap.get(clientId);
    const matchingCase =
      (lastMessage.caseId ? cases.find((c) => c.id === lastMessage.caseId) : undefined) ||
      cases.find((c) => c.clientId === clientId && !c.arquivado) ||
      cases.find((c) => c.clientId === clientId);

    const awaitingReply = unreadCount > 0 || lastMessage.origem === 'cliente';
    threads.push({
      clientId,
      clientName: clientObj?.nomeCompleto || lastMessage.autorNome || 'Cliente',
      caseId: matchingCase?.id || lastMessage.caseId || '',
      caseTitle: matchingCase?.titulo || 'Processo sem caso vinculado',
      unreadCount,
      totalMessages: msgs.length,
      awaitingReply,
      lastMessage,
    });
  }

  return threads.sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    if (a.awaitingReply !== b.awaitingReply) return a.awaitingReply ? -1 : 1;
    return (b.lastMessage.createdAt || '').localeCompare(a.lastMessage.createdAt || '');
  });
}
