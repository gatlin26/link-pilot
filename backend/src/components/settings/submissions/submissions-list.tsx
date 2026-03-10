'use client';

import { getSubmissionAction } from '@/actions/tools/get-submission';
import { getUserSubmissionsAction } from '@/actions/tools/get-user-submissions';
import { updateSubmissionAction } from '@/actions/tools/update-submission';
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
  FormDescription,
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
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  EditIcon,
  ExternalLinkIcon,
  Loader2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAction } from 'next-safe-action/hooks';
import { useSearchParams } from 'next/navigation';
import { parseAsIndex, parseAsInteger, useQueryStates } from 'nuqs';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

type ToolStatus = 'unpaid' | 'pending' | 'published' | 'rejected';

interface Submission {
  id: string;
  name: string;
  url: string;
  slug: string;
  status: ToolStatus;
  rejectReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const editFormSchema = z.object({
  name: z.string().min(2, 'Tool name must be at least 2 characters'),
  url: z.string().url('Please enter a valid URL'),
  iconUrl: z.string().url().optional().nullable(),
  thumbnailUrl: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
});

type EditFormData = z.infer<typeof editFormSchema>;

export function SubmissionsList() {
  const t = useTranslations('Dashboard.settings.submissions');
  const searchParams = useSearchParams();
  const hasCheckoutSession = !!searchParams.get('session_id');
  const [statusFilter, setStatusFilter] = useState<ToolStatus | 'all'>('all');
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const [{ page, pageSize }, setQueryStates] = useQueryStates(
    {
      page: parseAsIndex.withDefault(0),
      pageSize: parseAsInteger.withDefault(10),
    },
    {
      shallow: true,
      history: 'replace',
    }
  );

  const { execute, result, status } = useAction(getUserSubmissionsAction);
  const { execute: getSubmission, result: submissionResult } =
    useAction(getSubmissionAction);
  const {
    execute: updateSubmission,
    result: updateResult,
    status: updateStatus,
  } = useAction(updateSubmissionAction);

  const form = useForm<EditFormData>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      name: '',
      url: '',
      iconUrl: '',
      thumbnailUrl: '',
      imageUrl: '',
    },
  });

  useEffect(() => {
    execute({
      pageIndex: page,
      pageSize,
      status: statusFilter,
    });
  }, [page, pageSize, statusFilter, execute]);

  // 当编辑对话框打开时，获取提交详情
  useEffect(() => {
    if (isEditDialogOpen && editingToolId) {
      getSubmission({ toolId: editingToolId });
    }
  }, [isEditDialogOpen, editingToolId, getSubmission]);

  // 当获取到提交详情时，填充表单
  useEffect(() => {
    if (submissionResult?.data?.data) {
      const submission = submissionResult.data.data;
      form.reset({
        name: submission.name,
        url: submission.url,
        iconUrl: submission.iconUrl || '',
        thumbnailUrl: submission.thumbnailUrl || '',
        imageUrl: submission.imageUrl || '',
      });
    }
  }, [submissionResult, form]);

  // 更新成功后刷新列表并关闭对话框
  useEffect(() => {
    if (updateResult?.data?.success) {
      setIsEditDialogOpen(false);
      setEditingToolId(null);
      form.reset();
      execute({
        pageIndex: page,
        pageSize,
        status: statusFilter,
      });
    }
  }, [updateResult, execute, page, pageSize, statusFilter, form]);

  const submissions = result?.data?.data?.items || [];
  const total = result?.data?.data?.total || 0;
  const isLoading = status === 'executing';

  const handleEdit = (toolId: string) => {
    setEditingToolId(toolId);
    setIsEditDialogOpen(true);
  };

  const handleEditSubmit = async (data: EditFormData) => {
    if (!editingToolId) return;
    updateSubmission({
      toolId: editingToolId,
      ...data,
    });
  };

  const getStatusBadge = (status: ToolStatus) => {
    switch (status) {
      case 'unpaid':
        return (
          <Badge
            variant="outline"
            className="bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
          >
            {t('status.unpaid')}
          </Badge>
        );
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

  return (
    <div className="space-y-4">
      {/* Payment + submission success alert */}
      {hasCheckoutSession && (
        <Alert className="border border-green-500/60 bg-green-50 dark:bg-green-900/20">
          <AlertDescription>{t('successAfterPayment' as any)}</AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value as ToolStatus | 'all');
              setQueryStates({ page: 0 });
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('filter.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filter.all')}</SelectItem>
              <SelectItem value="unpaid">{t('status.unpaid')}</SelectItem>
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
              <TableHead>{t('columns.status')}</TableHead>
              <TableHead>{t('columns.submittedAt')}</TableHead>
              <TableHead>{t('columns.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : submissions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              submissions.map((submission) => {
                const typedSubmission: Submission = {
                  ...submission,
                  status: submission.status as ToolStatus,
                };
                return (
                  <TableRow key={typedSubmission.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col gap-1">
                        <span>{typedSubmission.name}</span>
                        {typedSubmission.status === 'rejected' &&
                          typedSubmission.rejectReason && (
                            <Alert className="py-2 px-3 mt-1">
                              <AlertCircleIcon className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                <span className="font-medium">
                                  {t('rejectReason')}:{' '}
                                </span>
                                {typedSubmission.rejectReason}
                              </AlertDescription>
                            </Alert>
                          )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={typedSubmission.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline max-w-xs"
                        title={typedSubmission.url}
                      >
                        <span className="truncate">{typedSubmission.url}</span>
                        <ExternalLinkIcon className="size-3 flex-shrink-0" />
                      </a>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(typedSubmission.status)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(typedSubmission.createdAt)}
                    </TableCell>
                    <TableCell>
                      {(typedSubmission.status === 'rejected' ||
                        typedSubmission.status === 'pending' ||
                        typedSubmission.status === 'unpaid') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(typedSubmission.id)}
                        >
                          <EditIcon className="size-4 mr-2" />
                          {t('edit')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('editDialog.title')}</DialogTitle>
            <DialogDescription>{t('editDialog.description')}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('editDialog.name')} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('editDialog.url')} *</FormLabel>
                    <FormControl>
                      <Input type="url" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Logo Preview */}
              {form.watch('iconUrl') && (
                <div className="space-y-2">
                  <FormLabel>{t('editDialog.logo')}</FormLabel>
                  <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
                    <img
                      src={form.watch('iconUrl') || ''}
                      alt="Logo"
                      className="size-16 object-contain rounded-lg bg-background"
                    />
                  </div>
                </div>
              )}

              {/* Screenshot Preview */}
              {form.watch('thumbnailUrl') && (
                <div className="space-y-2">
                  <FormLabel>{t('editDialog.screenshot')}</FormLabel>
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <img
                      src={form.watch('thumbnailUrl') || ''}
                      alt="Screenshot"
                      className="w-full rounded-lg border"
                    />
                  </div>
                </div>
              )}

              {updateResult?.serverError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {typeof updateResult.serverError === 'string'
                      ? updateResult.serverError
                      : (updateResult.serverError as { error?: string })
                          ?.error || 'An error occurred'}
                  </AlertDescription>
                </Alert>
              )}
              {updateResult?.data?.success && (
                <Alert>
                  <AlertDescription>
                    {updateResult.data.message}
                  </AlertDescription>
                </Alert>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingToolId(null);
                    form.reset();
                  }}
                >
                  {t('editDialog.cancel')}
                </Button>
                <Button type="submit" disabled={updateStatus === 'executing'}>
                  {updateStatus === 'executing' ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('editDialog.submitting')}
                    </>
                  ) : (
                    t('editDialog.submit')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
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
