import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  Layers,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShieldCheck,
} from 'lucide-react';
import type {
  Case,
  Client,
  Dependent,
  DocumentTemplate,
  EmpresaConfig,
  GeneratedDocument,
  UserProfile,
  UserRole,
} from '../../types/domain';
import {
  buildContractReminderWhatsAppMessage,
  buildContractSignatureRows,
  computeContractSignatureMetrics,
  filterContractSignatureRows,
  type ContractSignatureFilter,
  type ContractSignatureRow,
} from '../../utils/contractSignatureStatus';
import { formatSignatureHashShort } from '../../utils/contractSignature';
import {
  buildWhatsAppUrl,
  formatDateBR,
  formatDateTimeBR,
  openExternalSafe,
} from '../../utils/formatters';
import { normalizePaidModality } from '../../utils/portalAccess';
import {
  saveDocumentAudited,
  setClientPortalAccessAudited,
} from '../../services/firestoreService';
import {
  getSignatureDocTypeMeta,
  matchesDocumentTypeGroup,
  type DocumentTypeFilterGroup,
} from '../../utils/multiDocumentPackage';
import { translateAppError } from '../../services/errorService';
import { ContractGeneratorModal } from './ContractGeneratorModal';
import { MultiDocumentPackageModal } from './MultiDocumentPackageModal';

export interface PainelAssinaturasContratosProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  clients: Client[];
  cases: Case[];
  dependents?: Dependent[];
  documentTemplates: DocumentTemplate[];
  generatedDocuments: GeneratedDocument[];
  onRefresh: () => Promise<void>;
  onLogWhatsApp: (
    clientId: string | undefined,
    caseId: string | undefined,
    assunto: string,
    msg: string,
  ) => Promise<void>;
}

