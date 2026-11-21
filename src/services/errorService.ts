export type AppErrorLevel = 'error' | 'warning' | 'info';

export type AppErrorCategory =
  | 'firebase-permission'
  | 'firebase-offline'
  | 'firebase-quota'
  | 'firebase-validation'
  | 'firebase-auth'
  | 'firebase-not-found'
  | 'network'
  | 'pdf'
  | 'unknown';

export interface AppErrorLogEntry {
  id: string;
  timestamp: string;
  level: AppErrorLevel;
  category: AppErrorCategory;
  title: string;
  message: string;
  actionHint?: string;
  source?: string;
  path?: string | null;
  operation?: string;
  rawError?: string;
}

export interface FriendlyErrorTranslation {
  category: AppErrorCategory;
  title: string;
  message: string;
  actionHint?: string;
  level: AppErrorLevel;
  path?: string | null;
  operation?: string;
  rawError: string;
}

type ErrorListener = (entries: AppErrorLogEntry[]) => void;

const MAX_ACTIVE_TOASTS = 4;
const MAX_LOG_HISTORY = 100;
const DEDUPE_WINDOW_MS = 4000;

let activeNotifications: AppErrorLogEntry[] = [];
const logHistory: AppErrorLogEntry[] = [];
const listeners = new Set<ErrorListener>();
const recentFingerprints = new Map<string, number>();

function makeErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function notifyListeners(): void {
  const snapshot = [...activeNotifications];
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // Nunca deixar um listener quebrar o fluxo principal
    }
  }
}

interface ParsedFirestoreJson {
  error?: string;
  operationType?: string;
  path?: string | null;
  authInfo?: {
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function tryParseFirestoreJson(raw: string): ParsedFirestoreJson | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(trimmed) as ParsedFirestoreJson;
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.error === 'string') {
      return parsed;
    }
  } catch {
    // not JSON
  }
  return null;
}

/**
 * Converte erros técnicos do Firebase, Firestore, Auth ou navegador em mensagens
 * amigáveis em português sem expor JSON bruto ao usuário final.
 */
