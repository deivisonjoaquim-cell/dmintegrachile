import React, { useRef, useState } from 'react';
import { Check, Copy, Download, FileImage, Package } from 'lucide-react';
import { BrandLogo, BrandRibbon, type BrandLogoVariant } from './BrandLogo';

const OFFICIAL_BRAND_SWATCHES = [
  { nome: 'Marinho Andino', hex: '#0B1F33', papel: 'Cor primária institucional', lightText: true },
  { nome: 'Dourado Estrela-Guia', hex: '#C8A236', papel: 'Destaque executivo e detalhes', lightText: false },
  { nome: 'Esmeralda Brasil', hex: '#146B43', papel: 'Ações positivas e vínculo Brasil', lightText: true },
  { nome: 'Carmim Andino', hex: '#A61C2B', papel: 'Assinatura Chile e alertas críticos', lightText: true },
  { nome: 'Marfim Editorial', hex: '#F7F5F0', papel: 'Fundo principal do sistema', lightText: false },
];

interface LogoAssetSpec {
  id: string;
  filename: string;
  titulo: string;
  usoRecomendado: string;
  variant: BrandLogoVariant;
  darkSurface: boolean;
  pngWidth: number;
  pngHeight: number;
  previewClass: string;
}

const LOGO_ASSETS: LogoAssetSpec[] = [
  {
    id: 'emblem-light',
    filename: 'logo-dm-integra-emblema-claro',
    titulo: 'Emblema Oficial (Fundo Claro)',
    usoRecomendado: 'Cabeçalho do site, contratos, papel timbrado e documentos PDF.',
    variant: 'emblem',
    darkSurface: false,
    pngWidth: 2048,
    pngHeight: 2048,
    previewClass: 'h-24 w-24',
  },
  {
    id: 'emblem-dark',
    filename: 'logo-dm-integra-emblema-escuro',
    titulo: 'Emblema Oficial (Fundo Escuro)',
    usoRecomendado: 'Rodapé institucional, apresentações escuras e capas de redes sociais.',
    variant: 'emblem-dark',
    darkSurface: true,
    pngWidth: 2048,
    pngHeight: 2048,
    previewClass: 'h-24 w-24',
  },
  {
    id: 'full-light',
    filename: 'logo-dm-integra-completa-clara',
    titulo: 'Logotipo Completo (Fundo Claro)',
    usoRecomendado: 'Propostas comerciais, assinaturas de e-mail, login e materiais institucionais.',
    variant: 'full',
    darkSurface: false,
    pngWidth: 2240,
    pngHeight: 760,
    previewClass: 'h-20 w-auto max-w-full',
  },
  {
    id: 'full-dark',
    filename: 'logo-dm-integra-completa-escura',
    titulo: 'Logotipo Completo (Fundo Escuro)',
    usoRecomendado: 'Apresentações executivas em fundo azul-marinho, banners e vídeos.',
    variant: 'full-dark',
    darkSurface: true,
    pngWidth: 2240,
    pngHeight: 760,
    previewClass: 'h-20 w-auto max-w-full',
  },
  {
    id: 'avatar-social',
    filename: 'logo-dm-integra-avatar-whatsapp-instagram',
    titulo: 'Avatar / Favicon (512×512 HD)',
    usoRecomendado: 'Foto de perfil WhatsApp Business, Instagram, LinkedIn e ícone da aba do navegador.',
    variant: 'emblem',
    darkSurface: false,
    pngWidth: 512,
    pngHeight: 512,
    previewClass: 'h-20 w-20',
  },
];

function serializeSvgElement(svgEl: SVGSVGElement): string {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const vb = clone.getAttribute('viewBox') || '0 0 240 240';
  const parts = vb.split(/\s+/).map(Number);
  if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
    clone.setAttribute('width', String(parts[2]));
    clone.setAttribute('height', String(parts[3]));
  }
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" encoding="UTF-8"?>\n${serializer.serializeToString(clone)}`;
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportSvgAsTransparentPng(
  svgMarkup: string,
  width: number,
  height: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('Contexto gráfico indisponível no navegador.'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Falha ao gerar arquivo PNG transparente.'));
          },
          'image/png',
          1.0,
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Falha ao rasterizar o arquivo SVG.'));
    };
    img.src = url;
  });
}