export const PainelAssinaturasContratos: React.FC<PainelAssinaturasContratosProps> = ({
  role,
  userProfile,
  empresa,
  clients,
  cases,
  dependents = [],
  documentTemplates,
  generatedDocuments,
  onRefresh,
  onLogWhatsApp,
}) => {
  const [statusFilter, setStatusFilter] = useState<ContractSignatureFilter>('pendentes');
  const [typeFilter, setTypeFilter] = useState<DocumentTypeFilterGroup>('todos');
  const [search, setSearch] = useState('');
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [packageClientId, setPackageClientId] = useState<string | undefined>(undefined);
  const [editingDoc, setEditingDoc] = useState<GeneratedDocument | null>(null);

  const allRows = useMemo(
    () => buildContractSignatureRows(generatedDocuments, clients, cases),
    [generatedDocuments, clients, cases],
  );

  const metrics = useMemo(() => computeContractSignatureMetrics(allRows), [allRows]);

  const clientMultiDocProgress = useMemo(() => {
    const map = new Map<string, { total: number; signed: number }>();
    for (const row of allRows) {
      if (row.isCanceled) continue;
      const cur = map.get(row.doc.clientId) || { total: 0, signed: 0 };
      cur.total += 1;
      if (row.isSigned) cur.signed += 1;
      map.set(row.doc.clientId, cur);
    }
    return map;
  }, [allRows]);

  const filteredRows = useMemo(
    () =>
      filterContractSignatureRows(allRows, { statusFilter, search }).filter((row) =>
        matchesDocumentTypeGroup(row.doc.tipo, typeFilter),
      ),
    [allRows, statusFilter, search, typeFilter],
  );

  const handleOpenDocModal = (doc?: GeneratedDocument) => {
    setEditingDoc(doc || null);
    setModalOpen(true);
  };

  const handleReleaseToPortal = async (row: ContractSignatureRow) => {
    if (busyDocId) return;
    setBusyDocId(row.doc.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await saveDocumentAudited(
        'generatedDocuments',
        row.doc.id,
        {
          ...row.doc,
          liberadoAoCliente: true,
          updatedAt: new Date().toISOString(),
        },
        false,
        role,
        'liberar_doc_assinatura',
      );
      setFeedback(`Contrato "${row.doc.titulo}" liberado no Portal do Cliente para ${row.clientName}.`);
      await onRefresh();
    } catch (err) {
      const friendly = translateAppError(err, { source: 'assinaturas-liberar' });
      setErrorMsg(`${friendly.title}: ${friendly.message}`);
    } finally {
      setBusyDocId(null);
    }
  };

  const handleUnlockClientPortal = async (row: ContractSignatureRow) => {
    if (!row.client || busyDocId) return;
    setBusyDocId(row.doc.id);
    setErrorMsg(null);
    setFeedback(null);
    try {
      await setClientPortalAccessAudited({
        client: row.client,
        portalLiberado: true,
        modalidadeConsultoria: normalizePaidModality(row.client.modalidadeConsultoria),
        role,
      });
      setFeedback(`Portal do Cliente liberado para ${row.client.nomeCompleto}.`);
      await onRefresh();
    } catch (err) {
      const friendly = translateAppError(err, { source: 'assinaturas-portal' });
      setErrorMsg(`${friendly.title}: ${friendly.message}`);
    } finally {
      setBusyDocId(null);
    }
  };

  const handleSendWhatsAppReminder = async (row: ContractSignatureRow) => {
    const phone = row.clientWhatsapp.trim();
    if (!phone) {
      setErrorMsg(`O cliente ${row.clientName} não possui WhatsApp cadastrado.`);
      return;
    }
    const msg = buildContractReminderWhatsAppMessage(row, empresa.nome_empresa);
    const url = buildWhatsAppUrl(phone, msg);
    if (!url) {
      setErrorMsg('Número de WhatsApp inválido para envio de lembrete.');
      return;
    }
    openExternalSafe(url);
    await onLogWhatsApp(row.doc.clientId, row.doc.caseId, `Lembrete de assinatura: ${row.doc.titulo}`, msg).catch(
      () => undefined,
    );
    setFeedback(`Lembrete de assinatura aberto no WhatsApp para ${row.clientName}.`);
  };

  const handleDownloadPdf = async (row: ContractSignatureRow) => {
    if (pdfBusyId) return;
    setPdfBusyId(row.doc.id);
    setErrorMsg(null);
    try {
      const { exportGeneratedOfficialDocPdf } = await import('../pdf/ClientPortalPdfDocuments');
      const passportNum =
        row.client?.passaporte && typeof row.client.passaporte === 'object'
          ? row.client.passaporte.numero
          : undefined;
      await exportGeneratedOfficialDocPdf({
        empresa,
        titulo: row.doc.titulo,
        conteudo: row.doc.conteudoHtml,
        codigoVerificacao: row.doc.codigoVerificacao || row.doc.id,
        versao: row.doc.versao,
        status: row.doc.status,
        clienteNome: row.clientName,
        assinaturaDataUrl: row.doc.assinaturaDataUrl,
        assinaturaUrl: row.doc.assinaturaUrl,
        assinadoEm: row.doc.assinadoEm,
        assinaturaMetodo: row.doc.assinaturaMetodo,
        assinadoPorNome: row.doc.assinadoPorNome || row.clientName,
        assinadoPorEmail: row.doc.assinadoPorEmail || row.clientEmail,
        assinadoPorDocumento: row.doc.assinadoPorDocumento || row.client?.cpf || passportNum,
        assinaturaHashSha256: row.doc.assinaturaHashSha256,
        confirmadoLeituraEm: row.doc.confirmadoLeituraEm,
        canceladoMotivo: row.doc.canceladoEm ? row.doc.motivoCancelamento : undefined,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível exportar o PDF A4 do contrato.');
    } finally {
      setPdfBusyId(null);
    }
  };

  const filterTabs: Array<{ id: ContractSignatureFilter; label: string; count: number }> = [
    { id: 'pendentes', label: 'Pendentes', count: metrics.pendentes },
    { id: 'assinados', label: 'Assinados', count: metrics.assinados },
    { id: 'todos', label: 'Todos', count: metrics.total },
    { id: 'cancelados', label: 'Cancelados', count: metrics.cancelados },
  ];

  const renderStatusIndicator = (row: ContractSignatureRow) => {
    if (row.stage === 'assinado') {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            Assinado
          </span>
          {row.doc.assinaturaHashSha256 && (
            <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              SHA-256 {formatSignatureHashShort(row.doc.assinaturaHashSha256)}
            </p>
          )}
        </div>
      );
    }
    if (row.stage === 'pendente_leitura_confirmada') {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
            <Eye className="w-3.5 h-3.5 shrink-0" />
            Pendente · Leitura confirmada
          </span>
          {row.daysPending !== null && (
            <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {row.daysPending === 0 ? 'Emitido hoje' : `Aguardando há ${row.daysPending} dia(s)`}
            </p>
          )}
        </div>
      );
    }
    if (row.stage === 'pendente_aguardando') {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            Pendente de assinatura
          </span>
          {row.daysPending !== null && (
            <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              {row.daysPending === 0 ? 'Emitido hoje' : `Pendente há ${row.daysPending} dia(s)`}
            </p>
          )}
        </div>
      );
    }
    if (row.stage === 'pendente_nao_liberado') {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            Rascunho (não liberado)
          </span>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Ainda não visível no Portal</p>
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 dark:text-red-400">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Cancelado
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#070E1C] dark:text-white tracking-tight">
            Documentos para Assinatura &amp; Aprovação
          </h1>
          <p className="text-xs text-[#475569] dark:text-slate-400 mt-0.5">
            Envie contratos, recibos, procurações, orçamentos e termos (individuais ou em pacote) e acompanhe cada assinatura em tempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenDocModal()}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-xs font-semibold text-[#070E1C] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-[#17253B] whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Gerar Individual
          </button>
          <button
            type="button"
            onClick={() => {
              setPackageClientId(undefined);
              setPackageModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 hover:opacity-95"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Layers className="w-3.5 h-3.5" />
            Enviar Pacote (Vários Docs)
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Pendentes de Assinatura</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1">
            {metrics.pendentes}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {metrics.pendentesLiberados} no Portal · {metrics.pendentesInternos} interno(s)
          </p>
        </div>

        <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Leitura Confirmada</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#0F3D91] dark:text-[#60A5FA] mt-1">
            {metrics.pendentesLeituraConfirmada}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Abriram o contrato e faltam assinar
          </p>
        </div>

        <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Contratos Assinados</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
            {metrics.assinados}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Formalizados com certificado digital
          </p>
        </div>

        <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Taxa de Formalização</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#070E1C] dark:text-white mt-1">
            {metrics.taxaAssinaturaPct}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-mono tabular-nums">
            {metrics.assinados} de {metrics.totalActive} contrato(s) ativo(s)
          </p>
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          className="px-4 py-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 text-xs font-medium text-emerald-900 dark:text-emerald-300 flex items-center justify-between gap-2"
        >
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="font-semibold underline shrink-0">
            Fechar
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          className="px-4 py-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 text-xs font-medium text-red-800 dark:text-red-300 flex items-center justify-between gap-2"
        >
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="font-semibold underline shrink-0">
            Fechar
          </button>
        </div>
      )}

      {/* Barra de filtros + busca */}
      <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[#E5E7EB] dark:border-[#1E293B] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filtrar contratos por status de assinatura"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#132035] w-fit max-w-full"
          >
            {filterTabs.map((t) => {
              const active = statusFilter === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(t.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors font-mono tabular-nums ${
                    active
                      ? 'bg-white dark:bg-[#0D1422] text-[#070E1C] dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-[#070E1C] dark:hover:text-white'
                  }`}
                >
                  <span className="font-sans">{t.label}</span> ({t.count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
            <select
              aria-label="Filtrar por tipo de documento"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as DocumentTypeFilterGroup)}
              className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs font-medium text-[#070E1C] dark:text-white"
            >
              <option value="todos">Tipo: Todos</option>
              <option value="contrato">Contratos</option>
              <option value="recibo">Recibos</option>
              <option value="termos_procuracao">Termos &amp; Procurações</option>
              <option value="orcamento_aditivo">Orçamentos &amp; Aditivos</option>
              <option value="outros">Outros Documentos</option>
            </select>
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, título ou código..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1220] text-xs text-[#070E1C] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F3D91]/30"
              />
            </div>
          </div>
        </div>

        {/* Tabela desktop / Cards mobile */}
        {filteredRows.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <FileSignature className="w-7 h-7 mx-auto text-slate-400" />
            <p className="text-sm font-semibold text-[#070E1C] dark:text-white">
              {statusFilter === 'pendentes'
                ? 'Nenhum contrato pendente de assinatura encontrado'
                : 'Nenhum contrato encontrado para este filtro'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {statusFilter === 'pendentes' && metrics.assinados > 0
                ? 'Todos os contratos ativos já foram assinados. Selecione a aba "Assinados" para auditar os certificados.'
                : 'Ajuste o filtro acima ou gere um novo contrato para acompanhar a assinatura eletrônica.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#0B1220] text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Cliente &amp; Processo</th>
                    <th className="py-3 px-4">Contrato</th>
                    <th className="py-3 px-4">Status de Assinatura</th>
                    <th className="py-3 px-4">Última Interação</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#1E293B] text-xs">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.doc.id}
                      className="hover:bg-[#F7F8FA]/80 dark:hover:bg-[#111C30]/60 transition-colors"
                    >
                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-[#070E1C] dark:text-white">{row.clientName}</p>
                          {(clientMultiDocProgress.get(row.doc.clientId)?.total || 0) > 1 && (
                            <span className="text-[11px] font-mono tabular-nums text-[#0F3D91] dark:text-[#60A5FA] font-semibold">
                              · {clientMultiDocProgress.get(row.doc.clientId)?.signed}/
                              {clientMultiDocProgress.get(row.doc.clientId)?.total} assinados
                            </span>
                          )}
                        </div>
                        {row.clientEmail && (
                          <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                            {row.clientEmail}
                          </p>
                        )}
                        {row.caseTitle && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[240px]">
                            {row.caseTitle}
                          </p>
                        )}
                        {row.portalBlocked && (
                          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-amber-800 dark:text-amber-300">
                            <span>Portal bloqueado</span>
                            <button
                              type="button"
                              disabled={busyDocId === row.doc.id}
                              onClick={() => void handleUnlockClientPortal(row)}
                              className="font-semibold underline hover:no-underline"
                            >
                              Liberar acesso
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <p className="text-[11px] font-semibold text-[#8C6D14] dark:text-[#C9A86A]">
                          {getSignatureDocTypeMeta(row.doc.tipo).shortLabel}
                        </p>
                        <p className="font-semibold text-[#070E1C] dark:text-white mt-0.5">
                          {row.doc.titulo}{' '}
                          <span className="font-mono text-[11px] text-slate-500">v{row.doc.versao}</span>
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                          Cód. {row.doc.codigoVerificacao || row.doc.id} · Emitido {formatDateBR(row.doc.createdAt)}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 align-top">{renderStatusIndicator(row)}</td>

                      <td className="py-3.5 px-4 align-top">
                        <p className="font-mono tabular-nums font-semibold text-[#070E1C] dark:text-slate-100">
                          {formatDateTimeBR(row.lastInteractionAt)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {row.lastInteractionLabel}
                        </p>
                        {row.isSigned && row.doc.assinadoPorNome && (
                          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Signatário: {row.doc.assinadoPorNome}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => handleOpenDocModal(row.doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-[11px] font-semibold text-[#070E1C] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
                          >
                            {row.isSigned ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Eye className="w-3.5 h-3.5" />}
                            {row.isSigned ? 'Ver Certificado' : 'Abrir / Editar'}
                          </button>

                          <button
                            type="button"
                            disabled={pdfBusyId === row.doc.id}
                            onClick={() => void handleDownloadPdf(row)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap disabled:opacity-50"
                          >
                            <Download className="w-3.5 h-3.5" />
                            {pdfBusyId === row.doc.id ? 'PDF...' : 'PDF A4'}
                          </button>

                          {row.stage === 'pendente_nao_liberado' && (
                            <button
                              type="button"
                              disabled={busyDocId === row.doc.id}
                              onClick={() => void handleReleaseToPortal(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0B1F33] text-white text-[11px] font-semibold hover:opacity-95 whitespace-nowrap disabled:opacity-50"
                            >
                              <Send className="w-3 h-3" />
                              Liberar no Portal
                            </button>
                          )}

                          {row.isPending && row.doc.liberadoAoCliente && row.clientWhatsapp && (
                            <button
                              type="button"
                              onClick={() => void handleSendWhatsAppReminder(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 whitespace-nowrap"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              Lembrar
                            </button>
                          )}

                          {row.isSigned && row.doc.assinaturaUrl && (
                            <a
                              href={row.doc.assinaturaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold text-[#0F3D91] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                            >
                              Anexo
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-[#E5E7EB] dark:divide-[#1E293B]">
              {filteredRows.map((row) => (
                <div key={row.doc.id} className="p-4 space-y-3 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-[#070E1C] dark:text-white truncate">{row.clientName}</p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                        {row.doc.titulo} <span className="font-mono text-slate-500">(v{row.doc.versao})</span>
                      </p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">
                      {row.doc.codigoVerificacao || row.doc.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-lg bg-[#F7F8FA] dark:bg-[#0B1220] border border-[#E5E7EB] dark:border-[#1E293B]">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</p>
                      <div className="mt-1">{renderStatusIndicator(row)}</div>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Última Interação
                      </p>
                      <p className="font-mono tabular-nums font-semibold text-[#070E1C] dark:text-slate-100 mt-1">
                        {formatDateTimeBR(row.lastInteractionAt)}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{row.lastInteractionLabel}</p>
                    </div>
                  </div>

                  {row.portalBlocked && (
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-900 dark:text-amber-300">
                      <span>Portal do cliente ainda bloqueado</span>
                      <button
                        type="button"
                        disabled={busyDocId === row.doc.id}
                        onClick={() => void handleUnlockClientPortal(row)}
                        className="font-semibold underline shrink-0"
                      >
                        Liberar Portal
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenDocModal(row.doc)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-[11px] font-semibold text-[#070E1C] dark:text-slate-100"
                    >
                      {row.isSigned ? 'Ver Certificado' : 'Abrir / Editar'}
                    </button>
                    <button
                      type="button"
                      disabled={pdfBusyId === row.doc.id}
                      onClick={() => void handleDownloadPdf(row)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF A4
                    </button>
                    {row.stage === 'pendente_nao_liberado' && (
                      <button
                        type="button"
                        disabled={busyDocId === row.doc.id}
                        onClick={() => void handleReleaseToPortal(row)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0B1F33] text-white text-[11px] font-semibold"
                      >
                        Liberar no Portal
                      </button>
                    )}
                    {row.isPending && row.doc.liberadoAoCliente && row.clientWhatsapp && (
                      <button
                        type="button"
                        onClick={() => void handleSendWhatsAppReminder(row)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Lembrar WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal unificado de edição / prévia / certificado de documento */}
      <ContractGeneratorModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingDoc(null);
        }}
        role={role}
        userProfile={userProfile}
        empresa={empresa}
        clients={clients}
        cases={cases}
        dependents={dependents}
        documentTemplates={documentTemplates}
        generatedDocuments={generatedDocuments}
        initialEditingDoc={editingDoc}
        onRefresh={onRefresh}
        onLogWhatsApp={onLogWhatsApp}
      />

      {/* Modal de envio em pacote (múltiplos documentos para o cliente assinar e aprovar) */}
      <MultiDocumentPackageModal
        open={packageModalOpen}
        onClose={() => {
          setPackageModalOpen(false);
          setPackageClientId(undefined);
        }}
        role={role}
        userProfile={userProfile}
        empresa={empresa}
        clients={clients}
        cases={cases}
        dependents={dependents}
        documentTemplates={documentTemplates}
        generatedDocuments={generatedDocuments}
        initialClientId={packageClientId}
        onRefresh={onRefresh}
        onLogWhatsApp={onLogWhatsApp}
      />
    </div>
  );
};
