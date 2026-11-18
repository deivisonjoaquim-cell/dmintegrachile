import test from 'node:test';
import assert from 'node:assert/strict';
import type { Case, Client, CommunicationLog } from '../types/domain';
import {
  buildClientDocumentChatPayload,
  buildStaffChatReplyPayload,
  CHAT_ASSUNTO_MAX_LEN,
  CHAT_AUTOR_MAX_LEN,
  CHAT_DOC_NOME_MAX_LEN,
  CHAT_MENSAGEM_MAX_LEN,
  countUnreadChatForClient,
  countUnreadChatForStaff,
  getPendingClientChatThreads,
  sortChatMessagesChronologically,
} from './documentChat';

test('buildClientDocumentChatPayload cria payload sanitizado e truncado conforme schema', () => {
  const longName = 'A'.repeat(400);
  const longDoc = 'D'.repeat(400);
  const longMsg = 'M'.repeat(6000);

  const payload = buildClientDocumentChatPayload({
    id: 'chat_1',
    clientId: 'cli_1',
    caseId: 'case_1',
    remetenteUid: 'uid_cliente',
    autorNome: longName,
    mensagem: `   ${longMsg}   `,
    documentId: 'doc_1',
    documentNome: longDoc,
    createdAt: '2026-11-18T10:00:00.000Z',
  });

  assert.equal(payload.canal, 'Chat Portal');
  assert.equal(payload.origem, 'cliente');
  assert.equal(payload.lidaPelaEquipe, false);
  assert.equal(payload.lidaPeloCliente, true);
  assert.equal(payload.autorNome.length, CHAT_AUTOR_MAX_LEN);
  assert.equal(payload.documentNome?.length, CHAT_DOC_NOME_MAX_LEN);
  assert.equal(payload.assunto.length <= CHAT_ASSUNTO_MAX_LEN, true);
  assert.equal(payload.mensagem.length, CHAT_MENSAGEM_MAX_LEN);
  assert.match(payload.assunto, /^Dúvida sobre documento:/);
});

test('buildClientDocumentChatPayload rejeita mensagem vazia', () => {
  assert.throws(
    () =>
      buildClientDocumentChatPayload({
        id: 'chat_2',
        clientId: 'cli_1',
        remetenteUid: 'uid_1',
        autorNome: 'Ana',
        mensagem: '    ',
      }),
    /Digite sua dúvida/,
  );
});

test('buildStaffChatReplyPayload marca lidaPelaEquipe=true e lidaPeloCliente=false', () => {
  const reply = buildStaffChatReplyPayload({
    id: 'chat_reply_1',
    clientId: 'cli_1',
    caseId: 'case_1',
    remetenteUid: 'uid_staff',
    autorNome: 'Deivison',
    mensagem: 'Pode enviar o PDF da apostila de Haia frente e verso.',
    documentId: 'doc_1',
    documentNome: 'Antecedentes Criminais PF',
    createdAt: '2026-11-18T10:05:00.000Z',
  });

  assert.equal(reply.canal, 'Chat Portal');
  assert.equal(reply.origem, 'equipe');
  assert.equal(reply.assunto, 'Resposta — Antecedentes Criminais PF');
  assert.equal(reply.lidaPelaEquipe, true);
  assert.equal(reply.lidaPeloCliente, false);
});

