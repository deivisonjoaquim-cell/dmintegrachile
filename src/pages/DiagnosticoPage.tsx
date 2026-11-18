import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Check,
  Copy,
  HelpCircle,
  Lock,
  Plus,
  Trash2,
} from 'lucide-react';
import { CalendlyModal } from '../components/CalendlyModal';
import { DiagnosticReportView, type AiDiagnosticDraft } from '../components/DiagnosticReportView';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { useApp } from '../contexts/AppContext';
import { useFirestore } from '../hooks/useFirestore';
import {
  callAiEndpoint,
  generateSecureSessionToken,
} from '../services/firestoreService';
import type {
  DiagnosticAnswers,
  DiagnosticFamilyMemberInput,
  DiagnosticLocation,
  DiagnosticObjective,
  RiskFieldKey,
} from '../types/domain';
import {
  computeLeadPriorityAndTemperature,
  detectDiagnosticContradictions,
  getAdaptiveWizardMeta,
  runDiagnosticEngine,
  type DiagnosticResult,
} from '../utils/diagnosticEngine';
import { isValidWhatsApp, maskPhoneBR } from '../utils/formatters';
import {
  clearAiDraftCache,
  loadAiDraftCache,
  sanitizeClientAiError,
  saveAiDraftCache,
} from '../utils/aiClient';

interface DiagnosticoPageProps {
  onNavigate: (path: string) => void;
}

const STORAGE_KEY = 'dm_integra_diagnostico_rascunho_v2';
const SUBMIT_COOLDOWN_KEY = 'dm_integra_diag_last_submit_ms';

const INITIAL_ANSWERS: DiagnosticAnswers = {
  nome: '',
  whatsapp: '',
  email: '',
  cidadeUf: '',
  origem: 'Site',
  localizacao: 'No Brasil',
  faixaEtaria: 'maior_18',
  mesesResidenciaChile: 0,
  entradaRecenteChileTurista: false,
  nacionalidadeBrasileira: true,
  possuiSegundaNacionalidade: false,
  segundaNacionalidadeQual: '',
  passaporteStatus: 'valido',
  passaporteValidadeMeses: 24,
  vinculoFamiliarChile: false,
  vinculoTipo: 'Cônjuge/União Civil',
  vinculoFormalizado: false,
  composicaoFamiliar: 'individual',
  pessoasFamilia: [],
  objetivo: 'explorar',
  possuiOfertaTrabalhoFormal: false,
  possuiMatriculaReconhecida: false,
  possuiRendaPassiva: false,
  faixaRendaMensalUsd: '1000_2500',
  possuiCapitalComprovadoOrigem: false,
  titularTemResidenciaChile: false,
  overstay: null,
  ordenAbandono: null,
  rejeicaoAnterior: null,
  antecedentesCriminais: null,
  riscoConsultaConsultor: [],
  familiaAcompanhante: false,
  quantidadeDependentes: 0,
  prazoPretendido: '1 a 3 meses',
  documentosJaPossui: [],
  lgpdAceito: false,
  lgpdVersao: '1.0',
};

const DOC_OPTIONS = [
  'Passaporte válido (> 12 meses)',
  'Certidão de Nascimento / Casamento recente',
  'Contrato de trabalho ou carta de oferta',
  'Comprovantes de aposentadoria / renda',
  'Carta de matrícula em instituição chilena',
];

interface SavedDraftMeta {
  answers: DiagnosticAnswers;
  step: number;
  sessionToken?: string;
  leadId?: string;
  leadCreatedAt?: string;
  sessionCreatedAt?: string;
}

const ContextualHelp: React.FC<{
  title: string;
  text: string;
  sourceLabel?: string;
}> = ({ title, text, sourceLabel }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-primary)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 rounded"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        {title}
      </button>
      {open && (
        <div className="mt-2 p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-1">
          <p>{text}</p>
          {sourceLabel && <p className="text-[11px] font-semibold text-slate-600">Fonte legal: {sourceLabel}</p>}
        </div>
      )}
    </div>
  );
};

