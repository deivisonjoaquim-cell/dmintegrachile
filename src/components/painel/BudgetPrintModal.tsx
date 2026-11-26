import React from 'react';
import { Printer, X } from 'lucide-react';
import { InstitutionalBrandMark } from '../BrandLogo';
import type { Budget, Case, Client, EmpresaConfig } from '../../types/domain';
import { calculateBudgetTotals, convertBudgetSummaryCurrencies } from '../../utils/budgetUtils';
import { formatCurrency, formatDateBR } from '../../utils/formatters';

interface BudgetPrintModalProps {
  budget: Budget | null;
  client?: Client;
  linkedCase?: Case;
  empresa: EmpresaConfig;
  onClose: () => void;
}

export const BudgetPrintModal: React.FC<BudgetPrintModalProps> = ({
  budget,
  client,
  linkedCase,
  empresa,
  onClose,
}) => {
  if (!budget) return null;

  const totals = calculateBudgetTotals(budget.itens, budget.desconto);
  const converted = convertBudgetSummaryCurrencies(totals.totalGeral, budget.moedaPrincipal, {
    brlClp: budget.taxaCambioBrlClp || empresa.taxaCambioBrlClp,
    usdBrl: budget.taxaCambioUsdBrl || empresa.taxaCambioUsdBrl,
  });

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Proposta comercial ${budget.numeroOrcamento}`}
    >
      <div className="bg-white text-slate-900 rounded-xl max-w-3xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Barra de ações (oculta na impressão) */}
        <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-3.5 bg-slate-50 border-b border-slate-200">
          <div>
            <p className="text-xs font-semibold text-slate-900">Pré-visualização de Proposta Comercial (A4)</p>
            <p className="text-[11px] text-slate-500">
              {budget.numeroOrcamento} · {client?.nomeCompleto || 'Cliente não vinculado'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar pré-visualização da proposta"
              className="p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Folha A4 imprimível */}
        <div className="print-sheet p-8 sm:p-10 space-y-8 bg-white text-slate-900">
          {/* Cabeçalho institucional */}
          <div className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="space-y-2">
              <InstitutionalBrandMark tone="light" size="header" />
              <div className="text-[11px] text-slate-500 leading-relaxed pt-1">
                <p className="font-semibold text-slate-700">{empresa.nome_empresa}</p>
                {empresa.razao_social_cnpj_rut && <p>{empresa.razao_social_cnpj_rut}</p>}
                {empresa.endereco_cidade && <p>{empresa.endereco_cidade}</p>}
                <p>
                  {empresa.email}
                  {empresa.whatsapp ? ` · ${empresa.whatsapp}` : ''}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right space-y-1">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">Proposta Comercial</p>
              <p className="text-xl font-bold font-mono tabular-nums text-slate-900">{budget.numeroOrcamento}</p>
              <p className="text-xs text-slate-600 tabular-nums">Emitida em {formatDateBR(budget.createdAt)}</p>
              <p className="text-xs font-semibold text-slate-800 tabular-nums">
                Validade: {formatDateBR(budget.validade)}
              </p>
            </div>
          </div>

          {/* Dados do Cliente e Objeto */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-200 text-xs">
            <div className="space-y-1">
              <p className="font-semibold text-slate-500">Destinatário</p>
              <p className="text-sm font-bold text-slate-900">{client?.nomeCompleto || 'Cliente'}</p>
              {client?.email && <p className="text-slate-600">{client.email}</p>}
              {client?.whatsapp && <p className="text-slate-600">WhatsApp: {client.whatsapp}</p>}
              {client?.cpf && <p className="text-slate-600 font-mono">CPF: {client.cpf}</p>}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-slate-500">Escopo da Proposta</p>
              <p className="text-sm font-bold text-slate-900">{budget.titulo}</p>
              <p className="text-slate-600">
                Modelo: {budget.tipoCobranca}
                {budget.modalidadeConsultoria
                  ? ` · ${budget.modalidadeConsultoria === 'completa' ? 'Consultoria Completa' : 'Consultoria Orientativa'}`
                  : ''}
              </p>
              {linkedCase && <p className="text-slate-600">Processo: {linkedCase.titulo}</p>}
            </div>
          </div>

          {/* Tabela de Itens */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Detalhamento de Etapas e Investimento
            </h3>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-300 text-slate-600">
                  <th className="py-2.5 pr-3 font-semibold">Etapa / Descrição</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Honorários</th>
                  <th className="py-2.5 pl-3 font-semibold text-right">Taxas Est. Terceiros</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {budget.itens.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-3">
                      <p className="font-semibold text-slate-900">{item.descricao}</p>
                      {item.etapaVinculada && <p className="text-[11px] text-slate-500 mt-0.5">{item.etapaVinculada}</p>}
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrency(item.valorHonorarios, item.moeda || budget.moedaPrincipal)}
                    </td>
                    <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {formatCurrency(item.taxasEstimadasTerceiros, item.moeda || budget.moedaPrincipal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totalizador */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 pt-4 border-t border-slate-200">
            <div className="flex-1 space-y-2 text-xs text-slate-600">
              <p className="font-semibold text-slate-900">Condições de Pagamento</p>
              <p className="leading-relaxed whitespace-pre-wrap">{budget.condicoesPagamento}</p>
              {empresa.chavePix && (
                <p className="pt-1 text-[11px] text-slate-500">
                  Chave Pix oficial: <span className="font-mono font-semibold text-slate-800">{empresa.chavePix}</span>
                </p>
              )}
            </div>
            <div className="w-full sm:w-72 space-y-1.5 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex justify-between text-slate-600">
                <span>Total Honorários</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatCurrency(totals.totalHonorarios, budget.moedaPrincipal)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxas Est. Terceiros</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(totals.totalTaxas, budget.moedaPrincipal)}
                </span>
              </div>
              {totals.descontoAplicado > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Desconto Especial</span>
                  <span className="font-mono tabular-nums font-semibold">
                    -{formatCurrency(totals.descontoAplicado, budget.moedaPrincipal)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-2 mt-2 border-t border-slate-300 text-sm font-bold text-slate-900">
                <span>Total Estimado</span>
                <span className="font-mono tabular-nums">
                  {formatCurrency(totals.totalGeral, budget.moedaPrincipal)}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-mono tabular-nums pt-1">
                Ref. câmbio: {formatCurrency(converted.BRL, 'BRL')} · {formatCurrency(converted.USD, 'USD')} ·{' '}
                {formatCurrency(converted.CLP, 'CLP')}
              </p>
            </div>
          </div>

          {/* Rodapé legal */}
          <div className="pt-6 border-t border-slate-200 text-[11px] text-slate-500 space-y-1 leading-relaxed">
            <p>
              * Taxas de terceiros (SERMIG, Apostila CNJ, traduções juramentadas e cédula de identidade) são estimativas
              referenciais e são recolhidas diretamente aos órgãos/prestadores oficiais conforme tabela vigente na data do
              protocolo.
            </p>
            <p>
              Responsável técnico: {empresa.responsavel_tecnico} · Foro: {empresa.foro_comarca}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
