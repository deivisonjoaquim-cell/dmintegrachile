# D&M Integra Chile — Roteiro completo do zero ao deploy no Google AI Studio (Build)

## O que o AI Studio Build oferece (conferido na documentação oficial)
- Gera app **full-stack**: front-end React + servidor Node.js (npm liberado).
- **Firebase Firestore + Authentication** provisionados automaticamente (login "Sign in with Google").
- **Secrets** no servidor; a `GEMINI_API_KEY` é configurada automaticamente e **fica só no servidor** (chamadas ao Gemini devem ser feitas por rotas `/api/...`).
- Deploy no **Cloud Run** (URL pública), exportação em ZIP e sincronização com GitHub.
- Iteração por chat ou "annotation mode" (clicar na tela e pedir a mudança).

Isso é mais robusto que o plano Free do Base44: aqui há backend real, regras de segurança do Firestore e IA no servidor. Os prompts abaixo foram reescritos para essa realidade.

## Como trabalhar
1. Abra aistudio.google.com → **Build** → plataforma **Web app**.
2. Envie **um prompt por vez**, na ordem. Teste a prévia antes do próximo.
3. Se quebrar, envie: "Corrija todos os erros de build e de console do código atual, sem remover funcionalidades."
4. Ative a integração Firebase quando o AI Studio oferecer (Firestore + Auth).
5. Use o botão de GitHub para guardar versões a cada fase concluída.
6. Cuidados: custos de Cloud Run/Gemini podem se aplicar; apps compartilhados mostram o código a quem tiver acesso — não compartilhe com edição.

---

## BLOCO BASE (colar no início de CADA prompt)

```
PROJETO: "D&M Integra Chile – Relocation & Assessoria", plataforma de gestão de consultoria de imigração para o Chile, clientes brasileiros.

STACK: React + TypeScript + Tailwind (front), Node/Express (servidor), Firebase Auth (Google) + Firestore + Storage (se disponível; senão upload pelo servidor). Chamadas ao Gemini SOMENTE pelo servidor (rotas /api/ai/*), com GEMINI_API_KEY de Secrets. Nunca expor chaves no front.

REGRAS:
- Interface 100% em português do Brasil (login e erros incluídos). Termos chilenos em espanhol entre parênteses quando útil (Estampado Electrónico, Certificado de Antecedentes, Orden de Abandono, ClaveÚnica, Descargos).
- Datas dd/mm/aaaa (America/Sao_Paulo); máscaras CPF (000.000.000-00) e +55 (00) 00000-0000; moedas R$, CLP, USD; busca e filtros em listas; exportação CSV.
- Identidade: primária #0F2537, sucesso #1E7E34, destaque #D4AF37, crítico #C82333, fundo #F8F9FA; cores/fonte/logo SEMPRE lidos de Firestore (config/empresa), nunca fixos no código.
- Aviso legal fixo no rodapé, portal e todo PDF/documento: "Este sistema auxilia a gestão do processo migratório e não substitui a análise individual do consultor; regras e prazos estão sujeitos a alterações pelo SERMIG."
- IA nunca inventa normas: só cita registros da coleção legalSources; sem fonte, escrever "fonte a cadastrar". Todo texto de IA é rascunho editável e exige aprovação humana.
- Papéis (users/{uid}.role): admin | consultor | assistente | cliente. Assistente NUNCA vê orçamento, financeiro ou valores. Cliente só vê o que tem seu clientId. Aplicar nas Firestore Security Rules E na interface.
- Mobile-first, estados de loading/vazio/erro em toda tela, componentes reutilizáveis, tudo tipado.
- Não quebrar fases anteriores. Ao final, listar em até 6 linhas o feito e o pendente.
```

---

## FASE 1 — Fundação: auth, papéis, regras, tema e auditoria

