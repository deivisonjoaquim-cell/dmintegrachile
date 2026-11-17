# Base Legal, Design Geral, Página Principal e Reestruturação — D&M Integra Chile

Serve para AI Studio (Firestore) e Base44 (coleção = entidade). Envie em **3 mensagens, nessa ordem**: **1** Reestruturação e design system → **2** Página principal → **3** Base Legal. Teste entre elas. Cada uma começa com a regra de não regressão.

---

## PROMPT 1 — Reestruturação geral, design system e otimização

```
REGRA GERAL: Reestruturar a ESTRUTURA VISUAL e o DESEMPENHO de todo o app sem remover funcionalidades nem alterar regras de negócio (diagnóstico, financeiro, documentos, parceiros, portal, permissões). Se algo for movido, manter a rota antiga redirecionando. Português do Brasil, datas dd/mm/aaaa (America/Sao_Paulo). Ao final, liste em até 8 linhas o feito e o pendente.

1) AUDITORIA PRÉVIA (antes de mexer)
- Mapear rotas, telas, componentes duplicados, estilos fixos (cores/fontes no código), telas sem estado vazio/loading/erro, textos em inglês, botões sem ação e consultas pesadas ou repetidas. Listar o que será unificado e executar.

2) DESIGN SYSTEM ÚNICO (tokens lidos de config/empresa: logo, cor primária, destaque, fundo, fonte)
- Tokens de cor (primária #0F2537, sucesso #1E7E34, destaque #D4AF37, crítico #C82333, fundo #F8F9FA, além de aviso/laranja e neutros), tipografia (escala de tamanhos, pesos), espaçamento (grade de 4/8 px), raios, sombras e ícones consistentes. Modo claro obrigatório; modo escuro opcional se não gerar inconsistência.
- Biblioteca de componentes reutilizáveis: botões (primário, secundário, perigo, fantasma, com carregamento), campos com máscara e validação (CPF, WhatsApp, data, moeda), selects com busca, tabelas (ordenação, filtros, paginação, colunas ocultáveis, exportar CSV), cartões, abas, modais e gavetas laterais, toasts, badges de status e semáforo, gauge do termômetro, linha do tempo, stepper, acordeão, upload com prévia, estados vazios ilustrados, skeletons de carregamento, confirmação de exclusão com digitação.
- Substituir estilos fixos por tokens em TODAS as telas; o admin muda cor/fonte/logo e o app inteiro (site, painel, portal, PDFs) acompanha.

3) NAVEGAÇÃO E ARQUITETURA DA INFORMAÇÃO
- Painel interno com sidebar recolhível agrupada: Hoje (dashboard e urgências) | Relacionamento (Leads, Clientes, Casos, Agenda) | Documentos (Documentos & Exportação, Modelos, Gerados) | Comercial (Orçamentos, Financeiro*, Parceiros) | Conhecimento (Biblioteca Legal, Diagnóstico) | Administração (Site e Aparência, Equipe, Configurações, Auditoria). *Itens financeiros invisíveis ao assistente.
- Busca global (atalho "/" ou Ctrl+K) por cliente, caso, lead, documento, parceiro e norma; "criar novo" rápido; breadcrumbs; atalhos de teclado básicos; últimos itens visitados.
- Ficha do Caso e do Cliente com cabeçalho fixo (identificação, etapa, termômetro, próximo prazo) e abas sem rolagem excessiva; ações principais sempre visíveis.
- Portal do Cliente com navegação inferior no celular (Processo, Documentos, Financeiro, Agenda/Suporte, Meus dados) e linguagem simples.
- Dashboard "O que fazer hoje": urgências por prioridade, tarefas do dia, agenda, pendências de documentos e (admin/consultor) indicadores financeiros; cartões clicáveis que levam direto ao item.

4) DESEMPENHO E OTIMIZAÇÃO
- Carregamento sob demanda por rota (code splitting) e componentes pesados (editor, PDF, gráficos) carregados só quando usados; imagens otimizadas (tamanho, formato moderno, lazy load); fontes carregadas com display swap.
- Dados: paginação e limites em toda lista, índices para as consultas mais usadas, filtros no servidor/consulta (não no navegador), assinaturas em tempo real só onde necessário e canceladas ao sair da tela, cache de configurações (empresa, tema, modelos) e de tabelas de referência (vistos, requisitos, fontes legais) com invalidação ao editar. Eliminar consultas duplicadas e laços de leitura item a item.
- Geração de PDF/impressão por CSS de impressão (sem bibliotecas pesadas, salvo necessidade).
- Meta: primeira tela útil rápida em celular comum; evitar layout que "pula" (reservar espaço de imagens); lista de 1.000 registros fluida (virtualização ou paginação).

5) ACESSIBILIDADE, RESPONSIVIDADE E QUALIDADE
- Contraste mínimo AA, foco visível, navegação por teclado, rótulos e alt text, tamanhos de toque ≥ 44 px, respeito a "reduzir movimento".
- Responsivo: celular (360 px), tablet e desktop; tabelas viram cartões no celular.
- Tratamento global de erros (nunca mostrar JSON cru ou stack), mensagens em português, tentativas automáticas em falhas temporárias, e página 404/acesso negado amigáveis.
- Padronizar datas dd/mm/aaaa, moedas (R$, CLP, USD com separadores brasileiros), máscaras e capitalização de textos.

6) ACEITE
- Todas as rotas abertas com os 4 papéis sem erro de console; nenhum estilo fixo restante; busca global funcionando; build sem avisos relevantes; relatório final "antes/depois" (rotas, componentes unificados, consultas reduzidas).
```

