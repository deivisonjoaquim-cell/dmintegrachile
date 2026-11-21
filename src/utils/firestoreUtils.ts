import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  type QueryConstraint,
} from 'firebase/firestore';
import { DEFAULT_EMPRESA_CONFIG } from '../data/seeds';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { reportAppError } from '../services/errorService';
import type {
  BancarioConfig,
  DisplayFontChoice,
  EmpresaConfig,
  FontChoice,
} from '../types/domain';

const ALLOWED_FONTS = new Set<FontChoice>([
  'Plus Jakarta Sans',
  'DM Sans',
  'Manrope',
  'Public Sans',
  'Montserrat',
  'Merriweather',
  'Inter',
]);

const ALLOWED_DISPLAY_FONTS = new Set<DisplayFontChoice>([
  'Plus Jakarta Sans',
  'Outfit',
  'Manrope',
  'Playfair Display',
  'Montserrat',
]);

/**
 * Remove recursivamente qualquer propriedade `undefined`, `NaN`, `Infinity`, função ou símbolo
 * de objetos e arrays antes do envio ao Firestore, prevenindo o erro
 * "Unsupported field value: undefined".
 */
export function sanitizeFirestoreData<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'number') {
    return (Number.isFinite(value) ? value : 0) as unknown as T;
  }

  if (typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .filter((item) => item !== undefined && typeof item !== 'function' && typeof item !== 'symbol')
      .map((item) => sanitizeFirestoreData(item));
    return cleaned as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [key, rawVal] of Object.entries(value as Record<string, unknown>)) {
    if (rawVal === undefined || typeof rawVal === 'function' || typeof rawVal === 'symbol') {
      continue;
    }
    if (typeof rawVal === 'number' && !Number.isFinite(rawVal)) {
      continue;
    }
    out[key] = sanitizeFirestoreData(rawVal);
  }
  return out as T;
}

function clampString(value: unknown, maxLen: number, fallback = ''): string {
  const str = typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
  if (!str) return fallback.slice(0, maxLen);
  return str.slice(0, maxLen);
}

function clampOptionalString(value: unknown, maxLen: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().slice(0, maxLen);
}

function clampOptionalNumber(value: unknown, min: number, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.max(min, Math.min(max, num));
}

function sanitizeColorHex(value: unknown, fallback: string): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (/^#[0-9A-Fa-f]{3,8}$/.test(raw)) return raw.slice(0, 20);
  return fallback;
}

/**
 * Valida e higieniza o documento `config/empresa` rigorosamente contra `firebase-blueprint.json`
 * e `firestore.rules`, garantindo ausência total de campos `undefined` ou fora dos limites.
 */
