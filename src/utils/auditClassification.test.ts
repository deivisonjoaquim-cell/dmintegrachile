import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAdminAuditAction, formatEntityLabel } from './auditClassification';

test('classifies deletion actions as delete and marks them sensitive', () => {
  const res = classifyAdminAuditAction({
    acao: 'Excluir',
    entidade: 'cases',
    entidadeId: 'case_123',
    campo: 'exclusao_cascata_caso',
  });
  assert.equal(res.tipoOperacao, 'delete');
  assert.equal(res.sensivel, true);
  assert.ok(res.resumo.includes('Caso / Processo'));
});

test('classifies user role or portal permission changes as permission and sensitive', () => {
  const userRoleRes = classifyAdminAuditAction({
    acao: 'Atualizar',
    entidade: 'users',
    entidadeId: 'uid_abc',
    campo: 'alterar_permissao_role',
  });
  assert.equal(userRoleRes.tipoOperacao, 'permission');
  assert.equal(userRoleRes.sensivel, true);

  const portalRes = classifyAdminAuditAction({
    acao: 'Atualizar',
    entidade: 'clients',
    entidadeId: 'cli_01',
    campo: 'liberar_portal_cliente',
  });
  assert.equal(portalRes.tipoOperacao, 'permission');
  assert.equal(portalRes.sensivel, true);
});

test('classifies creation and sensitive banking updates accurately', () => {
  const createLead = classifyAdminAuditAction({
    acao: 'Criar',
    entidade: 'leads',
    entidadeId: 'lead_99',
    campo: 'novo_lead',
  });
  assert.equal(createLead.tipoOperacao, 'create');
  assert.equal(createLead.sensivel, false);

  const bankUpdate = classifyAdminAuditAction({
    acao: 'Atualizar',
    entidade: 'config',
    entidadeId: 'bancario',
    campo: 'dados_bancarios',
  });
  assert.equal(bankUpdate.tipoOperacao, 'sensitive');
  assert.equal(bankUpdate.sensivel, true);
});

test('formats known and unknown entity labels cleanly', () => {
  assert.equal(formatEntityLabel('users'), 'Usuário / Equipe');
  assert.equal(formatEntityLabel('customEntity'), 'customEntity');
});
