import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  callAiEndpoint,
  makeId,
  saveDocumentAudited,
  syncPartnerAndPublic,
} from '../../services/firestoreService';
import type {
  EmpresaConfig,
  LegalSource,
  Partner,
  PartnerCategory,
  PartnerProposal,
  UserProfile,
  UserRole,
  VisaCategory,
  VisaRequirement,
} from '../../types/domain';
import { buildWhatsAppUrl, formatDateBR, parseFlexibleDate, toIsoDate } from '../../utils/formatters';
import {
  clearAiDraftCache,
  loadAiDraftCache,
  sanitizeClientAiError,
  saveAiDraftCache,
  type AiResponseMeta,
} from '../../utils/aiClient';

interface PainelParceirosLegalProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  partners: Partner[];
  partnerProposals: PartnerProposal[];
  legalSources: LegalSource[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  onRefresh: () => Promise<void>;
  onRefreshPublic: () => Promise<void>;
}

type TabKey = 'propostas' | 'parceiros' | 'legal' | 'vistos';

export const PainelParceirosLegal: React.FC<PainelParceirosLegalProps> = ({
  role,
  userProfile,
  empresa,
  partners,
  partnerProposals,
  legalSources,
  visaCategories,
  visaRequirements,
  onRefresh,
  onRefreshPublic,
}) => {
  if (role === 'assistente') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        Acesso restrito a Administradores e Consultores.
      </div>
    );
  }

  const [tab, setTab] = useState<TabKey>('propostas');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchLegal, setSearchLegal] = useState('');

  // IA Proposta
  const [aiPropLoadingId, setAiPropLoadingId] = useState<string | null>(null);
  const [aiPropProgress, setAiPropProgress] = useState<string | null>(null);

  // Novo Parceiro
  const [partnerModal, setPartnerModal] = useState<Partial<Partner> | null>(null);

  // Norma + IA
  const [editingSource, setEditingSource] = useState<LegalSource | null>(null);
  const [normaNewText, setNormaNewText] = useState('');
  const [normaAttachment, setNormaAttachment] = useState<{
    name: string;
    fileBase64: string;
    mimeType: string;
  } | null>(null);
  const [normaAiDraft, setNormaAiDraft] = useState<(AiResponseMeta & {
    artigosExtraidos: string;
    resumoExecutivo: string;
    explicacaoCliente: string;
    impactosVistos: string[];
    divergencias: string[];
  }) | null>(null);
  const [normaAiLoading, setNormaAiLoading] = useState(false);
  const [normaAiProgress, setNormaAiProgress] = useState<string | null>(null);

  useEffect(() => {
    if (!editingSource?.id) {
      setNormaAiDraft(null);
      setNormaAttachment(null);
      return;
    }
    const cached = loadAiDraftCache<
      AiResponseMeta & {
        artigosExtraidos: string;
        resumoExecutivo: string;
        explicacaoCliente: string;
        impactosVistos: string[];
        divergencias: string[];
      }
    >(`norma_${editingSource.id}`);
    setNormaAiDraft(cached);
    setNormaAttachment(null);
  }, [editingSource?.id]);

  const diasAlerta = empresa.diasAlertaRevisaoLegal || 90;

  const isSourceOutdated = (s: LegalSource): boolean => {
    if (!s.ultimaVerificacao) return true;
    const d = parseFlexibleDate(s.ultimaVerificacao);
    if (!d) return true;
    const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000);
    return diffDays > diasAlerta;
  };

  const filteredLegal = useMemo(() => {
    if (!searchLegal.trim()) return legalSources;
    const q = searchLegal.toLowerCase();
    return legalSources.filter(
      (s) =>
        s.titulo.toLowerCase().includes(q) ||
        s.numeroAno.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [legalSources, searchLegal]);

  // ===========================================================================
  // Propostas de Parceiros
  // ===========================================================================
  const handleAnalyzeProposalIa = async (prop: PartnerProposal) => {
    if (aiPropLoadingId) return;
    setAiPropLoadingId(prop.id);
    setAiPropProgress('Avaliando proposta...');
    setErrorMsg(null);
    try {
      const res = await callAiEndpoint<
        AiResponseMeta & {
          nota: number;
          riscos: string[];
          baseAplicada: string;
          sugestaoDecisao: string;
          textoIndicacao: string;
        }
      >(
        '/api/ai/proposta',
        {
          proposal: prop,
          legalSources,
        },
        {
          onProgress: (msg) => setAiPropProgress(msg),
        },
      );
      const prefixo =
        res.fallback || res.origem === 'regras'
          ? `[${res.origemLabel || 'Rascunho gerado por regras — IA indisponível no momento'}]\n`
          : '';
      const parecer = `${prefixo}Nota ${res.nota}/100 · Sugestão: ${res.sugestaoDecisao}\nBase: ${res.baseAplicada}\nRiscos: ${(res.riscos || []).join('; ')}`;
      await saveDocumentAudited(
        'partnerProposals',
        prop.id,
        {
          ...prop,
          status: 'Em Análise',
          parecerIa: parecer,
          textoIndicacao: res.textoIndicacao,
        },
        false,
        role,
        'parecer_ia_proposta',
      );
      setFeedback(
        res.fallback || res.origem === 'regras'
          ? `${res.origemLabel || 'Rascunho gerado por regras — IA indisponível no momento'}. ${res.mensagemUsuario || ''}`
          : `Parecer gerado pela IA para "${prop.nome_empresa}". Revise antes de aprovar.`,
      );
      await onRefresh();
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    } finally {
      setAiPropLoadingId(null);
      setAiPropProgress(null);
    }
  };

  const handleApproveProposal = async (prop: PartnerProposal) => {
    const partnerId = makeId('part');
    const newPartner: Partner = {
      id: partnerId,
      nome: prop.nome_empresa,
      tipoPessoa: 'Pessoa Jurídica',
      categoria: prop.categoria,
      pais: prop.pais,
      cidadeRegiao: prop.cidade,
      contato: prop.responsavel,
      whatsapp: prop.whatsapp,
      email: prop.email,
      siteInstagram: '',
      moedaNegociacao: prop.moeda,
      tabelaValoresComissao: prop.proposta,
      condicoesParceria: prop.mensagem,
      recomendadoAosClientes: true,
      avaliacao: 5,
      statusHomologacao: 'Ativo/Indicado',
      descricaoPublica: prop.textoIndicacao || prop.mensagem,
      observacoes: prop.parecerIa || 'Convertido a partir de proposta recebida no site.',
    };
    await syncPartnerAndPublic(newPartner, true, role);
    await saveDocumentAudited('partnerProposals', prop.id, { ...prop, status: 'Aprovada' }, false, role, 'aprovar_proposta');
    setFeedback(`Parceiro "${newPartner.nome}" homologado e publicado em /parceiros.`);
    await Promise.all([onRefresh(), onRefreshPublic()]);
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerModal) return;
    const isNew = !partners.some((p) => p.id === partnerModal.id);
    const full: Partner = {
      id: partnerModal.id || makeId('part'),
      nome: (partnerModal.nome || '').trim(),
      tipoPessoa: partnerModal.tipoPessoa || 'Pessoa Jurídica',
      categoria: (partnerModal.categoria || 'Outro') as PartnerCategory,
      pais: (partnerModal.pais || 'Chile') as Partner['pais'],
      cidadeRegiao: partnerModal.cidadeRegiao || '',
      contato: partnerModal.contato || '',
      whatsapp: partnerModal.whatsapp || '',
      email: partnerModal.email || '',
      siteInstagram: partnerModal.siteInstagram || '',
      moedaNegociacao: partnerModal.moedaNegociacao || 'BRL',
      tabelaValoresComissao: partnerModal.tabelaValoresComissao || '',
      condicoesParceria: partnerModal.condicoesParceria || '',
      recomendadoAosClientes: Boolean(partnerModal.recomendadoAosClientes),
      avaliacao: Number(partnerModal.avaliacao || 5),
      statusHomologacao: partnerModal.statusHomologacao || 'Ativo/Indicado',
      descricaoPublica: partnerModal.descricaoPublica || '',
      observacoes: partnerModal.observacoes || '',
    };
    await syncPartnerAndPublic(full, isNew, role);
    setPartnerModal(null);
    setFeedback(`Parceiro "${full.nome}" salvo e sincronizado com vitrine pública.`);
    await Promise.all([onRefresh(), onRefreshPublic()]);
  };

  // ===========================================================================
  // Base Legal & Versionamento
  // ===========================================================================
  const handleVerifySource = async (s: LegalSource) => {
    await saveDocumentAudited(
      'legalSources',
      s.id,
      {
        ...s,
        statusVigencia: 'Vigente',
        ultimaVerificacao: toIsoDate(new Date()),
        responsavelVerificacao: userProfile.nome || userProfile.email,
      },
      false,
      role,
      'verificar_norma',
    );
    setFeedback(`Norma "${s.titulo}" marcada como verificada e vigente.`);
    await onRefreshPublic();
  };

  const handleSelectNormaFile = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('O anexo da norma excede o limite de 5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const res = typeof reader.result === 'string' ? reader.result : '';
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      if (!base64) return;
      setNormaAttachment({
        name: file.name,
        fileBase64: base64,
        mimeType: file.type || 'application/pdf',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeNormaIa = async () => {
    if (!editingSource || normaAiLoading || (!normaNewText.trim() && !normaAttachment)) return;
    setNormaAiLoading(true);
    setNormaAiProgress('Analisando norma...');
    setErrorMsg(null);
    try {
      const res = await callAiEndpoint<
        AiResponseMeta & {
          artigosExtraidos: string;
          resumoExecutivo: string;
          explicacaoCliente: string;
          impactosVistos: string[];
          divergencias: string[];
        }
      >(
        '/api/ai/norma',
        {
          currentSource: editingSource,
          newText: normaNewText,
          fileBase64: normaAttachment?.fileBase64,
          mimeType: normaAttachment?.mimeType,
        },
        {
          onProgress: (msg) => setNormaAiProgress(msg),
        },
      );
      setNormaAiDraft(res);
      saveAiDraftCache(`norma_${editingSource.id}`, res);
    } catch (err) {
      setErrorMsg(sanitizeClientAiError(err));
    } finally {
      setNormaAiLoading(false);
      setNormaAiProgress(null);
    }
  };

  const handlePublishNormaUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource) return;
    const nextVerNum = (Number.parseFloat(editingSource.versao || '1.0') + 0.1).toFixed(1);
    const hist = editingSource.historicoVersoes || [];
    const updated: LegalSource = {
      ...editingSource,
      artigos: normaAiDraft?.artigosExtraidos || editingSource.artigos,
      resumoPortugues: normaAiDraft?.resumoExecutivo || editingSource.resumoPortugues,
      explicacaoCliente: normaAiDraft?.explicacaoCliente || editingSource.explicacaoCliente,
      versao: nextVerNum,
      statusVigencia: 'Vigente',
      ultimaVerificacao: toIsoDate(new Date()),
      responsavelVerificacao: userProfile.nome || userProfile.email,
      historicoVersoes: [
        ...hist,
        {
          versao: editingSource.versao,
          data: toIsoDate(new Date()),
          resumo: editingSource.resumoPortugues,
        },
      ],
    };
    await saveDocumentAudited('legalSources', editingSource.id, updated as unknown as Record<string, unknown>, false, role, 'atualizar_norma');
    clearAiDraftCache(`norma_${editingSource.id}`);
    setEditingSource(null);
    setNormaAiDraft(null);
    setNormaNewText('');
    setNormaAttachment(null);
    setFeedback(`Norma "${updated.titulo}" atualizada para versão ${nextVerNum} preservando histórico.`);
    await onRefreshPublic();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Parceiros, Base Legal &amp; Catálogo SERMIG</h1>
        <p className="text-xs text-slate-500">
          Gestão comercial de parceiros (comissões isoladas da vitrine pública) e governança normativa
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'propostas', label: `Propostas Recebidas (${partnerProposals.length})` },
          { id: 'parceiros', label: `Parceiros (${partners.length})` },
          { id: 'legal', label: `Base Legal (${legalSources.length})` },
          { id: 'vistos', label: `Vistos & Requisitos (${visaCategories.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as TabKey)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap ${
              tab === t.id ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-slate-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {feedback && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-medium">
          {feedback}
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-[#C82333] font-medium">
          {errorMsg}
        </div>
      )}

      {/* PROPOSTAS */}
      {tab === 'propostas' && (
        <div className="space-y-4">
          {partnerProposals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Nenhuma proposta de parceria recebida ainda.
            </div>
          ) : (
            partnerProposals.map((p) => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">
                      {p.categoria} · {p.pais} ({p.cidade}) · Moeda {p.moeda} · Status: {p.status}
                    </p>
                    <h3 className="text-base font-bold text-slate-900">{p.nome_empresa}</h3>
                    <p className="text-xs text-slate-600">
                      Responsável: {p.responsavel} · {p.whatsapp} · {p.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={aiPropLoadingId !== null}
                      onClick={() => void handleAnalyzeProposalIa(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                      {aiPropLoadingId === p.id ? aiPropProgress || 'Analisando...' : 'Avaliar com IA'}
                    </button>
                    {p.status !== 'Aprovada' && (
                      <button
                        type="button"
                        onClick={() => void handleApproveProposal(p)}
                        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]"
                      >
                        Aprovar e Converter em Parceiro
                      </button>
                    )}
                    <a
                      href={buildWhatsAppUrl(p.whatsapp, `Olá, ${p.responsavel}! Recebemos sua proposta de parceria da ${p.nome_empresa} na D&M Integra Chile.`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Responder
                    </a>
                  </div>
                </div>
                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong>Proposta comercial:</strong> {p.proposta}
                </p>
                {p.parecerIa && (
                  <p className="text-xs text-slate-700 bg-amber-50 p-3 rounded-lg border border-amber-200 whitespace-pre-wrap">
                    {p.parecerIa}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* PARCEIROS */}
      {tab === 'parceiros' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setPartnerModal({
                  id: makeId('part'),
                  nome: '',
                  tipoPessoa: 'Pessoa Jurídica',
                  categoria: 'Escritório de Advocacia',
                  pais: 'Chile',
                  moedaNegociacao: 'BRL',
                  recomendadoAosClientes: true,
                  avaliacao: 5,
                  statusHomologacao: 'Ativo/Indicado',
                })
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Parceiro
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map((p) => (
              <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="text-xs text-slate-500">{p.categoria} · {p.pais} · {p.statusHomologacao}</p>
                    <h3 className="text-base font-bold text-slate-900">{p.nome}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPartnerModal(p)}
                    className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-medium"
                  >
                    Editar
                  </button>
                </div>
                <p className="text-xs text-slate-700">
                  <strong>Comissão interna ({p.moedaNegociacao}):</strong> {p.tabelaValoresComissao || 'Não cadastrada'}
                </p>
                <p className="text-xs text-slate-500">
                  Vitrine pública: {p.recomendadoAosClientes ? 'Sim (Recomendado)' : 'Oculto do público'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BASE LEGAL */}
      {tab === 'legal' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchLegal}
              onChange={(e) => setSearchLegal(e.target.value)}
              placeholder="Buscar norma por título, número ou tag..."
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm"
            />
          </div>

          <div className="space-y-3">
            {filteredLegal.map((s) => {
              const outdated = isSourceOutdated(s);
              return (
                <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-slate-500">
                        {s.pais} · {s.tipo} · Versão {s.versao} · Status: <strong>{s.statusVigencia}</strong>
                        {s.ultimaVerificacao ? ` · Verificada em ${formatDateBR(s.ultimaVerificacao)}` : ' · Nunca verificada'}
                      </p>
                      <h3 className="text-base font-bold text-slate-900">{s.titulo}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {outdated && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B45309]">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Revisão &gt; {diasAlerta}d
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleVerifySource(s)}
                        className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-900"
                      >
                        Marcar como verificada
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSource(s)}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                      >
                        Atualizar / Comparar IA
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-700">{s.resumoPortugues}</p>
                  <p className="text-xs text-slate-500">
                    <strong>Entenda a Lei:</strong> {s.explicacaoCliente}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISTOS & REQUISITOS */}
      {tab === 'vistos' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                <th className="py-3 px-4 font-semibold">Código</th>
                <th className="py-3 px-4 font-semibold">Subcategoria</th>
                <th className="py-3 px-4 font-semibold">Dentro do Chile</th>
                <th className="py-3 px-4 font-semibold">Requisitos</th>
                <th className="py-3 px-4 font-semibold">Verificação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {visaCategories.map((v) => {
                const countReqs = visaRequirements.filter((r) => r.visaCategoryId === v.id).length;
                return (
                  <tr key={v.id}>
                    <td className="py-3 px-4 font-bold tabular-nums">{v.codigo}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900">{v.nomePortugues}</p>
                      <p className="text-slate-500">{v.nomeEspanhol}</p>
                    </td>
                    <td className="py-3 px-4">{v.permiteDentroChile}</td>
                    <td className="py-3 px-4 tabular-nums">{countReqs} item(ns)</td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={async () => {
                          await saveDocumentAudited(
                            'visaCategories',
                            v.id,
                            {
                              ...v,
                              statusVerificacao: v.statusVerificacao === 'Verificado' ? 'A verificar' : 'Verificado',
                              ultimaVerificacao: toIsoDate(new Date()),
                            },
                            false,
                            role,
                            'verificacao_visto',
                          );
                          await onRefreshPublic();
                        }}
                        className={`px-2.5 py-1 rounded border text-xs font-semibold ${
                          v.statusVerificacao === 'Verificado'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                            : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                      >
                        {v.statusVerificacao}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Parceiro */}
      {partnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSavePartner} className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Cadastro de Parceiro</h2>
            <input
              required
              value={partnerModal.nome || ''}
              onChange={(e) => setPartnerModal({ ...partnerModal, nome: e.target.value })}
              placeholder="Nome / Empresa"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={partnerModal.pais || 'Chile'}
                onChange={(e) => setPartnerModal({ ...partnerModal, pais: e.target.value as Partner['pais'] })}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="Brasil">Brasil</option>
                <option value="Chile">Chile</option>
                <option value="Ambos">Ambos</option>
              </select>
              <select
                value={partnerModal.statusHomologacao || 'Ativo/Indicado'}
                onChange={(e) => setPartnerModal({ ...partnerModal, statusHomologacao: e.target.value as Partner['statusHomologacao'] })}
                className="px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="Ativo/Indicado">Ativo/Indicado</option>
                <option value="Em Análise">Em Análise</option>
                <option value="Não Indicado/Suspenso">Não Indicado/Suspenso</option>
              </select>
            </div>
            <textarea
              rows={2}
              value={partnerModal.tabelaValoresComissao || ''}
              onChange={(e) => setPartnerModal({ ...partnerModal, tabelaValoresComissao: e.target.value })}
              placeholder="Tabela de valores e comissão (confidencial interno)"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <textarea
              rows={2}
              value={partnerModal.descricaoPublica || ''}
              onChange={(e) => setPartnerModal({ ...partnerModal, descricaoPublica: e.target.value })}
              placeholder="Descrição pública exibida em /parceiros"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={Boolean(partnerModal.recomendadoAosClientes)}
                onChange={(e) => setPartnerModal({ ...partnerModal, recomendadoAosClientes: e.target.checked })}
              />
              Recomendado aos clientes (publicar em /parceiros)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setPartnerModal(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Salvar Parceiro
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Atualização de Norma */}
      {editingSource && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handlePublishNormaUpdate} className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Atualizar Norma: {editingSource.titulo}</h2>
            <textarea
              rows={4}
              value={normaNewText}
              onChange={(e) => setNormaNewText(e.target.value)}
              placeholder="Cole aqui o novo texto normativo ou resolução oficial para comparar com a versão atual..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
            />
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {normaAttachment ? `Anexo: ${normaAttachment.name}` : 'Anexar PDF/Imagem da Norma (opcional)'}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleSelectNormaFile(f);
                  }}
                />
              </label>
              <button
                type="button"
                disabled={normaAiLoading || (!normaNewText.trim() && !normaAttachment)}
                onClick={handleAnalyzeNormaIa}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                {normaAiLoading ? normaAiProgress || 'Comparando...' : 'Analisar e Comparar com IA'}
              </button>
            </div>
            {normaAiLoading && normaAiProgress && (
              <p className="text-xs font-medium text-slate-600" role="status" aria-live="polite">
                {normaAiProgress}
              </p>
            )}
            {normaAiDraft && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    {(normaAiDraft.fallback || normaAiDraft.origem === 'regras') && (
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-950 font-bold mb-1">
                        {normaAiDraft.origemLabel || 'Rascunho gerado por regras — IA indisponível no momento'}
                      </span>
                    )}
                    {normaAiDraft.mensagemUsuario && (
                      <p className="text-amber-900">{normaAiDraft.mensagemUsuario}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={normaAiLoading}
                    onClick={() => void handleAnalyzeNormaIa()}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Tentar novamente com IA
                  </button>
                </div>
                <p><strong>Resumo sugerido:</strong> {normaAiDraft.resumoExecutivo}</p>
                <p><strong>Entenda a Lei:</strong> {normaAiDraft.explicacaoCliente}</p>
                <p><strong>Divergências:</strong> {(normaAiDraft.divergencias || []).join('; ') || 'Nenhuma'}</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingSource(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#1E7E34]">
                Publicar Nova Versão (Preservar Histórico)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
