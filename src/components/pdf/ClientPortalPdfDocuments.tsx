import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { PIPELINE_STAGES } from '../../data/seeds';
import type {
  Appointment,
  Case,
  CaseDocument,
  Client,
  Deadline,
  Dependent,
  DiagnosticAnswers,
  EmpresaConfig,
  Lead,
  Task,
  ViabilityAssessment,
} from '../../types/domain';
import type { ThermometerResult } from '../../utils/caseMetrics';
import type { DiagnosticResult } from '../../utils/diagnosticEngine';
import type { TaskProgressOverview } from '../../utils/taskProgressMetrics';
import {
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  formatStandardDocFilename,
  toIsoDate,
} from '../../utils/formatters';

export interface PdfAiDraftSummary {
  fallback?: boolean;
  origem?: 'principal' | 'reserva' | 'regras';
  origemLabel?: string;
  resumoExecutivo: string;
  riscos?: string[];
  perguntasConsultor?: string[];
  pontosAtencao?: string[];
  fontesCitadas?: string[];
  proximosPassos?: string[];
}

export interface DiagnosticoPdfInput {
  empresa: EmpresaConfig;
  client: Client | null;
  dependents: Dependent[];
  activeCase: Case | null;
  lead: Lead | null;
  assessments: ViabilityAssessment[];
  logoDataUrl?: string;
}

export interface ProgressoPdfInput {
  empresa: EmpresaConfig;
  client: Client | null;
  dependents: Dependent[];
  activeCase: Case | null;
  docs: CaseDocument[];
  deadlines: Deadline[];
  appointments: Appointment[];
  thermo: ThermometerResult;
  assessments: ViabilityAssessment[];
  logoDataUrl?: string;
}

export interface DiagnosticoCompletoPdfInput {
  empresa: EmpresaConfig;
  result: DiagnosticResult;
  answers: DiagnosticAnswers;
  aiDraft?: PdfAiDraftSummary | null;
  hideCosts?: boolean;
  savedLeadId?: string | null;
  logoDataUrl?: string;
}

export interface DossieCasoPdfInput {
  empresa: EmpresaConfig;
  client: Client | null;
  activeCase: Case;
  dependents: Dependent[];
  docs: CaseDocument[];
  deadlines: Deadline[];
  thermo: ThermometerResult;
  assessments?: ViabilityAssessment[];
  filterMode?: 'all' | 'apostila' | 'pacote';
  logoDataUrl?: string;
}

export interface ResumoProcessoClientePdfInput {
  empresa: EmpresaConfig;
  client: Client | null;
  activeCase: Case | null;
  cases?: Case[];
  clients?: Client[];
  tasks: Task[];
  docs: CaseDocument[];
  overview: TaskProgressOverview;
  logoDataUrl?: string;
}

export interface GeneratedOfficialDocPdfInput {
  empresa: EmpresaConfig;
  titulo: string;
  conteudo: string;
  codigoVerificacao?: string;
  versao?: number;
  status?: string;
  clienteNome?: string;
  assinaturaDataUrl?: string;
  assinadoEm?: string;
  confirmadoLeituraEm?: string;
  canceladoMotivo?: string;
  logoDataUrl?: string;
}

function safeStr(val: unknown, fallback = '—'): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  return s.length > 0 ? s : fallback;
}

function safeHex(hex?: string, fallback = '#0F2537'): string {
  if (!hex) return fallback;
  return /^#[0-9A-Fa-f]{6}$/.test(hex.trim()) ? hex.trim() : fallback;
}

/**
 * Converte a logo da empresa para PNG Data URL compatível com @react-pdf/renderer Image
 * quando executando no navegador. Em SSR/testes Node retorna undefined sem erro.
 */
export async function resolvePdfLogoDataUrl(logoUrl?: string): Promise<string | undefined> {
  if (!logoUrl || typeof logoUrl !== 'string') return undefined;
  const trimmed = logoUrl.trim();
  if (!trimmed) return undefined;

  if (/^data:image\/(png|jpeg|jpg);base64,/i.test(trimmed)) {
    return trimmed;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return undefined;
  }

  return new Promise<string | undefined>((resolve) => {
    let settled = false;
    const done = (val?: string) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };
    const timer = window.setTimeout(() => done(undefined), 2500);

    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        window.clearTimeout(timer);
        try {
          const w = Math.min(480, Math.max(64, img.naturalWidth || 240));
          const h = Math.min(200, Math.max(32, img.naturalHeight || 80));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return done(undefined);
          ctx.drawImage(img, 0, 0, w, h);
          done(canvas.toDataURL('image/png'));
        } catch {
          done(undefined);
        }
      };
      img.onerror = () => {
        window.clearTimeout(timer);
        done(undefined);
      };
      img.src = trimmed;
    } catch {
      window.clearTimeout(timer);
      done(undefined);
    }
  });
}

function createStyles(primaryColor: string, accentColor: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 32,
      paddingBottom: 56,
      paddingHorizontal: 32,
      fontFamily: 'Helvetica',
      fontSize: 9.5,
      color: '#1E293B',
      backgroundColor: '#FFFFFF',
    },
    headerBand: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      borderBottomWidth: 2,
      borderBottomColor: primaryColor,
      paddingBottom: 12,
      marginBottom: 16,
      gap: 12,
    },
    brandWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: '56%',
    },
    headerLogo: {
      height: 30,
      maxWidth: 96,
      objectFit: 'contain',
    },
    brandName: {
      fontSize: 12.5,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
    },
    brandSub: {
      fontSize: 8,
      color: '#64748B',
      marginTop: 2,
    },
    docTitleWrap: {
      alignItems: 'flex-end',
      maxWidth: '42%',
    },
    docEyebrow: {
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      color: accentColor,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    docTitle: {
      fontSize: 12.5,
      fontFamily: 'Helvetica-Bold',
      color: '#0F172A',
      marginTop: 2,
      textAlign: 'right',
    },
    docDate: {
      fontSize: 8,
      color: '#64748B',
      marginTop: 3,
    },
    section: {
      marginBottom: 14,
    },
    sectionHeading: {
      fontSize: 10.5,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      borderBottomWidth: 1,
      borderBottomColor: '#E2E8F0',
      paddingBottom: 4,
      marginBottom: 8,
    },
    kpiRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    kpiBox: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 4,
      padding: 8,
      backgroundColor: '#F8FAFC',
    },
    kpiLabel: {
      fontSize: 7.5,
      color: '#64748B',
      marginBottom: 3,
    },
    kpiValue: {
      fontSize: 11.5,
      fontFamily: 'Helvetica-Bold',
      color: '#0F172A',
    },
    kpiSub: {
      fontSize: 7.5,
      color: '#475569',
      marginTop: 2,
    },
    gridTwo: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    gridCell: {
      width: '48.5%',
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 4,
      padding: 7,
      backgroundColor: '#FFFFFF',
    },
    cellLabel: {
      fontSize: 7.5,
      color: '#64748B',
      marginBottom: 2,
    },
    cellValue: {
      fontSize: 9,
      fontFamily: 'Helvetica-Bold',
      color: '#0F172A',
    },
    cardBlock: {
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 4,
      padding: 9,
      backgroundColor: '#F8FAFC',
      marginBottom: 8,
    },
    alertBlock: {
      borderWidth: 1,
      borderColor: '#FECACA',
      borderRadius: 4,
      padding: 8,
      backgroundColor: '#FEF2F2',
      marginBottom: 6,
    },
    cardTitle: {
      fontSize: 9.5,
      fontFamily: 'Helvetica-Bold',
      color: '#0F172A',
      marginBottom: 4,
    },
    cardMeta: {
      fontSize: 8,
      color: '#64748B',
      marginBottom: 5,
    },
    paragraph: {
      fontSize: 8.8,
      lineHeight: 1.45,
      color: '#334155',
      marginBottom: 4,
    },
    subLabel: {
      fontSize: 8,
      fontFamily: 'Helvetica-Bold',
      color: primaryColor,
      marginTop: 4,
      marginBottom: 2,
    },
    table: {
      borderWidth: 1,
      borderColor: '#E2E8F0',
      borderRadius: 4,
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: '#F1F5F9',
      borderBottomWidth: 1,
      borderBottomColor: '#CBD5E1',
      paddingVertical: 6,
      paddingHorizontal: 6,
    },
    tableHeaderCell: {
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      color: '#334155',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: '#E2E8F0',
      paddingVertical: 5,
      paddingHorizontal: 6,
      alignItems: 'center',
    },
    tableCell: {
      fontSize: 8,
      color: '#1E293B',
      paddingRight: 4,
    },
    progressTrack: {
      height: 7,
      backgroundColor: '#E2E8F0',
      borderRadius: 4,
      overflow: 'hidden',
      marginTop: 5,
      marginBottom: 4,
    },
    progressFill: {
      height: 7,
      borderRadius: 4,
    },
    footer: {
      position: 'absolute',
      bottom: 18,
      left: 32,
      right: 32,
      borderTopWidth: 1,
      borderTopColor: '#E2E8F0',
      paddingTop: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
    },
    footerLegal: {
      fontSize: 7,
      color: '#64748B',
      flex: 1,
      lineHeight: 1.3,
    },
    footerPage: {
      fontSize: 7.5,
      fontFamily: 'Helvetica-Bold',
      color: '#475569',
    },
  });
}

