import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock, RefreshCw, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface AuthGatePageProps {
  mode: 'cliente' | 'equipe';
  onNavigate: (path: string) => void;
}

const GoogleBrandMark: React.FC = () => (
  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A11.99 11.99 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.29 14.29A7.18 7.18 0 0 1 4.92 12c0-.8.14-1.57.37-2.29V6.61H1.29A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.29 5.39l4-3.1Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.61l4 3.1c.94-2.84 3.59-4.95 6.71-4.95Z"
    />
  </svg>
);

export const AuthGatePage: React.FC<AuthGatePageProps> = ({ mode, onNavigate }) => {
  const {
    userProfile,
    authLoading,
    authError,
    empresa,
    loginWithGoogle,
    logout,
    clearAuthError,
    refreshUserProfile,
  } = useApp();
  const [signingIn, setSigningIn] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);

  const isStaffActive =
    Boolean(userProfile) &&
    userProfile?.status === 'ativo' &&
    (userProfile?.role === 'admin' || userProfile?.role === 'consultor' || userProfile?.role === 'assistente');

  const isClientActive =
    Boolean(userProfile) &&
    userProfile?.role === 'cliente' &&
    userProfile?.status === 'ativo' &&
    Boolean(userProfile?.clientId);

  useEffect(() => {
    clearAuthError();
  }, [mode, clearAuthError]);

  useEffect(() => {
    if (authLoading || !userProfile) return;
    if (mode === 'equipe' && isStaffActive) {
      onNavigate('/painel');
    } else if (mode === 'cliente' && isClientActive) {
      onNavigate('/portal');
    } else if (mode === 'cliente' && isStaffActive) {
      onNavigate('/painel');
    }
  }, [authLoading, userProfile, mode, isStaffActive, isClientActive, onNavigate]);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      const profile = await loginWithGoogle();
      if (!profile) return;
      const staff =
        profile.status === 'ativo' &&
        (profile.role === 'admin' || profile.role === 'consultor' || profile.role === 'assistente');
      const client = profile.role === 'cliente' && profile.status === 'ativo' && Boolean(profile.clientId);
      if (staff) {
        onNavigate('/painel');
      } else if (client && mode === 'cliente') {
        onNavigate('/portal');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleCheckAccess = async () => {
    setCheckingAccess(true);
    try {
      await refreshUserProfile();
    } finally {
      setCheckingAccess(false);
    }
  };

  if (authLoading) {
    return (
      <div className="py-20 flex items-center justify-center">
        <div className="text-sm text-slate-600">Verificando sessão autenticada...</div>
      </div>
    );
  }

  return (
    <div className="py-16 lg:py-24 bg-[var(--color-bg)]">
      <div className="max-w-lg mx-auto px-4 sm:px-6">
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-8 text-center space-y-5 shadow-[0_12px_32px_rgba(11,31,51,0.06)]">
          {empresa.logoUrl ? (
            <img
              src={empresa.logoUrl}
              alt={empresa.nome_empresa}
              referrerPolicy="no-referrer"
              className="h-11 w-auto max-w-[180px] object-contain mx-auto"
            />
          ) : (
            <div
              className="w-12 h-12 btn-radius mx-auto flex items-center justify-center text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <ShieldCheck className="w-6 h-6" />
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#9A7B1C]">
              {mode === 'equipe' ? 'Painel Administrativo e Consultoria' : 'Portal Seguro do Cliente'}
            </p>
            <h1 className="text-2xl font-bold text-slate-900">
              {mode === 'equipe' ? 'Área da Equipe' : 'Acompanhar Meu Processo'}
            </h1>
          </div>

          {!userProfile ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                {mode === 'equipe'
                  ? 'Entre com sua conta Google autorizada (administrador, consultor ou assistente) para acessar o painel de gestão migratória.'
                  : 'Entre com a mesma conta Google utilizada no seu diagnóstico ou cadastro para acompanhar etapas, documentos, prazos e orçamentos.'}
              </p>

              {authError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C82333] text-left">
                  {authError}
                </div>
              )}

              <button
                type="button"
                disabled={signingIn}
                onClick={handleLogin}
                className="w-full inline-flex items-center justify-center gap-3 px-5 py-3 rounded-lg text-sm font-semibold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 transition-all shadow-xs"
              >
                <GoogleBrandMark />
                <span>{signingIn ? 'Conectando ao Google...' : 'Continuar com Google'}</span>
              </button>

              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-xs text-slate-500">
                  Acesso protegido via autenticação Google com e-mail verificado.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate(mode === 'equipe' ? '/acompanhar' : '/entrar-equipe')}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors"
                >
                  {mode === 'equipe' ? 'É cliente? Acessar Portal do Cliente' : 'É administrador ou consultor? Entrar na Área da Equipe'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : userProfile.status === 'inativo' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-[#C82333] text-sm flex items-start gap-2.5 text-left">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Acesso desativado</p>
                  <p className="text-xs mt-1">
                    Sua conta ({userProfile.email}) está inativa no momento. Entre em contato com nossa equipe para regularizar o acesso.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sair desta conta
              </button>
            </div>
          ) : mode === 'equipe' && userProfile.role === 'cliente' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm flex items-start gap-2.5 text-left">
                <UserCheck className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Conta autenticada como Cliente</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Você entrou com <strong>{userProfile.email}</strong>, que possui perfil de cliente e não tem permissão para o painel interno da equipe.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate(isClientActive ? '/portal' : '/acompanhar')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  {isClientActive ? 'Ir para Meu Portal' : 'Ver Status do Meu Processo'}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Trocar conta Google
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-sm flex items-start gap-2.5 text-left">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Acesso aguardando liberação</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    Olá, <strong>{userProfile.nome}</strong> ({userProfile.email}). Sua conta Google foi autenticada com sucesso; o acesso completo ao Portal do Cliente é liberado pela equipe após o diagnóstico ou a contratação da assessoria.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5">
                <button
                  type="button"
                  disabled={checkingAccess}
                  onClick={handleCheckAccess}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${checkingAccess ? 'animate-spin' : ''}`} />
                  {checkingAccess ? 'Verificando...' : 'Verificar liberação agora'}
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/diagnostico')}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Fazer Diagnóstico
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Trocar conta Google
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
