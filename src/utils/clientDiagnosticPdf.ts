import { jsPDF } from 'jspdf';
import { BRAND_ASSETS } from '../constants/brandAssets';
import type { DiagnosticAnswers, EmpresaConfig } from '../types/domain';
import type { DiagnosticResult } from './diagnosticEngine';
import { formatDateBR } from './formatters';
import {
  buildBasicDiagnosticSummary,
  CONSULTANCY_PLANS,
  type BasicDiagnosticDimension,
  type BasicDiagnosticSummary,
} from './portalAccess';

export interface ClientDiagnosticPdfInput {
  empresa: EmpresaConfig;
  summary?: BasicDiagnosticSummary;
  result?: DiagnosticResult;
  answers?: Partial<DiagnosticAnswers>;
  protocolo?: string;
  logoDataUrl?: string;
  simulatedDimensions?: BasicDiagnosticDimension[] | null;
}

const NAVY: [number, number, number] = [11, 31, 51];
const NAVY_SOFT: [number, number, number] = [22, 50, 79];
const NAVY_TINT: [number, number, number] = [217, 226, 236];
const GOLD: [number, number, number] = [200, 162, 54];
const GOLD_DARK: [number, number, number] = [140, 109, 20];
const EMERALD: [number, number, number] = [20, 107, 67];
const EMERALD_TINT: [number, number, number] = [223, 241, 232];
const AMBER: [number, number, number] = [180, 118, 22];
const CRIMSON: [number, number, number] = [166, 28, 43];
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

function abbreviateRadarLabel(name: string): string {
  const trimmed = safeText(name, 'Pilar');
  const map: Record<string, string> = {
    'Compatibilidade de Perfil': 'Perfil & Obj.',
    'Conformidade de Localização': 'Jurisdição',
    'Prontidão Documental': 'Documentos',
    'Elegibilidade Normativa': 'Elegibilidade',
    'Regularidade Migratória': 'Histórico',
    'Vínculo / Comprovação': 'Vínculo/Renda',
    'Consistência das Respostas': 'Consistência',
  };
  if (map[trimmed]) return map[trimmed];
  return trimmed.length <= 14 ? trimmed : `${trimmed.slice(0, 12).trim()}.`;
}

async function resolveBrandLogoForDarkHeader(empresa: EmpresaConfig): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }
  const { resolvePdfLogoDataUrl } = await import('../components/pdf/ClientPortalPdfDocuments');
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
  doc.setFillColor(20, 107, 67);
  doc.rect(0, y, pageW * 0.28, height, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(pageW * 0.28, y, pageW * 0.34, height, 'F');
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(pageW * 0.62, y, pageW * 0.26, height, 'F');
  doc.setFillColor(CRIMSON[0], CRIMSON[1], CRIMSON[2]);
  doc.rect(pageW * 0.88, y, pageW * 0.12, height, 'F');
}

function drawFooter(doc: jsPDF, empresa: EmpresaConfig, pageNum: number, totalPages: number) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const footerY = pageH - 12.5;

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
  doc.setFontSize(6.8);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(eyebrow.toUpperCase(), x, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(title, x, y + 4.5);

  return y + 6.6;
}

function drawPolygonPath(
  doc: jsPDF,
  points: Array<{ x: number; y: number }>,
  style: 'S' | 'F' | 'FD' | 'DF',
) {
  if (points.length < 3) return;
  const relativeSegments: Array<[number, number]> = [];
  for (let i = 1; i < points.length; i++) {
    relativeSegments.push([
      Number((points[i].x - points[i - 1].x).toFixed(2)),
      Number((points[i].y - points[i - 1].y).toFixed(2)),
    ]);
  }
  doc.lines(relativeSegments, Number(points[0].x.toFixed(2)), Number(points[0].y.toFixed(2)), [1, 1], style, true);
}

