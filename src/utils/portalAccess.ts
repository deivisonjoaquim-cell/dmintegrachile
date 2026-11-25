import type {
  Case,
  Client,
  ConsultancyModality,
  DiagnosticAnswers,
  DiagnosticConfidence,
  Lead,
  PaidConsultancyModality,
  UserProfile,
} from '../types/domain';
import type { DiagnosticResult } from './diagnosticEngine';

export type PortalTabKey = 'processo' | 'documentos' | 'biblioteca' | 'simulador' | 'financeiro' | 'suporte' | 'dados';

export interface ConsultancyPlanSpec {
  id: ConsultancyModality;
  nome: string;
  nomeCurto: string;
  subtitulo: string;
  responsavelProtocolo: 'Cliente (sem consultoria)' | 'Cliente (com orientação técnica)' | 'D&M Integra Chile (execução integral)';
  idealPara: string;
  inclui: string[];
  naoInclui: string[];
  badgeLabel: string;
}

export const CONSULTANCY_PLANS: Record<ConsultancyModality, ConsultancyPlanSpec> = {
  diagnostico_gratuito: {
    id: 'diagnostico_gratuito',
    nome: 'Diagnóstico Gratuito',
    nomeCurto: 'Diagnóstico Básico',
    subtitulo: 'Visão inicial de enquadramento e viabilidade',
    responsavelProtocolo: 'Cliente (sem consultoria)',
    idealPara: 'Quem está pesquisando possibilidades antes de contratar assessoria.',
    inclui: [
      'Índice geral de viabilidade (0–100) e nível de confiança',
      'Indicação da subcategoria principal sugerida',
      'Resumo básico das regras gerais de elegibilidade',
      'Alerta inicial de eventual ponto crítico no perfil',
    ],
    naoInclui: [
      'Plano de ação passo a passo e ordem cronológica de emissão',
      'Estimativa detalhada de taxas (SERMIG, CNJ, traduções e câmbio)',
      'Checklist personalizado por titular e dependentes',
      'Conferência técnica de documentos e acompanhamento',
      'Protocolo no portal oficial SERMIG',
    ],
    badgeLabel: 'Acesso Básico',
  },
  orientativa: {
    id: 'orientativa',
    nome: 'Consultoria Orientativa',
    nomeCurto: 'Orientativa',
    subtitulo: 'Você conduz o seu protocolo com nossa orientação técnica especializada',
    responsavelProtocolo: 'Cliente (com orientação técnica)',
    idealPara: 'Quem prefere protocolar o próprio pedido no SERMIG, mas quer segurança jurídica, checklist exato e conferência profissional.',
    inclui: [
      'Diagnóstico técnico completo e definição da estratégia migratória',
      'Checklist personalizado na ordem correta de validade documental',
      'Conferência técnica dos documentos antes de você protocolar',
      'Sessões de orientação por vídeo e tira-dúvidas no Portal do Cliente',
      'Guia passo a passo para você realizar o protocolo no portal SERMIG',
      'Acesso à Biblioteca Legal simplificada e modelos orientativos',
    ],
    naoInclui: [
      'Protocolo e operação direta na conta SERMIG pela consultoria',
      'Gestão ativa de notificações/requerimentos em nome do requerente',
      'Acompanhamento completo de pós-chegada e relocation presencial',
    ],
    badgeLabel: 'Você protocola com nosso guia',
  },
  completa: {
    id: 'completa',
    nome: 'Consultoria Completa',
    nomeCurto: 'Completa (Todo o Processo)',
    subtitulo: 'Nós conduzimos todo o processo de ponta a ponta por você',
    responsavelProtocolo: 'D&M Integra Chile (execução integral)',
    idealPara: 'Quem busca tranquilidade total delegando preparação, protocolo SERMIG, controle de prazos e suporte pós-chegada.',
    inclui: [
      'Tudo da Consultoria Orientativa + execução integral pela consultoria',
      'Montagem completa do dossiê de titular e dependentes',
      'Protocolo oficial no SERMIG conduzido pela nossa equipe',
      'Monitoramento ativo de prazos, requerimentos e notificações oficiais',
      'Termômetro documental, cofre de arquivos e acompanhamento em 15 etapas',
      'Orientação pós-aprovação: Estampado Eletrônico, PDI, Cédula (RUN) e chegada',
    ],
    naoInclui: [
      'Taxas governamentais oficiais (SERMIG, CNJ, tradutores juramentados), pagas diretamente aos órgãos emissores',
    ],
    badgeLabel: 'Fazemos todo o processo',
  },
};

