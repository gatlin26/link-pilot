/**
 * Submission Panel Component
 * Controls the batch comment submission queue
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { cn } from '@extension/ui';
import type { SubmissionTask, QueueEvent } from '@extension/shared';
import './SubmissionPanel.css';

interface SubmissionPanelProps {
  className?: string;
}

/**
 * Queue status from background script
 */
interface QueueStatus {
  total: number;
  pending: number;
  inProgress: number;
  waitingConfirmation: number;
  completed: number;
  failed: number;
  isProcessing: boolean;
  isPaused: boolean;
}

/**
 * Submission Panel Component
 */
export function SubmissionPanel({ className }: SubmissionPanelProps) {
  const [status, setStatus] = useState<QueueStatus>({
    total: 0,
    pending: 0,
    inProgress: 0,
    waitingConfirmation: 0,
    completed: 0,
    failed: 0,
    isProcessing: false,
    isPaused: false,
  });
  const [currentTask, setCurrentTask] = useState<SubmissionTask | null>(null);
  const [tasks, setTasks] = useState<SubmissionTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskListExpanded, setIsTaskListExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  /**
   * Fetch queue status from background script
   */
  const fetchQueueStatus = useCallback(async () => {
    if (!isMountedRef.current) return;

    try {
      setError(null);
      const response = await chrome.runtime.sendMessage({ type: 'GET_SUBMISSION_QUEUE_STATUS' });

      if (!isMountedRef.current) return;

      if (response && response.success) {
        setStatus(response.data || {
          total: 0,
          pending: 0,
          inProgress: 0,
          waitingConfirmation: 0,
          completed: 0,
          failed: 0,
          isProcessing: false,
          isPaused: false,
        });
        setCurrentTask(response.data?.currentTask || null);
        setTasks(response.data?.tasks || []);
      } else if (response && response.error) {
        setError(response.error);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      console.error('Failed to load queue status:', err);
      setError('获取队列状态失败');
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Start periodic refresh
   */
  const startRefreshInterval = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }
    refreshIntervalRef.current = setInterval(() => {
      fetchQueueStatus();
    }, 2000);
  }, [fetchQueueStatus]);

  /**
   * Stop periodic refresh
   */
  const stopRefreshInterval = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  // Load initial status and set up listeners
  useEffect(() => {
    isMountedRef.current = true;

    // Initial load
    fetchQueueStatus();

    // Start periodic refresh when processing
    startRefreshInterval();

    // Listen for queue events
    const handleMessage = (message: { type: string; payload?: unknown }) => {
      if (message.type === 'QUEUE_EVENT') {
        const event = message.payload as QueueEvent;
        handleQueueEvent(event);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      isMountedRef.current = false;
      chrome.runtime.onMessage.removeListener(handleMessage);
      stopRefreshInterval();
    };
  }, [fetchQueueStatus, startRefreshInterval, stopRefreshInterval]);

  // Adjust refresh interval based on processing state
  useEffect(() => {
    if (status.isProcessing) {
      startRefreshInterval();
    } else {
      stopRefreshInterval();
    }
  }, [status.isProcessing, startRefreshInterval, stopRefreshInterval]);

  // Handle queue events
  const handleQueueEvent = useCallback((event: QueueEvent) => {
    switch (event.type) {
      case 'task_started':
      case 'task_waiting_confirmation':
        setCurrentTask((event.data as { task?: SubmissionTask })?.task || null);
        break;
      case 'task_completed':
      case 'task_failed':
        setCurrentTask(null);
        break;
      case 'queue_paused':
        setStatus(prev => ({ ...prev, isPaused: true, isProcessing: false }));
        break;
      case 'queue_resumed':
        setStatus(prev => ({ ...prev, isPaused: false, isProcessing: true }));
        break;
      case 'queue_stopped':
        setStatus(prev => ({ ...prev, isPaused: false, isProcessing: false }));
        setCurrentTask(null);
        break;
      case 'queue_cleared':
        setStatus(prev => ({
          ...prev,
          total: 0,
          pending: 0,
          inProgress: 0,
          waitingConfirmation: 0,
          completed: 0,
          failed: 0,
          isProcessing: false,
          isPaused: false,
        }));
        setCurrentTask(null);
        setTasks([]);
        break;
      case 'progress':
        const data = event.data as { status?: QueueStatus; currentTask?: SubmissionTask };
        if (data.status) setStatus(data.status);
        if (data.currentTask) setCurrentTask(data.currentTask);
        break;
    }

    // Refresh status after any event
    fetchQueueStatus();
  }, [fetchQueueStatus]);

  // Control functions
  const handleStart = async () => {
    try {
      setError(null);
      const response = await chrome.runtime.sendMessage({ type: 'START_SUBMISSION_QUEUE' });
      if (response && !response.success && response.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error('Failed to start queue:', err);
      setError('启动队列失败');
    }
  };

  const handlePause = async () => {
    try {
      setError(null);
      const response = await chrome.runtime.sendMessage({ type: 'PAUSE_SUBMISSION_QUEUE' });
      if (response && !response.success && response.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error('Failed to pause queue:', err);
      setError('暂停队列失败');
    }
  };

  const handleResume = async () => {
    try {
      setError(null);
      const response = await chrome.runtime.sendMessage({ type: 'RESUME_SUBMISSION_QUEUE' });
      if (response && !response.success && response.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error('Failed to resume queue:', err);
      setError('恢复队列失败');
    }
  };

  const handleStop = async () => {
    try {
      setError(null);
      const response = await chrome.runtime.sendMessage({ type: 'STOP_SUBMISSION_QUEUE' });
      if (response && !response.success && response.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error('Failed to stop queue:', err);
      setError('停止队列失败');
    }
  };

  const handleClear = async () => {
    if (!confirm('确定要清空所有任务吗？')) {
      return;
    }

    try {
      setError(null);
      const response = await chrome.runtime.sendMessage({ type: 'CLEAR_SUBMISSION_QUEUE' });
      if (response && !response.success && response.error) {
        setError(response.error);
      }
    } catch (err) {
      console.error('Failed to clear queue:', err);
      setError('清空队列失败');
    }
  };

  const handleManualRefresh = () => {
    setIsLoading(true);
    fetchQueueStatus();
  };

  // Calculate progress
  const progress = status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0;

  // Determine current task display info
  const activeTask = currentTask || tasks.find(t => t.status === 'in_progress' || t.status === 'waiting_confirmation');

  if (isLoading) {
    return (
      <div className={cn("submission-panel", className)}>
        <div className="loading">加载中...</div>
      </div>
    );
  }

  return (
    <div className={cn("submission-panel", className)}>
      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <span className="error-text">{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <section className="status-overview">
        <div className="panel-header">
          <h3>批量评论提交</h3>
          <div className="header-actions">
            <button
              className="btn-refresh"
              onClick={handleManualRefresh}
              title="刷新状态"
              disabled={isLoading}
            >
              ↻
            </button>
            <div className={cn("status-badge", status.isProcessing ? 'running' : status.isPaused ? 'paused' : 'idle')}>
              {status.isProcessing ? '运行中' : status.isPaused ? '已暂停' : '已停止'}
            </div>
          </div>
        </div>

        {/* Progress */}
        {status.total > 0 && (
          <div className="progress-section">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="progress-text">
              {status.completed} / {status.total} ({progress}%)
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{status.total}</span>
            <span className="stat-label">总任务</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{status.pending}</span>
            <span className="stat-label">待处理</span>
          </div>
          <div className="stat-item in-progress">
            <span className="stat-value">{status.inProgress}</span>
            <span className="stat-label">进行中</span>
          </div>
          <div className="stat-item waiting">
            <span className="stat-value">{status.waitingConfirmation}</span>
            <span className="stat-label">待确认</span>
          </div>
          <div className="stat-item completed">
            <span className="stat-value">{status.completed}</span>
            <span className="stat-label">已完成</span>
          </div>
          <div className="stat-item failed">
            <span className="stat-value">{status.failed}</span>
            <span className="stat-label">失败</span>
          </div>
        </div>

        {/* Controls */}
        <div className="controls">
          {/* Queue is idle, no tasks */}
          {!status.isProcessing && !status.isPaused && status.total === 0 && (
            <button
              className="btn btn-primary"
              onClick={handleStart}
            >
              开始提交
            </button>
          )}

          {/* Queue is idle with tasks (stopped) */}
          {!status.isProcessing && !status.isPaused && status.total > 0 && status.pending > 0 && (
            <button
              className="btn btn-primary"
              onClick={handleStart}
            >
              继续提交
            </button>
          )}

          {/* Queue is running */}
          {status.isProcessing && !status.isPaused && (
            <button
              className="btn btn-warning"
              onClick={handlePause}
            >
              暂停
            </button>
          )}

          {/* Queue is paused */}
          {status.isPaused && (
            <>
              <button
                className="btn btn-primary"
                onClick={handleResume}
              >
                继续
              </button>
              <button
                className="btn btn-danger"
                onClick={handleStop}
              >
                停止
              </button>
            </>
          )}

          {/* Stop button when running */}
          {status.isProcessing && (
            <button
              className="btn btn-danger"
              onClick={handleStop}
            >
              停止
            </button>
          )}

          {/* Clear button when has tasks */}
          {status.total > 0 && (
            <button
              className="btn btn-secondary"
              onClick={handleClear}
            >
              清空队列
            </button>
          )}
        </div>
      </section>

      {/* Current Task */}
      <section className="current-task-section">
        <h4 className="section-title">当前任务</h4>
        {activeTask ? (
          <div className="current-task-card">
            <div className="task-info">
              <div className="task-domain" title={activeTask.url}>
                {activeTask.domain}
              </div>
              <div className="task-url" title={activeTask.url}>
                {activeTask.url}
              </div>
            </div>
            <div className="task-meta">
              <span className={cn("task-status", activeTask.status)}>
                {getStatusText(activeTask.status)}
              </span>
              {activeTask.retryCount > 0 && (
                <span className="task-retry">重试: {activeTask.retryCount}</span>
              )}
            </div>
            {activeTask.status === 'waiting_confirmation' && (
              <div className="task-instruction">
                <span className="instruction-icon">⏳</span>
                <span>请在页面中点击提交按钮，然后等待确认...</span>
              </div>
            )}
            {activeTask.status === 'in_progress' && (
              <div className="task-instruction">
                <span className="instruction-icon">🔄</span>
                <span>正在处理中，请稍候...</span>
              </div>
            )}
            {activeTask.error && (
              <div className="task-error">
                错误: {activeTask.error}
              </div>
            )}
          </div>
        ) : (
          <div className="no-task">
            {status.total === 0 ? '队列中没有任务' : '暂无正在进行的任务'}
          </div>
        )}
      </section>

      {/* Task List */}
      {tasks.length > 0 && (
        <section className="task-list-section">
          <div
            className="task-list-header"
            onClick={() => setIsTaskListExpanded(!isTaskListExpanded)}
          >
            <h4 className="section-title">
              任务列表 ({tasks.length})
            </h4>
            <span className={cn("expand-icon", isTaskListExpanded && 'expanded')}>
              ▼
            </span>
          </div>

          {isTaskListExpanded && (
            <div className="task-list">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "task-item",
                    task.status,
                    task.id === activeTask?.id && 'active'
                  )}
                >
                  <div className="task-item-info">
                    <span className="task-item-domain" title={task.url}>
                      {task.domain}
                    </span>
                    <span className="task-item-url" title={task.url}>
                      {task.url}
                    </span>
                  </div>
                  <div className="task-item-meta">
                    <span className={cn("task-item-status", task.status)}>
                      {getStatusText(task.status)}
                    </span>
                    {task.retryCount > 0 && (
                      <span className="task-item-retry">{task.retryCount}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

/**
 * Get status display text
 */
function getStatusText(status: SubmissionTask['status']): string {
  switch (status) {
    case 'pending':
      return '等待中';
    case 'in_progress':
      return '处理中';
    case 'waiting_confirmation':
      return '等待确认';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'paused':
      return '已暂停';
    default:
      return status;
  }
}

export default SubmissionPanel;
