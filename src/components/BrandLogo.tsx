import React, { useEffect, useState } from 'react';

export interface BrandLogoProps {
  src?: string | null;
  alt: string;
  brandShortName?: string;
  variant?: 'default' | 'emblem' | 'emblem-dark' | 'wordmark';
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

/**
 * Renders the configured brand logo image and gracefully falls back to the
 * crisp navy/gold monogram if the image URL is missing or unreachable
 * (for example, legacy `/uploads/...` links on static Vercel Free hosting).
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  src,
  alt,
  brandShortName,
  variant = 'default',
  className,
  style,
  imgClassName,
  imgStyle,
  fallbackClassName,
  fallbackNode,
  hideFallback = false,
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const cleanSrc = typeof src === 'string' ? src.trim() : '';
  const resolvedClass =
    imgClassName || className || 'h-9 w-auto max-w-[180px] object-contain shrink-0';
  const resolvedStyle = imgStyle || style;
  const monogram = (brandShortName || alt || 'D&M').split('–')[0].trim().slice(0, 3).toUpperCase();

  if (cleanSrc && !failed) {
    return (
      <img
        src={cleanSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        style={resolvedStyle}
        className={resolvedClass}
        onError={() => setFailed(true)}
      />
    );
  }

  if (hideFallback) {
    return null;
  }

  if (fallbackNode) {
    return <>{fallbackNode}</>;
  }

  const defaultFallbackClass =
    variant === 'emblem-dark'
      ? 'w-8 h-8 btn-radius flex items-center justify-center text-xs font-extrabold tracking-tight text-white bg-white/15 ring-1 ring-[#C9A227]/60 shrink-0'
      : 'w-9 h-9 btn-radius flex items-center justify-center text-xs font-extrabold tracking-tight text-white shrink-0 ring-1 ring-[#C9A227]/40';

  return (
    <span
      className={fallbackClassName || defaultFallbackClass}
      style={variant === 'emblem-dark' ? undefined : { backgroundColor: 'var(--color-primary)' }}
    >
      {monogram}
    </span>
  );
};
