import React, { useEffect, useState } from 'react';
import { DEFAULT_EMPRESA_CONFIG } from '../data/seeds';

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
}

export const BrandRibbon: React.FC<{ className?: string }> = ({ className = 'h-[3px] w-full' }) => (
  <div
    aria-hidden="true"
    className={className}
    style={{
      background:
        'linear-gradient(90deg, var(--color-primary, #0B1F33) 0%, var(--color-accent, #C8A236) 55%, #0B1F33 100%)',
    }}
  />
);

function isLikelyBrokenLogoUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  // Legacy ephemeral upload paths do not survive static Vercel Free deployments
  if (trimmed.startsWith('/uploads/')) return true;
  return false;
}

const InlineBrandSvg: React.FC<{
  dark: boolean;
  emblemOnly: boolean;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}> = ({ dark, emblemOnly, alt, className, style }) => {
  if (emblemOnly) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        fill="none"
        role="img"
        aria-label={alt}
        className={className || 'h-9 w-9 shrink-0'}
        style={style}
      >
        <rect x="2" y="2" width="60" height="60" rx="14" fill={dark ? '#143252' : '#0B1F33'} />
        <rect x="5" y="5" width="54" height="54" rx="11" stroke={dark ? '#E5C76B' : '#C8A236'} strokeWidth="1.8" />
        <path d="M49 12L50.5 16L54.5 17.5L50.5 19L49 23L47.5 19L43.5 17.5L47.5 16L49 12Z" fill="#E5C76B" />
        <text
          x="32"
          y="40"
          textAnchor="middle"
          fill="#FFFFFF"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight="700"
          fontSize="19"
        >
          D&amp;M
        </text>
        <line x1="15" y1="48" x2="49" y2="48" stroke={dark ? '#E5C76B' : '#C8A236'} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 360 72"
      fill="none"
      role="img"
      aria-label={alt}
      className={className || 'h-9 w-auto max-w-[200px] shrink-0'}
      style={style}
    >
      <rect x="4" y="6" width="60" height="60" rx="14" fill={dark ? '#143252' : '#0B1F33'} />
      <rect x="7" y="9" width="54" height="54" rx="11" stroke={dark ? '#E5C76B' : '#C8A236'} strokeWidth="1.6" />
      <path d="M51 16L52.6 20.4L57 22L52.6 23.6L51 28L49.4 23.6L45 22L49.4 20.4L51 16Z" fill="#E5C76B" />
      <text
        x="34"
        y="45"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="20"
      >
        D&amp;M
      </text>
      <line x1="17" y1="52" x2="51" y2="52" stroke={dark ? '#E5C76B' : '#C8A236'} strokeWidth="1.6" strokeLinecap="round" />
      <text
        x="78"
        y="34"
        fill={dark ? '#FFFFFF' : '#0B1F33'}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="22"
      >
        D&amp;M Integra Chile
      </text>
      <text
        x="79"
        y="53"
        fill={dark ? '#E5C76B' : '#8C6B18'}
        fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
        fontWeight="700"
        fontSize="10.5"
        letterSpacing="2.4"
      >
        RELOCATION &amp; ASSESSORIA
      </text>
    </svg>
  );
};

/**
 * Renders the configured brand logo with automatic multi-stage recovery:
 * 1) Configured URL (if valid)
 * 2) Official bundled SVG in `/public` (`/logo-dm-integra.svg` or `/logo-dm-integra-dark.svg`)
 * 3) Crisp inline vector emblem (never disappears on any route or theme)
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
}) => {
  const isDarkVariant = variant === 'dark' || variant === 'emblem-dark';
  const isEmblemVariant = variant === 'emblem' || variant === 'emblem-dark';
  const defaultAssetSrc = isEmblemVariant
    ? DEFAULT_EMPRESA_CONFIG.faviconUrl || '/favicon-dm-integra.svg'
    : isDarkVariant
      ? DEFAULT_EMPRESA_CONFIG.logoDarkUrl || '/logo-dm-integra-dark.svg'
      : DEFAULT_EMPRESA_CONFIG.logoUrl || '/logo-dm-integra.svg';

  const cleanSrc = typeof src === 'string' ? src.trim() : '';
  const initialSrc = !isLikelyBrokenLogoUrl(cleanSrc) ? cleanSrc : defaultAssetSrc;

  // 0 = primary/configured src, 1 = official default SVG, 2 = inline vector fallback
  const [stage, setStage] = useState<0 | 1 | 2>(initialSrc === defaultAssetSrc ? 1 : 0);

  useEffect(() => {
    setStage(initialSrc === defaultAssetSrc ? 1 : 0);
  }, [initialSrc, defaultAssetSrc]);

  const resolvedClass =
    imgClassName || className || 'h-9 w-auto max-w-[200px] object-contain shrink-0';
  const resolvedStyle = imgStyle || style;

  const activeSrc = stage === 0 ? initialSrc : stage === 1 ? defaultAssetSrc : '';

  if (activeSrc && stage < 2) {
    return (
      <img
        src={activeSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        style={resolvedStyle}
        className={resolvedClass}
        onError={() => {
          setStage((prev) => (prev === 0 && initialSrc !== defaultAssetSrc ? 1 : 2));
        }}
      />
    );
  }

  if (hideFallback) {
    return null;
  }

  if (fallbackNode) {
    return <>{fallbackNode}</>;
  }

  return (
    <InlineBrandSvg
      dark={isDarkVariant}
      emblemOnly={isEmblemVariant}
      alt={alt}
      className={resolvedClass}
      style={resolvedStyle}
    />
  );
};
