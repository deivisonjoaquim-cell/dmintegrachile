import type { Case, CaseDocument, Deadline, UserRole } from '../types/domain';
import { getMacroStageForCase } from './funnelModel';

export type MacroFunnelStageDefinition = ReturnType<typeof getMacroStageForCase>;

export type DynamicCaseTabId =
  | 'resumo'
  | 'documentos'
  | 'agenda'
  | 'comunicacao'
  | 'financeiro'
  | 'dependentes'
  | 'relocation';

export interface CaseTabDescriptor {
  id: DynamicCaseTabId;
  label: string;
  badgeCount?: number;
}

export interface CaseOptionalTabDescriptor {
  id: 'dependentes' | 'relocation';
  label: string;
}

export interface CaseNextAction {
  titulo: string;
  descricao: string;
  ctaLabel: string;
  targetTab: DynamicCaseTabId;
  tone: 'neutral' | 'warning' | 'success';
}

export interface CaseContextFields {
  tipoServico: boolean;
  prioridade: boolean;
  subcategoriaSermig: boolean;
  numeroPedidoSermig: boolean;
  dataProtocolo: boolean;
  comprovanteProtocolo: boolean;
  notasSermig: boolean;
  dataLimiteEntrada: boolean;
  dataVencimentoResidencia: boolean;
  prazoRequerimento: boolean;
  parecerTecnico: boolean;
  parecerExpandedByDefault: boolean;
}

export interface CaseContextConfig {
  isRelocationOnly: boolean;
  usesSermig: boolean;
  hasProtocolStarted: boolean;
  isPostApproval: boolean;
  currentMacroStage: MacroFunnelStageDefinition;
  visibleTabs: CaseTabDescriptor[];
  hiddenOptionalTabs: CaseOptionalTabDescriptor[];
  fields: CaseContextFields;
  relevantDeadlineTypes: Deadline['tipo'][];
  nextAction: CaseNextAction;
}

export interface CaseContextInput {
  caseObj: Case;
  role: UserRole;
  dependentsCount: number;
  docsCount: number;
  pendingDocsCount: number;
  docReadinessPct: number;
  minProtocolReadinessPct: number;
  unreadChatCount: number;
  hasRelocationTasks: boolean;
  forceTabs?: Partial<Record<'dependentes' | 'relocation', boolean>>;
  showAllFields?: boolean;
}

export interface DocumentRowVisibility {
  showEmissionDate: boolean;
  showApostilleToggle: boolean;
  showTranslationToggle: boolean;
}

const EXISTING_RESIDENCY_SERVICES: ReadonlySet<Case['tipoServico']> = new Set([
  'Prorrogação',
  'Residência Definitiva',
  'Mudança de Subcategoria',
  'Ratificação',
]);

const ENTRY_DEADLINE_SERVICES: ReadonlySet<Case['tipoServico']> = new Set([
  'Residência Temporal',
  'Outro',
]);

const REQUIREMENT_OR_APPEAL_STATUSES: ReadonlySet<Case['statusSermig']> = new Set([
  'Requerimento de documentos',
  'Rejeitado',
  'Em recurso',
]);

export function serviceRequiresVisaCategory(tipoServico: Case['tipoServico']): boolean {
  return tipoServico !== 'Relocation Completo';
}

export function serviceNeedsCurrentResidencyExpiry(tipoServico: Case['tipoServico']): boolean {
  return EXISTING_RESIDENCY_SERVICES.has(tipoServico);
}

export function getDocumentRowVisibility(
  doc: Pick<CaseDocument, 'validadeDias' | 'dataEmissao' | 'exigeApostila' | 'apostilado' | 'exigeTraducao' | 'traduzido'>,
): DocumentRowVisibility {
  return {
    showEmissionDate: (doc.validadeDias ?? 0) > 0 || Boolean(doc.dataEmissao),
    showApostilleToggle: Boolean(doc.exigeApostila || doc.apostilado),
    showTranslationToggle: Boolean(doc.exigeTraducao || doc.traduzido),
  };
}

