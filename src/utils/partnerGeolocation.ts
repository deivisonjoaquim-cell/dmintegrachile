import type { PartnerPublic } from '../types/domain';
import type { PartnerMacroGroupId } from './partnerHelpers';

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export type ChileHubId =
  | 'all_chile'
  | 'santiago_oriente'
  | 'santiago_centro'
  | 'valparaiso_vina'
  | 'corredor_brasil_chile';

export interface ChileHubPreset {
  id: ChileHubId;
  labelPt: string;
  labelEs: string;
  subtitlePt: string;
  subtitleEs: string;
  center: LatLngLiteral;
  zoom: number;
}

export const CHILE_HUB_PRESETS: ChileHubPreset[] = [
  {
    id: 'all_chile',
    labelPt: 'Grande Santiago & Litoral',
    labelEs: 'Gran Santiago y Costa',
    subtitlePt: 'Distribuição geral de serviços no Chile',
    subtitleEs: 'Distribución general de servicios en Chile',
    center: { lat: -33.36, lng: -70.95 },
    zoom: 9,
  },
  {
    id: 'santiago_oriente',
    labelPt: 'Eixo Oriente (Providencia · Las Condes · Vitacura)',
    labelEs: 'Sector Oriente (Providencia · Las Condes · Vitacura)',
    subtitlePt: 'Polos imobiliários, jurídicos e corporativos',
    subtitleEs: 'Polos inmobiliarios, legales y corporativos',
    center: { lat: -33.4145, lng: -70.5935 },
    zoom: 13,
  },
  {
    id: 'santiago_centro',
    labelPt: 'Santiago Centro & Ñuñoa',
    labelEs: 'Santiago Centro y Ñuñoa',
    subtitlePt: 'Notarías, contratos, saúde e adaptação familiar',
    subtitleEs: 'Notarías, contratos, salud y adaptación familiar',
    center: { lat: -33.448, lng: -70.628 },
    zoom: 13,
  },
  {
    id: 'valparaiso_vina',
    labelPt: 'Viña del Mar & Concón',
    labelEs: 'Viña del Mar y Concón',
    subtitlePt: 'Moradia litorânea na Região de Valparaíso',
    subtitleEs: 'Vivienda costera en la Región de Valparaíso',
    center: { lat: -33.0153, lng: -71.5505 },
    zoom: 12,
  },
  {
    id: 'corredor_brasil_chile',
    labelPt: 'Corredor Brasil – Chile',
    labelEs: 'Corredor Brasil – Chile',
    subtitlePt: 'Visão completa de pré-embarque e chegada',
    subtitleEs: 'Vista completa de pre-embarque y llegada',
    center: { lat: -28.5, lng: -58.5 },
    zoom: 4,
  },
];

export interface PartnerPinVisualStyle {
  macroGroup: PartnerMacroGroupId;
  bgHex: string;
  borderHex: string;
  textHex: string;
  badgeLabelPt: string;
  badgeLabelEs: string;
}

export const PARTNER_PIN_STYLES: Record<PartnerMacroGroupId, PartnerPinVisualStyle> = {
  Todos: {
    macroGroup: 'Todos',
    bgHex: '#0B1F33',
    borderHex: '#C8A236',
    textHex: '#FFFFFF',
    badgeLabelPt: 'Rede D&M',
    badgeLabelEs: 'Red D&M',
  },
  Imobiliario: {
    macroGroup: 'Imobiliario',
    bgHex: '#146B43',
    borderHex: '#E5C76B',
    textHex: '#FFFFFF',
    badgeLabelPt: 'Imobiliário',
    badgeLabelEs: 'Inmobiliario',
  },
  Juridico: {
    macroGroup: 'Juridico',
    bgHex: '#0B1F33',
    borderHex: '#C8A236',
    textHex: '#E5C76B',
    badgeLabelPt: 'Jurídico',
    badgeLabelEs: 'Legal',
  },
  Financeiro: {
    macroGroup: 'Financeiro',
    bgHex: '#8C6D14',
    borderHex: '#FFFFFF',
    textHex: '#FFFFFF',
    badgeLabelPt: 'Financeiro & SpA',
    badgeLabelEs: 'Financiero y SpA',
  },
  Documental: {
    macroGroup: 'Documental',
    bgHex: '#1D4E7A',
    borderHex: '#E5C76B',
    textHex: '#FFFFFF',
    badgeLabelPt: 'Documental',
    badgeLabelEs: 'Documental',
  },
  SaudeEducacao: {
    macroGroup: 'SaudeEducacao',
    bgHex: '#A61C2B',
    borderHex: '#FFFFFF',
    textHex: '#FFFFFF',
    badgeLabelPt: 'Saúde & Família',
    badgeLabelEs: 'Salud y Familia',
  },
  Operacional: {
    macroGroup: 'Operacional',
    bgHex: '#334155',
    borderHex: '#E5C76B',
    textHex: '#FFFFFF',
    badgeLabelPt: 'Relocation',
    badgeLabelEs: 'Relocation',
  },
};

