import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  History,
  Play,
  Shield,
  Sliders,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import {
  fetchAllDiagnosticRuleVersions,
  fetchBancarioConfigAdmin,
  fetchUsersList,
  makeId,
  publishDiagnosticRuleVersion,
  saveBancarioConfigAdmin,
  saveDocumentAudited,
  saveEmpresaConfigAdmin,
  uploadFileToServer,
} from '../../services/firestoreService';
import type {
  AuditLog,
  BancarioConfig,
  DiagnosticRuleItem,
  DiagnosticRuleVersion,
  EmpresaConfig,
  FontChoice,
  LegalSource,
  SiteContent,
  UserProfile,
  UserRole,
  VisaCategory,
  VisaRequirement,
} from '../../types/domain';
import { runDiagnosticEngine } from '../../utils/diagnosticEngine';
import { DIAGNOSTIC_TEST_PROFILES } from '../../utils/diagnosticProfiles';
import { exportToCSV, formatDateBR, formatDateTimeBR } from '../../utils/formatters';

interface PainelAdminConfigProps {
  role: UserRole;
  userProfile: UserProfile;
  empresa: EmpresaConfig;
  siteContent: SiteContent[];
  visaCategories: VisaCategory[];
  visaRequirements: VisaRequirement[];
  legalSources: LegalSource[];
  activeDiagnosticRules: DiagnosticRuleVersion;
  auditLogs: AuditLog[];
  onRefresh: () => Promise<void>;
  onRefreshPublic: () => Promise<void>;
}

type AdminTab = 'aparencia' | 'cms' | 'bancario' | 'equipe' | 'auditoria' | 'regras' | 'testes';

