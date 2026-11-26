import React, { useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';
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
    description:
      quemSomos?.seoDescricao ||
      quemSomos?.subtitulo ||
      'Conheça nossa trajetória e credenciais na assessoria Brasil–Chile.',
    orgName: empresa.nome_empresa,
    email: empresa.email,
    whatsapp: empresa.whatsapp,
  });

  const formacaoLines = (
    meta.formacao ||
    'Bacharel em Direito (Graduação de Nível Superior)\nEspecialista (Pós-graduação Lato Sensu) em Direito Penal e Processo Penal\nSólida base jurídica com foco em legislação penal, conformidade normativa e análise processual.'
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const experienciaLines = (
    meta.experiencia ||
    'Com base e atendimento no Brasil, prestamos assessoria completa e fundamentada na legislação migratória vigente para trâmites de Residência Temporal, Acordo Mercosul, Reunificação Familiar e Relocation em qualquer região do Chile.\nAtuação pautada pela análise criteriosa de requisitos, preparação documental prévia à mudança e mitigação de riscos administrativos.'
  )
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="bg-[#F7F8FA] dark:bg-[#070B12] text-[#0B1628] dark:text-white">
      {/* 1. Editorial Institutional Opening */}
      <section className="bg-white dark:bg-[#0D1422] border-b border-[#E5E7EB] dark:border-[#1E293B] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <div className="lg:col-span-7 space-y-6">
            <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
              Institucional · {empresa.nome_empresa}
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#0B1628] dark:text-white leading-[1.08] text-balance">
              {quemSomos?.titulo || 'Quem Somos'}
            </h1>
            {quemSomos?.subtitulo && (
              <p className="text-base sm:text-lg text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl">
                {quemSomos.subtitulo}
              </p>
            )}
            {quemSomos?.conteudoHtml && (
              <div
                className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(quemSomos.conteudoHtml) }}
              />
            )}

            <div className="pt-3 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('/diagnostico')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Iniciar Diagnóstico Gratuito
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLawModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-[#D1D5DB] dark:border-[#334155] text-sm font-medium text-[#0B1628] dark:text-slate-100 hover:bg-[#F7F8FA] dark:hover:bg-[#151F32] transition-colors whitespace-nowrap"
              >
                <BookOpen className="w-4 h-4 text-[#0F3D91] dark:text-[#60A5FA]" />
                Entenda a legislação
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="aspect-[3/4] max-w-sm mx-auto rounded-xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B] bg-[#F7F8FA] dark:bg-[#151F32]">
              {quemSomos?.imagemUrl ? (
                <OptimizedImage
                  src={quemSomos.imagemUrl}
                  alt={meta.responsavel || empresa.responsavel_tecnico}
                  priority
                  sizes="(max-width: 1024px) 100vw, 384px"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[#6B7280] dark:text-slate-400 text-sm">
                  Foto institucional
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. Institutional Governance Strip */}
      <section className="bg-[#070E1C] text-white py-14 lg:py-16">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid grid-cols-1 md:grid-cols-3 gap-10 divide-y md:divide-y-0 md:divide-x divide-white/12">
          <div className="space-y-2">
            <p className="font-mono text-xs text-[#C9A86A]">01. Base Jurídica</p>
            <h2 className="font-display text-lg font-bold text-white">Ley Nº 21.325 &amp; Decreto Nº 177</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Estratégias migratórias estruturadas sobre a legislação chilena atualizada e o Acordo Mercosul.
            </p>
          </div>
          <div className="pt-8 md:pt-0 md:pl-10 space-y-2">
            <p className="font-mono text-xs text-[#C9A86A]">02. Atuação Brasil – Chile</p>
            <h2 className="font-display text-lg font-bold text-white">Planejamento Antes do Embarque</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Sincronização de certidões, Apostila de Haia e protocolo digital SERMIG para eliminar retrabalho.
            </p>
          </div>
          <div className="pt-8 md:pt-0 md:pl-10 space-y-2">
            <p className="font-mono text-xs text-[#C9A86A]">03. Privacidade &amp; Ética</p>
            <h2 className="font-display text-lg font-bold text-white">Conformidade Integral LGPD</h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Gestão documental em ambiente restrito com rastreabilidade, transparência de prazos e atendimento em português.
            </p>
          </div>
        </div>
      </section>

      {/* 3. Academic & Legal Credentials (Hairline Grid — Zero Visual Clutter) */}
      <section className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 border-t border-[#E5E7EB] dark:border-[#1E293B]">
            <div className="py-8 md:pr-10 md:border-r border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
              <p className="font-mono text-xs text-[#0F3D91] dark:text-[#60A5FA]">01.</p>
              <h2 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                {meta.formacaoTitulo || 'Formação Acadêmica e Qualificação Jurídica'}
              </h2>
              <div className="space-y-2 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {formacaoLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>

            <div className="py-8 md:pl-10 border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
              <p className="font-mono text-xs text-[#0F3D91] dark:text-[#60A5FA]">02.</p>
              <h2 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                {meta.experienciaTitulo || 'Especialização e Escopo de Atuação'}
              </h2>
              <div className="space-y-2 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {experienciaLines.map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>

            <div className="py-8 md:pr-10 md:border-r border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
              <p className="font-mono text-xs text-[#0F3D91] dark:text-[#60A5FA]">03.</p>
              <h2 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                Missão e Ética
              </h2>
              <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {meta.missao ||
                  'Conduzir cada processo com transparência documental, cumprimento rigoroso de prazos e respeito integral à LGPD (Lei brasileira nº 13.709/2018).'}
              </p>
            </div>

            <div className="py-8 md:pl-10 border-b border-[#E5E7EB] dark:border-[#1E293B] space-y-3">
              <p className="font-mono text-xs text-[#0F3D91] dark:text-[#60A5FA]">04.</p>
              <h2 className="font-display text-xl font-bold text-[#0B1628] dark:text-white">
                Credenciais e Conformidade
              </h2>
              <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                {meta.credenciais ||
                  'Atuação alinhada à Ley chilena Nº 21.325, ao Decreto chileno Nº 177/2022, ao Acordo Mercosul e à LGPD (Lei brasileira nº 13.709/2018).'}
              </p>
            </div>
          </div>

          {timeline.length > 0 && (
            <div className="mt-20 space-y-8">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
                  Trajetória
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1628] dark:text-white">
                  Marcos da Nossa História
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {timeline.map((m, idx) => (
                  <div
                    key={idx}
                    className="pt-5 border-t border-[#E5E7EB] dark:border-[#1E293B] space-y-2"
                  >
                    <p className="text-lg font-bold font-mono tabular-nums text-[#0F3D91] dark:text-[#60A5FA]">
                      {m.ano}
                    </p>
                    <p className="text-base font-bold text-[#0B1628] dark:text-white">{m.titulo}</p>
                    <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                      {m.descricao}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

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
