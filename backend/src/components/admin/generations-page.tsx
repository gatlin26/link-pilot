'use client';

import { GenerationsTable } from '@/components/admin/generations-table';
import { useAdminGenerations } from '@/hooks/use-admin-generations';
import type { SortingState } from '@tanstack/react-table';
import {
  parseAsIndex,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from 'nuqs';
import { useMemo } from 'react';

export function GenerationsPageClient() {
  const [
    {
      page,
      pageSize,
      search,
      status,
      type,
      dateFrom,
      dateTo,
      sortId,
      sortDesc,
    },
    setQueryStates,
  ] = useQueryStates({
    page: parseAsIndex.withDefault(0),
    pageSize: parseAsInteger.withDefault(20),
    search: parseAsString.withDefault(''),
    status: parseAsString,
    type: parseAsString,
    dateFrom: parseAsString,
    dateTo: parseAsString,
    sortId: parseAsString.withDefault('createdAt'),
    sortDesc: parseAsInteger.withDefault(1),
  });

  const sorting: SortingState = useMemo(
    () => [{ id: sortId, desc: Boolean(sortDesc) }],
    [sortId, sortDesc]
  );

  const { data, isLoading } = useAdminGenerations({
    pageIndex: page,
    pageSize,
    search,
    status: status as
      | 'pending'
      | 'processing'
      | 'completed'
      | 'failed'
      | undefined,
    type: type as
      | 'generate'
      | 'enhance'
      | 'edit'
      | 'inpaint'
      | 'outpaint'
      | 'upscale'
      | undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sorting,
  });

  return (
    <GenerationsTable
      data={data?.items || []}
      total={data?.total || 0}
      pageIndex={page}
      pageSize={pageSize}
      search={search}
      status={status || undefined}
      type={type || undefined}
      dateFrom={dateFrom || undefined}
      dateTo={dateTo || undefined}
      sorting={sorting}
      loading={isLoading}
      onSearch={(newSearch) => setQueryStates({ search: newSearch, page: 0 })}
      onStatusChange={(newStatus) =>
        setQueryStates({ status: newStatus || null, page: 0 })
      }
      onTypeChange={(newType) =>
        setQueryStates({ type: newType || null, page: 0 })
      }
      onDateFromChange={(newDateFrom) =>
        setQueryStates({ dateFrom: newDateFrom || null, page: 0 })
      }
      onDateToChange={(newDateTo) =>
        setQueryStates({ dateTo: newDateTo || null, page: 0 })
      }
      onPageChange={(newPageIndex) => setQueryStates({ page: newPageIndex })}
      onPageSizeChange={(newPageSize) =>
        setQueryStates({ pageSize: newPageSize, page: 0 })
      }
      onSortingChange={(newSorting) => {
        if (newSorting.length > 0) {
          setQueryStates({
            sortId: newSorting[0].id,
            sortDesc: newSorting[0].desc ? 1 : 0,
          });
        }
      }}
    />
  );
}
