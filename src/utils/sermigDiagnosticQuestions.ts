import type {
  DiagnosticAnswers,
  DiagnosticObjective,
  LegalSource,
  VisaCategory,
  VisaRequirement,
} from '../types/domain';
import { runDiagnosticEngine, type DiagnosticResult } from './diagnosticEngine';
import { getJurisdictionLabel } from './legalJurisdiction';

type DiagnosticEngineOpts = Parameters<typeof runDiagnosticEngine>[4];

export interface ResidentSubcategoryOption {
  codigo: string;
  label: string;
  levaDefinitiva: boolean;
}

export interface SermigObjectiveMeta {
  visaCode: string;
  nomePortugues: string;
  nomeEspanhol: string;
  resumoSermig: string;
  permiteTrabalhar: boolean;
  permiteDentroChile: string;
  levaDefinitiva: boolean;
  mesesDefinitiva: number;
  legalSourcesLabel: string;
}

export interface DynamicDocumentOption {
  value: string;
  label: string;
  meta: string;
}

export interface LiveSermigPreview {
  prontoParaPrevia: boolean;
  subcategoriaLider?: {
    codigo: string;
    nomePortugues: string;
    nomeEspanhol: string;
    nota: number;
  };
  situacaoResidenciaAtual?: string;
  regraProtocoloTitulo: string;
  regraProtocoloDetalhe: string;
  alertaPrincipal?: string;
  requisitosObrigatoriosCount: number;
  requisitosPrazoCurtoCount: number;
  alternativas: Array<{
    codigo: string;
    nomePortugues: string;
    nota: number;
  }>;
  fontesLegais: Array<{
    id: string;
    titulo: string;
    pais: LegalSource['pais'];
    jurisdicao: string;
  }>;
}

const OBJECTIVE_TO_VISA_CODE: Record<DiagnosticObjective, string> = {
  trabalho_formal: '02',
  servicos_90d: '02',
  nomade_digital: '15',
  empreender_investir: '13',
  estudar: '03',
  aposentado_renda: '11',
  tratamento_medico: '10',
  religioso: '09',
  humanitario: '07',
  temporada: '04',
  dependente_titular: 'DEP',
  explorar: '15',
};

export function sanitizeDiagnosticAnswers(
  prev: DiagnosticAnswers,
  patch: Partial<DiagnosticAnswers>,
): DiagnosticAnswers {
  const next: DiagnosticAnswers = { ...prev, ...patch };
  if (next.localizacao !== 'No Chile com residência') {
    next.residenteSubcategoriaAtual = undefined;
    next.residenteVenceEmDias = undefined;
    next.residenteMesesForaUltimoAno = undefined;
  }
  if (next.vinculoFamiliarChile !== true) {
    next.familiarStatusChile = undefined;
    next.vinculoFormalizado = false;
  }
  if (next.possuiSegundaNacionalidade !== true) {
    next.segundaNacionalidadeQual = '';
  }
  if (next.passaporteStatus === 'nao_possui' || next.passaporteStatus === 'vencido') {
    next.passaporteValidadeMeses = 0;
  } else if (
    patch.passaporteStatus === 'valido' &&
    (next.passaporteValidadeMeses === undefined || next.passaporteValidadeMeses <= 0)
  ) {
    next.passaporteValidadeMeses = 24;
  }
  if (next.familiaAcompanhante === false) {
    next.quantidadeDependentes = 0;
  }
  if (!Array.isArray(next.documentosJaPossui)) {
    next.documentosJaPossui = [];
  }
  return next;
}

export function getResidentSubcategoryOptions(
  visaCategories: VisaCategory[],
): ResidentSubcategoryOption[] {
  return visaCategories
    .filter((v) => v.ativo !== false)
    .map((v) => ({
      codigo: v.codigo,
      label: `${v.codigo} — ${v.nomePortugues}`,
      levaDefinitiva: Boolean(v.levaDefinitiva),
    }));
}

