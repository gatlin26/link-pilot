import { useState } from 'react';
import { cn } from '@extension/ui';

interface BatchCollectorProps {
  isLight: boolean;
}

interface BatchResult {
  url: string;
  success: boolean;
  count?: number;
  error?: string;
}

export const BatchCollector = ({ isLight }: BatchCollectorProps) => {
  const [targetUrls, setTargetUrls] = useState('');
  const [isCollecting, setIsCollecting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<BatchResult[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    successful: number;
    failed: number;
  } | null>(null);

  const parseUrls = (text: string): string[] => {
    // 按行分割，过滤空行，去除空格
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  };

  const handleCollect = async () => {
    const urls = parseUrls(targetUrls);

    if (urls.length === 0) {
      return;
    }

    // 验证所有 URL 格式
    const invalidUrls = urls.filter(url => {
      try {
        new URL(url);
        return false;
      } catch {
        return true;
      }
    });

    if (invalidUrls.length > 0) {
      alert(`以下 URL 格式不正确:\n${invalidUrls.join('\n')}`);
      return;
    }

    setIsCollecting(true);
    setProgress({ current: 0, total: urls.length });
    setResults([]);
    setSummary(null);

    try {
      // 发送批量采集请求
      const response = await chrome.runtime.sendMessage({
        type: 'START_BATCH_COLLECTION',
        payload: { targetUrls: urls },
      });

      if (response) {
        setResults(response.results || []);
        setSummary({
          total: response.total || 0,
          successful: response.successful || 0,
          failed: response.failed || 0,
        });
      }
    } catch (error) {
      console.error('批量采集失败:', error);
      alert(error instanceof Error ? error.message : '批量采集失败');
    } finally {
      setIsCollecting(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const urlCount = parseUrls(targetUrls).length;

  return (
    <div className="space-y-4">
      <div>
        <label className={cn(
          'block text-sm font-medium mb-2',
          isLight ? 'text-gray-700' : 'text-gray-300'
        )}>
          目标网站列表（每行一个）
        </label>
        <textarea
          value={targetUrls}
          onChange={(e) => setTargetUrls(e.target.value)}
          placeholder={'https://example1.com\nhttps://example2.com\nhttps://example3.com'}
          disabled={isCollecting}
          rows={6}
          className={cn(
            'w-full px-3 py-2 rounded border text-sm font-mono',
            isLight
              ? 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'
              : 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500'
          )}
        />
        {urlCount > 0 && (
          <div className={cn(
            'text-xs mt-1',
            isLight ? 'text-gray-600' : 'text-gray-400'
          )}>
            共 {urlCount} 个网站
          </div>
        )}
      </div>

      <button
        onClick={handleCollect}
        disabled={isCollecting || urlCount === 0}
        className={cn(
          'w-full px-4 py-2 rounded font-medium text-sm transition-colors',
          isCollecting || urlCount === 0
            ? isLight
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : isLight
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-blue-500 text-white hover:bg-blue-600'
        )}
      >
        {isCollecting ? `采集中... (${progress.current}/${progress.total})` : '开始批量采集'}
      </button>

      {summary && (
        <div className={cn(
          'rounded-lg p-3 text-sm',
          isLight ? 'bg-blue-50 text-blue-900' : 'bg-blue-900/30 text-blue-200'
        )}>
          <div className="font-medium mb-2">采集完成</div>
          <div className="space-y-1 text-xs">
            <div>总数: {summary.total}</div>
            <div className="text-green-600 dark:text-green-400">成功: {summary.successful}</div>
            <div className="text-red-600 dark:text-red-400">失败: {summary.failed}</div>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className={cn(
            'text-xs font-medium',
            isLight ? 'text-gray-700' : 'text-gray-300'
          )}>
            采集结果：
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {results.map((result, index) => (
              <div
                key={index}
                className={cn(
                  'rounded p-2 text-xs',
                  result.success
                    ? isLight ? 'bg-green-50 text-green-800' : 'bg-green-900/30 text-green-200'
                    : isLight ? 'bg-red-50 text-red-800' : 'bg-red-900/30 text-red-200'
                )}
              >
                <div className="font-medium truncate">{result.url}</div>
                <div className="mt-1">
                  {result.success
                    ? `✓ 成功采集 ${result.count || 0} 条`
                    : `✗ ${result.error || '失败'}`
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn(
        'text-xs p-3 rounded-lg',
        isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-900/20 text-blue-300'
      )}>
        <p className="font-medium mb-1">使用说明：</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>每行输入一个网站 URL</li>
          <li>系统会依次在 Ahrefs 中搜索并采集外链</li>
          <li>采集过程中会自动打开和关闭标签页</li>
          <li>建议每次不超过 10 个网站</li>
        </ul>
      </div>
    </div>
  );
};
