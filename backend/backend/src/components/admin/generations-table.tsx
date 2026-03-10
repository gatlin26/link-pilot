'use client';

import type { GenerationRecord } from '@/actions/get-admin-generations';
import { ImagePreviewDialog } from '@/components/admin/image-preview-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatDate } from '@/lib/formatter';
import { IconCaretDownFilled, IconCaretUpFilled } from '@tabler/icons-react';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ClockIcon,
  EditIcon,
  ImageIcon,
  LoaderIcon,
  MousePointer2Icon,
  SearchIcon,
  WandIcon,
  ZoomInIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface DataTableColumnHeaderProps {
  column: any;
  title: string;
  className?: string;
}

function DataTableColumnHeader({
  column,
  title,
  className,
}: DataTableColumnHeaderProps) {
  const tTable = useTranslations('Common.table');
  if (!column.getCanSort()) {
    return <div className={className}>{title}</div>;
  }

  const isSorted = column.getIsSorted();

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="cursor-pointer flex items-center gap-2 h-8 data-[state=open]:bg-accent"
          >
            {title}
            {isSorted === 'asc' && <IconCaretUpFilled className="h-4 w-4" />}
            {isSorted === 'desc' && <IconCaretDownFilled className="h-4 w-4" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-36">
          <DropdownMenuRadioGroup
            value={isSorted === false ? '' : isSorted}
            onValueChange={(value) => {
              if (value === 'asc') column.toggleSorting(false);
              else if (value === 'desc') column.toggleSorting(true);
            }}
          >
            <DropdownMenuRadioItem value="asc">
              <span className="flex items-center gap-2">
                {tTable('ascending')}
              </span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="desc">
              <span className="flex items-center gap-2">
                {tTable('descending')}
              </span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function TableRowSkeleton({ columns }: { columns: number }) {
  return (
    <TableRow>
      {Array.from({ length: columns }).map((_, index) => (
        <TableCell key={index} className="py-4">
          <div className="flex items-center gap-2 pl-3">
            <Skeleton className="h-6 w-full max-w-32" />
          </div>
        </TableCell>
      ))}
    </TableRow>
  );
}

function ImageThumbnail({
  url,
  onClick,
}: {
  url: string | null;
  onClick: () => void;
}) {
  if (!url) {
    return (
      <div className="flex items-center justify-center size-12 rounded bg-muted">
        <ImageIcon className="size-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative size-12 rounded overflow-hidden border hover:ring-2 hover:ring-primary cursor-pointer transition-all shrink-0"
    >
      <Image
        src={url}
        alt="thumbnail"
        fill
        className="object-cover"
        unoptimized
      />
    </button>
  );
}

// 多图展示组件 - 显示所有图片，每行最多3个
function MultipleImagesThumbnail({
  urls,
  onClick,
}: {
  urls: string[] | null;
  onClick: (url: string) => void;
}) {
  if (!urls || urls.length === 0) {
    return (
      <div className="flex items-center justify-center size-12 rounded bg-muted">
        <ImageIcon className="size-4 text-muted-foreground" />
      </div>
    );
  }

  if (urls.length === 1) {
    return <ImageThumbnail url={urls[0]} onClick={() => onClick(urls[0])} />;
  }

  // 多图展示：显示所有图片，每行最多3个
  return (
    <div className="flex flex-wrap gap-1" style={{ maxWidth: '156px' }}>
      {urls.map((url, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onClick(url)}
          className="relative size-12 rounded overflow-hidden border hover:ring-2 hover:ring-primary cursor-pointer transition-all shrink-0"
        >
          <Image
            src={url}
            alt={`thumbnail-${index}`}
            fill
            className="object-cover"
            unoptimized
          />
        </button>
      ))}
    </div>
  );
}

const statusConfig = {
  pending: { icon: ClockIcon, color: 'text-yellow-500', label: '等待中' },
  processing: { icon: LoaderIcon, color: 'text-blue-500', label: '处理中' },
  completed: {
    icon: CheckCircleIcon,
    color: 'text-green-500',
    label: '已完成',
  },
  failed: { icon: AlertCircleIcon, color: 'text-red-500', label: '失败' },
};

const typeConfig = {
  generate: { icon: WandIcon, label: '生成' },
  enhance: { icon: ImageIcon, label: '增强' },
  edit: { icon: EditIcon, label: '编辑' },
  inpaint: { icon: MousePointer2Icon, label: '重绘' },
  outpaint: { icon: ImageIcon, label: '扩展' },
  upscale: { icon: ZoomInIcon, label: '放大' },
};

interface GenerationsTableProps {
  data: GenerationRecord[];
  total: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  status?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
  sorting?: SortingState;
  loading?: boolean;
  onSearch: (search: string) => void;
  onSearchSubmit?: () => void;
  onStatusChange: (status: string | undefined) => void;
  onTypeChange: (type: string | undefined) => void;
  onDateFromChange: (date: string | undefined) => void;
  onDateToChange: (date: string | undefined) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSortingChange?: (sorting: SortingState) => void;
}

export function GenerationsTable({
  data,
  total,
  pageIndex,
  pageSize,
  search,
  status,
  type,
  dateFrom,
  dateTo,
  sorting = [{ id: 'createdAt', desc: true }],
  loading,
  onSearch,
  onStatusChange,
  onTypeChange,
  onDateFromChange,
  onDateToChange,
  onPageChange,
  onPageSizeChange,
  onSortingChange,
}: GenerationsTableProps) {
  const t = useTranslations('Dashboard.admin.generations');
  const tTable = useTranslations('Common.table');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [searchInput, setSearchInput] = useState(search);

  // 同步 search prop 到本地状态
  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  // 创建稳定的预览回调函数
  const handlePreviewInput = useCallback((url: string) => {
    setPreviewImage({ url, title: '输入图片' });
  }, []);

  const handlePreviewOutput = useCallback((url: string) => {
    setPreviewImage({ url, title: '输出图片' });
  }, []);

  const columnIdToTranslationKey = useMemo(
    () =>
      ({
        userEmail: 'columns.user' as const,
        type: 'columns.type' as const,
        status: 'columns.status' as const,
        prompt: 'columns.prompt' as const,
        model: 'columns.model' as const,
        inputImage: 'columns.inputImage' as const,
        outputImage: 'columns.outputImage' as const,
        creditsUsed: 'columns.credits' as const,
        createdAt: 'columns.createdAt' as const,
        errorMessage: 'columns.error' as const,
      }) as const,
    []
  );

  const columns: ColumnDef<GenerationRecord>[] = useMemo(
    () => [
      {
        accessorKey: 'userEmail',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('columns.user')} />
        ),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="text-xs px-1.5 cursor-pointer hover:bg-accent max-w-[140px] truncate"
                    onClick={() => {
                      if (record.userEmail) {
                        navigator.clipboard.writeText(record.userEmail);
                        toast.success('邮箱已复制');
                      }
                    }}
                  >
                    {record.userEmail || '-'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{record.userName || '未知用户'}</p>
                  <p className="text-xs text-muted-foreground">
                    {record.userEmail}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
        minSize: 140,
        size: 160,
      },
      {
        accessorKey: 'type',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('columns.type')} />
        ),
        cell: ({ row }) => {
          const record = row.original;
          const config = typeConfig[record.type as keyof typeof typeConfig];
          const Icon = config?.icon || ImageIcon;
          return (
            <div className="flex items-center gap-2 pl-3">
              <Badge variant="outline" className="px-1.5">
                <Icon className="size-3" />
                {config?.label || record.type}
              </Badge>
            </div>
          );
        },
        minSize: 80,
        size: 100,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('columns.status')} />
        ),
        cell: ({ row }) => {
          const record = row.original;
          const config =
            statusConfig[record.status as keyof typeof statusConfig];
          const Icon = config?.icon || ClockIcon;
          return (
            <div className="flex items-center gap-2 pl-3">
              <Badge
                variant="outline"
                className={`px-1.5 ${config?.color || ''}`}
              >
                <Icon
                  className={`size-3 ${record.status === 'processing' ? 'animate-spin' : ''}`}
                />
                {config?.label || record.status}
              </Badge>
            </div>
          );
        },
        minSize: 90,
        size: 110,
      },
      {
        accessorKey: 'prompt',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('columns.prompt')} />
        ),
        cell: ({ row }) => {
          const record = row.original;
          if (!record.prompt) {
            return <span className="pl-3 text-muted-foreground">-</span>;
          }
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="pl-3 max-w-[200px] truncate block cursor-help">
                    {record.prompt}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <p className="whitespace-pre-wrap">{record.prompt}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
        minSize: 150,
        size: 200,
      },
      {
        accessorKey: 'model',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('columns.model')} />
        ),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <span className="pl-3 text-xs text-muted-foreground">
              {record.model || '-'}
            </span>
          );
        },
        minSize: 100,
        size: 120,
      },
      {
        id: 'inputImage',
        header: () => <span className="pl-3">{t('columns.inputImage')}</span>,
        cell: ({ row }) => {
          const record = row.original;
          // 解析 inputImageUrls JSON 字符串
          let inputUrls: string[] | null = null;
          if (record.inputImageUrls) {
            try {
              const parsed = JSON.parse(record.inputImageUrls);
              if (Array.isArray(parsed) && parsed.length > 0) {
                inputUrls = parsed;
              }
            } catch {
              // 解析失败，使用 inputUrl
            }
          }
          // 如果没有 inputImageUrls，使用 inputUrl
          if (!inputUrls && record.inputUrl) {
            inputUrls = [record.inputUrl];
          }

          return (
            <div className="pl-3">
              <MultipleImagesThumbnail
                urls={inputUrls}
                onClick={handlePreviewInput}
              />
            </div>
          );
        },
        minSize: 80,
        size: 120,
      },
      {
        id: 'outputImage',
        header: () => <span className="pl-3">{t('columns.outputImage')}</span>,
        cell: ({ row }) => {
          const record = row.original;
          return (
            <div className="pl-3">
              <ImageThumbnail
                url={record.outputUrl}
                onClick={() => {
                  if (record.outputUrl) {
                    handlePreviewOutput(record.outputUrl);
                  }
                }}
              />
            </div>
          );
        },
        minSize: 80,
        size: 90,
      },
      {
        accessorKey: 'creditsUsed',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('columns.credits')} />
        ),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <span className="pl-3 font-mono text-sm">
              {record.creditsUsed || 0}
            </span>
          );
        },
        minSize: 70,
        size: 80,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={t('columns.createdAt')}
          />
        ),
        cell: ({ row }) => {
          const record = row.original;
          return (
            <span className="pl-3 text-xs">
              {record.createdAt ? formatDate(record.createdAt) : '-'}
            </span>
          );
        },
        minSize: 140,
        size: 160,
      },
      {
        accessorKey: 'errorMessage',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('columns.error')} />
        ),
        cell: ({ row }) => {
          const record = row.original;
          if (!record.errorMessage) {
            return <span className="pl-3 text-muted-foreground">-</span>;
          }
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="pl-3 text-red-500 max-w-[100px] truncate block cursor-help">
                    {record.errorMessage}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <p className="text-red-500 whitespace-pre-wrap">
                    {record.errorMessage}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
        minSize: 100,
        size: 120,
      },
    ],
    [t, handlePreviewInput, handlePreviewOutput]
  );

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(total / pageSize),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange?.(next);
    },
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize })
          : updater;
      if (next.pageIndex !== pageIndex) onPageChange(next.pageIndex);
      if (next.pageSize !== pageSize) onPageSizeChange(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
  });

  return (
    <div className="w-full flex-col justify-start gap-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSearch(searchInput);
                onPageChange(0);
              }
            }}
            className="max-w-[200px]"
          />
          <Button
            size="icon"
            variant="outline"
            onClick={() => {
              onSearch(searchInput);
              onPageChange(0);
            }}
            className="shrink-0"
          >
            <SearchIcon className="size-4" />
          </Button>
        </div>

        <Select
          value={status || 'all'}
          onValueChange={(value) => {
            onStatusChange(value === 'all' ? undefined : value);
            onPageChange(0);
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allStatus')}</SelectItem>
            <SelectItem value="pending">{t('filters.pending')}</SelectItem>
            <SelectItem value="processing">
              {t('filters.processing')}
            </SelectItem>
            <SelectItem value="completed">{t('filters.completed')}</SelectItem>
            <SelectItem value="failed">{t('filters.failed')}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={type || 'all'}
          onValueChange={(value) => {
            onTypeChange(value === 'all' ? undefined : value);
            onPageChange(0);
          }}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder={t('filters.type')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.allType')}</SelectItem>
            <SelectItem value="generate">{t('filters.generate')}</SelectItem>
            <SelectItem value="enhance">{t('filters.enhance')}</SelectItem>
            <SelectItem value="edit">{t('filters.edit')}</SelectItem>
            <SelectItem value="inpaint">{t('filters.inpaint')}</SelectItem>
            <SelectItem value="outpaint">{t('filters.outpaint')}</SelectItem>
            <SelectItem value="upscale">{t('filters.upscale')}</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <Input
            type="date"
            value={dateFrom || ''}
            onChange={(e) => {
              onDateFromChange(e.target.value || undefined);
              onPageChange(0);
            }}
            className="w-[140px]"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="date"
            value={dateTo || ''}
            onChange={(e) => {
              onDateToChange(e.target.value || undefined);
              onPageChange(0);
            }}
            className="w-[140px]"
          />
        </div>

        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                <span>{t('columns.columns')}</span>
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize cursor-pointer"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {t(
                        columnIdToTranslationKey[
                          column.id as keyof typeof columnIdToTranslationKey
                        ] || 'columns.columns'
                      )}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Table */}
      <div className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, index) => (
                  <TableRowSkeleton key={index} columns={columns.length} />
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {tTable('noResults')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4">
          <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
            {t('totalRecords', { count: total })}
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                {tTable('rowsPerPage')}
              </Label>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  onPageSizeChange(Number(value));
                  onPageChange(0);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="w-20 cursor-pointer"
                  id="rows-per-page"
                >
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 50, 100].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              {tTable('page')} {pageIndex + 1} {' / '}
              {Math.max(1, Math.ceil(total / pageSize))}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="cursor-pointer hidden h-8 w-8 p-0 lg:flex"
                onClick={() => onPageChange(0)}
                disabled={pageIndex === 0}
              >
                <span className="sr-only">{tTable('firstPage')}</span>
                <ChevronsLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer size-8"
                size="icon"
                onClick={() => onPageChange(pageIndex - 1)}
                disabled={pageIndex === 0}
              >
                <span className="sr-only">{tTable('previousPage')}</span>
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer size-8"
                size="icon"
                onClick={() => onPageChange(pageIndex + 1)}
                disabled={pageIndex + 1 >= Math.ceil(total / pageSize)}
              >
                <span className="sr-only">{tTable('nextPage')}</span>
                <ChevronRightIcon />
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer hidden size-8 lg:flex"
                size="icon"
                onClick={() =>
                  onPageChange(Math.max(0, Math.ceil(total / pageSize) - 1))
                }
                disabled={pageIndex + 1 >= Math.ceil(total / pageSize)}
              >
                <span className="sr-only">{tTable('lastPage')}</span>
                <ChevronsRightIcon />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Dialog */}
      <ImagePreviewDialog
        open={!!previewImage}
        onOpenChange={(open) => !open && setPreviewImage(null)}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
      />
    </div>
  );
}
