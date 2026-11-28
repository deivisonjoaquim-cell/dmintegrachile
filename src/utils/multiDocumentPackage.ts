import type {
  Case,
  Client,
  CurrencyCode,
  Dependent,
  DocumentTemplate,
  EmpresaConfig,
  GeneratedDocument,
} from '../types/domain';
import { insertContractClausesBeforeClosing } from './contractDocumentLayout';
import {
  applyTemplateVariables,
  formatCurrency,
  formatDateBR,
  generateVerificationCode,
  valorPorExtenso,
} from './formatters';
import { CONSULTANCY_PLANS, normalizePaidModality } from './portalAccess';

export interface SignatureDocTypeMeta {
  tipo: string;
  shortLabel: string;
  pluralLabel: string;
  actionLabel: string;
  viewSignedLabel: string;
  financial: boolean;
  requiresFormalSignature: boolean;
}

export const SIGNATURE_DOC_TYPE_MAP: Record<string, SignatureDocTypeMeta> = {
  contrato: {
    tipo: 'contrato',
    shortLabel: 'Contrato',
    pluralLabel: 'Contratos',
    actionLabel: 'Ler, Aprovar e Assinar Contrato',
    viewSignedLabel: 'Ver Contrato & Certificado',
    financial: true,
    requiresFormalSignature: true,
  },
  recibo: {
    tipo: 'recibo',
    shortLabel: 'Recibo',
    pluralLabel: 'Recibos',
    actionLabel: 'Aprovar e Assinar Recibo',
    viewSignedLabel: 'Ver Recibo & Certificado',
    financial: true,
    requiresFormalSignature: true,
  },
  orcamento: {
    tipo: 'orcamento',
    shortLabel: 'Orçamento',
    pluralLabel: 'Orçamentos',
    actionLabel: 'Aprovar e Assinar Orçamento',
    viewSignedLabel: 'Ver Orçamento Aprovado',
    financial: true,
    requiresFormalSignature: true,
  },
  aditivo: {
    tipo: 'aditivo',
    shortLabel: 'Aditivo',
    pluralLabel: 'Aditivos',
    actionLabel: 'Ler, Aprovar e Assinar Aditivo',
    viewSignedLabel: 'Ver Aditivo & Certificado',
    financial: true,
    requiresFormalSignature: true,
  },
  procuracao: {
    tipo: 'procuracao',
    shortLabel: 'Procuração',
    pluralLabel: 'Procurações',
    actionLabel: 'Ler e Assinar Procuração',
    viewSignedLabel: 'Ver Procuração & Certificado',
    financial: false,
    requiresFormalSignature: true,
  },
  termo_ciencia: {
    tipo: 'termo_ciencia',
    shortLabel: 'Termo SERMIG',
    pluralLabel: 'Termos de Ciência',
    actionLabel: 'Aprovar e Assinar Termo',
    viewSignedLabel: 'Ver Termo & Certificado',
    financial: false,
    requiresFormalSignature: true,
  },
  termo_lgpd: {
    tipo: 'termo_lgpd',
    shortLabel: 'Termo LGPD',
    pluralLabel: 'Termos LGPD',
    actionLabel: 'Aprovar e Assinar Termo LGPD',
    viewSignedLabel: 'Ver Termo LGPD & Certificado',
    financial: false,
    requiresFormalSignature: true,
  },
  termo_encerramento: {
    tipo: 'termo_encerramento',
    shortLabel: 'Termo de Quitação',
    pluralLabel: 'Termos de Encerramento',
    actionLabel: 'Aprovar e Assinar Quitação',
    viewSignedLabel: 'Ver Quitação & Certificado',
    financial: true,
    requiresFormalSignature: true,
  },
  declaracao_residencia: {
    tipo: 'declaracao_residencia',
    shortLabel: 'Declaração',
    pluralLabel: 'Declarações',
    actionLabel: 'Revisar e Assinar Declaração',
    viewSignedLabel: 'Ver Declaração & Certificado',
    financial: false,
    requiresFormalSignature: true,
  },
  carta_apresentacao: {
    tipo: 'carta_apresentacao',
    shortLabel: 'Carta SERMIG',
    pluralLabel: 'Cartas de Apresentação',
    actionLabel: 'Aprovar e Assinar Carta',
    viewSignedLabel: 'Ver Carta & Certificado',
    financial: false,
    requiresFormalSignature: true,
  },
  relacao_priorizada: {
    tipo: 'relacao_priorizada',
    shortLabel: 'Relação Documental',
    pluralLabel: 'Relações Documentais',
    actionLabel: 'Confirmar e Assinar Ciência',
    viewSignedLabel: 'Ver Relação Confirmada',
    financial: false,
    requiresFormalSignature: false,
  },
  notificacao_pendencia: {
    tipo: 'notificacao_pendencia',
    shortLabel: 'Notificação',
    pluralLabel: 'Notificações',
    actionLabel: 'Confirmar Ciência e Assinar',
    viewSignedLabel: 'Ver Notificação Confirmada',
    financial: false,
    requiresFormalSignature: false,
  },
  checklist_personalizado: {
    tipo: 'checklist_personalizado',
    shortLabel: 'Checklist',
    pluralLabel: 'Checklists',
    actionLabel: 'Aprovar e Assinar Checklist',
    viewSignedLabel: 'Ver Checklist Aprovado',
    financial: false,
    requiresFormalSignature: false,
  },
  documento_personalizado: {
    tipo: 'documento_personalizado',
    shortLabel: 'Documento Oficial',
    pluralLabel: 'Documentos Personalizados',
    actionLabel: 'Ler, Aprovar e Assinar',
    viewSignedLabel: 'Ver Documento & Certificado',
    financial: false,
    requiresFormalSignature: true,
  },
};

