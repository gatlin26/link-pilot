/**
 * @file generator-toolbar.tsx
 * @description 统一的 AI 生成器工具栏 - 支持图片和视频生成模式
 * @author git.username
 * @date 2026-01-17
 */

'use client';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  AI_MODELS,
  getModelAspectRatios,
  getModelById,
} from '@/config/ai-models-config';
import { cn } from '@/lib/utils';
import { Eye, MoreHorizontal, Sparkles, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export type GenerationMode = 'image' | 'video';

export type VideoFeature =
  | 'text-to-video'
  | 'reference-to-video'
  | 'frames-to-video';

export interface GeneratorToolbarProps {
  // Mode
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;

  // Video feature (only for video mode)
  videoFeature?: VideoFeature;
  onVideoFeatureChange?: (feature: VideoFeature) => void;

  // Model
  selectedModel: string;
  onModelChange: (modelId: string) => void;

  // Aspect ratio
  selectedRatio: string;
  onRatioChange: (ratio: string) => void;

  // Quality/Resolution (for image mode)
  selectedQuality?: string;
  onQualityChange?: (quality: string) => void;

  // Video-specific options
  selectedDuration?: string;
  onDurationChange?: (duration: string) => void;
  selectedResolution?: string;
  onResolutionChange?: (resolution: string) => void;

  // Public visibility
  isPublic: boolean;
  onPublicChange: (isPublic: boolean) => void;

  // Credits
  credits?: number;

  // State
  isProcessing?: boolean;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const VIDEO_FEATURES: {
  value: VideoFeature;
  labelKey: string;
  icon: React.ReactNode;
}[] = [
  {
    value: 'text-to-video',
    labelKey: 'textToVideo',
    icon: <Video className="w-4 h-4" />,
  },
  {
    value: 'reference-to-video',
    labelKey: 'referenceToVideo',
    icon: <Video className="w-4 h-4" />,
  },
  {
    value: 'frames-to-video',
    labelKey: 'framesToVideo',
    icon: <Video className="w-4 h-4" />,
  },
];

const DURATIONS = ['3s', '5s', '10s', '15s', '30s'];
const RESOLUTIONS = ['480P', '720P', '1080P', '4K'];

// Default qualities for models that don't specify
const DEFAULT_QUALITIES = ['1K', '2K', '4K'];

// ============================================================================
// Aspect Ratio Icon Component
// ============================================================================

interface AspectRatioIconProps {
  ratio: string;
  isSelected?: boolean;
  className?: string;
}

function AspectRatioIcon({
  ratio,
  isSelected,
  className,
}: AspectRatioIconProps) {
  // Calculate dimensions based on ratio
  const getRatioDimensions = (ratioStr: string) => {
    if (ratioStr === 'auto') return { width: 16, height: 16 };
    const [w, h] = ratioStr.split(':').map(Number);
    const maxSize = 20;
    const aspectRatio = w / h;

    if (aspectRatio >= 1) {
      return { width: maxSize, height: Math.round(maxSize / aspectRatio) };
    }
    return { width: Math.round(maxSize * aspectRatio), height: maxSize };
  };

  const { width, height } = getRatioDimensions(ratio);

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div
        className={cn(
          'border-2 rounded-sm transition-colors',
          isSelected
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/40'
        )}
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function GeneratorToolbar({
  mode,
  onModeChange,
  videoFeature = 'text-to-video',
  onVideoFeatureChange,
  selectedModel,
  onModelChange,
  selectedRatio,
  onRatioChange,
  selectedQuality = '1K',
  onQualityChange,
  selectedDuration = '5s',
  onDurationChange,
  selectedResolution = '720P',
  onResolutionChange,
  isPublic,
  onPublicChange,
  credits,
  isProcessing = false,
  className,
}: GeneratorToolbarProps) {
  const t = useTranslations('Generator.toolbar');

  // Popover states - unified for ratio and quality
  const [settingsPopoverOpen, setSettingsPopoverOpen] = useState(false);

  const availableRatios = getModelAspectRatios(selectedModel);
  const currentModel = getModelById(selectedModel);
  // If model doesn't support quality selection, no qualities are available
  const availableQualities = currentModel?.qualities || [];

  // Update ratio when model changes
  useEffect(() => {
    if (!availableRatios.includes(selectedRatio)) {
      onRatioChange(availableRatios[0] || '1:1');
    }
  }, [selectedModel, selectedRatio, availableRatios, onRatioChange]);

  // Update quality when model changes (reset to 1K if not supported)
  useEffect(() => {
    if (onQualityChange && !availableQualities.includes(selectedQuality)) {
      onQualityChange(availableQualities[0] || '1K');
    }
  }, [selectedModel, selectedQuality, availableQualities, onQualityChange]);

  return (
    <div
      className={cn(
        'flex items-center gap-2 overflow-x-auto scrollbar-none py-1',
        className
      )}
    >
      {/* Mode Selector - AI Image / AI Video */}
      <Select
        value={mode}
        onValueChange={(value: GenerationMode) => onModeChange(value)}
      >
        <SelectTrigger
          className={cn(
            'h-9 w-auto min-w-[120px] text-sm rounded-full',
            'bg-primary/10 hover:bg-primary/15 border-primary/20',
            'text-foreground font-medium transition-all shrink-0 px-4',
            '[&>span]:flex [&>span]:items-center [&>span]:gap-2'
          )}
        >
          {mode === 'image' ? (
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
          ) : (
            <Video className="w-4 h-4 text-primary shrink-0" />
          )}
          <span className="truncate">
            {mode === 'image' ? t('aiImage') : t('aiVideo')}
          </span>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          <SelectItem value="image" className="rounded-lg">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span>{t('aiImage')}</span>
            </div>
          </SelectItem>
          <SelectItem value="video" className="rounded-lg" disabled>
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4" />
              <span>{t('aiVideo')}</span>
              <span className="text-xs text-muted-foreground ml-1">
                {t('comingSoon')}
              </span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Video Feature Selector (only in video mode) */}
      {mode === 'video' && onVideoFeatureChange && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-2 h-9 px-4 rounded-full',
                'bg-muted/50 hover:bg-muted border border-border/50',
                'text-sm text-foreground/80 hover:text-foreground transition-all shrink-0'
              )}
            >
              <Video className="w-4 h-4" />
              <span>{t(`features.${videoFeature}`)}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-56 p-2 rounded-xl"
            align="start"
            sideOffset={8}
          >
            <div className="text-xs text-muted-foreground px-2 py-1.5 font-medium">
              {t('features.title')}
            </div>
            {VIDEO_FEATURES.map((feature) => (
              <button
                key={feature.value}
                onClick={() => onVideoFeatureChange(feature.value)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm',
                  'hover:bg-muted transition-colors',
                  videoFeature === feature.value && 'bg-muted'
                )}
              >
                {feature.icon}
                <span>{t(`features.${feature.value}`)}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {/* Model Selector */}
      <Select value={selectedModel} onValueChange={onModelChange}>
        <SelectTrigger
          className={cn(
            'h-9 w-auto min-w-[130px] text-sm rounded-full',
            'bg-muted/50 hover:bg-muted border-border/50',
            'text-foreground/80 hover:text-foreground shrink-0 px-4'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
              ✦
            </div>
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent className="rounded-xl">
          {AI_MODELS.map((model) => (
            <SelectItem key={model.id} value={model.id} className="rounded-lg">
              <div className="flex items-center gap-2">
                <span className="font-medium">{model.name}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Unified Settings Popover - Aspect Ratio & Quality */}
      <Popover open={settingsPopoverOpen} onOpenChange={setSettingsPopoverOpen}>
        {/* Trigger buttons - clicking either opens the same popover */}
        <div className="flex items-center gap-2">
          {/* Aspect Ratio Button */}
          <PopoverTrigger asChild>
            <button
              className={cn(
                'flex items-center gap-2 h-9 px-4 rounded-full',
                'bg-muted/50 hover:bg-muted border border-border/50',
                'text-sm text-foreground/80 hover:text-foreground transition-all shrink-0'
              )}
            >
              <AspectRatioIcon ratio={selectedRatio} isSelected />
              <span>{selectedRatio}</span>
            </button>
          </PopoverTrigger>

          {/* Quality Button (Image mode only) */}
          {mode === 'image' && onQualityChange && (
            <PopoverTrigger asChild>
              <button
                className={cn(
                  'flex items-center gap-1.5 h-9 px-4 rounded-full',
                  'bg-muted/50 hover:bg-muted border border-border/50',
                  'text-sm text-foreground/80 hover:text-foreground transition-all shrink-0'
                )}
              >
                <span>{selectedQuality}</span>
              </button>
            </PopoverTrigger>
          )}
        </div>

        {/* Unified Popover Content */}
        <PopoverContent
          className="w-auto p-4 rounded-xl"
          align="start"
          sideOffset={8}
        >
          <div className="space-y-5">
            {/* Aspect Ratio Section */}
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground font-medium">
                {t('aspectRatio')}
              </div>
              <div className="flex flex-wrap gap-2 max-w-[280px]">
                {availableRatios.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => onRatioChange(ratio)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-2 rounded-lg min-w-[52px]',
                      'border transition-all',
                      selectedRatio === ratio
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-primary/50 hover:bg-muted'
                    )}
                  >
                    <AspectRatioIcon
                      ratio={ratio}
                      isSelected={selectedRatio === ratio}
                    />
                    <span className="text-xs font-medium">{ratio}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quality/Resolution Section (Image mode only) */}
            {mode === 'image' && onQualityChange && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                <div className="text-xs text-muted-foreground font-medium">
                  {t('resolution')}
                </div>
                <div className="flex gap-2">
                  {DEFAULT_QUALITIES.map((quality) => {
                    const isAvailable = availableQualities.includes(quality);
                    return (
                      <button
                        key={quality}
                        onClick={() => {
                          if (isAvailable && onQualityChange) {
                            onQualityChange(quality);
                          }
                        }}
                        disabled={!isAvailable}
                        className={cn(
                          'flex items-center justify-center px-4 py-2 rounded-lg min-w-[60px]',
                          'border transition-all text-sm font-medium',
                          selectedQuality === quality && isAvailable
                            ? 'border-primary bg-primary/10 text-primary'
                            : isAvailable
                              ? 'border-border/50 hover:border-primary/50 hover:bg-muted'
                              : 'border-border/30 text-muted-foreground/50 cursor-not-allowed'
                        )}
                      >
                        {quality}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Duration (Video mode only) */}
      {mode === 'video' && onDurationChange && (
        <Select value={selectedDuration} onValueChange={onDurationChange}>
          <SelectTrigger
            className={cn(
              'h-9 w-auto min-w-[60px] text-sm rounded-full',
              'bg-muted/50 hover:bg-muted border-border/50',
              'text-foreground/80 hover:text-foreground shrink-0 px-4'
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {DURATIONS.map((duration) => (
              <SelectItem
                key={duration}
                value={duration}
                className="rounded-lg"
              >
                {duration}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Resolution (Video mode only) */}
      {mode === 'video' && onResolutionChange && (
        <Select value={selectedResolution} onValueChange={onResolutionChange}>
          <SelectTrigger
            className={cn(
              'h-9 w-auto min-w-[70px] text-sm rounded-full',
              'bg-muted/50 hover:bg-muted border-border/50',
              'text-foreground/80 hover:text-foreground shrink-0 px-4'
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {RESOLUTIONS.map((resolution) => (
              <SelectItem
                key={resolution}
                value={resolution}
                className="rounded-lg"
              >
                {resolution}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* More Options */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-full',
              'bg-muted/50 hover:bg-muted border border-border/50',
              'text-foreground/80 hover:text-foreground transition-all shrink-0'
            )}
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-64 p-3 rounded-xl"
          align="end"
          sideOffset={8}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('public')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('publicDescription')}
                  </p>
                </div>
              </div>
              <Switch checked={isPublic} onCheckedChange={onPublicChange} />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Credits Display - Shows cost for generation */}
      {credits !== undefined && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground whitespace-nowrap px-3 shrink-0">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-medium text-foreground">{credits}</span>
          <span>{t('creditsCost')}</span>
        </div>
      )}
    </div>
  );
}
