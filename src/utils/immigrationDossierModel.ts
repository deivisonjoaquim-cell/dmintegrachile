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

export interface DossierConsultantNotesInput {
  text?: string;
  authorName?: string;
  authorRole?: string;
  updatedAt?: string;
  recommendation?: string;
  legalFoundation?: string;
}

export interface DossierDigitalSignatureInput {
  signerName?: string;
  signerRole?: string;
  signedAt?: string;
  verificationCode?: string;
  signatureDataUrl?: string;
  hashPreview?: string;
}

export interface ResolvedDossierValidationBlock {
  notesTitle: string;
  notesAuthor: string;
  notesUpdatedLabel: string;
  notesBody: string;
  hasCustomNotes: boolean;
  signatureSectionTitle: string;
  signerName: string;
  signerRole: string;
  signedAtIso: string;
  verificationCode: string;
  integrityFingerprint: string;
  signatureDataUrl?: string;
  legalBasisNote: string;
}

function computeDeterministicFingerprint(seed: string): string {
  let h1 = 0xdeadbeef ^ seed.length;
  let h2 = 0x41c6ce57 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const partA = (h1 >>> 0).toString(16).padStart(8, '0');
  const partB = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${partA}${partB}`.toUpperCase();
}

export function buildDossierConsultantValidation(params: {
  protocolo: string;
  clientName: string;
  subcategoriaNome: string;
  empresaResponsavel?: string;
  empresaNome?: string;
  locale?: 'pt-BR' | 'es-CL';
  consultantNotes?: DossierConsultantNotesInput | null;
  digitalSignature?: DossierDigitalSignatureInput | null;
}): ResolvedDossierValidationBlock {
  const {
    protocolo,
    clientName,
    subcategoriaNome,
    empresaResponsavel,
    empresaNome = 'D&M Integra Chile',
    locale = 'pt-BR',
    consultantNotes,
    digitalSignature,
  } = params;

  const isEs = locale === 'es-CL';
  const signedAtIso = digitalSignature?.signedAt || consultantNotes?.updatedAt || new Date().toISOString();

  const noteParts = [
    consultantNotes?.text?.trim(),
    consultantNotes?.recommendation?.trim(),
    consultantNotes?.legalFoundation?.trim(),
  ].filter(Boolean) as string[];
  const hasCustomNotes = noteParts.length > 0;

  const fallbackNotes = isEs
    ? `Expediente preliminar estructurado para ${subcategoriaNome}. Durante la sesión de consultoría, el especialista registrará ajustes documentales, fechas recomendadas para Antecedentes PF (60 días) y el cronograma de ingreso para emisión del RUT.`
    : `Dossiê preliminar estruturado para ${subcategoriaNome}. Durante o atendimento individual, o consultor responsável registra observações específicas de documentos, janela ideal dos Antecedentes PF (60 dias) e cronograma de emissão do RUT.`;

  const signerName =
    (digitalSignature?.signerName || consultantNotes?.authorName || empresaResponsavel || '').trim() ||
    `${empresaNome} — Consultoria Migratória`;
  const signerRole =
    (digitalSignature?.signerRole || consultantNotes?.authorRole || '').trim() ||
    (isEs
      ? 'Responsable Técnico · Consultoría de Inmigración (Visa y RUT)'
      : 'Responsável Técnico · Consultoria de Imigração (Visto e RUT)');

  const seed = `${protocolo}|${clientName}|${subcategoriaNome}|${signerName}|${noteParts.join('|')}`;
  const fp = digitalSignature?.hashPreview?.trim() || computeDeterministicFingerprint(seed);
  const cleanProto = protocolo.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8) || 'DMCL';
  const verificationCode = digitalSignature?.verificationCode?.trim() || `DM-${cleanProto}-${fp.slice(0, 6)}`;

  return {
    notesTitle: isEs
      ? 'NOTAS Y OBSERVACIONES TÉCNICAS DEL CONSULTOR'
      : 'NOTAS E OBSERVAÇÕES TÉCNICAS DO CONSULTOR',
    notesAuthor: (consultantNotes?.authorName || signerName).trim(),
    notesUpdatedLabel: hasCustomNotes
      ? isEs
        ? 'Registro técnico personalizado'
        : 'Parecer / registro técnico personalizado'
      : isEs
        ? 'Espacio técnico reservado para anotaciones del consultor'
        : 'Campo técnico reservado para anotações do consultor',
    notesBody: hasCustomNotes ? noteParts.join(' · ') : fallbackNotes,
    hasCustomNotes,
    signatureSectionTitle: isEs
      ? 'FIRMA DIGITAL Y VALIDACIÓN DEL DOSSIER DE INMIGRACIÓN'
      : 'ASSINATURA DIGITAL E VALIDAÇÃO DO DOSSIÊ DE IMIGRAÇÃO',
    signerName,
    signerRole,
    signedAtIso,
    verificationCode,
    integrityFingerprint: `${fp.slice(0, 4)}-${fp.slice(4, 8)}-${fp.slice(8, 12)}-${fp.slice(12, 16)}`,
    signatureDataUrl: digitalSignature?.signatureDataUrl,
    legalBasisNote: isEs
      ? 'Validación electrónica emitida por D&M Integra Chile (alcance exclusivo de inmigración: Visa SERMIG y RUT). Documento informativo conforme Ley Nº 14.063/2020.'
      : 'Validação eletrônica emitida pela D&M Integra Chile (escopo exclusivo de imigração: Visto SERMIG e RUT). Autenticidade eletrônica nos termos da Lei nº 14.063/2020.',
  };
}