export const PainelAdminConfig: React.FC<PainelAdminConfigProps> = ({
  role,
  userProfile,
  empresa,
  siteContent,
  visaCategories,
  visaRequirements,
  legalSources,
  activeDiagnosticRules,
  auditLogs,
  onRefresh,
  onRefreshPublic,
}) => {
  if (role !== 'admin') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-600">
        Área exclusiva de Administradores.
      </div>
    );
  }

  const [tab, setTab] = useState<AdminTab>('aparencia');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Empresa & Aparência
  const [cfg, setCfg] = useState<EmpresaConfig>(empresa);

  // Bancário (admin only)
  const [bancario, setBancario] = useState<BancarioConfig | null>(null);
  const [bancarioOrig, setBancarioOrig] = useState<BancarioConfig | null>(null);

  // Equipe
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [usersLoaded, setUsersLoaded] = useState(false);

  // CMS
  const [editingCms, setEditingCms] = useState<SiteContent | null>(null);

  // Regras do Diagnóstico (sem código + versionamento + portão de testes)
  const [ruleVersions, setRuleVersions] = useState<DiagnosticRuleVersion[]>([activeDiagnosticRules]);
  const [rulesLoaded, setRulesLoaded] = useState(false);
  const [draftRules, setDraftRules] = useState<DiagnosticRuleVersion>(() => ({
    ...activeDiagnosticRules,
    versao: `${activeDiagnosticRules.versao}-edicao`,
    resumoMudanca: '',
    regras: activeDiagnosticRules.regras.map((r) => ({ ...r })),
  }));
  const [draftTestGate, setDraftTestGate] = useState<{
    testedHash: string;
    allPassed: boolean;
    results: { id: number; nome: string; pass: boolean; esperado: string; obtido: string; detalhe: string }[];
  } | null>(null);
  const [publishingRules, setPublishingRules] = useState(false);

  // Testes Diagnóstico (30 perfis)
  const [testResults, setTestResults] = useState<
    { id: number; nome: string; pass: boolean; esperado: string; obtido: string; detalhe: string }[] | null
  >(null);

  // Auditoria filter
  const [auditFilter, setAuditFilter] = useState('');

  const loadBancario = async () => {
    const b = await fetchBancarioConfigAdmin();
    setBancario(b);
    setBancarioOrig(b);
  };

  const loadUsers = async () => {
    const list = await fetchUsersList();
    setUsersList(list);
    setUsersLoaded(true);
  };

  const handleSaveEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    await saveEmpresaConfigAdmin(cfg, empresa);
    setFeedback('Configurações da empresa e tema aplicados com sucesso!');
    await onRefreshPublic();
  };

  const handleUploadLogo = async (file: File) => {
    try {
      const up = await uploadFileToServer(file);
      setCfg((prev) => ({ ...prev, logoUrl: up.url }));
      setFeedback('Logo enviado. Clique em "Salvar Configurações" para publicar.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro no upload do logo.');
    }
  };

  const handleSaveBancario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bancario) return;
    await saveBancarioConfigAdmin(bancario, bancarioOrig || bancario);
    setBancarioOrig(bancario);
    setFeedback('Dados bancários internos salvos com sigilo (somente Admin).');
  };

  const handleSaveCms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCms) return;
    await saveDocumentAudited(
      'siteContent',
      editingCms.id,
      editingCms as unknown as Record<string, unknown>,
      false,
      role,
      `cms_${editingCms.secao}`,
    );
    setEditingCms(null);
    setFeedback('Seção do site público atualizada!');
    await onRefreshPublic();
  };

  const loadRuleVersions = async () => {
    const list = await fetchAllDiagnosticRuleVersions();
    setRuleVersions(list);
    setRulesLoaded(true);
  };

  const draftHash = useMemo(() => JSON.stringify(draftRules.regras), [draftRules.regras]);

  const staleLegalAlerts = useMemo(() => {
    const maxDays = cfg.diasAlertaRevisaoLegal || empresa.diasAlertaRevisaoLegal || 90;
    const nowMs = Date.now();
    const alerts: { ruleName: string; sourceTitle: string; motivo: string }[] = [];
    for (const rule of draftRules.regras) {
      if (!rule.ativa || !rule.legalSourceId) continue;
      const src = legalSources.find((s) => s.id === rule.legalSourceId);
      if (!src) {
        alerts.push({ ruleName: rule.nome, sourceTitle: rule.legalSourceId, motivo: 'Fonte legal vinculada não encontrada na biblioteca.' });
        continue;
      }
      if (src.statusVigencia !== 'Vigente') {
        alerts.push({ ruleName: rule.nome, sourceTitle: src.titulo, motivo: `Status da norma: ${src.statusVigencia}.` });
        continue;
      }
      const verTs = Date.parse(src.ultimaVerificacao || '');
      if (!verTs || (nowMs - verTs) / 86400000 > maxDays) {
        alerts.push({
          ruleName: rule.nome,
          sourceTitle: src.titulo,
          motivo: `Sem verificação legal há mais de ${maxDays} dias (${formatDateBR(src.ultimaVerificacao)}).`,
        });
      }
    }
    return alerts;
  }, [draftRules.regras, legalSources, cfg.diasAlertaRevisaoLegal, empresa.diasAlertaRevisaoLegal]);

  const impactPreview = useMemo(() => {
    let changedTop = 0;
    let totalScoreDelta = 0;
    let counted = 0;
    for (const prof of DIAGNOSTIC_TEST_PROFILES) {
      const baseRes = runDiagnosticEngine(prof.answers, visaCategories, visaRequirements, legalSources, {
        ruleVersion: activeDiagnosticRules,
        custosPadrao: empresa.custosPadrao,
      });
      const draftRes = runDiagnosticEngine(prof.answers, visaCategories, visaRequirements, legalSources, {
        ruleVersion: draftRules,
        custosPadrao: empresa.custosPadrao,
      });
      if (baseRes.recomendada?.visa.codigo !== draftRes.recomendada?.visa.codigo) changedTop += 1;
      if (baseRes.recomendada && draftRes.recomendada) {
        totalScoreDelta += draftRes.recomendada.nota - baseRes.recomendada.nota;
        counted += 1;
      }
    }
    return {
      changedTop,
      avgDelta: counted > 0 ? (totalScoreDelta / counted).toFixed(1) : '0.0',
    };
  }, [activeDiagnosticRules, draftRules, visaCategories, visaRequirements, legalSources, empresa.custosPadrao]);

  const updateDraftRuleItem = (id: string, patch: Partial<DiagnosticRuleItem>) => {
    setDraftRules((prev) => ({
      ...prev,
      regras: prev.regras.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  };

  const handleRunDraftTests = () => {
    const results = DIAGNOSTIC_TEST_PROFILES.map((prof) => {
      const res = runDiagnosticEngine(prof.answers, visaCategories, visaRequirements, legalSources, {
        ruleVersion: draftRules,
        custosPadrao: empresa.custosPadrao,
        honorariosMinBrl: draftRules.honorariosMinBrl,
        honorariosMaxBrl: draftRules.honorariosMaxBrl,
        taxaCambioBrlClp: draftRules.taxaCambioBrlClp,
        taxaCambioUsdBrl: draftRules.taxaCambioUsdBrl,
      });
      const check = prof.assertCheck(res);
      return { id: prof.id, nome: prof.nome, ...check };
    });
    const allPassed = results.every((r) => r.pass);
    setDraftTestGate({ testedHash: draftHash, allPassed, results });
  };

  const handlePublishRules = async () => {
    setErrorMsg(null);
    if (!draftTestGate || draftTestGate.testedHash !== draftHash || !draftTestGate.allPassed) {
      setErrorMsg('Execute os 30 testes com sucesso neste rascunho antes de publicar.');
      return;
    }
    if (!draftRules.versao.trim()) {
      setErrorMsg('Informe o identificador da nova versão das regras (ex.: v2.2).');
      return;
    }
    setPublishingRules(true);
    try {
      const newVersion: DiagnosticRuleVersion = {
        ...draftRules,
        id: makeId('rules'),
        versao: draftRules.versao.trim(),
        dataPublicacao: new Date().toISOString().slice(0, 10),
        publicadoPor: userProfile.email,
        ativa: true,
        resumoMudanca: draftRules.resumoMudanca.trim() || 'Ajuste de parâmetros pelo administrador',
      };
      await publishDiagnosticRuleVersion(newVersion, activeDiagnosticRules, role);
      setFeedback(`Nova versão ${newVersion.versao} publicada e registrada na Auditoria!`);
      await onRefreshPublic();
      await onRefresh();
      await loadRuleVersions();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao publicar versão das regras.');
    } finally {
      setPublishingRules(false);
    }
  };

  const handleRun30Profiles = () => {
    const results = DIAGNOSTIC_TEST_PROFILES.map((prof) => {
      const res = runDiagnosticEngine(prof.answers, visaCategories, visaRequirements, legalSources, {
        ruleVersion: activeDiagnosticRules,
        custosPadrao: empresa.custosPadrao,
      });
      const check = prof.assertCheck(res);
      return { id: prof.id, nome: prof.nome, ...check };
    });
    setTestResults(results);
  };

  const handleDownloadBackupJson = () => {
    const backup = {
      exportedAt: new Date().toISOString(),
      empresa,
      siteContent,
      visaCategories,
      visaRequirements,
      legalSources,
      auditLogsCount: auditLogs.length,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-dm-integra-chile-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = useMemo(() => {
    if (!auditFilter.trim()) return auditLogs;
    const q = auditFilter.toLowerCase();
    return auditLogs.filter(
      (l) =>
        l.acao.toLowerCase().includes(q) ||
        l.entidade.toLowerCase().includes(q) ||
        l.actorEmail.toLowerCase().includes(q),
    );
  }, [auditLogs, auditFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administração, Tema, CMS &amp; Auditoria</h1>
        <p className="text-xs text-slate-500">
          Controle institucional da D&amp;M Integra Chile, equipe, textos públicos, dados bancários e testes do motor
        </p>
      </div>

      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'aparencia', label: 'Empresa & Aparência' },
          { id: 'regras', label: 'Regras do Diagnóstico' },
          { id: 'testes', label: 'Testar Diagnóstico (30 Perfis)' },
          { id: 'cms', label: `CMS do Site (${siteContent.length})` },
          { id: 'bancario', label: 'Dados Bancários' },
          { id: 'equipe', label: 'Equipe & Quem Somos' },
          { id: 'auditoria', label: `Auditoria (${auditLogs.length})` },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id as AdminTab);
              if (t.id === 'bancario' && !bancario) void loadBancario();
              if (t.id === 'equipe' && !usersLoaded) void loadUsers();
              if (t.id === 'regras' && !rulesLoaded) void loadRuleVersions();
            }}
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

      {/* EMPRESA & APARÊNCIA */}
      {tab === 'aparencia' && (
        <form onSubmit={handleSaveEmpresa} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Empresa</label>
              <input
                value={cfg.nome_empresa}
                onChange={(e) => setCfg({ ...cfg, nome_empresa: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Razão Social / CNPJ / RUT</label>
              <input
                value={cfg.razao_social_cnpj_rut}
                onChange={(e) => setCfg({ ...cfg, razao_social_cnpj_rut: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Responsável Técnico</label>
              <input
                value={cfg.responsavel_tecnico}
                onChange={(e) => setCfg({ ...cfg, responsavel_tecnico: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Foro / Comarca</label>
              <input
                value={cfg.foro_comarca}
                onChange={(e) => setCfg({ ...cfg, foro_comarca: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Oficial</label>
              <input
                value={cfg.whatsapp}
                onChange={(e) => setCfg({ ...cfg, whatsapp: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Link Calendly</label>
              <input
                value={cfg.linkCalendly}
                onChange={(e) => setCfg({ ...cfg, linkCalendly: e.target.value })}
                placeholder="https://calendly.com/..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Chave Pix</label>
              <input
                value={cfg.chavePix}
                onChange={(e) => setCfg({ ...cfg, chavePix: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Link Pagamento Cartão</label>
              <input
                value={cfg.linkPagamentoCartao}
                onChange={(e) => setCfg({ ...cfg, linkPagamentoCartao: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cor Primária</label>
              <input
                type="color"
                value={cfg.corPrimaria}
                onChange={(e) => setCfg({ ...cfg, corPrimaria: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cor Destaque</label>
              <input
                type="color"
                value={cfg.corDestaque}
                onChange={(e) => setCfg({ ...cfg, corDestaque: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cor Fundo</label>
              <input
                type="color"
                value={cfg.corFundo}
                onChange={(e) => setCfg({ ...cfg, corFundo: e.target.value })}
                className="w-full h-10 rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Fonte Principal</label>
              <select
                value={cfg.fontePrincipal}
                onChange={(e) => setCfg({ ...cfg, fontePrincipal: e.target.value as FontChoice })}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs bg-white"
              >
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="Inter">Inter</option>
                <option value="Merriweather">Merriweather</option>
                <option value="Montserrat">Montserrat</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bloqueio Mínimo Protocolo (%)</label>
              <input
                type="number"
                min={50}
                max={100}
                value={cfg.bloqueioProtocoloMinimo}
                onChange={(e) => setCfg({ ...cfg, bloqueioProtocoloMinimo: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alerta Revisão Legal (dias)</label>
              <input
                type="number"
                min={15}
                max={365}
                value={cfg.diasAlertaRevisaoLegal}
                onChange={(e) => setCfg({ ...cfg, diasAlertaRevisaoLegal: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expiração Link Diagnóstico (dias)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={cfg.diasExpiracaoLinkDiagnostico ?? 30}
                onChange={(e) => setCfg({ ...cfg, diasExpiracaoLinkDiagnostico: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Honorários Diagnóstico Mín (BRL)</label>
              <input
                type="number"
                min={0}
                value={cfg.honorariosPadraoMinBrl ?? 2900}
                onChange={(e) => setCfg({ ...cfg, honorariosPadraoMinBrl: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Honorários Diagnóstico Máx (BRL)</label>
              <input
                type="number"
                min={0}
                value={cfg.honorariosPadraoMaxBrl ?? 5800}
                onChange={(e) => setCfg({ ...cfg, honorariosPadraoMaxBrl: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Logo da Empresa (PNG/JPG)</label>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUploadLogo(f);
                }}
                className="w-full text-xs text-slate-600"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Salvar Configurações e Tema
            </button>
            <button
              type="button"
              onClick={handleDownloadBackupJson}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar Backup JSON
            </button>
          </div>
        </form>
      )}

      {/* CMS DO SITE */}
      {tab === 'cms' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {siteContent.map((sec) => (
            <div key={sec.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Seção: {sec.secao}</span>
                <button
                  type="button"
                  onClick={() => setEditingCms(sec)}
                  className="px-3 py-1 rounded-lg border border-slate-300 text-xs font-semibold"
                >
                  Editar
                </button>
              </div>
              <p className="text-sm font-bold text-slate-900">{sec.titulo}</p>
              <p className="text-xs text-slate-600 line-clamp-2">{sec.subtitulo}</p>
            </div>
          ))}
        </div>
      )}

      {/* DADOS BANCÁRIOS */}
      {tab === 'bancario' && (
        <form onSubmit={handleSaveBancario} className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-base font-bold text-slate-900">Dados Bancários Confidenciais (Somente Admin)</h2>
          </div>
          {bancario ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dados Bancários Brasil (Banco / Agência / Conta)</label>
                <textarea
                  rows={3}
                  value={bancario.dados_bancarios_br}
                  onChange={(e) => setBancario({ ...bancario, dados_bancarios_br: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dados Bancários Chile (RUT / Cuenta Vista / Corriente)</label>
                <textarea
                  rows={3}
                  value={bancario.dados_bancarios_cl}
                  onChange={(e) => setBancario({ ...bancario, dados_bancarios_cl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Dados Wise / Remessa Internacional</label>
                <textarea
                  rows={2}
                  value={bancario.dados_wise}
                  onChange={(e) => setBancario({ ...bancario, dados_wise: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
                />
              </div>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                Salvar Dados Bancários
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-500">Carregando dados bancários...</p>
          )}
        </form>
      )}

      {/* EQUIPE & QUEM SOMOS */}
      {tab === 'equipe' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50">
                <th className="py-3 px-4 font-semibold">Usuário</th>
                <th className="py-3 px-4 font-semibold">E-mail</th>
                <th className="py-3 px-4 font-semibold">Papel (Role)</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {usersList.map((u) => (
                <tr key={u.uid}>
                  <td className="py-3 px-4 font-semibold text-slate-900">{u.nome}</td>
                  <td className="py-3 px-4 text-slate-600">{u.email}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={async (e) => {
                        const nextRole = e.target.value as UserRole;
                        await saveDocumentAudited('users', u.uid, { ...u, role: nextRole }, false, role, 'alterar_papel_usuario');
                        await loadUsers();
                        setFeedback(`Papel de ${u.email} alterado para ${nextRole}.`);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-semibold"
                    >
                      <option value="admin">admin</option>
                      <option value="consultor">consultor</option>
                      <option value="assistente">assistente</option>
                      <option value="cliente">cliente</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={u.status}
                      onChange={async (e) => {
                        const nextStatus = e.target.value as UserProfile['status'];
                        await saveDocumentAudited('users', u.uid, { ...u, status: nextStatus }, false, role, 'alterar_status_usuario');
                        await loadUsers();
                      }}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="ativo">ativo</option>
                      <option value="pendente">pendente</option>
                      <option value="inativo">inativo</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* AUDITORIA GLOBAL */}
      {tab === 'auditoria' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-between">
            <input
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              placeholder="Filtrar auditoria por ação, entidade ou usuário..."
              className="flex-1 min-w-[240px] px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs"
            />
            <button
              type="button"
              onClick={() =>
                exportToCSV(
                  'auditoria-dm-integra',
                  ['Data', 'Ator', 'Papel', 'Ação', 'Entidade', 'ID', 'Campo'],
                  filteredLogs.map((l) => [
                    formatDateTimeBR(l.createdAt),
                    l.actorEmail,
                    l.actorRole,
                    l.acao,
                    l.entidade,
                    l.entidadeId,
                    l.campo || '',
                  ]),
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
            {filteredLogs.slice(0, 80).map((l) => (
              <div key={l.id} className="p-3.5 text-xs flex flex-wrap justify-between gap-2">
                <div>
                  <span className="font-bold text-slate-900">
                    {l.acao} · {l.entidade}
                  </span>{' '}
                  <span className="text-slate-500">({l.entidadeId})</span>
                </div>
                <div className="text-slate-500">
                  {l.actorEmail} ({l.actorRole}) · {formatDateTimeBR(l.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REGRAS DO DIAGNÓSTICO SEM CÓDIGO */}
      {tab === 'regras' && (
        <div className="space-y-6">
          {staleLegalAlerts.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2 text-xs text-amber-950">
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                Alerta de Revisão Normativa ({staleLegalAlerts.length} norma(s) ligada(s) às regras)
              </p>
              <ul className="space-y-1">
                {staleLegalAlerts.map((al, i) => (
                  <li key={i}>
                    <strong>{al.ruleName}</strong> → {al.sourceTitle}: {al.motivo}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[var(--color-primary)]" />
                  Editor Estruturado das Regras do Diagnóstico (Ativa: {activeDiagnosticRules.versao})
                </h2>
                <p className="text-xs text-slate-500">
                  Edite pesos, notas base e justificativas sem código. A publicação é liberada somente após aprovação nos 30 testes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRunDraftTests}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Play className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                  Rodar 30 Testes neste Rascunho
                </button>
                <button
                  type="button"
                  disabled={
                    publishingRules ||
                    !draftTestGate ||
                    draftTestGate.testedHash !== draftHash ||
                    !draftTestGate.allPassed
                  }
                  onClick={() => void handlePublishRules()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  {publishingRules ? 'Publicando...' : 'Publicar Nova Versão'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nova Versão *</label>
                <input
                  value={draftRules.versao}
                  onChange={(e) => setDraftRules({ ...draftRules, versao: e.target.value })}
                  placeholder="Ex.: v2.2"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Resumo da Mudança (Auditoria)</label>
                <input
                  value={draftRules.resumoMudanca}
                  onChange={(e) => setDraftRules({ ...draftRules, resumoMudanca: e.target.value })}
                  placeholder="Ex.: Ajuste de pontuação Mercosul / tabela de honorários"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                />
              </div>
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <p className="text-[11px] text-slate-500">Pré-visualização de impacto (30 perfis)</p>
                <p className="font-bold text-slate-900 mt-0.5">
                  {impactPreview.changedTop} troca(s) de líder · Δ médio {impactPreview.avgDelta} pts
                </p>
              </div>
            </div>

            {draftTestGate && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                  draftTestGate.testedHash !== draftHash
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : draftTestGate.allPassed
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-[#C82333]'
                }`}
              >
                <span className="font-semibold">
                  {draftTestGate.testedHash !== draftHash
                    ? 'Rascunho alterado após o último teste — execute novamente os 30 testes para liberar a publicação.'
                    : draftTestGate.allPassed
                      ? 'Portão de qualidade aprovado: 30/30 testes passaram! Publicação liberada.'
                      : `Publicação bloqueada: ${draftTestGate.results.filter((r) => !r.pass).length} teste(s) falhou(aram).`}
                </span>
              </div>
            )}

            <div className="space-y-3">
              {draftRules.regras.map((rule) => (
                <div key={rule.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-slate-200 font-bold text-slate-800">{rule.codigo}</span>
                      <span className="font-bold text-slate-900">{rule.nome}</span>
                      <span className="text-slate-500">({rule.condicao} → {rule.categoriaAlvo})</span>
                    </div>
                    <label className="flex items-center gap-1.5 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.ativa}
                        onChange={(e) => updateDraftRuleItem(rule.id, { ativa: e.target.checked })}
                      />
                      Regra ativa
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Nota Base (0-100)</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={rule.notaBase}
                        onChange={(e) => updateDraftRuleItem(rule.id, { notaBase: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Ajuste (-50 a +30)</label>
                      <input
                        type="number"
                        min={-50}
                        max={30}
                        value={rule.ajusteNota}
                        onChange={(e) => updateDraftRuleItem(rule.id, { ajusteNota: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-600 mb-1">Norma vinculada (Biblioteca Legal)</label>
                      <select
                        value={rule.legalSourceId || ''}
                        onChange={(e) => updateDraftRuleItem(rule.id, { legalSourceId: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="">Sem vínculo direto</option>
                        {legalSources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.titulo} ({s.statusVigencia})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-600 mb-1">Explicação para o cliente</label>
                      <input
                        value={rule.explicacaoCliente}
                        onChange={(e) => updateDraftRuleItem(rule.id, { explicacaoCliente: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-600 mb-1">Explicação técnica do consultor</label>
                      <input
                        value={rule.explicacaoTecnica}
                        onChange={(e) => updateDraftRuleItem(rule.id, { explicacaoTecnica: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--color-primary)]" />
              Histórico de Versões Publicadas ({ruleVersions.length})
            </h3>
            <div className="divide-y divide-slate-200 text-xs">
              {ruleVersions.map((v) => (
                <div key={v.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900">{v.versao}</span>{' '}
                    {v.ativa && (
                      <span className="ml-1 px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[#1E7E34] font-bold text-[10px]">
                        ATIVA
                      </span>
                    )}
                    <p className="text-slate-600 mt-0.5">{v.resumoMudanca}</p>
                  </div>
                  <div className="text-slate-500 text-right">
                    <p>{v.publicadoPor}</p>
                    <p>{formatDateBR(v.dataPublicacao)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TESTAR DIAGNÓSTICO (30 PERFIS) */}
      {tab === 'testes' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Verificação do Motor de Diagnóstico (30 Perfis Obrigatórios)</h2>
              <p className="text-xs text-slate-500">
                Valida Mercosul, turista sem vínculo, humanitário, flags isoladas, opção consultor, menor, casal, contradições, passaporte vencido, prorrogação/definitiva e regressão de regra.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRun30Profiles}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Play className="w-3.5 h-3.5" />
              Executar 30 Testes Agora
            </button>
          </div>

          {testResults && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800">
                Resultado: {testResults.filter((r) => r.pass).length} / {testResults.length} aprovado(s) (versão ativa: {activeDiagnosticRules.versao})
              </div>
              <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl">
                {testResults.map((r) => (
                  <div key={r.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      {r.pass ? (
                        <CheckCircle2 className="w-4 h-4 text-[#1E7E34] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#C82333] shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <p className="font-semibold text-slate-900">
                          #{r.id} — {r.nome}
                        </p>
                        <p className="text-slate-600">
                          <strong>Esperado:</strong> {r.esperado}
                        </p>
                        <p className="text-slate-700">
                          <strong>Obtido:</strong> {r.obtido}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded border font-bold shrink-0 self-start sm:self-center ${
                        r.pass
                          ? 'bg-emerald-50 border-emerald-200 text-[#1E7E34]'
                          : 'bg-red-50 border-red-200 text-[#C82333]'
                      }`}
                    >
                      {r.pass ? 'APROVADO' : 'REPROVADO'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal CMS */}
      {editingCms && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleSaveCms} className="bg-white rounded-xl max-w-lg w-full p-6 space-y-3">
            <h2 className="text-lg font-bold text-slate-900">Editar Seção: {editingCms.secao}</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Título</label>
              <input
                required
                value={editingCms.titulo}
                onChange={(e) => setEditingCms({ ...editingCms, titulo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subtítulo</label>
              <textarea
                rows={2}
                value={editingCms.subtitulo}
                onChange={(e) => setEditingCms({ ...editingCms, subtitulo: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Texto / Conteúdo</label>
              <textarea
                rows={4}
                value={editingCms.conteudoHtml}
                onChange={(e) => setEditingCms({ ...editingCms, conteudoHtml: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingCms(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-xs">
                Cancelar
              </button>
              <button type="submit" className="px-4 py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: 'var(--color-primary)' }}>
                Publicar Seção
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
