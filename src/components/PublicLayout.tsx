import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { formatDateBR } from '../utils/formatters';

interface PublicLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const PublicLayout: React.FC<PublicLayoutProps> = ({ currentPath, onNavigate, children }) => {
  const { empresa, userProfile } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', label: 'Início' },
    { path: '/quem-somos', label: 'Quem Somos' },
    { path: '/parceiros', label: 'Parceiros' },
    { path: '/diagnostico', label: 'Diagnóstico' },
    { path: '/acompanhar', label: 'Acompanhar processo' },
  ];

  const handleTeamClick = () => {
    setMobileMenuOpen(false);
    if (userProfile && (userProfile.role === 'admin' || userProfile.role === 'consultor' || userProfile.role === 'assistente')) {
      onNavigate('/painel');
    } else {
      onNavigate('/entrar-equipe');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-slate-900">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zona 1: Marca em linha única */}
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] rounded"
          >
            {empresa.logoUrl ? (
              <img
                src={empresa.logoUrl}
                alt={empresa.nome_empresa}
                referrerPolicy="no-referrer"
                className="h-8 w-auto object-contain"
              />
            ) : (
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                D&amp;M
              </span>
            )}
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
              {empresa.nome_empresa.split('–')[0].trim()}
            </span>
          </a>

          {/* Zona 2: 5 links de navegação em linha única */}
          <nav className="hidden lg:flex items-center gap-6" aria-label="Navegação principal">
            {navItems.map((item) => {
              const active = currentPath === item.path;
              return (
                <a
                  key={item.path}
                  href={`#${item.path}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.path);
                  }}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'text-slate-900 border-[var(--color-accent)]'
                      : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zona 3: 1 ação primária + botão mobile */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleTeamClick}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white rounded-lg whitespace-nowrap shrink-0 transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Área da equipe
            </button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-3 space-y-1">
            {navItems.map((item) => (
              <a
                key={item.path}
                href={`#${item.path}`}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  onNavigate(item.path);
                }}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                  currentPath === item.path ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={handleTeamClick}
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg text-center"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Área da equipe
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#0B1B29] text-slate-300 border-t border-slate-800 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-800">
            <div>
              <p className="text-base font-bold text-white mb-2">{empresa.nome_empresa}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{empresa.endereco_cidade}</p>
              <p className="text-xs text-slate-400 mt-2">{empresa.razao_social_cnpj_rut}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Acesso rápido</p>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="#/diagnostico"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/diagnostico');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Diagnóstico de Elegibilidade
                  </a>
                </li>
                <li>
                  <a
                    href="#/parceiros"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/parceiros');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Parceiros Homologados e Seja um Parceiro
                  </a>
                </li>
                <li>
                  <a
                    href="#/quem-somos"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/quem-somos');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Quem Somos
                  </a>
                </li>
                <li>
                  <a
                    href="#/acompanhar"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/acompanhar');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Acompanhar meu processo
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Atendimento</p>
              <p className="text-sm text-slate-300">{empresa.email}</p>
              <p className="text-sm text-slate-300 mt-1 tabular-nums">{empresa.whatsapp}</p>
              {empresa.ultimaRevisaoNormativa && (
                <p className="text-xs text-slate-400 mt-4">
                  Última revisão normativa registrada: {formatDateBR(empresa.ultimaRevisaoNormativa)}
                </p>
              )}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
            <p className="leading-relaxed max-w-4xl">{empresa.avisoLegal}</p>
            <p className="whitespace-nowrap shrink-0">© {new Date().getFullYear()} D&amp;M Integra Chile</p>
          </div>
        </div>
      </footer>
    </div>
  );
};
