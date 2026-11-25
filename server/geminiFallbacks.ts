import { checkOfficialLegalSourceUrl, type FetchLike } from './sermigLegalService.ts';

/**
 * Deterministic rule-based + live-check hybrid fallbacks for all /api/ai/* routes.
 * Used automatically whenever Gemini primary & backup models are unavailable,
 * unkeyed, or return invalid output after retry. Never cites invented laws: uses ONLY
 * provided legalSources, verified official HTTP probes, or literally writes "fonte a cadastrar".
 */

export const AI_FALLBACK_LABEL = 'Assistente de Regras SERMIG/BCN';

export interface LegalSourceInput {
  id?: string;
  titulo?: string;
  numeroAno?: string;
  artigos?: string;
  resumoPortugues?: string;
  explicacaoCliente?: string;
  statusVigencia?: string;
}

function normalizeLegalSources(raw: unknown): LegalSourceInput[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, 20)
    .map((s) => ({
      id: typeof s.id === 'string' ? s.id : undefined,
      titulo: typeof s.titulo === 'string' ? s.titulo : undefined,
      numeroAno: typeof s.numeroAno === 'string' ? s.numeroAno : undefined,
      artigos: typeof s.artigos === 'string' ? s.artigos : undefined,
      resumoPortugues: typeof s.resumoPortugues === 'string' ? s.resumoPortugues : undefined,
      explicacaoCliente: typeof s.explicacaoCliente === 'string' ? s.explicacaoCliente : undefined,
      statusVigencia: typeof s.statusVigencia === 'string' ? s.statusVigencia : undefined,
    }))
    .filter((s) => Boolean(s.titulo));
}

function formatLegalCitations(sources: LegalSourceInput[]): string[] {
  if (sources.length === 0) return ['fonte a cadastrar'];
  return sources.map((s) => {
    const num = s.numeroAno ? ` (${s.numeroAno})` : '';
    const art = s.artigos ? ` — ${s.artigos}` : '';
    return `${s.titulo}${num}${art}`;
  });
}

