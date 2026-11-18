import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Lead } from '../types/domain';
import { buildUpdatedLeadFromPatch, computeLeadUrgency } from './leadKanban';

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead_1',
    nome: 'Mariana Silva',
    whatsapp: '+5511999999999',
    email: 'mariana@example.com',
    cidadeUf: 'São Paulo/SP',
    origem: 'Site',
    interesse: 'Acordo Mercosul',
    statusFunil: 'Novo',
    prioridade: 'Média',
    lgpdAceito: true,
    lgpdVersao: '1.0',
    lgpdData: '2026-11-01T10:00:00.000Z',
    createdAt: '2026-11-18T00:00:00.000Z',
    ...overrides,
  };
}

describe('leadKanban — Urgency & Quick Edit Helpers', () => {
  it('flags critical urgency for Urgente priority or Novo lead overdue > 24h without first contact', () => {
    const now = Date.parse('2026-11-18T12:00:00.000Z');
    const overdue = makeLead({
      createdAt: '2026-11-16T10:00:00.000Z',
      prioridade: 'Média',
      statusFunil: 'Novo',
    });
    const resOverdue = computeLeadUrgency(overdue, now);
    assert.equal(resOverdue.level, 'critica');
    assert.equal(resOverdue.slaOverdue, true);
    assert.match(resOverdue.label, /SLA >24h/);

    const urgentRecent = makeLead({
      createdAt: '2026-11-18T11:00:00.000Z',
      prioridade: 'Urgente',
    });
    const resUrgent = computeLeadUrgency(urgentRecent, now);
    assert.equal(resUrgent.level, 'critica');
    assert.equal(resUrgent.slaOverdue, false);
    assert.equal(resUrgent.label, 'Urgente');
  });

  it('flags alta urgency for Quente temperature or consultant risk flags and normal for standard closed leads', () => {
    const now = Date.parse('2026-11-18T12:00:00.000Z');
    const hot = makeLead({
      createdAt: '2026-11-18T10:00:00.000Z',
      temperatura: 'Quente',
      prioridade: 'Média',
    });
    assert.equal(computeLeadUrgency(hot, now).level, 'alta');

    const closed = makeLead({
      createdAt: '2026-11-01T10:00:00.000Z',
      statusFunil: 'Fechado',
      prioridade: 'Urgente',
    });
    assert.equal(computeLeadUrgency(closed, now).level, 'normal');
  });

  it('buildUpdatedLeadFromPatch sets primeiroContatoEm when leaving Novo and clears motivoPerda when not Perdido', () => {
    const lead = makeLead({ statusFunil: 'Novo', motivoPerda: 'Antigo' });
    const updated = buildUpdatedLeadFromPatch(
      lead,
      {
        statusFunil: 'Contatado',
        prioridade: 'Alta',
        temperatura: 'Quente',
        notas: 'Contato inicial feito',
      },
      '2026-11-18T15:00:00.000Z',
    );
    assert.equal(updated.statusFunil, 'Contatado');
    assert.equal(updated.prioridade, 'Alta');
    assert.equal(updated.temperatura, 'Quente');
    assert.equal(updated.primeiroContatoEm, '2026-11-18T15:00:00.000Z');
    assert.equal(updated.motivoPerda, undefined);
    assert.equal(updated.updatedAt, '2026-11-18T15:00:00.000Z');
  });
});
