import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Building2,
  Compass,
  Crosshair,
  ExternalLink,
  FileCheck2,
  Globe2,
  Handshake,
  HeartPulse,
  Landmark,
  Loader2,
  MapPin,
  MessageCircle,
  Navigation,
  Scale,
  Star,
  X,
} from 'lucide-react';
import { BrandRibbon } from './BrandLogo';
import { OptimizedImage } from './OptimizedImage';
import { useTheme } from '../contexts/ThemeContext';
import type { PartnerPublic } from '../types/domain';
import { buildWhatsAppUrl } from '../utils/formatters';
import {
  calculateHaversineKm,
  CHILE_HUB_PRESETS,
  computeChileGeoDistribution,
  PARTNER_PIN_STYLES,
  resolvePartnersWithGeo,
  type ChileHubId,
  type GeoPartnerItem,
  type LatLngLiteral,
} from '../utils/partnerGeolocation';
import {
  sanitizePartnerImageUrl,
  translatePartnerCategory,
  translatePartnerCountry,
  type PartnerMacroGroupId,
} from '../utils/partnerHelpers';

export interface PartnerGeolocationMapProps {
  partners: PartnerPublic[];
  locale: 'pt-BR' | 'es-CL';
  externalMacroGroup?: PartnerMacroGroupId;
  onSelectPartner: (partner: PartnerPublic) => void;
  buildReferralMessage: (partner: PartnerPublic) => string;
}

type MapCategoryFilter =
  | 'Todos'
  | 'Imobiliario'
  | 'Juridico'
  | 'Financeiro'
  | 'SaudeEducacao'
  | 'Documental';

const MAP_CATEGORY_TABS: { id: MapCategoryFilter; labelPt: string; labelEs: string }[] = [
  { id: 'Todos', labelPt: 'Todos no Mapa', labelEs: 'Todos en el Mapa' },
  { id: 'Imobiliario', labelPt: 'Imobiliário', labelEs: 'Inmobiliario' },
  { id: 'Juridico', labelPt: 'Jurídico', labelEs: 'Legal / Jurídico' },
  { id: 'Financeiro', labelPt: 'Financeiro & SpA', labelEs: 'Financiero y SpA' },
  { id: 'SaudeEducacao', labelPt: 'Saúde & Família', labelEs: 'Salud y Familia' },
  { id: 'Documental', labelPt: 'Documental (BR)', labelEs: 'Documental (BR)' },
];

const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI_FALLBACK_TILE_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
const ESRI_ATTRIBUTION =
  'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, OpenStreetMap contributors';

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPinIcon(macroGroup: PartnerMacroGroupId) {
  switch (macroGroup) {
    case 'Imobiliario':
      return Building2;
    case 'Juridico':
      return Scale;
    case 'Financeiro':
      return Landmark;
    case 'SaudeEducacao':
      return HeartPulse;
    case 'Documental':
      return FileCheck2;
    default:
      return Handshake;
  }
}

