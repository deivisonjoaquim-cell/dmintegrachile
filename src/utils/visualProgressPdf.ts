import { PIPELINE_STAGES } from '../data/seeds';
import type { Case, CaseDocument, Client, EmpresaConfig, Task } from '../types/domain';
import type { TaskProgressOverview } from './taskProgressMetrics';
import { formatDateBR, formatDateTimeBR, formatStandardDocFilename, toIsoDate } from './formatters';

export interface VisualProgressPdfInput {
  empresa: EmpresaConfig;
  client: Client | null;
  activeCase: Case | null;
  cases?: Case[];
  clients?: Client[];
  tasks: Task[];
  docs: CaseDocument[];
  overview: TaskProgressOverview;
  logoDataUrl?: string;
  now?: Date;
}

export interface VisualPdfTaskRow {
  id: string;
  titulo: string;
  prioridade: string;
  prazo: string;
  status: Task['status'];
}

export interface VisualPdfDocRow {
  id: string;
  nomeDocumento: string;
  pessoa: string;
  arquivoNome?: string;
  versaoLabel: string;
  dataRef: string;
  formalizacao: string;
  status: CaseDocument['status'];
}

export interface VisualPdfCaseRow {
  id: string;
  clientName: string;
  titulo: string;
  etapaLabel: string;
  statusSermig: string;
}

export interface VisualPdfPagePlan {
  pageNumber: number;
  totalPages: number;
  isFirstPage: boolean;
  caseRows: VisualPdfCaseRow[];
  taskRows: VisualPdfTaskRow[];
  showTasksHeader: boolean;
  showTasksEmpty: boolean;
  docRows: VisualPdfDocRow[];
  showDocsHeader: boolean;
  showDocsEmpty: boolean;
}

export interface VisualProgressPdfModel {
  filename: string;
  primaryColor: string;
  accentColor: string;
  brandName: string;
  brandSub: string;
  contactLine: string;
  generatedAt: string;
  scopeTitle: string;
  scopeSubtitle: string;
  stageNumber: number | null;
  stageName: string;
  sermigStatus: string;
  protocoloSermig: string;
  isSingleCaseView: boolean;
  totalActiveCases: number;
  submittedDocsCount: number;
  approvedDocsCount: number;
  reviewDocsCount: number;
  pendingUploadCount: number;
  pages: VisualPdfPagePlan[];
}

export function safeHexColor(hex?: string, fallback = '#0F2537'): string {
  if (!hex) return fallback;
  return /^#[0-9A-Fa-f]{6}$/.test(hex.trim()) ? hex.trim() : fallback;
}

export function isSubmittedDocument(doc: CaseDocument): boolean {
  return (
    doc.status !== 'Pendente' ||
    Boolean(doc.arquivoUrl) ||
    Boolean(doc.anexos && doc.anexos.length > 0) ||
    Boolean(doc.historicoVersoes && doc.historicoVersoes.length > 0)
  );
}

export function sanitizeHtml2CanvasClone(clonedDoc: Document): void {
  const root = clonedDoc.documentElement;
  if (root) {
    root.style.backgroundColor = '#FFFFFF';
    root.style.color = '#0F172A';
    root.style.colorScheme = 'light';
  }
  if (clonedDoc.body) {
    clonedDoc.body.style.margin = '0';
    clonedDoc.body.style.padding = '0';
    clonedDoc.body.style.backgroundColor = '#FFFFFF';
    clonedDoc.body.style.color = '#0F172A';
  }

  // Tailwind CSS v4 gera variáveis oklch()/oklab()/color-mix() não suportadas pelo parser do html2canvas v1.4.
  // O template visual de PDF usa 100% estilos inline hex/rgb, então neutralizamos folhas com oklch/oklab no clone.
  const styleNodes = Array.from(clonedDoc.querySelectorAll('style'));
  for (const node of styleNodes) {
    const css = node.textContent || '';
    if (css.includes('oklch(') || css.includes('oklab(') || css.includes('color-mix(')) {
      node.remove();
    }
  }

  const linkNodes = Array.from(clonedDoc.querySelectorAll('link[rel="stylesheet"]'));
  for (const link of linkNodes) {
    const href = (link.getAttribute('href') || '').toLowerCase();
    const isGoogleFont = href.includes('fonts.googleapis.com');
    if (!isGoogleFont) {
      link.remove();
    }
  }
}

