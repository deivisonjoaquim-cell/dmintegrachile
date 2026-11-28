import type { PartnerPublic } from '../types/domain';

export interface CuratedTrustedPartnerProfile {
  id: string;
  category: PartnerPublic['categoria'];
  portraitUrl: string;
  portraitAltPt: string;
  portraitAltEs: string;
  sealCodePt: string;
  sealCodeEs: string;
  kickerPt: string;
  kickerEs: string;
  titlePt: string;
  titleEs: string;
  regionPt: string;
  regionEs: string;
  summaryPt: string;
  summaryEs: string;
  bridgeNotePt: string;
  bridgeNoteEs: string;
  validationChecksPt: string[];
  validationChecksEs: string[];
  whatsappTopicPt: string;
  whatsappTopicEs: string;
}

export interface ReferralBridgePillar {
  num: string;
  titlePt: string;
  titleEs: string;
  descPt: string;
  descEs: string;
}

export const PARTNER_PORTRAIT_BY_SPECIALTY = {
  imobiliaria: '/src/assets/images/partner_realtor_santiago_1795859850837.jpg',
  traducao: '/src/assets/images/partner_translator_legal_1795859849850.jpg',
  contabilidade: '/src/assets/images/partner_accountant_spa_1795859851403.jpg',
  advocacia: '/src/assets/images/partner_lawyer_binational_1795859853922.jpg',
} as const;

