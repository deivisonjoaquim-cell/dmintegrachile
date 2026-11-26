export type HeroQuickProfileId =
  | 'mercosul'
  | 'trabalho'
  | 'renda'
  | 'familia'
  | 'ja_no_chile';

export interface HeroQuickProfile {
  id: HeroQuickProfileId;
  shortLabel: string;
  routeTitle: string;
  legalBasis: string;
  protocolOrigin: string;
  workPermission: string;
  criticalRule: string;
  summary: string;
  diagnosticPath: string;
}

export interface JourneyPhaseItem {
  code: string;
  title: string;
  subtitle: string;
  timeframe: string;
  deadlineGuard: string;
  portalView: string;
  deliverables: string[];
}

const PROFILES_PT: HeroQuickProfile[] = [
  {
    id: 'mercosul',
    shortLabel: 'Morar pelo Mercosul',
    routeTitle: 'Reciprocidade Internacional · Acordo Mercosul',
    legalBasis: 'Ley Nº 21.325 · Art. 70, nº 13 · Decreto 177/2022',
    protocolOrigin: 'Portal digital SERMIG a partir do Brasil',
    workPermission: 'Autoriza trabalhar e empreender no Chile',
    criticalRule: 'Certidão Polícia Federal válida por 60 dias',
    summary:
      'Via mais direta para brasileiros sem contrato prévio: não exige comprovação de oferta de emprego ou renda mínima formal no protocolo inicial.',
    diagnosticPath: '/diagnostico',
  },
  {
    id: 'trabalho',
    shortLabel: 'Proposta de Trabalho',
    routeTitle: 'Atividades Lícitas Remuneradas',
    legalBasis: 'Decreto Nº 177/2022 · Subcategoria Laboral',
    protocolOrigin: 'Protocolo online SERMIG antes do embarque',
    workPermission: 'Vínculo formal com empregador chileno',
    criticalRule: 'Contrato notariado com cláusulas migratórias obrigatórias',
    summary:
      'Indicada para quem já possui oferta formal ou contrato com empresa chilena com início de atividades vigente no SII.',
    diagnosticPath: '/diagnostico',
  },
  {
    id: 'renda',
    shortLabel: 'Renda / Aposentadoria',
    routeTitle: 'Aposentados e Rentistas',
    legalBasis: 'Decreto Nº 177/2022 · Jubilados y Rentistas',
    protocolOrigin: 'Protocolo digital SERMIG fora do Chile',
    workPermission: 'Residência para viver com recursos próprios',
    criticalRule: 'Comprovação documental estável, apostilada e traduzida',
    summary:
      'Estruturada para aposentados, pensionistas e investidores com rendimentos recorrentes lícitos (imóveis, dividendos ou previdência).',
    diagnosticPath: '/diagnostico',
  },
  {
    id: 'familia',
    shortLabel: 'Reunificação Familiar',
    routeTitle: 'Reunificação Familiar Formalizada',
    legalBasis: 'Ley Nº 21.325 · Art. 19 e Decreto 177/2022',
    protocolOrigin: 'Exterior ou exceção legal dentro do Chile',
    workPermission: 'Permite atividade remunerada após aprovação',
    criticalRule: 'Certidão civil atualizada com Apostila de Haia',
    summary:
      'Para cônjuges, companheiros com união formalizada, filhos ou pais de cidadãos chilenos ou residentes definitivos.',
    diagnosticPath: '/diagnostico',
  },
  {
    id: 'ja_no_chile',
    shortLabel: 'Já estou no Chile',
    routeTitle: 'Prorrogação, Definitiva ou Análise de Exceção',
    legalBasis: 'Ley Nº 21.325 · Art. 58 & Janela 90–10 dias',
    protocolOrigin: 'Análise imediata de status migratório atual',
    workPermission: 'Conforme título vigente ou protocolo regular',
    criticalRule: 'Janela obrigatória de 90 a 10 dias antes do vencimento',
    summary:
      'Verificamos imediatamente se você já pode pedir Residência Definitiva, prorrogar dentro do prazo ou corrigir estratégia caso esteja como turista.',
    diagnosticPath: '/diagnostico',
  },
];

