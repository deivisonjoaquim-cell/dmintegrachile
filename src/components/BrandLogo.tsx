import React, { useEffect, useState } from 'react';

interface BrandLogoProps {
  src?: string | null;
  alt: string;
  brandShortName: string;
  imgClassName?: string;
  imgStyle?: React.CSSProperties;
  fallbackClassName?: string;
  fallbackNode?: React.ReactNode;
  hideFallback?: boolean;
}

/**
 * Renders the configured brand logo image and gracefully falls back to the
 * crisp navy/gold monogram if the image URL is missing or unreachable
 * (for example, legacy `/uploads/...` links on static Vercel Free hosting).
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  src,
  alt,
  brandShortName,
  imgClassName = 'h-9 w-auto max-w-[180px] object-contain shrink-0',
  imgStyle,
  fallbackClassName = 'w-9 h-9 btn-radius flex items-center justify-center text-xs font-extrabold tracking-tight text-white shrink-0 shadow-[0_2px_6px_rgba(11,31,51,0.2)] ring-1 ring-[#C9A227]/40',
  fallbackNode,
  hideFallback = false,
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const cleanSrc = typeof src === 'string' ? src.trim() : '';

  if (cleanSrc && !failed) {
    return (
      <img
        src={cleanSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        style={imgStyle}
        className={imgClassName}
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

  return (
    <span className={fallbackClassName} style={{ backgroundColor: 'var(--color-primary)' }}>
      {brandShortName.slice(0, 3).toUpperCase()}
    </span>
  );
};