function formatDatePtBr(date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

// =============================================================================
// Pure Node.js Binary Inspector for Uploaded Documents (PDF / PNG / JPG / WEBP)
// =============================================================================
export interface InspectedBinarySummary {
  validHeader: boolean;
  kind: 'pdf' | 'png' | 'jpeg' | 'webp' | 'unknown';
  sizeKb: number;
  width?: number;
  height?: number;
  pdfVersion?: string;
  estimatedPages?: number;
  encrypted?: boolean;
  detectedKeywords: string[];
  detectedDate?: string;
}

export function inspectUploadedDocumentBinary(
  fileBase64: unknown,
  mimeType: unknown,
): InspectedBinarySummary | null {
  if (typeof fileBase64 !== 'string' || !fileBase64.trim()) return null;
  const cleanB64 = fileBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  if (!cleanB64) return null;

  const buf = Buffer.from(cleanB64, 'base64');
  if (buf.length === 0) return null;
  const sizeKb = Math.max(1, Math.round(buf.length / 1024));
  const declaredMime = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';

  // 1. PDF inspection
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-' || declaredMime === 'application/pdf') {
    const header = buf.subarray(0, 16).toString('ascii');
    const verMatch = /%PDF-(\d\.\d)/.exec(header);
    const textSlice = buf.subarray(0, Math.min(buf.length, 512 * 1024)).toString('latin1');
    const pageMatches = textSlice.match(/\/Type\s*\/Page\b/g);
    const encrypted = /\/Encrypt\b/.test(textSlice);
    const lowerText = textSlice.toLowerCase();

    const keywords: string[] = [];
    if (lowerText.includes('apostil') || lowerText.includes('haia') || lowerText.includes('haya')) {
      keywords.push('Apostila/Haia');
    }
    if (lowerText.includes('policia federal') || lowerText.includes('polícia federal') || lowerText.includes('sinic')) {
      keywords.push('Polícia Federal');
    }
    if (lowerText.includes('antecedentes')) keywords.push('Antecedentes');
    if (lowerText.includes('registro civil') || lowerText.includes('cartorio') || lowerText.includes('cartório')) {
      keywords.push('Registro Civil');
    }
    if (lowerText.includes('sermig') || lowerText.includes('migraciones')) keywords.push('SERMIG');
    if (lowerText.includes('passaporte') || lowerText.includes('pasaporte')) keywords.push('Passaporte');

    const dateMatch = textSlice.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);

    return {
      validHeader: buf.subarray(0, 5).toString('ascii') === '%PDF-',
      kind: 'pdf',
      sizeKb,
      pdfVersion: verMatch?.[1],
      estimatedPages: pageMatches ? Math.max(1, pageMatches.length) : undefined,
      encrypted,
      detectedKeywords: keywords,
      detectedDate: dateMatch?.[1],
    };
  }

  // 2. PNG inspection (IHDR at bytes 16..24)
  if (
    buf.length >= 24 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return {
      validHeader: true,
      kind: 'png',
      sizeKb,
      width,
      height,
      detectedKeywords: [],
    };
  }

  // 3. JPEG inspection (scan SOF0..SOF3 markers for width/height)
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let offset = 2;
    let width: number | undefined;
    let height: number | undefined;
    while (offset + 9 < buf.length) {
      if (buf[offset] !== 0xff) break;
      const marker = buf[offset + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const segLen = buf.readUInt16BE(offset + 2);
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        height = buf.readUInt16BE(offset + 5);
        width = buf.readUInt16BE(offset + 7);
        break;
      }
      if (segLen < 2) break;
      offset += 2 + segLen;
    }
    return {
      validHeader: true,
      kind: 'jpeg',
      sizeKb,
      width,
      height,
      detectedKeywords: [],
    };
  }

  // 4. WEBP inspection
  if (
    buf.length >= 16 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return {
      validHeader: true,
      kind: 'webp',
      sizeKb,
      detectedKeywords: [],
    };
  }

  return {
    validHeader: false,
    kind: 'unknown',
    sizeKb,
    detectedKeywords: [],
  };
}

