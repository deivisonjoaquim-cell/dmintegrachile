import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { PIPELINE_STAGES } from '../../data/seeds';
import type { Case, CaseDocument, Client, EmpresaConfig, Task } from '../../types/domain';
import type { TaskProgressOverview } from '../../utils/taskProgressMetrics';
import { resolvePdfLogoDataUrl } from './ClientPortalPdfDocuments';
import {
  buildVisualProgressPdfModel,
  sanitizeHtml2CanvasClone,
  type VisualPdfPagePlan,
  type VisualProgressPdfInput,
  type VisualProgressPdfModel,
} from '../../utils/visualProgressPdf';

export interface ExportVisualResumoPdfInput {
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

const FONT_STACK = "'Plus Jakarta Sans', 'DM Sans', Arial, Helvetica, sans-serif";

const DmIntegraCrestSvg: React.FC<{ primary: string; accent: string }> = ({ primary, accent }) => (
  <svg
    width="46"
    height="46"
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

const StatusTag: React.FC<{ label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = ({
  label,
  tone,
}) => {
  const palette = {
    success: { bg: '#ECFDF5', border: '#A7F3D0', text: '#166534' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
    danger: { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
    neutral: { bg: '#F8FAFC', border: '#CBD5E1', text: '#334155' },
  }[tone];

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: '4px',
        backgroundColor: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.text,
        fontSize: '9.5px',
        fontWeight: 700,
        lineHeight: 1.35,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
};

function getTaskTone(status: Task['status']): 'success' | 'warning' | 'neutral' {
  if (status === 'Concluída') return 'success';
  if (status === 'Em andamento') return 'warning';
  return 'neutral';
}

function getDocTone(status: CaseDocument['status']): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'Aprovado') return 'success';
  if (status === 'Reprovado' || status === 'Vencido') return 'danger';
  if (status === 'Enviado' || status === 'Em análise') return 'warning';
  return 'neutral';
}

const PageHeader: React.FC<{
  model: VisualProgressPdfModel;
  logoDataUrl?: string;
  compact?: boolean;
}> = ({ model, logoDataUrl, compact = false }) => {
  return (
    <div>
      {/* Barra arquitetônica superior D&M Integra Chile */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, maxWidth: '62%' }}>
          {logoDataUrl ? (
            <img
              src={logoDataUrl}
              alt={model.brandName}
              style={{
                height: compact ? '34px' : '44px',
                maxWidth: '130px',
                objectFit: 'contain',
                display: 'block',
                flexShrink: 0,
              }}
            />
          ) : null}
          {!logoDataUrl && <DmIntegraCrestSvg primary={model.primaryColor} accent={model.accentColor} />}
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
            {!compact && (
              <>
                <div style={{ fontSize: '9.5px', color: '#475569', marginTop: '3px', lineHeight: 1.3 }}>
                  {model.brandSub}
                </div>
                {model.contactLine && (
                  <div style={{ fontSize: '9px', color: '#64748B', marginTop: '2px', lineHeight: 1.3 }}>
                    {model.contactLine}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontSize: '8.5px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#9A7214',
            }}
          >
            Resumo Executivo do Processo
          </div>
          <div
            style={{
              fontSize: compact ? '12.5px' : '14.5px',
              fontWeight: 800,
              color: '#0F172A',
              marginTop: '2px',
              letterSpacing: '-0.015em',
            }}
          >
            Status, Progresso &amp; Documentos
          </div>
          <div style={{ fontSize: '9px', color: '#64748B', marginTop: '3px', fontVariantNumeric: 'tabular-nums' }}>
            Emitido em {model.generatedAt}
          </div>
        </div>
      </div>
    </div>
  );
};

const PageFooter: React.FC<{ model: VisualProgressPdfModel; page: VisualPdfPagePlan }> = ({ model, page }) => (
  <div
    style={{
      marginTop: 'auto',
      padding: '10px 36px 16px 36px',
      borderTop: '1px solid #E2E8F0',
      backgroundColor: '#F8FAFC',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}
  >
    <div style={{ fontSize: '8.5px', color: '#64748B', lineHeight: 1.35, flex: 1 }}>
      {model.brandName} · Documento orientativo de acompanhamento (não expõe triagem interna).
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

const VisualProgressSection: React.FC<{
  model: VisualProgressPdfModel;
  overview: TaskProgressOverview;
}> = ({ model, overview }) => {
  const progressColor = overview.concluidoPct >= 80 ? '#16A34A' : model.primaryColor;
  const rowsToShow = !model.isSingleCaseView ? overview.rows.slice(0, 5) : [];

  return (
    <div style={{ marginTop: '14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '5px',
          marginBottom: '10px',
        }}
      >
        <div style={{ fontSize: '11.5px', fontWeight: 800, color: model.primaryColor }}>
          2. Resumo Visual do Progresso das Tarefas
        </div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 800,
            color: progressColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {overview.concluidoPct}% concluído
        </div>
      </div>

      {/* Cartão Principal do Gráfico Visual */}
      <div
        style={{
          border: '1px solid #E2E8F0',
          borderRadius: '8px',
          padding: '12px 14px',
          backgroundColor: '#F8FAFC',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#0F172A' }}>
            {overview.activeLabel}
          </span>
          <span style={{ fontSize: '10px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
            {overview.completedTasks} de {overview.totalTasks} tarefa(s) concluída(s)
          </span>
        </div>

        {/* Barra empilhada vetorial nítida */}
        <div
          style={{
            display: 'flex',
            height: '14px',
            width: '100%',
            borderRadius: '6px',
            overflow: 'hidden',
            backgroundColor: '#E2E8F0',
          }}
        >
          {overview.concluidoPct > 0 && (
            <div style={{ width: `${overview.concluidoPct}%`, backgroundColor: '#16A34A', height: '100%' }} />
          )}
          {overview.emAndamentoPct > 0 && (
            <div style={{ width: `${overview.emAndamentoPct}%`, backgroundColor: '#D97706', height: '100%' }} />
          )}
          {overview.pendentePct > 0 && (
            <div style={{ width: `${overview.pendentePct}%`, backgroundColor: '#CBD5E1', height: '100%' }} />
          )}
        </div>

        {/* Legenda */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px',
            marginTop: '8px',
            fontSize: '9.5px',
            color: '#334155',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#16A34A', display: 'inline-block' }} />
            Concluídas: <strong>{overview.completedTasks}</strong> ({overview.concluidoPct}%)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#D97706', display: 'inline-block' }} />
            Em andamento: <strong>{overview.inProgressTasks}</strong> ({overview.emAndamentoPct}%)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '2px', backgroundColor: '#CBD5E1', display: 'inline-block' }} />
            Pendentes: <strong>{overview.pendingTasks}</strong> ({overview.pendentePct}%)
          </span>
        </div>

        {/* Gráfico comparativo por cliente (visão consolidada) */}
        {rowsToShow.length > 0 && (
          <div style={{ marginTop: '11px', paddingTop: '9px', borderTop: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
              Progresso visual por cliente ativo
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {rowsToShow.map((row) => (
                <div
                  key={row.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '9.5px' }}
                >
                  <div
                    style={{
                      width: '150px',
                      fontWeight: 700,
                      color: '#0F172A',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flexShrink: 0,
                    }}
                  >
                    {row.clientName}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      height: '9px',
                      backgroundColor: '#E2E8F0',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      display: 'flex',
                    }}
                  >
                    {row.concluidoPct > 0 && (
                      <div style={{ width: `${row.concluidoPct}%`, backgroundColor: '#16A34A', height: '100%' }} />
                    )}
                    {row.emAndamentoPct > 0 && (
                      <div style={{ width: `${row.emAndamentoPct}%`, backgroundColor: '#D97706', height: '100%' }} />
                    )}
                  </div>
                  <div
                    style={{
                      width: '68px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: '#0F172A',
                      fontVariantNumeric: 'tabular-nums',
                      flexShrink: 0,
                    }}
                  >
                    {row.concluidoPct}% ({row.completedTasks}/{row.totalTasks})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 4 KPIs numéricos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '8px' }}>
        {[
          { label: 'Total de Tarefas', value: overview.totalTasks, color: '#0F172A' },
          { label: 'Concluídas', value: overview.completedTasks, color: '#16A34A' },
          { label: 'Em Andamento', value: overview.inProgressTasks, color: '#D97706' },
          { label: 'Pendentes', value: overview.pendingTasks, color: '#475569' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            style={{
              border: '1px solid #E2E8F0',
              borderRadius: '6px',
              padding: '8px 10px',
              backgroundColor: '#FFFFFF',
            }}
          >
            <div style={{ fontSize: '9px', color: '#64748B' }}>{kpi.label}</div>
            <div
              style={{
                fontSize: '15px',
                fontWeight: 800,
                color: kpi.color,
                marginTop: '2px',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProcessStatusSection: React.FC<{
  model: VisualProgressPdfModel;
  page: VisualPdfPagePlan;
}> = ({ model, page }) => {
  return (
    <div style={{ marginTop: '14px' }}>
      <div
        style={{
          fontSize: '11.5px',
          fontWeight: 800,
          color: model.primaryColor,
          borderBottom: '1px solid #E2E8F0',
          paddingBottom: '5px',
          marginBottom: '10px',
        }}
      >
        1. Status Atual do Processo
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px 10px', backgroundColor: '#FFFFFF' }}>
          <div style={{ fontSize: '8.5px', color: '#64748B' }}>Titular / Escopo</div>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px', lineHeight: 1.3 }}>
            {model.scopeTitle}
          </div>
        </div>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px 10px', backgroundColor: '#FFFFFF' }}>
          <div style={{ fontSize: '8.5px', color: '#64748B' }}>Processo / Visto</div>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px', lineHeight: 1.3 }}>
            {model.scopeSubtitle}
          </div>
        </div>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px 10px', backgroundColor: '#FFFFFF' }}>
          <div style={{ fontSize: '8.5px', color: '#64748B' }}>Etapa Operacional</div>
          <div
            style={{
              fontSize: '10.5px',
              fontWeight: 700,
              color: model.primaryColor,
              marginTop: '2px',
              lineHeight: 1.3,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {model.stageNumber ? `Etapa ${model.stageNumber} de 15` : `${model.totalActiveCases} ativo(s)`}
          </div>
        </div>
        <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px 10px', backgroundColor: '#FFFFFF' }}>
          <div style={{ fontSize: '8.5px', color: '#64748B' }}>Situação SERMIG</div>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#0F172A', marginTop: '2px', lineHeight: 1.3 }}>
            {model.sermigStatus}
            {model.protocoloSermig ? ` · ${model.protocoloSermig}` : ''}
          </div>
        </div>
      </div>

      {/* Stepper visual de 15 etapas para caso específico */}
      {model.stageNumber && (
        <div
          style={{
            marginTop: '9px',
            border: '1px solid #E2E8F0',
            borderRadius: '6px',
            padding: '9px 12px',
            backgroundColor: '#F8FAFC',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#0F172A' }}>
              Marco atual: {model.stageName}
            </span>
            <span style={{ fontSize: '9px', color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round((model.stageNumber / 15) * 100)}% do fluxo operacional
            </span>
          </div>
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
            {PIPELINE_STAGES.map((st) => {
              const done = st.numero < model.stageNumber!;
              const current = st.numero === model.stageNumber!;
              return (
                <div
                  key={st.numero}
                  style={{
                    flex: 1,
                    height: '7px',
                    borderRadius: '3px',
                    backgroundColor: done ? '#16A34A' : current ? model.accentColor : '#E2E8F0',
                    border: current ? `1px solid ${model.primaryColor}` : 'none',
                  }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela resumida de casos na visão consolidada */}
      {page.caseRows.length > 0 && (
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginTop: '9px',
            border: '1px solid #E2E8F0',
            fontSize: '9.5px',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #CBD5E1', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700 }}>Cliente</th>
              <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700 }}>Processo</th>
              <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700 }}>Etapa</th>
              <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700 }}>SERMIG</th>
            </tr>
          </thead>
          <tbody>
            {page.caseRows.map((c, idx) => (
              <tr
                key={c.id}
                style={{
                  borderBottom: '1px solid #E2E8F0',
                  backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                }}
              >
                <td style={{ padding: '5px 8px', fontWeight: 700, color: '#0F172A' }}>{c.clientName}</td>
                <td style={{ padding: '5px 8px', color: '#334155' }}>{c.titulo}</td>
                <td style={{ padding: '5px 8px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{c.etapaLabel}</td>
                <td style={{ padding: '5px 8px', color: '#334155' }}>{c.statusSermig}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const ResumoProcessoSinglePageView: React.FC<{
  model: VisualProgressPdfModel;
  page: VisualPdfPagePlan;
  overview: TaskProgressOverview;
  logoDataUrl?: string;
}> = ({ model, page, overview, logoDataUrl }) => {
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
        <PageHeader model={model} logoDataUrl={logoDataUrl} compact={!page.isFirstPage} />

        <div style={{ padding: '4px 36px 14px 36px', flex: 1, overflow: 'hidden' }}>
            {page.isFirstPage && (
              <>
                <ProcessStatusSection model={model} page={page} />
                <VisualProgressSection model={model} overview={overview} />
              </>
            )}

            {/* Tarefas */}
            {page.showTasksHeader && (
              <div style={{ marginTop: '14px' }}>
                <div
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 800,
                    color: model.primaryColor,
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '5px',
                    marginBottom: '8px',
                  }}
                >
                  3. Progresso das Tarefas Operacionais{!page.isFirstPage ? ' (continuação)' : ''}
                </div>
                {page.showTasksEmpty ? (
                  <div
                    style={{
                      padding: '10px 12px',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '6px',
                      fontSize: '10px',
                      color: '#64748B',
                    }}
                  >
                    Nenhuma tarefa operacional registrada para este processo até o momento.
                  </div>
                ) : (
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
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '52%' }}>Tarefa</th>
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '16%' }}>Prioridade</th>
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '14%' }}>Prazo</th>
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '18%' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.taskRows.map((t, idx) => (
                        <tr
                          key={t.id}
                          style={{
                            borderBottom: '1px solid #E2E8F0',
                            backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                          }}
                        >
                          <td style={{ padding: '5.5px 8px', fontWeight: 600, color: '#0F172A' }}>{t.titulo}</td>
                          <td style={{ padding: '5.5px 8px', color: '#475569' }}>{t.prioridade}</td>
                          <td style={{ padding: '5.5px 8px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            {t.prazo}
                          </td>
                          <td style={{ padding: '5.5px 8px' }}>
                            <StatusTag label={t.status} tone={getTaskTone(t.status)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Histórico de Documentos Enviados */}
            {page.showDocsHeader && (
              <div style={{ marginTop: '14px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #E2E8F0',
                    paddingBottom: '5px',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '11.5px', fontWeight: 800, color: model.primaryColor }}>
                    4. Histórico de Documentos Enviados ({model.submittedDocsCount})
                  </span>
                  <span style={{ fontSize: '9px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                    {model.approvedDocsCount} aprovado(s) · {model.reviewDocsCount} em conferência ·{' '}
                    {model.pendingUploadCount} aguardando envio
                  </span>
                </div>

                {page.showDocsEmpty ? (
                  <div
                    style={{
                      padding: '10px 12px',
                      border: '1px dashed #CBD5E1',
                      borderRadius: '6px',
                      fontSize: '10px',
                      color: '#64748B',
                    }}
                  >
                    Nenhum documento foi enviado até o momento ({model.pendingUploadCount} item(ns) aguardando envio pelo cliente).
                  </div>
                ) : (
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
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '38%' }}>
                          Documento / Titular
                        </th>
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '11%' }}>Versão</th>
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '14%' }}>Data Ref.</th>
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '21%' }}>
                          Apost. / Trad.
                        </th>
                        <th style={{ padding: '6px 8px', color: '#334155', fontWeight: 700, width: '16%' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.docRows.map((d, idx) => (
                        <tr
                          key={d.id}
                          style={{
                            borderBottom: '1px solid #E2E8F0',
                            backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF',
                          }}
                        >
                          <td style={{ padding: '5.5px 8px' }}>
                            <div style={{ fontWeight: 700, color: '#0F172A' }}>{d.nomeDocumento}</div>
                            <div style={{ fontSize: '8.5px', color: '#64748B', marginTop: '1px' }}>
                              {d.pessoa}
                              {d.arquivoNome ? ` · ${d.arquivoNome}` : ''}
                            </div>
                          </td>
                          <td style={{ padding: '5.5px 8px', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>
                            {d.versaoLabel}
                          </td>
                          <td style={{ padding: '5.5px 8px', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
                            {d.dataRef}
                          </td>
                          <td style={{ padding: '5.5px 8px', color: '#475569' }}>{d.formalizacao}</td>
                          <td style={{ padding: '5.5px 8px' }}>
                            <StatusTag label={d.status} tone={getDocTone(d.status)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>

          <PageFooter model={model} page={page} />
      </div>
    </div>
  );
};

async function waitForAssetsReady(container: HTMLElement): Promise<void> {
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

export async function exportResumoProcessoVisualPdf(input: ExportVisualResumoPdfInput): Promise<string> {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('A geração de PDF visual está disponível apenas no navegador.');
  }

  const logoDataUrl = input.logoDataUrl ?? (await resolvePdfLogoDataUrl(input.empresa.logoUrl));
  const modelInput: VisualProgressPdfInput = {
    ...input,
    logoDataUrl,
  };
  const model = buildVisualProgressPdfModel(modelInput);

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
    if (model.pages.length === 0) {
      throw new Error('Nenhuma página foi montada para exportação em PDF.');
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    // Renderiza e captura uma página A4 por vez exatamente na origem (0, 0),
    // evitando o recorte de viewport do html2canvas nas folhas 2, 3, 4+.
    for (let i = 0; i < model.pages.length; i += 1) {
      const pagePlan = model.pages[i];
      root.render(
        <ResumoProcessoSinglePageView
          model={model}
          page={pagePlan}
          overview={input.overview}
          logoDataUrl={logoDataUrl}
        />,
      );

      await waitForAssetsReady(host);

      const pageEl = host.querySelector<HTMLElement>('[data-pdf-page]');
      if (!pageEl) {
        throw new Error(`Falha ao montar a página ${pagePlan.pageNumber} do PDF.`);
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
