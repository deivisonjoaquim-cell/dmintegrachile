import assert from 'node:assert/strict';
import test from 'node:test';
import {
  daysUntilDate,
  formatStandardDocFilename,
  isValidCPF,
  valorPorExtenso,
} from './formatters';
import { buildZipBlob } from './zipBuilder';

test('isValidCPF valida CPFs corretos, digitos verificadores invalidos e sequencias repetidas', () => {
  assert.equal(isValidCPF('52998224725'), true);
  assert.equal(isValidCPF('529.982.247-25'), true);
  assert.equal(isValidCPF('529.982.247-26'), false);
  assert.equal(isValidCPF('111.111.111-11'), false);
  assert.equal(isValidCPF('000.000.000-00'), false);
  assert.equal(isValidCPF('12345'), false);
});

test('valorPorExtenso formata BRL com/sem centavos, CLP inteiro e USD', () => {
  assert.equal(valorPorExtenso(1, 'BRL'), 'um real');
  assert.equal(valorPorExtenso(1500, 'BRL'), 'mil e quinhentos reais');
  assert.equal(valorPorExtenso(2540.5, 'BRL'), 'dois mil, quinhentos e quarenta reais e cinquenta centavos');
  assert.equal(valorPorExtenso(100.01, 'BRL'), 'cem reais e um centavo');
  assert.equal(valorPorExtenso(350000.99, 'CLP'), 'trezentos e cinquenta mil pesos chilenos');
  assert.equal(valorPorExtenso(250, 'USD'), 'duzentos e cinquenta dólares americanos');
});

test('formatStandardDocFilename remove acentos e padroniza MAIUSCULA + data + extensao', () => {
  assert.equal(
    formatStandardDocFilename('João da Silva', 'Certidão de Antecedentes Criminais', '2026-05-10', 'pdf'),
    'JOAO_DA_SILVA_CERTIDAO_DE_ANTECEDENTES_CRIMINAIS_2026-05-10.pdf'
  );
  assert.equal(
    formatStandardDocFilename('María José', 'Passaporte (Cópia)', '2026-01-15T10:30:00Z', '.png'),
    'MARIA_JOSE_PASSAPORTE_COPIA_2026-01-15.png'
  );
});

test('daysUntilDate diferencia datas futuras e passadas', () => {
  const future = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
  const past = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const futureDays = daysUntilDate(future);
  const pastDays = daysUntilDate(past);
  assert.ok(futureDays !== null && futureDays >= 9 && futureDays <= 11);
  assert.ok(pastDays !== null && pastDays <= -4 && pastDays >= -6);
  assert.equal(daysUntilDate(null), null);
});

test('buildZipBlob gera arquivo ZIP valido com assinatura PK\\x03\\x04', async () => {
  const blob = buildZipBlob([
    { name: '00_INDICE_DOSSIE.txt', data: 'Dossie DM Integra Chile' },
    { name: 'DOC_01.txt', data: new Uint8Array([65, 66, 67]) },
  ]);
  assert.ok(blob instanceof Blob);
  assert.ok(blob.size > 60);
  const buf = new Uint8Array(await blob.arrayBuffer());
  assert.equal(buf[0], 0x50);
  assert.equal(buf[1], 0x4b);
  assert.equal(buf[2], 0x03);
  assert.equal(buf[3], 0x04);
});
