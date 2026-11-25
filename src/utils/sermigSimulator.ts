import type { EmpresaConfig, VisaCategory, VisaRequirement } from '../types/domain';

export type SermigLocationOption =
  | 'brasil_exterior'
  | 'chile_turista'
  | 'chile_residente';

export type SermigCurrency = 'BRL' | 'CLP' | 'USD';

export interface SermigSimulationInput {
  visaId?: string;
  visaCode?: string;
  localizacaoAtual: SermigLocationOption;
  /** Data-alvo de protocolo no SERMIG ou embarque (ISO YYYY-MM-DD) */
  dataAlvoProtocolo: string;
  quantidadeDependentes: number;
  possuiAntecedentesLimpos: boolean;
  possuiPassaporteValido12m: boolean;
  possuiComprovacaoFinanceiraOuContrato: boolean;
  vinculoFamiliarChile: boolean;
  moedaExibicao: SermigCurrency;
  taxaUsdParaBrl?: number;
  taxaBrlParaClp?: number;
}

export interface SermigAlertItem {
  nivel: 'critico' | 'atencao' | 'info';
  titulo: string;
  detalhe: string;
  baseLegal: string;
}

export interface SermigTimelineMilestone {
  ordem: number;
  marco: string;
  dataSugeridaIso: string;
  janelaLegal: string;
  alerta?: string;
}

export interface SermigCostLineItem {
  item: string;
  detalhe: string;
  valorOriginal: number;
  moedaOriginal: SermigCurrency;
  valorBrl: number;
  valorClp: number;
  valorUsd: number;
}

export interface SermigSimulationResult {
  visa: VisaCategory;
  elegibilidadeStatus: 'elegivel' | 'condicional' | 'bloqueio_legal';
  elegibilidadeLabel: string;
  pontuacaoAdesao: number;
  resumoExecutivo: string;
  protocoloPermitidoNoChile: boolean;
  requerSaidaDoChile: boolean;
  alertasLegais: SermigAlertItem[];
  cronogramaReverso: SermigTimelineMilestone[];
  custos: {
    itens: SermigCostLineItem[];
    totalBrl: number;
    totalClp: number;
    totalUsd: number;
    taxaUsdParaBrl: number;
    taxaBrlParaClp: number;
    totalPessoas: number;
  };
  documentosChave: {
    nome: string;
    validadeDias?: number;
    exigeApostila: boolean;
    exigeTraducao: boolean;
    obrigatorio: boolean;
  }[];
  prazoEstimadoAnaliseMeses: { min: number; max: number };
}

const DEFAULT_USD_TO_BRL = 5.45;
const DEFAULT_BRL_TO_CLP = 175;

