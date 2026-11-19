import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { resolvePdfLogoDataUrl } from './ClientPortalPdfDocuments';
import {
  buildFunnelPerformancePdfModel,
  type FunnelPdfPagePlan,
  type FunnelPerformancePdfInput,
  type FunnelPerformancePdfModel,
} from '../../utils/funnelPerformancePdfModel';
import type { FunnelTransitionMetric } from '../../utils/funnelPerformanceModel';
import { sanitizeHtml2CanvasClone } from '../../utils/visualProgressPdf';

const FONT_STACK = "'Plus Jakarta Sans', 'DM Sans', Arial, Helvetica, sans-serif";

const CrestSvg: React.FC<{ primary: string; accent: string }> = ({ primary, accent }) => (
  <svg
    width="44"
    height="44"
    viewBox="0 0 48 48"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <rect x="1" y="1" width="46" height="46" rx="10" fill={primary} stroke={accent} strokeWidth="2" />
    <rect x="5" y="5" width="38" height="38" rx="7" fill="none" stroke={accent} strokeOpacity="0.45" strokeWidth="1" />
    <text
      x="24"
      y="27"
      textAnchor="middle"
      fill="#FFFFFF"
      fontSize="14.5"
      fontWeight="800"
      fontFamily="Plus Jakarta Sans, Arial, sans-serif"
      letterSpacing="-0.5"
    >
      D&amp;M
    </text>
    <text
      x="24"
      y="37"
      textAnchor="middle"
      fill={accent}
      fontSize="5.8"
      fontWeight="700"
      fontFamily="Plus Jakarta Sans, Arial, sans-serif"
      letterSpacing="1.2"
    >
      CHILE
    </text>
  </svg>
);

function getTransitionPalette(t: FunnelTransitionMetric): {
  label: string;
  bar: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
} {
  if (t.conversionPct === null) {
    return {
      label: 'Sem volume',
      bar: '#94A3B8',
      badgeBg: '#F8FAFC',
      badgeBorder: '#CBD5E1',
      badgeText: '#475569',
    };
  }
  if (t.isPrimaryBottleneck) {
    return {
      label: 'Gargalo prioritário',
      bar: '#C82333',
      badgeBg: '#FEF2F2',
      badgeBorder: '#FECACA',
      badgeText: '#991B1B',
    };
  }
  if (t.health === 'critical') {
    return {
      label: 'Queda elevada',
      bar: '#C82333',
      badgeBg: '#FEF2F2',
      badgeBorder: '#FECACA',
      badgeText: '#991B1B',
    };
  }
  if (t.health === 'attention') {
    return {
      label: 'Atenção',
      bar: '#D97706',
      badgeBg: '#FFFBEB',
      badgeBorder: '#FDE68A',
      badgeText: '#92400E',
    };
  }
  return {
    label: 'Saudável',
    bar: '#1E7E34',
    badgeBg: '#ECFDF5',
    badgeBorder: '#A7F3D0',
    badgeText: '#166534',
  };
}

