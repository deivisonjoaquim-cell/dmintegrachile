import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { BrandLogoDownloadKit } from '../components/BrandLogoDownloadKit';

interface LogosPageProps {
  onNavigate: (path: string) => void;
}

export const LogosPage: React.FC<LogosPageProps> = ({ onNavigate }) => {
  return (
    <div className="py-10 lg:py-16 bg-[var(--color-bg)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        <button
          type="button"
          onClick={() => onNavigate('/')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[var(--color-primary)]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para a página inicial
        </button>

        <BrandLogoDownloadKit />
      </div>
    </div>
  );
};
