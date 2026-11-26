import type { Client, Dependent, EmpresaConfig, VisaCategory, VisaRequirement } from '../types/domain';

export type SermigPortalStepId =
  | 'acceso'
  | 'tramite'
  | 'datos_personales'
  | 'identificacion_domicilio'
  | 'documentos'
  | 'revision_declaracion'
  | 'comprobante';

export type SermigAuthMethod = 'cuenta_sermig' | 'clave_unica';

export type SermigTramiteType = 'rt_exterior' | 'rt_chile' | 'rd_definitiva';

export interface SermigSimulatedDependent {
  id: string;
  nombreCompleto: string;
  parentesco: 'Cónyuge / Conviviente' | 'Hijo(a) menor' | 'Hijo(a) estudiante' | 'Padre / Madre';
  fechaNacimiento: string;
  numeroDocumento: string;
}

export interface SermigDocumentSlot {
  id: string;
  codigoCampoSermig: string;
  nombreEspanol: string;
  nombrePortugues: string;
  descripcionGuia: string;
  obrigatorio: boolean;
  accepts: 'pdf' | 'image' | 'pdf_or_image';
  maxSizeMb: number;
  exigeApostila: boolean;
  exigeTraducao: boolean;
  validadeDias?: number;
  isAntecedentesPf?: boolean;
}

export interface SermigUploadedAttachment {
  slotId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  simulatedSample?: boolean;
  dataEmissao?: string;
  apostilaConfirmada?: boolean;
  traducaoConfirmada?: boolean;
  attachedAtIso: string;
}

export interface SermigPortalFormState {
  // Etapa 0: Acceso
  authMethod: SermigAuthMethod;
  loginEmail: string;
  loginRun: string;
  loginPassword: string;
  authenticated: boolean;

  // Etapa 1: Trámite
  tramiteType: SermigTramiteType;
  visaCategoryId: string;
  possuiResidenciaVigenteChile: boolean;
  vinculoFamiliarChile: boolean;

  // Etapa 2: Antecedentes Personales
  nombres: string;
  primerApellido: string;
  segundoApellido: string;
  fechaNacimiento: string;
  sexo: 'Femenino' | 'Masculino' | 'No binario';
  estadoCivil: 'Soltero(a)' | 'Casado(a)' | 'Unión Civil' | 'Divorciado(a)' | 'Viudo(a)';
  paisNacimiento: string;
  nacionalidad: string;
  correoNotificacion: string;
  confirmarCorreo: string;
  telefonoContacto: string;

  // Etapa 3: Identificación, Domicilio y Dependientes
  tipoDocumento: 'Pasaporte' | 'Cédula de Identidad / RG (Mercosur)';
  numeroDocumento: string;
  paisEmisor: string;
  fechaEmisionDoc: string;
  fechaVencimientoDoc: string;
  paisResidenciaActual: string;
  ciudadResidencia: string;
  direccionResidencia: string;
  regionDestinoChile: string;
  comunaDestinoChile: string;
  nivelEducacional: string;
  actividadProfesion: string;
  dependientes: SermigSimulatedDependent[];

  // Etapa 4: Carga de Documentos
  attachments: Record<string, SermigUploadedAttachment>;

  // Etapa 5: Declaración Jurada
  declaraVeracidad: boolean;
  aceptaNotificacionElectronica: boolean;
  captchaVerificado: boolean;
}

export interface SermigValidationIssue {
  field: string;
  severity: 'error' | 'warning';
  message: string;
  legalRef?: string;
}

export interface SermigStepValidationResult {
  valid: boolean;
  errors: SermigValidationIssue[];
  warnings: SermigValidationIssue[];
}

export interface SermigStepMeta {
  id: SermigPortalStepId;
  order: number;
  urlPath: string;
  labelEs: string;
  labelPt: string;
  guideTitle: string;
  guideSummary: string;
  commonMistakes: string[];
  proTip: string;
}

export interface SermigSimulatedReceipt {
  folioSolicitud: string;
  codigoVerificacion: string;
  fechaHoraIngresoIso: string;
  tramiteLabelEs: string;
  subcategoriaEs: string;
  subcategoriaPt: string;
  titularCompleto: string;
  documentoResumo: string;
  correoNotificacion: string;
  totalDependientes: number;
  totalDocumentosAnexados: number;
  taxaEstimadaUsd: number;
  taxaEstimadaBrl: number;
  readinessScore: number;
  passedChecks: string[];
  warnings: SermigValidationIssue[];
  proximasEtapasReais: {
    ordem: number;
    titulo: string;
    prazoReferencia: string;
    detalhe: string;
  }[];
}

export const SERMIG_MAX_FILE_MB = 5;
export const SERMIG_MAX_FILE_BYTES = SERMIG_MAX_FILE_MB * 1024 * 1024;
export const SERMIG_PF_MAX_AGE_DAYS = 60;

