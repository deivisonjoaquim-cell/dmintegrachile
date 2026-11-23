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
  'Rascunho estruturado pelas regras',
  'Modo de regras locais ativo',
  'Não foi possível autenticar no serviço de IA',
  'Chave de IA inválida',
  'Modelo de IA indisponível',
  'Conteúdo bloqueado pelos filtros',
  'A solicitação de IA não pôde ser processada',
  'Os dados ou arquivo enviados excedem',
  'Arquivo ou payload excede',
  'O anexo excede o limite de',
  'Tempo limite excedido',
  'Falha de conexão com o servidor',
  'Informe a norma atual',
  'Formato JSON inválido',
  'Falha interna ao processar',
  'Rota de API não encontrada',
  CLIENT_MSG_AI_HIGH_DEMAND,
  CLIENT_MSG_AI_GENERIC_ERROR,
];

export interface AiEngineHealthInfo {
  ok: boolean;
  geminiConfigured: boolean;
  cloudAiConfigured?: boolean;
  activeProvider?: 'gemini' | 'groq' | 'openrouter' | 'local_rules';
  providers?: {
    gemini: boolean;
    groq: boolean;
    openrouter: boolean;
    localRules: boolean;
  };
  vercelHobbyOptimized?: boolean;
  mode: 'gemini_plus_rules' | 'rules_live_hybrid';
  primaryModel: string;
  fallbackModel: string;
  activeEngine: string;
  features?: string[];
}

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
// Vercel-Safe Attachment Encoder & Image Downscaler (keeps JSON < 4.5 MB limit)
// =============================================================================
export const AI_ATTACHMENT_MAX_BINARY_BYTES = 2_600_000;

export function estimateBase64DecodedBytes(base64: string): number {
  const clean = base64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!clean) return 0;
  let padding = 0;
  if (clean.endsWith('==')) padding = 2;
  else if (clean.endsWith('=')) padding = 1;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Falha ao ler arquivo selecionado.'));
    reader.readAsDataURL(blob);
  });
}

async function compressImageBlobIfNeeded(blob: Blob, maxDimension = 1600): Promise<{ dataUri: string; mimeType: string } | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao carregar imagem.'));
      el.src = objectUrl;
    });
    const maxSide = Math.max(img.width || 0, img.height || 0);
    if (maxSide <= 0) return null;
    const scale = maxSide > maxDimension ? maxDimension / maxSide : 1;
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));
    if (scale === 1 && blob.size <= 900_000) return null;

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const compressedUri = canvas.toDataURL('image/jpeg', 0.82);
    return { dataUri: compressedUri, mimeType: 'image/jpeg' };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function prepareAiAttachment(
  blob: Blob,
  options?: { maxBinaryBytes?: number; fallbackMimeType?: string },
): Promise<{ fileBase64: string; mimeType: string; sizeBytes: number }> {
  const maxBytes = options?.maxBinaryBytes ?? AI_ATTACHMENT_MAX_BINARY_BYTES;
  const rawType = (blob.type || options?.fallbackMimeType || 'application/pdf').toLowerCase();

  if (rawType === 'image/jpeg' || rawType === 'image/png' || rawType === 'image/webp') {
    const compressed = await compressImageBlobIfNeeded(blob);
    if (compressed) {
      const b64 = compressed.dataUri.split(',')[1] || '';
      const bytes = estimateBase64DecodedBytes(b64);
      if (bytes > maxBytes) {
        throw new Error('O anexo excede o limite de 2,6 MB para análise automatizada.');
      }
      return { fileBase64: b64, mimeType: compressed.mimeType, sizeBytes: bytes };
    }
  }

  if (blob.size > maxBytes) {
    throw new Error('O anexo excede o limite de 2,6 MB para análise automatizada.');
  }

  const dataUri = await readBlobAsDataUrl(blob);
  const parsed = /^data:([^;,]+);base64,(.+)$/i.exec(dataUri);
  const b64 = parsed ? parsed[2].replace(/\s+/g, '') : '';
  if (!b64) {
    throw new Error('Falha ao codificar anexo para análise.');
  }
  const bytes = estimateBase64DecodedBytes(b64);
  if (bytes > maxBytes) {
    throw new Error('O anexo excede o limite de 2,6 MB para análise automatizada.');
  }
  return {
    fileBase64: b64,
    mimeType: (parsed?.[1] || rawType).toLowerCase(),
    sizeBytes: bytes,
  };
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
  const passportObj =
    clientData.passaporte && typeof clientData.passaporte === 'object'
      ? (clientData.passaporte as Record<string, unknown>)
      : null;
  return {
    nacionalidade: clientData.nacionalidade,
    localizacaoAtual: clientData.localizacaoAtual,
    situacaoMigratoriaAtual: clientData.situacaoMigratoriaAtual,
    motivoMudanca: clientData.motivoMudanca,
    prazoDesejado: clientData.prazoDesejado,
    profissao: clientData.profissao,
    possuiFilhosMenores: clientData.possuiFilhosMenores,
    quantidadeDependentes: clientData.quantidadeDependentes,
    antecedentesCriminais: clientData.antecedentesCriminais,
    restricaoEntrada: clientData.restricaoEntrada,
    validadePassaporte: clientData.validadePassaporte ?? passportObj?.validade,
  };
}

