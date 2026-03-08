import { useState, useEffect } from 'react';
import { cn } from '@extension/ui';
import { opportunityStorage } from '@extension/storage';
import type { Opportunity } from '@extension/shared';

interface ManualCollectorProps {
  isLight: boolean;
}

export const ManualCollector = ({ isLight }: ManualCollectorProps) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(true);

  useEffect(() => {
    loadOpportunities();
  }, []);

  const loadOpportunities = async () => {
    try {
      setLoadingOpportunities(true);
      const data = await opportunityStorage.getAll();
      setOpportunities(data);
    } catch (err) {
      console.error('加载外链失败:', err);
    } finally {
      setLoadingOpportunities(false);
    }
  };

  const handleCollect = async () => {
    if (!targetUrl.trim()) {
      setResult({ success: false, message: '请输入目标网站' });
      return;
    }

    // 验证 URL 格式
    try {
      new URL(targetUrl);
    } catch {
      setResult({ success: false, message: 'URL 格式不正确' });
      return;
    }

    setIsCollecting(true);
    setResult(null);

    try {
      // 发送消息到 background 开始采集
      const response = await chrome.runtime.sendMessage({
        type: 'START_MANUAL_COLLECTION',
        payload: { targetUrl },
      });

      if (response?.success) {
        setResult({
          success: true,
          message: `成功采集 ${response.count || 0} 条外链机会`,
        });
        setTargetUrl('');
        // 重新加载列表
        await loadOpportunities();
      } else {
        setResult({
          success: false,
          message: response?.error || '采集失败',
        });
      }
    } catch (error) {
      console.error('采集失败:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '采集失败',
      });
    } finally {
      setIsCollecting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await opportunityStorage.delete(id);
      await loadOpportunities();
    } catch (err) {
      console.error('删除失败:', err);
    }
  };

  const handleOpenUrl = (url: string) => {
    chrome.tabs.create({ url });
  };

  return (
    <div className="space-y-4">
      {/* 已采集的外链列表 */}
      <div className={cn(
        'rounded-lg border p-4',
        isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={cn('text-sm font-semibold', isLight ? 'text-gray-900' : 'text-gray-100')}>
            已采集外链 ({opportunities.length})
          </h3>
          <button
            onClick={loadOpportunities}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            刷新
          </button>
        </div>

        {loadingOpportunities ? (
          <div className="text-center py-4 text-sm text-gray-500">加载中...</div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            暂无采集记录
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {opportunities.slice(0, 10).map(opp => (
              <div
                key={opp.id}
                className={cn(
                  'p-3 rounded border',
                  isLight ? 'bg-gray-50 border-gray-200' : 'bg-gray-900/40 border-gray-700'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{opp.domain}</div>
                    <button
                      onClick={() => handleOpenUrl(opp.url)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all text-left mt-1"
                    >
                      {opp.url}
                    </button>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{opp.status === 'new' ? '未提交' : opp.status}</span>
                      <span>·</span>
                      <span>{new Date(opp.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(opp.id)}
                    className="text-xs text-red-600 dark:text-red-400 hover:text-red-700"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {opportunities.length > 10 && (
              <div className="text-center text-xs text-gray-500 pt-2">
                仅显示最近 10 条，查看全部请前往 Options 页面
              </div>
            )}
          </div>
        )}
      </div>

      {/* 采集表单 */}
      <div className={cn(
        'rounded-lg border p-4',
        isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <h3 className={cn('text-sm font-semibold mb-3', isLight ? 'text-gray-900' : 'text-gray-100')}>
          新建采集
        </h3>

        <div className="space-y-3">
          <div>
            <label className={cn(
              'block text-xs font-medium mb-1',
              isLight ? 'text-gray-700' : 'text-gray-300'
            )}>
              目标网站
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={isCollecting}
              className={cn(
                'w-full px-3 py-2 rounded border text-sm',
                isLight
                  ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  : 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>

          <button
            onClick={handleCollect}
            disabled={isCollecting || !targetUrl.trim()}
            className={cn(
              'w-full px-4 py-2 rounded font-medium text-sm transition-colors',
              isCollecting || !targetUrl.trim()
                ? isLight
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : isLight
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
            )}
          >
            {isCollecting ? '采集中...' : '开始采集'}
          </button>

          {result && (
            <div className={cn(
              'rounded-lg p-3 text-sm',
              result.success
                ? isLight ? 'bg-green-50 text-green-800' : 'bg-green-900/30 text-green-200'
                : isLight ? 'bg-red-50 text-red-800' : 'bg-red-900/30 text-red-200'
            )}>
              {result.message}
            </div>
          )}
        </div>
      </div>

      {/* 使用说明 */}
      <div className={cn(
        'text-xs p-3 rounded-lg',
        isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/20 text-blue-300'
      )}>
        <p className="font-medium mb-1">使用说明：</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>输入要采集外链的目标网站</li>
          <li>系统会自动在 Ahrefs 中搜索该网站的外链</li>
          <li>采集过程中会自动打开和关闭标签页</li>
          <li>采集的外链会显示在上方列表中</li>
        </ul>
      </div>
    </div>
  );
};
