import React, { useEffect, useState } from 'react';
import { syncQueueService, syncRunnerService, syncSettingsStorage } from '@extension/storage';
import type { SyncJob } from '@extension/shared';

export const SyncStatus: React.FC = () => {
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, success: 0, failed: 0 });
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);

  const loadData = async () => {
    try {
      const [allJobs, statsData, settings] = await Promise.all([
        syncQueueService.getAllJobs(),
        syncQueueService.getStats(),
        syncSettingsStorage.get(),
      ]);
      setJobs(allJobs.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      setStats(statsData);
      setConfigured(Boolean(settings.webAppUrl.trim()));
    } catch (error) {
      console.error('加载同步状态失败:', error);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRunSync = async () => {
    try {
      setLoading(true);
      const result = await syncRunnerService.processPendingJobs();
      await loadData();
      alert(`同步完成：成功 ${result.success}，失败 ${result.failed}`);
    } catch (error) {
      alert(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = async () => {
    try {
      setLoading(true);
      await syncQueueService.retryFailed();
      await loadData();
      alert('已将失败任务重新加入队列');
    } catch (error) {
      alert(`重试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCleanup = async () => {
    try {
      setLoading(true);
      const count = await syncQueueService.cleanupCompleted(7);
      await loadData();
      alert(`已清理 ${count} 条记录`);
    } catch (error) {
      alert(`清理失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const getEntityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      backlink: '外链',
      opportunity: '机会',
      submission: '提交记录',
      template: '模板',
    };
    return labels[type] || type;
  };

  const getOperationLabel = (operation: string) => {
    const labels: Record<string, string> = {
      create: '创建',
      update: '更新',
      delete: '删除',
    };
    return labels[operation] || operation;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待处理',
      success: '成功',
      failed: '失败',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      success: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {!configured && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-100 p-4 rounded-lg">
          尚未配置 Google Sheets Web App URL，当前只能入队，无法真正同步。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">总任务</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">待处理</div>
          <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">成功</div>
          <div className="text-2xl font-bold text-green-600">{stats.success}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600 dark:text-gray-400">失败</div>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
        <div className="flex gap-3 flex-wrap">
          <button onClick={loadData} disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
            刷新
          </button>
          <button
            onClick={handleRunSync}
            disabled={loading || !configured || stats.pending + stats.failed === 0}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            立即同步
          </button>
          <button
            onClick={handleRetryFailed}
            disabled={loading || stats.failed === 0}
            className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
          >
            重试失败任务
          </button>
          <button
            onClick={handleCleanup}
            disabled={loading}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
          >
            清理已完成
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-4 border-b dark:border-gray-700">
          <h3 className="font-medium">同步任务</h3>
        </div>
        <div className="p-4">
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">暂无同步任务</div>
          ) : (
            <div className="space-y-2">
              {jobs.map(job => (
                <div key={job.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(job.status)}`}>
                          {getStatusLabel(job.status)}
                        </span>
                        <span className="text-sm font-medium">
                          {getEntityTypeLabel(job.entity_type)} - {getOperationLabel(job.operation)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">实体 ID: {job.entity_id.slice(0, 8)}...</p>
                      {job.error_message && <p className="text-xs text-red-600 mt-1">{job.error_message}</p>}
                      <p className="text-xs text-gray-500 mt-1">
                        重试次数: {job.retry_count} | 更新时间: {new Date(job.updated_at).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
