/**
 * @file stacked-image-preview.tsx
 * @description Album-style stacked image preview with integrated upload button
 * @author git.username
 * @date 2026-01-13
 */

'use client';

import { cn } from '@/lib/utils';
import { Loader2, Plus, X } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import { useState } from 'react';
import type { UploadedImage } from './multi-image-uploader';

interface StackedImagePreviewProps {
  images: UploadedImage[];
  onImageClick?: (index: number) => void;
  onImageRemove?: (id: string) => void;
  onAddClick?: () => void;
  canUploadMore?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: { imageSize: 36, offset: 10, maxVisible: 3 },
  md: { imageSize: 44, offset: 12, maxVisible: 4 },
  lg: { imageSize: 52, offset: 14, maxVisible: 4 },
};

export function StackedImagePreview({
  images,
  onImageClick,
  onImageRemove,
  onAddClick,
  canUploadMore = false,
  disabled = false,
  size = 'md',
  className,
}: StackedImagePreviewProps) {
  const [hoveredImageIndex, setHoveredImageIndex] = useState<number | null>(
    null
  );
  const [hoveredUploadButton, setHoveredUploadButton] = useState(false);
  const [isContainerHovered, setIsContainerHovered] = useState(false);
  const config = sizeConfig[size];

  // Calculate rotation angle for fan effect
  const getRotation = (index: number, total: number) => {
    if (total === 1) return 0;

    const middle = (total - 1) / 2;
    const offset = index - middle;
    const maxRotation = 8; // Maximum rotation angle in degrees

    return (offset / middle) * maxRotation;
  };

  // Calculate z-index (middle item on top)
  const getZIndex = (index: number, total: number) => {
    const middle = (total - 1) / 2;
    const distance = Math.abs(index - middle);
    return 20 - Math.floor(distance);
  };

  // Dynamic offset calculation based on image count and hover state
  const calculateOffset = (imageCount: number, isHovered: boolean) => {
    if (isHovered) {
      return config.offset * 1.2; // Expand more on hover
    }

    // Dynamically adjust offset based on image count
    if (imageCount <= 3) return config.offset; // 12px - normal spacing
    if (imageCount <= 6) return config.offset * 0.6; // 7-8px - medium overlap
    if (imageCount <= 10) return config.offset * 0.5; // 6px - more overlap
    return config.offset * 0.4; // 5px - high overlap
  };

  // Show all images (no limit)
  const visibleImages = images;
  const totalVisibleItems = visibleImages.length + (canUploadMore ? 1 : 0);

  // Calculate current offset based on hover state
  const currentOffset = calculateOffset(totalVisibleItems, isContainerHovered);

  // Container width: imageSize + offset for each additional visible item
  const containerWidth =
    config.imageSize + (totalVisibleItems - 1) * currentOffset;

  return (
    <motion.div
      className={cn('relative', className)}
      style={{
        width: containerWidth,
        height: config.imageSize,
      }}
      animate={{
        scale: isContainerHovered ? 1.1 : 1,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
      onMouseEnter={() => setIsContainerHovered(true)}
      onMouseLeave={() => setIsContainerHovered(false)}
    >
      {/* Stacked image previews */}
      {visibleImages.map((image, index) => {
        const isImageHovered = hoveredImageIndex === index;
        const isUploading = image.uploadStatus === 'uploading';
        const leftOffset = index * currentOffset;
        const rotation = getRotation(index, totalVisibleItems);
        const zIndex = getZIndex(index, totalVisibleItems);

        return (
          <motion.div
            key={image.id}
            className="absolute"
            style={{
              width: config.imageSize,
              height: config.imageSize,
              zIndex: isImageHovered ? 100 : isUploading ? 90 : zIndex,
              transformOrigin: 'center center',
            }}
            initial={{ opacity: 0, scale: 0.8, x: -20 }}
            animate={{
              opacity: 1,
              scale: isUploading ? 1.08 : 1,
              x: 0,
              left: leftOffset,
              rotate: rotation,
            }}
            exit={{ opacity: 0, scale: 0.8, x: -20 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 25,
              delay: index * 0.05,
            }}
            whileHover={{ scale: 1.05, y: -4, rotate: 0 }}
            onMouseEnter={() => setHoveredImageIndex(index)}
            onMouseLeave={() => setHoveredImageIndex(null)}
          >
            <button
              type="button"
              onClick={() => onImageClick?.(index)}
              disabled={disabled}
              className={cn(
                'relative w-full h-full rounded-xl overflow-hidden cursor-pointer',
                'border-2 border-background',
                'shadow-lg hover:shadow-xl',
                'transition-shadow duration-200',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Image
                src={image.previewUrl}
                alt={`Preview ${index + 1}`}
                fill
                className="object-cover"
                sizes={`${config.imageSize}px`}
                unoptimized
              />

              {/* Upload status overlay */}
              {image.uploadStatus === 'uploading' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/90 ring-2 ring-primary ring-inset backdrop-blur-sm">
                  <Loader2 className="size-6 text-primary animate-spin" />
                </div>
              )}

              {/* Failed indicator */}
              {image.uploadStatus === 'failed' && (
                <div className="absolute inset-0 flex items-center justify-center bg-destructive/30 ring-2 ring-destructive/50 ring-inset" />
              )}
            </button>

            {/* Delete button - only show on hover */}
            {onImageRemove &&
              isImageHovered &&
              image.uploadStatus !== 'uploading' &&
              !disabled && (
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onImageRemove(image.id);
                  }}
                  className="absolute -top-1 -right-1 z-[110] size-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-md hover:scale-110 transition-transform"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <X className="size-3" />
                </motion.button>
              )}
          </motion.div>
        );
      })}

      {/* Upload button - integrated as part of the stack */}
      {canUploadMore && (
        <motion.button
          type="button"
          onClick={onAddClick}
          disabled={disabled}
          className={cn(
            'absolute rounded-xl',
            'flex items-center justify-center',
            'bg-muted/80 hover:bg-muted',
            'border-2 border-background',
            'text-muted-foreground hover:text-foreground',
            'transition-all duration-200',
            'shadow-lg hover:shadow-xl',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{
            width: config.imageSize,
            height: config.imageSize,
            zIndex: hoveredUploadButton
              ? 100
              : getZIndex(visibleImages.length, totalVisibleItems),
            transformOrigin: 'center center',
          }}
          initial={{ opacity: 0, scale: 0.8, x: -20 }}
          animate={{
            opacity: 1,
            scale: 1,
            x: 0,
            left: visibleImages.length * currentOffset,
            rotate: getRotation(visibleImages.length, totalVisibleItems),
          }}
          whileHover={{ scale: disabled ? 1 : 1.05, y: -4, rotate: 0 }}
          whileTap={{ scale: disabled ? 1 : 0.95 }}
          transition={{
            type: 'spring',
            stiffness: 400,
            damping: 25,
            delay: visibleImages.length * 0.05,
          }}
          onMouseEnter={() => setHoveredUploadButton(true)}
          onMouseLeave={() => setHoveredUploadButton(false)}
        >
          <Plus className="size-5" />
        </motion.button>
      )}
    </motion.div>
  );
}