/**
 * Desenha o Gráfico Radar Vetorial de Pilares de Viabilidade diretamente em jsPDF,
 * com anéis concêntricos (25/50/75/100%), eixos radiais, polígono preenchido do perfil
 * atual, nós dourados nos vértices e sobreposição opcional do cenário simulado ("E se...").
 */
function drawVectorRadarChart(
  doc: jsPDF,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  rawDims: BasicDiagnosticDimension[],
  simulatedDimensions?: BasicDiagnosticDimension[] | null,
) {
  const dims: BasicDiagnosticDimension[] =
    rawDims.length >= 3
      ? rawDims
      : [
          ...rawDims,
          ...Array.from({ length: Math.max(0, 3 - rawDims.length) }, (_, idx) => ({
            nome: `Pilar ${idx + 1}`,
            pontos: 0,
            maximo: 10,
            percentual: 0,
            observacao: 'Indicador complementar.',
          })),
        ];

  // Cartão container do gráfico radar
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2.2, 2.2, 'FD');

  // Título interno do radar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text('GRÁFICO RADAR DE PILARES', boxX + boxW / 2, boxY + 5.2, { align: 'center' });

  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2 + 1.2;
  const maxR = Math.min(boxW * 0.275, (boxH - 22) * 0.44);
  const count = dims.length;

  const getPt = (index: number, pct: number, radiusOverride?: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = radiusOverride !== undefined ? radiusOverride : (Math.max(8, Math.min(100, pct)) / 100) * maxR;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      angle,
    };
  };

  // Anéis concêntricos (100%, 75%, 50%, 25%) desenhados de fora para dentro
  [100, 75, 50, 25].forEach((ring) => {
    const ringPts = dims.map((_, i) => getPt(i, ring));
    doc.setDrawColor(ring === 100 ? 208 : 228, ring === 100 ? 200 : 222, ring === 100 ? 184 : 208);
    doc.setLineWidth(ring === 100 ? 0.35 : 0.2);
    if (ring === 100) {
      doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
      drawPolygonPath(doc, ringPts, 'FD');
    } else {
      drawPolygonPath(doc, ringPts, 'S');
    }
  });

  // Eixos radiais do centro até cada vértice externo
  doc.setDrawColor(222, 215, 200);
  doc.setLineWidth(0.2);
  dims.forEach((_, i) => {
    const end = getPt(i, 100);
    doc.line(cx, cy, end.x, end.y);
  });

  // Marcações sutis de escala (50% e 100%)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.4);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('50%', cx + 1.2, cy - maxR * 0.5 + 1);
  doc.text('100%', cx + 1.2, cy - maxR + 1.2);

  // Polígono do Cenário Simulado ("E se...") quando fornecido
  const hasSim = Boolean(simulatedDimensions && simulatedDimensions.length > 0);
  if (hasSim && simulatedDimensions) {
    const simPts = dims.map((dim, i) => {
      const match = simulatedDimensions.find((s) => s.nome === dim.nome) || simulatedDimensions[i];
      const pct = match ? Math.round(match.percentual) : Math.round(dim.percentual);
      return getPt(i, pct);
    });
    doc.setFillColor(EMERALD_TINT[0], EMERALD_TINT[1], EMERALD_TINT[2]);
    doc.setDrawColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.setLineWidth(0.45);
    drawPolygonPath(doc, simPts, 'FD');
  }

  // Polígono Principal (Perfil Atual do Solicitante)
  const dataPts = dims.map((dim, i) => getPt(i, Math.round(dim.percentual)));
  doc.setFillColor(NAVY_TINT[0], NAVY_TINT[1], NAVY_TINT[2]);
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.65);
  drawPolygonPath(doc, dataPts, 'FD');

  // Re-desenha contorno fino do cenário simulado por cima para visibilidade
  if (hasSim && simulatedDimensions) {
    const simPts = dims.map((dim, i) => {
      const match = simulatedDimensions.find((s) => s.nome === dim.nome) || simulatedDimensions[i];
      const pct = match ? Math.round(match.percentual) : Math.round(dim.percentual);
      return getPt(i, pct);
    });
    doc.setDrawColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.setLineWidth(0.5);
    drawPolygonPath(doc, simPts, 'S');
    simPts.forEach((pt) => {
      doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
      doc.circle(pt.x, pt.y, 0.9, 'F');
    });
  }

  // Vértices dourados/marinho do perfil atual
  dataPts.forEach((pt, idx) => {
    const pct = Math.round(dims[idx].percentual);
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.circle(pt.x, pt.y, 1.5, 'F');
    if (pct >= 75) {
      doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    } else if (pct >= 50) {
      doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    } else {
      doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    }
    doc.circle(pt.x, pt.y, 1.05, 'F');
  });

  // Rótulos perimetrais e percentuais
  const labelRadius = maxR + 5.8;
  dims.forEach((dim, i) => {
    const pt = getPt(i, 100, labelRadius);
    const cos = Math.cos(pt.angle);
    const sin = Math.sin(pt.angle);
    const align: 'left' | 'center' | 'right' =
      Math.abs(cos) < 0.22 ? 'center' : cos > 0 ? 'left' : 'right';
    const yAdjust = sin < -0.7 ? -1.4 : sin > 0.7 ? 1.8 : 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(abbreviateRadarLabel(dim.nome), pt.x, pt.y + yAdjust, { align });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
    doc.text(`${Math.round(dim.percentual)}%`, pt.x, pt.y + yAdjust + 2.8, { align });
  });

  // Legenda inferior do Radar
  const legendY = boxY + boxH - 3.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  if (hasSim) {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(boxX + 10, legendY - 1.8, 3.2, 1.4, 'F');
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text('Perfil atual', boxX + 14.5, legendY - 0.5);

    doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.rect(boxX + boxW / 2 + 1, legendY - 1.8, 3.2, 1.4, 'F');
    doc.setTextColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.text('Simulação ("E se...")', boxX + boxW / 2 + 5.5, legendY - 0.5);
  } else {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(boxX + boxW / 2 - 22, legendY - 1.8, 3.5, 1.4, 'F');
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('Aderência por pilar (0% a 100%)', boxX + boxW / 2 - 17, legendY - 0.5);
  }
}

