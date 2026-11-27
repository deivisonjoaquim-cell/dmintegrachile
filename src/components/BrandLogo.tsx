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
  size?: 'compact' | 'header' | 'footer';
  showSubtitle?: boolean;
  className?: string;
}

/**
 * High-fidelity institutional brand lockup combining the official uploaded
 * D&M Integra Chile vector emblem (light/dark) with the site's refined
 * enterprise typography and spacing.
 */
export const InstitutionalBrandMark: React.FC<InstitutionalBrandMarkProps> = ({
  tone = 'auto',
  size = 'header',
  showSubtitle = true,
  className = '',
}) => {
  const isFooter = size === 'footer';
  const isCompact = size === 'compact';

  const emblemSizeClass = isFooter
    ? 'w-12 h-12'
    : isCompact
      ? 'w-9 h-9'
      : 'w-9 h-9 lg:w-11 lg:h-11';

  const dividerHeightClass = isFooter
    ? 'h-8'
    : isCompact
      ? 'h-6'
      : 'h-6 lg:h-7';

  const dividerClass =
    tone === 'dark'
      ? 'bg-white/15'
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
      ? 'text-slate-200'
      : tone === 'light'
        ? 'text-[#1E293B]'
        : 'text-[#1E293B] dark:text-slate-200';

  const chileAccentClass =
    tone === 'dark'
      ? 'text-[#34D399]'
      : tone === 'light'
        ? 'text-[#0F5D3A]'
        : 'text-[#0F5D3A] dark:text-[#34D399]';

  const subtitleClass =
    tone === 'dark'
      ? 'text-[#D4B673]'
      : tone === 'light'
        ? 'text-[#8C6D14]'
        : 'text-[#8C6D14] dark:text-[#D4B673]';

  const dmSizeClass = isFooter
    ? 'text-[19px]'
    : isCompact
      ? 'text-[15px]'
      : 'text-[16.5px] lg:text-[18.5px]';

  const integraSizeClass = isFooter
    ? 'text-[11.5px]'
    : isCompact
      ? 'text-[9.5px]'
      : 'text-[10.5px] lg:text-[11.5px]';

  const subtitleSizeClass = isFooter
    ? 'text-[9px]'
    : isCompact
      ? 'text-[7.5px]'
      : 'text-[8px] lg:text-[8.5px]';

  const handleEmblemFallback = (fallbackUrl: string) => (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.dataset.fallbackApplied === '1') return;
    img.dataset.fallbackApplied = '1';
    img.src = fallbackUrl;
  };

  return (
    <span
      data-testid={
        isFooter
          ? 'institutional-brand-footer'
          : isCompact
            ? 'institutional-brand-compact'
            : 'institutional-brand-header'
      }
      className={`inline-flex items-center ${isCompact ? 'gap-2.5' : 'gap-3'} select-none whitespace-nowrap shrink-0 ${className}`}
    >
      <span className={`relative inline-flex items-center justify-center shrink-0 ${emblemSizeClass}`}>
        {tone === 'dark' ? (
          <img
            src={BRAND_ASSETS.emblemDarkSvg}
            alt=""
            aria-hidden="true"
            decoding="async"
            onError={handleEmblemFallback(BRAND_ASSETS.emblemDarkPng)}
            className="w-full h-full object-contain drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
          />
        ) : tone === 'light' ? (
          <img
            src={BRAND_ASSETS.emblemLightSvg}
            alt=""
            aria-hidden="true"
            decoding="async"
            onError={handleEmblemFallback(BRAND_ASSETS.emblemLightPng)}
            className="w-full h-full object-contain drop-shadow-[0_1px_2px_rgba(11,22,40,0.12)]"
          />
        ) : (
          <>
            <img
              src={BRAND_ASSETS.emblemLightSvg}
              alt=""
              aria-hidden="true"
              decoding="async"
              onError={handleEmblemFallback(BRAND_ASSETS.emblemLightPng)}
              className="w-full h-full object-contain dark:hidden drop-shadow-[0_1px_2px_rgba(11,22,40,0.12)]"
            />
            <img
              src={BRAND_ASSETS.emblemDarkSvg}
              alt=""
              aria-hidden="true"
              decoding="async"
              onError={handleEmblemFallback(BRAND_ASSETS.emblemDarkPng)}
              className="w-full h-full object-contain hidden dark:block drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
            />
          </>
        )}
      </span>

      <span aria-hidden="true" className={`hidden sm:inline-block ${dividerHeightClass} w-px shrink-0 ${dividerClass}`} />

      <span className="inline-flex flex-col justify-center leading-none gap-[3px]">
        <span className="inline-flex items-baseline gap-1.5 leading-none">
          <span className={`font-display font-extrabold tracking-[-0.03em] ${dmSizeClass} ${primaryTextClass}`}>
            D&amp;M
          </span>
          <span className={`font-brand-sans font-semibold uppercase tracking-[0.14em] ${integraSizeClass} ${secondaryTextClass}`}>
            Integra{' '}
            <span className={`font-bold ${chileAccentClass}`}>Chile</span>
          </span>
        </span>
        {showSubtitle && (
          <span className={`font-brand-sans font-semibold uppercase tracking-[0.22em] leading-none ${subtitleSizeClass} ${subtitleClass}`}>
            Relocation &amp; Assessoria
          </span>
        )}
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
