import test from 'node:test';
import assert from 'node:assert/strict';
import { buildImmigrationDossierHighlights } from './immigrationDossierModel';
import type { BasicDiagnosticSummary } from './portalAccess';

const SAMPLE_SUMMARY: BasicDiagnosticSummary = {
  nome: 'Marina Costa',
  notaViabilidade: 88,
  veredito: 'Alta viabilidade pelo Acordo Mercosul',
  vereditoNivel: 'alta',
  confianca: 'Alta',
  subcategoriaCodigo: '15',
  subcategoriaNome: 'Residência Temporal — Acordo Mercosul',
  resumoBasico: 'Perfil aderente ao Acordo Mercosul para protocolo no exterior.',
  prazoEstimadoResumo: '3 a 6 meses',
  temAlertaCritico: false,
  itensBloqueados: [],
  dataCalculo: '2026-11-28T10:00:00.000Z',
};

test('buildImmigrationDossierHighlights highlights Visa and RUT steps without PDI in PT-BR', () => {
  const highlights = buildImmigrationDossierHighlights({
    summary: SAMPLE_SUMMARY,
    locale: 'pt-BR',
  });

  assert.match(highlights.documentTitle, /DOSSIÊ DE IMIGRAÇÃO/i);
  assert.match(highlights.documentTitle, /VISTO/i);
  assert.match(highlights.documentTitle, /RUT/i);
  assert.equal(highlights.filenamePrefix, 'Dossie-Imigracao-DM-Integra');
  assert.equal(highlights.visaRutMilestones.length, 4);

  const combinedMilestones = highlights.visaRutMilestones
    .map((m) => `${m.title} ${m.detail} ${m.windowLabel}`)
    .join(' ');
  assert.match(combinedMilestones, /SERMIG/i);
  assert.match(combinedMilestones, /Estampado/i);
  assert.match(combinedMilestones, /Registro Civil/i);
  assert.match(combinedMilestones, /\bRUT\b/);
  assert.doesNotMatch(combinedMilestones, /\bPDI\b/i);
});

test('buildImmigrationDossierHighlights includes unmistakable housing non-guarantee disclaimer in PT-BR and ES-CL', () => {
  const pt = buildImmigrationDossierHighlights({ summary: SAMPLE_SUMMARY, locale: 'pt-BR' });
  assert.match(pt.housingDisclaimer.title, /MORADIA/i);
  assert.match(pt.housingDisclaimer.body, /moradia no Chile NÃO é um serviço garantido/i);
  assert.match(pt.housingDisclaimer.body, /câmbio/i);
  assert.match(pt.housingDisclaimer.body, /parceiros independentes/i);

  const es = buildImmigrationDossierHighlights({ summary: SAMPLE_SUMMARY, locale: 'es-CL' });
  assert.match(es.housingDisclaimer.body, /NO es un servicio garantizado/i);
  assert.match(es.housingDisclaimer.body, /Visa/i);
  assert.match(es.housingDisclaimer.body, /\bRUT\b/);
});