function renderBrandHeader(
  s: ReturnType<typeof createStyles>,
  empresa: EmpresaConfig,
  eyebrow: string,
  title: string,
  dateLine: string,
  logoDataUrl?: string,
) {
  return (
    <View style={s.headerBand} fixed>
      <View style={s.brandWrap}>
        {logoDataUrl ? <Image src={logoDataUrl} style={s.headerLogo} /> : null}
        <View>
          <Text style={s.brandName}>{safeStr(empresa.nome_empresa)}</Text>
          <Text style={s.brandSub}>{safeStr(empresa.razao_social_cnpj_rut)}</Text>
          <Text style={s.brandSub}>
            {safeStr(empresa.email)} · {safeStr(empresa.whatsapp)}
          </Text>
        </View>
      </View>
      <View style={s.docTitleWrap}>
        <Text style={s.docEyebrow}>{eyebrow}</Text>
        <Text style={s.docTitle}>{title}</Text>
        <Text style={s.docDate}>{dateLine}</Text>
      </View>
    </View>
  );
}

function buildDiagnosticAnswersRows(lead: Lead | null): { label: string; value: string }[] {
  const ans = lead?.respostasTriagem;
  if (!ans) return [];
  const rows: { label: string; value: string }[] = [];
  if (ans.objetivo) rows.push({ label: 'Objetivo principal', value: ans.objetivo.replace(/_/g, ' ') });
  if (ans.prazoPretendido) rows.push({ label: 'Horizonte de mudança', value: ans.prazoPretendido });
  if (ans.localizacao) rows.push({ label: 'Localização informada', value: ans.localizacao });
  if (typeof ans.mesesResidenciaChile === 'number' && ans.mesesResidenciaChile > 0) {
    rows.push({ label: 'Meses de residência no Chile', value: `${ans.mesesResidenciaChile} mês(es)` });
  }
  if (ans.nacionalidadeBrasileira !== null && ans.nacionalidadeBrasileira !== undefined) {
    rows.push({
      label: 'Nacionalidade brasileira',
      value: ans.nacionalidadeBrasileira ? 'Sim' : ans.segundaNacionalidadeQual || 'Não',
    });
  }
  if (ans.passaporteStatus) {
    rows.push({
      label: 'Situação do passaporte',
      value: `${ans.passaporteStatus.replace(/_/g, ' ')}${ans.passaporteValidadeMeses ? ` (${ans.passaporteValidadeMeses} meses)` : ''}`,
    });
  }
  if (ans.vinculoFamiliarChile) {
    rows.push({
      label: 'Vínculo familiar no Chile',
      value: ans.vinculoTipo || (ans.vinculoFormalizado ? 'Formalizado' : 'Informado'),
    });
  }
  if (ans.faixaRendaMensalUsd) {
    const rendaLabel: Record<string, string> = {
      abaixo_1000: 'Abaixo de US$ 1.000/mês',
      '1000_2500': 'US$ 1.000 a US$ 2.500/mês',
      acima_2500: 'Acima de US$ 2.500/mês',
    };
    rows.push({ label: 'Faixa de renda mensal', value: rendaLabel[ans.faixaRendaMensalUsd] || ans.faixaRendaMensalUsd });
  }
  if (ans.familiaAcompanhante !== null && ans.familiaAcompanhante !== undefined) {
    rows.push({
      label: 'Acompanhamento familiar',
      value: ans.familiaAcompanhante ? `Sim (${ans.quantidadeDependentes || 1} dependente(s))` : 'Individual',
    });
  }
  const riscos = [
    ans.overstay ? 'Permanência excedida (overstay)' : null,
    ans.ordenAbandono ? 'Ordem de abandono' : null,
    ans.rejeicaoAnterior ? 'Rejeição anterior' : null,
    ans.antecedentesCriminais ? 'Antecedentes declarados' : null,
  ].filter(Boolean);
  rows.push({
    label: 'Alertas de risco declarados',
    value: riscos.length > 0 ? riscos.join('; ') : 'Sem ocorrências declaradas',
  });
  return rows;
}

