import type {
  DiagnosticAnswers,
  DiagnosticLocation,
  DiagnosticObjective,
} from '../types/domain';
import type { DiagnosticResult } from './diagnosticEngine';

export interface DetectedCaseSignal {
  id: string;
  category: 'localizacao' | 'perfil' | 'objetivo' | 'familia' | 'documento' | 'prazo' | 'risco';
  label: string;
  tone: 'positivo' | 'atencao' | 'neutro';
}

export interface SmartCaseParseResult {
  patch: Partial<DiagnosticAnswers>;
  detectedSignals: DetectedCaseSignal[];
  matchedCount: number;
  summaryLine: string;
}

export interface LiveRadarSnapshot {
  score: number;
  routeCode: string;
  routeName: string;
}

export interface LiveRouteRaceItem {
  codigo: string;
  nomePortugues: string;
  nota: number;
  compatibilityPct: number;
  highlightTag: string;
  isLeader: boolean;
}

export interface LiveBottleneckOptimizer {
  pillarName: string;
  currentPct: number;
  potentialBoostPts: number;
  actionTitle: string;
  actionDetail: string;
  targetStep: number;
}

export interface LiveDiagnosticIntelligence {
  scoreDelta: number;
  routeChanged: boolean;
  previousRouteName?: string;
  currentRouteName: string;
  impactBanner: {
    headline: string;
    detail: string;
    tone: 'positivo' | 'atencao' | 'neutro';
  } | null;
  routeRace: LiveRouteRaceItem[];
  bottleneckOptimizer: LiveBottleneckOptimizer | null;
  smartTimeline: {
    docPrep: string;
    sermigWait: string;
    pfWarning: string;
  };
}

export interface SmartDiagnosticBrief {
  headline: string;
  whyLeaderWon: string;
  topStrength: {
    pillar: string;
    scoreLabel: string;
    note: string;
  };
  primaryBottleneck: {
    pillar: string;
    scoreLabel: string;
    note: string;
  } | null;
  smartNextMoves: string[];
}

export const SMART_CASE_EXAMPLES: Array<{ id: string; label: string; text: string }> = [
  {
    id: 'mercosul_familia',
    label: 'Casal + filho pelo Mercosul',
    text: 'Sou brasileiro, moro em São Paulo, quero me mudar para Santiago em 2 meses com minha esposa e 1 filho pelo Mercosul.',
  },
  {
    id: 'trabalho_oferta',
    label: 'Oferta de trabalho no Chile',
    text: 'Sou brasileiro no Brasil, recebi proposta de contrato formal de uma empresa chilena em Santiago para iniciar em 3 meses.',
  },
  {
    id: 'turista_casado',
    label: 'Turista casado com chilena',
    text: 'Estou no Chile como turista, sou casado oficialmente com chilena e preciso regularizar minha residência.',
  },
  {
    id: 'aposentado_passaporte',
    label: 'Aposentado com renda passiva',
    text: 'Sou brasileiro aposentado com renda mensal de 3000 dólares, pretendo mudar em 4 meses mas meu passaporte vence em 5 meses.',
  },
];

