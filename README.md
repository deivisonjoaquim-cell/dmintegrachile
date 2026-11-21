# D&M Integra Chile – Relocation & Assessoria

Plataforma completa de assessoria migratória e relocation para brasileiros no Chile, compatível com **GitHub Free + Vercel Free (Hobby) + Firebase Spark/Blaze**, com:

- **Site institucional e Diagnóstico Gratuito (camada básica)**: exibe apenas viabilidade inicial, faixa de confiança, rota sugerida e alertas resumidos — mantendo o plano completo, checklist detalhado e estratégia técnica exclusivos para clientes contratados.
- **Duas Modalidades de Consultoria**:
  - **Consultoria Orientativa (`orientativa`)**: você conduz o protocolo no SERMIG com nossa estratégia, checklist na ordem correta de validade, revisão técnica de documentos e trilha orientativa de 6 etapas no Portal.
  - **Consultoria Completa (`completa`)**: nossa equipe executa e acompanha todo o processo do início ao fim, com linha do tempo integral de 15 etapas no Portal.
- **Portal do Cliente com liberação sincronizada**: ao liberar o acesso na **Área da Equipe** (no cadastro do cliente, na lista de clientes ou no cabeçalho do caso), tanto o registro do cliente quanto a conta Google (`users/{uid}`) e os casos vinculados são liberados e validados pelas regras do Firestore.

---

## Deploy Gratuito (GitHub Free + Vercel Free)

O aplicativo foi arquitetado para rodar como SPA estático otimizado no **Vercel Free (Hobby)** sem depender de disco local nem de servidor Node pago:

1. **Suba o repositório para o GitHub Free** (público ou privado).
2. **Importe no Vercel Free**:
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - O arquivo `vercel.json` já inclui as reescritas de SPA (`/diagnostico`, `/portal`, `/acompanhar`, `/painel`, `/entrar-equipe`, `/quem-somos`, `/parceiros`) e cabeçalhos de segurança/cache.
3. **Autorize o domínio do Vercel no Firebase Authentication** *(obrigatório para o login com Google funcionar)*:
   - Acesse **Firebase Console → Authentication → Settings → Authorized domains**.
   - Adicione seu domínio do Vercel (ex.: `seu-projeto.vercel.app` e, se houver, seu domínio próprio).
4. **Uploads compatíveis com Vercel Free**:
   - No modo estático do Vercel (sem disco local gravável), fotos e documentos são otimizados automaticamente no navegador (compressão de imagem ou DataURL até o limite seguro) sem precisar de servidor de arquivos ou bucket pago.

---

## Regras do Firestore & Controle por Papel

As regras em `firestore.rules` controlam o acesso por papel (`admin`, `consultor`, `assistente`, `cliente`):

- **Clientes com Diagnóstico Gratuito** não têm acesso aos documentos, checklist, timeline, mensagens nem financeiro do Portal.
- **Clientes liberados (`portalLiberado == true`)** recebem auto-vinculação segura no login Google (mediante e-mail verificado idêntico ao cadastro liberado pela equipe) e visualizam somente o seu próprio caso conforme a modalidade contratada (`orientativa` ou `completa`).
- **Revogação imediata**: bloquear o portal ou arquivar o cliente revoga o acesso no Firestore imediatamente.

---

## Scripts Locais

```bash
# Desenvolvimento local (Express + Vite middleware na porta 3000)
npm run dev

# Build de produção (usado pelo Vercel)
npm run build

# Verificação de tipos TypeScript
npm run lint

# Testes unitários (regras de acesso, motor de diagnóstico e métricas)
npx --yes tsx --test src/utils/portalAccess.test.ts src/utils/diagnosticEngine.test.ts src/utils/caseMetrics.test.ts
```
