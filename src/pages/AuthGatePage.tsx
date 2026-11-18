import React, { useEffect, useState } from 'react';
import { Clock, LogIn, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

interface AuthGatePageProps {
  mode: 'cliente' | 'equipe';
  onNavigate: (path: string) => void;
}

export const AuthGatePage: React.FC<AuthGatePageProps> = ({ mode, onNavigate }) => {
  const { userProfile, authLoading, authError, empresa, loginWithGoogle, logout } = useApp();
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (!authLoading && userProfile) {
      if (userProfile.role === 'admin' || userProfile.role === 'consultor' || userProfile.role === 'assistente') {
        if (userProfile.status === 'ativo') {
          onNavigate('/painel');
        }
      } else if (userProfile.role === 'cliente' && userProfile.status === 'ativo' && userProfile.clientId) {
        onNavigate('/portal');
      }
    }
  }, [authLoading, userProfile, onNavigate]);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      const profile = await loginWithGoogle();
      if (profile) {
        if ((profile.role === 'admin' || profile.role === 'consultor' || profile.role === 'assistente') && profile.status === 'ativo') {
          onNavigate('/painel');
        } else if (profile.role === 'cliente' && profile.status === 'ativo' && profile.clientId) {
          onNavigate('/portal');
        }
      }
    } finally {
      setSigningIn(false);
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
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-8 text-center space-y-5">
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

          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'equipe' ? 'Área da Equipe — Acesso Restrito' : 'Acompanhar Meu Processo'}
          </h1>

          {!userProfile ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                {mode === 'equipe'
                  ? 'Entre com sua conta Google corporativa autorizada para acessar o painel de gestão migratória.'
                  : 'Entre com a mesma conta Google utilizada no diagnóstico ou cadastro para acompanhar etapas, documentos e orçamentos.'}
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
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <LogIn className="w-4 h-4" />
                {signingIn ? 'Conectando ao Google...' : 'Entrar com Google'}
              </button>

              <p className="text-xs text-slate-500">
                Autenticação segura via Firebase Authentication (Google).
              </p>
            </>
          ) : userProfile.status === 'inativo' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-[#C82333] text-sm flex items-start gap-2.5 text-left">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Acesso desativado</p>
                  <p className="text-xs mt-1">
                    Sua conta ({userProfile.email}) está inativa no momento. Entre em contato com nossa equipe.
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
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-sm flex items-start gap-2.5 text-left">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Acesso em análise / pendente de liberação</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    Olá, {userProfile.nome} ({userProfile.email}). Seu cadastro foi identificado, mas o acesso completo ao Portal do Cliente aguarda liberação manual pelo consultor após o diagnóstico ou contratação.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/diagnostico')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
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
