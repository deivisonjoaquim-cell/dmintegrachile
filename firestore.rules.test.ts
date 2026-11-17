/**
 * Structural security specification tests for Firestore Rules (Dirty Dozen).
 * Verifies rule invariants against DRAFT_firestore.rules / firestore.rules.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const draftPath = path.resolve(process.cwd(), 'DRAFT_firestore.rules');
const rulesText = fs.existsSync(rulesPath)
  ? fs.readFileSync(rulesPath, 'utf8')
  : fs.readFileSync(draftPath, 'utf8');

test('rules enforce global default deny and rules_version 2', () => {
  assert.match(rulesText, /rules_version = '2';/);
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
});

test('rules verify email_verified == true and block self-privilege escalation', () => {
  assert.match(rulesText, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesText, /incoming\(\)\.role == 'cliente' && incoming\(\)\.status == 'pendente'/);
  assert.match(rulesText, /incoming\(\)\.role == existing\(\)\.role/);
});

test('rules isolate financial collections from assistente role', () => {
  const budgetsBlock = rulesText.slice(rulesText.indexOf('match /budgets/{budgetId}'), rulesText.indexOf('match /financialRecords/{recordId}'));
  assert.doesNotMatch(budgetsBlock, /isStaff\(\)/);
  assert.match(budgetsBlock, /isAdminOrConsultor\(\)/);

  const finBlock = rulesText.slice(rulesText.indexOf('match /financialRecords/{recordId}'), rulesText.indexOf('match /messageTemplates/{templateId}'));
  assert.doesNotMatch(finBlock, /isStaff\(\)/);
  assert.match(finBlock, /isAdminOrConsultor\(\)/);

  const caseFinBlock = rulesText.slice(rulesText.indexOf('match /caseFinancials/{caseId}'), rulesText.indexOf('match /caseDocuments/{docId}'));
  assert.doesNotMatch(caseFinBlock, /isStaff\(\)/);
  assert.match(caseFinBlock, /isAdminOrConsultor\(\)/);
});

test('rules isolate bancario config strictly to admin', () => {
  const cfgBlock = rulesText.slice(rulesText.indexOf('match /config/{docId}'), rulesText.indexOf('match /siteContent/{sectionId}'));
  assert.match(cfgBlock, /docId == 'bancario' && isAdmin\(\)/);
});

test('rules enforce immutable auditLogs (no update or delete)', () => {
  const auditBlock = rulesText.slice(rulesText.indexOf('match /auditLogs/{logId}'), rulesText.indexOf('match /partnerProposals/{proposalId}'));
  assert.match(auditBlock, /allow update, delete: if false;/);
});

test('rules enforce partner commission isolation via partnersPublic', () => {
  const partnersBlock = rulesText.slice(rulesText.indexOf('match /partners/{partnerId}'), rulesText.indexOf('match /partnersPublic/{partnerId}'));
  assert.doesNotMatch(partnersBlock, /if true/);
  assert.match(partnersBlock, /isAdminOrConsultor\(\)/);
});

test('rules isolate diagnosticSessions list to staff and enforce token length + expiration on get', () => {
  const dsBlock = rulesText.slice(rulesText.indexOf('match /diagnosticSessions/{token}'), rulesText.indexOf('match /diagnosticRuleVersions/{versionId}'));
  assert.match(dsBlock, /allow list:\s*if isStaff\(\);/);
  assert.match(dsBlock, /token\.size\(\) >= 20/);
  assert.match(dsBlock, /expiraEmMs > request\.time\.toMillis\(\)/);
});

test('rules restrict diagnosticRuleVersions writes strictly to admin', () => {
  const rvBlock = rulesText.slice(rulesText.indexOf('match /diagnosticRuleVersions/{versionId}'), rulesText.indexOf('match /clients/{clientId}'));
  assert.match(rvBlock, /allow create, update:\s*if isAdmin\(\)/);
  assert.match(rvBlock, /existing\(\)\.ativa == true \|\| isStaff\(\)/);
});

test('rules guard public lead updates with matching sessionToken and immutable statusFunil', () => {
  const leadsBlock = rulesText.slice(rulesText.indexOf('match /leads/{leadId}'), rulesText.indexOf('match /diagnosticSessions/{token}'));
  assert.match(leadsBlock, /incoming\(\)\.sessionToken == existing\(\)\.sessionToken/);
  assert.match(leadsBlock, /existing\(\)\.statusFunil == 'Novo' && incoming\(\)\.statusFunil == 'Novo'/);
  assert.match(leadsBlock, /!\('notas' in incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\)/);
});
