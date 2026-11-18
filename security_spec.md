# Security Specification — D&M Integra Chile

## 1. Data Invariants
1. **Default Deny**: Unmatched Firestore paths deny all reads and writes.
2. **Role Source of Truth**: Roles (`admin`, `consultor`, `assistente`, `cliente`) live strictly in `/users/{uid}` and are evaluated server-side in Firestore Security Rules via `get()`, never trusted from client claims.
3. **Admin Bootstrap & Verified Email**: Admin bootstrap email (`deivisonjoaquim@gmail.com`) and all authenticated writes require `request.auth.token.email_verified == true`. Self-registration (`users/{uid}` create) cannot assign `admin`, `consultor`, or `assistente` roles (except the verified bootstrap admin email).
4. **Assistant Financial Isolation**: `assistente` role is strictly blocked from reading or writing `/budgets/*`, `/financialRecords/*`, `/caseFinancials/*`, `/config/bancario`, and financial `generatedDocuments` (`financeiro == true`).
5. **Bank Config Admin-Only**: `/config/bancario` is readable and writable ONLY by `admin`. `/config/empresa` is publicly readable without bank account secrets.
6. **Client Tenant Isolation**: `cliente` role can only read/write documents matching their linked `clientId` (derived from `users/{uid}.clientId`) or own `uid`, and cannot view internal observations, unreleased `viabilityAssessments`, or unreleased `generatedDocuments`.
7. **Immutable Audit Trail**: `/auditLogs/*` allows creation by authenticated users for valid logs, and forbids `update` and `delete` for all roles including `admin`.
8. **Commission Isolation**: `/partners/*` (containing `tabelaValoresComissao`) is restricted to `admin` and `consultor`. Public/client views read only `/partnersPublic/*` (strictly non-commission fields where `recomendadoAosClientes == true` and `statusHomologacao == 'Ativo/Indicado'`).
9. **Path Variable & Payload Limits**: All document IDs match `^[a-zA-Z0-9_\-]+$` with length <= 128; string fields enforce `.size()` bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Privilege Escalation (`users/{uid}`)**: Authenticated non-admin creates `/users/attacker` with `{ role: 'admin', status: 'ativo' }` -> `PERMISSION_DENIED`.
2. **Role Mutation on Own Profile (`users/{uid}`)**: `cliente` updates `/users/clienteUid` changing `role` from `'cliente'` to `'consultor'` -> `PERMISSION_DENIED`.
3. **Assistant Reads Budgets (`budgets/{id}`)**: User with `role == 'assistente'` attempts `get` or `list` on `/budgets` -> `PERMISSION_DENIED`.
4. **Assistant Reads Financial Records (`financialRecords/{id}`)**: User with `role == 'assistente'` attempts `get` or `list` on `/financialRecords` -> `PERMISSION_DENIED`.
5. **Assistant Reads Case Contract Value (`caseFinancials/{caseId}`)**: User with `role == 'assistente'` attempts `get` on `/caseFinancials/case1` -> `PERMISSION_DENIED`.
6. **Consultor Reads Bank Secrets (`config/bancario`)**: User with `role == 'consultor'` attempts `get` on `/config/bancario` -> `PERMISSION_DENIED`.
7. **Client Reads Another Client's Case (`cases/{otherCaseId}`)**: Client A (`clientId: 'cA'`) attempts `get` on `/cases/caseB` (`clientId: 'cB'`) -> `PERMISSION_DENIED`.
8. **Client Lists All Clients (`clients`)**: Client A attempts unbounded `list` on `/clients` without matching `clientId`/`userId` -> `PERMISSION_DENIED`.
9. **Client Reads Unreleased Viability Assessment (`viabilityAssessments/{id}`)**: Client A attempts `get` when `liberadoAoCliente == false` -> `PERMISSION_DENIED`.
10. **Audit Log Tampering (`auditLogs/{id}`)**: Even `admin` attempts `update` or `delete` on `/auditLogs/log1` -> `PERMISSION_DENIED`.
11. **Public Reads Partner Commissions (`partners/{id}`)**: Unauthenticated or `cliente` user attempts `get` on `/partners/p1` -> `PERMISSION_DENIED`.
12. **Unverified Email Write / Spam Honeypot (`partnerProposals/{id}`)**: Public submission with non-empty `website_honeypot` or oversized string (> 3000 chars) -> `PERMISSION_DENIED`.
13. **FCM Token & Notification Isolation (`/fcmTokens/{id}`, `/clientNotifications/{id}`)**:
    - Clients can register/update/deactivate ONLY their own `/fcmTokens/{id}` (`uid == request.auth.uid` and `clientId == userClientId()`) and cannot read or list tokens of other users/clients.
    - Only verified staff (`admin`, `consultor`, `assistente`) can create `/clientNotifications/{id}`; clients can ONLY read notifications matching their `clientId` and update strictly `['lida', 'lidaEm', 'updatedAt']` without mutating `titulo`, `mensagem`, or `clientId`.
