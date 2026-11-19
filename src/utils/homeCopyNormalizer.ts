import { DEFAULT_AVISO_LEGAL, SEED_SITE_CONTENT } from '../data/seeds';
import type { SiteContent, SiteSectionKey } from '../types/domain';

const LEGACY_TEXT_UPGRADES: Record<string, string> = {
  // Hero
  'Assessoria migratória e relocation para brasileiros no Chile com segurança jurídica e previsibilidade':
    'Imigração e relocation para o Chile com segurança jurídica e previsibilidade',
  'Da análise de elegibilidade pelo Acordo Mercosul e Ley 21.325 até a obtenção da sua Cédula de Identidade chilena e adaptação completa em Santiago.':
    'Da análise de elegibilidade pelo Acordo Mercosul e pela Ley 21.325 até a emissão da sua Cédula de Identidade chilena e adaptação completa no país.',
  'Conduzimos cada etapa com conferência documental rigorosa, cronograma inteligente de validades e acompanhamento transparente no Portal do Cliente.':
    'Conduzimos cada fase com conferência documental criteriosa, controle rigoroso de prazos e acompanhamento transparente pelo Portal do Cliente.',
  'Atendimento 100% em português do Brasil': 'Atendimento integral em português do Brasil',
  'Base normativa alinhada à Ley 21.325 e SERMIG': 'Base normativa alinhada à Ley 21.325 e ao SERMIG',

  // Serviços
  'Soluções completas de imigração e estabelecimento no Chile':
    'Soluções completas para imigração e estabelecimento no Chile',
  'Serviços desenhados para profissionais, empreendedores, aposentados, estudantes e famílias brasileiras.':
    'Assessoria estruturada para profissionais, empreendedores, aposentados, estudantes e famílias brasileiras.',
  'Residência Temporal (Acordo Mercosul e Subcategorias)':
    'Residência Temporal — Acordo Mercosul e Subcategorias',
  'Enquadramento preciso sob o Art. 70 nº 13 da Ley 21.325 (Reciprocidade Mercosul), trabalho com oferta formal, rentistas, investidores, estudantes e reunificação familiar.':
    'Enquadramento técnico conforme a Ley 21.325 (incluindo o Acordo Mercosul, Art. 70, nº 13), abrangendo trabalho com oferta formal, rentistas, investidores, estudantes e reunificação familiar.',
  'Monitoramento automático da janela legal (90 a 10 dias antes do vencimento), ratificação e transição estruturada para a Residência Definitiva.':
    'Monitoramento preventivo da janela legal (de 90 a 10 dias antes do vencimento), ratificação de dados e transição segura para a Residência Definitiva.',
  'Cronograma reverso que protege a validade de 60 dias dos Antecedentes da Polícia Federal e coordena cartórios e tradutores homologados.':
    'Cronograma reverso que preserva o prazo de 60 dias dos Antecedentes da Polícia Federal, coordenando cartórios, Apostila de Haia e tradutores juramentados.',
  'Relocation Completo Pós-Chegada': 'Relocation e Integração Pós-Chegada',
  'Acompanhamento de Estampado Electrónico, registro PDI, Cédula de Identidade no Registro Civil, ClaveÚnica, abertura de conta bancária, RUT e locação.':
    'Suporte completo no Estampado Electrónico, registro na PDI, Cédula de Identidade no Registro Civil, ClaveÚnica, RUT, abertura de conta bancária e busca de moradia.',

  // Diferenciais
  'Por que confiar sua mudança à D&M Integra Chile':
    'Por que conduzir sua mudança com a D&M Integra Chile',
  'Rigor técnico para evitar exigências do SERMIG, vencimento de certidões e indeferimentos.':
    'Rigor técnico e planejamento preventivo para evitar exigências do SERMIG, perda de validade de certidões e indeferimentos.',
  'Verificamos se o protocolo deve ocorrer do exterior ou se há hipótese legal dentro do Chile, prevenindo alertas migratórios e Orden de Abandono.':
    'Avaliamos se o pedido deve ser protocolado a partir do exterior ou se há hipótese legal de solicitação no Chile, prevenindo exigências administrativas e notificações de saída.',
  'Cada documento possui peso e conferência por etapas, bloqueando protocolos incompletos que atrasariam sua aprovação.':
    'Cada certidão é verificada por critérios técnicos e pesos de obrigatoriedade, impedindo protocolos incompletos que comprometeriam o prazo de aprovação.',
  'Envio seguro de arquivos, cronograma de emissões, aprovação transparente de orçamentos e conexão com parceiros recomendados no Brasil e no Chile.':
    'Envio seguro de documentos, cronograma personalizado de emissões, aprovação transparente de orçamentos e acesso direto a parceiros homologados no Brasil e no Chile.',

  // Como funciona
  'Um fluxo previsível em quatro momentos principais.':
    'Um processo estruturado em quatro etapas claras, do enquadramento inicial à emissão da Cédula.',
  'Diagnóstico Inteligente': 'Diagnóstico Orientativo',
  'Você responde ao questionário em 6 etapas e recebe uma pré-análise orientativa com subcategorias elegíveis e pré-checklist.':
    'Você preenche o questionário em 6 etapas e recebe uma pré-análise estruturada com as subcategorias elegíveis e o pré-checklist documental.',
  'Nossa equipe valida vínculos, prazos e riscos individuais, formaliza o plano e libera o seu acesso ao Portal do Cliente.':
    'Nossa equipe valida vínculos, prazos e particularidades do seu perfil, formaliza o plano de atuação e libera seu acesso ao Portal do Cliente.',
  'Organizamos a emissão na ordem exata de prazos, conferimos cada certidão e coordenamos apostilas e traduções.':
    'Definimos a ordem exata de emissão das certidões, conferimos cada arquivo e coordenamos apostilamentos e traduções juramentadas.',
  'Acompanhamos o trâmite até o Estampado Electrónico, entrada no Chile dentro da janela de 90 dias e emissão da Cédula.':
    'Acompanhamos toda a tramitação até o Estampado Electrónico, orientamos o ingresso no Chile dentro do prazo de 90 dias e apoiamos a emissão da Cédula.',

  // Quem somos
  'Especialistas dedicados à ponte Brasil – Chile':
    'Especialistas dedicados à jornada Brasil–Chile',
  'Consultoria boutique focada em segurança operacional, clareza jurídica e atendimento humanizado.':
    'Assessoria personalizada com foco em segurança operacional, clareza jurídica e atendimento próximo.',
  'Consultoria especializada com foco em segurança operacional, clareza jurídica e atendimento próximo.':
    'Assessoria personalizada com foco em segurança operacional, clareza jurídica e atendimento próximo.',
  'Atuação conforme Ley Nº 21.325 · Decreto Nº 177/2022 · Acordo de Residência Mercosul · Conformidade LGPD.':
    'Atuação alinhada à Ley Nº 21.325, ao Decreto Nº 177/2022, ao Acordo de Residência Mercosul e à LGPD.',

  // Parceiros (corrige concordância nominal "Profissionais e empresas verificadas")
  'Rede de Parceiros Homologados Brasil – Chile':
    'Rede de Parceiros Homologados Brasil–Chile',
  'Profissionais e empresas verificadas pela consultoria para apoiar cada etapa da sua mudança.':
    'Profissionais e empresas verificados pela consultoria para apoiar cada etapa da sua mudança.',
  'Ver parceiros ou ser parceiro': 'Explorar rede de parceiros',

  // FAQ (corrige concordância e precisão normativa)
  'Brasileiros podem solicitar o Visto Mercosul já estando como turistas no Chile?':
    'Brasileiros podem solicitar a Residência Mercosul estando como turistas no Chile?',
  'Pela regra geral da Ley 21.325 e do Decreto 177/2022, a primeira Residência Temporal por Reciprocidade Internacional/Mercosul deve ser solicitada a partir do exterior. Quem está como turista sem vínculo familiar formalizado ou razão humanitária precisa sair do Chile para protocolar.':
    'Pela regra geral da Ley 21.325 e do Decreto 177/2022, a primeira Residência Temporal por Reciprocidade Internacional (Acordo Mercosul) deve ser solicitada a partir do exterior. Quem se encontra no Chile como turista, sem vínculo familiar formalizado ou hipótese humanitária prevista em lei, precisa sair do território chileno para protocolar o pedido.',
  'O Visto Mercosul exige contrato de trabalho prévio ou comprovação de renda alta?':
    'A Residência Mercosul exige contrato de trabalho prévio ou comprovação de renda?',
  'Não. A subcategoria de Reciprocidade Internacional/Mercosul permite trabalhar licitamente no Chile após a concessão e não exige oferta formal de emprego nem comprovação de renda passiva como requisito de elegibilidade.':
    'Não. A subcategoria de Reciprocidade Internacional (Mercosul) autoriza o exercício de atividade laboral regular no Chile após a concessão e não exige oferta prévia de emprego nem comprovação de renda passiva como requisito de elegibilidade.',
  'Para fins migratórios no Chile, o Certificado de Antecedentes Criminais emitido pela Polícia Federal e apostilado deve ter sido emitido há no máximo 60 dias na data do protocolo no SERMIG. Por isso geramos um cronograma reverso de emissão.':
    'Para fins migratórios no Chile, o Certificado de Antecedentes Criminais da Polícia Federal — devidamente apostilado — deve ter sido emitido há no máximo 60 dias na data do protocolo no SERMIG. Por isso, estruturamos um cronograma reverso para cada emissão.',
  'Como regra geral da Subcategoria Mercosul e da maioria das residências temporais, após 24 meses de residência regular (observando prazos de ausência do país e janela de prorrogação/definitiva entre 90 e 10 dias antes do vencimento), torna-se elegível à Residência Definitiva.':
    'Como regra geral para o Acordo Mercosul e a maioria das residências temporais, após 24 meses de residência regular no Chile — respeitados os limites de ausência do país e a janela legal de 90 a 10 dias antes do vencimento — o titular torna-se elegível à Residência Definitiva.',

  // Contato / CTA final
  'Pronto para estruturar sua mudança para o Chile?':
    'Pronto para planejar sua mudança para o Chile com segurança?',
  'Inicie pelo diagnóstico gratuito ou fale diretamente com nossa equipe técnica.':
    'Comece pelo diagnóstico gratuito ou converse diretamente com nossa consultoria especializada.',

  // Rodapé e aviso legal
  'Este sistema auxilia a gestão do processo migratório e não substitui a análise individual do consultor; regras e prazos estão sujeitos a alterações pelo SERMIG.':
    DEFAULT_AVISO_LEGAL,
  'Área da equipe': 'Área da Equipe',
  'Consultoria especializada em imigração e relocation Brasil – Chile.':
    'Consultoria especializada em imigração e relocation Brasil–Chile.',
  'Consultoria especializada em processos migratórios Brasil – Chile.':
    'Consultoria especializada em processos migratórios Brasil–Chile.',
};