export const SERMIG_TRAMITE_OPTIONS: {
  id: SermigTramiteType;
  tituloEs: string;
  subtituloPt: string;
  descripcionEs: string;
  artigoLegal: string;
}[] = [
  {
    id: 'rt_exterior',
    tituloEs: 'Solicitud de Residencia Temporal para Extranjeros Fuera de Chile',
    subtituloPt: 'Protocolo a partir do Brasil / Exterior (Regra Geral)',
    descripcionEs:
      'Para personas extranjeras que solicitan por primera vez un permiso de Residencia Temporal desde fuera del territorio chileno.',
    artigoLegal: 'Ley Nº 21.325, Art. 69 · Decreto Supremo Nº 177/2022',
  },
  {
    id: 'rt_chile',
    tituloEs: 'Solicitud de Residencia Temporal dentro de Chile',
    subtituloPt: 'Prorrogação, Mudança de Subcategoria ou Exceção de Vínculo Familiar',
    descripcionEs:
      'Disponible para prórrogas, cambios de subcategoría de residentes vigentes o casos excepcionales de reunificación familiar contemplados en la ley.',
    artigoLegal: 'Ley Nº 21.325, Art. 69 inc. 2º · Decreto Nº 296/2022',
  },
  {
    id: 'rd_definitiva',
    tituloEs: 'Solicitud de Residencia Definitiva',
    subtituloPt: 'Para residentes temporários dentro da janela legal (90 a 10 dias)',
    descripcionEs:
      'Permiso para radicarse indefinidamente en Chile. Requiere haber sido titular de Residencia Temporal y postular entre 90 y 10 días antes de su vencimiento.',
    artigoLegal: 'Ley Nº 21.325, Arts. 78 y 79',
  },
];

export const CHILE_REGIONS: { region: string; comunas: string[] }[] = [
  {
    region: 'Región Metropolitana de Santiago',
    comunas: ['Providencia', 'Las Condes', 'Santiago Centro', 'Ñuñoa', 'Vitacura', 'La Reina', 'San Miguel', 'Maipú'],
  },
  {
    region: 'Región de Valparaíso',
    comunas: ['Viña del Mar', 'Valparaíso', 'Concón', 'Quilpué', 'Villa Alemana'],
  },
  {
    region: 'Región del Biobío',
    comunas: ['Concepción', 'San Pedro de la Paz', 'Talcahuano', 'Chiguayante'],
  },
  {
    region: 'Región de Los Lagos',
    comunas: ['Puerto Montt', 'Puerto Varas', 'Osorno', 'Castro'],
  },
  {
    region: 'Región de Antofagasta',
    comunas: ['Antofagasta', 'Calama', 'Mejillones'],
  },
  {
    region: 'Región de Coquimbo',
    comunas: ['La Serena', 'Coquimbo', 'Ovalle'],
  },
  {
    region: 'Región de La Araucanía',
    comunas: ['Temuco', 'Pucón', 'Villarrica'],
  },
];

export const SERMIG_PORTAL_STEPS: SermigStepMeta[] = [
  {
    id: 'acceso',
    order: 0,
    urlPath: '/login',
    labelEs: 'Acceso Portal',
    labelPt: 'Login SERMIG',
    guideTitle: 'Etapa 0 · Como acessar o Portal de Trámites Digitales',
    guideSummary:
      'Brasileiros solicitando a primeira residência fora do Chile ainda não possuem RUN/ClaveÚnica. Por isso, o acesso correto é criando ou entrando com uma "Cuenta SERMIG" (e-mail + senha).',
    commonMistakes: [
      'Tentar entrar com ClaveÚnica sem ainda possuir Cédula de Identidade chilena (RUN).',
      'Usar um e-mail temporário ou corporativo que pode ser perdido antes da aprovação.',
    ],
    proTip:
      'Use o mesmo e-mail pessoal que você acessa diariamente no celular — todas as intimações de subsanación (prazo curto de 5 dias úteis) chegam por ali.',
  },
  {
    id: 'tramite',
    order: 1,
    urlPath: '/tramites/seleccion',
    labelEs: '1. Trámite',
    labelPt: 'Escolha do Trâmite',
    guideTitle: 'Etapa 1 · Escolha do Trâmite e Subcategoria Correta',
    guideSummary:
      'No portal oficial, escolher o formulário errado ("Fuera de Chile" vs "Dentro de Chile") é a causa nº 1 de arquivamento ou inadmissibilidade.',
    commonMistakes: [
      'Entrar como turista no Chile e tentar protocolar Acordo Mercosul no formulário "Dentro de Chile".',
      'Selecionar subcategoria que exige contrato de trabalho quando o enquadramento ideal é Mercosul.',
    ],
    proTip:
      'Para a primeira Residência Temporal a partir do Brasil, selecione "Solicitud de Residencia Temporal para Extranjeros Fuera de Chile".',
  },
  {
    id: 'datos_personales',
    order: 2,
    urlPath: '/solicitud/antecedentes-personales',
    labelEs: '2. Datos Personales',
    labelPt: 'Dados Pessoais',
    guideTitle: 'Etapa 2 · Preenchimento Exato de Nomes e Sobrenomes',
    guideSummary:
      'O sistema chileno separa "Nombres", "Primer Apellido" e "Segundo Apellido". A grafia deve espelhar exatamente a zona MRZ do passaporte brasileiro.',
    commonMistakes: [
      'Digitar o nome completo inteiro no campo "Nombres" e repetir no "Primer Apellido".',
      'Errar uma letra no campo "Correo Electrónico de Notificación" e nunca receber a Orden de Giro.',
    ],
    proTip:
      'Em nomes brasileiros (ex.: João Pedro Silva Souza), coloque "João Pedro" em Nombres, "Silva" em Primer Apellido e "Souza" em Segundo Apellido.',
  },
  {
    id: 'identificacion_domicilio',
    order: 3,
    urlPath: '/solicitud/identificacion-domicilio',
    labelEs: '3. Documento y Destino',
    labelPt: 'Passaporte e Destino',
    guideTitle: 'Etapa 3 · Documento de Viagem, Endereço e Dependentes',
    guideSummary:
      'Informe o passaporte (ou RG com menos de 10 anos no caso de Mercosul) que será usado no embarque, além da região/comuna onde pretende residir no Chile.',
    commonMistakes: [
      'Protocolar com passaporte prestes a vencer (< 6 ou 12 meses) e precisar trocar de número antes do Estampado.',
      'Esquecer de cadastrar cônjuge ou filhos acompanhantes no mesmo fluxo familiar.',
    ],
    proTip:
      'O endereço no Chile nesta etapa pode ser o endereço provisório previsto (Airbnb, familiar ou comuna-alvo). Ele poderá ser atualizado depois.',
  },
  {
    id: 'documentos',
    order: 4,
    urlPath: '/solicitud/carga-documentos',
    labelEs: '4. Documentos',
    labelPt: 'Upload de PDFs',
    guideTitle: 'Etapa 4 · Upload de Documentos (Regra de 5 MB, PDF e 60 dias PF)',
    guideSummary:
      'Cada campo do portal SERMIG aceita arquivos PDF legíveis de até 5 MB (e foto digital em JPG/PNG). Documentos brasileiros precisam estar apostilados (Haia/CNJ).',
    commonMistakes: [
      'Subir a Certidão de Antecedentes da Polícia Federal com mais de 60 dias da data de emissão.',
      'Anexar apenas a certidão brasileira sem juntar a folha da Apostila de Haia no mesmo PDF.',
      'Enviar arquivo maior que 5 MB ou fotografia com fundo escuro/sombra.',
    ],
    proTip:
      'Junte o documento original + folha da Apostila CNJ em um único PDF nítido abaixo de 5 MB antes de anexar no campo correspondente.',
  },
  {
    id: 'revision_declaracion',
    order: 5,
    urlPath: '/solicitud/revision-envio',
    labelEs: '5. Revisión y Envío',
    labelPt: 'Revisão e Declaração',
    guideTitle: 'Etapa 5 · Conferência Final e Declaração Jurada',
    guideSummary:
      'Antes de clicar em "Enviar Solicitud", revise nome, nº do documento, e-mail e cada PDF anexado. Após o envio, alterações exigem subsanación formal.',
    commonMistakes: [
      'Enviar sem confirmar o e-mail de notificação eletrônica (Art. 146 Ley 21.325).',
      'Não baixar imediatamente o Comprobante de Ingreso gerado na tela seguinte.',
    ],
    proTip:
      'No portal real do SERMIG não há cobrança de taxa neste momento! O pagamento (Orden de Giro) só é liberado meses depois, quando o visto é aprovado.',
  },
  {
    id: 'comprobante',
    order: 6,
    urlPath: '/solicitud/comprobante-ingreso',
    labelEs: '6. Comprobante',
    labelPt: 'Comprovante Simulado',
    guideTitle: 'Etapa 6 · Comprovante de Ingreso & Auditoria do Treino',
    guideSummary:
      'Parabéns! Você concluiu a simulação completa do protocolo SERMIG. Guarde o resumo abaixo e confira o relatório de prontidão antes de fazer o envio oficial.',
    commonMistakes: [
      'Achar que o comprovante de ingresso já autoriza viajar para trabalhar no Chile (é necessário aguardar aprovação + Estampado Electrónico).',
    ],
    proTip:
      'No processo real, anote o Número de Solicitud (ID) e acompanhe a caixa de entrada e spam do seu e-mail semanalmente.',
  },
];

