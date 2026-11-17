import type { Case, CaseDocument, Client, Deadline, FinancialRecord, UserRole, VisaRequirement } from '../types/domain';
import { formatDateBR, parseFlexibleDate, toIsoDate } from './formatters';

export interface ThermometerPersonBreakdown {
  pessoa: string;
  nota: number;
  aprovados: number;
  emAnalise: number;
  pendentes: number;
  totalObrigatorios: number;
}

export interface ThermometerResult {
  notaGeral: number;
  corHex: string;
  faixa: 'Crítico' | 'Em construção' | 'Avançado' | 'Pronto para protocolo';
  porPessoa: ThermometerPersonBreakdown[];
  faltantesObrigatorios: number;
  bloqueadoProtocolo: boolean;
}

/**
 * Termômetro ponderado:
 * Obrigatórios peso 1–5 (Aprovado = 100%, Enviado/Em análise = 40%, demais = 0%).
 * Nota do caso = menor nota entre titular e dependentes.
 */
export function calcularTermometroDocumentos(
  docs: CaseDocument[],
  bloqueioProtocoloMinimo = 100,
): ThermometerResult {
  const pessoas = Array.from(new Set(docs.map((d) => d.pessoa || 'Titular')));
  if (pessoas.length === 0) {
    return {
      notaGeral: 0,
      corHex: '#C82333',
      faixa: 'Crítico',
      porPessoa: [],
      faltantesObrigatorios: 0,
      bloqueadoProtocolo: true,
    };
  }

  let faltantesObrigatorios = 0;
  const porPessoa: ThermometerPersonBreakdown[] = pessoas.map((pessoa) => {
    const pDocs = docs.filter((d) => (d.pessoa || 'Titular') === pessoa && d.obrigatorio);
    if (pDocs.length === 0) {
      return { pessoa, nota: 100, aprovados: 0, emAnalise: 0, pendentes: 0, totalObrigatorios: 0 };
    }
    let somaPesos = 0;
    let somaPontos = 0;
    let aprovados = 0;
    let emAnalise = 0;
    let pendentes = 0;

    for (const d of pDocs) {
      const peso = Math.max(1, Math.min(5, d.peso || 3));
      somaPesos += peso;
      if (d.status === 'Aprovado') {
        somaPontos += peso * 100;
        aprovados += 1;
      } else if (d.status === 'Enviado' || d.status === 'Em análise') {
        somaPontos += peso * 40;
        emAnalise += 1;
        faltantesObrigatorios += 1;
      } else {
        pendentes += 1;
        faltantesObrigatorios += 1;
      }
    }
    const nota = somaPesos > 0 ? Math.round(somaPontos / somaPesos) : 0;
    return { pessoa, nota, aprovados, emAnalise, pendentes, totalObrigatorios: pDocs.length };
  });

  const notaGeral = Math.min(...porPessoa.map((p) => p.nota));
  let corHex = '#C82333';
  let faixa: ThermometerResult['faixa'] = 'Crítico';
  if (notaGeral >= 90) {
    corHex = '#1E7E34';
    faixa = 'Pronto para protocolo';
  } else if (notaGeral >= 70) {
    corHex = '#0F2537';
    faixa = 'Avançado';
  } else if (notaGeral >= 40) {
    corHex = '#D4AF37';
    faixa = 'Em construção';
  }

  return {
    notaGeral,
    corHex,
    faixa,
    porPessoa,
    faltantesObrigatorios,
    bloqueadoProtocolo: notaGeral < bloqueioProtocoloMinimo,
  };
}

export interface ScheduledRequirement {
  requirement: VisaRequirement;
  ordem: number;
  dataSugeridaIso: string;
  dataSugeridaBR: string;
  janelaObservacao: string;
}

/**
 * Cronograma inteligente de emissão:
 * Ordena sem validade/demorados primeiro e validade curta (ex: Antecedentes PF 60d) por último,
 * calculando a data sugerida para que todos os documentos estejam válidos na data-alvo do protocolo.
 */
