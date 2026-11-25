import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getHeroQuickProfileById,
  getHeroQuickProfiles,
  getJourneyPhases,
  type HeroQuickProfileId,
} from './heroProfilePreview';

test('heroProfilePreview returns 5 distinct profiles in both pt-BR and es-CL', () => {
  const pt = getHeroQuickProfiles('pt-BR');
  const es = getHeroQuickProfiles('es-CL');

  assert.equal(pt.length, 5);
  assert.equal(es.length, 5);

  const ids: HeroQuickProfileId[] = ['mercosul', 'trabalho', 'renda', 'familia', 'ja_no_chile'];
  for (const id of ids) {
    const pPt = getHeroQuickProfileById(id, 'pt-BR');
    const pEs = getHeroQuickProfileById(id, 'es-CL');
    assert.equal(pPt.id, id);
    assert.equal(pEs.id, id);
    assert.ok(pPt.routeTitle.length > 5);
    assert.ok(pEs.routeTitle.length > 5);
    assert.equal(pPt.diagnosticPath, '/diagnostico');
  }
});

test('getJourneyPhases returns 4 sequential numbered phases with deliverables', () => {
  for (const locale of ['pt-BR', 'es-CL'] as const) {
    const phases = getJourneyPhases(locale);
    assert.equal(phases.length, 4);
    assert.deepEqual(
      phases.map((p) => p.code),
      ['01', '02', '03', '04'],
    );
    for (const phase of phases) {
      assert.ok(phase.deliverables.length >= 3);
      assert.ok(phase.deadlineGuard.length > 10);
    }
  }
});
