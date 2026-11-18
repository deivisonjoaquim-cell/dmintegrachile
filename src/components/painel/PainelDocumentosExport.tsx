import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Eye, FileText, FolderArchive, Printer, X } from 'lucide-react';
import { DEFAULT_EMPRESA_CONFIG } from '../../data/seeds';
import { logSensitiveDocumentAccess } from '../../services/firestoreService';
import type { Case, CaseDocument, Client, Deadline, Dependent, EmpresaConfig, UserRole } from '../../types/domain';
import { calcularTermometroDocumentos } from '../../utils/caseMetrics';
import { exportToCSV, formatDateBR, formatStandardDocFilename } from '../../utils/formatters';
import { buildZipBlob, type ZipEntryInput } from '../../utils/zipBuilder';
import { PdfPreviewModal } from '../pdf/PdfPreviewModal';

interface PainelDocumentosExportProps {
  role: UserRole;
  empresa?: EmpresaConfig;
  clients: Client[];
  dependents?: Dependent[];
  cases: Case[];
  docs: CaseDocument[];
  deadlines?: Deadline[];
  avisoLegal: string;
}

type DocStatusFilter = 'Todos' | CaseDocument['status'];

const DOC_STATUS_OPTIONS: DocStatusFilter[] = [
  'Todos',
  'Pendente',
  'Enviado',
  'Em análise',
  'Aprovado',
  'Reprovado',
];

