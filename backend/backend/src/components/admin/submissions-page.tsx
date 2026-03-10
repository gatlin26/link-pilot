'use client';

import { getAllToolsAction } from '@/actions/tools/get-all-tools';
import { rejectSubmissionAction } from '@/actions/tools/reject-submission';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
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
import { Textarea } from '@/components/ui/textarea';
import { formatDate } from '@/lib/formatter';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircleIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  EditIcon,
  ExternalLinkIcon,
  Loader2,
  SearchIcon,
  XIcon,
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
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

type ToolStatus = 'pending' | 'published' | 'rejected';

interface ToolSubmission {
  id: string;
  name: string;
  url: string;
  slug: string;
  status: ToolStatus;
  rejectReason: string | null;
  submitterUserId: string | null;
  submitterEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  userName: string | null;
  userEmail: string | null;
  iconUrl: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
}

const rejectFormSchema = z.object({
  reason: z
    .string()
    .min(1, 'Reject reason is required')
    .max(500, 'Reject reason must not exceed 500 characters'),
});

export function SubmissionsPageClient() {
  const t = useTranslations('Dashboard.admin.submissions');
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<ToolStatus | 'all'>(
    'pending'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectingToolId, setRejectingToolId] = useState<string | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [viewingTool, setViewingTool] = useState<ToolSubmission | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const [{ page, pageSize, search, status }, setQueryStates] = useQueryStates({
    page: parseAsIndex.withDefault(0),
    pageSize: parseAsInteger.withDefault(10),
    search: parseAsString.withDefault(''),
    status: parseAsString.withDefault('pending'),
  });

  const {
    execute,
    result,
    status: actionStatus,
  } = useAction(getAllToolsAction);

  const { execute: rejectSubmission, status: rejectStatus } = useAction(
    rejectSubmissionAction
  );

  const rejectForm = useForm<z.infer<typeof rejectFormSchema>>({
    resolver: zodResolver(rejectFormSchema),
    defaultValues: {
      reason: '',
    },
  });

  useEffect(() => {
    setStatusFilter(status as ToolStatus | 'all');
    setSearchQuery(search);
  }, [status, search]);

  useEffect(() => {
    execute({
      pageIndex: page,
      pageSize,
      search: search || '',
      status: (status || 'pending') as ToolStatus | 'all',
    });
  }, [page, pageSize, search, status, execute]);

  // 拒绝成功后刷新列表
  useEffect(() => {
    if (rejectStatus === 'hasSucceeded') {
      execute({
        pageIndex: page,
        pageSize,
        search: search || '',
        status: (status || 'pending') as ToolStatus | 'all',
      });
      setIsRejectDialogOpen(false);
      setRejectingToolId(null);
      rejectForm.reset();
    }
  }, [rejectStatus, execute, page, pageSize, search, status, rejectForm]);

  const submissions = (result?.data?.data?.items || []).map((item) => ({
    ...item,
    status: item.status as ToolStatus,
  })) as ToolSubmission[];
  const total = result?.data?.data?.total || 0;
  const isLoading = actionStatus === 'executing';

  const handleApprove = (tool: ToolSubmission) => {
    router.push(`/admin/tools/form?id=${tool.id}`);
  };

  const handleReject = (toolId: string) => {
    setRejectingToolId(toolId);
    setIsRejectDialogOpen(true);
  };

  const handleRejectSubmit = async (data: z.infer<typeof rejectFormSchema>) => {
    if (!rejectingToolId) return;
    rejectSubmission({
      toolId: rejectingToolId,
      reason: data.reason,
    });
  };

  const handleView = (tool: ToolSubmission) => {
    setViewingTool(tool);
    setIsViewDialogOpen(true);
  };

  const getStatusBadge = (status: ToolStatus) => {
    switch (status) {
      case 'pending':
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
          >
            {t('status.pending')}
          </Badge>
        );
      case 'published':
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          >
            {t('status.approved')}
          </Badge>
        );
      case 'rejected':
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          >
            {t('status.rejected')}
          </Badge>
        );
    }
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setQueryStates({ search: value, page: 0 });
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as ToolStatus | 'all');
    setQueryStates({ status: value, page: 0 });
  };

  return (
    <div className="space-y-4 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-2">{t('description')}</p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
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
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('filter.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="pending">{t('status.pending')}</SelectItem>
              <SelectItem value="published">{t('status.approved')}</SelectItem>
              <SelectItem value="rejected">{t('status.rejected')}</SelectItem>
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
              <TableHead>{t('columns.name')}</TableHead>
              <TableHead>{t('columns.url')}</TableHead>
              <TableHead>{t('columns.submitter')}</TableHead>
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead>{t('columns.submittedAt')}</TableHead>
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
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((tool: ToolSubmission) => (
                <TableRow key={tool.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col gap-1">
                      <span>{tool.name}</span>
                      {tool.status === 'rejected' && tool.rejectReason && (
                        <Alert className="py-2 px-3 mt-1">
                          <AlertCircleIcon className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            <span className="font-medium">
                              {t('rejectReason')}:{' '}
                            </span>
                            {tool.rejectReason}
                          </AlertDescription>
                        </Alert>
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
                    <div className="flex flex-col">
                      {tool.userName && (
                        <span className="font-medium">{tool.userName}</span>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {tool.userEmail || tool.submitterEmail}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(tool.status)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(tool.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(tool)}
                      >
                        <EditIcon className="size-4 mr-2" />
                        {t('view')}
                      </Button>
                      {tool.status === 'pending' && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(tool)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckIcon className="size-4 mr-2" />
                            {t('approve')}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleReject(tool.id)}
                            disabled={rejectStatus === 'executing'}
                          >
                            {rejectStatus === 'executing' ? (
                              <Loader2 className="size-4 mr-2 animate-spin" />
                            ) : (
                              <XIcon className="size-4 mr-2" />
                            )}
                            {t('reject')}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('rejectDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('rejectDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...rejectForm}>
            <form
              onSubmit={rejectForm.handleSubmit(handleRejectSubmit)}
              className="space-y-4"
            >
              <FormField
                control={rejectForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('rejectDialog.reason')} *</FormLabel>
                    <FormControl>
                      <Textarea
                        className="resize-none"
                        rows={4}
                        placeholder={t('rejectDialog.reasonPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2 min-w-0">
                <p className="text-sm text-muted-foreground">
                  {t('rejectDialog.quickReasons')}
                </p>
                <div className="flex flex-wrap gap-2 min-w-0">
                  {(
                    [
                      'quickReason1',
                      'quickReason2',
                      'quickReason3',
                      'quickReason4',
                      'quickReason5',
                      'quickReason6',
                      'quickReason7',
                      'quickReason8',
                    ] as const
                  ).map((key) => (
                    <Button
                      key={key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="max-w-full whitespace-normal text-left h-auto py-2"
                      onClick={() =>
                        rejectForm.setValue(
                          'reason',
                          t(`rejectDialog.${key}`),
                          { shouldValidate: true }
                        )
                      }
                    >
                      {t(`rejectDialog.${key}`)}
                    </Button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsRejectDialogOpen(false);
                    setRejectingToolId(null);
                    rejectForm.reset();
                  }}
                >
                  {t('rejectDialog.cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={rejectStatus === 'executing'}
                >
                  {rejectStatus === 'executing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('rejectDialog.submitting')}
                    </>
                  ) : (
                    t('rejectDialog.submit')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('viewDialog.title')}</DialogTitle>
            <DialogDescription>{t('viewDialog.description')}</DialogDescription>
          </DialogHeader>
          {viewingTool && (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-1">
                  {t('viewDialog.name')}
                </div>
                <p className="text-sm text-muted-foreground">
                  {viewingTool.name}
                </p>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">
                  {t('viewDialog.url')}
                </div>
                <a
                  href={viewingTool.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  {viewingTool.url}
                  <ExternalLinkIcon className="size-3" />
                </a>
              </div>

              {/* Logo URL */}
              <div>
                <div className="text-sm font-medium mb-2">Logo URL</div>
                {viewingTool.iconUrl ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                      <img
                        src={viewingTool.iconUrl}
                        alt="Logo"
                        className="w-16 h-16 object-contain border rounded"
                      />
                      <a
                        href={viewingTool.iconUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all flex-1"
                      >
                        {viewingTool.iconUrl}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not provided</p>
                )}
              </div>

              {/* Thumbnail URL */}
              <div>
                <div className="text-sm font-medium mb-2">Thumbnail URL</div>
                {viewingTool.thumbnailUrl ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-muted rounded-md">
                      <img
                        src={viewingTool.thumbnailUrl}
                        alt="Thumbnail"
                        className="w-full h-32 object-cover border rounded mb-2"
                      />
                      <a
                        href={viewingTool.thumbnailUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {viewingTool.thumbnailUrl}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not provided</p>
                )}
              </div>

              {/* Screenshot URL */}
              <div>
                <div className="text-sm font-medium mb-2">Screenshot URL</div>
                {viewingTool.imageUrl ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-muted rounded-md">
                      <img
                        src={viewingTool.imageUrl}
                        alt="Screenshot"
                        className="w-full h-48 object-cover border rounded mb-2"
                      />
                      <a
                        href={viewingTool.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline break-all"
                      >
                        {viewingTool.imageUrl}
                      </a>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not provided</p>
                )}
              </div>

              {/* Submitter Info */}
              <div>
                <div className="text-sm font-medium mb-1">
                  {t('columns.submitter')}
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  {viewingTool.userName && <p>Name: {viewingTool.userName}</p>}
                  <p>
                    Email: {viewingTool.userEmail || viewingTool.submitterEmail}
                  </p>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">
                  {t('viewDialog.status')}
                </div>
                <div>{getStatusBadge(viewingTool.status)}</div>
              </div>
              {viewingTool.status === 'rejected' &&
                viewingTool.rejectReason && (
                  <Alert variant="destructive">
                    <AlertCircleIcon className="h-4 w-4" />
                    <AlertDescription>
                      <span className="font-medium">{t('rejectReason')}: </span>
                      {viewingTool.rejectReason}
                    </AlertDescription>
                  </Alert>
                )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              {t('viewDialog.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
