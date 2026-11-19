import {
  SEED_LEGAL_SOURCES,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type {
  DiagnosticAnswers,
  DiagnosticObjective,
  LegalSource,
  VisaCategory,
  VisaRequirement,
} from '../types/domain';
import {
  isMercosulEligibleNationality,
  isYes,
  runDiagnosticEngine,
  type EngineOptions,
} from './diagnosticEngine';
import { formatLegalCitationInline, getJurisdictionLabel } from './legalJurisdiction';

export interface SermigDynamicDocOption {
  value: string;
  label: string;
  meta: string;
  sermigRequirementId?: string;
  obrigatorio: boolean;
  validadeDias: number;
}

export interface SermigObjectiveMeta {
  objetivo: DiagnosticObjective;
  visaCode: string;
  nomePortugues: string;
  nomeEspanhol: string;
  permiteDentroChile: VisaCategory['permiteDentroChile'];
  vigenciaMeses: number;
  levaDefinitiva: boolean;
  mesesDefinitiva: number;
  permiteTrabalhar: boolean;
  exigeRenda: boolean;
  fonteUrl: string;
  legalSourcesLabel: string;
  resumoSermig: string;
}

export interface LiveSermigPreview {
  prontoParaPrevia: boolean;
  subcategoriaLider: {
    codigo: string;
    nomePortugues: string;
    nomeEspanhol: string;
    nota: number;
  } | null;
  alternativas: { codigo: string; nomePortugues: string; nota: number }[];
  regraProtocolo: 'exterior' | 'chile_permitido' | 'chile_residente';
  regraProtocoloTitulo: string;
  regraProtocoloDetalhe: string;
  alertaPrincipal: string | null;
  requisitosObrigatoriosCount: number;
  requisitosPrazoCurtoCount: number;
  fontesLegais: { id: string; titulo: string; numeroAno: string; jurisdicao: string; pais: LegalSource['pais'] }[];
  elegivelMercosul: boolean;
  situacaoResidenciaAtual: 'Prorrogação' | 'Residência Definitiva em análise' | null;
}

const OBJECTIVE_TO_SERMIG_CODE: Record<DiagnosticObjective, string> = {
  explorar: '15',
  nomade_digital: '15',
  trabalho_formal: '02',
  servicos_90d: '02',
  empreender_investir: '13',
  estudar: '03',
  aposentado_renda: '11',
  tratamento_medico: '10',
  religioso: '09',
  humanitario: '07',
  temporada: '04',
  dependente_titular: 'DEP',
};

/**
 * Higieniza automaticamente campos dependentes quando uma resposta-mãe muda,
 * impedindo estados contraditórios ou respostas residuais de objetivos anteriores.
 */
export function sanitizeDiagnosticAnswers(
  prev: DiagnosticAnswers,
  patch: Partial<DiagnosticAnswers>,
): DiagnosticAnswers {
  const next: DiagnosticAnswers = { ...prev, ...patch };

  // 1. Mudança de localização atual
  if (patch.localizacao !== undefined && patch.localizacao !== prev.localizacao) {
    if (patch.localizacao !== 'No Chile com residência') {
      next.mesesResidenciaChile = 0;
      next.residenteSubcategoriaAtual = undefined;
      next.residenteVenceEmDias = undefined;
      next.residenteMesesForaUltimoAno = undefined;
    } else {
      next.entradaRecenteChileTurista = false;
      if (!next.residenteSubcategoriaAtual) next.residenteSubcategoriaAtual = '15';
      if (!next.residenteVenceEmDias) next.residenteVenceEmDias = 'mais_90';
    }
    if (patch.localizacao === 'No Chile como turista') {
      next.entradaRecenteChileTurista = false;
    }
  }

  // 2. Se mesesResidenciaChile < 24, limpar ausências de Definitiva
  if (patch.mesesResidenciaChile !== undefined) {
    const meses = Math.max(0, Math.min(240, Number.isNaN(Number(patch.mesesResidenciaChile)) ? 0 : Number(patch.mesesResidenciaChile)));
    next.mesesResidenciaChile = meses;
    if (meses < 24) {
      next.residenteMesesForaUltimoAno = undefined;
    }
  }

  // 3. Segunda nacionalidade desativada -> limpa texto residual
  if (patch.possuiSegundaNacionalidade === false) {
    next.segundaNacionalidadeQual = '';
  }

  // 4. Passaporte: sincroniza status e meses de validade sem permitir inconsistência
  if (patch.passaporteStatus !== undefined) {
    if (patch.passaporteStatus === 'vencido' || patch.passaporteStatus === 'nao_possui') {
      next.passaporteValidadeMeses = 0;
    } else if (patch.passaporteStatus === 'valido') {
      const currentMonths = patch.passaporteValidadeMeses ?? next.passaporteValidadeMeses ?? 0;
      next.passaporteValidadeMeses = currentMonths > 0 ? currentMonths : 24;
    }
  } else if (patch.passaporteValidadeMeses !== undefined) {
    const sanitizedMonths = Math.max(
      0,
      Math.min(120, Number.isNaN(Number(patch.passaporteValidadeMeses)) ? 0 : Number(patch.passaporteValidadeMeses)),
    );
    next.passaporteValidadeMeses = sanitizedMonths;
    if (next.passaporteStatus === 'vencido' && sanitizedMonths > 0) {
      next.passaporteStatus = 'valido';
    } else if (next.passaporteStatus === 'valido' && sanitizedMonths === 0) {
      next.passaporteStatus = 'vencido';
    }
  }

  // 5. Vínculo familiar no Chile desativado -> limpa subcampos
  if (patch.vinculoFamiliarChile === false) {
    next.vinculoFormalizado = false;
    next.familiarStatusChile = undefined;
  } else if (patch.vinculoFamiliarChile === true && !next.familiarStatusChile) {
    next.familiarStatusChile = 'chileno';
  }

  // 6. Mudança de objetivo -> zera flags específicas de outros objetivos para não contaminar o motor
  if (patch.objetivo !== undefined && patch.objetivo !== prev.objetivo) {
    const obj = patch.objetivo;
    if (obj !== 'trabalho_formal' && obj !== 'servicos_90d') {
      next.possuiOfertaTrabalhoFormal = false;
      next.contratoNotariadoEmpresaChilena = undefined;
    }
    if (obj !== 'estudar') {
      next.possuiMatriculaReconhecida = false;
    }
    if (obj !== 'aposentado_renda') {
      next.possuiRendaPassiva = false;
    }
    if (obj !== 'empreender_investir') {
      next.possuiCapitalComprovadoOrigem = false;
      next.investimentoAcima500kUsd = undefined;
    }
    if (obj !== 'dependente_titular') {
      next.titularTemResidenciaChile = false;
    }
    if (obj !== 'tratamento_medico') {
      next.possuiCertificadoMedicoChile = undefined;
    }
    if (obj !== 'religioso') {
      next.possuiRespaldoEntidadeReligiosa = undefined;
    }
    if (obj !== 'temporada') {
      next.possuiContratoSazonal = undefined;
    }
    if (obj !== 'humanitario') {
      next.motivoHumanitarioTipo = undefined;
    } else if (!next.motivoHumanitarioTipo) {
      next.motivoHumanitarioTipo = 'protecao_vulnerabilidade';
    }
  }

  // 7. Sub-flags condicionais da Etapa 4
  if (patch.possuiOfertaTrabalhoFormal === false) {
    next.contratoNotariadoEmpresaChilena = undefined;
  }
  if (patch.possuiCapitalComprovadoOrigem === false) {
    next.investimentoAcima500kUsd = undefined;
  }

  // 8. Família acompanhante na Etapa 6
  if (patch.familiaAcompanhante === false) {
    next.composicaoFamiliar = 'individual';
    next.quantidadeDependentes = 0;
    next.pessoasFamilia = [];
  } else if (patch.familiaAcompanhante === true) {
    if (!next.composicaoFamiliar || next.composicaoFamiliar === 'individual') {
      next.composicaoFamiliar = 'casal';
    }
    if (!next.quantidadeDependentes || next.quantidadeDependentes < 1) {
      next.quantidadeDependentes = 1;
    }
  }

  return next;
}

/**
 * Retorna os metadados oficiais da subcategoria SERMIG associada ao objetivo selecionado.
 */
export function getSermigObjectiveMeta(
  objetivo: DiagnosticObjective | '',
  visaCategories: VisaCategory[] = SEED_VISA_CATEGORIES,
  legalSources: LegalSource[] = SEED_LEGAL_SOURCES,
): SermigObjectiveMeta | null {
  if (!objetivo) return null;
  const cats = visaCategories.length > 0 ? visaCategories : SEED_VISA_CATEGORIES;
  const sources = legalSources.length > 0 ? legalSources : SEED_LEGAL_SOURCES;
  const code = OBJECTIVE_TO_SERMIG_CODE[objetivo] || '15';
  const visa = cats.find((c) => c.codigo === code) || SEED_VISA_CATEGORIES.find((c) => c.codigo === code);
  if (!visa) return null;

  const matchedSources = (visa.legalSourceIds || [])
    .map((id) => sources.find((s) => s.id === id))
    .filter((s): s is LegalSource => Boolean(s));

  const legalSourcesLabel =
    matchedSources.length > 0
      ? matchedSources
          .slice(0, 2)
          .map((s) => formatLegalCitationInline(s))
          .join(' · ')
      : 'Ley Nº 21.325 (Legislação Chilena) · Decreto Supremo Nº 177/2022 (Legislação Chilena)';

  return {
    objetivo,
    visaCode: visa.codigo,
    nomePortugues: visa.nomePortugues,
    nomeEspanhol: visa.nomeEspanhol,
    permiteDentroChile: visa.permiteDentroChile,
    vigenciaMeses: visa.vigenciaMeses,
    levaDefinitiva: visa.levaDefinitiva,
    mesesDefinitiva: visa.mesesDefinitiva,
    permiteTrabalhar: visa.permiteTrabalhar,
    exigeRenda: visa.exigeRenda,
    fonteUrl: visa.fonteUrl,
    legalSourcesLabel,
    resumoSermig: visa.descricao,
  };
}

/**
 * Gera dinamicamente as opções de documentos da Etapa 6 com base nos requisitos reais do SERMIG
 * (`visaRequirements`) da subcategoria atualmente líder para o perfil respondido.
 */
export function getDynamicDocumentOptions(
  answers: DiagnosticAnswers,
  visaCategories: VisaCategory[] = SEED_VISA_CATEGORIES,
  visaRequirements: VisaRequirement[] = SEED_VISA_REQUIREMENTS,
  legalSources: LegalSource[] = SEED_LEGAL_SOURCES,
  engineOptions?: EngineOptions,
): {
  subcategoriaLabel: string;
  options: SermigDynamicDocOption[];
} {
  const cats = visaCategories.length > 0 ? visaCategories : SEED_VISA_CATEGORIES;
  const reqs = visaRequirements.length > 0 ? visaRequirements : SEED_VISA_REQUIREMENTS;
  const previewDiag = runDiagnosticEngine(answers, cats, reqs, legalSources, engineOptions);
  const topVisa = previewDiag.recomendada?.visa;

  const seen = new Set<string>();
  const options: SermigDynamicDocOption[] = [];

  const pushOption = (opt: SermigDynamicDocOption) => {
    const key = opt.label.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    options.push(opt);
  };

  if (topVisa) {
    const matchingReqs = reqs
      .filter((r) => r.visaCategoryId === topVisa.id && r.categoriaDoc !== 'Taxas')
      .sort((a, b) => a.ordemPrioridadeEmissao - b.ordemPrioridadeEmissao);

    for (const req of matchingReqs) {
      const metaParts: string[] = [];
      if (req.obrigatorio) metaParts.push('Obrigatório SERMIG');
      if (req.exigeApostila) metaParts.push('Apostila de Haia');
      if (req.exigeTraducao) metaParts.push('Tradução juramentada');
      if (req.validadeDias > 0) metaParts.push(`Validade ${req.validadeDias} dias`);
      pushOption({
        value: req.nomeDocumento,
        label: req.nomeDocumento,
        meta: metaParts.join(' · ') || req.orgaoEmissor,
        sermigRequirementId: req.id,
        obrigatorio: req.obrigatorio,
        validadeDias: req.validadeDias,
      });
    }
  }

  // Documentos complementares pertinentes ao contexto familiar / subcategorias sem requisitos explícitos cadastrados
  if (isYes(answers.vinculoFamiliarChile) || isYes(answers.familiaAcompanhante)) {
    pushOption({
      value: 'Certidão de Nascimento / Casamento recente (2ª via)',
      label: 'Certidão de Nascimento / Casamento recente (2ª via)',
      meta: 'Vínculo familiar · Exige Apostila de Haia',
      obrigatorio: true,
      validadeDias: 60,
    });
  }

  if (answers.objetivo === 'tratamento_medico') {
    pushOption({
      value: 'Certificado médico de instituição acreditada no Chile e comprovante de custeio',
      label: 'Certificado médico de instituição acreditada no Chile e comprovante de custeio',
      meta: 'Requisito específico SERMIG · Subcategoria 10',
      obrigatorio: true,
      validadeDias: 60,
    });
  }

  if (answers.objetivo === 'religioso') {
    pushOption({
      value: 'Carta de respaldo de entidade religiosa reconhecida no Chile',
      label: 'Carta de respaldo de entidade religiosa reconhecida no Chile',
      meta: 'Requisito específico SERMIG · Subcategoria 09',
      obrigatorio: true,
      validadeDias: 60,
    });
  }

  if (answers.objetivo === 'temporada') {
    pushOption({
      value: 'Contrato de trabalho sazonal assinado com empregador chileno',
      label: 'Contrato de trabalho sazonal assinado com empregador chileno',
      meta: 'Requisito específico SERMIG · Subcategoria 04',
      obrigatorio: true,
      validadeDias: 60,
    });
  }

  if (options.length === 0) {
    pushOption({
      value: 'Passaporte válido (> 12 meses)',
      label: 'Passaporte válido (vigência mínima de 12 meses)',
      meta: 'Documento de viagem · Polícia Federal',
      obrigatorio: true,
      validadeDias: 0,
    });
    pushOption({
      value: 'Certificado de Antecedentes Criminais (Polícia Federal)',
      label: 'Certificado de Antecedentes Criminais (Polícia Federal)',
      meta: 'Apostila de Haia · Validade 60 dias',
      obrigatorio: true,
      validadeDias: 60,
    });
  }

  return {
    subcategoriaLabel: topVisa
      ? `Subcategoria ${topVisa.codigo} — ${topVisa.nomePortugues}`
      : 'Requisitos base SERMIG',
    options,
  };
}

/**
 * Calcula a prévia SERMIG em tempo real enquanto o solicitante preenche as etapas do diagnóstico.
 */
export function getLiveSermigPreview(
  answers: DiagnosticAnswers,
  visaCategories: VisaCategory[] = SEED_VISA_CATEGORIES,
  visaRequirements: VisaRequirement[] = SEED_VISA_REQUIREMENTS,
  legalSources: LegalSource[] = SEED_LEGAL_SOURCES,
  engineOptions?: EngineOptions,
): LiveSermigPreview {
  const diag = runDiagnosticEngine(answers, visaCategories, visaRequirements, legalSources, engineOptions);
  const elegivelMercosul = isMercosulEligibleNationality(answers);

  if (diag.dadosInsuficientes || !diag.recomendada) {
    return {
      prontoParaPrevia: false,
      subcategoriaLider: null,
      alternativas: [],
      regraProtocolo: 'exterior',
      regraProtocoloTitulo: 'Aguardando perfil básico',
      regraProtocoloDetalhe: 'Responda localização, nacionalidade e objetivo para enquadramento pela base SERMIG.',
      alertaPrincipal: null,
      requisitosObrigatoriosCount: 0,
      requisitosPrazoCurtoCount: 0,
      fontesLegais: [],
      elegivelMercosul,
      situacaoResidenciaAtual: null,
    };
  }

  const isResidente = answers.localizacao === 'No Chile com residência';
  const isTurista = answers.localizacao === 'No Chile como turista';
  const topVisa = diag.recomendada.visa;
  const permiteNoChile = topVisa.permiteDentroChile === 'Sim';

  let regraProtocolo: LiveSermigPreview['regraProtocolo'] = 'exterior';
  let regraProtocoloTitulo = 'Protocolo a partir do exterior';
  let regraProtocoloDetalhe =
    'Regra geral da legislação chilena (Ley Nº 21.325 e Decreto Supremo Nº 177/2022): pedido eletrônico realizado fora do Chile antes da viagem.';

  if (isResidente) {
    regraProtocolo = 'chile_residente';
    regraProtocoloTitulo =
      diag.situacaoResidenciaAtual === 'Residência Definitiva em análise'
        ? 'Transição para Residência Definitiva no Chile'
        : 'Prorrogação ou Mudança de Subcategoria no Chile';
    regraProtocoloDetalhe =
      'Protocolo digital no portal SERMIG dentro da janela legal de 90 a 10 dias antes do vencimento (legislação chilena — Decreto Supremo Nº 296/2022).';
  } else if (permiteNoChile && (isTurista || answers.vinculoFamiliarChile || answers.objetivo === 'humanitario')) {
    regraProtocolo = 'chile_permitido';
    regraProtocoloTitulo = 'Hipótese legal com protocolo permitido no Chile';
    regraProtocoloDetalhe =
      'Exceção prevista na legislação chilena (Ley Nº 21.325 e Decreto Supremo Nº 177/2022) que dispensa saída prévia do território chileno.';
  } else if (isTurista) {
    regraProtocolo = 'exterior';
    regraProtocoloTitulo = 'Exige saída do Chile para protocolar';
    regraProtocoloDetalhe =
      'Como turista (Permanencia Transitoria) sem vínculo formalizado ou hipótese humanitária, a legislação chilena exige protocolo a partir do exterior.';
  }

  return {
    prontoParaPrevia: true,
    subcategoriaLider: {
      codigo: topVisa.codigo,
      nomePortugues: topVisa.nomePortugues,
      nomeEspanhol: topVisa.nomeEspanhol,
      nota: diag.recomendada.nota,
    },
    alternativas: diag.top3.slice(1).map((c) => ({
      codigo: c.visa.codigo,
      nomePortugues: c.visa.nomePortugues,
      nota: c.nota,
    })),
    regraProtocolo,
    regraProtocoloTitulo,
    regraProtocoloDetalhe,
    alertaPrincipal: diag.alertaRiscoAlto || diag.alertas[0] || null,
    requisitosObrigatoriosCount: diag.preChecklist.filter((r) => r.obrigatorio).length,
    requisitosPrazoCurtoCount: diag.preChecklist.filter((r) => r.validadeDias > 0 && r.validadeDias <= 60).length,
    fontesLegais: diag.fontesLegais.slice(0, 4).map((s) => ({
      id: s.id,
      titulo: s.titulo,
      numeroAno: s.numeroAno,
      jurisdicao: getJurisdictionLabel(s.pais),
      pais: s.pais,
    })),
    elegivelMercosul,
    situacaoResidenciaAtual: diag.situacaoResidenciaAtual || null,
  };
}

/**
 * Opções de subcategoria atual para residentes no Chile, extraídas diretamente da base SERMIG.
 */
export function getResidentSubcategoryOptions(
  visaCategories: VisaCategory[] = SEED_VISA_CATEGORIES,
): { codigo: string; label: string; levaDefinitiva: boolean }[] {
  const cats = visaCategories.length > 0 ? visaCategories : SEED_VISA_CATEGORIES;
  const preferredOrder = ['15', '01', '02', '03', '11', '13', '04', '07', '09', '10', 'DEP'];
  const list: { codigo: string; label: string; levaDefinitiva: boolean }[] = [];

  for (const code of preferredOrder) {
    const found = cats.find((c) => c.codigo === code);
    if (found) {
      list.push({
        codigo: found.codigo,
        label: `Cód. ${found.codigo} — ${found.nomePortugues}`,
        levaDefinitiva: found.levaDefinitiva,
      });
    }
  }
  list.push({
    codigo: 'outra',
    label: 'Outra subcategoria / Não tenho certeza',
    levaDefinitiva: true,
  });
  return list;
}
