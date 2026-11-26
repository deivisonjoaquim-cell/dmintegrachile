import React, { useEffect, useState } from 'react';
import { BRAND_ASSETS, isLegacyOrBrokenBrandUrl } from '../constants/brandAssets';
import { getBrandWebpUrl } from '../utils/imageOptimization';

export interface BrandLogoProps {
  src?: string | null;
  alt: string;
  brandShortName?: string;
  variant?: 'default' | 'light' | 'dark' | 'emblem' | 'emblem-dark' | 'wordmark';
  className?: string;
  style?: React.CSSProperties;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  fallbackClassName?: string;
  fallbackNode?: React.ReactNode;
  hideFallback?: boolean;
  /** Set true for above-the-fold header logo (eager + high fetchPriority) */
  priority?: boolean;
  /** Set true for below-the-fold footer/closing logos (native lazy + low fetchPriority) */
  lazy?: boolean;
}

export const BrandRibbon: React.FC<{ className?: string }> = ({ className = 'h-px w-full' }) => (
  <div
    aria-hidden="true"
    className={`bg-[#E5E7EB] dark:bg-[#1E293B] ${className}`}
  />
);

export function shouldUseInstitutionalMark(rawUrl?: string | null): boolean {
  if (isLegacyOrBrokenBrandUrl(rawUrl)) return true;
  const trimmed = String(rawUrl || '').trim();
  const bundledAssets: string[] = Object.values(BRAND_ASSETS);
  return bundledAssets.includes(trimmed) || trimmed.includes('logo-dm-integra');
}

export interface InstitutionalBrandMarkProps {
  tone?: 'auto' | 'light' | 'dark';
  size?: 'header' | 'footer';
  className?: string;
}

/**
 * High-fidelity institutional brand lockup (vector crest + single-line architectural wordmark).
 * Renders razor-sharp at any DPI and honors both light and dark corporate palettes.
 */
export const InstitutionalBrandMark: React.FC<InstitutionalBrandMarkProps> = ({
  tone = 'auto',
  size = 'header',
  className = '',
}) => {
  const isFooter = size === 'footer';
  const crestSize = isFooter ? 'w-10 h-10' : 'w-8 h-8 lg:w-9 lg:h-9';

  const frameClass =
    tone === 'dark'
      ? 'bg-[#101C33] border-[#C9A86A]/45'
      : tone === 'light'
        ? 'bg-[#0B1628] border-[#1E355E]'
        : 'bg-[#0B1628] dark:bg-[#101C33] border-[#1E355E] dark:border-[#C9A86A]/45';

  const dividerClass =
    tone === 'dark'
      ? 'bg-white/20'
      : tone === 'light'
        ? 'bg-[#D1D5DB]'
        : 'bg-[#D1D5DB] dark:bg-slate-700';

  const primaryTextClass =
    tone === 'dark'
      ? 'text-white'
      : tone === 'light'
        ? 'text-[#0B1628]'
        : 'text-[#0B1628] dark:text-white';

  const secondaryTextClass =
    tone === 'dark'
      ? 'text-slate-300'
      : tone === 'light'
        ? 'text-[#334155]'
        : 'text-[#334155] dark:text-slate-300';

  return (
    <span
      data-testid={isFooter ? 'institutional-brand-footer' : 'institutional-brand-header'}
      className={`inline-flex items-center gap-3 select-none whitespace-nowrap shrink-0 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-[8px] border shrink-0 transition-colors ${crestSize} ${frameClass}`}
      >
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-[22px] h-[22px] lg:w-[24px] lg:h-[24px]"
        >
          {/* Moldura arquitetônica sutil */}
          <rect
            x="2.25"
            y="2.25"
            width="31.5"
            height="31.5"
            rx="5.25"
            stroke="#C9A86A"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          {/* Geometria da Cordilheira / Ponte Brasil-Chile */}
          <path
            d="M7.5 25.5L14.25 11.25L18.5 19.25L22.25 13L28.5 25.5"
            stroke="#FFFFFF"
            strokeWidth="2.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Pedra angular dourada de precisão */}
          <path
            d="M14.25 11.25L18.5 19.25L20.35 16.15"
            stroke="#C9A86A"
            strokeWidth="2.15"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Base institucional contínua */}
          <path
            d="M8.5 28.25H27.5"
            stroke="#60A5FA"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </span>

      <span aria-hidden="true" className={`hidden sm:inline-block h-5 w-px shrink-0 ${dividerClass}`} />

      <span className="inline-flex items-baseline gap-2 leading-none">
        <span
          className={`font-display font-extrabold tracking-[-0.03em] ${
            isFooter ? 'text-[19px]' : 'text-[16.5px] lg:text-[18px]'
          } ${primaryTextClass}`}
        >
          D&amp;M
        </span>
        <span
          className={`font-brand-sans font-semibold uppercase tracking-[0.17em] ${
            isFooter ? 'text-[11px]' : 'text-[10.5px] lg:text-[11px]'
          } ${secondaryTextClass}`}
        >
          Integra Chile
        </span>
      </span>
    </span>
  );
};