export function buildVisualProgressPdfModel(input: VisualProgressPdfInput): VisualProgressPdfModel {
  const {
    empresa,
    client,
    activeCase,
    cases = [],
    clients = [],
    tasks,
    docs,
    overview,
    now = new Date(),
  } = input;

  const primaryColor = safeHexColor(empresa.corPrimaria, '#0F2537');
  const accentColor = safeHexColor(empresa.corDestaque, '#D4AF37');
  const brandName = (empresa.nome_empresa || 'D&M Integra Chile – Relocation & Assessoria').trim();
  const brandSub = (empresa.razao_social_cnpj_rut || 'Atuação como Pessoa Física · Marca própria D&M Integra Chile').trim();
  const contactLine = [empresa.email, empresa.whatsapp, empresa.endereco_cidade].filter(Boolean).join(' · ');
  const generatedAt = formatDateTimeBR(now);

  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const sortedTasks: VisualPdfTaskRow[] = [...tasks]
    .sort((a, b) => {
      const weight = (s: Task['status']) => (s === 'Em andamento' ? 0 : s === 'Pendente' ? 1 : 2);
      const diff = weight(a.status) - weight(b.status);
      if (diff !== 0) return diff;
      return (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31');
    })
    .slice(0, 48)
    .map((t) => ({
      id: t.id,
      titulo: t.titulo || 'Tarefa operacional',
      prioridade: t.prioridade || 'Média',
      prazo: t.prazo ? formatDateBR(t.prazo) : '—',
      status: t.status,
    }));

  const submittedDocsRaw = [...docs].filter(isSubmittedDocument).sort((a, b) => a.ordemEmissao - b.ordemEmissao);
  const approvedDocsCount = docs.filter((d) => d.status === 'Aprovado').length;
  const reviewDocsCount = docs.filter((d) => d.status === 'Enviado' || d.status === 'Em análise').length;
  const pendingUploadCount = docs.filter((d) => d.status === 'Pendente').length;

  const submittedDocs: VisualPdfDocRow[] = submittedDocsRaw.slice(0, 48).map((d) => {
    const lastDate =
      d.analisadoEm ||
      d.anexos?.[d.anexos.length - 1]?.data ||
      d.historicoVersoes?.[d.historicoVersoes.length - 1]?.data ||
      d.updatedAt;
    const versionCount = d.historicoVersoes?.length || 0;
    const attachCount = d.anexos?.length || 0;
    const apostLabel = d.exigeApostila ? (d.apostilado ? 'Apost. OK' : 'Apost. Pend.') : 'S/ Apost.';
    const tradLabel = d.exigeTraducao ? (d.traduzido ? 'Trad. OK' : 'Trad. Pend.') : 'S/ Trad.';

    return {
      id: d.id,
      nomeDocumento: d.nomeDocumento || 'Documento',
      pessoa: d.pessoa || 'Titular',
      arquivoNome: attachCount > 1 && d.arquivoNome ? `${d.arquivoNome} (${attachCount} anexos)` : d.arquivoNome,
      versaoLabel: `v${d.versao || 1}${versionCount > 0 ? ` (+${versionCount})` : ''}`,
      dataRef: lastDate ? formatDateBR(lastDate) : '—',
      formalizacao: `${apostLabel} / ${tradLabel}`,
      status: d.status,
    };
  });

  const isSingleCaseView = Boolean(activeCase);
  const stageNumber = activeCase?.etapaPipeline ?? null;
  const stageName = stageNumber
    ? PIPELINE_STAGES.find((st) => st.numero === stageNumber)?.nome || `Etapa ${stageNumber}`
    : overview.stageSummary;

  const scopeTitle = client?.nomeCompleto || overview.activeLabel || 'Processos Ativos';
  const scopeSubtitle = activeCase
    ? `${activeCase.titulo} · ${activeCase.tipoServico}`
    : `${cases.length} processo(s) ativo(s) consolidado(s)`;

  const caseRows: VisualPdfCaseRow[] = !isSingleCaseView
    ? cases.slice(0, 6).map((c) => ({
        id: c.id,
        clientName: clientMap.get(c.clientId)?.nomeCompleto || 'Cliente',
        titulo: c.titulo || 'Processo migratório',
        etapaLabel: `Etapa ${c.etapaPipeline}/15`,
        statusSermig: c.statusSermig || 'Não protocolado',
      }))
    : [];

  // Planejamento conservador de páginas A4 (794x1123px) para nunca cortar linhas no meio
  const chartExtraRows = !isSingleCaseView ? Math.min(5, overview.rows.length) : 0;
  const page1RowBudget = Math.max(
    4,
    (isSingleCaseView ? 9 : 7) - Math.ceil(caseRows.length * 0.6) - Math.ceil(chartExtraRows * 0.5),
  );
  const nextPageRowBudget = 16;

  const pages: VisualPdfPagePlan[] = [];
  let taskIdx = 0;
  let docIdx = 0;

  const takeChunk = (budget: number, isFirst: boolean): VisualPdfPagePlan => {
    let remaining = budget;
    const chunkTasks: VisualPdfTaskRow[] = [];
    const chunkDocs: VisualPdfDocRow[] = [];

    const showTasksHeader = taskIdx < sortedTasks.length || (isFirst && sortedTasks.length === 0);
    const showTasksEmpty = isFirst && sortedTasks.length === 0;

    if (taskIdx < sortedTasks.length && remaining > 0) {
      const takeT = sortedTasks.slice(taskIdx, taskIdx + remaining);
      chunkTasks.push(...takeT);
      taskIdx += takeT.length;
      remaining -= takeT.length;
    }

    // Reserva ao menos 2 unidades de espaço caso comece a tabela de documentos na mesma página
    const canStartDocs = docIdx < submittedDocs.length || (submittedDocs.length === 0 && taskIdx >= sortedTasks.length);
    const docsNeedHeaderCost = docIdx === 0 && submittedDocs.length > 0 ? 2 : 0;

    let showDocsHeader = false;
    let showDocsEmpty = false;

    if (canStartDocs && remaining > docsNeedHeaderCost) {
      showDocsHeader = true;
      if (submittedDocs.length === 0) {
        showDocsEmpty = true;
      } else {
        remaining -= docsNeedHeaderCost;
        const takeD = submittedDocs.slice(docIdx, docIdx + Math.max(1, remaining));
        chunkDocs.push(...takeD);
        docIdx += takeD.length;
      }
    }

    return {
      pageNumber: pages.length + 1,
      totalPages: 1, // ajustado ao final
      isFirstPage: isFirst,
      caseRows: isFirst ? caseRows : [],
      taskRows: chunkTasks,
      showTasksHeader: showTasksHeader && (chunkTasks.length > 0 || showTasksEmpty),
      showTasksEmpty,
      docRows: chunkDocs,
      showDocsHeader,
      showDocsEmpty,
    };
  };

  pages.push(takeChunk(page1RowBudget, true));

  while (
    taskIdx < sortedTasks.length ||
    docIdx < submittedDocs.length ||
    (submittedDocs.length === 0 && !pages.some((p) => p.showDocsHeader))
  ) {
    pages.push(takeChunk(nextPageRowBudget, false));
    if (pages.length >= 12) break; // guarda de segurança
  }

  const totalPages = pages.length;
  for (const p of pages) {
    p.totalPages = totalPages;
  }

  const filename = formatStandardDocFilename(
    client?.nomeCompleto || activeCase?.titulo || 'PROCESSOS_ATIVOS',
    'RESUMO_STATUS_PROCESSO',
    toIsoDate(now),
    'pdf',
  );

  return {
    filename,
    primaryColor,
    accentColor,
    brandName,
    brandSub,
    contactLine,
    generatedAt,
    scopeTitle,
    scopeSubtitle,
    stageNumber,
    stageName,
    sermigStatus: activeCase?.statusSermig || 'Consolidado',
    protocoloSermig: activeCase?.numeroPedidoSermig || '',
    isSingleCaseView,
    totalActiveCases: cases.length,
    submittedDocsCount: submittedDocsRaw.length,
    approvedDocsCount,
    reviewDocsCount,
    pendingUploadCount,
    pages,
  };
}
