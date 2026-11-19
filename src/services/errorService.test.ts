import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  clearAppErrors,
  dismissAppError,
  getActiveAppErrors,
  getRecentErrorLogs,
  reportAppError,
  subscribeToAppErrors,
  translateAppError,
} from './errorService';

describe('errorService — Centralized Error Translation, Logging & Toast Store', () => {
  beforeEach(() => {
    clearAppErrors();
  });

  it('translates Firestore undefined field errors into friendly validation guidance', () => {
    const res = translateAppError(
      new Error('Function setDoc() called with invalid data. Unsupported field value: undefined (found in field siteDraft)'),
      { path: 'config/empresa', operation: 'write' },
    );
    assert.equal(res.category, 'firebase-validation');
    assert.equal(res.level, 'warning');
    assert.match(res.title, /incompletos/i);
    assert.equal(res.path, 'config/empresa');
  });

  it('unwraps structured JSON FirestoreErrorInfo strings into friendly PT-BR messages', () => {
    const wrappedJson = JSON.stringify({
      error: 'Missing or insufficient permissions.',
      operationType: 'list',
      path: 'leads',
      authInfo: { userId: 'u1' },
    });
    const res = translateAppError(new Error(wrappedJson));
    assert.equal(res.category, 'firebase-permission');
    assert.equal(res.path, 'leads');
    assert.equal(res.operation, 'list');
    assert.equal(res.message.startsWith('{'), false);
  });

  it('translates offline, quota, auth, not-found, and pdf errors accurately', () => {
    assert.equal(
      translateAppError(new Error('Failed to get document because the client is offline.')).category,
      'firebase-offline',
    );
    assert.equal(
      translateAppError(new Error('Quota exceeded for firestore')).category,
      'firebase-quota',
    );
    assert.equal(
      translateAppError({ code: 'auth/popup-blocked', message: 'Popup blocked' }).category,
      'firebase-auth',
    );
    assert.equal(
      translateAppError(new Error('No document to update: tasks/123')).category,
      'firebase-not-found',
    );
    assert.equal(
      translateAppError(new Error('Falha html2canvas ao renderizar página 2'), { source: 'pdf' }).category,
      'pdf',
    );
  });

  it('deduplicates rapid identical toasts, notifies subscribers, and allows dismissal', () => {
    const snapshots: number[] = [];
    const unsubscribe = subscribeToAppErrors((entries) => {
      snapshots.push(entries.length);
    });

    const first = reportAppError(new Error('Missing or insufficient permissions.'), {
      source: 'test',
      nowMs: 10000,
    });
    // Duplicate within 4s dedupe window should not add a second toast
    reportAppError(new Error('Missing or insufficient permissions.'), {
      source: 'test',
      nowMs: 11500,
    });
    assert.equal(getActiveAppErrors().length, 1);

    // Same error after dedupe window adds a new toast
    reportAppError(new Error('Missing or insufficient permissions.'), {
      source: 'test',
      nowMs: 15000,
    });
    assert.equal(getActiveAppErrors().length, 2);

    // Dismiss removes target toast cleanly
    dismissAppError(first.id);
    assert.equal(getActiveAppErrors().length, 1);

    // Log history keeps all reported entries including silent ones
    reportAppError(new Error('Client is offline'), { silent: true, nowMs: 16000 });
    assert.equal(getActiveAppErrors().length, 1);
    assert.ok(getRecentErrorLogs().length >= 4);

    unsubscribe();
    assert.ok(snapshots.length >= 3);
  });
});
