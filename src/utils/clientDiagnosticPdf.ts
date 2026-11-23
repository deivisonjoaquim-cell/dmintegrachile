import { jsPDF } from 'jspdf';
import { BRAND_ASSETS } from '../constants/brandAssets';
import type { DiagnosticAnswers, EmpresaConfig } from '../types/domain';
import type { ActionPlanItem, ChecklistReadinessItem, DiagnosticResult } from './diagnosticEngine';
import { formatCurrency, formatDateBR } from './formatters';
import {
  buildBasicDiagnosticSummary,
  CONSULTANCY_PLANS,
  type BasicDiagnosticDimension,
  type BasicDiagnosticSummary,
} from './portalAccess';

export type DiagnosticPdfLocale = 'pt-BR' | 'es-CL';

export interface ResolvedPdfLogoAsset {
  dataUrl: string;
  width: number;
  height: number;
}

export interface ClientDiagnosticPdfInput {
  empresa: EmpresaConfig;
  summary?: BasicDiagnosticSummary;
  result?: DiagnosticResult;
  answers?: Partial<DiagnosticAnswers>;
  protocolo?: string;
  logoDataUrl?: string;
  logoAsset?: ResolvedPdfLogoAsset;
  simulatedDimensions?: BasicDiagnosticDimension[] | null;
  hideCosts?: boolean;
  locale?: DiagnosticPdfLocale;
  aiDraft?: { resumoExecutivo?: string } | null;
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

/**
 * Normaliza strings para WinAnsi (codificação nativa da fonte Helvetica no jsPDF),
 * preservando acentuação latina PT-BR/ES-CL e convertendo glifos fora de WinAnsi.
 */
function safeText(val: unknown, fallback = '-'): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val)
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2022/g, '*')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    // Remove emojis e símbolos fora do plano básico latino
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
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

function isSafeLogoUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(trimmed)) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Carrega e rasteriza o logotipo da marca em canvas local preservando proporção natural,
 * sem importar @react-pdf/renderer (mantendo o bundle leve e rápido para exportação jsPDF).
 */
async function loadLogoAssetFromUrl(url: string): Promise<ResolvedPdfLogoAsset | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  if (!isSafeLogoUrl(url)) return undefined;

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeoutId = window.setTimeout(() => {
      resolve(undefined);
    }, 4000);

    img.onload = () => {
      window.clearTimeout(timeoutId);
      try {
        const natW = img.naturalWidth || img.width;
        const natH = img.naturalHeight || img.height;
        if (!natW || !natH) {
          resolve(undefined);
          return;
        }
        const maxCanvasW = 640;
        const scale = natW > maxCanvasW ? maxCanvasW / natW : 1;
        const w = Math.max(1, Math.round(natW * scale));
        const h = Math.max(1, Math.round(natH * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(undefined);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl, width: natW, height: natH });
      } catch {
        resolve(undefined);
      }
    };

    img.onerror = () => {
      window.clearTimeout(timeoutId);
      resolve(undefined);
    };

    img.src = url;
  });
}

async function resolveBrandLogoAsset(empresa: EmpresaConfig): Promise<ResolvedPdfLogoAsset | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }
  const candidates = [
    BRAND_ASSETS.logoDarkPng,
    empresa.logoUrl,
    BRAND_ASSETS.logoLightPng,
  ].filter((u): u is string => Boolean(u && u.trim()));

  for (const url of candidates) {
    const resolved = await loadLogoAssetFromUrl(url);
    if (resolved) return resolved;
  }
  return undefined;
}

