import { BRAND_ASSETS } from '../constants/brandAssets';
import { uploadFileToServer } from '../services/firestoreService';

export type MediaAssetPreset = 'logo' | 'favicon' | 'banner' | 'equipe' | 'geral';

export interface ProcessedMediaResult {
  url: string;
  nome: string;
  mimeType: string;
  largura?: number;
  altura?: number;
  tamanhoBytes: number;
  storedInFirestore: boolean;
}

export const BUILT_IN_MEDIA_GALLERY: { id: string; nome: string; categoria: MediaAssetPreset; url: string }[] = [
  {
    id: 'builtin_logo_completa_clara',
    nome: 'Logo Oficial Completa — Fundo Claro (PNG)',
    categoria: 'logo',
    url: BRAND_ASSETS.logoLightPng,
  },
  {
    id: 'builtin_logo_completa_escura',
    nome: 'Logo Oficial Completa — Fundo Escuro (PNG)',
    categoria: 'logo',
    url: BRAND_ASSETS.logoDarkPng,
  },
  {
    id: 'builtin_logo_emblema_claro',
    nome: 'Emblema Oficial — Fundo Claro (SVG)',
    categoria: 'favicon',
    url: BRAND_ASSETS.emblemLightSvg,
  },
  {
    id: 'builtin_logo_emblema_escuro',
    nome: 'Emblema Oficial — Fundo Escuro (SVG)',
    categoria: 'logo',
    url: BRAND_ASSETS.emblemDarkSvg,
  },
  {
    id: 'builtin_logo_avatar_social',
    nome: 'Avatar Oficial WhatsApp & Instagram (PNG)',
    categoria: 'favicon',
    url: BRAND_ASSETS.avatarPng,
  },
  {
    id: 'builtin_hero_santiago',
    nome: 'Santiago & Cordilheira dos Andes (Hero)',
    categoria: 'banner',
    url: '/src/assets/images/hero_santiago_andes_1794944011226.jpg',
  },
  {
    id: 'builtin_service_relocation',
    nome: 'Relocation & Estabelecimento no Chile',
    categoria: 'banner',
    url: '/src/assets/images/service_relocation_chile_1794997277886.jpg',
  },
  {
    id: 'builtin_about_office',
    nome: 'Escritório de Consultoria Jurídica',
    categoria: 'banner',
    url: '/src/assets/images/about_consultoria_office_1794997278170.jpg',
  },
  {
    id: 'builtin_founder_portrait',
    nome: 'Retrato Institucional / Diretoria Técnica',
    categoria: 'equipe',
    url: '/src/assets/images/quem_somos_founder_1794993847940.jpg',
  },
];

export function sanitizeSvgText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '');
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível decodificar a imagem selecionada.'));
    img.src = src;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Processes an imported image or logo file:
 * - SVGs are sanitized and encoded as compact UTF-8/base64 data URLs (if <= 180KB) or uploaded to server.
 * - Logos / Favicons / Photos are scaled with crisp aspect ratio on an offscreen canvas so they stay lightweight
 *   and persist safely in Firestore (`<= 210KB` inline WebP/PNG) or fall back cleanly to `/api/upload`.
 */
export async function processImportedImageFile(
  file: File,
  preset: MediaAssetPreset = 'geral',
): Promise<ProcessedMediaResult> {
  const maxMb = 10 * 1024 * 1024;
  if (file.size > maxMb) {
    throw new Error('Arquivo excede o limite de 10 MB.');
  }

  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  if (isSvg) {
    const rawText = await file.text();
    const safeSvg = sanitizeSvgText(rawText).trim();
    if (!safeSvg.includes('<svg')) {
      throw new Error('Arquivo SVG inválido ou corrompido.');
    }
    const base64 = btoa(unescape(encodeURIComponent(safeSvg)));
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    if (dataUrl.length <= 210000) {
      return {
        url: dataUrl,
        nome: file.name,
        mimeType: 'image/svg+xml',
        tamanhoBytes: safeSvg.length,
        storedInFirestore: true,
      };
    }
    const up = await uploadFileToServer(file);
    return {
      url: up.url,
      nome: file.name,
      mimeType: 'image/svg+xml',
      tamanhoBytes: file.size,
      storedInFirestore: false,
    };
  }

  const isIco = file.type.includes('icon') || file.name.toLowerCase().endsWith('.ico');
  if (isIco) {
    const rawDataUrl = await fileToDataUrl(file);
    if (rawDataUrl.length <= 180000) {
      return {
        url: rawDataUrl,
        nome: file.name,
        mimeType: file.type || 'image/x-icon',
        tamanhoBytes: file.size,
        storedInFirestore: true,
      };
    }
    const up = await uploadFileToServer(file);
    return {
      url: up.url,
      nome: file.name,
      mimeType: file.type || 'image/x-icon',
      tamanhoBytes: file.size,
      storedInFirestore: false,
    };
  }

  // Raster image (PNG / JPG / WEBP)
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImageElement(objectUrl);
    const maxW = preset === 'favicon' ? 128 : preset === 'logo' ? 600 : preset === 'equipe' ? 900 : 1440;
    const maxH = preset === 'favicon' ? 128 : preset === 'logo' ? 320 : 1200;

    const scale = Math.min(1, maxW / Math.max(1, img.width), maxH / Math.max(1, img.height));
    const targetW = Math.max(1, Math.round(img.width * scale));
    const targetH = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível no navegador.');
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Keep alpha transparency for logos/favicons, use high-efficiency WebP for photos
    const preferPng = preset === 'favicon' || (preset === 'logo' && file.type === 'image/png');
    let outMime = preferPng ? 'image/png' : 'image/webp';
    let dataUrl = canvas.toDataURL(outMime, preferPng ? undefined : 0.86);

    // If PNG logo is still heavy for inline persistence, try WebP with alpha support
    if (dataUrl.length > 210000 && outMime === 'image/png') {
      outMime = 'image/webp';
      dataUrl = canvas.toDataURL('image/webp', 0.9);
    }
    // Second pass compression if needed for larger photos
    if (dataUrl.length > 210000) {
      dataUrl = canvas.toDataURL('image/webp', 0.72);
    }

    if (dataUrl.length <= 220000) {
      return {
        url: dataUrl,
        nome: file.name,
        mimeType: outMime,
        largura: targetW,
        altura: targetH,
        tamanhoBytes: Math.round((dataUrl.length * 3) / 4),
        storedInFirestore: true,
      };
    }

    // Fallback to Express disk upload for very large ultra-detailed imagery
    const up = await uploadFileToServer(file);
    return {
      url: up.url,
      nome: file.name,
      mimeType: file.type || 'image/webp',
      largura: img.width,
      altura: img.height,
      tamanhoBytes: file.size,
      storedInFirestore: false,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
