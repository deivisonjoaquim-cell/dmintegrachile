import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { BrandRibbon } from '../BrandLogo';

interface UiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';
  size?: 'sm' | 'md';
}

export const UiButton: React.FC<UiButtonProps> = ({
  variant = 'outline',
  size = 'md',
  className = '',
  style,
  children,
  ...rest
}) => {
  const sizeCls = size === 'sm' ? 'px-3 py-1.5 text-xs min-h-[34px]' : 'px-4 py-2 text-xs min-h-[40px]';
  const variantCls =
    variant === 'primary'
      ? 'text-white border border-transparent shadow-[0_1px_2px_rgba(11,31,51,0.18)] hover:opacity-95 active:scale-[0.99]'
      : variant === 'secondary'
        ? 'bg-[#0B1F33] dark:bg-[#163452] text-white border border-transparent shadow-[0_1px_2px_rgba(11,31,51,0.16)] hover:opacity-95'
        : variant === 'success'
          ? 'bg-[#146B43] text-white border border-transparent shadow-[0_1px_2px_rgba(20,107,67,0.22)] hover:bg-[#0F5434]'
          : variant === 'danger'
            ? 'bg-[#A61C2B] text-white border border-transparent shadow-[0_1px_2px_rgba(166,28,43,0.22)] hover:bg-[#891522]'
            : variant === 'ghost'
              ? 'bg-transparent text-slate-700 dark:text-slate-300 border border-transparent hover:bg-[#F1EDE4] dark:hover:bg-[#152B44]'
              : 'bg-white dark:bg-[#0D1E31] text-[#0B1F33] dark:text-slate-100 border border-[#DDD6C7] dark:border-[#1E3754] hover:bg-[#F7F5F0] dark:hover:bg-[#142942]';

  const mergedStyle = variant === 'primary' ? { backgroundColor: 'var(--color-primary)', ...style } : style;

  return (
    <button
      {...rest}
      style={mergedStyle}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold max-w-full whitespace-normal sm:whitespace-nowrap text-center leading-tight transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${sizeCls} ${variantCls} ${className}`}
    >
      {children}
    </button>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-8 text-center space-y-3 shadow-[0_1px_2px_rgba(11,31,51,0.03)]">
    {icon && (
      <div className="mx-auto w-11 h-11 rounded-xl bg-[#F7F5F0] dark:bg-[#142942] text-[#0B1F33] dark:text-[#E5C76B] flex items-center justify-center">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-bold text-[#0B1523] dark:text-slate-100">{title}</h3>
    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">{description}</p>
    {actionLabel && onAction && (
      <div className="pt-1">
        <UiButton variant="primary" onClick={onAction}>
          {actionLabel}
        </UiButton>
      </div>
    )}
  </div>
);

export const SkeletonBlock: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div
    className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-xl p-6 space-y-3 animate-pulse"
    aria-busy="true"
  >
    <div className="h-4 bg-[#E5DFD2] dark:bg-[#1C324B] rounded w-1/3" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-3 bg-[#F1EDE4] dark:bg-[#142942] rounded w-full" />
    ))}
  </div>
);

export const UiModal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, maxWidth = 'max-w-2xl', children }) => {
  const titleId = useRef(`ui-modal-title-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-[#071320]/65 dark:bg-[#040B14]/80 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl ${maxWidth} w-full max-h-[90vh] flex flex-col shadow-2xl text-[#0B1523] dark:text-slate-100 overflow-hidden`}>
        <BrandRibbon className="h-[2.5px] w-full" />
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#E5DFD2] dark:border-[#1C324B]">
          <h3 id={titleId} className="text-base font-bold tracking-tight text-[#0B1523] dark:text-slate-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-[#F7F5F0] dark:hover:bg-[#152B44] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmActionModal: React.FC<{
  open: boolean;
  title: string;
  description: string;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'primary';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}> = ({
  open,
  title,
  description,
  details = [],
  confirmLabel = 'Confirmar exclusão',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onClose,
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setBusy(false);
      return;
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, busy, onClose]);

  if (!open) return null;

  const iconColor =
    tone === 'danger'
      ? 'text-[#A61C2B] dark:text-red-400'
      : tone === 'warning'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-[var(--color-primary)]';

  const confirmVariant = tone === 'danger' ? 'danger' : 'primary';

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#071320]/65 dark:bg-[#040B14]/80 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl text-[#0B1523] dark:text-slate-100">
        <BrandRibbon className="h-[2.5px] w-full" />
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className={`flex items-center gap-2 ${iconColor}`}>
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-[#0B1523] dark:text-slate-100">{title}</h3>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              aria-label="Fechar"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-[#F7F5F0] dark:hover:bg-[#152B44] transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>

          {details.length > 0 && (
            <ul className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              {details.map((it, idx) => (
                <li key={idx}>• {it}</li>
              ))}
            </ul>
          )}

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <UiButton type="button" variant="outline" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </UiButton>
            <UiButton
              type="button"
              variant={confirmVariant}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onConfirm();
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Não foi possível concluir a operação.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Processando...' : confirmLabel}
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ConfirmTypedModal: React.FC<{
  open: boolean;
  title: string;
  description: string;
  summaryItems?: string[];
  requiredKeyword: string;
  confirmLabel?: string;
  alternativeLabel?: string;
  onAlternative?: () => Promise<void> | void;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}> = ({
  open,
  title,
  description,
  summaryItems = [],
  requiredKeyword,
  confirmLabel = 'Confirmar exclusão definitiva',
  alternativeLabel,
  onAlternative,
  onConfirm,
  onClose,
}) => {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTyped('');
      setError(null);
      setBusy(false);
      return;
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [open, busy, onClose]);

  if (!open) return null;

  const matches = typed.trim().toUpperCase() === requiredKeyword.trim().toUpperCase();

  return (
    <div
      className="fixed inset-0 z-[60] bg-[#071320]/65 dark:bg-[#040B14]/80 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl text-[#0B1523] dark:text-slate-100">
        <BrandRibbon className="h-[2.5px] w-full" />
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-[#A61C2B] dark:text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-[#0B1523] dark:text-slate-100">{title}</h3>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              aria-label="Fechar"
              className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-[#F7F5F0] dark:hover:bg-[#152B44] transition-colors disabled:opacity-40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>

          {summaryItems.length > 0 && (
            <ul className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              {summaryItems.map((it, idx) => (
                <li key={idx}>• {it}</li>
              ))}
            </ul>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Para prosseguir, digite exatamente <strong>{requiredKeyword}</strong>:
            </label>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requiredKeyword}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <UiButton type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </UiButton>
            {alternativeLabel && onAlternative && (
              <UiButton
                type="button"
                variant="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await onAlternative();
                    onClose();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Não foi possível concluir a operação.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {alternativeLabel}
              </UiButton>
            )}
            <UiButton
              type="button"
              variant="danger"
              disabled={!matches || busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await onConfirm();
                  onClose();
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Não foi possível concluir a exclusão.');
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Processando...' : confirmLabel}
            </UiButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export const QrCodeSvg: React.FC<{ value: string; size?: number }> = ({ value, size = 72 }) => {
  // Deterministic verification matrix pattern SVG representing the verification code cleanly for A4 documents
  const grid = 9;
  const cells: boolean[] = [];
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  for (let r = 0; r < grid; r += 1) {
    for (let c = 0; c < grid; c += 1) {
      const corner = (r < 3 && c < 3) || (r < 3 && c >= grid - 3) || (r >= grid - 3 && c < 3);
      if (corner) {
        const inner = (r === 1 && c === 1) || (r === 1 && c === grid - 2) || (r === grid - 2 && c === 1);
        const outer = r === 0 || r === 2 || r === grid - 1 || r === grid - 3 || c === 0 || c === 2 || c === grid - 1 || c === grid - 3;
        cells.push(inner || outer);
      } else {
        const bit = ((hash >>> ((r * grid + c) % 31)) ^ (r * 7 + c * 13)) & 1;
        cells.push(bit === 1);
      }
    }
  }
  const cellSize = size / grid;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label={`Código de verificação ${value}`} className="border border-slate-200 p-1 bg-white rounded">
      {cells.map((on, idx) =>
        on ? (
          <rect
            key={idx}
            x={(idx % grid) * cellSize}
            y={Math.floor(idx / grid) * cellSize}
            width={cellSize}
            height={cellSize}
            fill="#0F2537"
          />
        ) : null,
      )}
    </svg>
  );
};

interface SignaturePoint {
  x: number;
  y: number;
}

interface SignatureStroke {
  color: string;
  width: number;
  points: SignaturePoint[];
}

export const DrawSignaturePad: React.FC<{
  onSave?: (dataUrl: string) => void;
  onChange?: (dataUrl: string | null) => void;
  initialDataUrl?: string;
  disabled?: boolean;
  hideSaveButton?: boolean;
  saveLabel?: string;
}> = ({
  onSave,
  onChange,
  initialDataUrl,
  disabled = false,
  hideSaveButton = false,
  saveLabel = 'Confirmar assinatura desenhada',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<SignatureStroke[]>([]);
  const activeStrokeRef = useRef<SignatureStroke | null>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);
  const [hasInitialImg, setHasInitialImg] = useState(Boolean(initialDataUrl));
  const [inkColor, setInkColor] = useState<'#0B1F33' | '#0F3D91'>('#0B1F33');

  const LOGICAL_W = 560;
  const LOGICAL_H = 168;
  const DPR = 2;

  const redrawCanvas = React.useCallback((withGuide: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

    if (bgImageRef.current) {
      ctx.drawImage(bgImageRef.current, 0, 0, LOGICAL_W, LOGICAL_H);
    }

    if (withGuide) {
      ctx.save();
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(28, LOGICAL_H - 36);
      ctx.lineTo(LOGICAL_W - 28, LOGICAL_H - 36);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 11px "Plus Jakarta Sans", "DM Sans", sans-serif';
      ctx.fillText('Assine sobre a linha', 28, LOGICAL_H - 16);
      ctx.restore();
    }

    const renderStroke = (stroke: SignatureStroke) => {
      if (stroke.points.length === 0) return;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length - 1; i += 1) {
        const curr = stroke.points[i];
        const next = stroke.points[i + 1];
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        ctx.quadraticCurveTo(curr.x, curr.y, midX, midY);
      }
      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    };

    for (const s of strokesRef.current) {
      renderStroke(s);
    }
    if (activeStrokeRef.current) {
      renderStroke(activeStrokeRef.current);
    }

    ctx.restore();
  }, []);

  const exportCleanDataUrl = React.useCallback((): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (strokesRef.current.length === 0 && !bgImageRef.current) return null;
    redrawCanvas(false);
    const dataUrl = canvas.toDataURL('image/png');
    redrawCanvas(true);
    return dataUrl;
  }, [redrawCanvas]);

  useEffect(() => {
    strokesRef.current = [];
    activeStrokeRef.current = null;
    setStrokeCount(0);

    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => {
        bgImageRef.current = img;
        setHasInitialImg(true);
        redrawCanvas(true);
      };
      img.src = initialDataUrl;
    } else {
      bgImageRef.current = null;
      setHasInitialImg(false);
      redrawCanvas(true);
    }
  }, [initialDataUrl, redrawCanvas]);

  const hasStroke = strokeCount > 0 || hasInitialImg;

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>): SignaturePoint => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * LOGICAL_W,
      y: ((e.clientY - rect.top) / rect.height) * LOGICAL_H,
    };
  };

  const handleUndo = () => {
    if (disabled || strokesRef.current.length === 0) return;
    strokesRef.current = strokesRef.current.slice(0, -1);
    setStrokeCount(strokesRef.current.length);
    redrawCanvas(true);
    onChange?.(exportCleanDataUrl());
  };

  const handleClear = () => {
    if (disabled) return;
    strokesRef.current = [];
    activeStrokeRef.current = null;
    bgImageRef.current = null;
    setStrokeCount(0);
    setHasInitialImg(false);
    redrawCanvas(true);
    onChange?.(null);
  };

  const finishStroke = () => {
    if (!activeStrokeRef.current) return;
    strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
    activeStrokeRef.current = null;
    setDrawing(false);
    setStrokeCount(strokesRef.current.length);
    redrawCanvas(true);
    onChange?.(exportCleanDataUrl());
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="inline-flex items-center gap-1.5" role="group" aria-label="Cor da tinta">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Caneta:</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setInkColor('#0B1F33')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap ${
              inkColor === '#0B1F33'
                ? 'border-[#0B1F33] bg-[#0B1F33] text-white'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#0B1F33] border border-white/60" aria-hidden="true" />
            Preto
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setInkColor('#0F3D91')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors whitespace-nowrap ${
              inkColor === '#0F3D91'
                ? 'border-[#0F3D91] bg-[#0F3D91] text-white'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F3D91] border border-white/60" aria-hidden="true" />
            Azul
          </button>
        </div>

        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={disabled || strokeCount === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#16233B] disabled:opacity-40 whitespace-nowrap"
          >
            Desfazer
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled || !hasStroke}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#16233B] disabled:opacity-40 whitespace-nowrap"
          >
            <RotateCcw className="w-3 h-3" />
            Limpar
          </button>
        </div>
      </div>

      <div
        className={`border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden bg-white transition-shadow focus-within:ring-2 focus-within:ring-[#0F3D91]/30 ${
          disabled ? 'opacity-60 pointer-events-none' : ''
        }`}
      >
        <canvas
          ref={canvasRef}
          width={LOGICAL_W * DPR}
          height={LOGICAL_H * DPR}
          className="w-full h-36 sm:h-40 touch-none cursor-crosshair block"
          onPointerDown={(e) => {
            if (disabled) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const pt = getCoords(e);
            activeStrokeRef.current = {
              color: inkColor,
              width: 2.4,
              points: [pt],
            };
            setDrawing(true);
            redrawCanvas(true);
          }}
          onPointerMove={(e) => {
            if (disabled || !drawing || !activeStrokeRef.current) return;
            const pt = getCoords(e);
            const pts = activeStrokeRef.current.points;
            const prev = pts[pts.length - 1];
            if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 1.5) {
              pts.push(pt);
              redrawCanvas(true);
            }
          }}
          onPointerUp={() => finishStroke()}
          onPointerCancel={() => finishStroke()}
        />
      </div>

      {!hideSaveButton && onSave && (
        <div className="flex items-center justify-end">
          <UiButton
            type="button"
            variant="primary"
            size="sm"
            disabled={disabled || !hasStroke}
            onClick={() => {
              if (disabled) return;
              const exported = exportCleanDataUrl();
              if (exported) onSave(exported);
            }}
          >
            {saveLabel}
          </UiButton>
        </div>
      )}
    </div>
  );
};

export function useSeoMetadata(params: {
  title: string;
  description: string;
  orgName: string;
  email?: string;
  whatsapp?: string;
  url?: string;
}) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = params.title;
    const ensureMeta = (selector: string, attr: 'name' | 'property', key: string, content: string) => {
      let el = document.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    ensureMeta('meta[name="description"]', 'name', 'description', params.description);
    ensureMeta('meta[property="og:title"]', 'property', 'og:title', params.title);
    ensureMeta('meta[property="og:description"]', 'property', 'og:description', params.description);

    const scriptId = 'dm-integra-org-jsonld';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ProfessionalService',
      name: params.orgName,
      description: params.description,
      email: params.email || undefined,
      telephone: params.whatsapp || undefined,
      url: params.url || window.location.origin,
      areaServed: ['BR', 'CL'],
    });
  }, [params.title, params.description, params.orgName, params.email, params.whatsapp, params.url]);
}
