/**
 * @file logo-uploader.tsx
 * @description Logo 上传组件 - 支持拖拽、预览、自动转换 WebP
 * @author git.username
 * @date 2026-02-03
 */

'use client';

import { Button } from '@/components/ui/button';
import { convertImageToWebP, isValidImageType } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { uploadFileFromBrowser } from '@/storage/client';
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

const MAX_SIZE_MB = 1;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

interface LogoUploaderProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function LogoUploader({
  value,
  onChange,
  disabled = false,
  className,
}: LogoUploaderProps) {
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
        // 转换为 WebP 格式
        const webpFile = await convertImageToWebP(file, 0.85);

        // 上传到 R2 的 logos/ 目录
        const result = await uploadFileFromBrowser(webpFile, 'logos');

        if (result?.url) {
          onChange(result.url);
        } else {
          setError(t('upload.error.uploadFailed'));
        }
      } catch (error) {
        console.error('Logo upload error:', error);
        setError(
          error instanceof Error
            ? error.message
            : t('upload.error.uploadFailed')
        );
      } finally {
        setIsUploading(false);
      }
    },
    [validateFile, onChange, t]
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
    <div className={cn('relative', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center',
          'w-full aspect-square max-w-[200px] rounded-xl border-2 border-dashed',
          'transition-all duration-200 cursor-pointer',
          'bg-muted/30 hover:bg-muted/50',
          isDragOver && 'border-primary bg-primary/5',
          !isDragOver && 'border-muted-foreground/25',
          (disabled || isUploading) && 'opacity-50 cursor-not-allowed',
          value && 'border-solid border-muted'
        )}
      >
        {value?.trim() ? (
          <>
            <Image
              src={value.trim()}
              alt="Logo"
              fill
              className="object-contain rounded-lg p-2"
            />
            {!isUploading && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-2 right-2 size-7 rounded-full shadow-md"
                onClick={handleClear}
              >
                <X className="size-4" />
              </Button>
            )}
            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-lg">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <div className="flex items-center justify-center size-12 rounded-full bg-primary/10">
              {isUploading ? (
                <Loader2 className="size-6 animate-spin text-primary" />
              ) : (
                <ImagePlus className="size-6 text-primary" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">
                {isUploading ? t('logo.uploading') : t('logo.uploadLogo')}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {t('logo.description')}
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
