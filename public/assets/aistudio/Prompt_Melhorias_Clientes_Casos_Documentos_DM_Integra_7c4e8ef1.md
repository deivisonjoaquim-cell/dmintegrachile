# Melhorias: Clientes, Casos, Documentação e Documentos Gerados — D&M Integra Chile

Serve para AI Studio (Firestore) e Base44 (coleção = entidade). Evolui o que já existe, sem recriar. Se o limite do plano estourar, divida em: **A** (itens 1–2), **B** (3–4), **C** (5–7).

```
REGRA GERAL: Evoluir SOMENTE Clientes, Casos, Documentação e Documentos Gerados (contratos, recibos e afins). Não quebrar o que funciona (diagnóstico, financeiro, parceiros, portal, RLS). Português do Brasil, datas dd/mm/aaaa (America/Sao_Paulo), máscaras CPF e +55 (00) 00000-0000, moedas R$/CLP/USD, filtros e CSV nas listas, auditoria em toda alteração (quem, quando, campo, antes → depois). IA só no servidor e sempre como rascunho editável. Ao final, liste em até 6 linhas o feito e o pendente.

1) CLIENTES
- Ficha única com abas: Dados pessoais, Passaporte e identificação, Família/Dependentes, Casos, Documentos, Financeiro (oculta ao assistente), Comunicação, Portal e LGPD, Histórico.
- Cadastro direto pelo admin/consultor SEM convite, com opção "Enviar convite" e "Liberar acesso ao portal". Convite gera link/WhatsApp com modelo; mostrar status (Não solicitado, Pendente liberação, Liberado).
- Validações: CPF (dígitos verificadores), e-mail, WhatsApp, datas coerentes, passaporte (validade ≥ hoje; alerta se < 12 meses). Detectar duplicidade por CPF, e-mail e WhatsApp e oferecer "mesclar" (mantendo histórico e auditoria).
- Edição e exclusão seguras: exclusão exige confirmação digitada, lista o que será removido (casos, documentos, lançamentos) e oferece "arquivar" como alternativa; tudo auditado. Exclusão definitiva por pedido LGPD gera registro de atendimento.
- Linha do tempo do cliente (diagnóstico, contrato, documentos, pagamentos, mensagens, agendamentos) e botões de contato (wa.me com modelo e log; mailto com log).
- Filtros: status do portal, consultor, subcategoria, etapa, pendências, aniversário do passaporte. Importar CSV (com prévia e validação) e exportar CSV.
- Campos extras: filiação, naturalidade, profissão atual, idiomas, contato de emergência, preferências de contato, observações internas (não visíveis ao cliente).

2) CASOS
- Visão em kanban (15 etapas) e lista, com filtros por consultor, etapa, prioridade, status SERMIG e prazos críticos. Cartão do caso mostra termômetro, próximo prazo, pendências e valor (oculto ao assistente).
- Cabeçalho fixo do caso com: cliente, subcategoria, etapa, status SERMIG, termômetro, próximo prazo e atalhos (documentos, contrato, orçamento, WhatsApp, agenda).
- Mudança de etapa valida pré-requisitos (ex.: não avança para Protocolo sem termômetro ≥ mínimo configurado, contrato assinado e checklist de apostila resolvido; override só admin com justificativa auditada) e cria tarefas padrão da etapa.
- Modelos de caso por tipo de serviço (Mercosul, Definitiva, Prorrogação, Mudança de Subcategoria, Ratificação, Relocation) já com checklist, tarefas, prazos e documentos sugeridos.
- Prazos automáticos: validade de documentos, passaporte, 90 dias para entrada após aprovação, janela de prorrogação (120 a 10 dias antes do vencimento), 180 dias em trâmite (Ley 19.880 art. 27), resposta a requerimento/recurso; com avisos por WhatsApp e botões Google Agenda/.ics.
- Dependentes por caso com vínculo, idade, estudante e documentos próprios; checklist por pessoa.
- Registro de protocolo: número do pedido SERMIG, data, comprovante (upload) e histórico de status com notas.
- Cópia segura de caso (duplicar estrutura sem dados pessoais) e encerramento com motivo, NPS e pasta final (dossiê).
- Parecer Técnico por IA (rascunho confrontado com a Biblioteca Legal; só normas cadastradas, senão "fonte a cadastrar"), editável e salvo como Parecer Oficial com versão.

3) DOCUMENTAÇÃO (DOCUMENTOS DO CASO)
- Cadastro/edição manual na ficha do cliente e no caso: nome, categoria, pessoa (titular/dependente), data de emissão, validade em dias, órgão emissor, exige apostila/tradução, observações e arquivo. Validade calculada automaticamente.
- Upload PDF/JPG/PNG (≤ 10 MB, validar tipo e tamanho), pré-visualização, múltiplos arquivos por documento, versões preservadas e renomeação padronizada PESSOA_DOCUMENTO_AAAA-MM-DD.
- Esteira por pessoa: Aguardando Envio → Recebido/Triagem → Em Conferência → Pendência/Reprovado → Pronto para Apostila/Tradução → Aprovado para Protocolo, com regras automáticas (apostila pendente move para a etapa 5 e cria tarefa; reprovação exige motivo, nova versão e mensagem pronta no WhatsApp).
- Termômetro ponderado (peso 1–5: Aprovado 100%, Enviado/Em análise 40%, demais 0%); nota do caso = menor nota entre titular e dependentes.
- Cronograma inteligente de emissão e "Relação de Documentos Priorizada": sem validade/demorados primeiro (diplomas, certidões de inteiro teor, apostilas), validade curta por último (Antecedentes PF, 60 dias), com data sugerida para tudo estar válido no protocolo; A4 com logo, imprimir/PDF, enviar por WhatsApp e exibir no portal.
- Alertas de vencimento (30/15/7 dias) e "documento vai vencer antes do protocolo".
- Checklist de apostila e tradução imprimível e Pacote de Protocolo SERMIG (índice só com aprovados).
- Ações em lote: aprovar, solicitar complemento, marcar apostilado/traduzido, baixar tudo em ZIP por pessoa.
- Análise por IA opcional (servidor): extrai nome, emissão, órgão, idioma, apostila e legibilidade e SUGERE Aprovar/Revisar/Reprovar; nunca aprova sozinha. Se a IA falhar (503), tentar de novo e permitir seguir manualmente.
- Página "Documentos & Exportação": cards por cliente/caso, termômetro, download individual, Dossiê (PDF) e CSV.

4) CONTRATOS, RECIBOS E DOCUMENTOS GERADOS
- Biblioteca de modelos editáveis (admin): Contrato de Prestação de Serviços de Consultoria Migratória, Aditivo contratual, Recibo de Pagamento, Orçamento Oficial, Relação Priorizada de Documentos, Termo de Ciência de Prazos e Riscos do SERMIG, Carta de Apresentação do Caso, Procuração/Autorização simples, Declaração de Apoio/Residência, Termo de Consentimento LGPD, Termo de Encerramento/Quitação, Notificação de Pendência Documental, Checklist Personalizado.
- Todos com logo, dados institucionais e contatos no cabeçalho; Aviso Legal no rodapé ("Este sistema auxilia a gestão do processo migratório e não substitui a análise individual do consultor; regras e prazos estão sujeitos a alterações pelo SERMIG."); numeração e QR/código de verificação interno; A4 profissional, CSS de impressão, PDF.
- Preenchimento automático pela ficha (nome completo, nacionalidade, estado civil, profissão, CPF, passaporte, endereço, e-mail, WhatsApp, objeto/subcategoria, valor, forma de pagamento, parcelas, dados da empresa, data). Campo vazio vira "[preencher]" destacado e bloqueia finalizar. Cláusulas opcionais ativáveis (ex.: dependentes, parcelamento, custos de terceiros).
- Contrato conforme legislação brasileira (Código Civil e CDC): partes, objeto, escopo e exclusões, obrigações de ambas as partes, honorários x custos de terceiros, forma e prazos de pagamento, obrigação de meio (sem garantia de aprovação pelo SERMIG), prazos estimados, rescisão e reembolso proporcional, confidencialidade e LGPD (Lei 13.709/2018), comunicações, e FORO da Comarca da Capital do Estado do Rio de Janeiro – RJ. Nota interna fixa: "Revisar com advogado antes do uso".
- Recibo discriminando honorários e taxas, moeda, forma de pagamento, data e assinatura; gerado a partir de um lançamento financeiro pago (um clique), com numeração sequencial e valor por extenso.
- Fluxo de status: Rascunho → Revisado → Enviado → Assinado → Arquivado, com data e responsável. Assinatura: campo para anexar o PDF assinado, assinatura desenhada na tela ou link de assinatura externa colado; guardar o arquivo final.
- Editor visual antes de finalizar, histórico versionado (GeneratedDocument), comparação entre versões, reemissão sem perder a anterior e cancelamento com motivo (nunca apagar documento emitido).
- Envio: WhatsApp/e-mail com modelo e registro no log; disponibilizar no Portal do Cliente (aba Documentos) com confirmação de leitura.
- Modelos de mensagem integrados (documento reprovado, cobrança de documentos, protocolo realizado, visto aprovado, lembrete de prazo).
- Textos-base (contrato, recibo, LGPD) editáveis em Configurações, com versionamento e data de vigência.
- Atualização de custos por IA (estimativa rotulada "confirmar na fonte oficial") que só grava após aprovação do admin.

5) PORTAL DO CLIENTE (reflexo dessas melhorias)
- Cliente vê seus documentos solicitados com prioridade e prazo, envia arquivos, acompanha status por documento, baixa contrato/recibo/orçamento enviados, e assina/anexa o contrato assinado quando liberado. Nunca vê observações internas, pareceres não liberados nem dados de outros clientes.

6) SEGURANÇA, LGPD E PERMISSÕES
- Assistente: cadastra/edita clientes e documentos, sem acesso a contrato com valores, recibos, orçamento e financeiro. Consultor: seus casos e financeiro deles. Admin: tudo.
- Regras de acesso por papel e por clientId (Firestore Rules ou RLS), testadas com os 4 perfis. Arquivos em armazenamento com acesso restrito (nunca URL pública). Sanitizar HTML de modelos (sem scripts).
- LGPD: finalidade, retenção configurável, exportação e exclusão a pedido, trilha de acesso a documentos sensíveis (antecedentes, saúde, passaporte).

7) QA E ACEITE
- Fluxo completo: cadastrar cliente sem convite → criar caso por modelo → checklist por pessoa → upload e conferência → apostila → relação priorizada → contrato preenchido pela ficha → recibo de um pagamento → disponibilizar no portal → protocolo → histórico completo.
- Testar com admin, consultor, assistente e cliente; corrigir erros de console, botões sem ação, estados vazios, datas fora de dd/mm/aaaa e textos em inglês.
```

## Observações
- Contratos, aditivos, termo LGPD, procuração e quitação são **modelos**: precisam de revisão de advogado antes do uso com clientes reais (o foro do Rio de Janeiro já está previsto).
- Assinatura desenhada ou arquivo anexado não equivale automaticamente a assinatura eletrônica qualificada; se precisar de validade jurídica reforçada, use um provedor de assinatura eletrônica e anexe o resultado.
- Prazos e regras do SERMIG mudam; mantenha a Biblioteca Legal verificada pelo consultor.
