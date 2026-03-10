/**
 * @file ai-editor-section.tsx
 * @description AI Image Editor - Clean, Modern Hero with Editor Console
 * @author git.username
 * @date 2026-01-17
 */

'use client';

import { LoginForm } from '@/components/auth/login-form';
import { GeneratorToolbar } from '@/components/generator/generator-toolbar';
import { type Preset, PresetTags } from '@/components/generator/preset-tags';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DEFAULT_MODEL,
  calculateCreditsForGeneration,
  getModelAspectRatios,
  getModelById,
} from '@/config/ai-models-config';
import { useCreditBalance } from '@/hooks/use-credits';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useImageTask } from '@/hooks/use-image-task';
import { LocaleLink } from '@/i18n/navigation';
import { useEditorPresetStore } from '@/stores/editor-preset-store';
import {
  AlertCircle,
  Download,
  Loader2,
  Sparkles,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { EditorInputBar } from './ui/editor-input-bar';
import { ImagePreviewDialog } from './ui/image-preview-dialog';
import type { UploadedImage } from './ui/multi-image-uploader';

// ============================================================================
// Helper Functions
// ============================================================================

function getUploadedImageUrls(images: UploadedImage[]): string[] {
  return images
    .filter((img) => img.uploadStatus === 'uploaded' && img.r2Url)
    .map((img) => img.r2Url as string);
}

function areAllImagesUploaded(images: UploadedImage[]): boolean {
  return images.every((img) => img.uploadStatus === 'uploaded');
}

function hasUploadingImages(images: UploadedImage[]): boolean {
  return images.some((img) => img.uploadStatus === 'uploading');
}

function hasFailedImages(images: UploadedImage[]): boolean {
  return images.some((img) => img.uploadStatus === 'failed');
}

function getExtensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      return ext;
    }
  } catch {
    // ignore
  }
  return 'png';
}

// ============================================================================
// Constants
// ============================================================================

const EDITOR_STATE_KEY = 'ai-editor-pending-state';

interface SerializableEditorState {
  prompt: string;
  selectedModel: string;
  selectedRatio: string;
  selectedQuality?: string;
  isPublic: boolean;
  uploadedImageUrls: string[];
}

// ============================================================================
// Main Component
// ============================================================================

