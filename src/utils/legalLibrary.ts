import type { LegalSource, LegalSourceType, VisaCategory } from '../types/domain';

export type VisaLibraryGroupId =
  | 'all'
  | 'meu_visto'
  | 'mercosul'
  | 'temporal'
  | 'familiar'
  | 'prorrogacao_definitiva'
  | 'turismo';

export type LegalDocKindFilter =
  | 'all'
  | 'circulares_sermig'
  | 'guias_portais'
  | 'leis_decretos'
  | 'acordos';

export interface VisaLibraryGroup {
  id: VisaLibraryGroupId;
  label: string;
}

export const VISA_LIBRARY_GROUPS: VisaLibraryGroup[] = [
  { id: 'all', label: 'Todos os Vistos' },
  { id: 'mercosul', label: 'Acordo Mercosul' },
  { id: 'temporal', label: 'Residência Temporal' },
  { id: 'familiar', label: 'Reunificação Familiar' },
  { id: 'prorrogacao_definitiva', label: 'Prorrogação & Definitiva' },
  { id: 'turismo', label: 'Permanência Transitória' },
];

export const LEGAL_DOC_KIND_FILTERS: { id: LegalDocKindFilter; label: string }[] = [
  { id: 'all', label: 'Todos os Documentos' },
  { id: 'circulares_sermig', label: 'Circulares & Resoluções SERMIG' },
  { id: 'guias_portais', label: 'Guias & Portais Oficiais' },
  { id: 'leis_decretos', label: 'Leis & Decretos' },
  { id: 'acordos', label: 'Acordos & Apostila' },
];

export interface ProceduralGuideStep {
  numero: string;
  titulo: string;
  prazoReferencia: string;
  resumo: string;
  checklistDica: string;
  linkOficial: string;
  linkLabel: string;
}

export function normalizeTextForSearch(value: string | undefined | null): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function resolveActiveCaseVisaCategory(
  visaCategories: VisaCategory[],
  visaCategoryId?: string,
  tipoServico?: string,
): VisaCategory | null {
  if (visaCategoryId) {
    const byId = visaCategories.find((v) => v.id === visaCategoryId);
    if (byId) return byId;
  }
  if (!tipoServico) return null;
  const q = normalizeTextForSearch(tipoServico);
  const exact = visaCategories.find(
    (v) =>
      normalizeTextForSearch(v.nomePortugues) === q ||
      normalizeTextForSearch(v.codigo) === q ||
      q.includes(normalizeTextForSearch(v.nomePortugues)),
  );
  if (exact) return exact;
  if (q.includes('mercosul') || q.includes('reciproc')) {
    return visaCategories.find((v) => v.codigo === '15') || null;
  }
  if (q.includes('reunific')) {
    return visaCategories.find((v) => v.codigo === '01') || null;
  }
  if (q.includes('definitiv')) {
    return visaCategories.find((v) => v.codigo === 'DEF') || null;
  }
  if (q.includes('prorrog')) {
    return visaCategories.find((v) => v.codigo === 'PRORR') || null;
  }
  if (q.includes('trabalh') || q.includes('licit')) {
    return visaCategories.find((v) => v.codigo === '02') || null;
  }
  if (q.includes('estud')) {
    return visaCategories.find((v) => v.codigo === '03') || null;
  }
  if (q.includes('aposent') || q.includes('rentist')) {
    return visaCategories.find((v) => v.codigo === '11') || null;
  }
  if (q.includes('invest')) {
    return visaCategories.find((v) => v.codigo === '13') || null;
  }
  return null;
}

export function getVisaCategoryIdsForGroup(groupId: VisaLibraryGroupId, visaCategories: VisaCategory[]): Set<string> {
  const ids = new Set<string>();
  for (const v of visaCategories) {
    if (groupId === 'all') {
      ids.add(v.id);
    } else if (groupId === 'mercosul') {
      if (v.codigo === '15' || normalizeTextForSearch(v.nomePortugues).includes('mercosul')) ids.add(v.id);
    } else if (groupId === 'familiar') {
      if (v.codigo === '01' || v.codigo === 'DEP') ids.add(v.id);
    } else if (groupId === 'prorrogacao_definitiva') {
      if (['PRORR', 'MUD', 'RAT', 'DEF'].includes(v.codigo)) ids.add(v.id);
    } else if (groupId === 'turismo') {
      if (v.codigo === 'TUR') ids.add(v.id);
    } else if (groupId === 'temporal') {
      if (!['PRORR', 'MUD', 'RAT', 'DEF', 'TUR'].includes(v.codigo)) ids.add(v.id);
    }
  }
  return ids;
}

