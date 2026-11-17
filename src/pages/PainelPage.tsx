import React, { useCallback, useEffect, useState } from 'react';
import {
  Briefcase,
  DollarSign,
  FolderArchive,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  UserCheck,
  X,
} from 'lucide-react';
import { PainelAdminConfig } from '../components/painel/PainelAdminConfig';
import { PainelClientesCasos } from '../components/painel/PainelClientesCasos';
import { PainelDashboard } from '../components/painel/PainelDashboard';
import { PainelDocumentosExport } from '../components/painel/PainelDocumentosExport';
import { PainelFinanceiro } from '../components/painel/PainelFinanceiro';
import { PainelLeads } from '../components/painel/PainelLeads';
import { PainelParceirosLegal } from '../components/painel/PainelParceirosLegal';
import { useApp } from '../contexts/AppContext';
import {
  fetchAllSiteContentStaff,
  fetchStaffWorkspaceData,
  makeId,
  saveDocumentAudited,
} from '../services/firestoreService';
import type { SiteContent } from '../types/domain';

interface PainelPageProps {
  onNavigate: (path: string) => void;
}

type PanelSection = 'dashboard' | 'leads' | 'casos' | 'documentos' | 'financeiro' | 'parceiros' | 'admin';

export const PainelPage: React.FC<PainelPageProps> = ({ onNavigate }) => {
  const {
    userProfile,
    authLoading,
    empresa,
    siteContent,
    partnersPublic,
    visaCategories,
    visaRequirements,
    legalSources,
    activeDiagnosticRules,
    logout,
    refreshPublicData,
  } = useApp();

  const [section, setSection] = useState<PanelSection>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [staffSiteContent, setStaffSiteContent] = useState<SiteContent[]>(siteContent);

  const [workspace, setWorkspace] = useState<Awaited<ReturnType<typeof fetchStaffWorkspaceData>> | null>(null);

  const role = userProfile?.role;
  const isStaff =
    Boolean(userProfile) &&
    userProfile?.status === 'ativo' &&
    (role === 'admin' || role === 'consultor' || role === 'assistente');

  const loadWorkspace = useCallback(async () => {
    if (!userProfile || !isStaff) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [ws, cms] = await Promise.all([
        fetchStaffWorkspaceData(userProfile.role),
        fetchAllSiteContentStaff().catch(() => siteContent),
      ]);
      setWorkspace(ws);
      setStaffSiteContent(cms);
    } finally {
      setLoading(false);
    }
  }, [userProfile, isStaff, siteContent]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const handleLogWhatsApp = async (
    clientId: string | undefined,
    caseId: string | undefined,
    assunto: string,
    mensagem: string,
  ) => {
    if (!userProfile) return;
    const id = makeId('comm');
    await saveDocumentAudited(
      'communicationLogs',
      id,
      {
        id,
        canal: 'WhatsApp',
        assunto,
        mensagem,
        clientId: clientId || '',
        caseId: caseId || '',
        autorNome: userProfile.nome || userProfile.email,
        createdAt: new Date().toISOString(),
      },
      true,
      userProfile.role,
      'comunicacao_whatsapp',
    );
    await loadWorkspace();
  };

  const handleOpenCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setSection('casos');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] text-sm text-slate-600">
        Verificando credenciais da equipe...
      </div>
    );
  }

  if (!userProfile || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--color-bg)]">
        <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Painel Interno da Equipe</h1>
          <p className="text-sm text-slate-600">
            Acesso restrito a colaboradores ativos da consultoria D&amp;M Integra Chile.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => onNavigate('/entrar-equipe')}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              Entrar como Equipe
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
            >
              Voltar ao Site
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: { id: PanelSection; label: string; icon: React.ReactNode; visible: boolean }[] = [
    { id: 'dashboard', label: 'Visão Geral & Urgências', icon: <LayoutDashboard className="w-4 h-4" />, visible: true },
    { id: 'leads', label: 'Leads & Diagnósticos', icon: <UserCheck className="w-4 h-4" />, visible: true },
    { id: 'casos', label: 'Clientes & Casos', icon: <Briefcase className="w-4 h-4" />, visible: true },
    { id: 'documentos', label: 'Documentos & Dossiês', icon: <FolderArchive className="w-4 h-4" />, visible: true },
    {
      id: 'financeiro',
      label: 'Financeiro & Contratos',
      icon: <DollarSign className="w-4 h-4" />,
      visible: role === 'admin' || role === 'consultor',
    },
    {
      id: 'parceiros',
      label: 'Parceiros & Base Legal',
      icon: <Handshake className="w-4 h-4" />,
      visible: role === 'admin' || role === 'consultor',
    },
    {
      id: 'admin',
      label: 'Admin, Tema & Auditoria',
      icon: <Settings className="w-4 h-4" />,
      visible: role === 'admin',
    },
  ];

  const visibleNav = navItems.filter((n) => n.visible);

  return (
    <div className="min-h-screen flex bg-[var(--color-bg)]">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200 shrink-0 no-print">
        <div className="p-5 border-b border-slate-200">
          <button type="button" onClick={() => onNavigate('/')} className="text-left">
            <p className="text-sm font-bold text-slate-900">D&amp;M Integra Chile</p>
            <p className="text-[11px] text-slate-500">Painel Operacional · {userProfile.role.toUpperCase()}</p>
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSection(item.id);
                if (item.id !== 'casos') setSelectedCaseId(null);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                section === item.id
                  ? 'text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
              style={section === item.id ? { backgroundColor: 'var(--color-primary)' } : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <p className="text-xs font-semibold text-slate-900 truncate">{userProfile.nome}</p>
          <p className="text-[11px] text-slate-500 truncate">{userProfile.email}</p>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Site Público
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar Mobile */}
        <header className="lg:hidden bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between no-print">
          <p className="text-sm font-bold text-slate-900">Painel · {userProfile.role.toUpperCase()}</p>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Abrir menu do painel"
            className="p-2 rounded-lg border border-slate-200 text-slate-700"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </header>

        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 p-3 space-y-1 no-print">
            {visibleNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold ${
                  section === item.id ? 'text-white' : 'text-slate-700'
                }`}
                style={section === item.id ? { backgroundColor: 'var(--color-primary)' } : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {loading || !workspace ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-sm text-slate-500">
              Carregando painel operacional...
            </div>
          ) : (
            <>
              {section === 'dashboard' && (
                <PainelDashboard
                  role={userProfile.role}
                  leads={workspace.leads}
                  clients={workspace.clients}
                  cases={workspace.cases}
                  docs={workspace.caseDocuments}
                  deadlines={workspace.deadlines}
                  financialRecords={workspace.financialRecords}
                  onLogWhatsApp={handleLogWhatsApp}
                  onOpenCase={handleOpenCase}
                />
              )}

              {section === 'leads' && (
                <PainelLeads
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  leads={workspace.leads}
                  clients={workspace.clients}
                  tasks={workspace.tasks}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  legalSources={legalSources}
                  activeRules={activeDiagnosticRules}
                  messageTemplates={workspace.messageTemplates}
                  onRefresh={loadWorkspace}
                  onLogWhatsApp={handleLogWhatsApp}
                  onOpenCase={handleOpenCase}
                />
              )}

              {section === 'casos' && (
                <PainelClientesCasos
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  clients={workspace.clients}
                  dependents={workspace.dependents}
                  cases={workspace.cases}
                  caseFinancials={workspace.caseFinancials}
                  docs={workspace.caseDocuments}
                  tasks={workspace.tasks}
                  deadlines={workspace.deadlines}
                  appointments={workspace.appointments}
                  communicationLogs={workspace.communicationLogs}
                  viabilityAssessments={workspace.viabilityAssessments}
                  budgets={workspace.budgets}
                  financialRecords={workspace.financialRecords}
                  auditLogs={workspace.auditLogs}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  legalSources={legalSources}
                  messageTemplates={workspace.messageTemplates}
                  partnersPublic={partnersPublic}
                  selectedCaseId={selectedCaseId}
                  onSelectCase={setSelectedCaseId}
                  onRefresh={loadWorkspace}
                  onLogWhatsApp={handleLogWhatsApp}
                />
              )}

              {section === 'documentos' && (
                <PainelDocumentosExport
                  clients={workspace.clients}
                  cases={workspace.cases}
                  docs={workspace.caseDocuments}
                  avisoLegal={empresa.avisoLegal}
                />
              )}

              {section === 'financeiro' && (role === 'admin' || role === 'consultor') && (
                <PainelFinanceiro
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  clients={workspace.clients}
                  cases={workspace.cases}
                  budgets={workspace.budgets}
                  financialRecords={workspace.financialRecords}
                  documentTemplates={workspace.documentTemplates}
                  generatedDocuments={workspace.generatedDocuments}
                  onRefresh={loadWorkspace}
                  onRefreshPublic={refreshPublicData}
                  onLogWhatsApp={handleLogWhatsApp}
                />
              )}

              {section === 'parceiros' && (role === 'admin' || role === 'consultor') && (
                <PainelParceirosLegal
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  partners={workspace.partners}
                  partnerProposals={workspace.partnerProposals}
                  legalSources={legalSources}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  onRefresh={loadWorkspace}
                  onRefreshPublic={refreshPublicData}
                />
              )}

              {section === 'admin' && role === 'admin' && (
                <PainelAdminConfig
                  role={userProfile.role}
                  userProfile={userProfile}
                  empresa={empresa}
                  siteContent={staffSiteContent}
                  visaCategories={visaCategories}
                  visaRequirements={visaRequirements}
                  legalSources={legalSources}
                  activeDiagnosticRules={activeDiagnosticRules}
                  auditLogs={workspace.auditLogs}
                  onRefresh={loadWorkspace}
                  onRefreshPublic={refreshPublicData}
                />
              )}
            </>
          )}
        </main>

        <footer className="bg-white border-t border-slate-200 px-6 py-4 text-[11px] text-slate-500 text-center">
          {empresa.avisoLegal}
        </footer>
      </div>
    </div>
  );
};
