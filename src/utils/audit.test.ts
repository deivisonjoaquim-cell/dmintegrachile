import assert from 'node:assert/strict';
import test from 'node:test';
import { extractRoleTransition, parseRoleChangeFromAuditLog } from './audit';
import { runDiagnosticEngine } from './diagnosticEngine';
import { buildBasicDiagnosticSummary } from './portalAccess';
import { SEED_LEGAL_SOURCES, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS } from '../data/seeds';
import type { DiagnosticAnswers } from '../types/domain';

test('audit role-change detection & parsing', async (t) => {
  await t.test('extracts oldRole -> newRole transitions accurately and ignores unchanged roles', () => {
    const changed = extractRoleTransition(
      { role: 'cliente', email: 'maria@exemplo.com', nome: 'Maria' },
      { role: 'consultor', email: 'maria@exemplo.com', nome: 'Maria' },
    );
    assert.deepEqual(changed, {
      oldRole: 'cliente',
      newRole: 'consultor',
      targetEmail: 'maria@exemplo.com',
      targetNome: 'Maria',
    });

    const initialAdmin = extractRoleTransition(null, {
      role: 'admin',
      email: 'deivisonjoaquim@gmail.com',
      nome: 'Deivison',
    });
    assert.equal(initialAdmin?.oldRole, 'nenhuma');
    assert.equal(initialAdmin?.newRole, 'admin');

    const unchanged = extractRoleTransition({ role: 'consultor' }, { role: 'consultor' });
    assert.equal(unchanged, null);
  });

  await t.test('parses structured and legacy role-change audit logs into RoleChangeAuditEvent', () => {
    const structured = parseRoleChangeFromAuditLog({
      id: 'role_123',
      actorUid: 'adm_uid_1',
      actorEmail: 'deivisonjoaquim@gmail.com',
      actorNome: 'Deivison',
      actorRole: 'admin',
      acao: 'Alterar Permissão',
      tipoOperacao: 'permission',
      sensivel: true,
      entidade: 'users',
      entidadeId: 'user_uid_2',
      campo: 'alterar_permissao_role',
      adminUid: 'adm_uid_1',
      targetUid: 'user_uid_2',
      targetEmail: 'consultor@exemplo.com',
      targetNome: 'Ana Consultora',
      oldRole: 'assistente',
      newRole: 'consultor',
      changedAt: '2026-11-22T10:00:00.000Z',
      createdAt: '2026-11-22T10:00:00.000Z',
    });

    assert.equal(structured?.adminUid, 'adm_uid_1');
    assert.equal(structured?.targetUid, 'user_uid_2');
    assert.equal(structured?.oldRole, 'assistente');
    assert.equal(structured?.newRole, 'consultor');
    assert.equal(structured?.changedAt, '2026-11-22T10:00:00.000Z');
  });
});

test('buildBasicDiagnosticSummary produces rich executive free diagnostic dossier', () => {
  const answers: DiagnosticAnswers = {
    nome: 'Carlos Silva',
    whatsapp: '+55 (11) 99999-0000',
    email: 'carlos@exemplo.com',
    cidadeUf: 'São Paulo - SP',
    origem: 'Site',
    localizacao: 'No Brasil',
    nacionalidadeBrasileira: true,
    possuiSegundaNacionalidade: false,
    passaporteStatus: 'valido',
    passaporteValidadeMeses: 24,
    objetivo: 'explorar',
    possuiOfertaTrabalhoFormal: false,
    possuiMatriculaReconhecida: false,
    possuiRendaPassiva: true,
    faixaRendaMensalUsd: 'acima_2500',
    possuiCapitalComprovadoOrigem: true,
    titularTemResidenciaChile: false,
    vinculoFamiliarChile: false,
    vinculoFormalizado: false,
    overstay: false,
    ordenAbandono: false,
    rejeicaoAnterior: false,
    antecedentesCriminais: false,
    familiaAcompanhante: true,
    quantidadeDependentes: 2,
    prazoPretendido: '3 a 6 meses',
    documentosJaPossui: ['Passaporte'],
    lgpdAceito: true,
    lgpdVersao: '1.0',
  };

  const result = runDiagnosticEngine(
    answers,
    SEED_VISA_CATEGORIES,
    SEED_VISA_REQUIREMENTS,
    SEED_LEGAL_SOURCES,
  );
  const summary = buildBasicDiagnosticSummary(result, answers);

  assert.equal(summary.nome, 'Carlos Silva');
  assert.ok(summary.notaViabilidade >= 50 && summary.notaViabilidade <= 100);
  assert.ok((summary.dimensoes?.length ?? 0) >= 5, 'expected real viability dimensions breakdown');
  assert.equal(summary.roteiroMacro?.length, 4, 'expected 4-phase macro roadmap');
  assert.ok((summary.pontosFortes?.length ?? 0) >= 1, 'expected strengths list');
  assert.equal(summary.familiaResumo, 'Titular + 2 dependente(s)');
  assert.equal(summary.perfilResumo?.localizacao, 'No Brasil');
});