const BooleanChoice: React.FC<{
  label: string;
  value: boolean | null;
  onChange: (val: boolean | null) => void;
  helpTitle?: string;
  helpText?: string;
  sourceLabel?: string;
}> = ({ label, value, onChange, helpTitle, helpText, sourceLabel }) => (
  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <p className="text-sm font-medium text-slate-900">{label}</p>
      {helpTitle && helpText && <ContextualHelp title={helpTitle} text={helpText} sourceLabel={sourceLabel} />}
    </div>
    <div className="flex flex-wrap gap-2 pt-1">
      {[
        { label: 'Sim', val: true },
        { label: 'Não', val: false },
      ].map((opt) => {
        const active = value === opt.val;
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.val)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40 ${
              active
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
);

export const DiagnosticoPage: React.FC<DiagnosticoPageProps> = ({ onNavigate }) => {
  const {
    empresa,
    visaCategories,
    visaRequirements,
    legalSources,
    activeDiagnosticRules,
    firebaseUser,
    loginWithGoogle,
  } = useApp();

  const {
    saveDiagnostic: saveDiagnosticFirestore,
    saveDiagnosticSession: saveDiagnosticSessionFirestore,
    getDiagnosticSession: getDiagnosticSessionFirestore,
  } = useFirestore({ realtime: false });

  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState<DiagnosticAnswers>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedDraftMeta>;
        if (parsed.answers) {
          return { ...INITIAL_ANSWERS, ...parsed.answers, lgpdVersao: empresa.termoLgpdVersao || '1.0' };
        }
      }
    } catch {
      // ignore
    }
    return { ...INITIAL_ANSWERS, lgpdVersao: empresa.termoLgpdVersao || '1.0' };
  });

  const [sessionToken, setSessionToken] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedDraftMeta>;
        if (parsed.sessionToken && parsed.sessionToken.length >= 20) return parsed.sessionToken;
      }
    } catch {
      // ignore
    }
    return generateSecureSessionToken();
  });

  const [savedLeadId, setSavedLeadId] = useState<string | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return (JSON.parse(raw) as Partial<SavedDraftMeta>).leadId || null;
    } catch {
      // ignore
    }
    return null;
  });

  const [leadCreatedAt, setLeadCreatedAt] = useState<string | undefined>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return (JSON.parse(raw) as Partial<SavedDraftMeta>).leadCreatedAt;
    } catch {
      // ignore
    }
    return undefined;
  });

  const [sessionCreatedAt, setSessionCreatedAt] = useState<string | undefined>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return (JSON.parse(raw) as Partial<SavedDraftMeta>).sessionCreatedAt;
    } catch {
      // ignore
    }
    return undefined;
  });

  const [utm, setUtm] = useState<{ source?: string; medium?: string; campaign?: string }>({});
  const [honeypot, setHoneypot] = useState('');
  const [resumeBanner, setResumeBanner] = useState<string | null>(null);
  const [resumeUrlSaved, setResumeUrlSaved] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [calendlyOpen, setCalendlyOpen] = useState(false);
  const [lawOpen, setLawOpen] = useState(false);
  const [lgpdOpen, setLgpdOpen] = useState(false);

  // Refinamento opcional por IA
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<AiDiagnosticDraft | null>(null);

  const aiCacheKey = useMemo(
    () => `diagnostico_${savedLeadId && savedLeadId !== 'local-preview' ? savedLeadId : sessionToken || 'anon'}`,
    [savedLeadId, sessionToken],
  );

  useEffect(() => {
    if (!result) return;
    if (!aiDraft) {
      const cached = loadAiDraftCache<AiDiagnosticDraft>(aiCacheKey);
      if (cached) setAiDraft(cached);
    }
  }, [result, aiCacheKey]);

  const handleUpdateAiDraft = useCallback(
    (next: AiDiagnosticDraft) => {
      setAiDraft(next);
      saveAiDraftCache(aiCacheKey, next);
    },
    [aiCacheKey],
  );

  const engineOptions = useMemo(
    () => ({
      ruleVersion: activeDiagnosticRules,
      custosPadrao: empresa.custosPadrao,
      honorariosMinBrl: activeDiagnosticRules.honorariosMinBrl ?? empresa.honorariosPadraoMinBrl,
      honorariosMaxBrl: activeDiagnosticRules.honorariosMaxBrl ?? empresa.honorariosPadraoMaxBrl,
      taxaCambioBrlClp: activeDiagnosticRules.taxaCambioBrlClp ?? empresa.taxaCambioBrlClp,
      taxaCambioUsdBrl: activeDiagnosticRules.taxaCambioUsdBrl ?? empresa.taxaCambioUsdBrl,
    }),
    [activeDiagnosticRules, empresa],
  );

  // Carregar query string (UTM + ?retomar=TOKEN) ao montar
  useEffect(() => {
    const queryStr = window.location.search || (window.location.hash.includes('?') ? '?' + window.location.hash.split('?')[1] : '');
    const params = new URLSearchParams(queryStr);
    const utmSource = params.get('utm_source') || undefined;
    const utmMedium = params.get('utm_medium') || undefined;
    const utmCampaign = params.get('utm_campaign') || undefined;
    if (utmSource || utmMedium || utmCampaign) {
      setUtm({ source: utmSource, medium: utmMedium, campaign: utmCampaign });
    }

    const retomarToken = params.get('retomar');
    if (retomarToken) {
      void (async () => {
        const sess = await getDiagnosticSessionFirestore(retomarToken);
        if (!sess) {
          setResumeBanner('Link de retomada inválido ou expirado. Você pode preencher novamente ou reiniciar abaixo.');
          return;
        }
        setSessionToken(sess.id);
        setSessionCreatedAt(sess.createdAt);
        if (sess.leadId) setSavedLeadId(sess.leadId);
        if (sess.utm) setUtm(sess.utm);
        const restoredAnswers = { ...INITIAL_ANSWERS, ...sess.answers, lgpdVersao: empresa.termoLgpdVersao || '1.0' };
        setAnswers(restoredAnswers);
        setStep(sess.etapaAtual || 1);
        setResumeBanner('Diagnóstico retomado com sucesso a partir do seu link salvo.');
        setResumeUrlSaved(`${window.location.origin}/diagnostico?retomar=${sess.id}`);
        if (sess.concluido) {
          const diag = runDiagnosticEngine(restoredAnswers, visaCategories, visaRequirements, legalSources, engineOptions);
          setResult(diag);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvar rascunho local sempre que answers/step mudarem
  useEffect(() => {
    if (result) return;
    try {
      const payload: SavedDraftMeta = {
        answers,
        step,
        sessionToken,
        leadId: savedLeadId || undefined,
        leadCreatedAt,
        sessionCreatedAt,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, [answers, step, sessionToken, savedLeadId, leadCreatedAt, sessionCreatedAt, result]);

  // Ref para detectar abandono sem reiniciar em cada tecla
  const abandonRef = useRef({ answers, step, sessionToken, savedLeadId, leadCreatedAt, result, empresa, utm });
  abandonRef.current = { answers, step, sessionToken, savedLeadId, leadCreatedAt, result, empresa, utm };

  useEffect(() => {
    const handleBeforeUnload = () => {
      const cur = abandonRef.current;
      if (
        cur.result ||
        !cur.savedLeadId ||
        !cur.answers.nome.trim() ||
        !cur.answers.email.includes('@') ||
        !isValidWhatsApp(cur.answers.whatsapp)
      ) {
        return;
      }
      // Best-effort marca como Abandonado para criação interna de Task "Retomar contato"
      void saveDiagnosticFirestore(
        {
          nome: cur.answers.nome.trim(),
          whatsapp: cur.answers.whatsapp.trim(),
          email: cur.answers.email.trim().toLowerCase(),
          cidadeUf: cur.answers.cidadeUf.trim(),
          origem: cur.answers.origem,
          interesse: 'Diagnóstico interrompido',
          respostasTriagem: cur.answers,
          prioridade: 'Alta',
          statusConclusao: 'Abandonado',
          etapaAtual: cur.step,
          sessionToken: cur.sessionToken,
          utmSource: cur.utm.source,
          utmMedium: cur.utm.medium,
          utmCampaign: cur.utm.campaign,
          lgpdAceito: Boolean(cur.answers.lgpdAceito),
          lgpdVersao: cur.empresa.termoLgpdVersao || '1.0',
          lgpdData: new Date().toISOString(),
        },
        { existingLeadId: cur.savedLeadId, createdAt: cur.leadCreatedAt },
      ).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const adaptiveMeta = useMemo(() => getAdaptiveWizardMeta(answers), [answers]);
  const contradictions = useMemo(() => detectDiagnosticContradictions(answers), [answers]);

  const legalSourceText = useCallback(
    (id: string) => {
      const src = legalSources.find((s) => s.id === id);
      return src ? `${src.titulo} (${src.numeroAno})` : undefined;
    },
    [legalSources],
  );

  const persistProgressSession = async (targetStep: number, showResumeLink = false): Promise<string | null> => {
    const token = sessionToken.length >= 20 ? sessionToken : generateSecureSessionToken();
    if (token !== sessionToken) setSessionToken(token);

    let currentLeadId = savedLeadId;
    let currentLeadCreatedAt = leadCreatedAt;

    const hasValidContact =
      answers.nome.trim().length >= 2 && answers.email.includes('@') && isValidWhatsApp(answers.whatsapp);

    if (hasValidContact) {
      try {
        const up = await saveDiagnosticFirestore(
          {
            nome: answers.nome.trim(),
            whatsapp: answers.whatsapp.trim(),
            email: answers.email.trim().toLowerCase(),
            cidadeUf: answers.cidadeUf.trim(),
            origem: answers.origem,
            interesse: answers.objetivo || 'Pré-análise em andamento',
            respostasTriagem: answers,
            prioridade: 'Média',
            statusConclusao: 'Em andamento',
            etapaAtual: targetStep,
            sessionToken: token,
            utmSource: utm.source,
            utmMedium: utm.medium,
            utmCampaign: utm.campaign,
            lgpdAceito: Boolean(answers.lgpdAceito),
            lgpdVersao: empresa.termoLgpdVersao || '1.0',
            lgpdData: new Date().toISOString(),
          },
          currentLeadId ? { existingLeadId: currentLeadId, createdAt: currentLeadCreatedAt } : undefined,
        );
        currentLeadId = up.id;
        if (up.createdAt) {
          currentLeadCreatedAt = up.createdAt;
          setLeadCreatedAt(up.createdAt);
        }
        setSavedLeadId(up.id);
      } catch {
        // non-blocking for offline preview
      }
    }

    const expDays = Math.max(1, empresa.diasExpiracaoLinkDiagnostico || 30);
    const expiraEmMs = Date.now() + expDays * 86400000;
    try {
      const savedSess = await saveDiagnosticSessionFirestore(
        token,
        {
          etapaAtual: targetStep,
          answers,
          concluido: false,
          leadId: currentLeadId || '',
          expiraEmMs,
          utm,
          createdAt: sessionCreatedAt,
        },
        !sessionCreatedAt,
      );
      setSessionCreatedAt(savedSess.createdAt);
    } catch {
      // non-blocking
    }

    const url = `${window.location.origin}/diagnostico?retomar=${token}`;
    if (showResumeLink) {
      setResumeUrlSaved(url);
      navigator.clipboard?.writeText(url).catch(() => {});
    }
    return url;
  };

  const handleSaveAndCopyLink = async () => {
    setStepError(null);
    if (!answers.nome.trim() || !answers.email.includes('@') || !isValidWhatsApp(answers.whatsapp)) {
      setStepError('Preencha Nome, WhatsApp e E-mail válidos na Etapa 1 para gerar seu link de retomada.');
      return;
    }
    setSavingDraft(true);
    try {
      await persistProgressSession(step, true);
    } finally {
      setSavingDraft(false);
    }
  };

  const validateStep = (): boolean => {
    setStepError(null);
    if (step === 1) {
      if (answers.nome.trim().length < 2 || !answers.email.includes('@')) {
        setStepError('Informe seu nome completo e um e-mail válido para continuar.');
        return false;
      }
      if (!isValidWhatsApp(answers.whatsapp)) {
        setStepError('Informe um WhatsApp válido com DDD (ex.: +55 (11) 99999-0000 ou +56 9 8888 5566).');
        return false;
      }
    }
    if (step === 2 && answers.passaporteStatus !== 'nao_possui') {
      if (answers.passaporteValidadeMeses < 0 || Number.isNaN(answers.passaporteValidadeMeses)) {
        setStepError('Informe os meses aproximados de validade do passaporte (0 se vencido).');
        return false;
      }
    }
    if (step === 6) {
      if (!answers.lgpdAceito) {
        setStepError('É obrigatório aceitar o Termo LGPD para gerar o diagnóstico e registrar seu atendimento.');
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    const nextStep = Math.min(6, step + 1);
    setStep(nextStep);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (step === 1 || savedLeadId) {
      void persistProgressSession(nextStep, false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot.trim() !== '') {
      return;
    }
    if (!validateStep()) return;

    // Anti-spam cooldown (10s entre envios finais)
    try {
      const lastSub = Number(localStorage.getItem(SUBMIT_COOLDOWN_KEY) || '0');
      if (Date.now() - lastSub < 10000) {
        setStepError('Aguarde alguns segundos antes de enviar um novo diagnóstico.');
        return;
      }
      localStorage.setItem(SUBMIT_COOLDOWN_KEY, String(Date.now()));
    } catch {
      // ignore
    }

    setSubmitting(true);
    try {
      const diag = runDiagnosticEngine(answers, visaCategories, visaRequirements, legalSources, engineOptions);
      const { prioridade, temperatura } = computeLeadPriorityAndTemperature(answers, diag);
      const subLabel = diag.recomendada
        ? `${diag.recomendada.visa.codigo} - ${diag.recomendada.visa.nomePortugues}`
        : 'Análise complementar';

      const token = sessionToken.length >= 20 ? sessionToken : generateSecureSessionToken();
      if (token !== sessionToken) setSessionToken(token);

      let finalLeadId = savedLeadId || 'local-preview';
      try {
        const saved = await saveDiagnosticFirestore(
          {
            nome: answers.nome.trim(),
            whatsapp: answers.whatsapp.trim(),
            email: answers.email.trim().toLowerCase(),
            cidadeUf: answers.cidadeUf.trim(),
            origem: answers.origem,
            interesse: diag.recomendada?.visa.nomePortugues || 'Análise migratória',
            respostasTriagem: answers,
            subcategoriaSugerida: subLabel,
            notaViabilidade: diag.viabilidade.total,
            confianca: diag.confianca,
            temperatura,
            prioridade,
            flagsRisco: [
              ...diag.flagsRisco.map((f) => f.pergunta),
              ...diag.flagsRevisaoConsultor.map((f) => f.label),
            ],
            versaoRegras: diag.versaoRegras.versao,
            sessionToken: token,
            statusConclusao: 'Concluído',
            etapaAtual: 6,
            utmSource: utm.source,
            utmMedium: utm.medium,
            utmCampaign: utm.campaign,
            lgpdAceito: answers.lgpdAceito,
            lgpdVersao: empresa.termoLgpdVersao || '1.0',
            lgpdData: new Date().toISOString(),
          },
          savedLeadId && savedLeadId !== 'local-preview'
            ? { existingLeadId: savedLeadId, createdAt: leadCreatedAt }
            : undefined,
        );
        finalLeadId = saved.id;
        setSavedLeadId(saved.id);
        if (saved.createdAt) setLeadCreatedAt(saved.createdAt);
      } catch {
        // fallback preview
      }

      const expDays = Math.max(1, empresa.diasExpiracaoLinkDiagnostico || 30);
      await saveDiagnosticSessionFirestore(
        token,
        {
          etapaAtual: 6,
          answers,
          concluido: true,
          leadId: finalLeadId !== 'local-preview' ? finalLeadId : '',
          expiraEmMs: Date.now() + expDays * 86400000,
          utm,
          createdAt: sessionCreatedAt,
        },
        !sessionCreatedAt,
      ).catch(() => {});

      const finalUrl = `${window.location.origin}/diagnostico?retomar=${token}`;
      setResumeUrlSaved(finalUrl);
      setResult(diag);
      localStorage.removeItem(STORAGE_KEY);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefineAi = async () => {
    if (!result || aiLoading) return;
    setAiError(null);
    if (!firebaseUser) {
      const profile = await loginWithGoogle();
      if (!profile) {
        setAiError('Entre com sua conta Google para solicitar o rascunho orientativo por IA.');
        return;
      }
    }
    setAiLoading(true);
    setAiProgress('Iniciando análise...');
    try {
      const data = await callAiEndpoint<AiDiagnosticDraft>(
        '/api/ai/diagnostico',
        {
          answers,
          subcategoriaRecomendada: result.recomendada
            ? `${result.recomendada.visa.codigo} - ${result.recomendada.visa.nomePortugues}`
            : '',
          regrasAcionadas: result.regrasAcionadas,
          visaCategories: visaCategories.slice(0, 16).map((v) => ({
            codigo: v.codigo,
            nomePortugues: v.nomePortugues,
            permiteDentroChile: v.permiteDentroChile,
          })),
          legalSources: result.fontesLegais,
        },
        {
          onProgress: (msg) => setAiProgress(msg),
        },
      );
      setAiDraft(data);
      saveAiDraftCache(aiCacheKey, data);
    } catch (err) {
      setAiError(sanitizeClientAiError(err));
    } finally {
      setAiLoading(false);
      setAiProgress(null);
    }
  };

  const handleRestart = () => {
    clearAiDraftCache(aiCacheKey);
    setResult(null);
    setAiDraft(null);
    setAiError(null);
    setAiProgress(null);
    setSavedLeadId(null);
    setLeadCreatedAt(undefined);
    setSessionCreatedAt(undefined);
    setSessionToken(generateSecureSessionToken());
    setResumeUrlSaved(null);
    setResumeBanner(null);
    setStep(1);
    localStorage.removeItem(STORAGE_KEY);
    setAnswers({ ...INITIAL_ANSWERS, lgpdVersao: empresa.termoLgpdVersao || '1.0' });
  };

  const setSensitiveChoice = (field: RiskFieldKey, choice: 'sim' | 'nao' | 'consultor') => {
    const currentList = answers.riscoConsultaConsultor || [];
    if (choice === 'consultor') {
      setAnswers({
        ...answers,
        [field]: null,
        riscoConsultaConsultor: currentList.includes(field) ? currentList : [...currentList, field],
      });
    } else {
      setAnswers({
        ...answers,
        [field]: choice === 'sim',
        riscoConsultaConsultor: currentList.filter((k) => k !== field),
      });
    }
  };

  const addFamilyMember = () => {
    const existing = answers.pessoasFamilia || [];
    const next: DiagnosticFamilyMemberInput[] =
      existing.length === 0
        ? [
            { nome: answers.nome || 'Titular', papel: 'Titular', parentesco: 'Titular', nacionalidadeBrasileira: answers.nacionalidadeBrasileira !== false },
            { nome: '', papel: 'Dependente', parentesco: 'Cônjuge', nacionalidadeBrasileira: true },
          ]
        : [...existing, { nome: '', papel: 'Dependente', parentesco: 'Filho(a)', nacionalidadeBrasileira: true }];
    setAnswers({
      ...answers,
      pessoasFamilia: next,
      quantidadeDependentes: Math.max(1, next.filter((p) => p.papel === 'Dependente').length),
    });
  };

  const updateFamilyMember = (idx: number, patch: Partial<DiagnosticFamilyMemberInput>) => {
    const list = [...(answers.pessoasFamilia || [])];
    list[idx] = { ...list[idx], ...patch };
    setAnswers({ ...answers, pessoasFamilia: list });
  };

  const removeFamilyMember = (idx: number) => {
    const list = (answers.pessoasFamilia || []).filter((_, i) => i !== idx);
    setAnswers({
      ...answers,
      pessoasFamilia: list,
      quantidadeDependentes: Math.max(1, list.filter((p) => p.papel === 'Dependente').length),
    });
  };

  if (result) {
    return (
      <div className="py-10 lg:py-14 bg-[var(--color-bg)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <DiagnosticReportView
            mode="public"
            result={result}
            answers={answers}
            empresa={empresa}
            savedLeadId={savedLeadId}
            resumeUrl={resumeUrlSaved}
            aiDraft={aiDraft}
            aiLoading={aiLoading}
            aiProgress={aiProgress}
            aiError={aiError}
            onRefineAi={() => void handleRefineAi()}
            onUpdateAiDraft={handleUpdateAiDraft}
            onOpenLaw={() => setLawOpen(true)}
            onOpenCalendly={() => setCalendlyOpen(true)}
            onRestart={handleRestart}
            onNavigate={onNavigate}
          />
        </div>
        <CalendlyModal open={calendlyOpen} onClose={() => setCalendlyOpen(false)} />
        <LegalBaseModal open={lawOpen} onClose={() => setLawOpen(false)} sources={result.fontesLegais} />
      </div>
    );
  }

  return (
    <div className="py-10 lg:py-16 bg-[var(--color-bg)]">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <p className="text-xs font-semibold text-slate-600">
              Etapa {step} de 6 · Faltam {adaptiveMeta.faltamPerguntas} pergunta(s) · ~{adaptiveMeta.tempoEstimadoMinutos} min restante(s)
            </p>
            <span className="text-xs font-bold text-[var(--color-primary)] tabular-nums">
              {adaptiveMeta.percentualProgresso}% concluído
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Diagnóstico Inteligente de Elegibilidade Migratória
          </h1>
          <p className="text-sm text-slate-600">
            Questionário adaptativo: respondemos às normas chilenas exibindo apenas as perguntas relevantes para o seu perfil.
          </p>
          <div className="mt-4 h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={adaptiveMeta.percentualProgresso} aria-valuemin={0} aria-valuemax={100}>
            <div
              className="h-full transition-all duration-200"
              style={{ width: `${Math.max(10, adaptiveMeta.percentualProgresso)}%`, backgroundColor: 'var(--color-primary)' }}
            />
          </div>
        </div>

        {resumeBanner && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
            {resumeBanner}
          </div>
        )}

        {resumeUrlSaved && (
          <div className="mb-4 p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Link salvo para continuar depois (validade de {empresa.diasExpiracaoLinkDiagnostico || 30} dias):</p>
              <p className="text-[11px] text-slate-600 break-all mt-0.5">{resumeUrlSaved}</p>
            </div>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(resumeUrlSaved).catch(() => {})}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar link
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Anti-spam Honeypot oculto para humanos */}
          <div className="sr-only" aria-hidden="true">
            <label htmlFor="diag-website-hp">Não preencha este campo</label>
            <input
              id="diag-website-hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {stepError && (
            <div role="alert" className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-[#C82333]">
              {stepError}
            </div>
          )}

          {step > 1 && contradictions.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-1">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                Atenção: detectamos possível inconsistência nas respostas
              </p>
              {contradictions.map((c) => (
                <p key={c.codigo}>
                  <strong>{c.titulo}:</strong> {c.perguntaEsclarecimento}
                </p>
              ))}
            </div>
          )}

          {/* ETAPA 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-slate-900">1. Identificação e contato</h2>
                <span className="text-[11px] text-slate-500">LGPD: não solicitamos CPF nem nº de passaporte aqui.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-nome">
                    Nome completo *
                  </label>
                  <input
                    id="diag-nome"
                    required
                    value={answers.nome}
                    onChange={(e) => setAnswers({ ...answers, nome: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  />
                  {answers.nome && answers.nome.trim().length < 2 && (
                    <p className="text-[11px] text-[#C82333] mt-1">Digite seu nome completo.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-whats">
                    WhatsApp *
                  </label>
                  <input
                    id="diag-whats"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    value={answers.whatsapp}
                    onChange={(e) => setAnswers({ ...answers, whatsapp: maskPhoneBR(e.target.value) })}
                    placeholder="+55 (11) 99999-0000 ou +56 9 8888 5566"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  />
                  {answers.whatsapp ? (
                    isValidWhatsApp(answers.whatsapp) ? (
                      <p className="text-[11px] text-[#1E7E34] mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Número válido.
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-800 mt-1">
                        Complete o DDD + número. Para exterior/Chile comece com &quot;+&quot; (ex.: +56 9 ...).
                      </p>
                    )
                  ) : (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Para número do Chile ou exterior, comece digitando com &quot;+&quot; (ex.: +56 9 ...).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-email">
                    E-mail *
                  </label>
                  <input
                    id="diag-email"
                    type="email"
                    required
                    value={answers.email}
                    onChange={(e) => setAnswers({ ...answers, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                  />
                  {answers.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(answers.email.trim()) && (
                    <p className="text-[11px] text-amber-800 mt-1">Verifique o formato do e-mail (ex.: nome@dominio.com).</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-cidade">
                    Cidade / UF atual
                  </label>
                  <input
                    id="diag-cidade"
                    value={answers.cidadeUf}
                    onChange={(e) => setAnswers({ ...answers, cidadeUf: e.target.value })}
                    placeholder="Ex.: Rio de Janeiro - RJ"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-origem">
                    Como conheceu a D&amp;M?
                  </label>
                  <select
                    id="diag-origem"
                    value={answers.origem}
                    onChange={(e) => setAnswers({ ...answers, origem: e.target.value as DiagnosticAnswers['origem'] })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="Site">Site</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Indicação">Indicação</option>
                    <option value="Parceiro">Parceiro</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">2. Localização atual, perfil e passaporte</h2>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="diag-loc">
                    Onde você está neste momento?
                  </label>
                  <ContextualHelp
                    title="Por que perguntamos isso?"
                    text="A Ley 21.325 restringe a mudança de turista (Permanencia Transitoria) para residência de dentro do Chile, salvo exceções como Reunificação Familiar formalizada ou razões humanitárias."
                    sourceLabel={legalSourceText('leg_ley_21325')}
                  />
                </div>
                <select
                  id="diag-loc"
                  value={answers.localizacao}
                  onChange={(e) => setAnswers({ ...answers, localizacao: e.target.value as DiagnosticLocation })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="No Brasil">No Brasil</option>
                  <option value="No Chile como turista">No Chile como turista (Permanencia Transitoria)</option>
                  <option value="No Chile com residência">No Chile com residência vigente</option>
                  <option value="Em outro país">Em outro país</option>
                </select>
              </div>

              {answers.localizacao === 'No Chile com residência' && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="diag-meses-res">
                    Há quantos meses possui residência vigente no Chile?
                  </label>
                  <input
                    id="diag-meses-res"
                    type="number"
                    min={0}
                    max={240}
                    value={answers.mesesResidenciaChile ?? 0}
                    onChange={(e) => setAnswers({ ...answers, mesesResidenciaChile: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums bg-white"
                  />
                  <p className="text-[11px] text-slate-500">
                    Com menos de 24 meses avaliamos Prorrogação; a partir de 24 meses analisamos Residência Definitiva.
                  </p>
                </div>
              )}

              {(answers.localizacao === 'No Brasil' || answers.localizacao === 'Em outro país') && (
                <BooleanChoice
                  label="Esteve no Chile recentemente como turista e ainda possui saída ou pendência em aberto?"
                  value={answers.entradaRecenteChileTurista ?? false}
                  onChange={(val) => setAnswers({ ...answers, entradaRecenteChileTurista: val })}
                  helpTitle="Como isso afeta?"
                  helpText="Se houve permanência irregular recente ou saída não registrada na PDI, verificamos antes do novo protocolo."
                />
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-faixa-etaria">
                  Faixa etária do solicitante
                </label>
                <select
                  id="diag-faixa-etaria"
                  value={answers.faixaEtaria || 'maior_18'}
                  onChange={(e) => setAnswers({ ...answers, faixaEtaria: e.target.value as DiagnosticAnswers['faixaEtaria'] })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="maior_18">Maior de 18 anos</option>
                  <option value="menor_18_com_pais">Menor de 18 anos acompanhado dos pais</option>
                  <option value="menor_18_desacompanhado">Menor de 18 anos desacompanhado</option>
                </select>
              </div>

              <BooleanChoice
                label="Possui nacionalidade brasileira?"
                value={answers.nacionalidadeBrasileira}
                onChange={(val) => setAnswers({ ...answers, nacionalidadeBrasileira: val })}
                helpTitle="Por que o Acordo Mercosul importa?"
                helpText="Brasileiros têm direito ao Acordo Mercosul (Subcategoria 15), que permite trabalhar no Chile sem exigir oferta de emprego prévia nem comprovação de renda mínima."
                sourceLabel={legalSourceText('leg_acordo_mercosul')}
              />

              <BooleanChoice
                label="Possui segunda nacionalidade?"
                value={answers.possuiSegundaNacionalidade}
                onChange={(val) => setAnswers({ ...answers, possuiSegundaNacionalidade: val })}
              />

              {answers.possuiSegundaNacionalidade && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-seg-nac">
                    Qual segunda nacionalidade?
                  </label>
                  <input
                    id="diag-seg-nac"
                    value={answers.segundaNacionalidadeQual || ''}
                    onChange={(e) => setAnswers({ ...answers, segundaNacionalidadeQual: e.target.value })}
                    placeholder="Ex.: Italiana, Portuguesa"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                  />
                </div>
              )}

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-medium text-slate-900" htmlFor="diag-pass-status">
                    Situação atual do passaporte
                  </label>
                  <ContextualHelp
                    title="Por que perguntamos a validade?"
                    text="Solicitações de residência do exterior recomendam passaporte com validade mínima de 12 meses para evitar vencimento antes da emissão do Estampado Electrónico."
                  />
                </div>
                <select
                  id="diag-pass-status"
                  value={answers.passaporteStatus || 'valido'}
                  onChange={(e) => {
                    const st = e.target.value as NonNullable<DiagnosticAnswers['passaporteStatus']>;
                    setAnswers({
                      ...answers,
                      passaporteStatus: st,
                      passaporteValidadeMeses: st === 'valido' ? Math.max(12, answers.passaporteValidadeMeses || 24) : 0,
                    });
                  }}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="valido">Passaporte válido</option>
                  <option value="vencido">Passaporte vencido</option>
                  <option value="nao_possui">Ainda não possuo passaporte</option>
                </select>

                {answers.passaporteStatus !== 'nao_possui' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-pass">
                      Validade restante aproximada (em meses)
                    </label>
                    <input
                      id="diag-pass"
                      type="number"
                      min={0}
                      max={120}
                      value={answers.passaporteValidadeMeses}
                      onChange={(e) => setAnswers({ ...answers, passaporteValidadeMeses: Number(e.target.value) })}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm tabular-nums bg-white"
                    />
                    {answers.passaporteValidadeMeses > 0 && answers.passaporteValidadeMeses < 12 && (
                      <p className="text-[11px] text-amber-800 mt-1">
                        Atenção: validade menor que 12 meses reduz a pontuação de prontidão documental e recomenda renovação prévia.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ETAPA 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">3. Vínculos familiares no Chile</h2>
              <BooleanChoice
                label="Possui cônjuge, convivente civil, filho(a) chileno(a) ou pais residentes definitivos no Chile?"
                value={answers.vinculoFamiliarChile}
                onChange={(val) => setAnswers({ ...answers, vinculoFamiliarChile: val })}
                helpTitle="Por que perguntamos isso?"
                helpText="A Subcategoria 01 (Reunificação Familiar) é uma das únicas exceções que permitem solicitar residência mesmo estando no Chile como turista, desde que o vínculo esteja formalizado no papel."
                sourceLabel={legalSourceText('leg_dec_177_2022')}
              />

              {answers.vinculoFamiliarChile && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-vinc-tipo">
                      Tipo de vínculo
                    </label>
                    <select
                      id="diag-vinc-tipo"
                      value={answers.vinculoTipo}
                      onChange={(e) =>
                        setAnswers({ ...answers, vinculoTipo: e.target.value as DiagnosticAnswers['vinculoTipo'] })
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                      <option value="Cônjuge/União Civil">Cônjuge / União Civil</option>
                      <option value="Filho(a) chileno(a)">Filho(a) chileno(a)</option>
                      <option value="Pais/Dependente">Pais / Dependente direto</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <BooleanChoice
                    label="Esse vínculo já está juridicamente formalizado (casamento, Acuerdo de Unión Civil ou certidão registrada)?"
                    value={answers.vinculoFormalizado}
                    onChange={(val) => setAnswers({ ...answers, vinculoFormalizado: val })}
                    helpTitle="Importante sobre união informal"
                    helpText="Namoro ou convivência sem casamento/Acuerdo de Unión Civil registrado não ativa a Reunificação Familiar automaticamente."
                  />
                </>
              )}
            </div>
          )}

          {/* ETAPA 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">4. Objetivo principal no Chile</h2>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="block text-xs font-semibold text-slate-700" htmlFor="diag-obj">
                    Qual seu objetivo principal?
                  </label>
                  <ContextualHelp
                    title="Como usamos o objetivo?"
                    text="Filtramos automaticamente as perguntas seguintes conforme seu objetivo: quem escolhe estudar vê perguntas de matrícula, sem formulários desnecessários de empregador."
                    sourceLabel={legalSourceText('leg_dec_177_2022')}
                  />
                </div>
                <select
                  id="diag-obj"
                  value={answers.objetivo}
                  onChange={(e) => setAnswers({ ...answers, objetivo: e.target.value as DiagnosticObjective })}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="explorar">Explorar oportunidades / morar no Chile (Mercosul)</option>
                  <option value="trabalho_formal">Trabalho com oferta formal de empresa no Chile</option>
                  <option value="servicos_90d">Prestação de serviços acima de 90 dias</option>
                  <option value="nomade_digital">Trabalho remoto / Nômade digital</option>
                  <option value="empreender_investir">Empreender ou investir no Chile</option>
                  <option value="estudar">Estudar em instituição reconhecida</option>
                  <option value="aposentado_renda">Aposentado ou rentista (renda passiva)</option>
                  <option value="tratamento_medico">Tratamento médico no Chile</option>
                  <option value="religioso">Atividade religiosa</option>
                  <option value="humanitario">Razões humanitárias</option>
                  <option value="temporada">Trabalho de temporada</option>
                  <option value="dependente_titular">Sou dependente de um titular de residência</option>
                </select>
              </div>

              {(answers.objetivo === 'trabalho_formal' || answers.objetivo === 'servicos_90d') && (
                <BooleanChoice
                  label="Já possui contrato de trabalho assinado em Notaría no Chile ou carta de oferta formal?"
                  value={answers.possuiOfertaTrabalhoFormal}
                  onChange={(val) => setAnswers({ ...answers, possuiOfertaTrabalhoFormal: val })}
                />
              )}

              {answers.objetivo === 'estudar' && (
                <BooleanChoice
                  label="Já possui matrícula confirmada ou carta de aceitação de instituição chilena reconhecida?"
                  value={answers.possuiMatriculaReconhecida}
                  onChange={(val) => setAnswers({ ...answers, possuiMatriculaReconhecida: val })}
                  helpTitle="Regra da Subcategoria 03"
                  helpText="Sem carta de aceitação ou matrícula reconhecida pelo Estado chileno, a subcategoria de Estudantes não é ativada — priorizamos alternativas como o Acordo Mercosul."
                />
              )}

              {answers.objetivo === 'aposentado_renda' && (
                <div className="space-y-3">
                  <BooleanChoice
                    label="Possui comprovação mensal de aposentadoria ou renda passiva recorrente?"
                    value={answers.possuiRendaPassiva}
                    onChange={(val) => setAnswers({ ...answers, possuiRendaPassiva: val })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-renda">
                      Faixa aproximada da renda passiva mensal (USD)
                    </label>
                    <select
                      id="diag-renda"
                      value={answers.faixaRendaMensalUsd}
                      onChange={(e) =>
                        setAnswers({
                          ...answers,
                          faixaRendaMensalUsd: e.target.value as DiagnosticAnswers['faixaRendaMensalUsd'],
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                      <option value="abaixo_1000">Abaixo de USD 1.000/mês</option>
                      <option value="1000_2500">Entre USD 1.000 e USD 2.500/mês</option>
                      <option value="acima_2500">Acima de USD 2.500/mês</option>
                    </select>
                  </div>
                </div>
              )}

              {answers.objetivo === 'empreender_investir' && (
                <BooleanChoice
                  label="Possui capital com origem lícita comprovada (IR, extratos, contratos sociais) para investir no Chile?"
                  value={answers.possuiCapitalComprovadoOrigem}
                  onChange={(val) => setAnswers({ ...answers, possuiCapitalComprovadoOrigem: val })}
                  helpTitle="Exigência do SERMIG para Investidores"
                  helpText="A Subcategoria 13 exige comprovação formal da origem lícita dos recursos e plano de investimento. Sem essa comprovação, avaliamos alternativas como o Mercosul."
                />
              )}

              {answers.objetivo === 'dependente_titular' && (
                <BooleanChoice
                  label="O titular já possui residência vigente ou protocolo em andamento no Chile?"
                  value={answers.titularTemResidenciaChile}
                  onChange={(val) => setAnswers({ ...answers, titularTemResidenciaChile: val })}
                />
              )}
            </div>
          )}

          {/* ETAPA 5 (Perguntas Sensíveis isoladas) */}
          {step === 5 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">5. Histórico migratório e dados sensíveis</h2>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-700 flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[var(--color-primary)] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-slate-900">Aviso de Confidencialidade e Sigilo (Art. 11, LGPD)</p>
                  <p className="mt-1">
                    Estes dados sensíveis têm acesso restrito à consultoria para avaliar eventuais pendências técnicas. Caso prefira não detalhar agora, escolha &quot;Prefiro falar com o consultor&quot; — isso NÃO conta como risco positivo nem impede seu diagnóstico.
                  </p>
                </div>
              </div>

              {(
                [
                  {
                    key: 'overstay' as RiskFieldKey,
                    label: 'Já excedeu o prazo de permanência regular (Overstay) no Chile em alguma viagem anterior?',
                    helpTitle: 'O que significa Overstay?',
                    helpText: 'É permanecer no Chile além do prazo autorizado no cartão de entrada de turista (em geral 90 dias) ou após o vencimento de visto anterior, podendo gerar cálculo de multa migratória.',
                  },
                  {
                    key: 'ordenAbandono' as RiskFieldKey,
                    label: 'Já recebeu alguma Orden de Abandono ou notificação de expulsão?',
                    helpTitle: 'O que é Orden de Abandono?',
                    helpText: 'É uma resolução administrativa do SERMIG determinando a saída do território chileno em prazo fixado; exige análise jurídica individual antes de novo pedido.',
                  },
                  {
                    key: 'rejeicaoAnterior' as RiskFieldKey,
                    label: 'Teve algum pedido de visto ou residência rejeitado anteriormente pelo SERMIG?',
                    helpTitle: 'Por que perguntamos?',
                    helpText: 'Permite checar o motivo da negativa anterior (erro documental, falta de apostila ou requisito legal) e avaliar eventual recurso ou correção.',
                  },
                  {
                    key: 'antecedentesCriminais' as RiskFieldKey,
                    label: 'Possui alguma anotação ou ocorrência em certidão de antecedentes criminais?',
                    helpTitle: 'Exigência legal de antecedentes',
                    helpText: 'O Acordo Mercosul e a Ley 21.325 preveem apresentação de antecedentes criminais sem anotações graves ou com esclarecimento/reabilitação.',
                  },
                ] as const
              ).map((item) => {
                const isConsultor = (answers.riscoConsultaConsultor || []).includes(item.key);
                const val = answers[item.key];
                return (
                  <div key={item.key} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{item.label}</p>
                      <ContextualHelp
                        title={item.helpTitle}
                        text={item.helpText}
                        sourceLabel={legalSourceText('leg_ley_21325')}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setSensitiveChoice(item.key, 'sim')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          !isConsultor && val === true
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setSensitiveChoice(item.key, 'nao')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          !isConsultor && val === false
                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Não
                      </button>
                      <button
                        type="button"
                        onClick={() => setSensitiveChoice(item.key, 'consultor')}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                          isConsultor
                            ? 'bg-slate-800 text-white border-slate-800'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        Prefiro falar com o consultor
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ETAPA 6 */}
          {step === 6 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-slate-900">6. Família acompanhante, prazo e aceite LGPD</h2>

              <BooleanChoice
                label="Outras pessoas da família (cônjuge/filhos) viajarão ou solicitarão residência com você?"
                value={answers.familiaAcompanhante}
                onChange={(val) =>
                  setAnswers({
                    ...answers,
                    familiaAcompanhante: val,
                    composicaoFamiliar: val ? (answers.composicaoFamiliar === 'individual' ? 'casal' : answers.composicaoFamiliar) : 'individual',
                  })
                }
              />

              {answers.familiaAcompanhante && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-comp-fam">
                        Composição do grupo
                      </label>
                      <select
                        id="diag-comp-fam"
                        value={answers.composicaoFamiliar || 'casal'}
                        onChange={(e) =>
                          setAnswers({
                            ...answers,
                            composicaoFamiliar: e.target.value as DiagnosticAnswers['composicaoFamiliar'],
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                      >
                        <option value="casal">Casal (Titular + Cônjuge)</option>
                        <option value="familia_com_filhos">Família com filhos / dependentes</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-deps">
                        Quantidade de dependentes
                      </label>
                      <input
                        id="diag-deps"
                        type="number"
                        min={1}
                        max={12}
                        value={answers.quantidadeDependentes || 1}
                        onChange={(e) => setAnswers({ ...answers, quantidadeDependentes: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-700">Detalhamento por pessoa (opcional, gera checklist individual)</p>
                      <button
                        type="button"
                        onClick={addFamilyMember}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar familiar
                      </button>
                    </div>
                    {(answers.pessoasFamilia || []).map((p, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 text-xs">
                        <input
                          value={p.nome}
                          onChange={(e) => updateFamilyMember(idx, { nome: e.target.value })}
                          placeholder="Nome"
                          className="sm:col-span-4 px-2.5 py-1.5 rounded border border-slate-300"
                        />
                        <select
                          value={p.papel}
                          onChange={(e) => updateFamilyMember(idx, { papel: e.target.value as 'Titular' | 'Dependente' })}
                          className="sm:col-span-3 px-2 py-1.5 rounded border border-slate-300 bg-white"
                        >
                          <option value="Titular">Titular</option>
                          <option value="Dependente">Dependente</option>
                        </select>
                        <input
                          value={p.parentesco}
                          onChange={(e) => updateFamilyMember(idx, { parentesco: e.target.value })}
                          placeholder="Parentesco (Cônjuge, Filho)"
                          className="sm:col-span-3 px-2.5 py-1.5 rounded border border-slate-300"
                        />
                        <div className="sm:col-span-2 flex items-center justify-end gap-2">
                          <label className="flex items-center gap-1 text-[11px]">
                            <input
                              type="checkbox"
                              checked={p.nacionalidadeBrasileira}
                              onChange={(e) => updateFamilyMember(idx, { nacionalidadeBrasileira: e.target.checked })}
                            />
                            BR
                          </label>
                          <button
                            type="button"
                            onClick={() => removeFamilyMember(idx)}
                            aria-label="Remover familiar"
                            className="p-1 text-[#C82333] hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-prazo">
                  Prazo pretendido para iniciar o protocolo
                </label>
                <select
                  id="diag-prazo"
                  value={answers.prazoPretendido}
                  onChange={(e) =>
                    setAnswers({ ...answers, prazoPretendido: e.target.value as DiagnosticAnswers['prazoPretendido'] })
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="Imediato (até 30 dias)">Imediato (até 30 dias)</option>
                  <option value="1 a 3 meses">1 a 3 meses</option>
                  <option value="3 a 6 meses">3 a 6 meses</option>
                  <option value="Mais de 6 meses">Mais de 6 meses</option>
                </select>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-700 mb-2">Documentos que você já possui atualmente</p>
                <div className="space-y-2">
                  {DOC_OPTIONS.map((docLabel) => {
                    const checked = answers.documentosJaPossui.includes(docLabel);
                    return (
                      <label key={docLabel} className="flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? answers.documentosJaPossui.filter((d) => d !== docLabel)
                              : [...answers.documentosJaPossui, docLabel];
                            setAnswers({ ...answers, documentosJaPossui: next });
                          }}
                          className="rounded border-slate-300"
                        />
                        <span>{docLabel}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={answers.lgpdAceito}
                    onChange={(e) => setAnswers({ ...answers, lgpdAceito: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>
                    Li e concordo com o tratamento dos meus dados pessoais e sensíveis exclusivamente para fins de pré-análise migratória e contato da consultoria, conforme o{' '}
                    <button
                      type="button"
                      onClick={() => setLgpdOpen(true)}
                      className="font-semibold underline text-[var(--color-primary)]"
                    >
                      Termo LGPD (Versão {empresa.termoLgpdVersao || '1.0'})
                    </button>
                    . Você pode solicitar exclusão ou exportação dos seus dados a qualquer momento. *
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar
                </button>
              )}
              <button
                type="button"
                disabled={savingDraft}
                onClick={() => void handleSaveAndCopyLink()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <BookmarkCheck className="w-4 h-4 text-[var(--color-primary)]" />
                {savingDraft ? 'Salvando...' : 'Salvar e continuar depois'}
              </button>
            </div>

            {step < 6 ? (
              <button
                type="button"
                onClick={() => void handleNext()}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Avançar
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {submitting ? 'Calculando diagnóstico...' : 'Gerar Diagnóstico Inteligente'}
              </button>
            )}
          </div>
        </form>
      </div>

      {lgpdOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-semibold text-slate-900 mb-3">
              Termo LGPD – Versão {empresa.termoLgpdVersao || '1.0'}
            </h2>
            <div className="overflow-y-auto text-xs text-slate-700 whitespace-pre-wrap leading-relaxed border border-slate-200 rounded-lg p-4 bg-slate-50">
              {empresa.termoLgpd}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setLgpdOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
