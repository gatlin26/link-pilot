/**
 * @file image-uploader.tsx
 * @description 图片选择组件 - 支持拖拽和点击选择，只做本地预览
 * @author git.username
 * @date 2025-12-20
 */

'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from 'react';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface ImageUploaderProps {
  onUpload: (file: File) => void;
  onClear?: () => void;
  previewUrl?: string | null;
  disabled?: boolean;
  isProcessing?: boolean;
  className?: string;
  /** 最大文件大小（MB），默认 2MB */
  maxSizeMB?: number;
}

export function ImageUploader({
  onUpload,
  onClear,
  previewUrl,
  disabled = false,
  isProcessing = false,
  className,
  maxSizeMB = 2,
}: ImageUploaderProps) {
  const t = useTranslations('LandingPage.quickEnhance.upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return t('errorFormat');
      }
      if (file.size > maxSizeBytes) {
        return t('errorSize', { size: maxSizeMB });
      }
      return null;
    },
    [t, maxSizeBytes, maxSizeMB]
  );

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }
      setError(null);
      onUpload(file);
    },
    [validateFile, onUpload]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || isProcessing) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, isProcessing, handleFile]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      // 重置 input 以便可以重复选择同一文件
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (disabled || isProcessing) return;
    inputRef.current?.click();
  }, [disabled, isProcessing]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setError(null);
      onClear?.();
    },
    [onClear]
  );

  return (
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isProcessing}
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center',
          'w-full aspect-[4/3] rounded-xl border-2 border-dashed',
          'transition-all duration-200 cursor-pointer',
          'bg-muted/30 hover:bg-muted/50',
          isDragOver && 'border-primary bg-primary/5',
          !isDragOver && 'border-muted-foreground/25',
          (disabled || isProcessing) && 'opacity-50 cursor-not-allowed',
          previewUrl && 'border-solid border-muted'
        )}
      >
        {previewUrl ? (
          <>
            <Image
              src={previewUrl}
              alt="Preview"
              fill
              className="object-contain rounded-lg p-2"
            />
            {!isProcessing && onClear && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 size-8 rounded-full shadow-md"
                onClick={handleClear}
              >
                <X className="size-4" />
              </Button>
            )}
            {isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="flex items-center justify-center size-14 rounded-full bg-primary/10">
              <ImagePlus className="size-7 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t('dragDrop')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('formats', { size: maxSizeMB })}
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-xs text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
