import { DEFAULT_DIAGNOSTIC_RULE_VERSION } from '../data/seeds';
import type { DiagnosticAnswers } from '../types/domain';
import { runDiagnosticEngine, type DiagnosticResult, type EngineOptions } from './diagnosticEngine';

export interface DiagnosticTestProfile {
  id: number;
  nome: string;
  descricao: string;
  answers: DiagnosticAnswers;
  engineOptions?: EngineOptions;
  assertCheck: (result: DiagnosticResult) => {
    pass: boolean;
    esperado: string;
    obtido: string;
    detalhe: string;
  };
}

function baseAnswers(overrides: Partial<DiagnosticAnswers>): DiagnosticAnswers {
  return {
    nome: 'Perfil de Teste',
    whatsapp: '+55 (11) 99999-0000',
    email: 'teste@dmintegrachile.com',
    cidadeUf: 'São Paulo - SP',
    origem: 'Site',
    localizacao: 'No Brasil',
    faixaEtaria: 'maior_18',
    nacionalidadeBrasileira: true,
    possuiSegundaNacionalidade: false,
    passaporteStatus: 'valido',
    passaporteValidadeMeses: 36,
    vinculoFamiliarChile: false,
    vinculoFormalizado: false,
    objetivo: 'explorar',
    possuiOfertaTrabalhoFormal: false,
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
    documentosJaPossui: ['Passaporte'],
    lgpdAceito: true,
    lgpdVersao: '1.0',
    ...overrides,
  };
}