export function resolveSimulatedVisa(
  visaCategories: VisaCategory[],
  visaId?: string,
  visaCode?: string,
): VisaCategory {
  if (visaId) {
    const byId = visaCategories.find((v) => v.id === visaId);
    if (byId) return byId;
  }
  if (visaCode) {
    const norm = visaCode.trim().toUpperCase();
    const byCode = visaCategories.find((v) => v.codigo.trim().toUpperCase() === norm);
    if (byCode) return byCode;
  }
  const mercosul = visaCategories.find((v) => v.codigo === '15' || v.id.includes('mercosul'));
  if (mercosul) return mercosul;
  if (visaCategories.length > 0) return visaCategories[0];

  return {
    id: 'visa_mercosul_fallback',
    codigo: '15',
    nomeEspanhol: 'Residencia Temporal por Acuerdos Internacionales (Mercosur)',
    nomePortugues: 'Residência Temporal – Acordo Mercosul',
    descricao: 'Residência temporal por reciprocidade do Acordo Mercosul para cidadãos brasileiros.',
    publicoAlvo: 'Brasileiros com documentação civil e antecedentes em ordem',
    permiteDentroChile: 'Não',
    vigenciaMeses: 24,
    permiteTrabalhar: true,
    levaDefinitiva: true,
    mesesDefinitiva: 24,
    exigeRenda: false,
    brasileirosElegiveis: true,
    ativo: true,
    fonteUrl: 'https://serviciomigraciones.cl/residencia-temporal/acuerdos-internacionales/',
    statusVerificacao: 'Verificado',
  };
}

function splitFullNameForSermig(fullName: string): {
  nombres: string;
  primerApellido: string;
  segundoApellido: string;
} {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { nombres: '', primerApellido: '', segundoApellido: '' };
  if (parts.length === 1) return { nombres: parts[0], primerApellido: '', segundoApellido: '' };
  if (parts.length === 2) return { nombres: parts[0], primerApellido: parts[1], segundoApellido: '' };
  if (parts.length === 3) {
    return { nombres: parts[0], primerApellido: parts[1], segundoApellido: parts[2] };
  }
  return {
    nombres: parts.slice(0, parts.length - 2).join(' '),
    primerApellido: parts[parts.length - 2],
    segundoApellido: parts[parts.length - 1],
  };
}