const PROFILES_ES: HeroQuickProfile[] = [
  {
    id: 'mercosul',
    shortLabel: 'Acuerdo Mercosur',
    routeTitle: 'Reciprocidad Internacional · Acuerdo Mercosur',
    legalBasis: 'Ley Nº 21.325 · Art. 70, nº 13 · Decreto 177/2022',
    protocolOrigin: 'Portal digital SERMIG desde el exterior',
    workPermission: 'Autoriza trabajar y emprender en Chile',
    criticalRule: 'Antecedentes Policía Federal válidos por 60 días',
    summary:
      'Vía directa para ciudadanos brasileños sin contrato previo: no exige oferta laboral ni renta mínima formal en la solicitud inicial.',
    diagnosticPath: '/diagnostico',
  },
  {
    id: 'trabalho',
    shortLabel: 'Oferta Laboral',
    routeTitle: 'Actividades Lícitas Remuneradas',
    legalBasis: 'Decreto Nº 177/2022 · Subcategoría Laboral',
    protocolOrigin: 'Solicitud online SERMIG antes de viajar',
    workPermission: 'Vínculo formal con empleador chileno',
    criticalRule: 'Contrato notariado con cláusulas migratorias exigidas',
    summary:
      'Recomendada para profesionales con oferta formal o contrato con empresa chilena activa ante el SII.',
    diagnosticPath: '/diagnostico',
  },
  {
    id: 'renda',
    shortLabel: 'Jubilados / Rentistas',
    routeTitle: 'Jubilados y Rentistas',
    legalBasis: 'Decreto Nº 177/2022 · Subcategoría Rentista',
    protocolOrigin: 'Portal digital SERMIG desde el exterior',
    workPermission: 'Residencia respaldada por ingresos propios',
    criticalRule: 'Respaldo financiero estable, apostillado y traducido',
    summary:
      'Diseñada para jubilados, pensionados e inversionistas con ingresos periódicos lícitos demostrables.',
    diagnosticPath: '/diagnostico',
  },
  {
    id: 'familia',
    shortLabel: 'Reunificación Familiar',
    routeTitle: 'Reunificación Familiar Formalizada',
    legalBasis: 'Ley Nº 21.325 · Art. 19 y Decreto 177/2022',
    protocolOrigin: 'Exterior o hipótesis legal en Chile',
    workPermission: 'Habilita actividades remuneradas al aprobarse',
    criticalRule: 'Certificados civiles vigentes con Apostilla de La Haya',
    summary:
      'Para cónyuges, convivientes civiles, hijos o padres de ciudadanos chilenos o residentes definitivos.',
    diagnosticPath: '/diagnostico',
  },
  {
    id: 'ja_no_chile',
    shortLabel: 'Ya estoy en Chile',
    routeTitle: 'Prórroga, Definitiva o Revisión de Estatus',
    legalBasis: 'Ley Nº 21.325 · Art. 58 · Ventana 90–10 días',
    protocolOrigin: 'Evaluación inmediata del estatus migratorio',
    workPermission: 'Según residencia vigente o comprobante válido',
    criticalRule: 'Ventana legal de 90 a 10 días antes del vencimiento',
    summary:
      'Validamos si corresponde solicitar Residencia Definitiva, prórroga en plazo o estrategia segura si ingresaste como turista.',
    diagnosticPath: '/diagnostico',
  },
];

const JOURNEY_PT: JourneyPhaseItem[] = [
  {
    code: '01',
    title: 'Plano de Mudança & Visto Certo',
    subtitle: 'Escolhemos a rota mais segura e econômica antes de você gastar com cartórios ou passagens.',
    timeframe: 'Dia 1 ao Dia 3',
    deadlineGuard: 'Evitamos o erro clássico de embarcar como turista sem poder pedir o visto de dentro do Chile.',
    portalView: 'Plano de Mudança em PDF + Diagnóstico completo em 7 pilares',
    deliverables: [
      'Indicação exata do visto ideal para você e sua família (com Plano B seguro)',
      'Mapa de riscos preventivos para evitar rejeições ou ordens de saída no Chile',
      'Previsão realista de taxas oficiais, cartórios, traduções e prazo de embarque',
    ],
  },
  {
    code: '02',
    title: 'Documentos Blindados no Brasil',
    subtitle: 'Organizamos cada certidão na ordem certa para nada vencer nem travar no SERMIG.',
    timeframe: 'Semanas 1 a 3',
    deadlineGuard: 'Protegemos a validade curta de 60 dias dos Antecedentes da Polícia Federal com cronograma reverso.',
    portalView: 'Checklist guiado com revisão arquivo por arquivo e alertas automáticos',
    deliverables: [
      'Conferência completa de passaporte, certidões civis e comprovantes de vínculo ou renda',
      'Conexão com cartórios e tradutores juramentados validados — sem pagar a mais nem refazer',
      'Revisão final de nitidez, formato e tamanho de PDF exigidos pelo portal oficial do Chile',
    ],
  },
  {
    code: '03',
    title: 'Protocolo SERMIG & Visto Aprovado',
    subtitle: 'Envio sem erros e acompanhamento de perto até o seu Estampado Electrónico.',
    timeframe: 'Acompanhamento contínuo',
    deadlineGuard: 'Monitoramos cada notificação para responder em tempo hábil caso o SERMIG peça algum complemento.',
    portalView: 'Linha do tempo em 15 etapas + comprovante oficial de protocolo salvo',
    deliverables: [
      'Preenchimento revisado no portal SERMIG (com opção de treino no nosso Simulador)',
      'Controle constante do andamento, despacho de aprovação e pagamento de taxas oficiais',
      'Emissão segura do Estampado Electrónico e orientação para o embarque dentro do prazo',
    ],
  },
  {
    code: '04',
    title: 'Chegada, PDI, RUT & Arriendo Seguro',
    subtitle: 'Acolhimento completo nos primeiros 30 dias para você trabalhar, morar e viver tranquilo.',
    timeframe: 'Primeiros 30 dias no Chile',
    deadlineGuard: 'Cuidamos da janela obrigatória de 30 dias após a chegada para registro na PDI e Cédula (RUT).',
    portalView: 'Roteiro passo a passo pós-chegada + acesso direto à rede homologada no Chile',
    deliverables: [
      'Registro obrigatório na PDI e agendamento da Cédula de Identidade (RUT) no Registro Civil',
      'Ativação da ClaveÚnica, abertura de conta bancária e escolha de plano de saúde (Fonasa/Isapre)',
      'Apoio com imobiliárias homologadas para assinar seu arriendo em UF sem fiador local e sem golpes',
    ],
  },
];

