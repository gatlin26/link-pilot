/**
 * @file screenshots-uploader.tsx
 * @description 截图上传组件 - 支持多张图片、自动转换 WebP
 * @author git.username
 * @date 2026-02-03
 */

'use client';

import { Button } from '@/components/ui/button';
import { convertImageToWebP, isValidImageType } from '@/lib/image-utils';
import { cn } from '@/lib/utils';
import { uploadFileFromBrowser } from '@/storage/client';
import { ImagePlus, Loader2, RefreshCw, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const UPLOAD_CONCURRENCY = 1; // 一个个上传，避免并发问题

interface UploadedScreenshot {
  id: string;
  file: File | null;
  previewUrl: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  r2Url?: string;
}

interface ScreenshotsUploaderProps {
  value: string[];
  onChange: (urls: string[]) => void;
  maxImages?: number;
  disabled?: boolean;
  className?: string;
}

export function ScreenshotsUploader({
  value,
  onChange,
  maxImages = 5,
  disabled = false,
  className,
}: ScreenshotsUploaderProps) {
  const t = useTranslations('ToolsPage.submit.form');
  const [screenshots, setScreenshots] = useState<UploadedScreenshot[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const screenshotsRef = useRef(screenshots);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  // 同步 ref
  useEffect(() => {
    screenshotsRef.current = screenshots;
  }, [screenshots]);

  // 初始化：从 value 创建 screenshots（过滤掉空字符串，避免 Image src="" 报错）
  useEffect(() => {
    const validUrls = value.filter(
      (url) => typeof url === 'string' && url.trim() !== ''
    );
    if (validUrls.length > 0 && screenshots.length === 0) {
      const initialScreenshots: UploadedScreenshot[] = validUrls.map((url) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file: null,
        previewUrl: url,
        uploadStatus: 'uploaded',
        r2Url: url,
      }));
      setScreenshots(initialScreenshots);
    }
  }, [value, screenshots.length]);

  // 清理 ObjectURLs
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
    };
  }, []);

  const canUploadMore = screenshots.length < maxImages;

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

  const uploadToR2 = useCallback(
    async (screenshot: UploadedScreenshot): Promise<UploadedScreenshot> => {
      if (!screenshot.file) {
        return screenshot;
      }

      try {
        // 转换为 WebP
        const webpFile = await convertImageToWebP(screenshot.file, 0.85);

        // 上传到 R2 的 screenshots/ 目录
        const result = await uploadFileFromBrowser(webpFile, 'screenshots');

        if (result?.url) {
          return {
            ...screenshot,
            uploadStatus: 'uploaded',
            r2Url: result.url,
          };
        }
        return { ...screenshot, uploadStatus: 'failed' };
      } catch (error) {
        console.error('Screenshot upload error:', error);
        return { ...screenshot, uploadStatus: 'failed' };
      }
    },
    []
  );

  const handleRetryUpload = useCallback(
    async (id: string) => {
      const screenshot = screenshots.find((s) => s.id === id);
      if (!screenshot || screenshot.uploadStatus !== 'failed') return;

      const updatedScreenshots = screenshots.map((s) =>
        s.id === id ? { ...s, uploadStatus: 'uploading' as const } : s
      );
      screenshotsRef.current = updatedScreenshots;
      setScreenshots(updatedScreenshots);

      const uploaded = await uploadToR2(screenshot);
      const finalScreenshots = screenshotsRef.current.map((s) =>
        s.id === uploaded.id ? uploaded : s
      );
      screenshotsRef.current = finalScreenshots;
      setScreenshots(finalScreenshots);

      // 更新 onChange
      const urls = finalScreenshots
        .filter((s) => s.uploadStatus === 'uploaded' && s.r2Url)
        .map((s) => s.r2Url!);
      onChange(urls);
    },
    [screenshots, uploadToR2, onChange]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const currentScreenshots = screenshotsRef.current;
      const availableSlots = maxImages - currentScreenshots.length;

      if (availableSlots <= 0) {
        setError(t('upload.error.maxImages', { max: maxImages }));
        return;
      }

      const filesToAdd = fileArray.slice(0, availableSlots);
      const newScreenshots: UploadedScreenshot[] = [];

      for (const file of filesToAdd) {
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        const previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.add(previewUrl);

        newScreenshots.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          previewUrl,
          uploadStatus: 'uploading',
        });
      }

      if (newScreenshots.length > 0) {
        setError(null);
        const allScreenshots = [...currentScreenshots, ...newScreenshots];
        screenshotsRef.current = allScreenshots;
        setScreenshots(allScreenshots);

        // 并发受控上传
        let cursor = 0;
        const worker = async () => {
          while (true) {
            const i = cursor++;
            if (i >= newScreenshots.length) return;

            const screenshot = newScreenshots[i];
            const uploaded = await uploadToR2(screenshot);

            const exists = screenshotsRef.current.some(
              (s) => s.id === uploaded.id
            );
            if (!exists) continue;

            const updatedScreenshots = screenshotsRef.current.map((s) =>
              s.id === uploaded.id ? uploaded : s
            );
            screenshotsRef.current = updatedScreenshots;
            setScreenshots(updatedScreenshots);

            // 更新 onChange
            const urls = updatedScreenshots
              .filter((s) => s.uploadStatus === 'uploaded' && s.r2Url)
              .map((s) => s.r2Url!);
            onChange(urls);
          }
        };

        await Promise.all(
          Array.from({ length: UPLOAD_CONCURRENCY }, () => worker())
        );
      }
    },
    [maxImages, validateFile, uploadToR2, onChange]
  );

  const handleRemoveScreenshot = useCallback(
    (id: string) => {
      const screenshotToRemove = screenshots.find((s) => s.id === id);
      if (screenshotToRemove) {
        URL.revokeObjectURL(screenshotToRemove.previewUrl);
        objectUrlsRef.current.delete(screenshotToRemove.previewUrl);
      }

      const next = screenshots.filter((s) => s.id !== id);
      screenshotsRef.current = next;
      setScreenshots(next);
      setError(null);

      // 更新 onChange
      const urls = next
        .filter((s) => s.uploadStatus === 'uploaded' && s.r2Url)
        .map((s) => s.r2Url!);
      onChange(urls);
    },
    [screenshots, onChange]
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

      if (disabled || !canUploadMore) return;

      handleFiles(e.dataTransfer.files);
    },
    [disabled, canUploadMore, handleFiles]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleFiles(e.target.files);
      }
      e.target.value = '';
    },
    [handleFiles]
  );

  const handleClick = useCallback(() => {
    if (disabled || !canUploadMore) return;
    inputRef.current?.click();
  }, [disabled, canUploadMore]);

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || !canUploadMore}
        multiple
      />

      {/* 已上传截图网格 */}
      {screenshots.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {screenshots.map((screenshot) => (
            <div
              key={screenshot.id}
              className="relative aspect-video rounded-xl overflow-hidden bg-muted/30 border-2 border-border/50 group hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-lg"
            >
              {screenshot.previewUrl ? (
                <Image
                  src={screenshot.previewUrl}
                  alt="Screenshot"
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-xl">
                  <ImagePlus className="size-8 text-muted-foreground" />
                </div>
              )}

              {/* 上传状态指示器 */}
              {screenshot.uploadStatus === 'uploading' && (
                <div className="absolute top-2 right-2 flex items-center justify-center size-7 rounded-full bg-background/90 backdrop-blur-sm shadow-md">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </div>
              )}
              {screenshot.uploadStatus === 'failed' && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 size-7 rounded-full shadow-lg transition-all duration-200 hover:scale-110 bg-background/90 backdrop-blur-sm"
                  onClick={() => handleRetryUpload(screenshot.id)}
                  title={t('screenshot.uploading')}
                >
                  <RefreshCw className="size-4" />
                </Button>
              )}

              {/* 删除按钮 */}
              {!disabled && screenshot.uploadStatus !== 'uploading' && (
                <Button
                  variant="secondary"
                  size="icon"
                  className={cn(
                    'absolute size-7 rounded-full shadow-lg transition-all duration-200 hover:scale-110 bg-background/90 backdrop-blur-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100',
                    screenshot.uploadStatus === 'failed'
                      ? 'top-2 left-2'
                      : 'top-2 right-2'
                  )}
                  onClick={() => handleRemoveScreenshot(screenshot.id)}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}

          {/* 添加更多截图的占位符 */}
          {canUploadMore && (
            <button
              type="button"
              onClick={handleClick}
              disabled={disabled}
              className={cn(
                'aspect-video rounded-xl border-2 border-dashed border-muted-foreground/30',
                'flex flex-col items-center justify-center gap-2',
                'text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5',
                'transition-all duration-200 cursor-pointer',
                'hover:scale-[1.02] active:scale-[0.98]',
                isDragOver && 'border-primary bg-primary/10',
                disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
              )}
            >
              <ImagePlus className="size-6" />
              <span className="text-xs font-medium">
                {t('screenshot.addScreenshot')}
              </span>
            </button>
          )}
        </div>
      )}

      {/* 初始上传区域 - 仅在没有截图时显示 */}
      {screenshots.length === 0 && (
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
            'min-h-[160px]',
            isDragOver &&
              'border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20',
            !isDragOver && 'border-muted-foreground/30 hover:border-primary/50',
            disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
          )}
        >
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div
              className={cn(
                'flex items-center justify-center rounded-2xl bg-primary/10 transition-all duration-300 size-14',
                isDragOver && 'scale-110 bg-primary/20'
              )}
            >
              <Upload
                className={cn(
                  'text-primary transition-all duration-300 size-7',
                  isDragOver && 'scale-110'
                )}
              />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground text-sm">
                {t('screenshot.dragOrClick')}
              </p>
              <p className="text-xs text-muted-foreground/80">
                {t('screenshot.description')}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                {t('screenshot.selected', {
                  count: screenshots.length,
                  max: maxImages,
                })}
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
