import test from 'node:test';
import assert from 'node:assert/strict';
import type { DiagnosticAnswers } from '../types/domain';
import type { DiagnosticResult } from './diagnosticEngine';
import {
  clearDiagnosticCacheStorage,
  clearDiagnosticDraftStorage,
  computeDraftCompletionPct,
  DIAGNOSTIC_CACHE_STORAGE_KEY,
  formatCacheTimestampPT,
  hasMeaningfulDraftContent,
  LEGACY_DIAGNOSTIC_DRAFT_KEY,
  readDiagnosticCache,
  writeDiagnosticDraft,
  writeDiagnosticResult,
  type StorageLike,
} from './diagnosticCache';

function createMemoryStorage(): StorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

const BASE_ANSWERS: DiagnosticAnswers = {
  nome: 'Mariana Costa',
  whatsapp: '+55 (11) 98765-4321',
  email: 'mariana.costa@example.com',
  cidadeUf: 'São Paulo/SP',
  origem: 'Site',
  localizacao: 'No Brasil',
  faixaEtaria: 'maior_18',
  nacionalidadeBrasileira: true,
  possuiSegundaNacionalidade: false,
  passaporteStatus: 'valido',
  passaporteValidadeMeses: 36,
  vinculoFamiliarChile: false,
  vinculoFormalizado: false,
  objetivo: 'trabalho_formal',
  possuiOfertaTrabalhoFormal: true,
  possuiMatriculaReconhecida: false,
  possuiRendaPassiva: false,
  possuiCapitalComprovadoOrigem: false,
  titularTemResidenciaChile: false,
  overstay: false,
  ordenAbandono: false,
  rejeicaoAnterior: false,
  antecedentesCriminais: false,
  familiaAcompanhante: false,
  quantidadeDependentes: 0,
  prazoPretendido: '3 a 6 meses',
  documentosJaPossui: ['passaporte'],
  lgpdAceito: true,
  lgpdVersao: '1.0',
};

const MOCK_RESULT = {
  viabilidade: {
    total: 84,
    veredito: 'Alta viabilidade técnica',
    dimensoes: [],
  },
  recomendada: {
    visa: {
      codigo: 'MERCOSUL',
      nomePortugues: 'Acordo de Residência Mercosul',
    },
    nota: 88,
    motivo: 'Nacionalidade brasileira elegível',
  },
  top3: [],
  alertas: [],
  flagsRisco: [],
  flagsRevisaoConsultor: [],
  contradicoes: [],
  regrasAcionadas: ['mercosul_nacionalidade'],
  fontesLegais: [],
  confianca: 'Alta',
  versaoRegras: { versao: '2026.1' },
  checklistProntidao: { percentualInicial: 65, semaforo: 'amarelo', itens: [] },
} as unknown as DiagnosticResult;

test('writeDiagnosticDraft persists draft and readDiagnosticCache restores step and answers', () => {
  const storage = createMemoryStorage();
  const now = Date.UTC(2026, 10, 26, 12, 0, 0);

  const saved = writeDiagnosticDraft(
    {
      answers: BASE_ANSWERS,
      step: 3,
      maxStepReached: 4,
      sessionToken: 'token-12345678901234567890',
    },
    storage,
    now,
  );

  assert.ok(saved.draft);
  assert.equal(saved.draft.step, 3);
  assert.equal(saved.draft.maxStepReached, 4);
  assert.equal(saved.draft.answers.nome, 'Mariana Costa');
  assert.ok(saved.draft.completionPct >= 75);

  const reloaded = readDiagnosticCache(storage, now + 60_000);
  assert.ok(reloaded.draft);
  assert.equal(reloaded.draft.step, 3);
  assert.equal(reloaded.draft.maxStepReached, 4);
  assert.equal(reloaded.draft.answers.email, 'mariana.costa@example.com');
  assert.equal(reloaded.lastResult, null);
});

