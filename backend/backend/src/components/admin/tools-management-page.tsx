'use client';

import { deleteToolAction } from '@/actions/tools/delete-tool';
import { getAllToolsAction } from '@/actions/tools/get-all-tools';
import { toggleToolFeaturedAction } from '@/actions/tools/toggle-tool-featured';
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
import { formatDate } from '@/lib/formatter';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  EditIcon,
  ExternalLinkIcon,
  Loader2,
  PlusIcon,
  SearchIcon,
  StarIcon,
  Trash2Icon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useRouter } from 'next/navigation';
import {
  parseAsIndex,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

interface ToolItem {
  id: string;
  slug: string;
  name: string;
  url: string;
  tags: string | null;
  dr: number | null;
  mv: string | null;
  iconUrl: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  starRating: number | null;
  featured: boolean | null;
  published: boolean | null;
  status: string;
  submissionId: string | null;
  collectionTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
  enTitle: string | null;
  enDescription: string | null;
}

export function ToolsManagementPage() {
  const t = useTranslations('Dashboard.admin.tools');
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'pending' | 'published' | 'rejected'
  >('published');
  const [featuredFilter, setFeaturedFilter] = useState<
    'all' | 'true' | 'false'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingToolId, setDeletingToolId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<string | null>(
    null
  );

  const [{ page, pageSize, search, status, featured }, setQueryStates] =
    useQueryStates({
      page: parseAsIndex.withDefault(0),
      pageSize: parseAsInteger.withDefault(10),
      search: parseAsString.withDefault(''),
      status: parseAsString.withDefault('published'),
      featured: parseAsString.withDefault('all'),
    });

  const {
    execute,
    result,
    status: actionStatus,
  } = useAction(getAllToolsAction);

  const { execute: toggleFeatured } = useAction(toggleToolFeaturedAction, {
    onSuccess: ({ data }) => {
      if (data?.success) {
        queueMicrotask(() =>
          toast.success(
            data.featured
              ? t('toast.featuredSuccess')
              : t('toast.unfeaturedSuccess')
          )
        );
        setTogglingFeaturedId(null);
        execute({
          pageIndex: page,
          pageSize,
          search: search || '',
          status: (status || 'published') as
            | 'all'
            | 'pending'
            | 'published'
            | 'rejected',
          featured: (featured || 'all') as 'all' | 'true' | 'false',
        });
      } else if (data && !data.success) {
        queueMicrotask(() => toast.error(data.error || t('toast.error')));
        setTogglingFeaturedId(null);
      }
    },
    onError: () => {
      queueMicrotask(() => toast.error(t('toast.error')));
      setTogglingFeaturedId(null);
    },
  });

  const { execute: deleteTool, status: deleteStatus } = useAction(
    deleteToolAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          queueMicrotask(() => toast.success(t('toast.deleteSuccess')));
          setIsDeleteDialogOpen(false);
          setDeletingToolId(null);
          execute({
            pageIndex: page,
            pageSize,
            search: search || '',
            status: (status || 'published') as
              | 'all'
              | 'pending'
              | 'published'
              | 'rejected',
            featured: (featured || 'all') as 'all' | 'true' | 'false',
          });
        } else if (data && !data.success) {
          queueMicrotask(() => toast.error(data.error || t('toast.error')));
        }
      },
      onError: () => {
        queueMicrotask(() => toast.error(t('toast.error')));
      },
    }
  );

  useEffect(() => {
    setStatusFilter(
      (status || 'published') as 'all' | 'pending' | 'published' | 'rejected'
    );
    setFeaturedFilter((featured || 'all') as 'all' | 'true' | 'false');
    setSearchQuery(search);
  }, [status, featured, search]);

  useEffect(() => {
    execute({
      pageIndex: page,
      pageSize,
      search: search || '',
      status: (status || 'published') as
        | 'all'
        | 'pending'
        | 'published'
        | 'rejected',
      featured: (featured || 'all') as 'all' | 'true' | 'false',
    });
  }, [page, pageSize, search, status, featured, execute]);

  const tools = (result?.data?.data?.items || []) as ToolItem[];
  const total = result?.data?.data?.total || 0;
  const isLoading = actionStatus === 'executing';
  const isDeleting = deleteStatus === 'executing';

  // 搜索防抖
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setQueryStates({ search: value, page: 0 });
    }, 300);
  };

  const handleFeaturedChange = (value: string) => {
    setFeaturedFilter(value as 'all' | 'true' | 'false');
    setQueryStates({ featured: value, page: 0 });
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as 'all' | 'pending' | 'published' | 'rejected');
    setQueryStates({ status: value, page: 0 });
  };

  const handleAddTool = () => {
    router.push('/admin/tools/form');
  };

  const handleEditTool = (tool: ToolItem) => {
    router.push(`/admin/tools/form?id=${tool.id}`);
  };

  const handleDeleteTool = (toolId: string) => {
    setDeletingToolId(toolId);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deletingToolId) {
      deleteTool({ toolId: deletingToolId });
    }
  };

  const handleToggleFeatured = (tool: ToolItem) => {
    setTogglingFeaturedId(tool.id);
    toggleFeatured({ toolId: tool.id, featured: !tool.featured });
  };

  const parseTags = (tags: string | null): string[] => {
    if (!tags) return [];
    try {
      return JSON.parse(tags);
    } catch {
      return [];
    }
  };

  const getStatusBadges = (tool: ToolItem) => {
    const badges = [];

    // 显示审核状态
    if (tool.status === 'published') {
      badges.push(
        <Badge
          key="published"
          variant="outline"
          className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
        >
          {t('status.published')}
        </Badge>
      );
    } else if (tool.status === 'pending') {
      badges.push(
        <Badge
          key="pending"
          variant="outline"
          className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
        >
          {t('status.pending')}
        </Badge>
      );
    } else if (tool.status === 'rejected') {
      badges.push(
        <Badge
          key="rejected"
          variant="outline"
          className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
        >
          {t('status.rejected')}
        </Badge>
      );
    }

    // 显示精选状态
    if (tool.featured) {
      badges.push(
        <Badge
          key="featured"
          variant="outline"
          className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
        >
          {t('status.featured')}
        </Badge>
      );
    }

    return badges;
  };

  return (
    <div className="space-y-4 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 max-w-2xl flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
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
              <SelectItem value="published">{t('filter.published')}</SelectItem>
              <SelectItem value="pending">{t('filter.pending')}</SelectItem>
              <SelectItem value="rejected">{t('filter.rejected')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={featuredFilter} onValueChange={handleFeaturedChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={t('filter.featured')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="true">{t('filter.featuredOnly')}</SelectItem>
              <SelectItem value="false">{t('filter.notFeatured')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            {t('total', { count: total })}
          </div>
          <Button onClick={handleAddTool}>
            <PlusIcon className="size-4 mr-2" />
            {t('add')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.url')}</TableHead>
              <TableHead>{t('columns.tags')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead>{t('columns.createdAt')}</TableHead>
              <TableHead>{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : tools.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              tools.map((tool) => (
                <TableRow key={tool.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{tool.name}</span>
                      {tool.enTitle && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {tool.enTitle}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline max-w-xs"
                      title={tool.url}
                    >
                      <span className="truncate">{tool.url}</span>
                      <ExternalLinkIcon className="size-3 flex-shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {parseTags(tool.tags)
                        .slice(0, 2)
                        .map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="text-xs"
                          >
                            #{tag}
                          </Badge>
                        ))}
                      {parseTags(tool.tags).length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{parseTags(tool.tags).length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {getStatusBadges(tool)}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(tool.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={tool.featured ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => handleToggleFeatured(tool)}
                        disabled={togglingFeaturedId === tool.id}
                        title={
                          tool.featured
                            ? t('actions.unfeature')
                            : t('actions.feature')
                        }
                      >
                        {togglingFeaturedId === tool.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <StarIcon
                            className={`size-4 ${
                              tool.featured
                                ? 'fill-amber-400 text-amber-500'
                                : ''
                            }`}
                          />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditTool(tool)}
                      >
                        <EditIcon className="size-4 mr-2" />
                        {t('actions.edit')}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTool(tool.id)}
                      >
                        <Trash2Icon className="size-4 mr-2" />
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
                setDeletingToolId(null);
              }}
            >
              {t('deleteDialog.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
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
