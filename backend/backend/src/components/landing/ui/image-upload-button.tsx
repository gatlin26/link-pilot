/**
 * @file image-upload-button.tsx
 * @description Image upload button with stacked preview, hover expand, and gallery view
 * @author git.username
 * @date 2026-01-12
 */

'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { uploadFileFromBrowser } from '@/storage/client';
import { Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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
import { ImagePreviewDialog } from './image-preview-dialog';
import type { UploadedImage } from './multi-image-uploader';
import { StackedImagePreview } from './stacked-image-preview';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const UPLOAD_CONCURRENCY = 1;

interface ImageUploadButtonProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages: number;
  disabled?: boolean;
  maxSizeMB?: number;
  className?: string;
}

function generateFileFingerprint(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

export function ImageUploadButton({
  images,
  onImagesChange,
  maxImages,
  disabled = false,
  maxSizeMB = 16,
  className,
}: ImageUploadButtonProps) {
  const t = useTranslations('LandingPage.aiEditor.imageUpload');
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imagesRef = useRef(images);
  const objectUrlsRef = useRef<Set<string>>(new Set());

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const canUploadMore = images.length < maxImages;

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
    };
  }, []);

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

  const uploadToR2 = useCallback(
    async (image: UploadedImage): Promise<UploadedImage> => {
      if (!image.file) {
        return image;
      }
      try {
        const result = await uploadFileFromBrowser(image.file, 'upload');
        if (result?.url) {
          return { ...image, uploadStatus: 'uploaded', r2Url: result.url };
        }
        return { ...image, uploadStatus: 'failed' };
      } catch (error) {
        console.error('R2 upload error:', error);
        return { ...image, uploadStatus: 'failed' };
      }
    },
    []
  );

  const handleRetryUpload = useCallback(
    async (id: string) => {
      const image = images.find((img) => img.id === id);
      if (!image || image.uploadStatus !== 'failed') return;

      const updatedImages = images.map((img) =>
        img.id === id ? { ...img, uploadStatus: 'uploading' as const } : img
      );
      imagesRef.current = updatedImages;
      onImagesChange(updatedImages);

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
      const existingFingerprints = new Set(
        currentImages.map((img) => img.fingerprint)
      );

      for (const file of filesToAdd) {
        const fingerprint = generateFileFingerprint(file);
        if (existingFingerprints.has(fingerprint)) continue;

        const validationError = validateFile(file);
        if (validationError) {
          setError(validationError);
          continue;
        }

        existingFingerprints.add(fingerprint);
        const previewUrl = URL.createObjectURL(file);
        objectUrlsRef.current.add(previewUrl);

        newImages.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          previewUrl,
          fingerprint,
          uploadStatus: 'uploading',
        });
      }

      if (newImages.length > 0) {
        setError(null);
        const allImages = [...currentImages, ...newImages];
        imagesRef.current = allImages;
        onImagesChange(allImages);

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

      // Close sheet if no images left
      if (next.length === 0) {
        setIsSheetOpen(false);
      }
    },
    [images, onImagesChange]
  );

  const handleImageClick = useCallback(
    (index: number) => {
      if (disabled) return;
      setPreviewIndex(index);
      setPreviewOpen(true);
    },
    [disabled]
  );

  const handleAddClick = useCallback(() => {
    if (disabled || !canUploadMore) return;
    inputRef.current?.click();
  }, [disabled, canUploadMore]);

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

  const openFilePicker = useCallback(() => {
    if (!disabled && canUploadMore) {
      inputRef.current?.click();
    }
  }, [disabled, canUploadMore]);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled || !canUploadMore}
        multiple
      />

      <div
        ref={containerRef}
        className={cn('relative flex items-center gap-1', className)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Image preview with integrated upload button */}
        <StackedImagePreview
          images={images}
          onImageClick={handleImageClick}
          onImageRemove={handleRemoveImage}
          onAddClick={handleAddClick}
          canUploadMore={canUploadMore}
          disabled={disabled}
          size="md"
        />

        {/* Error tooltip */}
        <AnimatePresence>
          {error && (
            <motion.div
              className="absolute left-0 top-full mt-2 z-50 px-3 py-2 bg-destructive text-destructive-foreground text-xs rounded-lg shadow-lg whitespace-nowrap"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sheet for image management */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="h-[50vh] rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle>{t('manageImages')}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 overflow-y-auto">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="relative aspect-square rounded-xl overflow-hidden bg-muted/30 border border-border/50 group"
              >
                <Image
                  src={image.previewUrl}
                  alt={`Image ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="100px"
                  unoptimized
                />

                {image.uploadStatus === 'uploading' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="size-5 text-white animate-spin" />
                  </div>
                )}

                {image.uploadStatus === 'failed' && (
                  <button
                    type="button"
                    className="absolute top-1.5 right-1.5 size-6 rounded-full bg-background/90 flex items-center justify-center shadow-sm"
                    onClick={() => handleRetryUpload(image.id)}
                  >
                    <RefreshCw className="size-3" />
                  </button>
                )}

                {!disabled && image.uploadStatus !== 'uploading' && (
                  <button
                    type="button"
                    className={cn(
                      'absolute size-6 rounded-full bg-background/90 flex items-center justify-center shadow-sm',
                      'opacity-0 group-hover:opacity-100 transition-opacity',
                      image.uploadStatus === 'failed'
                        ? 'top-1.5 left-1.5'
                        : 'top-1.5 right-1.5'
                    )}
                    onClick={() => handleRemoveImage(image.id)}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}

            {canUploadMore && (
              <button
                type="button"
                onClick={openFilePicker}
                disabled={disabled}
                className={cn(
                  'aspect-square rounded-xl border-2 border-dashed border-muted-foreground/30',
                  'flex flex-col items-center justify-center gap-1',
                  'text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5',
                  'transition-all duration-200',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <Plus className="size-5" />
                <span className="text-[10px] font-medium">{t('add')}</span>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Gallery preview dialog */}
      <ImagePreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        images={images.map((img) => img.previewUrl)}
        initialIndex={previewIndex}
      />
    </>
  );
}
