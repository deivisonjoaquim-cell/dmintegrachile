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

test('rules isolate bancario config strictly to validated admin and enforce Pillar 4.10 order', () => {
  const cfgBlock = rulesText.slice(rulesText.indexOf('match /config/{docId}'), rulesText.indexOf('match /siteContent/{sectionId}'));
  assert.match(cfgBlock, /docId == 'bancario' && isValidatedAdmin\(\)/);
  assert.match(cfgBlock, /allow create, update:\s*if isSignedIn\(\) && isValidId\(docId\) && \(\s*\(docId == 'empresa' && isValidEmpresaConfig\(incoming\(\)\)\) \|\|\s*\(docId == 'bancario' && isValidBancarioConfig\(incoming\(\)\)\)\s*\) && isValidatedAdmin\(\);/);
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

test('rules restrict diagnosticRuleVersions writes strictly to validated admin', () => {
  const rvBlock = rulesText.slice(rulesText.indexOf('match /diagnosticRuleVersions/{versionId}'), rulesText.indexOf('match /clients/{clientId}'));
  assert.match(rvBlock, /allow create, update:\s*if isSignedIn\(\) && isValidId\(versionId\) && isValidDiagnosticRuleVersion\(incoming\(\)\) && isValidatedAdmin\(\);/);
  assert.match(rvBlock, /existing\(\)\.ativa == true \|\| isStaff\(\)/);
});

test('rules guard public lead updates with matching sessionToken and immutable statusFunil', () => {
  const leadsBlock = rulesText.slice(rulesText.indexOf('match /leads/{leadId}'), rulesText.indexOf('match /diagnosticSessions/{token}'));
  assert.match(leadsBlock, /incoming\(\)\.sessionToken == existing\(\)\.sessionToken/);
  assert.match(leadsBlock, /existing\(\)\.statusFunil == 'Novo' && incoming\(\)\.statusFunil == 'Novo'/);
  assert.match(leadsBlock, /!\('notas' in incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\)/);
});

test('rules restrict generatedDocuments client confirmation/signature updates and block assistente from financial docs', () => {
  const genBlock = rulesText.slice(rulesText.indexOf('match /generatedDocuments/{genDocId}'), rulesText.indexOf('match /fcmTokens/{tokenId}'));
  assert.match(genBlock, /isAssistente\(\) && \(!\('financeiro' in existing\(\)\) \|\| existing\(\)\.financeiro == false\)/);
  assert.match(genBlock, /allow create: if isAdminOrConsultor\(\)/);
  assert.match(genBlock, /affectedKeys\(\)\.hasOnly\(\['confirmadoLeituraEm', 'confirmadoLeituraPor', 'status', 'assinaturaUrl', 'assinaturaDataUrl', 'assinadoEm', 'updatedAt'\]\)/);
  assert.match(genBlock, /existing\(\)\.liberadoAoCliente == true/);
});

test('rules restrict mediaAssets reads to staff and writes strictly to validated admin', () => {
  const mediaBlock = rulesText.slice(rulesText.indexOf('match /mediaAssets/{assetId}'), rulesText.indexOf('match /auditLogs/{logId}'));
  assert.match(mediaBlock, /allow get, list:\s*if isStaff\(\);/);
  assert.match(mediaBlock, /allow create, update:\s*if isSignedIn\(\) && isValidId\(assetId\) && isValidMediaAsset\(incoming\(\)\) && isValidatedAdmin\(\);/);
  assert.match(mediaBlock, /allow delete:\s*if isSignedIn\(\) && isValidId\(assetId\) && isValidatedAdmin\(\);/);
  assert.match(rulesText, /isOptString\(data, 'logoUrl', 500000\)/);
  assert.match(rulesText, /'DM Sans'/);
});

test('rules recognize primary admin deivisonjoaquim@gmail.com case-insensitively and block downgrade or deletion', () => {
  assert.match(rulesText, /function isPrimaryAdminEmail\(email\) \{\s*return email is string && email\.lower\(\) == 'deivisonjoaquim@gmail\.com';/);
  assert.match(rulesText, /function isValidatedAdmin\(\) \{\s*return isBootstrappedAdmin\(\)\s*\|\| \(isActiveUser\(\) && 'role' in userDoc\(\) && userDoc\(\)\.role == 'admin'\);/);
  assert.match(rulesText, /!\('email' in existing\(\)\) \|\| !isPrimaryAdminEmail\(existing\(\)\.email\) \|\| \(incoming\(\)\.role == 'admin' && incoming\(\)\.status == 'ativo' && incoming\(\)\.uid == existing\(\)\.uid\)/);
  assert.match(rulesText, /allow delete:\s*if isSignedIn\(\) && isValidId\(uid\) && isValidatedAdmin\(\) && \(!\('email' in existing\(\)\) \|\| !isPrimaryAdminEmail\(existing\(\)\.email\)\);/);
  assert.match(rulesText, /function isOptBool\(data, field\) \{\s*return !\(field in data\) \|\| data\[field\] == null \|\| data\[field\] is bool;/);
  assert.match(rulesText, /function isOptNum\(data, field\) \{\s*return !\(field in data\) \|\| data\[field\] == null \|\| data\[field\] is number;/);
});

test('rules enforce strict owner isolation on fcmTokens and client read-only content on clientNotifications', () => {
  const fcmBlock = rulesText.slice(rulesText.indexOf('match /fcmTokens/{tokenId}'), rulesText.indexOf('match /clientNotifications/{notifId}'));
  assert.match(fcmBlock, /incoming\(\)\.uid == request\.auth\.uid/);
  assert.match(fcmBlock, /existing\(\)\.uid == request\.auth\.uid \|\| isStaff\(\)/);
  assert.match(fcmBlock, /incoming\(\)\.clientId == existing\(\)\.clientId/);

  const notifBlock = rulesText.slice(rulesText.indexOf('match /clientNotifications/{notifId}'));
  assert.match(notifBlock, /allow create: if isStaff\(\)/);
  assert.match(notifBlock, /affectedKeys\(\)\.hasOnly\(\['lida', 'lidaEm', 'updatedAt'\]\)/);
  assert.match(notifBlock, /existing\(\)\.clientId == userClientId\(\)/);
});

test('rules isolate non-chat communicationLogs to staff and enforce sender identity on Chat Portal', () => {
  const commBlock = rulesText.slice(
    rulesText.indexOf('match /communicationLogs/{logId}'),
    rulesText.indexOf('match /viabilityAssessments/{assessmentId}'),
  );
  assert.match(commBlock, /existing\(\)\.clientId == userClientId\(\) && existing\(\)\.canal == 'Chat Portal'/);
  assert.match(commBlock, /incoming\(\)\.origem == 'cliente'/);
  assert.match(commBlock, /incoming\(\)\.remetenteUid == request\.auth\.uid/);
  assert.match(commBlock, /affectedKeys\(\)\.hasOnly\(\['lidaPeloCliente', 'updatedAt'\]\)/);
  assert.match(commBlock, /affectedKeys\(\)\.hasOnly\(\['lidaPelaEquipe', 'updatedAt'\]\)/);
});

test('rules allow verified Google client self-linking only when matching admin-approved client record', () => {
  assert.match(rulesText, /function isVerifiedClientEmailMatch\(clientData\)/);
  assert.match(rulesText, /function canClientSelfLink\(clientId, targetStatus\)/);
  assert.match(rulesText, /get\(clientPath\)\.data\.portalLiberado == true && targetStatus == 'ativo'/);
  const usersBlock = rulesText.slice(rulesText.indexOf('match /users/{uid}'), rulesText.indexOf('match /config/{docId}'));
  assert.match(usersBlock, /existing\(\)\.role == 'cliente' && incoming\(\)\.role == 'cliente'/);
  assert.match(usersBlock, /canClientSelfLink\(incoming\(\)\.clientId, incoming\(\)\.status\)/);
});

test('all isValid* rule validators stay well under Firestore 1,000 evaluated-expression budget', () => {
  const fnRegex = /function (isValid[A-Za-z0-9_]+)\([^)]*\)\s*\{([\s\S]*?)\n    \}/g;
  let match: RegExpExecArray | null;
  let checked = 0;
  while ((match = fnRegex.exec(rulesText)) !== null) {
    checked += 1;
    const [, name, body] = match;
    const optStringCalls = (body.match(/isOptString\(/g) || []).length;
    const reqStringCalls = (body.match(/isReqString\(/g) || []).length;
    const optNumCalls = (body.match(/isOptNum\(/g) || []).length;
    const optBoolCalls = (body.match(/isOptBool\(/g) || []).length;
    const estimatedExprs = optStringCalls * 26 + reqStringCalls * 22 + optNumCalls * 16 + optBoolCalls * 16 + 120;
    assert.ok(
      estimatedExprs < 800,
      `${name} estimated worst-case CEL expressions (${estimatedExprs}) approaches Firestore 1,000-expression limit`,
    );
  }
  assert.ok(checked >= 15, `expected to audit at least 15 validators, audited ${checked}`);
});