export interface OrientativaStage {
  numero: number;
  nome: string;
  descricao: string;
  responsavel: 'Consultoria' | 'Cliente' | 'Conjunto';
}

export const ORIENTATIVA_STAGES: OrientativaStage[] = [
  {
    numero: 1,
    nome: 'Diagnóstico & Estratégia',
    descricao: 'Validação técnica da subcategoria ideal, riscos e cronograma personalizado.',
    responsavel: 'Consultoria',
  },
  {
    numero: 2,
    nome: 'Checklist & Ordem de Emissão',
    descricao: 'Entrega da lista exata de documentos na sequência correta para evitar vencimento.',
    responsavel: 'Consultoria',
  },
  {
    numero: 3,
    nome: 'Coleta, Apostila & Tradução',
    descricao: 'Você reúne, apostila e envia os arquivos no portal para nossa revisão.',
    responsavel: 'Cliente',
  },
  {
    numero: 4,
    nome: 'Conferência Técnica Pré-Protocolo',
    descricao: 'Auditamos cada documento e validamos se tudo está conforme as regras do SERMIG.',
    responsavel: 'Consultoria',
  },
  {
    numero: 5,
    nome: 'Reunião Guia & Protocolo SERMIG',
    descricao: 'Orientação passo a passo para você realizar o envio oficial no portal do SERMIG.',
    responsavel: 'Conjunto',
  },
  {
    numero: 6,
    nome: 'Orientações Pós-Protocolo',
    descricao: 'Guia para acompanhar o trâmite, baixar Estampado e registrar PDI/Cédula.',
    responsavel: 'Consultoria',
  },
];

export function normalizePaidModality(value?: string | null): PaidConsultancyModality {
  if (value === 'orientativa') return 'orientativa';
  return 'completa';
}

export function normalizeConsultancyModality(value?: string | null): ConsultancyModality {
  if (value === 'diagnostico_gratuito') return 'diagnostico_gratuito';
  if (value === 'orientativa') return 'orientativa';
  return 'completa';
}

export function getModalityLabel(modality?: string | null): string {
  const norm = normalizeConsultancyModality(modality);
  return CONSULTANCY_PLANS[norm].nome;
}

export function mapPipelineStepToOrientativaStep(etapaPipeline: number): number {
  if (etapaPipeline <= 2) return 1;
  if (etapaPipeline <= 4) return 2;
  if (etapaPipeline <= 6) return 3;
  if (etapaPipeline <= 8) return 4;
  if (etapaPipeline <= 10) return 5;
  return 6;
}

export interface PortalCapabilities {
  modality: ConsultancyModality;
  isPortalUnlocked: boolean;
  showBasicDiagnosticOnly: boolean;
  showFullDiagnosticDetails: boolean;
  showFull15Stages: boolean;
  showOrientativaRoadmap: boolean;
  showSermigManagementByTeam: boolean;
  showDocumentChecklist: boolean;
  showLegalLibrary: boolean;
  showSermigSimulator: boolean;
  showContractsAndFinance: boolean;
  showDirectChat: boolean;
  showRelocationSupport: boolean;
  allowedTabs: PortalTabKey[];
}

