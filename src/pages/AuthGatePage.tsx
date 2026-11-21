import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Lock,
  LogIn,
  MessageCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import {
  fetchSignedInClientRecord,
  fetchSignedInUserDiagnosticLeads,
} from '../services/firestoreService';
import type { Client, Lead } from '../types/domain';
import { buildWhatsAppUrl, formatDateBR } from '../utils/formatters';
import {
  CONSULTANCY_PLANS,
  resolveClientPortalAccess,
  type BasicDiagnosticSummary,
} from '../utils/portalAccess';
import { BrandLogo } from '../components/BrandLogo';

interface AuthGatePageProps {
  mode: 'cliente' | 'equipe';
  onNavigate: (path: string) => void;
}

export const AuthGatePage: React.FC<AuthGatePageProps> = ({ mode, onNavigate }) => {
  const { userProfile, authLoading, authError, empresa, loginWithGoogle, logout, refreshUserProfile } = useApp();
  const [signingIn, setSigningIn] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [clientRecord, setClientRecord] = useState<Client | null>(null);
  const [userLeads, setUserLeads] = useState<Lead[]>([]);
  const [checkMsg, setCheckMsg] = useState<string | null>(null);

  const inspectClientAccess = useCallback(async () => {
    if (!userProfile || userProfile.role !== 'cliente') return;
    setCheckingAccess(true);
    try {
      const [cl, leads] = await Promise.all([
        fetchSignedInClientRecord(userProfile.uid, userProfile.email),
        fetchSignedInUserDiagnosticLeads(userProfile.email),
      ]);
      setClientRecord(cl);
      setUserLeads(leads);

      if (cl && cl.portalLiberado === true && !cl.arquivado) {
        if (userProfile.status !== 'ativo' || userProfile.clientId !== cl.id) {
          await refreshUserProfile();
        }
        onNavigate('/portal');
      }
    } finally {
      setCheckingAccess(false);
    }
  }, [userProfile, refreshUserProfile, onNavigate]);

  useEffect(() => {
    if (authLoading || !userProfile) return;
    if (userProfile.role === 'admin' || userProfile.role === 'consultor' || userProfile.role === 'assistente') {
      if (userProfile.status === 'ativo') {
        onNavigate('/painel');
      }
      return;
    }
    if (userProfile.role === 'cliente') {
      void inspectClientAccess();
    }
  }, [authLoading, userProfile, onNavigate, inspectClientAccess]);

  const handleLogin = async () => {
    setSigningIn(true);
    setCheckMsg(null);
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

  const handleManualVerify = async () => {
    setCheckMsg(null);
    setCheckingAccess(true);
    try {
      await refreshUserProfile();
      if (userProfile) {
        const [cl, leads] = await Promise.all([
          fetchSignedInClientRecord(userProfile.uid, userProfile.email),
          fetchSignedInUserDiagnosticLeads(userProfile.email),
        ]);
        setClientRecord(cl);
        setUserLeads(leads);
        if (cl && cl.portalLiberado === true && !cl.arquivado) {
          onNavigate('/portal');
          return;
        }
        if (cl && !cl.portalLiberado) {
          setCheckMsg('Seu cadastro foi localizado, mas o portal ainda consta como pendente de liberação na Área da Equipe.');
        } else {
          setCheckMsg('Nenhuma liberação ativa encontrada para este e-mail ainda. Confirme com o consultor o e-mail cadastrado.');
        }
      }
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

  const accessResolution =
    userProfile && userProfile.role === 'cliente'
      ? resolveClientPortalAccess({
          userProfile,
          client: clientRecord,
          leads: userLeads,
        })
      : null;

  const renderBasicDiagnosticCard = (basic: BasicDiagnosticSummary) => (
    <div className="text-left bg-slate-50 border border-slate-200 rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Resumo do Diagnóstico Gratuito
          </p>
          <h2 className="text-lg font-bold text-slate-900 mt-1">{basic.subcategoriaNome}</h2>
          {basic.dataCalculo && (
            <p className="text-xs text-slate-500 mt-0.5">Realizado em {formatDateBR(basic.dataCalculo)}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Viabilidade</p>
          <p className="text-3xl font-bold tabular-nums text-slate-900">
            {basic.notaViabilidade}
            <span className="text-sm font-normal text-slate-500">/100</span>
          </p>
          <p className="text-xs font-medium text-slate-600">Confiança {basic.confianca}</p>
        </div>
      </div>

      <p className="text-sm text-slate-700 leading-relaxed">{basic.resumoBasico}</p>

      {basic.temAlertaCritico && basic.alertaGeral && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{basic.alertaGeral}</p>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
          <Lock className="w-3.5 h-3.5 text-slate-600" />
          Informações técnicas restritas à consultoria contratada
        </div>
        <ul className="space-y-1.5 text-xs text-slate-600">
          {basic.itensBloqueados.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="text-slate-400">•</span>
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
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-900 border-slate-200'
              }`}
            >
              <div className="space-y-1.5">
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${isFull ? 'text-amber-300' : 'text-slate-500'}`}>
                  {plan.badgeLabel}
                </p>
                <h3 className="text-sm font-bold">{plan.nome}</h3>
                <p className={`text-xs leading-relaxed ${isFull ? 'text-slate-300' : 'text-slate-600'}`}>
                  {plan.subtitulo}
                </p>
              </div>
              <a
                href={buildWhatsAppUrl(empresa.whatsapp, waMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  isFull
                    ? 'bg-white text-slate-900 hover:bg-slate-100'
                    : 'bg-slate-900 text-white hover:bg-slate-800'
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
  );

  const isWideView =
    Boolean(userProfile) &&
    mode === 'cliente' &&
    (accessResolution?.kind === 'free_diagnostic_only' ||
      (accessResolution?.kind === 'pending_release' && Boolean(accessResolution.basicDiagnostic)));

  return (
    <div className="py-12 lg:py-20 bg-[var(--color-bg)]">
      <div className={`${isWideView ? 'max-w-3xl' : 'max-w-lg'} mx-auto px-4 sm:px-6`}>
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-6 sm:p-8 text-center space-y-5">
          <BrandLogo
            src={empresa.logoUrl}
            alt={empresa.nome_empresa}
            brandShortName={empresa.nome_empresa.split('–')[0].trim()}
            imgClassName="h-11 w-auto max-w-[180px] object-contain mx-auto"
            fallbackNode={
              <div
                className="w-12 h-12 btn-radius mx-auto flex items-center justify-center text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <ShieldCheck className="w-6 h-6" />
              </div>
            }
          />

          <h1 className="text-2xl font-bold text-slate-900">
            {mode === 'equipe' ? 'Área da Equipe — Acesso Restrito' : 'Portal do Cliente'}
          </h1>

          {!userProfile ? (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                {mode === 'equipe'
                  ? 'Entre com sua conta Google corporativa autorizada para acessar o painel de gestão migratória.'
                  : 'Entre com a mesma conta Google utilizada no diagnóstico gratuito ou no cadastro da sua consultoria.'}
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
          ) : accessResolution?.kind === 'inactive' || userProfile.status === 'inativo' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-[#C82333] text-sm flex items-start gap-2.5 text-left">
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
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Sair desta conta
              </button>
            </div>
          ) : mode === 'equipe' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-sm flex items-start gap-2.5 text-left">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
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
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Ir para Portal do Cliente
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
          ) : checkingAccess ? (
            <div className="py-6 text-sm text-slate-600 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Verificando liberação do seu Portal do Cliente...
            </div>
          ) : accessResolution?.kind === 'free_diagnostic_only' ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs flex flex-wrap items-center justify-between gap-3 text-left">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#1E7E34] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-900">
                      Acesso Diagnóstico Gratuito — {userProfile.email}
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      Usuários do diagnóstico gratuito visualizam apenas as informações básicas abaixo. Ao contratar a consultoria, seu portal completo é liberado aqui.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleManualVerify()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Já contratei — verificar
                </button>
              </div>

              {checkMsg && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 text-left">
                  {checkMsg}
                </div>
              )}

              {renderBasicDiagnosticCard(accessResolution.basicDiagnostic)}

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onNavigate('/diagnostico')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Refazer Diagnóstico
                  <ArrowRight className="w-3.5 h-3.5" />
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
          ) : accessResolution?.kind === 'pending_release' ? (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-sm flex items-start gap-2.5 text-left">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Portal aguardando liberação da equipe</p>
                  <p className="text-xs leading-relaxed">
                    Olá, <strong>{accessResolution.client.nomeCompleto}</strong> ({userProfile.email}). Seu cadastro na modalidade{' '}
                    <strong>{CONSULTANCY_PLANS[accessResolution.requestedModality].nome}</strong> foi localizado e aguarda a confirmação da liberação pelo consultor.
                  </p>
                </div>
              </div>

              {checkMsg && (
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 text-left">
                  {checkMsg}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleManualVerify()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap"
                  style={{ backgroundColor: 'var(--color-primary)' }}
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
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Trocar conta Google
                </button>
              </div>

              {accessResolution.basicDiagnostic && renderBasicDiagnosticCard(accessResolution.basicDiagnostic)}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-sm flex items-start gap-2.5 text-left">
                <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Cadastro ainda não localizado</p>
                  <p className="text-xs mt-1 leading-relaxed">
                    Olá, {userProfile.nome} ({userProfile.email}). Ainda não encontramos um diagnóstico ou contrato vinculado a este e-mail Google. Faça seu diagnóstico gratuito ou confirme com o consultor o e-mail informado na contratação.
                  </p>
                </div>
              </div>

              {checkMsg && (
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 text-left">
                  {checkMsg}
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleManualVerify()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verificar novamente
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('/diagnostico')}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Fazer Diagnóstico Gratuito
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
