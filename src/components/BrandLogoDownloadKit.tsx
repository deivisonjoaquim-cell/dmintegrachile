import React from 'react';
import { Download } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { BrandLogo } from './BrandLogo';

interface BrandLogoDownloadKitProps {
  compact?: boolean;
}

export const BrandLogoDownloadKit: React.FC<BrandLogoDownloadKitProps> = ({ compact = false }) => {
  const { empresa } = useApp();
  const brandName = empresa.nome_empresa || 'D&M Integra Chile';

  const downloadSvgBadge = (variant: 'light' | 'dark') => {
    const bg = variant === 'dark' ? '#0B1F33' : '#FFFFFF';
    const fg = variant === 'dark' ? '#FFFFFF' : '#0B1F33';
    const accent = empresa.corDestaque || '#C8A236';
    const shortName = brandName.split('–')[0].trim();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">
  <rect width="640" height="180" rx="18" fill="${bg}"/>
  <rect x="24" y="24" width="6" height="132" rx="3" fill="${accent}"/>
  <text x="54" y="88" font-family="Georgia, serif" font-size="38" font-weight="700" fill="${fg}">${shortName.replace(/&/g, '&amp;')}</text>
  <text x="54" y="128" font-family="sans-serif" font-size="18" fill="${accent}" letter-spacing="2">ASSESSORIA MIGRATÓRIA · CHILE</text>
</svg>`;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logo-${variant}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-white border border-slate-200 rounded-xl ${compact ? 'p-4' : 'p-6'} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BrandLogo
            src={empresa.logoUrl}
            alt={brandName}
            brandShortName={brandName.split('–')[0].trim()}
            imgClassName="h-9 w-auto max-w-[150px] object-contain"
          />
          <div>
            <p className="text-sm font-bold text-slate-900">Kit de Identidade Visual (SVG)</p>
            <p className="text-xs text-slate-500">Baixe versões prontas da marca para documentos e redes sociais</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => downloadSvgBadge('light')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            SVG Fundo Claro
          </button>
          <button
            type="button"
            onClick={() => downloadSvgBadge('dark')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <Download className="w-3.5 h-3.5" />
            SVG Fundo Escuro
          </button>
        </div>
      </div>
    </div>
  );
};