// =============================================================================
// 1. /api/ai/diagnostico fallback
// =============================================================================
export function buildDiagnosticoFallback(body: Record<string, unknown>) {
  const answers = (body.answers && typeof body.answers === 'object' ? body.answers : {}) as Record<string, unknown>;
  const regrasAcionadas = Array.isArray(body.regrasAcionadas)
    ? body.regrasAcionadas.filter((r): r is string => typeof r === 'string')
    : [];
  const subcategoria =
    typeof body.subcategoriaRecomendada === 'string' && body.subcategoriaRecomendada.trim()
      ? body.subcategoriaRecomendada.trim()
      : 'Análise complementar necessária';
  const sources = normalizeLegalSources(body.legalSources);
  const fontesCitadas = formatLegalCitations(sources);

  const radar =
    body.radarViabilidade && typeof body.radarViabilidade === 'object'
      ? (body.radarViabilidade as {
          total?: number;
          veredito?: string;
          confianca?: string;
          dimensoes?: Array<{ nome?: string; pontos?: number; maximo?: number; percentual?: number; observacao?: string }>;
        })
      : null;
  const contradicoes = Array.isArray(body.contradicoes)
    ? body.contradicoes.filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    : [];

  const localizacao = typeof answers.localizacao === 'string' ? answers.localizacao : 'não informada';
  const passaporteMeses = typeof answers.passaporteValidadeMeses === 'number' ? answers.passaporteValidadeMeses : 24;
  const passaporteStatus = typeof answers.passaporteStatus === 'string' ? answers.passaporteStatus : 'valido';

  const riscos: string[] = [];
  if (answers.overstay === true) riscos.push('Permanência irregular prévia (Overstay) informada — revisar cálculo de multa antes de protocolar.');
  if (answers.ordenAbandono === true) riscos.push('Registro de Orden de Abandono/expulsão — exige análise jurídica individual antes de novo pedido.');
  if (answers.rejeicaoAnterior === true) riscos.push('Histórico de rejeição anterior pelo SERMIG — verificar motivos da resolução prévia.');
  if (answers.antecedentesCriminais === true) riscos.push('Ocorrência em antecedentes criminais — revisar documentação de esclarecimento.');
  if (passaporteStatus === 'vencido' || passaporteStatus === 'nao_possui' || passaporteMeses < 12) {
    riscos.push('Passaporte vencido, ausente ou com validade inferior a 12 meses — providenciar emissão/renovação prévia.');
  }
  if (localizacao === 'No Chile como turista' && !answers.vinculoFormalizado) {
    riscos.push('Solicitante no Chile como turista sem vínculo familiar formalizado — protocolo comum deve ocorrer do exterior.');
  }
  for (const cont of contradicoes.slice(0, 2)) {
    riscos.push(`Contradição nas respostas: ${cont}`);
  }
  if (riscos.length === 0) {
    riscos.push('Nenhum impeditivo crítico marcado na triagem; confirmar aderência documental na reunião técnica.');
  }

  const perguntasConsultor: string[] = [];
  const reserved = Array.isArray(answers.riscoConsultaConsultor) ? answers.riscoConsultaConsultor : [];
  if (reserved.length > 0) {
    perguntasConsultor.push(`Tratar em atendimento sigiloso os tópicos reservados pelo cliente (${reserved.join(', ')}).`);
  }
  perguntasConsultor.push('Confirmar origem, validade e apostilamento das certidões civis e de antecedentes criminais.');
  perguntasConsultor.push('Validar cronograma de ingresso e vínculo/documentação específica da subcategoria indicada.');

  const weakPillars = (radar?.dimensoes || [])
    .filter((d) => typeof d.percentual === 'number' && d.percentual < 75 && typeof d.nome === 'string')
    .sort((a, b) => (a.percentual ?? 100) - (b.percentual ?? 100))
    .slice(0, 3)
    .map((d) => `${d.nome} (${d.pontos ?? 0}/${d.maximo ?? 0}): ${d.observacao || 'requer atenção técnica'}`);

  const pontosAtencao =
    weakPillars.length > 0
      ? [...weakPillars, ...regrasAcionadas.slice(0, 3)]
      : regrasAcionadas.length > 0
        ? regrasAcionadas.slice(0, 6)
        : ['Pré-enquadramento apurado pelas regras determinísticas da consultoria.'];

  const radarResumo =
    radar && typeof radar.total === 'number'
      ? ` Índice do Radar de Viabilidade: ${Math.round(radar.total)}/100 (${radar.veredito || 'Em análise'}, confiança ${radar.confianca || 'Média'}).`
      : '';

  return {
    rascunho: true,
    resumoExecutivo: `[${AI_FALLBACK_LABEL}] Pré-análise baseada estritamente nas regras cadastradas para a indicação "${subcategoria}" (localização atual: ${localizacao}).${radarResumo} Revise os pontos de atenção e confirme a base documental antes de orientar o cliente.`,
    riscos,
    perguntasConsultor,
    pontosAtencao,
    fontesCitadas,
    proximosPassos: [
      'Validar passaporte e certidões civis sem validade curta como primeira prioridade.',
      'Conferir exigência de Apostila da Haia (CNJ) e tradução juramentada para cada item do checklist.',
      'Emitir Antecedentes da Polícia Federal (validade de 60 dias) estritamente por último, antes do protocolo SERMIG.',
      'Realizar revisão humana final pelo consultor responsável.',
    ],
  };
}

