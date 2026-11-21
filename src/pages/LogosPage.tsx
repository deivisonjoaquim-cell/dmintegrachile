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
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Voltar ao início
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <BrandRibbon className="h-[3px] w-full" />
        <div className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Identidade Visual · {empresa.nome_empresa}
          </h1>
          <p className="text-sm text-slate-600">
            Ativos oficiais da marca para uso em propostas, relatórios de diagnóstico e comunicações com clientes.
          </p>
          <BrandLogoDownloadKit />
        </div>
      </div>
    </div>
  );
};
