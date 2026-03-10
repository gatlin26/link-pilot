import { useState } from 'react';

/**
 * 开发工具组件
 * 用于测试和调试
 */
export function DevTools() {
  const [clearing, setClearing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const clearAllStorage = async () => {
    if (!confirm('确定要清除所有本地存储数据吗？此操作不可恢复！')) {
      return;
    }

    setClearing(true);
    setMessage(null);

    try {
      // 清除 chrome.storage.local
      await chrome.storage.local.clear();
      console.log('[DevTools] chrome.storage.local 已清除');

      // 清除 chrome.storage.sync
      await chrome.storage.sync.clear();
      console.log('[DevTools] chrome.storage.sync 已清除');

      // 清除 chrome.storage.session
      try {
        await chrome.storage.session.clear();
        console.log('[DevTools] chrome.storage.session 已清除');
      } catch (error) {
        console.warn('[DevTools] chrome.storage.session 清除失败（可能不支持）:', error);
      }

      setMessage('✅ 所有存储已清除！页面将在 2 秒后刷新...');

      // 2秒后刷新页面
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('[DevTools] 清除存储失败:', error);
      setMessage(`❌ 清除失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setClearing(false);
    }
  };

  const clearOpportunities = async () => {
    if (!confirm('确定要清除所有采集的外链数据（Opportunities）吗？')) {
      return;
    }

    setClearing(true);
    setMessage(null);

    try {
      const keys = await chrome.storage.local.get(null);
      const opportunityKeys = Object.keys(keys).filter(key =>
        key.includes('opportunity') ||
        key.includes('collected_backlink') ||
        key.includes('collection_batch')
      );

      for (const key of opportunityKeys) {
        await chrome.storage.local.remove(key);
      }

      setMessage(`✅ 已清除 ${opportunityKeys.length} 个外链相关数据！`);
      console.log('[DevTools] 已清除的 keys:', opportunityKeys);
    } catch (error) {
      console.error('[DevTools] 清除外链数据失败:', error);
      setMessage(`❌ 清除失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setClearing(false);
    }
  };

  const showStorageInfo = async () => {
    try {
      const local = await chrome.storage.local.get(null);
      const sync = await chrome.storage.sync.get(null);

      console.group('[DevTools] 存储信息');
      console.log('chrome.storage.local keys:', Object.keys(local));
      console.log('chrome.storage.local data:', local);
      console.log('chrome.storage.sync keys:', Object.keys(sync));
      console.log('chrome.storage.sync data:', sync);
      console.groupEnd();

      setMessage(`📊 存储信息已输出到控制台\nLocal: ${Object.keys(local).length} 个键\nSync: ${Object.keys(sync).length} 个键`);
    } catch (error) {
      console.error('[DevTools] 获取存储信息失败:', error);
      setMessage(`❌ 获取失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold mb-4">🛠️ 开发工具</h2>

      {message && (
        <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded text-sm whitespace-pre-line">
          {message}
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={clearAllStorage}
          disabled={clearing}
          className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {clearing ? '清除中...' : '🗑️ 清除所有存储'}
        </button>

        <button
          onClick={clearOpportunities}
          disabled={clearing}
          className="w-full px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {clearing ? '清除中...' : '🔗 清除外链数据'}
        </button>

        <button
          onClick={showStorageInfo}
          disabled={clearing}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📊 查看存储信息
        </button>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 mt-4">
        <p>⚠️ 注意：清除操作不可恢复</p>
        <p>💡 提示：查看存储信息会输出到浏览器控制台</p>
      </div>
    </div>
  );
}
