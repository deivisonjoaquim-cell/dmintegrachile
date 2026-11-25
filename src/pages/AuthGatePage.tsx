import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  LogIn,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import { runDiagnosticEngine } from '../utils/diagnosticEngine';
import { buildWhatsAppUrl, formatDateBR } from '../utils/formatters';
import {
  buildBasicDiagnosticSummary,
  CONSULTANCY_PLANS,
  type BasicDiagnosticSummary,
} from '../utils/portalAccess';
import { BrandLogo, BrandRibbon } from '../components/BrandLogo';
import { ProfileIdentityDocumentsCard } from '../components/ProfileIdentityDocumentsCard';

interface AuthGatePageProps {
  mode: 'cliente' | 'equipe';
  onNavigate: (path: string) => void;
}

export const AuthGatePage: React.FC<AuthGatePageProps> = ({ mode, onNavigate }) => {
  const {
    userProfile,
    authLoading,
    authError,
    portalLeads,
    portalAccess,
    portalStage,
    portalAccessLoading,
    empresa,
    visaCategories,
    visaRequirements,
    legalSources,
    loginWithGoogle,
    logout,
    refreshClientPortalAccess,
  } = useApp();
  const { isDark } = useTheme();
  const [signingIn, setSigningIn] = useState(false);
  const [manualChecking, setManualChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const checkingAccess = portalAccessLoading || manualChecking;
  const userLeads = portalLeads;
  const accessResolution = portalAccess;

  // Transição centralizada pelo AppContext: equipe ativa -> /painel; cliente contratado -> /portal
  useEffect(() => {
    if (authLoading || !userProfile) return;
    if (userProfile.role === 'admin' || userProfile.role === 'consultor' || userProfile.role === 'assistente') {
      if (userProfile.status === 'ativo') {
        onNavigate('/painel');
      }
      return;
    }
    if (userProfile.role === 'cliente' && portalStage === 'contratado') {
      onNavigate('/portal');
    }
  }, [authLoading, userProfile, portalStage, onNavigate]);

  const handleLogin = async () => {
    setSigningIn(true);
    setCheckMsg(null);
    try {
      const profile = await loginWithGoogle();
      if (profile) {
        if ((profile.role === 'admin' || profile.role === 'consultor' || profile.role === 'assistente') && profile.status === 'ativo') {
          onNavigate('/painel');
        } else if (profile.role === 'cliente') {
          const resolved = await refreshClientPortalAccess();
          if (resolved?.kind === 'active_paid') {
            onNavigate('/portal');
          }
        }
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleManualVerify = async () => {
    setCheckMsg(null);
    setManualChecking(true);
    try {
      const resolved = await refreshClientPortalAccess();
      if (resolved?.kind === 'active_paid') {
        onNavigate('/portal');
        return;
      }
      if (resolved?.kind === 'pending_release') {
        setCheckMsg('Seu cadastro foi localizado, mas o portal ainda consta como pendente de liberação na Área da Equipe.');
      } else {
        setCheckMsg('Nenhuma liberação ativa encontrada para este e-mail ainda. Confirme com o consultor o e-mail cadastrado.');
      }
    } finally {
      setManualChecking(false);
    }
  };

  if (authLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="text-sm text-slate-600 dark:text-slate-300">Verificando sessão autenticada...</div>
      </div>
    );
  }

  const handleDownloadBasicDiagnosticPdf = async (basic: BasicDiagnosticSummary) => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setCheckMsg(null);
    try {
      const latestLead = [...userLeads].sort((a, b) =>
        (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''),
      )[0];
      const { exportClientDiagnosticPdf } = await import('../utils/clientDiagnosticPdf');
      if (latestLead?.respostasTriagem) {
        const result = runDiagnosticEngine(
          latestLead.respostasTriagem,
          visaCategories,
          visaRequirements,
          legalSources,
          empresa,
        );
        await exportClientDiagnosticPdf({
          empresa,
          result,
          answers: latestLead.respostasTriagem,
          summary: buildBasicDiagnosticSummary(result, latestLead.respostasTriagem),
          protocolo: latestLead.id,
        });
      } else {
        await exportClientDiagnosticPdf({
          empresa,
          summary: basic,
          protocolo: latestLead?.id,
        });
      }
    } catch (err) {
      setCheckMsg(err instanceof Error ? err.message : 'Não foi possível gerar o PDF do diagnóstico.');
    } finally {
      setPdfBusy(false);
    }
  };

  const renderBasicDiagnosticCard = (basic: BasicDiagnosticSummary) => (
    <div className="text-left bg-[#FAF9F6] dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl overflow-hidden space-y-0">
      <div className="bg-[#0B1F33] text-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E5C76B]">
            Resumo do Diagnóstico Gratuito
          </p>
          <h2 className="font-display text-xl font-bold text-white mt-1">{basic.subcategoriaNome}</h2>
          {basic.dataCalculo && (
            <p className="text-xs text-slate-300 mt-0.5 tabular-nums">
              Realizado em {formatDateBR(basic.dataCalculo)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Viabilidade</p>
          <p className="text-3xl font-bold font-mono tabular-nums text-[#E5C76B]">
            {basic.notaViabilidade}
            <span className="text-sm font-normal text-slate-300">/100</span>
          </p>
          <p className="text-xs font-medium text-slate-200">Confiança {basic.confianca}</p>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#0B1523] dark:text-slate-200 leading-relaxed flex-1 min-w-[220px]">{basic.resumoBasico}</p>
          <button
            type="button"
            disabled={pdfBusy}
            onClick={() => void handleDownloadBasicDiagnosticPdf(basic)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#C8A236] hover:bg-[#B89228] text-xs font-bold text-[#0B1523] whitespace-nowrap shrink-0 transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {pdfBusy ? 'Gerando PDF...' : 'Exportar Dossiê em PDF'}
          </button>
        </div>

        {basic.temAlertaCritico && basic.alertaGeral && (
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-700/50 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{basic.alertaGeral}</p>
          </div>
        )}

        <div className="bg-white dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F33] dark:text-white">
            <Lock className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
            Informações técnicas restritas à consultoria contratada
          </div>
          <ul className="space-y-1.5 text-xs text-[#4A5A6D] dark:text-slate-300">
            {basic.itensBloqueados.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-[#C8A236] font-bold">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {(['orientativa', 'completa'] as const).map((planKey) => {
            const plan = CONSULTANCY_PLANS[planKey];
            const isFull = planKey === 'completa';
            const waMsg = `Olá! Fiz o Diagnóstico Gratuito (${basic.subcategoriaNome} - ${basic.notaViabilidade}/100) com o e-mail ${userProfile?.email || ''} e tenho interesse na ${plan.nome}.`;
            return (
              <div
                key={plan.id}
                className={`rounded-xl p-4 border flex flex-col justify-between gap-3 ${
                  isFull
                    ? 'bg-[#0B1F33] text-white border-[#C8A236]/45'
                    : 'bg-white dark:bg-[#11263D] text-[#0B1F33] dark:text-white border-[#E5DFD2] dark:border-[#1C324B]'
                }`}
              >
                <div className="space-y-1.5">
                  <p className={`text-[11px] font-bold uppercase tracking-wider ${isFull ? 'text-[#E5C76B]' : 'text-[#8C6D14] dark:text-[#E5C76B]'}`}>
                    {plan.badgeLabel}
                  </p>
                  <h3 className="text-sm font-bold">{plan.nome}</h3>
                  <p className={`text-xs leading-relaxed ${isFull ? 'text-slate-300' : 'text-[#4A5A6D] dark:text-slate-300'}`}>
                    {plan.subtitulo}
                  </p>
                </div>
                <a
                  href={buildWhatsAppUrl(empresa.whatsapp, waMsg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                    isFull
                      ? 'bg-[#C8A236] text-[#0B1523] hover:bg-[#B89228]'
                      : 'bg-[#0B1F33] dark:bg-[#1B3A5C] text-white hover:opacity-95'
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Contratar {plan.nomeCurto}
                </a>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const isWideView =
    Boolean(userProfile) &&
    mode === 'cliente' &&
    (accessResolution?.kind === 'free_diagnostic_only' ||
      (accessResolution?.kind === 'pending_release' && Boolean(accessResolution.basicDiagnostic)));

  return (
    <div className="py-12 lg:py-20 bg-[var(--color-bg)]">
      <div className={`${isWideView ? 'max-w-3xl' : 'max-w-lg'} mx-auto px-4 sm:px-6`}>
        <div className="bg-[var(--color-surface)] border border-[#E5DFD2] dark:border-[#1C324B] card-radius overflow-hidden shadow-[0_8px_28px_rgba(11,31,51,0.06)] dark:shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
          <BrandRibbon className="h-[3px] w-full" />
          <div className="p-6 sm:p-8 text-center space-y-5">
          <BrandLogo
            src={empresa.logoUrl}
            alt={empresa.nome_empresa}
            brandShortName={empresa.nome_empresa.split('–')[0].trim()}
            variant={isDark ? 'dark' : 'light'}
            imgClassName="h-14 w-auto max-w-[260px] object-contain mx-auto"
            fallbackNode={
              <div
                className="w-12 h-12 btn-radius mx-auto flex items-center justify-center text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
            }
          />

          <h1 className="text-2xl font-bold text-[#0B1F33] dark:text-white">
            {mode === 'equipe' ? 'Área da Equipe — Acesso Restrito' : 'Portal do Cliente'}
          </h1>

          {!userProfile ? (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {mode === 'equipe'
                  ? 'Entre com sua conta Google corporativa autorizada para acessar o painel de gestão migratória.'
                  : 'Entre com a mesma conta Google utilizada no diagnóstico gratuito ou no cadastro da sua consultoria.'}
              </p>

              {authError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/35 border border-red-200 dark:border-red-800/60 text-xs text-[#C82333] dark:text-red-300 text-left">
                  {authError}
                </div>
              )}

              <button
                type="button"
                disabled={signingIn}
                onClick={handleLogin}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold text-white dark:text-[#0B1523] disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: isDark ? 'var(--color-accent)' : 'var(--color-primary)' }}
              >
                <LogIn className="w-4 h-4" />
                {signingIn ? 'Conectando ao Google...' : 'Entrar com Google'}
              </button>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Autenticação segura via Firebase Authentication (Google).
              </p>
            </>
          ) : accessResolution?.kind === 'inactive' || userProfile.status === 'inativo' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/35 border border-red-200 dark:border-red-800/60 text-[#C82333] dark:text-red-200 text-sm flex items-start gap-2.5 text-left">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Acesso desativado</p>
                  <p className="text-xs mt-1">
                    {accessResolution?.kind === 'inactive'
                      ? accessResolution.reason
                      : `Sua conta (${userProfile.email}) está inativa no momento. Entre em contato com nossa equipe.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#243E5C] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D]"
              >
                Sair desta conta
              </button>
            </div>
          ) : mode === 'equipe' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-700/50 text-amber-950 dark:text-amber-100 text-sm flex items-start gap-2.5 text-left">
                <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Conta sem permissão de equipe</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    A conta <strong>{userProfile.email}</strong> está cadastrada como cliente. Se você faz parte da equipe, entre com seu e-mail corporativo autorizado ou solicite ao administrador a alteração de perfil.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/acompanhar')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white dark:text-[#0B1523]"
                  style={{ backgroundColor: isDark ? 'var(--color-accent)' : 'var(--color-primary)' }}
                >
                  Ir para Portal do Cliente
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#243E5C] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D]"
                >
                  Trocar conta Google
                </button>
              </div>
            </div>
          ) : checkingAccess ? (
            <div className="py-6 text-sm text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Verificando liberação do seu Portal do Cliente...
            </div>
          ) : accessResolution?.kind === 'free_diagnostic_only' ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#11263D] border border-slate-200 dark:border-[#1C324B] text-slate-800 dark:text-slate-200 text-xs flex flex-wrap items-center justify-between gap-3 text-left">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#1E7E34] dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      Acesso Diagnóstico Gratuito — {userProfile.email}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 mt-0.5">
                      Usuários do diagnóstico gratuito visualizam apenas as informações básicas abaixo. Ao contratar a consultoria, seu portal completo é liberado aqui.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleManualVerify()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-[#243E5C] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#16304C] whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Já contratei — verificar
                </button>
              </div>

              {checkMsg && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-700/50 text-xs text-amber-900 dark:text-amber-100 text-left">
                  {checkMsg}
                </div>
              )}

              {renderBasicDiagnosticCard(accessResolution.basicDiagnostic)}

              <div className="text-left">
                <ProfileIdentityDocumentsCard userProfile={userProfile} compact />
              </div>

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/diagnostico')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-[#243E5C] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D]"
                >
                  Refazer Diagnóstico
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#243E5C] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D]"
                >
                  Trocar conta Google
                </button>
              </div>
            </div>
          ) : accessResolution?.kind === 'pending_release' ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-700/50 text-amber-950 dark:text-amber-100 text-sm flex items-start gap-2.5 text-left">
                <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Portal aguardando liberação da equipe</p>
                  <p className="text-xs leading-relaxed">
                    Olá, <strong>{accessResolution.client.nomeCompleto}</strong> ({userProfile.email}). Seu cadastro na modalidade{' '}
                    <strong>{CONSULTANCY_PLANS[accessResolution.requestedModality].nome}</strong> foi localizado e aguarda a confirmação da liberação pelo consultor.
                  </p>
                </div>
              </div>

              {checkMsg && (
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-[#11263D] border border-slate-200 dark:border-[#1C324B] text-xs text-slate-700 dark:text-slate-200 text-left">
                  {checkMsg}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleManualVerify()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white dark:text-[#0B1523] whitespace-nowrap"
                  style={{ backgroundColor: isDark ? 'var(--color-accent)' : 'var(--color-primary)' }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verificar liberação agora
                </button>
                <a
                  href={buildWhatsAppUrl(
                    empresa.whatsapp,
                    `Olá! Já estou logado com ${userProfile.email} no portal e gostaria de confirmar a liberação do meu acesso.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#1E7E34] text-white text-xs font-semibold whitespace-nowrap"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Falar no WhatsApp
                </a>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-[#243E5C] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D]"
                >
                  Trocar conta Google
                </button>
              </div>

              {accessResolution.basicDiagnostic && renderBasicDiagnosticCard(accessResolution.basicDiagnostic)}

              <div className="text-left">
                <ProfileIdentityDocumentsCard userProfile={userProfile} compact />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-700/50 text-amber-950 dark:text-amber-100 text-sm flex items-start gap-2.5 text-left">
                <Clock className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Cadastro ainda não localizado</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    Olá, {userProfile.nome} ({userProfile.email}). Ainda não encontramos um diagnóstico ou contrato vinculado a este e-mail Google. Faça seu diagnóstico gratuito ou confirme com o consultor o e-mail informado na contratação.
                  </p>
                </div>
              </div>

              {checkMsg && (
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-[#11263D] border border-slate-200 dark:border-[#1C324B] text-xs text-slate-700 dark:text-slate-200 text-left">
                  {checkMsg}
                </div>
              )}

              <div className="text-left">
                <ProfileIdentityDocumentsCard userProfile={userProfile} compact />
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleManualVerify()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-[#243E5C] text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verificar novamente
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/diagnostico')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white dark:text-[#0B1523]"
                  style={{ backgroundColor: isDark ? 'var(--color-accent)' : 'var(--color-primary)' }}
                >
                  Fazer Diagnóstico Gratuito
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2 rounded-lg border border-slate-300 dark:border-[#243E5C] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#11263D]"
                >
                  Trocar conta Google
                </button>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
