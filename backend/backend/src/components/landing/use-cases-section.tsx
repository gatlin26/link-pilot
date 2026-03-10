/**
 * @file use-cases-section.tsx
 * @description Use Cases Section - Easemate style with magnetic hover effects
 * @author git.username
 * @date 2026-01-16
 */

'use client';

import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  ImageIcon,
  Music,
  Paintbrush,
  Palette,
  Pencil,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Users,
  Video,
  Wand2,
} from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

const DRAG_THRESHOLD = 50;
const AUTO_PLAY_INTERVAL = 5000;

interface UseCase {
  key: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const useCases: UseCase[] = [
  { key: 'marketing', icon: ShoppingBag },
  { key: 'social', icon: Smartphone },
  { key: 'avatar', icon: Users },
  { key: 'animation', icon: Film },
  { key: 'musicVideo', icon: Music },
  { key: 'storytelling', icon: Video },
  { key: 'productShots', icon: ImageIcon },
  { key: 'artCreation', icon: Palette },
  { key: 'videoEnhance', icon: Wand2 },
  { key: 'styleTransfer', icon: Paintbrush },
  { key: 'imageEdit', icon: Pencil },
  { key: 'shorts', icon: Clapperboard },
];

export function UseCasesSection() {
  const t = useTranslations('LandingPage.useCases');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const dragX = useMotionValue(0);

  const getVisibleCount = useCallback(() => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth >= 1024) return 4;
    if (window.innerWidth >= 768) return 2;
    return 1;
  }, []);

  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const updateVisibleCount = () => setVisibleCount(getVisibleCount());
    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, [getVisibleCount]);

  const maxIndex = useCases.length - visibleCount;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  }, [maxIndex]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  }, [maxIndex]);

  useEffect(() => {
    if (isPaused || isDragging) return;
    const interval = setInterval(goToNext, AUTO_PLAY_INTERVAL);
    return () => clearInterval(interval);
  }, [goToNext, isPaused, isDragging]);

  const handleDragEnd = () => {
    const x = dragX.get();
    if (x < -DRAG_THRESHOLD) {
      goToNext();
    } else if (x > DRAG_THRESHOLD) {
      goToPrev();
    }
    setIsDragging(false);
  };

  return (
    <section
      className="relative py-24 lg:py-32 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-white via-[#f8fafc] to-white dark:from-[#0a0f1a] dark:via-[#0f172a] dark:to-[#0a0f1a]" />

      {/* Mesh gradient blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-[#0052ff]/8 via-[#3d8bff]/5 to-transparent rounded-full blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16"
        >
          {/* Pill badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#0052ff]/10 dark:bg-[#3d8bff]/15 border border-[#0052ff]/20 dark:border-[#3d8bff]/25 rounded-full mb-5">
            <Sparkles className="size-4 text-[#0052ff] dark:text-[#3d8bff]" />
            <span className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-semibold uppercase tracking-wider">
              {t('sectionLabel')}
            </span>
          </div>

          <h2 className="font-heading text-3xl lg:text-5xl font-bold tracking-tight mb-5">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#0f172a] to-[#475569] dark:from-[#f8fafc] dark:to-[#94a3b8]">
              {t('title')}
            </span>
          </h2>
          <p className="text-[#64748b] dark:text-[#94a3b8] text-lg lg:text-xl max-w-2xl mx-auto leading-relaxed">
            {t('description')}
          </p>
        </motion.div>

        {/* Carousel */}
        <div className="relative">
          {/* Left Arrow */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToPrev}
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-20',
              'size-12 rounded-full',
              'bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl',
              'border border-[#e2e8f0] dark:border-[#334155]',
              'flex items-center justify-center',
              'text-[#64748b] hover:text-[#0052ff] dark:hover:text-[#3d8bff]',
              'hover:border-[#0052ff]/30 dark:hover:border-[#3d8bff]/30',
              'transition-all duration-300',
              'hidden md:flex'
            )}
            style={{
              boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.1)',
            }}
            aria-label="Previous"
          >
            <ChevronLeft className="size-5" />
          </motion.button>

          {/* Right Arrow */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={goToNext}
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-20',
              'size-12 rounded-full',
              'bg-white/90 dark:bg-[#111827]/90 backdrop-blur-xl',
              'border border-[#e2e8f0] dark:border-[#334155]',
              'flex items-center justify-center',
              'text-[#64748b] hover:text-[#0052ff] dark:hover:text-[#3d8bff]',
              'hover:border-[#0052ff]/30 dark:hover:border-[#3d8bff]/30',
              'transition-all duration-300',
              'hidden md:flex'
            )}
            style={{
              boxShadow: '0 4px 20px -5px rgba(0, 0, 0, 0.1)',
            }}
            aria-label="Next"
          >
            <ChevronRight className="size-5" />
          </motion.button>

          {/* Cards Container */}
          <div className="overflow-hidden mx-0 md:mx-8">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.1}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
              style={{ x: dragX }}
              animate={{
                x: `-${currentIndex * (100 / visibleCount)}%`,
              }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 30,
              }}
              className="flex cursor-grab active:cursor-grabbing"
            >
              {useCases.map((useCase, index) => (
                <motion.div
                  key={useCase.key}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="flex-shrink-0 px-3"
                  style={{ width: `${100 / visibleCount}%` }}
                >
                  <UseCaseCard useCase={useCase} t={t} />
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Pagination */}
          <div className="flex justify-center gap-2 mt-10">
            {Array.from({ length: maxIndex + 1 }).map((_, index) => (
              <button
                type="button"
                key={`indicator-${useCases[index]?.key || index}`}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'h-2 rounded-full transition-all duration-300',
                  currentIndex === index
                    ? 'w-8 bg-gradient-to-r from-[#0052ff] to-[#3d8bff]'
                    : 'w-2 bg-[#e2e8f0] dark:bg-[#334155] hover:bg-[#0052ff]/30 dark:hover:bg-[#3d8bff]/30'
                )}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface UseCaseCardProps {
  useCase: UseCase;
  t: ReturnType<typeof useTranslations<'LandingPage.useCases'>>;
}

function UseCaseCard({ useCase, t }: UseCaseCardProps) {
  const Icon = useCase.icon;
  const cardRef = useRef<HTMLDivElement>(null);

  // Magnetic effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [5, -5]), {
    stiffness: 300,
    damping: 30,
  });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-5, 5]), {
    stiffness: 300,
    damping: 30,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: 'preserve-3d',
      }}
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="group relative h-full perspective-1000"
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl',
          'bg-white/80 dark:bg-[#111827]/80',
          'backdrop-blur-xl',
          'border border-[#e2e8f0] dark:border-[#334155]',
          'p-6 h-full min-h-[280px]',
          'transition-all duration-300',
          'hover:border-[#0052ff]/40 dark:hover:border-[#3d8bff]/40'
        )}
        style={{
          boxShadow:
            '0 8px 32px -8px rgba(0, 82, 255, 0.1), 0 4px 16px -4px rgba(0, 0, 0, 0.06)',
        }}
      >
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0052ff]/5 via-transparent to-[#3d8bff]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Decorative circle */}
        <div className="absolute -top-12 -right-12 size-32 bg-gradient-to-br from-[#0052ff]/10 to-[#3d8bff]/5 rounded-full blur-2xl group-hover:from-[#0052ff]/15 group-hover:to-[#3d8bff]/10 transition-colors duration-500" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full">
          {/* Icon */}
          <div
            className={cn(
              'size-14 rounded-2xl mb-5',
              'bg-gradient-to-br from-[#0052ff] to-[#3d8bff]',
              'flex items-center justify-center',
              'group-hover:scale-110 transition-transform duration-300'
            )}
            style={{
              boxShadow: '0 8px 20px -4px rgba(0, 82, 255, 0.4)',
              transform: 'translateZ(20px)',
            }}
          >
            <Icon className="size-7 text-white" strokeWidth={1.5} />
          </div>

          {/* Title */}
          <h3 className="font-heading text-xl font-semibold text-[#0f172a] dark:text-[#f8fafc] mb-2 group-hover:text-[#0052ff] dark:group-hover:text-[#3d8bff] transition-colors">
            {t(`items.${useCase.key}.title` as Parameters<typeof t>[0])}
          </h3>

          {/* Subtitle */}
          <p className="text-sm text-[#0052ff] dark:text-[#3d8bff] font-medium mb-3">
            {t(`items.${useCase.key}.subtitle` as Parameters<typeof t>[0])}
          </p>

          {/* Description */}
          <p className="text-[#64748b] dark:text-[#94a3b8] text-sm leading-relaxed flex-grow">
            {t(`items.${useCase.key}.description` as Parameters<typeof t>[0])}
          </p>
        </div>

        {/* Bottom accent line */}
        <div className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[#0052ff]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>
    </motion.div>
  );
}