// =============================================================================
// 2. /api/ai/parecer fallback
// =============================================================================
export function buildParecerFallback(body: Record<string, unknown>) {
  const caseData = (body.caseData && typeof body.caseData === 'object' ? body.caseData : {}) as Record<string, unknown>;
  const clientData = (body.clientData && typeof body.clientData === 'object' ? body.clientData : {}) as Record<string, unknown>;
  const dependents = Array.isArray(body.dependents) ? body.dependents : [];
  const sources = normalizeLegalSources(body.legalSources);
  const citations = formatLegalCitations(sources);

  const titulo = typeof caseData.titulo === 'string' ? caseData.titulo : 'Processo Migratório';
  const tipoServico = typeof caseData.tipoServico === 'string' ? caseData.tipoServico : 'Residência Temporal';
  const subcategoria = typeof caseData.subcategoria === 'string' && caseData.subcategoria.trim() ? caseData.subcategoria.trim() : '';
  const statusSermig = typeof caseData.statusSermig === 'string' ? caseData.statusSermig : 'Em preparação';
  const notaViabilidade =
    typeof caseData.notaViabilidadeGeral === 'number' ? `${caseData.notaViabilidadeGeral}/100` : 'a apurar';
  const nomeCliente = typeof clientData.nomeCompleto === 'string' ? clientData.nomeCompleto : 'Titular';
  const localizacao = typeof clientData.localizacaoAtual === 'string' ? clientData.localizacaoAtual : 'Brasil/Exterior';

  const riskAlerts: string[] = [];
  if (clientData.antecedentesCriminais === true) {
    riskAlerts.push('Sinalização de antecedentes criminais exige conferência jurídica antes do protocolo.');
  }
  if (clientData.restricaoEntrada === true) {
    riskAlerts.push('Histórico de restrição de entrada informado — validar situação migratória prévia na PDI/SERMIG.');
  }
  const passVal = typeof clientData.validadePassaporte === 'string' ? clientData.validadePassaporte : '';
  if (passVal) {
    riskAlerts.push(`Passaporte com validade declarada até ${passVal}.`);
  }

  return {
    rascunho: true,
    enquadramentoLegal: `[${AI_FALLBACK_LABEL}]\nCaso: ${titulo} (${tipoServico}${subcategoria ? ` · ${subcategoria}` : ''}) para ${nomeCliente}.\nLocalização informada: ${localizacao}. Status atual no SERMIG: ${statusSermig}.\nEnquadramento orientativo preliminar definido conforme as regras ativas da subcategoria cadastrada.`,
    elegibilidadeRiscos: `Viabilidade geral registrada: ${notaViabilidade}. Grupo familiar com ${dependents.length} dependente(s) vinculado(s). Conferir passaporte vigente (>= 12 meses para protocolo do exterior), regularidade de entradas/saídas na PDI, apostilamento de Haia e emissão dentro do prazo de validade das certidões (especialmente Antecedentes de 60 dias).${riskAlerts.length > 0 ? `\nAlertas cadastrados: ${riskAlerts.join(' ')}` : ''}`,
    fundamentacaoNormativa:
      sources.length > 0
        ? `Fontes cadastradas na Biblioteca Legal aplicáveis ao caso:\n- ${citations.join('\n- ')}`
        : 'fonte a cadastrar',
    recomendacoes:
      '1) Conferir todos os documentos obrigatórios do titular e dependentes no checklist do caso.\n2) Emitir certidões sem vencimento curto primeiro e deixar Antecedentes Criminais por último antes do protocolo.\n3) Validar taxas SERMIG e revisão final do consultor antes de liberar ao cliente.',
  };
}

