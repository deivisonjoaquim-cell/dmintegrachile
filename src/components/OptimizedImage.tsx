import React, { useEffect, useMemo, useRef, useState } from 'react';
import { resolveOptimizedImageSources } from '../utils/imageOptimization';

export interface OptimizedImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  containerClassName?: string;
  style?: React.CSSProperties;
  /** Responsive sizes attribute for mobile/desktop WebP srcSet selection */
  sizes?: string;
  /** Set true ONLY for above-the-fold LCP images (e.g. Hero) */
  priority?: boolean;
  /** Optional width/height hints for aspect reservation and zero CLS */
  width?: number;
  height?: number;
  /** Tone of the placeholder shimmer surface before image paint */
  placeholderTone?: 'light' | 'dark';
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

/**
 * Mobile-first optimized image component:
 * - Delivers responsive WebP (`640w` mobile / `1280w` desktop) via `<picture>` with automatic JPG/PNG fallback
 * - Uses `fetchPriority="high"` + eager decode for LCP hero images
 * - Uses IntersectionObserver (`250px` pre-warm margin) + native `loading="lazy"` + `decoding="async"` below the fold
 * - Smooth opacity fade-in without layout shift (zero CLS)
 */
export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  containerClassName = 'relative w-full h-full overflow-hidden',
  style,
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 50vw',
  priority = false,
  width,
  height,
  placeholderTone = 'light',
  referrerPolicy = 'no-referrer',
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState<boolean>(priority);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [webpFailed, setWebpFailed] = useState<boolean>(false);

  const sources = useMemo(() => resolveOptimizedImageSources(src), [src]);

  useEffect(() => {
    setLoaded(false);
    setWebpFailed(false);
  }, [src]);

  useEffect(() => {
    if (priority || inView) return;
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const el = wrapperRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
            break;
          }
        }
      },
      {
        rootMargin: '250px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, inView]);

  if (!sources.fallbackSrc) {
    return null;
  }

  const placeholderBg =
    placeholderTone === 'dark'
      ? 'bg-[#0B1F33]'
      : 'bg-[#EDE8DD]';

  const shouldRenderWebpSource = !webpFailed && !sources.isVector && Boolean(sources.webpSrcSet || sources.webpSrc);

  return (
    <div ref={wrapperRef} className={`${containerClassName} ${placeholderBg}`}>
      {/* Subtle non-pulsing architectural placeholder while decoding */}
      {!loaded && !priority && (
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${
            placeholderTone === 'dark'
              ? 'bg-gradient-to-br from-[#0B1F33] via-[#132D47] to-[#081726]'
              : 'bg-gradient-to-br from-[#F3EFE6] via-[#EAE3D4] to-[#F7F5F0]'
          }`}
        />
      )}

      {inView && (
        <picture className="block w-full h-full">
          {shouldRenderWebpSource && (
            <source
              type="image/webp"
              srcSet={sources.webpSrcSet || sources.webpSrc}
              sizes={sources.webpSrcSet ? sizes : undefined}
            />
          )}
          <img
            src={sources.fallbackSrc}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            fetchPriority={priority ? 'high' : 'low'}
            referrerPolicy={referrerPolicy}
            style={style}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (!webpFailed && shouldRenderWebpSource) {
                setWebpFailed(true);
              } else {
                setLoaded(true);
              }
            }}
            className={`${className} transition-opacity duration-300 ${
              priority || loaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </picture>
      )}
    </div>
  );
};
