import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUDGET_ALLOWED_CLIENT_KEYS,
  CASE_ALLOWED_CLIENT_NPS_KEYS,
  CLIENT_ALLOWED_SELF_UPDATE_KEYS,
  FINANCIAL_RECORD_ALLOWED_CLIENT_KEYS,
  GENERATED_DOC_ALLOWED_CLIENT_KEYS,
  NOTIFICATION_ALLOWED_CLIENT_KEYS,
  buildBudgetDecisionPatch,
  buildCaseNpsPatch,
  buildClientLgpdAcceptancePatch,
  buildClientNotificationReadPatch,
  buildClientPersonalDataPatch,
  buildFinancialReceiptPatch,
  buildGeneratedDocCanvasSignaturePatch,
  buildGeneratedDocPdfSignaturePatch,
  buildGeneratedDocReadConfirmPatch,
  needsUserClientLinkSync,
} from './clientPortalPatches';
import { translateAppError } from '../services/errorService';

function assertOnlyAllowedKeys(patch: Record<string, unknown>, allowed: readonly string[]) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(patch)) {
    assert.ok(
      allowedSet.has(key),
      `Campo "${key}" não é permitido pela regra affectedKeys().hasOnly([${allowed.join(', ')}])`,
    );
  }
}

test('client personal data and LGPD patches only contain allowed keys (no id/email/role)', () => {
  const personal = buildClientPersonalDataPatch({
    nomeCompleto: '  Maria Silva  ',
    whatsapp: '+55 11 99999-0000',
    enderecoCompleto: 'Rua das Flores, 123',
    profissao: 'Engenheira',
  });
  assertOnlyAllowedKeys(personal, CLIENT_ALLOWED_SELF_UPDATE_KEYS);
  assert.equal(personal.nomeCompleto, 'Maria Silva');
  assert.equal('id' in personal, false);
  assert.equal('email' in personal, false);

  const lgpd = buildClientLgpdAcceptancePatch('2.0');
  assertOnlyAllowedKeys(lgpd, CLIENT_ALLOWED_CLIENT_KEYS_OR_SELF());
  assert.equal(lgpd.lgpdAceito, true);
  assert.equal(lgpd.lgpdVersao, '2.0');
});

function CLIENT_ALLOWED_CLIENT_KEYS_OR_SELF() {
  return CLIENT_ALLOWED_SELF_UPDATE_KEYS;
}

test('generatedDocuments client patches (read confirm, canvas signature, PDF upload) match firestore.rules allowlist', () => {
  const readPatch = buildGeneratedDocReadConfirmPatch('Maria Silva');
  assertOnlyAllowedKeys(readPatch, GENERATED_DOC_ALLOWED_CLIENT_KEYS);

  const canvasPatch = buildGeneratedDocCanvasSignaturePatch('data:image/png;base64,iVBORw0KGgo=');
  assertOnlyAllowedKeys(canvasPatch, GENERATED_DOC_ALLOWED_CLIENT_KEYS);
  assert.equal(canvasPatch.status, 'Assinado');

  const pdfPatch = buildGeneratedDocPdfSignaturePatch('/uploads/contrato-assinado.pdf');
  assertOnlyAllowedKeys(pdfPatch, GENERATED_DOC_ALLOWED_CLIENT_KEYS);
  assert.equal(pdfPatch.status, 'Assinado');

  assert.throws(() => buildGeneratedDocCanvasSignaturePatch('invalid-url'));
});

test('budgets, financialRecords, notifications, and cases NPS patches match firestore.rules allowlists', () => {
  assertOnlyAllowedKeys(buildBudgetDecisionPatch('Aprovado'), BUDGET_ALLOWED_CLIENT_KEYS);
  assertOnlyAllowedKeys(buildFinancialReceiptPatch('/uploads/pix.png'), FINANCIAL_RECORD_ALLOWED_CLIENT_KEYS);
  assertOnlyAllowedKeys(buildClientNotificationReadPatch(), NOTIFICATION_ALLOWED_CLIENT_KEYS);

  const npsPatch = buildCaseNpsPatch(9, 'Ótimo atendimento!');
  assertOnlyAllowedKeys(npsPatch, CASE_ALLOWED_CLIENT_NPS_KEYS);
  assert.equal(npsPatch.npsNota, 5);
});

test('needsUserClientLinkSync detects missing or stale persisted clientId even when in-memory state differs', () => {
  const evalMissing = needsUserClientLinkSync({
    persistedUserClientId: undefined,
    persistedUserStatus: 'ativo',
    matchedClientId: 'cli_dm_01',
    matchedClientPortalLiberado: true,
    matchedClientArquivado: false,
    matchedClientUserId: undefined,
    authUid: 'uid_dm',
  });
  assert.equal(evalMissing.shouldBeActive, true);
  assert.equal(evalMissing.targetStatus, 'ativo');
  assert.equal(evalMissing.needsUserDocUpdate, true);
  assert.equal(evalMissing.needsClientUserIdUpdate, true);

  const evalSynced = needsUserClientLinkSync({
    persistedUserClientId: 'cli_dm_01',
    persistedUserStatus: 'ativo',
    matchedClientId: 'cli_dm_01',
    matchedClientPortalLiberado: true,
    matchedClientArquivado: false,
    matchedClientUserId: 'uid_dm',
    authUid: 'uid_dm',
  });
  assert.equal(evalSynced.needsUserDocUpdate, false);
  assert.equal(evalSynced.needsClientUserIdUpdate, false);
});

test('translateAppError never asks clients or users to click Sincronizar permissões or log in as deivisonjoaquim@gmail.com', () => {
  const errPayload = JSON.stringify({
    error: 'Missing or insufficient permissions.',
    operationType: 'update',
    path: 'clientNotifications/notif_123',
    authInfo: {
      userId: 'uid_dm',
      email: 'dmintegrachile@gmail.com',
      emailVerified: true,
    },
  });
  const friendly = translateAppError(new Error(errPayload), {
    source: 'portal-notifications',
    path: 'clientNotifications/notif_123',
  });
  assert.equal(friendly.category, 'firebase-permission');
  assert.equal(friendly.actionHint?.includes('Sincronizar permissões'), false);
  assert.equal(friendly.actionHint?.includes('deivisonjoaquim@gmail.com'), false);
  assert.equal(friendly.actionHint?.includes('sincronizadas automaticamente'), true);
});