export const PainelDocumentosExport: React.FC<PainelDocumentosExportProps> = ({
  role,
  empresa,
  clients,
  dependents = [],
  cases,
  docs,
  deadlines = [],
  avisoLegal,
}) => {
  const [expandedCaseIds, setExpandedCaseIds] = useState<string[]>(() => (cases[0]?.id ? [cases[0].id] : []));
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState('');
  const [caseFilter, setCaseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocStatusFilter>('Todos');
  const [zipBusyCaseId, setZipBusyCaseId] = useState<string | null>(null);
  const [pdfBusyCaseId, setPdfBusyCaseId] = useState<string | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ title: string; filename: string; blobUrl: string } | null>(null);
  const [previewDoc, setPreviewDoc] = useState<CaseDocument | null>(null);

  const effectiveEmpresa = useMemo<EmpresaConfig>(
    () => (empresa ? { ...empresa, avisoLegal: empresa.avisoLegal || avisoLegal } : { ...DEFAULT_EMPRESA_CONFIG, avisoLegal }),
    [empresa, avisoLegal],
  );

  const cardStyle: React.CSSProperties = {
    backgroundColor: 'var(--color-surface)',
    borderRadius: 'var(--card-radius, 12px)',
  };

  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const docStats = useMemo(() => {
    let aprovados = 0;
    let conferencia = 0;
    let pendentes = 0;
    let reprovados = 0;
    for (const d of docs) {
      if (d.status === 'Aprovado') aprovados++;
      else if (d.status === 'Enviado' || d.status === 'Em análise') conferencia++;
      else if (d.status === 'Reprovado') reprovados++;
      else pendentes++;
    }
    return { total: docs.length, aprovados, conferencia, pendentes, reprovados };
  }, [docs]);

  const filteredCases = useMemo(
    () =>
      cases.filter((c) => {
        if (clientFilter && c.clientId !== clientFilter) return false;
        if (caseFilter && c.id !== caseFilter) return false;
        if (statusFilter !== 'Todos') {
          const hasMatchingStatus = docs.some((d) => d.caseId === c.id && d.status === statusFilter);
          if (!hasMatchingStatus) return false;
        }
        if (!search.trim()) return true;
        const cl = clientMap.get(c.clientId);
        const q = search.toLowerCase();
        const matchesDoc = docs.some((d) => d.caseId === c.id && d.nomeDocumento.toLowerCase().includes(q));
        return c.titulo.toLowerCase().includes(q) || (cl?.nomeCompleto || '').toLowerCase().includes(q) || matchesDoc;
      }),
    [cases, clientFilter, caseFilter, statusFilter, search, clientMap, docs],
  );

  const toggleExpandCase = (id: string) => {
    setExpandedCaseIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allExpanded = filteredCases.length > 0 && filteredCases.every((c) => expandedCaseIds.includes(c.id));

  const handleDownloadCaseZip = async (c: Case, cDocs: CaseDocument[]) => {
    setZipBusyCaseId(c.id);
    try {
      const entries: ZipEntryInput[] = [];
      const manifestLines = [
        'D&M Integra Chile — Dossie Documental',
        `Caso: ${c.titulo}`,
        `Cliente: ${clientMap.get(c.clientId)?.nomeCompleto || c.clientId}`,
        `Gerado em: ${new Date().toISOString()}`,
        '',
        'Documentos:',
      ];

      for (const d of cDocs) {
        manifestLines.push(
          `- [${d.pessoa}] ${d.nomeDocumento} | Status: ${d.status} | Emissao: ${formatDateBR(d.dataEmissao)} | Validade: ${formatDateBR(d.dataValidadeCalculada)}`,
        );
        if (d.arquivoUrl) {
          void logSensitiveDocumentAccess(d, 'baixar', role);
          const ext = d.arquivoNome?.split('.').pop() || 'pdf';
          const stdName = formatStandardDocFilename(d.pessoa, d.nomeDocumento, d.dataEmissao, ext);
          try {
            const resp = await fetch(d.arquivoUrl);
            if (resp.ok) {
              const buf = new Uint8Array(await resp.arrayBuffer());
              entries.push({ name: `${d.pessoa}/${stdName}`, data: buf });
            }
          } catch {
            entries.push({ name: `${d.pessoa}/${stdName}.url.txt`, data: d.arquivoUrl });
          }
        }
      }
      entries.unshift({ name: '00_INDICE_DOSSIE.txt', data: manifestLines.join('\n') });
      const blob = buildZipBlob(entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = formatStandardDocFilename(clientMap.get(c.clientId)?.nomeCompleto || 'CASO', c.titulo, undefined, 'zip');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setZipBusyCaseId(null);
    }
  };

  const closePdfPreview = () => {
    setPdfPreview((prev) => {
      if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
      return null;
    });
  };

  const handleExportDossiePdf = async (c: Case, cDocs: CaseDocument[], previewOnly: boolean) => {
    if (pdfBusyCaseId) return;
    setPdfBusyCaseId(c.id);
    setPdfFeedback(null);
    try {
      const cl = clientMap.get(c.clientId) || null;
      const cDeps = dependents.filter((d) => d.clientId === c.clientId);
      const cDeadlines = deadlines.filter((dl) => dl.caseId === c.id);
      const thermo = calcularTermometroDocumentos(cDocs, effectiveEmpresa.bloqueioProtocoloMinimo || 100);
      const mod = await import('../pdf/ClientPortalPdfDocuments');
      if (previewOnly) {
        const { blob, filename } = await mod.buildDossieCasoPdfBlob({
          empresa: effectiveEmpresa,
          client: cl,
          activeCase: c,
          dependents: cDeps,
          docs: cDocs,
          deadlines: cDeadlines,
          thermo,
        });
        const blobUrl = URL.createObjectURL(blob);
        setPdfPreview((prev) => {
          if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
          return {
            title: `Pré-visualização: Dossiê (${c.titulo})`,
            filename,
            blobUrl,
          };
        });
      } else {
        const filename = await mod.exportDossieCasoPdf({
          empresa: effectiveEmpresa,
          client: cl,
          activeCase: c,
          dependents: cDeps,
          docs: cDocs,
          deadlines: cDeadlines,
          thermo,
        });
        setPdfFeedback(`Dossiê exportado em PDF (${filename}).`);
      }
    } catch (err) {
      setPdfFeedback(err instanceof Error ? err.message : 'Não foi possível gerar o PDF do dossiê.');
    } finally {
      setPdfBusyCaseId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentos &amp; Exportação de Dossiês</h1>
          <p className="text-xs text-slate-500">
            Visão consolidada por caso, triagem por status, pacote ZIP completo, pré-visualização e CSV
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filteredCases.length > 0 && (
            <button
              type="button"
              onClick={() => setExpandedCaseIds(allExpanded ? [] : filteredCases.map((c) => c.id))}
              className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              {allExpanded ? 'Recolher todos' : 'Expandir todos'}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              exportToCSV(
                'documentos-dossies',
                ['Caso', 'Cliente', 'Pessoa', 'Documento', 'Categoria', 'Status', 'Etapa', 'Emissão', 'Validade'],
                docs.map((d) => {
                  const c = cases.find((x) => x.id === d.caseId);
                  const cl = clientMap.get(d.clientId);
                  return [
                    c?.titulo || d.caseId,
                    cl?.nomeCompleto || d.clientId,
                    d.pessoa,
                    d.nomeDocumento,
                    d.categoriaDoc,
                    d.status,
                    d.etapaEsteira,
                    formatDateBR(d.dataEmissao),
                    formatDateBR(d.dataValidadeCalculada),
                  ];
                }),
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exportar CSV Geral
          </button>
        </div>
      </div>

      {pdfFeedback && (
        <div className="no-print p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
          <span>{pdfFeedback}</span>
          <button type="button" onClick={() => setPdfFeedback(null)} className="underline">
            Fechar
          </button>
        </div>
      )}

      {/* KPIs da Esteira Documental */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="border border-slate-200 p-4" style={cardStyle}>
          <p className="text-xs text-slate-500">Total de documentos</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{docStats.total}</p>
        </div>
        <div className="border border-slate-200 p-4" style={cardStyle}>
          <p className="text-xs text-slate-500">Aprovados p/ protocolo</p>
          <p className="text-2xl font-bold text-[#1E7E34] mt-1 tabular-nums">{docStats.aprovados}</p>
        </div>
        <div className="border border-slate-200 p-4" style={cardStyle}>
          <p className="text-xs text-slate-500">Em conferência</p>
          <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{docStats.conferencia}</p>
        </div>
        <div className="border border-slate-200 p-4" style={cardStyle}>
          <p className="text-xs text-slate-500">Pendentes / Reprovados</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {docStats.pendentes} <span className="text-sm font-semibold text-[#C82333]">/ {docStats.reprovados}</span>
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="border border-slate-200 p-4 space-y-3 no-print" style={cardStyle}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar por cliente, caso ou documento..."
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm"
          />
          <select
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setCaseFilter('');
            }}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm"
          >
            <option value="">Todos os clientes</option>
            {clients
              .filter((c) => !c.arquivado)
              .map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.nomeCompleto}
                </option>
              ))}
          </select>
          <select
            value={caseFilter}
            onChange={(e) => setCaseFilter(e.target.value)}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm"
          >
            <option value="">Todos os casos</option>
            {cases
              .filter((c) => !clientFilter || c.clientId === clientFilter)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DocStatusFilter)}
            aria-label="Filtrar por status do documento"
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-sm"
          >
            {DOC_STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st === 'Todos' ? 'Status: Todos' : `Status: ${st}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredCases.length === 0 ? (
        <div className="border border-slate-200 p-10 text-center text-sm text-slate-500" style={cardStyle}>
          Nenhum caso encontrado com os filtros aplicados.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCases.map((c) => {
            const cl = clientMap.get(c.clientId);
            const allCaseDocs = docs.filter((d) => d.caseId === c.id);
            const cDocs = statusFilter === 'Todos' ? allCaseDocs : allCaseDocs.filter((d) => d.status === statusFilter);
            const thermo = calcularTermometroDocumentos(allCaseDocs);
            const isOpen = expandedCaseIds.includes(c.id);

            return (
              <div key={c.id} className="border border-slate-200 overflow-hidden" style={cardStyle}>
                <button
                  type="button"
                  onClick={() => toggleExpandCase(c.id)}
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50/80"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{c.titulo}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {cl?.nomeCompleto || 'Cliente'} · {cDocs.length} documento(s) exibido(s) · Termômetro:{' '}
                      <span className="font-bold" style={{ color: thermo.corHex }}>
                        {thermo.notaGeral}% ({thermo.faixa})
                      </span>
                    </p>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-200 space-y-4">
                    <div className="flex flex-wrap justify-end gap-2 no-print">
                      <button
                        type="button"
                        disabled={zipBusyCaseId === c.id || allCaseDocs.length === 0}
                        onClick={() => void handleDownloadCaseZip(c, allCaseDocs)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <FolderArchive className="w-3.5 h-3.5" />
                        {zipBusyCaseId === c.id ? 'Gerando ZIP...' : 'Baixar ZIP do Caso'}
                      </button>
                      <button
                        type="button"
                        disabled={pdfBusyCaseId !== null}
                        onClick={() => void handleExportDossiePdf(c, allCaseDocs, true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {pdfBusyCaseId === c.id ? 'Preparando...' : 'Pré-visualizar PDF'}
                      </button>
                      <button
                        type="button"
                        disabled={pdfBusyCaseId !== null}
                        onClick={() => void handleExportDossiePdf(c, allCaseDocs, false)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {pdfBusyCaseId === c.id ? 'Gerando PDF...' : 'Exportar Dossiê (PDF)'}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir
                      </button>
                    </div>

                    {cDocs.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum documento encontrado neste filtro.</p>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {cDocs.map((d) => {
                          const ext = d.arquivoNome?.split('.').pop() || 'pdf';
                          const downloadName = formatStandardDocFilename(d.pessoa, d.nomeDocumento, d.dataEmissao, ext);
                          return (
                            <div key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-900">
                                  [{d.pessoa}] {d.nomeDocumento}
                                </p>
                                <p className="text-slate-500 tabular-nums">
                                  {d.categoriaDoc} · Status:{' '}
                                  <span
                                    className="font-semibold"
                                    style={{
                                      color:
                                        d.status === 'Aprovado'
                                          ? '#1E7E34'
                                          : d.status === 'Reprovado'
                                            ? '#C82333'
                                            : '#475569',
                                    }}
                                  >
                                    {d.status}
                                  </span>{' '}
                                  · Etapa: {d.etapaEsteira} · Emissão: {formatDateBR(d.dataEmissao)} · Validade:{' '}
                                  {formatDateBR(d.dataValidadeCalculada)}
                                </p>
                              </div>
                              {d.arquivoUrl ? (
                                <div className="flex items-center gap-2 no-print shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      void logSensitiveDocumentAccess(d, 'visualizar', role);
                                      setPreviewDoc(d);
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Visualizar
                                  </button>
                                  <a
                                    href={d.arquivoUrl}
                                    download={downloadName}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => void logSensitiveDocumentAccess(d, 'baixar', role)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 font-semibold text-[var(--color-primary)] hover:bg-slate-50"
                                  >
                                    <Download className="w-3 h-3" />
                                    Baixar
                                  </a>
                                </div>
                              ) : (
                                <span className="text-slate-400">Sem anexo</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">{avisoLegal}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Pré-visualização com Log LGPD */}
      {previewDoc && previewDoc.arquivoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-900 truncate">
                [{previewDoc.pessoa}] {previewDoc.nomeDocumento}
              </p>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label="Fechar pré-visualização"
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-4 flex items-center justify-center min-h-[420px]">
              {/\.(jpg|jpeg|png|webp)$/i.test(previewDoc.arquivoNome || previewDoc.arquivoUrl) ? (
                <img src={previewDoc.arquivoUrl} alt={previewDoc.nomeDocumento} className="max-w-full max-h-[75vh] object-contain rounded shadow" />
              ) : (
                <iframe src={previewDoc.arquivoUrl} title={previewDoc.nomeDocumento} className="w-full h-[70vh] rounded border border-slate-300 bg-white" />
              )}
            </div>
          </div>
        </div>
      )}
      <PdfPreviewModal
        open={Boolean(pdfPreview)}
        title={pdfPreview?.title || 'Pré-visualização do Dossiê'}
        filename={pdfPreview?.filename || 'dossie.pdf'}
        blobUrl={pdfPreview?.blobUrl || null}
        onClose={closePdfPreview}
        onDownload={() => {
          if (!pdfPreview) return;
          const a = document.createElement('a');
          a.href = pdfPreview.blobUrl;
          a.download = pdfPreview.filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }}
      />
    </div>
  );
};
