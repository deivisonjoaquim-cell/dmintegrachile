/**
 * Construtores estritos de payloads parciais (`updateDoc`) para mutações do Portal do Cliente.
 *
 * Cada função garante que APENAS as chaves explicitamente autorizadas nas regras
 * `affectedKeys().hasOnly(...)` de `firestore.rules` sejam enviadas ao Firestore,
 * eliminando rejeições por campos extras (ex.: `id`, `email`, `statusAcessoPortal`, etc.).
 */

export const CLIENT_ALLOWED_SELF_UPDATE_KEYS = [
  'nomeCompleto',
  'whatsapp',
  'enderecoCompleto',
  'profissao',
  'escolaridade',
  'passaporte',
  'lgpdAceito',
  'lgpdAceitoEm',
  'lgpdVersao',
  'updatedAt',
] as const;

export const GENERATED_DOC_ALLOWED_CLIENT_KEYS = [
  'confirmadoLeituraEm',
  'confirmadoLeituraPor',
  'status',
  'assinaturaUrl',
  'assinaturaDataUrl',
  'assinadoEm',
  'assinaturaMetodo',
  'assinadoPorNome',
  'assinadoPorEmail',
  'assinadoPorDocumento',
  'assinaturaHashSha256',
  'assinaturaUserAgent',
  'assinaturaAceiteTermo',
  'updatedAt',
] as const;

export const BUDGET_ALLOWED_CLIENT_KEYS = [
  'status',
  'aprovadoEm',
  'updatedAt',
] as const;

export const FINANCIAL_RECORD_ALLOWED_CLIENT_KEYS = [
  'comprovanteUrl',
  'updatedAt',
] as const;

export const NOTIFICATION_ALLOWED_CLIENT_KEYS = [
  'lida',
  'lidaEm',
  'updatedAt',
] as const;

export const CASE_ALLOWED_CLIENT_NPS_KEYS = [
  'npsNota',
  'npsComentario',
  'updatedAt',
] as const;

export function buildClientPersonalDataPatch(
  input: {
    nomeCompleto: string;
    whatsapp?: string;
    enderecoCompleto?: string;
    profissao?: string;
    escolaridade?: string;
    passaporte?: string;
  },
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  const nome = input.nomeCompleto.trim().slice(0, 200);
  if (nome.length < 2) {
    throw new Error('Informe seu nome completo (mínimo de 2 caracteres).');
  }
  const patch: Record<string, unknown> = {
    nomeCompleto: nome,
    whatsapp: (input.whatsapp ?? '').trim().slice(0, 40),
    enderecoCompleto: (input.enderecoCompleto ?? '').trim().slice(0, 300),
    profissao: (input.profissao ?? '').trim().slice(0, 160),
    updatedAt: nowIso,
  };
  if (input.escolaridade !== undefined) {
    patch.escolaridade = input.escolaridade.trim().slice(0, 120);
  }
  if (input.passaporte !== undefined) {
    patch.passaporte = input.passaporte.trim().slice(0, 60);
  }
  return patch;
}

export function buildClientLgpdAcceptancePatch(
  versao: string,
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  return {
    lgpdAceito: true,
    lgpdAceitoEm: nowIso,
    lgpdVersao: (versao || '1.0').trim().slice(0, 30),
    updatedAt: nowIso,
  };
}

export function buildGeneratedDocReadConfirmPatch(
  confirmedBy: string,
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  return {
    confirmadoLeituraEm: nowIso,
    confirmadoLeituraPor: (confirmedBy || 'Cliente').trim().slice(0, 200),
    updatedAt: nowIso,
  };
}

export interface ClientSignaturePatchMeta {
  assinaturaMetodo?: 'desenhada' | 'tipografica' | 'pdf_anexado' | 'externa';
  assinadoPorNome?: string;
  assinadoPorEmail?: string;
  assinadoPorDocumento?: string;
  assinaturaHashSha256?: string;
  assinaturaUserAgent?: string;
  assinaturaAceiteTermo?: boolean;
  confirmadoLeituraEm?: string;
  confirmadoLeituraPor?: string;
}

