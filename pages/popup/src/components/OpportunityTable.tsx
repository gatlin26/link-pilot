import { useState, useEffect } from 'react';
import { cn } from '@extension/ui';
import type { Opportunity } from '@extension/shared';
import { opportunityStorage } from '@extension/storage';

interface OpportunityTableProps {
  isLight: boolean;
}

export const OpportunityTable = ({ isLight }: OpportunityTableProps) => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    try {
      setLoading(true);
      const data = await opportunityStorage.getAll();
      // 只显示未提交的
      const pending = data.filter(item => item.status === 'new');
      setOpportunities(pending);
    } catch (error) {
      console.error('加载外链机会失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === opportunities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(opportunities.map(o => o.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      for (const id of selectedIds) {
        await opportunityStorage.delete(id);
      }
      setSelectedIds(new Set());
      await loadOpportunities();
    } catch (error) {
      console.error('删除失败:', error);
    }
  };

  const openInNewTab = (url: string) => {
    chrome.tabs.create({ url });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
          加载中...
        </div>
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
          暂无收集记录
        </div>
        <div className={cn('text-xs mt-1', isLight ? 'text-gray-500' : 'text-gray-500')}>
          在 Ahrefs 页面使用收集功能
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* 操作栏 */}
      <div className="flex-shrink-0 flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedIds.size === opportunities.length}
            onChange={toggleSelectAll}
            className="rounded"
          />
          <span className={cn('text-xs', isLight ? 'text-gray-600' : 'text-gray-400')}>
            已选 {selectedIds.size} / {opportunities.length}
          </span>
        </div>
        {selectedIds.size > 0 && (
          <button
            onClick={handleDelete}
            className={cn(
              'text-xs px-2 py-1 rounded',
              isLight
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-red-900/30 text-red-300 hover:bg-red-900/50'
            )}
          >
            删除
          </button>
        )}
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {opportunities.map(opp => (
          <div
            key={opp.id}
            className={cn(
              'p-3 rounded-lg border',
              isLight
                ? 'bg-white border-gray-200'
                : 'bg-gray-800 border-gray-700'
            )}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selectedIds.has(opp.id)}
                onChange={() => toggleSelect(opp.id)}
                className="mt-1 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    onClick={() => openInNewTab(opp.url)}
                    className={cn(
                      'text-sm font-medium hover:underline truncate',
                      isLight ? 'text-blue-600' : 'text-blue-400'
                    )}
                  >
                    {opp.domain}
                  </button>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded flex-shrink-0',
                    isLight ? 'bg-gray-100 text-gray-600' : 'bg-gray-700 text-gray-300'
                  )}>
                    {opp.link_type}
                  </span>
                </div>
                <div className={cn(
                  'text-xs mt-1 line-clamp-2',
                  isLight ? 'text-gray-500' : 'text-gray-400'
                )}>
                  {opp.site_summary || '无摘要'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
