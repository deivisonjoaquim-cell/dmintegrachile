import type { DiagnosticAnswers, Lead } from '../types/domain';
import { getAdaptiveWizardMeta } from './diagnosticEngine';

export interface DiagnosticIntelligenceMetrics {
  totalLeads: number;
  concluidos: number;
  emAndamento: number;
  abandonados: number;
  taxaConclusaoPct: number;
  abandonoPorEtapa: { etapa: number; nome: string; quantidade: number; percentualPct: number }[];
  porOrigem: { origem: string; total: number; fechados: number }[];
  porUtm: { utm: string; total: number }[];
  subcategoriasMaisIndicadas: { subcategoria: string; total: number }[];
  percentualBrasileirosComSaidaChilePct: number;
  leadsComRiscoAlto: number;
  leadsConfiancaBaixa: number;
  leadsRevisaoConsultor: number;
  taxaConversaoLeadClientePct: number;
  tempoMedioAteContatoHoras: number | null;
  heatmapCamposEmBranco: { campo: string; rotulo: string; emBranco: number; totalElegiveis: number; percentualPct: number }[];
}

const STEP_NAMES: Record<number, string> = {
  1: 'Etapa 1 · Contato',
  2: 'Etapa 2 · Localização & Passaporte',
  3: 'Etapa 3 · Vínculos Familiares',
  4: 'Etapa 4 · Objetivo no Chile',
  5: 'Etapa 5 · Histórico Sensível',
  6: 'Etapa 6 · Família, Prazo & LGPD',
};

const FIELD_LABELS: Record<string, string> = {
  cidadeUf: 'Cidade / UF atual',
  faixaEtaria: 'Faixa etária',
  passaporteStatus: 'Status do passaporte',
  segundaNacionalidadeQual: 'Qual 2ª nacionalidade',
  vinculoTipo: 'Tipo de vínculo familiar',
  overstay: 'Excesso de prazo (Overstay)',
  ordenAbandono: 'Orden de Abandono',
  rejeicaoAnterior: 'Rejeição anterior SERMIG',
  antecedentesCriminais: 'Antecedentes criminais',
  documentosJaPossui: 'Documentos já disponíveis',
  utmSource: 'Origem UTM',
};

