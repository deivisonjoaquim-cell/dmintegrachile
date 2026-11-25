export type SiteLocale = 'pt-BR' | 'es-CL';

export interface LocalizedPlanCopy {
  kicker: string;
  nome: string;
  subtitulo: string;
  escopoPrefix: string;
  responsavelProtocolo: string;
  inclui: string[];
  cta: string;
  waMessage?: string;
}

export interface LocalizedServiceFallback {
  paraQuem: string;
  subcategoriaTipica: string;
  faixaPrazo: string;
}

export interface SiteTranslations {
  localeLabelShort: string;
  localeLabelFull: string;
  switchToLabel: string;
  switchAriaLabel: string;
  nav: Record<string, string>;
  headerCtaTeam: string;
  headerCtaDiagnostic: string;
  footer: {
    quickAccess: string;
    teamArea: string;
    supportCompliance: string;
    instagramLabel: string;
    linkedinLabel: string;
    lastLegalReview: string;
    defaultSubtitle: string;
    defaultCopyright: string;
    defaultLegalNotice: string;
  };
  mobileBar: {
    diagnosticCta: string;
    whatsappCta: string;
    waGreeting: (brand: string) => string;
  };
  seo: {
    homeTitle: (brand: string) => string;
    homeDescription: string;
    legalModalTitle: string;
  };
  hero: {
    defaultEyebrow: string;
    defaultPrimaryCta: string;
    defaultSecondaryCta: string;
    defaultBadgeTitle: string;
    defaultBadgeSubtitle: string;
    waGreeting: string;
    metric1Value: string;
    metric1Label: string;
    metric2Value: string;
    metric2Label: string;
    metric3Value: string;
    metric3Label: string;
    crestLabel: string;
    crestTagline: string;
    intelModules: Array<{ code: string; label: string; value: string }>;
  };
  techBento: {
    eyebrow: string;
    heading: string;
    subheading: string;
    radarCard: {
      kicker: string;
      title: string;
      description: string;
      pillars: Array<{ label: string; score: string }>;
      cta: string;
    };
    alertsCard: {
      kicker: string;
      title: string;
      description: string;
      rules: Array<{ code: string; title: string; detail: string }>;
    };
    portalCard: {
      kicker: string;
      title: string;
      description: string;
      milestones: string[];
      primaryCta: string;
      secondaryCta: string;
    };
  };
  services: {
    defaultEyebrow: string;
    solutionPrefix: string;
    learnMore: string;
    plansKicker: string;
    plansTitle: string;
    plansSubtitlePrefix: string;
    plansOrientativaBold: string;
    plansOrientativaDesc: string;
    plansCompletaBold: string;
    plansCompletaDesc: string;
    plans: {
      diagnostico_gratuito: LocalizedPlanCopy;
      orientativa: LocalizedPlanCopy;
      completa: LocalizedPlanCopy;
    };
    drawer: {
      headerPrefix: string;
      closeLabel: string;
      whoFor: string;
      framework: string;
      timeline: string;
      defaultWhoFor: string;
      defaultFramework: string;
      defaultTimeline: string;
      ctaDiagnostic: string;
      ctaWhatsapp: string;
      waGreeting: (serviceTitle: string) => string;
    };
    fallbackDetails: Record<string, LocalizedServiceFallback>;
  };
  comparator: {
    kicker: string;
    title: string;
    subtitle: string;
    labelWhere: string;
    whereOptions: {
      brasil: string;
      turista_chile: string;
      residente_chile: string;
    };
    labelGoal: string;
    goalOptions: {
      morar_trabalhar: string;
      trabalho_oferta: string;
      estudar: string;
      renda: string;
      familia: string;
    };
    labelTie: string;
    tieOptions: {
      nao: string;
      sim: string;
    };
    resultKicker: string;
    dtProtocol: string;
    dtWork: string;
    dtReference: string;
    ctaValidate: string;
    routes: {
      residente: {
        titulo: string;
        baseLegal: string;
        protocoloRegra: string;
        trabalho: string;
        prazoEstimado: string;
        resumo: string;
        alerta: string;
      };
      familia: {
        titulo: string;
        baseLegal: string;
        protocoloTurista: string;
        protocoloExterior: string;
        trabalho: string;
        prazoEstimado: string;
        resumo: string;
        alertaTurista: string;
      };
      trabalho: {
        titulo: string;
        baseLegal: string;
        protocoloRegra: string;
        trabalho: string;
        prazoEstimado: string;
        resumo: string;
        alertaTurista: string;
      };
      estudar: {
        titulo: string;
        baseLegal: string;
        protocoloRegra: string;
        trabalho: string;
        prazoEstimado: string;
        resumo: string;
        alertaTurista: string;
      };
      renda: {
        titulo: string;
        baseLegal: string;
        protocoloRegra: string;
        trabalho: string;
        prazoEstimado: string;
        resumo: string;
        alertaTurista: string;
      };
      mercosul: {
        titulo: string;
        baseLegal: string;
        protocoloRegra: string;
        trabalho: string;
        prazoEstimado: string;
        resumo: string;
        alertaTurista: string;
      };
    };
  };
  sections: {
    diferenciaisEyebrow: string;
    understandLawCta: string;
    quemSomosEyebrow: string;
    quemSomosCta: string;
    partnersFallbackTitle: string;
    partnersFallbackSubtitle: string;
    partnersDefaultCta: string;
    contatoKicker: string;
    contatoDefaultCta: string;
    contatoWhatsappCta: string;
    contatoScheduleCta: string;
  };
}