function createPartnerDivIcon(
  item: GeoPartnerItem,
  isSelected: boolean,
  isHovered: boolean,
): L.DivIcon {
  const scale = isSelected ? 'scale(1.12)' : isHovered ? 'scale(1.06)' : 'scale(1)';
  const borderColor = isSelected ? '#FFFFFF' : item.pinStyle.borderHex;
  const safeLabel = escapeAttr(item.comunaLabel);

  return L.divIcon({
    className: 'dm-leaflet-partner-pin',
    iconSize: [140, 38],
    iconAnchor: [70, 36],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;transform:${scale};transition:transform 140ms ease;cursor:pointer;">
        <div style="display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:10px;border:2px solid ${borderColor};background:${item.pinStyle.bgHex};color:${item.pinStyle.textHex};box-shadow:0 6px 18px rgba(11,31,51,0.34);font-family:'DM Sans',system-ui,sans-serif;font-size:11px;font-weight:700;line-height:1;white-space:nowrap;max-width:138px;overflow:hidden;text-overflow:ellipsis;">
          <span style="width:7px;height:7px;border-radius:9999px;background:#FFFFFF;opacity:0.92;flex-shrink:0;"></span>
          <span style="overflow:hidden;text-overflow:ellipsis;">${safeLabel}</span>
        </div>
        <div style="width:9px;height:9px;margin-top:-5px;transform:rotate(45deg);background:${item.pinStyle.bgHex};border-right:2px solid ${borderColor};border-bottom:2px solid ${borderColor};"></div>
      </div>
    `,
  });
}

function createUserLocationDivIcon(): L.DivIcon {
  return L.divIcon({
    className: 'dm-leaflet-user-pin',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `
      <div style="width:24px;height:24px;border-radius:9999px;background:rgba(14,165,233,0.26);border:1px solid rgba(56,189,248,0.85);display:flex;align-items:center;justify-content:center;">
        <div style="width:12px;height:12px;border-radius:9999px;background:#0284C7;border:2px solid #FFFFFF;box-shadow:0 2px 8px rgba(2,132,199,0.5);"></div>
      </div>
    `,
  });
}

export const PartnerGeolocationMap: React.FC<PartnerGeolocationMapProps> = ({
  partners,
  locale,
  externalMacroGroup,
  onSelectPartner,
  buildReferralMessage,
}) => {
  const { isDark } = useTheme();
  const isEs = locale === 'es-CL';
  const [categoryFilter, setCategoryFilter] = useState<MapCategoryFilter>('Todos');
  const [onlyChile, setOnlyChile] = useState<boolean>(true);
  const [activeHub, setActiveHub] = useState<ChileHubId>('all_chile');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cameraRequest, setCameraRequest] = useState<{
    center: LatLngLiteral;
    zoom: number;
    nonce: number;
  } | null>(null);
  const [fitNonce, setFitNonce] = useState(0);

  // Geolocalização opcional sob consentimento explícito e revogável
  const [userLocation, setUserLocation] = useState<LatLngLiteral | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Sincroniza quando o usuário escolhe um macrogrupo na página de Parceiros
  useEffect(() => {
    if (!externalMacroGroup) return;
    if (
      externalMacroGroup === 'Todos' ||
      externalMacroGroup === 'Imobiliario' ||
      externalMacroGroup === 'Juridico' ||
      externalMacroGroup === 'Financeiro' ||
      externalMacroGroup === 'SaudeEducacao' ||
      externalMacroGroup === 'Documental'
    ) {
      setCategoryFilter(externalMacroGroup);
      if (externalMacroGroup === 'Documental') {
        setOnlyChile(false);
        setActiveHub('corredor_brasil_chile');
      }
      setFitNonce((n) => n + 1);
    }
  }, [externalMacroGroup]);

  const allGeoItems = useMemo(() => resolvePartnersWithGeo(partners), [partners]);
  const summary = useMemo(() => computeChileGeoDistribution(allGeoItems), [allGeoItems]);

  const categoryCounts = useMemo(() => {
    const counts: Record<MapCategoryFilter, number> = {
      Todos: 0,
      Imobiliario: 0,
      Juridico: 0,
      Financeiro: 0,
      SaudeEducacao: 0,
      Documental: 0,
    };
    for (const item of allGeoItems) {
      if (onlyChile && !item.isChile) continue;
      counts.Todos += 1;
      if (item.macroGroup in counts) {
        counts[item.macroGroup as MapCategoryFilter] += 1;
      }
    }
    return counts;
  }, [allGeoItems, onlyChile]);

  const visibleItems = useMemo(() => {
    const filtered = allGeoItems.filter((item) => {
      if (onlyChile && !item.isChile) return false;
      if (categoryFilter !== 'Todos' && item.macroGroup !== categoryFilter) return false;
      return true;
    });

    if (userLocation) {
      return [...filtered].sort(
        (a, b) =>
          calculateHaversineKm(userLocation, a.position) -
          calculateHaversineKm(userLocation, b.position),
      );
    }
    return filtered;
  }, [allGeoItems, onlyChile, categoryFilter, userLocation]);

  const selectedItem = useMemo(
    () => visibleItems.find((item) => item.partner.id === selectedPartnerId) || null,
    [visibleItems, selectedPartnerId],
  );

  // Inicializa o mapa Leaflet gratuito (OpenStreetMap / CARTO) sem exigir nenhuma chave de API
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapInstanceRef.current) return;

    const map = L.map(container, {
      center: [-33.421, -70.618],
      zoom: 11,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    map.on('click', () => {
      setSelectedPartnerId(null);
    });

    const markersGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = markersGroup;

    // Garante cálculo correto do viewport após layout/animações e redimensionamentos
    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 200);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    return () => {
      window.clearTimeout(resizeTimer);
      resizeObserver?.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersLayerRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  // Carrega tiles 100% gratuitos do OpenStreetMap (sem chave API) com fallback automático para Esri Street Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const applyThemeFilter = (layer: L.TileLayer) => {
      const containerEl = layer.getContainer();
      if (!containerEl) return;
      containerEl.style.filter = isDark
        ? 'invert(96%) hue-rotate(180deg) brightness(92%) contrast(92%)'
        : 'none';
    };

    let fellBackToEsri = false;
    const osmLayer = L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
      crossOrigin: true,
    });

    osmLayer.on('tileerror', () => {
      if (fellBackToEsri || mapInstanceRef.current !== map) return;
      fellBackToEsri = true;
      map.removeLayer(osmLayer);
      const esriLayer = L.tileLayer(ESRI_FALLBACK_TILE_URL, {
        attribution: ESRI_ATTRIBUTION,
        maxZoom: 19,
      });
      esriLayer.addTo(map);
      applyThemeFilter(esriLayer);
      tileLayerRef.current = esriLayer;
    });

    osmLayer.addTo(map);
    applyThemeFilter(osmLayer);
    tileLayerRef.current = osmLayer;
  }, [isDark]);

  // Atualiza marcadores de parceiros sempre que lista, seleção ou hover mudarem
  useEffect(() => {
    const group = markersLayerRef.current;
    if (!group) return;
    group.clearLayers();

    visibleItems.forEach((item) => {
      const isSelected = selectedPartnerId === item.partner.id;
      const isHovered = hoveredId === item.partner.id;
      const baseZ = Math.round((90 - item.position.lat) * 2);
      const zIndexOffset = isSelected ? 1000 : isHovered ? 900 : baseZ;

      const marker = L.marker([item.position.lat, item.position.lng], {
        icon: createPartnerDivIcon(item, isSelected, isHovered),
        zIndexOffset,
        title: `${item.partner.nome} · ${item.comunaLabel}`,
      });

      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        setSelectedPartnerId(item.partner.id);
      });
      marker.on('mouseover', () => setHoveredId(item.partner.id));
      marker.on('mouseout', () => setHoveredId((prev) => (prev === item.partner.id ? null : prev)));

      marker.addTo(group);
    });
  }, [visibleItems, selectedPartnerId, hoveredId]);

  // Marcador da localização opcional do usuário
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      map.removeLayer(userMarkerRef.current);
      userMarkerRef.current = null;
    }

    if (userLocation) {
      const marker = L.marker([userLocation.lat, userLocation.lng], {
        icon: createUserLocationDivIcon(),
        zIndexOffset: 950,
        title: isEs ? 'Tu ubicación actual' : 'Sua localização atual',
      }).addTo(map);
      userMarkerRef.current = marker;
    }
  }, [userLocation, isEs]);

  // Foco explícito de câmera (clique em polo regional ou parceiro)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !cameraRequest) return;
    map.flyTo([cameraRequest.center.lat, cameraRequest.center.lng], cameraRequest.zoom, {
      duration: 0.65,
    });
  }, [cameraRequest]);

  // Ajuste de enquadramento (fitBounds) ao trocar filtros
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || fitNonce === 0 || visibleItems.length === 0) return;

    if (visibleItems.length === 1) {
      map.flyTo([visibleItems[0].position.lat, visibleItems[0].position.lng], 13, {
        duration: 0.6,
      });
      return;
    }

    const bounds = L.latLngBounds(
      visibleItems.map((item) => [item.position.lat, item.position.lng] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13, animate: true });
  }, [fitNonce, visibleItems]);

  const handleSelectCategory = (cat: MapCategoryFilter) => {
    setCategoryFilter(cat);
    setSelectedPartnerId(null);
    if (cat === 'Documental') {
      setOnlyChile(false);
      setActiveHub('corredor_brasil_chile');
    }
    setFitNonce((n) => n + 1);
  };

  const handleSelectHub = (hub: ChileHubId) => {
    setActiveHub(hub);
    setSelectedPartnerId(null);
    const preset = CHILE_HUB_PRESETS.find((p) => p.id === hub);
    if (hub === 'corredor_brasil_chile') {
      setOnlyChile(false);
    } else {
      setOnlyChile(true);
    }
    if (preset) {
      setCameraRequest({
        center: preset.center,
        zoom: preset.zoom,
        nonce: Date.now(),
      });
    }
  };

  const handleFocusPartner = (item: GeoPartnerItem) => {
    setSelectedPartnerId(item.partner.id);
    setCameraRequest({
      center: item.position,
      zoom: 14,
      nonce: Date.now(),
    });
  };

  const handleToggleUserLocation = () => {
    if (userLocation) {
      setUserLocation(null);
      setLocationError(null);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError(
        isEs
          ? 'Tu navegador no soporta geolocalización.'
          : 'Seu navegador não oferece suporte à geolocalização.',
      );
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        setLocating(false);
        setCameraRequest({ center: coords, zoom: 12, nonce: Date.now() });
      },
      () => {
        setLocating(false);
        setLocationError(
          isEs
            ? 'Permiso de ubicación denegado. Puedes seguir navegando por comunas.'
            : 'Permissão de localização não concedida. Continue navegando pelos polos no Chile.',
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 },
    );
  };

  return (
    <section
      id="mapa-parceiros"
      className="scroll-mt-24 rounded-2xl overflow-hidden bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] shadow-[0_14px_40px_rgba(11,31,51,0.07)] dark:shadow-[0_18px_46px_rgba(0,0,0,0.38)]"
    >
      <BrandRibbon className="h-[3px] w-full" />

      {/* Header & Key Geographic Coverage Metrics */}
      <div className="p-5 sm:p-7 border-b border-[#EFECE3] dark:border-[#1C324B] bg-gradient-to-br from-[#FAF9F6] via-white to-[#F7F5F0] dark:from-[#0B1B2D] dark:via-[#0D1E31] dark:to-[#0A1828]">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <span className="h-[2px] w-6 bg-[#C8A236]" aria-hidden="true" />
              <p className="brand-kicker">
                {isEs
                  ? 'Mapa Georreferenciado · Red de Derivación en Chile'
                  : 'Mapa Georreferenciado · Rede de Indicação no Chile'}
              </p>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] dark:text-white tracking-tight text-balance">
              {isEs
                ? 'Distribución geográfica de servicios inmobiliarios y legales en Chile'
                : 'Distribuição geográfica de parceiros imobiliários e jurídicos no Chile'}
            </h2>
            <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
              {isEs
                ? 'Explora dónde operan nuestros aliados independientes en Santiago y regiones. D&M Integra Chile actúa únicamente en inmigración (Visa y RUT) y sirve como puente de indicación.'
                : 'Explore onde atuam os profissionais independentes indicados em Santiago e regiões. A D&M Integra Chile atua exclusivamente em imigração (Visto e RUT) e serve apenas como ponte de indicação.'}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:gap-6 pt-3 lg:pt-0 border-t lg:border-t-0 border-[#E5DFD2] dark:border-[#1C324B] shrink-0">
            <div>
              <p className="font-mono text-xl sm:text-2xl font-bold text-[#146B43] dark:text-emerald-400 tabular-nums">
                {summary.imobiliarioCount}
              </p>
              <p className="text-[11px] font-medium text-[#4A5A6D] dark:text-slate-400">
                {isEs ? 'Inmobiliarios' : 'Imobiliários'}
              </p>
            </div>
            <div>
              <p className="font-mono text-xl sm:text-2xl font-bold text-[#0B1F33] dark:text-[#E5C76B] tabular-nums">
                {summary.juridicoCount}
              </p>
              <p className="text-[11px] font-medium text-[#4A5A6D] dark:text-slate-400">
                {isEs ? 'Estudios Legales' : 'Jurídicos'}
              </p>
            </div>
            <div>
              <p className="font-mono text-xl sm:text-2xl font-bold text-[#8C6D14] dark:text-white tabular-nums">
                {summary.hubs.length}
              </p>
              <p className="text-[11px] font-medium text-[#4A5A6D] dark:text-slate-400">
                {isEs ? 'Polos en Chile' : 'Polos no Chile'}
              </p>
            </div>
          </div>
        </div>

        {/* Category Filter Bar + Chile/Corridor Scope + Consent Geolocation */}
        <div className="mt-6 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 xl:pb-0">
            {MAP_CATEGORY_TABS.map((tab) => {
              const active = categoryFilter === tab.id;
              const style = PARTNER_PIN_STYLES[tab.id];
              const count = categoryCounts[tab.id] || 0;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleSelectCategory(tab.id)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap shrink-0 tabular-nums border ${
                    active
                      ? 'bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1523] border-[#0B1F33] dark:border-[#C8A236] shadow-xs'
                      : 'bg-white dark:bg-[#11263D] text-[#37475A] dark:text-slate-200 border-[#DDD6C7] dark:border-[#243E5C] hover:border-[#C8A236]/80'
                  }`}
                >
                  {tab.id !== 'Todos' && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/70"
                      style={{ backgroundColor: style.bgHex }}
                      aria-hidden="true"
                    />
                  )}
                  <span>{isEs ? tab.labelEs : tab.labelPt}</span>
                  <span className={active ? 'opacity-80' : 'opacity-60'}>({count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !onlyChile;
                setOnlyChile(next);
                setActiveHub(next ? 'all_chile' : 'corredor_brasil_chile');
                setFitNonce((n) => n + 1);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[#DDD6C7] dark:border-[#243E5C] bg-white dark:bg-[#11263D] text-[#0B1F33] dark:text-slate-200 hover:border-[#C8A236]/80 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe2 className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
              {onlyChile
                ? isEs
                  ? 'Solo Chile · Ver Brasil'
                  : 'Foco Chile · Incluir Brasil'
                : isEs
                  ? 'Brasil + Chile · Filtrar Chile'
                  : 'Brasil + Chile · Focar Chile'}
            </button>

            <button
              type="button"
              onClick={handleToggleUserLocation}
              disabled={locating}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 ${
                userLocation
                  ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-400 text-sky-800 dark:text-sky-200'
                  : 'bg-white dark:bg-[#11263D] border-[#DDD6C7] dark:border-[#243E5C] text-[#0B1F33] dark:text-slate-200 hover:border-[#C8A236]/80'
              }`}
            >
              {locating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : userLocation ? (
                <X className="w-3.5 h-3.5" />
              ) : (
                <Crosshair className="w-3.5 h-3.5 text-[#146B43] dark:text-emerald-400" />
              )}
              {userLocation
                ? isEs
                  ? 'Quitar mi ubicación'
                  : 'Ocultar minha posição'
                : isEs
                  ? 'Cerca de mí'
                  : 'Minha localização'}
            </button>
          </div>
        </div>

        {/* Regional Hub Focus Controls */}
        <div className="mt-3.5 pt-3.5 border-t border-[#EFECE3] dark:border-[#1C324B] flex items-center gap-2 overflow-x-auto">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[#8C6D14] dark:text-[#E5C76B] whitespace-nowrap shrink-0 pr-1">
            <Compass className="w-3.5 h-3.5" />
            {isEs ? 'Enfocar zona:' : 'Focar região:'}
          </span>
          {CHILE_HUB_PRESETS.map((preset) => {
            const active = activeHub === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectHub(preset.id)}
                className={`px-3 py-1.5 rounded-md text-[11.5px] font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-[#F1EDE4] dark:bg-[#173352] text-[#0B1F33] dark:text-[#E5C76B] border border-[#C8A236]/60'
                    : 'text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white hover:bg-[#F7F5F0] dark:hover:bg-[#11263D] border border-transparent'
                }`}
              >
                {isEs ? preset.labelEs : preset.labelPt}
              </button>
            );
          })}
        </div>

        {locationError && (
          <p className="mt-2.5 text-xs text-amber-800 dark:text-amber-300">{locationError}</p>
        )}
      </div>

      {/* Main Split View: Synchronized Partner List + Free Interactive OpenStreetMap / CARTO Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Side: Synchronized Georeferenced Partner List */}
        <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-[#EFECE3] dark:border-[#1C324B] flex flex-col max-h-[420px] lg:max-h-[560px]">
          <div className="px-4 sm:px-5 py-3 bg-[#FAF9F6] dark:bg-[#0A1828] border-b border-[#EFECE3] dark:border-[#1C324B] flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0B1F33] dark:text-slate-100 tabular-nums">
              {isEs
                ? `${visibleItems.length} servicio(s) en el mapa`
                : `${visibleItems.length} serviço(s) exibido(s) no mapa`}
            </span>
            <span className="text-[11px] text-[#4A5A6D] dark:text-slate-400">
              {userLocation
                ? isEs
                  ? 'Ordenado por cercanía'
                  : 'Ordenado por distância'
                : isEs
                  ? 'Haz clic para enfocar'
                  : 'Clique para centralizar'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#F1EDE4] dark:divide-[#172C44]">
            {visibleItems.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MapPin className="w-6 h-6 text-[#8C6D14] dark:text-[#E5C76B] mx-auto opacity-70" />
                <p className="text-sm font-semibold text-[#0B1F33] dark:text-white">
                  {isEs
                    ? 'Ningún aliado encontrado para esta combinación.'
                    : 'Nenhum parceiro encontrado para este recorte.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('Todos');
                    setOnlyChile(false);
                    setFitNonce((n) => n + 1);
                  }}
                  className="text-xs font-semibold text-[#8C6D14] dark:text-[#E5C76B] hover:underline"
                >
                  {isEs ? 'Mostrar todos los aliados' : 'Exibir todos os parceiros'}
                </button>
              </div>
            ) : (
              visibleItems.map((item) => {
                const isSelected = selectedPartnerId === item.partner.id;
                const Icon = getPinIcon(item.macroGroup);
                const distanceKm = userLocation
                  ? calculateHaversineKm(userLocation, item.position)
                  : null;

                return (
                  <div
                    key={item.partner.id}
                    onMouseEnter={() => setHoveredId(item.partner.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`p-4 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#F7F4EC] dark:bg-[#132B45]'
                        : 'hover:bg-[#FAF9F6] dark:hover:bg-[#10243A]'
                    }`}
                    onClick={() => handleFocusPartner(item)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border"
                        style={{
                          backgroundColor: item.pinStyle.bgHex,
                          borderColor: item.pinStyle.borderHex,
                          color: item.pinStyle.textHex,
                        }}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#8C6D14] dark:text-[#E5C76B] truncate">
                            {isEs ? item.pinStyle.badgeLabelEs : item.pinStyle.badgeLabelPt} ·{' '}
                            {item.comunaLabel}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-mono font-bold text-[#0B1F33] dark:text-slate-200 tabular-nums shrink-0">
                            <Star className="w-3 h-3 fill-[#C8A236] text-[#C8A236]" />
                            {Number(item.partner.avaliacao || 5).toFixed(1)}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-[#0B1F33] dark:text-white leading-snug">
                          {item.partner.nome}
                        </h3>

                        <p className="text-xs text-[#4A5A6D] dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {item.partner.descricaoPublica}
                        </p>

                        <div className="pt-1.5 flex items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 text-[#4A5A6D] dark:text-slate-400 truncate">
                            <Navigation className="w-3 h-3 shrink-0 opacity-70" />
                            <span className="truncate">{item.regionLabel}</span>
                            {distanceKm !== null && (
                              <span className="font-mono font-semibold text-sky-700 dark:text-sky-300 tabular-nums shrink-0">
                                · {distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km
                              </span>
                            )}
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPartner(item.partner);
                            }}
                            className="font-semibold text-[#0B1F33] dark:text-[#E5C76B] hover:underline whitespace-nowrap shrink-0"
                          >
                            {isEs ? 'Ficha →' : 'Detalhes →'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: 100% Free Interactive Leaflet + OpenStreetMap / CARTO Map Canvas */}
        <div className="lg:col-span-7 relative w-full h-[440px] sm:h-[520px] lg:h-[560px] bg-[#EEF2F6] dark:bg-[#0A192A]">
          <div
            ref={mapContainerRef}
            aria-label={isEs ? 'Mapa interactivo de aliados en Chile' : 'Mapa interativo de parceiros no Chile'}
            className="w-full h-full z-0"
          />

          {/* Interactive Selected Partner Detail Card Overlay */}
          {selectedItem && (
            <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:w-[330px] z-[500] rounded-xl bg-white/98 dark:bg-[#0D1E31]/98 backdrop-blur-md border border-[#E5DFD2] dark:border-[#243E5C] shadow-[0_18px_42px_rgba(7,14,28,0.28)] p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 min-w-0">
                  {sanitizePartnerImageUrl(selectedItem.partner.logoUrl) ? (
                    <div className="w-10 h-10 rounded-lg border border-[#E5DFD2] bg-white flex items-center justify-center overflow-hidden shrink-0">
                      <OptimizedImage
                        src={sanitizePartnerImageUrl(selectedItem.partner.logoUrl)!}
                        alt={selectedItem.partner.nome}
                        sizes="40px"
                        containerClassName="relative w-full h-full flex items-center justify-center bg-white"
                        className="max-w-full max-h-full object-contain p-1"
                      />
                    </div>
                  ) : (
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: selectedItem.pinStyle.bgHex,
                        color: selectedItem.pinStyle.textHex,
                      }}
                    >
                      {React.createElement(getPinIcon(selectedItem.macroGroup), {
                        className: 'w-4 h-4',
                      })}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[#8C6D14] dark:text-[#E5C76B] truncate">
                      {translatePartnerCategory(selectedItem.partner.categoria, locale)}
                    </p>
                    <h4 className="text-sm font-bold text-[#0B1F33] dark:text-white leading-snug">
                      {selectedItem.partner.nome}
                    </h4>
                    <p className="text-[11px] text-[#4A5A6D] dark:text-slate-300 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 shrink-0 text-[#8C6D14] dark:text-[#E5C76B]" />
                      <span className="truncate">
                        {selectedItem.comunaLabel} · {selectedItem.regionLabel}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPartnerId(null)}
                  aria-label="Fechar detalhes do parceiro"
                  className="p-1 rounded-md text-[#4A5A6D] dark:text-slate-400 hover:bg-[#F7F5F0] dark:hover:bg-[#173352]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-[#37475A] dark:text-slate-300 leading-relaxed line-clamp-3">
                {selectedItem.partner.descricaoPublica}
              </p>

              <div className="flex items-center justify-between text-[11px] text-[#4A5A6D] dark:text-slate-400 pt-1 border-t border-[#EFECE3] dark:border-[#1C324B]">
                <span className="inline-flex items-center gap-1 font-mono font-bold text-[#0B1F33] dark:text-white tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                  {Number(selectedItem.partner.avaliacao || 5).toFixed(1)}/5
                </span>
                <span>{translatePartnerCountry(selectedItem.partner.pais, locale)}</span>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                {selectedItem.partner.whatsapp && (
                  <a
                    href={buildWhatsAppUrl(
                      selectedItem.partner.whatsapp,
                      buildReferralMessage(selectedItem.partner),
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#146B43] hover:bg-[#0F5434] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    WhatsApp
                  </a>
                )}
                <a
                  href={`https://www.openstreetmap.org/?mlat=${selectedItem.position.lat}&mlon=${selectedItem.position.lng}#map=15/${selectedItem.position.lat}/${selectedItem.position.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={isEs ? 'Abrir ubicación en OpenStreetMap' : 'Abrir localização no mapa externo'}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] text-[#0B1F33] dark:text-slate-200 hover:bg-[#F7F5F0] dark:hover:bg-[#173352] text-xs font-semibold whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {isEs ? 'Mapa' : 'Mapa'}
                </a>
                <button
                  type="button"
                  onClick={() => onSelectPartner(selectedItem.partner)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B1F33] dark:bg-[#C8A236] hover:opacity-95 text-white dark:text-[#0B1523] text-xs font-semibold transition-opacity whitespace-nowrap"
                >
                  {isEs ? 'Ver ficha' : 'Ver ficha'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Geographic Coverage Summary Strip + Free OpenStreetMap Attribution */}
      <div className="px-5 sm:px-7 py-3.5 bg-[#FAF9F6] dark:bg-[#0A1828] border-t border-[#EFECE3] dark:border-[#1C324B] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[#4A5A6D] dark:text-slate-300">
          <span className="font-bold text-[#0B1F33] dark:text-white">
            {isEs ? 'Polos activos en Chile:' : 'Polos ativos no Chile:'}
          </span>
          {summary.hubs.map((hub) => (
            <span key={hub.comuna} className="inline-flex items-center gap-1 tabular-nums">
              <span className="text-[#8C6D14] dark:text-[#E5C76B]" aria-hidden="true">
                ·
              </span>
              <span>{hub.comuna}</span>
              <span className="text-[11px] opacity-70">({hub.count})</span>
            </span>
          ))}
        </div>
        <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 leading-relaxed">
          {isEs
            ? 'Mapa interactivo gratuito vía OpenStreetMap (sin clave API ni costos · ubicación opcional y revocable).'
            : 'Mapa interativo gratuito via OpenStreetMap (acesso aberto sem chave paga · geolocalização opcional e revogável).'}
        </p>
      </div>
    </section>
  );
};
