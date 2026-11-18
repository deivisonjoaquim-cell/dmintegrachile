import React, { useState } from 'react';
import { ArrowRight, Award, BookOpen, Briefcase, GraduationCap, Shield } from 'lucide-react';
import { LegalBaseModal } from '../components/LegalBaseModal';
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
        <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5">
            <div className="aspect-[3/4] card-radius overflow-hidden border border-slate-200 bg-slate-100">
              {quemSomos?.imagemUrl ? (
                <img
                  src={quemSomos.imagemUrl}
                  alt={meta.responsavel || empresa.responsavel_tecnico}
                  referrerPolicy="no-referrer"
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
            <p className="text-xs font-semibold text-slate-500">
              Institucional · {empresa.nome_empresa}
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 text-balance">
              {quemSomos?.titulo || 'Quem Somos'}
            </h1>
            <p className="text-base text-slate-600 leading-relaxed">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 btn-radius text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Iniciar Diagnóstico
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLawModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 btn-radius border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <BookOpen className="w-4 h-4" />
                Entenda a Lei
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <GraduationCap className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-semibold text-slate-900">
                {meta.formacaoTitulo || 'Formação Acadêmica e Qualificação Jurídica'}
              </h2>
            </div>
            <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
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

          <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Briefcase className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-semibold text-slate-900">
                {meta.experienciaTitulo || 'Especialização e Escopo de Atuação'}
              </h2>
            </div>
            <div className="space-y-2 text-sm text-slate-600 leading-relaxed">
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

          <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Shield className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-semibold text-slate-900">Missão e ética</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {meta.missao || 'Conduzir cada processo com transparência documental, cumprimento rigoroso de prazos e respeito à LGPD.'}
            </p>
          </div>

          <div className="bg-[var(--color-surface)] border border-slate-200 card-radius p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Award className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h2 className="text-base font-semibold text-slate-900">Credenciais e conformidade</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {meta.credenciais || 'Atuação conforme Ley Nº 21.325 · Decreto Nº 177/2022 · Acordo Mercosul · LGPD Lei 13.709/2018.'}
            </p>
          </div>
        </div>

        {timeline.length > 0 && (
          <section className="bg-[var(--color-surface)] border border-slate-200 card-radius p-6 sm:p-8 space-y-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Marcos da Nossa História</h2>
              <p className="text-xs text-slate-500">Evolução metodológica e institucional Brasil–Chile</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {timeline.map((m, idx) => (
                <div key={idx} className="p-4 card-radius bg-slate-50 border border-slate-200 space-y-1.5">
                  <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-accent)' }}>
                    {m.ano}
                  </p>
                  <p className="text-sm font-bold text-slate-900">{m.titulo}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{m.descricao}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <LegalBaseModal
        open={lawModalOpen}
        onClose={() => setLawModalOpen(false)}
        title="Entenda a Lei — Base Normativa em Linguagem Acessível"
        sources={legalSources}
        clientFriendlyOnly
      />
    </div>
  );
};
