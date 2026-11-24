import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  FileCheck2,
  Loader2,
  RefreshCw,
  RotateCw,
  ScanLine,
  ShieldCheck,
  Sparkles,
  SwitchCamera,
  Upload,
  X,
} from 'lucide-react';
import { BrandRibbon } from './BrandLogo';
import { translateAppError } from '../services/errorService';
import { saveUserIdentityDocument } from '../services/identityDocumentService';
import type { IdentityDocumentType, UserIdentityDocument, UserProfile } from '../types/domain';
import { formatFileSizeBytes } from '../utils/documentUploadMetadata';
import {
  buildIdentityDocumentFileName,
  captureVisualSourceToCompressedScan,
  dataUrlToFile,
  getIdentityDocTypeMeta,
  IDENTITY_DOC_TYPE_OPTIONS,
  readImageFileToCompressedScan,
  type CompressedScanResult,
} from '../utils/identityDocumentScan';

interface CameraDocumentScannerModalProps {
  open: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  initialMode?: 'camera' | 'upload';
  initialDocType?: IdentityDocumentType;
  /** Optional label when launched from a case checklist item so the user can also attach to the case */
  caseDocumentTargetName?: string;
  onSaved?: (savedDoc: UserIdentityDocument, scannedFile?: File, alsoAttachToCase?: boolean) => void | Promise<void>;
}

type CameraStatus = 'idle' | 'requesting' | 'active' | 'error';

function inferFriendlyCameraError(err: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'A câmera exige uma conexão segura (HTTPS). Você ainda pode enviar a foto diretamente pelo botão abaixo.';
  }
  const name = err instanceof DOMException ? err.name : (err as { name?: string })?.name || '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Permissão da câmera bloqueada no navegador. Libere o acesso à câmera nas configurações do site ou envie uma foto do dispositivo.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Nenhuma câmera foi detectada neste dispositivo. Utilize o botão "Selecionar foto do dispositivo" abaixo.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'A câmera está em uso por outro aplicativo ou guia. Feche o outro app e tente novamente.';
  }
  if (name === 'OverconstrainedError') {
    return 'Não foi possível iniciar a câmera com a orientação solicitada. Tente alternar a câmera ou enviar uma foto.';
  }
  return err instanceof Error
    ? err.message
    : 'Não foi possível acessar a câmera. Você pode selecionar uma imagem do dispositivo.';
}