```
[COLAR BLOCO BASE]

FASE 1: fundação.

1) Login em português com Google. Primeiro acesso: se o e-mail estiver em ADMIN_EMAILS (variável em Secrets), cria users/{uid} com role "admin"; demais criam role "cliente" com status "pendente". Admin gerencia usuários (alterar papel, ativar/desativar) em Configurações > Equipe.
2) Redirecionamento por papel: admin/consultor/assistente → /painel; cliente → /portal. O botão "Área da equipe" do site vai a /painel (autenticado) ou abre login e volta a /painel.
3) Coleções iniciais: users, config/empresa (nome_empresa, razao_social_cnpj_rut, responsavel_tecnico, endereco_cidade, foro_comarca = "Comarca da Capital do Estado do Rio de Janeiro – RJ", logoUrl, corPrimaria, corDestaque, corFundo, fontePrincipal [Inter, Plus Jakarta Sans, Merriweather, Montserrat], whatsapp, email, siteInstagram, linkCalendly, emailGoogleAgenda, chavePix, linkPagamentoCartao, textoContratoPadrao, textoReciboPadrao, termoLgpd, termoLgpdVersao, avisoLegal, bloqueioProtocoloMinimo=100, diasAlertaRevisaoLegal=90, custosPadrao), config/bancario (dados_bancarios_br, dados_bancarios_cl, dados_wise: SOMENTE admin), siteContent, auditLogs.
4) Firestore Security Rules completas e testadas: leitura pública apenas de config/empresa (sem campos bancários), siteContent ativo e parceiros recomendados (campos públicos); escrita por papel; auditLogs só criação (sem editar/excluir); bancário só admin; cliente restrito ao próprio clientId; assistente sem acesso a budgets/financialRecords.
5) Helper único registrarAuditoria(acao, entidade, id, campo, antes, depois) usado em todas as gravações futuras.
6) Layout: header público com logo e menu (Início, Quem Somos, Parceiros, Diagnóstico, Acompanhar meu processo, Área da equipe), painel com sidebar por papel, rodapé com aviso legal e data da última revisão normativa (só se existir; nunca selo negativo).
7) Configurações > Aparência (admin): logo (upload ou URL), cores, fonte, com pré-visualização em tempo real; tema aplicado por CSS variables em todo o app.
Critério de aceite: login em PT-BR, redirecionamento correto por papel, tema muda ao salvar, regras bloqueiam leitura indevida (testar com 2 usuários).
```

---

## FASE 2 — Site público, CMS, Quem Somos e Parceiros (público)

```
[COLAR BLOCO BASE]

FASE 2: páginas públicas. Mantém a Fase 1.

1) Home totalmente dirigida por siteContent (hero, servicos, diferenciais, como_funciona, quem_somos, faq, contato, rodape: titulo, subtitulo, conteudoHtml, imagemUrl, ordem, ativo, metadados). Hero com CTA duplo (Diagnóstico / WhatsApp), faixa de confiança, cards de serviços, passo a passo, FAQ em acordeão, parceiros homologados, contato. Design moderno, corporativo e dinâmico (animações leves, tipografia cuidada).
2) Editor de CMS (admin): editar todos os textos e imagens, reordenar e ativar/desativar seções, com pré-visualização.
3) /quem-somos editável pelo admin (Configurações > Equipe): foto oficial (upload), trajetória, formação acadêmica/jurídica, experiência, missão, selos/credenciais; resumo também na Home.
4) /parceiros: lista pública dos parceiros com recomendadoAosClientes=true e status Ativo/Indicado + formulário "Seja um Parceiro" (nome_empresa, categoria [Escritório de Advocacia, Cartório / Apostilamento, Tradutor Juramentado, Seguradora / Saúde, Imobiliária, Escola / Universidade, Despachante, Contabilidade / Abertura Empresa, Outro], país [Brasil, Chile, Ambos], cidade, responsável, WhatsApp, e-mail, moeda [BRL, CLP, USD], proposta de valores/benefícios, mensagem) gravando em partnerProposals (criação pública com validação e honeypot anti-spam; leitura só admin/consultor).
5) Seed idempotente de textos iniciais em português para todas as seções.
```

---

## FASE 3 — Diagnóstico inteligente (/diagnostico) e Leads