export function gerarCronogramaEmissao(
  requirements: VisaRequirement[],
  dataAlvoProtocoloIso: string,
): ScheduledRequirement[] {
  const target = parseFlexibleDate(dataAlvoProtocoloIso) ?? new Date(Date.now() + 30 * 86400000);
  const sorted = [...requirements].sort((a, b) => {
    // Sem validade (0) primeiro; depois maior validade; depois ordemPrioridadeEmissao
    if (a.validadeDias === 0 && b.validadeDias > 0) return -1;
    if (b.validadeDias === 0 && a.validadeDias > 0) return 1;
    if (a.ordemPrioridadeEmissao !== b.ordemPrioridadeEmissao) {
      return a.ordemPrioridadeEmissao - b.ordemPrioridadeEmissao;
    }
    return b.validadeDias - a.validadeDias;
  });

  return sorted.map((req, idx) => {
    let daysBeforeProtocol = 25;
    let obs = 'Emitir com antecedência (documento sem vencimento curto).';
    if (req.validadeDias > 0 && req.validadeDias <= 60) {
      daysBeforeProtocol = Math.max(7, Math.min(20, Math.floor(req.validadeDias * 0.25)));
      obs = `Validade curta (${req.validadeDias} dias): emitir apenas na reta final para chegar válido ao protocolo.`;
    } else if (req.validadeDias > 60) {
      daysBeforeProtocol = Math.min(45, Math.floor(req.validadeDias * 0.4));
      obs = `Validade de ${req.validadeDias} dias: emitir com folga para apostilamento/tradução.`;
    }
    const sugDate = new Date(target.getTime() - daysBeforeProtocol * 86400000);
    return {
      requirement: req,
      ordem: idx + 1,
      dataSugeridaIso: toIsoDate(sugDate),
      dataSugeridaBR: formatDateBR(sugDate),
      janelaObservacao: obs,
    };
  });
}

export interface UrgencyAlert {
  id: string;
  categoria:
    | 'Documento vencendo'
    | 'Janela Estampado 90d'
    | 'Janela Prorrogação'
    | 'Trâmite > 180 dias'
    | 'Descargos / Requerimento'
    | 'Parcela atrasada';
  severidade: 'Critica' | 'Alta' | 'Media';
  titulo: string;
  detalhe: string;
  clientId?: string;
  clientNome?: string;
  clientWhatsapp?: string;
  caseId?: string;
  dataReferenciaBR: string;
}

/**
 * Central de Urgências calculada ao abrir o dashboard.
 * Respeita rigorosamente o papel: assistente NUNCA vê alertas financeiros/parcelas atrasadas.
 */
