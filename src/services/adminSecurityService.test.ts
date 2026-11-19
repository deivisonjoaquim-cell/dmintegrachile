import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEnsuredPrimaryAdminProfile,
  evaluateValidatedAdminRecord,
  isPrimaryAdminEmail,
  PRIMARY_ADMIN_EMAIL,
} from './adminSecurityService';

test('adminSecurityService — Primary Admin & Validated Admin Verification', async (t) => {
  await t.test('recognizes primary admin email case-insensitively with whitespace trimmed', () => {
    assert.equal(isPrimaryAdminEmail('deivisonjoaquim@gmail.com'), true);
    assert.equal(isPrimaryAdminEmail('  DeivisonJoaquim@GMAIL.com '), true);
    assert.equal(isPrimaryAdminEmail('outro@gmail.com'), false);
    assert.equal(isPrimaryAdminEmail(null), false);
    assert.equal(isPrimaryAdminEmail(undefined), false);
  });

  await t.test('builds and repairs primary admin profile when user doc is missing or downgraded', () => {
    const fbUser = {
      uid: 'uid_admin_001',
      email: 'DeivisonJoaquim@gmail.com',
      displayName: 'Deivison Joaquim',
      photoURL: 'https://example.com/avatar.png',
    };

    const created = buildEnsuredPrimaryAdminProfile(fbUser, null, '2026-11-19T00:00:00.000Z');
    assert.equal(created.needsWrite, true);
    assert.equal(created.profile.role, 'admin');
    assert.equal(created.profile.status, 'ativo');
    assert.equal(created.profile.email, PRIMARY_ADMIN_EMAIL);
    assert.equal(created.profile.uid, 'uid_admin_001');

    const repaired = buildEnsuredPrimaryAdminProfile(
      fbUser,
      {
        uid: 'uid_admin_001',
        nome: 'Deivison',
        email: PRIMARY_ADMIN_EMAIL,
        role: 'cliente',
        status: 'pendente',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      '2026-11-19T01:00:00.000Z',
    );
    assert.equal(repaired.needsWrite, true);
    assert.equal(repaired.profile.role, 'admin');
    assert.equal(repaired.profile.status, 'ativo');
    assert.equal(repaired.profile.createdAt, '2026-01-01T00:00:00.000Z');

    const alreadyValid = buildEnsuredPrimaryAdminProfile(
      fbUser,
      repaired.profile,
      '2026-11-19T02:00:00.000Z',
    );
    assert.equal(alreadyValid.needsWrite, false);
    assert.equal(alreadyValid.profile.role, 'admin');
    assert.equal(alreadyValid.profile.status, 'ativo');
  });

  await t.test('rejects unverified emails and non-admin or inactive user records', () => {
    const unverified = evaluateValidatedAdminRecord({
      uid: 'uid_admin_001',
      email: PRIMARY_ADMIN_EMAIL,
      emailVerified: false,
      userDoc: { uid: 'uid_admin_001', nome: 'Deivison', email: PRIMARY_ADMIN_EMAIL, role: 'admin', status: 'ativo' },
    });
    assert.equal(unverified.authorized, false);

    const consultor = evaluateValidatedAdminRecord({
      uid: 'uid_cons_001',
      email: 'consultor@dmintegrachile.com',
      emailVerified: true,
      userDoc: { uid: 'uid_cons_001', nome: 'Consultor', email: 'consultor@dmintegrachile.com', role: 'consultor', status: 'ativo' },
    });
    assert.equal(consultor.authorized, false);

    const inactiveAdmin = evaluateValidatedAdminRecord({
      uid: 'uid_adm_inactive',
      email: 'adm2@dmintegrachile.com',
      emailVerified: true,
      userDoc: { uid: 'uid_adm_inactive', nome: 'Adm Inativo', email: 'adm2@dmintegrachile.com', role: 'admin', status: 'inativo' },
    });
    assert.equal(inactiveAdmin.authorized, false);

    const validAdmin = evaluateValidatedAdminRecord({
      uid: 'uid_admin_001',
      email: PRIMARY_ADMIN_EMAIL,
      emailVerified: true,
      userDoc: { uid: 'uid_admin_001', nome: 'Deivison', email: PRIMARY_ADMIN_EMAIL, role: 'admin', status: 'ativo' },
    });
    assert.equal(validAdmin.authorized, true);
    assert.equal(validAdmin.isPrimaryAdmin, true);
    assert.equal(validAdmin.role, 'admin');
    assert.equal(validAdmin.status, 'ativo');
  });
});
