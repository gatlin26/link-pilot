'use client';

import {
  getToolReviewsAction,
  submitReviewAction,
} from '@/actions/tools/reviews';
import { LoginWrapper } from '@/components/auth/login-wrapper';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/hooks/use-current-user';
import { formatDistanceToNow } from 'date-fns';
import {
  de,
  enUS,
  es,
  fr,
  ja,
  ko,
  pt as ptBR,
  vi,
  zhCN,
  zhTW,
} from 'date-fns/locale';
import { Loader2, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const MAX_COMMENT_LENGTH = 10000;
const DRAFT_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Draft storage helpers (localStorage, 1h expiry)
// ---------------------------------------------------------------------------
function getDraftKey(toolId: string, userId: string) {
  return `tool-review-draft-${toolId}-${userId}`;
}

interface DraftData {
  rating: number;
  comment: string;
  savedAt: number;
}

function getDraft(toolId: string, userId: string): DraftData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getDraftKey(toolId, userId));
    if (!raw) return null;
    const data = JSON.parse(raw) as DraftData;
    if (Date.now() - data.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(getDraftKey(toolId, userId));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setDraft(
  toolId: string,
  userId: string,
  rating: number,
  comment: string
) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      getDraftKey(toolId, userId),
      JSON.stringify({ rating, comment, savedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

function clearDraft(toolId: string, userId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getDraftKey(toolId, userId));
  } catch {
    // ignore
  }
}

const dateFnsLocaleMap: Record<string, typeof enUS> = {
  en: enUS,
  zh: zhCN,
  'zh-TW': zhTW,
  ko,
  ja,
  pt: ptBR,
  es,
  de,
  fr,
  vi,
};

interface ToolReviewsProps {
  toolId: string;
  toolName: string;
  initialAvgRating: number;
  initialReviewCount: number;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  userName: string;
  userImage: string | null;
}

// ---------------------------------------------------------------------------
// Star Rating Selector
// ---------------------------------------------------------------------------
function StarRating({
  value,
  onChange,
  readonly = false,
  size = 'md',
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [hovered, setHovered] = useState(0);
  const sizeClass =
    size === 'lg' ? 'size-6' : size === 'sm' ? 'size-4' : 'size-5';

  return (
    <div className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const starValue = i + 1;
        const active = hovered > 0 ? starValue <= hovered : starValue <= value;
        return (
          <button
            key={i}
            type="button"
            disabled={readonly}
            className={`${readonly ? 'cursor-default' : 'cursor-pointer'} transition-colors`}
            onMouseEnter={() => !readonly && setHovered(starValue)}
            onMouseLeave={() => !readonly && setHovered(0)}
            onClick={() => onChange?.(starValue)}
          >
            <Star
              className={`${sizeClass} ${
                active
                  ? 'fill-[#fbbf24] text-[#fbbf24]'
                  : 'fill-[#e2e8f0] text-[#e2e8f0] dark:fill-[#334155] dark:text-[#334155]'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function ToolReviews({
  toolId,
  toolName,
  initialAvgRating,
  initialReviewCount,
}: ToolReviewsProps) {
  const t = useTranslations('ToolsPage.reviews');
  const currentUser = useCurrentUser();
  const params = useParams();
  const locale = (params?.locale as string) || 'en';
  const dateLocale = dateFnsLocaleMap[locale] ?? enUS;

  // State
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [total, setTotal] = useState(initialReviewCount);
  const [avgRating, setAvgRating] = useState(initialAvgRating);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingList, setLoadingList] = useState(true);

  // Form state（每次提交都是新评论，不加载已有评论）
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');

  // Actions
  const submitAction = useAction(submitReviewAction);

  // Load reviews
  const loadReviews = useCallback(
    async (pageNum: number, append = false) => {
      setLoadingList(true);
      try {
        const result = await getToolReviewsAction({
          toolId,
          page: pageNum,
          pageSize: 10,
        });
        if (result?.data?.success && result.data.data) {
          const {
            reviews: newReviews,
            total: newTotal,
            hasMore: more,
          } = result.data.data;
          setReviews((prev) =>
            append ? [...prev, ...newReviews] : newReviews
          );
          setTotal(newTotal);
          setHasMore(more);

          if (newTotal > 0 && !append) {
            const sumRating = newReviews.reduce(
              (sum: number, r: ReviewItem) => sum + r.rating,
              0
            );
            if (newTotal <= 10) {
              setAvgRating(Number((sumRating / newTotal).toFixed(1)));
            }
          }
        }
      } finally {
        setLoadingList(false);
      }
    },
    [toolId]
  );

  // 加载草稿（用户允许重复提交，不加载已有评论）
  useEffect(() => {
    if (!currentUser) return;
    const draft = getDraft(toolId, currentUser.id);
    if (draft) {
      setFormRating(draft.rating);
      setFormComment(draft.comment);
    }
  }, [currentUser?.id, toolId]);

  useEffect(() => {
    loadReviews(1);
  }, [loadReviews]);

  // 草稿自动保存到 localStorage（防抖）
  const saveDraftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  useEffect(() => {
    if (!currentUser) return;
    if (formRating === 0 && !formComment.trim()) return;

    saveDraftTimeoutRef.current = setTimeout(() => {
      setDraft(toolId, currentUser.id, formRating, formComment);
    }, 500);

    return () => {
      if (saveDraftTimeoutRef.current) {
        clearTimeout(saveDraftTimeoutRef.current);
      }
    };
  }, [toolId, currentUser?.id, formRating, formComment]);

  // Submit handler
  const handleSubmit = async () => {
    if (formRating === 0) {
      toast.error(t('ratingRequired'));
      return;
    }

    const result = await submitAction.executeAsync({
      toolId,
      rating: formRating,
      comment: formComment.trim() || undefined,
    });

    if (result?.data?.success) {
      toast.success(t('submitSuccess'));
      setFormRating(0);
      setFormComment('');
      if (currentUser) clearDraft(toolId, currentUser.id);
      setPage(1);
      await loadReviews(1);
    }
  };

  // Load more handler
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadReviews(nextPage, true);
  };

  const isSubmitting = submitAction.isPending;

  return (
    <section className="mt-16">
      {/* H2 Title */}
      <h2 className="font-heading text-2xl lg:text-3xl font-bold tracking-tight mb-8 text-[#0f172a] dark:text-[#f8fafc]">
        {t('title', { name: toolName, count: total })}
      </h2>

      {/* Average Rating Card */}
      <div className="rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-white/50 dark:bg-[#1e293b]/50 backdrop-blur-sm p-6 mb-8">
        <div className="flex items-center gap-3">
          <StarRating value={Math.round(avgRating)} readonly size="lg" />
          <span className="text-base font-medium text-[#64748b] dark:text-[#94a3b8]">
            {avgRating > 0
              ? t('averageRating', { rating: avgRating.toFixed(1) })
              : t('noRating')}
          </span>
        </div>
      </div>

      {/* Review Form */}
      <div className="rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-white/50 dark:bg-[#1e293b]/50 backdrop-blur-sm p-6 mb-8">
        <p className="font-semibold text-base mb-4 text-[#0f172a] dark:text-[#f8fafc]">
          {t('recommend', { name: toolName })}
        </p>

        {/* Star Rating Selector */}
        <div className="mb-4">
          <StarRating
            value={formRating}
            onChange={currentUser ? setFormRating : undefined}
            readonly={!currentUser}
            size="lg"
          />
        </div>

        {/* Comment Input */}
        <div className="flex gap-3">
          <Avatar className="size-10 shrink-0 mt-1">
            {currentUser?.image ? (
              <AvatarImage
                src={currentUser.image}
                alt={currentUser.name || ''}
              />
            ) : null}
            <AvatarFallback className="bg-[#e2e8f0] dark:bg-[#334155] text-[#64748b] dark:text-[#94a3b8]">
              {currentUser?.name?.charAt(0)?.toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <div className="relative">
              <Textarea
                value={formComment}
                onChange={(e) =>
                  setFormComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))
                }
                placeholder={t('placeholder')}
                disabled={!currentUser}
                className="min-h-[120px] resize-y border-[#e2e8f0] dark:border-[#334155] bg-white dark:bg-[#0f172a] text-[#0f172a] dark:text-[#f8fafc] placeholder:text-[#94a3b8] dark:placeholder:text-[#475569]"
              />
              <span className="absolute bottom-2 right-3 text-xs text-[#94a3b8] dark:text-[#475569]">
                {t('charCount', {
                  current: formComment.length,
                  max: MAX_COMMENT_LENGTH,
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Submit / Login Button */}
        <div className="flex items-center gap-3 mt-4 justify-end">
          {currentUser ? (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || formRating === 0}
              className="bg-gradient-to-r from-[#0052ff] to-[#3d8bff] hover:opacity-90"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin mr-1" />}
              {t('submit')}
            </Button>
          ) : (
            <LoginWrapper mode="modal" asChild>
              <Button className="bg-gradient-to-r from-[#7c3aed] to-[#a855f7] hover:opacity-90">
                {t('loginToComment')}
              </Button>
            </LoginWrapper>
          )}
        </div>
      </div>

      {/* Reviews List */}
      {loadingList && reviews.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-[#64748b]" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-center text-[#94a3b8] dark:text-[#475569] py-12">
          {t('noReviews')}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="rounded-xl border border-[#e2e8f0] dark:border-[#334155] bg-white/50 dark:bg-[#1e293b]/50 backdrop-blur-sm p-5"
            >
              <div className="flex items-start gap-3">
                <Avatar className="size-9 shrink-0">
                  {review.userImage ? (
                    <AvatarImage src={review.userImage} alt={review.userName} />
                  ) : null}
                  <AvatarFallback className="bg-[#e2e8f0] dark:bg-[#334155] text-[#64748b] text-sm">
                    {review.userName?.charAt(0)?.toUpperCase() || '?'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-[#0f172a] dark:text-[#f8fafc]">
                      {review.userName}
                    </span>
                    <StarRating value={review.rating} readonly size="sm" />
                    <span className="text-xs text-[#94a3b8] dark:text-[#475569]">
                      {formatDistanceToNow(new Date(review.createdAt), {
                        addSuffix: true,
                        locale: dateLocale,
                      })}
                      {new Date(review.updatedAt).getTime() -
                        new Date(review.createdAt).getTime() >
                        60000 && <span className="ml-1">({t('edited')})</span>}
                    </span>
                  </div>

                  {review.comment && (
                    <p className="mt-2 text-sm text-[#475569] dark:text-[#94a3b8] leading-relaxed whitespace-pre-wrap">
                      {review.comment}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingList}
                className="border-[#e2e8f0] dark:border-[#334155]"
              >
                {loadingList ? (
                  <Loader2 className="size-4 animate-spin mr-1" />
                ) : null}
                {t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
