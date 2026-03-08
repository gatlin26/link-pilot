/**
 * 采集管理器
 * 打开 Ahrefs 页面后，通过 content script 启动 API 拦截并回传数据
 */

import { messageRouter } from './message-router';
import { OpportunityStatus, PageType, LinkType, SourcePlatform } from '@extension/shared';
import { opportunityStorage, collectionBatchStorage } from '@extension/storage';
import type { Opportunity, CollectedBacklink } from '@extension/shared';

interface CollectionResult {
  success: boolean;
  count?: number;
  error?: string;
  debugLogs?: string[];
}

interface BatchCollectionResult {
  success: boolean;
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    url: string;
    success: boolean;
    count?: number;
    error?: string;
  }>;
}

/**
 * 活动标签页信息
 */
interface ActiveTab {
  id: number;
  targetUrl: string;
  maxCount: number;
  timestamp: number;
}

/**
 * 采集管理器类
 */
class CollectionManager {
  public static readonly DEBUG_LOG_KEY = 'collection_debug_logs';
  private static readonly MAX_DEBUG_LOGS = 300;
  private activeTab: ActiveTab | null = null;
  private currentBatchId: string | null = null;

  /**
   * 初始化管理器
   */
  init(): void {
    console.log('[Collection Manager] 初始化');

    console.log('[Collection Manager] 管理器初始化完成');
  }

