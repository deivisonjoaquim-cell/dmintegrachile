/**
 * WebP responsive image resolution & route chunk prefetch helpers
 * tailored for fast mobile LCP and low-bandwidth rendering.
 */

export interface ResolvedImageSources {
  /** Original fallback URL (JPG/PNG/SVG/external) */
  fallbackSrc: string;
  /** Single WebP URL (when available without responsive variants) */
  webpSrc?: string;
  /** Responsive WebP srcSet (`640w` mobile + `1280w` desktop) when available */
  webpSrcSet?: string;
  /** True when asset is a vector SVG (already optimal without WebP conversion) */
  isVector: boolean;
}

const KNOWN_RESPONSIVE_PHOTO_BASES = new Set([
  '/src/assets/images/hero_corporate_santiago_skyline_1795699452140',
  '/src/assets/images/advisory_boardroom_minimal_1795699453098',
  '/src/assets/images/andes_horizon_banner_1795635435326',
  '/src/assets/images/hero_santiago_andes_1794944011226',
  '/src/assets/images/about_consultoria_office_1794944011861',
  '/src/assets/images/about_consultoria_office_1794997278170',
  '/src/assets/images/quem_somos_founder_1794944012517',
  '/src/assets/images/quem_somos_founder_1794993847940',
  '/src/assets/images/service_relocation_chile_1794944013551',
  '/src/assets/images/service_relocation_chile_1794997277886',
  '/src/assets/images/partners_executive_santiago_1795383896419',
]);

const KNOWN_AISTUDIO_WEBP_BASES = new Set([
  '/assets/aistudio/logo-dm-integra-completa-clara_c33baf15',
  '/assets/aistudio/logo-dm-integra-completa-escura_7e8a55ea',
  '/assets/aistudio/logo-dm-integra-emblema-claro_17a30863',
  '/assets/aistudio/logo-dm-integra-emblema-escuro_1658e49b',
  '/assets/aistudio/logo-dm-integra-avatar-whatsapp-instagram_54e22f47',
  '/assets/aistudio/D72F15E6-B3B0-4F64-9723-A9A714D830E6_e0167eca',
]);

function stripQueryAndHash(url: string): string {
  return url.split(/[?#]/)[0];
}

/**
 * Resolves a given image URL into optimal WebP `<source>` definitions while
 * preserving the original URL as a safe fallback for older browsers or custom uploads.
 */
export function resolveOptimizedImageSources(rawUrl: string | undefined | null): ResolvedImageSources {
  const clean = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!clean) {
    return { fallbackSrc: '', isVector: false };
  }

  const cleanPath = stripQueryAndHash(clean);
  const lower = cleanPath.toLowerCase();

  if (lower.endsWith('.svg') || lower.startsWith('data:image/svg+xml')) {
    return { fallbackSrc: clean, isVector: true };
  }

  if (lower.endsWith('.webp')) {
    return { fallbackSrc: clean, webpSrc: clean, isVector: false };
  }

  // Local high-res editorial photos: provide mobile 640w + desktop 1280w WebP srcSet
  const photoMatch = /^(\/src\/assets\/images\/[^/]+)\.(jpe?g|png)$/i.exec(cleanPath);
  if (photoMatch && KNOWN_RESPONSIVE_PHOTO_BASES.has(photoMatch[1])) {
    const base = photoMatch[1];
    return {
      fallbackSrc: clean,
      webpSrc: `${base}.webp`,
      webpSrcSet: `${base}-640w.webp 640w, ${base}.webp 1280w`,
      isVector: false,
    };
  }

  // Local official brand raster PNG/JPG assets: provide crisp WebP sibling
  const brandMatch = /^(\/assets\/aistudio\/[^/]+)\.(png|jpe?g)$/i.exec(cleanPath);
  if (brandMatch && KNOWN_AISTUDIO_WEBP_BASES.has(brandMatch[1])) {
    const base = brandMatch[1];
    return {
      fallbackSrc: clean,
      webpSrc: `${base}.webp`,
      isVector: false,
    };
  }

  return { fallbackSrc: clean, isVector: false };
}

/**
 * Maps a PNG/JPG brand URL directly to its optimized WebP version when available.
 */
export function getBrandWebpUrl(rawUrl: string | undefined | null): string | undefined {
  const resolved = resolveOptimizedImageSources(rawUrl);
  return resolved.webpSrc;
}
