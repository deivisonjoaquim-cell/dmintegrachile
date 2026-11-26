import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Lock,
  Monitor,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { buildWhatsAppUrl } from '../../utils/formatters';
import { prefetchRouteChunk } from '../../utils/routePrefetch';

interface SermigSimulatorShowcaseProps {
  whatsapp: string;
  onNavigateAction: (dest: string) => void;
}

type PreviewStepId = 'acesso' | 'subcategoria' | 'documentos' | 'comprovante';

interface PreviewStep {
  id: PreviewStepId;
  num: string;
  labelPt: string;
  labelEs: string;
}

const PREVIEW_STEPS: PreviewStep[] = [
  { id: 'acesso', num: '01', labelPt: 'Login SERMIG', labelEs: 'Acceso SERMIG' },
  { id: 'subcategoria', num: '02', labelPt: 'Subcategoria & Art. 69', labelEs: 'Subcategoría & Art. 69' },
  { id: 'documentos', num: '03', labelPt: 'Anexos 5 MB & PF 60d', labelEs: 'Adjuntos 5 MB & PF 60d' },
  { id: 'comprovante', num: '04', labelPt: 'Recibo Simulado', labelEs: 'Comprobante Simulado' },
];

export const SermigSimulatorShowcase: React.FC<SermigSimulatorShowcaseProps> = ({
  whatsapp,
  onNavigateAction,
}) => {
  const { isEsCL } = useLanguage();
  const [activeStep, setActiveStep] = useState<PreviewStepId>('documentos');

  const waSimuladorUrl = buildWhatsAppUrl(
    whatsapp,
    isEsCL
      ? 'Hola! Quiero conocer la consultoría y tener acceso al Simulador del Portal SERMIG de D&M Integra Chile.'
      : 'Olá! Quero saber como contratar a assessoria e liberar o acesso ao Simulador do Portal SERMIG da D&M Integra Chile.',
  );

  return (
    <section
      data-testid="sermig-simulator-promo"
      className="relative overflow-hidden bg-[#070E1C] text-white border-y border-white/10 py-20 lg:py-28"
    >
      {/* Subtle architectural gradient glow — restrained Fortune 500 aesthetic */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-0 w-[640px] h-[640px] rounded-full opacity-25 blur-3xl"
        style={{
          background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, rgba(7,14,28,0) 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-center">
        {/* Left Column — Editorial Value Proposition & High-Intent CTAs */}
        <div className="lg:col-span-6 space-y-7">
          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-[0.08em] text-[#C9A86A]">
              {isEsCL
                ? 'Tecnología Exclusiva para Clientes · Portal SERMIG'
                : 'Exclusivo para Clientes D&M · Zero Medo de Errar no Protocolo'}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-white leading-[1.1] text-balance">
              {isEsCL
                ? 'Simula todo tu trámite en el Portal SERMIG antes de presentar el envío oficial.'
                : 'Treine todo o seu pedido no Portal SERMIG antes de dar entrada oficial.'}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
              {isEsCL
                ? 'Un error de formato, un certificado vencido o una selección incorrecta puede retrasar meses tu residencia. Nuestros clientes practican en un entorno fiel al Portal de Trámites Digitales de Chile, con validación técnica preventiva.'
                : 'Um PDF pesado demais, uma certidão vencida ou uma opção marcada errado pode atrasar sua mudança em meses. No nosso Simulador SERMIG, você ensaia cada tela idêntica ao site oficial do Chile com validação automática antes de enviar de verdade.'}
            </p>
          </div>

          {/* 3 Clean Hairline-Separated Value Rows */}
          <div className="divide-y divide-white/10 border-y border-white/10">
            <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-4">
              <p className="sm:col-span-5 text-xs font-semibold text-white">
                <span className="font-mono text-[#C9A86A] mr-2">01.</span>
                {isEsCL ? 'Réplica del Portal Oficial' : 'Idêntico ao portal oficial do Chile'}
              </p>
              <p className="sm:col-span-7 text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                {isEsCL
                  ? 'Del inicio de sesión (Cuenta SERMIG / ClaveÚnica) hasta la declaración jurada y el comprobante final.'
                  : 'Você pratica do login (Cuenta SERMIG / ClaveÚnica) até os anexos e o recibo final — sem sustos na hora H.'}
              </p>
            </div>
            <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-4">
              <p className="sm:col-span-5 text-xs font-semibold text-white">
                <span className="font-mono text-[#C9A86A] mr-2">02.</span>
                {isEsCL ? 'Auditoría Preventiva en Vivo' : 'Proteção imediata contra erros caros'}
              </p>
              <p className="sm:col-span-7 text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                {isEsCL
                  ? 'Bloquea errores del Art. 69, controla el límite de 5 MB en PDF y verifica la ventana de 60 días de antecedentes.'
                  : 'Avisa na hora se você tentar protocolar como turista no Chile, se o PDF passar de 5 MB ou se os Antecedentes da PF estiverem vencendo.'}
              </p>
            </div>
            <div className="py-4 grid grid-cols-1 sm:grid-cols-12 gap-1.5 sm:gap-4">
              <p className="sm:col-span-5 text-xs font-semibold text-white">
                <span className="font-mono text-[#C9A86A] mr-2">03.</span>
                {isEsCL ? 'Liberado en tu Portal de Cliente' : 'Acesso guiado no seu Portal'}
              </p>
              <p className="sm:col-span-7 text-xs sm:text-[13px] text-slate-300 leading-relaxed">
                {isEsCL
                  ? 'Habilitado por nuestro equipo con tus datos pre-cargados para entrenar cuantas veces necesites con total seguridad.'
                  : 'Nosso consultor libera o simulador já com os seus dados para você testar quantas vezes quiser com tranquilidade.'}
              </p>
            </div>
          </div>

          {/* Clear Primary + Secondary CTA Hierarchy */}
          <div className="flex flex-wrap items-center gap-3.5 pt-1">
            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
              onClick={() => onNavigateAction('/diagnostico')}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-sm font-semibold text-white transition-colors whitespace-nowrap"
            >
              {isEsCL ? 'Iniciar Diagnóstico y Desbloquear' : 'Iniciar Diagnóstico Gratuito'}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onMouseEnter={() => prefetchRouteChunk('/acompanhar')}
              onClick={() => onNavigateAction('/acompanhar')}
              className="inline-flex items-center gap-2 px-5 py-3.5 rounded-lg border border-white/20 hover:bg-white/10 text-sm font-semibold text-white transition-colors whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5 text-[#C9A86A]" />
              {isEsCL ? 'Ya soy cliente · Entrar al Portal' : 'Já sou cliente · Entrar no Portal'}
            </button>
          </div>

          <p className="text-xs text-slate-400">
            {isEsCL ? '¿Quieres ver cómo funciona en tu modalidad?' : 'Ficou com dúvida sobre como o simulador pode ajudar no seu visto?'}{' '}
            <a
              href={waSimuladorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#60A5FA] hover:underline font-medium"
            >
              {isEsCL ? 'Habla con un especialista por WhatsApp →' : 'Converse sem compromisso com um especialista no WhatsApp →'}
            </a>
          </p>
        </div>

        {/* Right Column — Interactive Live Preview of the SERMIG Portal Simulator */}
        <div className="lg:col-span-6">
          <div className="rounded-xl border border-white/15 bg-[#0D1628] shadow-[0_24px_64px_rgba(0,0,0,0.45)] overflow-hidden">
            {/* Realistic Browser Chrome Bar */}
            <div className="px-4 py-3 bg-[#091020] border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Monitor className="w-4 h-4 text-[#60A5FA] shrink-0" />
                <span className="font-mono text-[11px] text-slate-300 truncate">
                  tramites.extranjeria.gob.cl · Simulador D&amp;M
                </span>
              </div>
              <span className="font-mono text-[10px] text-[#C9A86A] whitespace-nowrap shrink-0">
                {isEsCL ? 'Vista previa interactiva' : 'Prévia interativa'}
              </span>
            </div>

            {/* Interactive Step Selector */}
            <div
              role="tablist"
              aria-label={isEsCL ? 'Etapas del Simulador SERMIG' : 'Etapas do Simulador SERMIG'}
              className="grid grid-cols-2 sm:grid-cols-4 border-b border-white/10 bg-[#0B1324]"
            >
              {PREVIEW_STEPS.map((step) => {
                const isActive = activeStep === step.id;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    data-testid={`sim-promo-tab-${step.id}`}
                    onClick={() => setActiveStep(step.id)}
                    className={`px-3 py-3 text-left transition-colors border-b-2 ${
                      isActive
                        ? 'border-[#3B82F6] bg-[#111E36] text-white'
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="block font-mono text-[10px] text-[#C9A86A] tabular-nums">{step.num}</span>
                    <span className="block text-[11px] font-semibold leading-tight mt-0.5 truncate">
                      {isEsCL ? step.labelEs : step.labelPt}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Simulated SERMIG Screen Body */}
            <div className="p-5 sm:p-6 min-h-[305px] flex flex-col justify-between gap-5">
              {activeStep === 'acesso' && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-mono text-[#60A5FA]">PASO 1 · PORTAL DE TRÁMITES DIGITALES</p>
                      <h3 className="text-base font-bold text-white mt-1">
                        {isEsCL ? 'Ingreso con Cuenta SERMIG o ClaveÚnica' : 'Acesso com Cuenta SERMIG ou ClaveÚnica'}
                      </h3>
                    </div>
                    <KeyRound className="w-5 h-5 text-[#C9A86A] shrink-0" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-lg bg-[#13223D] border border-[#3B82F6]/60">
                      <p className="text-xs font-bold text-white">Cuenta SERMIG (Exterior)</p>
                      <p className="text-[11px] text-slate-300 mt-1">
                        {isEsCL
                          ? 'Ideal para primera solicitud desde Brasil con correo verificado.'
                          : 'Padrão obrigatório para primeira Residência Temporal a partir do Brasil.'}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-lg bg-[#0A1120] border border-white/10">
                      <p className="text-xs font-bold text-slate-200">ClaveÚnica (RUN Chile)</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {isEsCL
                          ? 'Para prórrogas, cambios y Residencia Definitiva con Cédula.'
                          : 'Utilizado em prorrogações, mudanças e Residência Definitiva no Chile.'}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {isEsCL
                        ? 'Validación guiada de doble confirmación de correo y acceso seguro.'
                        : 'Treino guiado com dupla conferência de e-mail para não perder notificações do SERMIG.'}
                    </span>
                  </div>
                </div>
              )}

              {activeStep === 'subcategoria' && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-mono text-[#60A5FA]">PASO 2 · LEY Nº 21.325 &amp; ART. 69</p>
                      <h3 className="text-base font-bold text-white mt-1">
                        {isEsCL ? 'Selección de Subcategoría y Validación Geográfica' : 'Escolha da Subcategoria e Trava do Art. 69'}
                      </h3>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-[#C9A86A] shrink-0" />
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="p-3.5 rounded-lg bg-[#13223D] border border-white/12 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">Cód. 15 · Acordo de Residência Mercosul</p>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Solicitação a partir do Brasil · Trabalho liberado no Chile
                        </p>
                      </div>
                      <span className="font-mono text-[11px] font-bold text-emerald-400 shrink-0">Apto</span>
                    </div>
                    <div className="p-3.5 rounded-lg bg-amber-950/35 border border-amber-500/35 text-amber-200">
                      <p className="font-semibold text-amber-300">
                        {isEsCL ? 'Alerta Automática Art. 69:' : 'Simulação de Alerta Art. 69:'}
                      </p>
                      <p className="text-[11px] mt-1 leading-relaxed">
                        {isEsCL
                          ? 'Si seleccionas "Dentro de Chile como turista" sin vínculo familiar formalizado, el simulador bloquea el avance y explica la norma antes de un rechazo real.'
                          : 'Se o usuário selecionar "Dentro do Chile como turista" sem vínculo familiar formalizado, o simulador bloqueia o avanço e orienta a correção na hora.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 'documentos' && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-mono text-[#60A5FA]">PASO 3 · AUDITORIA DE ANEXOS SERMIG</p>
                      <h3 className="text-base font-bold text-white mt-1">
                        {isEsCL ? 'Control Real de PDF (5 MB) y Vigencia de 60 Días' : 'Conferência de PDFs (máx. 5 MB) e Prazo PF (60 dias)'}
                      </h3>
                    </div>
                    <FileCheck2 className="w-5 h-5 text-[#C9A86A] shrink-0" />
                  </div>
                  <div className="divide-y divide-white/10 border-y border-white/10 text-xs">
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">Passaporte Brasileiro (Folha de Dados)</p>
                        <p className="text-[11px] text-slate-400 font-mono tabular-nums">PDF · 1,4 MB · Vigência 28 meses</p>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-emerald-400 shrink-0">Validado</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">Antecedentes Polícia Federal + Apostila de Haia</p>
                        <p className="text-[11px] text-slate-400 font-mono tabular-nums">PDF · 0,9 MB · Emitido há 14 dias (limite 60d)</p>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-emerald-400 shrink-0">Na janela</span>
                    </div>
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-white">Fotografia Digital Padrão Cédula Chilena</p>
                        <p className="text-[11px] text-slate-400 font-mono tabular-nums">JPG · 420 KB · Fundo branco verificado</p>
                      </div>
                      <span className="font-mono text-[11px] font-semibold text-emerald-400 shrink-0">Validado</span>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 'comprovante' && (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-mono text-[#60A5FA]">PASO 4 · COMPROBANTE DE ENVÍO SIMULADO</p>
                      <h3 className="text-base font-bold text-white mt-1">
                        {isEsCL ? 'Recibo de Entrenamiento con Puntaje de Preparación' : 'Recibo de Treino & Relatório de Prontidão'}
                      </h3>
                    </div>
                    <Sparkles className="w-5 h-5 text-[#C9A86A] shrink-0" />
                  </div>
                  <div className="p-4 rounded-lg bg-[#0A1120] border border-emerald-500/35 space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono text-slate-400">PROTOCOLO SIMULADO</span>
                      <span className="font-mono font-bold text-[#C9A86A] tabular-nums">SIM-CL-2026-8419</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10 text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400">Subcategoria</p>
                        <p className="font-semibold text-white mt-0.5">Cód. 15 Mercosul</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Erros evitados</p>
                        <p className="font-mono font-semibold text-emerald-400 mt-0.5 tabular-nums">0 pendências</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Prontidão</p>
                        <p className="font-mono font-semibold text-white mt-0.5 tabular-nums">100%</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {isEsCL
                      ? 'Al completar la simulación, llegas al envío real en el SERMIG sabiendo exactamente cada campo, archivo y paso posterior hasta el Estampado Electrónico.'
                      : 'Ao concluir o treino no simulador, você chega ao portal oficial do SERMIG sabendo exatamente cada campo, anexo e próximo passo até o Estampado Electrónico.'}
                  </p>
                </div>
              )}

              {/* Bottom Footer Bar inside Preview Window */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <span className="text-slate-400">
                  {isEsCL
                    ? 'Incluido para clientes con portal habilitado por la consultoría.'
                    : 'Recurso liberado pelo consultor diretamente no seu Portal do Cliente.'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const idx = PREVIEW_STEPS.findIndex((s) => s.id === activeStep);
                    const next = PREVIEW_STEPS[(idx + 1) % PREVIEW_STEPS.length];
                    setActiveStep(next.id);
                  }}
                  className="font-semibold text-[#60A5FA] hover:text-white transition-colors whitespace-nowrap"
                >
                  {isEsCL ? 'Siguiente pantalla →' : 'Ver próxima tela →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