function getPdfCopy(locale: DiagnosticPdfLocale) {
  if (locale === 'es-CL') {
    return {
      filenamePrefix: 'Dossier-Diagnostico-DM-Integra',
      brandSubtitle: 'RELOCATION Y ASESORÍA MIGRATORIA',
      headerEyebrow: 'DIAGNÓSTICO MIGRATORIO COMPLETO · BRASIL -> CHILE',
      protocolPrefix: 'Protocolo #',
      issuedPrefix: 'Emitido el',
      rulesPrefix: 'Reglas',
      pageOf: (p: number, t: number) => `Página ${p} de ${t}`,
      footerLegal: 'Documento orientativo · Protección LGPD (Ley Nº 13.709/2018)',
      profileTitular: 'TITULAR',
      profileLocation: 'UBICACIÓN Y ORIGEN',
      profileFamily: 'COMPOSICIÓN FAMILIAR',
      profilePassportHorizon: 'PASAPORTE Y HORIZONTE',
      profileContact: 'CONTACTO:',
      profileLegalBase: 'BASE NORMATIVA:',
      routeEyebrow: 'RUTA PRINCIPAL RECOMENDADA · CÓD.',
      viabilityTitle: 'ÍNDICE DE VIABILIDAD',
      confidenceLabel: 'Confianza',
      readinessLabel: 'Alistamiento doc.',
      paramJurisdiction: 'LUGAR DE SOLICITUD',
      paramWork: 'AUTORIZACIÓN LABORAL',
      paramPermanent: 'RESIDENCIA DEFINITIVA',
      paramTimeframe: 'PLAZO REFERENCIAL SERMIG',
      radarEyebrow: 'Radiografía de Viabilidad · Análisis Multidimensional',
      radarSectionTitle: 'Gráfico Radar & Desglose Técnico de Pilares',
      radarCardTitle: 'GRÁFICO RADAR DE PILARES',
      pillarsCardTitle: 'DETALLE POR PILAR',
      radarLegendCurrent: 'Perfil actual',
      radarLegendSim: 'Simulación ("¿Y si...?")',
      radarLegendSingle: 'Adherencia por pilar (0% a 100%)',
      alertTitle: 'PUNTOS DE ATENCIÓN PRIORITARIOS Y RIESGOS',
      familySynthesisTitle: 'ESTRUCTURA FAMILIAR Y RUTA DE APLICACIÓN',
      synthesisTitle: 'SÍNTESIS OPERATIVA DEL ENCUADRAMIENTO',
      page2HeaderSuffix: 'Plan de Acción, Documentos, Costos y Próximos Pasos',
      qualEyebrow: 'Análisis Cualitativo del Perfil',
      qualTitle: 'Fortalezas de la Ruta & Puntos de Verificación',
      strengthsTitle: 'PUNTOS FORTES DEL PERFIL',
      checksTitle: 'VERIFICACIÓN Y RIESGOS DETECTADOS',
      roadmapEyebrow: 'Visión Estructurada de la Jornada',
      roadmapTitle: 'Hoja de Ruta del Proceso Migratorio en 4 Fases',
      phasePrefix: 'FASE 0',
      actionEyebrow: 'Ejecución Técnica & Preparación Documental',
      actionTitle: 'Plan de Acción Prioritario & Checklist de Documentos',
      actionColTitle: 'PLAN DE ACCIÓN PRIORITARIO',
      checklistColTitle: 'CHECKLIST DOCUMENTAL',
      sermigRadarHeader: 'RADAR DE VIGENCIAS CRÍTICAS · SERMIG / LEY Nº 21.325',
      costsHeader: 'ESTIMACIÓN DE COSTOS Y PLAZOS',
      scheduleHeader: 'CRONOGRAMA REFERENCIAL SERMIG',
      altRoutesHeader: 'RUTAS ALTERNATIVAS EVALUADAS',
      legalSourcesHeader: 'BASE LEGAL & FUENTES CITADAS',
      nextStepsEyebrow: 'PRÓXIMO PASO · ASESORÍA ESPECIALIZADA D&M INTEGRA',
      orientativaBadge: 'MODALIDAD ORIENTATIVA',
      completaBadge: 'ASESORÍA COMPLETA · EJECUCIÓN INTEGRAL',
      jurisdictionSim: 'Permitido dentro de Chile',
      jurisdictionNao: 'Solicitud desde el exterior (fuera de Chile)',
      jurisdictionCond: 'Condicional (depende del perfil)',
      jurisdictionDefault: 'Sujeto a validación técnica',
      workYes: 'Actividad remunerada habilitada',
      workNo: 'Restringida en esta categoría',
      workDefault: 'Según subcategoría',
      permYes: 'Elegible cumpliendo plazo legal',
      permNo: 'Requiere cambio de subcategoría',
      permDefault: 'Sujeto a validación técnica',
      passportValid: 'Vigente',
      passportRenew: 'Por renovar',
      passportNone: 'Sin pasaporte',
      feesOfficial: 'Tasas oficiales:',
      feesHonorarium: 'Honorarios D&M:',
      feesTotal: 'Total estimado:',
      feesPrep: 'Preparación doc.:',
      feesConsult: 'Bajo cotización personalizada',
    };
  }

  return {
    filenamePrefix: 'Dossie-Diagnostico-DM-Integra',
    brandSubtitle: 'RELOCATION & ASSESSORIA MIGRATÓRIA',
    headerEyebrow: 'DIAGNÓSTICO MIGRATÓRIO COMPLETO · BRASIL -> CHILE',
    protocolPrefix: 'Protocolo #',
    issuedPrefix: 'Emitido em',
    rulesPrefix: 'Regras',
    pageOf: (p: number, t: number) => `Página ${p} de ${t}`,
    footerLegal: 'Documento orientativo · Proteção LGPD (Lei nº 13.709/2018)',
    profileTitular: 'TITULAR',
    profileLocation: 'LOCALIZAÇÃO & ORIGEM',
    profileFamily: 'COMPOSIÇÃO FAMILIAR',
    profilePassportHorizon: 'PASSAPORTE & HORIZONTE',
    profileContact: 'CONTATO:',
    profileLegalBase: 'BASE NORMATIVA:',
    routeEyebrow: 'ROTA PRINCIPAL RECOMENDADA · CÓD.',
    viabilityTitle: 'ÍNDICE DE VIABILIDADE',
    confidenceLabel: 'Confiança',
    readinessLabel: 'Prontidão doc.',
    paramJurisdiction: 'LOCAL DE PROTOCOLO',
    paramWork: 'AUTORIZAÇÃO DE TRABALHO',
    paramPermanent: 'RESIDÊNCIA DEFINITIVA',
    paramTimeframe: 'PRAZO ESTIMADO SERMIG',
    radarEyebrow: 'Raio-X de Viabilidade · Análise Multidimensional',
    radarSectionTitle: 'Gráfico Radar & Decomposição Técnica dos Pilares',
    radarCardTitle: 'GRÁFICO RADAR DE PILARES',
    pillarsCardTitle: 'DETALHAMENTO POR PILAR',
    radarLegendCurrent: 'Perfil atual',
    radarLegendSim: 'Simulação ("E se...")',
    radarLegendSingle: 'Aderência por pilar (0% a 100%)',
    alertTitle: 'PONTOS DE ATENÇÃO PRIORITÁRIOS & RISCOS',
    familySynthesisTitle: 'COMPOSIÇÃO FAMILIAR & ESTRATÉGIA DE PROTOCOLO',
    synthesisTitle: 'SÍNTESE OPERACIONAL DO ENQUADRAMENTO',
    page2HeaderSuffix: 'Plano de Ação, Documentos, Custos & Próximos Passos',
    qualEyebrow: 'Análise Qualitativa do Perfil',
    qualTitle: 'Forças da Rota Recomendada & Pontos de Verificação',
    strengthsTitle: 'PONTOS FORTES DO PERFIL',
    checksTitle: 'VERIFICAÇÃO & RISCOS MAPEADOS',
    roadmapEyebrow: 'Visão Estruturada da Jornada',
    roadmapTitle: 'Roteiro Macro do Processo Migratório em 4 Fases',
    phasePrefix: 'FASE 0',
    actionEyebrow: 'Execução Técnica & Preparação Documental',
    actionTitle: 'Plano de Ação Prioritário & Checklist Documental',
    actionColTitle: 'PLANO DE AÇÃO PRIORITÁRIO',
    checklistColTitle: 'CHECKLIST DOCUMENTAL',
    sermigRadarHeader: 'RADAR DE VALIDADES CRÍTICAS · SERMIG / LEY Nº 21.325',
    costsHeader: 'ESTIMATIVA DE CUSTOS & PRAZOS',
    scheduleHeader: 'CRONOGRAMA DE REFERÊNCIA SERMIG',
    altRoutesHeader: 'ROTAS ALTERNATIVAS AVALIADAS',
    legalSourcesHeader: 'BASE LEGAL & FONTES CITADAS',
    nextStepsEyebrow: 'PRÓXIMO PASSO · ASSESSORIA ESPECIALIZADA D&M INTEGRA',
    orientativaBadge: 'CONSULTORIA ORIENTATIVA',
    completaBadge: 'CONSULTORIA COMPLETA · EXECUÇÃO INTEGRAL',
    jurisdictionSim: 'Permitido dentro do Chile',
    jurisdictionNao: 'Protocolo do exterior (fora do Chile)',
    jurisdictionCond: 'Condicional (depende do perfil)',
    jurisdictionDefault: 'Sob validação técnica',
    workYes: 'Atividade remunerada liberada',
    workNo: 'Restrita a esta categoria',
    workDefault: 'Conforme subcategoria',
    permYes: 'Elegível cumprindo prazo legal',
    permNo: 'Exige troca de subcategoria',
    permDefault: 'Sob validação técnica',
    passportValid: 'Válido',
    passportRenew: 'Renovar',
    passportNone: 'Sem passaporte',
    feesOfficial: 'Taxas oficiais:',
    feesHonorarium: 'Honorários D&M:',
    feesTotal: 'Total estimado:',
    feesPrep: 'Preparação doc.:',
    feesConsult: 'Sob consulta personalizada',
  };
}

function getProtocolJurisdictionLabel(
  permite: 'Sim' | 'Não' | 'Condicional' | undefined,
  copy: ReturnType<typeof getPdfCopy>,
): string {
  if (permite === 'Sim') return copy.jurisdictionSim;
  if (permite === 'Não') return copy.jurisdictionNao;
  if (permite === 'Condicional') return copy.jurisdictionCond;
  return copy.jurisdictionDefault;
}

function formatPassportHorizon(
  answers: Partial<DiagnosticAnswers> | undefined,
  summary: BasicDiagnosticSummary,
  copy: ReturnType<typeof getPdfCopy>,
): string {
  const parts: string[] = [];
  if (answers?.passaporteStatus) {
    if (answers.passaporteStatus === 'valido') {
      const m = answers.passaporteValidadeMeses;
      parts.push(m ? `${copy.passportValid} (${m}m)` : copy.passportValid);
    } else if (answers.passaporteStatus === 'vencido') {
      parts.push(copy.passportRenew);
    } else {
      parts.push(copy.passportNone);
    }
  }
  const horizon = summary.perfilResumo?.prazo || answers?.prazoPretendido;
  if (horizon) parts.push(horizon);
  return safeText(parts.join(' · '), '-');
}