export function upgradeLegacyCopyString(value?: string): string | undefined {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const exact = LEGACY_TEXT_UPGRADES[trimmed];
  if (exact !== undefined) return exact;
  if (/\bconsultoria\s+boutique\b/i.test(value)) {
    return value.replace(/\b(C|c)onsultoria\s+boutique\b/g, (_match, firstChar: string) =>
      firstChar === 'C' ? 'Assessoria personalizada' : 'assessoria personalizada',
    );
  }
  return value;
}

function upgradeRecordStrings<T extends Record<string, unknown>>(item: T): T {
  let changed = false;
  const next: Record<string, unknown> = { ...item };
  for (const [k, v] of Object.entries(item)) {
    if (typeof v === 'string') {
      const upgraded = upgradeLegacyCopyString(v);
      if (upgraded !== v) {
        next[k] = upgraded;
        changed = true;
      }
    }
  }
  return changed ? (next as T) : item;
}

/**
 * Atualiza de forma não destrutiva apenas textos legados que ainda correspondem
 * exatamente aos textos padrão anteriores, preservando integralmente qualquer edição
 * personalizada realizada pelo administrador.
 */
export function upgradeLegacySiteContentCopy(row: SiteContent): SiteContent {
  const nextTitulo = upgradeLegacyCopyString(row.titulo) ?? row.titulo;
  const nextSubtitulo = upgradeLegacyCopyString(row.subtitulo) ?? row.subtitulo;
  const nextHtml = upgradeLegacyCopyString(row.conteudoHtml) ?? row.conteudoHtml;
  const nextCta = upgradeLegacyCopyString(row.ctaTexto);

  let nextMeta = row.metadados;
  if (row.metadados && typeof row.metadados === 'object') {
    const metaCopy: Record<string, unknown> = { ...row.metadados };
    let metaChanged = false;

    for (const [key, val] of Object.entries(metaCopy)) {
      if (typeof val === 'string') {
        const up = upgradeLegacyCopyString(val);
        if (up !== val) {
          metaCopy[key] = up;
          metaChanged = true;
        }
      } else if (Array.isArray(val)) {
        const mapped = val.map((entry) => {
          if (typeof entry === 'string') return upgradeLegacyCopyString(entry) ?? entry;
          if (entry && typeof entry === 'object') {
            return upgradeRecordStrings(entry as Record<string, unknown>);
          }
          return entry;
        });
        if (mapped.some((m, idx) => m !== val[idx])) {
          metaCopy[key] = mapped;
          metaChanged = true;
        }
      }
    }

    if (metaChanged) {
      nextMeta = metaCopy;
    }
  }

  if (
    nextTitulo === row.titulo &&
    nextSubtitulo === row.subtitulo &&
    nextHtml === row.conteudoHtml &&
    nextCta === row.ctaTexto &&
    nextMeta === row.metadados
  ) {
    return row;
  }

  return {
    ...row,
    titulo: nextTitulo,
    subtitulo: nextSubtitulo,
    conteudoHtml: nextHtml,
    ...(nextCta !== undefined ? { ctaTexto: nextCta } : {}),
    ...(nextMeta !== undefined ? { metadados: nextMeta } : {}),
  };
}

export function getSeedSectionFallback(secao: SiteSectionKey): SiteContent | undefined {
  return SEED_SITE_CONTENT.find((s) => s.secao === secao);
}
