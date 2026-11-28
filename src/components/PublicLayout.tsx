import React, { useState } from 'react';
import { ArrowRight, Globe, Menu, MessageCircle, Moon, Sun, X } from 'lucide-react';
import { isCompleteHorizontalBrandLogo } from '../constants/brandAssets';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { buildWhatsAppUrl, formatDateBR, openExternalSafe } from '../utils/formatters';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import { BrandLogo, InstitutionalBrandMark, shouldUseInstitutionalMark } from './BrandLogo';

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

  // Strict 3-Zone Enterprise Top Bar: Brand | 4–5 clean links | 1 primary CTA
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

  const logoHeight = Math.min(48, Math.max(34, Number(lc.logoAlturaPx || 40)));
  const isCompleteLogo = isCompleteHorizontalBrandLogo(empresa.logoUrl);
  const showBrandText = !isCompleteLogo && (lc.mostrarNomeComLogo !== false || !empresa.logoUrl);
  const headerStyle = lc.estiloCabecalho || 'sticky_vidro';

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

  const showMobileCtaBar =
    lc.mostrarBarraCtaMobile !== false &&
    currentPath !== '/diagnostico' &&
    currentPath !== '/acompanhar' &&
    currentPath !== '/entrar-equipe';

  const headerClass =
    headerStyle === 'minimal'
      ? 'bg-white dark:bg-[#070B12] border-b border-[#E5E7EB] dark:border-[#1E293B] no-print'
      : headerStyle === 'solido'
        ? 'sticky top-0 z-40 bg-white dark:bg-[#070B12] border-b border-[#E5E7EB] dark:border-[#1E293B] no-print'
        : 'sticky top-0 z-40 bg-white/92 dark:bg-[#070B12]/92 backdrop-blur-md border-b border-[#E5E7EB]/90 dark:border-[#1E293B] no-print';

  const footerLogoSrc = empresa.logoDarkUrl || empresa.logoUrl;
  const headerLogoSrc = isDark ? (empresa.logoDarkUrl || empresa.logoUrl) : empresa.logoUrl;
  const useInstitutionalHeaderLogo = shouldUseInstitutionalMark(headerLogoSrc);
  const useInstitutionalFooterLogo = shouldUseInstitutionalMark(footerLogoSrc);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-200">
      <header className={headerClass}>
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-[66px] lg:h-[82px] flex items-center justify-between gap-8">
          {/* Zona 1: Marca Institucional de Alta Fidelidade */}
          <a
            href="#/"
            aria-label={empresa.nome_empresa}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="flex items-center gap-3 min-w-0 whitespace-nowrap shrink-0 rounded-md py-1 focus-visible:outline-2 focus-visible:outline-[#0F3D91] dark:focus-visible:outline-[#60A5FA]"
          >
            {useInstitutionalHeaderLogo ? (
              <InstitutionalBrandMark tone="auto" size="header" />
            ) : (
              <>
                <BrandLogo
                  src={headerLogoSrc}
                  alt={empresa.nome_empresa}
                  brandShortName={brandShortName}
                  variant={isDark ? 'dark' : 'light'}
                  priority
                  imgStyle={{ height: `${logoHeight}px` }}
                  imgClassName="w-auto max-h-[36px] lg:max-h-[42px] max-w-[180px] sm:max-w-[210px] object-contain shrink-0"
                />
                {showBrandText && (
                  <span className="font-display text-base font-bold tracking-tight text-[#0B1628] dark:text-white whitespace-nowrap truncate">
                    {brandShortName}
                  </span>
                )}
              </>
            )}
          </a>

          {/* Zona 2: Navegação Institucional (linha única, tipografia executiva refinada) */}
          <nav className="hidden lg:flex items-center gap-10" aria-label="Navegação principal">
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
                  className={`text-[13.5px] tracking-[0.014em] whitespace-nowrap shrink-0 py-2 border-b-[1.5px] transition-colors ${
                    active
                      ? 'text-[#0B1628] dark:text-white font-semibold border-[#0F3D91] dark:border-[#60A5FA]'
                      : 'text-[#4B5563] dark:text-slate-300 font-medium border-transparent hover:text-[#0B1628] dark:hover:text-white hover:border-[#CBD5E1] dark:hover:border-slate-600'
                  }`}
                >
                  {item.localizedLabel}
                </a>
              );
            })}
          </nav>

          {/* Zona 3: Alternador discreto de tema + 1 CTA Primário + Menu Mobile */}
          <div className="flex items-center gap-3.5 shrink-0">
            <button
              type="button"
              data-testid="navbar-theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
              aria-pressed={isDark}
              title={isDark ? 'Modo Claro' : 'Modo Escuro'}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] text-[#4B5563] dark:text-slate-300 hover:text-[#0B1628] dark:hover:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#151F32] transition-colors shrink-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#C9A86A]" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <span aria-hidden="true" className="hidden lg:inline-block h-5 w-px bg-[#E5E7EB] dark:bg-[#1E293B]" />

            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk(headerCtaDest)}
              onClick={handleHeaderCtaClick}
              className={`hidden lg:inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] tracking-[0.006em] font-semibold rounded-lg whitespace-nowrap shrink-0 transition-colors ${
                currentPath === headerCtaDest
                  ? 'bg-[#F1F4F8] dark:bg-[#151F32] text-[#0B1628] dark:text-white border border-[#D1D5DB] dark:border-[#334155]'
                  : 'bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628] hover:bg-[#16233B] dark:hover:bg-slate-200'
              }`}
            >
              {headerCtaLabel}
              {currentPath !== headerCtaDest && (
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg text-[#0B1628] dark:text-slate-200 hover:bg-[#F1F4F8] dark:hover:bg-[#151F32] min-h-[40px] min-w-[40px] flex items-center justify-center transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-[#0D1422] border-t border-[#E5E7EB] dark:border-[#1E293B] px-5 py-5 space-y-1.5">
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
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                  currentPath === item.path
                    ? 'bg-[#F1F4F8] dark:bg-[#151F32] text-[#0B1628] dark:text-white font-semibold'
                    : 'text-[#4B5563] dark:text-slate-300 hover:bg-[#F7F8FA] dark:hover:bg-[#151F32]'
                }`}
              >
                {item.localizedLabel}
              </a>
            ))}

            <button
              type="button"
              onTouchStart={() => prefetchRouteChunk(headerCtaDest)}
              onClick={handleHeaderCtaClick}
              className="w-full mt-3 px-4 py-3 text-sm font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white rounded-lg text-center inline-flex items-center justify-center gap-2"
            >
              {headerCtaLabel}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-4 mt-4 border-t border-[#E5E7EB] dark:border-[#1E293B] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div
                  role="group"
                  aria-label="Selecionar idioma do site"
                  className="inline-flex items-center rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#151F32] p-0.5"
                >
                  <button
                    type="button"
                    onClick={() => setLocale('pt-BR')}
                    aria-pressed={locale === 'pt-BR'}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      locale === 'pt-BR'
                        ? 'bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628]'
                        : 'text-[#4B5563] dark:text-slate-300'
                    }`}
                  >
                    PT
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocale('es-CL')}
                    aria-pressed={locale === 'es-CL'}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      locale === 'es-CL'
                        ? 'bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628]'
                        : 'text-[#4B5563] dark:text-slate-300'
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
                className="text-xs font-medium text-[#4B5563] dark:text-slate-400 hover:text-[#0B1628] dark:hover:text-white underline underline-offset-4"
              >
                {isStaff ? (locale === 'es-CL' ? 'Panel interno' : 'Abrir painel') : t.footer.teamArea}
              </a>
            </div>
          </div>
        )}
      </header>

      <main className={`flex-1 ${showMobileCtaBar ? 'pb-14 md:pb-0' : ''}`}>{children}</main>

      <footer
        className="text-slate-300 border-t border-[#1E293B] no-print cv-auto"
        style={{ backgroundColor: 'var(--color-footer-bg)' }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16 lg:py-20">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 pb-12 border-b border-white/10">
            <div className="md:col-span-5 space-y-4">
              {useInstitutionalFooterLogo ? (
                <InstitutionalBrandMark tone="dark" size="footer" />
              ) : (
                <>
                  <BrandLogo
                    src={footerLogoSrc}
                    alt={empresa.nome_empresa}
                    brandShortName={brandShortName}
                    variant="dark"
                    lazy
                    imgClassName="h-11 w-auto max-w-[240px] object-contain"
                  />
                  {!isCompleteHorizontalBrandLogo(footerLogoSrc) && (
                    <p className="font-display text-lg font-bold tracking-tight text-white">{empresa.nome_empresa}</p>
                  )}
                </>
              )}
              <p className="text-sm text-slate-400 leading-relaxed max-w-md">
                {translateText(lc.rodapeSubtitulo) || t.footer.defaultSubtitle}
              </p>
              <div className="pt-1 space-y-1 text-xs text-slate-500">
                <p>{translateText(empresa.endereco_cidade)}</p>
                <p>{translateText(empresa.razao_social_cnpj_rut)}</p>
              </div>
            </div>

            <div className="md:col-span-3">
              <p className="text-xs font-semibold text-white mb-5">
                {t.footer.quickAccess}
              </p>
              <ul className="space-y-3 text-sm">
                {allNavItems.map((item) => (
                  <li key={item.path}>
                    <a
                      href={`#${item.path}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(item.path);
                      }}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      {item.localizedLabel}
                    </a>
                  </li>
                ))}
                <li className="pt-1">
                  <a
                    href={isStaff ? '#/painel' : '#/entrar-equipe'}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(isStaff ? '/painel' : '/entrar-equipe');
                    }}
                    className="text-slate-500 hover:text-slate-200 transition-colors text-xs"
                  >
                    {t.footer.teamArea}
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-4">
              <p className="text-xs font-semibold text-white">
                {t.footer.supportCompliance}
              </p>
              <div className="space-y-1.5 text-sm">
                <p className="text-slate-200 font-medium">{empresa.email}</p>
                <p className="text-slate-400 tabular-nums">{empresa.whatsapp}</p>
                <p className="text-xs text-slate-400 pt-1 leading-relaxed">
                  {locale === 'es-CL'
                    ? '¿Tienes dudas sobre tu visa, PDI, RUT o aliados indicados en Chile? Escríbenos sin compromiso.'
                    : 'Tem dúvidas sobre visto, PDI, RUT ou indicação de parceiros no Chile? Chame nossa equipe sem compromisso.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-5 text-xs">
                <a
                  href={waFloatingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-300 hover:text-white underline underline-offset-4 transition-colors"
                >
                  {locale === 'es-CL' ? 'Hablar por WhatsApp' : 'Tirar dúvidas no WhatsApp'}
                </a>
                {empresa.siteInstagram && (
                  <a
                    href={empresa.siteInstagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-300 hover:text-white underline underline-offset-4 transition-colors"
                  >
                    {t.footer.instagramLabel}
                  </a>
                )}
                {empresa.siteLinkedIn && (
                  <a
                    href={empresa.siteLinkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-300 hover:text-white underline underline-offset-4 transition-colors"
                  >
                    {t.footer.linkedinLabel}
                  </a>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-3">
                <div
                  role="group"
                  aria-label="Selecionar idioma do site"
                  className="inline-flex items-center rounded-lg border border-white/12 bg-white/[0.04] p-0.5"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1 shrink-0" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setLocale('pt-BR')}
                    aria-pressed={locale === 'pt-BR'}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                      locale === 'pt-BR'
                        ? 'bg-white text-[#0B1628]'
                        : 'text-slate-400 hover:text-white'
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
                        ? 'bg-white text-[#0B1628]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    ES-CL
                  </button>
                </div>

                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-pressed={isDark}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 bg-white/[0.04] hover:bg-white/10 text-xs font-medium text-slate-300 transition-colors"
                >
                  {isDark ? <Sun className="w-3.5 h-3.5 text-[#C9A86A]" /> : <Moon className="w-3.5 h-3.5 text-slate-400" />}
                  {isDark ? 'Modo claro' : locale === 'es-CL' ? 'Modo oscuro' : 'Modo escuro'}
                </button>
              </div>

              {empresa.ultimaRevisaoNormativa && (
                <p className="text-xs text-slate-500 tabular-nums">
                  {t.footer.lastLegalReview} {formatDateBR(empresa.ultimaRevisaoNormativa)}
                </p>
              )}
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-500">
            <p className="leading-relaxed max-w-4xl">
              {translateText(empresa.avisoLegal) || t.footer.defaultLegalNotice}
            </p>
            <p className="whitespace-nowrap shrink-0 text-slate-500">
              © {new Date().getFullYear()} {brandShortName} · {translateText(lc.rodapeCopyright) || t.footer.defaultCopyright}
            </p>
          </div>
        </div>
      </footer>

      {/* Barra inferior fixa CTA compacta no mobile (mantém chrome fixo total < 15% da altura) */}
      {showMobileCtaBar && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#0D1422]/95 backdrop-blur border-t border-[#E5E7EB] dark:border-[#1E293B] px-4 py-2 flex items-center gap-2.5 no-print">
          <button
            type="button"
            onTouchStart={() => prefetchRouteChunk('/diagnostico')}
            onClick={() => onNavigate('/diagnostico')}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white min-h-[40px]"
          >
            {t.mobileBar.diagnosticCta}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <a
            href={waFloatingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-[#0B1628] dark:text-white text-xs font-semibold min-h-[40px]"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {t.mobileBar.whatsappCta}
          </a>
        </div>
      )}
    </div>
  );
};