/**
 * Renders the official D&M Integra Chile logo with automatic WebP delivery (<picture>)
 * and multi-stage recovery:
 * 1) Configured URL (auto-upgraded to crisp WebP when matching official raster assets)
 * 2) Official uploaded PNG/SVG matching the requested surface variant (`light`, `dark`, `emblem`, `emblem-dark`)
 * 3) Secondary official SVG/PNG backup so the logo never disappears on any route or theme
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  src,
  alt,
  variant = 'default',
  className,
  style,
  imgClassName,
  imgStyle,
  fallbackNode,
  hideFallback = false,
  priority = false,
  lazy = false,
}) => {
  const isDarkVariant = variant === 'dark' || variant === 'emblem-dark';
  const isEmblemVariant = variant === 'emblem' || variant === 'emblem-dark';

  const primaryOfficialAsset: string = isEmblemVariant
    ? isDarkVariant
      ? BRAND_ASSETS.emblemDarkSvg
      : BRAND_ASSETS.emblemLightSvg
    : isDarkVariant
      ? BRAND_ASSETS.logoDarkPng
      : BRAND_ASSETS.logoLightPng;

  const secondaryOfficialAsset: string = isEmblemVariant
    ? isDarkVariant
      ? BRAND_ASSETS.emblemDarkPng
      : BRAND_ASSETS.emblemLightPng
    : isDarkVariant
      ? BRAND_ASSETS.logoDarkSvg
      : BRAND_ASSETS.logoLightSvg;

  const cleanSrc = typeof src === 'string' ? src.trim() : '';

  const shouldUseOfficialForSlot =
    isLegacyOrBrokenBrandUrl(cleanSrc) ||
    (variant === 'emblem-dark' &&
      (cleanSrc === BRAND_ASSETS.emblemLightSvg ||
        cleanSrc === BRAND_ASSETS.emblemLightPng ||
        cleanSrc.includes('completa'))) ||
    (variant === 'emblem' && cleanSrc.includes('completa')) ||
    (variant === 'dark' &&
      (cleanSrc === BRAND_ASSETS.logoLightPng || cleanSrc === BRAND_ASSETS.logoLightSvg));

  const initialSrc = shouldUseOfficialForSlot ? primaryOfficialAsset : cleanSrc;

  // 0 = configured custom src, 1 = primary official asset, 2 = secondary official asset, 3 = fallback
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(initialSrc === primaryOfficialAsset ? 1 : 0);

  useEffect(() => {
    setStage(initialSrc === primaryOfficialAsset ? 1 : 0);
  }, [initialSrc, primaryOfficialAsset]);

  const resolvedClass =
    imgClassName ||
    className ||
    (isEmblemVariant
      ? 'h-9 w-9 object-contain shrink-0'
      : 'h-10 w-auto max-w-[220px] object-contain shrink-0');
  const resolvedStyle = imgStyle || style;

  const activeSrc =
    stage === 0
      ? initialSrc
      : stage === 1
        ? primaryOfficialAsset
        : stage === 2
          ? secondaryOfficialAsset
          : '';

  if (activeSrc && stage < 3) {
    const webpSrc = getBrandWebpUrl(activeSrc);
    const loadingAttr: 'eager' | 'lazy' = 'eager';
    const fetchPriorityAttr: 'high' | 'low' | 'auto' = priority ? 'high' : lazy ? 'low' : 'auto';

    const imgEl = (
      <img
        src={activeSrc}
        alt={alt}
        loading={loadingAttr}
        decoding="async"
        fetchPriority={fetchPriorityAttr}
        referrerPolicy="no-referrer"
        style={resolvedStyle}
        className={resolvedClass}
        onError={() => {
          setStage((prev) => {
            if (prev === 0 && initialSrc !== primaryOfficialAsset) return 1;
            if (prev <= 1 && primaryOfficialAsset !== secondaryOfficialAsset) return 2;
            return 3;
          });
        }}
      />
    );

    if (webpSrc && webpSrc !== activeSrc) {
      return (
        <picture className="inline-flex items-center shrink-0">
          <source type="image/webp" srcSet={webpSrc} />
          {imgEl}
        </picture>
      );
    }

    return imgEl;
  }

  if (hideFallback) {
    return null;
  }

  if (fallbackNode) {
    return <>{fallbackNode}</>;
  }

  return (
    <span className="inline-flex items-center font-bold tracking-tight text-sm text-[var(--color-primary,#0B1F33)]">
      {alt}
    </span>
  );
};
