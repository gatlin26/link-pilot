import { useState, useEffect } from 'react';
import { cn } from '@extension/ui';
import type { Submission } from '@extension/shared';
import { submissionStorage } from '@extension/storage';

interface SubmissionTableProps {
  isLight: boolean;
}

export const SubmissionTable = ({ isLight }: SubmissionTableProps) => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const data = await submissionStorage.getAll();
      // 按提交时间倒序
      const sorted = data.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setSubmissions(sorted);
    } catch (error) {
      console.error('加载提交记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const openInNewTab = (url: string) => {
    chrome.tabs.create({ url });
  };

  const getStatusText = (result: Submission['result']) => {
    const map = {
      success: '成功',
      failed: '失败',
      unknown: '待确认',
    };
    return map[result] || result;
  };

  const getStatusColor = (result: Submission['result']) => {
    if (result === 'success') {
      return isLight ? 'bg-green-100 text-green-700' : 'bg-green-900/30 text-green-300';
    }
    if (result === 'failed') {
      return isLight ? 'bg-red-100 text-red-700' : 'bg-red-900/30 text-red-300';
    }
    return isLight ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-900/30 text-yellow-300';
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

  if (submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className={cn('text-sm', isLight ? 'text-gray-600' : 'text-gray-400')}>
          暂无提交记录
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-2 pr-1">
      {submissions.map(sub => (
        <div
          key={sub.id}
          className={cn(
            'p-3 rounded-lg border',
            isLight
              ? 'bg-white border-gray-200'
              : 'bg-gray-800 border-gray-700'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <button
                onClick={() => openInNewTab(sub.page_url)}
                className={cn(
                  'text-sm font-medium hover:underline truncate block',
                  isLight ? 'text-blue-600' : 'text-blue-400'
                )}
              >
                {sub.domain}
              </button>
              <div className={cn(
                'text-xs mt-1',
                isLight ? 'text-gray-500' : 'text-gray-400'
              )}>
                {new Date(sub.created_at).toLocaleDateString('zh-CN')}
              </div>
            </div>
            <span className={cn(
              'text-xs px-2 py-1 rounded whitespace-nowrap flex-shrink-0',
              getStatusColor(sub.result)
            )}>
              {getStatusText(sub.result)}
            </span>
          </div>
          {sub.comment_excerpt && (
            <div className={cn(
              'text-xs mt-2 line-clamp-2',
              isLight ? 'text-gray-600' : 'text-gray-400'
            )}>
              {sub.comment_excerpt}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
