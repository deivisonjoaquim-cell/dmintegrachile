import React, { useCallback, useEffect, useRef, useState } from 'react';
import SignaturePad, { type PointGroup } from 'signature_pad';
import { Eraser, PenTool, Undo2 } from 'lucide-react';
import {
  exportNormalizedSignatureCanvas,
  validateAndNormalizeSignatureDataUrl,
} from '../../utils/contractSignature';

export interface SignaturePadCanvasProps {
  onSave?: (dataUrl: string) => void;
  onChange?: (dataUrl: string | null) => void;
  initialDataUrl?: string;
  disabled?: boolean;
  hideSaveButton?: boolean;
  saveLabel?: string;
  heightClassName?: string;
}

const INK_OPTIONS: Array<{ color: '#0B1F33' | '#0F3D91'; label: string }> = [
  { color: '#0B1F33', label: 'Preto' },
  { color: '#0F3D91', label: 'Azul' },
];

export const SignaturePadCanvas: React.FC<SignaturePadCanvasProps> = ({
  onSave,
  onChange,
  initialDataUrl,
  disabled = false,
  hideSaveButton = false,
  saveLabel = 'Confirmar assinatura desenhada',
  heightClassName = 'h-40 sm:h-44',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const onChangeRef = useRef(onChange);
  const initialDataUrlRef = useRef(initialDataUrl);

  const [inkColor, setInkColor] = useState<'#0B1F33' | '#0F3D91'>('#0B1F33');
  const [strokeCount, setStrokeCount] = useState(0);
  const [hasInitialImg, setHasInitialImg] = useState(Boolean(initialDataUrl));
  const [padError, setPadError] = useState<string | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const emitNormalizedSignature = useCallback((): string | null => {
    const pad = padRef.current;
    const canvas = canvasRef.current;
    if (!pad || !canvas) return null;
    if (pad.isEmpty() && !initialDataUrlRef.current) {
      setPadError(null);
      onChangeRef.current?.(null);
      return null;
    }

    const rawUrl = exportNormalizedSignatureCanvas(canvas, { maxWidth: 640, maxHeight: 192 });
    const validation = validateAndNormalizeSignatureDataUrl(rawUrl);
    if (!validation.valid) {
      setPadError(validation.error || 'Não foi possível processar a assinatura desenhada.');
      onChangeRef.current?.(null);
      return null;
    }

    setPadError(null);
    onChangeRef.current?.(validation.dataUrl);
    return validation.dataUrl;
  }, []);

  const resizeCanvasKeepingStrokes = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const pad = padRef.current;
    if (!canvas || !container || !pad) return;

    const rect = container.getBoundingClientRect();
    const cssWidth = Math.max(240, Math.round(rect.width));
    const cssHeight = Math.max(144, Math.round(rect.height));
    const ratio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));

    const nextPixelWidth = Math.round(cssWidth * ratio);
    const nextPixelHeight = Math.round(cssHeight * ratio);
    if (canvas.width === nextPixelWidth && canvas.height === nextPixelHeight) {
      return;
    }

    const existingData: PointGroup[] = pad.toData();
    const prevCssWidth = canvas.width > 0 ? canvas.width / ratio : cssWidth;
    const prevCssHeight = canvas.height > 0 ? canvas.height / ratio : cssHeight;
    const scaleX = prevCssWidth > 0 ? cssWidth / prevCssWidth : 1;
    const scaleY = prevCssHeight > 0 ? cssHeight / prevCssHeight : 1;

    canvas.width = nextPixelWidth;
    canvas.height = nextPixelHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    pad.clear();
    if (existingData.length > 0) {
      const rescaled: PointGroup[] = existingData.map((group) => ({
        ...group,
        points: group.points.map((pt) => ({
          ...pt,
          x: pt.x * scaleX,
          y: pt.y * scaleY,
        })),
      }));
      pad.fromData(rescaled);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const pad = new SignaturePad(canvas, {
      minWidth: 1.15,
      maxWidth: 2.75,
      throttle: 12,
      minDistance: 2.5,
      velocityFilterWeight: 0.7,
      penColor: inkColor,
      backgroundColor: 'rgba(255, 255, 255, 0)',
    });
    padRef.current = pad;

    const handleEndStroke = () => {
      const data = pad.toData();
      setStrokeCount(data.length);
      if (data.length > 0) {
        setHasInitialImg(false);
        initialDataUrlRef.current = undefined;
      }
      emitNormalizedSignature();
    };

    pad.addEventListener('endStroke', handleEndStroke);
    resizeCanvasKeepingStrokes();

    if (initialDataUrl) {
      initialDataUrlRef.current = initialDataUrl;
      setHasInitialImg(true);
      void pad.fromDataURL(initialDataUrl).catch(() => undefined);
    }

    if (disabled) {
      pad.off();
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        resizeCanvasKeepingStrokes();
      });
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', resizeCanvasKeepingStrokes);
    }

    return () => {
      pad.removeEventListener('endStroke', handleEndStroke);
      pad.off();
      padRef.current = null;
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', resizeCanvasKeepingStrokes);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    pad.penColor = inkColor;
  }, [inkColor]);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (disabled) {
      pad.off();
    } else {
      pad.on();
    }
  }, [disabled]);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    if (initialDataUrl && initialDataUrl !== initialDataUrlRef.current) {
      initialDataUrlRef.current = initialDataUrl;
      setHasInitialImg(true);
      void pad.fromDataURL(initialDataUrl).catch(() => undefined);
    }
  }, [initialDataUrl]);

  const hasStroke = strokeCount > 0 || hasInitialImg;

  const handleUndo = () => {
    const pad = padRef.current;
    if (disabled || !pad) return;
    const data = pad.toData();
    if (data.length === 0) return;
    data.pop();
    pad.fromData(data);
    setStrokeCount(data.length);
    if (data.length === 0) {
      setPadError(null);
      onChangeRef.current?.(null);
    } else {
      emitNormalizedSignature();
    }
  };

  const handleClear = () => {
    const pad = padRef.current;
    if (disabled || !pad) return;
    pad.clear();
    initialDataUrlRef.current = undefined;
    setStrokeCount(0);
    setHasInitialImg(false);
    setPadError(null);
    onChangeRef.current?.(null);
  };

  const handleConfirmClick = () => {
    if (disabled || !hasStroke || !onSave) return;
    const dataUrl = emitNormalizedSignature();
    if (dataUrl) {
      onSave(dataUrl);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Barra superior de controle de tinta e ações */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400">
            <PenTool className="w-3 h-3" />
            Tinta:
          </span>
          {INK_OPTIONS.map((opt) => (
            <button
              key={opt.color}
              type="button"
              disabled={disabled}
              onClick={() => setInkColor(opt.color)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-colors whitespace-nowrap ${
                inkColor === opt.color
                  ? 'text-white border-transparent'
                  : 'bg-white dark:bg-[#111C30] text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              style={inkColor === opt.color ? { backgroundColor: opt.color } : undefined}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled || strokeCount === 0}
            onClick={handleUndo}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
          >
            <Undo2 className="w-3 h-3" />
            Desfazer
          </button>
          <button
            type="button"
            disabled={disabled || !hasStroke}
            onClick={handleClear}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111C30] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 whitespace-nowrap"
          >
            <Eraser className="w-3 h-3" />
            Limpar
          </button>
        </div>
      </div>

      {/* Canvas responsivo signature_pad com linha-guia não intrusiva */}
      <div
        ref={containerRef}
        className={`relative w-full ${heightClassName} rounded-xl border border-slate-300 dark:border-slate-600 bg-white overflow-hidden select-none transition-colors ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-crosshair hover:border-[#0F3D91]/70'
        }`}
      >
        {/* Linha-guia visual sob o canvas (não entra no PNG exportado) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-slate-300"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-6 bottom-2.5 text-[11px] font-medium text-slate-400"
        >
          {hasStroke ? 'Assinatura capturada' : 'Assine sobre a linha'}
        </span>

        <canvas
          ref={canvasRef}
          aria-label="Área de assinatura manuscrita"
          data-testid="signature-pad-canvas"
          className="relative z-10 block w-full h-full touch-none"
        />
      </div>

      {padError && (
        <p role="alert" className="text-[11px] font-medium text-red-700 dark:text-red-400">
          {padError}
        </p>
      )}

      {!hideSaveButton && onSave && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled={disabled || !hasStroke}
            onClick={handleConfirmClick}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#0B1F33] hover:opacity-95 disabled:opacity-45 whitespace-nowrap"
          >
            {saveLabel}
          </button>
        </div>
      )}
    </div>
  );
};
