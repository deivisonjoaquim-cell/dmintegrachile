/**
 * Deterministic rule-based fallbacks for all /api/ai/* routes.
 * Used automatically whenever Gemini primary & backup models are unavailable
 * or return invalid output after retry. Never cites invented laws: uses ONLY
 * provided legalSources or literally writes "fonte a cadastrar".
 */

export const AI_FALLBACK_LABEL = 'Rascunho gerado por regras — IA indisponível no momento';

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

  const pontosAtencao =
    regrasAcionadas.length > 0
      ? regrasAcionadas.slice(0, 6)
      : ['Pré-enquadramento apurado pelas regras determinísticas da consultoria.'];

  return {
    rascunho: true,
    resumoExecutivo: `[${AI_FALLBACK_LABEL}] Pré-análise baseada estritamente nas regras cadastradas para a indicação "${subcategoria}" (localização atual: ${localizacao}). Revise os pontos de atenção e confirme a base documental antes de orientar o cliente.`,
    riscos,
    perguntasConsultor,
    pontosAtencao,
    fontesCitadas,
    proximosPassos: [
      'Validar passaporte e certidões sem validade curta antes de emitir Antecedentes da Polícia Federal (60 dias).',
      'Conferir exigência de Apostila da Haia e tradução juramentada para cada item do checklist.',
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
  const statusSermig = typeof caseData.statusSermig === 'string' ? caseData.statusSermig : 'Em preparação';
  const notaViabilidade =
    typeof caseData.notaViabilidadeGeral === 'number' ? `${caseData.notaViabilidadeGeral}/100` : 'a apurar';
  const nomeCliente = typeof clientData.nomeCompleto === 'string' ? clientData.nomeCompleto : 'Titular';
  const localizacao = typeof clientData.localizacaoAtual === 'string' ? clientData.localizacaoAtual : 'Brasil/Exterior';

  return {
    rascunho: true,
    enquadramentoLegal: `[${AI_FALLBACK_LABEL}]\nCaso: ${titulo} (${tipoServico}) para ${nomeCliente}.\nLocalização informada: ${localizacao}. Status atual no SERMIG: ${statusSermig}.\nEnquadramento orientativo preliminar definido conforme as regras ativas da subcategoria cadastrada.`,
    elegibilidadeRiscos: `Viabilidade geral registrada: ${notaViabilidade}. Grupo familiar com ${dependents.length} dependente(s) vinculado(s). Conferir passaporte vigente (>= 12 meses para protocolo do exterior), regularidade de entradas/saídas na PDI, apostilamento de Haia e emissão dentro do prazo de validade das certidões (especialmente Antecedentes de 60 dias).`,
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
    sugestaoDecisao: nota >= 80 ? 'indicar com ressalvas' : 'indicar com ressalvas',
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

  const articleMatches = newText
    ? Array.from(new Set(newText.match(/(?:Art\.?|Artículo)\s*\d+[°ºo]?(?:\s*[\-,–]\s*[A-Za-z0-9]+)?/gi) || [])).slice(0, 12)
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
    divergencias.push(`Anexo (${mimeType || 'arquivo'}) recebido no servidor; leitura automatizada por IA indisponível no momento — validar conteúdo visualmente.`);
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
          ? `Anexo ${mimeType || 'binário'} recebido para conferência manual.`
          : currentResumo || 'fonte a cadastrar'
    }`,
    explicacaoCliente:
      currentCliente ||
      'Rascunho gerado pelas regras cadastradas. O consultor deve validar a redação simples antes de publicar aos clientes.',
    impactosVistos,
    divergencias,
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

  const dateMatch = obs.match(/\b(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})\b/);
  const dataEmissao = dateMatch ? dateMatch[1] : 'Não informada';
  const possuiApostila = /apostilad[oa]\s*(marcado)?:\s*true/i.test(obs) || /apostila/i.test(nomeEsperado);

  let orgaoEmissor = 'fonte a cadastrar';
  const lowerNome = nomeEsperado.toLowerCase();
  if (lowerNome.includes('antecedent') || lowerNome.includes('passaporte')) {
    orgaoEmissor = 'Polícia Federal (Brasil) / órgão emissor oficial';
  } else if (lowerNome.includes('certid') || lowerNome.includes('nascimento') || lowerNome.includes('casamento')) {
    orgaoEmissor = 'Cartório de Registro Civil / Registro Civil do Chile';
  } else if (lowerNome.includes('matríc') || lowerNome.includes('univers') || lowerNome.includes('estud')) {
    orgaoEmissor = 'Instituição de Ensino reconhecida no Chile';
  } else if (lowerNome.includes('contrat') || lowerNome.includes('ofert')) {
    orgaoEmissor = 'Empregador chileno / Notaría';
  }

  return {
    rascunho: true,
    nomeIdentificado: nomeEsperado,
    dataEmissao,
    orgaoEmissor,
    idioma: 'Português / Espanhol (confirmar visualmente)',
    possuiApostila,
    legibilidade: hasFile
      ? `Anexo recebido (${mimeType || 'arquivo'}) — conferência visual obrigatória pelo analista`
      : 'Sem anexo binário legível — conferência manual necessária',
    sugestao: 'Revisar',
    justificativa: `${AI_FALLBACK_LABEL}. Pré-conferência gerada por regras a partir dos metadados do checklist (${nomeEsperado}). A decisão final permanece exclusivamente com o analista.`,
  };
}
