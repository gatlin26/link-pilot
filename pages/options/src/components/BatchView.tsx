import React from 'react';
import type { CollectedBacklink } from '@extension/shared';

interface BatchViewProps {
  backlinks: CollectedBacklink[];
}

interface BatchGroup {
  batchId: string;
  backlinks: CollectedBacklink[];
  collectedAt: string;
}

export const BatchView: React.FC<BatchViewProps> = ({ backlinks }) => {
  const [expandedBatches, setExpandedBatches] = React.useState<Set<string>>(new Set());

  const batches = React.useMemo(() => {
    const batchMap = new Map<string, CollectedBacklink[]>();

    backlinks.forEach(backlink => {
      const batchId = backlink.collection_batch_id;
      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, []);
      }
      batchMap.get(batchId)!.push(backlink);
    });

    const batchGroups: BatchGroup[] = [];
    batchMap.forEach((backlinks, batchId) => {
      batchGroups.push({
        batchId,
        backlinks,
        collectedAt: backlinks[0]?.collected_at || '',
      });
    });

    // 按收集时间倒序排序
    batchGroups.sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));

    return batchGroups;
  }, [backlinks]);

  const toggleBatch = (batchId: string) => {
    const newExpanded = new Set(expandedBatches);
    if (newExpanded.has(batchId)) {
      newExpanded.delete(batchId);
    } else {
      newExpanded.add(batchId);
    }
    setExpandedBatches(newExpanded);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN');
  };

  const getStatusStats = (backlinks: CollectedBacklink[]) => {
    const stats: Record<string, number> = {};
    backlinks.forEach(b => {
      stats[b.status] = (stats[b.status] || 0) + 1;
    });
    return stats;
  };

  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        暂无批次数据
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {batches.map(batch => {
        const isExpanded = expandedBatches.has(batch.batchId);
        const stats = getStatusStats(batch.backlinks);

        return (
          <div key={batch.batchId} className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div
              className="p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
              onClick={() => toggleBatch(batch.batchId)}
            >
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">批次 {batch.batchId.slice(0, 8)}</span>
                    <span className="text-sm text-gray-500">
                      {formatDate(batch.collectedAt)}
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-gray-600">共 {batch.backlinks.length} 条</span>
                    {Object.entries(stats).map(([status, count]) => (
                      <span key={status} className="text-gray-600">
                        {status}: {count}
                      </span>
                    ))}
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t dark:border-gray-700 p-4">
                <div className="space-y-2">
                  {batch.backlinks.map(backlink => (
                    <div key={backlink.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium mb-1">{backlink.page_title}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {backlink.referring_page_url}
                          </p>
                        </div>
                        <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {backlink.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