---

## PROMPT 2 — Página principal (Home / Landing) e institucional

```
REGRA GERAL: Redesenhar SOMENTE a página principal e as páginas institucionais (Quem Somos, Parceiros, Diagnóstico — apenas a casca visual), usando o design system do Prompt 1. Todo texto e imagem vêm do CMS (siteContent) e são editáveis pelo admin. Não quebrar diagnóstico, login, portal nem rotas existentes.

1) ESTRUTURA DA HOME (seções ordenáveis, ativáveis e editáveis pelo admin)
- Cabeçalho fixo com logo, menu (Início, Serviços, Como funciona, Quem Somos, Parceiros, FAQ, Contato), botão destaque "Fazer diagnóstico" e "Área da equipe"/"Acompanhar meu processo".
- Hero forte: título e subtítulo editáveis, CTA principal (Diagnóstico gratuito) e secundário (WhatsApp), imagem/ilustração editável, selo de confiança e microprova (ex.: "Atendimento especializado para brasileiros no Chile"). Sem prometer aprovação nem prazos.
- Faixa "Por que escolher" com 3–4 diferenciais.
- Serviços em cartões (Residência Temporal Mercosul, Residência Definitiva, Prorrogação, Relocation, Apostila/Tradução) com botão "Saiba mais" abrindo gaveta/página.
- Como funciona em 4–5 passos visuais (diagnóstico → documentos → protocolo → acompanhamento → chegada).
- Comparador rápido "Qual caminho serve para mim?" que leva ao diagnóstico.
- Quem Somos resumido (foto, formação e credenciais do responsável, editáveis) + link para a página completa.
- Parceiros homologados (somente recomendados, campos públicos).
- Depoimentos/resultados: só exibir se cadastrados e autorizados pelo cliente; sem números inventados.
- FAQ em acordeão (editável) e "Entenda a Lei" com explicações simples e data da última revisão normativa; nunca selo negativo; "Referência oficial: SERMIG" com link.
- Contato (WhatsApp, e-mail, Instagram, Calendly incorporado) e rodapé com aviso legal, política de privacidade e termo LGPD.

2) DESIGN
- Visual corporativo e moderno com a paleta do tema, muito espaço em branco, tipografia hierárquica, ícones consistentes, microanimações sutis (entrada ao rolar, hover) respeitando "reduzir movimento"; botão flutuante de WhatsApp (editável) e barra de CTA fixa no celular.
- Imagens otimizadas com texto alternativo; cabeçalho sem "pular"; pontuação alta de desempenho e acessibilidade.
- SEO básico editável (título, descrição, imagem de compartilhamento por página) e dados estruturados de organização.

3) EDITOR DO ADMIN (Site e Aparência)
- Editar logo, cores, fonte, textos, imagens, ordem e visibilidade de cada seção com pré-visualização ao vivo (desktop/celular), botão "Publicar" e "Restaurar versão anterior" (histórico de versões do site com auditoria). Rascunho separado do publicado.

4) QUEM SOMOS (/quem-somos)
- Foto oficial (upload), trajetória, formação acadêmica e jurídica, experiência, missão, selos/credenciais e linha do tempo; tudo editável. Não exibir credencial que não tenha sido informada pelo admin.

5) ACEITE
- Mudar texto, cor, logo e ordem de seção no admin reflete na Home publicada após "Publicar"; Home carrega rápido no celular; todos os CTAs funcionam (diagnóstico, WhatsApp com mensagem pronta, Calendly).
```

---

## PROMPT 3 — Base Legal (Biblioteca Legal)

