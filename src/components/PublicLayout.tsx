import React, { useState } from 'react';
import { ArrowRight, Menu, MessageCircle, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { buildWhatsAppUrl, formatDateBR } from '../utils/formatters';

interface PublicLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

const DEFAULT_NAV_LINKS = [
  { path: '/', label: 'Início', visivel: true },
  { path: '/quem-somos', label: 'Quem Somos', visivel: true },
  { path: '/parceiros', label: 'Parceiros', visivel: true },
  { path: '/diagnostico', label: 'Diagnóstico', visivel: true },
  { path: '/acompanhar', label: 'Portal do Cliente', visivel: true },
];

export const PublicLayout: React.FC<PublicLayoutProps> = ({ currentPath, onNavigate, children }) => {
  const { empresa, userProfile } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const lc = empresa.layoutConfig || {};
  const navItems = (lc.linksNavegacao && lc.linksNavegacao.length > 0 ? lc.linksNavegacao : DEFAULT_NAV_LINKS).filter(
    (item) => item.visivel !== false,
  );
  const logoHeight = Math.min(64, Math.max(24, Number(lc.logoAlturaPx || 36)));
  const showBrandText = lc.mostrarNomeComLogo !== false || !empresa.logoUrl;
  const headerStyle = lc.estiloCabecalho || 'sticky_vidro';
  const headerCtaLabel = lc.textoCtaCabecalho || 'Área da equipe';
  const headerCtaDest = lc.destinoCtaCabecalho || '/entrar-equipe';

  const handleHeaderCtaClick = () => {
    setMobileMenuOpen(false);
    if (
      headerCtaDest === '/entrar-equipe' &&
      userProfile &&
      (userProfile.role === 'admin' || userProfile.role === 'consultor' || userProfile.role === 'assistente')
    ) {
      onNavigate('/painel');
    } else if (headerCtaDest.startsWith('http')) {
      window.open(headerCtaDest, '_blank', 'noopener,noreferrer');
    } else {
      onNavigate(headerCtaDest);
    }
  };

  const waFloatingUrl = buildWhatsAppUrl(
    empresa.whatsapp,
    `Olá! Vim pelo site da ${empresa.nome_empresa} e gostaria de tirar uma dúvida.`,
  );
  const showFloatingWa = lc.mostrarBotaoWhatsappFlutuante !== false;
  const showMobileCtaBar =
    lc.mostrarBarraCtaMobile !== false &&
    currentPath !== '/diagnostico' &&
    currentPath !== '/acompanhar' &&
    currentPath !== '/entrar-equipe';

  const headerClass =
    headerStyle === 'minimal'
      ? 'bg-white border-b border-slate-100 no-print'
      : headerStyle === 'solido'
        ? 'sticky top-0 z-40 bg-[var(--color-surface)] border-b border-slate-200 shadow-xs no-print'
        : 'sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 no-print';

  const footerLogoSrc = empresa.logoDarkUrl || empresa.logoUrl;
  const brandShortName = empresa.nome_empresa.split('–')[0].trim();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      <header className={headerClass}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
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
                style={{ height: `${logoHeight}px` }}
                className="w-auto max-w-[190px] object-contain"
              />
            ) : (
              <span
                className="w-9 h-9 btn-radius flex items-center justify-center text-xs font-bold text-white shrink-0"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {brandShortName.slice(0, 3).toUpperCase()}
              </span>
            )}
            {showBrandText && (
              <span className="text-base sm:text-lg font-bold tracking-tight text-[var(--color-text)] whitespace-nowrap">
                {brandShortName}
              </span>
            )}
          </a>

          {/* Zona 2: Links de navegação em linha única */}
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
                      ? 'text-[var(--color-text)] border-[var(--color-accent)]'
                      : 'text-slate-600 border-transparent hover:text-[var(--color-text)] hover:border-slate-300'
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
              onClick={handleHeaderCtaClick}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white btn-radius whitespace-nowrap shrink-0 transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {headerCtaLabel}
            </button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 btn-radius text-slate-700 hover:bg-slate-100 min-h-[40px] min-w-[40px] flex items-center justify-center"
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
                className={`block px-3 py-2.5 btn-radius text-sm font-medium ${
                  currentPath === item.path ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={handleHeaderCtaClick}
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white btn-radius text-center"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {headerCtaLabel}
            </button>
          </div>
        )}
      </header>

      <main className={`flex-1 ${showMobileCtaBar ? 'pb-16 md:pb-0' : ''}`}>{children}</main>

      <footer
        className="text-slate-300 border-t border-white/10 no-print"
        style={{ backgroundColor: 'var(--color-footer-bg)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-white/10">
            <div className="space-y-2.5">
              {footerLogoSrc && (
                <img
                  src={footerLogoSrc}
                  alt={empresa.nome_empresa}
                  referrerPolicy="no-referrer"
                  className="h-9 w-auto max-w-[200px] object-contain"
                />
              )}
              <p className="text-base font-bold text-white">{empresa.nome_empresa}</p>
              {lc.rodapeSubtitulo && (
                <p className="text-xs text-slate-300 leading-relaxed">{lc.rodapeSubtitulo}</p>
              )}
              <p className="text-sm text-slate-400 leading-relaxed">{empresa.endereco_cidade}</p>
              <p className="text-xs text-slate-400">{empresa.razao_social_cnpj_rut}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Acesso rápido</p>
              <ul className="space-y-2 text-sm">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <a
                      href={`#${item.path}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(item.path);
                      }}
                      className="hover:text-white transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-white mb-3">Atendimento</p>
              <p className="text-sm text-slate-300">{empresa.email}</p>
              <p className="text-sm text-slate-300 mt-1 tabular-nums">{empresa.whatsapp}</p>
              <div className="flex flex-wrap gap-4 mt-2.5">
                {empresa.siteInstagram && (
                  <a
                    href={empresa.siteInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-slate-300 hover:text-white underline"
                  >
                    Instagram oficial
                  </a>
                )}
                {empresa.siteLinkedIn && (
                  <a
                    href={empresa.siteLinkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-slate-300 hover:text-white underline"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
              {empresa.ultimaRevisaoNormativa && (
                <p className="text-xs text-slate-400 mt-4">
                  Última revisão normativa registrada: {formatDateBR(empresa.ultimaRevisaoNormativa)}
                </p>
              )}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
            <p className="leading-relaxed max-w-4xl">{empresa.avisoLegal}</p>
            <p className="whitespace-nowrap shrink-0">
              © {new Date().getFullYear()} {brandShortName} · {lc.rodapeCopyright || 'Todos os direitos reservados.'}
            </p>
          </div>
        </div>
      </footer>

      {/* Botão flutuante discreto do WhatsApp no desktop */}
      {showFloatingWa && (
        <a
          href={waFloatingUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Falar com ${brandShortName} no WhatsApp`}
          className="hidden md:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2 px-4 py-3 rounded-full bg-[#1E7E34] text-white text-xs font-semibold shadow-lg hover:opacity-95 no-print"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </a>
      )}

      {/* Barra inferior fixa CTA no mobile */}
      {showMobileCtaBar && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 px-3 py-2 flex items-center gap-2 no-print shadow-lg">
          <button
            type="button"
            onClick={() => onNavigate('/diagnostico')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 btn-radius text-xs font-semibold text-white min-h-[42px]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            Diagnóstico Gratuito
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <a
            href={waFloatingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 btn-radius bg-[#1E7E34] text-white text-xs font-semibold min-h-[42px]"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
};
