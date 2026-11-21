import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBasicDiagnosticSummary,
  buildBasicLeadSummary,
  CONSULTANCY_PLANS,
  getPortalCapabilities,
  mapPipelineStepToOrientativaStep,
  normalizePaidModality,
  ORIENTATIVA_STAGES,
  resolveClientPortalAccess,
} from './portalAccess';
import type { Client, Lead, UserProfile } from '../types/domain';
import type { DiagnosticResult } from './diagnosticEngine';

const makeUser = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  uid: 'uid_cliente_1',
  nome: 'Maria Silva',
  email: 'maria@example.com',
  role: 'cliente',
  status: 'ativo',
  clientId: 'cli_1',
  ...overrides,
});

const makeClient = (overrides: Partial<Client> = {}): Client => ({
  id: 'cli_1',
  nomeCompleto: 'Maria Silva',
  cpf: '123.456.789-00',
  email: 'maria@example.com',
  whatsapp: '+55 11 99999-0000',
  portalLiberado: true,
  statusAcessoPortal: 'Liberado',
  modalidadeConsultoria: 'completa',
  createdAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

const makeLead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 'lead_1',
  nome: 'Maria Silva',
  whatsapp: '+55 11 99999-0000',
  email: 'maria@example.com',
  cidadeUf: 'São Paulo/SP',
  origem: 'Site',
  interesse: 'Residência Temporal',
  statusFunil: 'Novo',
  subcategoriaSugerida: 'MERCOSUL - Residência Temporal Mercosul',
  notaViabilidade: 82,
  confianca: 'Alta',
  prioridade: 'Alta',
  lgpdAceito: true,
  lgpdVersao: '1.0',
  lgpdData: '2026-01-01T10:00:00.000Z',
  createdAt: '2026-01-01T10:00:00.000Z',
  ...overrides,
});

describe('portalAccess — consultancy plans & capabilities', () => {
  it('defines distinct protocols for diagnostico_gratuito, orientativa and completa', () => {
    assert.equal(CONSULTANCY_PLANS.orientativa.responsavelProtocolo, 'Cliente (com orientação técnica)');
    assert.equal(CONSULTANCY_PLANS.completa.responsavelProtocolo, 'D&M Integra Chile (execução integral)');
    assert.equal(ORIENTATIVA_STAGES.length, 6);
  });

  it('locks all paid features for diagnostico_gratuito or un-released portal', () => {
    const capsFree = getPortalCapabilities('diagnostico_gratuito', true);
    assert.equal(capsFree.showBasicDiagnosticOnly, true);
    assert.equal(capsFree.showFullDiagnosticDetails, false);
    assert.equal(capsFree.showDocumentChecklist, false);
    assert.equal(capsFree.showSermigManagementByTeam, false);
    assert.deepEqual(capsFree.allowedTabs, ['processo']);

    const capsLocked = getPortalCapabilities('completa', false);
    assert.equal(capsLocked.isPortalUnlocked, false);
    assert.equal(capsLocked.showBasicDiagnosticOnly, true);
    assert.equal(capsLocked.showFull15Stages, false);
  });

  it('differentiates orientativa vs completa capabilities cleanly', () => {
    const orientativa = getPortalCapabilities('orientativa', true);
    assert.equal(orientativa.showOrientativaRoadmap, true);
    assert.equal(orientativa.showFull15Stages, false);
    assert.equal(orientativa.showSermigManagementByTeam, false);
    assert.equal(orientativa.showRelocationSupport, false);
    assert.equal(orientativa.showDocumentChecklist, true);
    assert.equal(orientativa.showDirectChat, true);

    const completa = getPortalCapabilities('completa', true);
    assert.equal(completa.showOrientativaRoadmap, false);
    assert.equal(completa.showFull15Stages, true);
    assert.equal(completa.showSermigManagementByTeam, true);
    assert.equal(completa.showRelocationSupport, true);
    assert.equal(completa.showDocumentChecklist, true);
  });

  it('normalizes legacy or missing paid modalities safely', () => {
    assert.equal(normalizePaidModality('orientativa'), 'orientativa');
    assert.equal(normalizePaidModality('completa'), 'completa');
    assert.equal(normalizePaidModality(undefined), 'completa');
    assert.equal(normalizePaidModality('outro'), 'completa');
  });

  it('maps 15-stage pipeline into 6 orientativa stages monotonically', () => {
    assert.equal(mapPipelineStepToOrientativaStep(1), 1);
    assert.equal(mapPipelineStepToOrientativaStep(3), 2);
    assert.equal(mapPipelineStepToOrientativaStep(5), 3);
    assert.equal(mapPipelineStepToOrientativaStep(7), 4);
    assert.equal(mapPipelineStepToOrientativaStep(9), 5);
    assert.equal(mapPipelineStepToOrientativaStep(13), 6);
  });
});