export const DiagnosticoPdfDocument: React.FC<DiagnosticoPdfInput> = ({
  empresa,
  client,
  dependents,
  activeCase,
  lead,
  assessments,
  logoDataUrl,
}) => {
  const primary = safeHex(empresa.corPrimaria, '#0F2537');
  const accent = safeHex(empresa.corDestaque, '#C5A059');
  const s = createStyles(primary, accent);
  const generatedAt = formatDateTimeBR(new Date());
  const latestAssessment = assessments[0] || null;
  const answerRows = buildDiagnosticAnswersRows(lead);

  const subcategoria =
    lead?.subcategoriaSugerida ||
    activeCase?.subcategoriaIa ||
    activeCase?.tipoServico ||
    'Enquadramento em análise';
  const notaViabilidade =
    typeof latestAssessment?.notaGeral === 'number'
      ? latestAssessment.notaGeral
      : typeof lead?.notaViabilidade === 'number'
        ? lead.notaViabilidade
        : activeCase?.notaViabilidadeGeral ?? null;

  return (
    <Document
      title={`Diagnóstico de Viabilidade - ${client?.nomeCompleto || 'Cliente'}`}
      author={empresa.nome_empresa}
    >
      <Page size="A4" style={s.page} wrap>
        {renderBrandHeader(
          s,
          empresa,
          'Portal do Cliente',
          'Diagnóstico & Viabilidade',
          `Emitido em ${generatedAt}`,
          logoDataUrl,
        )}

        {/* Identificação do Titular */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>1. Identificação do Titular e Processo</Text>
          <View style={s.gridTwo}>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>Titular</Text>
              <Text style={s.cellValue}>{safeStr(client?.nomeCompleto || lead?.nome)}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>Contato (E-mail / WhatsApp)</Text>
              <Text style={s.cellValue}>
                {safeStr(client?.email || lead?.email)} · {safeStr(client?.whatsapp || lead?.whatsapp)}
              </Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>Processo Vinculado</Text>
              <Text style={s.cellValue}>{safeStr(activeCase?.titulo, 'Diagnóstico Inicial')}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>Dependentes Vinculados</Text>
              <Text style={s.cellValue}>
                {dependents.length > 0
                  ? `${dependents.length} (${dependents.map((d) => d.nomeCompleto).join(', ')})`
                  : 'Nenhum dependente cadastrado'}
              </Text>
            </View>
          </View>
        </View>

        {/* Indicadores de Viabilidade */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>2. Síntese do Diagnóstico de Elegibilidade</Text>
          <View style={s.kpiRow}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Subcategoria / Via Sugerida</Text>
              <Text style={s.kpiValue}>{safeStr(subcategoria)}</Text>
              {lead?.versaoRegras && <Text style={s.kpiSub}>Motor de regras: {lead.versaoRegras}</Text>}
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Índice de Viabilidade</Text>
              <Text style={s.kpiValue}>
                {notaViabilidade !== null ? `${notaViabilidade}/100` : 'Em avaliação'}
              </Text>
              {lead?.confianca && <Text style={s.kpiSub}>Confiança: {lead.confianca}</Text>}
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Status SERMIG / Etapa</Text>
              <Text style={s.kpiValue}>{safeStr(activeCase?.statusSermig, 'Pré-protocolo')}</Text>
              <Text style={s.kpiSub}>
                {activeCase ? `Etapa ${activeCase.etapaPipeline} de 15` : `Diagnóstico em ${formatDateBR(lead?.createdAt)}`}
              </Text>
            </View>
          </View>

          {lead?.flagsRisco && lead.flagsRisco.length > 0 && (
            <View style={s.cardBlock}>
              <Text style={s.cardTitle}>Pontos de Atenção Identificados na Triagem</Text>
              {lead.flagsRisco.map((flag, i) => (
                <Text key={i} style={s.paragraph}>
                  • {flag}
                </Text>
              ))}
            </View>
          )}
        </View>

        {/* Respostas da Triagem */}
        {answerRows.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHeading}>3. Parâmetros Informados no Diagnóstico Inicial</Text>
            <View style={s.gridTwo}>
              {answerRows.map((row) => (
                <View key={row.label} style={s.gridCell} wrap={false}>
                  <Text style={s.cellLabel}>{row.label}</Text>
                  <Text style={s.cellValue}>{row.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Pareceres Técnicos Liberados */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>
            {answerRows.length > 0 ? '4.' : '3.'} Parecer Técnico da Consultoria
          </Text>
          {assessments.length === 0 ? (
            <View style={s.cardBlock}>
              <Text style={s.paragraph}>
                Seu diagnóstico inicial está registrado. O parecer técnico completo será exibido aqui assim que o
                consultor finalizar a revisão documental e liberar o relatório ao portal.
              </Text>
              {activeCase?.parecerConsultor && (
                <Text style={s.paragraph}>Observação do consultor: {activeCase.parecerConsultor}</Text>
              )}
            </View>
          ) : (
            assessments.map((ass) => (
              <View key={ass.id} style={s.cardBlock}>
                <Text style={s.cardTitle}>
                  Parecer Técnico — Versão {ass.versao} (Nota {ass.notaGeral}/100)
                </Text>
                <Text style={s.cardMeta}>
                  Responsável: {safeStr(ass.autorNome)} · Liberado em {formatDateBR(ass.createdAt)}
                </Text>
                <Text style={s.subLabel}>Enquadramento Legal</Text>
                <Text style={s.paragraph}>{safeStr(ass.enquadramentoLegal)}</Text>

                {ass.elegibilidadeRiscos ? (
                  <>
                    <Text style={s.subLabel}>Elegibilidade &amp; Análise de Riscos</Text>
                    <Text style={s.paragraph}>{ass.elegibilidadeRiscos}</Text>
                  </>
                ) : null}

                {ass.fundamentacaoNormativa ? (
                  <>
                    <Text style={s.subLabel}>Fundamentação Normativa</Text>
                    <Text style={s.paragraph}>{ass.fundamentacaoNormativa}</Text>
                  </>
                ) : null}

                <Text style={s.subLabel}>Recomendações &amp; Próximos Passos</Text>
                <Text style={s.paragraph}>{safeStr(ass.recomendacoes)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerLegal}>{safeStr(empresa.avisoLegal)}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export const RelatorioProgressoPdfDocument: React.FC<ProgressoPdfInput> = ({
  empresa,
  client,
  dependents,
  activeCase,
  docs,
  deadlines,
  appointments,
  thermo,
  assessments,
  logoDataUrl,
}) => {
  const primary = safeHex(empresa.corPrimaria, '#0F2537');
  const accent = safeHex(empresa.corDestaque, '#C5A059');
  const s = createStyles(primary, accent);
  const generatedAt = formatDateTimeBR(new Date());

  const currentStage = activeCase?.etapaPipeline || 1;
  const stageMeta = PIPELINE_STAGES.find((st) => st.numero === currentStage);
  const sortedDocs = [...docs].sort((a, b) => a.ordemEmissao - b.ordemEmissao);
  const aprovados = docs.filter((d) => d.status === 'Aprovado').length;
  const emConferencia = docs.filter((d) => d.status === 'Enviado' || d.status === 'Em análise').length;
  const openDeadlines = deadlines
    .filter((d) => !d.concluido)
    .sort((a, b) => (a.dataLimite || '9999-12-31').localeCompare(b.dataLimite || '9999-12-31'));
  const activeAppointments = appointments
    .filter((a) => a.status !== 'Cancelado')
    .sort((a, b) => (a.dataHoraInicio || '').localeCompare(b.dataHoraInicio || ''));

  return (
    <Document
      title={`Relatório de Progresso - ${client?.nomeCompleto || 'Cliente'}`}
      author={empresa.nome_empresa}
    >
      <Page size="A4" style={s.page} wrap>
        {renderBrandHeader(
          s,
          empresa,
          'Portal do Cliente',
          'Relatório de Progresso',
          `Atualizado em ${generatedAt}`,
          logoDataUrl,
        )}

        {/* Identificação & Resumo */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>1. Resumo Executivo do Processo</Text>
          <View style={s.cardBlock}>
            <Text style={s.cardTitle}>{safeStr(activeCase?.titulo, 'Acompanhamento de Residência no Chile')}</Text>
            <Text style={s.cardMeta}>
              Titular: {safeStr(client?.nomeCompleto)} · Serviço: {safeStr(activeCase?.tipoServico, 'Residência')} ·
              Status SERMIG: {safeStr(activeCase?.statusSermig, 'Não protocolado')}
              {activeCase?.numeroPedidoSermig ? ` · Protocolo: ${activeCase.numeroPedidoSermig}` : ''}
            </Text>
            <Text style={s.kpiLabel}>
              Prontidão Documental ({thermo.faixa}) — {thermo.notaGeral}% ({thermo.faltantesObrigatorios}{' '}
              obrigatório(s) pendente(s))
            </Text>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  { width: `${Math.min(100, Math.max(4, thermo.notaGeral))}%`, backgroundColor: safeHex(thermo.corHex, primary) },
                ]}
              />
            </View>
          </View>

          <View style={s.kpiRow}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Etapa Atual</Text>
              <Text style={s.kpiValue}>Etapa {currentStage} de 15</Text>
              <Text style={s.kpiSub}>{safeStr(stageMeta?.nome)}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Documentos Aprovados</Text>
              <Text style={s.kpiValue}>
                {aprovados} / {docs.length}
              </Text>
              <Text style={s.kpiSub}>{emConferencia} em conferência</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Grupo Familiar</Text>
              <Text style={s.kpiValue}>1 + {dependents.length}</Text>
              <Text style={s.kpiSub}>{dependents.length} dependente(s)</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Próximo Prazo</Text>
              <Text style={s.kpiValue}>
                {openDeadlines[0] ? formatDateBR(openDeadlines[0].dataLimite) : 'Nenhum'}
              </Text>
              <Text style={s.kpiSub}>{openDeadlines[0]?.tipo || 'Em dia'}</Text>
            </View>
          </View>
        </View>

        {/* Linha do tempo das 15 Etapas */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>2. Linha do Tempo (15 Etapas Operacionais)</Text>
          <View style={s.table}>
            <View style={s.tableHeader}>
              <Text style={[s.tableHeaderCell, { width: '12%' }]}>Etapa</Text>
              <Text style={[s.tableHeaderCell, { width: '63%' }]}>Descrição da Fase</Text>
              <Text style={[s.tableHeaderCell, { width: '25%' }]}>Situação</Text>
            </View>
            {PIPELINE_STAGES.map((st) => {
              const statusLabel =
                st.numero < currentStage
                  ? 'Concluída'
                  : st.numero === currentStage
                    ? 'Em andamento (Atual)'
                    : 'Aguardando';
              return (
                <View key={st.numero} style={s.tableRow} wrap={false}>
                  <Text style={[s.tableCell, { width: '12%', fontFamily: 'Helvetica-Bold' }]}>#{st.numero}</Text>
                  <Text style={[s.tableCell, { width: '63%' }]}>{st.nome}</Text>
                  <Text
                    style={[
                      s.tableCell,
                      {
                        width: '25%',
                        fontFamily: st.numero === currentStage ? 'Helvetica-Bold' : 'Helvetica',
                        color: st.numero < currentStage ? '#1E7E34' : st.numero === currentStage ? primary : '#64748B',
                      },
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Situação do Checklist Documental */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>3. Checklist e Esteira Documental ({sortedDocs.length} item(ns))</Text>
          {sortedDocs.length === 0 ? (
            <Text style={s.paragraph}>Nenhum item documental cadastrado ainda para este processo.</Text>
          ) : (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '16%' }]}>Pessoa</Text>
                <Text style={[s.tableHeaderCell, { width: '34%' }]}>Documento</Text>
                <Text style={[s.tableHeaderCell, { width: '16%' }]}>Status</Text>
                <Text style={[s.tableHeaderCell, { width: '20%' }]}>Esteira</Text>
                <Text style={[s.tableHeaderCell, { width: '14%' }]}>Validade</Text>
              </View>
              {sortedDocs.map((d) => (
                <View key={d.id} style={s.tableRow} wrap={false}>
                  <Text style={[s.tableCell, { width: '16%' }]}>{safeStr(d.pessoa)}</Text>
                  <Text style={[s.tableCell, { width: '34%', fontFamily: 'Helvetica-Bold' }]}>
                    {safeStr(d.nomeDocumento)}
                  </Text>
                  <Text
                    style={[
                      s.tableCell,
                      {
                        width: '16%',
                        color: d.status === 'Aprovado' ? '#1E7E34' : d.status === 'Reprovado' ? '#C82333' : '#334155',
                        fontFamily: 'Helvetica-Bold',
                      },
                    ]}
                  >
                    {d.status}
                  </Text>
                  <Text style={[s.tableCell, { width: '20%' }]}>{safeStr(d.etapaEsteira)}</Text>
                  <Text style={[s.tableCell, { width: '14%' }]}>
                    {d.dataValidadeCalculada ? formatDateBR(d.dataValidadeCalculada) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Prazos e Agendamentos */}
        {(openDeadlines.length > 0 || activeAppointments.length > 0) && (
          <View style={s.section}>
            <Text style={s.sectionHeading}>4. Prazos e Reuniões Acompanhadas</Text>
            {openDeadlines.map((dl) => (
              <View key={dl.id} style={s.cardBlock} wrap={false}>
                <Text style={s.cardTitle}>
                  [Prazo] {dl.titulo} — {formatDateBR(dl.dataLimite)}
                </Text>
                <Text style={s.cardMeta}>Categoria: {dl.tipo}</Text>
              </View>
            ))}
            {activeAppointments.map((apt) => (
              <View key={apt.id} style={s.cardBlock} wrap={false}>
                <Text style={s.cardTitle}>
                  [Reunião] {apt.titulo} — {formatDateTimeBR(apt.dataHoraInicio)}
                </Text>
                <Text style={s.cardMeta}>
                  Tipo: {apt.tipo} · Status: {apt.status}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Parecer Liberado resumido */}
        {assessments[0] && (
          <View style={s.section}>
            <Text style={s.sectionHeading} minPresenceAhead={40}>5. Orientações do Parecer Técnico Vigente</Text>
            <View style={s.cardBlock}>
              <Text style={s.paragraph}>{safeStr(assessments[0].recomendacoes)}</Text>
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerLegal}>{safeStr(empresa.avisoLegal)}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export const DiagnosticoCompletoPdfDocument: React.FC<DiagnosticoCompletoPdfInput> = ({
  empresa,
  result,
  answers,
  aiDraft,
  hideCosts = false,
  savedLeadId,
  logoDataUrl,
}) => {
  const primary = safeHex(empresa.corPrimaria, '#0F2537');
  const accent = safeHex(empresa.corDestaque, '#C5A059');
  const s = createStyles(primary, accent);
  const generatedAt = formatDateTimeBR(new Date());

  return (
    <Document
      title={`Pré-Análise Migratória - ${answers.nome || 'Solicitante'}`}
      author={empresa.nome_empresa}
    >
      <Page size="A4" style={s.page} wrap>
        {renderBrandHeader(
          s,
          empresa,
          `Regras ${result.versaoRegras.versao}`,
          'Relatório de Pré-Análise Migratória',
          `Emitido em ${generatedAt} (America/Sao_Paulo)`,
          logoDataUrl,
        )}

        {/* Identificação & Aviso Orientativo */}
        <View style={s.section}>
          <View style={s.cardBlock}>
            <Text style={s.cardTitle}>{safeStr(result.avisoOrientativo)}</Text>
            <Text style={s.paragraph}>
              Titular: {safeStr(answers.nome, 'Visitante')} · Contato: {safeStr(answers.email)} · {safeStr(answers.whatsapp)}
              {answers.cidadeUf ? ` · ${answers.cidadeUf}` : ''}
              {savedLeadId && savedLeadId !== 'local-preview' ? ` · Protocolo: ${savedLeadId}` : ''}
            </Text>
            <Text style={s.cardMeta}>
              Localização atual: {safeStr(answers.localizacao)} · Horizonte: {safeStr(answers.prazoPretendido)} · Regra publicada em{' '}
              {formatDateBR(result.versaoRegras.dataPublicacao)}
            </Text>
          </View>
        </View>

        {/* Recomendação Principal */}
        {result.recomendada ? (
          <View style={s.section}>
            <Text style={s.sectionHeading}>1. Subcategoria Sugerida &amp; Índice de Viabilidade</Text>
            <View style={s.kpiRow}>
              <View style={[s.kpiBox, { flex: 1.6 }]}>
                <Text style={s.kpiLabel}>Subcategoria Recomendada (Cód. {result.recomendada.visa.codigo})</Text>
                <Text style={s.kpiValue}>{result.recomendada.visa.nomePortugues}</Text>
                <Text style={s.kpiSub}>{result.recomendada.visa.nomeEspanhol}</Text>
              </View>
              <View style={s.kpiBox}>
                <Text style={s.kpiLabel}>Viabilidade / Confiança</Text>
                <Text style={s.kpiValue}>{result.viabilidade.total}/100</Text>
                <Text style={s.kpiSub}>
                  {result.viabilidade.veredito} · Confiança {result.confianca}
                </Text>
              </View>
              <View style={s.kpiBox}>
                <Text style={s.kpiLabel}>Direito Laboral &amp; Pedido</Text>
                <Text style={s.kpiValue}>{result.recomendada.visa.permiteTrabalhar ? 'Permite Trabalhar' : 'Restrito'}</Text>
                <Text style={s.kpiSub}>De dentro do Chile: {result.recomendada.visa.permiteDentroChile}</Text>
              </View>
            </View>
            <Text style={s.paragraph}>{result.recomendada.motivo}</Text>
            <Text style={s.paragraph}>
              Caminho operacional indicado: {result.caminho}
            </Text>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.sectionHeading}>1. Dados Insuficientes para Recomendação</Text>
            <View style={s.cardBlock}>
              <Text style={s.paragraph}>{safeStr(result.mensagemDadosInsuficientes)}</Text>
            </View>
          </View>
        )}

        {/* Alertas Críticos e Revisão com Consultor */}
        {(result.alertas.length > 0 || result.flagsRevisaoConsultor.length > 0 || result.contradicoes.length > 0) && (
          <View style={s.section}>
            <Text style={s.sectionHeading}>2. Alertas de Risco e Pontos de Revisão</Text>
            {result.alertas.map((alerta, i) => (
              <View key={i} style={s.alertBlock} wrap={false}>
                <Text style={[s.paragraph, { color: '#991B1B', fontFamily: 'Helvetica-Bold', marginBottom: 0 }]}>
                  • {alerta}
                </Text>
              </View>
            ))}
            {result.contradicoes.map((c) => (
              <View key={c.codigo} style={s.cardBlock} wrap={false}>
                <Text style={s.cardTitle}>Inconsistência detectada: {c.titulo}</Text>
                <Text style={s.paragraph}>{c.perguntaEsclarecimento}</Text>
              </View>
            ))}
            {result.flagsRevisaoConsultor.length > 0 && (
              <View style={s.cardBlock} wrap={false}>
                <Text style={s.cardTitle}>Temas reservados para conversa com o consultor (LGPD)</Text>
                {result.flagsRevisaoConsultor.map((f) => (
                  <Text key={f.campo} style={s.paragraph}>
                    • {f.label}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Plano de Ação em 3 Etapas */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>3. Plano de Ação Personalizado (Ordenado por Validade)</Text>
          {[
            { titulo: 'Bloco A — Faça Agora (Imediato)', items: result.planoAcao.facaAgora },
            { titulo: 'Bloco B — Em 30 Dias (Preparação)', items: result.planoAcao.em30Dias },
            { titulo: 'Bloco C — Antes do Protocolo (Validade curta 60d)', items: result.planoAcao.antesProtocolo },
          ].map((grp) => (
            <View key={grp.titulo} style={s.cardBlock}>
              <Text style={s.cardTitle} minPresenceAhead={36}>{grp.titulo}</Text>
              {grp.items.length === 0 ? (
                <Text style={s.paragraph}>Nenhuma ação pendente neste bloco.</Text>
              ) : (
                grp.items.map((item) => (
                  <Text key={item.id} style={s.paragraph}>
                    • {item.titulo} ({item.orgao} · {item.validadeDias > 0 ? `Validade ${item.validadeDias}d` : 'Sem vencimento'}): {item.detalhe}
                  </Text>
                ))
              )}
            </View>
          ))}
        </View>

        {/* Estimativa de Taxas & Cronograma */}
        <View style={s.section}>
          <Text style={s.sectionHeading} minPresenceAhead={40}>
            4. {hideCosts ? 'Cronograma Estimado em Faixas' : 'Estimativa de Taxas Oficiais (BRL ↔ CLP) & Cronograma'}
          </Text>
          {!hideCosts && (
            <View style={s.cardBlock}>
              <Text style={s.cardTitle} minPresenceAhead={36}>
                Taxas Oficiais &amp; Terceiros: {formatCurrency(result.custosEstimados.totalMinBrl, 'BRL')} a{' '}
                {formatCurrency(result.custosEstimados.totalMaxBrl, 'BRL')} ({formatCurrency(result.custosEstimados.totalMinClp, 'CLP')} a{' '}
                {formatCurrency(result.custosEstimados.totalMaxClp, 'CLP')})
              </Text>
              <Text style={s.cardMeta}>
                {result.custosEstimados.avisoEstimativa} · Honorários de Assessoria D&amp;M: A consultar mediante proposta personalizada.
              </Text>
              {result.custosEstimados.itensDetalhados.map((item, idx) => (
                <Text key={idx} style={s.paragraph}>
                  • {item.label}: {item.valorTexto}
                </Text>
              ))}
            </View>
          )}
          <View style={s.cardBlock} wrap={false}>
            <Text style={s.cardTitle}>Cronograma Estimado em Faixas (Sem garantia de data exata)</Text>
            <Text style={s.paragraph}>• Preparação documental: {result.cronogramaFaixas.preparacaoDocumental}</Text>
            <Text style={s.paragraph}>• Protocolo no SERMIG: {result.cronogramaFaixas.protocoloSermig}</Text>
            <Text style={s.paragraph}>• Resposta do SERMIG: {result.cronogramaFaixas.respostaSermig}</Text>
          </View>
        </View>

        {/* Consolidado Familiar (se aplicável) */}
        {result.diagnosticoPorPessoa.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHeading} minPresenceAhead={40}>5. Consolidado Familiar — Diagnóstico por Pessoa</Text>
            {result.diagnosticoPorPessoa.map((p, idx) => (
              <View key={idx} style={s.cardBlock}>
                <Text style={s.cardTitle}>
                  {p.nome} ({p.papel} · {p.parentesco}) — {p.subcategoriaIndicada}
                </Text>
                <Text style={s.paragraph}>{p.observacao}</Text>
                {p.documentosEspecificos.length > 0 && (
                  <Text style={s.cardMeta}>Documentos: {p.documentosEspecificos.join(' · ')}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Comparativo 3 Vias */}
        {result.comparativoMercosul.linhasFixas.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHeading}>Comparativo Lado a Lado (Recomendada × Mercosul 15 × 3ª Opção)</Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '25%' }]}>Critério</Text>
                <Text style={[s.tableHeaderCell, { width: '25%' }]}>Principal</Text>
                <Text style={[s.tableHeaderCell, { width: '25%' }]}>Mercosul 15</Text>
                <Text style={[s.tableHeaderCell, { width: '25%' }]}>3ª Opção</Text>
              </View>
              {result.comparativoMercosul.linhasFixas.map((row) => (
                <View key={row.criterio} style={s.tableRow} wrap={false}>
                  <Text style={[s.tableCell, { width: '25%', fontFamily: 'Helvetica-Bold' }]}>{row.criterio}</Text>
                  <Text style={[s.tableCell, { width: '25%' }]}>{row.principal}</Text>
                  <Text style={[s.tableCell, { width: '25%' }]}>{row.mercosul}</Text>
                  <Text style={[s.tableCell, { width: '25%' }]}>{row.terceiraOpcao}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Checklist de Prontidão */}
        {result.checklistProntidao.itens.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHeading}>
              Checklist Inicial de Documentos (Semáforo {result.checklistProntidao.semaforo} · {result.checklistProntidao.percentualInicial}%)
            </Text>
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '48%' }]}>Documento</Text>
                <Text style={[s.tableHeaderCell, { width: '28%' }]}>Exigências</Text>
                <Text style={[s.tableHeaderCell, { width: '24%' }]}>Situação Inicial</Text>
              </View>
              {result.checklistProntidao.itens.map((item) => (
                <View key={item.id} style={s.tableRow} wrap={false}>
                  <Text style={[s.tableCell, { width: '48%', fontFamily: 'Helvetica-Bold' }]}>{item.nomeDocumento}</Text>
                  <Text style={[s.tableCell, { width: '28%' }]}>
                    {item.obrigatorio ? 'Obrigatório' : 'Opcional'}
                    {item.exigeApostila ? ' · Apostila' : ''}
                    {item.exigeTraducao ? ' · Tradução' : ''}
                  </Text>
                  <Text style={[s.tableCell, { width: '24%' }]}>{item.statusInicial}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Rascunho IA se gerado */}
        {aiDraft && aiDraft.resumoExecutivo && (
          <View style={s.section}>
            <Text style={s.sectionHeading} minPresenceAhead={40}>Síntese Complementar ({aiDraft.origemLabel || 'Rascunho Orientativo'})</Text>
            <View style={s.cardBlock}>
              <Text style={s.paragraph}>{aiDraft.resumoExecutivo}</Text>
              {aiDraft.fontesCitadas && aiDraft.fontesCitadas.length > 0 && (
                <Text style={s.cardMeta}>Fontes citadas: {aiDraft.fontesCitadas.join(' · ')}</Text>
              )}
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerLegal}>{safeStr(empresa.avisoLegal)}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export const DossieCasoPdfDocument: React.FC<DossieCasoPdfInput> = ({
  empresa,
  client,
  activeCase,
  dependents,
  docs,
  deadlines,
  thermo,
  assessments = [],
  filterMode = 'all',
  logoDataUrl,
}) => {
  const primary = safeHex(empresa.corPrimaria, '#0F2537');
  const accent = safeHex(empresa.corDestaque, '#C5A059');
  const s = createStyles(primary, accent);
  const generatedAt = formatDateTimeBR(new Date());

  const titleByMode =
    filterMode === 'apostila'
      ? 'Checklist Apostila & Traduções'
      : filterMode === 'pacote'
        ? 'Pacote Consolidado SERMIG (Aprovados)'
        : 'Dossiê Consolidado do Caso';

  const filteredDocs = [...docs]
    .filter((d) => {
      if (filterMode === 'apostila') return d.exigeApostila || d.exigeTraducao;
      if (filterMode === 'pacote') return d.status === 'Aprovado';
      return true;
    })
    .sort((a, b) => a.ordemEmissao - b.ordemEmissao);

  return (
    <Document
      title={`${titleByMode} - ${activeCase.titulo}`}
      author={empresa.nome_empresa}
    >
      <Page size="A4" style={s.page} wrap>
        {renderBrandHeader(
          s,
          empresa,
          'Gestão de Dossiê',
          titleByMode,
          `Gerado em ${generatedAt}`,
          logoDataUrl,
        )}

        {/* Dados do Cliente e Caso */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>1. Ficha do Processo e Termômetro Documental</Text>
          <View style={s.gridTwo}>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>Titular</Text>
              <Text style={s.cellValue}>{safeStr(client?.nomeCompleto)}</Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>Contato (E-mail / WhatsApp)</Text>
              <Text style={s.cellValue}>
                {safeStr(client?.email)} · {safeStr(client?.whatsapp)}
              </Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>Caso &amp; Serviço</Text>
              <Text style={s.cellValue}>
                {safeStr(activeCase.titulo)} ({safeStr(activeCase.tipoServico)})
              </Text>
            </View>
            <View style={s.gridCell}>
              <Text style={s.cellLabel}>SERMIG / Etapa Pipeline</Text>
              <Text style={s.cellValue}>
                {safeStr(activeCase.statusSermig)} · Etapa {activeCase.etapaPipeline}/15
                {activeCase.numeroPedidoSermig ? ` (${activeCase.numeroPedidoSermig})` : ''}
              </Text>
            </View>
          </View>

          <View style={[s.cardBlock, { marginTop: 8 }]}>
            <Text style={s.kpiLabel}>
              Termômetro de Prontidão Documental ({thermo.faixa}): {thermo.notaGeral}% · {thermo.faltantesObrigatorios}{' '}
              obrigatório(s) pendente(s) · {dependents.length} dependente(s) vinculado(s)
            </Text>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  { width: `${Math.min(100, Math.max(4, thermo.notaGeral))}%`, backgroundColor: safeHex(thermo.corHex, primary) },
                ]}
              />
            </View>
          </View>
        </View>

        {/* Tabela Documental */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>2. Relação Documental ({filteredDocs.length} item(ns))</Text>
          {filteredDocs.length === 0 ? (
            <Text style={s.paragraph}>Nenhum documento correspondente a este recorte.</Text>
          ) : (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '8%' }]}>#</Text>
                <Text style={[s.tableHeaderCell, { width: '16%' }]}>Pessoa</Text>
                <Text style={[s.tableHeaderCell, { width: '30%' }]}>Documento</Text>
                <Text style={[s.tableHeaderCell, { width: '18%' }]}>Apost./Trad.</Text>
                <Text style={[s.tableHeaderCell, { width: '14%' }]}>Status</Text>
                <Text style={[s.tableHeaderCell, { width: '14%' }]}>Validade</Text>
              </View>
              {filteredDocs.map((d) => (
                <View key={d.id} style={s.tableRow} wrap={false}>
                  <Text style={[s.tableCell, { width: '8%', fontFamily: 'Helvetica-Bold' }]}>#{d.ordemEmissao}</Text>
                  <Text style={[s.tableCell, { width: '16%' }]}>{safeStr(d.pessoa)}</Text>
                  <Text style={[s.tableCell, { width: '30%', fontFamily: 'Helvetica-Bold' }]}>{safeStr(d.nomeDocumento)}</Text>
                  <Text style={[s.tableCell, { width: '18%' }]}>
                    {d.exigeApostila ? (d.apostilado ? 'Apost. OK' : 'Apost. Pend.') : 'S/ Apost.'} /{' '}
                    {d.exigeTraducao ? (d.traduzido ? 'Trad. OK' : 'Trad. Pend.') : 'S/ Trad.'}
                  </Text>
                  <Text
                    style={[
                      s.tableCell,
                      {
                        width: '14%',
                        fontFamily: 'Helvetica-Bold',
                        color: d.status === 'Aprovado' ? '#1E7E34' : d.status === 'Reprovado' ? '#C82333' : '#334155',
                      },
                    ]}
                  >
                    {d.status}
                  </Text>
                  <Text style={[s.tableCell, { width: '14%' }]}>
                    {d.dataValidadeCalculada ? formatDateBR(d.dataValidadeCalculada) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Prazos do Processo */}
        {deadlines.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionHeading}>3. Prazos e Marcos Legais ({deadlines.length})</Text>
            {deadlines.map((dl) => (
              <View key={dl.id} style={s.cardBlock} wrap={false}>
                <Text style={s.cardTitle}>
                  {dl.titulo} — {formatDateBR(dl.dataLimite)} ({dl.concluido ? 'Concluído' : 'Ativo'})
                </Text>
                <Text style={s.cardMeta}>Categoria: {dl.tipo}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Parecer Mais Recente */}
        {assessments[0] && (
          <View style={s.section}>
            <Text style={s.sectionHeading} minPresenceAhead={40}>Parecer Técnico Associado (v{assessments[0].versao})</Text>
            <View style={s.cardBlock}>
              <Text style={s.paragraph}>{safeStr(assessments[0].enquadramentoLegal)}</Text>
              <Text style={s.paragraph}>{safeStr(assessments[0].recomendacoes)}</Text>
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerLegal}>{safeStr(empresa.avisoLegal)}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export const ResumoProcessoClientePdfDocument: React.FC<ResumoProcessoClientePdfInput> = ({
  empresa,
  client,
  activeCase,
  cases = [],
  clients = [],
  tasks,
  docs,
  overview,
  logoDataUrl,
}) => {
  const primary = safeHex(empresa.corPrimaria, '#0F2537');
  const accent = safeHex(empresa.corDestaque, '#C5A059');
  const s = createStyles(primary, accent);
  const generatedAt = formatDateTimeBR(new Date());

  const clientMap = new Map(clients.map((c) => [c.id, c]));
  const activeCasesList = cases.filter((c) => !c.arquivado);
  const currentStageMeta = activeCase
    ? PIPELINE_STAGES.find((st) => st.numero === activeCase.etapaPipeline)
    : null;

  const submittedDocs = docs
    .filter(
      (d) =>
        d.status !== 'Pendente' ||
        Boolean(d.arquivoUrl) ||
        (d.anexos && d.anexos.length > 0) ||
        (d.historicoVersoes && d.historicoVersoes.length > 0),
    )
    .sort((a, b) => {
      const da = a.analisadoEm || a.updatedAt || a.anexos?.[0]?.data || '';
      const db = b.analisadoEm || b.updatedAt || b.anexos?.[0]?.data || '';
      return db.localeCompare(da) || a.ordemEmissao - b.ordemEmissao;
    });

  const approvedDocsCount = docs.filter((d) => d.status === 'Aprovado').length;
  const reviewDocsCount = docs.filter((d) => d.status === 'Enviado' || d.status === 'Em análise').length;
  const pendingUploadCount = Math.max(0, docs.length - submittedDocs.length);

  const sortedTasks = [...tasks].sort((a, b) => {
    const rank: Record<Task['status'], number> = { 'Em andamento': 0, Pendente: 1, 'Concluída': 2 };
    return (rank[a.status] ?? 3) - (rank[b.status] ?? 3) || (a.prazo || '9999').localeCompare(b.prazo || '9999');
  });

  return (
    <Document
      title={`Resumo do Processo - ${client?.nomeCompleto || activeCase?.titulo || 'Consolidado'}`}
      author={empresa.nome_empresa}
    >
      <Page size="A4" style={s.page} wrap>
        <View style={s.headerBand}>
          <View style={s.brandWrap}>
            {logoDataUrl && <Image src={logoDataUrl} style={s.headerLogo} />}
            <View>
              <Text style={s.brandName}>{safeStr(empresa.nome_empresa)}</Text>
              <Text style={s.brandSub}>{safeStr(empresa.razao_social_cnpj_rut)}</Text>
              <Text style={s.brandSub}>
                {safeStr(empresa.whatsapp)} · {safeStr(empresa.email)}
              </Text>
            </View>
          </View>
          <View style={s.docTitleWrap}>
            <Text style={s.docEyebrow}>ACOMPANHAMENTO DO PROCESSO</Text>
            <Text style={s.docTitle}>Resumo de Status, Tarefas e Documentos</Text>
            <Text style={s.docDate}>Emitido em {generatedAt}</Text>
          </View>
        </View>

        {/* 1. Status Atual do Processo */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>1. Resumo do Status Atual do Processo</Text>
          {activeCase ? (
            <>
              <View style={s.cardBlock}>
                <Text style={s.cardTitle}>{safeStr(activeCase.titulo)}</Text>
                <Text style={s.cardMeta}>
                  Titular: {safeStr(client?.nomeCompleto)} · Tipo: {safeStr(activeCase.tipoServico)} · Status SERMIG:{' '}
                  {safeStr(activeCase.statusSermig)}
                </Text>
              </View>
              <View style={s.gridTwo}>
                <View style={s.gridCell}>
                  <Text style={s.cellLabel}>Etapa no Fluxo Operacional</Text>
                  <Text style={s.cellValue}>
                    Etapa {activeCase.etapaPipeline} de 15{currentStageMeta ? ` — ${currentStageMeta.nome}` : ''}
                  </Text>
                </View>
                <View style={s.gridCell}>
                  <Text style={s.cellLabel}>Protocolo SERMIG</Text>
                  <Text style={s.cellValue}>{safeStr(activeCase.numeroPedidoSermig, 'Aguardando protocolo')}</Text>
                </View>
                <View style={s.gridCell}>
                  <Text style={s.cellLabel}>Data de Protocolo / Entrada Limite</Text>
                  <Text style={s.cellValue}>
                    {activeCase.dataProtocolo ? formatDateBR(activeCase.dataProtocolo) : '—'}
                    {activeCase.dataLimiteEntrada ? ` · Limite entrada: ${formatDateBR(activeCase.dataLimiteEntrada)}` : ''}
                  </Text>
                </View>
                <View style={s.gridCell}>
                  <Text style={s.cellLabel}>Vencimento Residência</Text>
                  <Text style={s.cellValue}>
                    {activeCase.dataVencimentoResidencia ? formatDateBR(activeCase.dataVencimentoResidencia) : 'Não aplicável'}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '28%' }]}>Cliente</Text>
                <Text style={[s.tableHeaderCell, { width: '32%' }]}>Processo</Text>
                <Text style={[s.tableHeaderCell, { width: '20%' }]}>Etapa</Text>
                <Text style={[s.tableHeaderCell, { width: '20%' }]}>Status SERMIG</Text>
              </View>
              {activeCasesList.length === 0 ? (
                <View style={s.tableRow}>
                  <Text style={[s.tableCell, { width: '100%' }]}>Nenhum processo ativo cadastrado.</Text>
                </View>
              ) : (
                activeCasesList.map((c) => {
                  const cli = clientMap.get(c.clientId);
                  return (
                    <View key={c.id} style={s.tableRow} wrap={false}>
                      <Text style={[s.tableCell, { width: '28%', fontFamily: 'Helvetica-Bold' }]}>
                        {safeStr(cli?.nomeCompleto)}
                      </Text>
                      <Text style={[s.tableCell, { width: '32%' }]}>{safeStr(c.titulo)}</Text>
                      <Text style={[s.tableCell, { width: '20%' }]}>Etapa {c.etapaPipeline}/15</Text>
                      <Text style={[s.tableCell, { width: '20%' }]}>{safeStr(c.statusSermig)}</Text>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        {/* 2. Progresso das Tarefas */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>2. Progresso das Tarefas ({overview.concluidoPct}% concluído)</Text>
          <View style={s.cardBlock}>
            <Text style={s.kpiLabel}>
              {overview.activeLabel} — {overview.completedTasks} de {overview.totalTasks} tarefa(s) concluída(s)
            </Text>
            <View style={s.progressTrack}>
              <View
                style={[
                  s.progressFill,
                  {
                    width: `${Math.min(100, Math.max(overview.concluidoPct > 0 ? 4 : 0, overview.concluidoPct))}%`,
                    backgroundColor: overview.concluidoPct >= 80 ? '#16A34A' : primary,
                  },
                ]}
              />
            </View>
          </View>

          <View style={s.kpiRow}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Total de Tarefas</Text>
              <Text style={s.kpiValue}>{overview.totalTasks}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Concluídas</Text>
              <Text style={[s.kpiValue, { color: '#16A34A' }]}>{overview.completedTasks}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Em Andamento</Text>
              <Text style={[s.kpiValue, { color: '#D97706' }]}>{overview.inProgressTasks}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Pendentes</Text>
              <Text style={s.kpiValue}>{overview.pendingTasks}</Text>
            </View>
          </View>

          {sortedTasks.length === 0 ? (
            <Text style={s.paragraph}>Nenhuma tarefa cadastrada para este filtro até o momento.</Text>
          ) : (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '50%' }]}>Tarefa</Text>
                <Text style={[s.tableHeaderCell, { width: '16%' }]}>Prioridade</Text>
                <Text style={[s.tableHeaderCell, { width: '16%' }]}>Prazo</Text>
                <Text style={[s.tableHeaderCell, { width: '18%' }]}>Status</Text>
              </View>
              {sortedTasks.map((t) => (
                <View key={t.id} style={s.tableRow} wrap={false}>
                  <Text style={[s.tableCell, { width: '50%', fontFamily: 'Helvetica-Bold' }]}>
                    {safeStr(t.titulo)}
                  </Text>
                  <Text style={[s.tableCell, { width: '16%' }]}>{safeStr(t.prioridade)}</Text>
                  <Text style={[s.tableCell, { width: '16%' }]}>{t.prazo ? formatDateBR(t.prazo) : '—'}</Text>
                  <Text
                    style={[
                      s.tableCell,
                      {
                        width: '18%',
                        fontFamily: 'Helvetica-Bold',
                        color:
                          t.status === 'Concluída'
                            ? '#16A34A'
                            : t.status === 'Em andamento'
                              ? '#D97706'
                              : '#475569',
                      },
                    ]}
                  >
                    {t.status}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 3. Histórico de Documentos Enviados */}
        <View style={s.section}>
          <Text style={s.sectionHeading}>
            3. Histórico de Documentos Enviados ({submittedDocs.length} registro(s))
          </Text>
          <View style={s.kpiRow}>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Enviados / Em Histórico</Text>
              <Text style={s.kpiValue}>{submittedDocs.length}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Aprovados</Text>
              <Text style={[s.kpiValue, { color: '#16A34A' }]}>{approvedDocsCount}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Em Conferência</Text>
              <Text style={[s.kpiValue, { color: '#D97706' }]}>{reviewDocsCount}</Text>
            </View>
            <View style={s.kpiBox}>
              <Text style={s.kpiLabel}>Aguardando Envio</Text>
              <Text style={s.kpiValue}>{pendingUploadCount}</Text>
            </View>
          </View>

          {submittedDocs.length === 0 ? (
            <Text style={s.paragraph}>
              Nenhum documento foi enviado até o momento ({pendingUploadCount} item(ns) aguardando envio pelo cliente).
            </Text>
          ) : (
            <View style={s.table}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: '34%' }]}>Documento / Pessoa</Text>
                <Text style={[s.tableHeaderCell, { width: '12%' }]}>Versão</Text>
                <Text style={[s.tableHeaderCell, { width: '16%' }]}>Data Ref.</Text>
                <Text style={[s.tableHeaderCell, { width: '20%' }]}>Apost. / Trad.</Text>
                <Text style={[s.tableHeaderCell, { width: '18%' }]}>Status</Text>
              </View>
              {submittedDocs.map((d) => {
                const lastDate =
                  d.analisadoEm ||
                  d.anexos?.[d.anexos.length - 1]?.data ||
                  d.historicoVersoes?.[d.historicoVersoes.length - 1]?.data ||
                  d.updatedAt;
                const versionCount = d.historicoVersoes?.length || 0;
                const attachCount = d.anexos?.length || 0;
                return (
                  <View key={d.id} style={s.tableRow} wrap={false}>
                    <View style={{ width: '34%', paddingRight: 4 }}>
                      <Text style={[s.tableCell, { fontFamily: 'Helvetica-Bold' }]}>
                        {safeStr(d.nomeDocumento)}
                      </Text>
                      <Text style={[s.cardMeta, { marginBottom: 0, marginTop: 1 }]}>
                        {safeStr(d.pessoa)}
                        {d.arquivoNome ? ` · ${d.arquivoNome}` : ''}
                        {attachCount > 1 ? ` (${attachCount} anexos)` : ''}
                      </Text>
                    </View>
                    <Text style={[s.tableCell, { width: '12%' }]}>
                      v{d.versao || 1}
                      {versionCount > 0 ? ` (+${versionCount})` : ''}
                    </Text>
                    <Text style={[s.tableCell, { width: '16%' }]}>
                      {lastDate ? formatDateBR(lastDate) : '—'}
                    </Text>
                    <Text style={[s.tableCell, { width: '20%' }]}>
                      {d.exigeApostila ? (d.apostilado ? 'Apost. OK' : 'Apost. Pend.') : 'S/ Apost.'} /{' '}
                      {d.exigeTraducao ? (d.traduzido ? 'Trad. OK' : 'Trad. Pend.') : 'S/ Trad.'}
                    </Text>
                    <Text
                      style={[
                        s.tableCell,
                        {
                          width: '18%',
                          fontFamily: 'Helvetica-Bold',
                          color:
                            d.status === 'Aprovado'
                              ? '#16A34A'
                              : d.status === 'Reprovado' || d.status === 'Vencido'
                                ? '#C82333'
                                : '#D97706',
                        },
                      ]}
                    >
                      {d.status}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerLegal}>{safeStr(empresa.avisoLegal)}</Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export function triggerPdfBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function buildDiagnosticoPdfBlob(input: DiagnosticoPdfInput): Promise<{ blob: Blob; filename: string }> {
  const logoDataUrl = input.logoDataUrl ?? (await resolvePdfLogoDataUrl(input.empresa.logoUrl));
  const blob = await pdf(<DiagnosticoPdfDocument {...input} logoDataUrl={logoDataUrl} />).toBlob();
  const filename = formatStandardDocFilename(
    input.client?.nomeCompleto || input.lead?.nome || 'CLIENTE',
    'DIAGNOSTICO_VIABILIDADE',
    toIsoDate(new Date()),
    'pdf',
  );
  return { blob, filename };
}

export async function exportDiagnosticoPdf(input: DiagnosticoPdfInput): Promise<string> {
  const { blob, filename } = await buildDiagnosticoPdfBlob(input);
  triggerPdfBlobDownload(blob, filename);
  return filename;
}

export async function buildProgressoPdfBlob(input: ProgressoPdfInput): Promise<{ blob: Blob; filename: string }> {
  const logoDataUrl = input.logoDataUrl ?? (await resolvePdfLogoDataUrl(input.empresa.logoUrl));
  const blob = await pdf(<RelatorioProgressoPdfDocument {...input} logoDataUrl={logoDataUrl} />).toBlob();
  const filename = formatStandardDocFilename(
    input.client?.nomeCompleto || 'CLIENTE',
    'RELATORIO_PROGRESSO',
    toIsoDate(new Date()),
    'pdf',
  );
  return { blob, filename };
}

export async function exportProgressoPdf(input: ProgressoPdfInput): Promise<string> {
  const { blob, filename } = await buildProgressoPdfBlob(input);
  triggerPdfBlobDownload(blob, filename);
  return filename;
}

export async function buildDiagnosticoCompletoPdfBlob(
  input: DiagnosticoCompletoPdfInput,
): Promise<{ blob: Blob; filename: string }> {
  const logoDataUrl = input.logoDataUrl ?? (await resolvePdfLogoDataUrl(input.empresa.logoUrl));
  const blob = await pdf(<DiagnosticoCompletoPdfDocument {...input} logoDataUrl={logoDataUrl} />).toBlob();
  const filename = formatStandardDocFilename(
    input.answers.nome || 'SOLICITANTE',
    'DIAGNOSTICO_COMPLETO',
    toIsoDate(new Date()),
    'pdf',
  );
  return { blob, filename };
}

export async function exportDiagnosticoCompletoPdf(input: DiagnosticoCompletoPdfInput): Promise<string> {
  const { blob, filename } = await buildDiagnosticoCompletoPdfBlob(input);
  triggerPdfBlobDownload(blob, filename);
  return filename;
}

export async function buildDossieCasoPdfBlob(input: DossieCasoPdfInput): Promise<{ blob: Blob; filename: string }> {
  const logoDataUrl = input.logoDataUrl ?? (await resolvePdfLogoDataUrl(input.empresa.logoUrl));
  const blob = await pdf(<DossieCasoPdfDocument {...input} logoDataUrl={logoDataUrl} />).toBlob();
  const docTag =
    input.filterMode === 'apostila'
      ? 'CHECKLIST_APOSTILA'
      : input.filterMode === 'pacote'
        ? 'PACOTE_SERMIG'
        : 'DOSSIE_CASO';
  const filename = formatStandardDocFilename(
    input.client?.nomeCompleto || input.activeCase.titulo || 'CASO',
    docTag,
    toIsoDate(new Date()),
    'pdf',
  );
  return { blob, filename };
}

export async function exportDossieCasoPdf(input: DossieCasoPdfInput): Promise<string> {
  const { blob, filename } = await buildDossieCasoPdfBlob(input);
  triggerPdfBlobDownload(blob, filename);
  return filename;
}

export async function buildResumoProcessoClientePdfBlob(
  input: ResumoProcessoClientePdfInput,
): Promise<{ blob: Blob; filename: string }> {
  const logoDataUrl = input.logoDataUrl ?? (await resolvePdfLogoDataUrl(input.empresa.logoUrl));
  const blob = await pdf(<ResumoProcessoClientePdfDocument {...input} logoDataUrl={logoDataUrl} />).toBlob();
  const filename = formatStandardDocFilename(
    input.client?.nomeCompleto || input.activeCase?.titulo || 'PROCESSOS_ATIVOS',
    'RESUMO_STATUS_PROCESSO',
    toIsoDate(new Date()),
    'pdf',
  );
  return { blob, filename };
}

export async function exportResumoProcessoClientePdf(
  input: ResumoProcessoClientePdfInput,
): Promise<string> {
  const { blob, filename } = await buildResumoProcessoClientePdfBlob(input);
  triggerPdfBlobDownload(blob, filename);
  return filename;
}

function htmlToParagraphLines(raw: string): string[] {
  const normalized = (raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\r\n/g, '\n');

  return normalized
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trimEnd());
}

/**
 * Documento oficial multi-páginas A4 (Contratos, Recibos, Termos LGPD, Procurações e Aditivos)
 * com quebra automática ilimitada de folhas, cabeçalho institucional e numeração Pág. X / Y.
 */
export const GeneratedOfficialDocPdfDocument: React.FC<GeneratedOfficialDocPdfInput> = ({
  empresa,
  titulo,
  conteudo,
  codigoVerificacao,
  versao = 1,
  status,
  clienteNome,
  assinaturaDataUrl,
  assinadoEm,
  confirmadoLeituraEm,
  canceladoMotivo,
  logoDataUrl,
}) => {
  const primary = safeHex(empresa.corPrimaria, '#0F2537');
  const accent = safeHex(empresa.corDestaque, '#C5A059');
  const s = createStyles(primary, accent);
  const generatedAt = formatDateTimeBR(new Date());
  const lines = htmlToParagraphLines(conteudo);

  return (
    <Document title={safeStr(titulo, 'Documento Oficial')} author={empresa.nome_empresa}>
      <Page size="A4" style={s.page} wrap>
        {renderBrandHeader(
          s,
          empresa,
          codigoVerificacao ? `Verificação ${codigoVerificacao} · v${versao}` : `Versão ${versao}`,
          safeStr(titulo, 'Documento Oficial'),
          `${status ? `${status} · ` : ''}Emitido em ${generatedAt}`,
          logoDataUrl,
        )}

        {canceladoMotivo ? (
          <View style={s.alertBlock} wrap={false}>
            <Text style={[s.paragraph, { color: '#991B1B', fontFamily: 'Helvetica-Bold', marginBottom: 0 }]}>
              DOCUMENTO CANCELADO — SEM VALIDADE ({canceladoMotivo})
            </Text>
          </View>
        ) : null}

        {clienteNome ? (
          <View style={[s.cardBlock, { marginBottom: 10 }]} wrap={false}>
            <Text style={s.cardMeta}>
              Titular / Destinatário: {clienteNome}
              {codigoVerificacao ? ` · Código de verificação: ${codigoVerificacao}` : ''}
            </Text>
          </View>
        ) : null}

        <View style={s.section}>
          {lines.map((line, idx) => {
            if (!line.trim()) {
              return <View key={idx} style={{ height: 6 }} />;
            }
            const isClauseHeading =
              /^(CLÁUSULA|CLAUSULA|RECIBO|TERMO|CONTRATO|ADITIVO|PROCURAÇÃO|PROCURACAO|\d+\.\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{3,})/.test(
                line.trim(),
              );
            return (
              <Text
                key={idx}
                style={
                  isClauseHeading
                    ? [s.cardTitle, { marginTop: 6, marginBottom: 3, color: primary }]
                    : [s.paragraph, { lineHeight: 1.5, marginBottom: 3 }]
                }
                minPresenceAhead={isClauseHeading ? 36 : undefined}
              >
                {line}
              </Text>
            );
          })}
        </View>

        {(assinaturaDataUrl || confirmadoLeituraEm) && (
          <View style={[s.cardBlock, { marginTop: 10 }]} wrap={false}>
            {assinaturaDataUrl && (
              <>
                <Text style={s.cardTitle}>
                  Assinatura Eletrônica Registrada{assinadoEm ? ` (${formatDateTimeBR(assinadoEm)})` : ''}
                </Text>
                <Image
                  src={assinaturaDataUrl}
                  style={{ height: 48, width: 180, objectFit: 'contain', marginTop: 4, marginBottom: 4 }}
                />
              </>
            )}
            {confirmadoLeituraEm && (
              <Text style={s.cardMeta}>
                Leitura confirmada pelo cliente em {formatDateTimeBR(confirmadoLeituraEm)}.
              </Text>
            )}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerLegal}>
            {safeStr(empresa.avisoLegal)}
            {codigoVerificacao ? ` · Cód. ${codigoVerificacao}` : ''}
          </Text>
          <Text
            style={s.footerPage}
            render={({ pageNumber, totalPages }) => `Pág. ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};

export async function buildGeneratedOfficialDocPdfBlob(
  input: GeneratedOfficialDocPdfInput,
): Promise<{ blob: Blob; filename: string }> {
  const logoDataUrl = input.logoDataUrl ?? (await resolvePdfLogoDataUrl(input.empresa.logoUrl));
  const blob = await pdf(<GeneratedOfficialDocPdfDocument {...input} logoDataUrl={logoDataUrl} />).toBlob();
  const filename = formatStandardDocFilename(
    input.clienteNome || 'DOCUMENTO',
    input.titulo || 'DOCUMENTO_OFICIAL',
    toIsoDate(new Date()),
    'pdf',
  );
  return { blob, filename };
}

export async function exportGeneratedOfficialDocPdf(input: GeneratedOfficialDocPdfInput): Promise<string> {
  const { blob, filename } = await buildGeneratedOfficialDocPdfBlob(input);
  triggerPdfBlobDownload(blob, filename);
  return filename;
}