function addDaysIso(baseDate: Date, deltaDays: number): string {
  const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate() + deltaDays));
  return d.toISOString().slice(0, 10);
}

export function createInitialSermigPortalState(params: {
  visaCategories: VisaCategory[];
  initialVisaId?: string;
  client?: Client | null;
  dependents?: Dependent[];
  now?: Date;
}): SermigPortalFormState {
  const now = params.now || new Date();
  const visa = resolveSimulatedVisa(params.visaCategories, params.initialVisaId);
  const client = params.client;
  const splitName = splitFullNameForSermig(client?.nomeCompleto || '');

  const mappedDependents: SermigSimulatedDependent[] = (params.dependents || []).map((d, idx) => ({
    id: d.id || `dep_sim_${idx + 1}`,
    nombreCompleto: d.nomeCompleto || '',
    parentesco:
      d.parentesco === 'Cônjuge' || d.parentesco === 'Companheiro(a)'
        ? 'Cónyuge / Conviviente'
        : d.parentesco === 'Filho(a)' || d.parentesco === 'Enteado(a)'
          ? d.estudante
            ? 'Hijo(a) estudiante'
            : 'Hijo(a) menor'
          : 'Padre / Madre',
    fechaNacimiento: d.dataNascimento?.slice(0, 10) || '',
    numeroDocumento: d.passaporteNumero || d.cpf || '',
  }));

  return {
    authMethod: 'cuenta_sermig',
    loginEmail: client?.email || '',
    loginRun: '',
    loginPassword: '',
    authenticated: false,

    tramiteType: visa.codigo === 'DEF' ? 'rd_definitiva' : 'rt_exterior',
    visaCategoryId: visa.id,
    possuiResidenciaVigenteChile: visa.codigo === 'DEF' || visa.codigo === 'PRORR',
    vinculoFamiliarChile: visa.codigo === '01',

    nombres: splitName.nombres,
    primerApellido: splitName.primerApellido,
    segundoApellido: splitName.segundoApellido,
    fechaNacimiento: client?.dataNascimento?.slice(0, 10) || '',
    sexo: 'Masculino',
    estadoCivil:
      client?.estadoCivil === 'Casado(a)'
        ? 'Casado(a)'
        : client?.estadoCivil === 'União Estável'
          ? 'Unión Civil'
          : client?.estadoCivil === 'Divorciado(a)'
            ? 'Divorciado(a)'
            : client?.estadoCivil === 'Viúvo(a)'
              ? 'Viudo(a)'
              : 'Soltero(a)',
    paisNacimiento: 'Brasil',
    nacionalidad: client?.nacionalidade || 'Brasileña',
    correoNotificacion: client?.email || '',
    confirmarCorreo: client?.email || '',
    telefonoContacto: client?.whatsapp || '',

    tipoDocumento: 'Pasaporte',
    numeroDocumento: client?.passaporte?.numero || '',
    paisEmisor: 'Brasil',
    fechaEmisionDoc: client?.passaporte?.emissao?.slice(0, 10) || addDaysIso(now, -365 * 2),
    fechaVencimientoDoc: client?.passaporte?.validade?.slice(0, 10) || addDaysIso(now, 365 * 5),
    paisResidenciaActual: 'Brasil',
    ciudadResidencia: client?.naturalidade || 'São Paulo, SP',
    direccionResidencia: client?.enderecoCompleto || '',
    regionDestinoChile: 'Región Metropolitana de Santiago',
    comunaDestinoChile: 'Providencia',
    nivelEducacional: 'Educación Superior Completa',
    actividadProfesion: client?.profissao || '',
    dependientes: mappedDependents,

    attachments: {},

    declaraVeracidad: false,
    aceptaNotificacionElectronica: false,
    captchaVerificado: false,
  };
}

/**
 * Monta os campos reais de upload de documento exibidos na etapa "Carga de Documentos"
 * do Portal SERMIG de acordo com a subcategoria selecionada e dependentes incluídos.
 */
