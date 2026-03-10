/**
 * @file model-credits-table.tsx
 * @description 模型积分消耗表格 - 展示各模型的特性、适用场景和积分消耗
 * @author git.username
 * @date 2025-12-27
 */

'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AI_MODELS } from '@/config/ai-models-config';
import { cn } from '@/lib/utils';
import { Coins, Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ModelCreditsTableProps {
  className?: string;
}

export function ModelCreditsTable({ className }: ModelCreditsTableProps) {
  const t = useTranslations('PricingPage.modelCredits');

  return (
    <section className={cn('space-y-6', className)}>
      {/* 标题区 */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
          <Sparkles className="size-4 text-primary" />
          <span className="text-sm font-medium text-primary">{t('badge')}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {t('title')}
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          {t('subtitle')}
        </p>
      </div>

      {/* 表格 */}
      <div className="border border-border/60 rounded-2xl overflow-hidden bg-card/50 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold w-[180px]">
                {t('columns.model')}
              </TableHead>
              <TableHead className="font-semibold">
                {t('columns.features')}
              </TableHead>
              <TableHead className="font-semibold hidden md:table-cell">
                {t('columns.useCases')}
              </TableHead>
              <TableHead className="font-semibold text-center w-[120px]">
                <div className="flex items-center justify-center gap-1.5">
                  <Coins className="size-4 text-amber-500" />
                  {t('columns.credits')}
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {AI_MODELS.map((model, index) => (
              <TableRow
                key={model.id}
                className={cn(
                  'transition-colors',
                  index % 2 === 0 ? 'bg-background' : 'bg-muted/20'
                )}
              >
                {/* 模型名称 */}
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-amber-500 flex-shrink-0" />
                    <span>{model.name}</span>
                  </div>
                </TableCell>

                {/* 特性标签 */}
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {model.tagKeys.map((tagKey) => {
                      const tagTranslationKey = `tags.${tagKey}` as Parameters<
                        typeof t
                      >[0];
                      return (
                        <Badge
                          key={tagKey}
                          variant="secondary"
                          className="text-xs font-normal px-2 py-0.5"
                        >
                          {t(tagTranslationKey)}
                        </Badge>
                      );
                    })}
                  </div>
                </TableCell>

                {/* 适用场景 */}
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {t(
                    `useCases.${model.id.replace(/\./g, '-')}` as Parameters<
                      typeof t
                    >[0]
                  )}
                </TableCell>

                {/* 积分消耗 */}
                <TableCell className="text-center">
                  <div className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary font-semibold rounded-full">
                    <span className="text-lg">
                      {model.creditsPerGeneration}
                    </span>
                    <span className="text-xs opacity-80">
                      {t('perGeneration')}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* 底部提示 */}
      <p className="text-center text-sm text-muted-foreground">{t('note')}</p>
    </section>
  );
}
