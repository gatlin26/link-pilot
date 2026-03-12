/**
 * Submission Panel Component
 * Controls the batch comment submission queue
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@extension/ui';
import type { SubmissionTask, QueueEvent } from '@extension/shared';

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

  // Load initial status
  useEffect(() => {
    const loadStatus = async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_QUEUE_STATUS' });
        if (response) {
          setStatus(response.status || status);
          setCurrentTask(response.currentTask || null);
          setTasks(response.tasks || []);
        }
      } catch (error) {
        console.error('Failed to load queue status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStatus();

    // Listen for queue events
    const handleMessage = (message: { type: string; data?: unknown }) => {
      if (message.type === 'QUEUE_EVENT') {
        const event = message.data as QueueEvent;
        handleQueueEvent(event);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  // Handle queue events
  const handleQueueEvent = useCallback((event: QueueEvent) => {
    switch (event.type) {
      case 'task_started':
      case 'task_waiting_confirmation':
        setCurrentTask((event.data as { task?: SubmissionTask }).task || null);
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
        break;
      case 'progress':
        const data = event.data as { status?: QueueStatus; currentTask?: SubmissionTask };
        if (data.status) setStatus(data.status);
        if (data.currentTask) setCurrentTask(data.currentTask);
        break;
    }

    // Refresh status after any event
    chrome.runtime.sendMessage({ type: 'GET_QUEUE_STATUS' }).then(response => {
      if (response) {
        setStatus(response.status || status);
        setCurrentTask(response.currentTask || null);
        setTasks(response.tasks || []);
      }
    });
  }, [status]);

  // Control functions
  const handleStart = async () => {
    await chrome.runtime.sendMessage({ type: 'START_SUBMISSION_QUEUE' });
  };

  const handlePause = async () => {
    await chrome.runtime.sendMessage({ type: 'PAUSE_SUBMISSION_QUEUE' });
  };

  const handleResume = async () => {
    await chrome.runtime.sendMessage({ type: 'RESUME_SUBMISSION_QUEUE' });
  };

  const handleStop = async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_SUBMISSION_QUEUE' });
  };

  const handleClear = async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_SUBMISSION_QUEUE' });
  };

  const progress = status.total > 0 ? Math.round((status.completed / status.total) * 100) : 0;

  if (isLoading) {
    return (
      <div className={cn("submission-panel", className)}>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className={cn("submission-panel", className)}>
      {/* Header */}
      <div className="panel-header">
        <h3>批量评论提交</h3>
        <div className={cn("status-badge", status.isProcessing ? 'running' : status.isPaused ? 'paused' : 'idle')}>
          {status.isProcessing ? '运行中' : status.isPaused ? '已暂停' : '已停止'}
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

      {/* Current Task */}
      {currentTask && (
        <div className="current-task">
          <div className="task-label">当前任务</div>
          <div className="task-url" title={currentTask.url}>
            {currentTask.domain}
          </div>
          {currentTask.status === 'waiting_confirmation' && (
            <div className="task-instruction">
              ⏳ 请点击提交按钮，然后等待...
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {status.total > 0 && (
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{status.pending}</span>
            <span className="stat-label">待处理</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{status.waitingConfirmation}</span>
            <span className="stat-label">等待确认</span>
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
      )}

      {/* Controls */}
      <div className="controls">
        {!status.isProcessing && !status.isPaused && status.total === 0 && (
          <button 
            className="btn btn-primary"
            onClick={handleStart}
          >
            开始提交
          </button>
        )}
        
        {status.isProcessing && !status.isPaused && (
          <button 
            className="btn btn-warning"
            onClick={handlePause}
          >
            暂停
          </button>
        )}
        
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

        {status.isProcessing && (
          <button 
            className="btn btn-danger"
            onClick={handleStop}
          >
            停止
          </button>
        )}

        {status.total > 0 && (
          <button 
            className="btn btn-secondary"
            onClick={handleClear}
          >
            清空队列
          </button>
        )}
      </div>

      {/* Queue Preview */}
      {tasks.length > 0 && (
        <div className="queue-preview">
          <h4>队列预览</h4>
          <div className="queue-list">
            {tasks.slice(0, 5).map((task, index) => (
              <div 
                key={task.id} 
                className={cn(
                  "queue-item",
                  task.status,
                  index === tasks.indexOf(currentTask!) && 'current'
                )}
              >
                <span className="queue-item-domain">{task.domain}</span>
                <span className={cn("queue-item-status", task.status)}>
                  {getStatusText(task.status)}
                </span>
              </div>
            ))}
            {tasks.length > 5 && (
              <div className="queue-more">
                还有 {tasks.length - 5} 个...
              </div>
            )}
          </div>
        </div>
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
