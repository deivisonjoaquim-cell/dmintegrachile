import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Film,
  Loader2,
  MapPin,
  Quote,
  RotateCcw,
  Square,
  Star,
  Upload,
  Video,
  VideoOff,
  X,
} from 'lucide-react';
import {
  fetchPublicClientTestimonials,
  submitClientTestimonialPublic,
} from '../services/firestoreService';
import type { ClientTestimonial, PartnerCategory } from '../types/domain';
import { PARTNER_CATEGORIES, translatePartnerCategory } from '../utils/partnerHelpers';

const MAX_RECORD_SECONDS = 30;
const MAX_VIDEO_UPLOAD_BYTES = 8 * 1024 * 1024;

interface ClientTestimonialsCarouselProps {
  locale: 'pt-BR' | 'es-CL';
}

const VERIFIED_SHOWCASE_TESTIMONIALS: ClientTestimonial[] = [
  {
    id: 'showcase_1',
    nome: 'Mariana & Rafael Costa',
    cidadeOrigem: 'Curitiba, PR',
    cidadeDestino: 'Providencia, Santiago',
    tipoVisto: 'Residência Temporal Mercosul',
    categoriaParceiro: 'Imobiliária',
    depoimento:
      'Antes da consultoria estávamos travados para alugar apartamento em Santiago sem histórico bancário local. Com a documentação apostilada e a indicação da imobiliária homologada da rede, assinamos contrato em 9 dias após o desembarque com total segurança jurídica.',
    avaliacao: 5,
    autorizado: true,
    aprovado: true,
    createdAt: '2026-09-18T14:30:00.000Z',
  },
  {
    id: 'showcase_2',
    nome: 'Eduardo Almeida',
    cidadeOrigem: 'São Paulo, SP',
    cidadeDestino: 'Las Condes, Santiago',
    tipoVisto: 'Residência Temporal · Empreendedor',
    categoriaParceiro: 'Contabilidade / Abertura Empresa',
    depoimento:
      'Precisava abrir uma SpA no Chile e organizar minha residência sem viajar às cegas. A integração entre o planejamento migratório e o escritório contábil parceiro reduziu em mais de 40 dias o início das minhas atividades no SII.',
    avaliacao: 5,
    autorizado: true,
    aprovado: true,
    createdAt: '2026-10-04T11:15:00.000Z',
  },
  {
    id: 'showcase_3',
    nome: 'Camila Ferreira',
    cidadeOrigem: 'Belo Horizonte, MG',
    cidadeDestino: 'Viña del Mar, Valparaíso',
    tipoVisto: 'Residência Temporal · Trabalho Remoto',
    categoriaParceiro: 'Tradutor Juramentado',
    depoimento:
      'Todo o pacote de certidões, Apostila de Haia e traduções oficiais foi coordenado ainda no Brasil com os parceiros indicados. Cheguei ao Chile com o protocolo do SERMIG sem nenhuma pendência ou exigência extra.',
    avaliacao: 5,
    autorizado: true,
    aprovado: true,
    createdAt: '2026-10-22T16:45:00.000Z',
  },
];

function pickSupportedRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined;
  }
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

