/**
 * Ahrefs 收集器集成示例
 * 展示如何在 Chrome 扩展的 content script 中使用收集器
 */

import { collectorRegistry, isAhrefsBacklinkChecker } from './collectors';
import type { CollectedBacklink } from '@extension/shared/lib/types/models';

/**
 * 初始化 Ahrefs 收集器
 */
export function initAhrefsCollector(): void {
  console.log('[Ahrefs Collector Integration] 初始化');

  // 检测当前页面
  if (isAhrefsBacklinkChecker()) {
    console.log('[Ahrefs Collector Integration] 检测到 Ahrefs Backlink Checker 页面');

    // 监听来自扩展的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      handleMessage(message, sender, sendResponse);
      return true; // 保持消息通道开放
    });

    // 通知扩展页面已准备好
    chrome.runtime.sendMessage({
      type: 'AHREFS_PAGE_READY',
      url: window.location.href,
    }).catch(error => {
      console.error('[Ahrefs Collector Integration] 发送消息失败:', error);
    });
  }
}

/**
 * 处理来自扩展的消息
 */
async function handleMessage(
  message: { type: string; maxCount?: number },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    switch (message.type) {
      case 'START_COLLECTION':
        await handleStartCollection(message.maxCount || 10, sendResponse);
        break;

      case 'STOP_COLLECTION':
        handleStopCollection(sendResponse);
        break;

      case 'GET_PROGRESS':
        handleGetProgress(sendResponse);
        break;

      case 'CHECK_STATUS':
        handleCheckStatus(sendResponse);
        break;

      default:
        sendResponse({ success: false, error: '未知的消息类型' });
    }
  } catch (error) {
    console.error('[Ahrefs Collector Integration] 处理消息失败:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}

/**
 * 处理开始收集
 */
async function handleStartCollection(
  maxCount: number,
  sendResponse: (response: unknown) => void,
): Promise<void> {
  try {
    console.log(`[Ahrefs Collector Integration] 开始收集 ${maxCount} 条外链`);

    // 发送开始通知
    chrome.runtime.sendMessage({
      type: 'COLLECTION_STARTED',
      maxCount,
    }).catch(console.error);

    // 开始收集
    const backlinks = await collectorRegistry.startCollection(maxCount);

    console.log(`[Ahrefs Collector Integration] 收集完成，共 ${backlinks.length} 条外链`);

    // 保存到本地存储
    await saveBacklinks(backlinks);

    // 发送完成通知
    chrome.runtime.sendMessage({
      type: 'COLLECTION_COMPLETE',
      payload: { backlinks },
    }).catch(console.error);

    // 响应
    sendResponse({
      success: true,
      count: backlinks.length,
      backlinks,
    });
  } catch (error) {
    console.error('[Ahrefs Collector Integration] 收集失败:', error);

    // 发送失败通知
    chrome.runtime.sendMessage({
      type: 'COLLECTION_FAILED',
      error: error instanceof Error ? error.message : '未知错误',
    }).catch(console.error);

    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}

/**
 * 处理停止收集
 */
function handleStopCollection(sendResponse: (response: unknown) => void): void {
  try {
    collectorRegistry.stopCollection();

    console.log('[Ahrefs Collector Integration] 已停止收集');

    sendResponse({ success: true });
  } catch (error) {
    console.error('[Ahrefs Collector Integration] 停止收集失败:', error);

    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}

/**
 * 处理获取进度
 */
function handleGetProgress(sendResponse: (response: unknown) => void): void {
  try {
    const progress = collectorRegistry.getProgress();

    sendResponse({
      success: true,
      progress,
    });
  } catch (error) {
    console.error('[Ahrefs Collector Integration] 获取进度失败:', error);

    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}

/**
 * 处理检查状态
 */
function handleCheckStatus(sendResponse: (response: unknown) => void): void {
  try {
    const isCollecting = collectorRegistry.isCollecting();
    const collector = collectorRegistry.detectCollector();

    sendResponse({
      success: true,
      isCollecting,
      isSupported: collector !== null,
      platform: collector?.platform,
    });
  } catch (error) {
    console.error('[Ahrefs Collector Integration] 检查状态失败:', error);

    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
    });
  }
}

/**
 * 保存外链到本地存储
 */
async function saveBacklinks(backlinks: CollectedBacklink[]): Promise<void> {
  try {
    if (backlinks.length === 0) {
      return;
    }

    const batchId = backlinks[0].collection_batch_id;
    const key = `backlinks_${batchId}`;

    // 保存到 chrome.storage.local
    await chrome.storage.local.set({
      [key]: {
        batchId,
        count: backlinks.length,
        backlinks,
        savedAt: new Date().toISOString(),
      },
    });

    console.log(`[Ahrefs Collector Integration] 已保存 ${backlinks.length} 条外链到本地存储`);

    // 更新批次列表
    await updateBatchList(batchId, backlinks.length);
  } catch (error) {
    console.error('[Ahrefs Collector Integration] 保存外链失败:', error);
    throw error;
  }
}

/**
 * 更新批次列表
 */
async function updateBatchList(batchId: string, count: number): Promise<void> {
  try {
    // 获取现有批次列表
    const result = await chrome.storage.local.get('batch_list');
    const batchList = result.batch_list || [];

    // 添加新批次
    batchList.push({
      batchId,
      count,
      collectedAt: new Date().toISOString(),
      syncStatus: 'pending',
    });

    // 保存批次列表
    await chrome.storage.local.set({ batch_list: batchList });

    console.log('[Ahrefs Collector Integration] 已更新批次列表');
  } catch (error) {
    console.error('[Ahrefs Collector Integration] 更新批次列表失败:', error);
  }
}

// 页面加载时初始化
if (typeof window !== 'undefined' && typeof chrome !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAhrefsCollector);
  } else {
    initAhrefsCollector();
  }
}
