import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  AI_ATTACHMENT_MAX_BINARY_BYTES,
  clearAiDraftCache,
  CLIENT_MSG_AI_GENERIC_ERROR,
  CLIENT_MSG_AI_HIGH_DEMAND,
  compactCaseForAi,
  compactClientForAi,
  compactLegalSourcesForAi,
  compactSourceForAi,
  estimateBase64DecodedBytes,
  loadAiDraftCache,
  prepareAiAttachment,
  sanitizeClientAiError,
  saveAiDraftCache,
} from './aiClient';

describe('aiClient — Error Sanitization, Payload Compaction & Short-Lived Cache', () => {
  it('sanitizes raw 503/429 Gemini JSON into clean Portuguese message', () => {
    const rawJson503 =
      '{"error":{"code":503,"status":"UNAVAILABLE","message":"This model is currently experiencing high demand."}}';
    assert.equal(sanitizeClientAiError(rawJson503), CLIENT_MSG_AI_HIGH_DEMAND);
    assert.equal(sanitizeClientAiError(new Error(rawJson503)), CLIENT_MSG_AI_HIGH_DEMAND);
    assert.equal(sanitizeClientAiError('HTTP 429 RESOURCE_EXHAUSTED'), CLIENT_MSG_AI_HIGH_DEMAND);
  });

  it('never leaks raw JSON or English stack errors on unknown errors', () => {
    assert.equal(sanitizeClientAiError('{"error":{"code":500,"message":"Internal error"}}'), CLIENT_MSG_AI_GENERIC_ERROR);
    assert.equal(sanitizeClientAiError(new Error('TypeError: Cannot read properties of undefined')), CLIENT_MSG_AI_GENERIC_ERROR);
  });

  it('preserves vetted Portuguese messages including HTTP/AI error explanations', () => {
    const msgs = [
      'Faça login com sua conta Google para utilizar o apoio de IA.',
      'Modo de regras locais ativo: a chave da IA não está configurada no servidor.',
      'Chave de IA inválida ou sem permissão de acesso no servidor.',
      'Modelo de IA indisponível ou não encontrado na configuração atual do servidor.',
      'Conteúdo bloqueado pelos filtros de segurança da IA. Ajuste o texto e tente novamente.',
      'Os dados ou arquivo enviados excedem o limite permitido para esta solicitação.',
      'Tempo limite excedido ao aguardar resposta do servidor de IA. Tente novamente em instantes.',
    ];
    for (const m of msgs) {
      assert.equal(sanitizeClientAiError(m), m);
    }
  });

  it('compacts legal sources, cases, and clients cleanly without leaking unnecessary sensitive fields', () => {
    const compactedSrc = compactSourceForAi({
      id: 'src_1',
      titulo: 'Ley 21.325'.repeat(30),
      resumoPortugues: 'A'.repeat(2000),
    });
    assert.equal(compactedSrc.titulo?.length, 180);
    assert.equal(compactedSrc.resumoPortugues?.length, 900);

    const manySources = Array.from({ length: 30 }, (_, i) => ({
      titulo: `Norma ${i}`,
      resumoPortugues: 'Resumo detalhado',
    }));
    assert.equal(compactLegalSourcesForAi(manySources).length, 15);

    const compactedClient = compactClientForAi({
      cpf: '123.456.789-00',
      email: 'privado@cliente.com',
      localizacaoAtual: 'Brasil',
      profissao: 'Engenheiro',
    });
    assert.equal('cpf' in compactedClient, false);
    assert.equal('email' in compactedClient, false);
    assert.equal(compactedClient.localizacaoAtual, 'Brasil');

    const compactedCase = compactCaseForAi({
      id: 'case_1',
      titulo: 'Mercosul',
      observacoes: 'X'.repeat(2000),
    });
    assert.equal(compactedCase.observacoes?.length, 800);
  });

  it('stores, loads, expires and clears short-lived local cache entries', () => {
    const store = new Map<string, string>();
    const prevWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => store.set(k, v),
        removeItem: (k: string) => store.delete(k),
      },
    };
    try {
      saveAiDraftCache('parecer_123', { resumo: 'Rascunho preservado' }, 60_000);
      assert.deepEqual(loadAiDraftCache<{ resumo: string }>('parecer_123'), { resumo: 'Rascunho preservado' });

      saveAiDraftCache('expirado', { resumo: 'Velho' }, -1000);
      assert.equal(loadAiDraftCache('expirado'), null);

      saveAiDraftCache('missing_key_fb', {
        fallback: true,
        origem: 'regras',
        mensagemUsuario: 'Modo de regras locais ativo: a chave da IA não está configurada no servidor.',
      });
      assert.equal(loadAiDraftCache('missing_key_fb'), null);

      clearAiDraftCache('parecer_123');
      assert.equal(loadAiDraftCache('parecer_123'), null);
    } finally {
      if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = prevWindow;
    }
  });

  it('estimates decoded base64 byte sizes accurately and rejects oversized PDFs safely for Vercel ceiling', async () => {
    const sample = Buffer.from('D&M Integra Chile', 'utf8').toString('base64');
    assert.equal(estimateBase64DecodedBytes(sample), 17);
    assert.equal(estimateBase64DecodedBytes(`data:application/pdf;base64,${sample}`), 17);

    const oversizedPdf = new Blob([new Uint8Array(AI_ATTACHMENT_MAX_BINARY_BYTES + 1024)], {
      type: 'application/pdf',
    });
    await assert.rejects(() => prepareAiAttachment(oversizedPdf), (err: unknown) => {
      const msg = sanitizeClientAiError(err);
      return msg.includes('O anexo excede o limite de');
    });
  });
});