export const CURATED_TRUSTED_PARTNER_PROFILES: CuratedTrustedPartnerProfile[] = [
  {
    id: 'parceiro-imobiliario-chile',
    category: 'Imobiliária',
    portraitUrl: PARTNER_PORTRAIT_BY_SPECIALTY.imobiliaria,
    portraitAltPt: 'Especialista imobiliária parceira em Santiago do Chile com vista para a Cordilheira',
    portraitAltEs: 'Especialista inmobiliaria aliada en Santiago de Chile con vista a la Cordillera',
    sealCodePt: 'Selo Curadoria D&M · Imobiliário',
    sealCodeEs: 'Sello Curaduría D&M · Inmobiliario',
    kickerPt: 'Indicação Imobiliária Curada',
    kickerEs: 'Derivación Inmobiliaria Curada',
    titlePt: 'Corretores & Imobiliárias de Confiança',
    titleEs: 'Corredores e Inmobiliarias de Confianza',
    regionPt: 'Santiago (Providencia, Las Condes, Ñuñoa) & Regiões',
    regionEs: 'Santiago (Providencia, Las Condes, Ñuñoa) y Regiones',
    summaryPt:
      'Profissionais independentes no mercado imobiliário chileno indicados para orientar busca de apartamentos, visitas e leitura de requisitos locais.',
    summaryEs:
      'Profesionales independientes del mercado inmobiliario chileno recomendados para orientar búsqueda de vivienda, visitas y requisitos locales.',
    bridgeNotePt:
      'A moradia não é um serviço garantido pela D&M: atuamos exclusivamente como ponte de indicação, com contratação direta entre cliente e corretor.',
    bridgeNoteEs:
      'La vivienda no es un servicio garantizado por D&M: actuamos solo como puente de derivación, con contratación directa entre cliente y corredor.',
    validationChecksPt: [
      'Histórico e ética comercial verificados',
      'Experiência real com recém-chegados brasileiros',
      'Contratação e proposta 100% diretas',
    ],
    validationChecksEs: [
      'Historial y ética comercial verificados',
      'Experiencia real con brasileños recién llegados',
      'Contratación y propuesta 100% directas',
    ],
    whatsappTopicPt: 'indicação de parceiro imobiliário de confiança no Chile',
    whatsappTopicEs: 'derivación a un aliado inmobiliario de confianza en Chile',
  },
  {
    id: 'parceiro-traducao-juramentada',
    category: 'Tradutor Juramentado',
    portraitUrl: PARTNER_PORTRAIT_BY_SPECIALTY.traducao,
    portraitAltPt: 'Tradutora juramentada parceira conferindo certidões oficiais em escritório',
    portraitAltEs: 'Traductora jurada aliada revisando certificados oficiales en su estudio',
    sealCodePt: 'Selo Curadoria D&M · Documental',
    sealCodeEs: 'Sello Curaduría D&M · Documental',
    kickerPt: 'Documentação & Tradução Oficial',
    kickerEs: 'Documentación y Traducción Oficial',
    titlePt: 'Tradutores Juramentados PT–ES',
    titleEs: 'Traductores Jurados PT–ES',
    regionPt: 'Atendimento Digital Brasil & Chile',
    regionEs: 'Atención Digital Brasil y Chile',
    summaryPt:
      'Tradutores públicos habilitados indicados para tradução juramentada de certidões civis, diplomas, procurações e documentos exigidos.',
    summaryEs:
      'Traductores públicos habilitados recomendados para traducción oficial de certificados civiles, diplomas y documentos exigidos.',
    bridgeNotePt:
      'A D&M orienta quais documentos exigem tradução no seu visto; a contratação do tradutor e o orçamento são feitos diretamente com o profissional.',
    bridgeNoteEs:
      'D&M orienta qué documentos requieren traducción en tu visa; la contratación y el presupuesto se acuerdan directamente con el traductor.',
    validationChecksPt: [
      'Registro oficial em Junta Comercial / credenciamento',
      'Padrão técnico aceito nos trâmites migratórios',
      'Orçamento direto sem intermediários',
    ],
    validationChecksEs: [
      'Registro oficial y habilitación verificada',
      'Estándar técnico aceptado en trámites migratorios',
      'Presupuesto directo sin intermediarios',
    ],
    whatsappTopicPt: 'indicação de tradutor juramentado PT–ES',
    whatsappTopicEs: 'derivación a traductor jurado PT–ES',
  },
  {
    id: 'parceiro-contabilidade-spa',
    category: 'Contabilidade / Abertura Empresa',
    portraitUrl: PARTNER_PORTRAIT_BY_SPECIALTY.contabilidade,
    portraitAltPt: 'Contador parceiro em escritório corporativo no centro financeiro de Santiago',
    portraitAltEs: 'Contador aliado en oficina corporativa del distrito financiero de Santiago',
    sealCodePt: 'Selo Curadoria D&M · Tributário',
    sealCodeEs: 'Sello Curaduría D&M · Tributario',
    kickerPt: 'Empresas & Tributação no Chile',
    kickerEs: 'Empresas y Tributación en Chile',
    titlePt: 'Contadores & Especialistas SpA / SII',
    titleEs: 'Contadores y Especialistas SpA / SII',
    regionPt: 'Santiago & Atendimento Remoto Chile',
    regionEs: 'Santiago y Atención Remota Chile',
    summaryPt:
      'Contadores independentes indicados para constituição de empresa (SpA), início de atividades no SII e planejamento fiscal pós-RUT.',
    summaryEs:
      'Contadores independientes recomendados para constitución de empresa (SpA), inicio de actividades en el SII y planificación tributaria.',
    bridgeNotePt:
      'Nossa assessoria encerra no Visto e RUT; para demandas contábeis e empresariais, fazemos a ponte com contadores selecionados.',
    bridgeNoteEs:
      'Nuestra asesoría llega hasta Visa y RUT; para necesidades contables y societarias, hacemos el puente con contadores seleccionados.',
    validationChecksPt: [
      'Atuação regular junto ao SII chileno',
      'Clareza em honorários e obrigações mensais',
      'Vínculo contratual independente da D&M',
    ],
    validationChecksEs: [
      'Práctica regular ante el SII chileno',
      'Claridad en honorarios y obligaciones mensuales',
      'Vínculo contractual independiente de D&M',
    ],
    whatsappTopicPt: 'indicação de contador parceiro no Chile (SpA / SII)',
    whatsappTopicEs: 'derivación a contador aliado en Chile (SpA / SII)',
  },
  {
    id: 'parceiro-advocacia-contratual',
    category: 'Escritório de Advocacia',
    portraitUrl: PARTNER_PORTRAIT_BY_SPECIALTY.advocacia,
    portraitAltPt: 'Advogado parceiro binacional em escritório jurídico especializado em contratos',
    portraitAltEs: 'Abogado aliado binacional en estudio jurídico especializado en contratos',
    sealCodePt: 'Selo Curadoria D&M · Jurídico',
    sealCodeEs: 'Sello Curaduría D&M · Legal',
    kickerPt: 'Apoio Jurídico Complementar',
    kickerEs: 'Apoyo Jurídico Complementario',
    titlePt: 'Advocacia Contratual & Patrimonial',
    titleEs: 'Abogacía Contractual y Patrimonial',
    regionPt: 'Brasil & Chile · Atuação Binacional',
    regionEs: 'Brasil y Chile · Práctica Binacional',
    summaryPt:
      'Escritórios independentes indicados para revisão de contratos de locação ou compra, demandas cíveis, societárias ou trabalhistas.',
    summaryEs:
      'Estudios independientes recomendados para revisión de contratos de arriendo o compraventa, asuntos civiles, societarios o laborales.',
    bridgeNotePt:
      'Atuamos como ponte transparente quando surgem demandas jurídicas fora da assessoria administrativa de imigração (SERMIG e RUT).',
    bridgeNoteEs:
      'Actuamos como puente transparente cuando surgen asuntos legales fuera de la asesoría administrativa de inmigración (SERMIG y RUT).',
    validationChecksPt: [
      'Profissionais devidamente habilitados no país de atuação',
      'Análise imparcial de contratos e riscos locais',
      'Atendimento e procuração direta com o escritório',
    ],
    validationChecksEs: [
      'Profesionales debidamente habilitados en su jurisdicción',
      'Revisión imparcial de contratos y riesgos locales',
      'Atención y mandato directo con el estudio',
    ],
    whatsappTopicPt: 'indicação de advogado parceiro para demandas contratuais ou imobiliárias',
    whatsappTopicEs: 'derivación a abogado aliado para contratos o asuntos patrimoniales',
  },
];

