/**
 * @file before-after-slider.tsx
 * @description 前后对比滑块组件
 * @author git.username
 * @date 2025-12-22
 */

'use client';

import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  type KeyboardEvent,
  type MouseEvent,
  type TouchEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';

/** 手柄位置边界常量（避免超出容器） */
const HANDLE_MIN = 5;
const HANDLE_MAX = 95;
/** 标签隐藏阈值 */
const LABEL_HIDE_THRESHOLD = 10;
const LABEL_FADE_RANGE = 10;

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeAlt?: string;
  afterAlt?: string;
  defaultPosition?: number;
  className?: string;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeAlt,
  afterAlt,
  defaultPosition = 50,
  className,
}: BeforeAfterSliderProps) {
  const t = useTranslations('LandingPage.common');
  const [position, setPosition] = useState(defaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  /** 计算标签透明度 */
  const labelOpacity = useMemo(() => {
    const beforeOpacity =
      position < LABEL_HIDE_THRESHOLD
        ? 0
        : position < LABEL_HIDE_THRESHOLD + LABEL_FADE_RANGE
          ? (position - LABEL_HIDE_THRESHOLD) / LABEL_FADE_RANGE
          : 1;

    const afterThreshold = 100 - LABEL_HIDE_THRESHOLD;
    const afterOpacity =
      position > afterThreshold
        ? 0
        : position > afterThreshold - LABEL_FADE_RANGE
          ? (afterThreshold - position) / LABEL_FADE_RANGE
          : 1;

    return { before: beforeOpacity, after: afterOpacity };
  }, [position]);

  /** 手柄位置（限制在容器内） */
  const handlePosition = useMemo(() => {
    return Math.max(HANDLE_MIN, Math.min(HANDLE_MAX, position));
  }, [position]);

  /** 处理位置更新 */
  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = (x / rect.width) * 100;
    // clipPath 允许完整 0-100 范围
    const clampedPercent = Math.max(0, Math.min(100, percent));
    setPosition(clampedPercent);
  }, []);

  /** 键盘控制支持 */
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setPosition((prev) => Math.max(0, prev - step));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setPosition((prev) => Math.min(100, prev + step));
    }
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleMove(e.clientX);
  };
  const handleTouchStart = () => setIsDragging(true);
  const handleTouchEnd = () => setIsDragging(false);
  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) handleMove(e.touches[0].clientX);
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="slider"
      aria-label={t('comparison')}
      aria-valuenow={Math.round(position)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        'relative overflow-hidden select-none touch-none cursor-ew-resize rounded-lg',
        'bg-card aspect-[4/3]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseMove={handleMouseMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onKeyDown={handleKeyDown}
    >
      {/* After 图片 */}
      <div className="absolute inset-0">
        <Image
          src={afterImage}
          alt={afterAlt || t('after')}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          draggable={false}
        />
        <span
          className="absolute bottom-4 right-4 px-3 py-1.5 bg-primary/90 text-primary-foreground text-xs font-semibold tracking-wider uppercase rounded transition-opacity duration-200"
          style={{ opacity: labelOpacity.after }}
        >
          {afterAlt || t('after')}
        </span>
      </div>

      {/* Before 图片 */}
      <div
        className="absolute inset-0"
        style={{
          clipPath: `inset(0 ${100 - position}% 0 0)`,
          willChange: 'clip-path',
        }}
      >
        <Image
          src={beforeImage}
          alt={beforeAlt || t('before')}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
          draggable={false}
        />
        <span
          className="absolute bottom-4 left-4 px-3 py-1.5 bg-background/90 text-foreground text-xs font-semibold tracking-wider uppercase rounded transition-opacity duration-200"
          style={{ opacity: labelOpacity.before }}
        >
          {beforeAlt || t('before')}
        </span>
      </div>

      {/* 垂直分割线 */}
      <div
        className="absolute top-0 bottom-0 z-[5] w-0.5 bg-primary-foreground/90 shadow-[0_0_8px_rgba(0,0,0,0.3)] pointer-events-none"
        style={{
          left: `${handlePosition}%`,
          transform: 'translateX(-50%)',
          willChange: 'left',
        }}
      />

      {/* 滑块手柄 */}
      <div
        className={cn(
          'absolute top-1/2 z-10',
          'w-11 h-11 bg-background rounded-full shadow-lg border border-border',
          'flex items-center justify-center',
          'transition-transform duration-150 ease-out',
          'hover:scale-110',
          isDragging && 'scale-110 shadow-xl'
        )}
        style={{
          left: `${handlePosition}%`,
          transform: 'translateX(-50%) translateY(-50%)',
          willChange: 'left',
        }}
      >
        {/* 左右箭头图标 */}
        <svg
          className="w-5 h-5 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7l-4 5 4 5M16 7l4 5-4 5"
          />
        </svg>
      </div>
    </div>
  );
}
