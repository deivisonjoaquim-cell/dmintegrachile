/**
 * Normalizes legacy seeded CMS copy (including previously persisted Firestore snapshots)
 * so outdated housing promises ("moradia garantida", "arriendo sem fiador local",
 * "chaves da sua casa") and PDI mentions are transparently upgraded to D&M Integra Chile's
 * exact scope: direct consultancy up to Visas (SERMIG) and RUT, plus curated independent
 * partner referrals for complementary needs.
 *
 * Intentionally custom admin strings that do NOT match legacy over-scoped phrases or PDI
 * are returned unchanged.
 */

const EXACT_LEGACY_SCOPE_MAP: Record<string, string> = {
  // Hero
  'Mude-se para o Chile com segurança jurídica, moradia garantida e zero dor de cabeça burocrática.':
    'Assessoria exclusiva de imigração para o Chile: seu visto e RUT com segurança jurídica.',
  'Imigração e relocation para o Chile com segurança jurídica e previsibilidade':
    'Assessoria exclusiva de imigração para o Chile: seu visto e RUT com segurança jurídica.',
  'Conquiste sua residência no Chile com segurança, estratégia e tranquilidade.':
    'Assessoria exclusiva de imigração para o Chile: seu visto e RUT com segurança jurídica.',
  'Assessoria exclusiva de imigração para o Chile: seu visto, PDI e RUT com segurança jurídica.':
    'Assessoria exclusiva de imigração para o Chile: seu visto e RUT com segurança jurídica.',
  'Do planejamento documental no Brasil (Vistos, PDI e RUT) à assinatura do seu contrato de arriendo sem fiador local: conduzimos cada etapa da sua mudança com rigor técnico e acolhimento.':
    'Atuamos exclusivamente na regularização migratória — do protocolo no SERMIG à emissão do RUT. A moradia não é um serviço garantido; oferecemos indicação curada de parceiros imobiliários de confiança.',
  'Da análise de elegibilidade pelo Acordo Mercosul e pela legislação chilena (Ley Nº 21.325) até a emissão da sua Cédula de Identidade chilena e adaptação completa no país.':
    'Atuamos exclusivamente na regularização migratória — do protocolo no SERMIG à emissão do RUT. A moradia não é um serviço garantido; oferecemos indicação curada de parceiros imobiliários de confiança.',
  'Da análise de elegibilidade pelo Acordo Mercosul e pela Lei 21.325 até a emissão da sua Cédula de Identidade chilena e adaptação completa no país.':
    'Atuamos exclusivamente na regularização migratória — do protocolo no SERMIG à emissão do RUT. A moradia não é um serviço garantido; oferecemos indicação curada de parceiros imobiliários de confiança.',
  'Protegemos sua família contra golpes, exigências inesperadas no SERMIG e contratos abusivos — com acompanhamento transparente do Brasil até você receber as chaves no Chile.':
    'Evitamos erros no SERMIG, documentos vencidos e exigências inesperadas — conduzindo exclusivamente sua assessoria de imigração (Visto e RUT) e servindo como ponte transparente para parceiros de confiança.',
  'Conduzimos cada fase com conferência documental criteriosa, controle rigoroso de prazos e acompanhamento transparente pelo Portal do Cliente.':
    'Evitamos erros no SERMIG, documentos vencidos e exigências inesperadas — conduzindo exclusivamente sua assessoria de imigração (Visto e RUT) e servindo como ponte transparente para parceiros de confiança.',
  'Apoio do visto ao arriendo sem fiador local':
    'Atuação exclusiva em Visto e RUT · Ponte curada de parceiros',
  'Acompanhamento transparente em 15 etapas':
    'Atuação exclusiva em Visto e RUT · Ponte curada de parceiros',

  // Serviços
  'Escopo claro: do visto no Brasil ao registro na PDI e emissão do RUT':
    'Atuação exclusiva em imigração: do visto no Brasil à emissão do RUT',
  'Atuação exclusiva em imigração: do visto no Brasil ao registro na PDI e emissão do RUT':
    'Atuação exclusiva em imigração: do visto no Brasil à emissão do RUT',
  'Cuidamos de toda a sua jornada migratória — do visto no Brasil ao registro na PDI e emissão do RUT — e conectamos você a parceiros indicados para as demais necessidades no Chile.':
    'Nosso serviço contratado é 100% dedicado à assessoria de imigração (Visto SERMIG e RUT). Moradia não é serviço garantido — conectamos você a parceiros imobiliários e especialistas de confiança.',
  'Cuidamos da burocracia migratória e da sua instalação no Chile para você chegar com tudo legalizado, moradia segura e zero sustos.':
    'Nosso serviço contratado é 100% dedicado à assessoria de imigração (Visto SERMIG e RUT). Moradia não é serviço garantido — conectamos você a parceiros imobiliários e especialistas de confiança.',
  'Assessoria estruturada para profissionais, empreendedores, aposentados, estudantes e famílias brasileiras.':
    'Nosso serviço contratado é 100% dedicado à assessoria de imigração (Visto SERMIG e RUT). Moradia não é serviço garantido — conectamos você a parceiros imobiliários e especialistas de confiança.',
  'Chegada Segura, RUT e Moradia Sem Fiador Local':
    'Estampado Electrónico, Emissão do RUT e Ponte de Indicação',
  'Relocation e Integração Pós-Chegada':
    'Estampado Electrónico, Emissão do RUT e Ponte de Indicação',
  'Estampado Electrónico, Registro PDI, RUT e Indicação de Parceiros':
    'Estampado Electrónico, Emissão do RUT e Ponte de Indicação',
  'Estampado Electrónico, Registro PDI, RUT e Ponte de Indicação':
    'Estampado Electrónico, Emissão do RUT e Ponte de Indicação',
  'Acompanhamos sua chegada na PDI, emissão da Cédula (RUT), ClaveÚnica, conta bancária e a negociação segura do seu contrato de arriendo em UF sem avalista chileno.':
    'Orientamos o Estampado Electrónico e a emissão da Cédula de Identidade (RUT). Moradia não é serviço garantido: oferecemos indicação curada de parceiros imobiliários e especialistas independentes.',
  'Suporte completo no Estampado Electrónico, registro na PDI, Cédula de Identidade no Registro Civil, ClaveÚnica, RUT, abertura de conta bancária e busca de moradia.':
    'Orientamos o Estampado Electrónico e a emissão da Cédula de Identidade (RUT). Moradia não é serviço garantido: oferecemos indicação curada de parceiros imobiliários e especialistas independentes.',
  'Orientamos o Estampado Electrónico, o registro obrigatório na PDI e a emissão da Cédula (RUT). Para moradia, contabilidade, traduções ou saúde, indicamos profissionais parceiros independentes.':
    'Orientamos o Estampado Electrónico e a emissão da Cédula de Identidade (RUT). Moradia não é serviço garantido: oferecemos indicação curada de parceiros imobiliários e especialistas independentes.',

  // Diferenciais
  'Acompanhe cada etapa pelo Portal do Cliente e conte com corretores, cartórios e tradutores validados pela D&M para fugir de golpes e contratos abusivos.':
    'Acompanhe cada marco de Visto e RUT pelo Portal do Cliente e acesse nossa rede de profissionais parceiros indicados (imobiliárias, tradutores, cartórios, contadores e advogados) para outras situações.',
  'Envio seguro de documentos, cronograma personalizado de emissões, aprovação transparente de orçamentos e acesso direto a parceiros homologados no Brasil e no Chile.':
    'Acompanhe cada marco de Visto e RUT pelo Portal do Cliente e acesse nossa rede de profissionais parceiros indicados (imobiliárias, tradutores, cartórios, contadores e advogados) para outras situações.',

  // Como funciona
  'Da decisão no Brasil às chaves da sua casa no Chile, em 4 fases claras':
    'Da decisão no Brasil ao visto aprovado e RUT no Chile, em 4 fases claras',
  'Como funciona a jornada até sua residência no Chile':
    'Da decisão no Brasil ao visto aprovado e RUT no Chile, em 4 fases claras',
  'Visto Aprovado, PDI, RUT e Moradia':
    'Visto Aprovado e Emissão do RUT',
  'Visto Aprovado, Registro na PDI e Emissão do RUT':
    'Visto Aprovado e Emissão do RUT',
  'Acompanhamos o protocolo até o Estampado Electrónico, orientamos sua chegada na PDI, emissão do RUT e assinatura segura do seu arriendo.':
    'Acompanhamos o protocolo até o Estampado Electrónico e orientamos a emissão do seu RUT, além de indicar parceiros confiáveis para moradia e outras demandas.',

  // Quem somos
  'A D&M Integra Chile nasceu para proteger brasileiros do medo de cair em golpes, travar na burocracia do SERMIG ou não conseguir alugar um imóvel no Chile. Unimos precisão jurídica na legislação chilena a um atendimento próximo, transparente e 100% em português.':
    'A D&M Integra Chile atua exclusivamente na assessoria de imigração do Brasil ao Chile — conduzindo Vistos (SERMIG) e emissão do RUT com rigor jurídico. Moradia não é um serviço garantido: oferecemos indicação curada de parceiros imobiliários e especialistas de confiança.',
  'Especialização e Escopo de Atuação':
    'Atuação Exclusiva em Assessoria de Imigração',
  'Com base e atendimento no Brasil, prestamos assessoria completa e fundamentada na legislação migratória vigente para trâmites de Residência Temporal, Acordo Mercosul, Reunificação Familiar e Relocation em qualquer região do Chile.\nAtuação pautada pela análise criteriosa de requisitos, preparação documental prévia à mudança e mitigação de riscos administrativos.':
    'Atuamos exclusivamente na assessoria de imigração do Brasil para o Chile — conduzindo trâmites de Residência Temporal, Acordo Mercosul, Reunificação Familiar, Estampado Electrónico e emissão da Cédula (RUT).\nA moradia não é um serviço garantido pela D&M Integra Chile: atuamos apenas como ponte de indicação curada para parceiros imobiliários, tradutores, contadores e advogados independentes de confiança.',

  // Parceiros
  'Rede de Parceiros Homologados: profissionais testados e validados pela D&M para você não correr riscos com contratos, traduções ou imóveis no Chile.':
    'Atuamos exclusivamente na assessoria de imigração (Visto e RUT). Moradia não é serviço garantido — servimos apenas como ponte de indicação curada para parceiros imobiliários e especialistas independentes.',
  'Corretores preparados para arriendo em UF sem avalista local, tradutores juramentados, cartórios e contadores selecionados a dedo para proteger seu patrimônio.':
    'Profissionais independentes validados pela curadoria D&M para apoiar você em imóveis, traduções juramentadas, contabilidade SpA e contratos — sempre com contratação direta e transparente.',

  // Rodapé
  'Acompanhamento jurídico e humano para brasileiros que querem viver no Chile com segurança, moradia certa e zero dor de cabeça burocrática.':
    'Atuação exclusiva em assessoria de imigração Brasil–Chile (Visto SERMIG e emissão do RUT). Moradia não é um serviço garantido — oferecemos indicação curada de parceiros imobiliários de confiança.',
  'Assessoria migratória especializada do Brasil ao Chile — conduzindo seu Visto (SERMIG), registro na PDI e emissão do RUT, com indicação de parceiros qualificados para outras situações.':
    'Atuação exclusiva em assessoria de imigração Brasil–Chile (Visto SERMIG e emissão do RUT). Moradia não é um serviço garantido — oferecemos indicação curada de parceiros imobiliários de confiança.',
};