```
[COLAR BLOCO BASE]

FASE 3: diagnóstico e leads. Mantém Fases 1–2.

1) Coleções: leads, visaCategories, visaRequirements, legalSources (CRUD de admin/consultor). Leads: nome, whatsapp, email, cidadeUf, origem [Instagram, Indicação, Site, Parceiro, Outro], interesse, statusFunil [Novo, Contatado, Diagnóstico Agendado, Orçamento Enviado, Fechado, Perdido], motivoPerda, responsavelId, respostasTriagem, subcategoriaSugerida, notaViabilidade, prioridade, notas, lgpdAceito/versão/data. Criação pública permitida (regras), leitura/edição interna, exclusão admin.
2) visaCategories: codigo, nomeEspanhol, nomePortugues, descricao, publicoAlvo, permiteDentroChile [Sim, Não, Condicional], vigenciaMeses, levaDefinitiva, mesesDefinitiva, permiteTrabalhar, exigeRenda, brasileirosElegiveis, ativo, fonteUrl, ultimaVerificacao, statusVerificacao [Verificado, A verificar]. visaRequirements: visaCategoryId, nomeDocumento, categoriaDoc [Identidade, Antecedentes, Familiares, Profissional/Financeiro, Apostilas, Traduções, Fotos, Taxas], descricao, comoObterInstrucoes, comoObterUrl, obrigatorio, peso 1–5, ordemPrioridadeEmissao 1–20, exigeApostila, exigeTraducao, validadeDias (0 = não vence), orgaoEmissor.
3) Seed idempotente (tudo "A verificar", exceto o cód. 15 que é auto-reparado a cada abertura): 15 Reciprocidade Internacional/Mercosul (Art. 70 nº 13 Ley 21.325; brasileirosElegiveis, permiteTrabalhar, exigeRenda=false, permiteDentroChile="Não", 24 meses, levaDefinitiva, 24 meses), 01 Reunificação Familiar, 02 Atividades Lícitas Remuneradas, 03 Estudantes, 04 Trabalhadores de Temporada, 05 Custódia Gendarmería, 06 Ordem Judicial, 07 Razões Humanitárias, 08 Acordos Internacionais, 09 Religiosos, 10 Tratamento Médico, 11 Aposentados e Rentistas, 12 Ex-titulares de Residência Definitiva, 13 Investidores, 14 Negócios de Múltipla Entrada; fluxos: Dependente de Titular, Prorrogação (janela 90–10 dias antes do vencimento), Mudança de Subcategoria, Ratificação, Residência Definitiva, Permanência Transitória/Turismo. Requisitos padrão: Passaporte (vigência mín. 1 ano p/ pedido do exterior, peso 5), Antecedentes PF apostilados (validade 60 dias, peso 5), Foto (peso 3), Comprovante de direitos (peso 3), Certidão de Casamento/Nascimento apostilada (60 dias, peso 4–5) para dependentes, etc., com ordemPrioridadeEmissao coerente (sem validade/demorados primeiro; curtos por último).
4) NORMALIZAÇÃO: toda pergunta Sim/Não é boolean true/false/null; null NUNCA conta como Sim; função única isYes(). Perguntas de risco independentes (overstay, Orden de Abandono, rejeição anterior, antecedentes criminais); "Dependente de titular" só se selecionado.
5) Formulário em 6 etapas (stepper, progresso, validação, Voltar, estado salvo): (1) identificação; (2) localização [No Brasil, No Chile como turista, No Chile com residência, Em outro país], nacionalidade(s), validade do passaporte; (3) vínculos familiares no Chile (com formalização); (4) objetivo com ramificações [trabalho com oferta formal, serviços >90 dias, nômade digital, empreender/investir, estudar, aposentado/renda, tratamento médico, religioso, humanitário, temporada, explorar]; (5) histórico e dados sensíveis com aviso LGPD; (6) família acompanhante, prazo e documentos que já possui. Aceite LGPD versionado obrigatório.
6) Motor de decisão em módulo puro e testável: devolve recomendada, top3, comparativo, descartadas, alertas, flagsRisco, caminho, perguntasComplementares, preChecklist, viabilidade (7 dimensões: Elegibilidade Legal 25, Prontidão Documental 20, Capacidade Financeira 15, Histórico/Riscos 15, Prazo 10, Estabilidade/Definitiva 10, Viabilidade Familiar 5; veredito 80–100 Viável, 60–79 com ressalvas, 40–59 após ajustes, 0–39 inviável no momento) e REGRAS ACIONADAS ("Por que esta indicação?"). Tabela de notas base em constantes comentadas.
   Regras: brasileiro → Mercosul (cód. 15) sempre elegível, sempre no Top 3 e no comparativo lado a lado, nota ≥ 90 se estiver no Brasil; turista no Chile sem vínculo formalizado nem razão humanitária → alerta "ELEGÍVEL — Requer saída do Chile para protocolar do exterior (não permitido solicitar como turista de dentro do Chile)" (não aparece com vínculo formalizado ou razão humanitária); vínculo formalizado → Reunificação Familiar (de dentro do Chile permitido); contrato/serviços >90 dias → cód. 02; renda passiva → cód. 11 (faixa influencia a nota); matrícula reconhecida → cód. 03; investimento com origem → cód. 13; humanitário → 07; saúde → 10; religioso → 09; temporada → 04; qualquer flag de risco → "Risco Alto — Revisão Obrigatória do Consultor" indicando QUAL pergunta a gerou; passaporte < 1 ano reduz a nota dos pedidos do exterior. Mercosul não penaliza Capacidade Financeira por falta de contrato/renda.
7) Tela de resultado limpa: subcategoria recomendada (código, nomes, nota, caminho, trabalha?, caminho para Definitiva), alertas em destaque, Top 3, comparativo com Mercosul, descartadas com motivo, perguntas ao consultor, pré-checklist, viabilidade com semáforo, "Parecer Orientativo" (regras + legalSources) e aviso "Pré-análise orientativa. Não é parecer jurídico nem garantia de aprovação pelo SERMIG." Botões: Agendar no Calendly (modal/iframe com linkCalendly + nova aba; aviso se vazio), Falar no WhatsApp (wa.me URL-encoded + log), Criar conta/Solicitar acompanhamento.
8) Botão opcional "Refinar parecer com IA" chamando /api/ai/diagnostico (servidor, Gemini) que recebe respostas + regras acionadas + visaCategories + legalSources e só pode afirmar o que consta nas fontes; saída JSON validada; sempre exibida como rascunho.
9) Leads: kanban + lista, editar, excluir (confirmação + auditoria), converter em Cliente e Caso em 1 clique, sem duplicar por e-mail/WhatsApp. No interno, botão "Adotar esta subcategoria no Caso".
10) Tela admin "Testar Diagnóstico" com 15 perfis (Aprovado/Reprovado): (1) brasileiro no Brasil remoto → Mercosul ≥ 90 sem alerta; (2) turista sem vínculo → Mercosul com alerta de saída; (3) no Brasil com cônjuge chileno formalizado → Reunificação; (4) turista com cônjuge chileno formalizado → Reunificação sem alerta; (5) humanitário no Chile → cód. 07 sem alerta; (6) contrato formal → cód. 02 + Mercosul comparativo; (7) renda passiva → cód. 11; (8) matrícula → cód. 03; (9) investimento → cód. 13; (10) só overstay=Sim → só essa flag; (11) todos riscos Não → nenhuma flag; (12) dependente não selecionado → não aparece; (13) passaporte < 1 ano → alerta e nota menor; (14) segunda nacionalidade → Mercosul continua; (15) riscos não respondidos → nenhuma flag. Corrigir até todos passarem.
```

