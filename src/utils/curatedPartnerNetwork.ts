export type OutsourcedPartnerVerticalId = 'imobiliario' | 'juridico' | 'cambio';
export type OutsourcedPartnerFilter = 'todos' | OutsourcedPartnerVerticalId;

export interface DirectImmigrationScopeStep {
  num: string;
  titlePt: string;
  titleEs: string;
  detailPt: string;
  detailEs: string;
}

export interface OutsourcedPartnerVertical {
  id: OutsourcedPartnerVerticalId;
  macroGroupLink: string;
  portraitUrl: string;
  portraitAltPt: string;
  portraitAltEs: string;
  categoryLabelPt: string;
  categoryLabelEs: string;
  sealPt: string;
  sealEs: string;
  titlePt: string;
  titleEs: string;
  regionPt: string;
  regionEs: string;
  summaryPt: string;
  summaryEs: string;
  dmRolePt: string;
  dmRoleEs: string;
  partnerExecutionPt: string;
  partnerExecutionEs: string;
  deliverablesPt: string[];
  deliverablesEs: string[];
  disclaimerPt: string;
  disclaimerEs: string;
  whatsappTopicPt: string;
  whatsappTopicEs: string;
}

export const DIRECT_IMMIGRATION_SCOPE_STEPS: DirectImmigrationScopeStep[] = [
  {
    num: '01',
    titlePt: 'Diagnóstico & Rota de Visto',
    titleEs: 'Diagnóstico y Ruta de Visa',
    detailPt: 'Enquadramento jurídico nas subcategorias da Ley 21.325 e Acordo Mercosul.',
    detailEs: 'Encuadre normativo según Ley 21.325 y Acuerdo Mercosur.',
  },
  {
    num: '02',
    titlePt: 'Dossiê Documental & Apostila',
    titleEs: 'Expediente Documental y Apostilla',
    detailPt: 'Auditoria técnica de certidões, prazos críticos (PF 60d) e traduções.',
    detailEs: 'Auditoría técnica de certificados, vigencias críticas y traducciones.',
  },
  {
    num: '03',
    titlePt: 'Protocolo SERMIG & Estampado',
    titleEs: 'Postulación SERMIG y Estampado',
    detailPt: 'Envio oficial, acompanhamento de exigências e liberação do visto.',
    detailEs: 'Envío oficial, seguimiento de subsanaciones y aprobación de visa.',
  },
  {
    num: '04',
    titlePt: 'Processo de Cédula (RUT)',
    titleEs: 'Proceso de Cédula (RUT)',
    detailPt: 'Orientação completa para agendamento no Registro Civil e emissão do RUT.',
    detailEs: 'Orientación completa para cita en Registro Civil y emisión del RUT.',
  },
];