export function getSignatureDocTypeMeta(tipo?: string | null): SignatureDocTypeMeta {
  const key = (tipo || '').trim().toLowerCase();
  if (key && SIGNATURE_DOC_TYPE_MAP[key]) {
    return SIGNATURE_DOC_TYPE_MAP[key];
  }
  return SIGNATURE_DOC_TYPE_MAP.documento_personalizado;
}

export type DocumentTypeFilterGroup =
  | 'todos'
  | 'contrato'
  | 'recibo'
  | 'termos_procuracao'
  | 'orcamento_aditivo'
  | 'outros';

export function matchesDocumentTypeGroup(tipo: string | undefined, group: DocumentTypeFilterGroup): boolean {
  if (group === 'todos') return true;
  const t = (tipo || '').trim().toLowerCase();
  if (group === 'contrato') return t === 'contrato';
  if (group === 'recibo') return t === 'recibo';
  if (group === 'termos_procuracao') {
    return t === 'procuracao' || t === 'termo_ciencia' || t === 'termo_lgpd' || t === 'termo_encerramento';
  }
  if (group === 'orcamento_aditivo') {
    return t === 'orcamento' || t === 'aditivo';
  }
  return (
    t !== 'contrato' &&
    t !== 'recibo' &&
    t !== 'procuracao' &&
    t !== 'termo_ciencia' &&
    t !== 'termo_lgpd' &&
    t !== 'termo_encerramento' &&
    t !== 'orcamento' &&
    t !== 'aditivo'
  );
}

export interface SignaturePackagePreset {
  id: string;
  nome: string;
  descricao: string;
  templateIds: string[];
}

export const SIGNATURE_PACKAGE_PRESETS: SignaturePackagePreset[] = [
  {
    id: 'kit_inicio',
    nome: 'Kit Início de Assessoria',
    descricao: 'Contrato + Recibo Oficial + Termo SERMIG + Termo LGPD',
    templateIds: ['doc_contrato', 'doc_recibo', 'doc_termo_sermig', 'doc_termo_lgpd'],
  },
  {
    id: 'kit_completo',
    nome: 'Kit Completo + Procuração',
    descricao: 'Contrato + Recibo + Procuração Operacional + Termo SERMIG + LGPD',
    templateIds: ['doc_contrato', 'doc_recibo', 'doc_procuracao_simples', 'doc_termo_sermig', 'doc_termo_lgpd'],
  },
  {
    id: 'kit_financeiro',
    nome: 'Kit Proposta & Fechamento',
    descricao: 'Orçamento Oficial + Contrato + Recibo de Pagamento',
    templateIds: ['doc_orcamento', 'doc_contrato', 'doc_recibo'],
  },
  {
    id: 'kit_aditivo',
    nome: 'Kit Aditivo + Recibo',
    descricao: 'Aditivo Contratual de Escopo + Recibo Oficial complementar',
    templateIds: ['doc_aditivo', 'doc_recibo'],
  },
];

