import React, { useState } from 'react';
import { ArrowRight, Menu, MessageCircle, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { buildWhatsAppUrl, formatDateBR } from '../utils/formatters';
import { BrandLogo, BrandRibbon, BrandWordmark } from './BrandLogo';
import { OfflineModeStatusBar } from './OfflineModeStatusBar';

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
  const logoHeight = Math.min(64, Math.max(24, Number(lc.logoAlturaPx || 42)));
  const showBrandText = lc.mostrarNomeComLogo !== false || !empresa.logoUrl;
  const headerStyle = lc.estiloCabecalho || 'sticky_vidro';
  const headerCtaLabel = lc.textoCtaCabecalho || 'Área da Equipe';
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
      ? 'bg-white border-b border-[#E5DFD2] no-print'
      : headerStyle === 'solido'
        ? 'sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[#E5DFD2] shadow-[0_1px_3px_rgba(11,31,51,0.05)] no-print'
        : 'sticky top-0 z-40 bg-[#FFFFFF]/92 backdrop-blur-xl border-b border-[#E5DFD2]/90 shadow-[0_1px_2px_rgba(11,31,51,0.035)] no-print';

  const footerLogoSrc = empresa.logoDarkUrl || empresa.logoUrl;
  const brandShortName = empresa.nome_empresa.split('–')[0].trim();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)]">
      {/* Filete arquitetônico bilateral derivado da logo oficial */}
      <BrandRibbon className="h-[3px] w-full no-print" />

      <header className={headerClass}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[74px] flex items-center justify-between gap-8">
          {/* Zona 1: Emblema + Assinatura Tipográfica em linha única */}
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-center gap-3 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] rounded group"
          >
            <BrandLogo
              src={empresa.logoUrl}
              alt={empresa.nome_empresa}
              variant="emblem"
              style={{ height: `${Math.max(42, logoHeight)}px` }}
              className="w-auto max-w-[190px] object-contain shrink-0 transition-transform duration-200 group-hover:scale-[1.03]"
            />
            {showBrandText && <BrandWordmark tone="light" size="sm" />}
          </a>

          {/* Zona 2: Links de navegação em linha única */}
          <nav className="hidden lg:flex items-center gap-7" aria-label="Navegação principal">
            {navItems.map((item) => {
              const active = currentPath === item.path;
              const resolvedPath =
                item.path === '/acompanhar' &&
                userProfile?.role === 'cliente' &&
                userProfile.status === 'ativo' &&
                Boolean(userProfile.clientId)
                  ? '/portal'
                  : item.path;
              return (
                <a
                  key={item.path}
                  href={`#${resolvedPath}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(resolvedPath);
                  }}
                  className={`text-[13.5px] font-medium whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
                    active
                      ? 'text-[#0B1F33] font-semibold border-[var(--color-accent)]'
                      : 'text-[#4A5A6D] border-transparent hover:text-[#0B1F33] hover:border-[#D5CCB8]'
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
              className="hidden sm:inline-flex items-center justify-center px-4.5 py-2.5 text-xs font-semibold text-white btn-radius whitespace-nowrap shrink-0 shadow-[0_2px_6px_rgba(11,31,51,0.18)] transition-all duration-150 hover:opacity-95 hover:-translate-y-[0.5px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {headerCtaLabel}
            </button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 btn-radius text-[#0B1F33] hover:bg-[#F7F5F0] min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-[#E5DFD2] px-4 py-3 space-y-1 shadow-lg">
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
                  currentPath === item.path ? 'bg-[#F7F5F0] text-[#0B1F33] font-semibold' : 'text-slate-700 hover:bg-[#F7F5F0]/70'
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

      <OfflineModeStatusBar variant="public" />

      <main className={`flex-1 ${showMobileCtaBar ? 'pb-16 md:pb-0' : ''}`}>{children}</main>

      <footer
        className="text-slate-300 border-t border-white/10 no-print relative"
        style={{ backgroundColor: 'var(--color-footer-bg)' }}
      >
        <BrandRibbon className="h-[3px] w-full" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-white/10">
            <div className="md:col-span-5 space-y-3.5">
              <div className="flex items-center gap-3.5">
                <BrandLogo
                  src={footerLogoSrc}
                  alt={empresa.nome_empresa}
                  variant="emblem-dark"
                  className="h-14 w-14 object-contain shrink-0"
                />
                <BrandWordmark tone="dark" size="md" showSubtitle />
              </div>
              {lc.rodapeSubtitulo && (
                <p className="text-sm text-slate-300 leading-relaxed max-w-md">{lc.rodapeSubtitulo}</p>
              )}
              <p className="text-sm text-slate-400 leading-relaxed">{empresa.endereco_cidade}</p>
              <p className="text-xs text-slate-500">{empresa.razao_social_cnpj_rut}</p>
            </div>
            <div className="md:col-span-3">
              <p className="text-xs font-semibold tracking-wide text-[#E5C76B] mb-4">
                Navegação
              </p>
              <ul className="space-y-2.5 text-sm">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <a
                      href={`#${item.path}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(item.path);
                      }}
                      className="text-slate-300 hover:text-white transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-4">
              <p className="text-xs font-semibold tracking-wide text-[#E5C76B] mb-4">
                Atendimento e Conformidade
              </p>
              <p className="text-sm text-slate-200 font-medium">{empresa.email}</p>
              <p className="text-sm text-slate-300 mt-1 tabular-nums">{empresa.whatsapp}</p>
              <div className="flex flex-wrap gap-4 mt-3">
                {empresa.siteInstagram && (
                  <a
                    href={empresa.siteInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-slate-300 hover:text-white underline underline-offset-4"
                  >
                    Instagram
                  </a>
                )}
                {empresa.siteLinkedIn && (
                  <a
                    href={empresa.siteLinkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-slate-300 hover:text-white underline underline-offset-4"
                  >
                    LinkedIn
                  </a>
                )}
              </div>
              {empresa.ultimaRevisaoNormativa && (
                <p className="text-xs text-slate-400 mt-5 pt-4 border-t border-white/10 tabular-nums">
                  Última revisão normativa registrada: {formatDateBR(empresa.ultimaRevisaoNormativa)}
                </p>
              )}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
            <p className="leading-relaxed max-w-4xl">{empresa.avisoLegal}</p>
            <p className="whitespace-nowrap shrink-0 text-slate-500">
              © {new Date().getFullYear()} {brandShortName} · {lc.rodapeCopyright || 'Todos os direitos reservados.'}
            </p>
          </div>
        </div>
      </footer>

      {/* Botão flutuante discreto do WhatsApp no desktop (Esmeralda Brasil da logo) */}
      {showFloatingWa && (
        <a
          href={waFloatingUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Falar com ${brandShortName} no WhatsApp`}
          className="hidden md:inline-flex fixed bottom-6 right-6 z-40 items-center gap-2 px-4.5 py-3 rounded-full bg-[#146B43] hover:bg-[#0F5434] text-white text-xs font-semibold shadow-[0_8px_24px_rgba(11,31,51,0.24)] hover:shadow-[0_10px_28px_rgba(11,31,51,0.3)] hover:-translate-y-0.5 transition-all duration-150 no-print"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </a>
      )}

      {/* Barra inferior fixa CTA no mobile */}
      {showMobileCtaBar && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E5DFD2] px-3 py-2 flex items-center gap-2 no-print shadow-lg">
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
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 btn-radius bg-[#146B43] hover:bg-[#0F5434] text-white text-xs font-semibold min-h-[42px]"
          >
            <MessageCircle className="w-4 h-4" />
            WhatsApp
          </a>
        </div>
      )}
    </div>
  );
};