export function validateEmpresaConfigPayload(input: Partial<EmpresaConfig>): EmpresaConfig {
  const merged: Partial<EmpresaConfig> = {
    ...DEFAULT_EMPRESA_CONFIG,
    ...input,
  };

  const fontePrincipal: FontChoice = ALLOWED_FONTS.has(merged.fontePrincipal as FontChoice)
    ? (merged.fontePrincipal as FontChoice)
    : DEFAULT_EMPRESA_CONFIG.fontePrincipal;

  const fonteDisplay: DisplayFontChoice | undefined = merged.fonteDisplay
    ? ALLOWED_DISPLAY_FONTS.has(merged.fonteDisplay as DisplayFontChoice)
      ? (merged.fonteDisplay as DisplayFontChoice)
      : DEFAULT_EMPRESA_CONFIG.fonteDisplay
    : DEFAULT_EMPRESA_CONFIG.fonteDisplay;

  const payload: EmpresaConfig = {
    ...merged,
    nome_empresa: clampString(merged.nome_empresa, 200, DEFAULT_EMPRESA_CONFIG.nome_empresa),
    razao_social_cnpj_rut: clampString(
      merged.razao_social_cnpj_rut,
      200,
      DEFAULT_EMPRESA_CONFIG.razao_social_cnpj_rut,
    ),
    responsavel_tecnico: clampString(
      merged.responsavel_tecnico,
      200,
      DEFAULT_EMPRESA_CONFIG.responsavel_tecnico,
    ),
    endereco_cidade: clampString(merged.endereco_cidade, 300, DEFAULT_EMPRESA_CONFIG.endereco_cidade),
    foro_comarca: clampString(merged.foro_comarca, 300, DEFAULT_EMPRESA_CONFIG.foro_comarca),
    logoUrl: clampString(merged.logoUrl, 800000, ''),
    logoDarkUrl: clampOptionalString(merged.logoDarkUrl, 800000),
    faviconUrl: clampOptionalString(merged.faviconUrl, 800000),
    corPrimaria: sanitizeColorHex(merged.corPrimaria, DEFAULT_EMPRESA_CONFIG.corPrimaria),
    corDestaque: sanitizeColorHex(merged.corDestaque, DEFAULT_EMPRESA_CONFIG.corDestaque),
    corFundo: sanitizeColorHex(merged.corFundo, DEFAULT_EMPRESA_CONFIG.corFundo),
    corSuperficie: merged.corSuperficie
      ? sanitizeColorHex(merged.corSuperficie, DEFAULT_EMPRESA_CONFIG.corSuperficie || '#FFFFFF')
      : undefined,
    corTexto: merged.corTexto
      ? sanitizeColorHex(merged.corTexto, DEFAULT_EMPRESA_CONFIG.corTexto || '#0F172A')
      : undefined,
    corRodapeBg: merged.corRodapeBg
      ? sanitizeColorHex(merged.corRodapeBg, DEFAULT_EMPRESA_CONFIG.corRodapeBg || '#0B1B29')
      : undefined,
    fontePrincipal,
    fonteDisplay,
    whatsapp: clampString(merged.whatsapp, 40, DEFAULT_EMPRESA_CONFIG.whatsapp),
    email: clampString(merged.email, 200, DEFAULT_EMPRESA_CONFIG.email),
    siteInstagram: clampString(merged.siteInstagram, 300, DEFAULT_EMPRESA_CONFIG.siteInstagram),
    siteLinkedIn: clampOptionalString(merged.siteLinkedIn, 300),
    linkCalendly: clampString(merged.linkCalendly, 500, ''),
    emailGoogleAgenda: clampString(merged.emailGoogleAgenda, 200, DEFAULT_EMPRESA_CONFIG.emailGoogleAgenda),
    chavePix: clampString(merged.chavePix, 200, ''),
    linkPagamentoCartao: clampString(merged.linkPagamentoCartao, 500, ''),
    textoContratoPadrao: clampString(
      merged.textoContratoPadrao,
      40000,
      DEFAULT_EMPRESA_CONFIG.textoContratoPadrao,
    ),
    textoReciboPadrao: clampString(
      merged.textoReciboPadrao,
      10000,
      DEFAULT_EMPRESA_CONFIG.textoReciboPadrao,
    ),
    termoLgpd: clampString(merged.termoLgpd, 25000, DEFAULT_EMPRESA_CONFIG.termoLgpd),
    termoLgpdVersao: clampString(merged.termoLgpdVersao, 30, DEFAULT_EMPRESA_CONFIG.termoLgpdVersao),
    avisoLegal: clampString(merged.avisoLegal, 2500, DEFAULT_EMPRESA_CONFIG.avisoLegal),
    bloqueioProtocoloMinimo:
      clampOptionalNumber(merged.bloqueioProtocoloMinimo, 0, 100) ??
      DEFAULT_EMPRESA_CONFIG.bloqueioProtocoloMinimo,
    diasAlertaRevisaoLegal:
      clampOptionalNumber(merged.diasAlertaRevisaoLegal, 1, 3650) ??
      DEFAULT_EMPRESA_CONFIG.diasAlertaRevisaoLegal,
    diasExpiracaoLinkDiagnostico: clampOptionalNumber(merged.diasExpiracaoLinkDiagnostico, 1, 365),
    honorariosPadraoMinBrl: clampOptionalNumber(merged.honorariosPadraoMinBrl, 0, 1000000),
    honorariosPadraoMaxBrl: clampOptionalNumber(merged.honorariosPadraoMaxBrl, 0, 1000000),
    taxaCambioBrlClp: clampOptionalNumber(merged.taxaCambioBrlClp, 1, 10000),
    taxaCambioUsdBrl: clampOptionalNumber(merged.taxaCambioUsdBrl, 0.1, 1000),
    retencaoDadosDias: clampOptionalNumber(merged.retencaoDadosDias, 1, 36500),
    seoTituloPadrao: clampOptionalString(merged.seoTituloPadrao, 200),
    seoDescricaoPadrao: clampOptionalString(merged.seoDescricaoPadrao, 1000),
    ultimaRevisaoNormativa: clampOptionalString(merged.ultimaRevisaoNormativa, 64),
    textoContratoVersao: clampOptionalString(merged.textoContratoVersao, 30),
    textoContratoVigencia: clampOptionalString(merged.textoContratoVigencia, 64),
    textoReciboVersao: clampOptionalString(merged.textoReciboVersao, 30),
    textoReciboVigencia: clampOptionalString(merged.textoReciboVigencia, 64),
    termoLgpdVigencia: clampOptionalString(merged.termoLgpdVigencia, 64),
    fcmVapidPublicKey: clampOptionalString(merged.fcmVapidPublicKey, 300),
    siteVersaoAtual: clampOptionalString(merged.siteVersaoAtual, 40),
    sitePublicadoEm: clampOptionalString(merged.sitePublicadoEm, 64),
    updatedAt: new Date().toISOString(),
  };

  return sanitizeFirestoreData(payload);
}