---

## FASE 4 — Clientes, dependentes, casos, urgências e agenda

```
[COLAR BLOCO BASE]

FASE 4: clientes e casos. Mantém Fases 1–3.

1) Coleções: clients (nomeCompleto, cpf, email, whatsapp, dataNascimento, estadoCivil, nacionalidade, profissao, escolaridade, anosExperiencia, rendaMensal, origemRenda, enderecoCompleto, passaporte numero/emissao/validade, objetivoChile, dataPrevistaMudanca, userId, portalLiberado, statusAcessoPortal [Não solicitado, Pendente liberação, Liberado], lgpdAceito/data, observacoes), dependents, cases (titulo, clientId, consultorId, tipoServico [Residência Temporal, Residência Definitiva, Prorrogação, Mudança de Subcategoria, Ratificação, Relocation Completo, Outro], visaCategoryId, subcategoriaIa, etapaPipeline 1–15, statusSermig [Não protocolado, Em trâmite, Requerimento de documentos, Aprovado, Rejeitado, Em recurso], portalLiberado, relatorioViabilidadeLiberado, datas de contrato/protocolo/aprovação/limite de entrada/vencimento/prazo de requerimento, numeroPedidoSermig, valorContrato, prioridade, notaViabilidadeGeral, parecerConsultor, parecerIa, npsNota, npsComentario), tasks, deadlines (tipos: Validade Documento, Validade Passaporte, Entrada no Chile 90d, Janela Prorrogação, Elegibilidade Definitiva, Prazo Legal 6 Meses SERMIG, Resposta Requerimento/Recurso, Vencimento Cédula, Parcela/Reunião), appointments, communicationLogs, viabilityAssessments (versionado).
2) Pipeline de 15 etapas: 1 Lead e diagnóstico, 2 Proposta e contrato, 3 Coleta documental, 4 Análise documental, 5 Apostilamento e tradução, 6 Revisão final, 7 Protocolo no SERMIG, 8 Acompanhamento, 9 Resultado, 10 Estampado e entrada no Chile, 11 Cédula de identidade, 12 Relocation, 13 Prorrogação, 14 Residência Definitiva, 15 Encerrado. Mudar etapa grava auditoria e cria tarefas padrão.
3) Telas: Clientes (cadastro direto SEM convite quando feito por admin/consultor, edição, exclusão segura com limpeza dos vínculos, "Enviar convite" e "Liberar acesso ao Portal"), Casos (lista/kanban), Ficha do Caso com abas (Resumo/Viabilidade, Dependentes, Documentos, Orçamento/Financeiro [oculta ao assistente], Agenda, Comunicação, Relocation, Histórico). Valor do contrato oculto ao assistente.
4) Central de Urgências no dashboard (calculada ao abrir): documentos vencendo ≤ 15 dias; janela de 90 dias para o Estampado; Prorrogação (120 a 10 dias do vencimento); casos em trâmite > 180 dias (Ley 19.880 art. 27); prazos de Descargos; parcelas atrasadas (oculto ao assistente). Cada alerta com "Avisar no WhatsApp" (wa.me + log). Métricas gerenciais com filtros (funil por origem, casos por etapa/subcategoria, termômetro médio, documentos mais reprovados, NPS; receita/inadimplência/margem só admin/consultor).
5) Agenda: Appointment + botões "Adicionar ao Google Agenda" (URL calendar.google.com/calendar/render?action=TEMPLATE com título, datas em America/Sao_Paulo e detalhes) e "Baixar convite (.ics)" em reuniões, tarefas e prazos. Calendly incorporado (iframe responsivo) + abrir em nova aba + "Confirmar meu agendamento" que cria o Appointment.
6) Parecer Técnico: "Gerar Parecer Técnico (Confrontado com Base Legal)" via /api/ai/parecer (Gemini no servidor): Enquadramento Legal, Elegibilidade e Riscos, Fundamentação Normativa (só legalSources), Recomendações; editor livre; "Salvar como Parecer Oficial".
```

