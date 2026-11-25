import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookmarkCheck,
  Check,
  Compass,
  Copy,
  HelpCircle,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { BrandRibbon } from '../components/BrandLogo';
import { CalendlyModal } from '../components/CalendlyModal';
import { DiagnosticReportView, type AiDiagnosticDraft } from '../components/DiagnosticReportView';
import {
  DiagnosticOnboardingGuide,
  hasSeenDiagnosticOnboarding,
  markDiagnosticOnboardingSeen,
} from '../components/diagnostic/DiagnosticOnboardingGuide';
import { LiveDiagnosticRadarSidebar } from '../components/diagnostic/LiveDiagnosticRadarSidebar';
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
  isMercosulEligibleNationality,
  runDiagnosticEngine,
  type DiagnosticResult,
} from '../utils/diagnosticEngine';
import { isValidWhatsApp, maskPhoneBR } from '../utils/formatters';
import {
  clearAiDraftCache,
  compactLegalSourcesForAi,
  loadAiDraftCache,
  sanitizeClientAiError,
  saveAiDraftCache,
} from '../utils/aiClient';
import {
  buildLocalDiagnosticSynthesis,
  recordRuleEngineDecision,
  savePendingOfflineDiagnostic,
  setLocalAiRuntimeNotice,
} from '../utils/offlineRuleEngineStore';
import { formatLegalSourceWithJurisdiction } from '../utils/legalJurisdiction';
import {
  getDynamicDocumentOptions,
  getLiveSermigPreview,
  getResidentSubcategoryOptions,
  getSermigObjectiveMeta,
  sanitizeDiagnosticAnswers,
} from '../utils/sermigDiagnosticQuestions';

interface DiagnosticoPageProps {
  onNavigate: (path: string) => void;
}

const STORAGE_KEY = 'dm_integra_diagnostico_rascunho_v2';
const SUBMIT_COOLDOWN_KEY = 'dm_integra_diag_last_submit_ms';

const STEP_LABELS = [
  { num: 1, title: 'Contato' },
  { num: 2, title: 'Perfil & Passaporte' },
  { num: 3, title: 'Vínculos no Chile' },
  { num: 4, title: 'Objetivo SERMIG' },
  { num: 5, title: 'Histórico' },
  { num: 6, title: 'Documentos & LGPD' },
] as const;

const STEP_SERMIG_CONTEXT: Record<number, { foco: string; justificativa: string }> = {
  1: {
    foco: 'Identificação & link de retomada',
    justificativa: 'Permite salvar seu progresso por 30 dias e enviar o resumo técnico do seu diagnóstico.',
  },
  2: {
    foco: 'Elegibilidade territorial & nacionalidade',
    justificativa: 'A Ley Nº 21.325 exige protocolo do exterior na regra geral; brasileiros têm acesso à rota Mercosul.',
  },
  3: {
    foco: 'Vínculos familiares & dependentes',
    justificativa: 'Define exceções de pedido dentro do Chile (Reunificação) e o enquadramento de dependentes.',
  },
  4: {
    foco: 'Subcategoria de Residência Temporal',
    justificativa: 'Cruza seu objetivo real com as 16 subcategorias oficiais do Decreto Supremo Nº 177/2022.',
  },
  5: {
    foco: 'Triagem preventiva de impedimentos',
    justificativa: 'Detecta antecipadamente alertas de overstay, ordem de abandono ou antecedentes que exigem estratégia.',
  },
  6: {
    foco: 'Prontidão documental & autorização LGPD',
    justificativa: 'Calcula o que falta emitir/apostilar antes do protocolo e libera seu relatório técnico completo.',
  },
};

