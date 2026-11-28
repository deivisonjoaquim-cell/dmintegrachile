import type { EmpresaConfig } from '../types/domain';

export interface OfficeOperationSlide {
  id: string;
  imageUrl: string;
  alt: string;
  title: string;
  description: string;
  routineTag: string;
  locationLabel: string;
}

export interface AboutTestimonial {
  id: string;
  nome: string;
  origemDestino: string;
  rotaServico: string;
  depoimento: string;
}

export const OFFICE_OPERATIONS_SLIDES: OfficeOperationSlide[] = [
  {
    id: 'consultoria-alinhamento',
    imageUrl: '/src/assets/images/founder_office_client_call_1795706903356.jpg',
    alt: 'Reunião individual de consultoria migratória por vídeo no escritório da D&M Integra Chile',
    title: 'Atendimento consultivo e desenho do plano migratório',
    description:
      'Conversas individuais para entender o momento da sua família, comparar os caminhos legais disponíveis e definir um cronograma realista antes da passagem.',
    routineTag: 'Enquadramento & Estratégia',
    locationLabel: 'Brasil — Chile',
  },
  {
    id: 'auditoria-documental',
    imageUrl: '/src/assets/images/founder_office_document_review_1795706904668.jpg',
    alt: 'Conferência técnica de certidões, Apostilas de Haia e contratos no escritório',
    title: 'Auditoria documental folha a folha antes do protocolo',
    description:
      'Revisão minuciosa de certidões brasileiras, Apostilas de Haia, traduções juramentadas e comprovantes para eliminar exigências e retrabalhos no SERMIG.',
    routineTag: 'Conformidade Documental',
    locationLabel: 'Pré-Protocolo',
  },
  {
    id: 'gestao-sermig',
    imageUrl: '/src/assets/images/founder_office_desk_work_1795706900230.jpg',
    alt: 'Acompanhamento digital de processos migratórios no portal do SERMIG no escritório',
    title: 'Gestão contínua de prazos e protocolos no SERMIG',
    description:
      'Monitoramento ativo de cada movimentação do visto, registro na PDI e emissão da Cédula de Identidade (RUT), mantendo o cliente informado sem surpresas.',
    routineTag: 'SERMIG · PDI & RUT',
    locationLabel: 'Operação Diária',
  },
  {
    id: 'rede-parceiros-indicados',
    imageUrl: '/src/assets/images/advisory_boardroom_minimal_1795699453098.jpg',
    alt: 'Sala executiva utilizada para curadoria e conexão com profissionais parceiros no Brasil e no Chile',
    title: 'Curadoria e indicação de profissionais parceiros',
    description:
      'Nossa atuação direta vai até Vistos, PDI e RUT. Para imóveis, traduções juramentadas, cartórios, contabilidade ou seguros, conectamos você a parceiros independentes avaliados.',
    routineTag: 'Rede de Parceiros Indicados',
    locationLabel: 'Brasil & Chile',
  },
  {
    id: 'dossie-lgpd',
    imageUrl: '/src/assets/images/consultancy_atelier_desk_1795635434902.jpg',
    alt: 'Mesa de trabalho com organização de dossiês físicos e digitais de clientes em mudança ao Chile',
    title: 'Dossiês organizados e sigilo absoluto em cada etapa',
    description:
      'Centralização dos documentos aprovados no Portal do Cliente sob rigorosa proteção de dados (LGPD), garantindo clareza do planejamento no Brasil à emissão do seu RUT no Chile.',
    routineTag: 'Portal do Cliente · LGPD',
    locationLabel: 'Governança',
  },
];

export const CURATED_ABOUT_TESTIMONIALS: AboutTestimonial[] = [
  {
    id: 'curated-camila-rafael',
    nome: 'Camila & Rafael Nogueira',
    origemDestino: 'Curitiba → Providencia, Santiago',
    rotaServico: 'Residência Mercosul · PDI & RUT',
    depoimento:
      'Chegamos ao Chile com duas crianças e muito receio de errar na papelada do SERMIG. A D&M organizou cada apostila ainda no Brasil, conduziu nosso visto, PDI e RUT com precisão e ainda nos indicou parceiros sérios para as demais etapas.',
  },
  {
    id: 'curated-eduardo-vasconcelos',
    nome: 'Eduardo Vasconcelos',
    origemDestino: 'São Paulo → Las Condes, Santiago',
    rotaServico: 'Residência Temporal · PDI & RUT',
    depoimento:
      'O diferencial foi falar com quem realmente domina as regras chilenas e explica tudo sem juridiquês. Acompanhei cada etapa pelo portal com previsibilidade total e tirei meu visto e meu RUT dentro do prazo da minha empresa.',
  },
  {
    id: 'curated-fernanda-alencar',
    nome: 'Fernanda Alencar',
    origemDestino: 'Belo Horizonte → Viña del Mar',
    rotaServico: 'Planejamento Migratório · Indicação de Parceiros',
    depoimento:
      'Tentei pesquisar tudo sozinha e quase desisti com tantas informações desencontradas sobre SERMIG e prazos de certidões. A clareza da equipe sobre o que eles conduzem e os profissionais parceiros que indicam trouxe total segurança.',
  },
];

export function getNextSlideIndex(currentIndex: number, totalSlides: number): number {
  if (totalSlides <= 1) return 0;
  const normalized = ((currentIndex % totalSlides) + totalSlides) % totalSlides;
  return (normalized + 1) % totalSlides;
}

export function getPrevSlideIndex(currentIndex: number, totalSlides: number): number {
  if (totalSlides <= 1) return 0;
  const normalized = ((currentIndex % totalSlides) + totalSlides) % totalSlides;
  return (normalized - 1 + totalSlides) % totalSlides;
}

export function formatSlideCounter(currentIndex: number, totalSlides: number): string {
  if (totalSlides <= 0) return '00 / 00';
  const safeIndex = Math.max(0, Math.min(currentIndex, totalSlides - 1));
  const currentStr = String(safeIndex + 1).padStart(2, '0');
  const totalStr = String(totalSlides).padStart(2, '0');
  return `${currentStr} / ${totalStr}`;
}

export function mergeAboutTestimonials(
  authorizedFromConfig?: EmpresaConfig['depoimentosAutorizados'],
  maxCount = 3,
): AboutTestimonial[] {
  const limit = Math.max(1, maxCount);
  const results: AboutTestimonial[] = [];
  const seenNames = new Set<string>();

  if (Array.isArray(authorizedFromConfig)) {
    for (const item of authorizedFromConfig) {
      if (!item || !item.autorizado) continue;
      const nome = (item.nome || '').trim();
      const depoimento = (item.depoimento || '').trim();
      if (!nome || !depoimento) continue;

      const key = nome.toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);

      results.push({
        id: item.id || `auth-${results.length + 1}`,
        nome,
        origemDestino: (item.cidadeOrigem || 'Brasil → Chile').trim(),
        rotaServico: (item.subcategoria || 'Assessoria Migratória').trim(),
        depoimento,
      });

      if (results.length >= limit) return results;
    }
  }

  for (const curated of CURATED_ABOUT_TESTIMONIALS) {
    if (results.length >= limit) break;
    const key = curated.nome.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    results.push(curated);
  }

  return results;
}
