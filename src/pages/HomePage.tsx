import React, { useState } from 'react';
import { ArrowRight, BookOpen, ChevronDown, ChevronUp, MessageCircle, ShieldCheck } from 'lucide-react';
import { LegalBaseModal } from '../components/LegalBaseModal';
import { useApp } from '../contexts/AppContext';
import { buildWhatsAppUrl, sanitizeHtml } from '../utils/formatters';

interface HomePageProps {
  onNavigate: (path: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  const { empresa, siteContent, partnersPublic, legalSources } = useApp();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [lawModalOpen, setLawModalOpen] = useState(false);

  const bySec = (key: string) => siteContent.find((s) => s.secao === key && s.ativo);
  const hero = bySec('hero');
  const servicos = bySec('servicos');
  const diferenciais = bySec('diferenciais');
  const comoFunciona = bySec('como_funciona');
  const quemSomos = bySec('quem_somos');
  const faq = bySec('faq');
  const contato = bySec('contato');

  const heroDestaques = (hero?.metadados?.destaques as string[] | undefined) || [
    'Atendimento 100% em português do Brasil',
    'Base normativa alinhada à Ley 21.325 e SERMIG',
    'Acompanhamento transparente em 15 etapas',
  ];

  const servicosItens = (servicos?.metadados?.itens as { numero: string; titulo: string; descricao: string }[] | undefined) || [];
  const difItens = (diferenciais?.metadados?.itens as { titulo: string; descricao: string }[] | undefined) || [];
  const passos = (comoFunciona?.metadados?.passos as { passo: string; titulo: string; descricao: string }[] | undefined) || [];
  const perguntas = (faq?.metadados?.perguntas as { pergunta: string; resposta: string }[] | undefined) || [];

  const whatsappHeroUrl = buildWhatsAppUrl(
    empresa.whatsapp,
    'Olá! Gostaria de receber informações sobre assessoria migratória para o Chile.',
  );

  return (
    <div>
      {/* 1. HERO SPLIT */}
      {hero && (
        <section className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-center">
                <p className="text-xs font-semibold tracking-wide text-slate-600 mb-3">
                  Assessoria Migratória Brasil – Chile · Ley 21.325 &amp; Acordo Mercosul
                </p>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.12] text-balance mb-5">
                  {hero.titulo}
                </h1>
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl mb-4">
                  {hero.subtitulo}
                </p>
                {hero.conteudoHtml && (
                  <div
                    className="text-sm text-slate-600 leading-relaxed max-w-2xl mb-8"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(hero.conteudoHtml) }}
                  />
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('/diagnostico')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  >
                    {(hero.metadados?.ctaPrimario as string) || 'Fazer Diagnóstico Gratuito'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <a
                    href={whatsappHeroUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold text-slate-800 border border-slate-300 bg-white hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <MessageCircle className="w-4 h-4 text-[#1E7E34]" />
                    {(hero.metadados?.ctaSecundario as string) || 'Falar no WhatsApp'}
                  </a>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="relative h-72 sm:h-96 lg:h-full min-h-[340px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
                  {hero.imagemUrl ? (
                    <img
                      src={hero.imagemUrl}
                      alt="Santiago do Chile e Cordilheira dos Andes"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white text-sm">
                      Santiago do Chile · Assessoria Internacional
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 text-white">
                    <p className="text-xs font-medium text-slate-200">Operação Brasil &amp; Santiago</p>
                    <p className="text-base font-semibold mt-0.5">
                      Segurança documental do protocolo ao Estampado Electrónico
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Faixa de confiança abaixo do split */}
            <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-6">
              {heroDestaques.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
                  <p className="text-sm font-medium text-slate-800">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 2. SERVIÇOS */}
      {servicos && (
        <section className="py-16 lg:py-20 bg-[var(--color-bg)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-3xl mb-12">
              <p className="text-xs font-semibold tracking-wide text-slate-500 mb-2">Serviços especializados</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance mb-3">{servicos.titulo}</h2>
              <p className="text-base text-slate-600">{servicos.subtitulo}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {servicosItens.map((item) => (
                <div key={item.numero} className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
                  <p className="text-xs font-semibold text-slate-500 mb-2 tabular-nums">
                    {item.numero}. Solução migratória
                  </p>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.titulo}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 3. DIFERENCIAIS */}
      {diferenciais && (
        <section className="py-16 lg:py-20 bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-5">
              <div className="h-72 lg:h-full min-h-[300px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                {diferenciais.imagemUrl ? (
                  <img
                    src={diferenciais.imagemUrl}
                    alt="Mesa de consultoria jurídica e migratória"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
            </div>
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-xs font-semibold text-slate-500 mb-2">Metodologia operacional</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance mb-3">{diferenciais.titulo}</h2>
              <p className="text-base text-slate-600 mb-8">{diferenciais.subtitulo}</p>
              <div className="space-y-6">
                {difItens.map((d, idx) => (
                  <div key={idx} className="pb-6 border-b border-slate-200 last:border-b-0 last:pb-0">
                    <h3 className="text-base font-semibold text-slate-900 mb-1">{d.titulo}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed">{d.descricao}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <button
                  type="button"
                  onClick={() => setLawModalOpen(true)}
                  className="inline-flex items-center gap-2 text-sm font-semibold hover:underline"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <BookOpen className="w-4 h-4" />
                  Entenda a Lei (Resumo acessível para clientes)
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. COMO FUNCIONA */}
      {comoFunciona && (
        <section className="py-16 lg:py-20 bg-[var(--color-bg)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="max-w-2xl mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance mb-2">{comoFunciona.titulo}</h2>
              <p className="text-base text-slate-600">{comoFunciona.subtitulo}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {passos.map((p) => (
                <div key={p.passo} className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xl font-bold tabular-nums mb-3" style={{ color: 'var(--color-accent)' }}>
                    {p.passo}
                  </p>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{p.titulo}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{p.descricao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 5. RESUMO QUEM SOMOS */}
      {quemSomos && (
        <section className="py-16 lg:py-20 bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-7">
              <p className="text-xs font-semibold text-slate-500 mb-2">Quem Somos</p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance mb-3">{quemSomos.titulo}</h2>
              <p className="text-base text-slate-600 mb-4">{quemSomos.subtitulo}</p>
              <div
                className="text-sm text-slate-700 leading-relaxed mb-6"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(quemSomos.conteudoHtml) }}
              />
              <button
                type="button"
                onClick={() => onNavigate('/quem-somos')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition-colors"
              >
                Conhecer trajetória e credenciais
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="lg:col-span-5">
              <div className="aspect-[3/4] max-w-sm mx-auto rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                {quemSomos.imagemUrl ? (
                  <img
                    src={quemSomos.imagemUrl}
                    alt="Consultoria D&M Integra Chile"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 6. PARCEIROS HOMOLOGADOS */}
      {partnersPublic.length > 0 && (
        <section className="py-16 lg:py-20 bg-[var(--color-bg)]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Parceiros recomendados</h2>
                <p className="text-base text-slate-600">
                  Rede homologada no Brasil e no Chile para apostilamentos, traduções juramentadas e relocation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/parceiros')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap shrink-0 hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                Ver todos e Seja um Parceiro
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {partnersPublic.slice(0, 3).map((p) => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-6">
                  <p className="text-xs font-medium text-slate-500 mb-1.5">
                    {p.categoria} · {p.pais}
                  </p>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{p.nome}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">{p.descricaoPublica}</p>
                  <p className="text-xs text-slate-500">{p.cidadeRegiao}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 7. FAQ EM ACORDEÃO */}
      {faq && perguntas.length > 0 && (
        <section className="py-16 lg:py-20 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 text-balance mb-2">{faq.titulo}</h2>
            <p className="text-base text-slate-600 mb-8">{faq.subtitulo}</p>
            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white">
              {perguntas.map((item, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div key={idx}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-sm sm:text-base font-semibold text-slate-900">{item.pergunta}</span>
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-5 text-sm text-slate-600 leading-relaxed">{item.resposta}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 8. CONTATO CTA */}
      {contato && (
        <section className="py-16 text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-balance mb-3">{contato.titulo}</h2>
            <p className="text-base text-slate-200 max-w-2xl mx-auto mb-8">{contato.subtitulo}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('/diagnostico')}
                className="px-6 py-3 rounded-lg text-sm font-semibold text-slate-950 transition-opacity hover:opacity-95"
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                Iniciar Diagnóstico Agora
              </button>
              <a
                href={whatsappHeroUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg text-sm font-semibold text-white border border-white/30 hover:bg-white/10 transition-colors"
              >
                Atendimento via WhatsApp
              </a>
            </div>
          </div>
        </section>
      )}

      <LegalBaseModal
        open={lawModalOpen}
        onClose={() => setLawModalOpen(false)}
        title="Entenda a Lei — Normas em linguagem clara"
        sources={legalSources}
        clientFriendlyOnly
      />
    </div>
  );
};
