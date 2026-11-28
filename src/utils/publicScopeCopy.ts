/**
 * Normalizes legacy seeded CMS copy (including previously persisted Firestore snapshots)
 * so outdated housing promises ("moradia garantida", "arriendo sem fiador local",
 * "chaves da sua casa") are transparently upgraded to D&M Integra Chile's real scope:
 * direct consultancy up to Visas (SERMIG), PDI and RUT, plus curated independent partner
 * referrals for complementary needs.
 *
 * Intentionally custom admin strings that do NOT match legacy over-scoped phrases are
 * returned unchanged.
 */

const EXACT_LEGACY_SCOPE_MAP: Record<string, string> = {
  // Hero
  'Mude-se para o Chile com segurança jurídica, moradia garantida e zero dor de cabeça burocrática.':
    'Conquiste seu visto, PDI e RUT no Chile com segurança jurídica e zero dor de cabeça burocrática.',
  'Imigração e relocation para o Chile com segurança jurídica e previsibilidade':
    'Conquiste seu visto, PDI e RUT no Chile com segurança jurídica e zero dor de cabeça burocrática.',
  'Conquiste sua residência no Chile com segurança, estratégia e tranquilidade.':
    'Conquiste seu visto, PDI e RUT no Chile com segurança jurídica e zero dor de cabeça burocrática.',
  'Do planejamento documental no Brasil (Vistos, PDI e RUT) à assinatura do seu contrato de arriendo sem fiador local: conduzimos cada etapa da sua mudança com rigor técnico e acolhimento.':
    'Do planejamento documental no Brasil ao protocolo no SERMIG, registro na PDI e emissão da Cédula (RUT): conduzimos sua regularização migratória com rigor técnico e indicamos parceiros selecionados para outras demandas.',
  'Da análise de elegibilidade pelo Acordo Mercosul e pela legislação chilena (Ley Nº 21.325) até a emissão da sua Cédula de Identidade chilena e adaptação completa no país.':
    'Do planejamento documental no Brasil ao protocolo no SERMIG, registro na PDI e emissão da Cédula (RUT): conduzimos sua regularização migratória com rigor técnico e indicamos parceiros selecionados para outras demandas.',
  'Da análise de elegibilidade pelo Acordo Mercosul e pela Lei 21.325 até a emissão da sua Cédula de Identidade chilena e adaptação completa no país.':
    'Do planejamento documental no Brasil ao protocolo no SERMIG, registro na PDI e emissão da Cédula (RUT): conduzimos sua regularização migratória com rigor técnico e indicamos parceiros selecionados para outras demandas.',
  'Protegemos sua família contra golpes, exigências inesperadas no SERMIG e contratos abusivos — com acompanhamento transparente do Brasil até você receber as chaves no Chile.':
    'Evitamos erros no SERMIG, documentos vencidos e exigências inesperadas — acompanhando cada etapa do Brasil até seu visto aprovado, PDI e RUT, com indicação de profissionais parceiros para moradia e outras etapas.',
  'Conduzimos cada fase com conferência documental criteriosa, controle rigoroso de prazos e acompanhamento transparente pelo Portal do Cliente.':
    'Evitamos erros no SERMIG, documentos vencidos e exigências inesperadas — acompanhando cada etapa do Brasil até seu visto aprovado, PDI e RUT, com indicação de profissionais parceiros para moradia e outras etapas.',
  'Apoio do visto ao arriendo sem fiador local':
    'Condução até Visto, PDI e RUT + indicação de parceiros',
  'Acompanhamento transparente em 15 etapas':
    'Condução até Visto, PDI e RUT + indicação de parceiros',

  // Serviços
  'Cuidamos da burocracia migratória e da sua instalação no Chile para você chegar com tudo legalizado, moradia segura e zero sustos.':
    'Cuidamos de toda a sua jornada migratória — do visto no Brasil ao registro na PDI e emissão do RUT — e conectamos você a parceiros indicados para as demais necessidades no Chile.',
  'Assessoria estruturada para profissionais, empreendedores, aposentados, estudantes e famílias brasileiras.':
    'Cuidamos de toda a sua jornada migratória — do visto no Brasil ao registro na PDI e emissão do RUT — e conectamos você a parceiros indicados para as demais necessidades no Chile.',
  'Chegada Segura, RUT e Moradia Sem Fiador Local':
    'Estampado Electrónico, Registro PDI, RUT e Indicação de Parceiros',
  'Relocation e Integração Pós-Chegada':
    'Estampado Electrónico, Registro PDI, RUT e Indicação de Parceiros',
  'Acompanhamos sua chegada na PDI, emissão da Cédula (RUT), ClaveÚnica, conta bancária e a negociação segura do seu contrato de arriendo em UF sem avalista chileno.':
    'Orientamos o Estampado Electrónico, o registro obrigatório na PDI e a emissão da Cédula (RUT). Para moradia, contabilidade, traduções ou saúde, indicamos profissionais parceiros independentes.',
  'Suporte completo no Estampado Electrónico, registro na PDI, Cédula de Identidade no Registro Civil, ClaveÚnica, RUT, abertura de conta bancária e busca de moradia.':
    'Orientamos o Estampado Electrónico, o registro obrigatório na PDI e a emissão da Cédula (RUT). Para moradia, contabilidade, traduções ou saúde, indicamos profissionais parceiros independentes.',

  // Diferenciais
  'Acompanhe cada etapa pelo Portal do Cliente e conte com corretores, cartórios e tradutores validados pela D&M para fugir de golpes e contratos abusivos.':
    'Acompanhe cada marco de Visto, PDI e RUT pelo Portal do Cliente e acesse nossa rede de profissionais parceiros indicados (imobiliárias, tradutores, cartórios, contadores e advogados) para outras situações.',
  'Envio seguro de documentos, cronograma personalizado de emissões, aprovação transparente de orçamentos e acesso direto a parceiros homologados no Brasil e no Chile.':
    'Acompanhe cada marco de Visto, PDI e RUT pelo Portal do Cliente e acesse nossa rede de profissionais parceiros indicados (imobiliárias, tradutores, cartórios, contadores e advogados) para outras situações.',

  // Como funciona
  'Da decisão no Brasil às chaves da sua casa no Chile, em 4 fases claras':
    'Da decisão no Brasil ao visto aprovado, PDI e RUT no Chile, em 4 fases claras',
  'Como funciona a jornada até sua residência no Chile':
    'Da decisão no Brasil ao visto aprovado, PDI e RUT no Chile, em 4 fases claras',
  'Visto Aprovado, PDI, RUT e Moradia':
    'Visto Aprovado, Registro na PDI e Emissão do RUT',
  'Acompanhamos o protocolo até o Estampado Electrónico, orientamos sua chegada na PDI, emissão do RUT e assinatura segura do seu arriendo.':
    'Acompanhamos o protocolo até o Estampado Electrónico, orientamos seu registro obrigatório na PDI e a emissão do RUT, além de indicar parceiros confiáveis para moradia e outras demandas.',

  // Quem somos
  'A D&M Integra Chile nasceu para proteger brasileiros do medo de cair em golpes, travar na burocracia do SERMIG ou não conseguir alugar um imóvel no Chile. Unimos precisão jurídica na legislação chilena a um atendimento próximo, transparente e 100% em português.':
    'A D&M Integra Chile nasceu para dar segurança a brasileiros em toda a regularização migratória — do enquadramento legal no Brasil ao visto no SERMIG, registro na PDI e emissão do RUT — além de conectar você a profissionais parceiros confiáveis para outras etapas da vida no Chile.',

  // Parceiros
  'Rede de Parceiros Homologados: profissionais testados e validados pela D&M para você não correr riscos com contratos, traduções ou imóveis no Chile.':
    'Nossa assessoria acompanha até Vistos, PDI e RUT. Para outras necessidades no Brasil e no Chile, indicamos profissionais parceiros independentes em imobiliária, tradução, cartório, contabilidade, advocacia e saúde.',
  'Corretores preparados para arriendo em UF sem avalista local, tradutores juramentados, cartórios e contadores selecionados a dedo para proteger seu patrimônio.':
    'Profissionais independentes indicados pela D&M para apoiar você em imóveis, traduções juramentadas, cartórios, abertura de empresa (SpA), seguros e educação — com contratação direta e transparente.',

  // Rodapé
  'Acompanhamento jurídico e humano para brasileiros que querem viver no Chile com segurança, moradia certa e zero dor de cabeça burocrática.':
    'Assessoria migratória especializada do Brasil ao Chile — conduzindo seu Visto (SERMIG), registro na PDI e emissão do RUT, com indicação de parceiros qualificados para outras situações.',
};

