import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasAuthPermissionDelta,
  isActiveStaffProfile,
  isStaffRole,
  resolveUserProfileFromFirestoreData,
} from './authSyncState';

test('resolveUserProfileFromFirestoreData auto-provisions admin and cliente profiles on first login', () => {
  const adminRes = resolveUserProfileFromFirestoreData({
    uid: 'uid_admin',
    email: 'Admin@Example.com ',
    displayName: 'Deivison',
    photoURL: 'https://example.com/p.jpg',
    isAdminEmail: true,
    existingData: null,
    nowIso: '2026-11-27T11:00:00.000Z',
  });
  assert.equal(adminRes.needsCreate, true);
  assert.equal(adminRes.profile.role, 'admin');
  assert.equal(adminRes.profile.status, 'ativo');
  assert.equal(adminRes.profile.email, 'admin@example.com');

  const clientRes = resolveUserProfileFromFirestoreData({
    uid: 'uid_client',
    email: 'cliente@example.com',
    isAdminEmail: false,
    existingData: null,
    nowIso: '2026-11-27T11:00:00.000Z',
  });
  assert.equal(clientRes.needsCreate, true);
  assert.equal(clientRes.profile.role, 'cliente');
  assert.equal(clientRes.profile.status, 'pendente');
});

test('resolveUserProfileFromFirestoreData automatically repairs downgraded admin records on login', () => {
  const repaired = resolveUserProfileFromFirestoreData({
    uid: 'uid_admin',
    email: 'deivisonjoaquim@gmail.com',
    displayName: 'Deivison',
    isAdminEmail: true,
    existingData: {
      email: 'deivisonjoaquim@gmail.com',
      role: 'cliente',
      status: 'pendente',
    },
    nowIso: '2026-11-27T11:00:00.000Z',
  });
  assert.equal(repaired.needsCreate, false);
  assert.equal(repaired.needsAdminRepair, true);
  assert.equal(repaired.profile.role, 'admin');
  assert.equal(repaired.profile.status, 'ativo');
  assert.equal(repaired.profile.uid, 'uid_admin');
});

test('hasAuthPermissionDelta detects role, status, and clientId changes for realtime auto-sync', () => {
  const current = { role: 'cliente' as const, status: 'pendente' as const, clientId: undefined };
  assert.equal(hasAuthPermissionDelta(current, { role: 'cliente', status: 'pendente' }), false);
  assert.equal(hasAuthPermissionDelta(current, { status: 'ativo', clientId: 'cli_123' }), true);
  assert.equal(hasAuthPermissionDelta(current, { role: 'consultor', status: 'ativo' }), true);
  assert.equal(isStaffRole('consultor'), true);
  assert.equal(isStaffRole('cliente'), false);
  assert.equal(isActiveStaffProfile({ role: 'admin', status: 'ativo' }), true);
  assert.equal(isActiveStaffProfile({ role: 'admin', status: 'inativo' }), false);
});
