import assert from 'node:assert/strict';
import test from 'node:test';
import type { SiteContent } from '../types/domain';
import { upgradeLegacyCopyString, upgradeLegacySiteContentCopy } from './homeCopyNormalizer';

test('substitui Consultoria boutique por Assessoria personalizada em texto legado e customizado', () => {
  assert.equal(
    upgradeLegacyCopyString(
      'Consultoria boutique focada em segurança operacional, clareza jurídica e atendimento humanizado.',
    ),
    'Assessoria personalizada com foco em segurança operacional, clareza jurídica e atendimento próximo.',
  );

  assert.equal(
    upgradeLegacyCopyString('Nossa Consultoria boutique acompanha famílias no Chile.'),
    'Nossa Assessoria personalizada acompanha famílias no Chile.',
  );

  assert.equal(
    upgradeLegacyCopyString('Modelo de consultoria boutique para executivos.'),
    'Modelo de assessoria personalizada para executivos.',
  );
});

test('preserva edições personalizadas do administrador que não correspondem a textos legados', () => {
  const customRow: SiteContent = {
    id: 'site_quem_somos',
    secao: 'quem_somos',
    titulo: 'Nossa história própria no Chile',
    subtitulo: 'Atendimento exclusivo em Santiago e São Paulo.',
    conteudoHtml: 'Texto institucional personalizado.',
    imagemUrl: '',
    ordem: 5,
    ativo: true,
    metadados: {
      credenciais: 'Credencial personalizada da equipe.',
    },
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const result = upgradeLegacySiteContentCopy(customRow);
  assert.equal(result, customRow);
});

test('atualiza metadados de parceiros com concordância corrigida', () => {
  const legacyRow: SiteContent = {
    id: 'site_parceiros',
    secao: 'parceiros',
    titulo: 'Rede de Parceiros Homologados Brasil – Chile',
    subtitulo: 'Profissionais e empresas verificadas pela consultoria para apoiar cada etapa da sua mudança.',
    conteudoHtml: '',
    imagemUrl: '',
    ordem: 6,
    ativo: true,
    ctaTexto: 'Ver parceiros ou ser parceiro',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const upgraded = upgradeLegacySiteContentCopy(legacyRow);
  assert.equal(upgraded.titulo, 'Rede de Parceiros Homologados Brasil–Chile');
  assert.equal(
    upgraded.subtitulo,
    'Profissionais e empresas verificados pela consultoria para apoiar cada etapa da sua mudança.',
  );
  assert.equal(upgraded.ctaTexto, 'Explorar rede de parceiros');
});