---

## FASE 5 — Documentos, esteira, cronograma e relação priorizada

```
[COLAR BLOCO BASE]

FASE 5: documentos. Mantém Fases 1–4.

1) caseDocuments: caseId, clientId, pessoa (Titular ou dependente), visaRequirementId, nomeDocumento, categoriaDoc, etapaEsteira [1 Aguardando Envio, 2 Recebido/Triagem, 3 Em Conferência, 4 Pendência/Reprovado, 5 Pronto para Apostila/Tradução, 6 Aprovado para Protocolo], ordemEmissao, prazoSugeridoEmissao, arquivoUrl, status [Pendente, Enviado, Em análise, Aprovado, Reprovado, Vencido], dataEmissao, validadeDias, dataValidadeCalculada, apostilado, traduzido, motivoReprovacao, observacaoAnalista, versao, historico de versões (arquivos anteriores preservados), analisadoPor/Em.
2) Upload PDF/JPG/PNG (≤ 10 MB, validar tipo e tamanho) para Firebase Storage (ou servidor), com regras: cliente só envia/vê os próprios. Na ficha do cliente e no caso, formulário para DIGITAR/adicionar/editar documento (nome, categoria, emissão, validade em dias, apostila/tradução, observações, arquivo).
3) Checklist automático a partir de visaRequirements para titular e cada dependente. Esteira visual por pessoa. Aprovar documento que exige apostila e não está apostilado → move para "Pronto para Apostila/Tradução" e cria Task. Reprovar → seletor de motivo (Ilegível, Vencido, Sem apostila, Sem tradução, Nome divergente, Página cortada, Documento errado), versao+1 preservando o anterior, Task e botão WhatsApp com modelo de reprovação.
4) Termômetro ponderado: peso 1–5 dos obrigatórios (Aprovado 100%, Enviado/Em análise 40%, demais 0%); nota do caso = menor nota entre titular e dependentes; gauge 0–39 vermelho, 40–69 dourado, 70–89 azul-marinho, 90–100 verde; bloqueia "Pronto para protocolo" abaixo de bloqueioProtocoloMinimo (override só admin, com justificativa auditada).
5) Cronograma inteligente de emissão: ordena por validade/prazo (sem validade e demorados primeiro; validade curta, como Antecedentes PF 60 dias, por último) calculando a data sugerida para que tudo esteja válido na data de protocolo. Botão "Emitir e Enviar Relação de Documentos Priorizada": A4 com logo, ordem, prazos, validade e instruções; imprimir/PDF; link por WhatsApp (com log); exibida no Portal.
6) "Gerar Checklist de Apostilamento e Tradução" (imprimível) e "Pacote de Protocolo SERMIG" (índice PESSOA_DOCUMENTO_AAAA-MM-DD só com aprovados).
7) Análise por IA (opcional): /api/ai/analisar-documento (Gemini multimodal no servidor) extrai nome, emissão, órgão, idioma, apostila e legibilidade e sugere Aprovar/Revisar/Reprovar — SEMPRE sugestão, nunca aprova sozinha.
8) Página "Documentos & Exportação": cards expansíveis por cliente/caso com termômetro, download individual, Dossiê (PDF por impressão) e CSV.
```