export const BrandLogoDownloadKit: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const containerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const getSvgForAsset = (assetId: string): SVGSVGElement | null => {
    const host = containerRefs.current[assetId];
    return host ? host.querySelector('svg') : null;
  };

  const handleDownloadSvg = (asset: LogoAssetSpec) => {
    const svg = getSvgForAsset(asset.id);
    if (!svg) return;
    const markup = serializeSvgElement(svg);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    triggerBlobDownload(blob, `${asset.filename}.svg`);
    setFeedback(`Arquivo vetorial "${asset.filename}.svg" baixado.`);
  };

  const handleDownloadPng = async (asset: LogoAssetSpec) => {
    const svg = getSvgForAsset(asset.id);
    if (!svg) return;
    setBusyId(`${asset.id}-png`);
    try {
      const markup = serializeSvgElement(svg);
      const pngBlob = await exportSvgAsTransparentPng(markup, asset.pngWidth, asset.pngHeight);
      triggerBlobDownload(pngBlob, `${asset.filename}.png`);
      setFeedback(`Imagem PNG transparente (${asset.pngWidth}×${asset.pngHeight}px) baixada.`);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível exportar o PNG.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownloadAll = async (format: 'svg' | 'png') => {
    setBusyId(`all-${format}`);
    setFeedback(null);
    try {
      for (const asset of LOGO_ASSETS) {
        if (format === 'svg') {
          handleDownloadSvg(asset);
        } else {
          const svg = getSvgForAsset(asset.id);
          if (svg) {
            const markup = serializeSvgElement(svg);
            const pngBlob = await exportSvgAsTransparentPng(markup, asset.pngWidth, asset.pngHeight);
            triggerBlobDownload(pngBlob, `${asset.filename}.png`);
          }
        }
        await new Promise((r) => setTimeout(r, 220));
      }
      setFeedback(
        format === 'svg'
          ? 'Todas as 5 versões vetoriais (SVG) foram enviadas para download.'
          : 'Todas as 5 versões em PNG transparente de alta resolução foram enviadas para download.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleCopyHex = (hex: string) => {
    navigator.clipboard?.writeText(hex).catch(() => {});
    setFeedback(`Código de cor ${hex} copiado para a área de transferência.`);
  };

  return (
    <div className="bg-white border border-[#E5DFD2] rounded-2xl overflow-hidden shadow-[0_6px_24px_rgba(11,31,51,0.04)]">
      <BrandRibbon className="h-[3px] w-full" />
      <div className="p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F1EDE4]">
          <div>
            <p className="brand-kicker">Identidade Visual Oficial · Padrão da Logo</p>
            <h2 className={`${compact ? 'text-lg' : 'text-xl sm:text-2xl'} font-bold text-[#0B1F33] mt-0.5`}>
              Kit de Logos &amp; Manual da Marca D&amp;M Integra Chile
            </h2>
            <p className="text-xs text-[#4A5A6D] mt-1">
              Baixe individualmente ou em lote com fundo transparente em vetor escalável (SVG) ou alta resolução (PNG até 2240px).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void handleDownloadAll('png')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Package className="w-3.5 h-3.5" />
              {busyId === 'all-png' ? 'Gerando PNGs...' : 'Baixar Todas (PNG HD)'}
            </button>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void handleDownloadAll('svg')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DDD6C7] bg-white text-xs font-semibold text-[#0B1F33] hover:bg-[#F7F5F0] whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {busyId === 'all-svg' ? 'Baixando SVGs...' : 'Baixar Todas (SVG)'}
            </button>
          </div>
        </div>

        {/* Paleta e Tipografia Oficiais aplicadas em todo o projeto */}
        <div className="p-4 rounded-xl bg-[#F7F5F0] border border-[#E5DFD2] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="font-semibold text-[#0B1F33]">
              Paleta Oficial da Logo aplicada em todo o sistema
            </p>
            <p className="text-[#4A5A6D]">
              Tipografia: <strong className="font-brand-serif text-[#0B1F33]">Playfair Display</strong> (Títulos / D&amp;M) ·{' '}
              <strong className="text-[#0B1F33]">Plus Jakarta Sans</strong> (Interface)
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {OFFICIAL_BRAND_SWATCHES.map((sw) => (
              <button
                key={sw.hex}
                type="button"
                onClick={() => handleCopyHex(sw.hex)}
                className="text-left rounded-lg border border-[#E5DFD2] bg-white overflow-hidden hover:border-[#C8A236] transition-colors group"
              >
                <div
                  className={`h-10 px-2.5 flex items-center justify-between text-[11px] font-mono font-semibold ${
                    sw.lightText ? 'text-white' : 'text-[#0B1F33]'
                  }`}
                  style={{ backgroundColor: sw.hex }}
                >
                  <span>{sw.hex}</span>
                  <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-bold text-[#0B1F33] leading-tight">{sw.nome}</p>
                  <p className="text-[10px] text-[#4A5A6D] mt-0.5 leading-snug">{sw.papel}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {feedback && (
          <div className="p-3 rounded-lg bg-[#EDF7F1] border border-[#B8DEC7] text-xs text-[#0F4D2F] flex items-center gap-2">
            <Check className="w-4 h-4 text-[#146B43] shrink-0" />
            <span>{feedback}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOGO_ASSETS.map((asset) => (
            <article
              key={asset.id}
              className="rounded-xl border border-[#E5DFD2] overflow-hidden flex flex-col justify-between bg-white"
            >
              <div
                ref={(el) => {
                  containerRefs.current[asset.id] = el;
                }}
                className={`h-36 px-5 flex items-center justify-center border-b border-[#E5DFD2] ${
                  asset.darkSurface ? 'bg-[#081726]' : 'bg-[#F7F5F0]'
                }`}
              >
                <BrandLogo variant={asset.variant} alt={asset.titulo} className={`${asset.previewClass} object-contain`} />
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[#0B1F33]">{asset.titulo}</p>
                  <p className="text-xs text-[#4A5A6D] mt-1 leading-relaxed">{asset.usoRecomendado}</p>
                  <p className="text-[11px] text-slate-400 mt-1.5 tabular-nums">
                    PNG {asset.pngWidth}×{asset.pngHeight}px · SVG Vetorial
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[#F1EDE4]">
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void handleDownloadPng(asset)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    {busyId === `${asset.id}-png` ? 'Gerando...' : 'PNG HD'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => handleDownloadSvg(asset)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#DDD6C7] bg-white text-xs font-semibold text-[#0B1F33] hover:bg-[#F7F5F0] whitespace-nowrap disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    SVG
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};