export function getPortalCapabilities(
  modality: ConsultancyModality,
  isPortalUnlocked: boolean,
  simuladorSermigLiberado = false,
): PortalCapabilities {
  if (!isPortalUnlocked || modality === 'diagnostico_gratuito') {
    const allowSimOnFree = Boolean(simuladorSermigLiberado);
    return {
      modality: 'diagnostico_gratuito',
      isPortalUnlocked: false,
      showBasicDiagnosticOnly: true,
      showFullDiagnosticDetails: false,
      showFull15Stages: false,
      showOrientativaRoadmap: false,
      showSermigManagementByTeam: false,
      showDocumentChecklist: false,
      showLegalLibrary: false,
      showSermigSimulator: allowSimOnFree,
      showContractsAndFinance: false,
      showDirectChat: false,
      showRelocationSupport: false,
      allowedTabs: allowSimOnFree ? ['processo', 'simulador'] : ['processo'],
    };
  }

  const baseTabs: PortalTabKey[] = simuladorSermigLiberado
    ? ['processo', 'documentos', 'biblioteca', 'simulador', 'financeiro', 'suporte', 'dados']
    : ['processo', 'documentos', 'biblioteca', 'financeiro', 'suporte', 'dados'];

  if (modality === 'orientativa') {
    return {
      modality: 'orientativa',
      isPortalUnlocked: true,
      showBasicDiagnosticOnly: false,
      showFullDiagnosticDetails: true,
      showFull15Stages: false,
      showOrientativaRoadmap: true,
      showSermigManagementByTeam: false,
      showDocumentChecklist: true,
      showLegalLibrary: true,
      showSermigSimulator: Boolean(simuladorSermigLiberado),
      showContractsAndFinance: true,
      showDirectChat: true,
      showRelocationSupport: false,
      allowedTabs: baseTabs,
    };
  }

  return {
    modality: 'completa',
    isPortalUnlocked: true,
    showBasicDiagnosticOnly: false,
    showFullDiagnosticDetails: true,
    showFull15Stages: true,
    showOrientativaRoadmap: false,
    showSermigManagementByTeam: true,
    showDocumentChecklist: true,
    showLegalLibrary: true,
    showSermigSimulator: Boolean(simuladorSermigLiberado),
    showContractsAndFinance: true,
    showDirectChat: true,
    showRelocationSupport: true,
    allowedTabs: baseTabs,
  };
}

export interface BasicDiagnosticDimension {
  nome: string;
  pontos: number;
  maximo: number;
  percentual: number;
  observacao: string;
}

export interface BasicDiagnosticAlternative {
  codigo: string;
  nome: string;
  aderencia: number;
  permiteDentroChile: 'Sim' | 'Não' | 'Condicional';
}

export interface BasicDiagnosticPhase {
  fase: number;
  titulo: string;
  foco: string;
  resumo: string;
}

export interface BasicDiagnosticSummary {
  nome?: string;
  notaViabilidade: number;
  veredito: string;
  vereditoNivel?: 'alta' | 'moderada' | 'atencao';
  confianca: DiagnosticConfidence;
  subcategoriaCodigo: string;
  subcategoriaNome: string;
  subcategoriaEspanhol?: string;
  resumoBasico: string;
  permiteDentroChile?: 'Sim' | 'Não' | 'Condicional';
  permiteTrabalhar?: boolean;
  levaDefinitiva?: boolean;
  temAlertaCritico: boolean;
  alertaGeral?: string;
  familiaResumo?: string;
  prazoEstimadoResumo?: string;
  perfilResumo?: {
    localizacao: string;
    objetivo: string;
    prazo: string;
    familia: string;
  };
  dimensoes?: BasicDiagnosticDimension[];
  pontosFortes?: string[];
  pontosAtencao?: string[];
  alternativasMapeadas?: BasicDiagnosticAlternative[];
  roteiroMacro?: BasicDiagnosticPhase[];
  itensBloqueados: string[];
  dataCalculo?: string;
}