export function getApplicableVisaCategories(source: LegalSource, visaCategories: VisaCategory[]): VisaCategory[] {
  const linked = visaCategories.filter((v) => (v.legalSourceIds || []).includes(source.id));
  if (linked.length > 0) return linked;

  // Fallback semântico para normas gerais (Apostila, PF, Ley 21.325, etc.)
  const text = normalizeTextForSearch(`${source.titulo} ${(source.tags || []).join(' ')}`);
  if (text.includes('mercosul') || text.includes('5.852') || text.includes('6.975')) {
    return visaCategories.filter((v) => v.codigo === '15');
  }
  if (text.includes('prorrog') || text.includes('definitiv')) {
    return visaCategories.filter((v) => ['PRORR', 'DEF', 'MUD'].includes(v.codigo));
  }
  if (text.includes('apostil') || text.includes('policia federal') || text.includes('antecedent') || text.includes('registro civil')) {
    return visaCategories.filter((v) => ['15', '01', '02', '03', '11', '13', 'DEF'].includes(v.codigo));
  }
  return [];
}

export function matchesDocKindFilter(tipo: LegalSourceType, filter: LegalDocKindFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'circulares_sermig') return tipo === 'Circular' || tipo === 'Resolução';
  if (filter === 'guias_portais') return tipo === 'Portal Oficial';
  if (filter === 'leis_decretos') return tipo === 'Lei' || tipo === 'Decreto';
  if (filter === 'acordos') return tipo === 'Acordo Internacional' || tipo === 'Jurisprudência';
  return true;
}

export function filterLegalLibrarySources(params: {
  sources: LegalSource[];
  visaCategories: VisaCategory[];
  query: string;
  visaGroup: VisaLibraryGroupId;
  selectedVisaId: string;
  docKind: LegalDocKindFilter;
  activeCaseVisaId?: string;
}): LegalSource[] {
  const { sources, visaCategories, query, visaGroup, selectedVisaId, docKind, activeCaseVisaId } = params;
  const q = normalizeTextForSearch(query.trim());

  const targetVisaIds = new Set<string>();
  if (selectedVisaId && selectedVisaId !== 'all') {
    targetVisaIds.add(selectedVisaId);
  } else if (visaGroup === 'meu_visto' && activeCaseVisaId) {
    targetVisaIds.add(activeCaseVisaId);
  } else if (visaGroup !== 'all') {
    for (const id of getVisaCategoryIdsForGroup(visaGroup, visaCategories)) {
      targetVisaIds.add(id);
    }
  }

  const matched = sources.filter((src) => {
    if (!matchesDocKindFilter(src.tipo, docKind)) return false;

    if (targetVisaIds.size > 0) {
      const applicableVisas = getApplicableVisaCategories(src, visaCategories);
      const isDirectMatch = applicableVisas.some((v) => targetVisaIds.has(v.id));
      const isUniversalBase = ['leg_ley_21325', 'leg_dec_296', 'leg_sermig_portal', 'leg_guia_procedimental_sermig'].includes(src.id);
      if (!isDirectMatch && !(visaGroup === 'temporal' && isUniversalBase)) {
        return false;
      }
    }

    if (q) {
      const applicableNames = getApplicableVisaCategories(src, visaCategories)
        .map((v) => `${v.codigo} ${v.nomePortugues} ${v.nomeEspanhol}`)
        .join(' ');
      const artigosTxt = (src.artigosEstruturados || []).map((a) => `${a.numero} ${a.titulo} ${a.resumo}`).join(' ');
      const haystack = normalizeTextForSearch(
        `${src.titulo} ${src.tipo} ${src.pais} ${src.numeroAno} ${src.orgaoEmissor} ${src.artigos} ${src.explicacaoCliente} ${src.resumoPortugues} ${(src.tags || []).join(' ')} ${applicableNames} ${artigosTxt}`,
      );
      const tokens = q.split(/\s+/).filter(Boolean);
      if (!tokens.every((tok) => haystack.includes(tok))) {
        return false;
      }
    }

    return true;
  });

  // Prioriza circulares/guias SERMIG e normas vigentes na ordenação da biblioteca
  const priorityScore = (s: LegalSource): number => {
    let score = 0;
    if (s.statusVigencia === 'Vigente') score += 40;
    else if (s.statusVigencia === 'A verificar') score += 10;
    if (s.tipo === 'Circular' || s.tipo === 'Resolução') score += 20;
    if (s.id === 'leg_guia_procedimental_sermig') score += 25;
    if (s.pais === 'Chile' || s.pais === 'Mercosul') score += 10;
    return score;
  };

  return [...matched].sort((a, b) => {
    const diff = priorityScore(b) - priorityScore(a);
    if (diff !== 0) return diff;
    return a.titulo.localeCompare(b.titulo, 'pt-BR');
  });
}