---

## FASE 6 — Orçamentos, financeiro e documentos gerados

```
[COLAR BLOCO BASE]

FASE 6: orçamentos, financeiro, contratos. Mantém Fases 1–5. Tudo aqui é invisível ao assistente (menus e regras).

1) budgets: numeroOrcamento sequencial, leadId, clientId, caseId, titulo, tipoCobranca [Por Serviço Escolhido, Por Etapa Realizada, Pacote Completo], moedaPrincipal [BRL, CLP, USD], itens (descricao, etapaVinculada, valorHonorarios, taxasEstimadasTerceiros, moeda, statusEtapa [Aguardando, Em Execução, Concluída/Faturável, Paga]), desconto, totais, condicoesPagamento, validade, status [Rascunho, Enviado ao Cliente, Aprovado, Recusado, Parcialmente Faturado]. Serviços: Assessoria Visto Mercosul, Assessoria Residência Definitiva, Relocation Bancário/RUT, Tradução/Apostila. Etapas: 1 Diagnóstico e Planejamento, 2 Conferência e Preparação Documental, 3 Protocolo SERMIG, 4 Estampado e Pós-Chegada. Câmbio editável manualmente. Etapa concluída → "Faturar" gera financialRecord em 1 clique. PDF com logo + "Enviar no WhatsApp" (+ log). Cliente vê/aprova só orçamentos enviados.
2) financialRecords: caseId, budgetId, tipo [Honorários, Taxa SERMIG, Apostila/Tradução, Despachante/Outros], descricao, etapaReferencia, moeda, valor, vencimento, status [Pendente, Pago, Atrasado], formaPagamento [Pix, Cartão, Transferência, Wise, Boleto], comprovanteUrl. Módulo Financeiro (admin/consultor): KPIs (receita contratada, recebido no mês, a receber, em atraso, custos repassados, lucro estimado), lançamentos com filtros e CSV, parcelamento rápido, "Cobrar no WhatsApp" com Pix/link de cartão, incluir/editar/quitar/excluir.
3) Pagamentos: Pix com botão copiar, dados bancários/Wise (de config/bancario, só admin; ao cliente exibir apenas os dados do orçamento enviado), link de cartão.
4) messageTemplates (8 modelos: boas-vindas, cobrança de documentos, documento reprovado, protocolo realizado, visto aprovado, cobrança financeira, lembrete de prazo, pós-chegada) com variáveis {{nome_cliente}}, {{subcategoria_visto}}, {{documento_nome}}, {{motivo_reprovacao}}, {{prazo_data}}, {{valor}}, {{chave_pix}}; seletor "Usar modelo" em leads, casos, documentos e financeiro abrindo wa.me/mailto e gravando log.
5) documentTemplates + generatedDocuments: Contrato de Prestação de Serviços de Consultoria Migratória (Código Civil/CDC; partes, objeto, obrigações, honorários x custos de terceiros, obrigação de meio, rescisão, LGPD, FORO da Comarca da Capital do Estado do Rio de Janeiro – RJ), Recibo, Orçamento Oficial, Relação Priorizada, Termo de Ciência SERMIG (prazo de 6 meses, antecedentes de 60 dias, regras de entrada) e Carta de Apresentação. Todos com logo e dados institucionais no cabeçalho e aviso legal no rodapé; preenchimento automático pela ficha (nome, nacionalidade, estado civil, profissão, CPF, passaporte, endereço, e-mail, WhatsApp, objeto, valor, forma de pagamento); campos vazios "[preencher]" bloqueiam finalizar; editor livre; histórico versionado; impressão A4/PDF. Nota interna: "Revisar com advogado antes do uso".
6) "Atualizar custos e taxas (IA / referência)": /api/ai/custos sugere valores de taxas SERMIG, apostilamento e tradução como "estimativa — confirmar na fonte oficial" com data; só grava em config/empresa.custosPadrao após "Aprovar e salvar" (auditoria antes → depois); edição manual livre.
```