function parseIsoUtc(iso: string): number {
  const clean = (iso || '').trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function shiftIsoDays(baseIso: string, deltaDays: number): string {
  const ms = parseIsoUtc(baseIso) + deltaDays * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Seleciona a VisaCategory correspondente ao input do simulador,
 * garantindo fallback determinístico para Mercosul (15) ou primeiro visto ativo.
 */
export function resolveSimulatedVisa(
  visaCategories: VisaCategory[],
  visaId?: string,
  visaCode?: string,
): VisaCategory {
  if (visaId) {
    const byId = visaCategories.find((v) => v.id === visaId);
    if (byId) return byId;
  }
  if (visaCode) {
    const norm = visaCode.trim().toUpperCase();
    const byCode = visaCategories.find((v) => v.codigo.trim().toUpperCase() === norm);
    if (byCode) return byCode;
  }
  const mercosul = visaCategories.find((v) => v.codigo === '15' || v.id.includes('mercosul'));
  if (mercosul) return mercosul;
  if (visaCategories.length > 0) return visaCategories[0];

  return {
    id: 'visa_mercosul_fallback',
    codigo: '15',
    nomeEspanhol: 'Residencia Temporal por Acuerdos Internacionales (Mercosur)',
    nomePortugues: 'Residência Temporal – Acordo Mercosul',
    descricao: 'Residência temporal por reciprocidade do Acordo Mercosul para cidadãos brasileiros.',
    publicoAlvo: 'Brasileiros com documentação civil e antecedentes em ordem',
    permiteDentroChile: 'Não',
    vigenciaMeses: 24,
    permiteTrabalhar: true,
    levaDefinitiva: true,
    mesesDefinitiva: 24,
    exigeRenda: false,
    brasileirosElegiveis: true,
    ativo: true,
    fonteUrl: 'https://serviciomigraciones.cl/residencia-temporal/acuerdos-internacionales/',
    statusVerificacao: 'Verificado',
  };
}

/**
 * Executa simulação técnica completa do processo no SERMIG (Ley Nº 21.325 / Decreto Nº 177/2022),
 * calculando elegibilidade, alertas legais, cronograma reverso com prazos de 60d/90d/30d e custos multi-moeda.
 */
export function runSermigSimulation(
  input: SermigSimulationInput,
  visaCategories: VisaCategory[],
  visaRequirements: VisaRequirement[],
  empresa?: Partial<EmpresaConfig>,
): SermigSimulationResult {
  const visa = resolveSimulatedVisa(visaCategories, input.visaId, input.visaCode);
  const dependentes = Math.max(0, Math.min(8, Math.floor(Number(input.quantidadeDependentes) || 0)));
  const totalPessoas = 1 + dependentes;

  const usdToBrl =
    input.taxaUsdParaBrl && input.taxaUsdParaBrl > 0
      ? input.taxaUsdParaBrl
      : empresa?.taxaCambioUsdBrl || DEFAULT_USD_TO_BRL;
  const brlToClp =
    input.taxaBrlParaClp && input.taxaBrlParaClp > 0
      ? input.taxaBrlParaClp
      : empresa?.taxaCambioBrlClp || DEFAULT_BRL_TO_CLP;

  const isProrrogacaoOuDefinitiva = ['PRORR', 'DEF', 'MUD'].includes(visa.codigo.toUpperCase());
  const isReunificacao = visa.codigo === '01' || visa.id.includes('reunific');

  let score = 88;
  const alertasLegais: SermigAlertItem[] = [];
  let requerSaidaDoChile = false;
  let protocoloPermitidoNoChile = false;

  // 1. Verificação de localização vs Ley Nº 21.325 / Decreto 177/2022
  if (input.localizacaoAtual === 'chile_turista') {
    if (isProrrogacaoOuDefinitiva) {
      score -= 55;
      requerSaidaDoChile = true;
      alertasLegais.push({
        nivel: 'critico',
        titulo: 'Incompatibilidade: Prorrogação/Definitiva exige Residência Temporal vigente',
        detalhe:
          'Quem está em Permanencia Transitoria (turista) não pode protocolar Prorrogação de Residência ou Residência Definitiva diretamente.',
        baseLegal: 'Ley Nº 21.325, Arts. 69 e 78',
      });
    } else if (visa.permiteDentroChile === 'Sim' || (isReunificacao && input.vinculoFamiliarChile)) {
      protocoloPermitidoNoChile = true;
      score += 4;
      alertasLegais.push({
        nivel: 'info',
        titulo: 'Exceção legal aplicável dentro do Chile',
        detalhe:
          'A subcategoria selecionada admite solicitação a partir de território chileno mediante comprovação documental do vínculo/enquadramento.',
        baseLegal: 'Ley Nº 21.325, Art. 69 · Decreto Nº 177/2022',
      });
    } else if (visa.permiteDentroChile === 'Condicional') {
      protocoloPermitidoNoChile = Boolean(input.vinculoFamiliarChile);
      if (!input.vinculoFamiliarChile) {
        score -= 28;
        requerSaidaDoChile = true;
        alertasLegais.push({
          nivel: 'critico',
          titulo: 'Regra de solicitação do exterior (Permanencia Transitoria)',
          detalhe:
            'Pela Ley Nº 21.325, turistas sem hipótese excepcional de vínculo familiar formalizado precisam protocolar a primeira Residência Temporal estando fora do Chile.',
          baseLegal: 'Ley Nº 21.325, Art. 69 · Decreto Nº 177/2022',
        });
      }
    } else {
      score -= 42;
      requerSaidaDoChile = true;
      alertasLegais.push({
        nivel: 'critico',
        titulo: 'Bloqueio legal: Subcategoria exige protocolo fora do Chile',
        detalhe: `A subcategoria "${visa.nomePortugues}" não permite troca de status de turista para residente dentro do Chile. É obrigatório protocolar a partir do Brasil/exterior.`,
        baseLegal: 'Ley Nº 21.325, Art. 69 · Decreto Supremo Nº 177/2022',
      });
    }
  } else if (input.localizacaoAtual === 'chile_residente') {
    protocoloPermitidoNoChile = true;
    score += 5;
    alertasLegais.push({
      nivel: 'info',
      titulo: 'Residente regular no Chile: atenção à janela de 90 a 10 dias',
      detalhe:
        'Para prorrogação, mudança de subcategoria ou Residência Definitiva, o protocolo eletrônico deve ocorrer estritamente entre 90 e 10 dias antes do vencimento da cédula atual.',
      baseLegal: 'Decreto Supremo Nº 296/2022 · Circular SERMIG',
    });
  } else {
    // No Brasil / Exterior
    if (isProrrogacaoOuDefinitiva) {
      score -= 30;
      alertasLegais.push({
        nivel: 'atencao',
        titulo: 'Verifique ausências e residência vigente no Chile',
        detalhe:
          'Pedidos de Prorrogação ou Residência Definitiva pressupõem Residência Temporal prévia ativa e limites legais de permanência fora do Chile.',
        baseLegal: 'Ley Nº 21.325, Arts. 78 e 79',
      });
    } else {
      score += 6;
      alertasLegais.push({
        nivel: 'info',
        titulo: 'Rota padrão regular (protocolo do exterior)',
        detalhe:
          'Protocolar a partir do Brasil/exterior segue integralmente a regra geral da Ley Nº 21.325, permitindo aguardar aprovação e embarcar com Estampado Electrónico.',
        baseLegal: 'Ley Nº 21.325, Art. 69',
      });
    }
  }

  // 2. Condições documentais críticas
  if (!input.possuiAntecedentesLimpos) {
    score -= 45;
    alertasLegais.push({
      nivel: 'critico',
      titulo: 'Impedimento potencial em Antecedentes Criminais',
      detalhe:
        'Registros criminais positivos podem gerar causal de rejeição ou inadmissibilidade no SERMIG. Exige parecer jurídico individual antes de qualquer taxa.',
      baseLegal: 'Ley Nº 21.325, Art. 32 e Art. 88',
    });
  }

  if (!input.possuiPassaporteValido12m) {
    score -= 18;
    alertasLegais.push({
      nivel: 'atencao',
      titulo: 'Passaporte com validade curta (< 12 meses)',
      detalhe:
        'Recomenda-se renovar o passaporte brasileiro antes de emitir a certidão da Polícia Federal e protocolar no SERMIG para evitar divergência de número no Estampado.',
      baseLegal: 'Instruções Operacionais SERMIG',
    });
  }

  if (visa.exigeRenda && !input.possuiComprovacaoFinanceiraOuContrato) {
    score -= 22;
    alertasLegais.push({
      nivel: 'atencao',
      titulo: 'Comprovação financeira ou vínculo contratual pendente',
      detalhe: `A subcategoria "${visa.nomePortugues}" requer demonstração documental de renda, contrato de trabalho, matrícula ou investimento compatível.`,
      baseLegal: 'Decreto Supremo Nº 177/2022',
    });
  }

  if (dependentes > 0) {
    alertasLegais.push({
      nivel: 'info',
      titulo: `Núcleo familiar com ${dependentes} dependente(s)`,
      detalhe:
        'Certidões de casamento/união estável e nascimento dos dependentes devem ser apostiladas (CNJ) e vinculadas ao protocolo do titular (ou pedido de dependente).',
      baseLegal: 'Ley Nº 21.325, Art. 74 · Decreto Nº 5.852/2006',
    });
  }

  const pontuacaoAdesao = Math.max(10, Math.min(99, Math.round(score)));
  const hasCritical = alertasLegais.some((a) => a.nivel === 'critico');

  const elegibilidadeStatus: SermigSimulationResult['elegibilidadeStatus'] = hasCritical
    ? 'bloqueio_legal'
    : pontuacaoAdesao >= 75
      ? 'elegivel'
      : 'condicional';

  const elegibilidadeLabel =
    elegibilidadeStatus === 'elegivel'
      ? 'Rota Elegível & Consistente'
      : elegibilidadeStatus === 'condicional'
        ? 'Viável com Ajustes Prévios'
        : 'Restrição Legal Crítica Detectada';

  // 3. Cronograma Reverso de Prazos Legais (baseado na data-alvo do protocolo)
  const protocoloIso = shiftIsoDays(input.dataAlvoProtocolo, 0);
  const prazoMinMeses = visa.codigo === 'DEF' ? 6 : 3;
  const prazoMaxMeses = visa.codigo === 'DEF' ? 12 : 6;
  const estimativaAprovacaoDias = Math.round(((prazoMinMeses + prazoMaxMeses) / 2) * 30);

  const cronogramaReverso: SermigTimelineMilestone[] = [
    {
      ordem: 1,
      marco: 'Certidões Civis (Nascimento/Casamento) + Apostila CNJ',
      dataSugeridaIso: shiftIsoDays(protocoloIso, -35),
      janelaLegal: '30 a 45 dias antes do protocolo',
      alerta: 'Emita certidões de inteiro teor antes da Polícia Federal para não queimar a validade curta dos antecedentes.',
    },
    {
      ordem: 2,
      marco: 'Emissão de Antecedentes Criminais (Polícia Federal) + Apostila',
      dataSugeridaIso: shiftIsoDays(protocoloIso, -15),
      janelaLegal: 'Validade máxima legal: 60 dias corridos',
      alerta: 'Regra crítica SERMIG: antecedentes com mais de 60 dias na data do protocolo geram subsanación ou rejeição.',
    },
    {
      ordem: 3,
      marco: 'Protocolo Eletrônico Oficial no Portal SERMIG',
      dataSugeridaIso: protocoloIso,
      janelaLegal: protocoloPermitidoNoChile ? 'Protocolo digital (dentro do Chile)' : 'Protocolo digital (a partir do exterior)',
    },
    {
      ordem: 4,
      marco: 'Estimativa de Resolução & Pagamento de Direitos SERMIG',
      dataSugeridaIso: shiftIsoDays(protocoloIso, estimativaAprovacaoDias),
      janelaLegal: `Referência média: ${prazoMinMeses} a ${prazoMaxMeses} meses (Ley 19.880)`,
    },
    {
      ordem: 5,
      marco: 'Download do Estampado Electrónico & Ingresso no Chile',
      dataSugeridaIso: shiftIsoDays(protocoloIso, estimativaAprovacaoDias + 30),
      janelaLegal: 'Prazo máximo de entrada: 90 dias corridos após o Estampado',
    },
    {
      ordem: 6,
      marco: 'Registro PDI & Cédula de Identidade para Estrangeiros (RUN)',
      dataSugeridaIso: shiftIsoDays(protocoloIso, estimativaAprovacaoDias + 50),
      janelaLegal: 'Solicitar em até 30 dias corridos após ingresso/estampado',
    },
    {
      ordem: 7,
      marco: visa.levaDefinitiva
        ? 'Janela de Pedido de Residência Definitiva ou Prorrogação'
        : 'Janela de Prorrogação / Mudança de Subcategoria',
      dataSugeridaIso: shiftIsoDays(
        protocoloIso,
        estimativaAprovacaoDias + (visa.mesesDefinitiva || visa.vigenciaMeses || 24) * 30 - 60,
      ),
      janelaLegal: 'Entre 90 e 10 dias antes do vencimento da residência',
    },
  ];

  // 4. Estimativa de Custos Oficiais Multi-moeda (Titular + Dependentes)
  const taxaSermigUnitUsd =
    visa.codigo.toUpperCase() === 'DEF'
      ? empresa?.custosPadrao?.taxaSermigDefinitivaUsd || 110
      : visa.codigo === '15'
        ? empresa?.custosPadrao?.taxaSermigMercosulUsd || 90
        : empresa?.custosPadrao?.taxaSermigTemporalUsd || 90;
  const apostilaUnitBrl = empresa?.custosPadrao?.apostilaCnjBrl || 145;
  const traducaoUnitBrl = empresa?.custosPadrao?.traducaoJuramentadaBrl || 180;
  const cedulaUnitClp = empresa?.custosPadrao?.cedulaIdentidadeClp || 4270;

  // Quantidade referencial de documentos apostilados e traduzidos
  const apostilasTitular = visa.codigo === '15' ? 2 : 3;
  const apostilasPorDep = 2;
  const totalApostilas = apostilasTitular + dependentes * apostilasPorDep;

  // Para Mercosul (Decreto 5.852/2006), traduções costumam ser dispensadas ou mínimas; outras subcategorias exigem ~2 traduções
  const traducoesTotal = visa.codigo === '15' ? 0 : 2 + dependentes;

  const toAllCurrencies = (amount: number, currency: SermigCurrency) => {
    if (currency === 'USD') {
      const brl = round2(amount * usdToBrl);
      return { valorBrl: brl, valorClp: Math.round(brl * brlToClp), valorUsd: round2(amount) };
    }
    if (currency === 'CLP') {
      const brl = round2(amount / brlToClp);
      return { valorBrl: brl, valorClp: Math.round(amount), valorUsd: round2(brl / usdToBrl) };
    }
    return {
      valorBrl: round2(amount),
      valorClp: Math.round(amount * brlToClp),
      valorUsd: round2(amount / usdToBrl),
    };
  };

  const itens: SermigCostLineItem[] = [
    {
      item: 'Direitos Migratórios Oficiais (SERMIG)',
      detalhe: `Estimativa de USD ${taxaSermigUnitUsd} × ${totalPessoas} pessoa(s) — pago após aprovação`,
      valorOriginal: taxaSermigUnitUsd * totalPessoas,
      moedaOriginal: 'USD',
      ...toAllCurrencies(taxaSermigUnitUsd * totalPessoas, 'USD'),
    },
    {
      item: 'Apostilamento de Haia (Cartórios CNJ)',
      detalhe: `${totalApostilas} documento(s) estimados × R$ ${apostilaUnitBrl}`,
      valorOriginal: totalApostilas * apostilaUnitBrl,
      moedaOriginal: 'BRL',
      ...toAllCurrencies(totalApostilas * apostilaUnitBrl, 'BRL'),
    },
  ];

  if (traducoesTotal > 0) {
    itens.push({
      item: 'Traduções Juramentadas (Português → Espanhol)',
      detalhe: `${traducoesTotal} documento(s) estimados × R$ ${traducaoUnitBrl}`,
      valorOriginal: traducoesTotal * traducaoUnitBrl,
      moedaOriginal: 'BRL',
      ...toAllCurrencies(traducoesTotal * traducaoUnitBrl, 'BRL'),
    });
  }

  itens.push({
    item: 'Cédula de Identidade para Estrangeiros (Registro Civil Chile)',
    detalhe: `CLP ${cedulaUnitClp.toLocaleString('pt-BR')} × ${totalPessoas} pessoa(s)`,
    valorOriginal: cedulaUnitClp * totalPessoas,
    moedaOriginal: 'CLP',
    ...toAllCurrencies(cedulaUnitClp * totalPessoas, 'CLP'),
  });

  const totalBrl = round2(itens.reduce((acc, i) => acc + i.valorBrl, 0));
  const totalClp = Math.round(itens.reduce((acc, i) => acc + i.valorClp, 0));
  const totalUsd = round2(itens.reduce((acc, i) => acc + i.valorUsd, 0));

  // 5. Documentos-chave do checklist da subcategoria
  const matchedReqs = visaRequirements
    .filter((r) => r.visaCategoryId === visa.id)
    .sort((a, b) => (a.ordemPrioridadeEmissao || 99) - (b.ordemPrioridadeEmissao || 99));

  const documentosChave =
    matchedReqs.length > 0
      ? matchedReqs.slice(0, 8).map((r) => ({
          nome: r.nomeDocumento,
          validadeDias: r.validadeDias,
          exigeApostila: r.exigeApostila,
          exigeTraducao: r.exigeTraducao,
          obrigatorio: r.obrigatorio,
        }))
      : [
          { nome: 'Passaporte válido (página de identificação)', validadeDias: 365, exigeApostila: false, exigeTraducao: false, obrigatorio: true },
          { nome: 'Certidão de Antecedentes Criminais (Polícia Federal)', validadeDias: 60, exigeApostila: true, exigeTraducao: visa.codigo !== '15', obrigatorio: true },
          { nome: 'Certidão de Nascimento / Casamento atualizada', validadeDias: 180, exigeApostila: true, exigeTraducao: visa.codigo !== '15', obrigatorio: true },
        ];

  const resumoExecutivo =
    elegibilidadeStatus === 'elegivel'
      ? `Cenário consistente para ${visa.nomePortugues} (${totalPessoas} ${totalPessoas === 1 ? 'pessoa' : 'pessoas'}). Acompanhe rigorosamente a janela de 60 dias dos Antecedentes PF antes do protocolo previsto para ${protocoloIso.split('-').reverse().join('/')}.`
      : elegibilidadeStatus === 'condicional'
        ? `A rota ${visa.nomePortugues} é viável, mas exige regularização prévia dos pontos de atenção indicados antes do protocolo oficial no SERMIG.`
        : `Atenção: existe bloqueio legal relevante na combinação atual (${visa.nomePortugues} + localização/perfil). Não realize protocolo ou pagamento de taxas antes de alinhar a estratégia com a consultoria.`;

  return {
    visa,
    elegibilidadeStatus,
    elegibilidadeLabel,
    pontuacaoAdesao,
    resumoExecutivo,
    protocoloPermitidoNoChile,
    requerSaidaDoChile,
    alertasLegais,
    cronogramaReverso,
    custos: {
      itens,
      totalBrl,
      totalClp,
      totalUsd,
      taxaUsdParaBrl: usdToBrl,
      taxaBrlParaClp: brlToClp,
      totalPessoas,
    },
    documentosChave,
    prazoEstimadoAnaliseMeses: { min: prazoMinMeses, max: prazoMaxMeses },
  };
}
