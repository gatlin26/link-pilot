/**
 * @file image-uploader.tsx
 * @description 单张图片上传组件 - 支持拖拽、预览、自动转换 WebP、压缩
 * @author git.username
 * @date 2026-02-04
 */

'use client';

import { Button } from '@/components/ui/button';
import { convertImageToWebP, isValidImageType } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { uploadFileFromBrowser } from '@/storage/client';
import { ImagePlus, Loader2, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from 'react';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface ImageUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  className?: string;
  /** 上传到 R2 的目录，默认为 'images' */
  folder?: string;
  /** 图片质量，默认 0.85 */
  quality?: number;
}

export function ImageUploader({
  value,
  onChange,
  disabled = false,
  className,
  folder = 'images',
  quality = 0.85,
}: ImageUploaderProps) {
  const t = useTranslations('ToolsPage.submit.form');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!isValidImageType(file)) {
        return t('upload.error.invalidFormat');
      }
      if (file.size > MAX_SIZE_BYTES) {
        return t('upload.error.tooLarge', { size: MAX_SIZE_MB });
      }
      return null;
    },
    [t]
  );

  const handleFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      setIsUploading(true);

      try {
        // 转换为 WebP 格式并压缩
        const webpFile = await convertImageToWebP(file, quality);

        // 上传到 R2
        const result = await uploadFileFromBrowser(webpFile, folder);

        if (result?.url) {
          onChange(result.url);
        } else {
          setError(t('upload.error.uploadFailed'));
        }
      } catch (error) {
        console.error('Image upload error:', error);
        setError(
          error instanceof Error
            ? error.message
            : t('upload.error.uploadFailed')
        );
      } finally {
        setIsUploading(false);
      }
    },
    [validateFile, onChange, folder, quality, t]
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

      if (disabled || isUploading) return;

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFile(file);
      }
    },
    [disabled, isUploading, handleFile]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFile(file);
      }
      e.target.value = '';
    },
    [handleFile]
  );

  const handleClick = useCallback(() => {
    if (disabled || isUploading) return;
    inputRef.current?.click();
  }, [disabled, isUploading]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setError(null);
      onChange(null);
    },
    [onChange]
  );

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {value?.trim() ? (
        // 已上传图片预览
        <div className="relative aspect-video rounded-xl overflow-hidden bg-muted/30 border-2 border-border/50 group hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-lg">
          <Image
            src={value.trim()}
            alt="Uploaded image"
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {!isUploading && !disabled && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 size-7 rounded-full shadow-lg transition-all duration-200 hover:scale-110 bg-background/90 backdrop-blur-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100"
              onClick={handleClear}
            >
              <X className="size-4" />
            </Button>
          )}
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <Loader2 className="size-8 animate-spin text-primary" />
            </div>
          )}
        </div>
      ) : (
        // 上传区域
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center',
            'w-full rounded-2xl border-2 border-dashed',
            'transition-all duration-300 cursor-pointer',
            'bg-gradient-to-br from-muted/40 to-muted/20',
            'hover:from-muted/60 hover:to-muted/30',
            'min-h-[200px]',
            isDragOver &&
              'border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20',
            !isDragOver && 'border-muted-foreground/30 hover:border-primary/50',
            (disabled || isUploading) &&
              'opacity-50 cursor-not-allowed hover:scale-100'
          )}
        >
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div
              className={cn(
                'flex items-center justify-center rounded-2xl bg-primary/10 transition-all duration-300 size-14',
                isDragOver && 'scale-110 bg-primary/20'
              )}
            >
              {isUploading ? (
                <Loader2
                  className={cn(
                    'text-primary transition-all duration-300 size-7 animate-spin'
                  )}
                />
              ) : (
                <Upload
                  className={cn(
                    'text-primary transition-all duration-300 size-7',
                    isDragOver && 'scale-110'
                  )}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground text-sm">
                {isUploading
                  ? t('screenshot.uploading')
                  : t('screenshot.dragOrClick')}
              </p>
              <p className="text-xs text-muted-foreground/80">
                {t('screenshot.description')}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-xs text-destructive font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
