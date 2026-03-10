'use client';

import {
  getAllReviewsAction,
  softDeleteReviewAction,
  updateReviewStatusAction,
} from '@/actions/tools/reviews';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLocaleRouter } from '@/i18n/navigation';
import { formatDate } from '@/lib/formatter';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  EyeIcon,
  Loader2,
  MessageSquareIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import {
  parseAsIndex,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Review {
  id: string;
  toolId: string;
  userId: string;
  rating: number;
  comment: string | null;
  status: 'published' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
  userName: string;
  userImage: string | null;
  toolName: string;
  toolSlug: string;
}

export function ReviewsManagementPage() {
  const t = useTranslations('Dashboard.admin.reviews');
  const router = useLocaleRouter();
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'published' | 'hidden'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingReview, setViewingReview] = useState<Review | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [{ page, pageSize, search, status }, setQueryStates] = useQueryStates({
    page: parseAsIndex.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    search: parseAsString.withDefault(''),
    status: parseAsString.withDefault('all'),
  });

  const {
    execute,
    result,
    status: actionStatus,
  } = useAction(getAllReviewsAction);

  const { execute: updateStatus, status: updateStatusState } = useAction(
    updateReviewStatusAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          queueMicrotask(() => toast.success(t('toast.statusUpdated')));
          execute({
            page: page + 1,
            pageSize,
            status: status as 'all' | 'published' | 'hidden',
            search: search || undefined,
          });
        } else {
          queueMicrotask(() => toast.error(t('toast.error')));
        }
      },
      onError: () => {
        queueMicrotask(() => toast.error(t('toast.error')));
      },
    }
  );

  const { execute: softDeleteReview, status: deleteStatus } = useAction(
    softDeleteReviewAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          queueMicrotask(() => toast.success(t('toast.deleted')));
          setIsDeleteDialogOpen(false);
          setDeletingReviewId(null);
          execute({
            page: page + 1,
            pageSize,
            status: status as 'all' | 'published' | 'hidden',
            search: search || undefined,
          });
        } else {
          queueMicrotask(() => toast.error(data?.error || t('toast.error')));
        }
      },
      onError: () => {
        queueMicrotask(() => toast.error(t('toast.error')));
      },
    }
  );

  useEffect(() => {
    setStatusFilter((status || 'all') as 'all' | 'published' | 'hidden');
    setSearchQuery(search);
  }, [status, search]);

  useEffect(() => {
    execute({
      page: page + 1,
      pageSize,
      status: (status || 'all') as 'all' | 'published' | 'hidden',
      search: search || undefined,
    });
  }, [page, pageSize, search, status, execute]);

  const reviews = (result?.data?.data?.reviews || []) as Review[];
  const total = result?.data?.data?.total || 0;
  const isLoading = actionStatus === 'executing';

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setQueryStates({ search: value, page: 0 });
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as 'all' | 'published' | 'hidden');
    setQueryStates({ status: value, page: 0 });
  };

  const handleToggleStatus = (review: Review) => {
    const newStatus = review.status === 'published' ? 'hidden' : 'published';
    updateStatus({
      reviewId: review.id,
      status: newStatus,
    });
  };

  const handleViewReview = (review: Review) => {
    setViewingReview(review);
    setIsViewDialogOpen(true);
  };

  const handleDeleteReview = (reviewId: string) => {
    setDeletingReviewId(reviewId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingReviewId) {
      softDeleteReview({ reviewId: deletingReviewId });
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'published') {
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
        >
          {t('status.published')}
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
      >
        {t('status.hidden')}
      </Badge>
    );
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <StarIcon
            key={star}
            className={`size-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('filter.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="published">{t('status.published')}</SelectItem>
              <SelectItem value="hidden">{t('status.hidden')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-sm text-muted-foreground">
          {t('total', { count: total })}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.tool')}</TableHead>
              <TableHead>{t('columns.user')}</TableHead>
              <TableHead>{t('columns.rating')}</TableHead>
              <TableHead>{t('columns.comment')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead>{t('columns.createdAt')}</TableHead>
              <TableHead>{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : reviews.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              reviews.map((review) => (
                <TableRow key={review.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span
                        className="font-medium text-primary cursor-pointer hover:underline"
                        onClick={() => router.push(`/tools/${review.toolSlug}`)}
                      >
                        {review.toolName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {review.toolSlug}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {review.userImage ? (
                        <img
                          src={review.userImage}
                          alt={review.userName}
                          className="size-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          {review.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-sm">{review.userName}</span>
                    </div>
                  </TableCell>
                  <TableCell>{renderStars(review.rating)}</TableCell>
                  <TableCell>
                    <div className="max-w-xs">
                      {review.comment ? (
                        <p className="text-sm truncate" title={review.comment}>
                          {review.comment}
                        </p>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          {t('noComment')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(review.status)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(review.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReview(review)}
                      >
                        <EyeIcon className="size-4 mr-1" />
                        {t('actions.view')}
                      </Button>
                      <Button
                        variant={
                          review.status === 'published'
                            ? 'secondary'
                            : 'default'
                        }
                        size="sm"
                        onClick={() => handleToggleStatus(review)}
                        disabled={updateStatusState === 'executing'}
                      >
                        {review.status === 'published'
                          ? t('actions.hide')
                          : t('actions.show')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteReview(review.id)}
                      >
                        <Trash2Icon className="size-4 mr-1" />
                        {t('actions.delete')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: page * pageSize + 1,
              to: Math.min((page + 1) * pageSize, total),
              total,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQueryStates({ page: 0 })}
              disabled={page === 0 || isLoading}
            >
              <ChevronsLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQueryStates({ page: page - 1 })}
              disabled={page === 0 || isLoading}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <div className="text-sm text-muted-foreground">
              {t('pagination.page', {
                current: page + 1,
                total: Math.ceil(total / pageSize),
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQueryStates({ page: page + 1 })}
              disabled={page >= Math.ceil(total / pageSize) - 1 || isLoading}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setQueryStates({ page: Math.ceil(total / pageSize) - 1 })
              }
              disabled={page >= Math.ceil(total / pageSize) - 1 || isLoading}
            >
              <ChevronsRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('viewDialog.title')}</DialogTitle>
            <DialogDescription>{t('viewDialog.description')}</DialogDescription>
          </DialogHeader>
          {viewingReview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">
                    {t('viewDialog.tool')}
                  </div>
                  <div
                    className="text-sm text-primary hover:underline cursor-pointer"
                    onClick={() =>
                      router.push(`/tools/${viewingReview.toolSlug}`)
                    }
                  >
                    {viewingReview.toolName}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">
                    {t('viewDialog.user')}
                  </div>
                  <div className="flex items-center gap-2">
                    {viewingReview.userImage ? (
                      <img
                        src={viewingReview.userImage}
                        alt={viewingReview.userName}
                        className="size-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="size-6 rounded-full bg-muted flex items-center justify-center text-xs">
                        {viewingReview.userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm">{viewingReview.userName}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">
                  {t('viewDialog.rating')}
                </div>
                {renderStars(viewingReview.rating)}
              </div>

              <div>
                <div className="text-sm font-medium mb-1">
                  {t('viewDialog.comment')}
                </div>
                {viewingReview.comment ? (
                  <div className="p-3 bg-muted rounded-md text-sm">
                    {viewingReview.comment}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    {t('noComment')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">
                    {t('viewDialog.status')}
                  </div>
                  <div>{getStatusBadge(viewingReview.status)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">
                    {t('viewDialog.createdAt')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatDate(viewingReview.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              {t('viewDialog.close')}
            </Button>
            {viewingReview && (
              <Button
                variant={
                  viewingReview.status === 'published' ? 'secondary' : 'default'
                }
                onClick={() => {
                  handleToggleStatus(viewingReview);
                  setIsViewDialogOpen(false);
                }}
                disabled={updateStatusState === 'executing'}
              >
                {viewingReview.status === 'published'
                  ? t('actions.hide')
                  : t('actions.show')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('deleteDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setDeletingReviewId(null);
              }}
            >
              {t('deleteDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteStatus === 'executing'}
            >
              {deleteStatus === 'executing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('deleteDialog.deleting')}
                </>
              ) : (
                t('deleteDialog.confirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