export const OUTSOURCED_PARTNER_VERTICALS: OutsourcedPartnerVertical[] = [
  {
    id: 'imobiliario',
    macroGroupLink: 'Moradia & Vida',
    portraitUrl: '/src/assets/images/partner_realtor_santiago_1795859850837.jpg',
    portraitAltPt: 'Consultora imobiliária parceira independente em Santiago do Chile',
    portraitAltEs: 'Asesora inmobiliaria aliada independiente en Santiago de Chile',
    categoryLabelPt: 'Serviço Terceirizado · Imobiliário',
    categoryLabelEs: 'Servicio Tercerizado · Inmobiliario',
    sealPt: 'Curadoria D&M · Imobiliário',
    sealEs: 'Curaduría D&M · Inmobiliario',
    titlePt: 'Corretores & Imobiliárias Independentes',
    titleEs: 'Corredores e Inmobiliarias Independientes',
    regionPt: 'Santiago (Providencia, Las Condes, Ñuñoa) & Regiões',
    regionEs: 'Santiago (Providencia, Las Condes, Ñuñoa) y Regiones',
    summaryPt:
      'Profissionais independentes do mercado locatício chileno indicados para busca de imóveis, agendamento de visitas e leitura de exigências de arrendamento.',
    summaryEs:
      'Profesionales independientes del mercado inmobiliario chileno recomendados para búsqueda de vivienda, visitas y requisitos de arriendo.',
    dmRolePt: 'Apenas ponte curada de indicação',
    dmRoleEs: 'Solo puente curado de derivación',
    partnerExecutionPt: 'Busca, visitas e contrato direto com a imobiliária',
    partnerExecutionEs: 'Búsqueda, visitas y contrato directo con la corredora',
    deliverablesPt: [
      'Apoio na busca de imóveis residenciais no Chile',
      'Orientação sobre garantias e requisitos de proprietários locais',
      'Proposta, comissão e contrato 100% diretos com o corretor',
    ],
    deliverablesEs: [
      'Apoyo en búsqueda de vivienda residencial en Chile',
      'Orientación sobre garantías y requisitos de propietarios locales',
      'Propuesta, comisión y contrato 100% directos con el corredor',
    ],
    disclaimerPt:
      'Moradia não é um serviço garantido pela D&M Integra Chile. A aprovação locatícia depende exclusivamente de proprietários e corretoras locais.',
    disclaimerEs:
      'La vivienda no es un servicio garantizado por D&M Integra Chile. La aprobación de arriendo depende exclusivamente de propietarios y corredoras locales.',
    whatsappTopicPt: 'indicação de parceiro imobiliário independente no Chile',
    whatsappTopicEs: 'derivación a un aliado inmobiliario independiente en Chile',
  },
  {
    id: 'juridico',
    macroGroupLink: 'Jurídico & Negócios',
    portraitUrl: '/src/assets/images/partner_lawyer_binational_1795859853922.jpg',
    portraitAltPt: 'Advogado parceiro independente em escritório jurídico binacional',
    portraitAltEs: 'Abogado aliado independiente en estudio jurídico binacional',
    categoryLabelPt: 'Serviço Terceirizado · Jurídico',
    categoryLabelEs: 'Servicio Tercerizado · Jurídico',
    sealPt: 'Curadoria D&M · Jurídico',
    sealEs: 'Curaduría D&M · Legal',
    titlePt: 'Advocacia Contratual, Cível & Societária',
    titleEs: 'Abogacía Contractual, Civil y Societaria',
    regionPt: 'Brasil & Chile · Escritórios Habilitados',
    regionEs: 'Brasil y Chile · Estudios Habilitados',
    summaryPt:
      'Escritórios de advocacia independentes indicados para revisão de contratos de aluguel ou compra, abertura societária, questões trabalhistas ou patrimoniais.',
    summaryEs:
      'Estudios jurídicos independientes recomendados para revisión de contratos de arriendo o compraventa, asuntos societarios, laborales o patrimoniales.',
    dmRolePt: 'Apenas ponte curada de indicação',
    dmRoleEs: 'Solo puente curado de derivación',
    partnerExecutionPt: 'Análise jurídica, honorários e procuração diretos',
    partnerExecutionEs: 'Análisis legal, honorarios y mandato directos',
    deliverablesPt: [
      'Revisão independente de contratos imobiliários e comerciais',
      'Suporte societário, cível, familiar ou patrimonial binacional',
      'Honorários e representação contratados diretamente com o escritório',
    ],
    deliverablesEs: [
      'Revisión independiente de contratos inmobiliarios y comerciales',
      'Soporte societario, civil, familiar o patrimonial binacional',
      'Honorarios y representación contratados directamente con el estudio',
    ],
    disclaimerPt:
      'A D&M atua exclusivamente na assessoria administrativa de imigração (Visto e RUT). Demandas jurídicas complementares são atendidas por advogados independentes.',
    disclaimerEs:
      'D&M actúa exclusivamente en asesoría administrativa migratoria (Visa y RUT). Asuntos legales complementarios son atendidos por abogados independientes.',
    whatsappTopicPt: 'indicação de escritório jurídico independente (contratos / societário)',
    whatsappTopicEs: 'derivación a estudio jurídico independiente (contratos / societario)',
  },
  {
    id: 'cambio',
    macroGroupLink: 'Jurídico & Negócios',
    portraitUrl: '/src/assets/images/partner_fx_exchange_chile_1795862396281.jpg',
    portraitAltPt: 'Especialista em câmbio e remessas internacionais em Santiago do Chile',
    portraitAltEs: 'Especialista en cambio de divisas y remesas internacionales en Santiago de Chile',
    categoryLabelPt: 'Serviço Terceirizado · Câmbio',
    categoryLabelEs: 'Servicio Tercerizado · Cambio',
    sealPt: 'Curadoria D&M · Câmbio',
    sealEs: 'Curaduría D&M · Divisas',
    titlePt: 'Câmbio & Remessas Internacionais BRL ↔ CLP',
    titleEs: 'Cambio y Remesas Internacionales BRL ↔ CLP',
    regionPt: 'Corredor Financeiro Brasil ↔ Chile',
    regionEs: 'Corredor Financiero Brasil ↔ Chile',
    summaryPt:
      'Corretoras e especialistas em câmbio independentes indicados para transferências internacionais regulares, comprovantes de origem de renda e conversão BRL/CLP/USD.',
    summaryEs:
      'Corredoras y especialistas cambiarios independientes recomendados para transferencias internacionales regulares, respaldo de origen de fondos y conversión BRL/CLP/USD.',
    dmRolePt: 'Apenas ponte curada de indicação',
    dmRoleEs: 'Solo puente curado de derivación',
    partnerExecutionPt: 'Cotação, compliance e fechamento direto com a instituição',
    partnerExecutionEs: 'Cotización, cumplimiento y cierre directo con la institución',
    deliverablesPt: [
      'Envio formal Brasil–Chile com instituições reguladas (Bacen / CMF)',
      'Comprovantes cambiais organizados para comprovação patrimonial',
      'Spread, IOF e execução financeira 100% diretos com o parceiro',
    ],
    deliverablesEs: [
      'Envío formal Brasil–Chile con instituciones reguladas (Bacen / CMF)',
      'Comprobantes cambiarios ordenados para respaldo patrimonial',
      'Tipo de cambio, tarifas y ejecución 100% directos con el proveedor',
    ],
    disclaimerPt:
      'A D&M não realiza intermediação financeira nem recebe valores de câmbio. Toda operação ocorre diretamente entre o cliente e a instituição autorizada.',
    disclaimerEs:
      'D&M no realiza intermediación financiera ni recibe fondos de cambio. Toda operación ocurre directamente entre el cliente y la institución autorizada.',
    whatsappTopicPt: 'indicação de parceiro independente de câmbio e remessas BRL–CLP',
    whatsappTopicEs: 'derivación a aliado independiente de cambio y remesas BRL–CLP',
  },
];

export function filterOutsourcedVerticals(
  filter: OutsourcedPartnerFilter,
): OutsourcedPartnerVertical[] {
  if (filter === 'todos') return OUTSOURCED_PARTNER_VERTICALS;
  return OUTSOURCED_PARTNER_VERTICALS.filter((item) => item.id === filter);
}

export function buildOutsourcedReferralWhatsAppMessage(
  vertical: OutsourcedPartnerVertical,
  locale: 'pt-BR' | 'es-CL' = 'pt-BR',
): string {
  if (locale === 'es-CL') {
    return `¡Hola! Vi la Red de Aliados Curada en D&M Integra Chile y quiero solicitar ${vertical.whatsappTopicEs}. Entiendo que D&M actúa exclusivamente como consultoría de inmigración (Visa y RUT) y que la contratación del servicio tercerizado es directa e independiente.`;
  }
  return `Olá! Vi a Rede de Parceiros curada na D&M Integra Chile e gostaria de solicitar ${vertical.whatsappTopicPt}. Ciente de que a D&M atua exclusivamente como consultoria de imigração (Visto e RUT) e que a contratação do serviço terceirizado é direta e independente.`;
}
