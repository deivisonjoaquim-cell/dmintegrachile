import React, { useState } from 'react';
import { ArrowRight, Award, BookOpen, Briefcase, GraduationCap, Shield } from 'lucide-react';
import { LegalBaseModal } from '../components/LegalBaseModal';
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

  return (
    <div className="py-12 lg:py-16 bg-[var(--color-bg)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5">
            <div className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
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
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Iniciar Diagnóstico
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setLawModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                <BookOpen className="w-4 h-4" />
                Entenda a Lei
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <GraduationCap className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-semibold text-slate-900">Formação acadêmica e técnica</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {meta.formacao || 'Especialização em Direito Migratório Comparado Brasil–Chile e Gestão de Mobilidade Internacional.'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Briefcase className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-semibold text-slate-900">Experiência prática</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {meta.experiencia || 'Assessoria completa em Residência Temporal, Acordo Mercosul, Residência Definitiva e Relocation em Santiago.'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Shield className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
              <h2 className="text-base font-semibold text-slate-900">Missão e ética</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {meta.missao || 'Conduzir cada processo com transparência documental, cumprimento rigoroso de prazos e respeito à LGPD.'}
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2.5 mb-3">
              <Award className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h2 className="text-base font-semibold text-slate-900">Credenciais e conformidade</h2>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {meta.credenciais || 'Atuação conforme Ley Nº 21.325 · Decreto Nº 177/2022 · Acordo Mercosul · LGPD Lei 13.709/2018.'}
            </p>
          </div>
        </div>
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