/**
 * Valida e higieniza o documento `config/bancario` contra `firebase-blueprint.json` e `firestore.rules`.
 */
export function validateBancarioConfigPayload(input: Partial<BancarioConfig>): BancarioConfig {
  return sanitizeFirestoreData<BancarioConfig>({
    dados_bancarios_br: clampString(input.dados_bancarios_br, 2000, ''),
    dados_bancarios_cl: clampString(input.dados_bancarios_cl, 2000, ''),
    dados_wise: clampString(input.dados_wise, 2000, ''),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Normaliza campos por coleção para garantir compatibilidade estrita com `firestore.rules`
 * antes de escritas auditadas no painel (evitando `permission-denied` por limites/enums legados).
 */
export function normalizeCollectionWritePayload(
  collectionName: string,
  docId: string,
  rawData: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...rawData };

  if (collectionName === 'config' && docId === 'empresa') {
    return validateEmpresaConfigPayload(base as Partial<EmpresaConfig>) as unknown as Record<string, unknown>;
  }
  if (collectionName === 'config' && docId === 'bancario') {
    return validateBancarioConfigPayload(base as Partial<BancarioConfig>) as unknown as Record<string, unknown>;
  }

  if (collectionName === 'cases') {
    delete base.valorContrato;
    if (typeof base.titulo === 'string') base.titulo = base.titulo.trim().slice(0, 250);
    if (typeof base.tipoServico === 'string') base.tipoServico = base.tipoServico.trim().slice(0, 100);
    if (typeof base.statusSermig === 'string') base.statusSermig = base.statusSermig.trim().slice(0, 80);
    if (base.etapaPipeline !== undefined) {
      const n = Number(base.etapaPipeline);
      base.etapaPipeline = Number.isFinite(n) ? Math.max(1, Math.min(15, Math.round(n))) : 1;
    }
    if (base.modalidadeConsultoria !== 'orientativa' && base.modalidadeConsultoria !== 'completa') {
      delete base.modalidadeConsultoria;
    }
  } else if (collectionName === 'clients') {
    if (typeof base.nomeCompleto === 'string') base.nomeCompleto = base.nomeCompleto.trim().slice(0, 200);
    if (typeof base.email === 'string') base.email = base.email.trim().toLowerCase().slice(0, 200);
    if (typeof base.whatsapp === 'string') base.whatsapp = base.whatsapp.trim().slice(0, 40);
    if (typeof base.cpf === 'string') base.cpf = base.cpf.trim().slice(0, 20);
    if (typeof base.observacoes === 'string') base.observacoes = base.observacoes.slice(0, 10000);
    if (typeof base.portalLiberado !== 'boolean') base.portalLiberado = Boolean(base.portalLiberado);
    const validStatus = ['Não solicitado', 'Pendente liberação', 'Liberado'];
    if (typeof base.statusAcessoPortal !== 'string' || !validStatus.includes(base.statusAcessoPortal)) {
      base.statusAcessoPortal = base.portalLiberado ? 'Liberado' : 'Não solicitado';
    }
    if (base.modalidadeConsultoria !== 'orientativa' && base.modalidadeConsultoria !== 'completa') {
      delete base.modalidadeConsultoria;
    }
  } else if (collectionName === 'leads') {
    if (typeof base.nome === 'string') base.nome = base.nome.trim().slice(0, 200);
    if (typeof base.email === 'string') base.email = base.email.trim().toLowerCase().slice(0, 200);
    if (typeof base.whatsapp === 'string') base.whatsapp = base.whatsapp.trim().slice(0, 40);
    if (typeof base.cidadeUf === 'string') base.cidadeUf = base.cidadeUf.trim().slice(0, 150);
    if (typeof base.subcategoriaSugerida === 'string') base.subcategoriaSugerida = base.subcategoriaSugerida.trim().slice(0, 200);
    if (typeof base.notas === 'string') base.notas = base.notas.slice(0, 6000);
    if (base.confianca !== 'Alta' && base.confianca !== 'Média' && base.confianca !== 'Baixa') {
      delete base.confianca;
    }
    if (base.temperatura !== 'Quente' && base.temperatura !== 'Morno' && base.temperatura !== 'Frio') {
      delete base.temperatura;
    }
    if (base.statusConclusao !== 'Em andamento' && base.statusConclusao !== 'Concluído' && base.statusConclusao !== 'Abandonado') {
      delete base.statusConclusao;
    }
    if (base.modalidadeInteresse !== 'orientativa' && base.modalidadeInteresse !== 'completa') {
      delete base.modalidadeInteresse;
    }
    if (typeof base.lgpdAceito !== 'boolean') base.lgpdAceito = Boolean(base.lgpdAceito);
  } else if (collectionName === 'siteContent') {
    if (typeof base.secao === 'string') base.secao = base.secao.trim().slice(0, 64);
    if (typeof base.titulo === 'string') base.titulo = (base.titulo.trim() || 'Seção').slice(0, 300);
    if (typeof base.subtitulo === 'string') base.subtitulo = base.subtitulo.slice(0, 1500);
    if (typeof base.conteudoHtml === 'string') base.conteudoHtml = base.conteudoHtml.slice(0, 60000);
    if (typeof base.imagemUrl === 'string') base.imagemUrl = base.imagemUrl.slice(0, 800000);
    base.ordem = Number.isFinite(Number(base.ordem)) ? Number(base.ordem) : 1;
    base.ativo = Boolean(base.ativo);
  } else if (collectionName === 'users') {
    base.uid = typeof base.uid === 'string' && base.uid.trim() ? base.uid.trim().slice(0, 128) : docId;
    if (typeof base.nome === 'string') base.nome = (base.nome.trim() || 'Usuário').slice(0, 200);
    if (typeof base.email === 'string') base.email = base.email.trim().toLowerCase().slice(0, 200);
    if (typeof base.fotoUrl === 'string') base.fotoUrl = base.fotoUrl.slice(0, 2000);
    if (typeof base.quemSomosBio === 'string') base.quemSomosBio = base.quemSomosBio.slice(0, 5000);
    if (typeof base.quemSomosFormacao === 'string') base.quemSomosFormacao = base.quemSomosFormacao.slice(0, 2000);
    if (typeof base.quemSomosExperiencia === 'string') base.quemSomosExperiencia = base.quemSomosExperiencia.slice(0, 2000);
    if (typeof base.quemSomosMissao === 'string') base.quemSomosMissao = base.quemSomosMissao.slice(0, 2000);
    if (typeof base.quemSomosCredenciais === 'string') base.quemSomosCredenciais = base.quemSomosCredenciais.slice(0, 2000);
    if (typeof base.quemSomosFotoUrl === 'string') base.quemSomosFotoUrl = base.quemSomosFotoUrl.slice(0, 800000);
  } else if (collectionName === 'legalSources') {
    if (typeof base.titulo === 'string') base.titulo = base.titulo.trim().slice(0, 300);
    if (typeof base.resumoPortugues === 'string') base.resumoPortugues = base.resumoPortugues.slice(0, 10000);
    if (typeof base.explicacaoCliente === 'string') base.explicacaoCliente = base.explicacaoCliente.slice(0, 10000);
    if (typeof base.textoIntegral === 'string') base.textoIntegral = base.textoIntegral.slice(0, 80000);
  } else if (collectionName === 'caseDocuments') {
    if (typeof base.arquivoUrl === 'string') base.arquivoUrl = base.arquivoUrl.slice(0, 800000);
    if (typeof base.arquivoNome === 'string') base.arquivoNome = base.arquivoNome.trim().slice(0, 250);
    if (typeof base.storagePath === 'string') base.storagePath = base.storagePath.trim().slice(0, 500);
    if (typeof base.arquivoMimeType === 'string') base.arquivoMimeType = base.arquivoMimeType.trim().slice(0, 100);
    if (Array.isArray(base.metadataTags)) {
      base.metadataTags = base.metadataTags
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim().slice(0, 80))
        .slice(0, 20);
    }
  }

  return sanitizeFirestoreData(base);
}

/**
 * Aplica validação específica por coleção (com foco especial na coleção `config`)
 * e sanitização profunda de `undefined` antes de qualquer gravação no Firestore.
 */
export function prepareFirestoreWritePayload<T extends Record<string, unknown>>(
  collectionName: string,
  docId: string,
  data: T,
): Record<string, unknown> {
  return normalizeCollectionWritePayload(collectionName, docId, data);
}

/**
 * Leitura segura de documento único no Firestore com tratamento centralizado de erro.
 */
export async function firestoreGetDoc<T>(
  collectionName: string,
  docId: string,
  options?: { fallback?: T | null; silentError?: boolean },
): Promise<T | null> {
  const pathStr = `${collectionName}/${docId}`;
  try {
    const snap = await getDoc(doc(db, collectionName, docId));
    if (!snap.exists()) return options?.fallback ?? null;
    return { id: snap.id, ...(snap.data() as Record<string, unknown>) } as T;
  } catch (err) {
    if (options?.fallback !== undefined) {
      reportAppError(err, {
        source: 'firestoreGetDoc',
        operation: OperationType.GET,
        path: pathStr,
        silent: options.silentError,
      });
      return options.fallback;
    }
    handleFirestoreError(err, OperationType.GET, pathStr);
  }
}

/**
 * Escrita segura (`setDoc`) no Firestore com validação automática de esquema
 * (incluindo `config/empresa` e `config/bancario`) e remoção profunda de `undefined`.
 */
export async function firestoreSetDoc<T extends Record<string, unknown>>(
  collectionName: string,
  docId: string,
  data: T,
  options?: { merge?: boolean },
): Promise<Record<string, unknown>> {
  const pathStr = `${collectionName}/${docId}`;
  const cleanPayload = prepareFirestoreWritePayload(collectionName, docId, data);
  try {
    await setDoc(doc(db, collectionName, docId), cleanPayload, { merge: Boolean(options?.merge) });
    return cleanPayload;
  } catch (err) {
    handleFirestoreError(err, options?.merge ? OperationType.WRITE : OperationType.CREATE, pathStr);
  }
}

/**
 * Atualização parcial segura (`updateDoc`) com remoção profunda de `undefined`.
 */
export async function firestoreUpdateDoc<T extends Record<string, unknown>>(
  collectionName: string,
  docId: string,
  patch: T,
): Promise<Record<string, unknown>> {
  const pathStr = `${collectionName}/${docId}`;
  const cleanPatch = sanitizeFirestoreData(patch);
  if (Object.keys(cleanPatch).length === 0) {
    return cleanPatch;
  }
  try {
    await updateDoc(doc(db, collectionName, docId), cleanPatch);
    return cleanPatch;
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, pathStr);
  }
}

/**
 * Exclusão segura (`deleteDoc`) com log e tratamento estruturado de erro.
 */
export async function firestoreDeleteDoc(collectionName: string, docId: string): Promise<void> {
  const pathStr = `${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, pathStr);
  }
}

/**
 * Listagem segura de coleção/query com fallback opcional para manter a UI responsiva.
 */
export async function firestoreQueryDocs<T>(
  collectionName: string,
  constraints: QueryConstraint[] = [],
  options?: { fallback?: T[]; silentError?: boolean },
): Promise<T[]> {
  try {
    const q = constraints.length > 0 ? query(collection(db, collectionName), ...constraints) : collection(db, collectionName);
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as T);
  } catch (err) {
    if (options?.fallback !== undefined) {
      reportAppError(err, {
        source: 'firestoreQueryDocs',
        operation: OperationType.LIST,
        path: collectionName,
        silent: options.silentError,
      });
      return options.fallback;
    }
    handleFirestoreError(err, OperationType.LIST, collectionName);
  }
}
