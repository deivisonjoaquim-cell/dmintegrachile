import type {
  Client,
  DiagnosticConfidence,
  DiagnosticSession,
  Lead,
  LeadTemperature,
} from '../types/domain';

const ALLOWED_ORIGEM = new Set<Lead['origem']>([
  'Instagram',
  'Indicação',
  'Site',
  'Parceiro',
  'Outro',
]);

const ALLOWED_STATUS_FUNIL = new Set<Lead['statusFunil']>([
  'Novo',
  'Contatado',
  'Diagnóstico Agendado',
  'Orçamento Enviado',
  'Fechado',
  'Perdido',
]);

const ALLOWED_PORTAL_STATUS = new Set<Client['statusAcessoPortal']>([
  'Não solicitado',
  'Pendente liberação',
  'Liberado',
]);

const ALLOWED_CONFIANCA = new Set<DiagnosticConfidence>(['Alta', 'Média', 'Baixa']);
const ALLOWED_TEMPERATURA = new Set<LeadTemperature>(['Quente', 'Morno', 'Frio']);
const ALLOWED_CONCLUSAO = new Set<NonNullable<Lead['statusConclusao']>>([
  'Em andamento',
  'Concluído',
  'Abandonado',
]);

export function stripUndefinedDeep<T>(val: T): T {
  if (Array.isArray(val)) {
    return val.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (val !== null && typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return val;
}

function clampStr(val: unknown, maxLen: number): string {
  return String(val ?? '').trim().slice(0, maxLen);
}

/**
 * Sanitizes and validates a Client document strictly against firebase-blueprint.json & firestore.rules.
 */
export function sanitizeClientPayload(
  input: Partial<Client> & { id: string },
  options: { isNew: boolean },
): Client {
  const now = new Date().toISOString();
  const nomeCompleto = clampStr(input.nomeCompleto, 200);
  const email = clampStr(input.email, 200).toLowerCase();
  const whatsapp = clampStr(input.whatsapp, 40);

  if (nomeCompleto.length < 2) {
    throw new Error('O nome completo do cliente deve ter pelo menos 2 caracteres.');
  }
  if (email.length < 5 || !email.includes('@')) {
    throw new Error('Informe um e-mail válido para o cliente.');
  }
  if (whatsapp.length < 6) {
    throw new Error('Informe um WhatsApp válido para o cliente.');
  }

  const statusAcessoPortal: Client['statusAcessoPortal'] = ALLOWED_PORTAL_STATUS.has(
    input.statusAcessoPortal as Client['statusAcessoPortal'],
  )
    ? (input.statusAcessoPortal as Client['statusAcessoPortal'])
    : input.portalLiberado
      ? 'Liberado'
      : 'Não solicitado';

  const sanitized: Client = {
    ...input,
    id: clampStr(input.id, 128),
    nomeCompleto,
    cpf: clampStr(input.cpf, 20),
    email,
    whatsapp,
    portalLiberado: Boolean(input.portalLiberado),
    statusAcessoPortal,
    userId: input.userId ? clampStr(input.userId, 128) : undefined,
    observacoes: input.observacoes !== undefined ? String(input.observacoes).slice(0, 5000) : undefined,
    createdAt: options.isNew ? input.createdAt || now : input.createdAt || now,
    updatedAt: now,
  };

  return stripUndefinedDeep(sanitized);
}

/**
 * Sanitizes and validates a Diagnostic Lead document strictly against firebase-blueprint.json & firestore.rules.
 */
export function sanitizeDiagnosticLeadPayload(
  input: Partial<Lead> & { id: string },
  options: { isNew: boolean; forcePublicCreate?: boolean },
): Lead {
  const now = new Date().toISOString();
  const nome = clampStr(input.nome, 200);
  const whatsapp = clampStr(input.whatsapp, 40);
  const email = clampStr(input.email, 200).toLowerCase();

  if (nome.length < 2) {
    throw new Error('Informe o nome completo (mínimo 2 caracteres).');
  }
  if (whatsapp.length < 6) {
    throw new Error('Informe um WhatsApp válido (mínimo 6 dígitos).');
  }
  if (email.length < 5 || !email.includes('@')) {
    throw new Error('Informe um e-mail válido.');
  }

  const origem: Lead['origem'] = ALLOWED_ORIGEM.has(input.origem as Lead['origem'])
    ? (input.origem as Lead['origem'])
    : 'Site';

  const statusFunil: Lead['statusFunil'] = options.forcePublicCreate
    ? 'Novo'
    : ALLOWED_STATUS_FUNIL.has(input.statusFunil as Lead['statusFunil'])
      ? (input.statusFunil as Lead['statusFunil'])
      : 'Novo';

  const confianca =
    input.confianca && ALLOWED_CONFIANCA.has(input.confianca) ? input.confianca : undefined;
  const temperatura =
    input.temperatura && ALLOWED_TEMPERATURA.has(input.temperatura) ? input.temperatura : undefined;
  const statusConclusao =
    input.statusConclusao && ALLOWED_CONCLUSAO.has(input.statusConclusao)
      ? input.statusConclusao
      : undefined;

  const sanitized: Lead = {
    ...input,
    id: clampStr(input.id, 128),
    nome,
    whatsapp,
    email,
    cidadeUf: clampStr(input.cidadeUf, 150),
    origem,
    interesse: clampStr(input.interesse || 'Residência no Chile', 200),
    statusFunil,
    subcategoriaSugerida: input.subcategoriaSugerida
      ? clampStr(input.subcategoriaSugerida, 200)
      : undefined,
    notas: input.notas !== undefined ? String(input.notas).slice(0, 4000) : undefined,
    notaViabilidade:
      typeof input.notaViabilidade === 'number' && !Number.isNaN(input.notaViabilidade)
        ? Math.max(0, Math.min(100, input.notaViabilidade))
        : undefined,
    confianca,
    temperatura,
    versaoRegras: input.versaoRegras ? clampStr(input.versaoRegras, 80) : undefined,
    sessionToken: input.sessionToken ? clampStr(input.sessionToken, 128) : undefined,
    statusConclusao,
    etapaAtual:
      typeof input.etapaAtual === 'number' ? Math.max(1, Math.min(6, input.etapaAtual)) : undefined,
    utmSource: input.utmSource ? clampStr(input.utmSource, 120) : undefined,
    utmMedium: input.utmMedium ? clampStr(input.utmMedium, 120) : undefined,
    utmCampaign: input.utmCampaign ? clampStr(input.utmCampaign, 120) : undefined,
    primeiroContatoEm: input.primeiroContatoEm
      ? clampStr(input.primeiroContatoEm, 64)
      : undefined,
    prioridade: input.prioridade || 'Média',
    lgpdAceito: Boolean(input.lgpdAceito),
    lgpdVersao: clampStr(input.lgpdVersao || '1.0', 30),
    lgpdData: input.lgpdData || now,
    createdAt: options.isNew ? input.createdAt || now : input.createdAt || now,
    updatedAt: now,
  };

  return stripUndefinedDeep(sanitized);
}

/**
 * Sanitizes and validates a DiagnosticSession document strictly against firebase-blueprint.json & firestore.rules.
 */
export function sanitizeDiagnosticSessionPayload(
  token: string,
  payload: Omit<DiagnosticSession, 'id' | 'updatedAt' | 'createdAt'> & { createdAt?: string },
  isNew: boolean,
): Record<string, unknown> {
  const cleanToken = clampStr(token, 128);
  if (cleanToken.length < 20) {
    throw new Error('Token de sessão de diagnóstico inválido.');
  }
  const now = new Date().toISOString();
  const etapaAtual = Math.max(1, Math.min(6, Number(payload.etapaAtual) || 1));

  const session: DiagnosticSession = stripUndefinedDeep({
    id: cleanToken,
    etapaAtual,
    answers: payload.answers,
    concluido: Boolean(payload.concluido),
    leadId: payload.leadId ? clampStr(payload.leadId, 128) : '',
    expiraEmMs: Number(payload.expiraEmMs) || Date.now() + 14 * 86400000,
    utm: payload.utm,
    createdAt: payload.createdAt || now,
    updatedAt: now,
  });

  const out: Record<string, unknown> = { ...session };
  if (!isNew && !payload.createdAt) {
    delete out.createdAt;
  }
  return out;
}
