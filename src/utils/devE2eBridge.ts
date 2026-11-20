import {
  DEFAULT_DIAGNOSTIC_RULE_VERSION,
  DEFAULT_EMPRESA_CONFIG,
  SEED_DOCUMENT_TEMPLATES,
  SEED_LEGAL_SOURCES,
  SEED_MESSAGE_TEMPLATES,
  SEED_PARTNERS,
  SEED_SITE_CONTENT,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type {
  Appointment,
  AuditLog,
  Budget,
  Case,
  CaseDocument,
  CaseFinancialSummary,
  Client,
  CommunicationLog,
  Deadline,
  Dependent,
  DocumentTemplate,
  EmpresaConfig,
  FinancialRecord,
  GeneratedDocument,
  Lead,
  LegalSource,
  MessageTemplate,
  Partner,
  PartnerProposal,
  PartnerPublic,
  SiteContent,
  Task,
  UserProfile,
  UserRole,
  ViabilityAssessment,
} from '../types/domain';

const E2E_SESSION_KEY = '__DM_E2E_SESSION__';
const E2E_TOKEN_VALUE = 'dm-e2e-dev-token';

export interface DevE2eDataset {
  empresa: EmpresaConfig;
  siteContent: SiteContent[];
  legalSources: LegalSource[];
  leads: Lead[];
  clients: Client[];
  dependents: Dependent[];
  cases: Case[];
  caseFinancials: CaseFinancialSummary[];
  caseDocuments: CaseDocument[];
  tasks: Task[];
  deadlines: Deadline[];
  appointments: Appointment[];
  communicationLogs: CommunicationLog[];
  viabilityAssessments: ViabilityAssessment[];
  budgets: Budget[];
  financialRecords: FinancialRecord[];
  partners: Partner[];
  partnersPublic: PartnerPublic[];
  partnerProposals: PartnerProposal[];
  messageTemplates: MessageTemplate[];
  documentTemplates: DocumentTemplate[];
  generatedDocuments: GeneratedDocument[];
  auditLogs: AuditLog[];
  staffUsers: UserProfile[];
}

export function isDevE2eActive(): boolean {
  if (!import.meta.env.DEV) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return false;
  try {
    return window.sessionStorage.getItem(E2E_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function getDevE2eAuthProfile(): UserProfile {
  return {
    uid: 'e2e_admin_uid',
    nome: 'Deivison Joaquim (E2E)',
    email: 'deivisonjoaquim@gmail.com',
    fotoUrl: '',
    role: 'admin',
    status: 'ativo',
    createdAt: '2026-01-10T10:00:00.000Z',
    updatedAt: '2026-01-10T10:00:00.000Z',
  };
}

export function createDevE2eFirebaseUser(): {
  uid: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  photoURL: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
} {
  return {
    uid: 'e2e_admin_uid',
    email: 'deivisonjoaquim@gmail.com',
    displayName: 'Deivison Joaquim (E2E)',
    emailVerified: true,
    photoURL: null,
    getIdToken: async () => E2E_TOKEN_VALUE,
  };
}

function buildInitialE2eDataset(): DevE2eDataset {
  const adminProfile = getDevE2eAuthProfile();
  const nowIso = '2026-11-15T14:00:00.000Z';

  return {
    empresa: { ...DEFAULT_EMPRESA_CONFIG },
    siteContent: [...SEED_SITE_CONTENT],
    legalSources: [...SEED_LEGAL_SOURCES],
    leads: [
      {
        id: 'lead_e2e_1',
        nome: 'Carlos Henrique E2E',
        email: 'carlos.e2e@exemplo.com',
        whatsapp: '+55 11 98888-7777',
        cidadeUf: 'São Paulo - SP',
        interesse: 'Acordo Mercosul',
        subcategoriaSugerida: '15 - Acordo Mercosul',
        notaViabilidade: 88,
        confianca: 'Alta',
        temperatura: 'Quente',
        prioridade: 'Alta',
        statusFunil: 'Novo',
        statusConclusao: 'Concluído',
        origem: 'Site',
        lgpdAceito: true,
        lgpdData: nowIso,
        lgpdVersao: '1.0',
        versaoRegras: DEFAULT_DIAGNOSTIC_RULE_VERSION.versao,
        respostasTriagem: {
          nome: 'Carlos Henrique E2E',
          whatsapp: '+55 11 98888-7777',
          email: 'carlos.e2e@exemplo.com',
          cidadeUf: 'São Paulo - SP',
          origem: 'Site',
          localizacao: 'No Brasil',
          nacionalidadeBrasileira: true,
          possuiSegundaNacionalidade: false,
          passaporteStatus: 'valido',
          passaporteValidadeMeses: 30,
          vinculoFamiliarChile: false,
          vinculoFormalizado: false,
          objetivo: 'trabalho_formal',
          possuiOfertaTrabalhoFormal: false,
          possuiMatriculaReconhecida: false,
          possuiRendaPassiva: false,
          possuiCapitalComprovadoOrigem: false,
          titularTemResidenciaChile: false,
          overstay: false,
          ordenAbandono: false,
          rejeicaoAnterior: false,
          antecedentesCriminais: false,
          familiaAcompanhante: false,
          quantidadeDependentes: 1,
          prazoPretendido: '3 a 6 meses',
          documentosJaPossui: ['Passaporte'],
          lgpdAceito: true,
          lgpdVersao: '1.0',
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      {
        id: 'lead_e2e_2',
        nome: 'Mariana Souza E2E',
        email: 'mariana.e2e@exemplo.com',
        whatsapp: '+55 21 97777-6666',
        cidadeUf: 'Rio de Janeiro - RJ',
        interesse: 'Estudante',
        subcategoriaSugerida: '2 - Estudante',
        notaViabilidade: 74,
        confianca: 'Média',
        temperatura: 'Morno',
        prioridade: 'Média',
        statusFunil: 'Contatado',
        statusConclusao: 'Concluído',
        origem: 'Site',
        lgpdAceito: true,
        lgpdData: nowIso,
        lgpdVersao: '1.0',
        createdAt: '2026-11-12T10:00:00.000Z',
        updatedAt: '2026-11-12T10:00:00.000Z',
      },
    ],
    clients: [
      {
        id: 'cli_e2e_1',
        nomeCompleto: 'Roberto Almeida E2E',
        cpf: '123.456.789-00',
        email: 'roberto.e2e@exemplo.com',
        whatsapp: '+55 11 99999-1111',
        enderecoCompleto: 'Curitiba - PR',
        objetivoChile: 'Acordo Mercosul',
        profissao: 'Engenheiro de Software',
        portalLiberado: true,
        statusAcessoPortal: 'Liberado',
        lgpdAceito: true,
        lgpdAceitoEm: nowIso,
        lgpdVersao: '1.0',
        createdAt: nowIso,
      },
    ],
    dependents: [],
    cases: [
      {
        id: 'case_e2e_1',
        titulo: 'Roberto Almeida – Acordo Mercosul',
        clientId: 'cli_e2e_1',
        tipoServico: 'Residência Temporal',
        visaCategoryId: 'visa_15_mercosul',
        subcategoriaIa: '15 - Acordo Mercosul',
        etapaPipeline: 3,
        statusSermig: 'Em trâmite',
        portalLiberado: true,
        relatorioViabilidadeLiberado: false,
        prioridade: 'Alta',
        notaViabilidadeGeral: 91,
        createdAt: nowIso,
      },
    ],
    caseFinancials: [
      {
        caseId: 'case_e2e_1',
        clientId: 'cli_e2e_1',
        valorContrato: 4500,
        moeda: 'BRL',
        liberadoAoCliente: true,
        updatedAt: nowIso,
      },
    ],
    caseDocuments: [
      {
        id: 'doc_e2e_1',
        caseId: 'case_e2e_1',
        clientId: 'cli_e2e_1',
        pessoa: 'Titular',
        visaRequirementId: SEED_VISA_REQUIREMENTS[0]?.id || 'req_1',
        nomeDocumento: 'Certidão de Antecedentes Criminais PF',
        categoriaDoc: 'Antecedentes',
        etapaEsteira: '2 Recebido/Triagem',
        ordemEmissao: 5,
        status: 'Em análise',
        validadeDias: 60,
        apostilado: true,
        traduzido: false,
        exigeApostila: true,
        exigeTraducao: false,
        obrigatorio: true,
        peso: 3,
        versao: 1,
        arquivoNome: 'antecedentes_pf.pdf',
      },
    ],
    tasks: [],
    deadlines: [],
    appointments: [],
    communicationLogs: [],
    viabilityAssessments: [],
    budgets: [],
    financialRecords: [
      {
        id: 'fin_e2e_1',
        caseId: 'case_e2e_1',
        clientId: 'cli_e2e_1',
        tipo: 'Honorários',
        descricao: 'Parcela 1 - Assessoria Mercosul',
        moeda: 'BRL',
        valor: 2250,
        vencimento: '2026-11-10',
        dataPagamento: '2026-11-10',
        status: 'Pago',
        createdAt: nowIso,
      },
    ],
    partners: SEED_PARTNERS.map((p) => ({ ...p.full })),
    partnersPublic: SEED_PARTNERS.map((p) => ({ ...p.pub })),
    partnerProposals: [
      {
        id: 'prop_e2e_1',
        nome_empresa: 'Estúdio Traduções Sul E2E',
        responsavel: 'Luciana Mendes',
        whatsapp: '+55 11 95555-4444',
        email: 'luciana@traducoes.exemplo.com',
        categoria: 'Tradutor Juramentado',
        pais: 'Brasil',
        cidade: 'São Paulo',
        moeda: 'BRL',
        proposta: 'Atendimento em 48h para certidões civis e antecedentes com 15% de repasse.',
        mensagem: 'Gostaríamos de homologar parceria fixa para clientes brasileiros.',
        status: 'Nova',
        createdAt: nowIso,
      },
    ],
    messageTemplates: [...SEED_MESSAGE_TEMPLATES],
    documentTemplates: [...SEED_DOCUMENT_TEMPLATES],
    generatedDocuments: [],
    auditLogs: [],
    staffUsers: [adminProfile],
  };
}

let cachedDataset: DevE2eDataset | null = null;
const listeners = new Set<() => void>();

export function getDevE2eDataset(): DevE2eDataset {
  if (!import.meta.env.DEV) {
    return buildInitialE2eDataset();
  }
  if (!cachedDataset) {
    cachedDataset = buildInitialE2eDataset();
  }
  return cachedDataset;
}

export function subscribeDevE2eChanges(cb: () => void): () => void {
  if (!import.meta.env.DEV) return () => {};
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notifyDevE2eChanges() {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  }
}

export function devE2eSaveDocument(collectionName: string, id: string, data: Record<string, unknown>, isNew: boolean): void {
  if (!import.meta.env.DEV) return;
  const ds = getDevE2eDataset();
  const listKey = collectionName as keyof DevE2eDataset;
  const target = ds[listKey];
  if (!Array.isArray(target)) return;
  const nextItem = { ...data, id, updatedAt: new Date().toISOString() };
  const list = target as unknown as Array<Record<string, unknown>>;
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0 && !isNew) {
    list[idx] = { ...list[idx], ...nextItem };
  } else if (idx >= 0) {
    list[idx] = nextItem;
  } else {
    list.unshift(nextItem);
  }
  notifyDevE2eChanges();
}

export function devE2eDeleteDocument(collectionName: string, id: string): void {
  if (!import.meta.env.DEV) return;
  const ds = getDevE2eDataset();
  const listKey = collectionName as keyof DevE2eDataset;
  const target = ds[listKey];
  if (!Array.isArray(target)) return;
  (ds as unknown as Record<string, unknown>)[collectionName] = (target as Array<{ id?: string; caseId?: string }>).filter(
    (item) => (item.id || item.caseId) !== id,
  );
  notifyDevE2eChanges();
}

export function devE2eSyncPartnerAndPublic(partner: Partner, isNew: boolean): void {
  if (!import.meta.env.DEV) return;
  devE2eSaveDocument('partners', partner.id, partner as unknown as Record<string, unknown>, isNew);
  if (partner.recomendadoAosClientes && partner.statusHomologacao === 'Ativo/Indicado') {
    const pubPayload: PartnerPublic = {
      id: partner.id,
      nome: partner.nome,
      categoria: partner.categoria,
      pais: partner.pais,
      cidadeRegiao: partner.cidadeRegiao,
      whatsapp: partner.whatsapp,
      siteInstagram: partner.siteInstagram,
      avaliacao: partner.avaliacao,
      descricaoPublica: partner.descricaoPublica || partner.condicoesParceria || '',
      recomendadoAosClientes: true,
      statusHomologacao: 'Ativo/Indicado',
      updatedAt: new Date().toISOString(),
    };
    devE2eSaveDocument('partnersPublic', partner.id, pubPayload as unknown as Record<string, unknown>, true);
  } else {
    devE2eDeleteDocument('partnersPublic', partner.id);
  }
}

export function devE2eDeletePartnerCascade(partnerId: string): void {
  if (!import.meta.env.DEV) return;
  const ds = getDevE2eDataset();
  ds.partnersPublic = ds.partnersPublic.filter((p) => p.id !== partnerId);
  ds.partnerProposals = ds.partnerProposals.map((prop) =>
    prop.partnerIdVinculado === partnerId ? { ...prop, partnerIdVinculado: '' } : prop,
  );
  ds.partners = ds.partners.filter((p) => p.id !== partnerId);
  notifyDevE2eChanges();
}

export function devE2eDeleteClientCascade(clientId: string): number {
  if (!import.meta.env.DEV) return 0;
  const ds = getDevE2eDataset();
  const caseIds = new Set(ds.cases.filter((c) => c.clientId === clientId).map((c) => c.id));
  let deleted = 0;
  const prune = <T extends { clientId?: string; caseId?: string }>(arr: T[]): T[] => {
    const kept: T[] = [];
    for (const item of arr) {
      if (item.clientId === clientId || (item.caseId && caseIds.has(item.caseId))) {
        deleted += 1;
      } else {
        kept.push(item);
      }
    }
    return kept;
  };
  ds.dependents = prune(ds.dependents);
  ds.caseDocuments = prune(ds.caseDocuments);
  ds.tasks = prune(ds.tasks);
  ds.deadlines = prune(ds.deadlines);
  ds.appointments = prune(ds.appointments);
  ds.communicationLogs = prune(ds.communicationLogs);
  ds.viabilityAssessments = prune(ds.viabilityAssessments);
  ds.budgets = prune(ds.budgets);
  ds.financialRecords = prune(ds.financialRecords);
  ds.generatedDocuments = prune(ds.generatedDocuments);
  ds.caseFinancials = ds.caseFinancials.filter((cf) => {
    const rm = cf.clientId === clientId || caseIds.has(cf.caseId);
    if (rm) deleted += 1;
    return !rm;
  });
  ds.cases = ds.cases.filter((c) => {
    const rm = c.clientId === clientId;
    if (rm) deleted += 1;
    return !rm;
  });
  ds.clients = ds.clients.filter((c) => c.id !== clientId);
  notifyDevE2eChanges();
  return deleted;
}

export function devE2eGetCatalog(): {
  categories: typeof SEED_VISA_CATEGORIES;
  requirements: typeof SEED_VISA_REQUIREMENTS;
  legalSources: LegalSource[];
} {
  const ds = getDevE2eDataset();
  return {
    categories: SEED_VISA_CATEGORIES,
    requirements: SEED_VISA_REQUIREMENTS,
    legalSources: ds.legalSources,
  };
}

export function devE2eGetWorkspace(role: UserRole) {
  const ds = getDevE2eDataset();
  const canSeeFinance = role === 'admin' || role === 'consultor';
  return {
    leads: ds.leads,
    clients: ds.clients,
    dependents: ds.dependents,
    cases: ds.cases,
    caseFinancials: canSeeFinance ? ds.caseFinancials : [],
    caseDocuments: ds.caseDocuments,
    tasks: ds.tasks,
    deadlines: ds.deadlines,
    appointments: ds.appointments,
    communicationLogs: ds.communicationLogs,
    viabilityAssessments: ds.viabilityAssessments,
    budgets: canSeeFinance ? ds.budgets : [],
    financialRecords: canSeeFinance ? ds.financialRecords : [],
    partners: canSeeFinance ? ds.partners : [],
    partnerProposals: canSeeFinance ? ds.partnerProposals : [],
    messageTemplates: ds.messageTemplates,
    documentTemplates: ds.documentTemplates,
    generatedDocuments: canSeeFinance ? ds.generatedDocuments : ds.generatedDocuments.filter((g) => !g.financeiro),
    auditLogs: ds.auditLogs,
    staffUsers: canSeeFinance ? ds.staffUsers : [],
  };
}

export function devE2eBuildAiHealth() {
  return {
    ok: true,
    geminiConfigured: false,
    mode: 'rules_live_hybrid' as const,
    primaryModel: 'gemini-4-hydrogen',
    fallbackModel: 'gemini-3.1-flash-lite',
    activeEngine: 'Motor Local Inteligente + Consulta HTTP SERMIG/BCN ao vivo',
    features: [
      'diagnostico',
      'parecer',
      'analisar-documento',
      'custos',
      'proposta',
      'norma',
      'norma-verificar',
    ],
  };
}

export function devE2eExecuteAiResponse(endpoint: string, body: unknown): Record<string, unknown> {
  const payload = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const meta = {
    rascunho: true,
    fallback: true,
    origem: 'regras',
    origemLabel: 'Motor local inteligente + regras — validação E2E',
    modeloUsado: 'regras',
    tentativas: 0,
    mensagemUsuario: 'Rascunho gerado pelo motor local inteligente. Revise antes de liberar.',
  };

  if (endpoint === '/api/ai/diagnostico') {
    const sub = typeof payload.subcategoriaRecomendada === 'string' && payload.subcategoriaRecomendada
      ? payload.subcategoriaRecomendada
      : '15 - Acordo Mercosul';
    return {
      ...meta,
      resumoExecutivo: `[Motor local inteligente] Pré-análise estruturada para "${sub}". Documentação base e elegibilidade inicial conferidas conforme regras vigentes da consultoria.`,
      riscos: ['Conferir validade mínima do passaporte (>= 12 meses) antes do protocolo no SERMIG.'],
      perguntasConsultor: ['Validar data prevista de ingresso no Chile e emissão das certidões apostiladas.'],
      pontosAtencao: ['Emitir Antecedentes Criminais da Polícia Federal por último (validade de 60 dias).'],
      fontesCitadas: ['Ley 21.325 (SERMIG)', 'Decreto Supremo Nº 177/2022', 'Acordo Mercosul'],
      proximosPassos: [
        'Revisar documentos civis apostilados.',
        'Confirmar cronograma de protocolo com o consultor.',
      ],
    };
  }

  if (endpoint === '/api/ai/parecer') {
    return {
      ...meta,
      enquadramentoLegal: 'Enquadramento preliminar na Subcategoria 15 (Acordo Mercosul — Residência Temporal), conforme Ley 21.325 e Decreto Supremo Nº 177/2022.',
      elegibilidadeRiscos: 'Perfil com alta viabilidade inicial. Conferir validade do passaporte, certidões apostiladas e ausência de restrições na PDI.',
      fundamentacaoNormativa: '- Ley Nº 21.325 de Migración y Extranjería\n- Decreto Supremo Nº 177/2022 (Subcategorias)',
      recomendacoes: '1) Consolidar checklist documental do titular.\n2) Protocolar no portal SERMIG com antecedência.\n3) Validar taxas antes da emissão final.',
    };
  }

  if (endpoint === '/api/ai/proposta') {
    const prop = (payload.proposal && typeof payload.proposal === 'object' ? payload.proposal : {}) as Record<string, unknown>;
    return {
      ...meta,
      nota: 85,
      riscos: ['Solicitar cláusula de confidencialidade LGPD antes do envio de documentos de clientes.'],
      baseAplicada: 'Base Legal Interna D&M Integra Chile + Critérios de Homologação de Parceiros',
      sugestaoDecisao: 'indicar com ressalvas',
      textoIndicacao: `${String(prop.nome_empresa || 'Parceiro')} — proposta avaliada positivamente para atendimento em ${String(prop.categoria || 'serviços migratórios')}.`,
    };
  }

  if (endpoint === '/api/ai/custos') {
    const cur = (payload.currentCustos && typeof payload.currentCustos === 'object' ? payload.currentCustos : {}) as Record<string, unknown>;
    return {
      ...meta,
      estimativa: true,
      taxaSermigMercosulUsd: typeof cur.taxaSermigMercosulUsd === 'number' ? cur.taxaSermigMercosulUsd : 90,
      taxaSermigTemporalUsd: typeof cur.taxaSermigTemporalUsd === 'number' ? cur.taxaSermigTemporalUsd : 90,
      taxaSermigDefinitivaUsd: typeof cur.taxaSermigDefinitivaUsd === 'number' ? cur.taxaSermigDefinitivaUsd : 120,
      apostilaCnjBrl: typeof cur.apostilaCnjBrl === 'number' ? cur.apostilaCnjBrl : 185,
      traducaoJuramentadaBrl: typeof cur.traducaoJuramentadaBrl === 'number' ? cur.traducaoJuramentadaBrl : 210,
      cedulaIdentidadeClp: typeof cur.cedulaIdentidadeClp === 'number' ? cur.cedulaIdentidadeClp : 4270,
      observacao: 'Tabela referencial consolidada pelo motor local — confirmar valores finais no SERMIG e CNJ.',
      atualizadoEm: new Date().toLocaleDateString('pt-BR'),
    };
  }

  if (endpoint === '/api/ai/norma-verificar' || endpoint === '/api/ai/norma') {
    const src = (payload.currentSource && typeof payload.currentSource === 'object' ? payload.currentSource : {}) as Record<string, unknown>;
    const link = typeof src.linkOficial === 'string' && src.linkOficial ? src.linkOficial : 'https://serviciomigraciones.cl';
    return {
      ...meta,
      possuiAtualizacao: false,
      situacaoAtual: 'Vigente — conferência recomendada no portal oficial',
      artigosExtraidos: typeof src.artigos === 'string' && src.artigos ? src.artigos : 'Art. 15 e disposições gerais',
      resumoExecutivo: `Verificação preliminar concluída para "${String(src.titulo || 'Norma SERMIG')}". Mantido o texto vigente cadastrado até validação humana.`,
      explicacaoCliente: 'Norma oficial ativa para orientação de residência no Chile.',
      impactosVistos: ['Manter checklist atual de Residência Temporal até confirmação no Diário Oficial.'],
      divergencias: ['Nenhuma divergência crítica detectada automaticamente.'],
      fontesCitadas: [link, 'https://serviciomigraciones.cl', 'https://www.bcn.cl/leychile'],
    };
  }

  return {
    ...meta,
    nomeIdentificado: String(payload.nomeEsperado || 'Documento do checklist'),
    dataEmissao: 'Não informada',
    orgaoEmissor: 'Polícia Federal (Brasil) / órgão emissor oficial',
    idioma: 'Português / Espanhol',
    possuiApostila: true,
    legibilidade: 'Pré-conferência local concluída — conferência visual obrigatória pelo analista',
    sugestao: 'Revisar',
    justificativa: 'Pré-análise estrutural gerada pelo motor local inteligente. A decisão final permanece com o analista.',
  };
}

