export type UserRole = 'admin' | 'consultor' | 'assistente' | 'cliente';
export type UserStatus = 'ativo' | 'pendente' | 'inativo';
export type CurrencyCode = 'BRL' | 'CLP' | 'USD';
export type FontChoice =
  | 'Plus Jakarta Sans'
  | 'DM Sans'
  | 'Manrope'
  | 'Public Sans'
  | 'Montserrat'
  | 'Merriweather'
  | 'Inter';
export type DisplayFontChoice =
  | 'Plus Jakarta Sans'
  | 'Outfit'
  | 'Manrope'
  | 'Playfair Display'
  | 'Montserrat';

export interface NavLinkConfig {
  path: string;
  label: string;
  visivel: boolean;
}

export interface SiteLayoutConfig {
  logoAlturaPx?: number;
  mostrarNomeComLogo?: boolean;
  raioBordas?: 'sharp' | 'editorial' | 'arredondado';
  densidadeSecoes?: 'compacta' | 'equilibrada' | 'ampla';
  estiloCabecalho?: 'sticky_vidro' | 'solido' | 'minimal';
  textoCtaCabecalho?: string;
  destinoCtaCabecalho?: string;
  mostrarBotaoWhatsappFlutuante?: boolean;
  mostrarBarraCtaMobile?: boolean;
  rodapeSubtitulo?: string;
  rodapeCopyright?: string;
  linksNavegacao?: NavLinkConfig[];
}

