import { PIPELINE_STAGES } from '../data/seeds';
import type {
  Case,
  CaseDocument,
  ClientNotification,
  Deadline,
  PaidConsultancyModality,
} from '../types/domain';
import { formatDateBR } from './formatters';
import { mapPipelineStepToOrientativaStep, ORIENTATIVA_STAGES } from './portalAccess';

export type MilestoneVisualStatus = 'completed' | 'current' | 'attention' | 'upcoming';

export interface TimelineMilestoneItem {
  id: string;
  numero: number;
  phaseKey: string;
  phaseLabel: string;
  titulo: string;
  descricao: string;
  responsavel?: 'Consultoria' | 'Cliente' | 'Conjunto';
  status: MilestoneVisualStatus;
  statusLabel: string;
  dateLabel?: string;
  contextNote?: string;
  actionTab?: 'documentos' | 'suporte' | 'financeiro';
  actionLabel?: string;
}

export interface TimelineAttentionAlert {
  id: string;
  severity: 'warning' | 'danger';
  title: string;
  detail: string;
  actionTab: 'documentos' | 'suporte';
  actionLabel: string;
}

export interface SermigBadgeInfo {
  label: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
  protocolNumber?: string;
}

export interface ClientStatusTimelineModel {
  modality: PaidConsultancyModality;
  totalSteps: number;
  currentStepNumber: number;
  completedStepsCount: number;
  progressPercent: number;
  currentMilestone: TimelineMilestoneItem | null;
  sermigBadge: SermigBadgeInfo;
  nextDeadline: { titulo: string; dataLimite: string; daysRemaining: number } | null;
  alerts: TimelineAttentionAlert[];
  milestones: TimelineMilestoneItem[];
  phases: { key: string; label: string; completedCount: number; totalCount: number; hasAttention: boolean; isActive: boolean }[];
}

const COMPLETA_PHASE_BY_STAGE: Record<number, { key: string; label: string }> = {
  1: { key: 'preparacao', label: 'Fase 1 · Preparação e Contrato' },
  2: { key: 'preparacao', label: 'Fase 1 · Preparação e Contrato' },
  3: { key: 'preparacao', label: 'Fase 1 · Preparação e Contrato' },
  4: { key: 'preparacao', label: 'Fase 1 · Preparação e Contrato' },
  5: { key: 'protocolo', label: 'Fase 2 · Conferência e Protocolo SERMIG' },
  6: { key: 'protocolo', label: 'Fase 2 · Conferência e Protocolo SERMIG' },
  7: { key: 'protocolo', label: 'Fase 2 · Conferência e Protocolo SERMIG' },
  8: { key: 'analise', label: 'Fase 3 · Análise Oficial e Deferimento' },
  9: { key: 'analise', label: 'Fase 3 · Análise Oficial e Deferimento' },
  10: { key: 'analise', label: 'Fase 3 · Análise Oficial e Deferimento' },
  11: { key: 'chegada', label: 'Fase 4 · Chegada, PDI e Cédula no Chile' },
  12: { key: 'chegada', label: 'Fase 4 · Chegada, PDI e Cédula no Chile' },
  13: { key: 'chegada', label: 'Fase 4 · Chegada, PDI e Cédula no Chile' },
  14: { key: 'chegada', label: 'Fase 4 · Chegada, PDI e Cédula no Chile' },
  15: { key: 'chegada', label: 'Fase 4 · Chegada, PDI e Cédula no Chile' },
};

const COMPLETA_STAGE_DESCRIPTIONS: Record<number, string> = {
  1: 'Diagnóstico migratório inicial e definição da estratégia legal.',
  2: 'Formalização do escopo, contrato de assessoria e abertura do processo.',
  3: 'Organização e envio dos documentos obrigatórios no Portal do Cliente.',
  4: 'Conferência técnica, apostilamento de Haia e traduções oficiais.',
  5: 'Validação de consistência final antes do protocolo eletrônico.',
  6: 'Preparação completa do dossiê digital para o portal do SERMIG.',
  7: 'Submissão oficial do pedido de residência junto ao SERMIG.',
  8: 'Acompanhamento do trâmite administrativo no sistema do governo chileno.',
  9: 'Atendimento de eventuais requerimentos ou solicitações complementares.',
  10: 'Emissão da resolução de aprovação e pagamento de taxas oficiais.',
  11: 'Download do Estampado Electrónico e preparação da entrada no Chile.',
  12: 'Registro presencial ou eletrônico de visto junto à PDI após chegada.',
  13: 'Agendamento e emissão da Cédula de Identidade para estrangeiros (Registro Civil).',
  14: 'Orientações de instalação inicial, RUT e integração no Chile.',
  15: 'Encerramento formal com entrega do dossiê completo e alertas de renovação.',
};