export const DIAGNOSTIC_TEST_PROFILES: DiagnosticTestProfile[] = [
  {
    id: 1,
    nome: 'Brasileiro no Brasil (remoto / nômade)',
    descricao: 'Deve recomendar Mercosul (cód. 15) com nota ≥ 90 e sem alerta de saída turística.',
    answers: baseAnswers({ localizacao: 'No Brasil', objetivo: 'nomade_digital' }),
    assertCheck: (res) => {
      const ok = res.recomendada?.visa.codigo === '15' && res.recomendada.nota >= 90 && !res.alertas.some((a) => a.includes('Requer saída'));
      return {
        pass: ok,
        esperado: 'Cód. 15 com nota ≥ 90 e sem alerta de saída',
        obtido: res.recomendada ? `Cód. ${res.recomendada.visa.codigo} (${res.recomendada.nota} pts)` : 'Sem recomendação',
        detalhe: `Recomendada: Cód. ${res.recomendada?.visa.codigo ?? '—'} (${res.recomendada?.nota ?? 0} pts)`,
      };
    },
  },
  {
    id: 2,
    nome: 'Turista no Chile sem vínculo',
    descricao: 'Deve incluir Mercosul com alerta explícito de saída do Chile para protocolar do exterior.',
    answers: baseAnswers({ localizacao: 'No Chile como turista', objetivo: 'explorar' }),
    assertCheck: (res) => {
      const hasAlert = res.alertas.some((a) => a.includes('Requer saída do Chile'));
      const ok = res.top3.some((c) => c.visa.codigo === '15') && hasAlert;
      return {
        pass: ok,
        esperado: 'Mercosul (15) no Top 3 + Alerta de saída do Chile',
        obtido: `Top3 [${res.top3.map((c) => c.visa.codigo).join(', ')}] · Alerta saída: ${hasAlert ? 'Sim' : 'Não'}`,
        detalhe: `Alerta saída: ${hasAlert ? 'Sim' : 'Não'}`,
      };
    },
  },
  {
    id: 3,
    nome: 'No Brasil com cônjuge chileno formalizado',
    descricao: 'Deve indicar Reunificação Familiar (cód. 01).',
    answers: baseAnswers({
      localizacao: 'No Brasil',
      vinculoFamiliarChile: true,
      vinculoTipo: 'Cônjuge/União Civil',
      vinculoFormalizado: true,
    }),
    assertCheck: (res) => {
      const ok = res.top3.some((c) => c.visa.codigo === '01');
      return {
        pass: ok,
        esperado: 'Cód. 01 no Top 3',
        obtido: `Top 3: ${res.top3.map((c) => c.visa.codigo).join(', ')}`,
        detalhe: `Top 3: ${res.top3.map((c) => c.visa.codigo).join(', ')}`,
      };
    },
  },
  {
    id: 4,
    nome: 'Turista com cônjuge chileno formalizado',
    descricao: 'Deve indicar Reunificação Familiar (cód. 01) SEM alerta de saída do Chile.',
    answers: baseAnswers({
      localizacao: 'No Chile como turista',
      vinculoFamiliarChile: true,
      vinculoTipo: 'Cônjuge/União Civil',
      vinculoFormalizado: true,
    }),
    assertCheck: (res) => {
      const noExitAlert = !res.alertas.some((a) => a.includes('Requer saída do Chile'));
      const ok = res.recomendada?.visa.codigo === '01' && noExitAlert;
      return {
        pass: ok,
        esperado: 'Recomendada Cód. 01 e sem alerta de saída',
        obtido: `Cód. ${res.recomendada?.visa.codigo ?? '—'} · Sem alerta saída: ${noExitAlert}`,
        detalhe: `Recomendada: Cód. ${res.recomendada?.visa.codigo ?? '—'} · Sem alerta saída: ${noExitAlert}`,
      };
    },
  },
  {
    id: 5,
    nome: 'Humanitário no Chile',
    descricao: 'Deve indicar Razões Humanitárias (cód. 07) SEM alerta de saída turística.',
    answers: baseAnswers({ localizacao: 'No Chile como turista', objetivo: 'humanitario' }),
    assertCheck: (res) => {
      const noExitAlert = !res.alertas.some((a) => a.includes('Requer saída do Chile'));
      const ok = res.recomendada?.visa.codigo === '07' && noExitAlert;
      return {
        pass: ok,
        esperado: 'Recomendada Cód. 07 sem alerta de saída',
        obtido: `Cód. ${res.recomendada?.visa.codigo ?? '—'} · Sem alerta saída: ${noExitAlert}`,
        detalhe: `Recomendada: Cód. ${res.recomendada?.visa.codigo ?? '—'} · Sem alerta saída: ${noExitAlert}`,
      };
    },
  },
  {
    id: 6,
    nome: 'Contrato de trabalho formal',
    descricao: 'Deve incluir Cód. 02 (Atividades Lícitas) e manter Mercosul (15) no comparativo.',
    answers: baseAnswers({ objetivo: 'trabalho_formal', possuiOfertaTrabalhoFormal: true }),
    assertCheck: (res) => {
      const has02 = res.top3.some((c) => c.visa.codigo === '02');
      const has15Comp = res.comparativoMercosul.mercosul.visa.codigo === '15';
      return {
        pass: has02 && has15Comp,
        esperado: 'Cód. 02 no Top 3 e Cód. 15 no comparativo',
        obtido: `Cód 02 no Top3: ${has02} · Comparativo 15: ${has15Comp}`,
        detalhe: `Cód 02 no Top3: ${has02} · Comparativo 15: ${has15Comp}`,
      };
    },
  },
  {
    id: 7,
    nome: 'Renda passiva / aposentado',
    descricao: 'Deve incluir Cód. 11 (Aposentados e Rentistas) com influência da faixa de renda.',
    answers: baseAnswers({ objetivo: 'aposentado_renda', possuiRendaPassiva: true, faixaRendaMensalUsd: 'acima_2500' }),
    assertCheck: (res) => {
      const has11 = res.top3.some((c) => c.visa.codigo === '11');
      return {
        pass: has11,
        esperado: 'Cód. 11 no Top 3',
        obtido: `Top 3: ${res.top3.map((c) => `${c.visa.codigo}(${c.nota})`).join(', ')}`,
        detalhe: `Top 3: ${res.top3.map((c) => `${c.visa.codigo}(${c.nota})`).join(', ')}`,
      };
    },
  },
  {
    id: 8,
    nome: 'Matrícula reconhecida (Estudantes)',
    descricao: 'Deve recomendar ou incluir Cód. 03 (Estudantes).',
    answers: baseAnswers({ objetivo: 'estudar', possuiMatriculaReconhecida: true }),
    assertCheck: (res) => {
      const has03 = res.top3.some((c) => c.visa.codigo === '03');
      return {
        pass: has03,
        esperado: 'Cód. 03 no Top 3',
        obtido: `Top 3: ${res.top3.map((c) => c.visa.codigo).join(', ')}`,
        detalhe: `Recomendada: ${res.recomendada?.visa.codigo ?? '—'}`,
      };
    },
  },
  {
    id: 9,
    nome: 'Investimento com origem lícita',
    descricao: 'Deve incluir Cód. 13 (Investidores).',
    answers: baseAnswers({ objetivo: 'empreender_investir', possuiCapitalComprovadoOrigem: true }),
    assertCheck: (res) => {
      const has13 = res.top3.some((c) => c.visa.codigo === '13');
      return {
        pass: has13,
        esperado: 'Cód. 13 no Top 3',
        obtido: `Top 3: ${res.top3.map((c) => c.visa.codigo).join(', ')}`,
        detalhe: `Top 3: ${res.top3.map((c) => c.visa.codigo).join(', ')}`,
      };
    },
  },
  {
    id: 10,
    nome: 'Somente overstay = Sim',
    descricao: 'Deve ativar Risco Alto apontando exclusivamente a pergunta de overstay.',
    answers: baseAnswers({ overstay: true }),
    assertCheck: (res) => {
      const ok = res.flagsRisco.length === 1 && res.flagsRisco[0].campo === 'overstay' && !!res.alertaRiscoAlto;
      return {
        pass: ok,
        esperado: '1 flag exclusiva (overstay) + Risco Alto',
        obtido: `Flags: [${res.flagsRisco.map((f) => f.campo).join(', ')}]`,
        detalhe: `Flags: ${res.flagsRisco.map((f) => f.campo).join(', ')}`,
      };
    },
  },
  {
    id: 11,
    nome: 'Todos os riscos = Não',
    descricao: 'Nenhuma flag de risco deve aparecer.',
    answers: baseAnswers({ overstay: false, ordenAbandono: false, rejeicaoAnterior: false, antecedentesCriminais: false }),
    assertCheck: (res) => {
      const ok = res.flagsRisco.length === 0 && res.alertaRiscoAlto === null;
      return {
        pass: ok,
        esperado: '0 flags de risco e alertaRiscoAlto = null',
        obtido: `Flags: ${res.flagsRisco.length} · Risco Alto: ${res.alertaRiscoAlto ? 'Sim' : 'Não'}`,
        detalhe: `Flags: ${res.flagsRisco.length}`,
      };
    },
  },
  {
    id: 12,
    nome: 'Dependente de titular não selecionado',
    descricao: 'Fluxo DEP (Dependente de titular) NÃO pode aparecer nas opções recomendadas.',
    answers: baseAnswers({ objetivo: 'trabalho_formal', possuiOfertaTrabalhoFormal: true }),
    assertCheck: (res) => {
      const ok = !res.top3.some((c) => c.visa.codigo === 'DEP');
      return {
        pass: ok,
        esperado: 'DEP ausente do Top 3',
        obtido: `Top 3: ${res.top3.map((c) => c.visa.codigo).join(', ')}`,
        detalhe: `Top 3: ${res.top3.map((c) => c.visa.codigo).join(', ')}`,
      };
    },
  },
  {
    id: 13,
    nome: 'Passaporte com menos de 1 ano',
    descricao: 'Deve gerar alerta de passaporte e reduzir a pontuação de pedidos do exterior.',
    answers: baseAnswers({ localizacao: 'No Brasil', passaporteValidadeMeses: 6 }),
    assertCheck: (res) => {
      const hasAlert = res.alertas.some((a) => a.toLowerCase().includes('passaporte'));
      const fullRes = runDiagnosticEngine(baseAnswers({ localizacao: 'No Brasil', passaporteValidadeMeses: 36 }));
      const ok = hasAlert && (res.recomendada?.nota ?? 0) < (fullRes.recomendada?.nota ?? 0);
      return {
        pass: ok,
        esperado: 'Alerta de passaporte e nota menor que passaporte 36m',
        obtido: `Nota 6m=${res.recomendada?.nota ?? 0} vs 36m=${fullRes.recomendada?.nota ?? 0}`,
        detalhe: `Nota 6m=${res.recomendada?.nota ?? 0} vs 36m=${fullRes.recomendada?.nota ?? 0}`,
      };
    },
  },
  {
    id: 14,
    nome: 'Brasileiro com segunda nacionalidade',
    descricao: 'Mercosul (15) continua elegível e no comparativo.',
    answers: baseAnswers({ nacionalidadeBrasileira: true, possuiSegundaNacionalidade: true, segundaNacionalidadeQual: 'Italiana' }),
    assertCheck: (res) => {
      const ok = res.top3.some((c) => c.visa.codigo === '15') && res.comparativoMercosul.mercosul.visa.codigo === '15';
      return {
        pass: ok,
        esperado: 'Mercosul (15) mantido no Top 3 e comparativo',
        obtido: `Mercosul mantido: ${ok}`,
        detalhe: `Mercosul mantido: ${ok}`,
      };
    },
  },
  {
    id: 15,
    nome: 'Riscos não respondidos (null)',
    descricao: 'Respostas null NUNCA contam como Sim e não geram nenhuma flag de risco.',
    answers: baseAnswers({ overstay: null, ordenAbandono: null, rejeicaoAnterior: null, antecedentesCriminais: null }),
    assertCheck: (res) => {
      const ok = res.flagsRisco.length === 0 && res.alertaRiscoAlto === null;
      return {
        pass: ok,
        esperado: '0 flags de risco e sem Risco Alto',
        obtido: `Flags com null: ${res.flagsRisco.length}`,
        detalhe: `Flags com null: ${res.flagsRisco.length}`,
      };
    },
  },
  {
    id: 16,
    nome: 'Brasileiro menor de idade acompanhado dos pais',
    descricao: 'Mantém elegibilidade Mercosul e aciona orientação documental de certidão e autorização parental.',
    answers: baseAnswers({ faixaEtaria: 'menor_18_com_pais', nacionalidadeBrasileira: true }),
    assertCheck: (res) => {
      const hasMinorAlert = res.alertas.some((a) => a.toLowerCase().includes('menor de 18'));
      const ok = res.top3.some((c) => c.visa.codigo === '15') && hasMinorAlert;
      return {
        pass: ok,
        esperado: 'Cód. 15 elegível + alerta de menor acompanhado',
        obtido: `Alerta menor: ${hasMinorAlert ? 'Sim' : 'Não'}`,
        detalhe: `Cód. 15 no Top3 e alerta menor=${hasMinorAlert}`,
      };
    },
  },
  {
    id: 17,
    nome: 'Casal brasileiro (um titular e um dependente)',
    descricao: 'Gera diagnóstico por pessoa diferenciando Titular e Dependente quando família selecionada.',
    answers: baseAnswers({
      familiaAcompanhante: true,
      composicaoFamiliar: 'casal',
      quantidadeDependentes: 1,
      pessoasFamilia: [
        { nome: 'Ana Clara', papel: 'Titular', parentesco: 'Titular', nacionalidadeBrasileira: true },
        { nome: 'Bruno Silva', papel: 'Dependente', parentesco: 'Cônjuge', nacionalidadeBrasileira: true },
      ],
    }),
    assertCheck: (res) => {
      const hasTitular = res.diagnosticoPorPessoa.some((p) => p.papel === 'Titular');
      const hasDep = res.diagnosticoPorPessoa.some((p) => p.papel === 'Dependente');
      const ok = hasTitular && hasDep && res.diagnosticoPorPessoa.length === 2;
      return {
        pass: ok,
        esperado: 'Diagnóstico por pessoa com 1 Titular e 1 Dependente',
        obtido: `${res.diagnosticoPorPessoa.length} pessoa(s): ${res.diagnosticoPorPessoa.map((p) => p.papel).join(', ')}`,
        detalhe: `Pessoas: ${res.diagnosticoPorPessoa.map((p) => `${p.nome}(${p.papel})`).join(' · ')}`,
      };
    },
  },
  {
    id: 18,
    nome: 'Vínculo familiar informado mas NÃO formalizado',
    descricao: 'NÃO ativa Reunificação Familiar (01) e sugere formalização jurídica do vínculo.',
    answers: baseAnswers({
      localizacao: 'No Brasil',
      vinculoFamiliarChile: true,
      vinculoTipo: 'Cônjuge/União Civil',
      vinculoFormalizado: false,
    }),
    assertCheck: (res) => {
      const has01 = res.top3.some((c) => c.visa.codigo === '01');
      const suggestsFormalize =
        res.alertas.some((a) => a.toLowerCase().includes('formalizar')) ||
        res.informacoesQueMudariamResultado.some((i) => i.toLowerCase().includes('formalizar'));
      const ok = !has01 && suggestsFormalize;
      return {
        pass: ok,
        esperado: 'Cód. 01 inativo + sugestão de formalizar vínculo',
        obtido: `Cód 01 ativo: ${has01} · Sugere formalizar: ${suggestsFormalize}`,
        detalhe: `Cód 01 ativo=${has01}, sugestão=${suggestsFormalize}`,
      };
    },
  },
  {
    id: 19,
    nome: 'Somente rejeição anterior = Sim',
    descricao: 'Deve ativar exclusivamente a flag rejeicaoAnterior e nenhuma outra.',
    answers: baseAnswers({ rejeicaoAnterior: true }),
    assertCheck: (res) => {
      const ok = res.flagsRisco.length === 1 && res.flagsRisco[0].campo === 'rejeicaoAnterior';
      return {
        pass: ok,
        esperado: 'Exclusivamente flag rejeicaoAnterior',
        obtido: `Flags: [${res.flagsRisco.map((f) => f.campo).join(', ')}]`,
        detalhe: `Flags: ${res.flagsRisco.map((f) => f.campo).join(', ')}`,
      };
    },
  },
  {
    id: 20,
    nome: 'Somente Orden de Abandono = Sim',
    descricao: 'Deve ativar exclusivamente a flag ordenAbandono e nenhuma outra.',
    answers: baseAnswers({ ordenAbandono: true }),
    assertCheck: (res) => {
      const ok = res.flagsRisco.length === 1 && res.flagsRisco[0].campo === 'ordenAbandono';
      return {
        pass: ok,
        esperado: 'Exclusivamente flag ordenAbandono',
        obtido: `Flags: [${res.flagsRisco.map((f) => f.campo).join(', ')}]`,
        detalhe: `Flags: ${res.flagsRisco.map((f) => f.campo).join(', ')}`,
      };
    },
  },
  {
    id: 21,
    nome: 'Somente antecedentes criminais = Sim',
    descricao: 'Deve ativar exclusivamente a flag antecedentesCriminais e nenhuma outra.',
    answers: baseAnswers({ antecedentesCriminais: true }),
    assertCheck: (res) => {
      const ok = res.flagsRisco.length === 1 && res.flagsRisco[0].campo === 'antecedentesCriminais';
      return {
        pass: ok,
        esperado: 'Exclusivamente flag antecedentesCriminais',
        obtido: `Flags: [${res.flagsRisco.map((f) => f.campo).join(', ')}]`,
        detalhe: `Flags: ${res.flagsRisco.map((f) => f.campo).join(', ')}`,
      };
    },
  },
  {
    id: 22,
    nome: 'Prefiro falar com o consultor na etapa sensível',
    descricao: 'Gera flag de revisão com o consultor sem disparar Risco Alto automático.',
    answers: baseAnswers({
      overstay: null,
      antecedentesCriminais: null,
      riscoConsultaConsultor: ['overstay', 'antecedentesCriminais'],
    }),
    assertCheck: (res) => {
      const ok = res.flagsRevisaoConsultor.length === 2 && res.flagsRisco.length === 0 && res.alertaRiscoAlto === null;
      return {
        pass: ok,
        esperado: '2 flagsRevisaoConsultor, 0 flagsRisco e sem Risco Alto',
        obtido: `Revisão=${res.flagsRevisaoConsultor.length}, Risco=${res.flagsRisco.length}, RiscoAlto=${res.alertaRiscoAlto ? 'Sim' : 'Não'}`,
        detalhe: `Revisão=${res.flagsRevisaoConsultor.length} · Risco Alto=${res.alertaRiscoAlto ? 'Sim' : 'Não'}`,
      };
    },
  },
  {
    id: 23,
    nome: 'Passaporte vencido',
    descricao: 'Deve gerar alerta de passaporte vencido, sugerir emissão imediata e reduzir pontuação.',
    answers: baseAnswers({ localizacao: 'No Brasil', passaporteStatus: 'vencido', passaporteValidadeMeses: 0 }),
    assertCheck: (res) => {
      const hasExpiredAlert = res.alertas.some((a) => a.toLowerCase().includes('passaporte vencido'));
      const hasFirstAction = res.planoAcao.facaAgora.some((a) => a.titulo.toLowerCase().includes('passaporte'));
      const ok = hasExpiredAlert && hasFirstAction && (res.recomendada?.nota ?? 100) < 85;
      return {
        pass: ok,
        esperado: 'Alerta passaporte vencido + ação imediata + penalização de nota',
        obtido: `Nota=${res.recomendada?.nota ?? 0} · Alerta=${hasExpiredAlert}`,
        detalhe: `Alerta=${hasExpiredAlert} · Nota=${res.recomendada?.nota ?? 0}`,
      };
    },
  },
  {
    id: 24,
    nome: 'Já residente no Chile pedindo prorrogação (< 24 meses)',
    descricao: 'Sinaliza fluxo de Prorrogação sem alerta de saída turística.',
    answers: baseAnswers({ localizacao: 'No Chile com residência', mesesResidenciaChile: 12 }),
    assertCheck: (res) => {
      const noExit = !res.alertas.some((a) => a.includes('Requer saída'));
      const ok = res.situacaoResidenciaAtual === 'Prorrogação' && noExit;
      return {
        pass: ok,
        esperado: 'Situação Prorrogação e sem alerta de saída turística',
        obtido: `Situação=${res.situacaoResidenciaAtual ?? 'Nenhuma'} · Sem saída=${noExit}`,
        detalhe: `Situação: ${res.situacaoResidenciaAtual ?? '—'}`,
      };
    },
  },
  {
    id: 25,
    nome: 'Residente no Chile há 24+ meses',
    descricao: 'Classifica como Residência Definitiva em análise.',
    answers: baseAnswers({ localizacao: 'No Chile com residência', mesesResidenciaChile: 26 }),
    assertCheck: (res) => {
      const ok = res.situacaoResidenciaAtual === 'Residência Definitiva em análise';
      return {
        pass: ok,
        esperado: 'Residência Definitiva em análise',
        obtido: res.situacaoResidenciaAtual || 'Não acionado',
        detalhe: `Situação: ${res.situacaoResidenciaAtual ?? '—'}`,
      };
    },
  },
  {
    id: 26,
    nome: 'Estudante sem matrícula reconhecida',
    descricao: 'NÃO ativa Subcategoria 03 (Estudantes) quando não há matrícula ou carta de aceitação.',
    answers: baseAnswers({ objetivo: 'estudar', possuiMatriculaReconhecida: false }),
    assertCheck: (res) => {
      const has03 = res.top3.some((c) => c.visa.codigo === '03');
      const inDiscarded = res.descartadas.some((d) => d.codigo === '03');
      const ok = !has03 && inDiscarded;
      return {
        pass: ok,
        esperado: 'Cód. 03 fora do Top 3 e listado em descartadas',
        obtido: `Cód 03 no Top3=${has03} · Em descartadas=${inDiscarded}`,
        detalhe: `Cód 03 ativo=${has03} · Descartado=${inDiscarded}`,
      };
    },
  },
  {
    id: 27,
    nome: 'Investidor sem origem lícita comprovada',
    descricao: 'Gera alerta explícito exigindo comprovação da origem do capital.',
    answers: baseAnswers({ objetivo: 'empreender_investir', possuiCapitalComprovadoOrigem: false }),
    assertCheck: (res) => {
      const hasInvAlert = res.alertas.some((a) => a.toLowerCase().includes('origem lícita'));
      const ok = hasInvAlert && !res.top3.some((c) => c.visa.codigo === '13');
      return {
        pass: ok,
        esperado: 'Alerta de origem lícita e Cód. 13 não ativado',
        obtido: `Alerta origem=${hasInvAlert} · Cód 13 no Top3=${res.top3.some((c) => c.visa.codigo === '13')}`,
        detalhe: `Alerta origem=${hasInvAlert}`,
      };
    },
  },
  {
    id: 28,
    nome: 'Respostas contraditórias → Confiança Baixa',
    descricao: 'Localização no Brasil com entrada recente como turista sem saída detecta contradição e confiança Baixa.',
    answers: baseAnswers({ localizacao: 'No Brasil', entradaRecenteChileTurista: true }),
    assertCheck: (res) => {
      const ok = res.contradicoes.length > 0 && res.confianca === 'Baixa';
      return {
        pass: ok,
        esperado: 'Contradição detectada e Confiança = Baixa',
        obtido: `Contradições=${res.contradicoes.length} · Confiança=${res.confianca}`,
        detalhe: `Confiança=${res.confianca} (${res.contradicoes.length} contradição)`,
      };
    },
  },
  {
    id: 29,
    nome: 'Todas as respostas essenciais vazias',
    descricao: 'Solicita dados mínimos sem recomendar subcategoria nem inventar enquadramento.',
    answers: {
      nome: '',
      whatsapp: '',
      email: '',
      cidadeUf: '',
      origem: 'Site',
      localizacao: '' as DiagnosticAnswers['localizacao'],
      nacionalidadeBrasileira: null,
      possuiSegundaNacionalidade: null,
      passaporteValidadeMeses: 0,
      vinculoFamiliarChile: null,
      vinculoFormalizado: null,
      objetivo: '',
      possuiOfertaTrabalhoFormal: null,
      possuiMatriculaReconhecida: null,
      possuiRendaPassiva: null,
      possuiCapitalComprovadoOrigem: null,
      titularTemResidenciaChile: null,
      overstay: null,
      ordenAbandono: null,
      rejeicaoAnterior: null,
      antecedentesCriminais: null,
      familiaAcompanhante: null,
      quantidadeDependentes: 0,
      prazoPretendido: '1 a 3 meses',
      documentosJaPossui: [],
      lgpdAceito: false,
      lgpdVersao: '1.0',
    },
    assertCheck: (res) => {
      const ok = res.dadosInsuficientes === true && res.recomendada === null && res.top3.length === 0;
      return {
        pass: ok,
        esperado: 'dadosInsuficientes=true e recomendada=null',
        obtido: `dadosInsuficientes=${res.dadosInsuficientes} · recomendada=${res.recomendada ? res.recomendada.visa.codigo : 'null'}`,
        detalhe: `Sem recomendação (${res.mensagemDadosInsuficientes?.slice(0, 45) || 'ok'})`,
      };
    },
  },
  {
    id: 30,
    nome: 'Teste de regressão de alteração de regra',
    descricao: 'Confirma que alterar notaBase de uma regra altera efetivamente a nota final calculada.',
    answers: baseAnswers({ localizacao: 'No Brasil', objetivo: 'nomade_digital' }),
    assertCheck: (resDefault) => {
      const mutatedVersion = {
        ...DEFAULT_DIAGNOSTIC_RULE_VERSION,
        versao: 'v2.teste-regressao',
        regras: DEFAULT_DIAGNOSTIC_RULE_VERSION.regras.map((r) =>
          r.condicao === 'brasileiro_mercosul' ? { ...r, notaBase: 78 } : r,
        ),
      };
      const resMutated = runDiagnosticEngine(
        baseAnswers({ localizacao: 'No Brasil', objetivo: 'nomade_digital' }),
        undefined,
        undefined,
        undefined,
        { ruleVersion: mutatedVersion },
      );
      const ok =
        resDefault.recomendada !== null &&
        resMutated.recomendada !== null &&
        resDefault.recomendada.nota !== resMutated.recomendada.nota;
      return {
        pass: ok,
        esperado: 'Nota com regra alterada diferente da regra atual',
        obtido: `Atual=${resDefault.recomendada?.nota ?? 0} vs Regra Alterada(78)=${resMutated.recomendada?.nota ?? 0}`,
        detalhe: `Regra padrão=${resDefault.recomendada?.nota ?? 0} vs alterada=${resMutated.recomendada?.nota ?? 0}`,
      };
    },
  },
];