/**
 * Checks whether a string contains legacy false housing promises that violate
 * D&M Integra Chile's true consultancy scope (Visas, PDI, RUT + partner referrals).
 */
export function hasLegacyHousingPromise(text: string | undefined): boolean {
  if (!text) return false;
  return /moradia garantida|moradia certa|arriendo sem fiador|sem fiador local|sem avalista chileno|chaves da sua casa|receber as chaves no chile|entrega das chaves no chile|do brasil ao arriendo/i.test(
    text,
  );
}

/**
 * Normalizes any legacy over-scoped Portuguese copy to accurately reflect
 * Visas + PDI + RUT direct scope and independent partner referrals.
 */
export function normalizePublicScopeText(text: string | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  const exact = EXACT_LEGACY_SCOPE_MAP[trimmed];
  if (exact) return exact;

  if (!hasLegacyHousingPromise(text)) {
    return text;
  }

  return text
    .replace(/moradia garantida/gi, 'visto, PDI e RUT organizados')
    .replace(/moradia certa/gi, 'visto, PDI e RUT em dia')
    .replace(/arriendo sem fiador local/gi, 'indicação de parceiros imobiliários no Chile')
    .replace(/sem fiador local/gi, 'com indicação de parceiros independentes')
    .replace(/sem avalista chileno/gi, 'com apoio de parceiros independentes')
    .replace(/às chaves da sua casa no Chile/gi, 'ao visto aprovado, PDI e RUT no Chile')
    .replace(/até você receber as chaves no Chile/gi, 'até seu visto aprovado, PDI e RUT no Chile')
    .replace(/até a entrega das chaves no Chile/gi, 'até seu visto aprovado, PDI e RUT no Chile')
    .replace(/Do Brasil ao Arriendo/gi, 'Do Brasil ao Visto, PDI e RUT');
}
