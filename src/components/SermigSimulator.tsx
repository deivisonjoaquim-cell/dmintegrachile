import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  Plus,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import type { Case, Client, Dependent, EmpresaConfig, VisaCategory, VisaRequirement } from '../types/domain';
import { formatDateBR } from '../utils/formatters';
import {
  buildSermigDocumentSlots,
  buildSermigSimulatedReceipt,
  CHILE_REGIONS,
  createInitialSermigPortalState,
  resolveSimulatedVisa,
  SERMIG_TRAMITE_OPTIONS,
  validateSermigPortalStep,
  type SermigPortalFormState,
  type SermigPortalStepId,
  type SermigSimulatedDependent,
  type SermigSimulatedReceipt,
  type SermigUploadedAttachment,
} from '../utils/sermigSimulator';
import { SermigAdminReleaseManager } from './sermig/SermigAdminReleaseManager';
import { SermigDocumentUploader } from './sermig/SermigDocumentUploader';
import { SermigGuideSidebar, SermigPortalChrome } from './sermig/SermigPortalChrome';
import { SermigSubmissionReceipt } from './sermig/SermigSubmissionReceipt';

export interface SermigSimulatorProps {
  mode: 'client' | 'admin';
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  empresa?: Partial<EmpresaConfig>;
  /** Em modo cliente: cliente autenticado e seu caso/dependentes */
  client?: Client | null;
  activeCase?: Case | null;
  dependents?: Dependent[];
  /** Em modo admin: lista completa de clientes/casos/dependentes + handler para liberar/bloquear simulador */
  clients?: Client[];
  cases?: Case[];
  allDependents?: Dependent[];
  canManageRelease?: boolean;
  onToggleClientSimulatorAccess?: (client: Client, nextEnabled: boolean) => Promise<void>;
}

const STEP_SEQUENCE: SermigPortalStepId[] = [
  'acceso',
  'tramite',
  'datos_personales',
  'identificacion_domicilio',
  'documentos',
  'revision_declaracion',
  'comprobante',
];