/**
 * Constrói o Dossiê Executivo de 2 Páginas do Cliente em vetor nativo (jsPDF),
 * capturando os dados completos do usuário e renderizando:
 * - Página 1: Cabeçalho executivo com logo, ficha do solicitante, rota recomendada,
 *   índice de viabilidade, 4 parâmetros SERMIG, Gráfico Radar Vetorial + Scorecard de Pilares.
 * - Página 2: Forças & Pontos de Verificação, Roteiro Macro em 4 Fases, Radar de
 *   Validades Críticas SERMIG, Rotas Secundárias e Modalidades de Assessoria.
 */
export function buildClientDiagnosticDossierDoc(input: ClientDiagnosticPdfInput): {
  doc: jsPDF;
  filename: string;
} {
  const { empresa, result, answers, logoDataUrl, simulatedDimensions } = input;
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
  const titularContato = [answers?.whatsapp, answers?.email]
    .map((v) => (v || '').trim())
    .filter(Boolean)
    .join(' · ');
  const titularOrigemLoc = [
    answers?.cidadeUf?.trim(),
    summary.perfilResumo?.localizacao || answers?.localizacao,
  ]
    .filter(Boolean)
    .join(' · ');
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
  // PÁGINA 1: SUMÁRIO EXECUTIVO, PERFIL DO USUÁRIO & GRÁFICO RADAR VETORIAL
  // =========================================================================
  drawTricolorRibbon(doc, 0, 2.4);

  // Cabeçalho Executivo em Azul Marinho
  const headerTop = 2.4;
  const headerH = 31.5;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, headerTop, pageW, headerH, 'F');

  // Linha fina dourada sob o cabeçalho
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, headerTop + headerH, pageW, 0.8, 'F');

  // Logo oficial à esquerda
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin, headerTop + 6, 56, 18.5, undefined, 'FAST');
    } catch {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14.5);
      doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
      doc.text(safeText(empresa.nome_empresa, 'D&M Integra Chile'), margin, headerTop + 16);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
      doc.text('RELOCATION & ASSESSORIA MIGRATÓRIA', margin, headerTop + 21.5);
    }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text(safeText(empresa.nome_empresa, 'D&M Integra Chile'), margin, headerTop + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text('RELOCATION & ASSESSORIA MIGRATÓRIA', margin, headerTop + 21.5);
  }

  // Metadados do documento à direita
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text('DOSSIÊ EXECUTIVO DE ELEGIBILIDADE MIGRATÓRIA', pageW - margin, headerTop + 10.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(`Protocolo #${protocoloRef}`, pageW - margin, headerTop + 16.8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emitido em ${emissaoBR} · Ley Nº 21.325 & Acordo Mercosul`, pageW - margin, headerTop + 22.8, {
    align: 'right',
  });

  // Faixa Completa de Dados do Usuário (Ivory card)
  let y = headerTop + headerH + 5;
  const profileH = titularContato ? 21 : 15;
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, profileH, 2, 2, 'FD');

  const profileCols = [
    { label: 'TITULAR', value: titularNome },
    { label: 'LOCALIZAÇÃO & ORIGEM', value: safeText(titularOrigemLoc, 'Não informado') },
    { label: 'COMPOSIÇÃO FAMILIAR', value: safeText(summary.familiaResumo || summary.perfilResumo?.familia) },
    { label: 'HORIZONTE DE PROTOCOLO', value: safeText(summary.perfilResumo?.prazo || answers?.prazoPretendido) },
  ];
  const pColW = contentW / profileCols.length;
  profileCols.forEach((col, i) => {
    const cx = margin + i * pColW + 3.2;
    if (i > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin + i * pColW, y + 2.2, margin + i * pColW, y + 13.5);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.1);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(col.label, cx, y + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.9);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const truncated = doc.splitTextToSize(col.value, pColW - 5.5)[0] || col.value;
    doc.text(truncated, cx, y + 10.6);
  });

  if (titularContato) {
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.line(margin + 3, y + 14.5, margin + contentW - 3, y + 14.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
    doc.text('CONTATO DO TITULAR:', margin + 3.2, y + 18.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const contactTrunc = doc.splitTextToSize(safeText(titularContato), contentW - 36)[0] || safeText(titularContato);
    doc.text(contactTrunc, margin + 33, y + 18.8);
  }

  // Bloco Principal: Rota Recomendada (Esquerda) + Placar de Viabilidade (Direita)
  y += profileH + 4.5;
  const heroBoxH = 42;
  const scoreBoxW = 54;
  const routeBoxW = contentW - scoreBoxW - 4;

  // Cartão da Rota Principal
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y, routeBoxW, heroBoxH, 2.2, 2.2, 'FD');

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(margin, y, routeBoxW, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(`ROTA PRINCIPAL INDICADA · CÓD. ${safeText(summary.subcategoriaCodigo)}`, margin + 4.2, y + 6.4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  const titleLines = doc.splitTextToSize(safeText(summary.subcategoriaNome), routeBoxW - 8.5).slice(0, 2);
  doc.text(titleLines, margin + 4.2, y + 12.2);

  let routeTextY = y + 12.2 + titleLines.length * 4.9;
  if (summary.subcategoriaEspanhol) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.4);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const esLine = doc.splitTextToSize(`SERMIG: ${safeText(summary.subcategoriaEspanhol)}`, routeBoxW - 8.5)[0];
    doc.text(esLine, margin + 4.2, routeTextY);
    routeTextY += 4.2;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.7);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const summaryLines = doc.splitTextToSize(safeText(summary.resumoBasico), routeBoxW - 8.5).slice(0, 4);
  doc.text(summaryLines, margin + 4.2, routeTextY + 0.4);

  // Cartão do Índice de Viabilidade (Azul Marinho)
  const scoreX = margin + routeBoxW + 4;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(scoreX, y, scoreBoxW, heroBoxH, 2.2, 2.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text('ÍNDICE DE VIABILIDADE', scoreX + 4.5, y + 6.6);

  const scoreVal = Math.max(0, Math.min(100, Math.round(summary.notaViabilidade || 0)));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(String(scoreVal), scoreX + 4.5, y + 19.2);

  const numWidth = doc.getTextWidth(String(scoreVal));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text('/100', scoreX + 5.5 + numWidth, y + 19.2);

  const barX = scoreX + 4.5;
  const barW = scoreBoxW - 9;
  const barY = y + 22.5;
  doc.setFillColor(NAVY_SOFT[0], NAVY_SOFT[1], NAVY_SOFT[2]);
  doc.roundedRect(barX, barY, barW, 2.4, 1.2, 1.2, 'F');
  const scoreFill = scoreVal >= 75 ? [34, 197, 94] : scoreVal >= 50 ? GOLD : [245, 158, 11];
  doc.setFillColor(scoreFill[0], scoreFill[1], scoreFill[2]);
  doc.roundedRect(barX, barY, Math.max(3, (barW * scoreVal) / 100), 2.4, 1.2, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  const verdictLines = doc.splitTextToSize(safeText(summary.veredito), barW).slice(0, 2);
  doc.text(verdictLines, barX, y + 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Confiança: ${safeText(summary.confianca)}`, barX, y + 38.8);

  // Grade dos 4 Parâmetros Estratégicos
  y += heroBoxH + 4.2;
  const paramsH = 16.5;
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
    const px = margin + idx * paramColW + 3.2;
    if (idx > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin + idx * paramColW, y + 2.2, margin + idx * paramColW, y + paramsH - 2.2);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(p.label, px, y + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const pLines = doc.splitTextToSize(p.value, paramColW - 5.5).slice(0, 2);
    doc.text(pLines, px, y + 9.6);
  });

  // Seção Dual-Panel: Gráfico Radar Vetorial (Esquerda) + Decomposição dos Pilares (Direita)
  y += paramsH + 7.5;
  y = drawSectionEyebrow(
    doc,
    margin,
    y,
    'Raio-X de Viabilidade · Análise Multidimensional',
    'Gráfico Radar & Decomposição Técnica dos Pilares',
  );

  const dims: BasicDiagnosticDimension[] =
    summary.dimensoes && summary.dimensoes.length > 0
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

  const dualTop = y + 1;
  const dualH = summary.temAlertaCritico && summary.alertaGeral ? 98 : 108;
  const radarW = 84;
  const pillarsX = margin + radarW + 4;
  const pillarsW = contentW - radarW - 4;

  // Painel Esquerdo: Gráfico Radar Vetorial nativo
  drawVectorRadarChart(doc, margin, dualTop, radarW, dualH, dims, simulatedDimensions);

  // Painel Direito: Scorecard Executivo dos Pilares
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(pillarsX, dualTop, pillarsW, dualH, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text('DETALHAMENTO POR PILAR', pillarsX + 4, dualTop + 5.2);

  const visibleDims = dims.slice(0, 7);
  const availH = dualH - 11;
  const rowPitch = availH / Math.max(visibleDims.length, 1);

  visibleDims.forEach((dim, idx) => {
    const ry = dualTop + 10.5 + idx * rowPitch;
    const pct = Math.max(0, Math.min(100, Math.round(dim.percentual)));
    const fillCol = getBarColor(pct);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const dimTitle = doc.splitTextToSize(safeText(dim.nome), pillarsW - 30)[0];
    doc.text(dimTitle, pillarsX + 4, ry);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(`${dim.pontos}/${dim.maximo} (${pct}%)`, pillarsX + pillarsW - 4, ry, { align: 'right' });

    // Mini barra proporcional
    const miniBarW = pillarsW - 8;
    doc.setFillColor(238, 235, 228);
    doc.roundedRect(pillarsX + 4, ry + 1.4, miniBarW, 2.2, 1.1, 1.1, 'F');
    doc.setFillColor(fillCol[0], fillCol[1], fillCol[2]);
    doc.roundedRect(pillarsX + 4, ry + 1.4, Math.max(2, (miniBarW * pct) / 100), 2.2, 1.1, 1.1, 'F');

    // Observação técnica curta
    if (rowPitch >= 12.2) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.3);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const obsLine = doc.splitTextToSize(safeText(dim.observacao, ''), miniBarW)[0] || '';
      if (obsLine) {
        doc.text(obsLine, pillarsX + 4, ry + 6.4);
      }
    }
  });

  // Alerta prioritário na base da Página 1 (quando aplicável)
  const afterDualY = dualTop + dualH + 4.5;
  if (summary.temAlertaCritico && summary.alertaGeral && afterDualY < 262) {
    doc.setFillColor(255, 250, 235);
    doc.setDrawColor(232, 195, 108);
    doc.roundedRect(margin, afterDualY, contentW, 17, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(146, 64, 14);
    doc.text('PONTO DE ATENÇÃO PRIORITÁRIO NO PERFIL', margin + 4, afterDualY + 5.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 53, 15);
    const alertLines = doc.splitTextToSize(safeText(summary.alertaGeral), contentW - 8).slice(0, 2);
    doc.text(alertLines, margin + 4, afterDualY + 10);
  }

  drawFooter(doc, empresa, 1, 2);

  // =========================================================================
  // PÁGINA 2: ESTRATÉGIA, ROTEIRO EM 4 FASES, RADAR SERMIG & MODALIDADES
  // =========================================================================
  doc.addPage('a4', 'portrait');
  drawTricolorRibbon(doc, 0, 2.2);

  // Cabeçalho compacto da página 2
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 2.2, pageW, 15.5, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 17.7, pageW, 0.6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(`${safeText(empresa.nome_empresa, 'D&M Integra Chile')}  ·  Dossiê Estratégico (4 Fases)`, margin, 11.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(`Protocolo #${protocoloRef}  ·  ${titularNome}`, pageW - margin, 11.2, { align: 'right' });

  let y2 = 24.5;

  // Bloco Comparativo: Pontos Fortes x Pontos de Verificação
  y2 = drawSectionEyebrow(
    doc,
    margin,
    y2,
    'Análise Qualitativa do Perfil',
    'Forças da Rota Recomendada & Pontos de Verificação',
  );

  const halfW = (contentW - 5) / 2;
  const qualBoxH = 48;

  // Esquerda: Pontos Fortes
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y2 + 1, halfW, qualBoxH, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(EMERALD[0], EMERALD[1], EMERALD[2]);
  doc.text('POR QUE ESTA ROTA SE DESTACA', margin + 4, y2 + 6.5);

  const fortes =
    summary.pontosFortes && summary.pontosFortes.length > 0
      ? summary.pontosFortes
      : ['Enquadramento preliminar compatível com as normas vigentes do SERMIG.'];

  let fy = y2 + 11.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  fortes.slice(0, 4).forEach((item) => {
    if (fy > y2 + qualBoxH - 4) return;
    doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.circle(margin + 5, fy - 1, 0.85, 'F');
    const lines = doc.splitTextToSize(safeText(item), halfW - 10.5).slice(0, 2);
    doc.text(lines, margin + 7.8, fy);
    fy += lines.length * 3.7 + 2.1;
  });

  // Direita: Pontos de Atenção
  const rightX = margin + halfW + 5;
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(rightX, y2 + 1, halfW, qualBoxH, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text('PONTOS DE VERIFICAÇÃO PRIORITÁRIOS', rightX + 4, y2 + 6.5);

  const atencoes =
    summary.pontosAtencao && summary.pontosAtencao.length > 0
      ? summary.pontosAtencao
      : [
          'Validar prazos curtos de emissão (antecedentes criminais de 60 dias) antes de iniciar apostilamentos.',
          'Confirmar traduções juramentadas e sequência cronológica de protocolo no portal SERMIG.',
        ];

  let ay = y2 + 11.8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  atencoes.slice(0, 4).forEach((item) => {
    if (ay > y2 + qualBoxH - 4) return;
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.circle(rightX + 5, ay - 1, 0.85, 'F');
    const lines = doc.splitTextToSize(safeText(item), halfW - 10.5).slice(0, 2);
    doc.text(lines, rightX + 7.8, ay);
    ay += lines.length * 3.7 + 2.1;
  });

  // Roteiro Macro em 4 Fases
  y2 += qualBoxH + 8;
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
  const phaseH = 50;
  const phaseTop = y2 + 1.5;

  // Linha conectora dourada entre as 4 fases
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(0.7);
  doc.line(margin + phaseW * 0.5, phaseTop + 7, margin + contentW - phaseW * 0.5, phaseTop + 7);

  fases.forEach((f, idx) => {
    const fx = margin + idx * (phaseW + phaseGap);
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(fx, phaseTop, phaseW, phaseH, 2.2, 2.2, 'FD');

    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.roundedRect(fx + 3.2, phaseTop + 3.2, 16, 6, 1.2, 1.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text(`FASE 0${f.fase}`, fx + 11.2, phaseTop + 7.2, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const focoLine = doc.splitTextToSize(safeText(f.foco), phaseW - 6.5)[0];
    doc.text(focoLine, fx + 3.2, phaseTop + 13.6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const fTitleLines = doc.splitTextToSize(safeText(f.titulo), phaseW - 6.5).slice(0, 2);
    doc.text(fTitleLines, fx + 3.2, phaseTop + 18.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const fDescLines = doc.splitTextToSize(safeText(f.resumo), phaseW - 6.5).slice(0, 6);
    doc.text(fDescLines, fx + 3.2, phaseTop + 18.2 + fTitleLines.length * 3.8 + 1.4);
  });

  // Faixa Especialista: Radar de Validades & Prazos Críticos SERMIG
  y2 = phaseTop + phaseH + 5;
  const radarSermigH = 19.5;
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y2, contentW, radarSermigH, 2, 2, 'FD');

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(margin, y2, contentW, 5.4, 2, 2, 'F');
  doc.rect(margin, y2 + 3.2, contentW, 2.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text('RADAR DE VALIDADES & PRAZOS CRÍTICOS · SERMIG / LEY Nº 21.325', margin + 3.5, y2 + 3.8);

  const sermigItems: Array<{ kpi: string; title: string; sub: string; color: [number, number, number] }> = [
    { kpi: '60 dias', title: 'Antecedentes PF', sub: 'Emitir por último antes do protocolo', color: CRIMSON },
    { kpi: 'Haia CNJ', title: 'Apostila da Haia', sub: 'Obrigatória em certidões do Brasil', color: GOLD_DARK },
    { kpi: '90 dias', title: 'Pós-Estampado', sub: 'Prazo legal para ingresso no Chile', color: NAVY },
    { kpi: '30 dias', title: 'PDI & Cédula', sub: 'Registro obrigatório após entrada', color: EMERALD },
  ];
  const sColW = contentW / 4;
  sermigItems.forEach((item, idx) => {
    const sx = margin + idx * sColW + 3.2;
    if (idx > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin + idx * sColW, y2 + 6.5, margin + idx * sColW, y2 + radarSermigH - 1.5);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.kpi, sx, y2 + 10.6);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(item.title, sx, y2 + 14.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.1);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const sSub = doc.splitTextToSize(item.sub, sColW - 5.5)[0];
    doc.text(sSub, sx, y2 + 17.5);
  });

  y2 += radarSermigH + 6;

  // Tabela de Rotas Alternativas Avaliadas (se houver)
  if (summary.alternativasMapeadas && summary.alternativasMapeadas.length > 0 && y2 < 194) {
    y2 = drawSectionEyebrow(doc, margin, y2, 'Matriz Comparativa Inicial', 'Rotas Secundárias Avaliadas');

    const tblTop = y2 + 0.8;
    const rowH = 7.4;
    const rows = summary.alternativasMapeadas.slice(0, 2);
    const tblH = 6.5 + rows.length * rowH;

    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.roundedRect(margin, tblTop, contentW, tblH, 2, 2, 'FD');

    doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
    doc.rect(margin + 0.2, tblTop + 0.2, contentW - 0.4, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text('SUBCATEGORIA ALTERNATIVA', margin + 4, tblTop + 4.4);
    doc.text('PEDIDO DENTRO DO CHILE', margin + 108, tblTop + 4.4);
    doc.text('ADERÊNCIA', margin + contentW - 4, tblTop + 4.4, { align: 'right' });

    rows.forEach((alt, idx) => {
      const ry = tblTop + 6.5 + idx * rowH;
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin, ry, margin + contentW, ry);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.6);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(`${safeText(alt.codigo)} · ${safeText(alt.nome)}`, margin + 4, ry + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      doc.text(safeText(alt.permiteDentroChile), margin + 108, ry + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      doc.text(`${Math.round(alt.aderencia)}/100`, margin + contentW - 4, ry + 5, { align: 'right' });
    });

    y2 = tblTop + tblH + 5.5;
  }

  // Bloco Executivo de Próximo Passo: Modalidades de Assessoria
  const ctaTop = Math.min(Math.max(y2, 188), 214);
  const ctaH = 54;
  const planOri = CONSULTANCY_PLANS.orientativa;
  const planComp = CONSULTANCY_PLANS.completa;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text('PRÓXIMO PASSO · ASSESSORIA ESPECIALIZADA', margin, ctaTop);

  // Cartão 1: Consultoria Orientativa (Claro)
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, ctaTop + 2.8, halfW, ctaH - 2.8, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(safeText(planOri.badgeLabel).toUpperCase(), margin + 4, ctaTop + 8.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(planOri.nome, margin + 4, ctaTop + 13.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const oriLines = doc.splitTextToSize(planOri.subtitulo, halfW - 8).slice(0, 2);
  doc.text(oriLines, margin + 4, ctaTop + 18.6);

  let py1 = ctaTop + 27.2;
  planOri.inclui.slice(0, 3).forEach((item) => {
    const l = doc.splitTextToSize(`* ${safeText(item)}`, halfW - 8).slice(0, 2);
    doc.text(l, margin + 4, py1);
    py1 += l.length * 3.5 + 1.4;
  });

  // Cartão 2: Consultoria Completa (Azul Marinho + Ouro)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(rightX, ctaTop + 2.8, halfW, ctaH - 2.8, 2.2, 2.2, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(rightX, ctaTop + 2.8, halfW, 1.3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(`${safeText(planComp.badgeLabel).toUpperCase()} · EXECUÇÃO INTEGRAL`, rightX + 4, ctaTop + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(planComp.nome, rightX + 4, ctaTop + 14.3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(215, 224, 236);
  const compLines = doc.splitTextToSize(planComp.subtitulo, halfW - 8).slice(0, 2);
  doc.text(compLines, rightX + 4, ctaTop + 19.1);

  let py2 = ctaTop + 27.7;
  planComp.inclui.slice(0, 3).forEach((item) => {
    const l = doc.splitTextToSize(`* ${safeText(item)}`, halfW - 8).slice(0, 2);
    doc.text(l, rightX + 4, py2);
    py2 += l.length * 3.5 + 1.4;
  });

  // Nota Legal acima do rodapé
  const legalY = ctaTop + ctaH + 4;
  if (legalY < 278) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
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