function abbreviateRadarLabel(name: string): string {
  const trimmed = safeText(name, 'Pilar');
  const map: Record<string, string> = {
    'Compatibilidade de Perfil': 'Perfil & Obj.',
    'Conformidade de Localização': 'Jurisdição',
    'Elegibilidade Legal': 'Elegibilidade',
    'Prontidão Documental': 'Documentos',
    'Capacidade Financeira': 'Financeiro',
    'Histórico e Riscos': 'Histórico',
    'Histórico & Riscos': 'Histórico',
    'Elegibilidade Normativa': 'Elegibilidade',
    'Regularidade Migratória': 'Histórico',
    'Vínculo / Comprovação': 'Vínculo/Renda',
    'Consistência das Respostas': 'Consistência',
    'Prazo e Planejamento': 'Prazo',
    'Estabilidade p/ Definitiva': 'Definitiva',
    'Viabilidade Familiar': 'Família',
  };
  if (map[trimmed]) return map[trimmed];
  return trimmed.length <= 13 ? trimmed : `${trimmed.slice(0, 11).trim()}.`;
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

function drawFooter(
  doc: jsPDF,
  empresa: EmpresaConfig,
  pageNum: number,
  totalPages: number,
  copy: ReturnType<typeof getPdfCopy>,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 13;
  const footerY = pageH - 12;

  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY - 3, pageW - margin, footerY - 3);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(safeText(empresa.nome_empresa, 'D&M Integra Chile'), margin, footerY + 0.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const contactLine = [empresa.whatsapp, empresa.email].filter(Boolean).join('  |  ');
  if (contactLine) {
    doc.text(safeText(contactLine), margin, footerY + 4.5);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(copy.pageOf(pageNum, totalPages), pageW - margin, footerY + 0.8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.4);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(copy.footerLegal, pageW - margin, footerY + 4.5, { align: 'right' });
}

function drawSectionEyebrow(doc: jsPDF, x: number, y: number, eyebrow: string, title: string): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(safeText(eyebrow).toUpperCase(), x, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(safeText(title), x, y + 4.2);

  return y + 5.8;
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
  doc.lines(
    relativeSegments,
    Number(points[0].x.toFixed(2)),
    Number(points[0].y.toFixed(2)),
    [1, 1],
    style,
    true,
  );
}

/**
 * Desenha o Gráfico Radar Vetorial de Pilares de Viabilidade diretamente em jsPDF,
 * com anéis concêntricos (25/50/75/100%), eixos radiais, polígono preenchido do perfil
 * atual, nós coloridos nos vértices e sobreposição opcional do cenário simulado ("E se...").
 */
function drawVectorRadarChart(
  doc: jsPDF,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
  rawDims: BasicDiagnosticDimension[],
  copy: ReturnType<typeof getPdfCopy>,
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

  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, boxH, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(copy.radarCardTitle, boxX + boxW / 2, boxY + 5, { align: 'center' });

  const cx = boxX + boxW / 2;
  const cy = boxY + boxH / 2 + 1;
  const maxR = Math.min(boxW * 0.27, (boxH - 22) * 0.43);
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

  doc.setDrawColor(222, 215, 200);
  doc.setLineWidth(0.2);
  dims.forEach((_, i) => {
    const end = getPt(i, 100);
    doc.line(cx, cy, end.x, end.y);
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.3);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('50%', cx + 1.2, cy - maxR * 0.5 + 1);
  doc.text('100%', cx + 1.2, cy - maxR + 1.2);

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

  const dataPts = dims.map((dim, i) => getPt(i, Math.round(dim.percentual)));
  doc.setFillColor(NAVY_TINT[0], NAVY_TINT[1], NAVY_TINT[2]);
  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.65);
  drawPolygonPath(doc, dataPts, 'FD');

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
      doc.circle(pt.x, pt.y, 0.85, 'F');
    });
  }

  dataPts.forEach((pt, idx) => {
    const pct = Math.round(dims[idx].percentual);
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.circle(pt.x, pt.y, 1.45, 'F');
    if (pct >= 75) {
      doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    } else if (pct >= 50) {
      doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    } else {
      doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    }
    doc.circle(pt.x, pt.y, 1.0, 'F');
  });

  const labelRadius = maxR + 5.6;
  dims.forEach((dim, i) => {
    const pt = getPt(i, 100, labelRadius);
    const cos = Math.cos(pt.angle);
    const sin = Math.sin(pt.angle);
    const align: 'left' | 'center' | 'right' =
      Math.abs(cos) < 0.22 ? 'center' : cos > 0 ? 'left' : 'right';
    const yAdjust = sin < -0.7 ? -1.4 : sin > 0.7 ? 1.8 : 0;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(abbreviateRadarLabel(dim.nome), pt.x, pt.y + yAdjust, { align });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
    doc.text(`${Math.round(dim.percentual)}%`, pt.x, pt.y + yAdjust + 2.7, { align });
  });

  const legendY = boxY + boxH - 3.0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.9);
  if (hasSim) {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(boxX + 9, legendY - 1.7, 3.0, 1.3, 'F');
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(copy.radarLegendCurrent, boxX + 13.2, legendY - 0.5);

    doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.rect(boxX + boxW / 2 + 1, legendY - 1.7, 3.0, 1.3, 'F');
    doc.setTextColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.text(copy.radarLegendSim, boxX + boxW / 2 + 5.2, legendY - 0.5);
  } else {
    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.rect(boxX + boxW / 2 - 22, legendY - 1.7, 3.2, 1.3, 'F');
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(copy.radarLegendSingle, boxX + boxW / 2 - 17.5, legendY - 0.5);
  }
}

function collectTopActionItems(result?: DiagnosticResult): Array<{ tag: string; color: [number, number, number]; item: ActionPlanItem }> {
  if (!result) return [];
  const merged: Array<{ tag: string; color: [number, number, number]; item: ActionPlanItem }> = [
    ...result.planoAcao.facaAgora.map((item) => ({ tag: 'AGORA', color: CRIMSON, item })),
    ...result.planoAcao.em30Dias.map((item) => ({ tag: '30 DIAS', color: GOLD_DARK, item })),
    ...result.planoAcao.antesProtocolo.map((item) => ({ tag: 'PROTOCOLO', color: NAVY, item })),
  ];
  return merged.slice(0, 4);
}

function collectTopChecklistItems(result?: DiagnosticResult): ChecklistReadinessItem[] {
  if (!result?.checklistProntidao?.itens?.length) return [];
  const sorted = [...result.checklistProntidao.itens].sort((a, b) => {
    const score = (s: ChecklistReadinessItem['statusInicial']) =>
      s === 'Crítico / Validade curta' ? 0 : s === 'Pendente' ? 1 : 2;
    return score(a.statusInicial) - score(b.statusInicial) || a.ordemPrioridadeEmissao - b.ordemPrioridadeEmissao;
  });
  return sorted.slice(0, 5);
}