const OBJECTIVE_PUBLIC_LABELS: Record<string, string> = {
  explorar: 'Morar no Chile (Mercosul / residência geral)',
  trabalhar: 'Trabalho com contrato ou empresa chilena',
  estudar: 'Estudos em instituição chilena',
  aposentado_rentista: 'Aposentado ou renda passiva',
  investir: 'Investimento ou empreendedorismo',
  familia: 'Reunificação familiar',
  outro: 'Outro objetivo migratório',
};

function buildMacroRoadmap(localizacao?: string): BasicDiagnosticPhase[] {
  if (localizacao === 'No Chile com residência') {
    return [
      {
        fase: 1,
        titulo: 'Auditoria da Residência Atual',
        foco: 'Janela legal SERMIG',
        resumo: 'Conferência da subcategoria vigente, histórico de ausências do Chile e prazo exato de protocolização (90 a 10 dias antes do vencimento).',
      },
      {
        fase: 2,
        titulo: 'Dossiê de Prorrogação ou Definitiva',
        foco: 'Certidões e comprovantes',
        resumo: 'Reunião de certidões atualizadas, comprovantes de sustento/vínculo no Chile e validação de validade documental.',
      },
      {
        fase: 3,
        titulo: 'Protocolo Oficial no SERMIG',
        foco: 'Envio digital e comprovante',
        resumo: 'Submissão eletrônica no portal oficial com emissão do comprovante de solicitação em trâmite para manter regularidade plena.',
      },
      {
        fase: 4,
        titulo: 'Resolução e Atualização da Cédula',
        foco: 'Registro Civil & PDI',
        resumo: 'Emissão do Estampado Eletrônico, atualização cadastral e renovação da Cédula de Identidade para Estrangeiros.',
      },
    ];
  }

  if (localizacao === 'No Chile como turista') {
    return [
      {
        fase: 1,
        titulo: 'Definição Segura da Estratégia',
        foco: 'Regra de Permanencia Transitoria',
        resumo: 'Avaliação jurídica se o seu caso se enquadra em exceção dentro do Chile ou se exige protocolo a partir do exterior conforme a Ley Nº 21.325.',
      },
      {
        fase: 2,
        titulo: 'Preparação Documental & Apostila',
        foco: 'Validade e tradução',
        resumo: 'Emissão de certidões na ordem certa, Apostila de Haia e traduções oficiais para evitar vencimento de antecedentes.',
      },
      {
        fase: 3,
        titulo: 'Protocolo no Portal SERMIG',
        foco: 'Acompanhamento de exigências',
        resumo: 'Envio completo do pedido de Residência Temporal e monitoramento de eventuais solicitações complementares do órgão.',
      },
      {
        fase: 4,
        titulo: 'Estampado, PDI & Cédula Chilena',
        foco: 'Regularização completa',
        resumo: 'Aprovação, emissão do Estampado Eletrônico, registro na PDI e emissão do RUN/Cédula de Identidade chilena.',
      },
    ];
  }

  return [
    {
      fase: 1,
      titulo: 'Enquadramento & Estratégia',
      foco: 'Escolha da rota ideal',
      resumo: 'Confirmação técnica da subcategoria principal no SERMIG, definição do titular/dependentes e mapeamento de riscos.',
    },
    {
      fase: 2,
      titulo: 'Emissão, Apostila & Tradução',
      foco: 'Ordem cronológica correta',
      resumo: 'Emissão sincronizada das certidões brasileiras (com atenção às validades curtas), Apostila de Haia e traduções exigidas.',
    },
    {
      fase: 3,
      titulo: 'Protocolo Oficial do Exterior',
      foco: 'Portal SERMIG Chile',
      resumo: 'Submissão eletrônica do dossiê ainda no Brasil/exterior, acompanhamento da análise e aprovação prévia ao embarque.',
    },
    {
      fase: 4,
      titulo: 'Embarque, Registro PDI & Cédula',
      foco: 'Instalação regular no Chile',
      resumo: 'Entrada regular com Estampado Eletrônico, registro obrigatório na PDI e emissão da Cédula de Identidade (RUN).',
    },
  ];
}