function appendSignatureMeta(
  target: Record<string, unknown>,
  meta?: ClientSignaturePatchMeta,
  defaultMetodo?: 'desenhada' | 'tipografica' | 'pdf_anexado' | 'externa',
): Record<string, unknown> {
  const metodo = meta?.assinaturaMetodo ?? defaultMetodo;
  if (metodo) target.assinaturaMetodo = metodo;
  if (meta?.assinadoPorNome?.trim()) {
    target.assinadoPorNome = meta.assinadoPorNome.trim().slice(0, 200);
  }
  if (meta?.assinadoPorEmail?.trim()) {
    target.assinadoPorEmail = meta.assinadoPorEmail.trim().toLowerCase().slice(0, 200);
  }
  if (meta?.assinadoPorDocumento?.trim()) {
    target.assinadoPorDocumento = meta.assinadoPorDocumento.trim().slice(0, 80);
  }
  if (meta?.assinaturaHashSha256?.trim()) {
    target.assinaturaHashSha256 = meta.assinaturaHashSha256.trim().slice(0, 128);
  }
  if (meta?.assinaturaUserAgent?.trim()) {
    target.assinaturaUserAgent = meta.assinaturaUserAgent.trim().slice(0, 300);
  }
  if (typeof meta?.assinaturaAceiteTermo === 'boolean') {
    target.assinaturaAceiteTermo = meta.assinaturaAceiteTermo;
  }
  if (meta?.confirmadoLeituraEm?.trim()) {
    target.confirmadoLeituraEm = meta.confirmadoLeituraEm.trim().slice(0, 64);
  }
  if (meta?.confirmadoLeituraPor?.trim()) {
    target.confirmadoLeituraPor = meta.confirmadoLeituraPor.trim().slice(0, 200);
  }
  return target;
}

export function buildGeneratedDocCanvasSignaturePatch(
  signatureDataUrl: string,
  nowIso = new Date().toISOString(),
  meta?: ClientSignaturePatchMeta,
): Record<string, unknown> {
  const clean = (signatureDataUrl || '').trim().replace(/\s+/g, '');
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(clean)) {
    throw new Error('Assinatura desenhada inválida. Desenhe sua assinatura novamente.');
  }
  if (clean.length > 250_000) {
    throw new Error('A imagem da assinatura excede o tamanho seguro. Limpe o quadro e assine novamente.');
  }
  return appendSignatureMeta(
    {
      assinaturaDataUrl: clean,
      status: 'Assinado',
      assinadoEm: nowIso,
      updatedAt: nowIso,
    },
    meta,
    'desenhada',
  );
}

export function buildGeneratedDocPdfSignaturePatch(
  signedPdfUrl: string,
  nowIso = new Date().toISOString(),
  meta?: ClientSignaturePatchMeta,
): Record<string, unknown> {
  const clean = (signedPdfUrl || '').trim();
  if (!clean) {
    throw new Error('Arquivo assinado inválido.');
  }
  return appendSignatureMeta(
    {
      assinaturaUrl: clean,
      status: 'Assinado',
      assinadoEm: nowIso,
      updatedAt: nowIso,
    },
    meta,
    'pdf_anexado',
  );
}

export function buildBudgetDecisionPatch(
  decision: 'Aprovado' | 'Recusado',
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  return {
    status: decision,
    aprovadoEm: nowIso,
    updatedAt: nowIso,
  };
}

export function buildFinancialReceiptPatch(
  comprovanteUrl: string,
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  return {
    comprovanteUrl: comprovanteUrl.trim(),
    updatedAt: nowIso,
  };
}

export function buildClientNotificationReadPatch(
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  return {
    lida: true,
    lidaEm: nowIso,
    updatedAt: nowIso,
  };
}

export function buildCaseNpsPatch(
  npsNota: number,
  npsComentario: string,
  nowIso = new Date().toISOString(),
): Record<string, unknown> {
  const safeNota = Number.isFinite(npsNota) ? Math.max(1, Math.min(5, Math.round(npsNota))) : 5;
  return {
    npsNota: safeNota,
    npsComentario: (npsComentario || '').trim().slice(0, 1500),
    updatedAt: nowIso,
  };
}

export function needsUserClientLinkSync(params: {
  persistedUserClientId?: string | null;
  persistedUserStatus?: string | null;
  matchedClientId: string;
  matchedClientPortalLiberado: boolean;
  matchedClientArquivado?: boolean;
  matchedClientUserId?: string | null;
  authUid: string;
}): {
  shouldBeActive: boolean;
  targetStatus: 'ativo' | 'pendente';
  needsUserDocUpdate: boolean;
  needsClientUserIdUpdate: boolean;
} {
  const shouldBeActive = params.matchedClientPortalLiberado === true && !params.matchedClientArquivado;
  const targetStatus: 'ativo' | 'pendente' = shouldBeActive ? 'ativo' : 'pendente';
  const needsUserDocUpdate =
    (params.persistedUserClientId || '') !== params.matchedClientId ||
    (params.persistedUserStatus || '') !== targetStatus;
  const needsClientUserIdUpdate =
    !params.matchedClientUserId || params.matchedClientUserId.trim() === '';
  return {
    shouldBeActive,
    targetStatus,
    needsUserDocUpdate,
    needsClientUserIdUpdate,
  };
}
