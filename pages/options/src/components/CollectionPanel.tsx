/**
 * 外链采集面板
 */

import { useState, useEffect } from 'react';
import { cn, LoadingSpinner } from '@extension/ui';
import { opportunityStorage } from '@extension/storage';
import type { Opportunity } from '@extension/shared';

interface CollectionPanelProps {
  isLight?: boolean;
}

export function CollectionPanel({ isLight = true }: CollectionPanelProps) {
  const [targetUrl, setTargetUrl] = useState('');
  const [batchUrls, setBatchUrls] = useState('');
  const [collecting, setCollecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(true);

  // 加载已采集的外链
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

  const handleSingleCollection = async () => {
    if (!targetUrl.trim()) {
      setError('请输入目标网址');
      return;
    }

    setCollecting(true);
    setMessage(null);
    setError(null);
    setResult(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_MANUAL_COLLECTION',
        payload: { targetUrl: targetUrl.trim() },
      });

      if (!response?.success) {
        throw new Error(response?.error || '采集失败');
      }

      setMessage(`采集成功！共采集 ${response.count} 条外链`);
      setResult(response);
      setTargetUrl('');

      // 重新加载外链列表
      await loadOpportunities();
    } catch (err) {
      setError(err instanceof Error ? err.message : '采集失败');
    } finally {
      setCollecting(false);
    }
  };

  const handleBatchCollection = async () => {
    const urls = batchUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      setError('请输入至少一个网址');
      return;
    }

    setCollecting(true);
    setMessage(null);
    setError(null);
    setResult(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_BATCH_COLLECTION',
        payload: { targetUrls: urls },
      });

      if (!response?.success) {
        throw new Error(response?.error || '批量采集失败');
      }

      setMessage(
        `批量采集完成！成功 ${response.successful} 个，失败 ${response.failed} 个`
      );
      setResult(response);
      setBatchUrls('');

      // 重新加载外链列表
      await loadOpportunities();
    } catch (err) {
      setError(err instanceof Error ? err.message : '批量采集失败');
    } finally {
      setCollecting(false);
    }
  };

  const handleDeleteOpportunity = async (id: string) => {
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
    <div className="space-y-6">
      {/* 已采集的外链列表 */}
      <section
        className={cn(
          'p-6 rounded-lg border',
          isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">已采集的外链 ({opportunities.length})</h2>
          <button
            onClick={loadOpportunities}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            刷新
          </button>
        </div>

        {loadingOpportunities ? (
          <div className="flex items-center justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : opportunities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无采集记录，请使用下方的采集功能
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {opportunities.map(opp => (
              <div
                key={opp.id}
                className={cn(
                  'p-4 rounded-lg border',
                  isLight
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-gray-900/40 border-gray-700'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{opp.domain}</div>
                    <button
                      onClick={() => handleOpenUrl(opp.url)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all text-left mt-1"
                    >
                      {opp.url}
                    </button>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>状态: {opp.status === 'new' ? '未提交' : opp.status}</span>
                      <span>匹配分数: {opp.context_match_score}</span>
                      <span>{new Date(opp.created_at).toLocaleDateString()}</span>
                    </div>
                    {opp.context_match_note && (
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {opp.context_match_note}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteOpportunity(opp.id)}
                    className="text-red-600 dark:text-red-400 hover:text-red-700 text-sm"
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 单个采集 */}
      <section
        className={cn(
          'p-6 rounded-lg border',
          isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
        )}
      >
        <h2 className="text-lg font-semibold mb-4">单个采集</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">目标网址</label>
            <input
              type="url"
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={collecting}
              className={cn(
                'w-full px-4 py-2 rounded border text-sm',
                isLight
                  ? 'bg-white border-gray-300'
                  : 'bg-gray-900 border-gray-700'
              )}
            />
            <p className="text-xs text-gray-500 mt-1">
              输入要采集外链的目标网站 URL
            </p>
          </div>

          <button
            onClick={handleSingleCollection}
            disabled={collecting || !targetUrl.trim()}
            className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {collecting ? '采集中...' : '开始采集'}
          </button>
        </div>
      </section>

      {/* 批量采集 */}
      <section
        className={cn(
          'p-6 rounded-lg border',
          isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
        )}
      >
        <h2 className="text-lg font-semibold mb-4">批量采集</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              目标网址列表（每行一个）
            </label>
            <textarea
              value={batchUrls}
              onChange={e => setBatchUrls(e.target.value)}
              placeholder={'https://example1.com\nhttps://example2.com\nhttps://example3.com'}
              disabled={collecting}
              rows={6}
              className={cn(
                'w-full px-4 py-2 rounded border text-sm font-mono',
                isLight
                  ? 'bg-white border-gray-300'
                  : 'bg-gray-900 border-gray-700'
              )}
            />
            <p className="text-xs text-gray-500 mt-1">
              每行输入一个 URL，系统会依次采集
            </p>
          </div>

          <button
            onClick={handleBatchCollection}
            disabled={collecting || !batchUrls.trim()}
            className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {collecting ? '批量采集中...' : '开始批量采集'}
          </button>
        </div>
      </section>

      {/* 消息提示 */}
      {collecting && (
        <div className="flex items-center justify-center p-4">
          <LoadingSpinner />
          <span className="ml-2 text-sm">正在采集外链数据...</span>
        </div>
      )}

      {message && (
        <div className="rounded-lg p-4 bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg p-4 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {/* 采集结果 */}
      {result && (
        <section
          className={cn(
            'p-6 rounded-lg border',
            isLight ? 'bg-white border-gray-200' : 'bg-gray-800 border-gray-700'
          )}
        >
          <h2 className="text-lg font-semibold mb-4">采集结果</h2>
          <div className="space-y-2 text-sm">
            {result.count !== undefined && (
              <div>
                <span className="text-gray-500">采集数量：</span>
                <span className="font-medium">{result.count} 条</span>
              </div>
            )}
            {result.total !== undefined && (
              <>
                <div>
                  <span className="text-gray-500">总计：</span>
                  <span className="font-medium">{result.total} 个</span>
                </div>
                <div>
                  <span className="text-gray-500">成功：</span>
                  <span className="font-medium text-green-600">
                    {result.successful} 个
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">失败：</span>
                  <span className="font-medium text-red-600">
                    {result.failed} 个
                  </span>
                </div>
              </>
            )}
            {result.results && result.results.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">详细结果：</div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.results.map((item: any, index: number) => (
                    <div
                      key={index}
                      className={cn(
                        'p-3 rounded border text-xs',
                        item.success
                          ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                          : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                      )}
                    >
                      <div className="font-medium truncate">{item.url}</div>
                      {item.success ? (
                        <div className="text-green-600 dark:text-green-400 mt-1">
                          成功采集 {item.count} 条
                        </div>
                      ) : (
                        <div className="text-red-600 dark:text-red-400 mt-1">
                          {item.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 使用说明 */}
      <section
        className={cn(
          'p-6 rounded-lg border',
          isLight
            ? 'bg-blue-50 border-blue-200'
            : 'bg-blue-900/20 border-blue-800'
        )}
      >
        <h3 className="text-sm font-semibold mb-2">使用说明</h3>
        <ul className="text-xs space-y-1 text-gray-600 dark:text-gray-400">
          <li>• 单个采集：输入一个网址，系统会打开 Ahrefs 页面并自动采集外链数据</li>
          <li>• 批量采集：输入多个网址（每行一个），系统会依次采集</li>
          <li>• 采集的数据会自动保存到"外链管理"中</li>
          <li>• 采集过程中会自动打开和关闭标签页，请勿手动操作</li>
          <li>• 批量采集时，每次采集之间会有 2 秒延迟</li>
        </ul>
      </section>
    </div>
  );
}
