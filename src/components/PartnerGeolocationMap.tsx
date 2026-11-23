/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdvancedMarker,
  APILoadingStatus,
  APIProvider,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  AlertTriangle,
  Building2,
  Compass,
  Crosshair,
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

const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
const GMP_ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];

export interface PartnerGeolocationMapProps {
  partners: PartnerPublic[];
  locale: 'pt-BR' | 'es-CL';
  externalMacroGroup?: PartnerMacroGroupId;
  onSelectPartner: (partner: PartnerPublic) => void;
  buildReferralMessage: (partner: PartnerPublic) => string;
}

type MapCategoryFilter = 'Todos' | 'Imobiliario' | 'Juridico' | 'Financeiro' | 'SaudeEducacao' | 'Documental';

const MAP_CATEGORY_TABS: { id: MapCategoryFilter; labelPt: string; labelEs: string }[] = [
  { id: 'Todos', labelPt: 'Todos no Mapa', labelEs: 'Todos en el Mapa' },
  { id: 'Imobiliario', labelPt: 'Imobiliário', labelEs: 'Inmobiliario' },
  { id: 'Juridico', labelPt: 'Jurídico', labelEs: 'Legal / Jurídico' },
  { id: 'Financeiro', labelPt: 'Financeiro & SpA', labelEs: 'Financiero y SpA' },
  { id: 'SaudeEducacao', labelPt: 'Saúde & Família', labelEs: 'Salud y Familia' },
  { id: 'Documental', labelPt: 'Documental (BR)', labelEs: 'Documental (BR)' },
];

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

interface PartnerMarkerPinProps {
  item: GeoPartnerItem;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: (item: GeoPartnerItem, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
  onHover: (partnerId: string | null) => void;
  onMarkerReady: (partnerId: string, marker: google.maps.marker.AdvancedMarkerElement | null) => void;
}

const PartnerMarkerPin: React.FC<PartnerMarkerPinProps> = ({
  item,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onMarkerReady,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const Icon = getPinIcon(item.macroGroup);

  useEffect(() => {
    onMarkerReady(item.partner.id, marker);
    return () => onMarkerReady(item.partner.id, null);
  }, [item.partner.id, marker, onMarkerReady]);

  // South-to-north base z-index + priority boost on hover/select
  const baseZ = Math.round((90 - item.position.lat) * 2);
  const zIndex = isSelected ? 1000 : isHovered ? 900 : baseZ;

  return (
    <AdvancedMarker
      ref={markerRef}
      position={item.position}
      zIndex={zIndex}
      title={`${item.partner.nome} · ${item.comunaLabel}`}
      onClick={() => onSelect(item, marker)}
    >
      <div
        onMouseEnter={() => onHover(item.partner.id)}
        onMouseLeave={() => onHover(null)}
        className={`group relative flex flex-col items-center cursor-pointer transition-transform duration-150 ${
          isSelected ? 'scale-115' : isHovered ? 'scale-110' : 'hover:scale-105'
        }`}
      >
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 shadow-[0_6px_18px_rgba(11,31,51,0.32)]"
          style={{
            backgroundColor: item.pinStyle.bgHex,
            borderColor: isSelected ? '#FFFFFF' : item.pinStyle.borderHex,
            color: item.pinStyle.textHex,
          }}
        >
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] font-bold tracking-tight whitespace-nowrap max-w-[122px] truncate">
            {item.comunaLabel}
          </span>
        </div>
        <div
          className="w-2.5 h-2.5 -mt-1.5 rotate-45 border-r-2 border-b-2"
          style={{
            backgroundColor: item.pinStyle.bgHex,
            borderColor: isSelected ? '#FFFFFF' : item.pinStyle.borderHex,
          }}
        />
      </div>
    </AdvancedMarker>
  );
};

interface MapCameraControllerProps {
  hubPreset: ChileHubId;
  cameraRequest: { center: LatLngLiteral; zoom: number; nonce: number } | null;
  visibleItems: GeoPartnerItem[];
  fitNonce: number;
}

const MapCameraController: React.FC<MapCameraControllerProps> = ({
  hubPreset,
  cameraRequest,
  visibleItems,
  fitNonce,
}) => {
  const map = useMap();

  // Explicit camera focus (when clicking a partner or hub preset)
  useEffect(() => {
    if (!map || !cameraRequest) return;
    map.panTo(cameraRequest.center);
    map.setZoom(cameraRequest.zoom);
  }, [map, cameraRequest]);

  // Fit bounds smoothly when category filter changes (except Brasil-Chile wide mode handled by hub)
  useEffect(() => {
    if (!map || fitNonce === 0 || visibleItems.length === 0) return;
    if (visibleItems.length === 1) {
      map.panTo(visibleItems[0].position);
      map.setZoom(14);
      return;
    }
    if (typeof google === 'undefined' || !google.maps?.LatLngBounds) return;
    const bounds = new google.maps.LatLngBounds();
    visibleItems.forEach((item) => bounds.extend(item.position));
    map.fitBounds(bounds, { top: 56, right: 48, bottom: 56, left: 48 });
    const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
      const currentZoom = map.getZoom();
      if (typeof currentZoom === 'number' && currentZoom > 14) {
        map.setZoom(14);
      }
    });
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, fitNonce, visibleItems, hubPreset]);

  return null;
};