export function buildProceduralGuideSteps(selectedVisa?: VisaCategory | null): ProceduralGuideStep[] {
  const insideRule = selectedVisa
    ? selectedVisa.permiteDentroChile === 'Sim'
      ? `A subcategoria "${selectedVisa.nomePortugues}" permite solicitação de dentro do Chile conforme enquadramento legal.`
      : selectedVisa.permiteDentroChile === 'Condicional'
        ? `A subcategoria "${selectedVisa.nomePortugues}" possui regra condicional para pedido dentro do Chile — validar com a consultoria antes de viajar.`
        : `A subcategoria "${selectedVisa.nomePortugues}" exige solicitação inicial feita do exterior (fora do Chile).`
    : 'Primeiras residências temporais (ex.: Mercosul, Trabalho, Estudantes) são protocoladas do exterior, salvo exceções legais como Reunificação Familiar.';

  const postApprovalRule = selectedVisa
    ? selectedVisa.levaDefinitiva
      ? `Após ${selectedVisa.mesesDefinitiva || 24} meses de residência regular, torna-se elegível à Residência Definitiva (janela entre 90 e 10 dias antes do vencimento).`
      : 'Acompanhe os prazos de vigência e eventual renovação ou mudança de subcategoria dentro da janela de 90 a 10 dias antes do vencimento.'
    : 'Acompanhe a janela legal de 90 a 10 dias antes do vencimento para prorrogação ou pedido de Residência Definitiva.';

  return [
    {
      numero: '01',
      titulo: 'Preparação Documental & Apostila da Haia (Brasil)',
      prazoReferencia: 'Antecedentes: validade máx. 60 dias',
      resumo:
        'Reúna passaporte vigente e certidões civis antes de emitir os Antecedentes Criminais da Polícia Federal. O apostilamento CNJ garante validade no Chile sem legalização consular (CPC Arts. 345 e 345 bis).',
      checklistDica:
        'Para documentos de Mercosul/Brasil em português, observe o Decreto 5.852/2006 e as orientações do seu checklist no portal.',
      linkOficial: 'https://www.cnj.jus.br/poder-judiciario/relacoes-internacionais/apostila-da-haia/',
      linkLabel: 'Cartórios Apostila CNJ',
    },
    {
      numero: '02',
      titulo: 'Protocolo Eletrônico no Portal SERMIG',
      prazoReferencia: insideRule.includes('exterior') ? 'Protocolo do exterior' : 'Protocolo digital SERMIG',
      resumo: insideRule,
      checklistDica: 'Anexe PDFs nítidos, coloridos e sem cortes; guarde o comprovante oficial gerado ao final do envio.',
      linkOficial: selectedVisa?.fonteUrl || 'https://serviciomigraciones.cl/residencia-temporal/',
      linkLabel: 'Portal SERMIG Subcategorias',
    },
    {
      numero: '03',
      titulo: 'Análise Administrativa & Subsanación',
      prazoReferencia: 'Referência Ley 19.880: 6 meses',
      resumo:
        'Durante a tramitação no SERMIG, todas as notificações e eventuais pedidos de complementação documental (subsanación) chegam por meio eletrônico.',
      checklistDica: 'Acompanhe o portal semanalmente e responda exigências dentro do prazo informado na notificação.',
      linkOficial: 'https://serviciomigraciones.cl',
      linkLabel: 'Consultar Trámites SERMIG',
    },
    {
      numero: '04',
      titulo: 'Aprovação, Taxas e Estampado Electrónico',
      prazoReferencia: 'Documento digital em PDF',
      resumo:
        'Com a residência aprovada, efetua-se o pagamento dos direitos migratórios no portal oficial para liberar o download do Estampado Electrónico (sem carimbo físico em consulado).',
      checklistDica: 'Confira seus dados pessoais, número do passaporte e data de vigência assim que baixar o Estampado.',
      linkOficial: 'https://serviciomigraciones.cl',
      linkLabel: 'Estampado Electrónico SERMIG',
    },
    {
      numero: '05',
      titulo: 'Ingresso no Chile, Cédula de Identidade e Continuidade',
      prazoReferencia: 'Entrada: até 90 dias (pedidos do exterior)',
      resumo: `Realize a entrada regular no Chile dentro do prazo do Estampado e agende a emissão da Cédula de Identidade para Estrangeiros no Registro Civil. ${postApprovalRule}`,
      checklistDica: 'Mantenha cópia do Estampado, comprovante de ingresso (PDI) e Cédula no seu dossiê.',
      linkOficial: 'https://www.registrocivil.cl',
      linkLabel: 'Registro Civil Chile',
    },
  ];
}
