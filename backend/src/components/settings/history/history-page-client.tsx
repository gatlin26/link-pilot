'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useImageHistory } from '@/hooks/use-image-history';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CoinsIcon,
  ImageIcon,
  SparklesIcon,
  WandIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { parseAsInteger, useQueryStates } from 'nuqs';

const PAGE_SIZE = 12;

function shouldBypassNextImageOptimization(url: string | null | undefined) {
  if (!url) return false;
  // 这些图片来自我们自己的 CDN（s.vidlyo.net）。
  // Next 的图片优化器在某些环境/大尺寸下容易超时（/_next/image 500），直接走原图更稳定。
  return (
    url.startsWith('https://s.vidlyo.net/') ||
    url.startsWith('https://s.skin-enhancer.com/')
  );
}

export default function HistoryPageClient() {
  const t = useTranslations('Dashboard.settings.history');

  const [{ page }, setQueryStates] = useQueryStates({
    page: parseAsInteger.withDefault(0),
  });

  const { data, isLoading } = useImageHistory(page, PAGE_SIZE);

  // 只展示成功的记录（减少噪音：失败/处理中不在这里出现）
  const items = (data?.items || []).filter(
    (item) => item.status === 'completed'
  );
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  const handlePrev = () => {
    if (hasPrev) {
      setQueryStates({ page: page - 1 });
    }
  };

  const handleNext = () => {
    if (hasNext) {
      setQueryStates({ page: page + 1 });
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: PAGE_SIZE }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ImageIcon className="size-12 mb-4" />
        <p>{t('empty')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Image Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {items.map((item) => (
          <HistoryCard key={item.id} item={item} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrev}
            disabled={!hasPrev}
          >
            <ChevronLeftIcon className="size-4 mr-1" />
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={!hasNext}
          >
            {t('next')}
            <ChevronRightIcon className="size-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface HistoryCardProps {
  item: {
    id: string;
    type: string;
    status: string;
    prompt: string | null;
    inputUrl: string | null;
    outputUrl: string | null;
    creditsUsed: number;
    createdAt: Date;
  };
}

function HistoryCard({ item }: HistoryCardProps) {
  const t = useTranslations('Dashboard.settings.history');

  const isEnhance = item.type === 'enhance';
  const displayUrl = item.outputUrl || item.inputUrl;
  const bypassGrid = shouldBypassNextImageOptimization(displayUrl);
  const bypassInput = shouldBypassNextImageOptimization(item.inputUrl);
  const bypassOutput = shouldBypassNextImageOptimization(item.outputUrl);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Card className="group relative aspect-square overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all">
          {displayUrl ? (
            <Image
              src={displayUrl}
              alt={item.prompt || 'Image'}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              unoptimized={bypassGrid}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-muted">
              <ImageIcon className="size-8 text-muted-foreground" />
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Info */}
          <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center justify-between text-white text-xs">
              <div className="flex items-center gap-1">
                {isEnhance ? (
                  <WandIcon className="size-3" />
                ) : (
                  <SparklesIcon className="size-3" />
                )}
                <span>
                  {isEnhance ? t('type.enhance') : t('type.generate')}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <CoinsIcon className="size-3" />
                <span>{item.creditsUsed}</span>
              </div>
            </div>
          </div>
        </Card>
      </DialogTrigger>

      <DialogContent className="max-w-4xl">
        <DialogTitle className="sr-only">{t('detail')}</DialogTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input Image */}
          {item.inputUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t('input')}
              </p>
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <Image
                  src={item.inputUrl}
                  alt="Input"
                  fill
                  className="object-contain"
                  /**
                   * 关键：不写 sizes 会导致 Next 默认按 100vw 计算，
                   * 在 4K 屏触发 w=3840 的 /_next/image 请求，容易超时 500。
                   */
                  sizes="(max-width: 768px) 100vw, 512px"
                  unoptimized={bypassInput}
                />
              </div>
            </div>
          )}

          {/* Output Image */}
          {item.outputUrl && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t('output')}
              </p>
              <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                <Image
                  src={item.outputUrl}
                  alt="Output"
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 512px"
                  unoptimized={bypassOutput}
                />
              </div>
            </div>
          )}
        </div>

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            {isEnhance ? (
              <WandIcon className="size-4" />
            ) : (
              <SparklesIcon className="size-4" />
            )}
            <span>{isEnhance ? t('type.enhance') : t('type.generate')}</span>
          </div>
          <div className="flex items-center gap-1">
            <CoinsIcon className="size-4" />
            <span>
              {item.creditsUsed} {t('credits')}
            </span>
          </div>
          <span>{formatDate(item.createdAt)}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