const PdfHeader: React.FC<{
  model: FunnelPerformancePdfModel;
  logoDataUrl?: string;
  compact?: boolean;
}> = ({ model, logoDataUrl, compact = false }) => (
  <div>
    <div style={{ display: 'flex', height: '5px', width: '100%' }}>
      <div style={{ flex: 3, backgroundColor: model.primaryColor }} />
      <div style={{ flex: 1, backgroundColor: model.accentColor }} />
    </div>
    <div
      style={{
        padding: compact ? '14px 36px 12px 36px' : '20px 36px 16px 36px',
        borderBottom: '1px solid #E2E8F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        backgroundColor: '#FFFFFF',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, maxWidth: '58%' }}>
        {logoDataUrl ? (
          <img
            src={logoDataUrl}
            alt={model.brandName}
            style={{
              height: compact ? '32px' : '42px',
              maxWidth: '128px',
              objectFit: 'contain',
              display: 'block',
              flexShrink: 0,
            }}
          />
        ) : (
          <CrestSvg primary={model.primaryColor} accent={model.accentColor} />
        )}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: compact ? '13px' : '15px',
              fontWeight: 800,
              color: model.primaryColor,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {model.brandName}
          </div>
          {!compact && model.brandSub && (
            <div style={{ fontSize: '9px', color: '#475569', marginTop: '3px', lineHeight: 1.3 }}>
              {model.brandSub}
            </div>
          )}
          {!compact && model.contactLine && (
            <div style={{ fontSize: '8.5px', color: '#64748B', marginTop: '2px', lineHeight: 1.3 }}>
              {model.contactLine}
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontSize: '8px',
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#9A7214',
          }}
        >
          Relatório Gerencial · Funil Comercial
        </div>
        <div
          style={{
            fontSize: compact ? '12px' : '14px',
            fontWeight: 800,
            color: '#0F172A',
            marginTop: '2px',
            letterSpacing: '-0.015em',
          }}
        >
          Conversão entre Etapas &amp; Gargalos
        </div>
        <div style={{ fontSize: '9px', color: '#334155', fontWeight: 600, marginTop: '2px' }}>
          {model.periodLabel}
        </div>
        <div style={{ fontSize: '8.5px', color: '#64748B', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
          Emitido em {model.generatedAt}
        </div>
      </div>
    </div>
  </div>
);

const PdfFooter: React.FC<{ model: FunnelPerformancePdfModel; page: FunnelPdfPagePlan }> = ({
  model,
  page,
}) => (
  <div
    style={{
      marginTop: 'auto',
      padding: '10px 36px 15px 36px',
      borderTop: '1px solid #E2E8F0',
      backgroundColor: '#F8FAFC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}
  >
    <div style={{ fontSize: '8.5px', color: '#64748B', flex: 1 }}>
      {model.brandName} · Documento confidencial de gestão interna ({model.periodLabel}).
    </div>
    <div
      style={{
        fontSize: '9px',
        fontWeight: 700,
        color: model.primaryColor,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      Pág. {page.pageNumber} de {page.totalPages}
    </div>
  </div>
);

const FunnelPerformancePageView: React.FC<{
  model: FunnelPerformancePdfModel;
  page: FunnelPdfPagePlan;
  logoDataUrl?: string;
}> = ({ model, page, logoDataUrl }) => {
  const { summary } = model;

  return (
    <div style={{ fontFamily: FONT_STACK, color: '#0F172A', backgroundColor: '#FFFFFF' }}>
      <div
        data-pdf-page={page.pageNumber}
        style={{
          width: '794px',
          height: '1123px',
          backgroundColor: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <PdfHeader model={model} logoDataUrl={logoDataUrl} compact={!page.isFirstPage} />

        <div style={{ padding: '14px 36px 14px 36px', flex: 1, overflow: 'hidden' }}>
          {page.isFirstPage && (
            <>
              {/* 1. KPIs Executivos do Período */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: model.primaryColor,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: '5px',
                  marginBottom: '10px',
                }}
              >
                1. Indicadores Consolidados do Período
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '9px' }}>
                {[
                  {
                    label: 'Base Analisada',
                    value: `${summary.totalAnalyzed}`,
                    sub: `${summary.activeLeadsCount} lead(s) · ${summary.activeCasesCount} processo(s)`,
                    color: '#0F172A',
                  },
                  {
                    label: 'Conversão Comercial',
                    value: `${summary.overallCommercialConversionPct}%`,
                    sub: 'Chegaram à Documentação+',
                    color: model.primaryColor,
                  },
                  {
                    label: 'Conclusão Ponta a Ponta',
                    value: `${summary.endToEndCompletionPct}%`,
                    sub: 'Alcançaram Finalização',
                    color: '#1E7E34',
                  },
                  {
                    label: 'Leads Perdidos',
                    value: `${summary.lostLeadsCount}`,
                    sub: 'Incluídos na base de entrada',
                    color: summary.lostLeadsCount > 0 ? '#C82333' : '#475569',
                  },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px',
                      padding: '10px 11px',
                      backgroundColor: '#F8FAFC',
                    }}
                  >
                    <div style={{ fontSize: '8.5px', fontWeight: 600, color: '#64748B' }}>{kpi.label}</div>
                    <div
                      style={{
                        fontSize: '19px',
                        fontWeight: 800,
                        color: kpi.color,
                        marginTop: '3px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {kpi.value}
                    </div>
                    <div style={{ fontSize: '8px', color: '#64748B', marginTop: '3px' }}>{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Destaque do Gargalo Principal */}
              <div
                style={{
                  marginTop: '12px',
                  border: summary.primaryBottleneck ? '1px solid #FECACA' : '1px solid #BBF7D0',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  backgroundColor: summary.primaryBottleneck ? '#FEF2F2' : '#F0FDF4',
                }}
              >
                <div
                  style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: summary.primaryBottleneck ? '#991B1B' : '#166534',
                  }}
                >
                  {summary.primaryBottleneck ? 'Diagnóstico de Gargalo Prioritário' : 'Status de Fluidez do Funil'}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', marginTop: '3px' }}>
                  {summary.primaryBottleneck
                    ? `${summary.primaryBottleneck.fromStage.nome} → ${summary.primaryBottleneck.toStage.nome}: ${summary.primaryBottleneck.conversionPct}% de conversão (${summary.primaryBottleneck.dropOffPct}% de queda · ${summary.primaryBottleneck.droppedCount} registro(s) retido(s)/perdido(s)).`
                    : 'Nenhum gargalo crítico identificado no recorte selecionado.'}
                </div>
              </div>

              {/* 2. Taxa de Conversão Etapa a Etapa */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: model.primaryColor,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: '5px',
                  marginTop: '16px',
                  marginBottom: '10px',
                }}
              >
                2. Taxa de Conversão &amp; Queda entre Etapas
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.transitions.map((t) => {
                  const pal = getTransitionPalette(t);
                  return (
                    <div
                      key={t.id}
                      style={{
                        border: t.isPrimaryBottleneck ? '1px solid #FECACA' : '1px solid #E2E8F0',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        backgroundColor: t.isPrimaryBottleneck ? '#FFFBFB' : '#FFFFFF',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          marginBottom: '6px',
                        }}
                      >
                        <div style={{ fontSize: '10.5px', fontWeight: 800, color: '#0F172A' }}>
                          {t.fromStage.ordem}. {t.fromStage.nome} → {t.toStage.ordem}. {t.toStage.nome}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              padding: '2px 7px',
                              borderRadius: '4px',
                              backgroundColor: pal.badgeBg,
                              border: `1px solid ${pal.badgeBorder}`,
                              color: pal.badgeText,
                              fontSize: '8.5px',
                              fontWeight: 700,
                            }}
                          >
                            {pal.label}
                          </span>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 800,
                              color: '#0F172A',
                              fontVariantNumeric: 'tabular-nums',
                              minWidth: '38px',
                              textAlign: 'right',
                            }}
                          >
                            {t.conversionPct !== null ? `${t.conversionPct}%` : '—'}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          height: '9px',
                          width: '100%',
                          backgroundColor: '#E2E8F0',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${t.conversionPct ?? 0}%`,
                            height: '100%',
                            backgroundColor: pal.bar,
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '5px',
                          fontSize: '9px',
                          color: '#475569',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <span>
                          {t.enteredCount > 0
                            ? `${t.advancedCount} de ${t.enteredCount} avançaram para ${t.toStage.nome}`
                            : 'Sem registros nesta transição no período'}
                        </span>
                        <span>
                          {t.enteredCount > 0
                            ? `${t.droppedCount} retido(s)/perdido(s) (${t.dropOffPct}% queda)`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 3. Distribuição Atual pelos 5 Marcos */}
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: model.primaryColor,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: '5px',
                  marginTop: '16px',
                  marginBottom: '8px',
                }}
              >
                3. Distribuição de Volume por Marco do Funil
              </div>

              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid #E2E8F0',
                  fontSize: '9.5px',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700 }}>Etapa</th>
                    <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700 }}>Marco de Conversão</th>
                    <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, textAlign: 'right' }}>Leads</th>
                    <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, textAlign: 'right' }}>Processos</th>
                    <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, textAlign: 'right' }}>Total (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {model.stageRows.map((row, idx) => (
                    <tr
                      key={row.stage.id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                      }}
                    >
                      <td style={{ padding: '6px 8px', fontWeight: 700, color: '#0F172A' }}>
                        {row.stage.ordem}. {row.stage.nome}
                      </td>
                      <td style={{ padding: '6px 8px', color: '#475569' }}>{row.stage.marcoConversao}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.leadsCount}
                      </td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {row.casesCount}
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          textAlign: 'right',
                          fontWeight: 700,
                          color: '#0F172A',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {row.totalCount} ({row.sharePct}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Página 2: Breakdowns por Canal e Consultor */}
          {page.showBreakdowns && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <div>
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: model.primaryColor,
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '5px',
                    marginBottom: '8px',
                  }}
                >
                  4. Origem Comercial (Leads)
                </div>
                {model.channelRows.length === 0 ? (
                  <p style={{ fontSize: '9px', color: '#64748B', margin: 0 }}>Sem leads registrados no período.</p>
                ) : (
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '1px solid #E2E8F0',
                      fontSize: '9px',
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                        <th style={{ padding: '5px 7px', fontWeight: 700 }}>Canal</th>
                        <th style={{ padding: '5px 7px', fontWeight: 700, textAlign: 'right' }}>Total</th>
                        <th style={{ padding: '5px 7px', fontWeight: 700, textAlign: 'right' }}>Fech.</th>
                        <th style={{ padding: '5px 7px', fontWeight: 700, textAlign: 'right' }}>Conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.channelRows.slice(0, 6).map((c, idx) => (
                        <tr
                          key={c.origem}
                          style={{
                            borderBottom: '1px solid #E2E8F0',
                            backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                          }}
                        >
                          <td style={{ padding: '5px 7px', fontWeight: 600 }}>{c.origem}</td>
                          <td style={{ padding: '5px 7px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {c.totalLeads}
                          </td>
                          <td style={{ padding: '5px 7px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {c.convertedCount}
                          </td>
                          <td
                            style={{
                              padding: '5px 7px',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {c.conversionPct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <div>
                <div
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 800,
                    color: model.primaryColor,
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '5px',
                    marginBottom: '8px',
                  }}
                >
                  5. Carteira por Responsável
                </div>
                {model.assigneeRows.length === 0 ? (
                  <p style={{ fontSize: '9px', color: '#64748B', margin: 0 }}>Sem carteira ativa no período.</p>
                ) : (
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      border: '1px solid #E2E8F0',
                      fontSize: '9px',
                    }}
                  >
                    <thead>
                      <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                        <th style={{ padding: '5px 7px', fontWeight: 700 }}>Responsável</th>
                        <th style={{ padding: '5px 7px', fontWeight: 700, textAlign: 'right' }}>Leads</th>
                        <th style={{ padding: '5px 7px', fontWeight: 700, textAlign: 'right' }}>Casos</th>
                        <th style={{ padding: '5px 7px', fontWeight: 700, textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {model.assigneeRows.slice(0, 6).map((a, idx) => (
                        <tr
                          key={a.assigneeName}
                          style={{
                            borderBottom: '1px solid #E2E8F0',
                            backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                          }}
                        >
                          <td style={{ padding: '5px 7px', fontWeight: 600 }}>{a.assigneeName}</td>
                          <td style={{ padding: '5px 7px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {a.leadsCount}
                          </td>
                          <td style={{ padding: '5px 7px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                            {a.casesCount}
                          </td>
                          <td
                            style={{
                              padding: '5px 7px',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {a.totalCount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Lista Paginada de Clientes/Leads na Etapa de Gargalo */}
          {page.showRetainedHeader && page.retainedRows.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div
                style={{
                  fontSize: '10.5px',
                  fontWeight: 800,
                  color: model.primaryColor,
                  borderBottom: '1px solid #E2E8F0',
                  paddingBottom: '5px',
                  marginBottom: '8px',
                }}
              >
                6. Registros Concentrados em {model.bottleneckStageName || 'Etapa Prioritária'} (
                {model.retainedTotalCount})
              </div>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  border: '1px solid #E2E8F0',
                  fontSize: '9px',
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
                    <th style={{ padding: '5.5px 7px', fontWeight: 700 }}>Cliente / Lead</th>
                    <th style={{ padding: '5.5px 7px', fontWeight: 700 }}>Tipo</th>
                    <th style={{ padding: '5.5px 7px', fontWeight: 700 }}>Urgência</th>
                    <th style={{ padding: '5.5px 7px', fontWeight: 700 }}>Responsável</th>
                    <th style={{ padding: '5.5px 7px', fontWeight: 700 }}>Criação</th>
                    <th style={{ padding: '5.5px 7px', fontWeight: 700 }}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {page.retainedRows.map((r, idx) => (
                    <tr
                      key={r.id}
                      style={{
                        borderBottom: '1px solid #E2E8F0',
                        backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                      }}
                    >
                      <td style={{ padding: '5.5px 7px', fontWeight: 700, color: '#0F172A' }}>{r.name}</td>
                      <td style={{ padding: '5.5px 7px', color: '#475569' }}>{r.kindLabel}</td>
                      <td style={{ padding: '5.5px 7px', fontWeight: 600, color: '#334155' }}>{r.priority}</td>
                      <td style={{ padding: '5.5px 7px', color: '#475569' }}>{r.assigneeName}</td>
                      <td style={{ padding: '5.5px 7px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                        {r.createdAtLabel}
                      </td>
                      <td style={{ padding: '5.5px 7px', color: '#475569' }}>{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Plano de Ação Gerencial */}
          {page.showRecommendations && model.recommendations.length > 0 && (
            <div
              style={{
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '12px 14px',
                backgroundColor: '#F8FAFC',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: model.primaryColor,
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Recomendações Gerenciais Prioritárias
              </div>
              <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '9.5px', color: '#334155', lineHeight: 1.55 }}>
                {model.recommendations.map((rec, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <PdfFooter model={model} page={page} />
      </div>
    </div>
  );
};

async function waitForPageAssets(container: HTMLElement): Promise<void> {
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const timer = window.setTimeout(resolve, 1500);
          img.addEventListener(
            'load',
            () => {
              window.clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
          img.addEventListener(
            'error',
            () => {
              window.clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        }),
    ),
  );
  await new Promise<void>((resolve) =>
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve())),
  );
}

/**
 * Gera e faz download do Relatório Gerencial em PDF (A4 multipágina) de Conversão e Gargalos do Funil.
 */
export async function exportFunnelPerformancePdf(
  input: FunnelPerformancePdfInput,
): Promise<string> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('A exportação de PDF está disponível apenas no navegador.');
  }

  const logoDataUrl = await resolvePdfLogoDataUrl(input.empresa.logoUrl);
  const model = buildFunnelPerformancePdfModel(input);

  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.position = 'absolute';
  host.style.left = '-12000px';
  host.style.top = '0px';
  host.style.width = '794px';
  host.style.height = '1123px';
  host.style.overflow = 'hidden';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '-1';
  host.style.backgroundColor = '#FFFFFF';
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < model.pages.length; i += 1) {
      const pagePlan = model.pages[i];
      root.render(
        <FunnelPerformancePageView model={model} page={pagePlan} logoDataUrl={logoDataUrl} />,
      );

      await waitForPageAssets(host);

      const pageEl = host.querySelector<HTMLElement>('[data-pdf-page]');
      if (!pageEl) {
        throw new Error(`Falha ao montar a página ${pagePlan.pageNumber} do relatório PDF.`);
      }

      const canvas = await html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#FFFFFF',
        width: 794,
        height: 1123,
        windowWidth: 794,
        windowHeight: 1123,
        x: 0,
        y: 0,
        scrollX: 0,
        scrollY: 0,
        logging: false,
        onclone: sanitizeHtml2CanvasClone,
      });

      const imgData = canvas.toDataURL('image/png');
      if (i > 0) {
        pdf.addPage();
      }
      pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
    }

    pdf.save(model.filename);
    return model.filename;
  } finally {
    root.unmount();
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
}
