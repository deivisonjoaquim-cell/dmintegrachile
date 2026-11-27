import type { Case, Client, GeneratedDocument } from '../types/domain';
import { getSignatureMethodLabel } from './contractSignature';

export type ContractSignatureFilter = 'pendentes' | 'assinados' | 'cancelados' | 'todos';

export type ContractSignatureStage =
  | 'assinado'
  | 'pendente_leitura_confirmada'
  | 'pendente_aguardando'
  | 'pendente_nao_liberado'
  | 'cancelado';

export interface ContractSignatureRow {
  doc: GeneratedDocument;
  client: Client | null;
  caseItem: Case | null;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string;
  caseTitle: string;
  stage: ContractSignatureStage;
  statusLabel: string;
  isPending: boolean;
  isSigned: boolean;
  isCanceled: boolean;
  lastInteractionAt: string;
  lastInteractionLabel: string;
  daysPending: number | null;
  portalBlocked: boolean;
  signatureMethodLabel: string;
}

export interface ContractSignatureMetrics {
  total: number;
  totalActive: number;
  pendentes: number;
  pendentesLiberados: number;
  pendentesLeituraConfirmada: number;
  pendentesInternos: number;
  assinados: number;
  cancelados: number;
  taxaAssinaturaPct: number;
}

function toTimestampMs(iso?: string | null): number {
  if (!iso) return 0;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

function isDocumentSigned(doc: GeneratedDocument): boolean {
  if (doc.canceladoEm) return false;
  return Boolean(
    doc.status === 'Assinado' ||
      (doc.assinadoEm && doc.assinadoEm.trim()) ||
      (doc.assinaturaDataUrl && doc.assinaturaDataUrl.trim()) ||
      (doc.assinaturaUrl && doc.assinaturaUrl.trim()),
  );
}

/**
 * Resolve o timestamp e a descrição humana da última interação de assinatura ou leitura do contrato.
 */
export function resolveLastSignatureInteraction(doc: GeneratedDocument): {
  at: string;
  label: string;
} {
  if (doc.canceladoEm) {
    return {
      at: doc.canceladoEm,
      label: 'Cancelado pela consultoria',
    };
  }

  if (isDocumentSigned(doc)) {
    const methodText = getSignatureMethodLabel(
      doc.assinaturaMetodo ||
        (doc.assinaturaUrl && !doc.assinaturaDataUrl ? 'pdf_anexado' : doc.assinaturaDataUrl ? 'desenhada' : undefined),
    );
    return {
      at: doc.assinadoEm || doc.updatedAt || doc.createdAt,
      label: `Assinado · ${methodText}`,
    };
  }

  if (doc.confirmadoLeituraEm) {
    return {
      at: doc.confirmadoLeituraEm,
      label: doc.confirmadoLeituraPor
        ? `Leitura confirmada por ${doc.confirmadoLeituraPor}`
        : 'Leitura confirmada no Portal',
    };
  }

  if (doc.updatedAt && doc.updatedAt !== doc.createdAt) {
    return {
      at: doc.updatedAt,
      label: doc.liberadoAoCliente ? 'Atualizado e disponível no Portal' : 'Rascunho atualizado',
    };
  }

  return {
    at: doc.createdAt,
    label: doc.liberadoAoCliente ? 'Disponibilizado para assinatura no Portal' : 'Gerado internamente (não liberado)',
  };
}

export function buildContractSignatureRows(
  docs: GeneratedDocument[],
  clients: Client[],
  cases: Case[],
  nowMs = Date.now(),
): ContractSignatureRow[] {
  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const caseMap = new Map(cases.map((c) => [c.id, c]));

  const rows: ContractSignatureRow[] = docs.map((doc) => {
    const client = clientMap.get(doc.clientId) || null;
    const caseItem = doc.caseId ? caseMap.get(doc.caseId) || null : null;
    const isCanceled = Boolean(doc.canceladoEm);
    const isSigned = !isCanceled && isDocumentSigned(doc);
    const isPending = !isCanceled && !isSigned;

    let stage: ContractSignatureStage;
    let statusLabel: string;
    if (isCanceled) {
      stage = 'cancelado';
      statusLabel = 'Cancelado';
    } else if (isSigned) {
      stage = 'assinado';
      statusLabel = 'Assinado';
    } else if (doc.confirmadoLeituraEm) {
      stage = 'pendente_leitura_confirmada';
      statusLabel = 'Pendente · Leitura confirmada';
    } else if (doc.liberadoAoCliente) {
      stage = 'pendente_aguardando';
      statusLabel = 'Pendente de assinatura';
    } else {
      stage = 'pendente_nao_liberado';
      statusLabel = 'Rascunho interno';
    }

    const lastInteraction = resolveLastSignatureInteraction(doc);
    const refCreatedMs = toTimestampMs(doc.createdAt);
    const daysPending =
      isPending && refCreatedMs > 0 ? Math.max(0, Math.floor((nowMs - refCreatedMs) / (24 * 60 * 60 * 1000))) : null;

    const portalBlocked = Boolean(isPending && doc.liberadoAoCliente && client && !client.portalLiberado);
    const signatureMethodLabel = isSigned
      ? getSignatureMethodLabel(
          doc.assinaturaMetodo ||
            (doc.assinaturaUrl && !doc.assinaturaDataUrl
              ? 'pdf_anexado'
              : doc.assinaturaDataUrl
                ? 'desenhada'
                : undefined),
        )
      : '';

    return {
      doc,
      client,
      caseItem,
      clientName: client?.nomeCompleto || doc.assinadoPorNome || doc.clientId,
      clientEmail: client?.email || doc.assinadoPorEmail || '',
      clientWhatsapp: client?.whatsapp || '',
      caseTitle: caseItem?.titulo || '',
      stage,
      statusLabel,
      isPending,
      isSigned,
      isCanceled,
      lastInteractionAt: lastInteraction.at,
      lastInteractionLabel: lastInteraction.label,
      daysPending,
      portalBlocked,
      signatureMethodLabel,
    };
  });

  // Prioridade de ordenação:
  // 1) Pendentes com leitura confirmada (alta intenção)
  // 2) Pendentes aguardando no Portal
  // 3) Pendentes internos (não liberados)
  // 4) Assinados (mais recentes primeiro)
  // 5) Cancelados
  const stagePriority: Record<ContractSignatureStage, number> = {
    pendente_leitura_confirmada: 0,
    pendente_aguardando: 1,
    pendente_nao_liberado: 2,
    assinado: 3,
    cancelado: 4,
  };

  return rows.sort((a, b) => {
    const prioDiff = stagePriority[a.stage] - stagePriority[b.stage];
    if (prioDiff !== 0) return prioDiff;
    return toTimestampMs(b.lastInteractionAt) - toTimestampMs(a.lastInteractionAt);
  });
}

export function computeContractSignatureMetrics(rows: ContractSignatureRow[]): ContractSignatureMetrics {
  let pendentes = 0;
  let pendentesLiberados = 0;
  let pendentesLeituraConfirmada = 0;
  let pendentesInternos = 0;
  let assinados = 0;
  let cancelados = 0;

  for (const row of rows) {
    if (row.isCanceled) {
      cancelados += 1;
    } else if (row.isSigned) {
      assinados += 1;
    } else {
      pendentes += 1;
      if (row.stage === 'pendente_leitura_confirmada') {
        pendentesLeituraConfirmada += 1;
        pendentesLiberados += 1;
      } else if (row.stage === 'pendente_aguardando') {
        pendentesLiberados += 1;
      } else {
        pendentesInternos += 1;
      }
    }
  }

  const totalActive = pendentes + assinados;
  const taxaAssinaturaPct = totalActive > 0 ? Math.round((assinados / totalActive) * 100) : 0;

  return {
    total: rows.length,
    totalActive,
    pendentes,
    pendentesLiberados,
    pendentesLeituraConfirmada,
    pendentesInternos,
    assinados,
    cancelados,
    taxaAssinaturaPct,
  };
}

export function filterContractSignatureRows(
  rows: ContractSignatureRow[],
  options: {
    statusFilter: ContractSignatureFilter;
    search?: string;
  },
): ContractSignatureRow[] {
  const q = (options.search || '').trim().toLowerCase();
  return rows.filter((row) => {
    if (options.statusFilter === 'pendentes' && !row.isPending) return false;
    if (options.statusFilter === 'assinados' && !row.isSigned) return false;
    if (options.statusFilter === 'cancelados' && !row.isCanceled) return false;

    if (!q) return true;
    return (
      row.clientName.toLowerCase().includes(q) ||
      row.clientEmail.toLowerCase().includes(q) ||
      row.doc.titulo.toLowerCase().includes(q) ||
      (row.doc.codigoVerificacao || '').toLowerCase().includes(q) ||
      row.caseTitle.toLowerCase().includes(q)
    );
  });
}

export function buildContractReminderWhatsAppMessage(row: ContractSignatureRow, empresaName: string): string {
  const firstName = row.clientName.split(' ')[0] || 'cliente';
  const codigo = row.doc.codigoVerificacao ? ` (código ${row.doc.codigoVerificacao})` : '';
  return (
    `Olá, ${firstName}! Aqui é da equipe ${empresaName}. ` +
    `O documento "${row.doc.titulo}"${codigo} já está disponível no seu Portal do Cliente aguardando sua assinatura eletrônica. ` +
    `Assim que finalizar a assinatura, avançamos imediatamente para a próxima etapa do seu processo. Qualquer dúvida, estamos à disposição!`
  );
}