export function buildBasicDiagnosticSummary(
  result: DiagnosticResult,
  answers?: Partial<DiagnosticAnswers>,
): BasicDiagnosticSummary {
  const rec = result.recomendada;
  const score = Math.round(result.viabilidade?.total || 0);
  const vereditoNivel: 'alta' | 'moderada' | 'atencao' =
    score >= 75 ? 'alta' : score >= 50 ? 'moderada' : 'atencao';
  const verdict =
    score >= 75
      ? 'Perfil com alta aderência preliminar'
      : score >= 50
        ? 'Perfil viável mediante planejamento técnico'
        : 'Perfil requer estratégia prévia com consultor';

  const hasTouristRestriction =
    answers?.localizacao === 'No Chile como turista' &&
    (!answers?.vinculoFamiliarChile || !answers?.vinculoFormalizado);

  const hasCriticalAlert =
    Boolean(result.alertaRiscoAlto) ||
    (result.flagsRisco?.length ?? 0) > 0 ||
    (result.flagsRevisaoConsultor?.length ?? 0) > 0 ||
    (result.alertas?.length ?? 0) > 0 ||
    hasTouristRestriction;

  let genericAlert: string | undefined;
  if (hasTouristRestriction) {
    genericAlert =
      'Identificamos restrição legal relevante ligada à localização/entrada no Chile como turista (Ley Nº 21.325). A definição da rota segura exige análise individualizada.';
  } else if (hasCriticalAlert) {
    genericAlert =
      'Identificamos pontos de atenção no perfil que impactam o enquadramento ou a ordem dos documentos e precisam ser validados em consultoria.';
  }

  const depCount = answers?.familiaAcompanhante ? Math.max(1, answers.quantidadeDependentes || 1) : 0;
  const familiaResumo =
    depCount > 0 ? `Titular + ${depCount} dependente(s)` : 'Aplicação individual (titular)';

  const resumoBasico = rec
    ? `Com base nas informações fornecidas, a rota preliminar mais compatível com o seu momento é ${rec.visa.nomePortugues}. Este dossiê gratuito apresenta a leitura inicial de aderência, pilares de viabilidade e o roteiro macro da jornada — sem substituir a auditoria documental individual.`
    : 'Com base nas respostas informadas, seu perfil precisa de validação individual para definir a subcategoria migratória mais segura.';

  const dimensoes: BasicDiagnosticDimension[] = (result.viabilidade?.dimensoes || []).map((d) => ({
    nome: d.nome,
    pontos: Math.round(d.pontos),
    maximo: Math.round(d.maximo),
    percentual: d.maximo > 0 ? Math.min(100, Math.max(0, Math.round((d.pontos / d.maximo) * 100))) : 0,
    observacao: d.observacao,
  }));

  const pontosFortes: string[] = [];
  if (rec?.motivo) pontosFortes.push(rec.motivo);
  if (rec?.visa.permiteTrabalhar) {
    pontosFortes.push('A subcategoria principal indicada autoriza atividade remunerada regular no Chile.');
  }
  if (rec?.visa.levaDefinitiva) {
    pontosFortes.push('A rota é elegível à transição futura para Residência Definitiva cumprindo os prazos legais.');
  }
  for (const item of result.explicacaoCliente || []) {
    if (pontosFortes.length >= 4) break;
    const clean = item.trim();
    if (clean && !pontosFortes.includes(clean)) {
      pontosFortes.push(clean);
    }
  }

  const pontosAtencao: string[] = [];
  if (genericAlert) pontosAtencao.push(genericAlert);
  for (const al of result.alertas || []) {
    if (pontosAtencao.length >= 3) break;
    const clean = al.trim();
    if (clean && !pontosAtencao.includes(clean)) {
      pontosAtencao.push(clean);
    }
  }
  if (pontosAtencao.length === 0 && (result.contradicoes?.length ?? 0) > 0) {
    pontosAtencao.push(
      'Há dados complementares no questionário que merecem confirmação técnica antes da emissão de certidões.',
    );
  }

  const alternativasMapeadas: BasicDiagnosticAlternative[] = (result.top3 || [])
    .slice(1, 3)
    .filter((c) => Boolean(c?.visa))
    .map((c) => ({
      codigo: c.visa.codigo,
      nome: c.visa.nomePortugues,
      aderencia: Math.round(c.nota),
      permiteDentroChile: c.visa.permiteDentroChile,
    }));

  const prazoEstimadoResumo =
    result.cronogramaFaixas?.respostaSermig ||
    result.cronogramaFaixas?.preparacaoDocumental ||
    'Variável conforme fila oficial SERMIG';

  return {
    nome: answers?.nome?.trim() || undefined,
    notaViabilidade: score,
    veredito: verdict,
    vereditoNivel,
    confianca: result.confianca,
    subcategoriaCodigo: rec?.visa.codigo || 'ANÁLISE',
    subcategoriaNome: rec?.visa.nomePortugues || 'Enquadramento sob análise técnica',
    subcategoriaEspanhol: rec?.visa.nomeEspanhol || undefined,
    resumoBasico,
    permiteDentroChile: rec?.visa.permiteDentroChile,
    permiteTrabalhar: rec?.visa.permiteTrabalhar,
    levaDefinitiva: rec?.visa.levaDefinitiva,
    temAlertaCritico: hasCriticalAlert,
    alertaGeral: genericAlert,
    familiaResumo,
    prazoEstimadoResumo,
    perfilResumo: {
      localizacao: answers?.localizacao || 'Não informada',
      objetivo: OBJECTIVE_PUBLIC_LABELS[answers?.objetivo || 'explorar'] || 'Avaliação migratória',
      prazo: answers?.prazoPretendido || 'A definir',
      familia: familiaResumo,
    },
    dimensoes,
    pontosFortes: pontosFortes.slice(0, 4),
    pontosAtencao: pontosAtencao.slice(0, 3),
    alternativasMapeadas,
    roteiroMacro: buildMacroRoadmap(answers?.localizacao),
    itensBloqueados: [
      'Plano de ação detalhado com sequência exata de emissão para não perder validade de 60 dias',
      'Estimativa completa de taxas oficiais SERMIG, apostilamentos CNJ e traduções (BRL/CLP/USD)',
      'Checklist individualizado por membro da família (titular, cônjuge e filhos)',
      'Matriz comparativa técnica entre a rota principal, Acordo Mercosul e plano B',
      'Conferência técnica pré-protocolo e acompanhamento especializado',
    ],
    dataCalculo: new Date().toISOString(),
  };
}