export function translateAppError(
  error: unknown,
  context?: { source?: string; path?: string | null; operation?: string },
): FriendlyErrorTranslation {
  const initialMessage = error instanceof Error ? error.message : String(error ?? 'Erro desconhecido');
  const errorCode =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  const parsedJson = tryParseFirestoreJson(initialMessage);
  const effectiveRaw = parsedJson?.error || initialMessage;
  const effectivePath = context?.path ?? parsedJson?.path ?? null;
  const effectiveOp = context?.operation ?? parsedJson?.operationType;
  const activeEmail = parsedJson?.authInfo?.email || null;
  const lower = `${errorCode} ${effectiveRaw}`.toLowerCase();

  // 1. Firestore: campo undefined / argumento inválido
  if (
    lower.includes('unsupported field value: undefined') ||
    lower.includes('invalid-argument') ||
    lower.includes('function setdoc() called with invalid data') ||
    lower.includes('function updatedoc() called with invalid data')
  ) {
    return {
      category: 'firebase-validation',
      level: 'warning',
      title: 'Dados incompletos ao salvar',
      message: 'Alguns campos estavam vazios ou em formato incompatível e foram bloqueados antes do envio.',
      actionHint: 'Revise os campos obrigatórios do formulário e tente salvar novamente.',
      path: effectivePath,
      operation: effectiveOp,
      rawError: effectiveRaw,
    };
  }

  // 2. Cota diária do Firestore excedida
  if (lower.includes('quota exceeded') || lower.includes('resource-exhausted')) {
    return {
      category: 'firebase-quota',
      level: 'warning',
      title: 'Limite diário do banco de dados atingido',
      message: 'A cota gratuita de leituras/escritas do Firestore foi atingida no momento.',
      actionHint: 'Os dados já carregados continuam visíveis. Tente novamente após a renovação da cota.',
      path: effectivePath,
      operation: effectiveOp,
      rawError: effectiveRaw,
    };
  }

  // 3. Permissão negada (Firestore Rules / RBAC)
  if (
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions') ||
    lower.includes('insufficient permissions')
  ) {
    const resourceMap: Record<string, string> = {
      'config/empresa': 'Configurações da empresa',
      'config/bancario': 'Dados bancários',
      users: 'Usuários e equipe',
      clients: 'Cadastro de clientes',
      cases: 'Casos e processos',
      caseDocuments: 'Documentos do processo',
      caseFinancials: 'Financeiro do caso',
      leads: 'Leads e diagnósticos',
      siteContent: 'Conteúdo do site (CMS)',
      mediaAssets: 'Biblioteca de mídia',
      partners: 'Parceiros',
      partnersPublic: 'Parceiros públicos',
      legalSources: 'Base normativa',
      visaCategories: 'Subcategorias de visto',
      visaRequirements: 'Requisitos documentais',
      budgets: 'Orçamentos',
      financialRecords: 'Lançamentos financeiros',
      diagnosticRuleVersions: 'Versões de regras de diagnóstico',
    };
    const rootCollection = effectivePath ? effectivePath.split('/')[0] : '';
    const resourceLabel =
      (effectivePath && resourceMap[effectivePath]) ||
      (rootCollection && resourceMap[rootCollection]) ||
      null;

    return {
      category: 'firebase-permission',
      level: 'warning',
      title: 'Acesso restrito para esta operação',
      message: resourceLabel
        ? `Sua conta atual não tem permissão para concluir esta ação em "${resourceLabel}".`
        : 'Sua conta atual não tem permissão para concluir esta ação ou acessar este recurso.',
      actionHint: activeEmail
        ? `Conta ativa: ${activeEmail}. Verifique se ela possui papel de administrador/consultor ativo ou clique em "Sincronizar permissões".`
        : 'Verifique se você está autenticado com a conta de administrador/consultor correta ou solicite acesso ao administrador.',
      path: effectivePath,
      operation: effectiveOp,
      rawError: effectiveRaw,
    };
  }

  // 4. Offline / indisponível
  if (
    lower.includes('client is offline') ||
    lower.includes('unavailable') ||
    lower.includes('failed to get document because the client is offline') ||
    lower.includes('network-request-failed') ||
    lower.includes('failed to fetch')
  ) {
    return {
      category: 'firebase-offline',
      level: 'warning',
      title: 'Sem conexão com o servidor',
      message: 'Não foi possível sincronizar com o banco de dados agora. O sistema continuará funcionando localmente.',
      actionHint: 'Verifique sua conexão com a internet e clique em atualizar quando reconectar.',
      path: effectivePath,
      operation: effectiveOp,
      rawError: effectiveRaw,
    };
  }

  // 5. Autenticação Firebase
  if (
    lower.includes('auth/') ||
    lower.includes('unauthenticated') ||
    lower.includes('popup-blocked') ||
    lower.includes('popup-closed-by-user') ||
    lower.includes('unauthorized-domain')
  ) {
    let msg = 'Sua sessão precisa ser revalidada para continuar esta operação.';
    if (lower.includes('popup-closed-by-user')) {
      msg = 'O login com o Google foi cancelado antes de ser concluído.';
    } else if (lower.includes('popup-blocked')) {
      msg = 'O navegador bloqueou a janela de login do Google. Libere pop-ups e tente novamente.';
    } else if (lower.includes('unauthorized-domain')) {
      msg = 'Este domínio ainda não está autorizado nas configurações de autenticação do Firebase.';
    }
    return {
      category: 'firebase-auth',
      level: 'warning',
      title: 'Atenção na autenticação',
      message: msg,
      path: effectivePath,
      operation: effectiveOp,
      rawError: effectiveRaw,
    };
  }

  // 6. Documento não encontrado
  if (lower.includes('not-found') || lower.includes('no document to update')) {
    return {
      category: 'firebase-not-found',
      level: 'warning',
      title: 'Registro não encontrado',
      message: 'O registro solicitado não foi encontrado ou já foi removido.',
      actionHint: 'Atualize a tela para sincronizar a lista mais recente.',
      path: effectivePath,
      operation: effectiveOp,
      rawError: effectiveRaw,
    };
  }

  // 7. Erros de geração de PDF / arquivos
  if (context?.source === 'pdf' || lower.includes('html2canvas') || lower.includes('pdf')) {
    return {
      category: 'pdf',
      level: 'error',
      title: 'Falha ao gerar arquivo PDF',
      message: effectiveRaw.length < 180 ? effectiveRaw : 'Não foi possível concluir a geração do arquivo PDF.',
      actionHint: 'Tente novamente ou utilize a opção de impressão do navegador.',
      path: effectivePath,
      operation: effectiveOp,
      rawError: effectiveRaw,
    };
  }

  // 8. Mensagem de validação de domínio já legível em português
  const looksUserFriendly =
    effectiveRaw.length > 0 &&
    effectiveRaw.length <= 220 &&
    !effectiveRaw.startsWith('{') &&
    !lower.includes('typeerror:') &&
    !lower.includes('referenceerror:') &&
    !lower.includes('firebaseerror:');

  return {
    category: 'unknown',
    level: 'error',
    title: 'Não foi possível concluir a operação',
    message: looksUserFriendly
      ? effectiveRaw
      : 'Ocorreu uma instabilidade temporária ao processar sua solicitação.',
    actionHint: 'Você pode continuar usando o sistema normalmente e tentar novamente em instantes.',
    path: effectivePath,
    operation: effectiveOp,
    rawError: effectiveRaw,
  };
}