export function getSermigObjectiveMeta(
  objetivo: DiagnosticObjective | '',
  visaCategories: VisaCategory[],
  legalSources: LegalSource[],
): SermigObjectiveMeta | null {
  if (!objetivo) return null;
  const code = OBJECTIVE_TO_VISA_CODE[objetivo] || '15';
  const visa =
    visaCategories.find((v) => v.codigo === code) ||
    visaCategories.find((v) => v.codigo === '15') ||
    visaCategories[0];
  if (!visa) return null;

  const cited = legalSources
    .filter((s) => (visa.legalSourceIds || []).includes(s.id))
    .map((s) => `${s.titulo}${s.numeroAno ? ` (${s.numeroAno})` : ''}`);

  return {
    visaCode: visa.codigo,
    nomePortugues: visa.nomePortugues,
    nomeEspanhol: visa.nomeEspanhol,
    resumoSermig: visa.descricao || visa.publicoAlvo,
    permiteTrabalhar: Boolean(visa.permiteTrabalhar),
    permiteDentroChile: visa.permiteDentroChile,
    levaDefinitiva: Boolean(visa.levaDefinitiva),
    mesesDefinitiva: visa.mesesDefinitiva || 24,
    legalSourcesLabel:
      cited.length > 0 ? cited.join(' · ') : 'Ley chilena Nº 21.325 e Decreto Supremo Nº 177/2022',
  };
}

export function getDynamicDocumentOptions(
  answers: DiagnosticAnswers,
  visaCategories: VisaCategory[],
  visaRequirements: VisaRequirement[],
  legalSources: LegalSource[],
  engineOptions?: DiagnosticEngineOpts,
): { subcategoriaLabel: string; options: DynamicDocumentOption[] } {
  const result = runDiagnosticEngine(
    answers,
    visaCategories,
    visaRequirements,
    legalSources,
    engineOptions,
  );
  const topVisa = result.recomendada?.visa;
  const subcategoriaLabel = topVisa
    ? `${topVisa.codigo} — ${topVisa.nomePortugues}`
    : 'seu perfil migratório';

  const reqs = topVisa
    ? visaRequirements.filter((r) => r.visaCategoryId === topVisa.id)
    : visaRequirements.slice(0, 8);

  const uniqueMap = new Map<string, DynamicDocumentOption>();
  for (const r of reqs) {
    if (!uniqueMap.has(r.nomeDocumento)) {
      const parts: string[] = [];
      parts.push(r.obrigatorio ? 'Obrigatório' : 'Complementar');
      if (r.exigeApostila) parts.push('Apostila de Haia');
      if (r.exigeTraducao) parts.push('Tradução juramentada');
      if (r.validadeDias > 0) parts.push(`Validade ${r.validadeDias} dias`);
      uniqueMap.set(r.nomeDocumento, {
        value: r.nomeDocumento,
        label: r.nomeDocumento,
        meta: parts.join(' · '),
      });
    }
  }

  if (uniqueMap.size === 0) {
    ['Passaporte válido', 'Certidão de Antecedentes Criminais PF', 'Certidão de Nascimento'].forEach(
      (docName) => {
        uniqueMap.set(docName, {
          value: docName,
          label: docName,
          meta: 'Documento base SERMIG',
        });
      },
    );
  }

  return {
    subcategoriaLabel,
    options: Array.from(uniqueMap.values()).slice(0, 14),
  };
}

export function getLiveSermigPreview(
  answers: DiagnosticAnswers,
  visaCategories: VisaCategory[],
  visaRequirements: VisaRequirement[],
  legalSources: LegalSource[],
  engineOptions?: DiagnosticEngineOpts,
): LiveSermigPreview {
  const result = runDiagnosticEngine(
    answers,
    visaCategories,
    visaRequirements,
    legalSources,
    engineOptions,
  );
  const top = result.recomendada;
  const ready = Boolean(answers.localizacao && (answers.nacionalidadeBrasileira !== null || answers.objetivo));
  const reqs = top ? visaRequirements.filter((r) => r.visaCategoryId === top.visa.id) : [];

  const isResident = answers.localizacao === 'No Chile com residência';
  const situacaoResidenciaAtual = isResident
    ? (answers.mesesResidenciaChile ?? 0) >= 24
      ? 'Elegível a análise de Residência Definitiva'
      : 'Fluxo de Prorrogação / Mudança de Subcategoria'
    : undefined;

  return {
    prontoParaPrevia: ready && Boolean(top),
    subcategoriaLider: top
      ? {
          codigo: top.visa.codigo,
          nomePortugues: top.visa.nomePortugues,
          nomeEspanhol: top.visa.nomeEspanhol,
          nota: top.nota,
        }
      : undefined,
    situacaoResidenciaAtual,
    regraProtocoloTitulo:
      answers.localizacao === 'No Chile como turista'
        ? 'Regra geral: pedido de fora do Chile (exceções restritas)'
        : isResident
          ? 'Protocolo digital dentro do Chile (SERMIG)'
          : 'Protocolo digital a partir do exterior (SERMIG)',
    regraProtocoloDetalhe:
      top?.visa.descricao ||
      'Preencha sua localização, nacionalidade e objetivo para visualizar o enquadramento preliminar.',
    alertaPrincipal: result.alertas[0],
    requisitosObrigatoriosCount: reqs.filter((r) => r.obrigatorio).length,
    requisitosPrazoCurtoCount: reqs.filter((r) => r.validadeDias > 0 && r.validadeDias <= 60).length,
    alternativas: result.top3.slice(1, 4).map((alt) => ({
      codigo: alt.visa.codigo,
      nomePortugues: alt.visa.nomePortugues,
      nota: alt.nota,
    })),
    fontesLegais: result.fontesLegais.slice(0, 4).map((src) => ({
      id: src.id,
      titulo: src.titulo,
      pais: src.pais,
      jurisdicao: getJurisdictionLabel(src.pais),
    })),
  };
}

