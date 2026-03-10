/**
 * @file editor-options-bar.tsx
 * @description 编辑器底部选项栏 - 模型选择、比例选择、公开开关、操作按钮
 * @author git.username
 * @date 2025-12-25
 */

'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AI_MODELS, getModelAspectRatios } from '@/config/ai-models-config';
import { cn } from '@/lib/utils';
import { ArrowRight, HelpCircle, Loader2, Trash2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

interface EditorOptionsBarProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
  selectedRatio: string;
  onRatioChange: (ratio: string) => void;
  isPublic: boolean;
  onPublicChange: (isPublic: boolean) => void;
  onClear: () => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  canGenerate?: boolean;
  credits?: number;
  className?: string;
}

export function EditorOptionsBar({
  selectedModel,
  onModelChange,
  selectedRatio,
  onRatioChange,
  isPublic,
  onPublicChange,
  onClear,
  onGenerate,
  isGenerating = false,
  canGenerate = true,
  credits = 1,
  className,
}: EditorOptionsBarProps) {
  const t = useTranslations('LandingPage.aiEditor.optionsBar');

  const availableRatios = getModelAspectRatios(selectedModel);

  // 当模型变化时，检查当前比例是否支持
  useEffect(() => {
    if (!availableRatios.includes(selectedRatio)) {
      onRatioChange(availableRatios[0] || '1:1');
    }
  }, [selectedModel, selectedRatio, availableRatios, onRatioChange]);

  return (
    <div
      className={cn(
        'flex flex-col lg:flex-row lg:items-center gap-4 p-5 lg:p-6',
        'bg-card/80 backdrop-blur-xl border border-border/50 rounded-3xl shadow-xl shadow-primary/5',
        className
      )}
    >
      {/* 左侧选项 */}
      <div className="flex flex-wrap items-center gap-3 lg:gap-4 flex-1">
        {/* 模型选择 */}
        <div>
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger className="w-full sm:w-[200px] h-10 text-sm border-border/60 hover:border-primary/40 transition-colors rounded-xl bg-background/50">
              <SelectValue placeholder={t('model')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {AI_MODELS.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  className="rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <Zap className="size-3.5 text-amber-500" />
                    <span className="font-medium">{model.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 比例选择 */}
        <div>
          <Select value={selectedRatio} onValueChange={onRatioChange}>
            <SelectTrigger className="w-[130px] h-10 text-sm border-border/60 hover:border-primary/40 transition-colors rounded-xl bg-background/50">
              <SelectValue placeholder={t('ratio')} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              {availableRatios.map((ratio) => (
                <SelectItem
                  key={ratio}
                  value={ratio}
                  className="rounded-lg font-medium"
                >
                  {ratio}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 公开可见开关 */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
          <span className="text-sm font-medium text-foreground">
            {t('public')}
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="size-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
              </TooltipTrigger>
              <TooltipContent className="rounded-xl">
                <p className="max-w-xs text-xs">{t('publicTooltip')}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Switch checked={isPublic} onCheckedChange={onPublicChange} />
        </div>
      </div>

      {/* 右侧按钮 */}
      <div className="flex items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border/40 lg:pl-6">
        <Button
          variant="outline"
          size="default"
          onClick={onClear}
          disabled={isGenerating}
          className="h-10 rounded-xl border-border/60 hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive transition-all"
        >
          <Trash2 className="size-4 mr-2" />
          {t('clear')}
        </Button>

        <Button
          size="default"
          onClick={onGenerate}
          disabled={isGenerating || !canGenerate}
          className={cn(
            'h-10 min-w-[140px] rounded-xl font-semibold shadow-lg transition-all',
            'bg-gradient-to-r from-primary to-primary/90',
            'hover:shadow-xl hover:shadow-primary/25 hover:scale-[1.02]',
            'active:scale-[0.98]',
            (isGenerating || !canGenerate) && 'opacity-50'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              {t('generating')}
            </>
          ) : (
            <>
              {t('generate', { credits })}
              <ArrowRight className="size-4 ml-2 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