export function buildSermigDocumentSlots(
  visa: VisaCategory,
  visaRequirements: VisaRequirement[],
  dependentsCount = 0,
): SermigDocumentSlot[] {
  const isMercosul = visa.codigo === '15' || visa.id.includes('mercosul');
  const slots: SermigDocumentSlot[] = [
    {
      id: 'slot_foto_carnet',
      codigoCampoSermig: 'DOC-01 · Fotografía',
      nombreEspanol: 'Fotografía digital tamaño carnet (fondo blanco)',
      nombrePortugues: 'Foto digital tipo documento 3x4 (fundo branco, sem óculos)',
      descripcionGuia:
        'Rosto centralizado, boa iluminação, fundo totalmente branco, formato JPG ou PNG até 5 MB.',
      obrigatorio: true,
      accepts: 'image',
      maxSizeMb: SERMIG_MAX_FILE_MB,
      exigeApostila: false,
      exigeTraducao: false,
    },
    {
      id: 'slot_pasaporte',
      codigoCampoSermig: 'DOC-02 · Identificación',
      nombreEspanol: 'Hoja de identificación del Pasaporte vigente (o RG Mercosur)',
      nombrePortugues: 'Página de identificação do Passaporte (ou RG para Mercosul)',
      descripcionGuia:
        'Digitalização colorida e legível das páginas com foto, assinatura e número do documento em PDF.',
      obrigatorio: true,
      accepts: 'pdf_or_image',
      maxSizeMb: SERMIG_MAX_FILE_MB,
      exigeApostila: false,
      exigeTraducao: false,
    },
    {
      id: 'slot_antecedentes_pf',
      codigoCampoSermig: 'DOC-03 · Antecedentes Penales',
      nombreEspanol: 'Certificado de Antecedentes Penales (Policía Federal) + Apostilla de La Haya',
      nombrePortugues: 'Certidão de Antecedentes Criminais (PF) + Apostila CNJ',
      descripcionGuia:
        'Regra crítica SERMIG: deve ter no máximo 60 dias da data de emissão no dia do protocolo e conter a Apostila de Haia no mesmo PDF.',
      obrigatorio: true,
      accepts: 'pdf',
      maxSizeMb: SERMIG_MAX_FILE_MB,
      exigeApostila: true,
      exigeTraducao: false,
      validadeDias: SERMIG_PF_MAX_AGE_DAYS,
      isAntecedentesPf: true,
    },
  ];

  // Agrega documentos específicos da subcategoria a partir dos VisaRequirements reais do catálogo
  const matchedReqs = visaRequirements
    .filter((r) => r.visaCategoryId === visa.id)
    .sort((a, b) => (a.ordemPrioridadeEmissao || 99) - (b.ordemPrioridadeEmissao || 99));

  const seenNames = new Set<string>(['passaporte', 'antecedentes', 'foto']);
  let extraCounter = 4;

  for (const req of matchedReqs) {
    const lower = req.nomeDocumento.toLowerCase();
    if (
      lower.includes('passaporte') ||
      lower.includes('antecedentes') ||
      lower.includes('foto') ||
      seenNames.has(lower)
    ) {
      continue;
    }
    seenNames.add(lower);
    slots.push({
      id: `slot_req_${req.id}`,
      codigoCampoSermig: `DOC-0${extraCounter} · Requisito Subcategoría`,
      nombreEspanol: req.nomeDocumento,
      nombrePortugues: req.nomeDocumento,
      descripcionGuia:
        req.comoObterInstrucoes ||
        req.descricao ||
        `Documento exigido para a subcategoria ${visa.nomePortugues}. Digitalize em PDF legível (máx. 5 MB).`,
      obrigatorio: req.obrigatorio,
      accepts: 'pdf',
      maxSizeMb: SERMIG_MAX_FILE_MB,
      exigeApostila: req.exigeApostila,
      exigeTraducao: isMercosul ? false : req.exigeTraducao,
      validadeDias: req.validadeDias,
    });
    extraCounter += 1;
    if (slots.length >= 7) break;
  }

  // Fallback se não houver requisitos extras no seed para a categoria selecionada
  if (slots.length === 3) {
    slots.push({
      id: 'slot_certidao_civil',
      codigoCampoSermig: 'DOC-04 · Estado Civil / Filiación',
      nombreEspanol: 'Certificado de Nacimiento o Matrimonio Apostillado',
      nombrePortugues: 'Certidão de Nascimento ou Casamento + Apostila de Haia',
      descripcionGuia:
        'Emitida em cartório brasileiro e apostilada (CNJ). Para Acordo Mercosul, a tradução costuma ser dispensada pelo Decreto Nº 5.852/2006.',
      obrigatorio: true,
      accepts: 'pdf',
      maxSizeMb: SERMIG_MAX_FILE_MB,
      exigeApostila: true,
      exigeTraducao: !isMercosul,
      validadeDias: 180,
    });
    extraCounter = 5;
  }

  if (dependentsCount > 0) {
    slots.push({
      id: 'slot_vinculo_dependientes',
      codigoCampoSermig: `DOC-0${extraCounter} · Dependientes (${dependentsCount})`,
      nombreEspanol: `Acreditación de Vínculo Familiar y Pasaportes de Dependientes (${dependentsCount})`,
      nombrePortugues: `Certidões Apostiladas + Passaportes dos ${dependentsCount} Dependente(s)`,
      descripcionGuia:
        'Anexe em PDF único a certidão de casamento/união estável ou certidão de nascimento apostilada de cada dependente incluído na solicitação.',
      obrigatorio: true,
      accepts: 'pdf',
      maxSizeMb: SERMIG_MAX_FILE_MB,
      exigeApostila: true,
      exigeTraducao: !isMercosul,
    });
  }

  return slots;
}

/**
 * Valida um arquivo anexado segundo as regras reais do portal tramites.extranjeria.gob.cl
 */
export function validateSermigAttachmentFile(
  file: { name: string; size: number; type?: string },
  slot: SermigDocumentSlot,
): { ok: boolean; error?: string } {
  if (!file.name || file.size <= 0) {
    return { ok: false, error: 'Arquivo vazio ou inválido. Selecione um documento legível.' };
  }
  if (file.size > slot.maxSizeMb * 1024 * 1024) {
    return {
      ok: false,
      error: `Arquivo excede o limite oficial do SERMIG de ${slot.maxSizeMb} MB (${(file.size / (1024 * 1024)).toFixed(1)} MB enviados). Comprima o PDF antes de subir.`,
    };
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isPdf = ext === 'pdf' || file.type === 'application/pdf';
  const isImage = ['jpg', 'jpeg', 'png'].includes(ext) || (file.type || '').startsWith('image/');

  if (slot.accepts === 'pdf' && !isPdf) {
    return {
      ok: false,
      error: 'O portal SERMIG exige formato PDF (.pdf) para este documento. Converta a imagem para PDF.',
    };
  }
  if (slot.accepts === 'image' && !isImage) {
    return {
      ok: false,
      error: 'Para a fotografia digital carnet, envie uma imagem JPG ou PNG (fundo branco).',
    };
  }
  if (slot.accepts === 'pdf_or_image' && !isPdf && !isImage) {
    return {
      ok: false,
      error: 'Formato não aceito pelo SERMIG. Envie em PDF, JPG ou PNG.',
    };
  }
  return { ok: true };
}

function diffDaysBetweenIso(fromIso: string, toDate: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test((fromIso || '').trim())) return null;
  const [y, m, d] = fromIso.split('-').map(Number);
  const fromUtc = Date.UTC(y, m - 1, d);
  const toUtc = Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate());
  return Math.floor((toUtc - fromUtc) / 86_400_000);
}

