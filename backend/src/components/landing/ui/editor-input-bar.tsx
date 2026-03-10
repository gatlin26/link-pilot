/**
 * @file editor-input-bar.tsx
 * @description Single-line editor input bar - image button + prompt textarea + send button
 * @author git.username
 * @date 2026-01-12
 */

'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowUp, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';
import { ImageUploadButton } from './image-upload-button';
import type { UploadedImage } from './multi-image-uploader';

interface EditorInputBarProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: () => void;
  isProcessing: boolean;
  canSubmit: boolean;
  maxImages: number;
  className?: string;
  hideSubmitButton?: boolean;
}

export function EditorInputBar({
  images,
  onImagesChange,
  prompt,
  onPromptChange,
  onSubmit,
  isProcessing,
  canSubmit,
  maxImages,
  className,
  hideSubmitButton = false,
}: EditorInputBarProps) {
  const t = useTranslations('LandingPage.aiEditor.inputBar');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 300)}px`;
    }
  }, [prompt]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canSubmit && !isProcessing) {
          onSubmit();
        }
      }
    },
    [canSubmit, isProcessing, onSubmit]
  );

  return (
    <div
      className={cn(
        'relative flex items-start gap-2',
        'p-2 sm:p-3',
        // Default style - can be overridden by className for the new hero
        'bg-muted/60 dark:bg-zinc-900/80',
        'border border-border/40 dark:border-zinc-700/50',
        'rounded-2xl sm:rounded-3xl',
        'shadow-lg shadow-black/5 dark:shadow-black/20',
        'backdrop-blur-sm',
        'transition-all duration-200',
        'focus-within:border-primary/50 focus-within:shadow-primary/10',
        className
      )}
    >
      {/* Left: Image upload button */}
      <ImageUploadButton
        images={images}
        onImagesChange={onImagesChange}
        maxImages={maxImages}
        disabled={isProcessing}
        className="shrink-0"
      />

      {/* Center: Prompt textarea */}
      <div className="flex-1 min-w-0 flex items-center">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          disabled={isProcessing}
          rows={5}
          className={cn(
            'w-full min-h-[44px] max-h-[300px]',
            'bg-transparent',
            'text-sm sm:text-base leading-relaxed',
            'placeholder:text-muted-foreground/60',
            'resize-none',
            'focus:outline-none',
            'scrollbar-thin scrollbar-thumb-muted-foreground/20',
            'py-2',
            isProcessing && 'opacity-50 cursor-not-allowed'
          )}
        />
      </div>

      {/* Right: Send button */}
      {!hideSubmitButton && (
        <Button
          onClick={onSubmit}
          disabled={!canSubmit || isProcessing}
          size="icon"
          className={cn(
            'size-10 sm:size-11 rounded-full shrink-0',
            'bg-primary hover:bg-primary/90',
            'text-primary-foreground',
            'shadow-md hover:shadow-lg hover:shadow-primary/25',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
            canSubmit && !isProcessing && 'hover:scale-105 active:scale-95'
          )}
        >
          {isProcessing ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <ArrowUp className="size-5" />
          )}
        </Button>
      )}
    </div>
  );
}