function computeDaysUntil(isoDate: string, nowMs: number): number {
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return 9999;
  return Math.ceil((target.getTime() - nowMs) / 86400000);
}

export function resolveSermigBadge(activeCase: Case | null, modality: PaidConsultancyModality): SermigBadgeInfo {
  if (modality === 'orientativa') {
    return {
      label: 'Protocolo conduzido pelo cliente',
      tone: 'info',
      protocolNumber: activeCase?.numeroPedidoSermig,
    };
  }
  const status = activeCase?.statusSermig || 'Não protocolado';
  switch (status) {
    case 'Aprovado':
      return { label: 'Aprovado no SERMIG', tone: 'success', protocolNumber: activeCase?.numeroPedidoSermig };
    case 'Em trâmite':
      return { label: 'Em trâmite no SERMIG', tone: 'info', protocolNumber: activeCase?.numeroPedidoSermig };
    case 'Requerimento de documentos':
      return { label: 'Requerimento de documentos', tone: 'warning', protocolNumber: activeCase?.numeroPedidoSermig };
    case 'Rejeitado':
      return { label: 'Indeferido / Rejeitado', tone: 'danger', protocolNumber: activeCase?.numeroPedidoSermig };
    case 'Em recurso':
      return { label: 'Em recurso administrativo', tone: 'warning', protocolNumber: activeCase?.numeroPedidoSermig };
    default:
      return { label: 'Não protocolado', tone: 'neutral', protocolNumber: activeCase?.numeroPedidoSermig };
  }
}