/**
 * Checks whether a string contains legacy false housing promises that violate
 * D&M Integra Chile's true consultancy scope (Visto e RUT + partner referrals).
 */
export function hasLegacyHousingPromise(text: string | undefined): boolean {
  if (!text) return false;
  return /moradia garantida|moradia certa|arriendo sem fiador|sem fiador local|sem avalista chileno|chaves da sua casa|receber as chaves no chile|entrega das chaves no chile|do brasil ao arriendo/i.test(
    text,
  );
}

/**
 * Checks whether a string still references PDI in public-facing copy.
 */
export function hasLegacyPdiReference(text: string | undefined): boolean {
  if (!text) return false;
  return /\bPDI\b/i.test(text);
}

function stripPdiReferences(text: string): string {
  return text
    .replace(/,\s*registro obrigat[oó]rio na PDI\s*e\s*/gi, ' e ')
    .replace(/,\s*o registro obrigat[oó]rio na PDI\s*e\s*/gi, ' e ')
    .replace(/,\s*registro na PDI\s*e\s*/gi, ' e ')
    .replace(/\bao registro na PDI\s*e\s*/gi, 'à ')
    .replace(/,\s*Registro PDI,\s*/gi, ', ')
    .replace(/\bRegistro na PDI\s*(?:e|&)\s*/gi, '')
    .replace(/\bRegistro PDI\s*(?:e|&)\s*/gi, '')
    .replace(/\bPDI\s*&\s*RUT\b/gi, 'RUT')
    .replace(/,\s*PDI\s*e\s*RUT\b/gi, ' e RUT')
    .replace(/,\s*PDI\s*&\s*RUT\b/gi, ' e RUT')
    .replace(/,\s*PDI\s*y\s*RUT\b/gi, ' y RUT')
    .replace(/\bPDI\s*e\s*RUT\b/gi, 'Visto e RUT')
    .replace(/\bPDI\s*y\s*RUT\b/gi, 'Visa y RUT')
    .replace(/,\s*PDI\s*e\s*/gi, ' e ')
    .replace(/,\s*PDI\s*y\s*/gi, ' y ')
    .replace(/,\s*PDI,\s*/gi, ', ')
    .replace(/\s*·\s*PDI\b/gi, '')
    .replace(/\bSERMIG\s*\/\s*PDI\b/gi, 'SERMIG')
    .replace(/\bSERMIG\s+e\s+da\s+PDI\b/gi, 'SERMIG')
    .replace(/\bPDI\s*\/\s*C[eé]dula\b/gi, 'Cédula')
    .replace(/\bna PDI\b/gi, 'no Chile')
    .replace(/\bda PDI\b/gi, 'do SERMIG')
    .replace(/\bPDI\b/gi, 'SERMIG');
}

