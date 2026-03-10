/**
 * @file multi-image-uploader.tsx
 * @description 多图上传组件 - 支持拖拽、多图预览、套餐限制、R2 即时上传
 * @author git.username
 * @date 2025-12-25
 */

'use client';

import { Button } from '@/components/ui/button';
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

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
/**
 * 上传并发控制：
 * - 设为 1：严格“一个个上传”（最稳，最可控）
 * - 设为 2/3：更快，但更吃带宽
 */
const UPLOAD_CONCURRENCY = 1;

export interface UploadedImage {
  id: string;
  /** 文件对象（从 sessionStorage 恢复时可能为 null） */
  file: File | null;
  previewUrl: string;
  /** 文件指纹，用于去重（基于文件名+大小+lastModified） */
  fingerprint: string;
  /** R2 上传状态 */
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed';
  /** R2 URL（上传成功后） */
  r2Url?: string;
}

/**
 * 生成文件指纹，用于去重
 */
function generateFileFingerprint(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

interface MultiImageUploaderProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages: number;
  disabled?: boolean;
  className?: string;
  maxSizeMB?: number;
}

export function MultiImageUploader({
  images,
  onImagesChange,
  maxImages,
  disabled = false,
  className,
  maxSizeMB = 16,
}: MultiImageUploaderProps) {
  const t = useTranslations('LandingPage.aiEditor.uploader');
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const canUploadMore = images.length < maxImages;

  // 追踪最新 images，避免闭包问题 & 解决异步上传回写竞态
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // 追踪创建的 objectURL，确保卸载时清理（避免内存泄漏）
  const objectUrlsRef = useRef<Set<string>>(new Set());

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

  /**
   * 上传单张图片到 R2
   */
  const uploadToR2 = useCallback(
    async (image: UploadedImage): Promise<UploadedImage> => {
      // 如果 file 为 null（从 sessionStorage 恢复的图片），跳过上传
      if (!image.file) {
        return image;
      }
      try {
        // 直接走 API 上传（FormData），避免 base64 体积膨胀 & action body 限制
        const result = await uploadFileFromBrowser(image.file, 'upload');
        if (result?.url) {
          return {
            ...image,
            uploadStatus: 'uploaded',
            r2Url: result.url,
          };
        }
        return { ...image, uploadStatus: 'failed' };
      } catch (error) {
        console.error('R2 upload error:', error);
        return { ...image, uploadStatus: 'failed' };
      }
    },
    []
  );

  /**
   * 重新上传失败的图片
   */
  const handleRetryUpload = useCallback(
    async (id: string) => {
      const image = images.find((img) => img.id === id);
      if (!image || image.uploadStatus !== 'failed') return;

      // 设置为 uploading 状态
      const updatedImages = images.map((img) =>
        img.id === id ? { ...img, uploadStatus: 'uploading' as const } : img
      );
      imagesRef.current = updatedImages;
      onImagesChange(updatedImages);

      // 重新上传
      const uploaded = await uploadToR2(image);
      const finalImages = imagesRef.current.map((img) =>
        img.id === uploaded.id ? uploaded : img
      );
      imagesRef.current = finalImages;
      onImagesChange(finalImages);
    },
    [images, onImagesChange, uploadToR2]
  );

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const currentImages = imagesRef.current;
      const availableSlots = maxImages - currentImages.length;

      if (availableSlots <= 0) {
        setError(t('errorMaxImages', { max: maxImages }));
        return;
      }

      const filesToAdd = fileArray.slice(0, availableSlots);
      const newImages: UploadedImage[] = [];
      let duplicateCount = 0;

      // 已有图片的指纹集合
      const existingFingerprints = new Set(
        currentImages.map((img) => img.fingerprint)
      );

      for (const file of filesToAdd) {
        // 1. 检查文件是否已存在（去重）
        const fingerprint = generateFileFingerprint(file);
        if (existingFingerprints.has(fingerprint)) {
          duplicateCount++;
          continue;
        }

        // 2. 验证文件格式和大小
        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        // 添加到去重集合
        existingFingerprints.add(fingerprint);

        const previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.add(previewUrl);

        newImages.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          previewUrl,
          fingerprint,
          uploadStatus: 'uploading', // 直接设置为 uploading 状态
        });
      }

      // 显示重复文件提示
      if (duplicateCount > 0 && newImages.length === 0) {
        setError(t('errorDuplicate'));
        return;
      }

      if (newImages.length > 0) {
        setError(null);
        // 先添加图片显示（uploading 状态）
        const allImages = [...currentImages, ...newImages];
        // 关键：先更新 ref，再 setState，避免后续异步回写时 ref 还是旧值
        imagesRef.current = allImages;
        onImagesChange(allImages);

        // 并发受控上传（默认一个个上传），并且每张上传完成就回写状态
        const limit = Math.max(
          1,
          Math.min(UPLOAD_CONCURRENCY, newImages.length)
        );
        let cursor = 0;

        const worker = async () => {
          while (true) {
            const i = cursor++;
            if (i >= newImages.length) return;

            const img = newImages[i];
            const uploaded = await uploadToR2(img);

            // 如果用户在上传期间删除了该图片，则跳过回写
            const exists = imagesRef.current.some((p) => p.id === uploaded.id);
            if (!exists) continue;

            const updatedImages = imagesRef.current.map((p) =>
              p.id === uploaded.id ? uploaded : p
            );
            imagesRef.current = updatedImages;
            onImagesChange(updatedImages);
          }
        };

        await Promise.all(Array.from({ length: limit }, () => worker()));
      }
    },
    [maxImages, validateFile, onImagesChange, t, uploadToR2]
  );

  const handleRemoveImage = useCallback(
    (id: string) => {
      const imageToRemove = images.find((img) => img.id === id);
      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
        objectUrlsRef.current.delete(imageToRemove.previewUrl);
      }
      const next = images.filter((img) => img.id !== id);
      imagesRef.current = next;
      onImagesChange(next);
      setError(null);
    },
    [images, onImagesChange]
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

  // 组件卸载时清理预览 URL
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
    };
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || !canUploadMore}
        multiple
      />

      {/* 已上传图片网格 */}
      {images.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {images.map((image) => (
            <div
              key={image.id}
              className="relative aspect-square rounded-xl overflow-hidden bg-muted/30 border-2 border-border/50 group hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-lg"
            >
              <Image
                src={image.previewUrl}
                alt="Preview"
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105 rounded-xl"
              />

              {/* 上传状态指示器 */}
              {image.uploadStatus === 'uploading' && (
                <div className="absolute top-2 right-2 flex items-center justify-center size-7 rounded-full bg-background/90 backdrop-blur-sm shadow-md">
                  <Loader2 className="size-4 animate-spin text-primary" />
                </div>
              )}
              {image.uploadStatus === 'failed' && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute top-2 right-2 size-7 rounded-full shadow-lg transition-all duration-200 hover:scale-110 bg-background/90 backdrop-blur-sm"
                  onClick={() => handleRetryUpload(image.id)}
                  title="重新上传"
                >
                  <RefreshCw className="size-4" />
                </Button>
              )}

              {/* 删除按钮 */}
              {!disabled && image.uploadStatus !== 'uploading' && (
                <Button
                  variant="secondary"
                  size="icon"
                  /**
                   * 移动端没有 hover：删除按钮默认展示；桌面端保持 hover / focus-within 才展示，避免视觉噪音。
                   */
                  className={cn(
                    'absolute size-7 rounded-full shadow-lg transition-all duration-200 hover:scale-110 bg-background/90 backdrop-blur-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 focus-visible:opacity-100',
                    image.uploadStatus === 'failed'
                      ? 'top-2 left-2'
                      : 'top-2 right-2'
                  )}
                  onClick={() => handleRemoveImage(image.id)}
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          ))}

          {/* 添加更多图片的占位符 */}
          {canUploadMore && (
            <button
              type="button"
              onClick={handleClick}
              disabled={disabled}
              className={cn(
                'aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30',
                'flex flex-col items-center justify-center gap-2',
                'text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5',
                'transition-all duration-200 cursor-pointer',
                'hover:scale-[1.02] active:scale-[0.98]',
                isDragOver && 'border-primary bg-primary/10',
                disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
              )}
            >
              <ImagePlus className="size-6" />
              <span className="text-xs font-medium">{t('add')}</span>
            </button>
          )}
        </div>
      )}

      {/* 初始上传区域 - 仅在没有图片时显示 */}
      {images.length === 0 && (
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
            'flex-1 min-h-[200px]',
            isDragOver &&
              'border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20',
            !isDragOver && 'border-muted-foreground/30 hover:border-primary/50',
            disabled && 'opacity-50 cursor-not-allowed hover:scale-100'
          )}
        >
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div
              className={cn(
                'flex items-center justify-center rounded-2xl bg-primary/10 transition-all duration-300 size-16',
                isDragOver && 'scale-110 bg-primary/20'
              )}
            >
              <Upload
                className={cn(
                  'text-primary transition-all duration-300 size-8',
                  isDragOver && 'scale-110'
                )}
              />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground text-sm">
                {t('dragDrop')}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                {t('selected', { count: images.length, max: maxImages })}
              </p>
              <p className="text-xs text-muted-foreground/80">
                {t('formats', { size: maxSizeMB })}
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