// =============================================================================
// 3. /api/ai/proposta fallback
// =============================================================================
export function buildPropostaFallback(body: Record<string, unknown>) {
  const proposal = (body.proposal && typeof body.proposal === 'object' ? body.proposal : {}) as Record<string, unknown>;
  const sources = normalizeLegalSources(body.legalSources);
  const citations = formatLegalCitations(sources);

  const empresa = typeof proposal.nome_empresa === 'string' ? proposal.nome_empresa : 'Proponente';
  const categoria = typeof proposal.categoria === 'string' ? proposal.categoria : 'Serviços';
  const pais = typeof proposal.pais === 'string' ? proposal.pais : 'Brasil/Chile';
  const cidade = typeof proposal.cidade === 'string' ? proposal.cidade : '';
  const textoProp = typeof proposal.proposta === 'string' ? proposal.proposta.trim() : '';
  const mensagem = typeof proposal.mensagem === 'string' ? proposal.mensagem.trim() : '';

  let nota = 50;
  const riscos: string[] = [];
  if (textoProp.length >= 25) nota += 20;
  else riscos.push('Detalhamento comercial da proposta curto — solicitar tabela formal de honorários e prazos.');
  if (mensagem.length >= 15) nota += 10;
  if (typeof proposal.whatsapp === 'string' && proposal.whatsapp.trim().length >= 8) nota += 10;
  else riscos.push('Confirmar canal oficial de contato do responsável.');
  if (typeof proposal.email === 'string' && proposal.email.includes('@')) nota += 10;

  riscos.push('Exigir cláusula LGPD/sigilo antes de compartilhar dados de clientes com o parceiro.');
  riscos.push('Validar regularidade fiscal (CNPJ/RUT) e ausência de conflito com normas migratórias.');

  return {
    rascunho: true,
    nota: Math.min(100, nota),
    riscos,
    baseAplicada: `[${AI_FALLBACK_LABEL}] Referências cadastradas: ${citations.join(' · ')}`,
    sugestaoDecisao: 'indicar com ressalvas',
    textoIndicacao: `${empresa} — atuação em ${categoria} (${pais}${cidade ? ` · ${cidade}` : ''}). Pré-avaliação automática pelas regras internas; confirmar condições comerciais e compliance antes da homologação pública.`,
  };
}

// =============================================================================
// 4. /api/ai/norma fallback (texto e/ou anexo)
// =============================================================================
export function buildNormaFallback(body: Record<string, unknown>) {
  const currentSource = (body.currentSource && typeof body.currentSource === 'object' ? body.currentSource : {}) as Record<string, unknown>;
  const newText = typeof body.newText === 'string' ? body.newText.trim() : '';
  const hasAttachment = typeof body.fileBase64 === 'string' && body.fileBase64.length > 0;
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
  const inspected = inspectUploadedDocumentBinary(body.fileBase64, mimeType);

  const articleMatches = newText
    ? Array.from(new Set(newText.match(/(?:Art\.?|Artículo)\s*\d+[°ºo]?(?:\s*[-,–]\s*[A-Za-z0-9]+)?/gi) || [])).slice(0, 12)
    : [];

  const currentTitle = typeof currentSource.titulo === 'string' ? currentSource.titulo : 'Norma cadastrada';
  const currentArtigos = typeof currentSource.artigos === 'string' ? currentSource.artigos : '';
  const currentResumo = typeof currentSource.resumoPortugues === 'string' ? currentSource.resumoPortugues : '';
  const currentCliente = typeof currentSource.explicacaoCliente === 'string' ? currentSource.explicacaoCliente : '';

  const lower = newText.toLowerCase();
  const impactosVistos: string[] = [];
  if (lower.includes('mercosul') || lower.includes('mercosur') || lower.includes('reciproc')) {
    impactosVistos.push('Possível menção a Acordo Mercosul / Subcategoria 15 (conferir regra de permanência e trabalho).');
  }
  if (lower.includes('turis') || lower.includes('transitoria') || lower.includes('prorroga')) {
    impactosVistos.push('Impacto potencial em Permanencia Transitoria / mudança de categoria dentro do Chile.');
  }
  if (lower.includes('apostil') || lower.includes('antecedent') || lower.includes('certid')) {
    impactosVistos.push('Possível alteração de exigência documental, apostilamento ou validade de certidões.');
  }
  if (lower.includes('definitiv') || lower.includes('24 mes') || lower.includes('180 d')) {
    impactosVistos.push('Verificar impacto em prazos de análise ou elegibilidade para Residência Definitiva.');
  }
  if (impactosVistos.length === 0) {
    impactosVistos.push('Revisar manualmente quais subcategorias de visto foram afetadas pelo novo texto/anexo.');
  }

  const divergencias: string[] = [];
  if (newText && currentResumo && newText.slice(0, 120) !== currentResumo.slice(0, 120)) {
    divergencias.push('Texto enviado difere do resumo vigente cadastrado — comparar dispositivos antes de publicar nova versão.');
  }
  if (hasAttachment) {
    const fileInfo = inspected
      ? `${inspected.kind.toUpperCase()} (${inspected.sizeKb} KB${inspected.estimatedPages ? `, ~${inspected.estimatedPages} pág.` : ''})`
      : mimeType || 'arquivo';
    divergencias.push(`Anexo ${fileInfo} inspecionado pelo servidor; leitura semântica completa por IA indisponível no momento — validar conteúdo visualmente.`);
  }
  if (divergencias.length === 0) {
    divergencias.push('Sem divergências textuais automáticas detectadas; confirmar manualmente com a fonte oficial.');
  }

  return {
    rascunho: true,
    artigosExtraidos:
      articleMatches.length > 0
        ? articleMatches.join(', ')
        : currentArtigos || (hasAttachment ? 'Anexo recebido — extrair artigos manualmente' : 'fonte a cadastrar'),
    resumoExecutivo: `[${AI_FALLBACK_LABEL}] Comparação preliminar de "${currentTitle}". ${
      newText
        ? `Trecho recebido (${newText.length} caracteres): ${newText.slice(0, 260)}${newText.length > 260 ? '…' : ''}`
        : hasAttachment
          ? `Anexo ${inspected?.kind.toUpperCase() || mimeType || 'binário'} recebido para conferência manual.`
          : currentResumo || 'fonte a cadastrar'
    }`,
    explicacaoCliente:
      currentCliente ||
      'Rascunho gerado pelas regras cadastradas. O consultor deve validar a redação simples antes de publicar aos clientes.',
    impactosVistos,
    divergencias,
  };
}

