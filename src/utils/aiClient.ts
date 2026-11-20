/**
 * Client-side helpers for AI endpoint calls:
 * - Portuguese error sanitization (never displays raw JSON or English stack errors)
 * - Short-lived local cache (30 min TTL) for generated drafts per case/diagnosis
 */

export const CLIENT_MSG_AI_HIGH_DEMAND =
  'O serviço de IA está com alta demanda. Tentamos novamente automaticamente; se não responder, geramos um rascunho pelas regras. Você pode tentar de novo em instantes.';
export const CLIENT_MSG_AI_GENERIC_ERROR =
  'Não foi possível gerar o rascunho agora. Seus dados foram mantidos.';

export interface AiResponseMeta {
  rascunho?: boolean;
  estimativa?: boolean;
  fallback?: boolean;
  origem?: 'principal' | 'reserva' | 'regras';
  origemLabel?: string;
  modeloUsado?: string;
  tentativas?: number;
  mensagemUsuario?: string;
}

const SAFE_PT_MESSAGES = [
  'Faça login com sua conta Google',
  'Autenticação obrigatória',
  'Sessão inválida',
  'E-mail não verificado',
  'Usuário inativo',
  'Seu papel de acesso',
  'Carga de dados do diagnóstico excede',
  'Dados do diagnóstico incompletos',
  'Limite temporário de requisições',
  'Já existe uma solicitação de IA em andamento',
  'Modo de regras locais ativo',
  'Chave de IA inválida',
  'Modelo de IA indisponível',
  'Conteúdo bloqueado pelos filtros',
  'A solicitação de IA não pôde ser processada',
  'Os dados ou arquivo enviados excedem',
  'Arquivo ou payload excede',
  'Tempo limite excedido',
  'Falha de conexão com o servidor',
  'Informe a norma atual',
  'Formato JSON inválido',
  'Falha interna ao processar',
  'Rota de API não encontrada',
  CLIENT_MSG_AI_HIGH_DEMAND,
  CLIENT_MSG_AI_GENERIC_ERROR,
];

export function sanitizeClientAiError(raw: unknown): string {
  const text =
    raw instanceof Error
      ? raw.message
      : typeof raw === 'string'
        ? raw
        : raw && typeof raw === 'object' && 'error' in raw && typeof (raw as { error?: unknown }).error === 'string'
          ? ((raw as { error: string }).error || '')
          : JSON.stringify(raw || '');

  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Check for high-demand / 503 / 429 first — never expose raw JSON
  if (
    lower.includes('503') ||
    lower.includes('429') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('resource_exhausted') ||
    lower.includes('overloaded') ||
    lower.includes('alta demanda')
  ) {
    return CLIENT_MSG_AI_HIGH_DEMAND;
  }

  // Only pass through already-vetted Portuguese messages that don't look like raw JSON
  if (
    trimmed &&
    !trimmed.startsWith('{') &&
    !trimmed.startsWith('[') &&
    SAFE_PT_MESSAGES.some((prefix) => trimmed.includes(prefix))
  ) {
    return trimmed;
  }

  return CLIENT_MSG_AI_GENERIC_ERROR;
}

// =============================================================================
// Lightweight AI Payload Compactors (prevents 413 / large prompt bloat on Vercel)
// =============================================================================
export interface CompactLegalSourceInput {
  id?: string;
  titulo?: string;
  numeroAno?: string;
  pais?: string;
  artigos?: string;
  resumoPortugues?: string;
  explicacaoSimples?: string;
  linkOficial?: string;
}

export function compactSourceForAi(source: CompactLegalSourceInput | null | undefined) {
  if (!source) return {};
  return {
    id: source.id || '',
    titulo: String(source.titulo || '').slice(0, 180),
    numeroAno: String(source.numeroAno || '').slice(0, 80),
    pais: source.pais || 'Chile',
    artigos: String(source.artigos || '').slice(0, 500),
    resumoPortugues: String(source.resumoPortugues || source.explicacaoSimples || '').slice(0, 900),
    linkOficial: String(source.linkOficial || '').slice(0, 300),
  };
}

export function compactLegalSourcesForAi(sources: CompactLegalSourceInput[] | undefined, maxItems = 15) {
  if (!Array.isArray(sources)) return [];
  return sources.slice(0, maxItems).map((s) => ({
    titulo: String(s.titulo || '').slice(0, 140),
    numeroAno: String(s.numeroAno || '').slice(0, 60),
    artigos: String(s.artigos || '').slice(0, 220),
    resumoPortugues: String(s.resumoPortugues || s.explicacaoSimples || '').slice(0, 380),
  }));
}

export function compactCaseForAi(caseData: Record<string, unknown> | null | undefined) {
  if (!caseData) return {};
  return {
    id: caseData.id,
    titulo: caseData.titulo,
    tipoServico: caseData.tipoServico,
    subcategoria: caseData.subcategoria,
    statusPipeline: caseData.statusPipeline,
    statusSermig: caseData.statusSermig,
    localSolicitacao: caseData.localSolicitacao,
    notaViabilidadeGeral: caseData.notaViabilidadeGeral,
    observacoes: typeof caseData.observacoes === 'string' ? caseData.observacoes.slice(0, 800) : '',
  };
}

export function compactClientForAi(clientData: Record<string, unknown> | null | undefined) {
  if (!clientData) return {};
  return {
    localizacaoAtual: clientData.localizacaoAtual,
    situacaoMigratoriaAtual: clientData.situacaoMigratoriaAtual,
    motivoMudanca: clientData.motivoMudanca,
    prazoDesejado: clientData.prazoDesejado,
    profissao: clientData.profissao,
    possuiFilhosMenores: clientData.possuiFilhosMenores,
    quantidadeDependentes: clientData.quantidadeDependentes,
    antecedentesCriminais: clientData.antecedentesCriminais,
    restricaoEntrada: clientData.restricaoEntrada,
    validadePassaporte: clientData.validadePassaporte,
  };
}

// =============================================================================
// Short-lived cache (30 min TTL) for generated AI/rule drafts
// =============================================================================
const CACHE_PREFIX = 'dm_integra_ai_cache_v1_';
const DEFAULT_TTL_MS = 30 * 60 * 1000;

interface CachedEntry<T> {
  savedAt: number;
  expiresAt: number;
  data: T;
}

export function saveAiDraftCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  if (!key || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const entry: CachedEntry<T> = {
      savedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      data,
    };
    window.localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch {
    // ignore quota errors
  }
}

export function loadAiDraftCache<T>(key: string): T | null {
  if (!key || typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

export function clearAiDraftCache(key: string): void {
  if (!key || typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch {
    // ignore
  }
}