/**
 * Constrói o Diagnóstico Migratório Completo em 2 Páginas A4 vetoriais (jsPDF)
 * com a identidade visual oficial da D&M Integra Chile:
 * - Página 1: Cabeçalho executivo (fita tricolor BR-CL + logo proporcional + protocolo + versão das regras),
 *   ficha completa do solicitante, rota principal + placar de viabilidade, 4 parâmetros SERMIG,
 *   Gráfico Radar Vetorial + Scorecard de Pilares e alerta/síntese prioritária.
 * - Página 2: Forças & Riscos/Verificações, Roteiro Macro em 4 Fases, Plano de Ação Prioritário +
 *   Checklist Documental, Radar de Validades SERMIG + Estimativa de Custos/Prazos, Rotas Secundárias +
 *   Base Legal citada, Modalidades de Assessoria e rodapé institucional.
 */
export function buildClientDiagnosticDossierDoc(input: ClientDiagnosticPdfInput): {
  doc: jsPDF;
  filename: string;
} {
  const {
    empresa,
    result,
    answers,
    logoDataUrl,
    logoAsset,
    simulatedDimensions,
    hideCosts = false,
    locale = 'pt-BR',
    aiDraft,
  } = input;

  const copy = getPdfCopy(locale);

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
  const ruleVersionLabel = result?.versaoRegras?.versao
    ? `${copy.rulesPrefix} ${safeText(result.versaoRegras.versao)}`
    : 'Ley Nº 21.325 & Acordo Mercosul';
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
  const filename = `${copy.filenamePrefix}-${slugifyToken(titularNome)}-${slugifyToken(protocoloRef)}.pdf`;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 13;
  const contentW = pageW - margin * 2; // 184mm

  // =========================================================================
  // PÁGINA 1: SUMÁRIO EXECUTIVO, FICHA COMPLETA & GRÁFICO RADAR VETORIAL
  // =========================================================================
  drawTricolorRibbon(doc, 0, 2.4);

  const headerTop = 2.4;
  const headerH = 28.6;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, headerTop, pageW, headerH, 'F');

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, headerTop + headerH, pageW, 0.9, 'F');

  // Logotipo oficial D&M Integra preservando proporção natural
  const effectiveLogoData = logoAsset?.dataUrl || logoDataUrl;
  let renderedLogo = false;
  if (effectiveLogoData) {
    try {
      const maxW = 54;
      const maxH = 17.5;
      let drawW = 50;
      let drawH = 16;
      if (logoAsset && logoAsset.width > 0 && logoAsset.height > 0) {
        const ratio = logoAsset.width / logoAsset.height;
        drawW = maxW;
        drawH = drawW / ratio;
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH * ratio;
        }
      }
      const logoY = headerTop + (headerH - drawH) / 2;
      doc.addImage(effectiveLogoData, 'PNG', margin, logoY, drawW, drawH, undefined, 'FAST');
      renderedLogo = true;
    } catch {
      renderedLogo = false;
    }
  }
  if (!renderedLogo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14.5);
    doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.text(safeText(empresa.nome_empresa, 'D&M Integra Chile'), margin, headerTop + 14.2);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text(copy.brandSubtitle, margin, headerTop + 19.6);
  }

  // Metadados à direita do cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.9);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(copy.headerEyebrow, pageW - margin, headerTop + 9.4, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(`${copy.protocolPrefix}${protocoloRef}`, pageW - margin, headerTop + 15.8, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(203, 213, 225);
  doc.text(`${copy.issuedPrefix} ${emissaoBR} · ${ruleVersionLabel}`, pageW - margin, headerTop + 21.6, {
    align: 'right',
  });

  // Ficha Completa do Titular (Ivory Card)
  let y = headerTop + headerH + 4.4;
  const profileH = 22.5;
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentW, profileH, 2, 2, 'FD');

  const profileCols = [
    { label: copy.profileTitular, value: titularNome },
    { label: copy.profileLocation, value: safeText(titularOrigemLoc, 'Não informado') },
    { label: copy.profileFamily, value: safeText(summary.familiaResumo || summary.perfilResumo?.familia) },
    { label: copy.profilePassportHorizon, value: formatPassportHorizon(answers, summary, copy) },
  ];
  const pColW = contentW / profileCols.length;
  profileCols.forEach((col, i) => {
    const cx = margin + i * pColW + 3.2;
    if (i > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin + i * pColW, y + 2.2, margin + i * pColW, y + 13.8);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(col.label, cx, y + 5.2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.7);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const truncated = doc.splitTextToSize(col.value, pColW - 5.2)[0] || col.value;
    doc.text(truncated, cx, y + 10.6);
  });

  // Segunda linha da ficha (Contato + Base Normativa)
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.line(margin + 3, y + 14.8, margin + contentW - 3, y + 14.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(copy.profileContact, margin + 3.2, y + 19.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const contactText = safeText(titularContato, 'Registrado via plataforma D&M Integra');
  const contactTrunc = doc.splitTextToSize(contactText, 92)[0] || contactText;
  doc.text(contactTrunc, margin + 19.5, y + 19.6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(copy.profileLegalBase, margin + 114, y + 19.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.9);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Ley Nº 21.325 · D.S. 177 · Mercosul', pageW - margin - 3.2, y + 19.6, { align: 'right' });

  // Bloco Principal: Rota Recomendada (Esquerda) + Índice de Viabilidade (Direita)
  y += profileH + 4;
  const heroBoxH = 40.5;
  const scoreBoxW = 54;
  const routeBoxW = contentW - scoreBoxW - 4;

  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y, routeBoxW, heroBoxH, 2.2, 2.2, 'FD');

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(margin, y, routeBoxW, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(`${copy.routeEyebrow} ${safeText(summary.subcategoriaCodigo)}`, margin + 4.2, y + 6.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.2);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  const titleLines = doc.splitTextToSize(safeText(summary.subcategoriaNome), routeBoxW - 8.5).slice(0, 2);
  doc.text(titleLines, margin + 4.2, y + 11.8);

  let routeTextY = y + 11.8 + titleLines.length * 4.7;
  if (summary.subcategoriaEspanhol) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.2);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const esLine = doc.splitTextToSize(`SERMIG: ${safeText(summary.subcategoriaEspanhol)}`, routeBoxW - 8.5)[0];
    doc.text(esLine, margin + 4.2, routeTextY);
    routeTextY += 4.0;
  }

  const executiveSummaryText =
    (aiDraft?.resumoExecutivo && aiDraft.resumoExecutivo.trim().length > 24
      ? aiDraft.resumoExecutivo
      : summary.resumoBasico) || '';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const maxSummaryLines = titleLines.length > 1 ? 3 : 4;
  const summaryLines = doc.splitTextToSize(safeText(executiveSummaryText), routeBoxW - 8.5).slice(0, maxSummaryLines);
  doc.text(summaryLines, margin + 4.2, routeTextY + 0.3);

  // Cartão do Índice de Viabilidade (Azul Marinho)
  const scoreX = margin + routeBoxW + 4;
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(scoreX, y, scoreBoxW, heroBoxH, 2.2, 2.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(copy.viabilityTitle, scoreX + 4.5, y + 6.4);

  const scoreVal = Math.max(0, Math.min(100, Math.round(summary.notaViabilidade || 0)));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(25);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(String(scoreVal), scoreX + 4.5, y + 18.2);

  const numWidth = doc.getTextWidth(String(scoreVal));
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  doc.setTextColor(148, 163, 184);
  doc.text('/100', scoreX + 5.5 + numWidth, y + 18.2);

  const barX = scoreX + 4.5;
  const barW = scoreBoxW - 9;
  const barY = y + 21.2;
  doc.setFillColor(NAVY_SOFT[0], NAVY_SOFT[1], NAVY_SOFT[2]);
  doc.roundedRect(barX, barY, barW, 2.3, 1.1, 1.1, 'F');
  const scoreFill = scoreVal >= 75 ? [34, 197, 94] : scoreVal >= 50 ? GOLD : [245, 158, 11];
  doc.setFillColor(scoreFill[0], scoreFill[1], scoreFill[2]);
  doc.roundedRect(barX, barY, Math.max(3, (barW * scoreVal) / 100), 2.3, 1.1, 1.1, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  const verdictLines = doc.splitTextToSize(safeText(summary.veredito), barW).slice(0, 2);
  doc.text(verdictLines, barX, y + 28.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  const readinessSuffix =
    result?.checklistProntidao !== undefined
      ? ` · ${copy.readinessLabel} ${Math.round(result.checklistProntidao.percentualInicial)}%`
      : '';
  doc.text(`${copy.confidenceLabel}: ${safeText(summary.confianca)}${readinessSuffix}`, barX, y + 37.4);

  // Grade dos 4 Parâmetros Estratégicos SERMIG
  y += heroBoxH + 3.8;
  const paramsH = 16;
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y, contentW, paramsH, 2, 2, 'FD');

  const paramItems = [
    {
      label: copy.paramJurisdiction,
      value: getProtocolJurisdictionLabel(summary.permiteDentroChile, copy),
    },
    {
      label: copy.paramWork,
      value:
        summary.permiteTrabalhar === undefined
          ? copy.workDefault
          : summary.permiteTrabalhar
            ? copy.workYes
            : copy.workNo,
    },
    {
      label: copy.paramPermanent,
      value:
        summary.levaDefinitiva === undefined
          ? copy.permDefault
          : summary.levaDefinitiva
            ? copy.permYes
            : copy.permNo,
    },
    {
      label: copy.paramTimeframe,
      value: safeText(
        result?.cronogramaFaixas?.respostaSermig || summary.prazoEstimadoResumo,
        'Conforme fila SERMIG',
      ),
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
    doc.setFontSize(5.9);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(p.label, px, y + 5.0);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const pLines = doc.splitTextToSize(p.value, paramColW - 5.2).slice(0, 2);
    doc.text(pLines, px, y + 9.2);
  });

  // Seção Dual-Panel: Gráfico Radar Vetorial + Decomposição dos Pilares
  y += paramsH + 6.5;
  y = drawSectionEyebrow(doc, margin, y, copy.radarEyebrow, copy.radarSectionTitle);

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

  const hasRiskOrAlert = Boolean(
    (summary.temAlertaCritico && summary.alertaGeral) ||
      (result?.flagsRisco && result.flagsRisco.length > 0) ||
      result?.alertaRiscoAlto,
  );
  const dualTop = y + 0.8;
  const dualH = hasRiskOrAlert ? 102 : 108;
  const radarW = 84;
  const pillarsX = margin + radarW + 4;
  const pillarsW = contentW - radarW - 4;

  drawVectorRadarChart(doc, margin, dualTop, radarW, dualH, dims, copy, simulatedDimensions);

  // Painel Direito: Scorecard Executivo dos Pilares
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(pillarsX, dualTop, pillarsW, dualH, 2.2, 2.2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.6);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(copy.pillarsCardTitle, pillarsX + 4, dualTop + 5);

  const visibleDims = dims.slice(0, 7);
  const availH = dualH - 10.5;
  const rowPitch = availH / Math.max(visibleDims.length, 1);

  visibleDims.forEach((dim, idx) => {
    const ry = dualTop + 10.2 + idx * rowPitch;
    const pct = Math.max(0, Math.min(100, Math.round(dim.percentual)));
    const fillCol = getBarColor(pct);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const dimTitle = doc.splitTextToSize(safeText(dim.nome), pillarsW - 31)[0];
    doc.text(dimTitle, pillarsX + 4, ry);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(`${dim.pontos}/${dim.maximo} (${pct}%)`, pillarsX + pillarsW - 4, ry, { align: 'right' });

    const miniBarW = pillarsW - 8;
    doc.setFillColor(238, 235, 228);
    doc.roundedRect(pillarsX + 4, ry + 1.3, miniBarW, 2.1, 1.0, 1.0, 'F');
    doc.setFillColor(fillCol[0], fillCol[1], fillCol[2]);
    doc.roundedRect(pillarsX + 4, ry + 1.3, Math.max(2, (miniBarW * pct) / 100), 2.1, 1.0, 1.0, 'F');

    if (rowPitch >= 11.8) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.1);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const obsLine = doc.splitTextToSize(safeText(dim.observacao, ''), miniBarW)[0] || '';
      if (obsLine) {
        doc.text(obsLine, pillarsX + 4, ry + 6.1);
      }
    }
  });

  // Faixa de Fechamento da Página 1 (Alerta Prioritário OU Composição Familiar / Síntese Operacional)
  const bottomBoxY = dualTop + dualH + 4.2;
  const bottomAvailH = Math.max(18, 276 - bottomBoxY);

  if (hasRiskOrAlert) {
    const alertText =
      result?.alertaRiscoAlto ||
      summary.alertaGeral ||
      (result?.flagsRisco?.[0]
        ? `${result.flagsRisco[0].pergunta}: ${result.flagsRisco[0].orientacao}`
        : '');
    const extraFlags = (result?.flagsRisco || [])
      .slice(0, 2)
      .map((f) => `[${f.severidade}] ${safeText(f.orientacao)}`)
      .join(' | ');
    const boxH = Math.min(bottomAvailH, 24);

    doc.setFillColor(255, 250, 235);
    doc.setDrawColor(232, 195, 108);
    doc.roundedRect(margin, bottomBoxY, contentW, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(146, 64, 14);
    doc.text(copy.alertTitle, margin + 4, bottomBoxY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(120, 53, 15);
    const alertLines = doc.splitTextToSize(safeText(alertText || extraFlags), contentW - 8).slice(0, 2);
    doc.text(alertLines, margin + 4, bottomBoxY + 9.8);

    if (extraFlags && alertText && boxH >= 22) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.4);
      doc.setTextColor(CRIMSON[0], CRIMSON[1], CRIMSON[2]);
      const flagLine = doc.splitTextToSize(extraFlags, contentW - 8)[0];
      doc.text(flagLine, margin + 4, bottomBoxY + 19.2);
    }
  } else if (result?.diagnosticoPorPessoa && result.diagnosticoPorPessoa.length > 1) {
    const boxH = Math.min(bottomAvailH, 21);
    doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.roundedRect(margin, bottomBoxY, contentW, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
    doc.text(copy.familySynthesisTitle, margin + 4, bottomBoxY + 5);

    const familyLine = result.diagnosticoPorPessoa
      .slice(0, 3)
      .map((p) => `${safeText(p.papel)} (${safeText(p.parentesco)}): ${safeText(p.subcategoriaIndicada)}`)
      .join('  ·  ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const famLines = doc.splitTextToSize(familyLine, contentW - 8).slice(0, 2);
    doc.text(famLines, margin + 4, bottomBoxY + 10);
  } else {
    const boxH = Math.min(bottomAvailH, 19);
    doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.roundedRect(margin, bottomBoxY, contentW, boxH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
    doc.text(copy.synthesisTitle, margin + 4, bottomBoxY + 5);

    const synthText = result?.caminho
      ? `${safeText(result.caminho)} · ${safeText(result.cronogramaFaixas?.preparacaoDocumental, '')}`
      : safeText(summary.resumoBasico);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.1);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const synthLines = doc.splitTextToSize(synthText, contentW - 8).slice(0, 2);
    doc.text(synthLines, margin + 4, bottomBoxY + 10);
  }

  drawFooter(doc, empresa, 1, 2, copy);

  // =========================================================================
  // PÁGINA 2: ESTRATÉGIA, 4 FASES, PLANO DE AÇÃO, CHECKLIST, CUSTOS & BASE LEGAL
  // =========================================================================
  doc.addPage('a4', 'portrait');
  drawTricolorRibbon(doc, 0, 2.2);

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 2.2, pageW, 14.2, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(0, 16.4, pageW, 0.6, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(`${safeText(empresa.nome_empresa, 'D&M Integra Chile')}  ·  ${copy.page2HeaderSuffix}`, margin, 10.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(`${copy.protocolPrefix}${protocoloRef}  ·  ${titularNome}`, pageW - margin, 10.6, { align: 'right' });

  let y2 = 21.8;

  // 1. Análise Qualitativa: Pontos Fortes x Pontos de Verificação & Riscos
  y2 = drawSectionEyebrow(doc, margin, y2, copy.qualEyebrow, copy.qualTitle);

  const halfW = (contentW - 4.5) / 2;
  const rightX = margin + halfW + 4.5;
  const qualBoxH = 38;

  // Esquerda: Pontos Fortes
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y2 + 0.6, halfW, qualBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  doc.setTextColor(EMERALD[0], EMERALD[1], EMERALD[2]);
  doc.text(copy.strengthsTitle, margin + 3.6, y2 + 5.6);

  const fortes =
    summary.pontosFortes && summary.pontosFortes.length > 0
      ? summary.pontosFortes
      : ['Enquadramento preliminar compatível com as normas vigentes do SERMIG.'];

  let fy = y2 + 10.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  fortes.slice(0, 4).forEach((item) => {
    if (fy > y2 + qualBoxH - 3.5) return;
    doc.setFillColor(EMERALD[0], EMERALD[1], EMERALD[2]);
    doc.circle(margin + 4.8, fy - 1, 0.75, 'F');
    const lines = doc.splitTextToSize(safeText(item), halfW - 9.8).slice(0, 2);
    doc.text(lines, margin + 7.2, fy);
    fy += lines.length * 3.3 + 1.5;
  });

  // Direita: Pontos de Verificação & Riscos
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(rightX, y2 + 0.6, halfW, qualBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.7);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(copy.checksTitle, rightX + 3.6, y2 + 5.6);

  const riskLines = (result?.flagsRisco || []).map((f) => `[Risco ${f.severidade}] ${safeText(f.orientacao)}`);
  const atencoesMerged = [
    ...riskLines,
    ...(summary.pontosAtencao || []),
  ];
  const atencoes =
    atencoesMerged.length > 0
      ? atencoesMerged
      : [
          'Validar prazos curtos de emissão (antecedentes criminais de 60 dias) antes de iniciar apostilamentos.',
          'Confirmar traduções oficiais e sequência cronológica de protocolo no portal SERMIG.',
        ];

  let ay = y2 + 10.2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.0);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  atencoes.slice(0, 4).forEach((item, idx) => {
    if (ay > y2 + qualBoxH - 3.5) return;
    const isRisk = idx < riskLines.length;
    doc.setFillColor(isRisk ? CRIMSON[0] : GOLD[0], isRisk ? CRIMSON[1] : GOLD[1], isRisk ? CRIMSON[2] : GOLD[2]);
    doc.circle(rightX + 4.8, ay - 1, 0.75, 'F');
    const lines = doc.splitTextToSize(safeText(item), halfW - 9.8).slice(0, 2);
    doc.text(lines, rightX + 7.2, ay);
    ay += lines.length * 3.3 + 1.5;
  });

  // 2. Roteiro Macro em 4 Fases
  y2 += qualBoxH + 5.2;
  y2 = drawSectionEyebrow(doc, margin, y2, copy.roadmapEyebrow, copy.roadmapTitle);

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

  const phaseGap = 3.2;
  const phaseW = (contentW - phaseGap * 3) / 4;
  const phaseH = 35.5;
  const phaseTop = y2 + 0.8;

  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setLineWidth(0.65);
  doc.line(margin + phaseW * 0.5, phaseTop + 6.2, margin + contentW - phaseW * 0.5, phaseTop + 6.2);

  fases.forEach((f, idx) => {
    const fx = margin + idx * (phaseW + phaseGap);
    doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(fx, phaseTop, phaseW, phaseH, 2, 2, 'FD');

    doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.roundedRect(fx + 3, phaseTop + 2.6, 15.5, 5.2, 1.1, 1.1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.text(`${copy.phasePrefix}${f.fase}`, fx + 10.75, phaseTop + 6.1, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.4);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    const fTitleLines = doc.splitTextToSize(safeText(f.titulo), phaseW - 6).slice(0, 2);
    doc.text(fTitleLines, fx + 3, phaseTop + 12.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const fDescLines = doc.splitTextToSize(safeText(f.resumo), phaseW - 6).slice(0, 4);
    doc.text(fDescLines, fx + 3, phaseTop + 12.2 + fTitleLines.length * 3.3 + 1.1);
  });

  // 3. Plano de Ação Prioritário & Checklist Documental (Completo quando result está presente)
  y2 = phaseTop + phaseH + 5.2;
  y2 = drawSectionEyebrow(doc, margin, y2, copy.actionEyebrow, copy.actionTitle);

  const actionBoxTop = y2 + 0.6;
  const actionBoxH = 44.5;
  const topActions = collectTopActionItems(result);
  const topChecklist = collectTopChecklistItems(result);

  // Coluna Esquerda: Plano de Ação Prioritário
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, actionBoxTop, halfW, actionBoxH, 2, 2, 'FD');

  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.rect(margin + 0.2, actionBoxTop + 0.2, halfW - 0.4, 5.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(copy.actionColTitle, margin + 3.4, actionBoxTop + 4.0);

  let actY = actionBoxTop + 9.8;
  if (topActions.length > 0) {
    topActions.forEach(({ tag, color, item }) => {
      if (actY > actionBoxTop + actionBoxH - 3.5) return;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.7);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(`[${tag}]`, margin + 3.4, actY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      const valTag = item.validadeDias > 0 ? ` (${item.validadeDias}d)` : '';
      const actTitle = doc.splitTextToSize(`${safeText(item.titulo)}${valTag}`, halfW - 22)[0];
      doc.text(actTitle, margin + 17.8, actY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.1);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const actDetail = doc.splitTextToSize(`${safeText(item.orgao)}: ${safeText(item.detalhe)}`, halfW - 7)[0];
      doc.text(actDetail, margin + 3.4, actY + 3.4);

      actY += 8.6;
    });
  } else {
    const fallbackActions = [
      { tag: 'ETAPA 1', text: 'Validar validade do passaporte (mín. 12 meses recomendados) e certidões civis.' },
      { tag: 'ETAPA 2', text: 'Reunir comprovantes financeiros, vínculos ou contrato conforme subcategoria.' },
      { tag: 'ETAPA 3', text: 'Apostilar certidões brasileiras no padrão Haia CNJ e providenciar tradução.' },
      { tag: 'ETAPA 4', text: 'Emitir Antecedentes PF por último (60 dias) e protocolar no portal SERMIG.' },
    ];
    fallbackActions.forEach((fa) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.1);
      doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
      doc.text(fa.tag, margin + 3.4, actY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const l = doc.splitTextToSize(fa.text, halfW - 19).slice(0, 2);
      doc.text(l, margin + 15.5, actY);
      actY += l.length * 3.3 + 2.0;
    });
  }

  // Coluna Direita: Checklist Documental com status real
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(rightX, actionBoxTop, halfW, actionBoxH, 2, 2, 'FD');

  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.rect(rightX + 0.2, actionBoxTop + 0.2, halfW - 0.4, 5.6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  const chkHeaderRight = result?.checklistProntidao
    ? `${copy.checklistColTitle} (${Math.round(result.checklistProntidao.percentualInicial)}%)`
    : copy.checklistColTitle;
  doc.text(chkHeaderRight, rightX + 3.4, actionBoxTop + 4.0);

  let chkY = actionBoxTop + 9.6;
  if (topChecklist.length > 0) {
    topChecklist.forEach((docItem) => {
      if (chkY > actionBoxTop + actionBoxH - 3.2) return;
      const isOk = docItem.statusInicial === 'Já possui';
      const isCrit = docItem.statusInicial === 'Crítico / Validade curta';
      const badgeLabel = isOk ? '[OK]' : isCrit ? '[CRÍT.]' : '[PEND.]';
      const badgeColor = isOk ? EMERALD : isCrit ? CRIMSON : NAVY;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.9);
      doc.setTextColor(badgeColor[0], badgeColor[1], badgeColor[2]);
      doc.text(badgeLabel, rightX + 3.4, chkY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.7);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const nameTrunc = doc.splitTextToSize(safeText(docItem.nomeDocumento), halfW - 36)[0];
      doc.text(nameTrunc, rightX + 14.8, chkY);

      const tags: string[] = [];
      if (docItem.validadeDias > 0) tags.push(`${docItem.validadeDias}d`);
      if (docItem.exigeApostila) tags.push('Haia');
      if (docItem.exigeTraducao) tags.push('Trad.');
      if (tags.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.8);
        doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        doc.text(tags.join('·'), rightX + halfW - 3.2, chkY, { align: 'right' });
      }
      chkY += 7.0;
    });
  } else {
    const ownedDocs = answers?.documentosJaPossui || [];
    const fallbackDocs = [
      'Passaporte válido (página biográfica)',
      'Certidão de Antecedentes Criminais PF (60 dias)',
      'Certidão de Nascimento / Casamento (Haia)',
      'Comprovante de renda, vínculo ou contrato',
      'Fotografia digital padrão SERMIG fundo branco',
    ];
    fallbackDocs.forEach((dLabel) => {
      const hasIt = ownedDocs.some((owned) => dLabel.toLowerCase().includes(owned.toLowerCase().slice(0, 8)));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.9);
      doc.setTextColor(hasIt ? EMERALD[0] : NAVY[0], hasIt ? EMERALD[1] : NAVY[1], hasIt ? EMERALD[2] : NAVY[2]);
      doc.text(hasIt ? '[OK]' : '[DOC]', rightX + 3.4, chkY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.7);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const l = doc.splitTextToSize(dLabel, halfW - 18)[0];
      doc.text(l, rightX + 14.5, chkY);
      chkY += 7.0;
    });
  }

  // 4. Faixa Integrada: Radar de Validades SERMIG (Esquerda) + Custos & Prazos (Direita)
  y2 = actionBoxTop + actionBoxH + 4.2;
  const stripH = 26.5;
  const sermigW = 108;
  const costX = margin + sermigW + 4;
  const costW = contentW - sermigW - 4;

  // Painel Esquerdo: Radar de Validades SERMIG
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y2, sermigW, stripH, 2, 2, 'FD');

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(margin, y2, sermigW, 5.2, 2, 2, 'F');
  doc.rect(margin, y2 + 3, sermigW, 2.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(copy.sermigRadarHeader, margin + 3.2, y2 + 3.6);

  const sermigItems: Array<{ kpi: string; title: string; sub: string; color: [number, number, number] }> = [
    { kpi: '60 dias', title: 'Antecedentes PF', sub: 'Emitir por último', color: CRIMSON },
    { kpi: 'Haia CNJ', title: 'Apostila Brasil', sub: 'Certidões oficiais', color: GOLD_DARK },
    { kpi: '90 dias', title: 'Pós-Estampado', sub: 'Ingresso no Chile', color: NAVY },
    { kpi: '30 dias', title: 'PDI & Cédula', sub: 'Após entrada', color: EMERALD },
  ];
  const sColW = sermigW / 4;
  sermigItems.forEach((item, idx) => {
    const sx = margin + idx * sColW + 2.4;
    if (idx > 0) {
      doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
      doc.line(margin + idx * sColW, y2 + 6.4, margin + idx * sColW, y2 + stripH - 1.8);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(item.color[0], item.color[1], item.color[2]);
    doc.text(item.kpi, sx, y2 + 11.4);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(item.title, sx, y2 + 16.0);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    const sSub = doc.splitTextToSize(item.sub, sColW - 4.2)[0];
    doc.text(sSub, sx, y2 + 20.4);
  });

  // Painel Direito: Estimativa de Custos & Prazos
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(costX, y2, costW, stripH, 2, 2, 'FD');

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(costX, y2, costW, 5.2, 2, 2, 'F');
  doc.rect(costX, y2 + 3, costW, 2.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  const showCosts = Boolean(result?.custosEstimados && !hideCosts);
  doc.text(showCosts ? copy.costsHeader : copy.scheduleHeader, costX + 3.2, y2 + 3.6);

  if (showCosts && result?.custosEstimados) {
    const c = result.custosEstimados;
    const feeText = `${formatCurrency(c.taxasOficiaisBrlMin, 'BRL')} - ${formatCurrency(c.taxasOficiaisBrlMax, 'BRL')}`;
    const honText = c.honorariosSobConsulta
      ? copy.feesConsult
      : `${formatCurrency(c.honorariosMinBrl, 'BRL')} - ${formatCurrency(c.honorariosMaxBrl, 'BRL')}`;
    const totalText = c.honorariosSobConsulta
      ? `${formatCurrency(c.taxasOficiaisBrlMin, 'BRL')}+ (+ hon.)`
      : `${formatCurrency(c.totalMinBrl, 'BRL')} - ${formatCurrency(c.totalMaxBrl, 'BRL')}`;
    const prepText = safeText(result.cronogramaFaixas?.preparacaoDocumental, '15 a 45 dias');

    const costRows = [
      { k: copy.feesOfficial, v: feeText, bold: false },
      { k: copy.feesHonorarium, v: honText, bold: false },
      { k: copy.feesTotal, v: totalText, bold: true },
      { k: copy.feesPrep, v: prepText, bold: false },
    ];
    costRows.forEach((row, idx) => {
      const cyRow = y2 + 10.0 + idx * 4.4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.9);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(row.k, costX + 3.0, cyRow);

      doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(row.bold ? EMERALD[0] : NAVY[0], row.bold ? EMERALD[1] : NAVY[1], row.bold ? EMERALD[2] : NAVY[2]);
      const vTrunc = doc.splitTextToSize(safeText(row.v), costW - 26)[0];
      doc.text(vTrunc, costX + costW - 3.0, cyRow, { align: 'right' });
    });
  } else {
    const schedRows = [
      { k: 'Preparação doc.:', v: safeText(result?.cronogramaFaixas?.preparacaoDocumental, '15 a 45 dias') },
      { k: 'Protocolo SERMIG:', v: safeText(result?.cronogramaFaixas?.protocoloSermig, 'Digital (on-line)') },
      { k: 'Análise SERMIG:', v: safeText(summary.prazoEstimadoResumo, 'Conforme fila oficial') },
      { k: 'Honorários:', v: copy.feesConsult },
    ];
    schedRows.forEach((row, idx) => {
      const cyRow = y2 + 10.0 + idx * 4.4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.9);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(row.k, costX + 3.0, cyRow);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.1);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      const vTrunc = doc.splitTextToSize(row.v, costW - 28)[0];
      doc.text(vTrunc, costX + costW - 3.0, cyRow, { align: 'right' });
    });
  }

  // 5. Rotas Alternativas Avaliadas (Esquerda) + Base Legal Citada (Direita)
  y2 += stripH + 4.2;
  const matrixH = 24;

  // Esquerda: Rotas Secundárias
  doc.setFillColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y2, sermigW, matrixH, 2, 2, 'FD');

  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.rect(margin + 0.2, y2 + 0.2, sermigW - 0.4, 5.4, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(copy.altRoutesHeader, margin + 3.2, y2 + 3.8);
  doc.text('ADERÊNCIA', margin + sermigW - 3.2, y2 + 3.8, { align: 'right' });

  const altRows = (summary.alternativasMapeadas || []).slice(0, 2);
  if (altRows.length > 0) {
    altRows.forEach((alt, idx) => {
      const ry = y2 + 10.4 + idx * 6.8;
      if (idx > 0) {
        doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
        doc.line(margin + 2, ry - 4.4, margin + sermigW - 2, ry - 4.4);
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.6);
      doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
      const altLabel = doc.splitTextToSize(`${safeText(alt.codigo)} · ${safeText(alt.nome)}`, sermigW - 36)[0];
      doc.text(altLabel, margin + 3.2, ry);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.9);
      doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      doc.text(`Chile: ${safeText(alt.permiteDentroChile)}`, margin + sermigW - 18, ry, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
      doc.text(`${Math.round(alt.aderencia)}/100`, margin + sermigW - 3.2, ry, { align: 'right' });
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(
      'Subcategoria principal selecionada como rota dominante diante dos requisitos informados.',
      margin + 3.2,
      y2 + 13.5,
    );
  }

  // Direita: Base Legal & Fontes Citadas
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(costX, y2, costW, matrixH, 2, 2, 'FD');

  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(costX, y2, costW, 5.2, 2, 2, 'F');
  doc.rect(costX, y2 + 3, costW, 2.2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(copy.legalSourcesHeader, costX + 3.2, y2 + 3.6);

  const legalList =
    result?.fontesLegais && result.fontesLegais.length > 0
      ? result.fontesLegais.slice(0, 3).map((src) => `${safeText(src.titulo)} (${safeText(src.orgaoEmissor || src.numeroAno)})`)
      : [
          'Ley Nº 21.325 de Migración y Extranjería (SERMIG)',
          'Decreto Supremo Nº 177 - Subcategorías Temporales',
          'Acuerdo de Residencia Mercosur (Brasil-Chile)',
        ];
  legalList.forEach((leg, idx) => {
    const ly = y2 + 9.8 + idx * 5.2;
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.circle(costX + 4.0, ly - 0.9, 0.65, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.0);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    const legTrunc = doc.splitTextToSize(leg, costW - 8.5)[0];
    doc.text(legTrunc, costX + 6.2, ly);
  });

  // 6. Próximos Passos: Modalidades de Assessoria D&M Integra
  y2 += matrixH + 4.4;
  const ctaH = 38.5;
  const planOri = CONSULTANCY_PLANS.orientativa;
  const planComp = CONSULTANCY_PLANS.completa;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.4);
  doc.setTextColor(GOLD_DARK[0], GOLD_DARK[1], GOLD_DARK[2]);
  doc.text(copy.nextStepsEyebrow, margin, y2);

  // Cartão 1: Consultoria Orientativa
  doc.setFillColor(IVORY[0], IVORY[1], IVORY[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.roundedRect(margin, y2 + 2.2, halfW, ctaH - 2.2, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(copy.orientativaBadge, margin + 3.6, y2 + 7.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(safeText(planOri.nome), margin + 3.6, y2 + 12.0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  const oriSub = doc.splitTextToSize(safeText(planOri.subtitulo), halfW - 7.2).slice(0, 2);
  doc.text(oriSub, margin + 3.6, y2 + 16.2);

  let py1 = y2 + 23.6;
  planOri.inclui.slice(0, 2).forEach((item) => {
    const l = doc.splitTextToSize(`* ${safeText(item)}`, halfW - 7.2).slice(0, 2);
    doc.text(l, margin + 3.6, py1);
    py1 += l.length * 3.2 + 1.2;
  });

  // Cartão 2: Consultoria Completa (Azul Marinho + Ouro)
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.roundedRect(rightX, y2 + 2.2, halfW, ctaH - 2.2, 2, 2, 'F');
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(rightX, y2 + 2.2, halfW, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.2);
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.text(copy.completaBadge, rightX + 3.6, y2 + 7.6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text(safeText(planComp.nome), rightX + 3.6, y2 + 12.4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.6);
  doc.setTextColor(215, 224, 236);
  const compSub = doc.splitTextToSize(safeText(planComp.subtitulo), halfW - 7.2).slice(0, 2);
  doc.text(compSub, rightX + 3.6, y2 + 16.6);

  let py2 = y2 + 24.0;
  planComp.inclui.slice(0, 2).forEach((item) => {
    const l = doc.splitTextToSize(`* ${safeText(item)}`, halfW - 7.2).slice(0, 2);
    doc.text(l, rightX + 3.6, py2);
    py2 += l.length * 3.2 + 1.2;
  });

  // Nota Legal acima do rodapé (sempre dentro da margem segura <= 278mm)
  const legalY = Math.min(y2 + ctaH + 3.6, 273.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  const legalNotice = doc
    .splitTextToSize(
      safeText(
        empresa.avisoLegal,
        'Este diagnóstico possui caráter orientativo inicial, não substitui consulta jurídica individualizada nem garante concessão de visto pelo SERMIG.',
      ),
      contentW,
    )
    .slice(0, 2);
  doc.text(legalNotice, margin, legalY);

  drawFooter(doc, empresa, 2, 2, copy);

  return { doc, filename };
}

export async function buildClientDiagnosticPdfBlob(
  input: ClientDiagnosticPdfInput,
): Promise<{ blob: Blob; filename: string }> {
  const logoAsset = input.logoAsset || (input.logoDataUrl ? undefined : await resolveBrandLogoAsset(input.empresa));
  const { doc, filename } = buildClientDiagnosticDossierDoc({ ...input, logoAsset });
  const blob = doc.output('blob');
  return { blob, filename };
}

export async function exportClientDiagnosticPdf(input: ClientDiagnosticPdfInput): Promise<string> {
  const logoAsset = input.logoAsset || (input.logoDataUrl ? undefined : await resolveBrandLogoAsset(input.empresa));
  const { doc, filename } = buildClientDiagnosticDossierDoc({ ...input, logoAsset });
  try {
    doc.save(filename);
  } catch {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }
  return filename;
}