```
REGRA GERAL: Evoluir SOMENTE a Biblioteca Legal (legalSources) e seus vínculos. Não quebrar diagnóstico, checklist, pareceres nem Portal. IA só no servidor, como rascunho, com aprovação humana. Português do Brasil.

1) ESTRUTURA E CONTEÚDO
- Campos: título, tipo (Lei, Decreto, Resolução, Circular, Acordo Internacional, Portal Oficial, Jurisprudência, Norma Brasileira), país (Chile, Brasil, Mercosul), número/ano, órgão emissor, data de publicação, data de vigência, artigos relevantes (lista com número, resumo e citação curta), resumo em português, explicação ao cliente, texto integral/arquivo PDF, tags, link oficial, versão, status de vigência (Vigente, Alterada, Revogada, A verificar), última verificação, responsável pela verificação, normas relacionadas (alterada por / altera / regulamenta), observações.
- Seed sem duplicar (tudo "A verificar", resumos como rascunho; não preencher citações que não possam ser sustentadas): Ley 21.325, Decreto 177/2022, Decreto 296, Resolución Exenta 31.510/2024, Ley 19.880 art. 27, CPC Chile arts. 345 e 345 bis, Circular 26465, Acordo de Residência Mercosul, Decreto 5.852/2006, Convenção da Apostila da Haia / CNJ / PF, LGPD Lei 13.709/2018, Código Civil e CDC (contratos e consumo). Incluir portais oficiais (SERMIG, BCN LeyChile, Registro Civil, CNJ, Polícia Federal) como fontes tipo "Portal Oficial".

2) VÍNCULOS (a base legal "trabalha" no sistema)
- Vincular cada norma/artigo a subcategorias de visto (visaCategories), requisitos (visaRequirements), regras do diagnóstico, modelos de documento (contrato, termo SERMIG) e prazos (ex.: art. 27 → 180 dias em trâmite). Botão "Ver Base Legal" em visto, requisito, resultado do diagnóstico, parecer e checklist, abrindo gaveta com resumo, artigo e link oficial.
- Tela "Onde esta norma é usada" listando todos os vínculos e casos ativos afetados.

3) CONSULTA E USO
- Busca por texto, tag, país, tipo, vigência e artigo; filtros salvos; ordenação por última verificação; leitura confortável, favoritos e anotações internas do consultor.
- "Entenda a Lei" (público e portal) mostra só a explicação ao cliente e a data da última revisão; nunca exibir selo negativo estático.

4) GOVERNANÇA E VERIFICAÇÃO
- "Marcar como verificada" registra responsável e data; norma sem verificação há mais de diasAlertaRevisaoLegal (padrão 90) gera alerta no dashboard do admin. Painel "Saúde da base legal": total por status, vencidas, sem link oficial, sem vínculos.
- Versionamento: cada alteração cria versão (quem, quando, antes → depois), comparação entre versões lado a lado e restauração; nunca apagar norma revogada (mudar status e manter histórico).
- Se uma norma mudar, listar vistos/requisitos/regras do diagnóstico e casos ativos impactados e gerar Tasks de revisão.

5) ATUALIZAÇÃO ASSISTIDA POR IA (servidor)
- Upload de PDF ou texto colado → extração de artigos, comparação com a versão vigente, resumo executivo para a equipe, explicação simples para o cliente, impactos em vistos/requisitos/regras e divergências. Saída JSON validada, exibida como rascunho. Só publica após "Aprovar e Publicar Atualização" por admin/consultor. Sem fonte, escrever "fonte a cadastrar"; a IA nunca inventa artigo nem número de norma.
- Se a IA estiver indisponível (503/429), repetir automaticamente, usar modelo reserva e, no fim, permitir cadastro manual sem perder o texto colado.
- Atualização de custos e taxas por IA/referência: valores como "estimativa — confirmar na fonte oficial" com data; só grava após aprovação do admin (auditoria antes → depois).

6) SEGURANÇA
- Leitura pública apenas de título, número/ano, link oficial, explicação ao cliente e data de revisão; resumo técnico, texto integral e anotações só internos; escrita só admin/consultor; auditoria de todas as alterações.

7) ACEITE
- Cadastrar norma, vincular a um visto, ver o botão "Ver Base Legal" no resultado do diagnóstico, alterar a norma, receber alerta de impacto, aprovar a atualização com versão e auditoria, e conferir que o portal mostra só a explicação ao cliente.
```

---

## Observações
- Esta é uma reestruturação ampla: se o app já estiver grande, peça ao agente para **mostrar primeiro a auditoria e o plano** do item 1 do Prompt 1 antes de executar, e salve uma versão (GitHub) antes de começar.
- Normas, resumos e artigos devem ser conferidos pelo consultor nas fontes oficiais (SERMIG, BCN LeyChile, Planalto, CNJ, PF); o sistema só marca "Verificada" quando alguém registra a verificação.
- Textos legais, termo LGPD e política de privacidade precisam de revisão de advogado.
- Depoimentos e credenciais só devem aparecer com autorização e comprovação do admin.
