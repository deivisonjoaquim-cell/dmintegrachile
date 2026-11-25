import React, { useState } from 'react';
import { ArrowRight, Globe, Menu, MessageCircle, Moon, Sun, X } from 'lucide-react';
import { isCompleteHorizontalBrandLogo } from '../constants/brandAssets';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { buildWhatsAppUrl, formatDateBR, openExternalSafe } from '../utils/formatters';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import { BrandLogo, BrandRibbon } from './BrandLogo';

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
  const { locale, setLocale, t, translateText } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStaff = Boolean(
    userProfile &&
      (userProfile.role === 'admin' || userProfile.role === 'consultor' || userProfile.role === 'assistente'),
  );

  const lc = empresa.layoutConfig || {};
  const allNavItems = (lc.linksNavegacao && lc.linksNavegacao.length > 0 ? lc.linksNavegacao : DEFAULT_NAV_LINKS)
    .filter((item) => item.visivel !== false)
    .map((item) => ({
      ...item,
      localizedLabel: t.nav[item.path] || translateText(item.label),
    }));

  // Header Zona 2: keep navigation crisp and uncluttered (4 links for visitors, +Painel for authenticated staff).
  // Diagnostic is highlighted as the single primary CTA in Zone 3, so avoid duplicating it in desktop Zone 2.
  const desktopNavItems = [
    ...allNavItems.filter((item) => item.path !== '/diagnostico'),
    ...(isStaff
      ? [
          {
            path: '/painel',
            label: 'Painel',
            visivel: true,
            localizedLabel: locale === 'es-CL' ? 'Panel' : 'Painel',
          },
        ]
      : []),
  ];

  const logoHeight = Math.min(54, Math.max(36, Number(lc.logoAlturaPx || 44)));
  const isCompleteLogo = isCompleteHorizontalBrandLogo(empresa.logoUrl);
  const showBrandText = !isCompleteLogo && (lc.mostrarNomeComLogo !== false || !empresa.logoUrl);
  const headerStyle = lc.estiloCabecalho || 'sticky_vidro';

  // Use public visitor primary CTA (Diagnóstico Gratuito) unless CMS explicitly configured a non-staff destination.
  const hasCustomPublicCta =
    Boolean(lc.destinoCtaCabecalho) &&
    lc.destinoCtaCabecalho !== '/entrar-equipe' &&
    lc.destinoCtaCabecalho !== '/painel';
  const headerCtaDest = hasCustomPublicCta ? lc.destinoCtaCabecalho! : '/diagnostico';
  const headerCtaLabel = hasCustomPublicCta
    ? translateText(lc.textoCtaCabecalho || t.headerCtaDiagnostic)
    : t.headerCtaDiagnostic;

  const handleHeaderCtaClick = () => {
    setMobileMenuOpen(false);
    if (headerCtaDest.startsWith('http')) {
      openExternalSafe(headerCtaDest);
    } else {
      onNavigate(headerCtaDest);
    }
  };

  const brandShortName = empresa.nome_empresa.split('–')[0].trim();
  const waFloatingUrl = buildWhatsAppUrl(
    empresa.whatsapp,
    t.mobileBar.waGreeting(empresa.nome_empresa),
  );
  // Hide floating WhatsApp pill on dense directory & focus pages so it never overlaps interactive cards or controls
  const showFloatingWa =
    lc.mostrarBotaoWhatsappFlutuante !== false &&
    currentPath !== '/parceiros' &&
    currentPath !== '/diagnostico' &&
    currentPath !== '/acompanhar' &&
    currentPath !== '/entrar-equipe';
  const showMobileCtaBar =
    lc.mostrarBarraCtaMobile !== false &&
    currentPath !== '/diagnostico' &&
    currentPath !== '/acompanhar' &&
    currentPath !== '/entrar-equipe';

  const headerClass =
    headerStyle === 'minimal'
      ? 'bg-white dark:bg-[#0B1F33] border-b border-[#E5DFD2] dark:border-[#1C324B] no-print'
      : headerStyle === 'solido'
        ? 'sticky top-0 z-40 bg-[var(--color-surface)] border-b border-[#E5DFD2] dark:border-[#1C324B] no-print'
        : 'sticky top-0 z-40 bg-white/95 dark:bg-[#0B1F33]/95 backdrop-blur-md border-b border-[#E5DFD2] dark:border-[#1C324B] no-print';

  const footerLogoSrc = empresa.logoDarkUrl || empresa.logoUrl;
  const headerLogoSrc = isDark ? (empresa.logoDarkUrl || empresa.logoUrl) : empresa.logoUrl;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-200">
      {/* Filete arquitetônico bilateral de identidade institucional */}
      <BrandRibbon className="h-[2.5px] w-full no-print" />

      <header className={headerClass}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[58px] lg:h-[72px] flex items-center justify-between gap-6">
          {/* Zona 1: Marca Oficial */}
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-center gap-3 min-w-0 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] rounded group"
          >
            <BrandLogo
              src={headerLogoSrc}
              alt={empresa.nome_empresa}
              brandShortName={brandShortName}
              variant={isDark ? 'dark' : 'light'}
              priority
              imgStyle={{ height: `${logoHeight}px` }}
              imgClassName="w-auto max-h-[38px] lg:max-h-[46px] max-w-[190px] sm:max-w-[220px] object-contain shrink-0"
            />
            {showBrandText && (
              <span className="text-base sm:text-[17px] font-bold tracking-tight text-[var(--color-text)] whitespace-nowrap truncate">
                {brandShortName}
              </span>
            )}
          </a>

          {/* Zona 2: Navegação principal enxuta (4–5 links limpos em linha única) */}
          <nav className="hidden lg:flex items-center gap-8" aria-label="Navegação principal">
            {desktopNavItems.map((item) => {
              const active = currentPath === item.path;
              return (
                <a
                  key={item.path}
                  href={`#${item.path}`}
                  onMouseEnter={() => prefetchRouteChunk(item.path)}
                  onFocus={() => prefetchRouteChunk(item.path)}
                  onTouchStart={() => prefetchRouteChunk(item.path)}
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.path);
                  }}
                  className={`text-sm font-medium whitespace-nowrap shrink-0 py-1.5 border-b-2 transition-colors ${
                    active
                      ? 'text-[var(--color-text)] font-semibold border-[var(--color-accent)]'
                      : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-[var(--color-text)] hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {item.localizedLabel}
                </a>
              );
            })}
          </nav>

          {/* Zona 3: 1 CTA primário inconfundível + menu mobile */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk(headerCtaDest)}
              onClick={handleHeaderCtaClick}
              className={`hidden lg:inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold btn-radius whitespace-nowrap shrink-0 transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${
                currentPath === headerCtaDest
                  ? 'bg-[#F1EDE4] dark:bg-[#142942] text-[#0B1F33] dark:text-[#E5C76B] border border-[#DDD6C7] dark:border-[#244365]'
                  : 'text-white shadow-[0_1px_3px_rgba(11,31,51,0.16)] hover:opacity-95'
              }`}
              style={currentPath === headerCtaDest ? undefined : { backgroundColor: 'var(--color-primary)' }}
            >
              {headerCtaLabel}
              {currentPath !== headerCtaDest && <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>

            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 btn-radius text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#11263D] min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-[#0D1E31] border-t border-[#E5DFD2] dark:border-[#1C324B] px-4 py-4 space-y-1.5 shadow-lg">
            {allNavItems.map((item) => (
              <a
                key={item.path}
                href={`#${item.path}`}
                onTouchStart={() => prefetchRouteChunk(item.path)}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  onNavigate(item.path);
                }}
                className={`block px-3 py-2.5 btn-radius text-sm font-medium ${
                  currentPath === item.path
                    ? 'bg-[#F7F5F0] dark:bg-[#11263D] text-[#0B1F33] dark:text-white font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-[#FAF9F6] dark:hover:bg-[#11263D]'
                }`}
              >
                {item.localizedLabel}
              </a>
            ))}

            <button
              type="button"
              onTouchStart={() => prefetchRouteChunk(headerCtaDest)}
              onClick={handleHeaderCtaClick}
              className="w-full mt-2 px-4 py-2.5 text-sm font-semibold text-white btn-radius text-center inline-flex items-center justify-center gap-1.5"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {headerCtaLabel}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-3 mt-3 border-t border-[#E5DFD2] dark:border-[#1C324B] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-pressed={isDark}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#11263D] text-xs font-medium text-[#0B1F33] dark:text-slate-200"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5 text-[#E5C76B]" /> : <Moon className="w-3.5 h-3.5" />}
                  {isDark
                    ? locale === 'es-CL'
                      ? 'Modo claro'
                      : 'Modo claro'
                    : locale === 'es-CL'
                      ? 'Modo oscuro'
                      : 'Modo escuro'}
                </button>
                <div
                  role="group"
                  aria-label="Selecionar idioma do site"
                  className="inline-flex items-center rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#11263D] p-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setLocale('pt-BR')}
                    aria-pressed={locale === 'pt-BR'}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      locale === 'pt-BR'
                        ? 'bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1F33]'
                        : 'text-[#4A5A6D] dark:text-slate-300'
                    }`}
                  >
                    PT
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocale('es-CL')}
                    aria-pressed={locale === 'es-CL'}
                    className={`px-2 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      locale === 'es-CL'
                        ? 'bg-[#A61C2B] text-white'
                        : 'text-[#4A5A6D] dark:text-slate-300'
                    }`}
                  >
                    ES-CL
                  </button>
                </div>
              </div>

              <a
                href={isStaff ? '#/painel' : '#/entrar-equipe'}
                onClick={(e) => {
                  e.preventDefault();
                  setMobileMenuOpen(false);
                  onNavigate(isStaff ? '/painel' : '/entrar-equipe');
                }}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-[var(--color-text)] underline underline-offset-4"
              >
                {isStaff ? (locale === 'es-CL' ? 'Panel interno' : 'Abrir painel') : t.footer.teamArea}
              </a>
            </div>
          </div>
        )}
      </header>

      <main className={`flex-1 ${showMobileCtaBar ? 'pb-14 md:pb-0' : ''}`}>{children}</main>

      <footer
        className="text-slate-300 border-t border-white/10 no-print relative cv-auto"
        style={{ backgroundColor: 'var(--color-footer-bg)' }}
      >
        <BrandRibbon className="h-[2.5px] w-full" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-10 border-b border-white/10">
            <div className="md:col-span-5 space-y-3">
              <BrandLogo
                src={footerLogoSrc}
                alt={empresa.nome_empresa}
                brandShortName={brandShortName}
                variant="dark"
                lazy
                imgClassName="h-12 w-auto max-w-[260px] object-contain"
              />
              {!isCompleteHorizontalBrandLogo(footerLogoSrc) && (
                <p className="text-lg font-bold tracking-tight text-white">{empresa.nome_empresa}</p>
              )}
              <p className="text-sm text-slate-300 leading-relaxed max-w-md">
                {translateText(lc.rodapeSubtitulo) || t.footer.defaultSubtitle}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">{translateText(empresa.endereco_cidade)}</p>
              <p className="text-xs text-slate-500">{translateText(empresa.razao_social_cnpj_rut)}</p>
            </div>
            <div className="md:col-span-3">
              <p className="text-xs font-semibold text-[#E5C76B] mb-4">
                {t.footer.quickAccess}
              </p>
              <ul className="space-y-2.5 text-sm">
                {allNavItems.map((item) => (
                  <li key={item.path}>
                    <a
                      href={`#${item.path}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(item.path);
                      }}
                      className="text-slate-300 hover:text-white transition-colors"
                    >
                      {item.localizedLabel}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href={isStaff ? '#/painel' : '#/entrar-equipe'}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(isStaff ? '/painel' : '/entrar-equipe');
                    }}
                    className="text-slate-400 hover:text-[#E5C76B] transition-colors text-xs"
                  >
                    {t.footer.teamArea}
                  </a>
                </li>
              </ul>
            </div>
            <div className="md:col-span-4">
              <p className="text-xs font-semibold text-[#E5C76B] mb-4">
                {t.footer.supportCompliance}
              </p>
              <p className="text-sm text-slate-200 font-medium">{empresa.email}</p>
              <p className="text-sm text-slate-300 mt-1 tabular-nums">{empresa.whatsapp}</p>
              <div className="flex flex-wrap items-center gap-4 mt-3">
                {empresa.siteInstagram && (
                  <a
                    href={empresa.siteInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-slate-300 hover:text-white underline underline-offset-4"
                  >
                    {t.footer.instagramLabel}
                  </a>
                )}
                {empresa.siteLinkedIn && (
                  <a
                    href={empresa.siteLinkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-xs text-slate-300 hover:text-white underline underline-offset-4"
                  >
                    {t.footer.linkedinLabel}
                  </a>
                )}
              </div>

              {/* Preferências globais: Idioma e Tema (mantém o cabeçalho limpo) */}
              <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center gap-2.5">
                <div
                  role="group"
                  aria-label="Selecionar idioma do site"
                  className="inline-flex items-center rounded-lg border border-white/15 bg-white/5 p-0.5"
                >
                  <Globe className="w-3.5 h-3.5 text-[#E5C76B] ml-2 mr-1 shrink-0" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setLocale('pt-BR')}
                    aria-pressed={locale === 'pt-BR'}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      locale === 'pt-BR'
                        ? 'bg-[#E5C76B] text-[#081726]'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    PT-BR
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocale('es-CL')}
                    aria-pressed={locale === 'es-CL'}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      locale === 'es-CL'
                        ? 'bg-[#A61C2B] text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    ES-CL
                  </button>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-pressed={isDark}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-200 transition-colors"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5 text-[#E5C76B]" /> : <Moon className="w-3.5 h-3.5 text-[#E5C76B]" />}
                  {isDark
                    ? locale === 'es-CL'
                      ? 'Modo claro'
                      : 'Modo claro'
                    : locale === 'es-CL'
                      ? 'Modo oscuro'
                      : 'Modo escuro'}
                </button>
              </div>

              {empresa.ultimaRevisaoNormativa && (
                <p className="text-xs text-slate-400 mt-4 tabular-nums">
                  {t.footer.lastLegalReview} {formatDateBR(empresa.ultimaRevisaoNormativa)}
                </p>
              )}
            </div>
          </div>

          <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
            <p className="leading-relaxed max-w-4xl">
              {translateText(empresa.avisoLegal) || t.footer.defaultLegalNotice}
            </p>
            <p className="whitespace-nowrap shrink-0 text-slate-500">
              © {new Date().getFullYear()} {brandShortName} · {translateText(lc.rodapeCopyright) || t.footer.defaultCopyright}
            </p>
          </div>
        </div>
      </footer>

      {/* Botão flutuante discreto do WhatsApp no desktop (oculto em páginas de foco/diretório) */}
      {showFloatingWa && (
        <a
          href={waFloatingUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Falar com ${brandShortName} no WhatsApp`}
          className="hidden md:inline-flex fixed bottom-5 right-5 z-40 items-center gap-2 px-4 py-2.5 rounded-full bg-[#146B43] hover:bg-[#0F5434] text-white text-xs font-semibold border border-white/15 shadow-[0_6px_18px_rgba(11,31,51,0.2)] hover:-translate-y-0.5 transition-all duration-150 no-print"
        >
          <MessageCircle className="w-4 h-4" />
          {t.mobileBar.whatsappCta}
        </a>
      )}

      {/* Barra inferior fixa CTA compacta no mobile (mantém chrome fixo total < 15% da altura) */}
      {showMobileCtaBar && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0D1E31]/95 backdrop-blur border-t border-[#E5DFD2] dark:border-[#1C324B] px-3 py-1.5 flex items-center gap-2 no-print">
          <button
            type="button"
            onTouchStart={() => prefetchRouteChunk('/diagnostico')}
            onClick={() => onNavigate('/diagnostico')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 btn-radius text-xs font-semibold text-white min-h-[38px]"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {t.mobileBar.diagnosticCta}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <a
            href={waFloatingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-3.5 btn-radius bg-[#146B43] text-white text-xs font-semibold min-h-[38px]"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {t.mobileBar.whatsappCta}
          </a>
        </div>
      )}
    </div>
  );
};