---

## FASE 7 — Parceiros (painel) e Biblioteca Legal com IA

```
[COLAR BLOCO BASE]

FASE 7: parceiros e legislação. Mantém Fases 1–6.

1) Parceiros (painel admin/consultor): partners (nome, tipoPessoa, país, cidade/região, contato, whatsapp, email, site/Instagram, moedaNegociacao, tabelaValoresComissao, condicoesParceria, recomendadoAosClientes [Sim/Não], avaliacao 1–5, statusHomologacao [Ativo/Indicado, Em Análise, Não Indicado/Suspenso], observacoes). Caixa de Entrada de partnerProposals (status Nova, Em Análise, Aprovada, Recusada) com "Aprovar e converter em Parceiro" (pré-preenche, exige definir "Indicar aos clientes"), filtros por país/categoria/moeda e CSV. "Gerar parecer da proposta com IA" (/api/ai/proposta) confrontando com legalSources (nota, riscos, base aplicada) como rascunho; decisão humana: indicar, indicar com ressalvas ou recusar, com texto de indicação para copiar. Só parceiros recomendados aparecem em casos, portal e site; comissões nunca públicas.
2) legalSources: titulo, tipo [Lei, Decreto, Resolução, Circular, Acordo Internacional, Portal Oficial, Jurisprudência], pais [Chile, Brasil, Mercosul], numeroAno, orgaoEmissor, artigos, resumoPortugues, explicacaoCliente, textoIntegral, arquivoPdfUrl, tags, linkOficial, versao, statusVigencia [Vigente, Alterada, Revogada, A verificar], ultimaVerificacao, responsavelVerificacao. Seed (status "A verificar", resumos como rascunho): Ley 21.325, Decreto 177/2022, Decreto 296, Resolución Exenta 31.510/2024, Ley 19.880 art. 27, CPC Chile arts. 345 e 345 bis, Circular 26465, Acordo de Residência Mercosul, Decreto 5.852/2006, Convenção da Apostila da Haia/CNJ/PF, LGPD Lei 13.709/2018, Código Civil e CDC. Não preencher citações que não possam ser sustentadas; "Marcar como verificada" registra responsável e data; alerta de normas sem revisão há mais de diasAlertaRevisaoLegal.
3) Biblioteca com busca por texto/tag/país/tipo/vigência e "Ver Base Legal" em visto, requisito e resultado do diagnóstico.
4) Atualização por IA: upload de PDF ou texto colado → /api/ai/norma (servidor) extrai artigos, compara com a versão vigente, gera resumo executivo, explicação simples para "Entenda a Lei", impactos em visaCategories/visaRequirements e divergências; só publica após "Aprovar e Publicar Atualização" (auditoria, versão anterior preservada, alerta nos casos ativos afetados).
5) "Entenda a Lei" público/portal exibe só explicacaoCliente e data da última revisão; sem selo negativo.
```

