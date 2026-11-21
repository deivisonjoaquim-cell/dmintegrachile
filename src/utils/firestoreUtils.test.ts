import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BRAND_ASSETS } from '../constants/brandAssets';
import {
  prepareFirestoreWritePayload,
  sanitizeFirestoreData,
  validateBancarioConfigPayload,
  validateEmpresaConfigPayload,
} from './firestoreUtils';

function assertNoUndefinedDeep(value: unknown, path = 'root'): void {
  assert.notEqual(value, undefined, `Found undefined at ${path}`);
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertNoUndefinedDeep(item, `${path}[${idx}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoUndefinedDeep(v, `${path}.${k}`);
    }
  }
}

describe('firestoreUtils — Sanitization & Config Collection Validation', () => {
  it('deeply removes undefined, NaN, Infinity, functions, and symbols from objects and arrays', () => {
    const raw = {
      name: 'Teste',
      missing: undefined,
      badNum: Number.NaN,
      infNum: Number.POSITIVE_INFINITY,
      fn: () => 'ignored',
      sym: Symbol('x'),
      createdAt: new Date('2026-11-18T12:00:00.000Z'),
      nested: {
        keep: true,
        omitMe: undefined,
        arr: [1, undefined, { a: 'ok', b: undefined }, Number.NaN],
      },
    };

    const cleaned = sanitizeFirestoreData(raw) as Record<string, unknown>;
    assertNoUndefinedDeep(cleaned);
    assert.equal(cleaned.name, 'Teste');
    assert.equal('missing' in cleaned, false);
    assert.equal('badNum' in cleaned, false);
    assert.equal('infNum' in cleaned, false);
    assert.equal('fn' in cleaned, false);
    assert.equal('sym' in cleaned, false);
    assert.equal(cleaned.createdAt, '2026-11-18T12:00:00.000Z');

    const nested = cleaned.nested as { keep: boolean; arr: unknown[] };
    assert.equal(nested.keep, true);
    assert.equal('omitMe' in nested, false);
    assert.deepEqual(nested.arr, [1, { a: 'ok' }, 0]);
  });

  it('validates config/empresa payload, upgrades legacy brand URLs to official uploaded logos, strips undefined optionals, clamps fields and colors', () => {
    const result = validateEmpresaConfigPayload({
      nome_empresa: '  D&M Integra Chile  ',
      corPrimaria: 'not-a-hex',
      corDestaque: '#C5A059',
      fontePrincipal: 'InvalidFont' as never,
      bloqueioProtocoloMinimo: 250,
      diasAlertaRevisaoLegal: -10,
      siteDraft: undefined,
      logoUrl: '/logo-dm-integra.svg',
      logoDarkUrl: '/logo-dm-integra-dark.svg',
      faviconUrl: '/favicon-dm-integra.svg',
      fcmVapidPublicKey: undefined,
    });

    assertNoUndefinedDeep(result);
    assert.equal(result.nome_empresa, 'D&M Integra Chile');
    assert.equal(result.corPrimaria, '#0B1F33');
    assert.equal(result.corDestaque, '#C5A059');
    assert.equal(result.fontePrincipal, 'Plus Jakarta Sans');
    assert.equal(result.bloqueioProtocoloMinimo, 100);
    assert.equal(result.diasAlertaRevisaoLegal, 1);
    assert.equal('siteDraft' in result, false);
    assert.equal(result.logoUrl, BRAND_ASSETS.logoLightPng);
    assert.equal(result.logoDarkUrl, BRAND_ASSETS.logoDarkPng);
    assert.equal(result.faviconUrl, BRAND_ASSETS.emblemLightSvg);
    assert.ok(typeof result.updatedAt === 'string' && result.updatedAt.length > 0);
  });

  it('satisfies every constraint of firestore.rules isValidEmpresaConfig on full form edits', () => {
    const result = validateEmpresaConfigPayload({
      nome_empresa: 'D&M Integra Chile – Relocation & Assessoria',
      foro_comarca: 'Comarca da Capital do Estado do Rio de Janeiro – RJ',
      corPrimaria: '#0B1F33',
      corDestaque: '#C8A236',
      corFundo: '#F7F5F0',
      corSuperficie: '',
      corTexto: '#0B1523',
      corRodapeBg: '#081726',
      fontePrincipal: 'Plus Jakarta Sans',
      fonteDisplay: 'Playfair Display',
      whatsapp: '+55 (21) 99999-0000 / +56 9 1234 5678',
      taxaCambioBrlClp: '' as unknown as number,
      honorariosPadraoMinBrl: Number.NaN,
    });

    assertNoUndefinedDeep(result);
    assert.ok(result.nome_empresa.length >= 1 && result.nome_empresa.length <= 200);
    assert.ok(result.foro_comarca.length >= 1 && result.foro_comarca.length <= 300);
    assert.ok(result.corPrimaria.length >= 4 && result.corPrimaria.length <= 20);
    assert.ok(result.corDestaque.length >= 4 && result.corDestaque.length <= 20);
    assert.ok(result.corFundo.length >= 4 && result.corFundo.length <= 20);
    assert.ok((result.whatsapp || '').length <= 80);
    assert.equal('corSuperficie' in result, false);
    assert.equal('taxaCambioBrlClp' in result, false);
    assert.equal('honorariosPadraoMinBrl' in result, false);
  });

  it('validates config/bancario payload with clamped fields and zero undefined keys', () => {
    const result = validateBancarioConfigPayload({
      dados_bancarios_br: 'Banco Inter · Ag 0001',
      dados_bancarios_cl: undefined,
      dados_wise: 'wise@dmintegrachile.com',
    });

    assertNoUndefinedDeep(result);
    assert.equal(result.dados_bancarios_br, 'Banco Inter · Ag 0001');
    assert.equal(result.dados_bancarios_cl, '');
    assert.equal(result.dados_wise, 'wise@dmintegrachile.com');
    assert.ok(typeof result.updatedAt === 'string');
  });

  it('routes prepareFirestoreWritePayload through config validators for config/empresa and config/bancario', () => {
    const empresaPayload = prepareFirestoreWritePayload('config', 'empresa', {
      nome_empresa: '',
      corPrimaria: 'invalid',
      siteDraft: undefined,
    });
    assertNoUndefinedDeep(empresaPayload);
    assert.equal(typeof empresaPayload.nome_empresa, 'string');
    assert.ok(String(empresaPayload.nome_empresa).length > 0);
    assert.equal(empresaPayload.corPrimaria, '#0B1F33');

    const bancarioPayload = prepareFirestoreWritePayload('config', 'bancario', {
      dados_wise: '  wise-account  ',
      extraUndefined: undefined,
    });
    assertNoUndefinedDeep(bancarioPayload);
    assert.equal(bancarioPayload.dados_wise, 'wise-account');
    assert.equal('extraUndefined' in bancarioPayload, false);

    const genericPayload = prepareFirestoreWritePayload('tasks', 'task_1', {
      titulo: 'Conferir passaporte',
      prazo: undefined,
    });
    assertNoUndefinedDeep(genericPayload);
    assert.equal(genericPayload.titulo, 'Conferir passaporte');
    assert.equal('prazo' in genericPayload, false);
  });
});