export async function buildNormaVerificarFallback(
  body: Record<string, unknown>,
  options?: { timeoutMs?: number; fetchFn?: FetchLike; skipLiveCheck?: boolean },
) {
  const currentSource = (body.currentSource && typeof body.currentSource === 'object' ? body.currentSource : {}) as Record<string, unknown>;
  const titulo = typeof currentSource.titulo === 'string' && currentSource.titulo.trim() ? currentSource.titulo.trim() : 'Norma SERMIG/BCN';
  const numeroAno = typeof currentSource.numeroAno === 'string' ? currentSource.numeroAno.trim() : '';
  const linkOficial =
    typeof currentSource.linkOficial === 'string' && currentSource.linkOficial.trim()
      ? currentSource.linkOficial.trim()
      : 'https://serviciomigraciones.cl';
  const clienteAtual =
    typeof currentSource.explicacaoCliente === 'string' && currentSource.explicacaoCliente.trim()
      ? currentSource.explicacaoCliente.trim()
      : 'Consulte o portal oficial do SERMIG ou a BCN LeyChile para confirmar a redação vigente.';
  const artigosAtual =
    typeof currentSource.artigos === 'string' && currentSource.artigos.trim() ? currentSource.artigos.trim() : 'fonte a cadastrar';

  const isTestEnv =
    process.env.NODE_ENV === 'test' ||
    Boolean(process.env.NODE_TEST_CONTEXT) ||
    process.argv.includes('--test') ||
    process.execArgv.includes('--test');
  const shouldRunLiveHttp = !options?.skipLiveCheck && (Boolean(options?.fetchFn) || !isTestEnv);

  let liveDetail = '';
  let situacaoAtual = 'Confirmar na fonte oficial';
  let divergencias: string[] = [
    'Pesquisa semântica em nuvem indisponível no momento; nenhuma alteração normativa foi aplicada automaticamente.',
  ];

  if (shouldRunLiveHttp) {
    try {
      const check = await checkOfficialLegalSourceUrl(
        { id: String(currentSource.id || 'norma'), titulo, url: linkOficial },
        { timeoutMs: options?.timeoutMs ?? 3500, fetchFn: options?.fetchFn },
      );
      if (check.status === 'online' || check.status === 'redirect') {
        situacaoAtual = `Portal acessível ao vivo (HTTP ${check.httpStatus ?? 200})`;
        liveDetail = ` Verificação HTTP ao vivo confirmou resposta do portal${check.pageTitle ? ` ("${check.pageTitle}")` : ''}${check.lastModified ? ` · Last-Modified: ${check.lastModified}` : ''} em ${check.latencyMs} ms.`;
        divergencias = [
          `Link oficial respondeu com HTTP ${check.httpStatus ?? 200}; pesquisa semântica por IA indisponível no momento — revise o conteúdo na página oficial antes de alterar.`,
        ];
      } else if (check.status === 'degraded') {
        situacaoAtual = 'Portal com firewall governamental — abrir link oficial';
        liveDetail = ` O portal oficial retornou proteção anti-bot/timeout (${check.detail}).`;
        divergencias = [check.detail];
      } else {
        situacaoAtual = 'Portal indisponível ou URL divergente';
        liveDetail = ` A checagem HTTP ao vivo registrou: ${check.detail}`;
        divergencias = [check.detail];
      }
    } catch {
      // Keep safe manual check note
    }
  }

  return {
    rascunho: true,
    possuiAtualizacao: false,
    situacaoAtual,
    artigosExtraidos: artigosAtual,
    resumoExecutivo: `[${AI_FALLBACK_LABEL}] Verificação de "${titulo}"${numeroAno ? ` (${numeroAno})` : ''}.${liveDetail || ' Mantenha o texto vigente e confira diretamente o link oficial antes de publicar alterações.'} Link oficial: ${linkOficial}.`,
    explicacaoCliente: clienteAtual,
    impactosVistos: ['Conferência humana recomendada no portal oficial antes de alterar checklists de visto.'],
    divergencias,
    fontesCitadas: [linkOficial, 'https://serviciomigraciones.cl', 'https://www.bcn.cl/leychile'],
  };
}

