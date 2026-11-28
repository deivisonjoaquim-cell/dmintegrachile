import type { Case, CaseDocument, PaidConsultancyModality } from '../types/domain';
import { formatDateBR } from './formatters';
import { mapPipelineStepToOrientativaStep } from './portalAccess';

export type JourneyMacroStatus = 'completed' | 'current' | 'attention' | 'upcoming';

export interface ImmigrationJourneyMacroStep {
  id: 'diagnostico' | 'dossie' | 'visto' | 'ingresso' | 'rut';
  stepNumber: string;
  shortTitle: string;
  title: string;
  subtitle: string;
  detail: string;
  featured: boolean;
  featuredTag?: 'Marco Oficial · Visto' | 'Marco Final · RUT';
  status: JourneyMacroStatus;
  statusLabel: string;
  dateHint?: string;
  targetPhaseKey: string;
}

export interface ImmigrationJourneyProgressModel {
  steps: ImmigrationJourneyMacroStep[];
  currentStepIndex: number;
  currentStep: ImmigrationJourneyMacroStep;
  progressPercent: number;
  visaHighlight: {
    status: JourneyMacroStatus;
    statusLabel: string;
    summary: string;
    protocolNumber?: string;
  };
  rutHighlight: {
    status: JourneyMacroStatus;
    statusLabel: string;
    summary: string;
    deadlineHint?: string;
  };
  stageCaption: string;
}

function resolveMacroStepFromPipeline(etapaPipeline: number, statusSermig?: Case['statusSermig']): number {
  const step = Math.max(1, Math.min(15, Math.round(etapaPipeline || 1)));
  if (step <= 2) return 0; // Diagnóstico & Contrato
  if (step <= 6) return 1; // Dossiê & Apostilamento
  if (step <= 10) return 2; // Visto (SERMIG)
  if (step === 11) return 3; // Estampado & Ingresso no Chile
  if (step === 15 && statusSermig === 'Aprovado') return 5; // Tudo concluído
  return 4; // Emissão do RUT (etapas 12..15)
}

function resolveMacroStepFromOrientativa(etapaPipeline: number): number {
  const oriStep = mapPipelineStepToOrientativaStep(etapaPipeline || 1);
  if (oriStep <= 2) return 0; // Diagnóstico & Checklist
  if (oriStep <= 4) return 1; // Organização & Conferência do Dossiê
  if (oriStep === 5) return 2; // Protocolo do Visto (SERMIG)
  return 4; // Pós-aprovação & Emissão do RUT
}

function statusToLabel(status: JourneyMacroStatus): string {
  switch (status) {
    case 'completed':
      return 'Concluída';
    case 'current':
      return 'Etapa atual';
    case 'attention':
      return 'Atenção requerida';
    default:
      return 'Próxima etapa';
  }
}