test('sortChatMessagesChronologically e contadores ignoram outros canais e ordenam por createdAt', () => {
  const logs: CommunicationLog[] = [
    {
      id: 'wpp_1',
      canal: 'WhatsApp',
      assunto: 'Contato externo',
      mensagem: 'Não deve aparecer no widget',
      clientId: 'cli_1',
      autorNome: 'Consultor',
      createdAt: '2026-11-18T09:00:00.000Z',
    },
    {
      id: 'chat_b',
      canal: 'Chat Portal',
      assunto: 'Resposta',
      mensagem: 'Recebemos sim.',
      clientId: 'cli_1',
      origem: 'equipe',
      lidaPelaEquipe: true,
      lidaPeloCliente: false,
      autorNome: 'Consultor',
      createdAt: '2026-11-18T10:10:00.000Z',
    },
    {
      id: 'chat_a',
      canal: 'Chat Portal',
      assunto: 'Dúvida',
      mensagem: 'Precisa traduzir?',
      clientId: 'cli_1',
      origem: 'cliente',
      lidaPelaEquipe: false,
      lidaPeloCliente: true,
      autorNome: 'João',
      createdAt: '2026-11-18T10:00:00.000Z',
    },
  ];

  const sorted = sortChatMessagesChronologically(logs);
  assert.deepEqual(
    sorted.map((m) => m.id),
    ['chat_a', 'chat_b'],
  );
  assert.equal(countUnreadChatForStaff(logs), 1);
  assert.equal(countUnreadChatForClient(logs), 1);
});

test('getPendingClientChatThreads prioriza clientes com dúvidas não lidas', () => {
  const clients: Client[] = [
    {
      id: 'cli_1',
      nomeCompleto: 'Maria Silva',
      cpf: '',
      email: 'maria@example.com',
      whatsapp: '11999999999',
      portalLiberado: true,
      statusAcessoPortal: 'Liberado',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
    {
      id: 'cli_2',
      nomeCompleto: 'Carlos Souza',
      cpf: '',
      email: 'carlos@example.com',
      whatsapp: '11888888888',
      portalLiberado: true,
      statusAcessoPortal: 'Liberado',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ];
  const cases: Case[] = [
    {
      id: 'case_1',
      titulo: 'Maria — Mercosul',
      clientId: 'cli_1',
      tipoServico: 'Residência Temporal',
      etapaPipeline: 3,
      statusSermig: 'Não protocolado',
      portalLiberado: true,
      relatorioViabilidadeLiberado: false,
      prioridade: 'Alta',
      createdAt: '2026-11-02T00:00:00.000Z',
    },
    {
      id: 'case_2',
      titulo: 'Carlos — Reunificação',
      clientId: 'cli_2',
      tipoServico: 'Residência Temporal',
      etapaPipeline: 4,
      statusSermig: 'Não protocolado',
      portalLiberado: true,
      relatorioViabilidadeLiberado: false,
      prioridade: 'Média',
      createdAt: '2026-11-02T00:00:00.000Z',
    },
  ];
  const logs: CommunicationLog[] = [
    {
      id: 'c2_msg',
      canal: 'Chat Portal',
      assunto: 'Resposta',
      mensagem: 'Tudo certo!',
      clientId: 'cli_2',
      caseId: 'case_2',
      origem: 'equipe',
      lidaPelaEquipe: true,
      lidaPeloCliente: true,
      autorNome: 'Consultor',
      createdAt: '2026-11-18T11:00:00.000Z',
    },
    {
      id: 'c1_msg',
      canal: 'Chat Portal',
      assunto: 'Dúvida sobre documento: Passaporte',
      mensagem: 'Vale passaporte com 8 meses?',
      clientId: 'cli_1',
      caseId: 'case_1',
      origem: 'cliente',
      lidaPelaEquipe: false,
      lidaPeloCliente: true,
      autorNome: 'Maria Silva',
      documentNome: 'Passaporte',
      createdAt: '2026-11-18T10:30:00.000Z',
    },
  ];

  const threads = getPendingClientChatThreads(logs, clients, cases);
  assert.equal(threads.length, 2);
  assert.equal(threads[0].clientId, 'cli_1');
  assert.equal(threads[0].unreadCount, 1);
  assert.equal(threads[0].awaitingReply, true);
  assert.equal(threads[0].caseId, 'case_1');
  assert.equal(threads[1].clientId, 'cli_2');
  assert.equal(threads[1].unreadCount, 0);
  assert.equal(threads[1].awaitingReply, false);
});