// =============================================================================
// 5. /api/ai/custos fallback
// =============================================================================
export function buildCustosFallback(body: Record<string, unknown>) {
  const cur = (body.currentCustos && typeof body.currentCustos === 'object' ? body.currentCustos : {}) as Record<string, unknown>;
  const num = (key: string, def: number) => (typeof cur[key] === 'number' && Number.isFinite(cur[key] as number) ? (cur[key] as number) : def);

  return {
    estimativa: true,
    taxaSermigMercosulUsd: num('taxaSermigMercosulUsd', 90),
    taxaSermigTemporalUsd: num('taxaSermigTemporalUsd', 90),
    taxaSermigDefinitivaUsd: num('taxaSermigDefinitivaUsd', 120),
    apostilaCnjBrl: num('apostilaCnjBrl', 185),
    traducaoJuramentadaBrl: num('traducaoJuramentadaBrl', 210),
    cedulaIdentidadeClp: num('cedulaIdentidadeClp', 4270),
    observacao: `${AI_FALLBACK_LABEL} Valores mantidos da tabela referencial atual — estimativa: confirmar na fonte oficial (SERMIG, CNJ e Registro Civil).`,
    atualizadoEm: formatDatePtBr(),
  };
}

// =============================================================================
// 6. /api/ai/analisar-documento fallback (anexo obrigatório/opcional)
// =============================================================================
export function buildAnalisarDocumentoFallback(body: Record<string, unknown>) {
  const nomeEsperado = typeof body.nomeEsperado === 'string' && body.nomeEsperado.trim() ? body.nomeEsperado.trim() : 'Documento do checklist';
  const obs = typeof body.textoObservacao === 'string' ? body.textoObservacao : '';
  const hasFile =
    (typeof body.fileBase64 === 'string' && body.fileBase64.length > 0) ||
    (typeof body.arquivoUrl === 'string' && body.arquivoUrl.trim().length > 0);
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType : '';
  const inspected = inspectUploadedDocumentBinary(body.fileBase64, mimeType);

  const dateMatch = obs.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
  const dataEmissao = dateMatch ? dateMatch[1] : inspected?.detectedDate || 'Não informada';
  const possuiApostila =
    /apostilad[oa]\s*(marcado)?:\s*true/i.test(obs) ||
    /apostila/i.test(nomeEsperado) ||
    Boolean(inspected?.detectedKeywords.includes('Apostila/Haia'));

  let orgaoEmissor = 'fonte a cadastrar';
  const lowerNome = nomeEsperado.toLowerCase();
  if (lowerNome.includes('antecedent') || lowerNome.includes('passaporte') || inspected?.detectedKeywords.includes('Polícia Federal')) {
    orgaoEmissor = 'Polícia Federal (Brasil) / órgão emissor oficial';
  } else if (
    lowerNome.includes('certid') ||
    lowerNome.includes('nascimento') ||
    lowerNome.includes('casamento') ||
    inspected?.detectedKeywords.includes('Registro Civil')
  ) {
    orgaoEmissor = 'Cartório de Registro Civil / Registro Civil do Chile';
  } else if (lowerNome.includes('matríc') || lowerNome.includes('univers') || lowerNome.includes('estud')) {
    orgaoEmissor = 'Instituição de Ensino reconhecida no Chile';
  } else if (lowerNome.includes('contrat') || lowerNome.includes('ofert')) {
    orgaoEmissor = 'Empregador chileno / Notaría';
  }

  let legibilidade = 'Sem anexo binário legível — conferência manual necessária';
  let sugestao: 'Revisar' | 'Reprovar' = 'Revisar';
  let techSummary = '';

  if (inspected) {
    if (!inspected.validHeader) {
      legibilidade = `Cabeçalho de arquivo divergente (${inspected.sizeKb} KB) — verificar integridade antes de aprovar`;
      sugestao = 'Reprovar';
      techSummary = ' Cabeçalho binário inconsistente com PDF/PNG/JPEG/WEBP.';
    } else if (inspected.kind === 'pdf') {
      const encWarn = inspected.encrypted ? ' · PDF protegido/criptografado' : '';
      const pagesInfo = inspected.estimatedPages ? `, ~${inspected.estimatedPages} pág.` : '';
      const kwInfo = inspected.detectedKeywords.length > 0 ? ` · Indícios: ${inspected.detectedKeywords.join(', ')}` : '';
      legibilidade = `PDF v${inspected.pdfVersion || '1.x'} válido (${inspected.sizeKb} KB${pagesInfo}${encWarn}) — conferir visualmente`;
      techSummary = ` Inspeção local identificou PDF válido${pagesInfo}${kwInfo}.`;
    } else if (inspected.width && inspected.height) {
      const lowRes = inspected.width < 600 || inspected.height < 600;
      legibilidade = `${inspected.kind.toUpperCase()} ${inspected.width}x${inspected.height} px (${inspected.sizeKb} KB)${lowRes ? ' — resolução baixa, confirmar legibilidade' : ' — boa resolução nominal'}`;
      techSummary = ` Imagem ${inspected.kind.toUpperCase()} validada (${inspected.width}x${inspected.height} px).`;
    } else {
      legibilidade = `${inspected.kind.toUpperCase()} válido (${inspected.sizeKb} KB) — conferência visual pelo analista`;
    }
  } else if (hasFile) {
    legibilidade = `Anexo referenciado (${mimeType || 'arquivo'}) — conferência visual obrigatória pelo analista`;
  }

  return {
    rascunho: true,
    nomeIdentificado: nomeEsperado,
    dataEmissao,
    orgaoEmissor,
    idioma: 'Português / Espanhol (confirmar visualmente)',
    possuiApostila,
    legibilidade,
    sugestao,
    justificativa: `${AI_FALLBACK_LABEL}. Pré-conferência gerada por regras e inspeção estrutural do arquivo (${nomeEsperado}).${techSummary} A decisão final permanece exclusivamente com o analista.`,
  };
}
