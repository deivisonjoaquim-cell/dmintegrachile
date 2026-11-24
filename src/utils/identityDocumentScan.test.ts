import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIdentityDocumentFileName,
  estimateBase64ByteSize,
  IDENTITY_DOC_MAX_DATA_URL_LENGTH,
  IDENTITY_DOC_MAX_SIZE_BYTES,
  maskDocumentNumber,
  validateIdentityDocumentPayload,
} from './identityDocumentScan';

const SAMPLE_JPEG_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA==';

test('estimateBase64ByteSize calculates decoded byte count accurately', () => {
  // "hello" -> aGVsbG8= (5 bytes)
  assert.equal(estimateBase64ByteSize('data:image/jpeg;base64,aGVsbG8='), 5);
  // "hi" -> aGk= (2 bytes)
  assert.equal(estimateBase64ByteSize('data:image/webp;base64,aGk='), 2);
  assert.equal(estimateBase64ByteSize('invalid-no-comma'), 0);
});

test('buildIdentityDocumentFileName generates clean ASCII names with date and extension', () => {
  const fixedDate = new Date('2026-11-24T12:00:00Z');
  assert.equal(
    buildIdentityDocumentFileName('passaporte', 'Passaporte — Página de Identificação', 'image/webp', fixedDate),
    'passaporte_passaporte_pagina_de_identificacao_20261124.webp',
  );
  assert.equal(
    buildIdentityDocumentFileName('cedula_chile', 'Cédula / RUT', 'image/jpeg', fixedDate),
    'cedula_chile_cedula_rut_20261124.jpg',
  );
});

test('maskDocumentNumber hides leading digits while preserving tail', () => {
  assert.equal(maskDocumentNumber('BR123456789'), '•••••••6789');
  assert.equal(maskDocumentNumber('1234'), '••••');
  assert.equal(maskDocumentNumber(''), '');
});

test('validateIdentityDocumentPayload accepts valid raster camera scan payload', () => {
  const res = validateIdentityDocumentPayload({
    id: 'iddoc_12345_abc',
    ownerUid: 'user_uid_123',
    docType: 'passaporte',
    title: 'Passaporte Brasileiro',
    documentNumber: 'FS998877',
    issuingCountry: 'Brasil',
    expirationDate: '2032-08-15',
    notes: 'Página principal digitalizada via câmera',
    fileName: 'passaporte_brasileiro_20261124.webp',
    mimeType: 'image/webp',
    sizeBytes: 124_000,
    imageDataUrl: SAMPLE_JPEG_DATA_URL,
    captureMethod: 'camera',
  });
  assert.equal(res.valid, true);
});

test('validateIdentityDocumentPayload rejects unsafe SVG/script data URLs, oversized images, and invalid dates', () => {
  const base = {
    id: 'iddoc_12345_abc',
    ownerUid: 'user_uid_123',
    docType: 'rg_cin',
    title: 'RG Frente',
    fileName: 'rg_frente.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 80_000,
    imageDataUrl: SAMPLE_JPEG_DATA_URL,
    captureMethod: 'camera',
  };

  // Block SVG XSS vector
  const svgRes = validateIdentityDocumentPayload({
    ...base,
    imageDataUrl: 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+PC9zdmc+',
  });
  assert.equal(svgRes.valid, false);

  // Block oversized data URL > 650,000 chars
  const bigRes = validateIdentityDocumentPayload({
    ...base,
    imageDataUrl: `data:image/jpeg;base64,${'A'.repeat(IDENTITY_DOC_MAX_DATA_URL_LENGTH)}`,
  });
  assert.equal(bigRes.valid, false);

  // Block sizeBytes > 600,000
  const bigBytesRes = validateIdentityDocumentPayload({
    ...base,
    sizeBytes: IDENTITY_DOC_MAX_SIZE_BYTES + 1,
  });
  assert.equal(bigBytesRes.valid, false);

  // Block malformed expirationDate
  const badDateRes = validateIdentityDocumentPayload({
    ...base,
    expirationDate: '15/08/2032',
  });
  assert.equal(badDateRes.valid, false);

  // Block invalid ID with path traversal
  const badIdRes = validateIdentityDocumentPayload({
    ...base,
    id: '../escape',
  });
  assert.equal(badIdRes.valid, false);
});
