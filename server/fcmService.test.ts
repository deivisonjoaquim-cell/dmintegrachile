import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildProcessNotificationMessage,
  isIamPermissionError,
  isUnregisteredFcmErrorCode,
} from './fcmService';

test('buildProcessNotificationMessage formats title, body and portal link cleanly', () => {
  const result = buildProcessNotificationMessage({
    clientId: 'cli_123',
    caseId: 'case_456',
    notificationId: 'notif_789',
    tipo: 'status_sermig',
    titulo: '  Status SERMIG atualizado: Aprovado  ',
    mensagem: '  Seu pedido de residência foi aprovado pelo SERMIG.  ',
    etapaPipeline: 11,
    statusSermig: 'Aprovado',
  });

  assert.equal(result.title, 'Status SERMIG atualizado: Aprovado');
  assert.equal(result.body, 'Seu pedido de residência foi aprovado pelo SERMIG.');
  assert.equal(result.data.clientId, 'cli_123');
  assert.equal(result.data.caseId, 'case_456');
  assert.equal(result.data.notificationId, 'notif_789');
  assert.equal(result.data.url, '/portal');
  assert.equal(result.data.etapaPipeline, '11');
  assert.equal(result.data.statusSermig, 'Aprovado');
});

test('isUnregisteredFcmErrorCode identifies stale browser tokens', () => {
  assert.equal(isUnregisteredFcmErrorCode('messaging/registration-token-not-registered'), true);
  assert.equal(isUnregisteredFcmErrorCode('messaging/invalid-registration-token'), true);
  assert.equal(isUnregisteredFcmErrorCode('messaging/internal-error'), false);
  assert.equal(isUnregisteredFcmErrorCode(undefined), false);
});

test('isIamPermissionError detects PERMISSION_DENIED and missing ADC cleanly', () => {
  assert.equal(isIamPermissionError({ code: 7, message: '7 PERMISSION_DENIED' }), true);
  assert.equal(
    isIamPermissionError(new Error('Could not load the default credentials')),
    true,
  );
  assert.equal(isIamPermissionError(new Error('Network timeout')), false);
});
