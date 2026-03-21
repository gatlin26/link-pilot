/**
 * 网站统计卡片组件
 * 显示网站的外链统计信息
 */

import { useState, useEffect } from 'react';
import type { WebsiteProfile, WebsiteBacklinkStats } from '@extension/shared';
import { backlinkSubmissionStorage } from '@extension/storage';
import { cn } from '@extension/ui';

interface WebsiteStatsCardProps {
  profile: WebsiteProfile;
  onViewDetails: () => void;
  onEdit: () => void;
  isLight?: boolean;
}

export function WebsiteStatsCard({
  profile,
  onViewDetails,
  onEdit,
  isLight = true,
}: WebsiteStatsCardProps) {
  const [stats, setStats] = useState<WebsiteBacklinkStats>({
    total_backlinks: 0,
    submitted_count: 0,
    approved_count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    // 监听 storage 变化，实时更新统计
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes['backlink-submissions-key']) {
        console.log('[WebsiteStatsCard] 检测到提交记录变化，重新加载统计');
        loadStats();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [profile.id]);

  const loadStats = async () => {
    try {
      const data = await backlinkSubmissionStorage.getWebsiteStats(profile.id);
      setStats(data);
    } catch (error) {
      console.error('加载统计失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const pendingSubmit = stats.total_backlinks - stats.submitted_count;
  const pendingApproval = stats.submitted_count - stats.approved_count;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border',
        isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
      )}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={cn('font-semibold truncate', isLight ? 'text-gray-900' : 'text-gray-100')}>
            {profile.name}
          </h3>
          <p className={cn('text-xs truncate', isLight ? 'text-gray-500' : 'text-gray-400')}>
            {profile.domain}
          </p>
        </div>
        <span
          className={cn(
            'px-2 py-1 rounded text-xs flex-shrink-0 ml-2',
            profile.enabled
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          )}
        >
          {profile.enabled ? '已启用' : '已禁用'}
        </span>
      </div>

      {/* 统计数据 */}
      {loading ? (
        <div className="py-4 text-center text-sm text-gray-500">加载中...</div>
      ) : (
        <>
          <div className={cn('p-3 rounded-lg mb-3', isLight ? 'bg-gray-50' : 'bg-gray-900/50')}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={cn('text-2xl font-bold', isLight ? 'text-gray-900' : 'text-gray-100')}>
                  {stats.total_backlinks}
                </div>
                <div className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  外链总数
                </div>
              </div>
              <div>
                <div className={cn('text-2xl font-bold text-blue-600', isLight ? '' : 'text-blue-400')}>
                  {stats.submitted_count}
                </div>
                <div className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  已提交
                </div>
              </div>
              <div>
                <div className={cn('text-2xl font-bold text-green-600', isLight ? '' : 'text-green-400')}>
                  {stats.approved_count}
                </div>
                <div className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  已审核
                </div>
              </div>
              <div>
                <div className={cn('text-2xl font-bold text-orange-600', isLight ? '' : 'text-orange-400')}>
                  {pendingSubmit}
                </div>
                <div className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  待提交
                </div>
              </div>
            </div>

            {pendingApproval > 0 && (
              <div className={cn('mt-2 pt-2 border-t', isLight ? 'border-gray-200' : 'border-gray-700')}>
                <div className={cn('text-xs', isLight ? 'text-gray-500' : 'text-gray-400')}>
                  待审核: <span className="font-semibold">{pendingApproval}</span>
                </div>
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={onViewDetails}
              className={cn(
                'flex-1 py-2 rounded text-sm font-medium transition-colors',
                isLight
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              )}
            >
              查看明细
            </button>
            <button
              onClick={onEdit}
              className={cn(
                'px-4 py-2 rounded text-sm font-medium transition-colors',
                isLight
                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
              )}
            >
              编辑
            </button>
          </div>
        </>
      )}
    </div>
  );
}