export function classifyPartnerMacroCategory(category: string): PartnerMacroGroupId {
  switch (category) {
    case 'Imobiliária':
      return 'Imobiliario';
    case 'Escritório de Advocacia':
      return 'Juridico';
    case 'Contabilidade / Abertura Empresa':
      return 'Financeiro';
    case 'Tradutor Juramentado':
    case 'Cartório / Apostilamento':
      return 'Documental';
    case 'Seguradora / Saúde':
    case 'Escola / Universidade':
      return 'SaudeEducacao';
    default:
      return 'Operacional';
  }
}

interface PartnerDirectoryGeoEntry {
  lat: number;
  lng: number;
  comunaLabel: string;
  regionLabel: string;
  hubId: ChileHubId;
  isChile: boolean;
}

/**
 * Coordinates for D&M Integra's own homologated partner directory records.
 * Used as app-owned directory coordinates for visualization in Google Maps.
 */
const PARTNER_EXACT_DIRECTORY_GEO: Record<string, PartnerDirectoryGeoEntry> = {
  part_santiago_imoveis: {
    lat: -33.4259,
    lng: -70.6143,
    comunaLabel: 'Providencia',
    regionLabel: 'Región Metropolitana',
    hubId: 'santiago_oriente',
    isChile: true,
  },
  part_juridico_el_golf: {
    lat: -33.4136,
    lng: -70.5968,
    comunaLabel: 'Las Condes · El Golf',
    regionLabel: 'Región Metropolitana',
    hubId: 'santiago_oriente',
    isChile: true,
  },
  part_juridico_centro_stgo: {
    lat: -33.4408,
    lng: -70.6524,
    comunaLabel: 'Santiago Centro',
    regionLabel: 'Región Metropolitana',
    hubId: 'santiago_centro',
    isChile: true,
  },
  part_imoveis_vitacura: {
    lat: -33.3944,
    lng: -70.5762,
    comunaLabel: 'Vitacura',
    regionLabel: 'Región Metropolitana',
    hubId: 'santiago_oriente',
    isChile: true,
  },
  part_imoveis_vina_concon: {
    lat: -33.0153,
    lng: -71.5505,
    comunaLabel: 'Viña del Mar · Concón',
    regionLabel: 'Región de Valparaíso',
    hubId: 'valparaiso_vina',
    isChile: true,
  },
  part_contabilidade_spa_prov: {
    lat: -33.4184,
    lng: -70.6054,
    comunaLabel: 'Providencia · Apoquindo',
    regionLabel: 'Región Metropolitana',
    hubId: 'santiago_oriente',
    isChile: true,
  },
  part_saude_educacao_nunoa: {
    lat: -33.4545,
    lng: -70.5939,
    comunaLabel: 'Ñuñoa',
    regionLabel: 'Región Metropolitana',
    hubId: 'santiago_centro',
    isChile: true,
  },
  part_traducoes_andes: {
    lat: -23.5614,
    lng: -46.6559,
    comunaLabel: 'São Paulo (Online)',
    regionLabel: 'Brasil · Pré-embarque',
    hubId: 'corredor_brasil_chile',
    isChile: false,
  },
  part_cartorio_haia: {
    lat: -22.9068,
    lng: -43.1729,
    comunaLabel: 'Rio de Janeiro (Nacional)',
    regionLabel: 'Brasil · Pré-embarque',
    hubId: 'corredor_brasil_chile',
    isChile: false,
  },
};

interface KnownCityGeoRule {
  keywords: string[];
  entry: PartnerDirectoryGeoEntry;
}