export function getCaseContextConfig(input: CaseContextInput): CaseContextConfig {
  const {
    caseObj,
    role,
    dependentsCount,
    docsCount,
    pendingDocsCount,
    docReadinessPct,
    minProtocolReadinessPct,
    unreadChatCount,
    hasRelocationTasks,
    forceTabs,
    showAllFields = false,
  } = input;

  const isAssistente = role === 'assistente';
  const isRelocationOnly = caseObj.tipoServico === 'Relocation Completo';
  const usesSermig = !isRelocationOnly;
  const currentMacroStage = getMacroStageForCase(caseObj);

  const hasProtocolStarted =
    usesSermig &&
    (caseObj.etapaPipeline >= 7 ||
      caseObj.statusSermig !== 'Não protocolado' ||
      Boolean(caseObj.numeroPedidoSermig) ||
      Boolean(caseObj.dataProtocolo) ||
      Boolean(caseObj.comprovanteProtocoloUrl));

  const isPostApproval =
    caseObj.statusSermig === 'Aprovado' || caseObj.etapaPipeline >= 10;

  const isRequirementOrAppeal = REQUIREMENT_OR_APPEAL_STATUSES.has(caseObj.statusSermig);

  const isEntryDeadlineRelevant =
    usesSermig &&
    ((ENTRY_DEADLINE_SERVICES.has(caseObj.tipoServico) && isPostApproval) ||
      Boolean(caseObj.dataLimiteEntrada));

  const isResidencyExpiryRelevant =
    usesSermig &&
    (EXISTING_RESIDENCY_SERVICES.has(caseObj.tipoServico) ||
      isPostApproval ||
      Boolean(caseObj.dataVencimentoResidencia));

  const isRequirementDeadlineRelevant =
    usesSermig &&
    (isRequirementOrAppeal || Boolean(caseObj.prazoRequerimento));

  const isFamilyVisa = caseObj.visaCategoryId === 'visa_01_reunificacao';
  const showDependentsTab =
    Boolean(forceTabs?.dependentes) || dependentsCount > 0 || isFamilyVisa;

  const showRelocationTab =
    Boolean(forceTabs?.relocation) ||
    isRelocationOnly ||
    hasRelocationTasks ||
    (ENTRY_DEADLINE_SERVICES.has(caseObj.tipoServico) && isPostApproval);

  const visibleTabs: CaseTabDescriptor[] = [
    { id: 'resumo', label: 'Resumo' },
    {
      id: 'documentos',
      label: 'Documentos',
      badgeCount: docsCount > 0 ? docsCount : undefined,
    },
  ];

  if (showRelocationTab) {
    visibleTabs.push({ id: 'relocation', label: 'Relocation' });
  }

  if (showDependentsTab) {
    visibleTabs.push({
      id: 'dependentes',
      label: 'Dependentes',
      badgeCount: dependentsCount > 0 ? dependentsCount : undefined,
    });
  }

  visibleTabs.push({ id: 'agenda', label: 'Agenda e Prazos' });

  visibleTabs.push({
    id: 'comunicacao',
    label: 'Comunicação',
    badgeCount: unreadChatCount > 0 ? unreadChatCount : undefined,
  });

  if (!isAssistente) {
    visibleTabs.push({ id: 'financeiro', label: 'Financeiro' });
  }

  const hiddenOptionalTabs: CaseOptionalTabDescriptor[] = [];
  if (!showDependentsTab) {
    hiddenOptionalTabs.push({ id: 'dependentes', label: 'Dependentes' });
  }
  if (!showRelocationTab) {
    hiddenOptionalTabs.push({ id: 'relocation', label: 'Trilha Relocation' });
  }

  const fields: CaseContextFields = {
    tipoServico: true,
    prioridade: true,
    subcategoriaSermig: showAllFields || usesSermig,
    numeroPedidoSermig: showAllFields || hasProtocolStarted,
    dataProtocolo: showAllFields || hasProtocolStarted,
    comprovanteProtocolo: showAllFields || hasProtocolStarted,
    notasSermig:
      showAllFields ||
      hasProtocolStarted ||
      (caseObj.historicoStatusSermig?.length ?? 0) > 0,
    dataLimiteEntrada: showAllFields || isEntryDeadlineRelevant,
    dataVencimentoResidencia: showAllFields || isResidencyExpiryRelevant,
    prazoRequerimento: showAllFields || isRequirementDeadlineRelevant,
    parecerTecnico: !isAssistente && (showAllFields || usesSermig),
    parecerExpandedByDefault: usesSermig && caseObj.etapaPipeline <= 6,
  };

  // Tipos de prazo filtrados conforme o contexto real do caso
  const relevantDeadlineTypes: Deadline['tipo'][] = ['Validade Documento'];
  if (isRelocationOnly) {
    relevantDeadlineTypes.push('Vencimento Cédula');
  } else {
    if (ENTRY_DEADLINE_SERVICES.has(caseObj.tipoServico)) {
      relevantDeadlineTypes.push('Entrada no Chile 90d');
    }
    if (isResidencyExpiryRelevant || EXISTING_RESIDENCY_SERVICES.has(caseObj.tipoServico)) {
      relevantDeadlineTypes.push('Janela Prorrogação');
    }
    if (hasProtocolStarted || caseObj.etapaPipeline >= 6) {
      relevantDeadlineTypes.push('Prazo Legal 6 Meses SERMIG');
    }
    if (isRequirementOrAppeal || hasProtocolStarted) {
      relevantDeadlineTypes.push('Resposta Requerimento/Recurso');
    }
    relevantDeadlineTypes.push('Vencimento Cédula');
  }

  // Próximo passo recomendado conforme o estado atual do caso
  let nextAction: CaseNextAction;
  if (caseObj.encerradoEm || caseObj.etapaPipeline >= 15) {
    nextAction = {
      titulo: 'Processo concluído',
      descricao: 'Caso encerrado com histórico, documentos e auditoria preservados.',
      ctaLabel: 'Ver comunicação e histórico',
      targetTab: 'comunicacao',
      tone: 'success',
    };
  } else if (isRelocationOnly) {
    nextAction = {
      titulo: 'Trilha de chegada e estabelecimento no Chile',
      descricao:
        'Acompanhe Estampado, registro na PDI, Cédula de Identidade, ClaveÚnica e parceiros homologados.',
      ctaLabel: 'Abrir trilha Relocation',
      targetTab: 'relocation',
      tone: 'neutral',
    };
  } else if (isRequirementOrAppeal) {
    nextAction = {
      titulo: `Atenção imediata: ${caseObj.statusSermig}`,
      descricao: caseObj.prazoRequerimento
        ? 'Confira o prazo de requerimento/descargos e anexe os documentos complementares antes do vencimento.'
        : 'Registre a data limite do requerimento ou recurso e organize os documentos complementares.',
      ctaLabel: 'Conferir documentos',
      targetTab: 'documentos',
      tone: 'warning',
    };
  } else if (isPostApproval) {
    nextAction = {
      titulo: 'Residência aprovada — acompanhar pós-aprovação',
      descricao:
        ENTRY_DEADLINE_SERVICES.has(caseObj.tipoServico)
          ? 'Acompanhe o Estampado Electrónico, o prazo de entrada de 90 dias e a emissão da Cédula.'
          : 'Acompanhe a emissão da Cédula de Identidade e registre a nova data de vencimento da residência.',
      ctaLabel: showRelocationTab ? 'Abrir trilha Relocation' : 'Ver agenda e prazos',
      targetTab: showRelocationTab ? 'relocation' : 'agenda',
      tone: 'success',
    };
  } else if (hasProtocolStarted) {
    nextAction = {
      titulo: 'Processo protocolado no SERMIG',
      descricao: caseObj.numeroPedidoSermig
        ? `Pedido ${caseObj.numeroPedidoSermig} em acompanhamento. Registre novos despachos ou prazos conforme atualizações do portal.`
        : 'Registre o número do pedido SERMIG e anexe o comprovante oficial de protocolo.',
      ctaLabel: 'Ver agenda e prazos',
      targetTab: 'agenda',
      tone: 'neutral',
    };
  } else if (docsCount === 0) {
    nextAction = {
      titulo: 'Gerar checklist documental do caso',
      descricao:
        'Gere automaticamente os documentos exigidos pela subcategoria selecionada e o cronograma de validades.',
      ctaLabel: 'Ir para Documentos',
      targetTab: 'documentos',
      tone: 'neutral',
    };
  } else if (docReadinessPct < minProtocolReadinessPct) {
    nextAction = {
      titulo: `Preparação documental em ${docReadinessPct}%`,
      descricao:
        pendingDocsCount === 1
          ? 'Resta 1 documento para revisão ou aprovação antes de avançar para o protocolo SERMIG.'
          : `Restam ${pendingDocsCount} documentos para revisão ou aprovação antes de avançar para o protocolo SERMIG.`,
      ctaLabel: 'Revisar documentos pendentes',
      targetTab: 'documentos',
      tone: 'warning',
    };
  } else {
    nextAction = {
      titulo: 'Documentação pronta para protocolo SERMIG',
      descricao:
        'Todos os requisitos obrigatórios atingiram o mínimo exigido. Avance para a etapa de Trâmite ao protocolar.',
      ctaLabel: 'Conferir checklist final',
      targetTab: 'documentos',
      tone: 'success',
    };
  }

  return {
    isRelocationOnly,
    usesSermig,
    hasProtocolStarted,
    isPostApproval,
    currentMacroStage,
    visibleTabs,
    hiddenOptionalTabs,
    fields,
    relevantDeadlineTypes,
    nextAction,
  };
}
