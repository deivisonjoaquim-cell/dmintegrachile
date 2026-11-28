import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { OptimizedImage } from '../OptimizedImage';
import {
  OFFICE_OPERATIONS_SLIDES,
  type OfficeOperationSlide,
  formatSlideCounter,
  getNextSlideIndex,
  getPrevSlideIndex,
} from '../../utils/aboutShowcase';

interface OfficeOperationsCarouselProps {
  slides?: OfficeOperationSlide[];
  autoPlayIntervalMs?: number;
}

export const OfficeOperationsCarousel: React.FC<OfficeOperationsCarouselProps> = ({
  slides = OFFICE_OPERATIONS_SLIDES,
  autoPlayIntervalMs = 6500,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isPlaying, setIsPlaying] = useState(!prefersReducedMotion);
  const [isHovering, setIsHovering] = useState(false);

  const total = slides.length;
  const activeSlide = slides[activeIndex] || slides[0];

  const handleNext = useCallback(() => {
    setDirection(1);
    setActiveIndex((prev) => getNextSlideIndex(prev, total));
  }, [total]);

  const handlePrev = useCallback(() => {
    setDirection(-1);
    setActiveIndex((prev) => getPrevSlideIndex(prev, total));
  }, [total]);

  const handleSelect = useCallback(
    (index: number) => {
      if (index === activeIndex) return;
      setDirection(index > activeIndex ? 1 : -1);
      setActiveIndex(index);
      setIsPlaying(false);
    },
    [activeIndex],
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      setIsPlaying(false);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!isPlaying || isHovering || total <= 1) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setActiveIndex((prev) => getNextSlideIndex(prev, total));
    }, autoPlayIntervalMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, isHovering, total, autoPlayIntervalMs]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setIsPlaying(false);
      handleNext();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setIsPlaying(false);
      handlePrev();
    }
  };

  if (!activeSlide) return null;

  return (
    <div
      data-testid="office-operations-carousel"
      role="region"
      aria-roledescription="carrossel"
      aria-label="Operações diárias no escritório da D&M Integra Chile"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="space-y-8 outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D91] dark:focus-visible:ring-[#60A5FA] rounded-2xl"
    >
      {/* Cabeçalho editorial + controles discretos */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          <p className="text-xs font-semibold tracking-[0.08em] uppercase text-[#0F3D91] dark:text-[#60A5FA]">
            Bastidores do Escritório · Operação Diária
          </p>
          <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-[#0B1628] dark:text-white leading-[1.12] text-balance">
            Como conduzimos cada etapa da sua mudança no dia a dia
          </h2>
          <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
            Do primeiro diagnóstico em vídeo à auditoria de certidões apostiladas, protocolos no SERMIG, emissão do RUT e conexão com parceiros indicados.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start lg:self-end shrink-0">
          <span
            data-testid="carousel-slide-counter"
            aria-live="polite"
            className="font-mono text-xs font-medium tabular-nums text-[#4B5563] dark:text-slate-400 mr-2"
          >
            {formatSlideCounter(activeIndex, total)}
          </span>

          <button
            type="button"
            data-testid="carousel-toggle-autoplay"
            onClick={() => setIsPlaying((prev) => !prev)}
            aria-label={isPlaying ? 'Pausar apresentação automática' : 'Retomar apresentação automática'}
            title={isPlaying ? 'Pausar rotação' : 'Reproduzir automaticamente'}
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] text-[#4B5563] dark:text-slate-300 hover:text-[#0B1628] dark:hover:text-white hover:border-[#CBD5E1] dark:hover:border-slate-600 transition-colors"
          >
            {isPlaying ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4" aria-hidden="true" />}
          </button>

          <button
            type="button"
            data-testid="carousel-prev-btn"
            onClick={() => {
              setIsPlaying(false);
              handlePrev();
            }}
            aria-label="Foto anterior do escritório"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422] text-[#0B1628] dark:text-white hover:bg-[#F7F8FA] dark:hover:bg-[#151F32] hover:border-[#CBD5E1] dark:hover:border-slate-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>

          <button
            type="button"
            data-testid="carousel-next-btn"
            onClick={() => {
              setIsPlaying(false);
              handleNext();
            }}
            aria-label="Próxima foto do escritório"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg bg-[#0B1628] dark:bg-white text-white dark:text-[#0B1628] hover:bg-[#16233B] dark:hover:bg-slate-200 transition-colors"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Palco Fotográfico Principal (imagem 100% limpa, legenda editorial abaixo) */}
      <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#1E293B] bg-white dark:bg-[#0D1422]">
        <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-[#070E1C]">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={activeSlide.id}
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: direction * -24 }}
              transition={{ duration: prefersReducedMotion ? 0.15 : 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0"
            >
              <OptimizedImage
                src={activeSlide.imageUrl}
                alt={activeSlide.alt}
                priority={activeIndex === 0}
                placeholderTone="dark"
                sizes="(max-width: 1024px) 100vw, 1200px"
                className="w-full h-full object-cover object-center"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Barra Editorial de Legenda (zero overlays sobre o rosto/fotografia) */}
        <div className="p-6 sm:p-8 lg:px-10 lg:py-7 border-t border-[#E5E7EB] dark:border-[#1E293B] grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 items-start">
          <div className="lg:col-span-4 space-y-1.5">
            <p className="font-mono text-xs text-[#0F3D91] dark:text-[#60A5FA]">
              {String(activeIndex + 1).padStart(2, '0')}. {activeSlide.routineTag}
            </p>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">
              {activeSlide.locationLabel} · D&amp;M Integra Chile
            </p>
          </div>
          <div className="lg:col-span-8 space-y-2">
            <h3
              data-testid="carousel-active-title"
              className="font-display text-lg sm:text-xl font-bold text-[#0B1628] dark:text-white tracking-tight"
            >
              {activeSlide.title}
            </h3>
            <p className="text-sm sm:text-[15px] text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-3xl">
              {activeSlide.description}
            </p>
          </div>
        </div>
      </div>

      {/* Filmstrip de Miniaturas (navegação direta de alta precisão) */}
      <div
        role="tablist"
        aria-label="Selecionar cena do escritório"
        className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4"
      >
        {slides.map((slide, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`carousel-thumb-${index}`}
              onClick={() => handleSelect(index)}
              className={`group text-left rounded-xl overflow-hidden border transition-all focus-visible:outline-2 focus-visible:outline-[#0F3D91] dark:focus-visible:outline-[#60A5FA] ${
                isActive
                  ? 'border-[#0F3D91] dark:border-[#60A5FA] bg-white dark:bg-[#111B2E]'
                  : 'border-[#E5E7EB] dark:border-[#1E293B] bg-white/70 dark:bg-[#0D1422]/60 opacity-75 hover:opacity-100 hover:border-[#CBD5E1] dark:hover:border-slate-600'
              }`}
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-[#0D1422]">
                <OptimizedImage
                  src={slide.imageUrl}
                  alt={slide.title}
                  sizes="(max-width: 640px) 48vw, 220px"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="px-3 py-2.5 space-y-0.5">
                <p
                  className={`font-mono text-[10px] tabular-nums ${
                    isActive ? 'text-[#0F3D91] dark:text-[#60A5FA] font-semibold' : 'text-[#6B7280] dark:text-slate-400'
                  }`}
                >
                  {String(index + 1).padStart(2, '0')}. {slide.routineTag}
                </p>
                <p className="text-xs font-medium text-[#0B1628] dark:text-slate-100 line-clamp-1">
                  {slide.title}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