export const REFERRAL_BRIDGE_PILLARS: ReferralBridgePillar[] = [
  {
    num: '01',
    titlePt: 'Atuação Exclusiva em Imigração',
    titleEs: 'Enfoque Exclusivo en Inmigración',
    descPt:
      'A D&M Integra Chile atua exclusivamente na assessoria migratória: escolha do visto, dossiê documental, protocolo no SERMIG, Estampado Electrónico e emissão da Cédula (RUT).',
    descEs:
      'D&M Integra Chile actúa exclusivamente en asesoría migratoria: elección de visa, expediente documental, postulación SERMIG, Estampado Electrónico y emisión de la Cédula (RUT).',
  },
  {
    num: '02',
    titlePt: 'Moradia Não É Serviço Garantido',
    titleEs: 'La Vivienda No Es Un Servicio Garantizado',
    descPt:
      'Não prometemos moradia garantida, aprovação automática de aluguel ou dispensa de fiador. O mercado locatício chileno possui regras próprias avaliadas por proprietários e corretoras locais.',
    descEs:
      'No prometemos vivienda garantizada ni aprobación automática de arriendo. El mercado inmobiliario chileno tiene criterios propios evaluados por propietarios y corredoras locales.',
  },
  {
    num: '03',
    titlePt: 'Apenas Ponte de Indicação Curada',
    titleEs: 'Solo Puente de Derivación Curada',
    descPt:
      'Para proteger nossos clientes contra golpes ou improvisos, mantemos curadoria prévia de profissionais imobiliários, tradutores, contadores e advogados e atuamos somente como ponte de contato.',
    descEs:
      'Para proteger a nuestros clientes de estafas o improvisaciones, mantenemos curaduría previa de corredores, traductores, contadores y abogados y actuamos únicamente como puente de contacto.',
  },
  {
    num: '04',
    titlePt: 'Contratação Direta e Autonomia Total',
    titleEs: 'Contratación Directa y Autonomía Total',
    descPt:
      'Você negocia valores, prazos e contratos diretamente com o parceiro indicado — com total liberdade para comparar propostas ou contratar qualquer outro prestador do mercado.',
    descEs:
      'Negocias tarifas, plazos y contratos directamente con el profesional recomendado, con libertad total para comparar propuestas o elegir cualquier otro proveedor.',
  },
];

export function resolvePartnerPortrait(category: string): string {
  switch (category) {
    case 'Imobiliária':
      return PARTNER_PORTRAIT_BY_SPECIALTY.imobiliaria;
    case 'Tradutor Juramentado':
    case 'Cartório / Apostilamento':
      return PARTNER_PORTRAIT_BY_SPECIALTY.traducao;
    case 'Contabilidade / Abertura Empresa':
      return PARTNER_PORTRAIT_BY_SPECIALTY.contabilidade;
    case 'Escritório de Advocacia':
    case 'Seguradora / Saúde':
    case 'Escola / Universidade':
    case 'Despachante':
    default:
      return PARTNER_PORTRAIT_BY_SPECIALTY.advocacia;
  }
}

export function buildPartnerValidationSeals(
  partner: Pick<PartnerPublic, 'categoria' | 'pais' | 'avaliacao'>,
  locale: 'pt-BR' | 'es-CL' = 'pt-BR',
): string[] {
  const isEs = locale === 'es-CL';
  const seals: string[] = [
    isEs ? 'Sello Curaduría D&M' : 'Selo Curadoria D&M',
    isEs ? 'Puente de Indicación Directa' : 'Ponte de Indicação Direta',
  ];
  if (partner.pais === 'Ambos') {
    seals.push(isEs ? 'Cobertura Brasil–Chile' : 'Atuação Brasil–Chile');
  } else if (partner.pais === 'Chile') {
    seals.push(isEs ? 'Especialista Local Chile' : 'Atuação Local no Chile');
  } else {
    seals.push(isEs ? 'Soporte Documental Brasil' : 'Atuação no Brasil');
  }
  return seals;
}