  /**
   * 开始手动采集
   */
  async startManualCollection(targetUrl: string, maxCount: number = 20): Promise<CollectionResult> {
    let tabId: number | null = null;

    try {
      await this.resetDebugLogs({
        action: 'START_MANUAL_COLLECTION',
        targetUrl,
        maxCount,
        at: new Date().toISOString(),
      });
      await this.logInfo('开始手动采集', { targetUrl, maxCount });

      // 重置状态
      this.currentBatchId = crypto.randomUUID();

      // 打开 Ahrefs Backlink Checker 页面
      const ahrefsUrl = `https://ahrefs.com/backlink-checker?input=${encodeURIComponent(targetUrl)}`;

      const tab = await chrome.tabs.create({
        url: ahrefsUrl,
        active: true,
      });

      if (!tab.id) {
        await this.logError('创建采集标签页失败');
        return {
          success: false,
          error: '无法创建标签页',
          debugLogs: await this.getDebugLogStrings(30),
        };
      }
      tabId = tab.id;

      await this.logInfo('已打开 Ahrefs 页面', { tabId: tab.id, ahrefsUrl });

      // 设置活动标签页
      this.activeTab = {
        id: tab.id,
        targetUrl,
        maxCount,
        timestamp: Date.now(),
      };

      // 等待页面加载完成
      await this.waitForTabLoad(tab.id);
      await this.logInfo('页面加载完成', { tabId: tab.id, tabUrl: tab.url });

      await this.waitForContentReady(tab.id);

      await this.startApiInterceptor(tab.id, maxCount);

      // 等待拦截结果（60 秒）
      const result = await this.waitForApiCollection(tab.id, maxCount, 60000);

      await this.stopApiInterceptor(tab.id);

      // 清理状态
      this.activeTab = null;

      if (result.success && result.data?.length) {
        console.log('[Collection Manager] 采集成功，共', result.data.length, '条');

        // 转换并保存数据
        const opportunities = this.convertToOpportunities(result.data);
        await opportunityStorage.addBatch(opportunities);

        // 保存批次信息
        await collectionBatchStorage.add({
          id: this.currentBatchId!,
          source_platform: SourcePlatform.AHREFS,
          count: opportunities.length,
          collected_at: new Date().toISOString(),
          sync_status: 'pending',
          synced_count: 0,
        });

        return {
          success: true,
          count: opportunities.length,
        };
      } else {
        await this.logWarn('采集结束但无有效数据', { error: result.error });
        return {
          success: false,
          error: result.error || '未找到可采集的外链',
          debugLogs: await this.getDebugLogStrings(30),
        };
      }
    } catch (error) {
      await this.logError('手动采集失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.activeTab = null;
      return {
        success: false,
        error: error instanceof Error ? error.message : '采集失败',
        debugLogs: await this.getDebugLogStrings(30),
      };
    } finally {
      if (tabId) {
        await chrome.tabs.remove(tabId).catch(err => {
          console.warn('[Collection Manager] 关闭采集标签页失败:', err);
        });
      }
    }
  }

  /**
   * 等待标签页加载完成
   */
  private waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error('页面加载超时'));
      }, 30000);

      const listener = (id: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (id === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  private async ensureContentScript(tabId: number): Promise<void> {
    await this.logInfo('尝试注入 content script', { tabId });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/all.iife.js'],
    });
    await this.logInfo('content script 注入完成', { tabId });
  }

  private isReceivingEndMissingError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    return error.message.includes('Receiving end does not exist');
  }

  private async sendMessageToTab<T = unknown>(tabId: number, message: unknown): Promise<T> {
    const maxAttempts = 5;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.logInfo('发送消息到标签页', {
          tabId,
          attempt,
          type: this.extractMessageType(message),
        });
        const response = (await chrome.tabs.sendMessage(tabId, message)) as T;
        await this.logInfo('标签页消息发送成功', {
          tabId,
          attempt,
          type: this.extractMessageType(message),
        });
        return response;
      } catch (error) {
        lastError = error;
        if (!this.isReceivingEndMissingError(error)) {
          await this.logError('标签页消息发送失败（非接收端错误）', {
            tabId,
            attempt,
            error: error instanceof Error ? error.message : String(error),
            type: this.extractMessageType(message),
          });
          throw error;
        }

        await this.logWarn('未找到消息接收端，准备重试注入', {
          tabId,
          attempt,
          type: this.extractMessageType(message),
        });
        await this.ensureContentScript(tabId);
        await new Promise(resolve => setTimeout(resolve, 200 * attempt));
      }
    }

    throw new Error(
      `无法连接到内容脚本（${maxAttempts} 次重试后仍失败）：${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }

  private async waitForContentReady(tabId: number): Promise<void> {
    const response = await this.sendMessageToTab<{ success?: boolean; error?: string }>(tabId, {
      type: 'PING_CONTENT_SCRIPT',
    });

    if (!response?.success) {
      throw new Error(response?.error || '内容脚本未就绪');
    }

    await this.logInfo('内容脚本握手成功', { tabId });
  }

  private async startApiInterceptor(tabId: number, maxCount: number): Promise<void> {
    await this.logInfo('准备启动 API 拦截器', { tabId, maxCount });
    const response = await this.sendMessageToTab<{ success?: boolean; error?: string }>(tabId, {
      type: 'START_API_INTERCEPTOR',
      payload: { maxCount },
    });

    if (!response?.success) {
      throw new Error(response?.error || '启动 API 拦截失败');
    }
    await this.logInfo('API 拦截器启动成功', { tabId, maxCount });
  }

  private async stopApiInterceptor(tabId: number): Promise<void> {
    await this.logInfo('准备停止 API 拦截器', { tabId });
    await this.sendMessageToTab<{ success?: boolean }>(tabId, {
      type: 'STOP_API_INTERCEPTOR',
    }).catch(error => {
      console.warn('[Collection Manager] 停止 API 拦截失败:', error);
    });
  }

  private waitForApiCollection(
    tabId: number,
    maxCount: number,
    timeout: number,
  ): Promise<{ success: boolean; data?: CollectedBacklink[]; error?: string }> {
    return new Promise(resolve => {
      void this.logInfo('开始等待拦截结果', { tabId, maxCount, timeout });
      const timeoutId = setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        void this.logWarn('等待拦截结果超时', { tabId, timeout });
        resolve({
          success: false,
          error: '采集超时',
        });
      }, timeout);

      const listener = (
        message: { type?: string; payload?: { backlinks?: CollectedBacklink[]; error?: string } },
        sender: chrome.runtime.MessageSender,
      ) => {
        if (sender.tab?.id !== tabId) {
          return false;
        }

        if (message.type === 'COLLECTION_COMPLETE') {
          clearTimeout(timeoutId);
          chrome.runtime.onMessage.removeListener(listener);

          const backlinks = Array.isArray(message.payload?.backlinks)
            ? message.payload.backlinks.slice(0, maxCount)
            : [];

          if (!backlinks.length) {
            void this.logWarn('收到完成事件但外链为空', { tabId });
            resolve({
              success: false,
              error: '未拦截到可用外链数据',
            });
            return false;
          }

          void this.logInfo('收到完成事件并返回外链数据', {
            tabId,
            count: backlinks.length,
          });
          resolve({
            success: true,
            data: backlinks,
          });
          return false;
        }

        if (message.type === 'COLLECTION_ERROR') {
          clearTimeout(timeoutId);
          chrome.runtime.onMessage.removeListener(listener);
          void this.logError('收到拦截错误事件', {
            tabId,
            error: message.payload?.error || '采集失败',
          });
          resolve({
            success: false,
            error: message.payload?.error || '采集失败',
          });
          return false;
        }

        return false;
      };

      chrome.runtime.onMessage.addListener(listener);
    });
  }

  private extractMessageType(message: unknown): string {
    if (typeof message === 'object' && message && 'type' in message) {
      return String((message as { type: unknown }).type);
    }
    return 'UNKNOWN';
  }

  private async resetDebugLogs(context: Record<string, unknown>): Promise<void> {
    const seed = [
      `[${new Date().toISOString()}] [INFO] 调试日志已重置`,
      `[${new Date().toISOString()}] [INFO] context=${JSON.stringify(context)}`,
    ];
    await chrome.storage.local.set({ [CollectionManager.DEBUG_LOG_KEY]: seed });
  }

  private async appendDebugLog(
    level: 'INFO' | 'WARN' | 'ERROR',
    message: string,
    detail?: Record<string, unknown>,
  ): Promise<void> {
    const detailText = detail ? ` detail=${JSON.stringify(detail)}` : '';
    const line = `[${new Date().toISOString()}] [${level}] ${message}${detailText}`;

    const prefix = `[Collection Manager][${level}]`;
    if (level === 'ERROR') {
      console.error(prefix, message, detail || '');
    } else if (level === 'WARN') {
      console.warn(prefix, message, detail || '');
    } else {
      console.log(prefix, message, detail || '');
    }

    const stored = await chrome.storage.local.get(CollectionManager.DEBUG_LOG_KEY);
    const existing = Array.isArray(stored[CollectionManager.DEBUG_LOG_KEY])
      ? (stored[CollectionManager.DEBUG_LOG_KEY] as string[])
      : [];
    const next = [...existing, line].slice(-CollectionManager.MAX_DEBUG_LOGS);
    await chrome.storage.local.set({ [CollectionManager.DEBUG_LOG_KEY]: next });
  }

  private async getDebugLogStrings(limit: number): Promise<string[]> {
    const stored = await chrome.storage.local.get(CollectionManager.DEBUG_LOG_KEY);
    const existing = Array.isArray(stored[CollectionManager.DEBUG_LOG_KEY])
      ? (stored[CollectionManager.DEBUG_LOG_KEY] as string[])
      : [];
    return existing.slice(-limit);
  }

  private async logInfo(message: string, detail?: Record<string, unknown>): Promise<void> {
    await this.appendDebugLog('INFO', message, detail);
  }

  private async logWarn(message: string, detail?: Record<string, unknown>): Promise<void> {
    await this.appendDebugLog('WARN', message, detail);
  }

  private async logError(message: string, detail?: Record<string, unknown>): Promise<void> {
    await this.appendDebugLog('ERROR', message, detail);
  }

  /**
   * 将采集的外链数据转换为机会
   */
  private convertToOpportunities(backlinks: CollectedBacklink[]): Opportunity[] {
    return backlinks.map(backlink => ({
      id: crypto.randomUUID(),
      collected_backlink_id: backlink.id,
      url: backlink.target_url,
      domain: backlink.target_domain,
      page_type: PageType.BLOG_COMMENT,
      path_pattern: '',
      link_type: LinkType.BLOG_COMMENT,
      site_summary: backlink.site_summary || '',
      site_business_types: [],
      context_match_score: backlink.context_match_score || 0,
      context_match_note: backlink.context_match_note || '',
      can_submit: true,
      can_auto_fill: false,
      can_auto_submit: false,
      status: OpportunityStatus.NEW,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  /**
   * 批量采集
   */
  async handleBatchCollection(targetUrls: string[]): Promise<BatchCollectionResult> {
    console.log('[Collection Manager] 开始批量采集，共', targetUrls.length, '个目标');

    const results: BatchCollectionResult['results'] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < targetUrls.length; i++) {
      const url = targetUrls[i];
      console.log(`[Collection Manager] 采集进度: ${i + 1}/${targetUrls.length} - ${url}`);

      try {
        const result = await this.startManualCollection(url);

        results.push({
          url,
          success: result.success,
          count: result.count,
          error: result.error,
        });

        if (result.success) {
          successful++;
        } else {
          failed++;
        }

        // 每次采集之间等待 2 秒
        if (i < targetUrls.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.error('[Collection Manager] 采集失败:', url, error);
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : '采集失败',
        });
        failed++;
      }
    }

    return {
      success: successful > 0,
      total: targetUrls.length,
      successful,
      failed,
      results,
    };
  }
}

// 创建并初始化管理器实例
const collectionManager = new CollectionManager();
collectionManager.init();

// 注册消息处理器
messageRouter.register('CHECK_IF_COLLECTED', (message, sender, sendResponse) => {
  const { domain } = message.payload;
  console.log('[Collection Manager] 检查采集状态:', domain);

  opportunityStorage
    .getAll()
    .then(opportunities => {
      const isCollected = opportunities.some(opp => opp.domain === domain);
      console.log('[Collection Manager] 检查结果:', domain, '已采集:', isCollected);
      sendResponse({ isCollected });
    })
    .catch(error => {
      console.error('[Collection Manager] 检查采集状态失败:', error);
      sendResponse({ isCollected: false, error: error.message });
    });

  return true; // 异步响应
});

messageRouter.register('START_MANUAL_COLLECTION', (message, sender, sendResponse) => {
  const { targetUrl } = message.payload;
  console.log('[Collection Manager] 开始手动采集:', targetUrl);

  collectionManager
    .startManualCollection(targetUrl)
    .then(result => {
      console.log('[Collection Manager] 采集完成:', result);
      sendResponse(result);
    })
    .catch(error => {
      console.error('[Collection Manager] 采集失败:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '采集失败',
      });
    });

  return true; // 异步响应
});

messageRouter.register('GET_COLLECTION_DEBUG_LOGS', (_message, _sender, sendResponse) => {
  chrome.storage.local
    .get(CollectionManager.DEBUG_LOG_KEY)
    .then(stored => {
      const logs = Array.isArray(stored[CollectionManager.DEBUG_LOG_KEY])
        ? stored[CollectionManager.DEBUG_LOG_KEY]
        : [];
      sendResponse({ success: true, logs });
    })
    .catch(error => {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : '读取调试日志失败',
      });
    });

  return true;
});

messageRouter.register('START_BATCH_COLLECTION', (message, sender, sendResponse) => {
  const { targetUrls } = message.payload;
  console.log('[Collection Manager] 开始批量采集:', targetUrls.length, '个目标');

  collectionManager
    .handleBatchCollection(targetUrls)
    .then(result => {
      console.log('[Collection Manager] 批量采集完成:', result);
      sendResponse(result);
    })
    .catch(error => {
      console.error('[Collection Manager] 批量采集失败:', error);
      sendResponse({
        success: false,
        total: 0,
        successful: 0,
        failed: 0,
        results: [],
        error: error instanceof Error ? error.message : '批量采集失败',
      });
    });

  return true; // 异步响应
});

console.log('[Collection Manager] Collection manager loaded');
