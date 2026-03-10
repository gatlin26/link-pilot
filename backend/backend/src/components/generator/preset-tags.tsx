/**
 * @file preset-tags.tsx
 * @description 预设标签组件 - 快速选择生成预设
 * @author git.username
 * @date 2026-01-17
 */

'use client';

import { cn } from '@/lib/utils';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';

// ============================================================================
// Types
// ============================================================================

export interface Preset {
  id: string;
  label: string;
  icon?: string;
  prompt?: string;
  model?: string;
  ratio?: string;
}

export interface PresetTagsProps {
  presets: Preset[];
  onSelect: (preset: Preset) => void;
  onRefresh?: () => void;
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function PresetTags({
  presets,
  onSelect,
  onRefresh,
  className,
}: PresetTagsProps) {
  const t = useTranslations('Generator.presets');

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Refresh Button */}
      {onRefresh && (
        <button
          onClick={onRefresh}
          className={cn(
            'flex items-center justify-center w-9 h-9 rounded-full',
            'bg-muted/50 hover:bg-muted border border-border/50',
            'text-muted-foreground hover:text-foreground transition-all shrink-0'
          )}
          title={t('refresh')}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}

      {/* Preset Tags */}
      {presets.map((preset) => (
        <button
          key={preset.id}
          onClick={() => onSelect(preset)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full',
            'bg-muted/50 hover:bg-muted border border-border/50',
            'hover:border-primary/30 transition-all',
            'text-sm text-foreground/80 hover:text-foreground'
          )}
        >
          {preset.icon && <span>{preset.icon}</span>}
          <span>{preset.label}</span>
        </button>
      ))}
    </div>
  );
}
