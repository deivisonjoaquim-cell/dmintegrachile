import type {
  DiagnosticAnswers,
  DiagnosticObjective,
  LegalSource,
  VisaCategory,
  VisaRequirement,
} from '../types/domain';
import { runDiagnosticEngine } from './diagnosticEngine';
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
  nomade_digital: '12',
  empreender_investir: '13',
  estudar: '03',
  aposentado_renda: '08',
  tratamento_medico: '10',
  religioso: '09',
  humanitario: '11',
  temporada: '04',
  dependente_titular: 'DEP',
  explorar: '12',
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
  const code = OBJECTIVE_TO_VISA_CODE[objetivo] || '12';
  const visa =
    visaCategories.find((v) => v.codigo === code) ||
    visaCategories.find((v) => v.codigo === '12') ||
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