describe('portalAccess — resolveClientPortalAccess', () => {
  it('returns active_paid when staff released portal even if userProfile was just linked', () => {
    const res = resolveClientPortalAccess({
      userProfile: makeUser({ status: 'pendente' }),
      client: makeClient({ portalLiberado: true, modalidadeConsultoria: 'orientativa' }),
    });
    assert.equal(res.kind, 'active_paid');
    if (res.kind === 'active_paid') {
      assert.equal(res.modality, 'orientativa');
      assert.equal(res.capabilities.showOrientativaRoadmap, true);
      assert.equal(res.capabilities.showSermigManagementByTeam, false);
    }
  });

  it('immediately blocks full portal when staff revokes portalLiberado on client', () => {
    const res = resolveClientPortalAccess({
      userProfile: makeUser({ status: 'ativo' }),
      client: makeClient({ portalLiberado: false, statusAcessoPortal: 'Pendente liberação' }),
      leads: [makeLead()],
    });
    assert.equal(res.kind, 'pending_release');
    if (res.kind === 'pending_release') {
      assert.equal(res.capabilities.showBasicDiagnosticOnly, true);
      assert.equal(res.capabilities.showDocumentChecklist, false);
      assert.ok(res.basicDiagnostic);
      assert.equal(res.basicDiagnostic.notaViabilidade, 82);
    }
  });

  it('returns free_diagnostic_only for leads without a contracted client record', () => {
    const res = resolveClientPortalAccess({
      userProfile: makeUser({ status: 'pendente', clientId: undefined }),
      client: null,
      leads: [makeLead({ notaViabilidade: 76, flagsRisco: ['Passaporte curto'] })],
    });
    assert.equal(res.kind, 'free_diagnostic_only');
    if (res.kind === 'free_diagnostic_only') {
      assert.equal(res.capabilities.showBasicDiagnosticOnly, true);
      assert.equal(res.basicDiagnostic.notaViabilidade, 76);
      assert.equal(res.basicDiagnostic.temAlertaCritico, true);
      assert.ok(res.basicDiagnostic.itensBloqueados.length >= 3);
    }
  });

  it('returns inactive for archived client or inactive user', () => {
    const archivedRes = resolveClientPortalAccess({
      userProfile: makeUser(),
      client: makeClient({ arquivado: true }),
    });
    assert.equal(archivedRes.kind, 'inactive');

    const inactiveUserRes = resolveClientPortalAccess({
      userProfile: makeUser({ status: 'inativo' }),
      client: makeClient(),
    });
    assert.equal(inactiveUserRes.kind, 'inactive');
  });
});

describe('portalAccess — basic diagnostic gating', () => {
  it('strips detailed action plan, taxes and checklist from free diagnostic summary', () => {
    const fakeResult = {
      viabilidade: {
        total: 84,
        veredito: 'Viável',
        dimensoes: [],
      },
      confianca: 'Alta',
      recomendada: {
        visa: {
          id: 'v1',
          codigo: 'MERCOSUL',
          nomePortugues: 'Residência Temporal Mercosul',
          nomeEspanhol: 'Residencia Temporal Mercosur',
          permiteDentroChile: 'Condicional',
          permiteTrabalhar: true,
          levaDefinitiva: true,
        },
        nota: 84,
      },
      alertaRiscoAlto: 'Detalhe interno passo-a-passo sobre saída do Chile',
      flagsRisco: [],
      flagsRevisaoConsultor: [],
      alertas: ['Detalhe interno passo-a-passo sobre saída do Chile'],
    } as unknown as DiagnosticResult;

    const summary = buildBasicDiagnosticSummary(fakeResult, {
      nome: 'Carlos',
      localizacao: 'No Chile como turista',
      vinculoFamiliarChile: false,
      familiaAcompanhante: true,
      quantidadeDependentes: 2,
    });

    assert.equal(summary.notaViabilidade, 84);
    assert.equal(summary.subcategoriaCodigo, 'MERCOSUL');
    assert.equal(summary.temAlertaCritico, true);
    assert.equal(summary.familiaResumo, 'Titular + 2 dependente(s)');
    // Ensure raw internal detailed text is not leaked directly
    assert.ok(!summary.alertaGeral?.includes('Detalhe interno passo-a-passo'));
    assert.ok(summary.itensBloqueados.length >= 4);

    const leadSummary = buildBasicLeadSummary(makeLead());
    assert.equal(leadSummary.notaViabilidade, 82);
    assert.equal(leadSummary.confianca, 'Alta');
  });
});
