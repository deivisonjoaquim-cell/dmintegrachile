export type AdminLogOperationType = 'create' | 'update' | 'delete' | 'permission' | 'sensitive';

export interface AuditClassificationResult {
  tipoOperacao: AdminLogOperationType;
  sensivel: boolean;
  resumo: string;
}

const ENTITY_LABELS: Record<string, string> = {
  users: 'Usuário / Equipe',
  config: 'Configuração Institucional',
  siteContent: 'Conteúdo do Site (CMS)',
  mediaAssets: 'Biblioteca de Mídias',
  clients: 'Cliente',
  cases: 'Caso / Processo',
  caseFinancials: 'Financeiro do Caso',
  caseDocuments: 'Documento do Caso',
  dependents: 'Dependente',
  leads: 'Lead',
  tasks: 'Tarefa',
  deadlines: 'Prazo',
  appointments: 'Reunião / Agenda',
  communicationLogs: 'Comunicação',
  viabilityAssessments: 'Parecer de Viabilidade',
  budgets: 'Orçamento',
  financialRecords: 'Lançamento Financeiro',
  generatedDocuments: 'Documento Gerado',
  partners: 'Parceiro',
  partnersPublic: 'Parceiro Público',
  partnerProposals: 'Proposta de Parceiro',
  legalSources: 'Fonte Legal',
  visaCategories: 'Categoria de Visto',
  visaRequirements: 'Requisito de Visto',
  messageTemplates: 'Modelo de Mensagem',
  documentTemplates: 'Modelo de Documento',
  diagnosticRuleVersions: 'Regras de Diagnóstico',
  clientNotifications: 'Notificação do Cliente',
};

const SENSITIVE_ENTITIES = new Set([
  'users',
  'config',
  'caseFinancials',
  'financialRecords',
  'budgets',
]);

const PERMISSION_KEYWORDS = [
  'permiss',
  'role',
  'papel',
  'portal_liberado',
  'liberar_portal',
  'bloquear_portal',
  'status_acesso',
  'acesso_portal',
  'equipe_role',
  'equipe_status',
  'alterar_permissao',
];

const SENSITIVE_KEYWORDS = [
  'bancario',
  'banco',
  'pix',
  'cpf',
  'passaporte',
  'lgpd',
  'anonimiz',
  'sensivel',
  'sensível',
  'excluir_cliente',
  'excluir_caso',
  'vapid',
  'contrato',
  'honorario',
  'valorcontrato',
];

export function formatEntityLabel(entidade: string): string {
  return ENTITY_LABELS[entidade] || entidade || 'Sistema';
}

export function classifyAdminAuditAction(params: {
  acao: string;
  entidade: string;
  entidadeId: string;
  campo?: string;
}): AuditClassificationResult {
  const acaoNorm = (params.acao || '').trim().toLowerCase();
  const entidadeNorm = (params.entidade || '').trim();
  const campoNorm = (params.campo || '').trim().toLowerCase();
  const combined = `${acaoNorm} ${entidadeNorm.toLowerCase()} ${campoNorm}`;

  const isDelete =
    acaoNorm.includes('excluir') ||
    acaoNorm.includes('delet') ||
    acaoNorm.includes('remov') ||
    campoNorm.includes('exclu');

  const isCreate =
    acaoNorm.startsWith('criar') ||
    acaoNorm.startsWith('criaç') ||
    acaoNorm.includes('create') ||
    acaoNorm.includes('novo') ||
    acaoNorm.includes('import');

  const isPermissionChange =
    PERMISSION_KEYWORDS.some((kw) => combined.includes(kw)) ||
    (entidadeNorm === 'users' && (campoNorm.includes('role') || campoNorm.includes('status') || campoNorm.includes('equipe') || campoNorm.includes('permiss')));

  const isSensitiveEntity = SENSITIVE_ENTITIES.has(entidadeNorm);
  const isSensitiveKeyword = SENSITIVE_KEYWORDS.some((kw) => combined.includes(kw));

  const sensivel = Boolean(
    isPermissionChange ||
      isDelete ||
      isSensitiveEntity ||
      isSensitiveKeyword ||
      (entidadeNorm === 'clients' && (campoNorm.includes('portal') || campoNorm.includes('modalidade'))),
  );

  let tipoOperacao: AdminLogOperationType = 'update';
  if (isPermissionChange) {
    tipoOperacao = 'permission';
  } else if (isDelete) {
    tipoOperacao = 'delete';
  } else if (isCreate) {
    tipoOperacao = 'create';
  } else if (isSensitiveKeyword || (entidadeNorm === 'config' && params.entidadeId === 'bancario')) {
    tipoOperacao = 'sensitive';
  }

  const entityLabel = formatEntityLabel(entidadeNorm);
  const campoClean = (params.campo || '').trim();
  const resumoBase = `${params.acao || 'Atualizar'} · ${entityLabel} (${params.entidadeId || 'geral'})`;
  const resumo = (campoClean && campoClean !== 'geral' ? `${resumoBase} — ${campoClean}` : resumoBase).slice(0, 500);

  return {
    tipoOperacao,
    sensivel,
    resumo,
  };
}