export interface PackageDraftItem {
  key: string;
  templateId?: string;
  tipo: string;
  titulo: string;
  conteudoHtml: string;
  financeiro: boolean;
  isCustom?: boolean;
}

export function renderTemplateForClient(params: {
  template: DocumentTemplate;
  empresa: EmpresaConfig;
  client: Client;
  caseItem?: Case | null;
  dependents?: Dependent[];
  valorNumerico: number;
  moeda: CurrencyCode;
  formaPagamento: string;
  reciboNumero?: string;
  descricaoPagamento?: string;
  incluirDependentes?: boolean;
  incluirParcelamento?: boolean;
  incluirTaxasTerceiros?: boolean;
  now?: Date;
}): { titulo: string; conteudoHtml: string; financeiro: boolean } {
  const {
    template,
    empresa,
    client,
    caseItem,
    dependents = [],
    valorNumerico,
    moeda,
    formaPagamento,
    reciboNumero,
    descricaoPagamento,
    incluirDependentes = true,
    incluirParcelamento = true,
    incluirTaxasTerceiros = true,
    now = new Date(),
  } = params;

  const valorFmt = `${formatCurrency(valorNumerico, moeda)} (${valorPorExtenso(valorNumerico, moeda)})`;
  const baseText =
    template.id === 'doc_contrato' && empresa.textoContratoPadrao
      ? empresa.textoContratoPadrao
      : template.id === 'doc_recibo' && empresa.textoReciboPadrao
        ? `RECIBO OFICIAL Nº ${reciboNumero || 'REC-AUTO'}\n\n${empresa.textoReciboPadrao}\n\nMeio de pagamento: {{forma_pagamento}}\nDistinção: Valores de honorários e eventuais reembolsos de taxas conforme discriminado.\n\n{{empresa_endereco}}, {{data_atual}}.\n\n{{empresa_responsavel}} — Marca {{empresa_nome}}\n{{empresa_doc}}`
        : template.conteudoHtml;

  let filled = applyTemplateVariables(baseText, {
    empresa_nome: empresa.nome_empresa,
    empresa_doc: empresa.razao_social_cnpj_rut,
    empresa_endereco: empresa.endereco_cidade,
    empresa_responsavel: empresa.responsavel_tecnico,
    foro_comarca: empresa.foro_comarca,
    cliente_nome: client.nomeCompleto || '[preencher nome completo]',
    cliente_nacionalidade: client.nacionalidade || 'Brasileira',
    cliente_estado_civil: client.estadoCivil || 'Não informado',
    cliente_profissao: client.profissao || 'Não informada',
    cliente_cpf: client.cpf || '[preencher CPF]',
    cliente_passaporte: client.passaporte?.numero || 'A confirmar',
    cliente_endereco: client.enderecoCompleto || 'Endereço conforme cadastro no Portal',
    cliente_email: client.email || '',
    cliente_whatsapp: client.whatsapp || '',
    objeto_servico: caseItem?.titulo || 'Assessoria Migratória para Visto e RUT no Chile',
    valor_contrato: valorFmt,
    forma_pagamento: formaPagamento,
    descricao_pagamento: descricaoPagamento || 'Honorários de Assessoria Migratória (Visto e RUT)',
    valor_pago: valorFmt,
    caso_titulo: caseItem?.titulo || 'Processo Migratório Chile',
    data_atual: formatDateBR(now),
  });

  if (template.tipo === 'contrato') {
    const modality = normalizePaidModality(client.modalidadeConsultoria || caseItem?.modalidadeConsultoria);
    const modalitySpec = CONSULTANCY_PLANS[modality];
    const extras: string[] = [
      modality === 'orientativa'
        ? `CLÁUSULA DE MODALIDADE – CONSULTORIA ORIENTATIVA\nFica expressamente ajustado que o presente contrato refere-se à modalidade ${modalitySpec.nome}. Caberá à CONTRATADA fornecer diagnóstico técnico, checklist personalizado na ordem de validade, conferência prévia dos documentos enviados no Portal e orientação passo a passo por reunião/chat. O protocolo oficial no sistema do SERMIG (Servicio Nacional de Migraciones) e o acompanhamento direto das notificações oficiais serão realizados pelo próprio CONTRATANTE.`
        : `CLÁUSULA DE MODALIDADE – CONSULTORIA COMPLETA (GESTÃO INTEGRAL)\nFica expressamente ajustado que o presente contrato refere-se à modalidade ${modalitySpec.nome}. Caberá à CONTRATADA conduzir integralmente a organização do dossiê, conferência documental, realização do protocolo oficial junto ao SERMIG, monitoramento de prazos e eventuais requerimentos oficiais, além das orientações pós-aprovação (Estampado Eletrônico e Cédula / RUT).`,
    ];

    if (incluirDependentes && dependents.length > 0) {
      extras.push(
        `CLÁUSULA ADICIONAL – DEPENDENTES VINCULADOS\nIncluem-se no escopo operacional os seguintes dependentes familiares: ${dependents
          .map((d) => `${d.nomeCompleto} (${d.parentesco})`)
          .join('; ')}.`,
      );
    }
    if (incluirParcelamento) {
      extras.push(
        `CLÁUSULA ADICIONAL – CONDIÇÕES DE PARCELAMENTO\nForma ajustada: ${formaPagamento}. O atraso superior a 10 dias suspende o protocolo até regularização financeira.`,
      );
    }
    if (incluirTaxasTerceiros) {
      extras.push(
        `CLÁUSULA ADICIONAL – TAXAS OFICIAIS E TERCEIROS\nTaxas governamentais do SERMIG, Registro Civil (Cédula / RUT), Apostila de Haia (CNJ) e traduções juramentadas correm por conta direta do CONTRATANTE. Moradia não é serviço garantido; eventuais indicações de parceiros imobiliários ou especialistas são independentes.`,
      );
    }
    filled = insertContractClausesBeforeClosing(filled, extras);
  }

  const meta = getSignatureDocTypeMeta(template.tipo);
  const title =
    template.tipo === 'recibo' && reciboNumero
      ? `Recibo Oficial ${reciboNumero} — ${client.nomeCompleto}`
      : template.titulo;

  return {
    titulo: title,
    conteudoHtml: filled,
    financeiro: meta.financial,
  };
}