export function computeDiagnosticIntelligence(leads: Lead[], periodDays?: number): DiagnosticIntelligenceMetrics {
  const cutoffMs = periodDays && periodDays > 0 ? Date.now() - periodDays * 86400000 : 0;
  const scoped = cutoffMs > 0
    ? leads.filter((l) => {
        const ts = Date.parse(l.createdAt || '');
        return !Number.isNaN(ts) && ts >= cutoffMs;
      })
    : leads;

  const totalLeads = scoped.length;
  const concluidos = scoped.filter((l) => !l.statusConclusao || l.statusConclusao === 'Concluído').length;
  const abandonados = scoped.filter((l) => l.statusConclusao === 'Abandonado').length;
  const emAndamento = scoped.filter((l) => l.statusConclusao === 'Em andamento').length;
  const taxaConclusaoPct = totalLeads > 0 ? Math.round((concluidos / totalLeads) * 100) : 0;

  // Abandono por etapa
  const abandonStageCounts = new Map<number, number>();
  for (const l of scoped) {
    if (l.statusConclusao === 'Abandonado' || l.statusConclusao === 'Em andamento') {
      const et = Math.min(6, Math.max(1, l.etapaAtual || 1));
      abandonStageCounts.set(et, (abandonStageCounts.get(et) || 0) + 1);
    }
  }
  const abandonBase = abandonados + emAndamento;
  const abandonoPorEtapa = [1, 2, 3, 4, 5, 6].map((et) => {
    const quantidade = abandonStageCounts.get(et) || 0;
    return {
      etapa: et,
      nome: STEP_NAMES[et],
      quantidade,
      percentualPct: abandonBase > 0 ? Math.round((quantidade / abandonBase) * 100) : 0,
    };
  });

  // Origem
  const origMap = new Map<string, { total: number; fechados: number }>();
  for (const l of scoped) {
    const key = l.origem || 'Outro';
    const cur = origMap.get(key) || { total: 0, fechados: 0 };
    cur.total += 1;
    if (l.statusFunil === 'Fechado' || l.convertedClientId) cur.fechados += 1;
    origMap.set(key, cur);
  }
  const porOrigem = Array.from(origMap.entries())
    .map(([origem, v]) => ({ origem, ...v }))
    .sort((a, b) => b.total - a.total);

  // UTM
  const utmMap = new Map<string, number>();
  for (const l of scoped) {
    const utm = [l.utmSource, l.utmMedium, l.utmCampaign].filter(Boolean).join(' / ') || 'Orgânico / Direto';
    utmMap.set(utm, (utmMap.get(utm) || 0) + 1);
  }
  const porUtm = Array.from(utmMap.entries())
    .map(([utm, total]) => ({ utm, total }))
    .sort((a, b) => b.total - a.total);

  // Subcategorias
  const subMap = new Map<string, number>();
  for (const l of scoped) {
    if (l.subcategoriaSugerida) {
      subMap.set(l.subcategoriaSugerida, (subMap.get(l.subcategoriaSugerida) || 0) + 1);
    }
  }
  const subcategoriasMaisIndicadas = Array.from(subMap.entries())
    .map(([subcategoria, total]) => ({ subcategoria, total }))
    .sort((a, b) => b.total - a.total);

  // % brasileiros com alerta de saída do Chile
  const brasileiros = scoped.filter((l) => l.respostasTriagem?.nacionalidadeBrasileira === true);
  const brTuristaSemVinculo = brasileiros.filter((l) => {
    const r = l.respostasTriagem;
    if (!r) return false;
    const vinculoFormal = r.vinculoFamiliarChile === true && r.vinculoFormalizado === true;
    return r.localizacao === 'No Chile como turista' && !vinculoFormal && r.objetivo !== 'humanitario';
  });
  const percentualBrasileirosComSaidaChilePct =
    brasileiros.length > 0 ? Math.round((brTuristaSemVinculo.length / brasileiros.length) * 100) : 0;

  const leadsComRiscoAlto = scoped.filter(
    (l) => l.prioridade === 'Urgente' || (l.flagsRisco || []).some((f) => !f.toLowerCase().includes('revisar com o consultor')),
  ).length;
  const leadsConfiancaBaixa = scoped.filter((l) => l.confianca === 'Baixa').length;
  const leadsRevisaoConsultor = scoped.filter(
    (l) => (l.respostasTriagem?.riscoConsultaConsultor?.length || 0) > 0,
  ).length;

  const convertidos = scoped.filter((l) => l.statusFunil === 'Fechado' || Boolean(l.convertedClientId)).length;
  const taxaConversaoLeadClientePct = totalLeads > 0 ? Math.round((convertidos / totalLeads) * 100) : 0;

  // Tempo médio até contato (horas)
  const contactDiffsHoras: number[] = [];
  for (const l of scoped) {
    if (l.primeiroContatoEm && l.createdAt) {
      const start = Date.parse(l.createdAt);
      const end = Date.parse(l.primeiroContatoEm);
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        contactDiffsHoras.push((end - start) / 3600000);
      }
    }
  }
  const tempoMedioAteContatoHoras =
    contactDiffsHoras.length > 0
      ? Number((contactDiffsHoras.reduce((a, b) => a + b, 0) / contactDiffsHoras.length).toFixed(1))
      : null;

  // Heatmap de campos deixados em branco
  const trackFields = Object.keys(FIELD_LABELS);
  const blankStats = new Map<string, { blank: number; eligible: number }>();
  for (const k of trackFields) {
    blankStats.set(k, { blank: 0, eligible: 0 });
  }

  for (const l of scoped) {
    const r = l.respostasTriagem as DiagnosticAnswers | undefined;
    if (!r) continue;
    const meta = getAdaptiveWizardMeta(r);
    const visibleSet = new Set(Object.values(meta.visiveisPorEtapa).flat());

    for (const k of trackFields) {
      if (k !== 'utmSource' && !visibleSet.has(k)) continue;
      const st = blankStats.get(k)!;
      st.eligible += 1;
      if (k === 'utmSource') {
        if (!l.utmSource) st.blank += 1;
        continue;
      }
      const val = (r as unknown as Record<string, unknown>)[k];
      const isEmpty =
        val === undefined ||
        val === null ||
        val === '' ||
        (Array.isArray(val) && val.length === 0);
      if (isEmpty) st.blank += 1;
    }
  }

  const heatmapCamposEmBranco = Array.from(blankStats.entries())
    .filter(([, s]) => s.eligible > 0)
    .map(([campo, s]) => ({
      campo,
      rotulo: FIELD_LABELS[campo] || campo,
      emBranco: s.blank,
      totalElegiveis: s.eligible,
      percentualPct: Math.round((s.blank / s.eligible) * 100),
    }))
    .sort((a, b) => b.percentualPct - a.percentualPct);

  return {
    totalLeads,
    concluidos,
    emAndamento,
    abandonados,
    taxaConclusaoPct,
    abandonoPorEtapa,
    porOrigem,
    porUtm,
    subcategoriasMaisIndicadas,
    percentualBrasileirosComSaidaChilePct,
    leadsComRiscoAlto,
    leadsConfiancaBaixa,
    leadsRevisaoConsultor,
    taxaConversaoLeadClientePct,
    tempoMedioAteContatoHoras,
    heatmapCamposEmBranco,
  };
}
