import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_DIAGNOSTIC_RULE_VERSION,
  DEFAULT_EMPRESA_CONFIG,
  SEED_LEGAL_SOURCES,
  SEED_VISA_CATEGORIES,
  SEED_VISA_REQUIREMENTS,
} from '../data/seeds';
import type { AuditLog, DiagnosticAnswers } from '../types/domain';
import { runDiagnosticEngine } from './diagnosticEngine';
import {
  buildAuditLogPayloadForRuleDecision,
  buildLocalDiagnosticSynthesis,
  countPendingOfflineItems,
  getLocalAiRuntimeNotice,
  listPendingOfflineDiagnostics,
  listRuleEngineDecisionLogs,
  loadRuleEngineSnapshotSync,
  markRuleEngineDecisionReviewed,
  markRuleEngineDecisionSynced,
  mergeLocalAndCloudRuleLogs,
  parseRuleDecisionLogsFromAuditLogs,
  recordRuleEngineDecision,
  removePendingOfflineDiagnostic,
  savePendingOfflineDiagnostic,
  saveRuleEngineSnapshot,
  setLocalAiRuntimeNotice,
} from './offlineRuleEngineStore';

function withMockBrowserStorage(fn: () => void | Promise<void>): Promise<void> | void {
  const store = new Map<string, string>();
  const prevWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    },
  };
  const cleanup = () => {
    if (prevWindow === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = prevWindow;
  };
  try {
    const out = fn();
    if (out && typeof (out as Promise<void>).then === 'function') {
      return (out as Promise<void>).finally(cleanup);
    }
    cleanup();
  } catch (err) {
    cleanup();
    throw err;
  }
}

