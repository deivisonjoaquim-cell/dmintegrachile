import React from 'react';
import { Download } from 'lucide-react';
import { BRAND_ASSETS } from '../constants/brandAssets';
import { useApp } from '../contexts/AppContext';
import { BrandLogo } from './BrandLogo';

interface BrandLogoDownloadKitProps {
  compact?: boolean;
}

interface OfficialAssetItem {
  id: string;
  titulo: string;
  descricao: string;
  previewSrc: string;
  previewWebpSrc?: string;
  pngUrl: string;
  svgUrl: string;
  pngFileName: string;
  svgFileName: string;
  darkSurface?: boolean;
  square?: boolean;
}

const OFFICIAL_KIT_ITEMS: OfficialAssetItem[] = [
  {
    id: 'completa-clara',
    titulo: 'Logo Completa — Fundo Claro',
    descricao: 'Cabeçalho do site, contratos, pareceres, propostas e PDFs',
    previewSrc: BRAND_ASSETS.logoLightPng,
    previewWebpSrc: BRAND_ASSETS.logoLightWebp,
    pngUrl: BRAND_ASSETS.logoLightPng,
    svgUrl: BRAND_ASSETS.logoLightSvg,
    pngFileName: 'logo-dm-integra-completa-clara.png',
    svgFileName: 'logo-dm-integra-completa-clara.svg',
    darkSurface: false,
  },
  {
    id: 'completa-escura',
    titulo: 'Logo Completa — Fundo Escuro',
    descricao: 'Rodapé institucional, modo escuro e apresentações',
    previewSrc: BRAND_ASSETS.logoDarkPng,
    previewWebpSrc: BRAND_ASSETS.logoDarkWebp,
    pngUrl: BRAND_ASSETS.logoDarkPng,
    svgUrl: BRAND_ASSETS.logoDarkSvg,
    pngFileName: 'logo-dm-integra-completa-escura.png',
    svgFileName: 'logo-dm-integra-completa-escura.svg',
    darkSurface: true,
  },
  {
    id: 'emblema-claro',
    titulo: 'Emblema Oficial — Fundo Claro',
    descricao: 'Favicon do navegador, selos e menu recolhido',
    previewSrc: BRAND_ASSETS.emblemLightSvg,
    pngUrl: BRAND_ASSETS.emblemLightPng,
    svgUrl: BRAND_ASSETS.emblemLightSvg,
    pngFileName: 'logo-dm-integra-emblema-claro.png',
    svgFileName: 'logo-dm-integra-emblema-claro.svg',
    darkSurface: false,
    square: true,
  },
  {
    id: 'emblema-escuro',
    titulo: 'Emblema Oficial — Fundo Escuro',
    descricao: 'Aplicações em fundos marinho, grafite e modo escuro',
    previewSrc: BRAND_ASSETS.emblemDarkSvg,
    pngUrl: BRAND_ASSETS.emblemDarkPng,
    svgUrl: BRAND_ASSETS.emblemDarkSvg,
    pngFileName: 'logo-dm-integra-emblema-escuro.png',
    svgFileName: 'logo-dm-integra-emblema-escuro.svg',
    darkSurface: true,
    square: true,
  },
  {
    id: 'avatar-social',
    titulo: 'Avatar WhatsApp & Instagram',
    descricao: 'Foto de perfil otimizada para WhatsApp Business e redes sociais',
    previewSrc: BRAND_ASSETS.avatarPng,
    previewWebpSrc: BRAND_ASSETS.avatarWebp,
    pngUrl: BRAND_ASSETS.avatarPng,
    svgUrl: BRAND_ASSETS.avatarSvg,
    pngFileName: 'logo-dm-integra-avatar-whatsapp-instagram.png',
    svgFileName: 'logo-dm-integra-avatar-whatsapp-instagram.svg',
    darkSurface: false,
    square: true,
  },
];

export const BrandLogoDownloadKit: React.FC<BrandLogoDownloadKitProps> = ({ compact = false }) => {
  const { empresa } = useApp();
  const brandName = empresa.nome_empresa || 'D&M Integra Chile – Relocation & Assessoria';

  if (compact) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo
              src={empresa.logoUrl}
              alt={brandName}
              brandShortName={brandName.split('–')[0].trim()}
              variant="light"
              imgClassName="h-10 w-auto max-w-[180px] object-contain shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">Kit Oficial de Logotipos (PNG + SVG)</p>
              <p className="text-xs text-slate-500">
                Suas logos oficiais aplicadas no site, painel, portal e disponíveis para download
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={BRAND_ASSETS.logoLightPng}
              download="logo-dm-integra-completa-clara.png"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              PNG Claro
            </a>
            <a
              href={BRAND_ASSETS.logoDarkPng}
              download="logo-dm-integra-completa-escura.png"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Download className="w-3.5 h-3.5" />
              PNG Escuro
            </a>
            <a
              href={BRAND_ASSETS.avatarPng}
              download="logo-dm-integra-avatar-whatsapp-instagram.png"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Avatar Social
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {OFFICIAL_KIT_ITEMS.map((item) => (
          <div
            key={item.id}
            className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
          >
            <div
              className={`h-40 px-5 flex items-center justify-center border-b border-slate-200 ${
                item.darkSurface ? 'bg-[#081726]' : 'bg-[#F7F5F0]'
              }`}
            >
              {item.previewWebpSrc ? (
                <picture>
                  <source srcSet={item.previewWebpSrc} type="image/webp" />
                  <img
                    src={item.previewSrc}
                    alt={item.titulo}
                    loading="lazy"
                    decoding="async"
                    className={
                      item.square
                        ? 'h-28 w-28 object-contain'
                        : 'max-h-24 w-auto max-w-full object-contain'
                    }
                  />
                </picture>
              ) : (
                <img
                  src={item.previewSrc}
                  alt={item.titulo}
                  loading="lazy"
                  decoding="async"
                  className={
                    item.square
                      ? 'h-28 w-28 object-contain'
                      : 'max-h-24 w-auto max-w-full object-contain'
                  }
                />
              )}
            </div>

            <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{item.titulo}</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.descricao}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={item.pngUrl}
                  download={item.pngFileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap shrink-0"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar PNG
                </a>
                <a
                  href={item.svgUrl}
                  download={item.svgFileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar SVG
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
