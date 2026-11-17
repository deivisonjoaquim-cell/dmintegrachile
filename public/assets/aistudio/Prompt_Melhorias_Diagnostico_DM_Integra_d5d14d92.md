# Melhorias do módulo Diagnóstico — D&M Integra Chile

Evolui o diagnóstico **já corrigido** (Prompt 0: respostas Sim/Não normalizadas, riscos independentes, Mercosul cód. 15 sempre no comparativo, 15 testes). Serve para AI Studio (Firestore) e Base44 (coleção = entidade). Se os 15 testes ainda não passam, corrija isso antes.

```
REGRA GERAL: Evoluir SOMENTE o diagnóstico (/diagnostico, modo interno, resultado, Lead e tela de testes). Não quebrar o que funciona. Português do Brasil, datas dd/mm/aaaa (America/Sao_Paulo), moedas R$/CLP/USD. IA, quando usada, roda só no servidor, é opcional e sempre rascunho. Ao final, liste em até 6 linhas o feito e o pendente.

1) EXPERIÊNCIA DO USUÁRIO (público e mobile)
- Perguntas adaptativas: mostrar somente o que importa para o perfil (ex.: nada de "dados do empregador" para quem escolheu estudar). Barra de progresso com "faltam N perguntas" e tempo estimado.
- Salvar e retomar: rascunho no navegador e, após informar WhatsApp/e-mail, link para continuar depois. Voltar sem perder respostas.
- Ajuda contextual em cada pergunta ("por que perguntamos isso?" e "o que significa Orden de Abandono / overstay"), em linguagem simples, citando a Biblioteca Legal quando houver.
- Perguntas sensíveis (antecedentes, rejeição, Orden de Abandono) só na etapa 5, com aviso de confidencialidade e opção "Prefiro falar com o consultor" (não conta como Sim nem como Não; gera flag "revisar com o consultor").
- Validação em tempo real (WhatsApp, e-mail, datas, passaporte), acessibilidade (teclado, contraste, rótulos) e textos 100% em português.
- Anti-spam (honeypot, limite por IP/tempo) e proteção contra Lead duplicado (atualiza o existente por e-mail/WhatsApp).

2) PRECISÃO E EXPLICABILIDADE
- Cada resultado guarda: versão das regras (data e identificador), regras acionadas, notas por subcategoria e ajustes. Tela "Por que esta indicação?" legível para o consultor e versão simplificada para o cliente.
- Indicador de confiança do resultado (Alta, Média, Baixa) conforme respostas faltantes ou contraditórias; lista "informações que mudariam o resultado".
- Detecção de contradições (ex.: diz estar no Brasil mas informa entrada recente como turista; menor de idade com renda de aposentadoria) com pergunta de esclarecimento.
- Cenário "e se": o consultor altera uma resposta (ex.: formalizar união, assinar contrato, renovar passaporte) e vê o resultado novo ao lado do atual, sem salvar.
- Nunca prometer aprovação nem prazo: cronogramas e custos sempre em faixas e com aviso de estimativa.

3) RESULTADO MAIS ÚTIL
- Plano de ação personalizado em 3 blocos: "Faça agora", "Em 30 dias", "Antes do protocolo", gerado das regras e dos requisitos da subcategoria (VisaRequirement), já ordenado por validade e prazo (documentos sem validade e demorados primeiro; os de 60 dias por último).
- Faixa de custos estimada (honorários da tabela do admin + taxas e apostilas/traduções de custosPadrao) em BRL e CLP, rotulada "estimativa — confirmar na fonte oficial".
- Cronograma em faixas (preparação documental, protocolo, resposta do SERMIG) sem prometer data.
- Checklist de documentos que o cliente já tem vs. falta, com semáforo e termômetro inicial.
- Comparativo lado a lado reforçado: subcategoria recomendada x Mercosul (cód. 15) x terceira opção, com linhas fixas (de onde pedir, permite trabalhar, exige renda/contrato, vigência, caminho para Definitiva, risco, documentos extras).
- Relatório do diagnóstico em PDF A4 com logo, dados do cliente, resultado, alertas, plano de ação e aviso legal; botão imprimir/baixar e enviar por WhatsApp (wa.me com link ou resumo, com registro no log).
- Para famílias: diagnóstico por pessoa (titular + dependentes) com consolidado do grupo e indicação de quem é titular e quem é dependente — só quando selecionado explicitamente.

4) FUNIL, LEAD E CONVERSÃO
- Lead criado com: respostas normalizadas, subcategoria sugerida, nota, confiança, flags, versão das regras, UTM/origem (query string), prioridade automática (Alta: risco alto, urgência ou passaporte curto; Média; Baixa) e "temperatura" (quente/morno/frio) por regras simples.
- Pós-diagnóstico: botões Calendly (iframe + nova aba), WhatsApp e "Acompanhar meu processo". Mensagem automática sugerida por modelo (MessageTemplate) com variáveis {{nome_cliente}}, {{subcategoria_visto}}. Lembrete de follow-up (Task) para o responsável em 24h e 72h.
- Quem abandonou o formulário após informar contato recebe Task "retomar contato" (sem envio automático externo).
- Botão interno "Converter em Cliente e Caso" já vinculando visto, checklist por pessoa e plano de ação ao caso.

5) PAINEL DE INTELIGÊNCIA DO DIAGNÓSTICO (admin/consultor)
- Métricas: diagnósticos por período e origem, taxa de conclusão, abandono por etapa, subcategorias mais indicadas, % de brasileiros com alerta de saída do Chile, flags de risco, conversão Lead → Cliente, tempo até contato.
- Lista de leads por prioridade e por confiança baixa, filtros e CSV.
- Heatmap simples das perguntas mais deixadas em branco para melhorar o formulário.

6) GESTÃO DAS REGRAS SEM CÓDIGO (somente admin)
- Tela "Regras do Diagnóstico": ver e editar condições, notas base e ajustes em formulário estruturado (não texto livre), com pré-visualização do impacto e versionamento (quem mudou, quando, antes → depois, em auditoria).
- Botão "Rodar testes" obrigatório antes de publicar uma nova versão das regras; bloqueia publicar se algum teste falhar. Reaplicar regra nova a leads antigos só sob demanda ("Recalcular selecionados") mantendo o resultado anterior no histórico.
- Alerta quando uma norma da Biblioteca Legal usada por uma regra for alterada ou estiver sem verificação há mais de 90 dias.

7) TESTES (ampliar de 15 para 30 perfis)
Manter os 15 atuais e acrescentar: (16) brasileiro menor de idade acompanhado dos pais; (17) casal brasileiro, um titular e um dependente; (18) vínculo familiar informado mas NÃO formalizado → não ativa Reunificação, sugere formalizar; (19) rejeição anterior = Sim e demais Não → só essa flag; (20) Orden de Abandono = Sim → só essa flag; (21) antecedentes = Sim → só essa flag; (22) "prefiro falar com o consultor" → flag de revisão, sem risco alto automático; (23) passaporte vencido; (24) já residente no Chile pedindo prorrogação; (25) residente há 24+ meses → Residência Definitiva em análise; (26) estudante sem matrícula → não ativa cód. 03; (27) investidor sem origem comprovada → alerta; (28) respostas contraditórias → confiança Baixa; (29) todas as respostas vazias → pede dados, sem recomendação; (30) mudança de regra altera nota e o teste de regressão acusa. A tela admin mostra Aprovado/Reprovado e o diff esperado vs. obtido.

8) SEGURANÇA E LGPD
- Aceite LGPD versionado antes do envio, com finalidade clara; minimização de dados (não pedir CPF nem passaporte no diagnóstico público).
- Dados sensíveis (antecedentes, saúde) com acesso restrito por papel; assistente sem acesso a valores/custos; exclusão e exportação a pedido do titular.
- Regras de segurança: Lead criável publicamente, leitura/edição só interna; resultado público acessível apenas por link com token não adivinhável e expiração configurável.
- Aviso fixo no resultado e no PDF: "Pré-análise orientativa. Não é parecer jurídico nem garantia de aprovação pelo SERMIG." e o Aviso Legal padrão do sistema.

9) IA OPCIONAL (servidor)
- "Refinar parecer com IA": recebe respostas, regras acionadas, visaCategories e legalSources; só afirma o que consta nas fontes; devolve JSON validado (resumo, riscos, perguntas ao consultor) exibido como rascunho editável; se faltar fonte, "fonte a cadastrar". Chamada autenticada, com limite de tamanho e taxa. Nunca altera a recomendação das regras sozinha.

Critério de aceite: os 30 testes passam; retomar diagnóstico por link funciona; PDF sai com logo e aviso legal; consultor edita uma regra, roda os testes e publica nova versão com auditoria; painel mostra abandono por etapa; nenhuma flag de risco surge sem a resposta Sim correspondente.
```

## Observações
- A tabela de notas e as regras são **orientação operacional**, não parecer jurídico: valide com o consultor responsável e confirme as normas na Biblioteca Legal.
- Custos e prazos exibidos são estimativas; confirme sempre em SERMIG, CNJ e PF.
- Peça revisão jurídica do termo LGPD antes de usar com clientes reais.
- No Base44 Free, se estourar o limite, divida em: itens 1–3 / itens 4–6 / itens 7–9.
