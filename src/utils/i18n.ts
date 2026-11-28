import { normalizePublicScopeText } from './publicScopeCopy';

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
    headerCtaDiagnostic: 'Iniciar Diagnóstico Gratuito',
    footer: {
      quickAccess: 'Navegação',
      teamArea: 'Área da Equipe',
      supportCompliance: 'Fale com um Especialista',
      instagramLabel: 'Acompanhar no Instagram',
      linkedinLabel: 'Conectar no LinkedIn',
      lastLegalReview: 'Base normativa revisada em:',
      defaultSubtitle:
        'Atuação exclusiva em assessoria de imigração Brasil–Chile (Vistos SERMIG, registro na PDI e emissão do RUT). Moradia não é serviço garantido — oferecemos indicação curada de parceiros imobiliários de confiança.',
      defaultCopyright: 'Todos os direitos reservados.',
      defaultLegalNotice:
        'A D&M Integra Chile atua exclusivamente na assessoria de imigração (Vistos SERMIG, PDI e RUT). Moradia não é um serviço garantido: para imóveis e demandas complementares, atuamos apenas como ponte de indicação curada para profissionais parceiros independentes.',
    },
    mobileBar: {
      diagnosticCta: 'Iniciar Diagnóstico Gratuito',
      whatsappCta: 'Falar com Especialista',
      waGreeting: (brand) =>
        `Olá! Estava no site da ${brand} e gostaria de tirar uma dúvida sem compromisso sobre visto, PDI e RUT no Chile.`,
    },
    seo: {
      homeTitle: (brand) => `${brand} — Assessoria Exclusiva de Imigração (Vistos, PDI e RUT)`,
      homeDescription:
        'Atuamos exclusivamente na assessoria de imigração (Vistos SERMIG, PDI e RUT). Moradia não é serviço garantido — oferecemos indicação curada de parceiros imobiliários de confiança no Chile.',
      legalModalTitle: 'Leis do Chile e Acordo Mercosul — explicados sem juridiquês',
    },
    hero: {
      defaultEyebrow: 'Atuação Exclusiva em Imigração Brasil–Chile · Vistos (SERMIG), PDI & RUT',
      defaultPrimaryCta: 'Iniciar Diagnóstico Gratuito',
      defaultSecondaryCta: 'Falar com um Especialista',
      defaultBadgeTitle: 'Assessoria Exclusiva de Imigração',
      defaultBadgeSubtitle: 'Vistos SERMIG, PDI e RUT · Ponte curada para parceiros de confiança',
      waGreeting:
        'Olá! Quero conversar sem compromisso com um especialista da D&M sobre visto, PDI e RUT no Chile.',
      metric1Value: '2 Min',
      metric1Label: 'Diagnóstico consultivo gratuito',
      metric2Value: '7 Pilares',
      metric2Label: 'Análise de riscos e custos',
      metric3Value: 'PDF 2 Págs',
      metric3Label: 'Plano migratório pronto',
      crestLabel: 'Plataforma D&M Integra Chile',
      crestTagline: 'Atuação exclusiva em Vistos, PDI e RUT · Parceiros de confiança indicados',
      intelModules: [
        { code: '01', label: 'Visto Certo', value: 'Mercosul · Ley 21.325' },
        { code: '02', label: 'Zero Prazos Perdidos', value: 'Alertas 30, 60 e 90 dias' },
        { code: '03', label: 'Regularização Final', value: 'Estampado, PDI e RUT' },
      ],
    },
    techBento: {
      eyebrow: 'Planejamento Sem Achismos',
      heading: 'Segurança jurídica, controle de prazos e tranquilidade até seu RUT no Chile',
      subheading:
        'Unimos domínio prático das exigências do SERMIG a um método transparente que protege você de indeferimentos, documentos vencidos e imprevistos na sua regularização migratória.',
      radarCard: {
        kicker: 'Simulador do Seu Plano de Mudança',
        title: 'Descubra em 2 minutos a rota mais segura e econômica para viver no Chile',
        description:
          'Responda a 6 etapas simples e veja na hora qual visto se encaixa no seu momento de vida, quais documentos preparar primeiro e baixe seu plano completo em PDF.',
        pillars: [
          { label: 'Rotas oficiais analisadas', score: '16' },
          { label: 'Análise completa do perfil', score: '7 Pilares' },
          { label: 'Proteção de Antecedentes PF', score: '60 dias' },
          { label: 'Plano de Mudança em PDF', score: '2 Págs' },
        ],
        cta: 'Simular Meu Plano de Mudança',
      },
      alertsCard: {
        kicker: 'Blindagem Contra Prazos Perdidos',
        title: 'Você nunca perde uma data crítica no Brasil ou no Chile',
        description:
          'Monitoramos cada prazo sensível do seu visto, das certidões da Polícia Federal, do Estampado Electrónico, da PDI e da sua Cédula.',
        rules: [
          {
            code: '30d',
            title: 'Vistos & Renovações',
            detail: 'Avisamos com antecedência para você manter sua residência sempre regular.',
          },
          {
            code: '60d',
            title: 'Antecedentes da PF',
            detail: 'Cronograma reverso para nenhuma certidão vencer antes do envio ao SERMIG.',
          },
          {
            code: '90d',
            title: 'Chegada, PDI e RUT',
            detail: 'Acompanhamento direto na chegada para você tirar sua Cédula e morar tranquilo.',
          },
        ],
      },
      portalCard: {
        kicker: 'Portal do Cliente D&M',
        title: 'Acompanhe sua mudança em 15 etapas claras — sem ficar no escuro esperando respostas',
        description:
          'Veja exatamente o que já foi aprovado, quais documentos faltam, converse com seu consultor e acompanhe cada avanço até estar com seu visto, registro na PDI e Cédula (RUT) em mãos.',
        milestones: [
          'Estratégia & Visto Ideal',
          'Certidões, Apostila & Tradução',
          'Protocolo Seguro SERMIG',
          'Estampado · PDI · RUT',
        ],
        primaryCta: 'Acessar Portal do Cliente',
        secondaryCta: 'Iniciar Diagnóstico Gratuito',
      },
    },
    services: {
      defaultEyebrow: 'Escopo Claro e Transparente',
      solutionPrefix: 'Entrega D&M',
      learnMore: 'Ver o que está incluído',
      plansKicker: 'Formatos de Assessoria',
      plansTitle: 'Escolha o nível de apoio ideal para regularizar seu visto, PDI e RUT no Chile',
      plansSubtitlePrefix: 'Comece descobrindo seu caminho gratuitamente e escolha entre a ',
      plansOrientativaBold: 'Consultoria Orientativa',
      plansOrientativaDesc: ' (você conduz o envio com nossa estratégia e revisão rigorosa) ou a ',
      plansCompletaBold: 'Consultoria Completa',
      plansCompletaDesc: ' (conduzimos cada etapa até Visto, PDI e RUT + indicamos parceiros para outras demandas).',
      plans: {
        diagnostico_gratuito: {
          kicker: 'Primeiro passo · Gratuito · Resultado imediato',
          nome: 'Diagnóstico Gratuito de Perfil',
          subtitulo: 'Descubra em 2 minutos qual visto faz sentido para o seu momento de vida e quais riscos evitar.',
          escopoPrefix: 'O que você recebe:',
          responsavelProtocolo: 'Avaliação consultiva gratuita e sem compromisso',
          inclui: [
            'Indicação clara da rota mais segura (Mercosul, Trabalho, Família, Estudo ou Renda)',
            'Alerta imediato contra erros comuns que causam rejeição no SERMIG',
            'Simulação de prazos, documentos prioritários e custos oficiais',
            'Plano Migratório em PDF pronto para salvar e compartilhar com sua família',
          ],
          cta: 'Iniciar Diagnóstico Gratuito',
        },
        orientativa: {
          kicker: 'Modalidade 01 · Segurança com autonomia',
          nome: 'Consultoria Orientativa',
          subtitulo: 'Para quem quer protocolar por conta própria, mas sem arriscar errar na documentação ou nos prazos.',
          escopoPrefix: 'Como funciona:',
          responsavelProtocolo: 'Você envia no SERMIG com revisão técnica completa da D&M',
          inclui: [
            'Reunião individual com especialista para definir seu plano e cronograma reverso',
            'Checklist sob medida e conferência de cada certidão antes de gastar com cartório',
            'Orientação segura sobre Apostila de Haia e tradução juramentada sem pagar a mais',
            'Passo a passo guiado para o envio no SERMIG, registro na PDI e emissão do RUT',
          ],
          cta: 'Quero a Consultoria Orientativa',
          waMessage:
            'Olá! Quero tirar uma dúvida sem compromisso sobre a Consultoria Orientativa para planejar meu visto, PDI e RUT no Chile.',
        },
        completa: {
          kicker: 'Modalidade 02 · Condução ponta a ponta até o RUT',
          nome: 'Consultoria Completa',
          subtitulo: 'Conduzimos toda a burocracia migratória no Brasil e no Chile — do visto no SERMIG à PDI e ao RUT.',
          escopoPrefix: 'Como funciona:',
          responsavelProtocolo: 'Nossa equipe conduz cada etapa até seu Visto, PDI e Cédula (RUT)',
          inclui: [
            'Tudo da Consultoria Orientativa + gestão ativa de prazos e exigências do SERMIG',
            'Montagem completa do dossiê, protocolo oficial e acompanhamento até o Estampado Electrónico',
            'Orientação completa de chegada: registro obrigatório na PDI e emissão da Cédula de Identidade (RUT)',
            'Acesso à nossa Rede de Parceiros Indicados (imóveis, traduções, cartórios, contadores e saúde) para outras situações',
          ],
          cta: 'Falar com um Especialista',
          waMessage:
            'Olá! Quero conversar sem compromisso sobre a Consultoria Completa para regularizar meu visto, PDI e RUT no Chile.',
        },
      },
      drawer: {
        headerPrefix: 'Escopo de Assessoria',
        closeLabel: 'Fechar detalhes',
        whoFor: 'Para quem resolve',
        framework: 'Como conduzimos esta etapa',
        timeline: 'Prazo médio de referência',
        defaultWhoFor: 'Adaptado ao seu perfil familiar e profissional no diagnóstico.',
        defaultFramework: 'Seguindo todas as exigências atuais do SERMIG, PDI e Registro Civil do Chile.',
        defaultTimeline: 'Planejado de acordo com a sua data ideal de embarque.',
        ctaDiagnostic: 'Simular Meu Plano Migratório',
        ctaWhatsapp: 'Tirar Dúvida no WhatsApp',
        waGreeting: (title) => `Olá! Gostaria de tirar uma dúvida sem compromisso sobre: ${title}.`,
      },
      fallbackDetails: {
        '01': {
          paraQuem: 'Brasileiros e famílias que querem viver, trabalhar ou empreender legalmente no Chile desde o primeiro dia.',
          subcategoriaTipica: 'Visto Mercosul (Cód. 15) ou subcategorias de Trabalho, Família, Estudo e Renda',
          faixaPrazo: 'Organização no Brasil: 15–35 dias · Análise SERMIG: 3–8 meses em média',
        },
        '02': {
          paraQuem: 'Quem já vive no Chile e não quer correr risco de perder o prazo da renovação ou da Residência Definitiva.',
          subcategoriaTipica: 'Prorrogação, Mudança de Subcategoria e Residência Definitiva',
          faixaPrazo: 'Janela segura: entre 90 e 10 dias antes do vencimento atual',
        },
        '03': {
          paraQuem: 'Quem quer evitar gastar duas vezes com cartório, traduções recusadas ou Antecedentes da PF vencidos.',
          subcategoriaTipica: 'Certidões civis, Polícia Federal (60 dias), Apostila de Haia e tradução homologada',
          faixaPrazo: 'Cronograma reverso montado exatamente para a sua data de protocolo',
        },
        '04': {
          paraQuem: 'Recém-chegados que precisam finalizar o Estampado, registrar-se na PDI, tirar o RUT e receber indicações confiáveis para outras demandas.',
          subcategoriaTipica: 'Estampado Electrónico, Registro na PDI, Cédula (RUT) e indicação de parceiros independentes',
          faixaPrazo: 'Primeiros 30 dias após a chegada ao Chile com acompanhamento direto na regularização',
        },
      },
    },
    comparator: {
      kicker: 'Simulação Rápida · Sem Cadastro',
      title: 'Qual é o caminho mais seguro para o seu perfil hoje?',
      subtitle:
        'Escolha 3 opções abaixo e descubra em segundos qual visto faz mais sentido para o seu plano de vida — evitando armadilhas como tentar pedir o visto errado já estando como turista no Chile.',
      labelWhere: 'Onde você está hoje?',
      whereOptions: {
        brasil: 'Ainda estou no Brasil / Exterior',
        turista_chile: 'Já estou no Chile como turista',
        residente_chile: 'Já moro no Chile com visto',
      },
      labelGoal: 'Qual é o seu plano no Chile?',
      goalOptions: {
        morar_trabalhar: 'Morar, trabalhar ou empreender',
        trabalho_oferta: 'Tenho proposta de empresa chilena',
        estudar: 'Fazer graduação, pós ou curso',
        renda: 'Viver de aposentadoria ou renda',
        familia: 'Viver perto da minha família no Chile',
      },
      labelTie: 'Tem família chilena ou residente?',
      tieOptions: {
        nao: 'Não tenho vínculo familiar lá',
        sim: 'Sim (cônjuge ou filho chileno)',
      },
      resultKicker: 'Caminho mais indicado para você',
      dtProtocol: 'Onde dar entrada:',
      dtWork: 'Direito a trabalho:',
      dtReference: 'Atenção ao prazo:',
      ctaValidate: 'Simular Meu Plano de Mudança Completo',
      routes: {
        residente: {
          titulo: 'Renovação Segura ou Residência Definitiva',
          baseLegal: 'Planejamento dentro da janela legal SERMIG (90 a 10 dias)',
          protocoloRegra: '100% online, já estando no Chile',
          trabalho: 'Mantém seu direito de trabalhar sem interrupção',
          prazoEstimado: 'Protocole entre 90 e 10 dias antes de vencer',
          resumo:
            'Revisamos seu histórico de viagens fora do Chile e preparamos seu dossiê para você conquistar a Residência Definitiva ou renovar sem sustos.',
          alerta:
            'Não deixe para a última semana: protocolar fora da janela de 90 a 10 dias pode gerar multa e travar sua regularidade no Chile.',
        },
        familia: {
          titulo: 'Reunificação Familiar — Proteção para sua Família',
          baseLegal: 'Via oficial para cônjuges, união civil ou filhos chilenos/residentes',
          protocoloTurista: 'Pode ser analisada de dentro do Chile (se o vínculo já estiver registrado)',
          protocoloExterior: 'Do Brasil ou do Chile, conforme o registro da certidão',
          trabalho: 'Libera trabalho formal e autônomo após a aprovação',
          prazoEstimado: 'Documentos: 15–30d · Análise SERMIG: 3–7 meses',
          resumo:
            'Quando o casamento, união civil ou filiação já está formalizado em cartório, esta rota protege a união da família e traz mais flexibilidade no protocolo.',
          alertaTurista:
            'Atenção: se o relacionamento ainda não está formalizado em registro civil, o SERMIG exige o envio do pedido fora do Chile (via Mercosul).',
        },
        trabalho: {
          titulo: 'Acordo Mercosul vs. Visto de Trabalho Formal',
          baseLegal: 'Comparamos liberdade profissional (Mercosul) x contrato com empresa chilena',
          protocoloRegra: 'Solicitação online antes de viajar ao Chile',
          trabalho: 'Mercosul: liberdade total · Trabalho: preso ao contrato inicial',
          prazoEstimado: 'Documentos: 15–30d · Análise SERMIG: 3–8 meses',
          resumo:
            'Mesmo com oferta de emprego, o Acordo Mercosul costuma dar mais segurança e autonomia ao brasileiro — avaliamos no diagnóstico qual opção aprova melhor no seu caso.',
          alertaTurista: 'Importante: para iniciar este visto, a lei chilena exige que o protocolo seja feito fora do Chile.',
        },
        estudar: {
          titulo: 'Acordo Mercosul vs. Visto de Estudante',
          baseLegal: 'Comparativo prático para quem vai estudar e quer manter opções abertas',
          protocoloRegra: 'Protocolo digital antes do embarque',
          trabalho: 'Mercosul: trabalho livre · Estudante: limite de horas',
          prazoEstimado: 'Documentos: 15–30d · Análise SERMIG: 3–7 meses',
          resumo:
            'Como brasileiro, você muitas vezes consegue estudar usando o Visto Mercosul — que ainda libera trabalho integral e conta tempo direto para a Residência Definitiva.',
          alertaTurista: 'Importante: o pedido inicial precisa ser enviado enquanto você estiver fora do Chile.',
        },
        renda: {
          titulo: 'Acordo Mercosul ou Visto para Aposentados e Rentistas',
          baseLegal: 'Avaliamos qual rota exige menos burocracia com traduções e comprovantes',
          protocoloRegra: 'Protocolo 100% digital a partir do Brasil',
          trabalho: 'Mercosul: liberdade total · Rentista: foco em renda própria',
          prazoEstimado: 'Documentos: 15–35d · Análise SERMIG: 3–8 meses',
          resumo:
            'Mostramos na ponta do lápis se vale comprovar renda passiva/aposentadoria ou seguir pelo Mercosul para economizar com apostilas e traduções juramentadas.',
          alertaTurista: 'Atenção: pela lei chilena atual, o pedido inicial precisa ser protocolado fora do Chile.',
        },
        mercosul: {
          titulo: 'Acordo Mercosul — A Rota Mais Direta para Brasileiros',
          baseLegal: 'Direito garantido a brasileiros · Sem exigência de emprego prévio',
          protocoloRegra: '100% online a partir do Brasil (antes de viajar)',
          trabalho: 'Liberado para trabalhar, empreender ou prestar serviços',
          prazoEstimado: 'Antecedentes PF (60d) · SERMIG: 3–8 meses',
          resumo:
            'O caminho favorito de quem busca tranquilidade: não exige contrato de trabalho nem comprovação de renda mínima, e abre caminho direto para a Residência Definitiva em 24 meses.',
          alertaTurista:
            'Cuidado para não travar seu processo: quem está no Chile como turista sem vínculo familiar formalizado precisa estar fora do país para protocolar o Visto Mercosul.',
        },
      },
    },
    sections: {
      diferenciaisEyebrow: 'Proteção Real Contra Riscos e Burocracia',
      understandLawCta: 'Entender as regras do Chile em linguagem simples',
      quemSomosEyebrow: 'Quem Cuida da Sua Mudança',
      quemSomosCta: 'Conhecer nossa história e como trabalhamos',
      partnersFallbackTitle: 'Parceiros de Confiança',
      partnersFallbackSubtitle:
        'Atuamos exclusivamente na assessoria de imigração (Vistos, PDI e RUT). Moradia não é um serviço garantido — servimos apenas como ponte de indicação curada para parceiros imobiliários e especialistas independentes.',
      partnersDefaultCta: 'Conhecer Parceiros de Confiança',
      contatoKicker: 'Converse Sem Compromisso',
      contatoDefaultCta: 'Iniciar Diagnóstico Gratuito',
      contatoWhatsappCta: 'Falar com um Especialista',
      contatoScheduleCta: 'Agendar Conversa Gratuita',
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
      defaultSubtitle:
        'Actuación exclusiva en asesoría de inmigración Brasil–Chile (Visas SERMIG, registro PDI y emisión de RUT). La vivienda no es un servicio garantizado: ofrecemos indicación curada a aliados inmobiliarios de confianza.',
      defaultCopyright: 'Todos los derechos reservados.',
      defaultLegalNotice:
        'D&M Integra Chile actúa exclusivamente en asesoría de inmigración (Visas SERMIG, PDI y RUT). La vivienda no es un servicio garantizado: actuamos únicamente como puente transparente de indicación hacia aliados inmobiliarios y especialistas independientes.',
    },
    mobileBar: {
      diagnosticCta: 'Diagnóstico Inteligente',
      whatsappCta: 'WhatsApp',
      waGreeting: (brand) => `¡Hola! Escribo desde el sitio web de ${brand} y quisiera hacer una consulta sobre residencia en Chile.`,
    },
    seo: {
      homeTitle: (brand) => `${brand} — Asesoría Exclusiva de Inmigración (Visas, PDI y RUT)`,
      homeDescription:
        'Actuamos exclusivamente en asesoría migratoria (Visas SERMIG, PDI y RUT). La vivienda no es un servicio garantizado; ofrecemos indicación curada de aliados inmobiliarios de confianza.',
      legalModalTitle: 'Legislación Chilena, Brasileña y Acuerdo Mercosur — en lenguaje claro',
    },
    hero: {
      defaultEyebrow: 'Actuación Exclusiva en Inmigración Brasil – Chile · Visas (SERMIG), PDI y RUT',
      defaultPrimaryCta: 'Hacer Diagnóstico Inteligente',
      defaultSecondaryCta: 'Hablar por WhatsApp',
      defaultBadgeTitle: 'Asesoría Exclusiva de Inmigración',
      defaultBadgeSubtitle: 'Visas SERMIG, PDI y RUT · Puente transparente hacia aliados de confianza',
      waGreeting: '¡Hola! Quisiera recibir orientación sobre asesoría migratoria (Visas, PDI y RUT) en Chile.',
      metric1Value: '6 Etapas',
      metric1Label: 'Diagnóstico inteligente en vivo',
      metric2Value: '7 Pilares',
      metric2Label: 'Radar técnico y simulador',
      metric3Value: 'PDF 2 Págs',
      metric3Label: 'Informe ejecutivo descargable',
      crestLabel: 'Plataforma D&M Integra Chile',
      crestTagline: 'Actuación exclusiva en Visas, PDI y RUT · Aliados de confianza',
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
          kicker: 'Modalidad 02 · Gestión exclusiva de inmigración',
          nome: 'Asesoría Completa',
          subtitulo: 'Gestión de extremo a extremo exclusivamente de tu proceso migratorio (Visas SERMIG, PDI y RUT).',
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
      partnersFallbackTitle: 'Aliados de Confianza',
      partnersFallbackSubtitle:
        'Actuamos exclusivamente en inmigración (Visas, PDI y RUT). La vivienda no es un servicio garantizado: actuamos solo como puente de indicación curada hacia aliados inmobiliarios y especialistas independientes.',
      partnersDefaultCta: 'Conocer Aliados de Confianza',
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
  'Conquiste sua residência no Chile com segurança, estratégia e tranquilidade.':
    'Conquista tu residencia en Chile con seguridad, estrategia y tranquilidad.',
  'Imigração e relocation para o Chile com segurança jurídica e previsibilidade':
    'Conquista tu residencia en Chile con seguridad, estrategia y tranquilidad.',
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
  'Estampado Electrónico, Registro PDI, RUT e Indicação de Parceiros':
    'Estampado Electrónico, Registro PDI, RUT y Red de Aliados',
  'Orientamos o Estampado Electrónico, o registro obrigatório na PDI e a emissão da Cédula (RUT). Para moradia, contabilidade, traduções ou saúde, indicamos profissionais parceiros independentes.':
    'Acompañamiento en Estampado Electrónico, registro obligatorio en PDI y obtención de tu Cédula (RUT). Para vivienda, contabilidad, traducciones o salud, derivamos a aliados independientes verificados.',
  'Suporte completo no Estampado Electrónico, registro na PDI, Cédula de Identidade no Registro Civil, ClaveÚnica, RUT, abertura de conta bancária e busca de moradia.':
    'Acompañamiento en Estampado Electrónico, registro en PDI y Cédula de Identidad (RUT), más derivación a aliados independientes para vivienda y otros servicios.',

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
  'Portal do Cliente e Rede Homologada': 'Portal del Cliente y Red de Aliados Brasil–Chile',
  'Envio seguro de documentos, cronograma personalizado de emissões, aprovação transparente de orçamentos e acesso direto a parceiros homologados no Brasil e no Chile.':
    'Carga segura de documentos, calendario personalizado de emisiones, presupuestos claros y acceso directo a aliados independientes verificados en Brasil y Chile.',

  // Como Funciona
  'Como funciona a jornada até sua residência no Chile':
    'Cómo funciona el camino hacia tu visto, PDI y RUT en Chile',
  'Um processo estruturado em quatro etapas claras, do enquadramento inicial à emissão da Cédula.':
    'Un proceso ordenado en cuatro etapas claras, desde el encuadre legal hasta la obtención de tu Cédula de Identidad (RUT).',
  'Diagnóstico Orientativo': 'Diagnóstico Orientativo',
  'Você preenche o questionário em 6 etapas e recebe uma pré-análise estruturada com as subcategorias elegíveis e o pré-checklist documental.':
    'Completas el cuestionario en 6 etapas y recibes un preanálisis técnico con subcategorías aplicables, radar de 7 pilares y pre-checklist documental.',
  'Reunião e Enquadramento Técnico': 'Reunión y Encuadre Técnico',
  'Nossa equipe valida vínculos, prazos e particularidades do seu perfil, formaliza o plano de atuação e libera seu acesso ao Portal do Cliente.':
    'Nuestro equipo revisa vínculos, plazos y particularidades de tu perfil, formaliza el plan de trabajo y habilita tu acceso al Portal del Cliente.',
  'Esteira Documental e Apostilamento': 'Carpeta Documental y Apostillas',
  'Definimos a ordem exata de emissão das certidões, conferimos cada arquivo e coordenamos apostilamentos e traduções juramentadas.':
    'Definimos el orden exacto de emisión de certificados, validamos cada archivo y coordinamos apostillas y traducciones certificadas.',
  'Protocolo SERMIG, Estampado e Cédula': 'Postulación SERMIG, Estampado, PDI y RUT',
  'Acompanhamos toda a tramitação até o Estampado Electrónico, orientamos o ingresso no Chile dentro do prazo de 90 dias e apoiamos a emissão da Cédula.':
    'Hacemos seguimiento hasta el Estampado Electrónico, guiamos tu ingreso a Chile dentro de los 90 días, registro en PDI y obtención de tu Cédula (RUT).',

  // Quem Somos
  'Especialistas dedicados à jornada Brasil–Chile': 'Especialistas dedicados a la ruta Brasil–Chile',
  'Assessoria personalizada com foco em segurança operacional, clareza jurídica e atendimento próximo.':
    'Asesoría personalizada enfocada en seguridad operativa, claridad normativa y cercanía en cada paso.',
  'A D&M Integra Chile nasceu para eliminar a insegurança de brasileiros que desejam trabalhar, empreender, estudar ou viver no Chile. Atuamos com metodologia própria de análise normativa, controle de prazos do SERMIG e rede de parceiros verificados nos dois países.':
    'D&M Integra Chile nació para dar certeza en todo el proceso migratorio (Visas, PDI y RUT) y conectar a nuestros clientes con aliados independientes verificados para otras necesidades en Chile.',

  // Parceiros
  'Ecossistema Verificado': 'Red de Aliados Indicados',
  'Rede de Parceiros Homologados Brasil–Chile': 'Red de Aliados Indicados Brasil–Chile',
  'Rede de Parceiros Indicados Brasil–Chile': 'Red de Aliados Indicados Brasil–Chile',
  'Profissionais e empresas verificados pela consultoria para apoiar cada etapa da sua mudança.':
    'Nuestra asesoría cubre Visas, PDI y RUT; para vivienda, traducciones, notarías, contabilidad, asesoría legal y salud, recomendamos profesionales independientes verificados.',
  'Cartórios, tradutores juramentados, seguradoras, contabilidades e assessoria imobiliária avaliados por qualidade técnica e atendimento em português.':
    'Notarías, traductores certificados, seguros, contabilidad y corretaje inmobiliario recomendados con contratación directa y transparente.',
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
    'Experiencias reales de quienes concretaron su trámite con seguridad',
  'Depoimentos publicados somente mediante autorização expressa dos clientes atendidos.':
    'Testimonios publicados únicamente con autorización expresa de nuestros clientes.',
  'Pronto para planejar sua mudança para o Chile com segurança?':
    '¿Listo para planificar tu visa, PDI y RUT en Chile con seguridad?',
  'Comece pelo diagnóstico gratuito ou converse diretamente com nossa consultoria especializada.':
    'Comienza con el diagnóstico inteligente gratuito o conversa directamente con nuestra consultora especializada.',
  'Atendemos clientes em todo o Brasil e em Santiago, Valparaíso, Viña del Mar e demais regiões do Chile.':
    'Atendemos clientes en todo Brasil y en Santiago, Valparaíso, Viña del Mar y demás regiones de Chile.',
  'Consultoria especializada em imigração e relocation Brasil–Chile.':
    'Consultoría migratoria especializada Brasil–Chile hasta Visas, PDI y RUT, con red de aliados independientes.',
  'Todos os direitos reservados.': 'Todos los derechos reservados.',
  'Brasil · Atendimento para todo o Chile': 'Brasil · Atención para todo Chile',
  'Atuação como Pessoa Física · Marca própria D&M Integra Chile':
    'Práctica Profesional Independiente · Marca D&M Integra Chile',
  'Área da Equipe': 'Área del Equipo',
  'Área da equipe': 'Área del Equipo',
  'As informações e ferramentas desta plataforma auxiliam o acompanhamento do processo migratório e não substituem a análise individualizada de cada caso. Normas e prazos estão sujeitos a atualizações pelo SERMIG.':
    'La información y herramientas de esta plataforma apoyan el seguimiento del trámite migratorio y no reemplazan la evaluación individual de cada caso. Normas y plazos están sujetos a actualización por el SERMIG.',
};