const KNOWN_CITY_GEO_RULES: KnownCityGeoRule[] = [
  {
    keywords: ['el golf', 'las condes'],
    entry: {
      lat: -33.4112,
      lng: -70.5838,
      comunaLabel: 'Las Condes',
      regionLabel: 'Región Metropolitana',
      hubId: 'santiago_oriente',
      isChile: true,
    },
  },
  {
    keywords: ['vitacura', 'lo barnechea', 'la dehesa'],
    entry: {
      lat: -33.3928,
      lng: -70.5741,
      comunaLabel: 'Vitacura',
      regionLabel: 'Región Metropolitana',
      hubId: 'santiago_oriente',
      isChile: true,
    },
  },
  {
    keywords: ['providencia'],
    entry: {
      lat: -33.4285,
      lng: -70.611,
      comunaLabel: 'Providencia',
      regionLabel: 'Región Metropolitana',
      hubId: 'santiago_oriente',
      isChile: true,
    },
  },
  {
    keywords: ['nunoa', 'ñuñoa'],
    entry: {
      lat: -33.4569,
      lng: -70.5975,
      comunaLabel: 'Ñuñoa',
      regionLabel: 'Región Metropolitana',
      hubId: 'santiago_centro',
      isChile: true,
    },
  },
  {
    keywords: ['vina del mar', 'viña del mar', 'renaca', 'reñaca', 'concon', 'concón'],
    entry: {
      lat: -33.0153,
      lng: -71.5505,
      comunaLabel: 'Viña del Mar',
      regionLabel: 'Región de Valparaíso',
      hubId: 'valparaiso_vina',
      isChile: true,
    },
  },
  {
    keywords: ['valparaiso', 'valparaíso'],
    entry: {
      lat: -33.0472,
      lng: -71.6127,
      comunaLabel: 'Valparaíso',
      regionLabel: 'Región de Valparaíso',
      hubId: 'valparaiso_vina',
      isChile: true,
    },
  },
  {
    keywords: ['concepcion', 'concepción'],
    entry: {
      lat: -36.8201,
      lng: -73.0444,
      comunaLabel: 'Concepción',
      regionLabel: 'Región del Biobío',
      hubId: 'all_chile',
      isChile: true,
    },
  },
  {
    keywords: ['puerto varas', 'puerto montt'],
    entry: {
      lat: -41.3167,
      lng: -72.9833,
      comunaLabel: 'Puerto Varas',
      regionLabel: 'Región de Los Lagos',
      hubId: 'all_chile',
      isChile: true,
    },
  },
  {
    keywords: ['la serena', 'coquimbo'],
    entry: {
      lat: -29.9027,
      lng: -71.2519,
      comunaLabel: 'La Serena',
      regionLabel: 'Región de Coquimbo',
      hubId: 'all_chile',
      isChile: true,
    },
  },
  {
    keywords: ['antofagasta'],
    entry: {
      lat: -23.6509,
      lng: -70.3975,
      comunaLabel: 'Antofagasta',
      regionLabel: 'Región de Antofagasta',
      hubId: 'all_chile',
      isChile: true,
    },
  },
  {
    keywords: ['temuco', 'pucon', 'pucón'],
    entry: {
      lat: -38.7359,
      lng: -72.5904,
      comunaLabel: 'Temuco',
      regionLabel: 'Región de La Araucanía',
      hubId: 'all_chile',
      isChile: true,
    },
  },
  {
    keywords: ['santiago centro', 'huerfanos', 'huérfanos', 'moneda'],
    entry: {
      lat: -33.4408,
      lng: -70.6524,
      comunaLabel: 'Santiago Centro',
      regionLabel: 'Región Metropolitana',
      hubId: 'santiago_centro',
      isChile: true,
    },
  },
  {
    keywords: ['santiago', 'chile'],
    entry: {
      lat: -33.4372,
      lng: -70.6344,
      comunaLabel: 'Santiago',
      regionLabel: 'Región Metropolitana',
      hubId: 'santiago_centro',
      isChile: true,
    },
  },
  {
    keywords: ['sao paulo', 'são paulo'],
    entry: {
      lat: -23.5614,
      lng: -46.6559,
      comunaLabel: 'São Paulo',
      regionLabel: 'Brasil · Pré-embarque',
      hubId: 'corredor_brasil_chile',
      isChile: false,
    },
  },
  {
    keywords: ['rio de janeiro'],
    entry: {
      lat: -22.9068,
      lng: -43.1729,
      comunaLabel: 'Rio de Janeiro',
      regionLabel: 'Brasil · Pré-embarque',
      hubId: 'corredor_brasil_chile',
      isChile: false,
    },
  },
  {
    keywords: ['curitiba'],
    entry: {
      lat: -25.4284,
      lng: -49.2733,
      comunaLabel: 'Curitiba',
      regionLabel: 'Brasil · Pré-embarque',
      hubId: 'corredor_brasil_chile',
      isChile: false,
    },
  },
  {
    keywords: ['porto alegre'],
    entry: {
      lat: -30.0346,
      lng: -51.2177,
      comunaLabel: 'Porto Alegre',
      regionLabel: 'Brasil · Pré-embarque',
      hubId: 'corredor_brasil_chile',
      isChile: false,
    },
  },
  {
    keywords: ['florianopolis', 'florianópolis'],
    entry: {
      lat: -27.5954,
      lng: -48.548,
      comunaLabel: 'Florianópolis',
      regionLabel: 'Brasil · Pré-embarque',
      hubId: 'corredor_brasil_chile',
      isChile: false,
    },
  },
  {
    keywords: ['belo horizonte'],
    entry: {
      lat: -19.9167,
      lng: -43.9345,
      comunaLabel: 'Belo Horizonte',
      regionLabel: 'Brasil · Pré-embarque',
      hubId: 'corredor_brasil_chile',
      isChile: false,
    },
  },
];

