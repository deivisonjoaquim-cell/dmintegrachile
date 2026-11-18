import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeClientPayload,
  sanitizeDiagnosticLeadPayload,
  sanitizeDiagnosticSessionPayload,
} from '../utils/firestorePayloads';
import type { DiagnosticAnswers } from '../types/domain';

const SAMPLE_ANSWERS: DiagnosticAnswers = {
  nome: 'Maria Silva',
  whatsapp: '+55 11 98888-7777',
  email: 'maria@exemplo.com',
  cidadeUf: 'São Paulo/SP',
  origem: 'Site',
  localizacao: 'No Brasil',
  nacionalidadeBrasileira: true,
  possuiSegundaNacionalidade: false,
  passaporteValidadeMeses: 24,
  vinculoFamiliarChile: false,
  vinculoFormalizado: false,
  objetivo: 'trabalho_formal',
  possuiOfertaTrabalhoFormal: true,
  possuiMatriculaReconhecida: false,
  possuiRendaPassiva: false,
  possuiCapitalComprovadoOrigem: false,
  titularTemResidenciaChile: false,
  overstay: false,
  ordenAbandono: false,
  rejeicaoAnterior: false,
  antecedentesCriminais: false,
  familiaAcompanhante: false,
  quantidadeDependentes: 0,
  prazoPretendido: '1 a 3 meses',
  documentosJaPossui: [],
  lgpdAceito: true,
  lgpdVersao: '1.0',
};

describe('useFirestore payload sanitizers', () => {
  it('sanitizes Client fields and enforces blueprint lengths/enums', () => {
    const longObs = 'x'.repeat(6000);
    const cli = sanitizeClientPayload(
      {
        id: 'cli_123',
        nomeCompleto: '  João Pedro Souza  ',
        email: '  JOAO@EXEMPLO.COM ',
        whatsapp: ' +55 11 99999-1111 ',
        cpf: '123.456.789-00-extra-chars',
        portalLiberado: true,
        observacoes: longObs,
      },
      { isNew: true },
    );

    assert.equal(cli.nomeCompleto, 'João Pedro Souza');
    assert.equal(cli.email, 'joao@exemplo.com');
    assert.equal(cli.statusAcessoPortal, 'Liberado');
    assert.equal(cli.cpf?.length, 20);
    assert.equal(cli.observacoes?.length, 5000);
    assert.ok(cli.createdAt);
    assert.ok(cli.updatedAt);
  });

  it('rejects invalid Client payloads cleanly', () => {
    assert.throws(
      () =>
        sanitizeClientPayload(
          {
            id: 'cli_bad',
            nomeCompleto: 'A',
            email: 'bad@x.com',
            whatsapp: '1199999999',
          },
          { isNew: true },
        ),
      /nome completo/i,
    );
  });

  it('sanitizes Diagnostic Lead and enforces forcePublicCreate statusFunil="Novo"', () => {
    const lead = sanitizeDiagnosticLeadPayload(
      {
        id: 'lead_1',
        nome: '  Ana Clara  ',
        whatsapp: ' +56 9 8888 5566 ',
        email: 'ANA@EXEMPLO.COM',
        origem: 'Site',
        statusFunil: 'Fechado',
        notaViabilidade: 150,
        notas: 'n'.repeat(4500),
        lgpdAceito: true,
      },
      { isNew: true, forcePublicCreate: true },
    );

    assert.equal(lead.statusFunil, 'Novo');
    assert.equal(lead.email, 'ana@exemplo.com');
    assert.equal(lead.notaViabilidade, 100);
    assert.equal(lead.notas?.length, 4000);
  });

  it('validates DiagnosticSession token length and clamps step bounds', () => {
    assert.throws(
      () =>
        sanitizeDiagnosticSessionPayload(
          'short',
          {
            etapaAtual: 1,
            answers: SAMPLE_ANSWERS,
            concluido: false,
            expiraEmMs: Date.now() + 10000,
          },
          true,
        ),
      /Token/,
    );

    const sess = sanitizeDiagnosticSessionPayload(
      'sess_0123456789abcdef012345',
      {
        etapaAtual: 99,
        answers: SAMPLE_ANSWERS,
        concluido: false,
        expiraEmMs: Date.now() + 60000,
      },
      false,
    );

    assert.equal(sess.etapaAtual, 6);
    assert.equal('createdAt' in sess, false);
  });
});
