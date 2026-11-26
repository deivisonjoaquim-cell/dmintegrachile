import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEFAULT_EMPRESA_CONFIG, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS } from '../data/seeds';
import {
  buildSermigDocumentSlots,
  buildSermigSimulatedReceipt,
  createInitialSermigPortalState,
  SERMIG_MAX_FILE_BYTES,
  validateSermigAttachmentFile,
  validateSermigPortalStep,
} from './sermigSimulator';

describe('sermigSimulator — SERMIG Portal de Trámites Digitales state machine & validator', () => {
  const fixedNow = new Date('2026-11-26T12:00:00Z');

  it('validates login screen (Cuenta SERMIG vs ClaveÚnica) and rejects empty credentials', () => {
    const state = createInitialSermigPortalState({
      visaCategories: SEED_VISA_CATEGORIES,
      now: fixedNow,
    });
    const emptyCheck = validateSermigPortalStep('acceso', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(emptyCheck.valid, false);
    assert.ok(emptyCheck.errors.some((e) => e.field === 'loginEmail'));
    assert.ok(emptyCheck.errors.some((e) => e.field === 'loginPassword'));

    const validState = { ...state, loginEmail: 'cliente@exemplo.com', loginPassword: 'treino123' };
    const okCheck = validateSermigPortalStep('acceso', validState, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(okCheck.valid, true);
    assert.equal(okCheck.errors.length, 0);
  });

  it('blocks Mercosur inside-Chile first-time application under Ley 21.325 Art. 69', () => {
    const mercosur = SEED_VISA_CATEGORIES.find((v) => v.codigo === '15')!;
    const state = createInitialSermigPortalState({
      visaCategories: SEED_VISA_CATEGORIES,
      initialVisaId: mercosur.id,
      now: fixedNow,
    });
    state.tramiteType = 'rt_chile';
    state.possuiResidenciaVigenteChile = false;

    const check = validateSermigPortalStep('tramite', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(check.valid, false);
    assert.ok(check.errors.some((e) => e.legalRef?.includes('21.325')));

    // Switching to Extranjeros Fuera de Chile clears the block
    state.tramiteType = 'rt_exterior';
    const fixedCheck = validateSermigPortalStep('tramite', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(fixedCheck.valid, true);
  });

  it('validates personal data including double email confirmation and passport expiration', () => {
    const state = createInitialSermigPortalState({
      visaCategories: SEED_VISA_CATEGORIES,
      now: fixedNow,
    });
    state.nombres = 'Ana Carolina';
    state.primerApellido = 'Ferreira';
    state.segundoApellido = 'Lima';
    state.fechaNacimiento = '1992-05-14';
    state.correoNotificacion = 'ana@exemplo.com';
    state.confirmarCorreo = 'ana.errado@exemplo.com';

    const mismatch = validateSermigPortalStep('datos_personales', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(mismatch.valid, false);
    assert.ok(mismatch.errors.some((e) => e.field === 'confirmarCorreo'));

    state.confirmarCorreo = 'ana@exemplo.com';
    const matched = validateSermigPortalStep('datos_personales', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(matched.valid, true);

    // Expired passport must block step 3
    state.numeroDocumento = 'FY123456';
    state.fechaVencimientoDoc = '2026-10-01';
    state.direccionResidencia = 'Av. Paulista 1000';
    const expiredCheck = validateSermigPortalStep(
      'identificacion_domicilio',
      state,
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      fixedNow,
    );
    assert.equal(expiredCheck.valid, false);
    assert.ok(expiredCheck.errors.some((e) => e.field === 'fechaVencimientoDoc'));
  });

  it('enforces SERMIG 5MB limit, PDF format, and strict 60-day Polícia Federal validity window', () => {
    const mercosur = SEED_VISA_CATEGORIES.find((v) => v.codigo === '15')!;
    const slots = buildSermigDocumentSlots(mercosur, SEED_VISA_REQUIREMENTS, 0);
    const pfSlot = slots.find((s) => s.isAntecedentesPf)!;
    assert.ok(pfSlot);

    // Oversized file > 5MB rejected
    const oversized = validateSermigAttachmentFile(
      { name: 'antecedentes.pdf', size: SERMIG_MAX_FILE_BYTES + 1024, type: 'application/pdf' },
      pfSlot,
    );
    assert.equal(oversized.ok, false);

    // Non-PDF file rejected for PF slot
    const wrongExt = validateSermigAttachmentFile(
      { name: 'antecedentes.jpg', size: 200_000, type: 'image/jpeg' },
      pfSlot,
    );
    assert.equal(wrongExt.ok, false);

    // 75-day-old PF certificate fails step 4 validation
    const state = createInitialSermigPortalState({
      visaCategories: SEED_VISA_CATEGORIES,
      initialVisaId: mercosur.id,
      now: fixedNow,
    });
    for (const s of slots) {
      state.attachments[s.id] = {
        slotId: s.id,
        fileName: s.accepts === 'image' ? 'foto_3x4.jpg' : `${s.id}.pdf`,
        fileSizeBytes: 350_000,
        mimeType: s.accepts === 'image' ? 'image/jpeg' : 'application/pdf',
        dataEmissao: s.isAntecedentesPf ? '2026-09-01' : undefined, // > 60 days before 2026-11-26
        apostilaConfirmada: true,
        attachedAtIso: fixedNow.toISOString(),
      };
    }

    const expiredPf = validateSermigPortalStep('documentos', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(expiredPf.valid, false);
    assert.ok(expiredPf.errors.some((e) => e.field.includes('emissao')));

    // Fresh 10-day-old PF certificate passes
    state.attachments[pfSlot.id].dataEmissao = '2026-11-16';
    const freshPf = validateSermigPortalStep('documentos', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(freshPf.valid, true);
  });

  it('requires sworn declaration & captcha and generates a realistic SERMIG simulated receipt', () => {
    const mercosur = SEED_VISA_CATEGORIES.find((v) => v.codigo === '15')!;
    const state = createInitialSermigPortalState({
      visaCategories: SEED_VISA_CATEGORIES,
      initialVisaId: mercosur.id,
      now: fixedNow,
    });
    state.nombres = 'Lucas';
    state.primerApellido = 'Mendes';
    state.segundoApellido = 'Rocha';
    state.numeroDocumento = 'GL998877';
    state.correoNotificacion = 'lucas@exemplo.com';
    state.confirmarCorreo = 'lucas@exemplo.com';
    state.dependientes = [
      {
        id: 'dep_1',
        nombreCompleto: 'Sofia Mendes',
        parentesco: 'Cónyuge / Conviviente',
        fechaNacimiento: '1994-03-10',
        numeroDocumento: 'GL554433',
      },
    ];

    const unconfirmed = validateSermigPortalStep('revision_declaracion', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(unconfirmed.valid, false);

    state.declaraVeracidad = true;
    state.aceptaNotificacionElectronica = true;
    state.captchaVerificado = true;
    const confirmed = validateSermigPortalStep('revision_declaracion', state, SEED_VISA_CATEGORIES, SEED_VISA_REQUIREMENTS, fixedNow);
    assert.equal(confirmed.valid, true);

    const slots = buildSermigDocumentSlots(mercosur, SEED_VISA_REQUIREMENTS, 1);
    for (const s of slots) {
      state.attachments[s.id] = {
        slotId: s.id,
        fileName: s.accepts === 'image' ? 'foto.jpg' : `${s.id}.pdf`,
        fileSizeBytes: 240_000,
        mimeType: s.accepts === 'image' ? 'image/jpeg' : 'application/pdf',
        dataEmissao: s.isAntecedentesPf ? '2026-11-20' : undefined,
        apostilaConfirmada: true,
        attachedAtIso: fixedNow.toISOString(),
      };
    }

    const receipt = buildSermigSimulatedReceipt(
      state,
      SEED_VISA_CATEGORIES,
      SEED_VISA_REQUIREMENTS,
      DEFAULT_EMPRESA_CONFIG,
      fixedNow,
    );

    assert.match(receipt.folioSolicitud, /^SOL-2026-\d{8}$/);
    assert.match(receipt.codigoVerificacion, /^SERMIG-SIM-\d{6}$/);
    assert.equal(receipt.titularCompleto, 'Lucas Mendes Rocha');
    assert.equal(receipt.totalDependientes, 1);
    assert.equal(receipt.totalDocumentosAnexados, slots.length);
    assert.equal(receipt.readinessScore, 100);
    assert.equal(receipt.proximasEtapasReais.length, 4);
  });
});