function formatSecondsTimer(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const m = String(Math.floor(safe / 60)).padStart(2, '0');
  const s = String(safe % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export const ClientTestimonialsCarousel: React.FC<ClientTestimonialsCarouselProps> = ({
  locale,
}) => {
  const isEs = locale === 'es-CL';

  const [cloudTestimonials, setCloudTestimonials] = useState<ClientTestimonial[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [studioOpen, setStudioOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Testimonial Form State
  const [nome, setNome] = useState('');
  const [cidadeOrigem, setCidadeOrigem] = useState('');
  const [cidadeDestino, setCidadeDestino] = useState('Santiago, Chile');
  const [tipoVisto, setTipoVisto] = useState('');
  const [categoriaParceiro, setCategoriaParceiro] = useState<PartnerCategory>('Imobiliária');
  const [depoimento, setDepoimento] = useState('');
  const [avaliacao, setAvaliacao] = useState(5);
  const [autorizado, setAutorizado] = useState(true);
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Webcam / Short Video Recording State
  const [cameraActive, setCameraActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [recordedMime, setRecordedMime] = useState<string>('video/webm');
  const [recordedDuration, setRecordedDuration] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublicClientTestimonials()
      .then((rows) => {
        if (active) setCloudTestimonials(rows);
      })
      .catch(() => {
        // Keep showcase testimonials visible if Firestore is unreachable
      });
    return () => {
      active = false;
    };
  }, []);

  const testimonials = useMemo<ClientTestimonial[]>(() => {
    const merged = [...cloudTestimonials, ...VERIFIED_SHOWCASE_TESTIMONIALS];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [cloudTestimonials]);

  const safeIndex = testimonials.length > 0 ? activeIndex % testimonials.length : 0;
  const current = testimonials[safeIndex];

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopCameraStream = () => {
    stopTimer();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore stop errors on inactive recorder
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    setRecording(false);
    setCameraActive(false);
  };

  const clearRecordedVideo = () => {
    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl);
    }
    setRecordedBlob(null);
    setRecordedPreviewUrl(null);
    setRecordedDuration(0);
    setElapsedSeconds(0);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (recordedPreviewUrl) {
        URL.revokeObjectURL(recordedPreviewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bind live MediaStream to video element whenever camera activates
  useEffect(() => {
    if (cameraActive && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
      void liveVideoRef.current.play().catch(() => undefined);
    }
  }, [cameraActive]);

  const handleEnableCamera = async () => {
    setCameraError(null);
    clearRecordedVideo();

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        isEs
          ? 'Tu navegador no permite acceso directo a la cámara aquí. Puedes adjuntar un video corto (.mp4 o .webm) desde tu dispositivo.'
          : 'Seu navegador não liberou acesso direto à webcam neste ambiente. Você também pode enviar um vídeo curto (.mp4 ou .webm) do seu dispositivo.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setCameraError(
        msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('permission')
          ? isEs
            ? 'Permiso de cámara o micrófono denegado. Autoriza el acceso en el navegador o sube un video corto (.mp4/.webm).'
            : 'Permissão de câmera ou microfone negada. Libere o acesso no navegador ou envie um vídeo curto (.mp4/.webm).'
          : isEs
            ? 'No detectamos una webcam disponible. Puedes adjuntar un video corto (.mp4 o .webm de hasta 8 MB).'
            : 'Nenhuma webcam disponível detectada. Você pode anexar um vídeo curto (.mp4 ou .webm de até 8 MB).',
      );
    }
  };

  const handleStartRecording = () => {
    if (!streamRef.current) return;
    if (typeof MediaRecorder === 'undefined') {
      setCameraError(
        isEs
          ? 'Tu navegador no soporta grabación directa. Adjunta un archivo .mp4 o .webm.'
          : 'Seu navegador não suporta gravação direta. Anexe um arquivo .mp4 ou .webm.',
      );
      return;
    }

    setCameraError(null);
    clearRecordedVideo();
    chunksRef.current = [];

    const mimeType = pickSupportedRecorderMime();
    const options: MediaRecorderOptions = mimeType
      ? { mimeType, videoBitsPerSecond: 1_200_000 }
      : { videoBitsPerSecond: 1_200_000 };

    const recorder = new MediaRecorder(streamRef.current, options);
    const chosenMime = (recorder.mimeType || mimeType || 'video/webm').split(';')[0];
    setRecordedMime(chosenMime);

    const startedAt = Date.now();
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunksRef.current.push(ev.data);
      }
    };
    recorder.onstop = () => {
      stopTimer();
      const durationSec = Math.max(1, Math.min(MAX_RECORD_SECONDS, Math.round((Date.now() - startedAt) / 1000)));
      const blob = new Blob(chunksRef.current, { type: chosenMime });
      if (blob.size > 0) {
        const preview = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedPreviewUrl(preview);
        setRecordedDuration(durationSec);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = null;
      }
      setRecording(false);
      setCameraActive(false);
    };

    mediaRecorderRef.current = recorder;
    recorder.start(250);
    setRecording(true);
    setElapsedSeconds(0);

    timerRef.current = window.setInterval(() => {
      const nextSec = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(nextSec);
      if (nextSec >= MAX_RECORD_SECONDS && mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, 250);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleVideoFileSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setCameraError(null);
    stopCameraStream();
    clearRecordedVideo();

    const cleanMime = (file.type || '').split(';')[0].toLowerCase();
    if (!['video/webm', 'video/mp4', 'video/quicktime'].includes(cleanMime)) {
      setCameraError(
        isEs
          ? 'Formato no soportado. Envía un video corto en WebM, MP4 o MOV.'
          : 'Formato não suportado. Envie um vídeo curto em WebM, MP4 ou MOV.',
      );
      return;
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setCameraError(
        isEs
          ? 'El archivo supera 8 MB. Elige un video corto de hasta 30 segundos.'
          : 'O arquivo ultrapassa 8 MB. Escolha um vídeo curto de até 30 segundos.',
      );
      return;
    }

    const preview = URL.createObjectURL(file);
    setRecordedBlob(file);
    setRecordedMime(cleanMime);
    setRecordedPreviewUrl(preview);
    setRecordedDuration(0);
    if (videoFileInputRef.current) videoFileInputRef.current.value = '';
  };

  const handlePublishTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitSuccess(false);

    if (honeypot.trim() !== '') {
      setFormError(isEs ? 'Envío bloqueado.' : 'Envio bloqueado.');
      return;
    }
    if (nome.trim().length < 2) {
      setFormError(
        isEs ? 'Ingresa tu nombre completo.' : 'Informe seu nome completo.',
      );
      return;
    }
    if (depoimento.trim().length < 10) {
      setFormError(
        isEs
          ? 'Cuéntanos brevemente tu experiencia (mínimo 10 caracteres).'
          : 'Conte resumidamente como foi sua integração (mínimo 10 caracteres).',
      );
      return;
    }
    if (!autorizado) {
      setFormError(
        isEs
          ? 'Debes autorizar la publicación de tu testimonio en el sitio.'
          : 'Confirme a autorização de publicação do seu depoimento no site.',
      );
      return;
    }

    setSubmitting(true);
    try {
      let uploadedVideoUrl = '';
      let uploadedVideoMime = '';

      if (recordedBlob) {
        if (recordedBlob.size > MAX_VIDEO_UPLOAD_BYTES) {
          throw new Error(
            isEs
              ? 'El video grabado supera los 8 MB. Intenta una grabación más breve.'
              : 'O vídeo gravado ultrapassou 8 MB. Tente uma gravação um pouco mais curta.',
          );
        }
        const formData = new FormData();
        const ext = recordedMime.includes('mp4')
          ? 'mp4'
          : recordedMime.includes('quicktime')
            ? 'mov'
            : 'webm';
        formData.append('video', recordedBlob, `depoimento.${ext}`);

        const uploadResp = await fetch('/api/testimonials/upload-video', {
          method: 'POST',
          body: formData,
        });
        const uploadData = (await uploadResp.json().catch(() => ({}))) as {
          url?: string;
          mimeType?: string;
          error?: string;
        };
        if (!uploadResp.ok || !uploadData.url) {
          throw new Error(
            uploadData.error ||
              (isEs
                ? 'No fue posible subir el video en este momento.'
                : 'Não foi possível enviar o vídeo neste momento.'),
          );
        }
        uploadedVideoUrl = uploadData.url;
        uploadedVideoMime = uploadData.mimeType || recordedMime;
      }

      const saved = await submitClientTestimonialPublic({
        nome: nome.trim(),
        cidadeOrigem: cidadeOrigem.trim(),
        cidadeDestino: cidadeDestino.trim(),
        tipoVisto: tipoVisto.trim(),
        categoriaParceiro,
        depoimento: depoimento.trim(),
        videoUrl: uploadedVideoUrl,
        videoMimeType: uploadedVideoMime,
        duracaoSegundos: recordedDuration,
        avaliacao,
        autorizado: true,
        honeypot: '',
      });

      setCloudTestimonials((prev) => [saved, ...prev]);
      setActiveIndex(0);
      setSubmitSuccess(true);
      stopCameraStream();
      clearRecordedVideo();
      setNome('');
      setCidadeOrigem('');
      setTipoVisto('');
      setDepoimento('');
      setAvaliacao(5);
      setStudioOpen(false);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : isEs
            ? 'No fue posible publicar tu testimonio ahora.'
            : 'Não foi possível publicar seu depoimento agora.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <section
      id="depoimentos-clientes"
      className="scroll-mt-24 bg-white dark:bg-[#0D1E31] border border-[#E5DFD2] dark:border-[#1C324B] rounded-2xl overflow-hidden"
    >
      {/* Header Bar */}
      <div className="px-6 py-6 sm:px-8 sm:py-7 border-b border-[#E5DFD2] dark:border-[#1C324B] flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <p className="brand-kicker">
            {isEs
              ? 'Historias reales · Integración Brasil–Chile'
              : 'Histórias reais · Integração Brasil–Chile'}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0B1F33] dark:text-white leading-tight text-balance">
            {isEs
              ? 'Clientes que se establecieron en Chile con apoyo de nuestra red'
              : 'Clientes que se estabeleceram no Chile com apoio da nossa rede'}
          </h2>
          <p className="text-sm text-[#4A5A6D] dark:text-slate-300 leading-relaxed">
            {isEs
              ? 'Relatos reales y videos cortos grabados por clientes integrados para brindar total transparencia a nuevos clientes y aliados.'
              : 'Relatos reais e vídeos curtos gravados por clientes integrados para reforçar a confiança de quem contrata e de quem se torna parceiro.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setStudioOpen((v) => {
                if (v) {
                  stopCameraStream();
                }
                return !v;
              });
              setSubmitSuccess(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B1F33] dark:bg-[#C8A236] hover:opacity-95 text-white dark:text-[#0B1F33] text-xs font-semibold transition-opacity whitespace-nowrap shrink-0"
          >
            {studioOpen ? (
              <>
                <X className="w-4 h-4" />
                {isEs ? 'Cerrar estudio' : 'Fechar gravação'}
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" />
                {isEs ? 'Grabar testimonio en video' : 'Gravar depoimento em vídeo'}
              </>
            )}
          </button>

          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label={isEs ? 'Testimonio anterior' : 'Depoimento anterior'}
              className="w-10 h-10 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#11263D] hover:bg-[#EFECE3] dark:hover:bg-[#183350] text-[#0B1F33] dark:text-slate-100 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-semibold text-[#4A5A6D] dark:text-slate-300 tabular-nums px-1.5">
              {String(safeIndex + 1).padStart(2, '0')}/{String(testimonials.length).padStart(2, '0')}
            </span>
            <button
              type="button"
              onClick={handleNext}
              aria-label={isEs ? 'Siguiente testimonio' : 'Próximo depoimento'}
              className="w-10 h-10 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#11263D] hover:bg-[#EFECE3] dark:hover:bg-[#183350] text-[#0B1F33] dark:text-slate-100 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Banner */}
      {submitSuccess && (
        <div className="mx-6 sm:mx-8 mt-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 flex items-center gap-3 text-sm">
          <CheckCircle2 className="w-5 h-5 text-[#146B43] dark:text-emerald-400 shrink-0" />
          <p>
            {isEs
              ? 'Tu testimonio fue publicado con éxito en el carrusel oficial. ¡Gracias por compartir tu experiencia!'
              : 'Seu depoimento foi publicado com sucesso no carrossel oficial. Obrigado por compartilhar sua jornada!'}
          </p>
        </div>
      )}

      {/* Expandable Webcam Video Testimonial Studio */}
      <AnimatePresence initial={false}>
        {studioOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden border-b border-[#E5DFD2] dark:border-[#1C324B] bg-[#FAF9F6] dark:bg-[#091828]"
          >
            <form onSubmit={handlePublishTestimonial} className="p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Webcam Recorder / Short Video Uploader */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8C6D14] dark:text-[#E5C76B]">
                    {isEs ? 'Video corto (hasta 30s)' : 'Vídeo curto via webcam (até 30s)'}
                  </p>
                  {recording && (
                    <span className="text-xs font-mono font-bold text-[#A61C2B] dark:text-red-400 tabular-nums">
                      REC · {formatSecondsTimer(elapsedSeconds)} / {formatSecondsTimer(MAX_RECORD_SECONDS)}
                    </span>
                  )}
                </div>

                <div className="relative aspect-video rounded-xl overflow-hidden border border-[#DDD6C7] dark:border-[#1C324B] bg-[#0B1F33] flex items-center justify-center">
                  {recordedPreviewUrl ? (
                    <video
                      src={recordedPreviewUrl}
                      controls
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  ) : cameraActive ? (
                    <video
                      ref={liveVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                  ) : (
                    <div className="text-center px-6 py-8 space-y-2">
                      <Video className="w-8 h-8 text-[#E5C76B] mx-auto" />
                      <p className="text-sm font-semibold text-white">
                        {isEs ? 'Graba un mensaje breve desde tu webcam' : 'Grave um relato rápido pela sua webcam'}
                      </p>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {isEs
                          ? 'Opcional · Máximo 30 segundos (WebM/MP4 hasta 8 MB).'
                          : 'Opcional · Até 30 segundos (WebM/MP4 até 8 MB).'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Recorder Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  {!cameraActive && !recordedPreviewUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleEnableCamera()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#0B1F33] dark:bg-[#1B4D7A] hover:opacity-95 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#E5C76B]" />
                        {isEs ? 'Activar webcam' : 'Ativar webcam'}
                      </button>
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/webm,video/mp4,video/quicktime,.webm,.mp4,.mov"
                        className="hidden"
                        onChange={(e) => handleVideoFileSelected(e.target.files)}
                      />
                      <button
                        type="button"
                        onClick={() => videoFileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] hover:bg-slate-50 dark:hover:bg-[#11263D] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 whitespace-nowrap shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {isEs ? 'Subir video corto' : 'Enviar vídeo curto'}
                      </button>
                    </>
                  )}

                  {cameraActive && !recording && (
                    <>
                      <button
                        type="button"
                        onClick={handleStartRecording}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#A61C2B] hover:bg-[#8d1724] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                      >
                        <Film className="w-3.5 h-3.5" />
                        {isEs ? 'Iniciar grabación' : 'Iniciar gravação'}
                      </button>
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#4A5A6D] dark:text-slate-300 whitespace-nowrap shrink-0"
                      >
                        <VideoOff className="w-3.5 h-3.5" />
                        {isEs ? 'Desactivar' : 'Desligar câmera'}
                      </button>
                    </>
                  )}

                  {recording && (
                    <button
                      type="button"
                      onClick={handleStopRecording}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B1F33] dark:bg-[#C8A236] text-white dark:text-[#0B1F33] text-xs font-semibold whitespace-nowrap shrink-0"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                      {isEs ? 'Detener grabación' : 'Parar gravação'}
                    </button>
                  )}

                  {recordedPreviewUrl && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleEnableCamera()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-xs font-semibold text-[#0B1F33] dark:text-slate-100 whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {isEs ? 'Grabar de nuevo' : 'Regravar'}
                      </button>
                      <button
                        type="button"
                        onClick={clearRecordedVideo}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-[#A61C2B] dark:text-red-400 hover:underline whitespace-nowrap shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                        {isEs ? 'Quitar video' : 'Remover vídeo'}
                      </button>
                    </>
                  )}
                </div>

                {cameraError && (
                  <p className="text-xs font-medium text-[#A61C2B] dark:text-red-400 leading-relaxed">
                    {cameraError}
                  </p>
                )}
              </div>

              {/* Right Column: Client Details & Story */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="hidden" aria-hidden="true">
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => setHoneypot(e.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="dep-nome" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    {isEs ? 'Tu nombre *' : 'Seu nome *'}
                  </label>
                  <input
                    id="dep-nome"
                    required
                    maxLength={140}
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder={isEs ? 'Ej.: Lucas Mendes' : 'Ex.: Lucas Mendes'}
                    className="w-full px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                  />
                </div>

                <div>
                  <label htmlFor="dep-area" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    {isEs ? 'Área de aliado utilizada' : 'Área de parceiro utilizada'}
                  </label>
                  <select
                    id="dep-area"
                    value={categoriaParceiro}
                    onChange={(e) => setCategoriaParceiro(e.target.value as PartnerCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                  >
                    {PARTNER_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {translatePartnerCategory(c, locale)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dep-origem" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    {isEs ? 'Ciudad de origen (Brasil)' : 'Cidade de origem (Brasil)'}
                  </label>
                  <input
                    id="dep-origem"
                    maxLength={120}
                    value={cidadeOrigem}
                    onChange={(e) => setCidadeOrigem(e.target.value)}
                    placeholder="Ex.: São Paulo, SP"
                    className="w-full px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                  />
                </div>

                <div>
                  <label htmlFor="dep-destino" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    {isEs ? 'Ciudad actual en Chile' : 'Cidade atual no Chile'}
                  </label>
                  <input
                    id="dep-destino"
                    maxLength={120}
                    value={cidadeDestino}
                    onChange={(e) => setCidadeDestino(e.target.value)}
                    placeholder="Ex.: Providencia, Santiago"
                    className="w-full px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                  />
                </div>

                <div>
                  <label htmlFor="dep-visto" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    {isEs ? 'Tipo de visa / trámite' : 'Tipo de visto / processo'}
                  </label>
                  <input
                    id="dep-visto"
                    maxLength={120}
                    value={tipoVisto}
                    onChange={(e) => setTipoVisto(e.target.value)}
                    placeholder={isEs ? 'Ej.: Residencia Temporal Mercosur' : 'Ex.: Residência Temporal Mercosul'}
                    className="w-full px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                  />
                </div>

                <div>
                  <span className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    {isEs ? 'Evaluación' : 'Avaliação'}
                  </span>
                  <div className="flex items-center gap-1 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setAvaliacao(star)}
                        aria-label={`${star} / 5`}
                        className="p-1 rounded hover:bg-[#EFECE3] dark:hover:bg-[#11263D]"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= avaliacao
                              ? 'fill-[#C8A236] text-[#C8A236]'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="dep-texto" className="block text-xs font-semibold text-[#0B1F33] dark:text-slate-200 mb-1">
                    {isEs ? 'Resumen de tu experiencia *' : 'Resumo da sua integração *'}
                  </label>
                  <textarea
                    id="dep-texto"
                    required
                    rows={3}
                    maxLength={1200}
                    value={depoimento}
                    onChange={(e) => setDepoimento(e.target.value)}
                    placeholder={
                      isEs
                        ? 'Cuéntanos qué necesitabas resolver y cómo la red homologada ayudó en tu llegada a Chile...'
                        : 'Conte qual desafio precisava resolver e como a assessoria e os parceiros ajudaram na sua chegada ao Chile...'
                    }
                    className="w-full px-3 py-2 rounded-lg border border-[#DDD6C7] dark:border-[#1C324B] bg-white dark:bg-[#0D1E31] text-sm text-[#0B1523] dark:text-slate-100 focus:outline-none focus:border-[#0B1F33] dark:focus:border-[#E5C76B]"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <label className="inline-flex items-start gap-2 text-xs text-[#4A5A6D] dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autorizado}
                      onChange={(e) => setAutorizado(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300"
                    />
                    <span>
                      {isEs
                        ? 'Autorizo publicar mi testimonio y video corto en la página de D&M Integra Chile.'
                        : 'Autorizo a publicação deste depoimento e vídeo curto na página da D&M Integra Chile.'}
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#C8A236] hover:bg-[#b5912c] text-[#0B1F33] text-xs font-bold disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {isEs ? 'Publicando...' : 'Publicando...'}
                      </>
                    ) : (
                      isEs ? 'Publicar testimonio' : 'Publicar depoimento'
                    )}
                  </button>
                </div>

                {formError && (
                  <p className="sm:col-span-2 text-xs font-medium text-[#A61C2B] dark:text-red-400">
                    {formError}
                  </p>
                )}
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Carousel Slide */}
      {current && (
        <div className="p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.article
              key={current.id}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className={`grid grid-cols-1 ${
                current.videoUrl ? 'lg:grid-cols-12' : 'lg:grid-cols-12'
              } gap-6 lg:gap-8 items-center`}
            >
              {/* Left Visual / Video Slot */}
              {current.videoUrl ? (
                <div className="lg:col-span-5">
                  <div className="relative aspect-video rounded-xl overflow-hidden border border-[#E5DFD2] dark:border-[#1C324B] bg-[#0B1F33]">
                    <video
                      key={current.videoUrl}
                      src={current.videoUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-[11px] text-[#4A5A6D] dark:text-slate-400 mt-2 font-mono tabular-nums">
                    {isEs ? 'Video grabado por cliente verificado' : 'Vídeo gravado por cliente integrado'}
                    {current.duracaoSegundos ? ` · ${current.duracaoSegundos}s` : ''}
                  </p>
                </div>
              ) : (
                <div className="lg:col-span-4 rounded-xl bg-[#0B1F33] text-white p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <Quote className="w-6 h-6 text-[#E5C76B]" />
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: current.avaliacao || 5 }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-base font-bold text-white leading-snug">{current.nome}</p>
                    {(current.cidadeOrigem || current.cidadeDestino) && (
                      <p className="text-xs text-slate-300 inline-flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#E5C76B] shrink-0" />
                        <span>
                          {[current.cidadeOrigem, current.cidadeDestino].filter(Boolean).join(' → ')}
                        </span>
                      </p>
                    )}
                  </div>
                  <div className="pt-3 border-t border-white/15 space-y-1 text-xs text-slate-300">
                    {current.tipoVisto && <p>{current.tipoVisto}</p>}
                    {current.categoriaParceiro && (
                      <p className="text-[#E5C76B] font-semibold">
                        {isEs ? 'Área utilizada:' : 'Área acionada:'}{' '}
                        {translatePartnerCategory(current.categoriaParceiro, locale)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Right Narrative Column */}
              <div className={`${current.videoUrl ? 'lg:col-span-7' : 'lg:col-span-8'} space-y-4`}>
                {current.videoUrl && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#4A5A6D] dark:text-slate-300">
                    <span className="font-semibold text-[#8C6D14] dark:text-[#E5C76B]">
                      {current.categoriaParceiro
                        ? translatePartnerCategory(current.categoriaParceiro, locale)
                        : isEs
                          ? 'Integración Chile'
                          : 'Integração Chile'}
                    </span>
                    {current.tipoVisto && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{current.tipoVisto}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono font-semibold text-[#0B1F33] dark:text-white tabular-nums">
                      <Star className="w-3.5 h-3.5 fill-[#C8A236] text-[#C8A236]" />
                      {Number(current.avaliacao || 5).toFixed(1)}/5
                    </span>
                  </div>
                )}

                <blockquote className="text-base sm:text-lg text-[#0B1F33] dark:text-slate-100 leading-relaxed font-medium">
                  “{current.depoimento}”
                </blockquote>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1EDE4] dark:border-[#1C324B]">
                  <div className="text-xs text-[#4A5A6D] dark:text-slate-300">
                    <span className="font-bold text-[#0B1F33] dark:text-white">{current.nome}</span>
                    {(current.cidadeOrigem || current.cidadeDestino) && (
                      <>
                        {' · '}
                        <span>
                          {[current.cidadeOrigem, current.cidadeDestino].filter(Boolean).join(' → ')}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Interactive Slide Selectors */}
                  <div className="flex items-center gap-1.5" role="tablist" aria-label={isEs ? 'Seleccionar testimonio' : 'Selecionar depoimento'}>
                    {testimonials.map((item, idx) => {
                      const active = idx === safeIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          aria-label={`${idx + 1}: ${item.nome}`}
                          onClick={() => setActiveIndex(idx)}
                          className={`h-2 rounded-full transition-all ${
                            active
                              ? 'w-7 bg-[#C8A236]'
                              : 'w-2 bg-[#DDD6C7] dark:bg-[#1C324B] hover:bg-[#8C6D14]'
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>
        </div>
      )}
    </section>
  );
};
