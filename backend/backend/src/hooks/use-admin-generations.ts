import { getAdminGenerationsAction } from '@/actions/get-admin-generations';
import { useQuery } from '@tanstack/react-query';
import type { SortingState } from '@tanstack/react-table';

export interface GenerationsFilters {
  pageIndex: number;
  pageSize: number;
  search: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  type?: 'generate' | 'enhance' | 'edit' | 'inpaint' | 'outpaint' | 'upscale';
  dateFrom?: string;
  dateTo?: string;
  sorting: SortingState;
}

export const adminGenerationsKeys = {
  all: ['admin-generations'] as const,
  lists: () => [...adminGenerationsKeys.all, 'lists'] as const,
  list: (filters: GenerationsFilters) =>
    [...adminGenerationsKeys.lists(), filters] as const,
};

export function useAdminGenerations(filters: GenerationsFilters) {
  return useQuery({
    queryKey: adminGenerationsKeys.list(filters),
    queryFn: async () => {
      // Convert empty strings to undefined for optional fields
      const actionInput = {
        pageIndex: filters.pageIndex,
        pageSize: filters.pageSize,
        search: filters.search,
        status: filters.status || undefined,
        type: filters.type || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        sorting: filters.sorting,
      };

      console.log(
        '[useAdminGenerations] Action input:',
        JSON.stringify(actionInput, null, 2)
      );

      const result = await getAdminGenerationsAction(actionInput);

      console.log('[useAdminGenerations] Result:', result);

      // Check for server errors from safe-action
      if (result?.serverError) {
        console.error(
          '[useAdminGenerations] Server error:',
          result.serverError
        );
        // serverError can be either string or object with error property
        const errorMessage =
          typeof result.serverError === 'string'
            ? result.serverError
            : (result.serverError as { error?: string })?.error ||
              'Server error occurred';
        throw new Error(errorMessage);
      }

      // Check for validation errors
      if (result?.validationErrors) {
        console.error(
          '[useAdminGenerations] Validation errors:',
          JSON.stringify(result.validationErrors, null, 2)
        );
        throw new Error(
          `Validation failed: ${JSON.stringify(result.validationErrors)}`
        );
      }

      // Check if action returned success
      if (!result?.data?.success) {
        const errorMsg = result?.data?.error || 'Failed to fetch generations';
        console.error('[useAdminGenerations] Action error:', errorMsg);
        throw new Error(errorMsg);
      }

      const data = {
        items: result.data.data?.items || [],
        total: result.data.data?.total || 0,
      };
      console.log('[useAdminGenerations] Returning data:', data);
      return data;
    },
  });
}
