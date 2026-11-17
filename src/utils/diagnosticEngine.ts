import {
  DEFAULT_DIAGNOSTIC_RULE_VERSION,
  DEFAULT_EMPRESA_CONFIG,
  SEED_LEGAL_SOURCES,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type {
  CustosPadrao,
  DiagnosticAnswers,
  DiagnosticConfidence,
  DiagnosticRuleItem,
  DiagnosticRuleVersion,
  Lead,
  LeadTemperature,
  LegalSource,
  RiskFieldKey,
  VisaCategory,
  VisaRequirement,
} from '../types/domain';

/**
 * Normaliza respostas booleanas Sim/Não: null/undefined/false NUNCA contam como Sim.
 */
export function isYes(val: boolean | null | undefined): boolean {
  return val === true;
}

export const VIABILITY_WEIGHTS = {
  ELEGIBILIDADE_LEGAL: 25,
  PRONTIDAO_DOCUMENTAL: 20,
  CAPACIDADE_FINANCEIRA: 15,
  HISTORICO_RISCOS: 15,
  PRAZO: 10,
  ESTABILIDADE_DEFINITIVA: 10,
  VIABILIDADE_FAMILIAR: 5,
} as const;

export interface ViabilityDimension {
  nome: string;
  pontos: number;
  maximo: number;
  observacao: string;
}

export interface DiagnosticCandidate {
  visa: VisaCategory;
  nota: number;
  notaBase: number;
  ajustesAplicados: { regraCodigo: string; motivo: string; delta: number }[];
  motivo: string;
  caminho: string;
  alertas: string[];
}

export interface DiagnosticDiscarded {
  codigo: string;
  nomePortugues: string;
  motivo: string;
}

export interface RiskFlagDetail {
  campo: RiskFieldKey;
  pergunta: string;
  severidade: 'Alta' | 'Média';
  orientacao: string;
}

export interface ContradictionItem {
  codigo: string;
  titulo: string;
  descricao: string;
  perguntaEsclarecimento: string;
}

export interface ActionPlanItem {
  id: string;
  titulo: string;
  detalhe: string;
  prioridade: number;
  validadeDias: number;
  orgao: string;
  bloco: 'facaAgora' | 'em30Dias' | 'antesProtocolo';
}

export interface CostEstimateSummary {
  honorariosMinBrl: number;
  honorariosMaxBrl: number;
  taxasOficiaisBrlMin: number;
  taxasOficiaisBrlMax: number;
  totalMinBrl: number;
  totalMaxBrl: number;
  totalMinClp: number;
  totalMaxClp: number;
  taxaCambioBrlClp: number;
  taxaCambioUsdBrl: number;
  avisoEstimativa: string;
  itensDetalhados: { label: string; valorTexto: string }[];
}

export interface TimelineRangeSummary {
  preparacaoDocumental: string;
  protocoloSermig: string;
  respostaSermig: string;
  observacaoLegal: string;
}

export interface ChecklistReadinessItem {
  id: string;
  nomeDocumento: string;
  categoriaDoc: string;
  obrigatorio: boolean;
  validadeDias: number;
  exigeApostila: boolean;
  exigeTraducao: boolean;
  ordemPrioridadeEmissao: number;
  statusInicial: 'Já possui' | 'Pendente' | 'Crítico / Validade curta';
}

export interface ComparisonRow {
  criterio: string;
  principal: string;
  mercosul: string;
  terceiraOpcao: string;
}

export interface FamilyPersonDiagnostic {
  nome: string;
  papel: 'Titular' | 'Dependente';
  parentesco: string;
  subcategoriaIndicada: string;
  observacao: string;
  documentosEspecificos: string[];
}

export interface DiagnosticResult {
  dadosInsuficientes: boolean;
  mensagemDadosInsuficientes?: string;
  recomendada: DiagnosticCandidate | null;
  top3: DiagnosticCandidate[];
  comparativoMercosul: {
    principal: DiagnosticCandidate | null;
    mercosul: DiagnosticCandidate;
    terceiraOpcao: DiagnosticCandidate | null;
    diferencasChave: string[];
    linhasFixas: ComparisonRow[];
  };
  descartadas: DiagnosticDiscarded[];
  alertas: string[];
  alertaRiscoAlto: string | null;
  flagsRisco: RiskFlagDetail[];
  flagsRevisaoConsultor: { campo: RiskFieldKey; label: string }[];
  caminho: string;
  situacaoResidenciaAtual?: 'Prorrogação' | 'Residência Definitiva em análise' | null;
  perguntasComplementares: string[];
  preChecklist: VisaRequirement[];
  checklistProntidao: {
    itens: ChecklistReadinessItem[];
    percentualInicial: number;
    semaforo: 'Verde' | 'Amarelo' | 'Vermelho';
  };
  planoAcao: {
    facaAgora: ActionPlanItem[];
    em30Dias: ActionPlanItem[];
    antesProtocolo: ActionPlanItem[];
  };
  custosEstimados: CostEstimateSummary;
  cronogramaFaixas: TimelineRangeSummary;
  diagnosticoPorPessoa: FamilyPersonDiagnostic[];
  viabilidade: {
    dimensoes: ViabilityDimension[];
    total: number;
    veredito: 'Viável' | 'Viável com ressalvas' | 'Viável após ajustes' | 'Inviável no momento';
  };
  confianca: DiagnosticConfidence;
  fatoresConfianca: string[];
  contradicoes: ContradictionItem[];
  informacoesQueMudariamResultado: string[];
  versaoRegras: {
    id: string;
    versao: string;
    dataPublicacao: string;
  };
  notasPorSubcategoria: {
    codigo: string;
    nomePortugues: string;
    notaBase: number;
    ajustes: number;
    notaFinal: number;
    motivo: string;
  }[];
  explicacaoCliente: string[];
  explicacaoConsultor: string[];
  regrasAcionadas: string[];
  fontesLegais: LegalSource[];
  avisoOrientativo: string;
}

export interface EngineOptions {
  ruleVersion?: DiagnosticRuleVersion | null;
  custosPadrao?: CustosPadrao | null;
  honorariosMinBrl?: number;
  honorariosMaxBrl?: number;
  taxaCambioBrlClp?: number;
  taxaCambioUsdBrl?: number;
}

export const TURISTA_EXIT_ALERT =
  'ELEGÍVEL — Requer saída do Chile para protocolar do exterior (não permitido solicitar como turista de dentro do Chile)';

export interface AdaptiveWizardMeta {
  visiveisPorEtapa: Record<number, string[]>;
  totalVisiveis: number;
  respondidas: number;
  faltamPerguntas: number;
  tempoEstimadoMinutos: number;
  percentualProgresso: number;
}

export function getAdaptiveWizardMeta(answers: DiagnosticAnswers): AdaptiveWizardMeta {
  const step1 = ['nome', 'whatsapp', 'email', 'cidadeUf', 'origem'];

  const step2 = ['localizacao', 'faixaEtaria'];
  if (answers.localizacao === 'No Chile com residência') {
    step2.push('mesesResidenciaChile');
  }
  if (answers.localizacao === 'No Brasil' || answers.localizacao === 'Em outro país') {
    step2.push('entradaRecenteChileTurista');
  }
  step2.push('nacionalidadeBrasileira', 'possuiSegundaNacionalidade');
  if (isYes(answers.possuiSegundaNacionalidade)) {
    step2.push('segundaNacionalidadeQual');
  }
  step2.push('passaporteStatus');
  if (answers.passaporteStatus !== 'nao_possui') {
    step2.push('passaporteValidadeMeses');
  }

  const step3 = ['vinculoFamiliarChile'];
  if (isYes(answers.vinculoFamiliarChile)) {
    step3.push('vinculoTipo', 'vinculoFormalizado');
  }

  const step4 = ['objetivo'];
  if (answers.objetivo === 'trabalho_formal' || answers.objetivo === 'servicos_90d') {
    step4.push('possuiOfertaTrabalhoFormal');
  } else if (answers.objetivo === 'estudar') {
    step4.push('possuiMatriculaReconhecida');
  } else if (answers.objetivo === 'aposentado_renda') {
    step4.push('possuiRendaPassiva', 'faixaRendaMensalUsd');
  } else if (answers.objetivo === 'empreender_investir') {
    step4.push('possuiCapitalComprovadoOrigem');
  } else if (answers.objetivo === 'dependente_titular') {
    step4.push('titularTemResidenciaChile');
  }

  const step5 = ['overstay', 'ordenAbandono', 'rejeicaoAnterior', 'antecedentesCriminais'];

  const step6 = ['familiaAcompanhante'];
  if (isYes(answers.familiaAcompanhante)) {
    step6.push('composicaoFamiliar', 'quantidadeDependentes');
  }
  step6.push('prazoPretendido', 'documentosJaPossui', 'lgpdAceito');

  const visiveisPorEtapa: Record<number, string[]> = {
    1: step1,
    2: step2,
    3: step3,
    4: step4,
    5: step5,
    6: step6,
  };

  const allVisible = [...step1, ...step2, ...step3, ...step4, ...step5, ...step6];
  const consultaSet = new Set(answers.riscoConsultaConsultor || []);

  const isAnswered = (field: string): boolean => {
    if (
      (field === 'overstay' ||
        field === 'ordenAbandono' ||
        field === 'rejeicaoAnterior' ||
        field === 'antecedentesCriminais') &&
      consultaSet.has(field as RiskFieldKey)
    ) {
      return true;
    }
    const val = (answers as unknown as Record<string, unknown>)[field];
    if (field === 'documentosJaPossui') {
      return Array.isArray(val) && val.length > 0;
    }
    if (field === 'lgpdAceito') {
      return val === true;
    }
    if (typeof val === 'boolean') return true;
    if (typeof val === 'number') return !Number.isNaN(val);
    if (typeof val === 'string') return val.trim().length > 0;
    return false;
  };

  const respondidas = allVisible.filter(isAnswered).length;
  const totalVisiveis = allVisible.length;
  const faltamPerguntas = Math.max(0, totalVisiveis - respondidas);
  const tempoEstimadoMinutos = faltamPerguntas === 0 ? 0 : Math.max(1, Math.ceil(faltamPerguntas * 0.2));
  const percentualProgresso = totalVisiveis > 0 ? Math.round((respondidas / totalVisiveis) * 100) : 0;

  return {
    visiveisPorEtapa,
    totalVisiveis,
    respondidas,
    faltamPerguntas,
    tempoEstimadoMinutos,
    percentualProgresso,
  };
}

function findRule(rules: DiagnosticRuleItem[], condicao: DiagnosticRuleItem['condicao']): DiagnosticRuleItem | undefined {
  return rules.find((r) => r.condicao === condicao && r.ativa);
}

export function detectDiagnosticContradictions(answers: DiagnosticAnswers): ContradictionItem[] {
  const list: ContradictionItem[] = [];

  if (answers.localizacao === 'No Brasil' && isYes(answers.entradaRecenteChileTurista)) {
    list.push({
      codigo: 'CONT-LOC-TUR',
      titulo: 'Localização no Brasil vs. entrada recente como turista',
      descricao:
        'Você informou estar no Brasil neste momento, mas também sinalizou entrada recente no Chile como turista sem registro de saída.',
      perguntaEsclarecimento: 'Você já retornou fisicamente ao Brasil ou ainda se encontra em território chileno?',
    });
  }

  if (
    (answers.faixaEtaria === 'menor_18_com_pais' || answers.faixaEtaria === 'menor_18_desacompanhado') &&
    (answers.objetivo === 'aposentado_renda' || answers.objetivo === 'trabalho_formal')
  ) {
    list.push({
      codigo: 'CONT-IDADE-OBJ',
      titulo: 'Menor de idade com objetivo laboral ou aposentadoria',
      descricao:
        'Perfis menores de 18 anos normalmente solicitam residência vinculada aos pais/responsáveis ou por estudos, não por aposentadoria.',
      perguntaEsclarecimento: 'O solicitante é o menor de idade acompanhando os pais ou você está preenchendo para um adulto?',
    });
  }

  if (answers.localizacao === 'No Chile com residência' && answers.passaporteStatus === 'nao_possui') {
    list.push({
      codigo: 'CONT-RES-PAS',
      titulo: 'Residente no Chile sem passaporte',
      descricao: 'Para tramitar prorrogação ou Residência Definitiva no SERMIG é indispensável documento de viagem vigente.',
      perguntaEsclarecimento: 'Seu passaporte venceu recentemente ou você ingressou apenas com RG e precisa emitir passaporte?',
    });
  }

  if (isYes(answers.vinculoFormalizado) && answers.vinculoFamiliarChile === false) {
    list.push({
      codigo: 'CONT-VINC-INC',
      titulo: 'Vínculo marcado como formalizado, porém sem vínculo familiar no Chile',
      descricao: 'Você assinalou vínculo formalizado, mas indicou não possuir familiar chileno ou residente definitivo.',
      perguntaEsclarecimento: 'O familiar com quem possui vínculo reside no Chile com Cédula ou Residência Definitiva?',
    });
  }

  if (answers.passaporteStatus === 'vencido' && (answers.passaporteValidadeMeses ?? 0) >= 12) {
    list.push({
      codigo: 'CONT-PAS-VAL',
      titulo: 'Passaporte vencido vs. validade informada >= 12 meses',
      descricao: 'O status do passaporte está marcado como vencido, mas os meses de validade estão preenchidos acima de 12.',
      perguntaEsclarecimento: 'O passaporte já foi renovado ou encontra-se vencido no momento?',
    });
  }

  return list;
}

export function runDiagnosticEngine(
  answers: DiagnosticAnswers,
  categoriesInput: VisaCategory[] = SEED_VISA_CATEGORIES,
  requirementsInput: VisaRequirement[] = SEED_VISA_REQUIREMENTS,
  legalSourcesInput: LegalSource[] = SEED_LEGAL_SOURCES,
  options?: EngineOptions,
): DiagnosticResult {
  const categories = categoriesInput.length > 0 ? categoriesInput : SEED_VISA_CATEGORIES;
  const requirements = requirementsInput.length > 0 ? requirementsInput : SEED_VISA_REQUIREMENTS;
  const legalSources = legalSourcesInput.length > 0 ? legalSourcesInput : SEED_LEGAL_SOURCES;
  const activeRulesVersion = options?.ruleVersion || DEFAULT_DIAGNOSTIC_RULE_VERSION;
  const rulesList = activeRulesVersion.regras || DEFAULT_DIAGNOSTIC_RULE_VERSION.regras;
  const custosPadrao = options?.custosPadrao || DEFAULT_EMPRESA_CONFIG.custosPadrao!;

  const findVisa = (codigo: string): VisaCategory => {
    return categories.find((c) => c.codigo === codigo) || SEED_VISA_CATEGORIES.find((c) => c.codigo === codigo)!;
  };

  const mercosulVisa = findVisa('15');
  const reunificacaoVisa = findVisa('01');
  const trabalhoVisa = findVisa('02');
  const estudanteVisa = findVisa('03');
  const temporadaVisa = findVisa('04');
  const humanitarioVisa = findVisa('07');
  const religiosoVisa = findVisa('09');
  const medicoVisa = findVisa('10');
  const aposentadoVisa = findVisa('11');
  const investidorVisa = findVisa('13');
  const dependenteVisa = findVisa('DEP');

  const ruleMetadata = {
    id: activeRulesVersion.id,
    versao: activeRulesVersion.versao,
    dataPublicacao: activeRulesVersion.dataPublicacao,
  };

  // Verificar se todas as respostas essenciais estão vazias (Perfil 29)
  const hasCoreInfo =
    answers.nacionalidadeBrasileira !== null ||
    Boolean(answers.objetivo) ||
    Boolean(answers.localizacao) ||
    isYes(answers.vinculoFamiliarChile);

  const custosConfig = {
    honorariosMinBrl: options?.honorariosMinBrl ?? activeRulesVersion.honorariosMinBrl ?? DEFAULT_EMPRESA_CONFIG.honorariosPadraoMinBrl ?? 2900,
    honorariosMaxBrl: options?.honorariosMaxBrl ?? activeRulesVersion.honorariosMaxBrl ?? DEFAULT_EMPRESA_CONFIG.honorariosPadraoMaxBrl ?? 5800,
    taxaCambioBrlClp: options?.taxaCambioBrlClp ?? activeRulesVersion.taxaCambioBrlClp ?? DEFAULT_EMPRESA_CONFIG.taxaCambioBrlClp ?? 165,
    taxaCambioUsdBrl: options?.taxaCambioUsdBrl ?? activeRulesVersion.taxaCambioUsdBrl ?? DEFAULT_EMPRESA_CONFIG.taxaCambioUsdBrl ?? 5.7,
  };

  const buildEmptyCosts = (): CostEstimateSummary => ({
    honorariosMinBrl: custosConfig.honorariosMinBrl,
    honorariosMaxBrl: custosConfig.honorariosMaxBrl,
    taxasOficiaisBrlMin: 0,
    taxasOficiaisBrlMax: 0,
    totalMinBrl: custosConfig.honorariosMinBrl,
    totalMaxBrl: custosConfig.honorariosMaxBrl,
    totalMinClp: Math.round(custosConfig.honorariosMinBrl * custosConfig.taxaCambioBrlClp),
    totalMaxClp: Math.round(custosConfig.honorariosMaxBrl * custosConfig.taxaCambioBrlClp),
    taxaCambioBrlClp: custosConfig.taxaCambioBrlClp,
    taxaCambioUsdBrl: custosConfig.taxaCambioUsdBrl,
    avisoEstimativa: 'Estimativa — confirmar na fonte oficial (SERMIG, CNJ e Registro Civil).',
    itensDetalhados: [],
  });

  if (!hasCoreInfo) {
    return {
      dadosInsuficientes: true,
      mensagemDadosInsuficientes:
        'Dados insuficientes para gerar uma recomendação migratória. Informe ao menos sua nacionalidade, localização atual e objetivo no Chile.',
      recomendada: null,
      top3: [],
      comparativoMercosul: {
        principal: null,
        mercosul: {
          visa: mercosulVisa,
          nota: 0,
          notaBase: 0,
          ajustesAplicados: [],
          motivo: 'Aguardando confirmação de nacionalidade.',
          caminho: 'A definir após preenchimento mínimo.',
          alertas: [],
        },
        terceiraOpcao: null,
        diferencasChave: [],
        linhasFixas: [],
      },
      descartadas: [],
      alertas: ['Preencha nacionalidade, localização atual e objetivo principal para receber uma indicação personalizada.'],
      alertaRiscoAlto: null,
      flagsRisco: [],
      flagsRevisaoConsultor: [],
      caminho: 'Aguardando preenchimento dos dados mínimos.',
      situacaoResidenciaAtual: null,
      perguntasComplementares: [
        'Qual é a sua nacionalidade e onde você se encontra atualmente?',
        'Qual o seu principal objetivo de residência no Chile?',
      ],
      preChecklist: [],
      checklistProntidao: { itens: [], percentualInicial: 0, semaforo: 'Vermelho' },
      planoAcao: { facaAgora: [], em30Dias: [], antesProtocolo: [] },
      custosEstimados: buildEmptyCosts(),
      cronogramaFaixas: {
        preparacaoDocumental: 'A definir após enquadramento',
        protocoloSermig: 'A definir',
        respostaSermig: '3 a 8 meses (referência legal SERMIG até 180 dias)',
        observacaoLegal: 'Estimativa referencial sem garantia de data ou aprovação pelo SERMIG.',
      },
      diagnosticoPorPessoa: [],
      viabilidade: { dimensoes: [], total: 0, veredito: 'Inviável no momento' },
      confianca: 'Baixa',
      fatoresConfianca: ['Todas as respostas essenciais estão vazias.'],
      contradicoes: [],
      informacoesQueMudariamResultado: [
        'Informar nacionalidade brasileira ou outra cidadania',
        'Informar localização atual (Brasil, Chile como turista ou residente)',
        'Informar objetivo principal no Chile',
      ],
      versaoRegras: ruleMetadata,
      notasPorSubcategoria: [],
      explicacaoCliente: ['Precisamos de algumas respostas básicas antes de apontar qual visto combina com seu perfil.'],
      explicacaoConsultor: ['Diagnóstico bloqueado por ausência de parâmetros mínimos (nacionalidade, localização, objetivo).'],
      regrasAcionadas: [],
      fontesLegais: legalSources.slice(0, 3),
      avisoOrientativo: 'Pré-análise orientativa. Não é parecer jurídico nem garantia de aprovação pelo SERMIG.',
    };
  }

  const isBrasileiro = isYes(answers.nacionalidadeBrasileira);
  const isTuristaChile = answers.localizacao === 'No Chile como turista';
  const isNoBrasil = answers.localizacao === 'No Brasil';
  const isResidenteChile = answers.localizacao === 'No Chile com residência';
  const vinculoFormalizado = isYes(answers.vinculoFamiliarChile) && isYes(answers.vinculoFormalizado);
  const isHumanitario = answers.objetivo === 'humanitario';
  const passaporteVencido =
    answers.passaporteStatus === 'vencido' ||
    answers.passaporteStatus === 'nao_possui' ||
    (answers.passaporteValidadeMeses ?? 0) <= 0;
  const passaporteCurto = !passaporteVencido && (answers.passaporteValidadeMeses ?? 0) < 12;

  const isMenorAcompanhado = answers.faixaEtaria === 'menor_18_com_pais';
  const isMenorDesacompanhado = answers.faixaEtaria === 'menor_18_desacompanhado';

  const alertas: string[] = [];
  const regrasAcionadas: string[] = [];
  const explicacaoCliente: string[] = [];
  const explicacaoConsultor: string[] = [];
  const informacoesQueMudariamResultado: string[] = [];
  const discarded: DiagnosticDiscarded[] = [];
  const candidatos: DiagnosticCandidate[] = [];

  // 1. Avaliar Flags de Risco independentes (null ou "Prefiro falar com consultor" NUNCA contam como Sim)
  const flagsRisco: RiskFlagDetail[] = [];
  const riskLabels: Record<RiskFieldKey, string> = {
    overstay: 'Permanência irregular / excesso de prazo (Overstay) no Chile',
    ordenAbandono: 'Notificação ou Orden de Abandono vigente/anterior',
    rejeicaoAnterior: 'Rejeição anterior de visto ou residência pelo SERMIG',
    antecedentesCriminais: 'Ocorrências em antecedentes criminais no Brasil, Chile ou outro país',
  };

  if (isYes(answers.overstay)) {
    flagsRisco.push({
      campo: 'overstay',
      pergunta: riskLabels.overstay,
      severidade: 'Alta',
      orientacao: 'Necessária regularização prévia ou cálculo de multa migratória junto ao SERMIG/PDI antes do novo protocolo.',
    });
  }
  if (isYes(answers.ordenAbandono)) {
    flagsRisco.push({
      campo: 'ordenAbandono',
      pergunta: riskLabels.ordenAbandono,
      severidade: 'Alta',
      orientacao: 'Exige análise jurídica individualizada para verificar vigência, recurso administrativo ou proibição de ingresso.',
    });
  }
  if (isYes(answers.rejeicaoAnterior)) {
    flagsRisco.push({
      campo: 'rejeicaoAnterior',
      pergunta: riskLabels.rejeicaoAnterior,
      severidade: 'Alta',
      orientacao: 'Avaliar resolução de indeferimento anterior, prazo de Descargos/recurso e correção do motivo originário.',
    });
  }
  if (isYes(answers.antecedentesCriminais)) {
    flagsRisco.push({
      campo: 'antecedentesCriminais',
      pergunta: riskLabels.antecedentesCriminais,
      severidade: 'Alta',
      orientacao: 'O Acordo Mercosul e a Ley 21.325 exigem idoneidade e certidões negativas; verificar certidão explicativa/reabilitação.',
    });
  }

  // Flags neutras de "Prefiro falar com o consultor" (NÃO acionam Risco Alto)
  const flagsRevisaoConsultor: { campo: RiskFieldKey; label: string }[] = (answers.riscoConsultaConsultor || []).map((campo) => ({
    campo,
    label: `Revisar com o consultor: ${riskLabels[campo]}`,
  }));

  if (flagsRevisaoConsultor.length > 0) {
    regrasAcionadas.push(
      `Opção "Prefiro falar com o consultor" marcada em ${flagsRevisaoConsultor.length} tópico(s): revisão reservada agendada sem disparo de risco alto automático.`,
    );
    explicacaoConsultor.push(
      `[Sigilo Etapa 5] Cliente solicitou tratar em reunião: ${flagsRevisaoConsultor.map((f) => f.campo).join(', ')}.`,
    );
    explicacaoCliente.push('Alguns tópicos sensíveis ficaram reservados para conversa sigilosa com o consultor.');
  }

  const alertaRiscoAlto =
    flagsRisco.length > 0
      ? `Risco Alto — Revisão Obrigatória do Consultor (gerado por: ${flagsRisco.map((f) => f.pergunta).join('; ')})`
      : null;

  const riskRule = findRule(rulesList, 'risco_explicito');
  const riskPenaltyPerFlag = Math.abs(riskRule?.ajusteNota ?? 14);

  if (alertaRiscoAlto) {
    alertas.push(alertaRiscoAlto);
    regrasAcionadas.push(
      riskRule?.explicacaoTecnica || 'Risco Alto acionado por resposta positiva explícita no histórico migratório/penal.',
    );
    explicacaoConsultor.push(`[REG-RISK] Penalização aplicada por ${flagsRisco.length} flag(s) explícita(s).`);
    explicacaoCliente.push(
      riskRule?.explicacaoCliente ||
        'Identificamos um ponto sensível no histórico que exige checagem detalhada do consultor antes do protocolo.',
    );
  }

  const rulePassVencido = findRule(rulesList, 'passaporte_vencido');
  const rulePassCurto = findRule(rulesList, 'passaporte_curto');

  if (passaporteVencido && !isResidenteChile) {
    alertas.push(
      'Passaporte vencido ou ausente: providencie a emissão ou renovação na Polícia Federal antes do protocolo eletrônico.',
    );
    regrasAcionadas.push(rulePassVencido?.explicacaoTecnica || 'Passaporte vencido/ausente impede protocolo regular do exterior.');
    explicacaoCliente.push(
      rulePassVencido?.explicacaoCliente || 'É necessário renovar ou emitir seu passaporte antes de enviar o pedido ao SERMIG.',
    );
    informacoesQueMudariamResultado.push('Renovar ou emitir passaporte brasileiro com validade superior a 12 meses.');
  } else if (passaporteVencido && isResidenteChile) {
    alertas.push(
      'Passaporte vencido ou ausente: regularize o documento de viagem brasileiro junto ao Consulado para evitar pendências no SERMIG.',
    );
    regrasAcionadas.push('Residente no Chile com passaporte vencido/ausente alertado para atualização documental.');
  } else if (passaporteCurto) {
    alertas.push(
      'Passaporte com validade inferior a 12 meses: reduz a pontuação para pedidos feitos do exterior e pode exigir renovação prévia.',
    );
    regrasAcionadas.push(
      rulePassCurto?.explicacaoTecnica || 'Regra de vigência de passaporte: validade < 12 meses penaliza pedidos protocolados do exterior.',
    );
    explicacaoCliente.push(
      rulePassCurto?.explicacaoCliente || 'Seu passaporte vence em menos de 1 ano; recomendamos renovar antes de protocolar.',
    );
    informacoesQueMudariamResultado.push('Passaporte com 12+ meses de validade aumenta a pontuação de prontidão.');
  }

  // Situação para quem já é residente no Chile (Perfis 24 e 25)
  let situacaoResidenciaAtual: DiagnosticResult['situacaoResidenciaAtual'] = null;
  if (isResidenteChile) {
    const meses = answers.mesesResidenciaChile ?? 0;
    if (meses >= 24) {
      situacaoResidenciaAtual = 'Residência Definitiva em análise';
      const ruleDef = findRule(rulesList, 'residente_definitiva');
      alertas.push(
        'Residência Definitiva em análise: você informou 24+ meses de residência no Chile — verificar histórico de ausências e subcategoria atual.',
      );
      regrasAcionadas.push(
        ruleDef?.explicacaoTecnica ||
          'Residente com 24+ meses no Chile habilitado à análise de transição para Residência Definitiva.',
      );
      explicacaoCliente.push(
        ruleDef?.explicacaoCliente ||
          'Com 24 meses ou mais de residência no Chile, avaliamos diretamente seu pedido de Residência Definitiva.',
      );
    } else {
      situacaoResidenciaAtual = 'Prorrogação';
      const rulePror = findRule(rulesList, 'residente_prorrogacao');
      alertas.push(
        'Residente atual (< 24 meses): avaliamos Prorrogação de Residência Temporal (janela de 90 a 10 dias antes do vencimento) ou mudança de subcategoria.',
      );
      regrasAcionadas.push(
        rulePror?.explicacaoTecnica || 'Residente no Chile com < 24 meses direcionado para análise de Prorrogação ou mudança de subcategoria.',
      );
      explicacaoCliente.push(
        rulePror?.explicacaoCliente ||
          'Como você já reside no Chile há menos de 2 anos, estruturamos sua Prorrogação dentro da janela legal.',
      );
    }
  }

  // Menor de idade acompanhado dos pais (Perfil 16)
  if (isMenorAcompanhado) {
    const ruleMenor = findRule(rulesList, 'menor_acompanhado');
    alertas.push(
      'Menor de 18 anos acompanhado dos pais: exige certidão de nascimento em 2ª via apostilada e autorização bilateral caso apenas um genitor protocole.',
    );
    regrasAcionadas.push(
      ruleMenor?.explicacaoTecnica || 'Perfil menor acompanhado dos pais: incluída conferência de poder familiar e certidão apostilada.',
    );
    explicacaoCliente.push(
      ruleMenor?.explicacaoCliente ||
        'Para menores de 18 anos acompanhados dos pais, garantimos o checklist de certidão apostilada e autorizações.',
    );
  } else if (isMenorDesacompanhado) {
    alertas.push('Menor de 18 anos desacompanhado: requer autorização judicial/notarial expressa e responsável legal no Chile.');
    regrasAcionadas.push('Menor desacompanhado requer tutela/autorização específica.');
  }

  // 2. Regra de Turista no Chile sem vínculo formalizado nem razão humanitária
  const exigeSaidaTurista = isTuristaChile && !vinculoFormalizado && !isHumanitario;
  const ruleTurista = findRule(rulesList, 'turista_sem_vinculo');
  if (exigeSaidaTurista) {
    alertas.push(TURISTA_EXIT_ALERT);
    regrasAcionadas.push(
      ruleTurista?.explicacaoTecnica ||
        'Turista no Chile sem vínculo familiar formalizado nem razão humanitária: Ley 21.325 proíbe mudança de permanência transitória para residência de dentro do Chile.',
    );
    explicacaoCliente.push(
      ruleTurista?.explicacaoCliente || 'Por estar como turista sem vínculo formalizado, o pedido eletrônico deve ser enviado fora do Chile.',
    );
  }

  // 3. Regra Mercosul (cód. 15) — SEMPRE elegível para brasileiros
  const ruleMercosul = findRule(rulesList, 'brasileiro_mercosul');
  if (isBrasileiro) {
    const baseMercosul = ruleMercosul?.notaBase ?? 95;
    let notaMercosul = baseMercosul + (ruleMercosul?.ajusteNota ?? 0);
    const ajustesMercosul: DiagnosticCandidate['ajustesAplicados'] = [];

    if (!isNoBrasil || passaporteCurto || passaporteVencido || flagsRisco.length > 0) {
      if (isNoBrasil && !passaporteCurto && !passaporteVencido && flagsRisco.length === 0) {
        // full base
      } else {
        if (!isNoBrasil && baseMercosul === 95) {
          // Slight adjustment for non-Brazil location if default 95
          if (isTuristaChile && exigeSaidaTurista) {
            const deltaTur = ruleTurista?.ajusteNota ?? -10;
            notaMercosul += deltaTur;
            ajustesMercosul.push({ regraCodigo: 'REG-TUR', motivo: 'Saída do Chile necessária (turista)', delta: deltaTur });
          }
        }
        if (passaporteVencido && !isResidenteChile) {
          const deltaPass = rulePassVencido?.ajusteNota ?? -22;
          notaMercosul += deltaPass;
          ajustesMercosul.push({ regraCodigo: 'REG-PAS-0', motivo: 'Passaporte vencido/ausente', delta: deltaPass });
        } else if (passaporteCurto) {
          const deltaPass = rulePassCurto?.ajusteNota ?? -12;
          notaMercosul += deltaPass;
          ajustesMercosul.push({ regraCodigo: 'REG-PAS-12', motivo: 'Passaporte < 12 meses', delta: deltaPass });
        }
        if (flagsRisco.length > 0) {
          const deltaRisk = -Math.min(30, flagsRisco.length * riskPenaltyPerFlag);
          notaMercosul += deltaRisk;
          ajustesMercosul.push({ regraCodigo: 'REG-RISK', motivo: `${flagsRisco.length} flag(s) explícita(s) de risco`, delta: deltaRisk });
        }
      }
    }

    if (isYes(answers.possuiSegundaNacionalidade)) {
      regrasAcionadas.push('Brasileiro com segunda nacionalidade mantém elegibilidade integral ao Acordo Mercosul (cód. 15).');
    } else {
      regrasAcionadas.push(
        ruleMercosul?.explicacaoTecnica || 'Nacionalidade brasileira confirmada: Subcategoria 15 (Reciprocidade Internacional/Mercosul) sempre elegível.',
      );
    }
    explicacaoCliente.push(
      ruleMercosul?.explicacaoCliente ||
        'Como brasileiro(a), você conta com o Acordo Mercosul, que permite morar e trabalhar no Chile sem contrato prévio.',
    );

    const caminhoMercosul = isTuristaChile
      ? 'Saída do Chile para protocolo eletrônico do exterior (Brasil ou terceiro país), com Estampado Electrónico após aprovação.'
      : isResidenteChile
        ? situacaoResidenciaAtual === 'Residência Definitiva em análise'
          ? 'Análise de transição para Residência Definitiva diretamente no portal SERMIG (com verificação de ausências e antecedentes).'
          : 'Avaliar Prorrogação ou Mudança de Subcategoria diretamente de dentro do Chile (janela 90 a 10 dias antes do vencimento).'
        : 'Protocolo eletrônico a partir do Brasil (exterior) no portal SERMIG, seguido de entrada em até 90 dias após o Estampado.';

    candidatos.push({
      visa: mercosulVisa,
      nota: Math.max(25, Math.min(100, notaMercosul)),
      notaBase: baseMercosul,
      ajustesAplicados: ajustesMercosul,
      motivo:
        'Permite trabalhar licitamente no Chile, leva à Residência Definitiva em 24 meses e não exige contrato prévio nem renda mínima.',
      caminho: caminhoMercosul,
      alertas: exigeSaidaTurista ? [TURISTA_EXIT_ALERT] : [],
    });
  } else {
    discarded.push({
      codigo: '15',
      nomePortugues: mercosulVisa.nomePortugues,
      motivo: 'Aplicável a nacionais brasileiros ou de Estados Partes/Associados do Acordo Mercosul.',
    });
    informacoesQueMudariamResultado.push('Possuir nacionalidade brasileira ou de Estado Parte/Associado do Mercosul habilitaria o Cód. 15.');
  }

  // 4. Reunificação Familiar (cód. 01) — SÓ ativa se vínculo estiver formalizado
  const ruleReunif = findRule(rulesList, 'vinculo_formalizado');
  const ruleNaoForm = findRule(rulesList, 'vinculo_nao_formalizado');
  if (vinculoFormalizado) {
    const base01 = ruleReunif?.notaBase ?? 94;
    let nota01 = base01 + (ruleReunif?.ajusteNota ?? 0);
    const ajustes01: DiagnosticCandidate['ajustesAplicados'] = [];
    if (flagsRisco.length > 0) {
      const delta = -Math.min(25, flagsRisco.length * Math.max(10, riskPenaltyPerFlag - 2));
      nota01 += delta;
      ajustes01.push({ regraCodigo: 'REG-RISK', motivo: 'Risco explícito', delta });
    }
    regrasAcionadas.push(
      ruleReunif?.explicacaoTecnica ||
        'Vínculo familiar no Chile formalizado: Subcategoria 01 (Reunificação Familiar) permite solicitação inclusive de dentro do Chile.',
    );
    explicacaoCliente.push(
      ruleReunif?.explicacaoCliente ||
        'Com o vínculo familiar formalizado, a Reunificação Familiar pode ser solicitada inclusive de dentro do Chile.',
    );
    candidatos.push({
      visa: reunificacaoVisa,
      nota: Math.max(30, Math.min(100, nota01)),
      notaBase: base01,
      ajustesAplicados: ajustes01,
      motivo:
        'Vínculo familiar formalizado habilita protocolo inclusive de dentro do Chile, com caminho acelerado à Residência Definitiva.',
      caminho:
        isTuristaChile || isResidenteChile
          ? 'Protocolo permitido diretamente de dentro do Chile mediante comprovação apostilada/registrada do vínculo.'
          : 'Protocolo do Brasil ou de dentro do Chile mediante certidões atualizadas do vínculo.',
      alertas: [],
    });
  } else {
    const temVinculoNaoFormalizado = isYes(answers.vinculoFamiliarChile);
    if (temVinculoNaoFormalizado) {
      alertas.push(
        'Vínculo familiar informado ainda não formalizado: a Reunificação Familiar (Cód. 01) não foi ativada. Sugerimos formalizar o casamento ou Acuerdo de Unión Civil.',
      );
      regrasAcionadas.push(
        ruleNaoForm?.explicacaoTecnica ||
          'Vínculo familiar não formalizado: Cód. 01 não ativado; recomendada formalização jurídica do vínculo.',
      );
      explicacaoCliente.push(
        ruleNaoForm?.explicacaoCliente ||
          'Como a união ainda não está formalizada no papel, recomendamos formalizá-la para destravar a Reunificação Familiar.',
      );
      informacoesQueMudariamResultado.push('Formalizar casamento ou Acuerdo de Unión Civil ativa a Reunificação Familiar (Cód. 01) e evita saída do Chile.');
    }
    discarded.push({
      codigo: '01',
      nomePortugues: reunificacaoVisa.nomePortugues,
      motivo: temVinculoNaoFormalizado
        ? 'Vínculo familiar ainda não formalizado juridicamente (formalizar casamento/união civil antes do protocolo).'
        : 'Não possui vínculo familiar direto formalizado com chileno ou residente definitivo.',
    });
  }

  // 5. Atividades Lícitas Remuneradas (cód. 02)
  const ruleTrab = findRule(rulesList, 'trabalho_formal');
  if (
    answers.objetivo === 'trabalho_formal' ||
    answers.objetivo === 'servicos_90d' ||
    isYes(answers.possuiOfertaTrabalhoFormal)
  ) {
    const base02 = isYes(answers.possuiOfertaTrabalhoFormal) ? (ruleTrab?.notaBase ?? 88) : 74;
    let nota02 = base02;
    const ajustes02: DiagnosticCandidate['ajustesAplicados'] = [];
    if (passaporteVencido && !isResidenteChile) {
      nota02 -= 18;
      ajustes02.push({ regraCodigo: 'REG-PAS-0', motivo: 'Passaporte vencido/ausente', delta: -18 });
    } else if (passaporteCurto && !isResidenteChile) {
      nota02 -= 10;
      ajustes02.push({ regraCodigo: 'REG-PAS-12', motivo: 'Passaporte < 12 meses', delta: -10 });
    }
    if (exigeSaidaTurista) {
      nota02 -= 10;
      ajustes02.push({ regraCodigo: 'REG-TUR', motivo: 'Saída do Chile necessária', delta: -10 });
    }
    if (flagsRisco.length > 0) {
      const delta = -Math.min(25, flagsRisco.length * 12);
      nota02 += delta;
      ajustes02.push({ regraCodigo: 'REG-RISK', motivo: 'Risco explícito', delta });
    }
    if (!isYes(answers.possuiOfertaTrabalhoFormal)) {
      informacoesQueMudariamResultado.push('Assinar contrato de trabalho notariado no Chile fortalece a Subcategoria 02.');
    }
    regrasAcionadas.push(
      ruleTrab?.explicacaoTecnica || 'Objetivo profissional com contrato/serviços > 90 dias acionou Subcategoria 02 (Atividades Lícitas Remuneradas).',
    );
    candidatos.push({
      visa: trabalhoVisa,
      nota: Math.max(25, Math.min(100, nota02)),
      notaBase: base02,
      ajustesAplicados: ajustes02,
      motivo: 'Indicada quando há contrato de trabalho notariado no Chile ou prestação formal de serviços.',
      caminho: isTuristaChile
        ? 'Requer protocolo do exterior após assinatura do contrato em Notaría no Chile.'
        : 'Protocolo do exterior com contrato de trabalho formal chileno.',
      alertas: exigeSaidaTurista ? [TURISTA_EXIT_ALERT] : [],
    });
  } else {
    discarded.push({
      codigo: '02',
      nomePortugues: trabalhoVisa.nomePortugues,
      motivo: 'Não informou oferta formal de emprego chileno ou contrato de serviços > 90 dias.',
    });
  }

  // 6. Aposentados e Rentistas (cód. 11)
  const ruleApos = findRule(rulesList, 'aposentado_renda');
  if (answers.objetivo === 'aposentado_renda' || isYes(answers.possuiRendaPassiva)) {
    let base11 = ruleApos?.notaBase ?? 83;
    if (answers.faixaRendaMensalUsd === 'acima_2500') base11 = (ruleApos?.notaBase ?? 83) + (ruleApos?.ajusteNota ?? 6);
    else if (answers.faixaRendaMensalUsd === 'abaixo_1000') base11 = 65;

    let nota11 = base11;
    const ajustes11: DiagnosticCandidate['ajustesAplicados'] = [];
    if (passaporteCurto && !isResidenteChile) {
      nota11 -= 10;
      ajustes11.push({ regraCodigo: 'REG-PAS-12', motivo: 'Passaporte < 12 meses', delta: -10 });
    }
    if (exigeSaidaTurista) {
      nota11 -= 8;
      ajustes11.push({ regraCodigo: 'REG-TUR', motivo: 'Saída do Chile necessária', delta: -8 });
    }
    if (flagsRisco.length > 0) {
      const delta = -Math.min(25, flagsRisco.length * 12);
      nota11 += delta;
      ajustes11.push({ regraCodigo: 'REG-RISK', motivo: 'Risco explícito', delta });
    }
    regrasAcionadas.push(
      `Renda passiva/aposentadoria informada (faixa ${answers.faixaRendaMensalUsd || 'padrão'}) acionou Subcategoria 11 (Aposentados e Rentistas).`,
    );
    candidatos.push({
      visa: aposentadoVisa,
      nota: Math.max(25, Math.min(100, nota11)),
      notaBase: base11,
      ajustesAplicados: ajustes11,
      motivo: 'Enquadramento voltado a aposentados e rentistas com renda recorrente comprovável.',
      caminho: 'Protocolo a partir do exterior com comprovantes de renda apostilados e traduzidos.',
      alertas: exigeSaidaTurista ? [TURISTA_EXIT_ALERT] : [],
    });
  } else {
    discarded.push({
      codigo: '11',
      nomePortugues: aposentadoVisa.nomePortugues,
      motivo: 'Sem indicação de aposentadoria ou renda passiva recorrente como base principal.',
    });
  }

  // 7. Estudantes (cód. 03) — Perfil 26: estudante SEM matrícula NÃO ativa Cód. 03!
  const ruleEst = findRule(rulesList, 'estudar_com_matricula');
  if (isYes(answers.possuiMatriculaReconhecida)) {
    const base03 = ruleEst?.notaBase ?? 88;
    let nota03 = base03 + (ruleEst?.ajusteNota ?? 0);
    const ajustes03: DiagnosticCandidate['ajustesAplicados'] = [];
    if (passaporteCurto && !isResidenteChile) {
      nota03 -= 10;
      ajustes03.push({ regraCodigo: 'REG-PAS-12', motivo: 'Passaporte < 12 meses', delta: -10 });
    }
    if (flagsRisco.length > 0) {
      const delta = -Math.min(25, flagsRisco.length * 12);
      nota03 += delta;
      ajustes03.push({ regraCodigo: 'REG-RISK', motivo: 'Risco explícito', delta });
    }
    regrasAcionadas.push(
      ruleEst?.explicacaoTecnica || 'Matrícula em instituição chilena reconhecida acionou Subcategoria 03 (Estudantes).',
    );
    candidatos.push({
      visa: estudanteVisa,
      nota: Math.max(25, Math.min(100, nota03)),
      notaBase: base03,
      ajustesAplicados: ajustes03,
      motivo: 'Adequada para graduação, pós-graduação e cursos em instituições reconhecidas pelo Estado chileno.',
      caminho: 'Protocolo do exterior mediante certificado de matrícula oficial e solvência.',
      alertas: exigeSaidaTurista ? [TURISTA_EXIT_ALERT] : [],
    });
  } else {
    if (answers.objetivo === 'estudar') {
      alertas.push(
        'Objetivo acadêmico sem matrícula confirmada: a Subcategoria 03 (Estudantes) exige carta de aceitação ou matrícula oficial em instituição reconhecida no Chile.',
      );
      regrasAcionadas.push('Objetivo estudar sem matrícula reconhecida: Subcategoria 03 não ativada.');
      informacoesQueMudariamResultado.push('Obter carta de aceitação/matrícula em instituição chilena reconhecida habilita a Subcategoria 03.');
    }
    discarded.push({
      codigo: '03',
      nomePortugues: estudanteVisa.nomePortugues,
      motivo:
        answers.objetivo === 'estudar'
          ? 'Exige matrícula ou carta de aceitação em instituição de ensino reconhecida pelo Estado chileno.'
          : 'Objetivo não envolve matrícula em instituição de ensino no Chile.',
    });
  }

  // 8. Investidores (cód. 13) — Perfil 27: investidor sem origem comprovada gera alerta explícito
  const ruleInv = findRule(rulesList, 'investidor_com_origem');
  if (isYes(answers.possuiCapitalComprovadoOrigem)) {
    const base13 = ruleInv?.notaBase ?? 88;
    let nota13 = base13 + (ruleInv?.ajusteNota ?? 0);
    const ajustes13: DiagnosticCandidate['ajustesAplicados'] = [];
    if (passaporteCurto && !isResidenteChile) {
      nota13 -= 10;
      ajustes13.push({ regraCodigo: 'REG-PAS-12', motivo: 'Passaporte < 12 meses', delta: -10 });
    }
    if (flagsRisco.length > 0) {
      const delta = -Math.min(25, flagsRisco.length * 12);
      nota13 += delta;
      ajustes13.push({ regraCodigo: 'REG-RISK', motivo: 'Risco explícito', delta });
    }
    regrasAcionadas.push(
      ruleInv?.explicacaoTecnica || 'Projeto de investimento com comprovação de origem acionou Subcategoria 13 (Investidores).',
    );
    candidatos.push({
      visa: investidorVisa,
      nota: Math.max(25, Math.min(100, nota13)),
      notaBase: base13,
      ajustesAplicados: ajustes13,
      motivo: 'Voltada a investidores com projeto econômico estruturado e origem lícita de capital.',
      caminho: 'Protocolo do exterior com dossiê patrimonial e plano de investimento.',
      alertas: exigeSaidaTurista ? [TURISTA_EXIT_ALERT] : [],
    });
  } else {
    if (answers.objetivo === 'empreender_investir') {
      alertas.push(
        'Investidor sem comprovação de origem lícita do capital: a Subcategoria 13 exige lastro financeiro e documentação fiscal/bancária da origem dos recursos.',
      );
      regrasAcionadas.push('Investidor sem origem lícita comprovada: gerado alerta e priorizada alternativa Mercosul quando aplicável.');
      informacoesQueMudariamResultado.push('Comprovar origem lícita do capital (IR, extratos, balanço) habilita a Subcategoria 13 (Investidores).');
    }
    discarded.push({
      codigo: '13',
      nomePortugues: investidorVisa.nomePortugues,
      motivo:
        answers.objetivo === 'empreender_investir'
          ? 'Sem comprovação de origem lícita do capital exigida para Investidores.'
          : 'Não informado investimento com comprovação de origem de capital.',
    });
  }

  // 9. Razões Humanitárias (cód. 07)
  const ruleHum = findRule(rulesList, 'humanitario');
  if (isHumanitario) {
    const base07 = ruleHum?.notaBase ?? 90;
    let nota07 = base07;
    const ajustes07: DiagnosticCandidate['ajustesAplicados'] = [];
    if (flagsRisco.length > 0) {
      const delta = -Math.min(20, flagsRisco.length * 10);
      nota07 += delta;
      ajustes07.push({ regraCodigo: 'REG-RISK', motivo: 'Risco explícito', delta });
    }
    regrasAcionadas.push(
      ruleHum?.explicacaoTecnica ||
        'Razões humanitárias selecionadas: Subcategoria 07 (permite solicitação de dentro do Chile sem alerta de saída turística).',
    );
    candidatos.push({
      visa: humanitarioVisa,
      nota: Math.max(35, Math.min(100, nota07)),
      notaBase: base07,
      ajustesAplicados: ajustes07,
      motivo: 'Hipótese excepcional prevista na Ley 21.325 que autoriza análise humanitária inclusive em território chileno.',
      caminho: 'Protocolo administrativo com fundamentação documental e técnica específica.',
      alertas: [],
    });
  } else {
    discarded.push({
      codigo: '07',
      nomePortugues: humanitarioVisa.nomePortugues,
      motivo: 'Situação informada não se enquadra em razões humanitárias.',
    });
  }

  // 10. Tratamento Médico (cód. 10)
  const ruleMed = findRule(rulesList, 'medico');
  if (answers.objetivo === 'tratamento_medico') {
    const base10 = ruleMed?.notaBase ?? 86;
    const nota10 = flagsRisco.length > 0 ? Math.max(30, base10 - 15) : base10;
    regrasAcionadas.push(ruleMed?.explicacaoTecnica || 'Tratamento médico selecionado: Subcategoria 10 acionada.');
    candidatos.push({
      visa: medicoVisa,
      nota: nota10,
      notaBase: base10,
      ajustesAplicados: flagsRisco.length > 0 ? [{ regraCodigo: 'REG-RISK', motivo: 'Risco explícito', delta: -15 }] : [],
      motivo: 'Destinada a tratamento médico continuado com certificação hospitalar chilena e cobertura de custos.',
      caminho: 'Protocolo com certificado clínico e comprovação de custeio.',
      alertas: [],
    });
  }

  // 11. Religioso (cód. 09)
  const ruleRel = findRule(rulesList, 'religioso');
  if (answers.objetivo === 'religioso') {
    const base09 = ruleRel?.notaBase ?? 85;
    const nota09 = passaporteCurto ? Math.max(30, base09 - 10) : base09;
    regrasAcionadas.push(ruleRel?.explicacaoTecnica || 'Atividade religiosa selecionada: Subcategoria 09 acionada.');
    candidatos.push({
      visa: religiosoVisa,
      nota: nota09,
      notaBase: base09,
      ajustesAplicados: passaporteCurto ? [{ regraCodigo: 'REG-PAS-12', motivo: 'Passaporte < 12m', delta: -10 }] : [],
      motivo: 'Para ministros e representantes vinculados a culto oficialmente reconhecido no Chile.',
      caminho: 'Protocolo do exterior com carta de respaldo da entidade religiosa.',
      alertas: exigeSaidaTurista ? [TURISTA_EXIT_ALERT] : [],
    });
  }

  // 12. Temporada (cód. 04)
  const ruleTemp = findRule(rulesList, 'temporada');
  if (answers.objetivo === 'temporada') {
    const base04 = ruleTemp?.notaBase ?? 82;
    const nota04 = passaporteCurto ? Math.max(30, base04 - 10) : base04;
    regrasAcionadas.push(ruleTemp?.explicacaoTecnica || 'Trabalho sazonal selecionado: Subcategoria 04 acionada.');
    candidatos.push({
      visa: temporadaVisa,
      nota: nota04,
      notaBase: base04,
      ajustesAplicados: passaporteCurto ? [{ regraCodigo: 'REG-PAS-12', motivo: 'Passaporte < 12m', delta: -10 }] : [],
      motivo: 'Adequada para contratos sazonais de curta duração.',
      caminho: 'Protocolo do exterior antes do início das atividades.',
      alertas: exigeSaidaTurista ? [TURISTA_EXIT_ALERT] : [],
    });
  }

  // 13. Dependente de Titular — SOMENTE se selecionado explicitamente
  const ruleDep = findRule(rulesList, 'dependente_titular');
  if (answers.objetivo === 'dependente_titular') {
    const baseDep = isYes(answers.titularTemResidenciaChile) ? (ruleDep?.notaBase ?? 89) : 76;
    const notaDep = flagsRisco.length > 0 ? Math.max(30, baseDep - 15) : baseDep;
    regrasAcionadas.push(ruleDep?.explicacaoTecnica || 'Dependente de titular selecionado explicitamente: fluxo DEP incluído.');
    candidatos.push({
      visa: dependenteVisa,
      nota: notaDep,
      notaBase: baseDep,
      ajustesAplicados: flagsRisco.length > 0 ? [{ regraCodigo: 'REG-RISK', motivo: 'Risco explícito', delta: -15 }] : [],
      motivo: 'Vínculo de dependência direta com titular de Residência Temporal ou solicitante simultâneo.',
      caminho: 'Protocolo vinculado ao processo do titular com certidão apostilada.',
      alertas: [],
    });
  }

  // Ordenação inteligente
  const objectivePriorityBonus: Record<string, string[]> = {
    trabalho_formal: ['15', '02'],
    servicos_90d: ['15', '02'],
    nomade_digital: ['15'],
    empreender_investir: ['15', '13'],
    estudar: ['03', '15'],
    aposentado_renda: ['11', '15'],
    tratamento_medico: ['10', '15'],
    religioso: ['09', '15'],
    humanitario: ['07'],
    temporada: ['04', '15'],
    dependente_titular: ['DEP', '01', '15'],
    explorar: ['15'],
  };

  const bonusCodes = objectivePriorityBonus[answers.objetivo] || ['15'];
  candidatos.sort((a, b) => {
    if (vinculoFormalizado && a.visa.codigo === '01' && isTuristaChile) return -1;
    if (vinculoFormalizado && b.visa.codigo === '01' && isTuristaChile) return 1;
    if (isHumanitario && a.visa.codigo === '07') return -1;
    if (isHumanitario && b.visa.codigo === '07') return 1;

    const aExact = bonusCodes[0] === a.visa.codigo ? 3 : 0;
    const bExact = bonusCodes[0] === b.visa.codigo ? 3 : 0;
    if (b.nota + bExact !== a.nota + aExact) {
      return b.nota + bExact - (a.nota + aExact);
    }
    return a.visa.codigo === '15' ? -1 : 1;
  });

  if (candidatos.length === 0) {
    candidatos.push({
      visa: trabalhoVisa,
      nota: 55,
      notaBase: 55,
      ajustesAplicados: [],
      motivo: 'Necessário enquadramento com oferta laboral, matrícula acadêmica, investimento com origem comprovada ou vínculo familiar.',
      caminho: 'Avaliação consultiva individual para definir o caminho mais sólido.',
      alertas: exigeSaidaTurista ? [TURISTA_EXIT_ALERT] : [],
    });
  }

  // Garantir que Mercosul (15) está SEMPRE no Top 3 para brasileiros
  let top3 = candidatos.slice(0, 3);
  if (isBrasileiro && !top3.some((c) => c.visa.codigo === '15')) {
    const mercosulCand = candidatos.find((c) => c.visa.codigo === '15');
    if (mercosulCand) {
      top3 = [top3[0], top3[1], mercosulCand].filter(Boolean);
    }
  }

  const recomendada = top3[0];
  const mercosulCand =
    candidatos.find((c) => c.visa.codigo === '15') ||
    ({
      visa: mercosulVisa,
      nota: 0,
      notaBase: 0,
      ajustesAplicados: [],
      motivo: 'Não aplicável para não-brasileiros sem cidadania Mercosul.',
      caminho: 'Não aplicável',
      alertas: [],
    } as DiagnosticCandidate);

  // Terceira opção para comparativo lado a lado reforçado
  const terceiraOpcao =
    top3.find((c) => c.visa.codigo !== recomendada.visa.codigo && c.visa.codigo !== '15') ||
    candidatos.find((c) => c.visa.codigo !== recomendada.visa.codigo && c.visa.codigo !== '15') ||
    ({
      visa: trabalhoVisa,
      nota: isYes(answers.possuiOfertaTrabalhoFormal) ? 88 : 50,
      notaBase: 50,
      ajustesAplicados: [],
      motivo: 'Alternativa vinculada a contrato de trabalho notariado com empresa chilena.',
      caminho: 'Exige contrato formal e pedido do exterior na maioria dos casos.',
      alertas: [],
    } as DiagnosticCandidate);

  // Notas por subcategoria para explicabilidade
  const notasPorSubcategoria = candidatos.map((c) => ({
    codigo: c.visa.codigo,
    nomePortugues: c.visa.nomePortugues,
    notaBase: c.notaBase,
    ajustes: c.ajustesAplicados.reduce((s, a) => s + a.delta, 0),
    notaFinal: c.nota,
    motivo: c.motivo,
  }));

  // 14. Cálculo das 7 dimensões de viabilidade (100 pontos)
  const isMercosulTop = recomendada.visa.codigo === '15';

  let ptsElegibilidade = 25;
  if (exigeSaidaTurista && !vinculoFormalizado && !isHumanitario) ptsElegibilidade -= 5;
  if (!isBrasileiro && !vinculoFormalizado && !isYes(answers.possuiOfertaTrabalhoFormal)) ptsElegibilidade -= 10;

  let ptsDocumental = passaporteVencido && !isResidenteChile ? 6 : passaporteCurto ? 10 : 18;
  const docsCount = (answers.documentosJaPossui || []).length;
  ptsDocumental = Math.min(20, ptsDocumental + (docsCount >= 2 ? 2 : docsCount === 1 ? 1 : 0));
  if (passaporteCurto) ptsDocumental = Math.min(ptsDocumental, 12);
  if (passaporteVencido && !isResidenteChile) ptsDocumental = Math.min(ptsDocumental, 8);

  let ptsFinanceira = 15;
  if (!isMercosulTop && recomendada.visa.exigeRenda) {
    if (
      answers.faixaRendaMensalUsd === 'acima_2500' ||
      isYes(answers.possuiOfertaTrabalhoFormal) ||
      isYes(answers.possuiCapitalComprovadoOrigem)
    ) {
      ptsFinanceira = 15;
    } else if (answers.faixaRendaMensalUsd === '1000_2500') {
      ptsFinanceira = 12;
    } else {
      ptsFinanceira = 8;
    }
  }

  const ptsHistorico = flagsRisco.length === 0 ? 15 : Math.max(0, 15 - flagsRisco.length * 7);
  const ptsPrazo = answers.prazoPretendido === 'Imediato (até 30 dias)' ? 8 : 10;
  const ptsEstabilidade = recomendada.visa.levaDefinitiva ? 10 : 5;
  const ptsFamiliar = !isYes(answers.familiaAcompanhante) || vinculoFormalizado || isBrasileiro ? 5 : 4;

  const dimensoes: ViabilityDimension[] = [
    {
      nome: 'Elegibilidade Legal',
      pontos: ptsElegibilidade,
      maximo: VIABILITY_WEIGHTS.ELEGIBILIDADE_LEGAL,
      observacao: exigeSaidaTurista
        ? 'Elegível, porém requer saída do Chile para protocolar do exterior.'
        : 'Enquadramento claro nas normas vigentes.',
    },
    {
      nome: 'Prontidão Documental',
      pontos: ptsDocumental,
      maximo: VIABILITY_WEIGHTS.PRONTIDAO_DOCUMENTAL,
      observacao: passaporteVencido
        ? 'Passaporte vencido ou ausente requer emissão prioritária.'
        : passaporteCurto
          ? 'Passaporte com menos de 12 meses de validade.'
          : 'Passaporte com vigência adequada.',
    },
    {
      nome: 'Capacidade Financeira',
      pontos: ptsFinanceira,
      maximo: VIABILITY_WEIGHTS.CAPACIDADE_FINANCEIRA,
      observacao: isMercosulTop
        ? 'Subcategoria Mercosul não exige contrato nem comprovação de renda mínima.'
        : 'Avaliado conforme exigência de sustento da subcategoria.',
    },
    {
      nome: 'Histórico / Riscos',
      pontos: ptsHistorico,
      maximo: VIABILITY_WEIGHTS.HISTORICO_RISCOS,
      observacao:
        flagsRisco.length === 0
          ? flagsRevisaoConsultor.length > 0
            ? `${flagsRevisaoConsultor.length} ponto(s) reservado(s) para revisão sigilosa com o consultor.`
            : 'Sem fatores de risco informados.'
          : `${flagsRisco.length} ponto(s) de risco requer(em) revisão do consultor.`,
    },
    {
      nome: 'Prazo',
      pontos: ptsPrazo,
      maximo: VIABILITY_WEIGHTS.PRAZO,
      observacao:
        answers.prazoPretendido === 'Imediato (até 30 dias)'
          ? 'Prazo imediato requer agilidade nas apostilas e antecedentes PF (60d).'
          : 'Prazo compatível com emissão documental e protocolo.',
    },
    {
      nome: 'Estabilidade / Definitiva',
      pontos: ptsEstabilidade,
      maximo: VIABILITY_WEIGHTS.ESTABILIDADE_DEFINITIVA,
      observacao: recomendada.visa.levaDefinitiva
        ? `Leva à Residência Definitiva após ${recomendada.visa.mesesDefinitiva || 24} meses.`
        : 'Subcategoria temporária sem transição direta automática.',
    },
    {
      nome: 'Viabilidade Familiar',
      pontos: ptsFamiliar,
      maximo: VIABILITY_WEIGHTS.VIABILIDADE_FAMILIAR,
      observacao: isYes(answers.familiaAcompanhante)
        ? `Planejamento contempla ${answers.quantidadeDependentes || 1} dependente(s).`
        : 'Processo individual sem dependentes.',
    },
  ];

  const total = dimensoes.reduce((acc, d) => acc + d.pontos, 0);
  let veredito: DiagnosticResult['viabilidade']['veredito'] = 'Viável';
  if (total >= 80) veredito = 'Viável';
  else if (total >= 60) veredito = 'Viável com ressalvas';
  else if (total >= 40) veredito = 'Viável após ajustes';
  else veredito = 'Inviável no momento';

  // 15. Contradições e Confiança (Alta, Média, Baixa)
  const contradicoes = detectDiagnosticContradictions(answers);
  const fatoresConfianca: string[] = [];

  const nullRiskCount = (['overstay', 'ordenAbandono', 'rejeicaoAnterior', 'antecedentesCriminais'] as RiskFieldKey[]).filter(
    (k) => answers[k] === null || answers[k] === undefined,
  ).length;

  let confianca: DiagnosticConfidence = 'Alta';
  if (contradicoes.length > 0) {
    confianca = 'Baixa';
    fatoresConfianca.push(`${contradicoes.length} contradição(ões) detectada(s) nas respostas.`);
  } else if (nullRiskCount >= 2 || (answers.passaporteStatus !== 'nao_possui' && answers.passaporteValidadeMeses === undefined)) {
    confianca = 'Média';
    fatoresConfianca.push('Há respostas pendentes ou reservadas para conversa direta com o consultor.');
  } else {
    fatoresConfianca.push('Respostas consistentes e completas para pré-análise orientativa.');
  }

  if (nullRiskCount > 0 && confianca === 'Alta') {
    confianca = 'Média';
    fatoresConfianca.push(`${nullRiskCount} pergunta(s) sensível(is) aguardando confirmação com o consultor.`);
  }

  // 16. Pré-checklist, Semáforo & Plano de Ação em 3 blocos ordenado por validade
  const preChecklist = requirements
    .filter((r) => r.visaCategoryId === recomendada.visa.id)
    .sort((a, b) => {
      // Sem validade e mais demorados primeiro; validade curta (60d) por último
      const aShort = a.validadeDias > 0 && a.validadeDias <= 60 ? 1 : 0;
      const bShort = b.validadeDias > 0 && b.validadeDias <= 60 ? 1 : 0;
      if (aShort !== bShort) return aShort - bShort;
      return a.ordemPrioridadeEmissao - b.ordemPrioridadeEmissao;
    });

  const jaPossuiStr = (answers.documentosJaPossui || []).join(' ').toLowerCase();
  const checklistItems: ChecklistReadinessItem[] = preChecklist.map((req) => {
    const nomeLower = req.nomeDocumento.toLowerCase();
    const hasMatch =
      (nomeLower.includes('passaporte') && !passaporteVencido && jaPossuiStr.includes('passaporte')) ||
      (nomeLower.includes('certidão') && jaPossuiStr.includes('certid')) ||
      (nomeLower.includes('contrato') && jaPossuiStr.includes('contrato')) ||
      (nomeLower.includes('renda') && jaPossuiStr.includes('renda')) ||
      (nomeLower.includes('matrícula') && jaPossuiStr.includes('matrícula'));

    const statusInicial: ChecklistReadinessItem['statusInicial'] = hasMatch
      ? 'Já possui'
      : req.validadeDias > 0 && req.validadeDias <= 60
        ? 'Crítico / Validade curta'
        : 'Pendente';

    return {
      id: req.id,
      nomeDocumento: req.nomeDocumento,
      categoriaDoc: req.categoriaDoc,
      obrigatorio: req.obrigatorio,
      validadeDias: req.validadeDias,
      exigeApostila: req.exigeApostila,
      exigeTraducao: req.exigeTraducao,
      ordemPrioridadeEmissao: req.ordemPrioridadeEmissao,
      statusInicial,
    };
  });

  const concluidosInit = checklistItems.filter((i) => i.statusInicial === 'Já possui').length;
  const percentualInicial = checklistItems.length > 0 ? Math.round((concluidosInit / checklistItems.length) * 100) : 0;
  const semaforoChecklist: 'Verde' | 'Amarelo' | 'Vermelho' =
    percentualInicial >= 65 ? 'Verde' : percentualInicial >= 30 ? 'Amarelo' : 'Vermelho';

  // Plano de ação em 3 blocos: "Faça agora", "Em 30 dias", "Antes do protocolo"
  const facaAgora: ActionPlanItem[] = [];
  const em30Dias: ActionPlanItem[] = [];
  const antesProtocolo: ActionPlanItem[] = [];

  if (passaporteVencido) {
    facaAgora.push({
      id: 'act_passaporte_renovar',
      titulo: 'Emitir ou renovar passaporte brasileiro na Polícia Federal',
      detalhe: 'Requisito prioritário sem o qual não é possível concluir o protocolo eletrônico.',
      prioridade: 1,
      validadeDias: 0,
      orgao: 'Polícia Federal / Consulado',
      bloco: 'facaAgora',
    });
  } else if (passaporteCurto) {
    facaAgora.push({
      id: 'act_passaporte_curto',
      titulo: 'Avaliar renovação antecipada do passaporte (validade < 12 meses)',
      detalhe: 'Evita vencimento durante a tramitação no SERMIG ou restrição na emissão do Estampado.',
      prioridade: 1,
      validadeDias: 0,
      orgao: 'Polícia Federal',
      bloco: 'facaAgora',
    });
  }

  if (exigeSaidaTurista) {
    facaAgora.push({
      id: 'act_planejar_saida',
      titulo: 'Planejar saída do Chile para protocolo do exterior',
      detalhe: 'Como turista sem vínculo formalizado, o pedido deve ser protocolado fora do território chileno.',
      prioridade: 2,
      validadeDias: 0,
      orgao: 'SERMIG / PDI',
      bloco: 'facaAgora',
    });
  }

  if (isYes(answers.vinculoFamiliarChile) && !vinculoFormalizado) {
    facaAgora.push({
      id: 'act_formalizar_vinculo',
      titulo: 'Formalizar casamento ou Acuerdo de Unión Civil',
      detalhe: 'A formalização jurídica habilita a Reunificação Familiar (Cód. 01) inclusive de dentro do Chile.',
      prioridade: 2,
      validadeDias: 0,
      orgao: 'Cartório / Registro Civil',
      bloco: 'facaAgora',
    });
  }

  if (isMenorAcompanhado) {
    facaAgora.push({
      id: 'act_menor_autorizacao',
      titulo: 'Separar certidão de nascimento em 2ª via e autorização de viagem/residência dos pais',
      detalhe: 'Documentação essencial para solicitação de menor de 18 anos acompanhado.',
      prioridade: 3,
      validadeDias: 0,
      orgao: 'Cartório / Tabelionato',
      bloco: 'facaAgora',
    });
  }

  for (const req of preChecklist) {
    const item: ActionPlanItem = {
      id: `act_${req.id}`,
      titulo: req.nomeDocumento,
      detalhe: `${req.comoObterInstrucoes}${req.exigeApostila ? ' · Exige Apostila de Haia' : ''}${req.exigeTraducao ? ' · Tradução juramentada' : ''}`,
      prioridade: req.ordemPrioridadeEmissao,
      validadeDias: req.validadeDias,
      orgao: req.orgaoEmissor,
      bloco:
        req.validadeDias > 0 && req.validadeDias <= 60
          ? 'antesProtocolo'
          : req.validadeDias === 0 || req.ordemPrioridadeEmissao <= 3
            ? 'facaAgora'
            : 'em30Dias',
    };
    if (item.bloco === 'facaAgora') facaAgora.push(item);
    else if (item.bloco === 'em30Dias') em30Dias.push(item);
    else antesProtocolo.push(item);
  }

  if (em30Dias.length === 0) {
    em30Dias.push({
      id: 'act_apostilar_traduzir',
      titulo: 'Apostilar certidões e realizar traduções juramentadas necessárias',
      detalhe: 'Conferir legibilidade em PDF (300 DPI) antes da emissão das certidões com validade de 60 dias.',
      prioridade: 5,
      validadeDias: 0,
      orgao: 'Cartório CNJ / Tradutor',
      bloco: 'em30Dias',
    });
  }
  if (antesProtocolo.length === 0) {
    antesProtocolo.push({
      id: 'act_antecedentes_60d',
      titulo: 'Emitir e apostilar Antecedentes Criminais da Polícia Federal (validade 60 dias)',
      detalhe: 'Deixar para emitir somente quando os demais documentos estiverem conferidos, pois vence em 60 dias.',
      prioridade: 19,
      validadeDias: 60,
      orgao: 'Polícia Federal + CNJ',
      bloco: 'antesProtocolo',
    });
  }

  // Ordenar cada bloco: validadeDias === 0 primeiro, validade <= 60 por último
  const sortAction = (a: ActionPlanItem, b: ActionPlanItem) => {
    const a60 = a.validadeDias > 0 && a.validadeDias <= 60 ? 1 : 0;
    const b60 = b.validadeDias > 0 && b.validadeDias <= 60 ? 1 : 0;
    if (a60 !== b60) return a60 - b60;
    return a.prioridade - b.prioridade;
  };
  facaAgora.sort(sortAction);
  em30Dias.sort(sortAction);
  antesProtocolo.sort(sortAction);

  // 17. Faixa de Custos Estimada em BRL e CLP
  const numPessoas = isYes(answers.familiaAcompanhante) ? 1 + Math.max(1, answers.quantidadeDependentes || 1) : 1;
  const taxaSermigUsd =
    recomendada.visa.codigo === '15'
      ? custosPadrao.taxaSermigMercosulUsd ?? 90
      : situacaoResidenciaAtual === 'Residência Definitiva em análise'
        ? custosPadrao.taxaSermigDefinitivaUsd ?? 100
        : custosPadrao.taxaSermigTemporalUsd ?? 90;
  const taxaSermigBrl = Math.round(taxaSermigUsd * custosConfig.taxaCambioUsdBrl * numPessoas);
  const qtdApostilas = checklistItems.filter((i) => i.exigeApostila).length || 2;
  const apostilasBrlMin = qtdApostilas * (custosPadrao.apostilaCnjBrl ?? 165) * numPessoas;
  const apostilasBrlMax = Math.round(apostilasBrlMin * 1.25);
  const qtdTraducoes = checklistItems.filter((i) => i.exigeTraducao).length || 1;
  const traducoesBrlMin = qtdTraducoes * (custosPadrao.traducaoJuramentadaBrl ?? 180) * numPessoas;
  const traducoesBrlMax = Math.round(traducoesBrlMin * 1.5);
  const cedulaBrl = Math.round(((custosPadrao.cedulaIdentidadeClp ?? 4270) * numPessoas) / custosConfig.taxaCambioBrlClp);

  const taxasOficiaisBrlMin = taxaSermigBrl + apostilasBrlMin + traducoesBrlMin + cedulaBrl;
  const taxasOficiaisBrlMax = taxaSermigBrl + apostilasBrlMax + traducoesBrlMax + cedulaBrl;
  const honorariosFactor = numPessoas > 1 ? 1 + (numPessoas - 1) * 0.35 : 1;
  const honorariosMinBrl = Math.round(custosConfig.honorariosMinBrl * honorariosFactor);
  const honorariosMaxBrl = Math.round(custosConfig.honorariosMaxBrl * honorariosFactor);

  const totalMinBrl = honorariosMinBrl + taxasOficiaisBrlMin;
  const totalMaxBrl = honorariosMaxBrl + taxasOficiaisBrlMax;
  const totalMinClp = Math.round(totalMinBrl * custosConfig.taxaCambioBrlClp);
  const totalMaxClp = Math.round(totalMaxBrl * custosConfig.taxaCambioBrlClp);

  const custosEstimados: CostEstimateSummary = {
    honorariosMinBrl,
    honorariosMaxBrl,
    taxasOficiaisBrlMin,
    taxasOficiaisBrlMax,
    totalMinBrl,
    totalMaxBrl,
    totalMinClp,
    totalMaxClp,
    taxaCambioBrlClp: custosConfig.taxaCambioBrlClp,
    taxaCambioUsdBrl: custosConfig.taxaCambioUsdBrl,
    avisoEstimativa: 'Estimativa — confirmar na fonte oficial (SERMIG, CNJ e Registro Civil).',
    itensDetalhados: [
      { label: `Honorários orientativos (${numPessoas} pessoa(s))`, valorTexto: `R$ ${honorariosMinBrl.toLocaleString('pt-BR')} a R$ ${honorariosMaxBrl.toLocaleString('pt-BR')}` },
      { label: `Taxa governamental SERMIG (~USD ${taxaSermigUsd}/pessoa)`, valorTexto: `~R$ ${taxaSermigBrl.toLocaleString('pt-BR')}` },
      { label: `Apostilas de Haia (${qtdApostilas}/pessoa)`, valorTexto: `R$ ${apostilasBrlMin.toLocaleString('pt-BR')} a R$ ${apostilasBrlMax.toLocaleString('pt-BR')}` },
      { label: `Traduções juramentadas estimadas`, valorTexto: `R$ ${traducoesBrlMin.toLocaleString('pt-BR')} a R$ ${traducoesBrlMax.toLocaleString('pt-BR')}` },
      { label: `Cédula de Identidade Chile (${numPessoas}x)`, valorTexto: `CLP ${((custosPadrao.cedulaIdentidadeClp ?? 4270) * numPessoas).toLocaleString('es-CL')}` },
    ],
  };

  // 18. Cronograma em faixas (sem prometer data exata)
  const cronogramaFaixas: TimelineRangeSummary = {
    preparacaoDocumental: passaporteVencido
      ? '30 a 60 dias (inclui emissão/renovação de passaporte)'
      : '15 a 35 dias (emissão de certidões, apostilas e traduções)',
    protocoloSermig: exigeSaidaTurista ? 'Após saída programada do Chile (1 a 3 dias úteis)' : '1 a 5 dias úteis após conferência 100%',
    respostaSermig: '3 a 8 meses em média (prazo referencial de análise SERMIG: até 180 dias — Art. 27, Ley 19.880)',
    observacaoLegal: 'Prazos em faixa referencial; o deferimento e o tempo de análise competem exclusivamente ao SERMIG.',
  };

  // 19. Comparativo lado a lado reforçado (Recomendada x Mercosul 15 x Terceira opção)
  const formatDeOndePedir = (v: VisaCategory) =>
    v.permiteDentroChile === 'Sim' ? 'Brasil ou dentro do Chile' : v.permiteDentroChile === 'Condicional' ? 'Exterior (ou dentro c/ vínculo)' : 'Do exterior (fora do Chile)';

  const linhasFixas: ComparisonRow[] = [
    {
      criterio: 'Subcategoria',
      principal: `${recomendada.visa.codigo} – ${recomendada.visa.nomePortugues} (${recomendada.nota}/100)`,
      mercosul: `15 – ${mercosulCand.visa.nomePortugues} (${mercosulCand.nota}/100)`,
      terceiraOpcao: `${terceiraOpcao.visa.codigo} – ${terceiraOpcao.visa.nomePortugues} (${terceiraOpcao.nota}/100)`,
    },
    {
      criterio: 'De onde pedir',
      principal: formatDeOndePedir(recomendada.visa),
      mercosul: 'Do exterior (ou prorrogação no Chile)',
      terceiraOpcao: formatDeOndePedir(terceiraOpcao.visa),
    },
    {
      criterio: 'Permite trabalhar',
      principal: recomendada.visa.permiteTrabalhar ? 'Sim (desde o protocolo/aprovação)' : 'Não / Restrito',
      mercosul: 'Sim (qualquer atividade lícita)',
      terceiraOpcao: terceiraOpcao.visa.permiteTrabalhar ? 'Sim' : 'Não',
    },
    {
      criterio: 'Exige renda / contrato',
      principal: recomendada.visa.exigeRenda ? 'Sim' : 'Não exige contrato prévio',
      mercosul: 'Não exige renda nem contrato',
      terceiraOpcao: terceiraOpcao.visa.exigeRenda ? 'Sim' : 'Não',
    },
    {
      criterio: 'Vigência inicial',
      principal: `${recomendada.visa.vigenciaMeses || 24} meses`,
      mercosul: `${mercosulCand.visa.vigenciaMeses || 24} meses`,
      terceiraOpcao: `${terceiraOpcao.visa.vigenciaMeses || 12} meses`,
    },
    {
      criterio: 'Caminho para Definitiva',
      principal: recomendada.visa.levaDefinitiva ? `Sim (${recomendada.visa.mesesDefinitiva || 24} meses)` : 'Não direta',
      mercosul: 'Sim (24 meses)',
      terceiraOpcao: terceiraOpcao.visa.levaDefinitiva ? `Sim (${terceiraOpcao.visa.mesesDefinitiva || 24} meses)` : 'Não direta',
    },
    {
      criterio: 'Nível de risco / atenção',
      principal: flagsRisco.length > 0 ? 'Alto (revisão consultor)' : exigeSaidaTurista ? 'Moderado (exige saída)' : 'Baixo',
      mercosul: isBrasileiro ? (exigeSaidaTurista ? 'Moderado (exige saída)' : 'Baixo') : 'Inelegível (não brasileiro)',
      terceiraOpcao: terceiraOpcao.visa.exigeRenda ? 'Requer lastro documental/contrato' : 'Moderado',
    },
    {
      criterio: 'Documentos extras',
      principal: recomendada.visa.codigo === '01' ? 'Certidão casamento/AUC apostilada' : recomendada.visa.codigo === '03' ? 'Matrícula instituição chilena' : 'Antecedentes PF + Certidões',
      mercosul: 'Passaporte/RG + Antecedentes PF (60d)',
      terceiraOpcao: terceiraOpcao.visa.codigo === '02' ? 'Contrato trabalho notariado + RUT empresa' : 'Comprovantes específicos da categoria',
    },
  ];

  // 20. Diagnóstico por Pessoa (somente quando família/dependentes selecionados explicitamente!)
  const diagnosticoPorPessoa: FamilyPersonDiagnostic[] = [];
  const familiaSelecionada =
    isYes(answers.familiaAcompanhante) ||
    answers.composicaoFamiliar === 'casal' ||
    answers.composicaoFamiliar === 'familia_com_filhos';

  if (familiaSelecionada) {
    const listaInformada = answers.pessoasFamilia && answers.pessoasFamilia.length > 0 ? answers.pessoasFamilia : [];
    if (listaInformada.length > 0) {
      for (const p of listaInformada) {
        const ehTitular = p.papel === 'Titular';
        diagnosticoPorPessoa.push({
          nome: p.nome || (ehTitular ? answers.nome || 'Titular' : 'Dependente'),
          papel: p.papel,
          parentesco: p.parentesco || (ehTitular ? 'Titular' : 'Familiar'),
          subcategoriaIndicada: ehTitular
            ? `${recomendada.visa.codigo} – ${recomendada.visa.nomePortugues}`
            : p.nacionalidadeBrasileira && recomendacaoPermiteIndependente(recomendada.visa.codigo)
              ? 'DEP (Dependente do Titular) ou 15 – Mercosul próprio'
              : 'DEP – Dependente vinculado ao Titular',
          observacao: ehTitular
            ? 'Responsável pelo protocolo principal e comprovação de vínculo familiar.'
            : 'Vinculado ao dossiê do titular com certidão de parentesco apostilada e traduzida.',
          documentosEspecificos: ehTitular
            ? ['Passaporte vigente', 'Certidão Nascimento/Casamento', 'Antecedentes PF (60d)']
            : ['Passaporte vigente', 'Certidão comprobatória do vínculo (2ª via apostilada)', 'Antecedentes PF (se maior de 18 anos)'],
        });
      }
    } else {
      const qtdDeps = Math.max(1, answers.quantidadeDependentes || 1);
      diagnosticoPorPessoa.push({
        nome: answers.nome || 'Titular',
        papel: 'Titular',
        parentesco: 'Titular',
        subcategoriaIndicada: `${recomendada.visa.codigo} – ${recomendada.visa.nomePortugues}`,
        observacao: 'Postulante principal do processo familiar consolidado.',
        documentosEspecificos: ['Passaporte vigente', 'Certidão Nascimento/Casamento', 'Antecedentes PF (60d)'],
      });
      for (let i = 1; i <= qtdDeps; i++) {
        diagnosticoPorPessoa.push({
          nome: `Dependente ${i}`,
          papel: 'Dependente',
          parentesco: answers.composicaoFamiliar === 'casal' && i === 1 ? 'Cônjuge' : 'Dependente familiar',
          subcategoriaIndicada: isBrasileiro ? 'DEP (Dependente) ou 15 – Mercosul próprio' : 'DEP – Dependente vinculado ao Titular',
          observacao: 'Avaliar pedido conjunto vinculado ao titular com certidões apostiladas.',
          documentosEspecificos: ['Passaporte vigente', 'Certidão de parentesco apostilada e traduzida'],
        });
      }
    }
  }

  const perguntasComplementares: string[] = [
    'Todos os familiares acompanhantes possuem passaporte válido por mais de 12 meses?',
  ];
  if (familiaSelecionada) {
    perguntasComplementares.push('As certidões de casamento e nascimento dos dependentes estão em 2ª via recente para apostilamento?');
  }
  if (exigeSaidaTurista) {
    perguntasComplementares.push('Qual a data prevista para saída do Chile visando o protocolo eletrônico do exterior?');
  }
  if (flagsRisco.length > 0 || flagsRevisaoConsultor.length > 0) {
    perguntasComplementares.push('Você possui cópia das notificações anteriores do SERMIG/PDI para análise técnica na reunião?');
  }
  for (const c of contradicoes) {
    perguntasComplementares.push(c.perguntaEsclarecimento);
  }

  const diferencasChave = [
    `Subcategoria principal (${recomendada.visa.codigo}): nota ${recomendada.nota}/100 · trabalha: ${recomendada.visa.permiteTrabalhar ? 'Sim' : 'Não'} · exige renda: ${recomendada.visa.exigeRenda ? 'Sim' : 'Não'}.`,
    `Reciprocidade Internacional/Mercosul (15): nota ${mercosulCand.nota}/100 · trabalha: Sim · exige renda: Não · definitiva em 24 meses.`,
  ];

  const relevantSourceIds = new Set(recomendada.visa.legalSourceIds || ['leg_ley_21325', 'leg_acordo_mercosul', 'leg_dec_177_2022']);
  const fontesLegais = legalSources.filter((s) => relevantSourceIds.has(s.id));

  if (explicacaoConsultor.length === 0) {
    explicacaoConsultor.push(
      `Subcategoria líder ${recomendada.visa.codigo} (${recomendada.nota} pts) sob versão de regras ${ruleMetadata.versao}.`,
    );
  } else {
    explicacaoConsultor.unshift(
      `Subcategoria líder ${recomendada.visa.codigo} (${recomendada.nota} pts) sob versão de regras ${ruleMetadata.versao}.`,
    );
  }

  return {
    dadosInsuficientes: false,
    recomendada,
    top3,
    comparativoMercosul: {
      principal: recomendada,
      mercosul: mercosulCand,
      terceiraOpcao,
      diferencasChave,
      linhasFixas,
    },
    descartadas: discarded,
    alertas,
    alertaRiscoAlto,
    flagsRisco,
    flagsRevisaoConsultor,
    caminho: recomendada.caminho,
    situacaoResidenciaAtual,
    perguntasComplementares,
    preChecklist,
    checklistProntidao: {
      itens: checklistItems,
      percentualInicial,
      semaforo: semaforoChecklist,
    },
    planoAcao: {
      facaAgora,
      em30Dias,
      antesProtocolo,
    },
    custosEstimados,
    cronogramaFaixas,
    diagnosticoPorPessoa,
    viabilidade: {
      dimensoes,
      total,
      veredito,
    },
    confianca,
    fatoresConfianca,
    contradicoes,
    informacoesQueMudariamResultado,
    versaoRegras: ruleMetadata,
    notasPorSubcategoria,
    explicacaoCliente,
    explicacaoConsultor,
    regrasAcionadas,
    fontesLegais: fontesLegais.length > 0 ? fontesLegais : legalSources.slice(0, 3),
    avisoOrientativo: 'Pré-análise orientativa. Não é parecer jurídico nem garantia de aprovação pelo SERMIG.',
  };
}

function recomendacaoPermiteIndependente(codigo: string): boolean {
  return codigo === '15' || codigo === '01';
}

export function compareWhatIfScenarios(
  baseAnswers: DiagnosticAnswers,
  whatIfAnswers: DiagnosticAnswers,
  categories?: VisaCategory[],
  requirements?: VisaRequirement[],
  legalSources?: LegalSource[],
  options?: EngineOptions,
): {
  atual: DiagnosticResult;
  simulado: DiagnosticResult;
  mudouSubcategoria: boolean;
  deltaViabilidade: number;
  deltaNotaRecomendada: number;
} {
  const atual = runDiagnosticEngine(baseAnswers, categories, requirements, legalSources, options);
  const simulado = runDiagnosticEngine(whatIfAnswers, categories, requirements, legalSources, options);
  const atualCod = atual.recomendada?.visa.codigo || '';
  const simCod = simulado.recomendada?.visa.codigo || '';
  return {
    atual,
    simulado,
    mudouSubcategoria: atualCod !== simCod,
    deltaViabilidade: simulado.viabilidade.total - atual.viabilidade.total,
    deltaNotaRecomendada: (simulado.recomendada?.nota || 0) - (atual.recomendada?.nota || 0),
  };
}

export function computeLeadPriorityAndTemperature(
  answers: DiagnosticAnswers,
  diag: DiagnosticResult,
): { prioridade: Lead['prioridade']; temperatura: LeadTemperature } {
  const hasHighRisk = diag.flagsRisco.length > 0;
  const passaporteCurtoOuVencido =
    answers.passaporteStatus === 'vencido' ||
    answers.passaporteStatus === 'nao_possui' ||
    (answers.passaporteValidadeMeses ?? 24) < 12;
  const prazoImediato = answers.prazoPretendido === 'Imediato (até 30 dias)';
  const prazoMedio = answers.prazoPretendido === '1 a 3 meses';

  let prioridade: Lead['prioridade'] = 'Média';
  if (hasHighRisk) {
    prioridade = 'Urgente';
  } else if (prazoImediato || passaporteCurtoOuVencido || answers.localizacao === 'No Chile como turista') {
    prioridade = 'Alta';
  } else if (answers.prazoPretendido === 'Mais de 6 meses') {
    prioridade = 'Baixa';
  }

  let temperatura: LeadTemperature = 'Morno';
  if (prazoImediato || (prazoMedio && (diag.viabilidade.total >= 75 || answers.localizacao === 'No Chile como turista'))) {
    temperatura = 'Quente';
  } else if (answers.prazoPretendido === 'Mais de 6 meses' || diag.confianca === 'Baixa' || diag.dadosInsuficientes) {
    temperatura = 'Frio';
  }

  return { prioridade, temperatura };
}