describe('offlineRuleEngineStore — Local Persistence, Offline Queue, Decision Logs & Synthesis', () => {
  it('persists and hydrates the full rule-engine snapshot locally and survives offline reloads', async () => {
    await withMockBrowserStorage(async () => {
      const initial = loadRuleEngineSnapshotSync();
      assert.equal(initial.source, 'seed');
      assert.ok(initial.visaCategories.length > 0);

      const customRules = {
        ...DEFAULT_DIAGNOSTIC_RULE_VERSION,
        versao: '2.4-offline-test',
        notasVersao: 'Snapshot salvo antes da queda de rede',
      };
      await saveRuleEngineSnapshot({
        empresa: DEFAULT_EMPRESA_CONFIG,
        visaCategories: SEED_VISA_CATEGORIES,
        visaRequirements: SEED_VISA_REQUIREMENTS,
        legalSources: SEED_LEGAL_SOURCES,
        activeDiagnosticRules: customRules,
        source: 'cloud',
      });

      const reloaded = loadRuleEngineSnapshotSync();
      assert.equal(reloaded.source, 'local_snapshot');
      assert.equal(reloaded.activeDiagnosticRules.versao, '2.4-offline-test');
      assert.equal(reloaded.visaCategories.length, SEED_VISA_CATEGORIES.length);
      assert.equal(reloaded.legalSources.length, SEED_LEGAL_SOURCES.length);
    });
  });

  it('records, syncs, reviews, and merges internal rule-engine decision logs with cloud auditLogs', async () => {
    await withMockBrowserStorage(() => {
      const entry = recordRuleEngineDecision({
        id: 'rlog_offline_001',
        mode: 'offline',
        origin: 'diagnostico_publico',
        leadName: 'Carlos Mendes',
        leadEmail: 'carlos@example.com',
        ruleVersion: '2.4',
        subcategoriaRecomendada: '15 - Acordo Mercosul',
        notaViabilidade: 91,
        confianca: 'Alta',
        regrasAcionadas: ['Nacionalidade brasileira elegível ao Acordo Mercosul.'],
        flagsRisco: ['Passaporte com validade próxima'],
        fontesLegaisCitadas: ['Ley 21.325 (2021)'],
        motivoModoLocal: 'Sem conexão de rede',
      });

      assert.equal(entry.syncStatus, 'pendente');
      assert.equal(countPendingOfflineItems().pendingLogs, 1);

      const auditPayload = buildAuditLogPayloadForRuleDecision(entry);
      assert.equal(auditPayload.entidade, 'motor_regras_offline');
      assert.equal(auditPayload.acao, 'decisao_motor_regras');
      assert.ok(auditPayload.depois.length <= 3900);

      markRuleEngineDecisionSynced(entry.id);
      assert.equal(countPendingOfflineItems().pendingLogs, 0);
      assert.equal(listRuleEngineDecisionLogs()[0]?.syncStatus, 'sincronizado');

      const reviewed = markRuleEngineDecisionReviewed(entry.id, 'Consultora Ana', 'Validado e contatado.');
      assert.equal(reviewed?.syncStatus, 'revisado');
      assert.equal(reviewed?.reviewedBy, 'Consultora Ana');

      const cloudAuditRows: AuditLog[] = [
        {
          id: 'aud_cloud_1',
          actorUid: 'uid_staff',
          actorEmail: 'ana@dmintegrachile.com',
          actorRole: 'consultor',
          acao: 'decisao_motor_regras',
          entidade: 'motor_regras_offline',
          entidadeId: 'rlog_cloud_only',
          campo: 'online_fallback_regras',
          depois: JSON.stringify({
            id: 'rlog_cloud_only',
            createdAt: '2026-11-20T12:00:00.000Z',
            mode: 'online_fallback_regras',
            origin: 'diagnostico_ia_regras',
            leadName: 'Fernanda Lima',
            ruleVersion: '2.4',
            subcategoriaRecomendada: '01 - Reunificação Familiar',
            regrasAcionadas: ['Vínculo familiar comprovado'],
            flagsRisco: [],
            fontesLegaisCitadas: ['Decreto Supremo 177/2022'],
          }),
          createdAt: '2026-11-20T12:00:00.000Z',
        },
      ];

      const cloudParsed = parseRuleDecisionLogsFromAuditLogs(cloudAuditRows);
      assert.equal(cloudParsed.length, 1);
      assert.equal(cloudParsed[0].leadName, 'Fernanda Lima');

      const merged = mergeLocalAndCloudRuleLogs(listRuleEngineDecisionLogs(), cloudParsed);
      assert.equal(merged.length, 2);
      assert.equal(merged.find((m) => m.id === 'rlog_offline_001')?.syncStatus, 'revisado');
      assert.equal(merged.find((m) => m.id === 'rlog_cloud_only')?.syncStatus, 'sincronizado');
    });
  });

  it('queues pending offline diagnostics, tracks AI runtime notice, and builds deterministic local synthesis', async () => {
    await withMockBrowserStorage(() => {
      const answers: DiagnosticAnswers = {
        nome: 'Mariana Souza',
        whatsapp: '+55 11 99999-1234',
        email: 'mariana@example.com',
        cidadeUf: 'São Paulo/SP',
        origem: 'Site',
        localizacao: 'No Brasil',
        nacionalidadeBrasileira: true,
        possuiSegundaNacionalidade: false,
        passaporteStatus: 'valido',
        passaporteValidadeMeses: 24,
        vinculoFamiliarChile: false,
        vinculoFormalizado: false,
        composicaoFamiliar: 'individual',
        objetivo: 'explorar',
        possuiOfertaTrabalhoFormal: false,
        possuiMatriculaReconhecida: false,
        possuiRendaPassiva: false,
        possuiCapitalComprovadoOrigem: false,
        titularTemResidenciaChile: false,
        overstay: false,
        ordenAbandono: false,
        rejeicaoAnterior: false,
        antecedentesCriminais: false,
        familiaAcompanhante: false,
        quantidadeDependentes: 0,
        prazoPretendido: '3 a 6 meses',
        documentosJaPossui: [],
        lgpdAceito: true,
        lgpdVersao: '1.0',
      };

      const diag = runDiagnosticEngine(
        answers,
        SEED_VISA_CATEGORIES,
        SEED_VISA_REQUIREMENTS,
        SEED_LEGAL_SOURCES,
        { ruleVersion: DEFAULT_DIAGNOSTIC_RULE_VERSION },
      );

      savePendingOfflineDiagnostic({
        id: 'off_1',
        createdAt: '2026-11-20T14:00:00.000Z',
        sessionToken: 'tok_offline_12345678901234567890',
        leadPayload: {
          nome: answers.nome,
          whatsapp: answers.whatsapp,
          email: answers.email,
          cidadeUf: answers.cidadeUf,
          origem: answers.origem,
          interesse: diag.recomendada?.visa.nomePortugues || 'Mercosul',
          respostasTriagem: answers,
          subcategoriaSugerida: '15 - Acordo Mercosul',
          notaViabilidade: diag.viabilidade.total,
          confianca: diag.confianca,
          temperatura: 'Quente',
          prioridade: 'Alta',
          flagsRisco: [],
          versaoRegras: diag.versaoRegras.versao,
          sessionToken: 'tok_offline_12345678901234567890',
          statusConclusao: 'Concluído',
          etapaAtual: 6,
          lgpdAceito: true,
          lgpdVersao: '1.0',
          lgpdData: '2026-11-20T14:00:00.000Z',
        },
        sessionPayload: {
          etapaAtual: 6,
          answers,
          concluido: true,
          expiraEmMs: Date.now() + 86400000,
        },
      });

      assert.equal(listPendingOfflineDiagnostics().length, 1);
      assert.equal(countPendingOfflineItems().pendingLeads, 1);

      removePendingOfflineDiagnostic('tok_offline_12345678901234567890');
      assert.equal(listPendingOfflineDiagnostics().length, 0);

      setLocalAiRuntimeNotice('local_rules', 'Modo de regras locais ativo');
      assert.equal(getLocalAiRuntimeNotice().mode, 'local_rules');

      const synthesis = buildLocalDiagnosticSynthesis(answers, diag);
      assert.equal(synthesis.fallback, true);
      assert.equal(synthesis.origem, 'regras');
      assert.ok(synthesis.resumoExecutivo.includes(diag.versaoRegras.versao));
      assert.ok(synthesis.proximosPassos.length > 0);
      assert.ok(synthesis.fontesCitadas.length > 0);
    });
  });
});
