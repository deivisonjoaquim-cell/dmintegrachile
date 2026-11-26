import React, { useEffect, useState } from 'react';
import { ArrowRight, Globe, Menu, MessageCircle, Moon, Sun, X } from 'lucide-react';
import { isCompleteHorizontalBrandLogo, isLegacyOrBrokenBrandUrl } from '../constants/brandAssets';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { buildWhatsAppUrl, formatDateBR, openExternalSafe } from '../utils/formatters';
import { prefetchRouteChunk } from '../utils/routePrefetch';
import { BrandLogo } from './BrandLogo';

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
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const logoHeight = Math.min(52, Math.max(38, Number(lc.logoAlturaPx || 44)));
  const isCompleteLogo = isCompleteHorizontalBrandLogo(empresa.logoUrl);
  const isOfficialDmBrand =
    !empresa.logoUrl || isLegacyOrBrokenBrandUrl(empresa.logoUrl) || isCompleteLogo;
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
  const isDefaultDmWordmark = /^d\s*&\s*m\s+integra\s+chile$/i.test(brandShortName);
  const waFloatingUrl = buildWhatsAppUrl(
    empresa.whatsapp,
    t.mobileBar.waGreeting(empresa.nome_empresa),
  );

  const showMobileCtaBar =
    lc.mostrarBarraCtaMobile !== false &&
    currentPath !== '/diagnostico' &&
    currentPath !== '/acompanhar' &&
    currentPath !== '/entrar-equipe';

  const scrollShadowClass = isScrolled
    ? 'shadow-[0_10px_28px_-14px_rgba(11,22,40,0.16)] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]'
    : 'shadow-none';

  const headerClass =
    headerStyle === 'minimal'
      ? `bg-white dark:bg-[#070E1C] border-b border-[#E2E8F0] dark:border-white/[0.08] no-print transition-shadow duration-200 ${scrollShadowClass}`
      : headerStyle === 'solido'
        ? `sticky top-0 z-40 bg-white dark:bg-[#070E1C] border-b border-[#E2E8F0] dark:border-white/[0.08] no-print transition-shadow duration-200 ${scrollShadowClass}`
        : `sticky top-0 z-40 bg-white/[0.97] dark:bg-[#070E1C]/[0.96] backdrop-blur-xl border-b border-[#E2E8F0]/90 dark:border-white/[0.08] no-print transition-shadow duration-200 ${scrollShadowClass}`;

  const footerLogoSrc = empresa.logoDarkUrl || empresa.logoUrl;
  const headerLogoSrc = isDark ? (empresa.logoDarkUrl || empresa.logoUrl) : empresa.logoUrl;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-200">
      <header className={headerClass}>
        {/* Filete arquitetônico superior institucional (marinho + ouro champanhe) */}
        <div
          aria-hidden="true"
          className="h-[2px] w-full bg-gradient-to-r from-[#0B1628] via-[#B08D57] to-[#0B1628] dark:from-[#070E1C] dark:via-[#C9A86A] dark:to-[#070E1C]"
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-[62px] lg:h-[78px] flex items-center justify-between gap-4 lg:gap-8">
          {/* Zona 1: Marca Oficial (Emblema vetorial nítido + assinatura editorial em linha única) */}
          <a
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            aria-label={`${brandShortName} — Página inicial`}
            className="group flex items-center gap-3 sm:gap-3.5 min-w-0 whitespace-nowrap shrink-0 rounded-lg py-1 pr-1 focus-visible:outline-2 focus-visible:outline-[#0F3D91] dark:focus-visible:outline-[#C9A86A]"
          >
            {isOfficialDmBrand ? (
              <>
                <span className="relative flex items-center justify-center rounded-full p-[2px] bg-white dark:bg-[#0D1A2E] ring-1 ring-[#B08D57]/40 dark:ring-[#C9A86A]/45 shadow-[0_2px_10px_rgba(11,22,40,0.08)] dark:shadow-[0_2px_14px_rgba(0,0,0,0.45)] transition-all duration-200 group-hover:ring-[#B08D57]/75 dark:group-hover:ring-[#C9A86A]/80 shrink-0">
                  <BrandLogo
                    src={headerLogoSrc}
                    alt=""
                    brandShortName={brandShortName}
                    variant={isDark ? 'emblem-dark' : 'emblem'}
                    priority
                    imgClassName="h-9 w-9 sm:h-10 sm:w-10 lg:h-11 lg:w-11 object-contain shrink-0 transition-transform duration-200 group-hover:scale-[1.04]"
                  />
                </span>

                {isDefaultDmWordmark ? (
                  <span className="inline-flex items-center gap-2 sm:gap-2.5 whitespace-nowrap shrink-0">
                    <span className="font-display text-[17px] sm:text-[19px] lg:text-[21px] font-extrabold tracking-[-0.035em] text-[#0B1628] dark:text-white leading-none">
                      D<span className="text-[#B08D57] dark:text-[#C9A86A] mx-[1px]">&amp;</span>M
                    </span>
                    <span
                      aria-hidden="true"
                      className="h-4 w-px bg-[#CBD5E1] dark:bg-white/15 shrink-0"
                    />
                    <span className="font-display text-[14px] sm:text-[15.5px] lg:text-[16.5px] font-semibold tracking-[-0.015em] text-[#1E3A5F] dark:text-slate-200 leading-none">
                      Integra Chile
                    </span>
                  </span>
                ) : (
                  <span className="font-display text-[16px] sm:text-[18px] lg:text-[19px] font-bold tracking-[-0.025em] text-[#0B1628] dark:text-white whitespace-nowrap shrink-0">
                    {brandShortName}
                  </span>
                )}
              </>
            ) : (
              <>
                <BrandLogo
                  src={headerLogoSrc}
                  alt={empresa.nome_empresa}
                  brandShortName={brandShortName}
                  variant={isDark ? 'dark' : 'light'}
                  priority
                  imgStyle={{ height: `${logoHeight}px` }}
                  imgClassName="w-auto max-h-[42px] lg:max-h-[50px] max-w-[200px] sm:max-w-[240px] object-contain shrink-0"
                />
                {showBrandText && (
                  <span className="font-display text-base lg:text-lg font-bold tracking-tight text-[#0B1628] dark:text-white whitespace-nowrap truncate">
                    {brandShortName}
                  </span>
                )}
              </>
            )}
          </a>

          {/* Zona 2: Navegação Institucional (linha única, indicador arquitetônico alinhado à base) */}
          <nav className="hidden lg:flex items-center h-full gap-8 xl:gap-10" aria-label="Navegação principal">
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
                  aria-current={active ? 'page' : undefined}
                  className={`group relative h-full inline-flex items-center text-[13.5px] xl:text-sm whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    active
                      ? 'text-[#0B1628] dark:text-white font-semibold'
                      : 'text-[#475569] dark:text-slate-300 font-medium hover:text-[#0B1628] dark:hover:text-white'
                  }`}
                >
                  {item.localizedLabel}
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-[2px] transition-all duration-200 ${
                      active
                        ? 'bg-[#0F3D91] dark:bg-[#C9A86A] opacity-100'
                        : 'bg-[#0B1628]/25 dark:bg-white/30 opacity-0 group-hover:opacity-100'
                    }`}
                  />
                </a>
              );
            })}
          </nav>

          {/* Zona 3: Alternador discreto de tema + 1 CTA Primário + Menu Mobile */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <span
              aria-hidden="true"
              className="hidden lg:block h-6 w-px bg-[#E2E8F0] dark:bg-white/10 mr-1"
            />

            <button
              type="button"
              data-testid="navbar-theme-toggle"
              onClick={toggleTheme}
              aria-label={isDark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
              aria-pressed={isDark}
              title={isDark ? 'Modo Claro' : 'Modo Escuro'}
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[#E2E8F0] dark:border-white/10 bg-[#F8FAFC] dark:bg-white/[0.04] text-[#475569] dark:text-slate-300 hover:text-[#0B1628] dark:hover:text-white hover:border-[#B08D57]/55 dark:hover:border-[#C9A86A]/55 hover:bg-white dark:hover:bg-white/[0.08] transition-colors shrink-0"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-[#C9A86A]" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk(headerCtaDest)}
              onClick={handleHeaderCtaClick}
              className={`group hidden lg:inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-semibold tracking-[-0.01em] rounded-lg whitespace-nowrap shrink-0 transition-all duration-150 ${
                currentPath === headerCtaDest
                  ? 'bg-[#F1F5F9] dark:bg-white/[0.08] text-[#0B1628] dark:text-white border border-[#CBD5E1] dark:border-white/15'
                  : 'bg-[#0B1628] dark:bg-[#C9A86A] text-white dark:text-[#070E1C] border border-[#1B2D4B] dark:border-[#E2C992]/40 hover:bg-[#132542] dark:hover:bg-[#D8BA80] shadow-[0_1px_2px_rgba(11,22,40,0.14),0_6px_16px_-6px_rgba(11,22,40,0.28)]'
              }`}
            >
              {headerCtaLabel}
              {currentPath !== headerCtaDest && (
                <ArrowRight
                  className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              )}
            </button>

            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-lg border border-transparent hover:border-[#E2E8F0] dark:hover:border-white/10 text-[#0B1628] dark:text-slate-200 hover:bg-[#F1F5F9] dark:hover:bg-white/[0.06] min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
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
                    ? '¿Tienes dudas sobre tu visa, RUT o arriendo? Escríbenos sin compromiso.'
                    : 'Tem dúvidas sobre visto, RUT ou arriendo no Chile? Chame nossa equipe sem compromisso.'}
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