/**
 * Normalizes any legacy over-scoped Portuguese/Spanish copy or PDI mentions
 * to accurately reflect Visto + RUT direct scope and independent partner referrals.
 */
export function normalizePublicScopeText(text: string | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  const exact = EXACT_LEGACY_SCOPE_MAP[trimmed];
  if (exact) return exact;

  let out = text;

  if (hasLegacyHousingPromise(out)) {
    out = out
      .replace(/moradia garantida/gi, 'visto e RUT organizados')
      .replace(/moradia certa/gi, 'visto e RUT em dia')
      .replace(/arriendo sem fiador local/gi, 'indicação de parceiros imobiliários no Chile')
      .replace(/sem fiador local/gi, 'com indicação de parceiros independentes')
      .replace(/sem avalista chileno/gi, 'com apoio de parceiros independentes')
      .replace(/às chaves da sua casa no Chile/gi, 'ao visto aprovado e RUT no Chile')
      .replace(/até você receber as chaves no Chile/gi, 'até seu visto aprovado e RUT no Chile')
      .replace(/até a entrega das chaves no Chile/gi, 'até seu visto aprovado e RUT no Chile')
      .replace(/Do Brasil ao Arriendo/gi, 'Do Brasil ao Visto e RUT');
  }

  if (hasLegacyPdiReference(out)) {
    out = stripPdiReferences(out);
  }

  return out;
}