/**
 * Upgrades previously-seeded Portuguese default strings (including existing Firestore snapshots)
 * to the accurate consultative brand voice (Visas, PDI & RUT + independent partner referrals)
 * without touching database records or overriding custom edits.
 */
const LEGACY_PT_BR_COPY_UPGRADE_MAP: Record<string, string> = {
  // Hero
  'Fazer Diagnóstico Gratuito': 'Iniciar Diagnóstico Gratuito',
  'Falar no WhatsApp': 'Falar com um Especialista',
  'Atendimento integral em português do Brasil': 'Atendimento humano e direto em português',
  'Atendimento 100% em português do Brasil': 'Atendimento humano e direto em português',
  'Base normativa alinhada à legislação chilena (Ley Nº 21.325) e ao SERMIG':
    'Rigor técnico no SERMIG, PDI e Cédula (RUT)',
  'Base normativa alinhada à Lei 21.325 e ao SERMIG': 'Rigor técnico no SERMIG, PDI e Cédula (RUT)',
  'Base normativa alinhada à Ley 21.325 e SERMIG': 'Rigor técnico no SERMIG, PDI e Cédula (RUT)',

  // Serviços
  'Soluções completas para imigração e estabelecimento no Chile':
    'Escopo claro: do visto no Brasil ao registro na PDI e emissão do RUT',
  'Entregas claras de tranquilidade para cada etapa da sua mudança':
    'Escopo claro: do visto no Brasil ao registro na PDI e emissão do RUT',
  'Residência Temporal — Acordo Mercosul e Subcategorias': 'Regularização Migratória Completa',
  'Enquadramento técnico conforme a legislação chilena (Ley Nº 21.325, Art. 70, nº 13) e o Acordo Mercosul, abrangendo trabalho com oferta formal, rentistas, investidores, estudantes e reunificação familiar.':
    'Cuidamos do seu visto, PDI e RUT para você viver e trabalhar legalmente desde o primeiro dia — escolhendo a rota certa entre Mercosul, trabalho, estudo, família ou renda.',
  'Enquadramento técnico conforme a Ley 21.325 (incluindo o Acordo Mercosul, Art. 70, nº 13), abrangendo trabalho com oferta formal, rentistas, investidores, estudantes e reunificação familiar.':
    'Cuidamos do seu visto, PDI e RUT para você viver e trabalhar legalmente desde o primeiro dia — escolhendo a rota certa entre Mercosul, trabalho, estudo, família ou renda.',
  'Prorrogação, Mudança de Subcategoria e Residência Definitiva':
    'Renovação Sem Susto e Residência Definitiva',
  'Monitoramento preventivo da janela legal (de 90 a 10 dias antes do vencimento), ratificação de dados e transição segura para a Residência Definitiva.':
    'Acompanhamos seus prazos antes do vencimento para você renovar ou conquistar a Residência Definitiva sem correr risco de multas, irregularidade ou perda de direitos.',
  'Preparação Documental, Apostila de Haia e Traduções':
    'Dossiê Blindado, Apostila e Traduções Sem Retrabalho',
  'Cronograma reverso que preserva o prazo de 60 dias dos Antecedentes da Polícia Federal, coordenando cartórios, Apostila de Haia e tradutores juramentados.':
    'Montamos a ordem exata das certidões para seus Antecedentes da PF não vencerem em 60 dias, evitando gastar duas vezes com cartórios ou travar o pedido por erro simples.',

  // Diferenciais
  'Por que conduzir sua mudança com a D&M Integra Chile':
    'Por que brasileiros confiam sua regularização à D&M Integra Chile',
  'Rigor técnico e planejamento preventivo para evitar exigências do SERMIG, perda de validade de certidões e indeferimentos.':
    'Você não precisa enfrentar a burocracia do SERMIG sozinho nem arriscar seu processo com informações desencontradas de grupos na internet.',
  'Diagnóstico fundamentado na legislação vigente':
    'Estratégia certa antes de comprar passagem ou gastar em cartório',
  'Avaliamos se o pedido deve ser protocolado a partir do exterior ou se há hipótese legal de solicitação no Chile, prevenindo exigências administrativas e notificações de saída.':
    'Evitamos o erro mais caro de quem muda sem orientação: entrar como turista sem poder pedir o visto no Chile e acabar travado com exigências ou ordens de saída.',
  'Termômetro de Prontidão Documental': 'Conferência rigorosa antes do protocolo no SERMIG',
  'Cada certidão é verificada por critérios técnicos e pesos de obrigatoriedade, impedindo protocolos incompletos que comprometeriam o prazo de aprovação.':
    'Validamos cada documento, prazo e tradução antes do envio oficial, blindando seu pedido contra atrasos de meses por falhas fáceis de evitar.',
  'Portal do Cliente e Rede Homologada': 'Portal transparente e rede de parceiros indicados',

  // Como Funciona
  'Um processo estruturado em quatro etapas claras, do enquadramento inicial à emissão da Cédula.':
    'Um roteiro previsível do Brasil até o visto aprovado, registro na PDI e emissão do seu RUT.',

  // Quem Somos
  'Especialistas dedicados à jornada Brasil–Chile':
    'Rigor técnico no processo, acolhimento real com a sua família',
  'Assessoria personalizada com foco em segurança operacional, clareza jurídica e atendimento próximo.':
    'Sabemos que mudar de país envolve sonhos, filhos, carreira e patrimônio. Por isso, conduzimos cada etapa migratória com transparência e proximidade.',
  'A D&M Integra Chile nasceu para eliminar a insegurança de brasileiros que desejam trabalhar, empreender, estudar ou viver no Chile. Atuamos com metodologia própria de análise normativa, controle de prazos do SERMIG e rede de parceiros verificados nos dois países.':
    'A D&M Integra Chile nasceu para dar segurança a brasileiros em toda a regularização migratória — do enquadramento legal no Brasil ao visto no SERMIG, registro na PDI e emissão do RUT — além de conectar você a profissionais parceiros confiáveis para outras etapas da vida no Chile.',

  // Parceiros
  'Ecossistema Verificado': 'Indicação de Profissionais Parceiros',
  'Curadoria & Proteção Contra Riscos': 'Indicação de Profissionais Parceiros',
  'Parceiros recomendados': 'Rede de Parceiros Indicados Brasil–Chile',
  'Rede de Parceiros Homologados Brasil–Chile': 'Rede de Parceiros Indicados Brasil–Chile',
  'Rede homologada no Brasil e no Chile para apostilamentos, traduções juramentadas e relocation.':
    'Nossa assessoria acompanha até Vistos, PDI e RUT. Para outras necessidades no Brasil e no Chile, indicamos profissionais parceiros independentes em imobiliária, tradução, cartório, contabilidade, advocacia e saúde.',
  'Profissionais e empresas verificados pela consultoria para apoiar cada etapa da sua mudança.':
    'Nossa assessoria acompanha até Vistos, PDI e RUT. Para outras necessidades no Brasil e no Chile, indicamos profissionais parceiros independentes em imobiliária, tradução, cartório, contabilidade, advocacia e saúde.',
  'Cartórios, tradutores juramentados, seguradoras, contabilidades e assessoria imobiliária avaliados por qualidade técnica e atendimento em português.':
    'Profissionais independentes indicados pela D&M para apoiar você em imóveis, traduções juramentadas, cartórios, abertura de empresa (SpA), seguros e educação — com contratação direta e transparente.',
  'Explorar rede de parceiros': 'Explorar rede de parceiros',
  'Ver todos e Seja um Parceiro': 'Explorar rede de parceiros',
  'Conhecer parceiros validados': 'Explorar rede de parceiros',

  // FAQ
  'Perguntas frequentes sobre imigração para o Chile':
    'Dúvidas reais de quem está planejando viver no Chile',
  'Esclareça os pontos que mais geram dúvidas antes de iniciar o seu processo.':
    'Respostas diretas e sem juridiquês sobre vistos, trabalho, prazos, PDI e RUT no Chile.',
  'Brasileiros podem solicitar a Residência Mercosul estando como turistas no Chile?':
    'Posso viajar como turista para o Chile e pedir o Visto Mercosul lá dentro?',
  'Pela regra geral da legislação chilena (Ley Nº 21.325 e Decreto Supremo Nº 177/2022), a primeira Residência Temporal por Reciprocidade Internacional (Acordo Mercosul) deve ser solicitada a partir do exterior. Quem se encontra no Chile como turista, sem vínculo familiar formalizado ou hipótese humanitária prevista em lei chilena, precisa sair do território chileno para protocolar o pedido.':
    'Não. Pela regra atual da legislação chilena, o primeiro pedido do Visto Mercosul precisa ser enviado enquanto você ainda está no Brasil (ou fora do Chile). Quem entra como turista sem vínculo familiar formalizado acaba tendo o pedido travado e precisa sair do país para protocolar — por isso planejar antes do embarque evita gastos e frustrações.',
  'Pela regra geral da Lei 21.325 e Decreto Supremo Nº 177/2022, a primeira Residência Temporal por Reciprocidade Internacional (Acordo Mercosul) deve ser solicitada a partir do exterior. Quem se encontra no Chile como turista, sem vínculo familiar formalizado ou hipótese humanitária prevista em lei, precisa sair do território chileno para protocolar o pedido.':
    'Não. Pela regra atual da legislação chilena, o primeiro pedido do Visto Mercosul precisa ser enviado enquanto você ainda está no Brasil (ou fora do Chile). Quem entra como turista sem vínculo familiar formalizado acaba tendo o pedido travado e precisa sair do país para protocolar — por isso planejar antes do embarque evita gastos e frustrações.',
  'A Residência Mercosul exige contrato de trabalho prévio ou comprovação de renda?':
    'Preciso já ter emprego garantido ou comprovar renda alta para tirar o Visto Mercosul?',
  'Não. A subcategoria de Reciprocidade Internacional (Mercosul) autoriza o exercício de atividade laboral regular no Chile após a concessão e não exige oferta prévia de emprego nem comprovação de renda passiva como requisito de elegibilidade.':
    'Não! Essa é a grande vantagem de ser brasileiro: o Acordo Mercosul não exige oferta prévia de emprego nem comprovação de renda mínima para aprovação, e ainda permite trabalhar formalmente ou empreender assim que o visto é concedido.',
  'Qual é a validade dos Antecedentes Criminais da Polícia Federal?':
    'Por que tanta gente perde prazo com os Antecedentes da Polícia Federal?',
  'Para fins migratórios no Chile, o Certificado de Antecedentes Criminais da Polícia Federal — devidamente apostilado — deve ter sido emitido há no máximo 60 dias na data do protocolo no SERMIG. Por isso, estruturamos um cronograma reverso para cada emissão.':
    'Porque o Chile só aceita os Antecedentes da Polícia Federal emitidos e apostilados há no máximo 60 dias na data do protocolo no SERMIG. Se você tira esse documento cedo demais, ele vence antes do envio — e por isso montamos um cronograma reverso para você não perder tempo nem dinheiro.',
  'Em quanto tempo posso solicitar a Residência Definitiva?':
    'Quando posso conquistar a Residência Definitiva no Chile?',
  'Como regra geral para o Acordo Mercosul e a maioria das residências temporais, após 24 meses de residência regular no Chile — respeitados os limites de ausência do país e a janela legal de 90 a 10 dias antes do vencimento — o titular torna-se elegível à Residência Definitiva.':
    'Na maioria das rotas — incluindo o Acordo Mercosul — você pode pedir a Residência Definitiva ao completar 24 meses vivendo regularmente no Chile, respeitando o limite de viagens para fora do país e protocolando entre 90 e 10 dias antes do vencimento.',

  // Contato & Rodapé
  'Pronto para planejar sua mudança para o Chile com segurança?':
    'Vamos planejar seu visto, PDI e RUT no Chile com segurança e zero improviso?',
  'Comece pelo diagnóstico gratuito ou converse diretamente com nossa consultoria especializada.':
    'Faça seu diagnóstico gratuito em 2 minutos ou chame nossa equipe no WhatsApp para tirar suas dúvidas sem compromisso.',
  'Consultoria especializada em imigração e relocation Brasil–Chile.':
    'Assessoria migratória especializada do Brasil ao Chile — conduzindo seu Visto (SERMIG), registro na PDI e emissão do RUT, com indicação de parceiros qualificados para outras situações.',
};

export function translateSeedText(text: string | undefined, locale: SiteLocale): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (locale === 'pt-BR') {
    const scopeNormalized = normalizePublicScopeText(trimmed);
    return LEGACY_PT_BR_COPY_UPGRADE_MAP[scopeNormalized] ?? scopeNormalized;
  }
  const normalizedPt = normalizePublicScopeText(trimmed);
  return SEED_ES_CL_MAP[trimmed] ?? SEED_ES_CL_MAP[normalizedPt] ?? normalizedPt;
}
