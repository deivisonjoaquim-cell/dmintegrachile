import React, { useState } from 'react';
import { ArrowRight, Award, BookOpen, Briefcase, GraduationCap, Shield } from 'lucide-react';
import { BrandRibbon } from '../components/BrandLogo';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { OptimizedImage } from '../components/OptimizedImage';
import { useSeoMetadata } from '../components/ui/DesignSystem';
import { useApp } from '../contexts/AppContext';
import { sanitizeHtml } from '../utils/formatters';

interface QuemSomosPageProps {
  onNavigate: (path: string) => void;
}

export const QuemSomosPage: React.FC<QuemSomosPageProps> = ({ onNavigate }) => {
  const { siteContent, empresa, legalSources } = useApp();
  const [lawModalOpen, setLawModalOpen] = useState(false);

  const quemSomos = siteContent.find((s) => s.secao === 'quem_somos');
  const meta = (quemSomos?.metadados || {}) as Record<string, string>;
  const timeline = empresa.quemSomosMarcoHistorico || [];

  useSeoMetadata({
    title: quemSomos?.seoTitulo || `Quem Somos | ${empresa.nome_empresa}`,
    description: quemSomos?.seoDescricao || quemSomos?.subtitulo || 'Conheça nossa trajetória e credenciais na assessoria Brasil–Chile.',
    orgName: empresa.nome_empresa,
    email: empresa.email,
    whatsapp: empresa.whatsapp,
  });

  return (
    <div className="py-12 lg:py-16 bg-[var(--color-bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
        <div className="bg-[var(--color-surface)] border border-[#E2E8F0] dark:border-[#1E293B] card-radius overflow-hidden shadow-[0_8px_28px_rgba(9,15,26,0.04)]">
          <BrandRibbon className="h-[2.5px] w-full" />
          <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="aspect-[3/4] max-w-md mx-auto card-radius overflow-hidden border border-[#E2E8F0] dark:border-[#1E293B] bg-[#F1F5F9] dark:bg-[#131F33]">
                {quemSomos?.imagemUrl ? (
                  <OptimizedImage
                    src={quemSomos.imagemUrl}
                    alt={meta.responsavel || empresa.responsavel_tecnico}
                    priority
                    sizes="(max-width: 1024px) 100vw, 420px"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                    Foto institucional
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div className="flex items-center gap-3">
                <span className="h-[2px] w-7 bg-[#10B981]" aria-hidden="true" />
                <p className="brand-kicker">
                  Institucional · {empresa.nome_empresa}
                </p>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#090F1A] dark:text-white text-balance">
                {quemSomos?.titulo || 'Quem Somos'}
              </h1>
              <p className="text-base text-[#475569] dark:text-slate-300 leading-relaxed">
                {quemSomos?.subtitulo}
              </p>
              {quemSomos?.conteudoHtml && (
                <div
                  className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(quemSomos.conteudoHtml) }}
                />
              )}

              <div className="pt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/diagnostico')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 btn-radius text-sm font-semibold text-white bg-[#090F1A] dark:bg-[#10B981] dark:text-[#041C16] whitespace-nowrap hover:bg-[#132036] dark:hover:bg-[#34D399] transition-colors"
                >
                  Iniciar Diagnóstico Gratuito
                  <ArrowRight className="w-4 h-4 text-[#34D399] dark:text-[#041C16]" />
                </button>
                <button
                  type="button"
                  onClick={() => setLawModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 btn-radius border border-[#CBD5E1] dark:border-[#1E293B] bg-white dark:bg-[#131F33] text-sm font-semibold text-[#090F1A] dark:text-slate-100 hover:bg-[#F8FAFC] dark:hover:bg-[#1A2942] whitespace-nowrap transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-[#047857] dark:text-[#34D399]" />
                  Entenda a legislação
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Faixa Executiva Obsidian & Esmeralda — Pilares Institucionais */}
        <section className="rounded-2xl bg-[#090F1A] text-white border border-white/10 overflow-hidden shadow-[0_18px_40px_rgba(9,15,26,0.16)]">
          <div className="px-6 sm:px-8 py-7 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-white/10">
            <div className="pt-1 md:pt-0">
              <p className="text-xs font-semibold font-mono text-[#34D399]">
                01. Base Jurídica Sólida
              </p>
              <p className="font-display text-lg font-bold text-white mt-1">
                Ley Nº 21.325 &amp; Decreto Nº 177
              </p>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Cada estratégia migratória é estruturada sobre a legislação chilena atualizada e o Acordo Mercosul.
              </p>
            </div>
            <div className="pt-4 md:pt-0 md:pl-6">
              <p className="text-xs font-semibold font-mono text-[#D4A853]">
                02. Atuação Brasil – Chile
              </p>
              <p className="font-display text-lg font-bold text-white mt-1">
                Planejamento Antes do Embarque
              </p>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Sincronização de certidões, Apostila de Haia e protocolo digital SERMIG para evitar vencimentos.
              </p>
            </div>
            <div className="pt-4 md:pt-0 md:pl-6">
              <p className="text-xs font-semibold font-mono text-[#34D399]">
                03. Privacidade &amp; Ética
              </p>
              <p className="font-display text-lg font-bold text-white mt-1">
                Conformidade Integral LGPD
              </p>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Gestão documental em cofre restrito com rastreabilidade, transparência de prazos e atendimento em português.
              </p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--color-surface)] border border-[#E2E8F0] dark:border-[#1E293B] card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <GraduationCap className="w-5 h-5 text-[#090F1A] dark:text-[#34D399]" />
              <h2 className="text-base font-bold text-[#090F1A] dark:text-white font-brand-sans">
                {meta.formacaoTitulo || 'Formação Acadêmica e Qualificação Jurídica'}
              </h2>
            </div>
            <div className="space-y-2 text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              {(
                meta.formacao ||
                'Bacharel em Direito (Graduação de Nível Superior)\nEspecialista (Pós-graduação Lato Sensu) em Direito Penal e Processo Penal\nSólida base jurídica com foco em legislação penal, conformidade normativa e análise processual.'
              )
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
            </div>
          </div>

          <div className="bg-[var(--color-surface)] border border-[#E2E8F0] dark:border-[#1E293B] card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Briefcase className="w-5 h-5 text-[#047857] dark:text-[#34D399]" />
              <h2 className="text-base font-bold text-[#090F1A] dark:text-white font-brand-sans">
                {meta.experienciaTitulo || 'Especialização e Escopo de Atuação'}
              </h2>
            </div>
            <div className="space-y-2 text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              {(
                meta.experiencia ||
                'Com base e atendimento no Brasil, prestamos assessoria completa e fundamentada na legislação migratória vigente para trâmites de Residência Temporal, Acordo Mercosul, Reunificação Familiar e Relocation em qualquer região do Chile.\nAtuação pautada pela análise criteriosa de requisitos, preparação documental prévia à mudança e mitigação de riscos administrativos.'
              )
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
            </div>
          </div>

          <div className="bg-[var(--color-surface)] border border-[#E2E8F0] dark:border-[#1E293B] card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Shield className="w-5 h-5 text-[#090F1A] dark:text-[#34D399]" />
              <h2 className="text-base font-bold text-[#090F1A] dark:text-white font-brand-sans">Missão e Ética</h2>
            </div>
            <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              {meta.missao || 'Conduzir cada processo com transparência documental, cumprimento rigoroso de prazos e respeito integral à LGPD (Lei brasileira nº 13.709/2018).'}
            </p>
          </div>

          <div className="bg-[var(--color-surface)] border border-[#E2E8F0] dark:border-[#1E293B] card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Award className="w-5 h-5 text-[#D4A853]" />
              <h2 className="text-base font-bold text-[#090F1A] dark:text-white font-brand-sans">Credenciais e Conformidade</h2>
            </div>
            <p className="text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              {meta.credenciais || 'Atuação alinhada à Ley chilena Nº 21.325, ao Decreto chileno Nº 177/2022, ao Acordo Mercosul e à LGPD (Lei brasileira nº 13.709/2018).'}
            </p>
          </div>
        </div>

        {timeline.length > 0 && (
          <section className="bg-[var(--color-surface)] border border-[#E2E8F0] dark:border-[#1E293B] card-radius p-6 sm:p-8 space-y-5">
            <div>
              <p className="brand-kicker">Trajetória</p>
              <h2 className="font-display text-2xl font-bold text-[#090F1A] dark:text-white mt-0.5">Marcos da Nossa História</h2>
              <p className="text-xs text-[#475569] dark:text-slate-400 mt-1">Evolução metodológica e institucional Brasil–Chile</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {timeline.map((m, idx) => (
                <div key={idx} className="p-4 card-radius bg-[#F8FAFC] dark:bg-[#131F33] border border-[#E2E8F0] dark:border-[#1E293B] space-y-1.5">
                  <p className="text-lg font-bold font-mono tabular-nums text-[#047857] dark:text-[#34D399]">
                    {m.ano}
                  </p>
                  <p className="text-sm font-bold text-[#090F1A] dark:text-white">{m.titulo}</p>
                  <p className="text-xs text-[#475569] dark:text-slate-300 leading-relaxed">{m.descricao}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <LegalBaseModal
        open={lawModalOpen}
        onClose={() => setLawModalOpen(false)}
        title="Entenda a Legislação — Normas em Linguagem Clara"
        sources={legalSources}
        clientFriendlyOnly
      />
    </div>
  );
};
