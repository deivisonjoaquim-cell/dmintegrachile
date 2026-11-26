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
