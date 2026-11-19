import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkOfficialLegalSourceUrl,
  extractHtmlTitle,
  isAllowedOfficialLegalUrl,
  runBatchOfficialLegalCheck,
  type FetchLike,
} from './sermigLegalService';

describe('sermigLegalService — Official SERMIG/BCN live link verification', () => {
  it('validates official SERMIG, BCN, Planalto, CNJ and rejects arbitrary external/private domains', () => {
    assert.equal(isAllowedOfficialLegalUrl('https://serviciomigraciones.cl/residencia-temporal/').valid, true);
    assert.equal(isAllowedOfficialLegalUrl('https://www.bcn.cl/leychile/navegar?idNorma=1158549').valid, true);
    assert.equal(isAllowedOfficialLegalUrl('https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2009/decreto/d6975.htm').valid, true);
    assert.equal(isAllowedOfficialLegalUrl('https://www.cnj.jus.br/poder-judiciario/relacoes-internacionais/apostila-da-haia/').valid, true);

    assert.equal(isAllowedOfficialLegalUrl('http://127.0.0.1:3000/api/health').valid, false);
    assert.equal(isAllowedOfficialLegalUrl('https://evil.example.com/phish').valid, false);
    assert.equal(isAllowedOfficialLegalUrl('').valid, false);
  });

  it('extracts and cleans HTML page titles safely', () => {
    const title = extractHtmlTitle('<html><head><title>  Servicio Nacional de Migraciones &amp; BCN </title></head></html>');
    assert.equal(title, 'Servicio Nacional de Migraciones & BCN');
  });

  it('checks official URLs in batch and classifies online, redirect, WAF degraded, and invalid URLs without throwing', async () => {
    const fakeFetch: FetchLike = async (url) => {
      if (url.includes('serviciomigraciones.cl')) {
        return {
          ok: true,
          status: 200,
          url,
          redirected: false,
          headers: { get: (k) => (k === 'content-type' ? 'text/html; charset=utf-8' : null) },
          text: async () => '<html><head><title>Residencia Temporal — SERMIG</title></head></html>',
        };
      }
      if (url.includes('bcn.cl')) {
        return {
          ok: true,
          status: 200,
          url: 'https://www.bcn.cl/leychile/navegar?idNorma=1158549&idVersion=2026-01-01',
          redirected: true,
          headers: { get: (k) => (k === 'content-type' ? 'text/html' : null) },
          text: async () => '<title>Ley 21.325</title>',
        };
      }
      return {
        ok: false,
        status: 403,
        url,
        redirected: false,
        headers: { get: () => null },
        text: async () => '',
      };
    };

    const batch = await runBatchOfficialLegalCheck(
      [
        { id: 'leg_1', titulo: 'SERMIG', url: 'https://serviciomigraciones.cl/residencia-temporal/' },
        { id: 'leg_2', titulo: 'Ley 21.325', url: 'https://www.bcn.cl/leychile/navegar?idNorma=1158549' },
        { id: 'leg_3', titulo: 'CNJ', url: 'https://www.cnj.jus.br/apostila' },
        { id: 'leg_4', titulo: 'Inválido', url: 'https://unauthorized.test/foo' },
      ],
      { fetchFn: fakeFetch },
    );

    assert.equal(batch.ok, true);
    assert.equal(batch.summary.total, 4);
    assert.equal(batch.summary.online, 1);
    assert.equal(batch.summary.redirect, 1);
    assert.equal(batch.summary.degraded, 1);
    assert.equal(batch.summary.invalidUrl, 1);
    assert.equal(batch.results[0].pageTitle, 'Residencia Temporal — SERMIG');
    assert.equal(batch.results[1].status, 'redirect');
    assert.equal(batch.results[2].status, 'degraded');
    assert.equal(batch.results[3].status, 'invalid_url');
  });

  it('handles network timeout gracefully as degraded status', async () => {
    const abortingFetch: FetchLike = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };

    const res = await checkOfficialLegalSourceUrl(
      { id: 'leg_to', titulo: 'SERMIG', url: 'https://serviciomigraciones.cl' },
      { fetchFn: abortingFetch, timeoutMs: 200 },
    );
    assert.equal(res.status, 'degraded');
    assert.equal(res.httpStatus, null);
  });
});
