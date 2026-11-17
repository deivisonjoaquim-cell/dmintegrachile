import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, ExternalLink, Printer } from 'lucide-react';
import type { Case, CaseDocument, Client } from '../../types/domain';
import { calcularTermometroDocumentos } from '../../utils/caseMetrics';
import { exportToCSV, formatDateBR } from '../../utils/formatters';

interface PainelDocumentosExportProps {
  clients: Client[];
  cases: Case[];
  docs: CaseDocument[];
  avisoLegal: string;
}

export const PainelDocumentosExport: React.FC<PainelDocumentosExportProps> = ({
  clients,
  cases,
  docs,
  avisoLegal,
}) => {
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(cases[0]?.id || null);
  const [search, setSearch] = useState('');

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const filteredCases = cases.filter((c) => {
    if (!search.trim()) return true;
    const cl = clientMap.get(c.clientId);
    const q = search.toLowerCase();
    return c.titulo.toLowerCase().includes(q) || (cl?.nomeCompleto || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documentos &amp; Exportação de Dossiês</h1>
          <p className="text-xs text-slate-500">Visão consolidada por caso, download de arquivos, impressão de dossiê e CSV</p>
        </div>
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
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Download className="w-4 h-4" />
          Exportar CSV Geral
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filtrar por cliente ou título do caso..."
        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm no-print"
      />

      {filteredCases.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
          Nenhum caso encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCases.map((c) => {
            const cl = clientMap.get(c.clientId);
            const cDocs = docs.filter((d) => d.caseId === c.id);
            const thermo = calcularTermometroDocumentos(cDocs);
            const isOpen = expandedCaseId === c.id;

            return (
              <div key={c.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedCaseId(isOpen ? null : c.id)}
                  className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-900">{c.titulo}</p>
                    <p className="text-xs text-slate-500">
                      {cl?.nomeCompleto || 'Cliente'} · {cDocs.length} documento(s) · Termômetro:{' '}
                      <span className="font-bold tabular-nums" style={{ color: thermo.corHex }}>
                        {thermo.notaGeral}% ({thermo.faixa})
                      </span>
                    </p>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-2 border-t border-slate-200 space-y-4">
                    <div className="flex flex-wrap justify-end gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: 'var(--color-primary)' }}
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir Dossiê / PDF
                      </button>
                    </div>

                    {cDocs.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhum documento cadastrado neste caso.</p>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {cDocs.map((d) => (
                          <div key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div>
                              <p className="font-semibold text-slate-900">
                                [{d.pessoa}] {d.nomeDocumento}
                              </p>
                              <p className="text-slate-500">
                                {d.categoriaDoc} · Status: {d.status} · Etapa: {d.etapaEsteira} · Emissão:{' '}
                                {formatDateBR(d.dataEmissao)} · Validade: {formatDateBR(d.dataValidadeCalculada)}
                              </p>
                            </div>
                            {d.arquivoUrl ? (
                              <a
                                href={d.arquivoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline"
                              >
                                Baixar arquivo
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-slate-400">Sem anexo</span>
                            )}
                          </div>
                        ))}
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
    </div>
  );
};