function normalizeGeoText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export interface GeoPartnerItem {
  partner: PartnerPublic;
  position: LatLngLiteral;
  comunaLabel: string;
  regionLabel: string;
  hubId: ChileHubId;
  isChile: boolean;
  macroGroup: PartnerMacroGroupId;
  pinStyle: PartnerPinVisualStyle;
}

/**
 * Resolves coordinates for each partner in the directory and applies a tiny
 * deterministic radial separation if two partners share the exact same coordinate,
 * preventing stacked/unreachable markers on the map.
 */
export function resolvePartnersWithGeo(partners: PartnerPublic[]): GeoPartnerItem[] {
  const occupiedCount = new Map<string, number>();

  return partners.map((partner) => {
    const macroGroup = classifyPartnerMacroCategory(partner.categoria);
    const pinStyle = PARTNER_PIN_STYLES[macroGroup] || PARTNER_PIN_STYLES.Operacional;

    let base: PartnerDirectoryGeoEntry | null = PARTNER_EXACT_DIRECTORY_GEO[partner.id] || null;

    if (!base) {
      const text = normalizeGeoText(`${partner.cidadeRegiao || ''} ${partner.pais || ''}`);
      const matched = KNOWN_CITY_GEO_RULES.find((rule) =>
        rule.keywords.some((kw) => text.includes(normalizeGeoText(kw))),
      );
      if (matched) {
        base = matched.entry;
      } else if (partner.pais === 'Brasil') {
        base = {
          lat: -23.5505,
          lng: -46.6333,
          comunaLabel: partner.cidadeRegiao || 'Brasil',
          regionLabel: 'Brasil · Pré-embarque',
          hubId: 'corredor_brasil_chile',
          isChile: false,
        };
      } else {
        base = {
          lat: -33.4372,
          lng: -70.6344,
          comunaLabel: partner.cidadeRegiao || 'Santiago',
          regionLabel: 'Región Metropolitana',
          hubId: 'santiago_centro',
          isChile: true,
        };
      }
    }

    const coordKey = `${base.lat.toFixed(4)},${base.lng.toFixed(4)}`;
    const dupIndex = occupiedCount.get(coordKey) || 0;
    occupiedCount.set(coordKey, dupIndex + 1);

    let lat = base.lat;
    let lng = base.lng;
    if (dupIndex > 0) {
      const angle = (dupIndex * 2.39996) % (Math.PI * 2); // golden-angle spiral
      const radius = 0.0045 * Math.ceil(dupIndex / 4);
      lat = Number((base.lat + Math.sin(angle) * radius).toFixed(5));
      lng = Number((base.lng + Math.cos(angle) * radius).toFixed(5));
    }

    return {
      partner,
      position: { lat, lng },
      comunaLabel: base.comunaLabel,
      regionLabel: base.regionLabel,
      hubId: base.hubId,
      isChile: base.isChile,
      macroGroup,
      pinStyle,
    };
  });
}

/**
 * Great-circle Haversine distance in kilometers between two LatLng coordinates.
 */
export function calculateHaversineKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export interface GeoDistributionSummary {
  totalMapped: number;
  chileCount: number;
  brasilCount: number;
  imobiliarioCount: number;
  juridicoCount: number;
  hubs: { comuna: string; region: string; count: number }[];
}

export function computeChileGeoDistribution(items: GeoPartnerItem[]): GeoDistributionSummary {
  let chileCount = 0;
  let brasilCount = 0;
  let imobiliarioCount = 0;
  let juridicoCount = 0;
  const comunaCounts = new Map<string, { comuna: string; region: string; count: number }>();

  for (const item of items) {
    if (item.isChile) {
      chileCount += 1;
      const key = item.comunaLabel;
      const existing = comunaCounts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        comunaCounts.set(key, {
          comuna: item.comunaLabel,
          region: item.regionLabel,
          count: 1,
        });
      }
    } else {
      brasilCount += 1;
    }

    if (item.macroGroup === 'Imobiliario') imobiliarioCount += 1;
    if (item.macroGroup === 'Juridico') juridicoCount += 1;
  }

  const hubs = Array.from(comunaCounts.values()).sort((a, b) => b.count - a.count);

  return {
    totalMapped: items.length,
    chileCount,
    brasilCount,
    imobiliarioCount,
    juridicoCount,
    hubs,
  };
}