export const SITE_TRANSLATIONS: Record<SiteLocale, SiteTranslations> = {
  'pt-BR': {
    localeLabelShort: 'PT-BR',
    localeLabelFull: 'Português (Brasil)',
    switchToLabel: 'ES-CL',
    switchAriaLabel: 'Traduzir site para Espanhol Chileno',
    nav: {
      '/': 'Início',
      '/quem-somos': 'Quem Somos',
      '/parceiros': 'Parceiros',
      '/diagnostico': 'Diagnóstico',
      '/acompanhar': 'Portal do Cliente',
    },
    headerCtaTeam: 'Área da Equipe',
    headerCtaDiagnostic: 'Diagnóstico Gratuito',
    footer: {
      quickAccess: 'Acesso rápido',
      teamArea: 'Área da Equipe',
      supportCompliance: 'Atendimento & Conformidade',
      instagramLabel: 'Instagram oficial',
      linkedinLabel: 'LinkedIn',
      lastLegalReview: 'Última revisão normativa registrada:',
      defaultSubtitle: 'Consultoria especializada em imigração e relocation Brasil–Chile.',
      defaultCopyright: 'Todos os direitos reservados.',
      defaultLegalNotice:
        'As informações e ferramentas desta plataforma auxiliam o acompanhamento do processo migratório e não substituem a análise individualizada de cada caso. Normas e prazos estão sujeitos a atualizações pelo SERMIG.',
    },
    mobileBar: {
      diagnosticCta: 'Diagnóstico Inteligente',
      whatsappCta: 'WhatsApp',
      waGreeting: (brand) => `Olá! Vim pelo site da ${brand} e gostaria de tirar uma dúvida.`,
    },
    seo: {
      homeTitle: (brand) => `${brand} — Imigração e Relocation Brasil–Chile`,
      homeDescription:
        'Assessoria especializada em imigração, Acordo Mercosul, Residência Temporal e Definitiva no Chile com diagnóstico inteligente e acompanhamento digital.',
      legalModalTitle: 'Legislação Chilena, Brasileira e Mercosul — em linguagem clara',
    },
    hero: {
      defaultEyebrow: 'Assessoria Migratória Brasil – Chile · Ley 21.325 & Acordo Mercosul',
      defaultPrimaryCta: 'Fazer Diagnóstico Inteligente',
      defaultSecondaryCta: 'Falar no WhatsApp',
      defaultBadgeTitle: 'Operação Brasil & Santiago',
      defaultBadgeSubtitle: 'Segurança documental do protocolo SERMIG ao Estampado Electrónico',
      waGreeting: 'Olá! Gostaria de receber informações sobre assessoria migratória para o Chile.',
      metric1Value: '6 Etapas',
      metric1Label: 'Diagnóstico inteligente ao vivo',
      metric2Value: '7 Pilares',
      metric2Label: 'Radar técnico + simulador',
      metric3Value: 'PDF 2 Págs',
      metric3Label: 'Dossiê executivo exportável',
      crestLabel: 'Plataforma D&M Integra Chile',
      crestTagline: 'Arquitetura jurídica & tecnológica para sua residência',
      intelModules: [
        { code: '01', label: 'Motor Normativo', value: 'Ley 21.325 · Dec. 177' },
        { code: '02', label: 'Alertas de Vistos', value: 'Monitoramento 30 dias' },
        { code: '03', label: 'Portal do Cliente', value: '15 Etapas + Dossiê PDF' },
      ],
    },
    techBento: {
      eyebrow: 'Tecnologia Aplicada à Imigração',
      heading: 'Inteligência normativa, controle de prazos e visibilidade total do seu processo',
      subheading:
        'Unimos rigor jurídico na Ley Nº 21.325 a uma infraestrutura digital própria que antecipa riscos documentais e elimina incertezas em cada fase.',
      radarCard: {
        kicker: 'Motor de Diagnóstico Inteligente',
        title: 'Radar de 7 Pilares & Dossiê PDF Executivo em minutos',
        description:
          'Responda às 6 etapas estruturadas e visualize sua prontidão migratória em tempo real, com simulação de cenários, subcategorias elegíveis e relatório em PDF de 2 páginas com a identidade oficial da consultoria.',
        pillars: [
          { label: 'Subcategorias Decreto 177/2022', score: '16' },
          { label: 'Ponderação técnica 0–100', score: '7 Pilares' },
          { label: 'Controle PF & Apostila CNJ', score: '60 dias' },
          { label: 'Dossiê PDF Executivo', score: '2 Págs' },
        ],
        cta: 'Iniciar Diagnóstico Completo',
      },
      alertsCard: {
        kicker: 'Prevenção Automática de Prazos',
        title: 'Alertas proativos 30 dias antes de qualquer vencimento',
        description:
          'Monitoramento contínuo de vistos, residências, Estampado Electrónico e certidões críticas para proteger sua regularidade no Chile.',
        rules: [
          {
            code: '30d',
            title: 'Vistos & Residência',
            detail: 'Notificação automática por e-mail antes do vencimento da janela legal.',
          },
          {
            code: '60d',
            title: 'Antecedentes PF',
            detail: 'Cronograma reverso para que a certidão não expire antes do protocolo.',
          },
          {
            code: '90d',
            title: 'Estampado Electrónico',
            detail: 'Controle rigoroso do ingresso no Chile, PDI e Cédula no Registro Civil.',
          },
        ],
      },
      portalCard: {
        kicker: 'Portal do Cliente & Acompanhamento',
        title: 'Jornada auditada em 15 etapas — do Brasil à sua Cédula de Identidade no Chile',
        description:
          'Acompanhe o termômetro de prontidão documental, converse direto com o consultor responsável em cada certidão e visualize o status real de protocolo e pós-chegada em um único ambiente seguro.',
        milestones: [
          'Enquadramento Normativo',
          'Apostila CNJ & Tradução',
          'Protocolo SERMIG',
          'Estampado · PDI · Cédula',
        ],
        primaryCta: 'Acessar Portal do Cliente',
        secondaryCta: 'Iniciar Diagnóstico',
      },
    },
    services: {
      defaultEyebrow: 'Serviços especializados',
      solutionPrefix: 'Solução migratória',
      learnMore: 'Saiba mais sobre esta etapa',
      plansKicker: 'Modelos de contratação',
      plansTitle: 'Escolha o nível de acompanhamento ideal para o seu processo',
      plansSubtitlePrefix: 'Comece pela análise inicial gratuita e avance para a ',
      plansOrientativaBold: 'Consultoria Orientativa',
      plansOrientativaDesc: ' (você executa o protocolo com nossa revisão técnica) ou para a ',
      plansCompletaBold: 'Consultoria Completa',
      plansCompletaDesc: ' (nós conduzimos todo o processo do início ao fim).',
      plans: {
        diagnostico_gratuito: {
          kicker: 'Etapa inicial · Gratuito · PDF incluso',
          nome: 'Diagnóstico Inteligente Gratuito',
          subtitulo: 'Pré-análise normativa automatizada em 6 etapas com radar de 7 pilares e dossiê PDF.',
          escopoPrefix: 'Escopo:',
          responsavelProtocolo: 'Análise preliminar gratuita (sem compromisso)',
          inclui: [
            'Enquadramento na Ley Nº 21.325 e Acordo Mercosul',
            'Radar ao vivo dos 7 pilares de prontidão migratória',
            'Simulador interativo de cenários e prazos estimados',
            'Exportação imediata do Dossiê Executivo em PDF (2 páginas)',
          ],
          cta: 'Iniciar Diagnóstico Completo',
        },
        orientativa: {
          kicker: 'Modalidade 01 · Direcionamento técnico',
          nome: 'Consultoria Orientativa',
          subtitulo: 'Você protocola no portal SERMIG com nossa estratégia, checklist e conferência técnica.',
          escopoPrefix: 'Execução:',
          responsavelProtocolo: 'Cliente executa com revisão técnica da D&M Integra Chile',
          inclui: [
            'Reunião individual de enquadramento e cronograma reverso',
            'Checklist personalizado + revisão documental via Portal do Cliente',
            'Orientação de Apostila de Haia (CNJ) e tradução juramentada',
            'Passo a passo guiado para protocolo SERMIG e pós-chegada',
          ],
          cta: 'Solicitar Consultoria Orientativa',
          waMessage:
            'Olá! Tenho interesse na Consultoria Orientativa (eu conduzo o protocolo com a orientação e revisão técnica de vocês). Podem me enviar os detalhes?',
        },
        completa: {
          kicker: 'Modalidade 02 · Gestão integral',
          nome: 'Consultoria Completa',
          subtitulo: 'Condução ponta a ponta do seu processo migratório e relocation no Chile.',
          escopoPrefix: 'Execução:',
          responsavelProtocolo: 'Equipe D&M Integra Chile conduz do início ao fim',
          inclui: [
            'Tudo da Consultoria Orientativa + gestão integral de prazos',
            'Coordenação de cartórios, Apostila de Haia e tradutores homologados',
            'Montagem completa, protocolo SERMIG e resposta a eventuais exigências',
            'Suporte no Estampado Electrónico, PDI, Cédula, ClaveÚnica e RUT',
          ],
          cta: 'Solicitar Consultoria Completa',
          waMessage:
            'Olá! Tenho interesse na Consultoria Completa (onde vocês conduzem todo o meu processo migratório no Chile do início ao fim). Podem me enviar proposta?',
        },
      },
      drawer: {
        headerPrefix: 'Assessoria Migratória',
        closeLabel: 'Fechar detalhes do serviço',
        whoFor: 'Para quem é indicado',
        framework: 'Enquadramento e documentos típicos',
        timeline: 'Faixa referencial de prazos',
        defaultWhoFor: 'Avaliado individualmente no diagnóstico.',
        defaultFramework: 'Conforme normativa vigente SERMIG.',
        defaultTimeline: 'Definido conforme fila do SERMIG.',
        ctaDiagnostic: 'Fazer Diagnóstico para Este Serviço',
        ctaWhatsapp: 'Consultar no WhatsApp',
        waGreeting: (title) => `Olá! Gostaria de saber mais sobre o serviço: ${title}.`,
      },
      fallbackDetails: {
        '01': {
          paraQuem: 'Brasileiros que planejam morar, trabalhar ou empreender no Chile (com ou sem oferta prévia).',
          subcategoriaTipica: 'Subcategoria 15 (Acordo Mercosul) ou Subcategorias 01, 02, 03, 11 e 13',
          faixaPrazo: 'Preparação: 15–35 dias · Análise SERMIG: 3–8 meses em média',
        },
        '02': {
          paraQuem: 'Quem já possui Residência Temporal no Chile e precisa prorrogar, alterar vínculo ou pedir a Definitiva.',
          subcategoriaTipica: 'Prorrogação / Mudança de Subcategoria / Residência Definitiva (24m)',
          faixaPrazo: 'Janela legal: 90 a 10 dias antes do vencimento da residência atual',
        },
        '03': {
          paraQuem: 'Pessoas e famílias que querem evitar indeferimentos ou vencimento de Antecedentes PF (60 dias).',
          subcategoriaTipica: 'Certidões civis, Polícia Federal, Apostila de Haia (CNJ) e tradução',
          faixaPrazo: 'Cronograma reverso ajustado à data prevista do protocolo',
        },
        '04': {
          paraQuem: 'Recém-aprovados que vão ingressar no Chile para cumprir registro PDI e Cédula.',
          subcategoriaTipica: 'Estampado Electrónico, Registro PDI, Cédula Civil, ClaveÚnica e RUT',
          faixaPrazo: 'Ingresso até 90 dias após Estampado + agendamentos em Santiago',
        },
      },
    },
    comparator: {
      kicker: 'Simulador Orientativo · Ley Nº 21.325 & SERMIG',
      title: 'Qual caminho serve para mim?',
      subtitle:
        'Simule em 3 seleções rápidas a rota migratória, base normativa e regra de protocolo aplicáveis antes de iniciar o diagnóstico completo com radar de 7 pilares.',
      labelWhere: 'Onde você está?',
      whereOptions: {
        brasil: 'No Brasil / Exterior',
        turista_chile: 'No Chile como turista',
        residente_chile: 'Já resido no Chile',
      },
      labelGoal: 'Principal objetivo',
      goalOptions: {
        morar_trabalhar: 'Morar / Empreender (BR)',
        trabalho_oferta: 'Contrato formal no Chile',
        estudar: 'Estudar no Chile',
        renda: 'Aposentado / Rentista',
        familia: 'Reunir com familiar no Chile',
      },
      labelTie: 'Vínculo formal no Chile?',
      tieOptions: {
        nao: 'Não possuo',
        sim: 'Sim (cônjuge / filho chileno)',
      },
      resultKicker: 'Rota indicativa preliminar',
      dtProtocol: 'Protocolo:',
      dtWork: 'Trabalho:',
      dtReference: 'Referência:',
      ctaValidate: 'Validar meu caso no Diagnóstico Completo',
      routes: {
        residente: {
          titulo: 'Prorrogação ou Residência Definitiva',
          baseLegal: 'Ley Nº 21.325 · Arts. 78–80 · Decreto Nº 177/2022',
          protocoloRegra: 'Portal SERMIG dentro do Chile',
          trabalho: 'Mantém direito laboral vigente',
          prazoEstimado: 'Janela legal: 90 a 10 dias antes do vencimento',
          resumo:
            'Avaliamos seu tempo de residência vigente, contagem de ausências do território chileno e enquadramento para Residência Definitiva.',
          alerta:
            'Mantenha o protocolo estritamente dentro da janela de 90 a 10 dias antes do vencimento para preservar a regularidade migratória.',
        },
        familia: {
          titulo: 'Reunificação Familiar (Subcategoria 01)',
          baseLegal: 'Ley Nº 21.325 · Art. 19 · Decreto Nº 177/2022 (Subcat. 01)',
          protocoloTurista: 'Pode ser avaliada dentro do Chile (se vínculo formalizado)',
          protocoloExterior: 'Exterior ou território chileno (conforme registro)',
          trabalho: 'Autoriza trabalho lícito após Estampado',
          prazoEstimado: 'Preparação 15–30d · SERMIG 3–7 meses',
          resumo:
            'Com vínculo formalizado (casamento, Acordo de União Civil ou filho chileno), permite análise inclusive para quem já está no Chile.',
          alertaTurista:
            'Se o vínculo ainda não estiver formalizado em registro civil, aplica-se a regra geral de protocolo pelo exterior (Mercosul).',
        },
        trabalho: {
          titulo: 'Mercosul (Cód. 15) vs. Atividades Lícitas (Cód. 02)',
          baseLegal: 'Acordo Mercosul (Dec. BR 6.975/2009) vs. Dec. 177/2022 (Subcat. 02)',
          protocoloRegra: 'Protocolo obrigatório do exterior (fora do Chile)',
          trabalho: 'Mercosul: livre · Cód. 02: exige contrato formal',
          prazoEstimado: 'Preparação 15–30d · SERMIG 3–8 meses',
          resumo:
            'Para brasileiros, o Acordo Mercosul costuma oferecer maior liberdade laboral (sem vínculo a único empregador); comparamos ambos no diagnóstico.',
          alertaTurista: 'Protocolo inicial exige saída prévia do território chileno.',
        },
        estudar: {
          titulo: 'Mercosul (Cód. 15) vs. Estudantes (Cód. 03)',
          baseLegal: 'Acordo Mercosul (Subcat. 15) vs. Dec. 177/2022 (Subcat. 03)',
          protocoloRegra: 'Protocolo do exterior (fora do Chile)',
          trabalho: 'Mercosul: integral · Estudante: até 30h/sem',
          prazoEstimado: 'Preparação 15–30d · SERMIG 3–7 meses',
          resumo:
            'Quem tem nacionalidade brasileira pode optar pelo Mercosul (acesso irrestrito ao mercado de trabalho e caminho direto à Definitiva) ou Visto de Estudante.',
          alertaTurista: 'Solicitação inicial feita fora do território chileno.',
        },
        renda: {
          titulo: 'Mercosul (Cód. 15) ou Aposentados/Rentistas (Cód. 11)',
          baseLegal: 'Acordo Mercosul (Subcat. 15) vs. Dec. 177/2022 (Subcat. 11)',
          protocoloRegra: 'Protocolo do exterior (fora do Chile)',
          trabalho: 'Mercosul: liberado · Rentista: renda passiva',
          prazoEstimado: 'Preparação 15–35d · SERMIG 3–8 meses',
          resumo:
            'Avaliamos se a comprovação de renda passiva/aposentadoria agrega vantagem ou se a via Mercosul simplifica a documentação e a Apostila CNJ.',
          alertaTurista: 'Regra geral da Ley 21.325 exige envio do pedido fora do Chile.',
        },
        mercosul: {
          titulo: 'Acordo Mercosul — Subcategoria 15',
          baseLegal: 'Decreto BR Nº 6.975/2009 · Ley Nº 21.325 · Dec. 177/2022',
          protocoloRegra: 'Protocolo 100% digital a partir do Brasil/Exterior',
          trabalho: 'Trabalho formal, autônomo ou empresa liberados',
          prazoEstimado: 'Antecedentes PF (60d) · SERMIG 3–8 meses',
          resumo:
            'Principal caminho para brasileiros: não exige oferta prévia de emprego nem comprovação de renda, com acesso direto à Residência Definitiva após 24 meses.',
          alertaTurista:
            'Atenção: estando como turista no Chile sem vínculo formalizado, a Ley 21.325 exige saída do país para protocolar a Subcategoria 15.',
        },
      },
    },
    sections: {
      diferenciaisEyebrow: 'Metodologia operacional',
      understandLawCta: 'Entenda a Lei (Resumo acessível para clientes)',
      quemSomosEyebrow: 'Quem Somos',
      quemSomosCta: 'Conhecer trajetória e credenciais',
      partnersFallbackTitle: 'Parceiros recomendados',
      partnersFallbackSubtitle:
        'Rede homologada no Brasil e no Chile para apostilamentos, traduções juramentadas e relocation.',
      partnersDefaultCta: 'Ver todos e Seja um Parceiro',
      contatoKicker: 'Próximo Passo',
      contatoDefaultCta: 'Iniciar Diagnóstico Agora',
      contatoWhatsappCta: 'Atendimento via WhatsApp',
      contatoScheduleCta: 'Agendar Conversa',
    },
  },

  'es-CL': {
    localeLabelShort: 'ES-CL',
    localeLabelFull: 'Español (Chile)',
    switchToLabel: 'PT-BR',
    switchAriaLabel: 'Cambiar idioma a Portugués de Brasil',
    nav: {
      '/': 'Inicio',
      '/quem-somos': 'Quiénes Somos',
      '/parceiros': 'Red de Aliados',
      '/diagnostico': 'Diagnóstico',
      '/acompanhar': 'Portal del Cliente',
    },
    headerCtaTeam: 'Área del Equipo',
    headerCtaDiagnostic: 'Diagnóstico Gratuito',
    footer: {
      quickAccess: 'Acceso rápido',
      teamArea: 'Área del Equipo',
      supportCompliance: 'Atención y Cumplimiento',
      instagramLabel: 'Instagram oficial',
      linkedinLabel: 'LinkedIn',
      lastLegalReview: 'Última revisión normativa registrada:',
      defaultSubtitle: 'Asesoría especializada en migración y relocation Brasil–Chile.',
      defaultCopyright: 'Todos los derechos reservados.',
      defaultLegalNotice:
        'La información y herramientas de esta plataforma apoyan el seguimiento del trámite migratorio y no reemplazan la evaluación individual de cada caso. Normas y plazos están sujetos a actualización por el SERMIG.',
    },
    mobileBar: {
      diagnosticCta: 'Diagnóstico Inteligente',
      whatsappCta: 'WhatsApp',
      waGreeting: (brand) => `¡Hola! Escribo desde el sitio web de ${brand} y quisiera hacer una consulta sobre residencia en Chile.`,
    },
    seo: {
      homeTitle: (brand) => `${brand} — Migración, Visas y Relocation en Chile`,
      homeDescription:
        'Asesoría especializada en Ley Nº 21.325, Acuerdo Mercosur, Residencia Temporal, Residencia Definitiva y Cédula de Identidad en Chile.',
      legalModalTitle: 'Legislación Chilena, Brasileña y Acuerdo Mercosur — en lenguaje claro',
    },
    hero: {
      defaultEyebrow: 'Asesoría Migratoria Brasil – Chile · Ley Nº 21.325 y Acuerdo Mercosur',
      defaultPrimaryCta: 'Hacer Diagnóstico Inteligente',
      defaultSecondaryCta: 'Hablar por WhatsApp',
      defaultBadgeTitle: 'Operación Brasil y Santiago de Chile',
      defaultBadgeSubtitle: 'Seguridad documental desde la postulación SERMIG hasta el Estampado Electrónico',
      waGreeting: '¡Hola! Quisiera recibir orientación sobre asesoría migratoria y residencia en Chile.',
      metric1Value: '6 Etapas',
      metric1Label: 'Diagnóstico inteligente en vivo',
      metric2Value: '7 Pilares',
      metric2Label: 'Radar técnico y simulador',
      metric3Value: 'PDF 2 Págs',
      metric3Label: 'Informe ejecutivo descargable',
      crestLabel: 'Plataforma D&M Integra Chile',
      crestTagline: 'Arquitectura normativa y tecnológica para tu residencia',
      intelModules: [
        { code: '01', label: 'Motor Normativo', value: 'Ley 21.325 · D.S. 177' },
        { code: '02', label: 'Alertas de Visas', value: 'Aviso automático 30 días' },
        { code: '03', label: 'Portal del Cliente', value: '15 Hitos + Dossier PDF' },
      ],
    },
    techBento: {
      eyebrow: 'Tecnología Aplicada a la Migración',
      heading: 'Inteligencia normativa, control de plazos y trazabilidad total de tu trámite en Chile',
      subheading:
        'Combinamos criterio jurídico bajo la Ley Nº 21.325 con una plataforma digital propia que anticipa observaciones del SERMIG y evita vencimientos documentales.',
      radarCard: {
        kicker: 'Motor de Diagnóstico Inteligente',
        title: 'Radar de 7 Pilares y Dossier Ejecutivo en PDF en minutos',
        description:
          'Completa 6 etapas guiadas y revisa tu nivel de preparación migratoria en tiempo real, con simulador de escenarios, subcategorías aplicables e informe PDF de 2 páginas con respaldo institucional.',
        pillars: [
          { label: 'Subcategorías Decreto 177/2022', score: '16' },
          { label: 'Ponderación técnica 0–100', score: '7 Pilares' },
          { label: 'Vigencia Antecedentes y Apostilla', score: '60 días' },
          { label: 'Dossier PDF Ejecutivo', score: '2 Págs' },
        ],
        cta: 'Iniciar Diagnóstico Completo',
      },
      alertsCard: {
        kicker: 'Prevención Automática de Vencimientos',
        title: 'Alertas proactivas 30 días antes del vencimiento de visas y documentos',
        description:
          'Monitoreo continuo de Residencia Temporal, Estampado Electrónico y certificados críticos para cuidar tu situación migratoria regular en Chile.',
        rules: [
          {
            code: '30d',
            title: 'Visas y Residencia',
            detail: 'Aviso automático por correo antes del vencimiento y dentro de la ventana legal.',
          },
          {
            code: '60d',
            title: 'Antecedentes Penales',
            detail: 'Cronograma inverso para que el certificado apostillado no caduque antes de postular.',
          },
          {
            code: '90d',
            title: 'Estampado Electrónico',
            detail: 'Control estricto del ingreso a Chile, registro PDI y Cédula en el Registro Civil.',
          },
        ],
      },
      portalCard: {
        kicker: 'Portal del Cliente y Seguimiento',
        title: 'Proceso auditado en 15 hitos — desde el extranjero hasta tu Cédula de Identidad chilena',
        description:
          'Revisa el termómetro de documentos, resuelve dudas directamente con tu asesor en cada certificado y sigue el avance real de tu postulación ante el SERMIG en un solo lugar.',
        milestones: [
          'Encuadre Normativo',
          'Apostilla y Traducción',
          'Postulación SERMIG',
          'Estampado · PDI · Cédula',
        ],
        primaryCta: 'Ingresar al Portal del Cliente',
        secondaryCta: 'Iniciar Diagnóstico',
      },
    },
    services: {
      defaultEyebrow: 'Servicios especializados',
      solutionPrefix: 'Solución migratoria',
      learnMore: 'Ver detalles de esta etapa',
      plansKicker: 'Modalidades de asesoría',
      plansTitle: 'Elige el nivel de acompañamiento adecuado para tu trámite en Chile',
      plansSubtitlePrefix: 'Parte con la evaluación gratuita y avanza a la ',
      plansOrientativaBold: 'Asesoría Orientativa',
      plansOrientativaDesc: ' (tú presentas la solicitud en SERMIG con nuestra revisión técnica) o a la ',
      plansCompletaBold: 'Asesoría Completa',
      plansCompletaDesc: ' (gestionamos todo el proceso migratorio de principio a fin).',
      plans: {
        diagnostico_gratuito: {
          kicker: 'Etapa inicial · Gratis · PDF incluido',
          nome: 'Diagnóstico Inteligente Gratuito',
          subtitulo: 'Preanálisis normativo en 6 etapas con radar de 7 pilares y dossier PDF ejecutivo.',
          escopoPrefix: 'Alcance:',
          responsavelProtocolo: 'Evaluación preliminar gratuita (sin compromiso)',
          inclui: [
            'Encuadre según Ley Nº 21.325 y Acuerdo Mercosur',
            'Radar en vivo de los 7 pilares de preparación migratoria',
            'Simulador interactivo de escenarios y plazos referenciales',
            'Descarga inmediata del Dossier Ejecutivo en PDF (2 páginas)',
          ],
          cta: 'Iniciar Diagnóstico Completo',
        },
        orientativa: {
          kicker: 'Modalidad 01 · Guía técnica especializada',
          nome: 'Asesoría Orientativa',
          subtitulo: 'Postulas en el portal SERMIG con nuestra estrategia, checklist y validación documental.',
          escopoPrefix: 'Ejecución:',
          responsavelProtocolo: 'El cliente postula con revisión técnica de D&M Integra Chile',
          inclui: [
            'Sesión individual de estrategia y cronograma inverso de certificados',
            'Checklist a medida + revisión documental en el Portal del Cliente',
            'Guía de Apostilla de La Haya y traducciones certificadas',
            'Instructivo paso a paso para postulación SERMIG y llegada a Chile',
          ],
          cta: 'Solicitar Asesoría Orientativa',
          waMessage:
            '¡Hola! Me interesa la Asesoría Orientativa (yo presento la solicitud con la orientación y revisión técnica de ustedes). ¿Me pueden enviar los detalles?',
        },
        completa: {
          kicker: 'Modalidad 02 · Gestión integral',
          nome: 'Asesoría Completa',
          subtitulo: 'Gestión de extremo a extremo de tu residencia y relocation en Chile.',
          escopoPrefix: 'Ejecución:',
          responsavelProtocolo: 'El equipo de D&M Integra Chile conduce todo el trámite',
          inclui: [
            'Todo lo de la Asesoría Orientativa + control integral de plazos',
            'Coordinación de notarías, Apostilla de La Haya y traductores validados',
            'Armado del expediente, postulación SERMIG y respuesta a subsanaciones',
            'Apoyo en Estampado Electrónico, PDI, Cédula Civil, ClaveÚnica y RUT',
          ],
          cta: 'Solicitar Asesoría Completa',
          waMessage:
            '¡Hola! Me interesa la Asesoría Completa (donde ustedes conducen todo mi trámite migratorio en Chile de principio a fin). ¿Me pueden enviar una propuesta?',
        },
      },
      drawer: {
        headerPrefix: 'Asesoría Migratoria',
        closeLabel: 'Cerrar detalles del servicio',
        whoFor: '¿Para quién está indicado?',
        framework: 'Encuadre y documentación habitual',
        timeline: 'Plazos referenciales',
        defaultWhoFor: 'Evaluado de forma individual en el diagnóstico.',
        defaultFramework: 'Según normativa vigente del SERMIG.',
        defaultTimeline: 'Sujeto a los tiempos de tramitación del SERMIG.',
        ctaDiagnostic: 'Hacer Diagnóstico para Este Servicio',
        ctaWhatsapp: 'Consultar por WhatsApp',
        waGreeting: (title) => `¡Hola! Quisiera conocer más detalles sobre el servicio: ${title}.`,
      },
      fallbackDetails: {
        '01': {
          paraQuem: 'Ciudadanos brasileños que planean vivir, trabajar o emprender en Chile (con o sin oferta laboral previa).',
          subcategoriaTipica: 'Subcategoría 15 (Acuerdo Mercosur) o Subcategorías 01, 02, 03, 11 y 13',
          faixaPrazo: 'Preparación: 15–35 días · Revisión SERMIG: 3–8 meses aprox.',
        },
        '02': {
          paraQuem: 'Quienes ya cuentan con Residencia Temporal en Chile y necesitan prorrogar, cambiar subcategoría o pedir la Definitiva.',
          subcategoriaTipica: 'Prórroga / Cambio de Subcategoría / Residencia Definitiva (24m)',
          faixaPrazo: 'Ventana legal: entre 90 y 10 días antes del vencimiento vigente',
        },
        '03': {
          paraQuem: 'Personas y familias que buscan evitar rechazos o caducidad de Antecedentes Penales (60 días).',
          subcategoriaTipica: 'Certificados civiles, Policía Federal, Apostilla de La Haya y traducción',
          faixaPrazo: 'Cronograma inverso ajustado a la fecha prevista de postulación',
        },
        '04': {
          paraQuem: 'Residences aprobados que ingresarán a Chile para completar registro PDI y Cédula.',
          subcategoriaTipica: 'Estampado Electrónico, Registro PDI, Cédula de Identidad, ClaveÚnica y RUT',
          faixaPrazo: 'Ingreso hasta 90 días tras el Estampado + citas en Santiago',
        },
      },
    },
    comparator: {
      kicker: 'Simulador Orientativo · Ley Nº 21.325 y SERMIG',
      title: '¿Qué vía migratoria aplica para mí?',
      subtitle:
        'Simula en 3 selecciones rápidas la ruta migratoria, la base legal y la regla de postulación antes de iniciar el diagnóstico completo con radar de 7 pilares.',
      labelWhere: '¿Dónde te encuentras?',
      whereOptions: {
        brasil: 'En Brasil / Extranjero',
        turista_chile: 'En Chile con permanencia transitoria (turista)',
        residente_chile: 'Ya resido en Chile',
      },
      labelGoal: 'Objetivo principal',
      goalOptions: {
        morar_trabalhar: 'Vivir / Emprender (Mercosur)',
        trabalho_oferta: 'Contrato formal en Chile',
        estudar: 'Estudiar en Chile',
        renda: 'Jubilado / Rentista',
        familia: 'Reunificación familiar en Chile',
      },
      labelTie: '¿Vínculo formal en Chile?',
      tieOptions: {
        nao: 'No poseo vínculo',
        sim: 'Sí (cónyuge / hijo chileno)',
      },
      resultKicker: 'Ruta orientativa preliminar',
      dtProtocol: 'Postulación:',
      dtWork: 'Trabajo:',
      dtReference: 'Referencia:',
      ctaValidate: 'Validar mi caso en el Diagnóstico Completo',
      routes: {
        residente: {
          titulo: 'Prórroga o Residencia Definitiva',
          baseLegal: 'Ley Nº 21.325 · Arts. 78–80 · Decreto Nº 177/2022',
          protocoloRegra: 'Portal SERMIG desde dentro de Chile',
          trabalho: 'Mantiene permiso laboral vigente',
          prazoEstimado: 'Ventana legal: 90 a 10 días antes del vencimiento',
          resumo:
            'Revisamos tu vigencia actual, el conteo de ausencias fuera de Chile y el cumplimiento de requisitos para postular a la Residencia Definitiva.',
          alerta:
            'Presenta la solicitud estrictamente dentro de la ventana de 90 a 10 días previos al vencimiento para mantener tu situación regular.',
        },
        familia: {
          titulo: 'Reunificación Familiar (Subcategoría 01)',
          baseLegal: 'Ley Nº 21.325 · Art. 19 · Decreto Nº 177/2022 (Subcat. 01)',
          protocoloTurista: 'Puede evaluarse dentro de Chile (si el vínculo está formalizado)',
          protocoloExterior: 'Extranjero o territorio chileno (según inscripción)',
          trabalho: 'Habilita trabajo lícito tras el Estampado',
          prazoEstimado: 'Preparación 15–30d · SERMIG 3–7 meses',
          resumo:
            'Con vínculo debidamente inscrito (matrimonio, Acuerdo de Unión Civil o hijo chileno), permite evaluación incluso estando en territorio chileno.',
          alertaTurista:
            'Si el vínculo aún no figura inscrito en el Registro Civil, aplica la regla general de postulación desde el extranjero (Mercosur).',
        },
        trabalho: {
          titulo: 'Mercosur (Cód. 15) vs. Actividades Lícitas (Cód. 02)',
          baseLegal: 'Acuerdo Mercosur vs. Decreto Nº 177/2022 (Subcat. 02)',
          protocoloRegra: 'Postulación obligatoria desde el extranjero',
          trabalho: 'Mercosur: libre · Cód. 02: exige contrato formal',
          prazoEstimado: 'Preparación 15–30d · SERMIG 3–8 meses',
          resumo:
            'Para ciudadanos brasileños, el Acuerdo Mercosur suele entregar mayor flexibilidad laboral (sin atarte a un único empleador); comparamos ambas vías en tu diagnóstico.',
          alertaTurista: 'La primera solicitud exige encontrarse fuera del territorio chileno.',
        },
        estudar: {
          titulo: 'Mercosur (Cód. 15) vs. Estudiantes (Cód. 03)',
          baseLegal: 'Acuerdo Mercosur (Subcat. 15) vs. Dec. 177/2022 (Subcat. 03)',
          protocoloRegra: 'Postulación desde el extranjero',
          trabalho: 'Mercosur: jornada completa · Estudiante: hasta 30h/sem',
          prazoEstimado: 'Preparación 15–30d · SERMIG 3–7 meses',
          resumo:
            'Quienes tienen nacionalidad brasileña pueden optar por Mercosur (acceso laboral sin tope de horas y ruta directa a la Definitiva) o Residencia de Estudiante.',
          alertaTurista: 'La solicitud inicial debe enviarse fuera de Chile.',
        },
        renda: {
          titulo: 'Mercosur (Cód. 15) o Jubilados/Rentistas (Cód. 11)',
          baseLegal: 'Acuerdo Mercosur (Subcat. 15) vs. Dec. 177/2022 (Subcat. 11)',
          protocoloRegra: 'Postulación desde el extranjero',
          trabalho: 'Mercosur: habilitado · Rentista: ingresos pasivos',
          prazoEstimado: 'Preparación 15–35d · SERMIG 3–8 meses',
          resumo:
            'Evaluamos si acreditar pensión o rentas aporta ventaja o si la vía Mercosur simplifica la carpeta documental y apostillas.',
          alertaTurista: 'La regla general de la Ley 21.325 exige postular fuera de Chile.',
        },
        mercosul: {
          titulo: 'Acuerdo Mercosur — Subcategoría 15',
          baseLegal: 'Ley Nº 21.325 · Decreto Nº 177/2022 · Acuerdo Mercosur',
          protocoloRegra: 'Postulación 100% digital desde Brasil / Extranjero',
          trabalho: 'Permite trabajo dependiente, independiente o emprender',
          prazoEstimado: 'Antecedentes PF (60d) · SERMIG 3–8 meses',
          resumo:
            'Principal vía para brasileños: no exige oferta laboral previa ni acreditación de ingresos, y habilita el paso a la Residencia Definitiva a los 24 meses.',
          alertaTurista:
            'Atención: si estás en Chile como turista sin vínculo formalizado, la Ley 21.325 exige salir del país para postular a la Subcategoría 15.',
        },
      },
    },
    sections: {
      diferenciaisEyebrow: 'Metodología operativa',
      understandLawCta: 'Entiende la Ley (Resumen claro para clientes)',
      quemSomosEyebrow: 'Quiénes Somos',
      quemSomosCta: 'Conocer trayectoria y credenciales',
      partnersFallbackTitle: 'Aliados recomendados',
      partnersFallbackSubtitle:
        'Red validada en Brasil y Chile para apostillas, traducciones certificadas y relocation.',
      partnersDefaultCta: 'Ver toda la red y Postular como Aliado',
      contatoKicker: 'Siguiente Paso',
      contatoDefaultCta: 'Iniciar Diagnóstico Ahora',
      contatoWhatsappCta: 'Atención por WhatsApp',
      contatoScheduleCta: 'Agendar Reunión',
    },
  },
};