export function findUnresolvedPlaceholders(items: Pick<PackageDraftItem, 'key' | 'titulo' | 'conteudoHtml'>[]): Array<{
  key: string;
  titulo: string;
  placeholders: string[];
}> {
  const issues: Array<{ key: string; titulo: string; placeholders: string[] }> = [];
  for (const item of items) {
    const matches = item.conteudoHtml.match(/\[preencher[^\]]*\]/gi) || [];
    const unique = Array.from(new Set(matches));
    if (unique.length > 0) {
      issues.push({
        key: item.key,
        titulo: item.titulo || 'Documento sem título',
        placeholders: unique,
      });
    }
  }
  return issues;
}

export function buildMultiDocumentBatchRecords(params: {
  items: PackageDraftItem[];
  clientId: string;
  caseId?: string;
  autorNome: string;
  liberadoAoCliente: boolean;
  status?: GeneratedDocument['status'];
  idFactory?: (prefix: string) => string;
  nowIso?: string;
}): GeneratedDocument[] {
  const {
    items,
    clientId,
    caseId,
    autorNome,
    liberadoAoCliente,
    status = liberadoAoCliente ? 'Enviado' : 'Rascunho',
    idFactory = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nowIso = new Date().toISOString(),
  } = params;

  return items
    .filter((item) => item.titulo.trim().length > 0 && item.conteudoHtml.trim().length > 0)
    .map((item) => {
      const id = idFactory('gdoc');
      const code = generateVerificationCode(item.tipo === 'recibo' ? 'REC' : 'DOC');
      return {
        id,
        tipo: item.tipo.trim().slice(0, 80) || 'documento_personalizado',
        titulo: item.titulo.trim().slice(0, 250),
        clientId,
        caseId: caseId || undefined,
        conteudoHtml: item.conteudoHtml,
        versao: 1,
        status,
        codigoVerificacao: code,
        historicoVersoes: [],
        liberadoAoCliente,
        financeiro: Boolean(item.financeiro),
        autorNome: autorNome.trim() || 'Consultoria',
        createdAt: nowIso,
        updatedAt: nowIso,
      };
    });
}