export function buildClientStatusTimeline(params: {
  activeCase: Case | null;
  modality: PaidConsultancyModality;
  caseDocuments: CaseDocument[];
  deadlines: Deadline[];
  notifications?: ClientNotification[];
  nowMs?: number;
}): ClientStatusTimelineModel {
  const { activeCase, modality, caseDocuments, deadlines } = params;
  const nowMs = params.nowMs ?? Date.now();

  const mandatoryDocs = caseDocuments.filter((d) => d.obrigatorio);
  const approvedMandatory = mandatoryDocs.filter((d) => d.status === 'Aprovado').length;
  const pendingDocs = caseDocuments.filter((d) => d.status === 'Pendente' || d.status === 'Reprovado' || d.status === 'Vencido');
  const rejectedDocs = caseDocuments.filter((d) => d.status === 'Reprovado' || d.status === 'Vencido');

  const openDeadlines = deadlines
    .filter((d) => !d.concluido && d.dataLimite)
    .map((d) => ({
      titulo: d.titulo,
      dataLimite: d.dataLimite,
      daysRemaining: computeDaysUntil(d.dataLimite, nowMs),
    }))
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const nextDeadline = openDeadlines[0] || null;
  const overdueDeadlines = openDeadlines.filter((d) => d.daysRemaining < 0);

  const alerts: TimelineAttentionAlert[] = [];
  if (
    modality === 'completa' &&
    activeCase &&
    (activeCase.statusSermig === 'Requerimento de documentos' ||
      activeCase.statusSermig === 'Rejeitado' ||
      activeCase.statusSermig === 'Em recurso')
  ) {
    alerts.push({
      id: 'sermig-action',
      severity: activeCase.statusSermig === 'Rejeitado' ? 'danger' : 'warning',
      title: `Status SERMIG: ${activeCase.statusSermig}`,
      detail: activeCase.prazoRequerimento
        ? `Prazo oficial registrado até ${formatDateBR(activeCase.prazoRequerimento)}. Confira as orientações da equipe e documentos solicitados.`
        : 'O órgão migratório registrou uma exigência ou status que requer atenção imediata.',
      actionTab: 'documentos',
      actionLabel: 'Revisar documentos',
    });
  }

  if (rejectedDocs.length > 0) {
    alerts.push({
      id: 'rejected-docs',
      severity: 'warning',
      title: `${rejectedDocs.length} documento(s) precisam de reenvio`,
      detail: rejectedDocs
        .slice(0, 3)
        .map((d) => d.nomeDocumento)
        .join(' · '),
      actionTab: 'documentos',
      actionLabel: 'Enviar correção',
    });
  }

  if (overdueDeadlines.length > 0) {
    alerts.push({
      id: 'overdue-deadlines',
      severity: 'danger',
      title: `${overdueDeadlines.length} prazo(s) em atenção`,
      detail: `Mais urgente: ${overdueDeadlines[0].titulo} (${formatDateBR(overdueDeadlines[0].dataLimite)}).`,
      actionTab: 'suporte',
      actionLabel: 'Falar com consultor',
    });
  }

  const sermigBadge = resolveSermigBadge(activeCase, modality);

  if (modality === 'orientativa') {
    const currentStep = mapPipelineStepToOrientativaStep(activeCase?.etapaPipeline || 1);
    const milestones: TimelineMilestoneItem[] = ORIENTATIVA_STAGES.map((st) => {
      const isDone = st.numero < currentStep;
      const isCurrent = st.numero === currentStep;
      const hasDocAttention = isCurrent && (st.numero === 3 || st.numero === 4) && rejectedDocs.length > 0;
      const status: MilestoneVisualStatus = isDone
        ? 'completed'
        : hasDocAttention
          ? 'attention'
          : isCurrent
            ? 'current'
            : 'upcoming';

      let contextNote: string | undefined;
      let dateLabel: string | undefined;
      let actionTab: TimelineMilestoneItem['actionTab'];
      let actionLabel: string | undefined;

      if (st.numero === 1 && activeCase?.createdAt) {
        dateLabel = formatDateBR(activeCase.createdAt);
      } else if (st.numero === 2 && activeCase?.dataContrato) {
        dateLabel = formatDateBR(activeCase.dataContrato);
      } else if (st.numero === 3 || st.numero === 4) {
        contextNote = `${approvedMandatory}/${mandatoryDocs.length} obrigatórios aprovados${pendingDocs.length > 0 ? ` · ${pendingDocs.length} pendente(s)` : ''}`;
        if (pendingDocs.length > 0) {
          actionTab = 'documentos';
          actionLabel = 'Ir para Documentos';
        }
      } else if (st.numero === 5 && activeCase?.dataProtocolo) {
        dateLabel = formatDateBR(activeCase.dataProtocolo);
      }

      return {
        id: `ori-${st.numero}`,
        numero: st.numero,
        phaseKey: st.responsavel === 'Cliente' ? 'cliente' : 'consultoria',
        phaseLabel:
          st.responsavel === 'Cliente'
            ? 'Ações do Cliente'
            : st.responsavel === 'Conjunto'
              ? 'Ações em Conjunto'
              : 'Ações da Consultoria',
        titulo: st.nome,
        descricao: st.descricao,
        responsavel: st.responsavel,
        status,
        statusLabel:
          status === 'completed'
            ? 'Concluída'
            : status === 'attention'
              ? 'Atenção necessária'
              : status === 'current'
                ? 'Em andamento'
                : 'Próxima etapa',
        dateLabel,
        contextNote,
        actionTab,
        actionLabel,
      };
    });

    const completedCount = milestones.filter((m) => m.status === 'completed').length;
    const progressPercent = Math.round(((currentStep - 0.5) / ORIENTATIVA_STAGES.length) * 100);

    return {
      modality,
      totalSteps: ORIENTATIVA_STAGES.length,
      currentStepNumber: currentStep,
      completedStepsCount: completedCount,
      progressPercent: Math.min(100, Math.max(8, currentStep >= ORIENTATIVA_STAGES.length ? 100 : progressPercent)),
      currentMilestone: milestones.find((m) => m.numero === currentStep) || milestones[0] || null,
      sermigBadge,
      nextDeadline,
      alerts,
      milestones,
      phases: [
        {
          key: 'consultoria',
          label: 'Orientação e Conferência',
          completedCount: milestones.filter((m) => m.phaseKey === 'consultoria' && m.status === 'completed').length,
          totalCount: milestones.filter((m) => m.phaseKey === 'consultoria').length,
          hasAttention: milestones.some((m) => m.phaseKey === 'consultoria' && m.status === 'attention'),
          isActive: milestones.some((m) => m.phaseKey === 'consultoria' && (m.status === 'current' || m.status === 'attention')),
        },
        {
          key: 'cliente',
          label: 'Execução pelo Cliente',
          completedCount: milestones.filter((m) => m.phaseKey === 'cliente' && m.status === 'completed').length,
          totalCount: milestones.filter((m) => m.phaseKey === 'cliente').length,
          hasAttention: milestones.some((m) => m.phaseKey === 'cliente' && m.status === 'attention'),
          isActive: milestones.some((m) => m.phaseKey === 'cliente' && (m.status === 'current' || m.status === 'attention')),
        },
      ],
    };
  }

  // Consultoria Completa (15 etapas SERMIG)
  const rawStep = activeCase?.etapaPipeline || 1;
  const currentStep = Math.max(1, Math.min(PIPELINE_STAGES.length, Math.round(rawStep)));
  const isSermigWarning =
    activeCase?.statusSermig === 'Requerimento de documentos' ||
    activeCase?.statusSermig === 'Rejeitado' ||
    activeCase?.statusSermig === 'Em recurso';

  const milestones: TimelineMilestoneItem[] = PIPELINE_STAGES.map((st) => {
    const phase = COMPLETA_PHASE_BY_STAGE[st.numero] || { key: 'preparacao', label: 'Fase 1 · Preparação' };
    const isDone = st.numero < currentStep || (st.numero === 15 && currentStep === 15 && activeCase?.statusSermig === 'Aprovado');
    const isCurrent = st.numero === currentStep && !isDone;
    const isAttention =
      isCurrent &&
      ((isSermigWarning && st.numero >= 7 && st.numero <= 10) ||
        (rejectedDocs.length > 0 && st.numero >= 3 && st.numero <= 6));

    const status: MilestoneVisualStatus = isDone
      ? 'completed'
      : isAttention
        ? 'attention'
        : isCurrent
          ? 'current'
          : 'upcoming';

    let dateLabel: string | undefined;
    let contextNote: string | undefined;
    let actionTab: TimelineMilestoneItem['actionTab'];
    let actionLabel: string | undefined;

    if (st.numero === 1 && activeCase?.createdAt) {
      dateLabel = formatDateBR(activeCase.createdAt);
    } else if (st.numero === 2 && activeCase?.dataContrato) {
      dateLabel = formatDateBR(activeCase.dataContrato);
    } else if (st.numero === 3 || st.numero === 4 || st.numero === 5) {
      if (mandatoryDocs.length > 0) {
        contextNote = `${approvedMandatory}/${mandatoryDocs.length} obrigatórios aprovados${rejectedDocs.length > 0 ? ` · ${rejectedDocs.length} com pendência` : ''}`;
      }
      if ((isCurrent || isAttention) && pendingDocs.length > 0) {
        actionTab = 'documentos';
        actionLabel = 'Abrir Documentos';
      }
    } else if (st.numero === 7) {
      if (activeCase?.dataProtocolo) dateLabel = formatDateBR(activeCase.dataProtocolo);
      if (activeCase?.numeroPedidoSermig) {
        contextNote = `Pedido SERMIG nº ${activeCase.numeroPedidoSermig}`;
      }
    } else if (st.numero === 8 || st.numero === 9) {
      if (activeCase?.prazoRequerimento) {
        dateLabel = `Prazo: ${formatDateBR(activeCase.prazoRequerimento)}`;
      }
      if (activeCase?.statusSermig && activeCase.statusSermig !== 'Não protocolado') {
        contextNote = `SERMIG: ${activeCase.statusSermig}`;
      }
      if (isAttention) {
        actionTab = 'documentos';
        actionLabel = 'Atender exigência';
      }
    } else if (st.numero === 10 && activeCase?.dataAprovacao) {
      dateLabel = formatDateBR(activeCase.dataAprovacao);
    } else if (st.numero === 11 && activeCase?.dataLimiteEntrada) {
      dateLabel = `Entrada até ${formatDateBR(activeCase.dataLimiteEntrada)}`;
    } else if (st.numero === 15 && activeCase?.dataVencimentoResidencia) {
      dateLabel = `Vigência até ${formatDateBR(activeCase.dataVencimentoResidencia)}`;
    }

    return {
      id: `comp-${st.numero}`,
      numero: st.numero,
      phaseKey: phase.key,
      phaseLabel: phase.label,
      titulo: st.nome,
      descricao: COMPLETA_STAGE_DESCRIPTIONS[st.numero] || st.nome,
      status,
      statusLabel:
        status === 'completed'
          ? 'Concluída'
          : status === 'attention'
            ? 'Atenção necessária'
            : status === 'current'
              ? 'Em andamento'
              : 'Próxima etapa',
      dateLabel,
      contextNote,
      actionTab,
      actionLabel,
    };
  });

  const completedCount = milestones.filter((m) => m.status === 'completed').length;
  const progressPercent =
    completedCount === PIPELINE_STAGES.length
      ? 100
      : Math.min(98, Math.max(6, Math.round(((currentStep - 0.5) / PIPELINE_STAGES.length) * 100)));

  const phaseOrder = ['preparacao', 'protocolo', 'analise', 'chegada'];
  const phases = phaseOrder.map((key) => {
    const items = milestones.filter((m) => m.phaseKey === key);
    return {
      key,
      label: items[0]?.phaseLabel || key,
      completedCount: items.filter((m) => m.status === 'completed').length,
      totalCount: items.length,
      hasAttention: items.some((m) => m.status === 'attention'),
      isActive: items.some((m) => m.status === 'current' || m.status === 'attention'),
    };
  });

  return {
    modality,
    totalSteps: PIPELINE_STAGES.length,
    currentStepNumber: currentStep,
    completedStepsCount: completedCount,
    progressPercent,
    currentMilestone: milestones.find((m) => m.numero === currentStep) || milestones[0] || null,
    sermigBadge,
    nextDeadline,
    alerts,
    milestones,
    phases,
  };
}