const JOURNEY_ES: JourneyPhaseItem[] = [
  {
    code: '01',
    title: 'Diagnóstico y Estrategia Legal',
    subtitle: 'Definición exacta de la subcategoría antes de invertir en notarías o pasajes.',
    timeframe: 'Día 1 al Día 3',
    deadlineGuard: 'Evaluación de las 16 subcategorías del Decreto Nº 177/2022 y prevención de rechazos.',
    portalView: 'Informe Técnico PDF + Radar de 7 Pilares de Viabilidad',
    deliverables: [
      'Encuadre jurídico principal y ruta alternativa de respaldo',
      'Control preventivo de restricciones de solicitud como turista',
      'Estimación transparente de aranceles SERMIG y plazos reales',
    ],
  },
  {
    code: '02',
    title: 'Preparación Documental y Apostilla',
    subtitle: 'Cronograma inverso que protege certificados de vigencia corta.',
    timeframe: 'Semanas 1 a 3',
    deadlineGuard: 'Antecedentes penales (vigencia de 60 días) gestionados en el orden exacto.',
    portalView: 'Checklist interactivo con validación archivo por archivo y alertas de vigencia',
    deliverables: [
      'Revisión de pasaporte, partidas civiles y respaldos de vínculo o ingresos',
      'Coordinación de Apostilla de La Haya y traducciones oficiales',
      'Auditoría técnica de formato y nitidez exigida por el portal SERMIG',
    ],
  },
  {
    code: '03',
    title: 'Solicitud SERMIG y Estampado',
    subtitle: 'Presentación rigurosa y seguimiento constante hasta la aprobación.',
    timeframe: 'Seguimiento continuo',
    deadlineGuard: 'Monitoreo activo de notificaciones y respuesta oportuna ante subsanaciones.',
    portalView: 'Línea de tiempo transparente en 15 etapas + comprobante oficial',
    deliverables: [
      'Carga y revisión íntegra de la solicitud digital en SERMIG',
      'Control de observaciones, resolución de aprobación y pago de derechos',
      'Descarga guiada del Estampado Electrónico (EE) en plazo',
    ],
  },
  {
    code: '04',
    title: 'Llegada a Chile, PDI y Cédula (RUT)',
    subtitle: 'Integración ordenada en los primeros 30 días para instalarte sin fricción.',
    timeframe: 'Primeros 30 días en Chile',
    deadlineGuard: 'Plazo legal de 30 días corridos para registro en PDI y solicitud de Cédula.',
    portalView: 'Guía post-llegada + acceso directo a red de aliados verificados en Chile',
    deliverables: [
      'Registro obligatorio en PDI y solicitud de Cédula de Identidad en Registro Civil',
      'ClaveÚnica, RUT, orientación bancaria y sistema de salud (Fonasa / Isapre)',
      'Conexión con aliados verificados en vivienda, contabilidad (SII) y educación',
    ],
  },
];

export function getHeroQuickProfiles(locale: 'pt-BR' | 'es-CL'): HeroQuickProfile[] {
  return locale === 'es-CL' ? PROFILES_ES : PROFILES_PT;
}

export function getHeroQuickProfileById(
  id: HeroQuickProfileId,
  locale: 'pt-BR' | 'es-CL',
): HeroQuickProfile {
  const list = getHeroQuickProfiles(locale);
  return list.find((item) => item.id === id) || list[0];
}

export function getJourneyPhases(locale: 'pt-BR' | 'es-CL'): JourneyPhaseItem[] {
  return locale === 'es-CL' ? JOURNEY_ES : JOURNEY_PT;
}