export interface MediaAsset {
  id: string;
  nome: string;
  categoria: 'logo' | 'favicon' | 'banner' | 'equipe' | 'geral';
  mimeType: string;
  url: string;
  largura?: number;
  altura?: number;
  tamanhoBytes: number;
  uploadedBy?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  nome: string;
  email: string;
  fotoUrl?: string;
  role: UserRole;
  status: UserStatus;
  clientId?: string;
  quemSomosBio?: string;
  quemSomosFormacao?: string;
  quemSomosExperiencia?: string;
  quemSomosMissao?: string;
  quemSomosCredenciais?: string;
  quemSomosFotoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustosPadrao {
  taxaSermigMercosulUsd?: number;
  taxaSermigTemporalUsd?: number;
  taxaSermigDefinitivaUsd?: number;
  apostilaCnjBrl?: number;
  traducaoJuramentadaBrl?: number;
  cedulaIdentidadeClp?: number;
  observacao?: string;
  atualizadoEm?: string;
  fonteObservacao?: string;
}

export interface EmpresaConfig {
  nome_empresa: string;
  razao_social_cnpj_rut: string;
  responsavel_tecnico: string;
  endereco_cidade: string;
  foro_comarca: string;
  logoUrl: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  corPrimaria: string;
  corDestaque: string;
  corFundo: string;
  corSuperficie?: string;
  corTexto?: string;
  corRodapeBg?: string;
  fontePrincipal: FontChoice;
  fonteDisplay?: DisplayFontChoice;
  layoutConfig?: SiteLayoutConfig;
  whatsapp: string;
  email: string;
  siteInstagram: string;
  siteLinkedIn?: string;
  linkCalendly: string;
  emailGoogleAgenda: string;
  chavePix: string;
  linkPagamentoCartao: string;
  textoContratoPadrao: string;
  textoReciboPadrao: string;
  termoLgpd: string;
  termoLgpdVersao: string;
  avisoLegal: string;
  bloqueioProtocoloMinimo: number;
  diasAlertaRevisaoLegal: number;
  diasExpiracaoLinkDiagnostico?: number;
  honorariosPadraoMinBrl?: number;
  honorariosPadraoMaxBrl?: number;
  taxaCambioBrlClp?: number;
  taxaCambioUsdBrl?: number;
  custosPadrao?: CustosPadrao;
  ultimaRevisaoNormativa?: string;
  textoContratoVersao?: string;
  textoContratoVigencia?: string;
  textoReciboVersao?: string;
  textoReciboVigencia?: string;
  termoLgpdVigencia?: string;
  retencaoDadosDias?: number;
  seoTituloPadrao?: string;
  seoDescricaoPadrao?: string;
  depoimentosAutorizados?: {
    id: string;
    nome: string;
    cidadeOrigem?: string;
    subcategoria?: string;
    depoimento: string;
    autorizado: boolean;
    dataAutorizacao?: string;
  }[];
  quemSomosMarcoHistorico?: { ano: string; titulo: string; descricao: string }[];
  siteDraft?: SiteContent[];
  sitePublicadoEm?: string;
  siteVersaoAtual?: string;
  siteHistorico?: {
    versao: string;
    publicadoEm: string;
    publicadoPor: string;
    secoes: SiteContent[];
  }[];
  fcmVapidPublicKey?: string;
  updatedAt?: string;
}

export interface BancarioConfig {
  dados_bancarios_br: string;
  dados_bancarios_cl: string;
  dados_wise: string;
  updatedAt?: string;
}

export type SiteSectionKey =
  | 'hero'
  | 'servicos'
  | 'diferenciais'
  | 'como_funciona'
  | 'quem_somos'
  | 'parceiros'
  | 'depoimentos'
  | 'faq'
  | 'contato'
  | 'rodape'
  | 'bloco_livre';

export interface SiteContent {
  id: string;
  secao: SiteSectionKey;
  titulo: string;
  subtitulo: string;
  conteudoHtml: string;
  imagemUrl: string;
  ctaTexto?: string;
  ctaDestino?: string;
  seoTitulo?: string;
  seoDescricao?: string;
  ordem: number;
  ativo: boolean;
  metadados?: Record<string, unknown>;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  acao: string;
  entidade: string;
  entidadeId: string;
  campo?: string;
  antes?: string;
  depois?: string;
  createdAt: string;
}

export type PartnerCategory =
  | 'Escritório de Advocacia'
  | 'Cartório / Apostilamento'
  | 'Tradutor Juramentado'
  | 'Seguradora / Saúde'
  | 'Imobiliária'
  | 'Escola / Universidade'
  | 'Despachante'
  | 'Contabilidade / Abertura Empresa'
  | 'Outro';

export interface PartnerProposal {
  id: string;
  nome_empresa: string;
  categoria: PartnerCategory;
  pais: 'Brasil' | 'Chile' | 'Ambos';
  cidade: string;
  responsavel: string;
  whatsapp: string;
  email: string;
  moeda: CurrencyCode;
  proposta: string;
  mensagem: string;
  status: 'Nova' | 'Em Análise' | 'Aprovada' | 'Recusada';
  parecerIa?: string;
  decisaoConsultor?: string;
  textoIndicacao?: string;
  partnerIdVinculado?: string;
  notasInternas?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Partner {
  id: string;
  nome: string;
  tipoPessoa: 'Pessoa Física' | 'Pessoa Jurídica';
  categoria: PartnerCategory;
  pais: 'Brasil' | 'Chile' | 'Ambos';
  cidadeRegiao: string;
  contato: string;
  whatsapp: string;
  email: string;
  siteInstagram: string;
  moedaNegociacao: CurrencyCode;
  tabelaValoresComissao: string;
  condicoesParceria: string;
  recomendadoAosClientes: boolean;
  avaliacao: number;
  statusHomologacao: 'Ativo/Indicado' | 'Em Análise' | 'Não Indicado/Suspenso';
  descricaoPublica?: string;
  observacoes: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PartnerPublic {
  id: string;
  nome: string;
  categoria: string;
  pais: string;
  cidadeRegiao: string;
  whatsapp: string;
  siteInstagram: string;
  avaliacao: number;
  descricaoPublica: string;
  recomendadoAosClientes: boolean;
  statusHomologacao: 'Ativo/Indicado';
  updatedAt?: string;
}

export type LegalSourceType =
  | 'Lei'
  | 'Decreto'
  | 'Resolução'
  | 'Circular'
  | 'Acordo Internacional'
  | 'Portal Oficial'
  | 'Jurisprudência';

export interface LegalSource {
  id: string;
  titulo: string;
  tipo: LegalSourceType;
  pais: 'Chile' | 'Brasil' | 'Mercosul';
  numeroAno: string;
  orgaoEmissor: string;
  artigos: string;
  artigosEstruturados?: { numero: string; titulo: string; resumo: string }[];
  dataPublicacao?: string;
  dataVigencia?: string;
  resumoPortugues: string;
  explicacaoCliente: string;
  textoIntegral: string;
  arquivoPdfUrl?: string;
  tags: string[];
  linkOficial: string;
  versao: string;
  statusVigencia: 'Vigente' | 'Alterada' | 'Revogada' | 'A verificar';
  ultimaVerificacao?: string;
  responsavelVerificacao?: string;
  normasRelacionadas?: string[];
  notasInternasConsultor?: string;
  favoritoPorUids?: string[];
  documentTemplateIds?: string[];
  deadlineTipos?: string[];
  historicoVersoes?: { versao: string; data: string; resumo: string; textoSnapshot?: string }[];
  updatedAt?: string;
}

export interface VisaCategory {
  id: string;
  codigo: string;
  nomeEspanhol: string;
  nomePortugues: string;
  descricao: string;
  publicoAlvo: string;
  permiteDentroChile: 'Sim' | 'Não' | 'Condicional';
  vigenciaMeses: number;
  levaDefinitiva: boolean;
  mesesDefinitiva: number;
  permiteTrabalhar: boolean;
  exigeRenda: boolean;
  brasileirosElegiveis: boolean;
  ativo: boolean;
  fonteUrl: string;
  ultimaVerificacao?: string;
  statusVerificacao: 'Verificado' | 'A verificar';
  legalSourceIds?: string[];
  updatedAt?: string;
}

export type DocCategory =
  | 'Identidade'
  | 'Antecedentes'
  | 'Familiares'
  | 'Profissional/Financeiro'
  | 'Apostilas'
  | 'Traduções'
  | 'Fotos'
  | 'Taxas';

export interface VisaRequirement {
  id: string;
  visaCategoryId: string;
  nomeDocumento: string;
  categoriaDoc: DocCategory;
  descricao: string;
  comoObterInstrucoes: string;
  comoObterUrl: string;
  obrigatorio: boolean;
  peso: number; // 1-5
  ordemPrioridadeEmissao: number; // 1-20
  exigeApostila: boolean;
  exigeTraducao: boolean;
  validadeDias: number; // 0 = não vence
  orgaoEmissor: string;
}

export type DiagnosticLocation =
  | 'No Brasil'
  | 'No Chile como turista'
  | 'No Chile com residência'
  | 'Em outro país';

export type DiagnosticObjective =
  | 'trabalho_formal'
  | 'servicos_90d'
  | 'nomade_digital'
  | 'empreender_investir'
  | 'estudar'
  | 'aposentado_renda'
  | 'tratamento_medico'
  | 'religioso'
  | 'humanitario'
  | 'temporada'
  | 'dependente_titular'
  | 'explorar';

export type RiskFieldKey = 'overstay' | 'ordenAbandono' | 'rejeicaoAnterior' | 'antecedentesCriminais';

export interface DiagnosticFamilyMemberInput {
  nome: string;
  papel: 'Titular' | 'Dependente';
  parentesco: string;
  nacionalidadeBrasileira: boolean;
}

export interface DiagnosticAnswers {
  // Etapa 1
  nome: string;
  whatsapp: string;
  email: string;
  cidadeUf: string;
  origem: 'Instagram' | 'Indicação' | 'Site' | 'Parceiro' | 'Outro';
  // Etapa 2
  localizacao: DiagnosticLocation;
  faixaEtaria?: 'maior_18' | 'menor_18_com_pais' | 'menor_18_desacompanhado';
  mesesResidenciaChile?: number;
  residenteSubcategoriaAtual?: string;
  residenteVenceEmDias?: 'mais_90' | 'entre_90_e_10' | 'menos_10' | 'vencida';
  residenteMesesForaUltimoAno?: number;
  entradaRecenteChileTurista?: boolean | null;
  nacionalidadeBrasileira: boolean | null;
  possuiSegundaNacionalidade: boolean | null;
  segundaNacionalidadeQual?: string;
  passaporteStatus?: 'valido' | 'vencido' | 'nao_possui';
  passaporteValidadeMeses: number; // >= 12 ideal
  // Etapa 3
  vinculoFamiliarChile: boolean | null;
  familiarStatusChile?: 'chileno' | 'residente_definitivo' | 'residente_temporal';
  vinculoTipo?: 'Cônjuge/União Civil' | 'Filho(a) chileno(a)' | 'Pais/Dependente' | 'Outro';
  vinculoFormalizado: boolean | null;
  composicaoFamiliar?: 'individual' | 'casal' | 'familia_com_filhos';
  pessoasFamilia?: DiagnosticFamilyMemberInput[];
  // Etapa 4
  objetivo: DiagnosticObjective | '';
  possuiOfertaTrabalhoFormal: boolean | null;
  contratoNotariadoEmpresaChilena?: boolean | null;
  possuiMatriculaReconhecida: boolean | null;
  possuiRendaPassiva: boolean | null;
  faixaRendaMensalUsd?: 'abaixo_1000' | '1000_2500' | 'acima_2500';
  possuiCapitalComprovadoOrigem: boolean | null;
  investimentoAcima500kUsd?: boolean | null;
  titularTemResidenciaChile: boolean | null;
  possuiCertificadoMedicoChile?: boolean | null;
  possuiRespaldoEntidadeReligiosa?: boolean | null;
  possuiContratoSazonal?: boolean | null;
  motivoHumanitarioTipo?: 'protecao_vulnerabilidade' | 'vitima_trafico_violencia' | 'menor_desprotegido' | 'outro_humanitario';
  // Etapa 5 (Riscos independentes)
  overstay: boolean | null;
  ordenAbandono: boolean | null;
  rejeicaoAnterior: boolean | null;
  antecedentesCriminais: boolean | null;
  riscoConsultaConsultor?: RiskFieldKey[];
  // Etapa 6
  familiaAcompanhante: boolean | null;
  quantidadeDependentes: number;
  prazoPretendido: 'Imediato (até 30 dias)' | '1 a 3 meses' | '3 a 6 meses' | 'Mais de 6 meses';
  documentosJaPossui: string[];
  lgpdAceito: boolean;
  lgpdVersao: string;
}

export type DiagnosticConfidence = 'Alta' | 'Média' | 'Baixa';
export type LeadTemperature = 'Quente' | 'Morno' | 'Frio';

export interface DiagnosticRuleItem {
  id: string;
  codigo: string;
  nome: string;
  categoriaAlvo: string;
  condicao:
    | 'brasileiro_mercosul'
    | 'turista_sem_vinculo'
    | 'vinculo_formalizado'
    | 'vinculo_nao_formalizado'
    | 'trabalho_formal'
    | 'estudar_com_matricula'
    | 'aposentado_renda'
    | 'investidor_com_origem'
    | 'humanitario'
    | 'medico'
    | 'religioso'
    | 'temporada'
    | 'dependente_titular'
    | 'passaporte_curto'
    | 'passaporte_vencido'
    | 'residente_prorrogacao'
    | 'residente_definitiva'
    | 'menor_acompanhado'
    | 'risco_explicito';
  notaBase: number;
  ajusteNota: number;
  explicacaoTecnica: string;
  explicacaoCliente: string;
  legalSourceId?: string;
  ativa: boolean;
}

export interface DiagnosticRuleVersion {
  id: string;
  versao: string;
  dataPublicacao: string;
  publicadoPor: string;
  ativa: boolean;
  resumoMudanca: string;
  regras: DiagnosticRuleItem[];
  honorariosMinBrl?: number;
  honorariosMaxBrl?: number;
  taxaCambioBrlClp?: number;
  taxaCambioUsdBrl?: number;
  createdAt?: string;
}

export interface DiagnosticSession {
  id: string; // token não adivinhável (>= 20 chars)
  etapaAtual: number;
  answers: DiagnosticAnswers;
  concluido: boolean;
  leadId?: string;
  expiraEmMs: number;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LeadRuleHistoryEntry {
  versaoRegras: string;
  dataCalculo: string;
  subcategoriaSugerida: string;
  notaViabilidade: number;
  confianca: DiagnosticConfidence;
}

export interface Lead {
  id: string;
  nome: string;
  whatsapp: string;
  email: string;
  cidadeUf: string;
  origem: 'Instagram' | 'Indicação' | 'Site' | 'Parceiro' | 'Outro';
  interesse: string;
  statusFunil: 'Novo' | 'Contatado' | 'Diagnóstico Agendado' | 'Orçamento Enviado' | 'Fechado' | 'Perdido';
  motivoPerda?: string;
  responsavelId?: string;
  respostasTriagem?: DiagnosticAnswers;
  subcategoriaSugerida?: string;
  notaViabilidade?: number;
  confianca?: DiagnosticConfidence;
  temperatura?: LeadTemperature;
  flagsRisco?: string[];
  versaoRegras?: string;
  sessionToken?: string;
  statusConclusao?: 'Em andamento' | 'Concluído' | 'Abandonado';
  etapaAtual?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  primeiroContatoEm?: string;
  historicoResultados?: LeadRuleHistoryEntry[];
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  notas?: string;
  lgpdAceito: boolean;
  lgpdVersao: string;
  lgpdData: string;
  convertedClientId?: string;
  convertedCaseId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Client {
  id: string;
  nomeCompleto: string;
  cpf: string;
  email: string;
  whatsapp: string;
  dataNascimento?: string;
  estadoCivil?: string;
  nacionalidade?: string;
  profissao?: string;
  escolaridade?: string;
  anosExperiencia?: number;
  rendaMensal?: number;
  origemRenda?: string;
  enderecoCompleto?: string;
  passaporte?: {
    numero?: string;
    emissao?: string;
    validade?: string;
  };
  objetivoChile?: string;
  dataPrevistaMudanca?: string;
  userId?: string;
  portalLiberado: boolean;
  statusAcessoPortal: 'Não solicitado' | 'Pendente liberação' | 'Liberado';
  lgpdAceito?: boolean;
  lgpdAceitoEm?: string;
  lgpdVersao?: string;
  lgpdExclusaoSolicitadaEm?: string;
  lgpdExclusaoConcluidaEm?: string;
  filiacao?: string;
  naturalidade?: string;
  idiomas?: string;
  contatoEmergencia?: string;
  preferenciaContato?: 'WhatsApp' | 'E-mail' | 'Ligação';
  observacoes?: string;
  observacoesInternas?: string;
  arquivado?: boolean;
  arquivadoEm?: string;
  conviteEnviadoEm?: string;
  mescladoEm?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Dependent {
  id: string;
  clientId: string;
  nomeCompleto: string;
  parentesco: 'Cônjuge' | 'Companheiro(a)' | 'Filho(a)' | 'Enteado(a)' | 'Pai/Mãe' | 'Outro';
  dataNascimento?: string;
  idade?: number;
  estudante?: boolean;
  nacionalidade?: string;
  cpf?: string;
  passaporteNumero?: string;
  passaporteValidade?: string;
  observacoes?: string;
}

export interface Case {
  id: string;
  titulo: string;
  clientId: string;
  consultorId?: string;
  tipoServico:
    | 'Residência Temporal'
    | 'Residência Definitiva'
    | 'Prorrogação'
    | 'Mudança de Subcategoria'
    | 'Ratificação'
    | 'Relocation Completo'
    | 'Outro';
  visaCategoryId?: string;
  subcategoriaIa?: string;
  etapaPipeline: number; // 1-15
  statusSermig:
    | 'Não protocolado'
    | 'Em trâmite'
    | 'Requerimento de documentos'
    | 'Aprovado'
    | 'Rejeitado'
    | 'Em recurso';
  portalLiberado: boolean;
  relatorioViabilidadeLiberado: boolean;
  dataContrato?: string;
  dataProtocolo?: string;
  dataAprovacao?: string;
  dataLimiteEntrada?: string; // 90d para Estampado
  dataVencimentoResidencia?: string;
  prazoRequerimento?: string;
  numeroPedidoSermig?: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  notaViabilidadeGeral?: number;
  parecerConsultor?: string;
  parecerIa?: string;
  overrideProtocoloMinimo?: {
    autorizadoPor: string;
    justificativa: string;
    data: string;
  };
  npsNota?: number;
  npsComentario?: string;
  observacoesInternas?: string;
  comprovanteProtocoloUrl?: string;
  historicoStatusSermig?: {
    status: Case['statusSermig'];
    data: string;
    nota?: string;
    autor: string;
  }[];
  motivoEncerramento?: string;
  encerradoEm?: string;
  arquivado?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CaseFinancialSummary {
  caseId: string;
  clientId: string;
  valorContrato: number;
  moeda: CurrencyCode;
  liberadoAoCliente: boolean;
  updatedAt?: string;
}

export type DocumentStep =
  | '1 Aguardando Envio'
  | '2 Recebido/Triagem'
  | '3 Em Conferência'
  | '4 Pendência/Reprovado'
  | '5 Pronto para Apostila/Tradução'
  | '6 Aprovado para Protocolo';

export interface CaseDocument {
  id: string;
  caseId: string;
  clientId: string;
  pessoa: string; // 'Titular' ou nome do dependente
  visaRequirementId?: string;
  nomeDocumento: string;
  categoriaDoc: DocCategory;
  etapaEsteira: DocumentStep;
  ordemEmissao: number;
  prazoSugeridoEmissao?: string;
  arquivoUrl?: string;
  arquivoNome?: string;
  anexos?: { nome: string; url: string; data: string; tamanhoBytes?: number }[];
  status: 'Pendente' | 'Enviado' | 'Em análise' | 'Aprovado' | 'Reprovado' | 'Vencido';
  dataEmissao?: string;
  validadeDias: number;
  dataValidadeCalculada?: string;
  orgaoEmissor?: string;
  apostilado: boolean;
  traduzido: boolean;
  exigeApostila: boolean;
  exigeTraducao: boolean;
  obrigatorio: boolean;
  peso: number;
  motivoReprovacao?: string;
  observacaoAnalista?: string;
  observacoes?: string;
  versao: number;
  historicoVersoes?: { versao: number; arquivoUrl: string; data: string; motivo?: string }[];
  analiseIaSugestao?: string;
  analisadoPor?: string;
  analisadoEm?: string;
  updatedAt?: string;
}

export interface Task {
  id: string;
  titulo: string;
  descricao?: string;
  caseId?: string;
  clientId?: string;
  responsavelId?: string;
  prazo?: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  status: 'Pendente' | 'Em andamento' | 'Concluída';
  createdAt: string;
}

export interface Deadline {
  id: string;
  titulo: string;
  tipo:
    | 'Validade Documento'
    | 'Validade Passaporte'
    | 'Entrada no Chile 90d'
    | 'Janela Prorrogação'
    | 'Elegibilidade Definitiva'
    | 'Prazo Legal 6 Meses SERMIG'
    | 'Resposta Requerimento/Recurso'
    | 'Vencimento Cédula'
    | 'Parcela/Reunião';
  dataLimite: string;
  caseId?: string;
  clientId?: string;
  concluido: boolean;
  observacoes?: string;
}

export interface Appointment {
  id: string;
  titulo: string;
  dataHoraInicio: string;
  dataHoraFim?: string;
  clientId?: string;
  caseId?: string;
  tipo: 'Diagnóstico' | 'Reunião de Onboarding' | 'Conferência Documental' | 'Acompanhamento' | 'Outro';
  linkReuniao?: string;
  status: 'Agendado' | 'Confirmado' | 'Realizado' | 'Cancelado';
  observacoes?: string;
  createdAt: string;
}

export interface CommunicationLog {
  id: string;
  canal: 'WhatsApp' | 'E-mail' | 'Ligação' | 'Sistema' | 'Chat Portal';
  assunto: string;
  mensagem: string;
  clientId?: string;
  caseId?: string;
  leadId?: string;
  autorNome: string;
  createdAt: string;
  origem?: 'cliente' | 'equipe';
  remetenteUid?: string;
  documentId?: string;
  documentNome?: string;
  lidaPelaEquipe?: boolean;
  lidaPeloCliente?: boolean;
  updatedAt?: string;
}

export interface ViabilityAssessment {
  id: string;
  caseId: string;
  clientId: string;
  versao: number;
  enquadramentoLegal: string;
  elegibilidadeRiscos: string;
  fundamentacaoNormativa: string;
  recomendacoes: string;
  notaGeral: number;
  rascunhoIa: boolean;
  liberadoAoCliente: boolean;
  autorNome: string;
  createdAt: string;
}

export interface BudgetItem {
  id: string;
  descricao: string;
  etapaVinculada: string;
  valorHonorarios: number;
  taxasEstimadasTerceiros: number;
  moeda: CurrencyCode;
  statusEtapa: 'Aguardando' | 'Em Execução' | 'Concluída/Faturável' | 'Paga';
}

export interface Budget {
  id: string;
  numeroOrcamento: string;
  leadId?: string;
  clientId?: string;
  caseId?: string;
  titulo: string;
  tipoCobranca: 'Por Serviço Escolhido' | 'Por Etapa Realizada' | 'Pacote Completo';
  moedaPrincipal: CurrencyCode;
  taxaCambioBrlClp?: number;
  taxaCambioUsdBrl?: number;
  itens: BudgetItem[];
  desconto: number;
  totalHonorarios: number;
  totalTaxas: number;
  totalGeral: number;
  condicoesPagamento: string;
  validade: string;
  status: 'Rascunho' | 'Enviado ao Cliente' | 'Aprovado' | 'Recusado' | 'Parcialmente Faturado';
  aprovadoEm?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FinancialRecord {
  id: string;
  caseId?: string;
  clientId?: string;
  budgetId?: string;
  tipo: 'Honorários' | 'Taxa SERMIG' | 'Apostila/Tradução' | 'Despachante/Outros';
  descricao: string;
  etapaReferencia?: string;
  moeda: CurrencyCode;
  valor: number;
  vencimento: string;
  dataPagamento?: string;
  status: 'Pendente' | 'Pago' | 'Atrasado';
  formaPagamento?: 'Pix' | 'Cartão' | 'Transferência' | 'Wise' | 'Boleto';
  comprovanteUrl?: string;
  reciboNumero?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface MessageTemplate {
  id: string;
  codigo: string;
  titulo: string;
  canal: 'WhatsApp' | 'E-mail' | 'Ambos';
  corpo: string;
}

export interface DocumentTemplate {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string;
  conteudoHtml: string;
  notaInterna?: string;
}

export interface GeneratedDocument {
  id: string;
  tipo: string;
  titulo: string;
  clientId: string;
  caseId?: string;
  conteudoHtml: string;
  versao: number;
  status?: 'Rascunho' | 'Revisado' | 'Enviado' | 'Assinado' | 'Arquivado';
  codigoVerificacao?: string;
  historicoVersoes?: {
    versao: number;
    conteudoHtml: string;
    data: string;
    autor: string;
    motivo?: string;
  }[];
  assinaturaUrl?: string;
  assinaturaDataUrl?: string;
  assinaturaLinkExterno?: string;
  assinadoEm?: string;
  confirmadoLeituraEm?: string;
  confirmadoLeituraPor?: string;
  motivoCancelamento?: string;
  canceladoEm?: string;
  liberadoAoCliente: boolean;
  financeiro: boolean;
  autorNome: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FcmTokenRecord {
  id: string;
  uid: string;
  clientId: string;
  token: string;
  plataforma: 'web' | 'android' | 'ios';
  userAgent?: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClientNotificationType =
  | 'etapa_pipeline'
  | 'status_sermig'
  | 'documento'
  | 'parecer'
  | 'prazo'
  | 'geral';

export interface ClientNotification {
  id: string;
  clientId: string;
  caseId?: string;
  titulo: string;
  mensagem: string;
  tipo: ClientNotificationType;
  etapaPipeline?: number;
  statusSermig?: string;
  linkDestino?: string;
  lida: boolean;
  lidaEm?: string;
  pushEnviado: boolean;
  pushEnviadosQtd?: number;
  criadoPorUid?: string;
  criadoPorNome?: string;
  createdAt: string;
  updatedAt?: string;
}