export function buildImmigrationJourneyProgress(params: {
  mode: 'gratuito' | 'pendente' | 'contratado';
  activeCase?: Case | null;
  modality?: PaidConsultancyModality;
  caseDocuments?: CaseDocument[];
  subcategoriaNome?: string;
}): ImmigrationJourneyProgressModel {
  const { mode, activeCase = null, modality = 'completa', caseDocuments = [], subcategoriaNome } = params;

  const rejectedDocsCount = caseDocuments.filter(
    (d) => d.status === 'Reprovado' || d.status === 'Vencido',
  ).length;
  const approvedMandatory = caseDocuments.filter((d) => d.obrigatorio && d.status === 'Aprovado').length;
  const totalMandatory = caseDocuments.filter((d) => d.obrigatorio).length;

  const hasSermigWarning = Boolean(
    activeCase &&
      (activeCase.statusSermig === 'Requerimento de documentos' ||
        activeCase.statusSermig === 'Rejeitado' ||
        activeCase.statusSermig === 'Em recurso'),
  );

  let activeIdx = 0;
  if (mode === 'contratado') {
    activeIdx =
      modality === 'orientativa'
        ? resolveMacroStepFromOrientativa(activeCase?.etapaPipeline || 1)
        : resolveMacroStepFromPipeline(activeCase?.etapaPipeline || 1, activeCase?.statusSermig);
  } else if (mode === 'pendente') {
    activeIdx = 0;
  } else {
    activeIdx = 0;
  }

  const allCompleted = activeIdx >= 5;
  const clampedCurrentIdx = Math.min(4, Math.max(0, activeIdx));

  const visaName =
    activeCase?.subcategoriaIa || activeCase?.titulo || subcategoriaNome || 'Residência Temporal SERMIG';

  const definitions: Array<{
    id: ImmigrationJourneyMacroStep['id'];
    stepNumber: string;
    shortTitle: string;
    title: string;
    subtitle: string;
    detail: string;
    featured: boolean;
    featuredTag?: ImmigrationJourneyMacroStep['featuredTag'];
    targetPhaseKey: string;
    dateHint?: string;
  }> = [
    {
      id: 'diagnostico',
      stepNumber: '01',
      shortTitle: 'Diagnóstico',
      title: 'Diagnóstico & Rota',
      subtitle: mode === 'contratado' ? 'Estratégia definida' : 'Enquadramento inicial',
      detail:
        mode === 'gratuito'
          ? `Pré-análise concluída para ${visaName}. Ao contratar a assessoria, liberamos sua esteira oficial até Visto e RUT.`
          : mode === 'pendente'
            ? 'Cadastro localizado. Assim que o consultor ativar seu acesso, iniciamos a conferência documental.'
            : `Estratégia migratória formalizada para ${visaName} com escopo focado em Visto e RUT.`,
      featured: false,
      targetPhaseKey: modality === 'orientativa' ? 'consultoria' : 'preparacao',
      dateHint: activeCase?.dataContrato
        ? `Contrato ${formatDateBR(activeCase.dataContrato)}`
        : activeCase?.createdAt
          ? formatDateBR(activeCase.createdAt)
          : undefined,
    },
    {
      id: 'dossie',
      stepNumber: '02',
      shortTitle: 'Dossiê',
      title: 'Dossiê & Apostila',
      subtitle:
        totalMandatory > 0
          ? `${approvedMandatory}/${totalMandatory} obrigatórios aprovados`
          : 'Certidões e Apostila de Haia',
      detail:
        'Organização na ordem de validade, conferência técnica, Apostila de Haia (CNJ) e certidão de Antecedentes PF (60 dias).',
      featured: false,
      targetPhaseKey: modality === 'orientativa' ? 'consultoria' : 'protocolo',
      dateHint:
        rejectedDocsCount > 0
          ? `${rejectedDocsCount} doc(s) para reenvio`
          : totalMandatory > 0
            ? `${approvedMandatory}/${totalMandatory} aprovados`
            : undefined,
    },
    {
      id: 'visto',
      stepNumber: '03',
      shortTitle: 'Visto (SERMIG)',
      title: 'Visto (SERMIG)',
      subtitle:
        activeCase?.statusSermig && activeCase.statusSermig !== 'Não protocolado'
          ? activeCase.statusSermig
          : 'Protocolo & Aprovação',
      detail:
        modality === 'orientativa'
          ? 'Submissão oficial do pedido no Portal SERMIG conduzida com nossa orientação e conferência prévia até o Estampado Electrónico.'
          : 'Protocolo oficial no Portal SERMIG, acompanhamento de exigências e emissão da resolução de aprovação do Visto.',
      featured: true,
      featuredTag: 'Marco Oficial · Visto',
      targetPhaseKey: modality === 'orientativa' ? 'cliente' : 'analise',
      dateHint: activeCase?.dataAprovacao
        ? `Aprovado ${formatDateBR(activeCase.dataAprovacao)}`
        : activeCase?.dataProtocolo
          ? `Protocolo ${formatDateBR(activeCase.dataProtocolo)}`
          : activeCase?.numeroPedidoSermig
            ? `Pedido ${activeCase.numeroPedidoSermig}`
            : undefined,
    },
    {
      id: 'ingresso',
      stepNumber: '04',
      shortTitle: 'Estampado',
      title: 'Estampado & Ingresso',
      subtitle: 'Entrada regular no Chile',
      detail:
        'Download do Estampado Electrónico do visto aprovado e ingresso regular no território chileno dentro da janela oficial de até 90 dias.',
      featured: false,
      targetPhaseKey: modality === 'orientativa' ? 'cliente' : 'chegada',
      dateHint: activeCase?.dataLimiteEntrada
        ? `Entrada até ${formatDateBR(activeCase.dataLimiteEntrada)}`
        : 'Janela de 90 dias',
    },
    {
      id: 'rut',
      stepNumber: '05',
      shortTitle: 'Emissão do RUT',
      title: 'Emissão do RUT',
      subtitle: 'Registro Civil · Cédula Chilena',
      detail:
        'Agendamento e solicitação presencial da Cédula de Identidade para Estrangeiros (RUT) no Registro Civil do Chile após a chegada com visto vigente.',
      featured: true,
      featuredTag: 'Marco Final · RUT',
      targetPhaseKey: modality === 'orientativa' ? 'cliente' : 'chegada',
      dateHint: activeCase?.dataVencimentoResidencia
        ? `Vigência ${formatDateBR(activeCase.dataVencimentoResidencia)}`
        : 'Até 30 dias pós-chegada',
    },
  ];

  const steps: ImmigrationJourneyMacroStep[] = definitions.map((def, idx) => {
    let status: JourneyMacroStatus = 'upcoming';
    if (allCompleted || idx < activeIdx) {
      status = 'completed';
    } else if (idx === activeIdx) {
      if (def.id === 'dossie' && rejectedDocsCount > 0) {
        status = 'attention';
      } else if (def.id === 'visto' && hasSermigWarning) {
        status = 'attention';
      } else {
        status = 'current';
      }
    }
    return {
      ...def,
      status,
      statusLabel: statusToLabel(status),
    };
  });

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const progressPercent = allCompleted
    ? 100
    : mode === 'gratuito'
      ? 16
      : mode === 'pendente'
        ? 22
        : Math.min(96, Math.max(12, Math.round(((completedCount + 0.5) / steps.length) * 100)));

  const currentStep = steps[clampedCurrentIdx];
  const visaStep = steps[2];
  const rutStep = steps[4];

  const visaSummary =
    visaStep.status === 'completed'
      ? `Visto SERMIG aprovado${activeCase?.dataAprovacao ? ` em ${formatDateBR(activeCase.dataAprovacao)}` : ''}. Pronto para Estampado e ingresso.`
      : visaStep.status === 'attention'
        ? `Atenção no SERMIG (${activeCase?.statusSermig || 'Exigência'}). Verifique documentos e prazos imediatamente.`
        : visaStep.status === 'current'
          ? activeCase?.numeroPedidoSermig
            ? `Em acompanhamento no SERMIG · Pedido nº ${activeCase.numeroPedidoSermig}.`
            : 'Etapa ativa: preparação final e protocolo oficial do Visto no SERMIG.'
          : `Subcategoria alvo: ${visaName}. Será protocolado assim que o dossiê documental for aprovado.`;

  const rutSummary =
    rutStep.status === 'completed'
      ? 'Processo de Cédula de Identidade para Estrangeiros (RUT) finalizado no Registro Civil.'
      : rutStep.status === 'current'
        ? 'Etapa ativa: agendamento e emissão presencial da Cédula de Identidade (RUT) no Registro Civil do Chile.'
        : 'Liberado após aprovação do Visto e ingresso regular no Chile (prazo oficial de 30 dias no Registro Civil).';

  const stageCaption = allCompleted
    ? 'Processo concluído — Visto aprovado e emissão do RUT finalizados'
    : `Você está na etapa ${currentStep.stepNumber} de 05 · ${currentStep.title}`;

  return {
    steps,
    currentStepIndex: clampedCurrentIdx,
    currentStep,
    progressPercent,
    visaHighlight: {
      status: visaStep.status,
      statusLabel: visaStep.statusLabel,
      summary: visaSummary,
      protocolNumber: activeCase?.numeroPedidoSermig,
    },
    rutHighlight: {
      status: rutStep.status,
      statusLabel: rutStep.statusLabel,
      summary: rutSummary,
      deadlineHint: rutStep.dateHint,
    },
    stageCaption,
  };
}
