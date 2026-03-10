import { getImageHistoryAction } from '@/actions/get-image-history';
import { useQuery } from '@tanstack/react-query';

export const imageHistoryKeys = {
  all: ['imageHistory'] as const,
  list: (filters: { pageIndex: number; pageSize: number }) =>
    [...imageHistoryKeys.all, 'list', filters] as const,
};

export function useImageHistory(pageIndex: number, pageSize: number) {
  return useQuery({
    queryKey: imageHistoryKeys.list({ pageIndex, pageSize }),
    queryFn: async () => {
      const result = await getImageHistoryAction({ pageIndex, pageSize });

      if (!result?.data?.success) {
        throw new Error(result?.data?.error || 'Failed to fetch image history');
      }

      return {
        items: result.data.data?.items || [],
        total: result.data.data?.total || 0,
      };
    },
  });
}