test('writeDiagnosticResult caches completed result and clears active draft by default', () => {
  const storage = createMemoryStorage();
  const now = Date.UTC(2026, 10, 26, 12, 0, 0);

  writeDiagnosticDraft({ answers: BASE_ANSWERS, step: 6 }, storage, now);
  const afterResult = writeDiagnosticResult(
    {
      answers: BASE_ANSWERS,
      result: MOCK_RESULT,
      savedLeadId: 'lead-001',
      resumeUrl: 'https://dmintegrachile.cl/diagnostico?retomar=abc',
    },
    storage,
    now + 10_000,
  );

  assert.equal(afterResult.draft, null);
  assert.ok(afterResult.lastResult);
  assert.equal(afterResult.lastResult.result.viabilidade.total, 84);
  assert.equal(afterResult.lastResult.savedLeadId, 'lead-001');

  const reloaded = readDiagnosticCache(storage, now + 20_000);
  assert.equal(reloaded.draft, null);
  assert.equal(reloaded.lastResult?.result.viabilidade.total, 84);
});

test('readDiagnosticCache migrates legacy v2 draft seamlessly', () => {
  const storage = createMemoryStorage();
  const now = Date.UTC(2026, 10, 26, 12, 0, 0);

  storage.setItem(
    LEGACY_DIAGNOSTIC_DRAFT_KEY,
    JSON.stringify({
      answers: BASE_ANSWERS,
      step: 4,
      sessionToken: 'legacy-token-1234567890123',
    }),
  );

  const migrated = readDiagnosticCache(storage, now);
  assert.ok(migrated.draft);
  assert.equal(migrated.draft.step, 4);
  assert.equal(migrated.draft.answers.nome, 'Mariana Costa');
  assert.equal(storage.getItem(LEGACY_DIAGNOSTIC_DRAFT_KEY), null);
  assert.ok(storage.getItem(DIAGNOSTIC_CACHE_STORAGE_KEY));
});

test('readDiagnosticCache prunes expired draft and expired result after TTL', () => {
  const storage = createMemoryStorage();
  const now = Date.UTC(2026, 10, 1, 12, 0, 0);

  writeDiagnosticDraft({ answers: BASE_ANSWERS, step: 2 }, storage, now, 7);
  writeDiagnosticResult({ answers: BASE_ANSWERS, result: MOCK_RESULT, clearDraft: false }, storage, now, 7);

  const expiredMs = now + 8 * 86_400_000;
  const loaded = readDiagnosticCache(storage, expiredMs, 7);
  assert.equal(loaded.draft, null);
  assert.equal(loaded.lastResult, null);
  assert.equal(storage.getItem(DIAGNOSTIC_CACHE_STORAGE_KEY), null);
});

test('clearDiagnosticDraftStorage preserves lastResult while clearDiagnosticCacheStorage wipes both', () => {
  const storage = createMemoryStorage();
  const now = Date.UTC(2026, 10, 26, 12, 0, 0);

  writeDiagnosticResult({ answers: BASE_ANSWERS, result: MOCK_RESULT, clearDraft: false }, storage, now);
  writeDiagnosticDraft({ answers: BASE_ANSWERS, step: 2 }, storage, now + 1000);

  const afterDraftClear = clearDiagnosticDraftStorage(storage, now + 2000);
  assert.equal(afterDraftClear.draft, null);
  assert.ok(afterDraftClear.lastResult);

  const afterFullClear = clearDiagnosticCacheStorage(storage);
  assert.equal(afterFullClear.draft, null);
  assert.equal(afterFullClear.lastResult, null);
  assert.equal(storage.getItem(DIAGNOSTIC_CACHE_STORAGE_KEY), null);
});

test('hasMeaningfulDraftContent and computeDraftCompletionPct handle empty and filled inputs', () => {
  assert.equal(hasMeaningfulDraftContent({ nome: '', email: '', whatsapp: '' }, 1), false);
  assert.equal(hasMeaningfulDraftContent({ nome: 'Ana' }, 1), true);
  assert.equal(hasMeaningfulDraftContent({}, 2), true);
  assert.equal(computeDraftCompletionPct({}, 1), 0);
  assert.ok(computeDraftCompletionPct(BASE_ANSWERS, 6) >= 90);
  assert.match(formatCacheTimestampPT('2026-11-26T14:30:00.000Z'), /^\d{2}\/\d{2} às \d{2}:\d{2}$/);
});