export function compactDependentsForAi(dependents: Array<Record<string, unknown>> | undefined, maxItems = 12) {
  if (!Array.isArray(dependents)) return [];
  return dependents.slice(0, maxItems).map((d) => ({
    parentesco: d.parentesco,
    idade: d.idade,
    estudante: d.estudante,
    passaporteValidade: d.passaporteValidade,
  }));
}

export function compactProposalForAi(proposal: Record<string, unknown> | null | undefined) {
  if (!proposal) return {};
  return {
    id: proposal.id,
    nome_empresa: typeof proposal.nome_empresa === 'string' ? proposal.nome_empresa.slice(0, 200) : '',
    categoria: typeof proposal.categoria === 'string' ? proposal.categoria.slice(0, 100) : '',
    pais: typeof proposal.pais === 'string' ? proposal.pais.slice(0, 60) : '',
    cidade: typeof proposal.cidade === 'string' ? proposal.cidade.slice(0, 120) : '',
    responsavel: typeof proposal.responsavel === 'string' ? proposal.responsavel.slice(0, 120) : '',
    moeda: typeof proposal.moeda === 'string' ? proposal.moeda.slice(0, 20) : '',
    proposta: typeof proposal.proposta === 'string' ? proposal.proposta.slice(0, 2400) : '',
    mensagem: typeof proposal.mensagem === 'string' ? proposal.mensagem.slice(0, 2400) : '',
    status: typeof proposal.status === 'string' ? proposal.status.slice(0, 40) : '',
  };
}

// =============================================================================
// Short-lived cache (30 min TTL) for generated AI/rule drafts
// =============================================================================
const CACHE_PREFIX = 'dm_integra_ai_cache_v2_';
const DEFAULT_TTL_MS = 30 * 60 * 1000;

interface CachedEntry<T> {
  savedAt: number;
  expiresAt: number;
  data: T;
}

function isStaleMissingKeyFallback(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const meta = data as AiResponseMeta;
  if (meta.fallback !== true) return false;
  const msg = typeof meta.mensagemUsuario === 'string' ? meta.mensagemUsuario.toLowerCase() : '';
  return (
    msg.includes('modo de regras locais ativo') ||
    msg.includes('rascunho estruturado pelas regras') ||
    (msg.includes('chave') && msg.includes('não está configurada'))
  );
}

export function saveAiDraftCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  if (!key || typeof window === 'undefined' || !window.localStorage) return;
  if (isStaleMissingKeyFallback(data)) {
    clearAiDraftCache(key);
    return;
  }
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
    if (isStaleMissingKeyFallback(parsed.data)) {
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