const COMMON_PROFILE_PRESETS: {
  id: string;
  label: string;
  detail: string;
  patch: Partial<DiagnosticAnswers>;
}[] = [
  {
    id: 'mercosul_br',
    label: 'Brasileiro indo pelo Mercosul',
    detail: 'No Brasil · Exploração/Mercosul',
    patch: {
      localizacao: 'No Brasil',
      nacionalidadeBrasileira: true,
      objetivo: 'explorar',
      possuiOfertaTrabalhoFormal: false,
      possuiRendaPassiva: false,
      composicaoFamiliar: 'individual',
      familiaAcompanhante: false,
      quantidadeDependentes: 0,
    },
  },
  {
    id: 'trabalho_cl',
    label: 'Proposta de Trabalho Formal',
    detail: 'Contrato com empresa chilena',
    patch: {
      localizacao: 'No Brasil',
      nacionalidadeBrasileira: true,
      objetivo: 'trabalho_formal',
      possuiOfertaTrabalhoFormal: true,
      composicaoFamiliar: 'individual',
      familiaAcompanhante: false,
      quantidadeDependentes: 0,
    },
  },
  {
    id: 'aposentado_renda',
    label: 'Aposentado / Renda Passiva',
    detail: 'Rentista ou jubilado',
    patch: {
      localizacao: 'No Brasil',
      nacionalidadeBrasileira: true,
      objetivo: 'aposentado_renda',
      possuiRendaPassiva: true,
      faixaRendaMensalUsd: 'acima_2500',
      composicaoFamiliar: 'individual',
      familiaAcompanhante: false,
      quantidadeDependentes: 0,
    },
  },
  {
    id: 'familia_mudanca',
    label: 'Mudança em Casal / Família',
    detail: 'Titular + dependentes',
    patch: {
      localizacao: 'No Brasil',
      nacionalidadeBrasileira: true,
      objetivo: 'explorar',
      composicaoFamiliar: 'familia_com_filhos',
      familiaAcompanhante: true,
      quantidadeDependentes: 2,
    },
  },
];

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
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2 p-3.5 rounded-xl bg-[#FAF9F6] border border-[#E5DFD2] text-xs text-[#4A5A6D] leading-relaxed space-y-1.5 shadow-[0_6px_18px_rgba(11,31,51,0.06)] origin-top"
          >
            <p className="text-[#0B1F33]">{text}</p>
            {sourceLabel && (
              <p className="text-[11px] font-semibold text-[#8C6D14] font-mono">
                Base normativa: {sourceLabel}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const BooleanChoice: React.FC<{
  label: string;
  value: boolean | null | undefined;
  onChange: (val: boolean | null) => void;
  helpTitle?: string;
  helpText?: string;
  sourceLabel?: string;
}> = ({ label, value, onChange, helpTitle, helpText, sourceLabel }) => (
  <div className="p-4 rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] space-y-2.5 transition-colors duration-200 hover:border-[#D4C9B3]">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <p className="text-sm font-semibold text-[#0B1F33] leading-snug">{label}</p>
      {helpTitle && helpText && <ContextualHelp title={helpTitle} text={helpText} sourceLabel={sourceLabel} />}
    </div>
    <div className="flex flex-wrap gap-2 pt-0.5">
      {[
        { label: 'Sim', val: true },
        { label: 'Não', val: false },
      ].map((opt) => {
        const active = value === opt.val;
        return (
          <motion.button
            key={opt.label}
            type="button"
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.14 }}
            onClick={() => onChange(opt.val)}
            className={`px-5 py-2 rounded-lg text-xs font-bold border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#0B1F33]/30 ${
              active
                ? 'bg-[#0B1F33] text-white border-[#0B1F33] shadow-[0_4px_12px_rgba(11,31,51,0.18)]'
                : 'bg-white text-slate-700 border-[#DDD6C7] hover:border-[#C8A236] hover:text-[#0B1F33]'
            }`}
          >
            {opt.label}
          </motion.button>
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
    userProfile,
    loginWithGoogle,
  } = useApp();

  const isAdmin = Boolean(userProfile && userProfile.status === 'ativo' && userProfile.role === 'admin');
  const [adminViewFull, setAdminViewFull] = useState(true);

  const {
    saveDiagnostic: saveDiagnosticFirestore,
    saveDiagnosticSession: saveDiagnosticSessionFirestore,
    getDiagnosticSession: getDiagnosticSessionFirestore,
  } = useFirestore({ realtime: false });

  const [step, setStep] = useState(1);
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);
  const [maxStepReached, setMaxStepReached] = useState(1);

  const navigateToStep = useCallback((nextStep: number) => {
    setStep((current) => {
      const clamped = Math.min(6, Math.max(1, nextStep));
      setStepDirection(clamped >= current ? 1 : -1);
      return clamped;
    });
  }, []);
  const [answers, setAnswers] = useState<DiagnosticAnswers>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SavedDraftMeta>;
        if (parsed.answers) {
          return sanitizeDiagnosticAnswers(
            { ...INITIAL_ANSWERS, lgpdVersao: empresa.termoLgpdVersao || '1.0' },
            parsed.answers,
          );
        }
      }
    } catch {
      // ignore
    }
    return { ...INITIAL_ANSWERS, lgpdVersao: empresa.termoLgpdVersao || '1.0' };
  });

  const updateAnswers = useCallback((patch: Partial<DiagnosticAnswers>) => {
    setAnswers((prev) => sanitizeDiagnosticAnswers(prev, patch));
  }, []);

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

  // Refs síncronos + fila de persistência para evitar corrida entre cliques rápidos de etapa e envio final
  const sessionTokenRef = useRef<string>(sessionToken);
  const savedLeadIdRef = useRef<string | null>(savedLeadId);
  const leadCreatedAtRef = useRef<string | undefined>(leadCreatedAt);
  const sessionCreatedAtRef = useRef<string | undefined>(sessionCreatedAt);
  const persistQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const enqueuePersist = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = persistQueueRef.current.then(task, task);
    persistQueueRef.current = next.catch(() => {});
    return next;
  }, []);

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
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  // Abre o guia interativo de 3 passos automaticamente na primeira visita ao Diagnóstico
  useEffect(() => {
    if (result) return;
    if (hasSeenDiagnosticOnboarding()) return;
    const queryStr =
      window.location.search || (window.location.hash.includes('?') ? '?' + window.location.hash.split('?')[1] : '');
    const params = new URLSearchParams(queryStr);
    if (params.get('retomar')) return;
    if (answers.nome.trim().length > 0 || step > 1) return;

    const timer = window.setTimeout(() => {
      setOnboardingOpen(true);
    }, 360);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseOnboarding = useCallback((dontShowAgain: boolean) => {
    if (dontShowAgain) {
      markDiagnosticOnboardingSeen();
    }
    setOnboardingOpen(false);
  }, []);

  const handleCompleteOnboarding = useCallback(() => {
    markDiagnosticOnboardingSeen();
    setOnboardingOpen(false);
    window.setTimeout(() => {
      const firstInput = document.getElementById('diag-nome');
      if (firstInput) {
        firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInput.focus({ preventScroll: true });
      }
    }, 180);
  }, []);

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
  }, [result, aiCacheKey, aiDraft]);

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
    const queryStr =
      window.location.search || (window.location.hash.includes('?') ? '?' + window.location.hash.split('?')[1] : '');
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
        sessionTokenRef.current = sess.id;
        sessionCreatedAtRef.current = sess.createdAt;
        setSessionToken(sess.id);
        setSessionCreatedAt(sess.createdAt);
        if (sess.leadId) {
          savedLeadIdRef.current = sess.leadId;
          setSavedLeadId(sess.leadId);
        }
        if (sess.utm) setUtm(sess.utm);
        const restoredAnswers = sanitizeDiagnosticAnswers(
          { ...INITIAL_ANSWERS, lgpdVersao: empresa.termoLgpdVersao || '1.0' },
          sess.answers,
        );
        setAnswers(restoredAnswers);
        const targetStep = Math.min(6, Math.max(1, sess.etapaAtual || 1));
        setStep(targetStep);
        setMaxStepReached((prev) => Math.max(prev, targetStep));
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
  }, [saveDiagnosticFirestore]);

  const adaptiveMeta = useMemo(() => getAdaptiveWizardMeta(answers), [answers]);
  const contradictions = useMemo(() => detectDiagnosticContradictions(answers), [answers]);
  const mercosulViaSegundaNac = useMemo(
    () => answers.nacionalidadeBrasileira === false && isMercosulEligibleNationality(answers),
    [answers],
  );
  const residentSubcatOptions = useMemo(() => getResidentSubcategoryOptions(visaCategories), [visaCategories]);
  const selectedResidentSubcat = useMemo(
    () => residentSubcatOptions.find((o) => o.codigo === answers.residenteSubcategoriaAtual),
    [residentSubcatOptions, answers.residenteSubcategoriaAtual],
  );
  const objectiveMeta = useMemo(
    () => getSermigObjectiveMeta(answers.objetivo, visaCategories, legalSources),
    [answers.objetivo, visaCategories, legalSources],
  );
  const dynamicDocs = useMemo(
    () => getDynamicDocumentOptions(answers, visaCategories, visaRequirements, legalSources, engineOptions),
    [answers, visaCategories, visaRequirements, legalSources, engineOptions],
  );
  const livePreview = useMemo(
    () => getLiveSermigPreview(answers, visaCategories, visaRequirements, legalSources, engineOptions),
    [answers, visaCategories, visaRequirements, legalSources, engineOptions],
  );
  const liveResult = useMemo(
    () => runDiagnosticEngine(answers, visaCategories, visaRequirements, legalSources, engineOptions),
    [answers, visaCategories, visaRequirements, legalSources, engineOptions],
  );
  const handleSimulatePublicAnswers = useCallback(
    (simAnswers: DiagnosticAnswers) =>
      runDiagnosticEngine(simAnswers, visaCategories, visaRequirements, legalSources, engineOptions),
    [visaCategories, visaRequirements, legalSources, engineOptions],
  );

  const legalSourceText = useCallback(
    (id: string) => {
      const src = legalSources.find((s) => s.id === id);
      return src ? formatLegalSourceWithJurisdiction(src) : undefined;
    },
    [legalSources],
  );

  const persistProgressSession = (targetStep: number, showResumeLink = false): Promise<string | null> => {
    const snapshotAnswers = { ...answers };
    const snapshotUtm = { ...utm };
    return enqueuePersist(async () => {
      const token =
        sessionTokenRef.current.length >= 20 ? sessionTokenRef.current : generateSecureSessionToken();
      if (token !== sessionTokenRef.current) {
        sessionTokenRef.current = token;
        setSessionToken(token);
      }

      let currentLeadId = savedLeadIdRef.current;
      let currentLeadCreatedAt = leadCreatedAtRef.current;

      const hasValidContact =
        snapshotAnswers.nome.trim().length >= 2 &&
        snapshotAnswers.email.includes('@') &&
        isValidWhatsApp(snapshotAnswers.whatsapp);

      if (hasValidContact) {
        try {
          const up = await saveDiagnosticFirestore(
            {
              nome: snapshotAnswers.nome.trim(),
              whatsapp: snapshotAnswers.whatsapp.trim(),
              email: snapshotAnswers.email.trim().toLowerCase(),
              cidadeUf: snapshotAnswers.cidadeUf.trim(),
              origem: snapshotAnswers.origem,
              interesse: snapshotAnswers.objetivo || 'Pré-análise em andamento',
              respostasTriagem: snapshotAnswers,
              prioridade: 'Média',
              statusConclusao: 'Em andamento',
              etapaAtual: targetStep,
              sessionToken: token,
              utmSource: snapshotUtm.source,
              utmMedium: snapshotUtm.medium,
              utmCampaign: snapshotUtm.campaign,
              lgpdAceito: Boolean(snapshotAnswers.lgpdAceito),
              lgpdVersao: empresa.termoLgpdVersao || '1.0',
              lgpdData: new Date().toISOString(),
            },
            currentLeadId && currentLeadId !== 'local-preview'
              ? { existingLeadId: currentLeadId, createdAt: currentLeadCreatedAt }
              : undefined,
          );
          currentLeadId = up.id;
          savedLeadIdRef.current = up.id;
          if (up.createdAt) {
            currentLeadCreatedAt = up.createdAt;
            leadCreatedAtRef.current = up.createdAt;
            setLeadCreatedAt(up.createdAt);
          }
          setSavedLeadId(up.id);
        } catch {
          // non-blocking for offline preview
        }
      }

      const expDays = Math.max(1, empresa.diasExpiracaoLinkDiagnostico || 30);
      const expiraEmMs = Date.now() + expDays * 86400000;
      const existingSessionCreatedAt = sessionCreatedAtRef.current;
      try {
        const savedSess = await saveDiagnosticSessionFirestore(
          token,
          {
            etapaAtual: targetStep,
            answers: snapshotAnswers,
            concluido: false,
            leadId: currentLeadId && currentLeadId !== 'local-preview' ? currentLeadId : '',
            expiraEmMs,
            utm: snapshotUtm,
            createdAt: existingSessionCreatedAt,
          },
          !existingSessionCreatedAt,
        );
        const resolvedCreatedAt = existingSessionCreatedAt || savedSess.createdAt;
        if (resolvedCreatedAt) {
          sessionCreatedAtRef.current = resolvedCreatedAt;
          setSessionCreatedAt(resolvedCreatedAt);
        }
      } catch {
        // non-blocking
      }

      const url = `${window.location.origin}/diagnostico?retomar=${token}`;
      if (showResumeLink) {
        setResumeUrlSaved(url);
        navigator.clipboard?.writeText(url).catch(() => {});
      }
      return url;
    });
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
        setStepError(
          'É obrigatório aceitar o Termo LGPD (Lei brasileira nº 13.709/2018) para gerar o diagnóstico e registrar seu atendimento.',
        );
        return false;
      }
    }
    return true;
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    const nextStep = Math.min(6, step + 1);
    navigateToStep(nextStep);
    setMaxStepReached((prev) => Math.max(prev, nextStep));
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
      const cleanAnswers = sanitizeDiagnosticAnswers(answers, {});
      const diag = runDiagnosticEngine(cleanAnswers, visaCategories, visaRequirements, legalSources, engineOptions);
      const { prioridade, temperatura } = computeLeadPriorityAndTemperature(cleanAnswers, diag);
      const subLabel = diag.recomendada
        ? `${diag.recomendada.visa.codigo} - ${diag.recomendada.visa.nomePortugues}`
        : 'Análise complementar';

      await enqueuePersist(async () => {
        const token =
          sessionTokenRef.current.length >= 20 ? sessionTokenRef.current : generateSecureSessionToken();
        if (token !== sessionTokenRef.current) {
          sessionTokenRef.current = token;
          setSessionToken(token);
        }

        let finalLeadId = savedLeadIdRef.current || 'local-preview';
        const existingLeadId =
          savedLeadIdRef.current && savedLeadIdRef.current !== 'local-preview'
            ? savedLeadIdRef.current
            : undefined;
        let savedToCloud = false;
        const submittedIso = new Date().toISOString();
        const combinedRiskFlags = [
          ...diag.flagsRisco.map((f) => f.pergunta),
          ...diag.flagsRevisaoConsultor.map((f) => f.label),
        ];
        const leadDataPayload = {
          nome: cleanAnswers.nome.trim(),
          whatsapp: cleanAnswers.whatsapp.trim(),
          email: cleanAnswers.email.trim().toLowerCase(),
          cidadeUf: cleanAnswers.cidadeUf.trim(),
          origem: cleanAnswers.origem,
          interesse: diag.recomendada?.visa.nomePortugues || 'Análise migratória',
          respostasTriagem: cleanAnswers,
          subcategoriaSugerida: subLabel,
          notaViabilidade: diag.viabilidade.total,
          confianca: diag.confianca,
          temperatura,
          prioridade,
          flagsRisco: combinedRiskFlags,
          versaoRegras: diag.versaoRegras.versao,
          sessionToken: token,
          statusConclusao: 'Concluído' as const,
          etapaAtual: 6,
          utmSource: utm.source,
          utmMedium: utm.medium,
          utmCampaign: utm.campaign,
          lgpdAceito: cleanAnswers.lgpdAceito,
          lgpdVersao: empresa.termoLgpdVersao || '1.0',
          lgpdData: submittedIso,
        };
        try {
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            throw new Error('offline');
          }
          const saved = await saveDiagnosticFirestore(
            leadDataPayload,
            existingLeadId
              ? { existingLeadId, createdAt: leadCreatedAtRef.current }
              : undefined,
          );
          finalLeadId = saved.id;
          savedLeadIdRef.current = saved.id;
          setSavedLeadId(saved.id);
          if (saved.createdAt) {
            leadCreatedAtRef.current = saved.createdAt;
            setLeadCreatedAt(saved.createdAt);
          }
          savedToCloud = true;
        } catch {
          savedToCloud = false;
        }

        const expDays = Math.max(1, empresa.diasExpiracaoLinkDiagnostico || 30);
        const existingSessionCreatedAt = sessionCreatedAtRef.current;
        const sessionPayload = {
          etapaAtual: 6,
          answers: cleanAnswers,
          concluido: true,
          expiraEmMs: Date.now() + expDays * 86400000,
          utm,
        };
        if (savedToCloud) {
          try {
            const savedSess = await saveDiagnosticSessionFirestore(
              token,
              {
                ...sessionPayload,
                leadId: finalLeadId !== 'local-preview' ? finalLeadId : '',
                createdAt: existingSessionCreatedAt,
              },
              !existingSessionCreatedAt,
            );
            const resolvedCreatedAt = existingSessionCreatedAt || savedSess.createdAt;
            if (resolvedCreatedAt) {
              sessionCreatedAtRef.current = resolvedCreatedAt;
              setSessionCreatedAt(resolvedCreatedAt);
            }
          } catch {
            // non-blocking
          }
        } else {
          // Persiste diagnóstico completo localmente para envio automático assim que a conexão retornar
          savePendingOfflineDiagnostic({
            id: `offdiag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            createdAt: submittedIso,
            sessionToken: token,
            existingLeadId,
            leadPayload: leadDataPayload,
            sessionPayload,
          });
        }

        // Registra a decisão do motor de regras no log interno local para auditoria e revisão da consultoria
        recordRuleEngineDecision({
          mode: savedToCloud ? 'online_nuvem' : 'offline',
          origin: 'diagnostico_publico',
          leadName: cleanAnswers.nome.trim(),
          leadEmail: cleanAnswers.email.trim().toLowerCase(),
          leadId: finalLeadId !== 'local-preview' ? finalLeadId : undefined,
          sessionToken: token,
          ruleVersion: diag.versaoRegras.versao,
          subcategoriaRecomendada: subLabel,
          notaViabilidade: diag.viabilidade.total,
          confianca: diag.confianca,
          regrasAcionadas: diag.regrasAcionadas,
          flagsRisco: combinedRiskFlags,
          fontesLegaisCitadas: diag.fontesLegais.map((f) => `${f.titulo}${f.numeroAno ? ` (${f.numeroAno})` : ''}`),
          motivoModoLocal: savedToCloud
            ? undefined
            : 'Diagnóstico gerado em modo local por falha de rede ou indisponibilidade da nuvem; aguardando sincronização.',
          syncStatus: savedToCloud ? 'sincronizado' : 'pendente',
        });

        const finalUrl = `${window.location.origin}/diagnostico?retomar=${token}`;
        setResumeUrlSaved(finalUrl);
      });
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
    const subLabel = result.recomendada
      ? `${result.recomendada.visa.codigo} - ${result.recomendada.visa.nomePortugues}`
      : 'Análise complementar';

    const applyLocalSynthesisFallback = (reason: string) => {
      const localDraft = buildLocalDiagnosticSynthesis(answers, result, reason);
      setAiDraft(localDraft);
      setLocalAiRuntimeNotice('local_rules', reason);
      recordRuleEngineDecision({
        mode: typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online_fallback_regras',
        origin: 'diagnostico_ia_regras',
        leadName: answers.nome?.trim() || undefined,
        leadEmail: answers.email?.trim().toLowerCase() || undefined,
        leadId: savedLeadId && savedLeadId !== 'local-preview' ? savedLeadId : undefined,
        sessionToken: sessionToken || undefined,
        ruleVersion: result.versaoRegras.versao,
        subcategoriaRecomendada: subLabel,
        notaViabilidade: result.viabilidade.total,
        confianca: result.confianca,
        regrasAcionadas: result.regrasAcionadas,
        flagsRisco: [
          ...result.flagsRisco.map((f) => f.pergunta),
          ...result.flagsRevisaoConsultor.map((f) => f.label),
        ],
        fontesLegaisCitadas: result.fontesLegais.map((f) => `${f.titulo}${f.numeroAno ? ` (${f.numeroAno})` : ''}`),
        motivoModoLocal: reason,
        syncStatus: 'pendente',
      });
    };

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      applyLocalSynthesisFallback(
        'Modo local offline ativo: sem conexão de rede para consultar a IA em nuvem. Orientações geradas diretamente pelas regras persistidas no dispositivo.',
      );
      return;
    }

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
      const sanitizedAnswersForAi = {
        localizacao: answers.localizacao,
        faixaEtaria: answers.faixaEtaria,
        mesesResidenciaChile: answers.mesesResidenciaChile,
        residenteSubcategoriaAtual: answers.residenteSubcategoriaAtual,
        residenteVenceEmDias: answers.residenteVenceEmDias,
        residenteMesesForaUltimoAno: answers.residenteMesesForaUltimoAno,
        entradaRecenteChileTurista: answers.entradaRecenteChileTurista,
        nacionalidadeBrasileira: answers.nacionalidadeBrasileira,
        possuiSegundaNacionalidade: answers.possuiSegundaNacionalidade,
        segundaNacionalidadeQual: answers.segundaNacionalidadeQual,
        passaporteStatus: answers.passaporteStatus,
        passaporteValidadeMeses: answers.passaporteValidadeMeses,
        vinculoFamiliarChile: answers.vinculoFamiliarChile,
        vinculoTipo: answers.vinculoTipo,
        familiarStatusChile: answers.familiarStatusChile,
        vinculoFormalizado: answers.vinculoFormalizado,
        composicaoFamiliar: answers.composicaoFamiliar,
        objetivo: answers.objetivo,
        possuiOfertaTrabalhoFormal: answers.possuiOfertaTrabalhoFormal,
        contratoNotariadoEmpresaChilena: answers.contratoNotariadoEmpresaChilena,
        possuiMatriculaReconhecida: answers.possuiMatriculaReconhecida,
        possuiRendaPassiva: answers.possuiRendaPassiva,
        faixaRendaMensalUsd: answers.faixaRendaMensalUsd,
        possuiCapitalComprovadoOrigem: answers.possuiCapitalComprovadoOrigem,
        investimentoAcima500kUsd: answers.investimentoAcima500kUsd,
        overstay: answers.overstay,
        ordenAbandono: answers.ordenAbandono,
        rejeicaoAnterior: answers.rejeicaoAnterior,
        antecedentesCriminais: answers.antecedentesCriminais,
        riscoConsultaConsultor: answers.riscoConsultaConsultor,
        familiaAcompanhante: answers.familiaAcompanhante,
        quantidadeDependentes: answers.quantidadeDependentes,
        prazoPretendido: answers.prazoPretendido,
        documentosJaPossui: answers.documentosJaPossui,
      };

      const data = await callAiEndpoint<AiDiagnosticDraft>(
        '/api/ai/diagnostico',
        {
          answers: sanitizedAnswersForAi,
          subcategoriaRecomendada: result.recomendada
            ? `${result.recomendada.visa.codigo} - ${result.recomendada.visa.nomePortugues}`
            : '',
          subcategoriaDetalhes: result.recomendada
            ? {
                codigo: result.recomendada.visa.codigo,
                nomePortugues: result.recomendada.visa.nomePortugues,
                nomeEspanhol: result.recomendada.visa.nomeEspanhol,
                permiteDentroChile: result.recomendada.visa.permiteDentroChile,
                permiteTrabalhar: result.recomendada.visa.permiteTrabalhar,
                levaDefinitiva: result.recomendada.visa.levaDefinitiva,
                mesesDefinitiva: result.recomendada.visa.mesesDefinitiva,
                motivo: result.recomendada.motivo,
              }
            : null,
          radarViabilidade: {
            total: result.viabilidade.total,
            veredito: result.viabilidade.veredito,
            confianca: result.confianca,
            dimensoes: result.viabilidade.dimensoes.map((d) => ({
              nome: d.nome,
              pontos: d.pontos,
              maximo: d.maximo,
              percentual: d.maximo > 0 ? Math.round((d.pontos / d.maximo) * 100) : 0,
              observacao: d.observacao,
            })),
          },
          alternativas: result.top3.slice(1, 3).map((alt) => ({
            codigo: alt.visa.codigo,
            nomePortugues: alt.visa.nomePortugues,
            nota: alt.nota,
            permiteDentroChile: alt.visa.permiteDentroChile,
          })),
          flagsRisco: result.flagsRisco.map((f) => ({
            campo: f.campo,
            severidade: f.severidade,
            orientacao: f.orientacao,
          })),
          flagsRevisaoConsultor: result.flagsRevisaoConsultor.map((f) => f.label),
          contradicoes: result.contradicoes.map((c) => c.titulo),
          alertas: result.alertas.slice(0, 8),
          prontidaoDocumental: {
            percentualInicial: result.checklistProntidao.percentualInicial,
            semaforo: result.checklistProntidao.semaforo,
            itensValidadeCurtaPendentes: result.checklistProntidao.itens
              .filter((i) => i.statusInicial === 'Crítico / Validade curta')
              .map((i) => i.nomeDocumento),
          },
          regrasAcionadas: result.regrasAcionadas,
          visaCategories: visaCategories.slice(0, 16).map((v) => ({
            codigo: v.codigo,
            nomePortugues: v.nomePortugues,
            permiteDentroChile: v.permiteDentroChile,
          })),
          legalSources: compactLegalSourcesForAi(result.fontesLegais),
        },
        {
          onProgress: (msg) => setAiProgress(msg),
        },
      );
      setAiDraft(data);
      saveAiDraftCache(aiCacheKey, data);
    } catch (err) {
      const msg = sanitizeClientAiError(err);
      if (
        (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        msg.includes('Tempo limite excedido') ||
        msg.includes('Falha de conexão') ||
        msg.includes('Não foi possível gerar o rascunho agora')
      ) {
        applyLocalSynthesisFallback(
          'Conexão com o servidor de IA indisponível no momento. Orientações geradas automaticamente pelo motor local de regras persistido.',
        );
      } else {
        setAiError(msg);
      }
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
    const freshToken = generateSecureSessionToken();
    savedLeadIdRef.current = null;
    leadCreatedAtRef.current = undefined;
    sessionCreatedAtRef.current = undefined;
    sessionTokenRef.current = freshToken;
    setSavedLeadId(null);
    setLeadCreatedAt(undefined);
    setSessionCreatedAt(undefined);
    setSessionToken(freshToken);
    setResumeUrlSaved(null);
    setResumeBanner(null);
    setStep(1);
    setMaxStepReached(1);
    localStorage.removeItem(STORAGE_KEY);
    setAnswers({ ...INITIAL_ANSWERS, lgpdVersao: empresa.termoLgpdVersao || '1.0' });
  };

  const setSensitiveChoice = (field: RiskFieldKey, choice: 'sim' | 'nao' | 'consultor') => {
    const currentList = answers.riscoConsultaConsultor || [];
    if (choice === 'consultor') {
      updateAnswers({
        [field]: null,
        riscoConsultaConsultor: currentList.includes(field) ? currentList : [...currentList, field],
      });
    } else {
      updateAnswers({
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
            {
              nome: answers.nome || 'Titular',
              papel: 'Titular',
              parentesco: 'Titular',
              nacionalidadeBrasileira: answers.nacionalidadeBrasileira !== false,
            },
            { nome: '', papel: 'Dependente', parentesco: 'Cônjuge', nacionalidadeBrasileira: true },
          ]
        : [...existing, { nome: '', papel: 'Dependente', parentesco: 'Filho(a)', nacionalidadeBrasileira: true }];
    updateAnswers({
      pessoasFamilia: next,
      quantidadeDependentes: Math.max(1, next.filter((p) => p.papel === 'Dependente').length),
    });
  };

  const updateFamilyMember = (idx: number, patch: Partial<DiagnosticFamilyMemberInput>) => {
    const list = [...(answers.pessoasFamilia || [])];
    list[idx] = { ...list[idx], ...patch };
    updateAnswers({ pessoasFamilia: list });
  };

  const removeFamilyMember = (idx: number) => {
    const list = (answers.pessoasFamilia || []).filter((_, i) => i !== idx);
    updateAnswers({
      pessoasFamilia: list,
      quantidadeDependentes: Math.max(1, list.filter((p) => p.papel === 'Dependente').length),
    });
  };

  if (result) {
    const effectiveMode: 'public' | 'consultant' = isAdmin && adminViewFull ? 'consultant' : 'public';
    return (
      <MotionConfig reducedMotion="user">
        <div className="py-10 lg:py-14 bg-[var(--color-bg)]">
          <motion.div
            initial={{ opacity: 0, scale: 0.982, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-6xl mx-auto px-4 sm:px-6 space-y-5"
          >
          {isAdmin && (
            <div className="no-print bg-white border border-[#E5DFD2] rounded-xl overflow-hidden shadow-xs">
              <BrandRibbon className="h-[2.5px] w-full" />
              <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#0B1F33]">
                  <ShieldCheck className="w-4 h-4 text-[#146B43] shrink-0" />
                  <span>
                    <strong>Acesso Administrador:</strong> o cliente final visualiza apenas o resumo básico; você pode alternar para conferir o relatório completo.
                  </span>
                </div>
                <div className="inline-flex rounded-lg border border-[#DDD6C7] bg-[#F7F5F0] p-0.5">
                  <button
                    type="button"
                    onClick={() => setAdminViewFull(false)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                      !adminViewFull ? 'bg-[#0B1F33] text-white' : 'text-slate-700 hover:text-[#0B1F33]'
                    }`}
                  >
                    Visão do Cliente (Básica)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdminViewFull(true)}
                    className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                      adminViewFull ? 'bg-[#0B1F33] text-white' : 'text-slate-700 hover:text-[#0B1F33]'
                    }`}
                  >
                    Diagnóstico Completo (Admin)
                  </button>
                </div>
              </div>
            </div>
          )}

          <DiagnosticReportView
            mode={effectiveMode}
            result={result}
            answers={answers}
            empresa={empresa}
            savedLeadId={savedLeadId}
            resumeUrl={resumeUrlSaved}
            aiDraft={isAdmin ? aiDraft : null}
            aiLoading={isAdmin ? aiLoading : false}
            aiProgress={isAdmin ? aiProgress : null}
            aiError={isAdmin ? aiError : null}
            onRefineAi={isAdmin ? () => void handleRefineAi() : undefined}
            onUpdateAiDraft={isAdmin ? handleUpdateAiDraft : undefined}
            onOpenLaw={isAdmin ? () => setLawOpen(true) : undefined}
            onOpenCalendly={() => setCalendlyOpen(true)}
            onRestart={handleRestart}
            onNavigate={onNavigate}
            onSimulatePublicAnswers={handleSimulatePublicAnswers}
          />
          </motion.div>
          <CalendlyModal open={calendlyOpen} onClose={() => setCalendlyOpen(false)} />
          {isAdmin && (
            <LegalBaseModal
              open={lawOpen}
              onClose={() => setLawOpen(false)}
              title="Base Legal Consultada — Legislação Chilena, Brasileira e Mercosul"
              sources={result.fontesLegais}
            />
          )}
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="py-8 lg:py-12 bg-[var(--color-bg)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-6">
        {/* Cabeçalho Executivo em Azul Marinho & Ouro */}
        <section className="rounded-2xl overflow-hidden border border-[#1E3349] bg-[#0B1F33] text-white shadow-[0_14px_34px_rgba(11,31,51,0.12)]">
          <BrandRibbon className="h-[3px] w-full" />
          <div className="px-6 sm:px-8 py-6 sm:py-7 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-2 max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#E6C55A]">
                  Diagnóstico Completo em 6 Etapas · Ley Nº 21.325 &amp; Acordo Mercosul · Proteção LGPD
                </p>
                <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white leading-[1.12] text-balance">
                  Diagnóstico Inteligente de Elegibilidade Migratória
                </h1>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Acompanhe seu índice de viabilidade calculado em tempo real enquanto responde às 6 etapas. Ao final, explore o gráfico radar, teste cenários no simulador &ldquo;E se...&rdquo; e baixe seu Dossiê em PDF.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 shrink-0 border-t lg:border-t-0 border-white/10 pt-3 lg:pt-0">
                <button
                  type="button"
                  onClick={() => setOnboardingOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-xl border border-[#E6C55A]/35 bg-white/[0.07] hover:bg-white/[0.13] text-xs font-semibold text-[#E6C55A] transition-colors whitespace-nowrap shrink-0"
                >
                  <Compass className="w-3.5 h-3.5 shrink-0" />
                  Guia rápido
                </button>
                <div className="text-left lg:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Progresso da análise
                  </p>
                  <p className="font-mono text-2xl font-bold text-[#E6C55A] tabular-nums">
                    {adaptiveMeta.percentualProgresso}%
                  </p>
                  <p className="text-[11px] text-slate-300 tabular-nums">
                    Etapa {step} de 6 · ~{adaptiveMeta.tempoEstimadoMinutos}{' '}
                    {adaptiveMeta.tempoEstimadoMinutos === 1 ? 'min' : 'min'} restante(s)
                  </p>
                </div>
              </div>
            </div>

            {/* Trilha de progresso contínua */}
            <div
              className="h-1.5 rounded-full bg-white/15 overflow-hidden"
              role="progressbar"
              aria-valuenow={adaptiveMeta.percentualProgresso}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#C8A236] via-[#E6C55A] to-[#C8A236]"
                initial={false}
                animate={{ width: `${Math.max(10, adaptiveMeta.percentualProgresso)}%` }}
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>

            {/* Navegação clicável das 6 etapas */}
            <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" aria-label="Etapas do diagnóstico">
              {STEP_LABELS.map((item) => {
                const isCurrent = step === item.num;
                const isReachable = item.num <= maxStepReached;
                const isDone = item.num < step;
                return (
                  <motion.button
                    key={item.num}
                    type="button"
                    disabled={!isReachable}
                    whileHover={isReachable ? { y: -1.5, scale: 1.01 } : undefined}
                    whileTap={isReachable ? { scale: 0.98 } : undefined}
                    transition={{ duration: 0.16 }}
                    onClick={() => {
                      if (isReachable) {
                        setStepError(null);
                        navigateToStep(item.num);
                      }
                    }}
                    className={`px-3 py-2.5 rounded-xl border text-left text-xs transition-colors duration-200 ${
                      isCurrent
                        ? 'bg-white text-[#0B1F33] border-[#C8A236] font-bold shadow-[0_6px_18px_rgba(200,162,54,0.22)]'
                        : isDone
                          ? 'bg-white/10 text-white border-emerald-400/40 hover:bg-white/15 font-medium'
                          : isReachable
                            ? 'bg-white/[0.06] text-slate-200 border-white/15 hover:bg-white/10'
                            : 'bg-white/[0.03] text-slate-500 border-white/10 cursor-not-allowed'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-1 text-[10px] font-mono tabular-nums opacity-80">
                      <span>0{item.num}</span>
                      {isDone && <Check className="w-3 h-3 text-emerald-400" />}
                    </span>
                    <span className="block truncate mt-0.5">{item.title}</span>
                  </motion.button>
                );
              })}
            </nav>
          </div>
        </section>

        {/* Barra Compacta de Radar ao Vivo em Telas Mobile (< lg) */}
        <div
          data-onboarding-target="live-radar-mobile"
          className="lg:hidden rounded-xl border border-[#1E3349] bg-[#0B1F33] text-white px-4 py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#E6C55A]">
              Radar ao Vivo · Tendência SERMIG
            </p>
            <p className="text-xs font-bold text-white truncate mt-0.5">
              {livePreview.subcategoriaLider?.nomePortugues || 'Calculando enquadramento...'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="font-mono text-xl font-bold text-white tabular-nums">
              {Math.round(liveResult.viabilidade?.total || 0)}
            </span>
            <span className="font-mono text-[11px] text-slate-400">/100</span>
          </div>
        </div>

        {resumeBanner && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
            {resumeBanner}
          </div>
        )}

        {resumeUrlSaved && (
          <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-300 text-xs text-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">
                Link salvo para continuar depois (validade de {empresa.diasExpiracaoLinkDiagnostico || 30} dias):
              </p>
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

        {/* Layout 12 colunas: Formulário adaptativo em 6 etapas (8 cols) + Radar de Viabilidade ao Vivo (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            data-onboarding-target="wizard-form"
            onSubmit={handleSubmit}
            className="lg:col-span-8 bg-white border border-[#E5DFD2] rounded-2xl p-6 sm:p-8 space-y-6 shadow-[0_6px_24px_rgba(11,31,51,0.04)]"
          >
            {/* Anti-spam Honeypot */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="diag-website-hp">Não preencha este campo</label>
              <input
                id="diag-website-hp"
                name="hp_company_url_ignore"
                type="text"
                tabIndex={-1}
                autoComplete="new-password"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <AnimatePresence initial={false}>
              {stepError && (
                <motion.div
                  key="step-error"
                  role="alert"
                  initial={{ opacity: 0, scale: 0.98, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -6 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#A61C2B]"
                >
                  {stepError}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Contradições com correção automática em 1 clique */}
            {step > 1 && contradictions.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 space-y-2.5">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  Inconsistência detectada — revise ou corrija em 1 clique
                </p>
                <div className="space-y-2">
                  {contradictions.map((c) => (
                    <div
                      key={c.codigo}
                      className="p-3 rounded-lg bg-white border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-900">{c.titulo}</p>
                        <p className="text-slate-600">{c.perguntaEsclarecimento}</p>
                      </div>
                      {c.fixPatch && c.fixLabel && (
                        <button
                          type="button"
                          onClick={() => updateAnswers(c.fixPatch!)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800 whitespace-nowrap shrink-0"
                        >
                          <Wrench className="w-3 h-3" />
                          {c.fixLabel}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Faixa contextual da etapa atual (por que o SERMIG avalia estes dados) */}
            {STEP_SERMIG_CONTEXT[step] && (
              <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8C6D14]">
                    Etapa 0{step}/06 · {STEP_SERMIG_CONTEXT[step].foco}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {STEP_SERMIG_CONTEXT[step].justificativa}
                  </p>
                </div>
                {livePreview.subcategoriaLider && (
                  <div className="shrink-0 sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-[#E5DFD2]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Rota líder atual
                    </p>
                    <p className="text-xs font-bold text-[#0B1F33] truncate max-w-[220px]">
                      {livePreview.subcategoriaLider.nomePortugues}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Transição suave (fade-in + scale-up) entre as 6 etapas do Diagnóstico Inteligente */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`diag-step-${step}`}
                initial={{ opacity: 0, scale: 0.975, y: stepDirection > 0 ? 14 : -12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.985, y: stepDirection > 0 ? -10 : 12 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              >
            {/* ETAPA 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-slate-900">1. Identificação e contato</h2>
                  <p className="text-xs text-slate-500">
                    Privacidade (Legislação Brasileira — LGPD, Lei nº 13.709/2018): não solicitamos CPF nem número de passaporte nesta triagem inicial.
                  </p>
                </div>

                {/* Atalho opcional de cenários frequentes (pré-configura etapas seguintes mantendo seus dados de contato) */}
                <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#0B1F33]">
                      Cenários frequentes (atalho opcional)
                    </p>
                    <span className="text-[11px] text-slate-500">
                      Você poderá ajustar qualquer detalhe nas próximas etapas
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {COMMON_PROFILE_PRESETS.map((preset) => {
                      const isMatched =
                        answers.objetivo === preset.patch.objetivo &&
                        Boolean(answers.familiaAcompanhante) === Boolean(preset.patch.familiaAcompanhante) &&
                        answers.localizacao === preset.patch.localizacao;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => updateAnswers(preset.patch)}
                          className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                            isMatched
                              ? 'bg-[#0B1F33] text-white border-[#0B1F33]'
                              : 'bg-white text-slate-800 border-[#E5DFD2] hover:border-[#C8A236]'
                          }`}
                        >
                          <span className="block text-xs font-semibold leading-snug">{preset.label}</span>
                          <span
                            className={`block text-[11px] mt-0.5 ${
                              isMatched ? 'text-[#E6C55A]' : 'text-slate-500'
                            }`}
                          >
                            {preset.detail}
                          </span>
                        </button>
                      );
                    })}
                  </div>
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
                      onChange={(e) => updateAnswers({ nome: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                    />
                    {answers.nome && answers.nome.trim().length < 2 && (
                      <p className="text-[11px] text-[#A61C2B] mt-1">Digite seu nome completo.</p>
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
                      onChange={(e) => updateAnswers({ whatsapp: maskPhoneBR(e.target.value) })}
                      placeholder="+55 (11) 99999-0000 ou +56 9 8888 5566"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/40"
                    />
                    {answers.whatsapp ? (
                      isValidWhatsApp(answers.whatsapp) ? (
                        <p className="text-[11px] text-[#146B43] mt-1 flex items-center gap-1">
                          <Check className="w-3 h-3" /> Número válido.
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-800 mt-1">
                          Informe o DDD e o número completo. Para números do Chile ou do exterior, inicie com &quot;+&quot; (ex.: +56 9 8888 5566).
                        </p>
                      )
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1">
                        Para números do Chile ou do exterior, inicie com &quot;+&quot; (ex.: +56 9 8888 5566).
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
                      onChange={(e) => updateAnswers({ email: e.target.value })}
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
                      onChange={(e) => updateAnswers({ cidadeUf: e.target.value })}
                      placeholder="Ex.: São Paulo - SP ou Santiago"
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
                      onChange={(e) => updateAnswers({ origem: e.target.value as DiagnosticAnswers['origem'] })}
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
                      title="Regra da legislação chilena"
                      text="A legislação chilena (Ley Nº 21.325) restringe a mudança de turista (Permanencia Transitoria) para residência de dentro do Chile, salvo exceções como Reunificação Familiar formalizada ou razões humanitárias."
                      sourceLabel={legalSourceText('leg_ley_21325')}
                    />
                  </div>
                  <select
                    id="diag-loc"
                    value={answers.localizacao}
                    onChange={(e) => updateAnswers({ localizacao: e.target.value as DiagnosticLocation })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="No Brasil">No Brasil</option>
                    <option value="No Chile como turista">No Chile como turista (Permanencia Transitoria)</option>
                    <option value="No Chile com residência">No Chile com residência vigente</option>
                    <option value="Em outro país">Em outro país</option>
                  </select>
                </div>

                {/* Perguntas dinâmicas SERMIG exclusivas para quem já reside no Chile */}
                {answers.localizacao === 'No Chile com residência' && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">
                        Detalhamento da Residência Vigente (Base SERMIG · Legislação Chilena)
                      </p>
                      <ContextualHelp
                        title="Janela de 90 a 10 dias"
                        text="Pelo Decreto Supremo chileno Nº 296/2022, prorrogações e pedidos de Residência Definitiva devem ser protocolados entre 90 e 10 dias antes do vencimento."
                        sourceLabel={legalSourceText('leg_dec_296_2022')}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-res-subcat">
                          Subcategoria atual da residência
                        </label>
                        <select
                          id="diag-res-subcat"
                          value={answers.residenteSubcategoriaAtual || ''}
                          onChange={(e) => updateAnswers({ residenteSubcategoriaAtual: e.target.value || undefined })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                        >
                          <option value="">Selecione sua subcategoria atual...</option>
                          {residentSubcatOptions.map((opt) => (
                            <option key={opt.codigo} value={opt.codigo}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        {selectedResidentSubcat && !selectedResidentSubcat.levaDefinitiva && (
                          <p className="text-[11px] text-amber-800 mt-1">
                            Atenção SERMIG: esta subcategoria não conduz diretamente à Residência Definitiva — avaliamos mudança de subcategoria dentro do Chile.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-meses-res">
                          Há quantos meses possui residência vigente?
                        </label>
                        <input
                          id="diag-meses-res"
                          type="number"
                          min={0}
                          max={240}
                          value={answers.mesesResidenciaChile ?? 0}
                          onChange={(e) => updateAnswers({ mesesResidenciaChile: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums bg-white"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Menos de 24 meses: Prorrogação · 24 meses ou mais: análise de Residência Definitiva.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-res-vence">
                          Prazo até o vencimento da residência atual
                        </label>
                        <select
                          id="diag-res-vence"
                          value={answers.residenteVenceEmDias || ''}
                          onChange={(e) =>
                            updateAnswers({
                              residenteVenceEmDias: (e.target.value || undefined) as DiagnosticAnswers['residenteVenceEmDias'],
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
                        >
                          <option value="">Selecione o prazo...</option>
                          <option value="mais_90">Mais de 90 dias para vencer</option>
                          <option value="entre_90_e_10">Entre 90 e 10 dias (janela legal aberta)</option>
                          <option value="menos_10">Menos de 10 dias para vencer (urgente)</option>
                          <option value="vencida">Já vencida</option>
                        </select>
                      </div>

                      {(answers.mesesResidenciaChile ?? 0) >= 24 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-res-fora">
                            Meses fora do Chile nos últimos 12 meses
                          </label>
                          <input
                            id="diag-res-fora"
                            type="number"
                            min={0}
                            max={12}
                            value={answers.residenteMesesForaUltimoAno ?? 0}
                            onChange={(e) => updateAnswers({ residenteMesesForaUltimoAno: Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums bg-white"
                          />
                          <p className="text-[11px] text-slate-500 mt-1">
                            Art. 79 da Ley chilena Nº 21.325: ausências longas podem exigir mais tempo de residência antes da Definitiva.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(answers.localizacao === 'No Brasil' || answers.localizacao === 'Em outro país') && (
                  <BooleanChoice
                    label="Esteve no Chile recentemente como turista e ainda possui saída ou pendência em aberto?"
                    value={answers.entradaRecenteChileTurista ?? false}
                    onChange={(val) => updateAnswers({ entradaRecenteChileTurista: val })}
                    helpTitle="Como isso afeta?"
                    helpText="Caso tenha havido permanência irregular recente ou saída sem registro na PDI (polícia de fronteira chilena), avaliamos essa situação antes de realizar um novo protocolo."
                    sourceLabel={legalSourceText('leg_ley_21325')}
                  />
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-faixa-etaria">
                    Faixa etária do solicitante
                  </label>
                  <select
                    id="diag-faixa-etaria"
                    value={answers.faixaEtaria || 'maior_18'}
                    onChange={(e) => updateAnswers({ faixaEtaria: e.target.value as DiagnosticAnswers['faixaEtaria'] })}
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
                  onChange={(val) => updateAnswers({ nacionalidadeBrasileira: val })}
                  helpTitle="Por que o Acordo Mercosul importa?"
                  helpText="Brasileiros têm direito ao Acordo Internacional de Residência Mercosul (Subcategoria 15 no SERMIG), que permite trabalhar no Chile sem exigir oferta de emprego prévia nem comprovação de renda mínima."
                  sourceLabel={legalSourceText('leg_acordo_mercosul')}
                />

                <BooleanChoice
                  label="Possui segunda nacionalidade?"
                  value={answers.possuiSegundaNacionalidade}
                  onChange={(val) => updateAnswers({ possuiSegundaNacionalidade: val })}
                />

                {answers.possuiSegundaNacionalidade && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700" htmlFor="diag-seg-nac">
                      Qual segunda nacionalidade?
                    </label>
                    <input
                      id="diag-seg-nac"
                      value={answers.segundaNacionalidadeQual || ''}
                      onChange={(e) => updateAnswers({ segundaNacionalidadeQual: e.target.value })}
                      placeholder="Ex.: Argentina, Uruguaia, Italiana, Portuguesa"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
                    />
                    {mercosulViaSegundaNac && (
                      <p className="text-xs text-[#1E7E34] font-medium flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        Nacionalidade reconhecida no Acordo Internacional Mercosul (elegível à Subcategoria 15).
                      </p>
                    )}
                  </div>
                )}

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-sm font-medium text-slate-900" htmlFor="diag-pass-status">
                      Situação atual do passaporte
                    </label>
                    <ContextualHelp
                      title="Por que perguntamos a validade?"
                      text="Para solicitações de residência a partir do exterior no SERMIG, recomenda-se passaporte com validade mínima de 12 meses, evitando o vencimento antes da emissão do Estampado Electrónico."
                    />
                  </div>
                  <select
                    id="diag-pass-status"
                    value={answers.passaporteStatus || 'valido'}
                    onChange={(e) => {
                      const st = e.target.value as NonNullable<DiagnosticAnswers['passaporteStatus']>;
                      updateAnswers({
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
                        onChange={(e) => updateAnswers({ passaporteValidadeMeses: Number(e.target.value) })}
                        className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm tabular-nums bg-white"
                      />
                      {answers.passaporteValidadeMeses > 0 && answers.passaporteValidadeMeses < 12 && (
                        <p className="text-[11px] text-amber-800 mt-1">
                          Atenção: validade inferior a 12 meses reduz o índice de prontidão documental; recomenda-se a renovação prévia na Polícia Federal brasileira.
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
                  label="Possui cônjuge, convivente civil, filho(a) chileno(a) ou pais residentes no Chile?"
                  value={answers.vinculoFamiliarChile}
                  onChange={(val) => updateAnswers({ vinculoFamiliarChile: val })}
                  helpTitle="Regra da legislação chilena"
                  helpText="Na legislação chilena (Decreto Supremo Nº 177/2022), a Subcategoria 01 (Reunificação Familiar) é uma das poucas exceções que permitem solicitar residência mesmo estando no Chile como turista, desde que o vínculo esteja formalmente registrado."
                  sourceLabel={legalSourceText('leg_dec_177_2022')}
                />

                {answers.vinculoFamiliarChile && (
                  <div className="space-y-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-vinc-tipo">
                          Tipo de vínculo familiar
                        </label>
                        <select
                          id="diag-vinc-tipo"
                          value={answers.vinculoTipo}
                          onChange={(e) =>
                            updateAnswers({ vinculoTipo: e.target.value as DiagnosticAnswers['vinculoTipo'] })
                          }
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                        >
                          <option value="Cônjuge/União Civil">Cônjuge / União Civil</option>
                          <option value="Filho(a) chileno(a)">Filho(a) chileno(a)</option>
                          <option value="Pais/Dependente">Pais / Dependente direto</option>
                          <option value="Outro">Outro</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-fam-status">
                          Status migratório desse familiar no Chile
                        </label>
                        <select
                          id="diag-fam-status"
                          value={answers.familiarStatusChile || ''}
                          onChange={(e) =>
                            updateAnswers({
                              familiarStatusChile: (e.target.value || undefined) as DiagnosticAnswers['familiarStatusChile'],
                            })
                          }
                          className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                        >
                          <option value="">Selecione o status...</option>
                          <option value="chileno">Cidadão chileno</option>
                          <option value="residente_definitivo">Estrangeiro com Residência Definitiva</option>
                          <option value="residente_temporal">Estrangeiro com Residência Temporal vigente</option>
                        </select>
                      </div>
                    </div>

                    {answers.familiarStatusChile === 'residente_temporal' && (
                      <p className="text-xs text-slate-700 bg-white border border-slate-200 rounded-lg p-3 leading-relaxed">
                        <strong>Diferença normativa (legislação chilena — Decreto Nº 177/2022):</strong> quando o familiar possui apenas Residência Temporal, o enquadramento costuma ocorrer como <strong>Dependente (DEP)</strong> — e não Reunificação Familiar (Cód. 01), que exige familiar chileno ou Residente Definitivo.
                      </p>
                    )}

                    <BooleanChoice
                      label="Esse vínculo já está juridicamente formalizado (casamento, Acuerdo de Unión Civil ou certidão registrada)?"
                      value={answers.vinculoFormalizado}
                      onChange={(val) => updateAnswers({ vinculoFormalizado: val })}
                      helpTitle="Importante sobre união informal"
                      helpText="Namoro ou convivência sem casamento/Acuerdo de Unión Civil registrado não ativa a Reunificação Familiar automaticamente perante o SERMIG."
                      sourceLabel={legalSourceText('leg_dec_177_2022')}
                    />
                  </div>
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
                      Qual é o seu objetivo principal?
                    </label>
                    <ContextualHelp
                      title="Perguntas dinâmicas pela base SERMIG"
                      text="Cada objetivo corresponde a uma subcategoria da legislação chilena (Decreto Supremo Nº 177/2022) ou ao Acordo Mercosul. Exibimos apenas as perguntas exigidas pelo SERMIG para o objetivo escolhido."
                      sourceLabel={legalSourceText('leg_dec_177_2022')}
                    />
                  </div>
                  <select
                    id="diag-obj"
                    value={answers.objetivo}
                    onChange={(e) => updateAnswers({ objetivo: e.target.value as DiagnosticObjective })}
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

                {/* Ficha SERMIG contextual ao objetivo escolhido */}
                {objectiveMeta && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/90 space-y-2 text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="font-bold text-slate-900">
                        Referência SERMIG · Subcategoria {objectiveMeta.visaCode} — {objectiveMeta.nomePortugues}
                      </p>
                      <span className="text-slate-500 italic">{objectiveMeta.nomeEspanhol}</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{objectiveMeta.resumoSermig}</p>
                    <p className="text-slate-700 pt-1.5 border-t border-slate-200/80 tabular-nums">
                      Trabalho: <strong>{objectiveMeta.permiteTrabalhar ? 'Permitido' : 'Restrito'}</strong>
                      {' · '}Pedido no Chile: <strong>{objectiveMeta.permiteDentroChile}</strong>
                      {' · '}Definitiva:{' '}
                      <strong>
                        {objectiveMeta.levaDefinitiva ? `${objectiveMeta.mesesDefinitiva} meses` : 'Não direta'}
                      </strong>
                    </p>
                    <p className="text-[11px] text-slate-500">Base normativa: {objectiveMeta.legalSourcesLabel}</p>
                  </div>
                )}

                {(answers.objetivo === 'trabalho_formal' || answers.objetivo === 'servicos_90d') && (
                  <div className="space-y-3">
                    <BooleanChoice
                      label="Já possui contrato de trabalho assinado ou carta de oferta formal de empresa no Chile?"
                      value={answers.possuiOfertaTrabalhoFormal}
                      onChange={(val) => updateAnswers({ possuiOfertaTrabalhoFormal: val })}
                      sourceLabel={legalSourceText('leg_dec_177_2022')}
                    />
                    {answers.possuiOfertaTrabalhoFormal && (
                      <BooleanChoice
                        label="O contrato ou oferta já está assinado perante Notaría Pública no Chile por empregador com RUT ativo?"
                        value={answers.contratoNotariadoEmpresaChilena ?? null}
                        onChange={(val) => updateAnswers({ contratoNotariadoEmpresaChilena: val })}
                        helpTitle="Exigência do SERMIG para Subcategoria 02"
                        helpText="Na legislação chilena (Decreto Supremo Nº 177/2022), a Subcategoria 02 exige contrato ou oferta formalizada em Notaría chilena contendo cláusulas obrigatórias de viagem e tributação."
                        sourceLabel={legalSourceText('leg_dec_177_2022')}
                      />
                    )}
                  </div>
                )}

                {answers.objetivo === 'estudar' && (
                  <BooleanChoice
                    label="Já possui matrícula confirmada ou carta de aceitação de instituição chilena reconhecida pelo Estado?"
                    value={answers.possuiMatriculaReconhecida}
                    onChange={(val) => updateAnswers({ possuiMatriculaReconhecida: val })}
                    helpTitle="Regra da Subcategoria 03 (Legislação Chilena)"
                    helpText="Sem carta de aceitação ou matrícula reconhecida pelo Estado chileno, a subcategoria de Estudantes não é ativada — avaliamos alternativas como o Acordo Mercosul."
                    sourceLabel={legalSourceText('leg_dec_177_2022')}
                  />
                )}

                {answers.objetivo === 'aposentado_renda' && (
                  <div className="space-y-3">
                    <BooleanChoice
                      label="Possui comprovação mensal de aposentadoria (INSS/previdência) ou renda passiva recorrente?"
                      value={answers.possuiRendaPassiva}
                      onChange={(val) => updateAnswers({ possuiRendaPassiva: val })}
                      sourceLabel={legalSourceText('leg_dec_177_2022')}
                    />
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="diag-renda">
                        Faixa aproximada da renda passiva mensal (USD)
                      </label>
                      <select
                        id="diag-renda"
                        value={answers.faixaRendaMensalUsd}
                        onChange={(e) =>
                          updateAnswers({
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
                  <div className="space-y-3">
                    <BooleanChoice
                      label="Possui capital com origem lícita comprovada (IR brasileiro, extratos, contratos sociais) para investir no Chile?"
                      value={answers.possuiCapitalComprovadoOrigem}
                      onChange={(val) => updateAnswers({ possuiCapitalComprovadoOrigem: val })}
                      helpTitle="Exigência do SERMIG para Investidores"
                      helpText="A Subcategoria 13 da legislação chilena exige comprovação formal da origem lícita dos recursos e projeto de investimento. Sem essa comprovação, avaliamos alternativas como o Acordo Mercosul."
                      sourceLabel={legalSourceText('leg_dec_177_2022')}
                    />
                    {answers.possuiCapitalComprovadoOrigem && (
                      <BooleanChoice
                        label="O projeto de investimento no Chile ultrapassa USD 500.000 (critério de patrocínio InvestChile)?"
                        value={answers.investimentoAcima500kUsd ?? null}
                        onChange={(val) => updateAnswers({ investimentoAcima500kUsd: val })}
                        helpTitle="Critério InvestChile (Legislação Chilena)"
                        helpText="Projetos acima de USD 500.000 podem solicitar carta de patrocínio da InvestChile (agência chilena de investimentos), reforçando a Subcategoria 13. Para valores menores, brasileiros costumam ter rota mais ágil pelo Acordo Mercosul."
                        sourceLabel={legalSourceText('leg_dec_177_2022')}
                      />
                    )}
                  </div>
                )}

                {answers.objetivo === 'tratamento_medico' && (
                  <BooleanChoice
                    label="Já possui certificado médico de instituição acreditada no Chile e comprovação de custeio do tratamento?"
                    value={answers.possuiCertificadoMedicoChile ?? null}
                    onChange={(val) => updateAnswers({ possuiCertificadoMedicoChile: val })}
                    helpTitle="Subcategoria 10 — Tratamento Médico (Legislação Chilena)"
                    helpText="O SERMIG exige laudo formal de centro de saúde acreditado no Chile e demonstração de meios econômicos ou seguro para custear o tratamento."
                    sourceLabel={legalSourceText('leg_dec_177_2022')}
                  />
                )}

                {answers.objetivo === 'religioso' && (
                  <BooleanChoice
                    label="Já possui carta de respaldo de entidade religiosa com personalidade jurídica reconhecida no Chile?"
                    value={answers.possuiRespaldoEntidadeReligiosa ?? null}
                    onChange={(val) => updateAnswers({ possuiRespaldoEntidadeReligiosa: val })}
                    helpTitle="Subcategoria 09 — Religiosos (Legislação Chilena)"
                    helpText="A legislação chilena exige respaldo formal da igreja ou entidade religiosa devidamente inscrita no registro oficial do Chile."
                    sourceLabel={legalSourceText('leg_dec_177_2022')}
                  />
                )}

                {answers.objetivo === 'temporada' && (
                  <BooleanChoice
                    label="Já possui contrato de trabalho sazonal assinado com empregador no Chile (período limitado)?"
                    value={answers.possuiContratoSazonal ?? null}
                    onChange={(val) => updateAnswers({ possuiContratoSazonal: val })}
                    helpTitle="Subcategoria 04 — Trabalhadores de Temporada (Legislação Chilena)"
                    helpText="Esta subcategoria destina-se a contratos sazonais específicos e não leva diretamente à Residência Definitiva. Para brasileiros, comparamos sempre com o Acordo Mercosul."
                    sourceLabel={legalSourceText('leg_dec_177_2022')}
                  />
                )}

                {answers.objetivo === 'humanitario' && (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-700" htmlFor="diag-hum-tipo">
                        Qual hipótese humanitária se aplica ao seu caso?
                      </label>
                      <ContextualHelp
                        title="Hipóteses na legislação chilena"
                        text="O Decreto Supremo chileno Nº 177/2022 prevê subcategorias humanitárias específicas (como gestantes em controle de saúde no Chile, vítimas de violência intrafamiliar ou menores desacompanhados) que permitem protocolo dentro do Chile."
                        sourceLabel={legalSourceText('leg_dec_177_2022')}
                      />
                    </div>
                    <select
                      id="diag-hum-tipo"
                      value={answers.motivoHumanitarioTipo || ''}
                      onChange={(e) =>
                        updateAnswers({
                          motivoHumanitarioTipo: (e.target.value || undefined) as DiagnosticAnswers['motivoHumanitarioTipo'],
                        })
                      }
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                    >
                      <option value="">Selecione a hipótese...</option>
                      <option value="gestante">Gestante em acompanhamento de saúde no Chile</option>
                      <option value="violencia_domestica">Vítima de violência intrafamiliar ou de gênero</option>
                      <option value="menor_desacompanhado">Criança ou adolescente em situação de proteção</option>
                      <option value="refugio_asilo">Solicitação de refúgio ou proteção internacional</option>
                      <option value="outro">Outra situação humanitária (avaliar com consultor)</option>
                    </select>
                  </div>
                )}

                {answers.objetivo === 'dependente_titular' && (
                  <BooleanChoice
                    label="O titular principal já possui residência vigente ou protocolo em andamento no SERMIG?"
                    value={answers.titularTemResidenciaChile}
                    onChange={(val) => updateAnswers({ titularTemResidenciaChile: val })}
                    sourceLabel={legalSourceText('leg_dec_177_2022')}
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
                    <p className="font-bold text-slate-900">
                      Aviso de Confidencialidade e Sigilo — Legislação Brasileira (Art. 11 da LGPD, Lei nº 13.709/2018)
                    </p>
                    <p className="mt-1 leading-relaxed">
                      Estes dados sensíveis têm acesso restrito à consultoria para avaliar eventuais impedimentos previstos na legislação chilena. Caso prefira não detalhar agora, escolha &quot;Prefiro falar com o consultor&quot; — essa opção não gera penalização nem impede a emissão do seu diagnóstico.
                    </p>
                  </div>
                </div>

                {(
                  [
                    {
                      key: 'overstay' as RiskFieldKey,
                      label: 'Já excedeu o prazo de permanência regular (Overstay) no Chile em alguma viagem anterior?',
                      helpTitle: 'O que significa Overstay?',
                      helpText:
                        'É permanecer no Chile além do prazo autorizado no cartão de entrada de turista (em geral 90 dias pela legislação chilena) ou após o vencimento de visto anterior, podendo gerar multa administrativa.',
                    },
                    {
                      key: 'ordenAbandono' as RiskFieldKey,
                      label: 'Já recebeu alguma Orden de Abandono ou notificação de expulsão no Chile?',
                      helpTitle: 'O que é Orden de Abandono?',
                      helpText:
                        'Resolução administrativa prevista na legislação chilena (Ley Nº 21.325) que determina a saída do território em prazo definido, exigindo análise jurídica individual antes de novo protocolo.',
                    },
                    {
                      key: 'rejeicaoAnterior' as RiskFieldKey,
                      label: 'Teve algum pedido de visto ou residência rejeitado anteriormente pelo SERMIG?',
                      helpTitle: 'Por que perguntamos?',
                      helpText:
                        'Permite verificar o motivo da negativa anterior (como erro documental, ausência de Apostila de Haia ou requisito legal) e avaliar eventual recurso administrativo sob a Ley chilena Nº 19.880.',
                    },
                    {
                      key: 'antecedentesCriminais' as RiskFieldKey,
                      label: 'Possui alguma anotação ou ocorrência em certidão de antecedentes criminais?',
                      helpTitle: 'Exigência legal de antecedentes',
                      helpText:
                        'O Acordo Internacional Mercosul e a legislação chilena (Ley Nº 21.325) exigem apresentação de antecedentes criminais da Polícia Federal brasileira apostilados sem anotações impeditivas.',
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
                <h2 className="text-lg font-semibold text-slate-900">6. Família acompanhante, documentos SERMIG e aceite LGPD</h2>

                <BooleanChoice
                  label="Outras pessoas da família (cônjuge/filhos) viajarão ou solicitarão residência com você?"
                  value={answers.familiaAcompanhante}
                  onChange={(val) =>
                    updateAnswers({
                      familiaAcompanhante: val,
                      composicaoFamiliar: val
                        ? answers.composicaoFamiliar === 'individual'
                          ? 'casal'
                          : answers.composicaoFamiliar
                        : 'individual',
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
                            updateAnswers({
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
                          onChange={(e) => updateAnswers({ quantidadeDependentes: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm tabular-nums bg-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-700">
                          Detalhamento por pessoa (opcional, gera checklist individual)
                        </p>
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
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2.5 rounded-lg border border-slate-200 text-xs"
                        >
                          <input
                            value={p.nome}
                            onChange={(e) => updateFamilyMember(idx, { nome: e.target.value })}
                            placeholder="Nome"
                            className="sm:col-span-4 px-2.5 py-1.5 rounded border border-slate-300"
                          />
                          <select
                            value={p.papel}
                            onChange={(e) => updateFamilyMember(idx, { papel: e.target.value as 'Titular' | 'Dependente' })}
                            className="sm:col-span-3 px-2.5 py-1.5 rounded border border-slate-300 bg-white"
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
                    Prazo pretendido para iniciar o protocolo no SERMIG
                  </label>
                  <select
                    id="diag-prazo"
                    value={answers.prazoPretendido}
                    onChange={(e) =>
                      updateAnswers({ prazoPretendido: e.target.value as DiagnosticAnswers['prazoPretendido'] })
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
                  >
                    <option value="Imediato (até 30 dias)">Imediato (até 30 dias)</option>
                    <option value="1 a 3 meses">1 a 3 meses</option>
                    <option value="3 a 6 meses">3 a 6 meses</option>
                    <option value="Mais de 6 meses">Mais de 6 meses</option>
                  </select>
                </div>

                {/* Checklist dinâmico gerado a partir dos requisitos SERMIG do perfil */}
                <div className="space-y-2.5">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      Documentos já disponíveis para {dynamicDocs.subcategoriaLabel}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Lista montada automaticamente pela base oficial SERMIG para o seu perfil. Marque os itens que você já possui em mãos:
                    </p>
                  </div>
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-slate-50/40">
                    {dynamicDocs.options.map((docOpt) => {
                      const checked = answers.documentosJaPossui.includes(docOpt.value);
                      return (
                        <label
                          key={docOpt.value}
                          className="flex items-start gap-3 p-3 text-sm text-slate-800 cursor-pointer hover:bg-white transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const next = checked
                                ? answers.documentosJaPossui.filter((d) => d !== docOpt.value)
                                : [...answers.documentosJaPossui, docOpt.value];
                              updateAnswers({ documentosJaPossui: next });
                            }}
                            className="mt-1 rounded border-slate-300"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">{docOpt.label}</span>
                            <span className="block text-[11px] text-slate-500 mt-0.5">{docOpt.meta}</span>
                          </span>
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
                      onChange={(e) => updateAnswers({ lgpdAceito: e.target.checked })}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span>
                      Li e concordo com o tratamento dos meus dados pessoais e sensíveis exclusivamente para fins de pré-análise migratória e contato da consultoria, nos termos da{' '}
                      <strong>Legislação Brasileira (LGPD — Lei nº 13.709/2018)</strong> e do{' '}
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
              </motion.div>
            </AnimatePresence>

            {/* Barra de Navegação do Formulário (6 Etapas) */}
            <div
              data-onboarding-target="final-actions"
              className="pt-5 border-t border-[#E5DFD2] flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                {step > 1 && (
                  <motion.button
                    type="button"
                    whileHover={{ x: -1.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setStepError(null);
                      navigateToStep(step - 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#DDD6C7] bg-white text-sm font-semibold text-[#0B1F33] hover:bg-[#FAF9F6] transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                  </motion.button>
                )}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  disabled={savingDraft}
                  onClick={() => void handleSaveAndCopyLink()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#DDD6C7] bg-white text-xs font-semibold text-slate-700 hover:bg-[#FAF9F6] disabled:opacity-50 transition-colors"
                >
                  <BookmarkCheck className="w-4 h-4 text-[#8C6D14]" />
                  {savingDraft ? 'Salvando...' : 'Salvar e continuar depois'}
                </motion.button>
              </div>

              {step < 6 ? (
                <motion.button
                  type="button"
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => void handleNext()}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0B1F33] hover:bg-[#132E4A] text-sm font-semibold text-white shadow-[0_6px_16px_rgba(11,31,51,0.16)] transition-colors"
                >
                  Avançar para Etapa {step + 1}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              ) : (
                <motion.button
                  type="submit"
                  whileHover={{ y: -1, scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#C8A236] hover:bg-[#d6b145] text-sm font-bold text-[#0B1523] shadow-[0_6px_18px_rgba(200,162,54,0.28)] disabled:opacity-50 transition-colors"
                >
                  {submitting ? 'Calculando Dossiê...' : 'Gerar Diagnóstico Completo & PDF'}
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </form>

          {/* PAINEL LATERAL STICKY: Radar de Viabilidade ao Vivo para todos os usuários */}
          <LiveDiagnosticRadarSidebar
            answers={answers}
            step={step}
            steps={STEP_LABELS}
            livePreview={livePreview}
            liveResult={liveResult}
            contradictionsCount={contradictions.length}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {lgpdOpen && (
        <div className="fixed inset-0 z-50 bg-[#0B1F33]/65 backdrop-blur-[2px] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-2xl border border-[#E5DFD2] max-w-2xl w-full overflow-hidden max-h-[82vh] flex flex-col shadow-[0_24px_64px_rgba(11,31,51,0.28)]"
          >
            <BrandRibbon className="h-[3px] w-full shrink-0" />
            <div className="bg-[#0B1F33] text-white px-6 py-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E5C76B]">
                Proteção de Dados Pessoais · Versão {empresa.termoLgpdVersao || '1.0'}
              </p>
              <h2 className="font-display text-lg font-bold text-white mt-0.5">
                Termo LGPD (Legislação Brasileira — Lei nº 13.709/2018)
              </h2>
            </div>
            <div className="p-6 flex flex-col min-h-0 flex-1">
              <div className="overflow-y-auto text-xs text-[#334155] whitespace-pre-wrap leading-relaxed border border-[#E5DFD2] rounded-xl p-4 bg-[#FAF9F6]">
                {empresa.termoLgpd}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setLgpdOpen(false)}
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-[#0B1F33] hover:bg-[#132E4A] transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      <DiagnosticOnboardingGuide
        open={onboardingOpen}
        onClose={handleCloseOnboarding}
        onComplete={handleCompleteOnboarding}
      />
    </div>
    </MotionConfig>
  );
};
