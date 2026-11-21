import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotificationTargetUrl,
  DEFAULT_PUSH_PREFERENCES,
  getNotificationCategoryForType,
  getNotificationTypeLabel,
  getPortalTabForNotification,
  normalizePushPreferences,
  resolveVapidConfig,
  shouldDeliverNotificationForPreferences,
  validateVapidPublicKey,
} from './pushNotifications';

const SAMPLE_VALID_VAPID =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

describe('pushNotifications — VAPID key validation & resolution', () => {
  it('accepts a valid Base64URL Web Push VAPID public key', () => {
    const res = validateVapidPublicKey(`  ${SAMPLE_VALID_VAPID}  `);
    assert.equal(res.valid, true);
    assert.equal(res.normalized, SAMPLE_VALID_VAPID);
    assert.equal(res.error, undefined);
  });

  it('rejects empty, malformed, whitespace, or private-key PEM strings', () => {
    assert.equal(validateVapidPublicKey('').valid, false);
    assert.equal(validateVapidPublicKey('short-key').valid, false);
    assert.equal(validateVapidPublicKey(`${SAMPLE_VALID_VAPID} extra`).valid, false);
    assert.equal(
      validateVapidPublicKey('-----BEGIN PRIVATE KEY-----abc').valid,
      false,
    );
    assert.equal(
      validateVapidPublicKey(`${SAMPLE_VALID_VAPID}===`).valid,
      false,
    );
  });

  it('prioritizes Vercel env var over Admin panel setting and falls back cleanly', () => {
    const fromEnv = resolveVapidConfig(SAMPLE_VALID_VAPID, 'admin-fallback-key');
    assert.equal(fromEnv.source, 'env');
    assert.equal(fromEnv.valid, true);
    assert.equal(fromEnv.key, SAMPLE_VALID_VAPID);

    const fromAdmin = resolveVapidConfig('', SAMPLE_VALID_VAPID);
    assert.equal(fromAdmin.source, 'admin');
    assert.equal(fromAdmin.valid, true);

    const none = resolveVapidConfig('', '');
    assert.equal(none.source, 'none');
    assert.equal(none.valid, false);
    assert.equal(none.key, '');
  });
});

describe('pushNotifications — category filtering & deep-link routing', () => {
  it('defaults all categories to enabled when preferences are missing', () => {
    assert.deepEqual(normalizePushPreferences(undefined), DEFAULT_PUSH_PREFERENCES);
    assert.equal(shouldDeliverNotificationForPreferences('etapa_pipeline', null), true);
    assert.equal(shouldDeliverNotificationForPreferences('documento', null), true);
    assert.equal(shouldDeliverNotificationForPreferences('mensagem_equipe', null), true);
  });

  it('respects individual category opt-outs across all event types', () => {
    const onlyStatus = { statusProcesso: true, documentos: false, mensagensEquipe: false };
    assert.equal(shouldDeliverNotificationForPreferences('etapa_pipeline', onlyStatus), true);
    assert.equal(shouldDeliverNotificationForPreferences('status_sermig', onlyStatus), true);
    assert.equal(shouldDeliverNotificationForPreferences('prazo', onlyStatus), true);
    assert.equal(shouldDeliverNotificationForPreferences('documento', onlyStatus), false);
    assert.equal(shouldDeliverNotificationForPreferences('mensagem_equipe', onlyStatus), false);

    assert.equal(getNotificationCategoryForType('documento'), 'documentos');
    assert.equal(getNotificationCategoryForType('mensagem_equipe'), 'mensagensEquipe');
    assert.equal(getNotificationCategoryForType('status_sermig'), 'statusProcesso');
  });

  it('maps notification types and links to the right Client Portal tab', () => {
    assert.equal(getPortalTabForNotification('etapa_pipeline'), 'processo');
    assert.equal(getPortalTabForNotification('documento'), 'documentos');
    assert.equal(getPortalTabForNotification('mensagem_equipe'), 'suporte');
    assert.equal(getPortalTabForNotification('geral', '/portal?tab=documentos'), 'documentos');

    assert.equal(buildNotificationTargetUrl('documento'), '/portal?tab=documentos');
    assert.equal(buildNotificationTargetUrl('mensagem_equipe'), '/portal?tab=suporte');
    assert.equal(buildNotificationTargetUrl('status_sermig'), '/portal?tab=processo');
    assert.equal(getNotificationTypeLabel('mensagem_equipe'), 'Mensagem da Equipe');
  });
});