/**
 * Registra o erro no log estruturado central e dispara feedback visual amigável
 * sem interromper o fluxo da aplicação.
 */
export function reportAppError(
  error: unknown,
  options?: {
    source?: string;
    path?: string | null;
    operation?: string;
    silent?: boolean;
    levelOverride?: AppErrorLevel;
    nowMs?: number;
  },
): AppErrorLogEntry {
  const nowMs = options?.nowMs ?? Date.now();
  const translated = translateAppError(error, {
    source: options?.source,
    path: options?.path,
    operation: options?.operation,
  });

  const entry: AppErrorLogEntry = {
    id: makeErrorId(),
    timestamp: new Date(nowMs).toISOString(),
    level: options?.levelOverride ?? translated.level,
    category: translated.category,
    title: translated.title,
    message: translated.message,
    actionHint: translated.actionHint,
    source: options?.source,
    path: translated.path,
    operation: translated.operation,
    rawError: translated.rawError,
  };

  logHistory.unshift(entry);
  if (logHistory.length > MAX_LOG_HISTORY) {
    logHistory.length = MAX_LOG_HISTORY;
  }

  // Log estruturado no console para diagnóstico técnico sem poluir a UI
  if (typeof console !== 'undefined') {
    const logPayload = {
      level: entry.level,
      category: entry.category,
      source: entry.source || 'app',
      operation: entry.operation,
      path: entry.path,
      message: entry.rawError,
      timestamp: entry.timestamp,
    };
    if (entry.level === 'error') {
      console.error('[AppErrorService]', logPayload);
    } else {
      console.warn('[AppErrorService]', logPayload);
    }
  }

  if (!options?.silent) {
    const fingerprint = `${entry.category}|${entry.title}|${entry.message}`;
    const lastSeen = recentFingerprints.get(fingerprint);
    if (!lastSeen || nowMs - lastSeen > DEDUPE_WINDOW_MS) {
      recentFingerprints.set(fingerprint, nowMs);
      activeNotifications = [entry, ...activeNotifications].slice(0, MAX_ACTIVE_TOASTS);
      notifyListeners();
    }
  }

  return entry;
}

export function reportAppInfo(title: string, message: string, source?: string): AppErrorLogEntry {
  const entry: AppErrorLogEntry = {
    id: makeErrorId(),
    timestamp: new Date().toISOString(),
    level: 'info',
    category: 'unknown',
    title,
    message,
    source,
  };
  activeNotifications = [entry, ...activeNotifications].slice(0, MAX_ACTIVE_TOASTS);
  notifyListeners();
  return entry;
}

export function dismissAppError(id: string): void {
  const next = activeNotifications.filter((item) => item.id !== id);
  if (next.length !== activeNotifications.length) {
    activeNotifications = next;
    notifyListeners();
  }
}

export function clearAppErrors(): void {
  activeNotifications = [];
  recentFingerprints.clear();
  notifyListeners();
}

export function getActiveAppErrors(): AppErrorLogEntry[] {
  return [...activeNotifications];
}

export function getRecentErrorLogs(): AppErrorLogEntry[] {
  return [...logHistory];
}

export function subscribeToAppErrors(listener: ErrorListener): () => void {
  listeners.add(listener);
  listener([...activeNotifications]);
  return () => {
    listeners.delete(listener);
  };
}

let globalHandlersInstalled = false;

/**
 * Instala captura global de promessas rejeitadas e erros não tratados no navegador
 * para que falhas do Firebase nunca travem silenciosamente o fluxo da aplicação.
 */
export function installGlobalErrorHandlers(): void {
  if (globalHandlersInstalled || typeof window === 'undefined') return;
  globalHandlersInstalled = true;

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const raw = reason instanceof Error ? reason.message : String(reason ?? '');
    // Ignora ruído conhecido de HMR/WebSocket em ambiente dev
    if (raw.toLowerCase().includes('websocket') || raw.toLowerCase().includes('vite')) {
      return;
    }
    reportAppError(reason, { source: 'unhandledrejection' });
  });
}
