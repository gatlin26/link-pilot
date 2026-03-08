import { useEffect, useState } from 'react';
import { cn } from '@extension/ui';
import { collectionBatchStorage } from '@extension/storage';
import type { CollectionBatch } from '@extension/shared/lib/types/models';

interface BatchResultProps {
  isLight: boolean;
}

export function BatchResult({ isLight }: BatchResultProps) {
  const [recentBatches, setRecentBatches] = useState<CollectionBatch[]>([]);

  useEffect(() => {
    const loadRecentBatches = async () => {
      const batches = await collectionBatchStorage.getRecent(3);
      setRecentBatches(batches);
    };

    loadRecentBatches();

    // 监听存储变化
    const unsubscribe = collectionBatchStorage.subscribe(() => {
      loadRecentBatches();
    });

    return unsubscribe;
  }, []);

  if (recentBatches.length === 0) {
    return null;
  }

  const getSyncStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '待同步';
      case 'syncing':
        return '同步中';
      case 'synced':
        return '已同步';
      case 'failed':
        return '同步失败';
      default:
        return status;
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return isLight ? 'text-gray-600' : 'text-gray-400';
      case 'syncing':
        return isLight ? 'text-blue-600' : 'text-blue-400';
      case 'synced':
        return isLight ? 'text-green-600' : 'text-green-400';
      case 'failed':
        return isLight ? 'text-red-600' : 'text-red-400';
      default:
        return isLight ? 'text-gray-600' : 'text-gray-400';
    }
  };

  return (
    <div className={cn(
      'rounded-lg p-4',
      isLight ? 'bg-gray-50' : 'bg-gray-800'
    )}>
      <h3 className={cn(
        'text-sm font-medium mb-3',
        isLight ? 'text-gray-700' : 'text-gray-300'
      )}>
        最近收集
      </h3>
      <div className="space-y-2">
        {recentBatches.map((batch) => (
          <div
            key={batch.id}
            className={cn(
              'rounded p-3 text-sm',
              isLight ? 'bg-white border border-gray-200' : 'bg-gray-700 border border-gray-600'
            )}
          >
            <div className="flex justify-between items-start mb-1">
              <span className={cn(
                'font-medium',
                isLight ? 'text-gray-900' : 'text-gray-100'
              )}>
                {batch.count} 条外链
              </span>
              <span className={cn(
                'text-xs font-medium',
                getSyncStatusColor(batch.sync_status)
              )}>
                {getSyncStatusText(batch.sync_status)}
              </span>
            </div>
            <div className={cn(
              'text-xs',
              isLight ? 'text-gray-500' : 'text-gray-400'
            )}>
              {new Date(batch.collected_at).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            {batch.sync_status === 'synced' && batch.synced_count > 0 && (
              <div className={cn(
                'text-xs mt-1',
                isLight ? 'text-green-600' : 'text-green-400'
              )}>
                已同步 {batch.synced_count}/{batch.count}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
