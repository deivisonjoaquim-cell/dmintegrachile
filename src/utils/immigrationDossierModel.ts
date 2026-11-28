import type { BasicDiagnosticSummary } from './portalAccess';
import type { DiagnosticResult } from './diagnosticEngine';

export interface VisaRutMilestone {
  step: string;
  title: string;
  detail: string;
  windowLabel: string;
}

export interface HousingScopeDisclaimer {
  title: string;
  body: string;
  scopeSummary: string;
}

export interface ImmigrationDossierHighlights {
  documentTitle: string;
  filenamePrefix: string;
  visaHeadline: string;
  rutHeadline: string;
  visaRutMilestones: VisaRutMilestone[];
  housingDisclaimer: HousingScopeDisclaimer;
}

export function buildImmigrationDossierHighlights(params: {
  summary: BasicDiagnosticSummary;
  result?: DiagnosticResult;
  locale?: 'pt-BR' | 'es-CL';
}): ImmigrationDossierHighlights {
  const { summary, result, locale = 'pt-BR' } = params;
  const isEs = locale === 'es-CL';
  const visaName = summary.subcategoriaNome || (isEs ? 'Residencia Temporal en Chile' : 'Residência Temporal no Chile');
  const sermigWindow =
    result?.cronogramaFaixas?.respostaSermig ||
    summary.prazoEstimadoResumo ||
    (isEs ? '3 a 8 meses (referencial SERMIG)' : '3 a 8 meses (referência SERMIG)');

  if (isEs) {
    return {
      documentTitle: 'DOSSIER DE INMIGRACIÓN · VISA (SERMIG) & PROCESO DE RUT',
      filenamePrefix: 'Dossier-Inmigracion-DM-Integra',
      visaHeadline: `Visa recomendada: ${visaName}`,
      rutHeadline: 'Proceso de Cédula de Identidad para Extranjeros (RUT)',
      visaRutMilestones: [
        {
          step: '01',
          title: 'Encuadre y Expediente (Brasil)',
          detail: 'Validación de requisitos, Apostilla de La Haya y certificados vigentes (Antecedentes 60 días).',
          windowLabel: result?.cronogramaFaixas?.preparacaoDocumental || '15 a 35 días',
        },
        {
          step: '02',
          title: 'Postulación Oficial SERMIG',
          detail: `Envío digital en la subcategoría ${summary.subcategoriaCodigo || 'SERMIG'} y gestión de subsanaciones.`,
          windowLabel: sermigWindow,
        },
        {
          step: '03',
          title: 'Estampado Electrónico e Ingreso',
          detail: 'Descarga de visa aprobada e ingreso regular al territorio chileno dentro de la ventana legal.',
          windowLabel: 'Hasta 90 días',
        },
        {
          step: '04',
          title: 'Registro Civil y Emisión del RUT',
          detail: 'Solicitud presencial de Cédula de Identidad para Extranjeros (RUT) tras el ingreso con visa vigente.',
          windowLabel: 'Dentro de 30 días',
        },
      ],
      housingDisclaimer: {
        title: 'AVISO IMPORTANTE · ALCANCE EXCLUSIVO DE INMIGRACIÓN Y NATURALEZA DE LOS SERVICIOS DE MORADÍA',
        scopeSummary:
          'Actuación directa D&M Integra Chile: Consultoría de Inmigración (Visa SERMIG, Estampado Electrónico y proceso de RUT).',
        body:
          'La vivienda/moradia en Chile NO es un servicio garantizado ni ejecutado por D&M Integra Chile. Actuamos exclusivamente como consultoría de inmigración enfocada en visas y emisión del RUT. Para asuntos inmobiliarios, jurídicos complementarios o cambio de divisas, actuamos únicamente como puente de indicación curada hacia socios independientes, con negociación y contratación 100% directa entre el cliente y el proveedor elegido.',
      },
    };
  }

  return {
    documentTitle: 'DOSSIÊ DE IMIGRAÇÃO · VISTO (SERMIG) & PROCESSO DE RUT',
    filenamePrefix: 'Dossie-Imigracao-DM-Integra',
    visaHeadline: `Visto recomendado: ${visaName}`,
    rutHeadline: 'Processo de Emissão da Cédula de Identidade (RUT)',
    visaRutMilestones: [
      {
        step: '01',
        title: 'Dossiê & Certidões (Brasil)',
        detail: 'Conferência técnica, Apostila de Haia CNJ e cronograma reverso (Antecedentes PF válidos por 60 dias).',
        windowLabel: result?.cronogramaFaixas?.preparacaoDocumental || '15 a 35 dias',
      },
      {
        step: '02',
        title: 'Protocolo Oficial no SERMIG',
        detail: `Submissão digital na subcategoria ${summary.subcategoriaCodigo || 'SERMIG'} com acompanhamento de exigências.`,
        windowLabel: sermigWindow,
      },
      {
        step: '03',
        title: 'Estampado Electrónico & Ingresso',
        detail: 'Emissão do Estampado Electrónico após aprovação e entrada regular no Chile dentro do prazo oficial.',
        windowLabel: 'Até 90 dias',
      },
      {
        step: '04',
        title: 'Registro Civil & Emissão do RUT',
        detail: 'Agendamento e solicitação presencial da Cédula de Identidade para Estrangeiros (RUT) no Registro Civil.',
        windowLabel: 'Até 30 dias',
      },
    ],
    housingDisclaimer: {
      title: 'DISCLAIMER DE ESCOPO · ASSESSORIA DE IMIGRAÇÃO (VISTO E RUT) E NATUREZA DOS SERVIÇOS DE MORADIA',
      scopeSummary:
        'Atuação exclusiva D&M Integra Chile: Consultoria de Imigração (Visto SERMIG, Estampado Electrónico e processo de emissão do RUT).',
      body:
        'A moradia no Chile NÃO é um serviço garantido nem executado diretamente pela D&M Integra Chile. Atuamos exclusivamente como consultoria de imigração até o visto aprovado e a emissão do RUT. Demandas de imóveis/aluguel, advocacia complementar e câmbio internacional são serviços terceirizados prestados por parceiros independentes indicados apenas como ponte de confiança, com negociação e contratação 100% diretas entre cliente e prestador.',
    },
  };
}
