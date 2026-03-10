/**
 * @file image-preview-dialog.tsx
 * @description 图片预览对话框 - 简洁的 lightbox 设计
 * @author git.username
 * @date 2026-01-13
 */

'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface ImagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 单图模式 */
  imageUrl?: string;
  /** 多图模式 - 图片URL数组 */
  images?: string[];
  /** 多图模式 - 初始索引 */
  initialIndex?: number;
  alt?: string;
  onDownload?: () => void;
}

export function ImagePreviewDialog({
  open,
  onOpenChange,
  imageUrl,
  images,
  initialIndex = 0,
  alt = 'Preview image',
  onDownload,
}: ImagePreviewDialogProps) {
  const t = useTranslations('LandingPage.aiEditor.preview');
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  // Determine display mode and current image
  const imageList = images || (imageUrl ? [imageUrl] : []);
  const isGalleryMode = imageList.length > 1;
  const currentImageUrl = imageList[currentIndex] || '';

  // Reset index when dialog opens or images change
  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
    }
  }, [open, initialIndex]);

  // Navigation handlers
  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : imageList.length - 1));
  }, [imageList.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < imageList.length - 1 ? prev + 1 : 0));
  }, [imageList.length]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || !isGalleryMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isGalleryMode, goToPrevious, goToNext]);

  // 关闭时重置状态
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setCurrentIndex(0);
      }
      onOpenChange(newOpen);
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          'max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none',
          'flex flex-col items-center justify-center overflow-hidden'
        )}
      >
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>

        {/* 关闭按钮 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleOpenChange(false)}
          className="absolute top-4 right-4 z-10 size-10 text-white hover:bg-white/20 rounded-full"
        >
          <X className="size-5" />
        </Button>

        {/* 下载按钮 */}
        {onDownload && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDownload}
            className="absolute top-4 left-4 z-10 size-10 text-white hover:bg-white/20 rounded-full"
          >
            <Download className="size-5" />
          </Button>
        )}

        {/* 左侧导航按钮 */}
        {isGalleryMode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 size-12 text-white hover:bg-white/20 rounded-full"
          >
            <ChevronLeft className="size-6" />
          </Button>
        )}

        {/* 右侧导航按钮 */}
        {isGalleryMode && (
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 size-12 text-white hover:bg-white/20 rounded-full"
          >
            <ChevronRight className="size-6" />
          </Button>
        )}

        {/* 图片容器 */}
        <div className="relative w-full h-full flex items-center justify-center p-8">
          <Image
            src={currentImageUrl}
            alt={alt}
            width={1024}
            height={1024}
            unoptimized
            className="max-w-[85vw] max-h-[85vh] w-auto h-auto object-contain rounded-lg select-none"
            draggable={false}
          />
        </div>

        {/* 底部页码指示器 */}
        {isGalleryMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
            {imageList.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  'rounded-full transition-all duration-200',
                  index === currentIndex
                    ? 'bg-white size-2.5'
                    : 'bg-white/40 hover:bg-white/60 size-2'
                )}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