export const CameraDocumentScannerModal: React.FC<CameraDocumentScannerModalProps> = ({
  open,
  onClose,
  userProfile,
  initialMode = 'camera',
  initialDocType = 'passaporte',
  caseDocumentTargetName,
  onSaved,
}) => {
  const initialMeta = getIdentityDocTypeMeta(initialDocType);

  const [step, setStep] = useState<'capture' | 'review'>('capture');
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(null);
  const [captureMethod, setCaptureMethod] = useState<'camera' | 'upload'>('camera');

  // Raw lossless snapshot (stored in memory during modal lifecycle for crisp rotation/enhancement)
  const [rawSourceDataUrl, setRawSourceDataUrl] = useState<string | null>(null);
  const [rotationDeg, setRotationDeg] = useState<0 | 90 | 180 | 270>(0);
  const [enhancedScan, setEnhancedScan] = useState<boolean>(true);
  const [processedScan, setProcessedScan] = useState<CompressedScanResult | null>(null);
  const [processingScan, setProcessingScan] = useState(false);

  // Form metadata
  const [docType, setDocType] = useState<IdentityDocumentType>(initialDocType);
  const [title, setTitle] = useState<string>(initialMeta.defaultTitle);
  const [titleManuallyEdited, setTitleManuallyEdited] = useState(false);
  const [documentNumber, setDocumentNumber] = useState('');
  const [issuingCountry, setIssuingCountry] = useState(initialMeta.defaultCountry);
  const [expirationDate, setExpirationDate] = useState('');
  const [notes, setNotes] = useState('');
  const [alsoAttachToCase, setAlsoAttachToCase] = useState<boolean>(Boolean(caseDocumentTargetName));

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeMeta = getIdentityDocTypeMeta(docType);

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setVideoDims(null);
  }, []);

  const startCameraStream = useCallback(
    async (preferredFacing: 'environment' | 'user') => {
      stopCameraStream();
      setCameraError(null);
      setCameraStatus('requesting');

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('error');
        setCameraError(
          'Este navegador não suporta captura direta por câmera (getUserMedia). Utilize o botão para enviar uma foto do dispositivo.',
        );
        return;
      }

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: preferredFacing },
              width: { ideal: 1600 },
              height: { ideal: 1000 },
            },
            audio: false,
          });
        } catch {
          // Fallback to any available video camera if ideal facingMode fails on desktop webcams
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setCameraStatus('active');
      } catch (err) {
        stopCameraStream();
        setCameraStatus('error');
        setCameraError(inferFriendlyCameraError(err));
      }
    },
    [stopCameraStream],
  );

  // Reset modal state on open and clean up camera tracks on close/unmount
  useEffect(() => {
    if (!open) {
      stopCameraStream();
      return;
    }
    const meta = getIdentityDocTypeMeta(initialDocType);
    setStep('capture');
    setRawSourceDataUrl(null);
    setProcessedScan(null);
    setRotationDeg(0);
    setEnhancedScan(true);
    setDocType(initialDocType);
    setTitle(meta.defaultTitle);
    setTitleManuallyEdited(false);
    setDocumentNumber('');
    setIssuingCountry(meta.defaultCountry);
    setExpirationDate('');
    setNotes('');
    setAlsoAttachToCase(Boolean(caseDocumentTargetName));
    setSaveError(null);
    setCameraError(null);

    if (initialMode === 'camera') {
      void startCameraStream('environment');
    } else {
      setCameraStatus('idle');
    }

    return () => {
      stopCameraStream();
    };
  }, [open, initialMode, initialDocType, caseDocumentTargetName, startCameraStream, stopCameraStream]);

  // Re-process captured image whenever rotation or scan enhancement toggle changes
  useEffect(() => {
    if (step !== 'review' || !rawSourceDataUrl) return;
    let cancelled = false;
    setProcessingScan(true);
    setSaveError(null);

    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      try {
        const result = captureVisualSourceToCompressedScan(img, {
          rotationDeg,
          enhancedScan,
        });
        if (!cancelled) {
          setProcessedScan(result);
        }
      } catch (err) {
        if (!cancelled) {
          setSaveError(err instanceof Error ? err.message : 'Erro ao otimizar imagem digitalizada.');
        }
      } finally {
        if (!cancelled) {
          setProcessingScan(false);
        }
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setProcessingScan(false);
        setSaveError('Não foi possível reprocessar a imagem capturada.');
      }
    };
    img.src = rawSourceDataUrl;

    return () => {
      cancelled = true;
    };
  }, [step, rawSourceDataUrl, rotationDeg, enhancedScan]);

  // Keyboard Escape close
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) {
        stopCameraStream();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, saving, stopCameraStream, onClose]);

  if (!open) return null;

  const handleSelectDocType = (nextType: IdentityDocumentType) => {
    setDocType(nextType);
    const meta = getIdentityDocTypeMeta(nextType);
    if (!titleManuallyEdited) {
      setTitle(meta.defaultTitle);
    }
    setIssuingCountry(meta.defaultCountry);
  };

  const handleSwitchCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    void startCameraStream(nextFacing);
  };

  const handleCaptureFromVideo = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('A câmera ainda está inicializando. Aguarde um instante e tente capturar novamente.');
      return;
    }

    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = video.videoWidth;
      snapCanvas.height = video.videoHeight;
      const ctx = snapCanvas.getContext('2d');
      if (!ctx) {
        throw new Error('Falha ao inicializar captura da câmera.');
      }
      ctx.drawImage(video, 0, 0, snapCanvas.width, snapCanvas.height);
      const rawUrl = snapCanvas.toDataURL('image/png');
      stopCameraStream();
      setCaptureMethod('camera');
      setRotationDeg(0);
      setEnhancedScan(true);
      setRawSourceDataUrl(rawUrl);
      setStep('review');
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Erro ao capturar quadro da câmera.');
    }
  };

  const handlePickDeviceFile = async (file: File) => {
    setCameraError(null);
    setSaveError(null);
    setProcessingScan(true);
    try {
      const scan = await readImageFileToCompressedScan(file, {
        rotationDeg: 0,
        enhancedScan: false,
      });
      stopCameraStream();
      setCaptureMethod('upload');
      setRotationDeg(0);
      setEnhancedScan(false);
      setRawSourceDataUrl(scan.imageDataUrl);
      setProcessedScan(scan);
      setStep('review');
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Não foi possível ler a imagem selecionada.');
    } finally {
      setProcessingScan(false);
    }
  };

  const handleRetake = () => {
    setRawSourceDataUrl(null);
    setProcessedScan(null);
    setSaveError(null);
    setStep('capture');
    void startCameraStream(facingMode);
  };

  const handleSaveToFirestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!processedScan || saving || processingScan) return;

    setSaving(true);
    setSaveError(null);

    try {
      const fileName = buildIdentityDocumentFileName(docType, title, processedScan.mimeType);
      const savedDoc = await saveUserIdentityDocument(
        userProfile.uid,
        {
          docType,
          title,
          documentNumber: documentNumber.trim() || undefined,
          issuingCountry: issuingCountry.trim() || undefined,
          expirationDate: expirationDate.trim() || undefined,
          notes: notes.trim() || undefined,
          fileName,
          mimeType: processedScan.mimeType,
          sizeBytes: processedScan.sizeBytes,
          width: processedScan.width,
          height: processedScan.height,
          imageDataUrl: processedScan.imageDataUrl,
          captureMethod,
          enhancedScan,
        },
        userProfile.role,
      );

      let scannedFile: File | undefined;
      if (onSaved && (alsoAttachToCase || caseDocumentTargetName)) {
        scannedFile = dataUrlToFile(
          processedScan.imageDataUrl,
          savedDoc.fileName,
          processedScan.mimeType,
        );
      }

      if (onSaved) {
        await onSaved(savedDoc, scannedFile, alsoAttachToCase);
      }
      stopCameraStream();
      onClose();
    } catch (err) {
      const translated = translateAppError(err, {
        source: 'identity-document-save',
        path: `users/${userProfile.uid}/identityDocuments`,
      });
      setSaveError(`${translated.title}: ${translated.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    if (saving) return;
    stopCameraStream();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#071422]/80 backdrop-blur-[3px] flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-scanner-modal-title"
    >
      <div className="bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl my-auto">
        <BrandRibbon className="h-[3px] w-full shrink-0" />

        {/* Header */}
        <div className="bg-[#0B1F33] text-white px-5 sm:px-6 py-4 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#E5C76B] flex items-center gap-1.5">
              <ScanLine className="w-3.5 h-3.5" aria-hidden="true" />
              Scanner de Identificação · Perfil Seguro Firestore
            </p>
            <h2
              id="camera-scanner-modal-title"
              className="font-display text-lg sm:text-xl font-bold text-white mt-0.5 leading-snug"
            >
              {step === 'capture'
                ? 'Digitalizar Documento de Identificação'
                : 'Revisar e Salvar no Meu Perfil'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            disabled={saving}
            aria-label="Fechar scanner de documento"
            className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {step === 'capture' ? (
            <>
              {/* Document type selector before snapping for tailored guidance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                <div>
                  <label
                    htmlFor="scanner-doc-type-capture"
                    className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1"
                  >
                    Tipo do documento
                  </label>
                  <select
                    id="scanner-doc-type-capture"
                    value={docType}
                    onChange={(e) => handleSelectDocType(e.target.value as IdentityDocumentType)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                  >
                    {IDENTITY_DOC_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg bg-[#FAF9F6] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] px-3.5 py-2.5 text-xs text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
                  <span className="font-semibold text-[#0B1F33] dark:text-white block">
                    Dica de enquadramento ({activeMeta.aspectRatioLabel}):
                  </span>
                  {activeMeta.hint}
                </div>
              </div>

              {/* Camera Viewport */}
              <div className="relative rounded-2xl overflow-hidden bg-[#071422] border border-[#1C324B] aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    if (v.videoWidth && v.videoHeight) {
                      setVideoDims({ w: v.videoWidth, h: v.videoHeight });
                    }
                  }}
                  className={`w-full h-full object-cover ${cameraStatus === 'active' ? 'opacity-100' : 'opacity-0'}`}
                />

                {/* Alignment Overlay when camera is active */}
                {cameraStatus === 'active' && (
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-5 sm:p-8">
                    <div className="relative w-full max-w-[460px] aspect-[1.58/1] border-2 border-dashed border-[#E5C76B]/85 rounded-xl shadow-[0_0_0_9999px_rgba(7,20,34,0.42)]">
                      {/* Four precision corner brackets */}
                      <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-[#E5C76B] rounded-tl-lg" />
                      <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-[#E5C76B] rounded-tr-lg" />
                      <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-[#E5C76B] rounded-bl-lg" />
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-[#E5C76B] rounded-br-lg" />
                    </div>
                    <p className="mt-3 px-3 py-1 rounded-md bg-[#071422]/80 text-[11px] font-medium text-slate-100 text-center">
                      Posicione o documento dentro da moldura · Evite reflexos fortes
                    </p>
                  </div>
                )}

                {/* Live resolution readout */}
                {cameraStatus === 'active' && videoDims && (
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#071422]/80 border border-white/15 text-[11px] font-mono text-slate-200 tabular-nums">
                    Câmera ativa · {videoDims.w}×{videoDims.h}
                  </div>
                )}

                {/* Requesting camera state */}
                {cameraStatus === 'requesting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                    <Loader2 className="w-8 h-8 animate-spin text-[#E5C76B]" />
                    <div className="space-y-1 max-w-sm">
                      <p className="text-sm font-semibold">Solicitando acesso à câmera...</p>
                      <p className="text-xs text-slate-300">
                        Confirme a permissão de câmera exibida pelo navegador para escanear seu documento.
                      </p>
                    </div>
                  </div>
                )}

                {/* Idle (upload-first mode) or Error state */}
                {(cameraStatus === 'idle' || cameraStatus === 'error') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-[#E5C76B]">
                      {cameraStatus === 'error' ? (
                        <AlertTriangle className="w-6 h-6 text-amber-400" />
                      ) : (
                        <Camera className="w-6 h-6" />
                      )}
                    </div>
                    <div className="space-y-1.5 max-w-md">
                      <p className="text-sm font-bold text-white">
                        {cameraStatus === 'error'
                          ? 'Câmera indisponível neste momento'
                          : 'Escolha como digitalizar seu documento'}
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {cameraError ||
                          'Ative a câmera para escanear com moldura de enquadramento ou selecione uma foto nítida do seu dispositivo.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => void startCameraStream(facingMode)}
                        className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-[#C8A236] hover:bg-[#B89228] text-xs font-bold text-[#0B1523] transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        {cameraStatus === 'error' ? 'Tentar ativar câmera novamente' : 'Ativar câmera agora'}
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg border border-white/25 bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        Selecionar foto do dispositivo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Camera Controls Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  {cameraStatus === 'active' && (
                    <button
                      type="button"
                      onClick={handleSwitchCamera}
                      className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-white dark:bg-[#11263D] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 hover:bg-[#FAF9F6] dark:hover:bg-[#16304C]"
                    >
                      <SwitchCamera className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />
                      Alternar câmera
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={processingScan}
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 min-h-[44px] rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-white dark:bg-[#11263D] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 hover:bg-[#FAF9F6] dark:hover:bg-[#16304C] disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4 text-[#8C6D14] dark:text-[#E5C76B]" />
                    {processingScan ? 'Carregando foto...' : 'Enviar foto do dispositivo'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handlePickDeviceFile(f);
                      e.target.value = '';
                    }}
                  />
                </div>

                {cameraStatus === 'active' && (
                  <button
                    type="button"
                    onClick={handleCaptureFromVideo}
                    className="inline-flex items-center gap-2 px-5 min-h-[46px] rounded-lg bg-[#C8A236] hover:bg-[#B89228] text-sm font-bold text-[#0B1523] shadow-md transition-colors"
                  >
                    <Camera className="w-4 h-4" />
                    Capturar documento
                  </button>
                )}
              </div>

              {cameraError && cameraStatus === 'active' && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-700/50 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleSaveToFirestore} className="space-y-5">
              {/* Captured Preview + Adjustment Toolbar */}
              <div className="rounded-xl border border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#081524] overflow-hidden">
                <div className="p-3 sm:p-4 flex items-center justify-center bg-[#071422]/90 min-h-[220px] max-h-[340px]">
                  {processingScan ? (
                    <div className="flex flex-col items-center gap-2 text-slate-200 text-xs py-10">
                      <Loader2 className="w-6 h-6 animate-spin text-[#E5C76B]" />
                      <span>Otimizando nitidez e compressão para o Firestore...</span>
                    </div>
                  ) : processedScan ? (
                    <img
                      src={processedScan.imageDataUrl}
                      alt="Prévia do documento digitalizado"
                      className="max-h-[300px] w-auto object-contain rounded-lg shadow-lg border border-white/15"
                    />
                  ) : null}
                </div>

                <div className="px-4 py-3 border-t border-[#E5DFD2] dark:border-[#1C324B] flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={processingScan || saving}
                      onClick={() =>
                        setRotationDeg((prev) => (((prev + 90) % 360) as 0 | 90 | 180 | 270))
                      }
                      className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-white dark:bg-[#11263D] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 hover:bg-[#FAF9F6] dark:hover:bg-[#16304C] disabled:opacity-50"
                    >
                      <RotateCw className="w-3.5 h-3.5 text-[#8C6D14] dark:text-[#E5C76B]" />
                      Girar 90°
                    </button>
                    <button
                      type="button"
                      disabled={processingScan || saving}
                      aria-pressed={enhancedScan}
                      onClick={() => setEnhancedScan((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg border text-xs font-semibold transition-colors disabled:opacity-50 ${
                        enhancedScan
                          ? 'bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1523] border-[#0B1F33] dark:border-[#C8A236]'
                          : 'bg-white dark:bg-[#11263D] text-[#0B1F33] dark:text-slate-100 border-[#DDD6C7] dark:border-[#243E5C]'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {enhancedScan ? 'Nitidez Scanner: Ativa' : 'Aplicar Nitidez Scanner'}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleRetake}
                      className="inline-flex items-center gap-1.5 px-3 min-h-[38px] rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-white dark:bg-[#11263D] text-xs font-semibold text-[#4A5A6D] dark:text-slate-300 hover:text-[#0B1F33] dark:hover:text-white disabled:opacity-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Refazer captura
                    </button>
                  </div>

                  {processedScan && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#146B43] dark:text-emerald-400 tabular-nums">
                      <FileCheck2 className="w-3.5 h-3.5 shrink-0" />
                      {processedScan.width}×{processedScan.height} ·{' '}
                      {formatFileSizeBytes(processedScan.sizeBytes)}
                    </span>
                  )}
                </div>
              </div>

              {/* Document Metadata Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="scanner-doc-type-review"
                    className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1"
                  >
                    Tipo de documento *
                  </label>
                  <select
                    id="scanner-doc-type-review"
                    value={docType}
                    onChange={(e) => handleSelectDocType(e.target.value as IdentityDocumentType)}
                    disabled={saving}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                  >
                    {IDENTITY_DOC_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="scanner-doc-title"
                    className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1"
                  >
                    Título / Identificação *
                  </label>
                  <input
                    id="scanner-doc-title"
                    type="text"
                    required
                    minLength={2}
                    maxLength={140}
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setTitleManuallyEdited(true);
                    }}
                    disabled={saving}
                    placeholder="Ex.: Passaporte Brasileiro - Titular"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="scanner-doc-number"
                    className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1"
                  >
                    Número do documento (opcional)
                  </label>
                  <input
                    id="scanner-doc-number"
                    type="text"
                    maxLength={60}
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    disabled={saving}
                    placeholder="Ex.: FS123456 ou 12.345.678-9"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm font-mono text-[#0B1F33] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="scanner-doc-country"
                      className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1"
                    >
                      País emissor
                    </label>
                    <input
                      id="scanner-doc-country"
                      type="text"
                      maxLength={60}
                      value={issuingCountry}
                      onChange={(e) => setIssuingCountry(e.target.value)}
                      disabled={saving}
                      placeholder="Brasil / Chile"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="scanner-doc-exp"
                      className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1"
                    >
                      Validade (opcional)
                    </label>
                    <input
                      id="scanner-doc-exp"
                      type="date"
                      value={expirationDate}
                      onChange={(e) => setExpirationDate(e.target.value)}
                      disabled={saving}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm font-mono tabular-nums text-[#0B1F33] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="scanner-doc-notes"
                    className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1"
                  >
                    Observações (opcional)
                  </label>
                  <input
                    id="scanner-doc-notes"
                    type="text"
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={saving}
                    placeholder="Ex.: Frente legível, documento do cônjuge ou renovado em 2026"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] bg-[#FAF9F6] dark:bg-[#11263D] text-sm text-[#0B1F33] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#C8A236]"
                  />
                </div>
              </div>

              {caseDocumentTargetName && (
                <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#FAF9F6] dark:bg-[#11263D] border border-[#E5DFD2] dark:border-[#1C324B] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoAttachToCase}
                    onChange={(e) => setAlsoAttachToCase(e.target.checked)}
                    disabled={saving}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span className="text-xs text-[#0B1F33] dark:text-slate-200 leading-relaxed">
                    Além de salvar no meu perfil no Firestore, também anexar esta digitalização ao item do checklist{' '}
                    <strong>{caseDocumentTargetName}</strong>.
                  </span>
                </label>
              )}

              <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 px-3.5 py-2.5 text-xs text-emerald-950 dark:text-emerald-200 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#146B43] dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  Armazenamento privado: este documento fica vinculado exclusivamente ao seu perfil (
                  <span className="font-mono">{userProfile.email}</span>) com isolamento por regras de segurança no Firestore.
                </span>
              </div>

              {saveError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/35 border border-red-200 dark:border-red-800/60 text-xs text-[#A61C2B] dark:text-red-200 flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Submit footer */}
              <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[#E5DFD2] dark:border-[#1C324B]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={saving}
                  className="px-4 min-h-[44px] rounded-lg border border-[#DDD6C7] dark:border-[#243E5C] text-xs font-semibold text-[#4A5A6D] dark:text-slate-300 hover:bg-[#FAF9F6] dark:hover:bg-[#11263D]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || processingScan || !processedScan}
                  className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-lg bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1523] text-xs font-bold hover:opacity-95 transition-opacity disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando no Firestore...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#E5C76B] dark:text-[#0B1523]" />
                      {caseDocumentTargetName && alsoAttachToCase
                        ? 'Salvar no perfil e anexar ao checklist'
                        : 'Salvar documento no meu perfil'}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
