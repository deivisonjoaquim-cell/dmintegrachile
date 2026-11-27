import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSignatureCertificateSummary,
  computeDocumentContentHash,
  formatSignatureHashShort,
  getSignatureMethodLabel,
  MAX_SIGNATURE_DATA_URL_LENGTH,
  TYPED_SIGNATURE_STYLES,
  validateAndNormalizeSignatureDataUrl,
  validateSignerIdentity,
} from './contractSignature';

test('computeDocumentContentHash produces deterministic 64-char SHA-256 hex sensitive to content changes', async () => {
  const hashA = await computeDocumentContentHash({
    docId: 'gdoc_001',
    titulo: 'Contrato de Assessoria Migratória',
    versao: 1,
    conteudoHtml: '<p>Cláusula 1 — Objeto do serviço para residência no Chile.</p>',
  });
  const hashA2 = await computeDocumentContentHash({
    docId: 'gdoc_001',
    titulo: 'Contrato de Assessoria Migratória',
    versao: 1,
    conteudoHtml: '<p>Cláusula 1 — Objeto do serviço para residência no Chile.</p>',
  });
  const hashB = await computeDocumentContentHash({
    docId: 'gdoc_001',
    titulo: 'Contrato de Assessoria Migratória',
    versao: 2,
    conteudoHtml: '<p>Cláusula 1 — Objeto do serviço para residência no Chile.</p>',
  });

  assert.equal(hashA.length, 64);
  assert.match(hashA, /^[0-9a-f]{64}$/);
  assert.equal(hashA, hashA2);
  assert.notEqual(hashA, hashB);
});

test('validateSignerIdentity enforces full name and mandatory legal acceptance checkbox', () => {
  const singleWord = validateSignerIdentity({
    nome: 'Maria',
    email: 'maria@example.com',
    aceiteTermo: true,
  });
  assert.equal(singleWord.valid, false);
  assert.ok(singleWord.error?.includes('nome completo'));

  const missingConsent = validateSignerIdentity({
    nome: 'Maria Clara Silva',
    email: 'MARIA@EXAMPLE.COM',
    documento: '123.456.789-00',
    aceiteTermo: false,
  });
  assert.equal(missingConsent.valid, false);
  assert.ok(missingConsent.error?.includes('aceite eletrônico'));

  const ok = validateSignerIdentity({
    nome: '  Maria   Clara Silva  ',
    email: '  MARIA@EXAMPLE.COM ',
    documento: ' 123.456.789-00 ',
    aceiteTermo: true,
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.normalizedNome, 'Maria Clara Silva');
  assert.equal(ok.normalizedEmail, 'maria@example.com');
  assert.equal(ok.normalizedDocumento, '123.456.789-00');
});

test('formatSignatureHashShort, getSignatureMethodLabel, and TYPED_SIGNATURE_STYLES return expected institutional formatting', () => {
  const fullHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
  assert.equal(formatSignatureHashShort(fullHash), 'A1B2C3D4E5…6D7E8F90');
  assert.equal(formatSignatureHashShort(''), '');

  assert.equal(getSignatureMethodLabel('desenhada'), 'Assinatura manuscrita digital');
  assert.equal(getSignatureMethodLabel('tipografica'), 'Assinatura eletrônica tipográfica');
  assert.equal(getSignatureMethodLabel('pdf_anexado'), 'Documento assinado anexado (PDF/Imagem)');
  assert.equal(getSignatureMethodLabel('externa'), 'Assinatura externa (Gov.br / Autentique)');

  assert.equal(TYPED_SIGNATURE_STYLES.length, 3);
  assert.deepEqual(
    TYPED_SIGNATURE_STYLES.map((s) => s.id),
    ['classica', 'editorial', 'executiva'],
  );
});

test('buildSignatureCertificateSummary merges explicit signature audit fields with fallbacks', () => {
  const cert = buildSignatureCertificateSummary(
    {
      id: 'gdoc_99',
      codigoVerificacao: 'DOC-2026-XYZ',
      assinaturaDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      assinadoEm: '2026-11-27T12:00:00.000Z',
      assinaturaMetodo: 'tipografica',
      assinadoPorNome: 'Ana Paula Souza',
      assinaturaHashSha256: 'deadbeef0123456789abcdef0123456789abcdef0123456789abcdef01234567',
      confirmadoLeituraEm: '2026-11-27T11:58:00.000Z',
    },
    {
      nome: 'Fallback Nome',
      email: 'ana@example.com',
      documento: '000.111.222-33',
    },
  );

  assert.equal(cert.hasSignature, true);
  assert.equal(cert.signerName, 'Ana Paula Souza');
  assert.equal(cert.signerEmail, 'ana@example.com');
  assert.equal(cert.signerDocument, '000.111.222-33');
  assert.equal(cert.methodLabel, 'Assinatura eletrônica tipográfica');
  assert.equal(cert.verificationCode, 'DOC-2026-XYZ');
  assert.ok(cert.hashShort.startsWith('DEADBEEF01'));
});

test('validateAndNormalizeSignatureDataUrl accepts valid PNG/WebP/JPEG base64 and rejects malformed or oversized payloads', () => {
  const validPng = `data:image/png;base64,${'A'.repeat(120)}`;
  const validWithWhitespace = `  data:image/webp;base64,${'B'.repeat(60)}\n${'C'.repeat(60)}  `;

  const resOk = validateAndNormalizeSignatureDataUrl(validPng);
  assert.equal(resOk.valid, true);
  assert.equal(resOk.dataUrl, validPng);

  const resCleaned = validateAndNormalizeSignatureDataUrl(validWithWhitespace);
  assert.equal(resCleaned.valid, true);
  assert.equal(resCleaned.dataUrl, `data:image/webp;base64,${'B'.repeat(60)}${'C'.repeat(60)}`);

  assert.equal(validateAndNormalizeSignatureDataUrl('').valid, false);
  assert.equal(validateAndNormalizeSignatureDataUrl('data:image/svg+xml;base64,PHN2Zz4=').valid, false);
  assert.equal(validateAndNormalizeSignatureDataUrl('data:image/png;base64,short').valid, false);

  const oversized = `data:image/png;base64,${'A'.repeat(MAX_SIGNATURE_DATA_URL_LENGTH + 10)}`;
  const resBig = validateAndNormalizeSignatureDataUrl(oversized);
  assert.equal(resBig.valid, false);
  assert.match(resBig.error || '', /grande demais/i);
});