export function calcularUrgencias(params: {
  cases: Case[];
  clients: Client[];
  docs: CaseDocument[];
  deadlines: Deadline[];
  financialRecords: FinancialRecord[];
  role: UserRole;
  hoje?: Date;
}): UrgencyAlert[] {
  const hoje = params.hoje ?? new Date();
  const alerts: UrgencyAlert[] = [];
  const clientMap = new Map(params.clients.map((c) => [c.id, c]));

  const daysDiff = (iso?: string): number | null => {
    if (!iso) return null;
    const d = parseFlexibleDate(iso);
    if (!d) return null;
    return Math.ceil((d.getTime() - hoje.getTime()) / 86400000);
  };

  // 1. Documentos vencendo <= 15 dias
  for (const doc of params.docs) {
    if (doc.dataValidadeCalculada && doc.status !== 'Reprovado') {
      const diff = daysDiff(doc.dataValidadeCalculada);
      if (diff !== null && diff <= 15) {
        const cl = clientMap.get(doc.clientId);
        alerts.push({
          id: `urg_doc_${doc.id}`,
          categoria: 'Documento vencendo',
          severidade: diff <= 0 ? 'Critica' : 'Alta',
          titulo: `${doc.nomeDocumento} (${doc.pessoa})`,
          detalhe: diff <= 0 ? 'Documento vencido — requer reemissão.' : `Vence em ${diff} dia(s).`,
          clientId: doc.clientId,
          clientNome: cl?.nomeCompleto,
          clientWhatsapp: cl?.whatsapp,
          caseId: doc.caseId,
          dataReferenciaBR: formatDateBR(doc.dataValidadeCalculada),
        });
      }
    }
  }

  // 2. Casos: janela 90d Estampado, Prorrogação 120–10d, >180d em trâmite, Descargos
  for (const c of params.cases) {
    const cl = clientMap.get(c.clientId);
    if (c.dataLimiteEntrada) {
      const diff = daysDiff(c.dataLimiteEntrada);
      if (diff !== null && diff <= 90) {
        alerts.push({
          id: `urg_est_${c.id}`,
          categoria: 'Janela Estampado 90d',
          severidade: diff <= 15 ? 'Critica' : 'Alta',
          titulo: `Entrada no Chile – ${c.titulo}`,
          detalhe: diff < 0 ? 'Prazo de entrada expirado!' : `Restam ${diff} dia(s) para entrada no Chile.`,
          clientId: c.clientId,
          clientNome: cl?.nomeCompleto,
          clientWhatsapp: cl?.whatsapp,
          caseId: c.id,
          dataReferenciaBR: formatDateBR(c.dataLimiteEntrada),
        });
      }
    }
    if (c.dataVencimentoResidencia) {
      const diff = daysDiff(c.dataVencimentoResidencia);
      if (diff !== null && diff <= 120 && diff >= -5) {
        alerts.push({
          id: `urg_prorr_${c.id}`,
          categoria: 'Janela Prorrogação',
          severidade: diff <= 10 ? 'Critica' : 'Alta',
          titulo: `Janela Prorrogação/Definitiva – ${c.titulo}`,
          detalhe: `Vencimento em ${diff} dia(s) (janela legal recomendada: 90 a 10 dias antes).`,
          clientId: c.clientId,
          clientNome: cl?.nomeCompleto,
          clientWhatsapp: cl?.whatsapp,
          caseId: c.id,
          dataReferenciaBR: formatDateBR(c.dataVencimentoResidencia),
        });
      }
    }
    if (c.statusSermig === 'Em trâmite' && c.dataProtocolo) {
      const diff = daysDiff(c.dataProtocolo);
      if (diff !== null && diff <= -180) {
        alerts.push({
          id: `urg_180_${c.id}`,
          categoria: 'Trâmite > 180 dias',
          severidade: 'Alta',
          titulo: `Trâmite > 180 dias (Ley 19.880 art. 27) – ${c.titulo}`,
          detalhe: `Protocolado há ${Math.abs(diff)} dias sem resolução final.`,
          clientId: c.clientId,
          clientNome: cl?.nomeCompleto,
          clientWhatsapp: cl?.whatsapp,
          caseId: c.id,
          dataReferenciaBR: formatDateBR(c.dataProtocolo),
        });
      }
    }
    if (c.prazoRequerimento) {
      const diff = daysDiff(c.prazoRequerimento);
      if (diff !== null && diff <= 15) {
        alerts.push({
          id: `urg_desc_${c.id}`,
          categoria: 'Descargos / Requerimento',
          severidade: 'Critica',
          titulo: `Requerimento / Descargos – ${c.titulo}`,
          detalhe: diff < 0 ? 'Prazo de resposta ultrapassado!' : `Prazo encerra em ${diff} dia(s).`,
          clientId: c.clientId,
          clientNome: cl?.nomeCompleto,
          clientWhatsapp: cl?.whatsapp,
          caseId: c.id,
          dataReferenciaBR: formatDateBR(c.prazoRequerimento),
        });
      }
    }
  }

  // 3. Deadlines manuais críticos (<= 15 dias)
  for (const dl of params.deadlines) {
    if (dl.concluido) continue;
    if (params.role === 'assistente' && dl.tipo === 'Parcela/Reunião') continue;
    const diff = daysDiff(dl.dataLimite);
    if (diff !== null && diff <= 15) {
      const cl = dl.clientId ? clientMap.get(dl.clientId) : undefined;
      alerts.push({
        id: `urg_dl_${dl.id}`,
        categoria: dl.tipo === 'Resposta Requerimento/Recurso' ? 'Descargos / Requerimento' : 'Documento vencendo',
        severidade: diff <= 3 ? 'Critica' : 'Alta',
        titulo: dl.titulo,
        detalhe: diff < 0 ? `Vencido há ${Math.abs(diff)} dia(s).` : `Vence em ${diff} dia(s).`,
        clientId: dl.clientId,
        clientNome: cl?.nomeCompleto,
        clientWhatsapp: cl?.whatsapp,
        caseId: dl.caseId,
        dataReferenciaBR: formatDateBR(dl.dataLimite),
      });
    }
  }

  // 4. Parcelas atrasadas (OCULTO AO ASSISTENTE!)
  if (params.role !== 'assistente') {
    for (const fin of params.financialRecords) {
      if (fin.status === 'Pago') continue;
      const diff = daysDiff(fin.vencimento);
      if (fin.status === 'Atrasado' || (diff !== null && diff < 0)) {
        const cl = fin.clientId ? clientMap.get(fin.clientId) : undefined;
        alerts.push({
          id: `urg_fin_${fin.id}`,
          categoria: 'Parcela atrasada',
          severidade: 'Alta',
          titulo: `Parcela em atraso – ${fin.descricao}`,
          detalhe: `Vencimento em ${formatDateBR(fin.vencimento)} (${fin.moeda} ${fin.valor.toFixed(2)}).`,
          clientId: fin.clientId,
          clientNome: cl?.nomeCompleto,
          clientWhatsapp: cl?.whatsapp,
          caseId: fin.caseId,
          dataReferenciaBR: formatDateBR(fin.vencimento),
        });
      }
    }
  }

  return alerts.sort((a, b) => {
    const rank = { Critica: 0, Alta: 1, Media: 2 };
    return rank[a.severidade] - rank[b.severidade];
  });
}
