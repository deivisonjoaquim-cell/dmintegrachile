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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="bg-[var(--color-surface)] border border-[#E5DFD2] card-radius overflow-hidden shadow-[0_6px_24px_rgba(11,31,51,0.04)]">
          <BrandRibbon className="h-[3px] w-full" />
          <div className="p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5">
              <div className="aspect-[3/4] card-radius overflow-hidden border border-[#E5DFD2] bg-[#F1EDE4]">
                {quemSomos?.imagemUrl ? (
                  <OptimizedImage
                    src={quemSomos.imagemUrl}
                    alt={meta.responsavel || empresa.responsavel_tecnico}
                    priority
                    sizes="(max-width: 1024px) 100vw, 420px"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">
                    Foto institucional
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <p className="brand-kicker">
                Institucional · {empresa.nome_empresa}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#0B1F33] text-balance">
                {quemSomos?.titulo || 'Quem Somos'}
              </h1>
              <p className="text-base text-[#4A5A6D] leading-relaxed">
                {quemSomos?.subtitulo}
              </p>
              {quemSomos?.conteudoHtml && (
                <div
                  className="text-sm sm:text-base text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(quemSomos.conteudoHtml) }}
                />
              )}

              <div className="pt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onNavigate('/diagnostico')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 btn-radius text-sm font-semibold text-white whitespace-nowrap shadow-[0_2px_8px_rgba(11,31,51,0.18)] hover:opacity-95 transition-all"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  Iniciar Diagnóstico Gratuito
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLawModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 btn-radius border border-[#DDD6C7] bg-white text-sm font-semibold text-[#0B1F33] hover:bg-[#F7F5F0] whitespace-nowrap transition-colors"
                >
                  <BookOpen className="w-4 h-4 text-[#8C6D14]" />
                  Entenda a legislação
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Faixa Executiva Marinho & Ouro — Pilares Institucionais */}
        <section className="rounded-2xl bg-[#0B1F33] text-white border border-[#1E3B5A] shadow-[0_14px_34px_rgba(11,31,51,0.16)] overflow-hidden">
          <div className="px-6 sm:px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-6 divide-y md:divide-y-0 md:divide-x divide-white/10">
            <div className="pt-1 md:pt-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E5C76B]">
                01 · Base Jurídica Sólida
              </p>
              <p className="font-display text-lg font-bold text-white mt-1">
                Ley Nº 21.325 &amp; Decreto Nº 177
              </p>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Cada estratégia migratória é estruturada sobre a legislação chilena atualizada e o Acordo Mercosul.
              </p>
            </div>
            <div className="pt-4 md:pt-0 md:pl-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E5C76B]">
                02 · Atuação Brasil – Chile
              </p>
              <p className="font-display text-lg font-bold text-white mt-1">
                Planejamento Antes do Embarque
              </p>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                Sincronização de certidões, Apostila de Haia e protocolo digital SERMIG para evitar vencimentos.
              </p>
            </div>
            <div className="pt-4 md:pt-0 md:pl-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E5C76B]">
                03 · Privacidade &amp; Ética
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
          <div className="bg-[var(--color-surface)] border border-[#E5DFD2] card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <GraduationCap className="w-5 h-5 text-[#0B1F33]" />
              <h2 className="text-base font-bold text-[#0B1F33] font-brand-sans">
                {meta.formacaoTitulo || 'Formação Acadêmica e Qualificação Jurídica'}
              </h2>
            </div>
            <div className="space-y-2 text-sm text-[#4A5A6D] leading-relaxed">
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

          <div className="bg-[var(--color-surface)] border border-[#E5DFD2] card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Briefcase className="w-5 h-5 text-[#146B43]" />
              <h2 className="text-base font-bold text-[#0B1F33] font-brand-sans">
                {meta.experienciaTitulo || 'Especialização e Escopo de Atuação'}
              </h2>
            </div>
            <div className="space-y-2 text-sm text-[#4A5A6D] leading-relaxed">
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

          <div className="bg-[var(--color-surface)] border border-[#E5DFD2] card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Shield className="w-5 h-5 text-[#0B1F33]" />
              <h2 className="text-base font-bold text-[#0B1F33] font-brand-sans">Missão e Ética</h2>
            </div>
            <p className="text-sm text-[#4A5A6D] leading-relaxed">
              {meta.missao || 'Conduzir cada processo com transparência documental, cumprimento rigoroso de prazos e respeito integral à LGPD (Lei brasileira nº 13.709/2018).'}
            </p>
          </div>

          <div className="bg-[var(--color-surface)] border border-[#E5DFD2] card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Award className="w-5 h-5 text-[#C8A236]" />
              <h2 className="text-base font-bold text-[#0B1F33] font-brand-sans">Credenciais e Conformidade</h2>
            </div>
            <p className="text-sm text-[#4A5A6D] leading-relaxed">
              {meta.credenciais || 'Atuação alinhada à Ley chilena Nº 21.325, ao Decreto chileno Nº 177/2022, ao Acordo Mercosul e à LGPD (Lei brasileira nº 13.709/2018).'}
            </p>
          </div>
        </div>

        {timeline.length > 0 && (
          <section className="bg-[var(--color-surface)] border border-[#E5DFD2] card-radius p-6 sm:p-8 space-y-5">
            <div>
              <p className="brand-kicker">Trajetória</p>
              <h2 className="text-2xl font-bold text-[#0B1F33] mt-0.5">Marcos da Nossa História</h2>
              <p className="text-xs text-[#4A5A6D] mt-1">Evolução metodológica e institucional Brasil–Chile</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {timeline.map((m, idx) => (
                <div key={idx} className="p-4 card-radius bg-[#F7F5F0] border border-[#E5DFD2] space-y-1.5">
                  <p className="text-lg font-bold tabular-nums text-[#8C6D14]">
                    {m.ano}
                  </p>
                  <p className="text-sm font-bold text-[#0B1F33]">{m.titulo}</p>
                  <p className="text-xs text-[#4A5A6D] leading-relaxed">{m.descricao}</p>
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
