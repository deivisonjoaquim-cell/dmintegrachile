import React, { useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Handshake, MessageCircle, Search, Star } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { submitPartnerProposalPublic } from '../services/firestoreService';
import type { CurrencyCode, PartnerCategory } from '../types/domain';
import { buildWhatsAppUrl, maskPhoneBR } from '../utils/formatters';

const PARTNER_CATEGORIES: PartnerCategory[] = [
  'Escritório de Advocacia',
  'Cartório / Apostilamento',
  'Tradutor Juramentado',
  'Seguradora / Saúde',
  'Imobiliária',
  'Escola / Universidade',
  'Despachante',
  'Contabilidade / Abertura Empresa',
  'Outro',
];

export const ParceirosPage: React.FC = () => {
  const { partnersPublic } = useApp();
  const [search, setSearch] = useState('');
  const [filterPais, setFilterPais] = useState('Todos');
  const [filterCat, setFilterCat] = useState('Todas');

  // Formulário Seja um Parceiro
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [categoria, setCategoria] = useState<PartnerCategory>('Tradutor Juramentado');
  const [pais, setPais] = useState<'Brasil' | 'Chile' | 'Ambos'>('Brasil');
  const [cidade, setCidade] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [moeda, setMoeda] = useState<CurrencyCode>('BRL');
  const [proposta, setProposta] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const filteredPartners = useMemo(() => {
    return partnersPublic.filter((p) => {
      if (filterPais !== 'Todos' && p.pais !== filterPais && p.pais !== 'Ambos') return false;
      if (filterCat !== 'Todas' && p.categoria !== filterCat) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.nome.toLowerCase().includes(q) ||
          p.categoria.toLowerCase().includes(q) ||
          p.cidadeRegiao.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [partnersPublic, search, filterPais, filterCat]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (honeypot.trim() !== '') {
      setFormError('Envio bloqueado por validação anti-spam.');
      return;
    }
    if (!nomeEmpresa.trim() || !responsavel.trim() || !whatsapp.trim() || !email.includes('@')) {
      setFormError('Preencha nome da empresa, responsável, WhatsApp e um e-mail válido.');
      return;
    }
    setSubmitting(true);
    try {
      const id = await submitPartnerProposalPublic({
        nome_empresa: nomeEmpresa.trim(),
        categoria,
        pais,
        cidade: cidade.trim(),
        responsavel: responsavel.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim().toLowerCase(),
        moeda,
        proposta: proposta.trim(),
        mensagem: mensagem.trim(),
        honeypot: '',
      });
      setSubmittedId(id);
      setNomeEmpresa('');
      setCidade('');
      setResponsavel('');
      setWhatsapp('');
      setEmail('');
      setProposta('');
      setMensagem('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao enviar proposta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-12 lg:py-16 bg-[var(--color-bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-14">
        {/* Lista pública de parceiros recomendados */}
        <section>
          <div className="max-w-3xl mb-8">
            <p className="text-xs font-semibold text-slate-500 mb-2">Rede homologada</p>
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 text-balance mb-3">
              Parceiros recomendados pela D&amp;M Integra Chile
            </h1>
            <p className="text-base text-slate-600">
              Profissionais e empresas avaliados por nossa equipe técnica no Brasil e no Chile para apoiar sua jornada migratória.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade ou especialidade..."
                aria-label="Buscar parceiro"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <select
              value={filterPais}
              onChange={(e) => setFilterPais(e.target.value)}
              aria-label="Filtrar por país"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="Todos">Todos os países</option>
              <option value="Brasil">Brasil</option>
              <option value="Chile">Chile</option>
            </select>
            <select
              value={filterCat}
              onChange={(e) => setFilterCat(e.target.value)}
              aria-label="Filtrar por categoria"
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white"
            >
              <option value="Todas">Todas as categorias</option>
              {PARTNER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filteredPartners.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-600">
              Nenhum parceiro recomendado encontrado para os filtros aplicados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPartners.map((p) => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-2">
                      <span>
                        {p.categoria} · {p.pais}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-slate-700 tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-[var(--color-accent)] text-[var(--color-accent)]" />
                        {p.avaliacao}/5
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">{p.nome}</h2>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">{p.descricaoPublica}</p>
                    <p className="text-xs text-slate-500 mb-4">{p.cidadeRegiao}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                    {p.whatsapp && (
                      <a
                        href={buildWhatsAppUrl(p.whatsapp, `Olá! Recebi a indicação da D&M Integra Chile para ${p.nome}.`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E7E34] hover:underline"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp
                      </a>
                    )}
                    {p.siteInstagram && (
                      <a
                        href={p.siteInstagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:underline"
                      >
                        Site / Instagram
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Formulário Seja um Parceiro */}
        <section id="seja-parceiro" className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
          <div className="max-w-2xl mb-8">
            <div className="flex items-center gap-2.5 mb-2">
              <Handshake className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <h2 className="text-2xl font-bold text-slate-900">Seja um Parceiro</h2>
            </div>
            <p className="text-sm text-slate-600">
              Oferece serviços jurídicos, cartoriais, tradução juramentada, locação, contabilidade ou relocation no Brasil ou Chile? Envie sua proposta para análise da nossa diretoria.
            </p>
          </div>

          {submittedId && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#1E7E34] shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">Proposta recebida com sucesso!</p>
                <p className="mt-0.5">Protocolo interno: {submittedId}. Nossa equipe analisará os termos e entrará em contato.</p>
              </div>
            </div>
          )}

          {formError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-[#C82333] text-sm">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Honeypot anti-spam oculto */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="partner-honeypot">Não preencher</label>
              <input
                id="partner-honeypot"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-empresa">
                Nome da empresa ou profissional *
              </label>
              <input
                id="p-empresa"
                required
                value={nomeEmpresa}
                onChange={(e) => setNomeEmpresa(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-cat">
                Categoria *
              </label>
              <select
                id="p-cat"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as PartnerCategory)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
              >
                {PARTNER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-pais">
                País de atuação *
              </label>
              <select
                id="p-pais"
                value={pais}
                onChange={(e) => setPais(e.target.value as 'Brasil' | 'Chile' | 'Ambos')}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="Brasil">Brasil</option>
                <option value="Chile">Chile</option>
                <option value="Ambos">Ambos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-cidade">
                Cidade / Região
              </label>
              <input
                id="p-cidade"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                placeholder="Ex.: São Paulo - SP / Santiago"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-resp">
                Nome do responsável *
              </label>
              <input
                id="p-resp"
                required
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-whats">
                WhatsApp *
              </label>
              <input
                id="p-whats"
                required
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskPhoneBR(e.target.value))}
                placeholder="+55 (11) 99999-0000"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-email">
                E-mail corporativo *
              </label>
              <input
                id="p-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-moeda">
                Moeda de negociação
              </label>
              <select
                id="p-moeda"
                value={moeda}
                onChange={(e) => setMoeda(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm bg-white"
              >
                <option value="BRL">BRL (Real R$)</option>
                <option value="CLP">CLP (Peso Chileno)</option>
                <option value="USD">USD (Dólar)</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-prop">
                Proposta de valores, prazos e benefícios para clientes
              </label>
              <textarea
                id="p-prop"
                rows={3}
                value={proposta}
                onChange={(e) => setProposta(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="p-msg">
                Mensagem complementar / diferenciais
              </label>
              <textarea
                id="p-msg"
                rows={2}
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 text-sm"
              />
            </div>

            <div className="md:col-span-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {submitting ? 'Enviando proposta...' : 'Enviar proposta de parceria'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
