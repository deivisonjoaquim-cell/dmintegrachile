import { jsPDF } from 'jspdf';
import { BRAND_ASSETS } from '../constants/brandAssets';
import type { DiagnosticAnswers, EmpresaConfig } from '../types/domain';
import type { DiagnosticResult } from './diagnosticEngine';
import { formatDateBR } from './formatters';
import {
  buildBasicDiagnosticSummary,
  CONSULTANCY_PLANS,
  type BasicDiagnosticSummary,
} from './portalAccess';

export interface ClientDiagnosticPdfInput {
  empresa: EmpresaConfig;
  summary?: BasicDiagnosticSummary;
  result?: DiagnosticResult;
  answers?: Partial<DiagnosticAnswers>;
  protocolo?: string;
  logoDataUrl?: string;
}

const NAVY: [number, number, number] = [11, 31, 51];
const NAVY_SOFT: [number, number, number] = [22, 50, 79];
const GOLD: [number, number, number] = [200, 162, 54];
const GOLD_DARK: [number, number, number] = [140, 109, 20];
const EMERALD: [number, number, number] = [20, 107, 67];
const AMBER: [number, number, number] = [180, 118, 22];
const IVORY: [number, number, number] = [247, 245, 240];
const BORDER: [number, number, number] = [224, 218, 204];
const INK: [number, number, number] = [15, 23, 42];
const MUTED: [number, number, number] = [90, 104, 122];
const WHITE: [number, number, number] = [255, 255, 255];

function safeText(val: unknown, fallback = '—'): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val)
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u00A0/g, ' ')
    .trim();
  return s.length > 0 ? s : fallback;
}

function slugifyToken(value: string): string {
  const clean = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return clean || 'CLIENTE';
}

function getBarColor(pct: number): [number, number, number] {
  if (pct >= 75) return EMERALD;
  if (pct >= 50) return NAVY;
  return AMBER;
}

function getProtocolJurisdictionLabel(permite?: 'Sim' | 'Não' | 'Condicional'): string {
  if (permite === 'Sim') return 'Permitido dentro do Chile';
  if (permite === 'Não') return 'Protocolo do exterior (fora do Chile)';
  if (permite === 'Condicional') return 'Condicional (depende do perfil)';
  return 'Sob validação técnica';
}

async function resolveBrandLogoForDarkHeader(empresa: EmpresaConfig): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }
  const { resolvePdfLogoDataUrl } = await import('../components/pdf/ClientPortalPdfDocuments');
  // Prefer official dark-surface horizontal logo so wordmark stays bright on the #0B1F33 header
  const candidates = [
    BRAND_ASSETS.logoDarkPng,
    BRAND_ASSETS.logoLightPng,
    empresa.logoUrl,
  ].filter((u): u is string => Boolean(u && u.trim()));

  for (const url of candidates) {
    const resolved = await resolvePdfLogoDataUrl(url);
    if (resolved) return resolved;
  }
  return undefined;
}

