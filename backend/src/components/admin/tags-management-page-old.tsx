'use client';

import {
  deleteTagAction,
  getAllTagsGroupedAction,
} from '@/actions/tags/manage-tags';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Loader2,
  PlusIcon,
  SearchIcon,
  TrashIcon,
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
import { TagCreateDialog } from './tag-create-dialog';
import { TagEditDialog } from './tag-edit-dialog';

/** 与 getAllTagsGroupedAction 返回结构一致（tool_tags 无 color/iconEmoji/featured，用 status） */
interface GroupedTag {
  slug: string;
  category: string | null;
  status: string | null;
  sortOrder: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
  translations: {
    locale: string | null;
    id: string | null;
    name: string | null;
    description: string | null;
  }[];
}

/** 翻译 key 中仅支持这些英文 category，避免 DB 中遗留中文导致 MISSING_MESSAGE */
const CATEGORY_I18N_KEYS = [
  'type',
  'pricing',
  'platform',
  'feature',
  'general',
  'other',
] as const;
const CATEGORY_LEGACY_ZH_TO_KEY: Record<
  string,
  (typeof CATEGORY_I18N_KEYS)[number]
> = {
  类型: 'type',
  定价: 'pricing',
  平台: 'platform',
  功能: 'feature',
  通用: 'general',
  其他: 'other',
};