export function buildBasicLeadSummary(lead: Lead): BasicDiagnosticSummary {
  const score = typeof lead.notaViabilidade === 'number' ? Math.round(lead.notaViabilidade) : 0;
  const verdict =
    score >= 75
      ? 'Perfil com alta aderência preliminar'
      : score >= 50
        ? 'Perfil viável mediante planejamento técnico'
        : 'Perfil requer estratégia prévia com consultor';

  const hasCriticalAlert = Boolean(lead.flagsRisco && lead.flagsRisco.length > 0);
  const subcat = lead.subcategoriaSugerida || lead.interesse || 'Enquadramento sob análise técnica';

  return {
    nome: lead.nome,
    notaViabilidade: score,
    veredito: verdict,
    confianca: lead.confianca || 'Média',
    subcategoriaCodigo: subcat.split(' ')[0] || 'ANÁLISE',
    subcategoriaNome: subcat,
    resumoBasico: `Seu diagnóstico gratuito indicou enquadramento preliminar em ${subcat}. Para acessar o plano de ação detalhado, checklist personalizado e acompanhamento, contrate a Consultoria Orientativa ou a Consultoria Completa.`,
    temAlertaCritico: hasCriticalAlert,
    alertaGeral: hasCriticalAlert
      ? 'Foram detectados pontos de atenção no seu diagnóstico gratuito que recomendam revisão técnica antes de qualquer protocolo.'
      : undefined,
    itensBloqueados: [
      'Plano de ação detalhado e ordem de emissão documental',
      'Checklist completo de documentos e conferência técnica',
      'Estimativa detalhada de custos e taxas oficiais',
      'Portal completo com acompanhamento de etapas e chat direto',
    ],
    dataCalculo: lead.updatedAt || lead.createdAt,
  };
}

