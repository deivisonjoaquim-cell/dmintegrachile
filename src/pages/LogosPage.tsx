import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { BrandLogoDownloadKit } from '../components/BrandLogoDownloadKit';
import { BrandRibbon } from '../components/BrandLogo';
import { useApp } from '../contexts/AppContext';

interface LogosPageProps {
  onNavigate: (path: string) => void;
}

export const LogosPage: React.FC<LogosPageProps> = ({ onNavigate }) => {
  const { empresa } = useApp();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <button
        type="button"
        onClick={() => onNavigate('/')}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar ao início
      </button>

      <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(11,31,51,0.06)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.34)]">
        <BrandRibbon className="h-[3px] w-full" />
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-[#0B1F33] dark:text-white">
            Identidade Visual · {empresa.nome_empresa}
          </h1>
          <p className="text-sm text-[#4A5A6D] dark:text-slate-300">
            Ativos oficiais da marca para uso em propostas, relatórios de diagnóstico e comunicações com clientes.
          </p>
          <BrandLogoDownloadKit />
        </div>
      </div>
    </div>
  );
};
