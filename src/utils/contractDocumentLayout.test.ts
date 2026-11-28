import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONTRATO_TEMPLATE } from '../data/seeds';
import {
  insertContractClausesBeforeClosing,
  parseContractDocumentLayout,
} from './contractDocumentLayout';

test('insertContractClausesBeforeClosing inserts modality and extra clauses before Foro and date/signature lines', () => {
  const sample = [
    'CONTRATO DE CONSULTORIA',
    '',
    'CLÁUSULA 1ª – DO OBJETO',
    '1.1. Assessoria para visto e RUT.',
    '',
    'CLÁUSULA 6ª – DO FORO',
    '6.1. Foro do Rio de Janeiro.',
    '',
    'Brasil, 28/11/2026.',
  ].join('\n');

  const merged = insertContractClausesBeforeClosing(sample, [
    'CLÁUSULA DE MODALIDADE – CONSULTORIA COMPLETA\nGestão integral até Visto e RUT.',
    'CLÁUSULA ADICIONAL – DEPENDENTES\nInclui cônjuge.',
  ]);

  const idxObj = merged.indexOf('CLÁUSULA 1ª');
  const idxMod = merged.indexOf('CLÁUSULA DE MODALIDADE');
  const idxDep = merged.indexOf('CLÁUSULA ADICIONAL – DEPENDENTES');
  const idxForo = merged.indexOf('CLÁUSULA 6ª – DO FORO');
  const idxDate = merged.indexOf('Brasil, 28/11/2026.');

  assert.ok(idxObj < idxMod && idxMod < idxDep && idxDep < idxForo && idxForo < idxDate);
});

test('parseContractDocumentLayout structures parties, clauses, closing date and strips internal compliance note and ASCII rules', () => {
  const sampleWithLegacy = `${DEFAULT_CONTRATO_TEMPLATE.replace('{{data_atual}}', '28/11/2026')}\n\nNota interna de conformidade: Revisar com advogado antes do uso.`;

  const parsed = parseContractDocumentLayout(sampleWithLegacy);

  assert.match(parsed.title, /^CONTRATO DE PRESTAÇÃO DE SERVIÇOS/i);
  assert.equal(parsed.parties.length, 2);
  assert.equal(parsed.parties[0].role, 'CONTRATADO(A)');
  assert.equal(parsed.parties[1].role, 'CONTRATANTE');
  assert.ok(parsed.clauses.length >= 6);
  assert.equal(parsed.closingDateLine?.endsWith('28/11/2026.'), true);

  const allClauseText = parsed.clauses.flatMap((c) => [c.heading, ...c.paragraphs]).join('\n');
  assert.doesNotMatch(allClauseText, /Nota interna de conformidade/i);
  assert.doesNotMatch(allClauseText, /________/);
});