export type PortalAccessResolution =
  | { kind: 'unauthenticated' }
  | { kind: 'inactive'; reason: string }
  | {
      kind: 'active_paid';
      client: Client;
      modality: PaidConsultancyModality;
      capabilities: PortalCapabilities;
    }
  | {
      kind: 'pending_release';
      client: Client;
      requestedModality: PaidConsultancyModality;
      basicDiagnostic: BasicDiagnosticSummary | null;
      capabilities: PortalCapabilities;
    }
  | {
      kind: 'free_diagnostic_only';
      lead: Lead;
      basicDiagnostic: BasicDiagnosticSummary;
      capabilities: PortalCapabilities;
    }
  | {
      kind: 'no_record';
      capabilities: PortalCapabilities;
    };

export type PortalLifecycleStage =
  | 'loading'
  | 'unauthenticated'
  | 'gratuito'
  | 'pendente'
  | 'contratado'
  | 'inativo';

export function mapPortalResolutionToStage(
  resolution: PortalAccessResolution | null,
  loading: boolean,
): PortalLifecycleStage {
  if (loading) return 'loading';
  if (!resolution || resolution.kind === 'unauthenticated') return 'unauthenticated';
  if (resolution.kind === 'inactive') return 'inativo';
  if (resolution.kind === 'active_paid') return 'contratado';
  if (resolution.kind === 'pending_release') return 'pendente';
  return 'gratuito';
}

export function resolveClientPortalAccess(params: {
  userProfile: UserProfile | null;
  client: Client | null;
  activeCase?: Case | null;
  leads?: Lead[];
}): PortalAccessResolution {
  const { userProfile, client, activeCase, leads = [] } = params;
  if (!userProfile) {
    return { kind: 'unauthenticated' };
  }

  if (userProfile.status === 'inativo') {
    return {
      kind: 'inactive',
      reason: 'Seu usuário está desativado no sistema. Entre em contato com a consultoria.',
    };
  }

  const latestLead = [...leads].sort((a, b) =>
    (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''),
  )[0] || null;

  if (client) {
    if (client.arquivado) {
      return {
        kind: 'inactive',
        reason: 'Seu cadastro foi arquivado pela consultoria. Caso deseje reativar seu acesso, fale com nossa equipe.',
      };
    }

    const effectiveModality = normalizePaidModality(
      client.modalidadeConsultoria || activeCase?.modalidadeConsultoria,
    );

    const simUnlocked = client.simuladorSermigLiberado === true;

    if (client.portalLiberado === true) {
      return {
        kind: 'active_paid',
        client,
        modality: effectiveModality,
        capabilities: getPortalCapabilities(effectiveModality, true, simUnlocked),
      };
    }

    return {
      kind: 'pending_release',
      client,
      requestedModality: effectiveModality,
      basicDiagnostic: latestLead ? buildBasicLeadSummary(latestLead) : null,
      capabilities: getPortalCapabilities('diagnostico_gratuito', false, simUnlocked),
    };
  }

  if (latestLead) {
    return {
      kind: 'free_diagnostic_only',
      lead: latestLead,
      basicDiagnostic: buildBasicLeadSummary(latestLead),
      capabilities: getPortalCapabilities('diagnostico_gratuito', false),
    };
  }

  return {
    kind: 'no_record',
    capabilities: getPortalCapabilities('diagnostico_gratuito', false),
  };
}