export function TagsManagementPageClient() {
  const t = useTranslations('Dashboard.admin.tags');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [publishedFilter, setPublishedFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<GroupedTag | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<GroupedTag | null>(null);

  const [{ page, pageSize, search, category, published }, setQueryStates] =
    useQueryStates({
      page: parseAsIndex.withDefault(0),
      pageSize: parseAsInteger.withDefault(10),
      search: parseAsString.withDefault(''),
      category: parseAsString.withDefault('all'),
      published: parseAsString.withDefault('all'),
    });

  const {
    execute,
    result,
    status: actionStatus,
  } = useAction(getAllTagsGroupedAction);

  const { execute: deleteTag, status: deleteStatus } = useAction(
    deleteTagAction,
    {
      onSuccess: ({ data }) => {
        if (data?.success) {
          toast.success(t('toast.deleteSuccess'));
          setDeleteDialogOpen(false);
          setDeletingTag(null);
          execute({});
        } else {
          toast.error(data?.error || t('toast.error'));
        }
      },
      onError: ({ error }) => {
        toast.error(
          typeof error.serverError === 'string'
            ? error.serverError
            : t('toast.error')
        );
      },
    }
  );

  useEffect(() => {
    setSearchQuery(search);
    setCategoryFilter(category);
    setPublishedFilter(published);
  }, [search, category, published]);

  useEffect(() => {
    execute({});
  }, [execute]);

  const tags = (result?.data?.data || []) as GroupedTag[];
  const isLoading = actionStatus === 'executing';

  // 客户端过滤
  const filteredTags = tags.filter((tag) => {
    const matchesSearch =
      !searchQuery ||
      tag.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tag.translations.some((tr) =>
        tr.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );

    const matchesCategory =
      categoryFilter === 'all' || tag.category === categoryFilter;

    const matchesPublished =
      publishedFilter === 'all' ||
      (publishedFilter === 'published' && tag.status === 'published') ||
      (publishedFilter === 'draft' && tag.status === 'draft');

    return matchesSearch && matchesCategory && matchesPublished;
  });

  // 分页
  const totalPages = Math.ceil(filteredTags.length / pageSize);
  const paginatedTags = filteredTags.slice(
    page * pageSize,
    (page + 1) * pageSize
  );

  const handleSearch = () => {
    setQueryStates({
      search: searchQuery,
      page: 0,
    });
  };

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value);
    setQueryStates({
      category: value,
      page: 0,
    });
  };

  const handlePublishedChange = (value: string) => {
    setPublishedFilter(value);
    setQueryStates({
      published: value,
      page: 0,
    });
  };

  const getCategoryBadge = (category: string | null) => {
    if (!category) return null;
    const key =
      CATEGORY_LEGACY_ZH_TO_KEY[category] ??
      (CATEGORY_I18N_KEYS.includes(
        category as (typeof CATEGORY_I18N_KEYS)[number]
      )
        ? category
        : null);
    const label = key ? t(`category.${key}`) : category;
    return (
      <Badge variant="outline" className="capitalize">
        {label}
      </Badge>
    );
  };

  const getStatusBadge = (tag: GroupedTag) => {
    const s = tag.status || 'draft';
    if (s === 'published')
      return <Badge variant="default">{t('status.published')}</Badge>;
    if (s === 'archived')
      return <Badge variant="secondary">{t('status.archived')}</Badge>;
    return <Badge variant="secondary">{t('status.draft')}</Badge>;
  };

  const getTranslation = (tag: GroupedTag, locale: string) => {
    return tag.translations.find((tr) => tr.locale === locale);
  };

  const handleEdit = (tag: GroupedTag) => {
    setEditingTag(tag);
    setEditDialogOpen(true);
  };

  const handleDelete = (tag: GroupedTag) => {
    setDeletingTag(tag);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (deletingTag) {
      deleteTag({ slug: deletingTag.slug });
    }
  };

  const handleCreateSuccess = () => {
    execute({});
  };

  const handleEditSuccess = () => {
    execute({});
  };

  return (
    <div className="space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground mt-2">{t('description')}</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <PlusIcon className="size-4 mr-2" />
          {t('add')}
        </Button>
      </div>

      {/* 筛选和搜索 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder={t('search.placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} variant="secondary">
            <SearchIcon className="size-4" />
          </Button>
        </div>

        <Select value={categoryFilter} onValueChange={handleCategoryChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filter.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter.all')}</SelectItem>
            <SelectItem value="type">{t('category.type')}</SelectItem>
            <SelectItem value="pricing">{t('category.pricing')}</SelectItem>
            <SelectItem value="platform">{t('category.platform')}</SelectItem>
            <SelectItem value="feature">{t('category.feature')}</SelectItem>
            <SelectItem value="general">{t('category.general')}</SelectItem>
            <SelectItem value="other">{t('category.other')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={publishedFilter} onValueChange={handlePublishedChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('filter.published')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filter.all')}</SelectItem>
            <SelectItem value="published">
              {t('filter.publishedOnly')}
            </SelectItem>
            <SelectItem value="draft">{t('filter.draftOnly')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 统计信息 */}
      <div className="text-sm text-muted-foreground">
        {t('total', { count: filteredTags.length })}
      </div>

      {/* 表格 */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('columns.slug')}</TableHead>
              <TableHead>{t('form.enName')}</TableHead>
              <TableHead>{t('form.zhName')}</TableHead>
              <TableHead>{t('columns.category')}</TableHead>
              <TableHead>{t('columns.usageCount')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead className="text-right">
                {t('columns.actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <Loader2 className="size-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : paginatedTags.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              paginatedTags.map((tag) => {
                const enTranslation = getTranslation(tag, 'en');
                const zhTranslation = getTranslation(tag, 'zh');

                return (
                  <TableRow key={tag.slug}>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {tag.slug}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {enTranslation?.name || '-'}
                        </div>
                        {enTranslation?.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {enTranslation.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {zhTranslation?.name || '-'}
                        </div>
                        {zhTranslation?.description && (
                          <div className="text-sm text-muted-foreground line-clamp-1">
                            {zhTranslation.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getCategoryBadge(tag.category)}</TableCell>
                    <TableCell>{tag.usageCount}</TableCell>
                    <TableCell>{getStatusBadge(tag)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(tag)}
                        >
                          <EditIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(tag)}
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t('pagination.showing', {
              from: page * pageSize + 1,
              to: Math.min((page + 1) * pageSize, filteredTags.length),
              total: filteredTags.length,
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQueryStates({ page: 0 })}
              disabled={page === 0}
            >
              <ChevronsLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQueryStates({ page: page - 1 })}
              disabled={page === 0}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="text-sm">
              {t('pagination.page', { current: page + 1, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQueryStates({ page: page + 1 })}
              disabled={page >= totalPages - 1}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQueryStates({ page: totalPages - 1 })}
              disabled={page >= totalPages - 1}
            >
              <ChevronsRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 创建标签对话框 */}
      <TagCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateSuccess}
      />

      {/* 编辑标签对话框 */}
      <TagEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        tag={editingTag}
        onSuccess={handleEditSuccess}
      />

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTag && (
                <div className="space-y-2">
                  <p>{t('deleteDialog.description')}</p>
                  <div className="mt-4 p-3 bg-muted rounded-md space-y-2">
                    <div>
                      <span className="font-semibold">Slug: </span>
                      <code className="text-sm">{deletingTag.slug}</code>
                    </div>
                    <div>
                      <span className="font-semibold">
                        {t('form.enName')}:{' '}
                      </span>
                      {getTranslation(deletingTag, 'en')?.name || '-'}
                    </div>
                    <div>
                      <span className="font-semibold">
                        {t('form.zhName')}:{' '}
                      </span>
                      {getTranslation(deletingTag, 'zh')?.name || '-'}
                    </div>
                    <div>
                      <span className="font-semibold">
                        {t('columns.usageCount')}:{' '}
                      </span>
                      <span className="text-destructive font-bold">
                        {deletingTag.usageCount}
                      </span>
                    </div>
                  </div>
                  {deletingTag.usageCount > 0 && (
                    <p className="text-sm text-destructive mt-2">
                      ⚠️ 此标签将从 {deletingTag.usageCount} 个工具中移除
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStatus === 'executing'}>
              {t('deleteDialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteStatus === 'executing'}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteStatus === 'executing' ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('deleteDialog.deleting')}
                </>
              ) : (
                t('deleteDialog.confirm')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
