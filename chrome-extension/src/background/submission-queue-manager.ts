/**
 * Submission Queue Manager
 * Handles message-based queue operations
 */

import { SubmissionQueue } from './submission-queue';
import { messageRouter } from './message-router';
import { managedBacklinkStorage, websiteProfileStorage } from '@extension/storage';
import type { SubmissionTask } from '@extension/shared';

// 全局队列实例
const submissionQueue = new SubmissionQueue();

/**
 * Initialize submission queue manager
 * Registers all message handlers
 */
export function initSubmissionQueueManager(): void {
  // 注册消息处理器
  messageRouter.register('ADD_TO_SUBMISSION_QUEUE', handleAddToQueue);
  messageRouter.register('GET_SUBMISSION_QUEUE_STATUS', handleGetStatus);
  messageRouter.register('START_SUBMISSION_QUEUE', handleStartQueue);
  messageRouter.register('PAUSE_SUBMISSION_QUEUE', handlePauseQueue);
  messageRouter.register('STOP_SUBMISSION_QUEUE', handleStopQueue);
  messageRouter.register('RESUME_SUBMISSION_QUEUE', handleResumeQueue);
  messageRouter.register('CLEAR_SUBMISSION_QUEUE', handleClearQueue);

  console.log('[Submission Queue Manager] Message handlers registered');
}

/**
 * Handle ADD_TO_SUBMISSION_QUEUE message
 * Adds tasks to the queue for the specified backlink IDs
 */
function handleAddToQueue(
  message: { type: string; payload?: { backlinkIds?: string[]; websiteProfileId?: string } },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  (async () => {
    const { backlinkIds, websiteProfileId } = message.payload ?? {};

    if (!backlinkIds || !Array.isArray(backlinkIds) || backlinkIds.length === 0) {
      sendResponse({ success: false, error: '缺少 backlinkIds' });
      return;
    }

    if (!websiteProfileId) {
      sendResponse({ success: false, error: '缺少 websiteProfileId' });
      return;
    }

    // 验证 websiteProfileId 是否存在
    const profile = await websiteProfileStorage.getProfileById(websiteProfileId);
    if (!profile) {
      sendResponse({ success: false, error: `网站资料不存在: ${websiteProfileId}` });
      return;
    }

    const addedTaskIds: string[] = [];
    const errors: string[] = [];

    // 遍历 backlinkIds，为每个外链创建任务
    for (const backlinkId of backlinkIds) {
      try {
        const backlink = await managedBacklinkStorage.getBacklinkById(backlinkId);
        if (!backlink) {
          errors.push(`外链不存在: ${backlinkId}`);
          continue;
        }

        // 创建提交任务
        const taskData: Omit<SubmissionTask, 'id' | 'status' | 'retryCount' | 'createdAt'> = {
          backlinkId: backlink.id,
          url: backlink.url,
          domain: backlink.domain,
          websiteProfileId: websiteProfileId,
          context: {
            backlinkNote: backlink.note,
            backlinkKeywords: backlink.keywords,
          },
        };

        const taskId = submissionQueue.addTask(taskData);
        addedTaskIds.push(taskId);
      } catch (error) {
        errors.push(`处理外链 ${backlinkId} 失败: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    sendResponse({
      success: addedTaskIds.length > 0,
      data: {
        addedCount: addedTaskIds.length,
        taskIds: addedTaskIds,
        totalRequested: backlinkIds.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      error: addedTaskIds.length === 0 ? '没有成功添加任何任务' : undefined,
    });
  })().catch(error => {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '添加任务到队列失败',
    });
  });

  return true; // 异步响应
}

/**
 * Handle GET_SUBMISSION_QUEUE_STATUS message
 * Returns the current queue status
 */
function handleGetStatus(
  _message: { type: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  try {
    const status = submissionQueue.getStatus();
    const currentTask = submissionQueue.getCurrentTask();

    sendResponse({
      success: true,
      data: {
        ...status,
        currentTask,
      },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '获取队列状态失败',
    });
  }

  return false; // 同步响应
}

/**
 * Handle START_SUBMISSION_QUEUE message
 * Starts or resumes the queue processing
 */
function handleStartQueue(
  _message: { type: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  try {
    const status = submissionQueue.getStatus();

    if (status.isPaused) {
      submissionQueue.resume();
      sendResponse({
        success: true,
        data: {
          action: 'resumed',
          status: submissionQueue.getStatus(),
        },
      });
    } else if (!status.isProcessing) {
      // Queue will start automatically when tasks are added
      // If there are tasks and not processing, start it
      if (status.total > 0) {
        submissionQueue.resume();
      }
      sendResponse({
        success: true,
        data: {
          action: 'started',
          status: submissionQueue.getStatus(),
        },
      });
    } else {
      sendResponse({
        success: true,
        data: {
          action: 'already_running',
          status: submissionQueue.getStatus(),
        },
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '启动队列失败',
    });
  }

  return false; // 同步响应
}

/**
 * Handle PAUSE_SUBMISSION_QUEUE message
 * Pauses the queue processing
 */
function handlePauseQueue(
  _message: { type: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  try {
    submissionQueue.pause();
    sendResponse({
      success: true,
      data: {
        status: submissionQueue.getStatus(),
      },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '暂停队列失败',
    });
  }

  return false; // 同步响应
}

/**
 * Handle STOP_SUBMISSION_QUEUE message
 * Stops the queue processing
 */
function handleStopQueue(
  _message: { type: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  try {
    submissionQueue.stop();
    sendResponse({
      success: true,
      data: {
        status: submissionQueue.getStatus(),
      },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '停止队列失败',
    });
  }

  return false; // 同步响应
}

/**
 * Handle RESUME_SUBMISSION_QUEUE message
 * Resumes the queue processing
 */
function handleResumeQueue(
  _message: { type: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  try {
    submissionQueue.resume();
    sendResponse({
      success: true,
      data: { status: submissionQueue.getStatus() },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '恢复队列失败',
    });
  }
  return false;
}

/**
 * Handle CLEAR_SUBMISSION_QUEUE message
 * Clears all tasks from the queue
 */
function handleClearQueue(
  _message: { type: string },
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void,
): boolean {
  try {
    submissionQueue.clear();
    sendResponse({
      success: true,
      data: { status: submissionQueue.getStatus() },
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '清空队列失败',
    });
  }
  return false;
}

// 导出队列实例供其他模块使用
export { submissionQueue };
