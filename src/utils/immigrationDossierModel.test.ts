import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDossierConsultantValidation,
  buildImmigrationDossierHighlights,
} from './immigrationDossierModel';
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

test('buildDossierConsultantValidation builds deterministic verification code, fingerprint, and custom consultant notes', () => {
  const first = buildDossierConsultantValidation({
    protocolo: 'DM-2026-44',
    clientName: 'Marina Costa',
    subcategoriaNome: 'Residência Temporal — Acordo Mercosul',
    empresaResponsavel: 'Daniela Mendes',
    consultantNotes: {
      text: 'Revisar validade do passaporte e emitir Antecedentes PF na semana do protocolo.',
      recommendation: 'Agendar conferência final antes do envio ao SERMIG.',
    },
    digitalSignature: {
      signerName: 'Daniela Mendes',
      signedAt: '2026-11-28T14:30:00.000Z',
    },
  });

  const second = buildDossierConsultantValidation({
    protocolo: 'DM-2026-44',
    clientName: 'Marina Costa',
    subcategoriaNome: 'Residência Temporal — Acordo Mercosul',
    empresaResponsavel: 'Daniela Mendes',
    consultantNotes: {
      text: 'Revisar validade do passaporte e emitir Antecedentes PF na semana do protocolo.',
      recommendation: 'Agendar conferência final antes do envio ao SERMIG.',
    },
    digitalSignature: {
      signerName: 'Daniela Mendes',
      signedAt: '2026-11-28T14:30:00.000Z',
    },
  });

  assert.equal(first.hasCustomNotes, true);
  assert.match(first.notesBody, /Antecedentes PF/i);
  assert.match(first.notesBody, /SERMIG/i);
  assert.equal(first.verificationCode, second.verificationCode);
  assert.equal(first.integrityFingerprint, second.integrityFingerprint);
  assert.match(first.integrityFingerprint, /^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
  assert.match(first.legalBasisNote, /Visto SERMIG e RUT/i);
  assert.doesNotMatch(`${first.notesBody} ${first.legalBasisNote}`, /\bPDI\b/i);
});

test('buildDossierConsultantValidation provides guided fallback notes in PT-BR and ES-CL when empty', () => {
  const ptFallback = buildDossierConsultantValidation({
    protocolo: 'DM-EMPTY-1',
    clientName: 'Lucas Almeida',
    subcategoriaNome: 'Acordo Mercosul',
    locale: 'pt-BR',
  });
  assert.equal(ptFallback.hasCustomNotes, false);
  assert.match(ptFallback.notesBody, /RUT/);
  assert.doesNotMatch(ptFallback.notesBody, /\bPDI\b/i);

  const esFallback = buildDossierConsultantValidation({
    protocolo: 'CL-EMPTY-2',
    clientName: 'Sofía Martínez',
    subcategoriaNome: 'Acuerdo Mercosur',
    locale: 'es-CL',
  });
  assert.equal(esFallback.hasCustomNotes, false);
  assert.match(esFallback.signatureSectionTitle, /FIRMA DIGITAL/i);
  assert.match(esFallback.notesBody, /RUT/);
});
