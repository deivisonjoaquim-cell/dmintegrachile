import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  Globe,
  RotateCcw,
  Scale,
  Search,
  X,
} from 'lucide-react';
import { BrandRibbon } from '../BrandLogo';
import type { Case, LegalSource, VisaCategory, VisaRequirement } from '../../types/domain';
import { formatDateBR } from '../../utils/formatters';
import { getJurisdictionLabel, getJurisdictionTextClass } from '../../utils/legalJurisdiction';
import {
  buildProceduralGuideSteps,
  filterLegalLibrarySources,
  getApplicableVisaCategories,
  LEGAL_DOC_KIND_FILTERS,
  resolveActiveCaseVisaCategory,
  VISA_LIBRARY_GROUPS,
  type LegalDocKindFilter,
  type VisaLibraryGroupId,
} from '../../utils/legalLibrary';

interface PortalBibliotecaLegalProps {
  legalSources: LegalSource[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  activeCase: Case | null;
}

type LibraryViewMode = 'acervo' | 'guia_sermig';

export const PortalBibliotecaLegal: React.FC<PortalBibliotecaLegalProps> = ({
  legalSources,
  visaCategories,
  visaRequirements,
  activeCase,
}) => {
  const activeCaseVisa = useMemo(
    () => resolveActiveCaseVisaCategory(visaCategories, activeCase?.visaCategoryId, activeCase?.tipoServico),
    [visaCategories, activeCase?.visaCategoryId, activeCase?.tipoServico],
  );

  const [libraryView, setLibraryView] = useState<LibraryViewMode>('acervo');
  const [query, setQuery] = useState('');
  const [visaGroup, setVisaGroup] = useState<VisaLibraryGroupId>(activeCaseVisa ? 'meu_visto' : 'all');
  const [selectedVisaId, setSelectedVisaId] = useState<string>(activeCaseVisa?.id || 'all');
  const [docKind, setDocKind] = useState<LegalDocKindFilter>('all');
  const [jurisdictionFilter, setJurisdictionFilter] = useState<'all' | LegalSource['pais']>('all');
  const [readingSource, setReadingSource] = useState<LegalSource | null>(null);

  const activeVisas = useMemo(
    () => [...visaCategories].filter((v) => v.ativo).sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [visaCategories],
  );

  const selectedVisaObject = useMemo(() => {
    if (selectedVisaId && selectedVisaId !== 'all') {
      return activeVisas.find((v) => v.id === selectedVisaId) || null;
    }
    if (visaGroup === 'meu_visto' && activeCaseVisa) return activeCaseVisa;
    if (visaGroup === 'mercosul') return activeVisas.find((v) => v.codigo === '15') || null;
    if (visaGroup === 'familiar') return activeVisas.find((v) => v.codigo === '01') || null;
    if (visaGroup === 'prorrogacao_definitiva') return activeVisas.find((v) => v.codigo === 'DEF') || null;
    if (visaGroup === 'turismo') return activeVisas.find((v) => v.codigo === 'TUR') || null;
    return activeCaseVisa;
  }, [selectedVisaId, visaGroup, activeVisas, activeCaseVisa]);

  const filteredSources = useMemo(() => {
    const base = filterLegalLibrarySources({
      sources: legalSources,
      visaCategories: activeVisas,
      query,
      visaGroup,
      selectedVisaId,
      docKind,
      activeCaseVisaId: activeCaseVisa?.id,
    });
    if (jurisdictionFilter === 'all') return base;
    return base.filter((s) => s.pais === jurisdictionFilter);
  }, [legalSources, activeVisas, query, visaGroup, selectedVisaId, docKind, jurisdictionFilter, activeCaseVisa?.id]);

  const proceduralSteps = useMemo(() => buildProceduralGuideSteps(selectedVisaObject), [selectedVisaObject]);

  const visaChecklistReference = useMemo(() => {
    if (!selectedVisaObject) return [];
    return [...visaRequirements]
      .filter((r) => r.visaCategoryId === selectedVisaObject.id)
      .sort((a, b) => a.ordemPrioridadeEmissao - b.ordemPrioridadeEmissao);
  }, [visaRequirements, selectedVisaObject]);

  const sermigCircularCount = useMemo(
    () => legalSources.filter((s) => s.tipo === 'Circular' || s.tipo === 'Resolução').length,
    [legalSources],
  );

  const handleSelectVisaGroup = (groupId: VisaLibraryGroupId) => {
    setVisaGroup(groupId);
    if (groupId === 'meu_visto' && activeCaseVisa) {
      setSelectedVisaId(activeCaseVisa.id);
    } else {
      setSelectedVisaId('all');
    }
  };

  const handleSelectSpecificVisa = (visaId: string) => {
    setSelectedVisaId(visaId);
    if (visaId === 'all') {
      setVisaGroup('all');
    } else if (activeCaseVisa && visaId === activeCaseVisa.id) {
      setVisaGroup('meu_visto');
    } else {
      setVisaGroup('all');
    }
  };

  const handleResetFilters = () => {
    setQuery('');
    setVisaGroup('all');
    setSelectedVisaId('all');
    setDocKind('all');
    setJurisdictionFilter('all');
  };

  const hasActiveFilters = Boolean(
    query.trim() || visaGroup !== 'all' || selectedVisaId !== 'all' || docKind !== 'all' || jurisdictionFilter !== 'all',
  );

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Alternador de Modo */}
      <section className="bg-white border border-[#E5DFD2] rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(11,31,51,0.03)]">
        <BrandRibbon className="h-[3px] w-full" />
        <div className="p-6 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="brand-kicker">
                Fontes Oficiais · SERMIG · BCN LeyChile · Planalto · CNJ
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-[#0B1F33]">
                Biblioteca Legal &amp; Guia Procedimental SERMIG
              </h1>
              <p className="text-sm text-[#4A5A6D] max-w-2xl leading-relaxed">
                Pesquise leis, decretos, circulares operacionais e o roteiro completo de tramitação filtrando pelo seu tipo de visto.
              </p>
            </div>

            <div className="flex items-center p-1 bg-[#FAF9F6] border border-[#E5DFD2] rounded-xl self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setLibraryView('acervo')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  libraryView === 'acervo' ? 'bg-[#0B1F33] text-white shadow-xs' : 'text-[#4A5A6D] hover:text-[#0B1F33]'
                }`}
              >
                <Scale className={`w-3.5 h-3.5 ${libraryView === 'acervo' ? 'text-[#E5C76B]' : 'text-[#8C6D14]'}`} />
                Normas &amp; Circulares ({filteredSources.length})
              </button>
              <button
                type="button"
                onClick={() => setLibraryView('guia_sermig')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  libraryView === 'guia_sermig' ? 'bg-[#0B1F33] text-white shadow-xs' : 'text-[#4A5A6D] hover:text-[#0B1F33]'
                }`}
              >
                <ClipboardList className={`w-3.5 h-3.5 ${libraryView === 'guia_sermig' ? 'text-[#E5C76B]' : 'text-[#8C6D14]'}`} />
                Guia Procedimental SERMIG
              </button>
            </div>
          </div>

          {/* Resumo quantitativo limpo (zero cards aninhados) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#E5DFD2] text-xs">
            <div>
              <p className="text-[#4A5A6D]">Normas &amp; Portais</p>
              <p className="font-mono text-lg font-bold text-[#0B1F33] tabular-nums mt-0.5">{legalSources.length}</p>
            </div>
            <div>
              <p className="text-[#4A5A6D]">Circulares &amp; Resoluções</p>
              <p className="font-mono text-lg font-bold text-[#0B1F33] tabular-nums mt-0.5">{sermigCircularCount}</p>
            </div>
            <div>
              <p className="text-[#4A5A6D]">Subcategorias Mapeadas</p>
              <p className="font-mono text-lg font-bold text-[#0B1F33] tabular-nums mt-0.5">{activeVisas.length}</p>
            </div>
            <div>
              <p className="text-[#4A5A6D]">Visto em foco</p>
              <p className="text-sm font-bold text-[#0B1F33] truncate mt-1">
                {selectedVisaObject ? `${selectedVisaObject.codigo} · ${selectedVisaObject.nomePortugues}` : 'Visão Geral'}
              </p>
            </div>
          </div>

          {/* Barra de Busca e Filtros por Visto */}
          <div className="pt-4 border-t border-[#E5DFD2] space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-[#8C6D14] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Buscar na Biblioteca Legal"
                  placeholder="Buscar por visto, circular SERMIG, Ley 21.325, decreto, antecedentes, apostila ou estampado..."
                  className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-[#DDD6C7] text-sm text-[#0B1F33] bg-[#FAF9F6] focus:bg-white focus:border-[#0B1F33] focus:outline-none transition-colors"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Limpar busca"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#4A5A6D] hover:text-[#0B1F33]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <select
                value={selectedVisaId}
                onChange={(e) => handleSelectSpecificVisa(e.target.value)}
                aria-label="Filtrar por subcategoria específica de visto"
                className="px-3.5 py-2.5 rounded-lg border border-[#DDD6C7] text-sm text-[#0B1F33] bg-[#FAF9F6] focus:bg-white focus:border-[#0B1F33] focus:outline-none md:w-72"
              >
                <option value="all">Todas as subcategorias ({activeVisas.length})</option>
                {activeVisas.map((v) => (
                  <option key={v.id} value={v.id}>
                    [{v.codigo}] {v.nomePortugues}
                  </option>
                ))}
              </select>
            </div>

            {/* Botões interativos de filtro por grupo de visto */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo de visto">
              {activeCaseVisa && (
                <button
                  type="button"
                  onClick={() => handleSelectVisaGroup('meu_visto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                    visaGroup === 'meu_visto'
                      ? 'bg-[#0B1F33] text-white border-[#0B1F33]'
                      : 'bg-[#FAF9F6] text-[#0B1F33] border-[#DDD6C7] hover:border-[#C8A236]/60'
                  }`}
                >
                  Meu Visto ({activeCaseVisa.codigo})
                </button>
              )}
              {VISA_LIBRARY_GROUPS.map((grp) => {
                const active = visaGroup === grp.id && (selectedVisaId === 'all' || grp.id === 'all');
                return (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => handleSelectVisaGroup(grp.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                      active
                        ? 'bg-[#0B1F33] text-white border-[#0B1F33]'
                        : 'bg-white text-[#4A5A6D] border-[#DDD6C7] hover:bg-[#FAF9F6] hover:text-[#0B1F33]'
                    }`}
                  >
                    {grp.label}
                  </button>
                );
              })}
            </div>

            {libraryView === 'acervo' && (
              <div className="space-y-2.5 pt-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por jurisdição da lei">
                    {(
                      [
                        { id: 'all', label: 'Todas as jurisdições' },
                        { id: 'Chile', label: 'Legislação Chilena' },
                        { id: 'Brasil', label: 'Legislação Brasileira' },
                        { id: 'Mercosul', label: 'Acordo Internacional (Mercosul)' },
                      ] as const
                    ).map((jur) => (
                      <button
                        key={jur.id}
                        type="button"
                        onClick={() => setJurisdictionFilter(jur.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors border ${
                          jurisdictionFilter === jur.id
                            ? 'bg-[#0B1F33] text-white border-[#0B1F33]'
                            : 'bg-white text-[#4A5A6D] border-[#DDD6C7] hover:bg-[#FAF9F6]'
                        }`}
                      >
                        {jur.label}
                      </button>
                    ))}
                  </div>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD6C7] text-xs font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Limpar filtros
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tipo de documento legal">
                  {LEGAL_DOC_KIND_FILTERS.map((kind) => (
                    <button
                      key={kind.id}
                      type="button"
                      onClick={() => setDocKind(kind.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        docKind === kind.id
                          ? 'bg-[#0B1F33] text-[#E5C76B] font-semibold'
                          : 'bg-[#FAF9F6] text-[#4A5A6D] hover:bg-[#EFECE4] hover:text-[#0B1F33]'
                      }`}
                    >
                      {kind.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Ficha resumida do visto selecionado (quando houver filtro específico) */}
      {selectedVisaObject && (
        <section className="bg-white border border-[#E5DFD2] rounded-2xl overflow-hidden shadow-[0_4px_18px_rgba(11,31,51,0.05)]">
          <div className="bg-[#0B1F33] text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B] font-mono">
                Subcategoria {selectedVisaObject.codigo} · {selectedVisaObject.nomeEspanhol}
              </p>
              <h2 className="font-display text-lg font-bold text-white mt-0.5">{selectedVisaObject.nomePortugues}</h2>
            </div>
            {selectedVisaObject.fonteUrl && (
              <a
                href={selectedVisaObject.fonteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/20 bg-white/10 text-xs font-semibold text-white hover:bg-white/20 whitespace-nowrap shrink-0"
              >
                Página oficial SERMIG
                <ExternalLink className="w-3.5 h-3.5 text-[#E5C76B]" />
              </a>
            )}
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-[#4A5A6D] leading-relaxed">{selectedVisaObject.descricao}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-[#4A5A6D] pt-3 border-t border-[#E5DFD2] font-mono tabular-nums">
              <span>
                <span className="font-sans">Pedido dentro do Chile:</span> <strong className="font-sans text-[#0B1F33]">{selectedVisaObject.permiteDentroChile}</strong>
              </span>
              <span>
                <span className="font-sans">Vigência padrão:</span> <strong className="text-[#0B1F33]">{selectedVisaObject.vigenciaMeses} meses</strong>
              </span>
              <span>
                <span className="font-sans">Permite trabalhar:</span> <strong className="font-sans text-[#0B1F33]">{selectedVisaObject.permiteTrabalhar ? 'Sim' : 'Não'}</strong>
              </span>
              <span>
                <span className="font-sans">Leva à Definitiva:</span>{' '}
                <strong className="font-sans text-[#0B1F33]">
                  {selectedVisaObject.levaDefinitiva ? `Sim (${selectedVisaObject.mesesDefinitiva} meses)` : 'Não direto'}
                </strong>
              </span>
            </div>
          </div>
        </section>
      )}

      {/* VISÃO 1: ACERVO DE NORMAS, CIRCULARES E PORTAIS */}
      {libraryView === 'acervo' && (
        <section className="space-y-4">
          {filteredSources.length === 0 ? (
            <div className="bg-white border border-[#E5DFD2] rounded-2xl p-10 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-[#8C6D14] mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-[#0B1F33]">Nenhuma norma ou circular encontrada para esta combinação</p>
                <p className="text-xs text-[#4A5A6D]">
                  Tente remover um filtro de tipo de documento ou buscar por termos mais amplos como &quot;SERMIG&quot;, &quot;Mercosul&quot; ou &quot;apostila&quot;.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Mostrar todo o acervo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSources.map((src) => {
                const linkedVisas = getApplicableVisaCategories(src, activeVisas);
                return (
                  <article
                    key={src.id}
                    className="bg-white border border-[#E5DFD2] rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-[#C8A236]/60 hover:shadow-[0_10px_28px_rgba(11,31,51,0.06)] transition-all"
                  >
                    <div className="space-y-2.5">
                      <p className="text-xs text-[#4A5A6D] font-mono tabular-nums">
                        <span className={`font-sans ${getJurisdictionTextClass(src.pais)}`}>{getJurisdictionLabel(src.pais)}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="font-sans">{src.tipo}</span>
                        {src.numeroAno ? (
                          <>
                            <span aria-hidden="true"> · </span>
                            {src.numeroAno}
                          </>
                        ) : null}
                        <span aria-hidden="true"> · </span>
                        <span
                          className={`font-sans ${
                            src.statusVigencia === 'Vigente'
                              ? 'text-[#146B43] font-semibold'
                              : src.statusVigencia === 'Revogada'
                                ? 'text-[#A61C2B] font-semibold'
                                : 'text-[#8C6D14] font-semibold'
                          }`}
                        >
                          {src.statusVigencia}
                        </span>
                      </p>

                      <h3 className="text-base font-bold text-[#0B1F33] leading-snug">{src.titulo}</h3>

                      <p className="text-sm text-[#4A5A6D] leading-relaxed">
                        {src.explicacaoCliente || src.resumoPortugues}
                      </p>

                      {src.artigos && (
                        <p className="text-xs text-[#4A5A6D]">
                          <strong className="font-semibold text-[#0B1F33]">Escopo:</strong> {src.artigos}
                        </p>
                      )}

                      {linkedVisas.length > 0 && (
                        <p className="text-xs text-[#4A5A6D]">
                          <strong className="font-semibold text-[#0B1F33]">Aplicável a:</strong>{' '}
                          {linkedVisas
                            .slice(0, 4)
                            .map((v) => v.nomePortugues)
                            .join(' · ')}
                          {linkedVisas.length > 4 ? ` · +${linkedVisas.length - 4}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#F1EDE4] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-[#4A5A6D] font-mono tabular-nums text-[11px]">
                        {src.ultimaVerificacao ? `Revisão: ${formatDateBR(src.ultimaVerificacao)}` : src.orgaoEmissor}
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setReadingSource(src)}
                          className="inline-flex items-center gap-1 font-semibold text-[#0B1F33] hover:text-[#8C6D14] hover:underline whitespace-nowrap shrink-0"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-[#8C6D14]" />
                          Ler guia &amp; artigos
                        </button>
                        {src.linkOficial && (
                          <a
                            href={src.linkOficial}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-[#4A5A6D] hover:text-[#0B1F33] hover:underline whitespace-nowrap shrink-0"
                          >
                            Fonte oficial
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* Acesso direto aos portais governamentais */}
          <div className="bg-white border border-[#E5DFD2] rounded-2xl p-5 space-y-3.5 shadow-[0_2px_10px_rgba(11,31,51,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#0B1F33] flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#8C6D14]" />
                  Portais Oficiais de Consulta Direta
                </h2>
                <p className="text-xs text-[#4A5A6D] mt-0.5">
                  Links verificados dos órgãos oficiais no Chile e no Brasil para conferência independente.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLibraryView('guia_sermig')}
                className="px-3.5 py-1.5 rounded-lg border border-[#DDD6C7] bg-[#FAF9F6] text-xs font-semibold text-[#0B1F33] hover:bg-white whitespace-nowrap shrink-0"
              >
                Abrir Guia Procedimental
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-3 border-t border-[#E5DFD2]">
              {[
                {
                  nome: 'SERMIG — Trámites Digitales (Chile)',
                  desc: 'Protocolos, Estampado Electrónico e Prorrogação (órgão chileno)',
                  url: 'https://serviciomigraciones.cl',
                },
                {
                  nome: 'BCN LeyChile (Legislação Chilena)',
                  desc: 'Texto consolidado da Ley chilena Nº 21.325 e Decretos 177/296/181',
                  url: 'https://www.bcn.cl/leychile',
                },
                {
                  nome: 'CNJ — Apostila da Haia (Brasil)',
                  desc: 'Resolução brasileira CNJ nº 228/2016, cartórios e validação por QR Code',
                  url: 'https://www.cnj.jus.br/poder-judiciario/relacoes-internacionais/apostila-da-haia/',
                },
                {
                  nome: 'Registro Civil Chile',
                  desc: 'Cédula de Identidad para Extranjeros e ClaveÚnica (órgão chileno)',
                  url: 'https://www.registrocivil.cl',
                },
              ].map((portal) => (
                <a
                  key={portal.nome}
                  href={portal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3.5 rounded-xl border border-[#E5DFD2] bg-[#FAF9F6]/60 hover:border-[#C8A236]/60 hover:bg-white transition-all flex flex-col justify-between gap-2"
                >
                  <div>
                    <p className="font-bold text-[#0B1F33]">{portal.nome}</p>
                    <p className="text-[#4A5A6D] mt-0.5 leading-relaxed">{portal.desc}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#0B1F33]">
                    Acessar portal
                    <ExternalLink className="w-3 h-3 text-[#8C6D14]" />
                  </span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VISÃO 2: GUIA PROCEDIMENTAL SERMIG PASSO A PASSO + REQUISITOS DO VISTO */}
      {libraryView === 'guia_sermig' && (
        <section className="space-y-6">
          <div className="bg-white border border-[#E5DFD2] rounded-2xl p-6 space-y-5 shadow-[0_2px_10px_rgba(11,31,51,0.03)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="brand-kicker">Fluxo Operacional Oficial</p>
                <h2 className="font-display text-lg font-bold text-[#0B1F33] mt-0.5">
                  Guia Procedimental SERMIG {selectedVisaObject ? `— ${selectedVisaObject.nomePortugues}` : '(Fluxo Geral)'}
                </h2>
                <p className="text-xs text-[#4A5A6D] mt-0.5">
                  Roteiro operacional fundamentado na legislação chilena (Ley Nº 21.325 e Decreto Supremo Nº 296/2022) e nos manuais do Servicio Nacional de Migraciones (SERMIG).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLibraryView('acervo')}
                className="px-3.5 py-1.5 rounded-lg border border-[#DDD6C7] bg-[#FAF9F6] text-xs font-semibold text-[#0B1F33] hover:bg-white whitespace-nowrap shrink-0"
              >
                Voltar às normas
              </button>
            </div>

            <div className="divide-y divide-[#E5DFD2]">
              {proceduralSteps.map((step) => (
                <div key={step.numero} className="py-5 first:pt-1 last:pb-1 grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-4 space-y-1">
                    <p className="text-xs font-mono font-bold text-[#8C6D14] tabular-nums">
                      FASE 0{step.numero} · {step.prazoReferencia}
                    </p>
                    <h3 className="text-base font-bold text-[#0B1F33]">{step.titulo}</h3>
                  </div>
                  <div className="lg:col-span-6 space-y-1.5">
                    <p className="text-sm text-[#4A5A6D] leading-relaxed">{step.resumo}</p>
                    <p className="text-xs text-[#4A5A6D]">
                      <strong className="text-[#0B1F33]">Orientação prática:</strong> {step.checklistDica}
                    </p>
                  </div>
                  <div className="lg:col-span-2 lg:text-right">
                    <a
                      href={step.linkOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD6C7] bg-[#FAF9F6] text-xs font-semibold text-[#0B1F33] hover:bg-white whitespace-nowrap shrink-0"
                    >
                      {step.linkLabel}
                      <ExternalLink className="w-3 h-3 text-[#8C6D14]" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedVisaObject && visaChecklistReference.length > 0 && (
            <div className="bg-white border border-[#E5DFD2] rounded-2xl p-6 space-y-4 shadow-[0_2px_10px_rgba(11,31,51,0.03)]">
              <div>
                <p className="brand-kicker">Checklist Técnico Ordenado</p>
                <h3 className="text-base font-bold text-[#0B1F33] mt-0.5">
                  Documentos de Referência — {selectedVisaObject.nomePortugues}
                </h3>
                <p className="text-xs text-[#4A5A6D] mt-0.5">
                  Ordem de emissão recomendada para preservar validades curtas (como Antecedentes de 60 dias).
                </p>
              </div>
              <div className="divide-y divide-[#E5DFD2]">
                {visaChecklistReference.map((req) => (
                  <div key={req.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-[#8C6D14] tabular-nums">
                        Prioridade #{req.ordemPrioridadeEmissao} · <span className="font-sans text-[#4A5A6D]">{req.categoriaDoc} · {req.orgaoEmissor}</span>
                        {req.validadeDias > 0 ? ` · Validade ${req.validadeDias}d` : ' · Sem vencimento curto'}
                      </p>
                      <p className="text-sm font-bold text-[#0B1F33]">{req.nomeDocumento}</p>
                      <p className="text-xs text-[#4A5A6D]">{req.comoObterInstrucoes}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 shrink-0 text-xs">
                      <span className="text-[#4A5A6D] font-medium">
                        {req.exigeApostila ? 'Exige Apostila' : 'Sem Apostila'}
                        <span aria-hidden="true"> · </span>
                        {req.exigeTraducao ? 'Tradução aplicável' : 'Dispensa tradução (Mercosul)'}
                      </span>
                      {req.comoObterUrl && (
                        <a
                          href={req.comoObterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-[#0B1F33] hover:text-[#8C6D14] hover:underline whitespace-nowrap shrink-0"
                        >
                          Como obter
                          <ExternalLink className="w-3 h-3 text-[#8C6D14]" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Modal de Leitura Detalhada da Norma / Circular */}
      {readingSource && (
        <div
          className="fixed inset-0 z-50 bg-[#071422]/75 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={readingSource.titulo}
        >
          <div className="bg-white border border-[#E5DFD2] rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
            <BrandRibbon className="h-[3px] w-full shrink-0" />
            <div className="px-6 py-4 bg-[#0B1F33] text-white flex items-start justify-between gap-4 shrink-0">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#E5C76B] font-mono tabular-nums">
                  {getJurisdictionLabel(readingSource.pais)} · {readingSource.tipo}
                  {readingSource.numeroAno ? ` · ${readingSource.numeroAno}` : ''} · {readingSource.statusVigencia}
                </p>
                <h2 className="font-display text-lg font-bold text-white leading-snug">{readingSource.titulo}</h2>
              </div>
              <button
                type="button"
                onClick={() => setReadingSource(null)}
                aria-label="Fechar leitura normativa"
                className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8C6D14]">Em linguagem simples para o cliente</p>
                <p className="text-sm text-[#0B1F33] leading-relaxed">{readingSource.explicacaoCliente}</p>
              </div>

              {readingSource.resumoPortugues && (
                <div className="space-y-1.5 pt-4 border-t border-[#E5DFD2]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8C6D14]">Resumo técnico &amp; enquadramento</p>
                  <p className="text-sm text-[#4A5A6D] leading-relaxed whitespace-pre-wrap">
                    {readingSource.resumoPortugues}
                  </p>
                </div>
              )}

              {readingSource.artigos && (
                <div className="space-y-1 pt-4 border-t border-[#E5DFD2]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8C6D14]">Dispositivos e pontos-chave</p>
                  <p className="text-sm text-[#0B1F33]">{readingSource.artigos}</p>
                </div>
              )}

              {readingSource.artigosEstruturados && readingSource.artigosEstruturados.length > 0 && (
                <div className="space-y-2.5 pt-4 border-t border-[#E5DFD2]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8C6D14]">Detalhamento procedimental e artigos</p>
                  <div className="divide-y divide-[#E5DFD2] border border-[#E5DFD2] rounded-xl bg-[#FAF9F6]">
                    {readingSource.artigosEstruturados.map((art, idx) => (
                      <div key={idx} className="p-3.5 text-xs space-y-1">
                        <p className="font-bold text-[#0B1F33]">
                          {art.numero}
                          {art.titulo ? ` — ${art.titulo}` : ''}
                        </p>
                        <p className="text-[#4A5A6D] leading-relaxed">{art.resumo}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {readingSource.textoIntegral && (
                <div className="space-y-1.5 pt-4 border-t border-[#E5DFD2]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8C6D14]">Trecho normativo cadastrado</p>
                  <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2] text-xs text-[#0B1F33] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                    {readingSource.textoIntegral}
                  </div>
                </div>
              )}

              {(() => {
                const visas = getApplicableVisaCategories(readingSource, activeVisas);
                if (visas.length === 0) return null;
                return (
                  <div className="pt-4 border-t border-[#E5DFD2] space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8C6D14]">Vistos e fluxos relacionados</p>
                    <p className="text-xs text-[#0B1F33] leading-relaxed">
                      {visas.map((v) => `[${v.codigo}] ${v.nomePortugues}`).join(' · ')}
                    </p>
                  </div>
                );
              })()}
            </div>

            <div className="px-6 py-4 border-t border-[#E5DFD2] bg-[#FAF9F6] flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
              <div className="text-[#4A5A6D] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-[#146B43]" />
                <span>
                  Órgão: {readingSource.orgaoEmissor}
                  {readingSource.ultimaVerificacao ? ` · Revisado em ${formatDateBR(readingSource.ultimaVerificacao)}` : ''}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {readingSource.arquivoPdfUrl && (
                  <a
                    href={readingSource.arquivoPdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD6C7] bg-white font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] whitespace-nowrap shrink-0"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Abrir PDF normativo
                  </a>
                )}
                {readingSource.linkOficial && (
                  <a
                    href={readingSource.linkOficial}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg font-semibold text-white whitespace-nowrap shrink-0 hover:opacity-95"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    Consultar fonte oficial
                    <ExternalLink className="w-3.5 h-3.5 text-[#E5C76B]" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setReadingSource(null)}
                  className="px-3 py-1.5 rounded-lg border border-[#DDD6C7] bg-white font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] whitespace-nowrap shrink-0"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
