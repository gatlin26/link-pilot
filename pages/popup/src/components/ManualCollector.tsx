import { useState, useEffect } from 'react';
import { cn } from '@extension/ui';
import { opportunityStorage } from '@extension/storage';
import type { Opportunity, RecursiveCollectionSession, RecursiveQueueItem } from '@extension/shared';

interface ManualCollectorProps {
  isLight: boolean;
}

export const ManualCollector = ({ isLight }: ManualCollectorProps) => {
  const [targetUrl, setTargetUrl] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(true);

  // 递归采集状态
  const [recursiveSession, setRecursiveSession] = useState<RecursiveCollectionSession | null>(null);
  const [queueSize, setQueueSize] = useState(0);
  const [currentItem, setCurrentItem] = useState<RecursiveQueueItem | null>(null);
  const [isStartingRecursive, setIsStartingRecursive] = useState(false);

  useEffect(() => {
    loadOpportunities();
    loadRecursiveStatus();
    loadSavedTargetUrl();
  }, []);

  // 从 localStorage 加载保存的目标 URL
  const loadSavedTargetUrl = () => {
    try {
      const saved = localStorage.getItem('targetUrl');
      if (saved) {
        setTargetUrl(saved);
      }
    } catch (err) {
      console.error('加载目标 URL 失败:', err);
    }
  };

  // 保存目标 URL 到 localStorage
  const saveTargetUrl = (url: string) => {
    try {
      if (url.trim()) {
        localStorage.setItem('targetUrl', url);
      }
    } catch (err) {
      console.error('保存目标 URL 失败:', err);
    }
  };

  // 轮询递归采集状态
  useEffect(() => {
    if (!recursiveSession || recursiveSession.status === 'completed' || recursiveSession.status === 'stopped') {
      return;
    }

    const intervalId = setInterval(() => {
      loadRecursiveStatus();
    }, 2000);

    return () => clearInterval(intervalId);
  }, [recursiveSession]);

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

  const loadRecursiveStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_RECURSIVE_STATUS',
      });

      if (response?.success && response.session) {
        setRecursiveSession(response.session);
        setQueueSize(response.queueSize || 0);
        setCurrentItem(response.currentItem || null);
      } else {
        setRecursiveSession(null);
        setQueueSize(0);
        setCurrentItem(null);
      }
    } catch (err) {
      console.error('加载递归采集状态失败:', err);
    }
  };

  const getTargetUrl = async (): Promise<string> => {
    if (targetUrl.trim()) {
      return targetUrl.trim();
    }

    // 获取当前标签页的域名
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const url = new URL(tab.url);
      return `${url.protocol}//${url.hostname}/`;
    }

    throw new Error('无法获取目标 URL');
  };

  const handleCollect = async () => {
    try {
      const url = await getTargetUrl();

      // 验证 URL 格式
      try {
        new URL(url);
      } catch {
        setResult({ success: false, message: 'URL 格式不正确' });
        return;
      }

      setIsCollecting(true);
      setResult(null);

      // 发送消息到 background 开始采集
      const response = await chrome.runtime.sendMessage({
        type: 'START_MANUAL_COLLECTION',
        payload: { targetUrl: url },
      });

      if (response?.success) {
        setResult({
          success: true,
          message: `成功采集 ${response.count || 0} 条外链机会`,
        });
        // 不清空输入框，保持用户输入
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

  const handleRecursiveCollect = async () => {
    try {
      const url = await getTargetUrl();

      // 验证 URL 格式
      try {
        new URL(url);
      } catch {
        setResult({ success: false, message: 'URL 格式不正确' });
        return;
      }

      setIsStartingRecursive(true);
      setResult(null);

      const response = await chrome.runtime.sendMessage({
        type: 'START_RECURSIVE_COLLECTION',
        payload: {
          initialUrl: url,
        },
      });

      if (response?.success) {
        setResult({
          success: true,
          message: '自动采集已启动',
        });
        // 不清空输入框，保持用户输入
        // 立即加载状态
        await loadRecursiveStatus();
      } else {
        setResult({
          success: false,
          message: response?.error || '启动失败',
        });
      }
    } catch (error) {
      console.error('启动递归采集失败:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '启动失败',
      });
    } finally {
      setIsStartingRecursive(false);
    }
  };

  const handlePauseRecursive = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'PAUSE_RECURSIVE_COLLECTION',
      });

      if (response?.success) {
        await loadRecursiveStatus();
      }
    } catch (error) {
      console.error('暂停失败:', error);
    }
  };

  const handleResumeRecursive = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'RESUME_RECURSIVE_COLLECTION',
      });

      if (response?.success) {
        await loadRecursiveStatus();
      }
    } catch (error) {
      console.error('恢复失败:', error);
    }
  };

  const handleStopRecursive = async () => {
    if (!confirm('确定要停止自动采集吗？')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_RECURSIVE_COLLECTION',
      });

      if (response?.success) {
        await loadRecursiveStatus();
        await loadOpportunities();
      }
    } catch (error) {
      console.error('停止失败:', error);
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
      {/* 顶部：采集控制区域 */}
      <div className={cn(
        'rounded-lg border p-4',
        isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
      )}>
        <div className="space-y-3">
          <div>
            <label className={cn(
              'block text-xs font-medium mb-1',
              isLight ? 'text-gray-700' : 'text-gray-300'
            )}>
              目标网站（留空则使用当前站点）
            </label>
            <input
              type="text"
              value={targetUrl}
              onChange={(e) => {
                const newValue = e.target.value;
                setTargetUrl(newValue);
                saveTargetUrl(newValue);
              }}
              placeholder="https://example.com"
              disabled={isCollecting || isStartingRecursive}
              className={cn(
                'w-full px-3 py-2 rounded border text-sm',
                isLight
                  ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
                  : 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500',
                'focus:outline-none focus:ring-2 focus:ring-blue-500'
              )}
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCollect}
              disabled={isCollecting || isStartingRecursive}
              className={cn(
                'flex-1 px-4 py-2 rounded font-medium text-sm transition-colors',
                isCollecting || isStartingRecursive
                  ? isLight
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : isLight
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
              )}
            >
              {isCollecting ? '采集中...' : '新建采集'}
            </button>

            <button
              onClick={handleRecursiveCollect}
              disabled={isCollecting || isStartingRecursive || (recursiveSession?.status === 'running' || recursiveSession?.status === 'paused')}
              className={cn(
                'flex-1 px-4 py-2 rounded font-medium text-sm transition-colors',
                isCollecting || isStartingRecursive || (recursiveSession?.status === 'running' || recursiveSession?.status === 'paused')
                  ? isLight
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : isLight
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
              )}
            >
              {isStartingRecursive ? '启动中...' : '开始自动采集'}
            </button>
          </div>

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

      {/* 递归采集状态面板（条件显示）*/}
      {recursiveSession && (
        <div className={cn(
          'rounded-lg border p-4',
          isLight ? 'bg-blue-50 border-blue-200' : 'bg-blue-900/20 border-blue-800'
        )}>
          <div className="space-y-3">
            {/* 状态头部 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  recursiveSession.status === 'running' ? 'bg-green-500 animate-pulse' :
                  recursiveSession.status === 'paused' ? 'bg-yellow-500' :
                  'bg-gray-500'
                )}></div>
                <span className={cn(
                  'text-sm font-semibold',
                  isLight ? 'text-gray-900' : 'text-gray-100'
                )}>
                  自动采集：{
                    recursiveSession.status === 'running' ? '运行中' :
                    recursiveSession.status === 'paused' ? '已暂停' :
                    recursiveSession.status === 'completed' ? '已完成' :
                    '已停止'
                  }
                </span>
              </div>
              {currentItem && (
                <span className={cn(
                  'text-xs',
                  isLight ? 'text-gray-600' : 'text-gray-400'
                )}>
                  当前：{new URL(currentItem.url).hostname}
                </span>
              )}
            </div>

            {/* 统计信息 */}
            <div className="grid grid-cols-3 gap-2">
              <div className={cn(
                'p-2 rounded text-center',
                isLight ? 'bg-white' : 'bg-gray-800/50'
              )}>
                <div className={cn(
                  'text-xs',
                  isLight ? 'text-gray-600' : 'text-gray-400'
                )}>
                  深度
                </div>
                <div className={cn(
                  'text-lg font-semibold',
                  isLight ? 'text-gray-900' : 'text-gray-100'
                )}>
                  {currentItem?.depth || 0} / {recursiveSession.config.maxDepth}
                </div>
              </div>

              <div className={cn(
                'p-2 rounded text-center',
                isLight ? 'bg-white' : 'bg-gray-800/50'
              )}>
                <div className={cn(
                  'text-xs',
                  isLight ? 'text-gray-600' : 'text-gray-400'
                )}>
                  队列
                </div>
                <div className={cn(
                  'text-lg font-semibold',
                  isLight ? 'text-gray-900' : 'text-gray-100'
                )}>
                  {queueSize}
                </div>
              </div>

              <div className={cn(
                'p-2 rounded text-center',
                isLight ? 'bg-white' : 'bg-gray-800/50'
              )}>
                <div className={cn(
                  'text-xs',
                  isLight ? 'text-gray-600' : 'text-gray-400'
                )}>
                  已采集
                </div>
                <div className={cn(
                  'text-lg font-semibold',
                  isLight ? 'text-gray-900' : 'text-gray-100'
                )}>
                  {recursiveSession.stats.completed} / {recursiveSession.config.maxTotalUrls}
                </div>
              </div>
            </div>

            {/* 控制按钮 */}
            <div className="flex gap-2">
              {recursiveSession.status === 'running' && (
                <button
                  onClick={handlePauseRecursive}
                  className={cn(
                    'flex-1 px-3 py-2 rounded font-medium text-sm transition-colors',
                    isLight
                      ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                      : 'bg-yellow-500 text-white hover:bg-yellow-600'
                  )}
                >
                  暂停
                </button>
              )}

              {recursiveSession.status === 'paused' && (
                <button
                  onClick={handleResumeRecursive}
                  className={cn(
                    'flex-1 px-3 py-2 rounded font-medium text-sm transition-colors',
                    isLight
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-green-500 text-white hover:bg-green-600'
                  )}
                >
                  恢复
                </button>
              )}

              {(recursiveSession.status === 'running' || recursiveSession.status === 'paused') && (
                <button
                  onClick={handleStopRecursive}
                  className={cn(
                    'flex-1 px-3 py-2 rounded font-medium text-sm transition-colors',
                    isLight
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  )}
                >
                  停止
                </button>
              )}
            </div>

            {/* 进度提示 */}
            {recursiveSession.stats.totalOpportunities > 0 && (
              <div className={cn(
                'text-xs text-center',
                isLight ? 'text-gray-600' : 'text-gray-400'
              )}>
                已发现 {recursiveSession.stats.totalOpportunities} 个外链机会
              </div>
            )}
          </div>
        </div>
      )}
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

      {/* 使用说明 */}
      <div className={cn(
        'text-xs p-3 rounded-lg',
        isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/20 text-blue-300'
      )}>
        <p className="font-medium mb-1">使用说明：</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>新建采集：单次采集指定网站的外链</li>
          <li>自动采集：递归采集外链，自动发现更多机会</li>
          <li>留空 URL 输入框将使用当前标签页的域名</li>
          <li>采集过程中会自动打开和关闭标签页</li>
          <li>采集的外链会显示在下方列表中</li>
        </ul>
      </div>
    </div>
  );
};