---

## FASE 8 — Portal do cliente e acompanhamento

```
[COLAR BLOCO BASE]

FASE 8: portal. Mantém Fases 1–7.

1) /acompanhar: quem fez o diagnóstico entra com Google, vincula-se ao lead pelo e-mail e fica "Pendente liberação" até o consultor/admin clicar "Liberar Acesso ao Portal" (ou admin libera ao cadastrar). Mensagens claras por status; usuário já vinculado vai direto ao portal.
2) /portal mobile-first, aceite LGPD versionado no 1º acesso, 5 abas: (1) Meu Processo & Etapas (linha do tempo do pipeline, termômetro motivador "Faltam X documentos. Seu processo está Y% pronto", relatório/parecer só se liberado); (2) Documentos & Prioridades (relação priorizada + upload dos próprios arquivos); (3) Orçamentos & Financeiro (ver/aprovar orçamento enviado, parcelas, Pix copiar, link de cartão, comprovante); (4) Agendamento & Suporte (Calendly, WhatsApp, parceiros recomendados, "Entenda a Lei"); (5) Meus Dados & LGPD (editar dados e dependentes, "Solicitar exportação" e "Solicitar exclusão" que geram Task + auditoria). NPS após Protocolo e após Aprovação.
3) Regras: cliente só lê/edita o que tem seu clientId; nunca vê observações internas, pareceres não liberados nem comissões. Aviso legal no rodapé.
```

---

## FASE 9 — Histórico, segurança, QA e deploy

```
[COLAR BLOCO BASE]

FASE 9: fechamento.

1) Histórico/Auditoria: aba no caso e página global (admin) com timeline clara (quem, data/hora exata, campo, valor anterior → novo, uploads, aprovações, orçamentos, comunicações, liberação de portal), filtros por usuário/entidade/período e CSV.
2) Segurança: revisar TODAS as Firestore/Storage Rules por papel (testar com admin, consultor, assistente e cliente); rotas /api/ai/* exigem ID token válido e papel permitido, com limite de tamanho e taxa; nenhuma chave no front; validar uploads (tipo e 10 MB); sanitizar HTML de documentos/CMS (sem script); aceite LGPD; exportação CSV e backup geral só admin.
3) QA: percorrer todas as rotas com os 4 papéis e corrigir erros de console, botões sem ação, estados vazios/loading/erro, textos em inglês, datas fora de dd/mm/aaaa, máscaras, filtros e CSV faltantes, links quebrados, responsividade mobile. Reexecutar os 15 testes do diagnóstico. Tela admin "Diagnóstico do Sistema" com checklist.
4) Deploy: preparar para Cloud Run (variáveis em Secrets: GEMINI_API_KEY, ADMIN_EMAILS), domínio autorizado no Firebase Auth e README com passos. Entregar lista final "Implementado / Pendente".
```

---

## Checklist de entrega

- [ ] Firebase (Firestore + Auth) ativo e domínio do deploy autorizado no Auth
- [ ] `ADMIN_EMAILS` definido e primeiro login admin testado
- [ ] Regras testadas com 4 perfis
- [ ] 15 testes do diagnóstico aprovados
- [ ] Logo, cores, fonte, Pix, Calendly e foro preenchidos em Configurações
- [ ] Normas conferidas e marcadas como verificadas pelo consultor
- [ ] Contrato, termo LGPD e textos legais revisados por advogado
- [ ] Deploy no Cloud Run + projeto salvo no GitHub

## Observações
- O login nativo é **Google**; clientes sem conta Google precisarão criar uma. E-mail/senha pode ser pedido depois, se a integração permitir.
- A tabela de notas do diagnóstico é orientação operacional, não parecer jurídico.
- Valores de custos por IA são estimativas; confirme em SERMIG, CNJ e PF.
- Custos de Cloud Run e do uso do Gemini podem se aplicar após o deploy.
