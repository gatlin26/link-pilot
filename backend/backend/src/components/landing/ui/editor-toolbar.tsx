/**
 * @file editor-toolbar.tsx
 * @description Compact editor toolbar - model selector, ratio selector, more options, credits display
 * @author git.username
 * @date 2026-01-12
 */

'use client';

import { Button } from '@/components/ui/button';
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
import { AI_MODELS, getModelAspectRatios } from '@/config/ai-models-config';
import { cn } from '@/lib/utils';
import { Coins, Eye, MoreHorizontal, Trash2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

interface EditorToolbarProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  selectedRatio: string;
  onRatioChange: (ratio: string) => void;
  isPublic: boolean;
  onPublicChange: (isPublic: boolean) => void;
  onClear: () => void;
  credits: number;
  isProcessing?: boolean;
  className?: string;
}

export function EditorToolbar({
  selectedModel,
  onModelChange,
  selectedRatio,
  onRatioChange,
  isPublic,
  onPublicChange,
  onClear,
  credits,
  isProcessing = false,
  className,
}: EditorToolbarProps) {
  const t = useTranslations('LandingPage.aiEditor.toolbar');

  const availableRatios = getModelAspectRatios(selectedModel);

  // When model changes, check if current ratio is supported
  useEffect(() => {
    if (!availableRatios.includes(selectedRatio)) {
      onRatioChange(availableRatios[0] || '1:1');
    }
  }, [selectedModel, selectedRatio, availableRatios, onRatioChange]);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-1 py-2',
        className
      )}
    >
      {/* Left side: Options */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Model selector */}
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger
            className={cn(
              'h-8 w-auto min-w-[130px] text-xs rounded-lg',
              'border-border/50 bg-background/50',
              'hover:border-primary/40 transition-colors',
              // Allow overriding for dark hero
              'data-[variant=ghost]:bg-transparent data-[variant=ghost]:border-transparent data-[variant=ghost]:text-muted-foreground data-[variant=ghost]:hover:text-foreground',
              className?.includes('ghost') &&
                'bg-transparent border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            <div className="flex items-center gap-1.5">
              <Zap className="size-3 text-amber-500" />
              <SelectValue placeholder={t('model')} />
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {AI_MODELS.map((model) => (
              <SelectItem
                key={model.id}
                value={model.id}
                className="rounded-lg text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{model.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ratio selector */}
        <Select value={selectedRatio} onValueChange={onRatioChange}>
          <SelectTrigger
            className={cn(
              'h-8 w-[80px] text-xs rounded-lg',
              'border-border/50 bg-background/50',
              'hover:border-primary/40 transition-colors',
              className?.includes('ghost') &&
                'bg-transparent border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            <SelectValue placeholder={t('ratio')} />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {availableRatios.map((ratio) => (
              <SelectItem
                key={ratio}
                value={ratio}
                className="rounded-lg text-sm font-medium"
              >
                {ratio}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* More options */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 rounded-lg"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 p-3 rounded-xl"
            align="start"
            sideOffset={8}
          >
            <div className="space-y-4">
              {/* Public visibility toggle */}
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
      </div>

      {/* Right side: Credits and Clear */}
      <div className="flex items-center gap-2">
        {/* Credits display */}
        <span className="text-xs text-muted-foreground flex items-center gap-1.5 px-2">
          <Coins className="size-3.5 text-amber-500" />
          <span>{t('credits', { count: credits })}</span>
        </span>

        {/* Clear button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={isProcessing}
          className={cn(
            'h-8 px-3 text-xs rounded-lg',
            'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          )}
        >
          <Trash2 className="size-3.5 mr-1.5" />
          {t('clear')}
        </Button>
      </div>
    </div>
  );
}
