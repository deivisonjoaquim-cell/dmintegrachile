/**
 * Official D&M Integra Chile brand assets uploaded by the client.
 * Complete horizontal logos use high-resolution PNG so custom Playfair Display &
 * Plus Jakarta Sans typography renders identically inside <img> tags and PDF canvases.
 * Emblems contain pure vector geometry (no text), so SVG stays infinitely sharp at any size.
 */
export const BRAND_ASSETS = {
  logoLightPng: '/assets/aistudio/logo-dm-integra-completa-clara_c33baf15.png',
  logoLightSvg: '/assets/aistudio/logo-dm-integra-completa-clara_860282bc.svg',
  logoDarkPng: '/assets/aistudio/logo-dm-integra-completa-escura_7e8a55ea.png',
  logoDarkSvg: '/assets/aistudio/logo-dm-integra-completa-escura_993504ca.svg',
  emblemLightSvg: '/assets/aistudio/logo-dm-integra-emblema-claro_89e6f043.svg',
  emblemLightPng: '/assets/aistudio/logo-dm-integra-emblema-claro_17a30863.png',
  emblemDarkSvg: '/assets/aistudio/logo-dm-integra-emblema-escuro_f9384154.svg',
  emblemDarkPng: '/assets/aistudio/logo-dm-integra-emblema-escuro_1658e49b.png',
  avatarPng: '/assets/aistudio/logo-dm-integra-avatar-whatsapp-instagram_54e22f47.png',
  avatarSvg: '/assets/aistudio/logo-dm-integra-avatar-whatsapp-instagram_e3b6fddf.svg',
} as const;

const LEGACY_PLACEHOLDER_LOGO_PATHS = new Set([
  '/logo-dm-integra.svg',
  '/logo-dm-integra-dark.svg',
  '/favicon-dm-integra.svg',
]);

export function isLegacyOrBrokenBrandUrl(raw: unknown): boolean {
  if (typeof raw !== 'string') return true;
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('/uploads/')) return true;
  if (LEGACY_PLACEHOLDER_LOGO_PATHS.has(trimmed)) return true;
  return false;
}

export function isCompleteHorizontalBrandLogo(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  return (
    trimmed === BRAND_ASSETS.logoLightPng ||
    trimmed === BRAND_ASSETS.logoLightSvg ||
    trimmed === BRAND_ASSETS.logoDarkPng ||
    trimmed === BRAND_ASSETS.logoDarkSvg ||
    trimmed.includes('logo-dm-integra-completa')
  );
}

export function resolveOfficialBrandUrl(
  raw: unknown,
  slot: 'light' | 'dark' | 'favicon' | 'emblem-dark',
): string {
  const fallback =
    slot === 'dark'
      ? BRAND_ASSETS.logoDarkPng
      : slot === 'favicon'
        ? BRAND_ASSETS.emblemLightSvg
        : slot === 'emblem-dark'
          ? BRAND_ASSETS.emblemDarkSvg
          : BRAND_ASSETS.logoLightPng;

  if (isLegacyOrBrokenBrandUrl(raw)) {
    return fallback;
  }
  return String(raw).trim();
}