function normalizeInput(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSmallNumberPt(token: string): number {
  const map: Record<string, number> = {
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
  };
  if (map[token] !== undefined) return map[token];
  const n = Number(token);
  return Number.isFinite(n) && n > 0 ? Math.min(10, Math.round(n)) : 1;
}

/**
 * Deterministic Portuguese/Spanish free-text case interpreter.
 * Extracts verifiable facts into structured DiagnosticAnswers without hallucination.
 */
export function parseFreeTextCaseToAnswers(rawText: string): SmartCaseParseResult {
  const norm = normalizeInput(rawText);
  if (!norm || norm.length < 6) {
    return {
      patch: {},
      detectedSignals: [],
      matchedCount: 0,
      summaryLine: 'Descreva brevemente sua localização, objetivo e se vai sozinho ou com família.',
    };
  }

  const patch: Partial<DiagnosticAnswers> = {};
  const signals: DetectedCaseSignal[] = [];

  // 1. Localização atual
  let detectedLocation: DiagnosticLocation | null = null;
  if (
    /(estou|estoy|to|estando|vim|entrei|ingresei).{0,30}(chile).{0,30}(turist|transitori|passei|visit)/.test(norm) ||
    /(turista no chile|como turista no chile|no chile como turista|en chile como turista)/.test(norm)
  ) {
    detectedLocation = 'No Chile como turista';
    patch.localizacao = detectedLocation;
    signals.push({
      id: 'loc_turista',
      category: 'localizacao',
      label: 'No Chile como turista (alerta Art. 69)',
      tone: 'atencao',
    });
  } else if (
    /(ja moro|ja vivo|ja resido|moro no chile|vivo no chile|residente no chile|tenho residencia|tengo residencia|com residencia|prorrogacao|renovacao|residencia definitiva)/.test(norm) &&
    /(chile|santiago|valparaiso|vina|concepcion|residencia|visto|temporaria|temporal|definitiva)/.test(norm)
  ) {
    detectedLocation = 'No Chile com residência';
    patch.localizacao = detectedLocation;
    const yearsMatch = norm.match(/(?:ha|hace|tenho|tengo|com)\s+(\d+)\s+ano/);
    const monthsMatch = norm.match(/(?:ha|hace|tenho|tengo|com)\s+(\d+)\s+mes/);
    if (yearsMatch) {
      patch.mesesResidenciaChile = Math.min(240, Number(yearsMatch[1]) * 12);
    } else if (monthsMatch) {
      patch.mesesResidenciaChile = Math.min(240, Number(monthsMatch[1]));
    }
    signals.push({
      id: 'loc_residente',
      category: 'localizacao',
      label: patch.mesesResidenciaChile
        ? `Residente no Chile (${patch.mesesResidenciaChile} meses)`
        : 'Residente vigente no Chile',
      tone: 'positivo',
    });
  } else if (
    /(moro no brasil|estou no brasil|no brasil|sao paulo|rio de janeiro|belo horizonte|curitiba|porto alegre|brasilia|salvador|recife|fortaleza|florianopolis|campinas|goiania|manaus|belem|vitoria|sp\b|rj\b|mg\b|pr\b|rs\b|sc\b|ba\b|pe\b|ce\b|df\b)/.test(
      norm,
    )
  ) {
    detectedLocation = 'No Brasil';
    patch.localizacao = detectedLocation;
    signals.push({
      id: 'loc_brasil',
      category: 'localizacao',
      label: 'Protocolo a partir do Brasil',
      tone: 'positivo',
    });
  } else if (/(europa|portugal|espanha|eua|estados unidos|argentina|uruguai|paraguai|canada|outro pais|exterior)/.test(norm)) {
    detectedLocation = 'Em outro país';
    patch.localizacao = detectedLocation;
    signals.push({
      id: 'loc_exterior',
      category: 'localizacao',
      label: 'Protocolo a partir do exterior',
      tone: 'positivo',
    });
  }

  // 2. Nacionalidade
  if (/(nao sou brasileir|estrangeir|venezuelan|haitian|colombian|cuban|mexican|portugues|italian|espanhol|american)/.test(norm)) {
    const isAlsoBr = /(dupla nacionalidade|tambem sou brasileir|sou brasileiro e|sou brasileira e)/.test(norm);
    if (isAlsoBr) {
      patch.nacionalidadeBrasileira = true;
      patch.possuiSegundaNacionalidade = true;
      signals.push({
        id: 'nat_dupla',
        category: 'perfil',
        label: 'Nacionalidade brasileira + dupla cidadania',
        tone: 'positivo',
      });
    } else if (/nao sou brasileir/.test(norm)) {
      patch.nacionalidadeBrasileira = false;
      signals.push({
        id: 'nat_estrangeira',
        category: 'perfil',
        label: 'Nacionalidade não brasileira',
        tone: 'neutro',
      });
    }
  } else if (/(brasileir|mercosul|mercosur)/.test(norm)) {
    patch.nacionalidadeBrasileira = true;
    signals.push({
      id: 'nat_br',
      category: 'perfil',
      label: 'Brasileiro(a) · Elegível ao Mercosul',
      tone: 'positivo',
    });
  }

  // 3. Passaporte
  if (/(passaporte vencid|passaporte expirad|pasaporte vencid)/.test(norm)) {
    patch.passaporteStatus = 'vencido';
    patch.passaporteValidadeMeses = 0;
    signals.push({
      id: 'doc_pass_vencido',
      category: 'documento',
      label: 'Passaporte vencido (gargalo prioritário)',
      tone: 'atencao',
    });
  } else if (/(nao tenho passaporte|sem passaporte|nao possui passaporte|sin pasaporte)/.test(norm)) {
    patch.passaporteStatus = 'nao_possui';
    patch.passaporteValidadeMeses = 0;
    signals.push({
      id: 'doc_pass_sem',
      category: 'documento',
      label: 'Sem passaporte emitido',
      tone: 'atencao',
    });
  } else {
    const passMonths = norm.match(/passaporte.{0,28}(?:vence|valido|validade|restam|faltam|de)\s+(?:em\s+)?(\d+)\s+mes/);
    if (passMonths) {
      const m = Math.max(1, Math.min(120, Number(passMonths[1])));
      patch.passaporteStatus = 'valido';
      patch.passaporteValidadeMeses = m;
      signals.push({
        id: 'doc_pass_prazo',
        category: 'documento',
        label: `Passaporte válido por ${m} meses`,
        tone: m < 12 ? 'atencao' : 'positivo',
      });
    }
  }

  // 4. Vínculo familiar no Chile
  const hasChileanSpouse =
    /(casad[oa]|uniao estavel|uniao civil|auc|conjuge|espos[oa]|marido|companheir[oa]).{0,35}(chilen[oa]|no chile|residente)/.test(
      norm,
    );
  const hasChileanChild = /(filh[oa]s?|bebe).{0,25}(chilen[oa]|nascid[oa] no chile)/.test(norm);
  if (hasChileanSpouse || hasChileanChild) {
    patch.vinculoFamiliarChile = true;
    patch.vinculoTipo = hasChileanChild ? 'Filho(a) chileno(a)' : 'Cônjuge/União Civil';
    const isUnformalized = /(namorad|nao casad|sem certidao|ainda nao formaliz|nao formaliz)/.test(norm);
    patch.vinculoFormalizado = !isUnformalized;
    patch.familiarStatusChile = /(residente temporal|visto temporario)/.test(norm)
      ? 'residente_temporal'
      : /(residente definitivo|definitiva)/.test(norm)
        ? 'residente_definitivo'
        : 'chileno';
    signals.push({
      id: 'fam_vinculo_cl',
      category: 'familia',
      label: isUnformalized
        ? 'Vínculo no Chile (pendente formalização)'
        : `Vínculo formalizado no Chile (${patch.vinculoTipo})`,
      tone: isUnformalized ? 'atencao' : 'positivo',
    });
  }

  // 5. Família acompanhante / dependentes
  const hasPartnerAccompanying =
    !hasChileanSpouse && /(minha esposa|meu marido|meu conjuge|minha companheira|meu companheiro|com esposa|com marido|em casal|casal)/.test(norm);
  const childCountMatch = norm.match(/(\d+|um|uma|dois|duas|tres|quatro)\s+filh[oa]s?/);
  const hasChildrenAccompanying =
    !hasChileanChild && (Boolean(childCountMatch) || /(com filhos|familia com filhos|criancas)/.test(norm));

  if (hasPartnerAccompanying || hasChildrenAccompanying) {
    const childCount = childCountMatch ? parseSmallNumberPt(childCountMatch[1]) : hasChildrenAccompanying ? 1 : 0;
    const depTotal = (hasPartnerAccompanying ? 1 : 0) + childCount;
    patch.familiaAcompanhante = true;
    patch.quantidadeDependentes = Math.max(1, depTotal);
    patch.composicaoFamiliar = hasChildrenAccompanying
      ? 'familia_com_filhos'
      : 'casal';
    signals.push({
      id: 'fam_acomp',
      category: 'familia',
      label: `Mudança familiar (${patch.quantidadeDependentes} dependente${patch.quantidadeDependentes > 1 ? 's' : ''})`,
      tone: 'neutro',
    });
  } else if (/(sozinh[oa]|individual|apenas eu|solo)/.test(norm)) {
    patch.familiaAcompanhante = false;
    patch.composicaoFamiliar = 'individual';
    patch.quantidadeDependentes = 0;
  }

  // 6. Objetivo principal SERMIG
  let detectedObjective: DiagnosticObjective | null = null;
  if (/(oferta de trabalho|proposta de trabalho|proposta de emprego|contrato formal|contrato de trabalho|empresa chilena|contratado por)/.test(norm)) {
    detectedObjective = 'trabalho_formal';
    patch.objetivo = detectedObjective;
    patch.possuiOfertaTrabalhoFormal = true;
    signals.push({
      id: 'obj_trabalho',
      category: 'objetivo',
      label: 'Oferta / Contrato formal no Chile',
      tone: 'positivo',
    });
  } else if (/(aposentad|jubilad|renda passiva|rentista|pensao|dividendos|alugueis)/.test(norm)) {
    detectedObjective = 'aposentado_renda';
    patch.objetivo = detectedObjective;
    patch.possuiRendaPassiva = true;
    const usdMatch = norm.match(/(\d[\d.,]*)\s*(?:mil\s*)?(?:dolares|usd|us\$)/);
    if (usdMatch) {
      const numeric = Number(usdMatch[1].replace(/\./g, '').replace(',', '.'));
      const valUsd = /mil/.test(usdMatch[0]) && numeric < 100 ? numeric * 1000 : numeric;
      if (valUsd >= 2500) patch.faixaRendaMensalUsd = 'acima_2500';
      else if (valUsd >= 1000) patch.faixaRendaMensalUsd = '1000_2500';
      else patch.faixaRendaMensalUsd = 'abaixo_1000';
    } else {
      patch.faixaRendaMensalUsd = 'acima_2500';
    }
    signals.push({
      id: 'obj_rentista',
      category: 'objetivo',
      label: 'Aposentado / Renda passiva (Rentista)',
      tone: 'positivo',
    });
  } else if (/(estudar|universidade|faculdade|mestrado|doutorado|pos-graduacao|intercambio|matricula)/.test(norm)) {
    detectedObjective = 'estudar';
    patch.objetivo = detectedObjective;
    if (/(matricula|aceite|carta de aceitacao|aprovado)/.test(norm)) {
      patch.possuiMatriculaReconhecida = true;
    }
    signals.push({
      id: 'obj_estudo',
      category: 'objetivo',
      label: 'Estudos reconhecidos no Chile',
      tone: 'neutro',
    });
  } else if (/(investir|investidor|abrir empresa|empreender|negocio proprio|spa no chile|capital)/.test(norm)) {
    detectedObjective = 'empreender_investir';
    patch.objetivo = detectedObjective;
    if (/(capital|500|investimento|recursos)/.test(norm)) {
      patch.possuiCapitalComprovadoOrigem = true;
    }
    signals.push({
      id: 'obj_invest',
      category: 'objetivo',
      label: 'Empreender / Investir no Chile',
      tone: 'neutro',
    });
  } else if (/(nomade digital|trabalho remoto|remoto para o brasil|remoto para fora|home office)/.test(norm)) {
    detectedObjective = 'nomade_digital';
    patch.objetivo = detectedObjective;
    signals.push({
      id: 'obj_nomade',
      category: 'objetivo',
      label: 'Trabalho remoto / Nômade digital',
      tone: 'positivo',
    });
  } else if (/(tratamento medico|saude|cirurgia|hospital)/.test(norm)) {
    detectedObjective = 'tratamento_medico';
    patch.objetivo = detectedObjective;
    signals.push({
      id: 'obj_medico',
      category: 'objetivo',
      label: 'Tratamento médico no Chile',
      tone: 'neutro',
    });
  } else if (/(mercosul|mercosur|morar no chile|mudar para o chile|mudar para santiago|viver no chile)/.test(norm)) {
    detectedObjective = 'explorar';
    patch.objetivo = detectedObjective;
    signals.push({
      id: 'obj_mercosul',
      category: 'objetivo',
      label: 'Residência geral / Rota Mercosul',
      tone: 'positivo',
    });
  }

  // 7. Prazo pretendido
  if (/(imediato|urgente|esse mes|este mes|proximo mes|em 2 semanas|em 15 dias|em 30 dias|ja quero ir)/.test(norm)) {
    patch.prazoPretendido = 'Imediato (até 30 dias)';
    signals.push({
      id: 'prazo_imediato',
      category: 'prazo',
      label: 'Prazo imediato (até 30 dias)',
      tone: 'atencao',
    });
  } else if (/(em 1 mes|em 2 meses|em 3 meses|daqui a 2 meses|daqui a 3 meses|1 a 3 meses)/.test(norm)) {
    patch.prazoPretendido = '1 a 3 meses';
    signals.push({
      id: 'prazo_1_3',
      category: 'prazo',
      label: 'Horizonte de 1 a 3 meses',
      tone: 'neutro',
    });
  } else if (/(em 4 meses|em 5 meses|em 6 meses|daqui a 4 meses|daqui a 6 meses|3 a 6 meses|semestre)/.test(norm)) {
    patch.prazoPretendido = '3 a 6 meses';
    signals.push({
      id: 'prazo_3_6',
      category: 'prazo',
      label: 'Horizonte de 3 a 6 meses',
      tone: 'positivo',
    });
  } else if (/(proximo ano|ano que vem|mais de 6 meses|em 1 ano|em 8 meses|em 10 meses|em 12 meses)/.test(norm)) {
    patch.prazoPretendido = 'Mais de 6 meses';
    signals.push({
      id: 'prazo_6_mais',
      category: 'prazo',
      label: 'Planejamento de longo prazo (6+ meses)',
      tone: 'positivo',
    });
  }

  // 8. Riscos preventivos mencionados explicitamente
  if (/(overstay|passei dos 90 dias|turismo vencido|multa pdi|irregular no chile)/.test(norm)) {
    patch.overstay = true;
    signals.push({
      id: 'risk_overstay',
      category: 'risco',
      label: 'Alerta de permanência além do prazo (Overstay)',
      tone: 'atencao',
    });
  }
  if (/(ordem de abandono|orden de abandono|expulsao)/.test(norm)) {
    patch.ordenAbandono = true;
    signals.push({
      id: 'risk_abandono',
      category: 'risco',
      label: 'Menção a ordem de abandono',
      tone: 'atencao',
    });
  }
  if (/(visto negado|residencia negada|indeferid|rechazad)/.test(norm)) {
    patch.rejeicaoAnterior = true;
    signals.push({
      id: 'risk_rejeicao',
      category: 'risco',
      label: 'Histórico de indeferimento anterior',
      tone: 'atencao',
    });
  }

  // Evita falso match de país caso apenas cidade tenha sido mencionada sem nada mais
  if (!detectedLocation && detectedObjective === 'explorar' && signals.length === 1) {
    patch.localizacao = 'No Brasil';
  }

  const matchedCount = signals.length;
  const summaryLine =
    matchedCount > 0
      ? `${matchedCount} ${matchedCount === 1 ? 'parâmetro identificado' : 'parâmetros identificados'} automaticamente para pré-configurar seu diagnóstico SERMIG.`
      : 'Nenhum parâmetro específico reconhecido ainda — mencione onde você está (ex.: Brasil ou Chile), objetivo (trabalho, estudo, renda, Mercosul) e se vai com família.';

  return {
    patch,
    detectedSignals: signals,
    matchedCount,
    summaryLine,
  };
}

function getRouteAdvantageTag(codigo: string, permiteDentroChile: string, permiteTrabalhar: boolean): string {
  if (codigo === '15') return 'Dispensa oferta · Trabalho livre';
  if (codigo === '01') return 'Exceção dentro do Chile';
  if (codigo === '02') return 'Via contrato formal no Chile';
  if (codigo === '11') return 'Renda passiva / Aposentadoria';
  if (codigo === '03') return 'Matrícula reconhecida';
  if (codigo === '13') return 'Investimento / Negócio';
  if (permiteDentroChile === 'Sim') return 'Admite protocolo no Chile';
  return permiteTrabalhar ? 'Permite atividade laboral' : 'Requer comprovação específica';
}

/**
 * Computes real-time intelligence metrics for the live Radar sidebar:
 * - Score delta & route shift pulse
 * - Top-3 competing SERMIG route race
 * - Fastest score optimizer (single highest-impact bottleneck)
 * - Reverse timeline preview
 */
export function computeLiveDiagnosticIntelligence(
  answers: DiagnosticAnswers,
  result: DiagnosticResult,
  previousSnapshot: LiveRadarSnapshot | null,
): LiveDiagnosticIntelligence {
  const currentScore = Math.round(result.viabilidade?.total || 0);
  const currentRouteCode = result.recomendada?.visa.codigo || '';
  const currentRouteName = result.recomendada?.visa.nomePortugues || 'Análise em andamento';

  const scoreDelta = previousSnapshot ? currentScore - previousSnapshot.score : 0;
  const routeChanged = Boolean(
    previousSnapshot && previousSnapshot.routeCode && currentRouteCode && previousSnapshot.routeCode !== currentRouteCode,
  );

  let impactBanner: LiveDiagnosticIntelligence['impactBanner'] = null;
  if (routeChanged && previousSnapshot) {
    impactBanner = {
      headline: `Nova rota líder: Cód. ${currentRouteCode}`,
      detail: `Seu perfil migrou de "${previousSnapshot.routeName}" para "${currentRouteName}" (${scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} pts).`,
      tone: scoreDelta >= 0 ? 'positivo' : 'atencao',
    };
  } else if (Math.abs(scoreDelta) >= 3) {
    impactBanner = {
      headline: scoreDelta > 0 ? `Viabilidade subiu +${scoreDelta} pts` : `Viabilidade ajustada em ${scoreDelta} pts`,
      detail:
        scoreDelta > 0
          ? 'Sua última resposta fortaleceu a aderência normativa ou a prontidão documental do caso.'
          : 'Sua última resposta ativou um ponto de atenção normativa ou documental no Radar de 7 pilares.',
      tone: scoreDelta > 0 ? 'positivo' : 'atencao',
    };
  }

  // Top-3 Competing Routes Race (combina top3 direto com comparativoMercosul para manter sempre 3 rotas comparáveis)
  const seenCodes = new Set<string>();
  const rawCandidates = [
    ...(result.top3 || []),
    result.comparativoMercosul?.segundaOpcao,
    result.comparativoMercosul?.mercosul,
    result.comparativoMercosul?.terceiraOpcao,
  ].filter((c): c is NonNullable<typeof c> => Boolean(c && c.visa?.codigo && c.nota > 0));

  const topCandidates: typeof rawCandidates = [];
  for (const cand of rawCandidates) {
    if (seenCodes.has(cand.visa.codigo)) continue;
    seenCodes.add(cand.visa.codigo);
    topCandidates.push(cand);
    if (topCandidates.length >= 3) break;
  }

  const maxNota = Math.max(100, ...topCandidates.map((c) => c.nota || 0));
  const routeRace: LiveRouteRaceItem[] = topCandidates.map((cand, idx) => ({
    codigo: cand.visa.codigo,
    nomePortugues: cand.visa.nomePortugues,
    nota: Math.round(cand.nota),
    compatibilityPct: Math.max(12, Math.min(100, Math.round((cand.nota / maxNota) * 100))),
    highlightTag: getRouteAdvantageTag(
      cand.visa.codigo,
      cand.visa.permiteDentroChile,
      Boolean(cand.visa.permiteTrabalhar),
    ),
    isLeader: idx === 0,
  }));

  // Single highest-impact bottleneck optimizer
  const dims = result.viabilidade?.dimensoes || [];
  let bottleneckOptimizer: LiveBottleneckOptimizer | null = null;
  const rankedGaps = dims
    .map((d) => ({
      dim: d,
      missing: Math.max(0, d.maximo - d.pontos),
      pct: d.maximo > 0 ? Math.round((d.pontos / d.maximo) * 100) : 100,
    }))
    .filter((item) => item.missing >= 3)
    .sort((a, b) => b.missing - a.missing);

  if (rankedGaps.length > 0) {
    const worst = rankedGaps[0];
    const name = worst.dim.nome;
    let actionTitle = `Elevar ${name}`;
    let actionDetail = worst.dim.observacao;
    let targetStep = 6;

    if (name.includes('Elegibilidade')) {
      targetStep = answers.localizacao === 'No Chile como turista' ? 2 : 4;
      actionTitle =
        answers.localizacao === 'No Chile como turista'
          ? 'Ajustar local de protocolo (Art. 69)'
          : 'Fortalecer enquadramento na subcategoria';
      actionDetail =
        answers.localizacao === 'No Chile como turista'
          ? 'Protocolar do Brasil/exterior ou comprovar vínculo familiar formalizado desbloqueia a rota principal.'
          : worst.dim.observacao;
    } else if (name.includes('Documental')) {
      targetStep = answers.passaporteStatus !== 'valido' || (answers.passaporteValidadeMeses ?? 24) < 12 ? 2 : 6;
      actionTitle =
        answers.passaporteStatus !== 'valido' || (answers.passaporteValidadeMeses ?? 24) < 12
          ? 'Regularizar validade do passaporte'
          : 'Adiantar emissão e Apostila de Haia';
      actionDetail =
        answers.passaporteStatus !== 'valido' || (answers.passaporteValidadeMeses ?? 24) < 12
          ? 'Passaporte válido com folga (≥ 12 meses) evita travamento no portal SERMIG.'
          : 'Organizar certidões civis e apostilamentos eleva diretamente a prontidão antes dos Antecedentes PF.';
    } else if (name.includes('Financeira')) {
      targetStep = 4;
      actionTitle = 'Alinhar comprovação de renda ou rota Mercosul';
    } else if (name.includes('Histórico') || name.includes('Riscos')) {
      targetStep = 5;
      actionTitle = 'Revisar ocorrências migratórias preventivamente';
    } else if (name.includes('Prazo')) {
      targetStep = 6;
      actionTitle = 'Adequar janela cronológica ao SERMIG';
    } else if (name.includes('Familiar')) {
      targetStep = 3;
      actionTitle = 'Mapear documentação de dependentes';
    }

    bottleneckOptimizer = {
      pillarName: name,
      currentPct: worst.pct,
      potentialBoostPts: Math.min(worst.missing, 25),
      actionTitle,
      actionDetail,
      targetStep,
    };
  }

  return {
    scoreDelta,
    routeChanged,
    previousRouteName: previousSnapshot?.routeName,
    currentRouteName,
    impactBanner,
    routeRace,
    bottleneckOptimizer,
    smartTimeline: {
      docPrep: result.cronogramaFaixas?.preparacaoDocumental || '2 a 4 semanas',
      sermigWait: result.cronogramaFaixas?.respostaSermig || '3 a 8 meses',
      pfWarning: 'Antecedentes da Polícia Federal vencem em 60 dias — emitir sempre por último.',
    },
  };
}

/**
 * Generates a grounded, zero-hallucination strategic executive brief for the final Diagnostic Report.
 */
export function buildSmartDiagnosticBrief(
  answers: DiagnosticAnswers,
  result: DiagnosticResult,
): SmartDiagnosticBrief {
  const score = Math.round(result.viabilidade?.total || 0);
  const leader = result.recomendada;
  const runnerUpCandidate =
    result.top3?.[1] ||
    (result.comparativoMercosul?.segundaOpcao &&
    result.comparativoMercosul.segundaOpcao.visa.codigo !== leader?.visa.codigo &&
    result.comparativoMercosul.segundaOpcao.nota > 0
      ? result.comparativoMercosul.segundaOpcao
      : null) ||
    (result.comparativoMercosul?.terceiraOpcao &&
    result.comparativoMercosul.terceiraOpcao.visa.codigo !== leader?.visa.codigo &&
    result.comparativoMercosul.terceiraOpcao.nota > 0
      ? result.comparativoMercosul.terceiraOpcao
      : null);
  const dims = result.viabilidade?.dimensoes || [];

  const headline = leader
    ? `Seu perfil alcançou ${score}/100 (${result.viabilidade.veredito}) com liderança da subcategoria ${leader.visa.codigo} — ${leader.visa.nomePortugues}.`
    : `Seu perfil alcançou ${score}/100 (${result.viabilidade.veredito}) e requer validação complementar de enquadramento.`;

  let whyLeaderWon =
    'Preencha os parâmetros complementares com o consultor para desempatar a subcategoria mais vantajosa.';
  if (leader && runnerUpCandidate) {
    const leaderScore = Math.round(leader.nota);
    const runnerScore = Math.round(runnerUpCandidate.nota);
    const scoreDiff = leaderScore - runnerScore;
    if (scoreDiff > 0) {
      whyLeaderWon = `A rota ${leader.visa.nomePortugues} (${leaderScore} pts) superou ${runnerUpCandidate.visa.nomePortugues} (${runnerScore} pts) por ${scoreDiff} ${scoreDiff === 1 ? 'ponto' : 'pontos'} de aderência ao seu perfil atual (${answers.localizacao}).`;
    } else {
      whyLeaderWon = `A rota ${leader.visa.nomePortugues} (${leaderScore} pts) assume prioridade normativa sobre ${runnerUpCandidate.visa.nomePortugues} (${runnerScore} pts) pela sua situação atual (${answers.localizacao}), oferecendo o enquadramento juridicamente mais seguro para o protocolo.`;
    }
  } else if (leader) {
    whyLeaderWon = `A rota ${leader.visa.nomePortugues} é a mais aderente ao conjunto de requisitos legais informados na triagem.`;
  }

  const sortedByPct = [...dims].sort((a, b) => {
    const pctA = a.maximo > 0 ? a.pontos / a.maximo : 0;
    const pctB = b.maximo > 0 ? b.pontos / b.maximo : 0;
    return pctB - pctA;
  });

  const best = sortedByPct[0] || { nome: 'Elegibilidade Legal', pontos: 20, maximo: 25, observacao: 'Base normativa consistente.' };
  const worst = sortedByPct[sortedByPct.length - 1];
  const worstPct = worst && worst.maximo > 0 ? Math.round((worst.pontos / worst.maximo) * 100) : 100;

  const smartNextMoves: string[] = [];
  if (answers.localizacao === 'No Chile como turista' && !(answers.vinculoFamiliarChile && answers.vinculoFormalizado)) {
    smartNextMoves.push('Planeje a saída regular do Chile para protocolar sua Residência Temporal a partir do exterior conforme a Ley Nº 21.325.');
  }
  if (answers.passaporteStatus !== 'valido' || (answers.passaporteValidadeMeses ?? 24) < 12) {
    smartNextMoves.push('Priorize a emissão ou renovação do passaporte brasileiro antes de solicitar certidões com validade curta.');
  }
  if (result.flagsRisco.length > 0 || result.flagsRevisaoConsultor.length > 0) {
    smartNextMoves.push('Separe comprovantes ou datas das ocorrências assinaladas para validação sigilosa antes de enviar o protocolo ao SERMIG.');
  }
  if (smartNextMoves.length < 3) {
    smartNextMoves.push('Organize certidões civis e Apostila de Haia primeiro; emita os Antecedentes Criminais da Polícia Federal por último (validade de 60 dias).');
  }
  if (smartNextMoves.length < 3) {
    smartNextMoves.push('Use o Simulador "E se..." abaixo para comparar o impacto prático de cada decisão no seu Radar antes da reunião técnica.');
  }
  if (smartNextMoves.length < 3) {
    smartNextMoves.push('Alinhe sua janela de protocolo e a validade do passaporte com o especialista D&M antes de emitir documentos ou comprar passagens.');
  }

  return {
    headline,
    whyLeaderWon,
    topStrength: {
      pillar: best.nome,
      scoreLabel: `${best.pontos}/${best.maximo}`,
      note: best.observacao,
    },
    primaryBottleneck:
      worst && worstPct < 85
        ? {
            pillar: worst.nome,
            scoreLabel: `${worst.pontos}/${worst.maximo}`,
            note: worst.observacao,
          }
        : null,
    smartNextMoves: smartNextMoves.slice(0, 3),
  };
}
