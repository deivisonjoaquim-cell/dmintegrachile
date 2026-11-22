import React, { useMemo, useState } from 'react';
import type { BasicDiagnosticDimension } from '../../utils/portalAccess';

interface LiveViabilityGaugeProps {
  score: number;
  confidence?: string;
  size?: number;
}

export const LiveViabilityGauge: React.FC<LiveViabilityGaugeProps> = ({
  score,
  confidence,
  size = 132,
}) => {
  const clamped = Math.max(0, Math.min(100, Math.round(score || 0)));
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  const accentStroke =
    clamped >= 75 ? '#22C55E' : clamped >= 50 ? '#C8A236' : '#F59E0B';

  const toneLabel =
    clamped >= 75 ? 'Alta aderência' : clamped >= 50 ? 'Viável c/ plano' : 'Requer estratégia';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="img"
        aria-label={`Índice de viabilidade ao vivo: ${clamped} de 100`}
      >
        {/* Fundo da trilha */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={strokeWidth}
        />
        {/* Arco dinâmico */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={accentStroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 220ms cubic-bezier(0.22, 1, 0.36, 1), stroke 200ms ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <div className="flex items-baseline gap-0.5">
          <span className="font-mono text-3xl font-bold text-white tabular-nums leading-none">
            {clamped}
          </span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">/100</span>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#E6C55A] mt-1 leading-tight">
          {toneLabel}
        </span>
        {confidence && (
          <span className="text-[10px] text-slate-300 mt-0.5">
            Confiança {confidence}
          </span>
        )}
      </div>
    </div>
  );
};

interface DiagnosticRadarChartProps {
  dimensions: BasicDiagnosticDimension[];
  simulatedDimensions?: BasicDiagnosticDimension[] | null;
}

function abbreviateAxisLabel(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 18) return trimmed;
  const map: Record<string, string> = {
    'Compatibilidade de Perfil': 'Perfil & Objetivo',
    'Conformidade de Localização': 'Jurisdição',
    'Prontidão Documental': 'Documentação',
    'Elegibilidade Normativa': 'Elegibilidade',
    'Regularidade Migratória': 'Histórico Legal',
    'Vínculo / Comprovação': 'Vínculo / Renda',
    'Consistência das Respostas': 'Consistência',
  };
  if (map[trimmed]) return map[trimmed];
  return `${trimmed.slice(0, 16).trim()}…`;
}

export const DiagnosticRadarChart: React.FC<DiagnosticRadarChartProps> = ({
  dimensions,
  simulatedDimensions,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const safeDims = useMemo(() => {
    if (dimensions.length >= 3) return dimensions;
    return [
      ...dimensions,
      ...Array.from({ length: Math.max(0, 3 - dimensions.length) }, (_, idx) => ({
        nome: `Pilar ${idx + 1}`,
        pontos: 0,
        maximo: 10,
        percentual: 0,
        observacao: 'Indicador complementar.',
      })),
    ];
  }, [dimensions]);

  const size = 340;
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = 104;
  const rings = [25, 50, 75, 100];
  const count = safeDims.length;

  const getPoint = (index: number, pct: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (Math.max(6, Math.min(100, pct)) / 100) * maxRadius;
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
      angle,
    };
  };

  const basePolygonPoints = safeDims
    .map((d, i) => {
      const pt = getPoint(i, d.percentual);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  const simPolygonPoints = useMemo(() => {
    if (!simulatedDimensions || simulatedDimensions.length === 0) return null;
    return safeDims
      .map((d, i) => {
        const match = simulatedDimensions.find((s) => s.nome === d.nome) || simulatedDimensions[i];
        const pct = match ? match.percentual : d.percentual;
        const pt = getPoint(i, pct);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      })
      .join(' ');
  }, [simulatedDimensions, safeDims]);

  const selectedDim = activeIndex !== null ? safeDims[activeIndex] : null;
  const selectedSimDim =
    activeIndex !== null && simulatedDimensions
      ? simulatedDimensions.find((s) => s.nome === safeDims[activeIndex]?.nome) ||
        simulatedDimensions[activeIndex] ||
        null
      : null;

  return (
    <div className="space-y-4">
      <div className="relative flex flex-col items-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full max-w-[350px] h-auto select-none overflow-visible"
          role="img"
          aria-label="Gráfico radar dos pilares de viabilidade migratória"
        >
          {/* Anéis concêntricos */}
          {rings.map((ring) => {
            const ringPts = safeDims
              .map((_, i) => {
                const pt = getPoint(i, ring);
                return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
              })
              .join(' ');
            return (
              <polygon
                key={ring}
                points={ringPts}
                fill={ring === 100 ? 'rgba(247, 245, 240, 0.7)' : 'none'}
                stroke="#DDD6C7"
                strokeWidth={ring === 100 ? 1.2 : 0.8}
                strokeDasharray={ring === 100 ? undefined : '2.5 2.5'}
              />
            );
          })}

          {/* Eixos radiais */}
          {safeDims.map((dim, i) => {
            const end = getPoint(i, 100);
            const isSelected = activeIndex === i;
            return (
              <line
                key={dim.nome}
                x1={cx}
                y1={cy}
                x2={end.x}
                y2={end.y}
                stroke={isSelected ? '#C8A236' : '#E5DFD2'}
                strokeWidth={isSelected ? 1.6 : 1}
              />
            );
          })}

          {/* Polígono Base (Perfil Atual) */}
          <polygon
            points={basePolygonPoints}
            fill="rgba(11, 31, 51, 0.16)"
            stroke="#0B1F33"
            strokeWidth={2.2}
            strokeLinejoin="round"
            style={{ transition: 'all 200ms ease' }}
          />

          {/* Polígono Simulado ("E se...") quando ativo */}
          {simPolygonPoints && (
            <polygon
              points={simPolygonPoints}
              fill="rgba(20, 107, 67, 0.16)"
              stroke="#146B43"
              strokeWidth={2.2}
              strokeDasharray="5 3"
              strokeLinejoin="round"
              style={{ transition: 'all 200ms ease' }}
            />
          )}

          {/* Vértices interativos do perfil atual */}
          {safeDims.map((dim, i) => {
            const pt = getPoint(i, dim.percentual);
            const isSelected = activeIndex === i;
            return (
              <g
                key={`node-${dim.nome}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex((prev) => (prev === i ? null : i))}
              >
                <circle cx={pt.x} cy={pt.y} r={11} fill="transparent" />
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isSelected ? 5.5 : 4}
                  fill={isSelected ? '#C8A236' : '#0B1F33'}
                  stroke="#FFFFFF"
                  strokeWidth={1.8}
                />
              </g>
            );
          })}

          {/* Vértices do cenário simulado */}
          {simulatedDimensions &&
            safeDims.map((dim, i) => {
              const match = simulatedDimensions.find((s) => s.nome === dim.nome) || simulatedDimensions[i];
              if (!match) return null;
              const pt = getPoint(i, match.percentual);
              return (
                <circle
                  key={`sim-node-${dim.nome}`}
                  cx={pt.x}
                  cy={pt.y}
                  r={3.5}
                  fill="#146B43"
                  stroke="#FFFFFF"
                  strokeWidth={1.5}
                />
              );
            })}

          {/* Rótulos dos eixos */}
          {safeDims.map((dim, i) => {
            const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
            const labelRadius = maxRadius + 24;
            const lx = cx + labelRadius * Math.cos(angle);
            const ly = cy + labelRadius * Math.sin(angle);
            const anchor =
              Math.abs(Math.cos(angle)) < 0.2
                ? 'middle'
                : Math.cos(angle) > 0
                  ? 'start'
                  : 'end';
            const isSelected = activeIndex === i;
            return (
              <g
                key={`label-${dim.nome}`}
                className="cursor-pointer"
                onMouseEnter={() => setActiveIndex(i)}
                onMouseLeave={() => setActiveIndex(null)}
                onClick={() => setActiveIndex((prev) => (prev === i ? null : i))}
              >
                <text
                  x={lx}
                  y={ly}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="text-[10px] font-semibold"
                  fill={isSelected ? '#0B1F33' : '#4A5A6D'}
                >
                  {abbreviateAxisLabel(dim.nome)}
                </text>
                <text
                  x={lx}
                  y={ly + 12}
                  textAnchor={anchor}
                  dominantBaseline="middle"
                  className="text-[9.5px] font-mono font-bold tabular-nums"
                  fill={isSelected ? '#8C6D14' : '#0B1F33'}
                >
                  {dim.percentual}%
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legenda limpa */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-slate-600 pt-1">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#0B1F33]">
            <span className="w-3 h-0.5 bg-[#0B1F33] inline-block" aria-hidden="true" />
            Perfil atual
          </span>
          {simPolygonPoints && (
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#146B43]">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-[#146B43] inline-block" aria-hidden="true" />
              Cenário simulado (&ldquo;E se...&rdquo;)
            </span>
          )}
        </div>
      </div>

      {/* Painel de inspeção interativo do eixo selecionado */}
      <div className="rounded-xl border border-[#E5DFD2] bg-[#FAF9F6] px-4 py-3 text-xs min-h-[68px] flex flex-col justify-center">
        {selectedDim ? (
          <div className="space-y-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-bold text-[#0B1F33]">{selectedDim.nome}</span>
              <span className="font-mono font-bold text-[#0B1F33] tabular-nums">
                {selectedDim.pontos}/{selectedDim.maximo} pts ({selectedDim.percentual}%)
                {selectedSimDim && selectedSimDim.percentual !== selectedDim.percentual && (
                  <span
                    className={`ml-1.5 ${
                      selectedSimDim.percentual > selectedDim.percentual ? 'text-[#146B43]' : 'text-[#A61C2B]'
                    }`}
                  >
                    → {selectedSimDim.percentual}%
                  </span>
                )}
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">{selectedDim.observacao}</p>
          </div>
        ) : (
          <p className="text-slate-500 text-center">
            Passe o cursor ou toque em qualquer vértice do gráfico radar para inspecionar o detalhamento do pilar.
          </p>
        )}
      </div>
    </div>
  );
};