export interface ClientSignatureQueueSummary {
  totalActive: number;
  signedCount: number;
  pendingCount: number;
  readConfirmedPendingCount: number;
  progressPct: number;
  pendingDocs: GeneratedDocument[];
  signedDocs: GeneratedDocument[];
  nextPendingDoc: GeneratedDocument | null;
  typeBreakdown: Array<{ tipo: string; label: string; total: number; pending: number; signed: number }>;
}

export function isGeneratedDocSigned(doc: GeneratedDocument): boolean {
  if (doc.canceladoEm) return false;
  return Boolean(
    doc.status === 'Assinado' ||
      (doc.assinadoEm && doc.assinadoEm.trim()) ||
      (doc.assinaturaDataUrl && doc.assinaturaDataUrl.trim()) ||
      (doc.assinaturaUrl && doc.assinaturaUrl.trim()),
  );
}

export function summarizeClientSignatureQueue(docs: GeneratedDocument[]): ClientSignatureQueueSummary {
  const active = docs.filter((d) => !d.canceladoEm);
  const signedDocs = active.filter((d) => isGeneratedDocSigned(d));
  const pendingDocs = active.filter((d) => !isGeneratedDocSigned(d));
  const readConfirmedPendingCount = pendingDocs.filter((d) => Boolean(d.confirmadoLeituraEm)).length;

  const totalActive = active.length;
  const signedCount = signedDocs.length;
  const pendingCount = pendingDocs.length;
  const progressPct = totalActive > 0 ? Math.round((signedCount / totalActive) * 100) : 0;

  const typeMap = new Map<string, { tipo: string; label: string; total: number; pending: number; signed: number }>();
  for (const doc of active) {
    const meta = getSignatureDocTypeMeta(doc.tipo);
    const existing = typeMap.get(meta.tipo) || {
      tipo: meta.tipo,
      label: meta.shortLabel,
      total: 0,
      pending: 0,
      signed: 0,
    };
    existing.total += 1;
    if (isGeneratedDocSigned(doc)) {
      existing.signed += 1;
    } else {
      existing.pending += 1;
    }
    typeMap.set(meta.tipo, existing);
  }

  return {
    totalActive,
    signedCount,
    pendingCount,
    readConfirmedPendingCount,
    progressPct,
    pendingDocs,
    signedDocs,
    nextPendingDoc: pendingDocs[0] || null,
    typeBreakdown: Array.from(typeMap.values()),
  };
}

export function buildMultiDocumentWhatsAppNotice(params: {
  clientName: string;
  empresaName: string;
  documents: Pick<GeneratedDocument, 'titulo' | 'tipo' | 'codigoVerificacao'>[];
}): string {
  const firstName = params.clientName.trim().split(' ')[0] || 'cliente';
  const count = params.documents.length;
  const listText = params.documents
    .map((d, idx) => `${idx + 1}. ${d.titulo}${d.codigoVerificacao ? ` (${d.codigoVerificacao})` : ''}`)
    .join('\n');

  if (count === 1) {
    return (
      `Olá, ${firstName}! Aqui é da equipe ${params.empresaName}.\n\n` +
      `Liberamos um documento oficial no seu Portal do Cliente para leitura, aprovação e assinatura eletrônica:\n` +
      `${listText}\n\n` +
      `Assim que concluir a assinatura no Portal, avançamos imediatamente para a próxima etapa do seu processo de Visto e RUT!`
    );
  }

  return (
    `Olá, ${firstName}! Aqui é da equipe ${params.empresaName}.\n\n` +
    `Liberamos ${count} documentos no seu Portal do Cliente para sua leitura, aprovação e assinatura eletrônica (processo de Visto e RUT):\n` +
    `${listText}\n\n` +
    `Você pode aprovar e assinar todos em sequência diretamente pelo Portal do Cliente. Qualquer dúvida, estamos à disposição!`
  );
}