export function AiEditorSection() {
  const t = useTranslations('LandingPage.aiEditor');

  // User and credits
  const currentUser = useCurrentUser();
  const { data: credits } = useCreditBalance();

  // Editor state
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL.id);
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [selectedQuality, setSelectedQuality] = useState('1K');
  const [isPublic, setIsPublic] = useState(true);

  // UI state
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Image task hook
  const imageTask = useImageTask();

  // Gallery preset
  const { preset, clearPreset } = useEditorPresetStore();

  // ============================================================================
  // State Persistence
  // ============================================================================

  const saveEditorState = useCallback(() => {
    const state: SerializableEditorState = {
      prompt,
      selectedModel,
      selectedRatio,
      selectedQuality,
      isPublic,
      uploadedImageUrls: uploadedImages
        .filter((img) => img.uploadStatus === 'uploaded' && img.r2Url)
        .map((img) => img.r2Url as string),
    };
    sessionStorage.setItem(EDITOR_STATE_KEY, JSON.stringify(state));
  }, [
    prompt,
    selectedModel,
    selectedRatio,
    selectedQuality,
    isPublic,
    uploadedImages,
  ]);

  const restoreEditorState = useCallback(() => {
    const savedState = sessionStorage.getItem(EDITOR_STATE_KEY);
    if (!savedState) return;

    try {
      const state: SerializableEditorState = JSON.parse(savedState);
      setPrompt(state.prompt);
      setSelectedModel(state.selectedModel);
      setSelectedRatio(state.selectedRatio);
      if (state.selectedQuality) {
        setSelectedQuality(state.selectedQuality);
      }
      setIsPublic(state.isPublic);

      if (state.uploadedImageUrls.length > 0) {
        const restoredImages: UploadedImage[] = state.uploadedImageUrls.map(
          (r2Url) => ({
            id: crypto.randomUUID(),
            file: null,
            previewUrl: r2Url,
            fingerprint: r2Url,
            uploadStatus: 'uploaded' as const,
            r2Url,
          })
        );
        setUploadedImages(restoredImages);
      }

      sessionStorage.removeItem(EDITOR_STATE_KEY);
    } catch {
      sessionStorage.removeItem(EDITOR_STATE_KEY);
    }
  }, []);

  // Restore state on mount
  useEffect(() => {
    restoreEditorState();
  }, [restoreEditorState]);

  // Close login dialog when user logs in
  useEffect(() => {
    if (currentUser && showLoginDialog) {
      setShowLoginDialog(false);
    }
  }, [currentUser, showLoginDialog]);

  // Apply preset from gallery
  useEffect(() => {
    if (!preset) return;

    setPrompt(preset.prompt);
    setSelectedModel(preset.model);
    setUploadedImages([
      {
        id: crypto.randomUUID(),
        file: null,
        previewUrl: preset.imageUrl,
        fingerprint: preset.imageUrl,
        uploadStatus: 'uploaded',
        r2Url: preset.imageUrl,
      },
    ]);

    clearPreset();
  }, [preset, clearPreset]);

  // Update ratio when model changes
  useEffect(() => {
    const availableRatios = getModelAspectRatios(selectedModel);
    if (!availableRatios.includes(selectedRatio)) {
      setSelectedRatio(availableRatios[0] || '1:1');
    }
  }, [selectedModel, selectedRatio]);

  // Update quality when model changes
  useEffect(() => {
    const currentModel = getModelById(selectedModel);
    const availableQualities = currentModel?.qualities || [];
    if (
      availableQualities.length > 0 &&
      !availableQualities.includes(selectedQuality)
    ) {
      setSelectedQuality(availableQualities[0] || '1K');
    } else if (availableQualities.length === 0) {
      // 如果模型不支持质量选择，重置为默认值
      setSelectedQuality('1K');
    }
  }, [selectedModel, selectedQuality]);

  // Calculate credits cost based on model and quality
  const creditsCost = calculateCreditsForGeneration(
    selectedModel,
    selectedQuality
  );

  // ============================================================================
  // Computed Values
  // ============================================================================

  const maxImages = 8;
  const isUploading = hasUploadingImages(uploadedImages);
  const hasFailedUploads = hasFailedImages(uploadedImages);
  const allImagesReady = areAllImagesUploaded(uploadedImages);
  const isProcessing = isUploading || imageTask.isProcessing;
  const errorMessage = uploadError || imageTask.error;
  const showError = uploadError || imageTask.status === 'failed';
  const isTextToImageMode = uploadedImages.length === 0;

  const canGenerate =
    !isProcessing &&
    (isTextToImageMode
      ? prompt.trim().length > 0
      : allImagesReady && uploadedImages.length > 0);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleClear = useCallback(() => {
    for (const img of uploadedImages) {
      URL.revokeObjectURL(img.previewUrl);
    }
    setUploadedImages([]);
    setPrompt('');
    setUploadError(null);
    imageTask.reset();
  }, [uploadedImages, imageTask.reset]);

  const handleGenerate = useCallback(async () => {
    if (!currentUser) {
      saveEditorState();
      setShowLoginDialog(true);
      return;
    }

    setUploadError(null);

    if (uploadedImages.length === 0 && !prompt.trim()) {
      setUploadError(t('status.promptRequired'));
      return;
    }

    if (uploadedImages.length > 0) {
      if (isUploading) {
        setUploadError(t('status.uploading'));
        return;
      }
      if (hasFailedUploads) {
        setUploadError(t('status.uploadFailed'));
        return;
      }
      if (!allImagesReady) {
        setUploadError(t('status.waitUpload'));
        return;
      }
    }

    try {
      const imageUrls = getUploadedImageUrls(uploadedImages);
      const finalPrompt =
        prompt.trim() ||
        (imageUrls.length > 0 ? t('status.defaultPrompt') : '');

      await imageTask.submit({
        prompt: finalPrompt,
        model: selectedModel,
        size: selectedRatio,
        quality: selectedQuality,
        imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
        isPublic,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('status.generateFailed');
      setUploadError(message);
      console.error('Generation failed:', error);
    }
  }, [
    currentUser,
    saveEditorState,
    uploadedImages,
    prompt,
    selectedModel,
    selectedRatio,
    isPublic,
    imageTask.submit,
    isUploading,
    hasFailedUploads,
    allImagesReady,
    t,
  ]);

  const handleDownload = useCallback(async () => {
    if (!imageTask.outputUrl) return;

    try {
      const response = await fetch(imageTask.outputUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const ext = getExtensionFromUrl(imageTask.outputUrl);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [imageTask.outputUrl]);

  const handleRetry = useCallback(() => {
    setUploadError(null);
    imageTask.reset();
  }, [imageTask.reset]);

  const handleQuickPrompt = (text: string) => {
    setPrompt(text);
  };

  const handlePresetSelect = (preset: Preset) => {
    if (preset.prompt) {
      setPrompt(preset.prompt);
    }
    if (preset.model) {
      setSelectedModel(preset.model);
    }
    if (preset.ratio) {
      setSelectedRatio(preset.ratio);
    }
  };

  const presetTags: Preset[] = [
    {
      id: 'portrait',
      label: t('quickPrompts.portrait'),
      icon: '🎨',
      prompt: 'Professional portrait photo, studio lighting, sharp focus',
    },
    {
      id: 'landscape',
      label: t('quickPrompts.landscape'),
      icon: '🏔️',
      prompt: 'Epic landscape, golden hour, cinematic composition',
    },
    {
      id: 'abstract',
      label: t('quickPrompts.abstract'),
      icon: '✨',
      prompt: 'Abstract digital art, vibrant colors, flowing shapes',
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <section
      id="ai-editor"
      className="relative min-h-screen flex flex-col items-center justify-center py-16 lg:py-24 overflow-hidden"
    >
      {/* Background - Clean Gradient with Geometric Accents */}
      <div className="absolute inset-0 bg-background">
        {/* Primary gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />

        {/* Geometric decorations */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-primary/10 to-transparent rounded-full blur-3xl opacity-60" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-accent/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-primary/5 to-transparent rounded-full blur-2xl" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-10 lg:mb-14 w-full max-w-4xl"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 bg-primary/10 border border-primary/20 rounded-full"
          >
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm text-primary font-medium">
              {t('badge')}
            </span>
          </motion.div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="text-foreground">{t('titlePart1')}</span>
            <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
              {t('titleHighlight')}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Editor Console */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-4xl"
        >
          {/* Console Container */}
          <div className="relative bg-card/80 backdrop-blur-xl border border-border rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl hover:border-primary/20">
            {/* Top Input Area */}
            <div className="p-4 sm:p-5">
              <EditorInputBar
                images={uploadedImages}
                onImagesChange={setUploadedImages}
                prompt={prompt}
                onPromptChange={setPrompt}
                onSubmit={handleGenerate}
                isProcessing={isProcessing}
                canSubmit={canGenerate}
                maxImages={maxImages}
                className="bg-transparent border-none shadow-none text-foreground placeholder:text-muted-foreground/60 focus-within:shadow-none focus-within:border-none p-0"
              />
            </div>

            {/* Bottom Options Bar - Using GeneratorToolbar */}
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-border/50 bg-muted/30">
              <GeneratorToolbar
                mode="image"
                onModeChange={() => {}}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
                selectedRatio={selectedRatio}
                onRatioChange={setSelectedRatio}
                selectedQuality={selectedQuality}
                onQualityChange={setSelectedQuality}
                isPublic={isPublic}
                onPublicChange={setIsPublic}
                credits={creditsCost}
                isProcessing={isProcessing}
              />
            </div>
          </div>

          {/* Quick Prompts - Using PresetTags */}
          <PresetTags
            presets={presetTags}
            onSelect={handlePresetSelect}
            onRefresh={() => handleQuickPrompt('')}
            className="mt-5 justify-center"
          />

          {/* Credits exhausted warning */}
          {currentUser && credits !== undefined && credits < creditsCost && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4"
            >
              <Alert
                variant="destructive"
                className="bg-destructive/10 border-destructive/20 rounded-xl"
              >
                <AlertCircle className="size-4" />
                <AlertDescription className="flex items-center justify-between gap-2">
                  <span>{t('creditsExhausted')}</span>
                  <LocaleLink
                    href="/pricing"
                    className="underline font-medium hover:no-underline"
                  >
                    {t('upgradeToContinue')}
                  </LocaleLink>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </motion.div>

        {/* Result Area - Shows loading state or completed result */}
        <AnimatePresence>
          {(isProcessing || imageTask.status === 'completed' || showError) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-12 w-full max-w-4xl"
            >
              <div className="bg-card/90 backdrop-blur-xl border border-border rounded-2xl p-6 lg:p-8 shadow-xl relative overflow-hidden">
                {isProcessing ? (
                  // Loading state in result area
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                    <p className="font-medium text-foreground animate-pulse">
                      {t('status.processing')}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-xl font-semibold text-card-foreground flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        {showError
                          ? t('status.generateFailed')
                          : t('result.generated')}
                      </h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => imageTask.reset()}
                        className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {showError ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <p className="mb-4 text-destructive">
                          {errorMessage || t('status.generateFailed')}
                        </p>
                        <Button
                          onClick={handleRetry}
                          variant="outline"
                          className="border-border hover:bg-muted"
                        >
                          {t('status.retry')}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-6">
                        {/* Image only - no prompt text */}
                        <div className="relative aspect-square w-full max-w-2xl rounded-xl overflow-hidden border border-border shadow-lg bg-muted/30">
                          {imageTask.outputUrl && (
                            <Image
                              src={imageTask.outputUrl}
                              alt="Result"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-3 justify-center">
                          <Button
                            onClick={handleDownload}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-11 text-base font-medium shadow-lg"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            {t('result.download')}
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() => setPreviewImage(imageTask.outputUrl)}
                            className="border-border hover:bg-muted rounded-full h-11 px-6"
                          >
                            <ZoomIn className="w-4 h-4 mr-2" />
                            {t('preview.title')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => !open && setPreviewImage(null)}
        imageUrl={previewImage || ''}
        alt={t('preview.title')}
        onDownload={
          previewImage === imageTask.outputUrl ? handleDownload : undefined
        }
      />

      {/* Login Dialog */}
      <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
        <DialogContent className="sm:max-w-[400px] p-0 rounded-2xl overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>{t('loginRequired')}</DialogTitle>
          </DialogHeader>
          <LoginForm disableRedirect className="border-none shadow-none" />
        </DialogContent>
      </Dialog>
    </section>
  );
}
