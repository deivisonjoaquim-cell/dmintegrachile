import assert from 'node:assert/strict';
import test from 'node:test';
import type { CaseDocument } from '../types/domain';
import {
  buildClientStoragePath,
  buildDocumentReviewMetadata,
  formatFileSizeBytes,
  formatReviewTagLabel,
  MAX_CLIENT_UPLOAD_BYTES,
  sanitizeUploadFilename,
  validateClientUploadFile,
} from './documentUploadMetadata';

const sampleDoc: CaseDocument = {
  id: 'doc_ant_1',
  caseId: 'case_01',
  clientId: 'cli_01',
  pessoa: 'Titular',
  nomeDocumento: 'Certidão de Antecedentes Criminais PF',
  categoriaDoc: 'Antecedentes',
  etapaEsteira: '1 Aguardando Envio',
  ordemEmissao: 3,
  status: 'Pendente',
  validadeDias: 60,
  apostilado: false,
  traduzido: false,
  exigeApostila: true,
  exigeTraducao: false,
  obrigatorio: true,
  peso: 5,
  versao: 1,
};

test('validateClientUploadFile accepts valid PDF and images under 10 MB', () => {
  const pdf = validateClientUploadFile({ name: 'Certidao PF.pdf', type: 'application/pdf', size: 120000 });
  assert.equal(pdf.valid, true);
  assert.equal(pdf.mimeType, 'application/pdf');
  assert.equal(pdf.extension, 'pdf');

  const jpg = validateClientUploadFile({ name: 'passaporte.JPEG', type: '', size: 50000 });
  assert.equal(jpg.valid, true);
  assert.equal(jpg.mimeType, 'image/jpeg');
  assert.equal(jpg.extension, 'jpg');
});

test('validateClientUploadFile rejects unsupported MIME types and oversized files', () => {
  const exe = validateClientUploadFile({ name: 'script.exe', type: 'application/x-msdownload', size: 1024 });
  assert.equal(exe.valid, false);
  assert.match(exe.error || '', /Formato não permitido/);

  const huge = validateClientUploadFile({
    name: 'scan.pdf',
    type: 'application/pdf',
    size: MAX_CLIENT_UPLOAD_BYTES + 1,
  });
  assert.equal(huge.valid, false);
  assert.match(huge.error || '', /10 MB/);
});

test('sanitizeUploadFilename strips accents and unsafe path characters', () => {
  assert.equal(sanitizeUploadFilename('../../Certidão Polícia Federal (2026).PDF'), 'Certidao_Policia_Federal_2026.pdf');
});

test('buildClientStoragePath builds deterministic scoped path', () => {
  const path = buildClientStoragePath({
    clientId: 'cli_01',
    caseId: 'case_01',
    documentId: 'doc_ant_1',
    version: 2,
    originalFileName: 'Antecedentes João.pdf',
  });
  assert.equal(path, 'clients/cli_01/cases/case_01/documents/doc_ant_1/v2_Antecedentes_Joao.pdf');
});

test('buildDocumentReviewMetadata generates automatic internal-review tags and customMetadata', () => {
  const built = buildDocumentReviewMetadata({
    doc: sampleDoc,
    file: { name: 'Antecedentes João.pdf', type: 'application/pdf', size: 245760 },
    mimeType: 'application/pdf',
    nextVersion: 1,
    uploadedByUid: 'uid_client_1',
    uploadedByEmail: 'Cliente@Email.com',
    nowIso: '2026-05-01T12:00:00.000Z',
  });

  assert.equal(built.reviewMetadata.reviewStatus, 'pending_internal_review');
  assert.equal(built.reviewMetadata.reviewPriority, 'alta');
  assert.equal(built.reviewMetadata.uploadedByEmail, 'cliente@email.com');
  assert.ok(built.metadataTags.includes('pendente-revisao'));
  assert.ok(built.metadataTags.includes('prioridade-alta'));
  assert.ok(built.metadataTags.includes('apostila-haia'));
  assert.ok(built.metadataTags.includes('validade-curta'));
  assert.ok(built.metadataTags.includes('cat:antecedentes'));
  assert.ok(built.metadataTags.includes('titular'));
  assert.equal(built.customMetadata.reviewPriority, 'alta');
  assert.equal(built.customMetadata.clientId, 'cli_01');
  assert.equal(formatReviewTagLabel('apostila-haia'), 'Exige Apostila de Haia');
  assert.equal(formatFileSizeBytes(245760), '240.0 KB');
});