/**
 * Exact dictionary for translating default PT-BR Firestore/seed copy into authentic Chilean Spanish (es-CL).
 * Custom admin-edited copy that is not in this dictionary falls back gracefully to the original text.
 */
const SEED_ES_CL_MAP: Record<string, string> = {
  // Hero
  'Imigração e relocation para o Chile com segurança jurídica e previsibilidade':
    'Migración y relocation a Chile con respaldo jurídico y previsibilidad',
  'Da análise de elegibilidade pelo Acordo Mercosul e pela legislação chilena (Ley Nº 21.325) até a emissão da sua Cédula de Identidade chilena e adaptação completa no país.':
    'Desde la evaluación de elegibilidad bajo el Acuerdo Mercosur y la Ley Nº 21.325 hasta tu Cédula de Identidad chilena e instalación completa en el país.',
  'Conduzimos cada fase com conferência documental criteriosa, controle rigoroso de prazos e acompanhamento transparente pelo Portal do Cliente.':
    'Conducimos cada etapa con revisión documental rigurosa, control estricto de plazos y seguimiento transparente desde el Portal del Cliente.',
  'Fazer Diagnóstico Gratuito': 'Hacer Diagnóstico Inteligente',
  'Fazer Diagnóstico Inteligente': 'Hacer Diagnóstico Inteligente',
  'Falar no WhatsApp': 'Hablar por WhatsApp',
  'Atendimento integral em português do Brasil': 'Atención bilingüe dedicada (Portugués BR y Español CL)',
  'Atendimento 100% em português do Brasil': 'Atención bilingüe dedicada (Portugués BR y Español CL)',
  'Base normativa alinhada à legislação chilena (Ley Nº 21.325) e ao SERMIG':
    'Base normativa alineada con la Ley Nº 21.325 y criterios del SERMIG',
  'Base normativa alinhada à Ley 21.325 e SERMIG':
    'Base normativa alineada con la Ley Nº 21.325 y criterios del SERMIG',
  'Acompanhamento transparente em 15 etapas': 'Seguimiento transparente en 15 hitos digitales',
  'Operação Brasil & Santiago': 'Operación Brasil y Santiago de Chile',
  'Segurança documental do protocolo ao Estampado Electrónico':
    'Seguridad documental desde la postulación hasta el Estampado Electrónico',

  // Serviços
  'Soluções completas para imigração e estabelecimento no Chile':
    'Soluciones integrales para tu residencia e instalación en Chile',
  'Assessoria estruturada para profissionais, empreendedores, aposentados, estudantes e famílias brasileiras.':
    'Asesoría estructurada para profesionales, emprendedores, jubilados, estudiantes y familias que se trasladan a Chile.',
  'Residência Temporal — Acordo Mercosul e Subcategorias':
    'Residencia Temporal — Acuerdo Mercosur y Subcategorías',
  'Enquadramento técnico conforme a legislação chilena (Ley Nº 21.325, Art. 70, nº 13) e o Acordo Mercosul, abrangendo trabalho com oferta formal, rentistas, investidores, estudantes e reunificação familiar.':
    'Encuadre técnico según la Ley Nº 21.325 (Art. 70, Nº 13) y el Acuerdo Mercosur, cubriendo trabajo con contrato, rentistas, inversionistas, estudiantes y reunificación familiar.',
  'Prorrogação, Mudança de Subcategoria e Residência Definitiva':
    'Prórroga, Cambio de Subcategoría y Residencia Definitiva',
  'Monitoramento preventivo da janela legal (de 90 a 10 dias antes do vencimento), ratificação de dados e transição segura para a Residência Definitiva.':
    'Control preventivo de la ventana legal (90 a 10 días antes del vencimiento), ratificación de antecedentes y transición segura hacia la Residencia Definitiva.',
  'Preparação Documental, Apostila de Haia e Traduções':
    'Preparación Documental, Apostilla de La Haya y Traducciones',
  'Cronograma reverso que preserva o prazo de 60 dias dos Antecedentes da Polícia Federal, coordenando cartórios, Apostila de Haia e tradutores juramentados.':
    'Cronograma inverso que protege la vigencia de 60 días de los Antecedentes Penales, coordinando notarías, Apostilla de La Haya y traductores validados.',
  'Relocation e Integração Pós-Chegada': 'Relocation e Integración Post-Llegada a Chile',
  'Suporte completo no Estampado Electrónico, registro na PDI, Cédula de Identidade no Registro Civil, ClaveÚnica, RUT, abertura de conta bancária e busca de moradia.':
    'Acompañamiento completo en Estampado Electrónico, registro ante PDI, Cédula de Identidad en el Registro Civil, ClaveÚnica, RUT, apertura bancaria y búsqueda de vivienda.',

  // Diferenciais
  'Por que conduzir sua mudança com a D&M Integra Chile':
    'Por qué gestionar tu residencia con D&M Integra Chile',
  'Rigor técnico e planejamento preventivo para evitar exigências do SERMIG, perda de validade de certidões e indeferimentos.':
    'Rigor técnico y planificación preventiva para evitar subsanaciones del SERMIG, vencimiento de certificados y rechazos.',
  'Diagnóstico fundamentado na legislação vigente': 'Diagnóstico respaldado en la normativa chilena vigente',
  'Avaliamos se o pedido deve ser protocolado a partir do exterior ou se há hipótese legal de solicitação no Chile, prevenindo exigências administrativas e notificações de saída.':
    'Evaluamos si tu solicitud debe presentarse desde el extranjero o si existe causal legal para tramitar en Chile, evitando observaciones administrativas y órdenes de abandono.',
  'Termômetro de Prontidão Documental': 'Termómetro de Preparación Documental',
  'Cada certidão é verificada por critérios técnicos e pesos de obrigatoriedade, impedindo protocolos incompletos que comprometeriam o prazo de aprovação.':
    'Cada certificado es validado por criterios técnicos y nivel de obligatoriedad, impidiendo postulaciones incompletas que retrasan la resolución.',
  'Portal do Cliente e Rede Homologada': 'Portal del Cliente y Red Validada Brasil–Chile',
  'Envio seguro de documentos, cronograma personalizado de emissões, aprovação transparente de orçamentos e acesso direto a parceiros homologados no Brasil e no Chile.':
    'Carga segura de documentos, calendario personalizado de emisiones, presupuestos claros y acceso directo a aliados verificados en Brasil y Chile.',

  // Como Funciona
  'Como funciona a jornada até sua residência no Chile':
    'Cómo funciona el camino hacia tu residencia en Chile',
  'Um processo estruturado em quatro etapas claras, do enquadramento inicial à emissão da Cédula.':
    'Un proceso ordenado en cuatro etapas claras, desde el encuadre legal hasta la obtención de tu Cédula de Identidad.',
  'Diagnóstico Orientativo': 'Diagnóstico Orientativo',
  'Você preenche o questionário em 6 etapas e recebe uma pré-análise estruturada com as subcategorias elegíveis e o pré-checklist documental.':
    'Completas el cuestionario en 6 etapas y recibes un preanálisis técnico con subcategorías aplicables, radar de 7 pilares y pre-checklist documental.',
  'Reunião e Enquadramento Técnico': 'Reunión y Encuadre Técnico',
  'Nossa equipe valida vínculos, prazos e particularidades do seu perfil, formaliza o plano de atuação e libera seu acesso ao Portal do Cliente.':
    'Nuestro equipo revisa vínculos, plazos y particularidades de tu perfil, formaliza el plan de trabajo y habilita tu acceso al Portal del Cliente.',
  'Esteira Documental e Apostilamento': 'Carpeta Documental y Apostillas',
  'Definimos a ordem exata de emissão das certidões, conferimos cada arquivo e coordenamos apostilamentos e traduções juramentadas.':
    'Definimos el orden exacto de emisión de certificados, validamos cada archivo y coordinamos apostillas y traducciones certificadas.',
  'Protocolo SERMIG, Estampado e Cédula': 'Postulación SERMIG, Estampado y Cédula',
  'Acompanhamos toda a tramitação até o Estampado Electrónico, orientamos o ingresso no Chile dentro do prazo de 90 dias e apoiamos a emissão da Cédula.':
    'Hacemos seguimiento hasta el Estampado Electrónico, guiamos tu ingreso a Chile dentro de los 90 días y apoyamos la tramitación de tu Cédula.',

  // Quem Somos
  'Especialistas dedicados à jornada Brasil–Chile': 'Especialistas dedicados a la ruta Brasil–Chile',
  'Assessoria personalizada com foco em segurança operacional, clareza jurídica e atendimento próximo.':
    'Asesoría personalizada enfocada en seguridad operativa, claridad normativa y cercanía en cada paso.',
  'A D&M Integra Chile nasceu para eliminar a insegurança de brasileiros que desejam trabalhar, empreender, estudar ou viver no Chile. Atuamos com metodologia própria de análise normativa, controle de prazos do SERMIG e rede de parceiros verificados nos dois países.':
    'D&M Integra Chile nació para dar certeza a personas y familias que desean trabajar, emprender, estudiar o establecerse en Chile. Trabajamos con metodología normativa propia, control de plazos SERMIG y una red verificada de aliados en ambos países.',

  // Parceiros
  'Ecossistema Verificado': 'Ecosistema Verificado',
  'Rede de Parceiros Homologados Brasil–Chile': 'Red de Aliados Validados Brasil–Chile',
  'Profissionais e empresas verificados pela consultoria para apoiar cada etapa da sua mudança.':
    'Profesionales y empresas verificadas por nuestra consultora para apoyar cada fase de tu llegada a Chile.',
  'Cartórios, tradutores juramentados, seguradoras, contabilidades e assessoria imobiliária avaliados por qualidade técnica e atendimento em português.':
    'Notarías, traductores certificados, seguros, contabilidad y corretaje inmobiliario evaluados por su calidad técnica y trato cercano.',
  'Explorar rede de parceiros': 'Explorar red de aliados',

  // FAQ
  'Perguntas frequentes sobre imigração para o Chile': 'Preguntas frecuentes sobre migración a Chile',
  'Esclareça os pontos que mais geram dúvidas antes de iniciar o seu processo.':
    'Resuelve las dudas más habituales antes de iniciar tu trámite ante el SERMIG.',
  'Brasileiros podem solicitar a Residência Mercosul estando como turistas no Chile?':
    '¿Se puede postular a la Residencia Mercosur estando como turista en Chile?',
  'Pela regra geral da legislação chilena (Ley Nº 21.325 e Decreto Supremo Nº 177/2022), a primeira Residência Temporal por Reciprocidade Internacional (Acordo Mercosul) deve ser solicitada a partir do exterior. Quem se encontra no Chile como turista, sem vínculo familiar formalizado ou hipótese humanitária prevista em lei chilena, precisa sair do território chileno para protocolar o pedido.':
    'Según la regla general de la Ley Nº 21.325 y el Decreto Supremo Nº 177/2022, la primera Residencia Temporal por Reciprocidad Internacional (Acuerdo Mercosur) debe solicitarse desde el extranjero. Quien esté en Chile con permanencia transitoria sin vínculo familiar inscrito ni causal humanitaria debe salir del territorio chileno para postular.',
  'A Residência Mercosul exige contrato de trabalho prévio ou comprovação de renda?':
    '¿La Residencia Mercosur exige contrato de trabajo previo o acreditación de ingresos?',
  'Não. A subcategoria de Reciprocidade Internacional (Mercosul) autoriza o exercício de atividade laboral regular no Chile após a concessão e não exige oferta prévia de emprego nem comprovação de renda passiva como requisito de elegibilidade.':
    'No. La subcategoría de Reciprocidad Internacional (Mercosur) habilita para realizar actividades remuneradas lícitas en Chile una vez otorgada y no exige oferta laboral previa ni acreditación de rentas.',
  'Qual é a validade dos Antecedentes Criminais da Polícia Federal?':
    '¿Cuál es la vigencia del Certificado de Antecedentes Penales?',
  'Para fins migratórios no Chile, o Certificado de Antecedentes Criminais da Polícia Federal — devidamente apostilado — deve ter sido emitido há no máximo 60 dias na data do protocolo no SERMIG. Por isso, estruturamos um cronograma reverso para cada emissão.':
    'Para efectos migratorios en Chile, el Certificado de Antecedentes Penales — debidamente apostillado — debe tener una emisión máxima de 60 días al momento de postular en el SERMIG. Por eso diseñamos un cronograma inverso para cada trámite.',
  'Em quanto tempo posso solicitar a Residência Definitiva?':
    '¿En cuánto tiempo puedo postular a la Residencia Definitiva?',
  'Como regra geral para o Acordo Mercosul e a maioria das residências temporais, após 24 meses de residência regular no Chile — respeitados os limites de ausência do país e a janela legal de 90 a 10 dias antes do vencimento — o titular torna-se elegível à Residência Definitiva.':
    'Por regla general en el Acuerdo Mercosur y la mayoría de las residencias temporales, tras 24 meses de residencia regular en Chile — respetando los límites de ausencia y la ventana legal de 90 a 10 días antes del vencimiento — puedes postular a la Residencia Definitiva.',

  // Depoimentos & Contato & Rodapé
  'Histórias reais de quem realizou a mudança com segurança':
    'Experiencias reales de quienes concretaron su traslado con seguridad',
  'Depoimentos publicados somente mediante autorização expressa dos clientes atendidos.':
    'Testimonios publicados únicamente con autorización expresa de nuestros clientes.',
  'Pronto para planejar sua mudança para o Chile com segurança?':
    '¿Listo para planificar tu llegada y residencia en Chile con seguridad?',
  'Comece pelo diagnóstico gratuito ou converse diretamente com nossa consultoria especializada.':
    'Comienza con el diagnóstico inteligente gratuito o conversa directamente con nuestra consultora especializada.',
  'Atendemos clientes em todo o Brasil e em Santiago, Valparaíso, Viña del Mar e demais regiões do Chile.':
    'Atendemos clientes en todo Brasil y en Santiago, Valparaíso, Viña del Mar y demás regiones de Chile.',
  'Consultoria especializada em imigração e relocation Brasil–Chile.':
    'Consultoría especializada en migración y relocation Brasil–Chile.',
  'Todos os direitos reservados.': 'Todos los derechos reservados.',
  'Brasil · Atendimento para todo o Chile': 'Brasil · Atención para todo Chile',
  'Atuação como Pessoa Física · Marca própria D&M Integra Chile':
    'Práctica Profesional Independiente · Marca D&M Integra Chile',
  'Área da Equipe': 'Área del Equipo',
  'Área da equipe': 'Área del Equipo',
  'As informações e ferramentas desta plataforma auxiliam o acompanhamento do processo migratório e não substituem a análise individualizada de cada caso. Normas e prazos estão sujeitos a atualizações pelo SERMIG.':
    'La información y herramientas de esta plataforma apoyan el seguimiento del trámite migratorio y no reemplazan la evaluación individual de cada caso. Normas y plazos están sujetos a actualización por el SERMIG.',
};

export function translateSeedText(text: string | undefined, locale: SiteLocale): string {
  if (!text) return '';
  if (locale === 'pt-BR') return text;
  const trimmed = text.trim();
  return SEED_ES_CL_MAP[trimmed] ?? text;
}