interface MapsCanvasInnerProps {
  isEs: boolean;
  locale: 'pt-BR' | 'es-CL';
  visibleItems: GeoPartnerItem[];
  selectedItem: GeoPartnerItem | null;
  hoveredId: string | null;
  userLocation: LatLngLiteral | null;
  hubPreset: ChileHubId;
  cameraRequest: { center: LatLngLiteral; zoom: number; nonce: number } | null;
  fitNonce: number;
  onSelectItem: (item: GeoPartnerItem | null) => void;
  onHoverId: (id: string | null) => void;
  onOpenPartnerModal: (partner: PartnerPublic) => void;
  buildReferralMessage: (partner: PartnerPublic) => string;
}

const MapsCanvasInner: React.FC<MapsCanvasInnerProps> = ({
  isEs,
  locale,
  visibleItems,
  selectedItem,
  hoveredId,
  userLocation,
  hubPreset,
  cameraRequest,
  fitNonce,
  onSelectItem,
  onHoverId,
  onOpenPartnerModal,
  buildReferralMessage,
}) => {
  const apiStatus = useApiLoadingStatus();
  const markerInstancesRef = useRef<Record<string, google.maps.marker.AdvancedMarkerElement | null>>({});
  const [selectedAnchor, setSelectedAnchor] = useState<google.maps.marker.AdvancedMarkerElement | null>(null);

  const handleMarkerReady = useCallback(
    (partnerId: string, marker: google.maps.marker.AdvancedMarkerElement | null) => {
      markerInstancesRef.current[partnerId] = marker;
      if (selectedItem && selectedItem.partner.id === partnerId) {
        setSelectedAnchor(marker);
      }
    },
    [selectedItem],
  );

  useEffect(() => {
    if (!selectedItem) {
      setSelectedAnchor(null);
      return;
    }
    setSelectedAnchor(markerInstancesRef.current[selectedItem.partner.id] || null);
  }, [selectedItem]);

  if (apiStatus === APILoadingStatus.AUTH_FAILURE || apiStatus === APILoadingStatus.FAILED) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#F7F5F0] dark:bg-[#0A192A]">
        <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/60 flex items-center justify-center text-amber-800 dark:text-amber-300 mb-3">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-bold text-[#0B1F33] dark:text-white">
          {isEs ? 'Mapa interactivo temporalmente indisponible' : 'Mapa interativo temporariamente indisponível'}
        </h4>
        <p className="text-xs text-[#4A5A6D] dark:text-slate-300 max-w-sm mt-1.5 leading-relaxed">
          {isEs
            ? 'No fue posible autenticar Google Maps en este momento. Puedes seguir explorando los aliados geolocalizados en la lista lateral.'
            : 'Não foi possível autenticar o Google Maps neste momento. Você pode continuar explorando todos os parceiros por comuna na lista ao lado.'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {apiStatus === APILoadingStatus.LOADING && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#F7F5F0]/90 dark:bg-[#0A192A]/90 backdrop-blur-xs">
          <Loader2 className="w-6 h-6 animate-spin text-[#8C6D14] dark:text-[#E5C76B] mb-2" />
          <p className="text-xs font-semibold text-[#0B1F33] dark:text-slate-200">
            {isEs ? 'Cargando mapa de cobertura en Chile...' : 'Carregando mapa de cobertura no Chile...'}
          </p>
        </div>
      )}

      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={{ lat: -33.421, lng: -70.618 }}
        defaultZoom={11}
        gestureHandling="cooperative"
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl
        zoomControl
        internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
        onClick={() => onSelectItem(null)}
        className="w-full h-full"
      >
        <MapCameraController
          hubPreset={hubPreset}
          cameraRequest={cameraRequest}
          visibleItems={visibleItems}
          fitNonce={fitNonce}
        />

        {visibleItems.map((item) => (
          <PartnerMarkerPin
            key={item.partner.id}
            item={item}
            isSelected={selectedItem?.partner.id === item.partner.id}
            isHovered={hoveredId === item.partner.id}
            onSelect={(clickedItem, marker) => {
              onSelectItem(clickedItem);
              setSelectedAnchor(marker);
            }}
            onHover={onHoverId}
            onMarkerReady={handleMarkerReady}
          />
        ))}

        {userLocation && (
          <AdvancedMarker
            position={userLocation}
            zIndex={950}
            title={isEs ? 'Tu ubicación actual' : 'Sua localização atual'}
          >
            <div className="relative flex items-center justify-center">
              <span className="w-6 h-6 rounded-full bg-sky-500/25 border border-sky-400/70 flex items-center justify-center">
                <span className="w-3 h-3 rounded-full bg-sky-600 border-2 border-white shadow-md" />
              </span>
            </div>
          </AdvancedMarker>
        )}

        {selectedItem && selectedAnchor && (
          <InfoWindow
            anchor={selectedAnchor}
            pixelOffset={[0, -6]}
            onCloseClick={() => onSelectItem(null)}
            maxWidth={310}
          >
            <div className="p-1 text-[#0B1F33] font-brand-sans space-y-2.5">
              <div className="flex items-start gap-2.5">
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
                    {React.createElement(getPinIcon(selectedItem.macroGroup), { className: 'w-4 h-4' })}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8C6D14] truncate">
                    {translatePartnerCategory(selectedItem.partner.categoria, locale)}
                  </p>
                  <h4 className="text-sm font-bold text-[#0B1F33] leading-snug">
                    {selectedItem.partner.nome}
                  </h4>
                  <p className="text-[11px] text-[#4A5A6D] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0 text-[#8C6D14]" />
                    <span className="truncate">
                      {selectedItem.comunaLabel} · {selectedItem.regionLabel}
                    </span>
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#37475A] leading-relaxed line-clamp-3">
                {selectedItem.partner.descricaoPublica}
              </p>

              <div className="flex items-center justify-between text-[11px] text-[#4A5A6D] pt-1 border-t border-[#EFECE3]">
                <span className="inline-flex items-center gap-1 font-mono font-bold text-[#0B1F33] tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                  {Number(selectedItem.partner.avaliacao || 5).toFixed(1)}/5
                </span>
                <span>{translatePartnerCountry(selectedItem.partner.pais, locale)}</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
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
                <button
                  type="button"
                  onClick={() => onOpenPartnerModal(selectedItem.partner)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B1F33] hover:bg-[#153553] text-white text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  {isEs ? 'Ver ficha' : 'Ver ficha'}
                </button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
};

export const PartnerGeolocationMap: React.FC<PartnerGeolocationMapProps> = ({
  partners,
  locale,
  externalMacroGroup,
  onSelectPartner,
  buildReferralMessage,
}) => {
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

  // User-initiated consent-based geolocation (ToS revocable consent compliant)
  const [userLocation, setUserLocation] = useState<LatLngLiteral | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Sync when user selects a top macro category pill on ParceirosPage
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
      // Revocable consent: clear immediately on user click
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
                  ? 'Mapa Georreferenciado · Fijación en Chile'
                  : 'Mapa Georreferenciado · Fixação no Chile'}
              </p>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] dark:text-white tracking-tight text-balance">
              {isEs
                ? 'Distribución geográfica de servicios inmobiliarios y legales en Chile'
                : 'Distribuição geográfica de serviços imobiliários e jurídicos no Chile'}
            </h2>
            <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
              {isEs
                ? 'Explora dónde operan nuestros aliados homologados en Santiago y regiones para planificar tu vivienda, asesoría jurídica, apertura SpA y salud.'
                : 'Explore onde atuam nossos parceiros homologados em Santiago e regiões para planejar moradia, respaldo jurídico, abertura de SpA e adaptação familiar.'}
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

      {/* Main Split View: Synchronized Partner List + Interactive Google Map */}
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

        {/* Right Side: Interactive Google Maps Canvas (explicit height prevents CF2 collapse) */}
        <div className="lg:col-span-7 relative w-full h-[440px] sm:h-[520px] lg:h-[560px] bg-[#EEF2F6] dark:bg-[#0A192A]">
          {MAPS_API_KEY ? (
            <APIProvider
              apiKey={MAPS_API_KEY}
              libraries={['marker']}
              language={isEs ? 'es' : 'pt-BR'}
              region="CL"
            >
              <MapsCanvasInner
                isEs={isEs}
                locale={locale}
                visibleItems={visibleItems}
                selectedItem={selectedItem}
                hoveredId={hoveredId}
                userLocation={userLocation}
                hubPreset={activeHub}
                cameraRequest={cameraRequest}
                fitNonce={fitNonce}
                onSelectItem={(item) => setSelectedPartnerId(item ? item.partner.id : null)}
                onHoverId={setHoveredId}
                onOpenPartnerModal={onSelectPartner}
                buildReferralMessage={buildReferralMessage}
              />
            </APIProvider>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#F7F5F0] dark:bg-[#0A192A]">
              <div className="w-12 h-12 rounded-xl bg-[#0B1F33] text-[#E5C76B] flex items-center justify-center mb-3">
                <MapPin className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-[#0B1F33] dark:text-white">
                {isEs ? 'Configurando clave de Google Maps' : 'Chave do Google Maps não configurada'}
              </h4>
              <p className="text-xs text-[#4A5A6D] dark:text-slate-300 max-w-md mt-1.5 leading-relaxed">
                {isEs
                  ? 'Define VITE_GOOGLE_MAPS_API_KEY en el entorno para activar el mapa interactivo de aliados en Chile.'
                  : 'Defina VITE_GOOGLE_MAPS_API_KEY no ambiente para renderizar o mapa interativo de parceiros no Chile.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Geographic Coverage Summary Strip */}
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
        <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400">
          {isEs
            ? 'Coordenadas de referencia de la red homologada D&M Integra Chile'
            : 'Coordenadas de referência dos polos da rede homologada D&M Integra Chile'}
        </p>
      </div>
    </section>
  );
};