/**
 * Valida cada etapa do simulador do Portal de Entrada SERMIG com rigor normativo real.
 */
export function validateSermigPortalStep(
  step: SermigPortalStepId,
  state: SermigPortalFormState,
  visaCategories: VisaCategory[],
  visaRequirements: VisaRequirement[],
  now = new Date(),
): SermigStepValidationResult {
  const errors: SermigValidationIssue[] = [];
  const warnings: SermigValidationIssue[] = [];
  const visa = resolveSimulatedVisa(visaCategories, state.visaCategoryId);

  if (step === 'acceso') {
    if (state.authMethod === 'cuenta_sermig') {
      if (!state.loginEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.loginEmail.trim())) {
        errors.push({
          field: 'loginEmail',
          severity: 'error',
          message: 'Informe um correo electrónico válido para simular o login na Cuenta SERMIG.',
        });
      }
    } else {
      const cleanRun = state.loginRun.replace(/[.\-\s]/g, '');
      if (cleanRun.length < 7) {
        errors.push({
          field: 'loginRun',
          severity: 'error',
          message: 'Informe um RUN chileno simulado válido (ex.: 25.123.456-7) para acessar via ClaveÚnica.',
        });
      }
      warnings.push({
        field: 'authMethod',
        severity: 'warning',
        message:
          'Atenção: ClaveÚnica só está disponível para quem já possui RUN/Cédula no Chile. Para primeira residência do Brasil, utilize "Cuenta SERMIG".',
      });
    }
    if (!state.loginPassword.trim() || state.loginPassword.trim().length < 4) {
      errors.push({
        field: 'loginPassword',
        severity: 'error',
        message: 'Digite uma senha fictícia de treino (mínimo 4 caracteres) para simular o acesso.',
      });
    }
  }

  if (step === 'tramite') {
    if (!state.visaCategoryId) {
      errors.push({
        field: 'visaCategoryId',
        severity: 'error',
        message: 'Selecione a subcategoria migratória desejada no menu do portal.',
      });
    }
    const isReunificacao = visa.codigo === '01' || visa.id.includes('reunific');
    const isDefinitiva = visa.codigo === 'DEF';

    if (state.tramiteType === 'rt_chile') {
      const canInside =
        state.possuiResidenciaVigenteChile ||
        visa.permiteDentroChile === 'Sim' ||
        (isReunificacao && state.vinculoFamiliarChile);
      if (!canInside) {
        errors.push({
          field: 'tramiteType',
          severity: 'error',
          message: `Bloqueio Ley Nº 21.325: a subcategoria "${visa.nomePortugues}" não permite primeira solicitação como turista dentro do Chile. Selecione "Extranjeros Fuera de Chile" ou marque se já possui Residência Temporal vigente.`,
          legalRef: 'Ley Nº 21.325, Art. 69 · Decreto Supremo Nº 177/2022',
        });
      }
    }

    if (state.tramiteType === 'rd_definitiva' && !state.possuiResidenciaVigenteChile) {
      errors.push({
        field: 'possuiResidenciaVigenteChile',
        severity: 'error',
        message:
          'A Solicitud de Residencia Definitiva exige titularidade prévia de Residência Temporal vigente no Chile (protocolo entre 90 e 10 dias antes do vencimento).',
        legalRef: 'Ley Nº 21.325, Arts. 78 e 79',
      });
    }

    if (state.tramiteType === 'rt_exterior' && isDefinitiva) {
      errors.push({
        field: 'visaCategoryId',
        severity: 'error',
        message: 'Residência Definitiva deve ser solicitada no trâmite "Solicitud de Residencia Definitiva".',
      });
    }
  }

  if (step === 'datos_personales') {
    if (!state.nombres.trim() || state.nombres.trim().length < 2) {
      errors.push({
        field: 'nombres',
        severity: 'error',
        message: 'Campo obrigatório SERMIG: informe seus "Nombres" conforme o passaporte.',
      });
    }
    if (!state.primerApellido.trim() || state.primerApellido.trim().length < 2) {
      errors.push({
        field: 'primerApellido',
        severity: 'error',
        message: 'Campo obrigatório SERMIG: informe o "Primer Apellido" (não deixe tudo junto no campo Nombres).',
      });
    }
    if (!state.fechaNacimiento.trim()) {
      errors.push({
        field: 'fechaNacimiento',
        severity: 'error',
        message: 'Informe sua Fecha de Nacimiento.',
      });
    }
    if (!state.correoNotificacion.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.correoNotificacion.trim())) {
      errors.push({
        field: 'correoNotificacion',
        severity: 'error',
        message: 'Informe um Correo Electrónico de Notificación válido.',
      });
    }
    if (
      state.correoNotificacion.trim().toLowerCase() !== state.confirmarCorreo.trim().toLowerCase()
    ) {
      errors.push({
        field: 'confirmarCorreo',
        severity: 'error',
        message: 'Os dois campos de e-mail não coincidem. No portal SERMIG, um erro aqui faz você perder intimações.',
        legalRef: 'Ley Nº 21.325, Art. 146',
      });
    }
    if (state.nombres.trim().split(/\s+/).length >= 4 && !state.segundoApellido.trim()) {
      warnings.push({
        field: 'nombres',
        severity: 'warning',
        message:
          'Parece haver muitos nomes no campo "Nombres". Verifique se o sobrenome não ficou misturado ao primeiro nome.',
      });
    }
  }

  if (step === 'identificacion_domicilio') {
    if (!state.numeroDocumento.trim() || state.numeroDocumento.trim().length < 5) {
      errors.push({
        field: 'numeroDocumento',
        severity: 'error',
        message: 'Informe o Número de Documento (Passaporte ou RG Mercosul) exatamente como impresso.',
      });
    }
    if (!state.fechaVencimientoDoc.trim()) {
      errors.push({
        field: 'fechaVencimientoDoc',
        severity: 'error',
        message: 'Informe a Fecha de Vencimiento do documento de viagem.',
      });
    } else {
      const daysExpired = diffDaysBetweenIso(state.fechaVencimientoDoc, now);
      if (daysExpired !== null && daysExpired >= 0) {
        errors.push({
          field: 'fechaVencimientoDoc',
          severity: 'error',
          message: 'O documento informado está vencido. O portal SERMIG bloqueia solicitações com passaporte expirado.',
        });
      } else if (daysExpired !== null && Math.abs(daysExpired) < 365) {
        warnings.push({
          field: 'fechaVencimientoDoc',
          severity: 'warning',
          message:
            'Passaporte com menos de 12 meses de validade restante. Recomenda-se renovar antes de protocolar para evitar divergência no Estampado Electrónico.',
        });
      }
    }
    if (!state.ciudadResidencia.trim() || !state.direccionResidencia.trim()) {
      errors.push({
        field: 'direccionResidencia',
        severity: 'error',
        message: 'Preencha sua cidade e endereço atual de residência.',
      });
    }
    if (!state.regionDestinoChile.trim() || !state.comunaDestinoChile.trim()) {
      errors.push({
        field: 'comunaDestinoChile',
        severity: 'error',
        message: 'Selecione a Región e Comuna de destino no Chile.',
      });
    }
  }

  if (step === 'documentos') {
    const slots = buildSermigDocumentSlots(visa, visaRequirements, state.dependientes.length);
    for (const slot of slots) {
      const att = state.attachments[slot.id];
      if (slot.obrigatorio && !att) {
        errors.push({
          field: slot.id,
          severity: 'error',
          message: `Documento obrigatório pendente: "${slot.nombreEspanol}". Anexe um arquivo real ou use o PDF de treino.`,
        });
        continue;
      }
      if (!att) continue;

      const fileCheck = validateSermigAttachmentFile(
        { name: att.fileName, size: att.fileSizeBytes, type: att.mimeType },
        slot,
      );
      if (!fileCheck.ok) {
        errors.push({
          field: slot.id,
          severity: 'error',
          message: `${slot.nombrePortugues}: ${fileCheck.error}`,
        });
      }

      if (slot.isAntecedentesPf) {
        if (!att.dataEmissao) {
          errors.push({
            field: `${slot.id}_emissao`,
            severity: 'error',
            message: 'Informe a data de emissão da Certidão da Polícia Federal para validar a janela legal de 60 dias.',
            legalRef: 'Regra Operacional SERMIG (60 dias)',
          });
        } else {
          const ageDays = diffDaysBetweenIso(att.dataEmissao, now);
          if (ageDays !== null && ageDays > SERMIG_PF_MAX_AGE_DAYS) {
            errors.push({
              field: `${slot.id}_emissao`,
              severity: 'error',
              message: `Certidão de Antecedentes PF vencida (${ageDays} dias de emissão). O SERMIG exige validade máxima de ${SERMIG_PF_MAX_AGE_DAYS} dias corridos no momento do protocolo.`,
              legalRef: 'Instrução SERMIG · Prazo máximo 60 dias',
            });
          } else if (ageDays !== null && ageDays > 45) {
            warnings.push({
              field: `${slot.id}_emissao`,
              severity: 'warning',
              message: `Certidão PF com ${ageDays} dias de emissão — próxima do limite de 60 dias. Emita uma nova se não for protocolar nos próximos dias.`,
            });
          }
        }
      }

      if (slot.exigeApostila && !att.apostilaConfirmada) {
        warnings.push({
          field: `${slot.id}_apostila`,
          severity: 'warning',
          message: `"${slot.nombrePortugues}" exige Apostila de Haia (CNJ) anexada no mesmo PDF no envio real.`,
        });
      }
    }
  }

  if (step === 'revision_declaracion') {
    if (!state.declaraVeracidad) {
      errors.push({
        field: 'declaraVeracidad',
        severity: 'error',
        message: 'Marque a Declaración Jurada de Veracidad de Antecedentes para habilitar o envio.',
      });
    }
    if (!state.aceptaNotificacionElectronica) {
      errors.push({
        field: 'aceptaNotificacionElectronica',
        severity: 'error',
        message: 'Aceite a notificação eletrônica (Art. 146 Ley Nº 21.325) para concluir o protocolo.',
      });
    }
    if (!state.captchaVerificado) {
      errors.push({
        field: 'captchaVerificado',
        severity: 'error',
        message: 'Complete a verificação de segurança ("No soy un robot") antes de enviar.',
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function deterministicDigits(seedText: string, length: number): string {
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const abs = Math.abs(hash >>> 0).toString();
  return abs.padStart(length, '4').slice(0, length);
}

/**
 * Gera o Comprobante de Ingreso Simulado (estilo SERMIG) + Auditoria de Prontidão D&M.
 */
export function buildSermigSimulatedReceipt(
  state: SermigPortalFormState,
  visaCategories: VisaCategory[],
  visaRequirements: VisaRequirement[],
  empresa?: Partial<EmpresaConfig>,
  now = new Date(),
): SermigSimulatedReceipt {
  const visa = resolveSimulatedVisa(visaCategories, state.visaCategoryId);
  const tramiteMeta =
    SERMIG_TRAMITE_OPTIONS.find((t) => t.id === state.tramiteType) || SERMIG_TRAMITE_OPTIONS[0];
  const slots = buildSermigDocumentSlots(visa, visaRequirements, state.dependientes.length);
  const attachedCount = slots.filter((s) => Boolean(state.attachments[s.id])).length;

  const titularCompleto = [state.nombres, state.primerApellido, state.segundoApellido]
    .map((x) => x.trim())
    .filter(Boolean)
    .join(' ');

  const seed = `${titularCompleto}|${state.numeroDocumento}|${visa.codigo}|${now.toISOString().slice(0, 13)}`;
  const folioDigits = deterministicDigits(seed, 8);
  const year = now.getUTCFullYear();
  const folioSolicitud = `SOL-${year}-${folioDigits}`;
  const codigoVerificacion = `SERMIG-SIM-${deterministicDigits(seed + 'v', 6)}`;

  // Reúne avisos de todas as etapas para o relatório pedagógico
  const allSteps: SermigPortalStepId[] = [
    'acceso',
    'tramite',
    'datos_personales',
    'identificacion_domicilio',
    'documentos',
  ];
  const allWarnings: SermigValidationIssue[] = [];
  for (const st of allSteps) {
    const res = validateSermigPortalStep(st, state, visaCategories, visaRequirements, now);
    allWarnings.push(...res.warnings);
  }

  const passedChecks: string[] = [
    `Acesso simulado via ${state.authMethod === 'cuenta_sermig' ? 'Cuenta SERMIG' : 'ClaveÚnica'} concluído`,
    `Trâmite compatível com a Ley Nº 21.325 (${tramiteMeta.tituloEs})`,
    'Separação correta de Nombres e Primer/Segundo Apellido + dupla confirmação de e-mail',
    `Documento de viagem válido informado (${state.tipoDocumento} ${state.numeroDocumento})`,
    `${attachedCount} de ${slots.length} documentos conferidos (formato oficial e limite de 5 MB)`,
    'Declaración Jurada e Notificação Eletrônica (Art. 146) formalizadas',
  ];

  const totalPessoas = 1 + state.dependientes.length;
  const unitUsd =
    visa.codigo === 'DEF'
      ? empresa?.custosPadrao?.taxaSermigDefinitivaUsd || 110
      : visa.codigo === '15'
        ? empresa?.custosPadrao?.taxaSermigMercosulUsd || 90
        : empresa?.custosPadrao?.taxaSermigTemporalUsd || 90;
  const usdToBrl = empresa?.taxaCambioUsdBrl || 5.45;
  const taxaEstimadaUsd = Math.round(unitUsd * totalPessoas * 100) / 100;
  const taxaEstimadaBrl = Math.round(taxaEstimadaUsd * usdToBrl * 100) / 100;

  const readinessScore = Math.max(60, Math.min(100, 100 - allWarnings.length * 8));

  return {
    folioSolicitud,
    codigoVerificacion,
    fechaHoraIngresoIso: now.toISOString(),
    tramiteLabelEs: tramiteMeta.tituloEs,
    subcategoriaEs: visa.nomeEspanhol,
    subcategoriaPt: visa.nomePortugues,
    titularCompleto: titularCompleto || 'Solicitante Simulado',
    documentoResumo: `${state.tipoDocumento} · ${state.numeroDocumento || '—'} (${state.paisEmisor})`,
    correoNotificacion: state.correoNotificacion,
    totalDependientes: state.dependientes.length,
    totalDocumentosAnexados: attachedCount,
    taxaEstimadaUsd,
    taxaEstimadaBrl,
    readinessScore,
    passedChecks,
    warnings: allWarnings,
    proximasEtapasReais: [
      {
        ordem: 1,
        titulo: 'Control de Admisibilidad y Análisis',
        prazoReferencia: '3 a 6 meses (referência média)',
        detalhe:
          'O SERMIG verifica legibilidade, apostilas e validade de 60 dias da PF. Se faltar algo, envia uma notificación de subsanación por e-mail (prazo legal de 5 dias úteis).',
      },
      {
        ordem: 2,
        titulo: 'Orden de Giro (Pago de Derechos Migratorios)',
        prazoReferencia: 'Somente após aprovação',
        detalhe: `Taxa governamental estimada em USD ${taxaEstimadaUsd} (≈ R$ ${taxaEstimadaBrl.toFixed(2)}) para ${totalPessoas} pessoa(s), paga via cartão/banco no portal após a resolução.`,
      },
      {
        ordem: 3,
        titulo: 'Descarga del Estampado Electrónico',
        prazoReferencia: '90 dias corridos para ingressar no Chile',
        detalhe:
          'Com o pagamento compensado, você baixa o PDF oficial do Estampado Electrónico com código QR no próprio portal SERMIG.',
      },
      {
        ordem: 4,
        titulo: 'Registro PDI e Solicitud de Cédula de Identidad (RUN)',
        prazoReferencia: 'Até 30 dias corridos após chegada/estampado',
        detalhe:
          'Ao entrar no Chile com o Estampado, registra-se o visto na PDI (online) e agenda-se a emissão da Cédula de Identidade para Estrangeiros no Registro Civil.',
      },
    ],
  };
}
