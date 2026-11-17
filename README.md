# D&M Integra Chile – Relocation & Assessoria

Plataforma completa de assessoria migratória e relocation para brasileiros no Chile, com site público em português do Brasil, diagnóstico inteligente em 6 etapas, Portal do Cliente (LGPD) e Painel Operacional por papéis (`admin`, `consultor`, `assistente`, `cliente`).

## Variáveis de Ambiente / Secrets (Cloud Run)

Configure as seguintes variáveis de ambiente no serviço Cloud Run / painel de Secrets antes de publicar em produção:

- `GEMINI_API_KEY`: Chave da API Gemini utilizada **exclusivamente no servidor** (`/api/ai/*`). Nunca exposta no navegador.
- `ADMIN_EMAILS`: Lista separada por vírgulas dos e-mails Google que receberão automaticamente o papel `admin` no primeiro login (ex.: `deivisonjoaquim@gmail.com`).
- `APP_URL`: URL pública do aplicativo implantado.
- `PORT`: Porta HTTP (padrão `3000`).

## Domínios Autorizados no Firebase Authentication

Após publicar no Cloud Run ou domínio próprio:
1. Acesse **Firebase Console → Authentication → Settings → Authorized domains**.
2. Adicione o domínio de produção (ex.: `*.run.app` ou seu domínio personalizado) para permitir o login com Google.

## Regras do Firestore

As regras de segurança em `firestore.rules` aplicam controle rigoroso por papel (`admin`, `consultor`, `assistente`, `cliente`) e isolam dados financeiros (`budgets`, `financialRecords`, `caseFinancials`, `config/bancario`) do papel `assistente`.

## Scripts

```bash
# Desenvolvimento (Express + Vite middleware na porta 3000)
npm run dev

# Build de produção do frontend
npm run build

# Execução em produção
NODE_ENV=production npm start

# Testes unitários do motor de diagnóstico e métricas
npx --yes tsx --test src/utils/diagnosticEngine.test.ts src/utils/caseMetrics.test.ts firestore.rules.test.ts
```