export const SermigSimulator: React.FC<SermigSimulatorProps> = ({
  mode,
  visaCategories,
  visaRequirements,
  empresa,
  client,
  activeCase,
  dependents = [],
  clients = [],
  cases = [],
  allDependents = [],
  canManageRelease = false,
  onToggleClientSimulatorAccess,
}) => {
  const activeVisas = useMemo(
    () => visaCategories.filter((v) => v.ativo !== false),
    [visaCategories],
  );

  const [adminView, setAdminView] = useState<'portal' | 'permissoes'>('portal');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [showGuide, setShowGuide] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [form, setForm] = useState<SermigPortalFormState>(() =>
    createInitialSermigPortalState({
      visaCategories: activeVisas,
      initialVisaId: activeCase?.visaCategoryId,
      client,
      dependents,
    }),
  );

  const [currentStep, setCurrentStep] = useState<SermigPortalStepId>('acceso');
  const [completedSteps, setCompletedSteps] = useState<SermigPortalStepId[]>([]);
  const [stepAttemptedErrors, setStepAttemptedErrors] = useState<boolean>(false);
  const [submittedReceipt, setSubmittedReceipt] = useState<SermigSimulatedReceipt | null>(null);

  // Form temporário para adicionar dependente na etapa 3
  const [newDepName, setNewDepName] = useState('');
  const [newDepRelation, setNewDepRelation] =
    useState<SermigSimulatedDependent['parentesco']>('Cónyuge / Conviviente');
  const [newDepBirth, setNewDepBirth] = useState('');
  const [newDepDoc, setNewDepDoc] = useState('');

  const selectedVisa = useMemo(
    () => resolveSimulatedVisa(activeVisas, form.visaCategoryId),
    [activeVisas, form.visaCategoryId],
  );

  const documentSlots = useMemo(
    () => buildSermigDocumentSlots(selectedVisa, visaRequirements, form.dependientes.length),
    [selectedVisa, visaRequirements, form.dependientes.length],
  );

  const stepValidation = useMemo(
    () => validateSermigPortalStep(currentStep, form, activeVisas, visaRequirements),
    [currentStep, form, activeVisas, visaRequirements],
  );

  const selectedRegionComunas = useMemo(() => {
    const found = CHILE_REGIONS.find((r) => r.region === form.regionDestinoChile);
    return found ? found.comunas : CHILE_REGIONS[0].comunas;
  }, [form.regionDestinoChile]);

  const releasedClientsCount = useMemo(
    () => clients.filter((c) => !c.arquivado && c.simuladorSermigLiberado === true).length,
    [clients],
  );

  const updateField = <K extends keyof SermigPortalFormState>(
    key: K,
    value: SermigPortalFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLoadClientForSimulation = (targetClientId: string) => {
    setSelectedClientId(targetClientId);
    const targetClient = targetClientId ? clients.find((c) => c.id === targetClientId) || null : null;
    const targetCase = targetClient
      ? cases.find((cs) => cs.clientId === targetClient.id && !cs.arquivado) || null
      : null;
    const targetDeps = targetClient ? allDependents.filter((d) => d.clientId === targetClient.id) : [];

    setForm(
      createInitialSermigPortalState({
        visaCategories: activeVisas,
        initialVisaId: targetCase?.visaCategoryId,
        client: targetClient,
        dependents: targetDeps,
      }),
    );
    setCurrentStep('acceso');
    setCompletedSteps([]);
    setStepAttemptedErrors(false);
    setSubmittedReceipt(null);
  };

  const handleFillDemoTrainingData = () => {
    const mercosur = resolveSimulatedVisa(activeVisas, form.visaCategoryId);
    const recentPfIso = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    const futureExpIso = new Date(Date.now() + 365 * 4 * 86_400_000).toISOString().slice(0, 10);

    setForm((prev) => ({
      ...prev,
      authMethod: 'cuenta_sermig',
      loginEmail: prev.loginEmail || client?.email || 'joao.silva@exemplo.com',
      loginPassword: prev.loginPassword || 'TreinoSERMIG2026',
      tramiteType: mercosur.codigo === 'DEF' ? 'rd_definitiva' : 'rt_exterior',
      possuiResidenciaVigenteChile: mercosur.codigo === 'DEF',
      nombres: prev.nombres || 'João Pedro',
      primerApellido: prev.primerApellido || 'Silva',
      segundoApellido: prev.segundoApellido || 'Oliveira',
      fechaNacimiento: prev.fechaNacimiento || '1991-08-18',
      correoNotificacion: prev.correoNotificacion || prev.loginEmail || client?.email || 'joao.silva@exemplo.com',
      confirmarCorreo: prev.confirmarCorreo || prev.loginEmail || client?.email || 'joao.silva@exemplo.com',
      telefonoContacto: prev.telefonoContacto || '+55 11 99876-5432',
      numeroDocumento: prev.numeroDocumento || 'GL847291',
      fechaVencimientoDoc: prev.fechaVencimientoDoc || futureExpIso,
      ciudadResidencia: prev.ciudadResidencia || 'São Paulo, SP',
      direccionResidencia: prev.direccionResidencia || 'Av. Paulista, 1450, Apto 82',
      actividadProfesion: prev.actividadProfesion || 'Analista de Sistemas',
      attachments:
        currentStep === 'documentos'
          ? buildDemoAttachments(documentSlots, recentPfIso)
          : prev.attachments,
    }));
    setStepAttemptedErrors(false);
  };

  const buildDemoAttachments = (
    slots: ReturnType<typeof buildSermigDocumentSlots>,
    pfIso: string,
  ): Record<string, SermigUploadedAttachment> => {
    const out: Record<string, SermigUploadedAttachment> = {};
    for (const slot of slots) {
      const isImage = slot.accepts === 'image';
      out[slot.id] = {
        slotId: slot.id,
        fileName: isImage
          ? 'foto_carnet_fondo_blanco_treino.jpg'
          : `${slot.id.replace('slot_', '')}_apostilado_treino.pdf`,
        fileSizeBytes: isImage ? 420_000 : 1_120_000,
        mimeType: isImage ? 'image/jpeg' : 'application/pdf',
        simulatedSample: true,
        dataEmissao: slot.isAntecedentesPf ? pfIso : undefined,
        apostilaConfirmada: slot.exigeApostila,
        traducaoConfirmada: slot.exigeTraducao,
        attachedAtIso: new Date().toISOString(),
      };
    }
    return out;
  };

  const handleAttachAllDemoValid = () => {
    const recentPfIso = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    updateField('attachments', buildDemoAttachments(documentSlots, recentPfIso));
    setStepAttemptedErrors(false);
  };

  const handleChangeAttachment = (slotId: string, attachment: SermigUploadedAttachment | null) => {
    setForm((prev) => {
      const next = { ...prev.attachments };
      if (!attachment) {
        delete next[slotId];
      } else {
        next[slotId] = attachment;
      }
      return { ...prev, attachments: next };
    });
  };

  const handleAddDependent = () => {
    if (!newDepName.trim() || !newDepDoc.trim()) return;
    const item: SermigSimulatedDependent = {
      id: `dep_${Date.now()}`,
      nombreCompleto: newDepName.trim(),
      parentesco: newDepRelation,
      fechaNacimiento: newDepBirth || '2016-04-10',
      numeroDocumento: newDepDoc.trim().toUpperCase(),
    };
    updateField('dependientes', [...form.dependientes, item]);
    setNewDepName('');
    setNewDepBirth('');
    setNewDepDoc('');
  };

  const handleRemoveDependent = (id: string) => {
    updateField(
      'dependientes',
      form.dependientes.filter((d) => d.id !== id),
    );
  };

  const handleNextStep = () => {
    const check = validateSermigPortalStep(currentStep, form, activeVisas, visaRequirements);
    if (!check.valid) {
      setStepAttemptedErrors(true);
      return;
    }

    setStepAttemptedErrors(false);
    setCompletedSteps((prev) => (prev.includes(currentStep) ? prev : [...prev, currentStep]));

    if (currentStep === 'acceso') {
      setForm((prev) => ({
        ...prev,
        authenticated: true,
        correoNotificacion: prev.correoNotificacion || (prev.authMethod === 'cuenta_sermig' ? prev.loginEmail : ''),
        confirmarCorreo: prev.confirmarCorreo || (prev.authMethod === 'cuenta_sermig' ? prev.loginEmail : ''),
      }));
      setCurrentStep('tramite');
      return;
    }

    if (currentStep === 'revision_declaracion') {
      const receipt = buildSermigSimulatedReceipt(form, activeVisas, visaRequirements, empresa);
      setSubmittedReceipt(receipt);
      setCurrentStep('comprobante');
      return;
    }

    const idx = STEP_SEQUENCE.indexOf(currentStep);
    if (idx >= 0 && idx < STEP_SEQUENCE.length - 1) {
      setCurrentStep(STEP_SEQUENCE[idx + 1]);
    }
  };

  const handlePrevStep = () => {
    setStepAttemptedErrors(false);
    const idx = STEP_SEQUENCE.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(STEP_SEQUENCE[idx - 1]);
    }
  };

  const handleRestartSimulation = () => {
    const targetClient =
      mode === 'admin' && selectedClientId
        ? clients.find((c) => c.id === selectedClientId) || null
        : client || null;
    const targetCase =
      mode === 'admin' && targetClient
        ? cases.find((cs) => cs.clientId === targetClient.id && !cs.arquivado) || null
        : activeCase || null;
    const targetDeps =
      mode === 'admin' && targetClient
        ? allDependents.filter((d) => d.clientId === targetClient.id)
        : dependents;

    setForm(
      createInitialSermigPortalState({
        visaCategories: activeVisas,
        initialVisaId: targetCase?.visaCategoryId,
        client: targetClient,
        dependents: targetDeps,
      }),
    );
    setCurrentStep('acceso');
    setCompletedSteps([]);
    setStepAttemptedErrors(false);
    setSubmittedReceipt(null);
  };

  const authenticatedLabel =
    form.authMethod === 'cuenta_sermig'
      ? form.loginEmail || 'usuario@sermig.cl'
      : form.loginRun || 'ClaveÚnica';

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] bg-white dark:bg-[#090F1A] text-sm text-[#0F172A] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-[#0039A6] dark:focus:border-blue-400';

  return (
    <div className="space-y-5" data-testid={`sermig-simulator-${mode}`}>
      {/* Barra superior de controle do ambiente de simulação */}
      <section className="rounded-xl border border-[#E2E8F0] dark:border-[#1E293B] bg-white dark:bg-[#0D1524] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-[#0039A6] dark:text-blue-400">
              {mode === 'admin'
                ? 'Área da Equipe · tramites.extranjeria.gob.cl'
                : 'Treinamento Liberado · tramites.extranjeria.gob.cl'}
            </p>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white tracking-tight text-balance">
              Simulador do Portal de Entrada SERMIG
            </h2>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 max-w-3xl leading-relaxed">
              Pratique passo a passo todo o procedimento oficial de dar entrada na solicitação de residência no site do
              SERMIG — do login até o upload de PDFs, declaração jurada e emissão do Comprobante de Ingreso — sem risco
              de errar no portal governamental real.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {mode === 'admin' && (
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F1F5F9] dark:bg-[#090F1A]">
                <button
                  type="button"
                  onClick={() => setAdminView('portal')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    adminView === 'portal'
                      ? 'bg-white dark:bg-[#131F33] text-[#0F172A] dark:text-white shadow-xs'
                      : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  Simulador do Portal
                </button>
                <button
                  type="button"
                  onClick={() => setAdminView('permissoes')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    adminView === 'permissoes'
                      ? 'bg-white dark:bg-[#131F33] text-[#0F172A] dark:text-white shadow-xs'
                      : 'text-[#64748B] dark:text-slate-400 hover:text-[#0F172A] dark:hover:text-white'
                  }`}
                >
                  Liberação Clientes ({releasedClientsCount})
                </button>
              </div>
            )}

            {adminView === 'portal' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowGuide((v) => !v)}
                  aria-pressed={showGuide}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap ${
                    showGuide
                      ? 'border-[#0039A6]/30 dark:border-blue-500/40 bg-[#EFF6FF] dark:bg-blue-950/30 text-[#0039A6] dark:text-blue-300'
                      : 'border-[#CBD5E1] dark:border-[#1E293B] bg-white dark:bg-[#131F33] text-[#475569] dark:text-slate-300'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                  {showGuide ? 'Guia Português: Ativo' : 'Ativar Guia Português'}
                </button>

                {currentStep !== 'comprobante' && (
                  <button
                    type="button"
                    onClick={handleFillDemoTrainingData}
                    className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#131F33] text-xs font-semibold text-[#0F172A] dark:text-slate-100 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors whitespace-nowrap"
                  >
                    Preencher exemplo de treino
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleRestartSimulation}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] text-xs font-semibold text-[#475569] dark:text-slate-300 hover:bg-[#F8FAFC] dark:hover:bg-[#131F33] transition-colors whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Reiniciar
                </button>
              </>
            )}
          </div>
        </div>

        {/* Seletor de cliente no modo Admin para demonstrar o portal já pré-preenchido */}
        {mode === 'admin' && adminView === 'portal' && clients.length > 0 && (
          <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <label
              htmlFor="admin-sim-client-loader"
              className="font-medium text-[#475569] dark:text-slate-300"
            >
              Pré-carregar dados de um cliente no simulador (para treino ou demonstração ao vivo):
            </label>
            <select
              id="admin-sim-client-loader"
              value={selectedClientId}
              onChange={(e) => handleLoadClientForSimulation(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#090F1A] text-xs font-medium text-[#0F172A] dark:text-slate-100 min-w-[260px] max-w-full"
            >
              <option value="">Formulário em branco (simulação avulsa)</option>
              {clients
                .filter((c) => !c.arquivado)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nomeCompleto} ({c.simuladorSermigLiberado ? 'Liberado' : 'Bloqueado'})
                  </option>
                ))}
            </select>
          </div>
        )}
      </section>

      {/* Modo Admin -> Aba de Controle de Liberação por Cliente */}
      {mode === 'admin' && adminView === 'permissoes' ? (
        <SermigAdminReleaseManager
          clients={clients}
          canManageRelease={canManageRelease}
          onToggleClientSimulatorAccess={onToggleClientSimulatorAccess}
        />
      ) : (
        /* Layout Two-Zone Sandbox: Portal SERMIG Interativo + Guia Lateral em Português */
        <div className={`grid grid-cols-1 ${showGuide ? 'xl:grid-cols-12' : ''} gap-6 items-start`}>
          <div className={showGuide ? 'xl:col-span-8 min-w-0' : 'min-w-0'}>
            <SermigPortalChrome
              currentStep={currentStep}
              completedSteps={completedSteps}
              authenticatedUserLabel={form.authenticated ? authenticatedLabel : undefined}
              onSelectStep={(step) => {
                setStepAttemptedErrors(false);
                setCurrentStep(step);
              }}
              onLogoutSimulated={handleRestartSimulation}
            >
              {/* Banner de erros de validação da etapa atual */}
              {stepAttemptedErrors && stepValidation.errors.length > 0 && (
                <div
                  role="alert"
                  className="mb-5 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1.5"
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                    O portal SERMIG impediu o avanço — corrija os itens abaixo:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    {stepValidation.errors.map((err, idx) => (
                      <li key={`${err.field}-${idx}`}>
                        {err.message}
                        {err.legalRef ? ` (${err.legalRef})` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Avisos não bloqueantes da etapa atual */}
              {stepValidation.warnings.length > 0 && currentStep !== 'comprobante' && (
                <div className="mb-5 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-950 dark:text-amber-200 space-y-1">
                  {stepValidation.warnings.map((w, idx) => (
                    <p key={`${w.field}-${idx}`} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{w.message}</span>
                    </p>
                  ))}
                </div>
              )}

              {/* ============================================================
                  ETAPA 0: ACCESO AL PORTAL (Cuenta SERMIG / ClaveÚnica)
                 ============================================================ */}
              {currentStep === 'acceso' && (
                <div className="max-w-lg mx-auto py-3 space-y-6" data-testid="sermig-step-acceso">
                  <div className="text-center space-y-1.5">
                    <h4 className="font-display text-xl font-bold text-[#0F172A] dark:text-white">
                      Iniciar Sesión en Portal de Trámites Digitales
                    </h4>
                    <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300">
                      Seleccione el método de acceso que corresponde a su situación migratoria actual.
                    </p>
                  </div>

                  {/* Seletor Cuenta SERMIG vs ClaveÚnica */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateField('authMethod', 'cuenta_sermig')}
                      className={`p-4 rounded-xl border text-left transition-colors space-y-1 ${
                        form.authMethod === 'cuenta_sermig'
                          ? 'border-[#0039A6] bg-[#EFF6FF] dark:bg-blue-950/35 dark:border-blue-400'
                          : 'border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#0B1320] hover:border-[#0039A6]/50'
                      }`}
                    >
                      <p className="text-sm font-bold text-[#0039A6] dark:text-blue-300 flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4" aria-hidden="true" />
                        Cuenta SERMIG
                      </p>
                      <p className="text-xs text-[#475569] dark:text-slate-300">
                        Extranjeros sin RUN chileno (primeira residência a partir do Brasil).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateField('authMethod', 'clave_unica')}
                      className={`p-4 rounded-xl border text-left transition-colors space-y-1 ${
                        form.authMethod === 'clave_unica'
                          ? 'border-[#0039A6] bg-[#EFF6FF] dark:bg-blue-950/35 dark:border-blue-400'
                          : 'border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#0B1320] hover:border-[#0039A6]/50'
                      }`}
                    >
                      <p className="text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-[#0039A6] dark:text-blue-400" aria-hidden="true" />
                        ClaveÚnica
                      </p>
                      <p className="text-xs text-[#475569] dark:text-slate-300">
                        Somente para quem já possui RUN / Cédula de Identidade chilena.
                      </p>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {form.authMethod === 'cuenta_sermig' ? (
                      <div className="space-y-1.5">
                        <label htmlFor="sermig-login-email" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                          Correo Electrónico (Cuenta SERMIG) *
                        </label>
                        <input
                          id="sermig-login-email"
                          type="email"
                          value={form.loginEmail}
                          onChange={(e) => updateField('loginEmail', e.target.value)}
                          placeholder="seu.email@exemplo.com"
                          className={inputClass}
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label htmlFor="sermig-login-run" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                          Ingresa tu RUN (Chile) *
                        </label>
                        <input
                          id="sermig-login-run"
                          type="text"
                          value={form.loginRun}
                          onChange={(e) => updateField('loginRun', e.target.value)}
                          placeholder="25.123.456-7"
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="sermig-login-pass" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Contraseña (fictícia para simulação) *
                      </label>
                      <div className="relative">
                        <input
                          id="sermig-login-pass"
                          type={showPassword ? 'text' : 'password'}
                          value={form.loginPassword}
                          onChange={(e) => updateField('loginPassword', e.target.value)}
                          placeholder="Digite qualquer senha de treino"
                          className={`${inputClass} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleNextStep}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#0039A6] hover:bg-[#002F87] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      Ingresar al Portal SERMIG
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              )}

              {/* ============================================================
                  ETAPA 1: SELECCIÓN DE TRÁMITE Y SUBCATEGORÍA
                 ============================================================ */}
              {currentStep === 'tramite' && (
                <div className="space-y-5" data-testid="sermig-step-tramite">
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-[#0F172A] dark:text-white">
                      Seleccione el Trámite que desea iniciar
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-slate-400">
                      Escolha o formulário correspondente à sua localização atual conforme a Ley Nº 21.325.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {SERMIG_TRAMITE_OPTIONS.map((opt) => {
                      const active = form.tramiteType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            updateField('tramiteType', opt.id);
                            if (opt.id === 'rd_definitiva') {
                              const defVisa = activeVisas.find((v) => v.codigo === 'DEF');
                              if (defVisa) updateField('visaCategoryId', defVisa.id);
                            }
                          }}
                          className={`w-full text-left p-4 rounded-xl border transition-colors space-y-1 ${
                            active
                              ? 'border-[#0039A6] bg-[#EFF6FF] dark:bg-blue-950/35 dark:border-blue-400'
                              : 'border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC]/70 dark:bg-[#0B1320] hover:border-[#0039A6]/50'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-bold text-[#0F172A] dark:text-white">{opt.tituloEs}</p>
                            <span className="text-[11px] font-mono text-[#64748B] dark:text-slate-400">
                              {opt.artigoLegal}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-[#0039A6] dark:text-blue-300">{opt.subtituloPt}</p>
                          <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">
                            {opt.descripcionEs}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-3">
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-subcategoria" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Subcategoría Migratoria (Decreto Supremo Nº 177/2022) *
                      </label>
                      <select
                        id="sermig-subcategoria"
                        value={form.visaCategoryId}
                        onChange={(e) => updateField('visaCategoryId', e.target.value)}
                        className={inputClass}
                      >
                        {activeVisas.map((v) => (
                          <option key={v.id} value={v.id}>
                            [{v.codigo}] {v.nomeEspanhol} — ({v.nomePortugues})
                          </option>
                        ))}
                      </select>
                    </div>

                    {form.tramiteType !== 'rt_exterior' && (
                      <div className="space-y-2 p-3.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0B1320] border border-[#E2E8F0] dark:border-[#1E293B]">
                        <label className="flex items-start gap-2.5 text-xs text-[#334155] dark:text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.possuiResidenciaVigenteChile}
                            onChange={(e) => updateField('possuiResidenciaVigenteChile', e.target.checked)}
                            className="mt-0.5 rounded accent-[#0039A6]"
                          />
                          <span>
                            Sou titular de Residência Temporal vigente no Chile (Prórroga, Cambio de Subcategoría ou
                            Definitiva).
                          </span>
                        </label>
                        {form.tramiteType === 'rt_chile' && (
                          <label className="flex items-start gap-2.5 text-xs text-[#334155] dark:text-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.vinculoFamiliarChile}
                              onChange={(e) => updateField('vinculoFamiliarChile', e.target.checked)}
                              className="mt-0.5 rounded accent-[#0039A6]"
                            />
                            <span>
                              Possuo vínculo familiar formalizado com cidadão chileno ou residente definitivo
                              (exceção Art. 69).
                            </span>
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============================================================
                  ETAPA 2: ANTECEDENTES PERSONALES
                 ============================================================ */}
              {currentStep === 'datos_personales' && (
                <div className="space-y-5" data-testid="sermig-step-datos-personales">
                  <div>
                    <h4 className="text-base font-bold text-[#0F172A] dark:text-white">
                      Antecedentes Personales del Solicitante
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      Digite exatamente como consta no seu passaporte. Campos com * são obrigatórios no portal oficial.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-nombres" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Nombres (Nome próprio) *
                      </label>
                      <input
                        id="sermig-nombres"
                        type="text"
                        value={form.nombres}
                        onChange={(e) => updateField('nombres', e.target.value)}
                        placeholder="Ex.: João Pedro"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-ap1" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Primer Apellido (1º Sobrenome) *
                      </label>
                      <input
                        id="sermig-ap1"
                        type="text"
                        value={form.primerApellido}
                        onChange={(e) => updateField('primerApellido', e.target.value)}
                        placeholder="Ex.: Silva"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-ap2" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Segundo Apellido (2º Sobrenome)
                      </label>
                      <input
                        id="sermig-ap2"
                        type="text"
                        value={form.segundoApellido}
                        onChange={(e) => updateField('segundoApellido', e.target.value)}
                        placeholder="Ex.: Oliveira"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-nasc" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Fecha de Nacimiento *
                      </label>
                      <input
                        id="sermig-nasc"
                        type="date"
                        value={form.fechaNacimiento}
                        onChange={(e) => updateField('fechaNacimiento', e.target.value)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-sexo" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Sexo *
                      </label>
                      <select
                        id="sermig-sexo"
                        value={form.sexo}
                        onChange={(e) => updateField('sexo', e.target.value as SermigPortalFormState['sexo'])}
                        className={inputClass}
                      >
                        <option value="Femenino">Femenino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="No binario">No binario</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-civil" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Estado Civil *
                      </label>
                      <select
                        id="sermig-civil"
                        value={form.estadoCivil}
                        onChange={(e) =>
                          updateField('estadoCivil', e.target.value as SermigPortalFormState['estadoCivil'])
                        }
                        className={inputClass}
                      >
                        <option value="Soltero(a)">Soltero(a)</option>
                        <option value="Casado(a)">Casado(a)</option>
                        <option value="Unión Civil">Unión Civil / Conviviente</option>
                        <option value="Divorciado(a)">Divorciado(a)</option>
                        <option value="Viudo(a)">Viudo(a)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-pais-nasc" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        País de Nacimiento *
                      </label>
                      <input
                        id="sermig-pais-nasc"
                        type="text"
                        value={form.paisNacimiento}
                        onChange={(e) => updateField('paisNacimiento', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-nac" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Nacionalidad *
                      </label>
                      <input
                        id="sermig-nac"
                        type="text"
                        value={form.nacionalidad}
                        onChange={(e) => updateField('nacionalidad', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B] grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-email1" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Correo Electrónico de Notificación *
                      </label>
                      <input
                        id="sermig-email1"
                        type="email"
                        value={form.correoNotificacion}
                        onChange={(e) => updateField('correoNotificacion', e.target.value)}
                        placeholder="email@exemplo.com"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-email2" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Confirmar Correo Electrónico *
                      </label>
                      <input
                        id="sermig-email2"
                        type="email"
                        value={form.confirmarCorreo}
                        onChange={(e) => updateField('confirmarCorreo', e.target.value)}
                        placeholder="Repita exatamente o e-mail"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="sermig-tel" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Teléfono de Contacto (con código de país)
                      </label>
                      <input
                        id="sermig-tel"
                        type="tel"
                        value={form.telefonoContacto}
                        onChange={(e) => updateField('telefonoContacto', e.target.value)}
                        placeholder="+55 11 99999-0000"
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================
                  ETAPA 3: DOCUMENTO DE VIAJE, DOMICILIO Y DEPENDIENTES
                 ============================================================ */}
              {currentStep === 'identificacion_domicilio' && (
                <div className="space-y-5" data-testid="sermig-step-identificacion">
                  <div>
                    <h4 className="text-base font-bold text-[#0F172A] dark:text-white">
                      Documento de Identificación, Domicilio y Destino en Chile
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      Informe o documento válido que será vinculado ao seu Estampado Electrónico.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-tipodoc" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Tipo de Documento *
                      </label>
                      <select
                        id="sermig-tipodoc"
                        value={form.tipoDocumento}
                        onChange={(e) =>
                          updateField('tipoDocumento', e.target.value as SermigPortalFormState['tipoDocumento'])
                        }
                        className={inputClass}
                      >
                        <option value="Pasaporte">Pasaporte</option>
                        <option value="Cédula de Identidad / RG (Mercosur)">Cédula de Identidad / RG (Mercosur)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-numdoc" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Número de Documento *
                      </label>
                      <input
                        id="sermig-numdoc"
                        type="text"
                        value={form.numeroDocumento}
                        onChange={(e) => updateField('numeroDocumento', e.target.value.toUpperCase())}
                        placeholder="Ex.: GL123456"
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-vencdoc" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Fecha de Vencimiento *
                      </label>
                      <input
                        id="sermig-vencdoc"
                        type="date"
                        value={form.fechaVencimientoDoc}
                        onChange={(e) => updateField('fechaVencimientoDoc', e.target.value)}
                        className={`${inputClass} font-mono`}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-3 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-cidade" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Ciudad de Residencia Actual *
                      </label>
                      <input
                        id="sermig-cidade"
                        type="text"
                        value={form.ciudadResidencia}
                        onChange={(e) => updateField('ciudadResidencia', e.target.value)}
                        placeholder="São Paulo, SP"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-dir" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Dirección Actual *
                      </label>
                      <input
                        id="sermig-dir"
                        type="text"
                        value={form.direccionResidencia}
                        onChange={(e) => updateField('direccionResidencia', e.target.value)}
                        placeholder="Rua / Av., número e bairro"
                        className={inputClass}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-region" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Región de Destino en Chile *
                      </label>
                      <select
                        id="sermig-region"
                        value={form.regionDestinoChile}
                        onChange={(e) => {
                          const nextRegion = e.target.value;
                          const match = CHILE_REGIONS.find((r) => r.region === nextRegion);
                          setForm((prev) => ({
                            ...prev,
                            regionDestinoChile: nextRegion,
                            comunaDestinoChile: match?.comunas[0] || '',
                          }));
                        }}
                        className={inputClass}
                      >
                        {CHILE_REGIONS.map((r) => (
                          <option key={r.region} value={r.region}>
                            {r.region}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="sermig-comuna" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Comuna de Destino en Chile *
                      </label>
                      <select
                        id="sermig-comuna"
                        value={form.comunaDestinoChile}
                        onChange={(e) => updateField('comunaDestinoChile', e.target.value)}
                        className={inputClass}
                      >
                        {selectedRegionComunas.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="sermig-prof" className="block text-xs font-semibold text-[#0F172A] dark:text-slate-200">
                        Profesión u Oficio
                      </label>
                      <input
                        id="sermig-prof"
                        type="text"
                        value={form.actividadProfesion}
                        onChange={(e) => updateField('actividadProfesion', e.target.value)}
                        placeholder="Ex.: Engenheiro de Software, Administrador, Enfermeira..."
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Dependentes acompanhantes */}
                  <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B] space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                        <UserPlus className="w-3.5 h-3.5 text-[#0039A6] dark:text-blue-400" aria-hidden="true" />
                        Dependientes Acompañantes (Opcional · {form.dependientes.length})
                      </h5>
                    </div>

                    {form.dependientes.length > 0 && (
                      <ul className="space-y-2">
                        {form.dependientes.map((dep) => (
                          <li
                            key={dep.id}
                            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#F8FAFC] dark:bg-[#0B1320] border border-[#E2E8F0] dark:border-[#1E293B] text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-[#0F172A] dark:text-white">
                                {dep.nombreCompleto}
                              </span>{' '}
                              <span className="text-[#64748B] dark:text-slate-400">
                                · {dep.parentesco} · Doc. {dep.numeroDocumento}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveDependent(dep.id)}
                              aria-label={`Remover dependente ${dep.nombreCompleto}`}
                              className="text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" aria-hidden="true" />
                              Remover
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                      <div className="sm:col-span-4 space-y-1">
                        <label htmlFor="dep-name" className="block text-[11px] font-medium text-[#475569] dark:text-slate-300">
                          Nombre completo
                        </label>
                        <input
                          id="dep-name"
                          type="text"
                          value={newDepName}
                          onChange={(e) => setNewDepName(e.target.value)}
                          placeholder="Ex.: Maria Silva"
                          className={inputClass}
                        />
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <label htmlFor="dep-rel" className="block text-[11px] font-medium text-[#475569] dark:text-slate-300">
                          Vínculo
                        </label>
                        <select
                          id="dep-rel"
                          value={newDepRelation}
                          onChange={(e) =>
                            setNewDepRelation(e.target.value as SermigSimulatedDependent['parentesco'])
                          }
                          className={inputClass}
                        >
                          <option value="Cónyuge / Conviviente">Cónyuge / Conviviente</option>
                          <option value="Hijo(a) menor">Hijo(a) menor</option>
                          <option value="Hijo(a) estudiante">Hijo(a) estudiante</option>
                          <option value="Padre / Madre">Padre / Madre</option>
                        </select>
                      </div>
                      <div className="sm:col-span-3 space-y-1">
                        <label htmlFor="dep-doc" className="block text-[11px] font-medium text-[#475569] dark:text-slate-300">
                          Pasaporte / RG
                        </label>
                        <input
                          id="dep-doc"
                          type="text"
                          value={newDepDoc}
                          onChange={(e) => setNewDepDoc(e.target.value.toUpperCase())}
                          placeholder="GL554433"
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddDependent}
                          disabled={!newDepName.trim() || !newDepDoc.trim()}
                          className="w-full py-2 px-3 rounded-lg border border-[#0039A6] text-[#0039A6] dark:text-blue-300 dark:border-blue-500 text-xs font-semibold hover:bg-[#EFF6FF] dark:hover:bg-blue-950/30 disabled:opacity-40 inline-flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          Agregar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================
                  ETAPA 4: CARGA DE DOCUMENTOS ADJUNTOS (PDF / JPG)
                 ============================================================ */}
              {currentStep === 'documentos' && (
                <div data-testid="sermig-step-documentos">
                  <SermigDocumentUploader
                    slots={documentSlots}
                    attachments={form.attachments}
                    onChangeAttachment={handleChangeAttachment}
                    onAttachAllDemoValid={handleAttachAllDemoValid}
                  />
                </div>
              )}

              {/* ============================================================
                  ETAPA 5: REVISIÓN FINAL Y DECLARACIÓN JURADA
                 ============================================================ */}
              {currentStep === 'revision_declaracion' && (
                <div className="space-y-5" data-testid="sermig-step-revision">
                  <div>
                    <h4 className="text-base font-bold text-[#0F172A] dark:text-white">
                      Resumen de su Solicitud y Declaración Jurada
                    </h4>
                    <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                      Revise cuidadosamente cada campo antes de confirmar o envio simulado no portal SERMIG.
                    </p>
                  </div>

                  {/* Quadros resumo com botão Editar */}
                  <div className="divide-y divide-[#E2E8F0] dark:divide-[#1E293B] border border-[#E2E8F0] dark:border-[#1E293B] rounded-xl overflow-hidden text-xs">
                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-[#0F172A] dark:text-white">1. Trámite y Subcategoría</p>
                        <p className="text-[#475569] dark:text-slate-300">
                          {SERMIG_TRAMITE_OPTIONS.find((t) => t.id === form.tramiteType)?.tituloEs}
                        </p>
                        <p className="font-medium text-[#0039A6] dark:text-blue-400">
                          [{selectedVisa.codigo}] {selectedVisa.nomeEspanhol}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep('tramite')}
                        className="text-xs font-semibold text-[#0039A6] dark:text-blue-400 underline shrink-0"
                      >
                        Editar
                      </button>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-[#0F172A] dark:text-white">2. Antecedentes Personales</p>
                        <p className="text-[#475569] dark:text-slate-300">
                          {[form.nombres, form.primerApellido, form.segundoApellido].filter(Boolean).join(' ')} ·{' '}
                          {form.nacionalidad} · Nasc. {form.fechaNacimiento ? formatDateBR(form.fechaNacimiento) : '—'}
                        </p>
                        <p className="text-[#475569] dark:text-slate-300">
                          Notificación: <strong className="text-[#0F172A] dark:text-white">{form.correoNotificacion}</strong>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep('datos_personales')}
                        className="text-xs font-semibold text-[#0039A6] dark:text-blue-400 underline shrink-0"
                      >
                        Editar
                      </button>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-[#0F172A] dark:text-white">3. Documento y Destino</p>
                        <p className="text-[#475569] dark:text-slate-300">
                          {form.tipoDocumento} <span className="font-mono">{form.numeroDocumento}</span> (venc.{' '}
                          {form.fechaVencimientoDoc ? formatDateBR(form.fechaVencimientoDoc) : '—'})
                        </p>
                        <p className="text-[#475569] dark:text-slate-300">
                          Destino: {form.comunaDestinoChile}, {form.regionDestinoChile} · {form.dependientes.length}{' '}
                          dependente(s)
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep('identificacion_domicilio')}
                        className="text-xs font-semibold text-[#0039A6] dark:text-blue-400 underline shrink-0"
                      >
                        Editar
                      </button>
                    </div>

                    <div className="p-4 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                          <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                          4. Documentos Adjuntos ({Object.keys(form.attachments).length}/{documentSlots.length})
                        </p>
                        <ul className="space-y-0.5 text-[#475569] dark:text-slate-300">
                          {documentSlots.map((s) => {
                            const att = form.attachments[s.id];
                            return (
                              <li key={s.id}>
                                {att ? '✓' : '—'} {s.nombrePortugues}:{' '}
                                <span className="font-mono text-[11px]">{att?.fileName || 'Não anexado'}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep('documentos')}
                        className="text-xs font-semibold text-[#0039A6] dark:text-blue-400 underline shrink-0"
                      >
                        Editar
                      </button>
                    </div>
                  </div>

                  {/* Declarações Obrigatórias + Captcha simulado */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B1320] border border-[#CBD5E1] dark:border-[#1E293B] space-y-3">
                    <label className="flex items-start gap-2.5 text-xs text-[#0F172A] dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.declaraVeracidad}
                        onChange={(e) => updateField('declaraVeracidad', e.target.checked)}
                        className="mt-0.5 rounded accent-[#0039A6]"
                      />
                      <span>
                        <strong>Declaración Jurada (Art. 32 Ley Nº 21.325):</strong> Declaro bajo juramento que toda
                        la información y documentación adjunta es auténtica y fidedigna.
                      </span>
                    </label>

                    <label className="flex items-start gap-2.5 text-xs text-[#0F172A] dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.aceptaNotificacionElectronica}
                        onChange={(e) => updateField('aceptaNotificacionElectronica', e.target.checked)}
                        className="mt-0.5 rounded accent-[#0039A6]"
                      />
                      <span>
                        <strong>Notificación Electrónica (Art. 146 Ley Nº 21.325):</strong> Autorizo al Servicio
                        Nacional de Migraciones a practicar todas las notificaciones al correo{' '}
                        <strong className="font-mono">{form.correoNotificacion || 'informado'}</strong>.
                      </span>
                    </label>

                    <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#1E293B]">
                      <label className="inline-flex items-center gap-3 px-4 py-3 rounded-lg bg-white dark:bg-[#131F33] border border-[#CBD5E1] dark:border-[#1E293B] cursor-pointer text-xs font-semibold text-[#0F172A] dark:text-slate-100">
                        <input
                          type="checkbox"
                          checked={form.captchaVerificado}
                          onChange={(e) => updateField('captchaVerificado', e.target.checked)}
                          className="w-4 h-4 rounded accent-[#0039A6]"
                        />
                        <span>No soy un robot (Verificación de seguridad SERMIG)</span>
                        {form.captchaVerificado && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                        )}
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* ============================================================
                  ETAPA 6: COMPROBANTE DE INGRESO SIMULADO
                 ============================================================ */}
              {currentStep === 'comprobante' && submittedReceipt && (
                <SermigSubmissionReceipt receipt={submittedReceipt} onRestart={handleRestartSimulation} />
              )}

              {/* Barra inferior de navegação do formulário SERMIG (Etapas 1 a 5) */}
              {currentStep !== 'acceso' && currentStep !== 'comprobante' && (
                <div className="mt-6 pt-4 border-t border-[#E2E8F0] dark:border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#1E293B] bg-white dark:bg-[#131F33] text-xs font-semibold text-[#334155] dark:text-slate-200 hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors whitespace-nowrap"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    Volver (Anterior)
                  </button>

                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0039A6] hover:bg-[#002F87] text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    {currentStep === 'revision_declaracion' ? (
                      <>
                        <Send className="w-4 h-4" aria-hidden="true" />
                        Enviar Solicitud (Simulação)
                      </>
                    ) : (
                      <>
                        Guardar y Siguiente
                        <ArrowRight className="w-4 h-4" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </SermigPortalChrome>
          </div>

          {/* Guia lateral em português (Two-Zone Sandbox) */}
          {showGuide && (
            <div className="xl:col-span-4 min-w-0">
              <SermigGuideSidebar currentStep={currentStep} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