function drawTricolorRibbon(doc: jsPDF, y: number, height = 2.2) {
  const pageW = doc.internal.pageSize.getWidth();
  // Brazil emerald -> Gold guide star -> Deep navy -> Andean crimson accent
  doc.setFillColor(20, 107, 67);
  doc.rect(0, y, pageW * 0.28, height, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(pageW * 0.28, y, pageW * 0.34, height, 'F');
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(pageW * 0.62, y, pageW * 0.26, height, 'F');
  doc.setFillColor(166, 28, 43);
  doc.rect(pageW * 0.88, y, pageW * 0.12, height, 'F');
}

function drawFooter(doc: jsPDF, empresa: EmpresaConfig, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const footerY = pageH - 13;

  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(safeText(empresa.nome_empresa, 'D&M Integra Chile'), margin, footerY + 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const contactLine = [empresa.whatsapp, empresa.email].filter(Boolean).join('  |  ');
  if (contactLine) {
    doc.text(contactLine, margin, footerY + 4.8);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageW - margin, footerY + 1, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Documento orientativo · Proteção LGPD (Lei nº 13.709/2018)', pageW - margin, footerY + 4.8, {
    align: 'right',
  });
}

function drawSectionEyebrow(doc: jsPDF, x: number, y: number, eyebrow: string, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(eyebrow.toUpperCase(), x, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, x, y + 4.8);

  return y + 7.2;
}

/**
 * Constrói o Dossiê Executivo de 2 Páginas do Cliente em vetor nativo (jsPDF),
 * contendo identidade visual oficial D&M Integra Chile, gráfico vetorial dos
 * pilares de viabilidade e roteiro macro em 4 fases.
 */
export function buildClientDiagnosticDossierDoc(input: ClientDiagnosticPdfInput): {
  doc: jsPDF;
  filename: string;
} {
  const { empresa, result, answers, logoDataUrl } = input;
  const summary: BasicDiagnosticSummary =
    input.summary ||
    (result
      ? buildBasicDiagnosticSummary(result, answers)
      : {
          notaViabilidade: 0,
          veredito: 'Em análise técnica',
          confianca: 'Média',
          subcategoriaCodigo: 'ANÁLISE',
          subcategoriaNome: 'Enquadramento Migratório',
          resumoBasico: 'Relatório preliminar de elegibilidade migratória Brasil-Chile.',
          temAlertaCritico: false,
          itensBloqueados: [],
          dataCalculo: new Date().toISOString(),
        });

  const protocoloRef = safeText(input.protocolo, 'PRELIMINAR').toUpperCase();
  const emissaoBR = formatDateBR(summary.dataCalculo || new Date().toISOString());
  const titularNome = safeText(summary.nome || answers?.nome, 'Solicitante');
  const filename = `Dossie-Diagnostico-DM-Integra-${slugifyToken(titularNome)}-${slugifyToken(protocoloRef)}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 14;
  const contentW = pageW - margin * 2; // 182mm

  // =========================================================================
  // PÁGINA 1: SUMÁRIO EXECUTIVO & RAIO-X DE VIABILIDADE
  // =========================================================================
  drawTricolorRibbon(doc, 0, 2.4);

  // Cabeçalho Executivo em Azul Marinho
  const headerTop = 2.4;
  const headerH = 34;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, headerTop, pageW, headerH, 'F');

  // Linha fina dourada sob o cabeçalho
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, headerTop + headerH, pageW, 0.8, 'F');

  // Logo oficial à esquerda
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, headerTop + 6.5, 58, 19, undefined, 'FAST');
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
      doc.text(safeText(empresa.nome_empresa, 'D&M Integra Chile'), margin, headerTop + 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.text('RELOCATION & ASSESSORIA MIGRATÓRIA', margin, headerTop + 22.5);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text(safeText(empresa.nome_empresa, 'D&M Integra Chile'), margin, headerTop + 17);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text('RELOCATION & ASSESSORIA MIGRATÓRIA', margin, headerTop + 22.5);
  }

  // Metadados do documento à direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text('DOSSIÊ DE ELEGIBILIDADE MIGRATÓRIA', pageW - margin, headerTop + 11.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(`Protocolo #${protocoloRef}`, pageW - margin, headerTop + 18, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido em ${emissaoBR} · Base Ley Nº 21.325 & Mercosul`, pageW - margin, headerTop + 24, {
    align: 'right',
  });

  // Faixa de Perfil do Solicitante (Ivory card)
  let y = headerTop + headerH + 6;
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, 15.5, 2, 2, 'FD');

  const profileCols = [
    { label: 'TITULAR', value: titularNome },
    { label: 'LOCALIZAÇÃO ATUAL', value: safeText(summary.perfilResumo?.localizacao || answers?.localizacao) },
    { label: 'COMPOSIÇÃO', value: safeText(summary.familiaResumo || summary.perfilResumo?.familia) },
    { label: 'HORIZONTE', value: safeText(summary.perfilResumo?.prazo || answers?.prazoPretendido) },
  ];
  const pColW = contentW / profileCols.length;
  profileCols.forEach((col, i) => {
    const cx = margin + i * pColW + 3.5;
    if (i > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin + i * pColW, y + 2.5, margin + i * pColW, y + 13);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.4);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(col.label, cx, y + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const truncated = doc.splitTextToSize(col.value, pColW - 6)[0] || col.value;
    doc.text(truncated, cx, y + 11);
  });

  // Bloco Principal: Rota Recomendada (Esquerda) + Placar de Viabilidade (Direita)
  y += 20;
  const heroBoxH = 44;
  const scoreBoxW = 54;
  const routeBoxW = contentW - scoreBoxW - 4;

  // Cartão da Rota Principal
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y, routeBoxW, heroBoxH, 2.2, 2.2, 'FD');

  // Filete superior dourado interno
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(margin, y, routeBoxW, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(`ROTA PRINCIPAL INDICADA · CÓD. ${safeText(summary.subcategoriaCodigo)}`, margin + 4.5, y + 6.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  const titleLines = doc.splitTextToSize(safeText(summary.subcategoriaNome), routeBoxW - 9).slice(0, 2);
  doc.text(titleLines, margin + 4.5, y + 13);

  let routeTextY = y + 13 + titleLines.length * 5.2;
  if (summary.subcategoriaEspanhol) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const esLine = doc.splitTextToSize(`SERMIG: ${safeText(summary.subcategoriaEspanhol)}`, routeBoxW - 9)[0];
    doc.text(esLine, margin + 4.5, routeTextY);
    routeTextY += 4.6;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const summaryLines = doc.splitTextToSize(safeText(summary.resumoBasico), routeBoxW - 9).slice(0, 4);
  doc.text(summaryLines, margin + 4.5, routeTextY + 0.5);

  // Cartão do Índice de Viabilidade (Azul Marinho)
  const scoreX = margin + routeBoxW + 4;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(scoreX, y, scoreBoxW, heroBoxH, 2.2, 2.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text('ÍNDICE DE VIABILIDADE', scoreX + 4.5, y + 7);

  const scoreVal = Math.max(0, Math.min(100, Math.round(summary.notaViabilidade || 0)));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(String(scoreVal), scoreX + 4.5, y + 20.5);

  const numWidth = doc.getTextWidth(String(scoreVal));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text('/100', scoreX + 5.5 + numWidth, y + 20.5);

  // Barra vetorial de score
  const barX = scoreX + 4.5;
  const barW = scoreBoxW - 9;
  const barY = y + 24;
  doc.setFillColor(NAVY_SOFT[0], NAVY_SOFT[1], NAVY_SOFT[2]);
  doc.roundedRect(barX, barY, barW, 2.6, 1.3, 1.3, 'F');
  const scoreFill = scoreVal >= 75 ? [34, 197, 94] : scoreVal >= 50 ? GOLD : [245, 158, 11];
  doc.setFillColor(scoreFill[0], scoreFill[1], scoreFill[2]);
  doc.roundedRect(barX, barY, Math.max(3, (barW * scoreVal) / 100), 2.6, 1.3, 1.3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  const verdictLines = doc.splitTextToSize(safeText(summary.veredito), barW).slice(0, 2);
  doc.text(verdictLines, barX, y + 32);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`Confiança da análise: ${safeText(summary.confianca)}`, barX, y + 40.5);

  // Grade dos 4 Parâmetros Estratégicos
  y += heroBoxH + 5;
  const paramsH = 18;
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y, contentW, paramsH, 2, 2, 'FD');

  const paramItems = [
    {
      label: 'LOCAL DE PROTOCOLO',
      value: getProtocolJurisdictionLabel(summary.permiteDentroChile),
    },
    {
      label: 'AUTORIZAÇÃO DE TRABALHO',
      value:
        summary.permiteTrabalhar === undefined
          ? 'Conforme subcategoria'
          : summary.permiteTrabalhar
            ? 'Atividade remunerada liberada'
            : 'Restrita a esta categoria',
    },
    {
      label: 'RESIDÊNCIA DEFINITIVA',
      value:
        summary.levaDefinitiva === undefined
          ? 'Sob validação técnica'
          : summary.levaDefinitiva
            ? 'Elegível cumprindo prazo legal'
            : 'Exige troca de subcategoria',
    },
    {
      label: 'PRAZO DE REFERÊNCIA',
      value: safeText(summary.prazoEstimadoResumo, 'Conforme fila SERMIG'),
    },
  ];
  const paramColW = contentW / 4;
  paramItems.forEach((p, idx) => {
    const px = margin + idx * paramColW + 3.5;
    if (idx > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin + idx * paramColW, y + 2.5, margin + idx * paramColW, y + paramsH - 2.5);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(p.label, px, y + 5.6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const pLines = doc.splitTextToSize(p.value, paramColW - 6).slice(0, 2);
    doc.text(pLines, px, y + 10.5);
  });

  // Gráfico Vetorial dos Pilares de Viabilidade
  y += paramsH + 9;
  y = drawSectionEyebrow(
    doc,
    margin,
    y,
    'Decomposição Técnica da Pontuação',
    'Gráfico de Pilares de Viabilidade Migratória',
  );

  const dims = summary.dimensoes && summary.dimensoes.length > 0
    ? summary.dimensoes
    : [
        {
          nome: 'Aderência Geral ao Enquadramento',
          pontos: scoreVal,
          maximo: 100,
          percentual: scoreVal,
          observacao: 'Pontuação consolidada a partir das informações do diagnóstico.',
        },
      ];

  const chartBoxTop = y + 1;
  const rowPitch = Math.min(16.5, Math.max(12.5, Math.floor(114 / Math.max(dims.length, 1))));
  const chartBoxH = dims.length * rowPitch + 10;
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, chartBoxTop, contentW, chartBoxH, 2.2, 2.2, 'FD');

  // Linhas de grade verticais (25%, 50%, 75%, 100%) na área das barras
  const labelW = 62;
  const chartBarX = margin + labelW;
  const chartBarW = contentW - labelW - 24;
  [0.25, 0.5, 0.75, 1].forEach((ratio) => {
    const gx = chartBarX + chartBarW * ratio;
    doc.setDrawColor(238, 234, 224);
    doc.setLineWidth(0.2);
    doc.line(gx, chartBoxTop + 4, gx, chartBoxTop + chartBoxH - 6);
  });

  dims.forEach((dim, idx) => {
    const ry = chartBoxTop + 8 + idx * rowPitch;
    const pct = Math.max(0, Math.min(100, Math.round(dim.percentual)));
    const fillCol = getBarColor(pct);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const dimTitle = doc.splitTextToSize(safeText(dim.nome), labelW - 6)[0];
    doc.text(dimTitle, margin + 4, ry);

    // Trilha da barra
    doc.setFillColor(238, 235, 228);
    doc.roundedRect(chartBarX, ry - 3, chartBarW, 3.6, 1.5, 1.5, 'F');

    // Preenchimento proporcional
    const fillW = Math.max(2.5, (chartBarW * pct) / 100);
    doc.setFillColor(fillCol[0], fillCol[1], fillCol[2]);
    doc.roundedRect(chartBarX, ry - 3, fillW, 3.6, 1.5, 1.5, 'F');

    // Rótulo numérico tabular à direita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.8);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(`${dim.pontos}/${dim.maximo} (${pct}%)`, margin + contentW - 4, ry, { align: 'right' });

    // Observação concisa logo abaixo
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const obsLine = doc.splitTextToSize(safeText(dim.observacao, ''), contentW - 10)[0] || '';
    if (obsLine) {
      doc.text(obsLine, margin + 4, ry + 4.4);
    }
  });

  // Legenda da escala na base do gráfico
  const scaleY = chartBoxTop + chartBoxH - 2.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('0%', chartBarX, scaleY);
  doc.text('50%', chartBarX + chartBarW * 0.5, scaleY, { align: 'center' });
  doc.text('100%', chartBarX + chartBarW, scaleY, { align: 'right' });

  // Alerta prioritário (se couber na Página 1)
  const afterChartY = chartBoxTop + chartBoxH + 5;
  if (summary.temAlertaCritico && summary.alertaGeral && afterChartY < 260) {
    doc.setFillColor(255, 250, 235);
    doc.setDrawColor(232, 195, 108);
    doc.roundedRect(margin, afterChartY, contentW, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(146, 64, 14);
    doc.text('PONTO DE ATENÇÃO PRIORITÁRIO', margin + 4, afterChartY + 5.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(120, 53, 15);
    const alertLines = doc.splitTextToSize(safeText(summary.alertaGeral), contentW - 8).slice(0, 2);
    doc.text(alertLines, margin + 4, afterChartY + 10.5);
  }

  drawFooter(doc, empresa, 1, 2);

  // =========================================================================
  // PÁGINA 2: ESTRATÉGIA, ROTEIRO EM 4 FASES & MODALIDADES
  // =========================================================================
  doc.addPage('a4', 'portrait');
  drawTricolorRibbon(doc, 0, 2.2);

  // Cabeçalho compacto da página 2
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 2.2, pageW, 16, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 18.2, pageW, 0.6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(`${safeText(empresa.nome_empresa, 'D&M Integra Chile')}  ·  Dossiê Estratégico`, margin, 11.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(`Protocolo #${protocoloRef}  ·  ${titularNome}`, pageW - margin, 11.5, { align: 'right' });

  let y2 = 26;

  // Bloco Comparativo: Pontos Fortes x Pontos de Atenção
  y2 = drawSectionEyebrow(
    doc,
    margin,
    y2,
    'Análise Qualitativa do Perfil',
    'Forças da Rota Recomendada & Pontos de Verificação',
  );

  const halfW = (contentW - 5) / 2;
  const qualBoxH = 54;

  // Esquerda: Pontos Fortes
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y2 + 1, halfW, qualBoxH, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(EMERALD[0], EMERALD[1], EMERALD[2]);
  doc.text('POR QUE ESTA ROTA SE DESTACA', margin + 4, y2 + 7);

  const fortes =
    summary.pontosFortes && summary.pontosFortes.length > 0
      ? summary.pontosFortes
      : ['Enquadramento preliminar compatível com as normas vigentes do SERMIG.'];

  let fy = y2 + 12.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  fortes.slice(0, 4).forEach((item) => {
    if (fy > y2 + qualBoxH - 5) return;
    doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.circle(margin + 5.2, fy - 1.1, 0.9, 'F');
    const lines = doc.splitTextToSize(safeText(item), halfW - 11).slice(0, 2);
    doc.text(lines, margin + 8, fy);
    fy += lines.length * 4 + 2.4;
  });

  // Direita: Pontos de Atenção
  const rightX = margin + halfW + 5;
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(rightX, y2 + 1, halfW, qualBoxH, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text('PONTOS DE VERIFICAÇÃO PRIORITÁRIOS', rightX + 4, y2 + 7);

  const atencoes =
    summary.pontosAtencao && summary.pontosAtencao.length > 0
      ? summary.pontosAtencao
      : [
          'Validar prazos curtos de emissão (antecedentes criminais de 60 dias) antes de iniciar apostilamentos.',
          'Confirmar traduções juramentadas e sequência cronológica de protocolo no portal SERMIG.',
        ];

  let ay = y2 + 12.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  atencoes.slice(0, 4).forEach((item) => {
    if (ay > y2 + qualBoxH - 5) return;
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.circle(rightX + 5.2, ay - 1.1, 0.9, 'F');
    const lines = doc.splitTextToSize(safeText(item), halfW - 11).slice(0, 2);
    doc.text(lines, rightX + 8, ay);
    ay += lines.length * 4 + 2.4;
  });

  // Roteiro Macro em 4 Fases
  y2 += qualBoxH + 10;
  y2 = drawSectionEyebrow(
    doc,
    margin,
    y2,
    'Visão Estruturada da Jornada',
    'Roteiro Macro do Processo Migratório em 4 Fases',
  );

  const fases =
    summary.roteiroMacro && summary.roteiroMacro.length > 0
      ? summary.roteiroMacro.slice(0, 4)
      : [
          {
            fase: 1,
            titulo: 'Enquadramento & Estratégia',
            foco: 'Definição técnica',
            resumo: 'Confirmação da subcategoria ideal no SERMIG e mapeamento de riscos do perfil.',
          },
          {
            fase: 2,
            titulo: 'Emissão, Apostila & Tradução',
            foco: 'Ordem cronológica',
            resumo: 'Emissão sincronizada das certidões, Apostila de Haia e traduções oficiais.',
          },
          {
            fase: 3,
            titulo: 'Protocolo Oficial SERMIG',
            foco: 'Submissão digital',
            resumo: 'Envio estruturado do dossiê e acompanhamento ativo de eventuais exigências.',
          },
          {
            fase: 4,
            titulo: 'Estampado, PDI & Cédula',
            foco: 'Instalação regular',
            resumo: 'Aprovação, Estampado Eletrônico, registro PDI e emissão da Cédula chilena (RUN).',
          },
        ];

  const phaseGap = 3.5;
  const phaseW = (contentW - phaseGap * 3) / 4;
  const phaseH = 54;
  const phaseTop = y2 + 2;

  // Linha conectora dourada entre as 4 fases
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(0.7);
  doc.line(margin + phaseW * 0.5, phaseTop + 7.5, margin + contentW - phaseW * 0.5, phaseTop + 7.5);

  fases.forEach((f, idx) => {
    const fx = margin + idx * (phaseW + phaseGap);
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(fx, phaseTop, phaseW, phaseH, 2.2, 2.2, 'FD');

    // Selo numérico da fase
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.roundedRect(fx + 3.5, phaseTop + 3.5, 16, 6.2, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text(`FASE 0${f.fase}`, fx + 11.5, phaseTop + 7.7, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const focoLine = doc.splitTextToSize(safeText(f.foco), phaseW - 7)[0];
    doc.text(focoLine, fx + 3.5, phaseTop + 14.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.4);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const fTitleLines = doc.splitTextToSize(safeText(f.titulo), phaseW - 7).slice(0, 2);
    doc.text(fTitleLines, fx + 3.5, phaseTop + 19.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const fDescLines = doc.splitTextToSize(safeText(f.resumo), phaseW - 7).slice(0, 6);
    doc.text(fDescLines, fx + 3.5, phaseTop + 19.5 + fTitleLines.length * 4 + 1.5);
  });

  y2 = phaseTop + phaseH + 9;

  // Tabela de Rotas Alternativas Avaliadas (se houver)
  if (summary.alternativasMapeadas && summary.alternativasMapeadas.length > 0) {
    y2 = drawSectionEyebrow(doc, margin, y2, 'Matriz Comparativa Inicial', 'Rotas Secundárias Avaliadas');

    const tblTop = y2 + 1;
    const rowH = 8.5;
    const rows = summary.alternativasMapeadas.slice(0, 2);
    const tblH = 7.5 + rows.length * rowH;

    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.roundedRect(margin, tblTop, contentW, tblH, 2, 2, 'FD');

    // Cabeçalho da tabela
    doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
    doc.rect(margin + 0.2, tblTop + 0.2, contentW - 0.4, 7.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('SUBCATEGORIA ALTERNATIVA', margin + 4, tblTop + 5);
    doc.text('PEDIDO DENTRO DO CHILE', margin + 108, tblTop + 5);
    doc.text('ADERÊNCIA', margin + contentW - 4, tblTop + 5, { align: 'right' });

    rows.forEach((alt, idx) => {
      const ry = tblTop + 7.5 + idx * rowH;
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin, ry, margin + contentW, ry);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(`${safeText(alt.codigo)} · ${safeText(alt.nome)}`, margin + 4, ry + 5.6);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(safeText(alt.permiteDentroChile), margin + 108, ry + 5.6);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(`${Math.round(alt.aderencia)}/100`, margin + contentW - 4, ry + 5.6, { align: 'right' });
    });

    y2 = tblTop + tblH + 8;
  }

  // Bloco Executivo de Próximo Passo: Modalidades de Assessoria
  const ctaTop = Math.min(y2, 214);
  const ctaH = 56;
  const planOri = CONSULTANCY_PLANS.orientativa;
  const planComp = CONSULTANCY_PLANS.completa;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text('PRÓXIMO PASSO · ASSESSORIA ESPECIALIZADA', margin, ctaTop);

  // Cartão 1: Consultoria Orientativa (Claro)
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, ctaTop + 3, halfW, ctaH - 3, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(safeText(planOri.badgeLabel).toUpperCase(), margin + 4, ctaTop + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(planOri.nome, margin + 4, ctaTop + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const oriLines = doc.splitTextToSize(planOri.subtitulo, halfW - 8).slice(0, 2);
  doc.text(oriLines, margin + 4, ctaTop + 19.5);

  let py1 = ctaTop + 28.5;
  planOri.inclui.slice(0, 3).forEach((item) => {
    const l = doc.splitTextToSize(`• ${safeText(item)}`, halfW - 8).slice(0, 2);
    doc.text(l, margin + 4, py1);
    py1 += l.length * 3.6 + 1.5;
  });

  // Cartão 2: Consultoria Completa (Azul Marinho + Ouro)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(rightX, ctaTop + 3, halfW, ctaH - 3, 2.2, 2.2, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(rightX, ctaTop + 3, halfW, 1.3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(`${safeText(planComp.badgeLabel).toUpperCase()} · EXECUÇÃO INTEGRAL`, rightX + 4, ctaTop + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(planComp.nome, rightX + 4, ctaTop + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(215, 224, 236);
  const compLines = doc.splitTextToSize(planComp.subtitulo, halfW - 8).slice(0, 2);
  doc.text(compLines, rightX + 4, ctaTop + 20);

  let py2 = ctaTop + 29;
  planComp.inclui.slice(0, 3).forEach((item) => {
    const l = doc.splitTextToSize(`• ${safeText(item)}`, halfW - 8).slice(0, 2);
    doc.text(l, rightX + 4, py2);
    py2 += l.length * 3.6 + 1.5;
  });

  // Nota Legal / Contato acima do rodapé
  const legalY = ctaTop + ctaH + 4.5;
  if (legalY < 276) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const legalNotice = doc
      .splitTextToSize(
        safeText(
          empresa.avisoLegal,
          'Este dossiê possui caráter orientativo inicial, não substitui consulta jurídica individualizada nem garante concessão de visto pelo SERMIG.',
        ),
        contentW,
      )
      .slice(0, 2);
    doc.text(legalNotice, margin, legalY);
  }

  drawFooter(doc, empresa, 2, 2);

  return { doc, filename };
}

export async function buildClientDiagnosticPdfBlob(
  input: ClientDiagnosticPdfInput,
): Promise<{ blob: Blob; filename: string }> {
  const logoDataUrl = input.logoDataUrl || (await resolveBrandLogoForDarkHeader(input.empresa));
  const { doc, filename } = buildClientDiagnosticDossierDoc({ ...input, logoDataUrl });
  const blob = doc.output('blob');
  return { blob, filename };
}

export async function exportClientDiagnosticPdf(input: ClientDiagnosticPdfInput): Promise<string> {
  const logoDataUrl = input.logoDataUrl || (await resolveBrandLogoForDarkHeader(input.empresa));
  const { doc, filename } = buildClientDiagnosticDossierDoc({ ...input, logoDataUrl });
  doc.save(filename);
  return filename;
}