export interface StepLiveRecommendation {
  etapa: number;
  titulo: string;
  orientacao: string;
  acaoPratica: string;
  tom: 'positivo' | 'atencao' | 'neutro';
}

/**
 * Gera recomendação determinística e 100% fundamentada para a etapa atual do formulário,
 * alinhada ao Radar de Viabilidade e sem suposições fora dos dados informados pelo usuário.
 */
export function getStepLiveRecommendation(
  step: number,
  answers: DiagnosticAnswers,
  result: DiagnosticResult,
  preview: LiveSermigPreview,
): StepLiveRecommendation {
  const topName = preview.subcategoriaLider
    ? `${preview.subcategoriaLider.codigo} — ${preview.subcategoriaLider.nomePortugues}`
    : 'enquadramento em apuração';

  if (step === 1) {
    return {
      etapa: 1,
      titulo: 'Ponto de partida seguro',
      orientacao:
        'Seus dados de contato servem apenas para salvar o rascunho por 30 dias e gerar o resumo técnico sem solicitar CPF ou número de passaporte.',
      acaoPratica: 'Use um e-mail que você também pretenda usar caso contrate o Portal do Cliente.',
      tom: 'neutro',
    };
  }

  if (step === 2) {
    if (answers.passaporteStatus === 'nao_possui' || answers.passaporteStatus === 'vencido') {
      return {
        etapa: 2,
        titulo: 'Passaporte é o gargalo prioritário',
        orientacao:
          'Sem passaporte válido, o portal oficial SERMIG bloqueia a etapa de identificação documental para novos protocolos do exterior.',
        acaoPratica: 'Agende emissão ou renovação na Polícia Federal antes de emitir certidões com validade curta.',
        tom: 'atencao',
      };
    }
    if (answers.localizacao === 'No Chile como turista') {
      return {
        etapa: 2,
        titulo: 'Atenção à regra territorial (Ley Nº 21.325)',
        orientacao:
          'Quem ingressa como turista no Chile não pode, na regra geral, trocar para Residência Temporal de dentro do país — salvo exceções legais como Reunificação Familiar formalizada.',
        acaoPratica: 'Na etapa 3, confirme se existe vínculo familiar formalizado no Chile; caso contrário, planeje protocolo do exterior.',
        tom: 'atencao',
      };
    }
    if (answers.localizacao === 'No Chile com residência') {
      return {
        etapa: 2,
        titulo: 'Janela legal de residente no Chile',
        orientacao:
          (answers.mesesResidenciaChile ?? 0) >= 24
            ? 'Seu tempo de residência permite avaliar Residência Definitiva dentro do Chile, verificando eventuais ausências do país.'
            : 'Como residente vigente, o pedido de prorrogação ou mudança de subcategoria deve respeitar a janela de 90 a 10 dias antes do vencimento.',
        acaoPratica: 'Mantenha o certificado de vigência e histórico de entradas/saídas da PDI atualizados.',
        tom: 'positivo',
      };
    }
    if ((answers.passaporteValidadeMeses ?? 24) < 12) {
      return {
        etapa: 2,
        titulo: 'Passaporte com validade abaixo do ideal (< 12 meses)',
        orientacao:
          'A tramitação SERMIG pode levar vários meses; passaporte próximo do vencimento reduz a prontidão documental do Radar.',
        acaoPratica: 'Considere renovar o passaporte antes de iniciar o protocolo para evitar exigência complementar.',
        tom: 'atencao',
      };
    }
    return {
      etapa: 2,
      titulo: 'Elegibilidade territorial favorável',
      orientacao: `Estando fora do Chile com passaporte vigente, você atende à regra geral de protocolo eletrônico do SERMIG (${topName}).`,
      acaoPratica: 'Avance para a etapa 3 para verificar vínculos familiares ou dependentes.',
      tom: 'positivo',
    };
  }

  if (step === 3) {
    if (answers.vinculoFamiliarChile === true) {
      if (answers.vinculoFormalizado !== true) {
        return {
          etapa: 3,
          titulo: 'Vínculo ainda não formalizado',
          orientacao:
            'A Subcategoria 01 (Reunificação Familiar) exige certidão de casamento ou Acuerdo de Unión Civil formalmente registrado.',
          acaoPratica: 'Se pretende usar a exceção de pedido dentro do Chile, priorize a formalização jurídica do vínculo.',
          tom: 'atencao',
        };
      }
      return {
        etapa: 3,
        titulo: 'Vínculo familiar formalizado confirmado',
        orientacao:
          answers.familiarStatusChile === 'residente_temporal'
            ? 'Como o familiar possui Residência Temporal, o enquadramento típico ocorre como Dependente (DEP) do titular.'
            : 'Vínculo formalizado com cidadão chileno ou Residente Definitivo habilita a Reunificação Familiar (Cód. 01).',
        acaoPratica: 'Separe certidão de casamento/nascimento atualizada para apostilamento na etapa documental.',
        tom: 'positivo',
      };
    }
    return {
      etapa: 3,
      titulo: 'Processo sem dependência de vínculo chileno',
      orientacao: `Sem vínculo familiar no Chile, seu enquadramento seguirá diretamente pela nacionalidade e objetivo principal (${topName}).`,
      acaoPratica: 'Na etapa 4, selecione o objetivo que melhor reflete sua documentação comprovável.',
      tom: 'neutro',
    };
  }

  if (step === 4) {
    return {
      etapa: 4,
      titulo: `Rota líder: ${topName}`,
      orientacao:
        result.recomendada?.motivo ||
        'O motor de regras cruza seu objetivo com as 16 subcategorias do Decreto Supremo Nº 177/2022.',
      acaoPratica:
        result.recomendada?.visa.codigo === '15'
          ? 'A rota Mercosul (Cód. 15) dispensa contrato de trabalho e comprovação de renda mínima, permitindo trabalhar legalmente.'
          : 'Confirme se já possui a comprovação exigida por esta subcategoria (contrato, matrícula, renda ou capital) para maximizar o Radar.',
      tom: result.viabilidade.total >= 75 ? 'positivo' : 'neutro',
    };
  }

  if (step === 5) {
    if (result.flagsRisco.length > 0) {
      return {
        etapa: 5,
        titulo: `${result.flagsRisco.length} ponto(s) de risco identificado(s)`,
        orientacao:
          'Fatores como overstay, ordem de abandono, rejeição prévia ou antecedentes não encerram automaticamente a análise, mas exigem estratégia jurídica antes do protocolo.',
        acaoPratica: 'Não protocolo sem revisão técnica prévia da resolução ou certidão correspondente.',
        tom: 'atencao',
      };
    }
    if (result.flagsRevisaoConsultor.length > 0) {
      return {
        etapa: 5,
        titulo: 'Revisão sigilosa marcada com o consultor',
        orientacao: `${result.flagsRevisaoConsultor.length} tópico(s) ficaram reservados para conversa reservada; o Radar mantém cautela proporcional até essa validação.`,
        acaoPratica: 'Leve eventuais documentos ou datas aproximadas para a reunião técnica.',
        tom: 'atencao',
      };
    }
    return {
      etapa: 5,
      titulo: 'Histórico migratório limpo até o momento',
      orientacao:
        'Sem ocorrências marcadas na triagem preventiva, o pilar Histórico / Riscos permanece com pontuação máxima.',
      acaoPratica: 'Avance para a etapa 6 para mapear seus documentos já prontos e liberar o relatório completo.',
      tom: 'positivo',
    };
  }

  const readinessPct = result.checklistProntidao?.percentualInicial ?? 0;
  return {
    etapa: 6,
    titulo: `Prontidão documental atual: ${readinessPct}%`,
    orientacao:
      answers.prazoPretendido === 'Imediato (até 30 dias)'
        ? 'Para metas imediatas, emita certidões civis e apostilas primeiro e deixe Antecedentes da Polícia Federal (validade de 60 dias) estritamente por último.'
        : 'Marque apenas documentos já emitidos e dentro da validade para um cálculo realista no Gráfico Radar final.',
    acaoPratica: 'Aceite o termo LGPD para gerar o Dossiê Técnico, Gráfico Radar de 7 pilares e PDF de 2 páginas.',
    tom: readinessPct >= 50 ? 'positivo' : 'neutro',
  };
}
