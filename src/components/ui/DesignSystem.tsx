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

export const DrawSignaturePad: React.FC<{
  onSave: (dataUrl: string) => void;
  initialDataUrl?: string;
  disabled?: boolean;
}> = ({ onSave, initialDataUrl, disabled = false }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(Boolean(initialDataUrl));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (initialDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = initialDataUrl;
    }
  }, [initialDataUrl]);

  const getCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const handleClear = () => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  return (
    <div className="space-y-2">
      <div className={`border border-slate-300 rounded-lg overflow-hidden bg-white ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
        <canvas
          ref={canvasRef}
          width={480}
          height={140}
          className="w-full h-32 touch-none cursor-crosshair"
          onPointerDown={(e) => {
            if (disabled) return;
            const ctx = canvasRef.current?.getContext('2d');
            if (!ctx) return;
            const { x, y } = getCoords(e);
            ctx.strokeStyle = '#0F2537';
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            setDrawing(true);
            setHasStroke(true);
          }}
          onPointerMove={(e) => {
            if (disabled || !drawing) return;
            const ctx = canvasRef.current?.getContext('2d');
            if (!ctx) return;
            const { x, y } = getCoords(e);
            ctx.lineTo(x, y);
            ctx.stroke();
          }}
          onPointerUp={() => setDrawing(false)}
          onPointerLeave={() => setDrawing(false)}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw className="w-3 h-3" />
          Limpar
        </button>
        <UiButton
          type="button"
          variant="primary"
          size="sm"
          disabled={disabled || !hasStroke}
          onClick={() => {
            if (!disabled && canvasRef.current) onSave(canvasRef.current.toDataURL('image/png'));
          }}
        >
          Confirmar assinatura desenhada
        </UiButton>
      </div>
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
